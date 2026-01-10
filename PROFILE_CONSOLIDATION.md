# Profile & Account Consolidation

## Summary

Consolidated the `/account` and `/profile` pages to make `/profile` the primary account management page for all users. The `/account` route now redirects to `/profile`.

## Changes Made

### 1. Enhanced `/profile` Page
**File**: `frontend/src/app/(app)/profile/page.tsx`

Added missing features from `/account`:
- ✅ **Delete Account functionality** - Added "Danger Zone" section with account deletion
- ✅ **Delete confirmation modal** - Added comprehensive warning modal
- ✅ **Router integration** - Added `useRouter` for post-deletion redirect
- ✅ **Account deletion handler** - Clears cache, signs out, and redirects to home

The `/profile` page now includes ALL features:
- Banner image upload (unique to profile)
- Avatar upload
- AI Persona editor (for non-admin users)
- Import from Agent button (for non-admin users)
- Basic profile info (username, display name, bio)
- Personal information
- Contact information
- Professional information
- Social media links
- Interests & hobbies
- Location with coordinates
- **Delete Account (newly added from /account)**

### 2. Redirect `/account` to `/profile`
**File**: `frontend/src/app/(app)/account/page.tsx`

Simplified the account page to redirect to profile:
- Replaced entire page content with a redirect component
- Shows loading spinner during redirect
- Uses `router.replace('/profile')` for seamless navigation

### 3. Updated Navigation Links
Updated all references from `/account` to `/profile`:

**Files updated**:
- `frontend/src/components/NewLayoutWrapper.tsx` - 2 links updated
- `frontend/src/app/(app)/layout.tsx` - Updated page title logic and navigation
- `frontend/src/app/(app)/app/page.tsx` - Link updated
- `frontend/src/app/(app)/agent/page.tsx` - 2 links updated
- `frontend/src/app/(app)/feed/page.tsx` - 2 links updated

## Benefits

1. **Single Source of Truth**: One comprehensive profile management page
2. **Better User Experience**: No confusion between Account vs Profile
3. **Full Feature Set**: All account features (including deletion) now in profile
4. **Backward Compatibility**: `/account` still works, just redirects to `/profile`
5. **Consistency**: All navigation now points to `/profile`

## User Impact

- Users navigating to `/account` will be automatically redirected to `/profile`
- All account management features remain accessible
- No data loss or functionality removed
- Enhanced profile page with complete account management capabilities

## Testing Recommendations

1. Test `/account` URL redirects to `/profile`
2. Verify all navigation links work correctly
3. Test account deletion flow from profile page
4. Confirm banner upload works (profile-specific feature)
5. Test AI persona editing (for non-admin users)
6. Verify all form fields save correctly
7. Test import from agent functionality

## Notes

- The `/profile` page is now the canonical location for all account/profile settings
- The `/account` route is kept for backward compatibility but redirects
- Backend API endpoints remain unchanged (still use `/me/account` for deletion, etc.)








