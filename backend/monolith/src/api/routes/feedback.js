/**
 * Quality and Feedback API Routes
 *
 * Provides RESTful API for feedback collection, sentiment analysis, and quality metrics:
 * - Feedback collection from multiple channels
 * - AI-powered sentiment analysis
 * - Survey management and distribution
 * - Quality metrics tracking
 * - Action item management
 * - Insights and analytics
 */

import express from 'express'
import path from 'path'
import fs from 'fs/promises'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const router = express.Router()

// Data storage paths
const DATA_DIR = path.join(__dirname, '../../../data/feedback')
const FEEDBACK_FILE = path.join(DATA_DIR, 'feedback.json')
const SURVEYS_FILE = path.join(DATA_DIR, 'surveys.json')
const ACTIONS_FILE = path.join(DATA_DIR, 'actions.json')
const METRICS_FILE = path.join(DATA_DIR, 'metrics.json')

// Ensure data directory exists
async function ensureDataDir() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true })
  } catch (error) {
    console.error('Error creating data directory:', error)
  }
}

// Initialize data files if they don't exist
async function initializeDataFiles() {
  await ensureDataDir()

  const files = [
    { path: FEEDBACK_FILE, default: [] },
    { path: SURVEYS_FILE, default: [] },
    { path: ACTIONS_FILE, default: [] },
    { path: METRICS_FILE, default: [] }
  ]

  for (const file of files) {
    try {
      await fs.access(file.path)
    } catch {
      await fs.writeFile(file.path, JSON.stringify(file.default, null, 2))
    }
  }
}

// Helper functions for reading/writing data
async function readData(filePath) {
  try {
    const data = await fs.readFile(filePath, 'utf-8')
    return JSON.parse(data)
  } catch (error) {
    console.error(`Error reading ${filePath}:`, error)
    return []
  }
}

async function writeData(filePath, data) {
  try {
    await fs.writeFile(filePath, JSON.stringify(data, null, 2))
  } catch (error) {
    console.error(`Error writing ${filePath}:`, error)
    throw error
  }
}

// Sentiment analysis helper (using simple rule-based approach for now)
function analyzeSentiment(text) {
  const positiveWords = ['great', 'excellent', 'good', 'amazing', 'wonderful', 'fantastic', 'love', 'helpful', 'best', 'awesome']
  const negativeWords = ['bad', 'terrible', 'poor', 'awful', 'horrible', 'worst', 'hate', 'disappointed', 'slow', 'broken']

  const lowerText = text.toLowerCase()
  let positiveCount = 0
  let negativeCount = 0

  positiveWords.forEach(word => {
    if (lowerText.includes(word)) positiveCount++
  })

  negativeWords.forEach(word => {
    if (lowerText.includes(word)) negativeCount++
  })

  const totalWords = lowerText.split(/\s+/).length
  const sentimentScore = (positiveCount - negativeCount) / Math.max(totalWords, 1)

  let sentiment
  let score

  if (sentimentScore > 0.05) {
    sentiment = 'positive'
    score = 0.6 + Math.min(sentimentScore * 10, 0.4)
  } else if (sentimentScore < -0.05) {
    sentiment = 'negative'
    score = 0.4 + Math.max(sentimentScore * 10, -0.4)
  } else {
    sentiment = 'neutral'
    score = 0.5
  }

  return { sentiment, score }
}

// Topic extraction helper (basic keyword extraction)
function extractTopics(text) {
  const commonTopics = {
    support: ['support', 'help', 'service', 'response', 'ticket'],
    product: ['product', 'feature', 'functionality', 'tool', 'app'],
    documentation: ['documentation', 'docs', 'guide', 'tutorial', 'manual'],
    performance: ['speed', 'slow', 'fast', 'performance', 'lag'],
    ui: ['ui', 'interface', 'design', 'layout', 'usability'],
    pricing: ['price', 'cost', 'expensive', 'cheap', 'pricing']
  }

  const lowerText = text.toLowerCase()
  const topics = []

  for (const [topic, keywords] of Object.entries(commonTopics)) {
    if (keywords.some(keyword => lowerText.includes(keyword))) {
      topics.push(topic)
    }
  }

  return topics.length > 0 ? topics : ['general']
}

// Initialize on startup
initializeDataFiles().catch(console.error)

/**
 * @route   POST /api/feedback/collect
 * @desc    Collect feedback from any channel
 * @access  Public
 */
