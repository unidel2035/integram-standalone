/**
 * CompensationService - Compensation and Rollback Mechanisms
 *
 * Implements BPMN 2.0 compensation handlers for error recovery:
 * - Compensation handlers for completed tasks
 * - Rollback mechanisms
 * - Transaction boundaries
 * - Error recovery strategies
 *
 * @see Issue #2463 - Phase 6: Advanced Features
 */

import EventEmitter from 'events'
import { Parser } from 'expr-eval'
import logger from '../../utils/logger.js'

/**
 * Compensation State
 */
export const CompensationState = {
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  FAILED: 'failed'
}

/**
 * CompensationService Class
 * Manages compensation logic for process error recovery
 */
export class CompensationService extends EventEmitter {
  constructor(options = {}) {
    super()

    // Dependencies
    this.storage = options.storage
    this.processOrchestrator = options.processOrchestrator
    this.agentManager = options.agentManager

    // Configuration
    this.continueOnCompensationFailure = options.continueOnCompensationFailure !== false

    logger.info('CompensationService initialized', {
      continueOnCompensationFailure: this.continueOnCompensationFailure
    })
  }

  /**
   * Compensate process from a specific task backwards
   *
   * @param {string} processInstanceId - Process instance ID
   * @param {string} fromTaskId - Task ID to compensate from (exclusive)
   * @param {Object} processDefinition - Process definition
   * @returns {Promise<Object>} Compensation result
   */
  async compensateProcess(processInstanceId, fromTaskId, processDefinition) {
    try {
      logger.info('Starting process compensation', {
        processInstanceId,
        fromTaskId
      })

      this.emit('compensation:started', { processInstanceId, fromTaskId })

      // Get all completed tasks in reverse execution order
      const tasksToCompensate = await this.getCompensatableTasks(
        processInstanceId,
        fromTaskId
      )

      logger.debug('Found tasks to compensate', {
        processInstanceId,
        taskCount: tasksToCompensate.length
      })

      const results = []

      // Execute compensation in reverse order
      for (const task of tasksToCompensate.reverse()) {
        try {
          // Check if task has compensation handler
          const node = processDefinition.nodes.find(n => n.id === task.nodeId)
          if (!node || !node.data?.compensationHandler) {
            logger.debug('Task has no compensation handler, skipping', {
              taskId: task.id,
              nodeId: task.nodeId
            })
            continue
          }

          // Execute compensation handler
          const result = await this.executeCompensationHandler(task, node.data.compensationHandler)

          results.push({
            taskId: task.id,
            nodeId: task.nodeId,
            state: CompensationState.COMPLETED,
            result
          })

          this.emit('compensation:task:completed', {
            processInstanceId,
            taskId: task.id,
            result
          })
        } catch (error) {
          logger.error('Compensation failed for task:', error, {
            taskId: task.id
          })

          results.push({
            taskId: task.id,
            nodeId: task.nodeId,
            state: CompensationState.FAILED,
            error: error.message
          })

          this.emit('compensation:task:failed', {
            processInstanceId,
            taskId: task.id,
            error
          })

          // Stop compensation on first failure unless configured otherwise
          if (!this.continueOnCompensationFailure) {
            throw new Error(`Compensation failed at task ${task.id}: ${error.message}`)
          }
        }
      }

      logger.info('Process compensation completed', {
        processInstanceId,
        totalTasks: tasksToCompensate.length,
        compensatedTasks: results.length,
        failedCompensations: results.filter(r => r.state === CompensationState.FAILED).length
      })

      this.emit('compensation:completed', {
        processInstanceId,
        results
      })

      return {
        state: CompensationState.COMPLETED,
        tasksCompensated: results.length,
        results
      }
    } catch (error) {
      logger.error('Process compensation failed:', error, { processInstanceId })

      this.emit('compensation:failed', {
        processInstanceId,
        error
      })

      throw error
    }
  }

  /**
   * Get all compensatable tasks in execution order
   *
   * @param {string} processInstanceId - Process instance ID
   * @param {string} fromTaskId - Start from this task (exclusive)
   * @returns {Promise<Array>} List of task instances
   */
  async getCompensatableTasks(processInstanceId, fromTaskId = null) {
    // Get all task role bindings for this process instance
    const allBindings = await this.storage.getAllRoleBindings()

    const taskBindings = allBindings.filter(
      b => b.roleId === this.processOrchestrator.roleIds.TaskInstance &&
        b.witness.processInstanceId === processInstanceId &&
        b.witness.state === 'completed' // Only completed tasks can be compensated
    )

    // Sort by start time (oldest first for reverse compensation)
    taskBindings.sort((a, b) =>
      new Date(a.witness.startTime) - new Date(b.witness.startTime)
    )

    // If fromTaskId specified, only include tasks before it
    let tasks = taskBindings.map(b => ({
      id: b.thingId,
      ...b.witness
    }))

    if (fromTaskId) {
      const fromTaskIndex = tasks.findIndex(t => t.id === fromTaskId)
      if (fromTaskIndex >= 0) {
        tasks = tasks.slice(0, fromTaskIndex)
      }
    }

    return tasks
  }

