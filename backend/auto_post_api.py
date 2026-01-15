"""
Auto Post Generation API Endpoints

Provides endpoints for managing and triggering auto post generation.
"""

import uuid
import os
import sys
from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, UploadFile, File, Form
from sqlalchemy.orm import Session
from sqlalchemy import text
from pydantic import BaseModel
from PIL import Image
import io

# Add backend to path for imports
sys.path.insert(0, 'backend')

from backend.db import SessionLocal
from backend.auth_supabase import get_current_user_id

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
    image_engine: str = "dall-e-3"  # Options: "dall-e-3" or "gpt-image-1" (openai-edits deprecated)
    image_style: Optional[str] = None  # Optional image style: realistic, cartoon, anime, futuristic, illustration, 3d_render, sketch, fantasy
    reference_image_url: Optional[str] = None  # User-selected reference image URL for image editing


class ReferenceImageInfo(BaseModel):
    avee_id: str
    handle: str
    reference_image_url: Optional[str]
    reference_image_mask_url: Optional[str]
    image_edit_instructions: Optional[str]
    has_reference_images: bool


class GenerationResult(BaseModel):
    avee_id: str
    handle: str
    success: bool
    post_id: Optional[str] = None
    error: Optional[str] = None
    duration_seconds: Optional[float] = None


# =====================================
# POST PREVIEW/APPROVAL MODELS
# =====================================

class PreviewPostRequest(BaseModel):
    """Request to generate a post preview (without saving to DB)"""
    avee_id: str
    topic: Optional[str] = None
    category: Optional[str] = None
    image_engine: str = "dall-e-3"
    image_style: Optional[str] = None  # Optional image style: realistic, cartoon, anime, futuristic, illustration, 3d_render, sketch, fantasy
    reference_image_url: Optional[str] = None
    feedback: Optional[str] = None  # User feedback for regeneration
    previous_preview_id: Optional[str] = None  # If regenerating, cleanup old preview


class PreviewPostResponse(BaseModel):
    """Response containing preview data for user approval"""
    preview_id: str  # Unique ID for this preview session
    avee_id: str
    handle: str
    display_name: Optional[str]
    avatar_url: Optional[str]
    title: str
    description: str
    image_url: str  # Temp storage URL
    topic: dict
    image_prompt: str
    image_engine: str
    generated_at: str


class ConfirmPostRequest(BaseModel):
    """Request to confirm and save a previewed post"""
    preview_id: str
    avee_id: str
    # Allow optional edits before saving
    title: Optional[str] = None
    description: Optional[str] = None


class CancelPreviewRequest(BaseModel):
    """Request to cancel and cleanup a preview"""
    preview_id: str
    avee_id: str


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
    is_admin = row[0] in admin_handles
    return is_admin


def get_user_avees(user_id: str, db: Session, is_admin: bool) -> List[dict]:
    """Get avees accessible to user - OPTIMIZED: Uses batch query instead of N+1"""
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
    
    # Collect all avee IDs for batch query
    avee_ids = [str(row.avee_id) for row in rows]
    
    # OPTIMIZATION: Fetch ALL reference images in a single batch query instead of N+1 queries
    ref_images_by_avee = {}
    if avee_ids:
        # Use a single query with IN clause to get all reference images at once
        # Use CAST function (not :: operator) to avoid conflict with SQLAlchemy's :param syntax
        ref_images_query = text("""
            SELECT 
                avee_id,
                id,
                reference_image_url,
                mask_image_url,
                is_primary
            FROM reference_images
            WHERE avee_id = ANY(CAST(:avee_ids AS uuid[]))
            ORDER BY avee_id, is_primary DESC, created_at DESC
        """)
        ref_result = db.execute(ref_images_query, {"avee_ids": avee_ids})
        ref_rows = ref_result.fetchall()
        
        # Group reference images by avee_id in memory
        for ref_row in ref_rows:
            avee_id = str(ref_row[0])
            if avee_id not in ref_images_by_avee:
                ref_images_by_avee[avee_id] = []
            ref_images_by_avee[avee_id].append({
                "id": str(ref_row[1]),
                "reference_image_url": ref_row[2],
                "mask_image_url": ref_row[3],
                "is_primary": ref_row[4]
            })
    
    # Build the response using the pre-fetched reference images
    avees = []
    for row in rows:
        avee_id = str(row.avee_id)
        
        avees.append({
            "avee_id": avee_id,
            "handle": row.handle,
            "display_name": row.display_name,
            "avatar_url": row.avatar_url,
            "auto_post_enabled": row.auto_post_enabled,
            "last_auto_post_at": row.last_auto_post_at.isoformat() if row.last_auto_post_at else None,
            "auto_post_settings": row.auto_post_settings,
            "reference_images": ref_images_by_avee.get(avee_id, [])
        })
    
    return avees


