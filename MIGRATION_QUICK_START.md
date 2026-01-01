# Quick Start: Agent Migration (Option B)

## Overview

Transfer all non-admin user agents to admin while preserving data and avoiding conflicts.

## ✅ What You Get

- **Admin**: Gets all old agents with `archived-` prefix (preserves all training data)
- **Users**: Get fresh new agents with original handles when they edit profiles
- **No conflicts**: Old handles freed up by renaming
- **No data loss**: Everything preserved in archived agents

## 🚀 Quick Steps

### 1. Backup Database (IMPORTANT!)

```bash
# PostgreSQL example
pg_dump your_database > backup_$(date +%Y%m%d_%H%M%S).sql
```

### 2. Run Migration

```bash
cd /Users/loicricci/gabee-poc
python migrate_agents_to_admin.py
```

### 3. Review & Confirm

The script will show you:
- All agents that will be renamed
- Their new names (with `archived-` prefix)
- Current owners

Type `yes` to proceed.

### 4. Verify

After migration:
- ✅ Login as admin → Check "My Agents" → See archived agents
- ✅ Login as non-admin user → Edit profile → New agent created
- ✅ Check that handles don't conflict

## 📊 Example

**Before:**
```
User john@example.com owns:
  └─ Agent: "john-doe" (has training data)
```

**After migration:**
```
Admin (loic.ricci@gmail.com) owns:
  └─ Agent: "archived-john-doe" (old training data preserved)

User john@example.com:
  └─ Profile: "john-doe" (no agent yet)
```

**After user edits profile:**
```
Admin (loic.ricci@gmail.com) owns:
  └─ Agent: "archived-john-doe" (old training data)

User john@example.com owns:
  └─ Agent: "john-doe" (new, fresh agent)
```

## ⚠️ Important Notes

- **Backup first!** Always backup your database
- **Read-only during migration**: Don't allow users to edit profiles during migration
- **Test in dev first**: If possible, test with a copy of your database
- **Admin email**: Make sure `loic.ricci@gmail.com` exists in your database

## 🔍 What Happens Technically

1. All non-admin agents renamed: `handle` → `archived-handle`
2. Ownership transferred: `owner_user_id` → admin's user_id
3. Original handles freed up for new agents
4. Profile-agent sync creates new agents on next profile edit

## ❓ FAQ

**Q: Can I undo this?**
A: Yes, but backup first! Much easier than trying to revert.

**Q: Will users lose their training data?**
A: No! It's preserved in the archived agents owned by admin.

**Q: Can admin see/edit archived agents?**
A: Yes, they appear in admin's "My Agents" list.

**Q: What if a user never edits their profile?**
A: They won't have an agent until they edit their profile.

**Q: Can I delete archived agents later?**
A: Yes, admin can delete them through "My Agents" if not needed.

## 🐛 Troubleshooting

**Error: "Admin user not found"**
- Make sure `loic.ricci@gmail.com` exists in auth.users table

**Error: "Handle already exists"**
- Check if any agents already have `archived-` prefix
- May need to manually rename conflicting agents

**Script hangs or crashes**
- Check database connection
- Verify DATABASE_URL in backend/.env
- Check database logs

## 📝 After Migration

You're done! The system will automatically:
- Create new agents for users when they edit profiles
- Keep admin's archived agents separate
- Maintain all training data in archived agents

Everything else works as before with the merged profile-agent system.




