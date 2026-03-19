// Auto Call Agent API Routes
// Issue #4286 - Automatic client calling agent

import express from 'express'
import { body, param, query, validationResult } from 'express-validator'
import multer from 'multer'
import path from 'path'
import fs from 'fs/promises'
import { fileURLToPath } from 'url'

const router = express.Router()
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Configure multer for file uploads
const upload = multer({
  dest: 'uploads/auto-call/',
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
})

// Data storage paths (using local files as per guidelines)
const DATA_DIR = path.join(__dirname, '../../../data/auto-call')
const CAMPAIGNS_FILE = path.join(DATA_DIR, 'campaigns.json')
const CALLS_FILE = path.join(DATA_DIR, 'calls.json')
const CONFIG_FILE = path.join(DATA_DIR, 'config.json')

// Ensure data directory exists
async function ensureDataDir() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true })
  } catch (error) {
    console.error('Error creating data directory:', error)
  }
}

// Load data from JSON file
async function loadData(filePath, defaultValue = []) {
  try {
    const data = await fs.readFile(filePath, 'utf8')
    return JSON.parse(data)
  } catch (error) {
    // File doesn't exist yet, return default
    return defaultValue
  }
}

// Save data to JSON file
async function saveData(filePath, data) {
  await ensureDataDir()
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8')
}

// Validation middleware
const validate = (req, res, next) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() })
  }
  next()
}

/**
 * GET /api/auto-call/campaigns
 * Get all calling campaigns
 */
router.get('/campaigns', async (req, res) => {
  try {
    const campaigns = await loadData(CAMPAIGNS_FILE, [])
    res.json({
      success: true,
      data: campaigns
    })
  } catch (error) {
    console.error('Error fetching campaigns:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch campaigns',
      message: error.message
    })
  }
})

/**
 * POST /api/auto-call/campaigns
 * Create a new calling campaign
 */
router.post('/campaigns', [
  body('name').notEmpty().isString(),
  body('description').optional().isString(),
  body('scheduledTime').optional().isISO8601()
], validate, async (req, res) => {
  try {
    const { name, description, scheduledTime } = req.body

    const campaigns = await loadData(CAMPAIGNS_FILE, [])

    const newCampaign = {
      id: `campaign_${Date.now()}`,
      name,
      description: description || '',
      status: 'Черновик',
      totalClients: 0,
      callsCompleted: 0,
      successRate: 0,
      scheduledTime: scheduledTime || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    campaigns.push(newCampaign)
    await saveData(CAMPAIGNS_FILE, campaigns)

    res.json({
      success: true,
      data: newCampaign
    })
  } catch (error) {
    console.error('Error creating campaign:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to create campaign',
      message: error.message
    })
  }
})

/**
 * PUT /api/auto-call/campaigns/:id
 * Update campaign
 */
router.put('/campaigns/:id', [
  param('id').notEmpty().isString(),
  body('name').optional().isString(),
  body('description').optional().isString(),
  body('status').optional().isString()
], validate, async (req, res) => {
  try {
    const { id } = req.params
    const updates = req.body

    const campaigns = await loadData(CAMPAIGNS_FILE, [])
    const index = campaigns.findIndex(c => c.id === id)

    if (index === -1) {
      return res.status(404).json({
        success: false,
        error: 'Campaign not found'
      })
    }

    campaigns[index] = {
      ...campaigns[index],
      ...updates,
      updatedAt: new Date().toISOString()
    }

    await saveData(CAMPAIGNS_FILE, campaigns)

    res.json({
      success: true,
      data: campaigns[index]
    })
  } catch (error) {
    console.error('Error updating campaign:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to update campaign',
      message: error.message
    })
  }
})

/**
 * DELETE /api/auto-call/campaigns/:id
 * Delete campaign
 */
router.delete('/campaigns/:id', [
  param('id').notEmpty().isString()
], validate, async (req, res) => {
  try {
    const { id } = req.params

    const campaigns = await loadData(CAMPAIGNS_FILE, [])
    const filtered = campaigns.filter(c => c.id !== id)

    await saveData(CAMPAIGNS_FILE, filtered)

    res.json({
      success: true,
      message: 'Campaign deleted successfully'
    })
  } catch (error) {
    console.error('Error deleting campaign:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to delete campaign',
      message: error.message
    })
  }
})

/**
 * POST /api/auto-call/campaigns/:id/start
 * Start/resume campaign
 */
