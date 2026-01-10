"""
Orchestrator Engine - Intelligent message routing system (v2).

Redesigned flow:
1. Policy Check: Content moderation via OpenAI Moderation API
2. Load Context: Recipient persona + training docs
3. Evaluate Auto-Reply:
   - If confidence >= threshold -> Path A: Auto-reply using RAG
   - If query is vague -> Path B: Ask clarification
   - Otherwise -> Path E: Forward to agent owner

When owner answers:
- Store Q&A as new context (DocumentChunk)
- Notify network that agent was updated
"""

import uuid
import json
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import text

from openai import OpenAI

from backend.openai_embed import embed_texts
from backend.reranker import rerank_chunks
from backend.models import (
    OrchestratorConfig,
    EscalationQueue,
    OrchestratorDecision,
    AgentFollower,
    DocumentChunk,
    Avee,
    Document,
)

# OpenAI client for moderation
openai_client = OpenAI()


@dataclass
class PolicyCheckResult:
    """Result of content policy check."""
    allowed: bool
    reason: str
    flagged_categories: List[str]


@dataclass
class MessageSignals:
    """Computed signals about a message."""
    similarity_score: float  # 0-1, max similarity to existing content
    novelty_score: float  # 0-1, how novel/new the question is
    complexity_score: float  # 0-1, how complex the question is
    confidence_score: float  # 0-1, how confident AI can answer
    top_similar_chunks: List[Tuple[str, float]]  # Top similar chunks with scores
    original_message: str  # The original message for vagueness check


@dataclass 
class CreatorRules:
    """Creator-defined rules (simplified)."""
    auto_answer_confidence_threshold: float
    clarification_enabled: bool


@dataclass
class RoutingDecision:
    """Decision made by the Orchestrator."""
    path: str  # 'A' (auto-reply), 'B' (clarify), 'E' (forward to owner), 'P' (policy violation)
    confidence: float
    reason: str
    action_data: Dict  # Path-specific data
    signals: Optional[MessageSignals]  # None for policy violations


class ContentModerator:
    """Handles content policy checks using OpenAI Moderation API."""
    
    async def check_policy(self, message: str) -> PolicyCheckResult:
        """
        Check if message violates content policy using OpenAI moderation.
        
        Args:
            message: The user's message to check
            
        Returns:
            PolicyCheckResult with allowed status and details
        """
        try:
            response = openai_client.moderations.create(input=message)
            result = response.results[0]
            
            if result.flagged:
                # Get list of flagged categories
                flagged_categories = [
                    cat for cat, flagged in result.categories.model_dump().items() 
                    if flagged
                ]
                return PolicyCheckResult(
                    allowed=False,
                    reason=f"Content policy violation: {', '.join(flagged_categories)}",
                    flagged_categories=flagged_categories
                )
            
            return PolicyCheckResult(
                allowed=True,
                reason="Content policy check passed",
                flagged_categories=[]
            )
        except Exception as e:
            # On error, allow but log
            print(f"Content moderation error: {e}")
            return PolicyCheckResult(
                allowed=True,
                reason="Content moderation unavailable, allowing",
                flagged_categories=[]
            )


