-- Migration: Setup Storage Buckets for Image Uploads
-- This fixes the "new row violates row-level security policy" error
-- Run this in your Supabase SQL Editor

-- ============================================
-- 1. Create Storage Buckets
-- ============================================

-- Create avatars bucket (for user profile pictures)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars', 
  'avatars', 
  true,
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

-- Create avee-avatars bucket (for avee profile pictures)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avee-avatars', 
  'avee-avatars', 
  true,
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

-- ============================================
-- 2. Drop Existing Policies (if any)
-- ============================================

-- Drop existing policies for avatars bucket
DROP POLICY IF EXISTS "Allow authenticated users to upload avatars" ON storage.objects;
DROP POLICY IF EXISTS "Allow public to read avatars" ON storage.objects;
DROP POLICY IF EXISTS "Allow users to update their avatars" ON storage.objects;
DROP POLICY IF EXISTS "Allow users to delete their avatars" ON storage.objects;

-- Drop existing policies for avee-avatars bucket
DROP POLICY IF EXISTS "Allow authenticated users to upload avee avatars" ON storage.objects;
DROP POLICY IF EXISTS "Allow public to read avee avatars" ON storage.objects;
DROP POLICY IF EXISTS "Allow users to update avee avatars" ON storage.objects;
DROP POLICY IF EXISTS "Allow users to delete avee avatars" ON storage.objects;

-- ============================================
-- 3. RLS Policies for 'avatars' bucket
-- ============================================

-- Allow authenticated users to INSERT (upload) to avatars bucket
CREATE POLICY "Allow authenticated users to upload avatars"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'avatars');

-- Allow everyone (public + authenticated) to SELECT (read) from avatars bucket
CREATE POLICY "Allow public to read avatars"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'avatars');

-- Allow authenticated users to UPDATE files in avatars bucket
CREATE POLICY "Allow users to update their avatars"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'avatars')
WITH CHECK (bucket_id = 'avatars');

-- Allow authenticated users to DELETE files in avatars bucket
CREATE POLICY "Allow users to delete their avatars"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'avatars');

-- ============================================
-- 4. RLS Policies for 'avee-avatars' bucket
-- ============================================

-- Allow authenticated users to INSERT (upload) to avee-avatars bucket
CREATE POLICY "Allow authenticated users to upload avee avatars"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'avee-avatars');

-- Allow everyone (public + authenticated) to SELECT (read) from avee-avatars bucket
CREATE POLICY "Allow public to read avee avatars"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'avee-avatars');

-- Allow authenticated users to UPDATE files in avee-avatars bucket
CREATE POLICY "Allow users to update avee avatars"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'avee-avatars')
WITH CHECK (bucket_id = 'avee-avatars');

-- Allow authenticated users to DELETE files in avee-avatars bucket
CREATE POLICY "Allow users to delete avee avatars"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'avee-avatars');

-- ============================================
-- 5. Verify Setup
-- ============================================

-- Check buckets were created
SELECT id, name, public, file_size_limit, allowed_mime_types 
FROM storage.buckets 
WHERE id IN ('avatars', 'avee-avatars');

-- Check policies were created
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'objects' 
  AND schemaname = 'storage'
  AND policyname LIKE '%avatar%'
ORDER BY policyname;


