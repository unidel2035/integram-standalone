/**
 * MLOps Agent API Routes
 *
 * ML Operations and Model Lifecycle Management
 *
 * Issue #2486: ML Ops Agent - Phase 5
 *
 * Endpoints:
 * - POST /api/mlops-agent/models/train - Train a new model
 * - POST /api/mlops-agent/models/:id/version - Create a new version
 * - POST /api/mlops-agent/models/:id/deploy - Deploy a model
 * - GET /api/mlops-agent/models - List all models
 * - GET /api/mlops-agent/models/:id - Get model by ID
 * - GET /api/mlops-agent/models/:id/metrics - Get model metrics
 * - POST /api/mlops-agent/models/compare - Compare multiple models
 * - POST /api/mlops-agent/experiments - Create A/B testing experiment
 * - POST /api/mlops-agent/experiments/:id/analyze - Analyze experiment results
 * - GET /api/mlops-agent/experiments - List experiments
 * - POST /api/mlops-agent/drift/detect - Detect concept drift
 * - GET /api/mlops-agent/drift/:modelId/history - Get drift history
 * - POST /api/mlops-agent/features - Add feature
 * - GET /api/mlops-agent/features - List features
 * - GET /api/mlops-agent/features/:name - Get feature by name
 * - PUT /api/mlops-agent/features/:name - Update feature
 * - DELETE /api/mlops-agent/features/:name - Delete feature
 * - GET /api/mlops-agent/status - Get agent status
 */

import express from 'express';
import { createLogger } from '../../utils/logger.js';
import { MLOpsAgent } from '../../agents/MLOpsAgent.js';

const router = express.Router();
const logger = createLogger('MLOpsAgent');

// Create MLOps agent instance
const mlopsAgent = new MLOpsAgent({ id: 'mlops-agent-1' });

/**
 * POST /api/mlops-agent/models/train
 * Train a new machine learning model
 */
