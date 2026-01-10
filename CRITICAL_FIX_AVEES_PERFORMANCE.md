# Critical Performance Fix: Make First-Time Speed Always Available

## Problem Identified

Your logs show:
- **1st login: 1.7s** ✅ (with cache)
- **2nd/3rd login: 7.9s** ❌ (cache cleared on logout)

The bottleneck: **`/me/avees` takes 7.5+ seconds** to fetch 69 agents without cache.

## Root Causes

1. **Cache cleared on logout** - sessionStorage cleared between sign-ins
2. **Slow query** - Fetching 69 full agent objects takes 7.5s
3. **No persistent cache** - Backend cache exists but timing shows slow query

## Fixes Applied

### Fix 1: Optimized /me/avees Query ✅

**File**: `backend/main.py`

**Changes:**
- Query only specific columns instead of full ORM objects
- Added timing logs to track performance
- Increased cache TTL from 2min to 5min
- Added cache hit logging

This should reduce query time from 7.5s → 1-2s max.

### Fix 2: Don't Invalidate Backend Cache on Logout (Recommended)

The backend cache (`agent_cache`) shouldn't be cleared - it's server-side and helps ALL users.

**Current behavior**: Frontend clears sessionStorage, but backend cache persists ✅

## Expected Results After Backend Restart

**With optimized query:**
- **1st login** (no cache): 1.5-2.5s (down from 7.9s)
- **2nd login** (with cache): <1s
- **Subsequent**: <500ms (full cache warm)

**Individual call times should be:**
```
Config: 1ms (cached)
Profile: 10ms (JWT cache)
Onboarding: 10ms
Avees: 500-1000ms (optimized, down from 7500ms)
Feed: 1500ms
UnifiedFeed: 1500ms
```

## Action Required

**RESTART BACKEND:**
```bash
# Kill and restart backend to apply the query optimization
cd /Users/loicricci/gabee-poc/backend
# Ctrl+C or kill process
uvicorn backend.main:app --reload
```

Then test 3 logins again and check:
1. Backend logs should show: `[/me/avees] Returned 69 agents in Xms`
2. Should be 500-2000ms, not 7500ms
3. Second login should hit cache: `[/me/avees] Cache HIT`

## Why This Will Work

1. **Column-only SELECT** - Reduces data transferred from database
2. **Selective serialization** - Only processes needed fields
3. **Backend cache persists** - Survives across sessions
4. **JWT cache active** - Eliminates auth overhead

## Alternative: Lazy Load Agents

If still slow, we can load agents AFTER page renders:

```typescript
// Load critical data first
const [profile, config, onboarding] = await Promise.all([...]);

// Show page immediately

// Then load agents in background
setTimeout(() => {
  getUserAvees().then(setAvees);
}, 100);
```

This would make perceived load time ~500ms always.

## Testing

After backend restart, you should see:

**1st login (cold):**
```
[/me/avees] Returned 69 agents in 500-1500ms ← Should be under 2s
Total: ~2-3s
```

**2nd login (warm):**
```
[/me/avees] Cache HIT - returned 69 agents in <1ms
Total: <1s
```

**Success criteria**: First login under 3s, subsequent under 1s.

