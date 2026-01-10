"""
Agent Updates API
Allows agent owners to post timestamped updates that become part of agent knowledge.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from pydantic import BaseModel
from typing import Optional, List
import uuid
from datetime import datetime

from backend.db import SessionLocal
from backend.auth_supabase import get_current_user_id
from backend.models import AgentUpdate, Avee, Document, DocumentChunk, AgentFollower, Notification
from backend.rag_utils import chunk_text
from backend.openai_embed import embed_texts
from backend.notifications_api import create_notification

router = APIRouter()


# -----------------------------
# Request/Response Models
# -----------------------------

class AgentUpdateCreate(BaseModel):
    title: str
    content: str
    topic: Optional[str] = None
    layer: str = "public"
    is_pinned: bool = False


class AgentUpdateUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    topic: Optional[str] = None
    layer: Optional[str] = None
    is_pinned: Optional[bool] = None


class AgentUpdateResponse(BaseModel):
    id: str
    title: str
    content: str
    topic: Optional[str]
    layer: str
    is_pinned: bool
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


class AgentUpdateListResponse(BaseModel):
    total: int
    items: List[AgentUpdateResponse]


class PinUpdateRequest(BaseModel):
    is_pinned: bool


# -----------------------------
# Helpers
# -----------------------------

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def verify_agent_ownership(db: Session, agent_id: str, user_id: uuid.UUID) -> Avee:
    """Verify that the user owns the agent."""
    agent = db.query(Avee).filter(Avee.id == agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    if str(agent.owner_user_id) != str(user_id):
        raise HTTPException(status_code=403, detail="Not authorized to manage this agent")
    return agent


async def create_document_from_update(
    db: Session,
    update: AgentUpdate,
    agent: Avee
) -> Document:
    """
    Create a Document and chunks from an update for RAG integration.
    """
    # Create document
    doc = Document(
        id=uuid.uuid4(),
        owner_user_id=agent.owner_user_id,
        avee_id=agent.id,
        layer=update.layer,
        title=f"Update: {update.title}",
        content=f"# {update.title}\n\n{update.content}\n\n---\nTopic: {update.topic or 'General'}\nDate: {update.created_at.strftime('%Y-%m-%d')}",
        source=f"agent_update:{update.id}",
    )
    db.add(doc)
    db.flush()

    # Chunk the content
    chunks = chunk_text(doc.content, max_chars=1000, overlap=100)
    
    # Embed chunks
    embeddings = embed_texts(chunks)

    # Create chunk records
    for idx, (chunk_content, embedding) in enumerate(zip(chunks, embeddings)):
        chunk_obj = DocumentChunk(
            id=uuid.uuid4(),
            document_id=doc.id,
            avee_id=agent.id,
            layer=update.layer,
            chunk_index=idx,
            content=chunk_content,
        )
        db.add(chunk_obj)
        db.flush()

        # Insert embedding via raw SQL (pgvector)
        db.execute(
            text("""
                UPDATE document_chunks
                SET embedding = (:embedding)::vector
                WHERE id = :chunk_id
            """),
            {"embedding": str(embedding), "chunk_id": str(chunk_obj.id)}
        )

    db.commit()
    return doc


async def delete_document_from_update(db: Session, update_id: str):
    """Delete the document associated with an update."""
    # Find and delete document with source matching update
    doc = db.query(Document).filter(
        Document.source == f"agent_update:{update_id}"
    ).first()
    
    if doc:
        # Chunks will cascade delete
        db.delete(doc)
        db.commit()


# -----------------------------
# Endpoints
# -----------------------------

@router.post("/agents/{agent_id}/updates", response_model=AgentUpdateResponse)
async def create_update(
    agent_id: str,
    data: AgentUpdateCreate,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Create a new agent update."""
    # Verify ownership
    agent = verify_agent_ownership(db, agent_id, user_id)

    # Validate
    if not data.title.strip():
        raise HTTPException(status_code=400, detail="Title is required")
    if not data.content.strip():
        raise HTTPException(status_code=400, detail="Content is required")
    if len(data.content) > 10000:
        raise HTTPException(status_code=400, detail="Content too long (max 10,000 characters)")
    if len(data.title) > 200:
        raise HTTPException(status_code=400, detail="Title too long (max 200 characters)")
    if data.layer not in ["public", "friends", "intimate"]:
        raise HTTPException(status_code=400, detail="Invalid layer")

    # Create update
    update = AgentUpdate(
        id=uuid.uuid4(),
        avee_id=agent.id,
        owner_user_id=user_id,
        title=data.title.strip(),
        content=data.content.strip(),
        topic=data.topic,
        layer=data.layer,
        is_pinned="true" if data.is_pinned else "false",
    )
    db.add(update)
    db.commit()
    db.refresh(update)

    # Create document for RAG
    try:
        await create_document_from_update(db, update, agent)
    except Exception as e:
        # Log error but don't fail the update creation
        print(f"Error creating document from update: {e}")
    
    # Create notifications for all followers of this agent
    try:
        followers = db.query(AgentFollower).filter(AgentFollower.avee_id == agent.id).all()
        for follower in followers:
            # Don't notify the owner
            if follower.follower_user_id != user_id:
                create_notification(
                    db=db,
                    user_id=follower.follower_user_id,
                    notification_type="agent_update",
                    title=f"New update from {agent.display_name or agent.handle}",
                    message=update.title,
                    link=f"/profile/{agent.handle}",
                    related_agent_id=agent.id,
                    related_update_id=update.id
                )
    except Exception as e:
        print(f"Error creating update notifications: {e}")
        # Rollback the failed notification transaction
        db.rollback()

    return AgentUpdateResponse(
        id=str(update.id),
        title=update.title,
        content=update.content,
        topic=update.topic,
        layer=update.layer,
        is_pinned=update.is_pinned == "true",
        created_at=update.created_at,
        updated_at=update.updated_at,
    )


