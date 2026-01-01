# Agent Limit - Code Changes Reference

## Files Modified

1. `backend/main.py` - Backend logic
2. `frontend/src/lib/api.ts` - API client
3. `frontend/src/app/(app)/my-agents/page.tsx` - UI

---

## 1. Backend Changes (`backend/main.py`)

### Import Statement (Line 21)
```python
# BEFORE
from auth_supabase import get_current_user_id

# AFTER
from auth_supabase import get_current_user_id, get_current_user
```

### Import Admin Emails (Line 78)
```python
# BEFORE
from admin import router as admin_router, require_admin

# AFTER
from admin import router as admin_router, require_admin, ALLOWED_ADMIN_EMAILS
```

### Add Helper Function (After line ~200)
```python
def _is_admin(user: dict) -> bool:
    """Check if a user has admin privileges based on their email"""
    user_email = user.get("email", "").lower()
    return user_email in ALLOWED_ADMIN_EMAILS
```

### Update create_avee Function (Line ~444)
```python
# BEFORE
@app.post("/avees")
def create_avee(
    handle: str,
    display_name: str | None = None,
    bio: str | None = None,
    avatar_url: str | None = None,
    auto_research: bool = False,
    research_topic: str | None = None,
    research_max_sources: int = 5,
    research_layer: str = "public",
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    """
    Create a new agent (Avee).
    ...
    """
    user_uuid = _parse_uuid(user_id, "user_id")

    if not handle or not handle.strip():
        raise HTTPException(status_code=400, detail="Empty handle")

    handle = handle.strip().lower()

    prof = db.query(Profile).filter(Profile.user_id == user_uuid).first()
    if not prof:
        raise HTTPException(status_code=400, detail="Create profile first: POST /me/profile")
    
    # ... rest of function

# AFTER
@app.post("/avees")
async def create_avee(  # Changed to async
    handle: str,
    display_name: str | None = None,
    bio: str | None = None,
    avatar_url: str | None = None,
    auto_research: bool = False,
    research_topic: str | None = None,
    research_max_sources: int = 5,
    research_layer: str = "public",
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
    user: dict = Depends(get_current_user),  # ADDED
):
    """
    Create a new agent (Avee).
    
    **Agent Limits:**
    - Regular users: Limited to 1 agent
    - Admin users: Unlimited agents
    ...
    """
    user_uuid = _parse_uuid(user_id, "user_id")

    if not handle or not handle.strip():
        raise HTTPException(status_code=400, detail="Empty handle")

    handle = handle.strip().lower()

    prof = db.query(Profile).filter(Profile.user_id == user_uuid).first()
    if not prof:
        raise HTTPException(status_code=400, detail="Create profile first: POST /me/profile")
    
    # ADDED: Check agent limit for non-admin users
    is_admin = _is_admin(user)
    if not is_admin:
        existing_agent_count = db.query(func.count(Avee.id)).filter(
            Avee.owner_user_id == user_uuid
        ).scalar()
        
        if existing_agent_count >= 1:
            raise HTTPException(
                status_code=403, 
                detail="Regular users are limited to 1 agent. Please delete your existing agent to create a new one, or contact an administrator for more agents."
            )
    
    # ... rest of function continues unchanged
```

### Add New Endpoint (Before @app.get("/me/avees"), around line ~629)
```python
@app.get("/me/agent-limit-status")
async def get_agent_limit_status(
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
    user: dict = Depends(get_current_user),
):
    """
    Get information about the current user's agent limit status.
    Returns how many agents they have and how many they can create.
    """
    user_uuid = _parse_uuid(user_id, "user_id")
    
    is_admin = _is_admin(user)
    current_count = db.query(func.count(Avee.id)).filter(
        Avee.owner_user_id == user_uuid
    ).scalar()
    
    max_agents = -1 if is_admin else 1  # -1 means unlimited
    can_create_more = is_admin or current_count < 1
    
    return {
        "is_admin": is_admin,
        "current_agent_count": current_count or 0,
        "max_agents": max_agents,
        "can_create_more": can_create_more,
        "remaining": -1 if is_admin else max(0, 1 - (current_count or 0))
    }
```

---

## 2. Frontend API Changes (`frontend/src/lib/api.ts`)

### Add New Function (After getMyAgents, around line ~100)
```typescript
// BEFORE
export async function getMyAgents() {
  return apiFetch("/me/avees", { method: "GET" });
}

export async function createAgent(params: {

// AFTER
export async function getMyAgents() {
  return apiFetch("/me/avees", { method: "GET" });
}

export async function getAgentLimitStatus() {
  return apiFetch("/me/agent-limit-status", { method: "GET" });
}

export async function createAgent(params: {
```

---

## 3. Frontend UI Changes (`frontend/src/app/(app)/my-agents/page.tsx`)

### Update Imports (Line ~5)
```typescript
// BEFORE
import { createAgent, getMyAgents } from "@/lib/api";

// AFTER
import { createAgent, getMyAgents, getAgentLimitStatus } from "@/lib/api";
```

### Add Type Definition (After Agent type, around line ~17)
```typescript
type Agent = {
  id?: string;
  handle: string;
  display_name?: string;
  avatar_url?: string;
  owner_user_id?: string;
  created_at?: string;
};

// ADDED
type AgentLimitStatus = {
  is_admin: boolean;
  current_agent_count: number;
  max_agents: number;  // -1 means unlimited
  can_create_more: boolean;
  remaining: number;   // -1 means unlimited
};
```

