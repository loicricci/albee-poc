"""
Post Creation Service

Handles uploading images to Supabase storage and creating posts in the database.
Based on patterns from create_elton_post.py.
"""

import os
import uuid
import json
import requests
import time
from datetime import datetime
from typing import Dict, Any, Optional
from sqlalchemy import text

# Import shared database session
from backend.db import SessionLocal

# Import caching
from backend.cache import agent_cache


def create_autopost_notification(db_session, user_id: str, agent_handle: str, post_id: str):
    """Create a notification for successful autopost"""
    try:
        from notifications_api import create_notification
        import uuid
        
        create_notification(
            db=db_session,
            user_id=uuid.UUID(user_id),
            notification_type="autopost_success",
            title="Auto-post successful",
            message=f"A new post was automatically created for @{agent_handle}",
            link=f"/profile/{agent_handle}",
            related_agent_id=None,  # We'll add this below if needed
            related_post_id=uuid.UUID(post_id)
        )
    except Exception as e:
        print(f"Error creating autopost notification: {e}")
        # Rollback the failed notification transaction
        db_session.rollback()


class PostCreationService:
    """
    Service for creating AI-generated posts.
    Handles:
    1. Uploading images to Supabase storage
    2. Creating post entries in the database
    3. Storing AI metadata
    """
    
    def __init__(self):
        # Database connection (use shared pool)
        self.session = SessionLocal()
        
        # Supabase configuration
        self.supabase_url = os.getenv("SUPABASE_URL")
        self.supabase_service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        
        if not self.supabase_url or not self.supabase_service_key:
            raise ValueError("Supabase environment variables not set")
    
    def create_post(
        self,
        agent_handle: str,
        image_path: str,
        title: str,
        description: str,
        topic: Dict[str, str],
        image_prompt: str,
        visibility: str = "public"
    ) -> Dict[str, Any]:
        """
        Create a complete post with image upload and database entry.
        
        Args:
            agent_handle: Agent's handle
            image_path: Local path to generated image
            title: Post title
            description: Post description
            topic: Topic dictionary from NewsTopicFetcher
            image_prompt: DALL-E prompt used
            visibility: Post visibility (public, friends, intimate)
        
        Returns:
            Dictionary with:
        - post_id: Created post ID
        - image_url: Public Supabase URL
        - created_at: Timestamp
        - view_url: URL to view the post
        
        Raises:
                Exception: If upload or database insertion fails
        """
        print(f"[PostCreationService] Creating post for @{agent_handle}...")
        overall_start = time.time()
        
        try:
            # 1. Get user ID and agent ID
            get_user_start = time.time()
            user_id, agent_id = self._get_user_id(agent_handle)
            get_user_duration = time.time() - get_user_start
            print(f"[PostCreationService]   User lookup: {get_user_duration:.2f}s")
            
            # 2. Upload image to Supabase
            upload_start = time.time()
            image_url = self._upload_to_supabase(image_path, user_id)
            upload_duration = time.time() - upload_start
            print(f"[PostCreationService]   Image upload: {upload_duration:.2f}s")
            
            # 3. Create post in database
            db_start = time.time()
            post_id, created_at = self._insert_post(
        user_id=user_id,
        agent_id=agent_id,
        title=title,
        description=description,
        image_url=image_url,
        topic=topic,
        image_prompt=image_prompt,
        visibility=visibility
            )
            db_duration = time.time() - db_start
            print(f"[PostCreationService]   DB insert: {db_duration:.2f}s")
            
            total_duration = time.time() - overall_start
            
            result = {
        "post_id": post_id,
        "image_url": image_url,
        "created_at": created_at,
        "view_url": f"http://localhost:3000/u/{agent_handle}",
        "agent_handle": agent_handle
            }
            
            print(f"[PostCreationService] ✅ Post created successfully! (total: {total_duration:.2f}s)")
            print(f"[PostCreationService]    Post ID: {post_id}")
            print(f"[PostCreationService]    View at: {result['view_url']}")
            
            # Create notification for successful autopost
            try:
                create_autopost_notification(self.session, user_id, agent_handle, post_id)
            except Exception as e:
                print(f"[PostCreationService] Warning: Failed to create notification: {e}")
            
            return result
            
        except Exception as e:
            print(f"[PostCreationService] ❌ Error creating post: {e}")
            raise
    
    def _get_user_id(self, agent_handle: str) -> tuple[str, str]:
        """Get user_id and agent_id from agent handle"""
        
        # Check cache first
        cache_key = f"agent_ids:{agent_handle}"
        cached = agent_cache.get(cache_key)
        if cached:
            print(f"[PostCreationService] ✅ Cache hit for @{agent_handle} IDs")
            return cached["user_id"], cached["agent_id"]
        
        query = text("""
            SELECT owner_user_id, id
            FROM avees
            WHERE handle = :handle
            LIMIT 1
        """)
        
        result = self.session.execute(query, {"handle": agent_handle})
        row = result.fetchone()
        
        if not row:
            raise ValueError(f"Agent @{agent_handle} not found in database")
        
        user_id = str(row[0])
        agent_id = str(row[1])
        
        # Cache for 5 minutes (IDs never change, but keep TTL moderate)
        agent_cache.set(cache_key, {
            "user_id": user_id,
            "agent_id": agent_id
        }, ttl=300)
        
        print(f"[PostCreationService] Found user_id: {user_id}, agent_id: {agent_id}")
        
        return user_id, agent_id
    
    def _upload_to_supabase(self, image_path: str, user_id: str) -> str:
        """
        Upload image to Supabase storage bucket.
        
        Returns:
            Public URL to the uploaded image
        """
        print(f"[PostCreationService] Uploading image to Supabase...")
        
        # Read image file
        with open(image_path, 'rb') as f:
            image_data = f.read()
        
        # Generate unique filename
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f"post_{user_id}_{timestamp}.png"
        
        # Upload to Supabase storage
        storage_url = f"{self.supabase_url}/storage/v1/object/app-images/posts/{filename}"
        
        headers = {
            'Authorization': f'Bearer {self.supabase_service_key}',
            'Content-Type': 'image/png',
        }
        
        try:
            response = requests.post(storage_url, headers=headers, data=image_data, timeout=60)
            
            if response.status_code in [200, 201]:
                # Return public URL
                public_url = f"{self.supabase_url}/storage/v1/object/public/app-images/posts/{filename}"
                print(f"[PostCreationService] ✅ Image uploaded: {filename}")
                return public_url
            else:
                error_detail = response.text
                raise Exception(f"Upload failed ({response.status_code}): {error_detail}")
        
        except requests.exceptions.RequestException as e:
            raise Exception(f"Network error uploading image: {e}")
    
    def _insert_post(
        self,
        user_id: str,
        agent_id: str,
        title: str,
        description: str,
        image_url: str,
        topic: Dict[str, str],
        image_prompt: str,
        visibility: str
    ) -> tuple[str, datetime]:
        """
        Insert post into database.
        
        Returns:
            Tuple of (post_id, created_at)
        """
        print(f"[PostCreationService] Inserting post into database...")
        
        post_id = str(uuid.uuid4())
        
        # Prepare AI metadata
        ai_metadata = {
            "model": "DALL-E 3",
            "generator": "OpenAI",
            "quality": "hd",
            "size": "1792x1024",
            "style": "vivid",
            "prompt": image_prompt[:500] if len(image_prompt) > 500 else image_prompt,
            "topic": topic["topic"],
            "topic_category": topic["category"],
            "topic_source": topic.get("source", "unknown"),
            "generation_date": datetime.now().strftime('%Y-%m-%d'),
            "automated": True
        }
        
        query = text("""
            INSERT INTO posts (
                id, owner_user_id, agent_id, title, description, image_url,
                post_type, ai_metadata, visibility,
                like_count, comment_count, share_count,
                created_at
            ) VALUES (
                :id, :owner_user_id, :agent_id, :title, :description, :image_url,
                :post_type, :ai_metadata, :visibility,
                0, 0, 0,
                NOW()
            )
            RETURNING id, created_at
        """)
        
        try:
            result = self.session.execute(query, {
                "id": post_id,
                "owner_user_id": user_id,
                "agent_id": agent_id,
                "title": title,
                "description": description,
                "image_url": image_url,
                "post_type": "ai_generated",
                "ai_metadata": json.dumps(ai_metadata),
                "visibility": visibility
            })
            
            self.session.commit()
            
            row = result.fetchone()
            
            print(f"[PostCreationService] ✅ Post inserted: {row[0]}")
            
            return str(row[0]), row[1]
            
        except Exception as e:
            self.session.rollback()
            raise Exception(f"Database insertion failed: {e}")
    
    def close(self):
        """Close database session"""
        self.session.close()
    
    def __enter__(self):
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()


