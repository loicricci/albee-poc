#!/usr/bin/env python3
"""
Test Daily Post Generator

Comprehensive testing script to validate all components.
Can run in different modes: quick test, full test, or component tests.
"""

import os
import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, 'backend')

from dotenv import load_dotenv

# Load environment
load_dotenv('backend/.env', override=True)


def test_environment():
    """Test that all required environment variables are set"""
    print("\n" + "=" * 80)
    print("🔧 Testing Environment Configuration")
    print("=" * 80)
    
    required_vars = [
        "OPENAI_API_KEY",
        "DATABASE_URL",
        "SUPABASE_URL",
        "SUPABASE_SERVICE_ROLE_KEY"
    ]
    
    optional_vars = [
        "NEWS_API_KEY"
    ]
    
    all_good = True
    
    for var in required_vars:
        if os.getenv(var):
            print(f"✅ {var}: Set")
        else:
            print(f"❌ {var}: NOT SET (REQUIRED)")
            all_good = False
    
    for var in optional_vars:
        if os.getenv(var):
            print(f"✅ {var}: Set")
        else:
            print(f"⚠️  {var}: Not set (will use fallback)")
    
    return all_good


def test_news_fetcher():
    """Test news topic fetcher"""
    print("\n" + "=" * 80)
    print("📰 Testing News Topic Fetcher")
    print("=" * 80)
    
    try:
        from backend.news_topic_fetcher import get_safe_daily_topic
        
        topic = get_safe_daily_topic()
        
        print(f"✅ Topic fetched successfully")
        print(f"   Topic: {topic['topic']}")
        print(f"   Category: {topic['category']}")
        print(f"   Source: {topic['source']}")
        
        # Validate structure
        assert 'topic' in topic
        assert 'description' in topic
        assert 'category' in topic
        
        return True
        
    except Exception as e:
        print(f"❌ Error: {e}")
        return False


def test_profile_loader(agent_handle="eltonjohn"):
    """Test profile context loader"""
    print("\n" + "=" * 80)
    print(f"👤 Testing Profile Context Loader (@{agent_handle})")
    print("=" * 80)
    
    try:
        from backend.profile_context_loader import load_agent_context
        
        context = load_agent_context(agent_handle)
        
        print(f"✅ Profile loaded successfully")
        print(f"   Display Name: {context['display_name']}")
        print(f"   Style Traits: {', '.join(context['style_traits'][:3])}")
        print(f"   Themes: {', '.join(context['themes'][:3])}")
        print(f"   Documents: {context['document_count']}")
        
        # Validate structure
        assert 'handle' in context
        assert 'persona' in context
        assert 'style_traits' in context
        assert len(context['style_traits']) > 0
        
        return True
        
    except Exception as e:
        print(f"❌ Error: {e}")
        return False


def test_prompt_generator(agent_handle="eltonjohn"):
    """Test AI prompt generator"""
    print("\n" + "=" * 80)
    print("🎨 Testing AI Prompt Generator")
    print("=" * 80)
    
    try:
        from backend.profile_context_loader import load_agent_context
        from backend.news_topic_fetcher import get_safe_daily_topic
        from backend.ai_prompt_generator import (
            generate_image_prompt,
            generate_title,
            generate_description
        )
        
        # Load test data
        print("Loading agent context...")
        context = load_agent_context(agent_handle)
        
        print("Fetching topic...")
        topic = get_safe_daily_topic()
        
        # Generate prompts
        print("\nGenerating image prompt...")
        image_prompt = generate_image_prompt(context, topic)
        
        print("Generating title...")
        title = generate_title(topic, context)
        
        print("Generating description...")
        description = generate_description(context, topic, image_prompt)
        
        print(f"\n✅ All prompts generated successfully")
        print(f"   Title length: {len(title)} chars")
        print(f"   Image prompt length: {len(image_prompt)} chars")
        print(f"   Description length: {len(description)} chars")
        
        # Validate
        assert len(image_prompt) > 100
        assert len(title) > 0
        assert len(description) > 100
        
        return True
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_image_generator_dry_run():
    """Test image generator without actually generating (to save API calls)"""
    print("\n" + "=" * 80)
    print("🖼️  Testing Image Generator (Dry Run)")
    print("=" * 80)
    
    try:
        from backend.image_generator import ImageGenerator
        
        # Just test initialization
        generator = ImageGenerator()
        print(f"✅ ImageGenerator initialized")
        print(f"   Output directory: {generator.output_dir}")
        print(f"   Directory exists: {Path(generator.output_dir).exists()}")
        
        return True
        
    except Exception as e:
        print(f"❌ Error: {e}")
        return False


