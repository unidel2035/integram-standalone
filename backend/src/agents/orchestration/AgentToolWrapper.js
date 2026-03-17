/**
 * AgentToolWrapper - Wrap agents as callable tools for other agents
 *
 * Implements the "Agents-as-Tools" pattern from Go-Agent (Protocol-Lattice)
 * This allows agents to call other agents as tools, creating hierarchical
 * multi-agent systems where specialized agents can be composed.
 *
 * Benefits:
 * - Composability: Complex agents built from simpler ones
 * - Specialization: Each agent focuses on one domain
 * - Reusability: Agents exposed as standard tools
 * - Isolation: Sub-agent failures don't crash parent
 *
 * Usage:
 *   const wrapper = new AgentToolWrapper(registry)
 *   wrapper.wrapAgent('dataAnalyzer', analyzerAgent)
 *   // Now other agents can call 'dataAnalyzer' as a tool
 */

import logger from '../../utils/logger.js';
import EventEmitter from 'events';

/**
 * Wraps an agent to be callable as a tool by other agents
 */
export class AgentToolWrapper extends EventEmitter {
  constructor(registry, options = {}) {
    super();

    if (!registry) {
      throw new Error('AgentToolWrapper requires registry');
    }

    this.registry = registry;
    this.wrappedAgents = new Map();

    // Configuration
    this.config = {
      timeout: options.timeout || 30000,
      maxDepth: options.maxDepth || 5, // Prevent infinite recursion
      retryOnError: options.retryOnError !== false,
      maxRetries: options.maxRetries || 2,
      trackCalls: options.trackCalls !== false,
    };

    // Call tracking for debugging and analytics
    this.callHistory = [];
    this.maxHistorySize = options.maxHistorySize || 100;

    logger.info({ config: this.config }, 'AgentToolWrapper initialized');
  }

  /**
   * Wrap an agent as a callable tool
   *
   * @param {string} toolName - Name to register the tool as
   * @param {Object} agent - Agent instance (must have execute method)
   * @param {Object} metadata - Tool metadata
   * @returns {Object} Wrapped tool definition
   */
  wrapAgent(toolName, agent, metadata = {}) {
    if (!agent || typeof agent.execute !== 'function') {
      throw new Error(`Agent must have an execute method: ${toolName}`);
    }

    // Create tool wrapper
    const wrappedTool = {
      name: toolName,
      agent,
      metadata: {
        description: metadata.description || `Wrapped agent: ${toolName}`,
        capabilities: metadata.capabilities || [],
        inputSchema: metadata.inputSchema || { task: 'object' },
        outputSchema: metadata.outputSchema || { result: 'object' },
        isWrappedAgent: true,
        priority: metadata.priority || 50,
        ...metadata,
      },
      execute: async (input, options = {}) => {
        return this._executeWrappedAgent(toolName, agent, input, options);
      },
    };

    // Store in local map
    this.wrappedAgents.set(toolName, wrappedTool);

    // Register with the main registry
    this.registry.register(toolName, wrappedTool, wrappedTool.metadata);

    this.emit('agent:wrapped', { toolName, metadata: wrappedTool.metadata });

    logger.info(
      { toolName, capabilities: wrappedTool.metadata.capabilities },
      'Agent wrapped as tool',
    );

    return wrappedTool;
  }

