# Gabee POC → Production: Complete Architecture Guide

## Executive Summary

This document outlines the evolution of the Gabee POC (Streamlit-based "digital twin" chat) into a production-grade application. The roadmap covers architecture, technology stack, database design, deployment strategy, and scalability considerations.

---

## 📋 Current POC Architecture

### Tech Stack
- **Frontend**: Streamlit (Python-based UI)
- **Backend**: Python (agent.py, rag.py)
- **Storage**: Local JSON files (users/, data/)
- **Vector Search**: In-memory embeddings with OpenAI
- **Auth**: Simple username-based (no passwords)
- **Deployment**: Local Python process

### Core Features
1. ✅ User authentication & profiles
2. ✅ Conversation history persistence
3. ✅ RAG (Retrieval Augmented Generation) with embeddings
4. ✅ User profile learning & personalization
5. ✅ Conversation summarization for long chats
6. ✅ Document contribution system
7. ✅ Retro terminal UI aesthetic

### Current Limitations
- ❌ No real authentication/authorization
- ❌ No scalability (single-threaded, file-based)
- ❌ No real-time features
- ❌ Limited user management
- ❌ No analytics/monitoring
- ❌ No API for third-party integrations
- ❌ No mobile optimization

---

## 🎯 Production Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER                         │
├─────────────────────────────────────────────────────────────┤
│  Next.js Frontend (React)                                    │
│  - Server-Side Rendering (SSR)                               │
│  - Static Generation for marketing pages                     │
│  - Client-side routing                                       │
│  - Real-time WebSocket connections                           │
└─────────────────────┬───────────────────────────────────────┘
                      │ HTTPS/WSS
┌─────────────────────▼───────────────────────────────────────┐
│                      API GATEWAY LAYER                       │
├─────────────────────────────────────────────────────────────┤
│  Next.js API Routes / Separate FastAPI                       │
│  - Authentication middleware                                 │
│  - Rate limiting                                             │
│  - Request validation                                        │
│  - API versioning                                            │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│                    APPLICATION LAYER                         │
├─────────────────────────────────────────────────────────────┤
│  Backend Services (Python FastAPI/Node.js)                   │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │   Agent     │  │  RAG Engine  │  │    User      │       │
│  │  Service    │  │   Service    │  │  Management  │       │
│  └─────────────┘  └──────────────┘  └──────────────┘       │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│                      DATA LAYER                              │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  PostgreSQL  │  │   Pinecone/  │  │    Redis     │      │
│  │  (Primary    │  │   Weaviate   │  │  (Caching &  │      │
│  │   Database)  │  │  (Vector DB) │  │   Sessions)  │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │          S3/Cloud Storage (Documents & Media)        │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## 🛠 Technology Stack (Production)

### Frontend
```typescript
Framework:        Next.js 14+ (App Router)
Language:         TypeScript
UI Components:    shadcn/ui or Radix UI
Styling:          Tailwind CSS + CSS-in-JS for terminal theme
State Management: Zustand or React Context + SWR
Real-time:        Socket.io-client or native WebSockets
Forms:            React Hook Form + Zod validation
Animation:        Framer Motion (for terminal effects)
```

### Backend
```python
Primary API:      FastAPI (Python) - maintains compatibility with existing code
Alternative:      Next.js API Routes (TypeScript) - for simpler endpoints
Auth:             NextAuth.js (frontend) + JWT tokens
Task Queue:       Celery + Redis (for background jobs)
WebSockets:       FastAPI WebSocket or Socket.io
LLM Integration:  LangChain or LlamaIndex (for better orchestration)
```

### Database & Storage
```yaml
Primary Database:
  - PostgreSQL 15+ (managed: AWS RDS, Supabase, or Neon)
  - For: User accounts, conversations, profiles, metadata

Vector Database:
  - Pinecone (managed, easy start) OR
  - Weaviate (self-hosted option) OR
  - pgvector (PostgreSQL extension, simple setup)
  - For: Document embeddings, semantic search

Cache Layer:
  - Redis (Upstash for serverless or self-hosted)
  - For: Session storage, rate limiting, real-time presence

Object Storage:
  - AWS S3 / Cloudflare R2 / Vercel Blob
  - For: Uploaded documents, user avatars, exported data
```

