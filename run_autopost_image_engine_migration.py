#!/usr/bin/env python3
"""
Run migration to add autopost image engine selection support.
Adds columns for reference images, masks, and image engine tracking.
"""

import os
import sys
from pathlib import Path
from sqlalchemy import create_engine, text

# Add backend to path
sys.path.insert(0, 'backend')

from dotenv import load_dotenv

# Load environment
load_dotenv('backend/.env')

DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    print("❌ DATABASE_URL not found in environment")
    print("Make sure backend/.env exists and contains DATABASE_URL")
    sys.exit(1)

print("=" * 80)
print("🚀 AUTOPOST IMAGE ENGINE MIGRATION")
print("=" * 80)
print(f"Database: {DATABASE_URL[:30]}...")
print()

try:
    # Create engine
    engine = create_engine(DATABASE_URL)
    
    with engine.connect() as conn:
        print("✓ Connected to database")
        print()
        
        # Read migration SQL
        migration_file = Path("database_migrations/add_autopost_image_engine.sql")
        if not migration_file.exists():
            print(f"❌ Migration file not found: {migration_file}")
            sys.exit(1)
        
        migration_sql = migration_file.read_text()
        
        print("📋 Running migration...")
        print("-" * 80)
        
        # Execute migration line by line to handle COMMENT statements properly
        lines = migration_sql.split('\n')
        current_statement = []
        statement_num = 0
        
        for line in lines:
            stripped = line.strip()
            
            # Skip empty lines and pure comment lines
            if not stripped or stripped.startswith('--'):
                continue
            
            # Accumulate lines for current statement
            current_statement.append(line)
            
            # Execute when we hit a semicolon
            if stripped.endswith(';'):
                statement = '\n'.join(current_statement).strip()
                current_statement = []
                
                if not statement:
                    continue
                
                statement_num += 1
                
                # Determine statement type for logging
                if statement.startswith('COMMENT'):
                    print(f"[{statement_num}] Adding documentation comment...")
                elif 'ALTER TABLE avees' in statement:
                    print(f"[{statement_num}] Adding columns to avees table...")
                elif 'ALTER TABLE posts' in statement:
                    print(f"[{statement_num}] Adding image_generation_engine to posts...")
                elif 'CREATE INDEX' in statement and 'posts' in statement:
                    print(f"[{statement_num}] Creating index on posts...")
                elif 'CREATE INDEX' in statement and 'avees' in statement:
                    print(f"[{statement_num}] Creating index on avees...")
                else:
                    print(f"[{statement_num}] Executing statement...")
                
                try:
                    conn.execute(text(statement))
                    conn.commit()
                    print(f"   ✓ Success")
                except Exception as e:
                    error_msg = str(e)
                    # If column/index already exists, that's okay
                    if "already exists" in error_msg.lower() or "duplicate" in error_msg.lower():
                        print(f"   ⚠ Already exists (skipped)")
                    else:
                        print(f"   ❌ Error: {error_msg}")
                        raise
        
        print()
        print("=" * 80)
        print("✅ MIGRATION COMPLETED SUCCESSFULLY!")
        print("=" * 80)
        print()
        print("Next steps:")
        print("  1. Update backend models (models.py)")
        print("  2. Add reference image upload API endpoints")
        print("  3. Extend image generator for OpenAI Edits")
        print()

except Exception as e:
    print()
    print("=" * 80)
    print("❌ MIGRATION FAILED")
    print("=" * 80)
    print(f"Error: {e}")
    print()
    import traceback
    traceback.print_exc()
    sys.exit(1)

