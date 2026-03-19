/**
 * Metrics API Route
 *
 * Exposes Prometheus-compatible metrics endpoint for monitoring
 * Agent operations, API requests, and LLM usage.
 *
 * @module api/routes/metrics
 */

import express from 'express';
import {
  register,
  agentTaskCounter,
  agentActiveGauge,
  httpRequestCounter
} from '../../monitoring/agentMetrics.js';

const router = express.Router();

/**
 * @route GET /api/metrics
 * @description Get Prometheus-formatted metrics
 * @access Public (consider restricting in production)
 */
router.get('/', async (req, res) => {
  try {
    // Update some system metrics before returning
    const memUsage = process.memoryUsage();

    res.set('Content-Type', register.contentType);
    const metrics = await register.metrics();
    res.send(metrics);
  } catch (error) {
    console.error('Error generating metrics:', error);
    res.status(500).send('Error generating metrics');
  }
});

/**
 * @route GET /api/metrics/json
 * @description Get metrics in JSON format for easier debugging
 * @access Public
 */
router.get('/json', async (req, res) => {
  try {
    const memUsage = process.memoryUsage();

    res.json({
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: {
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal,
        external: memUsage.external,
        rss: memUsage.rss
      },
      prometheus: {
        endpoint: '/api/metrics',
        format: 'text/plain; version=0.0.4'
      }
    });
  } catch (error) {
    console.error('Error generating JSON metrics:', error);
    res.status(500).json({ error: 'Error generating metrics' });
  }
});

/**
 * @route GET /api/metrics/health
 * @description Quick health check for monitoring systems
 * @access Public
 */
router.get('/health', (req, res) => {
  const memUsage = process.memoryUsage();
  const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
  const heapTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);

  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: Math.round(process.uptime()),
    memory: {
      heapUsed: `${heapUsedMB}MB`,
      heapTotal: `${heapTotalMB}MB`,
      percentage: Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100)
    },
    node: {
      version: process.version,
      platform: process.platform,
      arch: process.arch
    }
  });
});

/**
 * @route POST /api/metrics/agent/task
 * @description Record an agent task completion
 * @access Internal
 */
router.post('/agent/task', (req, res) => {
  try {
    const { agentType, status, duration } = req.body;

    if (!agentType) {
      return res.status(400).json({ error: 'agentType is required' });
    }

    agentTaskCounter.inc({ agent_type: agentType, status: status || 'success' });

    if (duration !== undefined) {
      // Duration is recorded in the calling code using histogram
    }

    res.json({ recorded: true });
  } catch (error) {
    console.error('Error recording agent task:', error);
    res.status(500).json({ error: 'Error recording metric' });
  }
});

/**
 * @route POST /api/metrics/agent/active
 * @description Update active agent count
 * @access Internal
 */
router.post('/agent/active', (req, res) => {
  try {
    const { agentType, count } = req.body;

    if (!agentType || count === undefined) {
      return res.status(400).json({ error: 'agentType and count are required' });
    }

    agentActiveGauge.set({ agent_type: agentType }, count);

    res.json({ recorded: true });
  } catch (error) {
    console.error('Error updating active agents:', error);
    res.status(500).json({ error: 'Error recording metric' });
  }
});

/**
 * @route GET /api/metrics/summary
 * @description Get a summary of current metrics
 * @access Public
 */
router.get('/summary', async (req, res) => {
  try {
    const memUsage = process.memoryUsage();

    res.json({
      timestamp: new Date().toISOString(),
      system: {
        uptime: process.uptime(),
        nodeVersion: process.version,
        platform: process.platform
      },
      memory: {
        heapUsedMB: Math.round(memUsage.heapUsed / 1024 / 1024),
        heapTotalMB: Math.round(memUsage.heapTotal / 1024 / 1024),
        rssMB: Math.round(memUsage.rss / 1024 / 1024)
      },
      endpoints: {
        prometheus: '/api/metrics',
        json: '/api/metrics/json',
        health: '/api/metrics/health',
        summary: '/api/metrics/summary'
      }
    });
  } catch (error) {
    console.error('Error generating summary:', error);
    res.status(500).json({ error: 'Error generating summary' });
  }
});

export default router;
