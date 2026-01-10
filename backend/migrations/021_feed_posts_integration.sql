-- Migration: Add indexes for unified feed (posts + updates)
-- Optimizes queries for fetching posts from followed agents

-- Add index for feed queries (agent_id + created_at)
-- Speeds up: "SELECT * FROM posts WHERE agent_id IN (...) ORDER BY created_at DESC"
CREATE INDEX IF NOT EXISTS idx_posts_agent_created 
ON posts(agent_id, created_at DESC) 
WHERE agent_id IS NOT NULL;

-- Add index for owner posts
-- Speeds up: "SELECT * FROM posts WHERE owner_user_id = ... ORDER BY created_at DESC"
CREATE INDEX IF NOT EXISTS idx_posts_owner_created 
ON posts(owner_user_id, created_at DESC);

-- Add composite index for visibility filtering
-- Speeds up: "SELECT * FROM posts WHERE agent_id IN (...) AND visibility = 'public'"
CREATE INDEX IF NOT EXISTS idx_posts_agent_visibility_created
ON posts(agent_id, visibility, created_at DESC)
WHERE agent_id IS NOT NULL;

-- Verify indexes were created
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'posts' 
    AND indexname LIKE 'idx_posts_%'
ORDER BY indexname;







