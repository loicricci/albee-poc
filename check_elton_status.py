#!/usr/bin/env python3
"""
Check the status of Elton John agent and why it's not appearing in search.
"""

import os
import sys

# Add backend to path
sys.path.insert(0, 'backend')

from dotenv import load_dotenv
from sqlalchemy import create_engine, text

# Load environment variables
load_dotenv('backend/.env', override=True)

DATABASE_URL = os.getenv('DATABASE_URL')

def check_elton_status():
    """Check Elton John's status in the database"""
    engine = create_engine(DATABASE_URL)
    
    print("=" * 70)
    print("🔍 Checking Elton John Agent Status")
    print("=" * 70)
    print()
    
    with engine.connect() as conn:
        # 1. Check if Elton John profile exists
        print("1️⃣ Checking Profiles...")
        result = conn.execute(
            text("SELECT user_id, handle, display_name FROM profiles WHERE handle ILIKE '%elton%'")
        )
        profiles = result.fetchall()
        
        if profiles:
            for p in profiles:
                print(f"   ✅ Profile found: @{p[1]} ({p[2]})")
                print(f"      User ID: {p[0]}")
        else:
            print("   ❌ No profile found matching 'elton'")
        print()
        
        # 2. Check if Elton John avee exists
        print("2️⃣ Checking Avees (Agents)...")
        result = conn.execute(
            text("""
                SELECT a.id, a.handle, a.display_name, a.owner_user_id, p.handle as owner_handle
                FROM avees a
                LEFT JOIN profiles p ON p.user_id = a.owner_user_id
                WHERE a.handle ILIKE '%elton%'
            """)
        )
        avees = result.fetchall()
        
        if avees:
            for a in avees:
                print(f"   ✅ Agent found: @{a[1]} ({a[2]})")
                print(f"      Avee ID: {a[0]}")
                print(f"      Owner User ID: {a[3]}")
                print(f"      Owner Handle: @{a[4] if a[4] else 'NO PROFILE'}")
                
                elton_avee_id = a[0]
        else:
            print("   ❌ No agent found matching 'elton'")
            elton_avee_id = None
        print()
        
        if not avees:
            print("❌ Elton John agent doesn't exist in database!")
            print("   You need to create it first.")
            return
        
        # 3. Check who is following Elton John
        print("3️⃣ Checking Followers...")
        result = conn.execute(
            text("""
                SELECT af.follower_user_id, p.handle, p.display_name
                FROM agent_followers af
                JOIN profiles p ON p.user_id = af.follower_user_id
                WHERE af.avee_id = :avee_id
            """),
            {"avee_id": elton_avee_id}
        )
        followers = result.fetchall()
        
        if followers:
            print(f"   👥 {len(followers)} follower(s):")
            for f in followers:
                print(f"      - @{f[1]} ({f[2]})")
                print(f"        User ID: {f[0]}")
        else:
            print("   ℹ️  No followers yet")
        print()
        
        # 4. Check the current logged-in user (from screenshot: loic.ricci@gmail.com)
        print("4️⃣ Checking if Loic RICCI is following Elton...")
        result = conn.execute(
            text("""
                SELECT p.user_id, p.handle, p.display_name
                FROM profiles p
                WHERE p.handle = 'loic' OR p.user_id IN (
                    SELECT user_id FROM profiles WHERE handle ILIKE '%loic%' OR handle ILIKE '%ricci%'
                )
            """)
        )
        loic_profile = result.fetchone()
        
        if loic_profile:
            loic_user_id = loic_profile[0]
            print(f"   ✅ Found Loic: @{loic_profile[1]} ({loic_profile[2]})")
            print(f"      User ID: {loic_user_id}")
            
            # Check if Loic is following Elton
            result = conn.execute(
                text("""
                    SELECT * FROM agent_followers
                    WHERE follower_user_id = :user_id AND avee_id = :avee_id
                """),
                {"user_id": loic_user_id, "avee_id": elton_avee_id}
            )
            is_following = result.fetchone()
            
            if is_following:
                print(f"   ⚠️  FOUND THE ISSUE! Loic is ALREADY FOLLOWING @eltonjohn")
                print(f"      This is why it doesn't appear in search!")
                print()
                print("💡 SOLUTION:")
                print("   The search excludes agents you already follow.")
                print("   To see Elton in search, you would need to unfollow first.")
                print("   OR we can modify the search to show all agents (including followed ones).")
            else:
                print(f"   ℹ️  Loic is NOT following @eltonjohn")
                print(f"      This means there's another issue...")
        else:
            print("   ❌ Could not find Loic's profile")
        print()
        
        # 5. Run the actual search query to see what it returns
        print("5️⃣ Running the actual search query...")
        if loic_profile:
            # Simulate the search query
            search_term = "%elton%"
            
            # Get followed IDs
            result = conn.execute(
                text("""
                    SELECT avee_id FROM agent_followers
                    WHERE follower_user_id = :user_id
                """),
                {"user_id": loic_user_id}
            )
            followed_ids = [row[0] for row in result.fetchall()]
            
            print(f"   📋 Loic is following {len(followed_ids)} agent(s)")
            
            # Run search query
            if followed_ids:
                placeholders = ','.join([f"'{fid}'" for fid in followed_ids])
                query = f"""
                    SELECT a.id, a.handle, a.display_name
                    FROM avees a
                    JOIN profiles p ON p.user_id = a.owner_user_id
                    WHERE (a.handle ILIKE :search OR a.display_name ILIKE :search)
                    AND a.id NOT IN ({placeholders})
                """
            else:
                query = """
                    SELECT a.id, a.handle, a.display_name
                    FROM avees a
                    JOIN profiles p ON p.user_id = a.owner_user_id
                    WHERE (a.handle ILIKE :search OR a.display_name ILIKE :search)
                """
            
            result = conn.execute(text(query), {"search": search_term})
            search_results = result.fetchall()
            
            if search_results:
                print(f"   ✅ Search would return {len(search_results)} result(s):")
                for r in search_results:
                    print(f"      - @{r[1]} ({r[2]})")
            else:
                print(f"   ❌ Search returns NO results (this is the bug!)")
                
                # Check if Elton would be in results without the filter
                result = conn.execute(
                    text("""
                        SELECT a.id, a.handle, a.display_name
                        FROM avees a
                        JOIN profiles p ON p.user_id = a.owner_user_id
                        WHERE a.handle ILIKE :search OR a.display_name ILIKE :search
                    """),
                    {"search": search_term}
                )
                all_results = result.fetchall()
                
                if all_results:
                    print(f"   💡 Without the 'already followed' filter, would return:")
                    for r in all_results:
                        is_followed = r[0] in followed_ids
                        status = "❌ FILTERED OUT" if is_followed else "✅"
                        print(f"      {status} @{r[1]} ({r[2]})")

if __name__ == "__main__":
    check_elton_status()






