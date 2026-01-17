"""
Video Generation API Endpoints

Provides endpoints for generating videos using SORA 2.
"""

import uuid
import os
import sys
from typing import Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import text
from pydantic import BaseModel

# Add backend to path for imports
sys.path.insert(0, 'backend')

from backend.db import SessionLocal
from backend.auth_supabase import get_current_user_id

router = APIRouter(prefix="/video", tags=["video"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# =====================================
# PYDANTIC MODELS
# =====================================

class VideoGenerateRequest(BaseModel):
    """Request to generate a video from text prompt"""
    avee_id: str
    prompt: Optional[str] = None  # Custom prompt (optional)
    topic: Optional[str] = None  # Topic override for auto-generation
    category: Optional[str] = None
    resolution: str = "720p"  # 480p, 720p, 1080p
    video_engine: str = "sora-2-video"  # Options: "sora-2-video", "sora-2-pro"


class VideoFromImageRequest(BaseModel):
    """Request to generate video from a reference image"""
    avee_id: str
    reference_image_url: str
    animation_prompt: str  # How to animate the image
    resolution: str = "720p"
    video_engine: str = "sora-2-video"  # Options: "sora-2-video", "sora-2-pro"


class VideoPreviewRequest(BaseModel):
    """Request to generate a video preview (without saving to DB)"""
    avee_id: str
    topic: Optional[str] = None
    category: Optional[str] = None
    reference_image_url: Optional[str] = None  # For image-to-video
    feedback: Optional[str] = None  # User feedback for regeneration
    previous_preview_id: Optional[str] = None
    video_engine: str = "sora-2-video"  # Options: "sora-2-video", "sora-2-pro"


class VideoPreviewResponse(BaseModel):
    """Response containing video preview data for user approval"""
    preview_id: str
    avee_id: str
    handle: str
    display_name: Optional[str]
    avatar_url: Optional[str]
    title: str
    description: str
    video_url: str  # Temp storage URL
    thumbnail_url: Optional[str]
    duration: int
    topic: dict
    video_prompt: str
    generated_at: str


class ConfirmVideoRequest(BaseModel):
    """Request to confirm and save a previewed video"""
    preview_id: str
    avee_id: str
    title: Optional[str] = None
    description: Optional[str] = None


class CancelVideoPreviewRequest(BaseModel):
    """Request to cancel and cleanup a video preview"""
    preview_id: str
    avee_id: str


class VideoJobStatus(BaseModel):
    """Status of a video generation job"""
    job_id: str
    status: str  # pending, processing, completed, failed
    progress: Optional[int] = None  # 0-100
    video_url: Optional[str] = None
    error: Optional[str] = None


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
    
    admin_handles = os.getenv("ADMIN_HANDLES", "loic_ricci").split(",")
    return row[0] in admin_handles


def check_agent_access(avee_id: str, user_id: str, db: Session) -> tuple[str, str, str, str]:
    """
    Verify user has access to the agent and return agent info.
    
    Returns:
        Tuple of (handle, display_name, avatar_url, owner_user_id)
    
    Raises:
        HTTPException if access denied
    """
    user_uuid = uuid.UUID(user_id)
    avee_uuid = uuid.UUID(avee_id)
    is_admin = is_admin_user(str(user_uuid), db)
    
    query = text("""
        SELECT handle, display_name, avatar_url, owner_user_id
        FROM avees
        WHERE id = :avee_id
    """)
    result = db.execute(query, {"avee_id": str(avee_uuid)})
    row = result.fetchone()
    
    if not row:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    handle, display_name, avatar_url, owner_user_id = row
    
    # Check ownership if not admin
    if not is_admin and str(owner_user_id) != str(user_uuid):
        raise HTTPException(status_code=403, detail="Not authorized to generate videos for this agent")
    
    return handle, display_name, avatar_url, str(owner_user_id)


def upload_video_to_supabase(
    file_path: str,
    storage_path: str,
    content_type: str = "video/mp4"
) -> str:
    """
    Upload video file to Supabase Storage and return public URL.
    Uses 'app-videos' bucket which must be created with video MIME types allowed.
    """
    from supabase import create_client
    
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    
    if not supabase_url or not supabase_key:
        raise HTTPException(status_code=500, detail="Supabase configuration missing")
    
    supabase = create_client(supabase_url, supabase_key)
    bucket_name = "app-videos"  # Dedicated bucket for videos (must support video/mp4)
    
    # Read file content
    with open(file_path, "rb") as f:
        file_content = f.read()
    
    try:
        # Delete existing if any
        try:
            supabase.storage.from_(bucket_name).remove([storage_path])
        except:
            pass
        
        # Upload video
        supabase.storage.from_(bucket_name).upload(
            storage_path,
            file_content,
            {"content-type": content_type}
        )
        
        # Return public URL
        return supabase.storage.from_(bucket_name).get_public_url(storage_path)
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to upload video: {str(e)}")


def delete_video_from_storage(storage_path: str):
    """Delete video from Supabase storage"""
    from supabase import create_client
    
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    
    if not supabase_url or not supabase_key:
        return
    
    try:
        supabase = create_client(supabase_url, supabase_key)
        bucket_name = "app-videos"  # Dedicated bucket for videos
        supabase.storage.from_(bucket_name).remove([storage_path])
    except Exception as e:
        print(f"Warning: Failed to delete video from storage: {e}")


# In-memory cache for video previews
_video_preview_cache: dict = {}


def get_preview_video_path(preview_id: str, agent_handle: str) -> str:
    """Generate temp storage path for preview videos"""
    return f"video-previews/{agent_handle}_{preview_id}.mp4"


def get_preview_thumbnail_path(preview_id: str, agent_handle: str) -> str:
    """Generate temp storage path for preview thumbnails"""
    return f"video-previews/{agent_handle}_{preview_id}_thumb.jpg"


# =====================================
# API ENDPOINTS
# =====================================

@router.post("/preview")
async def preview_video(
    request: VideoPreviewRequest,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id)
):
    """
    Generate a video preview WITHOUT saving to database.
    Returns preview data for user approval.
    
    This is the main entry point for video generation - users see a preview
    before the video is permanently saved.
    """
    # Verify access
    handle, display_name, avatar_url, owner_user_id = check_agent_access(
        request.avee_id, user_id, db
    )
    
    # Cleanup previous preview if regenerating
    if request.previous_preview_id and request.previous_preview_id in _video_preview_cache:
        old_preview = _video_preview_cache.pop(request.previous_preview_id)
        if "storage_path" in old_preview:
            delete_video_from_storage(old_preview["storage_path"])
        if "thumbnail_storage_path" in old_preview:
            delete_video_from_storage(old_preview["thumbnail_storage_path"])
    
    # Generate preview ID
    preview_id = str(uuid.uuid4())
    
    try:
        # Import generators
        from backend.video_generator import VideoGenerator
        from backend.profile_context_loader import load_agent_context
        from backend.news_topic_fetcher import get_safe_daily_topic
        from backend.ai_prompt_generator import generate_video_prompt
        
        # 1. Load agent context
        print(f"[VideoAPI] Loading agent context for @{handle}...")
        agent_context = load_agent_context(handle)
        
        # 2. Get topic (use override if provided)
        if request.topic:
            topic = {
                "topic": request.topic,
                "category": request.category or "general",
                "source": "manual",
                "description": request.topic
            }
        else:
            print(f"[VideoAPI] Fetching daily topic...")
            topic = get_safe_daily_topic()
        
        # 3. Generate video prompt
        print(f"[VideoAPI] Generating video prompt...")
        video_prompt = generate_video_prompt(
            agent_context, 
            topic, 
            feedback=request.feedback
        )
        
        # 4. Generate title and description
        title = f"🎬 {topic.get('topic', 'New Video')}"
        description = f"{agent_context.get('display_name', handle)} shares thoughts on {topic.get('topic', 'this topic')}."
        
        # 5. Generate video
        video_engine = getattr(request, 'video_engine', 'sora-2-video')
        is_pro = video_engine == "sora-2-pro"
        engine_label = "SORA 2 Pro" if is_pro else "SORA 2"
        print(f"[VideoAPI] Generating video with {engine_label}...")
        generator = VideoGenerator()
        
        if request.reference_image_url:
            # Image-to-video
            if is_pro:
                video_path = generator.generate_video_from_image_pro(
                    reference_image_url=request.reference_image_url,
                    prompt=video_prompt,
                    agent_handle=handle
                )
            else:
                video_path = generator.generate_video_from_image(
                    reference_image_url=request.reference_image_url,
                    prompt=video_prompt,
                    agent_handle=handle
                )
        else:
            # Text-to-video
            if is_pro:
                video_path = generator.generate_video_pro(
                    prompt=video_prompt,
                    agent_handle=handle
                )
            else:
                video_path = generator.generate_video(
                    prompt=video_prompt,
                    agent_handle=handle
                )
        
        # 6. Extract thumbnail
        thumbnail_path = generator.extract_thumbnail(video_path)
        
        # 7. Upload to temp storage
        storage_path = get_preview_video_path(preview_id, handle)
        video_url = upload_video_to_supabase(video_path, storage_path)
        
        thumbnail_url = None
        thumbnail_storage_path = None
        if thumbnail_path:
            thumbnail_storage_path = get_preview_thumbnail_path(preview_id, handle)
            thumbnail_url = upload_video_to_supabase(
                thumbnail_path, thumbnail_storage_path, "image/jpeg"
            )
        
        # 8. Store preview data in cache
        _video_preview_cache[preview_id] = {
            "avee_id": request.avee_id,
            "handle": handle,
            "display_name": display_name,
            "avatar_url": avatar_url,
            "title": title,
            "description": description,
            "video_url": video_url,
            "video_path": video_path,
            "storage_path": storage_path,
            "thumbnail_url": thumbnail_url,
            "thumbnail_path": thumbnail_path,
            "thumbnail_storage_path": thumbnail_storage_path,
            "duration": int(VideoGenerator.DURATION),
            "topic": topic,
            "video_prompt": video_prompt,
            "generated_at": datetime.now().isoformat(),
            "user_id": user_id
        }
        
        return VideoPreviewResponse(
            preview_id=preview_id,
            avee_id=request.avee_id,
            handle=handle,
            display_name=display_name,
            avatar_url=avatar_url,
            title=title,
            description=description,
            video_url=video_url,
            thumbnail_url=thumbnail_url,
            duration=int(VideoGenerator.DURATION),
            topic=topic,
            video_prompt=video_prompt,
            generated_at=datetime.now().isoformat()
        )
        
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        print(f"[VideoAPI] ERROR: {str(e)}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Video preview generation failed: {str(e)}")


@router.post("/confirm")
async def confirm_video(
    request: ConfirmVideoRequest,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id)
):
    """
    Confirm and save a previewed video to the database.
    Moves video from temp to permanent storage.
    """
    # Handle duplicate requests
    if not hasattr(confirm_video, '_confirmed_previews'):
        confirm_video._confirmed_previews = {}
    
    if request.preview_id in confirm_video._confirmed_previews:
        return confirm_video._confirmed_previews[request.preview_id]
    
    # Get preview data
    if request.preview_id not in _video_preview_cache:
        raise HTTPException(status_code=404, detail="Video preview not found or expired")
    
    preview = _video_preview_cache[request.preview_id]
    
    # Validate user owns this preview
    if preview["user_id"] != user_id:
        is_admin = is_admin_user(user_id, db)
        if not is_admin:
            raise HTTPException(status_code=403, detail="Not authorized to confirm this preview")
    
    # Validate avee_id matches
    if preview["avee_id"] != request.avee_id:
        raise HTTPException(status_code=400, detail="Agent ID mismatch")
    
    try:
        from backend.post_creation_service import create_video_post_from_preview
        
        # Use edited title/description if provided
        final_title = request.title if request.title else preview["title"]
        final_description = request.description if request.description else preview["description"]
        
        # Move video to permanent storage
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        permanent_path = f"videos/{preview['handle']}/post_{timestamp}.mp4"
        
        from supabase import create_client
        supabase_url = os.getenv("SUPABASE_URL")
        supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        supabase = create_client(supabase_url, supabase_key)
        bucket_name = "app-videos"  # Dedicated bucket for videos
        
        # Download from preview location
        video_data = supabase.storage.from_(bucket_name).download(preview["storage_path"])
        
        # Upload to permanent location
        supabase.storage.from_(bucket_name).upload(
            permanent_path,
            video_data,
            {"content-type": "video/mp4"}
        )
        
        permanent_url = supabase.storage.from_(bucket_name).get_public_url(permanent_path)
        
        # Handle thumbnail
        thumbnail_permanent_url = None
        if preview.get("thumbnail_storage_path"):
            thumb_permanent_path = f"videos/{preview['handle']}/post_{timestamp}_thumb.jpg"
            thumb_data = supabase.storage.from_(bucket_name).download(preview["thumbnail_storage_path"])
            supabase.storage.from_(bucket_name).upload(
                thumb_permanent_path,
                thumb_data,
                {"content-type": "image/jpeg"}
            )
            thumbnail_permanent_url = supabase.storage.from_(bucket_name).get_public_url(thumb_permanent_path)
        
        # Delete preview files
        delete_video_from_storage(preview["storage_path"])
        if preview.get("thumbnail_storage_path"):
            delete_video_from_storage(preview["thumbnail_storage_path"])
        
        # Create post in database
        post_result = create_video_post_from_preview(
            agent_handle=preview["handle"],
            video_url=permanent_url,
            thumbnail_url=thumbnail_permanent_url,
            duration=preview["duration"],
            title=final_title,
            description=final_description,
            topic=preview["topic"],
            video_prompt=preview["video_prompt"],
            visibility="public"
        )
        
        # Update last_auto_post_at
        avee_uuid = uuid.UUID(preview["avee_id"])
        update_query = text("""
            UPDATE avees
            SET last_auto_post_at = NOW()
            WHERE id = :avee_id
        """)
        db.execute(update_query, {"avee_id": str(avee_uuid)})
        db.commit()
        
        # Remove from cache
        del _video_preview_cache[request.preview_id]
        
        result = {
            "success": True,
            "post_id": post_result["post_id"],
            "video_url": permanent_url,
            "thumbnail_url": thumbnail_permanent_url,
            "view_url": post_result.get("view_url", f"/posts/{post_result['post_id']}")
        }
        
        # Cache result for duplicate handling
        confirm_video._confirmed_previews[request.preview_id] = result
        
        # Cleanup old confirmed previews
        if len(confirm_video._confirmed_previews) > 100:
            keys_to_remove = list(confirm_video._confirmed_previews.keys())[:-100]
            for key in keys_to_remove:
                del confirm_video._confirmed_previews[key]
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        print(f"[VideoAPI] Confirm ERROR: {str(e)}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to confirm video: {str(e)}")


