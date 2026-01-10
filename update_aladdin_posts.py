#!/usr/bin/env python3
"""
Update existing Aladdin posts with agent_id
"""

import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), "backend"))

from sqlalchemy import text
from backend.db import SessionLocal

def update_aladdin_posts():
    """Update existing posts with agent_id for Aladdin"""
    
    db = SessionLocal()
    
    try:
        print("🔍 Looking for Aladdin agent and posts...")
        print("=" * 60)
        
        # Find Aladdin's agent ID
        result = db.execute(text("""
            SELECT id, handle, display_name, owner_user_id
            FROM avees
            WHERE handle = 'aladdin'
        """)).fetchone()
        
        if not result:
            print("❌ Aladdin agent not found!")
            return False
        
        agent_id, handle, display_name, owner_user_id = result
        print(f"✅ Found Aladdin agent:")
        print(f"   - Handle: @{handle}")
        print(f"   - Display Name: {display_name}")
        print(f"   - Agent ID: {agent_id}")
        print(f"   - Owner User ID: {owner_user_id}")
        
        # Check for posts by Aladdin's owner that might be agent posts
        print(f"\n🔍 Looking for posts by Aladdin's owner...")
        result = db.execute(text("""
            SELECT id, title, description, image_url, post_type, created_at
            FROM posts
            WHERE owner_user_id = :owner_user_id
            AND agent_id IS NULL
            ORDER BY created_at DESC
        """), {"owner_user_id": owner_user_id}).fetchall()
        
        if not result:
            print("   No posts found needing update.")
            return True
        
        print(f"   Found {len(result)} post(s) that might be from Aladdin:")
        for post in result:
            print(f"\n   📝 Post {post[0]}:")
            print(f"      Title: {post[1]}")
            print(f"      Type: {post[4]}")
            print(f"      Created: {post[5]}")
        
        # Ask if we should update them
        print(f"\n💡 These posts should have agent_id = {agent_id}")
        print(f"\n🔧 Updating posts...")
        
        # Update the posts
        result = db.execute(text("""
            UPDATE posts
            SET agent_id = :agent_id
            WHERE owner_user_id = :owner_user_id
            AND agent_id IS NULL
        """), {"agent_id": agent_id, "owner_user_id": owner_user_id})
        
        db.commit()
        
        rows_updated = result.rowcount
        print(f"   ✅ Updated {rows_updated} post(s)")
        
        # Verify the update
        print(f"\n📊 Final statistics:")
        result = db.execute(text("""
            SELECT COUNT(*) as total,
                   COUNT(agent_id) as with_agent,
                   COUNT(CASE WHEN agent_id = :agent_id THEN 1 END) as aladdin_posts
            FROM posts
        """), {"agent_id": agent_id}).fetchone()
        
        print(f"   - Total posts: {result[0]}")
        print(f"   - Posts with agent_id: {result[1]}")
        print(f"   - Aladdin posts: {result[2]}")
        
        return True
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        db.rollback()
        import traceback
        traceback.print_exc()
        return False
    finally:
        db.close()

if __name__ == "__main__":
    print("🚀 Update Aladdin Posts with Agent ID")
    print()
    
    success = update_aladdin_posts()
    
    if success:
        print("\n✅ All done! Aladdin posts should now be properly associated.")
        sys.exit(0)
    else:
        print("\n❌ Update failed. Please check the errors above.")
        sys.exit(1)







