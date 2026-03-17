/**
 * ExecutionLifecycle - State machine for agent execution lifecycle
 *
 * Provides Claude-like execution lifecycle with clear state transitions,
 * event emission, and trace tracking for debugging and visualization.
 *
 * States:
 * - IDLE: No execution in progress
 * - PLANNING: LLM is creating execution plan
 * - EXECUTING: Agents are being executed
 * - WAITING_HANDOFF: Waiting for handoff confirmation
 * - SYNTHESIZING: LLM is synthesizing results
 * - STREAMING: Streaming response to client
 * - COMPLETED: Execution finished successfully
 * - FAILED: Execution failed with error
 * - CANCELLED: Execution was cancelled by user
 */

import { EventEmitter } from 'events'
import crypto from 'crypto'

/**
 * Lifecycle states enum
 */
export const LIFECYCLE_STATES = {
  IDLE: 'idle',
  PLANNING: 'planning',
  EXECUTING: 'executing',
  WAITING_HANDOFF: 'waiting_handoff',
  SYNTHESIZING: 'synthesizing',
  STREAMING: 'streaming',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled'
}

/**
 * Valid state transitions
 */
const VALID_TRANSITIONS = {
  [LIFECYCLE_STATES.IDLE]: [LIFECYCLE_STATES.PLANNING, LIFECYCLE_STATES.EXECUTING],
  [LIFECYCLE_STATES.PLANNING]: [LIFECYCLE_STATES.EXECUTING, LIFECYCLE_STATES.FAILED, LIFECYCLE_STATES.CANCELLED],
  [LIFECYCLE_STATES.EXECUTING]: [
    LIFECYCLE_STATES.EXECUTING, // Can transition to self for sub-steps
    LIFECYCLE_STATES.WAITING_HANDOFF,
    LIFECYCLE_STATES.SYNTHESIZING,
    LIFECYCLE_STATES.STREAMING,
    LIFECYCLE_STATES.COMPLETED,
    LIFECYCLE_STATES.FAILED,
    LIFECYCLE_STATES.CANCELLED
  ],
  [LIFECYCLE_STATES.WAITING_HANDOFF]: [
    LIFECYCLE_STATES.EXECUTING,
    LIFECYCLE_STATES.FAILED,
    LIFECYCLE_STATES.CANCELLED
  ],
  [LIFECYCLE_STATES.SYNTHESIZING]: [
    LIFECYCLE_STATES.STREAMING,
    LIFECYCLE_STATES.COMPLETED,
    LIFECYCLE_STATES.FAILED,
    LIFECYCLE_STATES.CANCELLED
  ],
  [LIFECYCLE_STATES.STREAMING]: [
    LIFECYCLE_STATES.COMPLETED,
    LIFECYCLE_STATES.FAILED,
    LIFECYCLE_STATES.CANCELLED
  ],
  [LIFECYCLE_STATES.COMPLETED]: [LIFECYCLE_STATES.IDLE], // Reset
  [LIFECYCLE_STATES.FAILED]: [LIFECYCLE_STATES.IDLE], // Reset
  [LIFECYCLE_STATES.CANCELLED]: [LIFECYCLE_STATES.IDLE] // Reset
}

/**
 * Execution Lifecycle class
 */
export class ExecutionLifecycle extends EventEmitter {
  /**
   * Create new ExecutionLifecycle
   * @param {Object} options - Configuration options
   * @param {boolean} options.strictTransitions - Enforce valid state transitions
   * @param {boolean} options.trackHistory - Keep full history of transitions
   */
  constructor(options = {}) {
    super()

    this.id = crypto.randomUUID()
    this.state = LIFECYCLE_STATES.IDLE
    this.previousState = null
    this.startTime = null
    this.endTime = null
    this.error = null
    this.metadata = {}

    // Configuration
    this.strictTransitions = options.strictTransitions ?? true
    this.trackHistory = options.trackHistory ?? true

    // History tracking
    this.history = []
  }

  /**
   * Get current state
   * @returns {string} Current lifecycle state
   */
  getState() {
    return this.state
  }

  /**
   * Check if transition is valid
   * @param {string} fromState - Current state
   * @param {string} toState - Target state
   * @returns {boolean} Whether transition is valid
   */
  isValidTransition(fromState, toState) {
    const validTargets = VALID_TRANSITIONS[fromState] || []
    return validTargets.includes(toState)
  }

  /**
   * Transition to new state
   * @param {string} newState - Target state
   * @param {Object} metadata - Additional metadata for the transition
   * @returns {boolean} Whether transition was successful
   */
  transition(newState, metadata = {}) {
    const oldState = this.state

    // Validate transition
    if (this.strictTransitions && !this.isValidTransition(oldState, newState)) {
      const error = new Error(
        `Invalid state transition from '${oldState}' to '${newState}'`
      )
      this.emit('error', { error, fromState: oldState, toState: newState })
      return false
    }

    // Update state
    this.previousState = oldState
    this.state = newState
    this.metadata = { ...this.metadata, ...metadata }

    // Track start/end times
    if (oldState === LIFECYCLE_STATES.IDLE) {
      this.startTime = Date.now()
    }

    if (
      newState === LIFECYCLE_STATES.COMPLETED ||
      newState === LIFECYCLE_STATES.FAILED ||
      newState === LIFECYCLE_STATES.CANCELLED
    ) {
      this.endTime = Date.now()
    }

    // Track error for FAILED state
    if (newState === LIFECYCLE_STATES.FAILED && metadata.error) {
      this.error = metadata.error
    }

    // Record history
    if (this.trackHistory) {
      this.history.push({
        id: crypto.randomUUID(),
        fromState: oldState,
        toState: newState,
        timestamp: Date.now(),
        metadata: { ...metadata }
      })
    }

    // Emit transition event
    this.emit('transition', {
      fromState: oldState,
      toState: newState,
      timestamp: Date.now(),
      metadata
    })

    // Emit state-specific events
    this.emit(`state:${newState}`, { fromState: oldState, metadata })

    return true
  }

