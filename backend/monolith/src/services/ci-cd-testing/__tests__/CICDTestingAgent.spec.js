/**
 * CI/CD Testing Agent Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CICDTestingAgent } from '../CICDTestingAgent.js';
import path from 'path';
import { promises as fs } from 'fs';

describe('CICDTestingAgent', () => {
  let agent;
  const testLogsDir = path.join(process.cwd(), 'logs', 'ci-cd-testing-test');

  beforeEach(async () => {
    agent = new CICDTestingAgent({
      projectRoot: process.cwd(),
      logsDir: testLogsDir,
      maxParallelJobs: 2,
      flakinessThreshold: 0.05,
      coverageThresholds: {
        statements: 70,
        branches: 60,
        functions: 70,
        lines: 70
      }
    });

    await agent.initialize();
  });

  afterEach(async () => {
    // Clean up test logs
    try {
      await fs.rm(testLogsDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore errors during cleanup
    }
  });

  describe('Initialization', () => {
    it('should initialize with default configuration', async () => {
      const defaultAgent = new CICDTestingAgent();
      await defaultAgent.initialize();

      expect(defaultAgent.config.maxParallelJobs).toBe(4);
      expect(defaultAgent.config.flakinessThreshold).toBe(0.05);
      expect(defaultAgent.config.coverageThresholds).toEqual({
        statements: 70,
        branches: 60,
        functions: 70,
        lines: 70
      });
    });

    it('should create logs directory on initialization', async () => {
      const stats = await fs.stat(testLogsDir);
      expect(stats.isDirectory()).toBe(true);
    });
  });

  describe('Test Execution', () => {
    it('should execute a simple test command', async () => {
      const test = {
        testId: 'echo-test',
        command: 'echo "Hello World"',
        workingDir: process.cwd()
      };

      const result = await agent.executeTest(test);

      expect(result.testId).toBe('echo-test');
      expect(result.status).toBe('passed');
      expect(result.exitCode).toBe(0);
      expect(result.output).toContain('Hello World');
      expect(result.duration).toBeGreaterThan(0);
    });

    it('should handle failing tests', async () => {
      const test = {
        testId: 'failing-test',
        command: 'exit 1',
        workingDir: process.cwd()
      };

      const result = await agent.executeTest(test);

      expect(result.testId).toBe('failing-test');
      expect(result.status).toBe('failed');
      expect(result.exitCode).toBe(1);
    });

    it('should save test results to history', async () => {
      const test = {
        testId: 'history-test',
        command: 'echo "test"',
        workingDir: process.cwd()
      };

      await agent.executeTest(test);

      const history = agent.testHistory.get('history-test');
      expect(history).toBeDefined();
      expect(history.length).toBe(1);
      expect(history[0].testId).toBe('history-test');
    });
  });

  describe('Parallel Test Execution', () => {
    it('should execute tests in parallel', async () => {
      const tests = [
        { testId: 'test-1', command: 'echo "test 1"' },
        { testId: 'test-2', command: 'echo "test 2"' },
        { testId: 'test-3', command: 'echo "test 3"' },
        { testId: 'test-4', command: 'echo "test 4"' }
      ];

      const startTime = Date.now();
      const results = await agent.executeTestsInParallel(tests);
      const duration = Date.now() - startTime;

      expect(results.total).toBe(4);
      expect(results.passed).toBe(4);
      expect(results.failed).toBe(0);

      // Running 4 tests in parallel with maxParallelJobs=2 should be faster
      // than running them sequentially
      expect(duration).toBeLessThan(4000); // Arbitrary threshold
    });

    it('should respect maxParallelJobs limit', async () => {
      const tests = Array.from({ length: 6 }, (_, i) => ({
        testId: `test-${i}`,
        command: `echo "test ${i}"`
      }));

      // maxParallelJobs is set to 2 in beforeEach
      const results = await agent.executeTestsInParallel(tests);

      expect(results.total).toBe(6);
      expect(results.passed).toBe(6);
    });

    it('should handle mixed success and failure in parallel execution', async () => {
      const tests = [
        { testId: 'pass-1', command: 'echo "pass"' },
        { testId: 'fail-1', command: 'exit 1' },
        { testId: 'pass-2', command: 'echo "pass"' },
        { testId: 'fail-2', command: 'exit 1' }
      ];

      const results = await agent.executeTestsInParallel(tests);

      expect(results.total).toBe(4);
      expect(results.passed).toBe(2);
      expect(results.failed).toBe(2);
    });
  });

  describe('Flakiness Detection', () => {
    it('should detect flaky tests', async () => {
      const testId = 'flaky-test';

      // Simulate 20 test runs with 50% success rate (highly flaky)
      for (let i = 0; i < 20; i++) {
        await agent.saveTestResult({
          testId,
          command: 'echo test',
          exitCode: i % 2 === 0 ? 0 : 1,
          output: '',
          errorOutput: '',
          duration: 100,
          status: i % 2 === 0 ? 'passed' : 'failed',
          timestamp: new Date().toISOString(),
          retryCount: 0
        });
      }

      const results = [
        { test: { testId }, success: true, result: { status: 'passed' } }
      ];

      const flakyTests = await agent.detectFlakiness(results);

      expect(flakyTests.length).toBeGreaterThan(0);
      const flakyTest = flakyTests.find(t => t.testId === testId);
      expect(flakyTest).toBeDefined();
      expect(flakyTest.successRate).toBeCloseTo(0.5, 1);
      expect(flakyTest.flakinessRate).toBeGreaterThan(agent.config.flakinessThreshold);
    });

    it('should not flag stable passing tests as flaky', async () => {
      const testId = 'stable-pass-test';

      // Simulate 20 passing test runs
      for (let i = 0; i < 20; i++) {
        await agent.saveTestResult({
          testId,
          command: 'echo test',
          exitCode: 0,
          output: '',
          errorOutput: '',
          duration: 100,
          status: 'passed',
          timestamp: new Date().toISOString(),
          retryCount: 0
        });
      }

      const results = [
        { test: { testId }, success: true, result: { status: 'passed' } }
      ];

      const flakyTests = await agent.detectFlakiness(results);
      const flakyTest = flakyTests.find(t => t.testId === testId);

      expect(flakyTest).toBeUndefined();
    });

    it('should not flag stable failing tests as flaky', async () => {
      const testId = 'stable-fail-test';

      // Simulate 20 failing test runs
      for (let i = 0; i < 20; i++) {
        await agent.saveTestResult({
          testId,
          command: 'exit 1',
          exitCode: 1,
          output: '',
          errorOutput: '',
          duration: 100,
          status: 'failed',
          timestamp: new Date().toISOString(),
          retryCount: 0
        });
      }

      const results = [
        { test: { testId }, success: false, result: { status: 'failed' } }
      ];

      const flakyTests = await agent.detectFlakiness(results);
      const flakyTest = flakyTests.find(t => t.testId === testId);

      expect(flakyTest).toBeUndefined();
    });
  });

  describe('Coverage Tracking', () => {
    it('should track coverage and check thresholds', async () => {
      const coverageData = {
        total: {
          statements: { pct: 75 },
          branches: { pct: 65 },
          functions: { pct: 80 },
          lines: { pct: 76 }
        }
      };

      const analysis = await agent.trackCoverage(coverageData);

      expect(analysis.passed).toBe(true);
      expect(analysis.violations).toHaveLength(0);
      expect(analysis.coverage).toEqual(coverageData);
    });

    it('should detect coverage violations', async () => {
      const coverageData = {
        total: {
          statements: { pct: 65 }, // Below 70% threshold
          branches: { pct: 55 },    // Below 60% threshold
          functions: { pct: 68 },   // Below 70% threshold
          lines: { pct: 66 }        // Below 70% threshold
        }
      };

      const analysis = await agent.trackCoverage(coverageData);

      expect(analysis.passed).toBe(false);
      expect(analysis.violations.length).toBeGreaterThan(0);

      // Check specific violations
      const statementsViolation = analysis.violations.find(v => v.metric === 'statements');
      expect(statementsViolation).toBeDefined();
      expect(statementsViolation.threshold).toBe(70);
      expect(statementsViolation.actual).toBe(65);
    });

    it('should maintain coverage history', async () => {
      const coverageData1 = {
        total: {
          statements: { pct: 75 },
          branches: { pct: 65 },
          functions: { pct: 80 },
          lines: { pct: 76 }
        }
      };

      const coverageData2 = {
        total: {
          statements: { pct: 78 },
          branches: { pct: 68 },
          functions: { pct: 82 },
          lines: { pct: 79 }
        }
      };

      await agent.trackCoverage(coverageData1);
      await agent.trackCoverage(coverageData2);

      expect(agent.coverageHistory).toHaveLength(2);
      expect(agent.coverageHistory[0].coverage).toEqual(coverageData1);
      expect(agent.coverageHistory[1].coverage).toEqual(coverageData2);
    });
  });

  describe('Performance Metrics Parsing', () => {
    it('should parse performance metrics from output', () => {
      const output = `
        Performance Test Results:
        Average response time: 125.5 ms
        Requests/sec: 850.3
        Memory usage: 256.7 MB
        CPU usage: 45.2 %
      `;

      const metrics = agent.parsePerformanceMetrics(output);

      expect(metrics['average-response-time']).toBeCloseTo(125.5);
      expect(metrics['requests-per-second']).toBeCloseTo(850.3);
      expect(metrics['memory-usage']).toBeCloseTo(256.7);
      expect(metrics['cpu-usage']).toBeCloseTo(45.2);
    });

    it('should handle missing metrics gracefully', () => {
      const output = 'No performance metrics available';

      const metrics = agent.parsePerformanceMetrics(output);

      expect(Object.keys(metrics)).toHaveLength(0);
    });
  });

  describe('Agent Status', () => {
    it('should return current status', () => {
      const status = agent.getStatus();

      expect(status).toHaveProperty('running');
      expect(status).toHaveProperty('runningTests');
      expect(status).toHaveProperty('statistics');
      expect(status).toHaveProperty('config');

      expect(status.config.maxParallelJobs).toBe(2);
      expect(status.config.flakinessThreshold).toBe(0.05);
    });

    it('should track running tests', async () => {
      // Mock a long-running test
      const longRunningTest = agent.executeTest({
        testId: 'long-test',
        command: 'sleep 0.1 && echo done',
        workingDir: process.cwd()
      });

      // Check status while test is running
      const status = agent.getStatus();
      expect(status.running).toBeGreaterThan(0);

      // Wait for test to complete
      await longRunningTest;

      // Check status after test completion
      const statusAfter = agent.getStatus();
      expect(statusAfter.running).toBe(0);
    });

    it('should calculate success rate correctly', async () => {
      // Run some passing and failing tests
      await agent.executeTest({
        testId: 'pass-1',
        command: 'echo pass',
        workingDir: process.cwd()
      });

      await agent.executeTest({
        testId: 'fail-1',
        command: 'exit 1',
        workingDir: process.cwd()
      });

      await agent.executeTest({
        testId: 'pass-2',
        command: 'echo pass',
        workingDir: process.cwd()
      });

      const status = agent.getStatus();

      expect(status.statistics.total).toBeGreaterThanOrEqual(3);
      expect(status.statistics.passed).toBeGreaterThanOrEqual(2);
      expect(status.statistics.failed).toBeGreaterThanOrEqual(1);
      expect(status.statistics.successRate).toBeGreaterThan(0);
      expect(status.statistics.successRate).toBeLessThanOrEqual(100);
    });
  });

  describe('Helper Methods', () => {
    it('should create correct batches', () => {
      const items = [1, 2, 3, 4, 5, 6, 7];
      const batches = agent.createBatches(items, 3);

      expect(batches).toHaveLength(3);
      expect(batches[0]).toEqual([1, 2, 3]);
      expect(batches[1]).toEqual([4, 5, 6]);
      expect(batches[2]).toEqual([7]);
    });

    it('should aggregate results correctly', () => {
      const results = [
        { success: true, result: { status: 'passed' } },
        { success: false, result: { status: 'failed' } },
        { success: true, result: { status: 'passed' } },
        { error: new Error('test error'), result: { status: 'error' } }
      ];

      const aggregated = agent.aggregateResults(results);

      expect(aggregated.total).toBe(4);
      expect(aggregated.passed).toBe(2);
      expect(aggregated.failed).toBe(1);
      expect(aggregated.errors).toBe(1);
    });
  });
});
