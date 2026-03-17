/**
 * StreamingHandler - LangGraph-inspired streaming support for orchestration
 *
 * Features:
 * - Stream execution events in real-time
 * - Support for WebSocket, SSE, and callback-based streaming
 * - Event types: plan, step_start, step_end, synthesis, complete, error
 * - Buffered and unbuffered modes
 *
 * Inspired by LangGraph streaming but adapted for our architecture.
 */

import { EventEmitter } from 'events'
import logger from '../../utils/logger.js'

/**
 * Stream event types
 */
export const StreamEventType = {
  PLAN_CREATED: 'plan_created',
  STEP_START: 'step_start',
  STEP_END: 'step_end',
  STEP_ERROR: 'step_error',
  AGENT_OUTPUT: 'agent_output',
  SYNTHESIS_START: 'synthesis_start',
  SYNTHESIS_CHUNK: 'synthesis_chunk',
  SYNTHESIS_END: 'synthesis_end',
  EXECUTION_COMPLETE: 'complete',
  EXECUTION_ERROR: 'error',
  CHECKPOINT_SAVED: 'checkpoint_saved',
  STATE_UPDATE: 'state_update',
}

/**
 * StreamingHandler class for managing streaming output
 */
export class StreamingHandler extends EventEmitter {
  constructor(options = {}) {
    super()

    this.enabled = options.enabled !== false
    this.mode = options.mode || 'callback'  // callback, websocket, sse
    this.buffer = options.buffer !== false  // Buffer events for late subscribers
    this.eventBuffer = []
    this.maxBufferSize = options.maxBufferSize || 1000

    // External handlers
    this.websocket = options.websocket || null
    this.sseResponse = options.sseResponse || null
    this.callback = options.callback || null

    // State
    this.executionId = null
    this.startTime = null
    this.closed = false
  }

  /**
   * Start streaming for an execution
   * @param {string} executionId - Execution context ID
   */
  start(executionId) {
    this.executionId = executionId
    this.startTime = Date.now()
    this.closed = false
    this.eventBuffer = []
  }

  /**
   * Send a stream event
   * @param {string} type - Event type from StreamEventType
   * @param {Object} data - Event data
   */
  send(type, data) {
    if (!this.enabled || this.closed) {
      return
    }

    const event = {
      type,
      timestamp: Date.now(),
      executionId: this.executionId,
      elapsed: this.startTime ? Date.now() - this.startTime : 0,
      data
    }

    // Buffer event
    if (this.buffer) {
      this.eventBuffer.push(event)
      if (this.eventBuffer.length > this.maxBufferSize) {
        this.eventBuffer.shift()
      }
    }

    // Emit to Node.js EventEmitter listeners
    this.emit('event', event)
    this.emit(type, data)

    // Send via configured transport
    this._sendToTransport(event)
  }

  /**
   * Send event to configured transport
   * @private
   */
  _sendToTransport(event) {
    try {
      if (this.mode === 'callback' && this.callback) {
        this.callback(event)
      }

      if (this.mode === 'websocket' && this.websocket) {
        if (this.websocket.readyState === 1) {  // WebSocket.OPEN
          this.websocket.send(JSON.stringify(event))
        }
      }

      if (this.mode === 'sse' && this.sseResponse) {
        if (!this.sseResponse.writableEnded) {
          this.sseResponse.write(`data: ${JSON.stringify(event)}\n\n`)
        }
      }
    } catch (error) {
      logger.error({ error: error.message, type: event.type }, 'Failed to send stream event')
    }
  }

  /**
   * Convenience methods for common events
   */

  planCreated(plan) {
    this.send(StreamEventType.PLAN_CREATED, {
      stepsCount: plan.steps?.length || 0,
      analysis: plan.analysis,
      parallel: plan.parallel
    })
  }

  stepStart(stepId, agentName, input) {
    this.send(StreamEventType.STEP_START, {
      stepId,
      agent: agentName,
      input: this._sanitizeInput(input)
    })
  }

