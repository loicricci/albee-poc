# Performance Optimization Log - Login & App Load

## Problem Statement
Login and app loading time is inconsistent and often slow:
- **Target:** < 2 seconds total load time
- **Current:** Ranges from 3s (best case) to 14s (worst case)
- **Issue:** Inconsistent performance between login attempts

## Performance Observations

### Test Results Timeline

**First Test (After initial optimizations):**
- Total: 3.1s ✓ (acceptable but not consistent)

**Second Test:**
- Total: 7.6s ✗

**Third Test:**
- Total: 13.9s ✗
- Profile: 4095ms
- Phase 2 (Avees, Feed, UnifiedFeed): all blocked at ~9800ms

**Fourth Test (After double-auth fix):**
- Still slow (user reported no improvement)

### Key Findings

1. **Inconsistency is the main issue** - sometimes fast (3s), usually slow (7-14s)
2. **Backend queries are fast** - `/me/avees` completes in 1-2s, but frontend sees 9-10s
3. **Network/timing discrepancy** - Backend logs show fast completion, frontend sees long delays
4. **All Phase 2 requests block together** - They complete at nearly identical times (9772ms, 9800ms, 9800ms)

---

## Changes Implemented

### 1. Backend JWT Token Caching with Request Deduplication

**File:** `backend/auth_supabase.py`

**Problem:** Multiple concurrent API requests were all verifying the same JWT token with Supabase, causing race conditions and multiple external calls.

**Solution Implemented:**

```python
# Added imports
import asyncio
from typing import Dict

# Added deduplication tracking
_pending_verifications: Dict[str, asyncio.Task] = {}
_pending_full_verifications: Dict[str, asyncio.Task] = {}

# Refactored auth functions to use request deduplication
async def get_current_user_id(creds: HTTPAuthorizationCredentials = Depends(security)) -> str:
    token_hash = hashlib.sha256(creds.credentials.encode()).hexdigest()
    
    # Check cache
    if token_hash in token_cache:
        print(f"[JWT Cache] ✓ HIT - returning cached user_id")
        return token_cache[token_hash]
    
    # Check if already verifying
    if token_hash in _pending_verifications:
        print(f"[JWT Cache] ⏳ WAIT - joining in-flight verification")
        return await _pending_verifications[token_hash]
    
    # Start new verification
    print(f"[JWT Cache] ✗ MISS - verifying with Supabase")
    task = asyncio.create_task(_verify_token_with_supabase(token, token_hash))
    _pending_verifications[token_hash] = task
    
    try:
        return await task
    finally:
        _pending_verifications.pop(token_hash, None)
```

**Expected Impact:** Eliminate duplicate Supabase calls when multiple requests arrive simultaneously.

**Actual Result:** Request deduplication works (logs show cache HITs), but performance still inconsistent.

---

### 2. Eliminated Double Auth Dependencies

**File:** `backend/main.py`

**Problem:** Several endpoints had BOTH auth dependencies, causing 2 sequential Supabase calls:
```python
# BAD - causes 2 Supabase calls
def endpoint(
    user_id: str = Depends(get_current_user_id),  # Call 1
    user: dict = Depends(get_current_user),       # Call 2
):
```

**Fixed Endpoints:**
1. `GET /me/profile` (line 436)
2. `POST /me/profile` (line 503)
3. `POST /avees` (line 681)
4. `GET /me/agent-limit-status` (line 884)

**Solution:**
```python
# GOOD - single auth call
def endpoint(
    user: dict = Depends(get_current_user),
):
    user_id = user["id"]  # Extract from user object
```

**Expected Impact:** Reduce Supabase calls from 2 to 1 per request, saving ~100-200ms per affected endpoint.

**Actual Result:** Change implemented but user reports no performance improvement.

---

### 3. Frontend: Phased Data Loading

**File:** `frontend/src/contexts/AppDataContext.tsx`

**Problem:** All data was loaded in parallel, causing potential network/database congestion.

**Solution:** Split into 2 phases:
- **Phase 1:** Critical data (Profile, Config, Onboarding) loaded first
- **Phase 2:** Heavy data (Avees, Feed, UnifiedFeed) loaded after Phase 1 completes

```typescript
// Phase 1: Critical data
const [profileData, configData, onboardingData] = await Promise.all([
    getProfile(...),
    getAppConfig(...),
    getOnboardingStatus(...),
]);

// Check onboarding redirect before loading Phase 2
if (!onboardingData.completed) {
    router.push("/onboarding");
    return;
}

// Phase 2: Heavy data
const [aveesData, feedData, unifiedFeedData] = await Promise.all([
    getUserAvees(...),
    getFeed(...),
    getUnifiedFeed(...),
]);
```

**Expected Impact:** Faster perceived load time by showing UI with critical data first.

