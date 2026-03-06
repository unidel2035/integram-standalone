// agentCreatorService.js - Service for Agent Creator Agent
// Issue #2631: Agent for creating agents

import { getOrchestratorUrl } from '@/utils/apiConfig'

const API_BASE_URL = getOrchestratorUrl();

/**
 * Create a new agent
 * @param {Object} agentData - Agent data
 * @param {string} agentData.name - Agent name
 * @param {string} agentData.description - Agent description
 * @param {string} agentData.category - Agent category
 * @param {string} [agentData.aiPrompt] - Optional AI prompt for AI-powered creation
 * @returns {Promise<Object>} Creation result with issue details
 */
export async function createAgent(agentData) {
  const endpoint = agentData.aiPrompt
    ? '/api/agent-creator/create-with-ai'
    : '/api/agent-creator/create';

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(agentData)
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create agent');
  }

  return response.json();
}

/**
 * Get available agent categories
 * @returns {Promise<Array>} List of categories
 */
export async function getAgentCategories() {
  const response = await fetch(`${API_BASE_URL}/api/agent-creator/categories`);

  if (!response.ok) {
    throw new Error('Failed to fetch categories');
  }

  const result = await response.json();
  return result.categories;
}

/**
 * Get agent creation template
 * @returns {Promise<Object>} Template with system prompt and defaults
 */
export async function getAgentTemplate() {
  const response = await fetch(`${API_BASE_URL}/api/agent-creator/template`);

  if (!response.ok) {
    throw new Error('Failed to fetch template');
  }

  const result = await response.json();
  return result.template;
}

/**
 * Get available AI models
 * @returns {Promise<Array>} List of available AI models with their providers
 */
export async function getAIModels() {
  const response = await fetch(`${API_BASE_URL}/api/agent-creator/models`);

  if (!response.ok) {
    throw new Error('Failed to fetch AI models');
  }

  const result = await response.json();
  return result.models;
}

/**
 * Get saved agents from Integram
 * @param {Object} options - Query options
 * @param {string} [options.organizationId] - Organization ID filter
 * @returns {Promise<Array>} List of saved agents
 */
export async function getSavedAgents(options = {}) {
  const params = new URLSearchParams();
  if (options.organizationId) {
    params.append('organizationId', options.organizationId);
  }

  const url = `${API_BASE_URL}/api/agent-creator/saved${params.toString() ? `?${params.toString()}` : ''}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error('Failed to fetch saved agents');
  }

  const result = await response.json();
  return result.agents;
}

/**
 * Get specific saved agent by ID
 * @param {number|string} agentId - Agent ID
 * @param {Object} options - Query options
 * @param {string} [options.organizationId] - Organization ID filter
 * @returns {Promise<Object>} Agent details
 */
export async function getSavedAgent(agentId, options = {}) {
  const params = new URLSearchParams();
  if (options.organizationId) {
    params.append('organizationId', options.organizationId);
  }

  const url = `${API_BASE_URL}/api/agent-creator/saved/${agentId}${params.toString() ? `?${params.toString()}` : ''}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error('Failed to fetch saved agent');
  }

  const result = await response.json();
  return result.agent;
}
