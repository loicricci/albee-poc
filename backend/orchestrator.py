"""
Orchestrator Engine - Intelligent message routing system.

The Orchestrator evaluates every incoming user message and decides whether to:
- Auto-answer with AI (Path A)
- Ask for clarification (Path B)
- Serve existing canonical answer (Path C)
- Offer escalation to creator (Path D)
- Queue for creator (Path E)
- Politely refuse (Path F)
"""

import uuid
import json
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import text, func

from openai_embed import embed_texts
from reranker import rerank_chunks
from models import (
    OrchestratorConfig,
    EscalationQueue,
    OrchestratorDecision,
    CanonicalAnswer,
    AgentFollower,
    DocumentChunk,
    Avee,
)


@dataclass
class MessageSignals:
    """Computed signals about a message."""
    similarity_score: float  # 0-1, max similarity to existing content
    novelty_score: float  # 0-1, how novel/new the question is
    complexity_score: float  # 0-1, how complex the question is
    confidence_score: float  # 0-1, how confident AI can answer
    top_similar_chunks: List[Tuple[str, float]]  # Top similar chunks with scores
    top_canonical_answer: Optional[Tuple[str, str, float]]  # (id, content, score) if found


@dataclass
class UserContext:
    """Context about the user."""
    user_id: uuid.UUID
    is_follower: bool
    user_tier: str  # 'free', 'follower', 'paid'
    recent_escalation_count: int
    total_messages_to_agent: int


@dataclass
class CreatorRules:
    """Creator-defined rules."""
    max_escalations_per_day: int
    max_escalations_per_week: int
    escalation_enabled: bool
    auto_answer_confidence_threshold: float
    clarification_enabled: bool
    blocked_topics: List[str]
    allowed_user_tiers: List[str]


@dataclass
class RoutingDecision:
    """Decision made by the Orchestrator."""
    path: str  # 'A', 'B', 'C', 'D', 'E', 'F'
    confidence: float
    reason: str
    action_data: Dict  # Path-specific data
    signals: MessageSignals


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
        
        # 2. Search for similar canonical answers
        canonical_answer, canonical_sim = self._search_canonical_answers(
            avee_id, embedding_str, layer
        )
        
        # 3. Search document chunks (RAG)
        chunk_candidates = self._search_document_chunks(
            avee_id, embedding_str, layer, limit=20
        )
        
        # 4. Rerank chunks
        if chunk_candidates:
            top_chunks_content = [c[0] for c in chunk_candidates]
            reranked = rerank_chunks(message, top_chunks_content, top_k=5)
            # Convert back to tuples with scores
            top_chunks = [(chunk, 0.8) for chunk in reranked]  # Reranker doesn't return scores
        else:
            top_chunks = []
        
        # 5. Compute similarity score (max of canonical and chunk similarity)
        chunk_max_sim = chunk_candidates[0][1] if chunk_candidates else 0.0
        similarity_score = max(canonical_sim, chunk_max_sim)
        
        # 6. Compute novelty score (inverse of similarity)
        novelty_score = 1.0 - similarity_score
        
        # 7. Compute complexity score (heuristic-based)
        complexity_score = self._compute_complexity(message)
        
        # 8. Compute confidence score
        # High confidence if: high similarity + good chunks available
        confidence_score = self._compute_confidence(
            similarity_score, len(top_chunks), complexity_score
        )
        
        return MessageSignals(
            similarity_score=similarity_score,
            novelty_score=novelty_score,
            complexity_score=complexity_score,
            confidence_score=confidence_score,
            top_similar_chunks=top_chunks,
            top_canonical_answer=canonical_answer
        )
    
    def _search_canonical_answers(
        self, 
        avee_id: uuid.UUID, 
        embedding_str: str, 
        layer: str
    ) -> Tuple[Optional[Tuple[str, str, float]], float]:
        """
        Search for similar canonical answers.
        
        Returns:
            Tuple of ((id, content, score), max_score)
        """
        # Search canonical answers with vector similarity
        result = self.db.execute(
            text("""
                SELECT id, answer_content, 1 - (embedding <=> cast(:embedding as vector)) as similarity
                FROM canonical_answers
                WHERE avee_id = :avee_id
                  AND (
                    :layer = 'intimate'
                    OR (:layer = 'friends' AND layer IN ('public', 'friends'))
                    OR (:layer = 'public' AND layer = 'public')
                  )
                  AND embedding IS NOT NULL
                ORDER BY embedding <=> cast(:embedding as vector) ASC
                LIMIT 1
            """),
            {
                "avee_id": str(avee_id),
                "embedding": embedding_str,
                "layer": layer
            }
        ).fetchone()
        
        if result and result[2] > 0.5:  # Only consider if similarity > 0.5
            return (str(result[0]), result[1], float(result[2])), float(result[2])
        
        return None, 0.0
    
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
        """
        Compute complexity score using heuristics.
        
        Factors:
        - Message length
        - Number of questions
        - Presence of complex words
        - Sentence structure
        """
        # Word count
        words = message.split()
        word_count = len(words)
        
        # Question marks (multiple questions = more complex)
        question_count = message.count("?")
        
        # Long words (> 10 chars)
        long_word_count = sum(1 for w in words if len(w) > 10)
        
        # Compute score (0-1)
        complexity = 0.0
        
        # Length factor (longer = more complex)
        if word_count > 100:
            complexity += 0.4
        elif word_count > 50:
            complexity += 0.3
        elif word_count > 20:
            complexity += 0.2
        else:
            complexity += 0.1
        
        # Multiple questions
        if question_count > 2:
            complexity += 0.3
        elif question_count > 1:
            complexity += 0.2
        
        # Complex vocabulary
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
        """
        Compute AI confidence score.
        
        High confidence when:
        - High similarity to existing content
        - Good chunks available
        - Lower complexity
        """
        # Base confidence from similarity
        confidence = similarity * 0.6
        
        # Boost from available chunks
        if num_chunks >= 5:
            confidence += 0.3
        elif num_chunks >= 3:
            confidence += 0.2
        elif num_chunks >= 1:
            confidence += 0.1
        
        # Penalty for high complexity
        confidence -= complexity * 0.2
        
        return max(0.0, min(1.0, confidence))


