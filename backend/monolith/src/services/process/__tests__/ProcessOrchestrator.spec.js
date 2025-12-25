/**
 * ProcessOrchestrator Unit Tests
 *
 * Tests for the Process Execution Engine (Phase 3, Issue #2460)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { ProcessOrchestrator, ProcessState, TaskState } from '../ProcessOrchestrator.js'
import { RoleSetStorage } from '../../../storage/RoleSetStorage.js'
import { AgentManager } from '../../AgentManager.js'

describe('ProcessOrchestrator', () => {
  let orchestrator
  let mockStorage
  let mockAgentManager

  beforeEach(async () => {
    // Mock RoleSetStorage
    mockStorage = {
      createThing: vi.fn(async () => ({ id: `thing-${Date.now()}` })),
      getAllPrisms: vi.fn(async () => []),
      createPrism: vi.fn(async (prismDef) => ({ id: 'prism-1', ...prismDef })),
      createRole: vi.fn(async (prismId, roleDef) => ({ id: `role-${roleDef.name}`, ...roleDef })),
      getRolesByPrism: vi.fn(async () => []),
      createRoleBinding: vi.fn(async (thingId, prismId, roleId, witness) => ({
        id: `binding-${Date.now()}`,
        thingId,
        prismId,
        roleId,
        witness
      })),
      updateRoleBinding: vi.fn(async (bindingId, witness) => ({ id: bindingId, witness })),
      getRoleBindingsByThing: vi.fn(async (thingId) => []),
      getAllRoleBindings: vi.fn(async () => [])
    }

    // Mock AgentManager
    mockAgentManager = {
      assignTask: vi.fn(async (task) => ({ success: true, result: { taskId: task.id } }))
    }

    orchestrator = new ProcessOrchestrator({
      storage: mockStorage,
      agentManager: mockAgentManager
    })

    await orchestrator.initialize()
  })

  afterEach(async () => {
    await orchestrator.shutdown()
  })

  describe('Initialization', () => {
    it('should initialize prism and roles', async () => {
      expect(orchestrator.prismId).toBe('prism-1')
      expect(orchestrator.roleIds).toHaveProperty('ProcessInstance')
      expect(orchestrator.roleIds).toHaveProperty('TaskInstance')
      expect(orchestrator.roleIds).toHaveProperty('EventOccurrence')
      expect(orchestrator.roleIds).toHaveProperty('VariableSnapshot')
      expect(orchestrator.roleIds).toHaveProperty('GatewayExecution')
    })

    it('should have empty active instances initially', () => {
      expect(orchestrator.activeInstances.size).toBe(0)
    })
  })

  describe('Process Lifecycle', () => {
    const simpleProcess = {
      id: 'process-def-1',
      name: 'Simple Process',
      nodes: [
        { id: 'start-1', type: 'bpmn:startEvent', data: {} },
        { id: 'end-1', type: 'bpmn:endEvent', data: {} }
      ],
      edges: [
        { id: 'edge-1', source: 'start-1', target: 'end-1' }
      ]
    }

    it('should start a process instance', async () => {
      const result = await orchestrator.startProcess(simpleProcess, { var1: 'value1' })

      expect(result).toHaveProperty('instanceId')
      expect(result.state).toBe(ProcessState.RUNNING)
      expect(result.variables).toEqual({ var1: 'value1' })
      expect(mockStorage.createThing).toHaveBeenCalled()
      expect(mockStorage.createRoleBinding).toHaveBeenCalled()
    })

    it('should reject invalid process definition', async () => {
      await expect(orchestrator.startProcess(null)).rejects.toThrow('Invalid process definition')
      await expect(orchestrator.startProcess({ id: 'test' })).rejects.toThrow('Invalid process definition: no nodes')
    })

    it('should track active instances', async () => {
      await orchestrator.startProcess(simpleProcess)
      expect(orchestrator.activeInstances.size).toBe(1)
    })

    it('should enforce max concurrent instances', async () => {
      const smallOrchestrator = new ProcessOrchestrator({
        storage: mockStorage,
        maxConcurrentInstances: 1
      })
      await smallOrchestrator.initialize()

      await smallOrchestrator.startProcess(simpleProcess)
      await expect(smallOrchestrator.startProcess(simpleProcess)).rejects.toThrow('Maximum concurrent process instances reached')
      await smallOrchestrator.shutdown()
    })
  })

  describe('Task Execution', () => {
    const processWithTask = {
      id: 'process-def-2',
      name: 'Process with Task',
      nodes: [
        { id: 'start-1', type: 'bpmn:startEvent', data: {} },
        { id: 'task-1', type: 'bpmn:serviceTask', data: { assignee: 'agent-1' } },
        { id: 'end-1', type: 'bpmn:endEvent', data: {} }
      ],
      edges: [
        { id: 'edge-1', source: 'start-1', target: 'task-1' },
        { id: 'edge-2', source: 'task-1', target: 'end-1' }
      ]
    }

    it('should create task instance when executing task node', async () => {
      await orchestrator.startProcess(processWithTask)

      expect(mockStorage.createThing).toHaveBeenCalled() // Process instance + Task instance
      expect(mockAgentManager.assignTask).toHaveBeenCalled()
    })

    it('should complete task successfully', async () => {
      const taskId = 'task-123'
      const result = { data: 'completed' }

      mockStorage.getRoleBindingsByThing.mockResolvedValueOnce([
        {
          id: 'binding-1',
          thingId: taskId,
          roleId: orchestrator.roleIds.TaskInstance,
          witness: {
            state: TaskState.ACTIVE,
            startTime: new Date().toISOString()
          }
        }
      ])

      await orchestrator.completeTask(taskId, result)

      expect(mockStorage.updateRoleBinding).toHaveBeenCalledWith(
        'binding-1',
        expect.objectContaining({
          state: TaskState.COMPLETED,
          result
        })
      )
    })

    it('should fail task on error', async () => {
      const taskId = 'task-456'
      const error = new Error('Task execution failed')

      mockStorage.getRoleBindingsByThing.mockResolvedValueOnce([
        {
          id: 'binding-2',
          thingId: taskId,
          roleId: orchestrator.roleIds.TaskInstance,
          witness: {
            state: TaskState.ACTIVE,
            startTime: new Date().toISOString()
          }
        }
      ])

      await orchestrator.failTask(taskId, error)

      expect(mockStorage.updateRoleBinding).toHaveBeenCalledWith(
        'binding-2',
        expect.objectContaining({
          state: TaskState.FAILED,
          error: 'Task execution failed'
        })
      )
    })
  })

  describe('Gateway Execution', () => {
    const processWithGateway = {
      id: 'process-def-3',
      name: 'Process with Gateway',
      nodes: [
        { id: 'start-1', type: 'bpmn:startEvent', data: {} },
        { id: 'gateway-1', type: 'bpmn:exclusiveGateway', data: {} },
        { id: 'task-1', type: 'bpmn:task', data: {} },
        { id: 'task-2', type: 'bpmn:task', data: {} },
        { id: 'end-1', type: 'bpmn:endEvent', data: {} }
      ],
      edges: [
        { id: 'edge-1', source: 'start-1', target: 'gateway-1' },
        { id: 'edge-2', source: 'gateway-1', target: 'task-1', condition: 'amount > 1000' },
        { id: 'edge-3', source: 'gateway-1', target: 'task-2', isDefault: true },
        { id: 'edge-4', source: 'task-1', target: 'end-1' },
        { id: 'edge-5', source: 'task-2', target: 'end-1' }
      ]
    }

    it('should evaluate condition in exclusive gateway', async () => {
      const evaluated = orchestrator.evaluateCondition('amount > 1000', { amount: 1500 })
      expect(evaluated).toBe(true)
    })

    it('should handle failed condition evaluation', () => {
      const evaluated = orchestrator.evaluateCondition('invalid expression', {})
      expect(evaluated).toBe(false)
    })

    it('should get outgoing edges correctly', () => {
      const edges = orchestrator.getOutgoingEdges(processWithGateway, { id: 'gateway-1' })
      expect(edges).toHaveLength(2)
      expect(edges.map(e => e.target)).toContain('task-1')
      expect(edges.map(e => e.target)).toContain('task-2')
    })

    it('should get node by ID', () => {
      const node = orchestrator.getNodeById(processWithGateway, 'task-1')
      expect(node).toBeDefined()
      expect(node.id).toBe('task-1')
    })

    it('should throw error for non-existent node', () => {
      expect(() => orchestrator.getNodeById(processWithGateway, 'non-existent'))
        .toThrow('Node not found: non-existent')
    })
  })

  describe('Event Management', () => {
    it('should record event occurrence', async () => {
      const instanceId = 'instance-123'
      const eventType = 'message'
      const eventData = {
        eventName: 'order_received',
        payload: { orderId: '456' }
      }

      await orchestrator.recordEventOccurrence(instanceId, eventType, eventData)

      expect(mockStorage.createThing).toHaveBeenCalled()
      expect(mockStorage.createRoleBinding).toHaveBeenCalledWith(
        expect.any(String),
        orchestrator.prismId,
        orchestrator.roleIds.EventOccurrence,
        expect.objectContaining({
          processInstanceId: instanceId,
          eventType,
          eventName: 'order_received',
          payload: { orderId: '456' },
          handled: false
        })
      )
    })

    it('should create variable snapshot', async () => {
      const instanceId = 'instance-123'
      const variables = { var1: 'value1', var2: 100 }

      await orchestrator.createVariableSnapshot(instanceId, variables, 'task_completed', 'checkpoint')

      expect(mockStorage.createRoleBinding).toHaveBeenCalledWith(
        expect.any(String),
        orchestrator.prismId,
        orchestrator.roleIds.VariableSnapshot,
        expect.objectContaining({
          processInstanceId: instanceId,
          variables,
          triggeredBy: 'task_completed',
          snapshotType: 'checkpoint'
        })
      )
    })
  })

  describe('Process State Management', () => {
    it('should pause process', async () => {
      const instanceId = 'instance-789'

      mockStorage.getRoleBindingsByThing.mockResolvedValueOnce([
        {
          id: 'binding-3',
          thingId: instanceId,
          roleId: orchestrator.roleIds.ProcessInstance,
          witness: {
            state: ProcessState.RUNNING,
            variables: {}
          }
        }
      ])

      await orchestrator.pauseProcess(instanceId)

      expect(mockStorage.updateRoleBinding).toHaveBeenCalledWith(
        'binding-3',
        expect.objectContaining({
          state: ProcessState.PAUSED
        })
      )
    })

    it('should resume paused process', async () => {
      const instanceId = 'instance-101'

      mockStorage.getRoleBindingsByThing.mockResolvedValueOnce([
        {
          id: 'binding-4',
          thingId: instanceId,
          roleId: orchestrator.roleIds.ProcessInstance,
          witness: {
            state: ProcessState.PAUSED,
            variables: {}
          }
        }
      ])

      await orchestrator.resumeProcess(instanceId)

      expect(mockStorage.updateRoleBinding).toHaveBeenCalledWith(
        'binding-4',
        expect.objectContaining({
          state: ProcessState.RUNNING
        })
      )
    })

    it('should not resume non-paused process', async () => {
      const instanceId = 'instance-102'

      mockStorage.getRoleBindingsByThing.mockResolvedValueOnce([
        {
          id: 'binding-5',
          thingId: instanceId,
          roleId: orchestrator.roleIds.ProcessInstance,
          witness: {
            state: ProcessState.RUNNING,
            variables: {}
          }
        }
      ])

      await expect(orchestrator.resumeProcess(instanceId))
        .rejects.toThrow('Cannot resume process in state: running')
    })

    it('should cancel process', async () => {
      const instanceId = 'instance-103'

      mockStorage.getRoleBindingsByThing.mockResolvedValueOnce([
        {
          id: 'binding-6',
          thingId: instanceId,
          roleId: orchestrator.roleIds.ProcessInstance,
          witness: {
            state: ProcessState.RUNNING,
            variables: {}
          }
        }
      ])

      await orchestrator.cancelProcess(instanceId)

      expect(mockStorage.updateRoleBinding).toHaveBeenCalledWith(
        'binding-6',
        expect.objectContaining({
          state: ProcessState.CANCELLED
        })
      )
      expect(orchestrator.activeInstances.has(instanceId)).toBe(false)
    })
  })

  describe('Statistics', () => {
    it('should get statistics', () => {
      const stats = orchestrator.getStats()

      expect(stats).toHaveProperty('activeInstances')
      expect(stats).toHaveProperty('maxConcurrentInstances')
      expect(stats.activeInstances).toBe(0)
      expect(stats.maxConcurrentInstances).toBe(100)
    })
  })

  describe('Helper Functions', () => {
    it('should get required capabilities from node', () => {
      const node1 = { data: { requiredCapabilities: ['ai', 'nlp'] } }
      const node2 = { data: {} }

      expect(orchestrator.getRequiredCapabilities(node1)).toEqual(['ai', 'nlp'])
      expect(orchestrator.getRequiredCapabilities(node2)).toEqual(['generic'])
    })
  })
})
