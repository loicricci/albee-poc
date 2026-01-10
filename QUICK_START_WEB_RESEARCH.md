# Quick Start: Web Research Feature

## ⚡ 3-Minute Setup

### Step 1: Run Database Migration
```bash
psql -h YOUR_HOST -U YOUR_USER -d YOUR_DB -f backend/migrations/005_agent_web_research.sql
```

### Step 2: Test It Works
```bash
cd backend
source ../venv/bin/activate  # or: source .venv/bin/activate
python test_web_research.py
```

Expected: `🎉 All tests passed!`

### Step 3: Create Your First Agent with Web Research

**Option A - Frontend UI** (Easiest)
1. Open http://localhost:3000/my-agents
2. Click "Create New Agent"
3. Enter: Handle: `einstein`, Name: `Albert Einstein`
4. Toggle "Automatic Web Research" ON
5. Click "Create Agent"
6. Wait ~30 seconds → Success! ✅

**Option B - API Call**
```bash
TOKEN="your_jwt_token"
curl -X POST "http://localhost:8000/avees?handle=einstein&display_name=Albert%20Einstein&auto_research=true&research_max_sources=5" \
  -H "Authorization: Bearer $TOKEN" | jq '.'
```

## 🎯 What This Does

Automatically:
1. Creates the agent
2. Searches the web for information about the topic
3. Scrapes 5 relevant sources
4. Extracts and cleans content
5. Chunks content into optimal sizes
6. Generates embeddings
7. Stores in agent's knowledge base

**Result**: Agent has instant, comprehensive knowledge!

## 📚 Documentation

- **Full Guide**: `WEB_RESEARCH_GUIDE.md`
- **Setup**: `SETUP_WEB_RESEARCH.md`
- **Testing**: `TEST_WEB_RESEARCH.md`
- **Summary**: `WEB_RESEARCH_SUMMARY.md`

## 🆘 Troubleshooting

| Issue | Solution |
|-------|----------|
| Migration fails | Check database credentials, may already be applied |
| "No sources found" | DuckDuckGo rate limit, wait a few minutes |
| Takes too long | Normal! Reduce to 3 sources for faster results |
| Tests fail | Check that `url_scraper.py` is in `backend/` directory |

## 💡 Examples to Try

```javascript
// Celebrity
{ handle: "taylor-swift", display_name: "Taylor Swift", auto_research: true }

// Tech Expert  
{ handle: "ai-expert", display_name: "AI Expert", 
  auto_research: true, research_topic: "Artificial Intelligence" }

// Company
{ handle: "tesla", display_name: "Tesla", 
  auto_research: true, research_topic: "Tesla Inc" }

// Historical Figure
{ handle: "marie-curie", display_name: "Marie Curie", auto_research: true }
```

## ⚙️ Optional: Better Search Results

Add to `backend/.env`:
```env
# Google Custom Search (free 100/day)
GOOGLE_SEARCH_API_KEY=your_key
GOOGLE_SEARCH_ENGINE_ID=your_id

# OR SerpAPI (paid, best results)
SERPAPI_KEY=your_key
```

Without API keys: Uses DuckDuckGo (works fine, just slower)

## ✅ Success Checklist

- [ ] Migration completed
- [ ] Tests pass (5/5)
- [ ] Created test agent with research
- [ ] Verified in database
- [ ] Chat with agent works
- [ ] Agent uses researched knowledge

---

**That's it! You now have web research for all your agents.** 🚀

For more details, see the comprehensive guides in the documentation files.













