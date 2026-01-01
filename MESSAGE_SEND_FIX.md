# Message Send Fix - December 27, 2025

## Problem
Users were receiving a "Failed to send message" error when trying to send messages in the messaging interface. The frontend showed an error dialog and messages wouldn't send.

## Root Cause
The messaging system uses an "Orchestrator" that intelligently routes messages and decides how the agent should respond. The Orchestrator tries to search for canonical answers in a database table called `canonical_answers`, but this table didn't exist in the database yet.

When the database query failed:
1. The orchestrator code caught the exception and returned `None`
2. However, the database transaction was left in a failed state
3. When the code tried to save a system message afterwards, it failed because the transaction was already aborted
4. This caused a 500 Internal Server Error, which the frontend displayed as "Failed to send message"

### Technical Details
```
Error: psycopg2.errors.UndefinedTable: relation "canonical_answers" does not exist
Location: backend/orchestrator.py line 161, called from backend/messaging.py line 157
```

## Solution

### 1. Run Database Migration
Created and ran the orchestrator system migration that creates the missing tables:
- `orchestrator_configs` - Stores creator-defined rules and settings per agent
- `escalation_queue` - Tracks escalation requests from users to creators
- `orchestrator_decisions` - Logs every routing decision for analytics
- `canonical_answers` - Stores creator answers that can be reused for similar questions

Command used:
```bash
python run_orchestrator_migration.py
```

### 2. Fix Transaction Management
Added proper transaction rollback in the error handler to prevent database transaction state issues:

**File**: `backend/messaging.py`
**Line**: 231-236

Added `db.rollback()` in the exception handler of `_handle_agent_response()` to ensure that when an error occurs, the database transaction is rolled back cleanly, allowing subsequent operations to succeed.

## Files Modified
1. **Created**: `run_orchestrator_migration.py` - Script to run the database migration
2. **Modified**: `backend/messaging.py` - Added transaction rollback in error handler
3. **Applied**: `database_migrations/orchestrator_system.sql` - Created orchestrator tables

## Verification
After applying the fix:
1. The backend server automatically reloaded (uvicorn --reload)
2. The `canonical_answers` table now exists in the database
3. Message sending should work correctly
4. If the orchestrator encounters any errors, the transaction is properly rolled back

## Testing
To test the fix:
1. Navigate to `/messages` in the application
2. Select or create a conversation
3. Type a message and send it
4. The message should send successfully without errors

**UPDATE**: After fixing the initial send error, a second issue was discovered where agents weren't replying. See `AGENT_REPLY_FIX.md` for the follow-up fix.

## Related Systems
This fix enables the full Orchestrator system which provides:
- Path A: Auto-answer with RAG (Retrieval Augmented Generation)
- Path B: Clarification questions for vague queries
- Path C: Canonical answer reuse for similar questions
- Path D: Escalation offers for novel/complex questions
- Path E: Queue for human response when AI lacks context
- Path F: Polite refusal when limits are reached

## Future Considerations
- Monitor the orchestrator_decisions table for analytics on routing patterns
- Consider adding retry logic for transient database errors
- Add database migration version tracking for better deployment management

