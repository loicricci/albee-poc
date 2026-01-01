# 🚀 Daily AI Post Generator - Quick Start

Get started with automated AI post generation in 5 minutes!

## ⚡ Quick Setup

### 1. Install Dependencies

```bash
cd backend
pip install -r requirements.txt
```

### 2. Configure API Keys

Edit `backend/.env` and add:

```bash
# Required
OPENAI_API_KEY=sk-...                    # Your OpenAI API key
DATABASE_URL=postgresql://...            # Your database URL
SUPABASE_URL=https://...                 # Your Supabase project URL
SUPABASE_SERVICE_ROLE_KEY=...           # Your Supabase service role key

# Optional (will use fallback topics if not set)
NEWS_API_KEY=...                         # Get free at newsapi.org
```

### 3. Test Setup

```bash
# Run quick tests (no API calls)
python test_daily_post_generator.py --mode quick
```

If all tests pass ✅, you're ready!

## 🎯 Generate Your First Post

### Basic Command

```bash
python generate_daily_post.py --profile eltonjohn
```

This will:
1. Fetch a safe news topic
2. Generate an AI image
3. Write an engaging description
4. Post it to the profile

### Test with Manual Topic

Save API calls during testing:

```bash
python generate_daily_post.py --profile eltonjohn --topic "Space exploration"
```

## 📋 Common Commands

### Generate for Different Profiles

```bash
# For Elton John
python generate_daily_post.py --profile eltonjohn

# For Coluche
python generate_daily_post.py --profile coluche
```

### Specify News Category

```bash
python generate_daily_post.py --profile eltonjohn --category science
python generate_daily_post.py --profile eltonjohn --category technology
```

### Quiet Mode (for Automation)

```bash
python generate_daily_post.py --profile eltonjohn --quiet
```

## 🧪 Testing Commands

### Quick Test (No API Calls)

```bash
python test_daily_post_generator.py --mode quick --profile eltonjohn
```

Tests:
- ✅ Environment variables
- ✅ Database connection  
- ✅ News API connection
- ✅ Module initialization

### Component Tests

```bash
# Test specific components
python test_daily_post_generator.py --mode component --component env
python test_daily_post_generator.py --mode component --component news
python test_daily_post_generator.py --mode component --component profile
```

### Full End-to-End Test (Uses API Credits!)

```bash
python test_daily_post_generator.py --mode full --profile eltonjohn
```

⚠️ This generates a real post and uses OpenAI credits!

## 🔍 Verify Generated Posts

### View in Browser

After generating a post, visit:
```
http://localhost:3000/u/eltonjohn
```

### Check Database

```sql
SELECT 
  id, 
  title, 
  post_type,
  created_at,
  ai_metadata->>'topic' as topic
FROM posts 
WHERE post_type = 'ai_generated' 
ORDER BY created_at DESC 
LIMIT 5;
```

### Check Generated Images

```bash
ls -lh generated_images/
```

Images are saved with metadata files:
- `eltonjohn_post_20251229_143052.png` - The image
- `eltonjohn_post_20251229_143052_metadata.txt` - Prompt and details

## 📅 Schedule Daily Posts

### Option 1: Cron Job (Unix/Linux)

```bash
# Edit crontab
crontab -e

# Add this line to run daily at 9 AM
0 9 * * * cd /path/to/gabee-poc && /path/to/python generate_daily_post.py --profile eltonjohn --quiet
```

### Option 2: Manual for Now

Just run the command when you want a new post:
```bash
python generate_daily_post.py --profile eltonjohn
```

## 🐛 Troubleshooting

### "OpenAI API Key not set"
```bash
# Check your .env file
cat backend/.env | grep OPENAI_API_KEY
```

### "Agent not found"
```bash
# Test profile loader
python backend/profile_context_loader.py yourhandle
```

### "Database connection failed"
```bash
# Test database
python test_daily_post_generator.py --mode component --component env
```

### "Content policy violation"
- The AI rejected the image prompt
- Try running again (will get different topic)
- Or use manual topic: `--topic "Safe topic here"`

## 💡 Tips

### Save API Costs
- Use `--topic` for testing instead of fetching news
- Use `--quiet` mode to reduce output
- Test components individually first

### Best Practices
- Review first few posts manually
- Check generated images before posting
- Start with one profile, expand later
- Monitor API usage in OpenAI dashboard

### Customization
- Edit `ENABLED_PROFILES` in `generate_daily_post.py`
- Adjust image settings in `backend/image_generator.py`
- Modify prompt templates in `backend/ai_prompt_generator.py`

## 📚 Next Steps

1. **Review the full README**: `DAILY_POST_GENERATOR_README.md`
2. **Test each component**: Run component tests
3. **Generate test posts**: Use manual topics first
4. **Review output quality**: Check images and descriptions
5. **Set up scheduling**: Use cron or similar
6. **Monitor performance**: Track engagement metrics

## 🆘 Getting Help

### Check Component Status
```bash
python test_daily_post_generator.py --mode quick
```

### Test Individual Modules
```bash
python backend/news_topic_fetcher.py
python backend/profile_context_loader.py eltonjohn
python backend/ai_prompt_generator.py eltonjohn
```

### View Logs
The main script outputs detailed logs. Run without `--quiet` to see everything.

## ✅ Checklist

Before first production use:

- [ ] All environment variables configured
- [ ] Quick tests pass
- [ ] Generated 2-3 test posts
- [ ] Reviewed output quality
- [ ] Checked images look good
- [ ] Descriptions match agent voice
- [ ] Verified posts appear in feed
- [ ] Set up monitoring

---

**Ready to generate your first post?**

```bash
python generate_daily_post.py --profile eltonjohn --topic "Test post generation"
```

🎉 Happy posting!


