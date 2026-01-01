#!/usr/bin/env python3
"""
Run Auto Post Generation Migration

Applies migration 019_auto_post_generation.sql
"""

import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

# Load environment
load_dotenv('backend/.env', override=True)

def run_migration():
    """Run the auto post generation migration"""
    print("=" * 80)
    print("Running Auto Post Generation Migration")
    print("=" * 80)
    
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        print("❌ DATABASE_URL not set")
        return False
    
    engine = create_engine(database_url)
    
    # Read migration file
    migration_file = "backend/migrations/019_auto_post_generation.sql"
    
    print(f"\n📄 Reading migration file: {migration_file}")
    
    with open(migration_file, 'r') as f:
        migration_sql = f.read()
    
    print(f"✅ Migration file loaded ({len(migration_sql)} characters)")
    
    # Execute migration
    print("\n🔧 Executing migration...")
    
    try:
        with engine.connect() as conn:
            # Execute the migration
            conn.execute(text(migration_sql))
            conn.commit()
            
            print("✅ Migration executed successfully!")
            
            # Verify columns were added
            print("\n🔍 Verifying migration...")
            
            result = conn.execute(text("""
                SELECT column_name, data_type, column_default
                FROM information_schema.columns
                WHERE table_name = 'avees'
                AND column_name IN ('auto_post_enabled', 'last_auto_post_at', 'auto_post_settings')
                ORDER BY column_name
            """))
            
            columns = result.fetchall()
            
            if len(columns) == 3:
                print("✅ All columns created:")
                for col in columns:
                    print(f"   - {col[0]} ({col[1]})")
            else:
                print(f"⚠️  Expected 3 columns, found {len(columns)}")
            
            # Check indexes
            result = conn.execute(text("""
                SELECT indexname
                FROM pg_indexes
                WHERE tablename = 'avees'
                AND indexname LIKE 'idx_avees_auto%'
            """))
            
            indexes = result.fetchall()
            print(f"\n✅ {len(indexes)} indexes created:")
            for idx in indexes:
                print(f"   - {idx[0]}")
            
        print("\n" + "=" * 80)
        print("✨ Migration Complete!")
        print("=" * 80)
        return True
        
    except Exception as e:
        print(f"\n❌ Error executing migration: {e}")
        import traceback
        traceback.print_exc()
        return False


if __name__ == "__main__":
    import sys
    success = run_migration()
    sys.exit(0 if success else 1)



