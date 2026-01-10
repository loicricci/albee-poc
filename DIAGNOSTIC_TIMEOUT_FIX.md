# Diagnostic Page Timeout Fix

## Issue

When generating a post via the diagnostic page at `http://localhost:3000/backoffice/diagnostic`, users were experiencing a timeout error after 15 seconds:

```
Error: Request timeout. Is the backend running?
```

## Root Cause

The problem was **NOT with the backend** - the backend was working correctly and successfully generating posts. The issue was a **mismatch between frontend timeout and actual processing time**:

1. **Frontend timeout:** 15 seconds (default for all API calls)
2. **Actual generation time:** 60-70 seconds (due to AI operations)

### Why Post Generation Takes So Long

Post generation involves multiple AI API calls:
- ✅ Topic fetching: ~0.002s (very fast - uses cached topics)
- ✅ Agent context loading: ~1-2s
- ✅ Image prompt generation: ~4s (OpenAI GPT-4)
- ✅ Description generation: ~3s (OpenAI GPT-4)
- ⏰ **Image generation: ~50-60s** (OpenAI DALL-E/GPT-Image-1)
- ✅ Post creation: ~1s

**Total time: ~60-70 seconds** - far exceeding the 15-second timeout!

## Solution

Extended the timeout specifically for the diagnostic endpoint to **90 seconds** to accommodate the AI image generation process.

### Changes Made

**1. Created dedicated function in `frontend/src/lib/api.ts`:**

Added `diagnosticGeneratePost()` function with:
- Custom 90-second timeout (instead of default 15s)
- Proper type definitions for request/response
- Documentation explaining why longer timeout is needed

**2. Updated diagnostic page `frontend/src/app/(app)/backoffice/diagnostic/page.tsx`:**

Changed from:
```typescript
const data = await api.post("/auto-post/diagnostic/generate", {...});
```

To:
```typescript
const data = await diagnosticGeneratePost({...});
```

## Result

✅ Post generation now completes successfully without timeout errors
✅ Frontend waits up to 90 seconds for the backend to finish
✅ No changes needed to backend code - it was already working correctly!

## Why This Approach

### Why not increase global timeout?
- Most API calls complete in <5 seconds
- Only diagnostic post generation needs extended time
- Global timeout increase would hide real issues elsewhere

### Why 90 seconds?
- Covers worst-case generation time (~70s) + buffer
- Matches the timeout used for agent creation with web research
- Prevents indefinite waiting while still being generous

## Backend Logs (Example)

When generation succeeds, you'll see logs like:
```
[NewsTopicFetcher] ✅ Topic fetched (0.002s)
[ProfileContextLoader] ✅ Context loaded (1.27s)
[AIPromptGenerator] ✅ Parallel generation completed (3.98s)
[AIPromptGenerator] ✅ Description generated (3.11s)
[ImageGenerator] ✅ Image saved (54.30s)  <-- This is the slow part!
[PostCreationService] ✅ Post created successfully!
```

## Testing

To verify the fix works:
1. Navigate to `http://localhost:3000/backoffice/diagnostic`
2. Select any agent from the dropdown
3. Click "Generate Post"
4. Wait ~60-70 seconds
5. ✅ Post should generate successfully without timeout error

## Files Modified

- `frontend/src/lib/api.ts` - Added `diagnosticGeneratePost()` function
- `frontend/src/app/(app)/backoffice/diagnostic/page.tsx` - Updated to use new function

---

**Note:** If post generation still fails, check the backend logs - the issue would be with the AI APIs (OpenAI), not the timeout.



