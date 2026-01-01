# Backoffice Profile Management Features

## Overview

Enhanced the backoffice with two key features for managing user profiles:

1. **View Profile Dashboard** - Quick access to any profile's dashboard directly from the backoffice
2. **Create New Profile** - Admin capability to create profiles without email verification

---

## ⚠️ IMPORTANT SETUP REQUIRED

Before using the Create Profile feature, you **MUST** add your Supabase Service Role Key to the backend environment:

1. Get your Service Role Key from Supabase Dashboard → Settings → API
2. Add to `backend/.env`:
   ```env
   SUPABASE_SERVICE_ROLE_KEY=eyJ...your-key-here
   ```
3. Restart your backend server

**See `BACKOFFICE_SETUP_GUIDE.md` for detailed setup instructions.**

---

## 🐛 Bug Fixes (Dec 28, 2025)

### Fixed: 404 Error on Profile View
- **Issue**: Link was using `/{handle}` instead of correct route
- **Fix**: Changed to `/u/{handle}`
- **Status**: ✅ Fixed

### Fixed: HTTP 500 on Profile Creation
- **Issue**: Missing SUPABASE_SERVICE_ROLE_KEY configuration
- **Fix**: Added better error messages and setup documentation
- **Status**: ✅ Code fixed, configuration required

---

## ✨ Features Implemented

### 1. Profile Dashboard Viewer

**Location**: Backoffice → Profiles Tab

Each profile row now includes a "View" button with an eye icon that:
- Opens the profile's dashboard in a new tab
- Uses the format: `/{handle}` (e.g., `/johndoe`)
- Allows admins to quickly inspect any profile

**UI Changes**:
- Blue button with eye icon
- Positioned next to the Delete button
- Opens in new tab for easy navigation back to backoffice

### 2. Create Profile CTA

**Location**: Backoffice → Profiles Tab (top right of search bar)

A "Create Profile" button that:
- Opens a modal form for profile creation
- Creates both Supabase auth user and profile record
- **Bypasses email verification** (admin-created accounts are auto-confirmed)
- Generates a random secure password (users can reset later)

**Form Fields**:
- **Handle** (required) - Unique username, auto-lowercase
- **Display Name** (optional) - User's display name
- **Email** (required) - User's email address

---

## 🔧 Technical Implementation

### Frontend Changes

**File**: `frontend/src/app/(app)/backoffice/page.tsx`

1. Added state management:
   ```typescript
   const [showCreateProfileModal, setShowCreateProfileModal] = useState(false);
   const [createProfileData, setCreateProfileData] = useState({
     handle: "",
     display_name: "",
     email: "",
   });
   const [creatingProfile, setCreatingProfile] = useState(false);
   ```

2. Added `handleCreateProfile()` function that:
   - Validates required fields
   - Calls POST `/admin/profiles/create`
   - Shows success/error feedback
   - Reloads the profiles list

3. Added UI elements:
   - "Create Profile" button in search bar area
   - Modal dialog with form fields
   - "View" button with eye icon for each profile

### Backend Changes

**File**: `backend/admin.py`

1. Added Pydantic model:
   ```python
   class CreateProfileRequest(BaseModel):
       handle: str
       display_name: str = ""
       email: str
   ```

2. Added endpoint: `POST /admin/profiles/create`
   - **Authentication**: Requires admin privileges
   - **Supabase Integration**: Uses Service Role Key to create users
   - **Email Verification**: Automatically confirmed (`email_confirm: True`)
   - **Password**: Generates random 16-character password
   - **Error Handling**: Comprehensive validation and error messages

**Key Features**:
- Validates handle uniqueness before creating
- Creates Supabase auth user with Admin API
- Sets user metadata (handle, display_name)
- Creates corresponding profile in database
- Returns user credentials info

---

## 🔐 Security

- **Admin-Only Access**: Endpoint protected by `require_admin` dependency
- **Email Whitelist**: Only authorized admin emails can access
- **Service Role Key**: Uses Supabase service role for admin operations
- **Password Security**: Auto-generated 16-char random password

---

## 📝 Usage Guide

### Creating a New Profile

1. Navigate to Backoffice → Profiles tab
2. Click "Create Profile" button (top right)
3. Fill in the form:
   - **Handle**: Choose a unique username (e.g., "johndoe")
   - **Display Name**: Optional friendly name (e.g., "John Doe")
   - **Email**: User's email address
4. Click "Create Profile"
5. Profile is created instantly with:
   - Confirmed email (no verification needed)
   - Random password (user can reset via "Forgot Password")
   - Ready to use immediately

### Viewing a Profile Dashboard

1. Navigate to Backoffice → Profiles tab
2. Find the profile you want to view
3. Click the "View" button (eye icon)
4. Profile dashboard opens in new tab

---

## 🎨 UI Design

### Color Scheme
- **View Button**: Blue (`bg-blue-50`, `border-blue-200`, `text-blue-700`)
- **Delete Button**: Red (existing style)
- **Create Button**: Blue (`bg-blue-600`)

### Modal Design
- Modern card design with rounded corners
- Proper spacing and typography
- Responsive layout
- Loading states for async operations
- Clear validation messages

---

## 🚀 API Endpoints

### Create Profile
```http
POST /admin/profiles/create
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "handle": "johndoe",
  "display_name": "John Doe",
  "email": "john@example.com"
}
```

**Response**:
```json
{
  "ok": true,
  "user_id": "uuid-here",
  "handle": "johndoe",
  "display_name": "John Doe",
  "email": "john@example.com",
  "message": "Profile created successfully. User can log in with their email."
}
```

---

## 📋 Requirements

### Environment Variables
Ensure these are set in `backend/.env`:
```env
SUPABASE_URL=your-supabase-url
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### Dependencies
- `httpx` (already in requirements.txt) - for Supabase API calls
- Existing Supabase auth setup
- Admin email whitelist in `backend/admin.py`

---

## 🔍 Testing

To test the implementation:

1. **View Profile Feature**:
   - Go to backoffice profiles tab
   - Click "View" on any profile
   - Verify it opens the correct profile page

2. **Create Profile Feature**:
   - Click "Create Profile" button
   - Fill in all required fields
   - Submit the form
   - Verify success message
   - Check that profile appears in the list
   - Try logging in with the email (user will need to reset password)

---

## 🐛 Error Handling

The implementation includes comprehensive error handling:

- **Handle Already Exists**: Returns 400 error
- **Missing Required Fields**: Client-side validation
- **Supabase API Failures**: Detailed error messages
- **Database Errors**: Transaction rollback with error details
- **Timeout Protection**: 10-second timeout on Supabase requests

---

## 🔮 Future Enhancements

Potential improvements:
- [ ] Send welcome email with password reset link
- [ ] Bulk profile creation via CSV upload
- [ ] Custom password option (instead of random)
- [ ] Profile editing from backoffice
- [ ] Audit log for admin actions

---

## 📚 Related Files

- `/Users/loicricci/gabee-poc/frontend/src/app/(app)/backoffice/page.tsx`
- `/Users/loicricci/gabee-poc/backend/admin.py`
- `/Users/loicricci/gabee-poc/backend/models.py`
- `/Users/loicricci/gabee-poc/backend/auth_supabase.py`

---

**Status**: ✅ Fully Implemented and Ready to Use
**Last Updated**: December 28, 2025

