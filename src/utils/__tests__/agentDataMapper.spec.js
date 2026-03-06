/**
 * Unit tests for agentDataMapper
 */

import { describe, it, expect } from 'vitest';
import {
  generateAgentId,
  mapToAgentAPI,
  extractAgentFromCanvas,
  validateAgentData
} from '../agentDataMapper.js';

describe('agentDataMapper', () => {
  describe('generateAgentId', () => {
    it('should generate kebab-case ID from name', () => {
      expect(generateAgentId('My Custom Agent')).toBe('my-custom-agent');
    });

    it('should remove special characters', () => {
      expect(generateAgentId('Agent@#$%2025')).toBe('agent2025');
    });

    it('should replace multiple spaces with single hyphen', () => {
      expect(generateAgentId('My   Custom    Agent')).toBe('my-custom-agent');
    });

    it('should remove leading and trailing hyphens', () => {
      expect(generateAgentId('  My Agent  ')).toBe('my-agent');
    });

    it('should throw error if name is not provided', () => {
      expect(() => generateAgentId()).toThrow('Agent name is required');
    });

    it('should throw error if name is not a string', () => {
      expect(() => generateAgentId(123)).toThrow('Agent name is required');
    });
  });

  describe('mapToAgentAPI', () => {
    it('should map basic form data to API format', () => {
      const formData = {
        name: 'Test Agent',
        description: 'Test description'
      };

      const result = mapToAgentAPI(formData, 'form');

      expect(result).toMatchObject({
        id: 'test-agent',
        name: 'Test Agent',
        description: 'Test description',
        icon: '🤖',
        category: 'other',
        path: '/agent/test-agent',
        creator: 'DronDoc User',
        status: 'Running',
        tags: [],
        price: 0,
        pricingModel: 'free',
        capabilities: [],
        triggers: [],
        priority: 5,
        enabled: true
      });

      expect(result.metadata).toMatchObject({
        createdVia: 'form'
      });
      expect(result.metadata.createdAt).toBeDefined();
    });

    it('should use provided ID instead of generating', () => {
      const formData = {
        id: 'custom-id',
        name: 'Test Agent',
        description: 'Test description'
      };

      const result = mapToAgentAPI(formData);

      expect(result.id).toBe('custom-id');
    });

    it('should parse capabilities from array', () => {
      const formData = {
        name: 'Test Agent',
        description: 'Test description',
        capabilities: ['chat', 'search', 'analyze']
      };

      const result = mapToAgentAPI(formData);

      expect(result.capabilities).toEqual(['chat', 'search', 'analyze']);
    });

    it('should parse capabilities from JSON string', () => {
      const formData = {
        name: 'Test Agent',
        description: 'Test description',
        capabilities: '["chat", "search"]'
      };

      const result = mapToAgentAPI(formData);

      expect(result.capabilities).toEqual(['chat', 'search']);
    });

    it('should parse capabilities from comma-separated string', () => {
      const formData = {
        name: 'Test Agent',
        description: 'Test description',
        capabilities: 'chat, search, analyze'
      };

      const result = mapToAgentAPI(formData);

      expect(result.capabilities).toEqual(['chat', 'search', 'analyze']);
    });

    it('should parse triggers from array', () => {
      const formData = {
        name: 'Test Agent',
        description: 'Test description',
        triggers: [{ keywords: ['help', 'support'], priority: 8 }]
      };

      const result = mapToAgentAPI(formData);

      expect(result.triggers).toEqual([{ keywords: ['help', 'support'], priority: 8 }]);
    });

    it('should parse triggers from JSON string', () => {
      const formData = {
        name: 'Test Agent',
        description: 'Test description',
        triggers: '[{"keywords": ["help"], "priority": 7}]'
      };

      const result = mapToAgentAPI(formData);

      expect(result.triggers).toEqual([{ keywords: ['help'], priority: 7 }]);
    });

    it('should convert comma-separated keywords to trigger object', () => {
      const formData = {
        name: 'Test Agent',
        description: 'Test description',
        triggers: 'help, support, info',
        priority: 6
      };

      const result = mapToAgentAPI(formData);

      expect(result.triggers).toEqual([{ keywords: ['help', 'support', 'info'], priority: 6 }]);
    });

    it('should parse tags from array', () => {
      const formData = {
        name: 'Test Agent',
        description: 'Test description',
        tags: ['ai', 'analytics']
      };

      const result = mapToAgentAPI(formData);

      expect(result.tags).toEqual(['ai', 'analytics']);
    });

    it('should parse tags from comma-separated string', () => {
      const formData = {
        name: 'Test Agent',
        description: 'Test description',
        tags: 'ai, analytics, automation'
      };

      const result = mapToAgentAPI(formData);

      expect(result.tags).toEqual(['ai', 'analytics', 'automation']);
    });

    it('should parse metadata from object', () => {
      const formData = {
        name: 'Test Agent',
        description: 'Test description',
        metadata: { custom: 'value' }
      };

      const result = mapToAgentAPI(formData);

      expect(result.metadata.custom).toBe('value');
    });

    it('should parse metadata from JSON string', () => {
      const formData = {
        name: 'Test Agent',
        description: 'Test description',
        metadata: '{"custom": "value"}'
      };

      const result = mapToAgentAPI(formData);

      expect(result.metadata.custom).toBe('value');
    });

    it('should include mode in metadata', () => {
      const formData = {
        name: 'Test Agent',
        description: 'Test description'
      };

      const result = mapToAgentAPI(formData, 'canvas');

      expect(result.metadata.createdVia).toBe('canvas');
    });

    it('should throw error if name is missing', () => {
      expect(() => mapToAgentAPI({ description: 'Test' })).toThrow('Agent name is required');
    });

    it('should throw error if description is missing', () => {
      expect(() => mapToAgentAPI({ name: 'Test' })).toThrow('Agent description is required');
    });

    it('should preserve all provided fields', () => {
      const formData = {
        name: 'Test Agent',
        description: 'Test description',
        icon: '🎨',
        category: 'ai',
        path: '/custom-path',
        creator: 'Custom Creator',
        status: 'Beta',
        tags: ['tag1'],
        price: 99,
        pricingModel: 'subscription',
        capabilities: ['cap1'],
        triggers: [{ keywords: ['test'], priority: 10 }],
        priority: 9,
        enabled: false,
        metadata: { custom: 'data' }
      };

      const result = mapToAgentAPI(formData);

      expect(result).toMatchObject({
        name: 'Test Agent',
        description: 'Test description',
        icon: '🎨',
        category: 'ai',
        path: '/custom-path',
        creator: 'Custom Creator',
        status: 'Beta',
        tags: ['tag1'],
        price: 99,
        pricingModel: 'subscription',
        capabilities: ['cap1'],
        triggers: [{ keywords: ['test'], priority: 10 }],
        priority: 9,
        enabled: false
      });
    });
  });

  describe('extractAgentFromCanvas', () => {
    it('should extract agent from canvas with base agent', () => {
      const canvas = {
        components: [
          {
            type: 'base-agent',
            data: {
              name: 'Canvas Agent',
              description: 'Agent from canvas',
              icon: '🎨',
              category: 'ai'
            }
          }
        ],
        connections: []
      };

      const result = extractAgentFromCanvas(canvas, 'Canvas Test');

      expect(result).toMatchObject({
        name: 'Canvas Agent',
        description: 'Agent from canvas',
        icon: '🎨',
        category: 'ai'
      });
    });

    it('should use canvas name if base agent has no name', () => {
      const canvas = {
        components: [{ type: 'base-agent', data: {} }],
        connections: []
      };

      const result = extractAgentFromCanvas(canvas, 'Canvas Test');

      expect(result.name).toBe('Canvas Test');
    });

    it('should extract capabilities from capability components', () => {
      const canvas = {
        components: [
          { type: 'capability', data: { name: 'chat' } },
          { type: 'capability', data: { name: 'search' } },
          { category: 'capabilities', label: 'analyze' }
        ],
        connections: []
      };

      const result = extractAgentFromCanvas(canvas, 'Canvas Test');

      expect(result.capabilities).toEqual(['chat', 'search', 'analyze']);
    });

    it('should extract triggers from trigger components', () => {
      const canvas = {
        components: [
          { type: 'trigger', data: { keywords: ['help', 'support'], priority: 8 } },
          { category: 'triggers', data: { keywords: ['info'], priority: 5 } }
        ],
        connections: []
      };

      const result = extractAgentFromCanvas(canvas, 'Canvas Test');

      expect(result.triggers).toEqual([
        { keywords: ['help', 'support'], priority: 8 },
        { keywords: ['info'], priority: 5 }
      ]);
    });

    it('should include canvas metadata', () => {
      const canvas = {
        components: [
          { type: 'base-agent', data: {} },
          { type: 'capability', data: {} }
        ],
        connections: [{ from: 'a', to: 'b' }],
        viewport: { x: 0, y: 0, zoom: 1 }
      };

      const result = extractAgentFromCanvas(canvas, 'Canvas Test');

      expect(result.metadata.canvas).toMatchObject({
        components: 2,
        connections: 1,
        viewport: { x: 0, y: 0, zoom: 1 }
      });
    });

    it('should add default tags for canvas-created agents', () => {
      const canvas = {
        components: [],
        connections: []
      };

      const result = extractAgentFromCanvas(canvas, 'Canvas Test');

      expect(result.tags).toContain('canvas');
      expect(result.tags).toContain('visual');
    });

    it('should throw error if canvas is not provided', () => {
      expect(() => extractAgentFromCanvas(null, 'Test')).toThrow('Canvas data is required');
    });

    it('should throw error if canvasName is not provided', () => {
      expect(() => extractAgentFromCanvas({}, '')).toThrow('Canvas name is required');
    });

    it('should generate default description with canvas name', () => {
      const canvas = {
        components: [],
        connections: []
      };

      const result = extractAgentFromCanvas(canvas, 'My Canvas');

      expect(result.description).toBe('Agent created from canvas: My Canvas');
    });
  });

  describe('validateAgentData', () => {
    it('should validate correct agent data', () => {
      const agentData = {
        id: 'test-agent',
        name: 'Test Agent',
        description: 'Test description',
        path: '/test-agent',
        icon: '🤖',
        category: 'ai',
        creator: 'Test',
        status: 'Running',
        tags: ['tag1'],
        price: 0,
        pricingModel: 'free',
        capabilities: ['cap1'],
        triggers: [{ keywords: ['test'], priority: 5 }],
        priority: 5,
        enabled: true,
        metadata: { custom: 'value' }
      };

      const result = validateAgentData(agentData);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return error if id is missing', () => {
      const agentData = {
        name: 'Test',
        description: 'Test',
        path: '/test'
      };

      const result = validateAgentData(agentData);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Agent ID is required and must be a string');
    });

    it('should return error if name is missing', () => {
      const agentData = {
        id: 'test',
        description: 'Test',
        path: '/test'
      };

      const result = validateAgentData(agentData);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Agent name is required and must be a string');
    });

    it('should return error if description is missing', () => {
      const agentData = {
        id: 'test',
        name: 'Test',
        path: '/test'
      };

      const result = validateAgentData(agentData);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Agent description is required and must be a string');
    });

    it('should return error if path is missing', () => {
      const agentData = {
        id: 'test',
        name: 'Test',
        description: 'Test'
      };

      const result = validateAgentData(agentData);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Agent path is required and must be a string');
    });

    it('should return error if tags is not an array', () => {
      const agentData = {
        id: 'test',
        name: 'Test',
        description: 'Test',
        path: '/test',
        tags: 'not-an-array'
      };

      const result = validateAgentData(agentData);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Agent tags must be an array');
    });

    it('should return error if capabilities is not an array', () => {
      const agentData = {
        id: 'test',
        name: 'Test',
        description: 'Test',
        path: '/test',
        capabilities: 'not-an-array'
      };

      const result = validateAgentData(agentData);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Agent capabilities must be an array');
    });

    it('should return error if triggers is not an array', () => {
      const agentData = {
        id: 'test',
        name: 'Test',
        description: 'Test',
        path: '/test',
        triggers: 'not-an-array'
      };

      const result = validateAgentData(agentData);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Agent triggers must be an array');
    });

    it('should return error if price is not a number', () => {
      const agentData = {
        id: 'test',
        name: 'Test',
        description: 'Test',
        path: '/test',
        price: '99'
      };

      const result = validateAgentData(agentData);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Agent price must be a number');
    });

    it('should return error if priority is not a number', () => {
      const agentData = {
        id: 'test',
        name: 'Test',
        description: 'Test',
        path: '/test',
        priority: '5'
      };

      const result = validateAgentData(agentData);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Agent priority must be a number');
    });

    it('should return error if enabled is not a boolean', () => {
      const agentData = {
        id: 'test',
        name: 'Test',
        description: 'Test',
        path: '/test',
        enabled: 'true'
      };

      const result = validateAgentData(agentData);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Agent enabled must be a boolean');
    });

    it('should return error if metadata is not an object', () => {
      const agentData = {
        id: 'test',
        name: 'Test',
        description: 'Test',
        path: '/test',
        metadata: 'not-an-object'
      };

      const result = validateAgentData(agentData);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Agent metadata must be an object');
    });

    it('should return multiple errors', () => {
      const agentData = {
        tags: 'invalid',
        price: 'invalid'
      };

      const result = validateAgentData(agentData);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
    });
  });
});
