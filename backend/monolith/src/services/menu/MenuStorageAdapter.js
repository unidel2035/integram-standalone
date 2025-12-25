// MenuStorageAdapter.js - Menu storage with file-based engine
// Issue #2271: Make LinkDB as alternative storage engine, not the only one
// Issue #2414: LinkDB code moved to @unidel2035/links-client package

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import logger from '../../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Storage engine types
// Note: LINKDB support has been moved to @unidel2035/links-client package
export const StorageEngineType = {
  FILE_BASED: 'file-based'
};

// Default menu configuration storage path (for file-based engine)
const MENU_CONFIG_DIR = path.join(__dirname, '../../../data');
const MENU_CONFIG_FILE = path.join(MENU_CONFIG_DIR, 'menu-config.json');

/**
 * MenuStorageAdapter - File-based menu storage
 *
 * Note: LinkDB storage support has been moved to @unidel2035/links-client package (Issue #2414)
 * To use LinkDB storage, install the package:
 *   npm install @unidel2035/links-client
 * Or from GitHub:
 *   npm install git+https://github.com/unidel2035/links-client.git
 */
class MenuStorageAdapter {
  constructor(engineType = StorageEngineType.FILE_BASED) {
    this.engineType = engineType;

    if (engineType !== StorageEngineType.FILE_BASED) {
      throw new Error('Only FILE_BASED engine is supported. LinkDB support moved to @unidel2035/links-client package.');
    }

    logger.info({ engineType }, 'MenuStorageAdapter initialized');
  }

  /**
   * Get current storage engine type
   */
  getEngineType() {
    return this.engineType;
  }

  /**
   * Check if storage engine is available
   * @param {string} engineType - Engine type to check
   */
  async isEngineAvailable(engineType) {
    if (engineType === StorageEngineType.FILE_BASED) {
      // File-based is always available
      return { available: true, reason: 'File system always available' };
    }

    return {
      available: false,
      reason: 'Only FILE_BASED engine is supported. LinkDB moved to @unidel2035/links-client package.'
    };
  }

  // ========================================
  // Menu Storage Interface
  // ========================================

  /**
   * Get menu configuration
   * @returns {Promise<object|null>} Menu configuration or null
   */
  async getMenuConfig() {
    return await this._getMenuConfigFile();
  }

  /**
   * Save menu configuration
   * @param {string} config - JSON string of menu configuration
   * @returns {Promise<object>} Save result
   */
  async saveMenuConfig(config) {
    return await this._saveMenuConfigFile(config);
  }

  /**
   * Delete menu configuration
   * @returns {Promise<object>} Delete result
   */
  async deleteMenuConfig() {
    return await this._deleteMenuConfigFile();
  }

  /**
   * Get all menu items (flat list)
   * @returns {Promise<Array<object>>} Menu items
   */
  async getAllMenuItems() {
    return await this._getAllMenuItemsFile();
  }

  /**
   * Get menu statistics
   * @returns {Promise<object>} Statistics
   */
  async getStatistics() {
    return await this._getStatisticsFile();
  }

  // ========================================
  // File-Based Storage Implementation
  // ========================================

  async _ensureDataDirectory() {
    try {
      await fs.access(MENU_CONFIG_DIR);
    } catch (error) {
      await fs.mkdir(MENU_CONFIG_DIR, { recursive: true });
      logger.info('Created data directory for menu configuration');
    }
  }

  async _getMenuConfigFile() {
    try {
      await this._ensureDataDirectory();
      const data = await fs.readFile(MENU_CONFIG_FILE, 'utf-8');
      const parsed = JSON.parse(data);

      return {
        config: parsed.config,
        updatedAt: parsed.updatedAt,
        source: 'file-based'
      };
    } catch (error) {
      if (error.code === 'ENOENT') {
        return null; // File doesn't exist yet
      }
      throw error;
    }
  }

  async _saveMenuConfigFile(config) {
    // Validate that config is a valid JSON string
    try {
      JSON.parse(config);
    } catch (error) {
      throw new Error('Invalid configuration format: must be a valid JSON string');
    }

    await this._ensureDataDirectory();

    const menuConfig = {
      config,
      updatedAt: new Date().toISOString()
    };

    await fs.writeFile(MENU_CONFIG_FILE, JSON.stringify(menuConfig, null, 2), 'utf-8');
    logger.info('Menu configuration saved successfully (file-based)');

    return {
      success: true,
      updatedAt: menuConfig.updatedAt,
      source: 'file-based'
    };
  }

  async _deleteMenuConfigFile() {
    try {
      await fs.unlink(MENU_CONFIG_FILE);
      logger.info('Menu configuration deleted successfully (file-based)');
      return { success: true, source: 'file-based' };
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error('Menu configuration not found');
      }
      throw error;
    }
  }

  async _getAllMenuItemsFile() {
    const config = await this._getMenuConfigFile();
    if (!config || !config.config) {
      return [];
    }

    // Parse menu structure and flatten
    const menuData = JSON.parse(config.config);
    const flattenMenu = (items, parentId = null) => {
      let result = [];
      for (const item of items) {
        const { items: children, ...itemData } = item;
        result.push({
          ...itemData,
          _parentId: parentId
        });
        if (children && Array.isArray(children)) {
          result = result.concat(flattenMenu(children, item.to || item.label));
        }
      }
      return result;
    };

    return flattenMenu(menuData);
  }

  async _getStatisticsFile() {
    const config = await this._getMenuConfigFile();

    if (!config || !config.config) {
      return {
        totalItems: 0,
        rootItems: 0,
        lastUpdated: null,
        source: 'file-based'
      };
    }

    const items = await this._getAllMenuItemsFile();
    const rootItems = items.filter(item => !item._parentId).length;

    return {
      totalItems: items.length,
      rootItems,
      lastUpdated: config.updatedAt,
      source: 'file-based'
    };
  }
}

export default MenuStorageAdapter;
