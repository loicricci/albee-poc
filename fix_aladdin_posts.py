#!/usr/bin/env python3
"""
Fix Aladdin Posts - Add agent_id column to posts table

This script adds the missing agent_id column to the posts table,
which is causing Aladdin posts (and other agent posts) to not be visible.
"""

import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), "backend"))

from sqlalchemy import text
from backend.db import SessionLocal

def apply_migration():
    """Apply the migration to add agent_id column to posts table"""
    
    # Read the migration SQL
    migration_file = "database_migrations/add_agent_id_to_posts.sql"
    with open(migration_file, 'r') as f:
        migration_sql = f.read()
    
    # Get database connection
    db = SessionLocal()
    
    try:
        print("🔧 Applying migration: add_agent_id_to_posts.sql")
        print("=" * 60)
        
        # Split by semicolons and execute each statement
        statements = [s.strip() for s in migration_sql.split(';') if s.strip() and not s.strip().startswith('--')]
        
        for i, statement in enumerate(statements, 1):
            # Skip comment-only statements
            if not statement or statement.startswith('--'):
                continue
                
            print(f"\n[{i}/{len(statements)}] Executing statement...")
            print(f"  {statement[:80]}..." if len(statement) > 80 else f"  {statement}")
            
            try:
                db.execute(text(statement))
                db.commit()
                print("  ✅ Success")
            except Exception as e:
                # If it's an "already exists" error, that's OK
                if "already exists" in str(e).lower() or "duplicate" in str(e).lower():
                    print(f"  ℹ️  Already exists (skipped)")
                    db.rollback()
                else:
                    raise
        
        print("\n" + "=" * 60)
        print("✅ Migration completed successfully!")
        print("\n📊 Verifying column exists...")
        
        # Verify the column was added
        result = db.execute(text("""
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_name = 'posts' 
            AND column_name = 'agent_id'
        """)).fetchone()
        
        if result:
            print(f"  ✅ Column 'agent_id' exists:")
            print(f"     - Type: {result[1]}")
            print(f"     - Nullable: {result[2]}")
        else:
            print("  ❌ Column 'agent_id' not found!")
            return False
        
        # Check if there are any posts with agent_id set
        result = db.execute(text("""
            SELECT COUNT(*) as total, 
                   COUNT(agent_id) as with_agent
            FROM posts
        """)).fetchone()
        
        print(f"\n📈 Posts statistics:")
        print(f"  - Total posts: {result[0]}")
        print(f"  - Posts with agent_id: {result[1]}")
        
        return True
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        db.rollback()
        return False
    finally:
        db.close()

if __name__ == "__main__":
    print("🚀 Fix Aladdin Posts - Database Migration")
    print()
    
    success = apply_migration()
    
    if success:
        print("\n✅ All done! Aladdin posts should now be visible.")
        print("\n💡 Next steps:")
        print("   1. Refresh the Aladdin profile page")
        print("   2. Posts should now load without errors")
        sys.exit(0)
    else:
        print("\n❌ Migration failed. Please check the errors above.")
        sys.exit(1)