class UserContextEvaluator:
    """Evaluates user context signals."""
    
    def __init__(self, db: Session):
        self.db = db
    
    def get_context(self, user_id: uuid.UUID, avee_id: uuid.UUID) -> UserContext:
        """Get user context."""
        # Check if user follows the agent
        is_follower = self.db.query(AgentFollower).filter(
            AgentFollower.follower_user_id == user_id,
            AgentFollower.avee_id == avee_id
        ).first() is not None
        
        # Determine tier (simple logic for now)
        user_tier = "follower" if is_follower else "free"
        
        # Count recent escalations (last 7 days)
        seven_days_ago = datetime.utcnow() - timedelta(days=7)
        recent_escalation_count = self.db.query(EscalationQueue).filter(
            EscalationQueue.user_id == user_id,
            EscalationQueue.avee_id == avee_id,
            EscalationQueue.offered_at >= seven_days_ago
        ).count()
        
        # Count total messages to this agent
        total_messages = self.db.query(OrchestratorDecision).filter(
            OrchestratorDecision.user_id == user_id,
            OrchestratorDecision.avee_id == avee_id
        ).count()
        
        return UserContext(
            user_id=user_id,
            is_follower=is_follower,
            user_tier=user_tier,
            recent_escalation_count=recent_escalation_count,
            total_messages_to_agent=total_messages
        )


