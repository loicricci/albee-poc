# Twitter Integration Guide

## Overview

The Twitter integration allows agents to automatically fetch tweets based on topics or specific accounts and convert them into agent updates. These updates are stored in the agent's knowledge base and can be used during conversations.

## Features

✅ **Auto-fetch tweets by topic** - Search for tweets matching specific keywords/topics  
✅ **Monitor specific accounts** - Fetch tweets from specific Twitter users  
✅ **Automatic update creation** - Convert tweets to agent updates with full metadata  
✅ **RAG integration** - Tweets are embedded and searchable in conversations  
✅ **Access control** - Configure which layer (public/friends/intimate) stores tweets  
✅ **Scheduling** - Set fetch frequency (hourly/daily/weekly)  
✅ **Manual triggers** - Force immediate fetch when needed  
✅ **Fetch logs** - Track all fetch operations for debugging

## Setup

### 1. Get Twitter API Credentials

1. Go to [Twitter Developer Portal](https://developer.twitter.com/en/portal/dashboard)
2. Create a new app (or use existing)
3. Navigate to "Keys and Tokens"
4. Copy the **Bearer Token**

### 2. Configure Environment

Add to your `.env` file:

```bash
TWITTER_BEARER_TOKEN=your_bearer_token_here
```

### 3. Run Database Migration

```bash
cd backend
python run_specific_migration.py 014_twitter_integration.sql
```

### 4. Install Dependencies

```bash
cd backend
pip install -r requirements.txt
```

## API Endpoints

### Check Twitter API Status

```http
GET /twitter/status
```

Returns whether Twitter API is configured and available.

**Response:**
```json
{
  "available": true,
  "message": "Twitter API is configured and ready"
}
```

---

### Configure Twitter Auto-Fetch

```http
POST /agents/{agent_id}/twitter/config
```

**Request Body:**
```json
{
  "is_enabled": true,
  "search_topics": ["AI", "machine learning", "GPT-4"],
  "twitter_accounts": ["elonmusk", "OpenAI", "AndrewYNg"],
  "max_tweets_per_fetch": 10,
  "fetch_frequency_hours": 24,
  "layer": "public",
  "auto_create_updates": true
}
```

**Parameters:**
- `is_enabled`: Enable/disable auto-fetch
- `search_topics`: Array of search keywords (supports Twitter search operators)
- `twitter_accounts`: Array of Twitter usernames (without @)
- `max_tweets_per_fetch`: Maximum tweets to fetch per sync (1-100)
- `fetch_frequency_hours`: Hours between automatic fetches
- `layer`: Access layer for storing tweets (public/friends/intimate)
- `auto_create_updates`: Automatically create agent updates from tweets

**Response:**
```json
{
  "id": "uuid",
  "avee_id": "uuid",
  "is_enabled": true,
  "search_topics": ["AI", "machine learning"],
  "twitter_accounts": ["elonmusk", "OpenAI"],
  "max_tweets_per_fetch": 10,
  "fetch_frequency_hours": 24,
  "last_fetch_at": "2024-01-15T10:30:00Z",
  "layer": "public",
  "auto_create_updates": true,
  "created_at": "2024-01-15T09:00:00Z",
  "updated_at": null
}
```

---

### Get Twitter Configuration

```http
GET /agents/{agent_id}/twitter/config
```

Returns the current Twitter configuration for an agent.

---

### Delete Twitter Configuration

```http
DELETE /agents/{agent_id}/twitter/config
```

Removes Twitter auto-fetch for an agent.

---

### Manually Fetch Tweets

```http
POST /agents/{agent_id}/twitter/fetch?force=true
```

**Query Parameters:**
- `force`: Force fetch even if not due yet (optional)

**Response:**
```json
{
  "status": "success",
  "tweets_fetched": 15,
  "updates_created": 15,
  "message": null
}
```

---

### Get Fetch Logs

```http
GET /agents/{agent_id}/twitter/logs?limit=20
```

Returns recent fetch operations for debugging.

**Response:**
```json
[
  {
    "id": "uuid",
    "fetch_status": "success",
    "tweets_fetched": 10,
    "updates_created": 10,
    "error_message": null,
    "created_at": "2024-01-15T10:30:00Z"
  }
]
```

## Usage Examples

### Example 1: AI News Agent

Create an agent that tracks AI developments:

```python
import requests

# Create agent
agent_response = requests.post(
    "http://localhost:8000/avees",
    json={
        "handle": "ai_news",
        "display_name": "AI News Bot",
        "bio": "Tracks latest AI developments"
    },
    headers={"Authorization": "Bearer YOUR_TOKEN"}
)
agent_id = agent_response.json()["id"]

# Configure Twitter auto-fetch
requests.post(
    f"http://localhost:8000/agents/{agent_id}/twitter/config",
    json={
        "is_enabled": True,
        "search_topics": [
            "GPT-4",
            "Claude AI",
            "artificial intelligence breakthrough"
        ],
        "twitter_accounts": ["OpenAI", "AnthropicAI", "GoogleAI"],
        "max_tweets_per_fetch": 20,
        "fetch_frequency_hours": 6,  # Every 6 hours
        "layer": "public",
        "auto_create_updates": True
    },
    headers={"Authorization": "Bearer YOUR_TOKEN"}
)
```

### Example 2: Company News Monitor

Track company mentions and industry news:

```python
# Configure for company monitoring
requests.post(
    f"http://localhost:8000/agents/{agent_id}/twitter/config",
    json={
        "is_enabled": True,
        "search_topics": [
            "YourCompany",
            "your industry",
            "#yourtopic"
        ],
        "twitter_accounts": ["competitor1", "competitor2"],
        "max_tweets_per_fetch": 10,
        "fetch_frequency_hours": 12,
        "layer": "friends",
        "auto_create_updates": True
    },
    headers={"Authorization": "Bearer YOUR_TOKEN"}
)
```

### Example 3: Personal Interest Agent

Create an agent that follows your interests:

```python
# Configure for personal interests
requests.post(
    f"http://localhost:8000/agents/{agent_id}/twitter/config",
    json={
        "is_enabled": True,
        "search_topics": ["web3", "blockchain", "crypto"],
        "twitter_accounts": ["VitalikButerin", "APompliano"],
        "max_tweets_per_fetch": 15,
        "fetch_frequency_hours": 24,
        "layer": "public",
        "auto_create_updates": True
    },
    headers={"Authorization": "Bearer YOUR_TOKEN"}
)
```

## Advanced Search Queries

Twitter search supports advanced operators:

```json
{
  "search_topics": [
    "from:username",                    // Tweets from specific user
    "to:username",                      // Tweets mentioning user
    "#hashtag",                         // Hashtag search
    "keyword1 AND keyword2",            // Both keywords
    "keyword1 OR keyword2",             // Either keyword
    "\"exact phrase\"",                 // Exact phrase match
    "keyword -excluded",                // Exclude term
    "lang:en",                          // Language filter
    "min_faves:100",                    // Minimum likes
    "min_retweets:50"                   // Minimum retweets
  ]
}
```

## Automated Scheduling

For production, set up a cron job or scheduled task to sync all agents:

```python
# schedule_twitter_sync.py
from backend.db import SessionLocal
from backend.twitter_sync import sync_all_agents

db = SessionLocal()
try:
    results = sync_all_agents(db)
    print(f"Sync complete: {results}")
finally:
    db.close()
```

Run periodically (e.g., every hour):

```bash
# Crontab entry
0 * * * * cd /path/to/gabee-poc && python schedule_twitter_sync.py
```

## Tweet Format in Agent Updates

Tweets are converted to agent updates with this format:

**Title:** `Tweet from @username`

**Content:**
```
[Tweet text]

---
Author: Full Name (@username)
Posted: 2024-01-15 10:30 UTC
Engagement: 150 likes, 25 retweets
Source: https://twitter.com/username/status/123456789
```

## Best Practices

1. **Rate Limits**: Twitter API has rate limits. Set `fetch_frequency_hours` appropriately.
2. **Relevance**: Use specific search queries to avoid noise
3. **Max Results**: Start with lower `max_tweets_per_fetch` and adjust as needed
4. **Monitoring**: Check fetch logs regularly to ensure everything works
5. **Access Layers**: Use appropriate layers based on content sensitivity

## Troubleshooting

### "Twitter API not configured"

- Ensure `TWITTER_BEARER_TOKEN` is set in `.env`
- Restart the backend server after adding the token
- Verify token is valid at Twitter Developer Portal

### "Rate limit exceeded"

- Reduce `max_tweets_per_fetch`
- Increase `fetch_frequency_hours`
- Wait 15 minutes and try again

### "No tweets found"

- Check search queries are valid
- Verify Twitter accounts exist
- Try broader search terms
- Check fetch logs for detailed errors

### Updates not appearing in conversations

- Ensure `auto_create_updates` is `true`
- Check the agent's layer permissions
- Verify updates exist: `GET /agents/{agent_id}/updates`

## Architecture

```
┌─────────────────┐
│ Twitter API     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ twitter_service │  Fetches tweets
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ twitter_sync    │  Creates updates
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ AgentUpdate     │  Stored as updates
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Document/Chunks │  Embedded for RAG
└─────────────────┘
```

## Security Notes

- **API Keys**: Never commit `TWITTER_BEARER_TOKEN` to git
- **Access Control**: Tweets inherit agent's access layer settings
- **User Privacy**: Be mindful of monitoring personal accounts
- **Terms of Service**: Ensure compliance with Twitter's API terms

## Future Enhancements

Planned features:
- [ ] Support for Twitter API v2 advanced filtering
- [ ] Sentiment analysis of tweets
- [ ] Automatic summary of trending topics
- [ ] Integration with Twitter Spaces for audio content
- [ ] Real-time tweet streaming (webhooks)
- [ ] Tweet engagement tracking over time

## Support

For issues or questions:
1. Check fetch logs: `GET /agents/{agent_id}/twitter/logs`
2. Verify configuration: `GET /agents/{agent_id}/twitter/config`
3. Test Twitter status: `GET /twitter/status`
4. Review backend logs for detailed errors

## Example Integration Test

```bash
# Test the full flow
cd backend

# 1. Check Twitter is configured
curl http://localhost:8000/twitter/status

# 2. Create test configuration
curl -X POST http://localhost:8000/agents/YOUR_AGENT_ID/twitter/config \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "is_enabled": true,
    "search_topics": ["AI"],
    "twitter_accounts": ["OpenAI"],
    "max_tweets_per_fetch": 5,
    "fetch_frequency_hours": 24
  }'

# 3. Manually trigger fetch
curl -X POST "http://localhost:8000/agents/YOUR_AGENT_ID/twitter/fetch?force=true" \
  -H "Authorization: Bearer YOUR_TOKEN"

# 4. Check results
curl http://localhost:8000/agents/YOUR_AGENT_ID/twitter/logs \
  -H "Authorization: Bearer YOUR_TOKEN"

# 5. Verify updates were created
curl http://localhost:8000/agents/YOUR_AGENT_ID/updates \
  -H "Authorization: Bearer YOUR_TOKEN"
```




