"""
Database Connection Pool Monitor

Tracks connection pool health and query performance.
"""
import time
from sqlalchemy import event, text
from db import engine


class ConnectionMonitor:
    def __init__(self):
        self.queries = []
        self.connections_created = 0
        self.connections_checked_out = 0
        
    def log_query(self, statement, duration):
        self.queries.append({
            "statement": str(statement)[:100],
            "duration": duration,
            "timestamp": time.time()
        })
    
    def get_stats(self):
        pool = engine.pool
        return {
            "size": pool.size(),
            "checked_out": pool.checkedout(),
            "overflow": pool.overflow(),
            "checked_in": pool.checkedin(),
            "timeout": pool.timeout(),
            "slow_queries": [q for q in self.queries if q["duration"] > 1.0]
        }
    
    def print_stats(self):
        stats = self.get_stats()
        print("\n=== Connection Pool Stats ===")
        print(f"Pool size: {stats['size']}")
        print(f"Checked out: {stats['checked_out']}")
        print(f"Overflow: {stats['overflow']}")
        print(f"Checked in: {stats['checked_in']}")
        print(f"Slow queries (>1s): {len(stats['slow_queries'])}")
        
        if stats['slow_queries']:
            print("\nSlow queries:")
            for q in stats['slow_queries'][:5]:  # Show top 5
                print(f"  - {q['duration']:.2f}s: {q['statement']}")


monitor = ConnectionMonitor()


# Testing
if __name__ == "__main__":
    from dotenv import load_dotenv
    import sys
    
    # Add backend to path
    sys.path.insert(0, '.')
    
    # Load environment
    load_dotenv(".env", override=True)
    
    print("=" * 80)
    print("Database Connection Pool Monitor")
    print("=" * 80)
    
    # Print initial stats
    monitor.print_stats()
    
    # Test a simple query
    from db import SessionLocal
    print("\nTesting database connection...")
    
    session = SessionLocal()
    try:
        result = session.execute(text("SELECT 1"))
        print("✅ Database connection successful")
    finally:
        session.close()
    
    # Print stats after query
    monitor.print_stats()
    
    print("\n" + "=" * 80)
    print("Monitor ready for use. Import with: from db_monitor import monitor")
    print("=" * 80)

