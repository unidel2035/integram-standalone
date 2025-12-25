/**
 * Unified Interface Service
 *
 * Issue #3559 - Управление единым интерфейсом
 *
 * Provides centralized management for all organization interface components:
 * - Sidebar menu (БоковоеМеню)
 * - Pages and documents (Страницы)
 * - Agent instances (АгентыОрганизации)
 * - UI settings (НастройкиИнтерфейса)
 * - Organization templates (ШаблоныОрганизации)
 *
 * Uses Integram MCP for unified data storage.
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const INTEGRAM_CONFIG = {
  serverURL: process.env.INTEGRAM_SERVER_URL || 'https://dronedoc.ru',
  database: process.env.INTEGRAM_DATABASE || 'a2025'
};

// Table IDs (will be configured after table creation)
const TABLE_IDS = {
  SIDEBAR_MENU: 2385,           // БоковоеМеню (existing)
  PAGES: null,                   // Страницы (to be set)
  ORG_AGENTS: null,             // АгентыОрганизации (to be set)
  UI_SETTINGS: null,            // НастройкиИнтерфейса (to be set)
  TEMPLATES: null                // ШаблоныОрганизации (to be set)
};

/**
 * Unified Interface Service
 */
class UnifiedInterfaceService {
  constructor() {
    this.initialized = false;
    this.mcpClient = null;
    this.mcpTransport = null;
  }

  /**
   * Initialize the service
   */
  async initialize() {
    if (this.initialized) return;

    try {
      // Initialize MCP client
      const serverScriptPath = path.join(__dirname, '../../services/mcp/integram-server.js');

      this.mcpTransport = new StdioClientTransport({
        command: 'node',
        args: [serverScriptPath],
      });

      this.mcpClient = new Client(
        { name: 'unified-interface-service', version: '1.0.0' },
        { capabilities: { tools: {} } }
      );

      await this.mcpClient.connect(this.mcpTransport);

      // Authenticate
      await this.authenticate();

      // Detect table IDs
      await this.detectTableIds();

      this.initialized = true;
      console.log('[UnifiedInterfaceService] Initialized successfully');
    } catch (error) {
      console.error('[UnifiedInterfaceService] Initialization failed:', error);
      throw new Error(`Failed to initialize UnifiedInterfaceService: ${error.message}`);
    }
  }

