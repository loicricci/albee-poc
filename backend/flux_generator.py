"""
FLUX.2 Generator Module

Generates images using Black Forest Labs FLUX.2 API.
Supports text-to-image and multi-reference image editing.

API Docs: https://docs.bfl.ai/flux_2/flux2_image_editing

Models:
- flux-2-pro: Best balance of speed/quality, <10s, from $0.03/MP
- flux-2-max: Highest quality, <15s, from $0.07/MP  
- flux-2-klein: Sub-second, cheapest at $0.014/image
"""

import os
import requests
import time
from pathlib import Path
from datetime import datetime
from typing import Optional, List

BFL_API_KEY = os.getenv("BFL_API_KEY")
BFL_API_BASE = "https://api.bfl.ai/v1"


class FluxGenerator:
    """
    Generates images using FLUX.2 API.
    Supports pro, max, and klein model variants.
    
    Key features:
    - Text-to-image generation
    - Multi-reference image editing (up to 8 images via API)
    - Async job model with polling
    """
    
    POLL_INTERVAL = 2  # seconds between status checks
    MAX_POLL_TIME = 180  # 3 minutes max wait time
    
    # Model name mappings for API endpoints
    MODEL_ENDPOINTS = {
        "flux-2-pro": "flux-2-pro",
        "flux-2-max": "flux-2-max",
        "flux-2-klein": "flux-2-klein-9b",  # Using 9B variant for better quality
    }
    
    def __init__(self, output_dir: str = "generated_images"):
        self.output_dir = output_dir
        Path(output_dir).mkdir(parents=True, exist_ok=True)
        
        if not BFL_API_KEY:
            raise ValueError("BFL_API_KEY environment variable not set. Get your key from https://docs.bfl.ai/")
    
    def generate_image(
        self,
        prompt: str,
        agent_handle: str,
        model: str = "flux-2-pro",
        width: int = 1024,
        height: int = 1024,
        seed: Optional[int] = None
    ) -> str:
        """
        Generate an image using FLUX.2 text-to-image.
        
        Args:
            prompt: Detailed image generation prompt
            agent_handle: Agent handle (for filename)
            model: Model variant (flux-2-pro, flux-2-max, flux-2-klein)
            width: Image width (default 1024)
            height: Image height (default 1024)
            seed: Optional seed for reproducibility
        
        Returns:
            Local file path to the saved image
        
        Raises:
            Exception: If image generation or download fails
        """
        print(f"[FluxGenerator] Generating image for @{agent_handle}...")
        print(f"[FluxGenerator] Model: {model}, Size: {width}x{height}")
        print(f"[FluxGenerator] Prompt preview: {prompt[:100]}...")
        overall_start = time.time()
        
        try:
            # 1. Create generation job
            job_id = self._create_job(prompt, model, width, height, seed)
            
            # 2. Poll for completion
            result = self._poll_for_completion(job_id)
            
            # 3. Download and save
            image_url = result.get("sample") or result.get("url")
            if not image_url:
                raise Exception(f"No image URL in result: {result}")
            
            filepath = self._download_and_save(image_url, agent_handle, model)
            
            # 4. Save metadata
            self._save_metadata(filepath, prompt, agent_handle, model, width, height)
            
            total_duration = time.time() - overall_start
            print(f"[FluxGenerator] ✅ Image saved: {filepath} (total: {total_duration:.2f}s)")
            
            return filepath
            
        except Exception as e:
            print(f"[FluxGenerator] ❌ Error: {e}")
            raise
    
    def generate_with_reference(
        self,
        prompt: str,
        agent_handle: str,
        input_images: List[str],
        model: str = "flux-2-pro",
        width: int = 1024,
        height: int = 1024,
        seed: Optional[int] = None
    ) -> str:
        """
        Generate an image using FLUX.2 multi-reference editing.
        
        FLUX.2 can combine elements from multiple images into one scene.
        You can reference specific images in your prompt using "image 1", "image 2", etc.
        
        Args:
            prompt: Edit instruction describing how to combine/modify images
            agent_handle: Agent handle (for filename)
            input_images: List of reference image URLs (up to 8 via API)
            model: Model variant (flux-2-pro, flux-2-max, flux-2-klein)
            width: Output image width
            height: Output image height
            seed: Optional seed for reproducibility
        
        Returns:
            Local file path to the saved image
        
        Raises:
            Exception: If image editing or download fails
        """
        print(f"[FluxGenerator] Editing image for @{agent_handle}...")
        print(f"[FluxGenerator] Model: {model}, Reference images: {len(input_images)}")
        print(f"[FluxGenerator] Edit prompt: {prompt[:100]}...")
        overall_start = time.time()
        
        if not input_images:
            raise ValueError("At least one input image is required for editing")
        
        if len(input_images) > 8:
            print(f"[FluxGenerator] Warning: Only 8 reference images supported, using first 8")
            input_images = input_images[:8]
        
        try:
            # 1. Create editing job with reference images
            job_id = self._create_edit_job(prompt, input_images, model, width, height, seed)
            
            # 2. Poll for completion
            result = self._poll_for_completion(job_id)
            
            # 3. Download and save
            image_url = result.get("sample") or result.get("url")
            if not image_url:
                raise Exception(f"No image URL in result: {result}")
            
            filepath = self._download_and_save(image_url, agent_handle, model)
            
            # 4. Save metadata
            self._save_edit_metadata(
                filepath, prompt, agent_handle, model, input_images, width, height
            )
            
            total_duration = time.time() - overall_start
            print(f"[FluxGenerator] ✅ Edited image saved: {filepath} (total: {total_duration:.2f}s)")
            
            return filepath
            
        except Exception as e:
            print(f"[FluxGenerator] ❌ Error: {e}")
            raise
    
    def _create_job(
        self, 
        prompt: str, 
        model: str, 
        width: int, 
        height: int,
        seed: Optional[int]
    ) -> str:
        """
        Create a FLUX.2 text-to-image generation job.
        
        Returns:
            Job ID for status polling
        """
        print(f"[FluxGenerator] Creating FLUX.2 job...")
        start_time = time.time()
        
        # Get the correct API endpoint for this model
        endpoint_model = self.MODEL_ENDPOINTS.get(model, model)
        endpoint = f"{BFL_API_BASE}/{endpoint_model}"
        
        headers = {
            "x-key": BFL_API_KEY,
            "Content-Type": "application/json"
        }
        
        payload = {
            "prompt": prompt,
            "width": width,
            "height": height,
            "output_format": "jpeg"
        }
        
        if seed is not None:
            payload["seed"] = seed
        
        try:
            response = requests.post(endpoint, headers=headers, json=payload, timeout=60)
            
            if response.status_code != 200 and response.status_code != 201:
                error_data = response.json() if response.text else {}
                error_msg = error_data.get("error", {}).get("message", response.text)
                self._handle_api_error(error_msg)
            
            data = response.json()
            job_id = data.get("id")
            
            if not job_id:
                raise Exception(f"No job ID returned from FLUX.2 API: {data}")
            
            duration = time.time() - start_time
            print(f"[FluxGenerator] ✅ Job created: {job_id} ({duration:.2f}s)")
            
            return job_id
            
        except requests.exceptions.RequestException as e:
            self._handle_api_error(str(e))
    
    def _create_edit_job(
        self,
        prompt: str,
        input_images: List[str],
        model: str,
        width: int,
        height: int,
        seed: Optional[int]
    ) -> str:
        """
        Create a FLUX.2 editing job with reference images.
        
        Returns:
            Job ID for status polling
        """
        print(f"[FluxGenerator] Creating FLUX.2 edit job with {len(input_images)} reference(s)...")
        start_time = time.time()
        
        # Get the correct API endpoint for this model
        endpoint_model = self.MODEL_ENDPOINTS.get(model, model)
        endpoint = f"{BFL_API_BASE}/{endpoint_model}"
        
        headers = {
            "x-key": BFL_API_KEY,
            "Content-Type": "application/json"
        }
        
        payload = {
            "prompt": prompt,
            "width": width,
            "height": height,
            "output_format": "jpeg",
            "input_image": input_images[0]  # First image is required
        }
        
        # Add additional reference images (input_image_2, input_image_3, etc.)
        for i, url in enumerate(input_images[1:], start=2):
            payload[f"input_image_{i}"] = url
        
        if seed is not None:
            payload["seed"] = seed
        
        try:
            response = requests.post(endpoint, headers=headers, json=payload, timeout=60)
            
            if response.status_code != 200 and response.status_code != 201:
                error_data = response.json() if response.text else {}
                error_msg = error_data.get("error", {}).get("message", response.text)
                self._handle_api_error(error_msg)
            
            data = response.json()
            job_id = data.get("id")
            
            if not job_id:
                raise Exception(f"No job ID returned from FLUX.2 API: {data}")
            
            duration = time.time() - start_time
            print(f"[FluxGenerator] ✅ Edit job created: {job_id} ({duration:.2f}s)")
            
            return job_id
            
        except requests.exceptions.RequestException as e:
            self._handle_api_error(str(e))
    
    def _poll_for_completion(self, job_id: str) -> dict:
        """
        Poll the FLUX.2 API until image generation is complete.
        
        Returns:
            Result dictionary containing image URL
        
        Raises:
            Exception: If job fails or times out
        """
        print(f"[FluxGenerator] Polling for completion...")
        start_time = time.time()
        
        headers = {
            "x-key": BFL_API_KEY,
            "Content-Type": "application/json"
        }
        
        polling_url = f"{BFL_API_BASE}/get_result?id={job_id}"
        
        while True:
            elapsed = time.time() - start_time
            
            if elapsed > self.MAX_POLL_TIME:
                raise Exception(
                    f"Image generation timed out after {self.MAX_POLL_TIME} seconds. "
                    "The job may still complete - check back later."
                )
            
            try:
                response = requests.get(polling_url, headers=headers, timeout=30)
                
                if response.status_code != 200:
                    error_data = response.json() if response.text else {}
                    error_msg = error_data.get("error", {}).get("message", response.text)
                    raise Exception(f"Failed to get job status: {error_msg}")
                
                data = response.json()
                status = data.get("status", "unknown")
                
                if status == "Ready":
                    duration = time.time() - start_time
                    print(f"[FluxGenerator] ✅ Image generation completed! ({duration:.2f}s)")
                    return data.get("result", data)
                
                elif status == "Error" or status == "Failed":
                    error = data.get("error", "Unknown error")
                    raise Exception(f"Image generation failed: {error}")
                
                elif status == "Request Moderated":
                    raise Exception(
                        "Content moderation: The prompt or images were flagged. "
                        "Try a different prompt or reference images."
                    )
                
                else:
                    # Still processing (Pending, Processing, etc.)
                    print(f"[FluxGenerator] Status: {status} - waiting {self.POLL_INTERVAL}s...")
                    time.sleep(self.POLL_INTERVAL)
                    
            except requests.exceptions.RequestException as e:
                # Network error - retry
                print(f"[FluxGenerator] Polling error (will retry): {e}")
                time.sleep(self.POLL_INTERVAL)
    
    def _download_and_save(self, image_url: str, agent_handle: str, model: str) -> str:
        """
        Download image from URL and save locally.
        
        Returns:
            Local file path
        """
        # Generate filename with timestamp
        timestamp = int(time.time() * 1000)
        # Sanitize model name for filename
        model_safe = model.replace("-", "_")
        filename = f"{model_safe}_{agent_handle}_{timestamp}.jpg"
        filepath = os.path.join(self.output_dir, filename)
        
        print(f"[FluxGenerator] Downloading image...")
        start_time = time.time()
        
        try:
            response = requests.get(image_url, timeout=60)
            response.raise_for_status()
            
            # Save to file
            with open(filepath, 'wb') as f:
                f.write(response.content)
            
            duration = time.time() - start_time
            file_size = os.path.getsize(filepath)
            print(f"[FluxGenerator] ✅ Downloaded ({file_size / 1024:.1f} KB, {duration:.2f}s)")
            
            return filepath
            
        except Exception as e:
            raise Exception(f"Failed to download image: {e}")
    
    def _save_metadata(
        self,
        image_path: str,
        prompt: str,
        agent_handle: str,
        model: str,
        width: int,
        height: int
    ):
        """Save metadata file alongside the image"""
        metadata_path = image_path.replace('.jpg', '_metadata.txt')
        
        model_display = {
            "flux-2-pro": "FLUX.2 [pro] - Production at scale",
            "flux-2-max": "FLUX.2 [max] - Highest quality",
            "flux-2-klein": "FLUX.2 [klein] - Sub-second generation"
        }.get(model, f"FLUX.2 ({model})")
        
        metadata_content = f"""AI Generated Image Metadata
{"=" * 60}

Agent: @{agent_handle}
Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

Provider: Black Forest Labs
Model: {model_display}
Size: {width}x{height}
Type: Text-to-Image

{"=" * 60}
PROMPT:
{"=" * 60}
{prompt}

{"=" * 60}
IMAGE FILE: {os.path.basename(image_path)}
"""
        
        with open(metadata_path, 'w', encoding='utf-8') as f:
            f.write(metadata_content)
        
        print(f"[FluxGenerator] ✅ Metadata saved: {metadata_path}")
    
    def _save_edit_metadata(
        self,
        image_path: str,
        prompt: str,
        agent_handle: str,
        model: str,
        input_images: List[str],
        width: int,
        height: int
    ):
        """Save metadata file for multi-reference editing"""
        metadata_path = image_path.replace('.jpg', '_metadata.txt')
        
        model_display = {
            "flux-2-pro": "FLUX.2 [pro] - Production at scale",
            "flux-2-max": "FLUX.2 [max] - Highest quality",
            "flux-2-klein": "FLUX.2 [klein] - Sub-second generation"
        }.get(model, f"FLUX.2 ({model})")
        
        ref_images_str = "\n".join([f"  {i+1}. {url}" for i, url in enumerate(input_images)])
        
        metadata_content = f"""AI Edited Image Metadata (Multi-Reference)
{"=" * 60}

Agent: @{agent_handle}
Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

Provider: Black Forest Labs
Model: {model_display}
Size: {width}x{height}
Type: Multi-Reference Image Editing
Reference Images: {len(input_images)}

{"=" * 60}
REFERENCE IMAGES:
{"=" * 60}
{ref_images_str}

{"=" * 60}
EDIT PROMPT:
{"=" * 60}
{prompt}

{"=" * 60}
IMAGE FILE: {os.path.basename(image_path)}
"""
        
        with open(metadata_path, 'w', encoding='utf-8') as f:
            f.write(metadata_content)
        
        print(f"[FluxGenerator] ✅ Metadata saved: {metadata_path}")
    
    def _handle_api_error(self, error_msg: str):
        """Handle common FLUX.2 API errors with helpful messages"""
        error_lower = error_msg.lower()
        
        if "content_policy" in error_lower or "moderat" in error_lower:
            raise Exception(
                "Content policy violation: The prompt may contain restricted content. "
                "Try regenerating with a different topic or prompt."
            )
        elif "rate_limit" in error_lower or "too many" in error_lower:
            raise Exception(
                "Rate limit exceeded: Too many requests. Please wait and try again."
            )
        elif "insufficient" in error_lower or "credit" in error_lower or "quota" in error_lower:
            raise Exception(
                "Insufficient credits: Your FLUX.2 API credits may be exhausted. "
                "Please check your account at https://docs.bfl.ai/"
            )
        elif "invalid" in error_lower and "key" in error_lower:
            raise Exception(
                "Invalid API key: Please check your BFL_API_KEY environment variable."
            )
        elif "unauthorized" in error_lower or "401" in error_msg:
            raise Exception(
                "Unauthorized: Invalid or expired API key. "
                "Please check your BFL_API_KEY environment variable."
            )
        else:
            raise Exception(f"FLUX.2 API error: {error_msg}")


