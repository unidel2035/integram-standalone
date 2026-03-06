/**
 * MLOps Agent Service
 * Issue #2486 - ML Operations and Model Lifecycle Management
 *
 * Provides client-side interface for ML Ops agent operations:
 * - Model training and versioning
 * - Model deployment
 * - A/B testing experiments
 * - Concept drift detection
 * - Feature store management
 */

import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_ORCHESTRATOR_URL || '/api';
const MLOPS_API = `${API_BASE_URL}/mlops-agent`;

/**
 * Train a new machine learning model
 * @param {Object} modelData - Model configuration and training data
 * @returns {Promise<Object>} Training result with model ID and metrics
 */
export async function trainModel(modelData) {
  try {
    const response = await axios.post(`${MLOPS_API}/models/train`, modelData);
    return response.data;
  } catch (error) {
    console.error('Failed to train model:', error);
    throw new Error(error.response?.data?.error || 'Failed to train model');
  }
}

/**
 * Create a new version of an existing model
 * @param {string} modelId - ID of the model to version
 * @param {Object} versionData - Version configuration
 * @returns {Promise<Object>} New version information
 */
export async function versionModel(modelId, versionData) {
  try {
    const response = await axios.post(`${MLOPS_API}/models/${modelId}/version`, versionData);
    return response.data;
  } catch (error) {
    console.error('Failed to version model:', error);
    throw new Error(error.response?.data?.error || 'Failed to version model');
  }
}

/**
 * Deploy a model to an environment
 * @param {string} modelId - ID of the model to deploy
 * @param {Object} deploymentData - Deployment configuration
 * @returns {Promise<Object>} Deployment result
 */
export async function deployModel(modelId, deploymentData) {
  try {
    const response = await axios.post(`${MLOPS_API}/models/${modelId}/deploy`, deploymentData);
    return response.data;
  } catch (error) {
    console.error('Failed to deploy model:', error);
    throw new Error(error.response?.data?.error || 'Failed to deploy model');
  }
}

/**
 * Get a list of all models
 * @param {Object} filters - Optional filters (status, modelType, limit, offset)
 * @returns {Promise<Object>} List of models
 */
export async function listModels(filters = {}) {
  try {
    const params = new URLSearchParams(filters).toString();
    const response = await axios.get(`${MLOPS_API}/models${params ? '?' + params : ''}`);
    return response.data;
  } catch (error) {
    console.error('Failed to list models:', error);
    throw new Error(error.response?.data?.error || 'Failed to list models');
  }
}

/**
 * Get a specific model by ID
 * @param {string} modelId - ID of the model
 * @returns {Promise<Object>} Model information
 */
export async function getModel(modelId) {
  try {
    const response = await axios.get(`${MLOPS_API}/models/${modelId}`);
    return response.data;
  } catch (error) {
    console.error('Failed to get model:', error);
    throw new Error(error.response?.data?.error || 'Failed to get model');
  }
}

/**
 * Get model performance metrics
 * @param {string} modelId - ID of the model
 * @returns {Promise<Object>} Model metrics
 */
export async function getModelMetrics(modelId) {
  try {
    const response = await axios.get(`${MLOPS_API}/models/${modelId}/metrics`);
    return response.data;
  } catch (error) {
    console.error('Failed to get model metrics:', error);
    throw new Error(error.response?.data?.error || 'Failed to get model metrics');
  }
}

/**
 * Compare multiple models
 * @param {Array<string>} modelIds - Array of model IDs to compare
 * @param {Object} options - Comparison options
 * @returns {Promise<Object>} Comparison results
 */
export async function compareModels(modelIds, options = {}) {
  try {
    const response = await axios.post(`${MLOPS_API}/models/compare`, {
      modelIds,
      options
    });
    return response.data;
  } catch (error) {
    console.error('Failed to compare models:', error);
    throw new Error(error.response?.data?.error || 'Failed to compare models');
  }
}

/**
 * Create an A/B testing experiment
 * @param {Object} experimentData - Experiment configuration
 * @returns {Promise<Object>} Experiment information
 */
export async function createExperiment(experimentData) {
  try {
    const response = await axios.post(`${MLOPS_API}/experiments`, experimentData);
    return response.data;
  } catch (error) {
    console.error('Failed to create experiment:', error);
    throw new Error(error.response?.data?.error || 'Failed to create experiment');
  }
}

/**
 * Analyze A/B test experiment results
 * @param {string} experimentId - ID of the experiment
 * @param {Object} results - Experiment results
 * @returns {Promise<Object>} Analysis results
 */
