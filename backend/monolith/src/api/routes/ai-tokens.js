// AI Token Management API Routes
// Handles token generation, validation, and model configuration
// Issue #1121 - Token-based AI model selection system
// Issue #4873 - AI usage statistics logging to Integram

console.log('[AI-TOKENS] Loading ai-tokens.js routes module...')

import express from 'express'
import crypto from 'crypto'
import { body, param, query, validationResult } from 'express-validator'
import { pool } from '../../config/database.js'
import polzaService from '../../services/ai/polzaService.js'
import tokenConsumptionLogger from '../../services/ai/tokenConsumptionLogger.js'
import defaultTokenService from '../../services/ai/defaultTokenService.js'

const router = express.Router()

console.log('[AI-TOKENS] ai-tokens.js routes module loaded successfully')

// DronDoc API configuration
const DRONEDOC_API_BASE_URL = process.env.DRONEDOC_API_BASE_URL || 'https://dronedoc.ru'
const DRONEDOC_AUTH_TOKEN = process.env.DRONEDOC_AUTH_TOKEN || ''
const INTEGRAM_SYSTEM_USERNAME = process.env.INTEGRAM_SYSTEM_USERNAME || 'd'
const INTEGRAM_SYSTEM_PASSWORD = process.env.INTEGRAM_SYSTEM_PASSWORD || 'd'

// Cache for Integram auth tokens (to avoid re-authenticating on every request)
let integramTokenCache = {
  'my': null,
  'a2025': null,
  'ddadmin': null
}

/**
 * Authenticate with Integram API and get access token
 * @param {string} database - Database name (my, a2025, ddadmin)
 * @returns {Promise<string|null>} Integram auth token or null
 */
async function authenticateIntegram(database = 'my') {
  // Check cache first
  if (integramTokenCache[database]) {
    return integramTokenCache[database]
  }

  try {
    const authUrl = `${DRONEDOC_API_BASE_URL}/${database}/auth?JSON_KV`
    const formData = new URLSearchParams()
    formData.append('login', INTEGRAM_SYSTEM_USERNAME)
    formData.append('pwd', INTEGRAM_SYSTEM_PASSWORD)

    const response = await fetch(authUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData
    })

    if (!response.ok) {
      console.warn(`[Integram Auth] Failed to authenticate with ${database}:`, response.status)
      return null
    }

    const data = await response.json()
    if (data.failed || !data.token) {
      console.warn(`[Integram Auth] Authentication failed for ${database}`)
      return null
    }

    // Cache the token
    integramTokenCache[database] = data.token
    console.log(`[Integram Auth] Successfully authenticated with ${database}`)

    return data.token
  } catch (error) {
    console.error(`[Integram Auth] Error authenticating with ${database}:`, error.message)
    return null
  }
}

/**
 * Get DronDoc API token from unified token storage or environment variable
 * Similar pattern to GitHub token retrieval in error-reports.js
 * @returns {Promise<string|null>} DronDoc API token or null if not found
 */
async function getDronDocToken() {
  // Check environment variable first (simpler for development)
  if (DRONEDOC_AUTH_TOKEN) {
    // console.log('[DronDoc Auth] Using token from environment variable')
    return DRONEDOC_AUTH_TOKEN
  }

  // Try to authenticate with Integram system credentials
  const integramToken = await authenticateIntegram('my')
  if (integramToken) {
    return integramToken
  }

  // Otherwise try to get from unified token storage
  try {
    const result = await pool.query(`
      SELECT
        k.api_key_encrypted,
        p.name as provider_name
      FROM ai_provider_api_keys k
      JOIN ai_model_providers p ON k.provider_id = p.id
      WHERE p.name = 'dronedoc'
        AND k.is_active = true
        AND k.is_default = true
      LIMIT 1
    `)

    if (result.rows.length === 0) {
      console.warn('[DronDoc Auth] Token not found in unified storage or environment variable')
      return null
    }

    // Decrypt the key (currently using base64, but should use proper encryption in production)
    const encryptedKey = result.rows[0].api_key_encrypted
    const decryptedKey = Buffer.from(encryptedKey, 'base64').toString('utf-8')

    // console.log('[DronDoc Auth] Using token from unified token storage')
    return decryptedKey
  } catch (error) {
    console.error('[DronDoc Auth] Failed to retrieve token from unified storage:', error.message)
    return null
  }
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
 * Generate a secure token
 */
function generateToken() {
  const randomBytes = crypto.randomBytes(32)
  const token = `dd_tok_${randomBytes.toString('base64url')}`
  const hash = crypto.createHash('sha256').update(token).digest('hex')
  const prefix = token.substring(0, 15) // 'dd_tok_' + first 8 chars
  return { token, hash, prefix }
}

/**
 * Hash a token for comparison
 */
function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex')
}

/**
 * Fetch models from DronDoc API and transform to our format
 * Issue #1540 - Use DronDoc API instead of database
 * Issue #1560 - Use X-Authorization header from frontend (localStorage.ddadmin_token)
 * @param {string} userToken - Token from frontend request (X-Authorization header)
 */
