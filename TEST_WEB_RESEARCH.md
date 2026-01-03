# Testing the Web Research Feature

## Quick Test (Recommended)

### 1. Run Automated Tests

```bash
cd /Users/loicricci/gabee-poc
source venv/bin/activate  # or source backend/.venv/bin/activate

# Run the test suite
python backend/test_web_research.py
```

This will test:
- ✅ URL scraping functionality
- ✅ Web researcher search and scraping
- ✅ Intelligent query generation
- ✅ Research formatting for agents
- ✅ Content chunking and embedding

Expected output:
```
====================================================
WEB RESEARCH FEATURE - COMPREHENSIVE TEST SUITE
====================================================

====================================================
TEST 1: URL Scraper
====================================================
✅ Success!

... (more tests)

====================================================
TEST SUMMARY
====================================================
URL Scraper: ✅ PASSED
Web Researcher: ✅ PASSED
Query Generation: ✅ PASSED
Research & Format: ✅ PASSED
Chunking & Embedding: ✅ PASSED

Total: 5/5 tests passed

🎉 All tests passed! Web research feature is working correctly.
```

### 2. Test via API (Manual)

Start the backend if not running:
```bash
cd /Users/loicricci/gabee-poc
source venv/bin/activate
cd backend
uvicorn main:app --reload --port 8000
```

In another terminal, test the endpoint:

```bash
# First, get your JWT token (login via frontend or use existing session)
# Then set it here:
TOKEN="your_jwt_token"

# Test 1: Create agent with auto-research
curl -X POST "http://localhost:8000/avees?handle=test-einstein&display_name=Albert%20Einstein&auto_research=true&research_max_sources=3" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Accept: application/json" \
  | jq '.'

# Expected response:
# {
#   "id": "uuid",
#   "handle": "test-einstein",
#   "auto_research_enabled": true,
#   "research": {
#     "completed": true,
#     "topic": "Albert Einstein",
#     "documents_added": 4,
#     "total_chunks": 28,
#     "layer": "public",
#     "documents": [...]
#   }
# }

# Test 2: Verify documents were added
curl "http://localhost:8000/avees/test-einstein" \
  -H "Authorization: Bearer $TOKEN" \
  | jq '.'

# Test 3: Manual research on existing agent
AGENT_ID="your_agent_id"
curl -X POST "http://localhost:8000/avees/$AGENT_ID/web-research" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"topic": "Quantum Physics", "max_sources": 3, "layer": "public"}' \
  | jq '.'
```

### 3. Test via Frontend UI

1. **Start Frontend** (if not running):
   ```bash
   cd /Users/loicricci/gabee-poc/frontend
   npm run dev
   ```

2. **Navigate to**: http://localhost:3000/my-agents

3. **Create Test Agent**:
   - Click "Create New Agent"
   - Handle: `test-agent`
   - Display Name: `Elon Musk`
   - Enable "Automatic Web Research" toggle
   - Set Max Sources: 5
   - Click "Create Agent"

4. **Wait for Results** (20-40 seconds)
   - Should see success message
   - Shows number of documents added
   - Shows total knowledge chunks created

5. **Verify in Chat**:
   - Click "Chat" button on the agent
   - Ask: "What do you know about yourself?"
   - Agent should answer with information from the web research!

## Database Verification

Check that data was properly stored:

```sql
-- Check agent metadata
SELECT 
    handle, 
    display_name, 
    research_topic, 
    research_completed_at, 
    auto_research_enabled
FROM avees
WHERE handle = 'test-agent';

-- Check documents
SELECT 
    d.id,
    d.title,
    d.source,
    LENGTH(d.content) as content_length,
    COUNT(dc.id) as chunk_count
FROM documents d
LEFT JOIN document_chunks dc ON dc.document_id = d.id
WHERE d.avee_id = (SELECT id FROM avees WHERE handle = 'test-agent')
GROUP BY d.id, d.title, d.source;

-- Check total chunks with embeddings
SELECT 
    COUNT(*) as total_chunks,
    COUNT(embedding) as chunks_with_embeddings
FROM document_chunks
WHERE avee_id = (SELECT id FROM avees WHERE handle = 'test-agent');

-- Sample a chunk to verify content
SELECT 
    chunk_index,
    LEFT(content, 200) as content_preview,
    LENGTH(embedding::text) as embedding_length
FROM document_chunks
WHERE avee_id = (SELECT id FROM avees WHERE handle = 'test-agent')
ORDER BY chunk_index
LIMIT 3;
```

Expected results:
- `avees`: Should have `research_topic` populated, `research_completed_at` timestamp
- `documents`: Should have 4-6 documents (1 overview + individual sources)
- `document_chunks`: Should have 20-50 chunks with embeddings

## Test Different Scenarios

