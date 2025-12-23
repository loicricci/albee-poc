#!/usr/bin/env python3
"""
Quick verification that Coluche agent is properly configured
"""
import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv("backend/.env", override=True)
engine = create_engine(os.getenv("DATABASE_URL"))

COLUCHE_ID = "6b4fa184-0d54-46f3-98be-18347528fc0e"

def check_item(condition, message):
    status = "✅" if condition else "❌"
    print(f"{status} {message}")
    return condition

print("\n" + "=" * 80)
print("🔍 COLUCHE AGENT - SETUP VERIFICATION")
print("=" * 80 + "\n")

all_good = True

with engine.connect() as conn:
    # Check basic info
    result = conn.execute(
        text("""
            SELECT display_name, bio, persona, created_at
            FROM avees 
            WHERE id = :id
        """),
        {"id": COLUCHE_ID}
    ).fetchone()
    
    if not result:
        print("❌ Coluche agent not found!")
        exit(1)
    
    display_name, bio, persona, created_at = result
    
    print("📌 BASIC CONFIGURATION")
    all_good &= check_item(
        display_name == "Coluche",
        f"Display name is 'Coluche' (current: '{display_name}')"
    )
    
    all_good &= check_item(
        bio and "enfoiré" in bio.lower() or "merde" in bio.lower(),
        "Bio has authentic Coluche language"
    )
    
    all_good &= check_item(
        persona and len(persona) > 5000,
        f"Persona is substantial (length: {len(persona) if persona else 0} chars)"
    )
    
    all_good &= check_item(
        persona and "enfoiré" in persona.lower(),
        "Persona includes vulgar language instructions"
    )
    
    all_good &= check_item(
        persona and "Salut enfoiré" in persona,
        "Persona includes greeting examples"
    )
    
    all_good &= check_item(
        persona and "Restos du Cœur" in persona or "Restos du Coeur" in persona,
        "Persona mentions Restos du Cœur"
    )
    
    # Check knowledge base
    print("\n📚 KNOWLEDGE BASE")
    
    doc_count = conn.execute(
        text("SELECT COUNT(*) FROM documents WHERE avee_id = :id"),
        {"id": COLUCHE_ID}
    ).scalar()
    
    all_good &= check_item(
        doc_count >= 2,
        f"Has knowledge documents (count: {doc_count}, expected: ≥2)"
    )
    
    chunk_count = conn.execute(
        text("SELECT COUNT(*) FROM document_chunks WHERE avee_id = :id"),
        {"id": COLUCHE_ID}
    ).scalar()
    
    all_good &= check_item(
        chunk_count >= 10,
        f"Has embedded chunks (count: {chunk_count}, expected: ≥10)"
    )
    
    # Check document titles
    if doc_count > 0:
        docs = conn.execute(
            text("SELECT title FROM documents WHERE avee_id = :id"),
            {"id": COLUCHE_ID}
        ).fetchall()
        
        has_bio = any("biographie" in d[0].lower() for d in docs)
        has_sketches = any("sketch" in d[0].lower() for d in docs)
        
        all_good &= check_item(has_bio, "Has biography document")
        all_good &= check_item(has_sketches, "Has sketches document")
    
    # Check conversation history
    print("\n💬 CONVERSATION HISTORY")
    
    msg_count = conn.execute(
        text("""
            SELECT COUNT(*) FROM messages m
            JOIN conversations c ON c.id = m.conversation_id
            WHERE c.avee_id = :id
        """),
        {"id": COLUCHE_ID}
    ).scalar()
    
    check_item(
        msg_count > 0,
        f"Has conversation history ({msg_count} messages)"
    )

print("\n" + "=" * 80)
if all_good:
    print("✅ ALL CHECKS PASSED! Coluche agent is properly configured!")
    print("=" * 80)
    print("\n🎉 READY TO TEST!")
    print("   1. Open http://localhost:3000")
    print("   2. Go to chat with Coluche")
    print("   3. Say: 'Salut Michel'")
    print("   4. He should respond: 'Salut enfoiré!' or similar")
    print("\n💡 If responses are still too polite, check the system prompts in")
    print("   backend/main.py around line 1404 (layer_prompt)")
else:
    print("❌ SOME CHECKS FAILED!")
    print("=" * 80)
    print("\n🔧 TROUBLESHOOTING:")
    print("   1. Re-run: python update_coluche_persona.py")
    print("   2. Re-run: python add_coluche_knowledge.py")
    print("   3. Check: python check_coluche.py")
    print("   4. See: COLUCHE_UPDATED_SUMMARY.md for full guide")

print("=" * 80 + "\n")


