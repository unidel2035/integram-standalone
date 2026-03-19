import express from 'express'
import { body, query as queryValidator, param, validationResult } from 'express-validator'
import * as notificationService from '../../services/notifications/notificationService.js'
import * as preferencesService from '../../services/notifications/notificationPreferencesService.js'
import { notificationTrigger } from '../../services/notifications/notificationTriggerService.js'
import logger from '../../utils/logger.js'

const router = express.Router()

// Export trigger service for use by other modules
export { notificationTrigger }

/**
 * Middleware to extract user ID from request
 * In production, this would come from authentication middleware
 * For now, we accept it from headers or query params
 */
function getUserId(req) {
  // TODO: Replace with actual authentication middleware
  return req.headers['x-user-id'] || req.query.userId || 'default-user'
}

/**
 * GET /api/notifications
 * Get notifications for the current user
 */
router.get(
  '/',
  [
    queryValidator('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    queryValidator('offset').optional().isInt({ min: 0 }).toInt(),
    queryValidator('type').optional().isIn(['system', 'activity', 'security', 'billing', 'team', 'achievement']),
    queryValidator('priority').optional().isIn(['critical', 'high', 'medium', 'low']),
    queryValidator('read').optional().isBoolean().toBoolean(),
    queryValidator('orderBy').optional().isIn(['created_at', 'updated_at', 'priority']),
    queryValidator('orderDir').optional().isIn(['ASC', 'DESC']),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array(),
        })
      }

      const userId = getUserId(req)
      const options = {
        limit: req.query.limit,
        offset: req.query.offset,
        type: req.query.type,
        priority: req.query.priority,
        read: req.query.read,
        orderBy: req.query.orderBy,
        orderDir: req.query.orderDir,
      }

      const result = await notificationService.getNotifications(userId, options)

      res.json({
        success: true,
        data: result,
      })
    } catch (error) {
      logger.error({ error: error.message, stack: error.stack }, 'Error fetching notifications')
      res.status(500).json({
        success: false,
        error: 'Failed to fetch notifications',
      })
    }
  }
)

/**
 * GET /api/notifications/grouped
 * Get notifications grouped by date
 */
router.get('/grouped', async (req, res) => {
  try {
    const userId = getUserId(req)
    const read = req.query.read !== undefined ? req.query.read === 'true' : null

    const result = await notificationService.getGroupedNotifications(userId, { read })

    res.json({
      success: true,
      data: result,
    })
  } catch (error) {
    logger.error({ error: error.message, stack: error.stack }, 'Error fetching grouped notifications')
    res.status(500).json({
      success: false,
      error: 'Failed to fetch grouped notifications',
    })
  }
})

/**
 * GET /api/notifications/unread-count
 * Get unread notification count
 */
router.get('/unread-count', async (req, res) => {
  try {
    const userId = getUserId(req)
    const count = await notificationService.getUnreadCount(userId)

    res.json({
      success: true,
      data: { count },
    })
  } catch (error) {
    logger.error({ error: error.message, stack: error.stack }, 'Error fetching unread count')
    res.status(500).json({
      success: false,
      error: 'Failed to fetch unread count',
    })
  }
})

/**
 * GET /api/notifications/:id
 * Get a specific notification
 */
router.get(
  '/:id',
  [param('id').isUUID().withMessage('Invalid notification ID')],
  async (req, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array(),
        })
      }

      const userId = getUserId(req)
      const notification = await notificationService.getNotificationById(req.params.id, userId)

      if (!notification) {
        return res.status(404).json({
          success: false,
          error: 'Notification not found',
        })
      }

      res.json({
        success: true,
        data: notification,
      })
    } catch (error) {
      logger.error({ error: error.message, stack: error.stack }, 'Error fetching notification')
      res.status(500).json({
        success: false,
        error: 'Failed to fetch notification',
      })
    }
  }
)

/**
 * POST /api/notifications
 * Create a new notification
 */
router.post(
  '/',
  [
    body('userId').optional().isString(),
    body('type')
      .isIn(['system', 'activity', 'security', 'billing', 'team', 'achievement'])
      .withMessage('Invalid notification type'),
    body('title').notEmpty().withMessage('Title is required').isLength({ max: 255 }),
    body('message').optional().isString(),
    body('priority')
      .optional()
      .isIn(['critical', 'high', 'medium', 'low'])
      .withMessage('Invalid priority'),
    body('link').optional().isString().isLength({ max: 500 }),
    body('icon').optional().isString().isLength({ max: 100 }),
    body('iconColor').optional().isString().isLength({ max: 50 }),
    body('metadata').optional().isObject(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array(),
        })
      }

      const userId = req.body.userId || getUserId(req)
      const notificationData = {
        userId,
        type: req.body.type,
        title: req.body.title,
        message: req.body.message,
        priority: req.body.priority,
        link: req.body.link,
        icon: req.body.icon,
        iconColor: req.body.iconColor,
        metadata: req.body.metadata,
      }

      // Create notification and send via WebSocket using trigger service
      const notification = await notificationTrigger.createAndSend(notificationData)

      res.status(201).json({
        success: true,
        data: notification,
      })
    } catch (error) {
      logger.error({ error: error.message, stack: error.stack }, 'Error creating notification')
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to create notification',
      })
    }
  }
)

/**
 * PUT /api/notifications/:id/read
 * Mark notification as read
 */
