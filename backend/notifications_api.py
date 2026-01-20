"""
Notifications API
Manages user notifications for all activities
"""

import uuid
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc, and_, or_
from pydantic import BaseModel
from datetime import datetime

from backend.db import SessionLocal
from backend.auth_supabase import get_current_user_id
from backend.models import Notification, Profile, Avee, Post

router = APIRouter(prefix="/notifications", tags=["notifications"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# =====================================
# PYDANTIC MODELS
# =====================================

class NotificationResponse(BaseModel):
    id: str
    notification_type: str
    title: str
    message: str
    link: Optional[str]
    is_read: bool
    created_at: str
    
    # Related entity info
    related_user: Optional[dict] = None
    related_agent: Optional[dict] = None
    related_post: Optional[dict] = None
    
    class Config:
        from_attributes = True


class MarkReadRequest(BaseModel):
    notification_ids: List[str]


class NotificationPreferences(BaseModel):
    agent_updates: bool = True
    post_likes: bool = True
    post_comments: bool = True
    post_reposts: bool = True
    autopost_success: bool = True
    new_messages: bool = True


# =====================================
# HELPER FUNCTIONS
# =====================================

def create_notification(
    db: Session,
    user_id: uuid.UUID,
    notification_type: str,
    title: str,
    message: str,
    link: Optional[str] = None,
    related_user_id: Optional[uuid.UUID] = None,
    related_agent_id: Optional[uuid.UUID] = None,
    related_post_id: Optional[uuid.UUID] = None,
    related_update_id: Optional[uuid.UUID] = None,
    related_message_id: Optional[uuid.UUID] = None,
) -> Notification:
    """Helper function to create a notification"""
    notification = Notification(
        id=uuid.uuid4(),
        user_id=user_id,
        notification_type=notification_type,
        title=title,
        message=message,
        link=link,
        related_user_id=related_user_id,
        related_agent_id=related_agent_id,
        related_post_id=related_post_id,
        related_update_id=related_update_id,
        related_message_id=related_message_id,
        is_read="false"
    )
    db.add(notification)
    db.commit()
    db.refresh(notification)
    return notification


def _format_notification_simple(notification: Notification, users_map: dict, agents_map: dict, posts_map: dict) -> dict:
    """Format a notification with pre-loaded related entity info (no DB queries)"""
    result = {
        "id": str(notification.id),
        "notification_type": notification.notification_type,
        "title": notification.title,
        "message": notification.message,
        "link": notification.link,
        "is_read": notification.is_read == "true",
        "created_at": notification.created_at.isoformat() if notification.created_at else None,
        "related_user": None,
        "related_agent": None,
        "related_post": None,
    }
    
    # Get related user info from pre-loaded map
    if notification.related_user_id:
        user = users_map.get(str(notification.related_user_id))
        if user:
            result["related_user"] = {
                "user_id": str(user.user_id),
                "handle": user.handle,
                "display_name": user.display_name or user.handle,
                "avatar_url": user.avatar_url,
            }
    
    # Get related agent info from pre-loaded map
    if notification.related_agent_id:
        agent = agents_map.get(str(notification.related_agent_id))
        if agent:
            result["related_agent"] = {
                "id": str(agent.id),
                "handle": agent.handle,
                "display_name": agent.display_name or agent.handle,
                "avatar_url": agent.avatar_url,
            }
    
    # Get related post info from pre-loaded map
    if notification.related_post_id:
        post = posts_map.get(str(notification.related_post_id))
        if post:
            result["related_post"] = {
                "id": str(post.id),
                "image_url": post.image_url,
                "description": post.description,
            }
    
    return result


def _batch_load_related_entities(db: Session, notifications: list) -> tuple:
    """Batch load all related entities for notifications in 3 queries instead of N*3"""
    # Collect unique IDs
    user_ids = set()
    agent_ids = set()
    post_ids = set()
    
    for n in notifications:
        if n.related_user_id:
            user_ids.add(n.related_user_id)
        if n.related_agent_id:
            agent_ids.add(n.related_agent_id)
        if n.related_post_id:
            post_ids.add(n.related_post_id)
    
    # Batch load profiles
    users_map = {}
    if user_ids:
        users = db.query(Profile).filter(Profile.user_id.in_(user_ids)).all()
        users_map = {str(u.user_id): u for u in users}
    
    # Batch load agents
    agents_map = {}
    if agent_ids:
        agents = db.query(Avee).filter(Avee.id.in_(agent_ids)).all()
        agents_map = {str(a.id): a for a in agents}
    
    # Batch load posts
    posts_map = {}
    if post_ids:
        posts = db.query(Post).filter(Post.id.in_(post_ids)).all()
        posts_map = {str(p.id): p for p in posts}
    
    return users_map, agents_map, posts_map


def _format_notification(db: Session, notification: Notification) -> dict:
    """Format a notification with related entity info (legacy single-notification version)"""
    result = {
        "id": str(notification.id),
        "notification_type": notification.notification_type,
        "title": notification.title,
        "message": notification.message,
        "link": notification.link,
        "is_read": notification.is_read == "true",
        "created_at": notification.created_at.isoformat() if notification.created_at else None,
        "related_user": None,
        "related_agent": None,
        "related_post": None,
    }
    
    # Get related user info
    if notification.related_user_id:
        user = db.query(Profile).filter(Profile.user_id == notification.related_user_id).first()
        if user:
            result["related_user"] = {
                "user_id": str(user.user_id),
                "handle": user.handle,
                "display_name": user.display_name or user.handle,
                "avatar_url": user.avatar_url,
            }
    
    # Get related agent info
    if notification.related_agent_id:
        agent = db.query(Avee).filter(Avee.id == notification.related_agent_id).first()
        if agent:
            result["related_agent"] = {
                "id": str(agent.id),
                "handle": agent.handle,
                "display_name": agent.display_name or agent.handle,
                "avatar_url": agent.avatar_url,
            }
    
    # Get related post info
    if notification.related_post_id:
        post = db.query(Post).filter(Post.id == notification.related_post_id).first()
        if post:
            result["related_post"] = {
                "id": str(post.id),
                "image_url": post.image_url,
                "description": post.description,
            }
    
    return result


# =====================================
# ENDPOINTS
# =====================================

@router.get("/")
def get_notifications(
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    unread_only: bool = Query(False),
    notification_type: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    """Get notifications for the current user"""
    user_uuid = uuid.UUID(user_id)
    
    # Build query
    query = db.query(Notification).filter(Notification.user_id == user_uuid)
    
    # Filter by read status
    if unread_only:
        query = query.filter(Notification.is_read == "false")
    
    # Filter by type
    if notification_type:
        query = query.filter(Notification.notification_type == notification_type)
    
    # Get total count
    total = query.count()
    
    unread_count = db.query(Notification).filter(
        Notification.user_id == user_uuid,
        Notification.is_read == "false"
    ).count()
    
    # Get paginated results
    notifications = query.order_by(desc(Notification.created_at)).limit(limit).offset(offset).all()
    
    # Batch load related entities (3 queries instead of N*3)
    users_map, agents_map, posts_map = _batch_load_related_entities(db, notifications)
    
    # Format notifications using pre-loaded data (no DB queries)
    results = [_format_notification_simple(n, users_map, agents_map, posts_map) for n in notifications]
    
    return {
        "notifications": results,
        "total": total,
        "unread_count": unread_count,
        "limit": limit,
        "offset": offset,
    }


@router.get("/unread-count")
def get_unread_count(
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    """Get the count of unread notifications"""
    from sqlalchemy import text
    
    # Set statement timeout to prevent hanging queries (5 seconds)
    try:
        db.execute(text("SET LOCAL statement_timeout = '5s'"))
    except Exception as e:
        print(f"[Notifications] Warning: Could not set statement timeout: {e}")
    
    try:
        user_uuid = uuid.UUID(user_id)
        
        count = db.query(Notification).filter(
            Notification.user_id == user_uuid,
            Notification.is_read == "false"
        ).count()
        
        return {"unread_count": count}
    except Exception as e:
        print(f"[Notifications] Error getting unread count: {e}")
        # Return 0 on error to prevent frontend from breaking
        return {"unread_count": 0, "error": "temporary"}


@router.post("/mark-read")
def mark_notifications_read(
    payload: MarkReadRequest,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    """Mark notifications as read"""
    user_uuid = uuid.UUID(user_id)
    
    # Parse notification IDs
    notification_uuids = []
    for nid in payload.notification_ids:
        try:
            notification_uuids.append(uuid.UUID(nid))
        except ValueError:
            continue
    
    if not notification_uuids:
        return {"message": "No valid notification IDs provided"}
    
    # Update notifications
    updated = db.query(Notification).filter(
        Notification.id.in_(notification_uuids),
        Notification.user_id == user_uuid
    ).update({"is_read": "true"}, synchronize_session=False)
    
    db.commit()
    
    return {"message": f"Marked {updated} notifications as read"}


@router.post("/mark-all-read")
def mark_all_notifications_read(
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    """Mark all notifications as read"""
    user_uuid = uuid.UUID(user_id)
    
    updated = db.query(Notification).filter(
        Notification.user_id == user_uuid,
        Notification.is_read == "false"
    ).update({"is_read": "true"}, synchronize_session=False)
    
    db.commit()
    
    return {"message": f"Marked {updated} notifications as read"}


@router.delete("/{notification_id}")
def delete_notification(
    notification_id: str,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    """Delete a notification"""
    user_uuid = uuid.UUID(user_id)
    notification_uuid = uuid.UUID(notification_id)
    
    notification = db.query(Notification).filter(
        Notification.id == notification_uuid,
        Notification.user_id == user_uuid
    ).first()
    
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    db.delete(notification)
    db.commit()
    
    return {"message": "Notification deleted"}



