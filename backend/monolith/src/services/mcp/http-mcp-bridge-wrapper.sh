#!/bin/bash
# Wrapper script to run http-mcp-bridge.js from the correct directory
# This ensures Node.js can find the @modelcontextprotocol/sdk dependency

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MONOLITH_DIR="$(cd "$SCRIPT_DIR/../../.." && pwd)"

# Change to the monolith directory where node_modules is located
cd "$MONOLITH_DIR"

# Run the MCP bridge script
exec node "$SCRIPT_DIR/http-mcp-bridge.js"
