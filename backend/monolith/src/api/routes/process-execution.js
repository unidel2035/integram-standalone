/**
 * Process Execution API Routes
 *
 * REST API for workflow process execution:
 * - Start process instances
 * - Pause/resume/cancel processes
 * - Get process instance status
 * - Query active processes
 * - Get task instances
 * - Get event occurrences
 * - Real-time execution monitoring
 *
 * @see Issue #2460 - Phase 3: Process Execution Engine
 * @see /CLAUDE.md - Backend Development Guidelines
 */

import express from 'express'
import logger from '../../utils/logger.js'
import { ProcessOrchestrator } from '../../services/process/ProcessOrchestrator.js'
import { AgentManager } from '../../services/AgentManager.js'
import { RoleSetStorage } from '../../storage/RoleSetStorage.js'

/**
 * Create Process Execution routes
 */
export function createProcessExecutionRoutes() {
  const router = express.Router()

  // Initialize dependencies
  const storage = new RoleSetStorage()
  const agentManager = new AgentManager()
  const orchestrator = new ProcessOrchestrator({ agentManager, storage })

  // Initialize orchestrator
  let initialized = false
  const ensureInitialized = async () => {
    if (!initialized) {
      await orchestrator.initialize()
      initialized = true
    }
  }

  // ========================================
  // Process Instance Management
  // ========================================

  /**
   * POST /api/process-execution/start
   * Start a new process instance
   */
  router.post('/start', async (req, res, next) => {
    try {
      await ensureInitialized()

      const { processDefinition, variables, options } = req.body

      if (!processDefinition) {
        return res.status(400).json({
          success: false,
          error: 'Process definition is required'
        })
      }

      const result = await orchestrator.startProcess(
        processDefinition,
        variables || {},
        options || {}
      )

      res.status(201).json({
        success: true,
        data: result
      })
    } catch (error) {
      logger.error('Error starting process:', error)
      next(error)
    }
  })

  /**
   * GET /api/process-execution/instances
   * Get all process instances (optionally filtered by state)
   */
  router.get('/instances', async (req, res, next) => {
    try {
      await ensureInitialized()

      const { state, limit, offset } = req.query

      const instances = await orchestrator.getActiveProcessInstances()

      // Filter by state if provided
      const filtered = state
        ? instances.filter(i => i.state === state)
        : instances

      // Apply pagination
      const start = offset ? parseInt(offset) : 0
      const end = limit ? start + parseInt(limit) : filtered.length
      const paginated = filtered.slice(start, end)

      res.json({
        success: true,
        data: paginated,
        count: paginated.length,
        total: filtered.length
      })
    } catch (error) {
      logger.error('Error getting process instances:', error)
      next(error)
    }
  })

  /**
   * GET /api/process-execution/instances/:id
   * Get process instance by ID
   */
  router.get('/instances/:id', async (req, res, next) => {
    try {
      await ensureInitialized()

      const instance = await orchestrator.getProcessInstance(req.params.id)

      res.json({
        success: true,
        data: instance
      })
    } catch (error) {
      if (error.message.includes('not found')) {
        return res.status(404).json({
          success: false,
          error: 'Process instance not found'
        })
      }
      logger.error('Error getting process instance:', error)
      next(error)
    }
  })

  /**
   * POST /api/process-execution/instances/:id/pause
   * Pause process instance
   */
  router.post('/instances/:id/pause', async (req, res, next) => {
    try {
      await ensureInitialized()

      await orchestrator.pauseProcess(req.params.id)

      res.json({
        success: true,
        message: 'Process paused'
      })
    } catch (error) {
      logger.error('Error pausing process:', error)
      next(error)
    }
  })

  /**
   * POST /api/process-execution/instances/:id/resume
   * Resume paused process instance
   */
  router.post('/instances/:id/resume', async (req, res, next) => {
    try {
      await ensureInitialized()

      await orchestrator.resumeProcess(req.params.id)

      res.json({
        success: true,
        message: 'Process resumed'
      })
    } catch (error) {
      logger.error('Error resuming process:', error)
      next(error)
    }
  })

  /**
   * POST /api/process-execution/instances/:id/cancel
   * Cancel process instance
   */
  router.post('/instances/:id/cancel', async (req, res, next) => {
    try {
      await ensureInitialized()

      await orchestrator.cancelProcess(req.params.id)

      res.json({
        success: true,
        message: 'Process cancelled'
      })
    } catch (error) {
      logger.error('Error cancelling process:', error)
      next(error)
    }
  })

  // ========================================
  // Task Instance Management
  // ========================================

  /**
   * GET /api/process-execution/tasks
   * Get task instances (optionally filtered by process instance or state)
   */
  router.get('/tasks', async (req, res, next) => {
    try {
      await ensureInitialized()

      const { processInstanceId, state, limit, offset } = req.query

      // Get all role bindings for TaskInstance role
      const allBindings = await storage.getAllRoleBindings()
      const taskBindings = allBindings.filter(b => {
        // Find TaskInstance role
        return b.witness && b.witness.processInstanceId
      })

      // Filter by process instance if provided
      let filtered = taskBindings
      if (processInstanceId) {
        filtered = filtered.filter(b => b.witness.processInstanceId === processInstanceId)
      }

      // Filter by state if provided
      if (state) {
        filtered = filtered.filter(b => b.witness.state === state)
      }

      // Apply pagination
      const start = offset ? parseInt(offset) : 0
      const end = limit ? start + parseInt(limit) : filtered.length
      const paginated = filtered.slice(start, end)

      // Transform to task instances
      const tasks = paginated.map(b => ({
        id: b.thingId,
        ...b.witness
      }))

      res.json({
        success: true,
        data: tasks,
        count: tasks.length,
        total: filtered.length
      })
    } catch (error) {
      logger.error('Error getting tasks:', error)
      next(error)
    }
  })

  /**
   * GET /api/process-execution/tasks/:id
   * Get task instance by ID
   */
  router.get('/tasks/:id', async (req, res, next) => {
    try {
      await ensureInitialized()

      const bindings = await storage.getRoleBindingsByThing(req.params.id)
      const taskBinding = bindings.find(b => b.witness && b.witness.processInstanceId)

      if (!taskBinding) {
        return res.status(404).json({
          success: false,
          error: 'Task not found'
        })
      }

      res.json({
        success: true,
        data: {
          id: req.params.id,
          ...taskBinding.witness
        }
      })
    } catch (error) {
      logger.error('Error getting task:', error)
      next(error)
    }
  })

  /**
   * POST /api/process-execution/tasks/:id/complete
   * Complete a task manually
   */
  router.post('/tasks/:id/complete', async (req, res, next) => {
    try {
      await ensureInitialized()

      const { result } = req.body

      await orchestrator.completeTask(req.params.id, result || {})

      res.json({
        success: true,
        message: 'Task completed'
      })
    } catch (error) {
      logger.error('Error completing task:', error)
      next(error)
    }
  })

  // ========================================
  // Event Management
  // ========================================

  /**
   * GET /api/process-execution/events
   * Get event occurrences (optionally filtered by process instance or event type)
   */
  router.get('/events', async (req, res, next) => {
    try {
      await ensureInitialized()

      const { processInstanceId, eventType, limit, offset } = req.query

      // Get all role bindings for EventOccurrence role
      const allBindings = await storage.getAllRoleBindings()
      const eventBindings = allBindings.filter(b => {
        return b.witness && b.witness.eventType
      })

      // Filter by process instance if provided
      let filtered = eventBindings
      if (processInstanceId) {
        filtered = filtered.filter(b => b.witness.processInstanceId === processInstanceId)
      }

      // Filter by event type if provided
      if (eventType) {
        filtered = filtered.filter(b => b.witness.eventType === eventType)
      }

      // Apply pagination
      const start = offset ? parseInt(offset) : 0
      const end = limit ? start + parseInt(limit) : filtered.length
      const paginated = filtered.slice(start, end)

      // Transform to event occurrences
      const events = paginated.map(b => ({
        id: b.thingId,
        ...b.witness
      }))

      res.json({
        success: true,
        data: events,
        count: events.length,
        total: filtered.length
      })
    } catch (error) {
      logger.error('Error getting events:', error)
      next(error)
    }
  })

  /**
   * POST /api/process-execution/events/trigger
   * Trigger an event (for external event triggering)
   */
  router.post('/events/trigger', async (req, res, next) => {
    try {
      await ensureInitialized()

      const { processInstanceId, eventType, eventData } = req.body

      if (!processInstanceId || !eventType) {
        return res.status(400).json({
          success: false,
          error: 'processInstanceId and eventType are required'
        })
      }

      const eventId = await orchestrator.recordEventOccurrence(
        processInstanceId,
        eventType,
        eventData || {}
      )

      res.status(201).json({
        success: true,
        data: { eventId }
      })
    } catch (error) {
      logger.error('Error triggering event:', error)
      next(error)
    }
  })

  // ========================================
  // Variable Snapshots
  // ========================================

  /**
   * GET /api/process-execution/snapshots
   * Get variable snapshots for a process instance
   */
  router.get('/snapshots', async (req, res, next) => {
    try {
      await ensureInitialized()

      const { processInstanceId, limit, offset } = req.query

      if (!processInstanceId) {
        return res.status(400).json({
          success: false,
          error: 'processInstanceId is required'
        })
      }

      // Get all role bindings for VariableSnapshot role
      const allBindings = await storage.getAllRoleBindings()
      const snapshotBindings = allBindings.filter(b => {
        return b.witness &&
          b.witness.processInstanceId === processInstanceId &&
          b.witness.variables
      })

      // Apply pagination
      const start = offset ? parseInt(offset) : 0
      const end = limit ? start + parseInt(limit) : snapshotBindings.length
      const paginated = snapshotBindings.slice(start, end)

      // Transform to snapshots
      const snapshots = paginated.map(b => ({
        id: b.thingId,
        ...b.witness
      }))

      res.json({
        success: true,
        data: snapshots,
        count: snapshots.length,
        total: snapshotBindings.length
      })
    } catch (error) {
      logger.error('Error getting snapshots:', error)
      next(error)
    }
  })

  // ========================================
  // Statistics and Monitoring
  // ========================================

  /**
   * GET /api/process-execution/stats
   * Get orchestrator statistics
   */
  router.get('/stats', async (req, res, next) => {
    try {
      await ensureInitialized()

      const stats = orchestrator.getStats()

      res.json({
        success: true,
        data: stats
      })
    } catch (error) {
      logger.error('Error getting stats:', error)
      next(error)
    }
  })

  /**
   * GET /api/process-execution/health
   * Health check endpoint
   */
  router.get('/health', (req, res) => {
    res.json({
      success: true,
      status: 'healthy',
      initialized
    })
  })

  return router
}
