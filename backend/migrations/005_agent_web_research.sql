-- Migration: Add web research tracking fields to Avee table
-- Date: 2025-12-22
-- Description: Adds fields to track automatic web research performed at agent creation

-- Add research tracking columns
ALTER TABLE avees
ADD COLUMN IF NOT EXISTS research_topic TEXT,
ADD COLUMN IF NOT EXISTS research_completed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS auto_research_enabled VARCHAR(10) DEFAULT 'false';

-- Add index for querying agents with research
CREATE INDEX IF NOT EXISTS idx_avees_research_completed 
ON avees(research_completed_at) 
WHERE research_completed_at IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN avees.research_topic IS 'The topic or person name that was researched for initial agent knowledge';
COMMENT ON COLUMN avees.research_completed_at IS 'Timestamp when automatic web research completed';
COMMENT ON COLUMN avees.auto_research_enabled IS 'Whether automatic web research was enabled for this agent';








