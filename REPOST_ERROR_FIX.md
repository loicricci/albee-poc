# Repost/Comment/Like Error Fix

## Problem

The frontend was showing "Failed to fetch" errors when trying to repost, comment, or like posts. The backend was returning `500 Internal Server Error` due to a database transaction issue.

## Root Cause

The `notifications` table doesn't exist in the database (migration not run). When the backend tried to create notifications for reposts, comments, and likes, it failed with:

```
(psycopg2.errors.UndefinedTable) relation "notifications" does not exist
```

This caused a `PendingRollbackError` because:
1. The share/comment/like was successfully committed to the database
2. The code tried to create a notification, which failed
3. The database session entered a rolled-back state
4. When trying to access the created object's ID, SQLAlchemy attempted to refresh it
5. This refresh failed because the session was in a bad state

## Solution Applied

Fixed the backend code to handle notification failures gracefully:

### 1. Posts API (`backend/posts_api.py`)

**Share/Repost endpoint:**
- Store share ID before attempting notification
- Add `db.rollback()` in the exception handler
- Return the stored share ID instead of accessing it after potential failure

**Comment endpoint:**
- Store comment ID before attempting notification  
- Add `db.rollback()` in the exception handler
- Return the stored comment ID instead of accessing it after potential failure

**Like endpoint:**
- Add `db.rollback()` in the exception handler

### 2. Messaging API (`backend/messaging.py`)

- Add `db.rollback()` in notification error handler

### 3. Agent Updates API (`backend/agent_updates.py`)

- Add `db.rollback()` in notification error handler

### 4. Post Creation Service (`backend/post_creation_service.py`)

- Add `db.rollback()` in autopost notification error handler

## Changes Made

1. **Store IDs early**: For share and comment endpoints, we now store the ID immediately after committing, before attempting to create notifications.

2. **Explicit rollback**: Added `db.rollback()` in all notification exception handlers to clean up the failed transaction state.

3. **Safe return**: Return the stored ID value instead of accessing the object attribute after a potential transaction failure.

## Testing

The repost, comment, and like features should now work correctly even though the notifications table doesn't exist. The operations will succeed, but notifications simply won't be created (with error messages logged in the backend).

## Long-term Solution

To fully enable notifications, run the migration:

```bash
# Navigate to the database migrations directory
cd database_migrations

# Run the notification table migration
psql $DATABASE_URL -f 010_create_notifications_table.sql
```

This will create the `notifications` table and enable the full notification feature.

## Files Modified

- `backend/posts_api.py` - Fixed share, comment, and like endpoints
- `backend/messaging.py` - Fixed message notification handler
- `backend/agent_updates.py` - Fixed update notification handler
- `backend/post_creation_service.py` - Fixed autopost notification handler

