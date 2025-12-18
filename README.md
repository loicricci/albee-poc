# Gabee - Social AI Platform

**Version**: 0.3.0

A social AI platform where users create and interact with personalized AI digital twins called "Avees". Each Avee has layer-based access control (public/friends/intimate) and uses RAG (Retrieval Augmented Generation) powered by PostgreSQL + pgvector for context-aware conversations.

## 🎯 Overview

Gabee enables users to:
- Create **Avees** (AI digital twins) with unique handles
- Train Avees with documents at different privacy layers
- Have conversations with Avees that respect layer-based permissions
- Follow other users and interact with their Avees
- Control who can access different layers of an Avee's knowledge

### Core Concepts

- **Avees**: AI digital twins created by users, each with a unique handle and customizable persona
- **Layers**: Three-tier privacy system:
  - `public`: Publicly accessible information
  - `friends`: Information accessible to friends/followers
  - `intimate`: Personal information for close connections
- **Profiles**: User profiles with handles, display names, and bios
- **Relationships**: Follow/friend system between users
- **Permissions**: Fine-grained access control determining which layer each viewer can access
- **Documents**: Training content added to Avees at specific layers
- **Conversations**: Chat sessions with Avees, automatically using the appropriate layer based on permissions

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
│   │   │   │   ├── profile/        # User profile page
│   │   │   │   ├── my-avees/       # Manage Avees
│   │   │   │   │   └── [handle]/   # Individual Avee management
│   │   │   │   ├── chat/           # Chat interface
│   │   │   │   │   └── [handle]/   # Chat with specific Avee
│   │   │   │   └── network/        # Social network/following
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

1. **Avees System**
   - Create Avees with unique handles
   - Three-layer privacy system (public/friends/intimate)
   - Per-layer system prompts for different interaction styles
   - Owner gets intimate access by default

2. **Document Management**
   - Add training documents to Avees at specific layers
   - Automatic chunking and embedding using OpenAI
   - pgvector storage for efficient similarity search
   - Layer-based filtering during retrieval

3. **RAG with pgvector**
   - PostgreSQL + pgvector for persistent vector storage
   - Cosine similarity search using `<=>` operator
   - Layer-aware filtering during search
   - Automatic embedding generation with OpenAI `text-embedding-3-small`

4. **Conversations**
   - Create conversations with Avees
   - Automatic layer resolution based on permissions
   - Layer-specific system prompts
   - Conversation history persistence

5. **Permissions & Access Control**
   - Set maximum accessible layer per viewer
   - Owner has full control
   - Default permissions (public for everyone)
   - Permission checks on all Avee operations

6. **Social Features**
   - User profiles with handles
   - Follow relationships between users
   - View and interact with other users' Avees

7. **Chat API**
   - Integrated RAG search for context
   - OpenAI GPT-4o-mini for response generation
   - Layer-appropriate responses
   - Automatic message storage

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

### Database Extensions
- **pgvector** - Vector similarity search extension for PostgreSQL

## 📋 Setup Instructions

