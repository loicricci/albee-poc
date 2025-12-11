# Quick Start: POC to Production

This is a condensed action plan to get started with production development. See `PRODUCTION_ROADMAP.md` for comprehensive details.

---

## 🎯 Immediate Next Steps (This Week)

### 1. Choose Your Stack

**Recommended for Speed:**
```yaml
Frontend:     Next.js 14 + TypeScript + Tailwind
Backend:      Keep FastAPI (Python) - easier migration
Database:     PostgreSQL (managed via Railway or Supabase)
Vector DB:    Pinecone (free tier to start)
Hosting:      Vercel (frontend) + Railway (backend)
Auth:         NextAuth.js
```

### 2. Set Up Your Workspace

```bash
# Create project structure
mkdir gabee-production
cd gabee-production

# Frontend
npx create-next-app@latest frontend --typescript --tailwind --app
cd frontend
npm install next-auth socket.io-client swr zod react-hook-form

# Backend
cd ..
mkdir backend
cd backend
python -m venv venv
source venv/bin/activate
pip install fastapi uvicorn sqlalchemy alembic asyncpg python-jose passlib pinecone-client openai python-multipart
```

### 3. Database Setup (PostgreSQL)

**Quick Start with Railway:**
1. Go to railway.app
2. Create new project
3. Add PostgreSQL database
4. Copy connection string

**Or use Supabase:**
1. Go to supabase.com
2. Create new project
3. Get connection string from settings

```python
# backend/database.py
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker, declarative_base

DATABASE_URL = "postgresql+asyncpg://user:pass@host:5432/gabee"

engine = create_async_engine(DATABASE_URL, echo=True)
AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
Base = declarative_base()

async def get_db():
    async with AsyncSessionLocal() as session:
        yield session
```

### 4. Essential Database Schema (Start Here)

```sql
-- Run these first
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    username VARCHAR(100),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_messages_conversation ON messages(conversation_id);
CREATE INDEX idx_conversations_user ON conversations(user_id);
```

### 5. Minimal FastAPI Backend

```python
# backend/main.py
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from typing import List
from uuid import UUID
import uvicorn

from database import get_db, engine, Base

app = FastAPI()

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Models
class MessageCreate(BaseModel):
    content: str

class MessageResponse(BaseModel):
    id: str
    role: str
    content: str

@app.on_event("startup")
async def startup():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

@app.get("/api/health")
async def health():
    return {"status": "ok"}

@app.post("/api/chat/{conversation_id}/messages")
async def create_message(
    conversation_id: UUID,
    message: MessageCreate,
    db: AsyncSession = Depends(get_db)
):
    # TODO: Add your generate_reply logic here
    # For now, echo back
    return {
        "user_message": {"role": "user", "content": message.content},
        "assistant_message": {"role": "assistant", "content": f"Echo: {message.content}"}
    }

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
```

### 6. Minimal Next.js Frontend

```typescript
// app/page.tsx
'use client'

import { useState } from 'react'

export default function Home() {
  const [messages, setMessages] = useState<Array<{role: string, content: string}>>([])
  const [input, setInput] = useState('')
  
  const sendMessage = async () => {
    if (!input.trim()) return
    
    // Add user message
    setMessages(prev => [...prev, { role: 'user', content: input }])
    
    // Call API
    const res = await fetch('http://localhost:8000/api/chat/test-conversation/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: input })
    })
    
    const data = await res.json()
    
    // Add assistant message
    setMessages(prev => [...prev, data.assistant_message])
    setInput('')
  }
  
  return (
    <div className="min-h-screen bg-[#020308] text-[#c5f5c5] p-4">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl mb-4 font-mono">GABEE • LOÏC TWIN</h1>
        
        {/* Messages */}
        <div className="space-y-4 mb-4">
          {messages.map((msg, i) => (
            <div 
              key={i}
              className={`p-4 rounded border ${
                msg.role === 'user' 
                  ? 'border-blue-900 bg-blue-950' 
                  : 'border-green-900 bg-green-950'
              }`}
            >
              <div className="text-xs uppercase mb-2">
                {msg.role === 'user' ? 'YOU' : 'LOÏC-GABEE'}
              </div>
              <div>{msg.content}</div>
            </div>
          ))}
        </div>
        
        {/* Input */}
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
            className="flex-1 bg-[#05080a] border border-[#294729] rounded px-4 py-2"
            placeholder="Ask something..."
          />
          <button
            onClick={sendMessage}
            className="bg-[#071107] border border-[#294729] rounded px-6 py-2 hover:border-[#8bff8b]"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  )
}
```

---

## 🔄 Migration Strategy

