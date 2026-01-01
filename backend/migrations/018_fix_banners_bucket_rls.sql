-- Migration: Fix banners bucket RLS policies
-- This migration ensures the banners bucket exists with proper RLS policies
-- Run this in your Supabase SQL Editor

-- ============================================
-- 1. Create or update banners bucket
-- ============================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'banners',
  'banners',
  true,
  5242880, -- 5MB limit
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/jpg', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/jpg', 'image/gif'];

-- ============================================
-- 2. Drop any conflicting policies on banners bucket
-- ============================================

DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload banners" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own banners" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own banners" ON storage.objects;

-- ============================================
-- 3. Create fresh RLS policies for banners bucket
-- ============================================

-- Allow everyone (public + authenticated) to SELECT (read) from banners bucket
CREATE POLICY "Public Access: Select banners"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'banners');

-- Allow authenticated users to INSERT (upload) to banners bucket
CREATE POLICY "Authenticated Users: Insert banners"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'banners');

-- Allow authenticated users to UPDATE files in banners bucket
CREATE POLICY "Authenticated Users: Update banners"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'banners')
WITH CHECK (bucket_id = 'banners');

-- Allow authenticated users to DELETE files in banners bucket
CREATE POLICY "Authenticated Users: Delete banners"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'banners');

-- ============================================
-- 4. Verify Setup
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

-- Check policies were created
SELECT 
  schemaname, 
  tablename, 
  policyname, 
  permissive, 
  roles, 
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'objects' 
  AND schemaname = 'storage'
  AND policyname LIKE '%banner%'
ORDER BY policyname;



