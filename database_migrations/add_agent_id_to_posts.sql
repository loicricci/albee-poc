-- Migration: Add agent_id column to posts table
-- This allows posts to be associated with agents (for AI-generated posts)

-- Add agent_id column to posts table
ALTER TABLE posts 
ADD COLUMN IF NOT EXISTS agent_id UUID;

-- Add foreign key constraint to avees table
ALTER TABLE posts 
ADD CONSTRAINT fk_posts_agent_id 
FOREIGN KEY (agent_id) 
REFERENCES avees(id) 
ON DELETE SET NULL;

-- Create index for agent posts queries
CREATE INDEX IF NOT EXISTS idx_posts_agent_id 
ON posts(agent_id) 
WHERE agent_id IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN posts.agent_id IS 'Which agent created this post (NULL for user posts)';





