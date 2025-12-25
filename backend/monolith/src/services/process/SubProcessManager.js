/**
 * SubProcessManager - Nested Workflow Execution
 *
 * Manages subprocess execution including:
 * - Nested process instantiation
 * - Parent-child communication
 * - Variable mapping (input/output)
 * - Scope isolation
 *
 * @see Issue #2463 - Phase 6: Advanced Features
 */

import EventEmitter from 'events'
import logger from '../../utils/logger.js'

/**
 * SubProcessManager Class
 * Handles subprocess lifecycle within parent processes
 */
export class SubProcessManager extends EventEmitter {
  constructor(options = {}) {
    super()

    // Reference to ProcessOrchestrator
    this.processOrchestrator = options.processOrchestrator
    if (!this.processOrchestrator) {
      throw new Error('ProcessOrchestrator is required for SubProcessManager')
    }

    // Storage reference
    this.storage = options.storage || this.processOrchestrator.storage

    // Track parent-child relationships
    this.processHierarchy = new Map() // parentInstanceId -> Set<childInstanceIds>
    this.childToParent = new Map() // childInstanceId -> parentInstanceId

    logger.info('SubProcessManager initialized')
  }

  /**
   * Execute a subprocess node
   *
   * @param {string} parentInstanceId - Parent process instance ID
   * @param {Object} processDefinition - Parent process definition
   * @param {Object} subProcessNode - SubProcess node definition
   * @returns {Promise<Object>} Subprocess execution result
   */
  async executeSubProcess(parentInstanceId, processDefinition, subProcessNode) {
    try {
      logger.info('Starting subprocess execution', {
        parentInstanceId,
        subProcessNodeId: subProcessNode.id
      })

      // Get parent process instance to access variables
      const parentInstance = await this.processOrchestrator.getProcessInstance(parentInstanceId)

      // Get subprocess definition
      const subProcessDefinition = await this.getSubProcessDefinition(
        subProcessNode,
        processDefinition
      )

      // Map input variables from parent to child
      const childVariables = this.mapInputVariables(
        parentInstance.variables,
        subProcessNode.data?.inputMapping || {}
      )

      // Start child process instance
      const childInstance = await this.processOrchestrator.startProcess(
        subProcessDefinition,
        childVariables,
        {
          businessKey: `${parentInstance.businessKey || parentInstanceId}-sub-${subProcessNode.id}`,
          priority: parentInstance.priority,
          metadata: {
            parentProcessInstanceId: parentInstanceId,
            parentNodeId: subProcessNode.id,
            isSubProcess: true
          }
        }
      )

      // Track parent-child relationship
      this.registerParentChild(parentInstanceId, childInstance.instanceId)

      // Emit event
      this.emit('subprocess:started', {
        parentInstanceId,
        childInstanceId: childInstance.instanceId,
        subProcessNodeId: subProcessNode.id
      })

      // Wait for subprocess completion
      const result = await this.waitForSubProcessCompletion(
        childInstance.instanceId,
        subProcessNode.data?.timeout || 600000 // 10 minutes default
      )

      // Map output variables back to parent
      await this.mapOutputVariables(
        parentInstanceId,
        childInstance.instanceId,
        subProcessNode.data?.outputMapping || {}
      )

      logger.info('Subprocess completed', {
        parentInstanceId,
        childInstanceId: childInstance.instanceId
      })

      this.emit('subprocess:completed', {
        parentInstanceId,
        childInstanceId: childInstance.instanceId,
        result
      })

      return result
    } catch (error) {
      logger.error('Subprocess execution failed:', error, {
        parentInstanceId,
        subProcessNodeId: subProcessNode.id
      })

      this.emit('subprocess:failed', {
        parentInstanceId,
        error
      })

      throw error
    }
  }

  /**
   * Get subprocess definition
   * Can be inline (embedded) or referenced (call activity)
   */
  async getSubProcessDefinition(subProcessNode, parentDefinition) {
    // Check if subprocess is embedded (inline)
    if (subProcessNode.data?.isEmbedded && subProcessNode.data?.embeddedProcess) {
      return subProcessNode.data.embeddedProcess
    }

    // Check if it's a reference to another process definition
    const processDefinitionId = subProcessNode.data?.processDefinitionId
    if (processDefinitionId) {
      // TODO: Load process definition from storage/registry
      // For now, return a simple error
      throw new Error(`External process definition not yet implemented: ${processDefinitionId}`)
    }

    throw new Error('SubProcess node must have either embedded process or processDefinitionId')
  }

  /**
   * Map input variables from parent to child process
   *
   * @param {Object} parentVariables - Parent process variables
   * @param {Object} inputMapping - Input mapping configuration
   * @returns {Object} Child process variables
   */
  mapInputVariables(parentVariables, inputMapping) {
    const childVariables = {}

    // If no mapping specified, pass all variables
    if (Object.keys(inputMapping).length === 0) {
      return { ...parentVariables }
    }

    // Apply mapping
    for (const [childVarName, parentVarExpr] of Object.entries(inputMapping)) {
      try {
        // Simple variable reference: ${varName}
        const match = parentVarExpr.match(/^\$\{(.+)\}$/)
        if (match) {
          const parentVarName = match[1]
          childVariables[childVarName] = parentVariables[parentVarName]
        } else {
          // Static value
          childVariables[childVarName] = parentVarExpr
        }
      } catch (error) {
        logger.warn('Failed to map input variable:', error, {
          childVarName,
          parentVarExpr
        })
      }
    }

    logger.debug('Mapped input variables', {
      inputMapping,
      childVariables
    })

    return childVariables
  }

