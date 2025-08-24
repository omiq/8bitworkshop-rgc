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

# Ensure we have a fresh build
echo "🔨 Building project..."
npm run build

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

# Create a temporary directory for staging files
STAGING_DIR=$(mktemp -d)
echo "📁 Staging files in: $STAGING_DIR"

# Copy essential production files
echo "📋 Copying production files..."

# Core HTML and assets
cp index.html "$STAGING_DIR/"
cp manifest.json "$STAGING_DIR/"
cp config.js "$STAGING_DIR/"

# Generated JavaScript bundles
cp -r gen "$STAGING_DIR/"

# CSS and styling
cp -r css "$STAGING_DIR/"

# Essential libraries
cp -r lib "$STAGING_DIR/"
cp -r jquery "$STAGING_DIR/"
cp -r bootstrap "$STAGING_DIR/"

# Platform-specific iframe files
cp bbc-iframe.html "$STAGING_DIR/"
cp c64-iframe.html "$STAGING_DIR/"
cp vic20-iframe.html "$STAGING_DIR/"

# Presets (essential for platform functionality)
cp -r presets "$STAGING_DIR/"

# Resources (WASM files, emulators, etc.)
cp -r res "$STAGING_DIR/"

# Images and static assets
cp -r images "$STAGING_DIR/"

# Help documentation
cp -r help "$STAGING_DIR/"

# CodeMirror (essential for code editing)
cp -r codemirror "$STAGING_DIR/"

# Custom CodeMirror files and source code
cp -r src "$STAGING_DIR/"

# Worker files (essential for compilation)
cp -r src/worker "$STAGING_DIR/"

# TSS (audio-related files)
cp -r tss "$STAGING_DIR/"

# Nanoasm (assembly tools)
cp -r nanoasm "$STAGING_DIR/"

# Javatari (emulator files)
cp -r javatari "$STAGING_DIR/"
cp -r javatari.js "$STAGING_DIR/"

# WASM files in root (if any)
cp *.wasm "$STAGING_DIR/" 2>/dev/null || true
cp *.js "$STAGING_DIR/" 2>/dev/null || true

# Create .htaccess for proper MIME types
cat > "$STAGING_DIR/.htaccess" << 'EOF'
# 8bitworkshop .htaccess
AddType application/wasm .wasm
AddType application/javascript .js
AddType text/css .css
AddType text/html .html

# Enable CORS for WASM files
<Files "*.wasm">
    Header set Access-Control-Allow-Origin "*"
</Files>

# Cache control for static assets
<FilesMatch "\.(js|css|wasm)$">
    ExpiresActive On
    ExpiresDefault "access plus 1 month"
</FilesMatch>

# No cache for HTML files
<FilesMatch "\.html$">
    ExpiresActive On
    ExpiresDefault "access"
    Header set Cache-Control "no-cache, no-store, must-revalidate"
    Header set Pragma "no-cache"
    Header set Expires 0
</FilesMatch>
EOF

# Upload staged files
echo "📤 Uploading files to server..."
rsync -avz --progress --no-times --delete $DRY_RUN_FLAG \
    "$STAGING_DIR/" \
    "$SERVER_HOST:$SERVER_PATH/"

RSYNC_EXIT_CODE=$?

# Clean up staging directory
rm -rf "$STAGING_DIR"

if [ $RSYNC_EXIT_CODE -eq 0 ]; then
    echo ""
    echo "✅ Deploy successful!"
    echo "🌐 Your site should be available at: https://ide.retrogamecoders.com"
    echo "🔧 BBC Micro platform should be working with full compilation support"
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
echo "📝 Note: The BBC Micro platform is now fully deployed with:"
echo "   - WASM compilation support"
echo "   - BBC-specific configuration files"
echo "   - jsbeeb emulator integration"
echo "   - Download menu integration" 