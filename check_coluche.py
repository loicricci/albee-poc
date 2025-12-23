#!/usr/bin/env python3
"""
Quick script to check Coluche agent's current configuration
"""
import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

# Load environment
load_dotenv("backend/.env")

DATABASE_URL = os.getenv("DATABASE_URL")
COLUCHE_ID = "6b4fa184-0d54-46f3-98be-18347528fc0e"

engine = create_engine(DATABASE_URL)

print("=" * 80)
print("🎭 COLUCHE AGENT - CURRENT CONFIGURATION")
print("=" * 80)

with engine.connect() as conn:
    # Get basic agent info
    result = conn.execute(
        text("""
            SELECT handle, display_name, bio, persona, created_at
            FROM avees 
            WHERE id = :id
        """),
        {"id": COLUCHE_ID}
    ).fetchone()
    
    if not result:
        print("❌ Coluche agent not found!")
        exit(1)
    
    print("\n📌 BASIC INFO:")
    print(f"  Handle: {result[0]}")
    print(f"  Display Name: {result[1]}")
    print(f"  Created: {result[4]}")
    
    print("\n📝 BIO:")
    if result[2]:
        print(f"  {result[2]}")
    else:
        print("  ❌ NO BIO SET")
    
    print("\n🎭 PERSONA:")
    if result[3]:
        persona = result[3]
        print(f"  Length: {len(persona)} characters")
        print(f"  Preview (first 500 chars):")
        print("  " + "-" * 60)
        print("  " + persona[:500].replace("\n", "\n  "))
        if len(persona) > 500:
            print("  ...")
        print("  " + "-" * 60)
    else:
        print("  ❌ NO PERSONA SET")
    
    # Check for documents (knowledge base)
    doc_count = conn.execute(
        text("""
            SELECT COUNT(*) FROM documents WHERE avee_id = :id
        """),
        {"id": COLUCHE_ID}
    ).scalar()
    
    print(f"\n📚 KNOWLEDGE BASE:")
    print(f"  Documents: {doc_count}")
    
    if doc_count > 0:
        docs = conn.execute(
            text("""
                SELECT title, source, layer, LENGTH(content) as content_length
                FROM documents 
                WHERE avee_id = :id
                ORDER BY created_at DESC
            """),
            {"id": COLUCHE_ID}
        ).fetchall()
        
        for i, doc in enumerate(docs, 1):
            print(f"\n  {i}. {doc[0]}")
            print(f"     Source: {doc[1] or 'Manual upload'}")
            print(f"     Layer: {doc[2]}")
            print(f"     Content length: {doc[3]} chars")
    
    # Check for chunks (RAG)
    chunk_count = conn.execute(
        text("""
            SELECT COUNT(*) FROM document_chunks WHERE avee_id = :id
        """),
        {"id": COLUCHE_ID}
    ).scalar()
    
    print(f"\n🔍 RAG CHUNKS: {chunk_count}")
    
    # Check conversation history
    conv_count = conn.execute(
        text("""
            SELECT COUNT(*) FROM conversations WHERE avee_id = :id
        """),
        {"id": COLUCHE_ID}
    ).scalar()
    
    msg_count = conn.execute(
        text("""
            SELECT COUNT(*) FROM messages m
            JOIN conversations c ON c.id = m.conversation_id
            WHERE c.avee_id = :id
        """),
        {"id": COLUCHE_ID}
    ).scalar()
    
    print(f"\n💬 CONVERSATION HISTORY:")
    print(f"  Conversations: {conv_count}")
    print(f"  Total messages: {msg_count}")
    
    if msg_count > 0:
        print("\n  Recent messages:")
        recent_messages = conn.execute(
            text("""
                SELECT m.role, m.content, m.created_at
                FROM messages m
                JOIN conversations c ON c.id = m.conversation_id
                WHERE c.avee_id = :id
                ORDER BY m.created_at DESC
                LIMIT 10
            """),
            {"id": COLUCHE_ID}
        ).fetchall()
        
        for msg in reversed(recent_messages):
            timestamp = msg[2].strftime("%H:%M:%S")
            content_preview = msg[1][:80] + "..." if len(msg[1]) > 80 else msg[1]
            print(f"  [{timestamp}] {msg[0]}: {content_preview}")

print("\n" + "=" * 80)
print("✅ Review complete! See COLUCHE_AUTHENTICITY_REVIEW.md for improvement plan")
print("=" * 80)


