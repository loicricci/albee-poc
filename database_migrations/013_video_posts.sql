-- Video Posts Migration
-- Adds video support to the posts table for SORA 2 video generation
-- Date: 2026-01-12

-- =====================================================
-- Add video-related columns to posts table
-- =====================================================

-- Video URL (for video posts, image_url is used for thumbnail fallback)
ALTER TABLE posts ADD COLUMN IF NOT EXISTS video_url TEXT;

-- Video duration in seconds
ALTER TABLE posts ADD COLUMN IF NOT EXISTS video_duration INTEGER;

-- Explicit thumbnail URL (optional - can be different from image_url)
ALTER TABLE posts ADD COLUMN IF NOT EXISTS video_thumbnail_url TEXT;

-- =====================================================
-- Add comments for documentation
-- =====================================================

COMMENT ON COLUMN posts.video_url IS 'URL to the video file (MP4) for video posts';
COMMENT ON COLUMN posts.video_duration IS 'Duration of the video in seconds';
COMMENT ON COLUMN posts.video_thumbnail_url IS 'URL to the video thumbnail image';

-- =====================================================
-- Update post_type to include video types
-- Note: If you have a CHECK constraint on post_type, update it
-- =====================================================

-- Check if constraint exists and drop it
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'posts_post_type_check'
    ) THEN
        ALTER TABLE posts DROP CONSTRAINT posts_post_type_check;
    END IF;
END $$;

-- Add updated constraint with video types
-- Includes: image, ai_generated, text, video, ai_generated_video
ALTER TABLE posts ADD CONSTRAINT posts_post_type_check 
    CHECK (post_type IN ('image', 'ai_generated', 'text', 'video', 'ai_generated_video', 'update'));

-- =====================================================
-- Add index for video posts
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_posts_video_url ON posts (video_url) WHERE video_url IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_posts_post_type ON posts (post_type);

-- =====================================================
-- Verification
-- =====================================================

-- Verify columns were added
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'posts' AND column_name = 'video_url'
    ) THEN
        RAISE EXCEPTION 'Migration failed: video_url column not found';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'posts' AND column_name = 'video_duration'
    ) THEN
        RAISE EXCEPTION 'Migration failed: video_duration column not found';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'posts' AND column_name = 'video_thumbnail_url'
    ) THEN
        RAISE EXCEPTION 'Migration failed: video_thumbnail_url column not found';
    END IF;
    
    RAISE NOTICE 'Video posts migration completed successfully!';
END $$;
