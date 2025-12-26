#!/bin/bash
# Deploy Vue.js build to production server интеграм.рф (185.128.105.78)
# This script syncs the dist/ folder to /var/www/html/app/ on production

set -e

# Production server configuration
PROD_SERVER="185.128.105.78"
PROD_USER="root"
PROD_PATH="/var/www/html/app/"
LOCAL_DIST="./dist/"

echo "🚀 Deploying Vue.js app to production server..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Server: $PROD_SERVER"
echo "Path: $PROD_PATH"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check if dist folder exists
if [ ! -d "$LOCAL_DIST" ]; then
    echo "❌ Error: dist/ folder not found!"
    echo "Run 'npm run build' first"
    exit 1
fi

# Show files to be deployed
echo "📦 Files to deploy:"
ls -lh dist/ | head -10
echo "..."
echo ""

# Confirm deployment
read -p "Deploy to production server $PROD_SERVER? (yes/no): " confirm
if [ "$confirm" != "yes" ]; then
    echo "❌ Deployment cancelled"
    exit 0
fi

echo ""
echo "📤 Uploading files to $PROD_SERVER..."

# Sync dist folder to production using rsync
# --delete removes files on server that don't exist locally
# --exclude protects specific files from deletion
rsync -avz --progress \
    --delete \
    --exclude='.htaccess' \
    --exclude='*.log' \
    "$LOCAL_DIST" \
    "$PROD_USER@$PROD_SERVER:$PROD_PATH"

echo ""
echo "🔄 Restarting Apache on production..."
ssh "$PROD_USER@$PROD_SERVER" "systemctl restart httpd && echo '✅ Apache restarted'"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Deployment completed successfully!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🌐 Check the application:"
echo "   https://интеграм.рф/app/welcome"
echo "   https://интеграм.рф/app/"
echo ""
echo "📋 Latest commit deployed:"
git log -1 --oneline
echo ""
