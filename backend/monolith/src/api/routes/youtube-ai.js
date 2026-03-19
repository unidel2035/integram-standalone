// YouTube AI API Routes
// Handles AI-powered features for YouTube Analytics module
// Issue #1518 - Fix sentiment analysis to use real YouTube comments and real AI
// Issue #1529 - Migrate to token-based orchestrator authentication
// Issue #1546 - Enable AI for all YouTube Analytics endpoints using DeepSeek by default

import express from 'express'
import { body, param, query, validationResult } from 'express-validator'
import { TokenBasedLLMCoordinator } from '../../core/TokenBasedLLMCoordinator.js'
// Database usage removed (Issue #1843) - Using in-memory configuration instead
// import { pool } from '../../config/database.js'

const router = express.Router()

// Initialize token-based LLM coordinator without database
// The coordinator should handle database connections internally if needed
const llmCoordinator = new TokenBasedLLMCoordinator({ db: null })

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
 * Get access token from request
 * Supports Bearer token in Authorization header or token query parameter
 */
function getAccessToken(req) {
  // Try Authorization header first
  const authHeader = req.headers.authorization
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7)
  }

  // Fallback to query parameter (for backward compatibility)
  if (req.query.token) {
    return req.query.token
  }

  // Try to get from body (for POST requests)
  if (req.body && req.body.accessToken) {
    return req.body.accessToken
  }

  return null
}

/**
 * Get default model ID for DeepSeek
 * Database usage removed (Issue #1843)
 * Returns the model name directly - coordinator will handle model resolution
 */
async function getDefaultModelId(modelName = 'deepseek-chat') {
  // Simply return the model name - the TokenBasedLLMCoordinator
  // will handle model resolution internally
  return modelName
}

/**
 * Call AI service using token-based coordinator
 */
async function callAIService(accessToken, systemPrompt, userPrompt, options = {}) {
  const {
    model = 'deepseek-chat',
    temperature = 0.3,
    maxTokens = 4096,
    application = 'YouTubeAnalytics',
    operation = 'analysis',
    responseFormat = { type: 'json_object' }
  } = options

  // console.log('Token-based AI Service Call:', {
  //   model,
  //   application,
  //   operation,
  //   systemPromptLength: systemPrompt.length,
  //   userPromptLength: userPrompt.length
  // })

  try {
    // Get model UUID if model is specified as string
    let modelId = model
    if (typeof model === 'string' && !model.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
      modelId = await getDefaultModelId(model)
    }

    // Prepare messages
    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ]

    // Call coordinator with token
    const result = await llmCoordinator.chatWithToken(
      accessToken,
      modelId,
      messages,
      {
        application,
        operation,
        temperature,
        maxTokens,
        response_format: responseFormat
      }
    )

    // console.log('AI Response received via coordinator, usage:', result.usage)

    // Parse JSON response
    let parsedResponse
    try {
      parsedResponse = JSON.parse(result.content)
    } catch (parseError) {
      console.error('Failed to parse AI response as JSON:', parseError.message)
      console.error('Raw response:', result.content.substring(0, 500))
      throw new Error('AI returned invalid JSON response')
    }

    return {
      aiAnalysis: parsedResponse,
      usage: result.usage
    }

  } catch (error) {
    console.error('Token-based AI service error:', error.message)
    throw error
  }
}

/**
 * GET /api/ai/youtube/sentiment
 * Returns error message for GET requests (POST required)
 */
router.get('/sentiment', (req, res) => {
  res.status(405).json({
    success: false,
    error: 'Method Not Allowed',
    detail: 'This endpoint only accepts POST requests. Please send a POST request with comments data in the request body.',
    required_method: 'POST',
    required_body: {
      comments: ['array of comment objects or strings'],
      model: 'optional - AI model name (default: deepseek-chat)'
    },
    example: {
      comments: [
        { author: 'User1', text: 'Great video!' },
        { author: 'User2', text: 'Very informative' }
      ],
      model: 'deepseek-chat'
    }
  })
})

/**
 * POST /api/ai/youtube/sentiment
 * Analyze comment sentiment for YouTube videos
 */
