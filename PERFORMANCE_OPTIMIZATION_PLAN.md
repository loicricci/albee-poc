# App Page Performance Optimization Plan

## Executive Summary

The app page is experiencing slow loading times due to multiple issues:
1. **6+ redundant API calls** on every page load/refresh
2. **No client-side caching** - same data fetched repeatedly
3. **Multiple database N+1 queries** in unified feed endpoint
4. **No progressive loading** - everything loads at once
5. **Authentication race conditions** - 401 errors followed by retries

## Current Performance Issues

### 1. Frontend Issues

#### Multiple Redundant API Calls
From terminal logs, on a single page refresh we see:
```
GET /config (called 3-5 times)
GET /me/profile (called 3-4 times)
GET /me/avees (called 2-3 times)
GET /avees?limit=5 (called 2-3 times)
GET /feed?limit=10 (called 2 times)
GET /feed/unified?limit=20 (called 2 times)
GET /onboarding/status (called 2 times)
```

**Root Cause:**
- `NewLayoutWrapper` component fetches profile and config
- App page fetches the same data again
- Both components don't share state
- No request deduplication

#### Auth Race Conditions
Multiple 401 Unauthorized errors followed by successful retries:
```
INFO: GET /feed?limit=10 HTTP/1.1 401 Unauthorized
INFO: GET /me/profile HTTP/1.1 401 Unauthorized
```
Then immediately followed by successful calls with auth token.

**Root Cause:**
- API calls fire before auth token is ready
- No request queuing/waiting mechanism

### 2. Backend Issues

#### Database N+1 Queries in Unified Feed

Current flow in `/feed/unified`:
1. Query all followed agents (1 query)
2. Query all owned agents (1 query)
3. Query updates for all agents (1 query with JOIN)
4. Query read status (1 query)
5. Query agent posts (1 query with JOIN)
6. Query user posts (1 query with JOIN)
7. Query reposts (1 query with multi-JOIN)
8. Query like status for all posts (1 query)
9. **Additional query per repost** to get post owner profile (N queries)

Line 770 in `feed.py`:
```python
# This runs inside a loop - N+1 query!
post_owner = db.query(Profile).filter(Profile.user_id == post.owner_user_id).first()
```

#### Missing Database Indexes
No indexes on:
- `agent_followers.follower_user_id`
- `post_likes.user_id`
- `post_shares.user_id`
- `update_read_status.user_id`

### 3. Architecture Issues

#### No Caching Layer
- Every page load hits the database
- Same queries executed repeatedly
- No Redis/memcached layer

#### No Request Batching
- Frontend makes sequential requests
- Could batch related requests together
- Network latency multiplied by number of calls

## Optimization Plan

### Phase 1: Quick Wins (Immediate - 1-2 hours)

#### 1.1 Fix API Call Redundancy ⚡ HIGH IMPACT

**Problem:** Multiple components fetch same data independently

**Solution:** 
- Share auth/profile state via React Context
- Implement request deduplication
- Move all data fetching to App page level

**Implementation:**
```typescript
// Create AppDataContext.tsx
export const AppDataContext = createContext<AppData | null>(null);

// In app/page.tsx - single source of truth
const AppDataProvider = ({ children }) => {
  const [data, setData] = useState<AppData | null>(null);
  
  useEffect(() => {
    loadAppData(); // Single fetch for all data
  }, []);
  
  return <AppDataContext.Provider value={data}>{children}</AppDataContext.Provider>;
};

// In NewLayoutWrapper - consume context instead of fetching
const profile = useContext(AppDataContext)?.profile;
```

**Expected Impact:** Reduce API calls from 20-30 per page load to 6-8 (3-4x reduction)

#### 1.2 Implement Stale-While-Revalidate Cache ⚡ HIGH IMPACT

**Problem:** No client-side caching of API responses

**Solution:**
- Extend localStorage cache with TTL and background revalidation
- Show cached data immediately, update in background

**Implementation:**
```typescript
// lib/apiCache.ts
const CACHE_TTL = {
  profile: 5 * 60 * 1000,      // 5 minutes
  config: 30 * 60 * 1000,       // 30 minutes
  feed: 2 * 60 * 1000,          // 2 minutes
  recommendations: 10 * 60 * 1000 // 10 minutes
};

export async function cachedFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl: number
): Promise<T> {
  const cached = getCacheItem(key);
  
  if (cached && !isStale(cached, ttl)) {
    // Cache hit - return immediately
    return cached.data;
  }
  
  if (cached && isStale(cached, ttl)) {
    // Stale cache - return stale data and revalidate in background
    revalidateInBackground(key, fetcher);
    return cached.data;
  }
  
  // Cache miss - fetch and store
  const data = await fetcher();
  setCacheItem(key, data);
  return data;
}
```

