/**
 * CI/CD Testing Agent API Routes
 *
 * Endpoints for CI/CD testing automation
 */

import express from 'express';
import { CICDTestingAgent } from '../../services/ci-cd-testing/CICDTestingAgent.js';
import logger from '../../utils/logger.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Fix: Go up 5 levels to reach project root (dronedoc2025/)
// Path: routes/ -> api/ -> src/ -> monolith/ -> backend/ -> dronedoc2025/
const PROJECT_ROOT = path.resolve(__dirname, '../../../../..');

// Create singleton agent instance
let agentInstance = null;

async function getAgentInstance() {
  if (!agentInstance) {
    agentInstance = new CICDTestingAgent({
      projectRoot: PROJECT_ROOT,
      logsDir: path.join(PROJECT_ROOT, 'logs', 'ci-cd-testing')
    });

    await agentInstance.initialize();
  }

  return agentInstance;
}

/**
 * Create CI/CD Testing routes
 */
export function createCICDTestingRoutes() {
  const router = express.Router();

  /**
   * GET /api/ci-cd-testing/status
   * Get agent status and statistics
   */
  router.get('/status', async (req, res) => {
    try {
      const agent = await getAgentInstance();
      const status = agent.getStatus();

      res.json({
        success: true,
        data: status
      });
    } catch (error) {
      logger.error('Error getting CI/CD testing agent status:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * POST /api/ci-cd-testing/execute-parallel
   * Execute multiple tests in parallel
   *
   * Body:
   * {
   *   tests: [
   *     { testId: 'unit-all', command: 'npm run test:unit' },
   *     { testId: 'integration-all', command: 'npm run test:integration' }
   *   ],
   *   options: {
   *     maxParallel: 4,
   *     retryOnFailure: true
   *   }
   * }
   */
  router.post('/execute-parallel', async (req, res) => {
    try {
      const { tests, options = {} } = req.body;

      if (!tests || !Array.isArray(tests)) {
        return res.status(400).json({
          success: false,
          error: 'Tests array is required'
        });
      }

      const agent = await getAgentInstance();

      // Set max parallel jobs if specified
      if (options.maxParallel) {
        agent.config.maxParallelJobs = options.maxParallel;
      }

      logger.info(`Executing ${tests.length} tests in parallel`);

      const results = await agent.executeTestsInParallel(tests, options);

      res.json({
        success: true,
        data: results
      });
    } catch (error) {
      logger.error('Error executing tests in parallel:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * POST /api/ci-cd-testing/execute-test
   * Execute a single test
   *
   * Body:
   * {
   *   testId: 'unit-all',
   *   command: 'npm run test:unit',
   *   workingDir: '/path/to/working/dir', // optional
   *   options: {
   *     retryCount: 0
   *   }
   * }
   */
  router.post('/execute-test', async (req, res) => {
    try {
      const { testId, command, workingDir, options = {} } = req.body;

      if (!testId || !command) {
        return res.status(400).json({
          success: false,
          error: 'testId and command are required'
        });
      }

      const agent = await getAgentInstance();

      logger.info(`Executing test: ${testId}`);

      const result = await agent.executeTest({
        testId,
        command,
        workingDir: workingDir || PROJECT_ROOT
      }, options);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Error executing test:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        data: {
          status: 'error',
          errorOutput: error.message
        }
      });
    }
  });

  /**
   * GET /api/ci-cd-testing/flakiness
   * Get flaky tests report
   */
  router.get('/flakiness', async (req, res) => {
    try {
      const agent = await getAgentInstance();

      // Get all test histories
      const allResults = Array.from(agent.testHistory.values()).flat();

      // Detect flakiness
      const results = allResults.map(result => ({
        test: { testId: result.testId },
        success: result.status === 'passed',
        result
      }));

      const flakyTests = await agent.detectFlakiness(results);

      res.json({
        success: true,
        data: {
          flakyTests,
          threshold: agent.config.flakinessThreshold,
          totalTestsAnalyzed: agent.testHistory.size
        }
      });
    } catch (error) {
      logger.error('Error getting flakiness report:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * POST /api/ci-cd-testing/coverage
   * Track code coverage
   *
   * Body:
   * {
   *   coverageData: {
   *     total: {
   *       statements: { pct: 75.5 },
   *       branches: { pct: 65.2 },
   *       functions: { pct: 80.1 },
   *       lines: { pct: 76.3 }
   *     }
   *   }
   * }
   */
  router.post('/coverage', async (req, res) => {
    try {
      const { coverageData } = req.body;

      if (!coverageData) {
        return res.status(400).json({
          success: false,
          error: 'coverageData is required'
        });
      }

      const agent = await getAgentInstance();
      const analysis = await agent.trackCoverage(coverageData);

      res.json({
        success: true,
        data: analysis
      });
    } catch (error) {
      logger.error('Error tracking coverage:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * GET /api/ci-cd-testing/coverage/history
   * Get coverage history
   */
  router.get('/coverage/history', async (req, res) => {
    try {
      const { limit = 50 } = req.query;
      const agent = await getAgentInstance();

      const history = agent.coverageHistory.slice(-parseInt(limit));

      res.json({
        success: true,
        data: {
          history,
          currentThresholds: agent.config.coverageThresholds
        }
      });
    } catch (error) {
      logger.error('Error getting coverage history:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * POST /api/ci-cd-testing/visual-regression
   * Perform visual regression testing
   *
   * Body:
   * {
   *   options: {
   *     threshold: 0.1,
   *     baselineDir: '/path/to/baseline',
   *     screenshotsDir: '/path/to/screenshots'
   *   }
   * }
   */
  router.post('/visual-regression', async (req, res) => {
    try {
      const { options = {} } = req.body;
      const agent = await getAgentInstance();

      logger.info('Starting visual regression testing');

      const results = await agent.performVisualRegression(options);

      res.json({
        success: true,
        data: results
      });
    } catch (error) {
      logger.error('Error performing visual regression testing:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * POST /api/ci-cd-testing/performance-regression
   * Perform performance regression testing
   *
   * Body:
   * {
   *   testId: 'performance-all',
   *   command: 'npm run test:performance',
   *   options: {
   *     regressionThreshold: 0.15
   *   }
   * }
   */
  router.post('/performance-regression', async (req, res) => {
    try {
      const { testId, command, options = {} } = req.body;
      const agent = await getAgentInstance();

      logger.info('Starting performance regression testing');

      const results = await agent.performPerformanceRegression({
        testId: testId || 'performance-all',
        command: command || 'npm run test:performance',
        ...options
      });

      res.json({
        success: true,
        data: results
      });
    } catch (error) {
      logger.error('Error performing performance regression testing:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * GET /api/ci-cd-testing/performance/baselines
   * Get performance baselines
   */
  router.get('/performance/baselines', async (req, res) => {
    try {
      const agent = await getAgentInstance();

      const baselines = Object.fromEntries(agent.performanceBaselines);

      res.json({
        success: true,
        data: baselines
      });
    } catch (error) {
      logger.error('Error getting performance baselines:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * GET /api/ci-cd-testing/test-history/:testId
   * Get test history for a specific test
   */
  router.get('/test-history/:testId', async (req, res) => {
    try {
      const { testId } = req.params;
      const { limit = 50 } = req.query;

      const agent = await getAgentInstance();
      const history = (agent.testHistory.get(testId) || []).slice(-parseInt(limit));

      res.json({
        success: true,
        data: {
          testId,
          history,
          totalRuns: history.length
        }
      });
    } catch (error) {
      logger.error('Error getting test history:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * POST /api/ci-cd-testing/config
   * Update agent configuration
   *
   * Body:
   * {
   *   maxParallelJobs: 4,
   *   flakinessThreshold: 0.05,
   *   coverageThresholds: {
   *     statements: 70,
   *     branches: 60,
   *     functions: 70,
   *     lines: 70
   *   }
   * }
   */
  router.post('/config', async (req, res) => {
    try {
      const config = req.body;
      const agent = await getAgentInstance();

      // Update configuration
      if (config.maxParallelJobs !== undefined) {
        agent.config.maxParallelJobs = config.maxParallelJobs;
      }

      if (config.flakinessThreshold !== undefined) {
        agent.config.flakinessThreshold = config.flakinessThreshold;
      }

      if (config.coverageThresholds) {
        agent.config.coverageThresholds = {
          ...agent.config.coverageThresholds,
          ...config.coverageThresholds
        };
      }

      logger.info('CI/CD Testing Agent configuration updated', config);

      res.json({
        success: true,
        data: {
          config: agent.config
        }
      });
    } catch (error) {
      logger.error('Error updating configuration:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  return router;
}

export default createCICDTestingRoutes;