router.post('/sentiment', [
  body('comments').isArray().withMessage('Comments must be an array'),
  body('comments').notEmpty().withMessage('Comments array cannot be empty'),
  body('model').optional().isString()
], validate, async (req, res) => {
  try {
    const { comments, model = 'deepseek-chat' } = req.body

    // Get access token from request
    const accessToken = getAccessToken(req)
    if (!accessToken) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        detail: 'No access token provided. Include token in Authorization header as "Bearer <token>"'
      })
    }

    // console.log('Analyzing sentiment for comments:', {
    //   count: comments.length,
    //   model,
    //   hasToken: !!accessToken
    // })

    // Build improved prompts for better JSON structure
    const systemPrompt = `You are an expert in sentiment analysis for social media comments.
Your task is to analyze YouTube video comments and determine the overall audience sentiment.

Analyze:
- Overall distribution of positive, neutral, and negative comments
- Key themes and topics mentioned in comments
- Emotional tone of feedback
- Constructive criticism patterns

You MUST respond ONLY with valid JSON in the following exact structure:
{
  "overall_sentiment": {
    "positive": <number between 0 and 1>,
    "neutral": <number between 0 and 1>,
    "negative": <number between 0 and 1>
  },
  "sentiment_distribution": [
    {"label": "Positive", "value": <percentage 0-100>, "color": "#10B981"},
    {"label": "Neutral", "value": <percentage 0-100>, "color": "#6B7280"},
    {"label": "Negative", "value": <percentage 0-100>, "color": "#EF4444"}
  ],
  "key_topics": [
    {"topic": "<topic name>", "sentiment": "positive|neutral|negative", "mentions": <count>}
  ],
  "sample_comments": {
    "positive": ["<sample>", "<sample>"],
    "negative": ["<sample>", "<sample>"],
    "neutral": ["<sample>", "<sample>"]
  },
  "summary": "<brief summary of overall sentiment in Russian>"
}`

    const userPrompt = `Analyze the sentiment of the following YouTube video comments:

${comments.map((c, i) => `${i + 1}. Author: ${c.author || 'Unknown'} - Comment: ${c.text || c}`).join('\n')}

Total comments: ${comments.length}

Provide detailed sentiment analysis in the JSON format specified.`

    // Call AI service with token-based authentication
    const aiResult = await callAIService(accessToken, systemPrompt, userPrompt, {
      model,
      application: 'YouTubeAnalytics',
      operation: 'sentiment_analysis'
    })

    // Add metadata
    const response = {
      version: '1.0',
      generated_at: new Date().toISOString(),
      model_used: model,
      total_comments_analyzed: comments.length,
      ...aiResult.aiAnalysis,
      usage: aiResult.usage
    }

    res.status(200).json({
      success: true,
      data: response,
      message: 'Sentiment analysis completed successfully'
    })
  } catch (error) {
    console.error('Error analyzing sentiment:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to analyze sentiment',
      detail: error.message
    })
  }
})

/**
 * GET /api/ai/youtube/trends
 * Returns error message for GET requests (POST required)
 */
router.get('/trends', (req, res) => {
  res.status(405).json({
    success: false,
    error: 'Method Not Allowed',
    detail: 'This endpoint only accepts POST requests. Please send a POST request with channel data in the request body.',
    required_method: 'POST',
    required_body: {
      channel_data: 'object - YouTube channel statistics and metrics',
      model: 'optional - AI model name (default: deepseek-chat)'
    }
  })
})

/**
 * POST /api/ai/youtube/trends
 * Predict trends based on YouTube channel data
 */
