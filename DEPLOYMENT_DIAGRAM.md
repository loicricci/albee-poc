# 🎨 AVEE Deployment Architecture

Visual guide to your deployed AVEE app architecture.

---

## 🏗️ Deployment Stack

```
┌─────────────────────────────────────────────────────────────────┐
│                         USERS / BROWSERS                        │
│                    (Worldwide - HTTPS/SSL)                      │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             │ HTTPS
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    VERCEL EDGE NETWORK (CDN)                    │
│                    ✅ Free SSL Certificate                       │
│                    ✅ Global Distribution                        │
│                    ✅ Auto-scaling                               │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                      FRONTEND (Next.js 16)                      │
│                   https://gabee-poc.vercel.app                  │
├─────────────────────────────────────────────────────────────────┤
│  • Landing Page                                                 │
│  • Authentication UI (Supabase Auth)                            │
│  • Agent Management                                             │
│  • Chat Interface                                               │
│  • Feed & Social Features                                       │
│  • Profile Pages                                                │
│                                                                 │
│  Environment Variables:                                         │
│  - NEXT_PUBLIC_SUPABASE_URL                                     │
│  - NEXT_PUBLIC_SUPABASE_ANON_KEY                                │
│  - NEXT_PUBLIC_API_BASE ─────────────────┐                     │
└─────────────────────────────────────────┼───────────────────────┘
                                          │
                                          │ REST API Calls
                                          │ (HTTPS)
                                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                      BACKEND (FastAPI)                          │
│                 https://backend.railway.app                     │
├─────────────────────────────────────────────────────────────────┤
│  • REST API Endpoints (/me/profile, /avees, /chat, etc.)       │
│  • Authentication Middleware (Supabase JWT)                     │
│  • RAG Engine (Embeddings & Search)                             │
│  • Web Research Service                                         │
│  • Streaming Chat Service                                       │
│  • CORS Configuration                                           │
│                                                                 │
│  Environment Variables:                                         │
│  - DATABASE_URL ──────────────────────────┐                    │
│  - SUPABASE_URL                            │                    │
│  - SUPABASE_ANON_KEY                       │                    │
│  - SUPABASE_SERVICE_ROLE_KEY               │                    │
│  - OPENAI_API_KEY ───────────────┐         │                    │
└──────────────────────────────────┼─────────┼────────────────────┘
                                   │         │
                                   │         │
         ┌─────────────────────────┘         │
         │                                   │
         ▼                                   ▼
┌──────────────────────┐        ┌──────────────────────────────┐
│   OPENAI API         │        │  SUPABASE (Cloud Platform)   │
│   platform.openai.com│        │  https://supabase.com        │
├──────────────────────┤        ├──────────────────────────────┤
│ • GPT-4o-mini        │        │  ┌────────────────────────┐  │
│   (Chat completions) │        │  │ PostgreSQL Database    │  │
│                      │        │  │ + pgvector extension   │  │
│ • text-embedding-    │        │  ├────────────────────────┤  │
│   3-small            │        │  │ Tables:                │  │
│   (Vector embeddings)│        │  │ - profiles             │  │
│                      │        │  │ - avees (agents)       │  │
│ Pay per token        │        │  │ - conversations        │  │
│ ~$0.01-0.10 per 1K   │        │  │ - messages             │  │
│                      │        │  │ - documents            │  │
└──────────────────────┘        │  │ - document_chunks      │  │
                                │  │   (with embeddings)    │  │
                                │  │ - relationships        │  │
                                │  │ - permissions          │  │
                                │  └────────────────────────┘  │
                                │                              │
                                │  ┌────────────────────────┐  │
                                │  │ Supabase Auth          │  │
                                │  ├────────────────────────┤  │
                                │  │ - User registration    │  │
                                │  │ - JWT tokens           │  │
                                │  │ - Session management   │  │
                                │  └────────────────────────┘  │
                                │                              │
                                │  ┌────────────────────────┐  │
                                │  │ Storage (optional)     │  │
                                │  ├────────────────────────┤  │
                                │  │ - User avatars         │  │
                                │  │ - Agent images         │  │
                                │  └────────────────────────┘  │
                                │                              │
                                │  Free tier:                  │
                                │  - 500MB database            │
                                │  - 50,000 MAU                │
                                │  - 1GB storage               │
                                └──────────────────────────────┘
```

---

## 📊 Request Flow

### Example: User chats with an agent

```
1. USER types message in browser
   ↓
2. FRONTEND (Vercel) captures input
   ↓
3. FRONTEND gets JWT token from Supabase Auth
   ↓
4. FRONTEND sends POST request to Backend
   POST /chat/stream?conversation_id=xxx&question=yyy
   Header: Authorization: Bearer <jwt_token>
   ↓
5. BACKEND (Railway) receives request
   ↓
6. BACKEND validates JWT token with Supabase
   ↓
7. BACKEND queries PostgreSQL for conversation context
   ↓
8. BACKEND searches document_chunks using pgvector
   SELECT * FROM document_chunks 
   WHERE avee_id = xxx 
   ORDER BY embedding <=> query_embedding
   LIMIT 5
   ↓
9. BACKEND calls OpenAI API
   - Sends: System prompt + RAG context + User message
   - Receives: Streaming response
   ↓
10. BACKEND streams response back to Frontend
    ↓
11. FRONTEND displays message in real-time
    ↓
12. USER sees AI response appearing word by word
```

---

## 🔐 Security Flow

### Authentication & Authorization

