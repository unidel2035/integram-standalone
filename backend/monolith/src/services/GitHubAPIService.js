/**
 * GitHub API Service
 * Issue #4052: Support for working with repositories without cloning
 *
 * This service provides GitHub API operations for:
 * - Reading files directly from GitHub
 * - Listing repository contents
 * - Getting branches, commits, issues, pull requests
 * - Creating/updating files via GitHub API (without local clone)
 *
 * Benefits:
 * - No disk space usage for cloning
 * - Faster for read-only operations
 * - Works with large repositories
 * - Direct integration with GitHub features
 */

import logger from '../utils/logger.js';

const GITHUB_API_BASE = 'https://api.github.com';

/**
 * GitHub API Service
 */
class GitHubAPIService {
  /**
   * Parse repository URL to extract owner and repo name
   * @param {string} repoUrl - GitHub repository URL
   * @returns {object} { owner, repo }
   */
  parseRepoUrl(repoUrl) {
    // Handle formats:
    // https://github.com/owner/repo
    // https://github.com/owner/repo.git
    // github.com/owner/repo
    // owner/repo

    const cleanUrl = repoUrl.replace(/\.git$/, '').replace(/\/$/, '');
    const match = cleanUrl.match(/(?:https?:\/\/)?(?:www\.)?github\.com\/([^\/]+)\/([^\/]+)/);

    if (match) {
      return { owner: match[1], repo: match[2] };
    }

    // Try simple owner/repo format
    const parts = cleanUrl.split('/');
    if (parts.length >= 2) {
      return { owner: parts[parts.length - 2], repo: parts[parts.length - 1] };
    }

    throw new Error(`Invalid GitHub repository URL: ${repoUrl}`);
  }

