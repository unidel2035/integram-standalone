/**
 * CI/CD Testing Agent
 *
 * Автоматизация тестирования в CI/CD pipeline.
 * Роль в организме: Как иммунная система постоянно проверяет клетки.
 *
 * Функции:
 * - Запуск тестов на каждый commit
 * - Parallel test execution
 * - Test flakiness detection
 * - Coverage tracking
 * - Visual regression testing
 * - Performance regression testing
 */

import { spawn } from 'child_process';
import path from 'path';
import { promises as fs } from 'fs';
import logger from '../../utils/logger.js';

export class CICDTestingAgent {
  constructor(config = {}) {
    this.config = {
      projectRoot: config.projectRoot || process.cwd(),
      logsDir: config.logsDir || path.join(process.cwd(), 'logs', 'ci-cd-testing'),
      maxParallelJobs: config.maxParallelJobs || 4,
      flakinessThreshold: config.flakinessThreshold || 0.05, // 5% flakiness rate
      coverageThresholds: config.coverageThresholds || {
        statements: 70,
        branches: 60,
        functions: 70,
        lines: 70
      },
      ...config
    };

    this.testHistory = new Map(); // testId -> Array<TestResult>
    this.runningTests = new Map(); // testId -> TestExecution
    this.coverageHistory = [];
    this.performanceBaselines = new Map(); // testId -> baseline metrics
  }

  /**
   * Initialize the agent
   */
  async initialize() {
    logger.info('Initializing CI/CD Testing Agent...');

    // Ensure logs directory exists
    await this.ensureLogsDirectory();

    // Load historical data
    await this.loadHistoricalData();

    logger.info('CI/CD Testing Agent initialized successfully');
  }

  /**
   * Execute tests in parallel
   * @param {Array<Object>} tests - Array of test configurations
   * @param {Object} options - Execution options
   * @returns {Promise<Object>} Aggregated test results
   */
  async executeTestsInParallel(tests, options = {}) {
    logger.info(`Executing ${tests.length} tests in parallel (max ${this.config.maxParallelJobs} concurrent)`);

    const results = [];
    const batches = this.createBatches(tests, this.config.maxParallelJobs);

    for (const batch of batches) {
      const batchPromises = batch.map(test => this.executeTest(test, options));
      const batchResults = await Promise.allSettled(batchPromises);

      results.push(...batchResults.map((result, index) => ({
        test: batch[index],
        success: result.status === 'fulfilled',
        result: result.status === 'fulfilled' ? result.value : null,
        error: result.status === 'rejected' ? result.reason : null
      })));
    }

    // Aggregate results
    const aggregated = this.aggregateResults(results);

    // Check for flakiness
    await this.detectFlakiness(results);

    return aggregated;
  }

  /**
   * Execute a single test
   * @param {Object} test - Test configuration
   * @param {Object} options - Execution options
   * @returns {Promise<Object>} Test result
   */
  async executeTest(test, options = {}) {
    const { testId, command, workingDir = this.config.projectRoot } = test;
    const startTime = Date.now();

    logger.info(`Executing test: ${testId} - ${command}`);

    // Mark test as running
    this.runningTests.set(testId, {
      testId,
      command,
      startTime: new Date(startTime).toISOString(),
      status: 'running'
    });

    try {
      const result = await this.runCommand(command, workingDir);
      const endTime = Date.now();
      const duration = endTime - startTime;

      const testResult = {
        testId,
        command,
        exitCode: result.exitCode,
        output: result.output,
        errorOutput: result.errorOutput,
        duration,
        status: result.exitCode === 0 ? 'passed' : 'failed',
        timestamp: new Date(startTime).toISOString(),
        retryCount: options.retryCount || 0
      };

      // Save to history
      await this.saveTestResult(testResult);

      // Remove from running tests
      this.runningTests.delete(testId);

      return testResult;
    } catch (error) {
      const endTime = Date.now();
      const duration = endTime - startTime;

      const testResult = {
        testId,
        command,
        exitCode: 1,
        output: '',
        errorOutput: error.message,
        duration,
        status: 'error',
        timestamp: new Date(startTime).toISOString(),
        error: error.message,
        retryCount: options.retryCount || 0
      };

      await this.saveTestResult(testResult);
      this.runningTests.delete(testId);

      throw error;
    }
  }

