# Image Selection Feature for OpenAI Image Edits

## Overview
Added ability for users to **select which specific reference image** to use when generating posts with OpenAI Image Edits API, rather than automatically using the agent's default reference image.

---

## Feature Description

### User Flow
1. User selects agent(s) in backoffice
2. User chooses "OpenAI Image Edits" engine
3. **NEW**: Visual gallery appears showing all available reference images from selected agents
4. User clicks on desired image to select it
5. Selected image is highlighted with a blue border and checkmark
6. User clicks "Generate Posts"
7. Selected image is sent to OpenAI API for editing

### Visual Design
- **Image Gallery**: Grid layout (2-4 columns responsive)
- **Image Cards**: Square thumbnails with agent name/handle
- **Selection Indicator**: Blue border + checkmark on selected image
- **Validation Warning**: Yellow warning if no image selected
- **Responsive**: Works on mobile and desktop

---

## Implementation Details

### Frontend Changes

#### 1. State Management
**File**: `frontend/src/app/(app)/backoffice/auto-posts/page.tsx`

Added new state variable:
```typescript
const [selectedReferenceImage, setSelectedReferenceImage] = useState<string | null>(null);
```

#### 2. Helper Function
Get available reference images from selected agents:
```typescript
const getAvailableReferenceImages = () => {
  if (!status || selectedAvees.size === 0) return [];
  
  const selectedAveesList = status.avees.filter(a => selectedAvees.has(a.avee_id));
  const images: Array<{ url: string; agentHandle: string; agentName: string }> = [];
  
  selectedAveesList.forEach(avee => {
    if (avee.reference_image_url) {
      images.push({
        url: avee.reference_image_url,
        agentHandle: avee.handle,
        agentName: avee.display_name || avee.handle
      });
    }
  });
  
  return images;
};
```

#### 3. Image Selector UI
Visual gallery component added after engine selector:
- Shows only when OpenAI Edits is selected and agents have images
- Grid of clickable image cards
- Selected image highlighted
- Warning if no selection made

#### 4. Validation
```typescript
// Validate reference image selection for OpenAI Edits
if (imageEngine === 'openai-edits' && !selectedReferenceImage) {
  showMessage('error', 'Please select a reference image for OpenAI Image Edits');
  return;
}
```

#### 5. API Request Update
```typescript
body: JSON.stringify({
  avee_ids: aveeIds,
  topic: topic || null,
  category: category || null,
  image_engine: imageEngine,
  reference_image_url: imageEngine === 'openai-edits' ? selectedReferenceImage : null, // NEW
})
```

---

### Backend Changes

#### 1. API Request Model
**File**: `backend/auto_post_api.py`

```python
class GeneratePostRequest(BaseModel):
    avee_ids: List[str]
    topic: Optional[str] = None
    category: Optional[str] = None
    image_engine: str = "dall-e-3"
    reference_image_url: Optional[str] = None  # NEW
```

#### 2. Function Signatures Updated
All generation functions now accept `reference_image_url`:

```python
async def generate_single_post(
    handle: str,
    avee_id: str,
    topic: Optional[str],
    category: Optional[str],
    image_engine: str,
    reference_image_url: Optional[str],  # NEW
    db: Session
) -> dict:
```

```python
async def generate_multiple_posts(
    avees: dict,
    topic: Optional[str],
    category: Optional[str],
    image_engine: str,
    reference_image_url: Optional[str]  # NEW
):
```

#### 3. Generator Method Updated
**File**: `generate_daily_post.py`

```python
async def generate_post_async(
    self,
    agent_handle: str,
    topic_override: Optional[str] = None,
    category: Optional[str] = None,
    image_engine: str = "dall-e-3",
    reference_image_url_override: Optional[str] = None  # NEW
) -> dict:
```

#### 4. Image Edits Method Updated
```python
async def _generate_with_edits(
    self,
    agent_handle: str,
    prompt: str,
    agent_context: dict,
    reference_image_url_override: Optional[str] = None  # NEW
) -> str:
    # Use override if provided, otherwise use agent's default
    reference_image_url = reference_image_url_override or agent_context.get("reference_image_url")
```

---

## Files Modified

### Frontend (1 file)
1. **`frontend/src/app/(app)/backoffice/auto-posts/page.tsx`**
   - Added state for selected reference image
   - Added helper function to get available images
   - Added image gallery UI component
   - Added validation logic
   - Updated API request to include selected image

### Backend (2 files)
2. **`backend/auto_post_api.py`**
   - Updated `GeneratePostRequest` model
   - Updated all generation function signatures
   - Pass selected image through entire call chain

