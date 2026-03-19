/**
 * Claude Code Proxy Routes
 * Issue #3107: Direct Claude Code integration via Chat.vue
 *
 * This provides HTTP API endpoints for interacting with Claude Code running in headless mode.
 *
 * Architecture:
 * Chat.vue → /api/claude-code/* → ClaudeCodeService → Claude Code (headless)
 */

import express from 'express';
import claudeCodeService from '../../services/ClaudeCodeService.js';
import logger from '../../utils/logger.js';
import { createSession as createIntegramSession } from '../../services/email/integramSessionService.js';

export function createClaudeCodeProxyRoutes() {
  const router = express.Router();

  /**
   * POST /api/claude-code/sessions
   * Create a new Claude Code session
   *
   * Request body:
   * - userId: string (required)
   * - repositoryUrl: string (optional) - Git repository to clone
   * - allowedTools: array (optional) - Tools Claude Code can use
   * - permissionMode: string (optional) - 'acceptEdits' or 'ask'
   */
  router.post('/sessions', async (req, res) => {
    try {
      const { userId, repositoryUrl, allowedTools, permissionMode } = req.body;

      if (!userId) {
        return res.status(400).json({
          success: false,
          error: 'userId is required',
        });
      }

      const session = await claudeCodeService.createSession(userId, {
        repositoryUrl,
        allowedTools,
        permissionMode,
      });

      logger.info({ sessionId: session.id, userId }, 'Created Claude Code session');

      res.json({
        success: true,
        session: {
          id: session.id,
          userId: session.userId,
          createdAt: session.createdAt,
          repositoryUrl: session.repositoryUrl,
          workspacePath: session.workspacePath,
        },
      });
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to create Claude Code session');
      res.status(500).json({
        success: false,
        error: 'Failed to create session',
        message: error.message,
      });
    }
  });

  /**
   * POST /api/claude-code/chat
   * Send a message to Claude Code (streaming response)
   *
   * Request body:
   * - sessionId: string (required)
   * - message: string (required)
   */
  router.post('/chat', async (req, res) => {
    try {
      const { sessionId, message } = req.body;

      if (!sessionId || !message) {
        return res.status(400).json({
          success: false,
          error: 'sessionId and message are required',
        });
      }

      // Set streaming headers
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Transfer-Encoding', 'chunked');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.removeHeader('Content-Length');

      logger.info({ sessionId, messageLength: message.length }, 'Claude Code chat request');

      // Stream response chunks to client
      const result = await claudeCodeService.chat(sessionId, message, (chunk) => {
        res.write(chunk);
      });

      res.end();

      logger.info({ sessionId, toolsUsed: result.toolsUsed }, 'Claude Code chat completed');
    } catch (error) {
      logger.error({ error: error.message }, 'Claude Code chat failed');

      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          error: 'Chat request failed',
          message: error.message,
        });
      } else {
        res.end();
      }
    }
  });

  /**
   * GET /api/claude-code/sessions/:sessionId/git/status
   * Get Git status for session workspace
   */
  router.get('/sessions/:sessionId/git/status', async (req, res) => {
    try {
      const { sessionId } = req.params;

      const status = await claudeCodeService.getGitStatus(sessionId);

      res.json({
        success: true,
        sessionId,
        git: status,
      });
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to get Git status');
      res.status(500).json({
        success: false,
        error: 'Failed to get Git status',
        message: error.message,
      });
    }
  });

  /**
   * POST /api/claude-code/sessions/:sessionId/git/commit
   * Commit changes in session workspace
   *
   * Request body:
   * - commitMessage: string (required)
   */
  router.post('/sessions/:sessionId/git/commit', async (req, res) => {
    try {
      const { sessionId } = req.params;
      const { commitMessage } = req.body;

      if (!commitMessage) {
        return res.status(400).json({
          success: false,
          error: 'commitMessage is required',
        });
      }

      const result = await claudeCodeService.commitChanges(sessionId, commitMessage);

      logger.info({ sessionId, commitMessage }, 'Committed changes');

      res.json({
        success: true,
        sessionId,
        result,
      });
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to commit changes');
      res.status(500).json({
        success: false,
        error: 'Failed to commit changes',
        message: error.message,
      });
    }
  });

  /**
   * POST /api/claude-code/sessions/:sessionId/git/push
   * Push changes to remote repository
   */
  router.post('/sessions/:sessionId/git/push', async (req, res) => {
    try {
      const { sessionId } = req.params;

      const result = await claudeCodeService.pushChanges(sessionId);

      logger.info({ sessionId }, 'Pushed changes');

      res.json({
        success: true,
        sessionId,
        result,
      });
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to push changes');
      res.status(500).json({
        success: false,
        error: 'Failed to push changes',
        message: error.message,
      });
    }
  });

  /**
   * GET /api/claude-code/sessions/:sessionId/files
   * List files in session workspace
   *
   * Query parameters:
   * - directory: string (optional) - Relative directory path
   */
  router.get('/sessions/:sessionId/files', async (req, res) => {
    try {
      const { sessionId } = req.params;
      const { directory = '' } = req.query;

      const files = await claudeCodeService.listFiles(sessionId, directory);

      res.json({
        success: true,
        sessionId,
        directory,
        files,
      });
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to list files');
      res.status(500).json({
        success: false,
        error: 'Failed to list files',
        message: error.message,
      });
    }
  });

  /**
   * GET /api/claude-code/sessions/:sessionId/files/content
   * Read file content from session workspace
   *
   * Query parameters:
   * - filepath: string (required) - Relative file path
   */
  router.get('/sessions/:sessionId/files/content', async (req, res) => {
    try {
      const { sessionId } = req.params;
      const { filepath } = req.query;

      if (!filepath) {
        return res.status(400).json({
          success: false,
          error: 'filepath query parameter is required',
        });
      }

      const content = await claudeCodeService.readFile(sessionId, filepath);

      res.json({
        success: true,
        sessionId,
        filepath,
        content,
      });
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to read file');
      res.status(500).json({
        success: false,
        error: 'Failed to read file',
        message: error.message,
      });
    }
  });

  /**
   * DELETE /api/claude-code/sessions/:sessionId
   * Delete a Claude Code session
   */
  router.delete('/sessions/:sessionId', async (req, res) => {
    try {
      const { sessionId } = req.params;

      await claudeCodeService.deleteSession(sessionId);

      logger.info({ sessionId }, 'Deleted Claude Code session');

      res.json({
        success: true,
        sessionId,
        message: 'Session deleted successfully',
      });
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to delete session');
      res.status(500).json({
        success: false,
        error: 'Failed to delete session',
        message: error.message,
      });
    }
  });

  /**
   * GET /api/claude-code/users/:userId/sessions
   * Get all sessions for a user
   */
  router.get('/users/:userId/sessions', (req, res) => {
    try {
      const { userId } = req.params;

      const sessions = claudeCodeService.getUserSessions(userId);

      res.json({
        success: true,
        userId,
        sessions,
        count: sessions.length,
      });
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to get user sessions');
      res.status(500).json({
        success: false,
        error: 'Failed to get user sessions',
        message: error.message,
      });
    }
  });

  /**
   * GET /api/claude-code/health
   * Health check for Claude Code service
   */
  router.get('/health', async (req, res) => {
    try {
      // Check if Claude Code is available in PATH
      const { exec } = require('child_process');
      exec('claude --version', (error, stdout, stderr) => {
        if (error) {
          return res.json({
            status: 'error',
            service: 'claude-code-proxy',
            claudeCodeAvailable: false,
            error: error.message,
            recommendation: 'Install Claude Code CLI: npm install -g @anthropic-ai/claude-code',
            timestamp: new Date().toISOString(),
          });
        }

        res.json({
          status: 'ok',
          service: 'claude-code-proxy',
          claudeCodeAvailable: true,
          claudeCodeVersion: stdout.trim(),
          apiKeyConfigured: !!process.env.ANTHROPIC_API_KEY,
          timestamp: new Date().toISOString(),
        });
      });
    } catch (error) {
      res.json({
        status: 'error',
        service: 'claude-code-proxy',
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  });

  /**
   * POST /api/claude-code/test/create-session
   * Test endpoint to directly create Integram session
   *
   * Request body:
   * - userId: number (required) - Integram user ID
   */
  router.post('/test/create-session', async (req, res) => {
    try {
      const { userId } = req.body;

      if (!userId) {
        return res.status(400).json({
          success: false,
          error: 'userId is required',
        });
      }

      logger.info({ userId }, 'Testing Integram session creation');

      const result = await createIntegramSession({
        userId,
        database: 'my',
        sessionType: 'test'
      });

      res.json({
        success: result.success,
        sessionId: result.sessionId,
        userId: result.userId,
        database: result.database,
        sessionType: result.sessionType,
        createdAt: result.createdAt,
        error: result.error
      });
    } catch (error) {
      logger.error({ error: error.message }, 'Test session creation failed');
      res.status(500).json({
        success: false,
        error: 'Test session creation failed',
        message: error.message,
      });
    }
  });

  return router;
}
