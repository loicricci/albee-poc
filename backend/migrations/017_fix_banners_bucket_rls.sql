-- Migration: Fix banners bucket RLS for profile banner uploads
-- This fixes the "new row violates row-level security policy" error when uploading profile banners
-- Run this in your Supabase SQL Editor

-- ============================================
-- 1. Create/Update banners bucket
-- ============================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'banners', 
  'banners', 
  true,
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];

-- ============================================
-- 2. Drop existing banners policies (if any)
-- ============================================

DROP POLICY IF EXISTS "Allow authenticated to upload banners" ON storage.objects;
DROP POLICY IF EXISTS "Allow public to read banners" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated to update banners" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated to delete banners" ON storage.objects;

-- ============================================
-- 3. Create fresh RLS policies for banners bucket
-- ============================================

-- Allow authenticated users to INSERT (upload) to banners bucket
CREATE POLICY "Allow authenticated to upload banners"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'banners');

-- Allow everyone (public + authenticated) to SELECT (read) from banners bucket
CREATE POLICY "Allow public to read banners"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'banners');

-- Allow authenticated users to UPDATE files in banners bucket
CREATE POLICY "Allow authenticated to update banners"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'banners')
WITH CHECK (bucket_id = 'banners');

-- Allow authenticated users to DELETE files in banners bucket
CREATE POLICY "Allow authenticated to delete banners"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'banners');

-- ============================================
-- 4. Grant necessary permissions
-- ============================================

GRANT SELECT ON storage.objects TO authenticated, anon;
GRANT INSERT, UPDATE, DELETE ON storage.objects TO authenticated;
GRANT USAGE ON SCHEMA storage TO authenticated, anon;

-- ============================================
-- 5. Verify the setup
-- ============================================

-- Check bucket configuration
SELECT 
  id, 
  name, 
  public, 
  file_size_limit, 
  allowed_mime_types 
FROM storage.buckets 
WHERE id = 'banners';

-- Check policies
SELECT 
  schemaname, 
  tablename, 
  policyname, 
  permissive, 
  roles, 
  cmd
FROM pg_policies
WHERE tablename = 'objects' 
  AND schemaname = 'storage'
  AND policyname LIKE '%banners%'
ORDER BY policyname;



