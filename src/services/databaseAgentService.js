/**
 * Database Agent Service
 *
 * Comprehensive database management service combining:
 * - Backups and recovery
 * - Query optimization
 * - Performance monitoring
 * - Schema migrations
 * - Data archiving
 *
 * Issue #2474: Database Management Agent
 */

const API_BASE_URL = import.meta.env.VITE_ORCHESTRATOR_URL || '/api';

/**
 * Get database health status
 * @returns {Promise<Object>} Health metrics
 */
export async function getHealthStatus() {
  const response = await fetch(`${API_BASE_URL}/database-agent/health`);

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const data = await response.json();

  if (!data.success) {
    throw new Error(data.error || 'Failed to get health status');
  }

  return data.data;
}

/**
 * Get performance metrics
 * @returns {Promise<Object>} Performance data
 */
export async function getPerformanceMetrics() {
  const response = await fetch(`${API_BASE_URL}/database-agent/performance`);

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const data = await response.json();

  if (!data.success) {
    throw new Error(data.error || 'Failed to get performance metrics');
  }

  return data.data;
}

/**
 * Optimize queries and get suggestions
 * @returns {Promise<Object>} Optimization suggestions
 */
export async function optimizeQueries() {
  const response = await fetch(`${API_BASE_URL}/database-agent/optimize-queries`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const data = await response.json();

  if (!data.success) {
    throw new Error(data.error || 'Failed to optimize queries');
  }

  return data.data;
}

/**
 * List schema migrations
 * @returns {Promise<Array>} List of migrations
 */
export async function listMigrations() {
  const response = await fetch(`${API_BASE_URL}/database-agent/migrations`);

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const data = await response.json();

  if (!data.success) {
    throw new Error(data.error || 'Failed to list migrations');
  }

  return data.data;
}

/**
 * Create a new migration
 * @param {Object} migration - Migration data
 * @param {string} migration.name - Migration name
 * @param {string} migration.description - Migration description
 * @param {string} migration.sql - Forward SQL
 * @param {string} migration.rollbackSql - Rollback SQL (optional)
 * @returns {Promise<Object>} Created migration
 */
export async function createMigration(migration) {
  const response = await fetch(`${API_BASE_URL}/database-agent/migrations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(migration)
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const data = await response.json();

  if (!data.success) {
    throw new Error(data.error || 'Failed to create migration');
  }

  return data.data;
}

/**
 * Apply a migration
 * @param {string|number} migrationId - Migration ID
 * @returns {Promise<Object>} Apply result
 */
export async function applyMigration(migrationId) {
  const response = await fetch(`${API_BASE_URL}/database-agent/migrations/${migrationId}/apply`, {
    method: 'POST'
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const data = await response.json();

  if (!data.success) {
    throw new Error(data.error || 'Failed to apply migration');
  }

  return data.data;
}

/**
 * Rollback a migration
 * @param {string|number} migrationId - Migration ID
 * @returns {Promise<Object>} Rollback result
 */
export async function rollbackMigration(migrationId) {
  const response = await fetch(`${API_BASE_URL}/database-agent/migrations/${migrationId}/rollback`, {
    method: 'POST'
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const data = await response.json();

  if (!data.success) {
    throw new Error(data.error || 'Failed to rollback migration');
  }

  return data.data;
}

/**
 * Get archive candidates
 * @returns {Promise<Array>} List of archivable data
 */
export async function getArchiveCandidates() {
  const response = await fetch(`${API_BASE_URL}/database-agent/archive-candidates`);

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const data = await response.json();

  if (!data.success) {
    throw new Error(data.error || 'Failed to get archive candidates');
  }

  return data.data;
}

/**
 * Archive old data
 * @param {Object} archiveOptions - Archive options
 * @param {string} archiveOptions.table - Table name
 * @param {string} archiveOptions.olderThan - Time interval (e.g., '90 days')
 * @param {string} archiveOptions.archiveTable - Archive table name (optional)
 * @returns {Promise<Object>} Archive result
 */
export async function archiveData(archiveOptions) {
  const response = await fetch(`${API_BASE_URL}/database-agent/archive`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(archiveOptions)
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const data = await response.json();

  if (!data.success) {
    throw new Error(data.error || 'Failed to archive data');
  }

  return data.data;
}

/**
 * Get metrics history
 * @param {Object} options - Query options
 * @param {number} options.days - Number of days
 * @returns {Promise<Object>} Historical metrics
 */
export async function getMetricsHistory(options = {}) {
  const params = new URLSearchParams();

  if (options.days) {
    params.append('days', options.days.toString());
  }

  const response = await fetch(`${API_BASE_URL}/database-agent/metrics-history?${params.toString()}`);

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const data = await response.json();

  if (!data.success) {
    throw new Error(data.error || 'Failed to get metrics history');
  }

  return data.data;
}

export default {
  getHealthStatus,
  getPerformanceMetrics,
  optimizeQueries,
  listMigrations,
  createMigration,
  applyMigration,
  rollbackMigration,
  getArchiveCandidates,
  archiveData,
  getMetricsHistory
};
