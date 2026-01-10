# Quick Start: Multiple Reference Images

## What Changed?

✅ **Before**: Uploading a new reference image replaced the previous one  
✅ **After**: You can now upload multiple reference images per agent

## How to Use

### 1. Upload Multiple Images

1. Go to **My Agents** → Select an agent
2. Scroll to **📸 Reference Images for AutoPost** section
3. Upload your first reference image (optionally check "Set as primary")
4. Click **Upload Reference Image**
5. Repeat to upload more images - they will be added to your collection!

### 2. Manage Your Images

Each uploaded image shows:
- **Preview** of the reference image
- **Mask image** (if uploaded)
- **Edit instructions** (if provided)
- **Primary badge** (⭐) for the default image

You can:
- **Set as Primary**: Make any image the default
- **Delete**: Remove individual images

### 3. Use in Auto-Posts

1. Go to **Backoffice** → **Auto-Post Generator**
2. Select your agents
3. Choose **OpenAI Image Edits** as the image engine
4. **Select a reference image** from the grid (primary images have a ⭐)
5. Generate your posts!

## Migration Applied

After running the database migration:
```bash
psql $DATABASE_URL -f database_migrations/010_add_reference_images_table.sql
```

Your existing reference images will be automatically migrated and marked as primary.

## Key Features

- 📚 **Multiple Images**: Upload as many as you need
- ⭐ **Primary Image**: Set a default for autoposts
- 🎯 **Individual Control**: Delete or modify specific images
- 🔄 **No Replacement**: New uploads are added, not replacing
- 🎨 **Easy Selection**: Choose any image when creating posts

## Technical Details

See `MULTIPLE_REFERENCE_IMAGES_IMPLEMENTATION.md` for complete technical documentation.





