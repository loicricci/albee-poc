#!/bin/bash
# Quick test of the comment and share endpoints

# Get a post ID from the database
cd /Users/loicricci/gabee-poc

echo "Testing backend endpoints..."
echo ""

# Test 1: Health check
echo "1. Health check:"
curl -s http://localhost:8000/health
echo -e "\n"

# Test 2: Get a post ID
echo "2. Checking for posts in database..."
./venv/bin/python -c "
import sys
sys.path.insert(0, 'backend')
from db import SessionLocal
from models import Post
db = SessionLocal()
post = db.query(Post).first()
if post:
    print(f'Found post: {post.id}')
    print(f'Owner: {post.owner_user_id}')
else:
    print('No posts found!')
db.close()
"
echo ""

echo "To test manually, use:"
echo "1. Get your auth token from browser localStorage (Application > Local Storage > supabase.auth.token)"
echo "2. Test comment endpoint:"
echo "   curl -X POST 'http://localhost:8000/posts/POST_ID/comments' \\"
echo "     -H 'Authorization: Bearer YOUR_TOKEN' \\"
echo "     -H 'Content-Type: application/json' \\"
echo "     -d '{\"content\":\"Test comment\"}'"
echo ""
echo "3. Test share endpoint:"
echo "   curl -X POST 'http://localhost:8000/posts/POST_ID/share?share_type=repost&comment=Test' \\"
echo "     -H 'Authorization: Bearer YOUR_TOKEN'"

