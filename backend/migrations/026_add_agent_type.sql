    -- Migration: Add agent_type column to avees table
    -- Purpose: Distinguish between persona (personal digital twin) and company (business/brand) agents

    -- Add agent_type column with default value 'persona' for existing agents
    ALTER TABLE avees ADD COLUMN IF NOT EXISTS agent_type VARCHAR(50) DEFAULT 'persona';

    -- Add constraint to ensure only valid values
    -- Note: This is done with a CHECK constraint for simplicity
    -- Values: 'persona' (personal digital twin) or 'company' (business/brand agent)
    DO $$
    BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM pg_constraint WHERE conname = 'avees_agent_type_check'
        ) THEN
            ALTER TABLE avees ADD CONSTRAINT avees_agent_type_check 
                CHECK (agent_type IN ('persona', 'company'));
        END IF;
    END $$;

    -- Index for filtering by agent_type
    CREATE INDEX IF NOT EXISTS idx_avees_agent_type ON avees(agent_type);

    -- Update any NULL values to 'persona' (shouldn't happen due to default, but just in case)
    UPDATE avees SET agent_type = 'persona' WHERE agent_type IS NULL;