  stepEnd(stepId, agentName, result) {
    this.send(StreamEventType.STEP_END, {
      stepId,
      agent: agentName,
      success: result.success !== false,
      data: this._sanitizeOutput(result.data || result),
      executionTime: result.executionTime
    })
  }

  stepError(stepId, agentName, error) {
    this.send(StreamEventType.STEP_ERROR, {
      stepId,
      agent: agentName,
      error: error.message || error
    })
  }

  agentOutput(agentName, output) {
    this.send(StreamEventType.AGENT_OUTPUT, {
      agent: agentName,
      output: this._sanitizeOutput(output)
    })
  }

  synthesisStart() {
    this.send(StreamEventType.SYNTHESIS_START, {})
  }

  synthesisChunk(chunk) {
    this.send(StreamEventType.SYNTHESIS_CHUNK, { chunk })
  }

  synthesisEnd(result) {
    this.send(StreamEventType.SYNTHESIS_END, {
      answer: result.answer,
      confidence: result.confidence,
      sources: result.sources
    })
  }

  checkpointSaved(checkpointId) {
    this.send(StreamEventType.CHECKPOINT_SAVED, { checkpointId })
  }

  stateUpdate(key, value) {
    this.send(StreamEventType.STATE_UPDATE, { key, value })
  }

  complete(result) {
    this.send(StreamEventType.EXECUTION_COMPLETE, {
      success: true,
      answer: result.answer,
      steps: result.steps,
      executionTime: result.executionTime,
      sources: result.sources
    })
    this.close()
  }

  error(error) {
    this.send(StreamEventType.EXECUTION_ERROR, {
      success: false,
      error: error.message || error
    })
    this.close()
  }

  /**
   * Close the stream
   */
  close() {
    this.closed = true

    if (this.mode === 'sse' && this.sseResponse && !this.sseResponse.writableEnded) {
      this.sseResponse.end()
    }

    this.emit('close')
  }

  /**
   * Get buffered events (for late subscribers)
   * @returns {Object[]}
   */
  getBufferedEvents() {
    return [...this.eventBuffer]
  }

  /**
   * Replay buffered events to a new handler
   * @param {Function|Object} target - Callback or stream handler
   */
  replay(target) {
    for (const event of this.eventBuffer) {
      if (typeof target === 'function') {
        target(event)
      } else if (target.send) {
        target.send(event.type, event.data)
      }
    }
  }

  /**
   * Sanitize input for logging (remove sensitive data)
   * @private
   */
  _sanitizeInput(input) {
    if (!input) return input

    const sanitized = { ...input }
    const sensitiveKeys = ['password', 'token', 'apiKey', 'secret', 'accessToken']

    for (const key of sensitiveKeys) {
      if (sanitized[key]) {
        sanitized[key] = '[REDACTED]'
      }
    }

    return sanitized
  }

  /**
   * Sanitize output for streaming
   * @private
   */
  _sanitizeOutput(output) {
    if (!output) return output

    // Limit size of streamed data
    const json = JSON.stringify(output)
    if (json.length > 10000) {
      return {
        _truncated: true,
        _originalSize: json.length,
        preview: json.substring(0, 500) + '...'
      }
    }

    return output
  }

  /**
   * Create SSE response headers
   * @static
   */
  static createSSEHeaders() {
    return {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    }
  }

  /**
   * Create a streaming handler for Express SSE
   * @static
   * @param {Object} res - Express response object
   * @returns {StreamingHandler}
   */
  static forSSE(res) {
    res.writeHead(200, StreamingHandler.createSSEHeaders())
    return new StreamingHandler({
      mode: 'sse',
      sseResponse: res
    })
  }

  /**
   * Create a streaming handler for WebSocket
   * @static
   * @param {WebSocket} ws - WebSocket connection
   * @returns {StreamingHandler}
   */
  static forWebSocket(ws) {
    return new StreamingHandler({
      mode: 'websocket',
      websocket: ws
    })
  }

  /**
   * Create a streaming handler with callback
   * @static
   * @param {Function} callback - Callback function
   * @returns {StreamingHandler}
   */
  static forCallback(callback) {
    return new StreamingHandler({
      mode: 'callback',
      callback
    })
  }
}

export default StreamingHandler
