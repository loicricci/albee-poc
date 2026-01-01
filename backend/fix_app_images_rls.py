"""
Quick script to fix Storage RLS policies for app-images bucket (favicon, logo, etc.).
This fixes the "new row violates row-level security policy" error when uploading app images.

Usage:
    python backend/fix_app_images_rls.py
"""

import os
import sys
from pathlib import Path
from dotenv import load_dotenv
from supabase import create_client, Client

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

def fix_app_images_bucket():
    """Create app-images bucket and set up proper RLS policies"""
    
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        print("❌ Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set")
        print("\nPlease set these in your .env file:")
        print("  SUPABASE_URL=https://your-project.supabase.co")
        print("  SUPABASE_SERVICE_ROLE_KEY=your_service_role_key")
        print("\nAlternatively, run the SQL migration manually via Supabase Dashboard:")
        print("  1. Go to your Supabase Dashboard → SQL Editor")
        print("  2. Copy the SQL from backend/migrations/009_app_images_bucket.sql")
        print("  3. Paste and run")
        sys.exit(1)
    
    try:
        # Create Supabase client with service role key
        supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
        
        print("🔧 Fixing app-images bucket RLS policies...")
        print("-" * 70)
        
        # SQL to fix the app-images bucket
        sql = """
-- Create or update app-images bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'app-images', 
  'app-images', 
  true,
  10485760, -- 10MB limit
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/svg+xml', 'image/gif', 'image/x-icon', 'image/vnd.microsoft.icon']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/svg+xml', 'image/gif', 'image/x-icon', 'image/vnd.microsoft.icon'];

-- Drop existing policies for app-images
DROP POLICY IF EXISTS "Allow authenticated admins to upload app images" ON storage.objects;
DROP POLICY IF EXISTS "Allow public to read app images" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated admins to update app images" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated admins to delete app images" ON storage.objects;

-- Create permissive policies for app-images bucket
-- Allow authenticated users to INSERT (upload)
CREATE POLICY "Allow authenticated to upload app images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'app-images');

-- Allow everyone to SELECT (read)
CREATE POLICY "Allow public to read app images"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'app-images');

-- Allow authenticated users to UPDATE
CREATE POLICY "Allow authenticated to update app images"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'app-images')
WITH CHECK (bucket_id = 'app-images');

-- Allow authenticated users to DELETE
CREATE POLICY "Allow authenticated to delete app images"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'app-images');

-- Grant necessary permissions
GRANT SELECT ON storage.objects TO authenticated, anon;
GRANT INSERT, UPDATE, DELETE ON storage.objects TO authenticated;
GRANT USAGE ON SCHEMA storage TO authenticated, anon;
"""
        
        # Execute the SQL
        result = supabase.rpc('exec_sql', {'sql': sql}).execute()
        
        print("✅ App-images bucket created/updated successfully!")
        print("✅ RLS policies configured!")
        print("\n" + "="*70)
        print("NEXT STEPS")
        print("="*70)
        print("\n1. Refresh your browser (Ctrl+Shift+R / Cmd+Shift+R)")
        print("2. Try uploading the favicon again from the admin panel")
        print("3. The upload should now work!")
        print("\n" + "="*70)
        
    except Exception as e:
        print(f"❌ Error: {e}")
        print("\n" + "="*70)
        print("MANUAL FIX INSTRUCTIONS")
        print("="*70)
        print("\nPlease run this SQL manually in Supabase Dashboard:")
        print("\n1. Go to your Supabase Dashboard → SQL Editor")
        print("2. Create a new query")
        print("3. Copy and paste the following SQL:")
        print("\n" + "="*70)
        print("""
-- Create or update app-images bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'app-images', 
  'app-images', 
  true,
  10485760,
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/svg+xml', 'image/gif', 'image/x-icon', 'image/vnd.microsoft.icon']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/svg+xml', 'image/gif', 'image/x-icon', 'image/vnd.microsoft.icon'];

-- Drop existing policies
DROP POLICY IF EXISTS "Allow authenticated admins to upload app images" ON storage.objects;
DROP POLICY IF EXISTS "Allow public to read app images" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated admins to update app images" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated admins to delete app images" ON storage.objects;

-- Create new policies
CREATE POLICY "Allow authenticated to upload app images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'app-images');

CREATE POLICY "Allow public to read app images"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'app-images');

CREATE POLICY "Allow authenticated to update app images"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'app-images')
WITH CHECK (bucket_id = 'app-images');

CREATE POLICY "Allow authenticated to delete app images"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'app-images');

-- Grant permissions
GRANT SELECT ON storage.objects TO authenticated, anon;
GRANT INSERT, UPDATE, DELETE ON storage.objects TO authenticated;
GRANT USAGE ON SCHEMA storage TO authenticated, anon;
""")
        print("="*70)
        print("\n4. Click 'Run'")
        print("5. Then try uploading the favicon again")

if __name__ == "__main__":
    fix_app_images_bucket()








