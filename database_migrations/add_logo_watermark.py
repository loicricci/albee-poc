#!/usr/bin/env python3
"""
Database Migration: Add logo watermark columns to avees table

This migration adds columns for logo watermark functionality:
- logo_enabled: Boolean toggle to enable/disable logo on autoposts
- logo_url: URL to the uploaded PNG logo in Supabase storage
- logo_position: Corner placement (bottom-right, bottom-left, top-right, top-left)
- logo_size: Size preset (small=5%, medium=10%, large=15%)

Usage:
    python database_migrations/add_logo_watermark.py
"""

import os
import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent.parent / "backend"))

from dotenv import load_dotenv
from sqlalchemy import create_engine, text

# Load environment
load_dotenv("backend/.env", override=True)


def run_migration():
    """Add logo watermark columns to avees table"""
    
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        print("❌ DATABASE_URL not set in environment")
        return False
    
    engine = create_engine(database_url)
    
    print("=" * 60)
    print("Migration: Add logo watermark columns to avees")
    print("=" * 60)
    
    columns_to_add = [
        ("logo_enabled", "BOOLEAN DEFAULT FALSE"),
        ("logo_url", "TEXT"),
        ("logo_position", "VARCHAR(20) DEFAULT 'bottom-right'"),
        ("logo_size", "VARCHAR(10) DEFAULT 'medium'"),
    ]
    
    try:
        with engine.connect() as conn:
            for column_name, column_type in columns_to_add:
                # Check if column already exists
                check_query = text("""
                    SELECT column_name 
                    FROM information_schema.columns 
                    WHERE table_name = 'avees' 
                    AND column_name = :column_name
                """)
                result = conn.execute(check_query, {"column_name": column_name})
                
                if result.fetchone():
                    print(f"✅ Column '{column_name}' already exists - skipping")
                    continue
                
                # Add the column
                print(f"Adding '{column_name}' column to avees table...")
                
                alter_query = text(f"""
                    ALTER TABLE avees 
                    ADD COLUMN {column_name} {column_type}
                """)
                conn.execute(alter_query)
                conn.commit()
                
                print(f"✅ Column '{column_name}' added successfully!")
            
            # Verify all columns
            print("\n" + "-" * 40)
            print("Verifying logo columns:")
            verify_query = text("""
                SELECT column_name, data_type, column_default
                FROM information_schema.columns 
                WHERE table_name = 'avees' 
                AND column_name LIKE 'logo_%'
                ORDER BY column_name
            """)
            verify_result = conn.execute(verify_query)
            
            for row in verify_result:
                default = f" (default: {row[2]})" if row[2] else ""
                print(f"  ✅ {row[0]}: {row[1]}{default}")
            
            print("-" * 40)
            print("✅ Migration completed successfully!")
            
            return True
            
    except Exception as e:
        print(f"❌ Migration failed: {e}")
        import traceback
        traceback.print_exc()
        return False


if __name__ == "__main__":
    success = run_migration()
    sys.exit(0 if success else 1)

