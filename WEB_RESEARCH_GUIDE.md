# Web Research & Auto-Knowledge Feature for Agents

## Overview

The Web Research feature automatically gathers initial knowledge from the web about a person or topic when creating an agent. This kickstarts your agent with relevant, up-to-date information from multiple web sources.

## Features

### ✅ Automatic Knowledge Gathering
- Automatically searches the web for information about any topic or person
- Scrapes multiple sources (configurable: 3-10 sources)
- Extracts and cleans content from web pages
- Embeds content into the agent's knowledge base using RAG (Retrieval Augmented Generation)

### 🎯 Intelligent Query Generation
The system automatically generates optimized search queries based on the topic type:

- **People**: Biography, profile, career, achievements, LinkedIn, latest news
- **Companies**: About, products/services, history, recent news
- **Concepts/Technologies**: Definitions, how it works, applications, tutorials
- **Generic Topics**: Overview, background, encyclopedia entries

### 🔍 Multi-Source Search Support
- **SerpAPI** (paid, best results) - requires `SERPAPI_KEY`
- **Google Custom Search** (free tier) - requires `GOOGLE_SEARCH_API_KEY` and `GOOGLE_SEARCH_ENGINE_ID`
- **DuckDuckGo** (no API key needed, fallback)

### 📊 Source Classification
Automatically categorizes sources as:
- Encyclopedia (Wikipedia, etc.)
- Social Media (LinkedIn, Twitter, etc.)
- News sites
- Academic sources
- Blogs
- General websites

## How to Use

### 1. Backend Setup

#### Required Dependencies
All dependencies are already in `backend/requirements.txt`:
```bash
requests
beautifulsoup4
lxml
```

#### Optional: Configure Search API Keys
Add to `backend/.env`:
```env
# Option 1: SerpAPI (paid, best results)
SERPAPI_KEY=your_serpapi_key_here

# Option 2: Google Custom Search (free tier)
GOOGLE_SEARCH_API_KEY=your_google_api_key
GOOGLE_SEARCH_ENGINE_ID=your_search_engine_id

# If neither is set, falls back to DuckDuckGo (no API key needed)
```

#### Run Database Migration
```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt

# Run the migration
psql -h localhost -U your_user -d your_database -f migrations/005_agent_web_research.sql
```

### 2. Creating an Agent with Auto-Research

#### Via Frontend UI

1. Navigate to "My Agents" page
2. Click "Create New Agent"
3. Fill in the basic details:
   - Handle (required)
   - Display Name (optional)
4. Enable "Automatic Web Research" toggle
5. Configure research options:
   - **Research Topic**: Leave blank to use agent name, or specify a custom topic
   - **Max Sources**: Slide to choose 3-10 sources (more sources = more comprehensive but slower)
6. Click "Create Agent"

The agent will be created immediately, and web research will happen automatically. You'll see a success message showing:
- Number of documents added
- Total knowledge chunks created
- The research topic used

#### Via API

**Endpoint**: `POST /avees`

**Parameters**:
```
handle (required): Agent handle (e.g., "elon-musk")
display_name (optional): Display name (e.g., "Elon Musk")
auto_research (optional, default: false): Enable automatic web research
research_topic (optional): Topic to research (defaults to display_name or handle)
research_max_sources (optional, default: 5): Number of sources to scrape (3-10)
research_layer (optional, default: "public"): Layer to store documents
```

**Example cURL**:
```bash
curl -X POST "http://localhost:8000/avees?handle=elon-musk&display_name=Elon%20Musk&auto_research=true&research_max_sources=5" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Example Response**:
```json
{
  "id": "uuid-here",
  "handle": "elon-musk",
  "auto_research_enabled": true,
  "research": {
    "completed": true,
    "topic": "Elon Musk",
    "documents_added": 6,
    "total_chunks": 42,
    "layer": "public",
    "documents": [
      {
        "document_id": "uuid",
        "title": "Web Research: Elon Musk",
        "source": "web_research:Elon Musk,Elon Musk biography,Elon Musk profile",
        "chunks": 8
      },
      {
        "document_id": "uuid",
        "title": "Elon Musk - Wikipedia",
        "source": "https://en.wikipedia.org/wiki/Elon_Musk",
        "chunks": 7
      }
      // ... more documents
    ]
  }
}
```

### 3. Manual Web Research (Post-Creation)

You can also trigger web research after an agent is created:

**Endpoint**: `POST /avees/{avee_id}/web-research`

**Request Body**:
```json
{
  "topic": "Artificial Intelligence",
  "max_sources": 5,
  "layer": "public"
}
```

**Example**:
```bash
curl -X POST "http://localhost:8000/avees/YOUR_AGENT_ID/web-research" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"topic": "Artificial Intelligence", "max_sources": 5, "layer": "public"}'
```

## Architecture

### Files Modified/Created

1. **`backend/models.py`**: Added fields to `Avee` model:
   - `research_topic`: Topic that was researched
   - `research_completed_at`: Timestamp of completion
   - `auto_research_enabled`: Whether auto-research was used

2. **`backend/web_research.py`**: Core research module
   - `WebResearcher` class: Handles search and scraping
   - Intelligent query generation based on topic type
   - Multi-provider search support
   - Source classification

3. **`backend/main.py`**: Enhanced agent creation endpoint
   - Added optional auto-research parameters
   - Integrates web research into creation flow
   - Handles errors gracefully (agent still created if research fails)

4. **`backend/migrations/005_agent_web_research.sql`**: Database migration
   - Adds new columns to `avees` table
   - Creates indexes for performance

5. **`frontend/src/lib/api.ts`**: Updated API client
   - Added web research parameters to `createAgent()`

6. **`frontend/src/app/(app)/my-agents/page.tsx`**: Enhanced UI
   - Toggle for enabling auto-research
   - Research topic input
   - Source count slider
   - Success feedback with research results

### Data Flow

```
User creates agent with auto_research=true
    ↓
