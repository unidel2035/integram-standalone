/**
 * ThinkingBlocks - Claude-like thinking visualization
 *
 * Provides real-time emission of "thinking" events during LLM reasoning,
 * allowing frontend to display visible reasoning process like Claude.
 *
 * Thinking types:
 * - planning: LLM is creating execution plan
 * - analyzing: LLM is analyzing data/context
 * - synthesizing: LLM is combining results
 * - handoff: Preparing to hand off to another agent
 * - deciding: Making conditional decisions
 * - reflecting: Self-evaluation/correction
 */

import { EventEmitter } from 'events'
import crypto from 'crypto'

/**
 * Thinking block types
 */
export const THINKING_TYPES = {
  PLANNING: 'planning',
  ANALYZING: 'analyzing',
  SYNTHESIZING: 'synthesizing',
  HANDOFF: 'handoff',
  DECIDING: 'deciding',
  REFLECTING: 'reflecting'
}

/**
 * Single thinking block
 */
export class ThinkingBlock {
  /**
   * Create a thinking block
   * @param {string} type - Type of thinking (from THINKING_TYPES)
   * @param {string} content - Initial content/description
   * @param {Object} metadata - Additional metadata
   */
  constructor(type, content, metadata = {}) {
    this.id = crypto.randomUUID()
    this.type = type
    this.content = content
    this.metadata = metadata
    this.timestamp = Date.now()
    this.isActive = true
    this.updates = []
    this.endTime = null
    this.result = null
  }

  /**
   * Add content update to block
   * @param {string} content - New content to append
   */
  update(content) {
    this.updates.push({
      content,
      timestamp: Date.now()
    })
  }

  /**
   * Get full content including updates
   * @returns {string} Complete content
   */
  getFullContent() {
    const allContent = [this.content, ...this.updates.map(u => u.content)]
    return allContent.join('\n')
  }

  /**
   * End the thinking block
   * @param {any} result - Result of thinking
   */
  end(result = null) {
    this.isActive = false
    this.endTime = Date.now()
    this.result = result
  }

  /**
   * Get duration in milliseconds
   * @returns {number} Duration
   */
  getDuration() {
    const end = this.endTime || Date.now()
    return end - this.timestamp
  }

  /**
   * Convert to plain object
   * @returns {Object}
   */
  toJSON() {
    return {
      id: this.id,
      type: this.type,
      content: this.content,
      fullContent: this.getFullContent(),
      metadata: this.metadata,
      timestamp: this.timestamp,
      isActive: this.isActive,
      updates: this.updates,
      endTime: this.endTime,
      duration: this.getDuration(),
      result: this.result
    }
  }
}

/**
 * ThinkingEmitter - Manages and emits thinking blocks
 */
export class ThinkingEmitter extends EventEmitter {
  constructor() {
    super()
    this.activeBlocks = new Map()
    this.completedBlocks = []
    this.maxCompletedBlocks = 100 // Keep last N blocks
  }

  /**
   * Start a new thinking block
   * @param {string} type - Thinking type
   * @param {string} description - Initial description
   * @param {Object} metadata - Additional metadata
   * @returns {ThinkingBlock} The created block
   */
  startThinking(type, description, metadata = {}) {
    const block = new ThinkingBlock(type, description, metadata)
    this.activeBlocks.set(block.id, block)

    this.emit('thinking:start', block.toJSON())
    this.emit('thinking', {
      event: 'start',
      block: block.toJSON()
    })

    return block
  }

  /**
   * Update an active thinking block
   * @param {string} blockId - Block ID to update
   * @param {string} content - New content
   * @returns {boolean} Success
   */
  updateThinking(blockId, content) {
    const block = this.activeBlocks.get(blockId)
    if (!block) return false

    block.update(content)

    this.emit('thinking:update', {
      id: blockId,
      content,
      block: block.toJSON()
    })
    this.emit('thinking', {
      event: 'update',
      block: block.toJSON()
    })

    return true
  }

  /**
   * End a thinking block
   * @param {string} blockId - Block ID to end
   * @param {any} result - Result of thinking
   * @returns {ThinkingBlock|null} The ended block
   */
  endThinking(blockId, result = null) {
    const block = this.activeBlocks.get(blockId)
    if (!block) return null

    block.end(result)
    this.activeBlocks.delete(blockId)

    // Store in completed blocks
    this.completedBlocks.push(block)
    if (this.completedBlocks.length > this.maxCompletedBlocks) {
      this.completedBlocks.shift()
    }

    this.emit('thinking:end', block.toJSON())
    this.emit('thinking', {
      event: 'end',
      block: block.toJSON()
    })

    return block
  }

  /**
   * Convenience method: Start and auto-end thinking block
   * @param {string} type - Thinking type
   * @param {string} description - Description
   * @param {Function} fn - Async function to execute during thinking
   * @returns {Promise<any>} Result of fn
   */
  async withThinking(type, description, fn) {
    const block = this.startThinking(type, description)

    try {
      const result = await fn((content) => this.updateThinking(block.id, content))
      this.endThinking(block.id, result)
      return result
    } catch (error) {
      this.endThinking(block.id, { error: error.message })
      throw error
    }
  }

  /**
   * Get all active thinking blocks
   * @returns {ThinkingBlock[]}
   */
  getActiveBlocks() {
    return Array.from(this.activeBlocks.values())
  }

  /**
   * Get completed blocks
   * @returns {ThinkingBlock[]}
   */
  getCompletedBlocks() {
    return this.completedBlocks
  }

  /**
   * Get all blocks (active + completed)
   * @returns {Object[]}
   */
  getAllBlocks() {
    return [
      ...this.getActiveBlocks().map(b => b.toJSON()),
      ...this.completedBlocks.map(b => b.toJSON())
    ]
  }

  /**
   * Clear all blocks
   */
  clear() {
    // End all active blocks
    for (const [id] of this.activeBlocks) {
      this.endThinking(id, { cancelled: true })
    }

    this.activeBlocks.clear()
    this.completedBlocks = []

    this.emit('thinking:clear')
  }

  /**
   * Subscribe to thinking events
   * @param {Function} callback - Callback for all thinking events
   * @returns {Function} Unsubscribe function
   */
  onThinking(callback) {
    this.on('thinking', callback)
    return () => this.off('thinking', callback)
  }
}

// Export default emitter instance for convenience
export const defaultThinkingEmitter = new ThinkingEmitter()

export default ThinkingEmitter