**Actual Result:** Phasing works but Phase 2 still takes 9-10 seconds, negating benefits.

---

### 4. Frontend: SessionStorage Caching

**File:** `frontend/src/contexts/AppDataContext.tsx`

**Already Implemented (not new):**

```typescript
const CACHE_KEYS = {
    PROFILE: 'app_profile_cache',
    AVEES: 'app_avees_cache',
    CONFIG: 'app_config_cache',
    FEED: 'app_feed_cache',
    UNIFIED_FEED: 'app_unified_feed_cache',
};

// Load cached data immediately
const cachedProfile = getCachedData(CACHE_KEYS.PROFILE);
if (cachedProfile) setProfile(cachedProfile);
```

**Impact:** Works well when cache is warm (first login in tests was fast), but gets cleared on logout.

---

### 5. Backend: Optimized /me/avees Endpoint

**File:** `backend/main.py`

**Change:** Select only essential columns instead of full objects:

```python
# Optimized column selection
rows = (
    db.query(
        Avee.id, Avee.handle, Avee.display_name, 
        Avee.avatar_url, Avee.bio, Avee.created_at
    )
    .filter(Avee.owner_user_id == user_uuid)
    .order_by(Avee.created_at.desc())
    .limit(limit)
    .offset(offset)
    .all()
)
```

**Impact:** Backend logs show this endpoint completes in 1-2s, but frontend still sees 9-10s.

---

### 6. Backend: Database Connection Pooling

**File:** `backend/db.py`

**Already Optimized (not new):**

```python
engine = create_engine(
    DATABASE_URL,
    pool_size=20,
    max_overflow=10,
    pool_pre_ping=True,
    pool_recycle=3600
)
```

---

### 7. Backend: HTTP Cache Headers Middleware

**File:** `backend/main.py`

**Already Implemented (not new):**

```python
@app.middleware("http")
async def add_cache_headers(request, call_next):
    response = await call_next(request)
    
    if request.url.path == "/config":
        response.headers["Cache-Control"] = "public, max-age=300"
    elif request.url.path == "/me/profile":
        response.headers["Cache-Control"] = "private, max-age=60"
    elif request.url.path == "/onboarding/status":
        response.headers["Cache-Control"] = "private, max-age=300"
    
    return response
```

---

## What Didn't Work & Why

### 1. JWT Caching Alone
- **Expected:** Reduce Supabase calls, improve speed
- **Actual:** Works as designed but doesn't solve the core bottleneck
- **Why:** The main delay is not in JWT verification

### 2. Request Deduplication
- **Expected:** Prevent multiple concurrent Supabase calls
- **Actual:** Successfully prevents duplicates (logs confirm) but no speed improvement
- **Why:** By the time deduplication matters, the first request has already cached the token

### 3. Phased Loading
- **Expected:** Faster perceived load time
- **Actual:** Phase 1 completes quickly, but Phase 2 still takes 9-10s
- **Why:** Doesn't address the root cause of Phase 2 slowness

### 4. Eliminating Double Auth Dependencies
- **Expected:** Save 100-200ms per affected endpoint
- **Actual:** No noticeable improvement
- **Why:** The profile endpoint completes relatively quickly; the bottleneck is elsewhere

---

## Mystery: Backend vs Frontend Timing Discrepancy

### The Core Issue

**Backend Logs Show:**
```
[/me/avees] Returned 70 agents in 2217ms (query + serialization)
INFO: 127.0.0.1:53496 - "GET /me/avees HTTP/1.1" 200 OK
```

**Frontend Logs Show:**
```
[AppData] Avees: 9800ms
```

**7.5 second gap unexplained.**

### Possible Causes (Not Yet Investigated)

1. **Network latency** - But localhost should be <10ms
2. **Response size** - 70 agents might be a large JSON payload (~500KB-1MB?)
3. **Frontend timing measurement** - May be measuring from wrong start point
4. **Backend request queuing** - Requests might be waiting for available connections
5. **Database connection starvation** - All parallel requests fighting for DB connections
6. **SQLAlchemy session overhead** - Each request creates/destroys a session
7. **Frontend deserialization** - Parsing large JSON responses
8. **Next.js middleware/interceptors** - Additional overhead not visible in logs
9. **Memory pressure** - Garbage collection during large data processing
10. **TCP connection reuse** - HTTP connections being established/torn down

---

## Current State

### Files Modified

1. **`backend/auth_supabase.py`** - Added request deduplication
2. **`backend/main.py`** - Removed double auth dependencies from 4 endpoints
3. **`frontend/src/contexts/AppDataContext.tsx`** - Implemented phased loading

### No Changes Made To

1. Database schema/indexes (already optimized in earlier work)
2. Backend query logic for feeds (already using LIMITs)
3. Frontend bundle size/code splitting
4. API response compression (GZip already enabled)

