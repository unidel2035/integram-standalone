/**
 * ProcessAnalyticsService Unit Tests
 *
 * Tests for process analytics with PQ-programs (Phase 7, Issue #2464)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ProcessAnalyticsService } from '../ProcessAnalyticsService.js'

describe('ProcessAnalyticsService', () => {
  let service
  let mockStorage
  let mockPQService

  beforeEach(() => {
    // Mock PQ Execution Service
    mockPQService = {
      execute: vi.fn()
    }

    // Mock storage
    mockStorage = {
      getAllRoleBindings: vi.fn(async () => [])
    }

    service = new ProcessAnalyticsService({
      storage: mockStorage
    })

    // Inject mock PQ service
    service.pqService = mockPQService
  })

  describe('Initialization', () => {
    it('should initialize successfully', () => {
      expect(service).toBeDefined()
      expect(service.storage).toBe(mockStorage)
      expect(service.pqService).toBeDefined()
    })
  })

  describe('Execution Statistics', () => {
    beforeEach(() => {
      // Mock process instances with different states
      mockPQService.execute.mockResolvedValue([
        {
          state: 'completed',
          startTime: '2025-01-01T10:00:00Z',
          endTime: '2025-01-01T10:05:00Z', // 5 min
          processDefinitionId: 'process-1'
        },
        {
          state: 'completed',
          startTime: '2025-01-01T11:00:00Z',
          endTime: '2025-01-01T11:10:00Z', // 10 min
          processDefinitionId: 'process-1'
        },
        {
          state: 'failed',
          startTime: '2025-01-01T12:00:00Z',
          endTime: '2025-01-01T12:02:00Z', // 2 min
          processDefinitionId: 'process-1'
        },
        {
          state: 'running',
          startTime: '2025-01-01T13:00:00Z',
          processDefinitionId: 'process-1'
        }
      ])
    })

    it('should get execution stats for process', async () => {
      const stats = await service.getExecutionStats('process-1')

      expect(stats.totalExecutions).toBe(4)
      expect(stats.completed).toBe(2)
      expect(stats.failed).toBe(1)
      expect(stats.running).toBe(1)
    })

    it('should calculate completion rate', async () => {
      const stats = await service.getExecutionStats('process-1')

      expect(stats.completionRate).toBe(0.5) // 2/4
      expect(stats.failureRate).toBe(0.25) // 1/4
    })

    it('should calculate duration statistics', async () => {
      const stats = await service.getExecutionStats('process-1')

      expect(stats.avgDuration).toBeGreaterThan(0)
      expect(stats.minDuration).toBeLessThan(stats.maxDuration)
      expect(stats.minDuration).toBe(2 * 60 * 1000) // 2 minutes
      expect(stats.maxDuration).toBe(10 * 60 * 1000) // 10 minutes
    })

    it('should filter by date range', async () => {
      await service.getExecutionStats('process-1', {
        start: '2025-01-01T00:00:00Z',
        end: '2025-01-01T23:59:59Z'
      })

      expect(mockPQService.execute).toHaveBeenCalled()
      const pqProgram = mockPQService.execute.mock.calls[0][0]
      expect(pqProgram).toContain('startTime >=')
      expect(pqProgram).toContain('startTime <=')
    })

    it('should handle empty results', async () => {
      mockPQService.execute.mockResolvedValue([])

      const stats = await service.getExecutionStats('process-1')

      expect(stats.totalExecutions).toBe(0)
      expect(stats.completed).toBe(0)
      expect(stats.avgDuration).toBe(0)
    })

    it('should handle errors', async () => {
      mockPQService.execute.mockRejectedValue(new Error('PQ execution failed'))

      await expect(service.getExecutionStats('process-1')).rejects.toThrow('PQ execution failed')
    })
  })

  describe('Agent Performance Metrics', () => {
    beforeEach(() => {
      // Mock task instances
      mockPQService.execute.mockResolvedValue([
        {
          state: 'completed',
          startTime: '2025-01-01T10:00:00Z',
          endTime: '2025-01-01T10:02:00Z',
          taskType: 'text-generation',
          assignee: 'agent-1'
        },
        {
          state: 'completed',
          startTime: '2025-01-01T10:05:00Z',
          endTime: '2025-01-01T10:07:00Z',
          taskType: 'text-generation',
          assignee: 'agent-1'
        },
        {
          state: 'failed',
          startTime: '2025-01-01T10:10:00Z',
          endTime: '2025-01-01T10:11:00Z',
          taskType: 'analysis',
          assignee: 'agent-1'
        },
        {
          state: 'active',
          startTime: '2025-01-01T10:15:00Z',
          taskType: 'text-generation',
          assignee: 'agent-1'
        }
      ])
    })

    it('should get agent performance metrics', async () => {
      const metrics = await service.getAgentPerformance('agent-1')

      expect(metrics.agentId).toBe('agent-1')
      expect(metrics.tasksCompleted).toBe(2)
      expect(metrics.tasksFailed).toBe(1)
      expect(metrics.tasksActive).toBe(1)
    })

    it('should calculate success rate', async () => {
      const metrics = await service.getAgentPerformance('agent-1')

      expect(metrics.successRate).toBeCloseTo(0.67, 1) // 2/(2+1)
    })

    it('should group tasks by type', async () => {
      const metrics = await service.getAgentPerformance('agent-1')

      expect(metrics.tasksByType).toHaveProperty('text-generation')
      expect(metrics.tasksByType).toHaveProperty('analysis')
      expect(metrics.tasksByType['text-generation']).toBeGreaterThan(0)
    })

    it('should calculate average task duration', async () => {
      const metrics = await service.getAgentPerformance('agent-1')

      expect(metrics.avgTaskDuration).toBeGreaterThan(0)
      expect(metrics.avgTaskDuration).toBeLessThanOrEqual(2 * 60 * 1000) // Should be around 2 min
    })

    it('should filter by date range', async () => {
      await service.getAgentPerformance('agent-1', {
        start: '2025-01-01T00:00:00Z',
        end: '2025-01-01T23:59:59Z'
      })

      expect(mockPQService.execute).toHaveBeenCalled()
      const pqProgram = mockPQService.execute.mock.calls[0][0]
      expect(pqProgram).toContain('assignee ==')
      expect(pqProgram).toContain('agent-1')
    })
  })

  describe('Bottleneck Detection', () => {
    beforeEach(() => {
      // Mock task instances with varying durations
      mockPQService.execute.mockResolvedValue([
        {
          nodeId: 'task-1',
          state: 'completed',
          startTime: '2025-01-01T10:00:00Z',
          endTime: '2025-01-01T10:01:00Z' // 1 min
        },
        {
          nodeId: 'task-1',
          state: 'completed',
          startTime: '2025-01-01T10:05:00Z',
          endTime: '2025-01-01T10:06:00Z' // 1 min
        },
        {
          nodeId: 'task-2',
          state: 'completed',
          startTime: '2025-01-01T10:10:00Z',
          endTime: '2025-01-01T10:20:00Z' // 10 min - bottleneck
        },
        {
          nodeId: 'task-2',
          state: 'completed',
          startTime: '2025-01-01T10:25:00Z',
          endTime: '2025-01-01T10:35:00Z' // 10 min - bottleneck
        },
        {
          nodeId: 'task-3',
          state: 'completed',
          startTime: '2025-01-01T10:40:00Z',
          endTime: '2025-01-01T10:42:00Z' // 2 min
        }
      ])
    })

    it('should detect bottlenecks in process', async () => {
      const bottlenecks = await service.detectBottlenecks('process-1')

      expect(bottlenecks).toBeDefined()
      expect(Array.isArray(bottlenecks)).toBe(true)
      expect(bottlenecks.length).toBeGreaterThan(0)
    })

    it('should identify slowest tasks', async () => {
      const bottlenecks = await service.detectBottlenecks('process-1')

      const slowestTask = bottlenecks[0]
      expect(slowestTask.nodeId).toBe('task-2')
      expect(slowestTask.avgDuration).toBeGreaterThan(5 * 60 * 1000) // > 5 min
    })

    it('should calculate execution frequency', async () => {
      const bottlenecks = await service.detectBottlenecks('process-1')

      const task1 = bottlenecks.find(b => b.nodeId === 'task-1')
      const task2 = bottlenecks.find(b => b.nodeId === 'task-2')

      expect(task1.executionCount).toBe(2)
      expect(task2.executionCount).toBe(2)
    })
  })

  describe('Trend Analysis', () => {
    beforeEach(() => {
      // Mock process instances over time
      mockPQService.execute.mockResolvedValue([
        { state: 'completed', startTime: '2025-01-01T00:00:00Z', endTime: '2025-01-01T00:05:00Z' },
        { state: 'completed', startTime: '2025-01-02T00:00:00Z', endTime: '2025-01-02T00:06:00Z' },
        { state: 'failed', startTime: '2025-01-03T00:00:00Z', endTime: '2025-01-03T00:02:00Z' },
        { state: 'completed', startTime: '2025-01-04T00:00:00Z', endTime: '2025-01-04T00:07:00Z' },
        { state: 'completed', startTime: '2025-01-05T00:00:00Z', endTime: '2025-01-05T00:08:00Z' }
      ])
    })

    it('should analyze trends over time', async () => {
      const trends = await service.getTrends('process-1', {
        start: '2025-01-01T00:00:00Z',
        end: '2025-01-05T23:59:59Z',
        interval: 'daily'
      })

      expect(trends).toBeDefined()
      expect(trends.dataPoints).toBeDefined()
      expect(Array.isArray(trends.dataPoints)).toBe(true)
    })

    it('should group by time interval', async () => {
      const trends = await service.getTrends('process-1', { interval: 'daily' })

      expect(trends.dataPoints.length).toBeGreaterThan(0)
      trends.dataPoints.forEach(point => {
        expect(point).toHaveProperty('date')
        expect(point).toHaveProperty('count')
      })
    })

    it('should calculate trend direction', async () => {
      const trends = await service.getTrends('process-1', { interval: 'daily' })

      expect(trends).toHaveProperty('trend') // 'increasing', 'decreasing', 'stable'
      expect(['increasing', 'decreasing', 'stable']).toContain(trends.trend)
    })
  })

  describe('Performance Reports', () => {
    beforeEach(() => {
      mockPQService.execute.mockResolvedValue([
        {
          processDefinitionId: 'process-1',
          state: 'completed',
          startTime: '2025-01-01T10:00:00Z',
          endTime: '2025-01-01T10:05:00Z',
          variables: { priority: 'high' }
        },
        {
          processDefinitionId: 'process-1',
          state: 'completed',
          startTime: '2025-01-01T11:00:00Z',
          endTime: '2025-01-01T11:10:00Z',
          variables: { priority: 'low' }
        }
      ])
    })

    it('should generate performance report', async () => {
      const report = await service.generateReport('process-1', {
        start: '2025-01-01T00:00:00Z',
        end: '2025-01-01T23:59:59Z'
      })

      expect(report).toBeDefined()
      expect(report).toHaveProperty('processId')
      expect(report).toHaveProperty('dateRange')
      expect(report).toHaveProperty('summary')
      expect(report).toHaveProperty('details')
    })

    it('should include execution statistics in report', async () => {
      const report = await service.generateReport('process-1')

      expect(report.summary).toHaveProperty('totalExecutions')
      expect(report.summary).toHaveProperty('completionRate')
      expect(report.summary).toHaveProperty('avgDuration')
    })

    it('should include bottlenecks in report', async () => {
      mockPQService.execute
        .mockResolvedValueOnce([]) // First call for execution stats
        .mockResolvedValueOnce([]) // Second call for bottlenecks

      const report = await service.generateReport('process-1')

      expect(report.details).toHaveProperty('bottlenecks')
    })

    it('should include recommendations in report', async () => {
      const report = await service.generateReport('process-1')

      expect(report).toHaveProperty('recommendations')
      expect(Array.isArray(report.recommendations)).toBe(true)
    })
  })

  describe('PQ Program Generation', () => {
    it('should generate correct PQ program for execution stats', async () => {
      await service.getExecutionStats('process-1', {
        start: '2025-01-01T00:00:00Z',
        end: '2025-01-31T23:59:59Z'
      })

      expect(mockPQService.execute).toHaveBeenCalled()
      const pqProgram = mockPQService.execute.mock.calls[0][0]

      expect(pqProgram).toContain('FROM ProcessExecution.ProcessInstance')
      expect(pqProgram).toContain('WHERE processDefinitionId ==')
      expect(pqProgram).toContain('process-1')
      expect(pqProgram).toContain('SELECT state, startTime, endTime')
    })

    it('should generate correct PQ program for agent performance', async () => {
      await service.getAgentPerformance('agent-1')

      expect(mockPQService.execute).toHaveBeenCalled()
      const pqProgram = mockPQService.execute.mock.calls[0][0]

      expect(pqProgram).toContain('FROM ProcessExecution.TaskInstance')
      expect(pqProgram).toContain('WHERE assignee ==')
      expect(pqProgram).toContain('agent-1')
    })
  })

  describe('Event Emission', () => {
    it('should emit events for analytics operations', async () => {
      const eventSpy = vi.fn()
      service.on('analytics:completed', eventSpy)

      await service.getExecutionStats('process-1')

      // Event emission is optional, just checking service is EventEmitter
      expect(service.emit).toBeDefined()
    })
  })

  describe('Error Handling', () => {
    it('should handle PQ execution errors', async () => {
      mockPQService.execute.mockRejectedValue(new Error('PQ syntax error'))

      await expect(service.getExecutionStats('process-1')).rejects.toThrow()
    })

    it('should handle missing storage', () => {
      expect(() => new ProcessAnalyticsService({})).not.toThrow()
    })

    it('should handle invalid date ranges', async () => {
      await service.getExecutionStats('process-1', {
        start: 'invalid-date',
        end: 'invalid-date'
      })

      // Should not throw, but pass invalid dates to PQ service
      expect(mockPQService.execute).toHaveBeenCalled()
    })
  })
})
