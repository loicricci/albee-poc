"""
Base Native Agent class

All native agents must inherit from this base class and implement the required methods.
"""

from abc import ABC, abstractmethod
from typing import Dict, Any, Optional
from dataclasses import dataclass
from datetime import datetime


@dataclass
class AgentResponse:
    """Response from a native agent"""
    
    content: str  # The main response text
    data: Optional[Dict[str, Any]] = None  # Structured data (e.g., weather data)
    metadata: Optional[Dict[str, Any]] = None  # Additional metadata
    timestamp: datetime = None
    
    def __post_init__(self):
        if self.timestamp is None:
            self.timestamp = datetime.utcnow()
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert response to dictionary for API responses"""
        return {
            "content": self.content,
            "data": self.data,
            "metadata": self.metadata,
            "timestamp": self.timestamp.isoformat() if self.timestamp else None
        }


class NativeAgent(ABC):
    """
    Base class for all native agents.
    
    Native agents are system-level agents that provide contextual information
    based on user profile data. They can be queried by any user and deliver
    personalized responses.
    """
    
    def __init__(self):
        self.agent_id = self.get_agent_id()
        self.name = self.get_name()
        self.description = self.get_description()
    
    @abstractmethod
    def get_agent_id(self) -> str:
        """
        Return unique identifier for this agent.
        Example: "weather", "news", "finance"
        """
        pass
    
    @abstractmethod
    def get_name(self) -> str:
        """
        Return human-readable name for this agent.
        Example: "Weather Agent", "News Agent"
        """
        pass
    
    @abstractmethod
    def get_description(self) -> str:
        """
        Return description of what this agent does.
        """
        pass
    
    @abstractmethod
    async def process_request(
        self, 
        user_query: str, 
        user_profile: Dict[str, Any],
        context: Optional[Dict[str, Any]] = None
    ) -> AgentResponse:
        """
        Process a user request and return a response.
        
        Args:
            user_query: The user's natural language query
            user_profile: User profile data including location, preferences, etc.
            context: Optional additional context
            
        Returns:
            AgentResponse with content and optional structured data
        """
        pass
    
    def can_handle(self, user_query: str) -> bool:
        """
        Check if this agent can handle the given query.
        Override this method to implement custom logic for detecting
        if a query is relevant to this agent.
        
        Default: Returns False (must be explicitly invoked)
        """
        return False
    
    def get_capabilities(self) -> Dict[str, Any]:
        """
        Return a dictionary describing this agent's capabilities.
        Useful for API documentation and frontend display.
        """
        return {
            "agent_id": self.agent_id,
            "name": self.name,
            "description": self.description,
            "requires_location": self.requires_location(),
            "supported_queries": self.get_supported_query_types()
        }
    
    def requires_location(self) -> bool:
        """
        Return True if this agent requires user location data.
        Override if your agent needs location information.
        """
        return False
    
    def get_supported_query_types(self) -> list[str]:
        """
        Return list of query types this agent supports.
        Example: ["current_weather", "forecast", "alerts"]
        """
        return []
    
    def validate_user_profile(self, user_profile: Dict[str, Any]) -> tuple[bool, Optional[str]]:
        """
        Validate that user profile has required data for this agent.
        
        Returns:
            (is_valid, error_message)
        """
        if self.requires_location():
            if not user_profile.get("latitude") or not user_profile.get("longitude"):
                return False, f"{self.name} requires location data. Please update your profile with your location."
        
        return True, None










