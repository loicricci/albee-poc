# Feed Page Debugging Guide

## Issue Report
User reports:
1. ❌ Comments don't work in feed page
2. ❌ Like button is bugged
3. ❌ There is no repost button

## Diagnostic Steps

### 1. Check if feed is loading
Open browser console (F12) and look for:
- Network requests to `/feed/unified`
- Any JavaScript errors
- Check if `feedItems` array has data

### 2. Check component rendering
In browser console, type:
```javascript
// This should show the feed items
console.log(document.querySelectorAll('[class*="FeedPostCard"]').length);

// Check for buttons
console.log('Like buttons:', document.querySelectorAll('button[class*="items-center"]').length);
```

### 3. Common Issues

#### Issue: Feed shows "Your feed is empty"
**Cause**: User hasn't followed any agents or doesn't own any agents
**Fix**: 
1. Go to `/network` page
2. Follow some agents
3. Return to `/feed`

#### Issue: Buttons exist but don't do anything
**Cause**: Event handlers not firing
**Check**: 
- Open console and click buttons - look for errors
- Check if `onLike`, `onComment`, `onRepost` functions are defined

#### Issue: Only seeing updates, no posts
**Cause**: No posts with images in the feed
**Check**: 
```sql
SELECT COUNT(*) FROM posts WHERE agent_id IN (
  SELECT avee_id FROM agent_followers WHERE follower_user_id = 'YOUR_USER_ID'
);
```

### 4. Manual Test

1. **Start backend**:
```bash
cd backend
uvicorn main:app --reload --port 8000
```

2. **Start frontend**:
```bash
cd frontend
npm run dev
```

3. **Test API directly**:
```bash
# Get auth token from browser localStorage
TOKEN="your_token_here"

# Test unified feed
curl -H "Authorization: Bearer $TOKEN" http://localhost:8000/feed/unified

# Test like
curl -X POST -H "Authorization: Bearer $TOKEN" http://localhost:8000/posts/{POST_ID}/like

# Test comment
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"content":"Test comment"}' \
  http://localhost:8000/posts/{POST_ID}/comments
```

### 5. Quick Fixes

If the feed page isn't loading properly, try:

1. **Clear browser cache** and refresh
2. **Check environment variables** in `frontend/.env.local`:
   ```
   NEXT_PUBLIC_API_BASE=http://localhost:8000
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   ```

3. **Rebuild frontend**:
   ```bash
   cd frontend
   rm -rf .next
   npm run dev
   ```

### 6. Files to Check

- `/frontend/src/app/(app)/feed/page.tsx` - Main feed page
- `/frontend/src/components/FeedPostCard.tsx` - Post card component
- `/frontend/src/components/CommentSection.tsx` - Comments
- `/frontend/src/lib/api.ts` - API functions

### 7. Known Limitations

The feed only shows:
- Posts from agents you follow
- Posts from your own agents
- Updates from agents you follow
- Updates from your own agents

If you're not following anyone and have no agents, the feed will be empty.