  /**
   * Detect flaky tests
   * @param {Array<Object>} results - Recent test results
   * @returns {Promise<Array<Object>>} Flaky tests detected
   */
  async detectFlakiness(results) {
    logger.info('Analyzing test results for flakiness...');

    const flakyTests = [];

    for (const result of results) {
      const testId = result.test.testId;
      const history = this.testHistory.get(testId) || [];

      if (history.length < 10) {
        // Need at least 10 runs to detect flakiness
        continue;
      }

      // Calculate success rate over last 20 runs
      const recentRuns = history.slice(-20);
      const successCount = recentRuns.filter(r => r.status === 'passed').length;
      const failureCount = recentRuns.filter(r => r.status === 'failed').length;
      const successRate = successCount / recentRuns.length;

      // Flaky test: passes sometimes, fails sometimes (not consistently)
      if (successRate > 0.1 && successRate < 0.9) {
        const flakinessRate = 1 - Math.abs(successRate - 0.5) * 2; // Higher when closer to 50%

        if (flakinessRate > this.config.flakinessThreshold) {
          flakyTests.push({
            testId,
            successRate,
            flakinessRate,
            recentRuns: recentRuns.length,
            successCount,
            failureCount,
            lastFailure: recentRuns.reverse().find(r => r.status === 'failed')
          });
        }
      }
    }

    if (flakyTests.length > 0) {
      logger.warn(`Detected ${flakyTests.length} flaky tests`, flakyTests);
      await this.saveFlakinessReport(flakyTests);
    }

    return flakyTests;
  }

  /**
   * Track code coverage
   * @param {Object} coverageData - Coverage data from test run
   * @returns {Promise<Object>} Coverage analysis
   */
  async trackCoverage(coverageData) {
    logger.info('Tracking code coverage...');

    const analysis = {
      timestamp: new Date().toISOString(),
      coverage: coverageData,
      thresholds: this.config.coverageThresholds,
      passed: true,
      violations: []
    };

    // Check thresholds
    for (const [metric, threshold] of Object.entries(this.config.coverageThresholds)) {
      const actual = coverageData.total?.[metric]?.pct || 0;

      if (actual < threshold) {
        analysis.passed = false;
        analysis.violations.push({
          metric,
          threshold,
          actual,
          deficit: threshold - actual
        });
      }
    }

    // Save to history
    this.coverageHistory.push(analysis);

    // Save to file
    await this.saveCoverageReport(analysis);

    return analysis;
  }

  /**
   * Perform visual regression testing
   * @param {Object} options - Visual testing options
   * @returns {Promise<Object>} Visual regression results
   */
  async performVisualRegression(options = {}) {
    logger.info('Performing visual regression testing...');

    const {
      baselineDir = path.join(this.config.projectRoot, 'tests', 'visual', 'baseline'),
      screenshotsDir = path.join(this.config.projectRoot, 'tests', 'visual', 'screenshots'),
      diffDir = path.join(this.config.projectRoot, 'tests', 'visual', 'diff'),
      threshold = 0.1 // 10% pixel difference threshold
    } = options;

    try {
      // Run Playwright visual tests
      const result = await this.runCommand(
        'npm run test:e2e -- --grep @visual',
        this.config.projectRoot
      );

      const visualResults = {
        timestamp: new Date().toISOString(),
        exitCode: result.exitCode,
        output: result.output,
        errorOutput: result.errorOutput,
        status: result.exitCode === 0 ? 'passed' : 'failed',
        threshold,
        screenshots: {
          baseline: baselineDir,
          current: screenshotsDir,
          diff: diffDir
        }
      };

      await this.saveVisualRegressionReport(visualResults);

      return visualResults;
    } catch (error) {
      logger.error('Visual regression testing failed:', error);
      throw error;
    }
  }

