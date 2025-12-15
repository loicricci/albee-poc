# Gabee - Personal Digital Twin POC

A proof-of-concept application that creates AI-powered "digital twins" - personalized agents that can chat with users using persona definitions, knowledge bases, and conversational memory.

## 🎯 Overview

Gabee is a conversational AI platform that allows users to interact with personalized agents (digital twins). Each agent has:
- A **persona** defined in markdown files
- A **knowledge base** built from documents and contributions
- **Conversational memory** via PostgreSQL database
- **RAG (Retrieval Augmented Generation)** for context-aware responses
- **URL scraping** capabilities to analyze web content

Currently, the platform includes two demo agents:
- **LOÏC-GABEE**: Loïc's personal digital twin
- **VICTOR HUGO**: A literary agent based on Victor Hugo's works

## 🏗️ Architecture

The product consists of two main components:

### Frontend: Streamlit Web App (`app.py`)
- Retro terminal-style UI with dark green theme
- Real-time streaming chat interface
- Agent selection dropdown
- Knowledge base management
- Contribution form for adding new information

### Backend: FastAPI REST API (`backend/`)
- RESTful API for conversation management
- PostgreSQL database for storing conversations and messages
- Supabase authentication integration
- Session-based database connections

## 📁 Project Structure

```
gabee-poc/
├── app.py                          # Streamlit frontend application
├── agent.py                        # Agent engine (response generation, persona loading)
├── rag_multi.py                    # Multi-agent RAG system (in-memory embeddings)
├── url_scraper.py                  # URL extraction and web scraping
├── requirements.txt                # Root dependencies (Streamlit, OpenAI, etc.)
│
├── backend/                        # FastAPI backend
│   ├── __init__.py
│   ├── main.py                     # FastAPI app with REST endpoints
│   ├── db.py                       # SQLAlchemy database connection
│   ├── models.py                   # Database models (Conversation, Message)
│   ├── auth_supabase.py            # Supabase authentication
│   ├── deps.py                     # Dependency injection (empty)
│   ├── rag_pgvector.py             # Placeholder for pgvector RAG (empty)
│   ├── requirements.txt            # Backend dependencies
│   └── .env                        # Backend environment variables
│
└── data/                           # Knowledge base data
    ├── persona_loic.md             # Loïc's persona definition
    ├── contributions/              # User-contributed content for Loïc
    ├── victor_hugo/
    │   ├── persona_victor_hugo.md  # Victor Hugo persona
    │   └── books/                  # Literary works
    └── [other documents]           # Additional knowledge base files
```

## 🚀 Features

### Current Functionality

1. **Multi-Agent Chat Interface**
   - Select between different agents (Loïc, Victor Hugo)
   - Streaming responses with typing indicators
   - Conversation history management
   - Retro terminal aesthetic

2. **RAG (Retrieval Augmented Generation)**
   - In-memory vector embeddings using OpenAI `text-embedding-3-small`
   - Document chunking and semantic search
   - Per-agent knowledge base isolation
   - Automatic initialization on startup

3. **URL Scraping & Analysis**
   - Automatic URL detection in messages
   - Web content extraction with multiple fallback strategies
   - Support for meta tags, JSON-LD, and semantic HTML
   - Content analysis and context injection

4. **Knowledge Base Management**
   - Manual reload functionality
   - Contribution form for adding new information
   - Automatic indexing after contributions
   - Supports `.md` and `.txt` files

5. **Backend API** (FastAPI)
   - `POST /conversations` - Create new conversation
   - `POST /conversations/{id}/messages` - Add message to conversation
   - `GET /conversations/{id}/messages` - List messages in conversation
   - `GET /health` - Health check
   - `GET /debug/db-test` - Database connectivity test

6. **Authentication & Authorization**
   - Supabase JWT token validation
   - User-scoped conversations
   - Ownership checks for conversation access

## 🛠️ Tech Stack

### Frontend
- **Streamlit 1.31.1** - Web app framework
- **OpenAI API** - GPT-4o-mini for chat completions
- **BeautifulSoup4** - HTML parsing for URL scraping

### Backend
- **FastAPI 0.115.0** - REST API framework
- **SQLAlchemy 2.0.34** - ORM and database management
- **PostgreSQL** (via `psycopg[binary]`) - Database
- **Supabase** - Authentication provider
- **httpx** - HTTP client for Supabase API calls

### Data Processing
- **OpenAI Embeddings API** - Vector embeddings for RAG
- **In-memory storage** - Current RAG implementation (not persistent)

## 📋 Setup Instructions

### Prerequisites
- Python 3.8+
- PostgreSQL database
- Supabase project (for authentication)
- OpenAI API key

### Frontend Setup

1. **Clone and navigate to project**
   ```bash
   cd gabee-poc
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

4. **Create root `.env` file**
   ```env
   OPENAI_API_KEY=your_openai_api_key_here
   ```

5. **Prepare data directory**
   - Ensure `data/` directory exists with persona files
   - Add documents to be indexed (`.md` or `.txt` files)

6. **Run Streamlit app**
   ```bash
   streamlit run app.py
   ```
   App will open at `http://localhost:8501`

### Backend Setup

1. **Navigate to backend directory**
   ```bash
   cd backend
   ```

2. **Create virtual environment (if separate)**
   ```bash
   python -m venv venv
   source venv/bin/activate
   ```

3. **Install backend dependencies**
   ```bash
   pip install -r requirements.txt
   ```

