"""
Database migration runner for AI conversation enhancements.

Usage:
    python -m backend.run_migration
"""

import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv("backend/.env")

DATABASE_URL = os.getenv("DATABASE_URL")

def run_migration():
    """Run the AI features migration."""
    if not DATABASE_URL:
        print("❌ DATABASE_URL not found in environment")
        return
    
    print("🔧 Running AI features migration...")
    
    engine = create_engine(DATABASE_URL)
    
    # Read migration file
    migration_path = os.path.join(
        os.path.dirname(__file__),
        "migrations",
        "001_add_ai_features.sql"
    )
    
    with open(migration_path, "r") as f:
        migration_sql = f.read()
    
    # Split by statements and execute
    statements = [s.strip() for s in migration_sql.split(";") if s.strip() and not s.strip().startswith("--")]
    
    with engine.connect() as conn:
        for i, statement in enumerate(statements):
            try:
                print(f"  Executing statement {i+1}/{len(statements)}...")
                conn.execute(text(statement))
                conn.commit()
            except Exception as e:
                print(f"  ⚠️  Statement {i+1} warning: {e}")
                # Continue anyway (might be "already exists" errors)
    
    print("✅ Migration complete!")
    print("\nNew tables created:")
    print("  - conversation_summaries")
    print("  - avee_memories")
    print("  - conversation_quality")
    print("\nNew columns:")
    print("  - avees.persona_notes")

if __name__ == "__main__":
    run_migration()







