# Twitter Free Tier - Minimal Usage Guide

## 🆓 Free Tier Limits

Twitter API Free Tier provides:
- **500,000 tweets per month** (read cap)
- **Rate limits**: Search endpoint limited per 15-minute window
- **Minimum 10 tweets per request** (API requirement)

## ⚙️ Recommended Configuration

For **minimal usage** and to avoid rate limits:

```json
{
  "is_enabled": true,
  "search_topics": ["AI"],  // ONE topic only
  "twitter_accounts": ["OpenAI"],  // ONE account only
  "max_tweets_per_fetch": 10,  // MINIMUM allowed
  "fetch_frequency_hours": 24,  // Once per day
  "layer": "public",
  "auto_create_updates": true
}
```

## 📊 Usage Calculation

### Single Agent, Daily Fetches:
- 1 topic × 10 tweets = **10 tweets**
- 1 account × 10 tweets = **10 tweets**
- **Total: 20 tweets per day**
- **Monthly: ~600 tweets** ✅ Well under limit

### Conservative Approach:
```json
{
  "search_topics": ["specific keyword"],  // Very specific
  "twitter_accounts": [],  // Skip accounts OR
  "twitter_accounts": ["one_account"],  // Just one
  "max_tweets_per_fetch": 10,
  "fetch_frequency_hours": 48  // Every 2 days
}
```

**Monthly: ~300 tweets** ✅ Very safe

## ⚠️ What to Avoid

### ❌ Too Many Sources
```json
{
  "search_topics": ["AI", "ML", "GPT", "Claude", "LLM"],  // 5 topics!
  "twitter_accounts": ["OpenAI", "AnthropicAI", "MetaAI", "GoogleAI"],  // 4 accounts!
  "max_tweets_per_fetch": 10
}
```
**Result**: 9 sources × 10 tweets = **90 tweets per fetch** ❌

### ❌ Too Frequent
```json
{
  "fetch_frequency_hours": 1  // Every hour!
}
```
**Result**: 24 fetches/day = **480+ tweets/day** = 14k+/month ❌

### ❌ Over-fetching
```json
{
  "max_tweets_per_fetch": 100  // Maximum!
}
```
**Result**: Wastes quota, hits rate limits faster ❌

## ✅ Best Practices

### 1. Start Minimal
```bash
curl -X POST http://localhost:8000/agents/YOUR_AGENT_ID/twitter/config \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "is_enabled": true,
    "search_topics": ["one specific topic"],
    "twitter_accounts": [],
    "max_tweets_per_fetch": 10,
    "fetch_frequency_hours": 24,
    "layer": "public",
    "auto_create_updates": true
  }'
```

### 2. Monitor Usage
```bash
# Check fetch logs
curl http://localhost:8000/agents/YOUR_AGENT_ID/twitter/logs \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 3. Adjust Based on Need
- Getting useful tweets? ✅ Keep it
- Lots of noise? ⚠️ Make search more specific
- Not enough content? 📈 Add ONE more source at a time

## 🎯 Smart Configurations

### News Agent (Minimal)
```json
{
  "search_topics": ["AI breakthrough"],  // Specific phrase
  "twitter_accounts": ["OpenAI"],  // Main source only
  "max_tweets_per_fetch": 10,
  "fetch_frequency_hours": 24
}
```
**Usage**: ~20 tweets/day = ~600/month ✅

### Industry Monitor (Ultra Conservative)
```json
{
  "search_topics": ["YourCompany exact_topic"],
  "twitter_accounts": [],  // No accounts
  "max_tweets_per_fetch": 10,
  "fetch_frequency_hours": 48  // Every 2 days
}
```
**Usage**: ~5 tweets/day = ~150/month ✅

### Personal Curator (Balanced)
```json
{
  "search_topics": [],  // No search
  "twitter_accounts": ["favorite_account"],  // One trusted source
  "max_tweets_per_fetch": 10,
  "fetch_frequency_hours": 24
}
```
**Usage**: ~10 tweets/day = ~300/month ✅

## 📈 Rate Limit Recovery

If you hit rate limits:
1. ⏸️ **Stop fetching** - Wait 15 minutes
2. 🔧 **Reduce frequency** - Increase to 48+ hours
3. 🎯 **Narrow scope** - Use more specific search terms
4. 📊 **Check logs** - See what's using quota

## 🛠️ Testing Without Wasting Quota

Before enabling auto-fetch:

```bash
# 1. Test your search query manually
curl -X POST "http://localhost:8000/agents/YOUR_AGENT_ID/twitter/fetch?force=true" \
  -H "Authorization: Bearer YOUR_TOKEN"

# 2. Check how many tweets were found
# 3. Review the content quality
# 4. Adjust search_topics if needed
# 5. THEN enable auto-fetch
```

## 🚨 Emergency: Disable Auto-Fetch

If you're burning through quota:

```bash
# Quick disable
curl -X POST http://localhost:8000/agents/YOUR_AGENT_ID/twitter/config \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "is_enabled": false,
    "search_topics": [],
    "twitter_accounts": [],
    "max_tweets_per_fetch": 10,
    "fetch_frequency_hours": 24,
    "layer": "public",
    "auto_create_updates": true
  }'
```

Or delete the config entirely:
```bash
curl -X DELETE http://localhost:8000/agents/YOUR_AGENT_ID/twitter/config \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## 📋 Monthly Checklist

- [ ] Review fetch logs weekly
- [ ] Check total tweets fetched
- [ ] Verify content quality is good
- [ ] Adjust frequency if needed
- [ ] Keep 1-2 sources max per agent

## 💡 Pro Tips

1. **Use specific search terms** - "GPT-4 release" instead of "AI"
2. **Prefer accounts over search** - Less noisy, more consistent
3. **Longer intervals** - 24-48 hours is plenty for most use cases
4. **Quality over quantity** - 10 good tweets > 100 mediocre ones
5. **Monitor first week** - See actual usage before committing

## 🎓 Example: Good Free Tier Setup

```json
{
  "is_enabled": true,
  "search_topics": ["from:OpenAI GPT"],  // Specific query
  "twitter_accounts": [],  // Already covered in search
  "max_tweets_per_fetch": 10,
  "fetch_frequency_hours": 24,
  "layer": "public",
  "auto_create_updates": true
}
```

**Why this works:**
- ✅ Only 1 API call per day
- ✅ 10 tweets per call = 10/day
- ✅ ~300 tweets/month
- ✅ Highly relevant content
- ✅ 99.94% of quota remaining!

## Summary

**Golden Rule**: Start with 10 tweets/24 hours from 1 source.

You can always scale up later, but starting conservatively ensures you:
- Never hit rate limits
- Stay well under monthly cap
- Get high-quality, relevant content
- Have quota available for testing

**Your system is now optimized for minimal usage!** 🎉