@router.post("/cancel")
async def cancel_video_preview(
    request: CancelVideoPreviewRequest,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id)
):
    """
    Cancel a video preview and cleanup temp storage.
    """
    # Get preview data
    if request.preview_id not in _video_preview_cache:
        return {"success": True, "message": "Preview already cancelled or expired"}
    
    preview = _video_preview_cache[request.preview_id]
    
    # Validate user owns this preview
    if preview["user_id"] != user_id:
        is_admin = is_admin_user(user_id, db)
        if not is_admin:
            raise HTTPException(status_code=403, detail="Not authorized to cancel this preview")
    
    # Delete temp files
    if "storage_path" in preview:
        delete_video_from_storage(preview["storage_path"])
    if "thumbnail_storage_path" in preview:
        delete_video_from_storage(preview["thumbnail_storage_path"])
    
    # Remove from cache
    del _video_preview_cache[request.preview_id]
    
    return {"success": True, "message": "Video preview cancelled"}


@router.post("/generate")
async def generate_video_direct(
    request: VideoGenerateRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id)
):
    """
    Generate a video directly (without preview workflow).
    Used primarily for auto-post and background generation.
    """
    # Verify access
    handle, display_name, avatar_url, owner_user_id = check_agent_access(
        request.avee_id, user_id, db
    )
    
    try:
        from backend.video_generator import VideoGenerator
        from backend.profile_context_loader import load_agent_context
        from backend.news_topic_fetcher import get_safe_daily_topic
        from backend.ai_prompt_generator import generate_video_prompt
        from backend.post_creation_service import create_video_post
        
        # 1. Load agent context
        agent_context = load_agent_context(handle)
        
        # 2. Get topic
        if request.topic:
            topic = {
                "topic": request.topic,
                "category": request.category or "general",
                "source": "manual",
                "description": request.topic
            }
        else:
            topic = get_safe_daily_topic()
        
        # 3. Generate video prompt
        video_prompt = generate_video_prompt(agent_context, topic)
        
        # 4. Generate video
        video_engine = getattr(request, 'video_engine', 'sora-2-video')
        is_pro = video_engine == "sora-2-pro"
        engine_label = "SORA 2 Pro" if is_pro else "SORA 2"
        print(f"[VideoAPI] Generating video with {engine_label}...")
        
        generator = VideoGenerator()
        if is_pro:
            video_path = generator.generate_video_pro(
                prompt=video_prompt,
                agent_handle=handle,
                resolution=request.resolution
            )
            duration = int(generator.PRO_DURATION)
        else:
            video_path = generator.generate_video(
                prompt=video_prompt,
                agent_handle=handle,
                resolution=request.resolution
            )
            duration = int(VideoGenerator.DURATION)
        
        # 5. Extract thumbnail
        thumbnail_path = generator.extract_thumbnail(video_path)
        
        # 6. Generate title and description
        title = f"🎬 {topic.get('topic', 'New Video')}"
        description = f"{agent_context.get('display_name', handle)} shares thoughts on {topic.get('topic', 'this topic')}."
        
        # 7. Create post
        post_result = create_video_post(
            agent_handle=handle,
            video_path=video_path,
            thumbnail_path=thumbnail_path,
            duration=duration,
            title=title,
            description=description,
            topic=topic,
            video_prompt=video_prompt,
            visibility="public",
            engine=video_engine
        )
        
        # Update last_auto_post_at
        update_query = text("""
            UPDATE avees
            SET last_auto_post_at = NOW()
            WHERE id = :avee_id
        """)
        db.execute(update_query, {"avee_id": request.avee_id})
        db.commit()
        
        return {
            "success": True,
            "post_id": post_result["post_id"],
            "video_url": post_result["video_url"],
            "thumbnail_url": post_result.get("thumbnail_url"),
            "view_url": post_result.get("view_url")
        }
        
    except Exception as e:
        import traceback
        print(f"[VideoAPI] Direct generation ERROR: {str(e)}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Video generation failed: {str(e)}")


