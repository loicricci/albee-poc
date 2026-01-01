"""
Advanced context management for AI conversations.

This module provides intelligent context window management, semantic memory extraction,
and dynamic context pruning to optimize LLM performance and cost.
"""

import os
from typing import List, Dict, Tuple, Optional
from datetime import datetime, timedelta, timezone
from openai import OpenAI
from sqlalchemy.orm import Session
from sqlalchemy import text
import json

from openai_embed import embed_texts

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))


class ContextManager:
    """
    Manages conversation context with intelligent pruning and memory extraction.
    """
    
    def __init__(self, db: Session, conversation_id: str, avee_id: str):
        self.db = db
        self.conversation_id = conversation_id
        self.avee_id = avee_id
        
        # Configuration
        self.max_context_messages = 20  # Maximum messages to keep in context
        self.max_tokens = 8000  # Reserve tokens for context (GPT-4o has 128k)
        self.summary_threshold = 50  # Summarize when conversation exceeds this
        
    def get_optimized_context(
        self, 
        current_query: str,
        include_rag: bool = True
    ) -> Tuple[List[Dict], Optional[str]]:
        """
        Get optimized conversation context with smart pruning.
        
        Returns:
            Tuple of (message_history, conversation_summary)
        """
        # Get recent messages
        messages = self._fetch_recent_messages()
        
        # Get conversation summary if exists
        summary = self._get_or_create_summary(messages)
        
        # Semantic filtering: keep most relevant messages
        if len(messages) > self.max_context_messages:
            messages = self._semantic_filter_messages(messages, current_query)
        
        # Format for LLM
        formatted = self._format_messages(messages)
        
        return formatted, summary
    
    def _fetch_recent_messages(self, limit: int = 50) -> List[Dict]:
        """Fetch recent messages from database."""
        result = self.db.execute(
            text("""
                SELECT id, role, content, created_at, layer_used
                FROM messages
                WHERE conversation_id = :conv_id
                ORDER BY created_at DESC
                LIMIT :limit
            """),
            {"conv_id": self.conversation_id, "limit": limit}
        ).fetchall()
        
        # Reverse to chronological order
        return [
            {
                "id": str(row[0]),
                "role": row[1],
                "content": row[2],
                "created_at": row[3],
                "layer_used": row[4]
            }
            for row in reversed(result)
        ]
    
    def _semantic_filter_messages(
        self, 
        messages: List[Dict], 
        query: str,
        keep_recent: int = 5
    ) -> List[Dict]:
        """
        Filter messages by semantic relevance to current query.
        Always keep the N most recent messages.
        """
        if len(messages) <= keep_recent:
            return messages
        
        # Always keep most recent messages
        recent = messages[-keep_recent:]
        candidates = messages[:-keep_recent]
        
        if not candidates:
            return recent
        
        # Embed query
        query_embedding = embed_texts([query])[0]
        
        # Embed candidate messages (user messages only for relevance)
        user_messages = [m for m in candidates if m["role"] == "user"]
        if not user_messages:
            return recent
        
        contents = [m["content"] for m in user_messages]
        embeddings = embed_texts(contents)
        
        # Calculate similarity scores
        from numpy import dot
        from numpy.linalg import norm
        
        def cosine_similarity(a, b):
            return dot(a, b) / (norm(a) * norm(b))
        
        scored = [
            (msg, cosine_similarity(query_embedding, emb))
            for msg, emb in zip(user_messages, embeddings)
        ]
        
        # Sort by relevance and take top K
        scored.sort(key=lambda x: x[1], reverse=True)
        top_k = min(10, len(scored))
        relevant_ids = {m["id"] for m, _ in scored[:top_k]}
        
        # Keep relevant messages and their assistant responses
        filtered = []
        for i, msg in enumerate(candidates):
            if msg["id"] in relevant_ids:
                filtered.append(msg)
                # Include the assistant's response if it exists
                if i + 1 < len(candidates) and candidates[i + 1]["role"] == "assistant":
                    filtered.append(candidates[i + 1])
        
        # Sort by timestamp to maintain order
        filtered.sort(key=lambda x: x["created_at"])
        
        return filtered + recent
    
    def _format_messages(self, messages: List[Dict]) -> List[Dict]:
        """Format messages for OpenAI API."""
        return [
            {"role": msg["role"], "content": msg["content"]}
            for msg in messages
            if msg["role"] in ("user", "assistant", "system")
        ]
    
    def _get_or_create_summary(self, messages: List[Dict]) -> Optional[str]:
        """
        Get existing conversation summary or create one if needed.
        """
        # Check if summary exists
        result = self.db.execute(
            text("""
                SELECT summary, created_at
                FROM conversation_summaries
                WHERE conversation_id = :conv_id
                ORDER BY created_at DESC
                LIMIT 1
            """),
            {"conv_id": self.conversation_id}
        ).fetchone()
        
        if result:
            summary, created_at = result
            # If summary is recent enough, use it
            if datetime.now(timezone.utc) - created_at < timedelta(hours=1):
                return summary
        
        # Create new summary if conversation is long enough
        if len(messages) >= self.summary_threshold:
            return self._create_summary(messages)
        
        return None
    
    def _create_summary(self, messages: List[Dict]) -> str:
        """
        Create a summary of the conversation using GPT-4o-mini.
        """
        # Take first 30 messages for summary
        to_summarize = messages[:30]
        
        conversation_text = "\n".join([
            f"{msg['role']}: {msg['content']}"
            for msg in to_summarize
        ])
        
        try:
            response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {
                        "role": "system",
                        "content": "Summarize this conversation in 3-4 sentences, capturing key topics, questions, and outcomes."
                    },
                    {
                        "role": "user",
                        "content": f"Conversation:\n{conversation_text}"
                    }
                ],
                temperature=0.3,
                max_tokens=200
            )
            
            summary = response.choices[0].message.content.strip()
            
            # Store summary
            self.db.execute(
                text("""
                    INSERT INTO conversation_summaries 
                    (conversation_id, summary, messages_included)
                    VALUES (:conv_id, :summary, :count)
                """),
                {
                    "conv_id": self.conversation_id,
                    "summary": summary,
                    "count": len(to_summarize)
                }
            )
            self.db.commit()
            
            return summary
            
        except Exception as e:
            print(f"Failed to create summary: {e}")
            return None
    
    def extract_semantic_memory(self, messages: List[Dict]) -> List[Dict]:
        """
        Extract structured semantic memories from conversation.
        
        Returns list of memory objects:
        {
            "type": "fact" | "preference" | "relationship" | "event",
            "content": "user loves Python programming",
            "confidence": 0.9,
            "source_message_id": "uuid"
        }
        """
        # Take recent messages for extraction
        recent = messages[-10:] if len(messages) > 10 else messages
        
        conversation_text = "\n".join([
            f"{msg['role']}: {msg['content']}"
            for msg in recent
        ])
        
        extraction_prompt = """Extract structured memories from this conversation.
Focus on:
- FACTS: Concrete information about the user (name, job, location, etc.)
- PREFERENCES: Likes, dislikes, interests
- RELATIONSHIPS: Mentions of other people
- EVENTS: Important events or plans mentioned

Return ONLY valid JSON array with this structure:
[
  {
    "type": "fact|preference|relationship|event",
    "content": "brief statement",
    "confidence": 0.0-1.0
  }
]

Conversation:
""" + conversation_text
        
        try:
            response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": "You are a memory extraction system. Output only valid JSON."},
                    {"role": "user", "content": extraction_prompt}
                ],
                temperature=0.2,
                max_tokens=500
            )
            
            content = response.choices[0].message.content.strip()
            
            # Parse JSON
            # Remove markdown code blocks if present
            if content.startswith("```"):
                content = content.split("```")[1]
                if content.startswith("json"):
                    content = content[4:]
            
            memories = json.loads(content)
            
            # Validate structure
            valid_memories = []
            for mem in memories:
                if isinstance(mem, dict) and "type" in mem and "content" in mem:
                    valid_memories.append({
                        "type": mem["type"],
                        "content": mem["content"],
                        "confidence": mem.get("confidence", 0.7)
                    })
            
            return valid_memories
            
        except Exception as e:
            print(f"Failed to extract memories: {e}")
            return []
    
    def store_memories(self, memories: List[Dict], source_message_id: str):
        """
        Store extracted memories in the database with embeddings.
        """
        if not memories:
            return
        
        # Generate embeddings for memories
        contents = [m["content"] for m in memories]
        embeddings = embed_texts(contents)
        
        for memory, embedding in zip(memories, embeddings):
            vec_str = "[" + ",".join(str(x) for x in embedding) + "]"
            
            self.db.execute(
                text("""
                    INSERT INTO avee_memories 
                    (avee_id, memory_type, content, confidence_score, source_message_id, embedding)
                    VALUES (:avee_id, :type, :content, :confidence, :msg_id, (:embedding)::vector)
                """),
                {
                    "avee_id": self.avee_id,
                    "type": memory["type"],
                    "content": memory["content"],
                    "confidence": memory["confidence"],
                    "msg_id": source_message_id,
                    "embedding": vec_str
                }
            )
        
        self.db.commit()
    
    def search_memories(self, query: str, k: int = 5) -> List[Dict]:
        """
        Semantic search through stored memories.
        """
        q_vec = embed_texts([query])[0]
        q_vec_str = "[" + ",".join(str(x) for x in q_vec) + "]"
        
        result = self.db.execute(
            text("""
                SELECT content, memory_type, confidence_score,
                       1 - (embedding <=> (:qvec)::vector) as similarity
                FROM avee_memories
                WHERE avee_id = :avee_id
                ORDER BY embedding <=> (:qvec)::vector ASC
                LIMIT :k
            """),
            {
                "qvec": q_vec_str,
                "avee_id": self.avee_id,
                "k": k
            }
        ).fetchall()
        
        return [
            {
                "content": row[0],
                "type": row[1],
                "confidence": row[2],
                "similarity": row[3]
            }
            for row in result
        ]


