# Quick Fix: Profile Picture Upload Error

## ⚠️ Problem
You're getting "new row violates row-level security policy" when trying to upload a profile picture or banner in the Profile Settings page.

## ✅ Solution

The `banners` storage bucket needs to be created with proper RLS policies.

### Option 1: Manual Fix (Recommended)

1. **Go to Supabase Dashboard**
   - Open your Supabase project
   - Navigate to SQL Editor

2. **Run the Migration**
   - Copy the contents of `backend/migrations/017_fix_banners_bucket_rls.sql`
   - Paste into SQL Editor
   - Click "Run"

3. **Test**
   - Go to `/profile` page
   - Try uploading a profile picture ✅
   - Try uploading a banner image ✅

### Option 2: Automated Script

```bash
cd backend
python fix_banners_rls.py
```

## What This Fixes

Creates the `banners` storage bucket with:
- **Public access** for viewing banners
- **5MB file size limit**
- **Image types**: JPEG, PNG, WEBP, GIF
- **RLS Policies**:
  - Authenticated users can upload/update/delete banners
  - Everyone can view banners

## Already Fixed Buckets

✅ `avatars` - User profile pictures  
✅ `avee-avatars` - Agent avatars  
✅ `app-images` - App UI images  
🆕 `banners` - Profile banner images (this fix)

## Verification

After applying the fix, you should see:
1. No more RLS errors when uploading
2. Profile picture uploads work
3. Banner image uploads work
4. Both images display correctly in your profile

## Still Having Issues?

If you still see the error:
1. Clear your browser cache
2. Log out and log back in
3. Check Supabase dashboard for any authentication issues
4. Verify the migration ran successfully in SQL Editor

## Related Files

- Migration: `backend/migrations/017_fix_banners_bucket_rls.sql`
- Profile Page: `frontend/src/app/(app)/profile/page.tsx`
- Upload Logic: `frontend/src/lib/upload.ts`



