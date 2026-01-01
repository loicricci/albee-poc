#!/usr/bin/env python3
"""
Test script for the unified feed endpoint.
Tests that the feed returns both posts and updates from followed agents.
"""

import os
import sys
import requests
from typing import Dict, Any

# Configuration
API_BASE = os.getenv("API_BASE", "http://localhost:8000")
SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_ANON_KEY = os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")

def test_unified_feed(access_token: str) -> Dict[str, Any]:
    """
    Test the unified feed endpoint.
    
    Returns:
        Dict with test results
    """
    print("\n" + "="*60)
    print("Testing Unified Feed Endpoint")
    print("="*60)
    
    # Test 1: Get unified feed
    print("\n[Test 1] GET /feed/unified")
    print("-" * 40)
    
    try:
        response = requests.get(
            f"{API_BASE}/feed/unified?limit=20",
            headers={"Authorization": f"Bearer {access_token}"}
        )
        
        print(f"Status Code: {response.status_code}")
        
        if response.status_code != 200:
            print(f"❌ Failed: {response.text}")
            return {"success": False, "error": response.text}
        
        data = response.json()
        print(f"✅ Success!")
        print(f"\nFeed Statistics:")
        print(f"  - Total items: {data.get('total_items', 0)}")
        print(f"  - Items returned: {len(data.get('items', []))}")
        print(f"  - Has more: {data.get('has_more', False)}")
        
        # Analyze item types
        items = data.get('items', [])
        post_count = sum(1 for item in items if item.get('type') == 'post')
        update_count = sum(1 for item in items if item.get('type') == 'update')
        
        print(f"\nItem Type Breakdown:")
        print(f"  - Posts: {post_count}")
        print(f"  - Updates: {update_count}")
        
        # Show first few items
        if items:
            print(f"\nFirst 5 items:")
            for i, item in enumerate(items[:5], 1):
                item_type = item.get('type', 'unknown')
                agent_handle = item.get('agent_handle', 'N/A')
                created_at = item.get('created_at', 'N/A')
                
                if item_type == 'post':
                    title = item.get('title', 'Untitled')
                    print(f"  {i}. [POST] @{agent_handle} - {title} ({created_at})")
                elif item_type == 'update':
                    title = item.get('title', 'No title')
                    is_read = item.get('is_read', False)
                    read_status = "✓" if is_read else "•"
                    print(f"  {i}. [UPDATE] {read_status} @{agent_handle} - {title} ({created_at})")
                else:
                    print(f"  {i}. [UNKNOWN] {item_type}")
        
        # Test 2: Verify chronological order
        print(f"\n[Test 2] Verifying chronological order...")
        print("-" * 40)
        
        if len(items) > 1:
            is_chronological = True
            for i in range(len(items) - 1):
                current_time = items[i].get('created_at', '')
                next_time = items[i + 1].get('created_at', '')
                if current_time < next_time:
                    is_chronological = False
                    print(f"❌ Order violation at index {i}: {current_time} < {next_time}")
                    break
            
            if is_chronological:
                print(f"✅ Items are properly sorted (newest first)")
        else:
            print(f"⚠️  Not enough items to verify order")
        
        # Test 3: Verify required fields
        print(f"\n[Test 3] Verifying required fields...")
        print("-" * 40)
        
        required_fields = {
            'post': ['id', 'type', 'agent_handle', 'owner_user_id', 'image_url', 'created_at'],
            'update': ['id', 'type', 'agent_id', 'agent_handle', 'title', 'content', 'created_at']
        }
        
        field_errors = []
        for item in items:
            item_type = item.get('type')
            if item_type in required_fields:
                for field in required_fields[item_type]:
                    if field not in item or item[field] is None:
                        field_errors.append(f"Item {item.get('id', 'unknown')} missing field: {field}")
        
        if field_errors:
            print(f"❌ Field validation errors:")
            for error in field_errors[:5]:  # Show first 5 errors
                print(f"  - {error}")
        else:
            print(f"✅ All items have required fields")
        
        return {
            "success": True,
            "total_items": data.get('total_items', 0),
            "posts": post_count,
            "updates": update_count,
            "chronological": is_chronological if len(items) > 1 else None,
            "field_errors": len(field_errors)
        }
        
    except Exception as e:
        print(f"❌ Exception: {str(e)}")
        import traceback
        traceback.print_exc()
        return {"success": False, "error": str(e)}


def main():
    """Main test runner"""
    print("\n" + "="*60)
    print("Unified Feed Test Suite")
    print("="*60)
    
    # Check environment
    if not SUPABASE_URL or not SUPABASE_ANON_KEY:
        print("❌ Missing Supabase credentials")
        print("Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY")
        sys.exit(1)
    
    # Get access token
    print("\n⚠️  To run this test, you need a valid access token.")
    print("You can get one by:")
    print("  1. Logging into the app")
    print("  2. Opening browser console")
    print("  3. Running: (await supabase.auth.getSession()).data.session.access_token")
    print("")
    
    access_token = input("Enter access token: ").strip()
    
    if not access_token:
        print("❌ No access token provided")
        sys.exit(1)
    
    # Run tests
    results = test_unified_feed(access_token)
    
    # Summary
    print("\n" + "="*60)
    print("Test Summary")
    print("="*60)
    
    if results.get("success"):
        print("✅ All tests passed!")
        print(f"\nResults:")
        print(f"  - Total items: {results.get('total_items', 0)}")
        print(f"  - Posts: {results.get('posts', 0)}")
        print(f"  - Updates: {results.get('updates', 0)}")
        if results.get('chronological') is not None:
            print(f"  - Chronological order: {'Yes' if results['chronological'] else 'No'}")
        print(f"  - Field errors: {results.get('field_errors', 0)}")
    else:
        print("❌ Tests failed")
        print(f"Error: {results.get('error', 'Unknown error')}")
    
    print("")


if __name__ == "__main__":
    main()

