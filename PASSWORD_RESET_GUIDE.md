# Password Reset Feature Documentation

## Overview

This implementation adds comprehensive password reset functionality for both end-users (from the login page) and administrators (from the backoffice). The feature uses Supabase Auth for secure password management.

---

## 🎯 Features Implemented

### For Users (Self-Service)
1. **Forgot Password Link** on the login page
2. **Reset Password Request Page** (`/reset-password`) - Users enter their email to receive a reset link
3. **Update Password Page** (`/update-password`) - Users set a new password after clicking the email link

### For Admins (Backoffice)
1. **Reset Password Button** in the Profiles tab of the backoffice
2. **Admin Password Reset Modal** - Admins can set a new password for any user without requiring the old password
3. **Backend API Endpoint** (`POST /admin/profiles/{user_id}/reset-password`) for admin password resets

---

## 📁 Files Created/Modified

### Frontend (Next.js)

#### New Files
- **`frontend/src/app/(auth)/reset-password/page.tsx`**
  - Password reset request page for users
  - Users enter their email to receive a reset link
  - Uses `supabase.auth.resetPasswordForEmail()`

- **`frontend/src/app/(auth)/update-password/page.tsx`**
  - Password update page (accessed via email link)
  - Users enter and confirm their new password
  - Uses `supabase.auth.updateUser()`

#### Modified Files
- **`frontend/src/app/(auth)/login/page.tsx`**
  - Added "Forgot password?" link in the password field section
  - Links to `/reset-password`

- **`frontend/src/app/(app)/backoffice/page.tsx`**
  - Added Reset Password button for each profile in the Profiles tab
  - Added Reset Password modal with password and confirmation fields
  - Added `handleResetPassword()` function to call the backend API

### Backend (FastAPI)

#### Modified Files
- **`backend/admin.py`**
  - Added `ResetPasswordRequest` Pydantic model
  - Added `POST /admin/profiles/{user_id}/reset-password` endpoint
  - Uses Supabase Admin API to update passwords without requiring the old password

---

## 🔄 User Flow

### For Regular Users (Self-Service)

1. **Initiate Reset**
   - User clicks "Forgot password?" on the login page
   - Redirected to `/reset-password`

2. **Request Reset Link**
   - User enters their email address
   - Clicks "Send reset link"
   - Supabase sends a password reset email with a magic link

3. **Receive Email**
   - User receives email with reset link
   - Link redirects to `/update-password` with authentication token

4. **Update Password**
   - User enters new password (minimum 6 characters)
   - Confirms password
   - Clicks "Update password"
   - Redirected to login page with success message

5. **Login**
   - User logs in with new password

### For Admins (Backoffice)

1. **Access Backoffice**
   - Admin navigates to `/backoffice`
   - Clicks on "Profiles" tab

2. **Select User**
   - Admin finds the user profile
   - Clicks "Reset Password" button

3. **Set New Password**
   - Modal opens showing the user's handle
   - Admin enters new password (minimum 6 characters)
   - Admin confirms password
   - Clicks "Reset Password"

4. **Success**
   - Password is immediately updated in Supabase
   - User can now log in with the new password
   - No email is sent (admin-initiated reset)

---

## 🔐 Security Features

1. **User Self-Service**
   - Uses Supabase's built-in password reset flow with email verification
   - Magic links expire after a set time (configured in Supabase)
   - User must have access to the email account

2. **Admin Reset**
   - Requires admin authentication (email whitelist)
   - Uses Supabase Service Role Key (server-side only, never exposed to frontend)
   - Password validation (minimum 6 characters)
   - Confirmation field to prevent typos

3. **Backend Security**
   - Admin endpoints protected by `require_admin()` dependency
   - Uses `SUPABASE_SERVICE_ROLE_KEY` for privileged operations
   - Input validation on all endpoints

---

## 🛠 Configuration

### Environment Variables Required

**Backend (`backend/.env`)**
```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here  # Required for admin password reset
```

**Frontend (`frontend/.env.local`)**
```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
```

### Supabase Configuration

1. **Email Templates**
   - Go to Supabase Dashboard → Authentication → Email Templates
   - Customize "Reset Password" email template
   - Ensure the redirect URL points to your frontend: `{{ .SiteURL }}/update-password`

2. **URL Configuration**
   - Go to Supabase Dashboard → Authentication → URL Configuration
   - Add your production/staging URLs to "Redirect URLs"
   - Example: `https://yourdomain.com/update-password`

---

