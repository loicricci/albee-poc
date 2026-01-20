#!/usr/bin/env python3
"""
Run the unread count performance indexes migration.

This migration adds indexes to improve performance of:
- GET /notifications/unread-count
- GET /messaging/unread-count

Safe to run multiple times - uses CREATE INDEX IF NOT EXISTS.
"""

import os
import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent / "backend"))

from dotenv import load_dotenv
import psycopg2

# Load environment variables
load_dotenv("backend/.env")

DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    print("ERROR: DATABASE_URL not found in backend/.env")
    sys.exit(1)

# Read the migration SQL
migration_file = Path(__file__).parent / "backend" / "migrations" / "add_unread_count_indexes.sql"
with open(migration_file, 'r') as f:
    sql = f.read()

print(f"Running migration: {migration_file}")
print("-" * 60)

try:
    # Connect to database
    conn = psycopg2.connect(DATABASE_URL)
    conn.autocommit = True
    cursor = conn.cursor()
    
    # Execute the migration
    cursor.execute(sql)
    
    print("✅ Migration completed successfully!")
    print("\nCreated/verified indexes on:")
    print("  - notifications (user_read, user_created, user_id)")
    print("  - direct_conversations (participant1, participant2, agent_target)")
    print("  - direct_messages (unread_p1, unread_p2, conversation_created)")
    print("  - avees (owner_user_id)")
    print("\nTables analyzed for query planner optimization.")
    
    # Verify indexes were created
    print("\n" + "-" * 60)
    print("Verifying indexes...")
    cursor.execute("""
        SELECT indexname, tablename 
        FROM pg_indexes 
        WHERE tablename IN ('notifications', 'direct_conversations', 'direct_messages', 'avees')
          AND indexname LIKE 'idx_%'
        ORDER BY tablename, indexname
    """)
    indexes = cursor.fetchall()
    
    print(f"\nFound {len(indexes)} indexes:")
    current_table = None
    for indexname, tablename in indexes:
        if tablename != current_table:
            print(f"\n  {tablename}:")
            current_table = tablename
        print(f"    - {indexname}")
    
    cursor.close()
    conn.close()
    
except psycopg2.Error as e:
    print(f"❌ Error running migration: {e}")
    print(f"\nError code: {e.pgcode}")
    print(f"Error message: {e.pgerror}")
    sys.exit(1)
except Exception as e:
    print(f"❌ Unexpected error: {e}")
    sys.exit(1)

print("\n" + "=" * 60)
print("🎉 Done! The unread count endpoints should now be faster.")
print("   Deploy to Railway and monitor HTTP response times.")
