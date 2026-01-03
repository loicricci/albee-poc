# Admin Agent Orchestrator Bypass Fix

## Problem

When chatting with agents that belong to an admin user (loic.ricci@gmail.com), the orchestrator was still being queried. This is incorrect behavior because:

1. Admin agents (like Coluche, Elton John, Frankenstein's Monster, etc.) are system agents
2. They should respond directly using RAG without going through the orchestrator
3. The orchestrator is designed for user-created agents where escalation and content moderation is needed
4. Admin agents don't need escalation - they should always respond immediately with their knowledge base

## Root Cause

In `backend/messaging.py`, the `_handle_agent_response()` function was always routing messages through the orchestrator engine without checking if the agent belonged to an admin user.

Similarly, the `stream_message()` function only had "owner mode" (when the user owns the agent they're chatting with), but no "admin agent mode" (when chatting with admin-owned agents).

## Solution

### 1. Added Admin Agent Detection

Created a new helper function `_is_admin_agent()` that:
- Takes a database session and agent ID
- Looks up the agent's owner
- Queries Supabase to get the owner's email
- Checks if the email is in the `ADMIN_EMAILS` list
- Returns `True` if the agent is owned by an admin

```python
ADMIN_EMAILS = ["loic.ricci@gmail.com"]

def _is_admin_agent(db: Session, avee_id: uuid.UUID) -> bool:
    """Check if an agent belongs to an admin user."""
    # ... implementation
```

### 2. Added Direct Response Handler

Created a new function `_handle_direct_agent_response()` that:
- Bypasses the orchestrator entirely
- Uses direct RAG (Retrieval Augmented Generation)
- Searches the agent's knowledge base
- Generates a response using GPT-4o-mini
- Stores the message and returns it
- Marks responses as "human_validated": true since admin agents are trusted

### 3. Modified Non-Streaming Message Flow

Updated `_handle_agent_response()` to:
- Check if the agent is an admin agent first
- If yes, call `_handle_direct_agent_response()` and return
- If no, proceed with orchestrator routing as before

```python
async def _handle_agent_response(...):
    # Check if this is an admin agent - if so, bypass orchestrator
    if _is_admin_agent(db, agent_id):
        print(f"[AGENT_RESPONSE] Admin agent detected {agent_id}, bypassing orchestrator")
        return await _handle_direct_agent_response(db, conversation, message, agent_id)
    
    # Otherwise, use orchestrator
    engine = OrchestratorEngine(db)
    decision = await engine.route_message(...)
```

### 4. Modified Streaming Message Flow

Updated `stream_message()` to:
- Detect admin agents in addition to owner mode
- Added new "admin_agent_direct" mode
- Admin agent mode streams responses directly using RAG
- Bypasses orchestrator completely
- Returns mode in the event stream for debugging

```python
is_owner = False
is_admin_agent = False
if recipient_agent:
    is_owner = (recipient_agent.owner_user_id == user_uuid)
    is_admin_agent = _is_admin_agent(db, recipient_agent.id)

# ADMIN AGENT MODE: Direct response without orchestrator
if is_admin_agent:
    # ... stream directly with RAG
    yield f"data: {json.dumps({'event': 'complete', 'mode': 'admin_agent_direct'})}\n\n"
```

## Impact

### Before
- User chats with Coluche → Orchestrator routes → May get escalation/clarification/refusal
- User chats with Elton John → Orchestrator routes → May get queued for human
- User chats with Frankenstein's Monster → Orchestrator routes → Unnecessary overhead

### After
- User chats with Coluche → Direct RAG response → Immediate answer
- User chats with Elton John → Direct RAG response → Immediate answer  
- User chats with Frankenstein's Monster → Direct RAG response → Immediate answer
- User chats with their own agent → Orchestrator routes (as designed)
- User chats with another user's agent → Orchestrator routes (as designed)

## Testing

To test the fix:

1. **Test admin agent (non-streaming)**:
```bash
# Chat with an admin agent like Coluche
POST /messaging/conversations/{conversation_id}/messages
{
  "content": "Peux tu parler en français?"
}
```

Check the backend logs for:
```
[AGENT_RESPONSE] Admin agent detected {agent_id}, bypassing orchestrator
```

2. **Test admin agent (streaming)**:
```bash
# Stream chat with an admin agent
POST /messaging/conversations/{conversation_id}/stream
{
  "content": "Tell me about your music"
}
```

Check the backend logs for:
```
[STREAM] Admin agent mode activated for agent {agent_id} - bypassing orchestrator
```

Check the stream events for:
```json
{"event": "complete", "mode": "admin_agent_direct"}
```

3. **Test regular agent (should still use orchestrator)**:
```bash
# Chat with a non-admin agent
POST /messaging/conversations/{conversation_id}/messages
{
  "content": "Hello"
}
```

Check the backend logs for:
```
[AGENT_RESPONSE] Starting orchestrator for user {user_id}, agent {agent_id}
[ORCHESTRATOR] Decision path: A, reason: High confidence AI can answer
```

## Files Modified

- `backend/messaging.py`:
  - Added `ADMIN_EMAILS` constant
  - Added `_is_admin_agent()` helper function
  - Added `_handle_direct_agent_response()` function
  - Modified `_handle_agent_response()` to check for admin agents
  - Modified `stream_message()` to handle admin agent mode

## Configuration

To add more admin emails, update the `ADMIN_EMAILS` list in `backend/messaging.py`:

```python
ADMIN_EMAILS = [
    "loic.ricci@gmail.com",
    "another.admin@example.com"
]
```

## Notes

- Admin agents are identified by their owner's email
- The email lookup uses Supabase Admin API (requires `SUPABASE_SERVICE_ROLE_KEY`)
- If the email lookup fails, the agent is treated as non-admin (safe default)
- Admin agent responses are marked as `human_validated: true`
- The orchestrator is still used for all non-admin agents (unchanged behavior)

## Related Files

- `backend/admin.py` - Contains the same `ALLOWED_ADMIN_EMAILS` list
- `backend/orchestrator.py` - The orchestrator engine (unchanged)
- `backend/models.py` - Agent (Avee) and Profile models (unchanged)






