"""
Migration Script: Transfer Non-Admin Agents to Admin (AUTO-CONFIRM)

This script transfers ownership of all agents belonging to non-admin users
to the admin user (loic.ricci@gmail.com) while renaming them.

WARNING: This will automatically proceed without confirmation!
"""

import os
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

# Load environment variables
load_dotenv("backend/.env")

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise ValueError("DATABASE_URL not found in environment variables")

# Admin email
ADMIN_EMAIL = "loic.ricci@gmail.com"

# Create database connection
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)

def get_admin_user_id(session):
    """Get the user_id for the admin email"""
    query = text("""
        SELECT id FROM auth.users WHERE email = :email
    """)
    result = session.execute(query, {"email": ADMIN_EMAIL}).fetchone()
    if not result:
        raise ValueError(f"Admin user with email {ADMIN_EMAIL} not found")
    return result[0]

def get_non_admin_agents(session, admin_user_id):
    """Get all agents that are NOT owned by the admin"""
    query = text("""
        SELECT id, handle, display_name, owner_user_id 
        FROM avees 
        WHERE owner_user_id != :admin_user_id
    """)
    return session.execute(query, {"admin_user_id": admin_user_id}).fetchall()

def rename_and_transfer_agents(session, admin_user_id, agents):
    """Rename agents and transfer ownership to admin"""
    count = 0
    for agent in agents:
        agent_id, handle, display_name, old_owner = agent
        
        # Rename with archived- prefix to avoid conflicts
        new_handle = f"archived-{handle}"
        
        # Update handle and owner
        update_query = text("""
            UPDATE avees 
            SET owner_user_id = :admin_user_id,
                handle = :new_handle
            WHERE id = :agent_id
        """)
        
        session.execute(update_query, {
            "admin_user_id": admin_user_id,
            "new_handle": new_handle,
            "agent_id": agent_id
        })
        
        print(f"✓ Renamed '{handle}' → '{new_handle}' and transferred to admin")
        count += 1
    
    return count

def main():
    print("=" * 60)
    print("AGENT OWNERSHIP MIGRATION TO ADMIN (AUTO-CONFIRM)")
    print("=" * 60)
    print()
    
    session = SessionLocal()
    
    try:
        # Get admin user ID
        print(f"Looking up admin user: {ADMIN_EMAIL}")
        admin_user_id = get_admin_user_id(session)
        print(f"✓ Found admin user ID: {admin_user_id}")
        print()
        
        # Get non-admin agents
        print("Finding agents owned by non-admin users...")
        agents = get_non_admin_agents(session, admin_user_id)
        print(f"✓ Found {len(agents)} agent(s) to transfer")
        print()
        
        if len(agents) == 0:
            print("No agents to transfer. All agents are already owned by admin.")
            return
        
        # Show what will be transferred
        print("Agents to be renamed and transferred:")
        print("-" * 60)
        for agent in agents:
            agent_id, handle, display_name, old_owner = agent
            new_handle = f"archived-{handle}"
            print(f"  • {handle} → {new_handle}")
            print(f"    Display Name: {display_name or 'No display name'}")
            print(f"    ID: {agent_id}")
            print()
        
        print()
        print("Proceeding with migration...")
        print("-" * 60)
        
        # Rename and transfer agents
        count = rename_and_transfer_agents(session, admin_user_id, agents)
        
        # Commit changes
        session.commit()
        
        print()
        print("=" * 60)
        print(f"✓ SUCCESS: Renamed and transferred {count} agent(s) to admin")
        print("=" * 60)
        print()
        print("WHAT HAPPENED:")
        print(f"1. All agents renamed with 'archived-' prefix")
        print(f"2. Ownership transferred to admin ({ADMIN_EMAIL})")
        print(f"3. Original handles are now available for new agents")
        print()
        print("NEXT STEPS:")
        print("1. Refresh your 'My Agents' page to see the archived agents")
        print("2. Non-admin users will get fresh agents when they edit profiles")
        print("3. Old agent data is preserved in 'archived-' agents")
        
    except Exception as e:
        session.rollback()
        print()
        print("=" * 60)
        print(f"✗ ERROR: {e}")
        print("=" * 60)
        raise
    
    finally:
        session.close()

if __name__ == "__main__":
    main()








