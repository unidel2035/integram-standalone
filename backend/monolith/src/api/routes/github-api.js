/**
 * GitHub API Routes
 * Issue #4052: Support for working with repositories without cloning
 *
 * Provides REST API endpoints for GitHub operations without local cloning.
 */

import express from 'express';
import logger from '../../utils/logger.js';
import gitHubAPIService from '../../services/GitHubAPIService.js';

/**
 * Create GitHub API routes
 */
export function createGitHubAPIRoutes() {
  const router = express.Router();

  /**
   * POST /api/github/parse-repo-url
   * Parse repository URL to extract owner and repo name
   */
  router.post('/parse-repo-url', (req, res) => {
    try {
      const { repoUrl } = req.body;

      if (!repoUrl) {
        return res.status(400).json({
          success: false,
          error: 'repoUrl is required'
        });
      }

      const { owner, repo } = gitHubAPIService.parseRepoUrl(repoUrl);

      res.json({
        success: true,
        owner,
        repo,
        fullName: `${owner}/${repo}`
      });
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to parse repository URL');
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * POST /api/github/branches
   * Get repository branches
   */
  router.post('/branches', async (req, res) => {
    try {
      const { repoUrl, token } = req.body;

      if (!repoUrl) {
        return res.status(400).json({
          success: false,
          error: 'repoUrl is required'
        });
      }

      const branches = await gitHubAPIService.getBranches(repoUrl, token);

      res.json({
        success: true,
        branches
      });
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to get branches');
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * POST /api/github/commits
   * Get repository commits
   */
  router.post('/commits', async (req, res) => {
    try {
      const { repoUrl, token, branch, limit } = req.body;

      if (!repoUrl) {
        return res.status(400).json({
          success: false,
          error: 'repoUrl is required'
        });
      }

      const commits = await gitHubAPIService.getCommits(repoUrl, token, { branch, limit });

      res.json({
        success: true,
        commits
      });
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to get commits');
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * POST /api/github/file-content
   * Get file content from repository
   */
  router.post('/file-content', async (req, res) => {
    try {
      const { repoUrl, filepath, token, branch } = req.body;

      if (!repoUrl || !filepath) {
        return res.status(400).json({
          success: false,
          error: 'repoUrl and filepath are required'
        });
      }

      const fileData = await gitHubAPIService.getFileContent(repoUrl, filepath, token, branch);

      res.json({
        success: true,
        file: fileData
      });
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to get file content');
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * POST /api/github/directory-contents
   * Get directory contents
   */
  router.post('/directory-contents', async (req, res) => {
    try {
      const { repoUrl, path, token, branch } = req.body;

      if (!repoUrl) {
        return res.status(400).json({
          success: false,
          error: 'repoUrl is required'
        });
      }

      const contents = await gitHubAPIService.getDirectoryContents(repoUrl, path || '', token, branch);

      res.json({
        success: true,
        contents
      });
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to get directory contents');
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * POST /api/github/create-or-update-file
   * Create or update file in repository
   */
  router.post('/create-or-update-file', async (req, res) => {
    try {
      const { repoUrl, filepath, content, message, token, branch, sha } = req.body;

      if (!repoUrl || !filepath || !content || !message || !token) {
        return res.status(400).json({
          success: false,
          error: 'repoUrl, filepath, content, message, and token are required'
        });
      }

      const result = await gitHubAPIService.createOrUpdateFile(
        repoUrl,
        filepath,
        content,
        message,
        token,
        { branch, sha }
      );

      res.json(result);
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to create/update file');
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * POST /api/github/delete-file
   * Delete file from repository
   */
  router.post('/delete-file', async (req, res) => {
    try {
      const { repoUrl, filepath, message, sha, token, branch } = req.body;

      if (!repoUrl || !filepath || !message || !sha || !token) {
        return res.status(400).json({
          success: false,
          error: 'repoUrl, filepath, message, sha, and token are required'
        });
      }

      const result = await gitHubAPIService.deleteFile(repoUrl, filepath, message, sha, token, branch);

      res.json(result);
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to delete file');
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * POST /api/github/issues
   * Get repository issues
   */
  router.post('/issues', async (req, res) => {
    try {
      const { repoUrl, token, state, limit } = req.body;

      if (!repoUrl) {
        return res.status(400).json({
          success: false,
          error: 'repoUrl is required'
        });
      }

      const issues = await gitHubAPIService.getIssues(repoUrl, token, { state, limit });

      res.json({
        success: true,
        issues
      });
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to get issues');
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * POST /api/github/pull-requests
   * Get repository pull requests
   */
  router.post('/pull-requests', async (req, res) => {
    try {
      const { repoUrl, token, state, limit } = req.body;

      if (!repoUrl) {
        return res.status(400).json({
          success: false,
          error: 'repoUrl is required'
        });
      }

      const prs = await gitHubAPIService.getPullRequests(repoUrl, token, { state, limit });

      res.json({
        success: true,
        pullRequests: prs
      });
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to get pull requests');
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * POST /api/github/user
   * Get authenticated user info
   */
  router.post('/user', async (req, res) => {
    try {
      const { token } = req.body;

      if (!token) {
        return res.status(400).json({
          success: false,
          error: 'token is required'
        });
      }

      const user = await gitHubAPIService.getAuthenticatedUser(token);

      res.json({
        success: true,
        user
      });
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to get user');
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * POST /api/github/search-repositories
   * Search repositories
   */
  router.post('/search-repositories', async (req, res) => {
    try {
      const { query, token, limit } = req.body;

      if (!query) {
        return res.status(400).json({
          success: false,
          error: 'query is required'
        });
      }

      const repositories = await gitHubAPIService.searchRepositories(query, token, limit);

      res.json({
        success: true,
        repositories
      });
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to search repositories');
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  return router;
}

export default createGitHubAPIRoutes;
