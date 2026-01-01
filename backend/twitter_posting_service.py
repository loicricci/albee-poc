"""
Twitter Posting Service
Handles posting content to Twitter with media upload support
"""

import os
import uuid
import tweepy
import requests
import tempfile
from typing import Dict, Optional
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from sqlalchemy import text
import logging

from models import Post, Avee, ProfileTwitterConfig
from twitter_oauth_service import get_twitter_oauth_service

logger = logging.getLogger(__name__)


class TwitterPostingService:
    """Service for posting content to Twitter"""
    
    def __init__(self):
        """Initialize Twitter posting service"""
        self.oauth_service = get_twitter_oauth_service()
    
    def should_auto_post(self, agent_id: uuid.UUID, db: Session) -> bool:
        """
        Check if agent should auto-post to Twitter
        
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
            
            # Check if Twitter sharing is enabled and mode is auto
            if not agent.twitter_sharing_enabled:
                return False
            
            if agent.twitter_posting_mode != "auto":
                return False
            
            # Check if owner has Twitter connected
            config = db.query(ProfileTwitterConfig).filter(
                ProfileTwitterConfig.user_id == agent.owner_user_id
            ).first()
            
            if not config or not config.is_active:
                return False
            
            return True
            
        except Exception as e:
            logger.error(f"Error checking auto-post status for agent {agent_id}: {e}")
            return False
    
    def can_post_to_twitter(self, agent_id: uuid.UUID, db: Session) -> Dict:
        """
        Check if agent can post to Twitter (regardless of mode)
        
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
            
            # Check if Twitter sharing is enabled
            if not agent.twitter_sharing_enabled:
                return {"can_post": False, "reason": "Twitter sharing not enabled for this agent"}
            
            # Check if owner has Twitter connected
            config = db.query(ProfileTwitterConfig).filter(
                ProfileTwitterConfig.user_id == agent.owner_user_id
            ).first()
            
            if not config or not config.is_active:
                return {"can_post": False, "reason": "Twitter not connected for agent owner"}
            
            return {"can_post": True}
            
        except Exception as e:
            logger.error(f"Error checking Twitter status for agent {agent_id}: {e}")
            return {"can_post": False, "reason": f"Error: {str(e)}"}
    
    def format_for_twitter(self, post: Post) -> str:
        """
        Format post content for Twitter (280 character limit)
        
        Args:
            post: Post object
            
        Returns:
            Formatted text for tweet
        """
        text = ""
        
        if post.title:
            text = post.title
        
        if post.description:
            if text:
                text += "\n\n" + post.description
            else:
                text = post.description
        
        # Twitter limit is 280 characters
        # Leave some room for image URL if needed
        max_length = 270
        
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
    
    def post_to_twitter(
        self,
        post_id: uuid.UUID,
        user_id: uuid.UUID,
        db: Session
    ) -> Dict:
        """
        Post content to Twitter with image
        
        Args:
            post_id: Post UUID
            user_id: User UUID (must be owner of the post's agent)
            db: Database session
            
        Returns:
            dict with 'success', 'twitter_url', and optional 'error'
        """
        temp_file = None
        
        try:
            # Get post
            post = db.query(Post).filter(Post.id == post_id).first()
            if not post:
                raise ValueError("Post not found")
            
            # Check if already posted
            if post.posted_to_twitter:
                return {
                    "success": False,
                    "error": "Post already shared to Twitter",
                    "twitter_url": post.twitter_post_url
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
            
            # Check if agent has Twitter enabled
            status = self.can_post_to_twitter(post.agent_id, db)
            if not status["can_post"]:
                raise ValueError(status.get("reason", "Cannot post to Twitter"))
            
            # Get Twitter client for user
            client = self.oauth_service.get_twitter_client(user_id, db)
            if not client:
                raise ValueError("Failed to get Twitter client")
            
            # Get config for API v1.1 (needed for media upload)
            config = db.query(ProfileTwitterConfig).filter(
                ProfileTwitterConfig.user_id == user_id
            ).first()
            
            if not config:
                raise ValueError("Twitter config not found")
            
            # Format tweet text
            tweet_text = self.format_for_twitter(post)
            
            # Download image
            temp_file = self.download_image(post.image_url)
            
            media_id = None
            if temp_file:
                try:
                    # Upload media using API v1.1
                    auth = tweepy.OAuth1UserHandler(
                        self.oauth_service.consumer_key,
                        self.oauth_service.consumer_secret,
                        config.access_token,
                        config.access_secret
                    )
                    api_v1 = tweepy.API(auth)
                    
                    media = api_v1.media_upload(temp_file)
                    media_id = media.media_id
                    logger.info(f"Uploaded media with ID: {media_id}")
                    
                except Exception as e:
                    logger.error(f"Failed to upload media: {e}")
                    # Continue without image
            
            # Create tweet using API v2
            tweet_params = {"text": tweet_text}
            if media_id:
                tweet_params["media_ids"] = [media_id]
            
            response = client.create_tweet(**tweet_params)
            
            if not response or not response.data:
                raise RuntimeError("Failed to create tweet")
            
            tweet_id = response.data["id"]
            twitter_username = config.twitter_username
            twitter_url = f"https://twitter.com/{twitter_username}/status/{tweet_id}"
            
            # Update post in database
            post.posted_to_twitter = True
            post.twitter_post_id = str(tweet_id)
            post.twitter_post_url = twitter_url
            post.twitter_posted_at = datetime.now(timezone.utc)
            
            db.commit()
            
            logger.info(f"Posted to Twitter: {twitter_url}")
            
            return {
                "success": True,
                "twitter_url": twitter_url,
                "tweet_id": str(tweet_id)
            }
            
        except Exception as e:
            logger.error(f"Failed to post to Twitter: {e}")
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
_twitter_posting_service = None


def get_twitter_posting_service() -> TwitterPostingService:
    """Get or create global Twitter posting service instance"""
    global _twitter_posting_service
    if _twitter_posting_service is None:
        _twitter_posting_service = TwitterPostingService()
    return _twitter_posting_service

