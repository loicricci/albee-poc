-- Orchestrator v2 Database Migration
-- Version: 2.0.0
-- Date: 2025-01-07
-- Description: Updates for the simplified orchestrator flow

-- ============================================================================
-- Add knowledge_chunk_id to escalation_queue for linking Q&A to context
-- ============================================================================

-- Add the new column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'escalation_queue' 
        AND column_name = 'knowledge_chunk_id'
    ) THEN
        ALTER TABLE escalation_queue 
        ADD COLUMN knowledge_chunk_id UUID REFERENCES document_chunks(id) ON DELETE SET NULL;
        
        RAISE NOTICE 'Added knowledge_chunk_id column to escalation_queue';
    END IF;
END $$;

-- Add index for the new column
CREATE INDEX IF NOT EXISTS idx_escalation_queue_knowledge_chunk 
ON escalation_queue(knowledge_chunk_id);

-- ============================================================================
-- Update decision_path enum to include new 'P' path for policy violations
-- ============================================================================

-- Add new enum value if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'P' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'decision_path')
    ) THEN
        ALTER TYPE decision_path ADD VALUE 'P';
        RAISE NOTICE 'Added P value to decision_path enum';
    END IF;
EXCEPTION
    WHEN duplicate_object THEN
        RAISE NOTICE 'P value already exists in decision_path enum';
END $$;

-- ============================================================================
-- Add 'forwarded' as escalation_reason enum value
-- ============================================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'forwarded' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'escalation_reason')
    ) THEN
        ALTER TYPE escalation_reason ADD VALUE 'forwarded';
        RAISE NOTICE 'Added forwarded value to escalation_reason enum';
    END IF;
EXCEPTION
    WHEN duplicate_object THEN
        RAISE NOTICE 'forwarded value already exists in escalation_reason enum';
END $$;

-- ============================================================================
-- Update notification types for new flow
-- ============================================================================

-- No schema changes needed, notification_type is a varchar that accepts any value

-- ============================================================================
-- Verification
-- ============================================================================

-- Check escalation_queue columns
SELECT 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns
WHERE table_name = 'escalation_queue'
ORDER BY ordinal_position;

-- Check enum values
SELECT 
    t.typname AS enum_name,
    e.enumlabel AS enum_value
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
WHERE t.typname IN ('decision_path', 'escalation_reason')
ORDER BY t.typname, e.enumsortorder;

-- ============================================================================
-- Migration Complete
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '✅ Orchestrator v2 migration completed!';
    RAISE NOTICE '📊 Updates: knowledge_chunk_id column, P decision path, forwarded reason';
    RAISE NOTICE '📝 Ready to use new orchestrator flow!';
END $$;

