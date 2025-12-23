"""
Example usage of the new AI conversation features.

Run this script to test all new features:
  python backend/example_ai_features.py
"""

import os
import sys
import asyncio
from dotenv import load_dotenv

load_dotenv("backend/.env")

# Add backend to path
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from streaming_service import StreamingChatService
from context_manager import ContextManager
from conversation_intelligence import ConversationIntelligence


def example_1_context_management():
    """Demonstrate context management with semantic filtering."""
    print("\n" + "="*60)
    print("EXAMPLE 1: Context Management")
    print("="*60)
    
    DATABASE_URL = os.getenv("DATABASE_URL")
    engine = create_engine(DATABASE_URL)
    
    with Session(engine) as db:
        # Replace with actual IDs from your database
        conversation_id = "your-conversation-uuid"
        avee_id = "your-avee-uuid"
        
        context_mgr = ContextManager(db, conversation_id, avee_id)
        
        # Get optimized context
        query = "Tell me about your programming background"
        history, summary = context_mgr.get_optimized_context(query)
        
        print(f"✅ Retrieved {len(history)} relevant messages")
        if summary:
            print(f"✅ Conversation summary: {summary[:100]}...")
        
        # Search memories
        memories = context_mgr.search_memories(query, k=3)
        print(f"✅ Found {len(memories)} relevant memories")
        for m in memories:
            print(f"   - {m['content']} (confidence: {m['confidence']:.0%})")


async def example_2_streaming():
    """Demonstrate streaming chat responses."""
    print("\n" + "="*60)
    print("EXAMPLE 2: Streaming Responses")
    print("="*60)
    
    DATABASE_URL = os.getenv("DATABASE_URL")
    engine = create_engine(DATABASE_URL)
    
    with Session(engine) as db:
        streaming_service = StreamingChatService(db)
        
        # Simulate a conversation
        system_prompt = "You are a helpful AI assistant."
        history = [
            {"role": "user", "content": "Hello!"},
            {"role": "assistant", "content": "Hi! How can I help you?"}
        ]
        rag_context = "User is interested in Python programming."
        query = "What's the best way to learn FastAPI?"
        
        print("🚀 Starting stream...\n")
        
        full_response = ""
        async for token in streaming_service.stream_rag_response(
            system_prompt=system_prompt,
            conversation_history=history,
            rag_context=rag_context,
            user_query=query
        ):
            full_response += token
            print(token, end="", flush=True)
        
        print(f"\n\n✅ Complete response ({len(full_response)} chars)")


def example_3_intelligence():
    """Demonstrate conversation intelligence features."""
    print("\n" + "="*60)
    print("EXAMPLE 3: Conversation Intelligence")
    print("="*60)
    
    DATABASE_URL = os.getenv("DATABASE_URL")
    engine = create_engine(DATABASE_URL)
    
    with Session(engine) as db:
        intelligence = ConversationIntelligence(db)
        
        # Analyze turn quality
        user_msg = "What are the best practices for API design?"
        assistant_resp = "Great question! API design best practices include: 1) RESTful principles, 2) Clear documentation, 3) Versioning..."
        context = "User is a software engineer learning backend development."
        
        quality = intelligence.analyze_turn_quality(user_msg, assistant_resp, context)
        print(f"✅ Turn Quality Analysis:")
        print(f"   Relevance: {quality['relevance_score']:.0%}")
        print(f"   Engagement: {quality['engagement_score']:.0%}")
        print(f"   Factual Grounding: {quality['factual_grounding']:.0%}")
        
        # Extract topics
        messages = [
            {"role": "user", "content": "Tell me about FastAPI"},
            {"role": "assistant", "content": "FastAPI is a modern Python web framework..."},
            {"role": "user", "content": "How does it compare to Flask?"},
            {"role": "assistant", "content": "FastAPI is faster and has automatic docs..."}
        ]
        
        topics = intelligence.extract_topics(messages)
        print(f"\n✅ Extracted Topics: {', '.join(topics)}")
        
        # Generate follow-ups
        follow_ups = intelligence.suggest_follow_up_questions(messages, messages[-1]["content"])
        print(f"\n✅ Follow-up Suggestions:")
        for i, q in enumerate(follow_ups, 1):
            print(f"   {i}. {q}")
        
        # Generate title
        title = intelligence.generate_conversation_title(messages)
        print(f"\n✅ Conversation Title: '{title}'")


def example_4_memory_extraction():
    """Demonstrate memory extraction."""
    print("\n" + "="*60)
    print("EXAMPLE 4: Memory Extraction")
    print("="*60)
    
    DATABASE_URL = os.getenv("DATABASE_URL")
    engine = create_engine(DATABASE_URL)
    
    with Session(engine) as db:
        conversation_id = "your-conversation-uuid"
        avee_id = "your-avee-uuid"
        
        context_mgr = ContextManager(db, conversation_id, avee_id)
        
        # Simulate conversation messages
        messages = [
            {"role": "user", "content": "I'm a software engineer at Google"},
            {"role": "assistant", "content": "That's great! What do you work on?"},
            {"role": "user", "content": "I work on backend services, mainly Python and Go"},
            {"role": "assistant", "content": "Interesting! Do you prefer Python or Go?"},
            {"role": "user", "content": "I love Python for its simplicity, but Go for performance"}
        ]
        
        # Extract memories
        memories = context_mgr.extract_semantic_memory(messages)
        
        print(f"✅ Extracted {len(memories)} memories:")
        for m in memories:
            print(f"   [{m['type']}] {m['content']} (confidence: {m['confidence']:.0%})")
        
        # Store memories (uncomment to actually store)
        # context_mgr.store_memories(memories, "message-uuid-here")
        # print("\n✅ Memories stored in database")


def main():
    """Run all examples."""
    print("\n" + "="*60)
    print("AI CONVERSATION FEATURES - EXAMPLES")
    print("="*60)
    print("\nThese examples demonstrate the new AI features.")
    print("Update conversation_id and avee_id with your actual UUIDs.\n")
    
    try:
        # Example 1: Context Management
        example_1_context_management()
        
        # Example 2: Streaming (async)
        asyncio.run(example_2_streaming())
        
        # Example 3: Intelligence
        example_3_intelligence()
        
        # Example 4: Memory Extraction
        example_4_memory_extraction()
        
        print("\n" + "="*60)
        print("✅ All examples completed successfully!")
        print("="*60 + "\n")
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        print("\nMake sure to:")
        print("1. Run the database migration first")
        print("2. Update conversation_id and avee_id in the code")
        print("3. Set DATABASE_URL in backend/.env")


if __name__ == "__main__":
    main()


