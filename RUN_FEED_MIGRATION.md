# Run Feed Migration - Quick Guide

## ⚠️ Important: Migration Required

The dynamic feed feature requires a new database table (`update_read_status`) to track which updates have been read by users. You need to run the migration before the feed will work properly.

## Option 1: Run via Python Script (Recommended)

```bash
cd /Users/loicricci/gabee-poc

# Activate virtual environment
source venv/bin/activate

# Run the migration
python -m backend.run_feed_migration
```

Expected output:
```
🔧 Running feed read status migration...
  Executing statement 1/8...
  Executing statement 2/8...
  ...
✅ Migration complete!

New table created:
  - update_read_status

This enables:
  - Tracking which updates users have read
  - Unread count badges in the feed
  - Mark as read functionality
```

## Option 2: Run via Supabase SQL Editor

1. Open your Supabase project
2. Go to **SQL Editor**
3. Create a new query
4. Copy the contents of `backend/migrations/012_add_update_read_status.sql`
5. Paste into the SQL Editor
6. Click **Run**

## Option 3: Run via psql

If you have direct database access:

```bash
cd /Users/loicricci/gabee-poc

# Using DATABASE_URL from .env
psql $DATABASE_URL -f backend/migrations/012_add_update_read_status.sql
```

## Verify Migration Success

After running the migration, verify the table was created:

```sql
-- In Supabase SQL Editor or psql:
SELECT * FROM update_read_status LIMIT 1;
```

If the query runs without error, the migration was successful! ✅

## What This Migration Does

The migration creates:

1. **New Table: `update_read_status`**
   - Tracks which updates each user has read
   - Links to `agent_updates` and `profiles`
   - Unique constraint per user+update

2. **Indexes**
   - Fast lookup by user_id
   - Fast lookup by update_id

3. **RLS Policies**
   - Users can only see their own read status
   - Users can mark updates as read

## After Migration

Once the migration is complete:

1. **Restart Backend** (if running):
   ```bash
   # Press Ctrl+C in the backend terminal
   # Then restart:
   cd /Users/loicricci/gabee-poc
   source venv/bin/activate
   python -m uvicorn backend.main:app --reload --port 8000
   ```

2. **Test the Feed**:
   - Navigate to `/app` in your browser
   - The feed should now show real data
   - Unread counts should display
   - Mark as read functionality should work

3. **Create Some Test Updates**:
   - Use the "Quick Update Composer" at the top of the feed
   - Or use the API directly

## Troubleshooting

### "ModuleNotFoundError: No module named 'sqlalchemy'"

Your virtual environment needs packages installed:

```bash
cd /Users/loicricci/gabee-poc
source venv/bin/activate
pip install -r backend/requirements.txt
```

### "relation 'update_read_status' does not exist"

The migration hasn't run yet. Follow Option 1 or 2 above.

### "permission denied"

Make sure you're using the correct DATABASE_URL with admin privileges, or use Supabase SQL Editor (Option 2).

## Need Help?

Check the full implementation guide: `DYNAMIC_FEED_IMPLEMENTATION.md`


