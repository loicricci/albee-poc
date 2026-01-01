"""
Conversation Context Manager for Native Agents

Tracks conversation history per user to enable multi-turn conversations
and contextual responses.
"""

from typing import Dict, List, Any, Optional
from datetime import datetime, timedelta
from dataclasses import dataclass, asdict
import json


@dataclass
class ConversationMessage:
    """A single message in the conversation history"""
    role: str  # 'user' or 'agent'
    content: str
    timestamp: datetime
    metadata: Optional[Dict[str, Any]] = None
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for serialization"""
        return {
            "role": self.role,
            "content": self.content,
            "timestamp": self.timestamp.isoformat(),
            "metadata": self.metadata
        }


class ConversationContext:
    """
    Manages conversation contexts for native agents.
    
    Stores conversation history per user to enable:
    - Follow-up questions
    - Contextual responses
    - Multi-turn conversations
    """
    
    def __init__(self, max_history: int = 5, ttl_minutes: int = 30):
        """
        Initialize context manager.
        
        Args:
            max_history: Maximum number of messages to store per user
            ttl_minutes: Time-to-live for context (auto-clear after this time)
        """
        self.contexts: Dict[str, List[ConversationMessage]] = {}
        self.max_history = max_history
        self.ttl_minutes = ttl_minutes
        self.last_activity: Dict[str, datetime] = {}
    
    def add_message(
        self, 
        user_id: str, 
        role: str, 
        content: str,
        metadata: Optional[Dict[str, Any]] = None
    ):
        """
        Add a message to the user's conversation history.
        
        Args:
            user_id: User identifier
            role: 'user' or 'agent'
            content: Message content
            metadata: Optional metadata (e.g., weather data, location)
        """
        # Initialize context if needed
        if user_id not in self.contexts:
            self.contexts[user_id] = []
        
        # Add message
        message = ConversationMessage(
            role=role,
            content=content,
            timestamp=datetime.utcnow(),
            metadata=metadata
        )
        
        self.contexts[user_id].append(message)
        self.last_activity[user_id] = datetime.utcnow()
        
        # Trim to max history
        if len(self.contexts[user_id]) > self.max_history:
            self.contexts[user_id] = self.contexts[user_id][-self.max_history:]
    
    def get_context(
        self, 
        user_id: str, 
        limit: Optional[int] = None
    ) -> List[ConversationMessage]:
        """
        Get conversation history for a user.
        
        Args:
            user_id: User identifier
            limit: Optional limit on number of messages to return
            
        Returns:
            List of conversation messages (most recent first)
        """
        # Clean expired contexts
        self._clean_expired_contexts()
        
        if user_id not in self.contexts:
            return []
        
        messages = self.contexts[user_id]
        
        if limit:
            messages = messages[-limit:]
        
        return messages
    
    def get_last_user_query(self, user_id: str) -> Optional[str]:
        """
        Get the last user query from context.
        
        Args:
            user_id: User identifier
            
        Returns:
            Last user query or None
        """
        context = self.get_context(user_id)
        
        # Find last user message
        for message in reversed(context):
            if message.role == 'user':
                return message.content
        
        return None
    
    def get_last_agent_response(self, user_id: str) -> Optional[ConversationMessage]:
        """
        Get the last agent response with metadata.
        
        Args:
            user_id: User identifier
            
        Returns:
            Last agent message or None
        """
        context = self.get_context(user_id)
        
        # Find last agent message
        for message in reversed(context):
            if message.role == 'agent':
                return message
        
        return None
    
    def clear_context(self, user_id: str):
        """
        Clear conversation history for a user.
        
        Args:
            user_id: User identifier
        """
        if user_id in self.contexts:
            del self.contexts[user_id]
        if user_id in self.last_activity:
            del self.last_activity[user_id]
    
    def has_context(self, user_id: str) -> bool:
        """
        Check if user has any conversation history.
        
        Args:
            user_id: User identifier
            
        Returns:
            True if user has context
        """
        self._clean_expired_contexts()
        return user_id in self.contexts and len(self.contexts[user_id]) > 0
    
    def get_context_summary(self, user_id: str) -> Dict[str, Any]:
        """
        Get a summary of the user's context for LLM prompts.
        
        Args:
            user_id: User identifier
            
        Returns:
            Dictionary with context summary
        """
        context = self.get_context(user_id)
        
        if not context:
            return {
                "has_history": False,
                "message_count": 0,
                "messages": []
            }
        
        return {
            "has_history": True,
            "message_count": len(context),
            "messages": [
                {
                    "role": msg.role,
                    "content": msg.content,
                    "timestamp": msg.timestamp.isoformat()
                }
                for msg in context
            ]
        }
    
    def _clean_expired_contexts(self):
        """Remove contexts that have exceeded TTL"""
        now = datetime.utcnow()
        expired_users = []
        
        for user_id, last_active in self.last_activity.items():
            if now - last_active > timedelta(minutes=self.ttl_minutes):
                expired_users.append(user_id)
        
        for user_id in expired_users:
            self.clear_context(user_id)
    
    def get_stats(self) -> Dict[str, Any]:
        """
        Get statistics about stored contexts.
        
        Returns:
            Dictionary with stats
        """
        self._clean_expired_contexts()
        
        total_messages = sum(len(msgs) for msgs in self.contexts.values())
        
        return {
            "active_users": len(self.contexts),
            "total_messages": total_messages,
            "max_history": self.max_history,
            "ttl_minutes": self.ttl_minutes
        }


# Global singleton instance
_context_manager_instance = None


def get_context_manager() -> ConversationContext:
    """
    Get the global conversation context manager instance.
    """
    global _context_manager_instance
    if _context_manager_instance is None:
        _context_manager_instance = ConversationContext()
    return _context_manager_instance





