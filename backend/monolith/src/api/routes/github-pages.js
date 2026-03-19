/**
 * GitHub Pages API Routes
 * Provides access to repository branches, PRs, and preview deployments
 */

import express from 'express';
import { Octokit } from '@octokit/rest';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

/**
 * Get Octokit instance with auth token
 */
function getOctokit(req) {
  const token = req.headers['x-github-token'] || process.env.GITHUB_TOKEN;
  return new Octokit({
    auth: token
  });
}

/**
 * Parse repository owner and name from full name or URL
 */
function parseRepo(repoInput) {
  // Handle full GitHub URL
  if (repoInput.includes('github.com')) {
    const match = repoInput.match(/github\.com\/([^\/]+)\/([^\/]+)/);
    if (match) {
      return { owner: match[1], repo: match[2].replace(/\.git$/, '') };
    }
  }

  // Handle owner/repo format
  const parts = repoInput.split('/');
  if (parts.length === 2) {
    return { owner: parts[0], repo: parts[1] };
  }

  throw new Error('Invalid repository format. Use "owner/repo" or GitHub URL');
}

/**
 * GET /api/github-pages/repos
 * Get list of repositories for authenticated user
 */
router.get('/repos', async (req, res) => {
  try {
    const octokit = getOctokit(req);
    const { data } = await octokit.repos.listForAuthenticatedUser({
      sort: 'updated',
      per_page: 100
    });

    res.json({
      success: true,
      data: data.map(repo => ({
        id: repo.id,
        name: repo.name,
        fullName: repo.full_name,
        owner: repo.owner.login,
        description: repo.description,
        private: repo.private,
        htmlUrl: repo.html_url,
        defaultBranch: repo.default_branch,
        updatedAt: repo.updated_at
      }))
    });
  } catch (error) {
    console.error('Error fetching repositories:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/github-pages/branches
 * Get list of branches for a repository
 */
router.get('/branches', async (req, res) => {
  try {
    const { repository } = req.query;

    if (!repository) {
      return res.status(400).json({
        success: false,
        error: 'Repository parameter is required'
      });
    }

    const { owner, repo } = parseRepo(repository);
    const octokit = getOctokit(req);

    const { data } = await octokit.repos.listBranches({
      owner,
      repo,
      per_page: 100
    });

    res.json({
      success: true,
      data: data.map(branch => ({
        name: branch.name,
        commit: {
          sha: branch.commit.sha,
          url: branch.commit.url
        },
        protected: branch.protected
      }))
    });
  } catch (error) {
    console.error('Error fetching branches:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/github-pages/pull-requests
 * Get list of pull requests for a repository
 */
router.get('/pull-requests', async (req, res) => {
  try {
    const { repository, state = 'open' } = req.query;

    if (!repository) {
      return res.status(400).json({
        success: false,
        error: 'Repository parameter is required'
      });
    }

    const { owner, repo } = parseRepo(repository);
    const octokit = getOctokit(req);

    const { data } = await octokit.pulls.list({
      owner,
      repo,
      state,
      sort: 'updated',
      direction: 'desc',
      per_page: 100
    });

    res.json({
      success: true,
      data: data.map(pr => ({
        number: pr.number,
        title: pr.title,
        state: pr.state,
        user: {
          login: pr.user.login,
          avatarUrl: pr.user.avatar_url
        },
        head: {
          ref: pr.head.ref,
          sha: pr.head.sha
        },
        base: {
          ref: pr.base.ref,
          sha: pr.base.sha
        },
        htmlUrl: pr.html_url,
        createdAt: pr.created_at,
        updatedAt: pr.updated_at,
        draft: pr.draft,
        mergeable: pr.mergeable,
        mergedAt: pr.merged_at
      }))
    });
  } catch (error) {
    console.error('Error fetching pull requests:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/github-pages/pr-details/:number
 * Get detailed information about a specific PR
 */
router.get('/pr-details/:number', async (req, res) => {
  try {
    const { repository } = req.query;
    const { number } = req.params;

    if (!repository) {
      return res.status(400).json({
        success: false,
        error: 'Repository parameter is required'
      });
    }

    const { owner, repo } = parseRepo(repository);
    const octokit = getOctokit(req);

    const { data: pr } = await octokit.pulls.get({
      owner,
      repo,
      pull_number: parseInt(number)
    });

    // Get PR files
    const { data: files } = await octokit.pulls.listFiles({
      owner,
      repo,
      pull_number: parseInt(number)
    });

    // Get PR checks
    let checks = [];
    try {
      const { data: checkRuns } = await octokit.checks.listForRef({
        owner,
        repo,
        ref: pr.head.sha
      });
      checks = checkRuns.check_runs;
    } catch (err) {
      console.warn('Could not fetch checks:', err.message);
    }

    res.json({
      success: true,
      data: {
        ...pr,
        files: files.map(file => ({
          filename: file.filename,
          status: file.status,
          additions: file.additions,
          deletions: file.deletions,
          changes: file.changes,
          patch: file.patch
        })),
        checks: checks.map(check => ({
          id: check.id,
          name: check.name,
          status: check.status,
          conclusion: check.conclusion,
          startedAt: check.started_at,
          completedAt: check.completed_at,
          detailsUrl: check.details_url
        }))
      }
    });
  } catch (error) {
    console.error('Error fetching PR details:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/github-pages/preview-url
 * Generate preview URL for a branch or PR
 */
router.get('/preview-url', async (req, res) => {
  try {
    const { repository, type, identifier } = req.query;

    if (!repository || !type || !identifier) {
      return res.status(400).json({
        success: false,
        error: 'repository, type, and identifier parameters are required'
      });
    }

    const { owner, repo } = parseRepo(repository);

    let previewUrl = null;

    if (type === 'pr') {
      // GitHub Pages PR preview URL format
      previewUrl = `https://${owner}.github.io/${repo}/pr-preview/pr-${identifier}/`;
    } else if (type === 'branch') {
      // For branches, check if there's a deployment
      // This is a simplified version - real implementation might query GitHub Pages API
      if (identifier === 'gh-pages' || identifier === 'main' || identifier === 'master') {
        previewUrl = `https://${owner}.github.io/${repo}/`;
      }
    }

    res.json({
      success: true,
      data: {
        previewUrl,
        type,
        identifier,
        available: !!previewUrl
      }
    });
  } catch (error) {
    console.error('Error generating preview URL:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/github-pages/deployments
 * Get deployment history for a repository
 */
router.get('/deployments', async (req, res) => {
  try {
    const { repository } = req.query;

    if (!repository) {
      return res.status(400).json({
        success: false,
        error: 'Repository parameter is required'
      });
    }

    const { owner, repo } = parseRepo(repository);
    const octokit = getOctokit(req);

    const { data } = await octokit.repos.listDeployments({
      owner,
      repo,
      per_page: 50
    });

    res.json({
      success: true,
      data: data.map(deployment => ({
        id: deployment.id,
        ref: deployment.ref,
        sha: deployment.sha,
        task: deployment.task,
        environment: deployment.environment,
        description: deployment.description,
        createdAt: deployment.created_at,
        updatedAt: deployment.updated_at,
        creator: {
          login: deployment.creator.login,
          avatarUrl: deployment.creator.avatar_url
        }
      }))
    });
  } catch (error) {
    console.error('Error fetching deployments:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/github-pages/commit/:sha
 * Get commit details
 */
router.get('/commit/:sha', async (req, res) => {
  try {
    const { repository } = req.query;
    const { sha } = req.params;

    if (!repository) {
      return res.status(400).json({
        success: false,
        error: 'Repository parameter is required'
      });
    }

    const { owner, repo } = parseRepo(repository);
    const octokit = getOctokit(req);

    const { data } = await octokit.repos.getCommit({
      owner,
      repo,
      ref: sha
    });

    res.json({
      success: true,
      data: {
        sha: data.sha,
        message: data.commit.message,
        author: {
          name: data.commit.author.name,
          email: data.commit.author.email,
          date: data.commit.author.date
        },
        committer: {
          name: data.commit.committer.name,
          email: data.commit.committer.email,
          date: data.commit.committer.date
        },
        stats: data.stats,
        files: data.files?.map(file => ({
          filename: file.filename,
          status: file.status,
          additions: file.additions,
          deletions: file.deletions,
          changes: file.changes
        }))
      }
    });
  } catch (error) {
    console.error('Error fetching commit:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/github-pages/solve
 * Trigger /solve command for a GitHub issue
 * Issue #2072 - Add PR button to GitHub Agent
 */
router.post('/solve', async (req, res) => {
  try {
    const { issueUrl } = req.body;

    if (!issueUrl) {
      return res.status(400).json({
        success: false,
        error: 'issueUrl parameter is required'
      });
    }

    // Validate issue URL format
    if (!issueUrl.match(/^https:\/\/github\.com\/[^\/]+\/[^\/]+\/issues\/\d+$/)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid issue URL format. Expected: https://github.com/owner/repo/issues/123'
      });
    }

    // Extract issue number for logging
    const issueNumber = issueUrl.match(/issues\/(\d+)$/)?.[1];

    console.log(`[Solve] Triggering solve command for issue #${issueNumber}: ${issueUrl}`);

    // Path to the auto-solve wrapper script
    const scriptPath = path.resolve(__dirname, '../../../scripts/auto-solve-wrapper.sh');

    // Check if script exists
    if (!fs.existsSync(scriptPath)) {
      console.error(`[Solve] Wrapper script not found at: ${scriptPath}`);
      return res.status(500).json({
        success: false,
        error: 'Solve wrapper script not found. Please ensure the script exists at backend/monolith/scripts/auto-solve-wrapper.sh'
      });
    }

    // Spawn the solve process in the background
    const solveProcess = spawn('bash', [scriptPath, issueUrl], {
      detached: true,
      stdio: 'ignore',
      env: {
        ...process.env,
        GITHUB_TOKEN: process.env.GITHUB_TOKEN,
        GITHUB_OWNER: 'unidel2035',
        GITHUB_REPO: 'dronedoc2025'
      }
    });

    // Detach the process so it continues running after response is sent
    solveProcess.unref();

    console.log(`[Solve] Solve command triggered successfully for issue #${issueNumber}, PID: ${solveProcess.pid}`);

    // Respond immediately with success
    res.json({
      success: true,
      message: `Solve command triggered for issue #${issueNumber}`,
      issueUrl,
      issueNumber: parseInt(issueNumber),
      note: 'The solve process is running in the background. You will receive notifications when it completes.'
    });

  } catch (error) {
    console.error('[Solve] Error triggering solve command:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
