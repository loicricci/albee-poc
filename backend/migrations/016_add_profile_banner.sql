-- Migration: Add banner support to profiles
-- This migration adds a banner_url field to the profiles table for profile cover images

-- Add banner_url column to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS banner_url TEXT;

-- Create banners storage bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'banners',
  'banners',
  true,
  5242880, -- 5MB limit
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/jpg']
)
ON CONFLICT (id) DO NOTHING;

-- Set up RLS policies for banners bucket
-- NOTE: This migration had issues with policy naming conflicts
-- If you encounter "new row violates row-level security policy" errors,
-- run migration 018_fix_banners_bucket_rls.sql instead

-- Anyone can read banners (they're public)
CREATE POLICY IF NOT EXISTS "Public Access: Select banners"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'banners');

-- Only authenticated users can upload banners
CREATE POLICY IF NOT EXISTS "Authenticated Users: Insert banners"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'banners');

-- Users can update their own banners
CREATE POLICY IF NOT EXISTS "Authenticated Users: Update banners"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'banners')
WITH CHECK (bucket_id = 'banners');

-- Users can delete their own banners
CREATE POLICY IF NOT EXISTS "Authenticated Users: Delete banners"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'banners');

-- Comment the changes
COMMENT ON COLUMN profiles.banner_url IS 'URL to the user profile banner/cover image';

