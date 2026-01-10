"""Debug feed issues"""
import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv("backend/.env")
DATABASE_URL = os.getenv("DATABASE_URL")

engine = create_engine(DATABASE_URL)

with engine.connect() as conn:
    print("=" * 80)
    print("CHECKING USER PROFILE")
    print("=" * 80)
    
    # Find user by email loic@wf-mo.com
    result = conn.execute(text("""
        SELECT user_id, handle, display_name 
        FROM profiles 
        WHERE user_id IN (
            SELECT id FROM auth.users WHERE email = 'loic@wf-mo.com'
        )
    """))
    user = result.fetchone()
    
    if user:
        print(f"✓ User found: {user.handle} (ID: {user.user_id})")
        user_id = user.user_id
    else:
        print("✗ User not found with email loic@wf-mo.com")
        print("\nLet me check all users:")
        result = conn.execute(text("SELECT email FROM auth.users LIMIT 10"))
        for row in result:
            print(f"  - {row.email}")
        exit(1)
    
    print("\n" + "=" * 80)
    print("CHECKING AGENTS OWNED BY USER")
    print("=" * 80)
    
    result = conn.execute(text("""
        SELECT id, handle, display_name 
        FROM avees 
        WHERE owner_user_id = :user_id
    """), {"user_id": user_id})
    
    owned_agents = result.fetchall()
    print(f"Found {len(owned_agents)} owned agents:")
    for agent in owned_agents:
        print(f"  - {agent.handle} ({agent.display_name})")
    
    print("\n" + "=" * 80)
    print("CHECKING FOLLOWED AGENTS")
    print("=" * 80)
    
    result = conn.execute(text("""
        SELECT a.id, a.handle, a.display_name, af.created_at
        FROM agent_followers af
        JOIN avees a ON a.id = af.avee_id
        WHERE af.follower_user_id = :user_id
        ORDER BY af.created_at DESC
    """), {"user_id": user_id})
    
    followed = result.fetchall()
    print(f"Found {len(followed)} followed agents:")
    for agent in followed:
        print(f"  - {agent.handle} ({agent.display_name}) - followed at {agent.created_at}")
    
    print("\n" + "=" * 80)
    print("CHECKING L'EQUIPE AGENT")
    print("=" * 80)
    
    result = conn.execute(text("""
        SELECT id, handle, display_name, owner_user_id
        FROM avees 
        WHERE LOWER(handle) LIKE '%equip%' OR LOWER(display_name) LIKE '%equip%'
    """))
    
    lequipe = result.fetchall()
    if lequipe:
        for agent in lequipe:
            print(f"✓ Found agent: {agent.handle} ({agent.display_name})")
            print(f"  Owner: {agent.owner_user_id}")
            print(f"  ID: {agent.id}")
            
            # Check updates for this agent
            result2 = conn.execute(text("""
                SELECT id, title, content, created_at
                FROM agent_updates
                WHERE avee_id = :agent_id
                ORDER BY created_at DESC
            """), {"agent_id": agent.id})
            
            updates = result2.fetchall()
            print(f"  Updates: {len(updates)}")
            for update in updates:
                print(f"    - [{update.created_at}] {update.title}")
    else:
        print("✗ L'equipe agent not found")
    
    print("\n" + "=" * 80)
    print("CHECKING ALL AGENT UPDATES")
    print("=" * 80)
    
    # Get all agent IDs (owned + followed)
    all_agent_ids = [a.id for a in owned_agents] + [a.id for a in followed]
    
    if all_agent_ids:
        # Convert to string list for SQL
        placeholders = ', '.join([f"'{aid}'" for aid in all_agent_ids])
        
        result = conn.execute(text(f"""
            SELECT au.id, au.title, au.created_at, a.handle, a.display_name
            FROM agent_updates au
            JOIN avees a ON a.id = au.avee_id
            WHERE au.avee_id IN ({placeholders})
            ORDER BY au.created_at DESC
            LIMIT 20
        """))
        
        all_updates = result.fetchall()
        print(f"Found {len(all_updates)} total updates:")
        for update in all_updates:
            print(f"  - [{update.created_at}] {update.handle}: {update.title}")
    else:
        print("No agents to check")
    
    print("\n" + "=" * 80)
    print("SUMMARY")
    print("=" * 80)
    print(f"Owned agents: {len(owned_agents)}")
    print(f"Followed agents: {len(followed)}")
    print(f"Total agents in feed: {len(owned_agents) + len(followed)}")
    
    if len(owned_agents) + len(followed) == 0:
        print("\n⚠️  ISSUE: User has no agents (owned or followed)")
        print("Action: Follow some agents from the Network page")
    elif len(all_updates) == 0:
        print("\n⚠️  ISSUE: No updates exist for any of the user's agents")
        print("Action: Create some updates using the QuickUpdateComposer")
    else:
        print(f"\n✓ Feed should show {len(all_updates)} updates")













