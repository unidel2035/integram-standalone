/**
 * Custom Agent Service
 *
 * Manages custom agents created by users "on the fly"
 * - Create custom agents with code and UI
 * - Store agent definitions in Integram tables
 * - Deploy agent tables to organization DB
 * - Execute custom agent code with sandbox
 * - Manage agent versioning and history
 *
 * Database Schema:
 * - custom_agents: Agent metadata (name, description, category, creator)
 * - custom_agent_code: Agent logic (code, language, version)
 * - custom_agent_ui: Agent interface (Vue SFC as JSON, layout)
 * - custom_agent_config: Configuration schema (parameters, defaults)
 * - custom_agent_instances: Running instances (organization, config, status)
 * - custom_agent_execution_logs: Execution history (code, input, output, error)
 */

import { v4 as uuidv4 } from 'uuid'
import { IntegramClient } from '../integram/integram-client.js'
import AgentSandboxService from './AgentSandboxService.js'

/**
 * Custom Agent Service
 */
class CustomAgentService {
  constructor({ logger } = {}) {
    this.logger = logger || console
    this.initialized = false
    this.integramClient = null
    this.sandboxService = new AgentSandboxService({ logger })

    // Table IDs cache (loaded from Integram)
    this.tableIds = {
      customAgents: null,
      customAgentCode: null,
      customAgentUI: null,
      customAgentConfig: null,
      customAgentInstances: null,
      customAgentExecutionLogs: null
    }

    // Requisite IDs cache
    this.requisiteIds = {}
  }

  /**
   * Initialize the service and create/verify tables
   */
  async initialize() {
    if (this.initialized) return

    try {
      // Initialize Integram client
      this.integramClient = new IntegramClient({
        serverURL: 'https://dronedoc.ru',
        database: 'my',
        logger: this.logger
      })

      await this.integramClient.authenticate(
        process.env.INTEGRAM_SYSTEM_USERNAME || 'd',
        process.env.INTEGRAM_SYSTEM_PASSWORD || 'd'
      )

      // Create or verify all custom agent tables
      await this.ensureTablesExist()

      this.initialized = true
      this.logger.info('[CustomAgentService] Initialized successfully')
    } catch (error) {
      this.logger.error('[CustomAgentService] Initialization failed:', error)
      throw new Error(`Failed to initialize CustomAgentService: ${error.message}`)
    }
  }

  /**
   * Ensure service is initialized
   */
  async ensureInitialized() {
    if (!this.initialized) {
      await this.initialize()
    }
  }

