# Follower Sidebar Proposition Fix

## Issue Description

The follower proposition sidebar on the app home page (`/app`) was showing agents that the current user was already following. For example, admin user "loic" was already following "Elton John", but Elton John was still appearing in the "Recommended" sidebar section.

## Root Cause

The `/avees` endpoint in `backend/main.py` (used by the app page to fetch recommendations) was only filtering out agents owned by the current user, but **not filtering out agents that the user was already following**.

### Previous Implementation (Lines 997-1028)

```python
@app.get("/avees")
def list_all_avees(
    limit: int = 20,
    offset: int = 0,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    """Get random public agents for discovery/recommendations, excluding the current user's agents"""
    user_uuid = _parse_uuid(user_id, "user_id")
    
    limit = min(limit, 100)
    
    # ❌ Only excludes agents owned by current user
    rows = (
        db.query(Avee)
        .filter(Avee.owner_user_id != user_uuid)  # Only this filter!
        .order_by(func.random())
        .limit(limit)
        .offset(offset)
        .all()
    )
    
    return [...]
```

## Solution

Updated the `/avees` endpoint to:
1. Query the `agent_followers` table to get all agent IDs that the user is already following
2. Exclude those agents from the recommendations query using `~Avee.id.in_(...)`

### New Implementation

```python
@app.get("/avees")
def list_all_avees(
    limit: int = 20,
    offset: int = 0,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    """Get random public agents for discovery/recommendations, excluding the current user's agents and already-followed agents"""
    user_uuid = _parse_uuid(user_id, "user_id")
    
    limit = min(limit, 100)
    
    # ✅ Get list of agent IDs the user is already following
    followed_agent_ids = (
        db.query(AgentFollower.avee_id)
        .filter(AgentFollower.follower_user_id == user_uuid)
        .all()
    )
    followed_ids = [str(f.avee_id) for f in followed_agent_ids]
    
    # ✅ Build query excluding both owned and followed agents
    query = (
        db.query(Avee)
        .filter(Avee.owner_user_id != user_uuid)
    )
    
    # ✅ Exclude already followed agents
    if followed_ids:
        query = query.filter(~Avee.id.in_([uuid.UUID(fid) for fid in followed_ids]))
    
    rows = (
        query
        .order_by(func.random())
        .limit(limit)
        .offset(offset)
        .all()
    )
    
    return [...]
```

## Key Changes

1. **Added following check**: Query `AgentFollower` table to get all agents the user follows
2. **Filter logic**: Use SQLAlchemy's `~Avee.id.in_()` to exclude followed agents
3. **Updated docstring**: Clarified that both owned and followed agents are excluded

## Database Tables Used

- **`avees`**: Contains all agent profiles
- **`agent_followers`**: Junction table tracking which users follow which agents
  - `follower_user_id`: The user who is following
  - `avee_id`: The agent being followed

## Testing

The backend server automatically reloaded with the changes (using uvicorn's `--reload` flag).

### To Verify:
1. Log in as "loic" (admin user)
2. Navigate to `/app` page
3. Check the "Recommended" sidebar on the left
4. Verify that Elton John (and other already-followed agents) no longer appear in recommendations
5. Only unfollowed agents should be shown

## Related Code

- **Frontend**: `/frontend/src/app/(app)/app/page.tsx` (line 903)
  - Fetches recommendations via: `apiGet<Recommendation[]>("/avees?limit=5", token)`
- **Backend**: `/backend/main.py` (lines 997-1044)
  - The fixed `/avees` endpoint
- **Model**: `/backend/models.py` (lines 128-134)
  - `AgentFollower` table definition

## Notes

- The network page (`/network`) uses a different endpoint (`/network/search-agents`) which already has proper filtering with an `include_followed=false` parameter
- This fix only affects the app home page sidebar recommendations
- The fix preserves the random ordering of recommendations for variety



