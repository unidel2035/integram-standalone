#!/usr/bin/env node

/**
 * HTTP KAG Memory Bridge
 *
 * This script acts as a stdio bridge to the HTTP KAG Memory MCP server.
 * It allows Claude Code to connect to remote KAG memory server via HTTP.
 *
 * Usage:
 *   node http-kag-bridge.js
 *
 * Environment variables:
 *   MCP_SERVER_URL - Base URL of the MCP server (default: https://dev.drondoc.ru)
 *   MCP_API_PATH - API path for KAG memory (default: /api/mcp/kag)
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import axios from 'axios';
import https from 'https';

// Configuration
const MCP_SERVER_URL = process.env.MCP_SERVER_URL || 'https://dev.drondoc.ru';
const MCP_API_PATH = process.env.MCP_API_PATH || '/api/mcp/kag';

// Create axios instance with SSL bypass for dev server
const httpClient = axios.create({
  baseURL: MCP_SERVER_URL,
  httpsAgent: new https.Agent({
    rejectUnauthorized: false
  }),
  timeout: 60000 // 60 seconds for potentially long indexing operations
});

/**
 * MCP Bridge Server
 */
const server = new Server(
  {
    name: 'kag-memory-http-bridge',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

/**
 * List tools from HTTP KAG Memory MCP server
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
  try {
    const response = await httpClient.get(`${MCP_API_PATH}/tools`);

    if (!response.data.success) {
      throw new Error('Failed to fetch tools from HTTP KAG Memory MCP server');
    }

    return {
      tools: response.data.tools,
    };
  } catch (error) {
    console.error('[KAG Bridge] Error listing tools:', error.message);
    throw error;
  }
});

/**
 * Execute tool via HTTP KAG Memory MCP server
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    const response = await httpClient.post(`${MCP_API_PATH}/execute`, {
      toolName: name,
      arguments: args
    });

    if (!response.data.success) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              error: response.data.error || 'Unknown error',
              tool: name,
              arguments: args
            }, null, 2),
          },
        ],
        isError: true,
      };
    }

    // Return the result from HTTP MCP server
    return response.data.result;

  } catch (error) {
    console.error('[KAG Bridge] Error executing tool:', error.message);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            error: error.message,
            tool: name,
            arguments: args,
            httpError: error.response?.data
          }, null, 2),
        },
      ],
      isError: true,
    };
  }
});

/**
 * Start the bridge server
 */
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`[KAG Bridge] HTTP KAG Memory Bridge running (${MCP_SERVER_URL}${MCP_API_PATH})`);
}

main().catch((error) => {
  console.error('[KAG Bridge] Fatal error in bridge:', error);
  process.exit(1);
});
