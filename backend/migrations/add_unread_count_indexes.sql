-- Migration: Add indexes for unread count performance
-- Description: Ensures proper indexes exist for /messaging/unread-count and /notifications/unread-count endpoints
-- Safe to run multiple times - uses CREATE INDEX IF NOT EXISTS

-- =====================================================
-- NOTIFICATIONS TABLE INDEXES
-- =====================================================

-- Index for unread count query: WHERE user_id = ? AND is_read = 'false'
CREATE INDEX IF NOT EXISTS idx_notifications_user_read 
  ON notifications(user_id, is_read);

-- Index for user's notifications sorted by time
CREATE INDEX IF NOT EXISTS idx_notifications_user_created 
  ON notifications(user_id, created_at DESC);

-- Index for user_id alone (fast lookups)
CREATE INDEX IF NOT EXISTS idx_notifications_user_id 
  ON notifications(user_id);

-- =====================================================
-- DIRECT CONVERSATIONS TABLE INDEXES
-- =====================================================

-- Index for finding conversations where user is participant1
CREATE INDEX IF NOT EXISTS idx_direct_conversations_participant1 
  ON direct_conversations(participant1_user_id, last_message_at DESC);

-- Index for finding conversations where user is participant2  
CREATE INDEX IF NOT EXISTS idx_direct_conversations_participant2 
  ON direct_conversations(participant2_user_id, last_message_at DESC);

-- Index for agent ownership filtering (chat_type + target_avee_id)
CREATE INDEX IF NOT EXISTS idx_direct_conversations_agent_target 
  ON direct_conversations(chat_type, target_avee_id) 
  WHERE chat_type = 'agent';

-- =====================================================
-- DIRECT MESSAGES TABLE INDEXES
-- =====================================================

-- Index for unread message counts (participant1)
CREATE INDEX IF NOT EXISTS idx_direct_messages_unread_p1 
  ON direct_messages(conversation_id, read_by_participant1, sender_user_id)
  WHERE read_by_participant1 = 'false';

-- Index for unread message counts (participant2)
CREATE INDEX IF NOT EXISTS idx_direct_messages_unread_p2 
  ON direct_messages(conversation_id, read_by_participant2, sender_user_id)
  WHERE read_by_participant2 = 'false';

-- Index for message queries by conversation and time
CREATE INDEX IF NOT EXISTS idx_direct_messages_conversation_created 
  ON direct_messages(conversation_id, created_at DESC);

-- =====================================================
-- AVEES TABLE INDEXES (for JOIN performance)
-- =====================================================

-- Index for owner lookups
CREATE INDEX IF NOT EXISTS idx_avees_owner_user_id 
  ON avees(owner_user_id);

-- =====================================================
-- ANALYZE TABLES FOR QUERY PLANNER
-- =====================================================

ANALYZE notifications;
ANALYZE direct_conversations;
ANALYZE direct_messages;
ANALYZE avees;
