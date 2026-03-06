/**
 * Claude Code Service - Frontend
 * Issue #3107, #3260: Direct Claude Code integration via Chat.vue
 *
 * This service provides a clean API for interacting with Claude Code
 * running in headless mode on the backend server.
 *
 * Architecture:
 * - Development: Vite proxy forwards /api/claude-code → http://localhost:8081/api/claude-code
 * - Production: Set VITE_ORCHESTRATOR_URL=https://dev.drondoc.ru to connect directly to backend
 * - Direct backend: Use VITE_ORCHESTRATOR_URL (e.g., https://dev.drondoc.ru)
 */

// Use VITE_ORCHESTRATOR_URL to connect directly to backend (e.g., https://dev.drondoc.ru)
// IMPORTANT: backend/monolith runs behind nginx reverse proxy
// Issue #3260: VITE_ORCHESTRATOR_URL is REQUIRED
const ORCHESTRATOR_URL = import.meta.env.VITE_ORCHESTRATOR_URL;

if (!ORCHESTRATOR_URL) {
  console.error('❌ VITE_ORCHESTRATOR_URL is not set! Please configure it in .env file.');
  console.error('Expected format: https://dev.drondoc.ru or https://drondoc.ru');
  throw new Error('VITE_ORCHESTRATOR_URL environment variable is required');
}

const CLAUDE_CODE_API_URL = `${ORCHESTRATOR_URL}/api/claude-code`;

/**
 * Create a new Claude Code session
 * @param {string} userId - User identifier
 * @param {object} options - Session options
 * @param {string} options.repositoryUrl - Git repository URL to clone
 * @param {array} options.allowedTools - Tools Claude Code can use
 * @param {string} options.permissionMode - 'acceptEdits' or 'ask'
 * @returns {Promise<object>} Session object
 */
export async function createSession(userId, options = {}) {
  const response = await fetch(`${CLAUDE_CODE_API_URL}/sessions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      userId,
      ...options,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to create session');
  }

  const data = await response.json();
  return data;
}

/**
 * Send a message to Claude Code (streaming)
 * @param {string} sessionId - Session identifier
 * @param {string} message - User message
 * @param {function} onChunk - Callback for streaming text chunks
 * @returns {Promise<void>}
 */
export async function chat(sessionId, message, onChunk) {
  const response = await fetch(`${CLAUDE_CODE_API_URL}/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sessionId,
      message,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Chat request failed');
  }

  // Read streaming response
  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value, { stream: true });
    if (onChunk) {
      onChunk(chunk);
    }
  }
}

/**
 * Get Git status for session workspace
 * @param {string} sessionId - Session identifier
 * @returns {Promise<object>} Git status
 */
export async function getGitStatus(sessionId) {
  const response = await fetch(`${CLAUDE_CODE_API_URL}/sessions/${sessionId}/git/status`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to get Git status');
  }

  const data = await response.json();
  return data;
}

/**
 * Commit changes in session workspace
 * @param {string} sessionId - Session identifier
 * @param {string} commitMessage - Commit message
 * @returns {Promise<object>} Commit result
 */
export async function commitChanges(sessionId, commitMessage) {
  const response = await fetch(`${CLAUDE_CODE_API_URL}/sessions/${sessionId}/git/commit`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      commitMessage,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to commit changes');
  }

  const data = await response.json();
  return data.result;
}

/**
 * Push changes to remote repository
 * @param {string} sessionId - Session identifier
 * @returns {Promise<object>} Push result
 */
export async function pushChanges(sessionId) {
  const response = await fetch(`${CLAUDE_CODE_API_URL}/sessions/${sessionId}/git/push`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to push changes');
  }

  const data = await response.json();
  return data.result;
}

/**
 * List files in session workspace
 * @param {string} sessionId - Session identifier
 * @param {string} directory - Relative directory path (default: '')
 * @returns {Promise<array>} Array of files and directories
 */
export async function listFiles(sessionId, directory = '') {
  const url = new URL(`${CLAUDE_CODE_API_URL}/sessions/${sessionId}/files`);
  if (directory) {
    url.searchParams.set('directory', directory);
  }

  const response = await fetch(url);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to list files');
  }

  const data = await response.json();
  return data.files;
}

/**
 * Read file content from session workspace
 * @param {string} sessionId - Session identifier
 * @param {string} filepath - Relative file path
 * @returns {Promise<string>} File content
 */
export async function readFile(sessionId, filepath) {
  const url = new URL(`${CLAUDE_CODE_API_URL}/sessions/${sessionId}/files/content`);
  url.searchParams.set('filepath', filepath);

  const response = await fetch(url);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to read file');
  }

  const data = await response.json();
  return data.content;
}

/**
 * Delete a Claude Code session
 * @param {string} sessionId - Session identifier
 * @returns {Promise<void>}
 */
export async function deleteSession(sessionId) {
  const response = await fetch(`${CLAUDE_CODE_API_URL}/sessions/${sessionId}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to delete session');
  }
}

/**
 * Get all sessions for a user
 * @param {string} userId - User identifier
 * @returns {Promise<array>} Array of session objects
 */
export async function getUserSessions(userId) {
  const response = await fetch(`${CLAUDE_CODE_API_URL}/users/${userId}/sessions`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to get user sessions');
  }

  const data = await response.json();
  return data;
}

/**
 * Check Claude Code service health
 * @returns {Promise<object>} Health status
 */
export async function checkHealth() {
  const response = await fetch(`${CLAUDE_CODE_API_URL}/health`);
  const data = await response.json();
  return data;
}

export const claudeCodeService = {
  createSession,
  chat,
  getGitStatus,
  commitChanges,
  pushChanges,
  listFiles,
  readFile,
  deleteSession,
  getUserSessions,
  checkHealth,
};

export default claudeCodeService;
