#!/usr/bin/env node

/**
 * HTTP MCP Bridge for FullCalendar
 *
 * Exposes FullCalendar MCP Server via HTTP API
 * Same pattern as http-mcp-bridge.js but for fullcalendar
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * FullCalendar MCP Bridge Client
 */
export class FullCalendarMCPBridge {
  constructor() {
    this.client = null;
    this.transport = null;
    this.serverURL = process.env.MCP_SERVER_URL || 'https://dronedoc.ru/fullcalendar';
  }

  /**
   * Initialize MCP client
   */
  async initialize() {
    if (this.client) {
      return; // Already initialized
    }

    const serverPath = join(__dirname, 'fullcalendar-server.js');

    this.transport = new StdioClientTransport({
      command: 'node',
      args: [serverPath],
      env: {
        ...process.env,
        MCP_SERVER_URL: this.serverURL
      }
    });

    this.client = new Client(
      {
        name: 'fullcalendar-http-bridge',
        version: '1.0.0'
      },
      {
        capabilities: {
          tools: {}
        }
      }
    );

    await this.client.connect(this.transport);
    console.log('FullCalendar MCP Bridge initialized');
  }

  /**
   * List available tools
   */
  async listTools() {
    await this.initialize();
    const response = await this.client.listTools();
    return response.tools;
  }

  /**
   * Execute a tool
   */
  async executeTool(toolName, args) {
    await this.initialize();

    const result = await this.client.callTool({
      name: toolName,
      arguments: args
    });

    return result;
  }

  /**
   * Close connection
   */
  async close() {
    if (this.client) {
      await this.client.close();
      this.client = null;
      this.transport = null;
    }
  }
}

// Export singleton instance
export const fullcalendarBridge = new FullCalendarMCPBridge();