### Infrastructure
```yaml
Hosting:
  Frontend: Vercel (Next.js optimized) or Netlify
  Backend:  Railway, Render, Fly.io, or AWS ECS
  Database: Managed services (RDS, Supabase, PlanetScale)

CDN: Cloudflare or Vercel Edge Network

Monitoring:
  - Sentry (error tracking)
  - PostHog or Mixpanel (analytics)
  - Datadog or New Relic (APM)

CI/CD: GitHub Actions

Environment: Docker containers for backend
```

---

## 📊 Database Schema (PostgreSQL)

### Core Tables

```sql
-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(100) UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    email_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    last_active_at TIMESTAMP,
    metadata JSONB DEFAULT '{}'::jsonb,
    settings JSONB DEFAULT '{}'::jsonb
);

-- User profiles (learned information)
CREATE TABLE user_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    learned_facts JSONB DEFAULT '[]'::jsonb,
    interests TEXT[] DEFAULT ARRAY[]::TEXT[],
    preferences JSONB DEFAULT '{}'::jsonb,
    context_summary TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Conversations
CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    archived_at TIMESTAMP,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Messages
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    tokens_used INTEGER,
    model_used VARCHAR(50),
    rag_context JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Conversation summaries (for long conversations)
CREATE TABLE conversation_summaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
    summary TEXT NOT NULL,
    messages_included INTEGER,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Documents (for RAG)
CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    filename VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    document_type VARCHAR(50),
    source VARCHAR(50),
    uploaded_by UUID REFERENCES users(id),
    is_public BOOLEAN DEFAULT FALSE,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Document chunks (for RAG)
CREATE TABLE document_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    chunk_index INTEGER NOT NULL,
    embedding_id VARCHAR(255), -- Reference to vector DB
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP DEFAULT NOW()
);

-- User contributions
CREATE TABLE contributions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    category VARCHAR(100),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    reviewed_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    reviewed_at TIMESTAMP
);

-- Usage analytics
CREATE TABLE usage_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_messages_conversation ON messages(conversation_id);
CREATE INDEX idx_messages_created ON messages(created_at);
CREATE INDEX idx_conversations_user ON conversations(user_id);
CREATE INDEX idx_conversations_updated ON conversations(updated_at);
CREATE INDEX idx_documents_type ON documents(document_type);
CREATE INDEX idx_chunks_document ON document_chunks(document_id);
CREATE INDEX idx_contributions_user ON contributions(user_id);
CREATE INDEX idx_contributions_status ON contributions(status);
CREATE INDEX idx_usage_logs_user ON usage_logs(user_id);
CREATE INDEX idx_usage_logs_created ON usage_logs(created_at);
```

### Vector Database Schema (Pinecone/Weaviate)

```python
# Pinecone index structure
{
    "namespace": "gabee-documents",
    "vectors": [
        {
            "id": "chunk_uuid",
            "values": [0.1, 0.2, ...],  # 1536-dim embedding
            "metadata": {
                "document_id": "uuid",
                "chunk_index": 0,
                "content": "chunk text",
                "document_type": "resume",
                "source": "upload",
                "is_public": True
            }
        }
    ]
}
```

---

## 🔐 Authentication & Authorization

### Authentication Flow

```typescript
// NextAuth.js configuration (app/api/auth/[...nextauth]/route.ts)

import NextAuth from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import GoogleProvider from "next-auth/providers/google"

export const authOptions = {
  providers: [
    // Email/Password
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        // Verify against your backend API
        const res = await fetch("http://your-api/auth/login", {
          method: 'POST',
          body: JSON.stringify(credentials),
          headers: { "Content-Type": "application/json" }
        })
        const user = await res.json()
        if (res.ok && user) {
          return user
        }
        return null
      }
    }),
    
    // OAuth providers
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.email = user.email
      }
      return token
    },
    async session({ session, token }) {
      session.user.id = token.id
      return session
    }
  }
}

export default NextAuth(authOptions)
```

### Backend Authentication (FastAPI)

