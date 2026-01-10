# 🚀 Quick Start: AI Conversation Enhancements

## Overview
This guide will help you get the new AI conversation features up and running in 5 minutes.

---

## Step 1: Install Dependencies

```bash
cd backend
pip install -r requirements.txt
```

**New packages installed:**
- `numpy` - For cosine similarity in semantic filtering
- Existing packages already include OpenAI and sentence-transformers

---

## Step 2: Run Database Migration

```bash
# Make sure your DATABASE_URL is set in backend/.env
python -m backend.run_migration
```

**What this creates:**
- ✅ `conversation_summaries` table
- ✅ `avee_memories` table (with vector search support)
- ✅ `conversation_quality` table
- ✅ `avees.persona_notes` column

**Verify migration:**
```bash
psql $DATABASE_URL -c "\dt conversation_summaries"
```

---

## Step 3: Restart Backend

```bash
cd backend
uvicorn backend.main:app --reload --port 8000
```

**Check it's working:**
```bash
curl http://localhost:8000/health
# Should return: {"ok": true}
```

---

## Step 4: Test Streaming (Terminal)

```bash
# Replace these with your actual values
TOKEN="your_supabase_jwt_token"
CONV_ID="your_conversation_uuid"

# Test streaming endpoint
curl -N \
  -H "Authorization: Bearer $TOKEN" \
  -X POST \
  "http://localhost:8000/chat/stream?conversation_id=$CONV_ID&question=Hello,%20how%20are%20you?"
```

**Expected output:**
```
data: {"event": "start", "model": "gpt-4o-mini"}

data: {"token": "Hello"}

data: {"token": "!"}

data: {"token": " I"}

data: {"token": "'m"}
...
data: {"event": "complete", "message_id": "...", "total_tokens": 15}
```

---

## Step 5: Test Enhanced Chat

```bash
# Test with GPT-4o-mini (default, cheaper)
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8000/chat/ask-v2?conversation_id=$CONV_ID&question=Tell%20me%20about%20yourself"

# Test with GPT-4o (better quality, more expensive)
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8000/chat/ask-v2?conversation_id=$CONV_ID&question=What%20are%20your%20core%20values?&use_gpt4o=true"
```

**Response includes:**
```json
{
  "answer": "...",
  "quality_scores": {
    "relevance_score": 0.95,
    "engagement_score": 0.88
  },
  "topics": ["philosophy", "values"],
  "follow_up_suggestions": [
    "How do these values influence your decisions?",
    "What experiences shaped these values?"
  ],
  "memories_extracted": 2,
  "conversation_title": "Values Discussion"
}
```

---

## Step 6: Check Conversation Intelligence

```bash
# Get analytics for a conversation
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8000/chat/$CONV_ID/intelligence"
```

**Response:**
```json
{
  "metrics": {
    "total_turns": 15,
    "avg_user_message_length": 127.5,
    "user_satisfaction_estimate": 0.85
  },
  "topics": ["values", "philosophy", "career"],
  "average_quality": {
    "relevance": 92,
    "engagement": 87,
    "factual_grounding": 94
  }
}
```

---

## Step 7: Check Extracted Memories

```bash
# View memories extracted from conversations
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8000/chat/$CONV_ID/memories"
```

**Response:**
```json
{
  "memories": [
    {
      "type": "preference",
      "content": "User values honesty and transparency",
      "confidence": 0.92
    },
    {
      "type": "fact",
      "content": "User is a software engineer",
      "confidence": 0.98
    }
  ],
  "total": 2
}
```

---

## What Changed?

### New Endpoints
- ✅ `POST /chat/stream` - Streaming responses
- ✅ `POST /chat/ask-v2` - Enhanced chat with all features
- ✅ `GET /chat/{id}/intelligence` - Conversation analytics
- ✅ `GET /chat/{id}/memories` - View extracted memories

### Enhanced Features
- ✅ **Streaming:** Real-time token-by-token responses
- ✅ **GPT-4o:** Better reasoning (toggle with `?use_gpt4o=true`)
- ✅ **Smart Context:** Semantic message filtering
- ✅ **Memory:** Automatic extraction and semantic search
- ✅ **Intelligence:** Quality scoring, topics, follow-ups
- ✅ **Auto-titles:** Conversations get descriptive titles

### Database
- ✅ 3 new tables for memories, summaries, quality
- ✅ 1 new column for persona notes

---

## Troubleshooting

### Migration fails with "relation already exists"
**Solution:** This is fine! Tables might already exist from manual creation.

### Streaming returns empty
**Solution:** Check that frontend supports Server-Sent Events (SSE). Use `-N` flag with curl.

### OpenAI rate limits
**Solution:** 
- Use GPT-4o-mini by default (cheaper, faster)
- Enable context filtering to reduce tokens
- Add retry logic with exponential backoff

### Memory extraction is slow
**Solution:**
- Disable with `?extract_memories=false`
- Extract async in production (add Celery task queue)

### Context filtering too aggressive
**Solution:** Adjust in `backend/context_manager.py`:
```python
self.max_context_messages = 30  # Increase from 20
```

---

## Production Checklist

Before deploying to production:

- [ ] Add Redis caching for embeddings
- [ ] Move memory extraction to background jobs (Celery)
- [ ] Add rate limiting (slowapi)
- [ ] Monitor OpenAI costs (add budget alerts)
- [ ] Set up error tracking (Sentry)
- [ ] Add conversation quality alerts (email when quality drops)
- [ ] Implement prompt caching (OpenAI's new feature)
- [ ] Add A/B testing for GPT-4o vs 4o-mini

---

## Cost Optimization

### Current Costs (per 1000 messages)
- **GPT-4o-mini:** ~$0.30 (recommended default)
- **GPT-4o:** ~$3.00 (use selectively)
- **Embeddings:** ~$0.05
- **Reranking:** Free (local model)

### Optimization Tips
1. **Use 4o-mini by default** - Switch to 4o for complex queries only
2. **Enable semantic filtering** - Reduces context by 50-70%
3. **Cache embeddings** - Store frequently used embeddings in Redis
4. **Batch operations** - Extract memories async, not per message
5. **Smart reranking** - Only rerank when >10 candidates exist

---

## Next Steps

### Integrate in Frontend
See `AI_ENHANCEMENTS.md` section "Frontend Integration" for React/Next.js examples.

### Monitor Performance
```sql
-- Track model usage
SELECT model_used, COUNT(*) 
FROM messages 
WHERE role = 'assistant' 
GROUP BY model_used;

-- Average quality scores
SELECT AVG(relevance_score) as relevance
FROM conversation_quality;
```

### Fine-tune Configuration
Edit `backend/context_manager.py` to adjust:
- `max_context_messages` - More context = more tokens
- `max_tokens` - Reserve for GPT-4o's 128K window
- `summary_threshold` - When to create summaries

---

## Support

**Documentation:**
- Full guide: `AI_ENHANCEMENTS.md`
- API docs: `http://localhost:8000/docs`

**Common Issues:**
- Streaming not working? Check SSE support
- High costs? Use GPT-4o-mini and enable filtering
- Slow responses? Add Redis caching
- Poor quality? Try GPT-4o for complex queries

---

**You're all set!** 🎉

Your Avees now have:
- Real-time streaming responses
- GPT-4o intelligence
- Smart context management
- Long-term memory
- Conversation quality tracking

Test it out and watch your Avees become even more intelligent! 🤖✨













