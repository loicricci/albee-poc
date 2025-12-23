# Gabee - Social AI Platform

**Version**: 0.5.1

A social AI platform where users create and interact with personalized AI agents (digital twins). Each agent has layer-based access control (public/friends/intimate) and uses RAG (Retrieval Augmented Generation) powered by PostgreSQL + pgvector for context-aware conversations. Features automatic web research to bootstrap agent knowledge from public web sources.

## 🎯 Overview

Gabee enables users to:
- Create **AI Agents** (digital twins) with unique handles
- **Automatically research** topics/people from the web to bootstrap agent knowledge
- Train agents with documents at different privacy layers
- Have conversations with agents that respect layer-based permissions
- Follow other users and interact with their agents
- Control who can access different layers of an agent's knowledge
- Share agents with specific people or keep them public
- Build a network of AI personas representing yourself or others

### Core Concepts

- **Agents**: AI digital twins created by users, each with a unique handle and customizable persona (stored in database as `avees` for legacy reasons)
- **Layers**: Three-tier privacy system:
  - `public`: Publicly accessible information
  - `friends`: Information accessible to friends/followers
  - `intimate`: Personal information for close connections
- **Profiles**: User profiles with handles, display names, and bios
- **Relationships**: Follow/friend system between users
- **Agent Following**: Follow specific agents created by other users to receive updates
- **Permissions**: Fine-grained access control determining which layer each viewer can access
- **Documents**: Training content added to agents at specific layers
- **Conversations**: Chat sessions with agents, automatically using the appropriate layer based on permissions

## 🏗️ Architecture

The application consists of:

### Frontend: Next.js Web App (`frontend/`)
- Next.js 16 with TypeScript
- Supabase client for authentication
- API client for backend communication
- Tailwind CSS for styling

### Backend: FastAPI REST API (`backend/`)
- RESTful API with comprehensive endpoints
- CORS middleware configured for frontend integration
- PostgreSQL with pgvector extension for vector similarity search
- Supabase authentication integration
- OpenAI integration for embeddings and chat completions

### Legacy: Streamlit POC (`app.py`)
- Original proof-of-concept interface (still available)
- In-memory RAG implementation
- Retro terminal-style UI

## 📁 Project Structure

```
gabee-poc/
├── app.py                          # Legacy Streamlit frontend (POC)
├── agent.py                        # Agent engine (legacy)
├── rag_multi.py                    # Multi-agent RAG (in-memory, legacy)
├── url_scraper.py                  # URL extraction and web scraping
├── requirements.txt                # Root dependencies (Streamlit, OpenAI, etc.)
│
├── frontend/                       # Next.js frontend
│   ├── src/
│   │   ├── app/                    # Next.js app router pages
│   │   │   ├── (auth)/             # Authentication pages
│   │   │   │   ├── login/          # Login page
│   │   │   │   └── signup/         # Signup page
│   │   │   ├── (app)/              # Authenticated app pages
│   │   │   │   ├── app/            # Home feed
│   │   │   │   ├── profile/        # User profile page
│   │   │   │   ├── my-agents/      # Manage your agents
│   │   │   │   │   └── [handle]/   # Individual agent management
│   │   │   │   ├── my-avees/       # Legacy redirect to my-agents
│   │   │   │   ├── chat/           # Chat interface
│   │   │   │   │   └── [handle]/   # Chat with specific agent
│   │   │   │   ├── network/        # Social network/following
│   │   │   │   └── notifications/  # Notifications page
│   │   │   └── page.tsx            # Landing page
│   │   └── lib/
│   │       ├── supabaseClient.ts   # Supabase client configuration
│   │       └── api.ts              # API client utilities
│   ├── package.json
│   └── .env.local                  # Frontend environment variables
│
├── backend/                        # FastAPI backend
│   ├── __init__.py
│   ├── main.py                     # FastAPI app with all endpoints
│   ├── db.py                       # SQLAlchemy database connection
│   ├── models.py                   # Database models
│   ├── auth_supabase.py            # Supabase authentication
│   ├── openai_embed.py             # OpenAI embedding utilities
│   ├── rag_utils.py                # RAG helper functions (chunking)
│   ├── rag_pgvector.py             # Placeholder (not used)
│   ├── web_research.py             # Automatic web research module
│   ├── url_scraper.py              # URL scraping utilities
│   ├── deps.py                     # Dependency injection (empty)
│   ├── requirements.txt            # Backend dependencies
│   └── .env                        # Backend environment variables
│
└── data/                           # Legacy knowledge base data (for Streamlit POC)
    ├── persona_loic.md
    ├── contributions/
    └── victor_hugo/
```

## 🚀 Features

### Current Functionality

1. **Agent System**
   - Create AI agents with unique handles
   - Three-layer privacy system (public/friends/intimate)
   - Customizable persona for each agent (up to 40k characters)
   - Per-layer system prompts for different interaction styles
   - Owner gets intimate access by default

2. **Document Management**
   - Add training documents to agents at specific layers
   - Automatic chunking and embedding using OpenAI
   - pgvector storage for efficient similarity search
   - Layer-based filtering during retrieval
   - Image upload support for agent avatars

