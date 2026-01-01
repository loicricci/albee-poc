"""
Run a specific database migration file.

Usage:
    python run_specific_migration.py migrations/012_add_update_read_status.sql
"""

import os
import sys
from sqlalchemy import create_engine, text
from dotenv import load_dotenv
from pathlib import Path

# Load .env from the backend directory
backend_dir = Path(__file__).parent
env_path = backend_dir / ".env"
load_dotenv(env_path)

DATABASE_URL = os.getenv("DATABASE_URL")

def run_migration(migration_file):
    """Run a specific migration file."""
    if not DATABASE_URL:
        print("❌ DATABASE_URL not found in environment")
        print(f"   Looking for .env at: {env_path}")
        return False
    
    print(f"🔧 Running migration: {migration_file}")
    print(f"   Database: {DATABASE_URL[:20]}...")
    
    engine = create_engine(DATABASE_URL)
    
    # Read migration file
    migration_path = Path(__file__).parent / migration_file
    
    if not migration_path.exists():
        print(f"❌ Migration file not found: {migration_path}")
        return False
    
    with open(migration_path, "r") as f:
        migration_sql = f.read()
    
    # Remove comments and execute as a single transaction
    lines = migration_sql.split('\n')
    cleaned_lines = [line for line in lines if line.strip() and not line.strip().startswith('--')]
    cleaned_sql = '\n'.join(cleaned_lines)
    
    print(f"   Executing migration SQL...")
    
    with engine.connect() as conn:
        try:
            # Execute the entire migration as a single statement
            conn.execute(text(cleaned_sql))
            conn.commit()
            print("  ✓ Migration executed successfully")
        except Exception as e:
            error_msg = str(e)
            if "already exists" in error_msg.lower():
                print(f"  ℹ️  Migration skipped (resources already exist)")
            else:
                print(f"  ⚠️  Migration error: {e}")
                raise
    
    print("✅ Migration complete!")
    return True

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python run_specific_migration.py <migration_file>")
        print("Example: python run_specific_migration.py migrations/012_add_update_read_status.sql")
        sys.exit(1)
    
    migration_file = sys.argv[1]
    success = run_migration(migration_file)
    sys.exit(0 if success else 1)

