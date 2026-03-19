// vk-parser.js - VK Post Parser API routes
import express from 'express'
import { VKParserAgent } from '../../agents/VKParserAgent.js'
import logger from '../../utils/logger.js'
import { pool } from '../../config/database.js'
import { TokenBasedLLMCoordinator } from '../../core/TokenBasedLLMCoordinator.js'

/**
 * Create VK parser routes
 * This endpoint allows the frontend to interact with the VK Parser Agent
 */
export function createVKParserRoutes() {
  const router = express.Router()

  // Get database pool
  const db = pool

  // Create LLM coordinator for AI analysis
  const llmCoordinator = new TokenBasedLLMCoordinator({ db })

  // Create a global VK parser agent instance
  const vkParserAgent = new VKParserAgent({
    id: 'vk_parser_agent_main',
    metadata: { version: '1.0.0' },
    llmCoordinator,
    db
  })

  vkParserAgent.initialize()

  /**
   * POST /api/vk-parser/search-groups
   * Search for VK groups by topic
   *
   * Request body:
   * {
   *   query: string - Search query/topic
   *   access_token: string - VK access token
   *   count?: number - Number of groups to return (default: 20, max: 200)
   *   offset?: number - Offset for pagination (default: 0)
   * }
   *
   * Response:
   * {
   *   success: boolean
   *   query: string
   *   count: number - Total count of groups
   *   groups: Array<{
   *     id: number
   *     name: string
   *     screen_name: string
   *     type: string
   *     description: string
   *     members_count: number
   *     url: string
   *     photo: string
   *   }>
   *   error?: string
   * }
   */
  router.post('/search-groups', async (req, res) => {
    try {
      const { query, access_token, count = 20, offset = 0 } = req.body

      if (!query) {
        return res.status(400).json({
          success: false,
          error: 'Query is required'
        })
      }

      if (!access_token) {
        return res.status(400).json({
          success: false,
          error: 'VK access token is required'
        })
      }

      logger.info({ query, count, offset }, 'Searching VK groups')

      const result = await vkParserAgent.processTask({
        operation: 'search_groups',
        query,
        accessToken: access_token,
        count,
        offset
      })

      return res.json(result)
    } catch (error) {
      logger.error({ error: error.message, stack: error.stack }, 'VK groups search failed')

      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to search VK groups'
      })
    }
  })

  /**
   * POST /api/vk-parser/search-posts
   * Search for VK posts globally by topic
   *
   * Request body:
   * {
   *   query: string - Search query/topic
   *   access_token: string - VK access token
   *   count?: number - Number of posts to return (default: 50, max: 100)
   *   offset?: number - Offset for pagination (default: 0)
   * }
   *
   * Response:
   * {
   *   success: boolean
   *   query: string
   *   count: number - Total count of posts
   *   posts: Array<Post>
   *   groups: Array<Group>
   *   profiles: Array<Profile>
   *   error?: string
   * }
   */
  router.post('/search-posts', async (req, res) => {
    try {
      const { query, access_token, count = 50, offset = 0 } = req.body

      if (!query) {
        return res.status(400).json({
          success: false,
          error: 'Query is required'
        })
      }

      if (!access_token) {
        return res.status(400).json({
          success: false,
          error: 'VK access token is required'
        })
      }

      logger.info({ query, count, offset }, 'Searching VK posts')

      const result = await vkParserAgent.processTask({
        operation: 'search_posts',
        query,
        accessToken: access_token,
        count,
        offset
      })

      return res.json(result)
    } catch (error) {
      logger.error({ error: error.message, stack: error.stack }, 'VK posts search failed')

      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to search VK posts'
      })
    }
  })

  /**
   * POST /api/vk-parser/group-posts
   * Get posts from a specific VK group
   *
   * Request body:
   * {
   *   group_id: number - VK group ID
   *   access_token: string - VK access token
   *   query?: string - Search query within group
   *   count?: number - Number of posts to return (default: 50, max: 100)
   *   offset?: number - Offset for pagination (default: 0)
   * }
   *
   * Response:
   * {
   *   success: boolean
   *   groupId: number
   *   query?: string
   *   count: number - Total count of posts
   *   posts: Array<Post>
   *   groups: Array<Group>
   *   profiles: Array<Profile>
   *   error?: string
   * }
   */
  router.post('/group-posts', async (req, res) => {
    try {
      const { group_id, access_token, query = '', count = 50, offset = 0 } = req.body

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

      logger.info({ groupId: group_id, query, count, offset }, 'Getting VK group posts')

      const result = await vkParserAgent.processTask({
        operation: 'get_group_posts',
        groupId: group_id,
        accessToken: access_token,
        query,
        count,
        offset
      })

      return res.json(result)
    } catch (error) {
      logger.error({ error: error.message, stack: error.stack }, 'Get VK group posts failed')

      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to get VK group posts'
      })
    }
  })

  /**
   * POST /api/vk-parser/analyze-posts
   * Analyze posts using AI for relevance and quality
   *
   * Request body:
   * {
   *   posts: Array<Post> - Posts to analyze
   *   topic: string - Topic for relevance analysis
   *   access_token: string - DronDoc AI access token
   *   user_id: string - User ID for AI usage tracking
   * }
   *
   * Response:
   * {
   *   success: boolean
   *   topic: string
   *   posts: Array<Post with aiAnalysis>
   *   error?: string
   * }
   */
  router.post('/analyze-posts', async (req, res) => {
    try {
      const { posts, topic, access_token, user_id } = req.body

      if (!posts || !Array.isArray(posts) || posts.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Posts array is required'
        })
      }

      if (!topic) {
        return res.status(400).json({
          success: false,
          error: 'Topic is required'
        })
      }

      if (!access_token) {
        return res.status(400).json({
          success: false,
          error: 'DronDoc AI access token is required'
        })
      }

      if (!user_id) {
        return res.status(400).json({
          success: false,
          error: 'User ID is required'
        })
      }

      logger.info({ postsCount: posts.length, topic }, 'Analyzing VK posts with AI')

      const result = await vkParserAgent.processTask({
        operation: 'analyze_posts',
        posts,
        topic,
        accessToken: access_token,
        userId: user_id
      })

      return res.json(result)
    } catch (error) {
      logger.error({ error: error.message, stack: error.stack }, 'VK posts analysis failed')

      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to analyze VK posts'
      })
    }
  })

  /**
   * POST /api/vk-parser/rank-posts
   * Rank posts by various criteria
   *
   * Request body:
   * {
   *   posts: Array<Post> - Posts to rank
   *   sort_by?: string - Sorting method (engagement|ai_score|likes|comments|reposts|date|combined)
   * }
   *
   * Response:
   * {
   *   success: boolean
   *   sortBy: string
   *   posts: Array<Post with rank>
   *   error?: string
   * }
   */
  router.post('/rank-posts', async (req, res) => {
    try {
      const { posts, sort_by = 'engagement' } = req.body

      if (!posts || !Array.isArray(posts) || posts.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Posts array is required'
        })
      }

      logger.info({ postsCount: posts.length, sortBy: sort_by }, 'Ranking VK posts')

      const result = await vkParserAgent.processTask({
        operation: 'rank_posts',
        posts,
        sortBy: sort_by
      })

      return res.json(result)
    } catch (error) {
      logger.error({ error: error.message, stack: error.stack }, 'VK posts ranking failed')

      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to rank VK posts'
      })
    }
  })

  /**
   * POST /api/vk-parser/full-search
   * Execute full VK search workflow
   *
   * Request body:
   * {
   *   topic: string - Search topic
   *   vk_access_token: string - VK access token
   *   ai_access_token?: string - DronDoc AI access token (for AI analysis)
   *   user_id?: string - User ID (for AI usage tracking)
   *   include_groups?: boolean - Include groups search (default: true)
   *   include_ai?: boolean - Include AI analysis (default: true)
   *   limit?: number - Max posts to search (default: 50, max: 100)
   * }
   *
   * Response:
   * {
   *   success: boolean
   *   topic: string
   *   steps: Array<StepResult>
   *   topGroups: Array<Group>
   *   topPosts: Array<Post>
   *   error?: string
   * }
   */
  router.post('/full-search', async (req, res) => {
    try {
      const {
        topic,
        vk_access_token,
        ai_access_token,
        user_id,
        include_groups = true,
        include_ai = true,
        limit = 50
      } = req.body

      if (!topic) {
        return res.status(400).json({
          success: false,
          error: 'Topic is required'
        })
      }

      if (!vk_access_token) {
        return res.status(400).json({
          success: false,
          error: 'VK access token is required'
        })
      }

      if (include_ai && (!ai_access_token || !user_id)) {
        return res.status(400).json({
          success: false,
          error: 'AI access token and user ID are required for AI analysis'
        })
      }

      logger.info({ topic, includeGroups: include_groups, includeAI: include_ai }, 'Starting full VK search')

      const result = await vkParserAgent.processTask({
        operation: 'full_search',
        topic,
        accessToken: include_ai ? ai_access_token : vk_access_token,
        userId: user_id,
        includeGroups: include_groups,
        includeAI: include_ai,
        limit
      })

      // The full_search operation needs VK access token separately
      // Let's add it to the task context
      if (!include_ai) {
        // If AI is not included, we only need VK token
        result.vkAccessToken = vk_access_token
      }

      return res.json(result)
    } catch (error) {
      logger.error({ error: error.message, stack: error.stack }, 'Full VK search failed')

      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to execute full VK search'
      })
    }
  })

  /**
   * POST /api/vk-parser/test-connection
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
