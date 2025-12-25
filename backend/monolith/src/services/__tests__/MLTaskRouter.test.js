// MLTaskRouter.test.js - Unit tests for ML-based task routing
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  AgentPerformanceTracker,
  SimpleTaskRoutingModel,
  MLTaskRouter
} from '../MLTaskRouter.js';
import { AgentManager, TaskPriority, LoadBalancingStrategy } from '../AgentManager.js';
import { AgentRegistry, AgentStatus, AgentCapabilities } from '../../core/AgentRegistry.js';

describe('AgentPerformanceTracker', () => {
  let tracker;

  beforeEach(() => {
    tracker = new AgentPerformanceTracker();
  });

  describe('recordTaskResult', () => {
    it('should record successful task result', () => {
      tracker.recordTaskResult('agent-1', 'task-1', {
        success: true,
        executionTime: 1000,
        taskType: 'data-processing'
      });

      const perf = tracker.getAgentPerformance('agent-1');

      expect(perf.totalTasks).toBe(1);
      expect(perf.successRate).toBe(1.0);
      expect(perf.avgExecutionTime).toBe(1000);
    });

    it('should record failed task result', () => {
      tracker.recordTaskResult('agent-1', 'task-1', {
        success: false,
        executionTime: 500,
        taskType: 'data-processing'
      });

      const perf = tracker.getAgentPerformance('agent-1');

      expect(perf.totalTasks).toBe(1);
      expect(perf.successRate).toBe(0.0);
      expect(perf.avgExecutionTime).toBe(500);
    });

    it('should track performance by task type', () => {
      tracker.recordTaskResult('agent-1', 'task-1', {
        success: true,
        executionTime: 1000,
        taskType: 'type-a'
      });

      tracker.recordTaskResult('agent-1', 'task-2', {
        success: true,
        executionTime: 2000,
        taskType: 'type-b'
      });

      const perf = tracker.getAgentPerformance('agent-1');

      expect(perf.taskTypeStats['type-a']).toBeDefined();
      expect(perf.taskTypeStats['type-a'].total).toBe(1);
      expect(perf.taskTypeStats['type-a'].successful).toBe(1);

      expect(perf.taskTypeStats['type-b']).toBeDefined();
      expect(perf.taskTypeStats['type-b'].total).toBe(1);
    });

    it('should maintain recent results sliding window', () => {
      // Record 150 results (max is 100)
      for (let i = 0; i < 150; i++) {
        tracker.recordTaskResult('agent-1', `task-${i}`, {
          success: i % 2 === 0, // Alternating success/failure
          executionTime: 1000,
          taskType: 'test'
        });
      }

      const perf = tracker.performance.get('agent-1');
      expect(perf.recentResults.length).toBe(100); // Should cap at maxRecentResults
    });
  });

  describe('calculateSpecializationScore', () => {
    it('should return 0 for agents with one task type', () => {
      tracker.recordTaskResult('agent-1', 'task-1', {
        success: true,
        executionTime: 1000,
        taskType: 'type-a'
      });

      const perf = tracker.getAgentPerformance('agent-1');
      expect(perf.specializationScore).toBe(0);
    });

    it('should calculate higher score for specialized agents', () => {
      // Agent good at type-a (100% success)
      for (let i = 0; i < 10; i++) {
        tracker.recordTaskResult('agent-1', `task-a-${i}`, {
          success: true,
          executionTime: 1000,
          taskType: 'type-a'
        });
      }

      // Agent bad at type-b (0% success)
      for (let i = 0; i < 10; i++) {
        tracker.recordTaskResult('agent-1', `task-b-${i}`, {
          success: false,
          executionTime: 1000,
          taskType: 'type-b'
        });
      }

      const perf = tracker.getAgentPerformance('agent-1');
      expect(perf.specializationScore).toBeGreaterThan(0);
    });
  });

  describe('getPerformanceForTaskType', () => {
    it('should return task-type-specific performance', () => {
      tracker.recordTaskResult('agent-1', 'task-1', {
        success: true,
        executionTime: 1000,
        taskType: 'type-a'
      });

      tracker.recordTaskResult('agent-1', 'task-2', {
        success: false,
        executionTime: 2000,
        taskType: 'type-a'
      });

      const typePerf = tracker.getPerformanceForTaskType('agent-1', 'type-a');

      expect(typePerf).toBeDefined();
      expect(typePerf.totalTasks).toBe(2);
      expect(typePerf.successRate).toBe(0.5);
    });

    it('should return null for unknown task type', () => {
      const typePerf = tracker.getPerformanceForTaskType('agent-1', 'unknown-type');
      expect(typePerf).toBeNull();
    });
  });

  describe('updateCurrentLoad', () => {
    it('should update agent current load', () => {
      tracker.updateCurrentLoad('agent-1', 0.7);

      const perf = tracker.getAgentPerformance('agent-1');
      expect(perf.currentLoad).toBe(0.7);
    });
  });

  describe('resetAgentPerformance', () => {
    it('should reset specific agent performance', () => {
      tracker.recordTaskResult('agent-1', 'task-1', {
        success: true,
        executionTime: 1000,
        taskType: 'test'
      });

      tracker.resetAgentPerformance('agent-1');

      const perf = tracker.getAgentPerformance('agent-1');
      expect(perf.totalTasks).toBe(0);
    });
  });

  describe('clearAll', () => {
    it('should clear all performance data', () => {
      tracker.recordTaskResult('agent-1', 'task-1', {
        success: true,
        executionTime: 1000,
        taskType: 'test'
      });

      tracker.clearAll();

      expect(tracker.performance.size).toBe(0);
    });
  });
});

