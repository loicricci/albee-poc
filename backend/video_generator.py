"""
Video Generator Module

Generates videos using OpenAI's SORA 2 API and handles downloading/saving.
Based on the pattern from image_generator.py.

Uses direct REST API calls to support SORA 2 regardless of SDK version.
"""

import os
import requests
import time
import json
from pathlib import Path
from datetime import datetime
from typing import Optional

# Get API key from environment
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
OPENAI_API_BASE = "https://api.openai.com/v1"


class VideoGenerator:
    """
    Generates videos using OpenAI's SORA 2 API.
    Handles video generation, polling, downloading, and local storage.
    
    Key differences from ImageGenerator:
    - Async job model requires polling (jobs take 30-120 seconds)
    - Fixed duration (SORA 2 supports 4, 8, or 12 seconds)
    - Returns .mp4 file instead of .png
    - Higher timeout values (up to 5 minutes)
    """
    
    # Fixed duration for all videos - SORA 2 only supports "4", "8", or "12" as strings
    DURATION = "8"  # Using 8 seconds for balance of quality and cost
    
    # Polling configuration
    POLL_INTERVAL = 5  # seconds between status checks
    MAX_POLL_TIME = 300  # 5 minutes max wait time
    
    def __init__(self, output_dir: str = "generated_videos"):
        self.output_dir = output_dir
        Path(output_dir).mkdir(parents=True, exist_ok=True)
        
        # Verify API key
        if not OPENAI_API_KEY:
            raise ValueError("OPENAI_API_KEY environment variable not set")
    
    def generate_video(
        self, 
        prompt: str, 
        agent_handle: str,
        resolution: str = "720p"
    ) -> str:
        """
        Generate a video using SORA 2 text-to-video and save it locally.
        
        Args:
            prompt: Detailed video generation prompt
            agent_handle: Agent handle (for filename)
            resolution: Video resolution (480p, 720p, 1080p)
        
        Returns:
            Local file path to the saved video
        
        Raises:
            Exception: If video generation or download fails
        """
        print(f"[VideoGenerator] Generating video for @{agent_handle}...")
        print(f"[VideoGenerator] Duration: {self.DURATION}s, Resolution: {resolution}")
        print(f"[VideoGenerator] Prompt preview: {prompt[:100]}...")
        overall_start = time.time()
        
        try:
            # 1. Create video generation job
            job_id = self._create_video_job(prompt, resolution)
            
            # 2. Poll for completion
            video_url = self._poll_for_completion(job_id)
            
            # 3. Download and save
            filepath = self._download_and_save(video_url, agent_handle)
            
            # 4. Save metadata
            self._save_metadata(filepath, prompt, agent_handle, resolution)
            
            total_duration = time.time() - overall_start
            print(f"[VideoGenerator] ✅ Video saved: {filepath} (total: {total_duration:.2f}s)")
            
            return filepath
            
        except Exception as e:
            print(f"[VideoGenerator] ❌ Error: {e}")
            raise
    
    def generate_video_from_image(
        self,
        reference_image_url: str,
        prompt: str,
        agent_handle: str,
        resolution: str = "720p"
    ) -> str:
        """
        Generate a video by animating a reference image using SORA 2.
        
        This creates a video that starts with or is based on the reference image,
        bringing it to life with motion based on the prompt.
        
        Args:
            reference_image_url: URL to the reference image (publicly accessible)
            prompt: Animation/motion description
            agent_handle: Agent handle (for filename)
            resolution: Video resolution (480p, 720p, 1080p)
        
        Returns:
            Local file path to the saved video
        
        Raises:
            Exception: If video generation or download fails
        """
        print(f"[VideoGenerator] Generating video from image for @{agent_handle}...")
        print(f"[VideoGenerator] Duration: {self.DURATION}s, Resolution: {resolution}")
        print(f"[VideoGenerator] Reference image: {reference_image_url[:80]}...")
        print(f"[VideoGenerator] Animation prompt: {prompt[:100]}...")
        overall_start = time.time()
        
        try:
            # 1. Create video generation job with image URL (no download needed)
            # Try URL-based approach first, fall back to base64 if URL fails
            # Determine target size for the video
            target_size = resolution if "x" in resolution else "1280x720"
            
            try:
                job_id = self._create_video_job_with_image_url(reference_image_url, prompt, resolution)
            except Exception as url_error:
                print(f"[VideoGenerator] URL-based approach failed: {url_error}")
                print(f"[VideoGenerator] Falling back to multipart file upload...")
                
                # Download the image
                image_data = self._download_image(reference_image_url)
                
                # Resize to match video resolution (Sora requires exact match)
                print(f"[VideoGenerator] Resizing image to match video resolution {target_size}...")
                image_data = self._resize_image_to_resolution(image_data, target_size)
                
                job_id = self._create_video_job_with_image(image_data, prompt, resolution)
            
            # 2. Poll for completion
            video_url = self._poll_for_completion(job_id)
            
            # 3. Download and save
            filepath = self._download_and_save(video_url, agent_handle)
            
            # 4. Save metadata
            self._save_image_to_video_metadata(
                filepath, prompt, agent_handle, reference_image_url, resolution
            )
            
            total_duration = time.time() - overall_start
            print(f"[VideoGenerator] ✅ Video saved: {filepath} (total: {total_duration:.2f}s)")
            
            return filepath
            
        except Exception as e:
            print(f"[VideoGenerator] ❌ Error: {e}")
            raise
    
    def _create_video_job(self, prompt: str, resolution: str) -> str:
        """
        Create a SORA 2 video generation job using direct REST API.
        
        Returns:
            Job ID for status polling
        """
        print(f"[VideoGenerator] Creating SORA 2 video job...")
        start_time = time.time()
        
        if not OPENAI_API_KEY:
            raise Exception("OPENAI_API_KEY environment variable not set")
        
        try:
            # Direct REST API call to SORA 2
            headers = {
                "Authorization": f"Bearer {OPENAI_API_KEY}",
                "Content-Type": "application/json"
            }
            
            payload = {
                "model": "sora-2",
                "prompt": prompt,
                "seconds": self.DURATION,
                "size": resolution if "x" in resolution else f"1280x720"  # Default to landscape
            }
            
            response = requests.post(
                f"{OPENAI_API_BASE}/videos",
                headers=headers,
                json=payload,
                timeout=60
            )
            
            if response.status_code != 200 and response.status_code != 201:
                error_data = response.json() if response.text else {}
                error_msg = error_data.get("error", {}).get("message", response.text)
                self._handle_api_error(error_msg)
            
            data = response.json()
            job_id = data.get("id")
            
            if not job_id:
                raise Exception("No job ID returned from SORA 2 API")
            
            duration = time.time() - start_time
            print(f"[VideoGenerator] ✅ Job created: {job_id} ({duration:.2f}s)")
            
            return job_id
            
        except requests.exceptions.RequestException as e:
            self._handle_api_error(str(e))
    
    def _create_video_job_with_image(
        self, 
        image_data: bytes, 
        prompt: str, 
        resolution: str
    ) -> str:
        """
        Create a SORA 2 video generation job with a reference image using multipart/form-data.
        
        The Sora 2 API requires input_reference to be uploaded as a FILE, not as JSON.
        Uses multipart/form-data with the 'files' parameter in requests.
        
        Returns:
            Job ID for status polling
        """
        print(f"[VideoGenerator] Creating SORA 2 image-to-video job (multipart)...")
        start_time = time.time()
        
        if not OPENAI_API_KEY:
            raise Exception("OPENAI_API_KEY environment variable not set")
        
        try:
            # Headers - DON'T set Content-Type, requests will set it with boundary for multipart
            headers = {
                "Authorization": f"Bearer {OPENAI_API_KEY}"
            }
            
            # Form data (non-file fields)
            form_data = {
                "model": "sora-2",
                "prompt": prompt,
                "seconds": self.DURATION,
                "size": resolution if "x" in resolution else "1280x720"
            }
            
            # File upload - input_reference must be a FILE, not JSON
            # Tuple format: (filename, file_content, content_type)
            files = {
                "input_reference": ("reference.png", image_data, "image/png")
            }
            
            response = requests.post(
                f"{OPENAI_API_BASE}/videos",
                headers=headers,
                data=form_data,  # Use 'data' not 'json' for multipart
                files=files,     # File upload
                timeout=120
            )
            
            if response.status_code != 200 and response.status_code != 201:
                error_data = response.json() if response.text else {}
                error_msg = error_data.get("error", {}).get("message", response.text)
                self._handle_api_error(error_msg)
            
            data = response.json()
            job_id = data.get("id")
            
            if not job_id:
                raise Exception("No job ID returned from SORA 2 API")
            
            duration = time.time() - start_time
            print(f"[VideoGenerator] ✅ Image-to-video job created: {job_id} ({duration:.2f}s)")
            
            return job_id
            
        except requests.exceptions.RequestException as e:
            self._handle_api_error(str(e))
    
    def _create_video_job_with_image_url(
        self, 
        image_url: str, 
        prompt: str, 
        resolution: str
    ) -> str:
        """
        DEPRECATED: Sora 2 API does NOT support passing image URLs as JSON.
        It requires multipart/form-data file upload.
        
        This method now always raises to trigger fallback to multipart approach.
        """
        # Sora 2 API requires multipart/form-data file upload, not JSON with URL
        raise Exception("Sora 2 API requires file upload, not URL - falling back to multipart")
    
    def _poll_for_completion(self, job_id: str) -> str:
        """
        Poll the SORA 2 API until video generation is complete using direct REST API.
        
        Returns:
            URL to the completed video
        
        Raises:
            Exception: If job fails or times out
        """
        print(f"[VideoGenerator] Polling for completion...")
        start_time = time.time()
        
        if not OPENAI_API_KEY:
            raise Exception("OPENAI_API_KEY environment variable not set")
        
        headers = {
            "Authorization": f"Bearer {OPENAI_API_KEY}",
            "Content-Type": "application/json"
        }
        
        while True:
            elapsed = time.time() - start_time
            
            if elapsed > self.MAX_POLL_TIME:
                raise Exception(
                    f"Video generation timed out after {self.MAX_POLL_TIME} seconds. "
                    "The job may still complete - check back later."
                )
            
            try:
                response = requests.get(
                    f"{OPENAI_API_BASE}/videos/{job_id}",
                    headers=headers,
                    timeout=30
                )
                
                if response.status_code != 200:
                    error_data = response.json() if response.text else {}
                    error_msg = error_data.get("error", {}).get("message", response.text)
                    raise Exception(f"Failed to get video status: {error_msg}")
                
                data = response.json()
                status = data.get("status", "unknown")
                
                if status == "completed":
                    duration = time.time() - start_time
                    print(f"[VideoGenerator] ✅ Video generation completed! ({duration:.2f}s)")
                    
                    # Get video URL - might be in different fields
                    video_url = data.get("url") or data.get("video_url") or data.get("output", {}).get("url")
                    
                    if not video_url:
                        # May need to call content endpoint
                        video_url = f"{OPENAI_API_BASE}/videos/{job_id}/content"
                    
                    return video_url
                
                elif status == "failed":
                    error = data.get('error', 'Unknown error')
                    raise Exception(f"Video generation failed: {error}")
                
                elif status == "cancelled":
                    raise Exception("Video generation was cancelled")
                
                else:
                    # Still processing
                    progress = data.get('progress')
                    progress_str = f" ({progress}%)" if progress else ""
                    print(f"[VideoGenerator] Status: {status}{progress_str} - waiting {self.POLL_INTERVAL}s...")
                    time.sleep(self.POLL_INTERVAL)
                    
            except requests.exceptions.RequestException as e:
                # Network error - retry
                print(f"[VideoGenerator] Polling error (will retry): {e}")
                time.sleep(self.POLL_INTERVAL)
    
    def _download_image(self, url: str) -> bytes:
        """
        Download image from URL.
        
        Returns:
            Binary image data
        """
        try:
            response = requests.get(url, timeout=60)
            response.raise_for_status()
            return response.content
        except Exception as e:
            raise Exception(f"Failed to download reference image: {e}")
    
    def _resize_image_to_resolution(self, image_data: bytes, target_size: str) -> bytes:
        """
        Resize image to match the target video resolution.
        
        Sora 2 requires the input_reference image to EXACTLY match the video size.
        This resizes/pads the image to fit the target resolution.
        
        Args:
            image_data: Original image bytes
            target_size: Target resolution (e.g., "1280x720")
        
        Returns:
            Resized image bytes as PNG
        """
        from PIL import Image
        import io
        
        # Parse target dimensions
        if "x" in target_size:
            target_width, target_height = map(int, target_size.split("x"))
        else:
            # Default to 720p landscape
            target_width, target_height = 1280, 720
        
        # Load the image
        img = Image.open(io.BytesIO(image_data))
        original_width, original_height = img.size
        
        # Convert to RGB if necessary (for PNG with alpha)
        if img.mode in ('RGBA', 'LA', 'P'):
            # Create a white background
            background = Image.new('RGB', img.size, (255, 255, 255))
            if img.mode == 'P':
                img = img.convert('RGBA')
            background.paste(img, mask=img.split()[-1] if img.mode == 'RGBA' else None)
            img = background
        elif img.mode != 'RGB':
            img = img.convert('RGB')
        
        # Calculate aspect ratios
        target_ratio = target_width / target_height
        original_ratio = original_width / original_height
        
        # Resize to fit within target, maintaining aspect ratio, then pad
        if original_ratio > target_ratio:
            # Image is wider - fit to width
            new_width = target_width
            new_height = int(target_width / original_ratio)
        else:
            # Image is taller - fit to height
            new_height = target_height
            new_width = int(target_height * original_ratio)
        
        # Resize with high quality
        img_resized = img.resize((new_width, new_height), Image.Resampling.LANCZOS)
        
        # Create target canvas and paste centered
        canvas = Image.new('RGB', (target_width, target_height), (0, 0, 0))  # Black background
        paste_x = (target_width - new_width) // 2
        paste_y = (target_height - new_height) // 2
        canvas.paste(img_resized, (paste_x, paste_y))
        
        # Save to bytes
        output = io.BytesIO()
        canvas.save(output, format='PNG', optimize=True)
        result_bytes = output.getvalue()
        
        return result_bytes
    
    def _download_and_save(self, video_url: str, agent_handle: str) -> str:
        """
        Download video from URL and save locally.
        Uses authenticated request if downloading from OpenAI API.
        
        Returns:
            Local file path
        """
        # Generate filename with timestamp
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"{agent_handle}_video_{timestamp}.mp4"
        filepath = os.path.join(self.output_dir, filename)
        
        print(f"[VideoGenerator] Downloading video...")
        start_time = time.time()
        
        try:
            # Add auth header if downloading from OpenAI API
            headers = {}
            if "api.openai.com" in video_url:
                headers["Authorization"] = f"Bearer {OPENAI_API_KEY}"
            
            response = requests.get(video_url, headers=headers, timeout=120, stream=True)
            response.raise_for_status()
            
            # Save to file with streaming for large videos
            with open(filepath, 'wb') as f:
                for chunk in response.iter_content(chunk_size=8192):
                    f.write(chunk)
            
            duration = time.time() - start_time
            file_size = os.path.getsize(filepath)
            print(f"[VideoGenerator] ✅ Downloaded ({file_size / (1024*1024):.1f} MB, {duration:.2f}s)")
            
            return filepath
            
        except Exception as e:
            raise Exception(f"Failed to download video: {e}")
    
    def _save_metadata(
        self, 
        video_path: str, 
        prompt: str, 
        agent_handle: str,
        resolution: str
    ):
        """Save metadata file alongside the video"""
        metadata_path = video_path.replace('.mp4', '_metadata.txt')
        
        metadata_content = f"""AI Generated Video Metadata
{"=" * 60}

Agent: @{agent_handle}
Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

Model: SORA 2
Duration: {self.DURATION} seconds
Resolution: {resolution}
Type: Text-to-Video

{"=" * 60}
PROMPT:
{"=" * 60}
{prompt}

{"=" * 60}
VIDEO FILE: {os.path.basename(video_path)}
"""
        
        with open(metadata_path, 'w', encoding='utf-8') as f:
            f.write(metadata_content)
        
        print(f"[VideoGenerator] ✅ Metadata saved: {metadata_path}")
    
    def _save_image_to_video_metadata(
        self,
        video_path: str,
        prompt: str,
        agent_handle: str,
        reference_url: str,
        resolution: str
    ):
        """Save metadata file for image-to-video generation"""
        metadata_path = video_path.replace('.mp4', '_metadata.txt')
        
        metadata_content = f"""AI Generated Video Metadata (Image-to-Video)
{"=" * 60}

Agent: @{agent_handle}
Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

Model: SORA 2
Duration: {self.DURATION} seconds
Resolution: {resolution}
Type: Image-to-Video
Reference Image: {reference_url}

{"=" * 60}
ANIMATION PROMPT:
{"=" * 60}
{prompt}

{"=" * 60}
VIDEO FILE: {os.path.basename(video_path)}
"""
        
        with open(metadata_path, 'w', encoding='utf-8') as f:
            f.write(metadata_content)
        
        print(f"[VideoGenerator] ✅ Metadata saved: {metadata_path}")
    
    def _handle_api_error(self, error_msg: str):
        """Handle common SORA 2 API errors with helpful messages"""
        if "content_policy_violation" in error_msg.lower():
            raise Exception(
                "Content policy violation: The prompt may contain restricted content. "
                "Try regenerating with a different topic or prompt."
            )
        elif "rate_limit" in error_msg.lower():
            raise Exception(
                "Rate limit exceeded: Too many video requests. Please wait and try again."
            )
        elif "insufficient_quota" in error_msg.lower():
            raise Exception(
                "Insufficient quota: Video generation quota exceeded. "
                "Please check your OpenAI account limits."
            )
        elif "model_not_found" in error_msg.lower() or "invalid_model" in error_msg.lower():
            raise Exception(
                "SORA 2 model not available. Please ensure you have API access to SORA 2."
            )
        else:
            raise Exception(f"SORA 2 API error: {error_msg}")
    
    # =========================================================================
    # SORA 2 PRO METHODS - Higher quality video generation
    # =========================================================================
    
    # Pro settings - higher quality than standard SORA 2
    PRO_DURATION = "12"  # Pro supports longer videos
    PRO_DEFAULT_RESOLUTION = "1080p"
    
    def generate_video_pro(
        self, 
        prompt: str, 
        agent_handle: str,
        resolution: str = "1080p"
    ) -> str:
        """
        Generate a video using SORA 2 Pro text-to-video and save it locally.
        
        SORA 2 Pro offers higher quality output, better motion coherence,
        and improved photorealism compared to standard SORA 2.
        
        Args:
            prompt: Detailed video generation prompt
            agent_handle: Agent handle (for filename)
            resolution: Video resolution (720p, 1080p, 4k)
        
        Returns:
            Local file path to the saved video
        
        Raises:
            Exception: If video generation or download fails
        """
        print(f"[VideoGenerator] Generating PRO video for @{agent_handle}...")
        print(f"[VideoGenerator] Model: SORA 2 Pro")
        print(f"[VideoGenerator] Duration: {self.PRO_DURATION}s, Resolution: {resolution}")
        print(f"[VideoGenerator] Prompt preview: {prompt[:100]}...")
        overall_start = time.time()
        
        try:
            # 1. Create video generation job with Pro model
            job_id = self._create_video_job_pro(prompt, resolution)
            
            # 2. Poll for completion
            video_url = self._poll_for_completion(job_id)
            
            # 3. Download and save
            filepath = self._download_and_save_pro(video_url, agent_handle)
            
            # 4. Save metadata
            self._save_pro_metadata(filepath, prompt, agent_handle, resolution)
            
            total_duration = time.time() - overall_start
            print(f"[VideoGenerator] ✅ Pro video saved: {filepath} (total: {total_duration:.2f}s)")
            
            return filepath
            
        except Exception as e:
            print(f"[VideoGenerator] ❌ Error: {e}")
            raise
    
    def generate_video_from_image_pro(
        self,
        reference_image_url: str,
        prompt: str,
        agent_handle: str,
        resolution: str = "1080p"
    ) -> str:
        """
        Generate a video by animating a reference image using SORA 2 Pro.
        
        Creates a high-quality video that starts with or is based on the 
        reference image, bringing it to life with motion based on the prompt.
        
        Args:
            reference_image_url: URL to the reference image
            prompt: Animation/motion description
            agent_handle: Agent handle (for filename)
            resolution: Video resolution (720p, 1080p, 4k)
        
        Returns:
            Local file path to the saved video
        
        Raises:
            Exception: If video generation or download fails
        """
        print(f"[VideoGenerator] Generating PRO video from image for @{agent_handle}...")
        print(f"[VideoGenerator] Model: SORA 2 Pro (Image-to-Video)")
        print(f"[VideoGenerator] Duration: {self.PRO_DURATION}s, Resolution: {resolution}")
        print(f"[VideoGenerator] Reference image: {reference_image_url[:50]}...")
        print(f"[VideoGenerator] Animation prompt: {prompt[:100]}...")
        overall_start = time.time()
        
        try:
            # 1. Download reference image for the API
            print(f"[VideoGenerator] Downloading reference image...")
            image_data = self._download_image(reference_image_url)
            
            # 2. Create video generation job with image using Pro model
            job_id = self._create_video_job_with_image_pro(image_data, prompt, resolution)
            
            # 3. Poll for completion
            video_url = self._poll_for_completion(job_id)
            
            # 4. Download and save
            filepath = self._download_and_save_pro(video_url, agent_handle)
            
            # 5. Save metadata
            self._save_image_to_video_pro_metadata(
                filepath, prompt, agent_handle, reference_image_url, resolution
            )
            
            total_duration = time.time() - overall_start
            print(f"[VideoGenerator] ✅ Pro video saved: {filepath} (total: {total_duration:.2f}s)")
            
            return filepath
            
        except Exception as e:
            print(f"[VideoGenerator] ❌ Error: {e}")
            raise
    
    def _create_video_job_pro(self, prompt: str, resolution: str) -> str:
        """
        Create a SORA 2 Pro video generation job using direct REST API.
        
        Returns:
            Job ID for status polling
        """
        print(f"[VideoGenerator] Creating SORA 2 Pro video job...")
        start_time = time.time()
        
        if not OPENAI_API_KEY:
            raise Exception("OPENAI_API_KEY environment variable not set")
        
        try:
            headers = {
                "Authorization": f"Bearer {OPENAI_API_KEY}",
                "Content-Type": "application/json"
            }
            
            # Map resolution to actual dimensions for Pro
            resolution_map = {
                "720p": "1280x720",
                "1080p": "1920x1080",
                "4k": "3840x2160"
            }
            size = resolution_map.get(resolution, resolution if "x" in resolution else "1920x1080")
            
            payload = {
                "model": "sora-2-pro",
                "prompt": prompt,
                "seconds": self.PRO_DURATION,
                "size": size
            }
            
            response = requests.post(
                f"{OPENAI_API_BASE}/videos",
                headers=headers,
                json=payload,
                timeout=60
            )
            
            if response.status_code != 200 and response.status_code != 201:
                error_data = response.json() if response.text else {}
                error_msg = error_data.get("error", {}).get("message", response.text)
                self._handle_api_error(error_msg)
            
            data = response.json()
            job_id = data.get("id")
            
            if not job_id:
                raise Exception("No job ID returned from SORA 2 Pro API")
            
            duration = time.time() - start_time
            print(f"[VideoGenerator] ✅ Pro job created: {job_id} ({duration:.2f}s)")
            
            return job_id
            
        except requests.exceptions.RequestException as e:
            self._handle_api_error(str(e))
    
    def _create_video_job_with_image_pro(
        self, 
        image_data: bytes, 
        prompt: str, 
        resolution: str
    ) -> str:
        """
        Create a SORA 2 Pro video generation job with a reference image.
        
        Returns:
            Job ID for status polling
        """
        print(f"[VideoGenerator] Creating SORA 2 Pro image-to-video job...")
        start_time = time.time()
        
        if not OPENAI_API_KEY:
            raise Exception("OPENAI_API_KEY environment variable not set")
        
        try:
            import base64
            
            # Convert image to base64 for API
            image_b64 = base64.b64encode(image_data).decode('utf-8')
            
            headers = {
                "Authorization": f"Bearer {OPENAI_API_KEY}",
                "Content-Type": "application/json"
            }
            
            # Map resolution to actual dimensions
            resolution_map = {
                "720p": "1280x720",
                "1080p": "1920x1080",
                "4k": "3840x2160"
            }
            size = resolution_map.get(resolution, resolution if "x" in resolution else "1920x1080")
            
            payload = {
                "model": "sora-2-pro",
                "prompt": prompt,
                "seconds": self.PRO_DURATION,
                "size": size,
                "image": f"data:image/png;base64,{image_b64}"
            }
            
            response = requests.post(
                f"{OPENAI_API_BASE}/videos",
                headers=headers,
                json=payload,
                timeout=120  # Longer timeout for image upload
            )
            
            if response.status_code != 200 and response.status_code != 201:
                error_data = response.json() if response.text else {}
                error_msg = error_data.get("error", {}).get("message", response.text)
                self._handle_api_error(error_msg)
            
            data = response.json()
            job_id = data.get("id")
            
            if not job_id:
                raise Exception("No job ID returned from SORA 2 Pro API")
            
            duration = time.time() - start_time
            print(f"[VideoGenerator] ✅ Pro image-to-video job created: {job_id} ({duration:.2f}s)")
            
            return job_id
            
        except requests.exceptions.RequestException as e:
            self._handle_api_error(str(e))
    
    def _download_and_save_pro(self, video_url: str, agent_handle: str) -> str:
        """
        Download Pro video from URL and save locally.
        
        Returns:
            Local file path
        """
        # Generate filename with timestamp - distinguish Pro videos
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"{agent_handle}_video_pro_{timestamp}.mp4"
        filepath = os.path.join(self.output_dir, filename)
        
        print(f"[VideoGenerator] Downloading Pro video...")
        start_time = time.time()
        
        try:
            # Add auth header if downloading from OpenAI API
            headers = {}
            if "api.openai.com" in video_url:
                headers["Authorization"] = f"Bearer {OPENAI_API_KEY}"
            
            response = requests.get(video_url, headers=headers, timeout=180, stream=True)
            response.raise_for_status()
            
            # Save to file with streaming for large videos
            with open(filepath, 'wb') as f:
                for chunk in response.iter_content(chunk_size=8192):
                    f.write(chunk)
            
            duration = time.time() - start_time
            file_size = os.path.getsize(filepath)
            print(f"[VideoGenerator] ✅ Pro video downloaded ({file_size / (1024*1024):.1f} MB, {duration:.2f}s)")
            
            return filepath
            
        except Exception as e:
            raise Exception(f"Failed to download Pro video: {e}")
    
    def _save_pro_metadata(
        self, 
        video_path: str, 
        prompt: str, 
        agent_handle: str,
        resolution: str
    ):
        """Save metadata file for SORA 2 Pro video"""
        metadata_path = video_path.replace('.mp4', '_metadata.txt')
        
        metadata_content = f"""AI Generated Video Metadata
{"=" * 60}

Agent: @{agent_handle}
Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

Model: SORA 2 Pro (High Quality)
Duration: {self.PRO_DURATION} seconds
Resolution: {resolution}
Type: Text-to-Video (Pro)

{"=" * 60}
PROMPT:
{"=" * 60}
{prompt}

{"=" * 60}
VIDEO FILE: {os.path.basename(video_path)}
"""
        
        with open(metadata_path, 'w', encoding='utf-8') as f:
            f.write(metadata_content)
        
        print(f"[VideoGenerator] ✅ Pro metadata saved: {metadata_path}")
    
    def _save_image_to_video_pro_metadata(
        self,
        video_path: str,
        prompt: str,
        agent_handle: str,
        reference_url: str,
        resolution: str
    ):
        """Save metadata file for SORA 2 Pro image-to-video generation"""
        metadata_path = video_path.replace('.mp4', '_metadata.txt')
        
        metadata_content = f"""AI Generated Video Metadata (Image-to-Video)
{"=" * 60}

Agent: @{agent_handle}
Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

Model: SORA 2 Pro (High Quality)
Duration: {self.PRO_DURATION} seconds
Resolution: {resolution}
Type: Image-to-Video (Pro)
Reference Image: {reference_url}

{"=" * 60}
ANIMATION PROMPT:
{"=" * 60}
{prompt}

{"=" * 60}
VIDEO FILE: {os.path.basename(video_path)}
"""
        
        with open(metadata_path, 'w', encoding='utf-8') as f:
            f.write(metadata_content)
        
        print(f"[VideoGenerator] ✅ Pro metadata saved: {metadata_path}")

    def extract_thumbnail(self, video_path: str) -> Optional[str]:
        """
        Extract the first frame from a video as a thumbnail.
        
        Returns:
            Path to thumbnail image, or None if extraction fails
        """
        try:
            import subprocess
            
            thumbnail_path = video_path.replace('.mp4', '_thumb.jpg')
            
            # Use ffmpeg to extract first frame
            cmd = [
                'ffmpeg', '-i', video_path,
                '-vframes', '1',
                '-q:v', '2',
                '-y',  # Overwrite if exists
                thumbnail_path
            ]
            
            subprocess.run(cmd, capture_output=True, check=True)
            
            if os.path.exists(thumbnail_path):
                print(f"[VideoGenerator] ✅ Thumbnail extracted: {thumbnail_path}")
                return thumbnail_path
            else:
                return None
                
        except Exception as e:
            print(f"[VideoGenerator] ⚠️ Thumbnail extraction failed: {e}")
            return None


