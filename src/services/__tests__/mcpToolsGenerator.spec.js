/**
 * Unit tests for MCP Tools Generator
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  generateMCPTools,
  generateSystemPrompt,
  exportSubAgentConfig
} from '../mcpToolsGenerator';
import * as integramService from '../integramApiClient';

// Mock integramService
vi.mock('../integramService', () => ({
  default: {
    getObjectList: vi.fn(),
    createObject: vi.fn(),
    setObjectRequisites: vi.fn(),
    deleteObject: vi.fn(),
    getObjectEditData: vi.fn(),
    getTypeMetadata: vi.fn()
  }
}));

describe('MCPToolsGenerator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generateMCPTools', () => {
    it('should generate tools from blocks', () => {
      const blocks = [
        {
          id: 'block1',
          type: 'mcp-table-reader',
          config: {
            tableId: 123,
            columns: [],
            limit: 100
          }
        },
        {
          id: 'block2',
          type: 'mcp-table-writer',
          config: {
            tableId: 456,
            mapping: { '101': 'name' },
            mode: 'create'
          }
        }
      ];

      const tools = generateMCPTools(blocks, { agentName: 'TestAgent' });

      expect(tools).toHaveLength(2);
      expect(tools[0].name).toBe('TestAgent_mcp-table-reader_0');
      expect(tools[1].name).toBe('TestAgent_mcp-table-writer_1');
      expect(tools[0].category).toBe('data');
      expect(tools[1].category).toBe('data');
    });

    it('should build correct parameters for table reader', () => {
      const blocks = [
        {
          id: 'reader',
          type: 'mcp-table-reader',
          config: {
            tableId: 123,
            columns: [101, 102],
            limit: 50,
            offset: 10,
            filters: [{ field: 101, operator: '=', value: 'test' }]
          }
        }
      ];

      const tools = generateMCPTools(blocks);
      const params = tools[0].parameters;

      expect(params.tableId).toBe(123);
      expect(params.columns).toEqual([101, 102]);
      expect(params.limit).toBe(50);
      expect(params.offset).toBe(10);
      expect(params.filters).toHaveLength(1);
    });

    it('should build correct parameters for table writer', () => {
      const blocks = [
        {
          id: 'writer',
          type: 'mcp-table-writer',
          config: {
            tableId: 456,
            mapping: { '101': 'name', '102': 'description' },
            mode: 'update'
          }
        }
      ];

      const tools = generateMCPTools(blocks);
      const params = tools[0].parameters;

      expect(params.tableId).toBe(456);
      expect(params.mapping).toEqual({ '101': 'name', '102': 'description' });
      expect(params.mode).toBe('update');
    });

    it('should handle unknown block types gracefully', () => {
      const blocks = [
        {
          id: 'unknown',
          type: 'unknown-block-type',
          config: {}
        }
      ];

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const tools = generateMCPTools(blocks);

      expect(consoleSpy).toHaveBeenCalledWith('Unknown block type: unknown-block-type');
      expect(tools).toHaveLength(0);

      consoleSpy.mockRestore();
    });
  });

  describe('Execute Functions', () => {
    it('should execute table reader correctly', async () => {
      const mockResponse = {
        objects: [
          { id: 1, name: 'Test 1' },
          { id: 2, name: 'Test 2' }
        ]
      };

      integramService.default.getObjectList.mockResolvedValue(mockResponse);

      const blocks = [
        {
          id: 'reader',
          type: 'mcp-table-reader',
          config: {
            tableId: 123,
            limit: 100,
            offset: 0
          }
        }
      ];

      const tools = generateMCPTools(blocks);
      const result = await tools[0].execute();

      expect(integramService.default.getObjectList).toHaveBeenCalledWith({
        typeId: 123,
        params: {
          LIMIT: 100,
          pg: 1,
          F_U: 1
        }
      });
      expect(result).toEqual(mockResponse.objects);
    });

    it('should execute table writer in create mode', async () => {
      const mockResponse = { id: 789, value: 'New Object' };
      integramService.default.createObject.mockResolvedValue(mockResponse);

      const blocks = [
        {
          id: 'writer',
          type: 'mcp-table-writer',
          config: {
            tableId: 456,
            mapping: { '101': 'name', '102': 'description' },
            mode: 'create'
          }
        }
      ];

      const tools = generateMCPTools(blocks);
      const input = {
        name: 'Test Object',
        description: 'Test Description'
      };

      const result = await tools[0].execute(input);

      expect(integramService.default.createObject).toHaveBeenCalledWith({
        typeId: 456,
        value: 'Test Object',
        requisites: {
          '101': 'Test Object',
          '102': 'Test Description'
        }
      });
      expect(result).toEqual(mockResponse);
    });

    it('should execute table writer in update mode', async () => {
      const mockResponse = { success: true };
      integramService.default.setObjectRequisites.mockResolvedValue(mockResponse);

      const blocks = [
        {
          id: 'writer',
          type: 'mcp-table-writer',
          config: {
            tableId: 456,
            mapping: { '101': 'name' },
            mode: 'update'
          }
        }
      ];

      const tools = generateMCPTools(blocks);
      const input = {
        objectId: 789,
        name: 'Updated Name'
      };

      const result = await tools[0].execute(input);

      expect(integramService.default.setObjectRequisites).toHaveBeenCalledWith({
        objectId: 789,
        requisites: {
          '101': 'Updated Name'
        }
      });
      expect(result).toEqual(mockResponse);
    });

    it('should execute CRUD read operation', async () => {
      const mockResponse = {
        id: 123,
        value: 'Test Object',
        requisites: {}
      };
      integramService.default.getObjectEditData.mockResolvedValue(mockResponse);

      const blocks = [
        {
          id: 'crud',
          type: 'mcp-record-crud',
          config: {
            tableId: 456,
            operation: 'read'
          }
        }
      ];

      const tools = generateMCPTools(blocks);
      const result = await tools[0].execute({ objectId: 123 });

      expect(integramService.default.getObjectEditData).toHaveBeenCalledWith({
        objectId: 123
      });
      expect(result).toEqual(mockResponse);
    });

    it('should execute CRUD delete operation', async () => {
      const mockResponse = { success: true };
      integramService.default.deleteObject.mockResolvedValue(mockResponse);

      const blocks = [
        {
          id: 'crud',
          type: 'mcp-record-crud',
          config: {
            tableId: 456,
            operation: 'delete'
          }
        }
      ];

      const tools = generateMCPTools(blocks);
      const result = await tools[0].execute({ objectId: 123 });

      expect(integramService.default.deleteObject).toHaveBeenCalledWith({
        objectId: 123
      });
      expect(result).toEqual(mockResponse);
    });

    it('should handle data mapper transformation', async () => {
      const blocks = [
        {
          id: 'mapper',
          type: 'mcp-data-mapper',
          config: {
            mapping: {
              fullName: 'name',
              email: 'email'
            }
          }
        }
      ];

      const tools = generateMCPTools(blocks);
      const input = {
        name: 'John Doe',
        email: 'john@example.com',
        extraField: 'ignored'
      };

      const result = await tools[0].execute(input);

      expect(result).toEqual({
        fullName: 'John Doe',
        email: 'john@example.com'
      });
    });

    it('should handle lookup execution', async () => {
      const mockResponse = {
        objects: [
          { id: 1, name: 'Option 1' },
          { id: 2, name: 'Option 2' },
          { id: 3, name: 'Option 3' }
        ]
      };
      integramService.default.getObjectList.mockResolvedValue(mockResponse);

      const blocks = [
        {
          id: 'lookup',
          type: 'mcp-lookup',
          config: {
            tableId: 789,
            displayField: 'name',
            valueField: 'id',
            multiSelect: false
          }
        }
      ];

      const tools = generateMCPTools(blocks);
      const result = await tools[0].execute();

      expect(integramService.default.getObjectList).toHaveBeenCalledWith({
        typeId: 789,
        params: {
          LIMIT: 1000,
          F_U: 1
        }
      });
      expect(result).toHaveProperty('label');
      expect(result).toHaveProperty('value');
    });
  });

  describe('generateSystemPrompt', () => {
    it('should generate system prompt from blocks', () => {
      const blocks = [
        {
          id: 'block1',
          type: 'mcp-table-reader',
          config: {}
        },
        {
          id: 'block2',
          type: 'mcp-table-writer',
          config: {}
        }
      ];

      const prompt = generateSystemPrompt(blocks, {
        agentName: 'TestAgent',
        agentDescription: 'A test agent for unit testing'
      });

      expect(prompt).toContain('TestAgent');
      expect(prompt).toContain('A test agent for unit testing');
      expect(prompt).toContain('Читатель таблицы');
      expect(prompt).toContain('Запись в таблицу');
    });

    it('should use default agent name if not provided', () => {
      const blocks = [];
      const prompt = generateSystemPrompt(blocks);

      expect(prompt).toContain('SubAgent');
    });
  });

  describe('exportSubAgentConfig', () => {
    it('should export complete sub-agent configuration', () => {
      const blocks = [
        {
          id: 'block1',
          type: 'mcp-table-reader',
          config: {
            tableId: 123
          },
          connections: []
        }
      ];

      const config = exportSubAgentConfig(blocks, {
        agentName: 'ExportTest',
        agentDescription: 'Test export',
        metadata: { author: 'test' }
      });

      expect(config).toHaveProperty('name', 'ExportTest');
      expect(config).toHaveProperty('description', 'Test export');
      expect(config).toHaveProperty('systemPrompt');
      expect(config).toHaveProperty('tools');
      expect(config).toHaveProperty('blocks');
      expect(config).toHaveProperty('metadata');
      expect(config.metadata).toHaveProperty('version', '1.0.0');
      expect(config.metadata).toHaveProperty('author', 'test');
      expect(config.metadata).toHaveProperty('createdAt');
      expect(config.tools).toHaveLength(1);
      expect(config.blocks).toHaveLength(1);
    });

    it('should include block connections in export', () => {
      const blocks = [
        {
          id: 'block1',
          type: 'mcp-table-reader',
          config: {},
          connections: [
            { from: 'block1', to: 'block2', output: 'array' }
          ]
        }
      ];

      const config = exportSubAgentConfig(blocks);

      expect(config.blocks[0].connections).toHaveLength(1);
      expect(config.blocks[0].connections[0]).toEqual({
        from: 'block1',
        to: 'block2',
        output: 'array'
      });
    });
  });

  describe('Error Handling', () => {
    it('should throw error for table writer without input', async () => {
      const blocks = [
        {
          id: 'writer',
          type: 'mcp-table-writer',
          config: {
            tableId: 456,
            mapping: {},
            mode: 'create'
          }
        }
      ];

      const tools = generateMCPTools(blocks);

      await expect(tools[0].execute(null)).rejects.toThrow('Input must be an object');
    });

    it('should throw error for unknown mode in table writer', async () => {
      const blocks = [
        {
          id: 'writer',
          type: 'mcp-table-writer',
          config: {
            tableId: 456,
            mapping: {},
            mode: 'invalid-mode'
          }
        }
      ];

      const tools = generateMCPTools(blocks);

      await expect(tools[0].execute({})).rejects.toThrow('Unknown mode: invalid-mode');
    });

    it('should throw error for CRUD read without objectId', async () => {
      const blocks = [
        {
          id: 'crud',
          type: 'mcp-record-crud',
          config: {
            tableId: 456,
            operation: 'read'
          }
        }
      ];

      const tools = generateMCPTools(blocks);

      await expect(tools[0].execute({})).rejects.toThrow('objectId required for read operation');
    });
  });
});
