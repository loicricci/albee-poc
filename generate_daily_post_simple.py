#!/usr/bin/env python3
import os, sys
sys.path.insert(0, 'backend')
from dotenv import load_dotenv
load_dotenv('backend/.env', override=True)

from backend.news_topic_fetcher import get_safe_daily_topic
from backend.profile_context_loader import load_agent_context
from backend.ai_prompt_generator import generate_image_prompt, generate_description, generate_title
from backend.image_generator import generate_post_image
from backend.post_creation_service import create_post

# Quick test
if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument('--profile', required=True)
    parser.add_argument('--topic', required=False)
    args = parser.parse_args()
    
    topic = {"topic": args.topic or "Technology", "description": args.topic or "Technology", "category": "general", "source": "manual"}
    print(f"Loading context...")
    context = load_agent_context(args.profile)
    print(f"Generating prompts...")
    image_prompt = generate_image_prompt(context, topic)
    title = generate_title(topic, context)
    print(f"Generating description...")
    description = generate_description(context, topic, image_prompt)
    print(f"Generating image...")
    img_path = generate_post_image(image_prompt, args.profile)
    print(f"Creating post...")
    result = create_post(args.profile, img_path, title, description, topic, image_prompt)
    print(f"✅ Done! Post: {result['post_id']}")
