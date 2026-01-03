-- Messaging System Database Migration
-- Version: 1.0.0
-- Date: 2025-12-27
-- Description: Creates tables for direct messaging system with profile and agent chat support

-- ============================================================================
-- Table: direct_conversations
-- Description: Stores conversation metadata between two users
-- ============================================================================

CREATE TABLE IF NOT EXISTS direct_conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Participants
    participant1_user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
    participant2_user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
    
    -- Chat type: 'profile' (direct to profile inbox) or 'agent' (to profile's agent)
    chat_type VARCHAR NOT NULL DEFAULT 'profile' CHECK (chat_type IN ('profile', 'agent')),
    
    -- If chat_type is 'agent', this stores which agent is being chatted with
    target_avee_id UUID REFERENCES avees(id) ON DELETE SET NULL,
    
    -- Last message info for sorting and preview
    last_message_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_message_preview TEXT,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE
);

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_direct_conversations_participant1 
    ON direct_conversations(participant1_user_id);

CREATE INDEX IF NOT EXISTS idx_direct_conversations_participant2 
    ON direct_conversations(participant2_user_id);

CREATE INDEX IF NOT EXISTS idx_direct_conversations_avee 
    ON direct_conversations(target_avee_id);

CREATE INDEX IF NOT EXISTS idx_direct_conversations_last_message 
    ON direct_conversations(last_message_at DESC);

CREATE INDEX IF NOT EXISTS idx_direct_conversations_chat_type 
    ON direct_conversations(chat_type);

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_direct_conversations_p1_last_msg 
    ON direct_conversations(participant1_user_id, last_message_at DESC);

CREATE INDEX IF NOT EXISTS idx_direct_conversations_p2_last_msg 
    ON direct_conversations(participant2_user_id, last_message_at DESC);


-- ============================================================================
-- Table: direct_messages
-- Description: Stores individual messages in direct conversations
-- ============================================================================

CREATE TABLE IF NOT EXISTS direct_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Conversation reference
    conversation_id UUID NOT NULL REFERENCES direct_conversations(id) ON DELETE CASCADE,
    
    -- Sender information
    sender_user_id UUID REFERENCES profiles(user_id) ON DELETE CASCADE,
    sender_type VARCHAR NOT NULL CHECK (sender_type IN ('user', 'agent', 'system')),
    
    -- If sender is agent, store which agent
    sender_avee_id UUID REFERENCES avees(id) ON DELETE SET NULL,
    
    -- Message content
    content TEXT NOT NULL,
    
    -- Read status tracking (stored as VARCHAR for consistency with existing code)
    read_by_participant1 VARCHAR DEFAULT 'false' CHECK (read_by_participant1 IN ('true', 'false')),
    read_by_participant2 VARCHAR DEFAULT 'false' CHECK (read_by_participant2 IN ('true', 'false')),
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_direct_messages_conversation 
    ON direct_messages(conversation_id);

CREATE INDEX IF NOT EXISTS idx_direct_messages_sender 
    ON direct_messages(sender_user_id);

CREATE INDEX IF NOT EXISTS idx_direct_messages_created 
    ON direct_messages(created_at);

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_direct_messages_conv_created 
    ON direct_messages(conversation_id, created_at);

CREATE INDEX IF NOT EXISTS idx_direct_messages_sender_created 
    ON direct_messages(sender_user_id, created_at);


-- ============================================================================
-- Row Level Security (RLS) Policies
-- Description: Security policies to ensure users can only access their own data
-- ============================================================================

-- Enable RLS on both tables
ALTER TABLE direct_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE direct_messages ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view conversations they're part of
CREATE POLICY direct_conversations_select_policy ON direct_conversations
    FOR SELECT
    USING (
        auth.uid() = participant1_user_id OR 
        auth.uid() = participant2_user_id OR
        -- Agent owners can view conversations with their agents
        EXISTS (
            SELECT 1 FROM avees 
            WHERE avees.id = target_avee_id 
            AND avees.owner_user_id = auth.uid()
        )
    );

-- Policy: Users can insert conversations where they're a participant
CREATE POLICY direct_conversations_insert_policy ON direct_conversations
    FOR INSERT
    WITH CHECK (
        auth.uid() = participant1_user_id OR 
        auth.uid() = participant2_user_id
    );

-- Policy: Users can update conversations they're part of
CREATE POLICY direct_conversations_update_policy ON direct_conversations
    FOR UPDATE
    USING (
        auth.uid() = participant1_user_id OR 
        auth.uid() = participant2_user_id
    );

-- Policy: Users can view messages in conversations they're part of
CREATE POLICY direct_messages_select_policy ON direct_messages
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM direct_conversations
            WHERE direct_conversations.id = conversation_id
            AND (
                direct_conversations.participant1_user_id = auth.uid() OR
                direct_conversations.participant2_user_id = auth.uid() OR
                -- Agent owners can view messages in conversations with their agents
                EXISTS (
                    SELECT 1 FROM avees 
                    WHERE avees.id = direct_conversations.target_avee_id 
                    AND avees.owner_user_id = auth.uid()
                )
            )
        )
    );

