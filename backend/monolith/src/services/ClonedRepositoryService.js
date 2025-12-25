/**
 * Cloned Repository Service
 * Issue #4426: Store cloned repository data in Integram
 *
 * This service manages cloned repository metadata in Integram database.
 * It provides validation, restrictions, and CRUD operations for cloned repositories.
 */

import IntegramMCPClient from './mcp/IntegramMCPClient.js';
import { CLONED_REPO_REQUISITES, USER_TYPE_ID } from '../config/integram-requisites.js';
import logger from '../utils/logger.js';

class ClonedRepositoryService {
  constructor() {
    this.integramClient = null;
    this.initialized = false;

    // Configuration
    this.maxClonesPerUser = parseInt(process.env.MAX_CLONES_PER_USER || '10');
    this.maxRepositorySize = parseInt(process.env.MAX_REPOSITORY_SIZE || '1073741824'); // 1GB
    this.maxFileCount = parseInt(process.env.MAX_FILE_COUNT || '100000');
    this.cloneCooldown = parseInt(process.env.CLONE_COOLDOWN_MS || '60000'); // 1 minute

    // Blacklisted repositories (configurable via env)
    const blacklistEnv = process.env.REPOSITORY_BLACKLIST || '';
    this.repositoryBlacklist = blacklistEnv
      .split(',')
      .map(url => url.trim())
      .filter(url => url.length > 0);

    logger.info({
      maxClonesPerUser: this.maxClonesPerUser,
      maxRepositorySize: this.maxRepositorySize,
      maxFileCount: this.maxFileCount,
      cloneCooldown: this.cloneCooldown,
      blacklistCount: this.repositoryBlacklist.length
    }, 'ClonedRepositoryService configuration');
  }

  /**
   * Initialize Integram client
   */
  async initialize() {
    if (this.initialized) {
      return;
    }

    const serverURL = process.env.INTEGRAM_SERVER_URL || 'https://dronedoc.ru';
    const database = 'my'; // Organizations and user data
    const login = process.env.INTEGRAM_LOGIN || 'd';
    const password = process.env.INTEGRAM_PASSWORD || 'd';

    logger.info({ serverURL, database, login }, 'Initializing ClonedRepositoryService');

    this.integramClient = new IntegramMCPClient({
      serverURL,
      database
    });

    // Authenticate - wrap in try-catch to gracefully handle Integram unavailability
    try {
      await this.integramClient.authenticate(login, password);
      this.initialized = true;
      logger.info('ClonedRepositoryService initialized successfully');
    } catch (error) {
      logger.warn({
        error: error.message,
        serverURL,
        database
      }, 'Failed to authenticate with Integram - service will operate in limited mode');
      // Set initialized to true anyway so we don't keep trying
      this.initialized = true;
      // Store error for later checking
      this.initializationError = error;
    }
  }

