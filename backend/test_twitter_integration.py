"""
Test Twitter Integration
Quick script to test Twitter API setup and functionality.
"""

import os
import sys
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables - handle both running from root or backend dir
current_dir = Path(__file__).parent
env_file = current_dir / ".env"
if not env_file.exists():
    # Try parent directory (if running from root)
    env_file = current_dir.parent / "backend" / ".env"

load_dotenv(env_file)

from twitter_service import get_twitter_service


def test_twitter_api():
    """Test Twitter API connection and basic functionality."""
    
    print("=" * 60)
    print("Twitter Integration Test")
    print("=" * 60)
    print()
    
    # Check if bearer token is set
    bearer_token = os.getenv("TWITTER_BEARER_TOKEN")
    if not bearer_token:
        print("❌ TWITTER_BEARER_TOKEN not set in environment")
        print()
        print("To fix this:")
        print("1. Go to https://developer.twitter.com/en/portal/dashboard")
        print("2. Create an app and get your Bearer Token")
        print("3. Add to backend/.env: TWITTER_BEARER_TOKEN=your_token_here")
        print()
        return False
    
    print(f"✅ TWITTER_BEARER_TOKEN found: {bearer_token[:20]}...")
    print()
    
    # Initialize Twitter service
    twitter_service = get_twitter_service()
    
    if not twitter_service.is_available():
        print("❌ Twitter service not available")
        return False
    
    print("✅ Twitter service initialized successfully")
    print()
    
    # Test 1: Search for tweets
    print("-" * 60)
    print("Test 1: Search Recent Tweets")
    print("-" * 60)
    
    try:
        query = "AI"
        print(f"Searching for: '{query}'")
        tweets = twitter_service.search_recent_tweets(query, max_results=10)
        
        if tweets:
            print(f"✅ Found {len(tweets)} tweets")
            print()
            print("Sample tweet:")
            tweet = tweets[0]
            print(f"  Author: {tweet.get('author_name')} (@{tweet.get('author_username')})")
            print(f"  Text: {tweet['text'][:100]}...")
            print(f"  Engagement: {tweet['likes']} likes, {tweet['retweets']} retweets")
        else:
            print("⚠️  No tweets found (this might be normal)")
        
        print()
        
    except Exception as e:
        print(f"❌ Search test failed: {e}")
        print()
        return False
    
    # Test 2: Get user tweets
    print("-" * 60)
    print("Test 2: Get User Tweets")
    print("-" * 60)
    
    try:
        username = "OpenAI"
        print(f"Fetching tweets from: @{username}")
        tweets = twitter_service.get_user_tweets(username, max_results=5)
        
        if tweets:
            print(f"✅ Found {len(tweets)} tweets from @{username}")
            print()
            print("Latest tweet:")
            tweet = tweets[0]
            print(f"  Text: {tweet['text'][:100]}...")
            print(f"  Posted: {tweet['created_at']}")
        else:
            print("⚠️  No tweets found")
        
        print()
        
    except Exception as e:
        print(f"❌ User tweets test failed: {e}")
        print()
        return False
    
    # Test 3: Format tweet for agent update
    print("-" * 60)
    print("Test 3: Format Tweet for Agent Update")
    print("-" * 60)
    
    if tweets:
        formatted = twitter_service.format_tweet_for_agent_update(tweets[0])
        print(f"✅ Tweet formatted successfully")
        print()
        print(f"Title: {formatted['title']}")
        print(f"Topic: {formatted['topic']}")
        print(f"Content preview:")
        print(formatted['content'][:200] + "...")
        print()
    
    # Summary
    print("=" * 60)
    print("✅ All tests passed!")
    print("=" * 60)
    print()
    print("Next steps:")
    print("1. Run migration: python run_specific_migration.py 014_twitter_integration.sql")
    print("2. Configure Twitter for an agent via API")
    print("3. Trigger fetch: POST /agents/{agent_id}/twitter/fetch")
    print()
    
    return True


if __name__ == "__main__":
    success = test_twitter_api()
    sys.exit(0 if success else 1)

