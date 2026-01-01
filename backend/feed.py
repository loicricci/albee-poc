"""
Feed API
Provides personalized feed of updates from followed agents and user's own agents.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text, func, and_, or_
from pydantic import BaseModel
from typing import List, Optional
import uuid
from datetime import datetime
import asyncio

from db import SessionLocal
from auth_supabase import get_current_user_id
from models import Avee, AgentUpdate, AgentFollower, UpdateReadStatus, Profile, Post, PostLike

router = APIRouter()


# -----------------------------
# Response Models
# -----------------------------

class FeedItemUpdate(BaseModel):
    """Single update in a feed item"""
    id: str
    title: str
    content: str
    topic: Optional[str]
    layer: str
    is_pinned: bool
    created_at: datetime
    is_read: bool


class FeedItem(BaseModel):
    """Single item in the feed representing an agent with their updates"""
    agent_id: str
    agent_handle: str
    agent_display_name: Optional[str]
    agent_avatar_url: Optional[str]
    agent_bio: Optional[str]
    is_own_agent: bool  # True if this is user's own agent
    unread_count: int  # Number of unread updates
    total_updates: int  # Total number of updates
    latest_update: Optional[FeedItemUpdate]  # Most recent update
    owner_user_id: str
    owner_handle: Optional[str]
    owner_display_name: Optional[str]


class FeedResponse(BaseModel):
    """Feed response with all followed agents and user's own agents"""
    items: List[FeedItem]
    total_items: int
    total_unread: int  # Total unread across all agents


# -----------------------------
# Unified Feed Models (Posts + Updates)
# -----------------------------

class FeedPostItem(BaseModel):
    """Post item in unified feed"""
    id: str
    type: str = "post"  # Distinguish from updates
    agent_id: Optional[str]
    agent_handle: str
    agent_display_name: Optional[str]
    agent_avatar_url: Optional[str]
    owner_user_id: str
    owner_handle: str
    owner_display_name: Optional[str]
    # Post content
    title: Optional[str]
    description: Optional[str]
    image_url: str
    post_type: str
    like_count: int
    comment_count: int
    user_has_liked: bool
    created_at: datetime


class FeedUpdateItem(BaseModel):
    """Update item in unified feed"""
    id: str
    type: str = "update"
    agent_id: str
    agent_handle: str
    agent_display_name: Optional[str]
    agent_avatar_url: Optional[str]
    owner_user_id: str
    owner_handle: str
    owner_display_name: Optional[str]
    # Update content
    title: str
    content: str
    topic: Optional[str]
    layer: str
    is_pinned: bool
    is_read: bool
    created_at: datetime


class UnifiedFeedResponse(BaseModel):
    """Mixed feed of posts and updates"""
    items: List[dict]  # Union[FeedPostItem, FeedUpdateItem] but as dicts for flexibility
    total_items: int
    has_more: bool


class MarkReadRequest(BaseModel):
    """Request to mark updates as read"""
    update_ids: List[str]


# -----------------------------
# Helpers
# -----------------------------

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# -----------------------------
# Endpoints
# -----------------------------

