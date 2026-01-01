# Agent Limit Implementation

## Overview

The platform now enforces different agent creation limits based on user role:

- **Regular Users**: Limited to **1 agent**
- **Admin Users**: **Unlimited agents**

## Implementation Details

### Backend Changes (`backend/main.py`)

#### 1. Added Admin Check Helper
```python
def _is_admin(user: dict) -> bool:
    """Check if a user has admin privileges based on their email"""
    user_email = user.get("email", "").lower()
    return user_email in ALLOWED_ADMIN_EMAILS
```

#### 2. Updated Agent Creation Endpoint
Modified `POST /avees` to:
- Check if user is admin using `_is_admin()`
- For non-admin users, query existing agent count
- Reject creation if regular user already has 1 agent
- Allow unlimited creation for admin users

```python
@app.post("/avees")
async def create_avee(
    # ... parameters
    user: dict = Depends(get_current_user),
):
    # Check agent limit for non-admin users
    is_admin = _is_admin(user)
    if not is_admin:
        existing_agent_count = db.query(func.count(Avee.id)).filter(
            Avee.owner_user_id == user_uuid
        ).scalar()
        
        if existing_agent_count >= 1:
            raise HTTPException(
                status_code=403, 
                detail="Regular users are limited to 1 agent..."
            )
```

#### 3. Added Agent Limit Status Endpoint
New endpoint: `GET /me/agent-limit-status`

Returns:
```json
{
  "is_admin": false,
  "current_agent_count": 1,
  "max_agents": 1,
  "can_create_more": false,
  "remaining": 0
}
```

For admins:
```json
{
  "is_admin": true,
  "current_agent_count": 5,
  "max_agents": -1,  // -1 means unlimited
  "can_create_more": true,
  "remaining": -1
}
```

### Frontend Changes

#### 1. API Service (`frontend/src/lib/api.ts`)
Added new function:
```typescript
export async function getAgentLimitStatus() {
  return apiFetch("/me/agent-limit-status", { method: "GET" });
}
```

#### 2. My Agents Page (`frontend/src/app/(app)/my-agents/page.tsx`)

**Features Added:**

1. **Limit Status Display**
   - Shows agent count for regular users: "(1/1 agents created)"
   - Shows "ADMIN - UNLIMITED" badge for admins

2. **Create Button Behavior**
   - Disabled when limit reached (regular users with 1 agent)
   - Always enabled for admins
   - Tooltip on hover explains why disabled

3. **Warning Banner**
   - Appears when regular user reaches limit
   - Explains limitation clearly
   - Suggests deleting existing agent or contacting admin

4. **Real-time Status**
   - Fetches limit status on page load
   - Updates after creating/deleting agents

## Admin Configuration

Admins are defined in `backend/admin.py`:

```python
ALLOWED_ADMIN_EMAILS = ["loic.ricci@gmail.com"]
```

To add more admins, update this list and restart the backend.

## Error Messages

### Backend Error (403)
When regular user tries to create a second agent:
```
Regular users are limited to 1 agent. Please delete your existing agent to create a new one, or contact an administrator for more agents.
```

### Frontend Warning
When limit reached:
```
Agent Limit Reached
Regular users are limited to 1 agent. Delete your existing agent to create a new one, 
or contact an administrator for additional agents.
```

## User Experience Flow

### Regular User (First Agent)
1. Visit `/my-agents`
2. See: "(0/1 agents created)"
3. Click "Create New Agent" ✅
4. Agent created successfully
5. Now shows: "(1/1 agents created)"
6. "Create New Agent" button becomes disabled with warning

### Regular User (Trying Second Agent)
1. Visit `/my-agents`
2. See: "(1/1 agents created)"
3. "Create New Agent" button is disabled
4. Yellow warning banner explains limitation
5. Can delete existing agent to create a new one

### Admin User
1. Visit `/my-agents`
2. See: "ADMIN - UNLIMITED" badge
3. No count restrictions shown
4. "Create New Agent" always enabled
5. Can create unlimited agents

## Testing

### Test Regular User
```bash
# As regular user (not loic.ricci@gmail.com)
curl -X POST "http://localhost:8000/avees?handle=my-agent" \
  -H "Authorization: Bearer {token}"
# ✅ First agent created

curl -X POST "http://localhost:8000/avees?handle=my-second-agent" \
  -H "Authorization: Bearer {token}"
# ❌ 403 Error: "Regular users are limited to 1 agent"
```

### Test Admin User
```bash
# As admin (loic.ricci@gmail.com)
curl -X POST "http://localhost:8000/avees?handle=agent1" \
  -H "Authorization: Bearer {admin_token}"
# ✅ Created

curl -X POST "http://localhost:8000/avees?handle=agent2" \
  -H "Authorization: Bearer {admin_token}"
# ✅ Created

curl -X POST "http://localhost:8000/avees?handle=agent3" \
  -H "Authorization: Bearer {admin_token}"
# ✅ Created (unlimited)
```

### Check Limit Status
```bash
curl -X GET "http://localhost:8000/me/agent-limit-status" \
  -H "Authorization: Bearer {token}"
```

## Database Impact

No schema changes required. The system:
- Queries existing agents on each creation attempt
- Uses existing `ALLOWED_ADMIN_EMAILS` configuration
- No new tables or columns needed

## Future Enhancements

### Option 1: Configurable Limits
Add to database:
```sql
ALTER TABLE profiles ADD COLUMN max_agents INTEGER DEFAULT 1;
```

Admin can then set custom limits per user.

### Option 2: Premium Tiers
```sql
ALTER TABLE profiles ADD COLUMN subscription_tier VARCHAR DEFAULT 'free';
```

Tiers:
- Free: 1 agent
- Premium: 10 agents
- Enterprise: Unlimited

### Option 3: Soft Limit with Upgrade Prompt
Instead of hard blocking, show upgrade prompt:
```
"You've reached your free tier limit of 1 agent. 
Upgrade to Premium for 10 agents or Enterprise for unlimited!"
```

## Migration Notes

This is a **soft deployment** - existing users keep all their agents:
- No data deletion
- No migration script needed
- Users with multiple agents (created before this change) keep them
- The limit only applies to **new** agent creation attempts

If you want to enforce retroactively:
```python
# Add one-time cleanup script
for user in non_admin_users:
    agents = get_agents(user)
    if len(agents) > 1:
        # Keep first, delete others, or prompt user to choose
        pass
```

## Support

### Regular User Requests More Agents
Options:
1. Add their email to `ALLOWED_ADMIN_EMAILS` (make them admin)
2. Implement premium tiers (future)
3. Increase `max_agents` in code (for all users)

### Change Global Limit
Edit `backend/main.py`:
```python
if existing_agent_count >= 3:  # Change 1 to 3
```

---

**Implementation Date:** December 27, 2025  
**Status:** ✅ Complete and Deployed





