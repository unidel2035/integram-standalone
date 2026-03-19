/**
 * Git Authorization API Routes
 * Issue #4052 Task 5: Add general Git authorization to the "git" column in the /my database
 *
 * Provides API endpoints for managing Git/GitHub credentials in Integram database.
 */

import express from 'express';
import logger from '../../utils/logger.js';
import gitAuthService from '../../services/GitAuthService.js';

/**
 * Create Git Auth routes
 */
export function createGitAuthRoutes() {
  const router = express.Router();

  /**
   * POST /api/git-auth/save-token
   * Save Git token for user
   */
  router.post('/save-token', async (req, res) => {
    try {
      const { userId, provider, token, metadata } = req.body;

      if (!userId || !provider || !token) {
        return res.status(400).json({
          success: false,
          error: 'userId, provider, and token are required'
        });
      }

      const result = await gitAuthService.saveGitToken(userId, provider, token, metadata);

      res.json(result);
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to save Git token');
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * POST /api/git-auth/get-token
   * Get Git token for user
   */
  router.post('/get-token', async (req, res) => {
    try {
      const { userId, provider } = req.body;

      if (!userId || !provider) {
        return res.status(400).json({
          success: false,
          error: 'userId and provider are required'
        });
      }

      const token = await gitAuthService.getGitToken(userId, provider);

      if (!token) {
        return res.status(404).json({
          success: false,
          error: 'Token not found'
        });
      }

      res.json({
        success: true,
        token
      });
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to get Git token');
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * GET /api/git-auth/providers/:userId
   * Get all Git providers for user
   */
  router.get('/providers/:userId', async (req, res) => {
    try {
      const { userId } = req.params;

      const providers = await gitAuthService.getGitProviders(userId);

      res.json({
        success: true,
        providers
      });
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to get Git providers');
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * DELETE /api/git-auth/delete-token
   * Delete Git token for user
   */
  router.delete('/delete-token', async (req, res) => {
    try {
      const { userId, provider } = req.body;

      if (!userId || !provider) {
        return res.status(400).json({
          success: false,
          error: 'userId and provider are required'
        });
      }

      const result = await gitAuthService.deleteGitToken(userId, provider);

      res.json(result);
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to delete Git token');
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * POST /api/git-auth/verify-github-token
   * Verify GitHub token is valid
   */
  router.post('/verify-github-token', async (req, res) => {
    try {
      const { token } = req.body;

      if (!token) {
        return res.status(400).json({
          success: false,
          error: 'token is required'
        });
      }

      const result = await gitAuthService.verifyGitHubToken(token);

      res.json(result);
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to verify GitHub token');
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  return router;
}

export default createGitAuthRoutes;
