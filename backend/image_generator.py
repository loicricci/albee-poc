"""
Image Generator Module

Generates images using DALL-E 3 and handles downloading/saving.
Based on the pattern from generate_elton_image.py.
"""

import os
import requests
import time
from pathlib import Path
from datetime import datetime
from typing import Optional
from openai import OpenAI

client = OpenAI()


class ImageGenerator:
    """
    Generates images using OpenAI's DALL-E 3 API.
    Handles image generation, downloading, and local storage.
    """
    
    def __init__(self, output_dir: str = "generated_images"):
        self.output_dir = output_dir
        Path(output_dir).mkdir(parents=True, exist_ok=True)
        
        # Verify API key
        if not os.getenv("OPENAI_API_KEY"):
            raise ValueError("OPENAI_API_KEY environment variable not set")
    
    def generate_post_image(
        self, 
        prompt: str, 
        agent_handle: str,
        size: str = "1024x1024",  # Changed from 1792x1024 for faster generation
        quality: str = "hd",
        style: str = "vivid"
    ) -> str:
        """
        Generate an image using DALL-E 3 and save it locally.
        
        Args:
            prompt: Detailed image generation prompt
            agent_handle: Agent handle (for filename)
            size: Image size (1024x1024, 1792x1024, 1024x1792)
            quality: Quality level (standard, hd)
            style: Style preference (vivid, natural)
        
        Returns:
            Local file path to the saved image
        
        Raises:
            Exception: If image generation or download fails
        """
        print(f"[ImageGenerator] Generating image for @{agent_handle}...")
        print(f"[ImageGenerator] Size: {size}, Quality: {quality}, Style: {style}")
        print(f"[ImageGenerator] Prompt preview: {prompt[:100]}...")
        overall_start = time.time()
        
        try:
            # Generate image with DALL-E 3
            image_url = self._generate_with_dalle(prompt, size, quality, style)
            
            # Download and save
            filepath = self._download_and_save(image_url, agent_handle)
            
            # Save metadata
            self._save_metadata(filepath, prompt, agent_handle, size, quality, style)
            
            total_duration = time.time() - overall_start
            print(f"[ImageGenerator] ✅ Image saved: {filepath} (total: {total_duration:.2f}s)")
            
            return filepath
            
        except Exception as e:
            print(f"[ImageGenerator] ❌ Error: {e}")
            raise
    
    def _generate_with_dalle(
        self, 
        prompt: str, 
        size: str, 
        quality: str, 
        style: str
        ) -> str:
        """
        Call DALL-E 3 API to generate image.
        
        Returns:
            Image URL (valid for ~1 hour)
        """
        print(f"[ImageGenerator] Calling DALL-E 3 API...")
        start_time = time.time()
        
        try:
            response = client.images.generate(
        model="dall-e-3",
        prompt=prompt,
        n=1,
        size=size,
        quality=quality,
        style=style
            )
            
            duration = time.time() - start_time
            image_url = response.data[0].url
            
            print(f"[ImageGenerator] ✅ Image generated successfully! ({duration:.2f}s)")
            
            return image_url
            
        except Exception as e:
            error_msg = str(e)
            
            # Check for common errors
            if "content_policy_violation" in error_msg.lower():
                raise Exception(
                    "Content policy violation: The prompt may contain restricted content. "
                    "Try regenerating with a different topic or prompt."
                )
            elif "rate_limit" in error_msg.lower():
                raise Exception(
                    "Rate limit exceeded: Too many requests. Please wait and try again."
                )
            else:
                raise Exception(f"DALL-E 3 API error: {error_msg}")
    
    def _download_and_save(self, image_url: str, agent_handle: str) -> str:
        """
        Download image from URL and save locally.
        
        Returns:
            Local file path
        """
        # Generate filename with timestamp
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"{agent_handle}_post_{timestamp}.png"
        filepath = os.path.join(self.output_dir, filename)
        
        print(f"[ImageGenerator] Downloading image...")
        start_time = time.time()
        
        try:
            response = requests.get(image_url, timeout=60)
            response.raise_for_status()
            
            # Save to file
            with open(filepath, 'wb') as f:
                f.write(response.content)
            
            duration = time.time() - start_time
            file_size = os.path.getsize(filepath)
            print(f"[ImageGenerator] ✅ Downloaded ({file_size / 1024:.1f} KB, {duration:.2f}s)")
            
            return filepath
            
        except Exception as e:
            raise Exception(f"Failed to download image: {e}")
    
    def _save_metadata(
        self, 
        image_path: str, 
        prompt: str, 
        agent_handle: str,
        size: str,
        quality: str,
        style: str
    ):
        """Save metadata file alongside the image"""
        metadata_path = image_path.replace('.png', '_metadata.txt')
        
        metadata_content = f"""AI Generated Image Metadata
{"=" * 60}

Agent: @{agent_handle}
Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

Model: DALL-E 3
Size: {size}
Quality: {quality}
Style: {style}

{"=" * 60}
PROMPT:
{"=" * 60}
{prompt}

{"=" * 60}
IMAGE FILE: {os.path.basename(image_path)}
"""
        
        with open(metadata_path, 'w', encoding='utf-8') as f:
            f.write(metadata_content)
        
        print(f"[ImageGenerator] ✅ Metadata saved: {metadata_path}")


# Convenience function
def generate_post_image(
    prompt: str, 
    agent_handle: str,
    output_dir: str = "generated_images"
) -> str:
    """
    Generate an image for a social media post.
    
    Args:
        prompt: Image generation prompt
        agent_handle: Agent handle
        output_dir: Directory to save images
    
    Returns:
        Path to saved image file
    """
    generator = ImageGenerator(output_dir)
    return generator.generate_post_image(prompt, agent_handle)


# Testing
if __name__ == "__main__":
    from dotenv import load_dotenv
    import sys
    
    # Add backend to path
    sys.path.insert(0, 'backend')
    
    # Load environment
    load_dotenv("backend/.env", override=True)
    
    print("=" * 80)
    print("Testing Image Generator")
    print("=" * 80)
    
    # Test with a simple prompt
    if len(sys.argv) > 1:
        # Use provided agent handle
        agent_handle = sys.argv[1]
        
        # Load full context and generate
        from profile_context_loader import load_agent_context
        from news_topic_fetcher import get_safe_daily_topic
        from ai_prompt_generator import generate_image_prompt
        
        print("\n1. Loading agent context...")
        agent_context = load_agent_context(agent_handle)
        
        print("\n2. Fetching daily topic...")
        topic = get_safe_daily_topic()
        
        print("\n3. Generating image prompt...")
        prompt = generate_image_prompt(agent_context, topic)
        
        print("\n4. Generating image...")
        filepath = generate_post_image(prompt, agent_handle)
        
        print("\n" + "=" * 80)
        print("SUCCESS!")
        print("=" * 80)
        print(f"Image saved to: {os.path.abspath(filepath)}")
        print("=" * 80)
    else:
        # Simple test with hardcoded prompt
        test_prompt = """
        A professional musician performing on a grand piano on a futuristic stage,
        surrounded by holographic displays showing scientific data. The scene is
        theatrical and vibrant, with dramatic lighting in purples and blues,
        photorealistic style, cinematic composition, 8K quality.
        """
        
        filepath = generate_post_image(test_prompt.strip(), "test_agent")
        
        print(f"\n✅ Test image saved to: {os.path.abspath(filepath)}")