**Expected Impact:** 
- Initial load: 200-500ms faster (cache hit)
- Subsequent loads: 1-2s faster
- Reduced server load by 60-70%

#### 1.3 Fix Auth Race Conditions

**Problem:** API calls before auth token is ready

**Solution:** 
- Create auth-ready promise
- Queue requests until auth is ready

**Implementation:**
```typescript
// lib/authQueue.ts
let authReadyPromise: Promise<string> | null = null;

export async function getAuthToken(): Promise<string> {
  if (!authReadyPromise) {
    authReadyPromise = supabase.auth.getSession().then(
      ({ data }) => data.session?.access_token || ''
    );
  }
  return authReadyPromise;
}

// Use in API calls
const token = await getAuthToken(); // Will wait if needed
```

**Expected Impact:** Eliminate 401 errors and retries (save 500-1000ms per failed request)

### Phase 2: Backend Optimizations (1-2 hours)

#### 2.1 Fix N+1 Query in Unified Feed ⚡ HIGH IMPACT

**Problem:** Line 770 queries post owner inside loop

**Solution:** Preload all post owners in a single query

**Implementation:**
```python
# backend/feed.py line 653 - After user_posts query
# Step 4.1: Preload all post owner profiles
all_post_owner_ids = list(set(
    [p[0].owner_user_id for p in agent_posts] + 
    [p[0].owner_user_id for p in user_posts] +
    [r[1].owner_user_id for r in reposts]
))

post_owners_map = {}
if all_post_owner_ids:
    post_owners = (
        db.query(Profile)
        .filter(Profile.user_id.in_(all_post_owner_ids))
        .all()
    )
    post_owners_map = {p.user_id: p for p in post_owners}

# Then at line 770, replace query with dict lookup:
post_owner = post_owners_map.get(post.owner_user_id)
```

**Expected Impact:** Reduce DB queries from N+7 to 8 total (save 50-200ms depending on N)

#### 2.2 Add Database Indexes ⚡ HIGH IMPACT

**Problem:** Full table scans on foreign key lookups

**Solution:** Add indexes on frequently queried columns

**Create migration:** `backend/add_feed_indexes.sql`
```sql
-- Add indexes for feed queries
CREATE INDEX IF NOT EXISTS idx_agent_followers_follower_user_id 
  ON agent_followers(follower_user_id);

CREATE INDEX IF NOT EXISTS idx_agent_followers_avee_id 
  ON agent_followers(avee_id);

CREATE INDEX IF NOT EXISTS idx_post_likes_user_id 
  ON post_likes(user_id);

CREATE INDEX IF NOT EXISTS idx_post_likes_post_id 
  ON post_likes(post_id);

CREATE INDEX IF NOT EXISTS idx_post_shares_user_id 
  ON post_shares(user_id);

CREATE INDEX IF NOT EXISTS idx_post_shares_post_id 
  ON post_shares(post_id);

CREATE INDEX IF NOT EXISTS idx_update_read_status_user_id 
  ON update_read_status(user_id);

CREATE INDEX IF NOT EXISTS idx_update_read_status_update_id 
  ON update_read_status(update_id);

CREATE INDEX IF NOT EXISTS idx_agent_updates_avee_id 
  ON agent_updates(avee_id);

CREATE INDEX IF NOT EXISTS idx_posts_agent_id 
  ON posts(agent_id);

CREATE INDEX IF NOT EXISTS idx_posts_owner_user_id 
  ON posts(owner_user_id);

-- Composite index for common query patterns
CREATE INDEX IF NOT EXISTS idx_posts_visibility_created 
  ON posts(visibility, created_at DESC);
```

**Expected Impact:** 
- Feed queries: 50-80% faster
- Overall: 300-800ms faster for users with many follows

#### 2.3 Batch Related Queries

**Problem:** Sequential independent queries

**Solution:** Use SQLAlchemy's eager loading and query optimization

**Implementation:**
```python
# backend/feed.py - Use selectinload for relationships
from sqlalchemy.orm import selectinload

# Instead of separate queries, use eager loading
agents_with_updates = (
    db.query(Avee)
    .options(
        selectinload(Avee.updates),
        selectinload(Avee.owner)
    )
    .filter(Avee.id.in_(all_agent_ids))
    .all()
)
```

**Expected Impact:** Reduce query count by 30-40%

