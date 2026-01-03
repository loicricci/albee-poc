"""
Example: Create an AI News Agent with Twitter Integration

This script demonstrates how to:
1. Create an agent
2. Configure Twitter auto-fetch
3. Manually trigger a fetch
4. Verify updates were created
5. Chat with the agent about recent tweets
"""

import requests
import json
import time
from typing import Optional

# Configuration
API_BASE_URL = "http://localhost:8000"
AUTH_TOKEN = "YOUR_AUTH_TOKEN_HERE"  # Replace with actual token

HEADERS = {
    "Authorization": f"Bearer {AUTH_TOKEN}",
    "Content-Type": "application/json"
}


def create_agent(handle: str, display_name: str, bio: str) -> Optional[str]:
    """Create a new agent."""
    print(f"\n📝 Creating agent: {handle}")
    
    response = requests.post(
        f"{API_BASE_URL}/avees",
        json={
            "handle": handle,
            "display_name": display_name,
            "bio": bio,
        },
        headers=HEADERS
    )
    
    if response.status_code == 200:
        agent_id = response.json()["id"]
        print(f"✅ Agent created: {agent_id}")
        return agent_id
    else:
        print(f"❌ Failed to create agent: {response.text}")
        return None


def configure_twitter(agent_id: str) -> bool:
    """Configure Twitter auto-fetch for the agent."""
    print(f"\n🐦 Configuring Twitter integration")
    
    config = {
        "is_enabled": True,
        "search_topics": [
            "GPT-4",
            "Claude AI",
            "artificial intelligence breakthrough"
        ],
        "twitter_accounts": [
            "OpenAI",
            "AnthropicAI",
            "ylecun"
        ],
        "max_tweets_per_fetch": 10,
        "fetch_frequency_hours": 24,
        "layer": "public",
        "auto_create_updates": True
    }
    
    response = requests.post(
        f"{API_BASE_URL}/agents/{agent_id}/twitter/config",
        json=config,
        headers=HEADERS
    )
    
    if response.status_code == 200:
        print("✅ Twitter configured successfully")
        print(f"   Topics: {config['search_topics']}")
        print(f"   Accounts: {config['twitter_accounts']}")
        return True
    else:
        print(f"❌ Failed to configure Twitter: {response.text}")
        return False


def fetch_tweets(agent_id: str) -> dict:
    """Manually trigger tweet fetch."""
    print(f"\n🔄 Fetching tweets...")
    
    response = requests.post(
        f"{API_BASE_URL}/agents/{agent_id}/twitter/fetch?force=true",
        headers=HEADERS
    )
    
    if response.status_code == 200:
        result = response.json()
        print(f"✅ Fetch complete!")
        print(f"   Tweets fetched: {result['tweets_fetched']}")
        print(f"   Updates created: {result['updates_created']}")
        return result
    else:
        print(f"❌ Failed to fetch tweets: {response.text}")
        return {}


def list_updates(agent_id: str) -> list:
    """List agent updates to verify tweets were imported."""
    print(f"\n📋 Checking agent updates...")
    
    response = requests.get(
        f"{API_BASE_URL}/agents/{agent_id}/updates",
        headers=HEADERS
    )
    
    if response.status_code == 200:
        updates = response.json()
        items = updates.get("items", [])
        print(f"✅ Found {len(items)} updates")
        
        # Show first few
        for i, update in enumerate(items[:3]):
            print(f"\n   Update {i+1}:")
            print(f"   Title: {update['title']}")
            print(f"   Content preview: {update['content'][:100]}...")
        
        return items
    else:
        print(f"❌ Failed to list updates: {response.text}")
        return []


def create_conversation(agent_id: str) -> Optional[str]:
    """Start a conversation with the agent."""
    print(f"\n💬 Creating conversation...")
    
    response = requests.post(
        f"{API_BASE_URL}/conversations/with-avee?avee_id={agent_id}",
        headers=HEADERS
    )
    
    if response.status_code == 200:
        convo_id = response.json()["id"]
        print(f"✅ Conversation created: {convo_id}")
        return convo_id
    else:
        print(f"❌ Failed to create conversation: {response.text}")
        return None


def ask_question(conversation_id: str, question: str) -> str:
    """Ask the agent a question."""
    print(f"\n🤔 Asking: {question}")
    
    response = requests.post(
        f"{API_BASE_URL}/chat/ask?conversation_id={conversation_id}&question={question}",
        headers=HEADERS
    )
    
    if response.status_code == 200:
        answer = response.json()["answer"]
        print(f"\n🤖 Agent response:")
        print(f"   {answer}")
        return answer
    else:
        print(f"❌ Failed to get response: {response.text}")
        return ""


def check_twitter_status():
    """Check if Twitter API is configured."""
    print("\n🔍 Checking Twitter API status...")
    
    response = requests.get(f"{API_BASE_URL}/twitter/status")
    
    if response.status_code == 200:
        status = response.json()
        if status["available"]:
            print(f"✅ {status['message']}")
            return True
        else:
            print(f"❌ {status['message']}")
            return False
    else:
        print("❌ Failed to check status")
        return False


def main():
    """Run the complete example."""
    print("=" * 60)
    print("Twitter-Powered AI Agent Example")
    print("=" * 60)
    
    # Check prerequisites
    if AUTH_TOKEN == "YOUR_AUTH_TOKEN_HERE":
        print("\n❌ ERROR: Please set AUTH_TOKEN in this script")
        print("   Get your token from the authentication flow")
        return
    
    # Step 0: Check Twitter API
    if not check_twitter_status():
        print("\n❌ Twitter API not configured")
        print("   Set TWITTER_BEARER_TOKEN in backend/.env")
        return
    
    # Step 1: Create agent
    agent_id = create_agent(
        handle="ai_news_bot",
        display_name="AI News Bot",
        bio="Stay updated with the latest AI developments from Twitter"
    )
    
    if not agent_id:
        return
    
    # Step 2: Configure Twitter
    if not configure_twitter(agent_id):
        return
    
    # Step 3: Fetch tweets
    fetch_result = fetch_tweets(agent_id)
    
    if not fetch_result or fetch_result.get("tweets_fetched", 0) == 0:
        print("\n⚠️  No tweets fetched - try adjusting search topics")
        return
    
    # Step 4: Verify updates
    updates = list_updates(agent_id)
    
    if not updates:
        print("\n⚠️  No updates created - check fetch logs")
        return
    
    # Step 5: Chat with agent
    print("\n" + "=" * 60)
    print("Testing Agent Conversation")
    print("=" * 60)
    
    convo_id = create_conversation(agent_id)
    
    if not convo_id:
        return
    
    # Ask about recent AI news
    questions = [
        "What are the latest AI developments?",
        "Tell me about recent tweets from OpenAI",
        "What's new in machine learning?"
    ]
    
    for question in questions:
        ask_question(convo_id, question)
        time.sleep(1)  # Rate limiting
    
    # Success!
    print("\n" + "=" * 60)
    print("✅ Example Complete!")
    print("=" * 60)
    print(f"\nYour AI News Bot is live with Twitter integration:")
    print(f"• Agent ID: {agent_id}")
    print(f"• Updates: {len(updates)}")
    print(f"• Conversation ID: {convo_id}")
    print(f"\nThe agent will automatically fetch new tweets every 24 hours.")
    print(f"Visit the feed to see updates, or chat to ask about recent tweets!")


if __name__ == "__main__":
    main()