3. **RAG with pgvector**
   - PostgreSQL + pgvector for persistent vector storage
   - Cosine similarity search using `<=>` operator
   - Layer-aware filtering during search
   - Automatic embedding generation with OpenAI `text-embedding-3-small`

4. **Conversations**
   - Create conversations with agents
   - Automatic layer resolution based on permissions
   - Layer-specific system prompts
   - Conversation history persistence
   - Real-time streaming responses

5. **Permissions & Access Control**
   - Set maximum accessible layer per viewer
   - Owner has full control
   - Default permissions (public for everyone)
   - Permission checks on all agent operations
   - Grant access to specific followers

6. **Social Features**
   - User profiles with handles
   - Follow relationships between users
   - Agent following system (follow specific agents, not just users)
   - View and interact with other users' agents
   - Network page to discover and search agents
   - Notifications system for updates

7. **Chat API**
   - Integrated RAG search for context
   - OpenAI GPT-4o-mini for response generation
   - Streaming support for real-time responses
   - Layer-appropriate responses
   - Automatic message storage
   - Custom persona injection
   - Anti-jailbreak protection

8. **Automatic Web Research**
   - Automatically gather knowledge from the web when creating agents
   - Search engines: DuckDuckGo (no API key), Google Custom Search, or SerpAPI
   - Scrape and parse content from multiple sources (Wikipedia, news, blogs, etc.)
   - Automatic chunking, embedding, and storage of researched content
   - Configurable number of sources (3-10)
   - Works out-of-the-box with DuckDuckGo (no configuration needed)
   - Typical research time: 30-90 seconds for 5 sources

9. **Modern UI/UX**
   - Responsive design with Tailwind CSS
   - Home feed with agent updates
   - Agent discovery and search
   - Notification system
   - Profile management
   - Clean, modern interface

## 🛠️ Tech Stack

### Frontend
- **Next.js 16.0.10** - React framework with App Router
- **TypeScript** - Type safety
- **Tailwind CSS 4** - Styling
- **@supabase/supabase-js 2.87.2** - Supabase client

### Backend
- **FastAPI 0.115.0** - REST API framework
- **SQLAlchemy 2.0.34** - ORM and database management
- **PostgreSQL** (via `psycopg[binary] 3.2.13`) - Database with pgvector extension
- **Supabase** - Authentication provider
- **OpenAI 1.57.0** - Embeddings (`text-embedding-3-small`) and chat completions (`gpt-4o-mini`)
- **httpx 0.27.2** - HTTP client for Supabase API calls
- **requests 2.31.0+** - HTTP library for web scraping
- **beautifulsoup4 4.12.0+** - HTML parsing for web content extraction

### Database Extensions
- **pgvector** - Vector similarity search extension for PostgreSQL

## 📋 Setup Instructions

### Prerequisites
- Python 3.8+
- Node.js 18+ and npm
- PostgreSQL 12+ with pgvector extension installed
- Supabase project (for authentication)
- OpenAI API key
- (Optional) Google Custom Search API key or SerpAPI key for enhanced web research

### Database Setup

1. **Install pgvector extension**
   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   ```

2. **Create required ENUM types** (if using Supabase, these may already exist)
   ```sql
   CREATE TYPE avee_layer AS ENUM ('public', 'friends', 'intimate');
   CREATE TYPE relationship_type AS ENUM ('follow', 'friend', 'block');
   ```

### Backend Setup

1. **Navigate to backend directory**
   ```bash
   cd backend
   ```

2. **Create virtual environment**
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

   **Important**: Ensure web research dependencies are installed:
   ```bash
   pip install beautifulsoup4 requests openai
   ```

4. **Create `backend/.env` file**
   ```env
   DATABASE_URL=postgresql://user:password@localhost:5432/gabee
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_ANON_KEY=your_supabase_anon_key
   OPENAI_API_KEY=sk-your_openai_api_key
   EMBED_MODEL=text-embedding-3-small
   ```

5. **Initialize database**
   ```bash
   # Create all tables
   python -c "from backend.db import engine, Base; from backend.models import *; Base.metadata.create_all(engine)"
   ```

6. **Run FastAPI server**
   ```bash
   uvicorn backend.main:app --reload --port 8000
   ```
   API will be available at `http://localhost:8000`  
   API docs available at `http://localhost:8000/docs`  
   CORS is configured for `http://localhost:3000` (Next.js frontend)

### Frontend Setup

1. **Navigate to frontend directory**
   ```bash
   cd frontend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Create `frontend/.env.local` file**
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   NEXT_PUBLIC_API_BASE=http://localhost:8000
   ```

4. **Run development server**
   ```bash
   npm run dev
   ```
   App will open at `http://localhost:3000`

## 🔧 Environment Variables

### `backend/.env` (Backend)
```env
DATABASE_URL=postgresql://...      # Required: PostgreSQL connection string (with pgvector)
SUPABASE_URL=https://...           # Required: Supabase project URL
SUPABASE_ANON_KEY=...              # Required: Supabase anonymous key
OPENAI_API_KEY=sk-...              # Required: OpenAI API key
EMBED_MODEL=text-embedding-3-small # Optional: Embedding model (defaults to text-embedding-3-small)

# Optional: Web Research API Keys (works without these using DuckDuckGo)
GOOGLE_SEARCH_API_KEY=...          # Optional: Google Custom Search API key (100 free queries/day)
GOOGLE_SEARCH_ENGINE_ID=...        # Optional: Google Custom Search Engine ID
SERPAPI_KEY=...                    # Optional: SerpAPI key (paid, best results)
```

