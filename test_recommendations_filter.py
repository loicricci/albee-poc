#!/usr/bin/env python3
"""
Test script to verify the follower sidebar fix.
This script checks if the /avees endpoint correctly filters out already-followed agents.
"""

import requests
import os
import sys

# Configuration
API_BASE = os.getenv("API_BASE", "http://localhost:8000")
SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL", "https://dqakztjxygoppdxagmtt.supabase.co")
SUPABASE_ANON_KEY = os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")

def get_auth_token(email: str, password: str) -> str:
    """Get authentication token from Supabase"""
    auth_url = f"{SUPABASE_URL}/auth/v1/token?grant_type=password"
    
    response = requests.post(
        auth_url,
        json={"email": email, "password": password},
        headers={
            "apikey": SUPABASE_ANON_KEY,
            "Content-Type": "application/json"
        }
    )
    
    if response.status_code != 200:
        raise Exception(f"Failed to authenticate: {response.text}")
    
    return response.json()["access_token"]

def get_followed_agents(token: str) -> list:
    """Get list of agents the user is following"""
    response = requests.get(
        f"{API_BASE}/network/following-agents",
        headers={"Authorization": f"Bearer {token}"}
    )
    
    if response.status_code != 200:
        raise Exception(f"Failed to get following list: {response.text}")
    
    return response.json()

def get_recommendations(token: str, limit: int = 10) -> list:
    """Get agent recommendations"""
    response = requests.get(
        f"{API_BASE}/avees?limit={limit}",
        headers={"Authorization": f"Bearer {token}"}
    )
    
    if response.status_code != 200:
        raise Exception(f"Failed to get recommendations: {response.text}")
    
    return response.json()

def test_recommendations_filter():
    """Test that recommendations don't include already-followed agents"""
    print("=" * 80)
    print("Testing Follower Sidebar Recommendations Filter")
    print("=" * 80)
    
    # Get credentials
    email = input("Enter email (press Enter for admin@gabee.ai): ").strip() or "admin@gabee.ai"
    password = input("Enter password: ").strip()
    
    if not password:
        print("❌ Password is required")
        sys.exit(1)
    
    try:
        # Authenticate
        print(f"\n1. Authenticating as {email}...")
        token = get_auth_token(email, password)
        print("✅ Authentication successful")
        
        # Get followed agents
        print("\n2. Fetching list of followed agents...")
        followed = get_followed_agents(token)
        followed_ids = {agent["id"] for agent in followed}
        followed_handles = {agent["handle"] for agent in followed}
        print(f"✅ Following {len(followed)} agents:")
        for agent in followed[:5]:  # Show first 5
            print(f"   - {agent['display_name']} (@{agent['handle']})")
        if len(followed) > 5:
            print(f"   ... and {len(followed) - 5} more")
        
        # Get recommendations
        print("\n3. Fetching recommendations...")
        recommendations = get_recommendations(token, limit=20)
        print(f"✅ Received {len(recommendations)} recommendations")
        
        # Check for overlap
        print("\n4. Checking for already-followed agents in recommendations...")
        recommended_ids = {rec["id"] for rec in recommendations}
        recommended_handles = {rec["handle"] for rec in recommendations}
        
        overlap_ids = followed_ids & recommended_ids
        overlap_handles = followed_handles & recommended_handles
        
        if overlap_ids or overlap_handles:
            print(f"\n❌ FAILED: Found {len(overlap_ids)} already-followed agents in recommendations!")
            print("\nAgents that should NOT be recommended (already following):")
            for rec in recommendations:
                if rec["id"] in overlap_ids:
                    print(f"   - {rec['display_name']} (@{rec['handle']})")
            sys.exit(1)
        else:
            print("✅ PASSED: No overlap between followed agents and recommendations")
            print("\nRecommended agents (not following):")
            for rec in recommendations[:10]:  # Show first 10
                print(f"   - {rec['display_name']} (@{rec['handle']})")
            if len(recommendations) > 10:
                print(f"   ... and {len(recommendations) - 10} more")
        
        print("\n" + "=" * 80)
        print("✅ All tests passed! Recommendations are properly filtered.")
        print("=" * 80)
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    if not SUPABASE_ANON_KEY:
        print("❌ Error: NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable not set")
        print("\nPlease set it with:")
        print("export NEXT_PUBLIC_SUPABASE_ANON_KEY='your_key_here'")
        sys.exit(1)
    
    test_recommendations_filter()