# Convenience function
def create_post(
    agent_handle: str,
    image_path: str,
    title: str,
    description: str,
    topic: Dict[str, str],
    image_prompt: str,
    visibility: str = "public"
) -> Dict[str, Any]:
    """
    Create a post (convenience wrapper).
    
    Args:
        agent_handle: Agent's handle
        image_path: Local path to image
        title: Post title
        description: Post description
        topic: Topic dictionary
        image_prompt: Image generation prompt
        visibility: Post visibility
    
    Returns:
        Dictionary with post details
    """
    with PostCreationService() as service:
        return service.create_post(
            agent_handle=agent_handle,
            image_path=image_path,
            title=title,
            description=description,
            topic=topic,
            image_prompt=image_prompt,
            visibility=visibility
        )


def create_post_from_preview(
    agent_handle: str,
    image_url: str,
    title: str,
    description: str,
    topic: Dict[str, str],
    image_prompt: str,
    visibility: str = "public"
) -> Dict[str, Any]:
    """
    Create a post from a preview (image already uploaded to storage).
    
    This is used by the post approval workflow where the image
    has already been uploaded to temp storage and moved to permanent.
    
    Args:
        agent_handle: Agent's handle
        image_url: URL of the already-uploaded image
        title: Post title
        description: Post description
        topic: Topic dictionary
        image_prompt: Image generation prompt
        visibility: Post visibility
    
    Returns:
        Dictionary with post details
    """
    print(f"[PostCreationService] Creating post from preview for @{agent_handle}...")
    
    session = SessionLocal()
    
    try:
        # Get user ID and agent ID
        query = text("""
            SELECT owner_user_id, id
            FROM avees
            WHERE handle = :handle
            LIMIT 1
        """)
        
        result = session.execute(query, {"handle": agent_handle})
        row = result.fetchone()
        
        if not row:
            raise ValueError(f"Agent @{agent_handle} not found in database")
        
        user_id = str(row[0])
        agent_id = str(row[1])
        
        # Generate post ID
        post_id = str(uuid.uuid4())
        
        # Prepare AI metadata
        ai_metadata = {
            "model": "DALL-E 3",
            "generator": "OpenAI",
            "quality": "hd",
            "size": "1792x1024",
            "style": "vivid",
            "prompt": image_prompt[:500] if len(image_prompt) > 500 else image_prompt,
            "topic": topic.get("topic", "Unknown"),
            "topic_category": topic.get("category", "general"),
            "topic_source": topic.get("source", "unknown"),
            "generation_date": datetime.now().strftime('%Y-%m-%d'),
            "automated": True,
            "from_preview": True
        }
        
        # Insert post
        insert_query = text("""
            INSERT INTO posts (
                id, owner_user_id, agent_id, title, description, image_url,
                post_type, ai_metadata, visibility,
                like_count, comment_count, share_count,
                created_at
            ) VALUES (
                :id, :owner_user_id, :agent_id, :title, :description, :image_url,
                :post_type, :ai_metadata, :visibility,
                0, 0, 0,
                NOW()
            )
            RETURNING id, created_at
        """)
        
        result = session.execute(insert_query, {
            "id": post_id,
            "owner_user_id": user_id,
            "agent_id": agent_id,
            "title": title,
            "description": description,
            "image_url": image_url,
            "post_type": "ai_generated",
            "ai_metadata": json.dumps(ai_metadata),
            "visibility": visibility
        })
        
        session.commit()
        
        row = result.fetchone()
        created_at = row[1]
        
        print(f"[PostCreationService] ✅ Post created from preview: {post_id}")
        
        # Create notification
        try:
            create_autopost_notification(session, user_id, agent_handle, post_id)
        except Exception as e:
            print(f"[PostCreationService] Warning: Failed to create notification: {e}")
        
        return {
            "post_id": post_id,
            "image_url": image_url,
            "created_at": created_at,
            "view_url": f"/u/{agent_handle}",
            "agent_handle": agent_handle
        }
        
    except Exception as e:
        session.rollback()
        print(f"[PostCreationService] ❌ Error creating post from preview: {e}")
        raise
    finally:
        session.close()


