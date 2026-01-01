#!/usr/bin/env python3
"""
Apply the auto post generation migration to the database
"""

import sys
import os
from pathlib import Path

# Add backend directory to path
sys.path.insert(0, str(Path(__file__).parent / "backend"))

from db import engine
from sqlalchemy import text


def run_migration():
    """Run the auto post generation migration"""
    
    migration_file = Path(__file__).parent / "backend" / "migrations" / "019_auto_post_generation.sql"
    
    if not migration_file.exists():
        print(f"❌ Migration file not found: {migration_file}")
        sys.exit(1)
    
    print(f"📄 Reading migration from: {migration_file}")
    sql = migration_file.read_text()
    
    print("\n" + "="*80)
    print("Running Auto Post Generation Migration")
    print("="*80)
    print(f"\nThis will add the following columns to the 'avees' table:")
    print("  - auto_post_enabled (BOOLEAN)")
    print("  - last_auto_post_at (TIMESTAMP WITH TIME ZONE)")
    print("  - auto_post_settings (JSONB)")
    print("\nAnd create indexes for performance.")
    print("="*80)
    
    try:
        with engine.connect() as conn:
            # Set a longer statement timeout (60 seconds)
            print("\n⚙️  Setting statement timeout to 60 seconds...")
            conn.execute(text("SET statement_timeout = '60s'"))
            conn.commit()
            
            # Check how many rows we're dealing with
            print("\n🔍 Checking avees table size...")
            result = conn.execute(text("SELECT COUNT(*) FROM avees"))
            row_count = result.scalar()
            print(f"   Found {row_count} agents in the table")
            
            # Execute the migration statement by statement
            print("\n🚀 Executing migration SQL...")
            
            # Parse SQL into individual statements, handling multi-line statements
            raw_statements = []
            current_statement = []
            
            for line in sql.split('\n'):
                line = line.strip()
                # Skip comment-only lines at the start
                if not current_statement and line.startswith('--'):
                    continue
                # If line is empty and we have a statement, keep building
                if not line and current_statement:
                    current_statement.append(line)
                    continue
                # If line ends with semicolon, this statement is complete
                if line.endswith(';'):
                    current_statement.append(line[:-1])  # Remove semicolon
                    stmt = '\n'.join(current_statement).strip()
                    if stmt:
                        raw_statements.append(stmt)
                    current_statement = []
                elif line and not line.startswith('--'):
                    current_statement.append(line)
            
            # Filter out pure comments
            statements = [s for s in raw_statements if s and not all(l.startswith('--') for l in s.split('\n') if l.strip())]
            
            for i, stmt in enumerate(statements, 1):
                # Get first line for display
                first_line = stmt.split('\n')[0]
                print(f"\n   [{i}/{len(statements)}] Executing: {first_line[:60]}...")
                
                try:
                    conn.execute(text(stmt))
                    conn.commit()
                    print(f"   ✅ Completed")
                except Exception as e:
                    # If it's an "already exists" error, that's OK
                    error_msg = str(e).lower()
                    if 'already exists' in error_msg or 'duplicate' in error_msg:
                        print(f"   ⚠️  Skipped (already exists)")
                        conn.rollback()
                    else:
                        print(f"   ❌ Error: {e}")
                        raise
            
            print("\n✅ All migration statements completed successfully!")
            
            # Verify the columns were added
            print("\n🔍 Verifying columns were added...")
            result = conn.execute(text("""
                SELECT column_name, data_type, column_default
                FROM information_schema.columns
                WHERE table_name = 'avees' 
                AND column_name IN ('auto_post_enabled', 'last_auto_post_at', 'auto_post_settings')
                ORDER BY column_name
            """))
            
            columns = result.fetchall()
            if len(columns) == 3:
                print("✅ All columns verified:")
                for col in columns:
                    print(f"   - {col[0]} ({col[1]})")
            else:
                print(f"⚠️  Expected 3 columns, found {len(columns)}")
                
            # Check indexes
            print("\n🔍 Verifying indexes were created...")
            result = conn.execute(text("""
                SELECT indexname
                FROM pg_indexes
                WHERE tablename = 'avees' 
                AND indexname IN ('idx_avees_auto_post_enabled', 'idx_avees_last_auto_post_at')
                ORDER BY indexname
            """))
            
            indexes = result.fetchall()
            if len(indexes) == 2:
                print("✅ All indexes verified:")
                for idx in indexes:
                    print(f"   - {idx[0]}")
            else:
                print(f"⚠️  Expected 2 indexes, found {len(indexes)}")
                
    except Exception as e:
        print(f"\n❌ Migration failed: {e}")
        sys.exit(1)
    
    print("\n" + "="*80)
    print("✅ AUTO POST MIGRATION COMPLETE!")
    print("="*80)
    print("\nYou can now use the Auto-Posts feature in the backoffice.")
    print("The backend server will automatically detect the new columns.")


if __name__ == "__main__":
    run_migration()