async function fetchModelsFromDronDoc(userToken = null) {
  try {
    const url = `${DRONEDOC_API_BASE_URL}/ddadmin/object/305?JSON_KV=true`
    const headers = {}

    // Prefer user token from frontend, fall back to server-side token
    const authToken = userToken || await getDronDocToken()

    if (authToken) {
      headers['X-Authorization'] = authToken
      if (userToken) {
        // console.log('[DronDoc Auth] Using X-Authorization token from frontend request (localStorage.ddadmin_token)', {
        //   tokenPrefix: authToken.substring(0, 10) + '...',
        //   tokenLength: authToken.length
        // })
      } else {
        // console.log('[DronDoc Auth] Using server-side token from environment or database')
      }
    } else {
      console.warn('[DronDoc Auth] No authentication token available - API request may fail')
    }

    // console.log('[DronDoc API] Making request to:', url, {
    //   headers: { 'X-Authorization': authToken ? authToken.substring(0, 10) + '...' : 'none' }
    // })

    const response = await fetch(url, { headers })

    if (!response.ok) {
      throw new Error(`DronDoc API returned ${response.status}: ${response.statusText}`)
    }

    const data = await response.json()

    // Transform DronDoc response to our model format
    const models = []

    if (!data.object || !data.reqs) {
      console.warn('DronDoc API response missing object or reqs fields')
      return models
    }

    // Iterate through each model in the object array
    for (const modelObj of data.object) {
      const modelId = modelObj.id
      const modelName = modelObj.val
      const modelReqs = data.reqs[modelId]

      if (!modelReqs) {
        console.warn(`No requirements found for model ${modelId}`)
        continue
      }

      // Extract provider info
      const providerName = modelReqs['308'] || 'Unknown'

      // Extract other properties
      const contextWindow = modelReqs['311'] || 'N/A'
      const costInput = parseFloat(modelReqs['313']) || 0
      const costOutput = parseFloat(modelReqs['315']) || 0
      const intelligence = modelReqs['318'] || ''
      const speed = modelReqs['321'] || ''
      const visibility = modelReqs['1765'] === 'X' ? true : false

      // Transform to our API format
      models.push({
        id: modelId,
        model_id: modelName,
        display_name: modelName,
        provider_name: providerName,
        provider_display_name: providerName,
        context_window: contextWindow,
        cost_per_1k_input: costInput.toFixed(2),
        cost_per_1k_output: costOutput.toFixed(2),
        intelligence_level: intelligence,
        speed_level: speed,
        is_visible: visibility,
        is_active: true,
        description: `${intelligence} intelligence, ${speed} speed`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
    }

    return models
  } catch (error) {
    console.error('Error fetching models from DronDoc API:', error)
    throw error
  }
}

/**
 * GET /api/ai-tokens/health
 * Health check endpoint for AI token system
 * Issue #4521 - Smart search needs to check if AI is available
 */
router.get('/health', async (req, res) => {
  try {
    // Simple health check - return success if endpoint is reachable
    res.json({
      success: true,
      status: 'healthy',
      timestamp: new Date().toISOString(),
      message: 'AI token system is operational'
    })
  } catch (error) {
    console.error('Health check error:', error)
    res.status(500).json({
      success: false,
      status: 'unhealthy',
      error: error.message
    })
  }
})

/**
 * GET /api/ai-tokens/providers
 * Get all active AI providers
 * Issue #2659 - Handle mocked database gracefully
 */
router.get('/providers', async (req, res) => {
  try {
    const db = pool

    // Check if database is available (not mocked)
    if (!db) {
      // Return fallback providers
      return res.json({
        success: true,
        data: [
          {
            id: 'deepseek_default',
            name: 'deepseek',
            display_name: 'DeepSeek',
            description: 'DeepSeek AI Provider',
            base_url: 'https://api.deepseek.com',
            authentication_type: 'api_key',
            configuration: {},
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }
        ],
        usingFallback: true
      })
    }

    const result = await db.query(`
      SELECT
        id,
        name,
        display_name,
        description,
        base_url,
        authentication_type,
        configuration,
        created_at,
        updated_at
      FROM ai_model_providers
      WHERE is_active = true
      ORDER BY display_name
    `)

    // Check if database returned empty results (mocked)
    if (result.rows.length === 0) {
      // Return fallback providers
      return res.json({
        success: true,
        data: [
          {
            id: 'deepseek_default',
            name: 'deepseek',
            display_name: 'DeepSeek',
            description: 'DeepSeek AI Provider',
            base_url: 'https://api.deepseek.com',
            authentication_type: 'api_key',
            configuration: {},
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }
        ],
        usingFallback: true
      })
    }

    res.json({
      success: true,
      data: result.rows
    })
  } catch (error) {
    console.error('Error fetching providers:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch providers',
      message: error.message
    })
  }
})

/**
 * GET /api/ai-tokens/models
 * Get all active AI models (optionally filtered by provider)
 * Issue #1540 - Now fetches from DronDoc API instead of database
 * Issue #1560 - Uses X-Authorization header from frontend (localStorage.ddadmin_token)
 */
router.get('/models', [
  query('provider').optional().isString()
], validate, async (req, res) => {
  try {
    const { provider } = req.query

    // Extract user token from X-Authorization header
    const userToken = req.headers['x-authorization']

    // Debug logging for issue #1560
    // console.log('[GET /models] Request headers:', {
    //   hasXAuthorization: !!userToken,
    //   tokenPrefix: userToken ? userToken.substring(0, 10) + '...' : 'none',
    //   allHeaders: Object.keys(req.headers).join(', ')
    // })

    // Fetch models from DronDoc API using user token
    let models = await fetchModelsFromDronDoc(userToken)

    // Если модели пустые, добавляем модель по умолчанию
    if (!models || models.length === 0) {
      console.log('Модели не найдены в DronDoc API, добавляем модель по умолчанию')
      models = [
        {
          id: 'anthropic/claude-sonnet-4.5',
          model_id: 'anthropic/claude-sonnet-4.5',
          display_name: 'Claude Sonnet 4.5',
          provider_name: 'anthropic',
          provider_display_name: 'Anthropic',
          context_window: '200000',
          cost_per_1k_input: '0.00',
          cost_per_1k_output: '0.00',
          intelligence_level: 'High',
          speed_level: 'Medium',
          is_visible: true,
          is_active: true,
          description: 'Claude Sonnet 4.5 - модель по умолчанию',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ]
    }

    // Filter by provider if specified
    if (provider) {
      models = models.filter(model =>
        model.provider_name.toLowerCase() === provider.toLowerCase()
      )
    }

    // Sort by provider and display name
    models.sort((a, b) => {
      const providerCompare = a.provider_name.localeCompare(b.provider_name)
      if (providerCompare !== 0) return providerCompare
      return a.display_name.localeCompare(b.display_name)
    })

    res.json({
      success: true,
      data: models
    })
  } catch (error) {
    console.error('Error fetching models:', error)
    
    // Fallback: возвращаем модель по умолчанию при ошибке
    const fallbackModels = [
      {
        id: 'anthropic/claude-sonnet-4.5',
        model_id: 'anthropic/claude-sonnet-4.5',
        display_name: 'Claude Sonnet 4.5',
        provider_name: 'anthropic',
        provider_display_name: 'Anthropic',
        context_window: '200000',
        cost_per_1k_input: '0.00',
        cost_per_1k_output: '0.00',
        intelligence_level: 'High',
        speed_level: 'Medium',
        is_visible: true,
        is_active: true,
        description: 'Claude Sonnet 4.5 - высокоинтеллектуальная модель',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    ]

    res.status(200).json({
      success: true,
      data: fallbackModels,
      message: 'Используется модель по умолчанию из-за ошибки получения списка моделей'
    })
  }
})

/**
 * POST /api/ai-tokens/tokens
 * Create a new AI access token
 * Issue #1232 - Token is now provided by the client instead of being generated on the server
 */
router.post('/tokens', [
  body('name').isString().trim().isLength({ min: 1, max: 255 }),
  body('userId').isString().trim().notEmpty(),
  body('token').isString().trim().notEmpty().isLength({ min: 20 }),
  body('scopes').optional().isArray(),
  body('allowedModels').optional().isArray(),
  body('allowedApplications').optional().isArray(),
  body('rateLimitRpm').optional().isInt({ min: 1, max: 10000 }),
  body('rateLimitTpm').optional().isInt({ min: 1000, max: 10000000 }),
  body('tokenBalance').optional().isInt({ min: 0 }),
  body('dailyLimit').optional().isInt({ min: 0 }),
  body('monthlyLimit').optional().isInt({ min: 0 }),
  body('expiresAt').optional().isISO8601()
], validate, async (req, res) => {
  try {
    const db = pool
    const {
      name,
      userId,
      token,
      scopes = ['model:read', 'model:use'],
      allowedModels = ['*'],
      allowedApplications = ['*'],
      rateLimitRpm = 60,
      rateLimitTpm = 100000,
      tokenBalance = 100000,
      dailyLimit = 50000,
      monthlyLimit = 1000000,
      expiresAt = null
    } = req.body

    // Hash the client-provided token and extract prefix
    const hash = hashToken(token)
    const prefix = token.substring(0, 15) // 'dd_tok_' + first 8 chars

    // Check if token already exists
    const existingToken = await db.query(`
      SELECT id FROM ai_access_tokens WHERE token_hash = $1
    `, [hash])

    if (existingToken.rows.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Token already exists. Please generate a new token.'
      })
    }

    const result = await db.query(`
      INSERT INTO ai_access_tokens (
        token_hash,
        token_prefix,
        user_id,
        name,
        scopes,
        allowed_models,
        allowed_applications,
        rate_limit_rpm,
        rate_limit_tpm,
        token_balance,
        daily_limit,
        monthly_limit,
        expires_at,
        created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING id, token_prefix, name, user_id, scopes, allowed_models,
                allowed_applications, rate_limit_rpm, rate_limit_tpm,
                token_balance, daily_limit, monthly_limit, expires_at,
                is_active, created_at
    `, [
      hash,
      prefix,
      userId,
      name,
      JSON.stringify(scopes),
      JSON.stringify(allowedModels),
      JSON.stringify(allowedApplications),
      rateLimitRpm,
      rateLimitTpm,
      tokenBalance,
      dailyLimit,
      monthlyLimit,
      expiresAt,
      userId
    ])

    // Record initial balance transaction
    await db.query(`
      INSERT INTO ai_token_transactions (
        access_token_id,
        transaction_type,
        amount,
        balance_before,
        balance_after,
        description,
        created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [
      result.rows[0].id,
      'purchase',
      tokenBalance,
      0,
      tokenBalance,
      'Initial token balance',
      userId
    ])

    res.status(201).json({
      success: true,
      data: {
        ...result.rows[0],
        token // Return the actual token ONLY on creation
      },
      message: 'Token created successfully. Store this token securely - it will not be shown again.'
    })
  } catch (error) {
    console.error('Error creating token:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to create token',
      message: error.message
    })
  }
})

/**
 * GET /api/ai-tokens/tokens
 * List user's tokens (without the actual token values)
 * Issue #2756 - Handle database errors gracefully with fallback empty array
 */
router.get('/tokens', [
  query('userId').isString().trim().notEmpty()
], validate, async (req, res) => {
  try {
    const db = pool
    const { userId } = req.query

    // Check if database is available (not mocked)
    if (!db) {
      console.warn('[GET /tokens] Database not available, returning empty array')
      return res.json({
        success: true,
        data: [],
        usingFallback: true,
        message: 'Database not available - returning empty token list'
      })
    }

    // Wrap query in try-catch to handle database errors gracefully
    let result
    try {
      result = await db.query(`
        SELECT
          id,
          token_prefix,
          name,
          user_id,
          scopes,
          allowed_models,
          allowed_applications,
          rate_limit_rpm,
          rate_limit_tpm,
          token_balance,
          daily_limit,
          monthly_limit,
          expires_at,
          last_used_at,
          is_active,
          created_at,
          updated_at
        FROM ai_access_tokens
        WHERE user_id = $1
        ORDER BY created_at DESC
      `, [userId])
    } catch (queryError) {
      // Database query failed (table doesn't exist, connection issue, etc.)
      console.warn('[GET /tokens] Database query failed, returning empty array:', queryError.message)
      return res.json({
        success: true,
        data: [],
        usingFallback: true,
        message: 'Database query failed - returning empty token list'
      })
    }

    res.json({
      success: true,
      data: result.rows || []
    })
  } catch (error) {
    // Final catch-all - return empty array instead of 500 error
    console.error('[GET /tokens] Unexpected error, returning empty array:', error.message)
    res.json({
      success: true,
      data: [],
      usingFallback: true,
      message: 'Error fetching tokens - returning empty list'
    })
  }
})

/**
 * GET /api/ai-tokens/tokens/:id
 * Get a specific token's details
 */
router.get('/tokens/:id', [
  param('id').isUUID()
], validate, async (req, res) => {
  try {
    const db = pool
    const { id } = req.params

    const result = await db.query(`
      SELECT
        id,
        token_prefix,
        name,
        user_id,
        scopes,
        allowed_models,
        allowed_applications,
        rate_limit_rpm,
        rate_limit_tpm,
        token_balance,
        daily_limit,
        monthly_limit,
        expires_at,
        last_used_at,
        is_active,
        metadata,
        created_at,
        updated_at
      FROM ai_access_tokens
      WHERE id = $1
    `, [id])

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Token not found'
      })
    }

    res.json({
      success: true,
      data: result.rows[0]
    })
  } catch (error) {
    console.error('Error fetching token:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch token',
      message: error.message
    })
  }
})

/**
 * POST /api/ai-tokens/tokens/validate
 * Validate a token and return permissions
 */
router.post('/tokens/validate', [
  body('token').isString().trim().notEmpty()
], validate, async (req, res) => {
  try {
    const db = pool
    const { token } = req.body

    const hash = hashToken(token)

    const result = await db.query(`
      SELECT
        id,
        user_id,
        name,
        scopes,
        allowed_models,
        allowed_applications,
        rate_limit_rpm,
        rate_limit_tpm,
        token_balance,
        daily_limit,
        monthly_limit,
        expires_at,
        is_active
      FROM ai_access_tokens
      WHERE token_hash = $1
    `, [hash])

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'Invalid token'
      })
    }

    const tokenData = result.rows[0]

    // Check if token is active
    if (!tokenData.is_active) {
      return res.status(401).json({
        success: false,
        error: 'Token is inactive'
      })
    }

    // Check if token is expired
    if (tokenData.expires_at && new Date(tokenData.expires_at) < new Date()) {
      return res.status(401).json({
        success: false,
        error: 'Token has expired'
      })
    }

    // Check token balance
    if (tokenData.token_balance <= 0) {
      return res.status(429).json({
        success: false,
        error: 'Insufficient token balance'
      })
    }

    // Update last_used_at
    await db.query(`
      UPDATE ai_access_tokens
      SET last_used_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `, [tokenData.id])

    res.json({
      success: true,
      data: {
        tokenId: tokenData.id,
        userId: tokenData.user_id,
        name: tokenData.name,
        scopes: tokenData.scopes,
        allowedModels: tokenData.allowed_models,
        allowedApplications: tokenData.allowed_applications,
        rateLimitRpm: tokenData.rate_limit_rpm,
        rateLimitTpm: tokenData.rate_limit_tpm,
        tokenBalance: tokenData.token_balance,
        dailyLimit: tokenData.daily_limit,
        monthlyLimit: tokenData.monthly_limit
      }
    })
  } catch (error) {
    console.error('Error validating token:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to validate token',
      message: error.message
    })
  }
})

/**
 * PUT /api/ai-tokens/tokens/:id
 * Update a token's settings
 */
router.put('/tokens/:id', [
  param('id').isUUID(),
  body('name').optional().isString().trim().isLength({ min: 1, max: 255 }),
  body('scopes').optional().isArray(),
  body('allowedModels').optional().isArray(),
  body('allowedApplications').optional().isArray(),
  body('dailyLimit').optional().isInt({ min: 0 }),
  body('monthlyLimit').optional().isInt({ min: 0 }),
  body('isActive').optional().isBoolean()
], validate, async (req, res) => {
  try {
    const db = pool
    const { id } = req.params
    const updates = req.body

    const setClauses = []
    const values = []
    let paramIndex = 1

    Object.entries(updates).forEach(([key, value]) => {
      const snakeKey = key.replace(/([A-Z])/g, '_$1').toLowerCase()
      if (snakeKey === 'scopes' || snakeKey === 'allowed_models' || snakeKey === 'allowed_applications') {
        setClauses.push(`${snakeKey} = $${paramIndex}`)
        values.push(JSON.stringify(value))
      } else {
        setClauses.push(`${snakeKey} = $${paramIndex}`)
        values.push(value)
      }
      paramIndex++
    })

    if (setClauses.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid updates provided'
      })
    }

    values.push(id)

    const result = await db.query(`
      UPDATE ai_access_tokens
      SET ${setClauses.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING id, token_prefix, name, user_id, scopes, allowed_models,
                allowed_applications, rate_limit_rpm, rate_limit_tpm,
                token_balance, daily_limit, monthly_limit, is_active, updated_at
    `, values)

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Token not found'
      })
    }

    res.json({
      success: true,
      data: result.rows[0],
      message: 'Token updated successfully'
    })
  } catch (error) {
    console.error('Error updating token:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to update token',
      message: error.message
    })
  }
})

/**
 * DELETE /api/ai-tokens/tokens/:id
 * Deactivate (soft delete) a token
 */
router.delete('/tokens/:id', [
  param('id').isUUID()
], validate, async (req, res) => {
  try {
    const db = pool
    const { id } = req.params

    const result = await db.query(`
      UPDATE ai_access_tokens
      SET is_active = false
      WHERE id = $1
      RETURNING id, token_prefix, name
    `, [id])

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Token not found'
      })
    }

    res.json({
      success: true,
      data: result.rows[0],
      message: 'Token deactivated successfully'
    })
  } catch (error) {
    console.error('Error deactivating token:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to deactivate token',
      message: error.message
    })
  }
})

/**
 * GET /api/ai-tokens/usage
 * Get token usage statistics
 * Issue #2756 - Handle database errors gracefully with fallback empty array
 */
router.get('/usage', [
  query('tokenId').optional().isUUID(),
  query('userId').optional().isString(),
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601()
], validate, async (req, res) => {
  try {
    const db = pool
    const { tokenId, userId, startDate, endDate } = req.query

    // Check if database is available (not mocked)
    if (!db) {
      console.warn('[GET /usage] Database not available, returning empty array')
      return res.json({
        success: true,
        data: [],
        usingFallback: true,
        message: 'Database not available - returning empty usage list'
      })
    }

    let query = `
      SELECT * FROM v_token_usage_summary
      WHERE 1=1
    `
    const params = []
    let paramIndex = 1

    if (userId) {
      query += ` AND user_id = $${paramIndex}`
      params.push(userId)
      paramIndex++
    }

    // Wrap query in try-catch to handle database errors gracefully
    let result
    try {
      result = await db.query(query, params)
    } catch (queryError) {
      console.warn('[GET /usage] Database query failed, returning empty array:', queryError.message)
      return res.json({
        success: true,
        data: [],
        usingFallback: true,
        message: 'Database query failed - returning empty usage list'
      })
    }

    res.json({
      success: true,
      data: result.rows || []
    })
  } catch (error) {
    // Final catch-all - return empty array instead of 500 error
    console.error('[GET /usage] Unexpected error, returning empty array:', error.message)
    res.json({
      success: true,
      data: [],
      usingFallback: true,
      message: 'Error fetching usage - returning empty list'
    })
  }
})

/**
 * POST /api/ai-tokens/usage/record
 * Record token usage (called by LLMCoordinator after API calls)
 */
router.post('/usage/record', [
  body('tokenId').isUUID(),
  body('modelId').isUUID(),
  body('application').isString().trim().notEmpty(),
  body('operation').isString().trim().notEmpty(),
  body('promptTokens').isInt({ min: 0 }),
  body('completionTokens').isInt({ min: 0 }),
  body('requestId').optional().isString(),
  body('status').optional().isIn(['completed', 'failed', 'rate_limited']),
  body('errorMessage').optional().isString(),
  body('metadata').optional().isObject()
], validate, async (req, res) => {
  try {
    const db = pool
    const {
      tokenId,
      modelId,
      application,
      operation,
      promptTokens,
      completionTokens,
      requestId = crypto.randomUUID(),
      status = 'completed',
      errorMessage = null,
      metadata = {}
    } = req.body

    const totalTokens = promptTokens + completionTokens

    // Get model pricing
    const modelResult = await db.query(`
      SELECT cost_per_1k_input, cost_per_1k_output
      FROM ai_models
      WHERE id = $1
    `, [modelId])

    if (modelResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Model not found'
      })
    }

    const model = modelResult.rows[0]
    const costInput = (promptTokens / 1000) * parseFloat(model.cost_per_1k_input)
    const costOutput = (completionTokens / 1000) * parseFloat(model.cost_per_1k_output)
    const totalCost = costInput + costOutput

    // Record usage
    const usageResult = await db.query(`
      INSERT INTO ai_token_usage (
        access_token_id,
        model_id,
        application,
        operation,
        prompt_tokens,
        completion_tokens,
        total_tokens,
        cost_input,
        cost_output,
        total_cost,
        request_id,
        status,
        error_message,
        metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING id, created_at
    `, [
      tokenId,
      modelId,
      application,
      operation,
      promptTokens,
      completionTokens,
      totalTokens,
      costInput,
      costOutput,
      totalCost,
      requestId,
      status,
      errorMessage,
      JSON.stringify(metadata)
    ])

    // Deduct tokens from balance
    if (status === 'completed') {
      await db.query(`
        UPDATE ai_access_tokens
        SET token_balance = token_balance - $1
        WHERE id = $2 AND token_balance >= $1
      `, [totalTokens, tokenId])

      // Record transaction
      await db.query(`
        INSERT INTO ai_token_transactions (
          access_token_id,
          transaction_type,
          amount,
          balance_before,
          balance_after,
          description,
          metadata
        )
        SELECT
          $1,
          'usage',
          -$2,
          token_balance + $2,
          token_balance,
          $3,
          $4
        FROM ai_access_tokens
        WHERE id = $1
      `, [
        tokenId,
        totalTokens,
        `${application} - ${operation}`,
        JSON.stringify({ requestId, modelId })
      ])
    }

    res.status(201).json({
      success: true,
      data: {
        id: usageResult.rows[0].id,
        totalTokens,
        totalCost,
        createdAt: usageResult.rows[0].created_at
      },
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
 * GET /api/ai-tokens/preferences/:userId
 * Get user's model preferences
 */
router.get('/preferences/:userId', [
  param('userId').isString().trim().notEmpty(),
  query('application').optional().isString()
], validate, async (req, res) => {
  try {
    const db = pool
    const { userId } = req.params
    const { application } = req.query

    // Issue #4322: Handle mock database (pool is null per Issue #2155)
    if (!db) {
      console.log('[Preferences] Database pool is null (mock mode), returning empty preferences')
      return res.json({
        success: true,
        data: []
      })
    }

    let query = `
      SELECT
        p.*,
        m.model_id,
        m.display_name as model_name,
        pr.name as provider_name
      FROM user_model_preferences p
      LEFT JOIN ai_models m ON p.preferred_model_id = m.id
      LEFT JOIN ai_model_providers pr ON m.provider_id = pr.id
      WHERE p.user_id = $1
    `
    const params = [userId]

    if (application) {
      query += ` AND p.application = $2`
      params.push(application)
    }

    const result = await db.query(query, params)

    res.json({
      success: true,
      data: result.rows
    })
  } catch (error) {
    console.error('Error fetching preferences:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch preferences',
      message: error.message
    })
  }
})

/**
 * PUT /api/ai-tokens/preferences/:userId/:application
 * Update user's model preference for an application
 */
router.put('/preferences/:userId/:application', [
  param('userId').isString().trim().notEmpty(),
  param('application').isString().trim().notEmpty(),
  body('preferredModelId').isString().trim().notEmpty(), // Changed from isUUID() to accept model string identifiers (e.g., "deepseek-chat")
  body('accessTokenId').optional().isUUID(),
  body('settings').optional().isObject()
], validate, async (req, res) => {
  try {
    const db = pool
    const { userId, application } = req.params
    const { preferredModelId, accessTokenId = null, settings = {} } = req.body

    // Issue #4322: Handle mock database (pool is null per Issue #2155)
    if (!db) {
      console.log('[Preferences] Database pool is null (mock mode), cannot save preferences')
      return res.json({
        success: true,
        data: {
          user_id: userId,
          application,
          preferred_model_id: preferredModelId,
          access_token_id: accessTokenId,
          settings
        },
        message: 'Preference saved (mock mode - not persisted)'
      })
    }

    const result = await db.query(`
      INSERT INTO user_model_preferences (
        user_id,
        application,
        preferred_model_id,
        access_token_id,
        settings
      ) VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (user_id, application)
      DO UPDATE SET
        preferred_model_id = $3,
        access_token_id = $4,
        settings = $5,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `, [userId, application, preferredModelId, accessTokenId, JSON.stringify(settings)])

    res.json({
      success: true,
      data: result.rows[0],
      message: 'Preference updated successfully'
    })
  } catch (error) {
    console.error('Error updating preference:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to update preference',
      message: error.message
    })
  }
})

/**
 * GET /api/ai-tokens/default-token/:userId
 * Get or create default DronDoc token for user with DeepSeek access
 * Issue #1211 - Default DeepSeek token for all users
 * Issue #1772 - No SQL. No local DB. Use DronDoc API for AI models.
 */
router.get('/default-token/:userId', [
  param('userId').isString().trim().notEmpty()
], validate, async (req, res) => {
  try {
    const { userId } = req.params

    // Extract user token from X-Authorization header
    const userToken = req.headers['x-authorization']

    // console.log('[GET /default-token] Request for userId:', userId, {
    //   hasXAuthorization: !!userToken,
    //   tokenPrefix: userToken ? userToken.substring(0, 10) + '...' : 'none'
    // })

    // Fetch all models from DronDoc API
    let models = []
    try {
      models = await fetchModelsFromDronDoc(userToken)
    } catch (apiError) {
      console.error('[GET /default-token] Failed to fetch models from DronDoc API:', apiError.message)

      // For anonymous users without X-Authorization, fallback to environment-based default
      // Issue #1784 - Use DEEPSEEK_API_KEY from .env for anonymous users
      if (!userToken && userId === 'anonymous') {
        console.warn('[GET /default-token] DronDoc API unavailable for anonymous user, using fallback default model')

        // Create a fallback default model using environment variables
        const deepseekApiKey = process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY
        const defaultModelId = process.env.DEFAULT_AI_MODEL || 'deepseek-v3.2'

        if (!deepseekApiKey) {
          return res.status(503).json({
            success: false,
            error: 'No API key configured',
            message: 'Neither DronDoc API nor DEEPSEEK_API_KEY is available. Please configure DEEPSEEK_API_KEY in environment variables.'
          })
        }

        // Create a minimal fallback model
        models = [{
          id: 'system_default',
          model_id: defaultModelId,
          display_name: defaultModelId,
          provider_name: 'deepseek',
          provider_display_name: 'DeepSeek',
          context_window: '128K',
          cost_per_1k_input: '0.14',
          cost_per_1k_output: '0.28',
          intelligence_level: 'high',
          speed_level: 'fast',
          is_visible: true,
          is_active: true,
          description: 'System default AI model',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }]
      } else {
        // For authenticated users, return error if DronDoc API fails
        return res.status(503).json({
          success: false,
          error: 'DronDoc API unavailable',
          message: 'Unable to fetch AI models from DronDoc API. Please check your authentication token or try again later.',
          details: apiError.message
        })
      }
    }

    // Find a default model (preferably DeepSeek or first available)
    let defaultModel = models.find(m =>
      m.provider_name.toLowerCase() === 'deepseek' ||
      m.provider_name.toLowerCase() === 'openai'
    )

    // If no DeepSeek/OpenAI model, use first available
    if (!defaultModel && models.length > 0) {
      defaultModel = models[0]
    }

    // Create a default token structure (no database storage)
    // This is a virtual token that represents access via DronDoc API
    const defaultToken = {
      id: `default_${userId}`,
      token_prefix: 'dd_api_...',
      name: 'DronDoc API Access',
      user_id: userId,
      scopes: ['model:read', 'model:use'],
      allowed_models: ['*'],
      allowed_applications: ['*'],
      rate_limit_rpm: 60,
      rate_limit_tpm: 100000,
      token_balance: 999999999, // Effectively unlimited via DronDoc API
      daily_limit: 100000,
      monthly_limit: 1000000,
      expires_at: null,
      last_used_at: null,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    res.json({
      success: true,
      data: {
        token: defaultToken,
        defaultModel: defaultModel || null,
        availableModels: models
      },
      message: 'Default token retrieved successfully from DronDoc API'
    })
  } catch (error) {
    console.error('Error getting default token:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to get default token',
      message: error.message
    })
  }
})

/**
 * GET /api/ai-tokens/system-config
 * Get system AI configuration (default providers and models)
 * Issue #1211 - System-wide default configuration
 * Issue #2659 - Handle mocked database gracefully
 * Issue #2665 - Fix 500 error when database is mocked or unavailable
 */
router.get('/system-config', async (req, res) => {
  // Helper function to return fallback configuration
  const returnFallbackConfig = (reason = 'database not available') => {
    const fallbackDefaultModel = {
      id: 'system_default',
      model_id: 'deepseek-chat',
      display_name: 'DeepSeek Chat',
      description: 'Default AI model',
      context_window: '128K',
      max_output_tokens: '4096',
      cost_per_1k_input: '0.14',
      cost_per_1k_output: '0.28',
      provider_name: 'deepseek',
      provider_display_name: 'DeepSeek',
      provider_base_url: 'https://api.deepseek.com'
    }

    return res.json({
      success: true,
      data: {
        systemConfig: [],
        defaultModel: fallbackDefaultModel,
        hasDefaultKey: !!process.env.DEEPSEEK_API_KEY,
        usingFallback: true
      },
      message: `System configuration retrieved from fallback (${reason})`
    })
  }

  try {
    const db = pool

    // Check if database is available (not mocked)
    if (!db) {
      // Database is mocked - return fallback configuration
      // Issue #2155 - No SQL. Use DronDoc API or fallback data.
      return returnFallbackConfig('database not available')
    }

    // Wrap database queries in try-catch to handle query errors gracefully
    let result, defaultModel
    try {
      // Get system configuration
      result = await db.query(`
        SELECT * FROM v_system_ai_config
        WHERE provider_name = 'deepseek'
        ORDER BY is_default DESC, model_display_name
      `)

      // Get default DeepSeek model
      defaultModel = await db.query(`
        SELECT
          m.id,
          m.model_id,
          m.display_name,
          m.description,
          m.context_window,
          m.max_output_tokens,
          m.cost_per_1k_input,
          m.cost_per_1k_output,
          p.name as provider_name,
          p.display_name as provider_display_name,
          p.base_url as provider_base_url
        FROM ai_models m
        JOIN ai_model_providers p ON m.provider_id = p.id
        WHERE p.name = 'deepseek'
          AND m.model_id = 'deepseek-chat'
          AND m.is_active = true
        LIMIT 1
      `)
    } catch (queryError) {
      // Database query failed (likely because database is mocked or tables don't exist)
      console.warn('Database query failed in /system-config, using fallback:', queryError.message)
      return returnFallbackConfig('database query failed')
    }

    // Check if database returned empty results (mocked)
    if (!result || !defaultModel || (result.rows.length === 0 && defaultModel.rows.length === 0)) {
      // Database is mocked - return fallback configuration
      return returnFallbackConfig('database empty')
    }

    res.json({
      success: true,
      data: {
        systemConfig: result.rows,
        defaultModel: defaultModel.rows[0] || null,
        hasDefaultKey: result.rows.some(r => r.is_default && r.key_active)
      },
      message: 'System configuration retrieved successfully'
    })
  } catch (error) {
    // Final catch-all error handler - still return fallback instead of 500 error
    console.error('Unexpected error in /system-config, using fallback:', error.message)
    return returnFallbackConfig('unexpected error')
  }
})

/**
 * POST /api/ai-tokens/provider-keys
 * Set or update provider API key (admin only)
 * Issue #1211 - Manage provider API keys
 */
router.post('/provider-keys', [
  body('providerName').isString().trim().notEmpty(),
  body('apiKey').isString().trim().notEmpty(),
  body('keyName').optional().isString().default('default'),
  body('isDefault').optional().isBoolean().default(true)
], validate, async (req, res) => {
  try {
    const db = pool
    const { providerName, apiKey, keyName, isDefault } = req.body

    // TODO: Add admin authentication check here
    // For now, this is a simple implementation

    // Get provider ID
    const providerResult = await db.query(`
      SELECT id FROM ai_model_providers WHERE name = $1
    `, [providerName])

    if (providerResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Provider not found'
      })
    }

    const providerId = providerResult.rows[0].id

    // Simple encryption (in production, use proper encryption like AWS KMS, HashiCorp Vault, etc.)
    // For now, we'll store it as-is and mark it as encrypted
    const encryptedKey = Buffer.from(apiKey).toString('base64')

    // Insert or update the key
    const result = await db.query(`
      INSERT INTO ai_provider_api_keys (
        provider_id,
        key_name,
        api_key_encrypted,
        is_default,
        is_active,
        created_by
      ) VALUES ($1, $2, $3, $4, true, 'admin')
      ON CONFLICT (provider_id, key_name)
      DO UPDATE SET
        api_key_encrypted = $3,
        is_default = $4,
        is_active = true,
        updated_at = CURRENT_TIMESTAMP
      RETURNING id, key_name, is_default, created_at, updated_at
    `, [providerId, keyName, encryptedKey, isDefault])

    res.json({
      success: true,
      data: result.rows[0],
      message: 'Provider API key updated successfully'
    })
  } catch (error) {
    console.error('Error updating provider key:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to update provider API key',
      message: error.message
    })
  }
})

/**
 * GET /api/ai-tokens/provider-keys/:providerName
 * Get provider API key info (without revealing the actual key)
 */
router.get('/provider-keys/:providerName', [
  param('providerName').isString().trim().notEmpty()
], validate, async (req, res) => {
  try {
    const db = pool
    const { providerName } = req.params

    const result = await db.query(`
      SELECT
        k.id,
        k.key_name,
        k.is_default,
        k.is_active,
        k.valid_from,
        k.valid_until,
        k.usage_limit_daily,
        k.usage_limit_monthly,
        k.metadata,
        k.created_at,
        k.updated_at,
        p.name as provider_name,
        p.display_name as provider_display_name
      FROM ai_provider_api_keys k
      JOIN ai_model_providers p ON k.provider_id = p.id
      WHERE p.name = $1
      ORDER BY k.is_default DESC, k.created_at DESC
    `, [providerName])

    res.json({
      success: true,
      data: result.rows
    })
  } catch (error) {
    console.error('Error fetching provider keys:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch provider API keys',
      message: error.message
    })
  }
})

/**
 * Detect AI provider from model name/ID
 * @param {string} modelName - Model name or ID (e.g., "gpt-4", "claude-sonnet-4.5")
 * @returns {string} Provider name (e.g., "openai", "anthropic")
 */
function detectProvider(modelName) {
  if (!modelName) return 'unknown'

  const name = modelName.toLowerCase()

  // FIRST: Check for explicit provider prefix (e.g., "openai/gpt-4", "kodacode/KodaAgent")
  if (name.includes('/')) {
    const prefix = name.split('/')[0].trim()
    // Return the prefix if it's a known provider
    const knownProviders = ['openai', 'anthropic', 'google', 'deepseek', 'kodacode', 'polza',
                           'meta', 'mistral', 'alibaba', 'qwen', 'xai', 'cohere', 'perplexity', 'together']
    if (knownProviders.includes(prefix)) {
      return prefix
    }
  }

  // SECOND: Detect provider from model name patterns

  // Kodacode models (check before Polza to avoid conflicts)
  if (name.includes('koda')) {
    return 'kodacode'
  }

  // OpenAI models
  if (name.includes('gpt') || name.includes('o1') || name.includes('o3')) {
    return 'openai'
  }

  // Anthropic models
  if (name.includes('claude')) {
    return 'anthropic'
  }

  // Google models
  if (name.includes('gemini') || name.includes('palm')) {
    return 'google'
  }

  // DeepSeek models
  if (name.includes('deepseek')) {
    return 'deepseek'
  }

  // Alibaba models
  if (name.includes('qwen')) {
    return 'alibaba'
  }

  // Meta models
  if (name.includes('llama')) {
    return 'meta'
  }

  // Mistral models
  if (name.includes('mistral')) {
    return 'mistral'
  }

  // xAI models
  if (name.includes('grok')) {
    return 'xai'
  }

  // Cohere models
  if (name.includes('command')) {
    return 'cohere'
  }

  // Perplexity models
  if (name.includes('pplx')) {
    return 'perplexity'
  }

  // Together AI models
  if (name.includes('together')) {
    return 'together'
  }

  // Polza AI models (local provider)
  if (name.includes('polza')) {
    return 'polza'
  }

  return 'unknown'
}

// TEST ENDPOINT - simple response to verify routing works
router.get('/test-route', (req, res) => {
  console.log('[TEST] /test-route endpoint called!')
  res.json({ success: true, message: 'Test route works! File loaded correctly.' })
})

/**
 * GET /api/ai-tokens/external-models
 * Fetch available models from multiple sources:
 * 1. Integram database (table 195686 in 'my' database) - PRIMARY SOURCE with 160+ models
 * 2. External API (api.kodacode.ru) using GitHub token
 * 3. Polza AI models from local polzaService
 * Returns models in format compatible with Chat.vue dropdown
 * Maintains compatibility with existing Polza.ai functionality
 *
 * Issue #4341: Added Polza AI provider and other providers support
 * Issue #5112: Load ALL models from Integram database (160+ models) instead of hardcoded list
 */
router.get('/external-models', async (req, res) => {
  console.log('[API] /external-models endpoint called - START')
  console.error('[DEBUG] external-models endpoint called')

  try {
    let integramModels = []
    let externalModels = []

    // 1. PRIMARY SOURCE: Load models from Integram database (table 195686)
    try {
      console.log('[Integram Models] Attempting to get DronDoc token...')
      const dronDocToken = await getDronDocToken()
      console.log('[Integram Models] DronDoc token:', dronDocToken ? 'Found (length: ' + dronDocToken.length + ')' : 'NOT FOUND')

      if (dronDocToken) {
        console.log('[Integram Models] Loading models from Integram report...')

        // Load report (all 166 models at once, no pagination)
        const reportResponse = await fetch(`${DRONEDOC_API_BASE_URL}/my/report/ai_model?JSON_KV`, {
          method: 'GET',
          headers: {
            'X-Authorization': dronDocToken,
            'Content-Type': 'application/json'
          }
        })

        if (reportResponse.ok) {
          const reportModels = await reportResponse.json()
          console.log(`[Integram Models] Loaded ${reportModels.length} models from report`)
          console.log(`[Integram Models] First model:`, JSON.stringify(reportModels[0]))

          // Convert report format to API format
          integramModels = reportModels.map(reportModel => ({
            id: reportModel['model_id'] || reportModel['ID'] || reportModel['id'] || null,
            name: reportModel['model'] || reportModel['Модель'],
            value: reportModel['model'] || reportModel['Модель'],
            provider: detectProvider(reportModel['model'] || reportModel['Модель']),
            context_length: 0,
            created: 0
          }))

          console.log(`[Integram Models] Converted ${integramModels.length} models`)
          console.log(`[Integram Models] First converted:`, JSON.stringify(integramModels[0]))
        } else {
          console.warn('[Integram Models] Failed to load report:', reportResponse.status)
          const errorText = await reportResponse.text()
          console.warn('[Integram Models] Error response:', errorText.substring(0, 200))
        }
      } else {
        console.warn('[Integram Models] DronDoc token not found, skipping Integram models')
      }
    } catch (integramError) {
      console.warn('[Integram Models] Error loading from Integram:', integramError.message)
    }

    // 2. SECONDARY SOURCE: Try to fetch from external API if GitHub token is available
    const githubToken = process.env.GITHUB_TOKEN

    if (githubToken) {
      try {
        // Make request to external API to get models list
        const response = await fetch('https://api.kodacode.ru/v1/models', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${githubToken}`,
            'Content-Type': 'application/json'
          }
        })

        if (response.ok) {
          const data = await response.json()

          if (data.object === 'list') {
            // Get models from API response - include both data and koda_data
            const mainModels = data.data || []
            const kodaModels = data.koda_data || []
            const allModels = [...mainModels, ...kodaModels]

            externalModels = allModels.map(model => ({
              name: getModelDisplayName(model.id),
              value: model.id,
              provider: 'kodacode',  // All models from kodacode.ru API are from Kodacode provider
              context_length: model.context_length || 0,
              created: model.created || 0
            }))

            console.log(`[External API] Loaded ${externalModels.length} models from external API (${mainModels.length} main + ${kodaModels.length} koda)`)
          }
        } else {
          console.warn('External API returned non-OK status:', response.status)
        }
      } catch (apiError) {
        console.warn('Failed to fetch from external API:', apiError.message)
      }
    } else {
      console.warn('GITHUB_TOKEN not found in environment variables')
    }

    // 3. TERTIARY SOURCE: Get Polza AI models from local polzaService
    const polzaModels = polzaService.getAvailableModels().map(model => ({
      name: model.name,
      value: model.id,
      provider: model.provider,
      context_length: model.context_length || 0,
      created: 0
    }))

    console.log(`[Polza Service] Loaded ${polzaModels.length} models from Polza service`)

    // Merge all models - use provider+value as unique key to avoid conflicts
    // Polza and Kodacode models should NOT be deduplicated with Integram models
    const modelMap = new Map()

    // Add Polza models with provider prefix in key
    polzaModels.forEach(model => {
      const uniqueKey = `polza:${model.value}`
      modelMap.set(uniqueKey, model)
    })

    // Add Kodacode models with provider prefix in key
    externalModels.forEach(model => {
      const uniqueKey = `kodacode:${model.value}`
      modelMap.set(uniqueKey, model)
    })

    // Add Integram models with their original value as key
    integramModels.forEach(model => {
      const uniqueKey = `integram:${model.value}`
      modelMap.set(uniqueKey, model)
    })

    const allModels = Array.from(modelMap.values())

    // Fallback if no models available
    if (allModels.length === 0) {
      const fallbackModels = [
        { name: 'MiniMax M2', value: 'minimax-m2', provider: 'minimax', context_length: 180000 },
        { name: 'Gemini 2.5 Flash', value: 'gemini-2.5-flash', provider: 'google', context_length: 986000 },
        { name: 'DeepSeek V3.1 Terminus', value: 'deepseek-v3.1-terminus', provider: 'deepseek', context_length: 114000 }
      ]

      return res.json({
        success: true,
        data: fallbackModels,
        message: 'Using fallback models (no external or Polza models available)'
      })
    }

    res.json({
      success: true,
      data: allModels,
      message: `Successfully loaded ${allModels.length} models (${integramModels.length} from Integram, ${polzaModels.length} from Polza AI, ${externalModels.length} from external API) - NEW CODE V2`
    })

  } catch (error) {
    console.error('Error fetching external models:', error)

    // Fallback to Polza models + some defaults if everything fails
    try {
      const polzaModels = polzaService.getAvailableModels().map(model => ({
        name: model.name,
        value: model.id,
        provider: model.provider,
        context_length: model.context_length || 0,
        created: 0
      }))

      if (polzaModels.length > 0) {
        return res.status(200).json({
          success: true,
          data: polzaModels,
          message: 'External API unavailable, using Polza AI models'
        })
      }
    } catch (polzaError) {
      console.error('Failed to load Polza models:', polzaError.message)
    }

    // Ultimate fallback
    const fallbackModels = [
      { name: 'MiniMax M2', value: 'minimax-m2', provider: 'minimax', context_length: 180000 },
      { name: 'Gemini 2.5 Flash', value: 'gemini-2.5-flash', provider: 'google', context_length: 986000 },
      { name: 'DeepSeek V3.1 Terminus', value: 'deepseek-v3.1-terminus', provider: 'deepseek', context_length: 114000 },
      { name: 'GLM-4.6', value: 'glm-4.6', provider: 'z-ai', context_length: 186000 },
      { name: 'Qwen3 235B A22B', value: 'qwen3-235b-a22b', provider: 'qwen', context_length: 116000 },
      { name: 'Qwen3 Coder', value: 'qwen3-coder', provider: 'qwen', context_length: 116000 },
      { name: 'Kimi K2 Thinking', value: 'kimi-k2-thinking', provider: 'moonshotai', context_length: 244000 }
    ]

    res.status(200).json({
      success: true,
      data: fallbackModels,
      message: 'All APIs unavailable, using fallback models'
    })
  }
})

