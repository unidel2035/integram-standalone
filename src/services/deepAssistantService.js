/**
 * Deep Assistant Agent Service
 * Frontend service for integrating with deep-assistant/agent backend API
 *
 * @see backend/monolith/src/api/routes/deep-assistant.js
 * @see backend/monolith/src/services/DeepAssistantAgent.js
 */

import { getApiUrl } from '@/utils/apiConfig';
import { logger } from '@/utils/logger';
import { DEFAULT_AI_MODEL } from '@/config/aiDefaults.js';

const API_BASE_URL = getApiUrl();

/**
 * Execute agent with a message (streaming via SSE)
 * @param {Object} options - Execution options
 * @param {string} options.message - User message (required)
 * @param {string} [options.workspaceId] - Workspace ID
 * @param {string} [options.workingDirectory] - Working directory
 * @param {string} [options.model] - AI model (default: opencode/grok-code)
 * @param {string} [options.systemMessage] - System message override
 * @param {string} [options.appendSystemMessage] - Append to system message
 * @param {Function} [options.onEvent] - Event callback
 * @param {Function} [options.onText] - Text chunk callback
 * @param {Function} [options.onToolUse] - Tool use callback
 * @param {Function} [options.onError] - Error callback
 * @param {Function} [options.onComplete] - Completion callback
 * @returns {Object} - Event source and session info
 */
export async function executeAgentStreaming(options) {
  const {
    message,
    workspaceId,
    workingDirectory,
    model = DEFAULT_AI_MODEL,
    systemMessage,
    appendSystemMessage,
    onEvent,
    onText,
    onToolUse,
    onError,
    onComplete
  } = options;

  if (!message) {
    throw new Error('message is required');
  }

  try {
    const payload = {
      message,
      workspaceId,
      workingDirectory,
      model,
      systemMessage,
      appendSystemMessage
    };

    logger.info('Starting deep-assistant agent execution (streaming)', {
      model,
      workspaceId,
      messageLength: message.length
    });

    const response = await fetch(`${API_BASE_URL}/api/deep-assistant/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Failed to start agent: ${response.statusText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let sessionId = null;

    const readStream = async () => {
      try {
        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            if (onComplete) {
              onComplete({ sessionId });
            }
            break;
          }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop(); // Keep incomplete line in buffer

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const dataStr = line.substring(6);
              if (dataStr.trim()) {
                try {
                  const event = JSON.parse(dataStr);

                  // Extract session ID from first event
                  if (!sessionId && event.sessionId) {
                    sessionId = event.sessionId;
                  }

                  // Call generic event handler
                  if (onEvent) {
                    onEvent(event);
                  }

                  // Handle specific event types
                  switch (event.type) {
                    case 'session_start':
                      logger.info('Agent session started', { sessionId: event.sessionId });
                      break;

                    case 'text':
                      if (event.part && event.part.text) {
                        if (onText) {
                          onText(event.part.text);
                        }
                      }
                      break;

                    case 'tool_use':
                      if (onToolUse && event.part) {
                        onToolUse({
                          toolId: event.part.id,
                          toolName: event.part.name,
                          toolInput: event.part.input
                        });
                      }
                      break;

                    case 'error':
                      logger.error('Agent error event', { error: event.error });
                      if (onError) {
                        onError(new Error(event.error));
                      }
                      break;

                    case 'session_complete':
                      logger.info('Agent session completed', {
                        sessionId: event.sessionId,
                        eventCount: event.eventCount
                      });
                      break;
                  }
                } catch (parseError) {
                  logger.warn('Failed to parse SSE event', { error: parseError.message });
                }
              }
            }
          }
        }
      } catch (streamError) {
        logger.error('Stream read error', { error: streamError.message });
        if (onError) {
          onError(streamError);
        }
      }
    };

    // Start reading stream
    readStream();

    return {
      sessionId: sessionId || 'pending',
      cancel: () => {
        reader.cancel();
      }
    };

  } catch (error) {
    logger.error('Failed to execute agent', { error: error.message });
    throw error;
  }
}

/**
 * Execute agent synchronously (no streaming)
 * @param {Object} options - Same as executeAgentStreaming but without callbacks
 * @returns {Promise<Object>} - Execution result
 */
export async function executeAgent(options) {
  const {
    message,
    workspaceId,
    workingDirectory,
    model = DEFAULT_AI_MODEL,
    systemMessage,
    appendSystemMessage
  } = options;

  if (!message) {
    throw new Error('message is required');
  }

  try {
    const payload = {
      message,
      workspaceId,
      workingDirectory,
      model,
      systemMessage,
      appendSystemMessage
    };

    logger.info('Starting deep-assistant agent execution (sync)', {
      model,
      workspaceId,
      messageLength: message.length
    });

    const response = await fetch(`${API_BASE_URL}/api/deep-assistant/execute-sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to execute agent');
    }

    const result = await response.json();

    logger.info('Agent execution completed', {
      sessionId: result.sessionId,
      eventCount: result.events?.length || 0,
      outputLength: result.output?.length || 0
    });

    return result;

  } catch (error) {
    logger.error('Failed to execute agent', { error: error.message });
    throw error;
  }
}

