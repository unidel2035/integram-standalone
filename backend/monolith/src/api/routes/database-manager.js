/**
 * Database Manager API Routes
 *
 * Provides HTTP API for managing multiple database architecture types
 *
 * Issue #1802: Database Architecture Selection System
 *
 * Endpoints:
 * - GET /api/databases/types - List available database types
 * - POST /api/databases/deploy - Deploy a new database instance
 * - GET /api/databases/instances - List all instances
 * - GET /api/databases/status/:id - Get instance status
 * - POST /api/databases/test-connection - Test connection to instance
 * - POST /api/databases/:id/start - Start a stopped instance
 * - POST /api/databases/:id/stop - Stop a running instance
 * - DELETE /api/databases/:id - Delete an instance
 * - PUT /api/databases/:id/config - Update instance configuration
 */

import express from 'express';
import { DatabaseManagerService } from '../../services/database-manager/DatabaseManagerService.js';

export function createDatabaseManagerRoutes(orchestrator) {
  const router = express.Router();

  // Initialize database manager service
  const dbManager = new DatabaseManagerService({
    db: orchestrator?.db,
    logger: console
  });

  /**
   * List all available database types
   * GET /api/databases/types
   *
   * Query parameters:
   * - category: Filter by category (relational, graph, document, ai, ledger)
   * - status: Filter by status (available, planned)
   */
  router.get('/types', async (req, res) => {
    try {
      const { category, status } = req.query;

      const result = await dbManager.listDatabaseTypes({ category, status });

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('Error listing database types:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * Get a specific database type
   * GET /api/databases/types/:typeId
   */
  router.get('/types/:typeId', async (req, res) => {
    try {
      const { typeId } = req.params;

      const type = await dbManager.getDatabaseType(typeId);

      res.json({
        success: true,
        data: type
      });
    } catch (error) {
      console.error('Error getting database type:', error);
      res.status(404).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * Deploy a new database instance
   * POST /api/databases/deploy
   *
   * Body:
   * {
   *   "type": "postgresql",
   *   "name": "my-project-db",
   *   "config": {
   *     "version": "16",
   *     "memory": "2GB",
   *     "storage": "10GB"
   *   }
   * }
   */
  router.post('/deploy', async (req, res) => {
    try {
      const { type, name, config } = req.body;

      // Get userId from session/auth (for now, use a default)
      const userId = req.user?.id || 'default-user';

      // Validate required fields
      if (!type) {
        return res.status(400).json({
          success: false,
          error: 'Database type is required'
        });
      }

      if (!name) {
        return res.status(400).json({
          success: false,
          error: 'Database name is required'
        });
      }

      const result = await dbManager.deployDatabase({
        type,
        name,
        config,
        userId
      });

      res.status(201).json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('Error deploying database:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * List all database instances
   * GET /api/databases/instances
   *
   * Query parameters:
   * - type: Filter by database type
   * - status: Filter by status (deploying, running, stopped, failed)
   */
  router.get('/instances', async (req, res) => {
    try {
      const { type, status } = req.query;

      // Get userId from session/auth (for now, use a default)
      const userId = req.user?.id || 'default-user';

      const instances = await dbManager.listInstances({
        userId,
        type,
        status
      });

      res.json({
        success: true,
        data: instances
      });
    } catch (error) {
      console.error('Error listing instances:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * Get status of a specific database instance
   * GET /api/databases/status/:id
   */
  router.get('/status/:id', async (req, res) => {
    try {
      const { id } = req.params;

      const status = await dbManager.getInstanceStatus(id);

      res.json({
        success: true,
        data: status
      });
    } catch (error) {
      console.error('Error getting instance status:', error);
      res.status(404).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * Test connection to a database instance
   * POST /api/databases/test-connection
   *
   * Body:
   * {
   *   "instanceId": "uuid"
   * }
   */
  router.post('/test-connection', async (req, res) => {
    try {
      const { instanceId } = req.body;

      if (!instanceId) {
        return res.status(400).json({
          success: false,
          error: 'instanceId is required'
        });
      }

      const result = await dbManager.testConnection(instanceId);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('Error testing connection:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * Start a stopped database instance
   * POST /api/databases/:id/start
   */
  router.post('/:id/start', async (req, res) => {
    try {
      const { id } = req.params;

      const result = await dbManager.startInstance(id);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('Error starting instance:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * Stop a running database instance
   * POST /api/databases/:id/stop
   */
  router.post('/:id/stop', async (req, res) => {
    try {
      const { id } = req.params;

      const result = await dbManager.stopInstance(id);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('Error stopping instance:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * Delete a database instance
   * DELETE /api/databases/:id
   */
  router.delete('/:id', async (req, res) => {
    try {
      const { id } = req.params;

      const result = await dbManager.deleteInstance(id);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('Error deleting instance:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * Update database instance configuration
   * PUT /api/databases/:id/config
   *
   * Body:
   * {
   *   "memory": "4GB",
   *   "cpu": 2
   * }
   */
  router.put('/:id/config', async (req, res) => {
    try {
      const { id } = req.params;
      const config = req.body;

      const result = await dbManager.updateInstanceConfig(id, config);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('Error updating config:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  return router;
}

export default createDatabaseManagerRoutes;