export async function analyzeExperiment(experimentId, results) {
  try {
    const response = await axios.post(`${MLOPS_API}/experiments/${experimentId}/analyze`, {
      results
    });
    return response.data;
  } catch (error) {
    console.error('Failed to analyze experiment:', error);
    throw new Error(error.response?.data?.error || 'Failed to analyze experiment');
  }
}

/**
 * List all experiments
 * @returns {Promise<Object>} List of experiments
 */
export async function listExperiments() {
  try {
    const response = await axios.get(`${MLOPS_API}/experiments`);
    return response.data;
  } catch (error) {
    console.error('Failed to list experiments:', error);
    throw new Error(error.response?.data?.error || 'Failed to list experiments');
  }
}

/**
 * Detect concept drift in a model
 * @param {Object} driftData - Drift detection configuration
 * @returns {Promise<Object>} Drift detection results
 */
export async function detectDrift(driftData) {
  try {
    const response = await axios.post(`${MLOPS_API}/drift/detect`, driftData);
    return response.data;
  } catch (error) {
    console.error('Failed to detect drift:', error);
    throw new Error(error.response?.data?.error || 'Failed to detect drift');
  }
}

/**
 * Get drift detection history for a model
 * @param {string} modelId - ID of the model
 * @returns {Promise<Object>} Drift history
 */
export async function getDriftHistory(modelId) {
  try {
    const response = await axios.get(`${MLOPS_API}/drift/${modelId}/history`);
    return response.data;
  } catch (error) {
    console.error('Failed to get drift history:', error);
    throw new Error(error.response?.data?.error || 'Failed to get drift history');
  }
}

/**
 * Add a new feature to the feature store
 * @param {string} featureName - Name of the feature
 * @param {Object} featureData - Feature configuration
 * @returns {Promise<Object>} Feature information
 */
export async function addFeature(featureName, featureData) {
  try {
    const response = await axios.post(`${MLOPS_API}/features`, {
      featureName,
      ...featureData
    });
    return response.data;
  } catch (error) {
    console.error('Failed to add feature:', error);
    throw new Error(error.response?.data?.error || 'Failed to add feature');
  }
}

/**
 * Get a feature by name
 * @param {string} featureName - Name of the feature
 * @returns {Promise<Object>} Feature information
 */
export async function getFeature(featureName) {
  try {
    const response = await axios.get(`${MLOPS_API}/features/${featureName}`);
    return response.data;
  } catch (error) {
    console.error('Failed to get feature:', error);
    throw new Error(error.response?.data?.error || 'Failed to get feature');
  }
}

/**
 * List all features in the feature store
 * @returns {Promise<Object>} List of features
 */
export async function listFeatures() {
  try {
    const response = await axios.get(`${MLOPS_API}/features`);
    return response.data;
  } catch (error) {
    console.error('Failed to list features:', error);
    throw new Error(error.response?.data?.error || 'Failed to list features');
  }
}

/**
 * Update a feature
 * @param {string} featureName - Name of the feature
 * @param {Object} featureData - Updated feature configuration
 * @returns {Promise<Object>} Updated feature information
 */
export async function updateFeature(featureName, featureData) {
  try {
    const response = await axios.put(`${MLOPS_API}/features/${featureName}`, featureData);
    return response.data;
  } catch (error) {
    console.error('Failed to update feature:', error);
    throw new Error(error.response?.data?.error || 'Failed to update feature');
  }
}

/**
 * Delete a feature
 * @param {string} featureName - Name of the feature
 * @returns {Promise<Object>} Deletion result
 */
export async function deleteFeature(featureName) {
  try {
    const response = await axios.delete(`${MLOPS_API}/features/${featureName}`);
    return response.data;
  } catch (error) {
    console.error('Failed to delete feature:', error);
    throw new Error(error.response?.data?.error || 'Failed to delete feature');
  }
}

/**
 * Get MLOps agent status
 * @returns {Promise<Object>} Agent status
 */
export async function getAgentStatus() {
  try {
    const response = await axios.get(`${MLOPS_API}/status`);
    return response.data;
  } catch (error) {
    console.error('Failed to get agent status:', error);
    throw new Error(error.response?.data?.error || 'Failed to get agent status');
  }
}

export default {
  trainModel,
  versionModel,
  deployModel,
  listModels,
  getModel,
  getModelMetrics,
  compareModels,
  createExperiment,
  analyzeExperiment,
  listExperiments,
  detectDrift,
  getDriftHistory,
  addFeature,
  getFeature,
  listFeatures,
  updateFeature,
  deleteFeature,
  getAgentStatus
};
