"""
Orchestrator API endpoints.

Provides REST API for:
- Message routing through the Orchestrator
- Creator configuration management
- Escalation queue management
- Metrics and analytics
"""

import uuid
import json
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text, func, desc
from pydantic import BaseModel
from datetime import datetime

from db import SessionLocal
from auth_supabase import get_current_user_id
from orchestrator import OrchestratorEngine, RoutingDecision
from models import (
    OrchestratorConfig,
    EscalationQueue,
    OrchestratorDecision,
    CanonicalAnswer,
    Avee,
    Profile,
    DirectConversation,
    DirectMessage,
)
from openai_embed import embed_texts
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
    decision_path: str
    confidence: float
    reason: str
    response: Optional[str] = None  # AI-generated response for paths A, B, C
    escalation_id: Optional[str] = None  # For path D
    action_data: dict


class UpdateConfigRequest(BaseModel):
    max_escalations_per_day: Optional[int] = None
    max_escalations_per_week: Optional[int] = None
    escalation_enabled: Optional[bool] = None
    auto_answer_confidence_threshold: Optional[int] = None  # 0-100
    clarification_enabled: Optional[bool] = None
    blocked_topics: Optional[List[str]] = None
    allowed_user_tiers: Optional[List[str]] = None


class AnswerEscalationRequest(BaseModel):
    answer: str
    layer: str = "public"


class EscalationResponse(BaseModel):
    id: str
    conversation_id: str
    user_info: dict
    original_message: str
    context_summary: Optional[str]
    escalation_reason: str
    status: str
    offered_at: str
    accepted_at: Optional[str]


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
    Main Orchestrator entry point.
    Routes a message through the decision engine and executes the appropriate action.
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
    
    if decision.path == "A":
        # Path A: Auto-answer using RAG
        response_text = await _execute_path_a(
            db, conversation.target_avee_id, payload.message, decision, payload.layer
        )
    
    elif decision.path == "B":
        # Path B: Generate clarification questions
        response_text = await _execute_path_b(payload.message)
    
    elif decision.path == "C":
        # Path C: Serve canonical answer
        response_text = await _execute_path_c(decision)
    
    elif decision.path == "D":
        # Path D: Create escalation offer
        escalation_id = await _execute_path_d(
            db, conversation_uuid, user_uuid, conversation.target_avee_id, payload.message, decision
        )
    
    elif decision.path == "F":
        # Path F: Polite refusal
        response_text = await _execute_path_f(decision)
    
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
        action_data=decision.action_data
    )


# ============================================================================
# Path Execution Functions
# ============================================================================

