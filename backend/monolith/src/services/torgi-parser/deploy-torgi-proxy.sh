#!/bin/bash
#
# Torgi Proxy Server Deploy Script
# Issue #4594: Deploy proxy server to VPS
#
# Usage: ./deploy-torgi-proxy.sh VPS_IP API_KEY [SSH_PASSWORD]
#

VPS_IP="$1"
API_KEY="$2"
SSH_PASSWORD="$3"

if [ -z "$VPS_IP" ] || [ -z "$API_KEY" ]; then
  echo "Usage: $0 VPS_IP API_KEY [SSH_PASSWORD]"
  echo ""
  echo "Example: $0 192.168.1.100 my-secret-key"
  echo "Example with password: $0 192.168.1.100 my-secret-key mypassword"
  exit 1
fi

# Server code
SERVER_CODE='
import express from "express"
import axios from "axios"

const app = express()
const PORT = process.env.TORGI_PROXY_PORT || 3333
const API_KEY = process.env.TORGI_PROXY_API_KEY || "torgi-proxy-key"

app.use(express.json())

function checkAuth(req, res, next) {
  const apiKey = req.headers["x-api-key"] || req.query.api_key
  if (apiKey !== API_KEY) {
    return res.status(401).json({ error: "Unauthorized" })
  }
  next()
}

app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() })
})

app.get("/api/lotcard/:lotId", checkAuth, async (req, res) => {
  try {
    const response = await axios.get(
      `https://torgi.gov.ru/new/api/public/lotcards/${req.params.lotId}`,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          "Accept": "application/json"
        },
        timeout: 30000
      }
    )
    res.json({ success: true, data: response.data })
  } catch (error) {
    res.status(error.response?.status || 500).json({
      success: false,
      error: error.message
    })
  }
})

app.get("/api/lotcard/:lotId/documents", checkAuth, async (req, res) => {
  const endpoints = [
    `https://torgi.gov.ru/new/api/public/lotcards/${req.params.lotId}/documents`,
    `https://torgi.gov.ru/new/api/public/lotcards/${req.params.lotId}/files`
  ]
  for (const endpoint of endpoints) {
    try {
      const response = await axios.get(endpoint, {
        headers: { "User-Agent": "Mozilla/5.0", "Accept": "application/json" },
        timeout: 30000
      })
      if (response.data) return res.json({ success: true, data: response.data })
    } catch (e) {}
  }
  res.status(404).json({ success: false, error: "Not found" })
})

app.post("/api/search", checkAuth, async (req, res) => {
  try {
    const response = await axios.post(
      "https://torgi.gov.ru/new/api/public/lotcards/search",
      req.body,
      {
        headers: {
          "User-Agent": "Mozilla/5.0",
          "Accept": "application/json",
          "Content-Type": "application/json"
        },
        timeout: 60000
      }
    )
    res.json({ success: true, data: response.data })
  } catch (error) {
    res.status(error.response?.status || 500).json({
      success: false,
      error: error.message
    })
  }
})

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Torgi Proxy running on port ${PORT}`)
})
'

echo "Deploying Torgi Proxy to $VPS_IP..."

# Build SSH command
if [ -n "$SSH_PASSWORD" ]; then
  SSH_CMD="sshpass -p '$SSH_PASSWORD' ssh -o StrictHostKeyChecking=no"
  SCP_CMD="sshpass -p '$SSH_PASSWORD' scp -o StrictHostKeyChecking=no"
else
  SSH_CMD="ssh -o StrictHostKeyChecking=no"
  SCP_CMD="scp -o StrictHostKeyChecking=no"
fi

# Deploy
eval "$SSH_CMD root@$VPS_IP" << ENDSSH
set -e

echo "Installing Node.js..."
if ! command -v node &> /dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi

echo "Creating directory..."
mkdir -p /opt/torgi-proxy
cd /opt/torgi-proxy

echo "Creating package.json..."
cat > package.json << 'EOF'
{
  "name": "torgi-proxy",
  "version": "1.0.0",
  "type": "module",
  "dependencies": {
    "express": "^4.18.2",
    "axios": "^1.6.0"
  }
}
EOF

echo "Creating server.js..."
cat > server.js << 'SERVEREOF'
$SERVER_CODE
SERVEREOF

echo "Creating .env..."
cat > .env << EOF
TORGI_PROXY_PORT=3333
TORGI_PROXY_API_KEY=$API_KEY
EOF

echo "Installing dependencies..."
npm install

echo "Installing PM2..."
npm install -g pm2 2>/dev/null || true

echo "Starting server..."
pm2 delete torgi-proxy 2>/dev/null || true
pm2 start server.js --name torgi-proxy
pm2 save

echo ""
echo "==================================="
echo "Torgi Proxy deployed successfully!"
echo "==================================="
echo ""
echo "Test with:"
echo "curl http://$VPS_IP:3333/health"
echo ""
echo "API endpoint:"
echo "curl -H 'X-API-Key: $API_KEY' 'http://$VPS_IP:3333/api/lotcard/22000037040000000056_5'"
ENDSSH

echo ""
echo "Deploy complete! Testing..."
sleep 3
curl -s "http://$VPS_IP:3333/health" && echo " - Health check OK" || echo " - Health check FAILED"
