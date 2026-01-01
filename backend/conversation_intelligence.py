"""
Conversation intelligence and quality monitoring.

Provides real-time analysis of conversation quality, topic extraction,
and adaptive response strategies.
"""

import os
from typing import List, Dict, Optional, Tuple
from openai import OpenAI
from sqlalchemy.orm import Session
from sqlalchemy import text
import json
from datetime import datetime, timedelta

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))


class ConversationIntelligence:
    """
    Analyzes and improves conversation quality.
    """
    
    def __init__(self, db: Session):
        self.db = db
    
    def analyze_turn_quality(
        self, 
        user_message: str, 
        assistant_response: str,
        context_used: str
    ) -> Dict:
        """
        Analyze the quality of a single conversation turn.
        
        Returns:
            {
                "relevance_score": 0.0-1.0,
                "engagement_score": 0.0-1.0,
                "factual_grounding": 0.0-1.0,
                "issues": ["issue1", "issue2"],
                "suggestions": ["improvement1"]
            }
        """
        prompt = f"""Analyze this conversation turn and rate it:

USER: {user_message}
ASSISTANT: {assistant_response}
CONTEXT PROVIDED: {context_used[:500]}...

Rate on 0.0-1.0 scale:
1. RELEVANCE: How well does the response address the user's question?
2. ENGAGEMENT: Is the response engaging and personable?
3. FACTUAL_GROUNDING: Does it use the provided context effectively?

Also identify any ISSUES (e.g., hallucination, off-topic, repetitive) and SUGGESTIONS for improvement.

Return ONLY valid JSON:
{{
  "relevance_score": 0.0-1.0,
  "engagement_score": 0.0-1.0,
  "factual_grounding": 0.0-1.0,
  "issues": ["issue1", "issue2"],
  "suggestions": ["suggestion1"]
}}
"""
        
        try:
            response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": "You are a conversation quality analyzer. Output only valid JSON."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.2,
                max_tokens=300
            )
            
            content = response.choices[0].message.content.strip()
            
            # Clean up markdown if present
            if content.startswith("```"):
                content = content.split("```")[1]
                if content.startswith("json"):
                    content = content[4:]
            
            analysis = json.loads(content)
            return analysis
            
        except Exception as e:
            print(f"Turn quality analysis failed: {e}")
            return {
                "relevance_score": 0.5,
                "engagement_score": 0.5,
                "factual_grounding": 0.5,
                "issues": [],
                "suggestions": []
            }
    
    def extract_topics(self, messages: List[Dict]) -> List[str]:
        """
        Extract main topics from conversation.
        
        Returns:
            List of topic strings (e.g., ["career", "python programming", "travel"])
        """
        # Take last 10 messages
        recent = messages[-10:] if len(messages) > 10 else messages
        
        conversation_text = "\n".join([
            f"{msg['role']}: {msg['content']}"
            for msg in recent
        ])
        
        prompt = f"""Extract 3-5 main topics from this conversation.
Return ONLY a JSON array of strings:
["topic1", "topic2", "topic3"]

Conversation:
{conversation_text}
"""
        
        try:
            response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": "You are a topic extraction system. Output only valid JSON array."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.2,
                max_tokens=100
            )
            
            content = response.choices[0].message.content.strip()
            
            # Clean up
            if content.startswith("```"):
                content = content.split("```")[1]
                if content.startswith("json"):
                    content = content[4:]
            
            topics = json.loads(content)
            
            if isinstance(topics, list):
                return [str(t) for t in topics[:5]]
            
            return []
            
        except Exception as e:
            print(f"Topic extraction failed: {e}")
            return []
    
    def suggest_follow_up_questions(
        self, 
        conversation_history: List[Dict],
        last_response: str
    ) -> List[str]:
        """
        Suggest intelligent follow-up questions for the user.
        
        Returns:
            List of 3 suggested questions
        """
        # Get last few turns
        recent = conversation_history[-6:] if len(conversation_history) > 6 else conversation_history
        
        context = "\n".join([
            f"{msg['role']}: {msg['content']}"
            for msg in recent
        ])
        
        prompt = f"""Based on this conversation, suggest 3 interesting follow-up questions the user might ask.
Questions should be natural, specific, and explore the topic deeper.

Return ONLY a JSON array:
["Question 1?", "Question 2?", "Question 3?"]

Recent conversation:
{context}

Last assistant response:
{last_response}
"""
        
        try:
            response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": "You suggest natural follow-up questions. Output only JSON array."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.7,
                max_tokens=150
            )
            
            content = response.choices[0].message.content.strip()
            
            if content.startswith("```"):
                content = content.split("```")[1]
                if content.startswith("json"):
                    content = content[4:]
            
            questions = json.loads(content)
            
            if isinstance(questions, list):
                return [str(q) for q in questions[:3]]
            
            return []
            
        except Exception as e:
            print(f"Follow-up suggestion failed: {e}")
            return []
    
    def detect_conversation_drift(
        self, 
        messages: List[Dict],
        initial_topics: List[str]
    ) -> Tuple[bool, float]:
        """
        Detect if conversation has drifted from initial topics.
        
        Returns:
            (has_drifted: bool, drift_score: 0.0-1.0)
        """
        if len(messages) < 10:
            return False, 0.0
        
        # Get current topics
        current_topics = self.extract_topics(messages[-10:])
        
        # Simple overlap check
        overlap = len(set(initial_topics) & set(current_topics))
        drift_score = 1.0 - (overlap / max(len(initial_topics), 1))
        
        has_drifted = drift_score > 0.7
        
        return has_drifted, drift_score
    
    def generate_conversation_title(
        self,
        messages: List[Dict]
    ) -> str:
        """
        Generate a concise title for the conversation.
        
        Returns:
            Short title string (e.g., "Python Best Practices Discussion")
        """
        # Use first 6 messages
        initial = messages[:6] if len(messages) > 6 else messages
        
        conversation_text = "\n".join([
            f"{msg['role']}: {msg['content']}"
            for msg in initial
        ])
        
        prompt = f"""Generate a concise, descriptive title (3-6 words) for this conversation.
Return ONLY the title text, no quotes or formatting.

Conversation:
{conversation_text}
"""
        
        try:
            response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": "You generate concise conversation titles."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.3,
                max_tokens=20
            )
            
            title = response.choices[0].message.content.strip()
            
            # Clean up quotes if present
            title = title.strip('"').strip("'")
            
            # Limit length
            if len(title) > 60:
                title = title[:57] + "..."
            
            return title
            
        except Exception as e:
            print(f"Title generation failed: {e}")
            return "Untitled Conversation"
    
    def calculate_engagement_metrics(
        self,
        conversation_id: str
    ) -> Dict:
        """
        Calculate engagement metrics for a conversation.
        
        Returns:
            {
                "total_turns": int,
                "avg_user_message_length": float,
                "avg_response_time": float (seconds),
                "conversation_depth": int (consecutive turns),
                "user_satisfaction_estimate": 0.0-1.0
            }
        """
        result = self.db.execute(
            text("""
                SELECT role, content, created_at
                FROM messages
                WHERE conversation_id = :conv_id
                ORDER BY created_at ASC
            """),
            {"conv_id": conversation_id}
        ).fetchall()
        
        if not result:
            return {
                "total_turns": 0,
                "avg_user_message_length": 0,
                "avg_response_time": 0,
                "conversation_depth": 0,
                "user_satisfaction_estimate": 0.5
            }
        
        messages = [{"role": r[0], "content": r[1], "created_at": r[2]} for r in result]
        
        # Count turns
        user_messages = [m for m in messages if m["role"] == "user"]
        total_turns = len(user_messages)
        
        # Average message length
        if user_messages:
            avg_length = sum(len(m["content"]) for m in user_messages) / len(user_messages)
        else:
            avg_length = 0
        
        # Response times
        response_times = []
        for i in range(len(messages) - 1):
            if messages[i]["role"] == "user" and messages[i+1]["role"] == "assistant":
                time_diff = (messages[i+1]["created_at"] - messages[i]["created_at"]).total_seconds()
                response_times.append(time_diff)
        
        avg_response_time = sum(response_times) / len(response_times) if response_times else 0
        
        # Conversation depth (consecutive turns without long gaps)
        depth = len(messages)
        
        # Estimate satisfaction based on metrics
        # Longer conversations with moderate message lengths indicate good engagement
        satisfaction = min(1.0, (total_turns / 10) * 0.5 + (avg_length / 200) * 0.3 + 0.2)
        satisfaction = max(0.0, min(1.0, satisfaction))
        
        return {
            "total_turns": total_turns,
            "avg_user_message_length": round(avg_length, 1),
            "avg_response_time": round(avg_response_time, 2),
            "conversation_depth": depth,
            "user_satisfaction_estimate": round(satisfaction, 2)
        }