class MessageSignalComputer:
    """Computes signals about incoming messages."""
    
    def __init__(self, db: Session):
        self.db = db
    
    def compute(
        self, 
        message: str, 
        avee_id: uuid.UUID, 
        layer: str = "public"
    ) -> MessageSignals:
        """
        Compute all signals for a message.
        
        Args:
            message: The user's message
            avee_id: The agent ID
            layer: Access layer (public, friends, intimate)
        
        Returns:
            MessageSignals with all computed scores
        """
        # 1. Embed the message
        message_embedding = embed_texts([message])[0]
        embedding_str = "[" + ",".join(str(x) for x in message_embedding) + "]"
        
        # 2. Search document chunks (RAG) - simplified, no canonical answers
        chunk_candidates = self._search_document_chunks(
            avee_id, embedding_str, layer, limit=20
        )
        
        # 3. Rerank chunks
        if chunk_candidates:
            top_chunks_content = [c[0] for c in chunk_candidates]
            reranked = rerank_chunks(message, top_chunks_content, top_k=5)
            # Convert back to tuples with scores
            top_chunks = [(chunk, 0.8) for chunk in reranked]
        else:
            top_chunks = []
        
        # 4. Compute similarity score from chunks
        chunk_max_sim = chunk_candidates[0][1] if chunk_candidates else 0.0
        similarity_score = chunk_max_sim
        
        # 5. Compute novelty score (inverse of similarity)
        novelty_score = 1.0 - similarity_score
        
        # 6. Compute complexity score (heuristic-based)
        complexity_score = self._compute_complexity(message)
        
        # 7. Compute confidence score
        confidence_score = self._compute_confidence(
            similarity_score, len(top_chunks), complexity_score
        )
        
        return MessageSignals(
            similarity_score=similarity_score,
            novelty_score=novelty_score,
            complexity_score=complexity_score,
            confidence_score=confidence_score,
            top_similar_chunks=top_chunks,
            original_message=message
        )
    
    def _search_document_chunks(
        self, 
        avee_id: uuid.UUID, 
        embedding_str: str, 
        layer: str,
        limit: int = 20
    ) -> List[Tuple[str, float]]:
        """Search document chunks for relevant context."""
        result = self.db.execute(
            text("""
                SELECT content, 1 - (embedding <=> cast(:embedding as vector)) as similarity
                FROM document_chunks
                WHERE avee_id = :avee_id
                  AND (
                    :layer = 'intimate'
                    OR (:layer = 'friends' AND layer IN ('public', 'friends'))
                    OR (:layer = 'public' AND layer = 'public')
                  )
                ORDER BY embedding <=> cast(:embedding as vector) ASC
                LIMIT :limit
            """),
            {
                "avee_id": str(avee_id),
                "embedding": embedding_str,
                "layer": layer,
                "limit": limit
            }
        ).fetchall()
        
        return [(row[0], float(row[1])) for row in result]
    
    def _compute_complexity(self, message: str) -> float:
        """Compute complexity score using heuristics."""
        words = message.split()
        word_count = len(words)
        question_count = message.count("?")
        long_word_count = sum(1 for w in words if len(w) > 10)
        
        complexity = 0.0
        
        if word_count > 100:
            complexity += 0.4
        elif word_count > 50:
            complexity += 0.3
        elif word_count > 20:
            complexity += 0.2
        else:
            complexity += 0.1
        
        if question_count > 2:
            complexity += 0.3
        elif question_count > 1:
            complexity += 0.2
        
        if long_word_count > 5:
            complexity += 0.3
        elif long_word_count > 2:
            complexity += 0.2
        
        return min(1.0, complexity)
    
    def _compute_confidence(
        self, 
        similarity: float, 
        num_chunks: int, 
        complexity: float
    ) -> float:
        """Compute AI confidence score."""
        confidence = similarity * 0.6
        
        if num_chunks >= 5:
            confidence += 0.3
        elif num_chunks >= 3:
            confidence += 0.2
        elif num_chunks >= 1:
            confidence += 0.1
        
        confidence -= complexity * 0.2
        
        return max(0.0, min(1.0, confidence))


class CreatorRulesLoader:
    """Loads creator-defined rules (simplified)."""
    
    def __init__(self, db: Session):
        self.db = db
    
    def load_rules(self, avee_id: uuid.UUID) -> CreatorRules:
        """Load rules for an agent."""
        config = self.db.query(OrchestratorConfig).filter(
            OrchestratorConfig.avee_id == avee_id
        ).first()
        
        if not config:
            config = OrchestratorConfig(avee_id=avee_id)
            self.db.add(config)
            self.db.commit()
            self.db.refresh(config)
        
        # Handle threshold type - database stores as Decimal 0.00-1.00
        threshold = float(config.auto_answer_confidence_threshold) if config.auto_answer_confidence_threshold is not None else 0.75
        
        return CreatorRules(
            auto_answer_confidence_threshold=threshold,
            clarification_enabled=(
                config.clarification_enabled if isinstance(config.clarification_enabled, bool) 
                else config.clarification_enabled == "true"
            )
        )


