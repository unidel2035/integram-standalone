/**
 * GlobalAgentRegistry - Unified registry for ALL agent types
 *
 * This registry unifies three previously parallel systems:
 * 1. AgentRegistry (orchestration) - capability-based execution
 * 2. UnifiedAgentRegistry (core) - 5 agent types with routing
 * 3. ProductionAgentBridge (bridge) - keyword-based triggers
 *
 * Key Features:
 * - Loads agents from Integram database (table 220847)
 * - Supports all agent types: PRODUCTION, GOAL_ORIENTED, CUSTOM, GENESIS, TEMPLATE, WORKSPACE
 * - Keyword-based trigger matching
 * - Capability-based agent search
 * - Automatic database synchronization (every 5 minutes)
 * - Agent execution with statistics tracking
 * - Event-driven monitoring
 *
 * Database Integration:
 * - Automatically loads 148+ production agents from ai2o.ru/my table 220847
 * - Auto-syncs every 5 minutes to reflect database changes
 * - Transforms database format to unified GlobalAgentEntry format
 *
 * Issue #5632 - Unify agent architecture (merge 3 parallel systems)
 *
 * @example
 * import { globalAgentRegistry } from './GlobalAgentRegistry.js'
 *
 * // Initialize and load agents from database
 * await globalAgentRegistry.initialize()
 *
 * // Find agent by capability
 * const agents = globalAgentRegistry.findByCapability('order_processing')
 *
 * // Find agent by keyword
 * const agent = globalAgentRegistry.findByKeyword('invoice')
 *
 * // Execute agent
 * const result = await globalAgentRegistry.execute('OrderProcessor', { orderId: 123 })
 */

import EventEmitter from 'events';
import logger from '../../utils/logger.js';
import AgentService from '../../services/AgentService.js';

/**
 * Agent Types in the unified system
 */
export const AgentType = {
  PRODUCTION: 'production',      // Production agents from database (148+ agents)
  GOAL_ORIENTED: 'goalOriented', // Autonomous goal-oriented agents
  CUSTOM: 'custom',              // Custom user-defined agents
  GENESIS: 'genesis',            // Genesis/specialized agents
  TEMPLATE: 'template',          // Template-based agents
  WORKSPACE: 'workspace'         // Workspace-specific agents (5 types)
};

/**
 * Unified Agent Entry
 * Combines features from:
 * - UnifiedAgentEntry (core registry)
 * - ProductionAgentConfig (keyword triggers)
 * - AgentMetadata (orchestration)
 */
export class GlobalAgentEntry {
  constructor(options = {}) {
    this.id = options.id || this.generateId();
    this.name = options.name || 'Unknown Agent';
    this.type = options.type || AgentType.CUSTOM;
    this.capabilities = options.capabilities || [];
    this.priority = options.priority || 5;
    this.status = options.status || 'active'; // active, inactive, error
    this.metadata = options.metadata || {};

    // Agent instance or configuration
    this.agent = options.agent || null;
    this.agentClass = options.agentClass || null;

    // Keyword triggers (from ProductionAgentBridge)
    this.triggers = options.triggers || [];
    this.keywords = this._extractKeywords(this.triggers);

    // Execution schemas (from AgentRegistry)
    this.inputSchema = options.inputSchema || {};
    this.outputSchema = options.outputSchema || {};
    this.canCallAgents = options.canCallAgents || [];
    this.isAsync = options.isAsync !== false;

    // Statistics
    this.stats = {
      totalInvocations: 0,
      successfulInvocations: 0,
      failedInvocations: 0,
      lastInvokedAt: null,
      averageExecutionTime: 0
    };

    this.registeredAt = Date.now();
  }

