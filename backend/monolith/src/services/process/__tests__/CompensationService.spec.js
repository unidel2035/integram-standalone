/**
 * CompensationService Unit Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { CompensationService, CompensationState } from '../CompensationService.js'

describe('CompensationService', () => {
  let compensationService
  let mockStorage
  let mockProcessOrchestrator
  let mockAgentManager

  beforeEach(() => {
    mockStorage = {
      getAllRoleBindings: vi.fn()
    }

    mockProcessOrchestrator = {
      roleIds: {
        TaskInstance: 'role-task-id'
      }
    }

    mockAgentManager = {
      assignTask: vi.fn()
    }

    compensationService = new CompensationService({
      storage: mockStorage,
      processOrchestrator: mockProcessOrchestrator,
      agentManager: mockAgentManager
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('constructor', () => {
    it('should initialize with dependencies', () => {
      expect(compensationService.storage).toBe(mockStorage)
      expect(compensationService.processOrchestrator).toBe(mockProcessOrchestrator)
      expect(compensationService.agentManager).toBe(mockAgentManager)
    })

    it('should default to continue on compensation failure', () => {
      expect(compensationService.continueOnCompensationFailure).toBe(true)
    })
  })

  describe('mapCompensationInput', () => {
    it('should return all task result if no mapping', () => {
      const task = {
        result: { transactionId: 'TX123', amount: 1000 }
      }

      const result = compensationService.mapCompensationInput(task, {})
      expect(result).toEqual(task.result)
    })

    it('should map using ${result.varName} syntax', () => {
      const task = {
        result: { transactionId: 'TX123', amount: 1000 }
      }

      const inputMapping = {
        txId: '${result.transactionId}',
        refundAmount: '${result.amount}'
      }

      const result = compensationService.mapCompensationInput(task, inputMapping)
      expect(result).toEqual({
        txId: 'TX123',
        refundAmount: 1000
      })
    })

    it('should handle static values', () => {
      const task = {
        result: { transactionId: 'TX123' }
      }

      const inputMapping = {
        txId: '${result.transactionId}',
        reason: 'Process cancelled'
      }

      const result = compensationService.mapCompensationInput(task, inputMapping)
      expect(result).toEqual({
        txId: 'TX123',
        reason: 'Process cancelled'
      })
    })
  })

  describe('getCompensatableTasks', () => {
    it('should return completed tasks in execution order', async () => {
      const mockBindings = [
        {
          thingId: 'task-1',
          roleId: 'role-task-id',
          witness: {
            processInstanceId: 'process-1',
            state: 'completed',
            startTime: '2025-01-01T10:00:00Z'
          }
        },
        {
          thingId: 'task-2',
          roleId: 'role-task-id',
          witness: {
            processInstanceId: 'process-1',
            state: 'completed',
            startTime: '2025-01-01T10:05:00Z'
          }
        }
      ]

      mockStorage.getAllRoleBindings.mockResolvedValue(mockBindings)

      const result = await compensationService.getCompensatableTasks('process-1')

      expect(result).toHaveLength(2)
      expect(result[0].id).toBe('task-1')
      expect(result[1].id).toBe('task-2')
    })

    it('should filter tasks before fromTaskId', async () => {
      const mockBindings = [
        {
          thingId: 'task-1',
          roleId: 'role-task-id',
          witness: {
            processInstanceId: 'process-1',
            state: 'completed',
            startTime: '2025-01-01T10:00:00Z'
          }
        },
        {
          thingId: 'task-2',
          roleId: 'role-task-id',
          witness: {
            processInstanceId: 'process-1',
            state: 'completed',
            startTime: '2025-01-01T10:05:00Z'
          }
        },
        {
          thingId: 'task-3',
          roleId: 'role-task-id',
          witness: {
            processInstanceId: 'process-1',
            state: 'completed',
            startTime: '2025-01-01T10:10:00Z'
          }
        }
      ]

      mockStorage.getAllRoleBindings.mockResolvedValue(mockBindings)

      const result = await compensationService.getCompensatableTasks('process-1', 'task-3')

      expect(result).toHaveLength(2)
      expect(result.map(t => t.id)).toEqual(['task-1', 'task-2'])
    })

    it('should only include completed tasks', async () => {
      const mockBindings = [
        {
          thingId: 'task-1',
          roleId: 'role-task-id',
          witness: {
            processInstanceId: 'process-1',
            state: 'completed',
            startTime: '2025-01-01T10:00:00Z'
          }
        },
        {
          thingId: 'task-2',
          roleId: 'role-task-id',
          witness: {
            processInstanceId: 'process-1',
            state: 'active', // Not completed
            startTime: '2025-01-01T10:05:00Z'
          }
        }
      ]

      mockStorage.getAllRoleBindings.mockResolvedValue(mockBindings)

      const result = await compensationService.getCompensatableTasks('process-1')

      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('task-1')
    })
  })

  describe('executeCompensationHandler', () => {
    it('should create and execute compensation task via agent manager', async () => {
      const task = {
        id: 'task-1',
        processInstanceId: 'process-1',
        result: { transactionId: 'TX123', amount: 1000 }
      }

      const compensationHandler = {
        service: 'PaymentService',
        action: 'refund',
        inputMapping: {
          txId: '${result.transactionId}',
          amount: '${result.amount}'
        }
      }

      const mockResult = { refundId: 'RF123', status: 'success' }
      mockAgentManager.assignTask.mockResolvedValue(mockResult)

      const result = await compensationService.executeCompensationHandler(task, compensationHandler)

      expect(result).toEqual(mockResult)
      expect(mockAgentManager.assignTask).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'compensation-task-1',
          type: 'compensation',
          data: expect.objectContaining({
            service: 'PaymentService',
            action: 'refund',
            input: {
              txId: 'TX123',
              amount: 1000
            }
          })
        })
      )
    })

    it('should throw if agent manager is not available', async () => {
      compensationService.agentManager = null

      const task = { id: 'task-1' }
      const handler = { service: 'TestService', action: 'compensate' }

      await expect(
        compensationService.executeCompensationHandler(task, handler)
      ).rejects.toThrow('AgentManager is required')
    })
  })

  describe('evaluateExpression', () => {
    it('should evaluate simple expressions', () => {
      const result = compensationService.evaluateExpression('2 + 2', {})
      expect(result).toBe(4)
    })

    it('should access context variables', () => {
      const context = { result: { amount: 1000 } }
      const result = compensationService.evaluateExpression('result.amount * 2', context)
      expect(result).toBe(2000)
    })

    it('should return undefined on invalid expression', () => {
      const result = compensationService.evaluateExpression('invalid syntax!!!', {})
      expect(result).toBeUndefined()
    })
  })

  describe('executeWithCompensation', () => {
    it('should return result on successful operation', async () => {
      const operation = vi.fn().mockResolvedValue('success')
      const compensationFn = vi.fn()

      const result = await compensationService.executeWithCompensation(
        operation,
        compensationFn,
        3
      )

      expect(result).toBe('success')
      expect(operation).toHaveBeenCalledTimes(1)
      expect(compensationFn).not.toHaveBeenCalled()
    })

    it('should retry and compensate on failure', async () => {
      const operation = vi.fn()
        .mockRejectedValueOnce(new Error('Attempt 1 failed'))
        .mockRejectedValueOnce(new Error('Attempt 2 failed'))
        .mockResolvedValueOnce('success')

      const compensationFn = vi.fn()

      const result = await compensationService.executeWithCompensation(
        operation,
        compensationFn,
        3
      )

      expect(result).toBe('success')
      expect(operation).toHaveBeenCalledTimes(3)
      expect(compensationFn).toHaveBeenCalledTimes(2)
    }, 10000)

    it('should throw after max retries', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('Always fails'))
      const compensationFn = vi.fn()

      await expect(
        compensationService.executeWithCompensation(operation, compensationFn, 2)
      ).rejects.toThrow('Always fails')

      expect(operation).toHaveBeenCalledTimes(2)
      expect(compensationFn).toHaveBeenCalledTimes(2)
    }, 10000)
  })
})
