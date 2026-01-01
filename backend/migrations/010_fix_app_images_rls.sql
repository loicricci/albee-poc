-- Migration: Fix app-images bucket RLS for favicon uploads
-- This fixes the "new row violates row-level security policy" error
-- Run this in your Supabase SQL Editor

-- ============================================
-- 1. Create/Update app-images bucket
-- ============================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'app-images', 
  'app-images', 
  true,
  10485760, -- 10MB limit
  ARRAY[
    'image/jpeg', 
    'image/jpg', 
    'image/png', 
    'image/webp', 
    'image/svg+xml', 
    'image/gif',
    'image/x-icon',
    'image/vnd.microsoft.icon'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY[
    'image/jpeg', 
    'image/jpg', 
    'image/png', 
    'image/webp', 
    'image/svg+xml', 
    'image/gif',
    'image/x-icon',
    'image/vnd.microsoft.icon'
  ];

-- ============================================
-- 2. Drop existing app-images policies
-- ============================================

DROP POLICY IF EXISTS "Allow authenticated admins to upload app images" ON storage.objects;
DROP POLICY IF EXISTS "Allow public to read app images" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated admins to update app images" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated admins to delete app images" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated to upload app images" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated to update app images" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated to delete app images" ON storage.objects;

-- ============================================
-- 3. Create new permissive RLS policies
-- ============================================

-- Allow authenticated users to INSERT (upload) to app-images
CREATE POLICY "Allow authenticated to upload app images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'app-images');

-- Allow everyone (public + authenticated) to SELECT (read) from app-images
CREATE POLICY "Allow public to read app images"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'app-images');

-- Allow authenticated users to UPDATE files in app-images
CREATE POLICY "Allow authenticated to update app images"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'app-images')
WITH CHECK (bucket_id = 'app-images');

-- Allow authenticated users to DELETE files in app-images
CREATE POLICY "Allow authenticated to delete app images"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'app-images');

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
WHERE id = 'app-images';

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
  AND policyname LIKE '%app images%'
ORDER BY policyname;