```python
# backend/auth.py
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from datetime import datetime, timedelta

SECRET_KEY = os.getenv("JWT_SECRET_KEY")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

security = HTTPBearer()

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    token = credentials.credentials
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Could not validate credentials"
            )
        return user_id
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials"
        )
```

---

## 🏗 Frontend Architecture (Next.js)

### Project Structure

```
gabee-frontend/
├── app/
│   ├── (auth)/                    # Auth routes group
│   │   ├── login/
│   │   │   └── page.tsx
│   │   ├── register/
│   │   │   └── page.tsx
│   │   └── layout.tsx
│   ├── (dashboard)/               # Protected routes
│   │   ├── chat/
│   │   │   ├── [id]/
│   │   │   │   └── page.tsx       # Individual chat
│   │   │   └── page.tsx           # Chat list
│   │   ├── profile/
│   │   │   └── page.tsx
│   │   ├── discover/
│   │   │   └── page.tsx
│   │   ├── contribute/
│   │   │   └── page.tsx
│   │   └── layout.tsx
│   ├── api/                       # API routes
│   │   ├── auth/
│   │   │   └── [...nextauth]/
│   │   │       └── route.ts
│   │   ├── chat/
│   │   │   ├── route.ts
│   │   │   └── stream/
│   │   │       └── route.ts
│   │   └── rag/
│   │       └── route.ts
│   ├── layout.tsx                 # Root layout
│   ├── page.tsx                   # Landing page
│   └── globals.css
├── components/
│   ├── ui/                        # Base UI components (shadcn)
│   ├── chat/
│   │   ├── ChatWindow.tsx
│   │   ├── MessageBubble.tsx
│   │   ├── ChatInput.tsx
│   │   └── ChatSidebar.tsx
│   ├── terminal/
│   │   ├── TerminalHeader.tsx
│   │   ├── TerminalCore.tsx
│   │   └── Scanlines.tsx
│   └── layout/
│       ├── Navbar.tsx
│       └── Footer.tsx
├── lib/
│   ├── api.ts                     # API client
│   ├── auth.ts                    # Auth utilities
│   ├── websocket.ts               # WebSocket client
│   └── utils.ts
├── hooks/
│   ├── useChat.ts
│   ├── useWebSocket.ts
│   └── useAuth.ts
├── stores/
│   └── chatStore.ts               # Zustand store
├── types/
│   └── index.ts
└── public/
    └── assets/
```

### Key Components

#### Chat Window with Streaming

```typescript
// components/chat/ChatWindow.tsx
'use client'

import { useState, useEffect } from 'react'
import { useWebSocket } from '@/hooks/useWebSocket'

interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: Date
}

export function ChatWindow({ conversationId }: { conversationId: string }) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  
  const { socket, isConnected } = useWebSocket()
  
  useEffect(() => {
    if (!socket) return
    
    // Load conversation history
    loadMessages()
    
    // Listen for streaming responses
    socket.on('message_chunk', (chunk: string) => {
      setMessages(prev => {
        const last = prev[prev.length - 1]
        if (last?.role === 'assistant' && isStreaming) {
          return [
            ...prev.slice(0, -1),
            { ...last, content: last.content + chunk }
          ]
        }
        return prev
      })
    })
    
    socket.on('message_complete', () => {
      setIsStreaming(false)
    })
    
    return () => {
      socket.off('message_chunk')
      socket.off('message_complete')
    }
  }, [socket, conversationId])
  
  const loadMessages = async () => {
    const res = await fetch(`/api/chat/${conversationId}/messages`)
    const data = await res.json()
    setMessages(data.messages)
  }
  
  const sendMessage = async () => {
    if (!input.trim()) return
    
    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: input,
      timestamp: new Date()
    }
    
    setMessages(prev => [...prev, userMessage])
    setInput('')
    
    // Add placeholder for assistant response
    const assistantPlaceholder: Message = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: '',
      timestamp: new Date()
    }
    setMessages(prev => [...prev, assistantPlaceholder])
    setIsStreaming(true)
    
    // Send to backend via WebSocket
    socket?.emit('send_message', {
      conversationId,
      message: input
    })
  }
  
  return (
    <div className="flex flex-col h-screen bg-[#020308]">
      {/* Terminal header */}
      <TerminalHeader />
      
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
      </div>
      
      {/* Input */}
      <ChatInput
        value={input}
        onChange={setInput}
        onSend={sendMessage}
        disabled={isStreaming}
      />
    </div>
  )
}
```

