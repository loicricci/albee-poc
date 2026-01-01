"""
Twitter OAuth API Endpoints
Handles OAuth flow for connecting Twitter accounts
"""

import os
import uuid
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel

from db import SessionLocal
from auth_supabase import get_current_user_id
from twitter_oauth_service import get_twitter_oauth_service

router = APIRouter(prefix="/twitter", tags=["twitter"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# =====================================
# PYDANTIC MODELS
# =====================================

class OAuthInitResponse(BaseModel):
    auth_url: str
    state: str


class TwitterConfigResponse(BaseModel):
    connected: bool
    twitter_username: str = None
    twitter_display_name: str = None
    twitter_user_id: str = None
    created_at: str = None


# =====================================
# API ENDPOINTS
# =====================================

@router.get("/oauth/initiate", response_model=OAuthInitResponse)
def initiate_twitter_oauth(
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id)
):
    """
    Start Twitter OAuth flow
    
    Returns authorization URL for user to visit
    """
    try:
        user_uuid = uuid.UUID(user_id)
        oauth_service = get_twitter_oauth_service()
        
        if not oauth_service.is_configured():
            raise HTTPException(
                status_code=503,
                detail="Twitter OAuth not configured on server"
            )
        
        result = oauth_service.initiate_oauth(user_uuid, db)
        
        # Return only auth_url and state
        # oauth_token and oauth_token_secret are stored in the database
        return {
            "auth_url": result["auth_url"],
            "state": result["state"]
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/oauth/callback")
def twitter_oauth_callback(
    oauth_token: str = Query(...),
    oauth_verifier: str = Query(...),
    state: str = Query(...),
    db: Session = Depends(get_db)
):
    """
    Handle Twitter OAuth callback
    
    Completes OAuth flow and stores tokens
    """
    try:
        oauth_service = get_twitter_oauth_service()
        
        result = oauth_service.complete_oauth(
            oauth_token=oauth_token,
            oauth_verifier=oauth_verifier,
            state=state,
            db=db
        )
        
        # Redirect to frontend profile page with success message
        frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")
        return RedirectResponse(
            url=f"{frontend_url}/profile?twitter=connected&username={result['twitter_username']}"
        )
        
    except ValueError as e:
        # Invalid or expired state
        frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")
        return RedirectResponse(url=f"{frontend_url}/profile?twitter=error&reason=invalid_state")
    except Exception as e:
        frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")
        return RedirectResponse(url=f"{frontend_url}/profile?twitter=error&reason={str(e)}")


@router.get("/config", response_model=TwitterConfigResponse)
def get_twitter_config(
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id)
):
    """
    Get user's Twitter connection status
    
    Returns Twitter config without secrets
    """
    try:
        user_uuid = uuid.UUID(user_id)
        oauth_service = get_twitter_oauth_service()
        
        config = oauth_service.get_config(user_uuid, db)
        
        if not config:
            return {
                "connected": False
            }
        
        return config
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/config")
def disconnect_twitter(
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id)
):
    """
    Disconnect Twitter account
    
    Removes Twitter connection for user
    """
    try:
        user_uuid = uuid.UUID(user_id)
        oauth_service = get_twitter_oauth_service()
        
        oauth_service.disconnect(user_uuid, db)
        
        return {"success": True, "message": "Twitter disconnected"}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/status")
def get_twitter_status(
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id)
):
    """
    Check if Twitter OAuth is configured and if user is connected
    """
    try:
        oauth_service = get_twitter_oauth_service()
        user_uuid = uuid.UUID(user_id)
        
        server_configured = oauth_service.is_configured()
        user_config = oauth_service.get_config(user_uuid, db)
        
        return {
            "server_configured": server_configured,
            "user_connected": user_config is not None,
            "config": user_config
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

