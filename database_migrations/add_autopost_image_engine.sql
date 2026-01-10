-- Database Migration: Add Autopost Image Engine Selection
-- Date: 2025-01-02
-- Description: Adds support for OpenAI Image Edits API with reference images and masks

-- Add reference image columns to avees table
ALTER TABLE avees 
ADD COLUMN IF NOT EXISTS reference_image_url TEXT,
ADD COLUMN IF NOT EXISTS reference_image_mask_url TEXT,
ADD COLUMN IF NOT EXISTS image_edit_instructions TEXT;

-- Add engine tracking to posts table
ALTER TABLE posts 
ADD COLUMN IF NOT EXISTS image_generation_engine VARCHAR(50) DEFAULT 'dall-e-3';

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_posts_image_engine ON posts(image_generation_engine);
CREATE INDEX IF NOT EXISTS idx_avees_reference_image ON avees(reference_image_url) WHERE reference_image_url IS NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN avees.reference_image_url IS 'URL to reference image for OpenAI Image Edits (required for edits mode)';
COMMENT ON COLUMN avees.reference_image_mask_url IS 'URL to optional mask image for targeted edits (if null, entire image is edited)';
COMMENT ON COLUMN avees.image_edit_instructions IS 'Optional default instructions for image editing prompts';
COMMENT ON COLUMN posts.image_generation_engine IS 'Image generation engine used: dall-e-3 or openai-edits';





