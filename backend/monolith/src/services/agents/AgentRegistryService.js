/**
 * Agent Registry Service
 *
 * Manages the registry of available agent templates/definitions.
 * Loads agent metadata from filesystem and provides search/filter capabilities.
 *
 * Issue #3112 - Phase 0: Infrastructure preparation
 *
 * Features:
 * - Load agent definitions from filesystem
 * - Cache agent metadata
 * - Search and filter agents
 * - Validate agent schemas
 * - Version management
 *
 * Agent Definition Structure:
 * {
 *   id: 'youtube-analytics',
 *   name: 'YouTube Analytics Agent',
 *   description: '...',
 *   icon: '📺',
 *   category: 'analytics',
 *   codeTemplate: '...', // JavaScript code as string
 *   tableSchemas: [...], // Array of table definitions
 *   configSchema: {...}, // JSON Schema for configuration
 *   dependencies: [],    // IDs of required agents
 *   version: '1.0.0'
 * }
 */

import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import { v4 as uuidv4 } from 'uuid'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Agent templates directory
const AGENTS_TEMPLATES_DIR = process.env.AGENTS_TEMPLATES_DIR ||
  path.join(__dirname, '../../agents/templates')

// Agent registry cache directory
const REGISTRY_CACHE_DIR = process.env.REGISTRY_CACHE_DIR ||
  path.join(__dirname, '../../../data/agent_registry')

/**
 * Agent Registry Service
 */
class AgentRegistryService {
  constructor({ logger } = {}) {
    this.logger = logger || console
    this.initialized = false
    this.agentCache = new Map() // In-memory cache of loaded agents
  }

