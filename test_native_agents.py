"""
Test script for Native Agents system

This script tests the Weather Agent functionality without requiring
a running server or database.
"""

import asyncio
import sys
import os

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

from native_agents.weather_agent import WeatherAgent
from native_agents.registry import get_registry


async def test_weather_agent():
    """Test the Weather Agent with mock user profile"""
    
    print("=" * 60)
    print("Testing Native Agents - Weather Agent")
    print("=" * 60)
    
    # Initialize agent
    weather_agent = WeatherAgent()
    
    print(f"\n✓ Agent initialized: {weather_agent.name}")
    print(f"  ID: {weather_agent.agent_id}")
    print(f"  Description: {weather_agent.description}")
    print(f"  Requires location: {weather_agent.requires_location()}")
    
    # Test can_handle
    print("\n" + "=" * 60)
    print("Testing query detection (can_handle)")
    print("=" * 60)
    
    test_queries = [
        ("What's the weather like?", True),
        ("Will it rain tomorrow?", True),
        ("Tell me a joke", False),
        ("How's the temperature today?", True),
        ("Quel temps fait-il?", True),  # French
    ]
    
    for query, expected in test_queries:
        result = weather_agent.can_handle(query)
        status = "✓" if result == expected else "✗"
        print(f"{status} '{query}' -> {result} (expected: {expected})")
    
    # Test with real API call (Paris coordinates)
    print("\n" + "=" * 60)
    print("Testing real weather API call")
    print("=" * 60)
    
    user_profile = {
        "display_name": "Test User",
        "handle": "testuser",
        "location": "Paris, France",
        "latitude": "48.8566",
        "longitude": "2.3522",
        "timezone": "Europe/Paris"
    }
    
    print(f"\nUser: {user_profile['display_name']}")
    print(f"Location: {user_profile['location']}")
    print(f"Coordinates: {user_profile['latitude']}, {user_profile['longitude']}")
    
    # Test current weather
    print("\n--- Query: Current Weather ---")
    response = await weather_agent.process_request(
        user_query="What's the current weather?",
        user_profile=user_profile
    )
    
    print(f"\n{response.content}")
    print(f"\nStructured Data Available: {bool(response.data)}")
    if response.data:
        current = response.data.get('current', {})
        print(f"  - Temperature: {current.get('temperature_2m')}°C")
        print(f"  - Humidity: {current.get('relative_humidity_2m')}%")
        print(f"  - Wind: {current.get('wind_speed_10m')} km/h")
    
    # Test weekly forecast
    print("\n--- Query: Weekly Forecast ---")
    response = await weather_agent.process_request(
        user_query="What's the weather forecast for this week?",
        user_profile=user_profile
    )
    
    print(f"\n{response.content}")
    
    # Test missing location
    print("\n" + "=" * 60)
    print("Testing error handling (missing location)")
    print("=" * 60)
    
    incomplete_profile = {
        "display_name": "User Without Location",
        "handle": "nolocuser"
    }
    
    response = await weather_agent.process_request(
        user_query="What's the weather?",
        user_profile=incomplete_profile
    )
    
    print(f"\n{response.content}")
    print(f"Error metadata: {response.metadata}")


async def test_registry():
    """Test the Native Agent Registry"""
    
    print("\n" + "=" * 60)
    print("Testing Native Agent Registry")
    print("=" * 60)
    
    registry = get_registry()
    
    print(f"\n✓ Registry initialized")
    print(f"  Total agents: {registry.get_agent_count()}")
    
    # List agents
    print("\n--- Available Agents ---")
    agents = registry.list_agents()
    for agent in agents:
        print(f"\n  {agent['name']} (ID: {agent['agent_id']})")
        print(f"    Description: {agent['description']}")
        print(f"    Requires Location: {agent['requires_location']}")
        print(f"    Supported Queries: {', '.join(agent['supported_queries'][:3])}...")
    
    # Test auto-detection
    print("\n--- Testing Auto-Detection ---")
    user_profile = {
        "display_name": "Auto User",
        "latitude": "48.8566",
        "longitude": "2.3522",
        "location": "Paris"
    }
    
    test_queries = [
        "What's the weather?",
        "Will it rain?",
        "Tell me about Paris"  # Should not match
    ]
    
    for query in test_queries:
        agent = registry.find_agent_for_query(query)
        if agent:
            print(f"✓ '{query}' -> {agent.name}")
        else:
            print(f"✗ '{query}' -> No agent found")


async def main():
    """Run all tests"""
    
    print("\n" + "=" * 60)
    print("NATIVE AGENTS TEST SUITE")
    print("=" * 60)
    
    try:
        await test_weather_agent()
        await test_registry()
        
        print("\n" + "=" * 60)
        print("✓ ALL TESTS COMPLETED SUCCESSFULLY")
        print("=" * 60)
        
    except Exception as e:
        print("\n" + "=" * 60)
        print("✗ TEST FAILED")
        print("=" * 60)
        print(f"\nError: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    asyncio.run(main())





