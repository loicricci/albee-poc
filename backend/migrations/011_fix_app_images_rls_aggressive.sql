-- Migration: Aggressive fix for app-images RLS error
-- This completely removes all RLS restrictions for the app-images bucket
-- Run this in your Supabase SQL Editor

-- ============================================
-- 1. Check current state (for debugging)
-- ============================================

-- See what policies currently exist
SELECT policyname, cmd, roles 
FROM pg_policies 
WHERE schemaname = 'storage' 
  AND tablename = 'objects'
ORDER BY policyname;

-- ============================================
-- 2. Create/Update app-images bucket
-- ============================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'app-images', 
  'app-images', 
  true,
  10485760, -- 10MB
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
-- 3. Drop ALL policies for app-images bucket
-- ============================================

DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT policyname 
        FROM pg_policies 
        WHERE schemaname = 'storage' 
          AND tablename = 'objects'
          AND (
            policyname LIKE '%app image%'
            OR policyname LIKE '%app-image%'
          )
    ) LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON storage.objects';
    END LOOP;
END $$;

-- ============================================
-- 4. Create VERY PERMISSIVE policies
-- ============================================

-- Allow ALL operations for authenticated users on app-images
CREATE POLICY "app_images_all_authenticated"
ON storage.objects
FOR ALL
TO authenticated
USING (bucket_id = 'app-images')
WITH CHECK (bucket_id = 'app-images');

-- Allow SELECT for everyone (including anon)
CREATE POLICY "app_images_select_public"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'app-images');

-- ============================================
-- 5. Grant all necessary permissions
-- ============================================

-- Grant permissions on storage schema
GRANT USAGE ON SCHEMA storage TO authenticated, anon, public;

-- Grant permissions on storage.objects table
GRANT SELECT ON storage.objects TO authenticated, anon, public;
GRANT INSERT, UPDATE, DELETE ON storage.objects TO authenticated;

-- Grant permissions on storage.buckets
GRANT SELECT ON storage.buckets TO authenticated, anon, public;

-- ============================================
-- 6. Verify the fix
-- ============================================

-- Check bucket
SELECT 
  id, 
  name, 
  public, 
  file_size_limit 
FROM storage.buckets 
WHERE id = 'app-images';

-- Check policies (should show 2 policies)
SELECT 
  policyname, 
  cmd, 
  roles,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'storage' 
  AND tablename = 'objects'
  AND policyname LIKE '%app_images%'
ORDER BY policyname;

-- Check permissions
SELECT 
  grantee,
  privilege_type 
FROM information_schema.table_privileges 
WHERE table_schema = 'storage' 
  AND table_name = 'objects'
ORDER BY grantee, privilege_type;