/**
 * Helper function to get display name for model ID
 * @param {string} modelId - Model ID from API
 * @returns {string} - User-friendly display name
 */
function getModelDisplayName(modelId) {
  const nameMap = {
    'minimax-m2': 'MiniMax M2',
    'gemini-2.5-flash': 'Gemini 2.5 Flash',
    'deepseek-v3.1-terminus': 'DeepSeek V3.1 Terminus',
    'glm-4.6': 'GLM-4.6',
    'qwen3-235b-a22b': 'Qwen3 235B A22B',
    'qwen3-coder': 'Qwen3 Coder',
    'kimi-k2-thinking': 'Kimi K2 Thinking'
  }
  
  return nameMap[modelId] || modelId.replace(/[-_]/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
}

/**
 * POST /api/ai-tokens/chat
 * Send chat message to external API (api.kodacode.ru) using GitHub token
 * This endpoint can be used by Chat.vue for actual chat functionality with external models
 * Maintains compatibility with existing Polza.ai functionality
 *
 * Supports two request formats:
 * 1. Standard OpenAI format: { model, messages, temperature, max_tokens, stream, provider, enableFallback }
 * 2. Legacy format (compatibility): { modelId, prompt, application, operation }
 */
router.post('/chat', async (req, res) => {
  // Manual validation for dual format support
  console.log('[Chat Route] Handling request with body:', JSON.stringify(req.body).substring(0, 200))

  const { model, messages, modelId, prompt, temperature, max_tokens, stream } = req.body
  const hasStandardFormat = model && messages
  const hasLegacyFormat = modelId && prompt

  console.log('[Chat Route] Format check: standard=%s legacy=%s', hasStandardFormat, hasLegacyFormat)

  if (!hasStandardFormat && !hasLegacyFormat) {
    return res.status(400).json({
      success: false,
      error: 'Invalid request format',
      message: 'Must provide either (model + messages) OR (modelId + prompt)'
    })
  }

  // Validate types if provided
  if (temperature !== undefined && (typeof temperature !== 'number' || temperature < 0 || temperature > 2)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid temperature',
      message: 'Temperature must be a number between 0 and 2'
    })
  }

  if (max_tokens !== undefined && (typeof max_tokens !== 'number' || max_tokens < 1 || max_tokens > 32000)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid max_tokens',
      message: 'max_tokens must be a number between 1 and 32000'
    })
  }

  if (stream !== undefined && typeof stream !== 'boolean') {
    return res.status(400).json({
      success: false,
      error: 'Invalid stream',
      message: 'stream must be a boolean'
    })
  }

  try {
    let {
      application,
      operation,
      provider = 'external',
      enableFallback = true // Default: enable fallback
    } = req.body

    // Apply defaults
    let finalTemp = temperature !== undefined ? temperature : 0.7
    let finalMaxTokens = max_tokens !== undefined ? max_tokens : 2048
    let finalStream = stream !== undefined ? stream : false

    // Destructure again to get mutable copies
    let finalModel = model
    let finalMessages = messages

    // Compatibility layer: Convert legacy format to standard format
    if (!finalModel && !finalMessages && modelId && prompt) {
      console.log(`[Chat] Converting legacy request format from application: ${application || 'unknown'}`)

      // Use modelId as model name (will be mapped to Polza model if external fails)
      finalModel = modelId

      // Convert prompt to messages array
      finalMessages = [
        { role: 'user', content: prompt }
      ]

      // Default to Polza provider for legacy format to avoid GitHub token errors
      provider = 'polza'

      console.log(`[Chat] Converted to standard format: model=${finalModel}, provider=${provider}`)
    }

    // Route to appropriate provider
    if (provider === 'polza' || finalModel.includes('polza') || finalModel.includes('anthropic') || finalModel.includes('openai')) {
      // Use existing Polza.ai functionality
      return await handlePolzaChat(req, res, { model: finalModel, messages: finalMessages, temperature: finalTemp, max_tokens: finalMaxTokens, stream: finalStream })
    } else {
      // Try external API first
      // If it fails with GitHub token error and fallback is enabled, try Polza
      try {
        return await handleExternalChat(req, res, { model: finalModel, messages: finalMessages, temperature: finalTemp, max_tokens: finalMaxTokens, stream: finalStream })
      } catch (externalError) {
        // Check if error is related to GitHub token and fallback is enabled
        if (enableFallback && (
          externalError.message?.includes('GitHub token') ||
          externalError.message?.includes('GITHUB_TOKEN')
        )) {
          console.warn('[Chat] External API failed due to GitHub token issue, falling back to Polza AI')
          console.warn('[Chat] Original error:', externalError.message)

          // Try to map model to Polza equivalent
          let polzaModel = finalModel
          const modelMap = {
            'minimax-m2': 'anthropic/claude-sonnet-4.5',
            'deepseek-v3.1-terminus': 'anthropic/claude-sonnet-4.5',
            'gemini-2.5-flash': 'anthropic/claude-sonnet-4.5',
            'glm-4.6': 'anthropic/claude-sonnet-4.5',
            'qwen3-235b-a22b': 'anthropic/claude-sonnet-4.5',
            'qwen3-coder': 'anthropic/claude-sonnet-4.5',
            'kimi-k2-thinking': 'anthropic/claude-sonnet-4.5'
          }
          if (modelMap[finalModel]) {
            polzaModel = modelMap[finalModel]
            console.log('[Chat] Mapping model from', finalModel, 'to', polzaModel)
          }

          try {
            const polzaResponse = await handlePolzaChat(req, res, {
              model: polzaModel,
              messages: finalMessages,
              temperature: finalTemp,
              max_tokens: finalMaxTokens,
              stream: finalStream
            })
            console.log('[Chat] Fallback to Polza AI successful')
            return polzaResponse
          } catch (polzaError) {
            console.error('[Chat] Fallback to Polza AI also failed:', polzaError.message)
            // If Polza also fails, return the original external API error with more context
            return res.status(externalError.statusCode || 500).json({
              ...externalError.details,
              fallbackAttempted: true,
              fallbackError: polzaError.message
            })
          }
        }
        // If not a GitHub token error or fallback disabled, return the error
        return res.status(externalError.statusCode || 500).json(externalError.details || {
          success: false,
          error: 'External API error',
          message: externalError.message
        })
      }
    }

  } catch (error) {
    console.error('Error in chat endpoint:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to process chat request',
      message: error.message
    })
  }
})