#### WebSocket Hook

```typescript
// hooks/useWebSocket.ts
'use client'

import { useEffect, useState } from 'react'
import { io, Socket } from 'socket.io-client'
import { useSession } from 'next-auth/react'

export function useWebSocket() {
  const [socket, setSocket] = useState<Socket | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const { data: session } = useSession()
  
  useEffect(() => {
    if (!session?.user) return
    
    const socketInstance = io(process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000', {
      auth: {
        token: session.accessToken
      }
    })
    
    socketInstance.on('connect', () => {
      setIsConnected(true)
    })
    
    socketInstance.on('disconnect', () => {
      setIsConnected(false)
    })
    
    setSocket(socketInstance)
    
    return () => {
      socketInstance.disconnect()
    }
  }, [session])
  
  return { socket, isConnected }
}
```

---

## 🔧 Backend Services (FastAPI)

### Main Application

```python
# backend/main.py
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import uvicorn

from .database import init_db
from .routers import auth, chat, rag, users, contributions
from .websocket import ConnectionManager

manager = ConnectionManager()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await init_db()
    print("Database initialized")
    yield
    # Shutdown
    print("Shutting down...")

app = FastAPI(
    title="Gabee API",
    version="1.0.0",
    lifespan=lifespan
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "https://gabee.app"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(chat.router, prefix="/api/chat", tags=["chat"])
app.include_router(rag.router, prefix="/api/rag", tags=["rag"])
app.include_router(users.router, prefix="/api/users", tags=["users"])
app.include_router(contributions.router, prefix="/api/contributions", tags=["contributions"])

@app.get("/api/health")
async def health_check():
    return {"status": "healthy"}

# WebSocket endpoint
@app.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    user_id: str = Depends(verify_websocket_auth)
):
    await manager.connect(websocket, user_id)
    try:
        while True:
            data = await websocket.receive_json()
            await handle_websocket_message(data, user_id, manager)
    except WebSocketDisconnect:
        manager.disconnect(user_id)

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )
```

### Chat Router with Streaming

```python
# backend/routers/chat.py
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from typing import List
from uuid import UUID

from ..auth import get_current_user
from ..services.agent_service import AgentService
from ..models import Message, CreateMessageRequest

router = APIRouter()

@router.post("/conversations/{conversation_id}/messages")
async def create_message(
    conversation_id: UUID,
    request: CreateMessageRequest,
    user_id: str = Depends(get_current_user)
):
    """Create a new message in a conversation."""
    agent = AgentService(user_id)
    
    # Save user message
    user_message = await agent.save_user_message(
        conversation_id, 
        request.content
    )
    
    # Generate response
    response = await agent.generate_reply(
        conversation_id,
        request.content
    )
    
    # Save assistant message
    assistant_message = await agent.save_assistant_message(
        conversation_id,
        response
    )
    
    return {
        "user_message": user_message,
        "assistant_message": assistant_message
    }

@router.get("/conversations/{conversation_id}/messages")
async def get_messages(
    conversation_id: UUID,
    user_id: str = Depends(get_current_user)
):
    """Get all messages in a conversation."""
    # Verify user owns conversation
    agent = AgentService(user_id)
    messages = await agent.get_conversation_messages(conversation_id)
    return {"messages": messages}

@router.post("/conversations/{conversation_id}/stream")
async def stream_response(
    conversation_id: UUID,
    request: CreateMessageRequest,
    user_id: str = Depends(get_current_user)
):
    """Stream AI response token by token."""
    agent = AgentService(user_id)
    
    async def generate():
        async for chunk in agent.generate_reply_stream(
            conversation_id,
            request.content
        ):
            yield f"data: {chunk}\n\n"
    
    return StreamingResponse(
        generate(),
        media_type="text/event-stream"
    )
```

### Agent Service (Refactored from POC)