describe('SimpleTaskRoutingModel', () => {
  let model;

  beforeEach(() => {
    model = new SimpleTaskRoutingModel();
  });

  describe('predict', () => {
    it('should predict high score for good agent', async () => {
      const features = {
        successRate: 0.95,
        avgExecutionTime: 1000,
        currentLoad: 0.1,
        specializationScore: 50
      };

      const score = await model.predict(features);

      expect(score).toBeGreaterThan(0.7);
      expect(score).toBeLessThanOrEqual(1.0);
    });

    it('should predict low score for poor agent', async () => {
      const features = {
        successRate: 0.2,
        avgExecutionTime: 25000,
        currentLoad: 0.9,
        specializationScore: 10
      };

      const score = await model.predict(features);

      expect(score).toBeLessThan(0.5);
      expect(score).toBeGreaterThanOrEqual(0.0);
    });

    it('should handle missing features with defaults', async () => {
      const features = {};

      const score = await model.predict(features);

      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThan(1);
    });
  });

  describe('normalize', () => {
    it('should normalize features to [0, 1] range', () => {
      const features = {
        successRate: 0.8,
        avgExecutionTime: 15000,
        currentLoad: 0.5,
        specializationScore: 75
      };

      const normalized = model.normalize(features);

      expect(normalized.successRate).toBeGreaterThanOrEqual(0);
      expect(normalized.successRate).toBeLessThanOrEqual(1);
      expect(normalized.avgExecutionTime).toBeGreaterThanOrEqual(0);
      expect(normalized.avgExecutionTime).toBeLessThanOrEqual(1);
      expect(normalized.currentLoad).toBeGreaterThanOrEqual(0);
      expect(normalized.currentLoad).toBeLessThanOrEqual(1);
      expect(normalized.specializationScore).toBeGreaterThanOrEqual(0);
      expect(normalized.specializationScore).toBeLessThanOrEqual(1);
    });
  });

  describe('retrain', () => {
    it('should retrain model with training data', async () => {
      const trainingData = [
        {
          features: {
            successRate: 0.9,
            avgExecutionTime: 2000,
            currentLoad: 0.2,
            specializationScore: 40
          },
          actualScore: 0.85
        },
        {
          features: {
            successRate: 0.5,
            avgExecutionTime: 10000,
            currentLoad: 0.8,
            specializationScore: 20
          },
          actualScore: 0.3
        }
      ];

      const weightsBefore = { ...model.getWeights() };

      await model.retrain(trainingData);

      const weightsAfter = model.getWeights();

      // Weights should have changed
      const weightsChanged = Object.keys(weightsBefore).some(
        key => weightsBefore[key] !== weightsAfter[key]
      );
      expect(weightsChanged).toBe(true);

      // Weights should sum to approximately 1
      const weightSum = Object.values(weightsAfter).reduce((a, b) => a + b, 0);
      expect(weightSum).toBeCloseTo(1.0, 2);
    });

    it('should handle empty training data', async () => {
      await expect(model.retrain([])).resolves.not.toThrow();
    });
  });

  describe('getWeights and setWeights', () => {
    it('should get and set model weights', () => {
      const newWeights = {
        successRate: 0.5,
        avgExecutionTime: 0.3,
        currentLoad: 0.1,
        specializationScore: 0.1
      };

      model.setWeights(newWeights);

      const weights = model.getWeights();
      expect(weights).toEqual(newWeights);
    });
  });
});