  /**
   * Start execution (transition from IDLE to PLANNING or EXECUTING)
   * @param {Object} metadata - Start metadata
   * @returns {boolean} Success
   */
  start(metadata = {}) {
    return this.transition(LIFECYCLE_STATES.PLANNING, {
      startedAt: Date.now(),
      ...metadata
    })
  }

  /**
   * Begin execution phase
   * @param {Object} metadata - Execution metadata
   * @returns {boolean} Success
   */
  execute(metadata = {}) {
    return this.transition(LIFECYCLE_STATES.EXECUTING, {
      executionStartedAt: Date.now(),
      ...metadata
    })
  }

  /**
   * Enter handoff waiting state
   * @param {Object} handoffInfo - Handoff information
   * @returns {boolean} Success
   */
  waitForHandoff(handoffInfo = {}) {
    return this.transition(LIFECYCLE_STATES.WAITING_HANDOFF, {
      handoff: handoffInfo,
      waitingStartedAt: Date.now()
    })
  }

  /**
   * Begin synthesis phase
   * @param {Object} metadata - Synthesis metadata
   * @returns {boolean} Success
   */
  synthesize(metadata = {}) {
    return this.transition(LIFECYCLE_STATES.SYNTHESIZING, {
      synthesisStartedAt: Date.now(),
      ...metadata
    })
  }

  /**
   * Begin streaming phase
   * @param {Object} metadata - Streaming metadata
   * @returns {boolean} Success
   */
  stream(metadata = {}) {
    return this.transition(LIFECYCLE_STATES.STREAMING, {
      streamingStartedAt: Date.now(),
      ...metadata
    })
  }

  /**
   * Complete execution successfully
   * @param {Object} result - Final result
   * @returns {boolean} Success
   */
  complete(result = {}) {
    return this.transition(LIFECYCLE_STATES.COMPLETED, {
      result,
      completedAt: Date.now()
    })
  }

  /**
   * Mark execution as failed
   * @param {Error|string} error - Error that caused failure
   * @returns {boolean} Success
   */
  fail(error) {
    return this.transition(LIFECYCLE_STATES.FAILED, {
      error: error instanceof Error ? error.message : error,
      errorStack: error instanceof Error ? error.stack : null,
      failedAt: Date.now()
    })
  }

  /**
   * Cancel execution
   * @param {string} reason - Cancellation reason
   * @returns {boolean} Success
   */
  cancel(reason = 'User cancelled') {
    return this.transition(LIFECYCLE_STATES.CANCELLED, {
      reason,
      cancelledAt: Date.now()
    })
  }

  /**
   * Reset to IDLE state
   * @returns {boolean} Success
   */
  reset() {
    this.state = LIFECYCLE_STATES.IDLE
    this.previousState = null
    this.startTime = null
    this.endTime = null
    this.error = null
    this.metadata = {}

    if (this.trackHistory) {
      this.history.push({
        id: crypto.randomUUID(),
        fromState: this.previousState,
        toState: LIFECYCLE_STATES.IDLE,
        timestamp: Date.now(),
        metadata: { reset: true }
      })
    }

    this.emit('reset')
    return true
  }

  /**
   * Get execution duration in milliseconds
   * @returns {number|null} Duration or null if not started
   */
  getDuration() {
    if (!this.startTime) return null
    const end = this.endTime || Date.now()
    return end - this.startTime
  }

  /**
   * Get full execution trace
   * @returns {Object} Execution trace
   */
  getTrace() {
    return {
      id: this.id,
      currentState: this.state,
      previousState: this.previousState,
      startTime: this.startTime,
      endTime: this.endTime,
      duration: this.getDuration(),
      error: this.error,
      metadata: this.metadata,
      history: this.history
    }
  }

  /**
   * Get summary of execution
   * @returns {Object} Summary
   */
  getSummary() {
    return {
      id: this.id,
      state: this.state,
      duration: this.getDuration(),
      stepsCount: this.history.length,
      success: this.state === LIFECYCLE_STATES.COMPLETED,
      error: this.error
    }
  }

  /**
   * Check if execution is in progress
   * @returns {boolean}
   */
  isRunning() {
    return ![
      LIFECYCLE_STATES.IDLE,
      LIFECYCLE_STATES.COMPLETED,
      LIFECYCLE_STATES.FAILED,
      LIFECYCLE_STATES.CANCELLED
    ].includes(this.state)
  }

  /**
   * Check if execution is finished
   * @returns {boolean}
   */
  isFinished() {
    return [
      LIFECYCLE_STATES.COMPLETED,
      LIFECYCLE_STATES.FAILED,
      LIFECYCLE_STATES.CANCELLED
    ].includes(this.state)
  }

  /**
   * Subscribe to state change
   * @param {Function} callback - Callback function
   * @returns {Function} Unsubscribe function
   */
  onTransition(callback) {
    this.on('transition', callback)
    return () => this.off('transition', callback)
  }

  /**
   * Subscribe to specific state
   * @param {string} state - State to listen for
   * @param {Function} callback - Callback function
   * @returns {Function} Unsubscribe function
   */
  onState(state, callback) {
    this.on(`state:${state}`, callback)
    return () => this.off(`state:${state}`, callback)
  }
}

export default ExecutionLifecycle