router.post('/campaigns/:id/start', [
  param('id').notEmpty().isString()
], validate, async (req, res) => {
  try {
    const { id } = req.params

    const campaigns = await loadData(CAMPAIGNS_FILE, [])
    const index = campaigns.findIndex(c => c.id === id)

    if (index === -1) {
      return res.status(404).json({
        success: false,
        error: 'Campaign not found'
      })
    }

    campaigns[index].status = 'Активна'
    campaigns[index].updatedAt = new Date().toISOString()

    await saveData(CAMPAIGNS_FILE, campaigns)

    res.json({
      success: true,
      data: campaigns[index]
    })
  } catch (error) {
    console.error('Error starting campaign:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to start campaign',
      message: error.message
    })
  }
})

/**
 * POST /api/auto-call/campaigns/:id/pause
 * Pause campaign
 */
router.post('/campaigns/:id/pause', [
  param('id').notEmpty().isString()
], validate, async (req, res) => {
  try {
    const { id } = req.params

    const campaigns = await loadData(CAMPAIGNS_FILE, [])
    const index = campaigns.findIndex(c => c.id === id)

    if (index === -1) {
      return res.status(404).json({
        success: false,
        error: 'Campaign not found'
      })
    }

    campaigns[index].status = 'Приостановлена'
    campaigns[index].updatedAt = new Date().toISOString()

    await saveData(CAMPAIGNS_FILE, campaigns)

    res.json({
      success: true,
      data: campaigns[index]
    })
  } catch (error) {
    console.error('Error pausing campaign:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to pause campaign',
      message: error.message
    })
  }
})

/**
 * POST /api/auto-call/clients/upload
 * Upload client list (CSV/XLSX)
 */
router.post('/clients/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      })
    }

    // TODO: Parse CSV/XLSX file and extract client data
    // For now, return mock response
    const clients = []

    res.json({
      success: true,
      data: {
        filename: req.file.originalname,
        clientsCount: clients.length,
        clients
      }
    })
  } catch (error) {
    console.error('Error uploading client list:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to upload client list',
      message: error.message
    })
  }
})

/**
 * GET /api/auto-call/calls
 * Get call logs
 */
router.get('/calls', [
  query('campaignId').optional().isString(),
  query('status').optional().isString(),
  query('limit').optional().isInt({ min: 1, max: 1000 }),
  query('offset').optional().isInt({ min: 0 })
], validate, async (req, res) => {
  try {
    const { campaignId, status, limit = 100, offset = 0 } = req.query

    let calls = await loadData(CALLS_FILE, [])

    // Apply filters
    if (campaignId) {
      calls = calls.filter(c => c.campaignId === campaignId)
    }
    if (status) {
      calls = calls.filter(c => c.status === status)
    }

    // Pagination
    const total = calls.length
    const paginated = calls.slice(Number(offset), Number(offset) + Number(limit))

    res.json({
      success: true,
      data: {
        calls: paginated,
        total,
        limit: Number(limit),
        offset: Number(offset)
      }
    })
  } catch (error) {
    console.error('Error fetching call logs:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch call logs',
      message: error.message
    })
  }
})

/**
 * GET /api/auto-call/calls/:id
 * Get call details
 */
router.get('/calls/:id', [
  param('id').notEmpty().isString()
], validate, async (req, res) => {
  try {
    const { id } = req.params

    const calls = await loadData(CALLS_FILE, [])
    const call = calls.find(c => c.id === id)

    if (!call) {
      return res.status(404).json({
        success: false,
        error: 'Call not found'
      })
    }

    res.json({
      success: true,
      data: call
    })
  } catch (error) {
    console.error('Error fetching call details:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch call details',
      message: error.message
    })
  }
})

/**
 * POST /api/auto-call/test-call
 * Make a test call
 */
router.post('/test-call', [
  body('phoneNumber').notEmpty().isString(),
  body('config').optional().isObject()
], validate, async (req, res) => {
  try {
    const { phoneNumber, config = {} } = req.body

    // TODO: Implement actual call logic with AI/TTS/STT
    // For now, return mock response
    const testCall = {
      id: `call_test_${Date.now()}`,
      phoneNumber,
      status: 'Успешен',
      duration: 45,
      timestamp: new Date().toISOString(),
      transcript: [
        { role: 'ai', text: 'Тестовый звонок выполнен успешно.' }
      ]
    }

    res.json({
      success: true,
      data: testCall
    })
  } catch (error) {
    console.error('Error making test call:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to make test call',
      message: error.message
    })
  }
})