### `frontend/.env.local` (Frontend)
```env
NEXT_PUBLIC_SUPABASE_URL=https://...    # Required: Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=...       # Required: Supabase anonymous key
NEXT_PUBLIC_API_BASE=http://localhost:8000  # Required: Backend API base URL
```

## 📊 Database Schema

### Core Tables

#### `profiles`
- `user_id` (UUID, primary key) - Supabase auth user ID
- `handle` (String, unique, not null)
- `display_name` (String)
- `avatar_url` (Text)
- `bio` (Text)
- `created_at` (Timestamp with timezone)

#### `avees`
- `id` (UUID, primary key)
- `owner_user_id` (UUID, foreign key -> profiles.user_id, CASCADE delete)
- `handle` (String, unique, not null)
- `display_name` (String)
- `avatar_url` (Text)
- `bio` (Text)
- `persona` (Text) - Custom persona text for the Avee (up to 40k chars)
- `auto_research_enabled` (String) - Whether automatic web research was used ("true"/"false")
- `research_topic` (Text, nullable) - Topic that was researched for this agent
- `research_completed_at` (Timestamp with timezone, nullable) - When research completed
- `created_at` (Timestamp with timezone)

#### `avee_layers`
- `id` (UUID, primary key)
- `avee_id` (UUID, foreign key -> avees.id, CASCADE delete)
- `layer` (avee_layer ENUM: 'public', 'friends', 'intimate', not null)
- `system_prompt` (Text)
- `created_at` (Timestamp with timezone)

#### `relationships`
- `id` (UUID, primary key)
- `from_user_id` (UUID, foreign key -> profiles.user_id, CASCADE delete)
- `to_user_id` (UUID, foreign key -> profiles.user_id, CASCADE delete)
- `type` (relationship_type ENUM: 'follow', 'friend', 'block', not null)
- `created_at` (Timestamp with timezone)

#### `avee_permissions`
- `id` (UUID, primary key)
- `avee_id` (UUID, foreign key -> avees.id, CASCADE delete)
- `viewer_user_id` (UUID, foreign key -> profiles.user_id, CASCADE delete)
- `max_layer` (avee_layer ENUM: 'public', 'friends', 'intimate', not null, default 'public')
- `created_at` (Timestamp with timezone)

#### `conversations`
- `id` (UUID, primary key)
- `user_id` (UUID, not null) - Supabase user ID
- `agent_id` (String, not null) - Legacy field, kept for compatibility
- `avee_id` (UUID, foreign key -> avees.id, SET NULL, nullable)
- `layer_used` (avee_layer ENUM, not null, default 'public')
- `title` (Text)
- `created_at` (Timestamp with timezone)

#### `messages`
- `id` (UUID, primary key)
- `conversation_id` (UUID, foreign key -> conversations.id, CASCADE delete)
- `role` (String, not null) - 'user', 'assistant', or 'system'
- `content` (Text, not null)
- `layer_used` (avee_layer ENUM, not null, default 'public')
- `created_at` (Timestamp with timezone)

#### `documents`
- `id` (UUID, primary key)
- `owner_user_id` (UUID, not null)
- `avee_id` (UUID, foreign key -> avees.id, CASCADE delete, nullable)
- `layer` (avee_layer ENUM, not null, default 'public')
- `title` (Text)
- `content` (Text, not null)
- `source` (Text)
- `created_at` (Timestamp with timezone)

#### `document_chunks`
- `id` (UUID, primary key)
- `document_id` (UUID, foreign key -> documents.id, CASCADE delete)
- `avee_id` (UUID, foreign key -> avees.id, CASCADE delete)
- `layer` (avee_layer ENUM, not null, default 'public')
- `chunk_index` (Integer, not null)
- `content` (Text, not null)
- `embedding` (vector) - pgvector column for embeddings
- `created_at` (Timestamp with timezone)

## 🔌 API Endpoints

All endpoints require authentication via Supabase JWT token in the `Authorization: Bearer <token>` header unless otherwise specified.

### Health & Debug
- `GET /health` - Health check, returns `{"ok": true}`
- `GET /debug/db-test` - Database connectivity test

### Profiles
- `GET /me/profile`
  - Get current user's profile
  - Returns: Profile object with `user_id`, `handle`, `display_name`, `bio`, `avatar_url`, `created_at`

- `POST /me/profile?handle={handle}&display_name={name}&bio={bio}&avatar_url={url}`
  - Create or update user profile
  - Returns: `{"ok": true, "user_id": "...", "handle": "..."}`

