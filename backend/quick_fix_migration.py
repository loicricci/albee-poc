"""
Quick fix migration script to add missing database columns and tables.
"""
import os
import sys
from dotenv import load_dotenv
import psycopg2

# Load environment
load_dotenv("/Users/loicricci/gabee-poc/backend/.env")

DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    print("❌ DATABASE_URL not found")
    sys.exit(1)

print("🔧 Applying database fixes...")

# Connect to database
conn = psycopg2.connect(DATABASE_URL)
conn.autocommit = True
cursor = conn.cursor()

# SQL statements
statements = [
    # 1. Add persona_notes column
    """
    ALTER TABLE avees ADD COLUMN IF NOT EXISTS persona_notes TEXT;
    """,
    
    # 2. Create conversation_summaries table
    """
    CREATE TABLE IF NOT EXISTS conversation_summaries (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
        summary TEXT NOT NULL,
        messages_included INTEGER NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
    );
    """,
    
    # 3. Create avee_memories table
    """
    CREATE TABLE IF NOT EXISTS avee_memories (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        avee_id UUID NOT NULL REFERENCES avees(id) ON DELETE CASCADE,
        memory_type VARCHAR(50) NOT NULL,
        content TEXT NOT NULL,
        confidence_score INTEGER,
        source_message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
        embedding vector(1536),
        created_at TIMESTAMPTZ DEFAULT NOW()
    );
    """,
    
    # 4. Create conversation_quality table
    """
    CREATE TABLE IF NOT EXISTS conversation_quality (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
        message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
        relevance_score INTEGER,
        engagement_score INTEGER,
        factual_grounding INTEGER,
        issues TEXT,
        suggestions TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
    );
    """
]

for i, stmt in enumerate(statements, 1):
    try:
        print(f"  Executing statement {i}/{len(statements)}...")
        cursor.execute(stmt)
        print(f"  ✅ Statement {i} completed")
    except Exception as e:
        print(f"  ⚠️  Statement {i} warning: {e}")

cursor.close()
conn.close()

print("\n✅ Migration complete!")
print("\nNew columns/tables:")
print("  - avees.persona_notes")
print("  - conversation_summaries")
print("  - avee_memories")
print("  - conversation_quality")