def upload_to_supabase_storage(
    file_content: bytes,
    file_path: str,
    content_type: str = "image/png"
) -> str:
    """
    Upload file to Supabase Storage and return public URL.
    
    Args:
        file_content: Binary file content
        file_path: Path in storage bucket (e.g., "agent_id/reference.png")
        content_type: MIME type
    
    Returns:
        Public URL of uploaded file
    """
    from supabase import create_client
    
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    
    if not supabase_url or not supabase_key:
        raise HTTPException(
            status_code=500,
            detail="Supabase configuration missing"
        )
    
    supabase = create_client(supabase_url, supabase_key)
    
    # Upload to agent-reference-images bucket
    bucket_name = "agent-reference-images"
    
    try:
        # Delete existing file if it exists (overwrite)
        try:
            supabase.storage.from_(bucket_name).remove([file_path])
        except:
            pass  # File doesn't exist yet
        
        # Upload new file
        supabase.storage.from_(bucket_name).upload(
            file_path,
            file_content,
            {"content-type": content_type}
        )
        
        # Get public URL
        public_url = supabase.storage.from_(bucket_name).get_public_url(file_path)
        
        return public_url
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to upload to Supabase Storage: {str(e)}"
        )


def validate_png_image(file_content: bytes) -> tuple[int, int]:
    """
    Validate that file is a valid PNG and return dimensions.
    
    Returns:
        Tuple of (width, height)
    
    Raises:
        HTTPException if invalid
    """
    try:
        image = Image.open(io.BytesIO(file_content))
        
        if image.format != "PNG":
            raise HTTPException(
                status_code=400,
                detail=f"Image must be PNG format, got {image.format}"
            )
        
        width, height = image.size
        
        # Check size limits (OpenAI requires square images, max 4MB)
        if width != height:
            raise HTTPException(
                status_code=400,
                detail=f"Image must be square (same width and height), got {width}x{height}"
            )
        
        if len(file_content) > 4 * 1024 * 1024:  # 4MB
            raise HTTPException(
                status_code=400,
                detail="Image size must be less than 4MB"
            )
        
        return width, height
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid image file: {str(e)}"
        )


# =====================================
# REFERENCE IMAGE MANAGEMENT ENDPOINTS
# =====================================

@router.get("/agents/{avee_id}/reference-images")
def get_reference_images(
    avee_id: str,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id)
):
    """
    Get all reference images for an agent.
    Returns a list of reference images with their metadata.
    """
    user_uuid = uuid.UUID(user_id)
    avee_uuid = uuid.UUID(avee_id)
    is_admin = is_admin_user(str(user_uuid), db)
    
    # Check ownership if not admin
    if not is_admin:
        check_query = text("""
            SELECT owner_user_id FROM avees WHERE id = :avee_id
        """)
        result = db.execute(check_query, {"avee_id": str(avee_uuid)})
        row = result.fetchone()
        
        if not row or str(row[0]) != str(user_uuid):
            raise HTTPException(status_code=403, detail="Not authorized to view this agent")
    
    # Get all reference images for this agent
    query = text("""
        SELECT 
            id,
            reference_image_url,
            mask_image_url,
            edit_instructions,
            image_dimensions,
            is_primary,
            created_at
        FROM reference_images
        WHERE avee_id = :avee_id
        ORDER BY is_primary DESC, created_at DESC
    """)
    
    result = db.execute(query, {"avee_id": str(avee_uuid)})
    rows = result.fetchall()
    
    images = []
    for row in rows:
        images.append({
            "id": str(row[0]),
            "reference_image_url": row[1],
            "mask_image_url": row[2],
            "edit_instructions": row[3],
            "image_dimensions": row[4],
            "is_primary": row[5],
            "created_at": row[6].isoformat() if row[6] else None
        })
    
    return {
        "avee_id": str(avee_uuid),
        "images": images,
        "total_count": len(images),
        "has_reference_images": len(images) > 0
    }


