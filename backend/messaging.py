"""
Direct messaging API endpoints.
Handles profile-to-profile and profile-to-agent conversations.
"""

import uuid
import asyncio
import json
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_, func, desc, text
from pydantic import BaseModel
from datetime import datetime, timedelta

from backend.db import SessionLocal
from backend.auth_supabase import get_current_user_id
from backend.models import (
    DirectConversation,
    DirectMessage,
    Profile,
    Avee,
    Conversation,
    Message,
    AgentFollower,
    Notification,
    EscalationQueue
)
from backend.orchestrator import OrchestratorEngine
from openai import OpenAI
from backend.notifications_api import create_notification

openai_client = OpenAI()

router = APIRouter(prefix="/messaging", tags=["messaging"])

# Simple in-memory cache with TTL for conversations list
_conversations_cache = {}
_cache_ttl = 30  # seconds

def _get_cache_key(user_id: str) -> str:
    """Generate cache key for user conversations."""
    return f"conversations:{user_id}"

def _get_cached_conversations(user_id: str):
    """Get cached conversations if not expired."""
    cache_key = _get_cache_key(user_id)
    if cache_key in _conversations_cache:
        cached_data, timestamp = _conversations_cache[cache_key]
        if (datetime.now() - timestamp).seconds < _cache_ttl:
            print(f"[CACHE HIT] Returning cached conversations for user {user_id}")
            return cached_data
        else:
            # Expired, remove from cache
            del _conversations_cache[cache_key]
    return None

def _set_cached_conversations(user_id: str, data: dict):
    """Cache conversations data with timestamp."""
    cache_key = _get_cache_key(user_id)
    _conversations_cache[cache_key] = (data, datetime.now())
    print(f"[CACHE SET] Cached conversations for user {user_id}")


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# -----------------------------
# Request/Response Models
# -----------------------------

class StartConversationRequest(BaseModel):
    target_user_id: str
    chat_type: str = "profile"  # 'profile' or 'agent'
    target_avee_id: Optional[str] = None  # Required if chat_type is 'agent'


class SendMessageRequest(BaseModel):
    content: str
    force_orchestrator: bool = False  # Admin toggle to force orchestrator routing


class ConversationResponse(BaseModel):
    id: str
    chat_type: str
    other_participant: dict
    target_avee: Optional[dict] = None
    last_message_at: str
    last_message_preview: Optional[str] = None
    unread_count: int = 0


class MessageResponse(BaseModel):
    id: str
    conversation_id: str
    sender_user_id: Optional[str]
    sender_type: str
    sender_avee_id: Optional[str]
    content: str
    created_at: str
    sender_info: Optional[dict] = None
    human_validated: str = "false"  # Track if agent message was validated by human


# -----------------------------
# Helper Functions
# -----------------------------

# Admin emails whose agents should NOT use the orchestrator
ADMIN_EMAILS = ["loic.ricci@gmail.com"]

def _parse_uuid(value: str, field_name: str = "value") -> uuid.UUID:
    """Parse and validate UUID."""
    try:
        return uuid.UUID(value)
    except Exception:
        raise HTTPException(status_code=400, detail=f"Invalid {field_name}")


# Cache for admin agent check to avoid repeated Supabase calls
_admin_agent_cache = {}

def _is_admin_agent(db: Session, avee_id: uuid.UUID) -> bool:
    """
    Check if an agent belongs to an admin user.
    Admin agents should bypass the orchestrator and respond directly.
    Uses caching to avoid repeated Supabase API calls.
    """
    # Check cache first
    cache_key = str(avee_id)
    if cache_key in _admin_agent_cache:
        return _admin_agent_cache[cache_key]
    
    try:
        avee = db.query(Avee).filter(Avee.id == avee_id).first()
        if not avee:
            _admin_agent_cache[cache_key] = False
            return False
        
        # Check if owner is admin by looking up their email in Supabase
        import os
        import httpx
        
        SUPABASE_URL = os.getenv("SUPABASE_URL")
        SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        
        if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
            print(f"[WARNING] Supabase credentials not found, treating agent {avee_id} as non-admin")
            _admin_agent_cache[cache_key] = False
            return False
        
        # Use synchronous httpx since SQLAlchemy is synchronous
        with httpx.Client(timeout=3) as client:
            response = client.get(
                f"{SUPABASE_URL}/auth/v1/admin/users/{str(avee.owner_user_id)}",
                headers={
                    "apikey": SUPABASE_SERVICE_ROLE_KEY,
                    "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
                }
            )
            
            if response.status_code == 200:
                user_data = response.json()
                email = user_data.get("email", "").lower()
                is_admin = email in ADMIN_EMAILS
                _admin_agent_cache[cache_key] = is_admin
                if is_admin:
                    print(f"[INFO] Agent {avee_id} belongs to admin user {email}")
                return is_admin
            else:
                print(f"[WARNING] Failed to fetch user info from Supabase: {response.status_code}")
                _admin_agent_cache[cache_key] = False
                return False
                
    except Exception as e:
        print(f"[ERROR] Failed to check if agent is admin: {e}")
        # On error, assume not admin (safe default)
        _admin_agent_cache[cache_key] = False
        return False


def _get_profile_info(db: Session, user_id: uuid.UUID) -> dict:
    """Get profile information."""
    profile = db.query(Profile).filter(Profile.user_id == user_id).first()
    if not profile:
        return {
            "user_id": str(user_id),
            "handle": "unknown",
            "display_name": "Unknown User",
            "avatar_url": None,
        }
    
    return {
        "user_id": str(profile.user_id),
        "handle": profile.handle,
        "display_name": profile.display_name or profile.handle,
        "avatar_url": profile.avatar_url,
    }


def _get_avee_info(db: Session, avee_id: uuid.UUID) -> dict:
    """Get agent information."""
    avee = db.query(Avee).filter(Avee.id == avee_id).first()
    if not avee:
        return {
            "id": str(avee_id),
            "handle": "unknown",
            "display_name": "Unknown Agent",
            "avatar_url": None,
            "owner_user_id": None,
        }
    
    return {
        "id": str(avee.id),
        "handle": avee.handle,
        "display_name": avee.display_name or avee.handle,
        "avatar_url": avee.avatar_url,
        "owner_user_id": str(avee.owner_user_id) if avee.owner_user_id else None,
    }


async def _handle_agent_response(
    db: Session,
    user_id: uuid.UUID,
    conversation: DirectConversation,
    message: str,
    agent_id: uuid.UUID,
    layer: str = "public"
) -> Optional[dict]:
    """
    Handle agent response using the Orchestrator or direct RAG.
    
    Args:
        db: Database session
        user_id: User who sent the message
        conversation: The conversation object
        message: User's message
        agent_id: The agent ID to use for response
        layer: Access layer (public, friends, intimate)
    
    Returns:
        Agent message dict or None if no response (Path E)
    """
    try:
        # Check if this is an admin agent - if so, bypass orchestrator
        if _is_admin_agent(db, agent_id):
            print(f"[AGENT_RESPONSE] Admin agent detected {agent_id}, bypassing orchestrator")
            return await _handle_direct_agent_response(db, conversation, message, agent_id)
        
        print(f"[AGENT_RESPONSE] Starting orchestrator for user {user_id}, agent {agent_id}")
        # Initialize orchestrator
        engine = OrchestratorEngine(db)
        
        # Route message through orchestrator
        decision = await engine.route_message(
            user_id=user_id,
            avee_id=agent_id,
            message=message,
            conversation_id=conversation.id,
            layer=layer
        )
        
        print(f"[ORCHESTRATOR] Decision path: {decision.path}, reason: {decision.reason}")
        
        # Generate response based on decision path
        response_content = None
        
        if decision.path == "A":
            # Path A: Auto-answer with RAG
            response_content = await _execute_path_a(
                db, agent_id, message, decision, layer
            )
        
        elif decision.path == "B":
            # Path B: Clarification questions
            response_content = await _execute_path_b(message)
        
        elif decision.path == "C":
            # Path C: Canonical answer
            response_content = _execute_path_c(decision)
        
        elif decision.path == "D":
            # Path D: Escalation offer
            response_content = _execute_path_d_message(decision)
        
        elif decision.path == "E":
            # Path E: Queue for human - create escalation entry and notify owner
            print("[ORCHESTRATOR] Path E - Queuing for human response")
            await _execute_path_e_create_escalation(
                db=db,
                conversation_id=conversation.id,
                user_id=user_id,
                avee_id=agent_id,
                message=message
            )
            return None
        
        elif decision.path == "F":
            # Path F: Polite refusal
            response_content = _execute_path_f(decision)
        
        # If we have a response, store it as an agent message
        if response_content:
            agent_message = DirectMessage(
                id=uuid.uuid4(),
                conversation_id=conversation.id,
                sender_user_id=None,
                sender_type="agent",
                sender_avee_id=agent_id,
                content=response_content,
                read_by_participant1="false",
                read_by_participant2="false"
            )
            db.add(agent_message)
            db.commit()
            db.refresh(agent_message)
            
            # Get agent info
            agent_info = _get_avee_info(db, agent_id)
            
            return {
                "id": str(agent_message.id),
                "conversation_id": str(agent_message.conversation_id),
                "sender_user_id": None,
                "sender_type": "agent",
                "sender_avee_id": str(agent_message.sender_avee_id),
                "content": agent_message.content,
                "created_at": agent_message.created_at.isoformat() if agent_message.created_at else None,
                "sender_info": agent_info,
                "human_validated": "false",  # AI-generated, not yet validated
            }
        
        return None
        
    except Exception as e:
        print(f"Error in _handle_agent_response: {e}")
        import traceback
        traceback.print_exc()
        # Rollback the transaction to clean up any failed queries
        db.rollback()
        return None


