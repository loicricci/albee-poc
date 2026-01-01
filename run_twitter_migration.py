#!/usr/bin/env python3
"""
Run the Twitter integration migration
"""

import sys
import os

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

from db import SessionLocal
from sqlalchemy import text

def run_migration():
    """Run the Twitter integration migration"""
    db = SessionLocal()
    
    try:
        print("=" * 80)
        print("Running Twitter Integration Migration (022_twitter_user_integration.sql)")
        print("=" * 80)
        
        # Read migration file
        migration_file = os.path.join(
            os.path.dirname(__file__),
            'backend',
            'migrations',
            '022_twitter_user_integration.sql'
        )
        
        with open(migration_file, 'r') as f:
            sql = f.read()
        
        # Split into individual statements and execute them
        statements = []
        current_stmt = []
        in_function = False
        
        for line in sql.split('\n'):
            stripped = line.strip()
            
            # Track if we're in a function definition
            if 'CREATE OR REPLACE FUNCTION' in line:
                in_function = True
            
            if stripped.startswith('--') or not stripped:
                continue
            
            current_stmt.append(line)
            
            # End of statement (either semicolon or end of function)
            if stripped.endswith(';'):
                if in_function and 'LANGUAGE' in stripped:
                    in_function = False
                    statements.append('\n'.join(current_stmt))
                    current_stmt = []
                elif not in_function:
                    statements.append('\n'.join(current_stmt))
                    current_stmt = []
        
        # Execute each statement
        for i, stmt in enumerate(statements, 1):
            if stmt.strip():
                try:
                    print(f"Executing statement {i}/{len(statements)}...")
                    db.execute(text(stmt))
                    db.commit()
                except Exception as e:
                    print(f"  Statement {i} error (may be OK if already exists): {e}")
                    db.rollback()
        
        print("✅ Migration executed successfully!")
        print()
        
        # Verify columns were added
        print("Verifying migration...")
        
        # Check avees columns
        result = db.execute(text("""
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name = 'avees'
            AND column_name IN ('twitter_sharing_enabled', 'twitter_posting_mode')
        """))
        avees_cols = [row[0] for row in result.fetchall()]
        
        if 'twitter_sharing_enabled' in avees_cols and 'twitter_posting_mode' in avees_cols:
            print("✅ Avees table updated successfully")
        else:
            print("⚠️  Warning: Some avees columns may not have been added")
        
        # Check posts columns
        result = db.execute(text("""
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name = 'posts'
            AND column_name IN ('posted_to_twitter', 'twitter_post_id', 'twitter_post_url', 'twitter_posted_at')
        """))
        posts_cols = [row[0] for row in result.fetchall()]
        
        if len(posts_cols) == 4:
            print("✅ Posts table updated successfully")
        else:
            print("⚠️  Warning: Some posts columns may not have been added")
        
        # Check new tables
        result = db.execute(text("""
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
            AND table_name IN ('profile_twitter_configs', 'twitter_oauth_states')
        """))
        tables = [row[0] for row in result.fetchall()]
        
        if 'profile_twitter_configs' in tables:
            print("✅ profile_twitter_configs table created")
        else:
            print("⚠️  Warning: profile_twitter_configs table may not have been created")
        
        if 'twitter_oauth_states' in tables:
            print("✅ twitter_oauth_states table created")
        else:
            print("⚠️  Warning: twitter_oauth_states table may not have been created")
        
        print()
        print("=" * 80)
        print("Migration complete! You can now:")
        print("1. Set TWITTER_CONSUMER_KEY and TWITTER_CONSUMER_SECRET in backend/.env")
        print("2. Restart your backend server")
        print("3. Connect Twitter from the Account page")
        print("=" * 80)
        
    except Exception as e:
        print(f"❌ Error running migration: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        db.close()


if __name__ == "__main__":
    run_migration()

