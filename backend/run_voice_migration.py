#!/usr/bin/env python3
"""
Run the voice features database migration
"""
import os
from dotenv import load_dotenv
import psycopg

# Load environment variables
load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    print("ERROR: DATABASE_URL not found in environment")
    exit(1)

# Read migration file
migration_file = "migrations/005_voice_features.sql"
with open(migration_file, "r") as f:
    migration_sql = f.read()

print(f"Running migration: {migration_file}")
print("-" * 60)

try:
    # Connect to database
    with psycopg.connect(DATABASE_URL) as conn:
        with conn.cursor() as cur:
            # Execute migration
            cur.execute(migration_sql)
            conn.commit()
            print("✅ Migration completed successfully!")
            print("\nColumns added:")
            print("  - avees.voice_sample_url")
            print("  - avees.preferred_tts_voice")
            print("  - avees.voice_generated_at")
            print("  - profiles.preferred_tts_voice")
            print("\nTable created:")
            print("  - voice_transcriptions")
            
except Exception as e:
    print(f"❌ Migration failed: {e}")
    exit(1)







