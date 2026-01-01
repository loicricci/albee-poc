"""
Lightweight in-memory caching layer for frequently accessed data.
Conservative approach without external dependencies (no Redis required).
Uses TTL-based expiration and automatic cache invalidation.
"""

import time
from typing import Any, Optional, Callable
from functools import wraps
import hashlib
import json


class SimpleCache:
    """
    Simple in-memory cache with TTL expiration.
    Thread-safe for basic operations.
    """
    def __init__(self, default_ttl_seconds: int = 300):
        self.cache = {}
        self.default_ttl = default_ttl_seconds
        self.hits = 0
        self.misses = 0
    
    def _make_key(self, key: str) -> str:
        """Create cache key, handling complex objects"""
        if isinstance(key, str):
            return key
        # Hash complex objects
        return hashlib.md5(json.dumps(key, sort_keys=True).encode()).hexdigest()
    
    def get(self, key: str) -> Optional[Any]:
        """Get value from cache if not expired"""
        cache_key = self._make_key(key)
        
        if cache_key in self.cache:
            value, expiry = self.cache[cache_key]
            if time.time() < expiry:
                self.hits += 1
                return value
            else:
                # Expired, remove it
                del self.cache[cache_key]
        
        self.misses += 1
        return None
    
    def set(self, key: str, value: Any, ttl: Optional[int] = None):
        """Set value in cache with TTL"""
        cache_key = self._make_key(key)
        ttl = ttl or self.default_ttl
        expiry = time.time() + ttl
        self.cache[cache_key] = (value, expiry)
    
    def delete(self, key: str):
        """Delete specific key from cache"""
        cache_key = self._make_key(key)
        if cache_key in self.cache:
            del self.cache[cache_key]
    
    def delete_pattern(self, pattern: str):
        """Delete all keys matching pattern (simple prefix match)"""
        keys_to_delete = [k for k in self.cache.keys() if k.startswith(pattern)]
        for key in keys_to_delete:
            del self.cache[key]
    
    def clear(self):
        """Clear entire cache"""
        self.cache.clear()
        self.hits = 0
        self.misses = 0
    
    def cleanup_expired(self):
        """Remove expired entries (call periodically)"""
        now = time.time()
        expired_keys = [k for k, (_, expiry) in self.cache.items() if now >= expiry]
        for key in expired_keys:
            del self.cache[key]
        return len(expired_keys)
    
    def get_stats(self) -> dict:
        """Get cache statistics"""
        total_requests = self.hits + self.misses
        hit_rate = (self.hits / total_requests * 100) if total_requests > 0 else 0
        
        return {
            "hits": self.hits,
            "misses": self.misses,
            "total_requests": total_requests,
            "hit_rate_percent": round(hit_rate, 2),
            "cached_items": len(self.cache),
        }


# Global cache instances with different TTLs
profile_cache = SimpleCache(default_ttl_seconds=300)  # 5 minutes
agent_cache = SimpleCache(default_ttl_seconds=120)    # 2 minutes  
feed_cache = SimpleCache(default_ttl_seconds=30)      # 30 seconds
config_cache = SimpleCache(default_ttl_seconds=600)   # 10 minutes


def cached(cache_instance: SimpleCache, key_func: Callable = None, ttl: Optional[int] = None):
    """
    Decorator to cache function results.
    
    Usage:
        @cached(profile_cache, key_func=lambda user_id: f"profile:{user_id}")
        def get_profile(user_id):
            return expensive_db_query(user_id)
    
    Args:
        cache_instance: Cache instance to use
        key_func: Function to generate cache key from function args
        ttl: Custom TTL for this cached function
    """
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        def wrapper(*args, **kwargs):
            # Generate cache key
            if key_func:
                cache_key = key_func(*args, **kwargs)
            else:
                # Default: use function name + args
                cache_key = f"{func.__name__}:{args}:{kwargs}"
            
            # Try to get from cache
            cached_value = cache_instance.get(cache_key)
            if cached_value is not None:
                return cached_value
            
            # Cache miss - call function
            result = func(*args, **kwargs)
            
            # Store in cache
            cache_instance.set(cache_key, result, ttl=ttl)
            
            return result
        
        return wrapper
    return decorator


def invalidate_user_cache(user_id: str):
    """
    Invalidate all cached data for a specific user.
    Call this when user updates their profile or agents.
    """
    # Delete profile cache
    profile_cache.delete(f"profile:{user_id}")
    
    # Delete agent list cache
    agent_cache.delete(f"agents:{user_id}")
    
    # Delete feed cache
    feed_cache.delete(f"feed:{user_id}")


def invalidate_agent_cache(agent_id: str):
    """
    Invalidate cached data for a specific agent.
    Call this when agent is updated or posts new update.
    """
    # Delete agent details
    agent_cache.delete(f"agent:{agent_id}")
    
    # Delete feeds that might contain this agent
    feed_cache.clear()  # Simple approach: clear all feeds


def get_all_cache_stats() -> dict:
    """Get statistics for all caches"""
    return {
        "profile_cache": profile_cache.get_stats(),
        "agent_cache": agent_cache.get_stats(),
        "feed_cache": feed_cache.get_stats(),
        "config_cache": config_cache.get_stats(),
    }


def cleanup_all_caches():
    """Remove expired entries from all caches"""
    return {
        "profile_cache_cleaned": profile_cache.cleanup_expired(),
        "agent_cache_cleaned": agent_cache.cleanup_expired(),
        "feed_cache_cleaned": feed_cache.cleanup_expired(),
        "config_cache_cleaned": config_cache.cleanup_expired(),
    }