class OrchestratorEngine:
    """
    Main Orchestrator engine with simplified 3-path routing:
    - Path A: Auto-answer with RAG
    - Path B: Ask clarification (vague query)
    - Path E: Forward to agent owner
    - Path P: Policy violation (new)
    """
    
    def __init__(self, db: Session):
        self.db = db
        self.content_moderator = ContentModerator()
        self.signal_computer = MessageSignalComputer(db)
        self.rules_loader = CreatorRulesLoader(db)
    
    async def route_message(
        self,
        user_id: uuid.UUID,
        avee_id: uuid.UUID,
        message: str,
        conversation_id: uuid.UUID,
        layer: str = "public"
    ) -> RoutingDecision:
        """
        Main routing logic with new simplified flow:
        1. Check content policy
        2. Load context and compute signals
        3. Decide: auto-reply, clarify, or forward to owner
        """
        # Step 1: Policy check (content moderation)
        policy_result = await self.content_moderator.check_policy(message)
        
        if not policy_result.allowed:
            decision = RoutingDecision(
                path="P",
                confidence=1.0,
                reason=policy_result.reason,
                action_data={
                    "policy_violation": True,
                    "flagged_categories": policy_result.flagged_categories
                },
                signals=None
            )
            self._log_decision(decision, user_id, avee_id, message, conversation_id)
            return decision
        
        # Step 2: Compute signals (load context)
        signals = self.signal_computer.compute(message, avee_id, layer)
        
        # Step 3: Load creator rules
        creator_rules = self.rules_loader.load_rules(avee_id)
        
        # Step 4: Apply simplified decision tree
        decision = self._decide_path(signals, creator_rules)
        
        # Step 5: Log decision
        self._log_decision(decision, user_id, avee_id, message, conversation_id)
        
        return decision
    
    def _decide_path(
        self,
        signals: MessageSignals,
        rules: CreatorRules
    ) -> RoutingDecision:
        """
        Simplified decision tree with 3 paths:
        - Path B: Clarification (if vague and enabled)
        - Path A: Auto-answer (if confidence >= threshold OR conversational message)
        - Path E: Forward to owner (otherwise)
        """
        # #region agent log
        import json as _json; open('/Users/loicricci/gabee-poc/.cursor/debug.log','a').write(_json.dumps({"hypothesisId":"H1-H3","location":"orchestrator.py:_decide_path","message":"Decision path entry","data":{"original_message":signals.original_message},"timestamp":__import__('time').time()*1000,"sessionId":"debug-session","runId":"post-fix"})+'\n')
        # #endregion
        
        # IMPORTANT: Check for specific factual questions FIRST
        # Even if a message starts with "hey" or "hello", if it asks for specific info, escalate it
        requires_specific = self._requires_specific_knowledge(signals.original_message)
        # #region agent log
        open('/Users/loicricci/gabee-poc/.cursor/debug.log','a').write(_json.dumps({"hypothesisId":"H2-H4","location":"orchestrator.py:_decide_path","message":"Specific knowledge check result (FIRST)","data":{"requires_specific":requires_specific,"message":signals.original_message},"timestamp":__import__('time').time()*1000,"sessionId":"debug-session","runId":"post-fix"})+'\n')
        # #endregion
        if requires_specific:
            return RoutingDecision(
                path="E",
                confidence=signals.confidence_score,
                reason="Question asks for specific factual information - escalating to owner",
                action_data={
                    "forward_to_owner": True,
                    "requires_specific_knowledge": True
                },
                signals=signals
            )
        
        # THEN check for conversational/greeting messages (only if not asking for specific info)
        is_conv = self._is_conversational(signals.original_message)
        # #region agent log
        open('/Users/loicricci/gabee-poc/.cursor/debug.log','a').write(_json.dumps({"hypothesisId":"H3","location":"orchestrator.py:_decide_path","message":"Conversational check result (AFTER specific check)","data":{"is_conversational":is_conv,"message":signals.original_message},"timestamp":__import__('time').time()*1000,"sessionId":"debug-session","runId":"post-fix"})+'\n')
        # #endregion
        if is_conv:
            return RoutingDecision(
                path="A",
                confidence=0.95,  # High confidence for conversational
                reason="Conversational message - auto-reply without escalation",
                action_data={"use_rag": True, "conversational": True},
                signals=signals
            )
        
        # Check for vague query
        if rules.clarification_enabled and self._is_vague(signals):
            return RoutingDecision(
                path="B",
                confidence=0.9,
                reason="Question is too vague, requesting clarification",
                action_data={"clarification_needed": True},
                signals=signals
            )
        
        # Check if we can auto-answer
        if signals.confidence_score >= rules.auto_answer_confidence_threshold:
            return RoutingDecision(
                path="A",
                confidence=signals.confidence_score,
                reason="Confidence sufficient for auto-reply",
                action_data={"use_rag": True},
                signals=signals
            )
        
        # Default: Forward to owner
        return RoutingDecision(
            path="E",
            confidence=signals.confidence_score,
            reason="Insufficient context, forwarding to agent owner",
            action_data={
                "forward_to_owner": True,
                "confidence_gap": rules.auto_answer_confidence_threshold - signals.confidence_score
            },
            signals=signals
        )
    
    def _requires_specific_knowledge(self, message: str) -> bool:
        """
        Check if a question asks for specific factual information that the agent 
        likely doesn't have (names, dates, future events, specific details).
        These should be escalated rather than answered with deflective responses.
        """
        message_lower = message.lower().strip()
        
        # Questions asking for specific names
        name_patterns = [
            "what is the name", "what's the name", "whats the name",
            "what is his name", "what is her name", "what is their name",
            "who is the", "who are the", "who will be",
            "name of the", "names of the",
            "tell me the name", "give me the name",
        ]
        
        # Questions about specific future events
        future_patterns = [
            "tomorrow", "next week", "next month", "next year",
            "will you be", "are you going to", "when will you",
            "what will you", "who will you", "where will you",
            "upcoming", "scheduled", "planned for",
            "what date", "what time", "which date",
        ]
        
        # Questions asking for specific numbers/details
        specific_detail_patterns = [
            "how much does", "how many", "what is your",
            "what is the address", "what is the phone",
            "what is the price", "what is the cost",
            "what is the exact", "specifically",
            "can you give me the", "can you tell me the exact",
        ]
        
        # Questions about specific people the agent is working/meeting with
        collaboration_patterns = [
            "working with", "collaborating with", "meeting with",
            "partner with", "teaming up with",
            "who are you working", "who will you work",
            "who are you meeting", "who will you meet",
        ]
        
        # Check for patterns
        all_patterns = name_patterns + future_patterns + specific_detail_patterns + collaboration_patterns
        
        for pattern in all_patterns:
            if pattern in message_lower:
                # Extra check: if asking about a specific person/thing with "which" or "what"
                # combined with patterns, it's likely asking for specific info
                if any(q in message_lower for q in ["what", "which", "who", "when", "where"]):
                    print(f"[ORCHESTRATOR] Detected specific knowledge question: '{pattern}' in message")
                    return True
        
        return False
    
    def _is_conversational(self, message: str) -> bool:
        """
        Check if a message is conversational/greeting that should always be auto-answered.
        These messages don't require specific knowledge and should never be escalated.
        """
        import json as _json2
        message_lower = message.lower().strip()
        
        # Common greeting patterns
        greeting_patterns = [
            "how are you", "how're you", "how r u",
            "what's up", "whats up", "wassup", "sup",
            "hello", "hi", "hey", "hiya", "howdy",
            "good morning", "good afternoon", "good evening", "good night",
            "nice to meet you", "pleased to meet you",
            "how's it going", "how is it going", "hows it going",
            "what are you doing", "what are you up to", "whatcha doing",
            "how have you been", "how've you been",
            "long time no see", "it's been a while",
            "thank you", "thanks", "thx", "ty",
            "you're welcome", "no problem", "np",
            "goodbye", "bye", "see you", "later", "take care",
            "have a nice day", "have a good one",
            "how do you do", "how ya doing",
        ]
        
        # Check if message matches any greeting pattern
        for pattern in greeting_patterns:
            if pattern in message_lower:
                # #region agent log
                open('/Users/loicricci/gabee-poc/.cursor/debug.log','a').write(_json2.dumps({"hypothesisId":"H3","location":"orchestrator.py:_is_conversational","message":"MATCHED greeting pattern","data":{"pattern":pattern,"message_lower":message_lower},"timestamp":__import__('time').time()*1000,"sessionId":"debug-session"})+'\n')
                # #endregion
                return True
        
        # Check for very short messages that are likely greetings
        words = message_lower.split()
        if len(words) <= 2:
            single_word_greetings = {"hi", "hello", "hey", "sup", "yo", "hola", "bonjour", "ciao"}
            if any(word in single_word_greetings for word in words):
                return True
        
        # Check for question patterns that are conversational
        conversational_questions = [
            "how old are you", "where are you from", "what's your name",
            "who are you", "tell me about yourself", "introduce yourself",
            "what do you like", "what's your favorite", "do you like",
            "can you help", "will you help", "could you help",
        ]
        
        for pattern in conversational_questions:
            if pattern in message_lower:
                # #region agent log
                open('/Users/loicricci/gabee-poc/.cursor/debug.log','a').write(_json2.dumps({"hypothesisId":"H3","location":"orchestrator.py:_is_conversational","message":"MATCHED conversational question","data":{"pattern":pattern,"message_lower":message_lower},"timestamp":__import__('time').time()*1000,"sessionId":"debug-session"})+'\n')
                # #endregion
                return True
        
        # #region agent log
        open('/Users/loicricci/gabee-poc/.cursor/debug.log','a').write(_json2.dumps({"hypothesisId":"H3","location":"orchestrator.py:_is_conversational","message":"NO conversational pattern matched","data":{"message_lower":message_lower},"timestamp":__import__('time').time()*1000,"sessionId":"debug-session"})+'\n')
        # #endregion
        return False
    
    def _is_vague(self, signals: MessageSignals) -> bool:
        """Check if a question is too vague."""
        message = signals.original_message
        words = message.split()
        
        # Very short message (less than 3 words)
        is_short = len(words) < 3
        
        # Low complexity and no context
        is_simple = signals.complexity_score < 0.2
        no_context = len(signals.top_similar_chunks) == 0
        
        return is_short and (is_simple or no_context)
    
    def _log_decision(
        self,
        decision: RoutingDecision,
        user_id: uuid.UUID,
        avee_id: uuid.UUID,
        message: str,
        conversation_id: uuid.UUID
    ):
        """Log the decision for analytics."""
        log_entry = OrchestratorDecision(
            conversation_id=conversation_id,
            user_id=user_id,
            avee_id=avee_id,
            message_content=message[:500],
            decision_path=decision.path,
            confidence_score=decision.signals.confidence_score if decision.signals else 0.0,
            novelty_score=decision.signals.novelty_score if decision.signals else 0.0,
            complexity_score=decision.signals.complexity_score if decision.signals else 0.0,
            similar_answer_id=None
        )
        self.db.add(log_entry)
        self.db.commit()