@router.post("/agents/{avee_id}/reference-images/upload")
async def upload_reference_images(
    avee_id: str,
    reference_image: UploadFile = File(...),
    mask_image: Optional[UploadFile] = File(None),
    edit_instructions: Optional[str] = Form(None),
    is_primary: Optional[bool] = Form(False),
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id)
):
    """
    Upload a new reference image and optional mask for OpenAI Image Edits.
    This now adds to the collection of reference images instead of replacing.
    
    - Reference image is REQUIRED (PNG, square, max 4MB)
    - Mask image is OPTIONAL (PNG, must match reference dimensions if provided)
    - Edit instructions are OPTIONAL
    - is_primary: if true, sets this as the primary image (un-sets any existing primary)
    """
    user_uuid = uuid.UUID(user_id)
    avee_uuid = uuid.UUID(avee_id)
    is_admin = is_admin_user(str(user_uuid), db)
    
    # Check ownership if not admin
    if not is_admin:
        check_query = text("""
            SELECT owner_user_id, handle FROM avees WHERE id = :avee_id
        """)
        result = db.execute(check_query, {"avee_id": str(avee_uuid)})
        row = result.fetchone()
        
        if not row or str(row[0]) != str(user_uuid):
            raise HTTPException(status_code=403, detail="Not authorized to modify this agent")
        
        agent_handle = row[1]
    else:
        # Get handle for admin
        handle_query = text("SELECT handle FROM avees WHERE id = :avee_id")
        result = db.execute(handle_query, {"avee_id": str(avee_uuid)})
        row = result.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Agent not found")
        agent_handle = row[0]
    
    # Read and validate reference image
    reference_content = await reference_image.read()
    ref_width, ref_height = validate_png_image(reference_content)
    
    # Generate unique filename with timestamp
    import time
    timestamp = int(time.time() * 1000)
    reference_path = f"{str(avee_uuid)}/reference_{timestamp}.png"
    reference_url = upload_to_supabase_storage(
        reference_content,
        reference_path,
        "image/png"
    )
    
    mask_url = None
    
    # Process mask image if provided
    if mask_image:
        mask_content = await mask_image.read()
        mask_width, mask_height = validate_png_image(mask_content)
        
        # Validate dimensions match
        if mask_width != ref_width or mask_height != ref_height:
            raise HTTPException(
                status_code=400,
                detail=f"Mask dimensions ({mask_width}x{mask_height}) must match reference dimensions ({ref_width}x{ref_height})"
            )
        
        # Upload mask image
        mask_path = f"{str(avee_uuid)}/mask_{timestamp}.png"
        mask_url = upload_to_supabase_storage(
            mask_content,
            mask_path,
            "image/png"
        )
    
    # If this is set as primary, unset any existing primary
    if is_primary:
        unset_primary_query = text("""
            UPDATE reference_images
            SET is_primary = false
            WHERE avee_id = :avee_id AND is_primary = true
        """)
        db.execute(unset_primary_query, {"avee_id": str(avee_uuid)})
    
    # Insert new reference image record
    insert_query = text("""
        INSERT INTO reference_images (
            id, avee_id, reference_image_url, mask_image_url, 
            edit_instructions, image_dimensions, is_primary
        )
        VALUES (
            :id, :avee_id, :reference_url, :mask_url,
            :instructions, :dimensions, :is_primary
        )
        RETURNING id
    """)
    
    new_id = str(uuid.uuid4())
    result = db.execute(insert_query, {
        "id": new_id,
        "avee_id": str(avee_uuid),
        "reference_url": reference_url,
        "mask_url": mask_url,
        "instructions": edit_instructions,
        "dimensions": f"{ref_width}x{ref_height}",
        "is_primary": is_primary
    })
    
    db.commit()
    
    return {
        "success": True,
        "id": new_id,
        "avee_id": str(avee_uuid),
        "handle": agent_handle,
        "reference_image_url": reference_url,
        "mask_image_url": mask_url,
        "edit_instructions": edit_instructions,
        "image_dimensions": f"{ref_width}x{ref_height}",
        "is_primary": is_primary
    }


