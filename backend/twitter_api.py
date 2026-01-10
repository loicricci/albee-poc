"""
Twitter API Router
API endpoints for managing Twitter auto-fetch configuration.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
import uuid
import json
import logging
from datetime import datetime

logger = logging.getLogger(__name__)

from backend.db import SessionLocal
from backend.auth_supabase import get_current_user_id
from backend.models import TwitterConfig, TwitterFetchLog, Avee
from backend.twitter_sync import TwitterSyncService
from backend.twitter_service import get_twitter_service

router = APIRouter()


# -----------------------------
# Request/Response Models
# -----------------------------

class TwitterConfigCreate(BaseModel):
    """Request to create/update Twitter configuration."""
    is_enabled: bool = True
    search_topics: List[str] = []
    twitter_accounts: List[str] = []
    max_tweets_per_fetch: int = 10
    fetch_frequency_hours: int = 24
    layer: str = "public"
    auto_create_updates: bool = True


class TwitterConfigResponse(BaseModel):
    """Twitter configuration response."""
    id: str
    avee_id: str
    is_enabled: bool
    search_topics: List[str]
    twitter_accounts: List[str]
    max_tweets_per_fetch: int
    fetch_frequency_hours: int
    last_fetch_at: Optional[datetime]
    layer: str
    auto_create_updates: bool
    created_at: datetime
    updated_at: Optional[datetime]


class TwitterFetchResult(BaseModel):
    """Result of a Twitter fetch operation."""
    status: str
    tweets_fetched: int
    updates_created: int
    message: Optional[str] = None


class TwitterFetchLogResponse(BaseModel):
    """Twitter fetch log entry."""
    id: str
    fetch_status: str
    tweets_fetched: int
    updates_created: int
    error_message: Optional[str]
    created_at: datetime


class TwitterStatusResponse(BaseModel):
    """Twitter API status."""
    available: bool
    message: str


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


# -----------------------------
# Endpoints
# -----------------------------

@router.get("/twitter/status", response_model=TwitterStatusResponse)
async def get_twitter_status():
    """Check if Twitter API is available and configured."""
    twitter_service = get_twitter_service()
    is_available = twitter_service.is_available()
    
    return TwitterStatusResponse(
        available=is_available,
        message="Twitter API is configured and ready" if is_available else "Twitter API not configured - set TWITTER_BEARER_TOKEN"
    )


@router.post("/agents/{agent_id}/twitter/config", response_model=TwitterConfigResponse)
async def create_or_update_twitter_config(
    agent_id: str,
    data: TwitterConfigCreate,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """
    Create or update Twitter auto-fetch configuration for an agent.
    
    This allows the agent to automatically fetch tweets based on:
    - Search topics/keywords
    - Specific Twitter accounts to monitor
    
    Tweets will be converted to agent updates and stored in the knowledge base.
    """
    # Verify ownership
    agent = verify_agent_ownership(db, agent_id, user_id)
    
    # Validate
    if data.layer not in ["public", "friends", "intimate"]:
        raise HTTPException(status_code=400, detail="Invalid layer")
    
    # Twitter API requires minimum 10 tweets per request
    if data.max_tweets_per_fetch < 10:
        raise HTTPException(
            status_code=400, 
            detail="max_tweets_per_fetch must be at least 10 (Twitter API minimum)"
        )
    
    if data.max_tweets_per_fetch > 100:
        raise HTTPException(status_code=400, detail="max_tweets_per_fetch must be 100 or less")
    
    # Recommend 10 tweets for free tier
    if data.max_tweets_per_fetch > 10:
        logger.warning(
            f"[Twitter Config] max_tweets_per_fetch set to {data.max_tweets_per_fetch}. "
            f"For free tier, recommend 10 to conserve rate limits."
        )
    
    if data.fetch_frequency_hours < 1:
        raise HTTPException(status_code=400, detail="fetch_frequency_hours must be at least 1")
    
    # Recommend longer intervals for free tier
    if data.fetch_frequency_hours < 24:
        logger.warning(
            f"[Twitter Config] fetch_frequency_hours set to {data.fetch_frequency_hours}. "
            f"For free tier, recommend 24+ hours to avoid rate limits."
        )
    
    if not data.search_topics and not data.twitter_accounts:
        raise HTTPException(
            status_code=400,
            detail="At least one search topic or Twitter account is required"
        )
    
    # Check if config exists
    config = (
        db.query(TwitterConfig)
        .filter(TwitterConfig.avee_id == agent_id)
        .first()
    )
    
    if config:
        # Update existing
        config.is_enabled = "true" if data.is_enabled else "false"
        config.search_topics = json.dumps(data.search_topics)
        config.twitter_accounts = json.dumps(data.twitter_accounts)
        config.max_tweets_per_fetch = data.max_tweets_per_fetch
        config.fetch_frequency_hours = data.fetch_frequency_hours
        config.layer = data.layer
        config.auto_create_updates = "true" if data.auto_create_updates else "false"
        config.updated_at = datetime.utcnow()
    else:
        # Create new
        config = TwitterConfig(
            id=uuid.uuid4(),
            avee_id=agent_id,
            is_enabled="true" if data.is_enabled else "false",
            search_topics=json.dumps(data.search_topics),
            twitter_accounts=json.dumps(data.twitter_accounts),
            max_tweets_per_fetch=data.max_tweets_per_fetch,
            fetch_frequency_hours=data.fetch_frequency_hours,
            layer=data.layer,
            auto_create_updates="true" if data.auto_create_updates else "false",
        )
        db.add(config)
    
    db.commit()
    db.refresh(config)
    
    return TwitterConfigResponse(
        id=str(config.id),
        avee_id=str(config.avee_id),
        is_enabled=config.is_enabled == "true",
        search_topics=json.loads(config.search_topics) if config.search_topics else [],
        twitter_accounts=json.loads(config.twitter_accounts) if config.twitter_accounts else [],
        max_tweets_per_fetch=config.max_tweets_per_fetch,
        fetch_frequency_hours=config.fetch_frequency_hours,
        last_fetch_at=config.last_fetch_at,
        layer=config.layer,
        auto_create_updates=config.auto_create_updates == "true",
        created_at=config.created_at,
        updated_at=config.updated_at,
    )


@router.get("/agents/{agent_id}/twitter/config", response_model=TwitterConfigResponse)
async def get_twitter_config(
    agent_id: str,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Get Twitter auto-fetch configuration for an agent."""
    # Verify ownership
    verify_agent_ownership(db, agent_id, user_id)
    
    config = (
        db.query(TwitterConfig)
        .filter(TwitterConfig.avee_id == agent_id)
        .first()
    )
    
    if not config:
        raise HTTPException(status_code=404, detail="Twitter configuration not found")
    
    return TwitterConfigResponse(
        id=str(config.id),
        avee_id=str(config.avee_id),
        is_enabled=config.is_enabled == "true",
        search_topics=json.loads(config.search_topics) if config.search_topics else [],
        twitter_accounts=json.loads(config.twitter_accounts) if config.twitter_accounts else [],
        max_tweets_per_fetch=config.max_tweets_per_fetch,
        fetch_frequency_hours=config.fetch_frequency_hours,
        last_fetch_at=config.last_fetch_at,
        layer=config.layer,
        auto_create_updates=config.auto_create_updates == "true",
        created_at=config.created_at,
        updated_at=config.updated_at,
    )


