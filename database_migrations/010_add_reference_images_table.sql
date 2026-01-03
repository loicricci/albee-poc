-- Migration: Add reference_images table for multiple reference images per agent
-- Purpose: Allow agents to have multiple reference images instead of just one
-- Date: 2026-01-02

-- Create reference_images table
CREATE TABLE IF NOT EXISTS reference_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    avee_id UUID NOT NULL REFERENCES avees(id) ON DELETE CASCADE,
    reference_image_url TEXT NOT NULL,
    mask_image_url TEXT,
    edit_instructions TEXT,
    image_dimensions TEXT,
    is_primary BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on avee_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_reference_images_avee_id ON reference_images(avee_id);

-- Create index on is_primary for faster primary image lookups
CREATE INDEX IF NOT EXISTS idx_reference_images_primary ON reference_images(avee_id, is_primary);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_reference_images_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER reference_images_updated_at
    BEFORE UPDATE ON reference_images
    FOR EACH ROW
    EXECUTE FUNCTION update_reference_images_updated_at();

-- Migrate existing reference images from avees table to reference_images table
INSERT INTO reference_images (avee_id, reference_image_url, mask_image_url, edit_instructions, is_primary)
SELECT 
    id as avee_id,
    reference_image_url,
    reference_image_mask_url as mask_image_url,
    image_edit_instructions as edit_instructions,
    true as is_primary
FROM avees
WHERE reference_image_url IS NOT NULL;

-- Note: We're keeping the old columns in avees table for backward compatibility
-- They can be removed in a future migration once the system is fully migrated
-- For now, we'll keep them but deprecate their use
COMMENT ON COLUMN avees.reference_image_url IS 'DEPRECATED: Use reference_images table instead';
COMMENT ON COLUMN avees.reference_image_mask_url IS 'DEPRECATED: Use reference_images table instead';
COMMENT ON COLUMN avees.image_edit_instructions IS 'DEPRECATED: Use reference_images table instead';



