/**
 * Process Analytics API Routes
 *
 * REST API endpoints for process analytics with PQ-programs
 *
 * @see Issue #2463 - Phase 6: Advanced Features
 */

import express from 'express'
import logger from '../../utils/logger.js'
import { ProcessAnalyticsService } from '../../services/process/ProcessAnalyticsService.js'

const router = express.Router()

/**
 * GET /api/process-analytics/dashboard
 * Get comprehensive dashboard data for a process
 */
router.post('/dashboard', async (req, res) => {
  try {
    const { processId, dateRange } = req.body

    if (!processId) {
      return res.status(400).json({
        error: 'processId is required'
      })
    }

    const analyticsService = req.app.get('processAnalyticsService')
    if (!analyticsService) {
      return res.status(500).json({
        error: 'ProcessAnalyticsService not initialized'
      })
    }

    const dashboardData = await analyticsService.getDashboardData(
      processId,
      dateRange || {}
    )

    res.json(dashboardData)
  } catch (error) {
    logger.error('Dashboard API error:', error)
    res.status(500).json({
      error: error.message || 'Failed to load dashboard data'
    })
  }
})

/**
 * POST /api/process-analytics/execution-stats
 * Get execution statistics for a process
 */
router.post('/execution-stats', async (req, res) => {
  try {
    const { processId, dateRange } = req.body

    if (!processId) {
      return res.status(400).json({
        error: 'processId is required'
      })
    }

    const analyticsService = req.app.get('processAnalyticsService')
    const stats = await analyticsService.getExecutionStats(processId, dateRange || {})

    res.json(stats)
  } catch (error) {
    logger.error('Execution stats API error:', error)
    res.status(500).json({
      error: error.message
    })
  }
})

/**
 * POST /api/process-analytics/agent-performance
 * Get agent performance metrics
 */
router.post('/agent-performance', async (req, res) => {
  try {
    const { agentId, dateRange } = req.body

    if (!agentId) {
      return res.status(400).json({
        error: 'agentId is required'
      })
    }

    const analyticsService = req.app.get('processAnalyticsService')
    const metrics = await analyticsService.getAgentPerformance(agentId, dateRange || {})

    res.json(metrics)
  } catch (error) {
    logger.error('Agent performance API error:', error)
    res.status(500).json({
      error: error.message
    })
  }
})

/**
 * POST /api/process-analytics/bottlenecks
 * Detect process bottlenecks
 */
router.post('/bottlenecks', async (req, res) => {
  try {
    const { processId, limit } = req.body

    if (!processId) {
      return res.status(400).json({
        error: 'processId is required'
      })
    }

    const analyticsService = req.app.get('processAnalyticsService')
    const bottlenecks = await analyticsService.detectBottlenecks(processId, { limit: limit || 10 })

    res.json(bottlenecks)
  } catch (error) {
    logger.error('Bottlenecks API error:', error)
    res.status(500).json({
      error: error.message
    })
  }
})

/**
 * POST /api/process-analytics/trends
 * Analyze execution trends
 */
router.post('/trends', async (req, res) => {
  try {
    const { processId, groupBy, dateRange } = req.body

    if (!processId) {
      return res.status(400).json({
        error: 'processId is required'
      })
    }

    const analyticsService = req.app.get('processAnalyticsService')
    const trends = await analyticsService.analyzeTrends(
      processId,
      groupBy || 'day',
      dateRange || {}
    )

    res.json(trends)
  } catch (error) {
    logger.error('Trends API error:', error)
    res.status(500).json({
      error: error.message
    })
  }
})

/**
 * POST /api/process-analytics/query
 * Execute custom PQ analytics query
 */
router.post('/query', async (req, res) => {
  try {
    const { pqProgram } = req.body

    if (!pqProgram) {
      return res.status(400).json({
        error: 'pqProgram is required'
      })
    }

    const analyticsService = req.app.get('processAnalyticsService')
    const results = await analyticsService.executeCustomQuery(pqProgram)

    res.json(results)
  } catch (error) {
    logger.error('Custom query API error:', error)
    res.status(500).json({
      error: error.message
    })
  }
})

export default router
