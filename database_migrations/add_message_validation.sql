-- Add validation tracking to direct messages
-- Version: 1.1.0
-- Date: 2025-12-27
-- Description: Adds field to track if agent messages were validated by human

-- Add human_validated field to track if message was reviewed/approved by profile owner
ALTER TABLE direct_messages 
ADD COLUMN IF NOT EXISTS human_validated VARCHAR DEFAULT 'false' 
CHECK (human_validated IN ('true', 'false'));

-- Add index for querying validated messages
CREATE INDEX IF NOT EXISTS idx_direct_messages_validated 
    ON direct_messages(human_validated);

COMMENT ON COLUMN direct_messages.human_validated IS 'true if agent message was reviewed and approved by the profile owner, false otherwise';