### Update State (In MyAgentsContent function, around line ~43)
```typescript
// BEFORE
const [agents, setAgents] = useState<Agent[]>([]);

// AFTER
const [agents, setAgents] = useState<Agent[]>([]);
const [limitStatus, setLimitStatus] = useState<AgentLimitStatus | null>(null);
```

### Update load() Function (Around line ~61)
```typescript
// BEFORE
async function load() {
  setLoading(true);
  setError(null);
  try {
    const data = await getMyAgents();
    const list = Array.isArray(data) ? data : data.items;
    setAgents(list || []);
  } catch (e: any) {
    setError(e.message || "Failed to load agents");
  } finally {
    setLoading(false);
  }
}

// AFTER
async function load() {
  setLoading(true);
  setError(null);
  try {
    const [agentsData, limitData] = await Promise.all([
      getMyAgents(),
      getAgentLimitStatus()
    ]);
    const list = Array.isArray(agentsData) ? agentsData : agentsData.items;
    setAgents(list || []);
    setLimitStatus(limitData);
  } catch (e: any) {
    setError(e.message || "Failed to load agents");
  } finally {
    setLoading(false);
  }
}
```

### Update Header Section (Around line ~156)
```tsx
// BEFORE
<div>
  <h1 className="text-3xl font-bold text-[#0B0B0C]">My Agents</h1>
  <p className="mt-2 text-[#2E3A59]/70">Create and manage your AI personalities</p>
</div>
<button
  onClick={() => setShowCreateForm(!showCreateForm)}
  className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-[#2E3A59] to-[#1a2236] px-6 py-3 text-sm font-semibold text-white shadow-md transition-all hover:shadow-lg hover:scale-105"
>

// AFTER
<div>
  <h1 className="text-3xl font-bold text-[#0B0B0C]">My Agents</h1>
  <p className="mt-2 text-[#2E3A59]/70">
    Create and manage your AI personalities
    {limitStatus && !limitStatus.is_admin && (
      <span className="ml-2 text-sm">
        ({limitStatus.current_agent_count}/{limitStatus.max_agents} agent{limitStatus.max_agents !== 1 ? 's' : ''} created)
      </span>
    )}
    {limitStatus && limitStatus.is_admin && (
      <span className="ml-2 rounded-full bg-[#C8A24A] px-3 py-1 text-xs font-semibold text-white">
        ADMIN - UNLIMITED
      </span>
    )}
  </p>
</div>
<button
  onClick={() => setShowCreateForm(!showCreateForm)}
  disabled={limitStatus && !limitStatus.can_create_more}
  className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-[#2E3A59] to-[#1a2236] px-6 py-3 text-sm font-semibold text-white shadow-md transition-all hover:shadow-lg hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
  title={limitStatus && !limitStatus.can_create_more ? "You've reached the maximum number of agents" : ""}
>
```

### Add Warning Banner (After header section, around line ~170)
```tsx
{/* ADDED: Agent Limit Warning */}
{limitStatus && !limitStatus.can_create_more && !limitStatus.is_admin && (
  <div className="mb-6 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 animate-slide-up">
    <svg className="h-5 w-5 shrink-0 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
    <div className="flex-1">
      <div className="text-sm font-medium text-amber-800">Agent Limit Reached</div>
      <div className="mt-1 text-xs text-amber-700">
        Regular users are limited to {limitStatus.max_agents} agent{limitStatus.max_agents !== 1 ? 's' : ''}. 
        Delete your existing agent to create a new one, or contact an administrator for additional agents.
      </div>
    </div>
  </div>
)}
```

---

## Quick Reference: What Each Change Does

| Change | Purpose |
|--------|---------|
| `_is_admin()` helper | Check if user email is in admin list |
| `user: dict = Depends(get_current_user)` | Get full user object (not just ID) to check email |
| Agent count check in create_avee | Count existing agents and reject if ≥1 for non-admins |
| `GET /me/agent-limit-status` endpoint | Let frontend know user's limit status |
| `getAgentLimitStatus()` API function | Frontend calls the new endpoint |
| UI state for `limitStatus` | Store limit info in React state |
| Header badge | Show "ADMIN - UNLIMITED" or "(1/1 agents)" |
| Disabled create button | Prevent clicking when limit reached |
| Warning banner | Explain why limit reached and what to do |

---

## Testing Commands

### Backend Test
```bash
# Start backend
cd backend
source venv/bin/activate
uvicorn main:app --reload --port 8000

# Test in another terminal
# Regular user (will fail on 2nd agent)
curl -X POST "http://localhost:8000/avees?handle=agent1" \
  -H "Authorization: Bearer {regular_user_token}"

# Admin user (unlimited)
curl -X POST "http://localhost:8000/avees?handle=admin-agent-1" \
  -H "Authorization: Bearer {admin_token}"
```

### Frontend Test
```bash
# Start frontend
cd frontend
npm run dev

# Visit http://localhost:3000/my-agents
# Login as regular user → see limit
# Login as admin → see unlimited badge
```

---

**All changes implemented and tested!** ✅





