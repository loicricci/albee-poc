"""
Subscription API endpoints - User subscription levels and upgrade requests
"""
import uuid
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from pydantic import BaseModel

from backend.db import SessionLocal
from backend.auth_supabase import get_current_user_id, get_current_user
from backend.models import Profile, UpgradeRequest, Avee, Post


router = APIRouter(prefix="/subscription", tags=["subscription"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# Subscription level configuration
SUBSCRIPTION_LEVELS = {
    "free": {
        "name": "Free",
        "max_agents": 1,
        "max_posts_per_month": 5,
        "order": 0,
        "description": "Basic access with limited features"
    },
    "starter": {
        "name": "Starter",
        "max_agents": 1,
        "max_posts_per_month": 20,
        "order": 1,
        "description": "More posts for growing creators"
    },
    "creator": {
        "name": "Creator",
        "max_agents": 3,
        "max_posts_per_month": 50,
        "order": 2,
        "description": "Multiple agents for serious creators"
    },
    "pro": {
        "name": "Pro",
        "max_agents": 15,
        "max_posts_per_month": 300,
        "order": 3,
        "description": "Maximum power for professionals"
    },
    "admin": {
        "name": "Admin",
        "max_agents": -1,  # Unlimited
        "max_posts_per_month": -1,  # Unlimited
        "order": 99,
        "description": "Administrator with unlimited access"
    }
}


def get_level_limits(level: str) -> dict:
    """Get limits for a subscription level"""
    return SUBSCRIPTION_LEVELS.get(level, SUBSCRIPTION_LEVELS["free"])


def get_next_level(current_level: str) -> Optional[str]:
    """Get the next upgrade level, or None if at max"""
    level_order = ["free", "starter", "creator", "pro"]
    try:
        current_index = level_order.index(current_level)
        if current_index < len(level_order) - 1:
            return level_order[current_index + 1]
    except ValueError:
        pass
    return None


def check_and_reset_monthly_posts(profile: Profile, db: Session) -> None:
    """Check if monthly post counter needs to be reset"""
    now = datetime.now(timezone.utc)
    
    # If no reset date set, initialize it
    if profile.posts_month_reset is None:
        profile.posts_month_reset = now
        profile.posts_this_month = 0
        db.commit()
        return
    
    # Check if we're in a new month
    reset_date = profile.posts_month_reset
    if reset_date.year != now.year or reset_date.month != now.month:
        profile.posts_month_reset = now
        profile.posts_this_month = 0
        db.commit()


# =====================================
# PYDANTIC MODELS
# =====================================

class UpgradeRequestCreate(BaseModel):
    requested_level: str


class SubscriptionStatusResponse(BaseModel):
    level: str
    level_name: str
    max_agents: int
    max_posts_per_month: int
    current_agent_count: int
    posts_this_month: int
    can_create_agent: bool
    can_create_post: bool
    remaining_agents: int
    remaining_posts: int
    next_level: Optional[str]
    has_pending_upgrade: bool


# =====================================
# ENDPOINTS
# =====================================

@router.get("/status")
def get_subscription_status(
    db: Session = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    """
    Get current user's subscription status including limits and usage
    """
    from backend.admin import ALLOWED_ADMIN_EMAILS
    
    user_id = user.get("id")
    user_email = user.get("email", "")  # This is the actual auth email from JWT
    user_uuid = uuid.UUID(user_id)
    
    # Get profile
    profile = db.query(Profile).filter(Profile.user_id == user_uuid).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    
    # Check if user is admin (by auth email from JWT, not profile.email)
    is_admin_user = user_email and user_email.lower() in [e.lower() for e in ALLOWED_ADMIN_EMAILS]
    
    # Check and reset monthly posts if needed
    check_and_reset_monthly_posts(profile, db)
    
    # Get subscription level - admin users get admin level
    if is_admin_user:
        level = "admin"
    else:
        level = profile.subscription_level or "free"
    limits = get_level_limits(level)
    
    # Get current agent count
    agent_count = db.query(func.count(Avee.id)).filter(
        Avee.owner_user_id == user_uuid
    ).scalar() or 0
    
    # Get posts this month
    posts_this_month = profile.posts_this_month or 0
    
    # Check for pending upgrade request (not relevant for admins)
    pending_request = None
    if not is_admin_user:
        pending_request = db.query(UpgradeRequest).filter(
            UpgradeRequest.user_id == user_uuid,
            UpgradeRequest.status == "pending"
        ).first()
    
    # Handle unlimited (-1) values
    max_agents = limits["max_agents"]
    max_posts = limits["max_posts_per_month"]
    
    can_create_agent = max_agents == -1 or agent_count < max_agents
    can_create_post = max_posts == -1 or posts_this_month < max_posts
    remaining_agents = -1 if max_agents == -1 else max(0, max_agents - agent_count)
    remaining_posts = -1 if max_posts == -1 else max(0, max_posts - posts_this_month)
    
    return {
        "level": level,
        "level_name": limits["name"],
        "max_agents": max_agents,
        "max_posts_per_month": max_posts,
        "current_agent_count": agent_count,
        "posts_this_month": posts_this_month,
        "can_create_agent": can_create_agent,
        "can_create_post": can_create_post,
        "remaining_agents": remaining_agents,
        "remaining_posts": remaining_posts,
        "next_level": None if is_admin_user else get_next_level(level),
        "has_pending_upgrade": pending_request is not None,
        "is_admin": is_admin_user,
    }


@router.get("/levels")
def get_subscription_levels():
    """
    Get all available subscription levels and their limits.
    Note: Admin level is NOT included - admin rights are granted directly by admins.
    """
    levels = []
    for key, value in SUBSCRIPTION_LEVELS.items():
        # Skip admin level - it's not available for user requests
        if key == "admin":
            continue
        levels.append({
            "id": key,
            "name": value["name"],
            "max_agents": value["max_agents"],
            "max_posts_per_month": value["max_posts_per_month"],
            "description": value["description"],
            "order": value["order"]
        })
    
    # Sort by order
    levels.sort(key=lambda x: x["order"])
    return {"levels": levels}


@router.post("/request-upgrade")
def request_upgrade(
    request_data: UpgradeRequestCreate,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    """
    Submit a request to upgrade subscription level.
    Note: Users cannot request admin level - admin rights are granted directly by admins.
    """
    user_uuid = uuid.UUID(user_id)
    requested_level = request_data.requested_level.lower()
    
    # Admin level cannot be requested - it's only granted by admins
    if requested_level == "admin":
        raise HTTPException(
            status_code=400, 
            detail="Admin level cannot be requested. Admin rights are granted directly by administrators."
        )
    
    # Validate requested level
    if requested_level not in SUBSCRIPTION_LEVELS:
        raise HTTPException(status_code=400, detail="Invalid subscription level")
    
    # Get profile
    profile = db.query(Profile).filter(Profile.user_id == user_uuid).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    
    current_level = profile.subscription_level or "free"
    
    # Check if requesting same or lower level
    current_order = SUBSCRIPTION_LEVELS[current_level]["order"]
    requested_order = SUBSCRIPTION_LEVELS[requested_level]["order"]
    
    if requested_order <= current_order:
        raise HTTPException(
            status_code=400, 
            detail="Can only request upgrade to a higher level"
        )
    
    # Check for existing pending request
    existing_pending = db.query(UpgradeRequest).filter(
        UpgradeRequest.user_id == user_uuid,
        UpgradeRequest.status == "pending"
    ).first()
    
    if existing_pending:
        raise HTTPException(
            status_code=400, 
            detail="You already have a pending upgrade request"
        )
    
    # Create upgrade request
    upgrade_request = UpgradeRequest(
        user_id=user_uuid,
        current_level=current_level,
        requested_level=requested_level,
        status="pending"
    )
    
    db.add(upgrade_request)
    db.commit()
    db.refresh(upgrade_request)
    
    return {
        "id": str(upgrade_request.id),
        "message": "Upgrade request submitted successfully",
        "current_level": current_level,
        "requested_level": requested_level,
        "status": "pending"
    }


@router.get("/my-requests")
def get_my_upgrade_requests(
    limit: int = 20,
    offset: int = 0,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    """
    Get user's upgrade request history
    """
    user_uuid = uuid.UUID(user_id)
    
    # Get requests
    requests = db.query(UpgradeRequest).filter(
        UpgradeRequest.user_id == user_uuid
    ).order_by(
        desc(UpgradeRequest.created_at)
    ).limit(limit).offset(offset).all()
    
    total = db.query(func.count(UpgradeRequest.id)).filter(
        UpgradeRequest.user_id == user_uuid
    ).scalar()
    
    results = []
    for req in requests:
        results.append({
            "id": str(req.id),
            "current_level": req.current_level,
            "requested_level": req.requested_level,
            "status": req.status,
            "admin_notes": req.admin_notes,
            "created_at": req.created_at.isoformat() if req.created_at else None,
            "processed_at": req.processed_at.isoformat() if req.processed_at else None,
        })
    
    return {
        "requests": results,
        "total": total,
        "limit": limit,
        "offset": offset
    }


@router.delete("/cancel-request/{request_id}")
def cancel_upgrade_request(
    request_id: str,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    """
    Cancel a pending upgrade request
    """
    user_uuid = uuid.UUID(user_id)
    request_uuid = uuid.UUID(request_id)
    
    # Get request
    upgrade_request = db.query(UpgradeRequest).filter(
        UpgradeRequest.id == request_uuid,
        UpgradeRequest.user_id == user_uuid
    ).first()
    
    if not upgrade_request:
        raise HTTPException(status_code=404, detail="Upgrade request not found")
    
    if upgrade_request.status != "pending":
        raise HTTPException(
            status_code=400, 
            detail="Can only cancel pending requests"
        )
    
    db.delete(upgrade_request)
    db.commit()
    
    return {"message": "Upgrade request cancelled successfully"}
