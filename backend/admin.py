"""
Admin/Backoffice endpoints for managing the system.
These endpoints provide administrative access to profiles, agents, data, etc.
"""

import uuid
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text, func

from db import SessionLocal
from auth_supabase import get_current_user_id, get_current_user
from models import (
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
    """Delete a profile and all associated data (CASCADE)"""
    user_uuid = _parse_uuid(user_id, "user_id")
    
    profile = db.query(Profile).filter(Profile.user_id == user_uuid).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    
    db.delete(profile)
    db.commit()
    
    return {"ok": True, "message": "Profile deleted successfully"}


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

