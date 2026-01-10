"""
Query Analyzer for Native Agents

Analyzes user queries to determine:
- Query complexity (simple vs complex)
- Query intent (what the user is asking)
- Whether it's a follow-up question
"""

from typing import Dict, Any, Tuple, Optional, List
import re


class QueryAnalyzer:
    """
    Analyzes user queries to route them appropriately.
    
    Determines if a query should use:
    - Template responses (fast, for simple queries)
    - LLM responses (smart, for complex queries)
    """
    
    # Keywords that indicate simple weather queries
    SIMPLE_KEYWORDS = [
        "weather", "temperature", "temp", "forecast",
        "météo", "température", "prévisions"
    ]
    
    # Keywords that indicate complex queries needing LLM
    COMPLEX_KEYWORDS = [
        # Clothing/activity questions
        "wear", "bring", "shorts", "jacket", "coat", "umbrella", "sunscreen",
        "dress", "clothing", "outfit",
        
        # Activity questions  
        "should i", "can i", "good for", "safe for", "okay for",
        "cycling", "running", "hiking", "swimming", "outdoor",
        "barbecue", "picnic", "beach", "park",
        
        # Advice/recommendations
        "recommend", "suggest", "advise", "think",
        "better", "worse", "best", "ideal",
        
        # Comparative questions
        "warmer", "colder", "better than", "worse than",
        "compared to", "versus", "or",
        
        # French equivalents
        "porter", "mettre", "apporter", "short", "veste", "parapluie",
        "devrais-je", "puis-je", "bon pour", "conseiller"
    ]
    
    # Patterns for follow-up questions
    FOLLOWUP_PATTERNS = [
        r"^and\s+",
        r"^what about\s+",
        r"^how about\s+",
        r"^the day after",
        r"^tomorrow",
        r"^next\s+",
        r"^later",
        r"^then",
        r"^after",
        r"^et\s+",
        r"^qu'en est-il",
        r"^le jour après",
        r"^demain",
        r"^plus tard"
    ]
    
    def analyze_query(
        self, 
        user_query: str,
        has_conversation_history: bool = False
    ) -> Dict[str, Any]:
        """
        Analyze a user query to determine routing.
        
        Args:
            user_query: The user's question
            has_conversation_history: Whether user has prior conversation
            
        Returns:
            Dictionary with analysis results:
            {
                "is_complex": bool,
                "is_followup": bool,
                "complexity_score": float,
                "intent": str,
                "use_llm": bool
            }
        """
        query_lower = user_query.lower().strip()
        
        # Check if it's a follow-up
        is_followup = self._is_followup_question(query_lower, has_conversation_history)
        
        # Calculate complexity score
        complexity_score = self._calculate_complexity(query_lower)
        
        # Determine if complex
        is_complex = complexity_score > 0.5 or is_followup
        
        # Detect intent
        intent = self._detect_intent(query_lower)
        
        return {
            "is_complex": is_complex,
            "is_followup": is_followup,
            "complexity_score": complexity_score,
            "intent": intent,
            "use_llm": is_complex  # Will be refined by config
        }
    
    def _calculate_complexity(self, query: str) -> float:
        """
        Calculate complexity score (0.0 to 1.0).
        
        Higher score = more complex = needs LLM
        """
        score = 0.0
        
        # Check for complex keywords
        complex_count = sum(1 for keyword in self.COMPLEX_KEYWORDS if keyword in query)
        if complex_count > 0:
            score += min(0.5, complex_count * 0.2)
        
        # Check for question words indicating advice/recommendation
        advice_words = ["should", "can i", "would", "could", "recommend", "suggest", "think"]
        if any(word in query for word in advice_words):
            score += 0.3
        
        # Check for conditional/comparative language
        if any(word in query for word in ["if", "whether", "or", "versus", "better", "worse"]):
            score += 0.2
        
        # Check for multiple questions (compound queries)
        question_marks = query.count("?")
        if question_marks > 1:
            score += 0.2
        
        # Check for long queries (likely more complex)
        word_count = len(query.split())
        if word_count > 15:
            score += 0.2
        elif word_count > 10:
            score += 0.1
        
        # Very simple queries (< 5 words, simple keywords only)
        if word_count < 5 and not any(keyword in query for keyword in self.COMPLEX_KEYWORDS):
            score = max(0, score - 0.3)
        
        return min(1.0, score)
    
    def _is_followup_question(self, query: str, has_history: bool) -> bool:
        """
        Detect if this is a follow-up question.
        
        Args:
            query: User query (lowercase)
            has_history: Whether user has conversation history
            
        Returns:
            True if this appears to be a follow-up
        """
        if not has_history:
            return False
        
        # Check for follow-up patterns
        for pattern in self.FOLLOWUP_PATTERNS:
            if re.search(pattern, query, re.IGNORECASE):
                return True
        
        # Very short queries with history are likely follow-ups
        if len(query.split()) <= 3:
            return True
        
        # Pronouns without clear antecedent suggest follow-up
        pronouns = ["it", "that", "this", "there", "then"]
        if query.startswith(tuple(pronouns)):
            return True
        
        return False
    
    def _detect_intent(self, query: str) -> str:
        """
        Detect the primary intent of the query.
        
        Returns:
            Intent category as string
        """
        # Clothing advice
        clothing_words = ["wear", "bring", "shorts", "jacket", "coat", "umbrella", "dress", "outfit"]
        if any(word in query for word in clothing_words):
            return "clothing_advice"
        
        # Activity recommendation
        activity_words = ["cycling", "running", "hiking", "swimming", "outdoor", "picnic", "barbecue"]
        if any(word in query for word in activity_words):
            return "activity_advice"
        
        # Rain specific
        if "rain" in query or "pluie" in query:
            return "rain_forecast"
        
        # Temperature specific
        if "temperature" in query or "temp" in query or "hot" in query or "cold" in query:
            return "temperature"
        
        # Forecast
        if any(word in query for word in ["forecast", "coming", "next", "week", "days", "prévisions"]):
            return "forecast"
        
        # Tomorrow
        if "tomorrow" in query or "demain" in query:
            return "tomorrow"
        
        # Current
        if any(word in query for word in ["now", "current", "currently", "today", "maintenant"]):
            return "current"
        
        return "general_weather"


# Global analyzer instance
_analyzer_instance = None


def get_query_analyzer() -> QueryAnalyzer:
    """Get the global query analyzer instance"""
    global _analyzer_instance
    if _analyzer_instance is None:
        _analyzer_instance = QueryAnalyzer()
    return _analyzer_instance










