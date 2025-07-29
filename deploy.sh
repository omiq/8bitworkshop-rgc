#!/bin/bash

# 8bitworkshop Deploy Script
# Uploads built files to server using rsync

set -e  # Exit on any error

# Configuration
SERVER_HOST="ide@server"
SERVER_PATH="/home/ide/htdocs/ide.retrogamecoders.com"

# Check for dry-run flag
DRY_RUN=false
if [ "$1" = "--dry-run" ] || [ "$1" = "-n" ]; then
    DRY_RUN=true
    echo "🔍 DRY RUN MODE - No files will be uploaded"
fi

echo "🚀 8bitworkshop Deploy Script"
echo "=================================="

# Check if we're in the right directory
if [ ! -f "package.json" ] || [ ! -f "Makefile" ]; then
    echo "❌ Error: Must run deploy.sh from the 8bitworkshop root directory"
    exit 1
fi

# Check server directory exists and is accessible
echo "🔍 Checking server directory..."
ssh "$SERVER_HOST" "mkdir -p $SERVER_PATH" || {
    echo "❌ Error: Cannot access or create server directory"
    exit 1
}

echo "🔄 Starting rsync upload..."
echo "Server: $SERVER_HOST:$SERVER_PATH"
echo ""

# Add dry-run flag if requested
DRY_RUN_FLAG=""
if [ "$DRY_RUN" = true ]; then
    DRY_RUN_FLAG="--dry-run"
fi

# Simple rsync - upload everything except obvious non-production files
rsync -avz --progress --no-times --delete $DRY_RUN_FLAG \
    --exclude='node_modules' \
    --exclude='.git' \
    --exclude='*.log' \
    --exclude='.DS_Store' \
    --exclude='Thumbs.db' \
    . \
    "$SERVER_HOST:$SERVER_PATH/"

RSYNC_EXIT_CODE=$?

if [ $RSYNC_EXIT_CODE -eq 0 ]; then
    echo ""
    echo "✅ Deploy successful!"
    echo "🌐 Your site should be available at: https://ide.retrogamecoders.com"
elif [ $RSYNC_EXIT_CODE -eq 23 ]; then
    echo ""
    echo "✅ Deploy successful! (with permission warnings)"
    echo "🌐 Your site should be available at: https://ide.retrogamecoders.com"
    echo "💡 Permission warnings are normal on shared hosting"
else
    echo ""
    echo "❌ Deploy failed with exit code: $RSYNC_EXIT_CODE"
    exit 1
fi

echo ""
echo "🎉 Deployment complete!" 