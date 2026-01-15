"""
LinkedIn OAuth API Endpoints
Handles OAuth flow for connecting LinkedIn accounts
"""

import os
import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel

from backend.db import SessionLocal
from backend.auth_supabase import get_current_user_id
from backend.linkedin_oauth_service import get_linkedin_oauth_service

router = APIRouter(prefix="/linkedin", tags=["linkedin"])


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


class OrganizationInfo(BaseModel):
    id: str
    name: str
    vanity_name: Optional[str] = None


class LinkedInConfigResponse(BaseModel):
    connected: bool
    linkedin_username: Optional[str] = None
    linkedin_user_id: Optional[str] = None
    linkedin_profile_url: Optional[str] = None
    organizations: Optional[List[OrganizationInfo]] = None
    token_expires_at: Optional[str] = None
    created_at: Optional[str] = None


class OAuthInitRequest(BaseModel):
    include_org_scope: bool = False  # Request organization posting permissions


# =====================================
# API ENDPOINTS
# =====================================

@router.get("/oauth/initiate", response_model=OAuthInitResponse)
def initiate_linkedin_oauth(
    include_org_scope: bool = Query(False, description="Request organization posting scope"),
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id)
):
    """
    Start LinkedIn OAuth flow
    
    Returns authorization URL for user to visit.
    Set include_org_scope=true to request permission to post to company pages.
    """
    try:
        user_uuid = uuid.UUID(user_id)
        oauth_service = get_linkedin_oauth_service()
        
        if not oauth_service.is_configured():
            raise HTTPException(
                status_code=503,
                detail="LinkedIn OAuth not configured on server"
            )
        
        result = oauth_service.initiate_oauth(user_uuid, db, include_org_scope=include_org_scope)
        
        return {
            "auth_url": result["auth_url"],
            "state": result["state"]
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/oauth/callback")
def linkedin_oauth_callback(
    code: str = Query(...),
    state: str = Query(...),
    error: Optional[str] = Query(None),
    error_description: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """
    Handle LinkedIn OAuth callback
    
    Completes OAuth flow and stores tokens
    """
    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")
    
    # Handle OAuth errors from LinkedIn
    if error:
        error_msg = error_description or error
        return RedirectResponse(url=f"{frontend_url}/profile?linkedin=error&reason={error_msg}")
    
    try:
        oauth_service = get_linkedin_oauth_service()
        
        result = oauth_service.complete_oauth(
            code=code,
            state=state,
            db=db
        )
        
        # Redirect to frontend profile page with success message
        username = result.get('linkedin_username', '')
        return RedirectResponse(
            url=f"{frontend_url}/profile?linkedin=connected&username={username}"
        )
        
    except ValueError as e:
        # Invalid or expired state
        return RedirectResponse(url=f"{frontend_url}/profile?linkedin=error&reason=invalid_state")
    except Exception as e:
        return RedirectResponse(url=f"{frontend_url}/profile?linkedin=error&reason={str(e)}")


@router.get("/config", response_model=LinkedInConfigResponse)
def get_linkedin_config(
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id)
):
    """
    Get user's LinkedIn connection status
    
    Returns LinkedIn config without secrets
    """
    try:
        user_uuid = uuid.UUID(user_id)
        oauth_service = get_linkedin_oauth_service()
        
        config = oauth_service.get_config(user_uuid, db)
        
        if not config:
            return {
                "connected": False
            }
        
        return config
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/config")
def disconnect_linkedin(
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id)
):
    """
    Disconnect LinkedIn account
    
    Removes LinkedIn connection for user
    """
    try:
        user_uuid = uuid.UUID(user_id)
        oauth_service = get_linkedin_oauth_service()
        
        oauth_service.disconnect(user_uuid, db)
        
        return {"success": True, "message": "LinkedIn disconnected"}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/status")
def get_linkedin_status(
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id)
):
    """
    Check if LinkedIn OAuth is configured and if user is connected
    """
    try:
        oauth_service = get_linkedin_oauth_service()
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


@router.get("/organizations")
def get_linkedin_organizations(
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id)
):
    """
    Get list of LinkedIn organizations (company pages) the user can post to
    
    Returns list of organizations with their IDs and names
    """
    try:
        user_uuid = uuid.UUID(user_id)
        oauth_service = get_linkedin_oauth_service()
        
        config = oauth_service.get_config(user_uuid, db)
        
        if not config:
            raise HTTPException(
                status_code=404,
                detail="LinkedIn not connected"
            )
        
        return {
            "organizations": config.get("organizations", [])
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/refresh")
def refresh_linkedin_token(
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id)
):
    """
    Manually refresh LinkedIn access token
    
    LinkedIn tokens expire after 60 days. This endpoint allows
    manually triggering a token refresh.
    """
    try:
        user_uuid = uuid.UUID(user_id)
        oauth_service = get_linkedin_oauth_service()
        
        new_token = oauth_service.refresh_access_token(user_uuid, db)
        
        if new_token:
            return {
                "success": True,
                "message": "Token refreshed successfully"
            }
        else:
            raise HTTPException(
                status_code=400,
                detail="Could not refresh token. Please reconnect your LinkedIn account."
            )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