### Agents (stored as `avees` in database)
- `POST /avees?handle={handle}&display_name={name}&bio={bio}&avatar_url={url}&auto_research={bool}&research_topic={topic}&research_max_sources={N}&research_layer={layer}`
  - Create a new agent (requires profile first)
  - **Automatic Web Research Parameters** (new in v0.5.1):
    - `auto_research` (boolean, default: false): Enable automatic web research
    - `research_topic` (string, optional): Topic to research (defaults to display_name or handle)
    - `research_max_sources` (int, default: 5): Number of web sources to scrape (3-10)
    - `research_layer` (string, default: "public"): Layer to store researched documents
  - When `auto_research=true`:
    - Agent is created immediately
    - Web research runs automatically (30-90 seconds)
    - Scrapes content from multiple sources (Wikipedia, news, blogs, etc.)
    - Automatically chunks, embeds, and stores content in knowledge base
    - Returns research results in response
  - Returns: `{"id": "...", "handle": "...", "research": {"completed": true, "documents_added": N, "total_chunks": N, ...}}`

- `GET /avees/{handle}`
  - Get agent by handle (public endpoint, no auth required)
  - Returns: Agent details

- `GET /me/avees`
  - List all agents owned by authenticated user
  - Returns: Array of agent objects

- `PATCH /avees/{avee_id}`
  - Update agent persona (owner only)
  - Body: `{"persona": "custom persona text..."}`
  - Persona max length: 40,000 characters
  - Returns: `{"ok": true, "avee_id": "..."}`

- `DELETE /avees/{avee_id}`
  - Delete an agent and all its associated data (owner only)
  - Returns: `{"ok": true, "message": "Avee deleted successfully"}`

- `GET /avees/{avee_id}/permissions`
  - List all permissions for an agent (owner only)
  - Returns: Array of permission objects with `viewer_user_id` and `max_layer`

- `POST /avees/{avee_id}/documents?layer={layer}&content={content}&title={title}`
  - Add training document to an agent
  - Automatically chunks and embeds the content
  - Returns: `{"ok": true, "document_id": "...", "chunks": N, "layer": "..."}`

- `POST /avees/{avee_id}/permissions?viewer_user_id={uuid}&max_layer={layer}`
  - Set permission for a viewer (owner only)
  - `max_layer` must be one of: 'public', 'friends', 'intimate'
  - Returns: `{"ok": true, ...}`

- `POST /avees/{avee_id}/grant-access-to-follower?follower_user_id={uuid}&max_layer={layer}`
  - Grant access to a specific follower (owner only)
  - Returns: `{"ok": true, "avee_id": "...", "viewer_user_id": "...", "max_layer": "..."}`

- `DELETE /avees/{avee_id}/permissions?viewer_user_id={uuid}`
  - Delete permission for a viewer (owner only)
  - Returns: `{"ok": true}`

- `GET /avees/{avee_id}/followers-with-access`
  - List all followers and their access levels (owner only)
  - Returns: Array with followers and their current access permissions

- `POST /avees/{avee_id}/generate-insights`
  - Generate AI-powered insights about an agent based on conversation history (owner only)
  - Returns: AI analysis of communication style, common topics, values, etc.

### Relationships
- `POST /relationships/follow?to_user_id={uuid}`
  - Follow a user by user ID
  - Returns: `{"ok": true}`

- `POST /relationships/follow-by-handle?handle={handle}`
  - Follow a user by profile handle
  - Returns: `{"ok": true}`

- `GET /network/following-avees`
  - List all agents owned by users you follow
  - Returns: Array of agent objects with owner information

### Agent Following
- `POST /agents/follow/{avee_id}`
  - Follow a specific agent by ID
  - Returns: `{"ok": true}`

- `POST /agents/follow-by-handle/{handle}`
  - Follow a specific agent by handle
  - Returns: `{"ok": true}`

- `DELETE /agents/unfollow/{avee_id}`
  - Unfollow an agent
  - Returns: `{"ok": true}`

- `GET /agents/search?query={query}&exclude_followed={true|false}&limit={N}`
  - Search for agents by handle or display name
  - `exclude_followed`: if true, excludes agents you're already following
  - Returns: Array of matching agents with owner info

- `GET /agents/following`
  - List all agents you're following
  - Returns: Array of followed agents with details

- `GET /agents/{avee_id}/followers`
  - List all followers of a specific agent
  - Returns: Array of users following this agent

### Conversations

#### Legacy Endpoints
- `POST /conversations?agent_id={agent_id}`
  - Create conversation with legacy agent_id (kept for compatibility)
  - Returns: `{"id": "..."}`

- `POST /conversations/{conversation_id}/messages?role={role}&content={content}`
  - Add message to conversation
  - `role` must be: 'user', 'assistant', or 'system'
  - Returns: `{"id": "...", "layer_used": "..."}`

- `GET /conversations/{conversation_id}/messages`
  - List all messages in conversation
  - Returns: Array of message objects with `role`, `content`, `layer_used`, `created_at`

- `GET /me/conversations`
  - List user's conversations
  - Returns: Array of conversation summaries

#### Agent-based Conversations
- `POST /conversations/with-avee?avee_id={uuid}`
  - Create or reuse conversation with an agent
  - Automatically resolves layer based on permissions
  - Returns: `{"id": "...", "avee_id": "...", "layer_used": "..."}`

### RAG & Chat
- `POST /rag/search?conversation_id={uuid}&query={query}&k={k}`
  - Search for relevant document chunks using RAG
  - `k` defaults to 5
  - Returns: `{"conversation_id": "...", "avee_id": "...", "allowed_layer": "...", "results": [...]}`