@router.delete("/agents/{agent_id}/twitter/config")
async def delete_twitter_config(
    agent_id: str,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Delete Twitter auto-fetch configuration for an agent."""
    # Verify ownership
    verify_agent_ownership(db, agent_id, user_id)
    
    config = (
        db.query(TwitterConfig)
        .filter(TwitterConfig.avee_id == agent_id)
        .first()
    )
    
    if not config:
        raise HTTPException(status_code=404, detail="Twitter configuration not found")
    
    db.delete(config)
    db.commit()
    
    return {"ok": True, "message": "Twitter configuration deleted"}


@router.post("/agents/{agent_id}/twitter/fetch", response_model=TwitterFetchResult)
async def fetch_tweets_now(
    agent_id: str,
    force: bool = False,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """
    Manually trigger a Twitter fetch for an agent.
    
    Args:
        force: Force fetch even if not due yet
    """
    # Verify ownership
    verify_agent_ownership(db, agent_id, user_id)
    
    # Check if Twitter service is available
    twitter_service = get_twitter_service()
    if not twitter_service.is_available():
        raise HTTPException(
            status_code=503,
            detail="Twitter API not configured - set TWITTER_BEARER_TOKEN environment variable"
        )
    
    try:
        sync_service = TwitterSyncService(db)
        result = sync_service.fetch_tweets_for_agent(agent_id, force=force)
        
        return TwitterFetchResult(
            status=result["status"],
            tweets_fetched=result.get("tweets_fetched", 0),
            updates_created=result.get("updates_created", 0),
            message=result.get("message"),
        )
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch tweets: {str(e)}")


@router.get("/agents/{agent_id}/twitter/logs", response_model=List[TwitterFetchLogResponse])
async def get_twitter_fetch_logs(
    agent_id: str,
    limit: int = 20,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Get Twitter fetch logs for an agent (for debugging and monitoring)."""
    # Verify ownership
    verify_agent_ownership(db, agent_id, user_id)
    
    logs = (
        db.query(TwitterFetchLog)
        .filter(TwitterFetchLog.avee_id == agent_id)
        .order_by(TwitterFetchLog.created_at.desc())
        .limit(limit)
        .all()
    )
    
    return [
        TwitterFetchLogResponse(
            id=str(log.id),
            fetch_status=log.fetch_status,
            tweets_fetched=log.tweets_fetched,
            updates_created=log.updates_created,
            error_message=log.error_message,
            created_at=log.created_at,
        )
        for log in logs
    ]

