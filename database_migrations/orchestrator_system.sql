-- Orchestrator System Database Migration
-- Version: 1.0.0
-- Date: 2025-12-27
-- Description: Creates tables for the Orchestrator decision engine that routes messages intelligently

-- ============================================================================
-- ENUM Types
-- ============================================================================

-- Escalation reason types
CREATE TYPE escalation_reason AS ENUM ('novel', 'strategic', 'complex');

-- Escalation status types
CREATE TYPE escalation_status AS ENUM ('pending', 'accepted', 'answered', 'declined', 'expired');

-- Decision path types (A-F as per spec)
CREATE TYPE decision_path AS ENUM ('A', 'B', 'C', 'D', 'E', 'F');

-- ============================================================================
-- Table: orchestrator_configs
-- Description: Stores creator-defined rules and settings per agent
-- ============================================================================

CREATE TABLE IF NOT EXISTS orchestrator_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    avee_id UUID NOT NULL REFERENCES avees(id) ON DELETE CASCADE UNIQUE,
    
    -- Escalation limits
    max_escalations_per_day INTEGER NOT NULL DEFAULT 10,
    max_escalations_per_week INTEGER NOT NULL DEFAULT 50,
    escalation_enabled BOOLEAN NOT NULL DEFAULT true,
    
    -- Auto-answer settings
    auto_answer_confidence_threshold DECIMAL(3,2) NOT NULL DEFAULT 0.75 CHECK (auto_answer_confidence_threshold >= 0 AND auto_answer_confidence_threshold <= 1),
    clarification_enabled BOOLEAN NOT NULL DEFAULT true,
    
    -- Access control
    blocked_topics JSONB DEFAULT '[]'::jsonb,
    allowed_user_tiers JSONB DEFAULT '["free", "follower"]'::jsonb,
    
    -- Availability (for future use)
    availability_windows JSONB DEFAULT '{}'::jsonb,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_orchestrator_configs_avee ON orchestrator_configs(avee_id);

-- ============================================================================
-- Table: escalation_queue
-- Description: Tracks all escalation requests from users to creators
-- ============================================================================

CREATE TABLE IF NOT EXISTS escalation_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- References
    conversation_id UUID NOT NULL REFERENCES direct_conversations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
    avee_id UUID NOT NULL REFERENCES avees(id) ON DELETE CASCADE,
    
    -- Message content
    original_message TEXT NOT NULL,
    context_summary TEXT, -- AI-generated context about the conversation
    
    -- Escalation metadata
    escalation_reason escalation_reason NOT NULL,
    status escalation_status NOT NULL DEFAULT 'pending',
    
    -- Timeline
    offered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    accepted_at TIMESTAMP WITH TIME ZONE,
    answered_at TIMESTAMP WITH TIME ZONE,
    
    -- Creator response
    creator_answer TEXT,
    answer_layer VARCHAR CHECK (answer_layer IN ('public', 'friends', 'intimate')),
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_escalation_queue_conversation ON escalation_queue(conversation_id);
CREATE INDEX idx_escalation_queue_user ON escalation_queue(user_id);
CREATE INDEX idx_escalation_queue_avee ON escalation_queue(avee_id);
CREATE INDEX idx_escalation_queue_status ON escalation_queue(status);
CREATE INDEX idx_escalation_queue_avee_status ON escalation_queue(avee_id, status);
CREATE INDEX idx_escalation_queue_offered_at ON escalation_queue(offered_at DESC);

-- ============================================================================
-- Table: orchestrator_decisions
-- Description: Logs every routing decision for analytics and debugging
-- ============================================================================

CREATE TABLE IF NOT EXISTS orchestrator_decisions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- References
    conversation_id UUID REFERENCES direct_conversations(id) ON DELETE SET NULL,
    user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
    avee_id UUID NOT NULL REFERENCES avees(id) ON DELETE CASCADE,
    
    -- Message and decision
    message_content TEXT NOT NULL,
    decision_path decision_path NOT NULL,
    
    -- Computed signals
    confidence_score DECIMAL(5,4) CHECK (confidence_score >= 0 AND confidence_score <= 1),
    novelty_score DECIMAL(5,4) CHECK (novelty_score >= 0 AND novelty_score <= 1),
    complexity_score DECIMAL(5,4) CHECK (complexity_score >= 0 AND complexity_score <= 1),
    
    -- Similar answer reference (if path C)
    similar_answer_id UUID REFERENCES escalation_queue(id) ON DELETE SET NULL,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_orchestrator_decisions_conversation ON orchestrator_decisions(conversation_id);
CREATE INDEX idx_orchestrator_decisions_user ON orchestrator_decisions(user_id);
CREATE INDEX idx_orchestrator_decisions_avee ON orchestrator_decisions(avee_id);
CREATE INDEX idx_orchestrator_decisions_path ON orchestrator_decisions(decision_path);
CREATE INDEX idx_orchestrator_decisions_avee_created ON orchestrator_decisions(avee_id, created_at DESC);
CREATE INDEX idx_orchestrator_decisions_created ON orchestrator_decisions(created_at DESC);