  /**
   * Initialize the service
   */
  async initialize() {
    if (this.initialized) return

    try {
      // Ensure directories exist
      await fs.mkdir(AGENTS_TEMPLATES_DIR, { recursive: true })
      await fs.mkdir(REGISTRY_CACHE_DIR, { recursive: true })

      // Load all agent definitions
      await this.loadAllAgents()

      this.initialized = true
      this.logger.info(`[AgentRegistryService] Initialized successfully with ${this.agentCache.size} agents`)
    } catch (error) {
      this.logger.error('[AgentRegistryService] Initialization failed:', error)
      throw new Error(`Failed to initialize AgentRegistryService: ${error.message}`)
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
   * Load all agent definitions from filesystem
   */
  async loadAllAgents() {
    try {
      const files = await fs.readdir(AGENTS_TEMPLATES_DIR)

      for (const file of files) {
        if (!file.endsWith('.js') && !file.endsWith('.json')) continue

        try {
          const agentDef = await this.loadAgentDefinition(file)
          if (agentDef) {
            this.agentCache.set(agentDef.id, agentDef)
          }
        } catch (error) {
          this.logger.error(`[AgentRegistryService] Failed to load agent from ${file}:`, error)
        }
      }

      this.logger.info(`[AgentRegistryService] Loaded ${this.agentCache.size} agent definitions`)
    } catch (error) {
      this.logger.error('[AgentRegistryService] Failed to load agents:', error)
    }
  }

  /**
   * Load a single agent definition from file
   */
  async loadAgentDefinition(filename) {
    const filePath = path.join(AGENTS_TEMPLATES_DIR, filename)

    try {
      const content = await fs.readFile(filePath, 'utf-8')

      // If JSON file, parse directly
      if (filename.endsWith('.json')) {
        const agentDef = JSON.parse(content)
        return this.validateAgentDefinition(agentDef)
      }

      // If JS file, look for exported agent definition
      // For Phase 0, we'll use a simple JSON structure embedded in comments
      // In Phase 1, we can use dynamic imports for real JS modules
      const match = content.match(/\/\*\s*AGENT_DEFINITION\s*([\s\S]*?)\*\//);
      if (match) {
        const agentDef = JSON.parse(match[1])
        agentDef.codeTemplate = content // Store full code
        return this.validateAgentDefinition(agentDef)
      }

      this.logger.warn(`[AgentRegistryService] No AGENT_DEFINITION found in ${filename}`)
      return null
    } catch (error) {
      this.logger.error(`[AgentRegistryService] Error loading ${filename}:`, error)
      return null
    }
  }

  /**
   * Validate agent definition structure
   */
  validateAgentDefinition(agentDef) {
    if (!agentDef.id) {
      throw new Error('Agent definition must have an id')
    }

    if (!agentDef.name) {
      throw new Error('Agent definition must have a name')
    }

    // Set defaults
    agentDef.description = agentDef.description || ''
    agentDef.icon = agentDef.icon || '🤖'
    agentDef.category = agentDef.category || 'general'
    agentDef.version = agentDef.version || '1.0.0'
    agentDef.codeTemplate = agentDef.codeTemplate || '// No code template provided'
    agentDef.tableSchemas = agentDef.tableSchemas || []
    agentDef.configSchema = agentDef.configSchema || {}
    agentDef.dependencies = agentDef.dependencies || []
    agentDef.color = agentDef.color || null
    agentDef.tags = agentDef.tags || []
    agentDef.author = agentDef.author || 'DronDoc Team'
    agentDef.createdAt = agentDef.createdAt || new Date().toISOString()

    return agentDef
  }

  /**
   * List all agents with optional filtering
   */
  async listAgents({ category, search, tags } = {}) {
    await this.ensureInitialized()

    let agents = Array.from(this.agentCache.values())

    // Filter by category
    if (category) {
      agents = agents.filter(agent => agent.category === category)
    }

    // Filter by search term (name or description)
    if (search) {
      const searchLower = search.toLowerCase()
      agents = agents.filter(agent =>
        agent.name.toLowerCase().includes(searchLower) ||
        agent.description.toLowerCase().includes(searchLower)
      )
    }

    // Filter by tags
    if (tags && tags.length > 0) {
      agents = agents.filter(agent =>
        tags.some(tag => agent.tags.includes(tag))
      )
    }

    // Return summary (without code templates for performance)
    return agents.map(agent => ({
      id: agent.id,
      name: agent.name,
      description: agent.description,
      icon: agent.icon,
      category: agent.category,
      color: agent.color,
      version: agent.version,
      tags: agent.tags,
      author: agent.author,
      tableCount: agent.tableSchemas.length,
      hasDependencies: agent.dependencies.length > 0
    }))
  }

  /**
   * Get a specific agent definition by ID
   */
  async getAgent(agentId) {
    await this.ensureInitialized()

    const agent = this.agentCache.get(agentId)

    if (!agent) {
      throw new Error(`Agent not found: ${agentId}`)
    }

    return agent
  }

  /**
   * Get agent code template
   */
  async getAgentCodeTemplate(agentId) {
    await this.ensureInitialized()

    const agent = await this.getAgent(agentId)

    return {
      agentId: agent.id,
      agentName: agent.name,
      version: agent.version,
      codeTemplate: agent.codeTemplate
    }
  }

  /**
   * Get agent table schemas
   */
  async getAgentTableSchemas(agentId) {
    await this.ensureInitialized()

    const agent = await this.getAgent(agentId)

    return {
      agentId: agent.id,
      agentName: agent.name,
      tableSchemas: agent.tableSchemas
    }
  }

  /**
   * Get agent configuration schema
   */
  async getAgentConfigSchema(agentId) {
    await this.ensureInitialized()

    const agent = await this.getAgent(agentId)

    return {
      agentId: agent.id,
      agentName: agent.name,
      configSchema: agent.configSchema
    }
  }

  /**
   * Get agents by category
   */
  async getAgentsByCategory() {
    await this.ensureInitialized()

    const byCategory = {}

    for (const agent of this.agentCache.values()) {
      if (!byCategory[agent.category]) {
        byCategory[agent.category] = []
      }

      byCategory[agent.category].push({
        id: agent.id,
        name: agent.name,
        description: agent.description,
        icon: agent.icon,
        version: agent.version
      })
    }

    return byCategory
  }

  /**
   * Search agents
   */
  async searchAgents(query) {
    return this.listAgents({ search: query })
  }

  /**
   * Get agent statistics
   */
  async getRegistryStats() {
    await this.ensureInitialized()

    const categories = new Set()
    const tags = new Set()
    let totalTables = 0

    for (const agent of this.agentCache.values()) {
      categories.add(agent.category)
      agent.tags.forEach(tag => tags.add(tag))
      totalTables += agent.tableSchemas.length
    }

    return {
      totalAgents: this.agentCache.size,
      categories: Array.from(categories),
      categoryCount: categories.size,
      totalTags: tags.size,
      totalTables,
      averageTablesPerAgent: this.agentCache.size > 0 ?
        (totalTables / this.agentCache.size).toFixed(2) : 0
    }
  }

  /**
   * Validate if agent exists
   */
  async agentExists(agentId) {
    await this.ensureInitialized()
    return this.agentCache.has(agentId)
  }

  /**
   * Reload agents from filesystem (for development)
   */
  async reloadAgents() {
    this.agentCache.clear()
    await this.loadAllAgents()
    return { reloaded: true, count: this.agentCache.size }
  }

  /**
   * Register a new agent definition (for dynamic registration)
   */
  async registerAgent(agentDefinition) {
    await this.ensureInitialized()

    // Validate
    const validated = this.validateAgentDefinition(agentDefinition)

    // Check if already exists
    if (this.agentCache.has(validated.id)) {
      throw new Error(`Agent with ID ${validated.id} already exists`)
    }

    // Save to cache
    this.agentCache.set(validated.id, validated)

    // Persist to filesystem (as JSON for simplicity)
    const filename = `${validated.id}.json`
    const filePath = path.join(AGENTS_TEMPLATES_DIR, filename)

    await fs.writeFile(filePath, JSON.stringify(validated, null, 2), 'utf-8')

    this.logger.info(`[AgentRegistryService] Registered new agent: ${validated.id}`)

    return validated
  }

  /**
   * Update an existing agent definition
   */
  async updateAgent(agentId, updates) {
    await this.ensureInitialized()

    const agent = await this.getAgent(agentId)

    // Merge updates
    const updated = {
      ...agent,
      ...updates,
      id: agent.id, // Prevent ID change
      version: updates.version || agent.version
    }

    // Validate
    const validated = this.validateAgentDefinition(updated)

    // Update cache
    this.agentCache.set(agentId, validated)

    // Persist to filesystem
    const filename = `${agentId}.json`
    const filePath = path.join(AGENTS_TEMPLATES_DIR, filename)

    await fs.writeFile(filePath, JSON.stringify(validated, null, 2), 'utf-8')

    this.logger.info(`[AgentRegistryService] Updated agent: ${agentId}`)

    return validated
  }
}

export default AgentRegistryService