### Phase 3: Progressive Loading (2-3 hours)

#### 3.1 Implement Progressive Data Loading

**Problem:** Everything loads at once - users wait for everything

**Solution:** Load critical data first, then progressive enhancement

**Implementation:**
```typescript
// 1. Load skeleton + cached data immediately (0ms)
// 2. Load critical data (profile + auth) (100-200ms)
// 3. Load feed data in background (200-500ms)
// 4. Load recommendations last (500ms+)

useEffect(() => {
  // Phase 1: Show skeleton + cache
  setLoadingState('skeleton');
  showCachedData();
  
  // Phase 2: Critical data
  loadCriticalData().then(() => {
    setLoadingState('partial');
    
    // Phase 3: Feed data (background)
    loadFeedData().then(() => {
      setLoadingState('complete');
      
      // Phase 4: Non-critical data (background)
      loadRecommendations();
    });
  });
}, []);
```

**Expected Impact:** 
- Perceived load time: 80-100ms (cache + skeleton)
- Time to interactive: 200-300ms (vs 2-3s currently)

#### 3.2 Add Loading Skeletons

**Problem:** Blank screen during load

**Solution:** Show skeletons immediately

Already implemented (`FeedLoadingSkeleton`) but need to show it faster.

### Phase 4: Advanced Optimizations (Future)

#### 4.1 Add Redis Caching Layer
- Cache feed results for 1-2 minutes
- Cache user profiles for 5 minutes
- Invalidate on updates

#### 4.2 Implement GraphQL or similar
- Single request for all data
- Client specifies exactly what's needed
- Reduce over-fetching

#### 4.3 Add CDN for Static Assets
- Images, avatars, etc.
- Reduce latency for global users

#### 4.4 Database Query Optimization
- Add materialized views for complex aggregations
- Implement pagination cursor instead of offset
- Consider read replicas for heavy read operations

## Implementation Priority

### Immediate (Do Now) - 2-3 hours total
1. ✅ Fix API call redundancy (1 hour)
2. ✅ Implement stale-while-revalidate cache (30 min)
3. ✅ Fix N+1 query in unified feed (30 min)
4. ✅ Add database indexes (20 min)
5. ✅ Fix auth race conditions (30 min)

**Expected Impact:** 60-80% faster load times

### Short-term (This Week) - 2-3 hours
1. Progressive loading implementation
2. Query batching optimization
3. Better error handling and retry logic

**Expected Impact:** 85-90% faster perceived load times

### Medium-term (Next 2 weeks)
1. Redis caching layer
2. API response compression
3. Lazy loading for images

### Long-term (Future)
1. GraphQL migration
2. CDN integration
3. Database read replicas

## Success Metrics

### Before Optimization (Current)
- **Cold load:** 3-5 seconds
- **Warm load:** 2-3 seconds
- **API calls per load:** 20-30
- **Database queries per request:** 15-20
- **401 errors per load:** 5-10

### After Phase 1 (Target)
- **Cold load:** 1-1.5 seconds ✅ 60-70% improvement
- **Warm load:** 300-500ms ✅ 75-85% improvement
- **API calls per load:** 6-8 ✅ 70% reduction
- **Database queries per request:** 8-10 ✅ 50% reduction
- **401 errors per load:** 0 ✅ 100% elimination

### After Phase 3 (Target)
- **Perceived load time:** 80-150ms (skeleton + cache)
- **Time to interactive:** 200-400ms
- **Complete load:** 500-800ms

## Testing Plan

1. **Before measurements:**
   - Use Chrome DevTools Performance tab
   - Record Network waterfall
   - Count API calls and timing

2. **After each optimization:**
   - Re-measure all metrics
   - Compare to baseline
   - Verify no regressions

3. **Load testing:**
   - Test with slow 3G network
   - Test with many followed agents (50+)
   - Test with empty state

## Rollout Strategy

1. **Development:**
   - Implement each optimization
   - Test locally
   - Verify improvements

2. **Staging:**
   - Deploy to staging environment
   - Run load tests
   - Verify no bugs

3. **Production:**
   - Deploy during low-traffic period
   - Monitor error rates
   - Have rollback plan ready

## Conclusion

The app is experiencing slow load times primarily due to:
1. Redundant API calls (biggest issue)
2. No client-side caching
3. Database N+1 queries
4. Auth race conditions

By implementing Phase 1 optimizations (3 hours of work), we can achieve **60-80% improvement in load times** with minimal risk.

The most impactful single change is fixing the API call redundancy by implementing shared state management, which alone could provide 40-50% improvement.


