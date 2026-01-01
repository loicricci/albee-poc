# Fix: Agent Avatar Loading RLS Policy Error

## Problem

When trying to load agent avatar images, you encounter the error:
```
Loading image on agent new row violates row-level security policy
```

This happens because the Row-Level Security (RLS) policies on the Supabase storage buckets are either:
1. Not properly configured to allow public read access
2. Conflicting with each other
3. Missing the necessary permissions for anonymous/public users

## Root Cause

The `agent-avatars` bucket (and potentially the `avatars` bucket) needs to:
1. Be marked as **public** in the storage.buckets table
2. Have RLS policies that allow **public** (anonymous) users to SELECT/read images
3. Have RLS policies that allow **authenticated** users to upload/update/delete

The error occurs when the frontend tries to display agent avatars using `getPublicUrl()` from Supabase, but the RLS policies block read access.

## Solution

Run the migration file: `backend/migrations/006_fix_storage_rls.sql`

### What the Migration Does

1. **Ensures buckets exist and are public**
   - Sets `public = true` for `avatars` and `agent-avatars` buckets
   - Configures file size limits (5MB)
   - Allows image MIME types

2. **Drops all existing storage.objects policies**
   - Removes any conflicting or incorrectly configured policies
   - Starts fresh to avoid issues

3. **Creates fresh RLS policies**
   - **Public Read**: Allows anyone (including anonymous users) to SELECT/read images
   - **Authenticated Write**: Only authenticated users can INSERT/UPDATE/DELETE

4. **Grants proper permissions**
   - Grants SELECT to both `authenticated` and `anon` roles
   - Grants INSERT/UPDATE/DELETE to `authenticated` role only

## How to Apply

### Option 1: Via Supabase Dashboard (Recommended)

1. Go to your Supabase Dashboard
2. Navigate to **SQL Editor**
3. Click **New Query**
4. Copy the entire contents of `backend/migrations/006_fix_storage_rls.sql`
5. Paste into the SQL editor
6. Click **Run**

### Option 2: Via psql (if you have direct database access)

```bash
psql "your_database_connection_string" < backend/migrations/006_fix_storage_rls.sql
```

### Option 3: Via Python migration script

```bash
cd backend
python run_migration.py migrations/006_fix_storage_rls.sql
```

## Verification

After running the migration, you can verify it worked by:

### 1. Check Buckets Configuration

Run this query in Supabase SQL Editor:

```sql
SELECT 
  id, 
  name, 
  public, 
  file_size_limit, 
  allowed_mime_types 
FROM storage.buckets 
WHERE id IN ('avatars', 'agent-avatars')
ORDER BY id;
```

Expected output:
```
id             | name           | public | file_size_limit | allowed_mime_types
---------------|----------------|--------|-----------------|--------------------
agent-avatars  | agent-avatars  | true   | 5242880        | {image/jpeg,...}
avatars        | avatars        | true   | 5242880        | {image/jpeg,...}
```

### 2. Check RLS Policies

Run this query:

```sql
SELECT 
  policyname, 
  roles, 
  cmd
FROM pg_policies
WHERE tablename = 'objects' 
  AND schemaname = 'storage'
  AND policyname LIKE '%avatar%'
ORDER BY policyname;
```

Expected output should include:
- `Public Access: Select avatars` - roles: {public}, cmd: SELECT
- `Authenticated Users: Insert avatars` - roles: {authenticated}, cmd: INSERT
- `Authenticated Users: Update avatars` - roles: {authenticated}, cmd: UPDATE
- `Authenticated Users: Delete avatars` - roles: {authenticated}, cmd: DELETE
- Similar policies for `agent-avatars`

### 3. Test in Frontend

After applying the migration:

1. **Reload your frontend** (clear cache if needed)
2. Navigate to the Network page or any page showing agent avatars
3. Agent avatars should now load without errors
4. Check browser console - no RLS policy errors

### 4. Test Image Upload

1. Go to **Profile** page
2. Try uploading an avatar image
3. Should upload successfully without errors
4. Go to **My Agents** → Select an agent
5. Try uploading an agent avatar
6. Should upload successfully

## Technical Details

### Why `TO public` for SELECT?

In PostgreSQL/Supabase RLS:
- `public` role includes **all users** (authenticated and anonymous)
- This allows the `getPublicUrl()` method to work correctly
- Images can be loaded even by users who aren't logged in

### Why `TO authenticated` for INSERT/UPDATE/DELETE?

- Only logged-in users should be able to upload/modify images
- Prevents anonymous users from uploading malicious content
- Aligns with security best practices

### Bucket Structure

The application uses three buckets:

1. **avatars** - User profile pictures
   - Path: `{user_id}/{timestamp}.{ext}`
   - Public read, authenticated write

2. **agent-avatars** - Agent profile pictures
   - Path: `{agent_id}/{timestamp}.{ext}`
   - Public read, authenticated write

3. **voice-recordings** - Voice recordings for transcription
   - Path: `{user_id}/{timestamp}.{ext}`
   - Private (user can only access their own)

## Common Issues After Migration

### Issue: "Still getting RLS error"

**Solution:**
1. Hard refresh your browser (Ctrl+Shift+R or Cmd+Shift+R)
2. Clear browser cache
3. Check browser console for the exact error
4. Verify the migration ran successfully (check verification queries above)

### Issue: "Can't upload images"

**Solution:**
1. Verify you're logged in (check `supabase.auth.getSession()`)
2. Check that the JWT token is being sent in requests
3. Verify the `authenticated` role has INSERT permissions
4. Check file size < 5MB and MIME type is allowed

### Issue: "Old images broken after migration"

**Solution:**
1. Old images in `avee-avatars` bucket won't work (bucket was renamed to `agent-avatars`)
2. Either:
   - Re-upload agent avatars
   - Or manually copy files from `avee-avatars` to `agent-avatars` in Supabase Dashboard

## Migration History

- `002_setup_storage_buckets.sql` - Initial bucket setup
- `003_rename_avee_to_agent_bucket.sql` - Renamed bucket
- `006_fix_storage_rls.sql` - **This fix** (comprehensive RLS policy reset)

## Related Files

- **Frontend upload logic**: `frontend/src/lib/upload.ts`
- **Backend models**: `backend/models.py` (Profile and Avee models with avatar_url)
- **API endpoints**: `backend/main.py` (profile and agent CRUD)

## Support

If you continue to experience issues:

1. Check Supabase logs for RLS policy violations
2. Verify your Supabase project URL and anon key are correct
3. Test with Supabase Dashboard → Storage to see if you can view images there
4. Check that storage is enabled in your Supabase project

## Security Considerations

This migration makes avatar images **publicly readable**, which is appropriate because:
- Avatar images are meant to be displayed to all users
- No sensitive information should be in avatar images
- Write access is still restricted to authenticated users
- File uploads are validated for type and size

If you need more restrictive access:
- Modify the SELECT policies to check user relationships
- Use signed URLs instead of public URLs
- Implement additional backend validation







