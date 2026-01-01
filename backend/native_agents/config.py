"""
Configuration for Native Agents

Centralized configuration for native agents behavior, including LLM usage,
context management, and routing logic.
"""

import os
from typing import Optional


class NativeAgentsConfig:
    """Configuration for native agents system"""
    
    def __init__(self):
        # LLM Configuration
        self.llm_enabled = os.getenv("NATIVE_AGENTS_LLM_ENABLED", "true").lower() == "true"
        self.openai_model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
        self.llm_temperature = float(os.getenv("NATIVE_AGENTS_LLM_TEMPERATURE", "0.7"))
        self.llm_max_tokens = int(os.getenv("NATIVE_AGENTS_LLM_MAX_TOKENS", "500"))
        
        # Context Management
        self.context_max_history = int(os.getenv("NATIVE_AGENTS_MAX_HISTORY", "5"))
        self.context_ttl_minutes = int(os.getenv("NATIVE_AGENTS_CONTEXT_TTL", "30"))
        
        # Query Routing
        self.complexity_threshold = float(os.getenv("NATIVE_AGENTS_COMPLEXITY_THRESHOLD", "0.5"))
        self.force_llm_for_followups = os.getenv("NATIVE_AGENTS_LLM_FOLLOWUPS", "true").lower() == "true"
        
        # Weather Agent Specific
        self.weather_api_timeout = float(os.getenv("WEATHER_API_TIMEOUT", "10.0"))
    
    def should_use_llm(self, is_complex: bool, is_followup: bool) -> bool:
        """
        Determine if LLM should be used for a query.
        
        Args:
            is_complex: Whether the query is considered complex
            is_followup: Whether this is a follow-up question
            
        Returns:
            True if LLM should be used
        """
        if not self.llm_enabled:
            return False
        
        if is_followup and self.force_llm_for_followups:
            return True
        
        return is_complex
    
    def get_llm_params(self) -> dict:
        """Get LLM parameters for API calls"""
        return {
            "model": self.openai_model,
            "temperature": self.llm_temperature,
            "max_tokens": self.llm_max_tokens
        }


# Global configuration instance
_config_instance = None


def get_config() -> NativeAgentsConfig:
    """Get the global configuration instance"""
    global _config_instance
    if _config_instance is None:
        _config_instance = NativeAgentsConfig()
    return _config_instance





