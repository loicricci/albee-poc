# Twitter Integration - Quick Start

## 🚀 Setup (5 minutes)

### 1. Get Twitter API Token

1. Go to [Twitter Developer Portal](https://developer.twitter.com/en/portal/dashboard)
2. Create app → Copy **Bearer Token**

### 2. Configure

Add to `backend/.env`:

```bash
TWITTER_BEARER_TOKEN=your_bearer_token_here
```

### 3. Install & Migrate

```bash
# Install dependency
pip install tweepy>=4.14.0

# Run migration
cd backend
python run_specific_migration.py 014_twitter_integration.sql

# Test setup
python test_twitter_integration.py
```

### 4. Start Server

```bash
cd backend
uvicorn main:app --reload
```

## 📝 Quick Usage

### Configure an Agent

```bash
curl -X POST http://localhost:8000/agents/YOUR_AGENT_ID/twitter/config \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "is_enabled": true,
    "search_topics": ["AI", "machine learning"],
    "twitter_accounts": ["OpenAI", "AnthropicAI"],
    "max_tweets_per_fetch": 10,
    "fetch_frequency_hours": 24,
    "layer": "public",
    "auto_create_updates": true
  }'
```

### Fetch Tweets Now

```bash
curl -X POST "http://localhost:8000/agents/YOUR_AGENT_ID/twitter/fetch?force=true" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Check Status

```bash
curl http://localhost:8000/twitter/status
```

## 🎯 Use Cases

### AI News Bot
```json
{
  "search_topics": ["GPT-4", "Claude AI", "AI breakthrough"],
  "twitter_accounts": ["OpenAI", "AnthropicAI", "GoogleAI"],
  "fetch_frequency_hours": 6
}
```

### Company Monitor
```json
{
  "search_topics": ["YourCompany", "#yourtopic"],
  "twitter_accounts": ["competitor1", "competitor2"],
  "fetch_frequency_hours": 12
}
```

### Personal Interest
```json
{
  "search_topics": ["web3", "blockchain"],
  "twitter_accounts": ["VitalikButerin"],
  "fetch_frequency_hours": 24
}
```

## 🔍 Advanced Search

Use Twitter operators in `search_topics`:

```json
{
  "search_topics": [
    "from:username",           // From specific user
    "#hashtag",                // Hashtag
    "word1 AND word2",         // Both words
    "\"exact phrase\"",        // Exact match
    "keyword -exclude",        // Exclude word
    "min_faves:100"            // Popular tweets
  ]
}
```

## 🛠️ Troubleshooting

**"Twitter API not configured"**
→ Check `TWITTER_BEARER_TOKEN` in `.env` and restart server

**"Rate limit exceeded"**
→ Reduce `max_tweets_per_fetch` or increase `fetch_frequency_hours`

**No tweets found**
→ Try broader search terms, check account names are correct

**Updates not in chat**
→ Verify `auto_create_updates: true` and check layer permissions

## 📚 Full Documentation

See `TWITTER_INTEGRATION_GUIDE.md` for complete details.

## 🔄 Auto-Scheduling

For production, run periodic sync:

```python
# schedule_sync.py
from backend.db import SessionLocal
from backend.twitter_sync import sync_all_agents

db = SessionLocal()
results = sync_all_agents(db)
print(results)
db.close()
```

Add to crontab (runs every hour):
```bash
0 * * * * cd /path/to/gabee-poc && python schedule_sync.py
```

## 🎉 That's It!

Your agents can now stay updated with real-time Twitter content!








