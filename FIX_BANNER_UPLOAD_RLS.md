# Fix: Banner Image Upload RLS Policy Issue

## Problem
When trying to upload a banner image on the profile page, you get the error:
```
new row violates row-level security policy
```

## Root Cause
The `banners` storage bucket either:
1. Doesn't exist in your Supabase project, OR
2. Exists but has incorrect/conflicting Row-Level Security (RLS) policies

## Solution

### Step 1: Run the Migration SQL

Open your **Supabase Dashboard** → **SQL Editor** and run the migration:

1. Go to: https://supabase.com/dashboard/project/YOUR_PROJECT_ID/sql
2. Copy and paste the contents of: `backend/migrations/018_fix_banners_bucket_rls.sql`
3. Click **Run**

This will:
- Create the `banners` bucket if it doesn't exist
- Set it to public (for reading)
- Drop any conflicting RLS policies
- Create fresh, correct RLS policies

### Step 2: Verify the Fix

After running the migration, verify it worked:

```sql
-- Check the bucket exists and is public
SELECT id, name, public, file_size_limit 
FROM storage.buckets 
WHERE id = 'banners';

-- Should return:
-- id      | name    | public | file_size_limit
-- banners | banners | true   | 5242880

-- Check the RLS policies exist
SELECT policyname, cmd, roles
FROM pg_policies
WHERE tablename = 'objects' 
  AND schemaname = 'storage'
  AND policyname LIKE '%banner%';

-- Should return 4 policies:
-- Public Access: Select banners          | SELECT | {public}
-- Authenticated Users: Insert banners    | INSERT | {authenticated}
-- Authenticated Users: Update banners    | UPDATE | {authenticated}
-- Authenticated Users: Delete banners    | DELETE | {authenticated}
```

### Step 3: Test the Upload

1. Go to http://localhost:3000/profile
2. Try uploading a banner image
3. The error should be gone!

## What Changed

### Frontend Code
- Updated `frontend/src/lib/upload.ts` to include `"banners"` in the TypeScript bucket type definition

### Database Migration
- Created `backend/migrations/018_fix_banners_bucket_rls.sql` which:
  - Creates/updates the banners bucket
  - Drops conflicting policies (especially the generic "Public Access" policy)
  - Creates properly named policies following the same pattern as other buckets

## Technical Details

The issue was in `backend/migrations/016_add_profile_banner.sql`:

**Problem:**
```sql
-- This policy name was too generic and could conflict
CREATE POLICY IF NOT EXISTS "Public Access"
ON storage.objects FOR SELECT
USING (bucket_id = 'banners');
```

**Solution:**
```sql
-- More specific policy name that won't conflict
CREATE POLICY "Public Access: Select banners"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'banners');
```

The policy names now follow the pattern:
- `"Public Access: Select banners"` - for reading
- `"Authenticated Users: Insert banners"` - for uploading
- `"Authenticated Users: Update banners"` - for updating
- `"Authenticated Users: Delete banners"` - for deleting

This matches the naming pattern used in `006_fix_storage_rls.sql` for other buckets.

## Related Files
- `frontend/src/lib/upload.ts` - TypeScript upload utility
- `frontend/src/app/(app)/profile/page.tsx` - Profile page that uses banner upload
- `backend/models.py` - Profile model with `banner_url` field
- `backend/migrations/016_add_profile_banner.sql` - Original (problematic) migration
- `backend/migrations/018_fix_banners_bucket_rls.sql` - Fix migration (NEW)

## Prevention

When adding new storage buckets in the future:
1. Use specific, descriptive policy names (e.g., "Public Access: Select [bucket-name]")
2. Avoid generic names like "Public Access" that might conflict with other buckets
3. Follow the established naming pattern in `006_fix_storage_rls.sql`
4. Always test uploads after running migrations



