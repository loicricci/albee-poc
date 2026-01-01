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
from sqlalchemy import or_, and_, func, desc
from pydantic import BaseModel
from datetime import datetime

from db import SessionLocal
from auth_supabase import get_current_user_id
from models import (
    DirectConversation,
    DirectMessage,
    Profile,
    Avee,
    Conversation,
    Message,
)
from orchestrator import OrchestratorEngine
from openai import OpenAI

openai_client = OpenAI()

router = APIRouter(prefix="/messaging", tags=["messaging"])


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
        }
    
    return {
        "id": str(avee.id),
        "handle": avee.handle,
        "display_name": avee.display_name or avee.handle,
        "avatar_url": avee.avatar_url,
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
            # Path E: Queue for human - no agent response
            # Return None so a system message can be added
            print("[ORCHESTRATOR] Path E - Queuing for human response")
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
    - Single batch query for unread counts
    """
    user_uuid = _parse_uuid(user_id, "user_id")
    
    result = []
    
    # Get NEW direct conversations
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
    profiles_query = db.query(Profile).filter(Profile.user_id.in_(participant_ids)).all()
    profiles_map = {str(p.user_id): {
        "user_id": str(p.user_id),
        "handle": p.handle,
        "display_name": p.display_name or p.handle,
        "avatar_url": p.avatar_url,
    } for p in profiles_query}
    
    # Batch load all agents in ONE query  
    avees_map = {}
    if avee_ids:
        avees_query = db.query(Avee).filter(Avee.id.in_(avee_ids)).all()
        avees_map = {str(a.id): {
            "id": str(a.id),
            "handle": a.handle,
            "display_name": a.display_name or a.handle,
            "avatar_url": a.avatar_url,
        } for a in avees_query}
    
    # Batch load unread counts in ONE query using subquery
    unread_counts_map = {}
    for conv in conversations:
        is_participant1 = conv.participant1_user_id == user_uuid
        read_field = "read_by_participant1" if is_participant1 else "read_by_participant2"
        
        unread_count = (
            db.query(DirectMessage)
            .filter(
                DirectMessage.conversation_id == conv.id,
                getattr(DirectMessage, read_field) == "false",
                DirectMessage.sender_user_id != user_uuid,
            )
            .count()
        )
        unread_counts_map[str(conv.id)] = unread_count
    
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
        if conv.chat_type == "agent" and conv.target_avee_id:
            target_avee = avees_map.get(str(conv.target_avee_id))
        
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
        })
    
    # Get LEGACY conversations from old system
    legacy_conversations = (
        db.query(Conversation)
        .filter(Conversation.user_id == user_uuid)
        .order_by(desc(Conversation.created_at))
        .all()
    )
    
    for legacy_conv in legacy_conversations:
        # Get the agent info
        if legacy_conv.avee_id:
            avee = db.query(Avee).filter(Avee.id == legacy_conv.avee_id).first()
            if avee:
                # Get last message
                last_msg = (
                    db.query(Message)
                    .filter(Message.conversation_id == legacy_conv.id)
                    .order_by(desc(Message.created_at))
                    .first()
                )
                
                # Get owner profile
                owner_profile = _get_profile_info(db, avee.owner_user_id)
                
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
                    "last_message_at": last_msg.created_at.isoformat() if last_msg else legacy_conv.created_at.isoformat(),
                    "last_message_preview": last_msg.content[:100] if last_msg else None,
                    "unread_count": 0,  # Legacy system doesn't track read status
                    "is_legacy": True,
                })
    
    # Sort all conversations by last message time
    result.sort(key=lambda x: x["last_message_at"] or "", reverse=True)
    
    return {"conversations": result}


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
        
        # Mark messages as read
        is_participant1 = conv.participant1_user_id == user_uuid
        for msg in messages:
            if msg.sender_user_id != user_uuid:
                if is_participant1 and msg.read_by_participant1 == "false":
                    msg.read_by_participant1 = "true"
                elif not is_participant1 and msg.read_by_participant2 == "false":
                    msg.read_by_participant2 = "true"
        db.commit()
        
        # Build response
        result = []
        for msg in messages:
            sender_info = None
            if msg.sender_type == "user" and msg.sender_user_id:
                sender_info = _get_profile_info(db, msg.sender_user_id)
            elif msg.sender_type == "agent" and msg.sender_avee_id:
                sender_info = _get_avee_info(db, msg.sender_avee_id)
            
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
    
    # Build response for legacy messages
    result = []
    avee = None
    if legacy_conv.avee_id:
        avee = db.query(Avee).filter(Avee.id == legacy_conv.avee_id).first()
    
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
            sender_info = _get_profile_info(db, user_uuid)
        
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
    """
    user_uuid = _parse_uuid(user_id, "user_id")
    
    # Get all agents owned by this user
    my_avees = db.query(Avee).filter(Avee.owner_user_id == user_uuid).all()
    avee_ids = [avee.id for avee in my_avees]
    
    if not avee_ids:
        return {"conversations": []}
    
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
    
    result = []
    for conv in conversations:
        # Get the other participant (not the owner)
        other_user_id = (
            conv.participant1_user_id
            if conv.participant1_user_id != user_uuid
            else conv.participant2_user_id
        )
        
        # Get info
        other_profile = _get_profile_info(db, other_user_id)
        target_avee = _get_avee_info(db, conv.target_avee_id)
        
        # Get last few messages for context
        recent_messages = (
            db.query(DirectMessage)
            .filter(DirectMessage.conversation_id == conv.id)
            .order_by(desc(DirectMessage.created_at))
            .limit(1)
            .all()
        )
        
        result.append({
            "id": str(conv.id),
            "chat_type": conv.chat_type,
            "other_participant": other_profile,
            "target_avee": target_avee,
            "last_message_at": conv.last_message_at.isoformat() if conv.last_message_at else None,
            "last_message_preview": conv.last_message_preview,
            "message_count": db.query(DirectMessage).filter(DirectMessage.conversation_id == conv.id).count(),
        })
    
    return {"conversations": result}


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
    if is_admin_agent:
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
    if is_owner:
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
    print(f"[STREAM] User mode - routing through orchestrator")
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
                # Path E: Queue for human - no agent response
                system_msg_content = "💭 The AI doesn't have enough context to answer this. The person will reply when they're available."
                for token in system_msg_content.split():
                    yield f"data: {json.dumps({'token': token + ' '})}\n\n"
                    await asyncio.sleep(0.01)
                
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
                
                yield f"data: {json.dumps({'event': 'complete', 'message_id': str(system_msg.id), 'decision_path': 'E', 'queued_for_human': True})}\n\n"
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

