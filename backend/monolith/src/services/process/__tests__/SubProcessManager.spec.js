/**
 * SubProcessManager Unit Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { SubProcessManager } from '../SubProcessManager.js'
import EventEmitter from 'events'

describe('SubProcessManager', () => {
  let subProcessManager
  let mockProcessOrchestrator
  let mockStorage

  beforeEach(() => {
    // Mock storage
    mockStorage = {
      getRoleBindingsByThing: vi.fn(),
      updateRoleBinding: vi.fn()
    }

    // Mock ProcessOrchestrator
    mockProcessOrchestrator = new EventEmitter()
    mockProcessOrchestrator.storage = mockStorage
    mockProcessOrchestrator.roleIds = {
      ProcessInstance: 'role-instance-id'
    }
    mockProcessOrchestrator.startProcess = vi.fn()
    mockProcessOrchestrator.getProcessInstance = vi.fn()

    subProcessManager = new SubProcessManager({
      processOrchestrator: mockProcessOrchestrator,
      storage: mockStorage
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('constructor', () => {
    it('should initialize with ProcessOrchestrator', () => {
      expect(subProcessManager.processOrchestrator).toBe(mockProcessOrchestrator)
      expect(subProcessManager.storage).toBe(mockStorage)
    })

    it('should throw error if ProcessOrchestrator is missing', () => {
      expect(() => new SubProcessManager({})).toThrow('ProcessOrchestrator is required')
    })

    it('should initialize parent-child tracking maps', () => {
      expect(subProcessManager.processHierarchy).toBeInstanceOf(Map)
      expect(subProcessManager.childToParent).toBeInstanceOf(Map)
    })
  })

  describe('mapInputVariables', () => {
    it('should pass all variables if no mapping specified', () => {
      const parentVariables = { var1: 'value1', var2: 'value2' }
      const result = subProcessManager.mapInputVariables(parentVariables, {})

      expect(result).toEqual(parentVariables)
    })

    it('should map variables using ${varName} syntax', () => {
      const parentVariables = { orderAmount: 1000, customerId: 'C123' }
      const inputMapping = {
        amount: '${orderAmount}',
        customer: '${customerId}'
      }

      const result = subProcessManager.mapInputVariables(parentVariables, inputMapping)

      expect(result).toEqual({
        amount: 1000,
        customer: 'C123'
      })
    })

    it('should handle static values in mapping', () => {
      const parentVariables = { orderAmount: 1000 }
      const inputMapping = {
        amount: '${orderAmount}',
        currency: 'USD'
      }

      const result = subProcessManager.mapInputVariables(parentVariables, inputMapping)

      expect(result).toEqual({
        amount: 1000,
        currency: 'USD'
      })
    })
  })

  describe('registerParentChild', () => {
    it('should register parent-child relationship', () => {
      subProcessManager.registerParentChild('parent-1', 'child-1')

      expect(subProcessManager.processHierarchy.get('parent-1')).toContain('child-1')
      expect(subProcessManager.childToParent.get('child-1')).toBe('parent-1')
    })

    it('should support multiple children for same parent', () => {
      subProcessManager.registerParentChild('parent-1', 'child-1')
      subProcessManager.registerParentChild('parent-1', 'child-2')

      const children = subProcessManager.processHierarchy.get('parent-1')
      expect(children.size).toBe(2)
      expect(children).toContain('child-1')
      expect(children).toContain('child-2')
    })
  })

  describe('getChildProcesses', () => {
    it('should return empty array if no children', () => {
      const result = subProcessManager.getChildProcesses('parent-1')
      expect(result).toEqual([])
    })

    it('should return all child process IDs', () => {
      subProcessManager.registerParentChild('parent-1', 'child-1')
      subProcessManager.registerParentChild('parent-1', 'child-2')

      const result = subProcessManager.getChildProcesses('parent-1')
      expect(result).toHaveLength(2)
      expect(result).toContain('child-1')
      expect(result).toContain('child-2')
    })
  })

  describe('getParentProcess', () => {
    it('should return undefined if no parent', () => {
      const result = subProcessManager.getParentProcess('child-1')
      expect(result).toBeUndefined()
    })

    it('should return parent process ID', () => {
      subProcessManager.registerParentChild('parent-1', 'child-1')

      const result = subProcessManager.getParentProcess('child-1')
      expect(result).toBe('parent-1')
    })
  })

  describe('getProcessHierarchy', () => {
    it('should return hierarchy tree', () => {
      subProcessManager.registerParentChild('parent-1', 'child-1')
      subProcessManager.registerParentChild('child-1', 'grandchild-1')

      const tree = subProcessManager.getProcessHierarchy('parent-1')

      expect(tree).toEqual({
        instanceId: 'parent-1',
        children: [
          {
            instanceId: 'child-1',
            children: [
              {
                instanceId: 'grandchild-1',
                children: []
              }
            ]
          }
        ]
      })
    })
  })

  describe('cleanupHierarchy', () => {
    it('should remove instance from hierarchy tracking', () => {
      subProcessManager.registerParentChild('parent-1', 'child-1')

      subProcessManager.cleanupHierarchy('child-1')

      expect(subProcessManager.processHierarchy.get('parent-1').size).toBe(0)
      expect(subProcessManager.childToParent.has('child-1')).toBe(false)
    })
  })

  describe('waitForSubProcessCompletion', () => {
    it('should resolve when subprocess completes', async () => {
      const completionPromise = subProcessManager.waitForSubProcessCompletion('child-1', 5000)

      // Simulate completion
      setTimeout(() => {
        mockProcessOrchestrator.emit('process:completed', { instanceId: 'child-1' })
      }, 10)

      const result = await completionPromise
      expect(result).toEqual({ state: 'completed', instanceId: 'child-1' })
    })

    it('should reject when subprocess fails', async () => {
      const completionPromise = subProcessManager.waitForSubProcessCompletion('child-1', 5000)

      // Simulate failure
      setTimeout(() => {
        mockProcessOrchestrator.emit('process:failed', {
          instanceId: 'child-1',
          error: new Error('Test error')
        })
      }, 10)

      await expect(completionPromise).rejects.toThrow('Subprocess failed')
    })

    it('should timeout if subprocess takes too long', async () => {
      const completionPromise = subProcessManager.waitForSubProcessCompletion('child-1', 100)

      await expect(completionPromise).rejects.toThrow('Subprocess execution timeout')
    }, 200)
  })
})