### Prerequisites
- Python 3.8+
- Node.js 18+ and npm
- PostgreSQL 12+ with pgvector extension installed
- Supabase project (for authentication)
- OpenAI API key

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

   Note: You may also need to install OpenAI package:
   ```bash
   pip install openai
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

### Avees
- `POST /avees?handle={handle}&display_name={name}&bio={bio}&avatar_url={url}`
  - Create a new Avee (requires profile first)
  - Returns: `{"id": "...", "handle": "..."}`

- `GET /avees/{handle}`
  - Get Avee by handle (public endpoint, no auth required)
  - Returns: Avee details

- `GET /me/avees`
  - List all Avees owned by authenticated user
  - Returns: Array of Avee objects

- `POST /avees/{avee_id}/documents?layer={layer}&title={title}&content={content}&source={source}`
  - Add training document to an Avee
  - Automatically chunks and embeds the content
  - Returns: `{"ok": true, "document_id": "...", "chunks": N, "layer": "..."}`

- `POST /avees/{avee_id}/permissions?viewer_user_id={uuid}&max_layer={layer}`
  - Set permission for a viewer (owner only)
  - `max_layer` must be one of: 'public', 'friends', 'intimate'
  - Returns: `{"ok": true, ...}`

### Relationships
- `POST /relationships/follow?to_user_id={uuid}`
  - Follow a user
  - Returns: `{"ok": true}`

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

#### Avee-based Conversations
- `POST /conversations/with-avee?avee_id={uuid}`
  - Create or reuse conversation with an Avee
  - Automatically resolves layer based on permissions
  - Returns: `{"id": "...", "avee_id": "...", "layer_used": "..."}`

### RAG & Chat
- `POST /rag/search?conversation_id={uuid}&query={query}&k={k}`
  - Search for relevant document chunks using RAG
  - `k` defaults to 5
  - Returns: `{"conversation_id": "...", "avee_id": "...", "allowed_layer": "...", "results": [...]}`

- `POST /chat/ask?conversation_id={uuid}&question={question}`
  - Ask a question and get AI response using RAG
  - Automatically searches for relevant context
  - Uses layer-appropriate system prompt
  - Stores assistant message automatically
  - Returns: `{"conversation_id": "...", "layer_used": "...", "answer": "...", "used_chunks": N}`

## 💡 How It Works

### Avee Creation Flow

1. User creates a profile with a handle
2. User creates an Avee with a unique handle
3. System automatically creates three layer entries (public, friends, intimate)
4. Owner gets intimate permission by default

### Document Training Flow

1. Owner adds a document to an Avee at a specific layer
2. Document is chunked into ~1200 character segments with overlap
3. Each chunk is embedded using OpenAI `text-embedding-3-small`
4. Embeddings are stored in PostgreSQL as pgvector columns
5. Chunks are linked to the document and Avee

### Conversation Flow

1. User creates conversation with an Avee
2. System resolves maximum accessible layer based on permissions
3. Conversation is tagged with the resolved layer
4. Messages are stored with the layer context

### RAG Search Flow

1. Query is embedded using OpenAI
2. pgvector similarity search finds relevant chunks
3. Layer filtering ensures user only sees accessible content:
   - `public` layer: only public chunks
   - `friends` layer: public + friends chunks
   - `intimate` layer: all chunks
4. Top K chunks returned with similarity scores

### Chat Flow

1. User asks a question
2. RAG search finds relevant context chunks
3. System prompt selected based on layer:
   - `public`: "You are the public version of this person. Be factual and safe."
   - `friends`: "You are speaking as a trusted friend. Be warmer but respectful."
   - `intimate`: "You are a close, intimate digital presence. Be personal and deep."
4. Context chunks + system prompt + question sent to OpenAI
5. Response generated and stored as assistant message

### Permission Resolution

When a user interacts with an Avee:
1. System checks `avee_permissions` table for viewer's max_layer
2. If no permission exists, defaults to 'public'
3. Owner always has 'intimate' access (checked separately)
4. Resolved layer is used for:
   - Conversation layer_used
   - RAG search filtering
   - System prompt selection

## 📝 Usage Examples

### Creating an Avee and Training It

```bash
# 1. Create profile
curl -X POST "http://localhost:8000/me/profile?handle=johndoe&display_name=John%20Doe" \
  -H "Authorization: Bearer YOUR_TOKEN"

# 2. Create Avee
curl -X POST "http://localhost:8000/avees?handle=johns-avee&display_name=John's%20Avee" \
  -H "Authorization: Bearer YOUR_TOKEN"

# 3. Add training document
curl -X POST "http://localhost:8000/avees/AVE_ID/documents?layer=public&content=John%20loves%20coding..." \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Having a Conversation

```bash
# 1. Create conversation
curl -X POST "http://localhost:8000/conversations/with-avee?avee_id=AVE_ID" \
  -H "Authorization: Bearer YOUR_TOKEN"

# 2. Ask a question
curl -X POST "http://localhost:8000/chat/ask?conversation_id=CONV_ID&question=What%20do%20you%20like%20to%20do?" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## ⚠️ Current Limitations & Notes

1. **Legacy Code**: The Streamlit frontend (`app.py`) and related files are legacy POC code and not integrated with the new backend

2. **Database ENUMs**: Requires PostgreSQL ENUM types (`avee_layer`, `relationship_type`) to be created in the database - if using Supabase, these may already exist

3. **pgvector**: Requires pgvector extension to be installed in PostgreSQL

4. **CORS**: Currently configured for localhost:3000 - update `allow_origins` in `backend/main.py` for production

5. **Frontend**: Next.js frontend is actively being developed with authentication, profile management, Avee management, and chat features

## 🔮 Future Enhancements

Potential improvements:
- Add conversation history retrieval endpoints
- Add user message storage in chat/ask endpoint
- Add streaming responses for chat
- Add document deletion/update endpoints
- Add Avee update endpoints
- Add relationship management (unfollow, etc.)
- Add search/discovery features for public Avees
- Production CORS configuration
- Enhanced error handling and validation
- Rate limiting
- Analytics and usage tracking

---

**Version**: 0.3.0  
**Status**: Active Development  
**Last Updated**: December 2024
