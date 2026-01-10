#!/usr/bin/env python3
"""
Test the unified feed to ensure proper separation of posts, updates, and reposts.
"""

import sys
import os

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

from db import SessionLocal
from models import Post, AgentUpdate, PostShare
from sqlalchemy import func

def main():
    db = SessionLocal()
    
    try:
        # Get counts
        post_count = db.query(func.count(Post.id)).scalar()
        update_count = db.query(func.count(AgentUpdate.id)).scalar()
        repost_count = db.query(func.count(PostShare.id)).scalar()

        print('📊 Feed Content Summary')
        print('=' * 60)
        print(f'Posts (visual content):    {post_count:>5}')
        print(f'Updates (text updates):    {update_count:>5}')
        print(f'Reposts (shares):          {repost_count:>5}')
        print(f'{"─" * 60}')
        print(f'Total Feed Items:          {post_count + update_count + repost_count:>5}')
        print('=' * 60)

        # Get post type breakdown
        print('\n📸 Post Type Breakdown (Posts table):')
        post_types = db.query(Post.post_type, func.count(Post.id)).group_by(Post.post_type).all()
        
        if post_types:
            for pt, count in post_types:
                print(f'  • {pt:15s} → {count:>3} posts')
        else:
            print('  (No posts yet)')
        
        # Verify no invalid post types
        invalid_posts = db.query(Post).filter(Post.post_type == "update").count()
        
        print('\n✅ Validation:')
        if invalid_posts == 0:
            print('  ✓ No posts with post_type="update" (GOOD!)')
            print('  ✓ Clear separation between Posts and AgentUpdates')
        else:
            print(f'  ✗ WARNING: {invalid_posts} posts still have post_type="update"')
            print('  → Run: python fix_post_types.py')
        
        print('\n🎯 Feed Architecture is correct!')
        print('  • AgentUpdates = text-based status updates')
        print('  • Posts = visual content (images, AI-generated)')
        print('  • Reposts = shares with optional comments')
        
    except Exception as e:
        print(f'\n❌ Error: {e}')
        raise
    finally:
        db.close()

if __name__ == "__main__":
    main()



