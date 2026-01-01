-- Migration: Add advanced AI conversation features
-- Run this SQL script on your PostgreSQL database

-- 1. Add persona_notes column to avees table
ALTER TABLE avees 
ADD COLUMN IF NOT EXISTS persona_notes TEXT;

-- 2. Create conversation_summaries table
CREATE TABLE IF NOT EXISTS conversation_summaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    summary TEXT NOT NULL,
    messages_included INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conversation_summaries_conversation 
ON conversation_summaries(conversation_id);

CREATE INDEX IF NOT EXISTS idx_conversation_summaries_created 
ON conversation_summaries(created_at DESC);

-- 3. Create avee_memories table with vector support
CREATE TABLE IF NOT EXISTS avee_memories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    avee_id UUID NOT NULL REFERENCES avees(id) ON DELETE CASCADE,
    memory_type VARCHAR(50) NOT NULL CHECK (memory_type IN ('fact', 'preference', 'relationship', 'event')),
    content TEXT NOT NULL,
    confidence_score INTEGER CHECK (confidence_score >= 0 AND confidence_score <= 100),
    source_message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
    embedding vector(1536),  -- OpenAI text-embedding-3-small dimension
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_avee_memories_avee 
ON avee_memories(avee_id);

CREATE INDEX IF NOT EXISTS idx_avee_memories_type 
ON avee_memories(memory_type);

CREATE INDEX IF NOT EXISTS idx_avee_memories_created 
ON avee_memories(created_at DESC);

-- Vector similarity search index (using HNSW for fast approximate search)
CREATE INDEX IF NOT EXISTS idx_avee_memories_embedding 
ON avee_memories USING hnsw (embedding vector_cosine_ops);

-- 4. Create conversation_quality table
CREATE TABLE IF NOT EXISTS conversation_quality (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    relevance_score INTEGER CHECK (relevance_score >= 0 AND relevance_score <= 100),
    engagement_score INTEGER CHECK (engagement_score >= 0 AND engagement_score <= 100),
    factual_grounding INTEGER CHECK (factual_grounding >= 0 AND factual_grounding <= 100),
    issues TEXT,  -- JSON array stored as text
    suggestions TEXT,  -- JSON array stored as text
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conversation_quality_conversation 
ON conversation_quality(conversation_id);

CREATE INDEX IF NOT EXISTS idx_conversation_quality_message 
ON conversation_quality(message_id);

CREATE INDEX IF NOT EXISTS idx_conversation_quality_created 
ON conversation_quality(created_at DESC);

-- 5. Add comment documentation
COMMENT ON TABLE conversation_summaries IS 'Stores AI-generated conversation summaries for context optimization';
COMMENT ON TABLE avee_memories IS 'Stores structured semantic memories extracted from conversations';
COMMENT ON TABLE conversation_quality IS 'Tracks conversation quality metrics for analytics and improvement';

COMMENT ON COLUMN avees.persona_notes IS 'AI-generated insights about conversation patterns and persona characteristics';
COMMENT ON COLUMN avee_memories.memory_type IS 'Type of memory: fact (concrete info), preference (likes/dislikes), relationship (mentions of others), event (important events)';
COMMENT ON COLUMN avee_memories.confidence_score IS 'Confidence in the extracted memory, 0-100';
COMMENT ON COLUMN avee_memories.embedding IS 'Vector embedding for semantic memory search';

-- 6. Grant permissions (adjust user as needed)
-- GRANT ALL ON conversation_summaries TO your_db_user;
-- GRANT ALL ON avee_memories TO your_db_user;
-- GRANT ALL ON conversation_quality TO your_db_user;

-- Migration complete!
-- Next steps:
-- 1. Run this script on your database
-- 2. Update backend/requirements.txt to include:
--    - openai[datalib]
--    - sentence-transformers
-- 3. Restart your backend server