  /**
   * Map output variables from child back to parent
   *
   * @param {string} parentInstanceId - Parent process instance ID
   * @param {string} childInstanceId - Child process instance ID
   * @param {Object} outputMapping - Output mapping configuration
   */
  async mapOutputVariables(parentInstanceId, childInstanceId, outputMapping) {
    // Get child instance final variables
    const childInstance = await this.processOrchestrator.getProcessInstance(childInstanceId)

    if (!childInstance) {
      throw new Error(`Child process instance not found: ${childInstanceId}`)
    }

    // Get parent instance
    const parentBindings = await this.storage.getRoleBindingsByThing(parentInstanceId)
    const parentBinding = parentBindings.find(
      b => b.roleId === this.processOrchestrator.roleIds.ProcessInstance
    )

    if (!parentBinding) {
      throw new Error(`Parent process instance not found: ${parentInstanceId}`)
    }

    // If no mapping specified, merge all child variables into parent
    if (Object.keys(outputMapping).length === 0) {
      const updatedVariables = {
        ...parentBinding.witness.variables,
        ...childInstance.variables
      }

      await this.storage.updateRoleBinding(parentBinding.id, {
        ...parentBinding.witness,
        variables: updatedVariables
      })

      logger.debug('Merged all child variables to parent', {
        parentInstanceId,
        childInstanceId
      })

      return
    }

    // Apply output mapping
    const parentVariables = { ...parentBinding.witness.variables }

    for (const [parentVarName, childVarName] of Object.entries(outputMapping)) {
      if (childVarName in childInstance.variables) {
        parentVariables[parentVarName] = childInstance.variables[childVarName]
      }
    }

    // Update parent variables
    await this.storage.updateRoleBinding(parentBinding.id, {
      ...parentBinding.witness,
      variables: parentVariables
    })

    logger.debug('Mapped output variables', {
      parentInstanceId,
      childInstanceId,
      outputMapping
    })
  }

  /**
   * Wait for subprocess to complete
   *
   * @param {string} childInstanceId - Child process instance ID
   * @param {number} timeout - Timeout in milliseconds
   * @returns {Promise<Object>} Completion result
   */
  async waitForSubProcessCompletion(childInstanceId, timeout = 600000) {
    return new Promise((resolve, reject) => {
      const timeoutHandle = setTimeout(() => {
        cleanup()
        reject(new Error(`Subprocess execution timeout: ${childInstanceId}`))
      }, timeout)

      const onCompleted = ({ instanceId }) => {
        if (instanceId === childInstanceId) {
          cleanup()
          resolve({ state: 'completed', instanceId: childInstanceId })
        }
      }

      const onFailed = ({ instanceId, error }) => {
        if (instanceId === childInstanceId) {
          cleanup()
          reject(new Error(`Subprocess failed: ${error.message || error}`))
        }
      }

      const cleanup = () => {
        clearTimeout(timeoutHandle)
        this.processOrchestrator.off('process:completed', onCompleted)
        this.processOrchestrator.off('process:failed', onFailed)
      }

      this.processOrchestrator.on('process:completed', onCompleted)
      this.processOrchestrator.on('process:failed', onFailed)
    })
  }

  /**
   * Register parent-child relationship
   */
  registerParentChild(parentInstanceId, childInstanceId) {
    // Add to parent's children set
    if (!this.processHierarchy.has(parentInstanceId)) {
      this.processHierarchy.set(parentInstanceId, new Set())
    }
    this.processHierarchy.get(parentInstanceId).add(childInstanceId)

    // Map child to parent
    this.childToParent.set(childInstanceId, parentInstanceId)

    logger.debug('Registered parent-child relationship', {
      parentInstanceId,
      childInstanceId
    })
  }

  /**
   * Get all child processes of a parent
   */
  getChildProcesses(parentInstanceId) {
    return Array.from(this.processHierarchy.get(parentInstanceId) || [])
  }

  /**
   * Get parent process of a child
   */
  getParentProcess(childInstanceId) {
    return this.childToParent.get(childInstanceId)
  }

  /**
   * Cancel all child processes when parent is cancelled
   */
  async cancelChildProcesses(parentInstanceId) {
    const childIds = this.getChildProcesses(parentInstanceId)

    logger.info('Cancelling child processes', {
      parentInstanceId,
      childCount: childIds.length
    })

    for (const childId of childIds) {
      try {
        await this.processOrchestrator.cancelProcess(childId)
      } catch (error) {
        logger.error('Failed to cancel child process:', error, { childId })
      }
    }
  }

  /**
   * Get process hierarchy tree
   */
  getProcessHierarchy(rootInstanceId) {
    const buildTree = (instanceId) => {
      const children = this.getChildProcesses(instanceId)
      return {
        instanceId,
        children: children.map(childId => buildTree(childId))
      }
    }

    return buildTree(rootInstanceId)
  }

  /**
   * Cleanup hierarchy tracking when process completes
   */
  cleanupHierarchy(instanceId) {
    // Remove from parent's children set
    const parentId = this.childToParent.get(instanceId)
    if (parentId) {
      const siblings = this.processHierarchy.get(parentId)
      if (siblings) {
        siblings.delete(instanceId)
      }
    }

    // Remove child mapping
    this.childToParent.delete(instanceId)

    // Remove as parent (if it has children)
    this.processHierarchy.delete(instanceId)
  }
}

export default SubProcessManager
