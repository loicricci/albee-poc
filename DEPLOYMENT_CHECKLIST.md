# 🚀 AVEE Deployment Checklist

Quick reference checklist for deploying AVEE to production.

---

## ✅ Pre-Deployment Checklist

### 1. Code Preparation
- [ ] All code is committed to Git
- [ ] `.env` files are in `.gitignore` (don't commit secrets!)
- [ ] `backend/Procfile` exists
- [ ] `backend/runtime.txt` exists
- [ ] `.env.example` files are created (as templates)
- [ ] Tests are passing locally (if applicable)

### 2. Configuration Files
- [ ] `frontend/next.config.ts` is production-ready (output: standalone)
- [ ] `backend/main.py` CORS configuration allows production URLs
- [ ] All hardcoded localhost URLs are replaced with environment variables

### 3. Environment Variables Ready
- [ ] Supabase URL
- [ ] Supabase Anon Key
- [ ] Supabase Service Role Key
- [ ] Database URL (PostgreSQL connection string)
- [ ] OpenAI API Key

---

## 📦 Deployment Steps

### Phase 1: Backend Deployment (Railway)

**Estimated time: 15 minutes**

- [ ] Create Railway account
- [ ] Create new project from GitHub
- [ ] Add environment variables:
  ```
  DATABASE_URL=postgresql://...
  SUPABASE_URL=https://...
  SUPABASE_ANON_KEY=...
  SUPABASE_SERVICE_ROLE_KEY=...
  OPENAI_API_KEY=sk-...
  EMBED_MODEL=text-embedding-3-small
  ```
- [ ] Generate public domain
- [ ] Test health endpoint: `https://your-backend.railway.app/health`
- [ ] Test API docs: `https://your-backend.railway.app/docs`
- [ ] Save backend URL: ___________________________

### Phase 2: Frontend Deployment (Vercel)

**Estimated time: 10 minutes**

- [ ] Create Vercel account
- [ ] Import GitHub repository
- [ ] Set root directory to `frontend`
- [ ] Add environment variables:
  ```
  NEXT_PUBLIC_SUPABASE_URL=https://...
  NEXT_PUBLIC_SUPABASE_ANON_KEY=...
  NEXT_PUBLIC_API_BASE=https://your-backend.railway.app
  ```
- [ ] Deploy to production
- [ ] Save frontend URL: ___________________________

### Phase 3: Update CORS Configuration

**Estimated time: 5 minutes**

- [ ] Copy your Vercel URL
- [ ] Edit `backend/main.py` - add Vercel URL to `allow_origins`
- [ ] Commit and push changes
- [ ] Railway will auto-redeploy (or manually redeploy)
- [ ] Wait for deployment to complete

---

## ✅ Post-Deployment Verification

### Test Backend
- [ ] Visit: `https://your-backend.railway.app/health`
  - Expected: `{"ok": true}`
- [ ] Visit: `https://your-backend.railway.app/docs`
  - Expected: FastAPI documentation page
- [ ] Check Railway logs for errors

### Test Frontend
- [ ] Visit: `https://your-app.vercel.app`
  - Expected: Landing page loads
- [ ] Check browser console for errors (F12)
- [ ] Verify no CORS errors

### Test Full Application Flow

#### 1. Authentication
- [ ] Go to signup page
- [ ] Create a new account
- [ ] Verify email (if required)
- [ ] Log in successfully
- [ ] Check Supabase dashboard - new user appears

#### 2. Profile Creation
- [ ] Create user profile
- [ ] Add handle, display name, bio
- [ ] Upload avatar (if feature exists)
- [ ] Profile saves successfully

#### 3. Agent Creation
- [ ] Create a new agent
- [ ] Add agent handle and details
- [ ] Try with auto-research enabled
- [ ] Agent appears in "My Agents" list

#### 4. Document Training
- [ ] Add a document to your agent
- [ ] Document uploads successfully
- [ ] Check database - chunks are created

#### 5. Chat Functionality
- [ ] Start a conversation with your agent
- [ ] Send a message
- [ ] Receive AI response
- [ ] Verify response uses RAG context
- [ ] Test streaming (if enabled)

#### 6. Social Features (if applicable)
- [ ] Search for other agents
- [ ] Follow an agent
- [ ] View feed updates
- [ ] Check notifications

---

## 🔍 Troubleshooting Guide

### Problem: "Failed to fetch" or CORS errors

**Solution:**
1. Check backend is running: visit health endpoint
2. Verify frontend `NEXT_PUBLIC_API_BASE` is correct
3. Check backend CORS includes your Vercel URL
4. Redeploy backend after CORS update

### Problem: "401 Unauthorized" errors

**Solution:**
1. Check Supabase URL and keys are correct
2. Verify user is logged in (check local storage)
3. Check Supabase dashboard - is the user created?
4. Verify JWT token is being sent with requests

### Problem: Backend crashes on startup

**Solution:**
1. Check Railway logs
2. Verify `DATABASE_URL` format is correct
3. Check all required environment variables are set
4. Verify PostgreSQL database is accessible
5. Check Python version matches `runtime.txt`

### Problem: Database connection fails

**Solution:**
1. Check `DATABASE_URL` format:
   ```
   postgresql://postgres:[PASSWORD]@db.xxx.supabase.co:5432/postgres
   ```
2. Verify password is URL-encoded (no special chars unescaped)
3. Try using Session pooler (port 5432) vs Transaction pooler (port 6543)
4. Check Supabase project is not paused

### Problem: OpenAI errors

**Solution:**
1. Verify `OPENAI_API_KEY` is set correctly (starts with `sk-`)
2. Check API key has credits
3. Verify models are accessible: `gpt-4o-mini`, `text-embedding-3-small`
4. Check rate limits are not exceeded

### Problem: Images not loading

**Solution:**
1. Check `next.config.ts` has correct image domains
2. Verify Supabase storage is configured correctly
3. Check image URLs are HTTPS
4. Verify Supabase storage RLS policies allow access

---

## 🔒 Security Checklist

- [ ] All API keys are in environment variables (not in code)
- [ ] `.env` files are NOT committed to Git
- [ ] CORS only allows your production domains
- [ ] Supabase Row Level Security (RLS) is enabled
- [ ] Service role keys are only in backend (never in frontend)
- [ ] HTTPS is enforced (automatic on Vercel/Railway)
- [ ] Database passwords are strong
- [ ] API endpoints require authentication where appropriate

---

## 📊 Monitoring Setup (Optional but Recommended)

### Immediate
- [ ] Set up error alerts in Railway
- [ ] Enable Vercel Analytics
- [ ] Monitor Railway resource usage

### Short-term
- [ ] Set up Sentry for error tracking
- [ ] Configure log aggregation
- [ ] Set up uptime monitoring (UptimeRobot, Better Stack)
- [ ] Create status page (optional)

---

## 💰 Cost Tracking

### Monthly Costs (Estimate)
- Vercel: $_______ (Free tier or Pro $20)
- Railway: $_______ (Starts at $5)
- Supabase: $_______ (Free tier or Pro $25)
- OpenAI: $_______ (Pay-as-you-go)
- **Total**: $_______ /month

### Set Budgets
- [ ] Set OpenAI usage alerts
- [ ] Monitor Railway usage
- [ ] Track Vercel bandwidth
- [ ] Set spending limits where possible

---

## 📝 Post-Launch Tasks

### Week 1
- [ ] Test all features thoroughly in production
- [ ] Fix any bugs discovered
- [ ] Monitor error rates
- [ ] Check performance metrics
- [ ] Share with first test users

### Week 2-4
- [ ] Gather user feedback
- [ ] Monitor costs and optimize
- [ ] Set up automated backups (Supabase does this)
- [ ] Create runbook for common issues
- [ ] Optimize slow queries

### Ongoing
- [ ] Regular security updates
- [ ] Monitor uptime
- [ ] Scale resources as needed
- [ ] Regular database maintenance
- [ ] Feature improvements based on feedback

---

## 🎯 Success Metrics

- [ ] Frontend loads in < 3 seconds
- [ ] Backend API response time < 500ms
- [ ] Zero CORS errors
- [ ] Authentication works reliably
- [ ] RAG responses are accurate
- [ ] No database connection issues
- [ ] Error rate < 1%
- [ ] Users can complete full workflow

---

## 📞 Important Links

Save these for quick reference:

**Frontend:**
- Production URL: _________________________________
- Vercel Dashboard: https://vercel.com/dashboard

**Backend:**
- Production URL: _________________________________
- API Docs: ________________________________/docs
- Railway Dashboard: https://railway.app/dashboard

**Database:**
- Supabase Dashboard: https://supabase.com/dashboard/project/___________
- Database URL: (saved in environment variables)

**Monitoring:**
- Error tracking: _________________________________
- Analytics: _________________________________
- Uptime monitor: _________________________________

---

## ✅ Deployment Complete!

Congratulations! Your AVEE app is now live in production! 🎉

**Next steps:**
1. Share the URL with test users
2. Monitor logs and metrics
3. Iterate based on feedback
4. Plan next features

**Remember:**
- Keep your `.env` files secure
- Monitor your costs
- Backup your data regularly (Supabase automatic)
- Update dependencies regularly
- Test before deploying changes

Good luck! 🚀












