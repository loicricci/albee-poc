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
    Generates images using OpenAI's image APIs (DALL-E 3, GPT-Image-1).
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


    def generate_with_edits(
        self,
        reference_image_url: str,
        prompt: str,
        agent_handle: str,
        mask_image_url: Optional[str] = None,
        size: str = "1024x1024"
    ) -> str:
        """
        Generate image using OpenAI Image Edits API.
        
        Args:
            reference_image_url: Required reference image URL from Supabase
            prompt: Text prompt describing desired edits
            agent_handle: Agent handle for filename
            mask_image_url: OPTIONAL mask URL (if None, entire image is edited)
            size: Image size (must match reference image size)
        
        Returns:
            Local file path to the saved edited image
        
        Raises:
            Exception: If image editing or download fails
        """
        print(f"[ImageGenerator] Generating edited image for @{agent_handle}...")
        print(f"[ImageGenerator] Using OpenAI Image Edits API")
        print(f"[ImageGenerator] Prompt: {prompt[:100]}...")
        overall_start = time.time()
        
        try:
            # Download reference image
            print(f"[ImageGenerator] Downloading reference image...")
            reference_data = self._download_image_from_url(reference_image_url)
            
            # Download mask image if provided
            mask_data = None
            if mask_image_url:
                print(f"[ImageGenerator] Downloading mask image...")
                mask_data = self._download_image_from_url(mask_image_url)
                print(f"[ImageGenerator] Using mask for targeted editing")
            else:
                print(f"[ImageGenerator] No mask provided - editing entire image")
            
            # Call OpenAI Image Edits API
            edited_image_url = self._edit_with_openai(
                reference_data,
                prompt,
                mask_data,
                size
            )
            
            # Download and save edited image
            filepath = self._download_and_save(edited_image_url, agent_handle)
            
            # Save metadata
            self._save_edit_metadata(
                filepath,
                prompt,
                agent_handle,
                reference_image_url,
                mask_image_url,
                size
            )
            
            total_duration = time.time() - overall_start
            print(f"[ImageGenerator] ✅ Edited image saved: {filepath} (total: {total_duration:.2f}s)")
            
            return filepath
            
        except Exception as e:
            print(f"[ImageGenerator] ❌ Error: {e}")
            raise
    
    
    def _download_image_from_url(self, url: str) -> bytes:
        """
        Download image content from URL (Supabase Storage or other).
        
        Returns:
            Binary image data
        """
        try:
            response = requests.get(url, timeout=60)
            response.raise_for_status()
            return response.content
        except Exception as e:
            raise Exception(f"Failed to download image from {url}: {e}")
    
    
    def _edit_with_openai(
        self,
        image_data: bytes,
        prompt: str,
        mask_data: Optional[bytes],
        size: str
    ) -> str:
        """
        Call OpenAI Image Edits API.
        
        Returns:
            URL to edited image (valid for ~1 hour)
        """
        print(f"[ImageGenerator] Calling OpenAI Image Edits API...")
        start_time = time.time()
        
        # Truncate prompt to 1000 chars max for OpenAI Edits API
        MAX_PROMPT_LENGTH = 1000
        if len(prompt) > MAX_PROMPT_LENGTH:
            # Truncate at word boundary and add ellipsis
            truncated_prompt = prompt[:MAX_PROMPT_LENGTH-20].rsplit(' ', 1)[0] + "..."
            print(f"[ImageGenerator] ⚠️  Prompt truncated from {len(prompt)} to {len(truncated_prompt)} chars (OpenAI Edits API limit: 1000)")
            prompt = truncated_prompt
        
        try:
            # Convert images to RGBA format (required by OpenAI Image Edits API)
            from PIL import Image
            import io
            
            # Convert reference image to RGBA
            print(f"[ImageGenerator] Converting reference image to RGBA format...")
            reference_image = Image.open(io.BytesIO(image_data))
            if reference_image.mode != 'RGBA':
                reference_image = reference_image.convert('RGBA')
            
            # Save to bytes
            reference_buffer = io.BytesIO()
            reference_image.save(reference_buffer, format='PNG')
            reference_buffer.seek(0)
            reference_buffer.name = "reference.png"
            
            # Convert mask image to RGBA if provided
            mask_buffer = None
            if mask_data:
                print(f"[ImageGenerator] Converting mask image to RGBA format...")
                mask_image = Image.open(io.BytesIO(mask_data))
                if mask_image.mode != 'RGBA':
                    mask_image = mask_image.convert('RGBA')
                
                mask_buffer = io.BytesIO()
                mask_image.save(mask_buffer, format='PNG')
                mask_buffer.seek(0)
                mask_buffer.name = "mask.png"
            
            # Call API with or without mask
            if mask_buffer:
                response = client.images.edit(
                    model="dall-e-2",  # Note: Only DALL-E 2 supports edits
                    image=reference_buffer,
                    mask=mask_buffer,
                    prompt=prompt,
                    n=1,
                    size=size
                )
            else:
                response = client.images.edit(
                    model="dall-e-2",  # Note: Only DALL-E 2 supports edits
                    image=reference_buffer,
                    prompt=prompt,
                    n=1,
                    size=size
                )
            
            duration = time.time() - start_time
            edited_image_url = response.data[0].url
            
            print(f"[ImageGenerator] ✅ Image edited successfully! ({duration:.2f}s)")
            
            return edited_image_url
            
        except Exception as e:
            error_msg = str(e)
            
            # Check for common errors
            if "content_policy_violation" in error_msg.lower():
                raise Exception(
                    "Content policy violation: The edit request may contain restricted content. "
                    "Try a different prompt or reference image."
                )
            elif "rate_limit" in error_msg.lower():
                raise Exception(
                    "Rate limit exceeded: Too many requests. Please wait and try again."
                )
            elif "invalid_image_size" in error_msg.lower():
                raise Exception(
                    f"Invalid image size: OpenAI Image Edits requires square images (256x256, 512x512, or 1024x1024)"
                )
            else:
                raise Exception(f"OpenAI Image Edits API error: {error_msg}")
    
    
    def _save_edit_metadata(
        self,
        image_path: str,
        prompt: str,
        agent_handle: str,
        reference_url: str,
        mask_url: Optional[str],
        size: str
    ):
        """Save metadata file for edited image"""
        metadata_path = image_path.replace('.png', '_metadata.txt')
        
        metadata_content = f"""AI Edited Image Metadata
{"=" * 60}

Agent: @{agent_handle}
Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

Model: DALL-E 2 (Image Edits)
Size: {size}
Reference Image: {reference_url}
Mask Image: {mask_url if mask_url else 'None (entire image edited)'}

{"=" * 60}
EDIT PROMPT:
{"=" * 60}
{prompt}

{"=" * 60}
IMAGE FILE: {os.path.basename(image_path)}
"""
        
        with open(metadata_path, 'w', encoding='utf-8') as f:
            f.write(metadata_content)
        
        print(f"[ImageGenerator] ✅ Metadata saved: {metadata_path}")


    def generate_with_gpt_image(
        self,
        reference_image_url: str,
        prompt: str,
        agent_handle: str,
        size: str = "1024x1024"
    ) -> str:
        """
        Generate image using OpenAI GPT-Image-1 with reference image editing.
        
        GPT-Image-1 is a multimodal model that can understand images semantically
        and edit them based on text instructions WITHOUT requiring masks.
        
        How it works:
        - Send reference image + edit instruction
        - Model understands the image semantically
        - Infers which parts to change based on instruction
        - Perfect for: background changes, color/style, lighting, clothing, etc.
        
        Args:
            reference_image_url: Reference image URL from Supabase
            prompt: Text instruction describing desired edits
            agent_handle: Agent handle for filename
            size: Image size (1024x1024, 1792x1024, 1024x1792)
        
        Returns:
            Local file path to the saved edited image
        
        Raises:
            Exception: If image editing or download fails
        """
        print(f"[ImageGenerator] Editing image with GPT-Image-1...")
        print(f"[ImageGenerator] Using semantic editing (no mask required)")
        print(f"[ImageGenerator] Edit instruction: {prompt[:100]}...")
        overall_start = time.time()
        
        try:
            # Download reference image
            print(f"[ImageGenerator] Downloading reference image...")
            reference_data = self._download_image_from_url(reference_image_url)
            
            # Convert to base64 for API
            import base64
            reference_b64 = base64.b64encode(reference_data).decode('utf-8')
            
            # Call GPT-Image-1 for semantic image editing via edits endpoint
            print(f"[ImageGenerator] Calling GPT-Image-1 API with image edits endpoint...")
            start_time = time.time()
            
            # GPT-Image-1 uses the /images/edits endpoint for image-to-image
            # Convert reference image to file-like object
            from PIL import Image
            import io
            
            # Load and prepare reference image
            print(f"[ImageGenerator] Preparing reference image...")
            reference_image = Image.open(io.BytesIO(reference_data))
            
            # Ensure RGBA format (required by edits API)
            if reference_image.mode != 'RGBA':
                reference_image = reference_image.convert('RGBA')
            
            # Save to BytesIO buffer
            reference_buffer = io.BytesIO()
            reference_image.save(reference_buffer, format='PNG')
            reference_buffer.seek(0)
            reference_buffer.name = "reference.png"
            
            try:
                # Use the images.edit endpoint with GPT-Image-1
                # This is the correct endpoint for image-to-image with semantic editing
                response = client.images.edit(
                    model="gpt-image-1",
                    image=reference_buffer,
                    prompt=prompt,
                    n=1,
                    size=size
                )
                
                duration = time.time() - start_time
                edited_image_url = response.data[0].url
                print(f"[ImageGenerator] ✅ Image edited with GPT-Image-1! ({duration:.2f}s)")
                
            except Exception as e:
                if "responses" in str(e).lower() or "404" in str(e):
                    # If the standard approach fails, try the responses endpoint
                    print(f"[ImageGenerator] Standard endpoint failed, trying responses API...")
                    
                    import requests
                    import os
                    
                    api_key = os.getenv("OPENAI_API_KEY")
                    headers = {
                        "Authorization": f"Bearer {api_key}",
                        "Content-Type": "application/json"
                    }
                    
                    data = {
                        "model": "gpt-image-1",
                        "messages": [
                            {
                                "role": "user",
                                "content": [
                                    {
                                        "type": "image_url",
                                        "image_url": {
                                            "url": f"data:image/png;base64,{reference_b64}"
                                        }
                                    },
                                    {
                                        "type": "text",
                                        "text": prompt
                                    }
                                ]
                            }
                        ]
                    }
                    
                    api_response = requests.post(
                        "https://api.openai.com/v1/responses",
                        headers=headers,
                        json=data,
                        timeout=120
                    )
                    
                    if not api_response.ok:
                        raise Exception(f"Responses API error: {api_response.status_code} - {api_response.text}")
                    
                    response_json = api_response.json()
                    duration = time.time() - start_time
                    
                    # Extract image URL from responses API format
                    edited_image_url = None
                    if 'choices' in response_json:
                        content = response_json['choices'][0]['message']['content']
                        if isinstance(content, str) and content.startswith('http'):
                            edited_image_url = content
                    elif 'data' in response_json:
                        edited_image_url = response_json['data'][0].get('url')
                    
                    if not edited_image_url:
                        raise Exception(f"No image URL in response: {str(response_json)[:300]}")
                    
                    print(f"[ImageGenerator] ✅ Image edited via responses API! ({duration:.2f}s)")
                else:
                    raise
            
            # Download and save edited image
            filepath = self._download_and_save(edited_image_url, agent_handle)
            
            # Save metadata
            self._save_gpt_image_metadata(
                filepath,
                prompt,
                agent_handle,
                reference_image_url,
                size
            )
            
            total_duration = time.time() - overall_start
            print(f"[ImageGenerator] ✅ Edited image saved: {filepath} (total: {total_duration:.2f}s)")
            
            return filepath
            
        except Exception as e:
            error_msg = str(e)
            
            # Check for common errors
            if "content_policy_violation" in error_msg.lower():
                raise Exception(
                    "Content policy violation: The edit request may contain restricted content. "
                    "Try a different prompt or reference image."
                )
            elif "rate_limit" in error_msg.lower():
                raise Exception(
                    "Rate limit exceeded: Too many requests. Please wait and try again."
                )
            else:
                raise Exception(f"GPT-Image-1 API error: {error_msg}")
    
    
    def _save_gpt_image_metadata(
        self,
        image_path: str,
        prompt: str,
        agent_handle: str,
        reference_url: str,
        size: str
    ):
        """Save metadata file for GPT-Image-1 edited image"""
        metadata_path = image_path.replace('.png', '_metadata.txt')
        
        metadata_content = f"""AI Edited Image Metadata
{"=" * 60}

Agent: @{agent_handle}
Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

Model: GPT-Image-1 (OpenAI's newest image model)
Size: {size}
Reference Image: {reference_url}

{"=" * 60}
EDIT PROMPT:
{"=" * 60}
{prompt}

{"=" * 60}
IMAGE FILE: {os.path.basename(image_path)}
"""
        
        with open(metadata_path, 'w', encoding='utf-8') as f:
            f.write(metadata_content)
        
        print(f"[ImageGenerator] ✅ Metadata saved: {metadata_path}")


    def generate_with_gpt_image_simple(
        self,
        prompt: str,
        agent_handle: str,
        size: str = "1024x1024"
    ) -> str:
        """
        Generate image using GPT-Image-1 (pure generation, like DALL-E 3).
        
        This is OpenAI's newest image generation model. Does NOT use reference
        images - just generates new images from text prompts.
        
        Args:
            prompt: Detailed image generation prompt
            agent_handle: Agent handle (for filename)
            size: Image size (1024x1024, 1792x1024, 1024x1792)
        
        Returns:
            Local file path to the saved image
        
        Raises:
            Exception: If image generation or download fails
        """
        print(f"[ImageGenerator] Generating image with GPT-Image-1...")
        print(f"[ImageGenerator] Using OpenAI's newest image model")
        print(f"[ImageGenerator] Size: {size}")
        print(f"[ImageGenerator] Prompt preview: {prompt[:100]}...")
        overall_start = time.time()
        
        try:
            # Generate image with GPT-Image-1
            print(f"[ImageGenerator] Calling GPT-Image-1 API...")
            start_time = time.time()
            
            response = client.images.generate(
                model="gpt-image-1",
                prompt=prompt,
                n=1,
                size=size,
                quality="high",
                response_format="url"
            )
            
            duration = time.time() - start_time
            image_url = response.data[0].url
            
            print(f"[ImageGenerator] ✅ Image generated successfully! ({duration:.2f}s)")
            
            # Download and save
            filepath = self._download_and_save(image_url, agent_handle)
            
            # Save metadata
            self._save_gpt_image_simple_metadata(filepath, prompt, agent_handle, size)
            
            total_duration = time.time() - overall_start
            print(f"[ImageGenerator] ✅ Image saved: {filepath} (total: {total_duration:.2f}s)")
            
            return filepath
            
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
                raise Exception(f"GPT-Image-1 API error: {error_msg}")
    
    
    def _save_gpt_image_simple_metadata(
        self,
        image_path: str,
        prompt: str,
        agent_handle: str,
        size: str
    ):
        """Save metadata file for GPT-Image-1 generated image"""
        metadata_path = image_path.replace('.png', '_metadata.txt')
        
        metadata_content = f"""AI Generated Image Metadata
{"=" * 60}

Agent: @{agent_handle}
Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

Model: GPT-Image-1 (OpenAI's newest image model)
Size: {size}

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


