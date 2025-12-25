// PlanCacheService.test.js - Comprehensive unit tests for Plan Cache Service
// Issue #5302: Tests for plan templates, caching, and similarity detection

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  PlanCacheService,
  PlanTemplate,
  SimilarityCalculator
} from '../PlanCacheService.js';

describe('PlanTemplate', () => {
  it('should create a plan template with basic properties', () => {
    const template = new PlanTemplate({
      name: 'Test Template',
      type: 'test_type',
      description: 'Test description',
      subtaskTemplate: [],
      priority: 5
    });

    expect(template.name).toBe('Test Template');
    expect(template.type).toBe('test_type');
    expect(template.description).toBe('Test description');
    expect(template.priority).toBe(5);
    expect(template.usageCount).toBe(0);
    expect(template.successCount).toBe(0);
    expect(template.failureCount).toBe(0);
  });

  it('should instantiate template with function', () => {
    const templateFn = (task) => [
      { id: '1', name: 'subtask1', taskData: task.data }
    ];

    const template = new PlanTemplate({
      name: 'Function Template',
      type: 'test',
      subtaskTemplate: templateFn
    });

    const task = { id: 'task1', data: 'test data' };
    const subtasks = template.instantiate(task);

    expect(subtasks).toHaveLength(1);
    expect(subtasks[0].taskData).toBe('test data');
  });

  it('should instantiate template with array', () => {
    const subtaskArray = [
      { id: '1', name: 'subtask1' },
      { id: '2', name: 'subtask2' }
    ];

    const template = new PlanTemplate({
      name: 'Array Template',
      type: 'test',
      subtaskTemplate: subtaskArray
    });

    const task = { id: 'task1' };
    const subtasks = template.instantiate(task);

    expect(subtasks).toHaveLength(2);
    expect(subtasks[0].name).toBe('subtask1');
  });

  it('should calculate success rate correctly', () => {
    const template = new PlanTemplate({
      name: 'Test Template',
      type: 'test',
      subtaskTemplate: []
    });

    expect(template.successRate).toBe(0);

    template.recordUsage(true, 100);
    expect(template.successRate).toBe(1);

    template.recordUsage(false, 200);
    expect(template.successRate).toBe(0.5);

    template.recordUsage(true, 150);
    expect(template.successRate).toBeCloseTo(0.667, 2);
  });

  it('should calculate average execution time', () => {
    const template = new PlanTemplate({
      name: 'Test Template',
      type: 'test',
      subtaskTemplate: []
    });

    expect(template.avgExecutionTime).toBe(0);

    template.recordUsage(true, 100);
    expect(template.avgExecutionTime).toBe(100);

    template.recordUsage(true, 200);
    expect(template.avgExecutionTime).toBe(150);

    template.recordUsage(true, 300);
    expect(template.avgExecutionTime).toBe(200);
  });

  it('should track usage statistics', () => {
    const template = new PlanTemplate({
      name: 'Test Template',
      type: 'test',
      subtaskTemplate: []
    });

    template.recordUsage(true, 100);
    template.recordUsage(false, 200);
    template.recordUsage(true, 150);

    expect(template.usageCount).toBe(3);
    expect(template.successCount).toBe(2);
    expect(template.failureCount).toBe(1);
    expect(template.totalExecutionTime).toBe(450);
  });
});

