"""
Quick Setup Script for Twitter Integration
Runs migration and tests the setup.
"""

import os
import sys
import subprocess


def run_command(cmd, cwd=None):
    """Run a shell command and return success status."""
    print(f"Running: {cmd}")
    try:
        result = subprocess.run(
            cmd,
            shell=True,
            cwd=cwd,
            capture_output=True,
            text=True
        )
        if result.returncode == 0:
            print("✅ Success")
            if result.stdout:
                print(result.stdout)
            return True
        else:
            print("❌ Failed")
            if result.stderr:
                print(result.stderr)
            return False
    except Exception as e:
        print(f"❌ Error: {e}")
        return False


def main():
    print("=" * 60)
    print("Twitter Integration Setup")
    print("=" * 60)
    print()
    
    # Check if .env exists
    env_file = "backend/.env"
    if not os.path.exists(env_file):
        print(f"⚠️  {env_file} not found")
        print("Creating from template...")
        
        with open(env_file, "w") as f:
            f.write("# Twitter API Configuration\n")
            f.write("TWITTER_BEARER_TOKEN=your_twitter_bearer_token_here\n")
            f.write("\n")
            f.write("# Add your other environment variables below\n")
        
        print(f"✅ Created {env_file}")
        print()
        print("⚠️  IMPORTANT: Edit backend/.env and add your TWITTER_BEARER_TOKEN")
        print("Get it from: https://developer.twitter.com/en/portal/dashboard")
        print()
        return
    
    print("✅ Found backend/.env")
    print()
    
    # Step 1: Install dependencies
    print("-" * 60)
    print("Step 1: Installing dependencies")
    print("-" * 60)
    
    if not run_command("pip install tweepy>=4.14.0"):
        print("Failed to install tweepy")
        return
    
    print()
    
    # Step 2: Run migration
    print("-" * 60)
    print("Step 2: Running database migration")
    print("-" * 60)
    
    if not run_command(
        "python run_specific_migration.py 014_twitter_integration.sql",
        cwd="backend"
    ):
        print("Migration failed - database may not be configured")
        print("Make sure your database is running and .env has correct credentials")
        print()
    
    print()
    
    # Step 3: Test Twitter API
    print("-" * 60)
    print("Step 3: Testing Twitter API connection")
    print("-" * 60)
    
    if not run_command("python backend/test_twitter_integration.py"):
        print()
        print("⚠️  Twitter API test failed")
        print("Make sure TWITTER_BEARER_TOKEN is set correctly in backend/.env")
        print()
        return
    
    print()
    
    # Success!
    print("=" * 60)
    print("✅ Twitter Integration Setup Complete!")
    print("=" * 60)
    print()
    print("Next steps:")
    print("1. Start your backend server")
    print("2. Check status: GET /twitter/status")
    print("3. Configure an agent: POST /agents/{agent_id}/twitter/config")
    print("4. Read the full guide: TWITTER_INTEGRATION_GUIDE.md")
    print()


if __name__ == "__main__":
    main()










