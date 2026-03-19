// external-api-monitor.js - Routes for External API Monitoring Agent
// Issue #2493 - External API monitoring and health checks

import express from 'express';
import { ExternalApiMonitorAgent } from '../../agents/ExternalApiMonitorAgent.js';
import logger from '../../utils/logger.js';

/**
 * Create External API Monitoring routes
 */
export function createExternalApiMonitorRoutes() {
  const router = express.Router();

  // Create singleton agent instance
  const monitorAgent = new ExternalApiMonitorAgent({
    name: 'SystemExternalApiMonitor',
    autoStart: true,
    checkInterval: 60000, // 1 minute
    enableCircuitBreaker: true,
    enableAutoFallback: true
  });

  /**
   * GET /api/external-api-monitor/status
   * Get monitoring status and summary
   */
  router.get('/status', async (req, res) => {
    try {
      const summary = monitorAgent.getSummary();
      const status = monitorAgent.getStatus();

      res.json({
        success: true,
        data: {
          ...status,
          summary
        }
      });
    } catch (error) {
      logger.error({ error: error.message }, 'Error getting external API monitor status');
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * GET /api/external-api-monitor/endpoints
   * Get all monitored endpoints
   */
  router.get('/endpoints', async (req, res) => {
    try {
      const endpoints = monitorAgent.getAllEndpoints();

      res.json({
        success: true,
        data: endpoints
      });
    } catch (error) {
      logger.error({ error: error.message }, 'Error getting endpoints');
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * GET /api/external-api-monitor/endpoints/:id
   * Get specific endpoint details
   */
  router.get('/endpoints/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const endpoint = monitorAgent.getEndpoint(id);

      if (!endpoint) {
        return res.status(404).json({
          success: false,
          error: `Endpoint ${id} not found`
        });
      }

      res.json({
        success: true,
        data: endpoint
      });
    } catch (error) {
      logger.error({ error: error.message }, 'Error getting endpoint');
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * POST /api/external-api-monitor/endpoints
   * Register a new endpoint for monitoring
   */
  router.post('/endpoints', async (req, res) => {
    try {
      const config = req.body;

      // Validate required fields
      if (!config.id || !config.url) {
        return res.status(400).json({
          success: false,
          error: 'Endpoint id and url are required'
        });
      }

      const endpoint = monitorAgent.registerEndpoint(config);

      res.status(201).json({
        success: true,
        data: endpoint
      });
    } catch (error) {
      logger.error({ error: error.message }, 'Error registering endpoint');
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * DELETE /api/external-api-monitor/endpoints/:id
   * Unregister an endpoint
   */
  router.delete('/endpoints/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const removed = monitorAgent.unregisterEndpoint(id);

      if (!removed) {
        return res.status(404).json({
          success: false,
          error: `Endpoint ${id} not found`
        });
      }

      res.json({
        success: true,
        message: `Endpoint ${id} unregistered`
      });
    } catch (error) {
      logger.error({ error: error.message }, 'Error unregistering endpoint');
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * POST /api/external-api-monitor/endpoints/:id/check
   * Manually trigger health check for an endpoint
   */
  router.post('/endpoints/:id/check', async (req, res) => {
    try {
      const { id } = req.params;
      const result = await monitorAgent.checkEndpoint(id);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error({ error: error.message }, 'Error checking endpoint');
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * POST /api/external-api-monitor/check-all
   * Trigger health check for all endpoints
   */
  router.post('/check-all', async (req, res) => {
    try {
      await monitorAgent.checkAllEndpoints();
      const summary = monitorAgent.getSummary();

      res.json({
        success: true,
        data: summary
      });
    } catch (error) {
      logger.error({ error: error.message }, 'Error checking all endpoints');
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * POST /api/external-api-monitor/endpoints/:id/reset-stats
   * Reset statistics for an endpoint
   */
  router.post('/endpoints/:id/reset-stats', async (req, res) => {
    try {
      const { id } = req.params;
      monitorAgent.resetEndpointStats(id);

      res.json({
        success: true,
        message: `Statistics reset for endpoint ${id}`
      });
    } catch (error) {
      logger.error({ error: error.message }, 'Error resetting endpoint stats');
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * POST /api/external-api-monitor/start
   * Start monitoring
   */
  router.post('/start', async (req, res) => {
    try {
      monitorAgent.startMonitoring();

      res.json({
        success: true,
        message: 'Monitoring started'
      });
    } catch (error) {
      logger.error({ error: error.message }, 'Error starting monitoring');
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * POST /api/external-api-monitor/stop
   * Stop monitoring
   */
  router.post('/stop', async (req, res) => {
    try {
      monitorAgent.stopMonitoring();

      res.json({
        success: true,
        message: 'Monitoring stopped'
      });
    } catch (error) {
      logger.error({ error: error.message }, 'Error stopping monitoring');
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * GET /api/external-api-monitor/summary
   * Get monitoring summary
   */
  router.get('/summary', async (req, res) => {
    try {
      const summary = monitorAgent.getSummary();

      res.json({
        success: true,
        data: summary
      });
    } catch (error) {
      logger.error({ error: error.message }, 'Error getting summary');
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * GET /api/external-api-monitor/sla-violations
   * Get current SLA violations
   */
  router.get('/sla-violations', async (req, res) => {
    try {
      const summary = monitorAgent.getSummary();

      res.json({
        success: true,
        data: summary.slaViolations
      });
    } catch (error) {
      logger.error({ error: error.message }, 'Error getting SLA violations');
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  return router;
}

export default createExternalApiMonitorRoutes;