class ContextStorageService:
    """
    Service for storing Q&A as new context when owner answers.
    This enables the agent to learn from owner responses.
    """
    
    def __init__(self, db: Session):
        self.db = db
    
    async def store_qa_as_context(
        self,
        avee_id: uuid.UUID,
        question: str,
        answer: str,
        layer: str = "public",
        escalation_id: Optional[uuid.UUID] = None
    ) -> uuid.UUID:
        """
        Store a Q&A pair as a new document chunk for future RAG.
        
        Args:
            avee_id: The agent ID
            question: The original user question
            answer: The owner's answer
            layer: Access layer for this knowledge
            escalation_id: Optional reference to the escalation
            
        Returns:
            The ID of the created document chunk
        """
        # Format Q&A as context
        qa_content = f"Q: {question}\n\nA: {answer}"
        
        # Create embedding
        embedding = embed_texts([qa_content])[0]
        embedding_str = "[" + ",".join(str(x) for x in embedding) + "]"
        
        # First, ensure we have a document to attach chunks to
        # Create or get the "Owner Answers" document
        doc = self.db.query(Document).filter(
            Document.avee_id == avee_id,
            Document.title == "Owner Answers"
        ).first()
        
        if not doc:
            doc = Document(
                avee_id=avee_id,
                title="Owner Answers",
                source_type="owner_qa",
                original_content="",
                processed=True
            )
            self.db.add(doc)
            self.db.commit()
            self.db.refresh(doc)
        
        # Create the document chunk
        chunk = DocumentChunk(
            document_id=doc.id,
            avee_id=avee_id,
            content=qa_content,
            layer=layer,
            chunk_index=0
        )
        self.db.add(chunk)
        self.db.commit()
        self.db.refresh(chunk)
        
        # Update embedding via raw SQL (pgvector)
        self.db.execute(
            text("""
                UPDATE document_chunks 
                SET embedding = cast(:embedding as vector)
                WHERE id = :chunk_id
            """),
            {"embedding": embedding_str, "chunk_id": str(chunk.id)}
        )
        self.db.commit()
        
        # If escalation_id provided, link it
        if escalation_id:
            self.db.execute(
                text("""
                    UPDATE escalation_queue 
                    SET knowledge_chunk_id = :chunk_id
                    WHERE id = :escalation_id
                """),
                {"chunk_id": str(chunk.id), "escalation_id": str(escalation_id)}
            )
            self.db.commit()
        
        return chunk.id
