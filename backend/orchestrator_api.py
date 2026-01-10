"""
Orchestrator API endpoints (v2).

Provides REST API for:
- Message routing through the Orchestrator (simplified 3-path flow)
- Forward-to-owner flow with context storage
- Network notifications when agent learns
- Creator configuration management
- Metrics and analytics
"""

import uuid
import json
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text, desc
from pydantic import BaseModel
from datetime import datetime

from backend.db import SessionLocal
from backend.auth_supabase import get_current_user_id
from backend.orchestrator import OrchestratorEngine, RoutingDecision, ContextStorageService
from backend.models import (
    OrchestratorConfig,
    EscalationQueue,
    OrchestratorDecision,
    Avee,
    Profile,
    DirectConversation,
    DirectMessage,
    Notification,
    AgentUpdate,
    AgentFollower,
)
from openai import OpenAI

router = APIRouter(prefix="/orchestrator", tags=["orchestrator"])
openai_client = OpenAI()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _parse_uuid(value: str, field_name: str = "value") -> uuid.UUID:
    """Parse and validate UUID."""
    try:
        return uuid.UUID(value)
    except Exception:
        raise HTTPException(status_code=400, detail=f"Invalid {field_name}")


# ============================================================================
# Request/Response Models
# ============================================================================

class RouteMessageRequest(BaseModel):
    conversation_id: str
    message: str
    layer: str = "public"


class RouteMessageResponse(BaseModel):
    decision_path: str  # 'A', 'B', 'E', 'P'
    confidence: float
    reason: str
    response: Optional[str] = None  # AI-generated response for paths A, B
    escalation_id: Optional[str] = None  # For path E (forward to owner)
    waiting_for_owner: bool = False  # True when forwarded to owner
    action_data: dict


class UpdateConfigRequest(BaseModel):
    auto_answer_confidence_threshold: Optional[float] = None  # 0.0-1.0
    clarification_enabled: Optional[bool] = None


class OwnerReplyRequest(BaseModel):
    answer: str
    layer: str = "public"


class PendingQuestionResponse(BaseModel):
    id: str
    conversation_id: str
    user_info: dict
    original_message: str
    context_summary: Optional[str]
    status: str
    created_at: str


# ============================================================================
# Main Message Routing Endpoint
# ============================================================================

