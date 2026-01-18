"""
Admin/Backoffice endpoints for managing the system.
These endpoints provide administrative access to profiles, agents, data, etc.
"""

import uuid
import os
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text, func
from pydantic import BaseModel

from backend.db import SessionLocal
from backend.auth_supabase import get_current_user_id, get_current_user
from backend.models import (
    Profile,
    Avee,
    Document,
    DocumentChunk,
    Conversation,
    Message,
    AgentFollower,
    AveePermission,
    AveeLayer,
    Relationship,
    UpgradeRequest,
)

router = APIRouter(prefix="/admin", tags=["admin"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _parse_uuid(value: str, field_name: str) -> uuid.UUID:
    try:
        return uuid.UUID(value)
    except Exception:
        raise HTTPException(status_code=400, detail=f"Invalid {field_name}")


# Admin access is restricted to specific email(s)
ALLOWED_ADMIN_EMAILS = ["loic.ricci@gmail.com"]


async def get_auth_emails_map() -> dict:
    """
    Fetch all Supabase auth users and return a mapping of user_id -> email.
    This is needed because Profile.email is a contact field, not the auth email.
    """
    import httpx
    
    SUPABASE_URL = os.getenv("SUPABASE_URL")
    SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        return {}
    
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.get(
                f"{SUPABASE_URL}/auth/v1/admin/users",
                headers={
                    "apikey": SUPABASE_SERVICE_ROLE_KEY,
                    "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
                },
                params={"per_page": 1000}
            )
            
            if response.status_code != 200:
                return {}
            
            data = response.json()
            users = data.get("users", [])
            
            # Create mapping: user_id -> email
            return {user["id"]: user.get("email", "").lower() for user in users}
    except Exception:
        return {}


def is_admin_email(email: str) -> bool:
    """Check if an email is in the admin list"""
    if not email:
        return False
    return email.lower() in [e.lower() for e in ALLOWED_ADMIN_EMAILS]

async def require_admin(user: dict = Depends(get_current_user)):
    """
    Check if user has admin access.
    Only users with whitelisted emails can access the backoffice.
    """
    user_email = user.get("email", "").lower()
    
    if user_email not in ALLOWED_ADMIN_EMAILS:
        raise HTTPException(
            status_code=403, 
            detail="Access denied. You do not have permission to access the backoffice."
        )
    
    return user["id"]


# =====================
# PYDANTIC MODELS
# =====================

class CreateProfileRequest(BaseModel):
    handle: str
    display_name: str = ""
    email: str


class ResetPasswordRequest(BaseModel):
    user_id: str
    new_password: str


# =====================
# DASHBOARD / STATS
# =====================

@router.get("/stats")
async def get_system_stats(
    db: Session = Depends(get_db),
    admin_id: str = Depends(require_admin),
):
    """Get high-level system statistics"""
    
    total_profiles = db.query(func.count(Profile.user_id)).scalar()
    total_agents = db.query(func.count(Avee.id)).scalar()
    total_documents = db.query(func.count(Document.id)).scalar()
    total_conversations = db.query(func.count(Conversation.id)).scalar()
    total_messages = db.query(func.count(Message.id)).scalar()
    total_followers = db.query(func.count(AgentFollower.id)).scalar()
    
    # Get recent activity (last 7 days)
    from datetime import timedelta
    week_ago = datetime.now() - timedelta(days=7)
    
    recent_profiles = db.query(func.count(Profile.user_id)).filter(
        Profile.created_at >= week_ago
    ).scalar()
    
    recent_agents = db.query(func.count(Avee.id)).filter(
        Avee.created_at >= week_ago
    ).scalar()
    
    recent_conversations = db.query(func.count(Conversation.id)).filter(
        Conversation.created_at >= week_ago
    ).scalar()
    
    return {
        "total": {
            "profiles": total_profiles or 0,
            "agents": total_agents or 0,
            "documents": total_documents or 0,
            "conversations": total_conversations or 0,
            "messages": total_messages or 0,
            "followers": total_followers or 0,
        },
        "recent_7_days": {
            "profiles": recent_profiles or 0,
            "agents": recent_agents or 0,
            "conversations": recent_conversations or 0,
        }
    }


# =====================
# PROFILE MANAGEMENT
# =====================

@router.get("/profiles")
async def list_all_profiles(
    skip: int = 0,
    limit: int = 50,
    search: str = "",
    db: Session = Depends(get_db),
    admin_id: str = Depends(require_admin),
):
    """List all user profiles with pagination and search"""
    
    query = db.query(Profile)
    
    if search:
        search_term = f"%{search.lower()}%"
        query = query.filter(
            (Profile.handle.ilike(search_term)) | 
            (Profile.display_name.ilike(search_term))
        )
    
    total = query.count()
    profiles = query.order_by(Profile.created_at.desc()).offset(skip).limit(limit).all()
    
    # Get agent counts for each profile
    result = []
    for p in profiles:
        agent_count = db.query(func.count(Avee.id)).filter(
            Avee.owner_user_id == p.user_id
        ).scalar()
        
        result.append({
            "user_id": str(p.user_id),
            "handle": p.handle,
            "display_name": p.display_name,
            "bio": p.bio,
            "avatar_url": p.avatar_url,
            "created_at": p.created_at.isoformat() if p.created_at else None,
            "agent_count": agent_count or 0,
        })
    
    return {
        "total": total,
        "skip": skip,
        "limit": limit,
        "profiles": result,
    }


@router.get("/profiles/check-supabase-user")
async def check_supabase_user_by_email(
    email: str,
    db: Session = Depends(get_db),
    admin_id: str = Depends(require_admin),
):
    """
    Check if a user exists in Supabase Auth by email and compare with database profile.
    Useful for debugging signup issues.
    """
    import httpx
    
    SUPABASE_URL = os.getenv("SUPABASE_URL")
    SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        raise HTTPException(status_code=500, detail="Supabase configuration missing")
    
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            # List all users and filter by email
            response = await client.get(
                f"{SUPABASE_URL}/auth/v1/admin/users",
                headers={
                    "apikey": SUPABASE_SERVICE_ROLE_KEY,
                    "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
                },
                params={"per_page": 1000}  # Get a large number of users
            )
            
            if response.status_code != 200:
                raise HTTPException(status_code=response.status_code, detail="Failed to fetch users from Supabase")
            
            data = response.json()
            users = data.get("users", [])
            
            # Find user by email
            supabase_user = None
            for user in users:
                if user.get("email", "").lower() == email.lower():
                    supabase_user = user
                    break
            
            if not supabase_user:
                return {
                    "found_in_supabase": False,
                    "found_in_database": False,
                    "message": "User not found in Supabase Auth. Email is available for signup.",
                }
            
            user_id = uuid.UUID(supabase_user["id"])
            
            # Check if profile exists in database
            profile = db.query(Profile).filter(Profile.user_id == user_id).first()
            
            result = {
                "found_in_supabase": True,
                "found_in_database": profile is not None,
                "supabase_user": {
                    "id": supabase_user["id"],
                    "email": supabase_user.get("email"),
                    "created_at": supabase_user.get("created_at"),
                    "email_confirmed_at": supabase_user.get("email_confirmed_at"),
                    "last_sign_in_at": supabase_user.get("last_sign_in_at"),
                    "identities": len(supabase_user.get("identities", [])),
                },
            }
            
            if profile:
                result["database_profile"] = {
                    "user_id": str(profile.user_id),
                    "handle": profile.handle,
                    "display_name": profile.display_name,
                    "created_at": profile.created_at.isoformat() if profile.created_at else None,
                }
            
            # Add diagnosis
            if result["found_in_supabase"] and not result["found_in_database"]:
                result["diagnosis"] = "User exists in Supabase Auth but not in database. This causes signup issues."
                result["solution"] = f"Delete Supabase user: DELETE /admin/supabase-users/{supabase_user['id']}"
            elif not result["found_in_supabase"] and result["found_in_database"]:
                result["diagnosis"] = "Profile exists in database but not in Supabase Auth. User cannot log in."
                result["solution"] = f"Delete database profile: DELETE /admin/profiles/{user_id}"
            elif result["supabase_user"]["identities"] == 0:
                result["diagnosis"] = "User has 0 identities in Supabase. This is the 'already exists' state."
                result["solution"] = f"Delete entire user: DELETE /admin/profiles/{user_id} (will delete both)"
            else:
                result["diagnosis"] = "User exists in both systems and looks normal."
            
            return result
            
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Supabase request timed out")
    except httpx.HTTPError as e:
        raise HTTPException(status_code=500, detail=f"Failed to check Supabase: {str(e)}")


@router.post("/profiles/create")
async def create_profile(
    req: CreateProfileRequest,
    db: Session = Depends(get_db),
    admin_id: str = Depends(require_admin),
):
    """
    Create a new profile with Supabase auth user (admin-created, no email verification required).
    This endpoint creates both the Supabase auth user and the profile record.
    """
    import httpx
    
    # Validate handle format
    if not req.handle or not req.handle.strip():
        raise HTTPException(status_code=400, detail="Handle is required")
    
    if not req.email or not req.email.strip():
        raise HTTPException(status_code=400, detail="Email is required")
    
    # Check if handle already exists
    existing_profile = db.query(Profile).filter(Profile.handle == req.handle.strip().lower()).first()
    if existing_profile:
        raise HTTPException(status_code=400, detail="Handle already exists")
    
    # Get Supabase service role key for admin operations
    SUPABASE_URL = os.getenv("SUPABASE_URL")
    SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        raise HTTPException(
            status_code=500, 
            detail="Supabase configuration missing. Cannot create user."
        )
    
    # Generate a random password for the user (they can reset it later)
    import secrets
    import string
    random_password = ''.join(secrets.choice(string.ascii_letters + string.digits) for _ in range(16))
    
    # Create user in Supabase Auth using Admin API
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            # Create user with auto-confirmed email
            response = await client.post(
                f"{SUPABASE_URL}/auth/v1/admin/users",
                headers={
                    "apikey": SUPABASE_SERVICE_ROLE_KEY,
                    "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "email": req.email.strip(),
                    "password": random_password,
                    "email_confirm": True,  # Skip email verification
                    "user_metadata": {
                        "handle": req.handle.strip().lower(),
                        "display_name": req.display_name.strip() if req.display_name else req.handle,
                    }
                }
            )
            
            if response.status_code not in (200, 201):
                error_detail = response.json().get("msg", response.text)
                raise HTTPException(
                    status_code=response.status_code,
                    detail=f"Failed to create Supabase user: {error_detail}"
                )
            
            supabase_user = response.json()
            user_id = supabase_user["id"]
            
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Supabase request timed out")
    except httpx.HTTPError as e:
        raise HTTPException(status_code=500, detail=f"Failed to create Supabase user: {str(e)}")
    
    # Create profile in our database
    try:
        profile = Profile(
            user_id=uuid.UUID(user_id),
            handle=req.handle.strip().lower(),
            display_name=req.display_name.strip() if req.display_name else req.handle,
            bio=None,
            avatar_url=None,
        )
        db.add(profile)
        db.commit()
        db.refresh(profile)
        
        return {
            "ok": True,
            "user_id": str(profile.user_id),
            "handle": profile.handle,
            "display_name": profile.display_name,
            "email": req.email,
            "message": "Profile created successfully. User can log in with their email.",
        }
        
    except Exception as e:
        db.rollback()
        # If profile creation fails, we should ideally delete the Supabase user too
        # but for simplicity we'll leave it for now
        raise HTTPException(
            status_code=500,
            detail=f"Profile created in Supabase but failed to save to database: {str(e)}"
        )


@router.get("/profiles/{user_id}")
async def get_profile_details(
    user_id: str,
    db: Session = Depends(get_db),
    admin_id: str = Depends(require_admin),
):
    """Get detailed profile information"""
    user_uuid = _parse_uuid(user_id, "user_id")
    
    profile = db.query(Profile).filter(Profile.user_id == user_uuid).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    
    # Get their agents
    agents = db.query(Avee).filter(Avee.owner_user_id == user_uuid).all()
    
    # Get conversation count
    convo_count = db.query(func.count(Conversation.id)).filter(
        Conversation.user_id == user_uuid
    ).scalar()
    
    return {
        "user_id": str(profile.user_id),
        "handle": profile.handle,
        "display_name": profile.display_name,
        "bio": profile.bio,
        "avatar_url": profile.avatar_url,
        "created_at": profile.created_at.isoformat() if profile.created_at else None,
        "agents": [
            {
                "id": str(a.id),
                "handle": a.handle,
                "display_name": a.display_name,
                "created_at": a.created_at.isoformat() if a.created_at else None,
            }
            for a in agents
        ],
        "conversation_count": convo_count or 0,
    }


@router.delete("/profiles/{user_id}")
async def delete_profile(
    user_id: str,
    db: Session = Depends(get_db),
    admin_id: str = Depends(require_admin),
):
    """Delete a profile and all associated data (CASCADE), including the Supabase auth user"""
    import httpx
    
    user_uuid = _parse_uuid(user_id, "user_id")
    
    profile = db.query(Profile).filter(Profile.user_id == user_uuid).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    
    # Delete the profile from the database first (cascades to all related data)
    db.delete(profile)
    db.commit()
    
    # Delete the user from Supabase Auth using the Admin API
    SUPABASE_URL = os.getenv("SUPABASE_URL")
    SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    
    if SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY:
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                r = await client.delete(
                    f"{SUPABASE_URL}/auth/v1/admin/users/{user_id}",
                    headers={
                        "apikey": SUPABASE_SERVICE_ROLE_KEY,
                        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
                    },
                )
                if r.status_code not in (200, 204):
                    print(f"Warning: Failed to delete Supabase auth user {user_id}: {r.text}")
        except Exception as e:
            print(f"Warning: Failed to delete Supabase auth user {user_id}: {str(e)}")
    
    return {"ok": True, "message": "Profile and auth user deleted successfully"}


@router.post("/profiles/{user_id}/reset-password")
async def admin_reset_user_password(
    user_id: str,
    req: ResetPasswordRequest,
    db: Session = Depends(get_db),
    admin_id: str = Depends(require_admin),
):
    """
    Admin endpoint to reset a user's password without requiring the old password.
    This uses Supabase Admin API to update the password directly.
    """
    import httpx
    
    user_uuid = _parse_uuid(user_id, "user_id")
    
    # Verify profile exists
    profile = db.query(Profile).filter(Profile.user_id == user_uuid).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    
    # Validate password
    if not req.new_password or len(req.new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    
    # Get Supabase service role key for admin operations
    SUPABASE_URL = os.getenv("SUPABASE_URL")
    SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        raise HTTPException(
            status_code=500, 
            detail="Supabase configuration missing. Cannot reset password."
        )
    
    # Update user password using Supabase Admin API
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.put(
                f"{SUPABASE_URL}/auth/v1/admin/users/{user_id}",
                headers={
                    "apikey": SUPABASE_SERVICE_ROLE_KEY,
                    "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "password": req.new_password,
                }
            )
            
            if response.status_code not in (200, 201):
                error_detail = response.json().get("msg", response.text)
                raise HTTPException(
                    status_code=response.status_code,
                    detail=f"Failed to reset password: {error_detail}"
                )
            
            return {
                "ok": True,
                "message": f"Password reset successfully for user {profile.handle}",
                "user_id": user_id,
                "handle": profile.handle,
            }
            
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Supabase request timed out")
    except httpx.HTTPError as e:
        raise HTTPException(status_code=500, detail=f"Failed to reset password: {str(e)}")


# =====================
# AGENT/AVEE MANAGEMENT
# =====================

@router.get("/agents")
async def list_all_agents(
    skip: int = 0,
    limit: int = 50,
    search: str = "",
    db: Session = Depends(get_db),
    admin_id: str = Depends(require_admin),
):
    """List all agents with pagination and search"""
    
    query = db.query(Avee, Profile).join(
        Profile, Profile.user_id == Avee.owner_user_id
    )
    
    if search:
        search_term = f"%{search.lower()}%"
        query = query.filter(
            (Avee.handle.ilike(search_term)) | 
            (Avee.display_name.ilike(search_term))
        )
    
    total = query.count()
    results = query.order_by(Avee.created_at.desc()).offset(skip).limit(limit).all()
    
    # Get follower counts
    agents_data = []
    for avee, profile in results:
        follower_count = db.query(func.count(AgentFollower.id)).filter(
            AgentFollower.avee_id == avee.id
        ).scalar()
        
        doc_count = db.query(func.count(Document.id)).filter(
            Document.avee_id == avee.id
        ).scalar()
        
        agents_data.append({
            "id": str(avee.id),
            "handle": avee.handle,
            "display_name": avee.display_name,
            "bio": avee.bio,
            "avatar_url": avee.avatar_url,
            "created_at": avee.created_at.isoformat() if avee.created_at else None,
            "owner": {
                "user_id": str(profile.user_id),
                "handle": profile.handle,
                "display_name": profile.display_name,
            },
            "follower_count": follower_count or 0,
            "document_count": doc_count or 0,
        })
    
    return {
        "total": total,
        "skip": skip,
        "limit": limit,
        "agents": agents_data,
    }


@router.get("/agents/{avee_id}")
async def get_agent_details(
    avee_id: str,
    db: Session = Depends(get_db),
    admin_id: str = Depends(require_admin),
):
    """Get detailed agent information"""
    avee_uuid = _parse_uuid(avee_id, "avee_id")
    
    avee = db.query(Avee).filter(Avee.id == avee_uuid).first()
    if not avee:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    owner = db.query(Profile).filter(Profile.user_id == avee.owner_user_id).first()
    
    # Get documents
    documents = db.query(Document).filter(Document.avee_id == avee_uuid).all()
    
    # Get followers
    followers = db.query(func.count(AgentFollower.id)).filter(
        AgentFollower.avee_id == avee_uuid
    ).scalar()
    
    # Get conversation count
    convo_count = db.query(func.count(Conversation.id)).filter(
        Conversation.avee_id == avee_uuid
    ).scalar()
    
    return {
        "id": str(avee.id),
        "handle": avee.handle,
        "display_name": avee.display_name,
        "bio": avee.bio,
        "avatar_url": avee.avatar_url,
        "persona": avee.persona,
        "persona_notes": avee.persona_notes,
        "created_at": avee.created_at.isoformat() if avee.created_at else None,
        "owner": {
            "user_id": str(owner.user_id) if owner else None,
            "handle": owner.handle if owner else None,
            "display_name": owner.display_name if owner else None,
        } if owner else None,
        "documents": [
            {
                "id": str(d.id),
                "title": d.title,
                "layer": d.layer,
                "source": d.source,
                "created_at": d.created_at.isoformat() if d.created_at else None,
            }
            for d in documents
        ],
        "follower_count": followers or 0,
        "conversation_count": convo_count or 0,
    }


@router.delete("/agents/{avee_id}")
async def admin_delete_agent(
    avee_id: str,
    db: Session = Depends(get_db),
    admin_id: str = Depends(require_admin),
):
    """Delete an agent and all associated data"""
    avee_uuid = _parse_uuid(avee_id, "avee_id")
    
    avee = db.query(Avee).filter(Avee.id == avee_uuid).first()
    if not avee:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    db.delete(avee)
    db.commit()
    
    return {"ok": True, "message": "Agent deleted successfully"}


# =====================
# DOCUMENT MANAGEMENT
# =====================

@router.get("/documents")
async def list_all_documents(
    skip: int = 0,
    limit: int = 50,
    avee_id: str = None,
    db: Session = Depends(get_db),
    admin_id: str = Depends(require_admin),
):
    """List all documents with optional filtering by agent"""
    
    query = db.query(Document, Avee).join(
        Avee, Avee.id == Document.avee_id, isouter=True
    )
    
    if avee_id:
        avee_uuid = _parse_uuid(avee_id, "avee_id")
        query = query.filter(Document.avee_id == avee_uuid)
    
    total = query.count()
    results = query.order_by(Document.created_at.desc()).offset(skip).limit(limit).all()
    
    documents_data = []
    for doc, avee in results:
        # Get chunk count
        chunk_count = db.query(func.count(DocumentChunk.id)).filter(
            DocumentChunk.document_id == doc.id
        ).scalar()
        
        documents_data.append({
            "id": str(doc.id),
            "title": doc.title,
            "layer": doc.layer,
            "source": doc.source,
            "content_preview": doc.content[:200] + "..." if len(doc.content) > 200 else doc.content,
            "content_length": len(doc.content),
            "chunk_count": chunk_count or 0,
            "created_at": doc.created_at.isoformat() if doc.created_at else None,
            "agent": {
                "id": str(avee.id),
                "handle": avee.handle,
                "display_name": avee.display_name,
            } if avee else None,
        })
    
    return {
        "total": total,
        "skip": skip,
        "limit": limit,
        "documents": documents_data,
    }


@router.get("/documents/{document_id}")
async def get_document_details(
    document_id: str,
    db: Session = Depends(get_db),
    admin_id: str = Depends(require_admin),
):
    """Get full document details"""
    doc_uuid = _parse_uuid(document_id, "document_id")
    
    doc = db.query(Document).filter(Document.id == doc_uuid).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    
    avee = None
    if doc.avee_id:
        avee = db.query(Avee).filter(Avee.id == doc.avee_id).first()
    
    # Get chunks
    chunks = db.query(DocumentChunk).filter(
        DocumentChunk.document_id == doc_uuid
    ).order_by(DocumentChunk.chunk_index).all()
    
    return {
        "id": str(doc.id),
        "title": doc.title,
        "layer": doc.layer,
        "source": doc.source,
        "content": doc.content,
        "created_at": doc.created_at.isoformat() if doc.created_at else None,
        "agent": {
            "id": str(avee.id),
            "handle": avee.handle,
            "display_name": avee.display_name,
        } if avee else None,
        "chunks": [
            {
                "id": str(c.id),
                "chunk_index": c.chunk_index,
                "content": c.content,
            }
            for c in chunks
        ],
    }


@router.delete("/documents/{document_id}")
async def delete_document(
    document_id: str,
    db: Session = Depends(get_db),
    admin_id: str = Depends(require_admin),
):
    """Delete a document and its chunks"""
    doc_uuid = _parse_uuid(document_id, "document_id")
    
    doc = db.query(Document).filter(Document.id == doc_uuid).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    
    db.delete(doc)
    db.commit()
    
    return {"ok": True, "message": "Document deleted successfully"}


# =====================
# CONVERSATION MANAGEMENT
# =====================

@router.get("/conversations")
async def list_all_conversations(
    skip: int = 0,
    limit: int = 50,
    user_id: str = None,
    avee_id: str = None,
    db: Session = Depends(get_db),
    admin_id: str = Depends(require_admin),
):
    """List all conversations with optional filtering"""
    
    query = db.query(Conversation)
    
    if user_id:
        user_uuid = _parse_uuid(user_id, "user_id")
        query = query.filter(Conversation.user_id == user_uuid)
    
    if avee_id:
        avee_uuid = _parse_uuid(avee_id, "avee_id")
        query = query.filter(Conversation.avee_id == avee_uuid)
    
    total = query.count()
    conversations = query.order_by(Conversation.created_at.desc()).offset(skip).limit(limit).all()
    
    result = []
    for c in conversations:
        # Get message count
        msg_count = db.query(func.count(Message.id)).filter(
            Message.conversation_id == c.id
        ).scalar()
        
        # Get agent info
        avee = None
        if c.avee_id:
            avee = db.query(Avee).filter(Avee.id == c.avee_id).first()
        
        result.append({
            "id": str(c.id),
            "title": c.title,
            "layer_used": c.layer_used,
            "message_count": msg_count or 0,
            "created_at": c.created_at.isoformat() if c.created_at else None,
            "agent": {
                "id": str(avee.id),
                "handle": avee.handle,
                "display_name": avee.display_name,
            } if avee else None,
        })
    
    return {
        "total": total,
        "skip": skip,
        "limit": limit,
        "conversations": result,
    }


@router.delete("/conversations/{conversation_id}")
async def delete_conversation(
    conversation_id: str,
    db: Session = Depends(get_db),
    admin_id: str = Depends(require_admin),
):
    """Delete a conversation and all its messages"""
    convo_uuid = _parse_uuid(conversation_id, "conversation_id")
    
    convo = db.query(Conversation).filter(Conversation.id == convo_uuid).first()
    if not convo:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    db.delete(convo)
    db.commit()
    
    return {"ok": True, "message": "Conversation deleted successfully"}


# =====================
# BULK OPERATIONS
# =====================

@router.post("/bulk/delete-old-conversations")
async def bulk_delete_old_conversations(
    days_old: int = 90,
    db: Session = Depends(get_db),
    admin_id: str = Depends(require_admin),
):
    """Delete conversations older than specified days"""
    from datetime import timedelta
    
    cutoff_date = datetime.now() - timedelta(days=days_old)
    
    # Count first
    count = db.query(func.count(Conversation.id)).filter(
        Conversation.created_at < cutoff_date
    ).scalar()
    
    # Delete
    db.query(Conversation).filter(Conversation.created_at < cutoff_date).delete()
    db.commit()
    
    return {
        "ok": True,
        "deleted_count": count or 0,
        "days_old": days_old,
    }


# =====================
# SUBSCRIPTION LEVEL MANAGEMENT
# =====================

# Subscription level configuration (imported from subscription_api for consistency)
SUBSCRIPTION_LEVELS = {
    "free": {"name": "Free", "max_agents": 1, "max_posts_per_month": 5, "order": 0},
    "starter": {"name": "Starter", "max_agents": 1, "max_posts_per_month": 20, "order": 1},
    "creator": {"name": "Creator", "max_agents": 3, "max_posts_per_month": 50, "order": 2},
    "pro": {"name": "Pro", "max_agents": 15, "max_posts_per_month": 300, "order": 3},
    "admin": {"name": "Admin", "max_agents": -1, "max_posts_per_month": -1, "order": 99},  # -1 = unlimited
}


class SetUserLevelRequest(BaseModel):
    level: str


class ProcessUpgradeRequest(BaseModel):
    admin_notes: str | None = None


@router.get("/upgrade-requests")
async def list_upgrade_requests(
    status: str = None,
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    admin_id: str = Depends(require_admin),
):
    """List all upgrade requests with optional status filter"""
    
    query = db.query(UpgradeRequest, Profile).join(
        Profile, Profile.user_id == UpgradeRequest.user_id
    )
    
    if status:
        query = query.filter(UpgradeRequest.status == status)
    
    total = query.count()
    results = query.order_by(UpgradeRequest.created_at.desc()).offset(skip).limit(limit).all()
    
    requests_data = []
    for request, profile in results:
        requests_data.append({
            "id": str(request.id),
            "user_id": str(request.user_id),
            "user_handle": profile.handle,
            "user_display_name": profile.display_name,
            "user_avatar_url": profile.avatar_url,
            "current_level": request.current_level,
            "requested_level": request.requested_level,
            "status": request.status,
            "admin_notes": request.admin_notes,
            "created_at": request.created_at.isoformat() if request.created_at else None,
            "processed_at": request.processed_at.isoformat() if request.processed_at else None,
        })
    
    return {
        "total": total,
        "skip": skip,
        "limit": limit,
        "requests": requests_data,
    }


@router.get("/upgrade-requests/stats")
async def get_upgrade_request_stats(
    db: Session = Depends(get_db),
    admin_id: str = Depends(require_admin),
):
    """Get statistics about upgrade requests"""
    
    pending_count = db.query(func.count(UpgradeRequest.id)).filter(
        UpgradeRequest.status == "pending"
    ).scalar()
    
    approved_count = db.query(func.count(UpgradeRequest.id)).filter(
        UpgradeRequest.status == "approved"
    ).scalar()
    
    rejected_count = db.query(func.count(UpgradeRequest.id)).filter(
        UpgradeRequest.status == "rejected"
    ).scalar()
    
    # Fetch auth emails from Supabase to correctly identify admins
    auth_emails_map = await get_auth_emails_map()
    
    # Get all profiles and count by level using auth emails for admin detection
    all_profiles = db.query(Profile).all()
    
    level_counts = {"admin": 0, "free": 0, "starter": 0, "creator": 0, "pro": 0}
    
    for p in all_profiles:
        auth_email = auth_emails_map.get(str(p.user_id), "")
        if is_admin_email(auth_email):
            level_counts["admin"] += 1
        else:
            user_level = p.subscription_level or "free"
            if user_level in level_counts:
                level_counts[user_level] += 1
    
    return {
        "pending_requests": pending_count or 0,
        "approved_requests": approved_count or 0,
        "rejected_requests": rejected_count or 0,
        "users_by_level": level_counts,
    }


@router.post("/upgrade-requests/{request_id}/approve")
async def approve_upgrade_request(
    request_id: str,
    body: ProcessUpgradeRequest = None,
    db: Session = Depends(get_db),
    admin_id: str = Depends(require_admin),
):
    """Approve an upgrade request and update user's subscription level"""
    
    request_uuid = _parse_uuid(request_id, "request_id")
    admin_uuid = uuid.UUID(admin_id)
    
    # Get the upgrade request
    upgrade_request = db.query(UpgradeRequest).filter(
        UpgradeRequest.id == request_uuid
    ).first()
    
    if not upgrade_request:
        raise HTTPException(status_code=404, detail="Upgrade request not found")
    
    if upgrade_request.status != "pending":
        raise HTTPException(status_code=400, detail="Request has already been processed")
    
    # Get the user's profile
    profile = db.query(Profile).filter(
        Profile.user_id == upgrade_request.user_id
    ).first()
    
    if not profile:
        raise HTTPException(status_code=404, detail="User profile not found")
    
    # Update the profile's subscription level
    profile.subscription_level = upgrade_request.requested_level
    
    # Update the upgrade request
    upgrade_request.status = "approved"
    upgrade_request.processed_at = datetime.utcnow()
    upgrade_request.processed_by = admin_uuid
    if body and body.admin_notes:
        upgrade_request.admin_notes = body.admin_notes
    
    db.commit()
    
    return {
        "ok": True,
        "message": f"Upgrade request approved. User upgraded to {upgrade_request.requested_level}",
        "user_id": str(upgrade_request.user_id),
        "new_level": upgrade_request.requested_level,
    }


@router.post("/upgrade-requests/{request_id}/reject")
async def reject_upgrade_request(
    request_id: str,
    body: ProcessUpgradeRequest = None,
    db: Session = Depends(get_db),
    admin_id: str = Depends(require_admin),
):
    """Reject an upgrade request"""
    
    request_uuid = _parse_uuid(request_id, "request_id")
    admin_uuid = uuid.UUID(admin_id)
    
    # Get the upgrade request
    upgrade_request = db.query(UpgradeRequest).filter(
        UpgradeRequest.id == request_uuid
    ).first()
    
    if not upgrade_request:
        raise HTTPException(status_code=404, detail="Upgrade request not found")
    
    if upgrade_request.status != "pending":
        raise HTTPException(status_code=400, detail="Request has already been processed")
    
    # Update the upgrade request
    upgrade_request.status = "rejected"
    upgrade_request.processed_at = datetime.utcnow()
    upgrade_request.processed_by = admin_uuid
    if body and body.admin_notes:
        upgrade_request.admin_notes = body.admin_notes
    
    db.commit()
    
    return {
        "ok": True,
        "message": "Upgrade request rejected",
        "user_id": str(upgrade_request.user_id),
    }


@router.put("/profiles/{user_id}/level")
async def set_user_level(
    user_id: str,
    body: SetUserLevelRequest,
    db: Session = Depends(get_db),
    admin_id: str = Depends(require_admin),
):
    """Directly set a user's subscription level (admin only)"""
    
    user_uuid = _parse_uuid(user_id, "user_id")
    level = body.level.lower()
    
    # Validate level
    if level not in SUBSCRIPTION_LEVELS:
        raise HTTPException(
            status_code=400, 
            detail=f"Invalid level. Must be one of: {', '.join(SUBSCRIPTION_LEVELS.keys())}"
        )
    
    # Get profile
    profile = db.query(Profile).filter(Profile.user_id == user_uuid).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    
    old_level = profile.subscription_level or "free"
    profile.subscription_level = level
    
    db.commit()
    
    return {
        "ok": True,
        "message": f"User level updated from {old_level} to {level}",
        "user_id": user_id,
        "old_level": old_level,
        "new_level": level,
    }


@router.get("/profiles-with-levels")
async def list_profiles_with_levels(
    skip: int = 0,
    limit: int = 50,
    search: str = "",
    level: str = None,
    db: Session = Depends(get_db),
    admin_id: str = Depends(require_admin),
):
    """List all profiles with their subscription levels"""
    
    # Fetch auth emails from Supabase to correctly identify admins
    auth_emails_map = await get_auth_emails_map()
    
    query = db.query(Profile)
    
    if search:
        search_term = f"%{search.lower()}%"
        query = query.filter(
            (Profile.handle.ilike(search_term)) | 
            (Profile.display_name.ilike(search_term))
        )
    
    # For admin/level filtering, we need to fetch all and filter in Python
    # because admin status is determined by Supabase auth email
    all_profiles = query.order_by(Profile.created_at.desc()).all()
    
    # Filter profiles based on level (using auth email for admin check)
    filtered_profiles = []
    for p in all_profiles:
        auth_email = auth_emails_map.get(str(p.user_id), "")
        is_admin_user = is_admin_email(auth_email)
        
        if level == "admin":
            if is_admin_user:
                filtered_profiles.append((p, auth_email, is_admin_user))
        elif level:
            if not is_admin_user and p.subscription_level == level:
                filtered_profiles.append((p, auth_email, is_admin_user))
        else:
            filtered_profiles.append((p, auth_email, is_admin_user))
    
    total = len(filtered_profiles)
    paginated_profiles = filtered_profiles[skip:skip + limit]
    
    result = []
    for p, auth_email, is_admin_user in paginated_profiles:
        agent_count = db.query(func.count(Avee.id)).filter(
            Avee.owner_user_id == p.user_id
        ).scalar()
        
        if is_admin_user:
            effective_level = "admin"
            level_info = SUBSCRIPTION_LEVELS["admin"]
        else:
            effective_level = p.subscription_level or "free"
            level_info = SUBSCRIPTION_LEVELS.get(effective_level, SUBSCRIPTION_LEVELS["free"])
        
        result.append({
            "user_id": str(p.user_id),
            "handle": p.handle,
            "display_name": p.display_name,
            "avatar_url": p.avatar_url,
            "subscription_level": effective_level,
            "level_name": level_info["name"],
            "agent_count": agent_count or 0,
            "max_agents": level_info["max_agents"],
            "posts_this_month": p.posts_this_month or 0,
            "max_posts_per_month": level_info["max_posts_per_month"],
            "created_at": p.created_at.isoformat() if p.created_at else None,
            "is_admin": is_admin_user,
            "auth_email": auth_email if is_admin_user else None,  # Only show auth email for admins
        })
    
    return {
        "total": total,
        "skip": skip,
        "limit": limit,
        "profiles": result,
    }

