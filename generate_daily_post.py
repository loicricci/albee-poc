#!/usr/bin/env python3
"""
Daily AI Post Generator

Automated script to generate daily posts for agent profiles.
Combines news topics, agent personas, and AI-generated images.

Usage:
    python generate_daily_post.py --profile eltonjohn
    python generate_daily_post.py --profile coluche --topic "Space exploration"
    python generate_daily_post.py --profile eltonjohn --category science
"""

import os
import sys
import argparse
import asyncio
from datetime import datetime
from pathlib import Path
from typing import Optional

# Add backend to path
sys.path.insert(0, 'backend')

from dotenv import load_dotenv

# Load environment variables
load_dotenv('backend/.env', override=True)

# Import modules
from backend.news_topic_fetcher import get_safe_daily_topic
from backend.profile_context_loader import load_agent_context
from backend.ai_prompt_generator import (
    generate_image_prompt_and_title_parallel,
    generate_edit_prompt_and_title_parallel,
    generate_description
)
from backend.image_generator import generate_post_image
from backend.post_creation_service import create_post
from backend.timing_utils import PerformanceTracker, format_duration


# Configuration: Profiles enabled for auto-posting
ENABLED_PROFILES = ["eltonjohn", "coluche"]


class DailyPostGenerator:
    """
    Main orchestrator for daily post generation.
    Coordinates all steps from topic fetching to post creation.
    """
    
    def __init__(self, verbose: bool = True, enable_timing: bool = True):
        self.verbose = verbose
        self.enable_timing = enable_timing
        self.log_file = None
        self.tracker = None
    
    async def generate_post_async(
        self,
        agent_handle: str,
        topic_override: Optional[str] = None,
        category: Optional[str] = None,
        image_engine: str = "dall-e-3",  # NEW: Image generation engine selection
        reference_image_url_override: Optional[str] = None  # NEW: User-selected reference image URL
    ) -> dict:
        """
        Generate and post a daily AI-generated post (async version with parallelization).
        
        Args:
            agent_handle: Agent handle to post for
            topic_override: Optional topic override (skips news fetch)
            category: Optional category filter for news
            image_engine: Image generation engine ("dall-e-3" or "openai-edits")
            reference_image_url_override: Optional user-selected reference image URL (overrides agent default)
        
        Returns:
            Dictionary with results
        """
        start_time = datetime.now()
        
        # Initialize performance tracker
        if self.enable_timing:
            self.tracker = PerformanceTracker(f"Post Generation for @{agent_handle}")
            self.tracker.start()
        
        self._log_header(agent_handle)
        
        try:
            # Step 1: Fetch or use topic
            if self.tracker:
                self.tracker.start_step("Step 1", "Fetch/use topic")
            
            if topic_override:
                topic = {
                    "topic": topic_override,
                    "description": topic_override,
                    "category": "custom",
                    "source": "manual_override"
                }
                self._log_step(1, f"Using manual topic: {topic_override}")
            else:
                self._log_step(1, "Fetching safe daily topic...")
                topic = get_safe_daily_topic(category)
                self._log_success(f"Topic: {topic['topic']}")
            
            if self.tracker:
                self.tracker.stop_step({"topic": topic["topic"], "source": topic.get("source")})
            
            # Step 2: Load agent context
            if self.tracker:
                self.tracker.start_step("Step 2", "Load agent context")
            
            self._log_step(2, f"Loading context for @{agent_handle}...")
            agent_context = load_agent_context(agent_handle)
            self._log_success(f"Loaded: {agent_context['display_name']}")
            
            if self.tracker:
                self.tracker.stop_step({
                    "display_name": agent_context["display_name"],
                    "document_count": agent_context.get("document_count", 0)
                })
            
            # Steps 3 & 4: Generate image prompt and title IN PARALLEL
            # Use different prompt generator based on image engine and reference image availability
            
            # Determine if we have a reference image
            reference_image_url = reference_image_url_override or agent_context.get("reference_image_url")
            has_reference_image = bool(reference_image_url)
            
            # For GPT-Image-1 with reference: use edit prompt
            # For GPT-Image-1 without reference OR DALL-E 3: use standard generation prompt
            use_edit_prompt = (image_engine == "gpt-image-1" and has_reference_image)
            
            if self.tracker:
                if use_edit_prompt:
                    prompt_type = "edit prompt (with reference)"
                else:
                    prompt_type = "image prompt (pure generation)"
                self.tracker.start_step("Steps 3 & 4 (Parallel)", f"Generate {prompt_type} + title")
            
            if use_edit_prompt:
                # Generate EDIT prompt specifically for semantic image editing
                self._log_step(3, "Generating image EDIT prompt and title in parallel...")
                edit_instructions = agent_context.get("image_edit_instructions", "")
                image_prompt, title = await generate_edit_prompt_and_title_parallel(
                    agent_context, topic, edit_instructions
                )
                self._log_success(f"Edit prompt: {image_prompt[:80]}...")
            else:
                # Generate standard prompt for creating new images (DALL-E 3 or GPT-Image-1 without reference)
                self._log_step(3, "Generating image prompt and title in parallel...")
                image_prompt, title = await generate_image_prompt_and_title_parallel(agent_context, topic)
                self._log_success(f"Image prompt: {image_prompt[:80]}...")
            
            self._log_success(f"Title: {title}")
            
            if self.tracker:
                self.tracker.stop_step({"prompt_length": len(image_prompt), "title": title})
            
            # Step 5: Generate description
            if self.tracker:
                self.tracker.start_step("Step 5", "Generate description (GPT-4o)")
            
            self._log_step(5, "Generating post description with GPT-4o...")
            description = generate_description(agent_context, topic, image_prompt)
            self._log_success(f"Description: {len(description)} characters")
            
            if self.tracker:
                self.tracker.stop_step({"description_length": len(description)})
            
            # Step 6: Generate image (using selected engine)
            if self.tracker:
                if image_engine == "gpt-image-1":
                    if has_reference_image:
                        engine_label = "GPT-Image-1 (Semantic Editing with Reference)"
                    else:
                        engine_label = "GPT-Image-1 (Pure Generation)"
                else:
                    engine_label = "DALL-E 3 (Generation)"
                self.tracker.start_step("Step 6", f"Generate image ({engine_label})")
            
            self._log_step(6, f"Generating image with {image_engine}...")
            
            if image_engine == "gpt-image-1":
                if has_reference_image:
                    # Use GPT-Image-1 for semantic image editing with reference
                    self._log_success(f"Using reference image for semantic editing")
                    image_path = await self._generate_with_gpt_image(
                        agent_handle,
                        image_prompt,
                        agent_context,
                        reference_image_url_override
                    )
                else:
                    # Use GPT-Image-1 for pure text-to-image generation (no reference needed)
                    self._log_success(f"Generating from text prompt (no reference image)")
                    image_path = await self._generate_with_gpt_image_simple(
                        agent_handle,
                        image_prompt
                    )
            else:
                # Use DALL-E 3 (default generation model)
                image_path = generate_post_image(image_prompt, agent_handle)
            
            self._log_success(f"Image saved: {os.path.basename(image_path)}")
            
            if self.tracker:
                self.tracker.stop_step({
                    "image_file": os.path.basename(image_path),
                    "image_size_kb": os.path.getsize(image_path) / 1024
                })
            
            # Step 6.5: Apply logo overlay if enabled
            logo_enabled = agent_context.get("logo_enabled", False)
            logo_url = agent_context.get("logo_url")
            
            if logo_enabled and logo_url:
                if self.tracker:
                    self.tracker.start_step("Step 6.5", "Apply logo watermark")
                
                self._log_step(6, "Applying logo watermark...")
                
                from backend.image_generator import ImageGenerator
                generator = ImageGenerator(output_dir="generated_images")
                
                logo_position = agent_context.get("logo_position", "bottom-right")
                logo_size = agent_context.get("logo_size", "medium")
                
                image_path = generator.overlay_logo(
                    image_path=image_path,
                    logo_url=logo_url,
                    position=logo_position,
                    size=logo_size
                )
                
                self._log_success(f"Logo applied at {logo_position} ({logo_size})")
                
                if self.tracker:
                    self.tracker.stop_step({
                        "logo_position": logo_position,
                        "logo_size": logo_size
                    })
            elif logo_enabled and not logo_url:
                self._log_success("Logo enabled but no logo URL configured - skipping")
            
            # Step 7: Upload and create post
            if self.tracker:
                self.tracker.start_step("Step 7", "Upload image and create post")
            
            self._log_step(7, "Uploading image and creating post...")
            post_result = create_post(
                agent_handle=agent_handle,
                image_path=image_path,
                title=title,
                description=description,
                topic=topic,
                image_prompt=image_prompt,
                visibility="public"
            )
            self._log_success(f"Post created: {post_result['post_id']}")
            
            if self.tracker:
                self.tracker.stop_step({"post_id": post_result["post_id"]})
            
            # Calculate duration
            duration = (datetime.now() - start_time).total_seconds()
            
            # Finish performance tracking
            if self.tracker:
                timing_results = self.tracker.finish()
            
            # Final summary
            self._log_summary(post_result, topic, duration)
            
            return {
                "success": True,
                "post_id": post_result["post_id"],
                "image_url": post_result["image_url"],
                "view_url": post_result["view_url"],
                "topic": topic["topic"],
                "duration_seconds": duration,
                "image_engine": image_engine  # NEW: Include which engine was used
            }
            
        except Exception as e:
            if self.tracker:
                self.tracker.finish()
            self._log_error(e)
            
            # Return error information instead of raising
            return {
                "success": False,
                "error": str(e),
                "image_engine": image_engine
            }
    
    
    async def _generate_with_edits(
        self,
        agent_handle: str,
        edit_prompt: str,
        agent_context: dict,
        reference_image_url_override: Optional[str] = None
    ) -> str:
        """
        Generate image using OpenAI Image Edits with reference images.
        
        The edit_prompt is now specifically generated for image editing (by
        generate_edit_prompt_and_title_parallel) and incorporates the topic/context
        research to modify the reference image appropriately.
        
        Args:
            agent_handle: Agent handle
            edit_prompt: Edit prompt specifically designed for modifying the reference image
            agent_context: Agent context including reference image URLs
            reference_image_url_override: User-selected reference image URL (overrides agent default)
        
        Returns:
            Local filepath to edited image
        """
        # Use override if provided, otherwise use agent's default reference image
        reference_image_url = reference_image_url_override or agent_context.get("reference_image_url")
        mask_image_url = agent_context.get("reference_image_mask_url")
        
        if not reference_image_url:
            raise Exception(
                f"Agent @{agent_handle} does not have reference images uploaded. "
                "Please upload reference images in the agent editor before using openai-edits mode."
            )
        
        self._log_success(f"Using reference image for edit")
        self._log_success(f"Edit prompt preview: {edit_prompt[:100]}...")
        
        # Use ImageGenerator to perform the edit
        from backend.image_generator import ImageGenerator
        generator = ImageGenerator(output_dir="generated_images")
        
        return generator.generate_with_edits(
            reference_image_url=reference_image_url,
            prompt=edit_prompt,
            agent_handle=agent_handle,
            mask_image_url=mask_image_url
        )
    
    
    async def _generate_with_gpt_image(
        self,
        agent_handle: str,
        edit_prompt: str,
        agent_context: dict,
        reference_image_url_override: Optional[str] = None
    ) -> str:
        """
        Generate image using GPT-Image-1 with semantic editing.
        
        GPT-Image-1 understands images and can edit them based on text instructions
        WITHOUT requiring masks. Perfect for background changes, style, lighting, etc.
        
        Args:
            agent_handle: Agent handle
            edit_prompt: Edit instruction from generate_edit_prompt_and_title_parallel
            agent_context: Agent context including reference image URLs
            reference_image_url_override: User-selected reference image URL
        
        Returns:
            Local filepath to edited image
        """
        # Use override if provided, otherwise use agent's default reference image
        reference_image_url = reference_image_url_override or agent_context.get("reference_image_url")
        
        if not reference_image_url:
            raise Exception(
                f"Agent @{agent_handle} does not have reference images uploaded. "
                "Please upload reference images in the agent editor before using gpt-image-1 mode."
            )
        
        self._log_success(f"Using reference image for semantic editing")
        self._log_success(f"Edit instruction: {edit_prompt[:100]}...")
        
        # Use ImageGenerator to perform semantic editing with GPT-Image-1
        from backend.image_generator import ImageGenerator
        generator = ImageGenerator(output_dir="generated_images")
        
        return generator.generate_with_gpt_image(
            reference_image_url=reference_image_url,
            prompt=edit_prompt,
            agent_handle=agent_handle
        )
    
    
    async def _generate_with_gpt_image_simple(
        self,
        agent_handle: str,
        prompt: str
    ) -> str:
        """
        Generate image using GPT-Image-1 for pure text-to-image generation.
        
        This uses GPT-Image-1 without any reference images - just generates
        new images from text prompts, similar to DALL-E 3 but with OpenAI's
        newest image model.
        
        Args:
            agent_handle: Agent handle
            prompt: Image generation prompt
        
        Returns:
            Local filepath to generated image
        """
        self._log_success(f"Generating with GPT-Image-1 (text-to-image)")
        self._log_success(f"Prompt preview: {prompt[:100]}...")
        
        # Use ImageGenerator to perform pure text-to-image generation
        from backend.image_generator import ImageGenerator
        generator = ImageGenerator(output_dir="generated_images")
        
        return generator.generate_with_gpt_image_simple(
            prompt=prompt,
            agent_handle=agent_handle
        )
    
    def generate_post(
        self,
        agent_handle: str,
        topic_override: Optional[str] = None,
        category: Optional[str] = None,
        image_engine: str = "dall-e-3"  # NEW: Pass through image engine
    ) -> dict:
        """
        Generate and post a daily AI-generated post (synchronous wrapper).
        
        This wraps the async version for backwards compatibility.
        """
        return asyncio.run(self.generate_post_async(
            agent_handle, 
            topic_override, 
            category,
            image_engine  # NEW
        ))
    
    def _log_header(self, agent_handle: str):
        """Log header"""
        if not self.verbose:
            return
        
        print("\n" + "=" * 80)
        print("🤖 DAILY AI POST GENERATOR")
        print("=" * 80)
        print(f"Agent: @{agent_handle}")
        print(f"Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print("=" * 80 + "\n")
    
    def _log_step(self, step: int, message: str):
        """Log step"""
        if not self.verbose:
            return
        print(f"\n[Step {step}] {message}")
    
    def _log_success(self, message: str):
        """Log success"""
        if not self.verbose:
            return
        print(f"✅ {message}")
    
    def _log_error(self, error: Exception):
        """Log error"""
        print(f"\n❌ ERROR: {str(error)}")
        import traceback
        traceback.print_exc()
    
    def _log_summary(self, post_result: dict, topic: dict, duration: float):
        """Log final summary"""
        if not self.verbose:
            return
        
        print("\n" + "=" * 80)
        print("✨ POST GENERATION COMPLETE!")
        print("=" * 80)
        print(f"Topic: {topic['topic']}")
        print(f"Category: {topic['category']}")
        print(f"Source: {topic.get('source', 'unknown')}")
        print(f"\nPost ID: {post_result['post_id']}")
        print(f"Image URL: {post_result['image_url']}")
        print(f"\n🔗 View Post: {post_result['view_url']}")
        print(f"\n⏱️  Duration: {duration:.1f} seconds")
        print("=" * 80 + "\n")


def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(
        description="Generate daily AI posts for agent profiles",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Generate post for Elton John
  python generate_daily_post.py --profile eltonjohn
  
  # Generate with specific category
  python generate_daily_post.py --profile coluche --category science
  
  # Override with manual topic
  python generate_daily_post.py --profile eltonjohn --topic "Mars exploration"
  
  # Quiet mode (minimal output)
  python generate_daily_post.py --profile eltonjohn --quiet
        """
    )
    
    parser.add_argument(
        '--profile',
        type=str,
        required=True,
        help=f'Agent handle to generate post for (e.g., {", ".join(ENABLED_PROFILES)})'
    )
    
    parser.add_argument(
        '--topic',
        type=str,
        help='Manual topic override (skips news API)'
    )
    
    parser.add_argument(
        '--category',
        type=str,
        choices=['business', 'entertainment', 'general', 'health', 'science', 'sports', 'technology'],
        help='News category filter'
    )
    
    parser.add_argument(
        '--quiet',
        action='store_true',
        help='Minimal output'
    )
    
    parser.add_argument(
        '--check-enabled',
        action='store_true',
        help='Check if profile is enabled for auto-posting'
    )
    
    args = parser.parse_args()
    
    # Check if profile is enabled (optional safety check)
    if args.check_enabled and args.profile not in ENABLED_PROFILES:
        print(f"❌ Profile @{args.profile} is not enabled for auto-posting")
        print(f"✅ Enabled profiles: {', '.join(ENABLED_PROFILES)}")
        sys.exit(1)
    
    # Generate post
    try:
        generator = DailyPostGenerator(verbose=not args.quiet)
        result = generator.generate_post(
            agent_handle=args.profile,
            topic_override=args.topic,
            category=args.category
        )
        
        if args.quiet:
            # Just print essential info in quiet mode
            print(f"✅ Post created: {result['post_id']}")
            print(f"🔗 {result['view_url']}")
        
        sys.exit(0)
        
    except KeyboardInterrupt:
        print("\n\n⚠️  Interrupted by user")
        sys.exit(1)
        
    except Exception as e:
        print(f"\n❌ Fatal error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()


