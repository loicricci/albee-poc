#!/usr/bin/env python3
"""
Run Profile Fields Migration
Adds comprehensive profile fields to the profiles table
"""
import os
import psycopg2
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables
BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")

def run_migration():
    # Get database URL from environment
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        print("❌ DATABASE_URL not found in environment")
        return False
    
    # Read the migration SQL file
    migration_file = BASE_DIR / "migrations" / "add_profile_fields.sql"
    if not migration_file.exists():
        print(f"❌ Migration file not found: {migration_file}")
        return False
    
    with open(migration_file, 'r') as f:
        migration_sql = f.read()
    
    print("=" * 60)
    print("Profile Fields Migration")
    print("=" * 60)
    print(f"\n📁 Migration file: {migration_file}")
    print(f"🔗 Database: {database_url.split('@')[1] if '@' in database_url else 'configured'}")
    
    try:
        # Connect to database
        print("\n⏳ Connecting to database...")
        conn = psycopg2.connect(database_url)
        cursor = conn.cursor()
        
        # Execute migration
        print("⏳ Running migration...")
        cursor.execute(migration_sql)
        
        # Commit changes
        conn.commit()
        
        print("\n✅ Migration completed successfully!")
        print("\n📋 Added columns:")
        print("   Personal: birthdate, gender, marital_status, nationality, languages")
        print("   Contact: phone, email, website")
        print("   Professional: occupation, company, industry, education")
        print("   Social: twitter_handle, linkedin_url, github_username, instagram_handle")
        print("   Additional: interests")
        
        cursor.close()
        conn.close()
        
        print("\n🎉 Backend will now work with the new profile fields!")
        print("   Refresh your browser to see the changes.")
        
        return True
        
    except psycopg2.Error as e:
        print(f"\n❌ Database error: {e}")
        return False
    except Exception as e:
        print(f"\n❌ Unexpected error: {e}")
        return False

if __name__ == "__main__":
    success = run_migration()
    exit(0 if success else 1)