-- ============================================================================
-- Table: canonical_answers
-- Description: Stores creator answers that can be reused for similar questions
-- ============================================================================

CREATE TABLE IF NOT EXISTS canonical_answers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- References
    avee_id UUID NOT NULL REFERENCES avees(id) ON DELETE CASCADE,
    escalation_id UUID REFERENCES escalation_queue(id) ON DELETE SET NULL,
    
    -- Content
    question_pattern TEXT NOT NULL, -- Normalized/generalized version of the question
    answer_content TEXT NOT NULL,
    
    -- Access control
    layer VARCHAR NOT NULL CHECK (layer IN ('public', 'friends', 'intimate')),
    
    -- Usage tracking
    times_reused INTEGER NOT NULL DEFAULT 0,
    
    -- Vector embedding for similarity search
    embedding vector(1536), -- OpenAI text-embedding-3-small dimension
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_canonical_answers_avee ON canonical_answers(avee_id);
CREATE INDEX idx_canonical_answers_escalation ON canonical_answers(escalation_id);
CREATE INDEX idx_canonical_answers_layer ON canonical_answers(layer);
CREATE INDEX idx_canonical_answers_times_reused ON canonical_answers(times_reused DESC);

-- Vector similarity search index (using HNSW for performance)
CREATE INDEX idx_canonical_answers_embedding ON canonical_answers 
USING hnsw (embedding vector_cosine_ops);

-- ============================================================================
-- Functions and Triggers
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_orchestrator_configs_updated_at
    BEFORE UPDATE ON orchestrator_configs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_escalation_queue_updated_at
    BEFORE UPDATE ON escalation_queue
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_canonical_answers_updated_at
    BEFORE UPDATE ON canonical_answers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Function to auto-create canonical answer when escalation is answered
CREATE OR REPLACE FUNCTION create_canonical_answer_on_escalation_answer()
RETURNS TRIGGER AS $$
BEGIN
    -- Only create if status changed to 'answered' and answer exists
    IF NEW.status = 'answered' AND NEW.creator_answer IS NOT NULL AND OLD.status != 'answered' THEN
        -- Check if canonical answer doesn't already exist
        IF NOT EXISTS (
            SELECT 1 FROM canonical_answers WHERE escalation_id = NEW.id
        ) THEN
            INSERT INTO canonical_answers (
                avee_id,
                escalation_id,
                question_pattern,
                answer_content,
                layer
            ) VALUES (
                NEW.avee_id,
                NEW.id,
                NEW.original_message,
                NEW.creator_answer,
                COALESCE(NEW.answer_layer, 'public')
            );
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_create_canonical_answer
    AFTER UPDATE ON escalation_queue
    FOR EACH ROW
    EXECUTE FUNCTION create_canonical_answer_on_escalation_answer();

-- ============================================================================
-- Helper Functions
-- ============================================================================

-- Function to get escalation count for a time period
CREATE OR REPLACE FUNCTION get_escalation_count(
    p_avee_id UUID,
    p_hours INTEGER
)
RETURNS INTEGER AS $$
DECLARE
    escalation_count INTEGER;
BEGIN
    SELECT COUNT(*)
    INTO escalation_count
    FROM escalation_queue
    WHERE avee_id = p_avee_id
      AND offered_at >= NOW() - (p_hours || ' hours')::INTERVAL
      AND status IN ('pending', 'accepted', 'answered');
    
    RETURN escalation_count;
END;
$$ LANGUAGE plpgsql;

-- Function to get orchestrator metrics for an agent
CREATE OR REPLACE FUNCTION get_orchestrator_metrics(
    p_avee_id UUID,
    p_days INTEGER DEFAULT 7
)
RETURNS TABLE(
    total_messages BIGINT,
    auto_answered BIGINT,
    escalations_offered BIGINT,
    escalations_accepted BIGINT,
    escalations_answered BIGINT,
    canonical_reused BIGINT,
    avg_confidence DECIMAL,
    avg_novelty DECIMAL,
    auto_answer_rate DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(*)::BIGINT as total_messages,
        COUNT(*) FILTER (WHERE decision_path = 'A')::BIGINT as auto_answered,
        COUNT(*) FILTER (WHERE decision_path = 'D')::BIGINT as escalations_offered,
        (SELECT COUNT(*) FROM escalation_queue 
         WHERE avee_id = p_avee_id 
         AND status IN ('accepted', 'answered')
         AND offered_at >= NOW() - (p_days || ' days')::INTERVAL)::BIGINT as escalations_accepted,
        (SELECT COUNT(*) FROM escalation_queue 
         WHERE avee_id = p_avee_id 
         AND status = 'answered'
         AND offered_at >= NOW() - (p_days || ' days')::INTERVAL)::BIGINT as escalations_answered,
        COUNT(*) FILTER (WHERE decision_path = 'C')::BIGINT as canonical_reused,
        AVG(confidence_score) as avg_confidence,
        AVG(novelty_score) as avg_novelty,
        CASE 
            WHEN COUNT(*) > 0 THEN 
                ROUND(COUNT(*) FILTER (WHERE decision_path = 'A')::DECIMAL / COUNT(*), 4)
            ELSE 0
        END as auto_answer_rate
    FROM orchestrator_decisions
    WHERE avee_id = p_avee_id
      AND created_at >= NOW() - (p_days || ' days')::INTERVAL;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Row Level Security (RLS) Policies
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE orchestrator_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE escalation_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE orchestrator_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE canonical_answers ENABLE ROW LEVEL SECURITY;

-- orchestrator_configs policies
CREATE POLICY orchestrator_configs_select_policy ON orchestrator_configs
    FOR SELECT
    USING (
        -- Agent owner can view
        EXISTS (
            SELECT 1 FROM avees 
            WHERE avees.id = orchestrator_configs.avee_id 
            AND avees.owner_user_id = auth.uid()
        )
    );

CREATE POLICY orchestrator_configs_update_policy ON orchestrator_configs
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM avees 
            WHERE avees.id = orchestrator_configs.avee_id 
            AND avees.owner_user_id = auth.uid()
        )
    );

