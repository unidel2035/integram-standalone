/**
 * System Resources Monitoring Routes
 * Issue #2469: Агент мониторинга ресурсов системы
 */

import express from 'express';
import { SystemResourcesMonitor } from '../../services/health/SystemResourcesMonitor.js';
import logger from '../../utils/logger.js';

// Create singleton instance
const monitor = new SystemResourcesMonitor({
  checkInterval: 30000, // 30 seconds
  historySize: 100,
  cpuThreshold: 80.0,
  memoryThreshold: 85.0,
  diskThreshold: 90.0,
  networkErrorsThreshold: 1000
});

// Start monitoring automatically
monitor.start().catch(error => {
  logger.error('Failed to start system resources monitor', { error: error.message });
});

export function createSystemResourcesRoutes() {
  const router = express.Router();

  /**
   * GET /api/system-resources/current
   * Get current system resources metrics
   */
  router.get('/current', async (req, res) => {
    try {
      const current = monitor.getCurrentMetrics();

      if (!current) {
        return res.status(503).json({
          success: false,
          error: 'Monitoring not yet initialized. Please wait a moment and try again.'
        });
      }

      res.json({
        success: true,
        data: current
      });
    } catch (error) {
      logger.error('Failed to get current metrics', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve current metrics',
        message: error.message
      });
    }
  });

  /**
   * GET /api/system-resources/history
   * Get metrics history
   */
  router.get('/history', async (req, res) => {
    try {
      const history = monitor.getMetricsHistory();

      res.json({
        success: true,
        data: history
      });
    } catch (error) {
      logger.error('Failed to get metrics history', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve metrics history',
        message: error.message
      });
    }
  });

  /**
   * GET /api/system-resources/alerts
   * Get active alerts
   */
  router.get('/alerts', async (req, res) => {
    try {
      const alerts = monitor.getAlerts();

      res.json({
        success: true,
        data: {
          alerts,
          count: alerts.length,
          critical: alerts.filter(a => a.severity === 'critical').length,
          warning: alerts.filter(a => a.severity === 'warning').length
        }
      });
    } catch (error) {
      logger.error('Failed to get alerts', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve alerts',
        message: error.message
      });
    }
  });

  /**
   * GET /api/system-resources/predictions
   * Get resource exhaustion predictions
   */
  router.get('/predictions', async (req, res) => {
    try {
      const predictions = monitor.predictExhaustion();

      res.json({
        success: true,
        data: {
          predictions,
          count: predictions.length
        }
      });
    } catch (error) {
      logger.error('Failed to get predictions', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve predictions',
        message: error.message
      });
    }
  });

  /**
   * GET /api/system-resources/recommendations
   * Get optimization recommendations
   */
  router.get('/recommendations', async (req, res) => {
    try {
      const recommendations = monitor.generateRecommendations();

      res.json({
        success: true,
        data: {
          recommendations,
          count: recommendations.length
        }
      });
    } catch (error) {
      logger.error('Failed to get recommendations', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve recommendations',
        message: error.message
      });
    }
  });

  /**
   * GET /api/system-resources/status
   * Get comprehensive status report
   */
  router.get('/status', async (req, res) => {
    try {
      const report = await monitor.getStatusReport();

      res.json({
        success: true,
        data: report
      });
    } catch (error) {
      logger.error('Failed to get status report', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve status report',
        message: error.message
      });
    }
  });

  /**
   * PUT /api/system-resources/thresholds
   * Update alert thresholds
   */
  router.put('/thresholds', async (req, res) => {
    try {
      const { cpu, memory, disk, networkErrors } = req.body;

      if (cpu !== undefined && cpu > 0 && cpu <= 100) {
        monitor.thresholds.cpu = cpu;
      }
      if (memory !== undefined && memory > 0 && memory <= 100) {
        monitor.thresholds.memory = memory;
      }
      if (disk !== undefined && disk > 0 && disk <= 100) {
        monitor.thresholds.disk = disk;
      }
      if (networkErrors !== undefined && networkErrors > 0) {
        monitor.thresholds.networkErrors = networkErrors;
      }

      logger.info('Thresholds updated', { thresholds: monitor.thresholds });

      res.json({
        success: true,
        data: {
          thresholds: monitor.thresholds
        }
      });
    } catch (error) {
      logger.error('Failed to update thresholds', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Failed to update thresholds',
        message: error.message
      });
    }
  });

  /**
   * POST /api/system-resources/collect
   * Force immediate metrics collection
   */
  router.post('/collect', async (req, res) => {
    try {
      const metrics = await monitor.collectMetrics();

      res.json({
        success: true,
        data: metrics,
        message: 'Metrics collected successfully'
      });
    } catch (error) {
      logger.error('Failed to collect metrics', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Failed to collect metrics',
        message: error.message
      });
    }
  });

  return router;
}

export { monitor as systemResourcesMonitor };
