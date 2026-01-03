#!/usr/bin/env python3
"""
Debug script to check if loic is actually following Elton John
and what the agent IDs are.
"""

import sys
sys.path.append('/Users/loicricci/gabee-poc/backend')

from db import SessionLocal
from models import Profile, Avee, AgentFollower
import uuid

def debug_following_status():
    db = SessionLocal()
    
    try:
        # Find loic's profile
        loic_profile = db.query(Profile).filter(Profile.handle == 'loic').first()
        if not loic_profile:
            print("❌ Could not find loic's profile")
            return
        
        print(f"✅ Found loic's profile")
        print(f"   User ID: {loic_profile.user_id}")
        print(f"   Display Name: {loic_profile.display_name}")
        print()
        
        # Find Elton John agent
        elton_agent = db.query(Avee).filter(Avee.handle.ilike('%elton%')).first()
        if not elton_agent:
            print("❌ Could not find Elton John agent")
            return
        
        print(f"✅ Found Elton John agent")
        print(f"   Agent ID: {elton_agent.id}")
        print(f"   Handle: {elton_agent.handle}")
        print(f"   Display Name: {elton_agent.display_name}")
        print(f"   Owner User ID: {elton_agent.owner_user_id}")
        print()
        
        # Check if loic is following Elton John
        following_record = db.query(AgentFollower).filter(
            AgentFollower.follower_user_id == loic_profile.user_id,
            AgentFollower.avee_id == elton_agent.id
        ).first()
        
        if following_record:
            print(f"✅ loic IS following Elton John")
            print(f"   Following Record ID: {following_record.id}")
            print(f"   Created At: {following_record.created_at}")
        else:
            print(f"❌ loic is NOT following Elton John in the database")
        print()
        
        # List all agents loic is following
        all_following = db.query(AgentFollower).filter(
            AgentFollower.follower_user_id == loic_profile.user_id
        ).all()
        
        print(f"📊 loic is following {len(all_following)} agents total:")
        for f in all_following[:10]:
            agent = db.query(Avee).filter(Avee.id == f.avee_id).first()
            if agent:
                print(f"   - {agent.display_name} (@{agent.handle}) [ID: {agent.id}]")
        if len(all_following) > 10:
            print(f"   ... and {len(all_following) - 10} more")
        
    finally:
        db.close()

if __name__ == "__main__":
    debug_following_status()

