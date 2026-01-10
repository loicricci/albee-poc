# AutoPost Diagnostic Tool - Integrated Version (Admin Only)

## 🎯 You now have TWO options!

### Option 1: Integrated Frontend (Recommended) ⭐
**Location**: `/backoffice/diagnostic` in your main app  
**Auth**: Automatically uses your existing login  
**Access**: Admin only

### Option 2: Standalone HTML
**Location**: `autopost_diagnostic.html`  
**Auth**: Manual token entry  
**Access**: Anyone with a valid token

---

## 🚀 Quick Start - Integrated Version (Recommended)

### Step 1: Log into Your App

1. Go to `http://localhost:3000` (or your frontend URL)
2. Log in with your admin credentials [[memory:12861966]]
   - Email: `loic.ricci@gmail.com`
   - Password: `P7w1t2f1245!`

### Step 2: Navigate to Diagnostic Tool

Two ways to get there:

**Option A**: Direct URL
```
http://localhost:3000/backoffice/diagnostic
```

**Option B**: Via Backoffice
1. Go to `/backoffice`
2. Click the **"Diagnostic Tool"** button (purple button in top right)

### Step 3: Use the Tool

1. **Select Agent** - Choose from dropdown (auto-loaded)
2. **Configure** - Set topic, category, image engine (optional)
3. **Generate** - Click "Generate Post"
4. **Analyze** - Expand steps to see detailed data

That's it! No token copying required! 🎉

---

## 📊 What You'll See

### Integrated UI Features

- ✅ **Automatic Authentication** - Uses your existing login
- ✅ **Agent Auto-Load** - Agents populate automatically
- ✅ **Clean Integration** - Matches your app's design
- ✅ **Admin Only** - Access control built-in
- ✅ **Responsive Design** - Works on all screen sizes

### Real-Time Analysis

- **Status Banner** - Success/error indication
- **Summary Cards** - Duration and step count
- **Expandable Steps** - Click to see details
- **JSON Data** - All intermediate data captured
- **Generated Images** - View inline (if applicable)
- **Post Links** - Direct link to created post

---

## 🔑 Access Control

### Who Can Access?

**Integrated Version** (`/backoffice/diagnostic`):
- ✅ Admin users only (same as backoffice)
- ✅ Authenticated automatically
- ✅ No manual token needed

**Standalone Version** (`autopost_diagnostic.html`):
- ✅ Anyone with valid JWT token
- ⚠️ Manual token entry required
- ⚠️ Token expires after 1 hour

### Admin Check

If you see "Access Denied":
- You're not logged in as admin
- Check your handle is in `ADMIN_HANDLES` env variable
- Default admin: `loic_ricci`

---

## 🎨 UI Tour

```
┌────────────────────────────────────────────────────────┐
│  🔍 AutoPost Diagnostic Tool    [← Back to Backoffice] │
│  End-to-end analysis of autopost generation flow      │
├─────────────────┬──────────────────────────────────────┤
│ Configuration   │  Results Panel                       │
│                 │                                      │
│ Select Agent ▼  │  ┌────────────────────────────────┐ │
│ [Elton John]    │  │ ✅ Post generated successfully!│ │
│                 │  └────────────────────────────────┘ │
│ Topic:          │                                      │
│ [____________]  │  Duration: 12.3s | 7 Steps          │
│                 │                                      │
│ Category: ▼     │  ┌──────────────────────────────┐  │
│ [Technology]    │  │ ✅ 1. Fetch topic      0.234s│  │
│                 │  │ ✅ 2. Load context     0.891s│  │
│ Image Engine: ▼ │  │ ✅ 3. Generate prompts 2.145s│  │
│ [DALL-E 3]      │  │ ✅ 4. Generate image   8.234s│  │
│                 │  │ ✅ 5. Create post      0.456s│  │
│ [Generate Post] │  └──────────────────────────────┘  │
│                 │                                      │
│ [Clear Output]  │  [🔗 View Post]                     │
└─────────────────┴──────────────────────────────────────┘
```

---

## 💡 Quick Tips

### Testing Different Scenarios

**Test 1: Auto Topic**
- Leave topic empty
- Select category
- See what topic gets fetched

**Test 2: Custom Topic**
- Enter specific topic
- Compare with auto-fetched results
- Analyze prompt differences

**Test 3: Engine Comparison**
- Generate with DALL-E 3
- Generate with GPT-Image-1
- Compare timing and results

### Analyzing Performance

Look for:
- **Slow steps** (> 5 seconds)
- **Failed steps** (red X)
- **Data quality** (expand to inspect)
- **Total duration** (target < 15s)

### Debugging Issues

If generation fails:
1. **Check which step failed** (red X)
2. **Expand the step** to see error
3. **Review previous steps** (all succeeded?)
4. **Check backend logs** if needed

---

## 🔧 Comparison: Integrated vs Standalone

| Feature | Integrated | Standalone |
|---------|-----------|------------|
| **Location** | `/backoffice/diagnostic` | `autopost_diagnostic.html` |
| **Authentication** | Automatic ✅ | Manual token ⚠️ |
| **Agent Loading** | Auto ✅ | Manual ⚠️ |
| **UI Design** | Matches app ✅ | Independent |
| **Access Control** | Admin only ✅ | Token-based |
| **Deployment** | Requires build | Drop-in file ✅ |
| **Updates** | Auto with app | Manual |

**Recommendation**: Use **Integrated** for daily use, keep **Standalone** as backup.

---

## 🐛 Troubleshooting

### "Access Denied"

**Solution**:
- Make sure you're logged in
- Check you're an admin user
- Verify `ADMIN_HANDLES` includes your handle

### Agents Not Loading

**Solution**:
- Check backend is running
- Verify `/auto-post/status` endpoint works
- Check browser console for errors

### Generation Fails

**Solution**:
- Expand failed step to see error
- Check backend logs
- Verify agent has required data (persona, etc.)
- Ensure API keys are configured

### Page Won't Load

**Solution**:
- Run: `cd frontend && npm run dev`
- Check port 3000 is available
- Clear browser cache

---

## 📚 Documentation

- **Full Guide**: `AUTOPOST_DIAGNOSTIC_TOOL.md`
- **Implementation**: `AUTOPOST_DIAGNOSTIC_SUMMARY.md`
- **Backend API**: `backend/autopost_diagnostic_api.py`
- **Frontend Page**: `frontend/src/app/(app)/backoffice/diagnostic/page.tsx`

---

## 🎉 That's It!

You now have a fully integrated diagnostic tool that:

✅ **No manual setup** - Just log in and use  
✅ **Admin only** - Secure by default  
✅ **Auto-authenticated** - No token copying  
✅ **Beautiful UI** - Matches your app  
✅ **Full featured** - Complete analysis  

**Happy debugging! 🔍✨**



