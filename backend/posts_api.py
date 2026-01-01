"""
Posts API endpoints - Image posts with likes, comments, and shares
"""
import uuid
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import text, desc, and_
from pydantic import BaseModel
import json

from db import SessionLocal
from auth_supabase import get_current_user_id
from models import (
    Post,
    PostLike,
    PostComment,
    CommentLike,
    PostShare,
    Profile,
    Avee
)

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
    post_type: str = "image"
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
    
    # Base query
    query = db.query(
        Post,
        Profile.handle,
        Profile.display_name,
        Profile.avatar_url
    ).join(
        Profile, Post.owner_user_id == Profile.user_id
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
    
    # Format response with user interaction data
    results = []
    for post, handle, display_name, avatar_url in posts:
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
        
        results.append({
            "id": str(post.id),
            "owner_user_id": str(post.owner_user_id),
            "owner_handle": handle,
            "owner_display_name": display_name,
            "owner_avatar_url": avatar_url,
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
    
    # Get post with owner info
    result = db.query(
        Post,
        Profile.handle,
        Profile.display_name,
        Profile.avatar_url
    ).join(
        Profile, Post.owner_user_id == Profile.user_id
    ).filter(Post.id == post_uuid).first()
    
    if not result:
        raise HTTPException(status_code=404, detail="Post not found")
    
    post, handle, display_name, avatar_url = result
    
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
    
    return {
        "id": str(post.id),
        "owner_user_id": str(post.owner_user_id),
        "owner_handle": handle,
        "owner_display_name": display_name,
        "owner_avatar_url": avatar_url,
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
    
    return {"id": str(comment.id), "message": "Comment created"}


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
    
    return {"id": str(share.id), "message": "Post shared"}


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