  /**
   * Ensure all custom agent tables exist in Integram
   * Creates them if they don't exist
   */
  async ensureTablesExist() {
    this.logger.info('[CustomAgentService] Ensuring tables exist...')

    // Get existing tables
    const dictionary = await this.integramClient.getDictionary()
    const existingTables = new Map(dictionary.types?.map(t => [t.name, t.id]) || [])

    // Define table schemas
    const tableSchemas = [
      {
        name: 'custom_agents',
        requisites: [
          { alias: 'Название агента', requisiteTypeId: 3, allowNull: false },
          { alias: 'Описание', requisiteTypeId: 2, allowNull: true },
          { alias: 'Категория', requisiteTypeId: 3, allowNull: true },
          { alias: 'Версия', requisiteTypeId: 3, allowNull: true },
          { alias: 'Автор', requisiteTypeId: 3, allowNull: true },
          { alias: 'Дата создания', requisiteTypeId: 4, allowNull: true },
          { alias: 'Дата обновления', requisiteTypeId: 4, allowNull: true },
          { alias: 'Статус', requisiteTypeId: 3, allowNull: true },
          { alias: 'Иконка', requisiteTypeId: 3, allowNull: true },
          { alias: 'Теги', requisiteTypeId: 3, allowNull: true }
        ]
      },
      {
        name: 'custom_agent_code',
        requisites: [
          { alias: 'Агент', requisiteTypeId: null, allowNull: false }, // Reference will be set later
          { alias: 'Версия кода', requisiteTypeId: 13, allowNull: false },
          { alias: 'Язык программирования', requisiteTypeId: 3, allowNull: false },
          { alias: 'Исходный код', requisiteTypeId: 2, allowNull: false },
          { alias: 'Дата создания', requisiteTypeId: 4, allowNull: true },
          { alias: 'Автор изменения', requisiteTypeId: 3, allowNull: true },
          { alias: 'Комментарий коммита', requisiteTypeId: 2, allowNull: true },
          { alias: 'Статус валидации', requisiteTypeId: 3, allowNull: true }
        ]
      },
      {
        name: 'custom_agent_ui',
        requisites: [
          { alias: 'Агент', requisiteTypeId: null, allowNull: false }, // Reference to custom_agents
          { alias: 'Версия UI', requisiteTypeId: 13, allowNull: false },
          { alias: 'Тип интерфейса', requisiteTypeId: 3, allowNull: false }, // 'vue-sfc', 'json'
          { alias: 'HTML Шаблон', requisiteTypeId: 2, allowNull: false },
          { alias: 'JavaScript Скрипт', requisiteTypeId: 2, allowNull: true },
          { alias: 'CSS Стили', requisiteTypeId: 2, allowNull: true },
          { alias: 'Зависимые компоненты', requisiteTypeId: 3, allowNull: true },
          { alias: 'Дата создания', requisiteTypeId: 4, allowNull: true },
          { alias: 'Статус валидации', requisiteTypeId: 3, allowNull: true }
        ]
      },
      {
        name: 'custom_agent_config',
        requisites: [
          { alias: 'Агент', requisiteTypeId: null, allowNull: false }, // Reference to custom_agents
          { alias: 'JSON Схема', requisiteTypeId: 2, allowNull: false },
          { alias: 'Значения по умолчанию', requisiteTypeId: 2, allowNull: true },
          { alias: 'Версия конфига', requisiteTypeId: 13, allowNull: false },
          { alias: 'Дата обновления', requisiteTypeId: 4, allowNull: true }
        ]
      },
      {
        name: 'custom_agent_instances',
        requisites: [
          { alias: 'Агент', requisiteTypeId: null, allowNull: false }, // Reference to custom_agents
          { alias: 'Организация', requisiteTypeId: 3, allowNull: false },
          { alias: 'Имя инстанса', requisiteTypeId: 3, allowNull: false },
          { alias: 'Конфигурация', requisiteTypeId: 2, allowNull: true },
          { alias: 'Статус', requisiteTypeId: 3, allowNull: false }, // active, inactive, error
          { alias: 'Дата создания', requisiteTypeId: 4, allowNull: true },
          { alias: 'Дата последнего запуска', requisiteTypeId: 4, allowNull: true },
          { alias: 'Версия кода', requisiteTypeId: 13, allowNull: true },
          { alias: 'Версия UI', requisiteTypeId: 13, allowNull: true }
        ]
      },
      {
        name: 'custom_agent_execution_logs',
        requisites: [
          { alias: 'Инстанс агента', requisiteTypeId: null, allowNull: false }, // Reference to custom_agent_instances
          { alias: 'Время выполнения', requisiteTypeId: 4, allowNull: false },
          { alias: 'Входные данные', requisiteTypeId: 2, allowNull: true },
          { alias: 'Выходные данные', requisiteTypeId: 2, allowNull: true },
          { alias: 'Ошибка', requisiteTypeId: 2, allowNull: true },
          { alias: 'Статус', requisiteTypeId: 3, allowNull: false }, // success, error, timeout
          { alias: 'Время выполнения (мс)', requisiteTypeId: 13, allowNull: true },
          { alias: 'Логи выполнения', requisiteTypeId: 2, allowNull: true }
        ]
      }
    ]

    // Create tables if they don't exist
    for (const schema of tableSchemas) {
      if (!existingTables.has(schema.name)) {
        this.logger.info(`[CustomAgentService] Creating table: ${schema.name}`)

        const table = await this.integramClient.createTableWithColumns({
          tableName: schema.name,
          baseTypeId: 3,
          columns: schema.requisites.map(r => ({
            requisiteTypeId: r.requisiteTypeId,
            alias: r.alias,
            allowNull: r.allowNull
          }))
        })

        this.tableIds[this.camelCase(schema.name)] = table.typeId
        this.logger.info(`[CustomAgentService] Created table: ${schema.name} (ID: ${table.typeId})`)

        // Store requisite IDs
        if (table.columns) {
          const prefix = schema.name
          table.columns.forEach((col, idx) => {
            this.requisiteIds[`${prefix}_${idx}`] = col.requisiteId
          })
        }
      } else {
        this.tableIds[this.camelCase(schema.name)] = existingTables.get(schema.name)
        this.logger.info(`[CustomAgentService] Table exists: ${schema.name}`)
      }
    }
  }

