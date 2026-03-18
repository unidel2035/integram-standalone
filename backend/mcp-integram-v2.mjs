#!/usr/bin/env node
/**
 * Integram V2 MCP Server launcher
 * Changes to backend dir so node_modules resolve correctly, then runs the server.
 */
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
process.chdir(__dirname)

// Now import the actual server (SDK will resolve from ./node_modules)
await import('./src/services/mcp/integram-v2-server.js')
