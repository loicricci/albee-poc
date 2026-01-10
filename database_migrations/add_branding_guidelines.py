#!/usr/bin/env python3
"""
Database Migration: Add branding_guidelines column to avees table

This migration adds a branding_guidelines TEXT column to store color, font,
and visual style preferences for coherent image generation during autopost.

Usage:
    python database_migrations/add_branding_guidelines.py

The column is nullable and stores free-form text like:
    "Colors: #1DA1F2 (primary), #FF6B6B (accent)
     Fonts: Modern sans-serif, bold headlines
     Style: Clean minimalist, high contrast"
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
    """Add branding_guidelines column to avees table"""
    
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        print("❌ DATABASE_URL not set in environment")
        return False
    
    engine = create_engine(database_url)
    
    print("=" * 60)
    print("Migration: Add branding_guidelines to avees")
    print("=" * 60)
    
    try:
        with engine.connect() as conn:
            # Check if column already exists
            check_query = text("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'avees' 
                AND column_name = 'branding_guidelines'
            """)
            result = conn.execute(check_query)
            
            if result.fetchone():
                print("✅ Column 'branding_guidelines' already exists - skipping")
                return True
            
            # Add the column
            print("Adding 'branding_guidelines' column to avees table...")
            
            alter_query = text("""
                ALTER TABLE avees 
                ADD COLUMN branding_guidelines TEXT
            """)
            conn.execute(alter_query)
            conn.commit()
            
            print("✅ Column added successfully!")
            
            # Verify
            verify_query = text("""
                SELECT column_name, data_type 
                FROM information_schema.columns 
                WHERE table_name = 'avees' 
                AND column_name = 'branding_guidelines'
            """)
            verify_result = conn.execute(verify_query)
            row = verify_result.fetchone()
            
            if row:
                print(f"✅ Verified: {row[0]} ({row[1]})")
            
            return True
            
    except Exception as e:
        print(f"❌ Migration failed: {e}")
        import traceback
        traceback.print_exc()
        return False


if __name__ == "__main__":
    success = run_migration()
    sys.exit(0 if success else 1)

