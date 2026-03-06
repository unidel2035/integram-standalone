/**
 * GitHub Integration Service
 * Issue #4465: Store GitHub token in Integram table 18 (Users)
 *
 * Provides API integration for GitHub issues, pull requests, and repositories
 * Uses GitHub REST API v3: https://docs.github.com/en/rest
 *
 * Token storage:
 * - localStorage ('github_token') for backward compatibility
 * - Integram table 18 (Users) 'github_token' requisite for persistence
 */

import axios from 'axios'
import integramService from '@/services/integramApiClient'
import { logger } from '@/utils/logger'

const GITHUB_API_BASE = 'https://api.github.com'
const STORAGE_KEY = 'github_token'
const USERS_TABLE_ID = 18 // Table 18 = Пользователи (Users)

/**
 * GitHub API Service Class
 */
class GitHubService {
  constructor() {
    this.token = null
    this.axiosInstance = null
    // Load token from Integram/localStorage on initialization (async, non-blocking)
    this.loadToken().catch(err => {
      logger.warn('Failed to load GitHub token on init:', err)
    })
  }

  /**
   * Set GitHub Personal Access Token
   * Issue #4465: Also save to Integram table 18
   * @param {string} token - GitHub PAT
   * @param {boolean} persist - Save to localStorage and Integram (default: true)
   */
  async setToken(token, persist = true) {
    this.token = token
    this.axiosInstance = axios.create({
      baseURL: GITHUB_API_BASE,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'X-GitHub-Api-Version': '2022-11-28'
      }
    })