  /**
   * Perform performance regression testing
   * @param {Object} options - Performance testing options
   * @returns {Promise<Object>} Performance regression results
   */
  async performPerformanceRegression(options = {}) {
    logger.info('Performing performance regression testing...');

    const {
      testId = 'performance-all',
      command = 'npm run test:performance',
      regressionThreshold = 0.15 // 15% performance degradation threshold
    } = options;

    try {
      const startTime = Date.now();
      const result = await this.runCommand(command, this.config.projectRoot);
      const duration = Date.now() - startTime;

      // Parse performance metrics from output
      const metrics = this.parsePerformanceMetrics(result.output);

      // Get baseline for comparison
      const baseline = this.performanceBaselines.get(testId);

      const performanceResults = {
        testId,
        timestamp: new Date().toISOString(),
        duration,
        metrics,
        baseline,
        regressions: []
      };

      // Detect regressions
      if (baseline) {
        for (const [metric, value] of Object.entries(metrics)) {
          const baselineValue = baseline.metrics[metric];

          if (baselineValue) {
            const degradation = (value - baselineValue) / baselineValue;

            if (degradation > regressionThreshold) {
              performanceResults.regressions.push({
                metric,
                baseline: baselineValue,
                current: value,
                degradation: degradation * 100, // as percentage
                threshold: regressionThreshold * 100
              });
            }
          }
        }
      }

      // Update baseline if no regressions or first run
      if (performanceResults.regressions.length === 0 || !baseline) {
        this.performanceBaselines.set(testId, {
          timestamp: performanceResults.timestamp,
          metrics
        });
      }

      await this.savePerformanceReport(performanceResults);

      return performanceResults;
    } catch (error) {
      logger.error('Performance regression testing failed:', error);
      throw error;
    }
  }

  /**
   * Get test status and statistics
   * @returns {Object} Agent status
   */
  getStatus() {
    const runningTestsArray = Array.from(this.runningTests.values());
    const recentHistory = Array.from(this.testHistory.values())
      .flat()
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 100);

    const totalTests = recentHistory.length;
    const passedTests = recentHistory.filter(r => r.status === 'passed').length;
    const failedTests = recentHistory.filter(r => r.status === 'failed').length;

