"""
Posts API endpoints - Image posts with likes, comments, and shares
"""
import uuid
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import text, desc, and_, or_
from pydantic import BaseModel
import json

from backend.db import SessionLocal
from backend.auth_supabase import get_current_user_id
from backend.models import (
    Post,
    PostLike,
    PostComment,
    CommentLike,
    PostShare,
    Profile,
    Avee,
    Notification
)
from backend.twitter_posting_service import get_twitter_posting_service
from backend.notifications_api import create_notification

router = APIRouter()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# =====================================
# PYDANTIC MODELS
# =====================================

class PostCreate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    image_url: str
    post_type: str = "image"  # Valid values: 'image', 'ai_generated', 'text' (NOT 'update')
    ai_metadata: Optional[dict] = None
    visibility: str = "public"
    agent_id: Optional[str] = None  # Optional agent_id for agent posts


class PostUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    visibility: Optional[str] = None


class CommentCreate(BaseModel):
    content: str
    parent_comment_id: Optional[str] = None


class PostResponse(BaseModel):
    id: str
    owner_user_id: str
    owner_handle: str
    owner_display_name: Optional[str]
    owner_avatar_url: Optional[str]
    title: Optional[str]
    description: Optional[str]
    image_url: str
    post_type: str
    ai_metadata: dict
    visibility: str
    like_count: int
    comment_count: int
    share_count: int
    user_has_liked: bool
    created_at: str
    updated_at: str


# =====================================
# POST ENDPOINTS
# =====================================

