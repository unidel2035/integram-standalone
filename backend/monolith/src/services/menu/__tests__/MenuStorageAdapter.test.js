/**
 * MenuStorageAdapter Tests
 *
 * Tests for file-based menu storage
 * Issue #2271: Make LinkDB as alternative storage engine, not the only one
 * Issue #2414: LinkDB support moved to @unidel2035/links-client package
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import MenuStorageAdapter, { StorageEngineType } from '../MenuStorageAdapter.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEST_DATA_DIR = path.join(__dirname, '../../../../test-data');
const TEST_MENU_CONFIG = path.join(TEST_DATA_DIR, 'menu-config.json');

describe('MenuStorageAdapter', () => {
  let adapter;

  beforeEach(async () => {
    // Ensure test data directory exists
    try {
      await fs.mkdir(TEST_DATA_DIR, { recursive: true });
    } catch (error) {
      // Directory already exists
    }
  });

  afterEach(async () => {
    // Cleanup test files
    try {
      await fs.unlink(TEST_MENU_CONFIG);
    } catch (error) {
      // File may not exist
    }
  });

  describe('Initialization', () => {
    it('should initialize with default file-based engine', () => {
      adapter = new MenuStorageAdapter();
      expect(adapter.getEngineType()).toBe(StorageEngineType.FILE_BASED);
    });

    it('should only support file-based engine', () => {
      expect(StorageEngineType.FILE_BASED).toBe('file-based');
    });

    it('should throw error when trying to initialize with non-file-based engine', () => {
      expect(() => new MenuStorageAdapter('linkdb')).toThrow('Only FILE_BASED engine is supported');
    });
  });

  describe('Engine Availability', () => {
    beforeEach(() => {
      adapter = new MenuStorageAdapter(StorageEngineType.FILE_BASED);
    });

    it('should report file-based engine as always available', async () => {
      const status = await adapter.isEngineAvailable(StorageEngineType.FILE_BASED);

      expect(status.available).toBe(true);
      expect(status.reason).toContain('File system');
    });

    it('should report other engines as not available', async () => {
      const status = await adapter.isEngineAvailable('linkdb');

      expect(status.available).toBe(false);
      expect(status.reason).toContain('FILE_BASED engine');
    });
  });

  describe('File-Based Storage Operations', () => {
    beforeEach(() => {
      adapter = new MenuStorageAdapter(StorageEngineType.FILE_BASED);
    });

    it('should return null when no config exists', async () => {
      const config = await adapter.getMenuConfig();
      expect(config).toBeNull();
    });

    it('should save and retrieve menu config', async () => {
      const menuData = [
        { label: 'Home', icon: 'pi pi-home', to: '/' },
        { label: 'About', icon: 'pi pi-info', to: '/about' }
      ];
      const configString = JSON.stringify(menuData);

      const saveResult = await adapter.saveMenuConfig(configString);

      expect(saveResult.success).toBe(true);
      expect(saveResult.source).toBe('file-based');
      expect(saveResult.updatedAt).toBeDefined();

      const retrieved = await adapter.getMenuConfig();

      expect(retrieved).toBeDefined();
      expect(retrieved.config).toBe(configString);
      expect(retrieved.source).toBe('file-based');
      expect(retrieved.updatedAt).toBeDefined();
    });

    it('should delete menu config', async () => {
      const menuData = [{ label: 'Test', icon: 'pi-test', to: '/test' }];
      await adapter.saveMenuConfig(JSON.stringify(menuData));

      const deleteResult = await adapter.deleteMenuConfig();

      expect(deleteResult.success).toBe(true);
      expect(deleteResult.source).toBe('file-based');

      const config = await adapter.getMenuConfig();
      expect(config).toBeNull();
    });

    it('should throw error when deleting non-existent config', async () => {
      await expect(adapter.deleteMenuConfig()).rejects.toThrow('not found');
    });

    it('should get all menu items as flat list', async () => {
      const menuData = [
        {
          label: 'Products',
          icon: 'pi pi-box',
          items: [
            { label: 'Product 1', to: '/products/1' },
            { label: 'Product 2', to: '/products/2' }
          ]
        },
        { label: 'Contact', icon: 'pi pi-envelope', to: '/contact' }
      ];

      await adapter.saveMenuConfig(JSON.stringify(menuData));

      const items = await adapter.getAllMenuItems();

      expect(Array.isArray(items)).toBe(true);
      expect(items.length).toBeGreaterThanOrEqual(4); // 1 parent + 2 children + 1 item
    });

    it('should get statistics', async () => {
      const menuData = [
        { label: 'Item 1', to: '/1' },
        { label: 'Item 2', to: '/2' },
        { label: 'Item 3', to: '/3' }
      ];

      await adapter.saveMenuConfig(JSON.stringify(menuData));

      const stats = await adapter.getStatistics();

      expect(stats.totalItems).toBe(3);
      expect(stats.rootItems).toBe(3);
      expect(stats.source).toBe('file-based');
      expect(stats.lastUpdated).toBeDefined();
    });

    it('should handle empty menu statistics', async () => {
      const stats = await adapter.getStatistics();

      expect(stats.totalItems).toBe(0);
      expect(stats.rootItems).toBe(0);
      expect(stats.lastUpdated).toBeNull();
    });

    it('should reject invalid JSON config', async () => {
      await expect(adapter.saveMenuConfig('invalid json {')).rejects.toThrow('Invalid configuration format');
    });

    it('should handle nested menu structures', async () => {
      const menuData = [
        {
          label: 'Level 1',
          items: [
            {
              label: 'Level 2',
              items: [
                { label: 'Level 3', to: '/level3' }
              ]
            }
          ]
        }
      ];

      await adapter.saveMenuConfig(JSON.stringify(menuData));

      const items = await adapter.getAllMenuItems();
      expect(items.length).toBe(3); // All three levels flattened
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      adapter = new MenuStorageAdapter(StorageEngineType.FILE_BASED);
    });

    it('should handle malformed JSON gracefully', async () => {
      await expect(adapter.saveMenuConfig('not valid json {')).rejects.toThrow();
    });

    it('should handle empty string config', async () => {
      await expect(adapter.saveMenuConfig('')).rejects.toThrow();
    });

    it('should handle null config', async () => {
      await expect(adapter.saveMenuConfig(null)).rejects.toThrow();
    });

    it('should provide meaningful error messages', async () => {
      try {
        await adapter.saveMenuConfig('invalid');
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).toContain('Invalid');
      }
    });
  });

  describe('Real-World Scenarios', () => {
    beforeEach(() => {
      adapter = new MenuStorageAdapter(StorageEngineType.FILE_BASED);
    });

    it('should handle complex menu structure with icons and badges', async () => {
      const menuData = [
        {
          label: 'Dashboard',
          icon: 'pi pi-home',
          to: '/dashboard',
          badge: '5'
        },
        {
          label: 'Products',
          icon: 'pi pi-box',
          items: [
            { label: 'Electronics', to: '/products/electronics', badge: '12' },
            { label: 'Clothing', to: '/products/clothing' },
            {
              label: 'Food',
              items: [
                { label: 'Fruits', to: '/products/food/fruits' },
                { label: 'Vegetables', to: '/products/food/vegetables' }
              ]
            }
          ]
        },
        {
          label: 'Settings',
          icon: 'pi pi-cog',
          to: '/settings'
        }
      ];

      await adapter.saveMenuConfig(JSON.stringify(menuData));

      const retrieved = await adapter.getMenuConfig();
      const parsed = JSON.parse(retrieved.config);

      expect(parsed).toHaveLength(3);
      expect(parsed[0].badge).toBe('5');
      expect(parsed[1].items).toHaveLength(3);
    });

    it('should handle menu updates (overwrite)', async () => {
      const menuData1 = [
        { label: 'Old Menu', to: '/old' }
      ];

      await adapter.saveMenuConfig(JSON.stringify(menuData1));

      const menuData2 = [
        { label: 'New Menu', to: '/new' },
        { label: 'Another Item', to: '/another' }
      ];

      await adapter.saveMenuConfig(JSON.stringify(menuData2));

      const retrieved = await adapter.getMenuConfig();
      const parsed = JSON.parse(retrieved.config);

      expect(parsed).toHaveLength(2);
      expect(parsed[0].label).toBe('New Menu');
    });

    it('should handle large menu structures', async () => {
      const menuData = [];

      // Generate 50 menu items
      for (let i = 1; i <= 50; i++) {
        menuData.push({
          label: `Item ${i}`,
          icon: 'pi pi-circle',
          to: `/item${i}`
        });
      }

      await adapter.saveMenuConfig(JSON.stringify(menuData));

      const items = await adapter.getAllMenuItems();
      expect(items.length).toBe(50);

      const stats = await adapter.getStatistics();
      expect(stats.totalItems).toBe(50);
    });
  });
});
