# AutoPost Diagnostic Tool - Quick Start

## 🚀 5-Minute Setup

### Step 1: Start Backend (if not already running)

```bash
cd backend
uvicorn main:app --reload
```

### Step 2: Open the Diagnostic UI

```bash
open autopost_diagnostic.html
```

### Step 3: Get Your Auth Token

1. Open your main app at `http://localhost:5173`
2. Log in with your credentials [[memory:12861966]]
3. Open browser DevTools (Press F12)
4. Go to Console tab
5. Run this command:
   ```javascript
   JSON.parse(localStorage.getItem('supabase.auth.token')).access_token
   ```
6. Copy the token (long string starting with "eyJ...")

### Step 4: Configure the UI

1. **API Endpoint**: Leave as `http://localhost:8000`
2. **Auth Token**: Paste the token you copied
3. Click **"Load Agents"**
4. Select an agent from the list

### Step 5: Generate & Analyze

1. Leave Topic empty for auto-fetch (or enter custom topic)
2. Select Image Engine (DALL-E 3 or GPT-Image-1)
3. Click **"Generate Post"**
4. Watch the magic happen! ✨

## 📊 What You'll See

The UI will show you:

- ⏱️ **Real-time progress** for each step
- 📋 **All data** generated during the process
- 🖼️ **Generated images** displayed inline
- 🔗 **Direct link** to view the created post
- ⚡ **Performance metrics** for each step

## 🎯 Quick Tips

### Want to Test a Specific Topic?

Enter it in the "Topic" field:
- ✅ "Space exploration and Mars missions"
- ✅ "Climate change solutions"
- ✅ "Latest AI breakthroughs"

### Want to Compare Image Engines?

1. Generate with DALL-E 3 first
2. Note the result
3. Switch to GPT-Image-1
4. Generate again with same topic
5. Compare!

### Want to See Detailed Timing?

Click on any step header to expand and see:
- Exact duration in seconds
- All input/output data
- Complete JSON responses

## 🔍 Common Use Cases

### Debugging a Failed Generation

If generation fails, you'll see:
- Which step failed
- Complete error message
- All steps that succeeded before failure
- Full stack trace

### Performance Analysis

Check the "Total Duration" and individual step durations to identify:
- Which steps are slowest
- Where to optimize
- Performance trends

### Prompt Engineering

Expand Step 3 to see:
- Exact image prompt sent to AI
- Title generation
- How agent context affects prompts

## 📱 Screenshot Tour

### Main Interface
```
┌─────────────────────────────────────────────────────┐
│ 🔍 AutoPost Diagnostic Tool                         │
│ End-to-end analysis of autopost generation flow     │
├──────────────┬──────────────────────────────────────┤
│ Configuration│ Output Panel                         │
│              │                                      │
│ • API        │ ┌─────────────────────────────────┐│
│ • Token      │ │ 📊 Summary Cards                ││
│ • Agent      │ │  12.3s | 7 Steps | Success     ││
│ • Topic      │ └─────────────────────────────────┘│
│ • Engine     │                                      │
│              │ ┌─────────────────────────────────┐│
│ [Generate]   │ │ ▼ 1. Fetch topic          ✅   ││
│              │ │   Duration: 0.234s              ││
│              │ │   Topic: "Space exploration"    ││
│              │ └─────────────────────────────────┘│
└──────────────┴──────────────────────────────────────┘
```

## 🚨 Troubleshooting

### "Failed to load agents"
→ Make sure backend is running at `http://localhost:8000`

### "Not authorized"
→ Get a fresh auth token (they expire after 1 hour)

### Blank output
→ Check browser console (F12) for JavaScript errors

## 🎓 Learn More

Read the full documentation: `AUTOPOST_DIAGNOSTIC_TOOL.md`

---

**That's it! You're ready to analyze and improve the autopost flow! 🎉**



