# Profile Banner & Import Feature Implementation

## Overview

This document describes the implementation of profile banner images and the "Import from Agent" feature for the profile page. These enhancements improve the visual appeal of user profiles and streamline the profile creation process.

## Features Added

### 1. Profile Banner/Cover Image
- **Visual Enhancement**: Users can now upload a banner image (1500x500px recommended) that displays at the top of their profile
- **Drag & Drop**: Intuitive drag-and-drop interface for uploading banner images
- **Public Display**: Banner images are prominently displayed on both the profile edit page and public profile pages

### 2. Import from Agent
- **Quick Setup**: Non-admin users with agents can quickly import their agent's display name, bio, avatar, and persona to their profile
- **One-Click Import**: Simple button click copies all relevant data from the agent
- **Smart Detection**: Feature only appears for users who have agents configured

## Technical Implementation

### Backend Changes

#### 1. Database Schema (`backend/models.py`)
```python
class Profile(Base):
    __tablename__ = "profiles"
    # ... existing fields ...
    banner_url = Column(Text)  # NEW: Profile banner/cover image
```

#### 2. Database Migration (`backend/migrations/016_add_profile_banner.sql`)
- Adds `banner_url` column to `profiles` table
- Creates `banners` storage bucket with 5MB file size limit
- Sets up RLS (Row Level Security) policies:
  - Public read access for all banners
  - Authenticated users can upload/update/delete their own banners
- Supports PNG, JPEG, WEBP, and JPG formats

#### 3. API Updates (`backend/main.py`)

**ProfileUpsertIn Model:**
```python
class ProfileUpsertIn(BaseModel):
    # ... existing fields ...
    banner_url: str | None = None  # NEW
```

**GET /me/profile Endpoint:**
- Now returns `banner_url` field in response

**POST /me/profile Endpoint:**
- Accepts and saves `banner_url` field

**GET /profiles/{handle} Endpoint:**
- Returns `banner_url` in profile data for public viewing

### Frontend Changes

#### 1. Profile Edit Page (`frontend/src/app/(app)/profile/page.tsx`)

**New State Variables:**
```typescript
const [uploadingBanner, setUploadingBanner] = useState(false);
const [draggingBanner, setDraggingBanner] = useState(false);
```

**New Functions:**

**`handleBannerFile(file: File)`**
- Uploads banner image to the `banners` bucket
- Updates form state with the new banner URL
- Provides user feedback during upload

**`importFromAgent()`**
- Confirms user intent with a dialog
- Copies display name, bio, avatar, and persona from the user's agent
- Only available for non-admin users with agents

**UI Components:**

1. **Banner Upload Section:**
   - Large 192px tall banner preview area
   - Drag-and-drop overlay with visual feedback
   - Shows current banner or default gradient
   - Upload progress indicator

2. **Import from Agent Card:**
   - Appears between Bio and Persona sections
   - Only visible for non-admin users with agents
   - Clear call-to-action button
   - Descriptive text explaining the feature

#### 2. Public Profile Page (`frontend/src/app/(app)/u/[handle]/page.tsx`)

**Banner Display:**
- Increased banner area from 128px to 192px (h-48)
- Displays user's banner_url if available
- Falls back to default gradient if no banner
- Avatar positioned with `-mt-20` (moved from `-mt-16`) for better visual balance

**Type Updates:**
```typescript
type ProfileData = {
  profile?: {
    // ... existing fields ...
    banner_url: string | null;  // NEW
  };
};
```

### File Structure

```
backend/
  ├── models.py                        # ✅ Added banner_url field
  ├── main.py                         # ✅ Updated API endpoints
  └── migrations/
      └── 016_add_profile_banner.sql  # ✅ New migration

frontend/src/app/(app)/
  ├── profile/page.tsx                # ✅ Banner upload & import feature
  └── u/[handle]/page.tsx            # ✅ Banner display
```

## Usage Guide

### For Users

#### Uploading a Banner
1. Navigate to your Profile page (`/profile`)
2. At the top of the form, you'll see a large banner area
3. Either:
   - Drag and drop an image onto the banner area, OR
   - Click the banner area to select an image from your computer
4. Wait for the upload to complete
5. Click "Save changes" to persist the banner

**Recommended Banner Specs:**
- Dimensions: 1500x500px (3:1 aspect ratio)
- File formats: PNG, JPG, WEBP
- File size: Up to 5MB

