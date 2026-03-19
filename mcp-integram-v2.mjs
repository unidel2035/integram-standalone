#!/usr/bin/env node
/**
 * Integram V2 MCP Server launcher
 * Changes to backend dir so node_modules resolve correctly, then runs the server.
 */
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
process.chdir(join(__dirname, 'backend', 'monolith'))

await import('./backend/monolith/src/services/mcp/integram-v2-server.js')
