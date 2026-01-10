#!/usr/bin/env python3
"""
Run the notifications table migration
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
migration_file = Path(__file__).parent / "database_migrations" / "010_create_notifications_table.sql"
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
    print("\nCreated:")
    print("  - notifications table")
    print("  - 6 indexes for efficient queries")
    print("  - Row Level Security policies")
    
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

print("\n🎉 Done! The notifications table is ready.")
print("   Restart your backend server to start receiving notifications.")



