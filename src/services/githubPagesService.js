/**
 * GitHub Pages Service
 * Handles interactions with GitHub API for branches, PRs, and deployments
 */

import axios from 'axios';
import { getOrchestratorUrl } from '@/utils/apiConfig'

const API_BASE_URL = getOrchestratorUrl();

/**
 * GitHub Pages Service
 */
class GitHubPagesService {
  constructor() {
    this.apiClient = axios.create({
      baseURL: `${API_BASE_URL}/api/github-pages`,
      timeout: 30000
    });
  }

  /**
   * Set GitHub token for authentication
   */
  setGitHubToken(token) {
    this.apiClient.defaults.headers['x-github-token'] = token;
  }

  /**
   * Get list of repositories for authenticated user
   */
  async getRepositories() {
    try {
      const response = await this.apiClient.get('/repos');
      return response.data;
    } catch (error) {
      console.error('Error fetching repositories:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Get branches for a repository
   * @param {string} repository - Repository in format "owner/repo"
   */
  async getBranches(repository) {
    try {
      const response = await this.apiClient.get('/branches', {
        params: { repository }
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching branches:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Get pull requests for a repository
   * @param {string} repository - Repository in format "owner/repo"
   * @param {string} state - PR state: 'open', 'closed', 'all'
   */
  async getPullRequests(repository, state = 'open') {
    try {
      const response = await this.apiClient.get('/pull-requests', {
        params: { repository, state }
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching pull requests:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Get detailed information about a specific PR
   * @param {string} repository - Repository in format "owner/repo"
   * @param {number} prNumber - Pull request number
   */
  async getPRDetails(repository, prNumber) {
    try {
      const response = await this.apiClient.get(`/pr-details/${prNumber}`, {
        params: { repository }
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching PR details:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Get preview URL for a branch or PR
   * @param {string} repository - Repository in format "owner/repo"
   * @param {string} type - 'branch' or 'pr'
   * @param {string|number} identifier - Branch name or PR number
   */
  async getPreviewUrl(repository, type, identifier) {
    try {
      const response = await this.apiClient.get('/preview-url', {
        params: { repository, type, identifier }
      });
      return response.data;
    } catch (error) {
      console.error('Error generating preview URL:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Get deployment history for a repository
   * @param {string} repository - Repository in format "owner/repo"
   */
  async getDeployments(repository) {
    try {
      const response = await this.apiClient.get('/deployments', {
        params: { repository }
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching deployments:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Get commit details
   * @param {string} repository - Repository in format "owner/repo"
   * @param {string} sha - Commit SHA
   */
  async getCommit(repository, sha) {
    try {
      const response = await this.apiClient.get(`/commit/${sha}`, {
        params: { repository }
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching commit:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Handle API errors
   */
  handleError(error) {
    if (error.response) {
      // Server responded with error status
      return new Error(error.response.data.error || error.response.statusText);
    } else if (error.request) {
      // Request made but no response
      return new Error('No response from server. Please check your connection.');
    } else {
      // Error in request setup
      return new Error(error.message || 'An unknown error occurred');
    }
  }
}

// Export singleton instance
export default new GitHubPagesService();
