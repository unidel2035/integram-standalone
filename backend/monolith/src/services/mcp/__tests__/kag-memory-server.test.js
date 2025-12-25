/**
 * Tests for KAG Memory MCP Server
 *
 * Issue #5126
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import axios from 'axios';

const API_BASE_URL = process.env.TEST_API_URL || 'http://localhost:8081';
const KAG_MCP_URL = `${API_BASE_URL}/api/mcp/kag`;

describe('KAG Memory MCP Server', () => {
  beforeAll(async () => {
    // Wait for server to be ready
    await new Promise((resolve) => setTimeout(resolve, 1000));
  });

  describe('GET /api/mcp/kag/tools', () => {
    it('should list all available MCP tools', async () => {
      const response = await axios.get(`${KAG_MCP_URL}/tools`);

      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      expect(Array.isArray(response.data.tools)).toBe(true);
      expect(response.data.tools.length).toBeGreaterThan(0);

      // Check for key tools
      const toolNames = response.data.tools.map((t) => t.name);
      expect(toolNames).toContain('kag_search');
      expect(toolNames).toContain('kag_ask');
      expect(toolNames).toContain('kag_get_entity');
      expect(toolNames).toContain('kag_create_entities');
      expect(toolNames).toContain('kag_read_graph');
      expect(toolNames).toContain('kag_stats');
    });

    it('should return proper tool schemas', async () => {
      const response = await axios.get(`${KAG_MCP_URL}/tools`);

      const searchTool = response.data.tools.find((t) => t.name === 'kag_search');
      expect(searchTool).toBeDefined();
      expect(searchTool.description).toBeDefined();
      expect(searchTool.inputSchema).toBeDefined();
      expect(searchTool.inputSchema.properties.query).toBeDefined();
    });
  });

  describe('POST /api/mcp/kag/execute - kag_stats', () => {
    it('should return knowledge base statistics', async () => {
      const response = await axios.post(`${KAG_MCP_URL}/execute`, {
        toolName: 'kag_stats',
        arguments: {},
      });

      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      expect(response.data.result).toBeDefined();
      expect(response.data.result.content).toBeDefined();
      expect(response.data.result.content[0].type).toBe('text');

      // Parse the result text (JSON string)
      const stats = JSON.parse(response.data.result.content[0].text);
      expect(stats.totalEntities).toBeDefined();
      expect(stats.totalRelations).toBeDefined();
      expect(typeof stats.totalEntities).toBe('number');
      expect(typeof stats.totalRelations).toBe('number');
    });
  });

  describe('POST /api/mcp/kag/execute - kag_search', () => {
    it('should search the knowledge base', async () => {
      const response = await axios.post(`${KAG_MCP_URL}/execute`, {
        toolName: 'kag_search',
        arguments: {
          query: 'authentication',
          limit: 5,
          minScore: 0.1,
        },
      });

      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      expect(response.data.result).toBeDefined();

      const result = JSON.parse(response.data.result.content[0].text);
      expect(result.query).toBe('authentication');
      expect(Array.isArray(result.results)).toBe(true);
      expect(result.count).toBeDefined();
    });

    it('should respect search limits', async () => {
      const response = await axios.post(`${KAG_MCP_URL}/execute`, {
        toolName: 'kag_search',
        arguments: {
          query: 'issue',
          limit: 3,
        },
      });

      expect(response.status).toBe(200);
      const result = JSON.parse(response.data.result.content[0].text);
      expect(result.results.length).toBeLessThanOrEqual(3);
    });
  });

  describe('POST /api/mcp/kag/execute - kag_create_entities', () => {
    it('should create new entities', async () => {
      const testEntityName = `TestEntity_${Date.now()}`;

      const response = await axios.post(`${KAG_MCP_URL}/execute`, {
        toolName: 'kag_create_entities',
        arguments: {
          entities: [
            {
              name: testEntityName,
              entityType: 'TestType',
              observations: ['Test observation 1', 'Test observation 2'],
            },
          ],
        },
      });

      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);

      const result = JSON.parse(response.data.result.content[0].text);
      expect(result.success).toBe(true);
      expect(result.created).toBeDefined();
      expect(result.created.length).toBe(1);
      expect(result.created[0].name).toBe(testEntityName);
    });
  });

  describe('POST /api/mcp/kag/execute - kag_read_graph', () => {
    it('should return the knowledge graph', async () => {
      const response = await axios.post(`${KAG_MCP_URL}/execute`, {
        toolName: 'kag_read_graph',
        arguments: {},
      });

      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);

      const result = JSON.parse(response.data.result.content[0].text);
      expect(Array.isArray(result.entities)).toBe(true);
      expect(Array.isArray(result.relations)).toBe(true);
      expect(result.stats).toBeDefined();
      expect(result.stats.totalEntities).toBe(result.entities.length);
      expect(result.stats.totalRelations).toBe(result.relations.length);
    });
  });

  describe('Error handling', () => {
    it('should return error for unknown tool', async () => {
      const response = await axios.post(
        `${KAG_MCP_URL}/execute`,
        {
          toolName: 'unknown_tool',
          arguments: {},
        },
        { validateStatus: () => true }
      );

      expect(response.status).toBe(400);
      expect(response.data.success).toBe(false);
      expect(response.data.error).toContain('Unknown tool');
    });

    it('should return error for missing toolName', async () => {
      const response = await axios.post(
        `${KAG_MCP_URL}/execute`,
        {
          arguments: {},
        },
        { validateStatus: () => true }
      );

      expect(response.status).toBe(400);
      expect(response.data.success).toBe(false);
      expect(response.data.error).toContain('Missing toolName');
    });
  });
});
