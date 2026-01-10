-- Migration 008: Agent Updates Feature
-- Allows agent owners to post timestamped updates that become part of agent knowledge

-- Create agent_updates table
CREATE TABLE IF NOT EXISTS agent_updates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    avee_id UUID NOT NULL REFERENCES avees(id) ON DELETE CASCADE,
    owner_user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
    
    -- Content
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    topic TEXT,  -- e.g., "work", "personal", "project", "family", "news", "travel"
    
    -- Access control
    layer avee_layer NOT NULL DEFAULT 'public',
    
    -- Metadata
    is_pinned BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE,
    
    -- Constraints
    CONSTRAINT check_content_length CHECK (length(content) > 0 AND length(content) <= 10000),
    CONSTRAINT check_title_length CHECK (length(title) > 0 AND length(title) <= 200)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_agent_updates_avee_id ON agent_updates(avee_id);
CREATE INDEX IF NOT EXISTS idx_agent_updates_owner_user_id ON agent_updates(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_agent_updates_created_at ON agent_updates(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_updates_topic ON agent_updates(topic);
CREATE INDEX IF NOT EXISTS idx_agent_updates_layer ON agent_updates(layer);
CREATE INDEX IF NOT EXISTS idx_agent_updates_pinned ON agent_updates(is_pinned) WHERE is_pinned = TRUE;

-- Add comment to explain table purpose
COMMENT ON TABLE agent_updates IS 'Stores timestamped updates from agent owners that become part of agent knowledge base';
COMMENT ON COLUMN agent_updates.topic IS 'Category/tag for the update (work, personal, project, family, news, etc.)';
COMMENT ON COLUMN agent_updates.is_pinned IS 'Pinned updates appear at the top of the list';
COMMENT ON COLUMN agent_updates.layer IS 'Privacy layer - determines who can see this update (public, friends, intimate)';













