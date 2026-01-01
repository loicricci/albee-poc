# Persona Save Fix

## Issue
When trying to save a persona in the Agent Editor (`/agent` page), users encountered an HTTP 422 error with the message:
```
HTTP 422: {"detail":[{"type":"missing","loc":["body","handle"],"msg":"Field required","input":
{"display_name":null,"bio":null,"avatar_url":null,"location":null,"latitude":null,"longitude":null,"timezone":null}}]}
```

## Root Cause
The `onSavePersona()` function in `/frontend/src/app/(app)/agent/page.tsx` was incorrectly calling `saveMyProfile({ persona: p })`. 

The problem was:
1. `saveMyProfile()` expects a `handle` parameter (required)
2. `saveMyProfile()` doesn't support updating the `persona` field
3. The correct API function for updating persona is `updateAgent()`

## Solution
Changed the `onSavePersona()` function to use `updateAgent()` instead of `saveMyProfile()`:

**Before:**
```typescript
async function onSavePersona() {
  if (!profile) return;
  // ...
  await saveMyProfile({ persona: p });
  // ...
}
```

**After:**
```typescript
async function onSavePersona() {
  if (!profile || !profile.agent_id) return;
  // ...
  await updateAgent({ agentId: profile.agent_id, persona: p });
  // ...
}
```

## Changes Made
- File: `/frontend/src/app/(app)/agent/page.tsx`
- Function: `onSavePersona()` (around line 158)
- Changed from `saveMyProfile({ persona: p })` to `updateAgent({ agentId: profile.agent_id, persona: p })`
- Added additional check for `profile.agent_id` existence

## Testing
To test the fix:
1. Navigate to `/agent` page
2. Edit the persona text
3. Click "Save Persona" button
4. The persona should save successfully without the HTTP 422 error

## Notes
- The `/my-agents/[handle]/page.tsx` was already using the correct `updateAgent()` function
- The fix only needed to be applied to the main agent editor page
- No changes to the backend were required