/**
 * Handle chat requests to external API (api.kodacode.ru)
 * Issue #4873: Log AI token consumption to Integram
 */
async function handleExternalChat(req, res, params) {
  try {
    const { model, messages, temperature, max_tokens, stream } = params

    // Get GitHub token from environment variables and trim whitespace
    const githubToken = process.env.GITHUB_TOKEN?.trim()

    if (!githubToken) {
      console.error('[External Chat] GITHUB_TOKEN not configured in environment')
      const error = new Error('GITHUB_TOKEN environment variable is not set')
      error.statusCode = 500
      error.details = {
        success: false,
        error: 'GitHub token not configured',
        message: 'GITHUB_TOKEN environment variable is not set. Please configure it in your .env file or environment variables.',
        hint: 'Add GITHUB_TOKEN=your-github-token to backend/monolith/.env (without quotes)',
        currentEnv: process.env.GITHUB_TOKEN ? `Exists but empty/whitespace (length: ${process.env.GITHUB_TOKEN.length})` : 'Not set'
      }
      throw error
    }

    // Validate token format (GitHub tokens start with specific prefixes)
    const validPrefixes = ['ghp_', 'gho_', 'ghu_', 'ghs_', 'ghr_', 'github_pat_']
    const hasValidPrefix = validPrefixes.some(prefix => githubToken.startsWith(prefix))

    if (!hasValidPrefix) {
      console.warn('[External Chat] GITHUB_TOKEN may have invalid format:', {
        prefix: githubToken.substring(0, 4),
        length: githubToken.length,
        expectedPrefixes: validPrefixes
      })
    }

    // Log token info (first 10 chars for debugging, without exposing full token)
    console.log('[External Chat] Using GITHUB_TOKEN:', githubToken.substring(0, 10) + '...', `(length: ${githubToken.length})`)

    // Extract userId from Authorization header (if present)
    let userId = 'unknown'
    const authHeader = req.headers.authorization
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const tokenId = authHeader.substring(7)
      try {
        const tokenResult = await pool.query(`
          SELECT user_id FROM ai_access_tokens WHERE id = $1 AND is_active = true
        `, [tokenId])
        if (tokenResult.rows.length > 0) {
          userId = tokenResult.rows[0].user_id
        }
      } catch (err) {
        console.warn('Failed to extract userId from token:', err.message)
      }
    }

    // Map legacy model names to kodacode.ru available models
    const modelMapping = {
      'deepseek-chat': 'deepseek-v3.2',
      'deepseek': 'deepseek-v3.2',
      'gpt-4': 'deepseek-v3.2',
      'gpt-3.5-turbo': 'deepseek-v3.2'
    }
    const mappedModel = modelMapping[model] || model

    // Prepare request to external API
    const requestBody = {
      model: mappedModel,
      messages: messages,
      temperature: temperature,
      max_tokens: max_tokens,
      stream: stream
    }

    // Make request to external API
    const response = await fetch('https://api.kodacode.ru/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${githubToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[External Chat] API error:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText,
        tokenPrefix: githubToken.substring(0, 10) + '...'
      })

      // Parse error details if JSON
      let errorDetails = errorText
      try {
        const errorJson = JSON.parse(errorText)
        errorDetails = errorJson.detail || errorJson.error || errorText
      } catch (e) {
        // Keep original error text
      }

      // Special handling for 401 GitHub token validation errors
      if (response.status === 401 && errorDetails.includes('GitHub token')) {
        const error = new Error('GitHub token validation failed')
        error.statusCode = 401
        error.details = {
          success: false,
          error: 'GitHub token validation failed',
          message: 'The external API (api.kodacode.ru) rejected the GitHub token. The token may be expired, invalid, or lack required permissions.',
          details: errorDetails,
          tokenInfo: {
            prefix: githubToken.substring(0, 10) + '...',
            length: githubToken.length,
            hasValidPrefix: validPrefixes.some(prefix => githubToken.startsWith(prefix))
          },
          troubleshooting: [
            'Check that GITHUB_TOKEN is set correctly in backend/monolith/.env (without quotes)',
            'Verify the token starts with a valid prefix: ' + validPrefixes.join(', '),
            'Ensure no trailing whitespace or newlines in the .env file',
            'Test the token directly: curl -H "Authorization: Bearer YOUR_TOKEN" https://api.kodacode.ru/v1/models',
            'Verify the token is valid at https://github.com/settings/tokens',
            'Ensure the token has necessary scopes (repo, read:org)',
            'Try regenerating the token if it has expired',
            'Note: The fallback to Polza AI should work automatically if enableFallback=true',
            'Contact the api.kodacode.ru administrator if the issue persists'
          ]
        }
        throw error
      }

      const error = new Error(`API returned ${response.status}: ${response.statusText}`)
      error.statusCode = response.status
      error.details = {
        success: false,
        error: 'Failed to send chat request to external API',
        message: `API returned ${response.status}: ${response.statusText}`,
        details: errorDetails
      }
      throw error
    }

    const data = await response.json()

    // Log token consumption to Integram (asynchronously)
    if (data.usage && (data.usage.prompt_tokens || data.usage.completion_tokens)) {
      tokenConsumptionLogger.logConsumption({
        userId: userId,
        model: data.model || model,
        promptTokens: data.usage.prompt_tokens || 0,
        completionTokens: data.usage.completion_tokens || 0
      }).catch(err => {
        console.error('[External Chat] Failed to log token consumption:', err.message)
      })
    }

    res.json({
      success: true,
      data: data,
      provider: 'external',
      message: 'Chat request sent successfully to external API'
    })

  } catch (error) {
    console.error('Error sending external chat request:', error)

    // If error already has statusCode and details (from earlier in this function),
    // send those detailed error messages instead of generic one
    if (error.statusCode && error.details) {
      return res.status(error.statusCode).json(error.details)
    }

    // Otherwise, send generic error
    res.status(500).json({
      success: false,
      error: 'Failed to send external chat request',
      message: error.message
    })
  }
}

