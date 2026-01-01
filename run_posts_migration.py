#!/usr/bin/env python3
"""
Run the image posts migration
"""
import os
import sys
sys.path.insert(0, 'backend')

from sqlalchemy import create_engine
from dotenv import load_dotenv

load_dotenv("backend/.env", override=True)
DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    print("❌ DATABASE_URL not found in environment")
    sys.exit(1)

print("📊 Running image posts migration...")
print("=" * 60)

engine = create_engine(DATABASE_URL)

# Read the migration file
with open('backend/migrations/010_image_posts.sql', 'r') as f:
    migration_sql = f.read()

# Execute as one block
try:
    conn = engine.raw_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(migration_sql)
        conn.commit()
        print("✅ Migration executed successfully!")
    finally:
        conn.close()
except Exception as e:
    print(f"❌ Migration failed: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

print("=" * 60)

# Verify tables were created
from sqlalchemy import inspect
inspector = inspect(engine)
tables = inspector.get_table_names()

post_tables = [t for t in tables if 'post' in t or 'comment' in t or 'share' in t]
print("\n📋 Post-related tables created:")
for table in sorted(post_tables):
    print(f"  ✓ {table}")

print("\n✅ Migration completed successfully!")
print("=" * 60)