  /**
   * Ensure service is initialized
   */
  async ensureInitialized() {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  /**
   * Authenticate with Integram
   */
  async authenticate() {
    const authResult = await this.mcpClient.callTool({
      name: 'integram_authenticate',
      arguments: {
        serverURL: INTEGRAM_CONFIG.serverURL,
        database: INTEGRAM_CONFIG.database,
        login: process.env.INTEGRAM_LOGIN || 'd',
        password: process.env.INTEGRAM_PASSWORD || 'd'
      }
    });

    const authData = JSON.parse(authResult.content[0].text);
    if (!authData.success) {
      throw new Error('Integram authentication failed');
    }
  }

  /**
   * Detect table IDs by name
   */
  async detectTableIds() {
    const dictResult = await this.mcpClient.callTool({
      name: 'integram_get_dictionary',
      arguments: {}
    });

    const dict = JSON.parse(dictResult.content[0].text);
    const types = dict.types || [];

    // Find table IDs by name
    for (const type of types) {
      if (type.name === 'Страницы') {
        TABLE_IDS.PAGES = type.id;
      } else if (type.name === 'АгентыОрганизации') {
        TABLE_IDS.ORG_AGENTS = type.id;
      } else if (type.name === 'НастройкиИнтерфейса') {
        TABLE_IDS.UI_SETTINGS = type.id;
      } else if (type.name === 'ШаблоныОрганизации') {
        TABLE_IDS.TEMPLATES = type.id;
      }
    }

    console.log('[UnifiedInterfaceService] Detected table IDs:', TABLE_IDS);
  }

  /**
   * Get complete organization interface configuration
   */
  async getOrganizationInterface(organizationId) {
    await this.ensureInitialized();

    const [menu, pages, agents, settings] = await Promise.all([
      this.getMenu(organizationId),
      this.getPages(organizationId),
      this.getAgentInstances(organizationId),
      this.getUISettings(organizationId)
    ]);

    return {
      organizationId,
      menu,
      pages,
      agents,
      settings
    };
  }

  /**
   * Get sidebar menu for organization
   */
  async getMenu(organizationId) {
    await this.ensureInitialized();

    const result = await this.mcpClient.callTool({
      name: 'integram_get_object_list',
      arguments: {
        typeId: TABLE_IDS.SIDEBAR_MENU,
        params: {
          offset: 0,
          limit: 1000
        }
      }
    });

    const data = JSON.parse(result.content[0].text);
    return this.transformMenuItems(data.objects || []);
  }

  /**
   * Transform menu items from Integram format to application format
   */
  transformMenuItems(items) {
    return items.map(item => ({
      id: item.id,
      name: item.requisites?.['Название'] || item.value,
      route: item.requisites?.['Маршрут'] || '/',
      icon: item.requisites?.['Иконка'] || '📄',
      order: parseInt(item.requisites?.['Порядок']) || 0,
      parentId: item.requisites?.['РодительМеню'] || null,
      visibleForRole: item.requisites?.['ВидимостьДляРоли'] || 'all',
      active: item.requisites?.['Активно'] !== false
    })).sort((a, b) => a.order - b.order);
  }

  /**
   * Update sidebar menu
   */
  async updateMenu(organizationId, menuItems) {
    await this.ensureInitialized();

    // Delete all existing menu items
    const existingMenu = await this.getMenu(organizationId);
    for (const item of existingMenu) {
      await this.mcpClient.callTool({
        name: 'integram_delete_object',
        arguments: { objectId: item.id }
      });
    }

    // Create new menu items
    const created = [];
    for (const item of menuItems) {
      const result = await this.mcpClient.callTool({
        name: 'integram_create_object',
        arguments: {
          typeId: TABLE_IDS.SIDEBAR_MENU,
          value: item.name,
          requisites: {
            'Название': item.name,
            'Маршрут': item.route || '/',
            'Иконка': item.icon || '📄',
            'Порядок': item.order.toString(),
            'РодительМеню': item.parentId || null,
            'ВидимостьДляРоли': item.visibleForRole || 'all',
            'Активно': item.active !== false ? 'true' : 'false'
          }
        }
      });

      const data = JSON.parse(result.content[0].text);
      created.push(data);
    }

    return { success: true, itemsCreated: created.length };
  }

  /**
   * Get pages for organization
   */
  async getPages(organizationId) {
    await this.ensureInitialized();

    if (!TABLE_IDS.PAGES) {
      return [];
    }

    const result = await this.mcpClient.callTool({
      name: 'integram_get_object_list',
      arguments: {
        typeId: TABLE_IDS.PAGES,
        params: {
          offset: 0,
          limit: 1000
        }
      }
    });

    const data = JSON.parse(result.content[0].text);
    return this.transformPages(data.objects || []);
  }

  /**
   * Transform pages from Integram format to application format
   */
  transformPages(pages) {
    return pages.map(page => ({
      id: page.id,
      title: page.requisites?.['Название'] || page.value,
      route: page.requisites?.['Маршрут'] || '/',
      content: page.requisites?.['Содержание'] || '',
      type: page.requisites?.['Тип'] || 'document',
      icon: page.requisites?.['Иконка'] || '📄',
      cover: page.requisites?.['Обложка'] || null,
      createdAt: page.requisites?.['ДатаСоздания'] || null,
      updatedAt: page.requisites?.['ДатаИзменения'] || null,
      authorId: parseInt(page.requisites?.['Автор']) || null,
      published: page.requisites?.['Опубликовано'] !== false
    }));
  }

  /**
   * Create new page
   */
  async createPage(organizationId, pageData) {
    await this.ensureInitialized();

    if (!TABLE_IDS.PAGES) {
      throw new Error('Pages table not configured');
    }

    const result = await this.mcpClient.callTool({
      name: 'integram_create_object',
      arguments: {
        typeId: TABLE_IDS.PAGES,
        value: pageData.title,
        requisites: {
          'Название': pageData.title,
          'Маршрут': pageData.route,
          'Содержание': pageData.content || '',
          'Тип': pageData.type || 'document',
          'Иконка': pageData.icon || '📄',
          'Обложка': pageData.cover || null,
          'ДатаСоздания': new Date().toISOString(),
          'ДатаИзменения': new Date().toISOString(),
          'Автор': pageData.authorId?.toString() || '0',
          'Опубликовано': pageData.published !== false ? 'true' : 'false'
        }
      }
    });

    const data = JSON.parse(result.content[0].text);
    return { success: true, pageId: data.id };
  }

  /**
   * Get agent instances for organization
   */
  async getAgentInstances(organizationId) {
    await this.ensureInitialized();

    if (!TABLE_IDS.ORG_AGENTS) {
      return [];
    }

    const result = await this.mcpClient.callTool({
      name: 'integram_get_object_list',
      arguments: {
        typeId: TABLE_IDS.ORG_AGENTS,
        params: {
          offset: 0,
          limit: 1000
        }
      }
    });

    const data = JSON.parse(result.content[0].text);
    return this.transformAgents(data.objects || []);
  }

  /**
   * Transform agents from Integram format to application format
   */
  transformAgents(agents) {
    return agents.map(agent => ({
      id: agent.id,
      name: agent.requisites?.['Название'] || agent.value,
      templateId: agent.requisites?.['ШаблонАгента'] || null,
      config: JSON.parse(agent.requisites?.['Конфигурация'] || '{}'),
      status: agent.requisites?.['Статус'] || 'active',
      createdAt: agent.requisites?.['ДатаСоздания'] || null,
      ownerId: parseInt(agent.requisites?.['Владелец']) || null
    }));
  }

  /**
   * Get UI settings for organization
   */
  async getUISettings(organizationId) {
    await this.ensureInitialized();

    if (!TABLE_IDS.UI_SETTINGS) {
      return {};
    }

    const result = await this.mcpClient.callTool({
      name: 'integram_get_object_list',
      arguments: {
        typeId: TABLE_IDS.UI_SETTINGS,
        params: {
          offset: 0,
          limit: 1000
        }
      }
    });

    const data = JSON.parse(result.content[0].text);
    return this.transformSettings(data.objects || []);
  }

  /**
   * Transform settings from Integram format to key-value object
   */
  transformSettings(settings) {
    const result = {};
    for (const setting of settings) {
      const key = setting.requisites?.['Ключ'] || setting.value;
      const value = setting.requisites?.['Значение'];
      const type = setting.requisites?.['Тип'];

      // Parse value based on type
      if (type === 'json') {
        result[key] = JSON.parse(value || '{}');
      } else if (type === 'number') {
        result[key] = parseFloat(value);
      } else if (type === 'boolean') {
        result[key] = value === 'true';
      } else {
        result[key] = value;
      }
    }
    return result;
  }

  /**
   * Apply organization template
   */
  async applyTemplate(organizationId, templateId) {
    await this.ensureInitialized();

    if (!TABLE_IDS.TEMPLATES) {
      throw new Error('Templates table not configured');
    }

    // Get template
    const templateResult = await this.mcpClient.callTool({
      name: 'integram_get_object_edit_data',
      arguments: { objectId: templateId }
    });

    const template = JSON.parse(templateResult.content[0].text);

    // Parse template components
    const menu = JSON.parse(template.requisites?.['Меню'] || '[]');
    const pages = JSON.parse(template.requisites?.['Страницы'] || '[]');
    const agents = JSON.parse(template.requisites?.['Агенты'] || '[]');
    const settings = JSON.parse(template.requisites?.['Настройки'] || '{}');

    // Apply components
    const results = {
      menuItems: 0,
      pages: 0,
      agents: 0,
      settings: 0
    };

    // Apply menu
    if (menu.length > 0) {
      await this.updateMenu(organizationId, menu);
      results.menuItems = menu.length;
    }

    // Apply pages
    for (const page of pages) {
      await this.createPage(organizationId, page);
      results.pages++;
    }

    // Apply settings
    for (const [key, value] of Object.entries(settings)) {
      await this.updateUISetting(organizationId, key, value);
      results.settings++;
    }

    return { success: true, itemsCreated: results };
  }

  /**
   * Update a UI setting
   */
  async updateUISetting(organizationId, key, value) {
    await this.ensureInitialized();

    if (!TABLE_IDS.UI_SETTINGS) {
      throw new Error('UI Settings table not configured');
    }

    // Determine type
    let type = 'string';
    let strValue = value;

    if (typeof value === 'object') {
      type = 'json';
      strValue = JSON.stringify(value);
    } else if (typeof value === 'number') {
      type = 'number';
      strValue = value.toString();
    } else if (typeof value === 'boolean') {
      type = 'boolean';
      strValue = value ? 'true' : 'false';
    }

    // Create or update setting
    await this.mcpClient.callTool({
      name: 'integram_create_object',
      arguments: {
        typeId: TABLE_IDS.UI_SETTINGS,
        value: key,
        requisites: {
          'Ключ': key,
          'Значение': strValue,
          'Тип': type,
          'ДатаИзменения': new Date().toISOString()
        }
      }
    });

    return { success: true };
  }

  /**
   * Export organization configuration as template
   */
  async exportConfiguration(organizationId) {
    await this.ensureInitialized();

    const config = await this.getOrganizationInterface(organizationId);

    return {
      menu: config.menu,
      pages: config.pages,
      agents: config.agents,
      settings: config.settings
    };
  }

  /**
   * Cleanup
   */
  async cleanup() {
    if (this.mcpClient) {
      await this.mcpClient.close();
    }
    this.initialized = false;
  }
}

export default UnifiedInterfaceService;
