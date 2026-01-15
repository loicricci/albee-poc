"""
Profile Context Loader Module

Loads agent profile data including persona, bio, and knowledge base content
for use in AI content generation.
"""

import os
from typing import Dict, Any, List, Optional
from sqlalchemy import text
import uuid

# Import shared database session
from backend.db import SessionLocal

# Import caching
from backend.cache import agent_cache


class ProfileContextLoader:
    """
    Loads comprehensive context about an agent profile including:
    - Basic profile info (persona, bio, display_name, handle)
    - Knowledge base content from documents
    - Style and personality traits
        - Key themes and interests
    """
    
    def __init__(self):
        # Use shared connection pool from db.py
        self.session = SessionLocal()
    
    def load_agent_context(self, agent_handle: str) -> Dict[str, Any]:
        """
        Load full context for an agent profile.
        
        Args:
            agent_handle: The agent's handle (e.g., "eltonjohn")
        
        Returns:
            Dictionary with:
        - handle: Agent handle
        - display_name: Display name
        - bio: Short bio
        - persona: Full persona description
        - style_traits: List of personality/style traits
        - themes: Key themes and interests
        - knowledge_summary: Summary of knowledge base
        - document_count: Number of documents in knowledge base
        
        Raises:
            ValueError: If agent not found
        """
        # Check cache first
        cache_key = f"agent_context:{agent_handle}"
        cached = agent_cache.get(cache_key)
        if cached:
            print(f"[ProfileContextLoader] ✅ Cache hit for @{agent_handle}")
            return cached
        
        print(f"[ProfileContextLoader] Loading context for @{agent_handle}...")
        
        # Load basic profile info
        profile_data = self._load_profile_data(agent_handle)
        
        if not profile_data:
            raise ValueError(f"Agent @{agent_handle} not found in database")
        
        # Load knowledge base summary
        knowledge_data = self._load_knowledge_summary(profile_data["avee_id"])
        
        # Extract style traits from persona
        style_traits = self._extract_style_traits(profile_data["persona"], profile_data["bio"])
        
        # Extract themes
        themes = self._extract_themes(profile_data["persona"], knowledge_data["sample_content"])
        
        # Extract voice instructions for persona-driven content generation
        voice_data = self._extract_voice_instructions(profile_data["persona"], profile_data["display_name"])
        
        context = {
            "handle": profile_data["handle"],
            "display_name": profile_data["display_name"],
            "bio": profile_data["bio"],
            "persona": profile_data["persona"],
            "style_traits": style_traits,
            "themes": themes,
            "knowledge_summary": knowledge_data["summary"],
            "document_count": knowledge_data["document_count"],
            "avee_id": profile_data["avee_id"],
            "reference_image_url": profile_data["reference_image_url"],
            "reference_image_mask_url": profile_data["reference_image_mask_url"],
            "image_edit_instructions": profile_data["image_edit_instructions"],
            "branding_guidelines": profile_data["branding_guidelines"],
            # Logo watermark settings
            "logo_enabled": profile_data["logo_enabled"],
            "logo_url": profile_data["logo_url"],
            "logo_position": profile_data["logo_position"],
            "logo_size": profile_data["logo_size"],
            # Auto-post topic personalization
            "preferred_topics": profile_data["preferred_topics"],
            "location": profile_data["location"],
            # Voice instructions for persona-driven content
            "voice_instructions": voice_data["writing_instructions"],
            "speaking_style": voice_data["speaking_style"],
            "vocabulary_examples": voice_data["vocabulary_examples"],
            "example_phrases": voice_data["example_phrases"],
            "tone": voice_data["tone"]
        }
        
        print(f"[ProfileContextLoader] ✅ Loaded context for {profile_data['display_name']}")
        print(f"[ProfileContextLoader]    - {len(style_traits)} style traits")
        print(f"[ProfileContextLoader]    - {len(themes)} themes")
        print(f"[ProfileContextLoader]    - {knowledge_data['document_count']} documents")
        print(f"[ProfileContextLoader]    - Voice: {voice_data['tone']}")
        
        # Cache for 1 hour (persona/bio rarely change)
        agent_cache.set(cache_key, context, ttl=3600)
        
        return context
    
    def _load_profile_data(self, agent_handle: str) -> Optional[Dict[str, Any]]:
        """Load basic profile data from the avees table"""
        
        query = text("""
            SELECT 
                id as avee_id,
                handle,
                display_name,
                bio,
                persona,
                avatar_url,
                reference_image_url,
                reference_image_mask_url,
                image_edit_instructions,
                branding_guidelines,
                logo_enabled,
                logo_url,
                logo_position,
                logo_size,
                preferred_topics,
                location
            FROM avees
            WHERE handle = :handle
            LIMIT 1
        """)
        
        result = self.session.execute(query, {"handle": agent_handle})
        row = result.fetchone()
        
        if not row:
            return None
        
        return {
            "avee_id": str(row.avee_id),
            "handle": row.handle,
            "display_name": row.display_name or row.handle,
            "bio": row.bio or "",
            "persona": row.persona or "",
            "avatar_url": row.avatar_url,
            "reference_image_url": row.reference_image_url,
            "reference_image_mask_url": row.reference_image_mask_url,
            "image_edit_instructions": row.image_edit_instructions,
            "branding_guidelines": row.branding_guidelines or "",
            # Logo watermark settings
            "logo_enabled": row.logo_enabled or False,
            "logo_url": row.logo_url,
            "logo_position": row.logo_position or "bottom-right",
            "logo_size": row.logo_size or "10",
            # Auto-post topic personalization
            "preferred_topics": row.preferred_topics or "",
            "location": row.location or ""
        }
    
    def _load_knowledge_summary(self, avee_id: str) -> Dict[str, Any]:
        """Load summary of knowledge base documents"""
        
        # Get document count
        count_query = text("""
            SELECT COUNT(*) as doc_count
            FROM documents
            WHERE avee_id = :avee_id
        """)
        
        count_result = self.session.execute(count_query, {"avee_id": avee_id})
        doc_count = count_result.fetchone()[0]
        
        # Get sample document content for theme extraction
        sample_query = text("""
            SELECT title, content
            FROM documents
            WHERE avee_id = :avee_id
            ORDER BY created_at DESC
            LIMIT 5
        """)
        
        sample_result = self.session.execute(sample_query, {"avee_id": avee_id})
        sample_docs = sample_result.fetchall()
        
        # Combine sample content
        sample_content = []
        for doc in sample_docs:
            if doc.title:
                sample_content.append(f"Title: {doc.title}")
            if doc.content:
                # Limit content length
                content_preview = doc.content[:500] if len(doc.content) > 500 else doc.content
                sample_content.append(content_preview)
        
        summary = f"{doc_count} documents in knowledge base"
        if sample_docs:
            summary += f". Recent topics: {', '.join([doc.title for doc in sample_docs if doc.title][:3])}"
        
        return {
            "document_count": doc_count,
            "summary": summary,
            "sample_content": "\n\n".join(sample_content[:3])  # First 3 docs
        }
    
    def _extract_style_traits(self, persona: str, bio: str) -> List[str]:
        """
        Extract style and personality traits from persona and bio.
        
        Returns a list of adjectives and descriptive phrases.
        """
        traits = []
        
        # Common trait keywords to look for
        trait_keywords = [
            "flamboyant", "theatrical", "warm", "witty", "authentic", "passionate",
            "charismatic", "energetic", "creative", "bold", "elegant", "sophisticated",
            "humorous", "compassionate", "outgoing", "dramatic", "vibrant", "colorful",
            "expressive", "artistic", "innovative", "legendary", "iconic", "charming"
        ]
        
        # Search in persona and bio
        text = (persona + " " + bio).lower()
        
        for keyword in trait_keywords:
            if keyword in text:
                traits.append(keyword)
        
        # Extract from common patterns
        if "known for" in text:
            # Extract what they're known for
            parts = text.split("known for")
            if len(parts) > 1:
                snippet = parts[1].split(".")[0].split(",")[0].strip()
                if len(snippet) < 50:  # Reasonable length
                    traits.append(snippet)
        
        # Default traits if none found
        if not traits:
            traits = ["creative", "expressive", "engaging"]
        
        return traits[:8]  # Limit to 8 traits
    
    def _extract_themes(self, persona: str, sample_content: str) -> List[str]:
        """
        Extract key themes and interests from persona and knowledge base.
        
        Returns a list of theme strings.
        """
        themes = []
        
        # Common theme keywords
        theme_keywords = {
            "music": ["music", "musician", "song", "album", "performance", "concert"],
            "activism": ["activism", "advocate", "charity", "foundation", "cause"],
            "fashion": ["fashion", "style", "costume", "glasses", "outrageous"],
            "entertainment": ["entertainment", "performer", "stage", "show"],
            "lgbtq": ["lgbtq", "pride", "equality", "gay rights"],
            "health": ["health", "aids", "medical", "wellness"],
            "art": ["art", "artistic", "creative", "design"],
            "literature": ["writer", "author", "book", "novel", "poetry", "literature"],
            "history": ["history", "historical", "century", "era"],
            "science": ["science", "research", "discovery", "scientific"],
            "technology": ["technology", "innovation", "digital", "tech"]
        }
        
        text = (persona + " " + sample_content).lower()
        
        for theme, keywords in theme_keywords.items():
            for keyword in keywords:
                if keyword in text:
                    themes.append(theme)
                    break
        
        # Remove duplicates while preserving order
        themes = list(dict.fromkeys(themes))
        
        # Default themes if none found
        if not themes:
            themes = ["culture", "creativity", "expression"]
        
        return themes[:6]  # Limit to 6 themes
    
    def _extract_voice_instructions(self, persona: str, display_name: str) -> Dict[str, Any]:
        """
        Extract specific voice/communication style instructions from persona.
        
        Looks for sections like:
        - "Communication Style"
        - "Your Voice and Personality"
        - "RÈGLE NUMÉRO UN" (French personas)
        - "How I speak/respond"
        - "MON STYLE"
        
        Returns a dictionary with:
        - speaking_style: How they communicate (formal/casual, vocabulary)
        - vocabulary_examples: Specific words/phrases they use
        - greeting_style: How they greet people
        - tone: Overall tone description
        - example_phrases: Direct example phrases from persona
        - writing_instructions: Condensed instructions for AI to follow
        """
        import re
        
        voice_data = {
            "speaking_style": "",
            "vocabulary_examples": [],
            "greeting_style": "",
            "tone": "",
            "example_phrases": [],
            "writing_instructions": ""
        }
        
        if not persona:
            return voice_data
        
        # Section markers to look for (case-insensitive)
        voice_section_markers = [
            r"##?\s*Communication Style",
            r"##?\s*Your Voice and Personality",
            r"##?\s*Voice and Personality",
            r"##?\s*Speaking Style",
            r"##?\s*How I (?:speak|talk|respond|communicate)",
            r"##?\s*MON STYLE",
            r"##?\s*RÈGLE NUMÉRO UN",
            r"##?\s*(?:My |The )(?:Voice|Style|Tone)",
            r"##?\s*COMMENT JE (?:PARLE|RÉPONDS)",
            r"##?\s*When responding",
        ]
        
        # Extract voice-related sections
        extracted_sections = []
        persona_lower = persona.lower()
        
        for marker in voice_section_markers:
            matches = re.finditer(marker, persona, re.IGNORECASE)
            for match in matches:
                start = match.start()
                # Find the next section header or end of text
                next_section = re.search(r'\n##?\s+[A-Z]', persona[start + len(match.group()):])
                if next_section:
                    end = start + len(match.group()) + next_section.start()
                else:
                    # Take up to 1500 chars if no next section
                    end = min(start + 1500, len(persona))
                
                section_text = persona[start:end].strip()
                if len(section_text) > 50:  # Only include meaningful sections
                    extracted_sections.append(section_text)
        
        # Extract vocabulary/expression examples
        vocabulary_patterns = [
            r'["\']([^"\']{3,50})["\']',  # Quoted phrases
            r'(?:use|say|expressions?|words?)[:\s]+([^\n.]{10,100})',  # "use: ...", "say: ..."
            r'(?:like|such as)[:\s]+["\']?([^"\'.\n]{5,60})["\']?',  # "like ..."
        ]
        
        vocabulary = []
        for pattern in vocabulary_patterns:
            matches = re.findall(pattern, persona, re.IGNORECASE)
            vocabulary.extend([m.strip() for m in matches if len(m.strip()) > 3])
        
        # Deduplicate and limit
        vocabulary = list(dict.fromkeys(vocabulary))[:15]
        voice_data["vocabulary_examples"] = vocabulary
        
        # Extract example phrases (look for dialogue patterns)
        example_patterns = [
            r'(?:Example|Exemple)[s]?[:\s]*["\']([^"\']{10,150})["\']',
            r'(?:Moi|I would say)[:\s]*["\']([^"\']{10,150})["\']',
            r'(?:Salutation|Greeting)[s]?[:\s]*\n?[-*]?\s*["\']([^"\']{5,100})["\']',
        ]
        
        example_phrases = []
        for pattern in example_patterns:
            matches = re.findall(pattern, persona, re.IGNORECASE)
            example_phrases.extend([m.strip() for m in matches])
        
        voice_data["example_phrases"] = list(dict.fromkeys(example_phrases))[:10]
        
        # Detect tone from persona content
        tone_indicators = {
            "warm and friendly": ["warm", "friendly", "personable", "genuine", "caring"],
            "provocative and vulgar": ["vulgaire", "vulgar", "provocateur", "gros mots", "enfoiré", "merde"],
            "witty and humorous": ["witty", "humor", "humorous", "funny", "laugh", "joke"],
            "formal and eloquent": ["formal", "eloquent", "articulate", "sophisticated"],
            "direct and honest": ["direct", "honest", "truth", "sincere", "authentic"],
            "passionate and enthusiastic": ["passionate", "enthusiastic", "energetic", "love"],
            "self-deprecating": ["self-deprecating", "laugh at myself", "humble"],
            "rebellious and anti-establishment": ["anarchist", "anti-establishment", "rebel", "against authority"],
        }
        
        detected_tones = []
        for tone, keywords in tone_indicators.items():
            for keyword in keywords:
                if keyword in persona_lower:
                    detected_tones.append(tone)
                    break
        
        voice_data["tone"] = ", ".join(detected_tones[:4]) if detected_tones else "authentic and engaging"
        
        # Build comprehensive speaking style from extracted sections
        if extracted_sections:
            # Combine and limit to reasonable size
            combined = "\n\n".join(extracted_sections)
            voice_data["speaking_style"] = combined[:2500] if len(combined) > 2500 else combined
        else:
            # Fallback: extract any bullet points about communication
            bullet_pattern = r'[-*]\s*\*\*([^*]+)\*\*[:\s]*([^\n]+)'
            bullets = re.findall(bullet_pattern, persona)
            if bullets:
                voice_data["speaking_style"] = "\n".join([f"- {b[0]}: {b[1]}" for b in bullets[:8]])
        
        # Build condensed writing instructions for AI prompts
        instructions = []
        
        # Add tone instruction
        if voice_data["tone"]:
            instructions.append(f"Write with a {voice_data['tone']} tone.")
        
        # Add vocabulary guidance
        if voice_data["vocabulary_examples"]:
            vocab_sample = voice_data["vocabulary_examples"][:5]
            instructions.append(f"Use expressions like: {', '.join(vocab_sample)}")
        
        # Add example phrases if available
        if voice_data["example_phrases"]:
            instructions.append(f"Example of their voice: \"{voice_data['example_phrases'][0]}\"")
        
        # Language detection and specific guidance
        if any(word in persona_lower for word in ["tutoie", "enfoiré", "putain", "merde", "connard"]):
            instructions.append("Use informal 'tu' form in French. Include mild profanity naturally.")
        elif any(word in persona_lower for word in ["darling", "brilliant", "lovely", "british"]):
            instructions.append("Use British expressions naturally (darling, brilliant, lovely).")
        
        voice_data["writing_instructions"] = " ".join(instructions) if instructions else f"Write authentically as {display_name} would speak."
        
        print(f"[ProfileContextLoader] 🎤 Extracted voice instructions:")
        print(f"[ProfileContextLoader]    - Tone: {voice_data['tone']}")
        print(f"[ProfileContextLoader]    - {len(voice_data['vocabulary_examples'])} vocabulary examples")
        print(f"[ProfileContextLoader]    - {len(voice_data['example_phrases'])} example phrases")
        print(f"[ProfileContextLoader]    - Speaking style: {len(voice_data['speaking_style'])} chars")
        
        return voice_data
    
    def close(self):
        """Close database session"""
        self.session.close()
    
    def __enter__(self):
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()


