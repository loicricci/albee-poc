-- Migration: Add agent_id to posts table to track which agent created each post
-- This fixes the issue where all posts from a user's agents show up on all agent pages

-- Add agent_id column to posts table
ALTER TABLE posts 
ADD COLUMN IF NOT EXISTS agent_id UUID;

-- Add foreign key constraint (optional, will be null for user posts)
ALTER TABLE posts 
ADD CONSTRAINT fk_posts_agent_id 
FOREIGN KEY (agent_id) 
REFERENCES avees(id) 
ON DELETE SET NULL;

-- Create index for efficient querying by agent_id
CREATE INDEX IF NOT EXISTS idx_posts_agent_id 
ON posts(agent_id) 
WHERE agent_id IS NOT NULL;

-- Create composite index for agent posts with visibility
CREATE INDEX IF NOT EXISTS idx_posts_agent_visibility 
ON posts(agent_id, visibility, created_at DESC) 
WHERE agent_id IS NOT NULL;

-- Comment the column
COMMENT ON COLUMN posts.agent_id IS 'ID of the agent that created this post (NULL for user posts)';


