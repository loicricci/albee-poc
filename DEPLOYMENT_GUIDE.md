# 🚀 AVEE Deployment Guide

Complete step-by-step guide to deploy your AVEE landing page and app online.

---

## 📋 Overview

Your AVEE app consists of:
- **Frontend**: Next.js 16 (TypeScript + Tailwind CSS)
- **Backend**: FastAPI (Python)
- **Database**: Supabase (PostgreSQL + pgvector)
- **Authentication**: Supabase Auth

**Recommended Deployment Stack:**
- Frontend: **Vercel** (optimized for Next.js, free tier available)
- Backend: **Railway** or **Render** (managed Python hosting)
- Database: **Supabase** (already set up ✅)

---

## 🎯 Quick Deployment (30 minutes)

### Prerequisites
- [ ] GitHub account
- [ ] Vercel account (sign up at vercel.com)
- [ ] Railway account (sign up at railway.app) OR Render account (render.com)
- [ ] Your Supabase credentials ready

---

## 📦 Step 1: Prepare Your Repository

### 1.1 Create Git Repository (if not already done)

```bash
cd /Users/loicricci/gabee-poc

# Initialize git (if not already initialized)
git init

# Create .gitignore
echo "node_modules/
.next/
out/
__pycache__/
*.pyc
.env
.env.local
.env*.local
backend/.env
frontend/.env.local
venv/
.DS_Store" > .gitignore

# Commit your code
git add .
git commit -m "Initial commit - ready for deployment"

# Create GitHub repository and push
# (Go to github.com and create a new repository called 'gabee-poc')
git remote add origin https://github.com/YOUR_USERNAME/gabee-poc.git
git branch -M main
git push -u origin main
```

---

## 🎨 Step 2: Deploy Frontend to Vercel

### 2.1 Prepare Frontend for Production

Create production environment file template:

```bash
cd frontend
cat > .env.example << 'EOF'
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
NEXT_PUBLIC_API_BASE=https://your-backend.railway.app
EOF
```

### 2.2 Update Frontend Configuration

Make sure `frontend/next.config.ts` is production-ready:

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
      },
    ],
  },
};

