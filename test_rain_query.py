"""
Test the improved rain query handling
"""

import asyncio
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

from native_agents.weather_agent import WeatherAgent


async def test_rain_queries():
    """Test rain-specific queries"""
    
    weather_agent = WeatherAgent()
    
    # User profile for Vallauris
    user_profile = {
        "display_name": "Loic RICCI",
        "handle": "loicricci",
        "location": "Vallauris",
        "latitude": "43.5797",
        "longitude": "7.0539",
        "timezone": "Europe/Paris"
    }
    
    print("=" * 70)
    print("TESTING IMPROVED RAIN QUERY RESPONSES")
    print("=" * 70)
    
    # Test 1: Original query
    print("\n📝 Query: 'will it rain in the coming 5 days?'")
    print("-" * 70)
    
    response = await weather_agent.process_request(
        user_query="will it rain in the coming 5 days?",
        user_profile=user_profile
    )
    
    print(response.content)
    print("\n" + "=" * 70)
    
    # Test 2: Another variation
    print("\n📝 Query: 'Is rain expected this week?'")
    print("-" * 70)
    
    response = await weather_agent.process_request(
        user_query="Is rain expected this week?",
        user_profile=user_profile
    )
    
    print(response.content)
    print("\n" + "=" * 70)
    
    # Test 3: Tomorrow
    print("\n📝 Query: 'Will it rain tomorrow?'")
    print("-" * 70)
    
    response = await weather_agent.process_request(
        user_query="Will it rain tomorrow?",
        user_profile=user_profile
    )
    
    print(response.content)
    print("\n" + "=" * 70)


if __name__ == "__main__":
    asyncio.run(test_rain_queries())