@router.delete("/agents/{avee_id}/reference-images/{image_id}")
def delete_reference_image(
    avee_id: str,
    image_id: str,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id)
):
    """
    Delete a specific reference image for an agent.
    """
    user_uuid = uuid.UUID(user_id)
    avee_uuid = uuid.UUID(avee_id)
    image_uuid = uuid.UUID(image_id)
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
    
    # Get image URLs before deleting
    get_query = text("""
        SELECT reference_image_url, mask_image_url
        FROM reference_images
        WHERE id = :image_id AND avee_id = :avee_id
    """)
    result = db.execute(get_query, {"image_id": str(image_uuid), "avee_id": str(avee_uuid)})
    row = result.fetchone()
    
    if not row:
        raise HTTPException(status_code=404, detail="Reference image not found")
    
    reference_url = row[0]
    mask_url = row[1]
    
    # Delete from Supabase Storage
    from supabase import create_client
    
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    
    if supabase_url and supabase_key:
        try:
            supabase = create_client(supabase_url, supabase_key)
            bucket_name = "agent-reference-images"
            
            # Extract paths from URLs and delete
            files_to_delete = []
            if reference_url:
                # Extract path from URL
                ref_path = reference_url.split(f"{bucket_name}/")[-1]
                files_to_delete.append(ref_path)
            if mask_url:
                mask_path = mask_url.split(f"{bucket_name}/")[-1]
                files_to_delete.append(mask_path)
            
            if files_to_delete:
                supabase.storage.from_(bucket_name).remove(files_to_delete)
        except Exception as e:
            # Log but don't fail if storage deletion fails
            print(f"Warning: Failed to delete from storage: {e}")
    
    # Delete from database
    delete_query = text("""
        DELETE FROM reference_images
        WHERE id = :image_id AND avee_id = :avee_id
        RETURNING id
    """)
    
    result = db.execute(delete_query, {"image_id": str(image_uuid), "avee_id": str(avee_uuid)})
    
    if not result.fetchone():
        raise HTTPException(status_code=404, detail="Reference image not found")
    
    db.commit()
    
    return {
        "success": True,
        "avee_id": str(avee_uuid),
        "image_id": str(image_uuid),
        "message": "Reference image deleted successfully"
    }


@router.patch("/agents/{avee_id}/reference-images/{image_id}/set-primary")
def set_primary_reference_image(
    avee_id: str,
    image_id: str,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id)
):
    """
    Set a reference image as the primary/default image for an agent.
    """
    user_uuid = uuid.UUID(user_id)
    avee_uuid = uuid.UUID(avee_id)
    image_uuid = uuid.UUID(image_id)
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
    
    # Verify image exists and belongs to this agent
    verify_query = text("""
        SELECT id FROM reference_images
        WHERE id = :image_id AND avee_id = :avee_id
    """)
    result = db.execute(verify_query, {"image_id": str(image_uuid), "avee_id": str(avee_uuid)})
    
    if not result.fetchone():
        raise HTTPException(status_code=404, detail="Reference image not found")
    
    # Unset any existing primary
    unset_query = text("""
        UPDATE reference_images
        SET is_primary = false
        WHERE avee_id = :avee_id AND is_primary = true
    """)
    db.execute(unset_query, {"avee_id": str(avee_uuid)})
    
    # Set new primary
    set_query = text("""
        UPDATE reference_images
        SET is_primary = true
        WHERE id = :image_id
    """)
    db.execute(set_query, {"image_id": str(image_uuid)})
    
    db.commit()
    
    return {
        "success": True,
        "avee_id": str(avee_uuid),
        "image_id": str(image_uuid),
        "message": "Primary reference image updated successfully"
    }


@router.delete("/agents/{avee_id}/reference-images")
def delete_all_reference_images(
    avee_id: str,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id)
):
    """
    Delete ALL reference images for an agent.
    """
    user_uuid = uuid.UUID(user_id)
    avee_uuid = uuid.UUID(avee_id)
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
    
    # Get all image URLs before deleting
    get_query = text("""
        SELECT reference_image_url, mask_image_url
        FROM reference_images
        WHERE avee_id = :avee_id
    """)
    result = db.execute(get_query, {"avee_id": str(avee_uuid)})
    rows = result.fetchall()
    
    # Delete from Supabase Storage
    from supabase import create_client
    
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    
    if supabase_url and supabase_key and rows:
        try:
            supabase = create_client(supabase_url, supabase_key)
            bucket_name = "agent-reference-images"
            
            files_to_delete = []
            for row in rows:
                reference_url = row[0]
                mask_url = row[1]
                
                if reference_url:
                    ref_path = reference_url.split(f"{bucket_name}/")[-1]
                    files_to_delete.append(ref_path)
                if mask_url:
                    mask_path = mask_url.split(f"{bucket_name}/")[-1]
                    files_to_delete.append(mask_path)
            
            if files_to_delete:
                supabase.storage.from_(bucket_name).remove(files_to_delete)
        except Exception as e:
            # Log but don't fail if storage deletion fails
            print(f"Warning: Failed to delete from storage: {e}")
    
    # Delete all from database
    delete_query = text("""
        DELETE FROM reference_images
        WHERE avee_id = :avee_id
    """)
    
    db.execute(delete_query, {"avee_id": str(avee_uuid)})
    db.commit()
    
    return {
        "success": True,
        "avee_id": str(avee_uuid),
        "message": "All reference images deleted successfully",
        "deleted_count": len(rows)
    }