def create_video_post(
    agent_handle: str,
    video_path: str,
    thumbnail_path: Optional[str],
    duration: int,
    title: str,
    description: str,
    topic: Dict[str, str],
    video_prompt: str,
    visibility: str = "public",
    engine: str = "sora-2-video"  # Options: "sora-2-video", "sora-2-pro"
) -> Dict[str, Any]:
    """
    Create a video post with video upload and database entry.
    
    Args:
        agent_handle: Agent's handle
        video_path: Local path to generated video
        thumbnail_path: Local path to video thumbnail (optional)
        duration: Video duration in seconds
        title: Post title
        description: Post description
        topic: Topic dictionary
        video_prompt: SORA 2 prompt used
        visibility: Post visibility
        engine: Video generation engine (sora-2-video, sora-2-pro)
    
    Returns:
        Dictionary with post details including video_url
    """
    print(f"[PostCreationService] Creating VIDEO post for @{agent_handle}...")
    overall_start = time.time()
    
    session = SessionLocal()
    
    try:
        # 1. Get user ID and agent ID
        query = text("""
            SELECT owner_user_id, id
            FROM avees
            WHERE handle = :handle
            LIMIT 1
        """)
        
        result = session.execute(query, {"handle": agent_handle})
        row = result.fetchone()
        
        if not row:
            raise ValueError(f"Agent @{agent_handle} not found in database")
        
        user_id = str(row[0])
        agent_id = str(row[1])
        
        # 2. Upload video to Supabase
        supabase_url = os.getenv("SUPABASE_URL")
        supabase_service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        
        if not supabase_url or not supabase_service_key:
            raise ValueError("Supabase environment variables not set")
        
        # Upload video
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        video_filename = f"videos/{agent_handle}/post_{user_id}_{timestamp}.mp4"
        
        with open(video_path, 'rb') as f:
            video_data = f.read()
        
        storage_url = f"{supabase_url}/storage/v1/object/app-videos/{video_filename}"
        
        headers = {
            'Authorization': f'Bearer {supabase_service_key}',
            'Content-Type': 'video/mp4',
        }
        
        response = requests.post(storage_url, headers=headers, data=video_data, timeout=120)
        
        if response.status_code not in [200, 201]:
            raise Exception(f"Video upload failed ({response.status_code}): {response.text}")
        
        video_url = f"{supabase_url}/storage/v1/object/public/app-videos/{video_filename}"
        print(f"[PostCreationService] ✅ Video uploaded: {video_filename}")
        
        # 3. Upload thumbnail if provided
        thumbnail_url = None
        if thumbnail_path and os.path.exists(thumbnail_path):
            thumb_filename = f"videos/{agent_handle}/post_{user_id}_{timestamp}_thumb.jpg"
            
            with open(thumbnail_path, 'rb') as f:
                thumb_data = f.read()
            
            thumb_storage_url = f"{supabase_url}/storage/v1/object/app-videos/{thumb_filename}"
            
            thumb_headers = {
                'Authorization': f'Bearer {supabase_service_key}',
                'Content-Type': 'image/jpeg',
            }
            
            thumb_response = requests.post(thumb_storage_url, headers=thumb_headers, data=thumb_data, timeout=60)
            
            if thumb_response.status_code in [200, 201]:
                thumbnail_url = f"{supabase_url}/storage/v1/object/public/app-videos/{thumb_filename}"
                print(f"[PostCreationService] ✅ Thumbnail uploaded: {thumb_filename}")
        
        # 4. Create post in database
        post_id = str(uuid.uuid4())
        
        # Use thumbnail as image_url fallback
        image_url = thumbnail_url if thumbnail_url else f"{supabase_url}/storage/v1/object/public/app-videos/default_video_thumb.png"
        
        # Prepare AI metadata
        model_name = "SORA 2 Pro" if engine == "sora-2-pro" else "SORA 2"
        ai_metadata = {
            "model": model_name,
            "generator": "OpenAI",
            "engine": engine,
            "duration": duration,
            "prompt": video_prompt[:500] if len(video_prompt) > 500 else video_prompt,
            "topic": topic.get("topic", ""),
            "topic_category": topic.get("category", "general"),
            "topic_source": topic.get("source", "unknown"),
            "generation_date": datetime.now().strftime('%Y-%m-%d'),
            "automated": True,
            "media_type": "video"
        }
        
        insert_query = text("""
            INSERT INTO posts (
                id, owner_user_id, agent_id, title, description, image_url,
                video_url, video_duration, video_thumbnail_url,
                post_type, ai_metadata, visibility, image_generation_engine,
                like_count, comment_count, share_count,
                created_at
            ) VALUES (
                :id, :owner_user_id, :agent_id, :title, :description, :image_url,
                :video_url, :video_duration, :video_thumbnail_url,
                :post_type, :ai_metadata, :visibility, :engine,
                0, 0, 0,
                NOW()
            )
            RETURNING id, created_at
        """)
        
        result = session.execute(insert_query, {
            "id": post_id,
            "owner_user_id": user_id,
            "agent_id": agent_id,
            "title": title,
            "description": description,
            "image_url": image_url,
            "video_url": video_url,
            "video_duration": duration,
            "video_thumbnail_url": thumbnail_url,
            "post_type": "ai_generated_video",
            "ai_metadata": json.dumps(ai_metadata),
            "visibility": visibility,
            "engine": engine
        })
        
        session.commit()
        
        row = result.fetchone()
        created_at = row[1]
        
        total_duration = time.time() - overall_start
        
        print(f"[PostCreationService] ✅ Video post created: {post_id} (total: {total_duration:.2f}s)")
        
        # Create notification
        try:
            create_autopost_notification(session, user_id, agent_handle, post_id)
        except Exception as e:
            print(f"[PostCreationService] Warning: Failed to create notification: {e}")
        
        return {
            "post_id": post_id,
            "video_url": video_url,
            "thumbnail_url": thumbnail_url,
            "image_url": image_url,
            "created_at": created_at,
            "view_url": f"/u/{agent_handle}",
            "agent_handle": agent_handle
        }
        
    except Exception as e:
        session.rollback()
        print(f"[PostCreationService] ❌ Error creating video post: {e}")
        raise
    finally:
        session.close()