```python
# backend/services/agent_service.py
from typing import List, Dict, AsyncIterator
from uuid import UUID
import asyncio

from ..database import get_db
from ..repositories.conversation_repository import ConversationRepository
from ..repositories.user_repository import UserRepository
from .rag_service import RAGService
from .llm_service import LLMService

class AgentService:
    def __init__(self, user_id: str):
        self.user_id = user_id
        self.conversation_repo = ConversationRepository()
        self.user_repo = UserRepository()
        self.rag_service = RAGService()
        self.llm_service = LLMService()
    
    async def generate_reply(
        self,
        conversation_id: UUID,
        user_message: str
    ) -> str:
        """Generate a reply (non-streaming)."""
        
        # Get conversation history
        history = await self.conversation_repo.get_messages(conversation_id)
        
        # Get user profile for personalization
        user_profile = await self.user_repo.get_profile(self.user_id)
        
        # RAG search
        rag_context = await self.rag_service.search(user_message, k=4)
        
        # Build system prompt
        system_prompt = self._build_system_prompt(user_profile)
        
        # Generate response
        response = await self.llm_service.generate(
            system_prompt=system_prompt,
            conversation_history=history,
            rag_context=rag_context,
            user_message=user_message
        )
        
        # Update user profile asynchronously
        asyncio.create_task(
            self._update_user_profile(history, user_message)
        )
        
        return response
    
    async def generate_reply_stream(
        self,
        conversation_id: UUID,
        user_message: str
    ) -> AsyncIterator[str]:
        """Generate a streaming reply."""
        
        history = await self.conversation_repo.get_messages(conversation_id)
        user_profile = await self.user_repo.get_profile(self.user_id)
        rag_context = await self.rag_service.search(user_message, k=4)
        system_prompt = self._build_system_prompt(user_profile)
        
        async for chunk in self.llm_service.generate_stream(
            system_prompt=system_prompt,
            conversation_history=history,
            rag_context=rag_context,
            user_message=user_message
        ):
            yield chunk
    
    def _build_system_prompt(self, user_profile: Dict) -> str:
        """Build personalized system prompt."""
        # Load base persona
        with open("data/persona_loic.md") as f:
            base_persona = f.read()
        
        # Add user context
        if user_profile:
            interests = ", ".join(user_profile.get("interests", []))
            facts = user_profile.get("learned_facts", [])
            
            user_context = f"\n\n**About this user:**\n"
            if interests:
                user_context += f"- Interests: {interests}\n"
            if facts:
                user_context += f"- Facts: {facts[-5:]}\n"
            
            return base_persona + user_context
        
        return base_persona
    
    async def _update_user_profile(
        self,
        history: List[Dict],
        new_message: str
    ):
        """Extract information from conversation and update profile."""
        # Use LLM to extract user information
        extraction_prompt = """
        Analyze the conversation and extract:
        1. User interests
        2. Personal facts
        3. Preferences
        
        Return as JSON.
        """
        
        # ... implementation
```

---

## 🚀 Deployment Strategy

### Option 1: Vercel + Railway (Recommended for Start)

**Pros:** Simple, fast deployment, great DX
**Cost:** ~$20-50/month to start

```yaml
Frontend (Vercel):
  - Automatic deployments from GitHub
  - Edge functions for API routes
  - Global CDN

Backend (Railway):
  - Deploy from GitHub
  - Managed PostgreSQL database
  - Easy environment variables
  - Auto-scaling

Vector DB:
  - Pinecone free tier (1M vectors)
  - Upgrade as needed

Storage:
  - Vercel Blob or AWS S3
```

### Option 2: AWS Complete Stack

**Pros:** Maximum control and scalability
**Cost:** ~$100-200/month minimum

```yaml
Frontend:
  - S3 + CloudFront (static hosting)
  - Or EC2/ECS with Next.js

Backend:
  - ECS Fargate (containerized FastAPI)
  - API Gateway for routing

Database:
  - RDS PostgreSQL (Multi-AZ for production)
  - ElastiCache Redis
  - OpenSearch or self-hosted Weaviate (vector DB)

Storage:
  - S3 for documents

Monitoring:
  - CloudWatch
  - AWS X-Ray
```

