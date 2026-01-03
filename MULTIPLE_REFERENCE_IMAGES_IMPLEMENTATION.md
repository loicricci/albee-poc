# Multiple Reference Images Implementation

## Summary

Successfully implemented support for multiple reference images per agent instead of a single image that gets replaced on upload.

## Changes Made

### 1. Database Migration (✅ Complete)
**File:** `database_migrations/010_add_reference_images_table.sql`

- Created new `reference_images` table with the following fields:
  - `id`: UUID primary key
  - `avee_id`: Foreign key to agents
  - `reference_image_url`: URL to the reference image
  - `mask_image_url`: Optional mask image URL
  - `edit_instructions`: Optional editing instructions
  - `image_dimensions`: Image dimensions (e.g., "1024x1024")
  - `is_primary`: Boolean flag to mark default/primary image
  - `created_at`, `updated_at`: Timestamps

- Migrated existing reference images from the `avees` table to the new table
- Added indexes for better query performance
- Kept old columns in `avees` table for backward compatibility (marked as deprecated)

### 2. Backend Model (✅ Complete)
**File:** `backend/models.py`

- Added `ReferenceImage` SQLAlchemy model matching the new database table

### 3. Backend API Endpoints (✅ Complete)
**File:** `backend/auto_post_api.py`

#### Updated Endpoints:
- **GET `/agents/{avee_id}/reference-images`**: Now returns a list of all reference images instead of a single one
- **POST `/agents/{avee_id}/reference-images/upload`**: Now adds images to the collection instead of replacing
  - Added `is_primary` parameter to mark as default image
  - Uses timestamped filenames to avoid conflicts
  
#### New Endpoints:
- **DELETE `/agents/{avee_id}/reference-images/{image_id}`**: Delete a specific reference image
- **DELETE `/agents/{avee_id}/reference-images`**: Delete all reference images for an agent
- **PATCH `/agents/{avee_id}/reference-images/{image_id}/set-primary`**: Set a specific image as primary

#### Updated Helper Functions:
- **`get_user_avees()`**: Modified to fetch reference images from the new table and include them in the response

### 4. Frontend Component (✅ Complete)
**File:** `frontend/src/components/ReferenceImageUpload.tsx`

Complete rewrite to support multiple images:

- **Gallery View**: Displays all uploaded reference images in a grid
- **Primary Badge**: Shows a star ⭐ on primary images
- **Individual Actions**: Each image has "Set as Primary" and "Delete" buttons
- **Upload Form**: Allows uploading additional images without replacing existing ones
- **Primary Checkbox**: Option to mark new uploads as primary
- **Real-time Updates**: Automatically refreshes the gallery after uploads/deletes

### 5. Auto-Post Page (✅ Complete)
**File:** `frontend/src/app/(app)/backoffice/auto-posts/page.tsx`

Updated to work with multiple reference images:

- **Interface Update**: Changed from single `reference_image_url` to array of `reference_images`
- **hasReferenceImages()**: Now checks if agents have any images in their collection
- **getAvailableReferenceImages()**: Returns all available images from selected agents with metadata
- **Image Selector UI**: Updated to show primary badge and use unique image IDs
- **Sorting**: Primary images appear first in the selection grid

## Features

### For Users
1. **Multiple Images**: Upload as many reference images as needed per agent
2. **Primary Image**: Mark one image as the default for autoposts
3. **Individual Management**: Delete specific images without affecting others
4. **Visual Indicators**: Primary images are clearly marked with a star badge
5. **Easy Selection**: When creating autoposts, choose from all available reference images

### For Developers
1. **Backward Compatible**: Old columns still exist (deprecated) for gradual migration
2. **Unique Filenames**: Timestamp-based naming prevents file conflicts
3. **Cascade Deletion**: Reference images are automatically deleted when agent is deleted
4. **Proper Indexing**: Database indexes for efficient queries
5. **RESTful API**: Clean, RESTful endpoint structure

## Migration Path

### For Existing Data
The migration automatically:
1. Copies existing reference images from `avees` table to `reference_images` table
2. Marks them as primary (is_primary = true)
3. Preserves all existing data (URLs, mask URLs, instructions)

### For Future Development
Old columns in `avees` table can be removed in a future migration once verified that:
1. All systems are using the new table
2. No legacy code references the old columns
3. Data migration is confirmed successful in production

## API Examples

### Upload a new reference image
```bash
POST /auto-post/agents/{avee_id}/reference-images/upload
Content-Type: multipart/form-data

reference_image: <file>
mask_image: <file> (optional)
edit_instructions: "Keep bright colors" (optional)
is_primary: true (optional)
```

### Get all reference images
```bash
GET /auto-post/agents/{avee_id}/reference-images

Response:
{
  "avee_id": "...",
  "images": [
    {
      "id": "...",
      "reference_image_url": "...",
      "mask_image_url": "...",
      "edit_instructions": "...",
      "image_dimensions": "1024x1024",
      "is_primary": true,
      "created_at": "..."
    }
  ],
  "total_count": 3,
  "has_reference_images": true
}
```

### Delete a specific image
```bash
DELETE /auto-post/agents/{avee_id}/reference-images/{image_id}
```

### Set an image as primary
```bash
PATCH /auto-post/agents/{avee_id}/reference-images/{image_id}/set-primary
```

## Testing Recommendations

1. **Upload Multiple Images**: Verify that uploading new images doesn't replace existing ones
2. **Primary Image**: Check that setting an image as primary unsets the previous primary
3. **Delete Individual**: Confirm that deleting one image doesn't affect others
4. **Auto-Post Selection**: Test that all images appear in the auto-post image selector
5. **Migration**: Verify that existing reference images were properly migrated to the new table

## Files Changed

1. `database_migrations/010_add_reference_images_table.sql` (NEW)
2. `backend/models.py` (UPDATED)
3. `backend/auto_post_api.py` (UPDATED)
4. `frontend/src/components/ReferenceImageUpload.tsx` (REWRITTEN)
5. `frontend/src/app/(app)/backoffice/auto-posts/page.tsx` (UPDATED)

## Next Steps

To apply these changes:

1. **Run the database migration**:
   ```bash
   psql $DATABASE_URL -f database_migrations/010_add_reference_images_table.sql
   ```

2. **Restart the backend** to load the new model and endpoints

3. **Clear browser cache** if needed to load the updated frontend components

4. **Test the functionality** by uploading multiple reference images for an agent

## Notes

- The old reference image columns in the `avees` table are kept for backward compatibility
- File storage uses timestamped filenames (e.g., `reference_1735862400000.png`) to prevent conflicts
- The `is_primary` flag ensures only one image per agent is marked as primary at a time
- All endpoints include proper authorization checks (admin vs. owner)