# =====================================
# AUTO POST GENERATION ENDPOINTS
# =====================================


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
            image_engine=request.image_engine,  # Pass image engine
            image_style=request.image_style,  # Pass image style
            reference_image_url=request.reference_image_url,  # Pass selected reference image
            db=db
        )
        
        # If generation failed, return error status
        if not result["success"]:
            raise HTTPException(
                status_code=500,
                detail=result.get("error", "Post generation failed")
            )
        
        return {
            "status": "completed",
            "results": [result],
            "total": 1,
            "successful": 1
        }
    
    # Multiple agents - run in background
    background_tasks.add_task(
        generate_multiple_posts,
        avees_to_generate,
        request.topic,
        request.category,
        request.image_engine,  # Pass image engine
        request.image_style,  # Pass image style
        request.reference_image_url  # Pass selected reference image
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
    image_engine: str,
    image_style: Optional[str],  # Image style: realistic, cartoon, anime, etc.
    reference_image_url: Optional[str],  # User-selected reference image
    db: Session
) -> dict:
    """Generate a single post for an agent"""
    start_time = datetime.now()
    
    try:
        # Import generator module (now part of the backend package)
        from .generate_daily_post import DailyPostGenerator
        
        generator = DailyPostGenerator(verbose=False)
        result = await generator.generate_post_async(
            agent_handle=handle,
            topic_override=topic,
            category=category,
            image_engine=image_engine,  # Pass image engine selection
            image_style=image_style,  # Pass image style selection
            reference_image_url_override=reference_image_url  # Pass user-selected reference image
        )
        
        # Check if generation was successful
        if not result.get("success", True):
            # Generation failed, return error immediately
            duration = (datetime.now() - start_time).total_seconds()
            return {
                "avee_id": avee_id,
                "handle": handle,
                "success": False,
                "post_id": None,
                "error": result.get("error", "Unknown error during post generation"),
                "duration_seconds": duration
            }
        
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
        
        # Check if should auto-post to LinkedIn
        linkedin_url = None
        linkedin_error = None
        
        if post_id:
            try:
                from linkedin_posting_service import get_linkedin_posting_service
                linkedin_service = get_linkedin_posting_service()
                
                # Check if agent should auto-post to LinkedIn
                avee_uuid = uuid.UUID(avee_id)
                if linkedin_service.should_auto_post(avee_uuid, db):
                    # Get agent owner
                    avee_query = text("""
                        SELECT owner_user_id FROM avees WHERE id = :avee_id
                    """)
                    avee_result = db.execute(avee_query, {"avee_id": avee_id})
                    avee_row = avee_result.fetchone()
                    
                    if avee_row:
                        owner_user_id = avee_row[0]
                        post_uuid = uuid.UUID(post_id)
                        
                        # Attempt to post to LinkedIn
                        linkedin_result = linkedin_service.post_to_linkedin(
                            post_uuid,
                            owner_user_id,
                            db
                        )
                        
                        if linkedin_result["success"]:
                            linkedin_url = linkedin_result.get("linkedin_url")
                            print(f"[AutoPost] Auto-posted to LinkedIn: {linkedin_url}")
                        else:
                            linkedin_error = linkedin_result.get("error")
                            print(f"[AutoPost] Failed to auto-post to LinkedIn: {linkedin_error}")
                            
            except Exception as linkedin_exc:
                linkedin_error = str(linkedin_exc)
                print(f"[AutoPost] LinkedIn auto-post error: {linkedin_error}")
                # Don't fail the post creation if LinkedIn posting fails
        
        duration = (datetime.now() - start_time).total_seconds()
        
        return {
            "avee_id": avee_id,
            "handle": handle,
            "success": True,
            "post_id": post_id,
            "twitter_url": twitter_url,
            "twitter_error": twitter_error,
            "linkedin_url": linkedin_url,
            "linkedin_error": linkedin_error,
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
    category: Optional[str],
    image_engine: str,  # Accept image engine parameter
    image_style: Optional[str],  # Accept image style parameter
    reference_image_url: Optional[str]  # Accept reference image URL
):
    """Background task to generate multiple posts"""
    # This runs in background - can't return results to API
    # Could store results in database or send notifications
    
    # Import generator module (now part of the backend package)
    from .generate_daily_post import DailyPostGenerator
    from .db import SessionLocal
    
    db = SessionLocal()
    generator = DailyPostGenerator(verbose=False)
    
    results = []
    
    for avee_id, handle in avees.items():
        try:
            result = await generator.generate_post_async(
                agent_handle=handle,
                topic_override=topic,
                category=category,
                image_engine=image_engine,  # Pass image engine
                image_style=image_style,  # Pass image style
                reference_image_url_override=reference_image_url  # Pass reference image
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
                
                # Check if should auto-post to LinkedIn
                try:
                    from linkedin_posting_service import get_linkedin_posting_service
                    linkedin_service = get_linkedin_posting_service()
                    
                    if linkedin_service.should_auto_post(avee_uuid, db):
                        linkedin_result = linkedin_service.post_to_linkedin(
                            post_uuid,
                            owner_user_id,
                            db
                        )
                        
                        if linkedin_result["success"]:
                            print(f"[AutoPost] Auto-posted to LinkedIn for @{handle}")
                        else:
                            print(f"[AutoPost] LinkedIn posting failed for @{handle}: {linkedin_result.get('error')}")
                            
                except Exception as linkedin_exc:
                    print(f"[AutoPost] LinkedIn auto-post error for @{handle}: {linkedin_exc}")
            
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


# =====================================
# POST PREVIEW/APPROVAL ENDPOINTS
# =====================================

# In-memory store for preview data (in production, use Redis or similar)
# Preview data expires after 24 hours
_preview_cache: dict = {}


def _get_preview_image_path(preview_id: str, agent_handle: str) -> str:
    """Generate temp storage path for preview images"""
    return f"post-previews/{agent_handle}_{preview_id}.png"


def _upload_preview_image_to_storage(local_path: str, storage_path: str) -> str:
    """Upload image to Supabase temp storage and return URL"""
    from supabase import create_client
    
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    
    if not supabase_url or not supabase_key:
        raise HTTPException(status_code=500, detail="Supabase configuration missing")
    
    supabase = create_client(supabase_url, supabase_key)
    bucket_name = "app-images"  # Use existing bucket with subfolder
    
    # Read file content
    with open(local_path, "rb") as f:
        file_content = f.read()
    
    try:
        # Delete existing if any
        try:
            supabase.storage.from_(bucket_name).remove([storage_path])
        except:
            pass
        
        # Upload to temp location
        supabase.storage.from_(bucket_name).upload(
            storage_path,
            file_content,
            {"content-type": "image/png"}
        )
        
        # Return public URL
        return supabase.storage.from_(bucket_name).get_public_url(storage_path)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to upload preview image: {str(e)}")


def _delete_preview_image(storage_path: str):
    """Delete preview image from temp storage"""
    from supabase import create_client
    
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    
    if not supabase_url or not supabase_key:
        return
    
    try:
        supabase = create_client(supabase_url, supabase_key)
        bucket_name = "app-images"  # Fixed: use correct bucket name
        supabase.storage.from_(bucket_name).remove([storage_path])
    except Exception as e:
        print(f"Warning: Failed to delete preview image: {e}")


def _move_preview_to_permanent(preview_storage_path: str, permanent_path: str) -> str:
    """Move image from preview location to permanent storage"""
    from supabase import create_client
    
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    
    if not supabase_url or not supabase_key:
        raise HTTPException(status_code=500, detail="Supabase configuration missing")
    
    supabase = create_client(supabase_url, supabase_key)
    bucket_name = "app-images"  # Fixed: use correct bucket name
    
    try:
        # Download from preview location
        response = supabase.storage.from_(bucket_name).download(preview_storage_path)
        
        # Upload to permanent location
        supabase.storage.from_(bucket_name).upload(
            permanent_path,
            response,
            {"content-type": "image/png"}
        )
        
        # Delete preview
        supabase.storage.from_(bucket_name).remove([preview_storage_path])
        
        # Return permanent URL
        return supabase.storage.from_(bucket_name).get_public_url(permanent_path)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to move preview image: {str(e)}")


@router.post("/preview")
async def preview_post(
    request: PreviewPostRequest,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id)
):
    """
    Generate a post preview WITHOUT saving to database.
    Returns preview data for user approval.
    
    If feedback is provided, it will be used to guide the regeneration.
    """
    user_uuid = uuid.UUID(user_id)
    avee_uuid = uuid.UUID(request.avee_id)
    is_admin = is_admin_user(str(user_uuid), db)
    
    # Validate access
    if not is_admin:
        check_query = text("""
            SELECT owner_user_id FROM avees WHERE id = :avee_id
        """)
        result = db.execute(check_query, {"avee_id": str(avee_uuid)})
        row = result.fetchone()
        
        if not row or str(row[0]) != str(user_uuid):
            raise HTTPException(status_code=403, detail="Not authorized to generate posts for this agent")
    
    # Get agent info
    agent_query = text("""
        SELECT handle, display_name, avatar_url
        FROM avees
        WHERE id = :avee_id
    """)
    result = db.execute(agent_query, {"avee_id": str(avee_uuid)})
    row = result.fetchone()
    
    if not row:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    handle = row[0]
    display_name = row[1]
    avatar_url = row[2]
    
    # Cleanup previous preview if regenerating
    if request.previous_preview_id and request.previous_preview_id in _preview_cache:
        old_preview = _preview_cache.pop(request.previous_preview_id)
        if "storage_path" in old_preview:
            _delete_preview_image(old_preview["storage_path"])
    
    # Generate preview ID
    preview_id = str(uuid.uuid4())
    
    try:
        # Import generator module
        from .generate_daily_post import DailyPostGenerator
        
        generator = DailyPostGenerator(verbose=False)
        
        # Generate content (Steps 1-6) - pass feedback for regeneration context
        result = await generator.generate_preview_async(
            agent_handle=handle,
            topic_override=request.topic,
            category=request.category,
            image_engine=request.image_engine,
            image_style=request.image_style,  # Pass image style for prompt generation
            reference_image_url_override=request.reference_image_url,
            feedback=request.feedback  # Pass user feedback for regeneration
        )
        
        if not result.get("success", True):
            raise HTTPException(
                status_code=500,
                detail=result.get("error", "Preview generation failed")
            )
        
        # Upload image to temp storage
        storage_path = _get_preview_image_path(preview_id, handle)
        image_url = _upload_preview_image_to_storage(result["image_path"], storage_path)
        
        # Store preview data in cache
        _preview_cache[preview_id] = {
            "avee_id": str(avee_uuid),
            "handle": handle,
            "display_name": display_name,
            "avatar_url": avatar_url,
            "title": result["title"],
            "description": result["description"],
            "image_url": image_url,
            "image_path": result["image_path"],  # Local path for reference
            "storage_path": storage_path,
            "topic": result["topic"],
            "image_prompt": result["image_prompt"],
            "image_engine": request.image_engine,
            "generated_at": datetime.now().isoformat(),
            "user_id": str(user_uuid)
        }
        
        return PreviewPostResponse(
            preview_id=preview_id,
            avee_id=str(avee_uuid),
            handle=handle,
            display_name=display_name,
            avatar_url=avatar_url,
            title=result["title"],
            description=result["description"],
            image_url=image_url,
            topic=result["topic"],
            image_prompt=result["image_prompt"],
            image_engine=request.image_engine,
            generated_at=datetime.now().isoformat()
        )
        
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        print(f"[AutoPost Preview] ERROR: {str(e)}")
        traceback.print_exc()
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Preview generation failed: {str(e)}")


