-- Migration: Setup App Images Bucket for Platform Logo, Cover, etc.
-- This creates a dedicated bucket for platform-level images
-- Run this in your Supabase SQL Editor

-- ============================================
-- 1. Create App Images Bucket
-- ============================================

-- Create app-images bucket (for platform logo, cover, favicon, etc.)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'app-images', 
  'app-images', 
  true,  -- Public so everyone can see the logo
  10485760, -- 10MB limit (larger for cover images)
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/svg+xml', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/svg+xml', 'image/gif'];

-- ============================================
-- 2. Drop Existing Policies (if any)
-- ============================================

DROP POLICY IF EXISTS "Allow authenticated admins to upload app images" ON storage.objects;
DROP POLICY IF EXISTS "Allow public to read app images" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated admins to update app images" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated admins to delete app images" ON storage.objects;

-- ============================================
-- 3. RLS Policies for 'app-images' bucket
-- ============================================

-- Allow authenticated users to INSERT (upload) to app-images bucket
-- Note: You may want to restrict this to admin users only in production
CREATE POLICY "Allow authenticated admins to upload app images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'app-images');

-- Allow everyone (public + authenticated) to SELECT (read) from app-images bucket
CREATE POLICY "Allow public to read app images"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'app-images');

-- Allow authenticated users to UPDATE files in app-images bucket
CREATE POLICY "Allow authenticated admins to update app images"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'app-images')
WITH CHECK (bucket_id = 'app-images');

-- Allow authenticated users to DELETE files in app-images bucket
CREATE POLICY "Allow authenticated admins to delete app images"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'app-images');

-- ============================================
-- 4. Create App Config Table (Optional)
-- ============================================

-- This table stores platform configuration like logo URLs, app name, etc.
CREATE TABLE IF NOT EXISTS app_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    config_key VARCHAR(100) UNIQUE NOT NULL,
    config_value TEXT,
    description TEXT,
    updated_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_app_config_key ON app_config(config_key);

-- Insert default configuration
INSERT INTO app_config (config_key, config_value, description) VALUES
  ('app_name', 'Gabee', 'Platform name'),
  ('app_logo_url', '', 'Main platform logo URL'),
  ('app_cover_url', '', 'Platform cover/hero image URL'),
  ('app_favicon_url', '', 'Platform favicon URL')
ON CONFLICT (config_key) DO NOTHING;

-- Add RLS policies for app_config
ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;

-- Everyone can read app config
CREATE POLICY "Allow public to read app config"
ON app_config
FOR SELECT
TO public
USING (true);

-- Only authenticated users can update app config (restrict to admins in production)
CREATE POLICY "Allow authenticated to update app config"
ON app_config
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- ============================================
-- 5. Verify Setup
-- ============================================

-- Check bucket was created
SELECT id, name, public, file_size_limit, allowed_mime_types 
FROM storage.buckets 
WHERE id = 'app-images';

-- Check policies were created
SELECT schemaname, tablename, policyname, permissive, roles, cmd
FROM pg_policies
WHERE tablename = 'objects' 
  AND schemaname = 'storage'
  AND policyname LIKE '%app images%'
ORDER BY policyname;

-- Check app_config table
SELECT * FROM app_config;


