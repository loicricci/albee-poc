#!/usr/bin/env python3
"""
Script to create Elton John profile and agent in the database.
This will make @eltonjohn discoverable in search.
"""

import os
import sys
import uuid
from datetime import datetime

# Add backend to path
sys.path.insert(0, 'backend')

from dotenv import load_dotenv
from sqlalchemy import create_engine, text

# Load environment variables
load_dotenv('backend/.env', override=True)

# Configuration
DATABASE_URL = os.getenv('DATABASE_URL')

# Elton John details
HANDLE = "eltonjohn"
DISPLAY_NAME = "Elton John"
BIO = "🎹 Legendary musician, composer, and performer | 🌟 50+ years of hits | 🏳️‍🌈 LGBTQ+ activist & AIDS Foundation founder | 👓 Icon of style and music"

# You'll need to provide a valid Supabase user ID or create a user first
# For native agents, we typically create a special "system" user or use an admin user

def create_elton_john():
    """Create Elton John profile and agent"""
    engine = create_engine(DATABASE_URL)
    
    print("=" * 60)
    print("🎹 Creating Elton John Profile & Agent")
    print("=" * 60)
    print()
    
    with engine.connect() as conn:
        # Check if profile already exists
        result = conn.execute(
            text("SELECT user_id, handle FROM profiles WHERE handle = :handle"),
            {"handle": HANDLE}
        )
        existing_profile = result.fetchone()
        
        if existing_profile:
            user_id = str(existing_profile[0])
            print(f"✅ Profile already exists: @{HANDLE}")
            print(f"   User ID: {user_id}")
        else:
            # We need a Supabase auth user first
            print("❌ No Supabase auth user found for Elton John")
            print()
            print("To create Elton John agent, you need to:")
            print("1. Create a Supabase auth user (via Supabase dashboard or signup)")
            print("2. Get the user_id from auth.users table")
            print("3. Run this script with that user_id")
            print()
            print("OR")
            print()
            print("Use the web UI at http://localhost:3001/agent/create to create the agent")
            print("while logged in as an admin or regular user.")
            return
        
        # Check if avee already exists
        result = conn.execute(
            text("SELECT id, handle FROM avees WHERE handle = :handle"),
            {"handle": HANDLE}
        )
        existing_avee = result.fetchone()
        
        if existing_avee:
            print(f"✅ Agent already exists: @{HANDLE}")
            print(f"   Avee ID: {existing_avee[0]}")
            print()
            print("✅ Elton John is ready! Try searching for 'elton' in the app.")
        else:
            # Create avee
            avee_id = str(uuid.uuid4())
            
            # Load persona from file
            persona_path = "data/elton_john/persona_elton_john.md"
            try:
                with open(persona_path, 'r', encoding='utf-8') as f:
                    persona = f.read()
            except FileNotFoundError:
                persona = "I am Sir Elton John - legendary musician, performer, and activist."
            
            conn.execute(text("""
                INSERT INTO avees (
                    id, handle, display_name, bio, owner_user_id, persona,
                    is_native, created_at
                ) VALUES (
                    :id, :handle, :display_name, :bio, :owner_user_id, :persona,
                    true, NOW()
                )
            """), {
                "id": avee_id,
                "handle": HANDLE,
                "display_name": DISPLAY_NAME,
                "bio": BIO,
                "owner_user_id": user_id,
                "persona": persona[:5000]  # Limit persona size if needed
            })
            
            conn.commit()
            
            print(f"✅ Agent created: @{HANDLE}")
            print(f"   Avee ID: {avee_id}")
            print(f"   Owner: {user_id}")
            print()
            print("✅ Elton John is ready! Try searching for 'elton' in the app.")

if __name__ == "__main__":
    create_elton_john()