  /**
   * Validate repository URL format
   * @param {string} url - Repository URL
   * @returns {object} { isValid: boolean, normalizedUrl: string|null, error: string|null }
   */
  validateRepositoryUrl(url) {
    if (!url || typeof url !== 'string') {
      return {
        isValid: false,
        normalizedUrl: null,
        error: 'URL is required and must be a string'
      };
    }

    const trimmedUrl = url.trim();

    if (!trimmedUrl) {
      return {
        isValid: false,
        normalizedUrl: null,
        error: 'Repository URL cannot be empty'
      };
    }

    // Check if URL is a GitHub pull request URL (common mistake)
    const githubPrPattern = /^https?:\/\/github\.com\/([^\/]+)\/([^\/]+)\/pull\/\d+/i;
    const prMatch = trimmedUrl.match(githubPrPattern);

    if (prMatch) {
      const owner = prMatch[1];
      const repo = prMatch[2];
      const repoUrl = `https://github.com/${owner}/${repo}.git`;

      return {
        isValid: false,
        normalizedUrl: repoUrl,
        error: `Cannot clone from pull request URL. Did you mean the repository URL? Try: ${repoUrl}`
      };
    }

    // Check if URL is a GitHub issue URL
    const githubIssuePattern = /^https?:\/\/github\.com\/([^\/]+)\/([^\/]+)\/issues\/\d+/i;
    const issueMatch = trimmedUrl.match(githubIssuePattern);

    if (issueMatch) {
      const owner = issueMatch[1];
      const repo = issueMatch[2];
      const repoUrl = `https://github.com/${owner}/${repo}.git`;

      return {
        isValid: false,
        normalizedUrl: repoUrl,
        error: `Cannot clone from issue URL. Did you mean the repository URL? Try: ${repoUrl}`
      };
    }

    // Check if URL looks like a website URL (not Git)
    const websitePattern = /^https?:\/\/(?!github\.com|gitlab\.com|bitbucket\.org)/i;
    if (websitePattern.test(trimmedUrl) && !trimmedUrl.endsWith('.git')) {
      return {
        isValid: false,
        normalizedUrl: null,
        error: `This appears to be a website URL, not a Git repository URL. Expected formats: https://github.com/user/repo.git, https://github.com/user/repo, git@github.com:user/repo.git`
      };
    }

    // Valid Git URL patterns
    const gitUrlPatterns = [
      /^https?:\/\/.+\.git$/i,                     // https://github.com/user/repo.git
      /^https?:\/\/(github|gitlab|bitbucket)\.com\/[^\/]+\/[^\/]+$/i, // https://github.com/user/repo
      /^git@.+:.+\.git$/i,                         // git@github.com:user/repo.git
      /^git@.+:.+$/i,                              // git@github.com:user/repo
      /^ssh:\/\/.+\.git$/i                         // ssh://git@github.com/user/repo.git
    ];

    const isValid = gitUrlPatterns.some(pattern => pattern.test(trimmedUrl));

    if (!isValid) {
      return {
        isValid: false,
        normalizedUrl: null,
        error: 'Invalid Git repository URL format. Expected formats: ' +
               'https://github.com/user/repo.git, ' +
               'https://github.com/user/repo, ' +
               'git@github.com:user/repo.git, ' +
               'or similar formats for GitLab/Bitbucket'
      };
    }

    // Check blacklist
    if (this.repositoryBlacklist.includes(trimmedUrl)) {
      return {
        isValid: false,
        normalizedUrl: null,
        error: 'This repository is blacklisted and cannot be cloned'
      };
    }

    return {
      isValid: true,
      normalizedUrl: trimmedUrl,
      error: null
    };
  }

  /**
   * Check if user has reached clone limits
   * @param {string} userId - User identifier
   * @throws {Error} If limits are exceeded
   */
  async checkUserCloneLimits(userId) {
    await this.initialize();

    // If initialization failed, skip limit check (non-blocking)
    if (this.initializationError) {
      logger.warn({ error: this.initializationError.message }, 'Skipping clone limits check - Integram not available');
      return;
    }

    // Get user's active cloned repositories from Integram
    const typeId = CLONED_REPO_REQUISITES.TYPE_ID;
    if (!typeId) {
      logger.warn('CLONED_REPO_TYPE_ID not configured, skipping limit check');
      return;
    }

    try {
      // Get all cloned repositories for this user
      const response = await this.integramClient.getObjects(typeId, {
        LIMIT: 100
      });

      const userRepos = (response.object || []).filter(obj => {
        const reqs = response.reqs?.[obj.id] || {};
        const status = reqs[CLONED_REPO_REQUISITES.СТАТУС];
        const objUserId = reqs[CLONED_REPO_REQUISITES.USER_ID];

        return objUserId === userId && status === 'active';
      });

      // Check count limit
      if (userRepos.length >= this.maxClonesPerUser) {
        throw new Error(
          `Clone limit reached: maximum ${this.maxClonesPerUser} cloned repositories allowed per user. ` +
          `You have ${userRepos.length} active clones.`
        );
      }

      // Check cooldown (last clone timestamp)
      if (userRepos.length > 0) {
        const cloneDates = userRepos
          .map(obj => {
            const reqs = response.reqs?.[obj.id] || {};
            return reqs[CLONED_REPO_REQUISITES.ДАТА_КЛОНИРОВАНИЯ];
          })
          .filter(date => date)
          .map(date => new Date(date));

        if (cloneDates.length > 0) {
          const lastClone = cloneDates.sort((a, b) => b - a)[0];
          const timeSinceLastClone = Date.now() - lastClone.getTime();

          if (timeSinceLastClone < this.cloneCooldown) {
            const remainingTime = Math.ceil((this.cloneCooldown - timeSinceLastClone) / 1000);
            throw new Error(
              `Please wait ${remainingTime} seconds before cloning another repository. ` +
              `This helps prevent server overload.`
            );
          }
        }
      }

      logger.info({
        userId,
        activeClones: userRepos.length,
        maxAllowed: this.maxClonesPerUser
      }, 'User clone limits check passed');

    } catch (error) {
      if (error.message.includes('Clone limit') || error.message.includes('Please wait')) {
        throw error; // Re-throw limit errors
      }
      logger.error({ error: error.message, userId }, 'Failed to check user clone limits');
      // Don't block cloning if we can't check limits
    }
  }

