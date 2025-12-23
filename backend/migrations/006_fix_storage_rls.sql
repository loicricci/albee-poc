-- Migration: Fix Storage RLS Policies for Agent Avatars
-- This fixes the "new row violates row-level security policy" error
-- Run this in your Supabase SQL Editor

-- ============================================
-- 1. Ensure buckets exist and are public
-- ============================================

-- Update avatars bucket to be public
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars', 
  'avatars', 
  true,
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];

-- Update agent-avatars bucket to be public
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'agent-avatars', 
  'agent-avatars', 
  true,
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];

-- ============================================
-- 2. Drop ALL existing storage.objects policies
-- ============================================

-- Drop all policies on storage.objects to start fresh
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects') LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON storage.objects';
    END LOOP;
END $$;

-- ============================================
-- 3. Create fresh RLS policies with correct permissions
-- ============================================

-- Enable RLS on storage.objects (should already be enabled)
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- ============================================
-- Policies for 'avatars' bucket
-- ============================================

-- Allow ALL users (including anon) to SELECT (read) from avatars bucket
CREATE POLICY "Public Access: Select avatars"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'avatars');

-- Allow authenticated users to INSERT (upload) to avatars bucket
CREATE POLICY "Authenticated Users: Insert avatars"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'avatars');

-- Allow authenticated users to UPDATE files in avatars bucket
CREATE POLICY "Authenticated Users: Update avatars"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'avatars')
WITH CHECK (bucket_id = 'avatars');

-- Allow authenticated users to DELETE files in avatars bucket
CREATE POLICY "Authenticated Users: Delete avatars"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'avatars');

-- ============================================
-- Policies for 'agent-avatars' bucket
-- ============================================

-- Allow ALL users (including anon) to SELECT (read) from agent-avatars bucket
CREATE POLICY "Public Access: Select agent avatars"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'agent-avatars');

-- Allow authenticated users to INSERT (upload) to agent-avatars bucket
CREATE POLICY "Authenticated Users: Insert agent avatars"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'agent-avatars');

-- Allow authenticated users to UPDATE files in agent-avatars bucket
CREATE POLICY "Authenticated Users: Update agent avatars"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'agent-avatars')
WITH CHECK (bucket_id = 'agent-avatars');

-- Allow authenticated users to DELETE files in agent-avatars bucket
CREATE POLICY "Authenticated Users: Delete agent avatars"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'agent-avatars');

-- ============================================
-- Policies for 'voice-recordings' bucket (if exists)
-- ============================================

-- Allow authenticated users to INSERT to voice-recordings bucket (user-specific folders)
CREATE POLICY "Authenticated Users: Insert voice recordings"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'voice-recordings' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow authenticated users to SELECT from their own voice-recordings
CREATE POLICY "Authenticated Users: Select own voice recordings"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'voice-recordings' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow authenticated users to DELETE their own voice recordings
CREATE POLICY "Authenticated Users: Delete own voice recordings"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'voice-recordings' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- ============================================
-- 4. Grant permissions to authenticated and anon roles
-- ============================================

-- Grant SELECT on storage.objects to both roles
GRANT SELECT ON storage.objects TO authenticated, anon;

-- Grant INSERT, UPDATE, DELETE to authenticated
GRANT INSERT, UPDATE, DELETE ON storage.objects TO authenticated;

-- Grant usage on storage schema
GRANT USAGE ON SCHEMA storage TO authenticated, anon;

-- ============================================
-- 5. Verify Setup
-- ============================================

-- Check buckets configuration
SELECT 
  id, 
  name, 
  public, 
  file_size_limit, 
  allowed_mime_types 
FROM storage.buckets 
WHERE id IN ('avatars', 'agent-avatars', 'voice-recordings')
ORDER BY id;

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
ORDER BY policyname;

-- ============================================
-- 6. Test Query (optional)
-- ============================================

-- This should return no errors if everything is configured correctly
-- SELECT * FROM storage.objects WHERE bucket_id IN ('avatars', 'agent-avatars') LIMIT 5;


