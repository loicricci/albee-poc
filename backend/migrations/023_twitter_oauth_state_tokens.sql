-- ================================================================================
-- Add oauth_token and oauth_token_secret to twitter_oauth_states
-- ================================================================================
-- This migration adds columns to store the request tokens during OAuth flow
-- so we don't need to rely on session storage

-- Clean up any old states first (older than 10 minutes)
DELETE FROM twitter_oauth_states WHERE created_at < NOW() - INTERVAL '10 minutes';

-- Add columns with default empty string to handle existing rows
ALTER TABLE twitter_oauth_states 
    ADD COLUMN IF NOT EXISTS oauth_token TEXT DEFAULT '',
    ADD COLUMN IF NOT EXISTS oauth_token_secret TEXT DEFAULT '';

-- Make columns NOT NULL (after defaults are set)
ALTER TABLE twitter_oauth_states 
    ALTER COLUMN oauth_token SET NOT NULL,
    ALTER COLUMN oauth_token_secret SET NOT NULL;

-- Remove the default for future inserts
ALTER TABLE twitter_oauth_states 
    ALTER COLUMN oauth_token DROP DEFAULT,
    ALTER COLUMN oauth_token_secret DROP DEFAULT;

