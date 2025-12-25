// AgentDiscoveryService.js - Automatic agent registration and discovery
// Issue #2704 - Phase 2.1: Service Discovery mechanism for multi-agent system

import EventEmitter from 'events';
import { randomUUID } from 'crypto';
import logger from '../utils/logger.js';
import metrics from '../utils/metrics.js';
import { BoundedMap } from '../utils/memoryOptimization.js';

/**
 * AgentDiscoveryService provides automatic agent registration and capability-based discovery
 *
 * Features:
 * - Auto-registration of agents with capabilities
 * - Capability-based agent discovery
 * - Automatic heartbeat monitoring
 * - Auto-deregistration on heartbeat timeout
 * - Event-driven architecture for subscriptions
 *
 * Events:
 * - agent:registered - When an agent registers
 * - agent:deregistered - When an agent is removed
 * - agent:updated - When agent information is updated
 * - agent:heartbeat - When agent heartbeat received
 * - agent:timeout - When agent heartbeat times out
 */
export class AgentDiscoveryService extends EventEmitter {
  constructor(options = {}) {
    super();

    // Agent storage with memory bounds (Issue #2157)
    this.maxAgents = options.maxAgents || 5000;
    this.agents = new BoundedMap(this.maxAgents);

    // Capability index: capability -> Set<agentId>
    // Allows fast O(1) lookup of agents by capability
    this.capabilityIndex = new Map();

    // Heartbeat configuration
    this.heartbeatInterval = options.heartbeatInterval || 30000; // 30 seconds
    this.heartbeatTimeout = options.heartbeatTimeout || 90000; // 90 seconds
    this.heartbeatTimers = new Map();

    // Start heartbeat monitoring
    this.startHeartbeatMonitoring();

    // Integration with AgentRegistry (if provided)
    this.agentRegistry = options.agentRegistry || null;

    logger.info({
      maxAgents: this.maxAgents,
      heartbeatInterval: this.heartbeatInterval,
      heartbeatTimeout: this.heartbeatTimeout
    }, 'AgentDiscoveryService initialized');
  }

  /**
   * Register an agent with automatic capability indexing
   *
   * @param {Object} agentInfo - Agent information
   * @param {string} agentInfo.id - Agent ID (optional, auto-generated if not provided)
   * @param {string} agentInfo.name - Agent name
   * @param {Array<string>} agentInfo.capabilities - Agent capabilities
   * @param {string} agentInfo.endpoint - Agent endpoint URL
   * @param {string} agentInfo.healthCheckUrl - Health check endpoint (optional)
   * @param {Object} agentInfo.metadata - Additional metadata (optional)
   * @returns {Object} Registration confirmation with agent details
   */
  async register(agentInfo) {
    // 1. Validate agent info
    if (!agentInfo) {
      throw new Error('Agent info is required');
    }

    if (!agentInfo.name) {
      throw new Error('Agent name is required');
    }

    if (!agentInfo.capabilities || !Array.isArray(agentInfo.capabilities)) {
      throw new Error('Agent capabilities array is required');
    }

    if (agentInfo.capabilities.length === 0) {
      throw new Error('Agent must have at least one capability');
    }

    if (!agentInfo.endpoint) {
      throw new Error('Agent endpoint is required');
    }

    // 2. Create agent record
    const agentId = agentInfo.id || randomUUID();
    const agent = {
      id: agentId,
      name: agentInfo.name,
      capabilities: agentInfo.capabilities,
      endpoint: agentInfo.endpoint,
      healthCheckUrl: agentInfo.healthCheckUrl || '/health',
      metadata: agentInfo.metadata || {},
      registeredAt: new Date(),
      lastHeartbeat: new Date(),
      status: 'active'
    };

    // 3. Store in agents map
    this.agents.set(agentId, agent);

    // 4. Index by capabilities
    this._indexAgentCapabilities(agentId, agentInfo.capabilities);

    // 5. Start heartbeat monitoring for this agent
    this._startAgentHeartbeatMonitoring(agentId);

    // 6. Update metrics
    metrics.increment('discovery.agents.registered');
    metrics.increment('discovery.agents.active');

    // 7. Emit 'agent:registered' event
    this.emit('agent:registered', agent);

    // 8. Integrate with AgentRegistry if available
    if (this.agentRegistry) {
      try {
        this.agentRegistry.registerAgent({
          id: agentId,
          name: agent.name,
          capabilities: agent.capabilities,
          metadata: agent.metadata
        });
      } catch (error) {
        logger.warn({
          agentId,
          error: error.message
        }, 'Failed to register agent with AgentRegistry');
      }
    }

    logger.info({
      agentId,
      name: agent.name,
      capabilities: agent.capabilities,
      endpoint: agent.endpoint
    }, 'Agent registered successfully');

    return {
      success: true,
      agent: {
        id: agent.id,
        name: agent.name,
        capabilities: agent.capabilities,
        endpoint: agent.endpoint,
        registeredAt: agent.registeredAt
      }
    };
  }

