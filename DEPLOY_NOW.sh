#!/bin/bash
# Final deployment command - run this as root user
# Usage: ssh root@185.128.105.78 "bash /home/hive/integram-standalone/DEPLOY_NOW.sh"

set -e

echo "════════════════════════════════════════════════════════"
echo "  Deploying Integram Standalone to интеграм.рф"
echo "════════════════════════════════════════════════════════"
echo ""

# Step 1: Create directory
echo "📁 Creating /var/www/integram..."
mkdir -p /var/www/integram

# Step 2: Copy frontend
echo "📦 Copying frontend files..."
cp -r /home/hive/integram-standalone/dist/* /var/www/integram/

# Step 3: Set permissions
echo "🔐 Setting permissions..."
chown -R www-data:www-data /var/www/integram
chmod -R 755 /var/www/integram

# Step 4: Install nginx config
echo "🌐 Installing nginx configuration..."
cp /home/hive/integram-standalone/integram.rf.nginx.conf /etc/nginx/sites-available/integram.rf

# Step 5: Enable site
echo "🔗 Enabling site..."
ln -sf /etc/nginx/sites-available/integram.rf /etc/nginx/sites-enabled/integram.rf

# Step 6: Test nginx
echo "🧪 Testing nginx configuration..."
if nginx -t 2>&1 | grep -q "successful"; then
    echo "✅ Nginx configuration is valid"
else
    echo "❌ Nginx configuration has errors!"
    exit 1
fi

# Step 7: Reload nginx
echo "🔄 Reloading nginx..."
systemctl reload nginx

echo ""
echo "════════════════════════════════════════════════════════"
echo "  ✅ Deployment Complete!"
echo "════════════════════════════════════════════════════════"
echo ""
echo "🌐 Site: https://интеграм.рф"
echo "🌐 Site: https://xn--80afflxcxn.xn--p1ai"
echo "🔌 WebSocket: wss://интеграм.рф/ws"
echo "💬 Chat API: https://интеграм.рф/api/chat"
echo ""
echo "✅ Backend running on: http://127.0.0.1:3000"
echo ""
