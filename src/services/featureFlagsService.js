// featureFlagsService.js - Service for Feature Flags Agent API
// Issue #2488 - Агент экспериментов и feature flags

import { getApiUrl } from '@/utils/apiConfig'

const API_BASE_URL = getApiUrl('/api');

/**
 * Get Feature Flags Agent status
 * @returns {Promise<Object>} Agent status
 */
export async function getAgentStatus() {
  const response = await fetch(`${API_BASE_URL}/feature-flags/status`);
  if (!response.ok) throw new Error('Failed to get agent status');
  return response.json();
}

/**
 * Create a new feature flag
 * @param {Object} flagData - Feature flag data
 * @returns {Promise<Object>} Created flag
 */
export async function createFeatureFlag(flagData) {
  const response = await fetch(`${API_BASE_URL}/feature-flags/flags`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(flagData)
  });
  if (!response.ok) throw new Error('Failed to create feature flag');
  return response.json();
}

/**
 * List all feature flags
 * @param {Object} options - Query options
 * @returns {Promise<Object>} List of flags
 */
export async function listFeatureFlags(options = {}) {
  const params = new URLSearchParams();
  if (options.enabled !== undefined) params.append('enabled', options.enabled);
  if (options.tags) params.append('tags', options.tags.join(','));
  if (options.sort) params.append('sort', JSON.stringify(options.sort));
  if (options.limit) params.append('limit', options.limit);
  if (options.offset) params.append('offset', options.offset);

  const response = await fetch(`${API_BASE_URL}/feature-flags/flags?${params}`);
  if (!response.ok) throw new Error('Failed to list feature flags');
  return response.json();
}

/**
 * Get a specific feature flag
 * @param {string} flagId - Flag ID
 * @returns {Promise<Object>} Feature flag
 */
export async function getFeatureFlag(flagId) {
  const response = await fetch(`${API_BASE_URL}/feature-flags/flags/${flagId}`);
  if (!response.ok) throw new Error('Failed to get feature flag');
  return response.json();
}

/**
 * Update a feature flag
 * @param {string} flagId - Flag ID
 * @param {Object} updates - Updated fields
 * @returns {Promise<Object>} Updated flag
 */
export async function updateFeatureFlag(flagId, updates) {
  const response = await fetch(`${API_BASE_URL}/feature-flags/flags/${flagId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates)
  });
  if (!response.ok) throw new Error('Failed to update feature flag');
  return response.json();
}

/**
 * Toggle a feature flag on/off
 * @param {string} flagId - Flag ID
 * @param {boolean} enabled - New enabled state
 * @returns {Promise<Object>} Updated flag
 */
export async function toggleFeatureFlag(flagId, enabled) {
  const response = await fetch(`${API_BASE_URL}/feature-flags/flags/${flagId}/toggle`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enabled })
  });
  if (!response.ok) throw new Error('Failed to toggle feature flag');
  return response.json();
}

/**
 * Delete a feature flag
 * @param {string} flagId - Flag ID
 * @returns {Promise<Object>} Deletion result
 */
export async function deleteFeatureFlag(flagId) {
  const response = await fetch(`${API_BASE_URL}/feature-flags/flags/${flagId}`, {
    method: 'DELETE'
  });
  if (!response.ok) throw new Error('Failed to delete feature flag');
  return response.json();
}

/**
 * Evaluate a feature flag for a user
 * @param {string} flagId - Flag ID
 * @param {string} userId - User ID
 * @param {Object} userAttributes - User attributes for targeting
 * @returns {Promise<Object>} Evaluation result
 */
export async function evaluateFeatureFlag(flagId, userId, userAttributes = {}) {
  const response = await fetch(`${API_BASE_URL}/feature-flags/flags/${flagId}/evaluate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, userAttributes })
  });
  if (!response.ok) throw new Error('Failed to evaluate feature flag');
  return response.json();
}

/**
 * Create an A/B experiment
 * @param {Object} experimentData - Experiment configuration
 * @returns {Promise<Object>} Created experiment
 */
export async function createExperiment(experimentData) {
  const response = await fetch(`${API_BASE_URL}/feature-flags/experiments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(experimentData)
  });
  if (!response.ok) throw new Error('Failed to create experiment');
  return response.json();
}

/**
 * Update an experiment
 * @param {string} experimentId - Experiment ID
 * @param {Object} updates - Updated fields
 * @returns {Promise<Object>} Updated experiment
 */
export async function updateExperiment(experimentId, updates) {
  const response = await fetch(`${API_BASE_URL}/feature-flags/experiments/${experimentId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates)
  });
  if (!response.ok) throw new Error('Failed to update experiment');
  return response.json();
}

/**
 * Analyze experiment results
 * @param {string} experimentId - Experiment ID
 * @param {Object} metrics - Experiment metrics
 * @returns {Promise<Object>} Analysis results
 */
export async function analyzeExperiment(experimentId, metrics) {
  const response = await fetch(`${API_BASE_URL}/feature-flags/experiments/${experimentId}/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ metrics })
  });
  if (!response.ok) throw new Error('Failed to analyze experiment');
  return response.json();
}

/**
 * Start gradual feature rollout
 * @param {Object} rolloutData - Rollout configuration
 * @returns {Promise<Object>} Rollout result
 */
export async function rolloutFeature(rolloutData) {
  const response = await fetch(`${API_BASE_URL}/feature-flags/rollout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(rolloutData)
  });
  if (!response.ok) throw new Error('Failed to start rollout');
  return response.json();
}

/**
 * Start canary deployment
 * @param {Object} canaryData - Canary configuration
 * @returns {Promise<Object>} Canary deployment result
 */
export async function canaryDeploy(canaryData) {
  const response = await fetch(`${API_BASE_URL}/feature-flags/canary`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(canaryData)
  });
  if (!response.ok) throw new Error('Failed to start canary deployment');
  return response.json();
}

/**
 * Execute automatic rollback
 * @param {Object} rollbackData - Rollback configuration
 * @returns {Promise<Object>} Rollback result
 */
export async function autoRollback(rollbackData) {
  const response = await fetch(`${API_BASE_URL}/feature-flags/rollback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(rollbackData)
  });
  if (!response.ok) throw new Error('Failed to execute rollback');
  return response.json();
}

/**
 * Create user segment
 * @param {Object} segmentData - Segment configuration
 * @returns {Promise<Object>} Created segment
 */
export async function createUserSegment(segmentData) {
  const response = await fetch(`${API_BASE_URL}/feature-flags/segments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(segmentData)
  });
  if (!response.ok) throw new Error('Failed to create segment');
  return response.json();
}

/**
 * Get metrics
 * @param {Object} query - Metrics query
 * @returns {Promise<Object>} Metrics data
 */
export async function getMetrics(query = {}) {
  const params = new URLSearchParams();
  if (query.flagId) params.append('flagId', query.flagId);
  if (query.experimentId) params.append('experimentId', query.experimentId);
  if (query.startDate) params.append('startDate', query.startDate);
  if (query.endDate) params.append('endDate', query.endDate);

  const response = await fetch(`${API_BASE_URL}/feature-flags/metrics?${params}`);
  if (!response.ok) throw new Error('Failed to get metrics');
  return response.json();
}