/**
 * Handle chat requests to existing Polza.ai API
 * This maintains backward compatibility with existing Polza.ai functionality
 * Issue #4873: Log AI token consumption to Integram
 */
async function handlePolzaChat(req, res, params) {
  try {
    const { model, messages, temperature, max_tokens, stream } = params

    // Extract userId from Authorization header (if present)
    let userId = 'unknown'
    const authHeader = req.headers.authorization
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const tokenId = authHeader.substring(7)
      try {
        const tokenResult = await pool.query(`
          SELECT user_id FROM ai_access_tokens WHERE id = $1 AND is_active = true
        `, [tokenId])
        if (tokenResult.rows.length > 0) {
          userId = tokenResult.rows[0].user_id
        }
      } catch (err) {
        console.warn('Failed to extract userId from token:', err.message)
      }
    }

    // Use existing Polza.ai service
    const polzaResponse = await polzaService.chat({
      model,
      messages,
      temperature,
      maxTokens: max_tokens,
      stream
    })

    // Log token consumption to Integram (asynchronously)
    if (polzaResponse.usage && (polzaResponse.usage.prompt_tokens || polzaResponse.usage.completion_tokens)) {
      tokenConsumptionLogger.logConsumption({
        userId: userId,
        model: polzaResponse.model || model,
        promptTokens: polzaResponse.usage.prompt_tokens || 0,
        completionTokens: polzaResponse.usage.completion_tokens || 0
      }).catch(err => {
        console.error('[Polza Chat] Failed to log token consumption:', err.message)
      })
    }

    res.json({
      success: true,
      data: polzaResponse,
      provider: 'polza',
      message: 'Chat request sent successfully to Polza.ai API'
    })

  } catch (error) {
    console.error('Error sending Polza.ai chat request:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to send Polza.ai chat request',
      message: error.message
    })
  }
}

