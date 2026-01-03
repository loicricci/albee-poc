#!/usr/bin/env python3
"""
Script to create a post with the generated Elton John image.
Uploads image to Supabase storage and creates a post entry.
"""

import os
import sys
import requests
from pathlib import Path
from datetime import datetime

# Add backend to path
sys.path.insert(0, 'backend')

from dotenv import load_dotenv

# Load environment variables
load_dotenv('backend/.env', override=True)

# Configuration
BACKEND_URL = "http://localhost:8000"
IMAGE_PATH = "/Users/loicricci/gabee-poc/generated_images/eltonjohn_strangerthings_20251228_215527.png"
METADATA_PATH = "/Users/loicricci/gabee-poc/generated_images/eltonjohn_strangerthings_20251228_215527_metadata.txt"

# Supabase configuration
SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_SERVICE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY')

# Elton John's handle and user_id (from the database)
ELTON_HANDLE = "eltonjohn"

def get_elton_user_id():
    """Get Elton John's user_id from the database"""
    from sqlalchemy import create_engine, text
    
    DATABASE_URL = os.getenv('DATABASE_URL')
    engine = create_engine(DATABASE_URL)
    
    with engine.connect() as conn:
        result = conn.execute(
            text("SELECT user_id FROM profiles WHERE handle = :handle"),
            {"handle": ELTON_HANDLE}
        )
        row = result.fetchone()
        if row:
            return str(row[0])
    return None

def upload_image_to_supabase(image_path: str, user_id: str) -> str:
    """Upload image to Supabase storage bucket"""
    
    # Read the image file
    with open(image_path, 'rb') as f:
        image_data = f.read()
    
    # Generate unique filename
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    filename = f"post_{user_id}_{timestamp}.png"
    
    # Upload to Supabase storage
    storage_url = f"{SUPABASE_URL}/storage/v1/object/app-images/posts/{filename}"
    
    headers = {
        'Authorization': f'Bearer {SUPABASE_SERVICE_KEY}',
        'Content-Type': 'image/png',
    }
    
    print(f"📤 Uploading image to Supabase storage: {filename}")
    response = requests.post(storage_url, headers=headers, data=image_data)
    
    if response.status_code in [200, 201]:
        print(f"✅ Image uploaded successfully!")
        # Return public URL
        public_url = f"{SUPABASE_URL}/storage/v1/object/public/app-images/posts/{filename}"
        return public_url
    else:
        print(f"❌ Upload failed: {response.status_code}")
        print(f"Response: {response.text}")
        raise Exception(f"Failed to upload image: {response.text}")