### Week 1: Setup & Foundation
- [ ] Set up Next.js + FastAPI projects
- [ ] Create PostgreSQL database
- [ ] Implement basic auth (username/password)
- [ ] Build minimal chat UI
- [ ] Test end-to-end flow

### Week 2: Core Features
- [ ] Migrate RAG system to Pinecone
- [ ] Copy your agent logic to new backend
- [ ] Add conversation history
- [ ] Implement streaming responses
- [ ] User profiles

### Week 3: Polish & Deploy
- [ ] Add all UI features from POC
- [ ] Testing and bug fixes
- [ ] Deploy to Vercel + Railway
- [ ] Set up monitoring

---

## 📦 Key Files to Migrate

From your POC, you'll want to adapt these:

### 1. `agent_enhanced.py` → `backend/services/agent_service.py`
- Keep the core logic
- Adapt for async/await
- Use database instead of file storage

### 2. `rag.py` → `backend/services/rag_service.py`
- Replace in-memory storage with Pinecone
- Keep the chunking logic
- Add async operations

### 3. `conversation_manager.py` → Keep as is
- Minimal changes needed
- Just adapt for async

### 4. `user_profile.py` → `backend/services/profile_service.py`
- Store profiles in PostgreSQL
- Keep extraction logic

### 5. `app.py` (Streamlit) → `app/` (Next.js)
- Rebuild UI in React/Next.js
- Keep the terminal aesthetic
- Improve UX with streaming

---

## 🚀 Deployment Checklist

### Environment Variables Needed

```bash
# Frontend (.env.local)
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=generate-a-secret-here
NEXT_PUBLIC_API_URL=http://localhost:8000

# Backend (.env)
DATABASE_URL=postgresql://...
OPENAI_API_KEY=sk-...
JWT_SECRET_KEY=generate-a-secret-here
PINECONE_API_KEY=...
PINECONE_ENVIRONMENT=...
REDIS_URL=redis://...
```

### Deploy Frontend to Vercel

```bash
cd frontend
git init
git add .
git commit -m "Initial commit"
git remote add origin YOUR_GITHUB_REPO
git push -u origin main

# Then on Vercel:
# 1. Import your GitHub repo
# 2. Add environment variables
# 3. Deploy
```

### Deploy Backend to Railway

```bash
cd backend
# Create Procfile
echo "web: uvicorn main:app --host 0.0.0.0 --port $PORT" > Procfile

# Create requirements.txt
pip freeze > requirements.txt

# Push to GitHub
git init
git add .
git commit -m "Backend initial commit"
git remote add origin YOUR_BACKEND_GITHUB_REPO
git push -u origin main

# Then on Railway:
# 1. New Project from GitHub
# 2. Add environment variables
# 3. Deploy
```

---

## 💡 Pro Tips

1. **Start with One Feature**
   - Don't migrate everything at once
   - Start with chat, then add features incrementally

2. **Use Migration Scripts**
   - Write scripts to migrate user data from JSON files to PostgreSQL
   - Test thoroughly before going live

3. **Keep POC Running**
   - Don't shut down POC until production is feature-complete
   - Use it for reference

4. **Version Your API**
   - Use `/api/v1/` prefix
   - Makes future changes easier

5. **Document As You Go**
   - Keep API docs updated
   - Document environment variables
   - Write setup instructions

---

## 📞 Need Help?

### Common Issues

**CORS errors:**
```python
# Add to FastAPI
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Update for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

**Database connection fails:**
```python
# Check connection string format
# PostgreSQL: postgresql+asyncpg://user:pass@host:port/db
# Make sure asyncpg is installed
```

**Auth not working:**
```typescript
// Make sure credentials are included
fetch('http://localhost:8000/api/endpoint', {
  credentials: 'include',
  headers: {
    'Authorization': `Bearer ${token}`
  }
})
```

---

## 🎯 Success Metrics

After Week 1, you should have:
- ✅ Next.js showing a page
- ✅ FastAPI responding to requests
- ✅ Database storing data
- ✅ Basic authentication working
- ✅ Simple chat working end-to-end

After Week 2, you should have:
- ✅ RAG working with real vector DB
- ✅ All POC features working
- ✅ User profiles and history
- ✅ Streaming responses

After Week 3, you should have:
- ✅ Deployed to production
- ✅ Real users can sign up
- ✅ Monitoring in place
- ✅ POC feature parity

---

## 📚 Learning Resources

- **Next.js**: nextjs.org/learn
- **FastAPI**: fastapi.tiangolo.com
- **PostgreSQL**: postgresql.org/docs
- **Pinecone**: docs.pinecone.io
- **Railway**: docs.railway.app

Good luck! Start with Week 1 and you'll have a working foundation in no time. 🚀





