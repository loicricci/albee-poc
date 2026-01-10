# Supabase Authentication Token Fix

## Problem
The backoffice page and other authenticated pages were throwing `HTTP 401: {"detail":"Invalid Supabase token"}` errors. Investigation revealed that:

1. Supabase auth tokens were expiring
2. The backend was receiving expired tokens and returning `403 Forbidden` from Supabase
3. The frontend wasn't detecting or handling token expiration properly
4. Users were seeing errors instead of being redirected to login

## Root Cause
From the backend logs:
```
INFO:httpx:HTTP Request: GET https://dqakztjxygoppdxagmtt.supabase.co/auth/v1/user "HTTP/1.1 403 Forbidden"
INFO:     127.0.0.1:61705 - "GET /admin/stats HTTP/1.1" 401 Unauthorized
```

The Supabase authentication service was returning `403 Forbidden` when the backend tried to validate an expired token, which then resulted in `401 Unauthorized` being returned to the frontend.

## Solution Implemented

### 1. Enhanced Token Management (`frontend/src/lib/api.ts`)

**Before:**
- Simple token retrieval without checking expiration
- No automatic refresh handling
- No session validation

**After:**
```typescript
async function getToken(): Promise<string> {
  // First, try to get the current session
  const { data, error } = await supabase.auth.getSession();
  
  if (error) {
    console.error("[API] Error getting session:", error);
    throw new Error(error.message);
  }

  // If no session, user is not logged in
  if (!data.session) {
    throw new Error("Not logged in (no session)");
  }

  // Check if token is expired or about to expire (within 60 seconds)
  const expiresAt = data.session.expires_at;
  const now = Math.floor(Date.now() / 1000);
  
  if (expiresAt && expiresAt - now < 60) {
    console.log("[API] Token expiring soon, attempting refresh...");
    
    // Try to refresh the session
    const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
    
    if (refreshError || !refreshData.session) {
      console.error("[API] Token refresh failed:", refreshError);
      // If refresh fails, the session is truly expired
      throw new Error("Session expired (refresh failed)");
    }
    
    console.log("[API] Token refreshed successfully");
    return refreshData.session.access_token;
  }

  return data.session.access_token;
}
```

**Key improvements:**
- Proactive token expiration checking
- Automatic refresh when token is about to expire (< 60 seconds)
- Better error messages for debugging
- Graceful fallback to current token if not expiring

### 2. Automatic Redirect on 401 Errors

Added automatic sign-out and redirect when receiving 401 errors:

```typescript
// If we get 401 Unauthorized, the token is invalid - sign out and redirect to login
if (res.status === 401) {
  console.error("[API] 401 Unauthorized - Session expired or invalid. Signing out...");
  // Sign out and redirect to login (but don't await to avoid blocking the error)
  supabase.auth.signOut().then(() => {
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
  });
}
```

This ensures that when a token becomes truly invalid (expired, revoked, etc.), the user is automatically signed out and redirected to login.

### 3. Supabase Client Configuration (`frontend/src/lib/supabaseClient.ts`)

Enhanced the Supabase client configuration to enable automatic token refresh:

```typescript
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      autoRefreshToken: true,      // Automatically refresh tokens before expiry
      persistSession: true,         // Persist session in localStorage
      detectSessionInUrl: true      // Handle OAuth callbacks
    }
  }
);
```

**Benefits:**
- `autoRefreshToken: true` - Supabase will automatically refresh tokens in the background
- `persistSession: true` - Session survives page refreshes
- `detectSessionInUrl: true` - Handles OAuth flows properly

### 4. Better Error Handling in Backoffice

Updated the backoffice page to distinguish between access denied (403) and session expired (401):

```typescript
catch (err: any) {
  console.error("Failed to load stats:", err);
  if (err?.status === 403 || err?.message?.includes("403")) {
    setAccessDenied(true);  // Show "Access Denied" message
  } else if (err?.status === 401 || err?.message?.includes("401")) {
    // Session expired - will be handled by apiFetch redirect
    console.log("[Backoffice] Session expired, redirecting to login...");
  }
}
```

## How It Works Now

1. **Token Retrieval**: When making an API call, `getToken()` checks if the token is about to expire
2. **Proactive Refresh**: If expiring within 60 seconds, it automatically refreshes the token
3. **Background Refresh**: Supabase also refreshes tokens automatically in the background
4. **Error Detection**: If a 401 error occurs (token truly invalid), user is signed out and redirected
5. **Session Monitoring**: The layout's `onAuthStateChange` listener catches session changes and redirects accordingly

## Testing

To verify the fix works:

1. **Normal Usage**: Browse the site - tokens should refresh automatically
2. **Token Expiration**: Wait for token to expire (default: 1 hour) - should refresh seamlessly
3. **Invalid Token**: Force logout from another tab - should redirect to login
4. **Backoffice Access**: Access `/backoffice` - should work for admin users, show access denied for others

## Benefits

- ✅ **No more 401 errors** for users with valid sessions
- ✅ **Automatic token refresh** before expiration
- ✅ **Graceful degradation** when session truly expires
- ✅ **Better user experience** - seamless authentication
- ✅ **Clear error messages** for debugging
- ✅ **Proper access control** - distinguishes between "not authorized" and "session expired"

## Future Improvements

1. Consider adding a visual indicator when token refresh fails
2. Add retry logic for transient network errors
3. Implement token refresh queue to avoid multiple simultaneous refreshes
4. Add telemetry/analytics for auth failures










