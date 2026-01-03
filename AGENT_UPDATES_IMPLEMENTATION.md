# Agent Updates - Implementation Guide

## Overview

The Agent Updates feature has been designed and initial implementation files created. This guide walks through completing the implementation.

## Files Created

### Backend
1. ✅ `backend/migrations/008_agent_updates.sql` - Database schema
2. ✅ `backend/models.py` - Added `AgentUpdate` model
3. ✅ `backend/agent_updates.py` - Complete API router with endpoints
4. ✅ `backend/main.py` - Router integrated

### Frontend
1. ✅ `frontend/src/components/AgentUpdates.tsx` - Complete React component
2. ✅ `frontend/src/app/(app)/my-agents/[handle]/page.tsx` - Integrated component

### Documentation
1. ✅ `AGENT_UPDATES_PROPOSAL.md` - Complete UX/UI proposal
2. ✅ `AGENT_UPDATES_IMPLEMENTATION.md` - This file

## Implementation Steps

### Step 1: Run Database Migration

```bash
cd backend
python -c "
from db import engine
with open('migrations/008_agent_updates.sql', 'r') as f:
    sql = f.read()
    with engine.connect() as conn:
        conn.execute(sql)
        conn.commit()
print('✅ Migration 008 completed')
"
```

Or use your existing migration runner:

```bash
python backend/run_migration.py backend/migrations/008_agent_updates.sql
```

### Step 2: Verify Backend Setup

The backend is already integrated. Verify by checking:

```bash
# Check that the router is imported in main.py
grep "agent_updates" backend/main.py

# Should see:
# from .agent_updates import router as agent_updates_router
# app.include_router(agent_updates_router, tags=["agent-updates"])
```

### Step 3: Test Backend API

Start your backend server:

```bash
cd backend
uvicorn main:app --reload --port 8000
```

Test the endpoints:

```bash
# Get your auth token from Supabase
TOKEN="your-supabase-jwt-token"
AGENT_ID="your-agent-uuid"

# Create an update
curl -X POST "http://localhost:8000/agents/$AGENT_ID/updates" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Update",
    "content": "This is a test update to verify the system works.",
    "topic": "work",
    "layer": "public",
    "is_pinned": false
  }'

# List updates
curl "http://localhost:8000/agents/$AGENT_ID/updates" \
  -H "Authorization: Bearer $TOKEN"
```

### Step 4: Test Frontend Integration

Start your frontend:

```bash
cd frontend
npm run dev
```

Navigate to: `http://localhost:3000/my-agents/[your-agent-handle]`

You should see the new "📰 Agent Updates" card between the Persona and Training Data sections.

### Step 5: Create Your First Update

1. Click "New Update" button
2. Fill in:
   - **Title**: "Getting Started"
   - **Content**: "Testing the new updates feature!"
   - **Topic**: Work
   - **Layer**: Public
3. Click "Create Update"
4. Verify it appears in the list
5. Try pinning/unpinning it
6. Try editing it
7. Try deleting it

### Step 6: Verify RAG Integration

The update should automatically be:
1. Saved to `agent_updates` table
2. Created as a `Document` entry
3. Chunked and embedded in `document_chunks`

Test by chatting with your agent:

**User:** "What have you been working on recently?"

**Agent:** Should reference the update content in the response.

## API Endpoints Reference

### Create Update
```
POST /agents/{agent_id}/updates
Body: {
  "title": string (required, max 200 chars),
  "content": string (required, max 10,000 chars),
  "topic": string (optional),
  "layer": "public" | "friends" | "intimate",
  "is_pinned": boolean
}
```

### List Updates
```
GET /agents/{agent_id}/updates?layer=public&topic=work&limit=20&offset=0
```

### Get Single Update
```
GET /agents/{agent_id}/updates/{update_id}
```

### Update an Update
```
PUT /agents/{agent_id}/updates/{update_id}
Body: {
  "title": string (optional),
  "content": string (optional),
  "topic": string (optional),
  "layer": string (optional),
  "is_pinned": boolean (optional)
}
```

### Delete Update
```
DELETE /agents/{agent_id}/updates/{update_id}
```

### Pin/Unpin Update
```
POST /agents/{agent_id}/updates/{update_id}/pin
Body: { "is_pinned": boolean }
```

## Component Props

### AgentUpdates Component

```tsx
<AgentUpdates 
  agentId={string}      // UUID of the agent
  agentHandle={string}  // Handle of the agent (for display)
/>
```

The component is fully self-contained and handles:
- Loading updates
- Creating new updates
- Editing existing updates
- Deleting updates
- Pinning/unpinning
- Error handling
- Loading states

## Customization Options

### 1. Change Topic Presets

Edit `frontend/src/components/AgentUpdates.tsx`:

```tsx
const TOPIC_PRESETS = [
  { value: "work", label: "🏢 Work", color: "bg-blue-100 text-blue-800" },
  { value: "personal", label: "👤 Personal", color: "bg-pink-100 text-pink-800" },
  // Add your own topics here
];
```

### 2. Adjust Character Limits

Edit `backend/agent_updates.py`:

```python
if len(data.content) > 10000:  # Change this limit
    raise HTTPException(status_code=400, detail="Content too long")
```

And update the SQL migration:

```sql
CONSTRAINT check_content_length CHECK (length(content) > 0 AND length(content) <= 10000)
```

### 3. Change Pagination

Edit `backend/agent_updates.py`:

```python
async def list_updates(
    agent_id: str,
    limit: int = 20,  # Change default limit
    offset: int = 0,
    ...
):
```

### 4. Customize UI Colors

Edit `frontend/src/components/AgentUpdates.tsx`:

