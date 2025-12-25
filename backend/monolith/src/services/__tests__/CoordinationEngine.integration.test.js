// CoordinationEngine.integration.test.js - Integration tests for CoordinationEngine
// Tests multi-agent workflows with real AgentManager and MessageBus

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  CoordinationEngine,
  TaskDecomposer,
  CoordinatedTaskStatus
} from '../CoordinationEngine.js';
import { AgentManager } from '../AgentManager.js';
import { MessageBus } from '../MessageBus.js';
import EventEmitter from 'events';

// Mock BaseAgent for testing
class MockAgent extends EventEmitter {
  constructor(id, capabilities) {
    super();
    this.id = id;
    this.capabilities = capabilities;
    this.status = 'idle';
  }

  async executeTask(task) {
    this.status = 'busy';
    this.emit('task:started', task);

    // Simulate work
    await new Promise(resolve => setTimeout(resolve, 10));

    const result = {
      success: true,
      data: `Result from ${this.id} for ${task.type}`
    };

    this.emit('task:completed', { task, result });
    this.status = 'idle';

    return result;
  }

  async compensate(action) {
    // Simulate compensation
    await new Promise(resolve => setTimeout(resolve, 5));
    return { compensated: true, action };
  }
}

// Sales Report Task Decomposer
class SalesReportDecomposer extends TaskDecomposer {
  async decompose(task) {
    const { startDate, endDate } = task.parameters;

    return [
      {
        id: 'fetch-sales-data',
        type: 'fetch_data',
        requiredCapability: 'data_fetching',
        dependencies: [],
        parameters: { startDate, endDate, dataType: 'sales' },
        compensationAction: 'delete_cached_data'
      },
      {
        id: 'analyze-trends',
        type: 'analyze_trends',
        requiredCapability: 'data_analysis',
        dependencies: ['fetch-sales-data'],
        parameters: { analysisType: 'trends' },
        compensationAction: 'clear_analysis_cache'
      },
      {
        id: 'generate-pdf',
        type: 'generate_pdf',
        requiredCapability: 'report_generation',
        dependencies: ['analyze-trends'],
        parameters: { format: 'pdf' },
        compensationAction: 'delete_report_file'
      },
      {
        id: 'send-notification',
        type: 'send_email',
        requiredCapability: 'notification_sending',
        dependencies: ['generate-pdf'],
        parameters: { recipient: 'manager@example.com' },
        compensationAction: null // No compensation for notification
      }
    ];
  }
}

// Complex Multi-Branch Decomposer
class ComplexAnalysisDecomposer extends TaskDecomposer {
  async decompose(task) {
    return [
      // Parallel data fetching
      {
        id: 'fetch-sales',
        type: 'fetch_data',
        requiredCapability: 'data_fetching',
        dependencies: [],
        parameters: { dataType: 'sales' },
        compensationAction: 'delete_sales_cache'
      },
      {
        id: 'fetch-inventory',
        type: 'fetch_data',
        requiredCapability: 'data_fetching',
        dependencies: [],
        parameters: { dataType: 'inventory' },
        compensationAction: 'delete_inventory_cache'
      },
      {
        id: 'fetch-customers',
        type: 'fetch_data',
        requiredCapability: 'data_fetching',
        dependencies: [],
        parameters: { dataType: 'customers' },
        compensationAction: 'delete_customers_cache'
      },
      // Parallel analysis
      {
        id: 'analyze-sales',
        type: 'analyze_data',
        requiredCapability: 'data_analysis',
        dependencies: ['fetch-sales'],
        parameters: { analysisType: 'sales' },
        compensationAction: null
      },
      {
        id: 'analyze-inventory',
        type: 'analyze_data',
        requiredCapability: 'data_analysis',
        dependencies: ['fetch-inventory'],
        parameters: { analysisType: 'inventory' },
        compensationAction: null
      },
      {
        id: 'analyze-customers',
        type: 'analyze_data',
        requiredCapability: 'data_analysis',
        dependencies: ['fetch-customers'],
        parameters: { analysisType: 'customers' },
        compensationAction: null
      },
      // Merge analysis
      {
        id: 'merge-analysis',
        type: 'merge_data',
        requiredCapability: 'data_analysis',
        dependencies: ['analyze-sales', 'analyze-inventory', 'analyze-customers'],
        parameters: { mergeType: 'comprehensive' },
        compensationAction: null
      },
      // Generate report
      {
        id: 'generate-report',
        type: 'generate_report',
        requiredCapability: 'report_generation',
        dependencies: ['merge-analysis'],
        parameters: { format: 'pdf' },
        compensationAction: 'delete_report'
      }
    ];
  }
}