describe('MLTaskRouter', () => {
  let router;
  let agentManager;
  let registry;

  beforeEach(() => {
    registry = new AgentRegistry();
    agentManager = new AgentManager({
      registry,
      loadBalancingStrategy: LoadBalancingStrategy.LEAST_LOADED
    });

    router = new MLTaskRouter({
      agentManager,
      enableLearning: true,
      retrainThreshold: 10
    });

    // Register test agents
    agentManager.registerAgent({
      id: 'agent-1',
      name: 'Test Agent 1',
      capabilities: [AgentCapabilities.GENERIC, 'data-processing']
    });

    agentManager.registerAgent({
      id: 'agent-2',
      name: 'Test Agent 2',
      capabilities: [AgentCapabilities.GENERIC, 'data-processing']
    });
  });

  afterEach(() => {
    if (router) {
      router.shutdown();
    }
    if (agentManager) {
      agentManager.shutdown();
    }
  });

  describe('route', () => {
    it('should route task to best agent', async () => {
      // Give agent-1 better performance history
      for (let i = 0; i < 5; i++) {
        router.performanceTracker.recordTaskResult('agent-1', `task-${i}`, {
          success: true,
          executionTime: 1000,
          taskType: 'data-processing'
        });
      }

      for (let i = 0; i < 5; i++) {
        router.performanceTracker.recordTaskResult('agent-2', `task-${i}`, {
          success: false,
          executionTime: 5000,
          taskType: 'data-processing'
        });
      }

      const task = {
        id: 'task-new',
        type: 'data-processing',
        requiredCapabilities: ['data-processing'],
        priority: TaskPriority.NORMAL,
        payload: {}
      };

      const selectedAgent = await router.route(task);

      // Should select agent-1 (better performance)
      expect(selectedAgent.id).toBe('agent-1');
    });

    it('should fall back to traditional strategy if ML fails', async () => {
      // Mock ML prediction to fail
      vi.spyOn(router, 'rankAgents').mockRejectedValueOnce(new Error('ML prediction failed'));

      const task = {
        id: 'task-new',
        type: 'data-processing',
        requiredCapabilities: ['data-processing'],
        priority: TaskPriority.NORMAL,
        payload: {}
      };

      const selectedAgent = await router.route(task);

      // Should still select an agent via fallback
      expect(selectedAgent).toBeDefined();
      expect(['agent-1', 'agent-2']).toContain(selectedAgent.id);
    });

    it('should throw error if no capable agents', async () => {
      const task = {
        id: 'task-new',
        type: 'unknown-task',
        requiredCapabilities: ['non-existent-capability'],
        priority: TaskPriority.NORMAL,
        payload: {}
      };

      await expect(router.route(task)).rejects.toThrow('No capable agents found');
    });
  });

  describe('extractTaskFeatures', () => {
    it('should extract task features correctly', () => {
      const task = {
        id: 'task-1',
        type: 'data-processing',
        priority: TaskPriority.HIGH,
        requiredCapabilities: ['data-processing', 'analytics'],
        payload: { dataSize: 1000 }
      };

      const features = router.extractTaskFeatures(task);

      expect(features).toHaveProperty('type');
      expect(features).toHaveProperty('priority');
      expect(features).toHaveProperty('complexity');
      expect(features).toHaveProperty('timeOfDay');
      expect(features).toHaveProperty('dayOfWeek');
      expect(features.type).toBe('data-processing');
      expect(features.priority).toBe(TaskPriority.HIGH);
    });
  });

  describe('learning', () => {
    it('should learn from completed tasks', async () => {
      const task = agentManager.createTask({
        type: 'data-processing',
        requiredCapabilities: ['data-processing'],
        priority: TaskPriority.NORMAL
      });

      // Route task and track prediction
      await router.route(task);

      expect(router.predictions.has(task.id)).toBe(true);

      // Simulate task completion
      task.startedAt = new Date();
      task.completedAt = new Date(Date.now() + 1000);

      const agent = agentManager.registry.getAgent('agent-1');
      router._handleTaskCompleted(task, agent, { success: true }, true);

      // Should have training data
      expect(router.trainingData.length).toBeGreaterThan(0);

      // Prediction should be removed after learning
      expect(router.predictions.has(task.id)).toBe(false);
    });

    it('should trigger retraining after threshold', async () => {
      const retrainSpy = vi.spyOn(router, '_retrainModel').mockResolvedValue();

      // Simulate enough tasks to trigger retraining
      for (let i = 0; i < 15; i++) {
        const task = {
          id: `task-${i}`,
          type: 'data-processing',
          startedAt: new Date(),
          completedAt: new Date(Date.now() + 1000)
        };

        router.predictions.set(task.id, {
          agentId: 'agent-1',
          features: {},
          timestamp: Date.now()
        });

        const agent = agentManager.registry.getAgent('agent-1');
        router._handleTaskCompleted(task, agent, { success: true }, true);
      }

      // Should have called retraining
      expect(retrainSpy).toHaveBeenCalled();
    });
  });

  describe('A/B testing', () => {
    it('should use fallback strategy based on probability', async () => {
      router.setABTesting(true, 0.0); // Always use fallback

      const fallbackSpy = vi.spyOn(router, 'fallbackRoute');

      const task = {
        id: 'task-new',
        type: 'data-processing',
        requiredCapabilities: ['data-processing'],
        priority: TaskPriority.NORMAL,
        payload: {}
      };

      await router.route(task);

      expect(fallbackSpy).toHaveBeenCalled();
    });
  });

  describe('getStats', () => {
    it('should return router statistics', () => {
      const stats = router.getStats();

      expect(stats).toHaveProperty('performanceTracking');
      expect(stats).toHaveProperty('learning');
      expect(stats).toHaveProperty('model');
      expect(stats).toHaveProperty('abTesting');
      expect(stats).toHaveProperty('predictions');

      expect(stats.learning.enabled).toBe(true);
      expect(stats.learning.retrainThreshold).toBe(10);
    });
  });

  describe('manualRetrain', () => {
    it('should manually trigger retraining', async () => {
      // Add some training data
      router.trainingData.push({
        features: { successRate: 0.9, avgExecutionTime: 1000, currentLoad: 0.2, specializationScore: 40 },
        actualScore: 0.85
      });

      await expect(router.manualRetrain()).resolves.not.toThrow();
    });

    it('should fail if no training data', async () => {
      await expect(router.manualRetrain()).rejects.toThrow('No training data available');
    });
  });

  describe('resetLearning', () => {
    it('should reset all learning data', () => {
      router.trainingData.push({ features: {}, actualScore: 0.5 });
      router.tasksSinceRetrain = 50;
      router.predictions.set('task-1', { agentId: 'agent-1', features: {}, timestamp: Date.now() });

      router.resetLearning();

      expect(router.trainingData.length).toBe(0);
      expect(router.tasksSinceRetrain).toBe(0);
      expect(router.predictions.size).toBe(0);
    });
  });

  describe('exportPerformanceData', () => {
    it('should export all performance data', () => {
      router.performanceTracker.recordTaskResult('agent-1', 'task-1', {
        success: true,
        executionTime: 1000,
        taskType: 'test'
      });

      const exportData = router.exportPerformanceData();

      expect(exportData).toHaveProperty('agentPerformance');
      expect(exportData).toHaveProperty('trainingData');
      expect(exportData).toHaveProperty('modelWeights');
      expect(exportData).toHaveProperty('stats');
    });
  });
});