def create_video_post_from_preview(
    agent_handle: str,
    video_url: str,
    thumbnail_url: Optional[str],
    duration: int,
    title: str,
    description: str,
    topic: Dict[str, str],
    video_prompt: str,
    visibility: str = "public",
    engine: str = "sora-2-video"  # Options: "sora-2-video", "sora-2-pro"
) -> Dict[str, Any]:
    """
    Create a video post from a preview (video already uploaded to storage).
    
    Args:
        agent_handle: Agent's handle
        video_url: URL of the already-uploaded video
        thumbnail_url: URL of the video thumbnail (optional)
        duration: Video duration in seconds
        title: Post title
        description: Post description
        topic: Topic dictionary
        video_prompt: SORA 2 prompt used
        visibility: Post visibility
        engine: Video generation engine (sora-2-video, sora-2-pro)
    
    Returns:
        Dictionary with post details
    """
    print(f"[PostCreationService] Creating video post from preview for @{agent_handle}...")
    
    session = SessionLocal()
    
    try:
        # Get user ID and agent ID
        query = text("""
            SELECT owner_user_id, id
            FROM avees
            WHERE handle = :handle
            LIMIT 1
        """)
        
        result = session.execute(query, {"handle": agent_handle})
        row = result.fetchone()
        
        if not row:
            raise ValueError(f"Agent @{agent_handle} not found in database")
        
        user_id = str(row[0])
        agent_id = str(row[1])
        
        # Generate post ID
        post_id = str(uuid.uuid4())
        
        # Use thumbnail as image_url fallback
        supabase_url = os.getenv("SUPABASE_URL", "")
        image_url = thumbnail_url if thumbnail_url else f"{supabase_url}/storage/v1/object/public/app-videos/default_video_thumb.png"
        
        # Prepare AI metadata
        model_name = "SORA 2 Pro" if engine == "sora-2-pro" else "SORA 2"
        ai_metadata = {
            "model": model_name,
            "generator": "OpenAI",
            "engine": engine,
            "duration": duration,
            "prompt": video_prompt[:500] if len(video_prompt) > 500 else video_prompt,
            "topic": topic.get("topic", "Unknown"),
            "topic_category": topic.get("category", "general"),
            "topic_source": topic.get("source", "unknown"),
            "generation_date": datetime.now().strftime('%Y-%m-%d'),
            "automated": True,
            "from_preview": True,
            "media_type": "video"
        }
        
        # Insert post
        insert_query = text("""
            INSERT INTO posts (
                id, owner_user_id, agent_id, title, description, image_url,
                video_url, video_duration, video_thumbnail_url,
                post_type, ai_metadata, visibility, image_generation_engine,
                like_count, comment_count, share_count,
                created_at
            ) VALUES (
                :id, :owner_user_id, :agent_id, :title, :description, :image_url,
                :video_url, :video_duration, :video_thumbnail_url,
                :post_type, :ai_metadata, :visibility, :engine,
                0, 0, 0,
                NOW()
            )
            RETURNING id, created_at
        """)
        
        result = session.execute(insert_query, {
            "id": post_id,
            "owner_user_id": user_id,
            "agent_id": agent_id,
            "title": title,
            "description": description,
            "image_url": image_url,
            "video_url": video_url,
            "video_duration": duration,
            "video_thumbnail_url": thumbnail_url,
            "post_type": "ai_generated_video",
            "ai_metadata": json.dumps(ai_metadata),
            "visibility": visibility,
            "engine": engine
        })
        
        session.commit()
        
        row = result.fetchone()
        created_at = row[1]
        
        print(f"[PostCreationService] ✅ Video post created from preview: {post_id}")
        
        # Create notification
        try:
            create_autopost_notification(session, user_id, agent_handle, post_id)
        except Exception as e:
            print(f"[PostCreationService] Warning: Failed to create notification: {e}")
        
        return {
            "post_id": post_id,
            "video_url": video_url,
            "thumbnail_url": thumbnail_url,
            "image_url": image_url,
            "created_at": created_at,
            "view_url": f"/u/{agent_handle}",
            "agent_handle": agent_handle
        }
        
    except Exception as e:
        session.rollback()
        print(f"[PostCreationService] ❌ Error creating video post from preview: {e}")
        raise
    finally:
        session.close()


