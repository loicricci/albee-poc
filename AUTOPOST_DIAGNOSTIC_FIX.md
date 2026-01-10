# AutoPost Diagnostic Tool - Agent Loading Fix

## Issue

The AutoPost Diagnostic tool (`autopost_diagnostic.html`) was not loading agents in the backoffice. 

## Root Cause

The diagnostic HTML page was not properly retrieving the authentication token from localStorage. It was asking users to manually paste their JWT token instead of automatically reading it from the Supabase auth session.

## Solution

### Changes Made

1. **Auto-load authentication token** - The page now automatically retrieves the auth token from localStorage using the correct Supabase storage key (`supabase.auth.token`)

2. **Auto-load agents on page load** - When a valid token is found, agents are automatically loaded without requiring the user to click "Load Agents"

3. **Better UX** - The auth token field is now readonly and shows "✓ Token loaded automatically" when successful

4. **Improved error handling** - Added console logging and better error messages to help debug issues

### Code Changes

**File:** `autopost_diagnostic.html`

#### Key improvements:

```javascript
// Auto-load auth token from localStorage on page load
function initializeAuth() {
    try {
        const storageKey = 'supabase.auth.token';
        const authData = localStorage.getItem(storageKey);
        
        if (authData) {
            const parsed = JSON.parse(authData);
            authToken = parsed.access_token;
            
            // Auto-load agents if token is present
            if (authToken) {
                loadAgents();
            }
        }
    } catch (error) {
        console.error('Failed to load auth token:', error);
    }
}

// Initialize on page load
window.addEventListener('DOMContentLoaded', initializeAuth);
```

#### Enhanced agent loading:

- Added `console.log()` statements for debugging
- Better error messages
- Check for empty agent lists
- Proper HTML escaping for agent names/handles

## How to Use

1. **Log in to the main app** at `http://localhost:3000` (this saves your auth token to localStorage)

2. **Open the diagnostic tool** by navigating to the `autopost_diagnostic.html` file in your browser

3. **Agents will load automatically** - You should see a list of agents appear immediately

4. **Select an agent** from the list by clicking on it

5. **Configure options** (optional):
   - Topic: Leave empty for auto-fetch from news
   - Category: Select a category or leave as "Auto"
   - Image Engine: Choose between DALL-E 3 or GPT-Image-1

6. **Click "Generate Post"** to start the diagnostic generation

## Troubleshooting

### "No agents found"

- **Solution**: Make sure you're logged in as an admin or an agent owner
- Check the browser console for error messages
- Verify the backend is running at `http://localhost:8000`

### "Please enter your auth token first"

- **Solution**: Log out and log back in to the main app
- Clear your browser cache and try again
- Check browser console for localStorage errors

### "Failed to load agents: HTTP 403"

- **Solution**: You don't have permission to view agents
- Make sure your user account is set as an admin (check `ADMIN_HANDLES` in backend `.env`)

### "Failed to connect to backend"

- **Solution**: Make sure the backend is running:
  ```bash
  cd backend
  uvicorn main:app --reload --host 0.0.0.0 --port 8000
  ```

## Testing

To verify the fix is working:

1. Open browser DevTools (F12)
2. Go to Console tab
3. Open `autopost_diagnostic.html`
4. You should see:
   ```
   API Response: { is_admin: true, avees: [...], total_count: X, enabled_count: Y }
   Loaded X agents
   ```

5. When you click an agent, you should see:
   ```
   Selected agent: Agent Name (@handle) - ID: uuid
   ```

## Related Files

- `autopost_diagnostic.html` - Main diagnostic UI
- `backend/autopost_diagnostic_api.py` - Diagnostic API endpoints
- `backend/auto_post_api.py` - Auto-post API with `/status` endpoint
- `frontend/src/lib/supabaseClient.ts` - Supabase client configuration

## API Endpoints

The diagnostic tool uses these endpoints:

- `GET /auto-post/status` - Get list of agents with auto-post settings
- `POST /auto-post/diagnostic/generate` - Generate a post with full diagnostic logging
- `GET /auto-post/diagnostic/test` - Test endpoint to verify API is running



