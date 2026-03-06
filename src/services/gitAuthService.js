/**
 * Git Authorization Service (Frontend)
 * Issue #4052: Git authorization management client
 *
 * This service provides frontend access to Git authorization API.
 */

import { logger } from '@/utils/logger';
import { getOrchestratorUrl } from '@/utils/apiConfig'

const BASE_URL = getOrchestratorUrl();

/**
 * Save Git token for user
 * @param {string} userId - User identifier
 * @param {string} provider - Git provider (github, gitlab, bitbucket)
 * @param {string} token - Access token
 * @param {object} metadata - Additional metadata (optional)
 * @returns {Promise<object>} Save result
 */
export async function saveGitToken(userId, provider, token, metadata = {}) {
  const response = await fetch(`${BASE_URL}/api/git-auth/save-token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      userId,
      provider,
      token,
      metadata
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to save Git token');
  }

  const result = await response.json();
  return result;
}

/**
 * Get Git token for user
 * @param {string} userId - User identifier
 * @param {string} provider - Git provider
 * @returns {Promise<string>} Access token
 */
export async function getGitToken(userId, provider) {
  const response = await fetch(`${BASE_URL}/api/git-auth/get-token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      userId,
      provider
    })
  });

  if (!response.ok) {
    if (response.status === 404) {
      return null; // Token not found
    }
    throw new Error('Failed to get Git token');
  }

  const result = await response.json();
  return result.token;
}

/**
 * Get all Git providers for user
 * @param {string} userId - User identifier
 * @returns {Promise<array>} Array of provider objects
 */
export async function getGitProviders(userId) {
  const response = await fetch(`${BASE_URL}/api/git-auth/providers/${userId}`);

  if (!response.ok) {
    throw new Error('Failed to get Git providers');
  }

  const result = await response.json();
  return result.providers;
}

/**
 * Delete Git token for user
 * @param {string} userId - User identifier
 * @param {string} provider - Git provider
 * @returns {Promise<object>} Delete result
 */
export async function deleteGitToken(userId, provider) {
  const response = await fetch(`${BASE_URL}/api/git-auth/delete-token`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      userId,
      provider
    })
  });

  if (!response.ok) {
    throw new Error('Failed to delete Git token');
  }

  const result = await response.json();
  return result;
}

/**
 * Verify GitHub token is valid
 * @param {string} token - GitHub token
 * @returns {Promise<object>} Verification result
 */
export async function verifyGitHubToken(token) {
  const response = await fetch(`${BASE_URL}/api/git-auth/verify-github-token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ token })
  });

  if (!response.ok) {
    throw new Error('Failed to verify GitHub token');
  }

  const result = await response.json();
  return result;
}

export default {
  saveGitToken,
  getGitToken,
  getGitProviders,
  deleteGitToken,
  verifyGitHubToken
};