# Testing
if __name__ == "__main__":
    from dotenv import load_dotenv
    import sys
    
    # Add backend to path
    sys.path.insert(0, 'backend')
    
    # Load environment
    load_dotenv("backend/.env", override=True)
    
    print("=" * 80)
    print("Testing Post Creation Service")
    print("=" * 80)
    
    if len(sys.argv) < 2:
        print("\nUsage: python post_creation_service.py <agent_handle> [image_path]")
        print("\nExample: python post_creation_service.py eltonjohn path/to/image.png")
        sys.exit(1)
    
    agent_handle = sys.argv[1]
    
    # If image path provided, use it for test
    if len(sys.argv) > 2:
        image_path = sys.argv[2]
        
        # Test with provided image
        test_topic = {
            "topic": "Test Topic",
            "description": "This is a test topic",
            "category": "test",
            "source": "manual"
        }
        
        result = create_post(
            agent_handle=agent_handle,
            image_path=image_path,
            title="🧪 Test Post",
            description="This is a test post created by the automated system.",
            topic=test_topic,
            image_prompt="Test image prompt",
            visibility="public"
        )
        
        print("\n" + "=" * 80)
        print("SUCCESS!")
        print("=" * 80)
        print(f"Post ID: {result['post_id']}")
        print(f"View at: {result['view_url']}")
        print("=" * 80)
    else:
        # Just test database connection
        print(f"\nTesting database connection for @{agent_handle}...")
        
        with PostCreationService() as service:
            user_id, agent_id = service._get_user_id(agent_handle)
            print(f"✅ Found user_id: {user_id}")
            print(f"✅ Found agent_id: {agent_id}")
            print("\nTo test post creation, provide an image path:")
            print(f"python post_creation_service.py {agent_handle} path/to/image.png")


