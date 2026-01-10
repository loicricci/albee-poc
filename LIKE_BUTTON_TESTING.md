# Like Button Testing Guide

## How to Test the Fixes

### Prerequisites
- Backend server running (`cd backend && uvicorn main:app --reload`)
- Frontend running (`cd frontend && npm run dev`)
- At least one user account with access to the feed
- Some posts and reposts in the feed

### Test Scenarios

#### Test 1: Like a Regular Post
1. Navigate to `/feed`
2. Find a regular post (not a repost)
3. Click the heart icon to like it
4. ✅ Verify: Heart turns red and count increases by 1
5. Click heart again to unlike
6. ✅ Verify: Heart turns gray and count decreases by 1

#### Test 2: Like a Repost (Main Bug Fix)
1. Navigate to `/feed`
2. Find a repost (has "reposted by" banner)
3. Click the heart icon to like it
4. ✅ Verify: Heart turns red and count increases by 1
5. Open browser console and check for errors
6. ✅ Verify: No 404 errors or "Post not found" errors
7. Click heart again to unlike
8. ✅ Verify: Heart turns gray and count decreases by 1

#### Test 3: Like Persistence
1. Like a post or repost
2. Refresh the page
3. ✅ Verify: Post still shows as liked (red heart)
4. ✅ Verify: Like count is correct

#### Test 4: Comment Button on Repost
1. Find a repost in the feed
2. Click the comment icon
3. ✅ Verify: Comment section opens
4. ✅ Verify: No errors in console

#### Test 5: Repost Button on Repost
1. Find a repost in the feed
2. Click the repost button
3. ✅ Verify: Repost modal opens
4. Add a comment and click Repost
5. ✅ Verify: Success message appears
6. ✅ Verify: Your repost appears in the feed

#### Test 6: Multiple Reposts of Same Post
1. Find a post that has been reposted multiple times
2. Like one of the reposts
3. Scroll through the feed
4. ✅ Verify: All instances of that post (original + reposts) show as liked

### Using Browser DevTools

1. Open browser DevTools (F12 or Cmd+Option+I)
2. Go to Console tab
3. Click like buttons and watch for:
   - ✅ No errors
   - ✅ POST/DELETE requests to `/posts/{uuid}/like` (not `/posts/repost-{uuid}/like`)
4. Go to Network tab
5. Click like on a repost
6. ✅ Verify: Request URL is `/posts/{actual-post-uuid}/like` (not `/posts/repost-*/like`)

### Expected Console Output (Good)
```
✅ No errors
✅ Request URL: http://localhost:8000/posts/5cd59561-896c-40f8-8e91-d9b3fb367a00/like
✅ Status: 200 OK
```

### Previous Console Output (Bug)
```
❌ Error: Failed to like post
❌ Request URL: http://localhost:8000/posts/repost-abc-123-def/like
❌ Status: 404 Not Found or 422 Unprocessable Entity
```

## Automated Testing

Run the diagnostic script:
```bash
cd /path/to/gabee-poc
python3 test_like_functionality.py
```

This will:
- Test like/unlike functionality
- Verify database consistency
- Check like counts
- Test both posts and reposts

## Quick Visual Check

The easiest way to verify the fix:
1. Open the feed at http://localhost:3000/feed
2. Find a repost (look for "reposted by" text)
3. Click the heart icon
4. If it turns red without errors = ✅ FIXED!
5. If you get errors in console = ❌ Still broken

## Files Modified

- ✅ `frontend/src/components/FeedPostCard.tsx` - Main fix
- ✅ `frontend/src/app/(app)/app/page.tsx` - Supporting fix

## Rollback Instructions (if needed)

If something breaks:
```bash
cd /path/to/gabee-poc
git diff frontend/src/components/FeedPostCard.tsx
git checkout frontend/src/components/FeedPostCard.tsx
git checkout frontend/src/app/(app)/app/page.tsx
```

## Additional Notes

- The bug only affected **reposts**, not regular posts
- Backend API was already working correctly
- Database triggers are functioning properly
- The fix is backward compatible with existing code



