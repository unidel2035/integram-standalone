/**
 * ExecutionContext - Shared state for multi-agent execution chains
 *
 * Maintains execution history, results, and state across agent calls.
 * Provides loop detection and depth limiting for safety.
 */

import crypto from 'crypto'
import logger from '../../utils/logger.js'

/**
 * Execution step record
 * @typedef {Object} ExecutionStep
 * @property {string} id - Step ID
 * @property {string} agent - Agent name
 * @property {Object} input - Input data
 * @property {Object} output - Output data
 * @property {number} startTime - Start timestamp
 * @property {number} endTime - End timestamp
 * @property {boolean} success - Whether step succeeded
 * @property {string} [error] - Error message if failed
 * @property {string} [parentStepId] - Parent step ID for nested calls
 */

export class ExecutionContext {
  /**
   * Create execution context
   * @param {string} query - Original user query
   * @param {Object} options - Context options
   */
  constructor(query, options = {}) {
    this.id = crypto.randomUUID()
    this.query = query
    this.startTime = Date.now()
    this.endTime = null

    // Execution tracking
    this.steps = []           // Ordered list of execution steps
    this.results = {}         // Results by agent name
    this.state = {}           // Shared mutable state
    this.plan = null          // Execution plan from planner

    // Safety limits
    this.depth = 0                              // Current nesting depth
    this.maxDepth = options.maxDepth || 10      // Max nesting depth
    this.maxSteps = options.maxSteps || 50      // Max total steps
    this.timeout = options.timeout || 120000    // 2 minute timeout

    // Loop detection
    this.executionHistory = []  // For detecting repetitive patterns
    this.loopWindow = options.loopWindow || 5   // Window size for loop detection

    // Metadata
    this.userId = options.userId || null
    this.accessToken = options.accessToken || null
    this.metadata = options.metadata || {}

    // Status
    this.status = 'created'  // created, running, completed, failed, timeout
    this.error = null
  }

  /**
   * Start execution
   */
  start() {
    this.status = 'running'
    this.startTime = Date.now()
    logger.info({ contextId: this.id, query: this.query }, 'Execution context started')
  }

  /**
   * Add execution step
   * @param {string} agentName - Agent name
   * @param {Object} input - Input data
   * @param {Object} output - Output data
   * @param {Object} options - Additional options
   * @returns {ExecutionStep}
   */
  addStep(agentName, input, output, options = {}) {
    const step = {
      id: `step_${this.steps.length}`,
      agent: agentName,
      input,
      output: output.data || output,
      success: output.success !== false,
      error: output.error || null,
      source: output.source || agentName,
      startTime: options.startTime || Date.now(),
      endTime: Date.now(),
      parentStepId: options.parentStepId || null,
      depth: this.depth
    }

    this.steps.push(step)
    this.results[agentName] = step.output

    // Track for loop detection
    this.executionHistory.push({
      agent: agentName,
      inputHash: this._hashObject(input)
    })

    logger.debug({
      contextId: this.id,
      stepId: step.id,
      agent: agentName,
      success: step.success
    }, 'Execution step added')

    return step
  }

  /**
   * Get result from a specific agent
   * @param {string} agentName - Agent name
   * @returns {Object|undefined}
   */
  getResult(agentName) {
    return this.results[agentName]
  }

  /**
   * Get all results
   * @returns {Object}
   */
  getAllResults() {
    return { ...this.results }
  }

  /**
   * Set shared state
   * @param {string} key - State key
   * @param {any} value - State value
   */
  setState(key, value) {
    this.state[key] = value
  }

  /**
   * Get shared state
   * @param {string} key - State key
   * @param {any} defaultValue - Default value if not found
   * @returns {any}
   */
  getState(key, defaultValue = undefined) {
    return this.state.hasOwnProperty(key) ? this.state[key] : defaultValue
  }

  /**
   * Increment depth (for nested agent calls)
   * @returns {boolean} - Whether can continue (depth limit not reached)
   */
  incrementDepth() {
    if (this.depth >= this.maxDepth) {
      return false
    }
    this.depth++
    return true
  }

  /**
   * Decrement depth
   */
  decrementDepth() {
    this.depth = Math.max(0, this.depth - 1)
  }

  /**
   * Check if execution can continue
   * @returns {{canContinue: boolean, reason?: string}}
   */
  canContinue() {
    // Check timeout
    if (Date.now() - this.startTime > this.timeout) {
      return { canContinue: false, reason: 'timeout' }
    }

    // Check depth
    if (this.depth >= this.maxDepth) {
      return { canContinue: false, reason: 'max_depth_reached' }
    }

    // Check total steps
    if (this.steps.length >= this.maxSteps) {
      return { canContinue: false, reason: 'max_steps_reached' }
    }

    // Check loop detection
    if (this._detectLoop()) {
      return { canContinue: false, reason: 'loop_detected' }
    }

    return { canContinue: true }
  }

