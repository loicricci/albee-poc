# Quick Rollback Guide - Admin Agent Fix

## If You Need to Rollback the Admin Agent Fix

If the admin agent orchestrator bypass is causing issues, here's how to quickly roll it back:

### Option 1: Disable the Admin Agent Check

In `backend/messaging.py`, find the `_is_admin_agent()` function and modify it to always return `False`:

```python
def _is_admin_agent(db: Session, avee_id: uuid.UUID) -> bool:
    """
    Check if an agent belongs to an admin user.
    TEMPORARILY DISABLED - always returns False to use orchestrator for all agents.
    """
    return False  # <-- Add this line and comment out the rest
```

This will make all agents (including admin agents) use the orchestrator again.

### Option 2: Remove the Admin Agent Check Entirely

Find these two locations in `backend/messaging.py` and comment them out:

#### Location 1: In `_handle_agent_response()` (around line 215)

```python
async def _handle_agent_response(...):
    try:
        # COMMENT OUT THIS BLOCK:
        # if _is_admin_agent(db, agent_id):
        #     print(f"[AGENT_RESPONSE] Admin agent detected {agent_id}, bypassing orchestrator")
        #     return await _handle_direct_agent_response(db, conversation, message, agent_id)
        
        print(f"[AGENT_RESPONSE] Starting orchestrator for user {user_id}, agent {agent_id}")
        engine = OrchestratorEngine(db)
        ...
```

#### Location 2: In `stream_message()` (around line 1030)

```python
# Check if user is the owner of the agent
is_owner = False
# is_admin_agent = False  # <-- Comment this out
if recipient_agent:
    is_owner = (recipient_agent.owner_user_id == user_uuid)
    # is_admin_agent = _is_admin_agent(db, recipient_agent.id)  # <-- Comment this out

# COMMENT OUT THIS ENTIRE BLOCK:
# if is_admin_agent:
#     print(f"[STREAM] Admin agent mode activated...")
#     async def admin_agent_stream():
#         ...
#     return StreamingResponse(...)

# OWNER MODE will continue to work
if is_owner:
    ...
```

### Option 3: Full Rollback to Previous Version

If you have git, you can rollback the entire messaging.py file:

```bash
cd /Users/loicricci/gabee-poc
git checkout HEAD -- backend/messaging.py
```

Then restart the backend server.

##Symptoms That Might Indicate You Need to Rollback

1. **Slow message sending** - Admin agent check might be timing out
2. **500 errors when chatting** - The Supabase API call might be failing
3. **Agents not responding** - The direct RAG response might have bugs
4. **Backend crashes** - The httpx synchronous call might cause issues

## How to Test After Rollback

1. Restart the backend
2. Try chatting with an admin agent (like Coluche)
3. Check backend logs for orchestrator messages
4. Verify responses are working

## Better Solution: Fix the Root Cause

Instead of rollback, you could improve the admin check by:

1. **Use a hardcoded admin user ID** instead of API lookup
2. **Make the check async** to avoid blocking
3. **Add better error handling** with fallbacks
4. **Cache results more aggressively**

Let me know if you want me to implement any of these improvements!