- `POST /chat/ask?conversation_id={uuid}&question={question}`
  - Ask a question and get AI response using RAG
  - Question max length: 4,000 characters
  - Automatically searches for relevant context via pgvector
  - Loads custom persona from agent's persona field
  - Uses multi-layered prompt system (layer prompt + persona + rules + context)
  - Stores both user question and assistant response
  - Returns: `{"conversation_id": "...", "layer_used": "...", "answer": "...", "used_chunks": N, "used_persona": true/false}`

- `POST /chat/stream?conversation_id={uuid}&question={question}`
  - Same as `/chat/ask` but streams the response in real-time
  - Returns: Server-sent events (SSE) stream with response chunks

## 🔬 Automatic Web Research

### Overview

The automatic web research feature allows you to bootstrap an agent's knowledge base by automatically gathering, processing, and storing information from the web. This is particularly useful for:

- **Public Figures**: Create agents for celebrities, politicians, historical figures
- **Brands**: Build agents representing companies and products
- **Topics**: Create expert agents on specific subjects (AI, climate change, etc.)
- **Quick Prototyping**: Instantly give agents real-world knowledge without manual document upload

### How It Works

1. **Agent Creation**: When creating an agent, set `auto_research=true`
2. **Search**: System searches the web using DuckDuckGo, Google, or SerpAPI
3. **Scraping**: Downloads and extracts text from relevant URLs
4. **Processing**: 
   - Cleans and structures the content
   - Chunks text into ~1200 character segments
   - Generates embeddings using OpenAI
5. **Storage**: Saves documents and chunks to database with vector embeddings
6. **Ready**: Agent can now answer questions using the researched knowledge

### Search Providers

The system tries providers in this order:

1. **SerpAPI** (if `SERPAPI_KEY` is set)
   - ✅ Best results and reliability
   - ✅ Fast response times
   - ❌ Paid service (~$50/month for 5,000 queries)

2. **Google Custom Search** (if `GOOGLE_SEARCH_API_KEY` is set)
   - ✅ Free tier: 100 queries/day
   - ✅ Good quality results
   - ❌ Limited to 10 results per query

3. **DuckDuckGo** (default, no configuration needed)
   - ✅ Works out-of-the-box
   - ✅ No API key required
   - ✅ Privacy-focused
   - ⚠️ May be rate-limited occasionally
   - ⚠️ Fewer results than paid options

### Usage Examples

#### Via Frontend (Recommended)
1. Go to `/my-agents` page
2. Click "Create New Agent"
3. Fill in handle and display name
4. Toggle ON "Automatic Web Research"
5. Enter research topic (or leave blank to use display name)
6. Set max sources (3-10, default: 5)
7. Click "Create Agent"
8. Wait 30-90 seconds for research to complete

#### Via API
```bash
# Create agent with automatic research
curl -X POST "http://localhost:8000/avees?handle=tesla&display_name=Tesla&auto_research=true&research_topic=Tesla%20Inc&research_max_sources=5" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Response includes research results:
# {
#   "id": "...",
#   "handle": "tesla",
#   "research": {
#     "completed": true,
#     "topic": "Tesla Inc",
#     "documents_added": 4,
#     "total_chunks": 22,
#     "layer": "public"
#   }
# }
```

### Configuration (Optional)

Add to `backend/.env` for enhanced results:

```env
# Option 1: Google Custom Search (Free tier: 100 queries/day)
GOOGLE_SEARCH_API_KEY=your_google_api_key
GOOGLE_SEARCH_ENGINE_ID=your_search_engine_id

# Option 2: SerpAPI (Paid, best results)
SERPAPI_KEY=your_serpapi_key
```

**Note**: The feature works perfectly without any configuration using DuckDuckGo!

### What Gets Scraped

The system intelligently selects and categorizes sources:

- **Encyclopedia**: Wikipedia, Wikimedia
- **News**: News sites, online magazines
- **Academic**: .edu domains, research papers
- **Blogs**: Medium, personal blogs
- **General**: Company websites, profiles

Some sources (like official brand websites) may block scrapers with 403 errors. This is normal and handled gracefully.

### Performance

- **Search Time**: 5-10 seconds
- **Scraping Time**: 20-60 seconds (depends on number of sources)
- **Total Time**: 30-90 seconds for 5 sources
- **Knowledge Generated**: Typically 10-20 chunks per source, ~50-100 chunks total

### Best Practices

1. **Research Topic**: 
   - For people: Use full name (e.g., "Elon Musk")
   - For brands: Include context (e.g., "Tesla Inc, electric cars")
   - For topics: Be specific (e.g., "Machine Learning in Healthcare")

2. **Number of Sources**:
   - 3-5 sources: Quick research, basic knowledge
   - 5-7 sources: Balanced depth and speed
   - 8-10 sources: Comprehensive, but slower

3. **Timeout Handling**:
   - Frontend has 90-second timeout
   - Don't close the page during research
   - If timeout occurs, agent is still created (research may fail)

### Troubleshooting

**"No sources found"**
- DuckDuckGo may be rate-limiting
- Try again in a few minutes
- Or configure Google/SerpAPI keys

**"Request timeout"**
- Reduce `research_max_sources` to 3
- Some websites are slow to load
- Try again with a different topic