router.post('/trends', [
  body('channel_data').isObject().withMessage('Channel data must be an object'),
  body('model').optional().isString()
], validate, async (req, res) => {
  try {
    const { channel_data, model = 'deepseek-chat' } = req.body

    // Get access token from request
    const accessToken = getAccessToken(req)
    if (!accessToken) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        detail: 'No access token provided. Include token in Authorization header as "Bearer <token>"'
      })
    }

    // console.log('Predicting trends for channel data:', { model, hasToken: !!accessToken })

    // Build prompts for AI-powered trend prediction
    const systemPrompt = `You are an expert YouTube analytics consultant specializing in growth trends and predictions.
Your task is to analyze channel performance data and predict future trends.

Analyze:
- Growth patterns in subscribers, views, and engagement
- Content performance trends
- Optimal publishing strategies
- Emerging topics and opportunities

You MUST respond ONLY with valid JSON in the following exact structure:
{
  "predictions": {
    "growth_forecast": {
      "next_30_days": "<percentage or absolute number>",
      "next_90_days": "<percentage or absolute number>",
      "confidence": <number between 0 and 1>
    },
    "trending_topics": [
      {"topic": "<topic name>", "potential": "high|medium|low"}
    ],
    "recommended_actions": [
      "<actionable recommendation>"
    ]
  }
}`

    const userPrompt = `Analyze this YouTube channel data and predict trends:

Channel Stats:
- Channel: ${channel_data.channel_title || 'Unknown'}
- Subscribers: ${channel_data.subscriber_count || 0}
- Total Videos: ${channel_data.total_videos || 0}
- Total Views: ${channel_data.total_views || 0}
- Avg Views per Video: ${channel_data.avg_views_per_video || 0}
- Engagement Rate: ${channel_data.avg_engagement_rate || 0}%

${channel_data.recent_videos ? `Recent Videos Performance:
${JSON.stringify(channel_data.recent_videos.slice(0, 5), null, 2)}` : ''}

Provide trend predictions and growth forecast in the JSON format specified. Use Russian language for text fields.`

    // Call AI service with token-based authentication
    const aiResult = await callAIService(accessToken, systemPrompt, userPrompt, {
      model,
      application: 'YouTubeAnalytics',
      operation: 'trend_prediction'
    })

    // Add metadata
    const response = {
      version: '1.0',
      generated_at: new Date().toISOString(),
      model_used: model,
      ...aiResult.aiAnalysis,
      usage: aiResult.usage
    }

    res.status(200).json({
      success: true,
      data: response,
      message: 'Trend predictions generated successfully'
    })
  } catch (error) {
    console.error('Error predicting trends:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to predict trends',
      detail: error.message
    })
  }
})

/**
 * GET /api/ai/youtube/recommendations
 * Returns error message for GET requests (POST required)
 */
router.get('/recommendations', (req, res) => {
  res.status(405).json({
    success: false,
    error: 'Method Not Allowed',
    detail: 'This endpoint only accepts POST requests. Please send a POST request with analytics data in the request body.',
    required_method: 'POST',
    required_body: {
      analytics: 'object - YouTube channel analytics',
      model: 'optional - AI model name (default: deepseek-chat)',
      focus_areas: 'optional - array of focus areas (default: ["topics", "timing", "format"])'
    }
  })
})

/**
 * POST /api/ai/youtube/recommendations
 * Generate content recommendations for YouTube channel
 */
router.post('/recommendations', [
  body('analytics').isObject().withMessage('Analytics must be an object'),
  body('model').optional().isString(),
  body('focus_areas').optional().isArray()
], validate, async (req, res) => {
  try {
    const { analytics, model = 'deepseek-chat', focus_areas = ['topics', 'timing', 'format'] } = req.body

    // Get access token from request
    const accessToken = getAccessToken(req)
    if (!accessToken) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        detail: 'No access token provided. Include token in Authorization header as "Bearer <token>"'
      })
    }

    // console.log('Generating content recommendations:', { model, focus_areas, hasToken: !!accessToken })

    // Build prompts for AI-powered content recommendations
    const systemPrompt = `You are an expert YouTube content strategy consultant.
Your task is to analyze channel analytics and generate personalized content recommendations.

Focus areas: ${focus_areas.join(', ')}

Analyze and provide recommendations for:
- Content topics that will resonate with the audience
- Optimal publishing timing (days, hours, frequency)
- Video format recommendations (length, style, thumbnails)

You MUST respond ONLY with valid JSON in the following exact structure:
{
  "recommendations": {
    "topics": [
      {"title": "<topic title>", "reason": "<why this topic>"}
    ],
    "timing": {
      "best_days": ["<day>"],
      "best_hours": ["<time range>"],
      "frequency": "<publishing frequency>"
    },
    "format": {
      "optimal_length": "<duration>",
      "recommended_style": "<content style>",
      "thumbnail_tips": "<thumbnail advice>"
    }
  }
}`

    const userPrompt = `Analyze this YouTube channel analytics and generate content recommendations:

Channel Analytics:
${JSON.stringify(analytics, null, 2)}

Focus Areas: ${focus_areas.join(', ')}

Provide personalized recommendations in the JSON format specified. Use Russian language for all text fields.`

    // Call AI service with token-based authentication
    const aiResult = await callAIService(accessToken, systemPrompt, userPrompt, {
      model,
      application: 'YouTubeAnalytics',
      operation: 'content_recommendations'
    })

    // Add metadata
    const response = {
      version: '1.0',
      generated_at: new Date().toISOString(),
      model_used: model,
      focus_areas,
      ...aiResult.aiAnalysis,
      usage: aiResult.usage
    }

    res.status(200).json({
      success: true,
      data: response,
      message: 'Content recommendations generated successfully'
    })
  } catch (error) {
    console.error('Error generating recommendations:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to generate recommendations',
      detail: error.message
    })
  }
})