class CreatorRulesLoader:
    """Loads creator-defined rules."""
    
    def __init__(self, db: Session):
        self.db = db
    
    def load_rules(self, avee_id: uuid.UUID) -> CreatorRules:
        """Load rules for an agent."""
        config = self.db.query(OrchestratorConfig).filter(
            OrchestratorConfig.avee_id == avee_id
        ).first()
        
        if not config:
            # Create default config
            config = OrchestratorConfig(avee_id=avee_id)
            self.db.add(config)
            self.db.commit()
            self.db.refresh(config)
        
        # Parse JSON fields (handle both JSONB and Text column types)
        if isinstance(config.blocked_topics, str):
            blocked_topics = json.loads(config.blocked_topics) if config.blocked_topics else []
        else:
            blocked_topics = config.blocked_topics if config.blocked_topics else []
        
        if isinstance(config.allowed_user_tiers, str):
            allowed_user_tiers = json.loads(config.allowed_user_tiers) if config.allowed_user_tiers else ["free", "follower"]
        else:
            allowed_user_tiers = config.allowed_user_tiers if config.allowed_user_tiers else ["free", "follower"]
        
        # Handle Decimal type for threshold
        if isinstance(config.auto_answer_confidence_threshold, float):
            threshold = config.auto_answer_confidence_threshold
        elif hasattr(config.auto_answer_confidence_threshold, '__float__'):  # Decimal
            threshold = float(config.auto_answer_confidence_threshold)
        else:
            threshold = float(config.auto_answer_confidence_threshold) / 100.0
        
        return CreatorRules(
            max_escalations_per_day=config.max_escalations_per_day,
            max_escalations_per_week=config.max_escalations_per_week,
            escalation_enabled=(config.escalation_enabled if isinstance(config.escalation_enabled, bool) else config.escalation_enabled == "true"),
            auto_answer_confidence_threshold=threshold,
            clarification_enabled=(config.clarification_enabled if isinstance(config.clarification_enabled, bool) else config.clarification_enabled == "true"),
            blocked_topics=blocked_topics,
            allowed_user_tiers=allowed_user_tiers
        )


