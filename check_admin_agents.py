"""
Check all admin agents and ensure they have proper profiles for the owner.
This is essential for the /u/{handle} profile pages to work.
"""
import os
import sys

# Add the backend directory to the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

from sqlalchemy import create_engine, text
from dotenv import load_dotenv

# Load environment
load_dotenv("backend/.env")

DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    print("❌ DATABASE_URL not found")
    sys.exit(1)

engine = create_engine(DATABASE_URL)

print("\n🔍 CHECKING ADMIN AGENTS AND PROFILES")
print("=" * 80)

with engine.connect() as conn:
    # Get all agents
    result = conn.execute(text("""
        SELECT 
            a.id,
            a.handle,
            a.display_name,
            a.owner_user_id,
            p.handle as owner_handle,
            p.display_name as owner_display_name,
            TO_CHAR(a.created_at, 'YYYY-MM-DD HH24:MI:SS') as created_at
        FROM avees a
        LEFT JOIN profiles p ON a.owner_user_id = p.user_id
        ORDER BY a.created_at DESC
    """))
    
    agents = result.fetchall()
    
    print(f"\nFound {len(agents)} agents in database:\n")
    
    missing_profiles = []
    
    for agent in agents:
        agent_id, agent_handle, agent_display_name, owner_user_id, owner_handle, owner_display_name, created_at = agent
        
        print(f"  📱 Agent: @{agent_handle} ({agent_display_name or 'No display name'})")
        print(f"     ID: {agent_id}")
        print(f"     Owner User ID: {owner_user_id}")
        
        if owner_handle:
            print(f"     ✅ Owner Profile: @{owner_handle} ({owner_display_name or 'No display name'})")
        else:
            print(f"     ❌ NO OWNER PROFILE FOUND!")
            missing_profiles.append((agent_handle, owner_user_id))
        
        print(f"     Created: {created_at}")
        print(f"     {'-' * 74}")
    
    if missing_profiles:
        print("\n⚠️  WARNING: The following agents are missing owner profiles:")
        print("=" * 80)
        for agent_handle, owner_user_id in missing_profiles:
            print(f"   • Agent @{agent_handle} - Owner ID: {owner_user_id}")
        
        print("\n💡 These agents will NOT be accessible via /u/{handle} until their")
        print("   owners have profiles created!")
        print("\n📝 To fix this, the owner needs to:")
        print("   1. Log in to the application")
        print("   2. Create their profile at /profile or /onboarding")
        print("   3. OR use the backoffice to create the profile")
    else:
        print("\n✅ All agents have owner profiles!")
    
    # Check for admin email
    print("\n\n🔍 CHECKING ADMIN USERS")
    print("=" * 80)
    
    result = conn.execute(text("""
        SELECT user_id, handle, display_name, email
        FROM profiles
        WHERE email = 'loic.ricci@gmail.com'
    """))
    
    admin_profile = result.fetchone()
    
    if admin_profile:
        user_id, handle, display_name, email = admin_profile
        print(f"\n✅ Admin profile found:")
        print(f"   User ID: {user_id}")
        print(f"   Handle: @{handle}")
        print(f"   Display Name: {display_name}")
        print(f"   Email: {email}")
        
        # Check agents owned by admin
        result = conn.execute(text("""
            SELECT handle, display_name 
            FROM avees 
            WHERE owner_user_id = :user_id
        """), {"user_id": user_id})
        
        admin_agents = result.fetchall()
        
        if admin_agents:
            print(f"\n   📱 Admin owns {len(admin_agents)} agent(s):")
            for agent_handle, agent_display_name in admin_agents:
                print(f"      • @{agent_handle} ({agent_display_name or 'No display name'})")
                print(f"        Profile URL: /u/{agent_handle}")
        else:
            print(f"\n   ℹ️  Admin does not own any agents yet")
    else:
        print(f"\n❌ No profile found for admin email loic.ricci@gmail.com")
        print(f"   The admin needs to complete onboarding first!")

print("\n" + "=" * 80)
print("✅ Check complete!")
print()






