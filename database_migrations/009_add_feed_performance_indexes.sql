-- Performance Optimization: Add Indexes for Feed Queries
-- This migration adds indexes to dramatically improve feed query performance

-- 1. Agent Followers indexes
CREATE INDEX IF NOT EXISTS idx_agent_followers_follower_user_id 
  ON agent_followers(follower_user_id);

CREATE INDEX IF NOT EXISTS idx_agent_followers_avee_id 
  ON agent_followers(avee_id);

-- 2. Post Likes indexes
CREATE INDEX IF NOT EXISTS idx_post_likes_user_id 
  ON post_likes(user_id);

CREATE INDEX IF NOT EXISTS idx_post_likes_post_id 
  ON post_likes(post_id);

-- Composite index for common query pattern (user + post)
CREATE INDEX IF NOT EXISTS idx_post_likes_user_post 
  ON post_likes(user_id, post_id);

-- 3. Post Shares (Reposts) indexes
CREATE INDEX IF NOT EXISTS idx_post_shares_user_id 
  ON post_shares(user_id);

CREATE INDEX IF NOT EXISTS idx_post_shares_post_id 
  ON post_shares(post_id);

-- Composite index for created_at ordering
CREATE INDEX IF NOT EXISTS idx_post_shares_user_created 
  ON post_shares(user_id, created_at DESC);

-- 4. Update Read Status indexes
CREATE INDEX IF NOT EXISTS idx_update_read_status_user_id 
  ON update_read_status(user_id);

CREATE INDEX IF NOT EXISTS idx_update_read_status_update_id 
  ON update_read_status(update_id);

-- Composite index for common query pattern
CREATE INDEX IF NOT EXISTS idx_update_read_status_user_update 
  ON update_read_status(user_id, update_id);

-- 5. Agent Updates indexes
CREATE INDEX IF NOT EXISTS idx_agent_updates_avee_id 
  ON agent_updates(avee_id);

-- Index for ordering by created_at
CREATE INDEX IF NOT EXISTS idx_agent_updates_avee_created 
  ON agent_updates(avee_id, created_at DESC);

-- 6. Posts indexes
CREATE INDEX IF NOT EXISTS idx_posts_agent_id 
  ON posts(agent_id);

CREATE INDEX IF NOT EXISTS idx_posts_owner_user_id 
  ON posts(owner_user_id);

-- Composite index for visibility + created_at (common query pattern)
CREATE INDEX IF NOT EXISTS idx_posts_visibility_created 
  ON posts(visibility, created_at DESC);

-- Index for agent posts ordering
CREATE INDEX IF NOT EXISTS idx_posts_agent_created 
  ON posts(agent_id, created_at DESC) 
  WHERE agent_id IS NOT NULL;

-- Index for user posts (where agent_id IS NULL)
CREATE INDEX IF NOT EXISTS idx_posts_owner_created 
  ON posts(owner_user_id, created_at DESC) 
  WHERE agent_id IS NULL;

-- 7. Avees (Agents) indexes
CREATE INDEX IF NOT EXISTS idx_avees_owner_user_id 
  ON avees(owner_user_id);

CREATE INDEX IF NOT EXISTS idx_avees_handle 
  ON avees(handle);

-- 8. Profiles indexes (if not already exists)
CREATE INDEX IF NOT EXISTS idx_profiles_handle 
  ON profiles(handle);

-- Analyze tables to update statistics
ANALYZE agent_followers;
ANALYZE post_likes;
ANALYZE post_shares;
ANALYZE update_read_status;
ANALYZE agent_updates;
ANALYZE posts;
ANALYZE avees;
ANALYZE profiles;