  /**
   * Execute a compensation handler for a specific task
   *
   * @param {Object} task - Original task instance
   * @param {Object} compensationHandler - Compensation handler definition
   * @returns {Promise<Object>} Compensation result
   */
  async executeCompensationHandler(task, compensationHandler) {
    logger.info('Executing compensation handler', {
      taskId: task.id,
      handler: compensationHandler
    })

    // Create compensation task
    const compensationTask = {
      id: `compensation-${task.id}`,
      type: 'compensation',
      data: {
        originalTaskId: task.id,
        service: compensationHandler.service,
        action: compensationHandler.action,
        input: this.mapCompensationInput(task, compensationHandler.inputMapping || {})
      },
      requiredCapabilities: [compensationHandler.service || 'generic'],
      priority: 10, // High priority for compensation
      metadata: {
        isCompensation: true,
        originalTaskId: task.id,
        processInstanceId: task.processInstanceId
      }
    }

    // Execute compensation via agent manager
    if (!this.agentManager) {
      throw new Error('AgentManager is required for compensation execution')
    }

    const result = await this.agentManager.assignTask(compensationTask)

    logger.info('Compensation handler completed', {
      taskId: task.id,
      compensationTaskId: compensationTask.id
    })

    return result
  }

  /**
   * Map compensation input from original task result
   *
   * @param {Object} task - Original task instance
   * @param {Object} inputMapping - Input mapping configuration
   * @returns {Object} Compensation input data
   */
  mapCompensationInput(task, inputMapping) {
    const input = {}

    // If no mapping, pass all task result
    if (Object.keys(inputMapping).length === 0) {
      return task.result || {}
    }

    // Apply mapping
    for (const [targetVar, sourceExpr] of Object.entries(inputMapping)) {
      try {
        // Simple variable reference: ${result.varName}
        const match = sourceExpr.match(/^\$\{result\.(.+)\}$/)
        if (match) {
          const sourceVarName = match[1]
          input[targetVar] = task.result?.[sourceVarName]
        } else if (sourceExpr.startsWith('${') && sourceExpr.endsWith('}')) {
          // Generic expression
          const expr = sourceExpr.slice(2, -1)
          input[targetVar] = this.evaluateExpression(expr, { task, result: task.result })
        } else {
          // Static value
          input[targetVar] = sourceExpr
        }
      } catch (error) {
        logger.warn('Failed to map compensation input:', error, {
          targetVar,
          sourceExpr
        })
      }
    }

    return input
  }

  /**
   * Safe expression evaluator using expr-eval library
   *
   * This method uses a sandboxed expression parser that prevents:
   * - Code injection attacks
   * - Access to system functions (require, process, etc.)
   * - Arbitrary code execution
   *
   * Supported operations:
   * - Arithmetic: +, -, *, /, %, ^
   * - Comparison: ==, !=, <, <=, >, >=
   * - Logical: and, or, not
   * - Ternary: condition ? true_val : false_val
   * - Functions: abs, ceil, floor, round, sqrt, etc.
   *
   * @param {string} expression - Mathematical/logical expression to evaluate
   * @param {Object} context - Variables available in the expression
   * @returns {any} Evaluation result or undefined on error
   */
  evaluateExpression(expression, context) {
    try {
      // Input validation
      if (typeof expression !== 'string' || !expression.trim()) {
        logger.warn('Invalid expression: must be a non-empty string', { expression })
        return undefined
      }

      // Create a new parser instance for each evaluation
      const parser = new Parser()

      // Parse and evaluate the expression with the provided context
      const result = parser.evaluate(expression, context)

      logger.debug('Expression evaluated successfully', {
        expression,
        result,
        contextKeys: Object.keys(context || {})
      })

      return result
    } catch (error) {
      logger.error('Failed to evaluate expression:', error, {
        expression,
        errorMessage: error.message,
        contextKeys: Object.keys(context || {})
      })
      return undefined
    }
  }

  /**
   * Define transaction boundaries
   *
   * @param {string} processInstanceId - Process instance ID
   * @param {Array} nodeIds - Node IDs within transaction
   * @returns {Promise<string>} Transaction ID
   */
  async defineTransactionBoundary(processInstanceId, nodeIds) {
    const transactionThing = await this.storage.createThing()
    const transactionId = transactionThing.id

    const witness = {
      processInstanceId,
      nodeIds,
      state: 'active',
      startTime: new Date().toISOString()
    }

    // Store as a custom role binding (would need to add TransactionBoundary role to prism)
    // For now, just log it
    logger.info('Transaction boundary defined', {
      processInstanceId,
      transactionId,
      nodeIds
    })

    return transactionId
  }

  /**
   * Commit transaction
   */
  async commitTransaction(transactionId) {
    logger.info('Transaction committed', { transactionId })
    this.emit('transaction:committed', { transactionId })
  }

  /**
   * Rollback transaction (compensate all tasks within boundary)
   */
  async rollbackTransaction(transactionId, processInstanceId, processDefinition) {
    logger.info('Rolling back transaction', { transactionId })

    // Get tasks within transaction boundary
    // For simplicity, compensate all tasks in process
    await this.compensateProcess(processInstanceId, null, processDefinition)

    this.emit('transaction:rolledback', { transactionId })
  }

  /**
   * Error recovery strategy: Retry with compensation on failure
   *
   * @param {Function} operation - Operation to execute
   * @param {Function} compensationFn - Compensation function
   * @param {number} maxRetries - Maximum retries
   * @returns {Promise<any>} Operation result
   */
  async executeWithCompensation(operation, compensationFn, maxRetries = 3) {
    let lastError

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = await operation()
        return result
      } catch (error) {
        logger.warn(`Operation failed (attempt ${attempt}/${maxRetries}):`, error)
        lastError = error

        // Execute compensation
        try {
          await compensationFn(error)
        } catch (compError) {
          logger.error('Compensation failed:', compError)
        }

        // Don't retry on last attempt
        if (attempt === maxRetries) {
          break
        }

        // Wait before retry (exponential backoff)
        const delay = Math.pow(2, attempt) * 1000
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }

    throw lastError
  }
}

export default CompensationService
