-- Migration 025: Add composite index for /me/avees query optimization
-- 
-- Problem: The /me/avees endpoint takes 1-5 seconds on cold cache
-- because the query uses ORDER BY created_at DESC but only has
-- an index on owner_user_id alone.
--
-- Solution: Add a composite index covering both filter and sort columns
-- This allows PostgreSQL to use an index scan instead of a sort operation.
--
-- Query pattern being optimized:
--   SELECT id, handle, display_name, avatar_url, bio, created_at 
--   FROM avees 
--   WHERE owner_user_id = ?
--   ORDER BY created_at DESC
--   LIMIT 100

-- Drop old partial index if it exists (to avoid conflicts)
DROP INDEX IF EXISTS idx_avees_owner_created_desc;

-- Create optimal composite index for /me/avees queries
-- The DESC on created_at allows efficient "ORDER BY created_at DESC" without sorting
CREATE INDEX IF NOT EXISTS idx_avees_owner_created_desc 
  ON avees(owner_user_id, created_at DESC)
  WHERE owner_user_id IS NOT NULL;

-- Add explanatory comment
COMMENT ON INDEX idx_avees_owner_created_desc IS 
  'Composite index for /me/avees - enables index-only ORDER BY without sort step';

-- Analyze the table to update statistics
ANALYZE avees;

-- Verification query (run manually to check index usage):
-- EXPLAIN ANALYZE 
-- SELECT id, handle, display_name, avatar_url, bio, created_at 
-- FROM avees 
-- WHERE owner_user_id = 'e4ababa2-fa35-421a-815d-c9e641929b67'
-- ORDER BY created_at DESC
-- LIMIT 100;