@router.post("/confirm")
async def confirm_post(
    request: ConfirmPostRequest,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id)
):
    """
    Confirm and save a previewed post to the database.
    Moves image from temp to permanent storage.
    Also posts to Twitter/LinkedIn if auto-posting is enabled.
    """
    user_uuid = uuid.UUID(user_id)
    
    # Track already-confirmed previews to handle duplicate requests gracefully
    # This prevents 404 errors when frontend retries or double-clicks
    global _confirmed_previews
    if not hasattr(confirm_post, '_confirmed_previews'):
        confirm_post._confirmed_previews = {}  # preview_id -> post_id mapping
    
    # Check if this preview was already confirmed (handle duplicate requests)
    if request.preview_id in confirm_post._confirmed_previews:
        cached_result = confirm_post._confirmed_previews[request.preview_id]
        print(f"[AutoPost Confirm] Returning cached result for already-confirmed preview: {request.preview_id}")
        return cached_result
    
    # Get preview data
    if request.preview_id not in _preview_cache:
        raise HTTPException(status_code=404, detail="Preview not found or expired")
    
    preview = _preview_cache[request.preview_id]
    
    # Validate user owns this preview
    if preview["user_id"] != str(user_uuid):
        is_admin = is_admin_user(str(user_uuid), db)
        if not is_admin:
            raise HTTPException(status_code=403, detail="Not authorized to confirm this preview")
    
    # Validate avee_id matches
    if preview["avee_id"] != request.avee_id:
        raise HTTPException(status_code=400, detail="Agent ID mismatch")
    
    try:
        # Move image to permanent storage
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        permanent_path = f"{preview['handle']}/post_{timestamp}.png"
        permanent_url = _move_preview_to_permanent(preview["storage_path"], permanent_path)
        
        # Use edited title/description if provided, otherwise use generated
        final_title = request.title if request.title else preview["title"]
        final_description = request.description if request.description else preview["description"]
        
        # Create post in database
        from .post_creation_service import create_post_from_preview
        
        post_result = create_post_from_preview(
            agent_handle=preview["handle"],
            image_url=permanent_url,
            title=final_title,
            description=final_description,
            topic=preview["topic"],
            image_prompt=preview["image_prompt"],
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
        del _preview_cache[request.preview_id]
        
        post_id = post_result["post_id"]
        permanent_url_for_cache = permanent_url  # Save for caching
        
        # Check if should auto-post to Twitter
        twitter_url = None
        twitter_error = None
        
        if post_id:
            try:
                from backend.twitter_posting_service import get_twitter_posting_service
                posting_service = get_twitter_posting_service()
                
                # Check if agent should auto-post
                if posting_service.should_auto_post(avee_uuid, db):
                    post_uuid = uuid.UUID(post_id)
                    
                    # Attempt to post to Twitter
                    twitter_result = posting_service.post_to_twitter(
                        post_uuid,
                        user_uuid,
                        db
                    )
                    
                    if twitter_result["success"]:
                        twitter_url = twitter_result.get("twitter_url")
                        print(f"[AutoPost Confirm] Auto-posted to Twitter: {twitter_url}")
                    else:
                        twitter_error = twitter_result.get("error")
                        print(f"[AutoPost Confirm] Failed to auto-post to Twitter: {twitter_error}")
                        
            except Exception as twitter_exc:
                twitter_error = str(twitter_exc)
                print(f"[AutoPost Confirm] Twitter auto-post error: {twitter_error}")
        
        # Check if should auto-post to LinkedIn
        linkedin_url = None
        linkedin_error = None
        
        if post_id:
            try:
                from backend.linkedin_posting_service import get_linkedin_posting_service
                linkedin_service = get_linkedin_posting_service()
                
                # Check if agent should auto-post to LinkedIn
                if linkedin_service.should_auto_post(avee_uuid, db):
                    post_uuid = uuid.UUID(post_id)
                    
                    # Attempt to post to LinkedIn
                    linkedin_result = linkedin_service.post_to_linkedin(
                        post_uuid,
                        user_uuid,
                        db
                    )
                    
                    if linkedin_result["success"]:
                        linkedin_url = linkedin_result.get("linkedin_url")
                        print(f"[AutoPost Confirm] Auto-posted to LinkedIn: {linkedin_url}")
                    else:
                        linkedin_error = linkedin_result.get("error")
                        print(f"[AutoPost Confirm] Failed to auto-post to LinkedIn: {linkedin_error}")
                        
            except Exception as linkedin_exc:
                linkedin_error = str(linkedin_exc)
                print(f"[AutoPost Confirm] LinkedIn auto-post error: {linkedin_error}")
        
        result = {
            "success": True,
            "post_id": post_id,
            "image_url": permanent_url_for_cache,
            "view_url": post_result.get("view_url", f"/posts/{post_result['post_id']}"),
            "twitter_url": twitter_url,
            "twitter_error": twitter_error,
            "linkedin_url": linkedin_url,
            "linkedin_error": linkedin_error
        }
        
        # Cache the result for duplicate request handling (auto-cleanup after 5 minutes)
        confirm_post._confirmed_previews[request.preview_id] = result
        
        # Schedule cleanup of old confirmed previews (keep last 100)
        if len(confirm_post._confirmed_previews) > 100:
            # Remove oldest entries
            keys_to_remove = list(confirm_post._confirmed_previews.keys())[:-100]
            for key in keys_to_remove:
                del confirm_post._confirmed_previews[key]
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        print(f"[AutoPost Confirm] ERROR: {str(e)}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to confirm post: {str(e)}")


@router.post("/cancel")
async def cancel_preview(
    request: CancelPreviewRequest,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id)
):
    """
    Cancel a preview and cleanup temp storage.
    """
    user_uuid = uuid.UUID(user_id)
    
    # Get preview data
    if request.preview_id not in _preview_cache:
        # Already cancelled or expired - that's OK
        return {"success": True, "message": "Preview already cancelled or expired"}
    
    preview = _preview_cache[request.preview_id]
    
    # Validate user owns this preview
    if preview["user_id"] != str(user_uuid):
        is_admin = is_admin_user(str(user_uuid), db)
        if not is_admin:
            raise HTTPException(status_code=403, detail="Not authorized to cancel this preview")
    
    # Delete temp image
    if "storage_path" in preview:
        _delete_preview_image(preview["storage_path"])
    
    # Remove from cache
    del _preview_cache[request.preview_id]
    
    return {"success": True, "message": "Preview cancelled"}
