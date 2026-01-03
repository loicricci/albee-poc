"""
Test script for enhanced native agents with hybrid responses.

Tests:
1. Simple queries (template responses)
2. Complex queries (LLM responses)
3. Follow-up questions (context tracking)
4. Conversation history
"""

import asyncio
import sys
import os

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

from native_agents.registry import get_registry
from native_agents.context_manager import get_context_manager
from native_agents.query_analyzer import get_query_analyzer
from native_agents.config import get_config


async def test_simple_query():
    """Test 1: Simple query should use template response"""
    print("\n" + "=" * 60)
    print("TEST 1: Simple Query (Template Response)")
    print("=" * 60)
    
    registry = get_registry()
    analyzer = get_query_analyzer()
    
    user_profile = {
        "user_id": "test_user_1",
        "display_name": "Alice",
        "location": "Vallauris, France",
        "latitude": "43.5772",
        "longitude": "7.0550",
        "timezone": "Europe/Paris"
    }
    
    query = "What's the weather today?"
    
    # Analyze query
    analysis = analyzer.analyze_query(query, has_conversation_history=False)
    print(f"\nQuery: {query}")
    print(f"Analysis: {analysis}")
    print(f"Expected: Simple query, template response")
    
    # Process query
    response = await registry.process_query(
        user_query=query,
        user_profile=user_profile,
        agent_id="weather"
    )
    
    print(f"\nResponse method: {response.metadata.get('response_method', 'unknown')}")
    print(f"Response preview: {response.content[:200]}...")
    
    if response.metadata.get('response_method') == 'template':
        print("✅ PASS: Used template response as expected")
    else:
        print("❌ FAIL: Should have used template response")
    
    return response


async def test_complex_query():
    """Test 2: Complex query should use LLM response"""
    print("\n" + "=" * 60)
    print("TEST 2: Complex Query (LLM Response)")
    print("=" * 60)
    
    registry = get_registry()
    analyzer = get_query_analyzer()
    config = get_config()
    
    user_profile = {
        "user_id": "test_user_2",
        "display_name": "Bob",
        "location": "Vallauris, France",
        "latitude": "43.5772",
        "longitude": "7.0550",
        "timezone": "Europe/Paris"
    }
    
    query = "What the weather tomorrow? Can I wear shorts?"
    
    # Analyze query
    analysis = analyzer.analyze_query(query, has_conversation_history=False)
    print(f"\nQuery: {query}")
    print(f"Analysis: {analysis}")
    print(f"Expected: Complex query (clothing advice), LLM response")
    print(f"LLM enabled: {config.llm_enabled}")
    
    if not config.llm_enabled:
        print("⚠️  WARNING: LLM is disabled in config, will use template fallback")
    
    # Process query
    try:
        response = await registry.process_query(
            user_query=query,
            user_profile=user_profile,
            agent_id="weather"
        )
        
        print(f"\nResponse method: {response.metadata.get('response_method', 'unknown')}")
        print(f"Response:\n{response.content}")
        
        if config.llm_enabled and response.metadata.get('response_method') == 'llm':
            print("✅ PASS: Used LLM response as expected")
        elif not config.llm_enabled:
            print("⚠️  SKIP: LLM disabled, used template fallback")
        else:
            print("❌ FAIL: Should have used LLM response")
            
    except Exception as e:
        print(f"❌ ERROR: {e}")
        if "OPENAI_API_KEY" in str(e):
            print("⚠️  NOTE: Set OPENAI_API_KEY environment variable to test LLM features")
        return None
    
    return response


