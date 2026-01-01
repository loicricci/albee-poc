-- Migration: Create agent_followers table for profile-to-agent following
-- Replaces the old profile-to-profile relationship model

-- Create new agent_followers table
CREATE TABLE IF NOT EXISTS agent_followers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    follower_user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
    avee_id UUID NOT NULL REFERENCES avees(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure a profile can only follow an agent once
    UNIQUE(follower_user_id, avee_id)
);

-- Create indices for performance
CREATE INDEX IF NOT EXISTS idx_agent_followers_follower ON agent_followers(follower_user_id);
CREATE INDEX IF NOT EXISTS idx_agent_followers_avee ON agent_followers(avee_id);

-- Optional: Migrate existing profile-to-profile follows to agent follows
-- This assumes users who follow profiles should follow all their agents
-- Comment out if you don't want to migrate existing data
INSERT INTO agent_followers (follower_user_id, avee_id, created_at)
SELECT DISTINCT 
    r.from_user_id,
    a.id,
    r.created_at
FROM relationships r
JOIN avees a ON a.owner_user_id = r.to_user_id
WHERE r.type = 'follow'
ON CONFLICT (follower_user_id, avee_id) DO NOTHING;

-- Note: We keep the relationships table for backwards compatibility
-- and for potential future friend/block features
-- You can drop it later if not needed:
-- DROP TABLE IF EXISTS relationships CASCADE;







