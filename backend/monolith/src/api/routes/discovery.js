// discovery.js - API routes for AgentDiscoveryService
// Issue #2704 - Phase 2.1: Agent discovery endpoints

import express from 'express';
import logger from '../../utils/logger.js';

const router = express.Router();

/**
 * GET /api/discovery/agents
 * Get all registered agents
 *
 * Query params:
 * - status: Filter by status (active, inactive, all) - default: active
 */
router.get('/agents', (req, res) => {
  try {
    const { discoveryService } = req.app.locals;

    if (!discoveryService) {
      return res.status(503).json({
        success: false,
        error: 'Discovery service not available'
      });
    }

    const { status = 'active' } = req.query;
    const agents = discoveryService.getAll({ status });

    res.json({
      success: true,
      agents,
      count: agents.length
    });
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to get all agents');
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/discovery/agents/:id
 * Discover agent by ID
 *
 * Path params:
 * - id: Agent ID
 */
router.get('/agents/:id', (req, res) => {
  try {
    const { discoveryService } = req.app.locals;

    if (!discoveryService) {
      return res.status(503).json({
        success: false,
        error: 'Discovery service not available'
      });
    }

    const { id } = req.params;
    const agent = discoveryService.discoverById(id);

    if (!agent) {
      return res.status(404).json({
        success: false,
        error: `Agent ${id} not found`
      });
    }

    res.json({
      success: true,
      agent
    });
  } catch (error) {
    logger.error({ error: error.message, agentId: req.params.id }, 'Failed to discover agent by ID');
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/discovery/capabilities/:capability
 * Discover agents by capability
 *
 * Path params:
 * - capability: Capability to search for
 */
router.get('/capabilities/:capability', (req, res) => {
  try {
    const { discoveryService } = req.app.locals;

    if (!discoveryService) {
      return res.status(503).json({
        success: false,
        error: 'Discovery service not available'
      });
    }

    const { capability } = req.params;
    const agents = discoveryService.discover(capability);

    res.json({
      success: true,
      capability,
      agents,
      count: agents.length
    });
  } catch (error) {
    logger.error({ error: error.message, capability: req.params.capability }, 'Failed to discover agents by capability');
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/discovery/register
 * Register a new agent
 *
 * Request body:
 * - name: Agent name (required)
 * - capabilities: Array of capabilities (required)
 * - endpoint: Agent endpoint URL (required)
 * - healthCheckUrl: Health check endpoint (optional)
 * - metadata: Additional metadata (optional)
 */
router.post('/register', async (req, res) => {
  try {
    const { discoveryService } = req.app.locals;

    if (!discoveryService) {
      return res.status(503).json({
        success: false,
        error: 'Discovery service not available'
      });
    }

    const agentInfo = req.body;

    // Validate required fields
    if (!agentInfo.name) {
      return res.status(400).json({
        success: false,
        error: 'Agent name is required'
      });
    }

    if (!agentInfo.capabilities || !Array.isArray(agentInfo.capabilities) || agentInfo.capabilities.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Agent capabilities array is required and must not be empty'
      });
    }

    if (!agentInfo.endpoint) {
      return res.status(400).json({
        success: false,
        error: 'Agent endpoint is required'
      });
    }

    const result = await discoveryService.register(agentInfo);

    res.status(201).json(result);
  } catch (error) {
    logger.error({ error: error.message, agentInfo: req.body }, 'Failed to register agent');
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/discovery/agents/:id
 * Deregister an agent
 *
 * Path params:
 * - id: Agent ID
 */
router.delete('/agents/:id', async (req, res) => {
  try {
    const { discoveryService } = req.app.locals;

    if (!discoveryService) {
      return res.status(503).json({
        success: false,
        error: 'Discovery service not available'
      });
    }

    const { id } = req.params;
    const result = await discoveryService.deregister(id);

    res.json(result);
  } catch (error) {
    logger.error({ error: error.message, agentId: req.params.id }, 'Failed to deregister agent');

    if (error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        error: error.message
      });
    }

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/discovery/agents/:id/heartbeat
 * Update agent heartbeat
 *
 * Path params:
 * - id: Agent ID
 */
router.post('/agents/:id/heartbeat', async (req, res) => {
  try {
    const { discoveryService } = req.app.locals;

    if (!discoveryService) {
      return res.status(503).json({
        success: false,
        error: 'Discovery service not available'
      });
    }

    const { id } = req.params;
    const result = await discoveryService.updateHeartbeat(id);

    res.json(result);
  } catch (error) {
    logger.error({ error: error.message, agentId: req.params.id }, 'Failed to update agent heartbeat');

    if (error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        error: error.message
      });
    }

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/discovery/stats
 * Get discovery service statistics
 */
router.get('/stats', (req, res) => {
  try {
    const { discoveryService } = req.app.locals;

    if (!discoveryService) {
      return res.status(503).json({
        success: false,
        error: 'Discovery service not available'
      });
    }

    const stats = discoveryService.getStats();

    res.json({
      success: true,
      stats
    });
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to get discovery stats');
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
