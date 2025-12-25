/**
 * Git Authorization Service
 * Issue #4052 Task 5: Add general Git authorization to the "git" column in the /my database
 *
 * This service manages Git/GitHub credentials stored in Integram database.
 * It provides secure storage and retrieval of tokens for Git operations.
 *
 * Database Structure:
 * - Uses Integram client to store in /my database
 * - User type (ID: 18) with "git" column/requisite
 * - Stores encrypted GitHub/GitLab tokens
 * - Associated with user objects
 */

import logger from '../utils/logger.js';
import integramClient from './integram/integram-client.js';
import crypto from 'crypto';

// Encryption configuration
const ENCRYPTION_ALGORITHM = 'aes-256-cbc';
const ENCRYPTION_KEY = process.env.GIT_TOKEN_ENCRYPTION_KEY || crypto.randomBytes(32);
const IV_LENGTH = 16;

// Integram database configuration
const DATABASE_NAME = 'my';
const USER_TYPE_ID = 18;

/**
 * Git Auth Service
 */
class GitAuthService {
  /**
   * Encrypt token
   * @param {string} token - Plain text token
   * @returns {string} Encrypted token
   * @private
   */
  _encryptToken(token) {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, ENCRYPTION_KEY, iv);

    let encrypted = cipher.update(token, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    // Return IV + encrypted data
    return iv.toString('hex') + ':' + encrypted;
  }

  /**
   * Decrypt token
   * @param {string} encryptedToken - Encrypted token
   * @returns {string} Decrypted token
   * @private
   */
  _decryptToken(encryptedToken) {
    const parts = encryptedToken.split(':');
    if (parts.length !== 2) {
      throw new Error('Invalid encrypted token format');
    }

    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];

