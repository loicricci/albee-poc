"""
Test the /profiles/{handle} endpoint to verify it returns the correct data
for admin agents like coluche
"""
import requests
import os
from dotenv import load_dotenv

# Load environment
load_dotenv("backend/.env")

# You'll need to get a valid token from the browser after logging in
# Instructions:
# 1. Log in to http://localhost:3001
# 2. Open browser console
# 3. Run: localStorage.getItem('supabase.auth.token')
# 4. Copy the access_token value
# 5. Paste it here

TOKEN = os.getenv("TEST_AUTH_TOKEN", "YOUR_TOKEN_HERE")
API_BASE = "http://localhost:8000"

def test_profile_endpoint(handle: str):
    """Test the profile endpoint for a given handle"""
    print(f"\n🧪 Testing /profiles/{handle}")
    print("=" * 70)
    
    if TOKEN == "YOUR_TOKEN_HERE":
        print("\n⚠️  No auth token provided!")
        print("   To get a token:")
        print("   1. Log in to http://localhost:3001")
        print("   2. Open browser console (F12)")
        print("   3. Run: supabase.auth.getSession()")
        print("   4. Copy the access_token")
        print("   5. Set TEST_AUTH_TOKEN in backend/.env")
        print()
        print("   OR call this script with: TEST_AUTH_TOKEN='your-token' python test_profile_endpoint.py")
        return
    
    url = f"{API_BASE}/profiles/{handle}"
    headers = {"Authorization": f"Bearer {TOKEN}"}
    
    try:
        response = requests.get(url, headers=headers)
        print(f"\n📡 Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print("\n✅ SUCCESS! Profile data received:")
            print(f"\n   Type: {data.get('type')}")
            
            if data.get('agent'):
                agent = data['agent']
                print(f"\n   Agent:")
                print(f"   • Handle: @{agent.get('handle')}")
                print(f"   • Display Name: {agent.get('display_name')}")
                print(f"   • Bio: {agent.get('bio')[:100] if agent.get('bio') else 'None'}...")
                print(f"   • Followers: {agent.get('follower_count')}")
                print(f"   • Created: {agent.get('created_at')}")
            
            if data.get('profile'):
                profile = data['profile']
                print(f"\n   Owner Profile:")
                print(f"   • Handle: @{profile.get('handle')}")
                print(f"   • Display Name: {profile.get('display_name')}")
            
            print(f"\n   Is Following: {data.get('is_following')}")
            print(f"   Is Own Profile: {data.get('is_own_profile')}")
            
        elif response.status_code == 401:
            print("\n❌ AUTHENTICATION ERROR")
            print(f"   {response.text}")
            print("\n   Your token may have expired. Get a new one!")
            
        elif response.status_code == 404:
            print("\n❌ NOT FOUND")
            print(f"   {response.text}")
            print(f"\n   The handle '{handle}' doesn't exist as a profile or agent.")
            
        else:
            print(f"\n❌ ERROR: {response.status_code}")
            print(f"   {response.text}")
            
    except requests.exceptions.ConnectionError:
        print("\n❌ CONNECTION ERROR")
        print("   Is the backend running on http://localhost:8000?")
        print("   Run: cd backend && uvicorn main:app --reload --port 8000")
    
    except Exception as e:
        print(f"\n❌ UNEXPECTED ERROR: {e}")

if __name__ == "__main__":
    # Test the coluche agent
    test_profile_endpoint("coluche")
    
    # Test a few more
    print("\n" + "=" * 70)
    test_profile_endpoint("wsj")
    
    print("\n" + "=" * 70)
    test_profile_endpoint("eltonjohn")
    
    print("\n" + "=" * 70)
    print("\n✅ All tests complete!")
    print("\nTo test more agents, add them to the list in this script.")
    print()






