import os
import logging
from pathlib import Path
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL missing. Check backend/.env")

# Convert Supabase Session mode (port 5432) to Transaction mode (port 6543)
# Transaction mode supports more concurrent connections for connection pooling
if "pooler.supabase.com:5432" in DATABASE_URL:
    old_port = ":5432"
    new_port = ":6543"
    DATABASE_URL = DATABASE_URL.replace(old_port, new_port)
    logger.info(f"[DB] ✓ Converted Supabase pooler from port 5432 (Session) to 6543 (Transaction mode)")
else:
    logger.info(f"[DB] Using DATABASE_URL as-is (port check: pooler={('pooler.supabase.com' in DATABASE_URL)}, port5432={(':5432' in DATABASE_URL)})")

# Optimized connection pooling for Supabase Transaction mode
# Tuned for better performance under concurrent load
engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,        # Verify connections before using (prevents stale connections)
    pool_size=20,               # Maintain 20 connections (increased for high performance)
    max_overflow=10,            # Allow 10 additional connections during peak load
    pool_recycle=3600,          # Recycle connections after 1 hour (prevents long-lived issues)
    pool_timeout=10,            # Wait max 10s for connection from pool
    connect_args={
        "connect_timeout": 10,  # PostgreSQL connection timeout
        "keepalives": 1,        # Enable TCP keepalives
        "keepalives_idle": 30,  # Seconds before sending keepalive
        "keepalives_interval": 10,  # Seconds between keepalives
        "keepalives_count": 5,  # Max keepalive attempts
    },
    # Enable connection pool logging in development
    echo_pool="debug" if os.getenv("DEBUG_SQL") == "true" else False,
)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
Base = declarative_base()


def warmup_connection_pool(num_connections: int = 5):
    """
    Pre-warm the database connection pool by establishing connections.
    This eliminates cold-start latency for the first user requests.
    
    Call this during server startup (in main.py startup event).
    """
    import time
    from sqlalchemy import text
    
    start = time.time()
    connections = []
    
    try:
        # Establish multiple connections in parallel to warm the pool
        for i in range(num_connections):
            conn = engine.connect()
            # Execute a simple query to fully establish the connection
            conn.execute(text("SELECT 1"))
            connections.append(conn)
        
        elapsed = (time.time() - start) * 1000
        logger.info(f"[DB] ✓ Warmed up {num_connections} connections in {elapsed:.0f}ms")
        
    finally:
        # Return connections to the pool
        for conn in connections:
            conn.close()

