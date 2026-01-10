#!/usr/bin/env python3
"""
Apply the unified messaging migration using SQLAlchemy.
This adds is_primary column to avees and marks existing agents as primary.
"""

import sys
import os
from pathlib import Path

# Add backend to path
backend_dir = Path(__file__).parent / "backend"
sys.path.insert(0, str(backend_dir))

from sqlalchemy import text
from db import SessionLocal

def apply_migration():
    """Apply the unified messaging migration step by step."""
    
    print("=" * 80)
    print("UNIFIED MESSAGING MIGRATION")
    print("=" * 80)
    print()
    
    db = SessionLocal()
    
    try:
        # Step 1: Add is_primary column
        print("Step 1: Adding is_primary column to avees table...")
        try:
            db.execute(text("""
                ALTER TABLE avees 
                ADD COLUMN IF NOT EXISTS is_primary BOOLEAN DEFAULT false
            """))
            db.commit()
            print("✓ Column added successfully")
        except Exception as e:
            if "already exists" in str(e):
                print("⚠ Column already exists (skipped)")
                db.rollback()
            else:
                raise
        
        # Step 2: Create unique index
        print("\nStep 2: Creating unique index for primary agents...")
        try:
            db.execute(text("DROP INDEX IF EXISTS idx_avees_owner_primary"))
            db.execute(text("""
                CREATE UNIQUE INDEX idx_avees_owner_primary 
                ON avees (owner_user_id) 
                WHERE is_primary = true
            """))
            db.commit()
            print("✓ Index created successfully")
        except Exception as e:
            print(f"⚠ Index creation: {e}")
            db.rollback()
        
        # Step 3: Mark existing agents as primary
        print("\nStep 3: Marking first agent as primary for each user...")
        
        # Get all users with agents
        result = db.execute(text("""
            SELECT DISTINCT owner_user_id 
            FROM avees 
            WHERE owner_user_id IS NOT NULL
        """))
        users_with_agents = [row[0] for row in result.fetchall()]
        
        print(f"Found {len(users_with_agents)} users with agents")
        
        marked_count = 0
        for user_id in users_with_agents:
            # Get first agent for this user
            result = db.execute(text("""
                SELECT id 
                FROM avees 
                WHERE owner_user_id = :user_id
                ORDER BY created_at ASC
                LIMIT 1
            """), {"user_id": str(user_id)})
            
            first_agent = result.fetchone()
            if first_agent:
                agent_id = first_agent[0]
                
                # Mark as primary
                db.execute(text("""
                    UPDATE avees 
                    SET is_primary = true 
                    WHERE id = :agent_id
                """), {"agent_id": str(agent_id)})
                
                marked_count += 1
        
        db.commit()
        print(f"✓ Marked {marked_count} agents as primary")
        
        # Step 4: Create additional index for performance
        print("\nStep 4: Creating performance index...")
        try:
            db.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_avees_owner_primary_lookup 
                ON avees (owner_user_id, is_primary) 
                WHERE is_primary = true
            """))
            db.commit()
            print("✓ Performance index created")
        except Exception as e:
            print(f"⚠ Index: {e}")
            db.rollback()
        
        # Step 5: Add comments to deprecated columns
        print("\nStep 5: Marking deprecated columns...")
        try:
            db.execute(text("""
                COMMENT ON COLUMN direct_conversations.chat_type IS 
                'DEPRECATED: No longer used in unified messaging system'
            """))
            db.execute(text("""
                COMMENT ON COLUMN direct_conversations.target_avee_id IS 
                'DEPRECATED: No longer used in unified messaging system'
            """))
            db.commit()
            print("✓ Deprecated columns marked")
        except Exception as e:
            print(f"⚠ Comments: {e}")
            db.rollback()
        
        # Verification
        print("\n" + "=" * 80)
        print("VERIFICATION")
        print("=" * 80)
        
        # Check primary agents
        print("\nPrimary agents:")
        result = db.execute(text("""
            SELECT 
                p.handle as user_handle,
                a.handle as agent_handle,
                a.display_name,
                a.is_primary
            FROM avees a
            JOIN profiles p ON a.owner_user_id = p.user_id
            WHERE a.is_primary = true
            ORDER BY p.handle
        """))
        
        primary_agents = result.fetchall()
        if primary_agents:
            for row in primary_agents:
                print(f"  ✓ {row[0]} → {row[1]} ({row[2]}) [primary={row[3]}]")
            print(f"\nTotal: {len(primary_agents)} primary agents")
        else:
            print("  ⚠ No primary agents found")
        
        # Check conversations
        print("\nConversation types:")
        result = db.execute(text("""
            SELECT 
                COALESCE(chat_type, 'NULL') as chat_type,
                COUNT(*) as count
            FROM direct_conversations
            GROUP BY chat_type
        """))
        
        for row in result.fetchall():
            print(f"  - {row[0]}: {row[1]} conversations")
        
        print("\n" + "=" * 80)
        print("✅ MIGRATION COMPLETED SUCCESSFULLY")
        print("=" * 80)
        
        return True
        
    except Exception as e:
        print(f"\n❌ Migration failed: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
        return False
    
    finally:
        db.close()

if __name__ == "__main__":
    success = apply_migration()
    sys.exit(0 if success else 1)










