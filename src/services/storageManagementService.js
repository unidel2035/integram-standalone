/**
 * Storage Management Service
 * Issue #2670: storage-management-agent работа с реальными серверами
 *
 * Frontend service for interacting with storage management backend APIs
 */

import { getOrchestratorUrl } from '@/utils/apiConfig'

const API_BASE_URL = getOrchestratorUrl();

/**
 * Get storage statistics (disk usage)
 */
export async function getStorageStats() {
  const response = await fetch(`${API_BASE_URL}/api/storage-management/stats`);
  if (!response.ok) {
    throw new Error('Failed to fetch storage statistics');
  }
  const result = await response.json();
  return result.data;
}

/**
 * Get detailed disk information
 */
export async function getDiskInfo() {
  const response = await fetch(`${API_BASE_URL}/api/storage-management/disk-info`);
  if (!response.ok) {
    throw new Error('Failed to fetch disk information');
  }
  const result = await response.json();
  return result.data;
}

/**
 * Scan directories for file type analysis
 * @param {Object} options - Scan options
 * @param {string[]} options.directories - Directories to scan (optional)
 * @param {number} options.maxDepth - Maximum recursion depth (default: 3)
 */
export async function scanFileTypes(options = {}) {
  const response = await fetch(`${API_BASE_URL}/api/storage-management/scan-file-types`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(options)
  });

  if (!response.ok) {
    throw new Error('Failed to scan file types');
  }

  const result = await response.json();
  return result.data;
}

/**
 * Scan for cold storage candidates
 * @param {Object} options - Scan options
 * @param {string[]} options.directories - Directories to scan (optional)
 * @param {number} options.daysThreshold - Days since last access (default: 90)
 * @param {number} options.minSizeMB - Minimum file size in MB (default: 10)
 * @param {number} options.maxResults - Maximum results to return (default: 100)
 */
export async function scanColdStorageCandidates(options = {}) {
  const response = await fetch(`${API_BASE_URL}/api/storage-management/scan-cold-storage`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(options)
  });

  if (!response.ok) {
    throw new Error('Failed to scan cold storage candidates');
  }

  const result = await response.json();
  return result.data;
}

/**
 * Scan for duplicate files
 * @param {Object} options - Scan options
 * @param {string[]} options.directories - Directories to scan (optional)
 * @param {number} options.minSizeMB - Minimum file size in MB (default: 1)
 */
export async function scanDuplicates(options = {}) {
  const response = await fetch(`${API_BASE_URL}/api/storage-management/scan-duplicates`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(options)
  });

  if (!response.ok) {
    throw new Error('Failed to scan for duplicates');
  }

  const result = await response.json();
  return result.data;
}

/**
 * Get activity log
 * @param {number} limit - Number of entries to retrieve (default: 100)
 */
export async function getActivityLog(limit = 100) {
  const response = await fetch(`${API_BASE_URL}/api/storage-management/activity-log?limit=${limit}`);

  if (!response.ok) {
    throw new Error('Failed to fetch activity log');
  }

  const result = await response.json();
  return result.data;
}

/**
 * Check storage management service health
 */
export async function checkHealth() {
  const response = await fetch(`${API_BASE_URL}/api/storage-management/health`);

  if (!response.ok) {
    throw new Error('Storage management service is unhealthy');
  }

  const result = await response.json();
  return result;
}

/**
 * Format bytes to human-readable format
 */
export function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}
