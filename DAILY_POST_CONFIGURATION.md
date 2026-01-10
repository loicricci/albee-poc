# Configuration Guide for Daily Post Generator

This guide explains all configuration needed to run the Daily AI Post Generator.

## Required Environment Variables

Add these to `backend/.env`:

### 1. OpenAI API Key (REQUIRED)

```bash
OPENAI_API_KEY=sk-proj-your-key-here
```

- **What it's for**: GPT-4o (text generation) and DALL-E 3 (image generation)
- **Where to get it**: https://platform.openai.com/api-keys
- **Cost per post**: ~$0.11 (includes GPT-4o + DALL-E 3)
- **Note**: Must have billing enabled and credits available

### 2. Database URL (REQUIRED - Already configured)

```bash
DATABASE_URL=postgresql://user:password@host:port/database
```

- **What it's for**: Loading agent profiles and storing posts
- **Note**: Should already be configured in your existing setup

### 3. Supabase Configuration (REQUIRED - Already configured)

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

- **What it's for**: Uploading images to storage bucket
- **Note**: Should already be configured in your existing setup
- **Important**: Use SERVICE ROLE key, not public anon key

## Optional Environment Variables

### 4. News API Key (OPTIONAL - Recommended)

```bash
NEWS_API_KEY=your-newsapi-key-here
```

- **What it's for**: Fetching real trending news topics
- **Where to get it**: https://newsapi.org/register (FREE)
- **Free tier**: 100 requests/day (more than enough)
- **Without it**: System uses fallback topics (still works fine)
- **Recommendation**: Get free key for better variety

## Verification

### Check Your Configuration

```bash
# Test that all required variables are set
python test_daily_post_generator.py --mode component --component env
```

Expected output:
```
✅ OPENAI_API_KEY: Set
✅ DATABASE_URL: Set
✅ SUPABASE_URL: Set
✅ SUPABASE_SERVICE_ROLE_KEY: Set
⚠️  NEWS_API_KEY: Not set (will use fallback)
```

### Quick Test (No API Calls)

```bash
python test_daily_post_generator.py --mode quick
```

This tests:
- ✅ Environment variables
- ✅ Database connection
- ✅ Module imports
- ✅ Basic functionality

## Profile Configuration

### Enable Profiles for Auto-Posting

Edit `generate_daily_post.py` (line 27):

```python
# Configuration: Profiles enabled for auto-posting
ENABLED_PROFILES = ["eltonjohn", "coluche"]
```

Add or remove handles as needed.

### Check if Profile Exists

```bash
# Test loading a profile
python backend/profile_context_loader.py yourhandle
```

## Image Generation Settings

### Default Settings (in `backend/image_generator.py`)

```python
size="1792x1024"    # Wide format for social media
quality="hd"        # High definition
style="vivid"       # Vivid colors (or "natural")
```

### Available Sizes

- `1024x1024` - Square
- `1792x1024` - Wide (recommended for posts)
- `1024x1792` - Tall

### Cost Differences

- **Standard quality**: $0.040 per image
- **HD quality**: $0.080 per image (recommended)

## Cost Breakdown

### Per Post Generation

| Service | Cost | Details |
|---------|------|---------|
| News API | Free | 100/day free tier |
| GPT-4o-mini | $0.001 | Topic filtering |
| GPT-4o | $0.030 | Prompt generation |
| DALL-E 3 HD | $0.080 | Image generation |
| **Total** | **~$0.11** | Per post |

### Monthly Estimates

- **1 post/day**: ~$3.30/month
- **2 posts/day**: ~$6.60/month
- **30 posts/month**: ~$3.30/month

## Troubleshooting

### "OPENAI_API_KEY not set"

```bash
# Check if variable is set
echo $OPENAI_API_KEY

# If empty, add to backend/.env:
OPENAI_API_KEY=sk-your-key-here
```

### "Invalid API key"

- Verify key is correct in OpenAI dashboard
- Check you have billing enabled
- Ensure you have credits available

### "NEWS_API_KEY not set"

This is just a warning. System will work with fallback topics.

To get free key:
1. Visit https://newsapi.org/register
2. Sign up (free)
3. Copy API key
4. Add to `backend/.env`: `NEWS_API_KEY=your-key`

### "Database connection failed"

```bash
# Test database connection
python backend/profile_context_loader.py eltonjohn
```

If this fails, check your `DATABASE_URL` is correct.

### "Supabase upload failed"

- Verify `SUPABASE_URL` is correct
- Check you're using SERVICE ROLE key (not anon key)
- Ensure `app-images` bucket exists
- Check RLS policies allow service role uploads

## Security Best Practices

### 1. Never Commit Secrets

```bash
# .env should be in .gitignore (already configured)
# Never commit API keys to git
```

### 2. Use Service Role Key

```bash
# Use this for automated operations
SUPABASE_SERVICE_ROLE_KEY=eyJhbG...

# NOT this (anon key is for client-side)
SUPABASE_ANON_KEY=eyJhbG...
```

### 3. Rotate Keys Regularly

- Change API keys every 3-6 months
- Revoke old keys in dashboards
- Update .env file with new keys

### 4. Restrict Access

- Only store .env on secure servers
- Don't share keys via email/chat
- Use environment variables in production

## Example .env File

```bash
# Required
OPENAI_API_KEY=sk-proj-abc123...
DATABASE_URL=postgresql://user:pass@host:5432/db
SUPABASE_URL=https://xyz.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbG...

# Optional (recommended)
NEWS_API_KEY=abc123def456...
```

## Testing After Configuration

### 1. Quick Validation

```bash
python test_daily_post_generator.py --mode quick
```

### 2. Component Tests

```bash
# Test each part individually
python test_daily_post_generator.py --mode component --component env
python test_daily_post_generator.py --mode component --component news
python test_daily_post_generator.py --mode component --component profile
```

### 3. First Test Post

```bash
# Use manual topic to save API calls
python generate_daily_post.py --profile eltonjohn --topic "Test post generation"
```

## Need Help?

1. Check quick start guide: `DAILY_POST_QUICK_START.md`
2. Review full documentation: `DAILY_POST_GENERATOR_README.md`
3. Run tests to identify issues: `python test_daily_post_generator.py`
4. Check logs for detailed error messages

---

**Ready?** Run the quick test:

```bash
python test_daily_post_generator.py --mode quick
```

If all checks pass ✅, you're configured correctly!








