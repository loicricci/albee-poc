"""
Auto Post Generation API Endpoints

Provides endpoints for managing and triggering auto post generation.
"""

import uuid
import os
import sys
from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import text
from pydantic import BaseModel

# Add backend to path for imports
sys.path.insert(0, 'backend')

from db import SessionLocal
from auth_supabase import get_current_user_id

router = APIRouter(prefix="/auto-post", tags=["auto-post"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# =====================================
# PYDANTIC MODELS
# =====================================

class AutoPostStatus(BaseModel):
    avee_id: str
    handle: str
    display_name: Optional[str]
    avatar_url: Optional[str]
    auto_post_enabled: bool
    last_auto_post_at: Optional[str]
    auto_post_settings: dict


class AutoPostToggleRequest(BaseModel):
    avee_id: str
    enabled: bool


class GeneratePostRequest(BaseModel):
    avee_ids: List[str]
    topic: Optional[str] = None
    category: Optional[str] = None


class GenerationResult(BaseModel):
    avee_id: str
    handle: str
    success: bool
    post_id: Optional[str] = None
    error: Optional[str] = None
    duration_seconds: Optional[float] = None


# =====================================
# HELPER FUNCTIONS
# =====================================

def is_admin_user(user_id: str, db: Session) -> bool:
    """Check if user is admin"""
    query = text("""
        SELECT handle FROM profiles WHERE user_id = :user_id
    """)
    result = db.execute(query, {"user_id": user_id})
    row = result.fetchone()
    
    if not row:
        return False
    
    # Check if handle is in admin list (same logic as backoffice)
    admin_handles = os.getenv("ADMIN_HANDLES", "loic_ricci").split(",")
    return row[0] in admin_handles


def get_user_avees(user_id: str, db: Session, is_admin: bool) -> List[dict]:
    """Get avees accessible to user"""
    
    if is_admin:
        # Admin sees all avees
        query = text("""
            SELECT 
                id as avee_id,
                handle,
                display_name,
                avatar_url,
                COALESCE(auto_post_enabled, false) as auto_post_enabled,
                last_auto_post_at,
                COALESCE(auto_post_settings, '{}'::jsonb) as auto_post_settings
            FROM avees
            ORDER BY display_name, handle
        """)
        result = db.execute(query)
    else:
        # Non-admin sees only their own avees
        query = text("""
            SELECT 
                id as avee_id,
                handle,
                display_name,
                avatar_url,
                COALESCE(auto_post_enabled, false) as auto_post_enabled,
                last_auto_post_at,
                COALESCE(auto_post_settings, '{}'::jsonb) as auto_post_settings
            FROM avees
            WHERE owner_user_id = :user_id
            ORDER BY display_name, handle
        """)
        result = db.execute(query, {"user_id": user_id})
    
    rows = result.fetchall()
    
    return [
        {
            "avee_id": str(row.avee_id),
            "handle": row.handle,
            "display_name": row.display_name,
            "avatar_url": row.avatar_url,
            "auto_post_enabled": row.auto_post_enabled,
            "last_auto_post_at": row.last_auto_post_at.isoformat() if row.last_auto_post_at else None,
            "auto_post_settings": row.auto_post_settings
        }
        for row in rows
    ]


# =====================================
# API ENDPOINTS
# =====================================

@router.get("/status")
def get_auto_post_status(
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id)
):
    """
    Get auto post status for all agents accessible to the user.
    Admins see all agents, non-admins see only their own.
    """
    user_uuid = uuid.UUID(user_id)
    is_admin = is_admin_user(str(user_uuid), db)
    
    avees = get_user_avees(str(user_uuid), db, is_admin)
    
    return {
        "is_admin": is_admin,
        "avees": avees,
        "total_count": len(avees),
        "enabled_count": sum(1 for a in avees if a["auto_post_enabled"])
    }


@router.post("/toggle")
def toggle_auto_post(
    request: AutoPostToggleRequest,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id)
):
    """
    Enable or disable auto post generation for an agent.
    Non-admins can only toggle their own agents.
    """
    user_uuid = uuid.UUID(user_id)
    avee_uuid = uuid.UUID(request.avee_id)
    is_admin = is_admin_user(str(user_uuid), db)
    
    # Check ownership if not admin
    if not is_admin:
        check_query = text("""
            SELECT owner_user_id FROM avees WHERE id = :avee_id
        """)
        result = db.execute(check_query, {"avee_id": str(avee_uuid)})
        row = result.fetchone()
        
        if not row or str(row[0]) != str(user_uuid):
            raise HTTPException(status_code=403, detail="Not authorized to modify this agent")
    
    # Update auto_post_enabled
    update_query = text("""
        UPDATE avees
        SET auto_post_enabled = :enabled
        WHERE id = :avee_id
        RETURNING handle, display_name
    """)
    
    result = db.execute(update_query, {
        "enabled": request.enabled,
        "avee_id": str(avee_uuid)
    })
    
    row = result.fetchone()
    
    if not row:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    db.commit()
    
    return {
        "success": True,
        "avee_id": request.avee_id,
        "handle": row[0],
        "display_name": row[1],
        "auto_post_enabled": request.enabled
    }


