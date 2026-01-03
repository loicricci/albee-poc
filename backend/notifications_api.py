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

from db import SessionLocal
from auth_supabase import get_current_user_id
from models import Notification, Profile, Avee, Post

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


def _format_notification(db: Session, notification: Notification) -> dict:
    """Format a notification with related entity info"""
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
    
    # Format notifications
    results = [_format_notification(db, n) for n in notifications]
    
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
    user_uuid = uuid.UUID(user_id)
    
    count = db.query(Notification).filter(
        Notification.user_id == user_uuid,
        Notification.is_read == "false"
    ).count()
    
    return {"unread_count": count}


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

