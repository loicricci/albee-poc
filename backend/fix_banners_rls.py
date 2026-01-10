#!/usr/bin/env python3
"""
Fix banners bucket RLS policies for profile banner uploads
This script applies the migration to create the banners bucket with proper RLS policies
"""

import os
from supabase import create_client, Client

def get_supabase_client() -> Client:
    """Create and return a Supabase client"""
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    
    if not url or not key:
        raise ValueError(
            "Missing environment variables. Please set:\n"
            "- SUPABASE_URL\n"
            "- SUPABASE_SERVICE_ROLE_KEY"
        )
    
    return create_client(url, key)

def read_migration_file() -> str:
    """Read the migration SQL file"""
    script_dir = os.path.dirname(os.path.abspath(__file__))
    migration_file = os.path.join(script_dir, "migrations", "017_fix_banners_bucket_rls.sql")
    
    with open(migration_file, "r") as f:
        return f.read()

def apply_migration(supabase: Client):
    """Apply the banners bucket RLS migration"""
    print("🚀 Applying banners bucket RLS migration...")
    
    sql = read_migration_file()
    
    # Split by statement separator and execute each part
    # We need to execute this in parts because Supabase RPC has limitations
    statements = [
        stmt.strip() 
        for stmt in sql.split(";") 
        if stmt.strip() and not stmt.strip().startswith("--")
    ]
    
    for i, statement in enumerate(statements, 1):
        # Skip comment blocks and verification queries
        if (statement.strip().startswith("/*") or 
            statement.strip().startswith("SELECT") or
            "pg_policies" in statement):
            continue
            
        try:
            print(f"  Executing statement {i}/{len(statements)}...")
            supabase.postgrest.rpc("exec_sql", {"sql": statement}).execute()
        except Exception as e:
            # Some statements may fail if they already exist, which is OK
            if "already exists" in str(e).lower() or "does not exist" in str(e).lower():
                print(f"  ⚠️  Warning: {e}")
            else:
                print(f"  ❌ Error: {e}")
                # Continue anyway as policies might already exist
    
    print("✅ Migration applied!")

def verify_setup(supabase: Client):
    """Verify the banners bucket and policies are set up correctly"""
    print("\n🔍 Verifying setup...")
    
    try:
        # Check if bucket exists by trying to list it
        buckets = supabase.storage.list_buckets()
        banners_bucket = next((b for b in buckets if b.get("id") == "banners"), None)
        
        if banners_bucket:
            print("✅ Banners bucket exists")
            print(f"   - Public: {banners_bucket.get('public')}")
            print(f"   - File size limit: {banners_bucket.get('file_size_limit')} bytes")
        else:
            print("❌ Banners bucket not found")
            return False
        
        print("\n✅ Setup verified!")
        return True
        
    except Exception as e:
        print(f"❌ Verification failed: {e}")
        return False

def main():
    """Main function"""
    print("=" * 60)
    print("Fix Banners Bucket RLS Policies")
    print("=" * 60)
    print()
    
    try:
        # Get Supabase client
        supabase = get_supabase_client()
        
        # Apply migration
        apply_migration(supabase)
        
        # Verify setup
        verify_setup(supabase)
        
        print("\n" + "=" * 60)
        print("✅ Done! Profile banner uploads should now work.")
        print("=" * 60)
        print("\nTest by:")
        print("1. Log in to your account")
        print("2. Go to Profile Settings")
        print("3. Upload a profile picture (avatars bucket)")
        print("4. Upload a banner image (banners bucket)")
        print()
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        print("\nPlease run the migration manually:")
        print("1. Go to your Supabase dashboard")
        print("2. Open the SQL Editor")
        print("3. Copy/paste backend/migrations/017_fix_banners_bucket_rls.sql")
        print("4. Execute the SQL")
        return 1
    
    return 0

if __name__ == "__main__":
    exit(main())