  /**
   * Create a new custom agent
   */
  async createAgent({
    organizationId,
    name,
    description = '',
    category = 'custom',
    icon = '🤖',
    tags = [],
    createdBy = 'system'
  }) {
    await this.ensureInitialized()

    const agentId = uuidv4()
    const now = new Date().toISOString()

    try {
      // Create agent record in custom_agents table
      const agentObject = await this.integramClient.createObject({
        typeId: this.tableIds.customAgents,
        value: name,
        requisites: {
          [this.requisiteIds['custom_agents_0']]: name, // Название агента
          [this.requisiteIds['custom_agents_1']]: description, // Описание
          [this.requisiteIds['custom_agents_2']]: category, // Категория
          [this.requisiteIds['custom_agents_3']]: '0.0.1', // Версия
          [this.requisiteIds['custom_agents_4']]: createdBy, // Автор
          [this.requisiteIds['custom_agents_5']]: now, // Дата создания
          [this.requisiteIds['custom_agents_6']]: now, // Дата обновления
          [this.requisiteIds['custom_agents_7']]: 'draft', // Статус
          [this.requisiteIds['custom_agents_8']]: icon, // Иконка
          [this.requisiteIds['custom_agents_9']]: tags.join(',') // Теги
        }
      })

      this.logger.info(`[CustomAgentService] Created agent: ${name} (ID: ${agentObject.id})`)

      return {
        agentId: agentObject.id,
        name,
        description,
        category,
        icon,
        tags,
        version: '0.0.1',
        status: 'draft',
        createdAt: now,
        createdBy
      }
    } catch (error) {
      this.logger.error(`[CustomAgentService] Failed to create agent: ${name}`, error)
      throw error
    }
  }

  /**
   * Save agent code
   */
  async saveAgentCode({
    organizationId,
    agentId,
    code,
    language = 'javascript',
    commitMessage = 'Code update',
    authorId = 'system'
  }) {
    await this.ensureInitialized()

    try {
      // Validate code in sandbox
      const validationResult = await this.sandboxService.executeCode(code, {
        timeout: 5000,
        testInputs: {}
      })

      if (!validationResult.success) {
        throw new Error(`Code validation failed: ${validationResult.error?.message}`)
      }

      // Get latest code version
      const latestCode = await this.integramClient.getObjectList({
        typeId: this.tableIds.customAgentCode,
        params: { offset: 0, limit: 1 }
      })

      const nextVersion = latestCode.objects?.length > 0
        ? (parseInt(latestCode.objects[0].reqs?.[this.requisiteIds['custom_agent_code_1']]) || 0) + 1
        : 1

      // Create code version
      const codeObject = await this.integramClient.createObject({
        typeId: this.tableIds.customAgentCode,
        value: `${agentId}_v${nextVersion}`,
        requisites: {
          [this.requisiteIds['custom_agent_code_0']]: agentId, // Агент
          [this.requisiteIds['custom_agent_code_1']]: nextVersion.toString(), // Версия кода
          [this.requisiteIds['custom_agent_code_2']]: language, // Язык
          [this.requisiteIds['custom_agent_code_3']]: code, // Исходный код
          [this.requisiteIds['custom_agent_code_4']]: new Date().toISOString(), // Дата
          [this.requisiteIds['custom_agent_code_5']]: authorId, // Автор
          [this.requisiteIds['custom_agent_code_6']]: commitMessage, // Комментарий
          [this.requisiteIds['custom_agent_code_7']]: 'validated' // Статус валидации
        }
      })

      this.logger.info(`[CustomAgentService] Saved code for agent ${agentId} (v${nextVersion})`)

      return {
        codeId: codeObject.id,
        version: nextVersion,
        language,
        status: 'validated'
      }
    } catch (error) {
      this.logger.error(`[CustomAgentService] Failed to save agent code`, error)
      throw error
    }
  }