async def test_followup_questions():
    """Test 3: Follow-up questions should use context"""
    print("\n" + "=" * 60)
    print("TEST 3: Follow-up Questions (Context Tracking)")
    print("=" * 60)
    
    registry = get_registry()
    context_manager = get_context_manager()
    analyzer = get_query_analyzer()
    
    user_id = "test_user_3"
    user_profile = {
        "user_id": user_id,
        "display_name": "Charlie",
        "location": "Vallauris, France",
        "latitude": "43.5772",
        "longitude": "7.0550",
        "timezone": "Europe/Paris"
    }
    
    # Clear any existing context
    context_manager.clear_context(user_id)
    
    # First query
    query1 = "What's the weather tomorrow?"
    print(f"\nQuery 1: {query1}")
    
    response1 = await registry.process_query(
        user_query=query1,
        user_profile=user_profile,
        agent_id="weather"
    )
    
    print(f"Response 1 preview: {response1.content[:150]}...")
    
    # Check context
    has_context = context_manager.has_context(user_id)
    print(f"Context stored: {has_context}")
    
    if has_context:
        print("✅ PASS: Context stored after first query")
    else:
        print("❌ FAIL: Context not stored")
        return
    
    # Follow-up query
    query2 = "And the day after?"
    print(f"\nQuery 2 (follow-up): {query2}")
    
    analysis2 = analyzer.analyze_query(query2, has_conversation_history=True)
    print(f"Analysis: {analysis2}")
    print(f"Is follow-up: {analysis2['is_followup']}")
    
    response2 = await registry.process_query(
        user_query=query2,
        user_profile=user_profile,
        agent_id="weather"
    )
    
    print(f"Response 2:\n{response2.content[:200]}...")
    
    if analysis2['is_followup']:
        print("✅ PASS: Follow-up detected correctly")
    else:
        print("❌ FAIL: Should have detected follow-up")
    
    # Check conversation history
    messages = context_manager.get_context(user_id)
    print(f"\nConversation history: {len(messages)} messages")
    
    for i, msg in enumerate(messages):
        print(f"  {i+1}. [{msg.role}] {msg.content[:50]}...")
    
    if len(messages) >= 4:  # 2 queries + 2 responses
        print("✅ PASS: Conversation history tracked")
    else:
        print("❌ FAIL: Incomplete conversation history")


async def test_context_management():
    """Test 4: Context management features"""
    print("\n" + "=" * 60)
    print("TEST 4: Context Management")
    print("=" * 60)
    
    context_manager = get_context_manager()
    
    user_id = "test_user_4"
    
    # Add some messages
    context_manager.add_message(user_id, "user", "Test query 1")
    context_manager.add_message(user_id, "agent", "Test response 1")
    context_manager.add_message(user_id, "user", "Test query 2")
    context_manager.add_message(user_id, "agent", "Test response 2")
    
    # Get context
    messages = context_manager.get_context(user_id)
    print(f"\nMessages stored: {len(messages)}")
    
    if len(messages) == 4:
        print("✅ PASS: All messages stored")
    else:
        print(f"❌ FAIL: Expected 4 messages, got {len(messages)}")
    
    # Get last user query
    last_query = context_manager.get_last_user_query(user_id)
    print(f"Last user query: {last_query}")
    
    if last_query == "Test query 2":
        print("✅ PASS: Retrieved last user query")
    else:
        print("❌ FAIL: Wrong last query")
    
    # Clear context
    context_manager.clear_context(user_id)
    messages_after = context_manager.get_context(user_id)
    print(f"Messages after clear: {len(messages_after)}")
    
    if len(messages_after) == 0:
        print("✅ PASS: Context cleared successfully")
    else:
        print("❌ FAIL: Context not cleared")
    
    # Get stats
    stats = context_manager.get_stats()
    print(f"\nContext manager stats: {stats}")


async def test_query_analyzer():
    """Test 5: Query analyzer detection"""
    print("\n" + "=" * 60)
    print("TEST 5: Query Analyzer")
    print("=" * 60)
    
    analyzer = get_query_analyzer()
    
    test_cases = [
        ("What's the weather?", False, "Simple weather query"),
        ("Can I wear shorts tomorrow?", True, "Clothing advice (complex)"),
        ("Should I bring an umbrella?", True, "Activity advice (complex)"),
        ("Temperature today?", False, "Simple temperature query"),
        ("And tomorrow?", True, "Follow-up question"),
        ("Is it good for cycling?", True, "Activity recommendation (complex)"),
    ]
    
    print("\nTesting query analysis:")
    for query, expected_complex, description in test_cases:
        analysis = analyzer.analyze_query(query, has_conversation_history=False)
        is_complex = analysis['is_complex']
        
        status = "✅" if is_complex == expected_complex else "❌"
        print(f"\n{status} {description}")
        print(f"   Query: '{query}'")
        print(f"   Complex: {is_complex} (expected: {expected_complex})")
        print(f"   Score: {analysis['complexity_score']:.2f}")
        print(f"   Intent: {analysis['intent']}")


async def main():
    """Run all tests"""
    
    print("\n" + "=" * 60)
    print("NATIVE AGENTS ENHANCED - TEST SUITE")
    print("=" * 60)
    
    try:
        # Run tests
        await test_simple_query()
        await test_complex_query()
        await test_followup_questions()
        await test_context_management()
        await test_query_analyzer()
        
        print("\n" + "=" * 60)
        print("✅ ALL TESTS COMPLETED")
        print("=" * 60)
        print("\nNext steps:")
        print("1. Set OPENAI_API_KEY to test LLM features")
        print("2. Test in the web UI at http://localhost:3000/native-agents")
        print("3. Try complex queries like 'Can I wear shorts tomorrow?'")
        print("4. Test follow-up questions in conversation")
        
    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    asyncio.run(main())