```tsx
// Header gradient
className="bg-gradient-to-r from-blue-50 to-purple-50"

// Button gradient
className="bg-gradient-to-r from-blue-600 to-purple-600"

// Pinned update background
className="border-yellow-300 bg-yellow-50/50"
```

## Troubleshooting

### Issue: "Table agent_updates does not exist"

**Solution:** Run the migration:
```bash
python backend/run_migration.py backend/migrations/008_agent_updates.sql
```

### Issue: "Module 'agent_updates' not found"

**Solution:** Ensure the file is in the correct location:
```bash
ls backend/agent_updates.py
```

And that the import in `main.py` uses relative import:
```python
from .agent_updates import router as agent_updates_router
```

### Issue: Updates not appearing in RAG

**Solution:** Check that:
1. OpenAI API key is set
2. `embed_texts()` function is working
3. Documents are being created (check `documents` table)
4. Chunks are being created (check `document_chunks` table)

Query to verify:
```sql
SELECT * FROM documents WHERE source LIKE 'agent_update:%';
SELECT * FROM document_chunks WHERE document_id IN (
  SELECT id FROM documents WHERE source LIKE 'agent_update:%'
);
```

### Issue: Frontend component not showing

**Solution:** 
1. Check that agent ID exists: `console.log(agent?.id)`
2. Check browser console for errors
3. Verify API base URL is set: `NEXT_PUBLIC_API_BASE`
4. Check network tab for failed requests

## Migration from Existing Contributions

If you have existing contribution files in `data/contributions/`, you can import them as updates:

```python
import os
import re
from datetime import datetime
from backend.models import AgentUpdate
from backend.db import SessionLocal

def import_contributions(agent_id: str, owner_user_id: str):
    db = SessionLocal()
    contributions_dir = "data/contributions"
    
    for filename in os.listdir(contributions_dir):
        if not filename.endswith('.md'):
            continue
            
        with open(os.path.join(contributions_dir, filename), 'r') as f:
            content = f.read()
            
        # Parse frontmatter
        match = re.search(r'---\n(.*?)\n---\n(.*)', content, re.DOTALL)
        if not match:
            continue
            
        frontmatter = match.group(1)
        body = match.group(2)
        
        # Extract title and topic
        title_match = re.search(r'Title: (.+)', frontmatter)
        topic_match = re.search(r'Topic: (.+)', frontmatter)
        date_match = re.search(r'Date: (.+)', frontmatter)
        
        title = title_match.group(1) if title_match else "Imported Update"
        topic = topic_match.group(1).lower() if topic_match else "other"
        
        # Create update
        update = AgentUpdate(
            avee_id=agent_id,
            owner_user_id=owner_user_id,
            title=title,
            content=body.strip(),
            topic=topic,
            layer="public",
            is_pinned="false"
        )
        
        if date_match:
            update.created_at = datetime.strptime(date_match.group(1), '%Y-%m-%d %H:%M:%S')
        
        db.add(update)
    
    db.commit()
    print(f"✅ Imported contributions as updates")

# Usage:
# import_contributions(agent_id="your-agent-uuid", owner_user_id="your-user-uuid")
```

## Next Steps

### Phase 2 Enhancements (Optional)

1. **Timeline View**: Create a dedicated timeline page showing all updates chronologically
2. **Markdown Rendering**: Add markdown support for rich text formatting
3. **Update Templates**: Pre-filled templates for common update types
4. **Bulk Operations**: Select and delete multiple updates at once
5. **Export**: Export updates to markdown or JSON
6. **Statistics**: Show update frequency and topic distribution
7. **Notifications**: Notify followers when new updates are posted
8. **Update Feed**: Public feed showing updates from followed agents

### Phase 3 Advanced Features

1. **Scheduled Updates**: Post updates at a future date/time
2. **Update Drafts**: Save drafts before publishing
3. **Update Reactions**: Allow followers to react to updates
4. **Update Comments**: Discussion threads on updates
5. **Rich Media**: Support images and videos in updates
6. **Update Analytics**: Track views and engagement
7. **Update Search**: Full-text search across all updates
8. **Update Categories**: Hierarchical topic organization

## Testing Checklist

- [ ] Database migration runs successfully
- [ ] Backend server starts without errors
- [ ] Can create an update via API
- [ ] Can list updates via API
- [ ] Can edit an update via API
- [ ] Can delete an update via API
- [ ] Can pin/unpin an update via API
- [ ] Frontend component renders
- [ ] Can create update via UI
- [ ] Can edit update via UI
- [ ] Can delete update via UI
- [ ] Can pin/unpin update via UI
- [ ] Updates appear in correct order (pinned first)
- [ ] Character limits are enforced
- [ ] Layer selection works
- [ ] Topic selection works
- [ ] Update creates Document entry
- [ ] Update creates DocumentChunk entries
- [ ] Agent can reference update in chat
- [ ] Error messages display correctly
- [ ] Loading states work properly

## Support

For issues or questions:
1. Check this implementation guide
2. Review the proposal document: `AGENT_UPDATES_PROPOSAL.md`
3. Check the code comments in `backend/agent_updates.py`
4. Review the component code in `frontend/src/components/AgentUpdates.tsx`

## Summary

The Agent Updates feature is now ready to use! It provides:

✅ **Easy Updates**: Create updates in 30 seconds
✅ **Automatic RAG**: Updates are automatically embedded and searchable
✅ **Privacy Control**: Layer-based access control
✅ **Rich Organization**: Topics, pinning, and timestamps
✅ **Clean UI**: Modern, intuitive interface
✅ **Full CRUD**: Create, read, update, delete operations

Start using it today to keep your agents up-to-date with the latest information!