@router.post("/generate")
async def generate_posts(
    request: GeneratePostRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id)
):
    """
    Generate posts for specified agents.
    Can run in background for multiple agents.
    """
    user_uuid = uuid.UUID(user_id)
    is_admin = is_admin_user(str(user_uuid), db)
    
    # Validate access to all requested avees
    for avee_id in request.avee_ids:
        avee_uuid = uuid.UUID(avee_id)
        
        if not is_admin:
            check_query = text("""
                SELECT owner_user_id FROM avees WHERE id = :avee_id
            """)
            result = db.execute(check_query, {"avee_id": str(avee_uuid)})
            row = result.fetchone()
            
            if not row or str(row[0]) != str(user_uuid):
                raise HTTPException(
                    status_code=403,
                    detail=f"Not authorized to generate posts for agent {avee_id}"
                )
    
    # Get handles for the avees
    # Use IN clause instead of ANY for better compatibility
    avee_uuids = [str(uuid.UUID(aid)) for aid in request.avee_ids]
    
    if len(avee_uuids) == 1:
        # Single UUID - simple query
        handles_query = text("""
            SELECT id, handle
            FROM avees
            WHERE id = :avee_id
        """)
        result = db.execute(handles_query, {"avee_id": avee_uuids[0]})
    else:
        # Multiple UUIDs - use IN clause
        placeholders = ", ".join([f":id_{i}" for i in range(len(avee_uuids))])
        handles_query = text(f"""
            SELECT id, handle
            FROM avees
            WHERE id IN ({placeholders})
        """)
        params = {f"id_{i}": avee_uuids[i] for i in range(len(avee_uuids))}
        result = db.execute(handles_query, params)
    
    avees_to_generate = {str(row[0]): row[1] for row in result.fetchall()}
    
    if not avees_to_generate:
        raise HTTPException(status_code=404, detail="No agents found")
    
    # If single agent, generate synchronously
    if len(avees_to_generate) == 1:
        avee_id = list(avees_to_generate.keys())[0]
        handle = avees_to_generate[avee_id]
        
        result = await generate_single_post(
            handle=handle,
            avee_id=avee_id,
            topic=request.topic,
            category=request.category,
            db=db
        )
        
        return {
            "status": "completed",
            "results": [result],
            "total": 1,
            "successful": 1 if result["success"] else 0
        }
    
    # Multiple agents - run in background
    background_tasks.add_task(
        generate_multiple_posts,
        avees_to_generate,
        request.topic,
        request.category
    )
    
    return {
        "status": "started",
        "message": f"Generating posts for {len(avees_to_generate)} agents in background",
        "avee_count": len(avees_to_generate)
    }