@router.post("/generate-from-image")
async def generate_video_from_image(
    request: VideoFromImageRequest,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id)
):
    """
    Generate a video by animating a reference image.
    """
    # Verify access
    handle, display_name, avatar_url, owner_user_id = check_agent_access(
        request.avee_id, user_id, db
    )
    
    try:
        from backend.video_generator import VideoGenerator
        from backend.post_creation_service import create_video_post
        
        # Generate video with selected engine
        video_engine = getattr(request, 'video_engine', 'sora-2-video')
        is_pro = video_engine == "sora-2-pro"
        engine_label = "SORA 2 Pro" if is_pro else "SORA 2"
        print(f"[VideoAPI] Generating image-to-video with {engine_label}...")
        
        generator = VideoGenerator()
        if is_pro:
            video_path = generator.generate_video_from_image_pro(
                reference_image_url=request.reference_image_url,
                prompt=request.animation_prompt,
                agent_handle=handle,
                resolution=request.resolution
            )
            duration = int(generator.PRO_DURATION)
        else:
            video_path = generator.generate_video_from_image(
                reference_image_url=request.reference_image_url,
                prompt=request.animation_prompt,
                agent_handle=handle,
                resolution=request.resolution
            )
            duration = int(VideoGenerator.DURATION)
        
        # Extract thumbnail
        thumbnail_path = generator.extract_thumbnail(video_path)
        
        # Create post
        topic = {
            "topic": "Image Animation",
            "category": "creative",
            "source": "image-to-video"
        }
        
        post_result = create_video_post(
            agent_handle=handle,
            video_path=video_path,
            thumbnail_path=thumbnail_path,
            duration=duration,
            title="🎬 Animated Image",
            description=request.animation_prompt,
            topic=topic,
            video_prompt=request.animation_prompt,
            visibility="public",
            engine=video_engine
        )
        
        return {
            "success": True,
            "post_id": post_result["post_id"],
            "video_url": post_result["video_url"],
            "thumbnail_url": post_result.get("thumbnail_url"),
            "view_url": post_result.get("view_url")
        }
        
    except Exception as e:
        import traceback
        print(f"[VideoAPI] Image-to-video ERROR: {str(e)}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Video generation failed: {str(e)}")