router.put(
  '/:id/read',
  [param('id').isUUID().withMessage('Invalid notification ID')],
  async (req, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array(),
        })
      }

      const userId = getUserId(req)
      const notification = await notificationService.markAsRead(req.params.id, userId)

      // Send updated unread count via WebSocket
      const unreadCount = await notificationService.getUnreadCount(userId)
      notificationTrigger.sendUnreadCountUpdate(userId, unreadCount)

      res.json({
        success: true,
        data: notification,
      })
    } catch (error) {
      logger.error({ error: error.message, stack: error.stack }, 'Error marking notification as read')
      const statusCode = error.message === 'Notification not found' ? 404 : 500
      res.status(statusCode).json({
        success: false,
        error: error.message || 'Failed to mark notification as read',
      })
    }
  }
)

/**
 * PUT /api/notifications/:id/unread
 * Mark notification as unread
 */
router.put(
  '/:id/unread',
  [param('id').isUUID().withMessage('Invalid notification ID')],
  async (req, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array(),
        })
      }

      const userId = getUserId(req)
      const notification = await notificationService.markAsUnread(req.params.id, userId)

      // Send updated unread count via WebSocket
      const unreadCount = await notificationService.getUnreadCount(userId)
      notificationTrigger.sendUnreadCountUpdate(userId, unreadCount)

      res.json({
        success: true,
        data: notification,
      })
    } catch (error) {
      logger.error({ error: error.message, stack: error.stack }, 'Error marking notification as unread')
      const statusCode = error.message === 'Notification not found' ? 404 : 500
      res.status(statusCode).json({
        success: false,
        error: error.message || 'Failed to mark notification as unread',
      })
    }
  }
)

/**
 * PUT /api/notifications/mark-all-read
 * Mark all notifications as read
 */
router.put('/mark-all-read', async (req, res) => {
  try {
    const userId = getUserId(req)
    const count = await notificationService.markAllAsRead(userId)

    // Send updated unread count via WebSocket (should be 0)
    notificationTrigger.sendUnreadCountUpdate(userId, 0)

    res.json({
      success: true,
      data: { count },
    })
  } catch (error) {
    logger.error({ error: error.message, stack: error.stack }, 'Error marking all notifications as read')
    res.status(500).json({
      success: false,
      error: 'Failed to mark all notifications as read',
    })
  }
})

/**
 * DELETE /api/notifications/:id
 * Delete a notification
 */
router.delete(
  '/:id',
  [param('id').isUUID().withMessage('Invalid notification ID')],
  async (req, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array(),
        })
      }

      const userId = getUserId(req)
      await notificationService.deleteNotification(req.params.id, userId)

      res.json({
        success: true,
        message: 'Notification deleted successfully',
      })
    } catch (error) {
      logger.error({ error: error.message, stack: error.stack }, 'Error deleting notification')
      const statusCode = error.message === 'Notification not found' ? 404 : 500
      res.status(statusCode).json({
        success: false,
        error: error.message || 'Failed to delete notification',
      })
    }
  }
)

/**
 * DELETE /api/notifications
 * Clear all notifications
 */
router.delete('/', async (req, res) => {
  try {
    const userId = getUserId(req)
    const count = await notificationService.clearAllNotifications(userId)

    res.json({
      success: true,
      data: { count },
      message: 'All notifications cleared successfully',
    })
  } catch (error) {
    logger.error({ error: error.message, stack: error.stack }, 'Error clearing notifications')
    res.status(500).json({
      success: false,
      error: 'Failed to clear notifications',
    })
  }
})

/**
 * GET /api/notifications/preferences
 * Get notification preferences
 */
router.get('/preferences/current', async (req, res) => {
  try {
    const userId = getUserId(req)
    const preferences = await preferencesService.getPreferences(userId)

    res.json({
      success: true,
      data: preferences,
    })
  } catch (error) {
    logger.error({ error: error.message, stack: error.stack }, 'Error fetching preferences')
    res.status(500).json({
      success: false,
      error: 'Failed to fetch notification preferences',
    })
  }
})

/**
 * PUT /api/notifications/preferences
 * Update notification preferences
 */
router.put(
  '/preferences/current',
  [
    body('channels').optional().isObject(),
    body('email_settings').optional().isObject(),
    body('push_settings').optional().isObject(),
    body('do_not_disturb').optional().isObject(),
    body('metadata').optional().isObject(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array(),
        })
      }

      const userId = getUserId(req)
      const preferences = await preferencesService.updatePreferences(userId, req.body)

      res.json({
        success: true,
        data: preferences,
      })
    } catch (error) {
      logger.error({ error: error.message, stack: error.stack }, 'Error updating preferences')
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to update notification preferences',
      })
    }
  }
)

/**
 * POST /api/notifications/preferences/reset
 * Reset preferences to defaults
 */
router.post('/preferences/reset', async (req, res) => {
  try {
    const userId = getUserId(req)
    const preferences = await preferencesService.resetPreferences(userId)

    res.json({
      success: true,
      data: preferences,
      message: 'Preferences reset to defaults',
    })
  } catch (error) {
    logger.error({ error: error.message, stack: error.stack }, 'Error resetting preferences')
    res.status(500).json({
      success: false,
      error: 'Failed to reset preferences',
    })
  }
})

export default router
