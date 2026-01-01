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
    pool_size=10,               # Increased from 5 - allows more concurrent requests
    max_overflow=15,            # Increased from 10 - better handling of load spikes
    pool_recycle=180,           # Reduced from 300s - fresher connections, prevents timeouts
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


