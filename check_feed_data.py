#!/usr/bin/env python3
"""Check what the unified feed is actually returning"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

from db import SessionLocal
from models import Post, AgentUpdate
import json

db = SessionLocal()

# Get the specific post from screenshot
posts = db.query(Post).filter(Post.title.like('%Cosmic Wonders%')).all()

print("🔍 Posts matching 'Cosmic Wonders':\n")
for post in posts:
    print(f"ID: {post.id}")
    print(f"Title: {post.title}")
    print(f"Post Type: {post.post_type}")
    print(f"Image URL: {post.image_url[:50] if post.image_url else 'None'}...")
    print(f"Created: {post.created_at}")
    print(f"Agent ID: {post.agent_id}")
    print()

db.close()
