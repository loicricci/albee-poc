"""
Onboarding router for new user profile and agent creation.
Handles multi-step onboarding wizard including handle suggestions,
AI interview, and profile/agent creation.

Includes GDPR-compliant T&C acceptance tracking.
"""

import os
import re
import uuid
import random
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from openai import OpenAI

from backend.db import SessionLocal
from backend.models import Profile, Avee
from backend.auth_supabase import get_current_user_id, get_current_user

router = APIRouter(prefix="/onboarding", tags=["onboarding"])

# Initialize OpenAI client
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# DB session dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Initialize OpenAI client
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# Interview system prompts for different agent types
INTERVIEW_SYSTEM_PROMPT_PERSONA = """You are a friendly AI interviewer helping users create their digital twin persona. 
Ask conversational follow-up questions to learn about:
- Their personality traits and communication style
- Their interests, expertise, and passions
- How they want to be represented in conversations
- Their background and context

Be natural and conversational. Ask one question at a time.

After gathering sufficient information (4-6 exchanges), when you have enough to create a comprehensive persona, 
respond with a JSON object in this format:
{
  "interview_complete": true,
  "suggested_persona": "A 2-3 paragraph persona written in first person that captures their essence"
}

Until then, just continue asking thoughtful follow-up questions to learn more about them."""

INTERVIEW_SYSTEM_PROMPT_COMPANY = """You are a friendly AI interviewer helping users create a digital agent for their company or brand.
Ask conversational follow-up questions to learn about:
- The company's mission, vision, and core values
- Products or services offered
- Target audience and market
- Brand voice and communication style
- Key differentiators and unique selling points
- Company culture and personality

Be professional but friendly. Ask one question at a time.

After gathering sufficient information (4-6 exchanges), when you have enough to create a comprehensive company persona, 
respond with a JSON object in this format:
{
  "interview_complete": true,
  "suggested_persona": "A 2-3 paragraph company profile written in first person plural (we) that captures the brand's essence and voice"
}

Until then, just continue asking thoughtful follow-up questions to learn more about the company."""

def get_interview_prompt(agent_type: str) -> str:
    """Get the appropriate interview system prompt based on agent type."""
    if agent_type == "company":
        return INTERVIEW_SYSTEM_PROMPT_COMPANY
    return INTERVIEW_SYSTEM_PROMPT_PERSONA


# Request/Response Models
class SuggestHandlesRequest(BaseModel):
    name: str


class HandleSuggestion(BaseModel):
    handle: str
    available: bool


class SuggestHandlesResponse(BaseModel):
    suggestions: list[HandleSuggestion]


class InterviewChatRequest(BaseModel):
    message: str
    conversation_history: list[dict] = []
    agent_type: str = "persona"  # 'persona' or 'company'


class InterviewChatResponse(BaseModel):
    reply: str
    suggested_persona: Optional[str] = None
    interview_complete: bool = False


class OnboardingCompleteRequest(BaseModel):
    handle: str
    display_name: Optional[str] = None
    bio: Optional[str] = None
    avatar_url: Optional[str] = None
    persona: Optional[str] = None
    interview_data: Optional[dict] = None
    agent_type: str = "persona"  # 'persona' or 'company'
    # T&C acceptance (optional - can also be read from Supabase user_metadata)
    terms_accepted: Optional[bool] = None
    terms_accepted_at: Optional[str] = None
    terms_version: Optional[str] = None


class OnboardingStatusResponse(BaseModel):
    completed: bool
    has_profile: bool
    has_agent: bool


# Endpoints

