"""
Generation Cache Module

Provides caching for agent contexts and user ID lookups to improve performance.
"""

from typing import Dict, Any, Optional
from functools import lru_cache
import time

# Simple in-memory caches with TTL
_agent_context_cache: Dict[str, tuple[Dict[str, Any], float]] = {}
_user_id_cache: Dict[str, tuple[str, float]] = {}

# Cache TTL in seconds
AGENT_CONTEXT_TTL = 3600  # 1 hour
USER_ID_TTL = 3600  # 1 hour


def cache_agent_context(agent_handle: str, context: Dict[str, Any]):
    """Cache an agent context"""
    _agent_context_cache[agent_handle] = (context, time.time())
    print(f"[Cache] Cached context for @{agent_handle}")


def get_cached_agent_context(agent_handle: str) -> Optional[Dict[str, Any]]:
    """Get cached agent context if available and not expired"""
    if agent_handle in _agent_context_cache:
        context, cached_time = _agent_context_cache[agent_handle]
        age = time.time() - cached_time
        
        if age < AGENT_CONTEXT_TTL:
            print(f"[Cache] HIT: Agent context for @{agent_handle} (age: {age:.1f}s)")
            return context
        else:
            # Expired, remove it
            del _agent_context_cache[agent_handle]
            print(f"[Cache] EXPIRED: Agent context for @{agent_handle}")
    
    print(f"[Cache] MISS: Agent context for @{agent_handle}")
    return None


def cache_user_id(agent_handle: str, user_id: str):
    """Cache a user ID lookup"""
    _user_id_cache[agent_handle] = (user_id, time.time())
    print(f"[Cache] Cached user_id for @{agent_handle}")


def get_cached_user_id(agent_handle: str) -> Optional[str]:
    """Get cached user ID if available and not expired"""
    if agent_handle in _user_id_cache:
        user_id, cached_time = _user_id_cache[agent_handle]
        age = time.time() - cached_time
        
        if age < USER_ID_TTL:
            print(f"[Cache] HIT: User ID for @{agent_handle} (age: {age:.1f}s)")
            return user_id
        else:
            # Expired, remove it
            del _user_id_cache[agent_handle]
            print(f"[Cache] EXPIRED: User ID for @{agent_handle}")
    
    print(f"[Cache] MISS: User ID for @{agent_handle}")
    return None


def clear_agent_cache():
    """Clear all agent-related caches"""
    _agent_context_cache.clear()
    _user_id_cache.clear()
    print("[Cache] Cleared all caches")


def get_cache_stats() -> Dict[str, Any]:
    """Get cache statistics"""
    now = time.time()
    
    agent_contexts = len(_agent_context_cache)
    user_ids = len(_user_id_cache)
    
    return {
        "agent_contexts_cached": agent_contexts,
        "user_ids_cached": user_ids,
        "total_cached_items": agent_contexts + user_ids
    }







