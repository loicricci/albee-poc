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
    
    avees = []
    for row in rows:
        avee_id = str(row.avee_id)
        
        # Fetch reference images for this agent
        ref_images_query = text("""
            SELECT 
                id,
                reference_image_url,
                mask_image_url,
                is_primary
            FROM reference_images
            WHERE avee_id = :avee_id
            ORDER BY is_primary DESC, created_at DESC
        """)
        ref_result = db.execute(ref_images_query, {"avee_id": avee_id})
        ref_rows = ref_result.fetchall()
        
        reference_images = []
        for ref_row in ref_rows:
            reference_images.append({
                "id": str(ref_row[0]),
                "reference_image_url": ref_row[1],
                "mask_image_url": ref_row[2],
                "is_primary": ref_row[3]
            })
        
        avees.append({
            "avee_id": avee_id,
            "handle": row.handle,
            "display_name": row.display_name,
            "avatar_url": row.avatar_url,
            "auto_post_enabled": row.auto_post_enabled,
            "last_auto_post_at": row.last_auto_post_at.isoformat() if row.last_auto_post_at else None,
            "auto_post_settings": row.auto_post_settings,
            "reference_images": reference_images
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
            image_engine=request.image_engine,  # NEW: Pass image engine
            reference_image_url=request.reference_image_url,  # NEW: Pass selected reference image
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
        request.image_engine,  # NEW: Pass image engine
        request.reference_image_url  # NEW: Pass selected reference image
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
    reference_image_url: Optional[str],  # NEW: User-selected reference image
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
            category=category,
            image_engine=image_engine,  # NEW: Pass image engine selection
            reference_image_url_override=reference_image_url  # NEW: Pass user-selected reference image
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
    category: Optional[str],
    image_engine: str,  # NEW: Accept image engine parameter
    reference_image_url: Optional[str]  # NEW: Accept reference image URL
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
                category=category,
                image_engine=image_engine,  # NEW: Pass image engine
                reference_image_url_override=reference_image_url  # NEW: Pass reference image
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