3. **`generate_daily_post.py`**
   - Updated `generate_post_async` signature
   - Updated `_generate_with_edits` to accept and use override
   - Override takes precedence over agent default

---

## Behavior Changes

### Before
- ✗ Automatically used agent's default reference image
- ✗ No way to choose different image per generation
- ✗ User had no visibility into which image would be used

### After
- ✓ User explicitly selects which image to use
- ✓ Visual preview of all available reference images
- ✓ Clear feedback on what will be used
- ✓ Validation prevents generation without selection
- ✓ Falls back to agent default if no override provided (backward compatible)

---

## UI/UX Features

### Image Gallery
```
┌─────────────────────────────────────────────────┐
│ 🖼️ Select Reference Image for Editing          │
│ Choose which reference image to send to OpenAI  │
│                                                 │
│ ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐│
│ │  IMG   │  │  IMG ✓ │  │  IMG   │  │  IMG   ││
│ │        │  │ [BLUE] │  │        │  │        ││
│ ├────────┤  ├────────┤  ├────────┤  ├────────┤│
│ │Agent 1 │  │Agent 2 │  │Agent 3 │  │Agent 4 ││
│ │@handle │  │@handle │  │@handle │  │@handle ││
│ └────────┘  └────────┘  └────────┘  └────────┘│
│                                                 │
│ ⚠️ Please select a reference image...          │
└─────────────────────────────────────────────────┘
```

### Selection States
- **Unselected**: Gray border, hoverable
- **Selected**: Blue border, ring effect, white checkmark
- **Hover**: Blue border preview

---

## Validation Rules

1. **Image selection required** when:
   - OpenAI Image Edits engine is selected
   - User clicks "Generate Posts"
   
2. **Error messages**:
   - "Please select a reference image for OpenAI Image Edits"
   - Shown as red toast notification

3. **Visual warnings**:
   - Yellow warning box appears below gallery if no selection

---

## API Flow

```
Frontend
  ↓
  POST /auto-post/generate
  {
    avee_ids: ["uuid1"],
    image_engine: "openai-edits",
    reference_image_url: "https://..."  ← NEW
  }
  ↓
backend/auto_post_api.py
  ↓
  generate_single_post(..., reference_image_url)
  ↓
generate_daily_post.py
  ↓
  generate_post_async(..., reference_image_url_override)
  ↓
  _generate_with_edits(..., reference_image_url_override)
  ↓
  Uses override OR falls back to agent default
  ↓
backend/image_generator.py
  ↓
  generate_with_edits(reference_image_url)
  ↓
OpenAI Image Edits API
```

---

## Backward Compatibility

### ✅ Fully Backward Compatible

- `reference_image_url` is **optional** in all function signatures
- If not provided (null), system uses agent's default reference image
- Existing automated flows continue to work unchanged
- No database changes required

---

## Testing Checklist

- [x] Gallery displays when OpenAI Edits selected
- [x] Gallery hidden when DALL-E 3 selected
- [x] Images from all selected agents shown
- [x] Click to select works
- [x] Selected image highlighted correctly
- [x] Validation prevents generation without selection
- [x] API receives selected image URL
- [x] Backend passes URL through call chain
- [x] Generator uses override instead of default
- [x] Fallback to agent default works when no override
- [x] Multiple agents scenario works
- [x] Responsive design on mobile
- [x] Reset on successful generation

---

## User Experience Improvements

### Before
User: "Which image will it use?"
System: 🤷 (uses agent default silently)

### After
User: "Which image will it use?"
System: 📷 Shows gallery with all options
User: *Clicks desired image*
System: ✓ Confirms selection with visual feedback

---

## Future Enhancements

1. **Image Preview Modal**: Click image for full-size preview
2. **Multi-Image Selection**: Select different images for different agents
3. **Recent Selections**: Remember last selected image
4. **Image Upload Here**: Allow upload directly from generation page
5. **Mask Selection**: Also allow mask image selection
6. **Image Metadata**: Show upload date, dimensions, etc.

---

## Summary

**Status**: ✅ Feature Complete

**What Was Added**:
1. Visual image gallery selector in backoffice
2. User can choose specific reference image per generation
3. Validation prevents generation without selection
4. Backend accepts and uses selected image URL
5. Falls back to agent default if no selection (backward compatible)

**User Benefit**: 
Users now have full control over which reference image is used for OpenAI Image Edits, with clear visual feedback and validation.

**Deployment**: Ready ✅



