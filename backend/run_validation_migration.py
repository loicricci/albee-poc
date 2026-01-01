"""
Run the add_message_validation migration
"""
import os
import sys
from sqlalchemy import text
from db import SessionLocal

def run_migration():
    db = SessionLocal()
    try:
        print("Running add_message_validation migration...")
        
        # Check if column already exists
        check_sql = """
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name='direct_messages' AND column_name='human_validated'
        """
        result = db.execute(text(check_sql)).fetchone()
        
        if result:
            print("✓ Column human_validated already exists")
        else:
            # Add the column
            alter_sql = """
            ALTER TABLE direct_messages 
            ADD COLUMN human_validated VARCHAR DEFAULT 'false'
            """
            print("Adding human_validated column...")
            db.execute(text(alter_sql))
            db.commit()
            print("✓ Column added successfully")
            
            # Add check constraint
            constraint_sql = """
            ALTER TABLE direct_messages 
            ADD CONSTRAINT check_human_validated 
            CHECK (human_validated IN ('true', 'false'))
            """
            print("Adding check constraint...")
            try:
                db.execute(text(constraint_sql))
                db.commit()
                print("✓ Constraint added")
            except Exception as e:
                print(f"Note: Constraint may already exist: {e}")
        
        # Add index
        index_sql = """
        CREATE INDEX IF NOT EXISTS idx_direct_messages_validated 
        ON direct_messages(human_validated)
        """
        print("Adding index...")
        db.execute(text(index_sql))
        db.commit()
        print("✓ Index added")
        
        print("\n✅ Migration completed successfully!")
        
    except Exception as e:
        print(f"❌ Migration failed: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
        sys.exit(1)
    finally:
        db.close()

if __name__ == "__main__":
    run_migration()

