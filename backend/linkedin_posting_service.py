"""
LinkedIn Posting Service
Handles posting content to LinkedIn with media upload support
"""

import os
import uuid
import requests
import tempfile
from typing import Dict, Optional
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from sqlalchemy import text
import logging
import json

from backend.models import Post, Avee, ProfileLinkedInConfig
from backend.linkedin_oauth_service import get_linkedin_oauth_service

logger = logging.getLogger(__name__)


class LinkedInPostingService:
    """Service for posting content to LinkedIn"""
    
    # LinkedIn API endpoints
    UGC_POSTS_URL = "https://api.linkedin.com/v2/ugcPosts"
    ASSETS_URL = "https://api.linkedin.com/v2/assets"
    IMAGES_URL = "https://api.linkedin.com/rest/images"
    
    def __init__(self):
        """Initialize LinkedIn posting service"""
        self.oauth_service = get_linkedin_oauth_service()
    
    def should_auto_post(self, agent_id: uuid.UUID, db: Session) -> bool:
        """
        Check if agent should auto-post to LinkedIn
        
        Args:
            agent_id: Agent UUID
            db: Database session
            
        Returns:
            bool - True if should auto-post
        """
        try:
            # Get agent
            agent = db.query(Avee).filter(Avee.id == agent_id).first()
            if not agent:
                return False
            
            # Check if LinkedIn sharing is enabled and mode is auto
            if not agent.linkedin_sharing_enabled:
                return False
            
            if agent.linkedin_posting_mode != "auto":
                return False
            
            # Check if owner has LinkedIn connected
            config = db.query(ProfileLinkedInConfig).filter(
                ProfileLinkedInConfig.user_id == agent.owner_user_id
            ).first()
            
            if not config or not config.is_active:
                return False
            
            return True
            
        except Exception as e:
            logger.error(f"Error checking LinkedIn auto-post status for agent {agent_id}: {e}")
            return False
    
    def can_post_to_linkedin(self, agent_id: uuid.UUID, db: Session) -> Dict:
        """
        Check if agent can post to LinkedIn (regardless of mode)
        
        Args:
            agent_id: Agent UUID
            db: Database session
            
        Returns:
            dict with 'can_post' bool and optional 'reason' string
        """
        try:
            # Get agent
            agent = db.query(Avee).filter(Avee.id == agent_id).first()
            if not agent:
                return {"can_post": False, "reason": "Agent not found"}
            
            # Check if LinkedIn sharing is enabled
            if not agent.linkedin_sharing_enabled:
                return {"can_post": False, "reason": "LinkedIn sharing not enabled for this agent"}
            
            # Check if owner has LinkedIn connected
            config = db.query(ProfileLinkedInConfig).filter(
                ProfileLinkedInConfig.user_id == agent.owner_user_id
            ).first()
            
            if not config or not config.is_active:
                return {"can_post": False, "reason": "LinkedIn not connected for agent owner"}
            
            # Check if posting to organization and organization is configured
            if agent.linkedin_target_type == "organization":
                if not agent.linkedin_organization_id:
                    return {"can_post": False, "reason": "No LinkedIn organization configured for this agent"}
                
                # Verify organization is in user's available organizations
                organizations = []
                if config.organizations:
                    try:
                        organizations = json.loads(config.organizations)
                    except:
                        pass
                
                org_ids = [org.get("id") for org in organizations]
                if agent.linkedin_organization_id not in org_ids:
                    return {"can_post": False, "reason": "User does not have access to the configured organization"}
            
            return {"can_post": True}
            
        except Exception as e:
            logger.error(f"Error checking LinkedIn status for agent {agent_id}: {e}")
            return {"can_post": False, "reason": f"Error: {str(e)}"}
    
    def format_for_linkedin(self, post: Post) -> str:
        """
        Format post content for LinkedIn (3000 character limit)
        
        Args:
            post: Post object
            
        Returns:
            Formatted text for LinkedIn post
        """
        text = ""
        
        if post.title:
            text = post.title
        
        if post.description:
            if text:
                text += "\n\n" + post.description
            else:
                text = post.description
        
        # LinkedIn limit is 3000 characters
        max_length = 2900  # Leave some buffer
        
        if len(text) > max_length:
            text = text[:max_length-3] + "..."
        
        return text if text else "Check out my latest post!"
    
    def download_image(self, image_url: str) -> Optional[str]:
        """
        Download image from URL to temporary file
        
        Args:
            image_url: URL of the image
            
        Returns:
            Path to temporary file or None if failed
        """
        try:
            response = requests.get(image_url, timeout=30)
            response.raise_for_status()
            
            # Determine file extension from content type or URL
            content_type = response.headers.get('content-type', '')
            if 'jpeg' in content_type or 'jpg' in content_type:
                ext = '.jpg'
            elif 'png' in content_type:
                ext = '.png'
            elif 'gif' in content_type:
                ext = '.gif'
            elif 'webp' in content_type:
                ext = '.webp'
            else:
                # Try to get from URL
                ext = os.path.splitext(image_url)[1] or '.jpg'
            
            # Create temporary file
            temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=ext)
            temp_file.write(response.content)
            temp_file.close()
            
            logger.info(f"Downloaded image to {temp_file.name}")
            return temp_file.name
            
        except Exception as e:
            logger.error(f"Failed to download image from {image_url}: {e}")
            return None
    
    def _register_upload(self, access_token: str, owner_urn: str) -> Optional[Dict]:
        """
        Register an image upload with LinkedIn
        
        Args:
            access_token: LinkedIn access token
            owner_urn: Owner URN (person or organization)
            
        Returns:
            dict with upload URL and asset URN, or None if failed
        """
        try:
            register_request = {
                "registerUploadRequest": {
                    "recipes": ["urn:li:digitalmediaRecipe:feedshare-image"],
                    "owner": owner_urn,
                    "serviceRelationships": [
                        {
                            "relationshipType": "OWNER",
                            "identifier": "urn:li:userGeneratedContent"
                        }
                    ]
                }
            }
            
            response = requests.post(
                self.ASSETS_URL + "?action=registerUpload",
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "Content-Type": "application/json",
                    "X-Restli-Protocol-Version": "2.0.0"
                },
                json=register_request
            )
            
            if response.status_code != 200:
                logger.error(f"Failed to register upload: {response.status_code} - {response.text}")
                return None
            
            data = response.json()
            upload_url = data["value"]["uploadMechanism"]["com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest"]["uploadUrl"]
            asset_urn = data["value"]["asset"]
            
            return {
                "upload_url": upload_url,
                "asset_urn": asset_urn
            }
            
        except Exception as e:
            logger.error(f"Failed to register LinkedIn upload: {e}")
            return None
    
    def _upload_image_to_linkedin(self, access_token: str, upload_url: str, image_path: str) -> bool:
        """
        Upload image binary to LinkedIn
        
        Args:
            access_token: LinkedIn access token
            upload_url: Upload URL from registration
            image_path: Local path to image file
            
        Returns:
            bool - True if upload succeeded
        """
        try:
            with open(image_path, 'rb') as f:
                image_data = f.read()
            
            # Determine content type
            if image_path.endswith('.png'):
                content_type = 'image/png'
            elif image_path.endswith('.gif'):
                content_type = 'image/gif'
            elif image_path.endswith('.webp'):
                content_type = 'image/webp'
            else:
                content_type = 'image/jpeg'
            
            response = requests.put(
                upload_url,
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "Content-Type": content_type
                },
                data=image_data
            )
            
            # LinkedIn returns 201 Created on successful upload
            if response.status_code in [200, 201]:
                logger.info("Successfully uploaded image to LinkedIn")
                return True
            else:
                logger.error(f"Failed to upload image: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            logger.error(f"Failed to upload image to LinkedIn: {e}")
            return False
    
    def post_to_linkedin(
        self,
        post_id: uuid.UUID,
        user_id: uuid.UUID,
        db: Session
    ) -> Dict:
        """
        Post content to LinkedIn with image
        
        Args:
            post_id: Post UUID
            user_id: User UUID (must be owner of the post's agent)
            db: Database session
            
        Returns:
            dict with 'success', 'linkedin_url', and optional 'error'
        """
        temp_file = None
        
        try:
            # Get post
            post = db.query(Post).filter(Post.id == post_id).first()
            if not post:
                raise ValueError("Post not found")
            
            # Check if already posted
            if post.posted_to_linkedin:
                return {
                    "success": False,
                    "error": "Post already shared to LinkedIn",
                    "linkedin_url": post.linkedin_post_url
                }
            
            # Get agent
            if not post.agent_id:
                raise ValueError("Post has no associated agent")
            
            agent = db.query(Avee).filter(Avee.id == post.agent_id).first()
            if not agent:
                raise ValueError("Agent not found")
            
            # Verify user owns the agent
            if agent.owner_user_id != user_id:
                raise ValueError("User does not own this agent")
            
            # Check if agent has LinkedIn enabled
            status = self.can_post_to_linkedin(post.agent_id, db)
            if not status["can_post"]:
                raise ValueError(status.get("reason", "Cannot post to LinkedIn"))
            
            # Get valid access token (refreshes if needed)
            access_token = self.oauth_service.get_valid_access_token(user_id, db)
            if not access_token:
                raise ValueError("Failed to get LinkedIn access token")
            
            # Get LinkedIn config for user info
            config = db.query(ProfileLinkedInConfig).filter(
                ProfileLinkedInConfig.user_id == user_id
            ).first()
            
            if not config:
                raise ValueError("LinkedIn config not found")
            
            # Determine the owner URN (person or organization)
            if agent.linkedin_target_type == "organization" and agent.linkedin_organization_id:
                owner_urn = agent.linkedin_organization_id
            else:
                owner_urn = f"urn:li:person:{config.linkedin_user_id}"
            
            # Format post text
            post_text = self.format_for_linkedin(post)
            
            # Download image
            temp_file = self.download_image(post.image_url)
            
            media_asset = None
            if temp_file:
                try:
                    # Register upload
                    upload_info = self._register_upload(access_token, owner_urn)
                    
                    if upload_info:
                        # Upload image binary
                        if self._upload_image_to_linkedin(access_token, upload_info["upload_url"], temp_file):
                            media_asset = upload_info["asset_urn"]
                            logger.info(f"Uploaded media with asset URN: {media_asset}")
                        
                except Exception as e:
                    logger.error(f"Failed to upload media: {e}")
                    # Continue without image
            
            # Create the UGC post
            ugc_post = {
                "author": owner_urn,
                "lifecycleState": "PUBLISHED",
                "specificContent": {
                    "com.linkedin.ugc.ShareContent": {
                        "shareCommentary": {
                            "text": post_text
                        },
                        "shareMediaCategory": "IMAGE" if media_asset else "NONE"
                    }
                },
                "visibility": {
                    "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC"
                }
            }
            
            # Add media if we have it
            if media_asset:
                ugc_post["specificContent"]["com.linkedin.ugc.ShareContent"]["media"] = [
                    {
                        "status": "READY",
                        "media": media_asset
                    }
                ]
            
            # Post to LinkedIn
            response = requests.post(
                self.UGC_POSTS_URL,
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "Content-Type": "application/json",
                    "X-Restli-Protocol-Version": "2.0.0"
                },
                json=ugc_post
            )
            
            if response.status_code not in [200, 201]:
                logger.error(f"Failed to create LinkedIn post: {response.status_code} - {response.text}")
                raise RuntimeError(f"Failed to create LinkedIn post: {response.text}")
            
            # Extract post ID from response
            post_urn = response.headers.get("X-RestLi-Id") or response.json().get("id", "")
            
            # Construct LinkedIn URL
            # For UGC posts, the URL format is different
            linkedin_url = f"https://www.linkedin.com/feed/update/{post_urn}"
            
            # Update post in database
            post.posted_to_linkedin = True
            post.linkedin_post_id = post_urn
            post.linkedin_post_url = linkedin_url
            post.linkedin_posted_at = datetime.now(timezone.utc)
            
            db.commit()
            
            logger.info(f"Posted to LinkedIn: {linkedin_url}")
            
            return {
                "success": True,
                "linkedin_url": linkedin_url,
                "linkedin_post_id": post_urn
            }
            
        except Exception as e:
            logger.error(f"Failed to post to LinkedIn: {e}")
            return {
                "success": False,
                "error": str(e)
            }
            
        finally:
            # Clean up temporary file
            if temp_file and os.path.exists(temp_file):
                try:
                    os.unlink(temp_file)
                except Exception as e:
                    logger.error(f"Failed to delete temp file {temp_file}: {e}")


# Global service instance
_linkedin_posting_service = None


def get_linkedin_posting_service() -> LinkedInPostingService:
    """Get or create global LinkedIn posting service instance"""
    global _linkedin_posting_service
    if _linkedin_posting_service is None:
        _linkedin_posting_service = LinkedInPostingService()
    return _linkedin_posting_service
