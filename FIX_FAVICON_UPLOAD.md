# Fix Favicon Upload RLS Error

## Problem
When trying to upload a favicon (or other app images like logo/cover) in the admin panel, you get this error:

```
new row violates row-level security policy
```

## Solution

The `app-images` bucket needs proper RLS policies to allow authenticated users to upload files.

### Step 1: Run the SQL Migration

1. Go to your **Supabase Dashboard**: https://app.supabase.com
2. Select your project
3. Navigate to **SQL Editor** (in the left sidebar)
4. Click **New Query**
5. Copy the entire contents of this file:
   ```
   backend/migrations/010_fix_app_images_rls.sql
   ```
6. Paste into the SQL editor
7. Click **▶ Run** (or press Ctrl+Enter / Cmd+Enter)

### Step 2: Verify the Fix

After running the migration, you should see output showing:

```
1 row(s) affected  (for the bucket creation)
```

And the verification queries should show:
- The `app-images` bucket exists with `public = true`
- Four RLS policies for app-images (upload, read, update, delete)

### Step 3: Test the Upload

1. **Hard refresh** your browser:
   - **Windows/Linux**: Ctrl + Shift + R
   - **Mac**: Cmd + Shift + R
2. Go back to the admin panel
3. Try uploading the favicon again
4. It should now work! ✅

## What This Migration Does

1. **Creates/Updates the `app-images` bucket**:
   - Sets it as public (so everyone can read the images)
   - Allows image formats: JPEG, PNG, WebP, SVG, GIF, ICO
   - 10MB file size limit

2. **Sets up RLS policies**:
   - ✅ Authenticated users can **upload** to app-images
   - ✅ Everyone (including anonymous) can **read** from app-images
   - ✅ Authenticated users can **update** files in app-images
   - ✅ Authenticated users can **delete** files in app-images

3. **Grants necessary permissions**:
   - Gives authenticated and anonymous users access to storage schema
   - Allows authenticated users to insert/update/delete

## Troubleshooting

### Still Getting the Error?

1. **Check if you're authenticated**:
   - Make sure you're logged in to the admin panel
   - Check the browser console for authentication errors

2. **Check the bucket name**:
   - The frontend should be uploading to the `app-images` bucket
   - Verify in the network tab that the request is going to the right bucket

3. **Verify RLS is enabled**:
   ```sql
   SELECT tablename, rowsecurity 
   FROM pg_tables 
   WHERE schemaname = 'storage' AND tablename = 'objects';
   ```
   - `rowsecurity` should be `true`

4. **Check existing policies**:
   ```sql
   SELECT policyname, cmd, roles 
   FROM pg_policies 
   WHERE schemaname = 'storage' 
     AND tablename = 'objects'
     AND policyname LIKE '%app images%';
   ```
   - Should show 4 policies (INSERT, SELECT, UPDATE, DELETE)

### Alternative: Disable RLS Temporarily (Not Recommended for Production)

If you're still having issues and just want to test quickly:

```sql
ALTER TABLE storage.objects DISABLE ROW LEVEL SECURITY;
```

**⚠️ Warning**: This disables security for ALL storage buckets. Only use this for local development/testing. Re-enable it after testing:

```sql
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
```

## Need Help?

If you're still experiencing issues:

1. Check the browser console for errors
2. Check the Supabase logs (Dashboard → Logs)
3. Verify your authentication token is valid
4. Make sure the file you're uploading is an image format

## Files Modified

- `backend/migrations/010_fix_app_images_rls.sql` - SQL migration to fix RLS
- `backend/fix_app_images_rls.py` - Python script to run migration (optional)
- `FIX_FAVICON_UPLOAD.md` - This guide

## Related

- See `backend/migrations/009_app_images_bucket.sql` for the original bucket setup
- See `FIX_STORAGE_RLS_POLICY.md` for avatar bucket fixes
- See `BACKOFFICE_GUIDE.md` for admin panel documentation