  /**
   * Validate repository size constraints
   * @param {object} repoInfo - Repository information
   * @param {number} repoInfo.fileCount - Number of files
   * @param {number} repoInfo.sizeBytes - Repository size in bytes
   * @throws {Error} If size constraints are violated
   */
  validateRepositorySize(repoInfo) {
    const { fileCount, sizeBytes } = repoInfo;

    if (sizeBytes && sizeBytes > this.maxRepositorySize) {
      const sizeMB = Math.round(sizeBytes / 1024 / 1024);
      const maxSizeMB = Math.round(this.maxRepositorySize / 1024 / 1024);
      throw new Error(
        `Repository too large: ${sizeMB}MB exceeds maximum allowed ${maxSizeMB}MB`
      );
    }

    if (fileCount && fileCount > this.maxFileCount) {
      throw new Error(
        `Too many files: ${fileCount} exceeds maximum allowed ${this.maxFileCount}`
      );
    }

    logger.info({
      fileCount,
      sizeBytes,
      sizeMB: Math.round((sizeBytes || 0) / 1024 / 1024)
    }, 'Repository size validation passed');
  }

  /**
   * Store cloned repository metadata in Integram
   * @param {object} data - Repository data
   * @returns {Promise<object>} Created object
   */
  async storeClonedRepository(data) {
    await this.initialize();

    // Check if initialization failed
    if (this.initializationError) {
      throw new Error(`Cannot store cloned repository: Integram service not available (${this.initializationError.message})`);
    }

    const {
      userId,
      workspaceId,
      repositoryUrl,
      branch,
      commitHash,
      fileCount,
      sizeBytes,
      workspacePath
    } = data;

    const typeId = CLONED_REPO_REQUISITES.TYPE_ID;
    if (!typeId) {
      throw new Error('CLONED_REPO_TYPE_ID not configured. Please run create-cloned-repositories-table.js first.');
    }

    // Parse repository name from URL
    const repoName = this._parseRepositoryName(repositoryUrl);

    const requisites = {
      [CLONED_REPO_REQUISITES.URL_РЕПОЗИТОРИЯ]: repositoryUrl,
      [CLONED_REPO_REQUISITES.ВЕТКА]: branch,
      [CLONED_REPO_REQUISITES.ХЕШ_КОММИТА]: commitHash,
      [CLONED_REPO_REQUISITES.WORKSPACE_ID]: workspaceId,
      [CLONED_REPO_REQUISITES.USER_ID]: userId,
      [CLONED_REPO_REQUISITES.ДАТА_КЛОНИРОВАНИЯ]: new Date().toISOString(),
      [CLONED_REPO_REQUISITES.КОЛИЧЕСТВО_ФАЙЛОВ]: fileCount.toString(),
      [CLONED_REPO_REQUISITES.РАЗМЕР_БАЙТЫ]: (sizeBytes || 0).toString(),
      [CLONED_REPO_REQUISITES.СТАТУС]: 'active',
      [CLONED_REPO_REQUISITES.ПУТЬ_К_WORKSPACE]: workspacePath,
      [CLONED_REPO_REQUISITES.ПОСЛЕДНЯЯ_АКТИВНОСТЬ]: new Date().toISOString()
    };

    try {
      const result = await this.integramClient.createObject(
        typeId,
        repoName,
        requisites
      );

      logger.info({
        objectId: result.id,
        workspaceId,
        repositoryUrl,
        branch
      }, 'Cloned repository stored in Integram');

      return result;
    } catch (error) {
      logger.error({
        error: error.message,
        workspaceId,
        repositoryUrl
      }, 'Failed to store cloned repository in Integram');
      throw error;
    }
  }

