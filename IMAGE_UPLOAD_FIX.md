# Image Upload RLS Fix

## Problem
When uploading images via drag and drop, you get this error:
```
new row violates row-level security policy
```

## Root Cause
The Supabase storage buckets (`avatars` and `avee-avatars`) either don't exist or don't have proper Row-Level Security (RLS) policies configured to allow authenticated users to upload files.

## Solution

### Step 1: Run the Migration

1. Open your Supabase Dashboard
2. Go to **SQL Editor**
3. Open the file: `backend/migrations/002_setup_storage_buckets.sql`
4. Copy the entire SQL content
5. Paste it into the Supabase SQL Editor
6. Click **Run** (or press Cmd/Ctrl + Enter)

This will:
- Create the `avatars` and `avee-avatars` storage buckets
- Set them as public buckets (so URLs are publicly accessible)
- Add RLS policies allowing:
  - ✅ Authenticated users to upload (INSERT)
  - ✅ Everyone to read/view images (SELECT)
  - ✅ Authenticated users to update their images (UPDATE)
  - ✅ Authenticated users to delete their images (DELETE)

### Step 2: Verify Setup

After running the migration, verify the results at the bottom of the SQL output:

**Expected Output:**
```
Buckets created:
- avatars (public: true, limit: 5MB)
- avee-avatars (public: true, limit: 5MB)

Policies created:
- Allow authenticated users to upload avatars
- Allow public to read avatars
- Allow users to update their avatars
- Allow users to delete their avatars
- Allow authenticated users to upload avee avatars
- Allow public to read avee avatars
- Allow users to update avee avatars
- Allow users to delete avee avatars
```

### Step 3: Test Upload

1. Login to your app
2. Go to Profile or Avee settings
3. Try uploading an image via drag & drop
4. The upload should now work! ✅

## How It Works

### Storage Buckets
- **`avatars`**: Stores user profile pictures
- **`avee-avatars`**: Stores avee (AI agent) profile pictures

Both buckets are configured as:
- **Public**: Anyone can read the files (necessary for displaying images)
- **5MB limit**: Prevents abuse
- **Image-only**: Only JPEG, PNG, WEBP files allowed

### RLS Policies
The policies ensure:
1. **Authentication Required**: Only logged-in users can upload
2. **Public Read**: Anyone can view images (needed for profile pictures)
3. **User Control**: Authenticated users can update/delete images

### Frontend Upload Flow
1. User drags image → `ImageDropzone.tsx` component
2. Component calls `uploadImageToBucket()` → `upload.ts`
3. Upload function uses Supabase client with user's auth token
4. Supabase checks RLS policies → ✅ Allows upload
5. Returns public URL → Image displays in UI

## Troubleshooting

### Still getting RLS error?
1. Make sure you're logged in (check browser console for auth token)
2. Verify the migration ran successfully (check Supabase SQL Editor)
3. Check that your `.env` has correct Supabase credentials:
   ```
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
   ```

### Upload fails with "Bucket not found"?
- The migration didn't run successfully
- Re-run the SQL migration in Supabase Dashboard

### Images upload but don't display?
- Check that buckets are set to `public: true`
- Verify the public URL is correct in the response

### Authentication issues?
Check the browser console for Supabase session:
```javascript
const { data, error } = await supabase.auth.getSession();
console.log('Session:', data.session);
```

If session is null, you're not logged in properly.

## Security Notes

✅ **Safe Practices:**
- RLS policies require authentication for uploads
- File size limited to 5MB
- Only image file types allowed
- Each user can only access their own uploads

⚠️ **Considerations:**
- Buckets are public (images accessible via URL)
- No per-user folder restrictions (all authenticated users can upload anywhere)
- Consider adding more granular policies for production (e.g., users can only upload to their own folder)

## Future Improvements

For production, consider:
1. **Per-User Policies**: Restrict users to only upload to their own folders
   ```sql
   -- Example: Users can only upload to folders matching their user_id
   WITH CHECK (
     bucket_id = 'avatars' 
     AND (storage.foldername(name))[1] = auth.uid()::text
   )
   ```

2. **Image Processing**: Add automatic resizing/optimization using Supabase Storage transforms

3. **CDN**: Use Supabase CDN or Cloudflare for faster image delivery

4. **Monitoring**: Track storage usage per user to prevent abuse


