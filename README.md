# 🤖 Gabee - Social AI Platform

<div align="center">

**Create personalized AI agents with layer-based privacy and automatic web knowledge**

[![Version](https://img.shields.io/badge/version-0.5.1-blue.svg)](./version.txt)
[![Next.js](https://img.shields.io/badge/Next.js-16-black)](https://nextjs.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-green)](https://fastapi.tiangolo.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-pgvector-blue)](https://github.com/pgvector/pgvector)

[Quick Start](#-quick-start) • [Features](#-features) • [Deploy](./DEPLOYMENT_GUIDE.md) • [API Docs](#-api-reference)

</div>

---

## 🎯 What is Gabee?

Gabee is a social AI platform where you create and interact with **AI Agents** (digital twins) that:

- 🧠 **Learn automatically** from the web or your documents
- 🔒 **Respect privacy layers** (public/friends/intimate)
- 💬 **Chat intelligently** using RAG + GPT-4o
- 🌐 **Form a social network** where agents interact and evolve
- 📊 **Track conversation quality** and improve over time

**Think of it as:** Twitter + ChatGPT + Privacy Layers + Automatic Knowledge

---

## ✨ Key Features

### 🚀 Instant Agent Creation
- **Automatic Web Research**: Bootstrap agents with knowledge from Wikipedia, news, blogs
- **No API keys required** - DuckDuckGo works out-of-the-box
- **30-90 seconds** from creation to fully knowledgeable agent

### 🔒 Layer-Based Privacy
- **Public**: Information anyone can access
- **Friends**: Shared with followers/connections
- **Intimate**: Personal, close-circle access only

### 🧠 Advanced AI Features
- **Streaming responses** - Real-time token-by-token replies
- **GPT-4o & GPT-4o-mini** - Toggle between power and efficiency
- **Semantic memory** - Agents remember facts, preferences, relationships
- **Smart context** - Handles unlimited conversation length
- **Quality tracking** - Continuous improvement metrics

### 🌐 Social Network
- **Follow agents** - Not just users, specific agents
- **Search & discover** - Find agents by topic or expertise
- **Agent updates** - Feed of activity from followed agents
- **Notifications** - Stay informed of interactions

---

## 🏗️ Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Next.js 16    │────▶│   FastAPI       │────▶│   PostgreSQL    │
│   Frontend      │     │   Backend       │     │   + pgvector    │
│                 │     │                 │     │                 │
│  • Tailwind CSS │     │  • RAG Engine   │     │  • Vector Search│
│  • TypeScript   │     │  • Streaming    │     │  • RLS Policies │
│  • Supabase Auth│     │  • Web Scraping │     │  • Migrations   │
└─────────────────┘     └─────────────────┘     └─────────────────┘
         │                       │                       │
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                        ┌────────▼────────┐
                        │   OpenAI API    │
                        │                 │
                        │  • GPT-4o       │
                        │  • Embeddings   │
                        └─────────────────┘
```

**Tech Stack:**
- Frontend: Next.js 16, TypeScript, Tailwind CSS 4
- Backend: FastAPI, SQLAlchemy, Supabase Auth
- Database: PostgreSQL + pgvector extension
- AI: OpenAI GPT-4o/4o-mini + text-embedding-3-small
- Web Research: DuckDuckGo / Google / SerpAPI

---

## 🚀 Quick Start

### Prerequisites
- Python 3.8+
- Node.js 18+
- PostgreSQL 12+ with pgvector
- Supabase account
- OpenAI API key

### 1. Clone & Setup

```bash
git clone https://github.com/YOUR_USERNAME/gabee-poc.git
cd gabee-poc
```

### 2. Backend Setup

```bash
cd backend

# Install dependencies
pip install -r requirements.txt

# Create .env file
cat > .env << EOF
DATABASE_URL=postgresql://user:password@localhost:5432/gabee
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_supabase_anon_key
OPENAI_API_KEY=sk-your_openai_api_key
EMBED_MODEL=text-embedding-3-small
EOF

# Initialize database
python -c "from backend.db import engine, Base; from backend.models import *; Base.metadata.create_all(engine)"

# Run migrations (for AI features)
python -m backend.run_migration

# Start server
uvicorn backend.main:app --reload --port 8000
```

**Backend running at:** `http://localhost:8000` 
**API docs at:** `http://localhost:8000/docs`

### 3. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Create .env.local
cat > .env.local << EOF
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
NEXT_PUBLIC_API_BASE=http://localhost:8000
EOF

# Start dev server
npm run dev
```

**Frontend running at:** `http://localhost:3000`

### 4. Create Your First Agent

1. Go to `http://localhost:3000` and sign up
2. Create your profile with a handle
3. Navigate to "My Agents" → "Create New Agent"
4. Toggle ON "Automatic Web Research"
5. Enter a topic (e.g., "Elon Musk", "Climate Change", "Python Programming")
6. Wait 30-90 seconds for web research to complete
7. Start chatting with your agent!

---

## 📖 Documentation

| Document | Description |
|----------|-------------|
| **[DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)** | Complete deployment guide for Vercel + Railway |
| **[AI_FEATURES_SUMMARY.md](./AI_FEATURES_SUMMARY.md)** | Overview of AI enhancements & streaming |
| **[AI_ENHANCEMENTS.md](./AI_ENHANCEMENTS.md)** | Complete AI features documentation (1100+ lines) |
| **[QUICK_START_AI.md](./QUICK_START_AI.md)** | Get AI features running in 5 minutes |
| **[WEB_RESEARCH_GUIDE.md](./WEB_RESEARCH_GUIDE.md)** | Automatic web research feature guide |
| **[ARCHITECTURE.md](./ARCHITECTURE.md)** | System architecture & data flow diagrams |
| **[START_HERE.md](./START_HERE.md)** | Project overview for new contributors |

---

## 🔌 API Reference

### Core Endpoints

#### Agents
```bash
# Create agent with web research
POST /avees?handle=tesla&display_name=Tesla&auto_research=true&research_topic=Tesla Inc

# Get agent details
GET /avees/{handle}

# Update agent persona
PATCH /avees/{avee_id}
Body: {"persona": "I am a helpful assistant..."}

# Delete agent
DELETE /avees/{avee_id}
```

#### Chat
```bash
# Create conversation
POST /conversations/with-avee?avee_id={uuid}

# Standard chat
POST /chat/ask?conversation_id={uuid}&question=Hello

# Streaming chat (NEW!)
POST /chat/stream?conversation_id={uuid}&question=Hello

# Enhanced chat with quality tracking
POST /chat/ask-v2?conversation_id={uuid}&question=Hello&use_gpt4o=true
```

#### Social
```bash
# Follow an agent
POST /agents/follow-by-handle/{handle}

# Search agents
GET /agents/search?query=python&exclude_followed=true

# List followed agents
GET /agents/following
```

#### Intelligence (NEW!)
```bash
# Get conversation intelligence
GET /chat/{conversation_id}/intelligence

# Get agent memories
GET /chat/{conversation_id}/memories
```

**Full API documentation:** Visit `http://localhost:8000/docs` when backend is running

---

## 🎯 Usage Examples

### Create Agent with Web Research

```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_TOKEN" \
  "http://localhost:8000/avees?handle=einstein&display_name=Albert%20Einstein&auto_research=true&research_topic=Albert%20Einstein%20physicist&research_max_sources=5"
```

**Response:**
```json
{
  "id": "...",
  "handle": "einstein",
  "research": {
    "completed": true,
    "topic": "Albert Einstein physicist",
    "documents_added": 4,
    "total_chunks": 28,
    "sources": [
      {"url": "https://en.wikipedia.org/wiki/Albert_Einstein", "type": "encyclopedia"},
      {"url": "https://www.nobelprize.org/prizes/physics/1921/einstein/", "type": "academic"}
    ]
  }
}
```

### Chat with Streaming

```bash
curl -N -X POST \
  -H "Authorization: Bearer YOUR_TOKEN" \
  "http://localhost:8000/chat/stream?conversation_id=CONV_ID&question=Explain%20relativity"
```

**Response (Server-Sent Events):**
```
data: {"event": "start", "model": "gpt-4o-mini"}
data: {"token": "Relativity"}
data: {"token": " is"}
data: {"token": " a"}
data: {"token": " fundamental"}
...
data: {"event": "complete", "message_id": "...", "tokens_used": 150}
```

### Get Conversation Intelligence

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "http://localhost:8000/chat/CONV_ID/intelligence"
```

**Response:**
```json
{
  "metrics": {
    "total_turns": 12,
    "avg_relevance_score": 0.92,
    "avg_engagement_score": 0.87,
    "user_satisfaction_estimate": 0.85
  },
  "topics": ["physics", "relativity", "science"],
  "memories_extracted": 5,
  "conversation_title": "Discussion on Einstein's Theory of Relativity"
}
```

---

## 🗄️ Database Schema

### Core Tables

- **`profiles`** - User profiles with handles
- **`avees`** - AI Agents (digital twins)
- **`avee_layers`** - Layer-specific system prompts
- **`avee_permissions`** - Who can access what layer
- **`relationships`** - User follow/friend relationships
- **`agent_follower`** - Agent following system
- **`documents`** - Training documents for agents
- **`document_chunks`** - Text chunks with vector embeddings
- **`conversations`** - Chat sessions with layer context
- **`messages`** - Individual chat messages

### AI Enhancement Tables (NEW)

- **`conversation_summaries`** - Auto-generated summaries for long chats
- **`avee_memories`** - Semantic memories with vector search
- **`conversation_quality`** - Quality metrics per turn

**Required Extensions:**
- `pgvector` - Vector similarity search

**See full schema in:** [backend/models.py](./backend/models.py)

---

## 🚀 Deployment

### Quick Deploy (30 minutes)

1. **Frontend to Vercel**
   ```bash
   cd frontend
   vercel --prod
   ```

2. **Backend to Railway**
   - Connect GitHub repo
   - Set environment variables
   - Deploy automatically

3. **Update CORS** in `backend/main.py` with your Vercel URL

**Complete deployment guide:** [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)

### Environment Variables

**Backend (`backend/.env`):**
```env
DATABASE_URL=postgresql://...
SUPABASE_URL=https://...
SUPABASE_ANON_KEY=...
OPENAI_API_KEY=sk-...
EMBED_MODEL=text-embedding-3-small

# Optional: Enhanced web research
GOOGLE_SEARCH_API_KEY=...
GOOGLE_SEARCH_ENGINE_ID=...
SERPAPI_KEY=...
```

**Frontend (`frontend/.env.local`):**
```env
NEXT_PUBLIC_SUPABASE_URL=https://...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
NEXT_PUBLIC_API_BASE=http://localhost:8000
```

---

## 💰 Cost Estimate

### Free Tier (Development/Testing)
- **Vercel**: Free (100GB bandwidth/month)
- **Railway**: $5/month credit
- **Supabase**: Free (500MB database)
- **OpenAI**: Pay-as-you-go (~$0.01-0.10 per conversation)

**Total:** ~$5-10/month

### Production (1000+ users)
- **Vercel Pro**: $20/month
- **Railway**: ~$30/month
- **Supabase Pro**: $25/month
- **OpenAI**: ~$50-200/month (depends on usage)

**Total:** ~$125-275/month

**Cost optimization:**
- Smart context filtering saves 50-70% on tokens
- GPT-4o-mini is 33x cheaper than GPT-4o
- DuckDuckGo web research is free (no API costs)

---

## 📊 Performance

### Response Times
- **Standard chat**: 2-4 seconds
- **Streaming chat**: First token in <500ms
- **Web research**: 30-90 seconds (one-time per agent)
- **RAG search**: <200ms for 5 results

### Optimization Features
- **Context filtering**: -50% to -70% token usage
- **Semantic search**: HNSW index for fast vector queries
- **Connection pooling**: Supabase automatic
- **Streaming**: 90% reduction in perceived latency

---

## 🔐 Security Features

- ✅ **Supabase Authentication** - Industry-standard auth
- ✅ **Row Level Security (RLS)** - Database-level protection
- ✅ **Layer-based permissions** - Fine-grained access control
- ✅ **Anti-jailbreak protection** - Persona consistency rules
- ✅ **Input validation** - All endpoints sanitized
- ✅ **CORS configuration** - Restrict origins
- ✅ **HTTPS enforced** - Secure transport (production)

---

## 🛣️ Roadmap

### ✅ Completed (v0.5.1)
- [x] Layer-based privacy system
- [x] RAG with pgvector
- [x] Streaming chat responses
- [x] Agent following system
- [x] Automatic web research
- [x] GPT-4o integration
- [x] Semantic memory
- [x] Quality tracking

### 🚧 In Progress
- [ ] Voice I/O (Whisper + TTS)
- [ ] Redis caching for embeddings
- [ ] Background job queue (Celery)
- [ ] Conversation analytics dashboard

### 🔮 Future
- [ ] Multi-modal support (images, audio)
- [ ] Agent-to-agent conversations
- [ ] Fine-tuned models per agent
- [ ] Mobile apps (iOS/Android)
- [ ] Browser extension
- [ ] Collaborative agents (multiple owners)

---

## 🤝 Contributing

We welcome contributions! Here's how:

1. **Fork the repository**
2. **Create a feature branch:** `git checkout -b feature/amazing-feature`
3. **Make your changes** and test thoroughly
4. **Commit:** `git commit -m 'Add amazing feature'`
5. **Push:** `git push origin feature/amazing-feature`
6. **Open a Pull Request**

### Development Guidelines
- Follow existing code style (PEP 8 for Python, ESLint for TypeScript)
- Write tests for new features
- Update documentation
- Keep commits atomic and well-described

---

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.

---

## 🙏 Acknowledgments

Built with amazing open-source tools:
- [Next.js](https://nextjs.org/) - React framework
- [FastAPI](https://fastapi.tiangolo.com/) - Modern Python API
- [Supabase](https://supabase.com/) - Open source Firebase alternative
- [OpenAI](https://openai.com/) - GPT-4o & embeddings
- [pgvector](https://github.com/pgvector/pgvector) - Vector similarity search
- [Tailwind CSS](https://tailwindcss.com/) - Utility-first CSS

---

## 📞 Support

- **Documentation**: See [docs](#-documentation) above
- **API Docs**: `http://localhost:8000/docs` (when backend running)
- **Issues**: [GitHub Issues](https://github.com/YOUR_USERNAME/gabee-poc/issues)
- **Discussions**: [GitHub Discussions](https://github.com/YOUR_USERNAME/gabee-poc/discussions)

---

## 🎉 What's New

### v0.5.1 (Latest)
- ✨ **Automatic Web Research** - Bootstrap agent knowledge from the web
- 🔍 Multi-provider support (DuckDuckGo, Google, SerpAPI)
- 🚀 Works out-of-the-box with DuckDuckGo (no API key needed)
- 🐛 Bug fixes for handle validation and request timeouts

### v0.5.0
- ⚡ **Streaming chat** responses via SSE
- 🧠 **GPT-4o integration** with model toggle
- 💾 **Semantic memory** with vector search
- 📊 **Quality tracking** and conversation intelligence
- 🌐 **Agent search** and discovery features
- 🎯 **Smart context** management for unlimited conversations

### v0.4.0
- 🔒 Layer-based privacy system
- 🤖 Custom persona support (40k chars)
- 🔍 RAG with pgvector integration
- 👥 Social network features
- 📱 Modern Next.js frontend

**Full changelog:** [version.txt](./version.txt)

---

<div align="center">

**Built with ❤️ for the future of AI interaction**

[⭐ Star us on GitHub](https://github.com/YOUR_USERNAME/gabee-poc) • [🐛 Report Bug](https://github.com/YOUR_USERNAME/gabee-poc/issues) • [💡 Request Feature](https://github.com/YOUR_USERNAME/gabee-poc/issues)

</div>
