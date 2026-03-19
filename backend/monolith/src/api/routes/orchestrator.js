// orchestrator.js - Multi-Agent Orchestrator REST API Routes
// Issue #2701: Phase 1.3 - API endpoints for Orchestrator
import express from 'express';
import logger from '../../utils/logger.js';

/**
 * Create orchestrator routes
 * @param {Object} orchestrator - MultiAgentOrchestrator instance
 * @returns {express.Router} Express router
 */
export function createOrchestratorRoutes(orchestrator) {
  const router = express.Router();

  /**
   * POST /api/orchestrator/start
   * Start the entire multi-agent network
   *
   * @returns {Object} { success: true, agentsStarted: number, order: string[] }
   * @throws {409} If network is already running
   * @throws {500} If startup fails
   */
  router.post('/start', async (req, res, next) => {
    try {
      // Check if already running
      if (orchestrator.status === 'running') {
        return res.status(409).json({
          success: false,
          error: 'Multi-agent network is already running'
        });
      }

      if (orchestrator.status === 'starting') {
        return res.status(409).json({
          success: false,
          error: 'Multi-agent network is already starting'
        });
      }

      logger.info('Starting multi-agent network via API');

      const result = await orchestrator.startAll();

      res.json({
        success: true,
        data: {
          agentsStarted: result.agentsStarted,
          order: result.order,
          status: orchestrator.status
        }
      });
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to start multi-agent network via API');

      res.status(500).json({
        success: false,
        error: error.message || 'Failed to start multi-agent network'
      });
    }
  });

  /**
   * POST /api/orchestrator/stop
   * Stop the entire multi-agent network
   *
   * @returns {Object} { success: true }
   * @throws {409} If network is not running
   * @throws {500} If shutdown fails
   */
  router.post('/stop', async (req, res, next) => {
    try {
      // Check if already stopped
      if (orchestrator.status === 'stopped') {
        return res.status(409).json({
          success: false,
          error: 'Multi-agent network is already stopped'
        });
      }

      if (orchestrator.status === 'stopping') {
        return res.status(409).json({
          success: false,
          error: 'Multi-agent network is already stopping'
        });
      }

      logger.info('Stopping multi-agent network via API');

      const result = await orchestrator.stopAll();

      res.json({
        success: true,
        data: {
          status: orchestrator.status
        }
      });
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to stop multi-agent network via API');

      res.status(500).json({
        success: false,
        error: error.message || 'Failed to stop multi-agent network'
      });
    }
  });

  /**
   * GET /api/orchestrator/status
   * Get the current status of the multi-agent network
   *
   * @returns {Object} { success: true, status: {...} }
   */
  router.get('/status', (req, res, next) => {
    try {
      const status = orchestrator.getStatus();

      res.json({
        success: true,
        data: {
          status
        }
      });
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to get orchestrator status');

      res.status(500).json({
        success: false,
        error: error.message || 'Failed to get orchestrator status'
      });
    }
  });

  /**
   * GET /api/orchestrator/dependency-graph
   * Get the dependency graph of agents
   *
   * @returns {Object} { success: true, graph: { nodes: [], edges: [] } }
   */
  router.get('/dependency-graph', (req, res, next) => {
    try {
      const graph = orchestrator.getDependencyGraphData();

      res.json({
        success: true,
        data: {
          graph
        }
      });
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to get dependency graph');

      res.status(500).json({
        success: false,
        error: error.message || 'Failed to get dependency graph'
      });
    }
  });

  /**
   * POST /api/orchestrator/restart
   * Restart the entire multi-agent network
   *
   * @returns {Object} { success: true, agentsStarted: number, order: string[] }
   * @throws {500} If restart fails
   */
  router.post('/restart', async (req, res, next) => {
    try {
      logger.info('Restarting multi-agent network via API');

      // Stop first (if running)
      if (orchestrator.status === 'running' || orchestrator.status === 'starting') {
        logger.info('Stopping network before restart');
        await orchestrator.stopAll();
      }

      // Wait a bit for cleanup
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Start again
      logger.info('Starting network after restart');
      const result = await orchestrator.startAll();

      res.json({
        success: true,
        data: {
          agentsStarted: result.agentsStarted,
          order: result.order,
          status: orchestrator.status
        }
      });
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to restart multi-agent network via API');

      res.status(500).json({
        success: false,
        error: error.message || 'Failed to restart multi-agent network'
      });
    }
  });

  /**
   * POST /api/orchestrator/agent/:id/start
   * Start a single agent by ID
   *
   * @param {string} id - Agent ID
   * @returns {Object} { success: true, agentId: string }
   * @throws {400} If agent ID is invalid
   * @throws {404} If agent manifest not found
   * @throws {500} If agent startup fails
   */
  router.post('/agent/:id/start', async (req, res, next) => {
    try {
      const agentId = req.params.id;

      if (!agentId) {
        return res.status(400).json({
          success: false,
          error: 'Agent ID is required'
        });
      }

      // Check if manifest exists
      const manifest = orchestrator.manifests.get(agentId);
      if (!manifest) {
        return res.status(404).json({
          success: false,
          error: `Agent manifest not found for ${agentId}`
        });
      }

      logger.info({ agentId }, 'Starting single agent via API');

      await orchestrator.startAgent(agentId);

      res.json({
        success: true,
        data: {
          agentId,
          status: 'started'
        }
      });
    } catch (error) {
      logger.error({ agentId: req.params.id, error: error.message }, 'Failed to start agent via API');

      res.status(500).json({
        success: false,
        error: error.message || `Failed to start agent ${req.params.id}`
      });
    }
  });

  /**
   * POST /api/orchestrator/agent/:id/stop
   * Stop a single agent by ID
   *
   * @param {string} id - Agent ID
   * @returns {Object} { success: true, agentId: string }
   * @throws {400} If agent ID is invalid
   * @throws {404} If agent not found
   * @throws {500} If agent shutdown fails
   */
  router.post('/agent/:id/stop', async (req, res, next) => {
    try {
      const agentId = req.params.id;

      if (!agentId) {
        return res.status(400).json({
          success: false,
          error: 'Agent ID is required'
        });
      }

      // Check if agent exists in registry
      const agent = orchestrator.agentRegistry.getAgent(agentId);
      if (!agent) {
        return res.status(404).json({
          success: false,
          error: `Agent not found: ${agentId}`
        });
      }

      logger.info({ agentId }, 'Stopping single agent via API');

      await orchestrator.stopAgent(agentId);

      res.json({
        success: true,
        data: {
          agentId,
          status: 'stopped'
        }
      });
    } catch (error) {
      logger.error({ agentId: req.params.id, error: error.message }, 'Failed to stop agent via API');

      res.status(500).json({
        success: false,
        error: error.message || `Failed to stop agent ${req.params.id}`
      });
    }
  });

  return router;
}

export default createOrchestratorRoutes;