describe('SimilarityCalculator', () => {
  it('should calculate cosine similarity for identical tasks', () => {
    const task1 = {
      type: 'test_type',
      priority: 5,
      requiredCapabilities: ['cap1', 'cap2'],
      payload: { data: 'test' }
    };

    const task2 = {
      type: 'test_type',
      priority: 5,
      requiredCapabilities: ['cap1', 'cap2'],
      payload: { data: 'test' }
    };

    const similarity = SimilarityCalculator.cosineSimilarity(task1, task2);
    expect(similarity).toBeCloseTo(1, 2);
  });

  it('should calculate cosine similarity for different tasks', () => {
    const task1 = {
      type: 'type1',
      priority: 5,
      requiredCapabilities: ['cap1'],
      payload: {}
    };

    const task2 = {
      type: 'type2',
      priority: 10,
      requiredCapabilities: ['cap2', 'cap3'],
      payload: { large: 'data'.repeat(1000) }
    };

    const similarity = SimilarityCalculator.cosineSimilarity(task1, task2);
    expect(similarity).toBeGreaterThanOrEqual(0);
    expect(similarity).toBeLessThanOrEqual(1);
  });

  it('should find most similar task from history', () => {
    const targetTask = {
      type: 'api_request',
      priority: 5,
      requiredCapabilities: ['http_client'],
      payload: {}
    };

    const history = [
      {
        task: {
          type: 'database_operation',
          priority: 3,
          requiredCapabilities: ['database'],
          payload: {}
        },
        plan: { id: 'plan1' }
      },
      {
        task: {
          type: 'api_request',
          priority: 5,
          requiredCapabilities: ['http_client'],
          payload: {}
        },
        plan: { id: 'plan2' }
      },
      {
        task: {
          type: 'file_processing',
          priority: 7,
          requiredCapabilities: ['file_parser'],
          payload: {}
        },
        plan: { id: 'plan3' }
      }
    ];

    const mostSimilar = SimilarityCalculator.findMostSimilar(targetTask, history);

    expect(mostSimilar).toBeDefined();
    expect(mostSimilar.plan.id).toBe('plan2');
    expect(mostSimilar.similarity).toBeGreaterThan(0.9);
  });

  it('should return null when history is empty', () => {
    const task = { type: 'test', priority: 5 };
    const mostSimilar = SimilarityCalculator.findMostSimilar(task, []);

    expect(mostSimilar).toBeNull();
  });

  it('should convert task to feature vector', () => {
    const task = {
      type: 'test_type',
      priority: 5,
      requiredCapabilities: ['cap1', 'cap2'],
      payload: { data: 'test' }
    };

    const vector = SimilarityCalculator.taskToVector(task);

    expect(Array.isArray(vector)).toBe(true);
    expect(vector.length).toBeGreaterThan(0);
    expect(vector.every(val => typeof val === 'number')).toBe(true);
  });
});