```
1. USER clicks "Sign Up"
   ↓
2. FRONTEND calls Supabase Auth API
   ↓
3. SUPABASE creates user account
   Returns: JWT token + user_id
   ↓
4. FRONTEND stores JWT in localStorage
   ↓
5. For every API call:
   FRONTEND → BACKEND
   Header: Authorization: Bearer <jwt_token>
   ↓
6. BACKEND validates token:
   - Checks signature with Supabase
   - Extracts user_id from token
   - Verifies user has access to resource
   ↓
7. BACKEND processes request if authorized
   Otherwise: Returns 401 Unauthorized
```

---

## 💾 Data Flow (RAG)

### How documents become searchable knowledge

```
1. USER uploads document or uses web research
   ↓
2. BACKEND receives document content
   ↓
3. BACKEND chunks document into segments (~1200 chars)
   Function: chunk_text(content)
   ↓
4. BACKEND calls OpenAI Embeddings API
   Model: text-embedding-3-small
   Input: Each chunk
   Output: 1536-dimensional vector
   ↓
5. BACKEND stores in PostgreSQL:
   INSERT INTO document_chunks (
     content,        ← Original text
     embedding,      ← Vector (pgvector type)
     avee_id,       ← Which agent
     layer,         ← Privacy level
     ...
   )
   ↓
6. When USER asks a question:
   - Question → Embedding
   - Vector similarity search using pgvector
   - Retrieve top K most similar chunks
   - Include in AI prompt as context
   ↓
7. AI generates response using retrieved context
```

---

## 📈 Scaling Path

### Current Setup (Free/Hobby Tier)

```
Frontend (Vercel Free):
- ✅ 100GB bandwidth/month
- ✅ Unlimited requests
- ✅ 6,000 build minutes/month
- ✅ Good for: 10,000-50,000 page views/month

Backend (Railway Hobby):
- ✅ $5/month credit
- ✅ ~0.5GB RAM
- ✅ Good for: 100-1,000 requests/day

Database (Supabase Free):
- ✅ 500MB storage
- ✅ 50,000 monthly active users
- ✅ Good for: 1,000-10,000 documents
```

### Growth Tier ($50-100/month)

```
Frontend (Vercel Pro): $20/month
- ✅ 1TB bandwidth
- ✅ Unlimited builds
- ✅ Advanced analytics

Backend (Railway Pro): ~$20-50/month
- ✅ 2GB RAM
- ✅ Auto-scaling
- ✅ Better reliability

Database (Supabase Pro): $25/month
- ✅ 8GB storage
- ✅ 100,000 MAU
- ✅ Daily backups
- ✅ Point-in-time recovery

Good for: 100,000-500,000 requests/month
```

### Enterprise Tier ($500+/month)

```
- Multiple regions
- Dedicated resources
- 99.9% SLA
- Advanced monitoring
- Custom contracts

Good for: 1M+ requests/month
```

---

## 🔄 Deployment Pipeline

### Automatic Deployment (CI/CD)

```
DEVELOPER
   │
   │ git push origin main
   ▼
GITHUB REPOSITORY
   │
   ├──────────────────────┬──────────────────────┐
   │                      │                      │
   ▼                      ▼                      ▼
VERCEL                RAILWAY              (SUPABASE)
(Frontend)            (Backend)            (Database)
   │                      │                      │
   │ Detects push         │ Detects push         │ Already running
   │ npm install          │ pip install          │
   │ npm build            │ Build container      │
   │ Deploy to CDN        │ Deploy to cloud      │
   │                      │                      │
   ▼                      ▼                      ▼
PRODUCTION            PRODUCTION           PRODUCTION
Updated in ~2min      Updated in ~3min     Always on

✅ Zero-downtime deployments
✅ Automatic rollback on failure
✅ Preview deployments for PRs
```

---

## 💰 Cost Breakdown

### Monthly Costs (Typical)

```
┌─────────────────────────────────────────────────────────┐
│ Service          │ Free Tier │ Hobby/Pro  │ Enterprise │
├─────────────────────────────────────────────────────────┤
│ Vercel           │ $0        │ $20/month  │ Custom     │
│ Railway          │ $5 credit │ $20-50     │ Custom     │
│ Supabase         │ $0        │ $25/month  │ Custom     │
│ OpenAI API       │ ~$1-10    │ $10-100    │ $100-1000+ │
├─────────────────────────────────────────────────────────┤
│ TOTAL            │ $5-15     │ $75-195    │ $500-5000+ │
└─────────────────────────────────────────────────────────┘

* OpenAI costs vary based on usage
* Free tiers are sufficient for development and early testing
```

---

## 🎯 URLs Reference

```
📱 FRONTEND (Production)
   https://gabee-poc.vercel.app
   
🔧 BACKEND (Production)
   https://your-backend.railway.app
   https://your-backend.railway.app/docs       ← API Documentation
   https://your-backend.railway.app/health     ← Health check
   
💾 DATABASE (Supabase)
   https://supabase.com/dashboard/project/[id]
   
🛠️ DASHBOARDS
   Vercel:   https://vercel.com/dashboard
   Railway:  https://railway.app/dashboard
   Supabase: https://supabase.com/dashboard
   OpenAI:   https://platform.openai.com
```

---

## ✅ Deployment Verification

### Health Checks

```bash
# Backend health
curl https://your-backend.railway.app/health
# Expected: {"ok": true}

# API documentation
curl https://your-backend.railway.app/docs
# Expected: HTML page with FastAPI docs

# Frontend
curl https://gabee-poc.vercel.app
# Expected: HTML of landing page
```

---

## 🎉 You're Live!

This architecture gives you:
- ✅ Global CDN distribution (fast worldwide)
- ✅ Automatic SSL/HTTPS
- ✅ Auto-scaling based on traffic
- ✅ Automatic deployments on git push
- ✅ 99.9% uptime SLA
- ✅ Professional infrastructure
- ✅ Low cost to start
- ✅ Easy to scale up

**Start with free tiers, scale as you grow!** 🚀