async def _execute_path_e_create_escalation(
    db: Session,
    conversation_id: uuid.UUID,
    user_id: uuid.UUID,
    avee_id: uuid.UUID,
    message: str
) -> Optional[str]:
    """
    Execute Path E: Create escalation queue entry and notify agent owner.
    
    This is called when the orchestrator decides there's not enough context
    to auto-answer, so the question needs to be forwarded to the agent owner.
    
    Returns:
        Escalation ID if created, None if failed
    """
    try:
        # Generate context summary (simplified - just use message)
        context_summary = f"User asked: {message}"
        
        # Create escalation queue entry
        escalation = EscalationQueue(
            id=uuid.uuid4(),
            conversation_id=conversation_id,
            user_id=user_id,
            avee_id=avee_id,
            original_message=message,
            context_summary=context_summary,
            escalation_reason="forwarded",  # Type for Path E
            status="pending"
        )
        db.add(escalation)
        db.flush()  # Get the escalation ID
        
        # Notify the agent owner
        avee = db.query(Avee).filter(Avee.id == avee_id).first()
        if avee and avee.owner_user_id:
            # Get sender info
            sender_profile = db.query(Profile).filter(Profile.user_id == user_id).first()
            sender_name = sender_profile.display_name if sender_profile else "Someone"
            
            # Create notification
            try:
                await create_notification(
                    db=db,
                    user_id=avee.owner_user_id,
                    notification_type="question_forwarded",
                    title="New Question for Your Agent",
                    message=f"{sender_name} asked: \"{message[:100]}...\"" if len(message) > 100 else f"{sender_name} asked: \"{message}\"",
                    link=f"/messages/escalations",
                    related_user_id=user_id,
                    related_agent_id=avee_id
                )
            except Exception as e:
                print(f"[PATH_E] Failed to create notification: {e}")
                # Continue even if notification fails
        
        db.commit()
        db.refresh(escalation)
        
        print(f"[PATH_E] Created escalation {escalation.id} for agent {avee_id}")
        return str(escalation.id)
        
    except Exception as e:
        print(f"[PATH_E] Error creating escalation: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
        return None


async def _execute_path_a(
    db: Session,
    avee_id: uuid.UUID,
    message: str,
    decision,
    layer: str
) -> str:
    """Execute Path A: Auto-answer with RAG."""
    # Get agent persona
    avee = db.query(Avee).filter(Avee.id == avee_id).first()
    persona_text = (avee.persona or "").strip() if avee else ""
    
    # Build context from top chunks
    context_chunks = [chunk[0] for chunk in decision.signals.top_similar_chunks]
    context = "\n\n".join(context_chunks) if context_chunks else ""
    
    # System prompt based on layer
    layer_prompt = {
        "public": "You are the public version of this person. Be factual, helpful, and safe.",
        "friends": "You are speaking as a trusted friend. Be warm, honest, and respectful.",
        "intimate": "You are a close, intimate digital presence. Be personal, deep, and respectful.",
    }.get(layer, "You are a helpful assistant.")
    
    # Build messages
    messages = [
        {"role": "system", "content": layer_prompt},
    ]
    
    if persona_text:
        messages.append({"role": "system", "content": "PERSONA:\n" + persona_text})
    
    if context:
        messages.append({"role": "system", "content": "CONTEXT (facts you can use):\n" + context})
    
    messages.append({"role": "user", "content": message})
    
    # Generate response
    completion = openai_client.chat.completions.create(
        model="gpt-4o-mini",
        messages=messages,
        temperature=0.7
    )
    
    return completion.choices[0].message.content.strip()


async def _execute_path_b(message: str) -> str:
    """Execute Path B: Ask clarification questions."""
    # Generate clarification questions
    completion = openai_client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {
                "role": "system",
                "content": "Generate 1-2 brief clarification questions to help understand a vague user query. Be friendly and helpful."
            },
            {
                "role": "user",
                "content": f"User said: \"{message}\"\n\nWhat clarification questions should I ask?"
            }
        ],
        temperature=0.7
    )
    
    return completion.choices[0].message.content.strip()


def _execute_path_c(decision) -> str:
    """Execute Path C: Serve canonical answer."""
    canonical_content = decision.action_data.get("canonical_content", "")
    similarity = decision.action_data.get("similarity", 0.0)
    
    # Adapt the canonical answer slightly
    response = f"{canonical_content}\n\n_Note: This answer is based on a similar question I've answered before (similarity: {similarity:.0%})._"
    return response


def _execute_path_d_message(decision) -> str:
    """Execute Path D: Create escalation offer message."""
    escalation_reason = decision.action_data.get("escalation_reason", "novel")
    
    if escalation_reason == "novel":
        return ("This is a unique question that I haven't encountered before. "
                "I can try to answer based on what I know, or I can escalate this to my creator "
                "for a more personalized response. Would you like me to escalate it?")
    else:
        return ("This is a complex question that would benefit from my creator's direct input. "
                "I can attempt an answer, or escalate it to them for a more thorough response. "
                "Would you like me to escalate it?")


def _execute_path_f(decision) -> str:
    """Execute Path F: Polite refusal."""
    refusal_reason = decision.action_data.get("refusal_reason", "unknown")
    
    responses = {
        "escalations_disabled": "I appreciate your question, but the creator has temporarily disabled escalations. Please try asking in a different way, or check back later.",
        "tier_not_allowed": "This question requires escalation, which is currently available only to followers and premium members. Consider following to get access!",
        "daily_limit_reached": "The creator has reached their daily limit for answering questions. Your question is valuable! Please try again tomorrow.",
        "weekly_limit_reached": "The creator has reached their weekly limit for personalized answers. Please check back next week, or browse existing content.",
    }
    
    return responses.get(refusal_reason, "I'm unable to process this request at the moment. Please try rephrasing your question.")


