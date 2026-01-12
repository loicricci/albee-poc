import os
import httpx
import hashlib
import logging
import asyncio
from typing import Dict
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from pathlib import Path
from cachetools import TTLCache

# Setup logging
logger = logging.getLogger(__name__)

# Load backend/.env explicitly
BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")

security = HTTPBearer()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY")

if not SUPABASE_URL or not SUPABASE_ANON_KEY:
    raise RuntimeError("SUPABASE_URL or SUPABASE_ANON_KEY missing in backend/.env")

# JWT Token Cache: Store verified tokens for 5 minutes (300 seconds)
# This eliminates ~100ms Supabase verification call on every request
# Key: token hash, Value: user_id
token_cache = TTLCache(maxsize=1000, ttl=300)
token_full_cache = TTLCache(maxsize=1000, ttl=300)  # For full user object

# Request deduplication: Track in-flight verification requests
# Prevents multiple concurrent requests for same token from all calling Supabase
_pending_verifications: Dict[str, asyncio.Task] = {}
_pending_full_verifications: Dict[str, asyncio.Task] = {}

async def _verify_token_with_supabase(token: str, token_hash: str) -> str:
    """Internal function to verify token with Supabase and return user_id"""
    url = f"{SUPABASE_URL}/auth/v1/user"
    headers = {
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": f"Bearer {token}",
    }

    async with httpx.AsyncClient(timeout=10) as client:
        try:
            r = await client.get(url, headers=headers)
        except httpx.TimeoutException:
            raise HTTPException(status_code=401, detail="Authentication timeout")

    if r.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid Supabase token")

    user = r.json()
    user_id = user["id"]
    
    # Cache BOTH user_id AND full user object (we already have it!)
    # This prevents duplicate Supabase calls when get_current_user is called later
    token_cache[token_hash] = user_id
    token_full_cache[token_hash] = user
    print(f"[JWT Cache] ✓ Cached user_id + full user (TTL: 5min)")
    
    return user_id


async def get_current_user_id(
    creds: HTTPAuthorizationCredentials = Depends(security),
) -> str:
    token = creds.credentials
    
    # Create hash of token for cache key
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    
    # Check user_id cache first - saves ~100ms per request
    if token_hash in token_cache:
        print(f"[JWT Cache] ✓ HIT - returning cached user_id")
        return token_cache[token_hash]
    
    # Also check full user cache - we can extract user_id from it!
    if token_hash in token_full_cache:
        user_id = token_full_cache[token_hash]["id"]
        # Also populate the regular cache for faster future lookups
        token_cache[token_hash] = user_id
        print(f"[JWT Cache] ✓ HIT (from FULL cache) - returning user_id")
        return user_id
    
    # Check if there's already a pending verification for this token
    if token_hash in _pending_verifications:
        print(f"[JWT Cache] ⏳ WAIT - joining in-flight verification")
        return await _pending_verifications[token_hash]
    
    # Also check if there's a pending FULL verification we can wait for
    if token_hash in _pending_full_verifications:
        print(f"[JWT Cache] ⏳ WAIT - joining in-flight FULL verification")
        user = await _pending_full_verifications[token_hash]
        return user["id"]
    
    print(f"[JWT Cache] ✗ MISS - verifying with Supabase")
    
    # Start verification and track it
    task = asyncio.create_task(_verify_token_with_supabase(token, token_hash))
    _pending_verifications[token_hash] = task
    
    try:
        user_id = await task
        return user_id
    finally:
        # Clean up pending task
        _pending_verifications.pop(token_hash, None)


async def _verify_token_full_with_supabase(token: str, token_hash: str) -> dict:
    """Internal function to verify token with Supabase and return full user object"""
    url = f"{SUPABASE_URL}/auth/v1/user"
    headers = {
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": f"Bearer {token}",
    }

    async with httpx.AsyncClient(timeout=10) as client:
        try:
            r = await client.get(url, headers=headers)
        except httpx.TimeoutException:
            raise HTTPException(status_code=401, detail="Authentication timeout")

    if r.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid Supabase token")

    user = r.json()
    
    # Cache the full user object
    token_full_cache[token_hash] = user
    
    # ALSO cache the user_id in the regular cache to prevent duplicate verification!
    token_cache[token_hash] = user["id"]
    
    print(f"[JWT Cache FULL] ✓ Cached user object + user_id (TTL: 5min)")
    
    return user


async def get_current_user(
    creds: HTTPAuthorizationCredentials = Depends(security),
) -> dict:
    """Get the full user object including email"""
    token = creds.credentials
    
    # Create hash of token for cache key
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    
    # Check cache first - saves ~100ms per request
    if token_hash in token_full_cache:
        print(f"[JWT Cache FULL] ✓ HIT - returning cached user object")
        return token_full_cache[token_hash]
    
    # Check if there's already a pending FULL verification for this token
    if token_hash in _pending_full_verifications:
        print(f"[JWT Cache FULL] ⏳ WAIT - joining in-flight FULL verification")
        return await _pending_full_verifications[token_hash]
    
    # Also check if there's a pending REGULAR verification (it now populates full cache too!)
    if token_hash in _pending_verifications:
        print(f"[JWT Cache FULL] ⏳ WAIT - joining in-flight regular verification")
        await _pending_verifications[token_hash]
        # After waiting, check the full cache again (it should be populated now)
        if token_hash in token_full_cache:
            return token_full_cache[token_hash]
    
    print(f"[JWT Cache FULL] ✗ MISS - verifying with Supabase")
    
    # Start verification and track it
    task = asyncio.create_task(_verify_token_full_with_supabase(token, token_hash))
    _pending_full_verifications[token_hash] = task
    
    try:
        user = await task
        return user
    finally:
        # Clean up pending task
        _pending_full_verifications.pop(token_hash, None)
