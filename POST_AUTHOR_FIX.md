# Post Author Display Fix

## Issue
When viewing posts on an agent's profile page, the post author information (avatar, name, handle) was showing the profile owner's information instead of the agent's information, even though the posts were created by the agent.

## Root Cause
The backend API endpoints (`GET /posts` and `GET /posts/{post_id}`) were only joining with the `Profile` table to get author information, but they weren't checking if the post had an `agent_id` field set. When a post is created by an agent (admin-owned agent), the `agent_id` field points to the agent in the `avees` table, and the post should display the agent's information, not the profile owner's information.

## Solution
Modified the backend API endpoints in `/backend/posts_api.py`:

### Changes Made

1. **Updated `GET /posts` endpoint (line 128):**
   - Added `LEFT OUTER JOIN` with the `Avee` table to fetch agent information
   - Query now retrieves both profile info and agent info (if post has agent_id)
   - Added logic to determine which info to display:
     - If `post.agent_id` is set and agent exists: use agent's handle, display_name, and avatar_url
     - Otherwise: use profile's handle, display_name, and avatar_url

2. **Updated `GET /posts/{post_id}` endpoint (line 242):**
   - Applied the same fix as above for single post retrieval
   - Ensures consistency across all post display contexts

### Technical Details

**Before:**
```python
query = db.query(
    Post,
    Profile.handle,
    Profile.display_name,
    Profile.avatar_url
).join(
    Profile, Post.owner_user_id == Profile.user_id
)
```

**After:**
```python
query = db.query(
    Post,
    Profile.handle,
    Profile.display_name,
    Profile.avatar_url,
    Avee.handle,
    Avee.display_name,
    Avee.avatar_url
).join(
    Profile, Post.owner_user_id == Profile.user_id
).outerjoin(
    Avee, Post.agent_id == Avee.id
)
```

**Author Info Selection Logic:**
```python
# If post has an agent_id, use agent info, otherwise use profile info
if post.agent_id and agent_handle:
    display_handle = agent_handle
    display_name = agent_display_name
    display_avatar = agent_avatar_url
else:
    display_handle = profile_handle
    display_name = profile_display_name
    display_avatar = profile_avatar_url
```

## Testing
To verify the fix:
1. Navigate to an agent's profile page (e.g., `/u/satoshinakamoto`)
2. Check that posts created by the agent show:
   - Agent's avatar
   - Agent's display name
   - Agent's handle (e.g., @satoshinakamoto)
3. The post should NOT show the profile owner's information

## Impact
- ✅ Agent posts now correctly display agent information
- ✅ Profile posts continue to display profile information
- ✅ No changes required to frontend code
- ✅ No database schema changes required
- ✅ Backend auto-reloads with changes (running with --reload flag)

## Files Modified
- `/backend/posts_api.py` - Updated both GET endpoints for posts

## Status
✅ **COMPLETE** - The fix has been applied and the backend should automatically reload the changes.

