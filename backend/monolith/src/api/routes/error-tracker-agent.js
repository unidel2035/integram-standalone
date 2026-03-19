// error-tracker-agent.js - API routes for Error Tracker Agent
import express from 'express';
import logger from '../../utils/logger.js';
import { ErrorTrackerAgent } from '../../agents/templates/error-tracker-agent.js';

export function createErrorTrackerAgentRoutes(orchestrator) {
  const router = express.Router();
  const { db, agentRegistry } = orchestrator;

  // Global error tracker agent instances (cached by organization)
  const agentInstances = new Map();

  /**
   * Helper to get or create error tracker agent instance
   */
  const getAgentInstance = (organizationId, healthMonitorAgent = null) => {
    const key = `error-tracker-${organizationId}`;

    if (!agentInstances.has(key)) {
      const agent = new ErrorTrackerAgent({
        id: key,
        db,
        organizationId,
        agentRegistry,
        healthMonitorAgent
      });
      agentInstances.set(key, agent);
    }

    return agentInstances.get(key);
  };

  /**
   * Log an error
   * POST /api/agents/error-tracker/errors
   */
  router.post('/errors', async (req, res, next) => {
    try {
      const organizationId = req.body.organizationId || req.user?.organizationId;
      const { source, message, stackTrace, context, severity, agentId, userId } = req.body;

      if (!organizationId) {
        return res.status(400).json({ error: 'Organization ID is required' });
      }

      if (!source || !message) {
        return res.status(400).json({ error: 'Source and message are required' });
      }

      const agent = getAgentInstance(organizationId);

      const result = await agent.execute({
        type: 'log_error',
        payload: { source, message, stackTrace, context, severity, agentId, userId }
      });

      res.json(result);
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to log error');
      next(error);
    }
  });

  /**
   * Batch log multiple errors
   * POST /api/agents/error-tracker/errors/batch
   */
  router.post('/errors/batch', async (req, res, next) => {
    try {
      const organizationId = req.body.organizationId || req.user?.organizationId;
      const { errors } = req.body;

      if (!organizationId) {
        return res.status(400).json({ error: 'Organization ID is required' });
      }

      if (!Array.isArray(errors) || errors.length === 0) {
        return res.status(400).json({ error: 'Errors array is required and must not be empty' });
      }

      const agent = getAgentInstance(organizationId);

      // Log each error
      const results = [];
      for (const errorData of errors) {
        try {
          const result = await agent.execute({
            type: 'log_error',
            payload: errorData
          });
          results.push({ success: true, ...result });
        } catch (err) {
          results.push({ success: false, error: err.message, errorData });
        }
      }

      res.json({
        success: true,
        results,
        totalProcessed: results.length,
        successCount: results.filter(r => r.success).length,
        failureCount: results.filter(r => !r.success).length
      });
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to batch log errors');
      next(error);
    }
  });

  /**
   * Get error details
   * GET /api/agents/error-tracker/errors/:errorId
   */
  router.get('/errors/:errorId', async (req, res, next) => {
    try {
      const organizationId = req.query.organizationId || req.user?.organizationId;
      const errorId = req.params.errorId;

      if (!organizationId) {
        return res.status(400).json({ error: 'Organization ID is required' });
      }

      const agent = getAgentInstance(organizationId);

      const result = await agent.execute({
        type: 'get_error',
        payload: { errorId }
      });

      res.json(result);
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to get error');
      next(error);
    }
  });

  /**
   * Search errors
   * GET /api/agents/error-tracker/errors
   */
  router.get('/errors', async (req, res, next) => {
    try {
      const organizationId = req.query.organizationId || req.user?.organizationId;

      if (!organizationId) {
        return res.status(400).json({ error: 'Organization ID is required' });
      }

      const agent = getAgentInstance(organizationId);

      const result = await agent.execute({
        type: 'search_errors',
        payload: {
          source: req.query.source,
          severity: req.query.severity,
          agentId: req.query.agentId,
          startDate: req.query.startDate,
          endDate: req.query.endDate,
          searchQuery: req.query.q || req.query.search,
          limit: parseInt(req.query.limit) || 100,
          offset: parseInt(req.query.offset) || 0
        }
      });

      res.json(result);
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to search errors');
      next(error);
    }
  });

  /**
   * Get error group details
   * GET /api/agents/error-tracker/groups/:errorGroupId
   */
  router.get('/groups/:errorGroupId', async (req, res, next) => {
    try {
      const organizationId = req.query.organizationId || req.user?.organizationId;
      const errorGroupId = req.params.errorGroupId;

      if (!organizationId) {
        return res.status(400).json({ error: 'Organization ID is required' });
      }

      const agent = getAgentInstance(organizationId);

      const result = await agent.execute({
        type: 'get_error_group',
        payload: {
          errorGroupId,
          includeRecentErrors: req.query.includeRecentErrors !== 'false',
          recentErrorsLimit: parseInt(req.query.recentErrorsLimit) || 10
        }
      });

      res.json(result);
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to get error group');
      next(error);
    }
  });

  /**
   * List error groups
   * GET /api/agents/error-tracker/groups
   */
  router.get('/groups', async (req, res, next) => {
    try {
      const organizationId = req.query.organizationId || req.user?.organizationId;

      if (!organizationId) {
        return res.status(400).json({ error: 'Organization ID is required' });
      }

      const status = req.query.status;
      const limit = parseInt(req.query.limit) || 50;
      const offset = parseInt(req.query.offset) || 0;

      const conditions = ['organization_id = $1'];
      const values = [organizationId];
      let paramCounter = 2;

      if (status) {
        conditions.push(`status = $${paramCounter++}`);
        values.push(status);
      }

      values.push(limit);
      values.push(offset);

      const result = await db.query(`
        SELECT
          id, fingerprint, title, description, status,
          occurrence_count, first_seen_at, last_seen_at,
          created_at, updated_at
        FROM agent_error_tracker_groups
        WHERE ${conditions.join(' AND ')}
        ORDER BY last_seen_at DESC
        LIMIT $${paramCounter++} OFFSET $${paramCounter++}
      `, values);

      res.json({
        success: true,
        errorGroups: result.rows,
        count: result.rows.length
      });
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to list error groups');
      next(error);
    }
  });

  /**
   * Resolve error group
   * POST /api/agents/error-tracker/groups/:errorGroupId/resolve
   */
  router.post('/groups/:errorGroupId/resolve', async (req, res, next) => {
    try {
      const organizationId = req.body.organizationId || req.user?.organizationId;
      const errorGroupId = req.params.errorGroupId;
      const { resolvedBy, resolutionNotes } = req.body;

      if (!organizationId) {
        return res.status(400).json({ error: 'Organization ID is required' });
      }

      const agent = getAgentInstance(organizationId);

      const result = await agent.execute({
        type: 'resolve_error',
        payload: { errorGroupId, resolvedBy, resolutionNotes }
      });

      res.json(result);
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to resolve error group');
      next(error);
    }
  });

  /**
   * Ignore error group
   * POST /api/agents/error-tracker/groups/:errorGroupId/ignore
   */
  router.post('/groups/:errorGroupId/ignore', async (req, res, next) => {
    try {
      const organizationId = req.body.organizationId || req.user?.organizationId;
      const errorGroupId = req.params.errorGroupId;

      if (!organizationId) {
        return res.status(400).json({ error: 'Organization ID is required' });
      }

      const result = await db.query(`
        UPDATE agent_error_tracker_groups
        SET status = $1, updated_at = NOW()
        WHERE id = $2 AND organization_id = $3
        RETURNING id, status, updated_at
      `, ['ignored', errorGroupId, organizationId]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Error group not found' });
      }

      res.json({
        success: true,
        errorGroup: result.rows[0]
      });
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to ignore error group');
      next(error);
    }
  });

  /**
   * Get error statistics
   * GET /api/agents/error-tracker/statistics
   */
  router.get('/statistics', async (req, res, next) => {
    try {
      const organizationId = req.query.organizationId || req.user?.organizationId;

      if (!organizationId) {
        return res.status(400).json({ error: 'Organization ID is required' });
      }

      const agent = getAgentInstance(organizationId);

      const result = await agent.execute({
        type: 'get_error_statistics',
        payload: {
          startDate: req.query.startDate,
          endDate: req.query.endDate,
          groupBy: req.query.groupBy || 'severity'
        }
      });

      res.json(result);
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to get error statistics');
      next(error);
    }
  });

  /**
   * Get error trends
   * GET /api/agents/error-tracker/trends
   */
  router.get('/trends', async (req, res, next) => {
    try {
      const organizationId = req.query.organizationId || req.user?.organizationId;

      if (!organizationId) {
        return res.status(400).json({ error: 'Organization ID is required' });
      }

      const agent = getAgentInstance(organizationId);

      const result = await agent.execute({
        type: 'get_error_trends',
        payload: {
          startDate: req.query.startDate,
          endDate: req.query.endDate,
          interval: req.query.interval || 'hour'
        }
      });

      res.json(result);
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to get error trends');
      next(error);
    }
  });

  /**
   * Detect error patterns
   * GET /api/agents/error-tracker/patterns
   */
  router.get('/patterns', async (req, res, next) => {
    try {
      const organizationId = req.query.organizationId || req.user?.organizationId;

      if (!organizationId) {
        return res.status(400).json({ error: 'Organization ID is required' });
      }

      const agent = getAgentInstance(organizationId);

      const result = await agent.execute({
        type: 'detect_patterns',
        payload: {
          minOccurrences: parseInt(req.query.minOccurrences) || undefined,
          timeWindow: parseInt(req.query.timeWindow) || undefined
        }
      });

      res.json(result);
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to detect error patterns');
      next(error);
    }
  });

  /**
   * Get top errors by occurrence
   * GET /api/agents/error-tracker/top-errors
   */
  router.get('/top-errors', async (req, res, next) => {
    try {
      const organizationId = req.query.organizationId || req.user?.organizationId;

      if (!organizationId) {
        return res.status(400).json({ error: 'Organization ID is required' });
      }

      const agent = getAgentInstance(organizationId);

      const result = await agent.execute({
        type: 'get_top_errors',
        payload: {
          limit: parseInt(req.query.limit) || 10,
          timeWindow: req.query.timeWindow ? parseInt(req.query.timeWindow) : undefined
        }
      });

      res.json(result);
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to get top errors');
      next(error);
    }
  });

  /**
   * Cleanup old errors
   * DELETE /api/agents/error-tracker/cleanup
   */
  router.delete('/cleanup', async (req, res, next) => {
    try {
      const organizationId = req.body.organizationId || req.user?.organizationId;

      if (!organizationId) {
        return res.status(400).json({ error: 'Organization ID is required' });
      }

      const agent = getAgentInstance(organizationId);

      const result = await agent.execute({
        type: 'cleanup_old_errors',
        payload: {
          retentionDays: parseInt(req.body.retentionDays) || undefined
        }
      });

      res.json(result);
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to cleanup old errors');
      next(error);
    }
  });

  /**
   * Integration: Get errors for specific agent (for Health Monitor)
   * GET /api/agents/error-tracker/by-agent/:agentId
   */
  router.get('/by-agent/:agentId', async (req, res, next) => {
    try {
      const organizationId = req.query.organizationId || req.user?.organizationId;
      const agentId = req.params.agentId;

      if (!organizationId) {
        return res.status(400).json({ error: 'Organization ID is required' });
      }

      const agent = getAgentInstance(organizationId);

      const result = await agent.execute({
        type: 'search_errors',
        payload: {
          agentId,
          limit: parseInt(req.query.limit) || 50,
          offset: parseInt(req.query.offset) || 0,
          startDate: req.query.startDate,
          endDate: req.query.endDate
        }
      });

      res.json(result);
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to get errors for agent');
      next(error);
    }
  });

  /**
   * Get error count by severity for agent (for Health Monitor integration)
   * GET /api/agents/error-tracker/agent-summary/:agentId
   */
  router.get('/agent-summary/:agentId', async (req, res, next) => {
    try {
      const organizationId = req.query.organizationId || req.user?.organizationId;
      const agentId = req.params.agentId;
      const hours = parseInt(req.query.hours) || 24;

      if (!organizationId) {
        return res.status(400).json({ error: 'Organization ID is required' });
      }

      const result = await db.query(`
        SELECT
          severity,
          COUNT(*) as count,
          MAX(created_at) as last_error_at
        FROM agent_error_tracker_errors
        WHERE organization_id = $1
          AND agent_id = $2
          AND created_at >= NOW() - INTERVAL '${hours} hours'
        GROUP BY severity
        ORDER BY
          CASE severity
            WHEN 'critical' THEN 1
            WHEN 'high' THEN 2
            WHEN 'medium' THEN 3
            WHEN 'low' THEN 4
            ELSE 5
          END
      `, [organizationId, agentId]);

      const totalErrors = result.rows.reduce((sum, row) => sum + parseInt(row.count), 0);

      res.json({
        success: true,
        agentId,
        timeWindowHours: hours,
        totalErrors,
        bySeverity: result.rows,
        hasErrors: totalErrors > 0,
        hasCriticalErrors: result.rows.some(r => r.severity === 'critical' && parseInt(r.count) > 0)
      });
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to get agent error summary');
      next(error);
    }
  });

  return router;
}

export default createErrorTrackerAgentRoutes;
