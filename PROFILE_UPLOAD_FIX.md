# Profile Picture & Banner Upload Fix

## Issue
Users were unable to upload profile pictures or banner images in the Profile Settings page, getting a "new row violates row-level security policy" error.

## Root Cause
The `banners` storage bucket was not created in Supabase with the proper Row-Level Security (RLS) policies. The profile page tries to upload:
- Profile pictures to the `avatars` bucket (which exists)
- Banner images to the `banners` bucket (which was missing proper setup)

## Solution
Created migration `017_fix_banners_bucket_rls.sql` that:
1. Creates the `banners` storage bucket if it doesn't exist
2. Sets it as public with 5MB file size limit
3. Allows these MIME types: JPEG, JPG, PNG, WEBP, GIF
4. Creates proper RLS policies:
   - **INSERT**: Authenticated users can upload banners
   - **SELECT**: Public access for reading banners
   - **UPDATE**: Authenticated users can update their banners
   - **DELETE**: Authenticated users can delete their banners

## How to Apply

### Option 1: Run the Migration in Supabase SQL Editor
1. Go to your Supabase project dashboard
2. Navigate to the SQL Editor
3. Copy the contents of `backend/migrations/017_fix_banners_bucket_rls.sql`
4. Paste and execute the SQL

### Option 2: Use the Quick Fix Script
```bash
cd backend
python fix_banners_rls.py
```

## Testing
After applying the fix, test by:
1. Log in to your account
2. Go to Profile Settings (`/profile`)
3. Try uploading a profile picture (should upload to `avatars` bucket)
4. Try uploading a banner image (should upload to `banners` bucket)
5. Both uploads should work without RLS errors

## Technical Details

### Storage Buckets Used
- `avatars` - User profile pictures (already configured)
- `banners` - User profile banners (fixed in this migration)
- `avee-avatars` - Agent profile pictures (already configured)
- `app-images` - App UI images like favicons (already configured)

### Frontend Code
The profile page (`frontend/src/app/(app)/profile/page.tsx`) uses:
- Line 589: `uploadImageToBucket({ bucket: "avatars", ... })` for profile pictures
- Line 618: `uploadImageToBucket({ bucket: "banners", ... })` for banners

### Upload Function
Located at `frontend/src/lib/upload.ts`:
- Validates image file type
- Enforces 5MB size limit for avatars/banners
- Generates unique filenames with timestamp
- Returns public URL for uploaded images

## Related Files
- `backend/migrations/017_fix_banners_bucket_rls.sql` - New migration
- `backend/migrations/006_fix_storage_rls.sql` - Previous avatars fix
- `backend/migrations/010_fix_app_images_rls.sql` - Previous app-images fix
- `frontend/src/app/(app)/profile/page.tsx` - Profile settings page
- `frontend/src/lib/upload.ts` - Upload utility functions



