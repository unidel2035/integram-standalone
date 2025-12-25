// ResourcePredictor.test.js - Unit tests for ResourcePredictor
import { describe, it, expect, beforeEach } from 'vitest';
import ResourcePredictor from '../ResourcePredictor.js';

describe('ResourcePredictor', () => {
  let predictor;

  beforeEach(() => {
    predictor = new ResourcePredictor();
  });

  describe('Basic Prediction', () => {
    it('should predict resources for simple task', () => {
      const task = {
        id: 't1',
        type: 'simple',
        payload: { data: 'test' }
      };

      const prediction = predictor.predict(task);

      expect(prediction).toBeDefined();
      expect(prediction.cpu).toBeGreaterThan(0);
      expect(prediction.memory).toBeGreaterThan(0);
      expect(prediction.tokens).toBeGreaterThan(0);
      expect(prediction.executionTime).toBeGreaterThan(0);
      expect(['low', 'medium', 'high']).toContain(prediction.io);
    });

    it('should have low confidence without history', () => {
      const task = { id: 't1', type: 'new_task_type' };
      const prediction = predictor.predict(task);

      expect(prediction.confidence).toBe(0.3);
    });
  });

  describe('Token Estimation', () => {
    it('should estimate tokens from payload', () => {
      const task = {
        id: 't1',
        type: 'chat',
        payload: { message: 'a'.repeat(1000) }, // 1000 characters
        description: 'Process message'
      };

      const prediction = predictor.predict(task);

      // Should estimate roughly 1000 * 0.25 = 250 tokens + overhead
      expect(prediction.tokens).toBeGreaterThan(200);
    });

    it('should add overhead for chat tasks', () => {
      const chatTask = {
        id: 't1',
        type: 'chat',
        payload: { message: 'Hello' }
      };

      const regularTask = {
        id: 't2',
        type: 'process',
        payload: { message: 'Hello' }
      };

      const chatPrediction = predictor.predict(chatTask);
      const regularPrediction = predictor.predict(regularTask);

      // Chat should have higher token estimate
      expect(chatPrediction.tokens).toBeGreaterThan(regularPrediction.tokens);
    });
  });

  describe('Complexity Factor', () => {
    it('should scale with multiple capabilities', () => {
      const simpleTask = {
        id: 't1',
        type: 'simple',
        requiredCapabilities: ['basic']
      };

      const complexTask = {
        id: 't2',
        type: 'complex',
        requiredCapabilities: ['nlp', 'vision', 'reasoning']
      };

      const simplePred = predictor.predict(simpleTask);
      const complexPred = predictor.predict(complexTask);

      expect(complexPred.cpu).toBeGreaterThan(simplePred.cpu);
      expect(complexPred.memory).toBeGreaterThan(simplePred.memory);
    });

    it('should scale with priority', () => {
      const normalTask = { id: 't1', type: 'task', priority: 3 };
      const highPriorityTask = { id: 't2', type: 'task', priority: 9 };

      const normalPred = predictor.predict(normalTask);
      const highPred = predictor.predict(highPriorityTask);

      expect(highPred.cpu).toBeGreaterThan(normalPred.cpu);
    });

    it('should scale with payload size', () => {
      const smallTask = {
        id: 't1',
        type: 'task',
        payload: { data: 'small' }
      };

      const largeTask = {
        id: 't2',
        type: 'task',
        payload: { data: 'x'.repeat(15000) }
      };

      const smallPred = predictor.predict(smallTask);
      const largePred = predictor.predict(largeTask);

      expect(largePred.cpu).toBeGreaterThan(smallPred.cpu);
      expect(largePred.memory).toBeGreaterThan(smallPred.memory);
    });
  });

  describe('I/O Level Estimation', () => {
    it('should identify high I/O tasks', () => {
      const tasks = [
        { id: 't1', type: 'file_download' },
        { id: 't2', type: 'storage_upload' },
        { id: 't3', type: 'file_processing' }
      ];

      tasks.forEach(task => {
        const prediction = predictor.predict(task);
        expect(prediction.io).toBe('high');
      });
    });

    it('should identify medium I/O tasks', () => {
      const tasks = [
        { id: 't1', type: 'database_query' },
        { id: 't2', type: 'search_index' }
      ];

      tasks.forEach(task => {
        const prediction = predictor.predict(task);
        expect(prediction.io).toBe('medium');
      });
    });

    it('should default to low I/O', () => {
      const task = { id: 't1', type: 'calculation' };
      const prediction = predictor.predict(task);

      expect(prediction.io).toBe('low');
    });
  });

  describe('Historical Learning', () => {
    it('should learn from actual usage', () => {
      const taskType = 'test_task';

      // Record actual usage
      predictor.recordActualUsage(taskType, {
        cpu: 0.8,
        memory: 200 * 1024 * 1024,
        tokens: 2000,
        executionTime: 10000
      });

      // Predict for same task type
      const task = { id: 't1', type: taskType };
      const prediction = predictor.predict(task);

      // Should use historical data
      expect(prediction.confidence).toBeGreaterThan(0.3);
      expect(prediction.cpu).toBeCloseTo(0.8, 1);
    });

    it('should improve confidence with more data', () => {
      const taskType = 'test_task';

      // Record multiple executions
      for (let i = 0; i < 20; i++) {
        predictor.recordActualUsage(taskType, {
          cpu: 0.5,
          memory: 100 * 1024 * 1024,
          tokens: 1000,
          executionTime: 5000
        });
      }

      const task = { id: 't1', type: taskType };
      const prediction = predictor.predict(task);

      // Should have high confidence with 20 samples
      expect(prediction.confidence).toBe(1.0);
    });

    it('should limit history size', () => {
      const taskType = 'test_task';
      const maxSize = predictor.maxHistorySize;

      // Record more than max
      for (let i = 0; i < maxSize + 50; i++) {
        predictor.recordActualUsage(taskType, {
          cpu: 0.5,
          memory: 100 * 1024 * 1024,
          tokens: 1000,
          executionTime: 5000
        });
      }

      const history = predictor.taskHistory.get(taskType);
      expect(history.length).toBe(maxSize);
    });
  });

  describe('Statistics', () => {
    it('should calculate accuracy stats', () => {
      const taskType = 'test_task';

      // Record some history
      for (let i = 0; i < 10; i++) {
        predictor.recordActualUsage(taskType, {
          cpu: 0.5,
          memory: 100 * 1024 * 1024,
          tokens: 1000,
          executionTime: 5000 + Math.random() * 1000
        });
      }

      const stats = predictor.getAccuracyStats(taskType);

      expect(stats).toBeDefined();
      expect(stats.sampleSize).toBe(10);
      expect(stats.avgError).toBeGreaterThanOrEqual(0);
      expect(stats.accuracy).toBeGreaterThanOrEqual(0);
      expect(stats.accuracy).toBeLessThanOrEqual(1);
    });

    it('should return null for unknown task types', () => {
      const stats = predictor.getAccuracyStats('unknown_type');
      expect(stats).toBeNull();
    });

    it('should get stats for all task types', () => {
      predictor.recordActualUsage('type1', {
        cpu: 0.5,
        memory: 100 * 1024 * 1024,
        tokens: 1000,
        executionTime: 5000
      });

      predictor.recordActualUsage('type2', {
        cpu: 0.7,
        memory: 150 * 1024 * 1024,
        tokens: 1500,
        executionTime: 7000
      });

      const allStats = predictor.getAllStats();

      expect(allStats.type1).toBeDefined();
      expect(allStats.type2).toBeDefined();
      expect(allStats.type1.historySize).toBe(1);
      expect(allStats.type2.historySize).toBe(1);
    });
  });

  describe('History Management', () => {
    it('should clear history for specific task type', () => {
      predictor.recordActualUsage('type1', {
        cpu: 0.5,
        memory: 100 * 1024 * 1024,
        tokens: 1000,
        executionTime: 5000
      });

      predictor.recordActualUsage('type2', {
        cpu: 0.7,
        memory: 150 * 1024 * 1024,
        tokens: 1500,
        executionTime: 7000
      });

      predictor.clearHistory('type1');

      expect(predictor.taskHistory.has('type1')).toBe(false);
      expect(predictor.taskHistory.has('type2')).toBe(true);
    });

    it('should clear all history', () => {
      predictor.recordActualUsage('type1', {
        cpu: 0.5,
        memory: 100 * 1024 * 1024,
        tokens: 1000,
        executionTime: 5000
      });

      predictor.recordActualUsage('type2', {
        cpu: 0.7,
        memory: 150 * 1024 * 1024,
        tokens: 1500,
        executionTime: 7000
      });

      predictor.clearHistory();

      expect(predictor.taskHistory.size).toBe(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle tasks without type', () => {
      const task = { id: 't1', payload: { data: 'test' } };
      const prediction = predictor.predict(task);

      expect(prediction).toBeDefined();
      expect(prediction.cpu).toBeGreaterThan(0);
    });

    it('should handle tasks without payload', () => {
      const task = { id: 't1', type: 'simple' };
      const prediction = predictor.predict(task);

      expect(prediction).toBeDefined();
      expect(prediction.tokens).toBeGreaterThan(0);
    });

    it('should cap complexity factor', () => {
      const task = {
        id: 't1',
        type: 'llm_ai_analyze_process',
        priority: 10,
        requiredCapabilities: ['a', 'b', 'c', 'd', 'e'],
        payload: { data: 'x'.repeat(20000) }
      };

      const prediction = predictor.predict(task);

      // Should cap at reasonable values
      expect(prediction.cpu).toBeLessThanOrEqual(1.0);
    });
  });
});