**"403 Forbidden" errors in logs**
- Normal for official brand websites
- System continues with other sources
- Not an error, just informational

## 💡 How It Works

### Data Flow Overview

The application follows a clear data flow from user input to AI response, with RAG (Retrieval Augmented Generation) playing a central role in query processing. Below are detailed flow descriptions for each major operation.

### Quick Answer: RAG & Persona in Queries

**RAG Processing**: ✅ **YES, RAG is fully processed in queries**
- Every `/chat/ask` and `/rag/search` request performs vector similarity search
- Query is embedded using OpenAI, then matched against document chunks via pgvector
- Layer-based filtering ensures users only see accessible content
- Retrieved chunks are used as context in AI responses

**Persona/System Prompts**: ✅ **FULLY IMPLEMENTED**
- RAG provides factual context from documents
- System prompts provide persona/behavior instructions
- **Current state**: Custom personas are stored in `Avee.persona` field and used in chat
- Each Avee can have its own unique persona text (up to 40k characters)
- Layer-based base prompts (public/friends/intimate) are combined with custom persona
- Persona rules prevent prompt injection and ensure character consistency

### Agent Creation Flow

1. User creates a profile with a handle
2. User creates an agent with a unique handle
3. System automatically creates three `AveeLayer` entries (public, friends, intimate) in the database
   - **Note**: `system_prompt` field is created but set to `None` (not currently used)
4. Owner gets `intimate` permission by default via `AveePermission` record

### Document Training Flow

1. Owner adds a document to an agent at a specific layer via `POST /avees/{avee_id}/documents`
2. Document content is stored in `documents` table with layer metadata
3. Document is chunked into ~1200 character segments with 120 character overlap using `chunk_text()` from `rag_utils.py`
4. Each chunk is embedded using OpenAI `text-embedding-3-small` model via `embed_texts()` from `openai_embed.py`
5. Embeddings are stored in PostgreSQL `document_chunks` table as pgvector `vector` type
6. Each chunk record includes: `document_id`, `avee_id`, `layer`, `chunk_index`, `content`, and `embedding` (vector)

### Conversation Flow

1. User creates conversation with an agent via `POST /conversations/with-avee`
2. System resolves maximum accessible layer based on permissions (see Permission Resolution below)
3. Conversation is created with `avee_id` and `layer_used` fields set
4. If conversation already exists with same user + agent, it's reused (MVP ergonomics)
5. All messages are stored with the `layer_used` context for audit/tracking

### RAG Search Flow (Query Processing)

**Endpoint**: `POST /rag/search`

RAG is **actively processed** in queries through the following steps:

1. **Query Embedding**: User's query text is embedded using OpenAI `text-embedding-3-small`
   ```python
   q_vec = embed_texts([query.strip()])[0]
   ```

2. **Vector Similarity Search**: PostgreSQL pgvector performs cosine similarity search
   ```sql
   SELECT dc.content, dc.layer, 1 - (dc.embedding <=> :qvec::vector) as score
   FROM document_chunks dc
   WHERE dc.avee_id = :avee_id
   ORDER BY dc.embedding <=> :qvec::vector ASC
   ```

3. **Layer Filtering**: SQL query filters chunks based on conversation's `layer_used`:
   - `public` layer: only `public` chunks
   - `friends` layer: `public` + `friends` chunks  
   - `intimate` layer: all chunks (`public`, `friends`, `intimate`)

4. **Top K Retrieval**: Returns top K most similar chunks (default K=5) with similarity scores

5. **Response**: Returns chunk content, layer, document_id, and similarity scores

### Chat Flow (Complete Query-to-Response Pipeline)

**Endpoint**: `POST /chat/ask`

This is the primary conversation endpoint that combines RAG retrieval with AI response generation:

1. **Input Validation**: Validates conversation exists, user has access, and conversation has an `avee_id`

2. **RAG Processing** (same as RAG Search Flow above):
   - Query is embedded
   - Vector similarity search finds top 5 relevant chunks
   - Layer filtering applied based on `conversation.layer_used`

3. **Context Assembly**: Retrieved chunks are concatenated into context string
   ```python
   context = "\n".join(r[0] for r in rows) if rows else ""
   ```

4. **Agent Persona Loading**: Fetches custom persona text from agent's `persona` field
   ```python
   a = db.query(Avee).filter(Avee.id == convo.avee_id).first()
   persona_text = (a.persona or "").strip()
   ```

5. **System Prompt Construction**: Multi-layered prompt system:
   - **Layer Prompt**: Base behavior for access level
     - `public`: "You are the public version of this person. Be factual, helpful, and safe."
     - `friends`: "You are speaking as a trusted friend. Be warm, honest, and respectful."
     - `intimate`: "You are a close, intimate digital presence. Be personal, deep, and respectful."
   - **Custom Persona**: Owner-defined persona text from database (if set)
   - **Persona Rules**: Anti-jailbreak protection preventing prompt injection

6. **Message Construction**: Multi-part message array:
   ```python
   messages = [
       {"role": "system", "content": layer_prompt},           # Base layer behavior
       {"role": "system", "content": "PERSONA:\n" + persona_text},  # Custom persona (if exists)
       {"role": "system", "content": persona_rules},          # Anti-jailbreak rules
       {"role": "system", "content": "CONTEXT:\n" + context}, # RAG-retrieved chunks
       {"role": "user", "content": question},                 # User's question
   ]
   ```

