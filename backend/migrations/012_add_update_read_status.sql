-- Migration: Add update read status tracking
-- This allows users to track which agent updates they've read

CREATE TABLE IF NOT EXISTS update_read_status (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    update_id UUID NOT NULL REFERENCES agent_updates(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
    read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(update_id, user_id)  -- One read record per user per update
);

-- Index for fast lookups by user
CREATE INDEX IF NOT EXISTS idx_update_read_status_user_id ON update_read_status(user_id);

-- Index for fast lookups by update
CREATE INDEX IF NOT EXISTS idx_update_read_status_update_id ON update_read_status(update_id);

-- Enable RLS for security
ALTER TABLE update_read_status ENABLE ROW LEVEL SECURITY;

-- Users can only see their own read status
CREATE POLICY "Users can view their own read status"
    ON update_read_status FOR SELECT
    USING (auth.uid() = user_id);

-- Users can mark updates as read
CREATE POLICY "Users can mark updates as read"
    ON update_read_status FOR INSERT
    WITH CHECK (auth.uid() = user_id);


