"""
AutoPost Diagnostic API

Provides detailed step-by-step logging and analysis of the autopost generation flow.
This is completely separate from the main app and is used for debugging and improvement.
"""

import uuid
import os
import sys
from typing import Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from pydantic import BaseModel
import time
import traceback

# Add backend to path for imports
sys.path.insert(0, 'backend')

from backend.db import SessionLocal
from backend.auth_supabase import get_current_user_id

router = APIRouter(prefix="/auto-post/diagnostic", tags=["auto-post-diagnostic"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# =====================================
# PYDANTIC MODELS
# =====================================

class DiagnosticGenerateRequest(BaseModel):
    avee_id: str
    topic: Optional[str] = None
    category: Optional[str] = None
    image_engine: str = "dall-e-3"


class StepLog:
    """Tracks a single step in the generation process"""
    
    def __init__(self, step_number: int, step_name: str):
        self.step_number = step_number
        self.step_name = step_name
        self.start_time = time.time()
        self.end_time = None
        self.duration = 0
        self.success = False
        self.error = None
        self.data = {}
    
    def finish(self, success: bool = True, error: str = None, data: dict = None):
        self.end_time = time.time()
        self.duration = self.end_time - self.start_time
        self.success = success
        self.error = error
        if data:
            self.data = data
    
    def to_dict(self):
        return {
            "step_number": self.step_number,
            "step_name": self.step_name,
            "duration": self.duration,
            "success": self.success,
            "error": self.error,
            "data": self.data
        }


class DiagnosticLogger:
    """Logs all steps and data for diagnostic analysis"""
    
    def __init__(self, agent_handle: str):
        self.agent_handle = agent_handle
        self.start_time = time.time()
        self.steps = []
        self.current_step = None
        self.messages = []
        self.final_result = None
    
    def start_step(self, step_number: int, step_name: str):
        """Start tracking a new step"""
        self.current_step = StepLog(step_number, step_name)
        self.log_message(f"Starting: {step_name}")
    
    def finish_step(self, success: bool = True, error: str = None, data: dict = None):
        """Finish tracking the current step"""
        if self.current_step:
            self.current_step.finish(success, error, data)
            self.steps.append(self.current_step)
            status = "✅" if success else "❌"
            self.log_message(f"{status} Completed: {self.current_step.step_name} ({self.current_step.duration:.3f}s)")
            self.current_step = None
    
    def log_message(self, message: str):
        """Log a message with timestamp"""
        self.messages.append({
            "timestamp": time.time() - self.start_time,
            "message": message
        })
    
    def set_final_result(self, result: dict):
        """Set the final result"""
        self.final_result = result
    
    def get_report(self):
        """Get the complete diagnostic report"""
        total_duration = time.time() - self.start_time
        return {
            "agent_handle": self.agent_handle,
            "total_duration": total_duration,
            "steps": [step.to_dict() for step in self.steps],
            "messages": self.messages,
            "final_result": self.final_result,
            "success": all(step.success for step in self.steps)
        }


# =====================================
# DIAGNOSTIC ENDPOINT
# =====================================

@router.post("/generate")
async def generate_post_diagnostic(
    request: DiagnosticGenerateRequest,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id)
):
    """
    Generate a post with full diagnostic logging.
    
    This endpoint provides detailed step-by-step analysis of the autopost generation flow,
    including:
    - Timing for each step
    - All data generated (topics, prompts, descriptions, etc.)
    - Success/failure status for each step
    - Complete error traces
    
    Returns a comprehensive diagnostic report for analysis and improvement.
    """
    user_uuid = uuid.UUID(user_id)
    avee_uuid = uuid.UUID(request.avee_id)
    
    # Get agent info
    agent_query = text("""
        SELECT handle, display_name, owner_user_id
        FROM avees
        WHERE id = :avee_id
    """)
    result = db.execute(agent_query, {"avee_id": str(avee_uuid)})
    row = result.fetchone()
    
    if not row:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    agent_handle = row[0]
    display_name = row[1]
    owner_user_id = row[2]
    
    # Check authorization (must be owner or admin)
    from auto_post_api import is_admin_user
    is_admin = is_admin_user(str(user_uuid), db)
    
    if not is_admin and str(owner_user_id) != str(user_uuid):
        raise HTTPException(status_code=403, detail="Not authorized to generate posts for this agent")
    
    # Initialize diagnostic logger
    logger = DiagnosticLogger(agent_handle)
    logger.log_message(f"🚀 Starting diagnostic generation for @{agent_handle}")
    logger.log_message(f"Agent: {display_name}")
    logger.log_message(f"Image Engine: {request.image_engine}")
    
    try:
        # STEP 1: Fetch or use topic
        logger.start_step(1, "Fetch/use topic")
        
        if request.topic:
            topic = {
                "topic": request.topic,
                "description": request.topic,
                "category": "custom",
                "source": "manual_override"
            }
            logger.log_message(f"Using manual topic: {request.topic}")
        else:
            from news_topic_fetcher import get_safe_daily_topic
            logger.log_message("Fetching safe daily topic from news API...")
            topic = get_safe_daily_topic(request.category)
            logger.log_message(f"Fetched topic: {topic['topic']}")
        
        logger.finish_step(success=True, data={
            "topic": topic["topic"],
            "description": topic.get("description"),
            "category": topic.get("category"),
            "source": topic.get("source")
        })
        
        # STEP 2: Load agent context
        logger.start_step(2, "Load agent context")
        logger.log_message(f"Loading context for @{agent_handle}...")
        
        from profile_context_loader import load_agent_context
        agent_context = load_agent_context(agent_handle)
        
        logger.log_message(f"Loaded: {agent_context['display_name']}")
        logger.log_message(f"Documents: {agent_context.get('document_count', 0)}")
        logger.log_message(f"Has reference image: {agent_context.get('has_reference_image', False)}")
        
        logger.finish_step(success=True, data={
            "handle": agent_context["handle"],
            "display_name": agent_context["display_name"],
            "document_count": agent_context.get("document_count", 0),
            "has_reference_image": agent_context.get("has_reference_image", False),
            "reference_image_url": agent_context.get("reference_image_url", None)
        })
        
        # STEP 3 & 4: Generate image prompt and title (parallel)
        reference_image_url = agent_context.get("reference_image_url")
        has_reference_image = bool(reference_image_url)
        use_edit_prompt = (request.image_engine == "gpt-image-1" and has_reference_image)
        
        if use_edit_prompt:
            logger.start_step(3, "Generate image EDIT prompt + title (parallel)")
            logger.log_message("Using edit prompt generator for GPT-Image-1 with reference")
            
            from ai_prompt_generator import generate_edit_prompt_and_title_parallel
            edit_instructions = agent_context.get("image_edit_instructions", "")
            image_prompt, title = await generate_edit_prompt_and_title_parallel(
                agent_context, topic, edit_instructions
            )
            
            logger.log_message(f"Edit prompt generated: {len(image_prompt)} chars")
        else:
            logger.start_step(3, "Generate image prompt + title (parallel)")
            logger.log_message("Using standard prompt generator")
            
            from ai_prompt_generator import generate_image_prompt_and_title_parallel
            image_prompt, title = await generate_image_prompt_and_title_parallel(
                agent_context, topic
            )
            
            logger.log_message(f"Image prompt generated: {len(image_prompt)} chars")
        
        logger.log_message(f"Title: {title}")
        
        logger.finish_step(success=True, data={
            "image_prompt": image_prompt,
            "title": title,
            "prompt_type": "edit" if use_edit_prompt else "generation",
            "prompt_length": len(image_prompt),
            "title_length": len(title)
        })
        
        # STEP 5: Generate description
        logger.start_step(5, "Generate description (GPT-4o)")
        logger.log_message("Calling GPT-4o to generate post description...")
        
        from ai_prompt_generator import generate_description
        description = generate_description(agent_context, topic, image_prompt)
        
        logger.log_message(f"Description generated: {len(description)} chars")
        
        logger.finish_step(success=True, data={
            "description": description,
            "length": len(description)
        })
        
        # STEP 6: Generate image
        if request.image_engine == "gpt-image-1":
            if has_reference_image:
                logger.start_step(6, "Generate image (GPT-Image-1 with reference)")
                logger.log_message("Using GPT-Image-1 for semantic editing")
                logger.log_message(f"Reference image: {reference_image_url}")
                
                from image_generator import ImageGenerator
                generator = ImageGenerator(output_dir="generated_images")
                image_path = generator.generate_with_gpt_image(
                    reference_image_url=reference_image_url,
                    prompt=image_prompt,
                    agent_handle=agent_handle
                )
            else:
                logger.start_step(6, "Generate image (GPT-Image-1 pure generation)")
                logger.log_message("Using GPT-Image-1 for text-to-image generation")
                
                from image_generator import ImageGenerator
                generator = ImageGenerator(output_dir="generated_images")
                image_path = generator.generate_with_gpt_image_simple(
                    prompt=image_prompt,
                    agent_handle=agent_handle
                )
        else:
            logger.start_step(6, "Generate image (DALL-E 3)")
            logger.log_message("Using DALL-E 3 for image generation")
            
            from image_generator import generate_post_image
            image_path = generate_post_image(image_prompt, agent_handle)
        
        logger.log_message(f"Image saved: {os.path.basename(image_path)}")
        
        # Get image size
        image_size_kb = os.path.getsize(image_path) / 1024 if os.path.exists(image_path) else 0
        
        logger.finish_step(success=True, data={
            "image_path": image_path,
            "image_file": os.path.basename(image_path),
            "size_kb": round(image_size_kb, 2),
            "engine": request.image_engine
        })
        
        # STEP 7: Upload and create post
        logger.start_step(7, "Upload image and create post")
        logger.log_message("Uploading image to Supabase Storage...")
        logger.log_message("Creating post in database...")
        
        from post_creation_service import create_post
        post_result = create_post(
            agent_handle=agent_handle,
            image_path=image_path,
            title=title,
            description=description,
            topic=topic,
            image_prompt=image_prompt,
            visibility="public"
        )
        
        logger.log_message(f"Post created: {post_result['post_id']}")
        logger.log_message(f"Image URL: {post_result['image_url']}")
        
        logger.finish_step(success=True, data={
            "post_id": post_result["post_id"],
            "image_url": post_result["image_url"],
            "view_url": post_result["view_url"]
        })
        
        # Update last_auto_post_at
        update_query = text("""
            UPDATE avees
            SET last_auto_post_at = NOW()
            WHERE id = :avee_id
        """)
        db.execute(update_query, {"avee_id": str(avee_uuid)})
        db.commit()
        
        # Set final result
        logger.set_final_result({
            "success": True,
            "post_id": post_result["post_id"],
            "image_url": post_result["image_url"],
            "view_url": post_result["view_url"],
            "topic": topic["topic"],
            "image_engine": request.image_engine
        })
        
        logger.log_message("✨ Generation completed successfully!")
        
        # Return complete diagnostic report
        report = logger.get_report()
        report["image_engine"] = request.image_engine
        report["post_id"] = post_result["post_id"]
        
        return report
        
    except Exception as e:
        # Log the error
        error_msg = str(e)
        error_trace = traceback.format_exc()
        
        logger.log_message(f"❌ ERROR: {error_msg}")
        
        # Finish current step as failed if there is one
        if logger.current_step:
            logger.finish_step(success=False, error=error_msg)
        
        # Return diagnostic report with error
        report = logger.get_report()
        report["success"] = False
        report["error"] = error_msg
        report["error_trace"] = error_trace
        report["image_engine"] = request.image_engine
        
        return report


@router.get("/test")
def test_diagnostic_endpoint():
    """Test endpoint to verify diagnostic API is working"""
    return {
        "status": "ok",
        "message": "AutoPost Diagnostic API is running",
        "endpoints": {
            "generate": "/auto-post/diagnostic/generate",
            "test": "/auto-post/diagnostic/test"
        }
    }