### Docker Setup

```dockerfile
# backend/Dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY . .

# Run migrations
CMD alembic upgrade head && \
    uvicorn main:app --host 0.0.0.0 --port 8000
```

```yaml
# docker-compose.yml
version: '3.8'

services:
  frontend:
    build: ./frontend
    ports:
      - "3000:3000"
    environment:
      - NEXT_PUBLIC_API_URL=http://backend:8000
    depends_on:
      - backend
  
  backend:
    build: ./backend
    ports:
      - "8000:8000"
    environment:
      - DATABASE_URL=postgresql://user:pass@postgres:5432/gabee
      - REDIS_URL=redis://redis:6379
      - OPENAI_API_KEY=${OPENAI_API_KEY}
    depends_on:
      - postgres
      - redis
  
  postgres:
    image: postgres:15-alpine
    volumes:
      - postgres_data:/var/lib/postgresql/data
    environment:
      - POSTGRES_DB=gabee
      - POSTGRES_USER=user
      - POSTGRES_PASSWORD=pass
  
  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
```

---

## 📈 Scalability Considerations

### 1. **Horizontal Scaling**
- Multiple backend instances behind load balancer
- Stateless design (sessions in Redis)
- WebSocket connections through Redis pub/sub

### 2. **Database Optimization**
- Read replicas for heavy read operations
- Connection pooling (PgBouncer)
- Partitioning for large tables (messages, logs)

### 3. **Caching Strategy**
```python
# Example: Cache user profiles
@cache.memoize(timeout=300)  # 5 minutes
async def get_user_profile(user_id: str):
    return await db.fetch_user_profile(user_id)

# Cache RAG results
@cache.memoize(timeout=3600)  # 1 hour
async def search_documents(query: str):
    return await rag_service.search(query)
```

### 4. **Async Background Jobs**
```python
# Use Celery for heavy operations
from celery import Celery

celery = Celery('gabee', broker='redis://localhost:6379/0')

@celery.task
def process_document_embeddings(document_id: str):
    # Generate embeddings for document chunks
    pass

@celery.task
def generate_conversation_summary(conversation_id: str):
    # Summarize long conversations
    pass
```

### 5. **CDN for Static Assets**
- Use Cloudflare or Vercel Edge for global distribution
- Cache document previews
- Optimize images/media

---

## 🔒 Security Best Practices

1. **Environment Variables**
   - Never commit secrets
   - Use secret management (AWS Secrets Manager, Vault)

2. **Rate Limiting**
   ```python
   from slowapi import Limiter, _rate_limit_exceeded_handler
   from slowapi.util import get_remote_address
   
   limiter = Limiter(key_func=get_remote_address)
   app.state.limiter = limiter
   
   @app.post("/api/chat")
   @limiter.limit("10/minute")
   async def chat_endpoint():
       pass
   ```

3. **Input Validation**
   ```python
   from pydantic import BaseModel, validator
   
   class MessageRequest(BaseModel):
       content: str
       
       @validator('content')
       def content_must_not_be_empty(cls, v):
           if not v.strip():
               raise ValueError('Message cannot be empty')
           if len(v) > 4000:
               raise ValueError('Message too long')
           return v
   ```

4. **SQL Injection Prevention**
   - Use parameterized queries (SQLAlchemy ORM)
   - Never string concatenation for SQL

5. **HTTPS Only**
   - Force HTTPS in production
   - Secure cookies
   - HSTS headers

---

## 📊 Monitoring & Analytics

### Key Metrics to Track

```typescript
// Frontend analytics
import { track } from '@/lib/analytics'

// User actions
track('message_sent', { conversation_id, message_length })
track('conversation_started', { user_id })
track('document_uploaded', { document_type })

// Performance
track('page_load_time', { page, duration })
track('api_response_time', { endpoint, duration })
```

### Backend Logging

```python
import structlog

logger = structlog.get_logger()

@app.middleware("http")
async def log_requests(request: Request, call_next):
    start_time = time.time()
    
    response = await call_next(request)
    
    duration = time.time() - start_time
    logger.info(
        "request_completed",
        method=request.method,
        path=request.url.path,
        status_code=response.status_code,
        duration=duration
    )
    
    return response
```