@router.post("/message", response_model=RouteMessageResponse)
async def route_message(
    payload: RouteMessageRequest,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    """
    Main Orchestrator entry point (v2).
    
    Routes a message through the simplified decision engine:
    - Path P: Policy violation (content moderation failed)
    - Path B: Clarification needed (vague query)
    - Path A: Auto-answer with RAG (confidence >= threshold)
    - Path E: Forward to owner (insufficient context)
    """
    user_uuid = _parse_uuid(user_id, "user_id")
    conversation_uuid = _parse_uuid(payload.conversation_id, "conversation_id")
    
    # Get conversation to determine avee_id
    conversation = db.query(DirectConversation).filter(
        DirectConversation.id == conversation_uuid
    ).first()
    
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    if not conversation.target_avee_id:
        raise HTTPException(status_code=400, detail="Conversation has no agent")
    
    # Verify user is participant
    if conversation.participant1_user_id != user_uuid and conversation.participant2_user_id != user_uuid:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Route through Orchestrator
    engine = OrchestratorEngine(db)
    decision = await engine.route_message(
        user_id=user_uuid,
        avee_id=conversation.target_avee_id,
        message=payload.message,
        conversation_id=conversation_uuid,
        layer=payload.layer
    )
    
    # Execute action based on path
    response_text = None
    escalation_id = None
    waiting_for_owner = False
    
    if decision.path == "P":
        # Path P: Policy violation
        response_text = await _execute_path_policy_violation(decision)
    
    elif decision.path == "A":
        # Path A: Auto-answer using RAG
        response_text = await _execute_path_auto_answer(
            db, conversation.target_avee_id, payload.message, decision, payload.layer
        )
    
    elif decision.path == "B":
        # Path B: Generate clarification questions
        response_text = await _execute_path_clarification(payload.message)
    
    elif decision.path == "E":
        # Path E: Forward to owner
        escalation_id, response_text = await _execute_path_forward_to_owner(
            db, conversation_uuid, user_uuid, conversation.target_avee_id, 
            payload.message, decision
        )
        waiting_for_owner = True
    
    # Store the user message
    user_message = DirectMessage(
        conversation_id=conversation_uuid,
        sender_user_id=user_uuid,
        sender_type="user",
        content=payload.message,
        read_by_participant1="true" if conversation.participant1_user_id == user_uuid else "false",
        read_by_participant2="true" if conversation.participant2_user_id == user_uuid else "false"
    )
    db.add(user_message)
    
    # If there's a response, store it
    if response_text:
        agent_message = DirectMessage(
            conversation_id=conversation_uuid,
            sender_user_id=None,
            sender_type="agent",
            sender_avee_id=conversation.target_avee_id,
            content=response_text,
            read_by_participant1="false",
            read_by_participant2="false"
        )
        db.add(agent_message)
    
    db.commit()
    
    return RouteMessageResponse(
        decision_path=decision.path,
        confidence=decision.confidence,
        reason=decision.reason,
        response=response_text,
        escalation_id=escalation_id,
        waiting_for_owner=waiting_for_owner,
        action_data=decision.action_data
    )


# ============================================================================
# Path Execution Functions
# ============================================================================

async def _execute_path_policy_violation(decision: RoutingDecision) -> str:
    """Execute Path P: Content policy violation response."""
    flagged_categories = decision.action_data.get("flagged_categories", [])
    
    # Generic refusal message (don't reveal specific categories to user)
    return (
        "I'm sorry, but I cannot respond to this message as it appears to "
        "violate our content guidelines. Please rephrase your question in a "
        "respectful and appropriate manner."
    )


async def _execute_path_auto_answer(
    db: Session,
    avee_id: uuid.UUID,
    message: str,
    decision: RoutingDecision,
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


async def _execute_path_clarification(message: str) -> str:
    """Execute Path B: Ask clarification questions."""
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


async def _execute_path_forward_to_owner(
    db: Session,
    conversation_id: uuid.UUID,
    user_id: uuid.UUID,
    avee_id: uuid.UUID,
    message: str,
    decision: RoutingDecision
) -> tuple[str, str]:
    """
    Execute Path E: Forward to agent owner.
    
    Returns:
        Tuple of (escalation_id, waiting_message)
    """
    # Generate context summary
    context_summary = await _generate_context_summary(db, conversation_id, user_id)
    
    # Create escalation queue entry (repurposing for forward-to-owner)
    escalation = EscalationQueue(
        conversation_id=conversation_id,
        user_id=user_id,
        avee_id=avee_id,
        original_message=message,
        context_summary=context_summary,
        escalation_reason="forwarded",  # New reason type
        status="pending"
    )
    db.add(escalation)
    db.commit()
    db.refresh(escalation)
    
    # Notify the agent owner
    avee = db.query(Avee).filter(Avee.id == avee_id).first()
    if avee and avee.owner_user_id:
        # Get sender info
        sender_profile = db.query(Profile).filter(Profile.user_id == user_id).first()
        sender_name = sender_profile.display_name if sender_profile else "Someone"
        
        notification = Notification(
            user_id=avee.owner_user_id,
            notification_type="question_forwarded",
            title="New Question for Your Agent",
            message=f"{sender_name} asked a question that needs your response: \"{message[:100]}...\"" if len(message) > 100 else f"{sender_name} asked: \"{message}\"",
            link=f"/messages?escalation={escalation.id}",
            related_user_id=user_id,
            related_agent_id=avee_id,
            is_read="false"
        )
        db.add(notification)
        db.commit()
    
    # Return waiting message to sender
    waiting_message = (
        "Thank you for your question! I don't have enough information to answer this "
        "confidently right now. I've forwarded your question to get a response. "
        "You'll be notified when an answer is available."
    )
    
    return str(escalation.id), waiting_message


async def _generate_context_summary(
    db: Session,
    conversation_id: uuid.UUID,
    user_id: uuid.UUID
) -> str:
    """Generate a context summary for the owner."""
    # Get last 5 messages
    messages = db.query(DirectMessage).filter(
        DirectMessage.conversation_id == conversation_id
    ).order_by(desc(DirectMessage.created_at)).limit(5).all()
    
    # Get user profile
    profile = db.query(Profile).filter(Profile.user_id == user_id).first()
    
    # Build summary
    summary_parts = []
    
    if profile:
        summary_parts.append(f"User: @{profile.handle} ({profile.display_name or 'Unknown'})")
    
    if messages:
        summary_parts.append(f"\nRecent conversation ({len(messages)} messages):")
        for msg in reversed(messages):
            role = "User" if msg.sender_type == "user" else "Agent"
            content_preview = msg.content[:100] + "..." if len(msg.content) > 100 else msg.content
            summary_parts.append(f"- {role}: {content_preview}")
    
    return "\n".join(summary_parts)


# ============================================================================
# Owner Reply Endpoint
# ============================================================================

@router.post("/owner-reply/{escalation_id}")
async def owner_reply(
    escalation_id: str,
    payload: OwnerReplyRequest,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    """
    Owner answers a forwarded question.
    
    This endpoint:
    1. Stores the answer as a message in the conversation
    2. Stores the Q&A as new context for the agent (DocumentChunk)
    3. Notifies followers that the agent has been updated
    4. Notifies the original sender that an answer is available
    """
    esc_uuid = _parse_uuid(escalation_id, "escalation_id")
    user_uuid = _parse_uuid(user_id, "user_id")
    
    # Get escalation
    escalation = db.query(EscalationQueue).filter(
        EscalationQueue.id == esc_uuid
    ).first()
    
    if not escalation:
        raise HTTPException(status_code=404, detail="Question not found")
    
    # Verify ownership
    avee = db.query(Avee).filter(Avee.id == escalation.avee_id).first()
    if not avee or avee.owner_user_id != user_uuid:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    if escalation.status == "answered":
        raise HTTPException(status_code=400, detail="Question already answered")
    
    # Update escalation status
    escalation.status = "answered"
    escalation.answered_at = datetime.utcnow()
    escalation.creator_answer = payload.answer
    escalation.answer_layer = payload.layer
    
    # Store as message in conversation
    agent_message = DirectMessage(
        conversation_id=escalation.conversation_id,
        sender_user_id=None,
        sender_type="agent",
        sender_avee_id=escalation.avee_id,
        content=payload.answer,
        read_by_participant1="false",
        read_by_participant2="false"
    )
    db.add(agent_message)
    
    # Store Q&A as new context for future RAG
    context_service = ContextStorageService(db)
    chunk_id = await context_service.store_qa_as_context(
        avee_id=escalation.avee_id,
        question=escalation.original_message,
        answer=payload.answer,
        layer=payload.layer,
        escalation_id=escalation.id
    )
    
    # Notify the original sender that an answer is available
    sender_notification = Notification(
        user_id=escalation.user_id,
        notification_type="answer_received",
        title="Your Question Was Answered",
        message=f"Your question has been answered! Check your messages to see the response.",
        link=f"/messages?conversation={escalation.conversation_id}",
        related_agent_id=escalation.avee_id,
        is_read="false"
    )
    db.add(sender_notification)
    
    # Notify network (followers) that agent was updated
    await _notify_network_agent_updated(db, avee, escalation.original_message)
    
    db.commit()
    
    return {
        "success": True,
        "message": "Answer sent successfully",
        "context_chunk_id": str(chunk_id)
    }


async def _notify_network_agent_updated(
    db: Session,
    avee: Avee,
    question_preview: str
):
    """
    Notify the network that an agent has learned something new.
    Creates an agent update and notifies followers.
    """
    # Create an agent update announcing the learning
    update_title = "New knowledge acquired"
    update_content = f"🧠 I just learned something new! Someone asked about: \"{question_preview[:100]}...\"" if len(question_preview) > 100 else f"🧠 I just learned something new! Someone asked: \"{question_preview}\""
    
    agent_update = AgentUpdate(
        avee_id=avee.id,
        owner_user_id=avee.owner_user_id,
        title=update_title,
        content=update_content,
        topic="learning",
        layer="public"
    )
    db.add(agent_update)
    db.flush()  # Get the ID without committing
    
    # Notify all followers
    followers = db.query(AgentFollower).filter(
        AgentFollower.avee_id == avee.id
    ).all()
    
    for follower in followers:
        notification = Notification(
            user_id=follower.follower_user_id,
            notification_type="agent_update",
            title=f"{avee.name or 'Agent'} learned something new",
            message="The agent has been updated with new knowledge from a user question.",
            link=f"/agent/{avee.id}",
            related_agent_id=avee.id,
            related_update_id=agent_update.id,
            is_read="false"
        )
        db.add(notification)


# ============================================================================
# Pending Questions (for owner dashboard)
# ============================================================================

@router.get("/pending-questions")
def get_pending_questions(
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    """Get pending questions forwarded to the owner's agents."""
    user_uuid = _parse_uuid(user_id, "user_id")
    
    # Get all agents owned by user
    avees = db.query(Avee).filter(Avee.owner_user_id == user_uuid).all()
    avee_ids = [avee.id for avee in avees]
    
    if not avee_ids:
        return {"pending_questions": []}
    
    # Get pending escalations (forwarded questions)
    escalations = db.query(EscalationQueue).filter(
        EscalationQueue.avee_id.in_(avee_ids),
        EscalationQueue.status == "pending"
    ).order_by(desc(EscalationQueue.offered_at)).all()
    
    result = []
    for esc in escalations:
        # Get user info
        user = db.query(Profile).filter(Profile.user_id == esc.user_id).first()
        user_info = {
            "user_id": str(esc.user_id),
            "handle": user.handle if user else "unknown",
            "display_name": user.display_name if user else "Unknown",
            "avatar_url": user.avatar_url if user else None
        }
        
        # Get agent info
        avee = next((a for a in avees if a.id == esc.avee_id), None)
        
        result.append({
            "id": str(esc.id),
            "conversation_id": str(esc.conversation_id),
            "avee_id": str(esc.avee_id),
            "avee_name": avee.display_name if avee else "Unknown Agent",
            "user_info": user_info,
            "original_message": esc.original_message,
            "context_summary": esc.context_summary,
            "status": esc.status,
            "created_at": esc.offered_at.isoformat() if esc.offered_at else None
        })
    
    return {"pending_questions": result}


@router.get("/queue")
def get_escalation_queue(
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    """
    Get all escalations for the owner's agents.
    This is an alias for the escalations page UI.
    """
    user_uuid = _parse_uuid(user_id, "user_id")
    
    # Get all agents owned by user
    avees = db.query(Avee).filter(Avee.owner_user_id == user_uuid).all()
    avee_ids = [avee.id for avee in avees]
    
    if not avee_ids:
        return {"escalations": []}
    
    # Get ALL escalations (not just pending) for the queue view
    escalations = db.query(EscalationQueue).filter(
        EscalationQueue.avee_id.in_(avee_ids)
    ).order_by(desc(EscalationQueue.offered_at)).all()
    
    result = []
    for esc in escalations:
        # Get user info
        user = db.query(Profile).filter(Profile.user_id == esc.user_id).first()
        user_info = {
            "user_id": str(esc.user_id),
            "handle": user.handle if user else "unknown",
            "display_name": user.display_name if user else "Unknown",
            "avatar_url": user.avatar_url if user else None
        }
        
        # Get agent info for the update endpoint
        agent = db.query(Avee).filter(Avee.id == esc.avee_id).first()
        
        result.append({
            "id": str(esc.id),
            "avee_id": str(esc.avee_id),
            "avee_handle": agent.handle if agent else None,
            "conversation_id": str(esc.conversation_id),
            "user_info": user_info,
            "original_message": esc.original_message,
            "context_summary": esc.context_summary,
            "escalation_reason": esc.escalation_reason,
            "status": esc.status,
            "offered_at": esc.offered_at.isoformat() if esc.offered_at else None,
            "accepted_at": esc.accepted_at.isoformat() if esc.accepted_at else None,
        })
    
    return {"escalations": result}


@router.post("/queue/{escalation_id}/answer")
async def answer_escalation_alias(
    escalation_id: str,
    payload: OwnerReplyRequest,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    """Alias for owner_reply endpoint - used by escalations page."""
    return await owner_reply(escalation_id, payload, db, user_id)


@router.post("/queue/{escalation_id}/decline")
def decline_escalation(
    escalation_id: str,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    """Decline an escalation request."""
    esc_uuid = _parse_uuid(escalation_id, "escalation_id")
    user_uuid = _parse_uuid(user_id, "user_id")
    
    # Get escalation
    escalation = db.query(EscalationQueue).filter(
        EscalationQueue.id == esc_uuid
    ).first()
    
    if not escalation:
        raise HTTPException(status_code=404, detail="Escalation not found")
    
    # Verify ownership
    avee = db.query(Avee).filter(Avee.id == escalation.avee_id).first()
    if not avee or avee.owner_user_id != user_uuid:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Update status to declined
    escalation.status = "declined"
    db.commit()
    
    return {"success": True, "message": "Escalation declined"}


class MarkAnsweredRequest(BaseModel):
    answer: str
    layer: str = "public"


@router.post("/queue/{escalation_id}/mark-answered")
async def mark_escalation_answered(
    escalation_id: str,
    payload: MarkAnsweredRequest,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    """Mark an escalation as answered and send the reply to the conversation."""
    esc_uuid = _parse_uuid(escalation_id, "escalation_id")
    user_uuid = _parse_uuid(user_id, "user_id")
    
    # Get escalation
    escalation = db.query(EscalationQueue).filter(
        EscalationQueue.id == esc_uuid
    ).first()
    
    if not escalation:
        raise HTTPException(status_code=404, detail="Escalation not found")
    
    # Verify ownership
    avee = db.query(Avee).filter(Avee.id == escalation.avee_id).first()
    if not avee or avee.owner_user_id != user_uuid:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Update status to answered
    escalation.status = "answered"
    escalation.answered_at = datetime.utcnow()
    escalation.creator_answer = payload.answer
    escalation.answer_layer = payload.layer
    
    # Send reply message to the conversation
    agent_message = DirectMessage(
        conversation_id=escalation.conversation_id,
        sender_user_id=None,
        sender_type="agent",
        sender_avee_id=escalation.avee_id,
        content=payload.answer,
        human_validated="true",  # Mark as human-validated answer
        read_by_participant1="false",
        read_by_participant2="false"
    )
    db.add(agent_message)
    
    # Store Q&A as context for future RAG
    try:
        context_service = ContextStorageService(db)
        await context_service.store_qa_as_context(
            avee_id=escalation.avee_id,
            question=escalation.original_message,
            answer=payload.answer,
            layer=payload.layer,
            escalation_id=escalation.id
        )
    except Exception as e:
        print(f"Error storing Q&A context: {e}")
    
    # Notify the original sender
    sender_notification = Notification(
        user_id=escalation.user_id,
        notification_type="answer_received",
        title="Your Question Was Answered",
        message=f"Your question has been answered! Check your messages.",
        link=f"/messages",
        related_agent_id=escalation.avee_id,
        is_read="false"
    )
    db.add(sender_notification)
    
    db.commit()
    
    return {"success": True, "message": "Escalation answered and reply sent"}


# ============================================================================
# Configuration Management (Simplified)
# ============================================================================

@router.get("/config/{avee_id}")
def get_orchestrator_config(
    avee_id: str,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    """Get orchestrator configuration for an agent (simplified)."""
    avee_uuid = _parse_uuid(avee_id, "avee_id")
    user_uuid = _parse_uuid(user_id, "user_id")
    
    # Verify ownership
    avee = db.query(Avee).filter(Avee.id == avee_uuid).first()
    if not avee:
        raise HTTPException(status_code=404, detail="Agent not found")
    if avee.owner_user_id != user_uuid:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Get config
    config = db.query(OrchestratorConfig).filter(
        OrchestratorConfig.avee_id == avee_uuid
    ).first()
    
    if not config:
        # Create default
        config = OrchestratorConfig(avee_id=avee_uuid)
        db.add(config)
        db.commit()
        db.refresh(config)
    
    # Convert threshold to float for JSON serialization
    threshold = config.auto_answer_confidence_threshold
    if hasattr(threshold, '__float__'):
        threshold = float(threshold)
    
    return {
        "avee_id": str(config.avee_id),
        "auto_answer_confidence_threshold": threshold,
        "clarification_enabled": config.clarification_enabled == "true" if isinstance(config.clarification_enabled, str) else config.clarification_enabled,
    }


@router.put("/config/{avee_id}")
def update_orchestrator_config(
    avee_id: str,
    payload: UpdateConfigRequest,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    """Update orchestrator configuration (simplified)."""
    avee_uuid = _parse_uuid(avee_id, "avee_id")
    user_uuid = _parse_uuid(user_id, "user_id")
    
    # Verify ownership
    avee = db.query(Avee).filter(Avee.id == avee_uuid).first()
    if not avee:
        raise HTTPException(status_code=404, detail="Agent not found")
    if avee.owner_user_id != user_uuid:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Get or create config
    config = db.query(OrchestratorConfig).filter(
        OrchestratorConfig.avee_id == avee_uuid
    ).first()
    
    if not config:
        config = OrchestratorConfig(avee_id=avee_uuid)
        db.add(config)
    
    # Update fields
    if payload.auto_answer_confidence_threshold is not None:
        config.auto_answer_confidence_threshold = payload.auto_answer_confidence_threshold
    if payload.clarification_enabled is not None:
        config.clarification_enabled = "true" if payload.clarification_enabled else "false"
    
    db.commit()
    db.refresh(config)
    
    return {"success": True, "message": "Configuration updated"}


# ============================================================================
# Metrics and Analytics
# ============================================================================

@router.get("/metrics/{avee_id}")
def get_orchestrator_metrics(
    avee_id: str,
    days: int = 7,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    """Get orchestrator metrics for an agent."""
    avee_uuid = _parse_uuid(avee_id, "avee_id")
    user_uuid = _parse_uuid(user_id, "user_id")
    
    # Verify ownership
    avee = db.query(Avee).filter(Avee.id == avee_uuid).first()
    if not avee:
        raise HTTPException(status_code=404, detail="Agent not found")
    if avee.owner_user_id != user_uuid:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Calculate metrics manually for new paths
    from datetime import timedelta
    start_date = datetime.utcnow() - timedelta(days=days)
    
    decisions = db.query(OrchestratorDecision).filter(
        OrchestratorDecision.avee_id == avee_uuid,
        OrchestratorDecision.created_at >= start_date
    ).all()
    
    total = len(decisions)
    auto_answered = sum(1 for d in decisions if d.decision_path == "A")
    clarifications = sum(1 for d in decisions if d.decision_path == "B")
    forwarded = sum(1 for d in decisions if d.decision_path == "E")
    policy_violations = sum(1 for d in decisions if d.decision_path == "P")
    
    # Get answered count from escalation queue
    answered = db.query(EscalationQueue).filter(
        EscalationQueue.avee_id == avee_uuid,
        EscalationQueue.status == "answered",
        EscalationQueue.offered_at >= start_date
    ).count()
    
    avg_confidence = sum(float(d.confidence_score or 0) for d in decisions) / total if total > 0 else 0
    
    return {
        "total_messages": total,
        "auto_answered": auto_answered,
        "clarifications": clarifications,
        "forwarded_to_owner": forwarded,
        "owner_answered": answered,
        "policy_violations": policy_violations,
        "avg_confidence": round(avg_confidence, 4),
        "auto_answer_rate": round(auto_answered / total, 4) if total > 0 else 0
    }