export default nextConfig;
```

### 2.3 Deploy to Vercel

**Option A: Via Vercel Dashboard (Recommended)**

1. Go to [vercel.com](https://vercel.com) and sign in
2. Click **"Add New Project"**
3. Import your GitHub repository
4. Configure project:
   - **Framework Preset**: Next.js
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `.next`
   - **Install Command**: `npm install`

5. Add Environment Variables:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   NEXT_PUBLIC_API_BASE=https://your-backend-url.railway.app
   ```
   (Note: You'll update `NEXT_PUBLIC_API_BASE` after deploying the backend)

6. Click **"Deploy"**

**Option B: Via Vercel CLI**

```bash
cd frontend

# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Follow prompts:
# - Link to existing project or create new
# - Set root directory to 'frontend'
# - Set environment variables when prompted

# Deploy to production
vercel --prod
```

### 2.4 Note Your Frontend URL

After deployment, you'll get a URL like: `https://gabee-poc.vercel.app`

**Save this URL - you'll need it for the backend CORS configuration!**

---

## 🔧 Step 3: Deploy Backend to Railway

### 3.1 Prepare Backend for Production

Create necessary deployment files:

```bash
cd /Users/loicricci/gabee-poc/backend

# Create Procfile for Railway
echo "web: uvicorn backend.main:app --host 0.0.0.0 --port \$PORT" > Procfile

# Create runtime.txt (specify Python version)
echo "python-3.11" > runtime.txt

# Create .env.example (template for environment variables)
cat > .env.example << 'EOF'
DATABASE_URL=your_supabase_postgres_url
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key
OPENAI_API_KEY=sk-your_openai_key
EMBED_MODEL=text-embedding-3-small

# Optional: for enhanced web research
GOOGLE_SEARCH_API_KEY=
GOOGLE_SEARCH_ENGINE_ID=
SERPAPI_KEY=
EOF
```

### 3.2 Update CORS Configuration

Edit `backend/main.py` to allow your production frontend URL:

```python
# In backend/main.py, find the CORS configuration (around line 37-48) and update:

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://gabee-poc.vercel.app",  # ✅ Add your Vercel URL
        "https://gabee-poc-*.vercel.app",  # ✅ Allow preview deployments
        "https://*.vercel.app",  # Optional: allow all Vercel previews
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

Commit this change:

```bash
git add backend/main.py backend/Procfile backend/runtime.txt backend/.env.example
git commit -m "Add deployment configuration for production"
git push
```

### 3.3 Deploy to Railway

**Option A: Via Railway Dashboard (Recommended)**

1. Go to [railway.app](https://railway.app) and sign in
2. Click **"New Project"**
3. Select **"Deploy from GitHub repo"**
4. Choose your `gabee-poc` repository
5. Railway will auto-detect Python and try to deploy

6. Configure deployment:
   - Click on your service
   - Go to **Settings** → **Service Settings**
   - **Root Directory**: Leave empty (Railway will detect backend/)
   - **Start Command**: `uvicorn backend.main:app --host 0.0.0.0 --port $PORT`

7. Add Environment Variables:
   - Go to **Variables** tab
   - Click **"+ New Variable"** and add:

   ```
   DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.your-project.supabase.co:5432/postgres
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_ANON_KEY=your_supabase_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   OPENAI_API_KEY=sk-your_openai_api_key
   EMBED_MODEL=text-embedding-3-small
   PORT=8000
   ```

   **Getting Supabase DATABASE_URL:**
   - Go to your Supabase project
   - Settings → Database
   - Copy "Connection string" (choose "Session" mode)
   - Replace `[YOUR-PASSWORD]` with your database password

8. Deploy:
   - Railway will automatically deploy
   - Wait for deployment to complete (3-5 minutes)
   - Check logs for any errors

9. Enable Public URL:
   - Go to **Settings** → **Networking**
   - Click **"Generate Domain"**
   - You'll get a URL like: `https://gabee-backend.railway.app`

**Option B: Via Railway CLI**

```bash
# Install Railway CLI
npm i -g @railway/cli

# Login
railway login

# Initialize project
cd /Users/loicricci/gabee-poc
railway init

# Link to your Railway project
railway link

# Add environment variables (one at a time)
railway variables set DATABASE_URL="your_database_url"
railway variables set SUPABASE_URL="your_supabase_url"
railway variables set SUPABASE_ANON_KEY="your_anon_key"
railway variables set OPENAI_API_KEY="your_openai_key"

# Deploy
railway up
```

### 3.4 Alternative: Deploy to Render

If you prefer Render over Railway:

1. Go to [render.com](https://render.com) and sign in
2. Click **"New +"** → **"Web Service"**
3. Connect your GitHub repository
4. Configure:
   - **Name**: gabee-backend
   - **Root Directory**: `backend`
   - **Environment**: Python 3
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn backend.main:app --host 0.0.0.0 --port $PORT`

5. Add Environment Variables (same as Railway)
6. Click **"Create Web Service"**

---

## 🔄 Step 4: Connect Frontend to Backend

### 4.1 Update Frontend Environment Variables

Now that your backend is deployed, update your Vercel environment variables:

1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Update `NEXT_PUBLIC_API_BASE`:
   ```
   NEXT_PUBLIC_API_BASE=https://your-backend.railway.app
   ```
   (Use your Railway or Render URL)

4. Click **"Save"**

### 4.2 Redeploy Frontend

```bash
# Trigger a new deployment
cd frontend
vercel --prod

# Or push a commit to trigger auto-deployment
git commit --allow-empty -m "Update backend URL"
git push
```

---

## ✅ Step 5: Verify Deployment

### 5.1 Test Your Live App

1. **Visit your frontend URL**: `https://gabee-poc.vercel.app`
2. **Test authentication**:
   - Try to sign up / log in
   - Check Supabase dashboard for new users

3. **Test API endpoints**:
   - Visit: `https://your-backend.railway.app/health`
   - Should return: `{"ok": true}`
   - Visit: `https://your-backend.railway.app/docs`
   - Should show FastAPI documentation

4. **Test full flow**:
   - Create a profile
   - Create an agent
   - Chat with the agent
   - Check that RAG is working

### 5.2 Check Logs

**Frontend logs (Vercel):**
```bash
vercel logs
```

**Backend logs (Railway):**
- Go to Railway dashboard → Your service → **Logs** tab
- Or use CLI: `railway logs`

---

## 🔒 Step 6: Security & Production Checklist

### 6.1 Environment Variables Security

- [ ] All API keys are in environment variables (not in code)
- [ ] `.env` files are in `.gitignore`
- [ ] Different keys for production vs development
- [ ] Service role keys are never exposed to frontend

### 6.2 CORS Configuration

- [ ] Only your production domain is allowed
- [ ] `allow_credentials=True` only for trusted origins
- [ ] Remove `localhost` origins from production build (optional)

### 6.3 Database Security

- [ ] Row Level Security (RLS) enabled on Supabase tables
- [ ] Database password is strong
- [ ] Connection pooling configured (Supabase handles this)

### 6.4 API Security

- [ ] Rate limiting enabled (optional, via Railway/Render)
- [ ] Authentication on all protected endpoints
- [ ] Input validation on all endpoints
- [ ] HTTPS enforced (automatic on Vercel/Railway)

---

## 📊 Step 7: Monitoring & Analytics (Optional)

### 7.1 Set Up Error Tracking

**Sentry for Error Monitoring:**

```bash
# Install Sentry
cd frontend
npm install @sentry/nextjs

cd ../backend
pip install sentry-sdk[fastapi]
```

Add to `frontend/sentry.config.js` and `backend/main.py`

### 7.2 Set Up Analytics

**Vercel Analytics (Free for Vercel projects):**

```bash
cd frontend
npm install @vercel/analytics
```

```tsx
// frontend/src/app/layout.tsx
import { Analytics } from '@vercel/analytics/react';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
```

---

## 🔧 Troubleshooting

### Frontend doesn't load

1. Check Vercel deployment logs
2. Verify environment variables are set
3. Check browser console for errors
4. Verify `NEXT_PUBLIC_API_BASE` is correct

### Backend returns 502/503 errors

1. Check Railway/Render logs
2. Verify database connection string
3. Check that all required environment variables are set
4. Ensure port is set correctly (`$PORT` on Railway)

### CORS errors

1. Verify frontend URL is in `allow_origins` list
2. Make sure you deployed the updated `main.py` with CORS changes
3. Check that `allow_credentials=True` is set

### Database connection fails

1. Verify `DATABASE_URL` format:
   ```
   postgresql://postgres:[PASSWORD]@db.xxx.supabase.co:5432/postgres
   ```
2. Make sure password is correct
3. Check Supabase project is active
4. Try using the "Session" connection pooler (port 5432)

### OpenAI API errors

1. Verify `OPENAI_API_KEY` is set correctly
2. Check API key has sufficient credits
3. Verify key has access to required models (gpt-4o-mini, text-embedding-3-small)

---

## 💰 Cost Estimation

### Free Tier (Good for testing)
- **Vercel**: Free (100GB bandwidth/month, 6,000 build minutes)
- **Railway**: $5/month credit (then $0.000231/GB-hour)
- **Supabase**: Free tier (500MB database, 50,000 monthly active users)
- **OpenAI**: Pay-as-you-go (~$0.01-0.10 per 1K tokens)

**Total**: ~$5-10/month for low traffic

### Production Tier (1000+ users)
- **Vercel Pro**: $20/month (1TB bandwidth, unlimited builds)
- **Railway**: ~$20-50/month (depends on usage)
- **Supabase Pro**: $25/month (8GB database, 100,000 MAU)
- **OpenAI**: ~$50-200/month (depends on usage)

**Total**: ~$115-295/month

---

## 🚀 Post-Deployment Tasks

### Immediate (Week 1)
- [ ] Test all features in production
- [ ] Set up monitoring alerts
- [ ] Configure custom domain (optional)
- [ ] Add SSL certificate (automatic on Vercel)
- [ ] Test mobile responsiveness

### Short-term (Month 1)
- [ ] Set up automated backups (Supabase automatic)
- [ ] Configure CDN for static assets (Vercel automatic)
- [ ] Add rate limiting to API
- [ ] Set up staging environment
- [ ] Create runbook for common issues

### Long-term
- [ ] Scale infrastructure as needed
- [ ] Optimize database queries
- [ ] Add caching layer (Redis)
- [ ] Implement CI/CD pipeline
- [ ] Add A/B testing

---

## 🔗 Custom Domain (Optional)

### Add Custom Domain to Vercel

1. Go to Vercel project → **Settings** → **Domains**
2. Add your domain (e.g., `avee.app`)
3. Follow DNS configuration instructions
4. Wait for DNS propagation (5 minutes - 48 hours)
5. Vercel automatically provisions SSL certificate

### Update Backend CORS

Add your custom domain to `allow_origins`:

```python
allow_origins=[
    "https://avee.app",
    "https://www.avee.app",
    # ... other origins
],
```

---

## 📞 Quick Reference

### Important URLs
- **Frontend**: `https://gabee-poc.vercel.app`
- **Backend**: `https://your-backend.railway.app`
- **API Docs**: `https://your-backend.railway.app/docs`
- **Health Check**: `https://your-backend.railway.app/health`

### Environment Variables Checklist

**Frontend (.env.local):**
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_API_BASE=
```

**Backend (.env):**
```
DATABASE_URL=
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
OPENAI_API_KEY=
EMBED_MODEL=
PORT=
```

---

## 🎉 Success!

Your AVEE app is now live! 🚀

Share your deployment:
- Frontend URL: [Your Vercel URL]
- Test the app and share with users
- Monitor logs and performance
- Iterate based on user feedback

Good luck with your production deployment! 🎊

---

**Need help?** Check the logs or refer to:
- Vercel docs: https://vercel.com/docs
- Railway docs: https://docs.railway.app
- Supabase docs: https://supabase.com/docs
- FastAPI docs: https://fastapi.tiangolo.com