  /**
   * Save agent UI (Vue component as JSON structure)
   */
  async saveAgentUI({
    organizationId,
    agentId,
    uiDefinition,
    componentDependencies = []
  }) {
    await this.ensureInitialized()

    try {
      // Validate UI definition structure
      if (!uiDefinition.template) {
        throw new Error('UI definition must have a template')
      }

      // Get latest UI version
      const latestUI = await this.integramClient.getObjectList({
        typeId: this.tableIds.customAgentUI,
        params: { offset: 0, limit: 1 }
      })

      const nextVersion = latestUI.objects?.length > 0
        ? (parseInt(latestUI.objects[0].reqs?.[this.requisiteIds['custom_agent_ui_1']]) || 0) + 1
        : 1

      // Create UI version
      const uiObject = await this.integramClient.createObject({
        typeId: this.tableIds.customAgentUI,
        value: `${agentId}_ui_v${nextVersion}`,
        requisites: {
          [this.requisiteIds['custom_agent_ui_0']]: agentId, // Агент
          [this.requisiteIds['custom_agent_ui_1']]: nextVersion.toString(), // Версия UI
          [this.requisiteIds['custom_agent_ui_2']]: 'vue-sfc', // Тип интерфейса
          [this.requisiteIds['custom_agent_ui_3']]: uiDefinition.template, // HTML Шаблон
          [this.requisiteIds['custom_agent_ui_4']]: uiDefinition.script || '', // JS Скрипт
          [this.requisiteIds['custom_agent_ui_5']]: uiDefinition.style || '', // CSS Стили
          [this.requisiteIds['custom_agent_ui_6']]: componentDependencies.join(','), // Зависимости
          [this.requisiteIds['custom_agent_ui_7']]: new Date().toISOString(), // Дата
          [this.requisiteIds['custom_agent_ui_8']]: 'validated' // Статус валидации
        }
      })

      this.logger.info(`[CustomAgentService] Saved UI for agent ${agentId} (v${nextVersion})`)

      return {
        uiId: uiObject.id,
        version: nextVersion,
        interfaceType: 'vue-sfc',
        dependencies: componentDependencies
      }
    } catch (error) {
      this.logger.error(`[CustomAgentService] Failed to save agent UI`, error)
      throw error
    }
  }

  /**
   * Save agent configuration schema
   */
  async saveAgentConfig({
    organizationId,
    agentId,
    configSchema,
    defaults = {}
  }) {
    await this.ensureInitialized()

    try {
      // Validate config schema
      if (!configSchema.properties) {
        throw new Error('Config schema must have properties')
      }

      // Get latest config version
      const latestConfig = await this.integramClient.getObjectList({
        typeId: this.tableIds.customAgentConfig,
        params: { offset: 0, limit: 1 }
      })

      const nextVersion = latestConfig.objects?.length > 0
        ? (parseInt(latestConfig.objects[0].reqs?.[this.requisiteIds['custom_agent_config_3']]) || 0) + 1
        : 1

      // Create config
      const configObject = await this.integramClient.createObject({
        typeId: this.tableIds.customAgentConfig,
        value: `${agentId}_config_v${nextVersion}`,
        requisites: {
          [this.requisiteIds['custom_agent_config_0']]: agentId, // Агент
          [this.requisiteIds['custom_agent_config_1']]: JSON.stringify(configSchema), // JSON Схема
          [this.requisiteIds['custom_agent_config_2']]: JSON.stringify(defaults), // Значения по умолчанию
          [this.requisiteIds['custom_agent_config_3']]: nextVersion.toString(), // Версия
          [this.requisiteIds['custom_agent_config_4']]: new Date().toISOString() // Дата обновления
        }
      })

      this.logger.info(`[CustomAgentService] Saved config for agent ${agentId}`)

      return {
        configId: configObject.id,
        version: nextVersion,
        schema: configSchema,
        defaults
      }
    } catch (error) {
      this.logger.error(`[CustomAgentService] Failed to save agent config`, error)
      throw error
    }
  }

  /**
   * Create instance of custom agent
   */
  async createInstance({
    organizationId,
    agentId,
    instanceName,
    config = {},
    status = 'active'
  }) {
    await this.ensureInitialized()

    try {
      // Create instance record
      const instanceObject = await this.integramClient.createObject({
        typeId: this.tableIds.customAgentInstances,
        value: instanceName,
        requisites: {
          [this.requisiteIds['custom_agent_instances_0']]: agentId, // Агент
          [this.requisiteIds['custom_agent_instances_1']]: organizationId, // Организация
          [this.requisiteIds['custom_agent_instances_2']]: instanceName, // Имя инстанса
          [this.requisiteIds['custom_agent_instances_3']]: JSON.stringify(config), // Конфигурация
          [this.requisiteIds['custom_agent_instances_4']]: status, // Статус
          [this.requisiteIds['custom_agent_instances_5']]: new Date().toISOString(), // Дата создания
          [this.requisiteIds['custom_agent_instances_6']]: new Date().toISOString() // Последний запуск
        }
      })

      this.logger.info(`[CustomAgentService] Created instance: ${instanceName}`)

      return {
        instanceId: instanceObject.id,
        agentId,
        instanceName,
        organizationId,
        config,
        status,
        createdAt: new Date().toISOString()
      }
    } catch (error) {
      this.logger.error(`[CustomAgentService] Failed to create instance`, error)
      throw error
    }
  }

