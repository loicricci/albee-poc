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

from backend.db import SessionLocal
from backend.auth_supabase import get_current_user_id
from backend.models import Avee, AgentUpdate, AgentFollower, UpdateReadStatus, Profile, Post, PostLike, PostShare

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
def get_feed(  # Changed from async def to def - sync DB calls MUST run in thread pool
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
        # OPTIMIZATION: Limit total updates fetched
        all_updates = (
            db.query(AgentUpdate)
            .filter(AgentUpdate.avee_id.in_(all_agent_ids))
            .order_by(AgentUpdate.created_at.desc())
            .limit(min(len(all_agent_ids) * 5, 200))  # Max 200 updates total
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
def mark_updates_read(  # Changed from async def to def - sync DB calls MUST run in thread pool
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
def get_agent_updates_for_feed(  # Changed from async def to def - sync DB calls MUST run in thread pool
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
def mark_agent_updates_read(  # Changed from async def to def - sync DB calls MUST run in thread pool
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
def get_unified_feed(  # Changed from async def to def - sync DB calls MUST run in thread pool
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
    
    OPTIMIZED: Instead of fetching ALL data and sorting in Python,
    we fetch only the top N items directly from the database.
    """
    
    import time
    total_start = time.time()
    timings = {}
    
    try:
        # Rollback any previous failed transaction
        db.rollback()
        
        # Set aggressive statement timeout for production
        try:
            db.execute(text("SET LOCAL statement_timeout = '5s'"))
        except Exception as e:
            print(f"[UnifiedFeed] Warning: Could not set statement timeout: {e}")
        
        print(f"[UnifiedFeed] Fetching unified feed for user: {user_id}")
        
        # Step 1: Get all agent IDs that should be in the feed
        step1_start = time.time()
        
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
        timings['step1_agent_ids'] = (time.time() - step1_start) * 1000
        
        # Combine (unique)
        all_agent_ids = list(set(followed_ids + own_ids))
        print(f"[UnifiedFeed] Total agents in feed: {len(all_agent_ids)}")
        
        # FAST PATH: If no agents, return empty feed immediately
        if not all_agent_ids:
            print(f"[UnifiedFeed] No agents found, returning empty feed")
            return UnifiedFeedResponse(
                items=[],
                total=0,
                has_more=False,
                timings={"fast_path": "no_agents"}
            )
        
        # OPTIMIZATION: Instead of fetching ALL updates and posts, fetch only latest N items
        # This dramatically reduces query time for users with many agents
        
        # Calculate how many items to fetch from database (REDUCED for performance)
        fetch_limit = min(limit + offset + 10, 50)  # Keep small for fast queries
        
        # Step 2: Fetch ONLY the latest updates (limited!)
        step2_start = time.time()
        updates = []
        if all_agent_ids:
            # Use LIMIT directly in database query!
            updates = (
                db.query(AgentUpdate, Avee, Profile)
                .join(Avee, AgentUpdate.avee_id == Avee.id)
                .join(Profile, Avee.owner_user_id == Profile.user_id)
                .filter(AgentUpdate.avee_id.in_(all_agent_ids))
                .order_by(AgentUpdate.created_at.desc())
                .limit(fetch_limit)  # CRITICAL: Limit at database level!
                .all()
            )
        timings['step2_updates'] = (time.time() - step2_start) * 1000
        print(f"[UnifiedFeed] Found {len(updates)} updates", flush=True)
        
        # Get read status for ONLY these updates (not all!)
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
            except Exception as e:
                db.rollback()
                pass
        
        # Step 3: Fetch ONLY the latest posts (limited!)
        step3_start = time.time()
        agent_posts = []
        if all_agent_ids:
            # Use LIMIT directly in database query!
            agent_posts = (
                db.query(Post, Avee, Profile)
                .join(Avee, Post.agent_id == Avee.id)
                .join(Profile, Avee.owner_user_id == Profile.user_id)
                .filter(
                    Post.agent_id.in_(all_agent_ids),
                    Post.visibility == "public"
                )
                .order_by(Post.created_at.desc())
                .limit(fetch_limit)  # CRITICAL: Limit at database level!
                .all()
            )
        timings['step3_posts'] = (time.time() - step3_start) * 1000
        print(f"[UnifiedFeed] Found {len(agent_posts)} agent posts", flush=True)
        
        # Step 4: Fetch user's own posts (limited!)
        user_posts = (
            db.query(Post, Profile)
            .join(Profile, Post.owner_user_id == Profile.user_id)
            .filter(
                Post.owner_user_id == user_id,
                Post.agent_id.is_(None)
            )
            .order_by(Post.created_at.desc())
            .limit(fetch_limit)  # CRITICAL: Limit at database level!
            .all()
        )
        print(f"[UnifiedFeed] Found {len(user_posts)} user posts")
        
        # Step 4.5: Preload post owner profiles (only for fetched posts)
        all_post_owner_ids = list(set(
            [p[0].owner_user_id for p in agent_posts] + 
            [p[0].owner_user_id for p in user_posts]
        ))
        
        post_owners_map = {}
        if all_post_owner_ids:
            post_owners = (
                db.query(Profile)
                .filter(Profile.user_id.in_(all_post_owner_ids))
                .all()
            )
            post_owners_map = {p.user_id: p for p in post_owners}
            print(f"[UnifiedFeed] Preloaded {len(post_owners_map)} post owner profiles")
        
        # Step 4.6: Fetch reposts (limited!)
        reposts = []
        followed_owner_ids = []
        if all_agent_ids:
            followed_owners = (
                db.query(Avee.owner_user_id)
                .filter(Avee.id.in_(all_agent_ids))
                .distinct()
                .all()
            )
            followed_owner_ids = [owner[0] for owner in followed_owners]
        
        user_ids_for_reposts = [user_id] + followed_owner_ids if followed_owner_ids else [user_id]
        
        # Use LIMIT for reposts too!
        step4_start = time.time()
        reposts = (
            db.query(PostShare, Post, Profile, Avee)
            .join(Post, PostShare.post_id == Post.id)
            .join(Profile, PostShare.user_id == Profile.user_id)
            .outerjoin(Avee, Post.agent_id == Avee.id)
            .filter(
                PostShare.user_id.in_(user_ids_for_reposts),
                Post.visibility == "public"
            )
            .order_by(PostShare.created_at.desc())
            .limit(fetch_limit)  # CRITICAL: Limit at database level!
            .all()
        )
        timings['step4_reposts'] = (time.time() - step4_start) * 1000
        print(f"[UnifiedFeed] Found {len(reposts)} reposts")
        
        # Check for post likes (only for fetched posts)
        post_ids = [p[0].id for p in agent_posts] + [p[0].id for p in user_posts] + [r[1].id for r in reposts]
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
                "video_url": post.video_url,
                "video_duration": post.video_duration,
                "video_thumbnail_url": post.video_thumbnail_url,
                "post_type": post.post_type,
                "like_count": post.like_count,
                "comment_count": post.comment_count,
                "share_count": post.share_count,
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
                "video_url": post.video_url,
                "video_duration": post.video_duration,
                "video_thumbnail_url": post.video_thumbnail_url,
                "post_type": post.post_type,
                "like_count": post.like_count,
                "comment_count": post.comment_count,
                "share_count": post.share_count,
                "user_has_liked": post.id in liked_post_ids,
                "created_at": post.created_at.isoformat(),
            })
        
        # Add reposts
        for share, post, sharer_profile, post_agent in reposts:
            # Get original post owner from preloaded map
            post_owner = post_owners_map.get(post.owner_user_id)
            
            if not post_owner:
                # Fallback: query if somehow not in map
                post_owner = db.query(Profile).filter(Profile.user_id == post.owner_user_id).first()
                if not post_owner:
                    continue
            
            user_liked = post.id in liked_post_ids
            
            feed_items.append({
                "id": f"repost-{str(share.id)}",
                "type": "repost",
                "repost_id": str(share.id),
                "repost_comment": share.comment,
                "reposted_by_user_id": str(sharer_profile.user_id),
                "reposted_by_handle": sharer_profile.handle,
                "reposted_by_display_name": sharer_profile.display_name,
                "reposted_by_avatar_url": sharer_profile.avatar_url,
                "reposted_at": share.created_at.isoformat(),
                "post_id": str(post.id),
                "agent_id": str(post_agent.id) if post_agent else None,
                "agent_handle": post_agent.handle if post_agent else post_owner.handle,
                "agent_display_name": post_agent.display_name if post_agent else post_owner.display_name,
                "agent_avatar_url": post_agent.avatar_url if post_agent else post_owner.avatar_url,
                "owner_user_id": str(post_owner.user_id),
                "owner_handle": post_owner.handle,
                "owner_display_name": post_owner.display_name,
                "title": post.title,
                "description": post.description,
                "image_url": post.image_url,
                "video_url": post.video_url,
                "video_duration": post.video_duration,
                "video_thumbnail_url": post.video_thumbnail_url,
                "post_type": post.post_type,
                "like_count": post.like_count,
                "comment_count": post.comment_count,
                "share_count": post.share_count,
                "user_has_liked": user_liked,
                "created_at": share.created_at.isoformat(),
            })
        
        # Step 6: Sort by created_at (chronological, newest first)
        feed_items.sort(key=lambda x: x["created_at"], reverse=True)
        
        # Step 7: Apply pagination
        total_items = len(feed_items)
        has_more = (offset + limit) < total_items
        paginated_items = feed_items[offset:offset + limit] if limit > 0 else feed_items
        
        total_time = (time.time() - total_start) * 1000
        print(f"[UnifiedFeed] Returning {len(paginated_items)}/{total_items} items, has_more={has_more}")
        print(f"[UnifiedFeed] Timing: total={total_time:.0f}ms | agent_ids={timings.get('step1_agent_ids', 0):.0f}ms, updates={timings.get('step2_updates', 0):.0f}ms, posts={timings.get('step3_posts', 0):.0f}ms, reposts={timings.get('step4_reposts', 0):.0f}ms")
        
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

