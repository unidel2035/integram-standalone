/**
 * GitHub API Service (Frontend)
 * Issue #4052: GitHub operations without cloning
 *
 * This service provides frontend access to GitHub API operations
 * without requiring local repository clones.
 */

import { getOrchestratorUrl } from '@/utils/apiConfig'

const BASE_URL = getOrchestratorUrl();

/**
 * Parse repository URL
 * @param {string} repoUrl - Repository URL
 * @returns {Promise<object>} Parsed owner and repo name
 */
export async function parseRepoUrl(repoUrl) {
  const response = await fetch(`${BASE_URL}/api/github/parse-repo-url`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ repoUrl })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to parse repository URL');
  }

  return await response.json();
}

/**
 * Get repository branches
 * @param {string} repoUrl - Repository URL
 * @param {string} token - GitHub token (optional)
 * @returns {Promise<array>} Array of branches
 */
export async function getBranches(repoUrl, token = null) {
  const response = await fetch(`${BASE_URL}/api/github/branches`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ repoUrl, token })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to get branches');
  }

  const result = await response.json();
  return result.branches;
}

/**
 * Get repository commits
 * @param {string} repoUrl - Repository URL
 * @param {string} token - GitHub token (optional)
 * @param {object} options - Query options
 * @returns {Promise<array>} Array of commits
 */
export async function getCommits(repoUrl, token = null, options = {}) {
  const response = await fetch(`${BASE_URL}/api/github/commits`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      repoUrl,
      token,
      ...options
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to get commits');
  }

  const result = await response.json();
  return result.commits;
}

/**
 * Get file content from repository
 * @param {string} repoUrl - Repository URL
 * @param {string} filepath - File path
 * @param {string} token - GitHub token (optional)
 * @param {string} branch - Branch name (optional)
 * @returns {Promise<object>} File content and metadata
 */
export async function getFileContent(repoUrl, filepath, token = null, branch = null) {
  const response = await fetch(`${BASE_URL}/api/github/file-content`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      repoUrl,
      filepath,
      token,
      branch
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to get file content');
  }

  const result = await response.json();
  return result.file;
}

/**
 * Get directory contents
 * @param {string} repoUrl - Repository URL
 * @param {string} path - Directory path
 * @param {string} token - GitHub token (optional)
 * @param {string} branch - Branch name (optional)
 * @returns {Promise<array>} Directory contents
 */
export async function getDirectoryContents(repoUrl, path = '', token = null, branch = null) {
  const response = await fetch(`${BASE_URL}/api/github/directory-contents`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      repoUrl,
      path,
      token,
      branch
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to get directory contents');
  }

  const result = await response.json();
  return result.contents;
}

/**
 * Create or update file in repository
 * @param {string} repoUrl - Repository URL
 * @param {string} filepath - File path
 * @param {string} content - File content
 * @param {string} message - Commit message
 * @param {string} token - GitHub token (required)
 * @param {object} options - Options
 * @returns {Promise<object>} Commit result
 */
export async function createOrUpdateFile(repoUrl, filepath, content, message, token, options = {}) {
  const response = await fetch(`${BASE_URL}/api/github/create-or-update-file`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      repoUrl,
      filepath,
      content,
      message,
      token,
      ...options
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create/update file');
  }

  return await response.json();
}

/**
 * Delete file from repository
 * @param {string} repoUrl - Repository URL
 * @param {string} filepath - File path
 * @param {string} message - Commit message
 * @param {string} sha - File SHA (required)
 * @param {string} token - GitHub token (required)
 * @param {string} branch - Branch name (optional)
 * @returns {Promise<object>} Delete result
 */
export async function deleteFile(repoUrl, filepath, message, sha, token, branch = 'main') {
  const response = await fetch(`${BASE_URL}/api/github/delete-file`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      repoUrl,
      filepath,
      message,
      sha,
      token,
      branch
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to delete file');
  }

  return await response.json();
}

/**
 * Get repository issues
 * @param {string} repoUrl - Repository URL
 * @param {string} token - GitHub token (optional)
 * @param {object} options - Query options
 * @returns {Promise<array>} Array of issues
 */
export async function getIssues(repoUrl, token = null, options = {}) {
  const response = await fetch(`${BASE_URL}/api/github/issues`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      repoUrl,
      token,
      ...options
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to get issues');
  }

  const result = await response.json();
  return result.issues;
}

/**
 * Get repository pull requests
 * @param {string} repoUrl - Repository URL
 * @param {string} token - GitHub token (optional)
 * @param {object} options - Query options
 * @returns {Promise<array>} Array of pull requests
 */
export async function getPullRequests(repoUrl, token = null, options = {}) {
  const response = await fetch(`${BASE_URL}/api/github/pull-requests`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      repoUrl,
      token,
      ...options
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to get pull requests');
  }

  const result = await response.json();
  return result.pullRequests;
}

/**
 * Get authenticated user info
 * @param {string} token - GitHub token (required)
 * @returns {Promise<object>} User info
 */
export async function getAuthenticatedUser(token) {
  const response = await fetch(`${BASE_URL}/api/github/user`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ token })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to get user');
  }

  const result = await response.json();
  return result.user;
}

/**
 * Search repositories
 * @param {string} query - Search query
 * @param {string} token - GitHub token (optional)
 * @param {number} limit - Number of results
 * @returns {Promise<array>} Array of repositories
 */
export async function searchRepositories(query, token = null, limit = 30) {
  const response = await fetch(`${BASE_URL}/api/github/search-repositories`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      query,
      token,
      limit
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to search repositories');
  }

  const result = await response.json();
  return result.repositories;
}

export default {
  parseRepoUrl,
  getBranches,
  getCommits,
  getFileContent,
  getDirectoryContents,
  createOrUpdateFile,
  deleteFile,
  getIssues,
  getPullRequests,
  getAuthenticatedUser,
  searchRepositories
};