  generateId() {
    return `agent_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Extract all keywords from triggers
   * @private
   */
  _extractKeywords(triggers) {
    const keywords = [];
    for (const trigger of triggers) {
      if (trigger.keywords) {
        const kws = Array.isArray(trigger.keywords) ? trigger.keywords : [trigger.keywords];
        keywords.push(...kws);
      }
    }
    return keywords;
  }

  /**
   * Check if agent has capability
   */
  hasCapability(capability) {
    return this.capabilities.includes(capability);
  }

  /**
   * Check if agent matches keyword
   */
  matchesKeyword(keyword) {
    if (!keyword || this.keywords.length === 0) {
      return false;
    }

    const normalizedKeyword = keyword.toLowerCase();

    return this.keywords.some(kw => {
      const normalizedKw = kw.toLowerCase();
      return normalizedKw.includes(normalizedKeyword) || normalizedKeyword.includes(normalizedKw);
    });
  }

  /**
   * Record agent invocation
   */
  recordInvocation(success = true, executionTime = 0) {
    this.stats.totalInvocations++;
    this.stats.lastInvokedAt = Date.now();

    if (success) {
      this.stats.successfulInvocations++;
    } else {
      this.stats.failedInvocations++;
    }

    // Update average execution time
    const total = this.stats.totalInvocations;
    const current = this.stats.averageExecutionTime;
    this.stats.averageExecutionTime = ((current * (total - 1)) + executionTime) / total;
  }

  /**
   * Get entry summary
   */
  getSummary() {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      capabilities: this.capabilities,
      priority: this.priority,
      status: this.status,
      keywords: this.keywords,
      stats: this.stats,
      registeredAt: this.registeredAt
    };
  }
}

/**
 * GlobalAgentRegistry - Central unified registry for all agents
 *
 * Merges functionality from:
 * 1. AgentRegistry (orchestration/AgentRegistry.js)
 * 2. UnifiedAgentRegistry (core/UnifiedAgentRegistry.js)
 * 3. ProductionAgentBridge (bridge/ProductionAgentBridge.js)
 */
export class GlobalAgentRegistry extends EventEmitter {
  constructor(options = {}) {
    super();

    // Agents storage (combining all 3 systems)
    this.agents = new Map(); // id -> GlobalAgentEntry
    this.agentsByName = new Map(); // name -> GlobalAgentEntry
    this.agentsByType = new Map(); // type -> Set<id>
    this.agentsByCapability = new Map(); // capability -> Set<id>
    this.keywordIndex = new Map(); // keyword (lowercase) -> Set<id>

    // Services
    this.agentService = options.agentService || new AgentService({ logger });

    // Configuration
    this.maxAgents = options.maxAgents || 10000;
    this.syncInterval = options.syncInterval || 300000; // 5 minutes
    this.autoSync = options.autoSync !== false;
    this.loadFromDatabase = options.loadFromDatabase !== false;

    // Routing strategy (from UnifiedAgentRegistry)
    this.routingStrategy = options.routingStrategy || 'capability_priority';

    // Statistics
    this.stats = {
      totalRegistered: 0,
      byType: {},
      totalRouted: 0,
      successfulRoutes: 0,
      failedRoutes: 0,
      lastSyncTime: null,
      syncCount: 0
    };

    // Initialize type sets
    for (const type of Object.values(AgentType)) {
      this.agentsByType.set(type, new Set());
      this.stats.byType[type] = 0;
    }

    this.initialized = false;
    this.syncTimer = null;

    logger.info('[GlobalAgentRegistry] Created', {
      maxAgents: this.maxAgents,
      syncInterval: this.syncInterval,
      autoSync: this.autoSync,
      loadFromDatabase: this.loadFromDatabase
    });
  }

  /**
   * Initialize registry and load agents from database
   */
  async initialize() {
    if (this.initialized) {
      logger.warn('[GlobalAgentRegistry] Already initialized');
      return;
    }

    try {
      logger.info('[GlobalAgentRegistry] Initializing...');

      // Initialize AgentService if loading from database
      if (this.loadFromDatabase) {
        await this.agentService.initialize();
        logger.info('[GlobalAgentRegistry] AgentService initialized');

        // Load agents from database
        await this.syncWithDatabase();
      }

      // Start auto-sync if enabled
      if (this.autoSync && this.loadFromDatabase) {
        this._startAutoSync();
      }

      this.initialized = true;
      logger.info('[GlobalAgentRegistry] ✅ Initialized successfully', {
        totalAgents: this.agents.size,
        byType: this.stats.byType
      });

      this.emit('initialized', { totalAgents: this.agents.size });
    } catch (error) {
      logger.error({ error: error.message, stack: error.stack }, '[GlobalAgentRegistry] ❌ Initialization failed');
      throw new Error(`GlobalAgentRegistry initialization failed: ${error.message}`);
    }
  }

  /**
   * Synchronize agents with database
   * Loads all enabled agents from table 220847
   */
  async syncWithDatabase() {
    try {
      logger.info('[GlobalAgentRegistry] 🔄 Syncing agents from database...');

      // Fetch all enabled agents from database (limit 200 = all 148 agents)
      const result = await this.agentService.getAllAgents({
        enabled: true,
        limit: 200,
        page: 1
      });

      const dbAgents = result.agents || [];
      logger.info(`[GlobalAgentRegistry] 📊 Loaded ${dbAgents.length} agents from database`);

      // Register/update agents
      let registeredCount = 0;
      let updatedCount = 0;

      for (const dbAgent of dbAgents) {
        try {
          const isNew = !this.agentsByName.has(dbAgent.name);
          this._registerDatabaseAgent(dbAgent);

          if (isNew) {
            registeredCount++;
          } else {
            updatedCount++;
          }
        } catch (error) {
          logger.warn({ error: error.message, agent: dbAgent.name }, '[GlobalAgentRegistry] Failed to register agent from DB');
        }
      }

      this.stats.lastSyncTime = Date.now();
      this.stats.syncCount++;

      logger.info(`[GlobalAgentRegistry] ✅ Sync completed: ${registeredCount} new, ${updatedCount} updated`);
      this.emit('sync:completed', {
        total: dbAgents.length,
        new: registeredCount,
        updated: updatedCount
      });
    } catch (error) {
      logger.error({ error: error.message, stack: error.stack }, '[GlobalAgentRegistry] ❌ Sync failed');
      this.emit('sync:failed', { error });
      throw error;
    }
  }

  /**
   * Register agent from database
   * @private
   */
  _registerDatabaseAgent(dbAgent) {
    // Transform database agent to GlobalAgentEntry
    const entry = new GlobalAgentEntry({
      id: dbAgent.id,
      name: dbAgent.name,
      type: AgentType.PRODUCTION, // All DB agents are production agents
      capabilities: dbAgent.capabilities || [],
      priority: dbAgent.priority || 5,
      status: dbAgent.enabled ? 'active' : 'inactive',
      metadata: {
        ...dbAgent.metadata,
        description: dbAgent.description,
        icon: dbAgent.icon,
        category: dbAgent.category,
        path: dbAgent.path,
        creator: dbAgent.creator,
        price: dbAgent.price,
        pricingModel: dbAgent.pricingModel,
        source: 'database',
        dbId: dbAgent.id
      },
      triggers: dbAgent.triggers || [],
      agent: null // Will be lazily loaded on execution
    });

    // If agent already exists, unregister it first
    if (this.agentsByName.has(entry.name)) {
      const existing = this.agentsByName.get(entry.name);
      this.unregister(existing.id);
    }

    // Register the agent
    this.register(entry);
  }

  /**
   * Register an agent in the registry
   * @param {GlobalAgentEntry|Object} entryOrOptions - Agent entry or options to create one
   * @returns {GlobalAgentEntry} The registered agent entry
   */
  register(entryOrOptions) {
    // Create entry if options object was passed
    const entry = entryOrOptions instanceof GlobalAgentEntry
      ? entryOrOptions
      : new GlobalAgentEntry(entryOrOptions);

    if (!entry.name) {
      throw new Error('Agent name is required');
    }

    if (this.agentsByName.has(entry.name)) {
      throw new Error(`Agent with name "${entry.name}" already registered`);
    }

    if (this.agents.size >= this.maxAgents) {
      throw new Error(`Maximum agent limit reached (${this.maxAgents})`);
    }

    // Store in maps
    this.agents.set(entry.id, entry);
    this.agentsByName.set(entry.name, entry);

    // Index by type
    const typeSet = this.agentsByType.get(entry.type);
    if (typeSet) {
      typeSet.add(entry.id);
    }

    // Index by capabilities
    for (const capability of entry.capabilities) {
      if (!this.agentsByCapability.has(capability)) {
        this.agentsByCapability.set(capability, new Set());
      }
      this.agentsByCapability.get(capability).add(entry.id);
    }

    // Index by keywords
    for (const keyword of entry.keywords) {
      const kw = keyword.toLowerCase();
      if (!this.keywordIndex.has(kw)) {
        this.keywordIndex.set(kw, new Set());
      }
      this.keywordIndex.get(kw).add(entry.id);
    }

    // Update statistics
    this.stats.totalRegistered++;
    this.stats.byType[entry.type]++;

    logger.debug({
      agentId: entry.id,
      name: entry.name,
      type: entry.type,
      capabilities: entry.capabilities,
      keywords: entry.keywords.slice(0, 5) // First 5 keywords
    }, '[GlobalAgentRegistry] Agent registered');

    this.emit('agent:registered', entry);

    return entry;
  }

  /**
   * Unregister an agent
   * @param {string} agentId - Agent ID
   * @returns {boolean} True if agent was unregistered
   */
  unregister(agentId) {
    const entry = this.agents.get(agentId);

    if (!entry) {
      return false;
    }

    // Remove from all indexes
    this.agents.delete(agentId);
    this.agentsByName.delete(entry.name);

    const typeSet = this.agentsByType.get(entry.type);
    if (typeSet) {
      typeSet.delete(agentId);
    }

    for (const capability of entry.capabilities) {
      const capSet = this.agentsByCapability.get(capability);
      if (capSet) {
        capSet.delete(agentId);
        if (capSet.size === 0) {
          this.agentsByCapability.delete(capability);
        }
      }
    }

    for (const keyword of entry.keywords) {
      const kw = keyword.toLowerCase();
      const kwSet = this.keywordIndex.get(kw);
      if (kwSet) {
        kwSet.delete(agentId);
        if (kwSet.size === 0) {
          this.keywordIndex.delete(kw);
        }
      }
    }

    // Update statistics
    this.stats.totalRegistered--;
    this.stats.byType[entry.type]--;

    logger.debug({ agentId, name: entry.name }, '[GlobalAgentRegistry] Agent unregistered');
    this.emit('agent:unregistered', entry);

    return true;
  }

  /**
   * Get agent by ID
   */
  get(agentId) {
    return this.agents.get(agentId);
  }

  /**
   * Get agent by name
   */
  getByName(name) {
    return this.agentsByName.get(name);
  }

  /**
   * Check if agent exists
   */
  has(agentId) {
    return this.agents.has(agentId);
  }

  /**
   * Check if agent exists by name
   */
  hasByName(name) {
    return this.agentsByName.has(name);
  }

  /**
   * Find agents by capability
   * @param {string} capability - Capability to search for
   * @returns {GlobalAgentEntry[]} Agents with this capability, sorted by priority
   */
  findByCapability(capability) {
    const agentIds = this.agentsByCapability.get(capability);

    if (!agentIds || agentIds.size === 0) {
      return [];
    }

    return Array.from(agentIds)
      .map(id => this.agents.get(id))
      .filter(entry => entry && entry.status === 'active')
      .sort((a, b) => b.priority - a.priority);
  }

  /**
   * Find agents by type
   */
  findByType(type) {
    const agentIds = this.agentsByType.get(type);

    if (!agentIds || agentIds.size === 0) {
      return [];
    }

    return Array.from(agentIds)
      .map(id => this.agents.get(id))
      .filter(entry => entry && entry.status === 'active')
      .sort((a, b) => b.priority - a.priority);
  }

  /**
   * Find agents by keyword
   * @param {string} keyword - Keyword to match
   * @returns {GlobalAgentEntry[]} Matching agents, sorted by priority
   */
  findByKeyword(keyword) {
    if (!keyword) {
      return [];
    }

    const normalizedKeyword = keyword.toLowerCase();
    const matchingAgents = [];

    // First, try exact keyword match
    const exactMatches = this.keywordIndex.get(normalizedKeyword);
    if (exactMatches && exactMatches.size > 0) {
      for (const agentId of exactMatches) {
        const entry = this.agents.get(agentId);
        if (entry && entry.status === 'active') {
          matchingAgents.push(entry);
        }
      }
    }

    // If no exact matches, try partial matches
    if (matchingAgents.length === 0) {
      for (const entry of this.agents.values()) {
        if (entry.status === 'active' && entry.matchesKeyword(keyword)) {
          matchingAgents.push(entry);
        }
      }
    }

    return matchingAgents.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Find best agent for a set of capabilities
   * @param {string[]} capabilities - Required capabilities
   * @returns {GlobalAgentEntry|null} Best matching agent
   */
  findBestMatch(capabilities) {
    if (!capabilities || capabilities.length === 0) {
      return null;
    }

    let bestMatch = null;
    let bestScore = 0;

    for (const [, entry] of this.agents) {
      if (entry.status !== 'active') {
        continue;
      }

      const matchCount = capabilities.filter(c => entry.hasCapability(c)).length;

      if (matchCount === 0) {
        continue;
      }

      // Score = matching capabilities + priority bonus + success rate bonus
      const successRate = entry.stats.totalInvocations > 0
        ? entry.stats.successfulInvocations / entry.stats.totalInvocations
        : 0.5;

      const score = (matchCount * 10) + (entry.priority * 1) + (successRate * 5);

      if (score > bestScore) {
        bestScore = score;
        bestMatch = entry;
      }
    }

    return bestMatch;
  }

  /**
   * Execute an agent by name
   * @param {string} name - Agent name
   * @param {Object} input - Input data
   * @param {Object} context - Execution context
   * @returns {Promise<Object>} Agent result
   */
  async execute(name, input, context = {}) {
    const entry = this.agentsByName.get(name);

    if (!entry) {
      throw new Error(`Agent ${name} not found in registry`);
    }

    if (entry.status !== 'active') {
      throw new Error(`Agent ${name} is not active (status: ${entry.status})`);
    }

    if (!entry.agent || typeof entry.agent.execute !== 'function') {
      throw new Error(`Agent ${name} has no execute method`);
    }

    const startTime = Date.now();

    try {
      const result = await entry.agent.execute(input, context);
      const executionTime = Date.now() - startTime;

      // Record successful invocation
      entry.recordInvocation(true, executionTime);

      return {
        success: true,
        agent: name,
        data: result.data || result,
        source: result.source || name,
        executionTime
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;

      // Record failed invocation
      entry.recordInvocation(false, executionTime);

      logger.error({ name, error: error.message }, '[GlobalAgentRegistry] Agent execution failed');

      return {
        success: false,
        agent: name,
        error: error.message,
        executionTime
      };
    }
  }

  /**
   * Get all registered agent names
   */
  getAgentNames() {
    return [...this.agentsByName.keys()];
  }

  /**
   * Get all capabilities
   */
  getCapabilities() {
    return [...this.agentsByCapability.keys()];
  }

  /**
   * Get all keywords
   */
  getKeywords() {
    return [...this.keywordIndex.keys()];
  }

  /**
   * Get all registered agents
   */
  getAllAgents() {
    return Array.from(this.agents.values()).map(entry => entry.getSummary());
  }

  /**
   * Get agent descriptions for LLM planning
   */
  getAgentDescriptions() {
    return [...this.agents.values()].map(entry => ({
      name: entry.name,
      description: entry.metadata.description || `${entry.name} agent`,
      capabilities: entry.capabilities,
      keywords: entry.keywords.slice(0, 10), // First 10 keywords
      priority: entry.priority,
      type: entry.type
    }));
  }

  /**
   * Get agent descriptions as formatted text for prompts
   */
  getAgentDescriptionsText() {
    return this.getAgentDescriptions()
      .map(a => `- ${a.name} (${a.type}): ${a.description} [capabilities: ${a.capabilities.join(', ')}]`)
      .join('\n');
  }

  /**
   * Get registry statistics
   */
  getStats() {
    return {
      ...this.stats,
      totalAgents: this.agents.size,
      activeAgents: Array.from(this.agents.values()).filter(e => e.status === 'active').length,
      byType: { ...this.stats.byType },
      totalCapabilities: this.agentsByCapability.size,
      totalKeywords: this.keywordIndex.size
    };
  }

  /**
   * Update agent status
   */
  updateAgentStatus(agentId, status) {
    const entry = this.agents.get(agentId);

    if (!entry) {
      throw new Error(`Agent ${agentId} not found`);
    }

    const oldStatus = entry.status;
    entry.status = status;

    logger.info({ agentId, name: entry.name, oldStatus, newStatus: status }, '[GlobalAgentRegistry] Agent status updated');
    this.emit('agent:status_changed', entry);

    return entry;
  }

  /**
   * Clear all registered agents
   */
  clear() {
    this.agents.clear();
    this.agentsByName.clear();
    this.keywordIndex.clear();

    for (const set of this.agentsByType.values()) {
      set.clear();
    }

    for (const set of this.agentsByCapability.values()) {
      set.clear();
    }

    this.stats.totalRegistered = 0;

    for (const type of Object.keys(this.stats.byType)) {
      this.stats.byType[type] = 0;
    }

    logger.info('[GlobalAgentRegistry] Cleared all agents');
  }

  /**
   * Start auto-sync with database
   * @private
   */
  _startAutoSync() {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
    }

    this.syncTimer = setInterval(() => {
      this.syncWithDatabase().catch(error => {
        logger.error({ error: error.message }, '[GlobalAgentRegistry] Auto-sync failed');
      });
    }, this.syncInterval);

    logger.info(`[GlobalAgentRegistry] Auto-sync started (interval: ${this.syncInterval}ms = ${this.syncInterval / 60000} minutes)`);
  }

  /**
   * Shutdown registry (stop auto-sync, cleanup)
   */
  shutdown() {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }

    logger.info('[GlobalAgentRegistry] Shutdown complete');
    this.emit('shutdown');
  }

  /**
   * Get registry status
   */
  getStatus() {
    return {
      initialized: this.initialized,
      totalAgents: this.agents.size,
      maxAgents: this.maxAgents,
      routingStrategy: this.routingStrategy,
      autoSync: this.autoSync,
      syncInterval: this.syncInterval,
      lastSyncTime: this.stats.lastSyncTime,
      syncCount: this.stats.syncCount,
      stats: this.getStats()
    };
  }
}

/**
 * Singleton instance for global access
 * This instance is used by MultiAgentOrchestrator and all entry points
 */
export const globalAgentRegistry = new GlobalAgentRegistry();

export default GlobalAgentRegistry;