  /**
   * Execute a wrapped agent
   * @private
   */
  async _executeWrappedAgent(toolName, agent, input, options = {}) {
    const callId = `call_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const startTime = Date.now();
    const depth = options.depth || 0;

    // Check recursion depth
    if (depth >= this.config.maxDepth) {
      const error = new Error(`Max agent call depth exceeded: ${depth}`);
      this._recordCall(callId, toolName, input, null, error, startTime);
      throw error;
    }

    logger.debug(
      { callId, toolName, depth, input: this._summarizeInput(input) },
      'Executing wrapped agent',
    );

    try {
      // Prepare task object for agent
      const task = this._createTask(toolName, input, options);

      // Execute with timeout
      const result = await this._executeWithTimeout(
        agent,
        task,
        options,
        depth,
      );

      // Handle null/undefined results
      const safeResult = result || {};

      // Determine success - propagate agent's success status if present
      const agentSuccess = safeResult.success !== undefined ? safeResult.success : true;

      // Record call
      this._recordCall(callId, toolName, input, safeResult, null, startTime);

      this.emit('agent:executed', {
        callId,
        toolName,
        success: agentSuccess,
        executionTime: Date.now() - startTime,
      });

      return {
        success: agentSuccess,
        data: safeResult.data !== undefined ? safeResult.data : safeResult,
        source: `agent:${toolName}`,
        callId,
        executionTime: Date.now() - startTime,
      };

    } catch (error) {
      logger.warn(
        { callId, toolName, error: error.message, depth },
        'Wrapped agent execution failed',
      );

      // Retry if configured
      const retryCount = options.retryCount || 0;
      if (this.config.retryOnError && retryCount < this.config.maxRetries) {
        logger.info(
          { callId, toolName, retryCount: (options.retryCount || 0) + 1 },
          'Retrying wrapped agent',
        );
        return this._executeWrappedAgent(toolName, agent, input, {
          ...options,
          retryCount: (options.retryCount || 0) + 1,
        });
      }

      // Record failure
      this._recordCall(callId, toolName, input, null, error, startTime);

      this.emit('agent:failed', {
        callId,
        toolName,
        error: error.message,
        executionTime: Date.now() - startTime,
      });

      return {
        success: false,
        error: error.message,
        source: `agent:${toolName}`,
        callId,
        executionTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Execute agent with timeout
   * @private
   */
  async _executeWithTimeout(agent, task, options, depth) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Agent execution timed out after ${this.config.timeout}ms`));
      }, this.config.timeout);

      // Pass depth to prevent infinite recursion in nested calls
      const executePromise = agent.processTask
        ? agent.processTask(task, { ...options, depth: depth + 1 })
        : agent.execute(task, { ...options, depth: depth + 1 });

      executePromise
        .then(result => {
          clearTimeout(timeout);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timeout);
          reject(error);
        });
    });
  }

  /**
   * Create task object for agent
   * @private
   */
  _createTask(toolName, input, options) {
    const safeInput = input || {};
    return {
      id: `task_${toolName}_${Date.now()}`,
      type: `tool_call:${toolName}`,
      description: safeInput.description || `Tool call to ${toolName}`,
      input: input,
      metadata: {
        calledAs: 'tool',
        callerAgent: options.callerAgent || null,
        timestamp: Date.now(),
      },
      ...safeInput,
    };
  }

  /**
   * Summarize input for logging (avoid huge logs)
   * @private
   */
  _summarizeInput(input) {
    if (input === undefined || input === null) {
      return input;
    }
    try {
      const str = JSON.stringify(input);
      if (str && str.length > 200) {
        return str.slice(0, 200) + '...';
      }
      return input;
    } catch {
      // Handle circular references or other JSON serialization issues
      return '[Complex object - cannot serialize]';
    }
  }

  /**
   * Record call for history/analytics
   * @private
   */
  _recordCall(callId, toolName, input, result, error, startTime) {
    if (!this.config.trackCalls) return;

    const record = {
      callId,
      toolName,
      input: this._summarizeInput(input),
      success: !error,
      error: error?.message,
      executionTime: Date.now() - startTime,
      timestamp: startTime,
    };

    this.callHistory.push(record);

    // Limit history size
    if (this.callHistory.length > this.maxHistorySize) {
      this.callHistory.shift();
    }
  }

  /**
   * Unwrap an agent (remove from registry)
   *
   * @param {string} toolName - Tool name to unwrap
   * @returns {boolean} Whether unwrap was successful
   */
  unwrapAgent(toolName) {
    if (!this.wrappedAgents.has(toolName)) {
      return false;
    }

    this.wrappedAgents.delete(toolName);
    // Note: Registry doesn't have unregister, so tool remains there
    // but won't be in our wrapped agents map

    this.emit('agent:unwrapped', { toolName });
    logger.info({ toolName }, 'Agent unwrapped');

    return true;
  }

  /**
   * Get list of wrapped agents
   *
   * @returns {Array} List of wrapped agent names and metadata
   */
  getWrappedAgents() {
    const agents = [];
    for (const [name, tool] of this.wrappedAgents) {
      agents.push({
        name,
        description: tool.metadata.description,
        capabilities: tool.metadata.capabilities,
      });
    }
    return agents;
  }

  /**
   * Get call history for analytics
   *
   * @param {Object} filters - Filter options
   * @param {string} filters.toolName - Filter by tool
   * @param {boolean} filters.successOnly - Only successful calls
   * @param {number} filters.limit - Max results
   * @returns {Array} Call history
   */
  getCallHistory(filters = {}) {
    let history = [...this.callHistory];

    if (filters.toolName) {
      history = history.filter(h => h.toolName === filters.toolName);
    }

    if (filters.successOnly) {
      history = history.filter(h => h.success);
    }

    // Sort by timestamp descending
    history.sort((a, b) => b.timestamp - a.timestamp);

    if (filters.limit) {
      history = history.slice(0, filters.limit);
    }

    return history;
  }

  /**
   * Get statistics about wrapped agent calls
   *
   * @returns {Object} Statistics
   */
  getStats() {
    const stats = {
      wrappedAgentsCount: this.wrappedAgents.size,
      totalCalls: this.callHistory.length,
      successfulCalls: 0,
      failedCalls: 0,
      avgExecutionTime: 0,
      byAgent: {},
    };

    let totalTime = 0;
    for (const call of this.callHistory) {
      if (call.success) {
        stats.successfulCalls++;
      } else {
        stats.failedCalls++;
      }
      totalTime += call.executionTime;

      // Per-agent stats
      if (!stats.byAgent[call.toolName]) {
        stats.byAgent[call.toolName] = { calls: 0, successes: 0, failures: 0 };
      }
      stats.byAgent[call.toolName].calls++;
      if (call.success) {
        stats.byAgent[call.toolName].successes++;
      } else {
        stats.byAgent[call.toolName].failures++;
      }
    }

    stats.avgExecutionTime = stats.totalCalls > 0
      ? Math.round(totalTime / stats.totalCalls)
      : 0;

    stats.successRate = stats.totalCalls > 0
      ? ((stats.successfulCalls / stats.totalCalls) * 100).toFixed(1) + '%'
      : 'N/A';

    return stats;
  }

  /**
   * Create a composite agent from multiple wrapped agents
   *
   * This allows creating a "team" of agents that work together
   *
   * @param {string} compositeName - Name for the composite agent
   * @param {Array} agentNames - Names of agents to include
   * @param {Object} options - Composite options
   * @returns {Object} Composite agent tool
   */
  createComposite(compositeName, agentNames, options = {}) {
    const agents = agentNames
      .map(name => this.wrappedAgents.get(name))
      .filter(Boolean);

    if (agents.length === 0) {
      throw new Error('No valid agents found for composite');
    }

    const compositeAgent = {
      name: compositeName,
      agents,
      execute: async (input, execOptions = {}) => {
        const results = [];
        const mode = options.mode || 'sequential'; // 'sequential' | 'parallel'

        if (mode === 'parallel') {
          // Execute all in parallel
          const promises = agents.map(a => a.execute(input, execOptions));
          const settled = await Promise.allSettled(promises);
          for (const result of settled) {
            if (result.status === 'fulfilled') {
              results.push(result.value);
            } else {
              results.push({ success: false, error: result.reason?.message });
            }
          }
        } else {
          // Execute sequentially, passing output to next
          let currentInput = input;
          for (const agent of agents) {
            const result = await agent.execute(currentInput, execOptions);
            results.push(result);
            if (result.success && result.data) {
              currentInput = { ...currentInput, previousResult: result.data };
            }
          }
        }

        return {
          success: results.every(r => r.success),
          data: results,
          source: `composite:${compositeName}`,
        };
      },
    };

    // Register composite as a tool
    return this.wrapAgent(compositeName, compositeAgent, {
      description: `Composite agent: ${agentNames.join(' + ')}`,
      capabilities: agents.flatMap(a => a.metadata.capabilities || []),
      isComposite: true,
      members: agentNames,
      ...options,
    });
  }
}

export default AgentToolWrapper;
