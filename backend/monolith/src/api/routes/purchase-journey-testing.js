// purchase-journey-testing.js - API routes for Purchase Journey Testing Agent
import express from 'express';
import logger from '../../utils/logger.js';
import { PurchaseJourneyTestingAgent } from '../../agents/PurchaseJourneyTestingAgent.js';
import {
  verifyGitHubSignature,
  getGitHubEvent,
  getGitHubDeliveryId,
  validateWebhookPayload,
  parsePushEvent,
  parsePullRequestEvent,
  parseIssuesEvent,
} from '../../utils/githubWebhook.js';

const router = express.Router();

// Singleton agent instance
let agentInstance = null;

// Test queue for webhook-triggered tests
class JourneyTestQueue {
  constructor() {
    this.queue = [];
    this.processing = false;
    this.history = []; // Store test history
  }

  /**
   * Add test to queue
   */
  add(testContext) {
    logger.info({ context: testContext }, 'Adding test to queue');
    this.queue.push({
      ...testContext,
      queuedAt: Date.now(),
      status: 'queued',
    });

    // Start processing if not already running
    if (!this.processing) {
      this.process();
    }

    return {
      success: true,
      position: this.queue.length,
      message: 'Test queued successfully',
    };
  }

  /**
   * Process queue
   */
  async process() {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;

    while (this.queue.length > 0) {
      const testContext = this.queue.shift();
      testContext.status = 'running';
      testContext.startedAt = Date.now();

      logger.info({ context: testContext }, 'Processing test from queue');

      try {
        const agent = getAgent();

        if (!agent.initialized) {
          await agent.initialize();
        }

        // Run the journey test
        const result = await agent.executeJourneyTest();

        testContext.status = 'completed';
        testContext.completedAt = Date.now();
        testContext.result = result;

        logger.info({ context: testContext, success: result.success }, 'Test completed');

        // Post results to GitHub if this was triggered by a PR or issue
        if (testContext.prNumber) {
          await postResultToPR(agent, testContext.prNumber, result.testResult, testContext);
        }

        if (testContext.issueNumber && testContext.trigger === 'issue') {
          await postResultToIssue(agent, testContext.issueNumber, result.testResult, testContext);
        }

      } catch (error) {
        testContext.status = 'failed';
        testContext.completedAt = Date.now();
        testContext.error = error.message;

        logger.error({ context: testContext, error: error.message }, 'Test failed');
      }

      // Store in history
      this.history.push(testContext);
      if (this.history.length > 50) {
        this.history.shift(); // Keep last 50
      }

      // Wait 1 second before next test to avoid overload
      if (this.queue.length > 0) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    this.processing = false;
  }

  /**
   * Get queue status
   */
  getStatus() {
    return {
      queueLength: this.queue.length,
      processing: this.processing,
      history: this.history.slice(-10), // Last 10 tests
    };
  }
}

// Global test queue instance
const testQueue = new JourneyTestQueue();

/**
 * Post test results to PR comment
 */
async function postResultToPR(agent, prNumber, result, context) {
  try {
    const status = result.success ? '✅ PASSED' : '❌ FAILED';
    const emoji = result.success ? '🎉' : '⚠️';

    const failedStepsText = result.failedSteps && result.failedSteps.length > 0
      ? `\n### Failed Steps:\n${result.failedSteps.map(s => `- ❌ ${s}`).join('\n')}\n`
      : '';

    const body = `
## ${emoji} Purchase Journey Test ${status}

**Triggered by:** ${context.trigger} (${context.branch || 'N/A'})
**Duration:** ${result.totalDuration}ms
**Steps:** ${result.steps?.length || 0}
**Failed:** ${result.failedSteps?.length || 0}
**Timestamp:** ${new Date(context.queuedAt).toISOString()}
${failedStepsText}
### Step Details:
${result.steps?.map(step => {
  const icon = step.success ? '✅' : '❌';
  return `- ${icon} **${step.stepName}** (${step.duration}ms)`;
}).join('\n') || 'No step details available'}

[View full report](https://drondoc.ru/agents/purchase-journey-testing)

---
*Automatically posted by PurchaseJourneyTestingAgent*
`.trim();

    await agent.githubApiRequest('POST', `/repos/${agent.config.githubRepo}/issues/${prNumber}/comments`, {
      body,
    });

    logger.info({ prNumber, success: result.success }, 'Posted test results to PR');
  } catch (error) {
    logger.error({ prNumber, error: error.message }, 'Failed to post results to PR');
  }
}

/**
 * Post test results to issue comment
 */
async function postResultToIssue(agent, issueNumber, result, context) {
  try {
    const status = result.success ? '✅ PASSED' : '❌ FAILED';
    const emoji = result.success ? '🎉' : '⚠️';

    const failedStepsText = result.failedSteps && result.failedSteps.length > 0
      ? `\n### Failed Steps:\n${result.failedSteps.map(s => `- ❌ ${s}`).join('\n')}\n`
      : '';

    const body = `
## ${emoji} Journey Test ${status}

**Triggered by:** Issue label "${context.label || 'needs-journey-test'}"
**Duration:** ${result.totalDuration}ms
**Steps:** ${result.steps?.length || 0}
**Failed:** ${result.failedSteps?.length || 0}
**Timestamp:** ${new Date(context.queuedAt).toISOString()}
${failedStepsText}
### Step Details:
${result.steps?.map(step => {
  const icon = step.success ? '✅' : '❌';
  return `- ${icon} **${step.stepName}** (${step.duration}ms): ${step.observation}`;
}).join('\n') || 'No step details available'}

[View full report](https://drondoc.ru/agents/purchase-journey-testing)

---
*Automatically posted by PurchaseJourneyTestingAgent*
`.trim();

    await agent.githubApiRequest('POST', `/repos/${agent.config.githubRepo}/issues/${issueNumber}/comments`, {
      body,
    });

    logger.info({ issueNumber, success: result.success }, 'Posted test results to issue');
  } catch (error) {
    logger.error({ issueNumber, error: error.message }, 'Failed to post results to issue');
  }
}

/**
 * Get or create agent instance
 */
function getAgent() {
  if (!agentInstance) {
    agentInstance = new PurchaseJourneyTestingAgent({
      id: 'purchase-journey-testing-agent',
      config: {
        baseUrl: process.env.VITE_APP_URL || 'http://localhost:5173',
        testInterval: parseInt(process.env.JOURNEY_TEST_INTERVAL) || 1800000, // 30 minutes
        githubToken: process.env.GITHUB_TOKEN,
        githubRepo: process.env.GITHUB_REPOSITORY || 'unidel2035/dronedoc2025',
        autoSolve: process.env.JOURNEY_AUTO_SOLVE !== 'false',
        autoMerge: process.env.JOURNEY_AUTO_MERGE !== 'false',
      },
    });

    // Initialize agent
    agentInstance.initialize().catch(error => {
      logger.error({ error: error.message }, 'Failed to initialize Purchase Journey Testing Agent');
    });
  }

  return agentInstance;
}

/**
 * GET /api/purchase-journey-testing/status
 * Get agent status and metrics
 */
router.get('/status', async (req, res) => {
  try {
    const agent = getAgent();
    const status = await agent.getStatus();

    res.json(status);
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to get agent status');
    res.status(500).json({
      success: false,
      message: 'Failed to get status',
      error: error.message,
    });
  }
});

/**
 * POST /api/purchase-journey-testing/start
 * Start background testing
 */
router.post('/start', async (req, res) => {
  try {
    const agent = getAgent();

    if (!agent.initialized) {
      await agent.initialize();
    }

    const result = agent.startBackgroundTesting();

    res.json(result);
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to start background testing');
    res.status(500).json({
      success: false,
      message: 'Failed to start background testing',
      error: error.message,
    });
  }
});

/**
 * POST /api/purchase-journey-testing/stop
 * Stop background testing
 */
router.post('/stop', async (req, res) => {
  try {
    const agent = getAgent();
    const result = agent.stopBackgroundTesting();

    res.json(result);
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to stop background testing');
    res.status(500).json({
      success: false,
      message: 'Failed to stop background testing',
      error: error.message,
    });
  }
});

/**
 * POST /api/purchase-journey-testing/test
 * Execute a single journey test manually
 */
router.post('/test', async (req, res) => {
  try {
    const agent = getAgent();

    if (!agent.initialized) {
      await agent.initialize();
    }

    const result = await agent.executeJourneyTest();

    res.json(result);
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to execute journey test');
    res.status(500).json({
      success: false,
      message: 'Failed to execute test',
      error: error.message,
    });
  }
});

/**
 * GET /api/purchase-journey-testing/history
 * Get test history
 */
router.get('/history', async (req, res) => {
  try {
    const agent = getAgent();
    const limit = parseInt(req.query.limit) || 20;

    const result = agent.getTestHistory(limit);

    res.json(result);
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to get test history');
    res.status(500).json({
      success: false,
      message: 'Failed to get history',
      error: error.message,
    });
  }
});

/**
 * GET /api/purchase-journey-testing/react-cycle
 * Get ReAct paradigm cycle details
 */
router.get('/react-cycle', async (req, res) => {
  try {
    const agent = getAgent();
    const result = agent.getReActCycle();

    res.json(result);
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to get ReAct cycle');
    res.status(500).json({
      success: false,
      message: 'Failed to get ReAct cycle',
      error: error.message,
    });
  }
});

/**
 * GET /api/purchase-journey-testing/metrics
 * Get detailed metrics
 */
router.get('/metrics', async (req, res) => {
  try {
    const agent = getAgent();
    const status = await agent.getStatus();

    res.json({
      success: true,
      metrics: status.status.metrics,
    });
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to get metrics');
    res.status(500).json({
      success: false,
      message: 'Failed to get metrics',
      error: error.message,
    });
  }
});

/**
 * PUT /api/purchase-journey-testing/config
 * Update agent configuration
 */
router.put('/config', async (req, res) => {
  try {
    const agent = getAgent();
    const { autoSolve, autoMerge, testInterval } = req.body;

    if (autoSolve !== undefined) {
      agent.config.autoSolve = autoSolve;
    }

    if (autoMerge !== undefined) {
      agent.config.autoMerge = autoMerge;
    }

    if (testInterval !== undefined && testInterval > 0) {
      agent.config.testInterval = testInterval;

      // Restart background testing if active
      if (agent.testInterval) {
        agent.stopBackgroundTesting();
        agent.startBackgroundTesting();
      }
    }

    res.json({
      success: true,
      message: 'Configuration updated',
      config: {
        autoSolve: agent.config.autoSolve,
        autoMerge: agent.config.autoMerge,
        testInterval: agent.config.testInterval,
      },
    });
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to update config');
    res.status(500).json({
      success: false,
      message: 'Failed to update configuration',
      error: error.message,
    });
  }
});

/**
 * GET /api/purchase-journey-testing/journey-steps
 * Get all journey steps configuration
 */
router.get('/journey-steps', async (req, res) => {
  try {
    const agent = getAgent();

    res.json({
      success: true,
      steps: agent.journeySteps,
    });
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to get journey steps');
    res.status(500).json({
      success: false,
      message: 'Failed to get journey steps',
      error: error.message,
    });
  }
});

/**
 * POST /api/purchase-journey-testing/webhook/github
 * GitHub webhook endpoint for triggering tests on code changes
 *
 * Supported events:
 * - push (main branch) - Run full journey test
 * - pull_request (opened/synchronize) - Test PR branch
 * - issues (labeled "needs-journey-test") - Run specific test
 */
router.post('/webhook/github', async (req, res) => {
  const event = getGitHubEvent(req);
  const deliveryId = getGitHubDeliveryId(req);
  const payload = req.body;

  logger.info({ event, deliveryId }, 'GitHub webhook received');

  // Verify webhook signature
  const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET;
  if (!verifyGitHubSignature(req, webhookSecret)) {
    logger.warn({ event, deliveryId }, 'Invalid webhook signature');
    return res.status(401).json({
      success: false,
      error: 'Invalid signature',
    });
  }

  // Validate payload
  const validation = validateWebhookPayload(payload, event);
  if (!validation.valid) {
    logger.warn({ event, deliveryId, error: validation.error }, 'Invalid webhook payload');
    return res.status(400).json({
      success: false,
      error: validation.error,
    });
  }

  try {
    let testContext = null;

    switch (event) {
      case 'push': {
        const pushInfo = parsePushEvent(payload);

        // Only trigger on main/dev branch pushes
        if (pushInfo.branch === 'main' || pushInfo.branch === 'dev') {
          logger.info({ pushInfo }, 'Push to main/dev detected, queueing journey test');

          testContext = {
            trigger: 'push',
            event: 'push',
            branch: pushInfo.branch,
            commit: pushInfo.commit,
            commitMessage: pushInfo.commitMessage,
            pusher: pushInfo.pusher,
            repository: pushInfo.repository,
            deliveryId,
          };

          testQueue.add(testContext);
        } else {
          logger.info({ branch: pushInfo.branch }, 'Ignoring push to non-main branch');
        }
        break;
      }

      case 'pull_request': {
        const prInfo = parsePullRequestEvent(payload);

        // Trigger on opened or synchronize (new commits)
        if (['opened', 'synchronize', 'reopened'].includes(prInfo.action)) {
          logger.info({ prInfo }, 'PR update detected, queueing journey test');

          testContext = {
            trigger: 'pull_request',
            event: 'pull_request',
            action: prInfo.action,
            prNumber: prInfo.prNumber,
            branch: prInfo.branch,
            baseBranch: prInfo.baseBranch,
            title: prInfo.title,
            author: prInfo.author,
            repository: prInfo.repository,
            deliveryId,
          };

          testQueue.add(testContext);
        } else {
          logger.info({ action: prInfo.action }, 'Ignoring PR action');
        }
        break;
      }

      case 'issues': {
        const issueInfo = parseIssuesEvent(payload);

        // Trigger on labeled with "needs-journey-test"
        if (issueInfo.action === 'labeled' && issueInfo.label === 'needs-journey-test') {
          logger.info({ issueInfo }, 'Issue labeled for testing, queueing journey test');

          testContext = {
            trigger: 'issue',
            event: 'issues',
            action: issueInfo.action,
            issueNumber: issueInfo.issueNumber,
            label: issueInfo.label,
            title: issueInfo.title,
            author: issueInfo.author,
            repository: issueInfo.repository,
            deliveryId,
          };

          testQueue.add(testContext);
        } else {
          logger.info({ action: issueInfo.action, label: issueInfo.label }, 'Ignoring issue event');
        }
        break;
      }

      default:
        logger.info({ event }, 'Unsupported webhook event');
        return res.json({
          success: true,
          message: `Event type "${event}" is not supported`,
        });
    }

    if (testContext) {
      res.json({
        success: true,
        message: 'Webhook processed, test queued',
        context: {
          trigger: testContext.trigger,
          event: testContext.event,
          queuePosition: testQueue.queue.length,
        },
      });
    } else {
      res.json({
        success: true,
        message: 'Webhook received but no test triggered',
      });
    }

  } catch (error) {
    logger.error({ error: error.message, event, deliveryId }, 'Webhook processing failed');
    res.status(500).json({
      success: false,
      error: 'Webhook processing failed',
      message: error.message,
    });
  }
});

/**
 * GET /api/purchase-journey-testing/webhook/queue
 * Get test queue status
 */
router.get('/webhook/queue', async (req, res) => {
  try {
    const status = testQueue.getStatus();

    res.json({
      success: true,
      queue: status,
    });
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to get queue status');
    res.status(500).json({
      success: false,
      message: 'Failed to get queue status',
      error: error.message,
    });
  }
});

export default router;
