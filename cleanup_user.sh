#!/bin/bash
# Manual cleanup script for loic@wemine.fi account
# This will help you delete the user from both Supabase Auth and the database

set -e

echo ""
echo "🔧 User Cleanup Script for: loic@wemine.fi"
echo "=========================================="
echo ""

# Load environment variables
if [ -f backend/.env ]; then
    export $(cat backend/.env | grep -v '^#' | xargs)
else
    echo "❌ Error: backend/.env not found"
    exit 1
fi

if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
    echo "❌ Error: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set"
    exit 1
fi

EMAIL="loic@wemine.fi"

echo "1️⃣  Searching for user in Supabase Auth..."
echo ""

# Get all users and filter by email
USERS_RESPONSE=$(curl -s "${SUPABASE_URL}/auth/v1/admin/users" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}")

# Try to find the user (basic grep since we don't have jq)
USER_ID=$(echo "$USERS_RESPONSE" | grep -o '"id":"[^"]*"' | grep -A5 -B5 "$EMAIL" | head -1 | cut -d'"' -f4)

if [ -z "$USER_ID" ]; then
    echo "❌ User not found in Supabase Auth"
    echo ""
    echo "Checking all users for debugging..."
    echo "$USERS_RESPONSE" | python3 -m json.tool || echo "$USERS_RESPONSE"
    echo ""
    echo "⚠️  The user might already be deleted from Supabase Auth."
    echo "   They should be able to sign up again."
else
    echo "✅ Found user in Supabase Auth"
    echo "   User ID: $USER_ID"
    echo ""
    echo "2️⃣  Checking database..."
    echo ""
    
    # Check database (requires psql)
    if command -v psql &> /dev/null; then
        psql "$DATABASE_URL" -c "SELECT user_id, handle, display_name FROM profiles WHERE user_id = '$USER_ID';" || echo "⚠️  Database query failed"
    else
        echo "⚠️  psql not installed, skipping database check"
    fi
    
    echo ""
    echo "=========================================="
    echo "⚠️  WARNING: About to delete user $USER_ID"
    echo "   Email: $EMAIL"
    echo ""
    read -p "Type 'DELETE' to confirm deletion: " CONFIRM
    
    if [ "$CONFIRM" != "DELETE" ]; then
        echo ""
        echo "❌ Deletion cancelled."
        exit 0
    fi
    
    echo ""
    echo "3️⃣  Deleting from database..."
    
    if command -v psql &> /dev/null; then
        psql "$DATABASE_URL" -c "DELETE FROM profiles WHERE user_id = '$USER_ID';"
        echo "✅ Deleted from database"
    else
        echo "⚠️  psql not installed, please delete manually:"
        echo "   DELETE FROM profiles WHERE user_id = '$USER_ID';"
    fi
    
    echo ""
    echo "4️⃣  Deleting from Supabase Auth..."
    
    DELETE_RESPONSE=$(curl -s -X DELETE "${SUPABASE_URL}/auth/v1/admin/users/${USER_ID}" \
      -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
      -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
      -w "\nHTTP_STATUS:%{http_code}")
    
    HTTP_STATUS=$(echo "$DELETE_RESPONSE" | grep "HTTP_STATUS" | cut -d: -f2)
    
    if [ "$HTTP_STATUS" = "200" ] || [ "$HTTP_STATUS" = "204" ]; then
        echo "✅ Deleted from Supabase Auth"
        echo ""
        echo "✅ Cleanup complete! User can now sign up with this email again."
    else
        echo "❌ Failed to delete from Supabase Auth"
        echo "Response: $DELETE_RESPONSE"
    fi
fi

echo ""






