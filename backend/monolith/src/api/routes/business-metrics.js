/**
 * Business Metrics API Routes
 *
 * Provides RESTful API for business metrics collection and analytics:
 * - Event tracking
 * - KPI calculations (retention, churn, LTV)
 * - A/B testing
 * - Feature flags
 * - Export to external systems
 */

import express from 'express'
import BusinessMetricsService from '../../services/analytics/BusinessMetricsService.js'

const router = express.Router()
const metricsService = new BusinessMetricsService()

// Initialize service
metricsService.init().catch(error => {
  console.error('Failed to initialize BusinessMetricsService:', error)
})

/**
 * @route   POST /api/business-metrics/events
 * @desc    Track an event
 * @access  Public (in production, this should be authenticated)
 */
router.post('/events', async (req, res) => {
  try {
    const event = await metricsService.trackEvent(req.body)

    res.json({
      success: true,
      data: event
    })
  } catch (error) {
    console.error('Error tracking event:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * @route   GET /api/business-metrics/events
 * @desc    Get events with filters
 * @access  Private
 */
router.get('/events', async (req, res) => {
  try {
    const filters = {
      userId: req.query.userId,
      eventType: req.query.eventType,
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      limit: parseInt(req.query.limit) || 100,
      offset: parseInt(req.query.offset) || 0
    }

    const result = await metricsService.getEvents(filters)

    res.json({
      success: true,
      data: result
    })
  } catch (error) {
    console.error('Error getting events:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * @route   GET /api/business-metrics/retention
 * @desc    Calculate retention metrics
 * @access  Private
 */
router.get('/retention', async (req, res) => {
  try {
    const options = {
      cohortStartDate: req.query.cohortStartDate,
      cohortEndDate: req.query.cohortEndDate,
      periods: parseInt(req.query.periods) || 7
    }

    const retention = await metricsService.calculateRetention(options)

    res.json({
      success: true,
      data: retention
    })
  } catch (error) {
    console.error('Error calculating retention:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * @route   GET /api/business-metrics/churn
 * @desc    Calculate churn metrics
 * @access  Private
 */
router.get('/churn', async (req, res) => {
  try {
    const options = {
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      periodDays: parseInt(req.query.periodDays) || 30
    }

    const churn = await metricsService.calculateChurn(options)

    res.json({
      success: true,
      data: churn
    })
  } catch (error) {
    console.error('Error calculating churn:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * @route   GET /api/business-metrics/ltv
 * @desc    Calculate Customer Lifetime Value
 * @access  Private
 */
router.get('/ltv', async (req, res) => {
  try {
    const options = {
      revenueEventType: req.query.revenueEventType || 'purchase',
      periodDays: parseInt(req.query.periodDays) || 30
    }

    const ltv = await metricsService.calculateLTV(options)

    res.json({
      success: true,
      data: ltv
    })
  } catch (error) {
    console.error('Error calculating LTV:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * @route   POST /api/business-metrics/ab-tests
 * @desc    Create A/B test
 * @access  Private
 */
router.post('/ab-tests', async (req, res) => {
  try {
    const test = await metricsService.createABTest(req.body)

    res.json({
      success: true,
      data: test
    })
  } catch (error) {
    console.error('Error creating A/B test:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * @route   GET /api/business-metrics/ab-tests/:testId/variant
 * @desc    Get A/B test variant for user
 * @access  Public
 */
router.get('/ab-tests/:testId/variant', async (req, res) => {
  try {
    const { testId } = req.params
    const { userId } = req.query

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'userId is required'
      })
    }

    const variant = metricsService.getABTestVariant(testId, userId)

    res.json({
      success: true,
      data: { variant }
    })
  } catch (error) {
    console.error('Error getting A/B test variant:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * @route   GET /api/business-metrics/ab-tests/:testId/results
 * @desc    Get A/B test results
 * @access  Private
 */
router.get('/ab-tests/:testId/results', async (req, res) => {
  try {
    const { testId } = req.params
    const results = await metricsService.getABTestResults(testId)

    res.json({
      success: true,
      data: results
    })
  } catch (error) {
    console.error('Error getting A/B test results:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * @route   POST /api/business-metrics/feature-flags
 * @desc    Create or update feature flag
 * @access  Private
 */
router.post('/feature-flags', async (req, res) => {
  try {
    const flag = await metricsService.setFeatureFlag(req.body)

    res.json({
      success: true,
      data: flag
    })
  } catch (error) {
    console.error('Error setting feature flag:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * @route   GET /api/business-metrics/feature-flags
 * @desc    Get all feature flags
 * @access  Private
 */
router.get('/feature-flags', async (req, res) => {
  try {
    const flags = await metricsService.getFeatureFlags()

    res.json({
      success: true,
      data: flags
    })
  } catch (error) {
    console.error('Error getting feature flags:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * @route   GET /api/business-metrics/feature-flags/:flagId/enabled
 * @desc    Check if feature is enabled for user
 * @access  Public
 */
router.get('/feature-flags/:flagId/enabled', async (req, res) => {
  try {
    const { flagId } = req.params
    const { userId, userGroups } = req.query

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'userId is required'
      })
    }

    const groups = userGroups ? userGroups.split(',') : []
    const enabled = metricsService.isFeatureEnabled(flagId, userId, groups)

    res.json({
      success: true,
      data: { enabled }
    })
  } catch (error) {
    console.error('Error checking feature flag:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * @route   POST /api/business-metrics/export
 * @desc    Export metrics to external system
 * @access  Private
 */
router.post('/export', async (req, res) => {
  try {
    const { system, startDate, endDate } = req.body

    if (!system) {
      return res.status(400).json({
        success: false,
        error: 'system is required'
      })
    }

    const result = await metricsService.exportMetrics(system, { startDate, endDate })

    res.json({
      success: true,
      data: result
    })
  } catch (error) {
    console.error('Error exporting metrics:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * @route   GET /api/business-metrics/dashboard
 * @desc    Get dashboard data with all key metrics
 * @access  Private
 */
router.get('/dashboard', async (req, res) => {
  try {
    const { startDate, endDate } = req.query

    // Calculate all metrics in parallel
    const [retention, churn, ltv, events] = await Promise.all([
      metricsService.calculateRetention({ cohortStartDate: startDate, cohortEndDate: endDate }),
      metricsService.calculateChurn({ startDate, endDate }),
      metricsService.calculateLTV(),
      metricsService.getEvents({ startDate, endDate, limit: 1000 })
    ])

    // Calculate event statistics
    const eventTypes = new Map()
    const userActivity = new Map()

    for (const event of events.events) {
      // Count by event type
      eventTypes.set(event.eventType, (eventTypes.get(event.eventType) || 0) + 1)

      // Count by user
      if (event.userId) {
        userActivity.set(event.userId, (userActivity.get(event.userId) || 0) + 1)
      }
    }

    const dashboardData = {
      overview: {
        totalEvents: events.total,
        activeUsers: userActivity.size,
        averageEventsPerUser: userActivity.size > 0 ? events.total / userActivity.size : 0,
        eventTypes: Array.from(eventTypes.entries()).map(([type, count]) => ({ type, count }))
      },
      retention: {
        summary: retention.summary,
        latestCohort: retention.cohorts[retention.cohorts.length - 1] || null
      },
      churn: {
        averageRate: churn.averageChurnRate,
        latestPeriod: churn.periods[churn.periods.length - 1] || null
      },
      ltv: {
        average: ltv.averageLTV,
        totalRevenue: ltv.totalRevenue,
        totalUsers: ltv.totalUsers
      }
    }

    res.json({
      success: true,
      data: dashboardData
    })
  } catch (error) {
    console.error('Error getting dashboard data:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

export default router
