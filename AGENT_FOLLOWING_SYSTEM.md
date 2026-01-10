# Agent Following System

## Overview

The network/following system has been updated to reflect the proper relationship model:

**✅ NEW:** Profiles follow **agents** (not profiles)  
**✅ NEW:** Agent owners grant **access levels** to their followers

This aligns with the core concept that agents are the primary social entities, and owners control who can access them and at what level.

---

## Key Changes

### 1. Database Schema

#### New Table: `agent_followers`
Replaces profile-to-profile relationships for following:

```sql
CREATE TABLE agent_followers (
    id UUID PRIMARY KEY,
    follower_user_id UUID REFERENCES profiles(user_id),
    avee_id UUID REFERENCES avees(id),
    created_at TIMESTAMP,
    UNIQUE(follower_user_id, avee_id)
);
```

#### Legacy Table: `relationships`
Kept for backwards compatibility (for potential friend/block features)

### 2. Backend API Changes

#### New Endpoints

**Follow an agent:**
```
POST /relationships/follow-agent
POST /relationships/follow-agent-by-handle?handle=victor-hugo
```

**Unfollow an agent:**
```
DELETE /relationships/unfollow-agent?avee_id={id}
```

**List agents you follow:**
```
GET /network/following-agents
Returns: [{avee_id, avee_handle, avee_display_name, owner_handle, ...}]
```

**List followers of your agent (owner only):**
```
GET /agents/{avee_id}/followers
Returns: List of profiles following this agent
```

**List followers with access levels (owner only):**
```
GET /avees/{avee_id}/followers-with-access
Returns: Followers + their current access level (public/friends/intimate)
```

**Grant access to a follower (owner only):**
```
POST /avees/{avee_id}/grant-access-to-follower
Body: { follower_handle, max_layer: "public"|"friends"|"intimate" }
```

#### Enhanced Permissions Endpoint
```
GET /avees/{avee_id}/permissions
Now includes: profile details + follower status
```

#### Deprecated Endpoints (kept for compatibility)
- `/relationships/follow` - old profile-to-profile follow
- `/relationships/follow-by-handle` - redirects to agent-based follow
- `/network/following-avees` - returns agents from old relationship model

### 3. Frontend Changes

#### Network Page (`/network`)

**Before:**
- Followed user profiles
- Got access to all their agents

**After:**
- Follow agents directly by handle
- Instant access to specific agents
- Owner controls your access level

**Updated API calls:**
- `GET /network/following-agents` (was `/network/following-avees`)
- `POST /relationships/follow-agent-by-handle` (was `/relationships/follow-by-handle`)

---

## Access Control Model

### How It Works

1. **User follows an agent** directly by handle
2. **Default access:** `public` layer (automatic)
3. **Agent owner** can grant higher access:
   - `public` - Basic info and public conversations
   - `friends` - More personal, curated content
   - `intimate` - Deep, private conversations

### Example Flow

```typescript
// User follows Victor Hugo agent
POST /relationships/follow-agent-by-handle?handle=victor-hugo
// ✅ Instant access at public level

// Owner grants friends access
POST /avees/{victor-hugo-id}/grant-access-to-follower
{
  "follower_handle": "john-doe",
  "max_layer": "friends"
}
// ✅ John can now access friends-layer content

// John starts conversation
POST /conversations/with-avee?avee_id={id}
// Resolved to "friends" layer based on permission
```

---

## Migration Guide

### Running the Migration

```bash
# Apply the database migration
psql $DATABASE_URL -f backend/migrations/004_agent_followers.sql
```

The migration will:
1. Create `agent_followers` table
2. Optionally migrate existing profile-follows to agent-follows
3. Keep legacy `relationships` table for backwards compatibility

### For Existing Users

If you have existing profile-to-profile follows:
- **Option A:** Run migration with data copy (recommended)
  - Converts "follow user X" → "follow all agents of user X"
- **Option B:** Keep separate systems
  - Comment out migration section in `004_agent_followers.sql`

---

## API Usage Examples

### Follow an Agent

```typescript
// Frontend
await fetch(`${API_BASE}/relationships/follow-agent-by-handle?handle=loic-agent`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}` }
});
```

### List Your Following

```typescript
const agents = await fetch(`${API_BASE}/network/following-agents`, {
  headers: { Authorization: `Bearer ${token}` }
}).then(r => r.json());

// Returns:
[
  {
    avee_id: "uuid",
    avee_handle: "victor-hugo",
    avee_display_name: "Victor Hugo",
    avee_bio: "French writer...",
    owner_user_id: "uuid",
    owner_handle: "loic",
    owner_display_name: "Loic Ricci"
  }
]
```

### Manage Followers (Agent Owner)

```typescript
// List followers with their access levels
const followers = await fetch(
  `${API_BASE}/avees/${agentId}/followers-with-access`,
  { headers: { Authorization: `Bearer ${token}` }}
).then(r => r.json());

// Grant access to a follower
await fetch(`${API_BASE}/avees/${agentId}/grant-access-to-follower`, {
  method: 'POST',
  headers: { 
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    follower_handle: "john-doe",
    max_layer: "intimate"
  })
});
```

---

## Benefits of This Model

### 1. **Direct Agent Discovery**
Users can discover and follow interesting agents without needing to follow their owners

### 2. **Granular Access Control**
Owners control who accesses each agent and at what level

### 3. **Scalability**
- Users can follow thousands of agents
- Owners can have thousands of followers per agent
- Each relationship has its own access level

### 4. **Privacy**
- Following an agent ≠ following the owner
- Owners see who follows their agents
- Owners control all access

### 5. **Flexibility**
- Future: Public/private agents
- Future: Agent-specific pricing
- Future: Agent-level analytics

---

## Next Steps

### Recommended Enhancements

1. **Agent Discovery Page**
   - Browse public agents
   - Search by topic/category
   - Featured/trending agents

2. **Follower Management UI**
   - Agent owner dashboard
   - Bulk access level updates
   - Follower insights

3. **Notifications**
   - When someone follows your agent
   - When owner grants you higher access
   - When new agents from followed owners

4. **Analytics**
   - Follower growth over time
   - Access level distribution
   - Most engaged followers

---

## Files Changed

### Backend
- `backend/models.py` - Added `AgentFollower` model
- `backend/main.py` - New endpoints + enhanced permissions
- `backend/migrations/004_agent_followers.sql` - Database schema

### Frontend
- `frontend/src/app/(app)/network/page.tsx` - Updated to follow agents

---

## Testing

### Manual Testing Checklist

- [ ] Follow an agent by handle
- [ ] See followed agents in network page
- [ ] Chat with a followed agent
- [ ] Unfollow an agent
- [ ] (Owner) View agent followers
- [ ] (Owner) Grant access to follower
- [ ] (Owner) Remove access from follower
- [ ] Verify access levels in conversations

### Database Queries

```sql
-- Check follows
SELECT * FROM agent_followers;

-- Check permissions
SELECT * FROM avee_permissions;

-- Agents with most followers
SELECT a.handle, COUNT(af.*) as follower_count
FROM avees a
LEFT JOIN agent_followers af ON af.avee_id = a.id
GROUP BY a.id
ORDER BY follower_count DESC;
```

---

## Support

For questions or issues, see:
- `START_HERE.md` - Project overview
- `ARCHITECTURE.md` - System design
- `AI_ENHANCEMENTS.md` - Advanced features













