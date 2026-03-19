// feature-flags.js - API routes for Feature Flags Agent
// Issue #2488 - Агент экспериментов и feature flags

import express from 'express';
import { FeatureFlagsAgent } from '../../agents/FeatureFlagsAgent.js';
import logger from '../../utils/logger.js';

const router = express.Router();

// Initialize agent (singleton)
let featureFlagsAgent = null;

function getAgent() {
  if (!featureFlagsAgent) {
    featureFlagsAgent = new FeatureFlagsAgent();
  }
  return featureFlagsAgent;
}

/**
 * GET /api/feature-flags/status
 * Get agent status
 */
router.get('/status', async (req, res) => {
  try {
    const agent = getAgent();
    const status = await agent.getStatus();
    res.json({ success: true, data: status });
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to get agent status');
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/feature-flags/flags
 * Create a new feature flag
 */
router.post('/flags', async (req, res) => {
  try {
    const agent = getAgent();
    const result = await agent.execute({
      action: 'create-flag',
      data: req.body,
      options: { userId: req.user?.id }
    });
    res.json(result);
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to create feature flag');
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/feature-flags/flags
 * List all feature flags
 */
router.get('/flags', async (req, res) => {
  try {
    const agent = getAgent();
    const { enabled, tags, sort, limit, offset } = req.query;

    const options = {
      filter: {},
      sort: sort ? JSON.parse(sort) : undefined,
      limit: limit ? parseInt(limit) : undefined,
      offset: offset ? parseInt(offset) : undefined
    };

    if (enabled !== undefined) {
      options.filter.enabled = enabled === 'true';
    }
    if (tags) {
      options.filter.tags = tags.split(',');
    }

    const result = await agent.execute({
      action: 'list-flags',
      data: {},
      options
    });
    res.json(result);
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to list feature flags');
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/feature-flags/flags/:flagId
 * Get a specific feature flag
 */
router.get('/flags/:flagId', async (req, res) => {
  try {
    const agent = getAgent();
    const result = await agent.execute({
      action: 'get-flag',
      data: { flagId: req.params.flagId }
    });
    res.json(result);
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to get feature flag');
    res.status(404).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/feature-flags/flags/:flagId
 * Update a feature flag
 */
router.put('/flags/:flagId', async (req, res) => {
  try {
    const agent = getAgent();
    const result = await agent.execute({
      action: 'update-flag',
      data: {
        flagId: req.params.flagId,
        updates: req.body
      }
    });
    res.json(result);
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to update feature flag');
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/feature-flags/flags/:flagId/toggle
 * Toggle a feature flag on/off
 */
router.post('/flags/:flagId/toggle', async (req, res) => {
  try {
    const agent = getAgent();
    const result = await agent.execute({
      action: 'toggle-flag',
      data: {
        flagId: req.params.flagId,
        enabled: req.body.enabled
      }
    });
    res.json(result);
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to toggle feature flag');
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/feature-flags/flags/:flagId
 * Delete a feature flag
 */
router.delete('/flags/:flagId', async (req, res) => {
  try {
    const agent = getAgent();
    const result = await agent.execute({
      action: 'delete-flag',
      data: { flagId: req.params.flagId }
    });
    res.json(result);
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to delete feature flag');
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/feature-flags/flags/:flagId/evaluate
 * Evaluate feature flag for a user
 */
router.post('/flags/:flagId/evaluate', async (req, res) => {
  try {
    const agent = getAgent();
    const result = await agent.execute({
      action: 'evaluate-flag',
      data: {
        flagId: req.params.flagId,
        userId: req.body.userId,
        userAttributes: req.body.userAttributes || {}
      }
    });
    res.json(result);
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to evaluate feature flag');
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/feature-flags/experiments
 * Create a new experiment
 */
router.post('/experiments', async (req, res) => {
  try {
    const agent = getAgent();
    const result = await agent.execute({
      action: 'create-experiment',
      data: req.body
    });
    res.json(result);
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to create experiment');
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/feature-flags/experiments/:experimentId
 * Update an experiment
 */
router.put('/experiments/:experimentId', async (req, res) => {
  try {
    const agent = getAgent();
    const result = await agent.execute({
      action: 'update-experiment',
      data: {
        experimentId: req.params.experimentId,
        updates: req.body
      }
    });
    res.json(result);
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to update experiment');
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/feature-flags/experiments/:experimentId/analyze
 * Analyze experiment results
 */
router.post('/experiments/:experimentId/analyze', async (req, res) => {
  try {
    const agent = getAgent();
    const result = await agent.execute({
      action: 'analyze-experiment',
      data: {
        experimentId: req.params.experimentId,
        metrics: req.body.metrics
      }
    });
    res.json(result);
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to analyze experiment');
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/feature-flags/rollout
 * Start gradual feature rollout
 */
router.post('/rollout', async (req, res) => {
  try {
    const agent = getAgent();
    const result = await agent.execute({
      action: 'rollout-feature',
      data: req.body
    });
    res.json(result);
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to start rollout');
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/feature-flags/canary
 * Start canary deployment
 */
router.post('/canary', async (req, res) => {
  try {
    const agent = getAgent();
    const result = await agent.execute({
      action: 'canary-deploy',
      data: req.body
    });
    res.json(result);
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to start canary deployment');
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/feature-flags/rollback
 * Execute automatic rollback
 */
router.post('/rollback', async (req, res) => {
  try {
    const agent = getAgent();
    const result = await agent.execute({
      action: 'auto-rollback',
      data: req.body
    });
    res.json(result);
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to execute rollback');
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/feature-flags/segments
 * Create user segment
 */
router.post('/segments', async (req, res) => {
  try {
    const agent = getAgent();
    const result = await agent.execute({
      action: 'create-segment',
      data: req.body
    });
    res.json(result);
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to create segment');
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/feature-flags/metrics
 * Get metrics
 */
router.get('/metrics', async (req, res) => {
  try {
    const agent = getAgent();
    const result = await agent.execute({
      action: 'get-metrics',
      data: {
        flagId: req.query.flagId,
        experimentId: req.query.experimentId,
        startDate: req.query.startDate,
        endDate: req.query.endDate
      }
    });
    res.json(result);
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to get metrics');
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
