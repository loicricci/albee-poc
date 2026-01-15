-- ================================================================================
-- LinkedIn User Integration Migration
-- ================================================================================
-- This migration adds support for users to connect their LinkedIn accounts
-- and configure per-agent LinkedIn sharing with auto-post or manual approval modes.
-- Supports both personal profiles and company pages.

-- Profile LinkedIn configs (one per user)
CREATE TABLE IF NOT EXISTS profile_linkedin_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
    linkedin_user_id TEXT NOT NULL,  -- LinkedIn member URN (e.g., "urn:li:person:ABC123")
    linkedin_username TEXT NOT NULL,  -- Display name
    linkedin_profile_url TEXT,  -- Profile URL
    access_token TEXT NOT NULL,
    refresh_token TEXT,  -- LinkedIn OAuth 2.0 uses refresh tokens
    token_expires_at TIMESTAMPTZ,  -- Access token expiration (typically 60 days)
    organizations TEXT,  -- JSON array of company pages user can post to
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- OAuth states for CSRF protection during OAuth flow
CREATE TABLE IF NOT EXISTS linkedin_oauth_states (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    state TEXT UNIQUE NOT NULL,
    code_verifier TEXT NOT NULL,  -- PKCE code verifier
    user_id UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add LinkedIn columns to avees table
ALTER TABLE avees 
    ADD COLUMN IF NOT EXISTS linkedin_sharing_enabled BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS linkedin_posting_mode TEXT DEFAULT 'manual',
    ADD COLUMN IF NOT EXISTS linkedin_target_type TEXT DEFAULT 'personal',  -- 'personal' or 'organization'
    ADD COLUMN IF NOT EXISTS linkedin_organization_id TEXT;  -- Organization URN if posting to company page

-- Add LinkedIn columns to posts table
ALTER TABLE posts
    ADD COLUMN IF NOT EXISTS posted_to_linkedin BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS linkedin_post_id TEXT,
    ADD COLUMN IF NOT EXISTS linkedin_post_url TEXT,
    ADD COLUMN IF NOT EXISTS linkedin_posted_at TIMESTAMPTZ;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_profile_linkedin_user_id ON profile_linkedin_configs(user_id);
CREATE INDEX IF NOT EXISTS idx_posts_linkedin_status ON posts(posted_to_linkedin, agent_id);
CREATE INDEX IF NOT EXISTS idx_avees_linkedin_enabled ON avees(linkedin_sharing_enabled) WHERE linkedin_sharing_enabled = true;
CREATE INDEX IF NOT EXISTS idx_linkedin_oauth_states_user ON linkedin_oauth_states(user_id);
CREATE INDEX IF NOT EXISTS idx_linkedin_oauth_states_created ON linkedin_oauth_states(created_at);

-- Function to clean up old OAuth states (older than 10 minutes)
CREATE OR REPLACE FUNCTION cleanup_old_linkedin_oauth_states() RETURNS void AS $$
BEGIN
    DELETE FROM linkedin_oauth_states WHERE created_at < NOW() - INTERVAL '10 minutes';
END;
$$ LANGUAGE plpgsql;

-- Comment on tables
COMMENT ON TABLE profile_linkedin_configs IS 'Stores LinkedIn OAuth tokens for user profiles';
COMMENT ON TABLE linkedin_oauth_states IS 'Temporary OAuth state tokens for CSRF protection (auto-cleaned after 10 minutes)';
COMMENT ON COLUMN avees.linkedin_sharing_enabled IS 'Whether this agent can share posts to LinkedIn';
COMMENT ON COLUMN avees.linkedin_posting_mode IS 'LinkedIn posting mode: auto (immediate) or manual (review first)';
COMMENT ON COLUMN avees.linkedin_target_type IS 'LinkedIn posting target: personal (user profile) or organization (company page)';
COMMENT ON COLUMN avees.linkedin_organization_id IS 'LinkedIn organization URN for company page posting';
COMMENT ON COLUMN posts.posted_to_linkedin IS 'Whether this post has been shared to LinkedIn';
COMMENT ON COLUMN posts.linkedin_post_id IS 'LinkedIn post/share ID';
COMMENT ON COLUMN posts.linkedin_post_url IS 'Full LinkedIn URL to the post';
COMMENT ON COLUMN posts.linkedin_posted_at IS 'Timestamp when posted to LinkedIn';
