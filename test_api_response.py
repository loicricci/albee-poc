#!/usr/bin/env python3
"""Test what the unified feed API actually returns"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

from db import SessionLocal
from models import Post, AgentUpdate, Avee, Profile, AgentFollower
from sqlalchemy import func
import uuid

db = SessionLocal()

# Get a test user (first user in DB)
test_user = db.query(Profile).first()
if not test_user:
    print("No users found!")
    sys.exit(1)

user_id = test_user.user_id
print(f"Testing with user: {test_user.handle} ({user_id})\n")

# Simulate the unified feed logic
followed_agent_ids = db.query(AgentFollower.avee_id).filter(
    AgentFollower.follower_user_id == user_id
).all()
followed_ids = [aid[0] for aid in followed_agent_ids]

own_agent_ids = db.query(Avee.id).filter(Avee.owner_user_id == user_id).all()
own_ids = [aid[0] for aid in own_agent_ids]

all_agent_ids = list(set(followed_ids + own_ids))

print(f"Agents in feed: {len(all_agent_ids)}\n")

# Get posts
agent_posts = db.query(Post, Avee, Profile).join(
    Avee, Post.agent_id == Avee.id
).join(
    Profile, Avee.owner_user_id == Profile.user_id
).filter(
    Post.agent_id.in_(all_agent_ids),
    Post.visibility == "public"
).all() if all_agent_ids else []

# Get updates  
updates = db.query(AgentUpdate, Avee, Profile).join(
    Avee, AgentUpdate.avee_id == Avee.id
).join(
    Profile, Avee.owner_user_id == Profile.user_id
).filter(
    AgentUpdate.avee_id.in_(all_agent_ids)
).all() if all_agent_ids else []

print(f"📸 Agent Posts: {len(agent_posts)}")
print(f"📝 Updates: {len(updates)}\n")

# Check the Cosmic Wonders post
cosmic_post = None
for post, agent, owner in agent_posts:
    if "Cosmic Wonders" in (post.title or ""):
        cosmic_post = (post, agent, owner)
        break

if cosmic_post:
    post, agent, owner = cosmic_post
    print("✅ Found 'Cosmic Wonders' post:")
    print(f"  ID: {post.id}")
    print(f"  Title: {post.title}")
    print(f"  Type (backend will send): 'post'")
    print(f"  Post Type: {post.post_type}")
    print(f"  Agent: {agent.handle}")
    print(f"  Has image_url: {bool(post.image_url)}")
    print(f"  Image URL: {post.image_url[:60] if post.image_url else 'None'}...")
else:
    print("❌ 'Cosmic Wonders' post NOT in agent_posts query!")
    print("\nChecking if it exists as an Update instead...")
    for update, agent, owner in updates:
        if "Cosmic Wonders" in (update.title or ""):
            print(f"  ⚠️  FOUND AS UPDATE! This is the bug!")
            print(f"  Update ID: {update.id}")
            print(f"  Title: {update.title}")

db.close()