describe('PlanCacheService', () => {
  let service;

  beforeEach(() => {
    service = new PlanCacheService({
      maxHistorySize: 100,
      similarityThreshold: 0.85,
      cacheTTL: 60000 // 1 minute for testing
    });
  });

  describe('Initialization', () => {
    it('should initialize with default templates', () => {
      const stats = service.getStats();
      expect(stats.totalTemplates).toBeGreaterThan(0);
    });

    it('should initialize with correct configuration', () => {
      expect(service.similarityThreshold).toBe(0.85);
      expect(service.minTemplateSuccessRate).toBe(0.8);
    });
  });

  describe('Template Registration', () => {
    it('should register a new template', () => {
      const template = new PlanTemplate({
        name: 'Custom Template',
        type: 'custom_type',
        subtaskTemplate: []
      });

      service.registerTemplate(template);

      const templates = service.planTemplates.get('custom_type');
      expect(templates).toBeDefined();
      expect(templates).toHaveLength(1);
      expect(templates[0].name).toBe('Custom Template');
    });

    it('should sort templates by priority', () => {
      const template1 = new PlanTemplate({
        name: 'Low Priority',
        type: 'test_type',
        subtaskTemplate: [],
        priority: 3
      });

      const template2 = new PlanTemplate({
        name: 'High Priority',
        type: 'test_type',
        subtaskTemplate: [],
        priority: 10
      });

      service.registerTemplate(template1);
      service.registerTemplate(template2);

      const templates = service.planTemplates.get('test_type');
      expect(templates[0].name).toBe('High Priority');
      expect(templates[1].name).toBe('Low Priority');
    });

    it('should emit event when template is registered', async () => {
      const template = new PlanTemplate({
        name: 'Event Template',
        type: 'test',
        subtaskTemplate: []
      });

      const promise = new Promise((resolve) => {
        service.once('template:registered', ({ template: registeredTemplate }) => {
          expect(registeredTemplate.name).toBe('Event Template');
          resolve();
        });
      });

      service.registerTemplate(template);
      await promise;
    });
  });

  describe('getPlan - Exact Match', () => {
    it('should return plan from exact match cache', async () => {
      const task = {
        id: 'task1',
        type: 'api_request',
        requiredCapabilities: ['http_client']
      };

      // Cache a plan
      const plan = {
        id: 'plan1',
        taskId: task.id,
        subtasks: [{ id: 'st1', name: 'subtask1' }]
      };

      await service.cachePlan(task, plan, { success: true, executionTime: 100 });

      // Get plan (should hit exact match cache)
      const retrievedPlan = await service.getPlan(task);

      expect(retrievedPlan).toBeDefined();
      expect(retrievedPlan.method).toBe('reuse');
      expect(service.stats.exactMatches).toBe(1);
    });

    it('should not use exact match if success rate is too low', async () => {
      const task = {
        id: 'task1',
        type: 'api_request',
        requiredCapabilities: ['http_client']
      };

      const plan = {
        id: 'plan1',
        taskId: task.id,
        subtasks: []
      };

      // Cache with low success rate
      await service.cachePlan(task, plan, { success: false, executionTime: 100 });

      const task2 = {
        id: 'task2',
        type: 'api_request',
        requiredCapabilities: ['http_client']
      };

      const retrievedPlan = await service.getPlan(task2);

      // Should not use exact match (low success rate)
      expect(retrievedPlan.method).not.toBe('reuse');
    });
  });

  describe('getPlan - Similar Task', () => {
    it('should adapt plan from similar task', async () => {
      const originalTask = {
        id: 'task1',
        type: 'api_request',
        priority: 5,
        requiredCapabilities: ['http_client'],
        payload: { url: 'https://api.example.com' }
      };

      const originalPlan = {
        id: 'plan1',
        taskId: originalTask.id,
        subtasks: [
          { id: 'st1', name: 'validate_request' },
          { id: 'st2', name: 'make_api_call' }
        ]
      };

      await service.cachePlan(originalTask, originalPlan, {
        success: true,
        executionTime: 200
      });

      // Similar task
      const similarTask = {
        id: 'task2',
        type: 'api_request',
        priority: 5,
        requiredCapabilities: ['http_client'],
        payload: { url: 'https://api.other.com' }
      };

      const retrievedPlan = await service.getPlan(similarTask);

      expect(retrievedPlan).toBeDefined();
      expect(retrievedPlan.method).toBe('adapted');
      expect(service.stats.similarMatches).toBeGreaterThan(0);
    });
  });

  describe('getPlan - Template Instantiation', () => {
    it('should instantiate plan from template', async () => {
      const task = {
        id: 'task1',
        type: 'data_processing',
        requiredCapabilities: ['data_processing']
      };

      const plan = await service.getPlan(task);

      expect(plan).toBeDefined();
      expect(plan.method).toBe('template');
      expect(plan.templateId).toBeDefined();
      expect(plan.subtasks).toBeDefined();
      expect(service.stats.templateInstantiations).toBe(1);
    });

    it('should use template with best success rate', async () => {
      const goodTemplate = new PlanTemplate({
        name: 'Good Template',
        type: 'test_type',
        priority: 5,
        subtaskTemplate: [{ id: 'st1', name: 'good_subtask' }]
      });
      goodTemplate.recordUsage(true, 100);
      goodTemplate.recordUsage(true, 100);

      const badTemplate = new PlanTemplate({
        name: 'Bad Template',
        type: 'test_type',
        priority: 10,
        subtaskTemplate: [{ id: 'st1', name: 'bad_subtask' }]
      });
      badTemplate.recordUsage(false, 100);
      badTemplate.recordUsage(false, 100);

      service.registerTemplate(badTemplate);
      service.registerTemplate(goodTemplate);

      const task = {
        id: 'task1',
        type: 'test_type',
        requiredCapabilities: []
      };

      const plan = await service.getPlan(task);

      // Should use good template despite bad template having higher priority
      expect(plan.subtasks[0].name).toBe('good_subtask');
    });
  });

  describe('getPlan - New Plan Creation', () => {
    it('should create new plan when no match found', async () => {
      const task = {
        id: 'task1',
        type: 'unknown_type_xyz',
        requiredCapabilities: ['unknown_capability']
      };

      const plan = await service.getPlan(task);

      expect(plan).toBeDefined();
      expect(plan.method).toBe('new');
      expect(service.stats.newPlans).toBe(1);
    });

    it('should cache newly created plan', async () => {
      const task = {
        id: 'task1',
        type: 'unknown_type_xyz',
        requiredCapabilities: []
      };

      await service.getPlan(task);

      expect(service.executionHistory.has(task.id)).toBe(true);
    });
  });

  describe('cachePlan', () => {
    it('should cache plan with metadata', async () => {
      const task = {
        id: 'task1',
        type: 'test_type',
        priority: 5,
        requiredCapabilities: ['test_cap']
      };

      const plan = {
        id: 'plan1',
        taskId: task.id,
        subtasks: []
      };

      const result = {
        success: true,
        executionTime: 150
      };

      await service.cachePlan(task, plan, result);

      const history = service.executionHistory.get(task.id);
      expect(history).toBeDefined();
      expect(history.plan.successCount).toBe(1);
      expect(history.plan.totalExecutionTime).toBe(150);
    });

    it('should update template stats when caching', async () => {
      const template = new PlanTemplate({
        name: 'Test Template',
        type: 'test_type',
        subtaskTemplate: []
      });

      service.registerTemplate(template);

      const task = {
        id: 'task1',
        type: 'test_type',
        requiredCapabilities: []
      };

      const plan = await service.getPlan(task);

      await service.cachePlan(task, plan, {
        success: true,
        executionTime: 200
      });

      expect(template.usageCount).toBe(1);
      expect(template.successCount).toBe(1);
    });
  });

  describe('recordPlanResult', () => {
    it('should update plan statistics', async () => {
      const task = {
        id: 'task1',
        type: 'test_type',
        requiredCapabilities: []
      };

      const plan = {
        id: 'plan1',
        taskId: task.id,
        subtasks: []
      };

      await service.cachePlan(task, plan, { success: true, executionTime: 100 });

      service.recordPlanResult(task.id, {
        success: true,
        executionTime: 200
      });

      const history = service.executionHistory.get(task.id);
      expect(history.plan.usageCount).toBe(2);
      expect(history.plan.successCount).toBe(2);
      expect(history.plan.totalExecutionTime).toBe(300);
    });
  });

  describe('Performance Tracking', () => {
    it('should track retrieval statistics', async () => {
      const task1 = {
        id: 'task1',
        type: 'data_processing',
        requiredCapabilities: []
      };

      await service.getPlan(task1);

      const stats = service.getStats();
      expect(stats.totalGetPlanCalls).toBe(1);
      expect(stats.avgPlanRetrievalTime).toBeGreaterThan(0);
    });

    it('should calculate cache hit rate', async () => {
      // Template hit
      await service.getPlan({
        id: 'task1',
        type: 'data_processing',
        requiredCapabilities: []
      });

      // New plan
      await service.getPlan({
        id: 'task2',
        type: 'unknown_type',
        requiredCapabilities: []
      });

      const stats = service.getStats();
      expect(stats.cacheHitRate).toBeGreaterThan(0);
      expect(stats.cacheHitRate).toBeLessThanOrEqual(100);
    });

    it('should calculate performance gain', async () => {
      // Create multiple cache hits
      for (let i = 0; i < 5; i++) {
        await service.getPlan({
          id: `task${i}`,
          type: 'data_processing',
          requiredCapabilities: []
        });
      }

      const stats = service.getStats();
      expect(stats.performanceGain).toBeGreaterThan(0);
    });
  });

  describe('Statistics and Export', () => {
    it('should export comprehensive statistics', () => {
      const exported = service.exportStats();

      expect(exported.stats).toBeDefined();
      expect(exported.templates).toBeInstanceOf(Array);
      expect(exported.templates.length).toBeGreaterThan(0);
      expect(exported.historySize).toBeGreaterThanOrEqual(0);
    });

    it('should include template stats in export', () => {
      const exported = service.exportStats();

      expect(exported.templates[0]).toHaveProperty('id');
      expect(exported.templates[0]).toHaveProperty('name');
      expect(exported.templates[0]).toHaveProperty('type');
      expect(exported.templates[0]).toHaveProperty('usageCount');
      expect(exported.templates[0]).toHaveProperty('successRate');
    });
  });

  describe('Event Emission', () => {
    it('should emit plan:retrieved event', async () => {
      const promise = new Promise((resolve) => {
        service.once('plan:retrieved', ({ task, plan, method }) => {
          expect(task).toBeDefined();
          expect(plan).toBeDefined();
          expect(method).toBeDefined();
          resolve();
        });
      });

      service.getPlan({
        id: 'task1',
        type: 'data_processing',
        requiredCapabilities: []
      });

      await promise;
    });

    it('should emit plan:cached event', async () => {
      const promise = new Promise((resolve) => {
        service.once('plan:cached', ({ task, plan }) => {
          expect(task).toBeDefined();
          expect(plan).toBeDefined();
          resolve();
        });
      });

      const task = { id: 'task1', type: 'test', requiredCapabilities: [] };
      const plan = { id: 'plan1', taskId: task.id, subtasks: [] };

      service.cachePlan(task, plan);

      await promise;
    });

    it('should emit plan:created event for new plans', async () => {
      const promise = new Promise((resolve) => {
        service.once('plan:created', ({ task, plan }) => {
          expect(task).toBeDefined();
          expect(plan).toBeDefined();
          expect(plan.method).toBe('new');
          resolve();
        });
      });

      service.getPlan({
        id: 'task1',
        type: 'unknown_type_xyz123',
        requiredCapabilities: []
      });

      await promise;
    });
  });

  describe('Cache Management', () => {
    it('should clear all caches', async () => {
      await service.getPlan({
        id: 'task1',
        type: 'data_processing',
        requiredCapabilities: []
      });

      expect(service.executionHistory.size()).toBeGreaterThan(0);

      service.clearCaches();

      expect(service.executionHistory.size()).toBe(0);
    });

    it('should emit caches:cleared event', async () => {
      const promise = new Promise((resolve) => {
        service.once('caches:cleared', () => {
          resolve();
        });
      });

      service.clearCaches();

      await promise;
    });
  });

  describe('Shutdown', () => {
    it('should shutdown cleanly', () => {
      service.shutdown();

      expect(service.executionHistory.size()).toBe(0);
    });

    it('should remove all event listeners on shutdown', () => {
      const listener = vi.fn();
      service.on('plan:cached', listener);

      service.shutdown();

      service.emit('plan:cached', {});
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty task gracefully', async () => {
      const plan = await service.getPlan({});

      expect(plan).toBeDefined();
      expect(plan.subtasks).toBeDefined();
    });

    it('should handle task with missing fields', async () => {
      const plan = await service.getPlan({
        id: 'task1'
        // missing type, requiredCapabilities, etc.
      });

      expect(plan).toBeDefined();
    });

    it('should handle very large payload', async () => {
      const task = {
        id: 'task1',
        type: 'test_type',
        payload: {
          largeData: 'x'.repeat(100000)
        }
      };

      const plan = await service.getPlan(task);

      expect(plan).toBeDefined();
    });

    it('should not exceed history size limit', async () => {
      const maxSize = 100;
      const service2 = new PlanCacheService({ maxHistorySize: maxSize });

      // Add more than max size
      for (let i = 0; i < maxSize + 50; i++) {
        const task = {
          id: `task${i}`,
          type: 'test_type',
          requiredCapabilities: []
        };

        const plan = { id: `plan${i}`, taskId: task.id, subtasks: [] };
        await service2.cachePlan(task, plan);
      }

      expect(service2.executionHistory.size()).toBeLessThanOrEqual(maxSize);
    });
  });

  describe('10x Performance Requirement', () => {
    it('should achieve significant speedup for cached plans', async () => {
      const task = {
        id: 'task1',
        type: 'data_processing',
        requiredCapabilities: []
      };

      // First call (template instantiation - ~15ms)
      const start1 = Date.now();
      const plan1 = await service.getPlan(task);
      const time1 = Date.now() - start1;

      // Cache the plan
      await service.cachePlan(task, plan1, { success: true, executionTime: 100 });

      // Second call (exact match - should be ~5ms)
      const start2 = Date.now();
      await service.getPlan(task);
      const time2 = Date.now() - start2;

      // Second call should be significantly faster
      expect(time2).toBeLessThan(time1);

      const stats = service.getStats();
      expect(stats.avgPlanRetrievalTime).toBeLessThan(20); // Should be under 20ms average
    });

    it('should demonstrate 10x improvement in stats', async () => {
      // Simulate multiple cached plan retrievals
      for (let i = 0; i < 10; i++) {
        const task = {
          id: `task${i}`,
          type: 'data_processing',
          requiredCapabilities: []
        };

        const plan = await service.getPlan(task);
        await service.cachePlan(task, plan, { success: true, executionTime: 100 });
      }

      // Retrieve cached plans
      for (let i = 0; i < 10; i++) {
        await service.getPlan({
          id: `task${i}`,
          type: 'data_processing',
          requiredCapabilities: []
        });
      }

      const stats = service.getStats();

      // Performance gain should be significant
      expect(stats.performanceGain).toBeGreaterThan(50); // At least 50% improvement
      expect(stats.cacheHitRate).toBeGreaterThan(50); // Good cache hit rate
    });
  });
});