  /**
   * Detect execution loops
   * @private
   * @returns {boolean}
   */
  _detectLoop() {
    if (this.executionHistory.length < this.loopWindow * 2) {
      return false
    }

    // Check if the last N steps match a previous pattern
    const recentSteps = this.executionHistory.slice(-this.loopWindow)
    const previousSteps = this.executionHistory.slice(-this.loopWindow * 2, -this.loopWindow)

    const recentPattern = recentSteps.map(s => `${s.agent}:${s.inputHash}`).join('|')
    const previousPattern = previousSteps.map(s => `${s.agent}:${s.inputHash}`).join('|')

    return recentPattern === previousPattern
  }

  /**
   * Hash an object for loop detection
   * @private
   * @param {Object} obj - Object to hash
   * @returns {string}
   */
  _hashObject(obj) {
    const str = JSON.stringify(obj, Object.keys(obj).sort())
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash
    }
    return hash.toString(16)
  }

  /**
   * Resolve variable references in input
   * Supports: $agentName.field, $state.key, $step_N.field
   * @param {Object} input - Input with potential references
   * @returns {Object}
   */
  resolveReferences(input) {
    const resolved = {}

    for (const [key, value] of Object.entries(input)) {
      if (typeof value === 'string' && value.startsWith('$')) {
        resolved[key] = this._resolveReference(value)
      } else if (typeof value === 'object' && value !== null) {
        resolved[key] = this.resolveReferences(value)
      } else {
        resolved[key] = value
      }
    }

    return resolved
  }

  /**
   * Resolve a single reference
   * @private
   * @param {string} ref - Reference string (e.g., $egrul.inn)
   * @returns {any}
   */
  _resolveReference(ref) {
    const parts = ref.substring(1).split('.')

    if (parts[0] === 'state') {
      return this._getNestedValue(this.state, parts.slice(1))
    }

    if (parts[0].startsWith('step_')) {
      const stepIndex = parseInt(parts[0].substring(5))
      const step = this.steps[stepIndex]
      if (step) {
        return this._getNestedValue(step.output, parts.slice(1))
      }
      return undefined
    }

    // Agent result reference
    const agentResult = this.results[parts[0]]
    if (agentResult) {
      return this._getNestedValue(agentResult, parts.slice(1))
    }

    return undefined
  }

  /**
   * Get nested value from object
   * @private
   */
  _getNestedValue(obj, path) {
    return path.reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : undefined
    }, obj)
  }

  /**
   * Complete execution successfully
   * @param {Object} result - Final result
   */
  complete(result = null) {
    this.status = 'completed'
    this.endTime = Date.now()
    if (result) {
      this.results._final = result
    }
    logger.info({
      contextId: this.id,
      duration: this.endTime - this.startTime,
      steps: this.steps.length
    }, 'Execution context completed')
  }

  /**
   * Mark execution as failed
   * @param {Error|string} error - Error
   */
  fail(error) {
    this.status = 'failed'
    this.endTime = Date.now()
    this.error = error instanceof Error ? error.message : error
    logger.error({
      contextId: this.id,
      error: this.error,
      duration: this.endTime - this.startTime
    }, 'Execution context failed')
  }

  /**
   * Get execution summary
   * @returns {Object}
   */
  getSummary() {
    return {
      id: this.id,
      query: this.query,
      status: this.status,
      steps: this.steps.length,
      successfulSteps: this.steps.filter(s => s.success).length,
      failedSteps: this.steps.filter(s => !s.success).length,
      agents: [...new Set(this.steps.map(s => s.agent))],
      duration: (this.endTime || Date.now()) - this.startTime,
      error: this.error
    }
  }

  /**
   * Get detailed execution trace
   * @returns {Object}
   */
  getTrace() {
    return {
      ...this.getSummary(),
      plan: this.plan,
      steps: this.steps,
      results: this.results,
      state: this.state
    }
  }

  /**
   * Serialize context for storage/logging
   * @returns {Object}
   */
  toJSON() {
    return {
      id: this.id,
      query: this.query,
      status: this.status,
      startTime: this.startTime,
      endTime: this.endTime,
      steps: this.steps,
      results: this.results,
      error: this.error,
      metadata: this.metadata
    }
  }
}

export default ExecutionContext
