/**
 * Unit Tests for orchestratorService
 *
 * Issue #5632 - Frontend service for orchestrator API
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import axios from 'axios'
import {
  executeQuery,
  getOrchestratorStatus,
  getDependencyGraph,
  startOrchestrator,
  stopOrchestrator,
  restartOrchestrator
} from '../orchestratorService'

// Mock axios
vi.mock('axios')

describe('orchestratorService', () => {
  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks()
  })

  describe('executeQuery', () => {
    it('should execute query successfully', async () => {
      const mockResponse = {
        data: {
          success: true,
          query: 'Какой курс доллара?',
          answer: 'Курс доллара США: 95.50 руб',
          data: { cbr: { rate: 95.50, currency: 'USD' } },
          sources: ['cbr'],
          steps: 1,
          executionTime: 1234
        }
      }

      axios.post.mockResolvedValue(mockResponse)

      const result = await executeQuery('Какой курс доллара?', {
        accessToken: 'test_token',
        userId: 'user123'
      })

      expect(result.success).toBe(true)
      expect(result.answer).toBe('Курс доллара США: 95.50 руб')
      expect(result.sources).toEqual(['cbr'])
      expect(result.data).toBeDefined()
    })

    it('should send correct request parameters', async () => {
      axios.post.mockResolvedValue({ data: { success: true } })

      await executeQuery('Test query', {
        accessToken: 'token123',
        userId: 'user456',
        includeTrace: true
      })

      expect(axios.post).toHaveBeenCalledWith(
        expect.stringContaining('/orchestrator/execute'),
        {
          query: 'Test query',
          options: {
            accessToken: 'token123',
            userId: 'user456',
            includeTrace: true
          }
        }
      )
    })

    it('should handle empty query string', async () => {
      const result = await executeQuery('', {})

      expect(result.success).toBe(false)
      expect(result.error).toContain('required')
    })

    it('should handle whitespace-only query', async () => {
      const result = await executeQuery('   ', {})

      expect(result.success).toBe(false)
      expect(result.error).toContain('required')
    })

    it('should handle non-string query', async () => {
      const result = await executeQuery(null, {})

      expect(result.success).toBe(false)
      expect(result.error).toContain('required')
    })

    it('should handle API error response', async () => {
      axios.post.mockRejectedValue({
        response: {
          data: {
            error: 'Orchestrator unavailable'
          }
        }
      })

      const result = await executeQuery('Test query', {})

      expect(result.success).toBe(false)
      expect(result.error).toBe('Orchestrator unavailable')
      expect(result.executionTime).toBe(0)
    })

    it('should handle network error', async () => {
      axios.post.mockRejectedValue(new Error('Network error'))

      const result = await executeQuery('Test query', {})

      expect(result.success).toBe(false)
      expect(result.error).toBe('Network error')
    })

    it('should include default options', async () => {
      axios.post.mockResolvedValue({ data: { success: true } })

      await executeQuery('Test query')

      expect(axios.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          query: 'Test query',
          options: {}
        })
      )
    })
  })

  describe('getOrchestratorStatus', () => {
    it('should get status successfully', async () => {
      const mockStatus = {
        data: {
          success: true,
          data: {
            status: {
              orchestrator: { status: 'running', initialized: true },
              registry: { totalAgents: 148, byType: {} },
              agents: []
            }
          }
        }
      }

      axios.get.mockResolvedValue(mockStatus)

      const result = await getOrchestratorStatus()

      expect(result.success).toBe(true)
      expect(result.data.status.registry.totalAgents).toBe(148)
      expect(axios.get).toHaveBeenCalledWith(expect.stringContaining('/orchestrator/status'))
    })

    it('should handle error response', async () => {
      axios.get.mockRejectedValue({
        response: {
          data: {
            error: 'Status unavailable'
          }
        }
      })

      const result = await getOrchestratorStatus()

      expect(result.success).toBe(false)
      expect(result.error).toBe('Status unavailable')
    })

    it('should handle network error', async () => {
      axios.get.mockRejectedValue(new Error('Connection failed'))

      const result = await getOrchestratorStatus()

      expect(result.success).toBe(false)
      expect(result.error).toBe('Connection failed')
    })
  })

  describe('getDependencyGraph', () => {
    it('should get dependency graph successfully', async () => {
      const mockGraph = {
        data: {
          success: true,
          data: {
            graph: {
              nodes: [{ id: 'agent1' }, { id: 'agent2' }],
              edges: [{ from: 'agent1', to: 'agent2' }]
            }
          }
        }
      }

      axios.get.mockResolvedValue(mockGraph)

      const result = await getDependencyGraph()

      expect(result.success).toBe(true)
      expect(result.data.graph.nodes).toHaveLength(2)
      expect(axios.get).toHaveBeenCalledWith(expect.stringContaining('/orchestrator/dependency-graph'))
    })

    it('should handle error response', async () => {
      axios.get.mockRejectedValue({
        response: {
          data: {
            error: 'Graph unavailable'
          }
        }
      })

      const result = await getDependencyGraph()

      expect(result.success).toBe(false)
      expect(result.error).toBe('Graph unavailable')
    })
  })

  describe('startOrchestrator', () => {
    it('should start orchestrator successfully', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: {
            agentsStarted: 148,
            order: ['agent1', 'agent2'],
            status: 'running'
          }
        }
      }

      axios.post.mockResolvedValue(mockResponse)

      const result = await startOrchestrator()

      expect(result.success).toBe(true)
      expect(result.data.agentsStarted).toBe(148)
      expect(result.data.status).toBe('running')
      expect(axios.post).toHaveBeenCalledWith(expect.stringContaining('/orchestrator/start'))
    })

    it('should handle already running error', async () => {
      axios.post.mockRejectedValue({
        response: {
          status: 409,
          data: {
            error: 'Already running'
          }
        }
      })

      const result = await startOrchestrator()

      expect(result.success).toBe(false)
      expect(result.error).toBe('Already running')
    })

    it('should handle startup failure', async () => {
      axios.post.mockRejectedValue(new Error('Startup failed'))

      const result = await startOrchestrator()

      expect(result.success).toBe(false)
      expect(result.error).toBe('Startup failed')
    })
  })

  describe('stopOrchestrator', () => {
    it('should stop orchestrator successfully', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: {
            status: 'stopped'
          }
        }
      }

      axios.post.mockResolvedValue(mockResponse)

      const result = await stopOrchestrator()

      expect(result.success).toBe(true)
      expect(result.data.status).toBe('stopped')
      expect(axios.post).toHaveBeenCalledWith(expect.stringContaining('/orchestrator/stop'))
    })

    it('should handle already stopped error', async () => {
      axios.post.mockRejectedValue({
        response: {
          status: 409,
          data: {
            error: 'Already stopped'
          }
        }
      })

      const result = await stopOrchestrator()

      expect(result.success).toBe(false)
      expect(result.error).toBe('Already stopped')
    })
  })

  describe('restartOrchestrator', () => {
    it('should restart orchestrator successfully', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: {
            agentsStarted: 148,
            order: ['agent1', 'agent2'],
            status: 'running'
          }
        }
      }

      axios.post.mockResolvedValue(mockResponse)

      const result = await restartOrchestrator()

      expect(result.success).toBe(true)
      expect(result.data.agentsStarted).toBe(148)
      expect(result.data.status).toBe('running')
      expect(axios.post).toHaveBeenCalledWith(expect.stringContaining('/orchestrator/restart'))
    })

    it('should handle restart failure', async () => {
      axios.post.mockRejectedValue(new Error('Restart failed'))

      const result = await restartOrchestrator()

      expect(result.success).toBe(false)
      expect(result.error).toBe('Restart failed')
    })
  })

  describe('Integration Scenarios', () => {
    it('should handle complete workflow: start -> execute -> status -> stop', async () => {
      // Start
      axios.post.mockResolvedValueOnce({
        data: { success: true, data: { status: 'running' } }
      })
      const startResult = await startOrchestrator()
      expect(startResult.success).toBe(true)

      // Execute query
      axios.post.mockResolvedValueOnce({
        data: {
          success: true,
          answer: 'Result',
          sources: ['agent1']
        }
      })
      const queryResult = await executeQuery('Test query', {})
      expect(queryResult.success).toBe(true)

      // Get status
      axios.get.mockResolvedValueOnce({
        data: {
          success: true,
          data: { status: { orchestrator: { status: 'running' } } }
        }
      })
      const statusResult = await getOrchestratorStatus()
      expect(statusResult.success).toBe(true)

      // Stop
      axios.post.mockResolvedValueOnce({
        data: { success: true, data: { status: 'stopped' } }
      })
      const stopResult = await stopOrchestrator()
      expect(stopResult.success).toBe(true)
    })

    it('should handle multiple concurrent queries', async () => {
      axios.post.mockResolvedValue({
        data: { success: true, answer: 'Result' }
      })

      const queries = [
        executeQuery('Query 1', {}),
        executeQuery('Query 2', {}),
        executeQuery('Query 3', {})
      ]

      const results = await Promise.all(queries)

      expect(results).toHaveLength(3)
      expect(results.every(r => r.success)).toBe(true)
      expect(axios.post).toHaveBeenCalledTimes(3)
    })
  })
})