async def _handle_direct_agent_response(
    db: Session,
    conversation: DirectConversation,
    message: str,
    agent_id: uuid.UUID
) -> Optional[dict]:
    """
    Handle direct agent response without going through orchestrator.
    Used for admin agents that should respond immediately using RAG.
    
    Args:
        db: Database session
        conversation: The conversation object
        message: User's message
        agent_id: The agent ID to use for response
    
    Returns:
        Agent message dict with the response
    """
    try:
        from sqlalchemy import text
        from openai_embed import embed_texts
        
        # Get agent persona
        avee = db.query(Avee).filter(Avee.id == agent_id).first()
        if not avee:
            return None
        
        persona_text = (avee.persona or "").strip()
        
        # Search document chunks (RAG)
        message_embedding = embed_texts([message])[0]
        embedding_str = "[" + ",".join(str(x) for x in message_embedding) + "]"
        
        # Query RAG knowledge base
        chunk_results = db.execute(
            text("""
                SELECT content, 1 - (embedding <=> cast(:embedding as vector)) as similarity
                FROM document_chunks
                WHERE avee_id = :avee_id
                  AND embedding IS NOT NULL
                ORDER BY embedding <=> cast(:embedding as vector) ASC
                LIMIT 5
            """),
            {
                "avee_id": str(agent_id),
                "embedding": embedding_str
            }
        ).fetchall()
        
        # Build context from chunks
        context_chunks = [row[0] for row in chunk_results]
        context = "\n\n".join(context_chunks) if context_chunks else ""
        
        # Build messages for LLM
        messages = [
            {"role": "system", "content": "You are a helpful assistant representing this person. Answer naturally and helpfully."}
        ]
        
        if persona_text:
            messages.append({"role": "system", "content": f"PERSONA:\n{persona_text}"})
        
        if context:
            messages.append({"role": "system", "content": f"KNOWLEDGE BASE CONTEXT:\n{context}"})
        
        messages.append({"role": "user", "content": message})
        
        # Generate response
        completion = openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=messages,
            temperature=0.7
        )
        
        response_content = completion.choices[0].message.content.strip()
        
        # Store agent response
        agent_message = DirectMessage(
            id=uuid.uuid4(),
            conversation_id=conversation.id,
            sender_user_id=None,
            sender_type="agent",
            sender_avee_id=agent_id,
            content=response_content,
            read_by_participant1="false",
            read_by_participant2="false"
        )
        db.add(agent_message)
        db.commit()
        db.refresh(agent_message)
        
        # Get agent info
        agent_info = _get_avee_info(db, agent_id)
        
        return {
            "id": str(agent_message.id),
            "conversation_id": str(agent_message.conversation_id),
            "sender_user_id": None,
            "sender_type": "agent",
            "sender_avee_id": str(agent_message.sender_avee_id),
            "content": agent_message.content,
            "created_at": agent_message.created_at.isoformat() if agent_message.created_at else None,
            "sender_info": agent_info,
            "human_validated": "true",  # Admin agents are considered validated
        }
        
    except Exception as e:
        print(f"Error in _handle_direct_agent_response: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
        return None


# -----------------------------
# Endpoints
# -----------------------------

@router.get("/conversations")
def list_conversations(
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
    limit: int = 50,
    offset: int = 0,
):
    """
    List all conversations for the current user with pagination.
    Returns both direct profile conversations, agent conversations, and legacy conversations.
    
    Performance optimized:
    - Single batch query for all profiles
    - Single batch query for all agents
    - Batch query for unread counts
    - 30-second TTL cache
    """
    import time
    start_time = time.time()
    
    # Check cache first
    cached = _get_cached_conversations(user_id)
    if cached:
        print(f"[PERF] Conversations cache hit: {(time.time() - start_time)*1000:.2f}ms")
        return cached
    
    user_uuid = _parse_uuid(user_id, "user_id")
    
    result = []
    
    # Get NEW direct conversations
    query_start = time.time()
    conversations = (
        db.query(DirectConversation)
        .filter(
            or_(
                DirectConversation.participant1_user_id == user_uuid,
                DirectConversation.participant2_user_id == user_uuid,
            )
        )
        .order_by(desc(DirectConversation.last_message_at))
        .limit(limit)
        .offset(offset)
        .all()
    )
    print(f"[PERF] Direct conversations query: {(time.time() - query_start)*1000:.2f}ms")
    
    if not conversations:
        # Skip all the batch loading if no conversations
        return {"conversations": []}
    
    # PERFORMANCE: Batch load all participant profiles in one query
    participant_ids = set()
    avee_ids = set()
    conversation_ids = []
    
    for conv in conversations:
        conversation_ids.append(conv.id)
        # Collect all participant IDs
        participant_ids.add(conv.participant1_user_id)
        participant_ids.add(conv.participant2_user_id)
        # Collect all agent IDs
        if conv.chat_type == "agent" and conv.target_avee_id:
            avee_ids.add(conv.target_avee_id)
    
    # Batch load all profiles in ONE query
    batch_start = time.time()
    profiles_query = db.query(Profile).filter(Profile.user_id.in_(participant_ids)).all()
    profiles_map = {str(p.user_id): {
        "user_id": str(p.user_id),
        "handle": p.handle,
        "display_name": p.display_name or p.handle,
        "avatar_url": p.avatar_url,
    } for p in profiles_query}
    print(f"[PERF] Batch load profiles: {(time.time() - batch_start)*1000:.2f}ms ({len(profiles_map)} profiles)")
    
    # Batch load all agents in ONE query  
    batch_start = time.time()
    avees_map = {}
    if avee_ids:
        avees_query = db.query(Avee).filter(Avee.id.in_(avee_ids)).all()
        avees_map = {str(a.id): {
            "id": str(a.id),
            "handle": a.handle,
            "display_name": a.display_name or a.handle,
            "avatar_url": a.avatar_url,
            "owner_user_id": str(a.owner_user_id) if a.owner_user_id else None,
        } for a in avees_query}
    print(f"[PERF] Batch load agents: {(time.time() - batch_start)*1000:.2f}ms ({len(avees_map)} agents)")
    
    # OPTIMIZED: Batch load unread counts in ONE query with CASE statement
    unread_counts_map = {}
    if conversations:
        # Build arrays for each participant type
        participant1_conv_ids = [str(c.id) for c in conversations if c.participant1_user_id == user_uuid]
        participant2_conv_ids = [str(c.id) for c in conversations if c.participant2_user_id == user_uuid]
        
        unread_counts_data = []
        
        # Query for participant1 conversations
        # Note: Using IN clause with individual UUIDs to avoid parameter binding issues with array casting
        if participant1_conv_ids:
            # Build a comma-separated list of quoted UUIDs for the IN clause
            conv_ids_str = ",".join([f"'{cid}'" for cid in participant1_conv_ids])
            result1 = db.execute(
                text(f"""
                    SELECT conversation_id, COUNT(*) as unread_count
                    FROM direct_messages
                    WHERE conversation_id IN ({conv_ids_str})
                      AND read_by_participant1 = 'false'
                      AND sender_user_id != :user_id
                    GROUP BY conversation_id
                """),
                {"user_id": str(user_uuid)}
            ).fetchall()
            unread_counts_data.extend(result1)
        
        # Query for participant2 conversations
        if participant2_conv_ids:
            conv_ids_str = ",".join([f"'{cid}'" for cid in participant2_conv_ids])
            result2 = db.execute(
                text(f"""
                    SELECT conversation_id, COUNT(*) as unread_count
                    FROM direct_messages
                    WHERE conversation_id IN ({conv_ids_str})
                      AND read_by_participant2 = 'false'
                      AND sender_user_id != :user_id
                    GROUP BY conversation_id
                """),
                {"user_id": str(user_uuid)}
            ).fetchall()
            unread_counts_data.extend(result2)
        
        # Build map from results
        unread_counts_map = {str(row[0]): row[1] for row in unread_counts_data}
    
    # Build results using cached data
    for conv in conversations:
        # Determine the other participant
        other_user_id = (
            conv.participant2_user_id
            if conv.participant1_user_id == user_uuid
            else conv.participant1_user_id
        )
        
        # Get from cache
        other_profile = profiles_map.get(str(other_user_id), {
            "user_id": str(other_user_id),
            "handle": "unknown",
            "display_name": "Unknown User",
            "avatar_url": None,
        })
        
        target_avee = None
        is_agent_owner = False
        if conv.chat_type == "agent" and conv.target_avee_id:
            target_avee = avees_map.get(str(conv.target_avee_id))
            # Check if current user owns this agent
            if target_avee and target_avee.get("owner_user_id") == str(user_uuid):
                is_agent_owner = True
        
        unread_count = unread_counts_map.get(str(conv.id), 0)
        
        result.append({
            "id": str(conv.id),
            "chat_type": conv.chat_type,
            "other_participant": other_profile,
            "target_avee": target_avee,
            "last_message_at": conv.last_message_at.isoformat() if conv.last_message_at else None,
            "last_message_preview": conv.last_message_preview,
            "unread_count": unread_count,
            "is_legacy": False,
            "is_agent_owner": is_agent_owner,
        })
    
    # Get LEGACY conversations from old system - OPTIMIZED WITH BATCH QUERIES
    legacy_start = time.time()
    legacy_conversations = (
        db.query(Conversation)
        .filter(Conversation.user_id == user_uuid)
        .order_by(desc(Conversation.created_at))
        .all()
    )
    print(f"[PERF] Legacy conversations query: {(time.time() - legacy_start)*1000:.2f}ms ({len(legacy_conversations)} conversations)")
    
    if legacy_conversations:
        # BATCH 1: Get all legacy avees in ONE query
        legacy_avee_ids = [c.avee_id for c in legacy_conversations if c.avee_id]
        legacy_avees_map = {}
        if legacy_avee_ids:
            legacy_avees = db.query(Avee).filter(Avee.id.in_(legacy_avee_ids)).all()
            legacy_avees_map = {str(a.id): a for a in legacy_avees}
        
        # BATCH 2: Get last message for each conversation in ONE query
        legacy_conv_ids = [c.id for c in legacy_conversations]
        # Use IN clause with individual UUIDs to avoid parameter binding issues with array casting
        conv_ids_str = ",".join([f"'{str(cid)}'" for cid in legacy_conv_ids])
        last_messages_query = db.execute(
            text(f"""
                SELECT DISTINCT ON (conversation_id) 
                    conversation_id, content, created_at
                FROM messages
                WHERE conversation_id IN ({conv_ids_str})
                ORDER BY conversation_id, created_at DESC
            """)
        ).fetchall()
        last_messages_map = {str(row[0]): row for row in last_messages_query}
        
        # BATCH 3: Get all owner profiles in ONE query
        owner_user_ids = list(set([a.owner_user_id for a in legacy_avees_map.values()]))
        owner_profiles_map = {}
        if owner_user_ids:
            owner_profiles = db.query(Profile).filter(Profile.user_id.in_(owner_user_ids)).all()
            owner_profiles_map = {str(p.user_id): {
                "user_id": str(p.user_id),
                "handle": p.handle,
                "display_name": p.display_name or p.handle,
                "avatar_url": p.avatar_url,
            } for p in owner_profiles}
        
        # Now build results WITHOUT additional queries
        for legacy_conv in legacy_conversations:
            if legacy_conv.avee_id:
                avee = legacy_avees_map.get(str(legacy_conv.avee_id))
                if avee:
                    # Get last message from map
                    last_msg_data = last_messages_map.get(str(legacy_conv.id))
                    
                    # Get owner profile from map
                    owner_profile = owner_profiles_map.get(str(avee.owner_user_id), {
                        "user_id": str(avee.owner_user_id),
                        "handle": "unknown",
                        "display_name": "Unknown User",
                        "avatar_url": None,
                    })
                    
                    result.append({
                        "id": str(legacy_conv.id),
                        "chat_type": "agent",
                        "other_participant": owner_profile,
                        "target_avee": {
                            "id": str(avee.id),
                            "handle": avee.handle,
                            "display_name": avee.display_name or avee.handle,
                            "avatar_url": avee.avatar_url,
                        },
                        "last_message_at": last_msg_data[2].isoformat() if last_msg_data else legacy_conv.created_at.isoformat(),
                        "last_message_preview": last_msg_data[1][:100] if last_msg_data else None,
                        "unread_count": 0,  # Legacy system doesn't track read status
                        "is_legacy": True,
                    })
    
    # Sort all conversations by last message time
    result.sort(key=lambda x: x["last_message_at"] or "", reverse=True)
    
    # Cache the result
    result_data = {"conversations": result}
    _set_cached_conversations(user_id, result_data)
    
    total_time = (time.time() - start_time) * 1000
    print(f"[PERF] TOTAL list_conversations time: {total_time:.2f}ms for {len(result)} conversations")
    
    return result_data


@router.get("/unread-count")
def get_unread_messages_count(
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    """
    Get total count of unread messages across all conversations.
    Returns the sum of unread messages from conversations where user is a participant
    AND user is NOT the agent owner (those belong to Agent Activity, not My Chats).
    """
    user_uuid = _parse_uuid(user_id, "user_id")
    
    # Get all conversations for this user with agent ownership info
    # Use LEFT JOIN to get avee owner info for agent conversations
    conversations_with_owner = db.execute(
        text("""
            SELECT 
                dc.id,
                dc.participant1_user_id,
                dc.participant2_user_id,
                dc.chat_type,
                dc.target_avee_id,
                a.owner_user_id as avee_owner_user_id
            FROM direct_conversations dc
            LEFT JOIN avees a ON dc.target_avee_id = a.id
            WHERE dc.participant1_user_id = :user_id 
               OR dc.participant2_user_id = :user_id
        """),
        {"user_id": str(user_uuid)}
    ).fetchall()
    
    if not conversations_with_owner:
        return {"unread_count": 0}
    
    # Filter out conversations where user is the agent owner
    # (those appear in Agent Activity, not My Chats)
    participant1_conv_ids = []
    participant2_conv_ids = []
    
    for row in conversations_with_owner:
        conv_id = str(row[0])
        p1_user_id = str(row[1]) if row[1] else None
        p2_user_id = str(row[2]) if row[2] else None
        chat_type = row[3]
        avee_owner_user_id = str(row[5]) if row[5] else None
        
        # Skip if this is an agent chat AND user owns the agent
        is_agent_owner = (chat_type == "agent" and avee_owner_user_id == str(user_uuid))
        if is_agent_owner:
            continue
        
        # Add to appropriate list based on participant role
        if p1_user_id == str(user_uuid):
            participant1_conv_ids.append(conv_id)
        if p2_user_id == str(user_uuid):
            participant2_conv_ids.append(conv_id)
    
    total_unread = 0
    
    # Count unread for participant1 conversations
    if participant1_conv_ids:
        conv_ids_str = ",".join([f"'{cid}'" for cid in participant1_conv_ids])
        result1 = db.execute(
            text(f"""
                SELECT COUNT(*) as unread_count
                FROM direct_messages
                WHERE conversation_id IN ({conv_ids_str})
                  AND read_by_participant1 = 'false'
                  AND sender_user_id != :user_id
            """),
            {"user_id": str(user_uuid)}
        ).fetchone()
        if result1:
            total_unread += result1[0]
    
    # Count unread for participant2 conversations
    if participant2_conv_ids:
        conv_ids_str = ",".join([f"'{cid}'" for cid in participant2_conv_ids])
        result2 = db.execute(
            text(f"""
                SELECT COUNT(*) as unread_count
                FROM direct_messages
                WHERE conversation_id IN ({conv_ids_str})
                  AND read_by_participant2 = 'false'
                  AND sender_user_id != :user_id
            """),
            {"user_id": str(user_uuid)}
        ).fetchone()
        if result2:
            total_unread += result2[0]
    
    return {"unread_count": total_unread}


@router.post("/conversations")
def start_or_get_conversation(
    payload: StartConversationRequest,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    """
    Start a new conversation or get existing one.
    Supports both profile-to-profile and profile-to-agent conversations.
    """
    user_uuid = _parse_uuid(user_id, "user_id")
    target_user_uuid = _parse_uuid(payload.target_user_id, "target_user_id")
    
    # Validate chat type
    if payload.chat_type not in ["profile", "agent"]:
        raise HTTPException(status_code=400, detail="chat_type must be 'profile' or 'agent'")
    
    # If agent chat, validate target_avee_id
    target_avee_uuid = None
    if payload.chat_type == "agent":
        if not payload.target_avee_id:
            raise HTTPException(status_code=400, detail="target_avee_id required for agent chats")
        target_avee_uuid = _parse_uuid(payload.target_avee_id, "target_avee_id")
        
        # Verify the agent exists and belongs to the target user
        avee = db.query(Avee).filter(Avee.id == target_avee_uuid).first()
        if not avee:
            raise HTTPException(status_code=404, detail="Agent not found")
        if avee.owner_user_id != target_user_uuid:
            raise HTTPException(status_code=400, detail="Agent does not belong to target user")
    
    # Check if conversation already exists
    existing = (
        db.query(DirectConversation)
        .filter(
            or_(
                and_(
                    DirectConversation.participant1_user_id == user_uuid,
                    DirectConversation.participant2_user_id == target_user_uuid,
                    DirectConversation.chat_type == payload.chat_type,
                    DirectConversation.target_avee_id == target_avee_uuid if payload.chat_type == "agent" else True,
                ),
                and_(
                    DirectConversation.participant1_user_id == target_user_uuid,
                    DirectConversation.participant2_user_id == user_uuid,
                    DirectConversation.chat_type == payload.chat_type,
                    DirectConversation.target_avee_id == target_avee_uuid if payload.chat_type == "agent" else True,
                ),
            )
        )
        .first()
    )
    
    if existing:
        return {"id": str(existing.id), "chat_type": existing.chat_type, "is_new": False}
    
    # Create new conversation
    new_conv = DirectConversation(
        id=uuid.uuid4(),
        participant1_user_id=user_uuid,
        participant2_user_id=target_user_uuid,
        chat_type=payload.chat_type,
        target_avee_id=target_avee_uuid,
    )
    db.add(new_conv)
    db.commit()
    db.refresh(new_conv)
    
    return {"id": str(new_conv.id), "chat_type": new_conv.chat_type, "is_new": True}


@router.get("/conversations/{conversation_id}/messages")
def get_conversation_messages(
    conversation_id: str,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
    limit: int = 100,
    before_message_id: Optional[str] = None,
):
    """
    Get messages in a conversation with pagination support.
    Also marks messages as read for the current user.
    Supports both new direct conversations and legacy conversations.
    """
    user_uuid = _parse_uuid(user_id, "user_id")
    conv_uuid = _parse_uuid(conversation_id, "conversation_id")
    
    # Try to get from new direct conversations first
    conv = db.query(DirectConversation).filter(DirectConversation.id == conv_uuid).first()
    
    if conv:
        # NEW direct conversation
        if conv.participant1_user_id != user_uuid and conv.participant2_user_id != user_uuid:
            raise HTTPException(status_code=403, detail="Not authorized to view this conversation")
        
        # Get messages with pagination
        query = (
            db.query(DirectMessage)
            .filter(DirectMessage.conversation_id == conv_uuid)
            .order_by(desc(DirectMessage.created_at))
        )
        
        # If before_message_id is provided, get messages before that message
        if before_message_id:
            before_uuid = _parse_uuid(before_message_id, "before_message_id")
            before_msg = db.query(DirectMessage).filter(DirectMessage.id == before_uuid).first()
            if before_msg:
                query = query.filter(DirectMessage.created_at < before_msg.created_at)
        
        messages = query.limit(limit).all()
        # Reverse to show chronologically
        messages = list(reversed(messages))
        
        # Mark messages as read - OPTIMIZED: Use bulk update instead of ORM loop
        is_participant1 = conv.participant1_user_id == user_uuid
        
        # Collect IDs of messages that need to be marked as read
        messages_to_mark = []
        for msg in messages:
            if msg.sender_user_id != user_uuid:
                if is_participant1 and msg.read_by_participant1 == "false":
                    messages_to_mark.append(str(msg.id))
                elif not is_participant1 and msg.read_by_participant2 == "false":
                    messages_to_mark.append(str(msg.id))
        
        # Use bulk update instead of ORM (much faster)
        if messages_to_mark:
            read_field = "read_by_participant1" if is_participant1 else "read_by_participant2"
            msg_ids_str = ",".join([f"'{mid}'" for mid in messages_to_mark])
            db.execute(
                text(f"""
                    UPDATE direct_messages 
                    SET {read_field} = 'true' 
                    WHERE id IN ({msg_ids_str})
                """)
            )
            db.commit()
        
        # Build response - OPTIMIZED: Batch load all sender info using raw SQL (faster than ORM)
        # Collect all unique sender IDs
        user_ids = set()
        avee_ids = set()
        for msg in messages:
            if msg.sender_type == "user" and msg.sender_user_id:
                user_ids.add(str(msg.sender_user_id))
            elif msg.sender_type == "agent" and msg.sender_avee_id:
                avee_ids.add(str(msg.sender_avee_id))
        
        # Batch load all profiles using RAW SQL (much faster than ORM for simple lookups)
        profiles_map = {}
        if user_ids:
            user_ids_str = ",".join([f"'{uid}'" for uid in user_ids])
            profile_results = db.execute(
                text(f"""
                    SELECT user_id, handle, display_name, avatar_url 
                    FROM profiles 
                    WHERE user_id IN ({user_ids_str})
                """)
            ).fetchall()
            profiles_map = {str(row[0]): {
                "user_id": str(row[0]),
                "handle": row[1],
                "display_name": row[2] or row[1],
                "avatar_url": row[3],
            } for row in profile_results}
        
        # Batch load all avees using RAW SQL
        avees_map = {}
        if avee_ids:
            avee_ids_str = ",".join([f"'{aid}'" for aid in avee_ids])
            avee_results = db.execute(
                text(f"""
                    SELECT id, handle, display_name, avatar_url, owner_user_id
                    FROM avees 
                    WHERE id IN ({avee_ids_str})
                """)
            ).fetchall()
            avees_map = {str(row[0]): {
                "id": str(row[0]),
                "handle": row[1],
                "display_name": row[2] or row[1],
                "avatar_url": row[3],
                "owner_user_id": str(row[4]) if row[4] else None,
            } for row in avee_results}
        
        # Build result using cached maps (no more individual queries!)
        result = []
        for msg in messages:
            sender_info = None
            if msg.sender_type == "user" and msg.sender_user_id:
                sender_info = profiles_map.get(str(msg.sender_user_id), {
                    "user_id": str(msg.sender_user_id),
                    "handle": "unknown",
                    "display_name": "Unknown User",
                    "avatar_url": None,
                })
            elif msg.sender_type == "agent" and msg.sender_avee_id:
                sender_info = avees_map.get(str(msg.sender_avee_id), {
                    "id": str(msg.sender_avee_id),
                    "handle": "unknown",
                    "display_name": "Unknown Agent",
                    "avatar_url": None,
                    "owner_user_id": None,
                })
            
            result.append({
                "id": str(msg.id),
                "conversation_id": str(msg.conversation_id),
                "sender_user_id": str(msg.sender_user_id) if msg.sender_user_id else None,
                "sender_type": msg.sender_type,
                "sender_avee_id": str(msg.sender_avee_id) if msg.sender_avee_id else None,
                "content": msg.content,
                "created_at": msg.created_at.isoformat() if msg.created_at else None,
                "sender_info": sender_info,
                "human_validated": getattr(msg, 'human_validated', 'false'),
            })
        
        return {"messages": result}
    
    # Try legacy conversation
    legacy_conv = db.query(Conversation).filter(Conversation.id == conv_uuid).first()
    if not legacy_conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    if legacy_conv.user_id != user_uuid:
        raise HTTPException(status_code=403, detail="Not authorized to view this conversation")
    
    # Get legacy messages
    messages = (
        db.query(Message)
        .filter(Message.conversation_id == conv_uuid)
        .order_by(Message.created_at)
        .all()
    )
    
    # Build response for legacy messages - OPTIMIZED: Cache profile info
    result = []
    avee = None
    if legacy_conv.avee_id:
        avee = db.query(Avee).filter(Avee.id == legacy_conv.avee_id).first()
    
    # Pre-fetch user profile once (instead of in loop)
    user_profile_info = _get_profile_info(db, user_uuid)
    
    for msg in messages:
        sender_info = None
        sender_type = "user"
        
        if msg.role == "assistant" and avee:
            sender_type = "agent"
            sender_info = {
                "id": str(avee.id),
                "handle": avee.handle,
                "display_name": avee.display_name or avee.handle,
                "avatar_url": avee.avatar_url,
            }
        elif msg.role == "user":
            sender_info = user_profile_info  # Use cached profile
        
        result.append({
            "id": str(msg.id),
            "conversation_id": str(msg.conversation_id),
            "sender_user_id": str(user_uuid) if msg.role == "user" else None,
            "sender_type": sender_type,
            "sender_avee_id": str(avee.id) if msg.role == "assistant" and avee else None,
            "content": msg.content,
            "created_at": msg.created_at.isoformat() if msg.created_at else None,
            "sender_info": sender_info,
            "human_validated": "false",  # Legacy messages don't have validation tracking
        })
    
    return {"messages": result}


@router.post("/conversations/{conversation_id}/messages")
async def send_message(
    conversation_id: str,
    payload: SendMessageRequest,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    """
    Send a message in a conversation.
    If it's an agent conversation, this will also trigger the agent to respond.
    """
    user_uuid = _parse_uuid(user_id, "user_id")
    conv_uuid = _parse_uuid(conversation_id, "conversation_id")
    
    # Get conversation and verify user is a participant
    conv = db.query(DirectConversation).filter(DirectConversation.id == conv_uuid).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    if conv.participant1_user_id != user_uuid and conv.participant2_user_id != user_uuid:
        raise HTTPException(status_code=403, detail="Not authorized to send messages in this conversation")
    
    # Create user message
    new_message = DirectMessage(
        id=uuid.uuid4(),
        conversation_id=conv_uuid,
        sender_user_id=user_uuid,
        sender_type="user",
        content=payload.content,
        read_by_participant1="true" if conv.participant1_user_id == user_uuid else "false",
        read_by_participant2="true" if conv.participant2_user_id == user_uuid else "false",
    )
    db.add(new_message)
    
    # Update conversation last message
    conv.last_message_at = func.now()
    conv.last_message_preview = payload.content[:100]
    
    db.commit()
    db.refresh(new_message)
    
    # Get sender info
    sender_info = _get_profile_info(db, user_uuid)
    
    user_message_result = {
        "id": str(new_message.id),
        "conversation_id": str(new_message.conversation_id),
        "sender_user_id": str(new_message.sender_user_id),
        "sender_type": new_message.sender_type,
        "sender_avee_id": None,
        "content": new_message.content,
        "created_at": new_message.created_at.isoformat() if new_message.created_at else None,
        "sender_info": sender_info,
        "human_validated": "true",  # User messages are inherently "validated" by the human
    }
    
    # Create notification for recipient if they follow the sender
    try:
        recipient_user_id = (
            conv.participant2_user_id 
            if conv.participant1_user_id == user_uuid 
            else conv.participant1_user_id
        )
        
        # Check if recipient follows sender (any of sender's agents)
        sender_agents = db.query(Avee).filter(Avee.owner_user_id == user_uuid).all()
        sender_agent_ids = [agent.id for agent in sender_agents]
        
        if sender_agent_ids:
            is_following = db.query(AgentFollower).filter(
                AgentFollower.follower_user_id == recipient_user_id,
                AgentFollower.avee_id.in_(sender_agent_ids)
            ).first() is not None
            
            if is_following:
                # Truncate message for notification
                message_preview = new_message.content[:100] + "..." if len(new_message.content) > 100 else new_message.content
                
                create_notification(
                    db=db,
                    user_id=recipient_user_id,
                    notification_type="new_message",
                    title=f"New message from {sender_info['display_name']}",
                    message=message_preview,
                    link=f"/messages/{str(conv.id)}",
                    related_user_id=user_uuid,
                    related_message_id=new_message.id
                )
    except Exception as e:
        print(f"Error creating message notification: {e}")
        # Rollback the failed notification transaction
        db.rollback()
    
    # UNIFIED MESSAGING: Determine which agent should respond
    recipient_agent = None
    
    if conv.chat_type == "agent" and conv.target_avee_id:
        # For agent conversations, use the specific target agent
        recipient_agent = db.query(Avee).filter(Avee.id == conv.target_avee_id).first()
    else:
        # For profile conversations, check if recipient has a primary agent
        recipient_user_id = (
            conv.participant2_user_id 
            if conv.participant1_user_id == user_uuid 
            else conv.participant1_user_id
        )
        
        # Check if recipient has a primary agent
        recipient_agent = db.query(Avee).filter(
            Avee.owner_user_id == recipient_user_id,
            Avee.is_primary == "true"
        ).first()
    
    agent_message_result = None
    system_message_result = None
    
    if recipient_agent:
        print(f"[MESSAGING] Recipient has primary agent: {recipient_agent.handle}")
        print(f"[MESSAGING] Routing through orchestrator...")
        
        # Route through orchestrator
        agent_message_result = await _handle_agent_response(
            db, user_uuid, conv, payload.content, recipient_agent.id
        )
        
        # If orchestrator returned None (Path E), add a system message
        if agent_message_result is None:
            print(f"[MESSAGING] Path E - Adding system message for human queue")
            system_msg = DirectMessage(
                id=uuid.uuid4(),
                conversation_id=conv_uuid,
                sender_user_id=None,
                sender_type="system",
                content="💭 The AI doesn't have enough context to answer this. The person will reply when they're available.",
                read_by_participant1="false",
                read_by_participant2="false"
            )
            db.add(system_msg)
            db.commit()
            db.refresh(system_msg)
            
            system_message_result = {
                "id": str(system_msg.id),
                "conversation_id": str(system_msg.conversation_id),
                "sender_user_id": None,
                "sender_type": "system",
                "content": system_msg.content,
                "created_at": system_msg.created_at.isoformat() if system_msg.created_at else None,
            }
    else:
        print(f"[MESSAGING] Recipient has no agent - human-to-human conversation")
    
    # Return user message, agent response (if any), and system message (if any)
    return {
        "user_message": user_message_result,
        "agent_message": agent_message_result,
        "system_message": system_message_result
    }


@router.get("/agent-conversations")
def list_agent_conversations(
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    """
    List all conversations where users are chatting with this user's agents.
    This allows profile owners to see all conversations with their agents.
    Returns anonymized user info (just initials) for privacy.
    """
    user_uuid = _parse_uuid(user_id, "user_id")
    
    # Get all agents owned by this user
    my_avees = db.query(Avee).filter(Avee.owner_user_id == user_uuid).all()
    avee_ids = [avee.id for avee in my_avees]
    
    if not avee_ids:
        return {"conversations": [], "agents": []}
    
    # Get all conversations where someone is chatting with these agents
    conversations = (
        db.query(DirectConversation)
        .filter(
            DirectConversation.chat_type == "agent",
            DirectConversation.target_avee_id.in_(avee_ids),
        )
        .order_by(desc(DirectConversation.last_message_at))
        .all()
    )
    
    # PERFORMANCE FIX: Batch load all data instead of N+1 queries
    if not conversations:
        return {"conversations": [], "agents": [{
            "id": str(avee.id),
            "handle": avee.handle,
            "display_name": avee.display_name or avee.handle,
            "avatar_url": avee.avatar_url,
        } for avee in my_avees]}
    
    # Collect all user IDs and conversation IDs for batch queries
    other_user_ids = set()
    conversation_ids = []
    for conv in conversations:
        other_user_id = (
            conv.participant1_user_id
            if conv.participant1_user_id != user_uuid
            else conv.participant2_user_id
        )
        other_user_ids.add(other_user_id)
        conversation_ids.append(conv.id)
    
    # Batch 1: Load all profiles in one query
    profiles_query = db.query(Profile).filter(Profile.user_id.in_(other_user_ids)).all()
    profiles_map = {p.user_id: p for p in profiles_query}
    
    # Batch 2: Build avees map from already-loaded my_avees
    avees_map = {avee.id: {
        "id": str(avee.id),
        "handle": avee.handle,
        "display_name": avee.display_name or avee.handle,
        "avatar_url": avee.avatar_url,
        "owner_user_id": str(avee.owner_user_id) if avee.owner_user_id else None,
    } for avee in my_avees}
    
    # Batch 3: Get message counts in one query using GROUP BY
    msg_counts_query = db.query(
        DirectMessage.conversation_id,
        func.count(DirectMessage.id).label('count')
    ).filter(
        DirectMessage.conversation_id.in_(conversation_ids)
    ).group_by(DirectMessage.conversation_id).all()
    msg_counts_map = {row[0]: row[1] for row in msg_counts_query}
    
    # Build results from cached maps (no more N+1!)
    result = []
    for conv in conversations:
        # Get the other participant (not the owner)
        other_user_id = (
            conv.participant1_user_id
            if conv.participant1_user_id != user_uuid
            else conv.participant2_user_id
        )
        
        # Get anonymized user info from batch-loaded profiles
        other_profile = profiles_map.get(other_user_id)
        anonymized_user = {
            "initials": (other_profile.display_name[:2].upper() if other_profile and other_profile.display_name else "??"),
            "avatar_color": f"#{hash(str(other_user_id)) % 0xFFFFFF:06x}",  # Consistent color based on user ID
        }
        
        # Get avee info from batch-loaded map
        target_avee = avees_map.get(conv.target_avee_id, {
            "id": str(conv.target_avee_id),
            "handle": "unknown",
            "display_name": "Unknown Agent",
            "avatar_url": None,
            "owner_user_id": None,
        })
        
        # Get message count from batch-loaded map
        message_count = msg_counts_map.get(conv.id, 0)
        
        result.append({
            "id": str(conv.id),
            "chat_type": conv.chat_type,
            "anonymized_user": anonymized_user,
            "target_avee": target_avee,
            "last_message_at": conv.last_message_at.isoformat() if conv.last_message_at else None,
            "last_message_preview": conv.last_message_preview,
            "message_count": message_count,
        })
    
    # Return agent info for filtering
    agents = [{
        "id": str(avee.id),
        "handle": avee.handle,
        "display_name": avee.display_name or avee.handle,
        "avatar_url": avee.avatar_url,
    } for avee in my_avees]
    
    return {"conversations": result, "agents": agents}


@router.get("/agent-insights")
def get_agent_insights(
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    """
    Get insights about conversations with the user's agents.
    Includes popular topics, question frequency, and engagement stats.
    """
    user_uuid = _parse_uuid(user_id, "user_id")
    
    # Get all agents owned by this user
    my_avees = db.query(Avee).filter(Avee.owner_user_id == user_uuid).all()
    avee_ids = [avee.id for avee in my_avees]
    
    if not avee_ids:
        return {
            "total_conversations": 0,
            "total_messages": 0,
            "pending_escalations": 0,
            "answered_escalations": 0,
            "recent_questions": [],
            "agents": []
        }
    
    # Get conversation stats
    total_conversations = db.query(DirectConversation).filter(
        DirectConversation.chat_type == "agent",
        DirectConversation.target_avee_id.in_(avee_ids),
    ).count()
    
    # Get message stats (last 30 days)
    from datetime import datetime, timedelta
    thirty_days_ago = datetime.utcnow() - timedelta(days=30)
    
    total_messages = db.query(DirectMessage).join(
        DirectConversation,
        DirectMessage.conversation_id == DirectConversation.id
    ).filter(
        DirectConversation.target_avee_id.in_(avee_ids),
        DirectMessage.created_at >= thirty_days_ago
    ).count()
    
    # Get escalation stats
    pending_escalations = db.query(EscalationQueue).filter(
        EscalationQueue.avee_id.in_(avee_ids),
        EscalationQueue.status == "pending"
    ).count()
    
    answered_escalations = db.query(EscalationQueue).filter(
        EscalationQueue.avee_id.in_(avee_ids),
        EscalationQueue.status == "answered"
    ).count()
    
    # Get recent questions (last 10 user messages to agents)
    recent_user_messages = db.query(DirectMessage).join(
        DirectConversation,
        DirectMessage.conversation_id == DirectConversation.id
    ).filter(
        DirectConversation.target_avee_id.in_(avee_ids),
        DirectMessage.sender_type == "user"
    ).order_by(desc(DirectMessage.created_at)).limit(10).all()
    
    recent_questions = [{
        "content": msg.content[:150] + ("..." if len(msg.content) > 150 else ""),
        "created_at": msg.created_at.isoformat() if msg.created_at else None,
    } for msg in recent_user_messages]
    
    # PERFORMANCE FIX: Batch all per-agent stats in 3 queries instead of 3*N queries
    # 1. Batch conversation counts per agent
    conv_counts_query = db.query(
        DirectConversation.target_avee_id,
        func.count(DirectConversation.id).label('count')
    ).filter(
        DirectConversation.target_avee_id.in_(avee_ids)
    ).group_by(DirectConversation.target_avee_id).all()
    conv_counts_map = {str(row[0]): row[1] for row in conv_counts_query}
    
    # 2. Batch message counts per agent (last 30 days)
    msg_counts_query = db.query(
        DirectConversation.target_avee_id,
        func.count(DirectMessage.id).label('count')
    ).join(
        DirectConversation,
        DirectMessage.conversation_id == DirectConversation.id
    ).filter(
        DirectConversation.target_avee_id.in_(avee_ids),
        DirectMessage.created_at >= thirty_days_ago
    ).group_by(DirectConversation.target_avee_id).all()
    msg_counts_map = {str(row[0]): row[1] for row in msg_counts_query}
    
    # 3. Batch pending escalation counts per agent
    pending_counts_query = db.query(
        EscalationQueue.avee_id,
        func.count(EscalationQueue.id).label('count')
    ).filter(
        EscalationQueue.avee_id.in_(avee_ids),
        EscalationQueue.status == "pending"
    ).group_by(EscalationQueue.avee_id).all()
    pending_counts_map = {str(row[0]): row[1] for row in pending_counts_query}
    
    # Build agent stats from cached maps (no more N+1!)
    agent_stats = []
    for avee in my_avees:
        agent_stats.append({
            "id": str(avee.id),
            "handle": avee.handle,
            "display_name": avee.display_name or avee.handle,
            "avatar_url": avee.avatar_url,
            "conversation_count": conv_counts_map.get(str(avee.id), 0),
            "message_count_30d": msg_counts_map.get(str(avee.id), 0),
            "pending_escalations": pending_counts_map.get(str(avee.id), 0),
        })
    
    return {
        "total_conversations": total_conversations,
        "total_messages": total_messages,
        "pending_escalations": pending_escalations,
        "answered_escalations": answered_escalations,
        "recent_questions": recent_questions,
        "agents": agent_stats
    }


@router.post("/conversations/{conversation_id}/stream")
async def stream_message(
    conversation_id: str,
    payload: SendMessageRequest,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    """
    Send a message and stream the agent response in real-time.
    Routes through Orchestrator for intelligent handling.
    """
    user_uuid = _parse_uuid(user_id, "user_id")
    conv_uuid = _parse_uuid(conversation_id, "conversation_id")
    
    # Get conversation and verify user is a participant
    conv = db.query(DirectConversation).filter(DirectConversation.id == conv_uuid).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    if conv.participant1_user_id != user_uuid and conv.participant2_user_id != user_uuid:
        raise HTTPException(status_code=403, detail="Not authorized to send messages in this conversation")
    
    # Create user message
    new_message = DirectMessage(
        id=uuid.uuid4(),
        conversation_id=conv_uuid,
        sender_user_id=user_uuid,
        sender_type="user",
        content=payload.content,
        read_by_participant1="true" if conv.participant1_user_id == user_uuid else "false",
        read_by_participant2="true" if conv.participant2_user_id == user_uuid else "false",
    )
    db.add(new_message)
    
    # Update conversation last message
    conv.last_message_at = func.now()
    conv.last_message_preview = payload.content[:100]
    
    db.commit()
    db.refresh(new_message)
    
    # UNIFIED MESSAGING: Determine which agent should respond
    recipient_agent = None
    
    if conv.chat_type == "agent" and conv.target_avee_id:
        # For agent conversations, use the specific target agent
        recipient_agent = db.query(Avee).filter(Avee.id == conv.target_avee_id).first()
    else:
        # For profile conversations, check if recipient has a primary agent
        recipient_user_id = (
            conv.participant2_user_id 
            if conv.participant1_user_id == user_uuid 
            else conv.participant1_user_id
        )
        
        recipient_agent = db.query(Avee).filter(
            Avee.owner_user_id == recipient_user_id,
            Avee.is_primary == "true"
        ).first()
    
    # Check if user is the owner of the agent
    is_owner = False
    is_admin_agent = False
    if recipient_agent:
        is_owner = (recipient_agent.owner_user_id == user_uuid)
        is_admin_agent = _is_admin_agent(db, recipient_agent.id)
    
    # If no agent, just return completion event
    if not recipient_agent:
        async def simple_stream():
            yield f"data: {json.dumps({'event': 'complete', 'user_message_id': str(new_message.id)})}\n\n"
        
        return StreamingResponse(
            simple_stream(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "X-Accel-Buffering": "no",
                "Connection": "keep-alive",
            }
        )
    
    # ADMIN AGENT MODE: Direct response without orchestrator (for admin-owned agents)
    # Unless force_orchestrator is set (admin toggle for testing)
    if is_admin_agent and not payload.force_orchestrator:
        print(f"[STREAM] Admin agent mode activated for agent {recipient_agent.id} - bypassing orchestrator")
        async def admin_agent_stream():
            import json
            from openai_embed import embed_texts
            from sqlalchemy import text
            
            try:
                # Send start event
                print(f"[STREAM] Sending start event")
                yield f"data: {json.dumps({'event': 'start', 'model': 'gpt-4o-mini', 'user_message_id': str(new_message.id), 'mode': 'admin_agent_direct'})}\n\n"
                
                # Get agent persona
                persona_text = (recipient_agent.persona or "").strip()
                
                # Search document chunks (RAG)
                message_embedding = embed_texts([payload.content])[0]
                embedding_str = "[" + ",".join(str(x) for x in message_embedding) + "]"
                
                # Query RAG knowledge base
                chunk_results = db.execute(
                    text("""
                        SELECT content, 1 - (embedding <=> cast(:embedding as vector)) as similarity
                        FROM document_chunks
                        WHERE avee_id = :avee_id
                          AND embedding IS NOT NULL
                        ORDER BY embedding <=> cast(:embedding as vector) ASC
                        LIMIT 5
                    """),
                    {
                        "avee_id": str(recipient_agent.id),
                        "embedding": embedding_str
                    }
                ).fetchall()
                
                # Build context from chunks
                context_chunks = [row[0] for row in chunk_results]
                context = "\n\n".join(context_chunks) if context_chunks else ""
                print(f"[STREAM] Found {len(context_chunks)} knowledge base chunks")
                
                # Build messages for LLM
                messages = [
                    {"role": "system", "content": "You are a helpful assistant representing this person. Answer naturally and helpfully."}
                ]
                
                if persona_text:
                    messages.append({"role": "system", "content": f"PERSONA:\n{persona_text}"})
                
                if context:
                    messages.append({"role": "system", "content": f"KNOWLEDGE BASE CONTEXT:\n{context}"})
                
                messages.append({"role": "user", "content": payload.content})
                
                # Stream response from OpenAI
                print(f"[STREAM] Starting OpenAI streaming...")
                stream = openai_client.chat.completions.create(
                    model="gpt-4o-mini",
                    messages=messages,
                    temperature=0.7,
                    stream=True
                )
                
                full_response = ""
                token_count = 0
                for chunk in stream:
                    if chunk.choices[0].delta.content:
                        token = chunk.choices[0].delta.content
                        full_response += token
                        token_count += 1
                        if token_count % 10 == 0:
                            print(f"[STREAM] Streamed {token_count} tokens so far...")
                        yield f"data: {json.dumps({'token': token})}\n\n"
                        # Critical: Allow event loop to process the yield immediately
                        await asyncio.sleep(0)
                
                print(f"[STREAM] Completed streaming {token_count} tokens")
                
                # Store agent response
                if full_response:
                    agent_message = DirectMessage(
                        id=uuid.uuid4(),
                        conversation_id=conv_uuid,
                        sender_user_id=None,
                        sender_type="agent",
                        sender_avee_id=recipient_agent.id,
                        content=full_response,
                        read_by_participant1="false",
                        read_by_participant2="false"
                    )
                    db.add(agent_message)
                    db.commit()
                    db.refresh(agent_message)
                    
                    print(f"[STREAM] Saved message {agent_message.id}")
                    yield f"data: {json.dumps({'event': 'complete', 'message_id': str(agent_message.id), 'mode': 'admin_agent_direct'})}\n\n"
                else:
                    yield f"data: {json.dumps({'event': 'complete', 'mode': 'admin_agent_direct'})}\n\n"
                    
            except Exception as e:
                import traceback
                print(f"[STREAM] ERROR: {str(e)}")
                traceback.print_exc()
                yield f"data: {json.dumps({'event': 'error', 'error': str(e)})}\n\n"
        
        return StreamingResponse(
            admin_agent_stream(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "X-Accel-Buffering": "no",
                "Connection": "keep-alive",
            }
        )
    
    # OWNER MODE: Direct response without orchestrator (when user owns the agent)
    # Unless force_orchestrator is set (admin toggle for testing)
    if is_owner and not payload.force_orchestrator:
        print(f"[STREAM] Owner mode activated for agent {recipient_agent.id}")
        async def owner_stream():
            import json
            from openai_embed import embed_texts
            from sqlalchemy import text
            
            try:
                # Send start event
                print(f"[STREAM] Sending start event")
                yield f"data: {json.dumps({'event': 'start', 'model': 'gpt-4o-mini', 'user_message_id': str(new_message.id), 'mode': 'owner_direct'})}\n\n"
                
                # Get agent persona
                persona_text = (recipient_agent.persona or "").strip()
                
                # Search document chunks (RAG)
                message_embedding = embed_texts([payload.content])[0]
                embedding_str = "[" + ",".join(str(x) for x in message_embedding) + "]"
                
                # Query RAG knowledge base
                chunk_results = db.execute(
                    text("""
                        SELECT content, 1 - (embedding <=> cast(:embedding as vector)) as similarity
                        FROM document_chunks
                        WHERE avee_id = :avee_id
                          AND embedding IS NOT NULL
                        ORDER BY embedding <=> cast(:embedding as vector) ASC
                        LIMIT 5
                    """),
                    {
                        "avee_id": str(recipient_agent.id),
                        "embedding": embedding_str
                    }
                ).fetchall()
                
                # Build context from chunks
                context_chunks = [row[0] for row in chunk_results]
                context = "\n\n".join(context_chunks) if context_chunks else ""
                print(f"[STREAM] Found {len(context_chunks)} knowledge base chunks")
                
                # Build messages for LLM
                messages = [
                    {"role": "system", "content": "You are a helpful assistant representing this person. Answer naturally and helpfully."}
                ]
                
                if persona_text:
                    messages.append({"role": "system", "content": f"PERSONA:\n{persona_text}"})
                
                if context:
                    messages.append({"role": "system", "content": f"KNOWLEDGE BASE CONTEXT:\n{context}"})
                
                messages.append({"role": "user", "content": payload.content})
                
                # Stream response from OpenAI
                print(f"[STREAM] Starting OpenAI streaming...")
                stream = openai_client.chat.completions.create(
                    model="gpt-4o-mini",
                    messages=messages,
                    temperature=0.7,
                    stream=True
                )
                
                full_response = ""
                token_count = 0
                for chunk in stream:
                    if chunk.choices[0].delta.content:
                        token = chunk.choices[0].delta.content
                        full_response += token
                        token_count += 1
                        if token_count % 10 == 0:
                            print(f"[STREAM] Streamed {token_count} tokens so far...")
                        yield f"data: {json.dumps({'token': token})}\n\n"
                        # Critical: Allow event loop to process the yield immediately
                        await asyncio.sleep(0)
                
                print(f"[STREAM] Completed streaming {token_count} tokens")
                
                # Store agent response
                if full_response:
                    agent_message = DirectMessage(
                        id=uuid.uuid4(),
                        conversation_id=conv_uuid,
                        sender_user_id=None,
                        sender_type="agent",
                        sender_avee_id=recipient_agent.id,
                        content=full_response,
                        read_by_participant1="false",
                        read_by_participant2="false"
                    )
                    db.add(agent_message)
                    db.commit()
                    db.refresh(agent_message)
                    
                    print(f"[STREAM] Saved message {agent_message.id}")
                    yield f"data: {json.dumps({'event': 'complete', 'message_id': str(agent_message.id), 'mode': 'owner_direct'})}\n\n"
                else:
                    yield f"data: {json.dumps({'event': 'complete', 'mode': 'owner_direct'})}\n\n"
                    
            except Exception as e:
                import traceback
                print(f"[STREAM] ERROR: {str(e)}")
                traceback.print_exc()
                yield f"data: {json.dumps({'event': 'error', 'error': str(e)})}\n\n"
        
        return StreamingResponse(
            owner_stream(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "X-Accel-Buffering": "no",
                "Connection": "keep-alive",
            }
        )
    
    # USER MODE: Route through orchestrator
    # Also activated when force_orchestrator=True (admin toggle)
    mode_reason = "force_orchestrator=True" if payload.force_orchestrator else "user mode"
    print(f"[STREAM] Routing through orchestrator ({mode_reason})")
    async def agent_stream():
        import json
        
        try:
            # Send start event
            print(f"[STREAM] Sending start event")
            yield f"data: {json.dumps({'event': 'start', 'model': 'gpt-4o-mini', 'user_message_id': str(new_message.id)})}\n\n"
            
            # Route through Orchestrator
            print(f"[STREAM] Calling orchestrator...")
            engine = OrchestratorEngine(db)
            decision = await engine.route_message(
                user_id=user_uuid,
                avee_id=recipient_agent.id,
                message=payload.content,
                conversation_id=conv_uuid,
                layer="public"  # TODO: Determine layer based on user relationship
            )
            
            print(f"[STREAM] Orchestrator decision: path={decision.path}")
            
            # Generate response based on decision path
            response_content = None
            
            if decision.path == "A":
                # Path A: Auto-answer with RAG - STREAM IT
                print(f"[STREAM] Path A - Starting RAG streaming...")
                response_generator = _stream_path_a_response(
                    db, recipient_agent.id, payload.content, decision, "public"
                )
                
                # Stream the response token by token
                full_response = ""
                token_count = 0
                async for token in response_generator:
                    full_response += token
                    token_count += 1
                    if token_count % 10 == 0:
                        print(f"[STREAM] Streamed {token_count} tokens...")
                    yield f"data: {json.dumps({'token': token})}\n\n"
                    # Critical: Allow event loop to process the yield immediately
                    await asyncio.sleep(0)
                
                print(f"[STREAM] Completed Path A - {token_count} tokens")
                response_content = full_response
            
            elif decision.path == "B":
                # Path B: Clarification questions
                response_content = await _execute_path_b(payload.content)
                # Stream it token by token for consistency
                for token in response_content.split():
                    yield f"data: {json.dumps({'token': token + ' '})}\n\n"
                    await asyncio.sleep(0.01)  # Small delay for effect
            
            elif decision.path == "C":
                # Path C: Canonical answer
                response_content = _execute_path_c(decision)
                for token in response_content.split():
                    yield f"data: {json.dumps({'token': token + ' '})}\n\n"
                    await asyncio.sleep(0.01)
            
            elif decision.path == "D":
                # Path D: Escalation offer
                response_content = _execute_path_d_message(decision)
                for token in response_content.split():
                    yield f"data: {json.dumps({'token': token + ' '})}\n\n"
                    await asyncio.sleep(0.01)
                
                # Also send escalation data
                yield f"data: {json.dumps({'event': 'escalation_offered', 'escalation_data': decision.action_data})}\n\n"
            
            elif decision.path == "E":
                # Path E: Queue for human - create escalation and notify owner
                system_msg_content = "💭 The AI doesn't have enough context to answer this. The person will reply when they're available."
                for token in system_msg_content.split():
                    yield f"data: {json.dumps({'token': token + ' '})}\n\n"
                    await asyncio.sleep(0.01)
                
                # Create escalation queue entry and notify agent owner
                escalation_id = await _execute_path_e_create_escalation(
                    db=db,
                    conversation_id=conv_uuid,
                    user_id=user_uuid,
                    avee_id=recipient_agent.id,
                    message=payload.content
                )
                
                # Store system message
                system_msg = DirectMessage(
                    id=uuid.uuid4(),
                    conversation_id=conv_uuid,
                    sender_user_id=None,
                    sender_type="system",
                    content=system_msg_content,
                    read_by_participant1="false",
                    read_by_participant2="false"
                )
                db.add(system_msg)
                db.commit()
                db.refresh(system_msg)
                
                yield f"data: {json.dumps({'event': 'complete', 'message_id': str(system_msg.id), 'decision_path': 'E', 'queued_for_human': True, 'escalation_id': escalation_id})}\n\n"
                return
            
            elif decision.path == "F":
                # Path F: Polite refusal
                response_content = _execute_path_f(decision)
                for token in response_content.split():
                    yield f"data: {json.dumps({'token': token + ' '})}\n\n"
                    await asyncio.sleep(0.01)
            
            # Store the agent response (if any)
            if response_content:
                agent_message = DirectMessage(
                    id=uuid.uuid4(),
                    conversation_id=conv_uuid,
                    sender_user_id=None,
                    sender_type="agent",
                    sender_avee_id=recipient_agent.id,
                    content=response_content,
                    read_by_participant1="false",
                    read_by_participant2="false"
                )
                db.add(agent_message)
                db.commit()
                db.refresh(agent_message)
                
                # Send completion event
                yield f"data: {json.dumps({'event': 'complete', 'message_id': str(agent_message.id), 'decision_path': decision.path})}\n\n"
            else:
                # No response generated
                yield f"data: {json.dumps({'event': 'complete', 'decision_path': decision.path})}\n\n"
        
        except Exception as e:
            import traceback
            traceback.print_exc()
            yield f"data: {json.dumps({'event': 'error', 'error': str(e)})}\n\n"
    
    return StreamingResponse(
        agent_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        }
    )


async def _stream_path_a_response(
    db: Session,
    avee_id: uuid.UUID,
    message: str,
    decision,
    layer: str
):
    """Stream Path A response token by token."""
    # Get agent persona
    avee = db.query(Avee).filter(Avee.id == avee_id).first()
    persona_text = (avee.persona or "").strip() if avee else ""
    
    # Build context from top chunks
    context_chunks = [chunk[0] for chunk in decision.signals.top_similar_chunks]
    context = "\n\n".join(context_chunks) if context_chunks else ""
    
    # System prompt based on layer
    layer_prompt = {
        "public": "You are the public version of this person. Be factual, helpful, and safe.",
        "friends": "You are speaking as a trusted friend. Be warm, honest, and respectful.",
        "intimate": "You are a close, intimate digital presence. Be personal, deep, and respectful.",
    }.get(layer, "You are a helpful assistant.")
    
    # Build messages
    messages = [
        {"role": "system", "content": layer_prompt},
    ]
    
    if persona_text:
        messages.append({"role": "system", "content": "PERSONA:\n" + persona_text})
    
    if context:
        messages.append({"role": "system", "content": "CONTEXT (facts you can use):\n" + context})
    
    messages.append({"role": "user", "content": message})
    
    # Stream the response
    stream = openai_client.chat.completions.create(
        model="gpt-4o-mini",
        messages=messages,
        temperature=0.7,
        stream=True
    )
    
    for chunk in stream:
        if chunk.choices[0].delta.content:
            yield chunk.choices[0].delta.content
            # Critical: Allow event loop to process the yield immediately
            await asyncio.sleep(0)