# Convenience function
def generate_video(
    prompt: str, 
    agent_handle: str,
    output_dir: str = "generated_videos"
) -> str:
    """
    Generate a video for a social media post.
    
    Args:
        prompt: Video generation prompt
        agent_handle: Agent handle
        output_dir: Directory to save videos
    
    Returns:
        Path to saved video file
    """
    generator = VideoGenerator(output_dir)
    return generator.generate_video(prompt, agent_handle)


def generate_video_from_image(
    reference_image_url: str,
    prompt: str, 
    agent_handle: str,
    output_dir: str = "generated_videos"
) -> str:
    """
    Generate a video by animating a reference image.
    
    Args:
        reference_image_url: URL to reference image
        prompt: Animation prompt
        agent_handle: Agent handle
        output_dir: Directory to save videos
    
    Returns:
        Path to saved video file
    """
    generator = VideoGenerator(output_dir)
    return generator.generate_video_from_image(
        reference_image_url, prompt, agent_handle
    )


# Testing
if __name__ == "__main__":
    from dotenv import load_dotenv
    import sys
    
    # Load environment
    load_dotenv("backend/.env", override=True)
    
    print("=" * 80)
    print("Testing Video Generator (SORA 2)")
    print("=" * 80)
    
    # Test with a simple prompt
    test_prompt = """
    A professional musician performing on a grand piano on a stage,
    camera slowly panning around them, dramatic lighting in warm tones,
    cinematic quality, smooth motion.
    """
    
    try:
        filepath = generate_video(test_prompt.strip(), "test_agent")
        print(f"\n✅ Test video saved to: {os.path.abspath(filepath)}")
    except Exception as e:
        print(f"\n❌ Test failed: {e}")
        print("\nNote: SORA 2 API access may be required.")
