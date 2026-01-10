"""
Native Agent Registry

Manages all available native agents and routes requests to the appropriate agent.
"""

from typing import Dict, List, Optional, Any
from .base import NativeAgent, AgentResponse
from .weather_agent import WeatherAgent


class NativeAgentRegistry:
    """
    Registry for all native agents.
    
    Provides:
    - Agent discovery
    - Agent routing
    - Agent capability listing
    """
    
    def __init__(self):
        self._agents: Dict[str, NativeAgent] = {}
        self._initialize_agents()
    
    def _initialize_agents(self):
        """
        Initialize all available native agents.
        Add new agents here as they are created.
        """
        
        # Register Weather Agent
        weather_agent = WeatherAgent()
        self.register_agent(weather_agent)
        
        # Future agents can be registered here:
        # news_agent = NewsAgent()
        # self.register_agent(news_agent)
    
    def register_agent(self, agent: NativeAgent):
        """
        Register a native agent.
        """
        self._agents[agent.agent_id] = agent
        print(f"[NativeAgents] Registered agent: {agent.name} (ID: {agent.agent_id})")
    
    def get_agent(self, agent_id: str) -> Optional[NativeAgent]:
        """
        Get a specific agent by ID.
        """
        return self._agents.get(agent_id)
    
    def list_agents(self) -> List[Dict[str, Any]]:
        """
        List all available agents with their capabilities.
        """
        return [agent.get_capabilities() for agent in self._agents.values()]
    
    def find_agent_for_query(self, user_query: str) -> Optional[NativeAgent]:
        """
        Find the best agent to handle a given query.
        Returns None if no agent can handle it.
        """
        for agent in self._agents.values():
            if agent.can_handle(user_query):
                return agent
        
        return None
    
    async def process_query(
        self,
        user_query: str,
        user_profile: Dict[str, Any],
        agent_id: Optional[str] = None,
        context: Optional[Dict[str, Any]] = None
    ) -> AgentResponse:
        """
        Process a query either by:
        1. Routing to a specific agent (if agent_id provided)
        2. Auto-detecting the best agent (if agent_id is None)
        
        Args:
            user_query: The user's natural language query
            user_profile: User profile data
            agent_id: Optional specific agent to use
            context: Optional additional context
            
        Returns:
            AgentResponse from the appropriate agent
        """
        
        # If specific agent requested, use it
        if agent_id:
            agent = self.get_agent(agent_id)
            if not agent:
                return AgentResponse(
                    content=f"Agent '{agent_id}' not found. Available agents: {', '.join(self._agents.keys())}",
                    data=None,
                    metadata={"error": "agent_not_found"}
                )
            
            return await agent.process_request(user_query, user_profile, context)
        
        # Otherwise, try to auto-detect
        agent = self.find_agent_for_query(user_query)
        
        if not agent:
            return AgentResponse(
                content="I couldn't determine which native agent to use for your query. Please specify an agent or rephrase your question.",
                data=None,
                metadata={
                    "error": "no_agent_found",
                    "available_agents": list(self._agents.keys())
                }
            )
        
        return await agent.process_request(user_query, user_profile, context)
    
    def get_agent_count(self) -> int:
        """Return number of registered agents."""
        return len(self._agents)


# Global singleton instance
_registry_instance = None


def get_registry() -> NativeAgentRegistry:
    """
    Get the global native agent registry instance.
    """
    global _registry_instance
    if _registry_instance is None:
        _registry_instance = NativeAgentRegistry()
    return _registry_instance