### Scenario 1: Person Research
```javascript
{
  handle: "marie-curie",
  display_name: "Marie Curie",
  auto_research: true,
  research_max_sources: 5
}
```
Expected: Biography, achievements, Nobel prizes, scientific work

### Scenario 2: Company Research
```javascript
{
  handle: "openai",
  display_name: "OpenAI",
  auto_research: true,
  research_topic: "OpenAI company",
  research_max_sources: 5
}
```
Expected: Company info, products (ChatGPT, GPT-4), history, recent news

### Scenario 3: Topic Research
```javascript
{
  handle: "quantum-computing",
  display_name: "Quantum Computing Expert",
  auto_research: true,
  research_topic: "Quantum Computing",
  research_max_sources: 7
}
```
Expected: Definitions, how it works, applications, latest developments

### Scenario 4: Custom Topic
```javascript
{
  handle: "climate-expert",
  display_name: "Climate Expert",
  auto_research: true,
  research_topic: "Climate Change impact and solutions",
  research_max_sources: 8
}
```
Expected: Climate change info, impacts, solutions, recent research

## Test Edge Cases

### 1. No Results Topic
```bash
curl -X POST "http://localhost:8000/avees?handle=test-invalid&display_name=XYZ123NoResults&auto_research=true&research_max_sources=3" \
  -H "Authorization: Bearer $TOKEN"
```
Expected: Agent created, research returns "No sources found"

### 2. Minimal Sources
```bash
curl -X POST "http://localhost:8000/avees?handle=test-minimal&display_name=Test&auto_research=true&research_max_sources=3" \
  -H "Authorization: Bearer $TOKEN"
```
Expected: Faster completion (10-20 seconds)

### 3. Maximum Sources
```bash
curl -X POST "http://localhost:8000/avees?handle=test-max&display_name=Artificial%20Intelligence&auto_research=true&research_max_sources=10" \
  -H "Authorization: Bearer $TOKEN"
```
Expected: More comprehensive but slower (40-80 seconds)

### 4. Without Auto-Research (Control)
```bash
curl -X POST "http://localhost:8000/avees?handle=test-no-research&display_name=Test&auto_research=false" \
  -H "Authorization: Bearer $TOKEN"
```
Expected: Instant creation, no research data

## Performance Benchmarks

Track these metrics:

| Metric | Expected Value |
|--------|---------------|
| Agent creation (no research) | < 1 second |
| Research with 3 sources | 10-20 seconds |
| Research with 5 sources | 20-40 seconds |
| Research with 10 sources | 40-80 seconds |
| Documents per 5 sources | 5-6 documents |
| Chunks per document | 5-10 chunks |
| Embedding generation | ~1 second per 5 chunks |

## Troubleshooting Tests

### Test Fails: "No module named 'url_scraper'"
```bash
# Verify file location
ls -la backend/url_scraper.py

# Should exist. If not, it's in root:
mv url_scraper.py backend/url_scraper.py
```

### Test Fails: "No sources found"
- DuckDuckGo may be rate-limited
- Try again in a few minutes
- Or configure Google/SerpAPI API keys

### Test Fails: "OpenAI API error"
```bash
# Check .env file
cat backend/.env | grep OPENAI_API_KEY

# Verify key is valid
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer $OPENAI_API_KEY"
```

### Test Takes Too Long
- Normal for first run with cold start
- Reduce `max_sources` to 3
- Some websites are slow to load

### Frontend Shows "Request timeout"
- Research takes time, this is normal
- Increase timeout in `frontend/src/lib/api.ts`:
  ```typescript
  async function fetchWithTimeout(..., ms = 60000) // 60 seconds
  ```

## Success Criteria

All of these should be true:

- ✅ Backend tests pass (5/5)
- ✅ API creates agent with research in < 60 seconds
- ✅ Documents are saved to database
- ✅ Embeddings are generated for all chunks
- ✅ Frontend UI shows success message
- ✅ Frontend UI displays research results
- ✅ Chat with agent returns knowledge-based answers
- ✅ Database queries show populated data

## Next Steps After Testing

1. **Configure Search APIs** (for production):
   - Add Google Custom Search or SerpAPI keys
   - Better results and rate limits

2. **Optimize Performance**:
   - Implement Redis caching for search results
   - Use Celery for async/background processing
   - Batch embedding generation

3. **Monitor Usage**:
   - Track search API costs
   - Monitor OpenAI embedding costs
   - Log research success rates

4. **Enhance Feature**:
   - Add automatic periodic updates
   - Implement source credibility scoring
   - Add PDF/document support
   - Enable image extraction

## Support

If tests fail:
1. Check backend logs: Look for `[Web Research]` messages
2. Check database: Run SQL queries above
3. Review error messages: Most are self-explanatory
4. Check API keys: Verify OpenAI key is valid
5. Network issues: Some websites block scrapers

---

Happy testing! 🚀











