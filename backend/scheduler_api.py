"""
Scheduler API Endpoints

Provides protected endpoints for automated/scheduled tasks.
These endpoints are called by Railway Cron Jobs or other schedulers.

Security: Protected by SCHEDULER_SECRET_KEY header, not user authentication.
"""

import os
import uuid
import asyncio
from typing import Optional, List
from datetime import datetime
from fastapi import APIRouter, HTTPException, Header, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from pydantic import BaseModel

from backend.db import SessionLocal

router = APIRouter(prefix="/scheduled", tags=["scheduler"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def verify_scheduler_key(x_scheduler_key: str = Header(..., alias="X-Scheduler-Key")) -> str:
    """
    Verify the scheduler secret key.
    This protects scheduler endpoints from unauthorized access.
    """
    expected_key = os.getenv("SCHEDULER_SECRET_KEY")
    
    if not expected_key:
        raise HTTPException(
            status_code=500,
            detail="SCHEDULER_SECRET_KEY not configured on server"
        )
    
    if x_scheduler_key != expected_key:
        raise HTTPException(
            status_code=403,
            detail="Invalid scheduler key"
        )
    
    return x_scheduler_key


# =====================================
# PYDANTIC MODELS
# =====================================

class ScheduledAutoPostRequest(BaseModel):
    """Optional parameters for scheduled auto-post"""
    category: Optional[str] = None  # News category filter
    image_engine: str = "dall-e-3"  # Image generation engine
    dry_run: bool = False  # If true, just return what would be generated


class AutoPostResult(BaseModel):
    """Result for a single agent's auto-post"""
    avee_id: str
    handle: str
    success: bool
    post_id: Optional[str] = None
    error: Optional[str] = None
    duration_seconds: Optional[float] = None


class ScheduledAutoPostResponse(BaseModel):
    """Response from scheduled auto-post trigger"""
    triggered_at: str
    total_enabled_agents: int
    processed: int
    successful: int
    failed: int
    results: List[AutoPostResult]
    dry_run: bool


# =====================================
# SCHEDULER ENDPOINTS
# =====================================

@router.post("/trigger-autopost", response_model=ScheduledAutoPostResponse)
async def trigger_scheduled_autopost(
    request: ScheduledAutoPostRequest = ScheduledAutoPostRequest(),
    db: Session = Depends(get_db),
    _: str = Depends(verify_scheduler_key)
):
    """
    Trigger auto-post generation for all enabled agents.
    
    This endpoint is designed to be called by Railway Cron Jobs or similar schedulers.
    It processes all agents with auto_post_enabled = true and generates posts for them.
    
    Security:
    - Protected by X-Scheduler-Key header
    - Not accessible with normal user authentication
    
    Rate Limiting:
    - 5 second delay between agents to avoid API rate limits
    - Configurable via AUTO_POST_DELAY_SECONDS env var
    
    Example Railway Cron:
    ```
    curl -X POST https://your-backend.railway.app/scheduled/trigger-autopost \
         -H "X-Scheduler-Key: your-secret-key" \
         -H "Content-Type: application/json"
    ```
    """
    triggered_at = datetime.utcnow()
    
    # Check global kill switch
    if os.getenv("AUTO_POST_ENABLED", "true").lower() == "false":
        return ScheduledAutoPostResponse(
            triggered_at=triggered_at.isoformat(),
            total_enabled_agents=0,
            processed=0,
            successful=0,
            failed=0,
            results=[],
            dry_run=request.dry_run
        )
    
    # Get all agents with auto_post_enabled = true
    query = text("""
        SELECT 
            id as avee_id,
            handle,
            display_name,
            auto_post_settings
        FROM avees
        WHERE auto_post_enabled = true
        ORDER BY last_auto_post_at ASC NULLS FIRST
    """)
    
    result = db.execute(query)
    enabled_agents = result.fetchall()
    
    total_enabled = len(enabled_agents)
    
    print(f"[Scheduler] Auto-post triggered at {triggered_at.isoformat()}")
    print(f"[Scheduler] Found {total_enabled} agents with auto_post_enabled = true")
    
    # Dry run - just return what would be processed
    if request.dry_run:
        dry_run_results = [
            AutoPostResult(
                avee_id=str(agent.avee_id),
                handle=agent.handle,
                success=True,
                post_id=None,
                error=None,
                duration_seconds=None
            )
            for agent in enabled_agents
        ]
        
        return ScheduledAutoPostResponse(
            triggered_at=triggered_at.isoformat(),
            total_enabled_agents=total_enabled,
            processed=0,
            successful=0,
            failed=0,
            results=dry_run_results,
            dry_run=True
        )
    
    # Process each agent
    results: List[AutoPostResult] = []
    successful = 0
    failed = 0
    
    # Get delay between agents (default 5 seconds)
    delay_seconds = int(os.getenv("AUTO_POST_DELAY_SECONDS", "5"))
    
    for i, agent in enumerate(enabled_agents):
        avee_id = str(agent.avee_id)
        handle = agent.handle
        
        print(f"[Scheduler] Processing agent {i+1}/{total_enabled}: @{handle}")
        
        try:
            # Generate post for this agent
            post_result = await _generate_scheduled_post(
                handle=handle,
                avee_id=avee_id,
                category=request.category,
                image_engine=request.image_engine,
                db=db
            )
            
            results.append(AutoPostResult(
                avee_id=avee_id,
                handle=handle,
                success=post_result["success"],
                post_id=post_result.get("post_id"),
                error=post_result.get("error"),
                duration_seconds=post_result.get("duration_seconds")
            ))
            
            if post_result["success"]:
                successful += 1
                print(f"[Scheduler] ✅ @{handle}: Post created (ID: {post_result.get('post_id')})")
            else:
                failed += 1
                print(f"[Scheduler] ❌ @{handle}: Failed - {post_result.get('error')}")
            
        except Exception as e:
            failed += 1
            results.append(AutoPostResult(
                avee_id=avee_id,
                handle=handle,
                success=False,
                error=str(e)
            ))
            print(f"[Scheduler] ❌ @{handle}: Exception - {str(e)}")
        
        # Rate limiting delay between agents (skip on last agent)
        if i < len(enabled_agents) - 1:
            print(f"[Scheduler] Waiting {delay_seconds}s before next agent...")
            await asyncio.sleep(delay_seconds)
    
    print(f"[Scheduler] Completed: {successful} successful, {failed} failed out of {total_enabled}")
    
    return ScheduledAutoPostResponse(
        triggered_at=triggered_at.isoformat(),
        total_enabled_agents=total_enabled,
        processed=len(results),
        successful=successful,
        failed=failed,
        results=results,
        dry_run=False
    )


@router.get("/status")
async def get_scheduler_status(
    db: Session = Depends(get_db),
    _: str = Depends(verify_scheduler_key)
):
    """
    Get current scheduler status and enabled agent count.
    Useful for monitoring and debugging.
    """
    # Count enabled agents
    count_query = text("""
        SELECT COUNT(*) FROM avees WHERE auto_post_enabled = true
    """)
    enabled_count = db.execute(count_query).scalar()
    
    # Get last auto-post times
    recent_query = text("""
        SELECT 
            handle,
            last_auto_post_at
        FROM avees
        WHERE auto_post_enabled = true
        ORDER BY last_auto_post_at DESC NULLS LAST
        LIMIT 5
    """)
    recent_posts = db.execute(recent_query).fetchall()
    
    return {
        "scheduler_configured": bool(os.getenv("SCHEDULER_SECRET_KEY")),
        "auto_post_globally_enabled": os.getenv("AUTO_POST_ENABLED", "true").lower() != "false",
        "enabled_agents_count": enabled_count,
        "delay_between_agents_seconds": int(os.getenv("AUTO_POST_DELAY_SECONDS", "5")),
        "recent_auto_posts": [
            {
                "handle": row.handle,
                "last_auto_post_at": row.last_auto_post_at.isoformat() if row.last_auto_post_at else None
            }
            for row in recent_posts
        ]
    }


# =====================================
# INTERNAL HELPER FUNCTIONS
# =====================================

async def _generate_scheduled_post(
    handle: str,
    avee_id: str,
    category: Optional[str],
    image_engine: str,
    db: Session
) -> dict:
    """
    Generate a single post for a scheduled auto-post.
    
    This is similar to auto_post_api.generate_single_post but optimized
    for scheduled batch processing.
    """
    start_time = datetime.now()
    
    try:
        # Import generator module
        from backend.generate_daily_post import DailyPostGenerator
        
        generator = DailyPostGenerator(verbose=False)
        result = await generator.generate_post_async(
            agent_handle=handle,
            topic_override=None,  # Use news API for scheduled posts
            category=category,
            image_engine=image_engine,
            reference_image_url_override=None  # Use agent's default reference image
        )
        
        # Check if generation was successful
        if not result.get("success", True):
            duration = (datetime.now() - start_time).total_seconds()
            
            # Update last error in database
            error_msg = result.get("error", "Unknown error")
            _update_last_error(db, avee_id, error_msg)
            
            return {
                "avee_id": avee_id,
                "handle": handle,
                "success": False,
                "post_id": None,
                "error": error_msg,
                "duration_seconds": duration
            }
        
        # Update last_auto_post_at (always works)
        # Note: auto_post_last_error clearing is optional (migration 011)
        update_query = text("""
            UPDATE avees
            SET last_auto_post_at = NOW()
            WHERE id = :avee_id
        """)
        db.execute(update_query, {"avee_id": avee_id})
        db.commit()
        
        # Check if should auto-post to Twitter
        post_id = result.get("post_id")
        twitter_url = None
        twitter_error = None
        
        if post_id:
            twitter_result = await _try_twitter_auto_post(db, avee_id, post_id)
            twitter_url = twitter_result.get("twitter_url")
            twitter_error = twitter_result.get("twitter_error")
        
        duration = (datetime.now() - start_time).total_seconds()
        
        return {
            "avee_id": avee_id,
            "handle": handle,
            "success": True,
            "post_id": post_id,
            "twitter_url": twitter_url,
            "twitter_error": twitter_error,
            "error": None,
            "duration_seconds": duration
        }
        
    except Exception as e:
        duration = (datetime.now() - start_time).total_seconds()
        
        # Log and store error
        import traceback
        print(f"[Scheduler] ERROR generating post for @{handle}:")
        print(f"[Scheduler] {str(e)}")
        traceback.print_exc()
        
        _update_last_error(db, avee_id, str(e))
        
        return {
            "avee_id": avee_id,
            "handle": handle,
            "success": False,
            "post_id": None,
            "error": str(e),
            "duration_seconds": duration
        }


def _update_last_error(db: Session, avee_id: str, error: str):
    """
    Update the last error for an agent.
    
    Note: The auto_post_last_error column is optional (added in migration 011).
    This function gracefully handles the case where the column doesn't exist yet.
    """
    try:
        # Check if column exists first (for backwards compatibility)
        check_query = text("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'avees' AND column_name = 'auto_post_last_error'
        """)
        column_exists = db.execute(check_query).fetchone() is not None
        
        if column_exists:
            update_query = text("""
                UPDATE avees
                SET auto_post_last_error = :error
                WHERE id = :avee_id
            """)
            db.execute(update_query, {"avee_id": avee_id, "error": error[:500]})  # Truncate long errors
            db.commit()
        else:
            print(f"[Scheduler] auto_post_last_error column not found - run migration 011")
    except Exception as e:
        print(f"[Scheduler] Failed to update last error: {e}")


async def _try_twitter_auto_post(db: Session, avee_id: str, post_id: str) -> dict:
    """
    Try to auto-post to Twitter if enabled for this agent.
    Returns dict with twitter_url and/or twitter_error.
    """
    try:
        from backend.twitter_posting_service import get_twitter_posting_service
        posting_service = get_twitter_posting_service()
        
        avee_uuid = uuid.UUID(avee_id)
        if posting_service.should_auto_post(avee_uuid, db):
            # Get agent owner
            avee_query = text("""
                SELECT owner_user_id FROM avees WHERE id = :avee_id
            """)
            avee_result = db.execute(avee_query, {"avee_id": avee_id})
            avee_row = avee_result.fetchone()
            
            if avee_row:
                owner_user_id = avee_row[0]
                post_uuid = uuid.UUID(post_id)
                
                # Attempt to post to Twitter
                twitter_result = posting_service.post_to_twitter(
                    post_uuid,
                    owner_user_id,
                    db
                )
                
                if twitter_result["success"]:
                    return {"twitter_url": twitter_result.get("twitter_url")}
                else:
                    return {"twitter_error": twitter_result.get("error")}
        
        return {}
        
    except Exception as e:
        return {"twitter_error": str(e)}
