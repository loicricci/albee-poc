#!/usr/bin/env python3
"""
Test GPT-Image-1 without reference images

This script tests the new capability to generate images with GPT-Image-1
without requiring reference images.
"""

import os
import sys
import asyncio
from datetime import datetime

# Add backend to path
sys.path.insert(0, 'backend')

from dotenv import load_dotenv

# Load environment variables
load_dotenv('backend/.env', override=True)

from generate_daily_post import DailyPostGenerator


async def test_gpt_image_without_reference():
    """Test GPT-Image-1 pure text-to-image generation"""
    
    print("=" * 80)
    print("🧪 TESTING GPT-IMAGE-1 WITHOUT REFERENCE IMAGES")
    print("=" * 80)
    print(f"Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print()
    
    # Test with a simple agent and topic
    test_agent = "eltonjohn"  # Change to any agent handle you want to test
    test_topic = "The future of renewable energy"
    
    print(f"Test Configuration:")
    print(f"  Agent: @{test_agent}")
    print(f"  Topic: {test_topic}")
    print(f"  Image Engine: gpt-image-1")
    print(f"  Reference Image: None (pure text-to-image generation)")
    print()
    print("-" * 80)
    print()
    
    try:
        generator = DailyPostGenerator(verbose=True, enable_timing=True)
        
        print("🚀 Starting post generation...")
        print()
        
        result = await generator.generate_post_async(
            agent_handle=test_agent,
            topic_override=test_topic,
            category=None,
            image_engine="gpt-image-1",  # Use GPT-Image-1
            reference_image_url_override=None  # No reference image (pure generation)
        )
        
        print()
        print("=" * 80)
        print("✅ TEST PASSED!")
        print("=" * 80)
        print()
        print("Results:")
        print(f"  Success: {result['success']}")
        print(f"  Post ID: {result.get('post_id')}")
        print(f"  Image URL: {result.get('image_url')}")
        print(f"  Duration: {result.get('duration_seconds', 0):.1f} seconds")
        print(f"  Image Engine Used: {result.get('image_engine')}")
        print()
        print(f"🔗 View Post: {result.get('view_url')}")
        print()
        print("=" * 80)
        
        return True
        
    except Exception as e:
        print()
        print("=" * 80)
        print("❌ TEST FAILED!")
        print("=" * 80)
        print(f"Error: {str(e)}")
        print()
        
        import traceback
        traceback.print_exc()
        
        return False


def main():
    """Main entry point"""
    success = asyncio.run(test_gpt_image_without_reference())
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()



