// Voice Agent API Routes
// Issue #1275 - Voice agent with microtask delegation system

import express from 'express'
import { body, param, query, validationResult } from 'express-validator'
import { pool } from '../../config/database.js'
import VoiceAgent from '../../agents/VoiceAgent.js'
import MicrotaskManager from '../../core/MicrotaskManager.js'
import { TokenBasedLLMCoordinator } from '../../core/TokenBasedLLMCoordinator.js'
import { MicrotaskStatus, MicrotaskPriority } from '../../agents/VoiceAgent.js'

const router = express.Router()

// Initialize services
const llmCoordinator = new TokenBasedLLMCoordinator({ db: pool })
const microtaskManager = new MicrotaskManager({ db: pool })

// Voice agent instance cache (per user)
const voiceAgents = new Map()

/**
 * Get or create voice agent for user
 */
function getVoiceAgent(userId) {
  if (!voiceAgents.has(userId)) {
    const agent = new VoiceAgent({
      id: `voice_agent_${userId}`,
      db: pool,
      llmCoordinator
    })
    voiceAgents.set(userId, agent)
  }
  return voiceAgents.get(userId)
}

/**
 * Validation middleware
 */
const validate = (req, res, next) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() })
  }
  next()
}

/**
 * POST /api/voice-agent/interact
 * Process voice input and get agent response
 */
router.post('/interact', [
  body('userId').notEmpty().isString(),
  body('input').notEmpty().isString(),
  body('accessToken').notEmpty().isString(),
  body('conversationId').optional().isString(),
  body('context').optional().isObject()
], validate, async (req, res) => {
  try {
    const { userId, input, accessToken, conversationId, context = {} } = req.body

    const agent = getVoiceAgent(userId)

    // Create task for agent
    const task = {
      id: `task_${Date.now()}`,
      type: 'voice_input',
      payload: {
        userId,
        input,
        accessToken,
        context: {
          ...context,
          conversationId
        }
      }
    }

    // Process with agent
    const result = await agent.processTask(task)

    res.json({
      success: true,
      data: result
    })
  } catch (error) {
    console.error('Voice agent interaction error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to process voice input',
      message: error.message
    })
  }
})

/**
 * GET /api/voice-agent/microtasks
 * Get microtasks for current user
 */
router.get('/microtasks', [
  query('userId').notEmpty().isString(),
  query('status').optional().isIn(Object.values(MicrotaskStatus)),
  query('priority').optional().isIn(Object.values(MicrotaskPriority)),
  query('conversationId').optional().isString(),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('offset').optional().isInt({ min: 0 })
], validate, async (req, res) => {
  try {
    const { userId, status, priority, conversationId, limit, offset } = req.query

    const microtasks = await microtaskManager.getUserMicrotasks(userId, {
      status,
      priority,
      conversationId,
      limit: limit ? parseInt(limit) : 50,
      offset: offset ? parseInt(offset) : 0
    })

    res.json({
      success: true,
      data: microtasks
    })
  } catch (error) {
    console.error('Get microtasks error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to get microtasks',
      message: error.message
    })
  }
})

/**
 * GET /api/voice-agent/microtasks/:taskId
 * Get specific microtask
 */
router.get('/microtasks/:taskId', [
  param('taskId').notEmpty().isString()
], validate, async (req, res) => {
  try {
    const { taskId } = req.params

    const microtask = await microtaskManager.getMicrotask(taskId)

    res.json({
      success: true,
      data: microtask
    })
  } catch (error) {
    console.error('Get microtask error:', error)
    const status = error.message.includes('not found') ? 404 : 500
    res.status(status).json({
      success: false,
      error: 'Failed to get microtask',
      message: error.message
    })
  }
})

/**
 * PATCH /api/voice-agent/microtasks/:taskId
 * Update microtask status
 */
router.patch('/microtasks/:taskId', [
  param('taskId').notEmpty().isString(),
  body('status').notEmpty().isIn(Object.values(MicrotaskStatus)),
  body('assignedTo').optional().isString(),
  body('result').optional(),
  body('notes').optional().isString(),
  body('actualEffort').optional().isString()
], validate, async (req, res) => {
  try {
    const { taskId } = req.params
    const { status, assignedTo, result, notes, actualEffort } = req.body

    const microtask = await microtaskManager.updateMicrotaskStatus(
      taskId,
      status,
      { assignedTo, result, notes, actualEffort }
    )

    res.json({
      success: true,
      data: microtask
    })
  } catch (error) {
    console.error('Update microtask error:', error)
    const httpStatus = error.message.includes('not found') ? 404 : 500
    res.status(httpStatus).json({
      success: false,
      error: 'Failed to update microtask',
      message: error.message
    })
  }
})

