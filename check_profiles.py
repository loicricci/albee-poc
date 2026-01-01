"""
Quick script to check the status of loic@wemine.fi account in both Supabase and Database
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

print("\n🔍 Checking database for all profiles...")
print("=" * 70)

with engine.connect() as conn:
    # Get all profiles
    result = conn.execute(text("""
        SELECT user_id, handle, display_name, 
               TO_CHAR(created_at, 'YYYY-MM-DD HH24:MI:SS') as created_at
        FROM profiles 
        ORDER BY created_at DESC
    """))
    
    profiles = result.fetchall()
    
    print(f"\nFound {len(profiles)} profiles in database:\n")
    
    for p in profiles:
        print(f"  User ID: {p[0]}")
        print(f"  Handle: {p[1]}")
        print(f"  Display Name: {p[2]}")
        print(f"  Created: {p[3]}")
        print(f"  {'-' * 66}")

print("\n💡 TIP: To delete a specific user, use the user_id with this SQL:")
print("   DELETE FROM profiles WHERE user_id = '<user_id_here>';")
print("\n   Or use the backoffice at http://localhost:3001/backoffice")
print()


