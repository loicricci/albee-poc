"""
Elton John Native Agent

A conversational agent embodying Sir Elton John - legendary musician, activist,
and cultural icon. Provides authentic responses about his life, music, activism,
and experiences spanning over 50 years in the spotlight.
"""

from typing import Dict, Any, Optional
from .base import NativeAgent, AgentResponse
import os
from openai import OpenAI

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))


class EltonJohnAgent(NativeAgent):
    """
    Native Agent embodying Elton John.
    
    Covers:
    - Complete biography (1947-2024)
    - All 34 studio albums and iconic songs
    - Personal journey: coming out, addiction/recovery, love, fatherhood
    - AIDS activism ($600M+ raised through his foundation)
    - LGBTQ+ advocacy
    - Fashion and cultural impact
    """
    
    def __init__(self):
        # Load persona and knowledge when agent initializes
        self.persona = self._load_persona()
        self.biography = self._load_knowledge("biography")
        self.music_discography = self._load_knowledge("music_discography")
        self.personal_life = self._load_knowledge("personal_life_activism")
        
        super().__init__()
    
    def _load_persona(self) -> str:
        """Load the Elton John persona from file"""
        persona_path = "data/elton_john/persona_elton_john.md"
        try:
            with open(persona_path, 'r', encoding='utf-8') as f:
                return f.read()
        except FileNotFoundError:
            return self._get_default_persona()
    
    def _load_knowledge(self, knowledge_type: str) -> str:
        """Load knowledge files"""
        knowledge_path = f"data/elton_john/knowledge_{knowledge_type}.md"
        try:
            with open(knowledge_path, 'r', encoding='utf-8') as f:
                return f.read()
        except FileNotFoundError:
            return ""
    
    def _get_default_persona(self) -> str:
        """Fallback persona if file not found"""
        return """
You are Sir Elton Hercules John CBE, legendary musician and activist. 
Speak warmly, honestly, and authentically - with British charm, humor, 
and emotional depth. You're passionate about music, AIDS activism, LGBTQ+ rights, 
your husband David, and your two sons. You've been sober for over 30 years and 
are proud of your journey.
"""
    
    def get_agent_id(self) -> str:
        return "elton_john"
    
    def get_name(self) -> str:
        return "Elton John"
    
    def get_description(self) -> str:
        return ("Chat with Sir Elton John - legendary musician, AIDS activist, "
                "LGBTQ+ icon. Ask about his music, life journey, activism, and "
                "over 50 years in the spotlight.")
    
    def can_handle(self, user_query: str) -> bool:
        """
        Detect if query is about Elton John.
        """
        query_lower = user_query.lower()
        
        elton_keywords = [
            "elton", "john", "rocket man", "your song", "tiny dancer",
            "goodbye yellow brick road", "bennie and the jets",
            "bernie taupin", "david furnish", "aids foundation",
            "candle in the wind", "lion king", "rocketman",
            "i'm still standing", "crocodile rock"
        ]
        
        return any(keyword in query_lower for keyword in elton_keywords)
    
    def requires_location(self) -> bool:
        return False
    
    def get_supported_query_types(self) -> list[str]:
        return [
            "biography",
            "music_career",
            "songs_and_albums",
            "personal_life",
            "david_furnish",
            "fatherhood",
            "addiction_recovery",
            "aids_activism",
            "lgbtq_advocacy",
            "fashion_and_style",
            "retirement",
            "current_life"
        ]
    
    async def process_request(
        self,
        user_query: str,
        user_profile: Dict[str, Any],
        context: Optional[Dict[str, Any]] = None
    ) -> AgentResponse:
        """
        Process a query as Elton John would respond.
        
        Uses OpenAI with the full persona and knowledge base to generate
        authentic, contextual responses.
        """
        
        # Build context from knowledge base
        knowledge_context = self._build_knowledge_context(user_query)
        
        # Construct messages for OpenAI
        messages = [
            {
                "role": "system",
                "content": self.persona
            },
            {
                "role": "system",
                "content": f"Here is relevant context from your life and career:\n\n{knowledge_context}"
            },
            {
                "role": "user",
                "content": user_query
            }
        ]
        
        try:
            # Generate response using OpenAI
            response = client.chat.completions.create(
                model=os.getenv("OPENAI_MODEL", "gpt-4o-mini"),
                messages=messages,
                temperature=0.7,
                max_tokens=800
            )
            
            content = response.choices[0].message.content.strip()
            
            return AgentResponse(
                content=content,
                data={
                    "agent_type": "elton_john",
                    "query_type": self._detect_query_type(user_query)
                },
                metadata={
                    "agent_id": self.agent_id,
                    "model_used": "gpt-4o-mini",
                    "knowledge_sources": ["persona", "biography", "discography", "personal_life"]
                }
            )
            
        except Exception as e:
            return AgentResponse(
                content=f"I'm sorry, darling, I'm having a bit of technical difficulty at the moment. ({str(e)})",
                data=None,
                metadata={"error": str(e)}
            )
    
    def _build_knowledge_context(self, user_query: str) -> str:
        """
        Build relevant knowledge context based on the query.
        Simple keyword matching for now - could be enhanced with embeddings.
        """
        query_lower = user_query.lower()
        contexts = []
        
        # Always include a bit of biography for context
        contexts.append(self.biography[:2000])  # First 2000 chars
        
        # Add music/discography context if relevant
        music_keywords = ["song", "album", "music", "wrote", "sing", "perform", 
                         "concert", "tour", "bernie", "taupin", "rocket man", 
                         "your song", "tiny dancer", "lion king"]
        if any(kw in query_lower for kw in music_keywords):
            contexts.append(self.music_discography[:3000])
        
        # Add personal life/activism context if relevant
        personal_keywords = ["david", "furnish", "husband", "sons", "father", 
                           "family", "aids", "lgbtq", "gay", "activism", "foundation",
                           "addiction", "sober", "recovery", "came out"]
        if any(kw in query_lower for kw in personal_keywords):
            contexts.append(self.personal_life[:3000])
        
        return "\n\n---\n\n".join(contexts)
    
    def _detect_query_type(self, user_query: str) -> str:
        """Detect the type of query for metadata"""
        query_lower = user_query.lower()
        
        if any(word in query_lower for word in ["song", "album", "music", "wrote"]):
            return "music"
        elif any(word in query_lower for word in ["david", "husband", "sons", "father", "family"]):
            return "family"
        elif any(word in query_lower for word in ["aids", "foundation", "activism", "charity"]):
            return "activism"
        elif any(word in query_lower for word in ["addiction", "sober", "recovery", "drugs"]):
            return "recovery"
        elif any(word in query_lower for word in ["gay", "lgbtq", "came out", "sexuality"]):
            return "lgbtq"
        else:
            return "general"