    const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, ENCRYPTION_KEY, iv);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  /**
   * Save Git token for user
   * @param {string} userId - User ID in Integram
   * @param {string} provider - Git provider (github, gitlab, bitbucket)
   * @param {string} token - Access token
   * @param {object} metadata - Additional metadata (optional)
   * @returns {Promise<object>} Save result
   */
  async saveGitToken(userId, provider, token, metadata = {}) {
    try {
      logger.info({ userId, provider }, 'Saving Git token');

      // Ensure Integram client is authenticated
      if (!integramClient.isAuthenticated()) {
        await integramClient.authenticate(
          process.env.INTEGRAM_LOGIN || 'd',
          process.env.INTEGRAM_PASSWORD || 'd',
          process.env.INTEGRAM_SERVER_URL || 'https://dronedoc.ru',
          DATABASE_NAME
        );
      }

      // Encrypt token
      const encryptedToken = this._encryptToken(token);

      // Build token data structure
      const tokenData = {
        provider,
        encryptedToken,
        createdAt: new Date().toISOString(),
        lastUsed: new Date().toISOString(),
        ...metadata
      };

      // Get user's current git data
      let gitData = {};
      try {
        const userEdit = await integramClient.getEditObject(userId);
        const gitReq = userEdit.reqs?.git; // Assuming "git" is the requisite for Git auth
        if (gitReq?.value) {
          gitData = typeof gitReq.value === 'string' ? JSON.parse(gitReq.value) : gitReq.value;
        }
      } catch (error) {
        logger.warn({ error: error.message }, 'No existing Git data found, creating new');
      }

      // Update git data with new token
      gitData[provider] = tokenData;

      // Save to user object
      // Note: The requisite ID for "git" column needs to be determined
      // This is a placeholder - actual requisite ID should be configured
      const GIT_REQUISITE_ID = process.env.GIT_REQUISITE_ID || '197019';

      await integramClient.setRequisites(userId, {
        [GIT_REQUISITE_ID]: JSON.stringify(gitData)
      });

      logger.info({ userId, provider }, 'Git token saved successfully');

      return {
        success: true,
        provider,
        message: 'Git token saved successfully'
      };
    } catch (error) {
      logger.error({ error: error.message, userId, provider }, 'Failed to save Git token');
      throw error;
    }
  }

  /**
   * Get Git token for user
   * @param {string} userId - User ID in Integram
   * @param {string} provider - Git provider (github, gitlab, bitbucket)
   * @returns {Promise<string|null>} Decrypted token or null if not found
   */
  async getGitToken(userId, provider) {
    try {
      logger.info({ userId, provider }, 'Retrieving Git token');

      // Ensure Integram client is authenticated
      if (!integramClient.isAuthenticated()) {
        await integramClient.authenticate(
          process.env.INTEGRAM_LOGIN || 'd',
          process.env.INTEGRAM_PASSWORD || 'd',
          process.env.INTEGRAM_SERVER_URL || 'https://dronedoc.ru',
          DATABASE_NAME
        );
      }

      // Get user's git data
      const userEdit = await integramClient.getEditObject(userId);
      const GIT_REQUISITE_ID = process.env.GIT_REQUISITE_ID || '197019';
      const gitReq = userEdit.reqs?.[GIT_REQUISITE_ID];

      if (!gitReq || !gitReq.value) {
        logger.info({ userId, provider }, 'No Git tokens found for user');
        return null;
      }

      // Parse git data
      const gitData = typeof gitReq.value === 'string' ? JSON.parse(gitReq.value) : gitReq.value;

      if (!gitData[provider]) {
        logger.info({ userId, provider }, 'No token found for provider');
        return null;
      }

      const tokenData = gitData[provider];

      // Update last used timestamp
      tokenData.lastUsed = new Date().toISOString();
      await integramClient.setRequisites(userId, {
        [GIT_REQUISITE_ID]: JSON.stringify(gitData)
      });

      // Decrypt and return token
      const decryptedToken = this._decryptToken(tokenData.encryptedToken);

      logger.info({ userId, provider }, 'Git token retrieved successfully');

      return decryptedToken;
    } catch (error) {
      logger.error({ error: error.message, userId, provider }, 'Failed to retrieve Git token');
      return null;
    }
  }

  /**
   * Get all Git providers for user
   * @param {string} userId - User ID in Integram
   * @returns {Promise<array>} Array of provider names
   */
  async getGitProviders(userId) {
    try {
      // Ensure Integram client is authenticated
      if (!integramClient.isAuthenticated()) {
        await integramClient.authenticate(
          process.env.INTEGRAM_LOGIN || 'd',
          process.env.INTEGRAM_PASSWORD || 'd',
          process.env.INTEGRAM_SERVER_URL || 'https://dronedoc.ru',
          DATABASE_NAME
        );
      }

      // Get user's git data
      const userEdit = await integramClient.getEditObject(userId);
      const GIT_REQUISITE_ID = process.env.GIT_REQUISITE_ID || '197019';
      const gitReq = userEdit.reqs?.[GIT_REQUISITE_ID];

      if (!gitReq || !gitReq.value) {
        return [];
      }

      // Parse git data
      const gitData = typeof gitReq.value === 'string' ? JSON.parse(gitReq.value) : gitReq.value;

      return Object.keys(gitData).map(provider => ({
        provider,
        createdAt: gitData[provider].createdAt,
        lastUsed: gitData[provider].lastUsed
      }));
    } catch (error) {
      logger.error({ error: error.message, userId }, 'Failed to get Git providers');
      return [];
    }
  }

  /**
   * Delete Git token for user
   * @param {string} userId - User ID in Integram
   * @param {string} provider - Git provider to remove
   * @returns {Promise<object>} Delete result
   */
  async deleteGitToken(userId, provider) {
    try {
      logger.info({ userId, provider }, 'Deleting Git token');

      // Ensure Integram client is authenticated
      if (!integramClient.isAuthenticated()) {
        await integramClient.authenticate(
          process.env.INTEGRAM_LOGIN || 'd',
          process.env.INTEGRAM_PASSWORD || 'd',
          process.env.INTEGRAM_SERVER_URL || 'https://dronedoc.ru',
          DATABASE_NAME
        );
      }

      // Get user's git data
      const userEdit = await integramClient.getEditObject(userId);
      const GIT_REQUISITE_ID = process.env.GIT_REQUISITE_ID || '197019';
      const gitReq = userEdit.reqs?.[GIT_REQUISITE_ID];

      if (!gitReq || !gitReq.value) {
        return {
          success: true,
          message: 'No tokens to delete'
        };
      }

      // Parse git data
      const gitData = typeof gitReq.value === 'string' ? JSON.parse(gitReq.value) : gitReq.value;

      // Remove provider
      delete gitData[provider];

      // Save updated data
      await integramClient.setRequisites(userId, {
        [GIT_REQUISITE_ID]: JSON.stringify(gitData)
      });

      logger.info({ userId, provider }, 'Git token deleted successfully');

      return {
        success: true,
        message: 'Git token deleted successfully'
      };
    } catch (error) {
      logger.error({ error: error.message, userId, provider }, 'Failed to delete Git token');
      throw error;
    }
  }

  /**
   * Verify token is valid
   * @param {string} token - GitHub token to verify
   * @returns {Promise<object>} Verification result with user info
   */
  async verifyGitHubToken(token) {
    try {
      const response = await fetch('https://api.github.com/user', {
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28'
        }
      });

      if (!response.ok) {
        return {
          valid: false,
          error: 'Invalid token'
        };
      }

      const user = await response.json();

      return {
        valid: true,
        user: {
          login: user.login,
          name: user.name,
          email: user.email,
          avatarUrl: user.avatar_url
        }
      };
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to verify GitHub token');
      return {
        valid: false,
        error: error.message
      };
    }
  }
}

// Export singleton instance
const gitAuthService = new GitAuthService();
export default gitAuthService;
