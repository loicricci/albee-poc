-- ================================================================================
-- Twitter User Integration Migration
-- ================================================================================
-- This migration adds support for users to connect their Twitter accounts
-- and configure per-agent Twitter sharing with auto-post or manual approval modes.

-- Profile Twitter configs (one per user)
CREATE TABLE IF NOT EXISTS profile_twitter_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
    twitter_user_id TEXT NOT NULL,
    twitter_username TEXT NOT NULL,
    twitter_display_name TEXT,
    access_token TEXT NOT NULL,
    access_secret TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- OAuth states for CSRF protection
CREATE TABLE IF NOT EXISTS twitter_oauth_states (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    state TEXT UNIQUE NOT NULL,
    oauth_token TEXT NOT NULL,
    oauth_token_secret TEXT NOT NULL,
    user_id UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add Twitter columns to avees table
ALTER TABLE avees 
    ADD COLUMN IF NOT EXISTS twitter_sharing_enabled BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS twitter_posting_mode TEXT DEFAULT 'manual';

-- Add Twitter columns to posts table
ALTER TABLE posts
    ADD COLUMN IF NOT EXISTS posted_to_twitter BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS twitter_post_id TEXT,
    ADD COLUMN IF NOT EXISTS twitter_post_url TEXT,
    ADD COLUMN IF NOT EXISTS twitter_posted_at TIMESTAMPTZ;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_profile_twitter_user_id ON profile_twitter_configs(user_id);
CREATE INDEX IF NOT EXISTS idx_posts_twitter_status ON posts(posted_to_twitter, agent_id);
CREATE INDEX IF NOT EXISTS idx_avees_twitter_enabled ON avees(twitter_sharing_enabled) WHERE twitter_sharing_enabled = true;
CREATE INDEX IF NOT EXISTS idx_twitter_oauth_states_user ON twitter_oauth_states(user_id);
CREATE INDEX IF NOT EXISTS idx_twitter_oauth_states_created ON twitter_oauth_states(created_at);

-- Function to clean up old OAuth states (older than 10 minutes)
CREATE OR REPLACE FUNCTION cleanup_old_twitter_oauth_states() RETURNS void AS $$
BEGIN
    DELETE FROM twitter_oauth_states WHERE created_at < NOW() - INTERVAL '10 minutes';
END;
$$ LANGUAGE plpgsql;

-- Comment on tables
COMMENT ON TABLE profile_twitter_configs IS 'Stores Twitter OAuth tokens for user profiles';
COMMENT ON TABLE twitter_oauth_states IS 'Temporary OAuth state tokens for CSRF protection (auto-cleaned after 10 minutes)';
COMMENT ON COLUMN avees.twitter_sharing_enabled IS 'Whether this agent can share posts to Twitter';
COMMENT ON COLUMN avees.twitter_posting_mode IS 'Twitter posting mode: auto (immediate) or manual (review first)';
COMMENT ON COLUMN posts.posted_to_twitter IS 'Whether this post has been shared to Twitter';
COMMENT ON COLUMN posts.twitter_post_id IS 'Twitter tweet ID';
COMMENT ON COLUMN posts.twitter_post_url IS 'Full Twitter URL to the tweet';
COMMENT ON COLUMN posts.twitter_posted_at IS 'Timestamp when posted to Twitter';