async def generate_single_post(
    handle: str,
    avee_id: str,
    topic: Optional[str],
    category: Optional[str],
    db: Session
) -> dict:
    """Generate a single post for an agent"""
    start_time = datetime.now()
    
    try:
        # Import generator modules - add parent directory to path
        import sys
        import os
        parent_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        if parent_dir not in sys.path:
            sys.path.insert(0, parent_dir)
        
        from generate_daily_post import DailyPostGenerator
        
        generator = DailyPostGenerator(verbose=False)
        result = await generator.generate_post_async(
            agent_handle=handle,
            topic_override=topic,
            category=category
        )
        
        # Update last_auto_post_at
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
            try:
                from twitter_posting_service import get_twitter_posting_service
                posting_service = get_twitter_posting_service()
                
                # Check if agent should auto-post
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
                            twitter_url = twitter_result.get("twitter_url")
                            print(f"[AutoPost] Auto-posted to Twitter: {twitter_url}")
                        else:
                            twitter_error = twitter_result.get("error")
                            print(f"[AutoPost] Failed to auto-post to Twitter: {twitter_error}")
                            
            except Exception as twitter_exc:
                twitter_error = str(twitter_exc)
                print(f"[AutoPost] Twitter auto-post error: {twitter_error}")
                # Don't fail the post creation if Twitter posting fails
        
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
        
        # Log the error for debugging
        import traceback
        print(f"[AutoPost] ERROR generating post for @{handle}:")
        print(f"[AutoPost] {str(e)}")
        traceback.print_exc()
        
        return {
            "avee_id": avee_id,
            "handle": handle,
            "success": False,
            "post_id": None,
            "error": str(e),
            "duration_seconds": duration
        }


async def generate_multiple_posts(
    avees: dict,
    topic: Optional[str],
    category: Optional[str]
):
    """Background task to generate multiple posts"""
    # This runs in background - can't return results to API
    # Could store results in database or send notifications
    
    # Import generator modules - add parent directory to path
    import sys
    import os
    parent_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    if parent_dir not in sys.path:
        sys.path.insert(0, parent_dir)
    
    from generate_daily_post import DailyPostGenerator
    from db import SessionLocal
    
    db = SessionLocal()
    generator = DailyPostGenerator(verbose=False)
    
    results = []
    
    for avee_id, handle in avees.items():
        try:
            result = await generator.generate_post_async(
                agent_handle=handle,
                topic_override=topic,
                category=category
            )
            
            # Update last_auto_post_at
            update_query = text("""
                UPDATE avees
                SET last_auto_post_at = NOW()
                WHERE id = :avee_id
            """)
            db.execute(update_query, {"avee_id": avee_id})
            db.commit()
            
            # Check if should auto-post to Twitter
            post_id = result.get("post_id")
            if post_id:
                try:
                    from twitter_posting_service import get_twitter_posting_service
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
                            
                            twitter_result = posting_service.post_to_twitter(
                                post_uuid,
                                owner_user_id,
                                db
                            )
                            
                            if twitter_result["success"]:
                                print(f"[AutoPost] Auto-posted to Twitter for @{handle}")
                            else:
                                print(f"[AutoPost] Twitter posting failed for @{handle}: {twitter_result.get('error')}")
                                
                except Exception as twitter_exc:
                    print(f"[AutoPost] Twitter auto-post error for @{handle}: {twitter_exc}")
            
            results.append({
                "avee_id": avee_id,
                "handle": handle,
                "success": True,
                "post_id": post_id
            })
            
        except Exception as e:
            results.append({
                "avee_id": avee_id,
                "handle": handle,
                "success": False,
                "error": str(e)
            })
    
    db.close()
    
    # Could log results or send notification here
    print(f"Background generation complete: {len([r for r in results if r['success']])}/{len(results)} successful")