### Dependencies Added

1. **`cachetools`** - Already in `backend/requirements.txt`

---

## Test Data Context

- **User has 70 agents** - This is a LOT and may be unusual
- **Feed has 71 total agents** (70 owned + 9 followed)
- **UnifiedFeed returns 20/85 items**
- **Feed returns 10/71 items**

**Hypothesis:** The user's data size (70 agents) might be exposing scalability issues that don't appear with typical users (1-5 agents).

---

## What Needs Investigation

### High Priority

1. **Measure actual response sizes**
   - Add logging for response payload size in bytes
   - Check if 70 agents creates a 1MB+ response

2. **Add detailed backend timing**
   - Time database query separately from serialization
   - Time the actual HTTP response send
   - Log when the response leaves the server vs when frontend receives it

3. **Test with smaller data set**
   - Create a test account with only 5 agents
   - See if performance is consistent with smaller datasets

4. **Network profiling**
   - Use browser DevTools Network tab to see actual request timing breakdown
   - Check Time to First Byte (TTFB) vs Content Download time

5. **Database query profiling**
   - Add EXPLAIN ANALYZE to actual queries being run
   - Check for missing indexes on the specific user's data

### Medium Priority

6. **Frontend bundle analysis**
   - Check if sessionStorage operations are blocking
   - Profile JSON.parse/stringify overhead

7. **Backend connection pool monitoring**
   - Add logging for pool stats (available connections, waiters)
   - Check if requests are queuing for connections

8. **Memory profiling**
   - Monitor backend memory usage during concurrent requests
   - Check for memory spikes/GC pressure

### Low Priority

9. **HTTP/2 multiplexing**
   - Verify Next.js is using HTTP/2 for parallel requests

10. **Database connection settings**
    - Try increasing pool_size beyond 20
    - Test with connection pooling disabled (single connection) to rule out contention

---

## Recommended Next Steps

### Immediate Diagnostic Actions

1. **Add response size logging:**
```python
@app.middleware("http")
async def log_response_size(request, call_next):
    response = await call_next(request)
    content_length = response.headers.get("content-length", "unknown")
    print(f"[Response Size] {request.url.path}: {content_length} bytes")
    return response
```

2. **Add detailed timing to /me/avees:**
```python
@app.get("/me/avees")
def list_my_avees(...):
    start = time.time()
    
    # Query
    query_start = time.time()
    rows = db.query(...).all()
    query_time = (time.time() - query_start) * 1000
    
    # Serialization
    serialize_start = time.time()
    result = [{"id": str(a.id), ...} for a in rows]
    serialize_time = (time.time() - serialize_start) * 1000
    
    print(f"[/me/avees] Query: {query_time}ms, Serialize: {serialize_time}ms")
    return result
```

3. **Use browser DevTools:**
   - Open Network tab
   - Filter for `/me/avees`
   - Check Timing breakdown (Queueing, DNS, Connection, TTFB, Download)

4. **Test with reduced data:**
```python
# Temporarily limit to 10 agents for testing
.limit(min(limit, 10))
```

### Potential Solutions (Untested)

1. **Pagination:** Return only 10 agents initially, lazy-load rest
2. **Response compression:** Verify GZip is actually compressing the large response
3. **GraphQL/Sparse fieldsets:** Let frontend request only needed fields
4. **Caching layer:** Redis/Memcached for frequently accessed data
5. **Read replicas:** Separate read/write database connections
6. **CDN:** Serve static user data from edge locations
7. **Database indexing:** Specific to the exact queries being slow

---

## Environment Details

- **Frontend:** Next.js (dev mode with hot reload)
- **Backend:** FastAPI with uvicorn --reload
- **Database:** PostgreSQL via SQLAlchemy
- **Auth:** Supabase external service
- **Deployment:** Local development environment

---

## Conclusion

Despite multiple optimization attempts addressing JWT caching, request deduplication, double dependencies, and phased loading, the core performance issue remains:

**Phase 2 data loading (Avees, Feed, UnifiedFeed) consistently takes 9-10 seconds on the frontend, while backend logs show completion in 1-2 seconds.**

The 7-8 second discrepancy suggests the bottleneck is either:
- Network/HTTP layer (unlikely on localhost)
- Large response payload transfer/parsing
- Database connection contention not visible in logs
- Frontend measurement methodology

**The next person should focus on:**
1. Measuring actual response sizes
2. Detailed timing at every layer (DB → SQLAlchemy → FastAPI → HTTP → Next.js → React)
3. Testing with smaller datasets to isolate if this is a data-size issue
4. Browser DevTools Network profiling

The code optimizations implemented are correct and valuable, but they're not addressing the actual bottleneck.

