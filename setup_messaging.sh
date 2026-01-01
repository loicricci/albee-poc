#!/bin/bash
# Quick setup script for messaging system

echo "🚀 Setting up messaging system..."
echo ""
echo "📋 This script will guide you through the database migration."
echo ""
echo "Choose your method:"
echo "1) Copy SQL to clipboard (for Supabase Dashboard)"
echo "2) Run migration via psql (requires database credentials)"
echo ""
read -p "Enter choice (1 or 2): " choice

if [ "$choice" = "1" ]; then
    # Copy to clipboard
    if command -v pbcopy &> /dev/null; then
        cat database_migrations/messaging_system.sql | pbcopy
        echo "✅ SQL copied to clipboard!"
        echo ""
        echo "Now:"
        echo "1. Go to your Supabase project dashboard"
        echo "2. Click 'SQL Editor' in the sidebar"
        echo "3. Paste (Cmd+V) and click 'Run'"
    else
        echo "📄 Please manually copy the contents of:"
        echo "   database_migrations/messaging_system.sql"
        echo ""
        echo "Then:"
        echo "1. Go to your Supabase project dashboard"
        echo "2. Click 'SQL Editor' in the sidebar"
        echo "3. Paste and click 'Run'"
    fi
elif [ "$choice" = "2" ]; then
    echo ""
    read -p "Enter database host: " DB_HOST
    read -p "Enter database name: " DB_NAME
    read -p "Enter database user: " DB_USER
    read -sp "Enter database password: " DB_PASS
    echo ""
    echo ""
    echo "Running migration..."
    PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -f database_migrations/messaging_system.sql
    
    if [ $? -eq 0 ]; then
        echo "✅ Migration completed successfully!"
    else
        echo "❌ Migration failed. Please check your credentials and try again."
    fi
else
    echo "Invalid choice"
    exit 1
fi

echo ""
echo "🎉 Setup complete! Your messaging system is ready to use."
echo ""
echo "📚 Documentation:"
echo "   - Quick Start: MESSAGING_QUICK_START.md"
echo "   - Full Guide: MESSAGING_SYSTEM_GUIDE.md"
echo ""
echo "🔗 Try it out:"
echo "   - Go to http://localhost:3000/messages"
echo "   - Click the Messages icon in the navigation"





