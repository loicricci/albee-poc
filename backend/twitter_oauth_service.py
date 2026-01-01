"""
Twitter OAuth Service
Handles OAuth 1.0a flow for connecting user Twitter accounts
"""

import os
import uuid
import secrets
import tweepy
from typing import Optional, Dict
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import text
import logging

from models import ProfileTwitterConfig, TwitterOAuthState
from db import SessionLocal

logger = logging.getLogger(__name__)


class TwitterOAuthService:
    """Service for handling Twitter OAuth 1.0a authentication"""
    
    def __init__(self):
        """Initialize Twitter OAuth service"""
        self.consumer_key = os.getenv("TWITTER_CONSUMER_KEY")
        self.consumer_secret = os.getenv("TWITTER_CONSUMER_SECRET")
        self.callback_url = os.getenv("TWITTER_OAUTH_CALLBACK_URL", "http://localhost:3000/twitter-callback")
        
        if not self.consumer_key or not self.consumer_secret:
            logger.warning("Twitter OAuth credentials not configured")
    
    def is_configured(self) -> bool:
        """Check if Twitter OAuth is configured"""
        return bool(self.consumer_key and self.consumer_secret)
    
    def initiate_oauth(self, user_id: uuid.UUID, db: Session) -> Dict:
        """
        Start OAuth flow and return authorization URL
        
        Args:
            user_id: UUID of the user initiating OAuth
            db: Database session
            
        Returns:
            dict with 'auth_url' and 'state' token
        """
        if not self.is_configured():
            raise RuntimeError("Twitter OAuth not configured")
        
        try:
            # Create OAuth1UserHandler
            auth = tweepy.OAuth1UserHandler(
                self.consumer_key,
                self.consumer_secret,
                callback=self.callback_url
            )
            
            # Get request token and authorization URL
            auth_url = auth.get_authorization_url()
            request_token = auth.request_token
            
            # Generate CSRF state token
            state = secrets.token_urlsafe(32)
            
            # Store state and request tokens in database
            oauth_state = TwitterOAuthState(
                state=state,
                oauth_token=request_token["oauth_token"],
                oauth_token_secret=request_token["oauth_token_secret"],
                user_id=user_id
            )
            db.add(oauth_state)
            db.commit()
            
            logger.info(f"Initiated OAuth for user {user_id}")
            
            return {
                "auth_url": auth_url,
                "state": state
            }
            
        except Exception as e:
            logger.error(f"Failed to initiate OAuth: {e}")
            raise RuntimeError(f"Failed to start Twitter OAuth: {str(e)}")
    
    def complete_oauth(
        self,
        oauth_token: str,
        oauth_verifier: str,
        state: str,
        db: Session
    ) -> Dict:
        """
        Complete OAuth flow and store access tokens
        
        Args:
            oauth_token: OAuth token from callback
            oauth_verifier: OAuth verifier from callback
            state: CSRF state token
            db: Database session
            
        Returns:
            dict with Twitter user info
        """
        if not self.is_configured():
            raise RuntimeError("Twitter OAuth not configured")
        
        try:
            # Verify state token (CSRF protection) and retrieve request token secret
            oauth_state = db.query(TwitterOAuthState).filter(
                TwitterOAuthState.state == state
            ).first()
            
            if not oauth_state:
                raise ValueError("Invalid or expired OAuth state")
            
            # Check if state is not too old (10 minutes)
            from datetime import timezone
            now_utc = datetime.now(timezone.utc)
            if oauth_state.created_at < now_utc - timedelta(minutes=10):
                db.delete(oauth_state)
                db.commit()
                raise ValueError("OAuth state expired")
            
            # Verify oauth_token matches
            if oauth_state.oauth_token != oauth_token:
                raise ValueError("OAuth token mismatch")
            
            user_id = oauth_state.user_id
            request_token_secret = oauth_state.oauth_token_secret
            
            # Exchange request token for access token
            auth = tweepy.OAuth1UserHandler(
                self.consumer_key,
                self.consumer_secret
            )
            auth.request_token = {
                "oauth_token": oauth_token,
                "oauth_token_secret": request_token_secret
            }
            
            access_token, access_token_secret = auth.get_access_token(oauth_verifier)
            
            # Get Twitter user info
            client = tweepy.Client(
                consumer_key=self.consumer_key,
                consumer_secret=self.consumer_secret,
                access_token=access_token,
                access_token_secret=access_token_secret
            )
            
            me = client.get_me(user_fields=["id", "username", "name"])
            
            if not me.data:
                raise RuntimeError("Failed to get Twitter user info")
            
            twitter_user = me.data
            
            # Check if config already exists
            existing_config = db.query(ProfileTwitterConfig).filter(
                ProfileTwitterConfig.user_id == user_id
            ).first()
            
            if existing_config:
                # Update existing
                existing_config.twitter_user_id = str(twitter_user.id)
                existing_config.twitter_username = twitter_user.username
                existing_config.twitter_display_name = twitter_user.name
                existing_config.access_token = access_token
                existing_config.access_secret = access_token_secret
                existing_config.is_active = True
                existing_config.updated_at = datetime.now(timezone.utc)
            else:
                # Create new config
                config = ProfileTwitterConfig(
                    user_id=user_id,
                    twitter_user_id=str(twitter_user.id),
                    twitter_username=twitter_user.username,
                    twitter_display_name=twitter_user.name,
                    access_token=access_token,
                    access_secret=access_token_secret,
                    is_active=True
                )
                db.add(config)
            
            # Delete used OAuth state
            db.delete(oauth_state)
            db.commit()
            
            logger.info(f"Completed OAuth for user {user_id}, connected to @{twitter_user.username}")
            
            return {
                "success": True,
                "twitter_user_id": str(twitter_user.id),
                "twitter_username": twitter_user.username,
                "twitter_display_name": twitter_user.name
            }
            
        except Exception as e:
            logger.error(f"Failed to complete OAuth: {e}")
            raise RuntimeError(f"Failed to complete Twitter OAuth: {str(e)}")
    
    def get_config(self, user_id: uuid.UUID, db: Session) -> Optional[Dict]:
        """
        Get Twitter config for user (without secrets)
        
        Args:
            user_id: User UUID
            db: Database session
            
        Returns:
            dict with Twitter config or None
        """
        config = db.query(ProfileTwitterConfig).filter(
            ProfileTwitterConfig.user_id == user_id
        ).first()
        
        if not config or not config.is_active:
            return None
        
        return {
            "connected": True,
            "twitter_user_id": config.twitter_user_id,
            "twitter_username": config.twitter_username,
            "twitter_display_name": config.twitter_display_name,
            "created_at": config.created_at.isoformat() if config.created_at else None
        }
    
    def disconnect(self, user_id: uuid.UUID, db: Session):
        """
        Disconnect Twitter account for user
        
        Args:
            user_id: User UUID
            db: Database session
        """
        config = db.query(ProfileTwitterConfig).filter(
            ProfileTwitterConfig.user_id == user_id
        ).first()
        
        if config:
            db.delete(config)
            db.commit()
            logger.info(f"Disconnected Twitter for user {user_id}")
    
    def get_twitter_client(self, user_id: uuid.UUID, db: Session) -> Optional[tweepy.Client]:
        """
        Get authenticated Twitter API client for user
        
        Args:
            user_id: User UUID
            db: Database session
            
        Returns:
            tweepy.Client or None if not configured
        """
        config = db.query(ProfileTwitterConfig).filter(
            ProfileTwitterConfig.user_id == user_id
        ).first()
        
        if not config or not config.is_active:
            return None
        
        try:
            client = tweepy.Client(
                consumer_key=self.consumer_key,
                consumer_secret=self.consumer_secret,
                access_token=config.access_token,
                access_token_secret=config.access_secret
            )
            return client
        except Exception as e:
            logger.error(f"Failed to create Twitter client for user {user_id}: {e}")
            return None
    
    def cleanup_old_states(self, db: Session):
        """Clean up OAuth states older than 10 minutes"""
        try:
            cutoff = datetime.utcnow() - timedelta(minutes=10)
            db.execute(
                text("DELETE FROM twitter_oauth_states WHERE created_at < :cutoff"),
                {"cutoff": cutoff}
            )
            db.commit()
        except Exception as e:
            logger.error(f"Failed to cleanup old OAuth states: {e}")


# Global service instance
_twitter_oauth_service = None


def get_twitter_oauth_service() -> TwitterOAuthService:
    """Get or create global Twitter OAuth service instance"""
    global _twitter_oauth_service
    if _twitter_oauth_service is None:
        _twitter_oauth_service = TwitterOAuthService()
    return _twitter_oauth_service

