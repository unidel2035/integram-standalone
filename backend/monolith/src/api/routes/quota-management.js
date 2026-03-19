/**
 * Quota Management API Routes
 * Issue #2482 - User quota management endpoints
 */

import express from 'express'
import { query, param, body, validationResult } from 'express-validator'
import { pool } from '../../config/database.js'
import { QuotaManagementService } from '../../services/QuotaManagementService.js'

const router = express.Router()

// Initialize quota service
const quotaService = new QuotaManagementService({ db: pool })

/**
 * Validation middleware
 */
const validate = (req, res, next) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() })
  }
  next()
}

/**
 * GET /api/quota-management/system-stats
 * Get system-wide quota statistics
 */
router.get('/system-stats', async (req, res) => {
  try {
    const stats = await quotaService.getSystemQuotaStats()

    res.json({
      success: true,
      data: stats
    })
  } catch (error) {
    console.error('Error fetching system quota stats:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch system quota statistics',
      message: error.message
    })
  }
})

/**
 * GET /api/quota-management/users/:userId/quotas
 * Get user's current quotas and usage
 */
router.get('/users/:userId/quotas', [
  param('userId').isString().trim().notEmpty()
], validate, async (req, res) => {
  try {
    const { userId } = req.params

    const quotas = await quotaService.getUserQuotas(userId)

    res.json({
      success: true,
      data: quotas
    })
  } catch (error) {
    console.error('Error fetching user quotas:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user quotas',
      message: error.message
    })
  }
})

/**
 * POST /api/quota-management/users/:userId/check
 * Check if user can perform an action
 */
router.post('/users/:userId/check', [
  param('userId').isString().trim().notEmpty(),
  body('resourceType').isIn(['api', 'storage', 'compute', 'ai']),
  body('amount').optional().isFloat({ min: 0 })
], validate, async (req, res) => {
  try {
    const { userId } = req.params
    const { resourceType, amount = 1 } = req.body

    const result = await quotaService.checkQuota(userId, resourceType, amount)

    const statusCode = result.allowed ? 200 : 429

    res.status(statusCode).json({
      success: result.allowed,
      data: result
    })
  } catch (error) {
    console.error('Error checking quota:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to check quota',
      message: error.message
    })
  }
})

/**
 * POST /api/quota-management/users/:userId/usage
 * Record resource usage
 */
router.post('/users/:userId/usage', [
  param('userId').isString().trim().notEmpty(),
  body('resourceType').isIn(['api', 'storage', 'compute', 'ai']),
  body('amount').isFloat({ min: 0 }),
  body('metadata').optional().isObject()
], validate, async (req, res) => {
  try {
    const { userId } = req.params
    const { resourceType, amount, metadata = {} } = req.body

    await quotaService.recordUsage(userId, resourceType, amount, metadata)

    res.json({
      success: true,
      message: 'Usage recorded successfully'
    })
  } catch (error) {
    console.error('Error recording usage:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to record usage',
      message: error.message
    })
  }
})

/**
 * GET /api/quota-management/users/:userId/upgrade-recommendation
 * Get upgrade recommendation for user
 */
router.get('/users/:userId/upgrade-recommendation', [
  param('userId').isString().trim().notEmpty()
], validate, async (req, res) => {
  try {
    const { userId } = req.params

    const recommendation = await quotaService.getUpgradeRecommendation(userId)

    res.json({
      success: true,
      data: recommendation
    })
  } catch (error) {
    console.error('Error getting upgrade recommendation:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to get upgrade recommendation',
      message: error.message
    })
  }
})

/**
 * PUT /api/quota-management/users/:userId/quotas
 * Set custom quotas for a user (admin only)
 */
router.put('/users/:userId/quotas', [
  param('userId').isString().trim().notEmpty(),
  body('plan').optional().isIn(['free', 'starter', 'pro', 'business', 'enterprise']),
  body('apiRpm').optional().isInt({ min: -1 }),
  body('apiDaily').optional().isInt({ min: -1 }),
  body('apiMonthly').optional().isInt({ min: -1 }),
  body('storage').optional().isFloat({ min: -1 }),
  body('compute').optional().isFloat({ min: -1 }),
  body('aiDaily').optional().isInt({ min: -1 }),
  body('aiMonthly').optional().isInt({ min: -1 })
], validate, async (req, res) => {
  try {
    // TODO: Add admin authentication check
    const { userId } = req.params
    const quotas = req.body

    await quotaService.setCustomQuotas(userId, quotas)

    res.json({
      success: true,
      message: 'Quotas updated successfully'
    })
  } catch (error) {
    console.error('Error setting custom quotas:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to set custom quotas',
      message: error.message
    })
  }
})

/**
 * GET /api/quota-management/violations
 * Get fair use policy violations
 */
router.get('/violations', [
  query('userId').optional().isString(),
  query('resolved').optional().isBoolean(),
  query('severity').optional().isIn(['warning', 'critical'])
], validate, async (req, res) => {
  try {
    const filters = {}

    if (req.query.userId) filters.userId = req.query.userId
    if (req.query.resolved !== undefined) filters.resolved = req.query.resolved === 'true'
    if (req.query.severity) filters.severity = req.query.severity

    const violations = await quotaService.getViolations(filters)

    res.json({
      success: true,
      data: violations
    })
  } catch (error) {
    console.error('Error fetching violations:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch violations',
      message: error.message
    })
  }
})

/**
 * GET /api/quota-management/all-users
 * Get quota information for all users (for admin dashboard)
 */
router.get('/all-users', [
  query('resourceType').optional().isIn(['api', 'storage', 'compute', 'ai'])
], validate, async (req, res) => {
  try {
    // This endpoint returns mock data for demonstration
    // In production, replace with actual database queries

    const { resourceType = 'api' } = req.query

    // Generate mock data
    const users = [
      { id: 'user-001', name: 'Иван Иванов', plan: 'free' },
      { id: 'user-002', name: 'Мария Петрова', plan: 'starter' },
      { id: 'user-003', name: 'Алексей Сидоров', plan: 'pro' },
      { id: 'user-004', name: 'Елена Васильева', plan: 'business' },
      { id: 'user-005', name: 'Дмитрий Козлов', plan: 'free' }
    ]

    const data = []

    for (const user of users) {
      const quotas = await quotaService.getUserQuotas(user.id)

      data.push({
        userId: user.id,
        userName: user.name,
        plan: user.plan,
        ...quotas.usage,
        ...quotas.limits,
        usagePercent: quotas.usagePercent
      })
    }

    res.json({
      success: true,
      data
    })
  } catch (error) {
    console.error('Error fetching all users quotas:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch all users quotas',
      message: error.message
    })
  }
})

export default router