@router.get("/agents/{agent_id}/updates", response_model=AgentUpdateListResponse)
async def list_updates(
    agent_id: str,
    layer: Optional[str] = None,
    topic: Optional[str] = None,
    limit: int = 20,
    offset: int = 0,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """List all updates for an agent."""
    # Verify ownership
    verify_agent_ownership(db, agent_id, user_id)

    # Build query
    query = db.query(AgentUpdate).filter(AgentUpdate.avee_id == agent_id)
    
    if layer:
        query = query.filter(AgentUpdate.layer == layer)
    if topic:
        query = query.filter(AgentUpdate.topic == topic)

    # Get total count
    total = query.count()

    # Get paginated results (pinned first, then by date)
    updates = query.order_by(
        AgentUpdate.is_pinned.desc(),
        AgentUpdate.created_at.desc()
    ).limit(limit).offset(offset).all()

    return AgentUpdateListResponse(
        total=total,
        items=[
            AgentUpdateResponse(
                id=str(u.id),
                title=u.title,
                content=u.content,
                topic=u.topic,
                layer=u.layer,
                is_pinned=u.is_pinned == "true",
                created_at=u.created_at,
                updated_at=u.updated_at,
            )
            for u in updates
        ]
    )


@router.get("/agents/{agent_id}/updates/{update_id}", response_model=AgentUpdateResponse)
async def get_update(
    agent_id: str,
    update_id: str,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Get a specific update."""
    # Verify ownership
    verify_agent_ownership(db, agent_id, user_id)

    update = db.query(AgentUpdate).filter(
        AgentUpdate.id == update_id,
        AgentUpdate.avee_id == agent_id
    ).first()

    if not update:
        raise HTTPException(status_code=404, detail="Update not found")

    return AgentUpdateResponse(
        id=str(update.id),
        title=update.title,
        content=update.content,
        topic=update.topic,
        layer=update.layer,
        is_pinned=update.is_pinned == "true",
        created_at=update.created_at,
        updated_at=update.updated_at,
    )


@router.put("/agents/{agent_id}/updates/{update_id}", response_model=AgentUpdateResponse)
async def update_update(
    agent_id: str,
    update_id: str,
    data: AgentUpdateUpdate,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Update an existing agent update."""
    # Verify ownership
    agent = verify_agent_ownership(db, agent_id, user_id)

    update = db.query(AgentUpdate).filter(
        AgentUpdate.id == update_id,
        AgentUpdate.avee_id == agent_id
    ).first()

    if not update:
        raise HTTPException(status_code=404, detail="Update not found")

    # Update fields
    if data.title is not None:
        if not data.title.strip():
            raise HTTPException(status_code=400, detail="Title cannot be empty")
        if len(data.title) > 200:
            raise HTTPException(status_code=400, detail="Title too long")
        update.title = data.title.strip()

    if data.content is not None:
        if not data.content.strip():
            raise HTTPException(status_code=400, detail="Content cannot be empty")
        if len(data.content) > 10000:
            raise HTTPException(status_code=400, detail="Content too long")
        update.content = data.content.strip()

    if data.topic is not None:
        update.topic = data.topic

    if data.layer is not None:
        if data.layer not in ["public", "friends", "intimate"]:
            raise HTTPException(status_code=400, detail="Invalid layer")
        update.layer = data.layer

    if data.is_pinned is not None:
        update.is_pinned = "true" if data.is_pinned else "false"

    update.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(update)

    # Update the associated document
    try:
        await delete_document_from_update(db, update_id)
        await create_document_from_update(db, update, agent)
    except Exception as e:
        print(f"Error updating document from update: {e}")

    return AgentUpdateResponse(
        id=str(update.id),
        title=update.title,
        content=update.content,
        topic=update.topic,
        layer=update.layer,
        is_pinned=update.is_pinned == "true",
        created_at=update.created_at,
        updated_at=update.updated_at,
    )


@router.delete("/agents/{agent_id}/updates/{update_id}")
async def delete_update(
    agent_id: str,
    update_id: str,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Delete an agent update."""
    # Verify ownership
    verify_agent_ownership(db, agent_id, user_id)

    update = db.query(AgentUpdate).filter(
        AgentUpdate.id == update_id,
        AgentUpdate.avee_id == agent_id
    ).first()

    if not update:
        raise HTTPException(status_code=404, detail="Update not found")

    # Delete associated document
    try:
        await delete_document_from_update(db, update_id)
    except Exception as e:
        print(f"Error deleting document from update: {e}")

    # Delete update
    db.delete(update)
    db.commit()

    return {"ok": True, "message": "Update deleted"}


@router.post("/agents/{agent_id}/updates/{update_id}/pin")
async def toggle_pin_update(
    agent_id: str,
    update_id: str,
    data: PinUpdateRequest,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Pin or unpin an update."""
    # Verify ownership
    verify_agent_ownership(db, agent_id, user_id)

    update = db.query(AgentUpdate).filter(
        AgentUpdate.id == update_id,
        AgentUpdate.avee_id == agent_id
    ).first()

    if not update:
        raise HTTPException(status_code=404, detail="Update not found")

    update.is_pinned = "true" if data.is_pinned else "false"
    update.updated_at = datetime.utcnow()
    db.commit()

    return {"ok": True, "is_pinned": data.is_pinned}