7. **User Message Storage**: User's question is stored in `messages` table before API call

8. **OpenAI Completion**: Messages sent to OpenAI GPT-4o-mini
   ```python
   completion = client.chat.completions.create(model="gpt-4o-mini", messages=messages)
   ```

9. **Response Storage**: Assistant's response is stored in `messages` table with `layer_used`

10. **Return**: Response includes conversation_id, layer_used, answer, chunks used, and `used_persona` flag

### Permission Resolution

When a user interacts with an agent:
1. System checks `avee_permissions` table for viewer's `max_layer`
2. If no permission record exists, defaults to `'public'`
3. Owner always has `'intimate'` access (checked via `avee.owner_user_id == viewer_user_id`)
4. Resolved layer is used for:
   - `Conversation.layer_used` field
   - RAG search filtering (SQL WHERE clause)
   - System prompt selection (hardcoded mapping)

### Key Data Flow Points

**RAG Processing**: ✅ **YES** - RAG is fully integrated and processed in every `/chat/ask` and `/rag/search` query. Vector embeddings, similarity search, and layer filtering all work as designed.

**Persona/System Prompts**: ✅ **YES** - Custom personas are fully functional:
- Each agent has a `persona` field (Text, up to 40k chars) for custom persona definition
- Personas are loaded from database and injected into every chat response
- Multi-layered prompt system: base layer prompt + custom persona + anti-jailbreak rules + RAG context
- Owners can update personas via `PATCH /avees/{avee_id}` endpoint

## 📝 Usage Examples

### Creating an Agent and Training It

```bash
# 1. Create profile
curl -X POST "http://localhost:8000/me/profile?handle=johndoe&display_name=John%20Doe" \
  -H "Authorization: Bearer YOUR_TOKEN"

# 2a. Create Agent with Automatic Web Research (NEW!)
curl -X POST "http://localhost:8000/avees?handle=elon-musk&display_name=Elon%20Musk&auto_research=true&research_topic=Elon%20Musk&research_max_sources=5" \
  -H "Authorization: Bearer YOUR_TOKEN"
# This will:
# - Create the agent immediately
# - Automatically search the web for "Elon Musk"
# - Scrape 5 relevant sources (Wikipedia, news, etc.)
# - Extract, chunk, and embed the content
# - Store it in the agent's knowledge base
# - Takes 30-90 seconds to complete

# 2b. Or create Agent without web research (traditional way)
curl -X POST "http://localhost:8000/avees?handle=johns-agent&display_name=John's%20Agent" \
  -H "Authorization: Bearer YOUR_TOKEN"

# 3. Add training document manually
curl -X POST "http://localhost:8000/avees/AGENT_ID/documents?layer=public&content=John%20loves%20coding..." \
  -H "Authorization: Bearer YOUR_TOKEN"

# 4. Update agent persona
curl -X PATCH "http://localhost:8000/avees/AGENT_ID" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"persona": "I am a helpful coding assistant who loves to teach..."}'
```

### Having a Conversation

```bash
# 1. Create conversation
curl -X POST "http://localhost:8000/conversations/with-avee?avee_id=AGENT_ID" \
  -H "Authorization: Bearer YOUR_TOKEN"

# 2. Ask a question
curl -X POST "http://localhost:8000/chat/ask?conversation_id=CONV_ID&question=What%20do%20you%20like%20to%20do?" \
  -H "Authorization: Bearer YOUR_TOKEN"

# 3. Or use streaming
curl -X POST "http://localhost:8000/chat/stream?conversation_id=CONV_ID&question=Tell%20me%20more" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Social Features

```bash
# Follow an agent
curl -X POST "http://localhost:8000/agents/follow-by-handle/johns-agent" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Search for agents
curl -X GET "http://localhost:8000/agents/search?query=coding&exclude_followed=true" \
  -H "Authorization: Bearer YOUR_TOKEN"

# List followed agents
curl -X GET "http://localhost:8000/agents/following" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## ⚠️ Current Limitations & Notes

1. **Custom Personas**: ✅ **Fully Functional** - Each agent can have custom persona stored in `persona` field and used in chat

2. **RAG Processing**: ✅ **Fully Functional** - RAG is processed in all queries via vector similarity search with layer filtering

3. **Streaming Responses**: ✅ **Fully Functional** - Real-time streaming chat responses via SSE

4. **Agent Following**: ✅ **Fully Functional** - Users can follow specific agents and discover new ones

5. **Database Terminology**: 
   - Database tables use `avees` and `avee_*` naming for legacy/technical reasons
   - User-facing terminology in frontend uses "Agents" for clarity
   - Both terms refer to the same concept: AI digital twins

6. **Database Schema**: 
   - Requires `agent_follower` table for agent following feature
   - Run migrations in `backend/migrations/` to ensure all tables exist
   - The `Avee` model includes a `persona` TEXT column

7. **Legacy Code**: The Streamlit frontend (`app.py`) and related files are legacy POC code and not integrated with the new backend

