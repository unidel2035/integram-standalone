/**
 * ProcessAnalyticsService - Process Analytics with PQ-Programs
 *
 * Provides analytics and reporting for process execution using PQ declarative queries:
 * - Process execution statistics
 * - Agent performance metrics
 * - Bottleneck detection
 * - Trend analysis
 *
 * @see Issue #2463 - Phase 6: Advanced Features
 * @see /CLAUDE.md - Flow Editor Development Guidelines (PQ-Programs)
 */

import EventEmitter from 'events'
import logger from '../../utils/logger.js'
import { PQExecutionService } from '../pq/PQExecutionService.js'

/**
 * ProcessAnalyticsService Class
 * Uses PQ-programs for declarative analytics queries
 */
export class ProcessAnalyticsService extends EventEmitter {
  constructor(options = {}) {
    super()

    this.storage = options.storage
    this.processOrchestrator = options.processOrchestrator

    // Initialize PQ execution service
    this.pqService = new PQExecutionService({ storage: this.storage })

    logger.info('ProcessAnalyticsService initialized')
  }

  /**
   * Get process execution statistics for a specific process
   *
   * @param {string} processId - Process definition ID
   * @param {Object} dateRange - Date range { start, end }
   * @returns {Promise<Object>} Execution statistics
   */
  async getExecutionStats(processId, dateRange = {}) {
    try {
      // Build PQ program to query process instances
      const pqProgram = `
        FROM ProcessExecution.ProcessInstance
        WHERE processDefinitionId == "${processId}"
        ${dateRange.start ? `AND startTime >= "${dateRange.start}"` : ''}
        ${dateRange.end ? `AND startTime <= "${dateRange.end}"` : ''}
        SELECT state, startTime, endTime, variables
      `

      const results = await this.pqService.execute(pqProgram)

      // Aggregate statistics
      const stats = {
        totalExecutions: results.length,
        completed: 0,
        running: 0,
        failed: 0,
        cancelled: 0,
        avgDuration: 0,
        minDuration: Infinity,
        maxDuration: 0,
        completionRate: 0,
        failureRate: 0
      }

      const durations = []

      for (const instance of results) {
        // Count by state
        stats[instance.state] = (stats[instance.state] || 0) + 1

        // Calculate duration
        if (instance.endTime) {
          const duration = new Date(instance.endTime) - new Date(instance.startTime)
          durations.push(duration)
        }
      }

      // Calculate average, min, max duration
      if (durations.length > 0) {
        stats.avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length
        stats.minDuration = Math.min(...durations)
        stats.maxDuration = Math.max(...durations)
      }

      // Calculate rates
      if (stats.totalExecutions > 0) {
        stats.completionRate = (stats.completed || 0) / stats.totalExecutions
        stats.failureRate = (stats.failed || 0) / stats.totalExecutions
      }

      logger.debug('Execution statistics calculated', {
        processId,
        stats
      })

      return stats
    } catch (error) {
      logger.error('Failed to get execution stats:', error, { processId })
      throw error
    }
  }

  /**
   * Get agent performance metrics
   *
   * @param {string} agentId - Agent ID
   * @param {Object} dateRange - Date range { start, end }
   * @returns {Promise<Object>} Agent performance metrics
   */
  async getAgentPerformance(agentId, dateRange = {}) {
    try {
      // Build PQ program to query task instances assigned to agent
      const pqProgram = `
        FROM ProcessExecution.TaskInstance
        WHERE assignee == "${agentId}"
        ${dateRange.start ? `AND startTime >= "${dateRange.start}"` : ''}
        ${dateRange.end ? `AND startTime <= "${dateRange.end}"` : ''}
        SELECT state, startTime, endTime, taskType
      `

      const results = await this.pqService.execute(pqProgram)

      const metrics = {
        agentId,
        tasksCompleted: 0,
        tasksFailed: 0,
        tasksActive: 0,
        avgTaskDuration: 0,
        successRate: 0,
        tasksByType: {}
      }

      const durations = []

      for (const task of results) {
        // Count by state
        if (task.state === 'completed') {
          metrics.tasksCompleted++
        } else if (task.state === 'failed') {
          metrics.tasksFailed++
        } else if (task.state === 'active') {
          metrics.tasksActive++
        }

        // Calculate duration
        if (task.endTime) {
          const duration = new Date(task.endTime) - new Date(task.startTime)
          durations.push(duration)
        }

        // Count by task type
        metrics.tasksByType[task.taskType] = (metrics.tasksByType[task.taskType] || 0) + 1
      }

      // Calculate average duration
      if (durations.length > 0) {
        metrics.avgTaskDuration = durations.reduce((a, b) => a + b, 0) / durations.length
      }

      // Calculate success rate
      const total = metrics.tasksCompleted + metrics.tasksFailed
      if (total > 0) {
        metrics.successRate = metrics.tasksCompleted / total
      }

      logger.debug('Agent performance metrics calculated', {
        agentId,
        metrics
      })

      return metrics
    } catch (error) {
      logger.error('Failed to get agent performance:', error, { agentId })
      throw error
    }
  }

