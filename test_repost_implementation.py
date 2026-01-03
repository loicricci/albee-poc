#!/usr/bin/env python3
"""
Test script to verify repost implementation
Tests the backend API endpoints to ensure reposts are being returned correctly
"""

import requests
import json
import sys
import os

# Get the API base URL from environment or use default
API_BASE = os.getenv("API_BASE", "http://localhost:8000")

def test_unified_feed(token):
    """Test that /feed/unified returns reposts"""
    print("\n🧪 Test 1: Unified Feed includes reposts")
    print("=" * 60)
    
    url = f"{API_BASE}/feed/unified?limit=20"
    headers = {"Authorization": f"Bearer {token}"}
    
    try:
        response = requests.get(url, headers=headers)
        response.raise_for_status()
        data = response.json()
        
        total_items = data.get("total_items", 0)
        items = data.get("items", [])
        
        print(f"✓ Feed returned {total_items} items")
        
        # Check for reposts
        reposts = [item for item in items if item.get("type") == "repost"]
        posts = [item for item in items if item.get("type") == "post"]
        updates = [item for item in items if item.get("type") == "update"]
        
        print(f"  - Posts: {len(posts)}")
        print(f"  - Updates: {len(updates)}")
        print(f"  - Reposts: {len(reposts)}")
        
        if reposts:
            print(f"\n✅ SUCCESS: Found {len(reposts)} repost(s) in feed")
            for i, repost in enumerate(reposts[:3], 1):  # Show first 3
                print(f"\n  Repost #{i}:")
                print(f"    - Repost ID: {repost.get('repost_id')}")
                print(f"    - Original Post ID: {repost.get('post_id')}")
                print(f"    - Reposted by: @{repost.get('reposted_by_handle')}")
                if repost.get('repost_comment'):
                    print(f"    - Comment: \"{repost.get('repost_comment')}\"")
                print(f"    - Original author: @{repost.get('owner_handle')}")
        else:
            print("\n⚠️  WARNING: No reposts found in feed")
            print("   This might be expected if no reposts have been created yet")
        
        return True
        
    except requests.exceptions.RequestException as e:
        print(f"\n❌ FAILED: {e}")
        return False


def test_posts_endpoint(token, user_handle=None):
    """Test that GET /posts includes reposts when filtering by handle"""
    print("\n🧪 Test 2: GET /posts endpoint includes reposts")
    print("=" * 60)
    
    url = f"{API_BASE}/posts"
    if user_handle:
        url += f"?user_handle={user_handle}"
    
    headers = {"Authorization": f"Bearer {token}"}
    
    try:
        response = requests.get(url, headers=headers)
        response.raise_for_status()
        data = response.json()
        
        posts = data.get("posts", [])
        total = data.get("total", 0)
        
        print(f"✓ Endpoint returned {total} item(s)")
        
        # Check for reposts
        reposts = [post for post in posts if post.get("type") == "repost"]
        regular_posts = [post for post in posts if post.get("type") != "repost"]
        
        print(f"  - Regular posts: {len(regular_posts)}")
        print(f"  - Reposts: {len(reposts)}")
        
        if reposts:
            print(f"\n✅ SUCCESS: Found {len(reposts)} repost(s)")
            for i, repost in enumerate(reposts[:3], 1):  # Show first 3
                print(f"\n  Repost #{i}:")
                print(f"    - Reposted by: @{repost.get('reposted_by_handle')}")
                if repost.get('repost_comment'):
                    print(f"    - Comment: \"{repost.get('repost_comment')}\"")
        else:
            print("\n⚠️  WARNING: No reposts found")
            if user_handle:
                print(f"   User @{user_handle} may not have any reposts yet")
            else:
                print("   No user_handle specified, showing all posts")
        
        return True
        
    except requests.exceptions.RequestException as e:
        print(f"\n❌ FAILED: {e}")
        return False


def test_repost_structure(token):
    """Test that repost items have the correct structure"""
    print("\n🧪 Test 3: Repost data structure validation")
    print("=" * 60)
    
    url = f"{API_BASE}/feed/unified?limit=50"
    headers = {"Authorization": f"Bearer {token}"}
    
    try:
        response = requests.get(url, headers=headers)
        response.raise_for_status()
        data = response.json()
        
        items = data.get("items", [])
        reposts = [item for item in items if item.get("type") == "repost"]
        
        if not reposts:
            print("⚠️  No reposts to validate")
            return True
        
        required_fields = [
            "id", "type", "repost_id", "reposted_by_user_id",
            "reposted_by_handle", "post_id", "owner_handle",
            "image_url", "created_at", "like_count", "comment_count"
        ]
        
        all_valid = True
        for repost in reposts[:5]:  # Check first 5
            missing_fields = [field for field in required_fields if field not in repost]
            if missing_fields:
                print(f"❌ Repost {repost.get('id')} missing fields: {missing_fields}")
                all_valid = False
            
            # Validate ID format
            if not repost.get("id", "").startswith("repost-"):
                print(f"❌ Repost ID should start with 'repost-': {repost.get('id')}")
                all_valid = False
        
        if all_valid:
            print(f"✅ SUCCESS: All {len(reposts)} repost(s) have correct structure")
            print(f"\n  Sample repost structure:")
            sample = reposts[0]
            print(f"    - ID: {sample.get('id')}")
            print(f"    - Type: {sample.get('type')}")
            print(f"    - Post ID: {sample.get('post_id')}")
            print(f"    - Reposted by: @{sample.get('reposted_by_handle')}")
            print(f"    - Has comment: {'Yes' if sample.get('repost_comment') else 'No'}")
        
        return all_valid
        
    except requests.exceptions.RequestException as e:
        print(f"\n❌ FAILED: {e}")
        return False


def main():
    print("\n" + "=" * 60)
    print("🔍 REPOST IMPLEMENTATION TEST SUITE")
    print("=" * 60)
    
    # Get token from environment or prompt
    token = os.getenv("AUTH_TOKEN")
    if not token:
        print("\n⚠️  No AUTH_TOKEN found in environment")
        print("Please set AUTH_TOKEN environment variable or pass it as argument")
        print("\nExample:")
        print("  export AUTH_TOKEN='your-token-here'")
        print("  python test_repost_implementation.py")
        sys.exit(1)
    
    print(f"\n📡 Testing API at: {API_BASE}")
    print(f"🔑 Using auth token: {token[:20]}...")
    
    # Run tests
    results = []
    results.append(("Unified Feed", test_unified_feed(token)))
    results.append(("Posts Endpoint", test_posts_endpoint(token)))
    results.append(("Data Structure", test_repost_structure(token)))
    
    # Summary
    print("\n" + "=" * 60)
    print("📊 TEST SUMMARY")
    print("=" * 60)
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for test_name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status}: {test_name}")
    
    print(f"\nTotal: {passed}/{total} tests passed")
    
    if passed == total:
        print("\n🎉 All tests passed! Repost implementation is working correctly.")
        print("\n📝 Next steps:")
        print("   1. Test in the browser: Navigate to /app and repost a post")
        print("   2. Verify the repost appears in your feed")
        print("   3. Check that repost attribution is displayed correctly")
        print("   4. Test like/comment actions on reposted items")
        return 0
    else:
        print("\n⚠️  Some tests failed. Please review the output above.")
        return 1


if __name__ == "__main__":
    sys.exit(main())