/**
 * POST /api/voice-agent/microtasks/:taskId/assign
 * Assign microtask to user
 */
router.post('/microtasks/:taskId/assign', [
  param('taskId').notEmpty().isString(),
  body('assigneeId').notEmpty().isString()
], validate, async (req, res) => {
  try {
    const { taskId } = req.params
    const { assigneeId } = req.body

    const microtask = await microtaskManager.assignMicrotask(taskId, assigneeId)

    res.json({
      success: true,
      data: microtask
    })
  } catch (error) {
    console.error('Assign microtask error:', error)
    const status = error.message.includes('not found') ? 404 : 500
    res.status(status).json({
      success: false,
      error: 'Failed to assign microtask',
      message: error.message
    })
  }
})

/**
 * POST /api/voice-agent/microtasks/:taskId/complete
 * Complete a microtask
 */
router.post('/microtasks/:taskId/complete', [
  param('taskId').notEmpty().isString(),
  body('result').notEmpty(),
  body('notes').optional().isString()
], validate, async (req, res) => {
  try {
    const { taskId } = req.params
    const { result, notes } = req.body

    const microtask = await microtaskManager.completeMicrotask(taskId, result, notes)

    res.json({
      success: true,
      data: microtask
    })
  } catch (error) {
    console.error('Complete microtask error:', error)
    const status = error.message.includes('not found') ? 404 : 500
    res.status(status).json({
      success: false,
      error: 'Failed to complete microtask',
      message: error.message
    })
  }
})

/**
 * POST /api/voice-agent/microtasks/:taskId/cancel
 * Cancel a microtask
 */
router.post('/microtasks/:taskId/cancel', [
  param('taskId').notEmpty().isString(),
  body('reason').notEmpty().isString()
], validate, async (req, res) => {
  try {
    const { taskId } = req.params
    const { reason } = req.body

    const microtask = await microtaskManager.cancelMicrotask(taskId, reason)

    res.json({
      success: true,
      data: microtask
    })
  } catch (error) {
    console.error('Cancel microtask error:', error)
    const status = error.message.includes('not found') ? 404 : 500
    res.status(status).json({
      success: false,
      error: 'Failed to cancel microtask',
      message: error.message
    })
  }
})

/**
 * DELETE /api/voice-agent/microtasks/:taskId
 * Delete a microtask
 */
router.delete('/microtasks/:taskId', [
  param('taskId').notEmpty().isString()
], validate, async (req, res) => {
  try {
    const { taskId } = req.params

    await microtaskManager.deleteMicrotask(taskId)

    res.json({
      success: true,
      message: 'Microtask deleted successfully'
    })
  } catch (error) {
    console.error('Delete microtask error:', error)
    const status = error.message.includes('not found') ? 404 : 500
    res.status(status).json({
      success: false,
      error: 'Failed to delete microtask',
      message: error.message
    })
  }
})

/**
 * GET /api/voice-agent/microtasks/stats
 * Get microtask statistics for user
 */
router.get('/stats', [
  query('userId').notEmpty().isString()
], validate, async (req, res) => {
  try {
    const { userId } = req.query

    const stats = await microtaskManager.getMicrotaskStats(userId)

    res.json({
      success: true,
      data: stats
    })
  } catch (error) {
    console.error('Get microtask stats error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to get microtask statistics',
      message: error.message
    })
  }
})

/**
 * GET /api/voice-agent/conversations/:conversationId/microtasks
 * Get all microtasks for a conversation
 */
router.get('/conversations/:conversationId/microtasks', [
  param('conversationId').notEmpty().isString()
], validate, async (req, res) => {
  try {
    const { conversationId } = req.params

    const microtasks = await microtaskManager.getConversationMicrotasks(conversationId)

    res.json({
      success: true,
      data: microtasks
    })
  } catch (error) {
    console.error('Get conversation microtasks error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to get conversation microtasks',
      message: error.message
    })
  }
})

/**
 * GET /api/voice-agent/health
 * Health check endpoint
 */
router.get('/health', async (req, res) => {
  try {
    // Check database connection
    await pool.query('SELECT 1')

    res.json({
      success: true,
      status: 'healthy',
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    res.status(503).json({
      success: false,
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    })
  }
})

export default router