def test_post_service_dry_run(agent_handle="eltonjohn"):
    """Test post creation service without creating (to save uploads)"""
    print("\n" + "=" * 80)
    print(f"📝 Testing Post Creation Service (Dry Run - @{agent_handle})")
    print("=" * 80)
    
    try:
        from backend.post_creation_service import PostCreationService
        
        # Test initialization and user lookup
        with PostCreationService() as service:
            user_id = service._get_user_id(agent_handle)
            print(f"✅ PostCreationService initialized")
            print(f"   Found user_id: {user_id}")
        
        return True
        
    except Exception as e:
        print(f"❌ Error: {e}")
        return False


def run_quick_test(agent_handle="eltonjohn"):
    """Run quick tests without API calls"""
    print("\n" + "🚀" * 40)
    print("RUNNING QUICK TESTS (No API calls to save costs)")
    print("🚀" * 40)
    
    results = []
    
    results.append(("Environment", test_environment()))
    results.append(("News Fetcher", test_news_fetcher()))
    results.append(("Profile Loader", test_profile_loader(agent_handle)))
    results.append(("Image Generator (init)", test_image_generator_dry_run()))
    results.append(("Post Service (init)", test_post_service_dry_run(agent_handle)))
    
    # Summary
    print("\n" + "=" * 80)
    print("📊 TEST SUMMARY")
    print("=" * 80)
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for test_name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status} - {test_name}")
    
    print(f"\nResult: {passed}/{total} tests passed")
    
    if passed == total:
        print("\n🎉 All quick tests passed!")
        print("\nTo run full end-to-end test (with API calls):")
        print(f"  python generate_daily_post.py --profile {agent_handle} --topic 'Test topic'")
    else:
        print("\n⚠️  Some tests failed. Fix issues before running full test.")
    
    print("=" * 80)
    
    return passed == total


def run_full_test(agent_handle="eltonjohn"):
    """Run full end-to-end test (WARNING: Uses API credits)"""
    print("\n" + "🚀" * 40)
    print("RUNNING FULL END-TO-END TEST")
    print("⚠️  WARNING: This will use OpenAI API credits!")
    print("🚀" * 40)
    
    # Ask for confirmation
    response = input("\nContinue? (yes/no): ").strip().lower()
    if response not in ['yes', 'y']:
        print("Test cancelled.")
        return False
    
    # Run the actual generator
    print("\n" + "=" * 80)
    print("Running generate_daily_post.py...")
    print("=" * 80)
    
    import subprocess
    
    result = subprocess.run([
        sys.executable,
        'generate_daily_post.py',
        '--profile', agent_handle,
        '--topic', 'Test topic: Advances in quantum computing research'
    ])
    
    success = result.returncode == 0
    
    if success:
        print("\n🎉 Full test completed successfully!")
    else:
        print("\n❌ Full test failed.")
    
    return success


def main():
    """Main test runner"""
    import argparse
    
    parser = argparse.ArgumentParser(description="Test Daily Post Generator")
    parser.add_argument(
        '--mode',
        choices=['quick', 'full', 'component'],
        default='quick',
        help='Test mode: quick (no API), full (with API), component (specific)'
    )
    parser.add_argument(
        '--profile',
        default='eltonjohn',
        help='Agent handle to test with'
    )
    parser.add_argument(
        '--component',
        choices=['env', 'news', 'profile', 'prompts', 'image', 'post'],
        help='Specific component to test (requires --mode component)'
    )
    
    args = parser.parse_args()
    
    if args.mode == 'quick':
        success = run_quick_test(args.profile)
        sys.exit(0 if success else 1)
    
    elif args.mode == 'full':
        success = run_full_test(args.profile)
        sys.exit(0 if success else 1)
    
    elif args.mode == 'component':
        if not args.component:
            print("❌ --component required for component mode")
            sys.exit(1)
        
        tests = {
            'env': test_environment,
            'news': test_news_fetcher,
            'profile': lambda: test_profile_loader(args.profile),
            'prompts': lambda: test_prompt_generator(args.profile),
            'image': test_image_generator_dry_run,
            'post': lambda: test_post_service_dry_run(args.profile)
        }
        
        success = tests[args.component]()
        sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()