---

## 💰 Cost Estimation (Monthly)

### Starter Plan (~$50-100/month)
- Vercel Pro: $20
- Railway (backend + DB): $20-40
- Pinecone Starter: $70 (or free tier)
- Redis (Upstash): $10
- S3 storage: $5
- OpenAI API: Variable (depends on usage)

### Growth Plan (~$200-500/month)
- Vercel Team: $20/seat
- Railway/Render: $50-150
- Pinecone Standard: $70+
- Redis: $30-50
- RDS PostgreSQL: $50-100
- Monitoring (Sentry): $26
- OpenAI API: $100-200

### Enterprise Plan ($1000+/month)
- AWS full stack
- Dedicated instances
- Multi-region
- Advanced monitoring
- Custom SLAs

---

## 🎯 Migration Roadmap

### Phase 1: Foundation (2-3 weeks)
- [ ] Set up Next.js project with TypeScript
- [ ] Design and implement database schema
- [ ] Set up PostgreSQL and migrations (Alembic)
- [ ] Implement authentication (NextAuth + JWT)
- [ ] Create basic API structure (FastAPI)

### Phase 2: Core Features (3-4 weeks)
- [ ] Migrate RAG system to vector database
- [ ] Build chat UI with streaming
- [ ] Implement conversation management
- [ ] User profile system
- [ ] WebSocket real-time communication

### Phase 3: Enhanced Features (2-3 weeks)
- [ ] Document contribution system
- [ ] Advanced search and discovery
- [ ] User settings and preferences
- [ ] Export/import conversations
- [ ] Analytics dashboard

### Phase 4: Polish & Deploy (1-2 weeks)
- [ ] Testing (unit, integration, e2e)
- [ ] Performance optimization
- [ ] Security audit
- [ ] Deploy to production
- [ ] Set up monitoring and alerts

### Phase 5: Post-Launch (Ongoing)
- [ ] User feedback integration
- [ ] A/B testing
- [ ] Feature iterations
- [ ] Scale infrastructure as needed

---

## 📚 Additional Resources

### Documentation to Create
1. API Documentation (OpenAPI/Swagger)
2. Frontend Component Library (Storybook)
3. Database Schema Documentation
4. Deployment Runbook
5. Contributing Guidelines

### Tools for Development
- **API Testing**: Postman or Bruno
- **Database**: TablePlus or pgAdmin
- **Design**: Figma
- **Project Management**: Linear or GitHub Projects

---

## 🤔 Key Decisions to Make

1. **Vector Database Choice**
   - Pinecone: Easiest, managed, good for start
   - Weaviate: More control, self-hosted option
   - pgvector: Simplest, all-in-one with PostgreSQL

2. **Deployment Platform**
   - Vercel + Railway: Fastest to market
   - AWS: Most flexible, better for scale
   - Self-hosted: Maximum control, more work

3. **Backend Language**
   - Keep Python (FastAPI): Easier migration, reuse code
   - Switch to Node.js: Unified stack, easier for some devs

4. **Streaming Strategy**
   - WebSockets: More complex, better for real-time
   - Server-Sent Events (SSE): Simpler, good for one-way streaming
   - Both: WebSocket for chat, SSE for notifications

---

## 🎉 Conclusion

This roadmap provides a comprehensive path from your POC to production. The key is to:

1. **Start simple**: Use managed services (Vercel, Railway, Pinecone)
2. **Iterate quickly**: Deploy early, get feedback
3. **Scale progressively**: Move to more complex infrastructure as needed
4. **Monitor everything**: Logs, metrics, errors, user behavior

Your POC already has solid foundations. The main work is:
- Replacing file storage with proper databases
- Building a modern frontend with Next.js
- Adding proper authentication and security
- Setting up production infrastructure

**Recommended First Steps:**
1. Set up a Next.js + FastAPI starter project
2. Design and create the database schema
3. Migrate one feature at a time (start with chat)
4. Deploy to Vercel + Railway for testing
5. Iterate based on real usage

Good luck with your production build! 🚀





