-- ============================================================================
-- Unified Profile-Agent Messaging Migration
-- ============================================================================
-- 
-- This migration unifies profile and agent conversations so that the 
-- orchestrator always evaluates messages and decides whether the agent
-- can respond or if it should queue for the human.
--
-- Phase 1: Add is_primary column to avees table
-- Phase 2: Create helper function to get user's primary agent
-- Phase 3: Prepare for chat_type/target_avee_id removal (but keep for now)
-- ============================================================================

-- ============================================================================
-- PHASE 1: Update avees table
-- ============================================================================

-- Add is_primary column to mark which agent represents the user
ALTER TABLE avees 
ADD COLUMN IF NOT EXISTS is_primary BOOLEAN DEFAULT false;

-- Create unique index to ensure only one primary agent per user
DROP INDEX IF EXISTS idx_avees_owner_primary;
CREATE UNIQUE INDEX idx_avees_owner_primary 
ON avees (owner_user_id) 
WHERE is_primary = true;

-- Add comment to explain the column
COMMENT ON COLUMN avees.is_primary IS 
'Marks the primary agent for this user. Only one agent per user can be primary. 
Used by the orchestrator to automatically respond to messages on behalf of the user.';

-- ============================================================================
-- PHASE 2: Helper Functions
-- ============================================================================

-- Function to get user's primary agent
CREATE OR REPLACE FUNCTION get_user_primary_agent(user_uuid UUID)
RETURNS UUID AS $$
BEGIN
    RETURN (
        SELECT id 
        FROM avees 
        WHERE owner_user_id = user_uuid 
          AND is_primary = true 
        LIMIT 1
    );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_user_primary_agent(UUID) IS
'Returns the primary agent ID for a given user, or NULL if the user has no primary agent.';

-- Function to set an agent as primary (and unset others)
CREATE OR REPLACE FUNCTION set_primary_agent(agent_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
    agent_owner UUID;
BEGIN
    -- Get the owner of this agent
    SELECT owner_user_id INTO agent_owner
    FROM avees 
    WHERE id = agent_uuid;
    
    IF agent_owner IS NULL THEN
        RETURN false;
    END IF;
    
    -- Unset all other primary agents for this user
    UPDATE avees 
    SET is_primary = false 
    WHERE owner_user_id = agent_owner 
      AND id != agent_uuid;
    
    -- Set this agent as primary
    UPDATE avees 
    SET is_primary = true 
    WHERE id = agent_uuid;
    
    RETURN true;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION set_primary_agent(UUID) IS
'Sets the specified agent as the primary agent for its owner, 
automatically unsetting any other primary agents for that user.';

-- ============================================================================
-- PHASE 3: Mark existing agents as primary
-- ============================================================================

-- For each user with agents, mark their first agent (by creation date) as primary
-- This ensures backward compatibility with existing agent conversations

DO $$
DECLARE
    user_record RECORD;
    first_agent_id UUID;
BEGIN
    -- Get all users who own at least one agent
    FOR user_record IN 
        SELECT DISTINCT owner_user_id 
        FROM avees 
        WHERE owner_user_id IS NOT NULL
    LOOP
        -- Get the first agent (oldest) for this user
        SELECT id INTO first_agent_id
        FROM avees 
        WHERE owner_user_id = user_record.owner_user_id
        ORDER BY created_at ASC
        LIMIT 1;
        
        -- Mark it as primary
        IF first_agent_id IS NOT NULL THEN
            UPDATE avees 
            SET is_primary = true 
            WHERE id = first_agent_id;
            
            RAISE NOTICE 'Marked agent % as primary for user %', 
                         first_agent_id, user_record.owner_user_id;
        END IF;
    END LOOP;
END $$;

-- ============================================================================
-- PHASE 4: Add indexes for performance
-- ============================================================================

-- Index for looking up primary agents by owner
CREATE INDEX IF NOT EXISTS idx_avees_owner_primary_lookup 
ON avees (owner_user_id, is_primary) 
WHERE is_primary = true;

-- ============================================================================
-- PHASE 5: Prepare direct_conversations table
-- ============================================================================

-- Note: We're NOT dropping chat_type and target_avee_id yet for backward compatibility
-- These columns will be ignored by the new code but kept for rollback safety
-- After confirming the new system works, we can drop them in a future migration

-- Add comment to mark these columns as deprecated
COMMENT ON COLUMN direct_conversations.chat_type IS 
'DEPRECATED: This column is no longer used in the unified messaging system. 
All conversations now route through the orchestrator which determines response strategy.
Kept for backward compatibility during transition.';

COMMENT ON COLUMN direct_conversations.target_avee_id IS 
'DEPRECATED: This column is no longer used in the unified messaging system. 
The orchestrator now looks up the recipient''s primary agent automatically.
Kept for backward compatibility during transition.';

-- ============================================================================
-- PHASE 6: Update direct_messages for system messages
-- ============================================================================

-- Ensure sender_type enum includes 'system' for Path E messages
-- Check if the type needs updating
DO $$
BEGIN
    -- Try to add 'system' to sender_type if it doesn't exist
    -- This is safe to run multiple times
    BEGIN
        ALTER TYPE sender_type ADD VALUE IF NOT EXISTS 'system';
    EXCEPTION
        WHEN duplicate_object THEN
            -- Type already exists, do nothing
            NULL;
    END;
END $$;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Verify primary agents were set correctly
SELECT 
    p.handle as user_handle,
    a.handle as agent_handle,
    a.is_primary,
    a.created_at
FROM avees a
JOIN profiles p ON a.owner_user_id = p.user_id
WHERE a.is_primary = true
ORDER BY p.handle;

-- Count conversations by type (for monitoring the transition)
SELECT 
    chat_type,
    COUNT(*) as count
FROM direct_conversations
GROUP BY chat_type;

-- ============================================================================
-- ROLLBACK SCRIPT (if needed)
-- ============================================================================

/*
-- To rollback this migration:

-- Remove is_primary column
ALTER TABLE avees DROP COLUMN IF EXISTS is_primary;

-- Drop indexes
DROP INDEX IF EXISTS idx_avees_owner_primary;
DROP INDEX IF EXISTS idx_avees_owner_primary_lookup;

-- Drop functions
DROP FUNCTION IF EXISTS get_user_primary_agent(UUID);
DROP FUNCTION IF EXISTS set_primary_agent(UUID);

-- Remove comments
COMMENT ON COLUMN direct_conversations.chat_type IS NULL;
COMMENT ON COLUMN direct_conversations.target_avee_id IS NULL;
*/

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

SELECT 'Unified messaging migration completed successfully!' as status;