  /**
   * Make authenticated GitHub API request
   * @param {string} endpoint - API endpoint (e.g., '/repos/owner/repo/contents/README.md')
   * @param {string} token - GitHub personal access token
   * @param {object} options - Fetch options
   * @returns {Promise<object>} API response data
   */
  async request(endpoint, token, options = {}) {
    const url = endpoint.startsWith('http') ? endpoint : `${GITHUB_API_BASE}${endpoint}`;

    const headers = {
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...options.headers
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: response.statusText }));
        throw new Error(`GitHub API error: ${response.status} - ${error.message}`);
      }

      return await response.json();
    } catch (error) {
      logger.error({ error: error.message, endpoint }, 'GitHub API request failed');
      throw error;
    }
  }

  /**
   * Get repository branches
   * @param {string} repoUrl - Repository URL
   * @param {string} token - GitHub token
   * @returns {Promise<array>} Array of branch objects
   */
  async getBranches(repoUrl, token) {
    const { owner, repo } = this.parseRepoUrl(repoUrl);
    const endpoint = `/repos/${owner}/${repo}/branches`;

    try {
      const branches = await this.request(endpoint, token);
      return branches.map(branch => ({
        name: branch.name,
        commit: {
          sha: branch.commit.sha,
          url: branch.commit.url
        },
        protected: branch.protected
      }));
    } catch (error) {
      logger.error({ error: error.message, repoUrl }, 'Failed to get branches');
      throw error;
    }
  }

  /**
   * Get repository commits
   * @param {string} repoUrl - Repository URL
   * @param {string} token - GitHub token
   * @param {object} options - Query options
   * @param {string} options.branch - Branch name (optional)
   * @param {number} options.limit - Number of commits to return (default: 30)
   * @returns {Promise<array>} Array of commit objects
   */
  async getCommits(repoUrl, token, options = {}) {
    const { owner, repo } = this.parseRepoUrl(repoUrl);
    const { branch = null, limit = 30 } = options;

    let endpoint = `/repos/${owner}/${repo}/commits?per_page=${limit}`;
    if (branch) {
      endpoint += `&sha=${branch}`;
    }

    try {
      const commits = await this.request(endpoint, token);
      return commits.map(commit => ({
        sha: commit.sha,
        message: commit.commit.message,
        author: {
          name: commit.commit.author.name,
          email: commit.commit.author.email,
          date: commit.commit.author.date
        },
        url: commit.html_url
      }));
    } catch (error) {
      logger.error({ error: error.message, repoUrl }, 'Failed to get commits');
      throw error;
    }
  }

  /**
   * Get file content from repository
   * @param {string} repoUrl - Repository URL
   * @param {string} filepath - File path in repository
   * @param {string} token - GitHub token
   * @param {string} branch - Branch name (default: default branch)
   * @returns {Promise<object>} File content and metadata
   */
  async getFileContent(repoUrl, filepath, token, branch = null) {
    const { owner, repo } = this.parseRepoUrl(repoUrl);
    let endpoint = `/repos/${owner}/${repo}/contents/${filepath}`;

    if (branch) {
      endpoint += `?ref=${branch}`;
    }

    try {
      const data = await this.request(endpoint, token);

      // Decode base64 content
      const content = data.encoding === 'base64'
        ? Buffer.from(data.content, 'base64').toString('utf-8')
        : data.content;

      return {
        path: data.path,
        name: data.name,
        size: data.size,
        content,
        sha: data.sha,
        url: data.html_url
      };
    } catch (error) {
      logger.error({ error: error.message, repoUrl, filepath }, 'Failed to get file content');
      throw error;
    }
  }

  /**
   * Get directory contents
   * @param {string} repoUrl - Repository URL
   * @param {string} path - Directory path (default: root)
   * @param {string} token - GitHub token
   * @param {string} branch - Branch name (optional)
   * @returns {Promise<array>} Array of file/directory objects
   */
  async getDirectoryContents(repoUrl, path = '', token, branch = null) {
    const { owner, repo } = this.parseRepoUrl(repoUrl);
    let endpoint = `/repos/${owner}/${repo}/contents/${path}`;

    if (branch) {
      endpoint += `?ref=${branch}`;
    }

    try {
      const contents = await this.request(endpoint, token);

      return contents.map(item => ({
        name: item.name,
        path: item.path,
        type: item.type, // 'file' or 'dir'
        size: item.size,
        sha: item.sha,
        url: item.html_url
      }));
    } catch (error) {
      logger.error({ error: error.message, repoUrl, path }, 'Failed to get directory contents');
      throw error;
    }
  }

  /**
   * Create or update file in repository
   * @param {string} repoUrl - Repository URL
   * @param {string} filepath - File path
   * @param {string} content - File content
   * @param {string} message - Commit message
   * @param {string} token - GitHub token
   * @param {object} options - Options
   * @param {string} options.branch - Branch name (optional)
   * @param {string} options.sha - File SHA (required for update)
   * @returns {Promise<object>} Commit result
   */
  async createOrUpdateFile(repoUrl, filepath, content, message, token, options = {}) {
    const { owner, repo } = this.parseRepoUrl(repoUrl);
    const { branch = 'main', sha = null } = options;

    const endpoint = `/repos/${owner}/${repo}/contents/${filepath}`;

    const body = {
      message,
      content: Buffer.from(content).toString('base64'),
      branch
    };

    if (sha) {
      body.sha = sha; // Required for updates
    }

    try {
      const result = await this.request(endpoint, token, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });

      return {
        success: true,
        commit: {
          sha: result.commit.sha,
          message: result.commit.message
        },
        content: {
          path: result.content.path,
          sha: result.content.sha
        }
      };
    } catch (error) {
      logger.error({ error: error.message, repoUrl, filepath }, 'Failed to create/update file');
      throw error;
    }
  }

  /**
   * Delete file from repository
   * @param {string} repoUrl - Repository URL
   * @param {string} filepath - File path
   * @param {string} message - Commit message
   * @param {string} sha - File SHA (required)
   * @param {string} token - GitHub token
   * @param {string} branch - Branch name (optional)
   * @returns {Promise<object>} Delete result
   */
  async deleteFile(repoUrl, filepath, message, sha, token, branch = 'main') {
    const { owner, repo } = this.parseRepoUrl(repoUrl);
    const endpoint = `/repos/${owner}/${repo}/contents/${filepath}`;

    const body = {
      message,
      sha,
      branch
    };

    try {
      await this.request(endpoint, token, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });

      return {
        success: true,
        message: `File ${filepath} deleted`
      };
    } catch (error) {
      logger.error({ error: error.message, repoUrl, filepath }, 'Failed to delete file');
      throw error;
    }
  }

  /**
   * Get repository issues
   * @param {string} repoUrl - Repository URL
   * @param {string} token - GitHub token
   * @param {object} options - Query options
   * @param {string} options.state - Issue state: 'open', 'closed', 'all' (default: 'open')
   * @param {number} options.limit - Number of issues (default: 30)
   * @returns {Promise<array>} Array of issue objects
   */
  async getIssues(repoUrl, token, options = {}) {
    const { owner, repo } = this.parseRepoUrl(repoUrl);
    const { state = 'open', limit = 30 } = options;

    const endpoint = `/repos/${owner}/${repo}/issues?state=${state}&per_page=${limit}`;

    try {
      const issues = await this.request(endpoint, token);
      return issues.map(issue => ({
        number: issue.number,
        title: issue.title,
        body: issue.body,
        state: issue.state,
        labels: issue.labels.map(l => l.name),
        author: issue.user.login,
        createdAt: issue.created_at,
        updatedAt: issue.updated_at,
        url: issue.html_url
      }));
    } catch (error) {
      logger.error({ error: error.message, repoUrl }, 'Failed to get issues');
      throw error;
    }
  }

  /**
   * Get repository pull requests
   * @param {string} repoUrl - Repository URL
   * @param {string} token - GitHub token
   * @param {object} options - Query options
   * @param {string} options.state - PR state: 'open', 'closed', 'all' (default: 'open')
   * @param {number} options.limit - Number of PRs (default: 30)
   * @returns {Promise<array>} Array of pull request objects
   */
  async getPullRequests(repoUrl, token, options = {}) {
    const { owner, repo } = this.parseRepoUrl(repoUrl);
    const { state = 'open', limit = 30 } = options;

    const endpoint = `/repos/${owner}/${repo}/pulls?state=${state}&per_page=${limit}`;

    try {
      const prs = await this.request(endpoint, token);
      return prs.map(pr => ({
        number: pr.number,
        title: pr.title,
        body: pr.body,
        state: pr.state,
        author: pr.user.login,
        baseBranch: pr.base.ref,
        headBranch: pr.head.ref,
        createdAt: pr.created_at,
        updatedAt: pr.updated_at,
        url: pr.html_url
      }));
    } catch (error) {
      logger.error({ error: error.message, repoUrl }, 'Failed to get pull requests');
      throw error;
    }
  }

  /**
   * Get authenticated user info
   * @param {string} token - GitHub token
   * @returns {Promise<object>} User info
   */
  async getAuthenticatedUser(token) {
    try {
      const user = await this.request('/user', token);
      return {
        login: user.login,
        name: user.name,
        email: user.email,
        avatarUrl: user.avatar_url,
        bio: user.bio,
        company: user.company,
        location: user.location
      };
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to get authenticated user');
      throw error;
    }
  }

  /**
   * Search repositories
   * @param {string} query - Search query
   * @param {string} token - GitHub token (optional)
   * @param {number} limit - Number of results (default: 30)
   * @returns {Promise<array>} Array of repository objects
   */
  async searchRepositories(query, token = null, limit = 30) {
    const endpoint = `/search/repositories?q=${encodeURIComponent(query)}&per_page=${limit}`;

    try {
      const result = await this.request(endpoint, token);
      return result.items.map(repo => ({
        name: repo.name,
        fullName: repo.full_name,
        owner: repo.owner.login,
        description: repo.description,
        url: repo.html_url,
        stars: repo.stargazers_count,
        forks: repo.forks_count,
        language: repo.language,
        updatedAt: repo.updated_at
      }));
    } catch (error) {
      logger.error({ error: error.message, query }, 'Failed to search repositories');
      throw error;
    }
  }
}

// Export singleton instance
const gitHubAPIService = new GitHubAPIService();
export default gitHubAPIService;
