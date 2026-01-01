#!/usr/bin/env python3
"""
Utility script to manually clean up user accounts that are in an inconsistent state.
This will delete the user from both Supabase Auth and the database.

Usage:
    python cleanup_user.py <email>

Example:
    python cleanup_user.py loic@wemine.fi
"""

import os
import sys
import asyncio
import httpx
from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

# Load environment variables
load_dotenv("backend/.env")

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
DATABASE_URL = os.getenv("DATABASE_URL")

if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
    print("❌ Error: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not found in environment")
    sys.exit(1)

if not DATABASE_URL:
    print("❌ Error: DATABASE_URL not found in environment")
    sys.exit(1)


async def get_supabase_user_by_email(email: str):
    """Get user from Supabase Auth by email"""
    async with httpx.AsyncClient(timeout=10) as client:
        # List users endpoint doesn't have direct email filter, so we'll get all and filter
        # For a better approach, you might want to use the Supabase Admin SDK
        response = await client.get(
            f"{SUPABASE_URL}/auth/v1/admin/users",
            headers={
                "apikey": SUPABASE_SERVICE_ROLE_KEY,
                "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
            },
        )
        
        if response.status_code == 200:
            data = response.json()
            users = data.get("users", [])
            for user in users:
                if user.get("email", "").lower() == email.lower():
                    return user
        return None


async def delete_supabase_user(user_id: str):
    """Delete user from Supabase Auth"""
    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.delete(
            f"{SUPABASE_URL}/auth/v1/admin/users/{user_id}",
            headers={
                "apikey": SUPABASE_SERVICE_ROLE_KEY,
                "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
            },
        )
        
        if response.status_code in (200, 204):
            return True
        else:
            print(f"⚠️  Failed to delete Supabase user: {response.text}")
            return False


def delete_database_profile(user_id: str):
    """Delete profile from database"""
    engine = create_engine(DATABASE_URL)
    Session = sessionmaker(bind=engine)
    session = Session()
    
    try:
        # Delete from profiles table (should cascade to other tables)
        result = session.execute(
            text("DELETE FROM profiles WHERE user_id = :user_id"),
            {"user_id": user_id}
        )
        session.commit()
        
        if result.rowcount > 0:
            return True
        else:
            print(f"⚠️  No profile found in database with user_id: {user_id}")
            return False
    except Exception as e:
        session.rollback()
        print(f"❌ Database error: {str(e)}")
        return False
    finally:
        session.close()


def get_database_profile_by_email(email: str):
    """Check if profile exists in database (Note: profiles don't store email directly)"""
    engine = create_engine(DATABASE_URL)
    Session = sessionmaker(bind=engine)
    session = Session()
    
    try:
        # We can't directly query by email since profiles table doesn't store it
        # But we can list all profiles
        result = session.execute(
            text("SELECT user_id, handle, display_name FROM profiles ORDER BY created_at DESC")
        )
        profiles = result.fetchall()
        return profiles
    except Exception as e:
        print(f"❌ Database error: {str(e)}")
        return []
    finally:
        session.close()


async def cleanup_user(email: str):
    """Clean up user from both Supabase Auth and database"""
    print(f"\n🔍 Searching for user with email: {email}\n")
    
    # Check Supabase Auth
    print("1️⃣  Checking Supabase Auth...")
    supabase_user = await get_supabase_user_by_email(email)
    
    if supabase_user:
        user_id = supabase_user["id"]
        print(f"   ✅ Found in Supabase Auth")
        print(f"      - ID: {user_id}")
        print(f"      - Email: {supabase_user.get('email')}")
        print(f"      - Created: {supabase_user.get('created_at')}")
        print(f"      - Email confirmed: {supabase_user.get('email_confirmed_at') is not None}")
        print(f"      - Identities: {len(supabase_user.get('identities', []))}")
    else:
        print(f"   ❌ Not found in Supabase Auth")
        user_id = None
    
    # Check database
    print("\n2️⃣  Checking database profiles...")
    profiles = get_database_profile_by_email(email)
    
    if user_id:
        # Look for matching profile
        matching_profile = None
        for p in profiles:
            if str(p[0]) == user_id:
                matching_profile = p
                break
        
        if matching_profile:
            print(f"   ✅ Found matching profile in database")
            print(f"      - Handle: {matching_profile[1]}")
            print(f"      - Display name: {matching_profile[2]}")
        else:
            print(f"   ⚠️  No matching profile found in database")
    
    print(f"\n   Total profiles in database: {len(profiles)}")
    for p in profiles[:5]:  # Show first 5
        print(f"      - {p[0]}: {p[1]} ({p[2]})")
    if len(profiles) > 5:
        print(f"      ... and {len(profiles) - 5} more")
    
    # Ask for confirmation
    print("\n" + "="*60)
    if supabase_user or user_id:
        print("⚠️  WARNING: This will permanently delete:")
        if supabase_user:
            print(f"   - User from Supabase Auth (ID: {user_id})")
        if matching_profile:
            print(f"   - Profile from database (handle: {matching_profile[1]})")
        print("\nThis action CANNOT be undone!")
        print("="*60)
        
        confirm = input("\nType 'DELETE' to confirm deletion: ")
        
        if confirm != "DELETE":
            print("\n❌ Deletion cancelled.")
            return
        
        print("\n🗑️  Deleting user...\n")
        
        # Delete from database first
        if matching_profile or user_id:
            print("   Deleting from database...")
            if delete_database_profile(user_id):
                print("   ✅ Deleted from database")
            else:
                print("   ⚠️  Database deletion completed (may not have existed)")
        
        # Delete from Supabase Auth
        if supabase_user:
            print("   Deleting from Supabase Auth...")
            if await delete_supabase_user(user_id):
                print("   ✅ Deleted from Supabase Auth")
            else:
                print("   ❌ Failed to delete from Supabase Auth")
        
        print("\n✅ Cleanup complete! User can now sign up with this email again.\n")
    else:
        print("❌ User not found in either Supabase Auth or database.")
        print("   They should be able to sign up with this email.")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python cleanup_user.py <email>")
        print("\nExample:")
        print("  python cleanup_user.py loic@wemine.fi")
        sys.exit(1)
    
    email = sys.argv[1]
    asyncio.run(cleanup_user(email))



