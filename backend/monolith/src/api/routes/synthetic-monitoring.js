// synthetic-monitoring.js - API routes for Synthetic Monitoring Agent
import express from 'express';
import { SyntheticMonitoringAgent } from '../../agents/SyntheticMonitoringAgent.js';
import logger from '../../utils/logger.js';

const router = express.Router();

// Create a singleton instance of the agent
let agent = null;

/**
 * Get or create agent instance
 */
function getAgent() {
  if (!agent) {
    agent = new SyntheticMonitoringAgent({
      id: 'synthetic-monitoring-agent-001',
      config: {
        checkInterval: 300000, // 5 minutes
        alertLatency: 120000, // 2 minutes
        falsePositiveThreshold: 0.05, // 5%
        requestTimeout: 30000, // 30 seconds
        retryAttempts: 3,
        retryDelay: 5000,
        sslExpiryWarningDays: 30,
        performanceThresholds: {
          responseTime: 2000,
          availabilityPercent: 99.9,
          errorRatePercent: 1.0,
        },
        alertChannels: ['console'],
      },
    });
    agent.initialize();
  }
  return agent;
}

/**
 * GET /api/synthetic-monitoring/health
 * Health check endpoint
 */
router.get('/health', (req, res) => {
  try {
    const agentInstance = getAgent();
    res.json({
      success: true,
      status: 'healthy',
      agent: {
        id: agentInstance.id,
        name: agentInstance.name,
        initialized: agentInstance.initialized,
        isProcessing: agentInstance.isProcessing,
      },
    });
  } catch (error) {
    logger.error({ error: error.message }, 'Health check failed');
    res.status(500).json({
      success: false,
      error: 'Health check failed',
      message: error.message,
    });
  }
});

/**
 * POST /api/synthetic-monitoring/monitors
 * Add a new monitoring endpoint
 */
router.post('/monitors', async (req, res) => {
  try {
    const agentInstance = getAgent();
    const result = await agentInstance.processTask({
      id: `add-monitor-${Date.now()}`,
      payload: {
        type: 'add_monitor',
        data: req.body,
      },
    });

    res.json(result);
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to add monitor');
    res.status(500).json({
      success: false,
      error: 'Failed to add monitor',
      message: error.message,
    });
  }
});

/**
 * DELETE /api/synthetic-monitoring/monitors/:id
 * Remove a monitoring endpoint
 */
router.delete('/monitors/:id', async (req, res) => {
  try {
    const agentInstance = getAgent();
    const result = await agentInstance.processTask({
      id: `remove-monitor-${Date.now()}`,
      payload: {
        type: 'remove_monitor',
        data: { id: req.params.id },
      },
    });

    res.json(result);
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to remove monitor');
    res.status(500).json({
      success: false,
      error: 'Failed to remove monitor',
      message: error.message,
    });
  }
});

/**
 * POST /api/synthetic-monitoring/monitors/:id/check
 * Execute a manual check for a specific monitor
 */
router.post('/monitors/:id/check', async (req, res) => {
  try {
    const agentInstance = getAgent();
    const result = await agentInstance.processTask({
      id: `execute-check-${Date.now()}`,
      payload: {
        type: 'execute_check',
        data: { id: req.params.id },
      },
    });

    res.json(result);
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to execute check');
    res.status(500).json({
      success: false,
      error: 'Failed to execute check',
      message: error.message,
    });
  }
});

/**
 * GET /api/synthetic-monitoring/monitors
 * Get status of all monitors
 */
router.get('/monitors', async (req, res) => {
  try {
    const agentInstance = getAgent();
    const result = await agentInstance.processTask({
      id: `get-status-${Date.now()}`,
      payload: {
        type: 'get_status',
        data: {},
      },
    });

    res.json(result);
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to get monitor status');
    res.status(500).json({
      success: false,
      error: 'Failed to get monitor status',
      message: error.message,
    });
  }
});

/**
 * GET /api/synthetic-monitoring/monitors/:id
 * Get status of a specific monitor
 */
router.get('/monitors/:id', async (req, res) => {
  try {
    const agentInstance = getAgent();
    const result = await agentInstance.processTask({
      id: `get-status-${Date.now()}`,
      payload: {
        type: 'get_status',
        data: { monitorId: req.params.id },
      },
    });

    res.json(result);
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to get monitor status');
    res.status(500).json({
      success: false,
      error: 'Failed to get monitor status',
      message: error.message,
    });
  }
});

/**
 * GET /api/synthetic-monitoring/metrics
 * Get overall metrics
 */
router.get('/metrics', async (req, res) => {
  try {
    const agentInstance = getAgent();
    const result = await agentInstance.processTask({
      id: `get-metrics-${Date.now()}`,
      payload: {
        type: 'get_metrics',
        data: {},
      },
    });

    res.json(result);
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to get metrics');
    res.status(500).json({
      success: false,
      error: 'Failed to get metrics',
      message: error.message,
    });
  }
});

/**
 * POST /api/synthetic-monitoring/ssl-check
 * Check SSL certificate for a URL
 */
router.post('/ssl-check', async (req, res) => {
  try {
    const agentInstance = getAgent();
    const result = await agentInstance.processTask({
      id: `ssl-check-${Date.now()}`,
      payload: {
        type: 'check_ssl',
        data: req.body,
      },
    });

    res.json(result);
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to check SSL certificate');
    res.status(500).json({
      success: false,
      error: 'Failed to check SSL certificate',
      message: error.message,
    });
  }
});

/**
 * POST /api/synthetic-monitoring/user-journey
 * Execute a user journey (sequence of checks)
 */
router.post('/user-journey', async (req, res) => {
  try {
    const agentInstance = getAgent();
    const result = await agentInstance.processTask({
      id: `user-journey-${Date.now()}`,
      payload: {
        type: 'execute_user_journey',
        data: req.body,
      },
    });

    res.json(result);
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to execute user journey');
    res.status(500).json({
      success: false,
      error: 'Failed to execute user journey',
      message: error.message,
    });
  }
});

/**
 * GET /api/synthetic-monitoring/alerts
 * Get all active alerts
 */
router.get('/alerts', async (req, res) => {
  try {
    const agentInstance = getAgent();
    const alerts = Array.from(agentInstance.alerts.entries()).map(([key, alert]) => ({
      key,
      ...alert,
    }));

    res.json({
      success: true,
      alerts,
      totalAlerts: alerts.length,
    });
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to get alerts');
    res.status(500).json({
      success: false,
      error: 'Failed to get alerts',
      message: error.message,
    });
  }
});

/**
 * DELETE /api/synthetic-monitoring/alerts/:key
 * Acknowledge/dismiss an alert
 */
router.delete('/alerts/:key', async (req, res) => {
  try {
    const agentInstance = getAgent();
    const alert = agentInstance.alerts.get(req.params.key);

    if (!alert) {
      return res.status(404).json({
        success: false,
        error: 'Alert not found',
      });
    }

    agentInstance.alerts.delete(req.params.key);

    res.json({
      success: true,
      message: 'Alert acknowledged',
    });
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to acknowledge alert');
    res.status(500).json({
      success: false,
      error: 'Failed to acknowledge alert',
      message: error.message,
    });
  }
});

export default router;
