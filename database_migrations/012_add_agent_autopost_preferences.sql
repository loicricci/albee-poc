-- Migration 012: Add auto-post preferences to avees table
-- These fields allow agents to have personalized topic selection for auto-posts

-- Add preferred_topics column for storing comma-separated topics of interest
ALTER TABLE avees ADD COLUMN IF NOT EXISTS preferred_topics TEXT;

-- Add location column for geographic context in news selection
ALTER TABLE avees ADD COLUMN IF NOT EXISTS location VARCHAR(255);

-- Add comments for documentation
COMMENT ON COLUMN avees.preferred_topics IS 'Comma-separated list of preferred topics for auto-post article selection (e.g., "music, technology, space")';
COMMENT ON COLUMN avees.location IS 'Agent location context for news personalization (e.g., "London, UK")';
