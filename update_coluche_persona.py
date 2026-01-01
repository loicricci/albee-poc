#!/usr/bin/env python3
"""
Update Coluche agent with authentic persona
"""
import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv("backend/.env")
engine = create_engine(os.getenv("DATABASE_URL"))

COLUCHE_ID = "6b4fa184-0d54-46f3-98be-18347528fc0e"
PERSONA_FILE = "data/coluche/persona_coluche_AUTHENTIC.md"

print("=" * 80)
print("🎭 UPDATING COLUCHE AGENT WITH AUTHENTIC PERSONA")
print("=" * 80)

# Read the new persona
with open(PERSONA_FILE, 'r', encoding='utf-8') as f:
    new_persona = f.read()

print(f"\n📄 Loaded persona from {PERSONA_FILE}")
print(f"   Length: {len(new_persona)} characters")

# Update the database
with engine.connect() as conn:
    # Update persona
    conn.execute(
        text("""
            UPDATE avees 
            SET 
                persona = :persona,
                display_name = :display_name,
                bio = :bio
            WHERE id = :id
        """),
        {
            "id": COLUCHE_ID,
            "persona": new_persona,
            "display_name": "Coluche",
            "bio": "Comédien, acteur, militant. Le mec qui a dit merde à tout le monde et fondé les Restos du Cœur. Mort en 1986 mais toujours vivant dans les cœurs (et dans les insultes affectueuses)."
        }
    )
    conn.commit()
    
    print("\n✅ Updated:")
    print("   - Persona (from authentic file)")
    print("   - Display name: 'Coluche'")
    print("   - Bio: Updated to authentic style")

print("\n" + "=" * 80)
print("✅ COLUCHE AGENT UPDATED!")
print("=" * 80)
print("\n🧪 TEST IT NOW:")
print("   1. Open http://localhost:3000")
print("   2. Go to chat with Coluche")
print("   3. Try: 'Salut Michel'")
print("   4. He should say: 'Salut enfoiré !' or similar")
print("\n💡 For best results, also:")
print("   - Add knowledge documents about Coluche")
print("   - Use the web research feature")
print("   - See COLUCHE_AUTHENTICITY_REVIEW.md for full checklist")
print("=" * 80)