8. **Database ENUMs**: Requires PostgreSQL ENUM types (`avee_layer`, `relationship_type`) to be created in the database

9. **pgvector**: Requires pgvector extension to be installed in PostgreSQL

10. **CORS**: Currently configured for localhost:3000 - update `allow_origins` in `backend/main.py` for production

11. **Frontend**: Next.js frontend features:
    - Home feed (`/app`)
    - Agent management (`/my-agents`)
    - Profile page (`/profile`)
    - Network/discovery (`/network`)
    - Notifications (`/notifications`)
    - Chat interface (`/chat/[handle]`)

12. **Database Connection**: If experiencing timeout errors with IPv6 addresses, update DATABASE_URL to use Supabase's direct connection or session pooler on port 5432

## 🔮 Future Enhancements

Potential improvements:
- ✅ ~~Add streaming responses for chat~~ (DONE - v0.5.0)
- ✅ ~~Add search/discovery features for public agents~~ (DONE - v0.5.0)
- ✅ ~~Add agent following system~~ (DONE - v0.5.0)
- ✅ ~~Add notifications system~~ (DONE - v0.5.0)
- Add conversation history retrieval endpoints (retrieve full message history)
- Add document deletion/update endpoints
- Add agent update endpoints (edit handle, display_name, bio, avatar_url - currently only persona can be updated)
- Add per-layer persona customization using `AveeLayer.system_prompt` (currently only base persona is used)
- Production CORS configuration
- Enhanced error handling and validation
- Rate limiting and API throttling
- Analytics and usage tracking
- Conversation title auto-generation
- Message reactions/feedback system
- Agent insights and analytics
- Multi-modal support (images, audio, etc.)
- Agent-to-agent conversations
- Collaborative agents (multiple users training one agent)

---

**Version**: 0.5.1  
**Status**: Active Development  
**Last Updated**: December 2024

## 🎉 What's New in v0.5.1

### 🔬 Automatic Web Research Feature
- ✅ **Bootstrap Agent Knowledge Automatically**: Create agents with instant knowledge from the web
- ✅ **Multi-Source Research**: Automatically searches and scrapes from:
  - Wikipedia (encyclopedia content)
  - News sites (current information)
  - Blogs and articles (in-depth analysis)
  - Academic sources (research papers)
- ✅ **Multiple Search Providers**:
  - **DuckDuckGo**: Works out-of-the-box, no API key required
  - **Google Custom Search**: 100 free queries/day with API key
  - **SerpAPI**: Paid service with best results
- ✅ **Smart Content Processing**:
  - Automatic chunking and embedding
  - Source classification (news, encyclopedia, blog, etc.)
  - Handles blocked sources gracefully (e.g., official brand websites)
- ✅ **Frontend Integration**:
  - Toggle for automatic research in agent creation form
  - Configurable number of sources (3-10)
  - Custom research topic field
  - 90-second timeout for research completion
  - Real-time progress feedback

### Bug Fixes
- ✅ Fixed request timeout issue (increased from 15s to 90s for web research)
- ✅ Fixed handle validation to allow underscores (`_`)
- ✅ Installed missing dependencies (`beautifulsoup4`, `requests`)
- ✅ Added user-friendly wait messages during research

## 🎉 What's New in v0.5.0

### Major Features
- ✅ **Agent Following System**: Follow specific agents (not just users) to get updates
- ✅ **Agent Search & Discovery**: Search for agents by handle/name, exclude followed agents
- ✅ **Streaming Chat Responses**: Real-time SSE streaming for chat with `/chat/stream` endpoint
- ✅ **Modern UI Update**: 
  - Home feed page (`/app`) with agent updates
  - Network page (`/network`) for discovery
  - Notifications page (`/notifications`)
  - Terminology update: "Avee" → "Agent" in user-facing text
- ✅ **Agent Management**: 
  - Delete agents with CASCADE cleanup
  - Grant access to specific followers
  - List followers with access levels
  - Generate AI insights from conversation history

### API Improvements
- ✅ **New Endpoints**:
  - `POST /agents/follow/{avee_id}` - Follow agent by ID
  - `POST /agents/follow-by-handle/{handle}` - Follow agent by handle
  - `DELETE /agents/unfollow/{avee_id}` - Unfollow agent
  - `GET /agents/search` - Search agents with filters
  - `GET /agents/following` - List followed agents
  - `GET /agents/{avee_id}/followers` - List agent followers
  - `POST /chat/stream` - Streaming chat responses
  - `POST /avees/{avee_id}/generate-insights` - AI insights
  - `DELETE /avees/{avee_id}` - Delete agent

### Previous Features (v0.4.0)
- ✅ **Custom Persona System**: Each agent has customizable persona (up to 40k chars)
- ✅ **Multi-layered Prompts**: Layer prompt + custom persona + anti-jailbreak rules + RAG context
- ✅ **RAG with pgvector**: Full vector similarity search with layer filtering
- ✅ **Three-tier Privacy**: Public/friends/intimate access control

### Technical Details
- Database: PostgreSQL + pgvector extension
- Backend: FastAPI with Supabase auth
- Frontend: Next.js 16 + TypeScript + Tailwind CSS 4
- AI: OpenAI GPT-4o-mini + text-embedding-3-small
