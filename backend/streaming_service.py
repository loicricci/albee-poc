"""
Streaming service for real-time AI responses.

Provides streaming chat completions with OpenAI GPT-4o/GPT-4o-mini
using Server-Sent Events (SSE) for browser compatibility.
"""

import os
import json
from typing import AsyncIterator, List, Dict, Optional
from openai import AsyncOpenAI
from fastapi import HTTPException
from sqlalchemy.orm import Session

# Use AsyncOpenAI for streaming
async_client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))


class StreamingService:
    """
    Handles streaming AI responses with OpenAI.
    """
    
    def __init__(
        self, 
        model: str = "gpt-4o",  # Upgraded to GPT-4o by default
        temperature: float = 0.7,
        max_tokens: Optional[int] = None
    ):
        self.model = model
        self.temperature = temperature
        self.max_tokens = max_tokens
    
    async def stream_chat_completion(
        self,
        messages: List[Dict[str, str]],
        on_token: Optional[callable] = None
    ) -> AsyncIterator[str]:
        """
        Stream chat completion tokens from OpenAI.
        
        Args:
            messages: List of message dicts with 'role' and 'content'
            on_token: Optional callback for each token (for logging/storage)
        
        Yields:
            Individual tokens as they arrive from OpenAI
        """
        try:
            stream = await async_client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=self.temperature,
                max_tokens=self.max_tokens,
                stream=True,
            )
            
            async for chunk in stream:
                # Extract token from chunk
                if chunk.choices and len(chunk.choices) > 0:
                    delta = chunk.choices[0].delta
                    if hasattr(delta, 'content') and delta.content:
                        token = delta.content
                        
                        # Call callback if provided
                        if on_token:
                            await on_token(token)
                        
                        yield token
                        
        except Exception as e:
            error_msg = f"Streaming error: {str(e)}"
            print(error_msg)
            raise HTTPException(status_code=500, detail=error_msg)
    
    async def stream_with_thinking(
        self,
        messages: List[Dict[str, str]],
        show_thinking: bool = False
    ) -> AsyncIterator[Dict]:
        """
        Stream with thinking process (useful for complex queries).
        
        Yields:
            Dicts with 'type' and 'content':
            - {'type': 'thinking', 'content': 'analyzing query...'}
            - {'type': 'token', 'content': 'Hello'}
            - {'type': 'complete', 'content': 'full_response'}
        """
        # Optional: Add a reasoning step for complex queries
        if show_thinking:
            yield {
                "type": "thinking",
                "content": "Analyzing context and retrieving relevant information..."
            }
        
        full_response = ""
        
        async for token in self.stream_chat_completion(messages):
            full_response += token
            yield {
                "type": "token",
                "content": token
            }
        
        yield {
            "type": "complete",
            "content": full_response
        }


class StreamingChatService:
    """
    High-level service combining streaming with RAG and context management.
    """
    
    def __init__(self, db: Session):
        self.db = db
        self.streaming_service = StreamingService(model="gpt-4o")
    
    async def stream_rag_response(
        self,
        system_prompt: str,
        conversation_history: List[Dict],
        rag_context: str,
        user_query: str,
        persona_text: Optional[str] = None,
        persona_rules: Optional[str] = None
    ) -> AsyncIterator[str]:
        """
        Stream a RAG-enhanced response.
        
        Combines system prompts, conversation history, RAG context,
        and user query into a streaming response.
        """
        # Build messages array
        messages = [
            {"role": "system", "content": system_prompt}
        ]
        
        if persona_text:
            messages.append({
                "role": "system", 
                "content": f"PERSONA:\n{persona_text}"
            })
        
        if persona_rules:
            messages.append({
                "role": "system",
                "content": persona_rules
            })
        
        if rag_context:
            messages.append({
                "role": "system",
                "content": f"CONTEXT (facts you can use):\n{rag_context}"
            })
        
        # Add conversation history
        messages.extend(conversation_history)
        
        # Add current query
        messages.append({"role": "user", "content": user_query})
        
        # Stream the response
        async for token in self.streaming_service.stream_chat_completion(messages):
            yield token
    
    async def stream_with_metadata(
        self,
        system_prompt: str,
        conversation_history: List[Dict],
        rag_context: str,
        user_query: str,
        persona_text: Optional[str] = None
    ) -> AsyncIterator[Dict]:
        """
        Stream response with metadata events.
        
        Yields JSON objects with different event types:
        - {'event': 'start', 'model': 'gpt-4o', 'timestamp': ...}
        - {'event': 'token', 'content': 'Hello'}
        - {'event': 'complete', 'total_tokens': 150, 'finish_reason': 'stop'}
        """
        import time
        
        # Send start event
        yield {
            "event": "start",
            "model": "gpt-4o",
            "timestamp": time.time()
        }
        
        token_count = 0
        
        # Build messages
        messages = [{"role": "system", "content": system_prompt}]
        if persona_text:
            messages.append({"role": "system", "content": f"PERSONA:\n{persona_text}"})
        if rag_context:
            messages.append({"role": "system", "content": f"CONTEXT:\n{rag_context}"})
        messages.extend(conversation_history)
        messages.append({"role": "user", "content": user_query})
        
        # Stream tokens
        async for token in self.streaming_service.stream_chat_completion(messages):
            token_count += 1
            yield {
                "event": "token",
                "content": token
            }
        
        # Send completion event
        yield {
            "event": "complete",
            "total_tokens": token_count,  # Approximate
            "finish_reason": "stop",
            "timestamp": time.time()
        }


def format_sse(data: dict) -> str:
    """
    Format data as Server-Sent Event.
    
    SSE format:
    data: {"key": "value"}\\n\\n
    """
    return f"data: {json.dumps(data)}\n\n"


def format_sse_token(token: str) -> str:
    """Format a single token as SSE."""
    return f"data: {json.dumps({'token': token})}\n\n"