#### Importing from Agent
1. Navigate to your Profile page (`/profile`)
2. Scroll to the "Quick Import from Agent" card (appears below Bio section)
3. Click "Import Now"
4. Confirm the action in the dialog
5. Click "Save changes" to persist the imported data

### For Developers

#### Adding Banner Support to Other Components

If you need to display banner images in other parts of the application:

```typescript
// Fetch profile data (banner_url is included)
const profile = await apiGet(`/profiles/${handle}`, token);

// Display banner
<div className="h-48 bg-gradient-to-r from-[#2E3A59] to-[#1a2236]">
  {profile.banner_url && (
    <img 
      src={profile.banner_url} 
      alt="Banner" 
      className="h-full w-full object-cover"
    />
  )}
</div>
```

#### Running the Migration

Apply the migration to add banner support:

```bash
# Connect to your Supabase project
supabase migration up

# Or apply manually via SQL editor in Supabase Dashboard
# Copy contents of backend/migrations/016_add_profile_banner.sql
```

## Design Decisions

### 1. Banner Storage
- **Separate Bucket**: Banners stored in dedicated `banners` bucket (separate from `avatars`)
- **Rationale**: Different size/aspect ratio requirements, easier to manage policies

### 2. Upload Flow
- **Client-Side Upload**: Direct upload to Supabase Storage from the client
- **Rationale**: Reduces server load, faster uploads, leverages CDN

### 3. Import from Agent
- **Confirmation Dialog**: Requires user confirmation before importing
- **Rationale**: Prevents accidental overwrites of existing profile data

### 4. Conditional Feature Display
- **Agent-Only**: Import feature only shows for users with agents
- **Rationale**: No value for admin users or users without agents

## Security Considerations

### Storage Bucket Policies
- **Public Read**: All banners are publicly accessible (similar to avatars)
- **Authenticated Write**: Only authenticated users can upload banners
- **User Ownership**: Users can only modify/delete their own banners

### File Validation
- **Size Limit**: 5MB maximum file size enforced at storage level
- **MIME Types**: Only image types allowed (PNG, JPEG, WEBP, JPG)
- **Client Validation**: File type checked before upload attempt

## Performance Considerations

### Caching
- Banner URLs stored in localStorage along with profile data
- Immediate UI updates on upload (optimistic rendering)
- CDN delivery via Supabase Storage

### Image Optimization
- Recommended dimensions prevent oversized files
- 5MB limit balances quality and load time
- Object-fit: cover ensures proper aspect ratio

## Testing Checklist

- [x] Banner upload works via drag-and-drop
- [x] Banner upload works via file picker
- [x] Banner displays correctly on profile edit page
- [x] Banner displays correctly on public profile page
- [x] Upload progress indicators work
- [x] Error handling for failed uploads
- [x] Import from Agent button only shows for eligible users
- [x] Import from Agent copies correct fields
- [x] Confirmation dialog appears before import
- [x] Changes can be saved successfully
- [x] Database migration applies without errors
- [x] Storage bucket and RLS policies work correctly

## Future Enhancements

### Potential Improvements
1. **Image Cropping**: In-browser crop tool before upload
2. **Image Optimization**: Automatic resizing/compression on upload
3. **Banner Positioning**: Allow users to adjust focal point
4. **Templates**: Pre-designed banner templates
5. **Agent Sync**: Automatic sync of profile changes to agent
6. **Bulk Import**: Import social media links and other extended fields from agent

### API Enhancements
1. **Image Processing**: Server-side image optimization
2. **CDN Optimization**: Custom CDN configuration for banners
3. **Analytics**: Track banner upload success/failure rates

## Related Files

- `backend/models.py` - Profile model with banner_url
- `backend/main.py` - API endpoints for profile management
- `backend/migrations/016_add_profile_banner.sql` - Database migration
- `frontend/src/app/(app)/profile/page.tsx` - Profile edit page
- `frontend/src/app/(app)/u/[handle]/page.tsx` - Public profile page
- `frontend/src/lib/upload.ts` - Image upload utilities

## Summary

The Profile Banner and Import from Agent features significantly enhance the user experience:

✅ **Visual Appeal**: Profile pages are now more visually engaging with custom banners
✅ **User Convenience**: Quick import saves time during profile setup
✅ **Consistency**: Agent-profile synchronization improves data consistency
✅ **Flexible**: Users can customize or import as they prefer
✅ **Scalable**: Infrastructure supports future enhancements

These features integrate seamlessly with the existing profile system while maintaining security and performance standards.








