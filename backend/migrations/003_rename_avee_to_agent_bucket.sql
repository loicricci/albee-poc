-- Migration: Rename avee-avatars bucket to agent-avatars
-- Run this in your Supabase SQL Editor after the previous storage bucket migration

-- ============================================
-- 1. Create New Bucket
-- ============================================

-- Create agent-avatars bucket (for agent profile pictures)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'agent-avatars', 
  'agent-avatars', 
  true,
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

-- ============================================
-- 2. Copy Files from Old Bucket (if any exist)
-- ============================================

-- Note: This SQL cannot directly copy files between buckets.
-- If you have existing files in 'avee-avatars', you'll need to either:
-- Option A: Copy them manually via Supabase Dashboard
-- Option B: Use a migration script with Supabase Storage API
-- Option C: Accept that old images will need to be re-uploaded

-- For reference, here's what you'd do with JavaScript:
/*
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

async function migrateFiles() {
  // List all files in old bucket
  const { data: files } = await supabase.storage
    .from('avee-avatars')
    .list()

  for (const file of files) {
    // Download from old bucket
    const { data: fileData } = await supabase.storage
      .from('avee-avatars')
      .download(file.name)
    
    // Upload to new bucket
    await supabase.storage
      .from('agent-avatars')
      .upload(file.name, fileData)
  }
}
*/

-- ============================================
-- 3. RLS Policies for 'agent-avatars' bucket
-- ============================================

-- Drop existing policies for avee-avatars bucket (if any)
DROP POLICY IF EXISTS "Allow authenticated users to upload avee avatars" ON storage.objects;
DROP POLICY IF EXISTS "Allow public to read avee avatars" ON storage.objects;
DROP POLICY IF EXISTS "Allow users to update avee avatars" ON storage.objects;
DROP POLICY IF EXISTS "Allow users to delete avee avatars" ON storage.objects;

-- Allow authenticated users to INSERT (upload) to agent-avatars bucket
CREATE POLICY "Allow authenticated users to upload agent avatars"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'agent-avatars');

-- Allow everyone (public + authenticated) to SELECT (read) from agent-avatars bucket
CREATE POLICY "Allow public to read agent avatars"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'agent-avatars');

-- Allow authenticated users to UPDATE files in agent-avatars bucket
CREATE POLICY "Allow users to update agent avatars"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'agent-avatars')
WITH CHECK (bucket_id = 'agent-avatars');

-- Allow authenticated users to DELETE files in agent-avatars bucket
CREATE POLICY "Allow users to delete agent avatars"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'agent-avatars');

-- ============================================
-- 4. Verify Setup
-- ============================================

-- Check buckets were created
SELECT id, name, public, file_size_limit, allowed_mime_types 
FROM storage.buckets 
WHERE id IN ('avatars', 'agent-avatars')
ORDER BY id;

-- Check policies were created
SELECT schemaname, tablename, policyname, permissive, roles, cmd
FROM pg_policies
WHERE tablename = 'objects' 
  AND schemaname = 'storage'
  AND policyname LIKE '%avatar%'
ORDER BY policyname;

-- ============================================
-- 5. Optional: Delete Old Bucket (only after migration complete)
-- ============================================

-- IMPORTANT: Only run this after you've:
-- 1. Migrated all files from avee-avatars to agent-avatars
-- 2. Verified all images are working with the new bucket
-- 3. Updated all frontend code to use 'agent-avatars'

-- DELETE FROM storage.buckets WHERE id = 'avee-avatars';


