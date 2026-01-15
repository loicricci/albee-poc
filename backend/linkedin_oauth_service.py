"""
LinkedIn OAuth Service
Handles OAuth 2.0 flow for connecting user LinkedIn accounts
"""

import os
import uuid
import secrets
import hashlib
import base64
import requests
from typing import Optional, Dict, List
from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session
from sqlalchemy import text
import logging
import json

from backend.models import ProfileLinkedInConfig, LinkedInOAuthState
from backend.db import SessionLocal

logger = logging.getLogger(__name__)


class LinkedInOAuthService:
    """Service for handling LinkedIn OAuth 2.0 authentication"""
    
    # LinkedIn OAuth endpoints
    AUTHORIZATION_URL = "https://www.linkedin.com/oauth/v2/authorization"
    TOKEN_URL = "https://www.linkedin.com/oauth/v2/accessToken"
    USERINFO_URL = "https://api.linkedin.com/v2/userinfo"
    ORGANIZATIONS_URL = "https://api.linkedin.com/v2/organizationAcls"
    
    # Default scopes for LinkedIn API
    DEFAULT_SCOPES = [
        "openid",
        "profile", 
        "email",
        "w_member_social"  # For posting to personal profile
    ]
    
    def __init__(self):
        """Initialize LinkedIn OAuth service"""
        self.client_id = os.getenv("LINKEDIN_CLIENT_ID")
        self.client_secret = os.getenv("LINKEDIN_CLIENT_SECRET")
        self.callback_url = os.getenv("LINKEDIN_OAUTH_CALLBACK_URL", "http://localhost:3000/linkedin-callback")
        
        
        if not self.client_id or not self.client_secret:
            logger.warning("LinkedIn OAuth credentials not configured")
    
    def is_configured(self) -> bool:
        """Check if LinkedIn OAuth is configured"""
        return bool(self.client_id and self.client_secret)
    
    def _generate_code_verifier(self) -> str:
        """Generate PKCE code verifier"""
        return secrets.token_urlsafe(64)
    
    def _generate_code_challenge(self, verifier: str) -> str:
        """Generate PKCE code challenge from verifier"""
        digest = hashlib.sha256(verifier.encode()).digest()
        return base64.urlsafe_b64encode(digest).rstrip(b'=').decode()
    
    def initiate_oauth(self, user_id: uuid.UUID, db: Session, include_org_scope: bool = False) -> Dict:
        """
        Start OAuth flow and return authorization URL
        
        Args:
            user_id: UUID of the user initiating OAuth
            db: Database session
            include_org_scope: If True, request organization posting scope
            
        Returns:
            dict with 'auth_url' and 'state' token
        """
        if not self.is_configured():
            raise RuntimeError("LinkedIn OAuth not configured")
        
        try:
            # Generate CSRF state token
            state = secrets.token_urlsafe(32)
            
            # PKCE disabled for debugging - confidential clients don't require it
            code_verifier = ""  # Empty string instead of None for DB compatibility
            
            # Build scopes
            scopes = self.DEFAULT_SCOPES.copy()
            if include_org_scope:
                scopes.append("w_organization_social")
            
            # Store state and code verifier in database
            oauth_state = LinkedInOAuthState(
                state=state,
                code_verifier=code_verifier,
                user_id=user_id
            )
            db.add(oauth_state)
            db.commit()
            
            # Build authorization URL (without PKCE for now)
            params = {
                "response_type": "code",
                "client_id": self.client_id,
                "redirect_uri": self.callback_url,
                "state": state,
                "scope": " ".join(scopes)
                # PKCE disabled: "code_challenge": code_challenge,
                # "code_challenge_method": "S256"
            }
            
            auth_url = f"{self.AUTHORIZATION_URL}?" + "&".join(
                f"{k}={requests.utils.quote(str(v))}" for k, v in params.items()
            )
            
            logger.info(f"Initiated LinkedIn OAuth for user {user_id}")
            
            return {
                "auth_url": auth_url,
                "state": state
            }
            
        except Exception as e:
            logger.error(f"Failed to initiate LinkedIn OAuth: {e}")
            raise RuntimeError(f"Failed to start LinkedIn OAuth: {str(e)}")
    
    def complete_oauth(
        self,
        code: str,
        state: str,
        db: Session
    ) -> Dict:
        """
        Complete OAuth flow and store access tokens
        
        Args:
            code: Authorization code from callback
            state: CSRF state token
            db: Database session
            
        Returns:
            dict with LinkedIn user info
        """
        if not self.is_configured():
            raise RuntimeError("LinkedIn OAuth not configured")
        
        try:
            # Verify state token and retrieve code verifier
            oauth_state = db.query(LinkedInOAuthState).filter(
                LinkedInOAuthState.state == state
            ).first()
            
            if not oauth_state:
                raise ValueError("Invalid or expired OAuth state")
            
            # Check if state is not too old (10 minutes)
            now_utc = datetime.now(timezone.utc)
            state_created = oauth_state.created_at
            if state_created.tzinfo is None:
                state_created = state_created.replace(tzinfo=timezone.utc)
            
            if state_created < now_utc - timedelta(minutes=10):
                db.delete(oauth_state)
                db.commit()
                raise ValueError("OAuth state expired")
            
            user_id = oauth_state.user_id
            code_verifier = oauth_state.code_verifier
            
            # Exchange authorization code for access token (without PKCE)
            token_data = {
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": self.callback_url,
                "client_id": self.client_id,
                "client_secret": self.client_secret
            }
            # Only add code_verifier if PKCE was used (non-empty string)
            if code_verifier and len(code_verifier) > 0:
                token_data["code_verifier"] = code_verifier
            
            token_response = requests.post(
                self.TOKEN_URL,
                data=token_data,
                headers={"Content-Type": "application/x-www-form-urlencoded"}
            )
            
            if token_response.status_code != 200:
                logger.error(f"Token exchange failed: {token_response.text}")
                raise RuntimeError(f"Failed to exchange code for token: {token_response.text}")
            
            token_result = token_response.json()
            access_token = token_result["access_token"]
            refresh_token = token_result.get("refresh_token")
            expires_in = token_result.get("expires_in", 5184000)  # Default 60 days
            
            # Calculate token expiration
            token_expires_at = now_utc + timedelta(seconds=expires_in)
            
            # Get LinkedIn user info
            user_response = requests.get(
                self.USERINFO_URL,
                headers={"Authorization": f"Bearer {access_token}"}
            )
            
            if user_response.status_code != 200:
                logger.error(f"Failed to get user info: {user_response.text}")
                raise RuntimeError("Failed to get LinkedIn user info")
            
            user_info = user_response.json()
            linkedin_user_id = user_info.get("sub")  # OpenID Connect subject (user URN)
            linkedin_name = user_info.get("name", "")
            linkedin_email = user_info.get("email", "")
            
            # Try to get organizations the user can post to
            organizations = []
            try:
                organizations = self._get_user_organizations(access_token)
            except Exception as org_error:
                logger.warning(f"Could not fetch organizations: {org_error}")
            
            # Check if config already exists
            existing_config = db.query(ProfileLinkedInConfig).filter(
                ProfileLinkedInConfig.user_id == user_id
            ).first()
            
            if existing_config:
                # Update existing
                existing_config.linkedin_user_id = linkedin_user_id
                existing_config.linkedin_username = linkedin_name
                existing_config.linkedin_profile_url = f"https://www.linkedin.com/in/{linkedin_user_id}"
                existing_config.access_token = access_token
                existing_config.refresh_token = refresh_token
                existing_config.token_expires_at = token_expires_at
                existing_config.organizations = json.dumps(organizations)
                existing_config.is_active = True
                existing_config.updated_at = now_utc
            else:
                # Create new config
                config = ProfileLinkedInConfig(
                    user_id=user_id,
                    linkedin_user_id=linkedin_user_id,
                    linkedin_username=linkedin_name,
                    linkedin_profile_url=f"https://www.linkedin.com/in/{linkedin_user_id}",
                    access_token=access_token,
                    refresh_token=refresh_token,
                    token_expires_at=token_expires_at,
                    organizations=json.dumps(organizations),
                    is_active=True
                )
                db.add(config)
            
            # Delete used OAuth state
            db.delete(oauth_state)
            db.commit()
            
            logger.info(f"Completed LinkedIn OAuth for user {user_id}, connected to {linkedin_name}")
            
            return {
                "success": True,
                "linkedin_user_id": linkedin_user_id,
                "linkedin_username": linkedin_name,
                "linkedin_email": linkedin_email,
                "organizations": organizations
            }
            
        except Exception as e:
            logger.error(f"Failed to complete LinkedIn OAuth: {e}")
            raise RuntimeError(f"Failed to complete LinkedIn OAuth: {str(e)}")
    
    def _get_user_organizations(self, access_token: str) -> List[Dict]:
        """
        Fetch organizations (company pages) the user can post to
        
        Args:
            access_token: LinkedIn access token
            
        Returns:
            List of organization dicts with id and name
        """
        organizations = []
        
        try:
            # Get organization ACLs (pages user is admin of)
            response = requests.get(
                f"{self.ORGANIZATIONS_URL}?q=roleAssignee&role=ADMINISTRATOR&projection=(elements*(organization~(localizedName,vanityName)))",
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "X-Restli-Protocol-Version": "2.0.0"
                }
            )
            
            if response.status_code == 200:
                data = response.json()
                for element in data.get("elements", []):
                    org = element.get("organization~", {})
                    org_urn = element.get("organization")
                    if org_urn:
                        organizations.append({
                            "id": org_urn,
                            "name": org.get("localizedName", "Unknown Organization"),
                            "vanity_name": org.get("vanityName")
                        })
            else:
                logger.warning(f"Could not fetch organizations: {response.status_code}")
                
        except Exception as e:
            logger.error(f"Error fetching organizations: {e}")
        
        return organizations
    
    def refresh_access_token(self, user_id: uuid.UUID, db: Session) -> Optional[str]:
        """
        Refresh the access token if expired or about to expire
        
        Args:
            user_id: User UUID
            db: Database session
            
        Returns:
            New access token or None if refresh failed
        """
        config = db.query(ProfileLinkedInConfig).filter(
            ProfileLinkedInConfig.user_id == user_id
        ).first()
        
        if not config or not config.refresh_token:
            return None
        
        # Check if token needs refresh (within 1 day of expiry)
        now_utc = datetime.now(timezone.utc)
        if config.token_expires_at and config.token_expires_at > now_utc + timedelta(days=1):
            return config.access_token  # Still valid
        
        try:
            token_data = {
                "grant_type": "refresh_token",
                "refresh_token": config.refresh_token,
                "client_id": self.client_id,
                "client_secret": self.client_secret
            }
            
            response = requests.post(
                self.TOKEN_URL,
                data=token_data,
                headers={"Content-Type": "application/x-www-form-urlencoded"}
            )
            
            if response.status_code != 200:
                logger.error(f"Token refresh failed: {response.text}")
                return None
            
            token_result = response.json()
            new_access_token = token_result["access_token"]
            new_refresh_token = token_result.get("refresh_token", config.refresh_token)
            expires_in = token_result.get("expires_in", 5184000)
            
            # Update config
            config.access_token = new_access_token
            config.refresh_token = new_refresh_token
            config.token_expires_at = now_utc + timedelta(seconds=expires_in)
            config.updated_at = now_utc
            
            db.commit()
            
            logger.info(f"Refreshed LinkedIn access token for user {user_id}")
            return new_access_token
            
        except Exception as e:
            logger.error(f"Failed to refresh LinkedIn token: {e}")
            return None
    
    def get_config(self, user_id: uuid.UUID, db: Session) -> Optional[Dict]:
        """
        Get LinkedIn config for user (without secrets)
        
        Args:
            user_id: User UUID
            db: Database session
            
        Returns:
            dict with LinkedIn config or None
        """
        config = db.query(ProfileLinkedInConfig).filter(
            ProfileLinkedInConfig.user_id == user_id
        ).first()
        
        if not config or not config.is_active:
            return None
        
        # Parse organizations JSON
        organizations = []
        if config.organizations:
            try:
                organizations = json.loads(config.organizations)
            except:
                pass
        
        return {
            "connected": True,
            "linkedin_user_id": config.linkedin_user_id,
            "linkedin_username": config.linkedin_username,
            "linkedin_profile_url": config.linkedin_profile_url,
            "organizations": organizations,
            "token_expires_at": config.token_expires_at.isoformat() if config.token_expires_at else None,
            "created_at": config.created_at.isoformat() if config.created_at else None
        }
    
    def disconnect(self, user_id: uuid.UUID, db: Session):
        """
        Disconnect LinkedIn account for user
        
        Args:
            user_id: User UUID
            db: Database session
        """
        config = db.query(ProfileLinkedInConfig).filter(
            ProfileLinkedInConfig.user_id == user_id
        ).first()
        
        if config:
            db.delete(config)
            db.commit()
            logger.info(f"Disconnected LinkedIn for user {user_id}")
    
    def get_valid_access_token(self, user_id: uuid.UUID, db: Session) -> Optional[str]:
        """
        Get a valid access token, refreshing if necessary
        
        Args:
            user_id: User UUID
            db: Database session
            
        Returns:
            Valid access token or None
        """
        config = db.query(ProfileLinkedInConfig).filter(
            ProfileLinkedInConfig.user_id == user_id
        ).first()
        
        if not config or not config.is_active:
            return None
        
        # Check if token is expired or about to expire
        now_utc = datetime.now(timezone.utc)
        if config.token_expires_at:
            token_expires = config.token_expires_at
            if token_expires.tzinfo is None:
                token_expires = token_expires.replace(tzinfo=timezone.utc)
            
            if token_expires < now_utc + timedelta(days=1):
                # Try to refresh
                return self.refresh_access_token(user_id, db)
        
        return config.access_token
    
    def cleanup_old_states(self, db: Session):
        """Clean up OAuth states older than 10 minutes"""
        try:
            cutoff = datetime.now(timezone.utc) - timedelta(minutes=10)
            db.execute(
                text("DELETE FROM linkedin_oauth_states WHERE created_at < :cutoff"),
                {"cutoff": cutoff}
            )
            db.commit()
        except Exception as e:
            logger.error(f"Failed to cleanup old LinkedIn OAuth states: {e}")


# Global service instance
_linkedin_oauth_service = None


def get_linkedin_oauth_service() -> LinkedInOAuthService:
    """Get or create global LinkedIn OAuth service instance"""
    global _linkedin_oauth_service
    if _linkedin_oauth_service is None:
        _linkedin_oauth_service = LinkedInOAuthService()
    return _linkedin_oauth_service