@router.post("/posts")
def create_post(
    post_data: PostCreate,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    """Create a new post"""
    user_uuid = uuid.UUID(user_id)
    
    # Parse agent_id if provided
    agent_uuid = None
    if post_data.agent_id:
        try:
            agent_uuid = uuid.UUID(post_data.agent_id)
            
            # Verify that the user owns this agent
            avee = db.query(Avee).filter(Avee.id == agent_uuid).first()
            if not avee or avee.owner_user_id != user_uuid:
                raise HTTPException(status_code=403, detail="Not authorized to post as this agent")
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid agent_id format")
    
    # Convert ai_metadata to JSON string
    ai_metadata_str = json.dumps(post_data.ai_metadata or {})
    
    post = Post(
        owner_user_id=user_uuid,
        agent_id=agent_uuid,
        title=post_data.title,
        description=post_data.description,
        image_url=post_data.image_url,
        post_type=post_data.post_type,
        ai_metadata=ai_metadata_str,
        visibility=post_data.visibility,
    )
    
    db.add(post)
    db.commit()
    db.refresh(post)
    
    return {"id": str(post.id), "message": "Post created successfully"}


@router.get("/posts")
def get_posts(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    user_handle: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user_id: str = Depends(get_current_user_id),
):
    """Get posts feed"""
    current_uuid = uuid.UUID(current_user_id)
    
    # Base query - we need to get both profile and agent info (left join for agent)
    query = db.query(
        Post,
        Profile.handle,
        Profile.display_name,
        Profile.avatar_url,
        Avee.handle,
        Avee.display_name,
        Avee.avatar_url
    ).join(
        Profile, Post.owner_user_id == Profile.user_id
    ).outerjoin(
        Avee, Post.agent_id == Avee.id
    )
    
    # Filter by user if handle provided
    # Check if it's an avee (agent) handle or profile handle
    if user_handle:
        # First, check if it's an avee handle
        avee_check = db.execute(
            text("SELECT id, owner_user_id FROM avees WHERE handle = :handle LIMIT 1"),
            {"handle": user_handle}
        ).fetchone()
        
        if avee_check:
            # It's an avee - filter by agent_id to show only posts from this specific agent
            avee_id = avee_check[0]
            query = query.filter(Post.agent_id == avee_id)
        else:
            # It's a profile handle - filter normally (user posts, not agent posts)
            query = query.filter(
                and_(
                    Profile.handle == user_handle,
                    Post.agent_id.is_(None)  # Only show posts created by the user, not their agents
                )
            )
    
    # Only show public posts or own posts
    query = query.filter(
        (Post.visibility == "public") | (Post.owner_user_id == current_uuid)
    )
    
    # Order by creation date
    query = query.order_by(desc(Post.created_at))
    
    # Pagination
    posts = query.limit(limit).offset(offset).all()
    
    # Fetch reposts by this user if user_handle is specified
    reposts = []
    if user_handle:
        # Get the profile for this handle (could be from earlier check, but let's be explicit)
        profile = db.query(Profile).filter(Profile.handle == user_handle).first()
        if profile:
            reposts_query = (
                db.query(PostShare, Post, Profile, Avee)
                .join(Post, PostShare.post_id == Post.id)
                .join(Profile, Post.owner_user_id == Profile.user_id)
                .outerjoin(Avee, Post.agent_id == Avee.id)
                .filter(
                    PostShare.user_id == profile.user_id,
                    or_(
                        Post.visibility == "public",
                        Post.owner_user_id == current_uuid
                    )
                )
                .order_by(desc(PostShare.created_at))
                .limit(limit)
                .offset(offset)
                .all()
            )
            reposts = reposts_query
    
    # Format response with user interaction data
    results = []
    for post, profile_handle, profile_display_name, profile_avatar_url, agent_handle, agent_display_name, agent_avatar_url in posts:
        # Check if current user has liked
        has_liked = db.query(PostLike).filter(
            and_(
                PostLike.post_id == post.id,
                PostLike.user_id == current_uuid
            )
        ).first() is not None
        
        # Parse AI metadata
        try:
            ai_metadata = json.loads(post.ai_metadata) if post.ai_metadata else {}
        except:
            ai_metadata = {}
        
        # If post has an agent_id, use agent info, otherwise use profile info
        if post.agent_id and agent_handle:
            display_handle = agent_handle
            display_name = agent_display_name
            display_avatar = agent_avatar_url
        else:
            display_handle = profile_handle
            display_name = profile_display_name
            display_avatar = profile_avatar_url
        
        results.append({
            "id": str(post.id),
            "owner_user_id": str(post.owner_user_id),
            "owner_handle": display_handle,
            "owner_display_name": display_name,
            "owner_avatar_url": display_avatar,
            "title": post.title,
            "description": post.description,
            "image_url": post.image_url,
            "post_type": post.post_type,
            "ai_metadata": ai_metadata,
            "visibility": post.visibility,
            "like_count": post.like_count,
            "comment_count": post.comment_count,
            "share_count": post.share_count,
            "user_has_liked": has_liked,
            "created_at": post.created_at.isoformat() if post.created_at else None,
            "updated_at": post.updated_at.isoformat() if post.updated_at else None,
        })
    
    # Process reposts and add to results
    for share, post, post_owner, post_agent in reposts:
        # Get reposter profile
        reposter = db.query(Profile).filter(Profile.user_id == share.user_id).first()
        
        if not reposter:
            continue
        
        has_liked = db.query(PostLike).filter(
            and_(
                PostLike.post_id == post.id,
                PostLike.user_id == current_uuid
            )
        ).first() is not None
        
        # Parse AI metadata
        try:
            ai_metadata = json.loads(post.ai_metadata) if post.ai_metadata else {}
        except:
            ai_metadata = {}
        
        results.append({
            "id": f"repost-{str(share.id)}",
            "type": "repost",
            "repost_id": str(share.id),
            "repost_comment": share.comment,
            "reposted_by_user_id": str(reposter.user_id),
            "reposted_by_handle": reposter.handle,
            "reposted_by_display_name": reposter.display_name,
            "reposted_by_avatar_url": reposter.avatar_url,
            "reposted_at": share.created_at.isoformat(),
            # Original post data
            "post_id": str(post.id),
            "owner_user_id": str(post_owner.user_id),
            "owner_handle": post_owner.handle,
            "owner_display_name": post_owner.display_name,
            "owner_avatar_url": post_owner.avatar_url,
            "agent_handle": post_agent.handle if post_agent else post_owner.handle,
            "agent_display_name": post_agent.display_name if post_agent else post_owner.display_name,
            "agent_avatar_url": post_agent.avatar_url if post_agent else post_owner.avatar_url,
            "title": post.title,
            "description": post.description,
            "image_url": post.image_url,
            "post_type": post.post_type,
            "ai_metadata": ai_metadata,
            "visibility": post.visibility,
            "like_count": post.like_count,
            "comment_count": post.comment_count,
            "share_count": post.share_count,
            "user_has_liked": has_liked,
            "created_at": share.created_at.isoformat(),
            "updated_at": post.updated_at.isoformat() if post.updated_at else None,
        })
    
    # Sort combined results by created_at (newest first)
    results.sort(key=lambda x: x["created_at"], reverse=True)
    
    return {
        "posts": results,
        "total": len(results),
        "limit": limit,
        "offset": offset,
    }


@router.get("/posts/{post_id}")
def get_post(
    post_id: str,
    db: Session = Depends(get_db),
    current_user_id: str = Depends(get_current_user_id),
):
    """Get a single post by ID"""
    current_uuid = uuid.UUID(current_user_id)
    post_uuid = uuid.UUID(post_id)
    
    # Get post with owner info (profile and agent)
    result = db.query(
        Post,
        Profile.handle,
        Profile.display_name,
        Profile.avatar_url,
        Avee.handle,
        Avee.display_name,
        Avee.avatar_url
    ).join(
        Profile, Post.owner_user_id == Profile.user_id
    ).outerjoin(
        Avee, Post.agent_id == Avee.id
    ).filter(Post.id == post_uuid).first()
    
    if not result:
        raise HTTPException(status_code=404, detail="Post not found")
    
    post, profile_handle, profile_display_name, profile_avatar_url, agent_handle, agent_display_name, agent_avatar_url = result
    
    # Check visibility
    if post.visibility != "public" and post.owner_user_id != current_uuid:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Check if current user has liked
    has_liked = db.query(PostLike).filter(
        and_(
            PostLike.post_id == post.id,
            PostLike.user_id == current_uuid
        )
    ).first() is not None
    
    # Parse AI metadata
    try:
        ai_metadata = json.loads(post.ai_metadata) if post.ai_metadata else {}
    except:
        ai_metadata = {}
    
    # If post has an agent_id, use agent info, otherwise use profile info
    if post.agent_id and agent_handle:
        display_handle = agent_handle
        display_name = agent_display_name
        display_avatar = agent_avatar_url
    else:
        display_handle = profile_handle
        display_name = profile_display_name
        display_avatar = profile_avatar_url
    
    return {
        "id": str(post.id),
        "owner_user_id": str(post.owner_user_id),
        "owner_handle": display_handle,
        "owner_display_name": display_name,
        "owner_avatar_url": display_avatar,
        "title": post.title,
        "description": post.description,
        "image_url": post.image_url,
        "post_type": post.post_type,
        "ai_metadata": ai_metadata,
        "visibility": post.visibility,
        "like_count": post.like_count,
        "comment_count": post.comment_count,
        "share_count": post.share_count,
        "user_has_liked": has_liked,
        "created_at": post.created_at.isoformat() if post.created_at else None,
        "updated_at": post.updated_at.isoformat() if post.updated_at else None,
    }


@router.put("/posts/{post_id}")
def update_post(
    post_id: str,
    post_data: PostUpdate,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    """Update a post (owner only)"""
    user_uuid = uuid.UUID(user_id)
    post_uuid = uuid.UUID(post_id)
    
    post = db.query(Post).filter(Post.id == post_uuid).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    if post.owner_user_id != user_uuid:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Update fields
    if post_data.title is not None:
        post.title = post_data.title
    if post_data.description is not None:
        post.description = post_data.description
    if post_data.visibility is not None:
        post.visibility = post_data.visibility
    
    db.commit()
    return {"message": "Post updated successfully"}


@router.delete("/posts/{post_id}")
def delete_post(
    post_id: str,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    """Delete a post (owner only)"""
    user_uuid = uuid.UUID(user_id)
    post_uuid = uuid.UUID(post_id)
    
    post = db.query(Post).filter(Post.id == post_uuid).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    if post.owner_user_id != user_uuid:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    db.delete(post)
    db.commit()
    return {"message": "Post deleted successfully"}


# =====================================
# LIKE ENDPOINTS
# =====================================

@router.post("/posts/{post_id}/like")
def like_post(
    post_id: str,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    """Like a post"""
    user_uuid = uuid.UUID(user_id)
    post_uuid = uuid.UUID(post_id)
    
    # Check if post exists
    post = db.query(Post).filter(Post.id == post_uuid).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    # Check if already liked
    existing_like = db.query(PostLike).filter(
        and_(PostLike.post_id == post_uuid, PostLike.user_id == user_uuid)
    ).first()
    
    if existing_like:
        return {"message": "Already liked"}
    
    # Create like
    like = PostLike(post_id=post_uuid, user_id=user_uuid)
    db.add(like)
    
    # Create notification for post owner (if not liking own post)
    if post.owner_user_id != user_uuid:
        try:
            # Get liker info
            liker = db.query(Profile).filter(Profile.user_id == user_uuid).first()
            liker_name = liker.display_name or liker.handle if liker else "Someone"
            
            # Create notification without committing (will commit with the like)
            notification = Notification(
                id=uuid.uuid4(),
                user_id=post.owner_user_id,
                notification_type="post_like",
                title="New like on your post",
                message=f"{liker_name} liked your post",
                link=f"/posts/{str(post.id)}",
                related_user_id=user_uuid,
                related_post_id=post.id,
                is_read="false"
            )
            db.add(notification)
        except Exception as e:
            print(f"Error creating like notification: {e}")
            # Continue anyway - like is more important than notification
    
    # Single commit for both like and notification
    db.commit()
    
    return {"message": "Post liked"}


@router.delete("/posts/{post_id}/like")
def unlike_post(
    post_id: str,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    """Unlike a post"""
    user_uuid = uuid.UUID(user_id)
    post_uuid = uuid.UUID(post_id)
    
    like = db.query(PostLike).filter(
        and_(PostLike.post_id == post_uuid, PostLike.user_id == user_uuid)
    ).first()
    
    if not like:
        raise HTTPException(status_code=404, detail="Like not found")
    
    db.delete(like)
    db.commit()
    
    return {"message": "Post unliked"}


# =====================================
# COMMENT ENDPOINTS
# =====================================

@router.get("/posts/{post_id}/comments")
def get_comments(
    post_id: str,
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user_id: str = Depends(get_current_user_id),
):
    """Get comments for a post"""
    post_uuid = uuid.UUID(post_id)
    current_uuid = uuid.UUID(current_user_id)
    
    # Get comments with user info
    comments = db.query(
        PostComment,
        Profile.handle,
        Profile.display_name,
        Profile.avatar_url
    ).join(
        Profile, PostComment.user_id == Profile.user_id
    ).filter(
        PostComment.post_id == post_uuid,
        PostComment.parent_comment_id == None  # Only top-level comments
    ).order_by(
        desc(PostComment.created_at)
    ).limit(limit).offset(offset).all()
    
    results = []
    for comment, handle, display_name, avatar_url in comments:
        # Check if user has liked this comment
        has_liked = db.query(CommentLike).filter(
            and_(
                CommentLike.comment_id == comment.id,
                CommentLike.user_id == current_uuid
            )
        ).first() is not None
        
        results.append({
            "id": str(comment.id),
            "post_id": str(comment.post_id),
            "user_id": str(comment.user_id),
            "user_handle": handle,
            "user_display_name": display_name,
            "user_avatar_url": avatar_url,
            "content": comment.content,
            "parent_comment_id": str(comment.parent_comment_id) if comment.parent_comment_id else None,
            "like_count": comment.like_count,
            "reply_count": comment.reply_count,
            "user_has_liked": has_liked,
            "created_at": comment.created_at.isoformat() if comment.created_at else None,
            "updated_at": comment.updated_at.isoformat() if comment.updated_at else None,
        })
    
    return {"comments": results, "total": len(results)}


@router.post("/posts/{post_id}/comments")
def create_comment(
    post_id: str,
    comment_data: CommentCreate,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    """Create a comment on a post"""
    user_uuid = uuid.UUID(user_id)
    post_uuid = uuid.UUID(post_id)
    
    # Check if post exists
    post = db.query(Post).filter(Post.id == post_uuid).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    # Create comment
    parent_uuid = uuid.UUID(comment_data.parent_comment_id) if comment_data.parent_comment_id else None
    
    comment = PostComment(
        post_id=post_uuid,
        user_id=user_uuid,
        content=comment_data.content,
        parent_comment_id=parent_uuid,
    )
    
    db.add(comment)
    db.commit()
    db.refresh(comment)
    
    # Store comment ID before attempting notification
    comment_id = str(comment.id)
    
    # Create notification for post owner (if not commenting on own post)
    if post.owner_user_id != user_uuid:
        try:
            # Get commenter info
            commenter = db.query(Profile).filter(Profile.user_id == user_uuid).first()
            commenter_name = commenter.display_name or commenter.handle if commenter else "Someone"
            
            # Truncate comment for notification
            comment_preview = comment_data.content[:50] + "..." if len(comment_data.content) > 50 else comment_data.content
            
            create_notification(
                db=db,
                user_id=post.owner_user_id,
                notification_type="post_comment",
                title="New comment on your post",
                message=f"{commenter_name} commented: {comment_preview}",
                link=f"/posts/{str(post.id)}",
                related_user_id=user_uuid,
                related_post_id=post.id
            )
        except Exception as e:
            print(f"Error creating comment notification: {e}")
            # Rollback the failed notification transaction
            db.rollback()
    
    return {"id": comment_id, "message": "Comment created"}


@router.delete("/comments/{comment_id}")
def delete_comment(
    comment_id: str,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    """Delete a comment (owner only)"""
    user_uuid = uuid.UUID(user_id)
    comment_uuid = uuid.UUID(comment_id)
    
    comment = db.query(PostComment).filter(PostComment.id == comment_uuid).first()
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    
    if comment.user_id != user_uuid:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    db.delete(comment)
    db.commit()
    
    return {"message": "Comment deleted"}


@router.post("/comments/{comment_id}/like")
def like_comment(
    comment_id: str,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    """Like a comment"""
    user_uuid = uuid.UUID(user_id)
    comment_uuid = uuid.UUID(comment_id)
    
    # Check if comment exists
    comment = db.query(PostComment).filter(PostComment.id == comment_uuid).first()
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    
    # Check if already liked
    existing_like = db.query(CommentLike).filter(
        and_(CommentLike.comment_id == comment_uuid, CommentLike.user_id == user_uuid)
    ).first()
    
    if existing_like:
        return {"message": "Already liked"}
    
    # Create like
    like = CommentLike(comment_id=comment_uuid, user_id=user_uuid)
    db.add(like)
    db.commit()
    
    return {"message": "Comment liked"}


@router.delete("/comments/{comment_id}/like")
def unlike_comment(
    comment_id: str,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    """Unlike a comment"""
    user_uuid = uuid.UUID(user_id)
    comment_uuid = uuid.UUID(comment_id)
    
    like = db.query(CommentLike).filter(
        and_(CommentLike.comment_id == comment_uuid, CommentLike.user_id == user_uuid)
    ).first()
    
    if not like:
        raise HTTPException(status_code=404, detail="Like not found")
    
    db.delete(like)
    db.commit()
    
    return {"message": "Comment unliked"}


# =====================================
# SHARE ENDPOINTS
# =====================================

@router.post("/posts/{post_id}/share")
def share_post(
    post_id: str,
    share_type: str = "repost",
    comment: Optional[str] = None,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    """Share/repost a post"""
    user_uuid = uuid.UUID(user_id)
    post_uuid = uuid.UUID(post_id)
    
    # Check if post exists
    post = db.query(Post).filter(Post.id == post_uuid).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    # Create share
    share = PostShare(
        post_id=post_uuid,
        user_id=user_uuid,
        share_type=share_type,
        comment=comment,
    )
    
    db.add(share)
    db.commit()
    db.refresh(share)
    
    # Store share ID before attempting notification
    share_id = str(share.id)
    
    # Create notification for post owner (if not sharing own post)
    if post.owner_user_id != user_uuid:
        try:
            # Get sharer info
            sharer = db.query(Profile).filter(Profile.user_id == user_uuid).first()
            sharer_name = sharer.display_name or sharer.handle if sharer else "Someone"
            
            create_notification(
                db=db,
                user_id=post.owner_user_id,
                notification_type="post_repost",
                title="Your post was shared",
                message=f"{sharer_name} shared your post",
                link=f"/posts/{str(post.id)}",
                related_user_id=user_uuid,
                related_post_id=post.id
            )
        except Exception as e:
            print(f"Error creating share notification: {e}")
            # Rollback the failed notification transaction
            db.rollback()
    
    return {"id": share_id, "message": "Post shared"}


@router.delete("/shares/{share_id}")
def unshare_post(
    share_id: str,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    """Delete a share (owner only)"""
    user_uuid = uuid.UUID(user_id)
    share_uuid = uuid.UUID(share_id)
    
    share = db.query(PostShare).filter(PostShare.id == share_uuid).first()
    if not share:
        raise HTTPException(status_code=404, detail="Share not found")
    
    if share.user_id != user_uuid:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    db.delete(share)
    db.commit()
    
    return {"message": "Share removed"}


# =====================================
# TWITTER INTEGRATION ENDPOINTS
# =====================================

@router.post("/posts/{post_id}/post-to-twitter")
def post_to_twitter(
    post_id: str,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    """
    Manually post to Twitter (for manual approval mode)
    
    User must own the agent that created the post
    """
    user_uuid = uuid.UUID(user_id)
    post_uuid = uuid.UUID(post_id)
    
    # Get posting service
    posting_service = get_twitter_posting_service()
    
    # Post to Twitter
    result = posting_service.post_to_twitter(post_uuid, user_uuid, db)
    
    if not result["success"]:
        raise HTTPException(
            status_code=400,
            detail=result.get("error", "Failed to post to Twitter")
        )
    
    return {
        "success": True,
        "twitter_url": result["twitter_url"],
        "tweet_id": result.get("tweet_id")
    }


@router.get("/posts/{post_id}/twitter-status")
def get_post_twitter_status(
    post_id: str,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    """
    Check if post can be shared to Twitter
    
    Returns status and reason if it can't be posted
    """
    post_uuid = uuid.UUID(post_id)
    
    # Get post
    post = db.query(Post).filter(Post.id == post_uuid).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    # Check if already posted
    if post.posted_to_twitter:
        return {
            "can_post": False,
            "reason": "Already posted to Twitter",
            "twitter_url": post.twitter_post_url
        }
    
    # Check if post has an agent
    if not post.agent_id:
        return {
            "can_post": False,
            "reason": "Post has no associated agent"
        }
    
    # Check agent Twitter status
    posting_service = get_twitter_posting_service()
    status = posting_service.can_post_to_twitter(post.agent_id, db)
    
    return status


@router.get("/posts/pending-twitter")
def get_pending_twitter_posts(
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    """
    Get posts pending Twitter approval for user's agents
    
    Returns posts from agents with manual approval mode that haven't been posted yet
    """
    user_uuid = uuid.UUID(user_id)
    
    # Get user's agents with Twitter enabled and manual mode
    agents = db.query(Avee).filter(
        and_(
            Avee.owner_user_id == user_uuid,
            Avee.twitter_sharing_enabled == True,
            Avee.twitter_posting_mode == "manual"
        )
    ).all()
    
    if not agents:
        return {"posts": [], "total": 0}
    
    agent_ids = [agent.id for agent in agents]
    
    # Get posts from these agents that haven't been posted to Twitter
    posts = db.query(
        Post,
        Avee.handle,
        Avee.display_name,
        Avee.avatar_url
    ).join(
        Avee, Post.agent_id == Avee.id
    ).filter(
        and_(
            Post.agent_id.in_(agent_ids),
            Post.posted_to_twitter == "false"
        )
    ).order_by(
        desc(Post.created_at)
    ).limit(limit).all()
    
    results = []
    for post, agent_handle, agent_display_name, agent_avatar_url in posts:
        # Parse AI metadata
        try:
            ai_metadata = json.loads(post.ai_metadata) if post.ai_metadata else {}
        except:
            ai_metadata = {}
        
        results.append({
            "id": str(post.id),
            "title": post.title,
            "description": post.description,
            "image_url": post.image_url,
            "post_type": post.post_type,
            "ai_metadata": ai_metadata,
            "agent_id": str(post.agent_id),
            "agent_handle": agent_handle,
            "agent_display_name": agent_display_name,
            "agent_avatar_url": agent_avatar_url,
            "created_at": post.created_at.isoformat() if post.created_at else None
        })
    
    return {"posts": results, "total": len(results)}
