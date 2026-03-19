// health-monitor-agent.js - API routes for Health Monitor Agent
import express from 'express';
import logger from '../../utils/logger.js';
import { HealthMonitorAgent } from '../../agents/templates/health-monitor-agent.js';

export function createHealthMonitorAgentRoutes(orchestrator) {
  const router = express.Router();
  const { db, agentRegistry } = orchestrator;

  // Global monitoring agent instance
  let monitoringAgent = null;

  /**
   * Helper to get or create monitoring agent instance
   */
  const getMonitoringAgent = (organizationId) => {
    if (!monitoringAgent || monitoringAgent.organizationId !== organizationId) {
      monitoringAgent = new HealthMonitorAgent({
        id: `health-monitor-${organizationId}`,
        db,
        organizationId,
        agentRegistry
      });
    }
    return monitoringAgent;
  };

  /**
   * Start monitoring for an organization
   * POST /api/agents/health-monitor/start
   */
  router.post('/start', async (req, res, next) => {
    try {
      const organizationId = req.body.organizationId || req.user?.organizationId;

      if (!organizationId) {
        return res.status(400).json({ error: 'Organization ID is required' });
      }

      const agent = getMonitoringAgent(organizationId);
      await agent.initialize();

      const result = await agent.execute({
        type: 'start_monitoring',
        payload: {}
      });

      res.json(result);
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to start monitoring');
      next(error);
    }
  });

  /**
   * Stop monitoring
   * POST /api/agents/health-monitor/stop
   */
  router.post('/stop', async (req, res, next) => {
    try {
      const organizationId = req.body.organizationId || req.user?.organizationId;

      if (!organizationId) {
        return res.status(400).json({ error: 'Organization ID is required' });
      }

      const agent = getMonitoringAgent(organizationId);

      const result = await agent.execute({
        type: 'stop_monitoring',
        payload: {}
      });

      res.json(result);
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to stop monitoring');
      next(error);
    }
  });

  /**
   * Check health of a specific agent
   * POST /api/agents/health-monitor/check/:agentId
   */
  router.post('/check/:agentId', async (req, res, next) => {
    try {
      const organizationId = req.body.organizationId || req.user?.organizationId;
      const agentId = req.params.agentId;

      if (!organizationId) {
        return res.status(400).json({ error: 'Organization ID is required' });
      }

      const agent = getMonitoringAgent(organizationId);

      const result = await agent.execute({
        type: 'check_agent_health',
        payload: { agentId }
      });

      res.json(result);
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to check agent health');
      next(error);
    }
  });

  /**
   * Get current health status
   * GET /api/agents/health-monitor/status
   */
  router.get('/status', async (req, res, next) => {
    try {
      const organizationId = req.query.organizationId || req.user?.organizationId;

      if (!organizationId) {
        return res.status(400).json({ error: 'Organization ID is required' });
      }

      const agent = getMonitoringAgent(organizationId);

      const result = await agent.execute({
        type: 'get_health_status',
        payload: {
          agentId: req.query.agentId,
          limit: parseInt(req.query.limit) || 100
        }
      });

      res.json(result);
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to get health status');
      next(error);
    }
  });

  /**
   * Get health history
   * GET /api/agents/health-monitor/history/:agentId
   */
  router.get('/history/:agentId', async (req, res, next) => {
    try {
      const organizationId = req.query.organizationId || req.user?.organizationId;
      const agentId = req.params.agentId;

      if (!organizationId) {
        return res.status(400).json({ error: 'Organization ID is required' });
      }

      const agent = getMonitoringAgent(organizationId);

      const result = await agent.execute({
        type: 'get_health_history',
        payload: {
          agentId,
          startDate: req.query.startDate,
          endDate: req.query.endDate,
          limit: parseInt(req.query.limit) || 1000
        }
      });

      res.json(result);
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to get health history');
      next(error);
    }
  });

  /**
   * Get metrics
   * GET /api/agents/health-monitor/metrics
   */
  router.get('/metrics', async (req, res, next) => {
    try {
      const organizationId = req.query.organizationId || req.user?.organizationId;

      if (!organizationId) {
        return res.status(400).json({ error: 'Organization ID is required' });
      }

      const agent = getMonitoringAgent(organizationId);

      const result = await agent.execute({
        type: 'get_metrics',
        payload: {
          agentId: req.query.agentId,
          period: req.query.period || '24h'
        }
      });

      res.json(result);
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to get metrics');
      next(error);
    }
  });

  /**
   * Configure alerts
   * POST /api/agents/health-monitor/alerts/configure
   */
  router.post('/alerts/configure', async (req, res, next) => {
    try {
      const organizationId = req.body.organizationId || req.user?.organizationId;

      if (!organizationId) {
        return res.status(400).json({ error: 'Organization ID is required' });
      }

      const agent = getMonitoringAgent(organizationId);

      const result = await agent.execute({
        type: 'configure_alerts',
        payload: {
          agentId: req.body.agentId,
          alertConfig: req.body.alertConfig
        }
      });

      res.json(result);
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to configure alerts');
      next(error);
    }
  });

  /**
   * Get alerts
   * GET /api/agents/health-monitor/alerts
   */
  router.get('/alerts', async (req, res, next) => {
    try {
      const organizationId = req.query.organizationId || req.user?.organizationId;

      if (!organizationId) {
        return res.status(400).json({ error: 'Organization ID is required' });
      }

      const result = await db.query(`
        SELECT
          id, agent_id, alert_type, severity, message,
          details, status, acknowledged_at, resolved_at, created_at
        FROM agent_alerts
        WHERE organization_id = $1
          ${req.query.agentId ? 'AND agent_id = $2' : ''}
          ${req.query.status ? 'AND status = $' + (req.query.agentId ? '3' : '2') : ''}
        ORDER BY created_at DESC
        LIMIT ${parseInt(req.query.limit) || 100}
      `, req.query.agentId
        ? (req.query.status ? [organizationId, req.query.agentId, req.query.status] : [organizationId, req.query.agentId])
        : (req.query.status ? [organizationId, req.query.status] : [organizationId])
      );

      res.json({
        success: true,
        alerts: result.rows,
        count: result.rows.length
      });
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to get alerts');
      next(error);
    }
  });

  /**
   * Acknowledge alert
   * POST /api/agents/health-monitor/alerts/:id/acknowledge
   */
  router.post('/alerts/:id/acknowledge', async (req, res, next) => {
    try {
      const organizationId = req.body.organizationId || req.user?.organizationId;
      const alertId = req.params.id;

      if (!organizationId) {
        return res.status(400).json({ error: 'Organization ID is required' });
      }

      const result = await db.query(`
        UPDATE agent_alerts
        SET acknowledged_at = NOW(), status = 'acknowledged'
        WHERE id = $1 AND organization_id = $2
        RETURNING id, agent_id, alert_type, status, acknowledged_at
      `, [alertId, organizationId]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Alert not found' });
      }

      res.json({
        success: true,
        alert: result.rows[0]
      });
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to acknowledge alert');
      next(error);
    }
  });

  /**
   * Resolve alert
   * POST /api/agents/health-monitor/alerts/:id/resolve
   */
  router.post('/alerts/:id/resolve', async (req, res, next) => {
    try {
      const organizationId = req.body.organizationId || req.user?.organizationId;
      const alertId = req.params.id;

      if (!organizationId) {
        return res.status(400).json({ error: 'Organization ID is required' });
      }

      const result = await db.query(`
        UPDATE agent_alerts
        SET resolved_at = NOW(), status = 'resolved'
        WHERE id = $1 AND organization_id = $2
        RETURNING id, agent_id, alert_type, status, resolved_at
      `, [alertId, organizationId]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Alert not found' });
      }

      res.json({
        success: true,
        alert: result.rows[0]
      });
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to resolve alert');
      next(error);
    }
  });

  return router;
}

export default createHealthMonitorAgentRoutes;
