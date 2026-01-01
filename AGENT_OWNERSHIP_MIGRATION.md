# Agent Ownership Transfer to Admin (Option B)

## Overview

This migration transfers ownership of all non-admin users' agents to the admin account (loic.ricci@gmail.com) **while renaming them** to avoid conflicts.

## What This Migration Does

### Step 1: Rename Old Agents
All non-admin user agents get renamed with an `archived-` prefix:
- `john-doe` → `archived-john-doe`
- `jane-smith` → `archived-jane-smith`

### Step 2: Transfer Ownership
All renamed agents are transferred to admin (loic.ricci@gmail.com)

### Step 3: Free Up Handles
Original handles are now available for new agents

## Migration Script

Run the migration with:

```bash
cd /Users/loicricci/gabee-poc
python migrate_agents_to_admin.py
```

The script will:
1. Show you all agents that will be renamed and transferred
2. Ask for confirmation before making changes
3. Rename each agent with `archived-` prefix
4. Transfer ownership to admin
5. Commit all changes

## What Happens After Migration

### Immediately After
- Admin owns all old agents (with `archived-` handles)
- All training data, updates, and documents are preserved
- Old handles are freed up

### When Non-Admin Users Edit Their Profile
- A NEW agent is created automatically
- Uses their original handle (e.g., `john-doe`)
- Starts fresh (no training data from old agent)
- Owned by the user (not admin)

### Result
- **Admin has**: `archived-john-doe` (with all old training data)
- **User has**: `john-doe` (fresh, new agent)
- No conflicts, everyone has their agent

## Example Flow

**Before Migration:**
```
User: john@example.com
├─ Profile: john-doe
└─ Agent: john-doe (owned by user, has training data)
```

**Run Migration:**
```bash
python migrate_agents_to_admin.py
# Renames agent: john-doe → archived-john-doe
# Transfers ownership to admin
```

**After Migration:**
```
Admin: loic.ricci@gmail.com
└─ Agent: archived-john-doe (old data preserved)

User: john@example.com
└─ Profile: john-doe (no agent yet)
```

**User Edits Profile:**
```
User: john@example.com
├─ Profile: john-doe
└─ Agent: john-doe (NEW, fresh, owned by user)

Admin: loic.ricci@gmail.com
└─ Agent: archived-john-doe (old data preserved)
```

## Benefits of This Approach

✅ **No Data Loss**: All old training data preserved in archived agents
✅ **No Conflicts**: Old handles freed up for new agents
✅ **Clean Separation**: Admin gets historical data, users get fresh start
✅ **Reversible**: Archived agents can be restored if needed
✅ **Automatic**: New agents created when users edit profiles

## Running the Migration

### 1. Backup Your Database
```bash
# Use your database backup command
# Example for PostgreSQL:
pg_dump your_database > backup_before_migration.sql
```

### 2. Run the Migration
```bash
cd /Users/loicricci/gabee-poc
python migrate_agents_to_admin.py
```

### 3. Review the Output
The script will show you:
- How many agents will be affected
- What the new handles will be
- Current owners

### 4. Confirm
Type `yes` to proceed with the migration

### 5. Verify
Check that:
- Archived agents are visible in admin's "My Agents"
- Non-admin users can edit their profiles
- New agents are created with original handles

## Reverting the Migration

If you need to revert:

```python
# Restore original handles and owners
# You would need the original owner_user_id values
UPDATE avees 
SET handle = REPLACE(handle, 'archived-', ''),
    owner_user_id = original_owner_id
WHERE handle LIKE 'archived-%'
```

⚠️ **Better to backup before migrating than try to revert!**

## Cleaning Up Old Agents Later

After users have their new agents, you can optionally:

1. **Review archived agents** in admin panel
2. **Delete unused archived agents** if they're no longer needed
3. **Export training data** from archived agents if you want to preserve it separately

## Current System Behavior

With the merged profile-agent system:
- Non-admin users: Profile auto-creates/syncs with their agent
- Admin users: Can create multiple separate agents
- This migration works perfectly with this system

## Questions?

- **Will users lose their agents?** No, admin gets the old agents (archived), users get fresh ones
- **Will handles conflict?** No, old agents are renamed with `archived-` prefix
- **Can I undo this?** Yes, but backup first! Much easier than trying to revert
- **Do I need to do anything after?** No, new agents are created automatically when users edit profiles