  /**
   * Execute custom agent instance
   */
  async executeInstance({
    organizationId,
    instanceId,
    agentId,
    code,
    inputs = {}
  }) {
    await this.ensureInitialized()

    try {
      const startTime = Date.now()

      // Execute code in sandbox
      const executionResult = await this.sandboxService.executeCode(code, {
        timeout: 30000,
        testInputs: inputs
      })

      const executionTime = Date.now() - startTime

      // Log execution
      await this.integramClient.createObject({
        typeId: this.tableIds.customAgentExecutionLogs,
        value: `exec_${instanceId}_${Date.now()}`,
        requisites: {
          [this.requisiteIds['custom_agent_execution_logs_0']]: instanceId, // Инстанс
          [this.requisiteIds['custom_agent_execution_logs_1']]: new Date().toISOString(), // Время
          [this.requisiteIds['custom_agent_execution_logs_2']]: JSON.stringify(inputs), // Входные данные
          [this.requisiteIds['custom_agent_execution_logs_3']]: JSON.stringify(executionResult.result), // Выход
          [this.requisiteIds['custom_agent_execution_logs_4']]: executionResult.error ? JSON.stringify(executionResult.error) : null, // Ошибка
          [this.requisiteIds['custom_agent_execution_logs_5']]: executionResult.success ? 'success' : 'error', // Статус
          [this.requisiteIds['custom_agent_execution_logs_6']]: executionTime.toString(), // Время выполнения
          [this.requisiteIds['custom_agent_execution_logs_7']]: executionResult.logs.join('\n') // Логи
        }
      })

      this.logger.info(`[CustomAgentService] Execution completed (${executionTime}ms)`)

      return {
        success: executionResult.success,
        result: executionResult.result,
        error: executionResult.error,
        executionTime,
        logs: executionResult.logs
      }
    } catch (error) {
      this.logger.error(`[CustomAgentService] Execution failed`, error)
      throw error
    }
  }

  /**
   * Get agent definition
   */
  async getAgent({ organizationId, agentId }) {
    await this.ensureInitialized()

    try {
      const agentData = await this.integramClient.getObjectEditData({ objectId: agentId })

      return {
        agentId,
        name: agentData.obj?.val || '',
        description: agentData.reqs?.[this.requisiteIds['custom_agents_1']] || '',
        category: agentData.reqs?.[this.requisiteIds['custom_agents_2']] || '',
        version: agentData.reqs?.[this.requisiteIds['custom_agents_3']] || '0.0.1',
        status: agentData.reqs?.[this.requisiteIds['custom_agents_7']] || 'draft'
      }
    } catch (error) {
      this.logger.error(`[CustomAgentService] Failed to get agent`, error)
      throw error
    }
  }

  /**
   * List all custom agents in organization
   */
  async listAgents({ organizationId }) {
    await this.ensureInitialized()

    try {
      const agents = await this.integramClient.getObjectList({
        typeId: this.tableIds.customAgents,
        params: { offset: 0, limit: 100 }
      })

      return agents.objects?.map(obj => ({
        agentId: obj.id,
        name: obj.val,
        description: obj.reqs?.[this.requisiteIds['custom_agents_1']] || '',
        category: obj.reqs?.[this.requisiteIds['custom_agents_2']] || '',
        version: obj.reqs?.[this.requisiteIds['custom_agents_3']] || '0.0.1',
        status: obj.reqs?.[this.requisiteIds['custom_agents_7']] || 'draft'
      })) || []
    } catch (error) {
      this.logger.error(`[CustomAgentService] Failed to list agents`, error)
      throw error
    }
  }

  /**
   * Helper: convert snake_case to camelCase
   */
  camelCase(str) {
    return str.replace(/_([a-z])/g, (g) => g[1].toUpperCase())
  }
}

export default CustomAgentService
