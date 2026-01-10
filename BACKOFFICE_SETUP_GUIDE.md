# Backoffice Profile Creation - Setup Guide

## 🐛 Bug Fixes Applied

### Issue 1: 404 Error on Profile View
**Problem**: Clicking "View" button resulted in 404 error  
**Cause**: Incorrect route - was using `/{handle}` instead of `/u/{handle}`  
**Fix**: Updated the link to use `/u/${profile.handle}`

### Issue 2: HTTP 500 Error on Profile Creation
**Problem**: "Supabase configuration missing. Cannot create user."  
**Cause**: Missing `SUPABASE_SERVICE_ROLE_KEY` environment variable  
**Solution**: Need to add this to your backend/.env file

---

## 🔧 Required Setup

### Step 1: Get Your Supabase Service Role Key

1. Go to your Supabase project dashboard
2. Navigate to **Settings** → **API**
3. Find the **Service Role Key** (secret key) - NOT the anon key
4. Copy this key (it starts with `eyJ...`)

### Step 2: Add to Backend Environment

You need to add the Service Role Key to your backend environment variables.

**Option A: Add to backend/.env file**

```bash
# Navigate to backend directory
cd /Users/loicricci/gabee-poc/backend

# Edit .env file (create if it doesn't exist)
nano .env
```

Add this line (replace with your actual key):
```env
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...your-key-here
```

**Option B: Set as environment variable before running**

```bash
export SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...your-key-here"
```

### Step 3: Restart Backend Server

After adding the environment variable, restart your backend server:

```bash
# If running with uvicorn
cd backend
uvicorn main:app --reload --port 8000

# Or if using a different method, restart accordingly
```

---

## ✅ Verify Setup

### Test Profile Creation

1. Go to `localhost:3001/backoffice`
2. Click **Profiles** tab
3. Click **Create Profile** button
4. Fill in:
   - Handle: `testuser`
   - Display Name: `Test User`
   - Email: `test@example.com`
5. Click **Create Profile**

**Expected Result**: Success message and profile appears in list

### Test Profile View

1. In the Profiles list, find any profile
2. Click the blue **View** button
3. Should navigate to `/u/{handle}` page

---

## 🔍 Troubleshooting

### Error: "Supabase configuration missing"

**Check these:**

1. **Is SUPABASE_SERVICE_ROLE_KEY set?**
   ```bash
   cd backend
   python3 -c "import os; from dotenv import load_dotenv; load_dotenv('.env'); print('Key exists:', bool(os.getenv('SUPABASE_SERVICE_ROLE_KEY')))"
   ```

2. **Is it the correct key?**
   - Should start with `eyJ`
   - Should be the **Service Role Key**, not the anon key
   - Found in Supabase Dashboard → Settings → API

3. **Did you restart the backend?**
   - Environment variables are loaded at startup
   - Must restart after adding .env changes

### Error: "Handle already exists"

This is expected if you try to create a profile with an existing handle.  
Choose a different handle.

### Error: "Failed to create Supabase user"

**Possible causes:**
1. Invalid email format
2. Email already registered in Supabase
3. Service Role Key is invalid
4. Network/connection issue with Supabase

**Debug steps:**
```bash
# Check backend logs for detailed error
tail -f backend_logs.txt

# Or if running in terminal, check console output
```

### 404 Error on Profile View

**Fixed in latest version**. If still occurring:
1. Clear browser cache
2. Refresh the page
3. Verify the URL shows `/u/handle` not just `/handle`

---

## 📝 Environment Variables Checklist

Your `backend/.env` file should have:

```env
# Required for basic functionality
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=eyJ...your-anon-key

# Required for admin profile creation
SUPABASE_SERVICE_ROLE_KEY=eyJ...your-service-role-key

# Other keys (if using these features)
OPENAI_API_KEY=sk-...
```

---

## 🔐 Security Note

**⚠️ IMPORTANT: Keep your Service Role Key secure!**

- Never commit it to git
- Never share it publicly
- It has full admin access to your Supabase project
- Add `.env` to `.gitignore` (should already be there)

---

## 🧪 Testing Script

Create a test file to verify your setup:

```python
# test_admin_setup.py
import os
from dotenv import load_dotenv

load_dotenv('backend/.env')

supabase_url = os.getenv('SUPABASE_URL')
service_key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')

print("Setup Check:")
print(f"✓ SUPABASE_URL: {'✓ Set' if supabase_url else '✗ Missing'}")
print(f"✓ SERVICE_ROLE_KEY: {'✓ Set' if service_key else '✗ Missing'}")

if service_key:
    print(f"  - Key starts with: {service_key[:10]}...")
    print(f"  - Key length: {len(service_key)} chars")
```

Run it:
```bash
python3 test_admin_setup.py
```

---

## 🚀 Quick Fix Commands

If you need to quickly set up for testing:

```bash
# 1. Navigate to backend
cd /Users/loicricci/gabee-poc/backend

# 2. Create or edit .env
echo "SUPABASE_SERVICE_ROLE_KEY=your-key-here" >> .env

# 3. Restart backend (if running)
pkill -f "uvicorn main:app"
uvicorn main:app --reload --port 8000 &

# 4. Test in browser
open http://localhost:3001/backoffice
```

---

## 📞 Still Having Issues?

If the above steps don't work:

1. **Check backend logs** for detailed error messages
2. **Verify Supabase project** is active and accessible
3. **Test with curl** to isolate frontend/backend issues:

```bash
# Get your auth token from browser (login first)
TOKEN="your-auth-token"

# Test the endpoint
curl -X POST http://localhost:8000/admin/profiles/create \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "handle": "testuser",
    "display_name": "Test User",
    "email": "test@example.com"
  }'
```

---

**Last Updated**: December 28, 2025  
**Status**: Bugs Fixed - Awaiting Configuration








