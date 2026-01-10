#!/usr/bin/env python3
"""
Quick test script to verify the diagnostic endpoint is working.
"""

import requests
import json
import sys

# Configuration
API_BASE = "http://localhost:8000"

def test_diagnostic_test_endpoint():
    """Test the /auto-post/diagnostic/test endpoint"""
    print("\n" + "="*60)
    print("🔍 Testing Diagnostic Test Endpoint")
    print("="*60)
    
    url = f"{API_BASE}/auto-post/diagnostic/test"
    
    try:
        response = requests.get(url)
        
        if response.status_code == 200:
            data = response.json()
            print("✅ Test endpoint is working!")
            print(f"\nStatus: {data.get('status')}")
            print(f"Message: {data.get('message')}")
            print("\nAvailable endpoints:")
            for name, path in data.get('endpoints', {}).items():
                print(f"  • {name}: {path}")
            return True
        else:
            print(f"❌ Unexpected status code: {response.status_code}")
            print(f"Response: {response.text}")
            return False
            
    except requests.exceptions.ConnectionError:
        print("❌ Could not connect to backend server!")
        print(f"   Make sure server is running at {API_BASE}")
        print("\n   Start with: cd backend && uvicorn main:app --reload")
        return False
    except Exception as e:
        print(f"❌ Error: {e}")
        return False


def test_api_docs():
    """Check if the endpoint appears in the API docs"""
    print("\n" + "="*60)
    print("📚 Checking API Documentation")
    print("="*60)
    
    url = f"{API_BASE}/openapi.json"
    
    try:
        response = requests.get(url)
        
        if response.status_code == 200:
            openapi = response.json()
            paths = openapi.get('paths', {})
            
            # Check for diagnostic endpoints
            diagnostic_paths = [p for p in paths.keys() if 'diagnostic' in p.lower()]
            
            if diagnostic_paths:
                print("✅ Diagnostic endpoints found in API docs!")
                for path in diagnostic_paths:
                    print(f"  • {path}")
                    for method, details in paths[path].items():
                        print(f"    - {method.upper()}: {details.get('summary', 'No summary')}")
                return True
            else:
                print("⚠️  No diagnostic endpoints found in API docs")
                return False
                
        else:
            print(f"❌ Could not fetch API docs: {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ Error: {e}")
        return False


def main():
    print("\n🚀 AutoPost Diagnostic API - Quick Test")
    print("="*60)
    
    # Test 1: Test endpoint
    test1_passed = test_diagnostic_test_endpoint()
    
    # Test 2: API docs
    test2_passed = test_api_docs()
    
    # Summary
    print("\n" + "="*60)
    print("📊 Test Summary")
    print("="*60)
    print(f"Test Endpoint: {'✅ PASS' if test1_passed else '❌ FAIL'}")
    print(f"API Docs:      {'✅ PASS' if test2_passed else '❌ FAIL'}")
    
    if test1_passed and test2_passed:
        print("\n🎉 All tests passed! The diagnostic API is ready to use.")
        print("\n📖 Next steps:")
        print("   1. Open autopost_diagnostic.html in your browser")
        print("   2. Configure your auth token")
        print("   3. Load agents and start testing!")
        print("\n📚 Documentation: AUTOPOST_DIAGNOSTIC_QUICK_START.md")
        return 0
    else:
        print("\n❌ Some tests failed. Please check the errors above.")
        return 1


if __name__ == "__main__":
    sys.exit(main())