@router.get("/status", response_model=OnboardingStatusResponse)
def onboarding_status(
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    """Check if user has completed onboarding"""
    user_uuid = uuid.UUID(user_id)
    profile = db.query(Profile).filter(Profile.user_id == user_uuid).first()
    agent = db.query(Avee).filter(Avee.owner_user_id == user_uuid).first()
    
    return OnboardingStatusResponse(
        completed=profile is not None and agent is not None,
        has_profile=profile is not None,
        has_agent=agent is not None,
    )


@router.post("/suggest-handles", response_model=SuggestHandlesResponse)
def suggest_handles(
    req: SuggestHandlesRequest,
    db: Session = Depends(get_db),
):
    """Generate handle suggestions from user's name and check availability"""
    name = req.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Name is required")
    
    # Parse name into parts
    name_parts = name.lower().split()
    if len(name_parts) == 0:
        raise HTTPException(status_code=400, detail="Invalid name")
    
    # Clean name parts (remove special chars, keep only alphanumeric)
    clean_parts = [re.sub(r'[^a-z0-9]', '', part) for part in name_parts if part]
    if len(clean_parts) == 0:
        raise HTTPException(status_code=400, detail="Invalid name")
    
    first = clean_parts[0]
    last = clean_parts[-1] if len(clean_parts) > 1 else ""
    
    # Generate handle variations
    suggestions_to_check = []
    
    if len(clean_parts) == 1:
        # Single name
        suggestions_to_check = [
            first,
            f"{first}{random.randint(10, 99)}",
            f"{first}_{random.randint(10, 99)}",
            f"{first}{random.randint(100, 999)}",
        ]
    else:
        # Multiple parts (first + last name)
        suggestions_to_check = [
            f"{first}{last}",  # johnsmith
            f"{first}_{last}",  # john_smith
            f"{first[0]}{last}",  # jsmith
            first,  # john
            f"{last}{first}",  # smithjohn
            f"{first}{last}{random.randint(10, 99)}",  # johnsmith23
        ]
    
    # Remove duplicates and limit length
    suggestions_to_check = list(dict.fromkeys(suggestions_to_check))
    suggestions_to_check = [s for s in suggestions_to_check if 3 <= len(s) <= 20]
    
    # Check availability
    results = []
    for handle in suggestions_to_check[:8]:  # Check up to 8 suggestions
        existing = db.query(Profile).filter(Profile.handle == handle).first()
        results.append(HandleSuggestion(
            handle=handle,
            available=existing is None
        ))
    
    # Sort: available first, then by simplicity (shorter = simpler)
    results.sort(key=lambda x: (not x.available, len(x.handle)))
    
    # Return top 6
    return SuggestHandlesResponse(suggestions=results[:6])


@router.post("/interview-chat", response_model=InterviewChatResponse)
async def interview_chat(
    req: InterviewChatRequest,
    user_id: str = Depends(get_current_user_id),
):
    """Conduct AI interview to build user/company persona"""
    if not req.message or not req.message.strip():
        raise HTTPException(status_code=400, detail="Message is required")
    
    # Get appropriate interview prompt based on agent type
    system_prompt = get_interview_prompt(req.agent_type)
    
    # Build conversation for OpenAI
    messages = [{"role": "system", "content": system_prompt}]
    
    # Add conversation history
    for msg in req.conversation_history:
        messages.append({
            "role": msg.get("role", "user"),
            "content": msg.get("content", "")
        })
    
    # Add current message
    messages.append({"role": "user", "content": req.message.strip()})
    
    try:
        # Call OpenAI
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=messages,
            temperature=0.7,
            max_tokens=500,
        )
        
        reply = response.choices[0].message.content
        
        # Check if interview is complete (AI returns JSON with persona)
        interview_complete = False
        suggested_persona = None
        
        if reply and "{" in reply and "interview_complete" in reply.lower():
            try:
                import json
                # Extract JSON from response
                json_start = reply.index("{")
                json_end = reply.rindex("}") + 1
                json_str = reply[json_start:json_end]
                data = json.loads(json_str)
                
                if data.get("interview_complete"):
                    interview_complete = True
                    suggested_persona = data.get("suggested_persona")
                    reply = "Great! I have enough to build your persona. Here's what I came up with:"
            except (ValueError, json.JSONDecodeError):
                pass
        
        return InterviewChatResponse(
            reply=reply,
            suggested_persona=suggested_persona,
            interview_complete=interview_complete,
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI interview failed: {str(e)}")


@router.post("/complete")
async def complete_onboarding(
    req: OnboardingCompleteRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Complete onboarding by creating profile and primary agent.
    
    GDPR Compliance: Requires T&C acceptance before profile creation.
    T&C acceptance is read from Supabase user_metadata (set during signup).
    """
    user_id = current_user["id"]
    user_uuid = uuid.UUID(user_id)
    user_metadata = current_user.get("user_metadata", {})
    
    # Check if profile already exists
    existing_profile = db.query(Profile).filter(Profile.user_id == user_uuid).first()
    if existing_profile:
        raise HTTPException(status_code=400, detail="Profile already exists")
    
    # GDPR Compliance: Extract T&C acceptance from Supabase user_metadata
    # This was set during signup in the frontend
    terms_accepted_at_str = user_metadata.get("terms_accepted_at") or req.terms_accepted_at
    terms_version = user_metadata.get("terms_version") or req.terms_version or "2026-01-15"
    privacy_accepted_at_str = user_metadata.get("privacy_accepted_at") or req.terms_accepted_at
    privacy_version = user_metadata.get("privacy_version") or req.terms_version or "2026-01-15"
    
    # Validate T&C acceptance - REQUIRED for GDPR compliance
    if not terms_accepted_at_str:
        raise HTTPException(
            status_code=400, 
            detail="Terms and Conditions must be accepted to create an account. Please sign up again and accept the Terms."
        )
    
    # Parse datetime
    try:
        terms_accepted_at = datetime.fromisoformat(terms_accepted_at_str.replace("Z", "+00:00"))
        privacy_accepted_at = datetime.fromisoformat(privacy_accepted_at_str.replace("Z", "+00:00")) if privacy_accepted_at_str else terms_accepted_at
    except (ValueError, AttributeError):
        # If parsing fails, use current time (user must have accepted to get here)
        terms_accepted_at = datetime.utcnow()
        privacy_accepted_at = terms_accepted_at
    
    # Validate handle
    handle = req.handle.strip().lower()
    if not handle or len(handle) < 3 or len(handle) > 20:
        raise HTTPException(status_code=400, detail="Handle must be 3-20 characters")
    
    if not re.match(r'^[a-z0-9_]+$', handle):
        raise HTTPException(status_code=400, detail="Handle can only contain letters, numbers, and underscores")
    
    # Check handle availability
    existing_handle = db.query(Profile).filter(Profile.handle == handle).first()
    if existing_handle:
        raise HTTPException(status_code=400, detail="Handle already taken")
    
    # Create profile with T&C acceptance tracking
    display_name = req.display_name or handle
    
    try:
        profile = Profile(
            user_id=user_uuid,
            handle=handle,
            display_name=display_name,
            bio=req.bio,
            avatar_url=req.avatar_url,
            # GDPR: Store T&C acceptance for audit trail
            terms_accepted_at=terms_accepted_at,
            terms_version=terms_version,
            privacy_accepted_at=privacy_accepted_at,
            privacy_version=privacy_version,
        )
        db.add(profile)
        db.flush()  # Flush to get profile created before agent
        
        # Create primary agent (digital twin or company agent)
        # Use AI-generated persona if provided, otherwise create minimal one
        agent_type = req.agent_type if req.agent_type in ("persona", "company") else "persona"
        if agent_type == "company":
            default_persona = f"We are {display_name}, excited to connect with you!"
        else:
            default_persona = f"I'm {display_name}, looking forward to connecting!"
        persona = req.persona or default_persona
        
        agent = Avee(
            id=uuid.uuid4(),
            owner_user_id=user_uuid,
            handle=handle,
            display_name=display_name,
            bio=req.bio,
            avatar_url=req.avatar_url,
            persona=persona,
            agent_type=agent_type,  # persona or company
            is_primary=True,  # Mark as primary agent (boolean)
        )
        db.add(agent)
        db.commit()
        db.refresh(profile)
        db.refresh(agent)
        
        return {
            "ok": True,
            "profile": {
                "user_id": str(profile.user_id),
                "handle": profile.handle,
                "display_name": profile.display_name,
                "bio": profile.bio,
                "avatar_url": profile.avatar_url,
                "terms_accepted_at": profile.terms_accepted_at.isoformat() if profile.terms_accepted_at else None,
                "terms_version": profile.terms_version,
            },
            "agent": {
                "id": str(agent.id),
                "handle": agent.handle,
                "display_name": agent.display_name,
                "persona": agent.persona,
                "agent_type": agent.agent_type,
            }
        }
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to create profile: {str(e)}")