/**
 * Get agent session status
 * @param {string} sessionId - Agent session ID
 * @returns {Promise<Object>} - Session status
 */
export async function getSessionStatus(sessionId) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/deep-assistant/sessions/${sessionId}/status`);

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to get session status');
    }

    const result = await response.json();
    return result.status;

  } catch (error) {
    logger.error('Failed to get session status', { error: error.message, sessionId });
    throw error;
  }
}

/**
 * Stop agent execution
 * @param {string} sessionId - Agent session ID
 * @returns {Promise<boolean>} - Success status
 */
export async function stopAgent(sessionId) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/deep-assistant/sessions/${sessionId}/stop`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to stop agent');
    }

    logger.info('Agent stopped', { sessionId });
    return true;

  } catch (error) {
    logger.error('Failed to stop agent', { error: error.message, sessionId });
    throw error;
  }
}

/**
 * Get all active sessions
 * @returns {Promise<Array>} - List of active sessions
 */
export async function getAllSessions() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/deep-assistant/sessions`);

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to get sessions');
    }

    const result = await response.json();
    return result.sessions || [];

  } catch (error) {
    logger.error('Failed to get sessions', { error: error.message });
    throw error;
  }
}

/**
 * Get sessions for a workspace
 * @param {string} workspaceId - Workspace ID
 * @returns {Promise<Array>} - List of workspace sessions
 */
export async function getWorkspaceSessions(workspaceId) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/deep-assistant/workspace/${workspaceId}/sessions`);

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to get workspace sessions');
    }

    const result = await response.json();
    return result.sessions || [];

  } catch (error) {
    logger.error('Failed to get workspace sessions', { error: error.message, workspaceId });
    throw error;
  }
}

/**
 * Health check
 * @returns {Promise<Object>} - Health status
 */
export async function checkHealth() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/deep-assistant/health`);

    if (!response.ok) {
      throw new Error('Deep Assistant Agent service is unhealthy');
    }

    const result = await response.json();
    return result;

  } catch (error) {
    logger.error('Health check failed', { error: error.message });
    throw error;
  }
}

/**
 * Available models for deep-assistant/agent
 * Based on https://github.com/deep-assistant/agent/blob/main/MODELS.md
 */
export const AVAILABLE_MODELS = [
  // Free OpenCode models (no API key required)
  {
    id: 'opencode/grok-code',
    name: 'Grok Code (Free, Default)',
    provider: 'OpenCode',
    description: 'Free model optimized for coding tasks'
  },
  {
    id: 'opencode/gpt-5-nano',
    name: 'GPT 5 Nano (Free)',
    provider: 'OpenCode',
    description: 'Free lightweight model'
  },
  {
    id: 'opencode/big-pickle',
    name: 'Big Pickle (Free)',
    provider: 'OpenCode',
    description: 'Free general-purpose model'
  },
  // Polza models (configured in polza-config-example.json)
  {
    id: 'polza/claude-sonnet-4.5',
    name: 'Claude Sonnet 4.5 (Polza)',
    provider: 'Polza',
    description: 'Most capable model for complex tasks'
  },
];

export default {
  executeAgentStreaming,
  executeAgent,
  getSessionStatus,
  stopAgent,
  getAllSessions,
  getWorkspaceSessions,
  checkHealth,
  AVAILABLE_MODELS
};
