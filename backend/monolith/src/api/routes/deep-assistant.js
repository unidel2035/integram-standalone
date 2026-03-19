/**
 * Deep Assistant Agent API Routes
 * Issue #4392: Add UI & functionality for deep-assistant/agent integration
 *
 * This API provides endpoints for executing and managing the deep-assistant/agent,
 * a Bun-based CLI agent with comprehensive tool support.
 *
 * Architecture:
 * ChatPage.vue → /api/deep-assistant → DeepAssistantAgentService → @link-assistant/agent
 */

import express from 'express';
import logger from '../../utils/logger.js';
import { agentManager } from '../../services/DeepAssistantAgent.js';

/**
 * Create Deep Assistant API routes
 */
export function createDeepAssistantRoutes() {
  const router = express.Router();

  /**
   * POST /api/deep-assistant/execute
   * Execute agent with a message
   *
   * Request body:
   * {
   *   message: string,           // User message (required)
   *   workspaceId: string,       // Workspace ID (optional)
   *   workingDirectory: string,  // Working directory (optional)
   *   model: string,             // AI model (optional, default: opencode/grok-code)
   *   systemMessage: string,     // System message override (optional)
   *   appendSystemMessage: string // Append to system message (optional)
   * }
   *
   * Response:
   * {
   *   success: true,
   *   sessionId: string,
   *   events: array,
   *   output: string
   * }
   */
  router.post('/execute', async (req, res) => {
    try {
      const {
        message,
        workspaceId,
        workingDirectory,
        model,
        systemMessage,
        appendSystemMessage
      } = req.body;

      // Validate required fields
      if (!message) {
        return res.status(400).json({
          success: false,
          error: 'message is required'
        });
      }

      // Create agent instance
      const { agent, sessionId } = agentManager.createAgent({
        workspaceId,
        workingDirectory,
        model,
        systemMessage,
        appendSystemMessage
      });

      // Execute agent and stream events
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      // Send initial session info
      res.write(`data: ${JSON.stringify({
        type: 'session_start',
        sessionId,
        timestamp: new Date().toISOString()
      })}\n\n`);

      // Forward agent events to SSE stream
      agent.on('event', (event) => {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      });

      agent.on('error_event', (event) => {
        res.write(`data: ${JSON.stringify({
          type: 'error',
          error: event.error,
          timestamp: new Date().toISOString()
        })}\n\n`);
      });

      // Execute agent
      try {
        const result = await agent.execute(message, {
          model,
          systemMessage,
          appendSystemMessage
        });

        // Send completion event
        res.write(`data: ${JSON.stringify({
          type: 'session_complete',
          sessionId,
          eventCount: result.events.length,
          timestamp: new Date().toISOString()
        })}\n\n`);

        res.end();

        logger.info({
          sessionId,
          eventCount: result.events.length,
          message: message.substring(0, 100)
        }, 'Agent execution completed');

      } catch (execError) {
        // Send error event
        res.write(`data: ${JSON.stringify({
          type: 'error',
          error: execError.message,
          timestamp: new Date().toISOString()
        })}\n\n`);

        res.end();

        logger.error({
          sessionId,
          error: execError.message
        }, 'Agent execution failed');
      }

    } catch (error) {
      logger.error({ error: error.message }, 'Failed to execute agent');

      // If headers not sent yet, send JSON error
      if (!res.headersSent) {
        return res.status(500).json({
          success: false,
          error: error.message
        });
      }

      // If SSE stream started, send error event and close
      res.write(`data: ${JSON.stringify({
        type: 'error',
        error: error.message,
        timestamp: new Date().toISOString()
      })}\n\n`);
      res.end();
    }
  });

  /**
   * POST /api/deep-assistant/execute-sync
   * Execute agent synchronously (no streaming)
   *
   * Same request body as /execute
   *
   * Response:
   * {
   *   success: true,
   *   sessionId: string,
   *   events: array,
   *   output: string
   * }
   */
  router.post('/execute-sync', async (req, res) => {
    try {
      const {
        message,
        workspaceId,
        workingDirectory,
        model,
        systemMessage,
        appendSystemMessage
      } = req.body;

      if (!message) {
        return res.status(400).json({
          success: false,
          error: 'message is required'
        });
      }

      // Create agent instance
      const { agent, sessionId } = agentManager.createAgent({
        workspaceId,
        workingDirectory,
        model,
        systemMessage,
        appendSystemMessage
      });

      // Execute agent
      const result = await agent.execute(message, {
        model,
        systemMessage,
        appendSystemMessage
      });

      // Clean up agent after execution
      agentManager.stopAgent(sessionId);

      res.json({
        success: true,
        sessionId: result.sessionId,
        events: result.events,
        output: result.output
      });

      logger.info({
        sessionId,
        eventCount: result.events.length
      }, 'Agent sync execution completed');

    } catch (error) {
      logger.error({ error: error.message }, 'Failed to execute agent sync');
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * GET /api/deep-assistant/sessions/:sessionId/status
   * Get agent session status
   */
  router.get('/sessions/:sessionId/status', (req, res) => {
    try {
      const { sessionId } = req.params;
      const agent = agentManager.getAgent(sessionId);

      if (!agent) {
        return res.status(404).json({
          success: false,
          error: 'Agent session not found'
        });
      }

      res.json({
        success: true,
        status: agent.getStatus()
      });

    } catch (error) {
      logger.error({ error: error.message }, 'Failed to get agent status');
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * POST /api/deep-assistant/sessions/:sessionId/stop
   * Stop agent execution
   */
  router.post('/sessions/:sessionId/stop', (req, res) => {
    try {
      const { sessionId } = req.params;
      const stopped = agentManager.stopAgent(sessionId);

      if (!stopped) {
        return res.status(404).json({
          success: false,
          error: 'Agent session not found'
        });
      }

      res.json({
        success: true,
        message: 'Agent stopped successfully'
      });

      logger.info({ sessionId }, 'Agent stopped via API');

    } catch (error) {
      logger.error({ error: error.message }, 'Failed to stop agent');
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * GET /api/deep-assistant/sessions
   * Get all active agent sessions
   */
  router.get('/sessions', (req, res) => {
    try {
      const statuses = agentManager.getAllStatuses();

      res.json({
        success: true,
        sessions: statuses
      });

    } catch (error) {
      logger.error({ error: error.message }, 'Failed to get sessions');
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * GET /api/deep-assistant/workspace/:workspaceId/sessions
   * Get all agent sessions for a workspace
   */
  router.get('/workspace/:workspaceId/sessions', (req, res) => {
    try {
      const { workspaceId } = req.params;
      const agents = agentManager.getWorkspaceAgents(workspaceId);

      const sessions = agents.map(({ sessionId, agent }) => ({
        sessionId,
        ...agent.getStatus()
      }));

      res.json({
        success: true,
        sessions
      });

    } catch (error) {
      logger.error({ error: error.message }, 'Failed to get workspace sessions');
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * GET /api/deep-assistant/health
   * Health check endpoint
   */
  router.get('/health', (req, res) => {
    res.json({
      success: true,
      status: 'ok',
      activeSessions: agentManager.agents.size,
      workspaces: agentManager.workspaceAgents.size
    });
  });

  return router;
}

export default createDeepAssistantRoutes;