## 🧪 Testing

### Test User Self-Service Reset

1. Go to `/login`
2. Click "Forgot password?"
3. Enter a valid user email
4. Check email inbox for reset link
5. Click the link (should redirect to `/update-password`)
6. Enter and confirm new password
7. Login with new password

### Test Admin Reset

1. Login as admin (email must be in `ALLOWED_ADMIN_EMAILS`)
2. Go to `/backoffice`
3. Click "Profiles" tab
4. Find a test user
5. Click "Reset Password"
6. Enter new password: `testpass123`
7. Confirm password
8. Click "Reset Password"
9. Logout and login as that user with the new password

---

## 📋 API Reference

### Admin Password Reset Endpoint

**Endpoint:** `POST /admin/profiles/{user_id}/reset-password`

**Authentication:** Required (Admin only)

**Request Body:**
```json
{
  "user_id": "uuid-of-user",
  "new_password": "newpassword123"
}
```

**Success Response (200):**
```json
{
  "ok": true,
  "message": "Password reset successfully for user johndoe",
  "user_id": "uuid-of-user",
  "handle": "johndoe"
}
```

**Error Responses:**
- `400` - Invalid user_id or password too short
- `403` - Not authorized (not an admin)
- `404` - Profile not found
- `500` - Supabase configuration error or API failure

---

## 🚨 Troubleshooting

### User Not Receiving Reset Email

1. Check Supabase email settings in dashboard
2. Verify SMTP configuration is correct
3. Check spam/junk folder
4. Ensure user email exists in Supabase Auth

### Admin Reset Fails

1. **Error: "Supabase configuration missing"**
   - Ensure `SUPABASE_SERVICE_ROLE_KEY` is set in `backend/.env`
   - Restart the backend server after adding the key

2. **Error: "Failed to reset password"**
   - Check that the user_id is valid
   - Verify the Supabase Service Role Key has admin permissions
   - Check backend logs for detailed error messages

3. **Error: "Access Denied"**
   - Ensure admin email is in `ALLOWED_ADMIN_EMAILS` list in `backend/admin.py`
   - Current allowed: `["loic.ricci@gmail.com"]`

### Password Update Page Shows Error

1. Ensure the magic link hasn't expired
2. Check that Supabase redirect URLs are configured correctly
3. Verify frontend is using correct `NEXT_PUBLIC_SUPABASE_URL`

---

## 🎨 UI/UX Features

### User Pages
- Consistent branding with app logo and name
- Dark mode support
- Loading states during API calls
- Clear error messages
- Success confirmation messages
- Mobile-responsive design

### Admin Modal
- Warning indicator showing which user's password is being reset
- Password strength indicator (minimum 6 characters)
- Confirmation field to prevent typos
- Amber color scheme to indicate caution
- Disabled state during API call

---

## 🔮 Future Enhancements

1. **Password Strength Meter**
   - Add visual indicator for password strength
   - Require stronger passwords (uppercase, numbers, symbols)

2. **Password Reset History**
   - Log password reset events for audit trail
   - Show last reset date in admin panel

3. **Bulk Operations**
   - Reset passwords for multiple users at once
   - Export temporary passwords

4. **Email Notifications**
   - Send notification email when admin resets a user's password
   - Configurable email templates

5. **Two-Factor Authentication**
   - Add 2FA before password reset
   - Admin 2FA for sensitive operations

---

## 📝 Notes

- Passwords must be at least 6 characters (configurable in Supabase)
- Admin-reset passwords take effect immediately
- User self-service resets require email verification
- Magic links expire after 1 hour by default (configurable in Supabase)
- No password history is kept (users can reuse old passwords)

---

## 🔗 Related Documentation

- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [BACKOFFICE_SETUP_GUIDE.md](./BACKOFFICE_SETUP_GUIDE.md) - Admin access configuration
- [QUICK_START_AI.md](./QUICK_START_AI.md) - General setup guide

---

## ✅ Checklist for Deployment

- [ ] Set `SUPABASE_SERVICE_ROLE_KEY` in production backend `.env`
- [ ] Configure Supabase email templates
- [ ] Add production URLs to Supabase redirect URLs
- [ ] Test password reset flow in staging environment
- [ ] Add admin emails to `ALLOWED_ADMIN_EMAILS` list
- [ ] Test admin password reset functionality
- [ ] Verify email delivery in production
- [ ] Document internal password reset procedures

---

**Created:** December 2025  
**Last Updated:** December 2025  
**Version:** 1.0








