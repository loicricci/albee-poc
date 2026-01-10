"""
API endpoints for Native Agents

Provides REST API access to native agents for all users.
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, Dict, Any
from sqlalchemy.orm import Session

from backend.auth_supabase import get_current_user_id
from backend.db import SessionLocal
from backend.models import Profile
from native_agents.registry import get_registry
from native_agents.context_manager import get_context_manager


router = APIRouter(prefix="/native-agents")


# Pydantic models for requests/responses
class QueryRequest(BaseModel):
    query: str
    agent_id: Optional[str] = None
    context: Optional[Dict[str, Any]] = None


class QueryResponse(BaseModel):
    content: str
    data: Optional[Dict[str, Any]] = None
    metadata: Optional[Dict[str, Any]] = None
    timestamp: Optional[str] = None


class AgentInfo(BaseModel):
    agent_id: str
    name: str
    description: str
    requires_location: bool
    supported_queries: list[str]


class AgentListResponse(BaseModel):
    agents: list[AgentInfo]
    count: int


class UpdateLocationRequest(BaseModel):
    location: str
    latitude: str
    longitude: str
    timezone: Optional[str] = None


# Helper functions
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_user_profile_dict(db: Session, user_id: str) -> Dict[str, Any]:
    """
    Get user profile as dictionary for native agents.
    """
    profile = db.query(Profile).filter(Profile.user_id == user_id).first()
    
    if not profile:
        return {}
    
    return {
        "user_id": str(profile.user_id),
        "handle": profile.handle,
        "display_name": profile.display_name,
        "avatar_url": profile.avatar_url,
        "bio": profile.bio,
        "location": profile.location,
        "latitude": profile.latitude,
        "longitude": profile.longitude,
        "timezone": profile.timezone,
        "preferred_tts_voice": profile.preferred_tts_voice
    }


# API Endpoints

@router.get("/", response_model=AgentListResponse)
async def list_native_agents():
    """
    List all available native agents and their capabilities.
    
    This is a public endpoint - anyone can see what agents are available.
    """
    registry = get_registry()
    agents_data = registry.list_agents()
    
    return {
        "agents": agents_data,
        "count": registry.get_agent_count()
    }


@router.get("/{agent_id}")
async def get_agent_info(agent_id: str):
    """
    Get detailed information about a specific native agent.
    """
    registry = get_registry()
    agent = registry.get_agent(agent_id)
    
    if not agent:
        raise HTTPException(status_code=404, detail=f"Agent '{agent_id}' not found")
    
    return agent.get_capabilities()


@router.post("/query", response_model=QueryResponse)
async def query_native_agent(
    request: QueryRequest,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id)
):
    """
    Query a native agent with a user query.
    
    Can either:
    - Specify agent_id to use a specific agent
    - Let the system auto-detect which agent to use based on the query
    
    Requires authentication to access user profile for contextualization.
    """
    
    # Get user profile for contextualization
    user_profile = get_user_profile_dict(db, user_id)
    
    if not user_profile:
        raise HTTPException(status_code=404, detail="User profile not found")
    
    # Get registry and process query
    registry = get_registry()
    
    try:
        response = await registry.process_query(
            user_query=request.query,
            user_profile=user_profile,
            agent_id=request.agent_id,
            context=request.context
        )
        
        return response.to_dict()
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing query: {str(e)}")


@router.post("/me/location")
async def update_my_location(
    request: UpdateLocationRequest,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id)
):
    """
    Update the current user's location for native agents.
    
    This is used by native agents like Weather Agent to provide
    location-specific information.
    """
    
    profile = db.query(Profile).filter(Profile.user_id == user_id).first()
    
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    
    # Update location fields
    profile.location = request.location
    profile.latitude = request.latitude
    profile.longitude = request.longitude
    
    if request.timezone:
        profile.timezone = request.timezone
    
    db.commit()
    db.refresh(profile)
    
    return {
        "message": "Location updated successfully",
        "location": profile.location,
        "coordinates": {
            "latitude": profile.latitude,
            "longitude": profile.longitude
        },
        "timezone": profile.timezone
    }


@router.get("/me/location")
async def get_my_location(
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id)
):
    """
    Get the current user's location information.
    """
    
    profile = db.query(Profile).filter(Profile.user_id == user_id).first()
    
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    
    return {
        "location": profile.location,
        "latitude": profile.latitude,
        "longitude": profile.longitude,
        "timezone": profile.timezone,
        "has_location": bool(profile.latitude and profile.longitude)
    }


@router.post("/weather")
async def quick_weather(
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id)
):
    """
    Quick endpoint to get current weather for the authenticated user.
    Shortcut for querying the weather agent.
    """
    
    user_profile = get_user_profile_dict(db, user_id)
    
    if not user_profile:
        raise HTTPException(status_code=404, detail="User profile not found")
    
    # Check if user has location set
    if not user_profile.get("latitude") or not user_profile.get("longitude"):
        raise HTTPException(
            status_code=400, 
            detail="Please set your location first using POST /native-agents/me/location"
        )
    
    registry = get_registry()
    weather_agent = registry.get_agent("weather")
    
    if not weather_agent:
        raise HTTPException(status_code=500, detail="Weather agent not available")
    
    try:
        response = await weather_agent.process_request(
            user_query="What's the current weather?",
            user_profile=user_profile
        )
        
        return response.to_dict()
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching weather: {str(e)}")


# Context Management Endpoints

@router.get("/context")
async def get_conversation_context(
    user_id: str = Depends(get_current_user_id)
):
    """
    Get the user's conversation history with native agents.
    
    Returns recent conversation messages for display in UI.
    """
    context_manager = get_context_manager()
    
    messages = context_manager.get_context(user_id)
    
    return {
        "has_history": len(messages) > 0,
        "message_count": len(messages),
        "messages": [msg.to_dict() for msg in messages]
    }


@router.post("/context/clear")
async def clear_conversation_context(
    user_id: str = Depends(get_current_user_id)
):
    """
    Clear the user's conversation history with native agents.
    
    Useful for starting a fresh conversation or resetting context.
    """
    context_manager = get_context_manager()
    context_manager.clear_context(user_id)
    
    return {
        "message": "Conversation context cleared successfully"
    }


@router.get("/context/stats")
async def get_context_stats():
    """
    Get statistics about the context manager.
    
    Public endpoint for monitoring/debugging.
    """
    context_manager = get_context_manager()
    stats = context_manager.get_stats()
    
    return stats

