# Fix Auto-Post Feature - Manual SQL Execution

## Problem
The Auto-Posts page in the backoffice is failing with the error:
```
column "auto_post_enabled" does not exist
```

This is because the database migration hasn't been applied yet.

## Solution: Run SQL Manually in Supabase Dashboard

### Steps:

1. **Open Supabase Dashboard**
   - Go to your Supabase project
   - Navigate to **SQL Editor**

2. **Run the following SQL** (copy and paste):

```sql
-- Add auto_post_enabled column to avees table
ALTER TABLE avees 
ADD COLUMN IF NOT EXISTS auto_post_enabled BOOLEAN;

-- Set default for the column
ALTER TABLE avees 
ALTER COLUMN auto_post_enabled SET DEFAULT false;

-- Update existing rows to have false as default
UPDATE avees SET auto_post_enabled = false WHERE auto_post_enabled IS NULL;

-- Add last_auto_post_at column to track when last post was generated
ALTER TABLE avees 
ADD COLUMN IF NOT EXISTS last_auto_post_at TIMESTAMP WITH TIME ZONE;

-- Add auto_post_settings JSONB column for future configuration
ALTER TABLE avees 
ADD COLUMN IF NOT EXISTS auto_post_settings JSONB;

-- Set default for the column
ALTER TABLE avees 
ALTER COLUMN auto_post_settings SET DEFAULT '{
  "frequency": "daily",
  "preferred_time": "09:00",
  "categories": [],
  "enabled_days": ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
}'::jsonb;

-- Update existing rows to have default settings
UPDATE avees SET auto_post_settings = '{
  "frequency": "daily",
  "preferred_time": "09:00",
  "categories": [],
  "enabled_days": ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
}'::jsonb WHERE auto_post_settings IS NULL;

-- Create index for querying enabled agents
CREATE INDEX IF NOT EXISTS idx_avees_auto_post_enabled 
ON avees(auto_post_enabled) 
WHERE auto_post_enabled = true;

-- Create index for last post time
CREATE INDEX IF NOT EXISTS idx_avees_last_auto_post_at 
ON avees(last_auto_post_at DESC);

-- Comment the columns
COMMENT ON COLUMN avees.auto_post_enabled IS 'Whether auto post generation is enabled for this agent';
COMMENT ON COLUMN avees.last_auto_post_at IS 'Timestamp of the last auto-generated post';
COMMENT ON COLUMN avees.auto_post_settings IS 'JSON configuration for auto post generation (frequency, time, categories, etc.)';
```

3. **Click "Run"** to execute the SQL

4. **Verify** the columns were added:

```sql
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'avees' 
AND column_name IN ('auto_post_enabled', 'last_auto_post_at', 'auto_post_settings')
ORDER BY column_name;
```

You should see 3 rows returned showing the new columns.

5. **Refresh the backoffice page** - it should now work!

## Alternative: Quick Python Script (if you have direct DB access)

If the above doesn't work due to timeouts, you can try running each statement separately in the SQL editor, or run them one at a time with small delays between them.

## Verification

After running the migration, the Auto-Posts page should load successfully and show:
- List of all agents
- Toggle switches to enable/disable auto-posting per agent
- Controls to generate posts manually

## Why This Happened

The auto-post feature requires these new columns in the `avees` table, but the automated migration script is hitting Supabase's statement timeout limit. Running it manually in the Supabase dashboard works around this limitation.








