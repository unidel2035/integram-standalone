/**
 * Workspace AI Agent Service
 * Issue #4423: Natural language workspace chat integration
 *
 * Integrates with backend workspace AI agent API that provides:
 * - Tool calling for file operations (read, write, edit)
 * - Search operations (glob, grep, codesearch)
 * - Git operations (status, commit, push, pull, diff, etc.)
 * - Shell command execution
 *
 * Backend endpoint: /workspace-ai-agent/chat
 * Stream format: Server-Sent Events (SSE)
 *
 * IMPORTANT: BASE_URL already includes '/api' (e.g., 'https://dev.drondoc.ru/api')
 * Do NOT add '/api' prefix to paths - it will create double '/api/api/' paths!
 */

import { logger } from '@/utils/logger';
import { getApiUrl } from '@/utils/apiConfig';

// Base URL for backend API - already includes '/api' prefix
// Example: 'https://dev.drondoc.ru/api' or 'http://localhost:8081'
const BASE_URL = getApiUrl('/api');

/**
 * Chat with AI agent for workspace using SSE streaming
 * @param {string} workspaceId - Workspace identifier
 * @param {string} message - User message
 * @param {string} userId - User identifier
 * @param {object} options - Additional options
 * @param {string} options.sessionId - Session ID for conversation history
 * @param {string} options.modelId - AI model ID to use
 * @param {function} options.onMessageStart - Callback when message starts
 * @param {function} options.onContentDelta - Callback for streaming text chunks
 * @param {function} options.onToolUse - Callback when tool is executed
 * @param {function} options.onToolResult - Callback when tool execution completes
 * @param {function} options.onMessageComplete - Callback when message completes
 * @param {function} options.onError - Callback for errors
 * @returns {Promise<void>}
 */
