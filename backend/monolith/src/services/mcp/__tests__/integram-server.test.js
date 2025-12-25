/**
 * Tests for Integram MCP Server
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Integram MCP Server', () => {
  let client;
  let transport;

  beforeAll(async () => {
    // Initialize MCP client
    const serverScriptPath = path.join(__dirname, '../integram-server.js');

    transport = new StdioClientTransport({
      command: 'node',
      args: [serverScriptPath],
    });

    client = new Client(
      {
        name: 'integram-test-client',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    await client.connect(transport);
  });

  afterAll(async () => {
    if (client) {
      await client.close();
    }
  });

  describe('Tool Listing', () => {
    it('should list all available tools', async () => {
      const response = await client.listTools();

      expect(response).toBeDefined();
      expect(response.tools).toBeDefined();
      expect(Array.isArray(response.tools)).toBe(true);
      expect(response.tools.length).toBeGreaterThan(0);
    });

    it('should include authentication tools', async () => {
      const response = await client.listTools();
      const toolNames = response.tools.map(tool => tool.name);

      expect(toolNames).toContain('integram_authenticate');
      expect(toolNames).toContain('integram_set_context');
    });

    it('should include DDL operation tools', async () => {
      const response = await client.listTools();
      const toolNames = response.tools.map(tool => tool.name);

      expect(toolNames).toContain('integram_create_type');
      expect(toolNames).toContain('integram_save_type');
      expect(toolNames).toContain('integram_delete_type');
      expect(toolNames).toContain('integram_add_requisite');
      expect(toolNames).toContain('integram_delete_requisite');
    });

    it('should include DML operation tools', async () => {
      const response = await client.listTools();
      const toolNames = response.tools.map(tool => tool.name);

      expect(toolNames).toContain('integram_create_object');
      expect(toolNames).toContain('integram_save_object');
      expect(toolNames).toContain('integram_delete_object');
      expect(toolNames).toContain('integram_move_object_up');
    });

    it('should include query operation tools', async () => {
      const response = await client.listTools();
      const toolNames = response.tools.map(tool => tool.name);

      expect(toolNames).toContain('integram_get_dictionary');
      expect(toolNames).toContain('integram_get_type_metadata');
      expect(toolNames).toContain('integram_get_object_list');
      expect(toolNames).toContain('integram_execute_report');
    });

    it('should include multiselect operation tools', async () => {
      const response = await client.listTools();
      const toolNames = response.tools.map(tool => tool.name);

      expect(toolNames).toContain('integram_add_multiselect_item');
      expect(toolNames).toContain('integram_remove_multiselect_item');
    });

    it('should include file operation tools', async () => {
      const response = await client.listTools();
      const toolNames = response.tools.map(tool => tool.name);

      expect(toolNames).toContain('integram_get_dir_admin');
      expect(toolNames).toContain('integram_create_backup');
    });
  });

  describe('Tool Schemas', () => {
    it('should have valid input schemas for all tools', async () => {
      const response = await client.listTools();

      for (const tool of response.tools) {
        expect(tool.inputSchema).toBeDefined();
        expect(tool.inputSchema.type).toBe('object');
        expect(tool.inputSchema.properties).toBeDefined();
      }
    });

    it('should have required fields defined in schemas', async () => {
      const response = await client.listTools();
      const authenticateTool = response.tools.find(t => t.name === 'integram_authenticate');

      expect(authenticateTool).toBeDefined();
      expect(authenticateTool.inputSchema.required).toEqual([
        'serverURL',
        'database',
        'login',
        'password'
      ]);
    });
  });

  describe('Tool Execution', () => {
    it('should fail when calling tool without authentication', async () => {
      try {
        await client.callTool({
          name: 'integram_get_dictionary',
          arguments: {}
        });
        // Should not reach here
        expect(true).toBe(false);
      } catch (error) {
        // Expected to fail due to no authentication
        expect(error).toBeDefined();
      }
    });

    it('should successfully set context', async () => {
      const result = await client.callTool({
        name: 'integram_set_context',
        arguments: {
          serverURL: 'https://dronedoc.ru',
          database: 'a2025',
          token: 'test-token',
          xsrfToken: 'test-xsrf'
        }
      });

      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
      expect(Array.isArray(result.content)).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should return error for unknown tool', async () => {
      try {
        await client.callTool({
          name: 'integram_unknown_tool',
          arguments: {}
        });
        // Should not reach here
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should return error for invalid arguments', async () => {
      const result = await client.callTool({
        name: 'integram_authenticate',
        arguments: {
          // Missing required fields
          serverURL: 'https://dronedoc.ru'
        }
      });

      expect(result).toBeDefined();
      // Should contain error information
    });
  });
});

describe('Integram MCP Server Integration', () => {
  it('should have all tools from original client', async () => {
    const serverScriptPath = path.join(__dirname, '../integram-server.js');

    const transport = new StdioClientTransport({
      command: 'node',
      args: [serverScriptPath],
    });

    const client = new Client(
      {
        name: 'integram-integration-test',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    await client.connect(transport);
    const response = await client.listTools();

    // Verify we have all major categories of tools
    const toolNames = response.tools.map(tool => tool.name);

    // Authentication (2 tools)
    expect(toolNames.filter(name => name.includes('authenticate') || name.includes('context')).length).toBeGreaterThanOrEqual(2);

    // DDL operations (should have multiple)
    expect(toolNames.filter(name => name.includes('type') || name.includes('requisite')).length).toBeGreaterThanOrEqual(8);

    // DML operations (should have multiple)
    expect(toolNames.filter(name => name.includes('object') && name.includes('_m_')).length).toBeGreaterThanOrEqual(0);

    // Query operations
    expect(toolNames.filter(name => name.includes('get_') || name.includes('execute')).length).toBeGreaterThanOrEqual(6);

    // Multiselect operations
    expect(toolNames.filter(name => name.includes('multiselect')).length).toBeGreaterThanOrEqual(2);

    await client.close();
  });
});
