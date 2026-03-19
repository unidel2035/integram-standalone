// vk-subscriber-bot.js - VK Subscriber Bot API routes
import express from 'express'
import { VKSubscriberBotAgent } from '../../agents/VKSubscriberBotAgent.js'
import logger from '../../utils/logger.js'
import { pool } from '../../config/database.js'

/**
 * Create VK Subscriber Bot routes
 * This endpoint allows the frontend to interact with the VK Subscriber Bot Agent
 */
export function createVKSubscriberBotRoutes() {
  const router = express.Router()

  // Get database pool
  const db = pool

  // Create a global VK subscriber bot agent instance
  const vkSubscriberBot = new VKSubscriberBotAgent({
    id: 'vk_subscriber_bot_main',
    metadata: { version: '1.0.0' },
    db
  })

  vkSubscriberBot.initialize()

  /**
   * POST /api/vk-subscriber-bot/collect-group
   * Collect subscribers from a single VK group
   *
   * Request body:
   * {
   *   group_id: number|string - VK group ID (e.g., "123456" or "-123456")
   *   access_token: string - VK access token
   *   max_subscribers?: number - Maximum subscribers to collect (default: 5000)
   * }
   *
   * Response:
   * {
   *   success: boolean
   *   groupInfo: {
   *     id: number
   *     name: string
   *     screen_name: string
   *     description: string
   *     members_count: number
   *     verified: boolean
   *   }
   *   subscribers: Array<User>
   *   collectedCount: number
   *   timestamp: string
   *   error?: string
   * }
   */
  router.post('/collect-group', async (req, res) => {
    try {
      const { group_id, access_token, max_subscribers = 5000 } = req.body

      if (!group_id) {
        return res.status(400).json({
          success: false,
          error: 'Group ID is required'
        })
      }

      if (!access_token) {
        return res.status(400).json({
          success: false,
          error: 'VK access token is required'
        })
      }

      logger.info({ groupId: group_id, maxSubscribers: max_subscribers }, 'Collecting group subscribers')

      const result = await vkSubscriberBot.processTask({
        operation: 'collect_group_subscribers',
        groupId: group_id,
        accessToken: access_token,
        maxSubscribers: max_subscribers
      })

      return res.json(result)
    } catch (error) {
      logger.error({ error: error.message, stack: error.stack }, 'Collect group subscribers failed')

      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to collect group subscribers'
      })
    }
  })

  /**
   * POST /api/vk-subscriber-bot/collect-multiple
   * Collect subscribers from multiple VK groups
   *
   * Request body:
   * {
   *   group_ids: Array<number|string> - VK group IDs
   *   access_token: string - VK access token
   *   max_per_group?: number - Maximum subscribers per group (default: 1000)
   * }
   *
   * Response:
   * {
   *   success: boolean
   *   results: Array<GroupCollectionResult>
   *   totalGroups: number
   *   successfulGroups: number
   *   totalSubscribers: number
   *   error?: string
   * }
   */
  router.post('/collect-multiple', async (req, res) => {
    try {
      const { group_ids, access_token, max_per_group = 1000 } = req.body

      if (!group_ids || !Array.isArray(group_ids) || group_ids.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Group IDs array is required'
        })
      }

      if (!access_token) {
        return res.status(400).json({
          success: false,
          error: 'VK access token is required'
        })
      }

      logger.info({ groupCount: group_ids.length, maxPerGroup: max_per_group }, 'Collecting from multiple groups')

      const result = await vkSubscriberBot.processTask({
        operation: 'collect_multiple_groups',
        groupIds: group_ids,
        accessToken: access_token,
        maxPerGroup: max_per_group
      })

      return res.json(result)
    } catch (error) {
      logger.error({ error: error.message, stack: error.stack }, 'Collect multiple groups failed')

      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to collect from multiple groups'
      })
    }
  })

  /**
   * POST /api/vk-subscriber-bot/find-groups
   * Search for VK groups and identify potential subscriber sources
   *
   * Request body:
   * {
   *   query: string - Search query
   *   access_token: string - VK access token
   *   max_groups?: number - Maximum groups to return (default: 10, max: 100)
   * }
   *
   * Response:
   * {
   *   success: boolean
   *   query: string
   *   totalFound: number
   *   groups: Array<{
   *     id: number
   *     name: string
   *     screen_name: string
   *     description: string
   *     members_count: number
   *     verified: boolean
   *     url: string
   *   }>
   *   error?: string
   * }
   */
  router.post('/find-groups', async (req, res) => {
    try {
      const { query, access_token, max_groups = 10 } = req.body

      if (!query) {
        return res.status(400).json({
          success: false,
          error: 'Search query is required'
        })
      }

      if (!access_token) {
        return res.status(400).json({
          success: false,
          error: 'VK access token is required'
        })
      }

      logger.info({ query, maxGroups: max_groups }, 'Finding groups for subscriber collection')

      const result = await vkSubscriberBot.processTask({
        operation: 'find_groups',
        query,
        accessToken: access_token,
        maxGroups: Math.min(max_groups, 100)
      })

      return res.json(result)
    } catch (error) {
      logger.error({ error: error.message, stack: error.stack }, 'Find groups failed')

      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to find groups'
      })
    }
  })

  /**
   * POST /api/vk-subscriber-bot/group-info
   * Get detailed information about a VK group
   *
   * Request body:
   * {
   *   group_id: number|string - VK group ID
   *   access_token: string - VK access token
   * }
   *
   * Response:
   * {
   *   success: boolean
   *   group: Object - Group information
   *   error?: string
   * }
   */
  router.post('/group-info', async (req, res) => {
    try {
      const { group_id, access_token } = req.body

      if (!group_id) {
        return res.status(400).json({
          success: false,
          error: 'Group ID is required'
        })
      }

      if (!access_token) {
        return res.status(400).json({
          success: false,
          error: 'VK access token is required'
        })
      }

      logger.info({ groupId: group_id }, 'Getting group info')

      const result = await vkSubscriberBot.processTask({
        operation: 'get_group_info',
        groupId: group_id,
        accessToken: access_token
      })

      return res.json(result)
    } catch (error) {
      logger.error({ error: error.message, stack: error.stack }, 'Get group info failed')

      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to get group info'
      })
    }
  })

  /**
   * POST /api/vk-subscriber-bot/search-groups
   * Search for VK groups by query
   *
   * Request body:
   * {
   *   query: string - Search query
   *   access_token: string - VK access token
   *   count?: number - Number of groups to return (default: 20, max: 1000)
   *   offset?: number - Offset for pagination (default: 0)
   * }
   *
   * Response:
   * {
   *   success: boolean
   *   count: number - Total count
   *   items: Array<Group>
   *   error?: string
   * }
   */
  router.post('/search-groups', async (req, res) => {
    try {
      const { query, access_token, count = 20, offset = 0 } = req.body

      if (!query) {
        return res.status(400).json({
          success: false,
          error: 'Search query is required'
        })
      }

      if (!access_token) {
        return res.status(400).json({
          success: false,
          error: 'VK access token is required'
        })
      }

      logger.info({ query, count, offset }, 'Searching VK groups')

      const result = await vkSubscriberBot.processTask({
        operation: 'search_groups',
        query,
        accessToken: access_token,
        count: Math.min(count, 1000),
        offset
      })

      return res.json(result)
    } catch (error) {
      logger.error({ error: error.message, stack: error.stack }, 'Search groups failed')

      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to search groups'
      })
    }
  })

  /**
   * POST /api/vk-subscriber-bot/test-connection
   * Test VK API connection with access token
   *
   * Request body:
   * {
   *   access_token: string - VK access token
   * }
   *
   * Response:
   * {
   *   success: boolean
   *   user?: {
   *     id: number
   *     first_name: string
   *     last_name: string
   *   }
   *   error?: string
   * }
   */
  router.post('/test-connection', async (req, res) => {
    try {
      const { access_token } = req.body

      if (!access_token) {
        return res.status(400).json({
          success: false,
          error: 'VK access token is required'
        })
      }

      logger.info('Testing VK API connection')

      // Test the token by getting current user info
      const axios = (await import('axios')).default
      const response = await axios.get('https://api.vk.com/method/users.get', {
        params: {
          access_token,
          v: '5.131'
        }
      })

      if (response.data.error) {
        throw new Error(`VK API Error: ${response.data.error.error_msg}`)
      }

      const user = response.data.response[0]

      logger.info({ userId: user.id }, 'VK API connection successful')

      return res.json({
        success: true,
        user: {
          id: user.id,
          first_name: user.first_name,
          last_name: user.last_name
        }
      })
    } catch (error) {
      logger.error({ error: error.message, stack: error.stack }, 'VK API connection test failed')

      return res.status(400).json({
        success: false,
        error: error.message || 'Failed to connect to VK API'
      })
    }
  })

  return router
}
