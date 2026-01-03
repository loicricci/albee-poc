#!/usr/bin/env python3
"""
Verify Aladdin posts are properly configured
"""

import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), "backend"))

from sqlalchemy import text
from backend.db import SessionLocal

def verify_posts():
    """Verify that Aladdin posts are properly configured"""
    
    db = SessionLocal()
    
    try:
        print("🔍 Verifying Aladdin posts configuration...")
        print("=" * 70)
        
        # Get Aladdin's details
        result = db.execute(text("""
            SELECT a.id, a.handle, a.display_name, p.handle, p.display_name
            FROM avees a
            JOIN profiles p ON a.owner_user_id = p.user_id
            WHERE a.handle = 'aladdin'
        """)).fetchone()
        
        if not result:
            print("❌ Aladdin agent not found!")
            return False
        
        agent_id, agent_handle, agent_name, profile_handle, profile_name = result
        print(f"✅ Aladdin Agent:")
        print(f"   Agent: @{agent_handle} ({agent_name})")
        print(f"   Owner Profile: @{profile_handle} ({profile_name})")
        print(f"   Agent ID: {agent_id}")
        
        # Check posts
        print(f"\n📝 Aladdin's Posts:")
        result = db.execute(text("""
            SELECT p.id, p.title, p.description, p.post_type, p.visibility, 
                   p.created_at, p.agent_id
            FROM posts p
            WHERE p.agent_id = :agent_id
            ORDER BY p.created_at DESC
        """), {"agent_id": agent_id}).fetchall()
        
        if not result:
            print("   ⚠️  No posts found with agent_id set!")
            return False
        
        print(f"   Found {len(result)} post(s):")
        for i, post in enumerate(result, 1):
            post_id, title, description, post_type, visibility, created_at, post_agent_id = post
            print(f"\n   {i}. {title}")
            print(f"      - ID: {post_id}")
            print(f"      - Type: {post_type}")
            print(f"      - Visibility: {visibility}")
            print(f"      - Agent ID: {post_agent_id}")
            print(f"      - Created: {created_at}")
            if description:
                desc_preview = description[:80] + "..." if len(description) > 80 else description
                print(f"      - Description: {desc_preview}")
        
        # Test the query that the API would use
        print(f"\n🔍 Testing API query (simulating GET /posts?user_handle=aladdin):")
        result = db.execute(text("""
            SELECT p.id, p.title, p.visibility
            FROM posts p
            JOIN profiles prof ON p.owner_user_id = prof.user_id
            WHERE prof.handle = 'admin'
            AND p.agent_id = :agent_id
            AND p.visibility = 'public'
            ORDER BY p.created_at DESC
        """), {"agent_id": agent_id}).fetchall()
        
        print(f"   API would return {len(result)} post(s)")
        
        # Check database schema
        print(f"\n🗄️  Database Schema Check:")
        result = db.execute(text("""
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_name = 'posts'
            AND column_name IN ('agent_id', 'owner_user_id')
            ORDER BY column_name
        """)).fetchall()
        
        for col in result:
            print(f"   ✅ {col[0]}: {col[1]} (nullable: {col[2]})")
        
        print("\n" + "=" * 70)
        print("✅ Verification complete!")
        return True
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return False
    finally:
        db.close()

if __name__ == "__main__":
    print("🔍 Aladdin Posts Verification")
    print()
    
    success = verify_posts()
    
    if success:
        print("\n✅ Everything looks good!")
        print("\n💡 Next step: Refresh the Aladdin profile page in your browser")
        sys.exit(0)
    else:
        print("\n❌ Verification failed. Please check the errors above.")
        sys.exit(1)





