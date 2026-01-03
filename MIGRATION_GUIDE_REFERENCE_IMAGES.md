# Apply Multiple Reference Images Migration

## Quick Migration Steps

### 1. Connect to your database

```bash
# Using environment variable
psql $DATABASE_URL

# Or with explicit connection
psql -h your-host -U your-user -d your-database
```

### 2. Run the migration

```bash
psql $DATABASE_URL -f database_migrations/010_add_reference_images_table.sql
```

### 3. Verify the migration

```sql
-- Check that the table was created
\d reference_images

-- Check that existing data was migrated
SELECT 
    a.handle,
    a.display_name,
    COUNT(ri.id) as image_count,
    COUNT(ri.id) FILTER (WHERE ri.is_primary = true) as primary_count
FROM avees a
LEFT JOIN reference_images ri ON a.id = ri.avee_id
GROUP BY a.id, a.handle, a.display_name
HAVING COUNT(ri.id) > 0;
```

### 4. Restart the backend

```bash
# If using systemd
sudo systemctl restart gabee-backend

# Or if running directly
# Stop the current process and restart
cd backend
uvicorn main:app --host 0.0.0.0 --port 8000
```

### 5. Test the functionality

1. Log in to the application
2. Go to **My Agents** → Select an agent
3. Try uploading multiple reference images
4. Verify they all appear in the gallery
5. Go to **Backoffice** → **Auto-Post Generator**
6. Select the agent and choose **OpenAI Image Edits**
7. Verify all images appear in the selector

## Rollback (if needed)

If you need to rollback the migration:

```sql
-- Drop the new table (this will also delete all references due to CASCADE)
DROP TABLE IF EXISTS reference_images CASCADE;

-- The old columns in avees table are still there, so the old system will work
```

## Migration Details

The migration:
- ✅ Creates the `reference_images` table
- ✅ Adds indexes for performance
- ✅ Copies existing reference images from `avees` table
- ✅ Sets existing images as primary (is_primary = true)
- ✅ Keeps old columns for backward compatibility
- ✅ Includes comments marking old columns as deprecated

## What Gets Migrated?

For each agent in the `avees` table with a `reference_image_url`:
- Reference image URL
- Mask image URL (if present)
- Edit instructions (if present)
- Automatically marked as primary (is_primary = true)

## Post-Migration

After successful migration:
1. All existing reference images will continue to work
2. New uploads will be added to the collection (not replacing)
3. Users can upload multiple images per agent
4. The old columns in `avees` are kept but deprecated

## Future Cleanup (Optional)

Once you've verified everything works in production, you can remove the deprecated columns:

```sql
-- WARNING: Only run this after verifying the new system works!
-- This is optional and can be done later

ALTER TABLE avees 
DROP COLUMN IF EXISTS reference_image_url,
DROP COLUMN IF EXISTS reference_image_mask_url,
DROP COLUMN IF EXISTS image_edit_instructions;
```

## Troubleshooting

### Migration fails with "table already exists"
The table may have been created already. Check with:
```sql
\d reference_images
```

If it exists, you can skip the CREATE TABLE step.

### No data was migrated
Check if any agents have reference images:
```sql
SELECT COUNT(*) 
FROM avees 
WHERE reference_image_url IS NOT NULL;
```

### Images don't appear in the frontend
1. Clear browser cache
2. Hard refresh (Ctrl+Shift+R or Cmd+Shift+R)
3. Check browser console for errors
4. Verify the backend restarted successfully

## Support

If you encounter issues:
1. Check the backend logs for errors
2. Verify the database connection
3. Ensure the migration completed successfully
4. Verify no foreign key constraints were violated

For questions, refer to:
- `MULTIPLE_REFERENCE_IMAGES_IMPLEMENTATION.md` - Technical details
- `MULTIPLE_REFERENCE_IMAGES_QUICK_START.md` - User guide



