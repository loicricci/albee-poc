-- Migration: Create notifications table
-- Description: Adds notification system for user activities

-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
    
    -- Notification type: agent_update, post_like, post_comment, post_repost, autopost_success, new_message
    notification_type VARCHAR(50) NOT NULL,
    
    -- Title and message
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    
    -- Link to relevant resource
    link TEXT,
    
    -- Related entity IDs (stored for context)
    related_user_id UUID REFERENCES profiles(user_id) ON DELETE CASCADE,
    related_agent_id UUID REFERENCES avees(id) ON DELETE CASCADE,
    related_post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
    related_update_id UUID REFERENCES agent_updates(id) ON DELETE CASCADE,
    related_message_id UUID REFERENCES direct_messages(id) ON DELETE CASCADE,
    
    -- Read status
    is_read VARCHAR(10) DEFAULT 'false',
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(notification_type);
CREATE INDEX IF NOT EXISTS idx_notifications_related_post ON notifications(related_post_id) WHERE related_post_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_related_update ON notifications(related_update_id) WHERE related_update_id IS NOT NULL;

-- Enable Row Level Security
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own notifications
CREATE POLICY notifications_select_own ON notifications
    FOR SELECT
    USING (auth.uid() = user_id);

-- Policy: System can insert notifications (no user access needed)
CREATE POLICY notifications_insert_system ON notifications
    FOR INSERT
    WITH CHECK (true);

-- Policy: Users can update their own notifications (mark as read)
CREATE POLICY notifications_update_own ON notifications
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own notifications
CREATE POLICY notifications_delete_own ON notifications
    FOR DELETE
    USING (auth.uid() = user_id);

-- Add comment to table
COMMENT ON TABLE notifications IS 'Stores user notifications for various activities (agent updates, likes, comments, messages, etc.)';
COMMENT ON COLUMN notifications.notification_type IS 'Type of notification: agent_update, post_like, post_comment, post_repost, autopost_success, new_message';
COMMENT ON COLUMN notifications.is_read IS 'Whether the notification has been read (stored as string for consistency)';



