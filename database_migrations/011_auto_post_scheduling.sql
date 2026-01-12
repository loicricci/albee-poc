-- =====================================================
-- Migration: Auto-Post Scheduling Enhancements
-- Description: Add scheduling preferences per agent
-- Date: 2025-01-12
-- =====================================================

-- Add scheduling preference columns to avees table
-- These allow per-agent customization of auto-post timing

-- Preferred hour for auto-posting (0-23 in agent's timezone)
ALTER TABLE avees 
ADD COLUMN IF NOT EXISTS auto_post_hour INTEGER DEFAULT 9;

-- Timezone for scheduling (IANA timezone string)
ALTER TABLE avees 
ADD COLUMN IF NOT EXISTS auto_post_timezone TEXT DEFAULT 'UTC';

-- Posting frequency: 'daily', 'weekdays', 'weekly', 'custom'
ALTER TABLE avees 
ADD COLUMN IF NOT EXISTS auto_post_frequency TEXT DEFAULT 'daily';

-- Store last error for debugging (truncated to 500 chars)
ALTER TABLE avees 
ADD COLUMN IF NOT EXISTS auto_post_last_error TEXT;

-- Add comments for documentation
COMMENT ON COLUMN avees.auto_post_hour IS 'Preferred hour (0-23) for auto-posting in agent timezone';
COMMENT ON COLUMN avees.auto_post_timezone IS 'IANA timezone (e.g., America/New_York) for scheduling';
COMMENT ON COLUMN avees.auto_post_frequency IS 'Posting frequency: daily, weekdays, weekly, custom';
COMMENT ON COLUMN avees.auto_post_last_error IS 'Last error message from auto-post attempt (for debugging)';

-- Create index for efficient querying of enabled agents at specific hours
CREATE INDEX IF NOT EXISTS idx_avees_auto_post_scheduling 
ON avees(auto_post_enabled, auto_post_hour, auto_post_timezone) 
WHERE auto_post_enabled = true;

-- =====================================================
-- Verification query (run after migration)
-- =====================================================
-- SELECT column_name, data_type, column_default 
-- FROM information_schema.columns 
-- WHERE table_name = 'avees' 
-- AND column_name LIKE 'auto_post_%';