  /**
   * Detect bottlenecks in process execution
   *
   * @param {string} processId - Process definition ID
   * @param {Object} options - Analysis options
   * @returns {Promise<Array>} List of bottleneck nodes
   */
  async detectBottlenecks(processId, options = {}) {
    try {
      const limit = options.limit || 10

      // Build PQ program to find tasks with longest average duration
      const pqProgram = `
        FROM ProcessExecution.TaskInstance
        WHERE processDefinitionId == "${processId}"
        SELECT nodeId, startTime, endTime
      `

      const results = await this.pqService.execute(pqProgram)

      // Group by nodeId and calculate average duration
      const nodeStats = new Map()

      for (const task of results) {
        if (!task.endTime) continue

        const duration = new Date(task.endTime) - new Date(task.startTime)
        const nodeId = task.nodeId

        if (!nodeStats.has(nodeId)) {
          nodeStats.set(nodeId, {
            nodeId,
            executions: 0,
            totalDuration: 0,
            avgDuration: 0,
            maxDuration: 0,
            minDuration: Infinity
          })
        }

        const stats = nodeStats.get(nodeId)
        stats.executions++
        stats.totalDuration += duration
        stats.maxDuration = Math.max(stats.maxDuration, duration)
        stats.minDuration = Math.min(stats.minDuration, duration)
      }

      // Calculate averages
      for (const [nodeId, stats] of nodeStats.entries()) {
        stats.avgDuration = stats.totalDuration / stats.executions
      }

      // Sort by average duration (descending) and take top N
      const bottlenecks = Array.from(nodeStats.values())
        .sort((a, b) => b.avgDuration - a.avgDuration)
        .slice(0, limit)

      logger.debug('Bottlenecks detected', {
        processId,
        bottleneckCount: bottlenecks.length
      })

      return bottlenecks
    } catch (error) {
      logger.error('Failed to detect bottlenecks:', error, { processId })
      throw error
    }
  }

  /**
   * Analyze execution trends over time
   *
   * @param {string} processId - Process definition ID
   * @param {string} groupBy - Time grouping: 'hour', 'day', 'week', 'month'
   * @param {Object} dateRange - Date range { start, end }
   * @returns {Promise<Array>} Trend data
   */
  async analyzeTrends(processId, groupBy = 'day', dateRange = {}) {
    try {
      // Build PQ program
      const pqProgram = `
        FROM ProcessExecution.ProcessInstance
        WHERE processDefinitionId == "${processId}"
        ${dateRange.start ? `AND startTime >= "${dateRange.start}"` : ''}
        ${dateRange.end ? `AND startTime <= "${dateRange.end}"` : ''}
        SELECT state, startTime, endTime
      `

      const results = await this.pqService.execute(pqProgram)

      // Group by time period
      const trends = new Map()

      for (const instance of results) {
        const timestamp = new Date(instance.startTime)
        const period = this.getTimePeriod(timestamp, groupBy)

        if (!trends.has(period)) {
          trends.set(period, {
            period,
            total: 0,
            completed: 0,
            failed: 0,
            running: 0,
            avgDuration: 0,
            durations: []
          })
        }

        const trendData = trends.get(period)
        trendData.total++
        trendData[instance.state] = (trendData[instance.state] || 0) + 1

        // Calculate duration
        if (instance.endTime) {
          const duration = new Date(instance.endTime) - new Date(instance.startTime)
          trendData.durations.push(duration)
        }
      }

      // Calculate averages for each period
      for (const [period, data] of trends.entries()) {
        if (data.durations.length > 0) {
          data.avgDuration = data.durations.reduce((a, b) => a + b, 0) / data.durations.length
        }
        delete data.durations // Remove temporary array
      }

      // Convert to sorted array
      const trendArray = Array.from(trends.values())
        .sort((a, b) => new Date(a.period) - new Date(b.period))

      logger.debug('Trends analyzed', {
        processId,
        groupBy,
        periods: trendArray.length
      })

      return trendArray
    } catch (error) {
      logger.error('Failed to analyze trends:', error, { processId })
      throw error
    }
  }

  /**
   * Get comprehensive process metrics dashboard data
   *
   * @param {string} processId - Process definition ID
   * @param {Object} dateRange - Date range { start, end }
   * @returns {Promise<Object>} Dashboard data
   */
  async getDashboardData(processId, dateRange = {}) {
    try {
      logger.info('Generating dashboard data', { processId })

      const [
        executionStats,
        bottlenecks,
        trends
      ] = await Promise.all([
        this.getExecutionStats(processId, dateRange),
        this.detectBottlenecks(processId, { limit: 5 }),
        this.analyzeTrends(processId, 'day', dateRange)
      ])

      return {
        processId,
        dateRange,
        executionStats,
        bottlenecks,
        trends,
        generatedAt: new Date().toISOString()
      }
    } catch (error) {
      logger.error('Failed to generate dashboard data:', error, { processId })
      throw error
    }
  }

  /**
   * Get time period for grouping
   */
  getTimePeriod(timestamp, groupBy) {
    const date = new Date(timestamp)

    switch (groupBy) {
      case 'hour':
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:00`

      case 'day':
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

      case 'week':
        const weekStart = new Date(date)
        weekStart.setDate(date.getDate() - date.getDay())
        return `${weekStart.getFullYear()}-W${String(Math.ceil((weekStart - new Date(weekStart.getFullYear(), 0, 1)) / (7 * 24 * 60 * 60 * 1000))).padStart(2, '0')}`

      case 'month':
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`

      default:
        return date.toISOString().split('T')[0]
    }
  }

  /**
   * Execute custom PQ analytics query
   *
   * @param {string} pqProgram - PQ program string
   * @returns {Promise<any>} Query results
   */
  async executeCustomQuery(pqProgram) {
    try {
      logger.debug('Executing custom PQ analytics query')
      return await this.pqService.execute(pqProgram)
    } catch (error) {
      logger.error('Custom query failed:', error)
      throw error
    }
  }
}

export default ProcessAnalyticsService