describe('CoordinationEngine Integration Tests', () => {
  let coordinationEngine;
  let agentManager;
  let messageBus;
  let agents;

  beforeAll(() => {
    // Create real instances
    agentManager = new AgentManager({
      maxTasks: 100,
      taskAssignmentInterval: 100
    });

    messageBus = new MessageBus({
      maxMessages: 1000,
      messageRetryAttempts: 3
    });

    // Create mock agents with different capabilities
    agents = [
      new MockAgent('data-fetcher-1', ['data_fetching']),
      new MockAgent('data-fetcher-2', ['data_fetching']),
      new MockAgent('analyzer-1', ['data_analysis']),
      new MockAgent('analyzer-2', ['data_analysis']),
      new MockAgent('report-generator-1', ['report_generation']),
      new MockAgent('notifier-1', ['notification_sending'])
    ];

    // Register agents with agent manager
    agents.forEach(agent => {
      agentManager.registerAgent({
        id: agent.id,
        name: agent.id,
        capabilities: agent.capabilities,
        status: 'idle'
      }, agent);
    });

    // Set up message handling
    messageBus.on('message:received', async ({ fromAgent, toAgent, message }) => {
      const agent = agents.find(a => a.id === toAgent);
      if (!agent) return;

      if (message.type === 'execute_subtask') {
        try {
          const result = await agent.executeTask(message.subtask);
          messageBus.emit('message:response', {
            messageId: message.messageId,
            result
          });
        } catch (error) {
          messageBus.emit('message:error', {
            messageId: message.messageId,
            error: error.message
          });
        }
      } else if (message.type === 'compensate') {
        try {
          const result = await agent.compensate(message.action);
          messageBus.emit('message:response', {
            messageId: message.messageId,
            result
          });
        } catch (error) {
          messageBus.emit('message:error', {
            messageId: message.messageId,
            error: error.message
          });
        }
      }
    });

    // Create coordination engine
    coordinationEngine = new CoordinationEngine({
      agentManager,
      messageBus,
      maxActiveTasks: 100,
      subtaskTimeout: 10000
    });
  });

  afterAll(async () => {
    await coordinationEngine.shutdown();
  });

  describe('Simple Linear Workflow', () => {
    beforeEach(() => {
      coordinationEngine.registerDecomposer('generate_sales_report', new SalesReportDecomposer());
    });

    it('should execute simple sales report workflow', async () => {
      const task = {
        id: 'report-task-1',
        type: 'generate_sales_report',
        parameters: {
          startDate: '2025-01-01',
          endDate: '2025-01-31'
        }
      };

      // Decompose
      const decomposed = await coordinationEngine.decomposeTask(task);
      expect(decomposed.subtasks).toHaveLength(4);

      // Build plan
      const plan = coordinationEngine.buildExecutionPlan(
        decomposed.subtasks,
        decomposed.graph
      );
      expect(plan.levels).toHaveLength(4); // Linear: 4 levels

      // Execute
      const results = await coordinationEngine.executeCoordinated(task.id, plan);

      expect(results.size).toBe(4);
      expect(results.has('fetch-sales-data')).toBe(true);
      expect(results.has('analyze-trends')).toBe(true);
      expect(results.has('generate-pdf')).toBe(true);
      expect(results.has('send-notification')).toBe(true);

      // Verify all results are successful
      for (const [subtaskId, result] of results.entries()) {
        expect(result.success).toBe(true);
      }
    }, 15000);

    it('should track task progress during execution', async () => {
      const task = {
        id: 'report-task-2',
        type: 'generate_sales_report',
        parameters: {
          startDate: '2025-01-01',
          endDate: '2025-01-31'
        }
      };

      const decomposed = await coordinationEngine.decomposeTask(task);
      const plan = coordinationEngine.buildExecutionPlan(
        decomposed.subtasks,
        decomposed.graph
      );

      // Start execution (don't await immediately)
      const executionPromise = coordinationEngine.executeCoordinated(task.id, plan);

      // Check status while running
      await new Promise(resolve => setTimeout(resolve, 20));

      const status = coordinationEngine.getTaskStatus(task.id);
      expect(status).toBeDefined();
      expect(status.status).toBe(CoordinatedTaskStatus.RUNNING);
      expect(status.totalSubtasks).toBe(4);

      await executionPromise;

      const finalStatus = coordinationEngine.getTaskStatus(task.id);
      expect(finalStatus.status).toBe(CoordinatedTaskStatus.COMPLETED);
      expect(finalStatus.completedSubtasks).toBe(4);
    }, 15000);
  });

  describe('Complex Parallel Workflow', () => {
    beforeEach(() => {
      coordinationEngine.registerDecomposer('complex_analysis', new ComplexAnalysisDecomposer());
    });

    it('should execute complex workflow with parallel branches', async () => {
      const task = {
        id: 'complex-task-1',
        type: 'complex_analysis',
        parameters: {}
      };

      // Decompose
      const decomposed = await coordinationEngine.decomposeTask(task);
      expect(decomposed.subtasks).toHaveLength(8);

      // Build plan
      const plan = coordinationEngine.buildExecutionPlan(
        decomposed.subtasks,
        decomposed.graph
      );

      // Should have 4 levels:
      // Level 0: 3 parallel data fetches
      // Level 1: 3 parallel analyses
      // Level 2: merge
      // Level 3: report
      expect(plan.levels).toHaveLength(4);
      expect(plan.levels[0]).toHaveLength(3); // Parallel fetches
      expect(plan.levels[1]).toHaveLength(3); // Parallel analyses

      // Execute
      const startTime = Date.now();
      const results = await coordinationEngine.executeCoordinated(task.id, plan);
      const duration = Date.now() - startTime;

      expect(results.size).toBe(8);

      // Due to parallelism, should complete faster than sequential
      // Sequential would take ~80ms (8 tasks * 10ms each)
      // Parallel should take ~40ms (4 levels * 10ms each)
      expect(duration).toBeLessThan(100); // Give some buffer

      // Verify all results
      for (const [subtaskId, result] of results.entries()) {
        expect(result.success).toBe(true);
      }
    }, 15000);

    it('should correctly handle dependencies in parallel workflow', async () => {
      const task = {
        id: 'complex-task-2',
        type: 'complex_analysis',
        parameters: {}
      };

      const events = [];
      coordinationEngine.on('subtask:completed', (event) => {
        events.push({
          timestamp: Date.now(),
          subtaskId: event.subtaskId
        });
      });

      const decomposed = await coordinationEngine.decomposeTask(task);
      const plan = coordinationEngine.buildExecutionPlan(
        decomposed.subtasks,
        decomposed.graph
      );

      await coordinationEngine.executeCoordinated(task.id, plan);

      // Verify execution order respects dependencies
      const completionOrder = events.map(e => e.subtaskId);

      // All fetches should complete before any analysis
      const fetchesIndex = Math.max(
        completionOrder.indexOf('fetch-sales'),
        completionOrder.indexOf('fetch-inventory'),
        completionOrder.indexOf('fetch-customers')
      );
      const analysesIndex = Math.min(
        completionOrder.indexOf('analyze-sales'),
        completionOrder.indexOf('analyze-inventory'),
        completionOrder.indexOf('analyze-customers')
      );

      expect(fetchesIndex).toBeLessThan(analysesIndex);

      // Merge should complete after all analyses
      const mergeIndex = completionOrder.indexOf('merge-analysis');
      expect(analysesIndex).toBeLessThan(mergeIndex);

      // Report should be last
      const reportIndex = completionOrder.indexOf('generate-report');
      expect(reportIndex).toBe(completionOrder.length - 1);
    }, 15000);
  });

  describe('Failure and Rollback Scenarios', () => {
    beforeEach(() => {
      coordinationEngine.registerDecomposer('generate_sales_report', new SalesReportDecomposer());
    });

    it('should rollback on subtask failure', async () => {
      // Make the analyzer agent fail
      const failingAnalyzer = agents.find(a => a.capabilities.includes('data_analysis'));
      const originalExecute = failingAnalyzer.executeTask.bind(failingAnalyzer);

      let callCount = 0;
      failingAnalyzer.executeTask = async function(task) {
        callCount++;
        if (callCount === 1) {
          throw new Error('Analysis failed');
        }
        return originalExecute(task);
      };

      const task = {
        id: 'failing-task-1',
        type: 'generate_sales_report',
        parameters: {
          startDate: '2025-01-01',
          endDate: '2025-01-31'
        }
      };

      const decomposed = await coordinationEngine.decomposeTask(task);
      const plan = coordinationEngine.buildExecutionPlan(
        decomposed.subtasks,
        decomposed.graph
      );

      const rollbackEvents = [];
      coordinationEngine.on('compensation:executed', (event) => {
        rollbackEvents.push(event);
      });

      await expect(
        coordinationEngine.executeCoordinated(task.id, plan)
      ).rejects.toThrow();

      // Should have executed compensation for the first subtask that succeeded
      expect(rollbackEvents.length).toBeGreaterThan(0);

      // Restore original function
      failingAnalyzer.executeTask = originalExecute;
    }, 15000);
  });

  describe('Event Emission', () => {
    beforeEach(() => {
      coordinationEngine.registerDecomposer('generate_sales_report', new SalesReportDecomposer());
    });

    it('should emit all expected events during workflow', async () => {
      const events = {
        'task:decomposed': [],
        'coordination:started': [],
        'subtask:completed': [],
        'coordination:completed': []
      };

      Object.keys(events).forEach(eventName => {
        coordinationEngine.on(eventName, (data) => {
          events[eventName].push(data);
        });
      });

      const task = {
        id: 'event-task-1',
        type: 'generate_sales_report',
        parameters: {
          startDate: '2025-01-01',
          endDate: '2025-01-31'
        }
      };

      const decomposed = await coordinationEngine.decomposeTask(task);
      const plan = coordinationEngine.buildExecutionPlan(
        decomposed.subtasks,
        decomposed.graph
      );

      await coordinationEngine.executeCoordinated(task.id, plan);

      expect(events['task:decomposed'].length).toBe(1);
      expect(events['coordination:started'].length).toBe(1);
      expect(events['subtask:completed'].length).toBe(4);
      expect(events['coordination:completed'].length).toBe(1);
    }, 15000);
  });

  describe('Concurrent Workflows', () => {
    beforeEach(() => {
      coordinationEngine.registerDecomposer('generate_sales_report', new SalesReportDecomposer());
    });

    it('should handle multiple concurrent workflows', async () => {
      const tasks = [
        {
          id: 'concurrent-task-1',
          type: 'generate_sales_report',
          parameters: { startDate: '2025-01-01', endDate: '2025-01-31' }
        },
        {
          id: 'concurrent-task-2',
          type: 'generate_sales_report',
          parameters: { startDate: '2025-02-01', endDate: '2025-02-28' }
        },
        {
          id: 'concurrent-task-3',
          type: 'generate_sales_report',
          parameters: { startDate: '2025-03-01', endDate: '2025-03-31' }
        }
      ];

      const executions = await Promise.all(
        tasks.map(async task => {
          const decomposed = await coordinationEngine.decomposeTask(task);
          const plan = coordinationEngine.buildExecutionPlan(
            decomposed.subtasks,
            decomposed.graph
          );
          return coordinationEngine.executeCoordinated(task.id, plan);
        })
      );

      // All should complete successfully
      expect(executions).toHaveLength(3);
      executions.forEach(results => {
        expect(results.size).toBe(4);
      });
    }, 20000);
  });
});