router.post('/collect', async (req, res) => {
  try {
    const { source, text, email, customerId, metadata } = req.body

    if (!text) {
      return res.status(400).json({
        success: false,
        error: 'Feedback text is required'
      })
    }

    // Analyze sentiment
    const { sentiment, score } = analyzeSentiment(text)
    const topics = extractTopics(text)

    const feedback = {
      id: Date.now().toString(),
      source: source || 'web',
      text,
      email,
      customerId,
      sentiment,
      score,
      topics,
      metadata,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    const feedbackList = await readData(FEEDBACK_FILE)
    feedbackList.push(feedback)
    await writeData(FEEDBACK_FILE, feedbackList)

    // Auto-create action item for negative feedback
    if (sentiment === 'negative') {
      const actions = await readData(ACTIONS_FILE)
      actions.push({
        id: `action-${Date.now()}`,
        title: `Follow up on negative feedback`,
        description: text,
        feedbackId: feedback.id,
        status: 'open',
        priority: 'high',
        assignee: null,
        createdAt: new Date().toISOString()
      })
      await writeData(ACTIONS_FILE, actions)
    }

    res.json({
      success: true,
      data: feedback
    })
  } catch (error) {
    console.error('Error collecting feedback:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * @route   GET /api/feedback
 * @desc    Get feedback with filters
 * @access  Private
 */
router.get('/', async (req, res) => {
  try {
    const { sentiment, source, startDate, endDate, limit = 50 } = req.query

    let feedbackList = await readData(FEEDBACK_FILE)

    // Apply filters
    if (sentiment) {
      feedbackList = feedbackList.filter(f => f.sentiment === sentiment)
    }
    if (source) {
      feedbackList = feedbackList.filter(f => f.source === source)
    }
    if (startDate) {
      feedbackList = feedbackList.filter(f => new Date(f.createdAt) >= new Date(startDate))
    }
    if (endDate) {
      feedbackList = feedbackList.filter(f => new Date(f.createdAt) <= new Date(endDate))
    }

    // Sort by date (newest first) and limit
    feedbackList.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    feedbackList = feedbackList.slice(0, parseInt(limit))

    res.json({
      success: true,
      data: {
        feedback: feedbackList,
        total: feedbackList.length
      }
    })
  } catch (error) {
    console.error('Error getting feedback:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * @route   GET /api/feedback/:id
 * @desc    Get feedback by ID
 * @access  Private
 */
router.get('/:id', async (req, res) => {
  try {
    const feedbackList = await readData(FEEDBACK_FILE)
    const feedback = feedbackList.find(f => f.id === req.params.id)

    if (!feedback) {
      return res.status(404).json({
        success: false,
        error: 'Feedback not found'
      })
    }

    res.json({
      success: true,
      data: feedback
    })
  } catch (error) {
    console.error('Error getting feedback:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * @route   POST /api/feedback/analyze-sentiment
 * @desc    Analyze sentiment of text
 * @access  Public
 */
router.post('/analyze-sentiment', async (req, res) => {
  try {
    const { text } = req.body

    if (!text) {
      return res.status(400).json({
        success: false,
        error: 'Text is required'
      })
    }

    const analysis = analyzeSentiment(text)
    const topics = extractTopics(text)

    res.json({
      success: true,
      data: {
        ...analysis,
        topics
      }
    })
  } catch (error) {
    console.error('Error analyzing sentiment:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * @route   GET /api/feedback/sentiment-trends
 * @desc    Get sentiment trends over time
 * @access  Private
 */
router.get('/sentiment-trends', async (req, res) => {
  try {
    const { startDate, endDate } = req.query
    const feedbackList = await readData(FEEDBACK_FILE)

    let filtered = feedbackList
    if (startDate) {
      filtered = filtered.filter(f => new Date(f.createdAt) >= new Date(startDate))
    }
    if (endDate) {
      filtered = filtered.filter(f => new Date(f.createdAt) <= new Date(endDate))
    }

    // Group by week
    const weeklyData = {}
    filtered.forEach(feedback => {
      const date = new Date(feedback.createdAt)
      const weekStart = new Date(date)
      weekStart.setDate(date.getDate() - date.getDay())
      const weekKey = weekStart.toISOString().split('T')[0]

      if (!weeklyData[weekKey]) {
        weeklyData[weekKey] = { positive: 0, neutral: 0, negative: 0, total: 0 }
      }

      weeklyData[weekKey][feedback.sentiment]++
      weeklyData[weekKey].total++
    })

    const trend = Object.entries(weeklyData).map(([date, counts]) => ({
      date,
      positive: counts.positive,
      neutral: counts.neutral,
      negative: counts.negative,
      total: counts.total
    }))

    res.json({
      success: true,
      data: { trend }
    })
  } catch (error) {
    console.error('Error getting sentiment trends:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * @route   GET /api/feedback/dashboard
 * @desc    Get dashboard data with all metrics
 * @access  Private
 */
router.get('/dashboard', async (req, res) => {
  try {
    const { startDate, endDate } = req.query
    const feedbackList = await readData(FEEDBACK_FILE)
    const actions = await readData(ACTIONS_FILE)

    let filtered = feedbackList
    if (startDate) {
      filtered = filtered.filter(f => new Date(f.createdAt) >= new Date(startDate))
    }
    if (endDate) {
      filtered = filtered.filter(f => new Date(f.createdAt) <= new Date(endDate))
    }

    // Calculate sentiment distribution
    const sentimentDist = {
      positive: filtered.filter(f => f.sentiment === 'positive').length,
      neutral: filtered.filter(f => f.sentiment === 'neutral').length,
      negative: filtered.filter(f => f.sentiment === 'negative').length
    }

    // Calculate NPS (simplified - would need actual NPS survey data)
    const totalResponses = filtered.length
    const promoters = sentimentDist.positive
    const detractors = sentimentDist.negative
    const npsScore = totalResponses > 0
      ? Math.round(((promoters - detractors) / totalResponses) * 100)
      : 0

    // Calculate CSAT (simplified)
    const csatScore = totalResponses > 0
      ? Math.round((sentimentDist.positive / totalResponses) * 100)
      : 0

    // Get sentiment trend
    const weeklyData = {}
    filtered.forEach(feedback => {
      const date = new Date(feedback.createdAt)
      const weekStart = new Date(date)
      weekStart.setDate(date.getDate() - date.getDay())
      const weekKey = weekStart.toISOString().split('T')[0]

      if (!weeklyData[weekKey]) {
        weeklyData[weekKey] = { positive: 0, neutral: 0, negative: 0 }
      }

      weeklyData[weekKey][feedback.sentiment]++
    })

    const sentimentTrend = Object.entries(weeklyData).map(([date, counts]) => ({
      date,
      ...counts
    }))

    // Calculate quality metrics (simplified)
    const qualityScore = totalResponses > 0
      ? Math.round((sentimentDist.positive / totalResponses) * 100)
      : 0

    // Extract top issues
    const topicCounts = {}
    filtered.forEach(feedback => {
      if (feedback.sentiment === 'negative') {
        feedback.topics.forEach(topic => {
          topicCounts[topic] = (topicCounts[topic] || 0) + 1
        })
      }
    })

    const topIssues = Object.entries(topicCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([topic, count]) => ({
        topic,
        count,
        description: `Issues related to ${topic}`,
        impact: Math.min((count / filtered.length) * 200, 100)
      }))

    // Churn prediction (simplified)
    const churnRate = totalResponses > 0
      ? (sentimentDist.negative / totalResponses) * 20
      : 0

    // Generate recommendations
    const recommendations = []
    if (sentimentDist.negative > sentimentDist.positive * 0.3) {
      recommendations.push({
        text: 'High volume of negative feedback detected. Consider immediate intervention.',
        priority: 'high'
      })
    }
    if (topIssues.length > 0) {
      recommendations.push({
        text: `Focus on addressing "${topIssues[0].topic}" issues - most frequently mentioned`,
        priority: 'high'
      })
    }

    const dashboard = {
      overview: {
        totalFeedback: filtered.length,
        openActions: actions.filter(a => a.status === 'open').length
      },
      nps: {
        score: npsScore
      },
      csat: {
        score: csatScore
      },
      sentiment: {
        distribution: sentimentDist,
        trend: sentimentTrend
      },
      quality: {
        averageScore: qualityScore,
        trend: sentimentTrend.map(t => ({
          date: t.date,
          score: t.positive > 0 ? Math.round((t.positive / (t.positive + t.neutral + t.negative)) * 100) : 50
        })),
        metricsByType: [
          { type: 'Customer Satisfaction', average: csatScore, count: totalResponses, trend: 0 },
          { type: 'Response Quality', average: qualityScore, count: totalResponses, trend: 0 }
        ]
      },
      insights: {
        topIssues,
        churnRate,
        recommendations
      }
    }

    res.json({
      success: true,
      data: dashboard
    })
  } catch (error) {
    console.error('Error getting dashboard:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * @route   GET /api/feedback/action-items
 * @desc    Get action items
 * @access  Private
 */
router.get('/action-items', async (req, res) => {
  try {
    const { status } = req.query
    let actions = await readData(ACTIONS_FILE)

    if (status) {
      actions = actions.filter(a => a.status === status)
    }

    actions.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

    res.json({
      success: true,
      data: { actionItems: actions }
    })
  } catch (error) {
    console.error('Error getting action items:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * @route   POST /api/feedback/action-items
 * @desc    Create action item
 * @access  Private
 */
router.post('/action-items', async (req, res) => {
  try {
    const { title, description, feedbackId, priority = 'medium', assignee } = req.body

    if (!title) {
      return res.status(400).json({
        success: false,
        error: 'Title is required'
      })
    }

    const action = {
      id: `action-${Date.now()}`,
      title,
      description,
      feedbackId,
      priority,
      assignee,
      status: 'open',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    const actions = await readData(ACTIONS_FILE)
    actions.push(action)
    await writeData(ACTIONS_FILE, actions)

    res.json({
      success: true,
      data: action
    })
  } catch (error) {
    console.error('Error creating action item:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * @route   PATCH /api/feedback/action-items/:id
 * @desc    Update action item
 * @access  Private
 */
router.patch('/action-items/:id', async (req, res) => {
  try {
    const actions = await readData(ACTIONS_FILE)
    const index = actions.findIndex(a => a.id === req.params.id)

    if (index === -1) {
      return res.status(404).json({
        success: false,
        error: 'Action item not found'
      })
    }

    actions[index] = {
      ...actions[index],
      ...req.body,
      updatedAt: new Date().toISOString()
    }

    await writeData(ACTIONS_FILE, actions)

    res.json({
      success: true,
      data: actions[index]
    })
  } catch (error) {
    console.error('Error updating action item:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * @route   POST /api/feedback/action-items/:id/complete
 * @desc    Complete action item
 * @access  Private
 */
router.post('/action-items/:id/complete', async (req, res) => {
  try {
    const { resolution } = req.body
    const actions = await readData(ACTIONS_FILE)
    const index = actions.findIndex(a => a.id === req.params.id)

    if (index === -1) {
      return res.status(404).json({
        success: false,
        error: 'Action item not found'
      })
    }

    actions[index].status = 'completed'
    actions[index].resolution = resolution
    actions[index].completedAt = new Date().toISOString()
    actions[index].updatedAt = new Date().toISOString()

    await writeData(ACTIONS_FILE, actions)

    res.json({
      success: true,
      data: actions[index]
    })
  } catch (error) {
    console.error('Error completing action item:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * @route   GET /api/feedback/nps
 * @desc    Calculate NPS score
 * @access  Private
 */
router.get('/nps', async (req, res) => {
  try {
    const feedbackList = await readData(FEEDBACK_FILE)

    const promoters = feedbackList.filter(f => f.sentiment === 'positive').length
    const detractors = feedbackList.filter(f => f.sentiment === 'negative').length
    const total = feedbackList.length

    const npsScore = total > 0
      ? Math.round(((promoters - detractors) / total) * 100)
      : 0

    res.json({
      success: true,
      data: {
        score: npsScore,
        promoters,
        detractors,
        total
      }
    })
  } catch (error) {
    console.error('Error calculating NPS:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * @route   GET /api/feedback/csat
 * @desc    Calculate CSAT score
 * @access  Private
 */
router.get('/csat', async (req, res) => {
  try {
    const feedbackList = await readData(FEEDBACK_FILE)

    const satisfied = feedbackList.filter(f => f.sentiment === 'positive').length
    const total = feedbackList.length

    const csatScore = total > 0
      ? Math.round((satisfied / total) * 100)
      : 0

    res.json({
      success: true,
      data: {
        score: csatScore,
        satisfied,
        total
      }
    })
  } catch (error) {
    console.error('Error calculating CSAT:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * @route   GET /api/feedback/surveys
 * @desc    Get all surveys
 * @access  Private
 */
router.get('/surveys', async (req, res) => {
  try {
    const surveys = await readData(SURVEYS_FILE)

    res.json({
      success: true,
      data: { surveys }
    })
  } catch (error) {
    console.error('Error getting surveys:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * @route   POST /api/feedback/surveys
 * @desc    Create survey
 * @access  Private
 */
router.post('/surveys', async (req, res) => {
  try {
    const { name, description, type = 'custom', questions = [] } = req.body

    if (!name) {
      return res.status(400).json({
        success: false,
        error: 'Survey name is required'
      })
    }

    const survey = {
      id: `survey-${Date.now()}`,
      name,
      description,
      type,
      questions,
      status: 'draft',
      responseCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    const surveys = await readData(SURVEYS_FILE)
    surveys.push(survey)
    await writeData(SURVEYS_FILE, surveys)

    res.json({
      success: true,
      data: survey
    })
  } catch (error) {
    console.error('Error creating survey:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

export default router
