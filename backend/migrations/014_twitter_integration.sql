-- Migration: Twitter Integration
-- Adds tables for Twitter auto-fetch configuration

-- Create twitter_configs table
CREATE TABLE IF NOT EXISTS twitter_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    avee_id UUID NOT NULL UNIQUE REFERENCES avees(id) ON DELETE CASCADE,
    
    -- Twitter API settings
    is_enabled TEXT DEFAULT 'false',
    search_topics TEXT,  -- JSON array of search topics
    twitter_accounts TEXT,  -- JSON array of Twitter handles
    
    -- Fetch settings
    max_tweets_per_fetch INTEGER DEFAULT 10,
    fetch_frequency_hours INTEGER DEFAULT 24,
    last_fetch_at TIMESTAMPTZ,
    
    -- Storage settings
    layer avee_layer NOT NULL DEFAULT 'public',
    auto_create_updates TEXT DEFAULT 'true',
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ
);

-- Create index on avee_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_twitter_configs_avee_id ON twitter_configs(avee_id);

-- Create index on enabled configs for batch sync
CREATE INDEX IF NOT EXISTS idx_twitter_configs_enabled ON twitter_configs(is_enabled) WHERE is_enabled = 'true';


-- Create twitter_fetch_logs table
CREATE TABLE IF NOT EXISTS twitter_fetch_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    avee_id UUID NOT NULL REFERENCES avees(id) ON DELETE CASCADE,
    
    fetch_status TEXT NOT NULL,  -- success, error, partial
    tweets_fetched INTEGER DEFAULT 0,
    updates_created INTEGER DEFAULT 0,
    error_message TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index on avee_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_twitter_fetch_logs_avee_id ON twitter_fetch_logs(avee_id);

-- Create index on created_at for time-based queries
CREATE INDEX IF NOT EXISTS idx_twitter_fetch_logs_created_at ON twitter_fetch_logs(created_at DESC);

-- Add comment to document the purpose
COMMENT ON TABLE twitter_configs IS 'Stores Twitter auto-fetch configuration per agent for automated tweet collection';
COMMENT ON TABLE twitter_fetch_logs IS 'Logs Twitter fetch operations for debugging and analytics';




