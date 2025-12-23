#!/usr/bin/env python3
import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv("backend/.env")
engine = create_engine(os.getenv("DATABASE_URL"))

with engine.connect() as conn:
    result = conn.execute(
        text("SELECT persona FROM avees WHERE id = :id"),
        {"id": "6b4fa184-0d54-46f3-98be-18347528fc0e"}
    ).scalar()
    
    print("=" * 80)
    print("FULL CURRENT PERSONA")
    print("=" * 80)
    print(result)
    print("=" * 80)


