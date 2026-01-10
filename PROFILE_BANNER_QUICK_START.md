# Profile Banner & Import - Quick Start Guide

## 🚀 Quick Setup (5 minutes)

### Step 1: Apply Database Migration

```bash
# Navigate to your project directory
cd /Users/loicricci/gabee-poc

# Apply the migration via Supabase
# Option A: Via Supabase CLI (if installed)
supabase db push

# Option B: Via Supabase Dashboard
# 1. Go to your Supabase Dashboard
# 2. Navigate to SQL Editor
# 3. Copy the contents of backend/migrations/016_add_profile_banner.sql
# 4. Run the SQL script
```

### Step 2: Verify Storage Bucket

Check that the `banners` bucket was created:

1. Go to Supabase Dashboard > Storage
2. Verify `banners` bucket exists
3. Check that RLS policies are enabled
4. Test by uploading a sample image

### Step 3: Test the Features

#### Test Banner Upload:
1. Navigate to `/profile` in your application
2. You'll see a large banner area at the top
3. Drag and drop an image or click to upload
4. Verify the banner displays correctly
5. Click "Save changes"
6. Visit your public profile at `/u/[your-handle]` to see the banner

#### Test Import from Agent:
1. Make sure you're logged in as a non-admin user with an agent
2. Navigate to `/profile`
3. Scroll to the "Quick Import from Agent" card (below Bio section)
4. Click "Import Now"
5. Confirm the dialog
6. Verify data is imported
7. Click "Save changes" to persist

## 📝 What Was Added

### Banner Feature
- ✅ Banner upload with drag-and-drop support
- ✅ Banner display on profile edit page
- ✅ Banner display on public profile pages
- ✅ Separate storage bucket for banners
- ✅ Recommended size: 1500x500px (3:1 ratio)
- ✅ File size limit: 5MB
- ✅ Supported formats: PNG, JPG, WEBP

### Import from Agent Feature
- ✅ One-click import button
- ✅ Imports: display name, bio, avatar, persona
- ✅ Only visible for non-admin users with agents
- ✅ Confirmation dialog before importing
- ✅ Clear user feedback

## 🎨 Banner Design Tips

### Recommended Specifications
- **Dimensions**: 1500x500px (3:1 aspect ratio)
- **File Format**: PNG for transparency, JPG for photos
- **File Size**: Under 2MB for optimal loading
- **Safe Zone**: Keep important content in center 1200x400px

### Design Guidelines
- Use high-contrast colors for text overlays
- Avoid placing critical information near edges
- Consider mobile viewing (banner scales down)
- Match your profile theme/brand colors

### Tools for Creating Banners
- **Canva**: Templates sized for social media banners
- **Figma**: Custom design with 1500x500px canvas
- **Adobe Photoshop**: Professional editing
- **Online Tools**: 
  - Crello (free templates)
  - BeFunky (quick edits)
  - Pixlr (browser-based editing)

## 🔧 Technical Details

### API Endpoints Modified

**GET /me/profile**
- Now returns `banner_url` field

**POST /me/profile**
- Accepts `banner_url` in request body

**GET /profiles/{handle}**
- Returns `banner_url` in public profile data

### Database Changes

```sql
-- New field added to profiles table
ALTER TABLE profiles ADD COLUMN banner_url TEXT;

-- New storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('banners', 'banners', true, 5242880, 
        ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/jpg']);
```

### Frontend Components Updated

1. **`/profile` (Profile Edit Page)**
   - Added banner upload section at top of form
   - Added "Import from Agent" feature card
   - New upload handlers for banner files
   - State management for banner upload progress

2. **`/u/[handle]` (Public Profile Page)**
   - Increased banner height from 128px to 192px
   - Added banner image display with fallback
   - Adjusted avatar positioning for better visual balance

## 🐛 Troubleshooting

### Banner Won't Upload
**Issue**: "Upload failed" error
**Solutions**:
- Check file size (must be < 5MB)
- Verify file format (PNG, JPG, WEBP only)
- Ensure you're authenticated
- Check browser console for specific errors