    return {
      running: runningTestsArray.length,
      runningTests: runningTestsArray,
      statistics: {
        total: totalTests,
        passed: passedTests,
        failed: failedTests,
        successRate: totalTests > 0 ? (passedTests / totalTests) * 100 : 0
      },
      coverage: this.coverageHistory.slice(-1)[0] || null,
      config: {
        maxParallelJobs: this.config.maxParallelJobs,
        flakinessThreshold: this.config.flakinessThreshold,
        coverageThresholds: this.config.coverageThresholds
      }
    };
  }

  // Helper methods

  async runCommand(command, workingDir) {
    return new Promise((resolve, reject) => {
      let output = '';
      let errorOutput = '';

      const [cmd, ...args] = command.split(' ');

      const child = spawn(cmd, args, {
        cwd: workingDir,
        shell: true,
        env: { ...process.env }
      });

      child.stdout.on('data', (data) => {
        output += data.toString();
      });

      child.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      child.on('error', reject);

      child.on('close', (exitCode) => {
        resolve({ exitCode, output, errorOutput });
      });
    });
  }

  createBatches(items, batchSize) {
    const batches = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  aggregateResults(results) {
    return {
      total: results.length,
      passed: results.filter(r => r.success && r.result?.status === 'passed').length,
      failed: results.filter(r => !r.success || r.result?.status === 'failed').length,
      errors: results.filter(r => r.error || r.result?.status === 'error').length,
      results
    };
  }

  async saveTestResult(result) {
    const testId = result.testId;

    if (!this.testHistory.has(testId)) {
      this.testHistory.set(testId, []);
    }

    this.testHistory.get(testId).push(result);

    // Save to file
    const filename = `${Date.now()}-${testId.replace(/[^a-z0-9-]/gi, '_')}.json`;
    const filepath = path.join(this.config.logsDir, 'test-results', filename);

    await fs.mkdir(path.dirname(filepath), { recursive: true });
    await fs.writeFile(filepath, JSON.stringify(result, null, 2));
  }

  async saveFlakinessReport(flakyTests) {
    const filename = `flakiness-${Date.now()}.json`;
    const filepath = path.join(this.config.logsDir, 'flakiness', filename);

    await fs.mkdir(path.dirname(filepath), { recursive: true });
    await fs.writeFile(filepath, JSON.stringify({
      timestamp: new Date().toISOString(),
      flakyTests,
      threshold: this.config.flakinessThreshold
    }, null, 2));
  }

  async saveCoverageReport(analysis) {
    const filename = `coverage-${Date.now()}.json`;
    const filepath = path.join(this.config.logsDir, 'coverage', filename);

    await fs.mkdir(path.dirname(filepath), { recursive: true });
    await fs.writeFile(filepath, JSON.stringify(analysis, null, 2));
  }

  async saveVisualRegressionReport(results) {
    const filename = `visual-${Date.now()}.json`;
    const filepath = path.join(this.config.logsDir, 'visual', filename);

    await fs.mkdir(path.dirname(filepath), { recursive: true });
    await fs.writeFile(filepath, JSON.stringify(results, null, 2));
  }

  async savePerformanceReport(results) {
    const filename = `performance-${Date.now()}.json`;
    const filepath = path.join(this.config.logsDir, 'performance', filename);

    await fs.mkdir(path.dirname(filepath), { recursive: true });
    await fs.writeFile(filepath, JSON.stringify(results, null, 2));
  }

  async ensureLogsDirectory() {
    const dirs = [
      this.config.logsDir,
      path.join(this.config.logsDir, 'test-results'),
      path.join(this.config.logsDir, 'flakiness'),
      path.join(this.config.logsDir, 'coverage'),
      path.join(this.config.logsDir, 'visual'),
      path.join(this.config.logsDir, 'performance')
    ];

    for (const dir of dirs) {
      await fs.mkdir(dir, { recursive: true });
    }
  }

  async loadHistoricalData() {
    try {
      // Load test results
      const resultsDir = path.join(this.config.logsDir, 'test-results');
      const files = await fs.readdir(resultsDir).catch(() => []);

      for (const file of files) {
        if (file.endsWith('.json')) {
          const content = await fs.readFile(path.join(resultsDir, file), 'utf-8');
          const result = JSON.parse(content);

          if (!this.testHistory.has(result.testId)) {
            this.testHistory.set(result.testId, []);
          }

          this.testHistory.get(result.testId).push(result);
        }
      }

      logger.info(`Loaded ${this.testHistory.size} test histories`);
    } catch (error) {
      logger.warn('Failed to load historical data:', error.message);
    }
  }

  parsePerformanceMetrics(output) {
    // Parse performance metrics from test output
    // This is a simplified implementation - real one would parse actual metrics
    const metrics = {};

    // Example: extract metrics from output
    const metricPatterns = {
      'average-response-time': /Average response time: (\d+\.?\d*) ?ms/i,
      'requests-per-second': /Requests\/sec: (\d+\.?\d*)/i,
      'memory-usage': /Memory usage: (\d+\.?\d*) ?MB/i,
      'cpu-usage': /CPU usage: (\d+\.?\d*) ?%/i
    };

    for (const [metric, pattern] of Object.entries(metricPatterns)) {
      const match = output.match(pattern);
      if (match) {
        metrics[metric] = parseFloat(match[1]);
      }
    }

    return metrics;
  }
}

export default CICDTestingAgent;
