/**
 * Database Manager Service
 *
 * Frontend service for interacting with the Database Manager API
 *
 * Issue #1802: Database Architecture Selection System
 */

import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_ORCHESTRATOR_URL || '/api';

/**
 * Get all available database types
 *
 * @param {Object} filters - Filters for database types
 * @param {string} filters.category - Filter by category
 * @param {string} filters.status - Filter by status
 * @returns {Promise<Object>} Database types data
 */
export async function getDatabaseTypes(filters = {}) {
  try {
    const params = new URLSearchParams();
    if (filters.category) params.append('category', filters.category);
    if (filters.status) params.append('status', filters.status);

    const response = await axios.get(`${API_BASE_URL}/databases/types?${params}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching database types:', error);
    throw error;
  }
}

/**
 * Get a specific database type
 *
 * @param {string} typeId - Database type ID
 * @returns {Promise<Object>} Database type data
 */
export async function getDatabaseType(typeId) {
  try {
    const response = await axios.get(`${API_BASE_URL}/databases/types/${typeId}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching database type:', error);
    throw error;
  }
}

/**
 * Deploy a new database instance
 *
 * @param {Object} deploymentData - Deployment configuration
 * @param {string} deploymentData.type - Database type ID
 * @param {string} deploymentData.name - Instance name
 * @param {Object} deploymentData.config - Configuration options
 * @returns {Promise<Object>} Deployment result
 */
export async function deployDatabase(deploymentData) {
  try {
    const response = await axios.post(`${API_BASE_URL}/databases/deploy`, deploymentData);
    return response.data;
  } catch (error) {
    console.error('Error deploying database:', error);
    throw error;
  }
}

/**
 * Get all database instances
 *
 * @param {Object} filters - Filters for instances
 * @param {string} filters.type - Filter by database type
 * @param {string} filters.status - Filter by status
 * @returns {Promise<Array>} List of instances
 */
export async function getDatabaseInstances(filters = {}) {
  try {
    const params = new URLSearchParams();
    if (filters.type) params.append('type', filters.type);
    if (filters.status) params.append('status', filters.status);

    const response = await axios.get(`${API_BASE_URL}/databases/instances?${params}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching database instances:', error);
    throw error;
  }
}

/**
 * Get status of a specific database instance
 *
 * @param {string} instanceId - Instance ID
 * @returns {Promise<Object>} Instance status
 */
export async function getInstanceStatus(instanceId) {
  try {
    const response = await axios.get(`${API_BASE_URL}/databases/status/${instanceId}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching instance status:', error);
    throw error;
  }
}

/**
 * Test connection to a database instance
 *
 * @param {string} instanceId - Instance ID
 * @returns {Promise<Object>} Connection test result
 */
export async function testConnection(instanceId) {
  try {
    const response = await axios.post(`${API_BASE_URL}/databases/test-connection`, {
      instanceId
    });
    return response.data;
  } catch (error) {
    console.error('Error testing connection:', error);
    throw error;
  }
}

/**
 * Start a stopped database instance
 *
 * @param {string} instanceId - Instance ID
 * @returns {Promise<Object>} Start result
 */
export async function startInstance(instanceId) {
  try {
    const response = await axios.post(`${API_BASE_URL}/databases/${instanceId}/start`);
    return response.data;
  } catch (error) {
    console.error('Error starting instance:', error);
    throw error;
  }
}

/**
 * Stop a running database instance
 *
 * @param {string} instanceId - Instance ID
 * @returns {Promise<Object>} Stop result
 */
export async function stopInstance(instanceId) {
  try {
    const response = await axios.post(`${API_BASE_URL}/databases/${instanceId}/stop`);
    return response.data;
  } catch (error) {
    console.error('Error stopping instance:', error);
    throw error;
  }
}

/**
 * Delete a database instance
 *
 * @param {string} instanceId - Instance ID
 * @returns {Promise<Object>} Delete result
 */
export async function deleteInstance(instanceId) {
  try {
    const response = await axios.delete(`${API_BASE_URL}/databases/${instanceId}`);
    return response.data;
  } catch (error) {
    console.error('Error deleting instance:', error);
    throw error;
  }
}

/**
 * Update instance configuration
 *
 * @param {string} instanceId - Instance ID
 * @param {Object} config - New configuration
 * @returns {Promise<Object>} Update result
 */
export async function updateInstanceConfig(instanceId, config) {
  try {
    const response = await axios.put(`${API_BASE_URL}/databases/${instanceId}/config`, config);
    return response.data;
  } catch (error) {
    console.error('Error updating config:', error);
    throw error;
  }
}

export default {
  getDatabaseTypes,
  getDatabaseType,
  deployDatabase,
  getDatabaseInstances,
  getInstanceStatus,
  testConnection,
  startInstance,
  stopInstance,
  deleteInstance,
  updateInstanceConfig
};
