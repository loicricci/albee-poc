# Quick Setup: Web Research Feature

## 🚀 Quick Start (5 Minutes)

### 1. Run Database Migration

```bash
cd /Users/loicricci/gabee-poc

# Connect to your PostgreSQL database and run:
psql -h YOUR_HOST -U YOUR_USER -d YOUR_DATABASE -f backend/migrations/005_agent_web_research.sql
```

Or if using Supabase, you can run the SQL directly in the SQL Editor:
```sql
-- Copy contents of backend/migrations/005_agent_web_research.sql
-- and paste into Supabase SQL Editor
```

### 2. (Optional) Configure Search API Keys

Add to `backend/.env`:

```env
# Option 1: Use DuckDuckGo (no API key needed) - already works!
# No configuration needed

# Option 2: Google Custom Search (free tier, 100 queries/day)
GOOGLE_SEARCH_API_KEY=your_google_api_key
GOOGLE_SEARCH_ENGINE_ID=your_search_engine_id

# Option 3: SerpAPI (paid, best results)
SERPAPI_KEY=your_serpapi_key
```

**Note**: The feature works out of the box with DuckDuckGo (no API keys needed). Add API keys only if you want better/faster results.

### 3. Restart Backend

```bash
cd backend
source venv/bin/activate  # or: source ../venv/bin/activate
uvicorn main:app --reload --port 8000
```

### 4. Test the Feature

#### Option A: Using the Frontend

1. Open http://localhost:3000/my-agents
2. Click "Create New Agent"
3. Fill in:
   - Handle: `test-agent`
   - Display Name: `Elon Musk`
4. Enable "Automatic Web Research" toggle
5. Click "Create Agent"
6. Wait 20-40 seconds
7. You should see success message with research results!

#### Option B: Using cURL

```bash
# Get your JWT token from browser (localStorage or cookies)
TOKEN="your_jwt_token_here"

# Create agent with auto-research
curl -X POST "http://localhost:8000/avees?handle=test-agent&display_name=Elon%20Musk&auto_research=true&research_max_sources=5" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Accept: application/json"
```

#### Option C: Manual Research on Existing Agent

```bash
# Get agent ID first
curl "http://localhost:8000/me/avees" \
  -H "Authorization: Bearer $TOKEN"

# Then run research
curl -X POST "http://localhost:8000/avees/YOUR_AGENT_ID/web-research" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "topic": "Artificial Intelligence",
    "max_sources": 5,
    "layer": "public"
  }'
```

## ✅ Verification

After creating an agent with research, verify it worked:

### Check in Database
```sql
-- Check agent metadata
SELECT handle, display_name, research_topic, research_completed_at, auto_research_enabled
FROM avees
WHERE handle = 'test-agent';

-- Check documents added
SELECT d.title, d.source, COUNT(dc.id) as chunks
FROM documents d
LEFT JOIN document_chunks dc ON dc.document_id = d.id
WHERE d.avee_id = (SELECT id FROM avees WHERE handle = 'test-agent')
GROUP BY d.id, d.title, d.source;

-- Check total chunks
SELECT COUNT(*) as total_chunks
FROM document_chunks
WHERE avee_id = (SELECT id FROM avees WHERE handle = 'test-agent');
```

### Test in Chat
1. Go to http://localhost:3000/chat/test-agent
2. Ask a question related to the research topic
3. The agent should answer using the researched knowledge!

Example questions:
- "What do you know about yourself?"
- "Tell me about your background"
- "What are your main achievements?"

## 🔧 Troubleshooting

### Migration Failed
- Make sure you have the correct database credentials
- Check if the columns already exist: `\d avees` in psql
- If columns exist, migration is already applied

### "No sources found"
- DuckDuckGo works but may be rate-limited
- Try again in a few minutes
- Or configure Google/SerpAPI keys

### Research Takes Too Long
- Reduce `research_max_sources` to 3
- Some websites are slow to load
- This is normal for first run

### Agent Created but Research Failed
- This is OK! Agent is still usable
- Check backend logs for details
- Can retry research manually with the second endpoint

## 📊 What's Happening Behind the Scenes

When you enable auto-research:

1. **Search**: Queries DuckDuckGo/Google/SerpAPI for URLs about the topic
2. **Scrape**: Downloads and extracts text from each URL
3. **Classify**: Categorizes sources (news, encyclopedia, blog, etc.)
4. **Chunk**: Breaks content into manageable pieces
5. **Embed**: Generates vector embeddings using OpenAI
6. **Store**: Saves to `documents` and `document_chunks` tables
7. **Update**: Marks agent with research metadata

All this happens automatically in the background!

## 🎯 Next Steps

1. **Try different topics**: People, companies, technologies, concepts
2. **Adjust source count**: More sources = more comprehensive knowledge
3. **Check results**: See what was actually added to knowledge base
4. **Test in chat**: Ask questions to verify the agent knows the information
5. **Configure API keys**: For better/faster results in production

## 📝 Examples to Try

```javascript
// Celebrity
{ handle: "taylor-swift", display_name: "Taylor Swift", auto_research: true }

// Tech Expert
{ handle: "ai-expert", display_name: "AI Expert", auto_research: true, research_topic: "Artificial Intelligence" }

// Company
{ handle: "tesla", display_name: "Tesla", auto_research: true, research_topic: "Tesla Inc" }

// Historical Figure
{ handle: "einstein", display_name: "Albert Einstein", auto_research: true }

// Topic Expert
{ handle: "climate", display_name: "Climate Expert", auto_research: true, research_topic: "Climate Change" }
```

## 🆘 Need Help?

Check these files:
- **Full Guide**: `WEB_RESEARCH_GUIDE.md`
- **Backend Logs**: Look for `[Web Research]` and `[Agent Creation]` messages
- **Frontend Console**: Check browser console for errors
- **Database**: Query tables to verify data was stored

---

**That's it!** You now have automatic web research for all your agents. 🎉


