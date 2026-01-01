# Onboarding Flow - Quick Fix Guide

## Issues Fixed

### 1. Layout Problem ✅
The onboarding page was showing the old sidebar layout. Fixed by:
- Adding `/onboarding` to the `usesNewLayout` check in `(app)/layout.tsx`
- Preventing auth redirect on onboarding page

### 2. Email Confirmation Redirect

**The Problem:**
After email confirmation, Supabase doesn't automatically redirect to `/onboarding`. 

**The Solution:**

You need to configure the Supabase redirect URL:

#### Option A: Configure in Supabase Dashboard (Recommended)

1. Go to https://supabase.com/dashboard
2. Select your project
3. Go to **Authentication** → **URL Configuration**
4. Set **Site URL**: `http://localhost:3001` (or your production URL)
5. Add **Redirect URLs**:
   - `http://localhost:3001/onboarding`
   - `http://localhost:3001/app`
   - Your production URLs (e.g., `https://yourdomain.com/onboarding`)

#### Option B: Set Redirect in Signup Code

Update the signup function in `/frontend/src/app/(auth)/signup/page.tsx`:

```typescript
const { data, error } = await supabase.auth.signUp({
  email: emailTrim,
  password: pw,
  options: {
    emailRedirectTo: `${window.location.origin}/onboarding`,
  },
});
```

### 3. Testing the Flow

**New User Signup:**
1. Go to http://localhost:3001/signup
2. Enter email and password
3. If email confirmation is OFF:
   - Redirects immediately to `/onboarding` ✅
4. If email confirmation is ON:
   - User gets email
   - Clicks confirmation link
   - Should redirect to `/onboarding`

**Returning User:**
- Already has profile → redirected to `/app` (bypasses onboarding)

### 4. Current Status

✅ Backend running on port 8000  
✅ Frontend running on port 3001  
✅ Onboarding layout fixed  
⚠️ Email redirect needs Supabase configuration

### Quick Test (No Email Confirmation)

To test immediately without email:

1. **Disable Email Confirmation in Supabase:**
   - Go to Supabase Dashboard → Authentication → Providers
   - Under Email → Confirm email: **Disable**

2. **Test Signup:**
   - Go to http://localhost:3001/signup
   - Create account
   - Should redirect to `/onboarding` immediately ✅

### Files Modified

- `frontend/src/app/(app)/layout.tsx` - Added onboarding to new layout paths
- `backend/onboarding.py` - Fixed import error

### Next Steps

1. Configure Supabase redirect URLs (see Option A above)
2. Or update signup code with emailRedirectTo (see Option B)
3. Test the complete flow