/**
 * GET /api/auto-call/config
 * Get AI configuration
 */
router.get('/config', async (req, res) => {
  try {
    const config = await loadData(CONFIG_FILE, {
      conversationScript: '',
      voice: 'ru-RU-Wavenet-A',
      speechRate: 1.0,
      maxCallDuration: 180,
      temperature: 0.7,
      callGoals: []
    })

    res.json({
      success: true,
      data: config
    })
  } catch (error) {
    console.error('Error fetching AI config:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch AI config',
      message: error.message
    })
  }
})

/**
 * POST /api/auto-call/config
 * Save AI configuration
 */
router.post('/config', [
  body('conversationScript').optional().isString(),
  body('voice').optional().isString(),
  body('speechRate').optional().isFloat({ min: 0.5, max: 2 }),
  body('maxCallDuration').optional().isInt({ min: 30, max: 600 }),
  body('temperature').optional().isFloat({ min: 0, max: 1 }),
  body('callGoals').optional().isArray()
], validate, async (req, res) => {
  try {
    const config = req.body

    await saveData(CONFIG_FILE, config)

    res.json({
      success: true,
      data: config
    })
  } catch (error) {
    console.error('Error saving AI config:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to save AI config',
      message: error.message
    })
  }
})

/**
 * GET /api/auto-call/stats
 * Get campaign statistics
 */
router.get('/stats', async (req, res) => {
  try {
    const calls = await loadData(CALLS_FILE, [])
    const campaigns = await loadData(CAMPAIGNS_FILE, [])

    const stats = {
      totalCalls: calls.length,
      successfulCalls: calls.filter(c => c.status === 'Успешен').length,
      failedCalls: calls.filter(c => c.status === 'Ошибка' || c.status === 'Не отвечает').length,
      pendingCalls: campaigns.reduce((sum, c) => sum + (c.totalClients - c.callsCompleted), 0)
    }

    res.json({
      success: true,
      data: stats
    })
  } catch (error) {
    console.error('Error fetching stats:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch stats',
      message: error.message
    })
  }
})

/**
 * GET /api/auto-call/analytics
 * Get analytics data
 */
router.get('/analytics', [
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601()
], validate, async (req, res) => {
  try {
    const calls = await loadData(CALLS_FILE, [])

    // TODO: Implement actual analytics with date filtering
    // For now, return mock data
    const analytics = {
      callStatusDistribution: {
        success: calls.filter(c => c.status === 'Успешен').length,
        failed: calls.filter(c => c.status === 'Ошибка').length,
        noAnswer: calls.filter(c => c.status === 'Не отвечает').length
      },
      callTrend: [],
      campaignPerformance: []
    }

    res.json({
      success: true,
      data: analytics
    })
  } catch (error) {
    console.error('Error fetching analytics:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch analytics',
      message: error.message
    })
  }
})

/**
 * POST /api/auto-call/tts
 * Text-to-Speech synthesis
 */
router.post('/tts', [
  body('text').notEmpty().isString(),
  body('voice').optional().isString(),
  body('speechRate').optional().isFloat({ min: 0.5, max: 2 })
], validate, async (req, res) => {
  try {
    const { text, voice = 'ru-RU-Wavenet-A', speechRate = 1.0 } = req.body

    // TODO: Integrate with TTS service (Google Cloud TTS, Azure TTS, etc.)
    // For now, return mock response
    res.json({
      success: true,
      message: 'TTS synthesis would be performed here',
      data: {
        text,
        voice,
        speechRate
      }
    })
  } catch (error) {
    console.error('Error synthesizing speech:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to synthesize speech',
      message: error.message
    })
  }
})

/**
 * POST /api/auto-call/stt
 * Speech-to-Text transcription
 */
router.post('/stt', upload.single('audio'), [
  body('language').optional().isString()
], validate, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No audio file uploaded'
      })
    }

    const { language = 'ru-RU' } = req.body

    // TODO: Integrate with STT service (Google Cloud STT, Azure STT, Whisper, etc.)
    // For now, return mock response
    res.json({
      success: true,
      message: 'STT transcription would be performed here',
      data: {
        transcript: 'Mock transcription text',
        language,
        confidence: 0.95
      }
    })
  } catch (error) {
    console.error('Error transcribing audio:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to transcribe audio',
      message: error.message
    })
  }
})

// Initialize data directory on module load
ensureDataDir().catch(console.error)

export default router
