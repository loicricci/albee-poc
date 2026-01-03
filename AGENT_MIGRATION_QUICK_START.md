# Quick Start Guide - After Avee → Agent Migration

## 🚀 What Changed?
All references to "Avee" in the frontend have been renamed to "Agent". This includes:
- UI text and labels
- Component names
- Function names
- Route paths (`/my-avees` → `/my-agents`)
- Storage bucket names (`avee-avatars` → `agent-avatars`)

## ⚡ Quick Start (3 Steps)

### Step 1: Run Supabase Migrations
Open your [Supabase SQL Editor](https://app.supabase.com) and run these migrations in order:

1. **First**: `backend/migrations/002_setup_storage_buckets.sql`
   - Creates storage buckets for image uploads
   - Sets up RLS policies

2. **Second**: `backend/migrations/003_rename_avee_to_agent_bucket.sql`
   - Creates new `agent-avatars` bucket
   - Updates policies

### Step 2: Start Your App
```bash
cd frontend
npm run dev
```

### Step 3: Test the App
1. Go to http://localhost:3000
2. Login to your account
3. Navigate to "My Agents" (was "My Avees")
4. Try creating/editing an agent
5. Test image uploads

## 📋 Key Route Changes

| Old Route | New Route |
|-----------|-----------|
| `/my-avees` | `/my-agents` |
| `/my-avees/[handle]` | `/my-agents/[handle]` |

**All other routes remain the same.**

## 🔧 Troubleshooting

### Image Upload Error: "new row violates row-level security policy"
**Solution**: You haven't run the Supabase migrations yet.
- Run `002_setup_storage_buckets.sql` in Supabase SQL Editor

### 404 Error on `/my-agents`
**Solution**: Make sure you've renamed the directory:
```bash
cd frontend/src/app/(app)
# If my-avees still exists:
mv my-avees my-agents
```

### "AgentCache is not defined" Error
**Solution**: The old `AveeCache.tsx` might still exist.
```bash
rm frontend/src/components/AveeCache.tsx
```

### Images from old `avee-avatars` bucket not loading
**Solution**: You need to migrate existing images. Two options:

**Option A - Quick (for dev)**: Just re-upload the images

**Option B - Migrate (for production)**:
Use the migration script in `003_rename_avee_to_agent_bucket.sql`

## 📝 What You Need to Know

### Backend Still Uses "Avee" Terminology
The backend API endpoints still use `/avees/*` paths. This is fine - the frontend functions just have different names now:

```typescript
// Frontend function name
getAgentByHandle()

// Calls backend endpoint
GET /avees/{handle}
```

You can update the backend later if you want full consistency.

### Storage Buckets
- **`avatars`**: User profile pictures ✅
- **`agent-avatars`**: Agent profile pictures (NEW) ✅
- **`avee-avatars`**: Deprecated (delete after migration)

### No Data Loss
- All your existing data is safe
- Database tables unchanged
- Only frontend UI and routes changed

## 🎯 Development Workflow

Everything works as before, just with new names:

```typescript
// Import the API functions (new names)
import { 
  getMyAgents,      // was getMyAvees
  createAgent,      // was createAvee
  getAgentByHandle, // was getAveeByHandle
  updateAgent       // was updateAvee
} from '@/lib/api';

// Use them
const agents = await getMyAgents();
```

## 📚 Full Documentation
See `AVEE_TO_AGENT_MIGRATION.md` for complete details on all changes.

## ✅ Everything Working?
If you can:
- ✅ Navigate to `/my-agents`
- ✅ Create a new agent
- ✅ Upload an agent avatar
- ✅ Chat with an agent

Then you're all set! 🎉











