"""
Quick script to fix Storage RLS policies for agent avatars.
This fixes the "new row violates row-level security policy" error.

Usage:
    python backend/fix_storage_rls.py
"""

import os
import sys
from pathlib import Path
from dotenv import load_dotenv
import httpx

# Load environment variables
env_path = Path(__file__).parent / ".env"
if env_path.exists():
    load_dotenv(env_path)
else:
    # Try parent directory
    env_path = Path(__file__).parent.parent / ".env"
    if env_path.exists():
        load_dotenv(env_path)

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY")

def read_migration_file():
    """Read the SQL migration file."""
    migration_path = Path(__file__).parent / "migrations" / "006_fix_storage_rls.sql"
    
    if not migration_path.exists():
        print(f"❌ Migration file not found: {migration_path}")
        sys.exit(1)
    
    with open(migration_path, "r") as f:
        return f.read()

def run_migration_via_supabase_api(sql: str):
    """
    Run SQL migration using Supabase REST API.
    Note: This requires a service role key.
    """
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        print("❌ Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set")
        print("\nPlease set these in your .env file:")
        print("  SUPABASE_URL=https://your-project.supabase.co")
        print("  SUPABASE_SERVICE_ROLE_KEY=your_service_role_key")
        print("\nAlternatively, run the SQL migration manually via Supabase Dashboard:")
        print("  1. Go to your Supabase Dashboard → SQL Editor")
        print("  2. Copy the contents of backend/migrations/006_fix_storage_rls.sql")
        print("  3. Paste and run")
        sys.exit(1)
    
    url = f"{SUPABASE_URL}/rest/v1/rpc/exec_sql"
    headers = {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        "Content-Type": "application/json",
    }
    
    print(f"🔄 Running migration via Supabase API...")
    
    try:
        response = httpx.post(url, headers=headers, json={"sql": sql}, timeout=30.0)
        response.raise_for_status()
        print("✅ Migration completed successfully!")
        return True
    except Exception as e:
        print(f"❌ Failed to run migration via API: {e}")
        print("\n⚠️  Please run the migration manually via Supabase Dashboard:")
        print("  1. Go to your Supabase Dashboard → SQL Editor")
        print("  2. Open: backend/migrations/006_fix_storage_rls.sql")
        print("  3. Copy all contents and paste into SQL Editor")
        print("  4. Click 'Run'")
        return False

def print_instructions():
    """Print manual instructions."""
    print("\n" + "="*70)
    print("MANUAL MIGRATION INSTRUCTIONS")
    print("="*70)
    print("\nTo fix the Storage RLS policy error, run this SQL in Supabase:")
    print("\n1. Go to your Supabase Dashboard")
    print("2. Navigate to: SQL Editor")
    print("3. Click: New Query")
    print("4. Copy the entire contents of:")
    print("   📄 backend/migrations/006_fix_storage_rls.sql")
    print("5. Paste into the SQL editor")
    print("6. Click: ▶ Run")
    print("\n" + "="*70)
    print("\nAfter running the migration:")
    print("  ✓ Refresh your frontend (hard refresh: Ctrl+Shift+R)")
    print("  ✓ Agent avatars should now load without errors")
    print("  ✓ Check FIX_STORAGE_RLS_POLICY.md for verification steps")
    print("="*70 + "\n")

def main():
    print("🔧 Fix Storage RLS Policy for Agent Avatars")
    print("-" * 70)
    
    # Read migration file
    migration_sql = read_migration_file()
    print(f"✓ Loaded migration file ({len(migration_sql)} bytes)")
    
    # Try to run via API (if service role key available)
    if SUPABASE_SERVICE_ROLE_KEY:
        success = run_migration_via_supabase_api(migration_sql)
        if success:
            print("\n✅ Done! Agent avatar RLS policies have been fixed.")
            print("\n📝 Next steps:")
            print("  1. Refresh your frontend (Ctrl+Shift+R)")
            print("  2. Navigate to Network or My Agents page")
            print("  3. Agent avatars should now load correctly")
            print("\n📖 For verification steps, see: FIX_STORAGE_RLS_POLICY.md")
            return
    
    # Fallback to manual instructions
    print_instructions()

if __name__ == "__main__":
    main()













