#!/usr/bin/env python3
"""
Add Twitter columns to avees table (separate migration due to timeout)
"""

import sys
import os

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

from db import SessionLocal
from sqlalchemy import text

def run_migration():
    """Add Twitter columns to avees table"""
    db = SessionLocal()
    
    try:
        print("=" * 80)
        print("Adding Twitter columns to avees table")
        print("=" * 80)
        
        # Add columns one by one
        print("Adding twitter_sharing_enabled column...")
        try:
            db.execute(text("""
                ALTER TABLE avees 
                ADD COLUMN IF NOT EXISTS twitter_sharing_enabled BOOLEAN DEFAULT false
            """))
            db.commit()
            print("✅ twitter_sharing_enabled added")
        except Exception as e:
            print(f"  Error (may already exist): {e}")
            db.rollback()
        
        print("Adding twitter_posting_mode column...")
        try:
            db.execute(text("""
                ALTER TABLE avees 
                ADD COLUMN IF NOT EXISTS twitter_posting_mode TEXT DEFAULT 'manual'
            """))
            db.commit()
            print("✅ twitter_posting_mode added")
        except Exception as e:
            print(f"  Error (may already exist): {e}")
            db.rollback()
        
        # Create index
        print("Creating index...")
        try:
            db.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_avees_twitter_enabled 
                ON avees(twitter_sharing_enabled) 
                WHERE twitter_sharing_enabled = true
            """))
            db.commit()
            print("✅ Index created")
        except Exception as e:
            print(f"  Error (may already exist): {e}")
            db.rollback()
        
        # Verify
        print("\nVerifying...")
        result = db.execute(text("""
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name = 'avees'
            AND column_name IN ('twitter_sharing_enabled', 'twitter_posting_mode')
        """))
        cols = [row[0] for row in result.fetchall()]
        
        if 'twitter_sharing_enabled' in cols and 'twitter_posting_mode' in cols:
            print("✅ All columns added successfully!")
        else:
            print(f"⚠️  Warning: Only found columns: {cols}")
        
        print("=" * 80)
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        db.close()


if __name__ == "__main__":
    run_migration()