/**
 * GET /api/ai/youtube/competitors
 * Returns error message for GET requests (POST required)
 */
router.get('/competitors', (req, res) => {
  res.status(405).json({
    success: false,
    error: 'Method Not Allowed',
    detail: 'This endpoint only accepts POST requests. Please send a POST request with competitor and own channel data in the request body.',
    required_method: 'POST',
    required_body: {
      competitors: 'array - competitor channel data',
      own_channel: 'object - your channel data',
      model: 'optional - AI model name (default: deepseek-chat)'
    }
  })
})

/**
 * POST /api/ai/youtube/competitors
 * Generate competitor analysis summary
 */
router.post('/competitors', [
  body('competitors').isArray().withMessage('Competitors must be an array'),
  body('own_channel').isObject().withMessage('Own channel data must be an object'),
  body('model').optional().isString()
], validate, async (req, res) => {
  try {
    const { competitors, own_channel, model = 'deepseek-chat' } = req.body

    // Get access token from request
    const accessToken = getAccessToken(req)
    if (!accessToken) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        detail: 'No access token provided. Include token in Authorization header as "Bearer <token>"'
      })
    }

    // console.log('Analyzing competitors:', { count: competitors.length, model, hasToken: !!accessToken })

    // Build prompts for AI-powered competitor analysis
    const systemPrompt = `You are an expert in competitive YouTube channel analysis.
Your task is to analyze competitor channels and provide strategic insights for improving competitive position.

Analyze:
- Competitor strengths and strategies
- Own channel's competitive advantages and weaknesses
- Market opportunities and threats
- Actionable strategies for growth

You MUST respond ONLY with valid JSON in the following exact structure:
{
  "analysis": {
    "competitive_position": "leading|strong|middle|weak",
    "strengths": ["<strength 1>", "<strength 2>"],
    "weaknesses": ["<weakness 1>", "<weakness 2>"],
    "opportunities": ["<opportunity 1>", "<opportunity 2>"],
    "competitor_insights": [
      {
        "name": "<competitor name>",
        "key_strength": "<what they do well>",
        "lessons_learned": "<what to learn from them>"
      }
    ]
  }
}`

    const userPrompt = `Perform competitive analysis for this YouTube channel:

Own Channel:
${JSON.stringify(own_channel, null, 2)}

Competitors:
${competitors.map((c, i) => `
Competitor ${i + 1}:
${JSON.stringify(c, null, 2)}
`).join('\n')}

Total Competitors: ${competitors.length}

Provide detailed competitive analysis in the JSON format specified. Use Russian language for all text fields.`

    // Call AI service with token-based authentication
    const aiResult = await callAIService(accessToken, systemPrompt, userPrompt, {
      model,
      application: 'YouTubeAnalytics',
      operation: 'competitor_analysis'
    })

    // Add metadata
    const response = {
      version: '1.0',
      generated_at: new Date().toISOString(),
      model_used: model,
      competitors_analyzed: competitors.length,
      ...aiResult.aiAnalysis,
      usage: aiResult.usage
    }

    res.status(200).json({
      success: true,
      data: response,
      message: 'Competitor analysis completed successfully'
    })
  } catch (error) {
    console.error('Error analyzing competitors:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to analyze competitors',
      detail: error.message
    })
  }
})

export default router