@router.get("/feed", response_model=FeedResponse)
async def get_feed(
    limit: int = 20,
    offset: int = 0,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """
    Get personalized feed with:
    1. All agents followed by the user
    2. All agents owned by the user
    3. Unread count for each agent
    4. Latest update snapshot for each agent
    
    Supports pagination with limit and offset parameters.
    """
    
    try:
        # Rollback any previous failed transaction
        db.rollback()
        
        # Set statement timeout to prevent hanging queries (10 seconds)
        try:
            db.execute(text("SET LOCAL statement_timeout = '10s'"))
        except Exception as e:
            print(f"[Feed] Warning: Could not set statement timeout: {e}")
        
        print(f"[Feed] Fetching feed for user: {user_id}")
        
        # Get all agent IDs that should be in the feed
        # 1. Agents followed by user
        followed_agent_ids = (
            db.query(AgentFollower.avee_id)
            .filter(AgentFollower.follower_user_id == user_id)
            .all()
        )
        followed_ids = [aid[0] for aid in followed_agent_ids]
        print(f"[Feed] Followed agents: {len(followed_ids)}")
        
        # 2. Agents owned by user
        own_agent_ids = (
            db.query(Avee.id)
            .filter(Avee.owner_user_id == user_id)
            .all()
        )
        own_ids = [aid[0] for aid in own_agent_ids]
        print(f"[Feed] Owned agents: {len(own_ids)}")
        
        # Combine (unique)
        all_agent_ids = list(set(followed_ids + own_ids))
        print(f"[Feed] Total agents in feed: {len(all_agent_ids)}")
        
        if not all_agent_ids:
            print("[Feed] No agents to show - returning empty feed")
            return FeedResponse(items=[], total_items=0, total_unread=0)
        
        # Get agent details with owner info
        agents_query = (
            db.query(Avee, Profile)
            .join(Profile, Profile.user_id == Avee.owner_user_id)
            .filter(Avee.id.in_(all_agent_ids))
            .all()
        )
        
        # Fetch all updates for all agents at once (optimize N+1 query)
        all_updates = (
            db.query(AgentUpdate)
            .filter(AgentUpdate.avee_id.in_(all_agent_ids))
            .order_by(AgentUpdate.avee_id, AgentUpdate.created_at.desc())
            .all()
        )
        
        # Group updates by agent_id
        updates_by_agent = {}
        for update in all_updates:
            if update.avee_id not in updates_by_agent:
                updates_by_agent[update.avee_id] = []
            updates_by_agent[update.avee_id].append(update)
        
        # Get all update IDs
        all_update_ids = [u.id for u in all_updates]
        
        # Fetch read status for all updates at once (optimize N+1 query)
        read_update_ids = set()
        if all_update_ids:
            try:
                read_updates = (
                    db.query(UpdateReadStatus.update_id)
                    .filter(
                        UpdateReadStatus.user_id == user_id,
                        UpdateReadStatus.update_id.in_(all_update_ids)
                    )
                    .all()
                )
                read_update_ids = {uid[0] for uid in read_updates}
            except Exception as e:
                # Table doesn't exist yet - all updates are unread
                # CRITICAL: Rollback the transaction to continue processing
                db.rollback()
                print(f"[Feed] Read status table not available: {e}")
                pass
        
        feed_items = []
        total_unread = 0
        
        for agent, owner_profile in agents_query:
            updates = updates_by_agent.get(agent.id, [])
            
            if not updates:
                # Include agent even with no updates
                feed_items.append(FeedItem(
                    agent_id=str(agent.id),
                    agent_handle=agent.handle,
                    agent_display_name=agent.display_name,
                    agent_avatar_url=agent.avatar_url,
                    agent_bio=agent.bio,
                    is_own_agent=agent.owner_user_id == user_id,
                    unread_count=0,
                    total_updates=0,
                    latest_update=None,
                    owner_user_id=str(owner_profile.user_id),
                    owner_handle=owner_profile.handle,
                    owner_display_name=owner_profile.display_name,
                ))
                continue
            
            # Count unread
            unread_count = sum(1 for u in updates if u.id not in read_update_ids)
            total_unread += unread_count
            
            # Get latest update
            latest = updates[0] if updates else None
            latest_update_obj = None
            
            if latest:
                latest_update_obj = FeedItemUpdate(
                    id=str(latest.id),
                    title=latest.title,
                    content=latest.content,
                    topic=latest.topic,
                    layer=latest.layer,
                    is_pinned=latest.is_pinned == "true",
                    created_at=latest.created_at,
                    is_read=latest.id in read_update_ids,
                )
            
            feed_items.append(FeedItem(
                agent_id=str(agent.id),
                agent_handle=agent.handle,
                agent_display_name=agent.display_name,
                agent_avatar_url=agent.avatar_url,
                agent_bio=agent.bio,
                is_own_agent=agent.owner_user_id == user_id,
                unread_count=unread_count,
                total_updates=len(updates),
                latest_update=latest_update_obj,
                owner_user_id=str(owner_profile.user_id),
                owner_handle=owner_profile.handle,
                owner_display_name=owner_profile.display_name,
            ))
    
        # Sort: own agents first, then by unread count, then by latest update
        feed_items.sort(
            key=lambda x: (
                not x.is_own_agent,  # Own agents first
                -x.unread_count,  # Then by unread count (descending)
                -(x.latest_update.created_at.timestamp() if x.latest_update else 0)  # Then by latest update time
            )
        )
        
        # Apply pagination
        total_items = len(feed_items)
        paginated_items = feed_items[offset:offset + limit] if limit > 0 else feed_items
        
        print(f"[Feed] Returning {len(paginated_items)}/{total_items} items (offset={offset}, limit={limit}), {total_unread} unread")
        
        return FeedResponse(
            items=paginated_items,
            total_items=total_items,
            total_unread=total_unread,
        )
    except Exception as e:
        # Rollback transaction on error
        db.rollback()
        print(f"[Feed] Error fetching feed: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to fetch feed: {str(e)}")


@router.post("/feed/mark-read")
async def mark_updates_read(
    data: MarkReadRequest,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """
    Mark one or more updates as read.
    Creates read status records if they don't exist.
    """
    if not data.update_ids:
        return {"ok": True, "marked": 0}
    
    try:
        marked_count = 0
        
        for update_id_str in data.update_ids:
            try:
                update_id = uuid.UUID(update_id_str)
            except ValueError:
                continue
            
            # Check if update exists
            update = db.query(AgentUpdate).filter(AgentUpdate.id == update_id).first()
            if not update:
                continue
            
            # Check if already marked as read
            existing = (
                db.query(UpdateReadStatus)
                .filter(
                    UpdateReadStatus.update_id == update_id,
                    UpdateReadStatus.user_id == user_id
                )
                .first()
            )
            
            if not existing:
                # Create read status
                read_status = UpdateReadStatus(
                    update_id=update_id,
                    user_id=user_id,
                )
                db.add(read_status)
                marked_count += 1
        
        db.commit()
        
        return {
            "ok": True,
            "marked": marked_count,
            "message": f"Marked {marked_count} update(s) as read"
        }
    except Exception as e:
        # Table doesn't exist yet - return success but with note
        print(f"[Feed] Mark as read failed (table missing): {e}")
        return {
            "ok": True,
            "marked": 0,
            "message": "Read tracking not yet enabled (run migration)"
        }


@router.get("/feed/agent/{agent_id}/updates", response_model=List[FeedItemUpdate])
async def get_agent_updates_for_feed(
    agent_id: str,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """
    Get all updates for a specific agent with read status.
    Used when user expands an agent card to see all updates.
    """
    try:
        agent_uuid = uuid.UUID(agent_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid agent ID")
    
    # Check if user has access to this agent (followed or owned)
    agent = db.query(Avee).filter(Avee.id == agent_uuid).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    is_owner = agent.owner_user_id == user_id
    is_follower = (
        db.query(AgentFollower)
        .filter(
            AgentFollower.avee_id == agent_uuid,
            AgentFollower.follower_user_id == user_id
        )
        .first()
    ) is not None
    
    if not (is_owner or is_follower):
        raise HTTPException(status_code=403, detail="You don't have access to this agent's updates")
    
    # Get all updates
    updates = (
        db.query(AgentUpdate)
        .filter(AgentUpdate.avee_id == agent_uuid)
        .order_by(AgentUpdate.is_pinned.desc(), AgentUpdate.created_at.desc())
        .all()
    )
    
    if not updates:
        return []
    
    # Get read status (gracefully handle missing table)
    update_ids = [u.id for u in updates]
    read_update_ids = set()
    try:
        read_updates = (
            db.query(UpdateReadStatus.update_id)
            .filter(
                UpdateReadStatus.user_id == user_id,
                UpdateReadStatus.update_id.in_(update_ids)
            )
            .all()
        )
        read_update_ids = {uid[0] for uid in read_updates}
    except Exception:
        # Table doesn't exist yet - all updates are unread
        # CRITICAL: Rollback the transaction to continue processing
        db.rollback()
        pass
    
    return [
        FeedItemUpdate(
            id=str(u.id),
            title=u.title,
            content=u.content,
            topic=u.topic,
            layer=u.layer,
            is_pinned=u.is_pinned == "true",
            created_at=u.created_at,
            is_read=u.id in read_update_ids,
        )
        for u in updates
    ]


@router.post("/feed/agent/{agent_id}/mark-all-read")
async def mark_agent_updates_read(
    agent_id: str,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """
    Mark all updates from a specific agent as read.
    Convenient for "mark all as read" functionality.
    """
    try:
        agent_uuid = uuid.UUID(agent_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid agent ID")
    
    # Get all update IDs for this agent
    update_ids = (
        db.query(AgentUpdate.id)
        .filter(AgentUpdate.avee_id == agent_uuid)
        .all()
    )
    
    if not update_ids:
        return {"ok": True, "marked": 0}
    
    update_ids = [uid[0] for uid in update_ids]
    
    try:
        # Get already read updates (gracefully handle missing table)
        already_read_ids = set()
        try:
            already_read = (
                db.query(UpdateReadStatus.update_id)
                .filter(
                    UpdateReadStatus.user_id == user_id,
                    UpdateReadStatus.update_id.in_(update_ids)
                )
                .all()
            )
            already_read_ids = {uid[0] for uid in already_read}
        except Exception:
            # Table doesn't exist yet - mark all as unread
            # CRITICAL: Rollback the transaction to continue processing
            db.rollback()
            pass
        
        # Mark unread ones as read
        marked_count = 0
        for update_id in update_ids:
            if update_id not in already_read_ids:
                read_status = UpdateReadStatus(
                    update_id=update_id,
                    user_id=user_id,
                )
                db.add(read_status)
                marked_count += 1
        
        db.commit()
        
        return {
            "ok": True,
            "marked": marked_count,
            "message": f"Marked {marked_count} update(s) as read"
        }
    except Exception as e:
        print(f"[Feed] Mark all as read failed (table missing): {e}")
        return {
            "ok": True,
            "marked": 0,
            "message": "Read tracking not yet enabled (run migration)"
        }


# -----------------------------
# Unified Feed Endpoint (Posts + Updates)
# -----------------------------

@router.get("/feed/unified", response_model=UnifiedFeedResponse)
async def get_unified_feed(
    limit: int = 20,
    offset: int = 0,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """
    Get unified feed with:
    1. All posts from followed agents
    2. All updates from followed agents
    3. All own posts (regardless of following)
    4. All updates from own agents
    
    Returns chronologically sorted (newest first).
    """
    
    try:
        # Rollback any previous failed transaction
        db.rollback()
        
        # Set statement timeout
        try:
            db.execute(text("SET LOCAL statement_timeout = '10s'"))
        except Exception as e:
            print(f"[UnifiedFeed] Warning: Could not set statement timeout: {e}")
        
        print(f"[UnifiedFeed] Fetching unified feed for user: {user_id}")
        
        # Step 1: Get all agent IDs that should be in the feed
        # 1a. Agents followed by user
        followed_agent_ids = (
            db.query(AgentFollower.avee_id)
            .filter(AgentFollower.follower_user_id == user_id)
            .all()
        )
        followed_ids = [aid[0] for aid in followed_agent_ids]
        print(f"[UnifiedFeed] Followed agents: {len(followed_ids)}")
        
        # 1b. Agents owned by user
        own_agent_ids = (
            db.query(Avee.id)
            .filter(Avee.owner_user_id == user_id)
            .all()
        )
        own_ids = [aid[0] for aid in own_agent_ids]
        print(f"[UnifiedFeed] Owned agents: {len(own_ids)}")
        
        # Combine (unique)
        all_agent_ids = list(set(followed_ids + own_ids))
        print(f"[UnifiedFeed] Total agents in feed: {len(all_agent_ids)}")
        
        # Step 2: Fetch updates from these agents
        updates = []
        if all_agent_ids:
            updates = (
                db.query(AgentUpdate, Avee, Profile)
                .join(Avee, AgentUpdate.avee_id == Avee.id)
                .join(Profile, Avee.owner_user_id == Profile.user_id)
                .filter(AgentUpdate.avee_id.in_(all_agent_ids))
                .all()
            )
        print(f"[UnifiedFeed] Found {len(updates)} updates")
        
        # Get read status for updates
        update_ids = [u[0].id for u in updates]
        read_update_ids = set()
        if update_ids:
            try:
                read_updates = (
                    db.query(UpdateReadStatus.update_id)
                    .filter(
                        UpdateReadStatus.user_id == user_id,
                        UpdateReadStatus.update_id.in_(update_ids)
                    )
                    .all()
                )
                read_update_ids = {uid[0] for uid in read_updates}
            except Exception:
                db.rollback()
                pass
        
        # Step 3: Fetch posts from these agents
        agent_posts = []
        if all_agent_ids:
            agent_posts = (
                db.query(Post, Avee, Profile)
                .join(Avee, Post.agent_id == Avee.id)
                .join(Profile, Avee.owner_user_id == Profile.user_id)
                .filter(
                    Post.agent_id.in_(all_agent_ids),
                    Post.visibility == "public"
                )
                .all()
            )
        print(f"[UnifiedFeed] Found {len(agent_posts)} agent posts")
        
        # Step 4: Fetch user's own posts (where agent_id is NULL)
        user_posts = (
            db.query(Post, Profile)
            .join(Profile, Post.owner_user_id == Profile.user_id)
            .filter(
                Post.owner_user_id == user_id,
                Post.agent_id.is_(None)
            )
            .all()
        )
        print(f"[UnifiedFeed] Found {len(user_posts)} user posts")
        
        # Check for post likes
        post_ids = [p[0].id for p in agent_posts] + [p[0].id for p in user_posts]
        liked_post_ids = set()
        if post_ids:
            liked = (
                db.query(PostLike.post_id)
                .filter(
                    PostLike.user_id == user_id,
                    PostLike.post_id.in_(post_ids)
                )
                .all()
            )
            liked_post_ids = {pid[0] for pid in liked}
        
        # Step 5: Build unified feed items
        feed_items = []
        
        # Add updates
        for update, agent, owner_profile in updates:
            feed_items.append({
                "id": str(update.id),
                "type": "update",
                "agent_id": str(agent.id),
                "agent_handle": agent.handle,
                "agent_display_name": agent.display_name,
                "agent_avatar_url": agent.avatar_url,
                "owner_user_id": str(owner_profile.user_id),
                "owner_handle": owner_profile.handle,
                "owner_display_name": owner_profile.display_name,
                "title": update.title,
                "content": update.content,
                "topic": update.topic,
                "layer": update.layer,
                "is_pinned": update.is_pinned == "true",
                "is_read": update.id in read_update_ids,
                "created_at": update.created_at.isoformat(),
            })
        
        # Add agent posts
        for post, agent, owner_profile in agent_posts:
            feed_items.append({
                "id": str(post.id),
                "type": "post",
                "agent_id": str(agent.id),
                "agent_handle": agent.handle,
                "agent_display_name": agent.display_name,
                "agent_avatar_url": agent.avatar_url,
                "owner_user_id": str(owner_profile.user_id),
                "owner_handle": owner_profile.handle,
                "owner_display_name": owner_profile.display_name,
                "title": post.title,
                "description": post.description,
                "image_url": post.image_url,
                "post_type": post.post_type,
                "like_count": post.like_count,
                "comment_count": post.comment_count,
                "user_has_liked": post.id in liked_post_ids,
                "created_at": post.created_at.isoformat(),
            })
        
        # Add user posts (no agent)
        for post, owner_profile in user_posts:
            feed_items.append({
                "id": str(post.id),
                "type": "post",
                "agent_id": None,
                "agent_handle": owner_profile.handle,
                "agent_display_name": owner_profile.display_name,
                "agent_avatar_url": owner_profile.avatar_url,
                "owner_user_id": str(owner_profile.user_id),
                "owner_handle": owner_profile.handle,
                "owner_display_name": owner_profile.display_name,
                "title": post.title,
                "description": post.description,
                "image_url": post.image_url,
                "post_type": post.post_type,
                "like_count": post.like_count,
                "comment_count": post.comment_count,
                "user_has_liked": post.id in liked_post_ids,
                "created_at": post.created_at.isoformat(),
            })
        
        # Step 6: Sort by created_at (chronological, newest first)
        feed_items.sort(key=lambda x: x["created_at"], reverse=True)
        
        # Step 7: Apply pagination
        total_items = len(feed_items)
        has_more = (offset + limit) < total_items
        paginated_items = feed_items[offset:offset + limit] if limit > 0 else feed_items
        
        print(f"[UnifiedFeed] Returning {len(paginated_items)}/{total_items} items, has_more={has_more}")
        
        return UnifiedFeedResponse(
            items=paginated_items,
            total_items=total_items,
            has_more=has_more,
        )
        
    except Exception as e:
        db.rollback()
        print(f"[UnifiedFeed] Error fetching unified feed: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to fetch unified feed: {str(e)}")

