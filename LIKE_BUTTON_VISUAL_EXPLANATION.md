# Like Button Bug - Visual Explanation

## The Problem

### Feed Structure (Before Fix)

```
┌─────────────────────────────────────────┐
│          UNIFIED FEED                   │
├─────────────────────────────────────────┤
│                                         │
│  📝 Regular Post                        │
│  id: "post-abc123"                      │
│  type: "post"                           │
│  [❤️ Like Button]                       │
│  ✅ Works! Sends: POST /posts/post-abc123/like
│                                         │
├─────────────────────────────────────────┤
│                                         │
│  🔁 Repost (by @user)                   │
│  id: "repost-xyz789"                    │
│  post_id: "post-abc123" (original)      │
│  type: "repost"                         │
│  [❤️ Like Button]                       │
│  ❌ BROKEN! Sends: POST /posts/repost-xyz789/like
│  ❌ Error: 404 Post Not Found           │
│                                         │
└─────────────────────────────────────────┘
```

### The Data Flow (Before Fix)

```
Backend (feed.py) Line 779:
┌────────────────────────────────────────────┐
│ For Repost:                                │
│   id: "repost-{share.id}"   ← Unique ID   │
│   post_id: "{post.id}"      ← Original    │
└────────────────────────────────────────────┘
                   │
                   ▼
Frontend (FeedPostCard.tsx) Line 49 - BEFORE:
┌────────────────────────────────────────────┐
│ handleLike = () => {                       │
│   onLike(item.id, newLiked)  ← WRONG!     │
│ }                                          │
└────────────────────────────────────────────┘
                   │
                   ▼
API Call:
┌────────────────────────────────────────────┐
│ POST /posts/repost-xyz789/like             │
│                 ^^^^^^ NOT A VALID UUID!   │
│ Response: 404 Post Not Found               │
└────────────────────────────────────────────┘
```

## The Solution

### The Data Flow (After Fix)

```
Backend (feed.py) Line 779:
┌────────────────────────────────────────────┐
│ For Repost:                                │
│   id: "repost-{share.id}"   ← Unique ID   │
│   post_id: "{post.id}"      ← Original    │
└────────────────────────────────────────────┘
                   │
                   ▼
Frontend (FeedPostCard.tsx) Lines 44-46 - AFTER:
┌────────────────────────────────────────────┐
│ const actualPostId = item.type === "repost"│
│   ? item.post_id                           │
│   : item.id;                               │
│                                            │
│ handleLike = () => {                       │
│   onLike(actualPostId, newLiked) ✅        │
│ }                                          │
└────────────────────────────────────────────┘
                   │
                   ▼
API Call:
┌────────────────────────────────────────────┐
│ POST /posts/post-abc123/like               │
│                 ^^^^^^^^^ CORRECT!         │
│ Response: 200 OK                           │
└────────────────────────────────────────────┘
```

### Feed Structure (After Fix)

```
┌─────────────────────────────────────────┐
│          UNIFIED FEED                   │
├─────────────────────────────────────────┤
│                                         │
│  📝 Regular Post                        │
│  id: "post-abc123"                      │
│  type: "post"                           │
│  [❤️ Like Button]                       │
│  ✅ Works! Sends: POST /posts/post-abc123/like
│                                         │
├─────────────────────────────────────────┤
│                                         │
│  🔁 Repost (by @user)                   │
│  id: "repost-xyz789"                    │
│  post_id: "post-abc123" (original)      │
│  type: "repost"                         │
│  [❤️ Like Button]                       │
│  ✅ NOW WORKS! Sends: POST /posts/post-abc123/like
│  ✅ Response: 200 OK                    │
│                                         │
└─────────────────────────────────────────┘
```

## Code Comparison

### Before (Broken)
```typescript
const handleLike = () => {
  const newLiked = !liked;
  setLiked(newLiked);
  setLikeCount(prev => newLiked ? prev + 1 : Math.max(0, prev - 1));
  onLike(item.id, newLiked);  // ❌ Wrong for reposts
};
```

### After (Fixed)
```typescript
// Get the actual post ID - for reposts, use post_id (original post), otherwise use id
const actualPostId = item.type === "repost" && item.post_id ? item.post_id : item.id;

const handleLike = () => {
  const newLiked = !liked;
  setLiked(newLiked);
  setLikeCount(prev => newLiked ? prev + 1 : Math.max(0, prev - 1));
  onLike(actualPostId, newLiked);  // ✅ Correct for both posts and reposts
};
```

## Why This Design?

The backend assigns reposts a unique ID (`repost-{uuid}`) because:
1. Each repost is a separate feed item with its own metadata (who reposted, when, comment)
2. The feed needs to show multiple reposts of the same post
3. But likes/comments should be on the **original post**, not the repost itself

Think of it like Twitter:
- When you retweet something, it's a separate action
- But when you like a retweet, you're liking the original tweet
- All retweets of the same tweet share the same like count

## The Fix in One Line

```typescript
// Instead of:  item.id
// We now use:  item.type === "repost" ? item.post_id : item.id
```

This simple change fixes:
- ✅ Like button
- ✅ Unlike button
- ✅ Comment button
- ✅ Repost button
- ✅ Like count updates