# Convenience function for easy import
def load_agent_context(agent_handle: str) -> Dict[str, Any]:
    """
    Load agent context in a single function call.
    
    Args:
        agent_handle: The agent's handle
    
    Returns:
        Dictionary with agent context
    """
    with ProfileContextLoader() as loader:
        return loader.load_agent_context(agent_handle)


# Testing
if __name__ == "__main__":
    import sys
    from dotenv import load_dotenv
    
    # Load environment
    load_dotenv("backend/.env", override=True)
    
    print("=" * 80)
    print("Testing Profile Context Loader")
    print("=" * 80)
    
    # Test with Elton John profile
    test_handle = sys.argv[1] if len(sys.argv) > 1 else "eltonjohn"
    
    try:
        context = load_agent_context(test_handle)
        
        print("\n" + "=" * 80)
        print("PROFILE CONTEXT:")
        print("=" * 80)
        print(f"Handle: @{context['handle']}")
        print(f"Display Name: {context['display_name']}")
        print(f"Bio: {context['bio'][:100]}..." if len(context['bio']) > 100 else f"Bio: {context['bio']}")
        print(f"\nPersona Preview: {context['persona'][:200]}...")
        print(f"\nStyle Traits: {', '.join(context['style_traits'])}")
        print(f"Themes: {', '.join(context['themes'])}")
        print(f"\nKnowledge Summary: {context['knowledge_summary']}")
        print("=" * 80)
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()


