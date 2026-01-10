#!/usr/bin/env python3
"""
Apply comprehensive performance indexes migration (018)
This script applies database indexes to significantly improve query performance.
Safe to run multiple times - uses CREATE INDEX IF NOT EXISTS.
"""

import os
import sys
from pathlib import Path
from dotenv import load_dotenv
import psycopg2
from psycopg2 import sql

# Load environment
BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    print("❌ DATABASE_URL not found in .env")
    sys.exit(1)

# Convert postgres:// to postgresql:// for psycopg2
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

def apply_migration():
    """Apply the performance indexes migration"""
    migration_file = BASE_DIR / "migrations" / "018_comprehensive_performance_indexes.sql"
    
    if not migration_file.exists():
        print(f"❌ Migration file not found: {migration_file}")
        sys.exit(1)
    
    print(f"📂 Reading migration: {migration_file.name}")
    with open(migration_file, 'r') as f:
        migration_sql = f.read()
    
    print(f"🔌 Connecting to database...")
    try:
        conn = psycopg2.connect(DATABASE_URL)
        conn.autocommit = False
        cursor = conn.cursor()
        
        print(f"⏳ Applying performance indexes (this may take 1-2 minutes)...")
        print(f"   Creating indexes without blocking writes (CONCURRENTLY mode)")
        
        # Execute the migration
        cursor.execute(migration_sql)
        
        conn.commit()
        
        print(f"✅ Migration applied successfully!")
        print(f"")
        print(f"📊 Verifying indexes created...")
        
        # Verify key indexes were created
        cursor.execute("""
            SELECT schemaname, tablename, indexname 
            FROM pg_indexes 
            WHERE indexname LIKE 'idx_avees_owner%' 
               OR indexname LIKE 'idx_agent_updates_avee%'
               OR indexname LIKE 'idx_agent_followers_user%'
               OR indexname LIKE 'idx_update_read_user%'
            ORDER BY tablename, indexname;
        """)
        
        indexes = cursor.fetchall()
        if indexes:
            print(f"✅ Critical indexes verified ({len(indexes)} found):")
            for schema, table, index in indexes[:10]:  # Show first 10
                print(f"   - {table}.{index}")
            if len(indexes) > 10:
                print(f"   ... and {len(indexes) - 10} more")
        else:
            print(f"⚠️  No indexes found (this might be expected if tables don't exist yet)")
        
        print(f"")
        print(f"🎯 Next steps:")
        print(f"   1. Monitor query performance in application logs")
        print(f"   2. Check database CPU usage (should decrease)")
        print(f"   3. Run EXPLAIN ANALYZE on slow queries to verify index usage")
        print(f"   4. Continue with query optimization (Phase 2)")
        
        cursor.close()
        conn.close()
        
    except psycopg2.Error as e:
        print(f"❌ Database error: {e}")
        print(f"   Error code: {e.pgcode}")
        if conn:
            conn.rollback()
            conn.close()
        sys.exit(1)
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        if conn:
            conn.rollback()
            conn.close()
        sys.exit(1)

if __name__ == "__main__":
    print("=" * 60)
    print("Performance Optimization Migration (Phase 1)")
    print("=" * 60)
    print("")
    apply_migration()