-- escalation_queue policies
CREATE POLICY escalation_queue_select_policy ON escalation_queue
    FOR SELECT
    USING (
        -- User who asked the question or agent owner
        auth.uid() = user_id OR
        EXISTS (
            SELECT 1 FROM avees 
            WHERE avees.id = escalation_queue.avee_id 
            AND avees.owner_user_id = auth.uid()
        )
    );

CREATE POLICY escalation_queue_insert_policy ON escalation_queue
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY escalation_queue_update_policy ON escalation_queue
    FOR UPDATE
    USING (
        -- Agent owner can update (to answer)
        EXISTS (
            SELECT 1 FROM avees 
            WHERE avees.id = escalation_queue.avee_id 
            AND avees.owner_user_id = auth.uid()
        )
    );

-- orchestrator_decisions policies (read-only for analytics)
CREATE POLICY orchestrator_decisions_select_policy ON orchestrator_decisions
    FOR SELECT
    USING (
        -- User who sent the message or agent owner
        auth.uid() = user_id OR
        EXISTS (
            SELECT 1 FROM avees 
            WHERE avees.id = orchestrator_decisions.avee_id 
            AND avees.owner_user_id = auth.uid()
        )
    );

-- canonical_answers policies
CREATE POLICY canonical_answers_select_policy ON canonical_answers
    FOR SELECT
    USING (
        -- Agent owner can view
        EXISTS (
            SELECT 1 FROM avees 
            WHERE avees.id = canonical_answers.avee_id 
            AND avees.owner_user_id = auth.uid()
        )
    );

CREATE POLICY canonical_answers_update_policy ON canonical_answers
    FOR UPDATE
    USING (
        -- Agent owner can update
        EXISTS (
            SELECT 1 FROM avees 
            WHERE avees.id = canonical_answers.avee_id 
            AND avees.owner_user_id = auth.uid()
        )
    );

-- ============================================================================
-- Initial Data Seeding
-- ============================================================================

-- Create default orchestrator configs for all existing agents
INSERT INTO orchestrator_configs (avee_id)
SELECT id FROM avees
WHERE NOT EXISTS (
    SELECT 1 FROM orchestrator_configs WHERE orchestrator_configs.avee_id = avees.id
)
ON CONFLICT (avee_id) DO NOTHING;

-- ============================================================================
-- Verification Queries
-- ============================================================================

-- Check if tables were created successfully
SELECT 
    schemaname,
    tablename,
    tableowner
FROM pg_tables
WHERE tablename IN ('orchestrator_configs', 'escalation_queue', 'orchestrator_decisions', 'canonical_answers')
ORDER BY tablename;

-- Check indexes
SELECT 
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename IN ('orchestrator_configs', 'escalation_queue', 'orchestrator_decisions', 'canonical_answers')
ORDER BY tablename, indexname;

-- Check ENUM types
SELECT 
    typname,
    enumlabel
FROM pg_enum e
JOIN pg_type t ON e.enumtypid = t.oid
WHERE typname IN ('escalation_reason', 'escalation_status', 'decision_path')
ORDER BY typname, enumlabel;

-- ============================================================================
-- Migration Complete
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '✅ Orchestrator system migration completed successfully!';
    RAISE NOTICE '📊 Tables created: orchestrator_configs, escalation_queue, orchestrator_decisions, canonical_answers';
    RAISE NOTICE '🔒 RLS policies enabled and configured';
    RAISE NOTICE '⚡ Triggers, functions, and indexes created';
    RAISE NOTICE '🎯 Default configs seeded for existing agents';
    RAISE NOTICE '📝 Ready to use!';
END $$;