-- Policy: Users can insert messages in conversations they're part of
CREATE POLICY direct_messages_insert_policy ON direct_messages
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM direct_conversations
            WHERE direct_conversations.id = conversation_id
            AND (
                direct_conversations.participant1_user_id = auth.uid() OR
                direct_conversations.participant2_user_id = auth.uid()
            )
        )
    );

-- Policy: Users can update messages they sent (for read status updates)
CREATE POLICY direct_messages_update_policy ON direct_messages
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM direct_conversations
            WHERE direct_conversations.id = conversation_id
            AND (
                direct_conversations.participant1_user_id = auth.uid() OR
                direct_conversations.participant2_user_id = auth.uid()
            )
        )
    );


-- ============================================================================
-- Triggers
-- Description: Automatic updates for conversation metadata
-- ============================================================================

-- Function to update conversation's last_message_at when a new message is sent
CREATE OR REPLACE FUNCTION update_conversation_last_message()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE direct_conversations
    SET 
        last_message_at = NEW.created_at,
        last_message_preview = LEFT(NEW.content, 100),
        updated_at = NOW()
    WHERE id = NEW.conversation_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic conversation update
DROP TRIGGER IF EXISTS trigger_update_conversation_last_message ON direct_messages;
CREATE TRIGGER trigger_update_conversation_last_message
    AFTER INSERT ON direct_messages
    FOR EACH ROW
    EXECUTE FUNCTION update_conversation_last_message();


-- ============================================================================
-- Cleanup and Maintenance Functions
-- ============================================================================

-- Function to clean up old read messages (optional, for data retention)
CREATE OR REPLACE FUNCTION cleanup_old_messages(days_to_keep INTEGER DEFAULT 365)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    WITH deleted AS (
        DELETE FROM direct_messages
        WHERE 
            created_at < NOW() - (days_to_keep || ' days')::INTERVAL
            AND read_by_participant1 = 'true'
            AND read_by_participant2 = 'true'
        RETURNING *
    )
    SELECT COUNT(*) INTO deleted_count FROM deleted;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to get conversation statistics
CREATE OR REPLACE FUNCTION get_conversation_stats(conv_id UUID)
RETURNS TABLE(
    total_messages BIGINT,
    unread_p1 BIGINT,
    unread_p2 BIGINT,
    first_message_at TIMESTAMP WITH TIME ZONE,
    last_message_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(*) as total_messages,
        COUNT(*) FILTER (WHERE read_by_participant1 = 'false' AND sender_type != 'system') as unread_p1,
        COUNT(*) FILTER (WHERE read_by_participant2 = 'false' AND sender_type != 'system') as unread_p2,
        MIN(created_at) as first_message_at,
        MAX(created_at) as last_message_at
    FROM direct_messages
    WHERE conversation_id = conv_id;
END;
$$ LANGUAGE plpgsql;


-- ============================================================================
-- Sample Data (for testing only - remove in production)
-- ============================================================================

-- Uncomment to add sample data for testing:
/*
-- Sample conversation (profile to profile)
INSERT INTO direct_conversations (id, participant1_user_id, participant2_user_id, chat_type)
VALUES (
    'a0000000-0000-0000-0000-000000000001'::UUID,
    (SELECT user_id FROM profiles LIMIT 1),
    (SELECT user_id FROM profiles OFFSET 1 LIMIT 1),
    'profile'
);

-- Sample messages
INSERT INTO direct_messages (conversation_id, sender_user_id, sender_type, content)
VALUES 
    (
        'a0000000-0000-0000-0000-000000000001'::UUID,
        (SELECT user_id FROM profiles LIMIT 1),
        'user',
        'Hello! How are you?'
    ),
    (
        'a0000000-0000-0000-0000-000000000001'::UUID,
        (SELECT user_id FROM profiles OFFSET 1 LIMIT 1),
        'user',
        'I''m doing great, thanks for asking!'
    );
*/


-- ============================================================================
-- Verification Queries
-- ============================================================================

-- Check if tables were created successfully
SELECT 
    schemaname,
    tablename,
    tableowner
FROM pg_tables
WHERE tablename IN ('direct_conversations', 'direct_messages')
ORDER BY tablename;

-- Check indexes
SELECT 
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename IN ('direct_conversations', 'direct_messages')
ORDER BY tablename, indexname;

-- Check RLS policies
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename IN ('direct_conversations', 'direct_messages')
ORDER BY tablename, policyname;


-- ============================================================================
-- Migration Complete
-- ============================================================================

-- Display success message
DO $$
BEGIN
    RAISE NOTICE '✅ Messaging system migration completed successfully!';
    RAISE NOTICE '📊 Tables created: direct_conversations, direct_messages';
    RAISE NOTICE '🔒 RLS policies enabled and configured';
    RAISE NOTICE '⚡ Triggers and functions created';
    RAISE NOTICE '📝 Ready to use!';
END $$;








