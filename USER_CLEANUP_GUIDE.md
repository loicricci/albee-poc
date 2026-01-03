# Cleanup Orphaned User Account (loic@wemine.fi)

## Problem

The account `loic@wemine.fi` exists in Supabase Auth but may not exist in the database (or vice versa), causing signup issues.

## Solution

I've added a new admin endpoint to help diagnose and fix this issue.

### Step 1: Check the Account Status

1. Go to the backoffice: http://localhost:3001/backoffice
2. Log in with your admin account (loic.ricci@gmail.com)
3. Use the browser console or make an API call:

```bash
# Get your auth token from localStorage in the browser console:
# localStorage.getItem('supabase.auth.token')

curl -X GET "http://localhost:8000/admin/profiles/check-supabase-user?email=loic@wemine.fi" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN"
```

This will show you:
- Whether the user exists in Supabase Auth
- Whether the user exists in the database
- A diagnosis of the problem
- The recommended solution

### Step 2: Delete the User (Fixed Version)

Once you know the user_id, you can delete it from the backoffice:

1. If you see the profile in the backoffice profiles list, simply click delete
2. **The updated delete endpoint will now delete BOTH**:
   - The profile from the database
   - The user from Supabase Auth

This ensures complete cleanup!

### Step 3: Verify

Try signing up again with `loic@wemine.fi` - it should work now!

## What Was Fixed

### Before
- Backoffice delete (`DELETE /admin/profiles/{user_id}`) only deleted the database profile
- User remained in Supabase Auth
- Signup would fail with "This email already has an account"

### After
- Backoffice delete now:
  1. Deletes the profile from database (cascades to all related data)
  2. **Also deletes the user from Supabase Auth** using Admin API
- Complete cleanup ensures email can be reused

## Alternative: Manual Cleanup Scripts

If you need to clean up manually, I've created two helper scripts:

### Option 1: Python Script
```bash
python3 cleanup_user.py loic@wemine.fi
```

### Option 2: Bash Script  
```bash
./cleanup_user.sh
```

Both scripts will:
1. Check if the user exists in Supabase Auth
2. Check if the profile exists in the database
3. Ask for confirmation
4. Delete from both locations

## Why This Happens

When you delete a user from the backoffice, if it only deletes the database profile but not the Supabase Auth user, the auth user remains in a "ghost" state with 0 identities. This triggers the signup flow to think the email is taken.

## Quick Check: Is the Email Available?

You can also check if an email is available by trying the signup flow. The code checks:

```typescript
// In signup/page.tsx
if (data.user && (data.user.identities?.length ?? 0) === 0) {
  setInfo("This email already has an account. Please log in.");
}
```

If you see this message but can't log in, it means the user exists in Supabase but may have issues.

## Future Prevention

With the updated `/admin/profiles/{user_id}` endpoint, this issue should not happen again. All future deletions from the backoffice will clean up both systems.






