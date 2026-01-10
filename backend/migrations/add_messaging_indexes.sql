-- Performance indexes for messaging system
-- Run this migration to improve query performance

-- Index for message queries by conversation and timestamp
CREATE INDEX IF NOT EXISTS idx_direct_messages_conversation_created 
  ON direct_messages(conversation_id, created_at DESC);

-- Index for unread message counts
CREATE INDEX IF NOT EXISTS idx_direct_messages_unread 
  ON direct_messages(conversation_id, read_by_participant1, read_by_participant2, sender_user_id);

-- Index for conversation list queries
CREATE INDEX IF NOT EXISTS idx_direct_conversations_participants 
  ON direct_conversations(participant1_user_id, participant2_user_id, last_message_at DESC);

-- Index for conversation filtering by participant
CREATE INDEX IF NOT EXISTS idx_direct_conversations_participant1 
  ON direct_conversations(participant1_user_id, last_message_at DESC);

CREATE INDEX IF NOT EXISTS idx_direct_conversations_participant2 
  ON direct_conversations(participant2_user_id, last_message_at DESC);

-- Index for legacy message queries
CREATE INDEX IF NOT EXISTS idx_messages_conversation_created 
  ON messages(conversation_id, created_at ASC);

-- Index for agent lookup
CREATE INDEX IF NOT EXISTS idx_avees_owner_primary 
  ON avees(owner_user_id, is_primary);

-- Index for profile lookups
CREATE INDEX IF NOT EXISTS idx_profiles_user_id 
  ON profiles(user_id);

-- Optimize vector search (if not already exists)
-- Note: This requires pgvector extension
CREATE INDEX IF NOT EXISTS idx_document_chunks_embedding_ivfflat
  ON document_chunks USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

CREATE INDEX IF NOT EXISTS idx_canonical_answers_embedding_ivfflat
  ON canonical_answers USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- Analyze tables for query planner
ANALYZE direct_messages;
ANALYZE direct_conversations;
ANALYZE messages;
ANALYZE profiles;
ANALYZE avees;
ANALYZE document_chunks;
ANALYZE canonical_answers;


