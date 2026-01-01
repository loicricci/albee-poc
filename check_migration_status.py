"""
Quick check: How many agents will be migrated?
"""
import os
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

load_dotenv("backend/.env")
DATABASE_URL = os.getenv("DATABASE_URL")
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)

ADMIN_EMAIL = "loic.ricci@gmail.com"

session = SessionLocal()

try:
    # Get admin user ID
    admin_query = text("SELECT id FROM auth.users WHERE email = :email")
    admin_result = session.execute(admin_query, {"email": ADMIN_EMAIL}).fetchone()
    
    if not admin_result:
        print(f"❌ Admin user {ADMIN_EMAIL} not found!")
    else:
        admin_id = admin_result[0]
        print(f"✓ Admin ID: {admin_id}")
        print()
        
        # Count admin's current agents
        admin_agents = text("""
            SELECT COUNT(*) FROM avees WHERE owner_user_id = :admin_id
        """)
        count = session.execute(admin_agents, {"admin_id": admin_id}).scalar()
        print(f"Admin currently owns: {count} agents")
        print()
        
        # Count non-admin agents
        non_admin_agents = text("""
            SELECT COUNT(*) FROM avees WHERE owner_user_id != :admin_id
        """)
        count = session.execute(non_admin_agents, {"admin_id": admin_id}).scalar()
        print(f"Non-admin users own: {count} agents")
        print()
        
        if count == 0:
            print("⚠️  No agents to migrate! All agents are already owned by admin.")
        else:
            print(f"✓ {count} agent(s) will be migrated to admin")
            print()
            print("To migrate, run:")
            print("  python migrate_agents_to_admin.py")

finally:
    session.close()





