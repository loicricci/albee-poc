"""
Example: Using Native Agents Programmatically

This script shows how to use native agents from your Python code.
"""

import asyncio
import sys
import os

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

from native_agents.registry import get_registry


async def example_weather_query():
    """
    Example: Query the weather agent for a specific location
    """
    
    print("=" * 60)
    print("Example 1: Weather Query")
    print("=" * 60)
    
    # Get the registry (singleton)
    registry = get_registry()
    
    # User profile with location
    user_profile = {
        "user_id": "user_123",
        "display_name": "Alice",
        "handle": "alice",
        "location": "New York, USA",
        "latitude": "40.7128",
        "longitude": "-74.0060",
        "timezone": "America/New_York"
    }
    
    # Query the weather agent
    response = await registry.process_query(
        user_query="What's the weather like today?",
        user_profile=user_profile,
        agent_id="weather"  # Specify agent explicitly
    )
    
    print(f"\n{response.content}\n")
    
    # Access structured data
    if response.data:
        current = response.data.get('current', {})
        print("Structured Data:")
        print(f"  Temperature: {current.get('temperature_2m')}°C")
        print(f"  Humidity: {current.get('relative_humidity_2m')}%")
        print(f"  Wind: {current.get('wind_speed_10m')} km/h")


async def example_auto_detection():
    """
    Example: Let the system auto-detect which agent to use
    """
    
    print("\n" + "=" * 60)
    print("Example 2: Auto-Detection")
    print("=" * 60)
    
    registry = get_registry()
    
    user_profile = {
        "display_name": "Bob",
        "latitude": "51.5074",
        "longitude": "-0.1278",
        "location": "London, UK",
        "timezone": "Europe/London"
    }
    
    # Don't specify agent_id - let it auto-detect
    queries = [
        "Will it rain tomorrow?",
        "What's the temperature?",
        "How's the weather looking for this weekend?"
    ]
    
    for query in queries:
        print(f"\nQuery: {query}")
        response = await registry.process_query(
            user_query=query,
            user_profile=user_profile
            # agent_id not specified - auto-detection!
        )
        
        # Show first line of response
        first_line = response.content.split('\n')[0]
        print(f"Response: {first_line}...")


async def example_multiple_locations():
    """
    Example: Query weather for multiple users/locations
    """
    
    print("\n" + "=" * 60)
    print("Example 3: Multiple Locations")
    print("=" * 60)
    
    registry = get_registry()
    weather_agent = registry.get_agent("weather")
    
    # Different user profiles
    users = [
        {
            "display_name": "Alice",
            "location": "Tokyo, Japan",
            "latitude": "35.6762",
            "longitude": "139.6503"
        },
        {
            "display_name": "Bob",
            "location": "Sydney, Australia",
            "latitude": "-33.8688",
            "longitude": "151.2093"
        },
        {
            "display_name": "Charlie",
            "location": "Dubai, UAE",
            "latitude": "25.2048",
            "longitude": "55.2708"
        }
    ]
    
    # Query weather for each user
    for user in users:
        response = await weather_agent.process_request(
            user_query="What's the current weather?",
            user_profile=user
        )
        
        print(f"\n{user['location']}:")
        # Show temperature line
        for line in response.content.split('\n'):
            if 'Temperature' in line:
                print(f"  {line.strip()}")
                break


async def example_error_handling():
    """
    Example: Handling errors (missing location, invalid data, etc.)
    """
    
    print("\n" + "=" * 60)
    print("Example 4: Error Handling")
    print("=" * 60)
    
    registry = get_registry()
    
    # User without location
    incomplete_profile = {
        "display_name": "Dave",
        "handle": "dave"
        # No location data!
    }
    
    response = await registry.process_query(
        user_query="What's the weather?",
        user_profile=incomplete_profile,
        agent_id="weather"
    )
    
    print(f"\nResponse: {response.content}")
    
    if response.metadata and 'error' in response.metadata:
        print(f"Error Type: {response.metadata['error']}")
        print("\n✓ Error handled gracefully!")


async def example_weekly_forecast():
    """
    Example: Get weekly weather forecast
    """
    
    print("\n" + "=" * 60)
    print("Example 5: Weekly Forecast")
    print("=" * 60)
    
    registry = get_registry()
    
    user_profile = {
        "display_name": "Eve",
        "location": "San Francisco, USA",
        "latitude": "37.7749",
        "longitude": "-122.4194",
        "timezone": "America/Los_Angeles"
    }
    
    response = await registry.process_query(
        user_query="What's the weather forecast for this week?",
        user_profile=user_profile,
        agent_id="weather"
    )
    
    print(f"\n{response.content}\n")


async def example_custom_context():
    """
    Example: Passing custom context to an agent
    """
    
    print("\n" + "=" * 60)
    print("Example 6: Custom Context")
    print("=" * 60)
    
    registry = get_registry()
    
    user_profile = {
        "display_name": "Frank",
        "location": "Miami, USA",
        "latitude": "25.7617",
        "longitude": "-80.1918"
    }
    
    # You can pass custom context for future enhancements
    custom_context = {
        "preferences": {
            "units": "metric",
            "detailed": True
        },
        "purpose": "planning outdoor activity"
    }
    
    response = await registry.process_query(
        user_query="What's the weather like?",
        user_profile=user_profile,
        agent_id="weather",
        context=custom_context
    )
    
    print(f"\n{response.content}\n")
    print(f"Context passed: {custom_context}")


async def main():
    """Run all examples"""
    
    print("\n" + "=" * 60)
    print("NATIVE AGENTS - USAGE EXAMPLES")
    print("=" * 60)
    
    try:
        # Run all examples
        await example_weather_query()
        await example_auto_detection()
        await example_multiple_locations()
        await example_error_handling()
        await example_weekly_forecast()
        await example_custom_context()
        
        print("\n" + "=" * 60)
        print("✓ ALL EXAMPLES COMPLETED")
        print("=" * 60)
        print("\nNext steps:")
        print("1. Integrate into your application")
        print("2. Add more native agents (news, traffic, etc.)")
        print("3. Customize responses based on user preferences")
        print("4. Deploy to production!")
        
    except Exception as e:
        print(f"\n✗ Error: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    asyncio.run(main())








