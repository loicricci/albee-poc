-- Migration: Auto Post Generation Feature
-- Description: Add auto post generation tracking to avees table
-- Date: 2025-12-29

-- Add auto_post_enabled column to avees table
-- Note: We add without default first to avoid timeout on large tables
ALTER TABLE avees 
ADD COLUMN IF NOT EXISTS auto_post_enabled BOOLEAN;

-- Set default for future rows
ALTER TABLE avees 
ALTER COLUMN auto_post_enabled SET DEFAULT false;

-- Add last_auto_post_at column to track when last post was generated
ALTER TABLE avees 
ADD COLUMN IF NOT EXISTS last_auto_post_at TIMESTAMP WITH TIME ZONE;

-- Add auto_post_settings JSONB column for future configuration
-- Add column without default first
ALTER TABLE avees 
ADD COLUMN IF NOT EXISTS auto_post_settings JSONB;

-- Set default for future rows
ALTER TABLE avees 
ALTER COLUMN auto_post_settings SET DEFAULT '{
  "frequency": "daily",
  "preferred_time": "09:00",
  "categories": [],
  "enabled_days": ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
}'::jsonb;

-- Create index for querying enabled agents
CREATE INDEX IF NOT EXISTS idx_avees_auto_post_enabled 
ON avees(auto_post_enabled) 
WHERE auto_post_enabled = true;

-- Create index for last post time
CREATE INDEX IF NOT EXISTS idx_avees_last_auto_post_at 
ON avees(last_auto_post_at DESC);

-- Comment the columns
COMMENT ON COLUMN avees.auto_post_enabled IS 'Whether auto post generation is enabled for this agent';
COMMENT ON COLUMN avees.last_auto_post_at IS 'Timestamp of the last auto-generated post';
COMMENT ON COLUMN avees.auto_post_settings IS 'JSON configuration for auto post generation (frequency, time, categories, etc.)';