router.post('/models/train', async (req, res) => {
  try {
    const { modelName, modelType, trainingData, validationData, hyperparameters, features } = req.body;

    if (!modelName || !trainingData) {
      return res.status(400).json({
        success: false,
        error: 'modelName and trainingData are required'
      });
    }

    logger.info({ modelName, modelType }, 'Training model');

    const result = await mlopsAgent.execute({
      data: {
        action: 'train-model',
        data: {
          modelName,
          modelType,
          trainingData,
          validationData,
          hyperparameters,
          features
        }
      }
    });

    res.status(201).json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Model training failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/mlops-agent/models/:id/version
 * Create a new version of an existing model
 */
router.post('/models/:id/version', async (req, res) => {
  try {
    const { id } = req.params;
    const { changes, trainingData } = req.body;

    logger.info({ modelId: id }, 'Creating new model version');

    const result = await mlopsAgent.execute({
      data: {
        action: 'version-model',
        data: {
          modelId: id,
          changes,
          trainingData
        }
      }
    });

    res.status(201).json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Model versioning failed', { error: error.message, modelId: req.params.id });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/mlops-agent/models/:id/deploy
 * Deploy a model to production or staging
 */
router.post('/models/:id/deploy', async (req, res) => {
  try {
    const { id } = req.params;
    const { environment, deploymentConfig } = req.body;

    logger.info({ modelId: id, environment }, 'Deploying model');

    const result = await mlopsAgent.execute({
      data: {
        action: 'deploy-model',
        data: {
          modelId: id,
          environment,
          deploymentConfig
        }
      }
    });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Model deployment failed', { error: error.message, modelId: req.params.id });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/mlops-agent/models
 * List all models with optional filtering
 */
router.get('/models', async (req, res) => {
  try {
    const { status, modelType, limit, offset } = req.query;

    const result = await mlopsAgent.execute({
      data: {
        action: 'list-models',
        options: {
          status,
          modelType,
          limit: limit ? parseInt(limit) : undefined,
          offset: offset ? parseInt(offset) : undefined
        }
      }
    });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Failed to list models', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/mlops-agent/models/:id
 * Get model by ID
 */
router.get('/models/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await mlopsAgent.execute({
      data: {
        action: 'get-model',
        data: { modelId: id }
      }
    });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Failed to get model', { error: error.message, modelId: req.params.id });
    res.status(404).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/mlops-agent/models/:id/metrics
 * Get model performance metrics
 */
router.get('/models/:id/metrics', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await mlopsAgent.execute({
      data: {
        action: 'get-model-metrics',
        data: { modelId: id }
      }
    });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Failed to get model metrics', { error: error.message, modelId: req.params.id });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/mlops-agent/models/compare
 * Compare multiple models
 */
router.post('/models/compare', async (req, res) => {
  try {
    const { modelIds, options } = req.body;

    if (!modelIds || !Array.isArray(modelIds) || modelIds.length < 2) {
      return res.status(400).json({
        success: false,
        error: 'At least 2 model IDs required for comparison'
      });
    }

    logger.info({ modelIds }, 'Comparing models');

    const result = await mlopsAgent.execute({
      data: {
        action: 'compare-models',
        data: { modelIds },
        options
      }
    });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Model comparison failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/mlops-agent/experiments
 * Create an A/B testing experiment
 */
router.post('/experiments', async (req, res) => {
  try {
    const { name, description, modelIds, trafficSplit, metrics, duration } = req.body;

    if (!name || !modelIds || !Array.isArray(modelIds) || modelIds.length < 2) {
      return res.status(400).json({
        success: false,
        error: 'name and at least 2 modelIds are required'
      });
    }

    logger.info({ name, modelIds }, 'Creating A/B experiment');

    const result = await mlopsAgent.execute({
      data: {
        action: 'create-experiment',
        data: {
          name,
          description,
          modelIds,
          trafficSplit,
          metrics,
          duration
        }
      }
    });

    res.status(201).json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Experiment creation failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/mlops-agent/experiments/:id/analyze
 * Analyze A/B test experiment results
 */
router.post('/experiments/:id/analyze', async (req, res) => {
  try {
    const { id } = req.params;
    const { results } = req.body;

    if (!results) {
      return res.status(400).json({
        success: false,
        error: 'results object is required'
      });
    }

    logger.info({ experimentId: id }, 'Analyzing A/B test');

    const result = await mlopsAgent.execute({
      data: {
        action: 'ab-test',
        data: {
          experimentId: id,
          results
        }
      }
    });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('A/B test analysis failed', { error: error.message, experimentId: req.params.id });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/mlops-agent/experiments
 * List all experiments
 */
router.get('/experiments', async (req, res) => {
  try {
    // This would require implementing a list experiments method
    // For now, return empty array as placeholder
    res.json({
      success: true,
      data: {
        experiments: [],
        total: 0
      }
    });
  } catch (error) {
    logger.error('Failed to list experiments', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/mlops-agent/drift/detect
 * Detect concept drift in model performance
 */
router.post('/drift/detect', async (req, res) => {
  try {
    const { modelId, recentData, baselineMetrics, threshold } = req.body;

    if (!modelId || !recentData) {
      return res.status(400).json({
        success: false,
        error: 'modelId and recentData are required'
      });
    }

    logger.info({ modelId }, 'Detecting concept drift');

    const result = await mlopsAgent.execute({
      data: {
        action: 'detect-drift',
        data: {
          modelId,
          recentData,
          baselineMetrics,
          threshold
        }
      }
    });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Drift detection failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/mlops-agent/drift/:modelId/history
 * Get drift detection history for a model
 */
router.get('/drift/:modelId/history', async (req, res) => {
  try {
    const { modelId } = req.params;

    // This would require implementing drift history retrieval
    // For now, return empty array as placeholder
    res.json({
      success: true,
      data: {
        modelId,
        history: [],
        total: 0
      }
    });
  } catch (error) {
    logger.error('Failed to get drift history', { error: error.message, modelId: req.params.modelId });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/mlops-agent/features
 * Add a new feature to the feature store
 */
router.post('/features', async (req, res) => {
  try {
    const { featureName, ...featureData } = req.body;

    if (!featureName) {
      return res.status(400).json({
        success: false,
        error: 'featureName is required'
      });
    }

    logger.info({ featureName }, 'Adding feature');

    const result = await mlopsAgent.execute({
      data: {
        action: 'manage-features',
        data: {
          operation: 'add',
          featureName,
          featureData
        }
      }
    });

    res.status(201).json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Failed to add feature', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/mlops-agent/features
 * List all features
 */
router.get('/features', async (req, res) => {
  try {
    const result = await mlopsAgent.execute({
      data: {
        action: 'manage-features',
        data: {
          operation: 'list'
        }
      }
    });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Failed to list features', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/mlops-agent/features/:name
 * Get a feature by name
 */
router.get('/features/:name', async (req, res) => {
  try {
    const { name } = req.params;

    const result = await mlopsAgent.execute({
      data: {
        action: 'manage-features',
        data: {
          operation: 'get',
          featureName: name
        }
      }
    });

    if (!result.success) {
      return res.status(404).json(result);
    }

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Failed to get feature', { error: error.message, featureName: req.params.name });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * PUT /api/mlops-agent/features/:name
 * Update a feature
 */
router.put('/features/:name', async (req, res) => {
  try {
    const { name } = req.params;
    const featureData = req.body;

    logger.info({ featureName: name }, 'Updating feature');

    const result = await mlopsAgent.execute({
      data: {
        action: 'manage-features',
        data: {
          operation: 'update',
          featureName: name,
          featureData
        }
      }
    });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Failed to update feature', { error: error.message, featureName: req.params.name });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/mlops-agent/features/:name
 * Delete a feature
 */
router.delete('/features/:name', async (req, res) => {
  try {
    const { name } = req.params;

    logger.info({ featureName: name }, 'Deleting feature');

    const result = await mlopsAgent.execute({
      data: {
        action: 'manage-features',
        data: {
          operation: 'delete',
          featureName: name
        }
      }
    });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Failed to delete feature', { error: error.message, featureName: req.params.name });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/mlops-agent/status
 * Get MLOps agent status and statistics
 */
router.get('/status', async (req, res) => {
  try {
    const status = mlopsAgent.getStatus();

    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    logger.error('Failed to get agent status', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