# Convenience functions
def generate_flux_image(
    prompt: str,
    agent_handle: str,
    model: str = "flux-2-pro",
    output_dir: str = "generated_images"
) -> str:
    """
    Generate an image using FLUX.2.
    
    Args:
        prompt: Image generation prompt
        agent_handle: Agent handle
        model: Model variant (flux-2-pro, flux-2-max, flux-2-klein)
        output_dir: Directory to save images
    
    Returns:
        Path to saved image file
    """
    generator = FluxGenerator(output_dir)
    return generator.generate_image(prompt, agent_handle, model)


def generate_flux_with_reference(
    prompt: str,
    agent_handle: str,
    input_images: List[str],
    model: str = "flux-2-pro",
    output_dir: str = "generated_images"
) -> str:
    """
    Generate an image using FLUX.2 multi-reference editing.
    
    Args:
        prompt: Edit instruction
        agent_handle: Agent handle
        input_images: List of reference image URLs
        model: Model variant
        output_dir: Directory to save images
    
    Returns:
        Path to saved image file
    """
    generator = FluxGenerator(output_dir)
    return generator.generate_with_reference(prompt, agent_handle, input_images, model)


# Testing
if __name__ == "__main__":
    from dotenv import load_dotenv
    import sys
    
    # Load environment
    load_dotenv("backend/.env", override=True)
    
    print("=" * 80)
    print("Testing FLUX.2 Generator")
    print("=" * 80)
    
    # Test with a simple prompt
    test_prompt = """
    A professional photograph of a futuristic city skyline at sunset,
    with flying cars and holographic advertisements, cyberpunk style,
    high detail, cinematic lighting, 8K quality.
    """
    
    try:
        filepath = generate_flux_image(test_prompt.strip(), "test_agent", "flux-2-pro")
        print(f"\n✅ Test image saved to: {os.path.abspath(filepath)}")
    except Exception as e:
        print(f"\n❌ Test failed: {e}")
        print("\nNote: Make sure BFL_API_KEY is set in your environment.")
