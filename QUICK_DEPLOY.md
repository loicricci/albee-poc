# ⚡ Quick Deploy - AVEE to Production

**Fastest way to get AVEE online in 30 minutes**

---

## 🎯 What You'll Get

- ✅ Frontend live on Vercel (Next.js)
- ✅ Backend live on Railway (FastAPI)
- ✅ Database on Supabase (already set up)
- ✅ HTTPS and SSL certificates (automatic)
- ✅ Auto-deployment from Git

---

## 📋 What You Need

1. **GitHub account** → Sign up at github.com
2. **Vercel account** → Sign up at vercel.com (use GitHub)
3. **Railway account** → Sign up at railway.app (use GitHub)
4. **Supabase credentials** → Get from your existing Supabase project

---

## 🚀 3-Step Deployment

### Step 1: Push to GitHub (5 minutes)

```bash
cd /Users/loicricci/gabee-poc

# Initialize Git (if not done)
git init
git add .
git commit -m "Ready for deployment"

# Create GitHub repo and push
# 1. Go to github.com → New repository → "gabee-poc"
# 2. Copy the commands GitHub shows, something like:
git remote add origin https://github.com/YOUR_USERNAME/gabee-poc.git
git branch -M main
git push -u origin main
```

---

### Step 2: Deploy Backend to Railway (10 minutes)

1. **Go to [railway.app](https://railway.app)** → Login with GitHub

2. **Click "New Project"** → "Deploy from GitHub repo"

3. **Select** `gabee-poc` repository

4. **Configure service:**
   - Name: `gabee-backend`
   - Railway will auto-detect Python

5. **Add Environment Variables** (click "Variables" tab):
   
   Copy these and fill in your values:
   ```
   DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT].supabase.co:5432/postgres
   SUPABASE_URL=https://[PROJECT].supabase.co
   SUPABASE_ANON_KEY=eyJ...
   SUPABASE_SERVICE_ROLE_KEY=eyJ...
   OPENAI_API_KEY=sk-...
   EMBED_MODEL=text-embedding-3-small
   PORT=8000
   ```

   **Where to get these:**
   - Go to your Supabase dashboard → Settings
   - **API**: Get URL and keys
   - **Database**: Get connection string (use "Session" mode)
   - **OpenAI**: Get from platform.openai.com

6. **Generate Domain:**
   - Settings → Networking → "Generate Domain"
   - Copy the URL: `https://gabee-backend.up.railway.app`

7. **Verify it works:**
   - Visit: `https://your-backend.railway.app/health`
   - Should show: `{"ok": true}`

---

### Step 3: Deploy Frontend to Vercel (10 minutes)

1. **Go to [vercel.com](https://vercel.com)** → Login with GitHub

2. **Click "Add New..."** → "Project"

3. **Import** `gabee-poc` repository

4. **Configure Project:**
   - Framework Preset: **Next.js**
   - Root Directory: `frontend`
   - Build Command: `npm run build` (auto-detected)
   - Output Directory: `.next` (auto-detected)

5. **Add Environment Variables:**
   
   Click "Environment Variables" and add:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://[PROJECT].supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
   NEXT_PUBLIC_API_BASE=https://your-backend.railway.app
   ```
   
   Use the Railway URL from Step 2!

6. **Click "Deploy"**
   - Wait 2-3 minutes
   - Copy your Vercel URL: `https://gabee-poc.vercel.app`

---

### Step 4: Update CORS (5 minutes)

Now connect frontend to backend:

1. **Edit `backend/main.py`:**
   
   Find this section (around line 37):
   ```python
   allow_origins=[
       "http://localhost:3000",
       "http://127.0.0.1:3000",
       # Production origins will be added here
   ```

2. **Add your Vercel URL:**
   ```python
   allow_origins=[
       "http://localhost:3000",
       "http://127.0.0.1:3000",
       "https://gabee-poc.vercel.app",  # ✅ Add this
       "https://gabee-poc-*.vercel.app",  # ✅ For preview deployments
   ```

3. **Commit and push:**
   ```bash
   git add backend/main.py
   git commit -m "Add production CORS origins"
   git push
   ```

4. **Railway auto-deploys** in 2-3 minutes

---

## ✅ Test Your Deployment

### 1. Test Backend
Visit: `https://your-backend.railway.app/docs`
- Should see FastAPI documentation

### 2. Test Frontend
Visit: `https://gabee-poc.vercel.app`
- Landing page should load
- No console errors (press F12)

### 3. Test Full Flow
1. Sign up / Log in
2. Create a profile
3. Create an agent
4. Chat with the agent
5. ✅ Success! You're live!

---

## 🔧 If Something Goes Wrong

### Frontend shows errors
```bash
# Check Vercel logs
vercel logs

# Or go to Vercel dashboard → Your project → Deployments → Click latest → Logs
```

### Backend shows errors
- Go to Railway dashboard
- Click your service
- Click "Logs" tab
- Look for error messages

### Common fixes:
1. **CORS error**: Make sure you updated `main.py` and pushed
2. **401 errors**: Check Supabase keys are correct
3. **Database error**: Check `DATABASE_URL` format and password
4. **OpenAI error**: Check API key and credits

---

## 💡 Pro Tips

### Enable Auto-Deploy
- **Vercel**: Automatic on every push to `main`
- **Railway**: Automatic on every push to `main`
- Just `git push` and both redeploy!

### Custom Domain (Optional)
1. Buy a domain (Namecheap, GoDaddy, etc.)
2. Vercel → Settings → Domains → Add domain
3. Follow DNS instructions
4. Update CORS with new domain

### Monitor Your App
- **Vercel**: Built-in analytics (free)
- **Railway**: Resource usage dashboard
- **Supabase**: Database stats in dashboard

### Keep Costs Low
- Vercel: Free for personal projects
- Railway: $5/month credit (usually enough to start)
- Supabase: Free tier (plenty for testing)
- OpenAI: ~$0.01-0.10 per 1K tokens

---

## 📊 Quick Reference

**Save these URLs:**

```
Frontend: https://gabee-poc.vercel.app
Backend:  https://gabee-backend.railway.app
API Docs: https://gabee-backend.railway.app/docs
Health:   https://gabee-backend.railway.app/health

Vercel Dashboard:   https://vercel.com/dashboard
Railway Dashboard:  https://railway.app/dashboard
Supabase Dashboard: https://supabase.com/dashboard
```

---

## 🎉 You're Live!

**Congratulations!** Your AVEE app is now deployed and accessible worldwide! 🚀

**What's next?**
1. Share the URL with friends
2. Test all features
3. Monitor logs for issues
4. Iterate and improve
5. Scale as you grow

**Need detailed instructions?**
- See: `DEPLOYMENT_GUIDE.md` (comprehensive guide)
- See: `DEPLOYMENT_CHECKLIST.md` (step-by-step checklist)

---

**Questions?** Check the troubleshooting section in `DEPLOYMENT_GUIDE.md` or the deployment logs.

Good luck! 🎊







