// AIProviderKeysService.js - Service for storing AI provider API keys using file system
// Replaces database storage (Issue #2155) with file-based storage
// Recreated in Issue #2420 after being accidentally deleted in PR #2415
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import logger from '../../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Data directory for storing AI provider API keys
const DATA_DIR = path.join(__dirname, '../../../data/ai-provider-keys');
const KEYS_FILE = path.join(DATA_DIR, 'provider-keys.json');

/**
 * AIProviderKeysService - Store AI provider API keys in file system
 *
 * Architecture:
 * - File system stores API keys for different providers (Anthropic, OpenAI, DeepSeek, etc.)
 * - Keys are encrypted using base64 (simple encryption, can be upgraded to AES-256 later)
 * - Single JSON file contains all provider keys
 *
 * File structure (provider-keys.json):
 * {
 *   "anthropic": {
 *     "provider": "anthropic",
 *     "displayName": "Anthropic (Claude)",
 *     "keyName": "default",
 *     "apiKeyEncrypted": "base64-encoded-key",
 *     "isDefault": true,
 *     "isActive": true,
 *     "createdAt": "2025-11-07T...",
 *     "updatedAt": "2025-11-07T..."
 *   },
 *   "openai": { ... },
 *   "deepseek": { ... }
 * }
 */
class AIProviderKeysService {
  constructor() {
    this.ensureDataDirectory();
  }

  /**
   * Ensure data directory exists
   */
  async ensureDataDirectory() {
    try {
      await fs.access(DATA_DIR);
    } catch (error) {
      await fs.mkdir(DATA_DIR, { recursive: true });
      logger.info({ dir: DATA_DIR }, 'Created AI provider keys directory');
    }
  }

  /**
   * Load all provider keys from file
   * @returns {Promise<object>} - Object with provider keys
   */
  async loadKeys() {
    try {
      const data = await fs.readFile(KEYS_FILE, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      if (error.code === 'ENOENT') {
        // File doesn't exist yet, return empty object
        return {};
      }
      logger.error({ error: error.message }, 'Failed to load provider keys');
      throw error;
    }
  }

  /**
   * Save all provider keys to file
   * @param {object} keys - Object with provider keys
   */
  async saveKeys(keys) {
    await fs.writeFile(KEYS_FILE, JSON.stringify(keys, null, 2), 'utf-8');
    logger.info('Provider keys saved to file');
  }

  /**
   * Encrypt API key (simple base64 encoding, can be upgraded later)
   * @param {string} apiKey - Plain text API key
   * @returns {string} - Encrypted API key
   */
  encryptKey(apiKey) {
    return Buffer.from(apiKey).toString('base64');
  }

  /**
   * Decrypt API key (simple base64 decoding, can be upgraded later)
   * @param {string} encryptedKey - Encrypted API key
   * @returns {string} - Plain text API key
   */
  decryptKey(encryptedKey) {
    return Buffer.from(encryptedKey, 'base64').toString('utf-8');
  }

  /**
   * Set or update API key for a provider
   * @param {string} providerName - Provider name (e.g., 'anthropic', 'openai', 'deepseek')
   * @param {string} apiKey - API key (plain text)
   * @param {object} options - Additional options
   * @returns {Promise<object>} - Saved key info
   */
  async setProviderKey(providerName, apiKey, options = {}) {
    const keys = await this.loadKeys();

    const keyInfo = {
      provider: providerName,
      displayName: options.displayName || providerName,
      keyName: options.keyName || 'default',
      apiKeyEncrypted: this.encryptKey(apiKey),
      isDefault: options.isDefault !== undefined ? options.isDefault : true,
      isActive: options.isActive !== undefined ? options.isActive : true,
      metadata: options.metadata || {},
      createdAt: keys[providerName]?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    keys[providerName] = keyInfo;
    await this.saveKeys(keys);

    logger.info({ provider: providerName }, 'Provider API key updated');

    // Return key info without the actual key
    return {
      provider: keyInfo.provider,
      displayName: keyInfo.displayName,
      keyName: keyInfo.keyName,
      isDefault: keyInfo.isDefault,
      isActive: keyInfo.isActive,
      createdAt: keyInfo.createdAt,
      updatedAt: keyInfo.updatedAt
    };
  }

  /**
   * Get API key for a provider (decrypted)
   * @param {string} providerName - Provider name
   * @returns {Promise<string|null>} - Decrypted API key or null
   */
  async getProviderKey(providerName) {
    const keys = await this.loadKeys();
    const keyInfo = keys[providerName];

    if (!keyInfo || !keyInfo.isActive) {
      return null;
    }

    return this.decryptKey(keyInfo.apiKeyEncrypted);
  }

  /**
   * Get provider key info (without decrypted key)
   * @param {string} providerName - Provider name
   * @returns {Promise<object|null>} - Key info or null
   */
  async getProviderKeyInfo(providerName) {
    const keys = await this.loadKeys();
    const keyInfo = keys[providerName];

    if (!keyInfo) {
      return null;
    }

    // Return without actual key
    return {
      provider: keyInfo.provider,
      displayName: keyInfo.displayName,
      keyName: keyInfo.keyName,
      isDefault: keyInfo.isDefault,
      isActive: keyInfo.isActive,
      createdAt: keyInfo.createdAt,
      updatedAt: keyInfo.updatedAt,
      hasKey: !!keyInfo.apiKeyEncrypted
    };
  }

  /**
   * Get all provider keys info (without decrypted keys)
   * @returns {Promise<Array<object>>} - Array of key info
   */
  async getAllProviderKeys() {
    const keys = await this.loadKeys();
    return Object.values(keys).map(keyInfo => ({
      provider: keyInfo.provider,
      displayName: keyInfo.displayName,
      keyName: keyInfo.keyName,
      isDefault: keyInfo.isDefault,
      isActive: keyInfo.isActive,
      createdAt: keyInfo.createdAt,
      updatedAt: keyInfo.updatedAt,
      hasKey: !!keyInfo.apiKeyEncrypted
    }));
  }

  /**
   * Delete API key for a provider
   * @param {string} providerName - Provider name
   * @returns {Promise<boolean>} - Success
   */
  async deleteProviderKey(providerName) {
    const keys = await this.loadKeys();

    if (!keys[providerName]) {
      return false;
    }

    delete keys[providerName];
    await this.saveKeys(keys);

    logger.info({ provider: providerName }, 'Provider API key deleted');
    return true;
  }

  /**
   * Set key as default for a provider
   * @param {string} providerName - Provider name
   * @returns {Promise<boolean>} - Success
   */
  async setAsDefault(providerName) {
    const keys = await this.loadKeys();

    if (!keys[providerName]) {
      return false;
    }

    keys[providerName].isDefault = true;
    keys[providerName].updatedAt = new Date().toISOString();
    await this.saveKeys(keys);

    logger.info({ provider: providerName }, 'Provider key set as default');
    return true;
  }

  /**
   * Activate/deactivate provider key
   * @param {string} providerName - Provider name
   * @param {boolean} isActive - Active status
   * @returns {Promise<boolean>} - Success
   */
  async setActiveStatus(providerName, isActive) {
    const keys = await this.loadKeys();

    if (!keys[providerName]) {
      return false;
    }

    keys[providerName].isActive = isActive;
    keys[providerName].updatedAt = new Date().toISOString();
    await this.saveKeys(keys);

    logger.info({ provider: providerName, isActive }, 'Provider key active status updated');
    return true;
  }
}

// Export singleton instance
const aiProviderKeysService = new AIProviderKeysService();
export default aiProviderKeysService;
