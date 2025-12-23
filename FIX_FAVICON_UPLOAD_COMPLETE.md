# Fix Favicon Upload Error - COMPLETE SOLUTION

## The Problem

You're getting this error when uploading favicon in the admin panel:
```
new row violates row-level security policy
```

## Root Cause

**Two issues were found:**

1. **Frontend was uploading to the wrong bucket**: The code was uploading to `avatars` bucket instead of `app-images` bucket
2. **Missing RLS policies**: The `app-images` bucket didn't have proper policies to allow uploads

## Complete Fix (Follow ALL Steps)

### Step 1: Fix the Frontend Code ✅ (Already Done)

I've updated these files:
- ✅ `frontend/src/lib/upload.ts` - Added `app-images` to allowed buckets
- ✅ `frontend/src/app/(app)/backoffice/app-settings/page.tsx` - Changed from `avatars` to `app-images`

### Step 2: Fix the Database (You Need to Do This)

**Open your Supabase SQL Editor and run this:**

1. Go to: https://app.supabase.com
2. Select your project
3. Click: **SQL Editor** (left sidebar)
4. Click: **New Query**
5. Copy ALL the SQL below:

```sql
-- Create/Update app-images bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'app-images', 
  'app-images', 
  true,
  10485760,
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

-- Drop ALL existing app-images policies
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
            OR policyname LIKE '%app_images%'
          )
    ) LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON storage.objects';
    END LOOP;
END $$;

-- Create VERY PERMISSIVE policies (allows all operations for authenticated users)
CREATE POLICY "app_images_all_authenticated"
ON storage.objects
FOR ALL
TO authenticated
USING (bucket_id = 'app-images')
WITH CHECK (bucket_id = 'app-images');

-- Allow everyone to read
CREATE POLICY "app_images_select_public"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'app-images');

-- Grant necessary permissions
GRANT USAGE ON SCHEMA storage TO authenticated, anon, public;
GRANT SELECT ON storage.objects TO authenticated, anon, public;
GRANT INSERT, UPDATE, DELETE ON storage.objects TO authenticated;
GRANT SELECT ON storage.buckets TO authenticated, anon, public;

-- Verify (you should see 2 policies)
SELECT 
  policyname, 
  cmd, 
  roles
FROM pg_policies
WHERE schemaname = 'storage' 
  AND tablename = 'objects'
  AND policyname LIKE '%app_images%'
ORDER BY policyname;
```

6. Click **▶ Run** (or press Ctrl+Enter / Cmd+Enter)

### Step 3: Restart Frontend

After running the SQL:

1. **Kill your frontend dev server** (Ctrl+C in terminal)
2. **Restart it**:
   ```bash
   cd frontend
   npm run dev
   ```

3. **Hard refresh your browser**:
   - **Windows/Linux**: Ctrl + Shift + R
   - **Mac**: Cmd + Shift + R

### Step 4: Test the Upload

1. Go to: **Admin Panel** → **App Settings**
2. Try uploading the favicon again
3. ✅ **It should work now!**

## What Changed

### Frontend Changes:
- `upload.ts` now accepts `"app-images"` as a valid bucket type
- `app-settings/page.tsx` now uploads to `"app-images"` instead of `"avatars"`

### Database Changes:
- Created `app-images` bucket with 10MB limit
- Added RLS policies that allow:
  - ✅ Authenticated users to upload/update/delete
  - ✅ Everyone to read (public access)
- Granted necessary database permissions

## Verification

After the fix, you should see:

### In Supabase Dashboard → Storage:
- A bucket named `app-images` exists
- It's marked as "Public"
- File size limit: 10MB

### In Supabase Dashboard → SQL Editor (run this):
```sql
SELECT * FROM storage.buckets WHERE id = 'app-images';
```
Should show: `public = true`

### In your app:
- Favicon upload works without errors
- Logo upload works without errors
- Cover image upload works without errors

## Troubleshooting

### Still getting the RLS error?

**Check if you're logged in:**
```javascript
// Open browser console and run:
supabase.auth.getSession().then(d => console.log(d))
```
Make sure you see a valid `access_token`.

**Check the bucket exists:**
```sql
SELECT id, public FROM storage.buckets WHERE id = 'app-images';
```

**Check the policies:**
```sql
SELECT policyname, cmd, roles 
FROM pg_policies 
WHERE schemaname = 'storage' 
  AND tablename = 'objects'
  AND policyname LIKE '%app_images%';
```
Should show 2 policies: `app_images_all_authenticated` and `app_images_select_public`

### Nuclear Option (if nothing else works)

If you're STILL having issues, temporarily disable RLS for testing:

```sql
ALTER TABLE storage.objects DISABLE ROW LEVEL SECURITY;
```

**⚠️ WARNING**: This removes ALL security for storage. Only use for local testing, then re-enable:

```sql
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
```

## Files Modified

1. ✅ `frontend/src/lib/upload.ts` - Added app-images bucket support
2. ✅ `frontend/src/app/(app)/backoffice/app-settings/page.tsx` - Changed upload bucket
3. 📄 `backend/migrations/011_fix_app_images_rls_aggressive.sql` - SQL migration
4. 📄 `FIX_FAVICON_UPLOAD_COMPLETE.md` - This guide

## Why This Happened

The original code comment said "temporary workaround" when uploading to the `avatars` bucket. The proper fix is to:
1. Use the dedicated `app-images` bucket for platform assets
2. Configure RLS policies specifically for app images
3. Keep avatars separate from app-level images

This is better architecture and more secure.

---

## Quick Checklist

- [ ] Run the SQL in Supabase SQL Editor
- [ ] Verify you see 2 policies for app_images
- [ ] Restart frontend dev server
- [ ] Hard refresh browser
- [ ] Test uploading favicon
- [ ] ✅ Success!

Need help? Check the SQL output for any errors and let me know what you see.


