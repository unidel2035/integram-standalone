/**
 * Content Marketing Agent API Routes
 *
 * Provides RESTful API for Content Marketing Agent operations:
 * - Competitor channel management
 * - Telegram channel parsing
 * - Trending topic analysis
 * - Article generation and publishing
 * - Analytics and status monitoring
 *
 * Issue #4032: Implementing missing API endpoints for Content Marketing Agent
 */

import express from 'express'
import ContentMarketingService from '../../services/contentMarketing/ContentMarketingService.js'

const router = express.Router()
const contentMarketingService = new ContentMarketingService()

// Initialize service
contentMarketingService.init().catch(error => {
  console.error('[Content Marketing] Failed to initialize ContentMarketingService:', error)
})

/**
 * @route   GET /api/content-marketing/competitor-channels
 * @desc    Get list of competitor channels
 * @access  Public
 */
router.get('/competitor-channels', async (req, res) => {
  try {
    const channels = await contentMarketingService.getCompetitorChannels()

    res.json({
      success: true,
      channels
    })
  } catch (error) {
    console.error('[Content Marketing] Error getting competitor channels:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * @route   POST /api/content-marketing/competitor-channels
 * @desc    Add a new competitor channel
 * @access  Public
 */
router.post('/competitor-channels', async (req, res) => {
  try {
    const { name, username, category } = req.body

    if (!name || !username) {
      return res.status(400).json({
        success: false,
        error: 'Name and username are required'
      })
    }

    const channel = await contentMarketingService.addCompetitorChannel({
      name,
      username,
      category: category || 'Автоматизация'
    })

    res.json({
      success: true,
      channel
    })
  } catch (error) {
    console.error('[Content Marketing] Error adding competitor channel:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * @route   DELETE /api/content-marketing/competitor-channels/:channelId
 * @desc    Remove a competitor channel
 * @access  Public
 */
router.delete('/competitor-channels/:channelId', async (req, res) => {
  try {
    const { channelId } = req.params

    await contentMarketingService.removeCompetitorChannel(channelId)

    res.json({
      success: true,
      message: 'Channel removed successfully'
    })
  } catch (error) {
    console.error('[Content Marketing] Error removing competitor channel:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * @route   POST /api/content-marketing/parse-channel
 * @desc    Parse a single competitor channel
 * @access  Public
 */
router.post('/parse-channel', async (req, res) => {
  try {
    const { channelId, botToken } = req.body

    if (!channelId || !botToken) {
      return res.status(400).json({
        success: false,
        error: 'Channel ID and bot token are required'
      })
    }

    const result = await contentMarketingService.parseChannel(channelId, botToken)

    res.json({
      success: true,
      postsCount: result.postsCount,
      message: `Successfully parsed ${result.postsCount} posts`
    })
  } catch (error) {
    console.error('[Content Marketing] Error parsing channel:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * @route   POST /api/content-marketing/parse-all-channels
 * @desc    Parse all competitor channels
 * @access  Public
 */
router.post('/parse-all-channels', async (req, res) => {
  try {
    const { botToken } = req.body

    if (!botToken) {
      return res.status(400).json({
        success: false,
        error: 'Bot token is required'
      })
    }

    const result = await contentMarketingService.parseAllChannels(botToken)

    res.json({
      success: true,
      totalPosts: result.totalPosts,
      channelsProcessed: result.channelsProcessed,
      message: `Successfully parsed ${result.totalPosts} posts from ${result.channelsProcessed} channels`
    })
  } catch (error) {
    console.error('[Content Marketing] Error parsing all channels:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * @route   POST /api/content-marketing/analyze-trending-topics
 * @desc    Analyze trending topics from parsed data
 * @access  Public
 */
router.post('/analyze-trending-topics', async (req, res) => {
  try {
    const topics = await contentMarketingService.analyzeTrendingTopics()

    res.json({
      success: true,
      topics,
      message: `Found ${topics.length} trending topics`
    })
  } catch (error) {
    console.error('[Content Marketing] Error analyzing trending topics:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * @route   POST /api/content-marketing/generate-article
 * @desc    Generate article for a trending topic
 * @access  Public
 */
router.post('/generate-article', async (req, res) => {
  try {
    const { topicId, modelId } = req.body

    if (!topicId) {
      return res.status(400).json({
        success: false,
        error: 'Topic ID is required'
      })
    }

    const article = await contentMarketingService.generateArticle(topicId, modelId)

    res.json({
      success: true,
      article,
      message: `Article "${article.title}" generated successfully`
    })
  } catch (error) {
    console.error('[Content Marketing] Error generating article:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * @route   GET /api/content-marketing/articles
 * @desc    Get all articles
 * @access  Public
 */
router.get('/articles', async (req, res) => {
  try {
    const articles = await contentMarketingService.getArticles()

    res.json({
      success: true,
      articles
    })
  } catch (error) {
    console.error('[Content Marketing] Error getting articles:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * @route   POST /api/content-marketing/publish-article
 * @desc    Publish an article to Telegram channel
 * @access  Public
 */
router.post('/publish-article', async (req, res) => {
  try {
    const { articleId, targetChannel } = req.body

    if (!articleId || !targetChannel) {
      return res.status(400).json({
        success: false,
        error: 'Article ID and target channel are required'
      })
    }

    const result = await contentMarketingService.publishArticle(articleId, targetChannel)

    res.json({
      success: true,
      message: `Article published to ${targetChannel}`,
      result
    })
  } catch (error) {
    console.error('[Content Marketing] Error publishing article:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * @route   POST /api/content-marketing/publish-multiple-articles
 * @desc    Publish multiple articles to Telegram channel
 * @access  Public
 */
router.post('/publish-multiple-articles', async (req, res) => {
  try {
    const { articleIds, targetChannel } = req.body

    if (!articleIds || !Array.isArray(articleIds) || articleIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Article IDs array is required'
      })
    }

    if (!targetChannel) {
      return res.status(400).json({
        success: false,
        error: 'Target channel is required'
      })
    }

    const result = await contentMarketingService.publishMultipleArticles(articleIds, targetChannel)

    res.json({
      success: true,
      message: `Published ${result.publishedCount} articles to ${targetChannel}`,
      publishedCount: result.publishedCount,
      failedCount: result.failedCount
    })
  } catch (error) {
    console.error('[Content Marketing] Error publishing multiple articles:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * @route   GET /api/content-marketing/status
 * @desc    Get agent status
 * @access  Public
 */
router.get('/status', async (req, res) => {
  try {
    const status = await contentMarketingService.getStatus()

    res.json({
      success: true,
      status
    })
  } catch (error) {
    console.error('[Content Marketing] Error getting agent status:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * @route   GET /api/content-marketing/analytics
 * @desc    Get analytics data
 * @access  Public
 */
router.get('/analytics', async (req, res) => {
  try {
    const analytics = await contentMarketingService.getAnalytics()

    res.json({
      success: true,
      analytics
    })
  } catch (error) {
    console.error('[Content Marketing] Error getting analytics:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

export default router
