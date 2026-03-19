// api-integration-agent.js - API routes for API Integration Agent
import express from 'express';
import logger from '../../utils/logger.js';
import { APIIntegrationAgent } from '../../agents/templates/api-integration-agent.js';

export function createAPIIntegrationAgentRoutes(orchestrator) {
  const router = express.Router();
  const { db } = orchestrator;

  /**
   * Helper to get or create agent instance for organization
   */
  const getAgentInstance = (organizationId) => {
    return new APIIntegrationAgent({
      id: `api-integration-${organizationId}`,
      db,
      organizationId
    });
  };

  /**
   * Create a new data source connection
   * POST /api/agents/api-integration/connections
   */
  router.post('/connections', async (req, res, next) => {
    try {
      const organizationId = req.body.organizationId || req.user?.organizationId;

      if (!organizationId) {
        return res.status(400).json({ error: 'Organization ID is required' });
      }

      const agent = getAgentInstance(organizationId);

      const result = await agent.execute({
        type: 'create_connection',
        payload: req.body
      });

      res.status(201).json(result);
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to create connection');
      next(error);
    }
  });

  /**
   * Test a connection
   * POST /api/agents/api-integration/connections/:id/test
   */
  router.post('/connections/:id/test', async (req, res, next) => {
    try {
      const organizationId = req.body.organizationId || req.user?.organizationId;
      const connectionId = req.params.id;

      if (!organizationId) {
        return res.status(400).json({ error: 'Organization ID is required' });
      }

      const agent = getAgentInstance(organizationId);

      const result = await agent.execute({
        type: 'test_connection',
        payload: { connectionId }
      });

      res.json(result);
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to test connection');
      next(error);
    }
  });

  /**
   * Test connection with custom config (before creating)
   * POST /api/agents/api-integration/test-connection
   */
  router.post('/test-connection', async (req, res, next) => {
    try {
      const organizationId = req.body.organizationId || req.user?.organizationId;

      if (!organizationId) {
        return res.status(400).json({ error: 'Organization ID is required' });
      }

      const agent = getAgentInstance(organizationId);

      const result = await agent.execute({
        type: 'test_connection',
        payload: {
          config: req.body.config,
          authMethod: req.body.authMethod,
          authCredentials: req.body.authCredentials
        }
      });

      res.json(result);
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to test connection');
      next(error);
    }
  });

  /**
   * Get all connections for organization
   * GET /api/agents/api-integration/connections
   */
  router.get('/connections', async (req, res, next) => {
    try {
      const organizationId = req.query.organizationId || req.user?.organizationId;

      if (!organizationId) {
        return res.status(400).json({ error: 'Organization ID is required' });
      }

      const result = await db.query(`
        SELECT
          id,
          name,
          integration_type,
          status,
          last_sync_at,
          last_test_status,
          created_at,
          updated_at
        FROM agent_api_data_sources
        WHERE organization_id = $1
        ORDER BY created_at DESC
      `, [organizationId]);

      res.json({
        success: true,
        connections: result.rows,
        count: result.rows.length
      });
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to get connections');
      next(error);
    }
  });

  /**
   * Get connection details
   * GET /api/agents/api-integration/connections/:id
   */
  router.get('/connections/:id', async (req, res, next) => {
    try {
      const organizationId = req.query.organizationId || req.user?.organizationId;
      const connectionId = req.params.id;

      if (!organizationId) {
        return res.status(400).json({ error: 'Organization ID is required' });
      }

      const result = await db.query(`
        SELECT
          id,
          name,
          integration_type,
          config,
          auth_method,
          mapping,
          schedule,
          status,
          last_sync_at,
          last_test_at,
          last_test_status,
          last_test_message,
          created_at,
          updated_at
        FROM agent_api_data_sources
        WHERE id = $1 AND organization_id = $2
      `, [connectionId, organizationId]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Connection not found' });
      }

      const connection = result.rows[0];

      // Parse JSON fields
      connection.config = JSON.parse(connection.config);
      connection.mapping = JSON.parse(connection.mapping);

      // Don't expose auth_credentials for security
      delete connection.auth_credentials;

      res.json({
        success: true,
        connection
      });
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to get connection');
      next(error);
    }
  });

  /**
   * Update connection
   * PUT /api/agents/api-integration/connections/:id
   */
  router.put('/connections/:id', async (req, res, next) => {
    try {
      const organizationId = req.body.organizationId || req.user?.organizationId;
      const connectionId = req.params.id;

      if (!organizationId) {
        return res.status(400).json({ error: 'Organization ID is required' });
      }

      const {
        name,
        config,
        authMethod,
        authCredentials,
        mapping,
        schedule,
        status
      } = req.body;

      const updates = [];
      const values = [];
      let paramIndex = 1;

      if (name) {
        updates.push(`name = $${paramIndex++}`);
        values.push(name);
      }
      if (config) {
        updates.push(`config = $${paramIndex++}`);
        values.push(JSON.stringify(config));
      }
      if (authMethod) {
        updates.push(`auth_method = $${paramIndex++}`);
        values.push(authMethod);
      }
      if (authCredentials) {
        updates.push(`auth_credentials = $${paramIndex++}`);
        values.push(JSON.stringify(authCredentials));
      }
      if (mapping) {
        updates.push(`mapping = $${paramIndex++}`);
        values.push(JSON.stringify(mapping));
      }
      if (schedule !== undefined) {
        updates.push(`schedule = $${paramIndex++}`);
        values.push(schedule);
      }
      if (status) {
        updates.push(`status = $${paramIndex++}`);
        values.push(status);
      }

      updates.push(`updated_at = NOW()`);

      values.push(connectionId, organizationId);

      const query = `
        UPDATE agent_api_data_sources
        SET ${updates.join(', ')}
        WHERE id = $${paramIndex++} AND organization_id = $${paramIndex++}
        RETURNING id, name, integration_type, status, updated_at
      `;

      const result = await db.query(query, values);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Connection not found' });
      }

      res.json({
        success: true,
        connection: result.rows[0]
      });
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to update connection');
      next(error);
    }
  });

  /**
   * Delete connection
   * DELETE /api/agents/api-integration/connections/:id
   */
  router.delete('/connections/:id', async (req, res, next) => {
    try {
      const organizationId = req.query.organizationId || req.user?.organizationId;
      const connectionId = req.params.id;

      if (!organizationId) {
        return res.status(400).json({ error: 'Organization ID is required' });
      }

      const result = await db.query(`
        DELETE FROM agent_api_data_sources
        WHERE id = $1 AND organization_id = $2
        RETURNING id, name
      `, [connectionId, organizationId]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Connection not found' });
      }

      res.json({
        success: true,
        message: 'Connection deleted',
        connection: result.rows[0]
      });
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to delete connection');
      next(error);
    }
  });

  /**
   * Synchronize data
   * POST /api/agents/api-integration/connections/:id/sync
   */
  router.post('/connections/:id/sync', async (req, res, next) => {
    try {
      const organizationId = req.body.organizationId || req.user?.organizationId;
      const connectionId = req.params.id;

      if (!organizationId) {
        return res.status(400).json({ error: 'Organization ID is required' });
      }

      const agent = getAgentInstance(organizationId);

      const result = await agent.execute({
        type: 'sync_data',
        payload: {
          connectionId,
          targetTable: req.body.targetTable,
          options: req.body.options || {}
        }
      });

      res.json(result);
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to sync data');
      next(error);
    }
  });

  /**
   * Get sync logs
   * GET /api/agents/api-integration/connections/:id/logs
   */
  router.get('/connections/:id/logs', async (req, res, next) => {
    try {
      const organizationId = req.query.organizationId || req.user?.organizationId;
      const connectionId = req.params.id;

      if (!organizationId) {
        return res.status(400).json({ error: 'Organization ID is required' });
      }

      const agent = getAgentInstance(organizationId);

      const result = await agent.execute({
        type: 'get_sync_logs',
        payload: {
          connectionId,
          limit: parseInt(req.query.limit) || 50,
          offset: parseInt(req.query.offset) || 0
        }
      });

      res.json(result);
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to get sync logs');
      next(error);
    }
  });

  /**
   * Handle incoming webhook
   * POST /api/agents/api-integration/webhooks/:connectionId
   */
  router.post('/webhooks/:connectionId', async (req, res, next) => {
    try {
      const connectionId = req.params.connectionId;

      // Get connection to find organization ID
      const connResult = await db.query(
        'SELECT organization_id FROM agent_api_data_sources WHERE id = $1',
        [connectionId]
      );

      if (connResult.rows.length === 0) {
        return res.status(404).json({ error: 'Connection not found' });
      }

      const organizationId = connResult.rows[0].organization_id;
      const agent = getAgentInstance(organizationId);

      const result = await agent.execute({
        type: 'handle_webhook',
        payload: {
          connectionId,
          webhookData: req.body
        }
      });

      res.json(result);
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to handle webhook');
      next(error);
    }
  });

  /**
   * Upload and process file
   * POST /api/agents/api-integration/upload
   */
  router.post('/upload', async (req, res, next) => {
    try {
      const organizationId = req.body.organizationId || req.user?.organizationId;

      if (!organizationId) {
        return res.status(400).json({ error: 'Organization ID is required' });
      }

      const agent = getAgentInstance(organizationId);

      const result = await agent.execute({
        type: 'upload_file',
        payload: {
          filePath: req.body.filePath,
          format: req.body.format,
          targetTable: req.body.targetTable,
          mapping: req.body.mapping
        }
      });

      res.json(result);
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to upload file');
      next(error);
    }
  });

  /**
   * Map data preview
   * POST /api/agents/api-integration/map-preview
   */
  router.post('/map-preview', async (req, res, next) => {
    try {
      const organizationId = req.body.organizationId || req.user?.organizationId;

      if (!organizationId) {
        return res.status(400).json({ error: 'Organization ID is required' });
      }

      const agent = getAgentInstance(organizationId);

      const result = await agent.execute({
        type: 'map_data',
        payload: {
          sourceData: req.body.sourceData,
          mapping: req.body.mapping
        }
      });

      res.json(result);
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to preview mapping');
      next(error);
    }
  });

  /**
   * Get integration statistics
   * GET /api/agents/api-integration/stats
   */
  router.get('/stats', async (req, res, next) => {
    try {
      const organizationId = req.query.organizationId || req.user?.organizationId;

      if (!organizationId) {
        return res.status(400).json({ error: 'Organization ID is required' });
      }

      // Get connection counts by type
      const connectionStats = await db.query(`
        SELECT
          integration_type,
          COUNT(*) as count,
          COUNT(CASE WHEN status = 'active' THEN 1 END) as active_count
        FROM agent_api_data_sources
        WHERE organization_id = $1
        GROUP BY integration_type
      `, [organizationId]);

      // Get sync statistics
      const syncStats = await db.query(`
        SELECT
          COUNT(*) as total_syncs,
          COUNT(CASE WHEN status = 'success' THEN 1 END) as successful_syncs,
          COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_syncs,
          SUM(record_count) as total_records,
          AVG(duration_ms) as avg_duration_ms
        FROM agent_api_sync_logs
        WHERE organization_id = $1
          AND created_at >= NOW() - INTERVAL '30 days'
      `, [organizationId]);

      res.json({
        success: true,
        stats: {
          connections: connectionStats.rows,
          syncs: syncStats.rows[0]
        }
      });
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to get stats');
      next(error);
    }
  });

  return router;
}

export default createAPIIntegrationAgentRoutes;
