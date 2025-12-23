# Backoffice Access Restriction Implementation

## Overview

The backoffice has been restricted to only allow access to the account `loic.ricci@gmail.com`. All other accounts will receive an "Access Denied" message when attempting to access the backoffice or modify app settings.

## Changes Made

### 1. Backend Authentication (`backend/auth_supabase.py`)

Added a new function `get_current_user()` that returns the full user object including email:

```python
async def get_current_user(
    creds: HTTPAuthorizationCredentials = Depends(security),
) -> dict:
    """Get the full user object including email"""
    # Returns full Supabase user object with id, email, etc.
```

### 2. Backend Admin Access Control (`backend/admin.py`)

Updated the `require_admin` dependency to check user email:

```python
# Admin access is restricted to specific email(s)
ALLOWED_ADMIN_EMAILS = ["loic.ricci@gmail.com"]

async def require_admin(user: dict = Depends(get_current_user)):
    """
    Check if user has admin access.
    Only users with whitelisted emails can access the backoffice.
    """
    user_email = user.get("email", "").lower()
    
    if user_email not in ALLOWED_ADMIN_EMAILS:
        raise HTTPException(
            status_code=403, 
            detail="Access denied. You do not have permission to access the backoffice."
        )
    
    return user["id"]
```

All admin route handlers were updated to be `async` functions to support the async `require_admin` dependency:
- `get_system_stats`
- `list_all_profiles`
- `get_profile_details`
- `delete_profile`
- `list_all_agents`
- `get_agent_details`
- `admin_delete_agent`
- `list_all_documents`
- `get_document_details`
- `delete_document`
- `list_all_conversations`
- `delete_conversation`
- `bulk_delete_old_conversations`

### 3. App Configuration Endpoint (`backend/main.py`)

Updated the config update endpoint to also require admin access:

```python
@app.put("/config/{config_key}")
async def update_app_config(
    config_key: str,
    payload: AppConfigUpdateIn,
    db: Session = Depends(get_db),
    user_id: str = Depends(require_admin),  # Changed from get_current_user_id
):
    """Update app configuration (admin only)"""
```

This ensures that only the admin user can modify app settings like logo, favicon, and app name.

### 4. Frontend - Backoffice Page (`frontend/src/app/(app)/backoffice/page.tsx`)

Added access denied state and error handling:

- Added `accessDenied` state variable
- Updated `loadStats()` and `loadTabData()` to catch 403 errors and set `accessDenied` to true
- Added an "Access Denied" UI that displays when a user without permission tries to access the backoffice:
  - Shows a warning icon
  - Displays a clear error message
  - Provides a "Return to Home" button

### 5. Frontend - App Settings Page (`frontend/src/app/(app)/backoffice/app-settings/page.tsx`)

Added similar access denied handling:

- Added `accessDenied` state variable
- Updated `handleImageUpload()` and `handleTextUpdate()` to detect 403 errors
- Added the same "Access Denied" UI for users without permission

### 6. Frontend - Navigation Menu (`frontend/src/components/NewLayoutWrapper.tsx`)

Hidden the backoffice link from the navigation menu for non-admin users:

- Added conditional rendering: `{userEmail === "loic.ricci@gmail.com" && (<Link to backoffice>)}`
- The backoffice link now only appears in the profile dropdown menu for `loic.ricci@gmail.com`
- Other users won't see the backoffice link at all, preventing confusion and unauthorized access attempts

## How It Works

1. **Authentication Flow:**
   - User logs in through Supabase Auth
   - User receives a JWT token containing their user ID and email
   
2. **UI Visibility:**
   - Navigation menu checks user's email from Supabase auth session
   - Backoffice link only renders if `userEmail === "loic.ricci@gmail.com"`
   - Non-admin users don't see the backoffice link in the navigation
   
3. **Admin Check (Backend):**
   - When accessing any admin endpoint (e.g., `/admin/stats`, `/admin/profiles`)
   - Backend calls `require_admin` dependency
   - `require_admin` fetches full user data from Supabase
   - Checks if user's email is in `ALLOWED_ADMIN_EMAILS` list
   - If not authorized, returns HTTP 403 Forbidden
   
4. **Frontend Error Handling:**
   - If a user somehow accesses a backoffice page (e.g., direct URL)
   - Frontend receives 403 error from backend
   - Sets `accessDenied` state to true
   - Displays user-friendly "Access Denied" message
   - Prevents further API calls

## Adding More Admin Users

To add more admin users, simply update the `ALLOWED_ADMIN_EMAILS` list in `backend/admin.py`:

```python
ALLOWED_ADMIN_EMAILS = [
    "loic.ricci@gmail.com",
    "another.admin@example.com",
]
```

## Security Considerations

### ✅ Implemented
- Email-based whitelist for admin access
- All admin endpoints protected with `require_admin` dependency
- App configuration updates restricted to admins
- User-friendly error messages without exposing system details
- Async/await pattern for proper authentication flow

### 🔒 Production Recommendations
1. **Move Admin Emails to Environment Variables:**
   ```python
   ALLOWED_ADMIN_EMAILS = os.getenv("ADMIN_EMAILS", "").split(",")
   ```

2. **Add Audit Logging:**
   - Log all admin actions (who, what, when)
   - Track failed access attempts
   - Store in separate audit log table

3. **Rate Limiting:**
   - Implement rate limiting on admin endpoints
   - Prevent brute force attempts

4. **Database-Driven Roles (Future Enhancement):**
   - Add `role` column to Profile table
   - Store admin status in database
   - Allow dynamic role management

## Testing

### Test as Admin (loic.ricci@gmail.com)
1. Log in with `loic.ricci@gmail.com`
2. **Backoffice link should be visible** in the profile dropdown menu
3. Navigate to Backoffice from profile menu
4. Should see dashboard with full access
5. Can view/edit all sections
6. Can modify app settings

### Test as Non-Admin
1. Log in with any other email (e.g., `loic@cryptoclub.live`)
2. **Backoffice link should NOT be visible** in the profile dropdown menu
3. If you manually type `/backoffice` in the URL, you'll see "Access Denied" message
4. Cannot access any admin functions
5. Cannot modify app settings

## Files Modified

### Backend
- `backend/auth_supabase.py` - Added `get_current_user()` function
- `backend/admin.py` - Updated `require_admin` with email whitelist, made all routes async
- `backend/main.py` - Updated config endpoint to require admin access

### Frontend
- `frontend/src/app/(app)/backoffice/page.tsx` - Added access denied handling
- `frontend/src/app/(app)/backoffice/app-settings/page.tsx` - Added access denied handling
- `frontend/src/components/NewLayoutWrapper.tsx` - Hidden backoffice link for non-admin users

## Summary

The backoffice is now fully restricted to `loic.ricci@gmail.com`:

✅ **Navigation Link Hidden:** Non-admin users won't see the backoffice link in the menu  
✅ **Backend Protection:** All admin endpoints check email authorization  
✅ **Frontend Error Handling:** Access denied messages for unauthorized attempts  
✅ **User-Friendly:** Clear feedback without exposing system details  
✅ **Easily Extensible:** Simple to add more admin emails in the future  

The implementation provides defense-in-depth security with multiple layers of protection.

