// monitoring-alerts.js - API routes for Monitoring and Alerts Agent
// Issue #3045 - Phase 3.3: Monitoring and Alerts Agent
import express from 'express';
import { MonitoringAlertsAgent } from '../../agents/MonitoringAlertsAgent.js';
import logger from '../../utils/logger.js';

/**
 * Create monitoring and alerts routes
 * Provides endpoints for comprehensive monitoring and alerting
 */
export function createMonitoringAlertsRoutes() {
  const router = express.Router();

  // Create a global monitoring agent instance
  const monitoringAgent = new MonitoringAlertsAgent({
    id: 'monitoring_alerts_main',
    metadata: { version: '1.0.0' },
    autoStart: true // Start monitoring automatically
  });

  monitoringAgent.initialize();

  /**
   * POST /api/monitoring-alerts/metrics/define
   * Define a new metric
   */
  router.post('/metrics/define', async (req, res) => {
    try {
      const result = await monitoringAgent.processTask({
        id: `task_${Date.now()}`,
        type: 'define_metric',
        payload: req.body
      });

      res.json({
        success: true,
        ...result
      });
    } catch (error) {
      logger.error({ error: error.message }, 'Metric definition failed');
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * POST /api/monitoring-alerts/metrics/record
   * Record a metric value
   */
  router.post('/metrics/record', async (req, res) => {
    try {
      const { name, value, dimensions } = req.body;

      if (!name || value === undefined) {
        return res.status(400).json({
          success: false,
          error: 'name and value are required'
        });
      }

      const result = await monitoringAgent.processTask({
        id: `task_${Date.now()}`,
        type: 'record_metric',
        payload: { name, value, dimensions }
      });

      res.json({
        success: true,
        ...result
      });
    } catch (error) {
      logger.error({ error: error.message }, 'Metric recording failed');
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * POST /api/monitoring-alerts/metrics/query
   * Query metrics with filters
   */
  router.post('/metrics/query', async (req, res) => {
    try {
      const result = await monitoringAgent.processTask({
        id: `task_${Date.now()}`,
        type: 'query_metrics',
        payload: req.body
      });

      res.json({
        success: true,
        ...result
      });
    } catch (error) {
      logger.error({ error: error.message }, 'Metrics query failed');
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * GET /api/monitoring-alerts/metrics/:metricId
   * Get a specific metric
   */
  router.get('/metrics/:metricId', async (req, res) => {
    try {
      const { metricId } = req.params;

      const result = await monitoringAgent.processTask({
        id: `task_${Date.now()}`,
        type: 'get_metric',
        payload: { metricId }
      });

      res.json({
        success: true,
        ...result
      });
    } catch (error) {
      logger.error({ error: error.message }, 'Get metric failed');
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * POST /api/monitoring-alerts/alert-rules
   * Create a new alert rule
   */
  router.post('/alert-rules', async (req, res) => {
    try {
      const result = await monitoringAgent.processTask({
        id: `task_${Date.now()}`,
        type: 'create_alert_rule',
        payload: req.body
      });

      res.json({
        success: true,
        ...result
      });
    } catch (error) {
      logger.error({ error: error.message }, 'Alert rule creation failed');
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * PUT /api/monitoring-alerts/alert-rules/:name
   * Update an alert rule
   */
  router.put('/alert-rules/:name', async (req, res) => {
    try {
      const { name } = req.params;

      const result = await monitoringAgent.processTask({
        id: `task_${Date.now()}`,
        type: 'update_alert_rule',
        payload: { name, updates: req.body }
      });

      res.json({
        success: true,
        ...result
      });
    } catch (error) {
      logger.error({ error: error.message }, 'Alert rule update failed');
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * DELETE /api/monitoring-alerts/alert-rules/:name
   * Delete an alert rule
   */
  router.delete('/alert-rules/:name', async (req, res) => {
    try {
      const { name } = req.params;

      const result = await monitoringAgent.processTask({
        id: `task_${Date.now()}`,
        type: 'delete_alert_rule',
        payload: { name }
      });

      res.json({
        success: true,
        ...result
      });
    } catch (error) {
      logger.error({ error: error.message }, 'Alert rule deletion failed');
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * GET /api/monitoring-alerts/alerts
   * Get alerts with optional filters
   */
  router.get('/alerts', async (req, res) => {
    try {
      const filters = {
        severity: req.query.severity,
        status: req.query.status,
        ruleId: req.query.ruleId,
        startTime: req.query.startTime,
        endTime: req.query.endTime,
        limit: parseInt(req.query.limit) || 100,
        offset: parseInt(req.query.offset) || 0
      };

      const result = await monitoringAgent.processTask({
        id: `task_${Date.now()}`,
        type: 'get_alerts',
        payload: filters
      });

      res.json({
        success: true,
        ...result
      });
    } catch (error) {
      logger.error({ error: error.message }, 'Get alerts failed');
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * POST /api/monitoring-alerts/alerts/:alertId/acknowledge
   * Acknowledge an alert
   */
  router.post('/alerts/:alertId/acknowledge', async (req, res) => {
    try {
      const { alertId } = req.params;
      const { acknowledgedBy } = req.body;

      const result = await monitoringAgent.processTask({
        id: `task_${Date.now()}`,
        type: 'acknowledge_alert',
        payload: { alertId, acknowledgedBy }
      });

      res.json({
        success: true,
        ...result
      });
    } catch (error) {
      logger.error({ error: error.message }, 'Alert acknowledgment failed');
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * POST /api/monitoring-alerts/alerts/:alertId/resolve
   * Resolve an alert
   */
  router.post('/alerts/:alertId/resolve', async (req, res) => {
    try {
      const { alertId } = req.params;
      const { resolvedBy, resolution } = req.body;

      const result = await monitoringAgent.processTask({
        id: `task_${Date.now()}`,
        type: 'resolve_alert',
        payload: { alertId, resolvedBy, resolution }
      });

      res.json({
        success: true,
        ...result
      });
    } catch (error) {
      logger.error({ error: error.message }, 'Alert resolution failed');
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * POST /api/monitoring-alerts/anomalies/detect
   * Detect anomalies in metrics
   */
  router.post('/anomalies/detect', async (req, res) => {
    try {
      const { metric, timeWindow } = req.body;

      if (!metric) {
        return res.status(400).json({
          success: false,
          error: 'metric is required'
        });
      }

      const result = await monitoringAgent.processTask({
        id: `task_${Date.now()}`,
        type: 'detect_anomalies',
        payload: { metric, timeWindow }
      });

      res.json({
        success: true,
        ...result
      });
    } catch (error) {
      logger.error({ error: error.message }, 'Anomaly detection failed');
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * POST /api/monitoring-alerts/thresholds/check
   * Check thresholds for all metrics
   */
  router.post('/thresholds/check', async (req, res) => {
    try {
      const result = await monitoringAgent.processTask({
        id: `task_${Date.now()}`,
        type: 'check_thresholds',
        payload: req.body
      });

      res.json({
        success: true,
        ...result
      });
    } catch (error) {
      logger.error({ error: error.message }, 'Threshold check failed');
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * POST /api/monitoring-alerts/monitoring/start
   * Start monitoring
   */
  router.post('/monitoring/start', async (req, res) => {
    try {
      const result = await monitoringAgent.processTask({
        id: `task_${Date.now()}`,
        type: 'start_monitoring',
        payload: {}
      });

      res.json({
        success: true,
        ...result
      });
    } catch (error) {
      logger.error({ error: error.message }, 'Start monitoring failed');
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * POST /api/monitoring-alerts/monitoring/stop
   * Stop monitoring
   */
  router.post('/monitoring/stop', async (req, res) => {
    try {
      const result = await monitoringAgent.processTask({
        id: `task_${Date.now()}`,
        type: 'stop_monitoring',
        payload: {}
      });

      res.json({
        success: true,
        ...result
      });
    } catch (error) {
      logger.error({ error: error.message }, 'Stop monitoring failed');
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * GET /api/monitoring-alerts/status
   * Get monitoring status
   */
  router.get('/status', async (req, res) => {
    try {
      const result = await monitoringAgent.processTask({
        id: `task_${Date.now()}`,
        type: 'get_status',
        payload: {}
      });

      res.json({
        success: true,
        ...result
      });
    } catch (error) {
      logger.error({ error: error.message }, 'Get status failed');
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * GET /api/monitoring-alerts/stats
   * Get agent statistics
   */
  router.get('/stats', async (req, res) => {
    try {
      const result = await monitoringAgent.processTask({
        id: `task_${Date.now()}`,
        type: 'get_stats',
        payload: {}
      });

      res.json({
        success: true,
        ...result
      });
    } catch (error) {
      logger.error({ error: error.message }, 'Get stats failed');
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * POST /api/monitoring-alerts/channels/configure
   * Configure notification channel
   */
  router.post('/channels/configure', async (req, res) => {
    try {
      const { type, enabled, config } = req.body;

      if (!type) {
        return res.status(400).json({
          success: false,
          error: 'type is required'
        });
      }

      const result = await monitoringAgent.processTask({
        id: `task_${Date.now()}`,
        type: 'configure_channel',
        payload: { type, enabled, config }
      });

      res.json({
        success: true,
        ...result
      });
    } catch (error) {
      logger.error({ error: error.message }, 'Channel configuration failed');
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * POST /api/monitoring-alerts/channels/:type/test
   * Test notification channel
   */
  router.post('/channels/:type/test', async (req, res) => {
    try {
      const { type } = req.params;

      const result = await monitoringAgent.processTask({
        id: `task_${Date.now()}`,
        type: 'test_channel',
        payload: { type }
      });

      res.json({
        success: true,
        ...result
      });
    } catch (error) {
      logger.error({ error: error.message }, 'Channel test failed');
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * POST /api/monitoring-alerts/escalation/policies
   * Create escalation policy
   */
  router.post('/escalation/policies', async (req, res) => {
    try {
      const result = await monitoringAgent.processTask({
        id: `task_${Date.now()}`,
        type: 'create_escalation_policy',
        payload: req.body
      });

      res.json({
        success: true,
        ...result
      });
    } catch (error) {
      logger.error({ error: error.message }, 'Escalation policy creation failed');
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * PUT /api/monitoring-alerts/escalation/policies/:id
   * Update escalation policy
   */
  router.put('/escalation/policies/:id', async (req, res) => {
    try {
      const { id } = req.params;

      const result = await monitoringAgent.processTask({
        id: `task_${Date.now()}`,
        type: 'update_escalation_policy',
        payload: { id, updates: req.body }
      });

      res.json({
        success: true,
        ...result
      });
    } catch (error) {
      logger.error({ error: error.message }, 'Escalation policy update failed');
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // Shutdown handler
  process.on('SIGTERM', async () => {
    logger.info('SIGTERM received, shutting down monitoring agent');
    await monitoringAgent.shutdown();
  });

  process.on('SIGINT', async () => {
    logger.info('SIGINT received, shutting down monitoring agent');
    await monitoringAgent.shutdown();
  });

  return router;
}

export default createMonitoringAlertsRoutes;