class OrchestratorEngine:
    """
    Main Orchestrator engine that routes messages through decision paths A-F.
    """
    
    def __init__(self, db: Session):
        self.db = db
        self.signal_computer = MessageSignalComputer(db)
        self.user_evaluator = UserContextEvaluator(db)
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
        Main routing logic - evaluates a message and decides the path.
        
        Returns:
            RoutingDecision with path (A-F) and action data
        """
        # 1. Compute signals
        signals = self.signal_computer.compute(message, avee_id, layer)
        
        # 2. Get user context
        user_context = self.user_evaluator.get_context(user_id, avee_id)
        
        # 3. Load creator rules
        creator_rules = self.rules_loader.load_rules(avee_id)
        
        # 4. Apply decision tree
        decision = self._decide_path(
            signals, user_context, creator_rules, conversation_id
        )
        
        # 5. Log decision
        self._log_decision(
            decision, user_id, avee_id, message, conversation_id
        )
        
        return decision
    
    def _decide_path(
        self,
        signals: MessageSignals,
        user_context: UserContext,
        rules: CreatorRules,
        conversation_id: uuid.UUID
    ) -> RoutingDecision:
        """Apply decision tree to determine routing path."""
        
        # PATH B: Clarify first (vague question)
        if rules.clarification_enabled and self._is_vague(signals):
            return RoutingDecision(
                path="B",
                confidence=0.9,
                reason="Question is too vague, requesting clarification",
                action_data={"clarification_needed": True},
                signals=signals
            )
        
        # PATH C: Serve existing canonical answer
        if signals.top_canonical_answer and signals.similarity_score >= 0.85:
            canonical_id, canonical_content, canonical_score = signals.top_canonical_answer
            return RoutingDecision(
                path="C",
                confidence=canonical_score,
                reason="Similar question already answered",
                action_data={
                    "canonical_answer_id": canonical_id,
                    "canonical_content": canonical_content,
                    "similarity": canonical_score
                },
                signals=signals
            )
        
        # PATH A: Auto-answer
        if signals.confidence_score >= rules.auto_answer_confidence_threshold:
            return RoutingDecision(
                path="A",
                confidence=signals.confidence_score,
                reason="High confidence AI can answer",
                action_data={"use_rag": True},
                signals=signals
            )
        
        # PATH F: Polite refusal (various blocking conditions)
        
        # Check if escalation is disabled
        if not rules.escalation_enabled:
            return RoutingDecision(
                path="F",
                confidence=1.0,
                reason="Escalations are currently disabled",
                action_data={"refusal_reason": "escalations_disabled"},
                signals=signals
            )
        
        # Check user tier
        if user_context.user_tier not in rules.allowed_user_tiers:
            return RoutingDecision(
                path="F",
                confidence=1.0,
                reason=f"User tier '{user_context.user_tier}' not allowed for escalations",
                action_data={"refusal_reason": "tier_not_allowed"},
                signals=signals
            )
        
        # Check escalation limits
        today_count = self._get_escalation_count_today(signals.top_similar_chunks[0][0] if signals.top_similar_chunks else "")
        if today_count >= rules.max_escalations_per_day:
            return RoutingDecision(
                path="F",
                confidence=1.0,
                reason="Daily escalation limit reached",
                action_data={"refusal_reason": "daily_limit_reached"},
                signals=signals
            )
        
        # Check weekly limits
        week_count = self._get_escalation_count_week(signals.top_similar_chunks[0][0] if signals.top_similar_chunks else "")
        if week_count >= rules.max_escalations_per_week:
            return RoutingDecision(
                path="F",
                confidence=1.0,
                reason="Weekly escalation limit reached",
                action_data={"refusal_reason": "weekly_limit_reached"},
                signals=signals
            )
        
        # PATH E: Queue for human (agent has NO relevant context)
        # This happens when the agent has no knowledge about the topic
        if len(signals.top_similar_chunks) == 0 or signals.similarity_score < 0.2:
            return RoutingDecision(
                path="E",
                confidence=0.0,
                reason="Agent has no relevant context, queuing for human response",
                action_data={
                    "queue_for_human": True,
                    "reason": "no_context"
                },
                signals=signals
            )
        
        # PATH D: Offer escalation (novel/complex question, but agent has SOME context)
        # Modified to only trigger when there IS some context available
        if (signals.novelty_score >= 0.7 or signals.complexity_score >= 0.6) and signals.similarity_score >= 0.3:
            escalation_reason = "novel" if signals.novelty_score >= 0.7 else "complex"
            return RoutingDecision(
                path="D",
                confidence=0.8,
                reason=f"Question is {escalation_reason}, offering escalation",
                action_data={
                    "escalation_reason": escalation_reason,
                    "expected_response_time": "24h"
                },
                signals=signals
            )
        
        # Default: PATH A with lower confidence (try to answer with available context)
        return RoutingDecision(
            path="A",
            confidence=signals.confidence_score,
            reason="Attempting auto-answer with available context",
            action_data={"use_rag": True},
            signals=signals
        )
    
    def _is_vague(self, signals: MessageSignals) -> bool:
        """Check if a question is too vague."""
        # Heuristics for vague questions
        # - Very short
        # - Low complexity
        # - No similar content found
        
        message_length = sum(len(chunk[0]) for chunk in signals.top_similar_chunks[:1])
        
        is_short = message_length < 20
        is_simple = signals.complexity_score < 0.2
        no_context = len(signals.top_similar_chunks) == 0
        
        return is_short and (is_simple or no_context)
    
    def _get_escalation_count_today(self, avee_id_str: str) -> int:
        """Get escalation count for today."""
        try:
            today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
            count = self.db.query(EscalationQueue).filter(
                EscalationQueue.offered_at >= today_start
            ).count()
            return count
        except:
            return 0
    
    def _get_escalation_count_week(self, avee_id_str: str) -> int:
        """Get escalation count for this week."""
        try:
            week_start = datetime.utcnow() - timedelta(days=7)
            count = self.db.query(EscalationQueue).filter(
                EscalationQueue.offered_at >= week_start
            ).count()
            return count
        except:
            return 0
    
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
            message_content=message[:500],  # Truncate long messages
            decision_path=decision.path,
            confidence_score=decision.signals.confidence_score,
            novelty_score=decision.signals.novelty_score,
            complexity_score=decision.signals.complexity_score,
            similar_answer_id=uuid.UUID(decision.action_data.get("canonical_answer_id")) if decision.path == "C" else None
        )
        self.db.add(log_entry)
        self.db.commit()