    // Persist token to localStorage
    if (persist && typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, token)
      } catch (error) {
        console.error('Failed to save GitHub token to localStorage:', error)
      }

      // Also save to Integram Users table
      try {
        await this.saveTokenToIntegram(token)
      } catch (error) {
        logger.warn('Failed to save GitHub token to Integram:', error)
        // Non-blocking - localStorage is the fallback
      }
    }
  }

  /**
   * Load token from localStorage and Integram
   * Issue #4465: Try Integram first, then localStorage
   * @returns {Promise<boolean>} True if token was loaded successfully
   */
  async loadToken() {
    if (typeof window === 'undefined') return false

    // Try loading from Integram first (if authenticated)
    if (integramService.isAuthenticated()) {
      try {
        const integramToken = await this.loadTokenFromIntegram()
        if (integramToken) {
          await this.setToken(integramToken, false) // Don't re-save
          return true
        }
      } catch (error) {
        logger.warn('Failed to load from Integram, trying localStorage:', error)
      }
    }

    // Fall back to localStorage
    try {
      const savedToken = localStorage.getItem(STORAGE_KEY)
      if (savedToken) {
        await this.setToken(savedToken, false) // Don't re-save to localStorage
        return true
      }
    } catch (error) {
      console.error('Failed to load GitHub token from localStorage:', error)
    }
    return false
  }

  /**
   * Get stored token (masked for display)
   * @returns {string|null} Masked token or null
   */
  getToken() {
    return this.token
  }

  /**
   * Get masked token for display (shows only first and last 4 characters)
   * @returns {string|null} Masked token or null
   */
  getMaskedToken() {
    if (!this.token) return null
    if (this.token.length <= 8) return '****'
    return `${this.token.substring(0, 4)}...${this.token.substring(this.token.length - 4)}`
  }

  /**
   * Clear token (logout)
   * Issue #4465: Also clear from Integram
   */
  async clearToken() {
    this.token = null
    this.axiosInstance = null

    // Remove from localStorage
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem(STORAGE_KEY)
      } catch (error) {
        console.error('Failed to remove GitHub token from localStorage:', error)
      }

      // Also remove from Integram
      try {
        await this.clearTokenFromIntegram()
      } catch (error) {
        logger.warn('Failed to clear GitHub token from Integram:', error)
        // Non-blocking
      }
    }
  }

  /**
   * Issue #4465: Clear GitHub token from Integram Users table
   * @returns {Promise<void>}
   */
  async clearTokenFromIntegram() {
    if (!integramService.isAuthenticated()) {
      return
    }

    try {
      const session = await integramService.getSession()
      const userId = session.id || session.userId

      if (!userId) {
        return
      }

      // Get Users table metadata
      const metadata = await integramService.getTypeMetadata(USERS_TABLE_ID)
      const requisites = metadata.requisites || []

      // Find github_token requisite
      const githubTokenReq = requisites.find(r =>
        r.alias === 'github_token' || r.alias === 'GitHub Token'
      )

      if (githubTokenReq) {
        // Clear the token value
        await integramService.setRequisites(userId, {
          [githubTokenReq.id]: ''
        })
        logger.info('GitHub token cleared from Integram successfully')
      }
    } catch (error) {
      logger.error('Failed to clear GitHub token from Integram:', error)
      throw error
    }
  }

  /**
   * Check if token is set
   * @returns {boolean}
   */
  isAuthenticated() {
    return this.token !== null && this.axiosInstance !== null
  }

  /**
   * Verify token and get authenticated user info
   * @returns {Promise<Object>} User object
   */
  async verifyToken() {
    if (!this.isAuthenticated()) {
      throw new Error('GitHub token not set')
    }

    try {
      const response = await this.axiosInstance.get('/user')
      return {
        success: true,
        user: response.data
      }
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.message || error.message
      }
    }
  }

  /**
   * List user repositories
   * @param {Object} options - Query options
   * @returns {Promise<Array>} List of repositories
   */
  async listRepositories(options = {}) {
    if (!this.isAuthenticated()) {
      throw new Error('GitHub token not set')
    }

    const params = {
      sort: options.sort || 'updated',
      direction: options.direction || 'desc',
      per_page: options.perPage || 30,
      page: options.page || 1,
      type: options.type || 'all' // all, owner, public, private, member
    }

    try {
      const response = await this.axiosInstance.get('/user/repos', { params })
      return response.data
    } catch (error) {
      throw new Error(error.response?.data?.message || error.message)
    }
  }

  /**
   * Get repository details
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @returns {Promise<Object>} Repository object
   */
  async getRepository(owner, repo) {
    if (!this.isAuthenticated()) {
      throw new Error('GitHub token not set')
    }

    try {
      const response = await this.axiosInstance.get(`/repos/${owner}/${repo}`)
      return response.data
    } catch (error) {
      throw new Error(error.response?.data?.message || error.message)
    }
  }

  /**
   * List issues for a repository
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @param {Object} options - Query options
   * @returns {Promise<Array>} List of issues
   */
  async listIssues(owner, repo, options = {}) {
    if (!this.isAuthenticated()) {
      throw new Error('GitHub token not set')
    }

    const params = {
      state: options.state || 'open', // open, closed, all
      sort: options.sort || 'created',
      direction: options.direction || 'desc',
      per_page: options.perPage || 30,
      page: options.page || 1,
      labels: options.labels || undefined,
      assignee: options.assignee || undefined
    }

    try {
      const response = await this.axiosInstance.get(`/repos/${owner}/${repo}/issues`, { params })
      // Filter out pull requests (GitHub API returns PRs in issues endpoint)
      return response.data.filter(issue => !issue.pull_request)
    } catch (error) {
      throw new Error(error.response?.data?.message || error.message)
    }
  }

  /**
   * Get single issue
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @param {number} issueNumber - Issue number
   * @returns {Promise<Object>} Issue object
   */
  async getIssue(owner, repo, issueNumber) {
    if (!this.isAuthenticated()) {
      throw new Error('GitHub token not set')
    }

    try {
      const response = await this.axiosInstance.get(`/repos/${owner}/${repo}/issues/${issueNumber}`)
      return response.data
    } catch (error) {
      throw new Error(error.response?.data?.message || error.message)
    }
  }

  /**
   * Create new issue
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @param {Object} issueData - Issue data (title, body, labels, assignees)
   * @returns {Promise<Object>} Created issue object
   */
  async createIssue(owner, repo, issueData) {
    if (!this.isAuthenticated()) {
      throw new Error('GitHub token not set')
    }

    try {
      const response = await this.axiosInstance.post(`/repos/${owner}/${repo}/issues`, issueData)
      return response.data
    } catch (error) {
      throw new Error(error.response?.data?.message || error.message)
    }
  }

  /**
   * Update issue
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @param {number} issueNumber - Issue number
   * @param {Object} updates - Fields to update
   * @returns {Promise<Object>} Updated issue object
   */
  async updateIssue(owner, repo, issueNumber, updates) {
    if (!this.isAuthenticated()) {
      throw new Error('GitHub token not set')
    }

    try {
      const response = await this.axiosInstance.patch(`/repos/${owner}/${repo}/issues/${issueNumber}`, updates)
      return response.data
    } catch (error) {
      throw new Error(error.response?.data?.message || error.message)
    }
  }

  /**
   * Close issue (set state to closed)
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @param {number} issueNumber - Issue number
   * @returns {Promise<Object>} Updated issue object
   */
  async closeIssue(owner, repo, issueNumber) {
    return this.updateIssue(owner, repo, issueNumber, { state: 'closed' })
  }

  /**
   * Reopen issue
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @param {number} issueNumber - Issue number
   * @returns {Promise<Object>} Updated issue object
   */
  async reopenIssue(owner, repo, issueNumber) {
    return this.updateIssue(owner, repo, issueNumber, { state: 'open' })
  }

  /**
   * List pull requests
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @param {Object} options - Query options
   * @returns {Promise<Array>} List of pull requests
   */
  async listPullRequests(owner, repo, options = {}) {
    if (!this.isAuthenticated()) {
      throw new Error('GitHub token not set')
    }

    const params = {
      state: options.state || 'open', // open, closed, all
      sort: options.sort || 'created',
      direction: options.direction || 'desc',
      per_page: options.perPage || 30,
      page: options.page || 1
    }

    try {
      const response = await this.axiosInstance.get(`/repos/${owner}/${repo}/pulls`, { params })
      return response.data
    } catch (error) {
      throw new Error(error.response?.data?.message || error.message)
    }
  }

  /**
   * Get single pull request
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @param {number} prNumber - PR number
   * @returns {Promise<Object>} Pull request object
   */
  async getPullRequest(owner, repo, prNumber) {
    if (!this.isAuthenticated()) {
      throw new Error('GitHub token not set')
    }

    try {
      const response = await this.axiosInstance.get(`/repos/${owner}/${repo}/pulls/${prNumber}`)
      return response.data
    } catch (error) {
      throw new Error(error.response?.data?.message || error.message)
    }
  }

  /**
   * Create pull request
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @param {Object} prData - PR data (title, body, head, base)
   * @returns {Promise<Object>} Created PR object
   */
  async createPullRequest(owner, repo, prData) {
    if (!this.isAuthenticated()) {
      throw new Error('GitHub token not set')
    }

    try {
      const response = await this.axiosInstance.post(`/repos/${owner}/${repo}/pulls`, prData)
      return response.data
    } catch (error) {
      throw new Error(error.response?.data?.message || error.message)
    }
  }

  /**
   * Merge pull request
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @param {number} prNumber - PR number
   * @param {Object} options - Merge options
   * @returns {Promise<Object>} Merge result
   */
  async mergePullRequest(owner, repo, prNumber, options = {}) {
    if (!this.isAuthenticated()) {
      throw new Error('GitHub token not set')
    }

    const mergeData = {
      commit_title: options.commitTitle,
      commit_message: options.commitMessage,
      merge_method: options.mergeMethod || 'merge' // merge, squash, rebase
    }

    try {
      const response = await this.axiosInstance.put(`/repos/${owner}/${repo}/pulls/${prNumber}/merge`, mergeData)
      return response.data
    } catch (error) {
      throw new Error(error.response?.data?.message || error.message)
    }
  }

  /**
   * Close pull request (without merging)
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @param {number} prNumber - PR number
   * @returns {Promise<Object>} Updated PR object
   */
  async closePullRequest(owner, repo, prNumber) {
    if (!this.isAuthenticated()) {
      throw new Error('GitHub token not set')
    }

    try {
      const response = await this.axiosInstance.patch(`/repos/${owner}/${repo}/pulls/${prNumber}`, {
        state: 'closed'
      })
      return response.data
    } catch (error) {
      throw new Error(error.response?.data?.message || error.message)
    }
  }

  /**
   * Check if PR is mergeable
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @param {number} prNumber - PR number
   * @returns {Promise<Object>} Mergeable status
   */
  async checkMergeable(owner, repo, prNumber) {
    const pr = await this.getPullRequest(owner, repo, prNumber)
    return {
      mergeable: pr.mergeable,
      mergeableState: pr.mergeable_state,
      merged: pr.merged
    }
  }

  /**
   * List labels for repository
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @returns {Promise<Array>} List of labels
   */
  async listLabels(owner, repo) {
    if (!this.isAuthenticated()) {
      throw new Error('GitHub token not set')
    }

    try {
      const response = await this.axiosInstance.get(`/repos/${owner}/${repo}/labels`)
      return response.data
    } catch (error) {
      throw new Error(error.response?.data?.message || error.message)
    }
  }

  /**
   * List repository collaborators
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @returns {Promise<Array>} List of collaborators
   */
  async listCollaborators(owner, repo) {
    if (!this.isAuthenticated()) {
      throw new Error('GitHub token not set')
    }

    try {
      const response = await this.axiosInstance.get(`/repos/${owner}/${repo}/collaborators`)
      return response.data
    } catch (error) {
      throw new Error(error.response?.data?.message || error.message)
    }
  }

  /**
   * List comments for an issue
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @param {number} issueNumber - Issue number
   * @returns {Promise<Array>} List of comments
   */
  async listIssueComments(owner, repo, issueNumber) {
    if (!this.isAuthenticated()) {
      throw new Error('GitHub token not set')
    }

    try {
      const response = await this.axiosInstance.get(`/repos/${owner}/${repo}/issues/${issueNumber}/comments`)
      return response.data
    } catch (error) {
      throw new Error(error.response?.data?.message || error.message)
    }
  }

  /**
   * List comments for a pull request
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @param {number} prNumber - PR number
   * @returns {Promise<Array>} List of comments
   */
  async listPullRequestComments(owner, repo, prNumber) {
    if (!this.isAuthenticated()) {
      throw new Error('GitHub token not set')
    }

    try {
      const response = await this.axiosInstance.get(`/repos/${owner}/${repo}/issues/${prNumber}/comments`)
      return response.data
    } catch (error) {
      throw new Error(error.response?.data?.message || error.message)
    }
  }

  /**
   * List review comments for a pull request
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @param {number} prNumber - PR number
   * @returns {Promise<Array>} List of review comments
   */
  async listPullRequestReviewComments(owner, repo, prNumber) {
    if (!this.isAuthenticated()) {
      throw new Error('GitHub token not set')
    }

    try {
      const response = await this.axiosInstance.get(`/repos/${owner}/${repo}/pulls/${prNumber}/comments`)
      return response.data
    } catch (error) {
      throw new Error(error.response?.data?.message || error.message)
    }
  }

  /**
   * Create a comment on an issue
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @param {number} issueNumber - Issue number
   * @param {string} body - Comment body
   * @returns {Promise<Object>} Created comment object
   */
  async createIssueComment(owner, repo, issueNumber, body) {
    if (!this.isAuthenticated()) {
      throw new Error('GitHub token not set')
    }

    try {
      const response = await this.axiosInstance.post(`/repos/${owner}/${repo}/issues/${issueNumber}/comments`, { body })
      return response.data
    } catch (error) {
      throw new Error(error.response?.data?.message || error.message)
    }
  }

  /**
   * Update a comment
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @param {number} commentId - Comment ID
   * @param {string} body - New comment body
   * @returns {Promise<Object>} Updated comment object
   */
  async updateComment(owner, repo, commentId, body) {
    if (!this.isAuthenticated()) {
      throw new Error('GitHub token not set')
    }

    try {
      const response = await this.axiosInstance.patch(`/repos/${owner}/${repo}/issues/comments/${commentId}`, { body })
      return response.data
    } catch (error) {
      throw new Error(error.response?.data?.message || error.message)
    }
  }

  /**
   * Delete a comment
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @param {number} commentId - Comment ID
   * @returns {Promise<void>}
   */
  async deleteComment(owner, repo, commentId) {
    if (!this.isAuthenticated()) {
      throw new Error('GitHub token not set')
    }

    try {
      await this.axiosInstance.delete(`/repos/${owner}/${repo}/issues/comments/${commentId}`)
    } catch (error) {
      throw new Error(error.response?.data?.message || error.message)
    }
  }

  /**
   * List files changed in a pull request
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @param {number} prNumber - PR number
   * @returns {Promise<Array>} List of changed files
   */
  async listPullRequestFiles(owner, repo, prNumber) {
    if (!this.isAuthenticated()) {
      throw new Error('GitHub token not set')
    }

    try {
      const response = await this.axiosInstance.get(`/repos/${owner}/${repo}/pulls/${prNumber}/files`)
      return response.data
    } catch (error) {
      throw new Error(error.response?.data?.message || error.message)
    }
  }

  /**
   * List commits in a pull request
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @param {number} prNumber - PR number
   * @returns {Promise<Array>} List of commits
   */
  async listPullRequestCommits(owner, repo, prNumber) {
    if (!this.isAuthenticated()) {
      throw new Error('GitHub token not set')
    }

    try {
      const response = await this.axiosInstance.get(`/repos/${owner}/${repo}/pulls/${prNumber}/commits`)
      return response.data
    } catch (error) {
      throw new Error(error.response?.data?.message || error.message)
    }
  }

  /**
   * List reviews for a pull request
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @param {number} prNumber - PR number
   * @returns {Promise<Array>} List of reviews
   */
  async listPullRequestReviews(owner, repo, prNumber) {
    if (!this.isAuthenticated()) {
      throw new Error('GitHub token not set')
    }

    try {
      const response = await this.axiosInstance.get(`/repos/${owner}/${repo}/pulls/${prNumber}/reviews`)
      return response.data
    } catch (error) {
      throw new Error(error.response?.data?.message || error.message)
    }
  }

  /**
   * Create a review for a pull request
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @param {number} prNumber - PR number
   * @param {Object} reviewData - Review data (event, body, comments)
   * @returns {Promise<Object>} Created review object
   */
  async createPullRequestReview(owner, repo, prNumber, reviewData) {
    if (!this.isAuthenticated()) {
      throw new Error('GitHub token not set')
    }

    try {
      const response = await this.axiosInstance.post(`/repos/${owner}/${repo}/pulls/${prNumber}/reviews`, reviewData)
      return response.data
    } catch (error) {
      throw new Error(error.response?.data?.message || error.message)
    }
  }

  /**
   * List milestones for a repository
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @param {Object} options - Query options
   * @returns {Promise<Array>} List of milestones
   */
  async listMilestones(owner, repo, options = {}) {
    if (!this.isAuthenticated()) {
      throw new Error('GitHub token not set')
    }

    const params = {
      state: options.state || 'open', // open, closed, all
      sort: options.sort || 'due_on',
      direction: options.direction || 'asc'
    }

    try {
      const response = await this.axiosInstance.get(`/repos/${owner}/${repo}/milestones`, { params })
      return response.data
    } catch (error) {
      throw new Error(error.response?.data?.message || error.message)
    }
  }

  /**
   * Create a milestone
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @param {Object} milestoneData - Milestone data
   * @returns {Promise<Object>} Created milestone object
   */
  async createMilestone(owner, repo, milestoneData) {
    if (!this.isAuthenticated()) {
      throw new Error('GitHub token not set')
    }

    try {
      const response = await this.axiosInstance.post(`/repos/${owner}/${repo}/milestones`, milestoneData)
      return response.data
    } catch (error) {
      throw new Error(error.response?.data?.message || error.message)
    }
  }

  /**
   * Update a milestone
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @param {number} milestoneNumber - Milestone number
   * @param {Object} updates - Fields to update
   * @returns {Promise<Object>} Updated milestone object
   */
  async updateMilestone(owner, repo, milestoneNumber, updates) {
    if (!this.isAuthenticated()) {
      throw new Error('GitHub token not set')
    }

    try {
      const response = await this.axiosInstance.patch(`/repos/${owner}/${repo}/milestones/${milestoneNumber}`, updates)
      return response.data
    } catch (error) {
      throw new Error(error.response?.data?.message || error.message)
    }
  }

  /**
   * Get file contents from repository
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @param {string} path - File path
   * @param {string} ref - Branch/commit ref (default: default branch)
   * @returns {Promise<Object>} File content object
   */
  async getFileContents(owner, repo, path, ref = null) {
    if (!this.isAuthenticated()) {
      throw new Error('GitHub token not set')
    }

    const params = ref ? { ref } : {}

    try {
      const response = await this.axiosInstance.get(`/repos/${owner}/${repo}/contents/${path}`, { params })
      return response.data
    } catch (error) {
      throw new Error(error.response?.data?.message || error.message)
    }
  }

  /**
   * List branches for a repository
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @returns {Promise<Array>} List of branches
   */
  async listBranches(owner, repo) {
    if (!this.isAuthenticated()) {
      throw new Error('GitHub token not set')
    }

    try {
      const response = await this.axiosInstance.get(`/repos/${owner}/${repo}/branches`)
      return response.data
    } catch (error) {
      throw new Error(error.response?.data?.message || error.message)
    }
  }

  /**
   * Search issues in a repository by keywords
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @param {string} query - Search query (keywords)
   * @param {Object} options - Search options
   * @returns {Promise<Array>} List of matching issues
   */
  async searchIssues(owner, repo, query, options = {}) {
    if (!this.isAuthenticated()) {
      throw new Error('GitHub token not set')
    }

    // Build search query
    // Format: "query in:body,title repo:owner/repo is:issue"
    let searchQuery = `${query} repo:${owner}/${repo} is:issue`

    // Add state filter
    if (options.state && options.state !== 'all') {
      searchQuery += ` state:${options.state}`
    }

    // Add labels filter
    if (options.labels) {
      searchQuery += ` label:"${options.labels}"`
    }

    // Add assignee filter
    if (options.assignee) {
      searchQuery += ` assignee:${options.assignee}`
    }

    const params = {
      q: searchQuery,
      sort: options.sort || 'created',
      order: options.direction || 'desc',
      per_page: options.perPage || 30,
      page: options.page || 1
    }

    try {
      const response = await this.axiosInstance.get('/search/issues', { params })
      // Filter out pull requests (GitHub search may include PRs)
      return response.data.items.filter(item => !item.pull_request)
    } catch (error) {
      throw new Error(error.response?.data?.message || error.message)
    }
  }

  /**
   * Search pull requests in a repository by keywords
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @param {string} query - Search query (keywords)
   * @param {Object} options - Search options
   * @returns {Promise<Array>} List of matching pull requests
   */
  async searchPullRequests(owner, repo, query, options = {}) {
    if (!this.isAuthenticated()) {
      throw new Error('GitHub token not set')
    }

    // Build search query
    // Format: "query in:body,title repo:owner/repo is:pr"
    let searchQuery = `${query} repo:${owner}/${repo} is:pr`

    // Add state filter
    if (options.state && options.state !== 'all') {
      searchQuery += ` state:${options.state}`
    }

    const params = {
      q: searchQuery,
      sort: options.sort || 'created',
      order: options.direction || 'desc',
      per_page: options.perPage || 30,
      page: options.page || 1
    }

    try {
      const response = await this.axiosInstance.get('/search/issues', { params })
      // Return only items that have pull_request field
      return response.data.items.filter(item => item.pull_request)
    } catch (error) {
      throw new Error(error.response?.data?.message || error.message)
    }
  }

  /**
   * Get combined status for a ref (branch/commit)
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @param {string} ref - Branch name or commit SHA
   * @returns {Promise<Object>} Combined status object
   */
  async getCombinedStatus(owner, repo, ref) {
    if (!this.isAuthenticated()) {
      throw new Error('GitHub token not set')
    }

    try {
      const response = await this.axiosInstance.get(`/repos/${owner}/${repo}/commits/${ref}/status`)
      return response.data
    } catch (error) {
      throw new Error(error.response?.data?.message || error.message)
    }
  }

  /**
   * Get check runs for a ref (GitHub Actions, etc.)
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @param {string} ref - Branch name or commit SHA
   * @returns {Promise<Object>} Check runs object
   */
  async getCheckRuns(owner, repo, ref) {
    if (!this.isAuthenticated()) {
      throw new Error('GitHub token not set')
    }

    try {
      const response = await this.axiosInstance.get(`/repos/${owner}/${repo}/commits/${ref}/check-runs`, {
        headers: {
          'Accept': 'application/vnd.github.v3+json'
        }
      })
      return response.data
    } catch (error) {
      throw new Error(error.response?.data?.message || error.message)
    }
  }

  /**
   * Issue #4465: Save GitHub token to Integram Users table (table 18)
   * @param {string} token - GitHub PAT
   * @returns {Promise<void>}
   */
  async saveTokenToIntegram(token) {
    if (!integramService.isAuthenticated()) {
      logger.warn('Cannot save GitHub token to Integram: not authenticated')
      return
    }

    try {
      // Get current user ID
      const session = await integramService.getSession()
      const userId = session.id || session.userId

      if (!userId) {
        logger.warn('Cannot save GitHub token: no user ID found')
        return
      }

      // Get Users table metadata to find github_token requisite ID
      const metadata = await integramService.getTypeMetadata(USERS_TABLE_ID)
      const requisites = metadata.requisites || []

      // Find github_token requisite by alias
      let githubTokenReqId = requisites.find(r =>
        r.alias === 'github_token' || r.alias === 'GitHub Token'
      )?.id

      // If github_token requisite doesn't exist, create it
      if (!githubTokenReqId) {
        logger.info('Creating github_token requisite in Users table')
        const newReq = await integramService.addRequisite(USERS_TABLE_ID, 3) // 3 = SHORT text
        githubTokenReqId = newReq.id

        // Set alias
        await integramService.saveAlias(githubTokenReqId, 'github_token')
        logger.info(`Created github_token requisite with ID: ${githubTokenReqId}`)
      }

      // Update user object with GitHub token
      await integramService.setRequisites(userId, {
        [githubTokenReqId]: token
      })

      logger.info('GitHub token saved to Integram successfully')
    } catch (error) {
      logger.error('Failed to save GitHub token to Integram:', error)
      throw error
    }
  }

  /**
   * Issue #4465: Load GitHub token from Integram Users table (table 18)
   * @returns {Promise<string|null>} Token or null
   */
  async loadTokenFromIntegram() {
    if (!integramService.isAuthenticated()) {
      return null
    }

    try {
      // Get current user ID
      const session = await integramService.getSession()
      const userId = session.id || session.userId

      if (!userId) {
        return null
      }

      // Get user object data
      const userData = await integramService.getEditObject(userId)
      const reqs = userData.reqs || {}

      // Find github_token requisite
      for (const [reqId, reqData] of Object.entries(reqs)) {
        if (reqData.alias === 'github_token' || reqData.alias === 'GitHub Token') {
          const token = reqData.value
          if (token && token.trim()) {
            logger.info('GitHub token loaded from Integram successfully')
            return token.trim()
          }
        }
      }

      return null
    } catch (error) {
      logger.warn('Failed to load GitHub token from Integram:', error)
      return null
    }
  }

  /**
   * Get comprehensive PR readiness status
   * Checks: mergeable state, CI status, check runs, reviews, comments
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @param {number} prNumber - PR number
   * @returns {Promise<Object>} PR readiness status
   */
  async getPRReadinessStatus(owner, repo, prNumber) {
    if (!this.isAuthenticated()) {
      throw new Error('GitHub token not set')
    }

    try {
      // Fetch PR details
      const pr = await this.getPullRequest(owner, repo, prNumber)

      // Initialize status object
      const status = {
        ready: false,
        mergeable: pr.mergeable,
        mergeableState: pr.mergeable_state,
        merged: pr.merged,
        draft: pr.draft,
        ciStatus: 'unknown',
        checksStatus: 'unknown',
        hasApprovedReviews: false,
        hasRequestedChanges: false,
        aiGenerationComplete: false,
        errors: [],
        warnings: []
      }

      // Check if PR is draft
      if (pr.draft) {
        status.warnings.push('PR is marked as draft')
      }

      // Check if already merged
      if (pr.merged) {
        status.warnings.push('PR is already merged')
        return status
      }

      // Check mergeable state
      if (pr.mergeable === false) {
        status.errors.push('PR has merge conflicts')
      }

      // Fetch CI status (legacy commit status API)
      try {
        const combinedStatus = await this.getCombinedStatus(owner, repo, pr.head.sha)
        status.ciStatus = combinedStatus.state // success, pending, failure, error

        if (combinedStatus.state === 'failure' || combinedStatus.state === 'error') {
          status.errors.push(`CI checks failed: ${combinedStatus.state}`)
        } else if (combinedStatus.state === 'pending') {
          status.warnings.push('CI checks are still running')
        }
      } catch (error) {
        console.warn('Could not fetch combined status:', error.message)
      }

      // Fetch check runs (GitHub Actions, etc.)
      try {
        const checkRuns = await this.getCheckRuns(owner, repo, pr.head.sha)

        if (checkRuns.total_count > 0) {
          const allChecks = checkRuns.check_runs
          const failedChecks = allChecks.filter(c => c.conclusion === 'failure' || c.conclusion === 'action_required')
          const pendingChecks = allChecks.filter(c => c.status !== 'completed')
          const successChecks = allChecks.filter(c => c.conclusion === 'success')

          if (failedChecks.length > 0) {
            status.checksStatus = 'failure'
            status.errors.push(`${failedChecks.length} check(s) failed`)
          } else if (pendingChecks.length > 0) {
            status.checksStatus = 'pending'
            status.warnings.push(`${pendingChecks.length} check(s) still running`)
          } else if (successChecks.length === allChecks.length) {
            status.checksStatus = 'success'
          }
        }
      } catch (error) {
        console.warn('Could not fetch check runs:', error.message)
      }

      // Fetch reviews
      try {
        const reviews = await this.listPullRequestReviews(owner, repo, prNumber)

        const latestReviewsByUser = {}
        reviews.forEach(review => {
          const userId = review.user.id
          if (!latestReviewsByUser[userId] || new Date(review.submitted_at) > new Date(latestReviewsByUser[userId].submitted_at)) {
            latestReviewsByUser[userId] = review
          }
        })

        const latestReviews = Object.values(latestReviewsByUser)
        const approvedReviews = latestReviews.filter(r => r.state === 'APPROVED')
        const changesRequestedReviews = latestReviews.filter(r => r.state === 'CHANGES_REQUESTED')

        status.hasApprovedReviews = approvedReviews.length > 0
        status.hasRequestedChanges = changesRequestedReviews.length > 0

        if (status.hasRequestedChanges) {
          status.errors.push(`${changesRequestedReviews.length} reviewer(s) requested changes`)
        }
      } catch (error) {
        console.warn('Could not fetch reviews:', error.message)
      }

      // Check for AI generation completion marker in comments
      try {
        const comments = await this.listPullRequestComments(owner, repo, prNumber)

        // Look for specific markers that indicate AI generation is complete
        const aiCompletionMarkers = [
          'отметил этот пул-реквест как готовый к рассмотрению',
          'marked this pull request as ready for review',
          'PR is ready for review',
          'Implementation complete'
        ]

        status.aiGenerationComplete = comments.some(comment =>
          aiCompletionMarkers.some(marker =>
            comment.body.toLowerCase().includes(marker.toLowerCase())
          )
        )

        if (!status.aiGenerationComplete) {
          status.warnings.push('AI generation may still be in progress')
        }
      } catch (error) {
        console.warn('Could not fetch comments:', error.message)
      }

      // Determine overall readiness
      status.ready =
        !pr.draft &&
        !pr.merged &&
        pr.mergeable !== false &&
        status.ciStatus !== 'failure' &&
        status.ciStatus !== 'error' &&
        status.checksStatus !== 'failure' &&
        !status.hasRequestedChanges &&
        status.aiGenerationComplete &&
        (status.ciStatus === 'success' || status.checksStatus === 'success' || status.ciStatus === 'unknown')

      return status
    } catch (error) {
      throw new Error(error.response?.data?.message || error.message)
    }
  }
}

// Export singleton instance
export const githubService = new GitHubService()
export default githubService
