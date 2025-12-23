#!/usr/bin/env python3
"""
Add knowledge documents to Coluche agent
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

COLUCHE_ID = "6b4fa184-0d54-46f3-98be-18347528fc0e"
USER_ID = "e4ababa2-fa35-421a-815d-c9e641929b67"  # Your user ID from logs

KNOWLEDGE_FILES = [
    {
        "path": "data/coluche/knowledge_coluche_biography.md",
        "title": "Coluche - Biographie complète",
        "layer": "public"
    },
    {
        "path": "data/coluche/knowledge_coluche_sketches.md",
        "title": "Coluche - Sketches célèbres",
        "layer": "public"
    }
]

print("=" * 80)
print("📚 ADDING KNOWLEDGE TO COLUCHE AGENT")
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
                INSERT INTO documents (owner_user_id, avee_id, layer, title, content, source)
                VALUES (:owner_user_id, :avee_id, :layer, :title, :content, :source)
                RETURNING id
            """),
            {
                "owner_user_id": USER_ID,
                "avee_id": COLUCHE_ID,
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
                      (document_id, avee_id, layer, chunk_index, content, embedding)
                    VALUES
                      (:document_id, :avee_id, :layer, :chunk_index, :content, (:embedding)::vector)
                """),
                {
                    "document_id": str(document_id),
                    "avee_id": COLUCHE_ID,
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
        text("SELECT COUNT(*) FROM documents WHERE avee_id = :id"),
        {"id": COLUCHE_ID}
    ).scalar()
    
    chunk_count = conn.execute(
        text("SELECT COUNT(*) FROM document_chunks WHERE avee_id = :id"),
        {"id": COLUCHE_ID}
    ).scalar()
    
    print(f"   Total documents: {doc_count}")
    print(f"   Total chunks: {chunk_count}")

print("\n🧪 TEST IT NOW:")
print("   Ask Coluche about:")
print("   - 'Parle-moi des Restos du Cœur'")
print("   - 'Raconte-moi ta candidature présidentielle'")
print("   - 'Quel était ton meilleur sketch?'")
print("=" * 80)