### Banner Doesn't Display
**Issue**: Uploaded banner doesn't show
**Solutions**:
- Click "Save changes" after upload
- Clear browser cache and reload
- Check that banner_url is saved in database
- Verify RLS policies on storage bucket

### Import Button Missing
**Issue**: "Import from Agent" button doesn't appear
**Solutions**:
- Feature only appears for non-admin users
- Must have an agent configured
- Log out and log back in to refresh session
- Check `is_admin` and `agent_id` fields in profile data

### Banner Displays Incorrectly
**Issue**: Banner is stretched or cropped badly
**Solutions**:
- Use recommended 3:1 aspect ratio (1500x500px)
- Check that image isn't too small
- Try re-uploading with correct dimensions
- Consider using object-fit utilities

## 📚 Usage Examples

### Example 1: Complete Profile Setup Flow

```typescript
// User journey:
1. User creates account
2. User navigates to /profile
3. User clicks "Import from Agent" (if available)
4. User uploads custom banner image
5. User adjusts bio/display name as needed
6. User clicks "Save changes"
7. Profile is now complete with banner and all data!
```

### Example 2: Updating Just the Banner

```typescript
// Quick banner update:
1. Navigate to /profile
2. Drag new banner image onto banner area
3. Wait for "Banner uploaded" message
4. Click "Save changes"
5. Visit /u/[handle] to see updated banner
```

### Example 3: Importing Agent Data

```typescript
// For users with agents:
1. Navigate to /profile
2. Scroll to "Quick Import from Agent" card
3. Click "Import Now"
4. Confirm in dialog
5. Review imported data
6. Click "Save changes" to keep changes
```

## ✅ Testing Checklist

Before deploying to production, verify:

- [ ] Migration applied successfully
- [ ] Banners storage bucket exists and is public
- [ ] RLS policies allow authenticated uploads
- [ ] Banner upload works via drag-and-drop
- [ ] Banner upload works via file picker
- [ ] Banner displays on profile edit page
- [ ] Banner displays on public profile page
- [ ] Import button appears for non-admin users with agents
- [ ] Import button hidden for admin users
- [ ] Import button hidden for users without agents
- [ ] Import copies all relevant fields
- [ ] Confirmation dialog works
- [ ] Save persists all changes
- [ ] Error messages display correctly
- [ ] Loading states work properly
- [ ] Banner scales properly on mobile
- [ ] Avatar positioning looks good with banner

## 🚀 Deployment

### Production Deployment Steps

1. **Backup Database**
   ```bash
   # Create backup before migration
   supabase db dump > backup_$(date +%Y%m%d).sql
   ```

2. **Apply Migration**
   ```bash
   # Apply the migration to production
   supabase db push --linked
   ```

3. **Verify Storage**
   - Check that `banners` bucket created in production
   - Verify RLS policies applied correctly
   - Test upload from production environment

4. **Deploy Frontend**
   ```bash
   # Build and deploy frontend changes
   npm run build
   # Deploy to your hosting platform
   ```

5. **Smoke Test**
   - Upload a banner on production
   - View public profile to verify banner displays
   - Test import feature if applicable
   - Check browser console for errors

## 📊 Monitoring

### Metrics to Track
- Banner upload success rate
- Banner upload error types
- Import feature usage rate
- Average banner file size
- Storage bucket usage

### Recommended Monitoring Queries

```sql
-- Check banner adoption rate
SELECT 
  COUNT(*) as total_profiles,
  COUNT(banner_url) as profiles_with_banner,
  ROUND(COUNT(banner_url)::numeric / COUNT(*) * 100, 2) as adoption_percentage
FROM profiles;

-- Storage usage in banners bucket
SELECT 
  COUNT(*) as total_banners,
  SUM(metadata->>'size')::bigint / 1024 / 1024 as total_mb
FROM storage.objects
WHERE bucket_id = 'banners';
```

## 🎉 Success!

You've successfully implemented profile banners and the import from agent feature! Users can now:
- ✅ Upload custom banner images
- ✅ Display professional-looking profiles
- ✅ Quickly import data from their agents
- ✅ Create visually appealing profile pages

For questions or issues, refer to the main documentation:
`PROFILE_BANNER_IMPORT_FEATURE.md`