export async function chatWithWorkspaceAgent(workspaceId, message, userId, options = {}) {
  const {
    sessionId,
    modelId,
    onMessageStart,
    onContentDelta,
    onToolUse,
    onToolResult,
    onMessageComplete,
    onError
  } = options;

  logger.info({
    workspaceId,
    userId,
    messageLength: message.length,
    sessionId,
    modelId
  }, 'Starting workspace AI agent chat');

  try {
    // Make POST request to AI agent endpoint
    const response = await fetch(`${BASE_URL}/workspace-ai-agent/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        workspaceId,
        message,
        userId,
        sessionId,
        modelId
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));

      // Provide user-friendly error messages
      let errorMessage = errorData.error || errorData.details || errorData.message || `Request failed: ${response.status}`;

      // Log the full error for debugging
      logger.info({
        status: response.status,
        errorData,
        workspaceId,
        userId
      }, 'Workspace AI agent request failed');

      if (response.status === 400) {
        // Check if it's an API key configuration issue
        if (errorMessage.includes('No API key') || errorMessage.includes('провайдера') || errorMessage.includes('provider') || errorMessage.includes('API key')) {
          errorMessage = `AI provider not configured. ${errorMessage}\n\nPlease contact system administrator to configure AI API keys (POLZA_AI_API_KEY, DEEPSEEK_API_KEY, ANTHROPIC_API_KEY, or OPENAI_API_KEY) in backend .env file.`;
        } else if (errorMessage.includes('Missing required fields')) {
          errorMessage = `Invalid request: ${errorMessage}\n\nRequired fields: workspaceId, message, userId`;
        } else {
          // Generic 400 error - provide detailed info
          errorMessage = `Bad request (400): ${errorMessage}\n\nPlease check your request parameters and try again.`;
        }
      } else if (response.status === 404) {
        errorMessage = errorData.details?.message || 'Workspace not found. Please create a workspace first or check the workspace ID.';
      } else if (response.status === 403) {
        errorMessage = errorData.details?.message || 'Access denied to workspace. You can only access workspaces that you own.';
      } else if (response.status >= 500) {
        const details = errorData.details || errorData.message || '';
        errorMessage = `Server error (${response.status}): ${details}\n\nPlease check if AI provider API keys are configured and try again later.`;
      }

      throw new Error(errorMessage);
    }

    // Read SSE stream
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    let messageCompleted = false;

    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        logger.info('Workspace AI agent chat stream completed');
        // Ensure onMessageComplete is called when stream ends
        if (!messageCompleted && onMessageComplete) {
          onMessageComplete({ streamEnded: true });
        }
        break;
      }

      // Decode chunk and add to buffer
      buffer += decoder.decode(value, { stream: true });

      // Process complete SSE events in buffer
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep incomplete line in buffer

      for (const line of lines) {
        if (line.startsWith('event:')) {
          // const eventType = line.substring(6).trim();
          continue;
        }

        if (line.startsWith('data:')) {
          const dataStr = line.substring(5).trim();
          if (!dataStr) continue;

          try {
            const data = JSON.parse(dataStr);

            // Handle different event types
            if (data.error) {
              if (onError) {
                onError(data.error);
              }
              // Stop processing if error occurred
              return;
            } else if (data.id && onMessageStart) {
              // message_start event
              onMessageStart(data);
            } else if (data.text !== undefined && onContentDelta) {
              // content_block_delta event - map 'text' to 'delta' for component compatibility
              onContentDelta({ delta: data.text });
            } else if (data.name && data.input && onToolUse) {
              // tool_use event
              onToolUse(data);
            } else if (data.tool_use_id && onToolResult) {
              // tool_result event - map backend format to component format
              // Backend sends: { tool_use_id, success, ...toolResult }
              // Component expects: { name, result }
              const { tool_use_id, ...result } = data;
              onToolResult({ name: data.name || 'unknown', result });
            } else if (data.usage && onMessageComplete) {
              // message_complete event
              messageCompleted = true;
              onMessageComplete(data);
            }
          } catch (parseError) {
            logger.error({ error: parseError.message, dataStr }, 'Failed to parse SSE data');
          }
        }
      }
    }
  } catch (error) {
    logger.error({ error: error.message, workspaceId, userId }, 'Workspace AI agent chat failed');
    if (onError) {
      onError(error.message);
    }
    throw error;
  }
}

/**
 * Get list of workspaces accessible by user
 * @param {string} userId - User identifier
 * @returns {Promise<array>} Array of workspace objects
 */
export async function getWorkspaces(userId) {
  try {
    const response = await fetch(`${BASE_URL}/workspace-ai-agent/workspaces?userId=${userId}`);

    if (!response.ok) {
      throw new Error('Failed to get workspaces');
    }

    const result = await response.json();
    return result.data.workspaces;
  } catch (error) {
    logger.error({ error: error.message, userId }, 'Failed to get workspaces');
    throw error;
  }
}

/**
 * Get conversation history for a session
 * @param {string} sessionId - Session identifier
 * @param {string} userId - User identifier
 * @returns {Promise<object>} Session data with conversation history
 */
export async function getSession(sessionId, userId) {
  try {
    const response = await fetch(`${BASE_URL}/workspace-ai-agent/session/${sessionId}?userId=${userId}`);

    if (!response.ok) {
      if (response.status === 404) {
        return null; // Session not found
      }
      throw new Error('Failed to get session');
    }

    const result = await response.json();
    return result.data;
  } catch (error) {
    logger.error({ error: error.message, sessionId, userId }, 'Failed to get session');
    throw error;
  }
}

/**
 * Delete a conversation session
 * @param {string} sessionId - Session identifier
 * @param {string} userId - User identifier
 * @returns {Promise<void>}
 */
export async function deleteSession(sessionId, userId) {
  try {
    const response = await fetch(`${BASE_URL}/workspace-ai-agent/session/${sessionId}?userId=${userId}`, {
      method: 'DELETE'
    });

    if (!response.ok) {
      throw new Error('Failed to delete session');
    }

    logger.info({ sessionId, userId }, 'Session deleted successfully');
  } catch (error) {
    logger.error({ error: error.message, sessionId, userId }, 'Failed to delete session');
    throw error;
  }
}

export default {
  chatWithWorkspaceAgent,
  getWorkspaces,
  getSession,
  deleteSession
};