async def _execute_path_a(
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


async def _execute_path_c(decision: RoutingDecision) -> str:
    """Execute Path C: Serve canonical answer."""
    canonical_content = decision.action_data.get("canonical_content", "")
    similarity = decision.action_data.get("similarity", 0.0)
    
    # Adapt the canonical answer slightly
    response = f"{canonical_content}\n\n_Note: This answer is based on a similar question I've answered before (similarity: {similarity:.0%})._"
    return response


async def _execute_path_d(
    db: Session,
    conversation_id: uuid.UUID,
    user_id: uuid.UUID,
    avee_id: uuid.UUID,
    message: str,
    decision: RoutingDecision
) -> str:
    """Execute Path D: Create escalation offer."""
    # Generate context summary
    context_summary = await _generate_context_summary(db, conversation_id, user_id)
    
    # Create escalation queue entry
    escalation = EscalationQueue(
        conversation_id=conversation_id,
        user_id=user_id,
        avee_id=avee_id,
        original_message=message,
        context_summary=context_summary,
        escalation_reason=decision.action_data.get("escalation_reason", "novel"),
        status="pending"
    )
    db.add(escalation)
    db.commit()
    db.refresh(escalation)
    
    return str(escalation.id)


async def _execute_path_f(decision: RoutingDecision) -> str:
    """Execute Path F: Polite refusal."""
    refusal_reason = decision.action_data.get("refusal_reason", "unknown")
    
    responses = {
        "escalations_disabled": "I appreciate your question, but the creator has temporarily disabled escalations. Please try asking in a different way, or check back later.",
        "tier_not_allowed": "This question requires escalation, which is currently available only to followers and premium members. Consider following to get access!",
        "daily_limit_reached": "The creator has reached their daily limit for answering questions. Your question is valuable! Please try again tomorrow.",
        "weekly_limit_reached": "The creator has reached their weekly limit for personalized answers. Please check back next week, or browse existing content.",
    }
    
    return responses.get(refusal_reason, "I'm unable to process this request at the moment. Please try rephrasing your question.")


async def _generate_context_summary(
    db: Session,
    conversation_id: uuid.UUID,
    user_id: uuid.UUID
) -> str:
    """Generate a context summary for escalation."""
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
# Configuration Management
# ============================================================================

@router.get("/config/{avee_id}")
def get_orchestrator_config(
    avee_id: str,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    """Get orchestrator configuration for an agent."""
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
    
    return {
        "avee_id": str(config.avee_id),
        "max_escalations_per_day": config.max_escalations_per_day,
        "max_escalations_per_week": config.max_escalations_per_week,
        "escalation_enabled": config.escalation_enabled == "true",
        "auto_answer_confidence_threshold": config.auto_answer_confidence_threshold,
        "clarification_enabled": config.clarification_enabled == "true",
        "blocked_topics": json.loads(config.blocked_topics),
        "allowed_user_tiers": json.loads(config.allowed_user_tiers),
    }


@router.put("/config/{avee_id}")
def update_orchestrator_config(
    avee_id: str,
    payload: UpdateConfigRequest,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    """Update orchestrator configuration."""
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
    if payload.max_escalations_per_day is not None:
        config.max_escalations_per_day = payload.max_escalations_per_day
    if payload.max_escalations_per_week is not None:
        config.max_escalations_per_week = payload.max_escalations_per_week
    if payload.escalation_enabled is not None:
        config.escalation_enabled = "true" if payload.escalation_enabled else "false"
    if payload.auto_answer_confidence_threshold is not None:
        config.auto_answer_confidence_threshold = payload.auto_answer_confidence_threshold
    if payload.clarification_enabled is not None:
        config.clarification_enabled = "true" if payload.clarification_enabled else "false"
    if payload.blocked_topics is not None:
        config.blocked_topics = json.dumps(payload.blocked_topics)
    if payload.allowed_user_tiers is not None:
        config.allowed_user_tiers = json.dumps(payload.allowed_user_tiers)
    
    db.commit()
    db.refresh(config)
    
    return {"success": True, "message": "Configuration updated"}


# ============================================================================
# Escalation Queue Management
# ============================================================================

@router.get("/queue")
def get_escalation_queue(
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    """Get escalation queue for creator's agents."""
    user_uuid = _parse_uuid(user_id, "user_id")
    
    # Get all agents owned by user
    avees = db.query(Avee).filter(Avee.owner_user_id == user_uuid).all()
    avee_ids = [avee.id for avee in avees]
    
    if not avee_ids:
        return {"escalations": []}
    
    # Get pending escalations
    escalations = db.query(EscalationQueue).filter(
        EscalationQueue.avee_id.in_(avee_ids),
        EscalationQueue.status.in_(["pending", "accepted"])
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
        
        result.append({
            "id": str(esc.id),
            "conversation_id": str(esc.conversation_id),
            "user_info": user_info,
            "original_message": esc.original_message,
            "context_summary": esc.context_summary,
            "escalation_reason": esc.escalation_reason,
            "status": esc.status,
            "offered_at": esc.offered_at.isoformat() if esc.offered_at else None,
            "accepted_at": esc.accepted_at.isoformat() if esc.accepted_at else None
        })
    
    return {"escalations": result}


@router.post("/queue/{escalation_id}/answer")
def answer_escalation(
    escalation_id: str,
    payload: AnswerEscalationRequest,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    """Creator answers an escalation."""
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
    
    # Update escalation
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
    
    db.commit()
    
    # Note: Canonical answer will be auto-created by trigger
    
    return {"success": True, "message": "Answer sent successfully"}


@router.post("/queue/{escalation_id}/decline")
def decline_escalation(
    escalation_id: str,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    """Creator declines an escalation."""
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
    
    # Update status
    escalation.status = "declined"
    db.commit()
    
    return {"success": True, "message": "Escalation declined"}


# ============================================================================
# Accept Escalation (User side)
# ============================================================================

@router.post("/queue/{escalation_id}/accept")
def accept_escalation(
    escalation_id: str,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    """User accepts an escalation offer."""
    esc_uuid = _parse_uuid(escalation_id, "escalation_id")
    user_uuid = _parse_uuid(user_id, "user_id")
    
    # Get escalation
    escalation = db.query(EscalationQueue).filter(
        EscalationQueue.id == esc_uuid
    ).first()
    
    if not escalation:
        raise HTTPException(status_code=404, detail="Escalation not found")
    
    # Verify user
    if escalation.user_id != user_uuid:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    if escalation.status != "pending":
        raise HTTPException(status_code=400, detail="Escalation already processed")
    
    # Update status
    escalation.status = "accepted"
    escalation.accepted_at = datetime.utcnow()
    db.commit()
    
    return {"success": True, "message": "Escalation accepted, creator will be notified"}


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
    
    # Use the SQL function
    result = db.execute(
        text("SELECT * FROM get_orchestrator_metrics(:avee_id, :days)"),
        {"avee_id": str(avee_uuid), "days": days}
    ).fetchone()
    
    if not result:
        return {
            "total_messages": 0,
            "auto_answered": 0,
            "escalations_offered": 0,
            "escalations_accepted": 0,
            "escalations_answered": 0,
            "canonical_reused": 0,
            "avg_confidence": 0.0,
            "avg_novelty": 0.0,
            "auto_answer_rate": 0.0
        }
    
    return {
        "total_messages": result[0],
        "auto_answered": result[1],
        "escalations_offered": result[2],
        "escalations_accepted": result[3],
        "escalations_answered": result[4],
        "canonical_reused": result[5],
        "avg_confidence": float(result[6]) if result[6] else 0.0,
        "avg_novelty": float(result[7]) if result[7] else 0.0,
        "auto_answer_rate": float(result[8]) if result[8] else 0.0
    }




