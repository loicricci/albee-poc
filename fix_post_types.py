#!/usr/bin/env python3
"""
Fix posts with post_type='update' - they should be 'ai_generated' or 'image' instead.

This script:
1. Finds all posts with post_type='update'
2. Changes them to 'ai_generated' (since most are AI-generated posts)
3. Reports the changes made
"""

import sys
import os

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

from sqlalchemy import text
from db import SessionLocal
from models import Post

def main():
    db = SessionLocal()
    
    try:
        print("🔍 Checking for posts with post_type='update'...")
        
        # Find posts with post_type='update'
        posts_to_fix = db.query(Post).filter(Post.post_type == "update").all()
        
        if not posts_to_fix:
            print("✅ No posts found with post_type='update'. Database is clean!")
            return
        
        print(f"\n📊 Found {len(posts_to_fix)} posts with post_type='update':")
        print("-" * 80)
        
        for post in posts_to_fix:
            print(f"ID: {post.id}")
            print(f"  Title: {post.title}")
            print(f"  Description: {post.description[:50] if post.description else 'N/A'}...")
            print(f"  Created: {post.created_at}")
            print(f"  Current post_type: {post.post_type}")
            print()
        
        print("-" * 80)
        response = input(f"\n⚠️  Change all {len(posts_to_fix)} posts to post_type='ai_generated'? (yes/no): ")
        
        if response.lower() not in ['yes', 'y']:
            print("❌ Aborted. No changes made.")
            return
        
        print("\n🔧 Updating posts...")
        
        # Update all posts
        for post in posts_to_fix:
            old_type = post.post_type
            post.post_type = "ai_generated"
            print(f"  ✓ Updated post {post.id}: '{old_type}' → 'ai_generated'")
        
        db.commit()
        
        print(f"\n✅ Successfully updated {len(posts_to_fix)} posts!")
        print("\n📝 Summary:")
        print(f"  - Changed {len(posts_to_fix)} posts from post_type='update' to 'ai_generated'")
        print(f"  - These posts will now appear correctly as image posts in the feed")
        print(f"  - AgentUpdates will remain as text-based updates")
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        db.rollback()
        raise
    finally:
        db.close()

if __name__ == "__main__":
    main()