/**
 * POST /api/ai-tokens/transcribe
 * Transcribe audio using AI (Whisper API via OpenAI or similar)
 * Issue #2353 - Live captions with AI transcription
 */
router.post('/transcribe', async (req, res) => {
  try {
    const multer = (await import('multer')).default
    const FormData = (await import('form-data')).default
    const fetch = (await import('node-fetch')).default

    // Setup multer for audio file upload
    const storage = multer.memoryStorage()
    const upload = multer({
      storage,
      limits: { fileSize: 25 * 1024 * 1024 }, // 25MB limit
      fileFilter: (req, file, cb) => {
        // Accept audio files
        if (file.mimetype.startsWith('audio/') || file.mimetype === 'video/webm') {
          cb(null, true)
        } else {
          cb(new Error('Only audio files are allowed'))
        }
      }
    })

    // Handle file upload
    upload.single('audio')(req, res, async (err) => {
      if (err) {
        return res.status(400).json({
          success: false,
          error: err.message
        })
      }

      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'No audio file provided'
        })
      }

      try {
        // Get authorization token from header
        const authHeader = req.headers.authorization
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          return res.status(401).json({
            success: false,
            error: 'Authorization token required'
          })
        }

        const tokenId = authHeader.substring(7)

        // Validate token and get user info
        const db = pool
        const tokenResult = await db.query(`
          SELECT
            t.id,
            t.user_id,
            t.token_balance,
            t.daily_limit,
            t.is_active
          FROM ai_access_tokens t
          WHERE t.id = $1 AND t.is_active = true
        `, [tokenId])

        if (tokenResult.rows.length === 0) {
          return res.status(401).json({
            success: false,
            error: 'Invalid or inactive token'
          })
        }

        const token = tokenResult.rows[0]

        // Check token balance
        if (token.token_balance <= 0) {
          return res.status(403).json({
            success: false,
            error: 'Insufficient token balance'
          })
        }

        // Get OpenAI API key from provider keys
        const keyResult = await db.query(`
          SELECT k.api_key_encrypted
          FROM ai_provider_api_keys k
          JOIN ai_model_providers p ON k.provider_id = p.id
          WHERE p.name = 'openai' AND k.is_active = true AND k.is_default = true
          LIMIT 1
        `)

        if (keyResult.rows.length === 0) {
          return res.status(500).json({
            success: false,
            error: 'OpenAI API key not configured'
          })
        }

        const openaiApiKey = Buffer.from(keyResult.rows[0].api_key_encrypted, 'base64').toString('utf-8')

        // Prepare form data for OpenAI Whisper API
        const formData = new FormData()
        formData.append('file', req.file.buffer, {
          filename: 'audio.webm',
          contentType: req.file.mimetype
        })
        formData.append('model', 'whisper-1')

        const language = req.body.language
        if (language && language !== 'auto') {
          // Extract language code (e.g., 'ru-RU' -> 'ru')
          const langCode = language.split('-')[0]
          formData.append('language', langCode)
        }

        // Call OpenAI Whisper API
        const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openaiApiKey}`,
            ...formData.getHeaders()
          },
          body: formData
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData.error?.message || 'Transcription API request failed')
        }

        const transcriptionData = await response.json()

        // Estimate token usage (rough estimate: ~1 token per second of audio)
        // OpenAI Whisper pricing is per minute, but we track in tokens
        const audioSizeInMB = req.file.size / (1024 * 1024)
        const estimatedDurationSeconds = audioSizeInMB * 20 // Rough estimate
        const estimatedTokens = Math.ceil(estimatedDurationSeconds)

        // Record usage
        await db.query(`
          INSERT INTO ai_token_usage (
            token_id,
            user_id,
            model_id,
            application,
            operation,
            prompt_tokens,
            completion_tokens,
            total_tokens,
            cost
          ) VALUES (
            $1, $2,
            (SELECT id FROM ai_models WHERE model_name = 'whisper-1' LIMIT 1),
            'LiveCaptions',
            'transcription',
            $3, 0, $3, 0
          )
        `, [token.id, token.user_id, estimatedTokens])

        // Update token balance
        await db.query(`
          UPDATE ai_access_tokens
          SET token_balance = token_balance - $1
          WHERE id = $2
        `, [estimatedTokens, token.id])

        res.json({
          success: true,
          data: {
            text: transcriptionData.text,
            language: transcriptionData.language,
            duration: transcriptionData.duration,
            tokensUsed: estimatedTokens
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
  } catch (error) {
    console.error('Error setting up transcription:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to setup transcription',
      message: error.message
    })
  }
})

/**
 * Ensure user has a default token (create if doesn't exist)
 * POST /api/ai-tokens/ensure-default-token
 * Issue #5025 - Allow users to manually request default token if they don't have one
 */
router.post('/ensure-default-token', [
  body('userId').notEmpty().withMessage('User ID is required')
], validate, async (req, res) => {
  try {
    const { userId } = req.body
    const userToken = req.headers['x-authorization'] || req.headers['authorization']?.replace('Bearer ', '')

    const result = await defaultTokenService.ensureDefaultToken(userId, userToken)

    if (result.success) {
      res.json({
        success: true,
        data: {
          tokenId: result.tokenId,
          alreadyExisted: result.alreadyExisted,
          tokenBalance: result.tokenBalance,
          message: result.alreadyExisted
            ? 'У вас уже есть токен'
            : 'Токен успешно создан! Начисление 1M токенов в подарок.'
        }
      })
    } else {
      res.status(500).json({
        success: false,
        error: result.error || 'Failed to create default token'
      })
    }
  } catch (error) {
    console.error('Error ensuring default token:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to ensure default token',
      message: error.message
    })
  }
})

/**
 * Check if user has a default token
 * GET /api/ai-tokens/has-default-token/:userId
 * Issue #5025 - Check token status for display on /tokens page
 */
router.get('/has-default-token/:userId', async (req, res) => {
  try {
    const { userId } = req.params
    const userToken = req.headers['x-authorization'] || req.headers['authorization']?.replace('Bearer ', '')

    const hasToken = await defaultTokenService.hasDefaultToken(userId, userToken)

    res.json({
      success: true,
      data: {
        hasDefaultToken: hasToken,
        userId
      }
    })
  } catch (error) {
    console.error('Error checking for default token:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to check for default token',
      message: error.message
    })
  }
})

export default router