4. **Create `backend/.env` file**
   ```env
   DATABASE_URL=postgresql://user:password@localhost:5432/gabee
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

5. **Initialize database**
   ```bash
   # Create tables (run Python script or use Alembic migrations)
   python -c "from backend.db import engine, Base; from backend.models import Conversation, Message; Base.metadata.create_all(engine)"
   ```

6. **Run FastAPI server**
   ```bash
   uvicorn backend.main:app --reload --port 8000
   ```
   API will be available at `http://localhost:8000`

## 🔧 Environment Variables

### Root `.env` (Frontend)
```env
OPENAI_API_KEY=sk-...              # Required: OpenAI API key for embeddings and chat
```

### `backend/.env` (Backend)
```env
DATABASE_URL=postgresql://...      # Required: PostgreSQL connection string
SUPABASE_URL=https://...           # Required: Supabase project URL
SUPABASE_ANON_KEY=...              # Required: Supabase anonymous key
```

## 📊 Database Schema

### `conversations` table
- `id` (UUID, primary key)
- `user_id` (UUID, not null) - Supabase user ID
- `agent_id` (String, not null) - Agent identifier (e.g., "loic", "victor_hugo")
- `title` (Text, nullable)
- `created_at` (Timestamp with timezone)

### `messages` table
- `id` (UUID, primary key)
- `conversation_id` (UUID, foreign key -> conversations.id, CASCADE delete)
- `role` (String, not null) - "user", "assistant", or "system"
- `content` (Text, not null)
- `created_at` (Timestamp with timezone)

## 🔌 API Endpoints

### Health & Debug
- `GET /health` - Returns `{"ok": true}`
- `GET /debug/db-test` - Tests database connectivity

### Conversations
- `POST /conversations?agent_id={agent_id}`
  - Creates a new conversation for the authenticated user
  - Requires: Bearer token (Supabase JWT)
  - Returns: `{"id": "conversation-uuid"}`

- `GET /conversations/{conversation_id}/messages`
  - Lists all messages in a conversation
  - Requires: Bearer token, ownership of conversation
  - Returns: Array of message objects with `role`, `content`, `created_at`

- `POST /conversations/{conversation_id}/messages?role={role}&content={content}`
  - Adds a message to a conversation
  - Requires: Bearer token, ownership of conversation
  - Valid roles: "user", "assistant", "system"
  - Returns: `{"id": "message-uuid"}`

All endpoints require authentication via Supabase JWT token in the `Authorization: Bearer <token>` header.

## 💡 How It Works

### Agent Response Generation Flow

1. **User Input Processing**
   - User sends message through Streamlit UI
   - URLs are detected and scraped
   - Message is added to conversation history

2. **Context Retrieval**
   - **RAG Search**: Query embedded and matched against knowledge base chunks
   - **URL Context**: Scraped content from URLs (if any)
   - **Conversation History**: Previous messages in the session

3. **Response Generation**
   - System prompts: Persona definition + RAG context + URL context
   - Conversation history appended
   - User message added
   - OpenAI GPT-4o-mini generates streaming response

4. **Response Display**
   - Tokens streamed to UI in real-time
   - Typing indicator shown during generation
   - Final response saved to conversation history

### RAG Implementation

Currently uses **in-memory** vector storage:
- Documents loaded from `data/` directories
- Chunked into ~1200 character segments
- Embedded using OpenAI `text-embedding-3-small`
- Cosine similarity search for retrieval
- **Note**: Not persistent - reloads on server restart

Future: `backend/rag_pgvector.py` placeholder for PostgreSQL + pgvector implementation.

### Authentication Flow

1. Frontend obtains Supabase JWT token from user login
2. Token sent in `Authorization: Bearer <token>` header
3. Backend validates token with Supabase `/auth/v1/user` endpoint
4. User ID extracted from Supabase response
5. Used for conversation ownership checks

## 🎨 UI Features

### Retro Terminal Theme
- Dark background (#020308)
- Green text (#c5f5c5)
- Monospace font (SF Mono, Menlo, Monaco)
- Scanline effects
- Glowing borders and buttons

### Interactive Elements
- **Agent Selector**: Dropdown to switch between agents
- **Chat Input**: Real-time streaming responses
- **Clear Conversation**: Button to reset chat history
- **Reload Knowledge Base**: Manual refresh of RAG index
- **Contribution Form**: Add new information to knowledge base

## 📝 Adding Content

### Via UI Contribution Form
1. Click "➕ ADD NEW CONTRIBUTION" expander
2. Fill in Title, Topic, Content, Email
3. Click "💾 SAVE CONTRIBUTION"
4. Content automatically indexed and available immediately

### Via File System
1. Add `.md` or `.txt` files to appropriate `data/` directory
2. Click "🔄 RELOAD KNOWLEDGE BASE" button
3. Or restart the application (auto-initializes on startup)

## ⚠️ Current Limitations

1. **RAG Storage**: In-memory only, not persistent across restarts
2. **Backend Integration**: Frontend (Streamlit) not yet connected to backend API
3. **Database**: Backend API exists but not used by Streamlit app
4. **Authentication**: Backend requires Supabase, frontend currently has no auth
5. **pgvector**: Placeholder exists but not implemented

## 🔮 Future Enhancements

See `PRODUCTION_ROADMAP.md` and `QUICK_PRODUCTION_START.md` for planned improvements including:
- PostgreSQL + pgvector for persistent vector storage
- Full frontend-backend integration
- Next.js frontend migration
- Multi-user support with proper authentication
- Real-time features (WebSockets)
- Production deployment setup

---

**Status**: POC / Development Build  
**Last Updated**: December 2024