  /**
   * Deregister an agent and clean up all indexes
   *
   * @param {string} agentId - Agent ID to deregister
   * @returns {Object} Deregistration confirmation
   */
  async deregister(agentId) {
    // 1. Get agent
    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }

    // 2. Remove from capability index
    this._removeAgentFromCapabilityIndex(agentId, agent.capabilities);

    // 3. Stop heartbeat monitoring
    this._stopAgentHeartbeatMonitoring(agentId);

    // 4. Remove from agents map
    this.agents.delete(agentId);

    // 5. Update metrics
    metrics.decrement('discovery.agents.registered');
    if (agent.status === 'active') {
      metrics.decrement('discovery.agents.active');
    }

    // 6. Emit 'agent:deregistered' event
    this.emit('agent:deregistered', agent);

    // 7. Integrate with AgentRegistry if available
    if (this.agentRegistry) {
      try {
        this.agentRegistry.unregisterAgent(agentId);
      } catch (error) {
        logger.warn({
          agentId,
          error: error.message
        }, 'Failed to unregister agent from AgentRegistry');
      }
    }

    logger.info({
      agentId,
      name: agent.name
    }, 'Agent deregistered successfully');

    return {
      success: true,
      agentId,
      message: 'Agent deregistered successfully'
    };
  }

  /**
   * Discover agents by capability
   * Uses capability index for O(1) lookup
   *
   * @param {string} capability - Capability to search for
   * @returns {Array<Object>} List of agents with the capability
   */
  discover(capability) {
    if (!capability) {
      throw new Error('Capability is required');
    }

    // Get agent IDs from capability index
    const agentIds = this.capabilityIndex.get(capability);

    if (!agentIds || agentIds.size === 0) {
      logger.debug({ capability }, 'No agents found with capability');
      return [];
    }

    // Retrieve full agent objects
    const agents = [];
    for (const agentId of agentIds) {
      const agent = this.agents.get(agentId);
      if (agent && agent.status === 'active') {
        agents.push(this._sanitizeAgentForResponse(agent));
      }
    }

    logger.debug({
      capability,
      agentsFound: agents.length
    }, 'Agents discovered by capability');

    return agents;
  }

  /**
   * Discover agent by ID
   *
   * @param {string} agentId - Agent ID to find
   * @returns {Object|null} Agent object or null if not found
   */
  discoverById(agentId) {
    if (!agentId) {
      throw new Error('Agent ID is required');
    }

    const agent = this.agents.get(agentId);

    if (!agent) {
      logger.debug({ agentId }, 'Agent not found');
      return null;
    }

    return this._sanitizeAgentForResponse(agent);
  }

  /**
   * Get all registered agents
   *
   * @param {Object} options - Filter options
   * @param {string} options.status - Filter by status (active, inactive, all)
   * @returns {Array<Object>} List of all agents
   */
  getAll(options = {}) {
    const { status = 'active' } = options;

    const agents = [];
    for (const agent of this.agents.values()) {
      if (status === 'all' || agent.status === status) {
        agents.push(this._sanitizeAgentForResponse(agent));
      }
    }

    logger.debug({
      totalAgents: agents.length,
      status
    }, 'Retrieved all agents');

    return agents;
  }

  /**
   * Subscribe to discovery events
   *
   * @param {Function} callback - Callback function for events
   * @param {string} eventType - Event type to subscribe to (optional, subscribes to all if not provided)
   * @returns {Function} Unsubscribe function
   */
  subscribe(callback, eventType = null) {
    if (typeof callback !== 'function') {
      throw new Error('Callback must be a function');
    }

    const events = eventType ? [eventType] : [
      'agent:registered',
      'agent:deregistered',
      'agent:updated',
      'agent:heartbeat',
      'agent:timeout'
    ];

    // Subscribe to events
    for (const event of events) {
      this.on(event, callback);
    }

    logger.debug({
      events,
      hasEventType: !!eventType
    }, 'Subscribed to discovery events');

    // Return unsubscribe function
    return () => {
      for (const event of events) {
        this.removeListener(event, callback);
      }
      logger.debug({ events }, 'Unsubscribed from discovery events');
    };
  }

  /**
   * Update agent heartbeat
   *
   * @param {string} agentId - Agent ID
   * @returns {Object} Updated agent info
   */
  async updateHeartbeat(agentId) {
    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }

    // Update heartbeat timestamp
    agent.lastHeartbeat = new Date();

    // If agent was inactive, mark as active
    if (agent.status === 'inactive') {
      agent.status = 'active';
      metrics.increment('discovery.agents.active');
      this.emit('agent:updated', agent);
      logger.info({ agentId }, 'Agent reactivated after heartbeat');
    }

    this.emit('agent:heartbeat', agent);

    logger.debug({ agentId }, 'Agent heartbeat updated');

    return {
      success: true,
      agentId,
      lastHeartbeat: agent.lastHeartbeat
    };
  }

  /**
   * Start heartbeat monitoring
   * Runs periodically to check all agents
   */
  startHeartbeatMonitoring() {
    if (this.heartbeatMonitoringTimer) {
      logger.warn('Heartbeat monitoring already running');
      return;
    }

    this.heartbeatMonitoringTimer = setInterval(() => {
      this._checkAllAgentHeartbeats();
    }, this.heartbeatInterval);

    logger.info('Heartbeat monitoring started');
  }

  /**
   * Stop heartbeat monitoring
   */
  stopHeartbeatMonitoring() {
    if (this.heartbeatMonitoringTimer) {
      clearInterval(this.heartbeatMonitoringTimer);
      this.heartbeatMonitoringTimer = null;
      logger.info('Heartbeat monitoring stopped');
    }

    // Stop individual agent timers
    for (const agentId of this.heartbeatTimers.keys()) {
      this._stopAgentHeartbeatMonitoring(agentId);
    }
  }

  /**
   * Get service statistics
   *
   * @returns {Object} Service statistics
   */
  getStats() {
    const activeAgents = Array.from(this.agents.values()).filter(a => a.status === 'active').length;
    const inactiveAgents = Array.from(this.agents.values()).filter(a => a.status === 'inactive').length;

    return {
      totalAgents: this.agents.size,
      activeAgents,
      inactiveAgents,
      capabilities: this.capabilityIndex.size,
      heartbeatInterval: this.heartbeatInterval,
      heartbeatTimeout: this.heartbeatTimeout
    };
  }

  /**
   * Shutdown the service
   */
  shutdown() {
    logger.info('Shutting down AgentDiscoveryService');

    // Stop heartbeat monitoring
    this.stopHeartbeatMonitoring();

    // Clear all data
    this.agents.clear();
    this.capabilityIndex.clear();
    this.heartbeatTimers.clear();

    // Remove all listeners
    this.removeAllListeners();

    logger.info('AgentDiscoveryService shut down successfully');
  }

  // ========== Private Methods ==========

  /**
   * Index agent capabilities for fast lookup
   * @private
   */
  _indexAgentCapabilities(agentId, capabilities) {
    for (const capability of capabilities) {
      if (!this.capabilityIndex.has(capability)) {
        this.capabilityIndex.set(capability, new Set());
      }
      this.capabilityIndex.get(capability).add(agentId);
    }

    logger.debug({
      agentId,
      capabilities
    }, 'Agent capabilities indexed');
  }

  /**
   * Remove agent from capability index
   * @private
   */
  _removeAgentFromCapabilityIndex(agentId, capabilities) {
    for (const capability of capabilities) {
      const agentSet = this.capabilityIndex.get(capability);
      if (agentSet) {
        agentSet.delete(agentId);
        // Clean up empty capability sets
        if (agentSet.size === 0) {
          this.capabilityIndex.delete(capability);
        }
      }
    }

    logger.debug({
      agentId,
      capabilities
    }, 'Agent removed from capability index');
  }

  /**
   * Start heartbeat monitoring for a specific agent
   * @private
   */
  _startAgentHeartbeatMonitoring(agentId) {
    // Already monitored globally, just track that we're monitoring
    this.heartbeatTimers.set(agentId, true);
  }

  /**
   * Stop heartbeat monitoring for a specific agent
   * @private
   */
  _stopAgentHeartbeatMonitoring(agentId) {
    this.heartbeatTimers.delete(agentId);
  }

  /**
   * Check all agents for heartbeat timeouts
   * @private
   */
  _checkAllAgentHeartbeats() {
    const now = Date.now();
    const timedOutAgents = [];

    for (const [agentId, agent] of this.agents.entries()) {
      if (agent.status !== 'active') {
        continue;
      }

      const timeSinceLastHeartbeat = now - agent.lastHeartbeat.getTime();

      if (timeSinceLastHeartbeat > this.heartbeatTimeout) {
        timedOutAgents.push(agentId);
        agent.status = 'inactive';
        metrics.decrement('discovery.agents.active');

        logger.warn({
          agentId,
          name: agent.name,
          timeSinceLastHeartbeat
        }, 'Agent heartbeat timeout');

        this.emit('agent:timeout', agent);
      }
    }

    if (timedOutAgents.length > 0) {
      logger.info({
        timedOutCount: timedOutAgents.length
      }, 'Agents marked inactive due to heartbeat timeout');
    }
  }

  /**
   * Sanitize agent object for external response
   * @private
   */
  _sanitizeAgentForResponse(agent) {
    return {
      id: agent.id,
      name: agent.name,
      capabilities: agent.capabilities,
      endpoint: agent.endpoint,
      healthCheckUrl: agent.healthCheckUrl,
      metadata: agent.metadata,
      status: agent.status,
      registeredAt: agent.registeredAt,
      lastHeartbeat: agent.lastHeartbeat
    };
  }
}
