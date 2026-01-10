"""
Native Agents System

Native agents are system-level agents that provide contextual information to all users.
They are not user-created but platform-provided, and they deliver personalized responses
based on user profile information.

Available Native Agents:
- WeatherAgent: Provides weather information based on user location
"""

from .base import NativeAgent, AgentResponse
from .weather_agent import WeatherAgent
from .registry import NativeAgentRegistry

__all__ = ["NativeAgent", "AgentResponse", "WeatherAgent", "NativeAgentRegistry"]