  /**
   * Get cloned repositories for user
   * @param {string} userId - User identifier
   * @param {object} options - Query options
   * @returns {Promise<array>} Array of cloned repositories
   */
  async getClonedRepositories(userId, options = {}) {
    await this.initialize();

    // If initialization failed, return empty array (non-blocking)
    if (this.initializationError) {
      logger.warn({ error: this.initializationError.message }, 'Cannot get cloned repositories - Integram not available');
      return [];
    }

    const typeId = CLONED_REPO_REQUISITES.TYPE_ID;
    if (!typeId) {
      return [];
    }

    try {
      const response = await this.integramClient.getObjects(typeId, {
        LIMIT: options.limit || 100
      });

      const repos = (response.object || [])
        .map(obj => {
          const reqs = response.reqs?.[obj.id] || {};
          const objUserId = reqs[CLONED_REPO_REQUISITES.USER_ID];

          if (options.status) {
            const status = reqs[CLONED_REPO_REQUISITES.СТАТУС];
            if (status !== options.status) {
              return null;
            }
          }

          if (userId && objUserId !== userId) {
            return null;
          }

          return {
            id: obj.id,
            name: obj.val,
            url: reqs[CLONED_REPO_REQUISITES.URL_РЕПОЗИТОРИЯ],
            branch: reqs[CLONED_REPO_REQUISITES.ВЕТКА],
            commitHash: reqs[CLONED_REPO_REQUISITES.ХЕШ_КОММИТА],
            workspaceId: reqs[CLONED_REPO_REQUISITES.WORKSPACE_ID],
            userId: objUserId,
            clonedAt: reqs[CLONED_REPO_REQUISITES.ДАТА_КЛОНИРОВАНИЯ],
            fileCount: parseInt(reqs[CLONED_REPO_REQUISITES.КОЛИЧЕСТВО_ФАЙЛОВ] || '0'),
            sizeBytes: parseInt(reqs[CLONED_REPO_REQUISITES.РАЗМЕР_БАЙТЫ] || '0'),
            status: reqs[CLONED_REPO_REQUISITES.СТАТУС],
            workspacePath: reqs[CLONED_REPO_REQUISITES.ПУТЬ_К_WORKSPACE],
            lastActivity: reqs[CLONED_REPO_REQUISITES.ПОСЛЕДНЯЯ_АКТИВНОСТЬ]
          };
        })
        .filter(repo => repo !== null);

      return repos;
    } catch (error) {
      logger.error({ error: error.message, userId }, 'Failed to get cloned repositories');
      return [];
    }
  }

  /**
   * Delete cloned repository (mark as deleted)
   * @param {string} repositoryId - Repository object ID
   * @returns {Promise<object>} Update result
   */
  async deleteClonedRepository(repositoryId) {
    await this.initialize();

    const typeId = CLONED_REPO_REQUISITES.TYPE_ID;
    if (!typeId) {
      throw new Error('CLONED_REPO_TYPE_ID not configured');
    }

    try {
      await this.integramClient.setRequisites(repositoryId, {
        [CLONED_REPO_REQUISITES.СТАТУС]: 'deleted',
        [CLONED_REPO_REQUISITES.ПОСЛЕДНЯЯ_АКТИВНОСТЬ]: new Date().toISOString()
      });

      logger.info({ repositoryId }, 'Cloned repository marked as deleted');

      return { success: true, message: 'Repository marked as deleted' };
    } catch (error) {
      logger.error({ error: error.message, repositoryId }, 'Failed to delete cloned repository');
      throw error;
    }
  }

  /**
   * Parse repository name from URL
   * @private
   * @param {string} url - Repository URL
   * @returns {string} Repository name
   */
  _parseRepositoryName(url) {
    try {
      // Extract repository name from URL
      // Examples:
      //   https://github.com/user/repo.git → repo
      //   https://github.com/user/repo → repo
      //   git@github.com:user/repo.git → repo

      const withoutGit = url.replace(/\.git$/, '');
      const parts = withoutGit.split(/[\/:]/).filter(p => p);
      const name = parts[parts.length - 1];

      return name || 'unknown-repo';
    } catch (error) {
      return 'unknown-repo';
    }
  }
}

// Export singleton instance
const clonedRepositoryService = new ClonedRepositoryService();
export default clonedRepositoryService;
