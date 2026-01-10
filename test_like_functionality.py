#!/usr/bin/env python3
"""
Test script to diagnose like button issues
"""
import requests
import sys
import json
from datetime import datetime

BASE_URL = "http://localhost:8000"

def print_section(title):
    print("\n" + "=" * 60)
    print(f"  {title}")
    print("=" * 60)

def test_like_functionality():
    """Test the like button functionality comprehensively"""
    
    print_section("LIKE BUTTON DIAGNOSTIC TEST")
    
    # Get user credentials
    print("\n[1] Please provide your Supabase access token:")
    token = input("Token: ").strip()
    
    if not token:
        print("❌ No token provided")
        return
    
    headers = {"Authorization": f"Bearer {token}"}
    
    # Get user profile
    print_section("Getting User Profile")
    try:
        response = requests.get(f"{BASE_URL}/me/profile", headers=headers)
        if response.status_code != 200:
            print(f"❌ Failed to get profile: {response.status_code}")
            print(response.text)
            return
        profile = response.json()
        user_id = profile.get("user_id")
        print(f"✅ Logged in as: {profile.get('display_name')} (@{profile.get('handle')})")
        print(f"   User ID: {user_id}")
    except Exception as e:
        print(f"❌ Error getting profile: {e}")
        return
    
    # Get unified feed
    print_section("Fetching Unified Feed")
    try:
        response = requests.get(f"{BASE_URL}/feed/unified?limit=20", headers=headers)
        if response.status_code != 200:
            print(f"❌ Failed to get feed: {response.status_code}")
            print(response.text)
            return
        feed_data = response.json()
        items = feed_data.get("items", [])
        print(f"✅ Found {len(items)} items in feed")
        
        # Filter to only posts (not updates)
        posts = [item for item in items if item.get("type") in ["post", "repost"]]
        print(f"   {len(posts)} posts/reposts")
        
        if not posts:
            print("⚠️  No posts found in feed to test")
            return
        
    except Exception as e:
        print(f"❌ Error getting feed: {e}")
        return
    
    # Test each post's like status
    print_section("Checking Like Status on Posts")
    for i, item in enumerate(posts[:5], 1):  # Test first 5 posts
        post_id = item.get("id")
        post_type = item.get("type")
        like_count = item.get("like_count", 0)
        user_has_liked = item.get("user_has_liked", False)
        agent_handle = item.get("agent_handle", "Unknown")
        
        print(f"\n[Post {i}] {post_type.upper()}")
        print(f"   ID: {post_id}")
        print(f"   Agent: @{agent_handle}")
        print(f"   Likes: {like_count}")
        print(f"   You liked: {user_has_liked}")
        
        # If it's a repost, get the original post ID
        if post_type == "repost":
            original_post_id = item.get("original_post_id")
            if original_post_id:
                print(f"   Original Post ID: {original_post_id}")
    
    # Test liking a post
    print_section("Testing Like/Unlike Functionality")
    
    if not posts:
        print("No posts to test")
        return
    
    test_post = posts[0]
    post_id = test_post.get("id")
    post_type = test_post.get("type")
    original_like_count = test_post.get("like_count", 0)
    original_liked = test_post.get("user_has_liked", False)
    
    print(f"\n[Test Post]")
    print(f"   ID: {post_id}")
    print(f"   Type: {post_type}")
    print(f"   Current likes: {original_like_count}")
    print(f"   You liked: {original_liked}")
    
    # Test 1: Like the post (if not already liked)
    if not original_liked:
        print("\n[Test 1] Liking the post...")
        try:
            response = requests.post(f"{BASE_URL}/posts/{post_id}/like", headers=headers)
            print(f"   Status: {response.status_code}")
            print(f"   Response: {response.json()}")
            
            if response.status_code == 200:
                print("   ✅ Like successful")
            else:
                print(f"   ❌ Like failed: {response.text}")
        except Exception as e:
            print(f"   ❌ Error: {e}")
    else:
        print("\n[Test 1] Post already liked, skipping")
    
    # Test 2: Verify the like was recorded
    print("\n[Test 2] Verifying like was recorded...")
    try:
        response = requests.get(f"{BASE_URL}/feed/unified?limit=20", headers=headers)
        if response.status_code == 200:
            feed_data = response.json()
            items = feed_data.get("items", [])
            test_item = next((item for item in items if item.get("id") == post_id), None)
            
            if test_item:
                new_like_count = test_item.get("like_count", 0)
                new_liked = test_item.get("user_has_liked", False)
                
                print(f"   Like count: {original_like_count} → {new_like_count}")
                print(f"   You liked: {original_liked} → {new_liked}")
                
                if not original_liked:
                    if new_liked and new_like_count == original_like_count + 1:
                        print("   ✅ Like successfully recorded!")
                    elif new_liked and new_like_count != original_like_count + 1:
                        print(f"   ⚠️  User liked status correct, but count mismatch")
                        print(f"   ⚠️  Expected: {original_like_count + 1}, Got: {new_like_count}")
                    elif not new_liked:
                        print("   ❌ Like was not recorded (user_has_liked still false)")
                    else:
                        print("   ⚠️  Unexpected state")
            else:
                print("   ❌ Post not found in feed after like")
        else:
            print(f"   ❌ Failed to refresh feed: {response.status_code}")
    except Exception as e:
        print(f"   ❌ Error: {e}")
    
    # Test 3: Unlike the post
    print("\n[Test 3] Unliking the post...")
    try:
        response = requests.delete(f"{BASE_URL}/posts/{post_id}/like", headers=headers)
        print(f"   Status: {response.status_code}")
        print(f"   Response: {response.json()}")
        
        if response.status_code == 200:
            print("   ✅ Unlike successful")
        elif response.status_code == 404:
            print("   ⚠️  Like not found (may not have been recorded)")
        else:
            print(f"   ❌ Unlike failed: {response.text}")
    except Exception as e:
        print(f"   ❌ Error: {e}")
    
    # Test 4: Verify the unlike was recorded
    print("\n[Test 4] Verifying unlike was recorded...")
    try:
        response = requests.get(f"{BASE_URL}/feed/unified?limit=20", headers=headers)
        if response.status_code == 200:
            feed_data = response.json()
            items = feed_data.get("items", [])
            test_item = next((item for item in items if item.get("id") == post_id), None)
            
            if test_item:
                final_like_count = test_item.get("like_count", 0)
                final_liked = test_item.get("user_has_liked", False)
                
                print(f"   Final like count: {final_like_count}")
                print(f"   Final you liked: {final_liked}")
                
                if final_like_count == original_like_count and not final_liked:
                    print("   ✅ Unlike successfully recorded!")
                else:
                    print(f"   ⚠️  State may not match expected")
                    print(f"   Expected count: {original_like_count}, Got: {final_like_count}")
                    print(f"   Expected liked: False, Got: {final_liked}")
            else:
                print("   ❌ Post not found in feed after unlike")
        else:
            print(f"   ❌ Failed to refresh feed: {response.status_code}")
    except Exception as e:
        print(f"   ❌ Error: {e}")
    
    # Check database consistency
    print_section("Database Consistency Check")
    print("\nChecking if there are posts with incorrect like counts...")
    print("(This requires running SQL queries directly)")
    print("\nTo check manually, run:")
    print("""
    SELECT 
        p.id,
        p.like_count as stored_count,
        COUNT(pl.id) as actual_count
    FROM posts p
    LEFT JOIN post_likes pl ON p.id = pl.post_id
    GROUP BY p.id, p.like_count
    HAVING p.like_count != COUNT(pl.id);
    """)
    
    print_section("Test Complete")
    print("\n✅ Diagnostic complete!")
    print("\nCommon issues to check:")
    print("  1. Database triggers not firing (check migrations)")
    print("  2. API returning wrong post ID in responses")
    print("  3. Frontend sending wrong post ID")
    print("  4. Race conditions in optimistic UI updates")
    print("  5. Caching issues (profile or feed cache)")

if __name__ == "__main__":
    test_like_functionality()