Agent created in database
    ↓
WebResearcher generates search queries
    ↓
Search API returns URLs
    ↓
url_scraper scrapes each URL
    ↓
Content extracted and cleaned
    ↓
Content chunked (rag_utils.chunk_text)
    ↓
Chunks embedded (openai_embed.embed_texts)
    ↓
Stored in document_chunks with vectors
    ↓
Agent metadata updated with research info
    ↓
Success response returned
```

## Search Provider Setup

### Option 1: SerpAPI (Recommended for Production)

1. Sign up at https://serpapi.com/
2. Get your API key
3. Add to `.env`: `SERPAPI_KEY=your_key`
4. Pricing: ~$50/month for 5,000 searches

### Option 2: Google Custom Search (Free Tier)

1. Get a Google API key:
   - Go to https://console.cloud.google.com/
   - Enable "Custom Search API"
   - Create API key

2. Create a Custom Search Engine:
   - Go to https://cse.google.com/cse/
   - Create a new search engine
   - Set it to search the entire web
   - Copy the Search Engine ID

3. Add to `.env`:
   ```
   GOOGLE_SEARCH_API_KEY=your_api_key
   GOOGLE_SEARCH_ENGINE_ID=your_engine_id
   ```

4. Limits: 100 queries/day free, $5/1000 queries after

### Option 3: DuckDuckGo (No Setup Required)

- No API key needed
- Works out of the box
- Limited to ~10 results per query
- Rate limits may apply
- Less reliable than paid options

## Performance Considerations

### Timing
- **3 sources**: ~10-20 seconds
- **5 sources**: ~20-40 seconds
- **10 sources**: ~40-80 seconds

Time depends on:
- Search API response time
- Website loading speed
- Content size
- Embedding generation

### Cost
- **Search API calls**: 3-5 queries per agent (depending on sources)
- **OpenAI embeddings**: ~$0.00001 per 1K tokens
- **Storage**: Minimal PostgreSQL space

### Optimization Tips

1. **Use caching**: Implement Redis to cache search results
2. **Async processing**: Use Celery for background research
3. **Batch embeddings**: Process multiple chunks together
4. **Smart chunking**: Adjust chunk size based on content type
5. **Deduplicate**: Skip duplicate URLs across searches

## Troubleshooting

### "No sources found"
- Check if search API keys are configured
- Try a different/simpler topic
- Check internet connectivity
- Verify search provider is working

### "Research failed but agent created"
- Agent is still usable, research can be retried
- Check backend logs for detailed error
- Common causes:
  - Search API rate limits
  - Network timeout
  - Invalid URLs
  - Scraping blocked by websites

### Slow research
- Reduce `max_sources` (try 3-5 instead of 10)
- Some websites are slow to load
- Consider async/background processing for production

### "Failed to scrape URL"
- Some sites block scrapers
- JavaScript-heavy sites may return minimal content
- Try different search queries to get more scrapable sources

## Best Practices

1. **Start with 5 sources**: Good balance of speed and comprehensiveness
2. **Use specific topics**: "Elon Musk" works better than "famous people"
3. **Test without API keys first**: DuckDuckGo works for testing
4. **Monitor costs**: Track search API usage
5. **Layer appropriately**: Use "public" for general knowledge, "intimate" for sensitive info
6. **Verify results**: Check what was actually added to knowledge base
7. **Iterative approach**: Can run research multiple times with different topics

## Future Enhancements

### Planned Features
- [ ] Background/async research processing
- [ ] Research history and re-run capability
- [ ] Source credibility scoring
- [ ] Image/video content extraction
- [ ] PDF document support
- [ ] Social media profile scraping
- [ ] Automatic periodic updates
- [ ] Research templates by agent type
- [ ] Multi-language support
- [ ] Custom search query overrides

### Advanced Use Cases
- **Celebrity/Public Figure Agents**: Automatically gather biography, news, achievements
- **Expert Agents**: Gather technical documentation, research papers
- **Brand/Company Agents**: Company info, products, news
- **Topic Experts**: Comprehensive knowledge on specific subjects
- **News Agents**: Latest information on current events

## Example Use Cases

### 1. Celebrity Agent
```javascript
createAgent({
  handle: "taylor-swift",
  display_name: "Taylor Swift",
  auto_research: true,
  research_max_sources: 7
})
// Gathers: Biography, discography, recent news, achievements
```

### 2. Tech Expert Agent
```javascript
createAgent({
  handle: "ai-expert",
  display_name: "AI Expert",
  auto_research: true,
  research_topic: "Artificial Intelligence machine learning",
  research_max_sources: 10
})
// Gathers: Definitions, tutorials, latest developments, applications
```

### 3. Historical Figure
```javascript
createAgent({
  handle: "einstein",
  display_name: "Albert Einstein",
  auto_research: true,
  research_max_sources: 5
})
// Gathers: Biography, scientific contributions, historical context
```

## Conclusion

The Web Research feature provides a powerful way to bootstrap agents with real-world knowledge automatically. It's designed to be:

- **Easy to use**: Simple toggle in UI or API parameter
- **Flexible**: Works with or without API keys
- **Intelligent**: Automatically optimizes queries for different topics
- **Reliable**: Graceful error handling
- **Extensible**: Easy to add new search providers or scrapers

For questions or issues, check the logs or refer to the main documentation.











