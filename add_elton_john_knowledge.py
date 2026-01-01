#!/usr/bin/env python3
"""
Add knowledge documents to Elton John agent
"""
import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv
import sys

# Add backend to path
sys.path.insert(0, 'backend')

from backend.rag_utils import chunk_text
from backend.openai_embed import embed_texts

# Load env from backend/.env
load_dotenv("backend/.env", override=True)

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    print("❌ DATABASE_URL not found in environment")
    sys.exit(1)

engine = create_engine(DATABASE_URL)

# You'll need to update these with the actual Elton John agent ID
# Run this query first to get the agent ID:
# SELECT id, handle FROM agents WHERE handle = 'eltonjohn';
ELTON_JOHN_AGENT_ID = None  # TO BE FILLED
USER_ID = None  # TO BE FILLED - The owner user ID

KNOWLEDGE_FILES = [
    {
        "path": "data/elton_john/knowledge_biography.md",
        "title": "Elton John - Complete Biography",
        "layer": "public"
    },
    {
        "path": "data/elton_john/knowledge_music_discography.md",
        "title": "Elton John - Music & Discography",
        "layer": "public"
    },
    {
        "path": "data/elton_john/knowledge_personal_life_activism.md",
        "title": "Elton John - Personal Life & Activism",
        "layer": "public"
    }
]

if not ELTON_JOHN_AGENT_ID or not USER_ID:
    print("\n⚠️  SETUP REQUIRED:")
    print("=" * 80)
    print("\n1. First, find the Elton John agent ID and owner user ID:")
    print("   Run this SQL query in your database:")
    print("   SELECT a.id as agent_id, a.handle, a.owner_user_id FROM agents a WHERE handle = 'eltonjohn';")
    print("\n2. Update this script with:")
    print("   ELTON_JOHN_AGENT_ID = '<agent-id-from-query>'")
    print("   USER_ID = '<owner_user_id-from-query>'")
    print("\n3. Then run this script again")
    print("=" * 80)
    
    # Try to auto-detect
    with engine.connect() as conn:
        result = conn.execute(
            text("SELECT id, owner_user_id FROM agents WHERE handle = 'eltonjohn'")
        ).fetchone()
        
        if result:
            print("\n✨ Found Elton John agent:")
            print(f"   Agent ID: {result[0]}")
            print(f"   Owner User ID: {result[1]}")
            print("\n📝 Update the script with these values and run again.")
        else:
            print("\n❌ No agent found with handle 'eltonjohn'")
            print("   Create the agent first in the application.")
    
    sys.exit(1)

print("=" * 80)
print("🎹 ADDING KNOWLEDGE TO ELTON JOHN AGENT")
print("=" * 80)

with engine.connect() as conn:
    for file_info in KNOWLEDGE_FILES:
        print(f"\n📄 Processing: {file_info['title']}")
        
        # Read file
        with open(file_info['path'], 'r', encoding='utf-8') as f:
            content = f.read()
        
        print(f"   Content length: {len(content)} characters")
        
        # Create document
        result = conn.execute(
            text("""
                INSERT INTO documents (owner_user_id, agent_id, layer, title, content, source)
                VALUES (:owner_user_id, :agent_id, :layer, :title, :content, :source)
                RETURNING id
            """),
            {
                "owner_user_id": USER_ID,
                "agent_id": ELTON_JOHN_AGENT_ID,
                "layer": file_info['layer'],
                "title": file_info['title'],
                "content": content,
                "source": file_info['path']
            }
        )
        document_id = result.fetchone()[0]
        print(f"   ✅ Document created: {document_id}")
        
        # Chunk the content
        chunks = chunk_text(content)
        print(f"   Chunking: {len(chunks)} chunks")
        
        # Embed the chunks
        print(f"   Embedding chunks...")
        vectors = embed_texts(chunks)
        
        # Insert chunks with embeddings
        for i, (chunk, vec) in enumerate(zip(chunks, vectors)):
            vec_str = "[" + ",".join(str(x) for x in vec) + "]"
            
            conn.execute(
                text("""
                    INSERT INTO document_chunks
                      (document_id, agent_id, layer, chunk_index, content, embedding)
                    VALUES
                      (:document_id, :agent_id, :layer, :chunk_index, :content, (:embedding)::vector)
                """),
                {
                    "document_id": str(document_id),
                    "agent_id": ELTON_JOHN_AGENT_ID,
                    "layer": file_info['layer'],
                    "chunk_index": i,
                    "content": chunk,
                    "embedding": vec_str,
                }
            )
        
        print(f"   ✅ {len(chunks)} chunks embedded and stored")
        conn.commit()

print("\n" + "=" * 80)
print("✅ KNOWLEDGE BASE UPDATED!")
print("=" * 80)
print("\n📊 Summary:")

with engine.connect() as conn:
    doc_count = conn.execute(
        text("SELECT COUNT(*) FROM documents WHERE agent_id = :id"),
        {"id": ELTON_JOHN_AGENT_ID}
    ).scalar()
    
    chunk_count = conn.execute(
        text("SELECT COUNT(*) FROM document_chunks WHERE agent_id = :id"),
        {"id": ELTON_JOHN_AGENT_ID}
    ).scalar()
    
    print(f"   Total documents: {doc_count}")
    print(f"   Total chunks: {chunk_count}")

print("\n🧪 TEST IT NOW:")
print("   Ask Elton John about:")
print("   - 'Tell me about your partnership with Bernie Taupin'")
print("   - 'What was your Farewell Yellow Brick Road tour like?'")
print("   - 'How did you overcome addiction?'")
print("   - 'What's your relationship with David Furnish?'")
print("   - 'Tell me about your work with the AIDS Foundation'")
print("=" * 80)



