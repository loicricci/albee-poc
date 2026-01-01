#!/usr/bin/env python3
"""
Quick migration runner for agent_followers table.
Run this to create the agent_followers table in your database.
"""

import os
import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent))

from sqlalchemy import text
from backend.db import SessionLocal

def run_migration():
    """Run the agent_followers migration"""
    
    migration_sql = """
-- Migration: Create agent_followers table for profile-to-agent following

-- Create new agent_followers table
CREATE TABLE IF NOT EXISTS agent_followers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    follower_user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
    avee_id UUID NOT NULL REFERENCES avees(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure a profile can only follow an agent once
    UNIQUE(follower_user_id, avee_id)
);

-- Create indices for performance
CREATE INDEX IF NOT EXISTS idx_agent_followers_follower ON agent_followers(follower_user_id);
CREATE INDEX IF NOT EXISTS idx_agent_followers_avee ON agent_followers(avee_id);

-- Optional: Migrate existing profile-to-profile follows to agent follows
-- This assumes users who follow profiles should follow all their agents
INSERT INTO agent_followers (follower_user_id, avee_id, created_at)
SELECT DISTINCT 
    r.from_user_id,
    a.id,
    r.created_at
FROM relationships r
JOIN avees a ON a.owner_user_id = r.to_user_id
WHERE r.type = 'follow'
ON CONFLICT (follower_user_id, avee_id) DO NOTHING;
"""
    
    db = SessionLocal()
    try:
        print("🔄 Running agent_followers migration...")
        
        # Execute migration
        db.execute(text(migration_sql))
        db.commit()
        
        # Verify table was created
        result = db.execute(text("""
            SELECT COUNT(*) FROM agent_followers
        """)).scalar()
        
        print(f"✅ Migration completed successfully!")
        print(f"   - agent_followers table created")
        print(f"   - {result} records migrated from old relationships")
        print(f"   - Indices created for performance")
        
        return True
        
    except Exception as e:
        print(f"❌ Migration failed: {e}")
        db.rollback()
        return False
        
    finally:
        db.close()

if __name__ == "__main__":
    print("=" * 60)
    print("  Agent Followers Migration")
    print("=" * 60)
    
    success = run_migration()
    
    if success:
        print("\n✅ Your database is ready!")
        print("   You can now use the new agent-following features.")
        sys.exit(0)
    else:
        print("\n❌ Migration failed. Please check the error above.")
        sys.exit(1)







