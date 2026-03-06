import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAgentWorkflowStore } from '../agentWorkflowStore'

describe('agentWorkflowStore', () => {
  let store

  beforeEach(() => {
    // Create fresh pinia instance for each test
    setActivePinia(createPinia())
    store = useAgentWorkflowStore()

    // Clear localStorage before each test
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
  })

  describe('saveAgentWorkflow', () => {
    it('should save a new workflow', () => {
      const agentId = 'test-agent'
      const workflow = {
        nodes: [{ id: 'node-1', type: 'StartNode' }],
        edges: [],
        name: 'Test Workflow',
        description: 'Test description'
      }

      const saved = store.saveAgentWorkflow(agentId, workflow)

      expect(saved).toBeDefined()
      expect(saved.agentId).toBe(agentId)
      expect(saved.name).toBe('Test Workflow')
      expect(saved.version).toBe(1)
      expect(saved.status).toBe('active')
      expect(saved.createdAt).toBeDefined()
      expect(saved.updatedAt).toBeDefined()
    })

    it('should increment version on update', () => {
      const agentId = 'test-agent'
      const workflow1 = {
        nodes: [],
        edges: [],
        name: 'Version 1'
      }

      store.saveAgentWorkflow(agentId, workflow1)
      const workflow2 = store.saveAgentWorkflow(agentId, { ...workflow1, name: 'Version 2' })

      expect(workflow2.version).toBe(2)
      expect(workflow2.name).toBe('Version 2')
    })

    it('should throw error if agentId is missing', () => {
      expect(() => {
        store.saveAgentWorkflow(null, { nodes: [], edges: [] })
      }).toThrow('Agent ID is required')
    })

    it('should persist to localStorage', () => {
      const agentId = 'test-agent'
      const workflow = {
        nodes: [],
        edges: [],
        name: 'Test'
      }

      store.saveAgentWorkflow(agentId, workflow)

      const stored = JSON.parse(localStorage.getItem('agentWorkflows'))
      expect(stored[agentId]).toBeDefined()
      expect(stored[agentId].name).toBe('Test')
    })
  })

  describe('getAgentWorkflow', () => {
    it('should return workflow if exists', () => {
      const agentId = 'test-agent'
      const workflow = {
        nodes: [],
        edges: [],
        name: 'Test'
      }

      store.saveAgentWorkflow(agentId, workflow)
      const retrieved = store.getAgentWorkflow(agentId)

      expect(retrieved).toBeDefined()
      expect(retrieved.name).toBe('Test')
    })

    it('should return null if workflow does not exist', () => {
      const retrieved = store.getAgentWorkflow('non-existent')
      expect(retrieved).toBeNull()
    })
  })

  describe('hasWorkflow', () => {
    it('should return true if workflow exists', () => {
      const agentId = 'test-agent'
      store.saveAgentWorkflow(agentId, { nodes: [], edges: [], name: 'Test' })

      expect(store.hasWorkflow(agentId)).toBe(true)
    })

    it('should return false if workflow does not exist', () => {
      expect(store.hasWorkflow('non-existent')).toBe(false)
    })
  })

  describe('deleteAgentWorkflow', () => {
    it('should delete workflow if exists', () => {
      const agentId = 'test-agent'
      store.saveAgentWorkflow(agentId, { nodes: [], edges: [], name: 'Test' })

      const deleted = store.deleteAgentWorkflow(agentId)

      expect(deleted).toBe(true)
      expect(store.hasWorkflow(agentId)).toBe(false)
    })

    it('should return false if workflow does not exist', () => {
      const deleted = store.deleteAgentWorkflow('non-existent')
      expect(deleted).toBe(false)
    })

    it('should persist deletion to localStorage', () => {
      const agentId = 'test-agent'
      store.saveAgentWorkflow(agentId, { nodes: [], edges: [], name: 'Test' })
      store.deleteAgentWorkflow(agentId)

      const stored = JSON.parse(localStorage.getItem('agentWorkflows'))
      expect(stored[agentId]).toBeUndefined()
    })
  })

  describe('updateWorkflowStatus', () => {
    it('should update status if workflow exists', () => {
      const agentId = 'test-agent'
      store.saveAgentWorkflow(agentId, { nodes: [], edges: [], name: 'Test', status: 'draft' })

      const updated = store.updateWorkflowStatus(agentId, 'active')

      expect(updated).toBe(true)
      expect(store.getAgentWorkflow(agentId).status).toBe('active')
    })

    it('should return false if workflow does not exist', () => {
      const updated = store.updateWorkflowStatus('non-existent', 'active')
      expect(updated).toBe(false)
    })
  })

  describe('exportAgentWorkflow', () => {
    it('should export workflow as JSON string', () => {
      const agentId = 'test-agent'
      const workflow = {
        nodes: [{ id: 'node-1', type: 'StartNode' }],
        edges: [],
        name: 'Test'
      }

      store.saveAgentWorkflow(agentId, workflow)
      const exported = store.exportAgentWorkflow(agentId)

      expect(typeof exported).toBe('string')
      const parsed = JSON.parse(exported)
      expect(parsed.name).toBe('Test')
      expect(parsed.nodes).toHaveLength(1)
    })

    it('should throw error if workflow does not exist', () => {
      expect(() => {
        store.exportAgentWorkflow('non-existent')
      }).toThrow('No workflow found for agent: non-existent')
    })
  })

  describe('importAgentWorkflow', () => {
    it('should import workflow from JSON string', () => {
      const agentId = 'test-agent'
      const workflowJson = JSON.stringify({
        nodes: [{ id: 'node-1', type: 'StartNode' }],
        edges: [],
        name: 'Imported'
      })

      const imported = store.importAgentWorkflow(agentId, workflowJson)

      expect(imported).toBeDefined()
      expect(imported.name).toBe('Imported')
      expect(store.hasWorkflow(agentId)).toBe(true)
    })

    it('should import workflow from object', () => {
      const agentId = 'test-agent'
      const workflowObj = {
        nodes: [],
        edges: [],
        name: 'Imported Object'
      }

      const imported = store.importAgentWorkflow(agentId, workflowObj)

      expect(imported.name).toBe('Imported Object')
    })

    it('should throw error on invalid JSON', () => {
      expect(() => {
        store.importAgentWorkflow('test-agent', 'invalid json')
      }).toThrow('Failed to import workflow')
    })
  })

  describe('clearAllWorkflows', () => {
    it('should clear all workflows', () => {
      store.saveAgentWorkflow('agent-1', { nodes: [], edges: [], name: 'Test 1' })
      store.saveAgentWorkflow('agent-2', { nodes: [], edges: [], name: 'Test 2' })

      store.clearAllWorkflows()

      expect(store.hasWorkflow('agent-1')).toBe(false)
      expect(store.hasWorkflow('agent-2')).toBe(false)
      expect(Object.keys(store.getAllAgentWorkflows).length).toBe(0)
    })

    it('should persist clearing to localStorage', () => {
      store.saveAgentWorkflow('agent-1', { nodes: [], edges: [], name: 'Test' })
      store.clearAllWorkflows()

      const stored = JSON.parse(localStorage.getItem('agentWorkflows'))
      expect(Object.keys(stored).length).toBe(0)
    })
  })

  describe('loadFromLocalStorage', () => {
    it('should load workflows from localStorage', () => {
      const workflows = {
        'agent-1': {
          agentId: 'agent-1',
          nodes: [],
          edges: [],
          name: 'Test 1'
        },
        'agent-2': {
          agentId: 'agent-2',
          nodes: [],
          edges: [],
          name: 'Test 2'
        }
      }

      localStorage.setItem('agentWorkflows', JSON.stringify(workflows))

      store.loadFromLocalStorage()

      expect(store.hasWorkflow('agent-1')).toBe(true)
      expect(store.hasWorkflow('agent-2')).toBe(true)
      expect(store.getAgentWorkflow('agent-1').name).toBe('Test 1')
    })

    it('should handle missing localStorage data', () => {
      localStorage.removeItem('agentWorkflows')

      expect(() => {
        store.loadFromLocalStorage()
      }).not.toThrow()
    })

    it('should handle corrupted localStorage data', () => {
      localStorage.setItem('agentWorkflows', 'invalid json')

      expect(() => {
        store.loadFromLocalStorage()
      }).not.toThrow()
    })
  })

  describe('getWorkflowStatus', () => {
    it('should return workflow status', () => {
      const agentId = 'test-agent'
      store.saveAgentWorkflow(agentId, { nodes: [], edges: [], name: 'Test', status: 'draft' })

      expect(store.getWorkflowStatus(agentId)).toBe('draft')
    })

    it('should return "none" if workflow does not exist', () => {
      expect(store.getWorkflowStatus('non-existent')).toBe('none')
    })

    it('should return "draft" if status is not set', () => {
      const agentId = 'test-agent'
      store.saveAgentWorkflow(agentId, { nodes: [], edges: [], name: 'Test' })
      // Status should default to 'active' in saveAgentWorkflow, but if somehow missing:
      store.agentWorkflows[agentId].status = undefined

      expect(store.getWorkflowStatus(agentId)).toBe('draft')
    })
  })
})