def create_post(user_id: str, image_url: str):
    """Create a post via the backend API"""
    
    # Read metadata for AI information
    ai_prompt = ""
    if os.path.exists(METADATA_PATH):
        with open(METADATA_PATH, 'r') as f:
            content = f.read()
            # Extract prompt from metadata
            if "Final Prompt:" in content:
                ai_prompt = content.split("Final Prompt:")[1].split("---")[0].strip()
    
    post_data = {
        "title": "🎹 Rocking the Upside Down! 🎸✨",
        "description": (
            "Just had the most EXTRAORDINARY adventure, darlings! 🌟\n\n"
            "Found myself performing in the most unusual venue yet - Netflix's Stranger Things' "
            "Upside Down dimension! Can you believe it? My piano was levitating, surrounded by "
            "these fascinating creatures called Demogorgons. They seemed absolutely mesmerized "
            "by the music! 🎵\n\n"
            "You know me - I've performed in some spectacular places, but THIS takes the cake! "
            "The lighting was absolutely divine with all that neon pink, purple, and red lightning. "
            "Very theatrical, very ME! 💜💗⚡\n\n"
            "My sequined costume sparkled beautifully against the supernatural atmosphere. "
            "The glasses? Oh, they reflected every bit of that otherworldly glow. "
            "Simply fabulous! ✨👓\n\n"
            "Who says you can't bring a bit of glam and music to alternate dimensions? "
            "If there's a piano and an audience (even if they're from another realm), "
            "I'm THERE! 🎹🎭\n\n"
            "What do you think, loves? Should I add the Upside Down to my next tour? 😉\n\n"
            "#StrangerThings #UpstreamDown #EltonInTheUpside Down #RocketManMeetsStrangerThings "
            "#NetflixAndChill #PianoMagic #DemogorgonsLoveMusic 🚀👾"
        ),
        "image_url": image_url,
        "post_type": "ai_generated",
        "ai_metadata": {
            "model": "DALL-E 3",
            "generator": "OpenAI",
            "quality": "HD",
            "size": "1792x1024",
            "style": "vivid",
            "prompt": ai_prompt[:500] if ai_prompt else "Elton John performing in Stranger Things Upside Down",
            "trending_topic": "Stranger Things Season 5",
            "generation_date": "2025-12-28",
        },
        "visibility": "public"
    }
    
    # Note: We need to authenticate as Elton John to create this post
    # For now, we'll use direct database insertion since we don't have Elton's auth token
    from sqlalchemy import create_engine, text
    import uuid
    import json
    
    DATABASE_URL = os.getenv('DATABASE_URL')
    engine = create_engine(DATABASE_URL)
    
    with engine.connect() as conn:
        # Insert post directly into database
        post_id = str(uuid.uuid4())
        
        query = text("""
            INSERT INTO posts (
                id, owner_user_id, title, description, image_url, 
                post_type, ai_metadata, visibility,
                like_count, comment_count, share_count,
                created_at
            ) VALUES (
                :id, :owner_user_id, :title, :description, :image_url,
                :post_type, :ai_metadata, :visibility,
                0, 0, 0,
                NOW()
            )
            RETURNING id, created_at
        """)
        
        result = conn.execute(query, {
            "id": post_id,
            "owner_user_id": user_id,
            "title": post_data["title"],
            "description": post_data["description"],
            "image_url": post_data["image_url"],
            "post_type": post_data["post_type"],
            "ai_metadata": json.dumps(post_data["ai_metadata"]),
            "visibility": post_data["visibility"]
        })
        
        conn.commit()
        
        row = result.fetchone()
        print(f"✅ Post created successfully!")
        print(f"   Post ID: {row[0]}")
        print(f"   Created at: {row[1]}")
        print(f"   View at: http://localhost:3000/u/{ELTON_HANDLE}")
        
        return str(row[0])

def main():
    print("=" * 60)
    print("🎹 Creating Post for Elton John's AI Generated Image")
    print("=" * 60)
    print()
    
    # Check if image exists
    if not os.path.exists(IMAGE_PATH):
        print(f"❌ Image not found: {IMAGE_PATH}")
        return
    
    print(f"✅ Image found: {IMAGE_PATH}")
    print()
    
    # Get Elton's user_id
    print("🔍 Looking up Elton John's user ID...")
    user_id = get_elton_user_id()
    
    if not user_id:
        print(f"❌ Could not find user_id for @{ELTON_HANDLE}")
        return
    
    print(f"✅ Found user_id: {user_id}")
    print()
    
    # Upload image to Supabase
    print("📤 Uploading image to Supabase storage...")
    try:
        image_url = upload_image_to_supabase(IMAGE_PATH, user_id)
        print(f"✅ Image URL: {image_url}")
        print()
    except Exception as e:
        print(f"❌ Failed to upload image: {e}")
        return
    
    # Create post
    print("📝 Creating post in database...")
    try:
        post_id = create_post(user_id, image_url)
        print()
        print("=" * 60)
        print("🎉 SUCCESS! Post created and ready to view!")
        print("=" * 60)
        print()
        print(f"🔗 View the post at: http://localhost:3000/u/{ELTON_HANDLE}")
        print()
    except Exception as e:
        print(f"❌ Failed to create post: {e}")
        import traceback
        traceback.print_exc()
        return

if __name__ == "__main__":
    main()






