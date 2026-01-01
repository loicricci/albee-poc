# Fix Profile Creation - Missing Service Role Key

## The Problem
Backend error: "Supabase configuration missing. Cannot create user."

## The Solution

### Step 1: Get Your Supabase Service Role Key

1. Go to https://supabase.com/dashboard
2. Select your project
3. Go to **Settings** (gear icon on left sidebar)
4. Click **API**
5. Scroll down to **Project API keys**
6. Copy the **`service_role`** key (NOT the anon key)
   - It's labeled as "secret" and starts with `eyJ...`
   - ⚠️ This is different from the `anon` key!

### Step 2: Add It to Your Backend

Open your terminal and run:

```bash
cd /Users/loicricci/gabee-poc/backend

# Check if .env file exists
ls -la .env

# Edit the .env file (or create it)
nano .env
```

### Step 3: Add This Line to .env

Add or update this line in your `backend/.env` file:

```env
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.YOUR_ACTUAL_KEY_HERE
```

Your `.env` file should look something like this:

```env
SUPABASE_URL=https://xxxxxxxxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
OPENAI_API_KEY=sk-...
```

### Step 4: Restart Your Backend

**IMPORTANT**: You must restart the backend for it to pick up the new environment variable.

```bash
# Find and stop the current backend process
pkill -f "uvicorn main:app"

# Or if running in a terminal, press Ctrl+C

# Then restart it
cd /Users/loicricci/gabee-poc/backend
uvicorn main:app --reload --port 8000
```

### Step 5: Test Again

1. Go back to http://localhost:3001/backoffice
2. Click Profiles tab
3. Click "Create Profile"
4. Fill in the form
5. Click "Create Profile"

It should work now!

---

## Quick Verification

To check if the key is loaded, run this in your backend directory:

```bash
cd /Users/loicricci/gabee-poc/backend
python3 << EOF
import os
from dotenv import load_dotenv
load_dotenv('.env')
key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
if key:
    print(f"✓ Service Role Key is set (starts with: {key[:20]}...)")
else:
    print("✗ Service Role Key is NOT set")
EOF
```

---

## What's Next?

After fixing this, you mentioned there's a **second issue**. Once this is working, let me know what the second issue is and I'll help fix that too.


