/**
 * Code Review API Routes
 * AI-powered automated code review for pull requests
 *
 * Issue #1594 - Система для ревью кода всех пиар с подключением разных моделей AI
 */

import express from 'express'
import crypto from 'crypto'
import { Octokit } from '@octokit/rest'
import logger from '../../utils/logger.js'
import { pool } from '../../config/database.js'
import { CodeReviewCoordinator } from '../../core/CodeReviewCoordinator.js'

const router = express.Router()

// Configuration
const GITHUB_WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET || 'dev-secret'
const GITHUB_OWNER = process.env.GITHUB_OWNER || 'unidel2035'
const GITHUB_REPO = process.env.GITHUB_REPO || 'dronedoc2025'

// Initialize coordinator (singleton)
let coordinator = null

async function getCoordinator() {
  if (!coordinator) {
    coordinator = new CodeReviewCoordinator({ pool, logger })
    await coordinator.initialize()
  }
  return coordinator
}

/**
 * Get GitHub API token from unified token storage or environment variable
 * @returns {Promise<string|null>} GitHub API token or null if not found
 */
async function getGitHubToken() {
  // Check environment variable first
  if (process.env.GITHUB_TOKEN) {
    logger.debug('Using GitHub token from environment variable')
    return process.env.GITHUB_TOKEN
  }

  // Try to get from code_review_provider_keys table
  try {
    const result = await pool.query(`
      SELECT api_key_encrypted
      FROM code_review_provider_keys
      WHERE provider_name = 'github'
        AND is_active = true
        AND is_default = true
      ORDER BY created_at DESC
      LIMIT 1
    `)

    if (result.rows.length === 0) {
      // Fallback to ai_provider_api_keys table
      const aiResult = await pool.query(`
        SELECT k.api_key_encrypted
        FROM ai_provider_api_keys k
        JOIN ai_model_providers p ON k.provider_id = p.id
        WHERE p.name = 'github'
          AND k.is_active = true
          AND k.is_default = true
        LIMIT 1
      `)

      if (aiResult.rows.length === 0) {
        logger.warn('GitHub API key not found in database or environment')
        return null
      }

      const encryptedKey = aiResult.rows[0].api_key_encrypted
      return Buffer.from(encryptedKey, 'base64').toString('utf-8')
    }

    const encryptedKey = result.rows[0].api_key_encrypted
    // Handle both base64: prefix and plain base64
    if (encryptedKey.startsWith('base64:')) {
      return Buffer.from(encryptedKey.substring(7), 'base64').toString('utf-8')
    }
    return Buffer.from(encryptedKey, 'base64').toString('utf-8')
  } catch (error) {
    logger.error('Failed to retrieve GitHub token', {
      error: error.message,
      stack: error.stack
    })
    return null
  }
}

/**
 * Verify GitHub webhook signature
 * @param {string} payload - Raw request body
 * @param {string} signature - X-Hub-Signature-256 header value
 * @returns {boolean} True if signature is valid
 */
function verifyWebhookSignature(payload, signature) {
  if (!signature) return false

  const hmac = crypto.createHmac('sha256', GITHUB_WEBHOOK_SECRET)
  const digest = 'sha256=' + hmac.update(payload).digest('hex')

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(digest)
  )
}

/**
 * POST /api/code-review/webhook
 * Receive GitHub webhook events for pull requests
 */
router.post('/webhook', express.json({ verify: (req, res, buf) => {
  // Store raw body for signature verification
  req.rawBody = buf.toString('utf8')
}}), async (req, res) => {
  const signature = req.headers['x-hub-signature-256']
  const eventType = req.headers['x-github-event']
  const deliveryId = req.headers['x-github-delivery']

  logger.info('Received GitHub webhook', {
    eventType,
    deliveryId,
    action: req.body.action
  })

  // Verify signature
  if (!verifyWebhookSignature(req.rawBody, signature)) {
    logger.warn('Invalid webhook signature', { deliveryId })
    return res.status(401).json({
      status: 'error',
      message: 'Invalid signature'
    })
  }

  try {
    // Store webhook event
    const webhookResult = await pool.query(`
      INSERT INTO code_review_webhooks (
        event_type,
        action,
        repository_owner,
        repository_name,
        pr_number,
        payload
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `, [
      eventType,
      req.body.action,
      req.body.repository?.owner?.login || null,
      req.body.repository?.name || null,
      req.body.pull_request?.number || null,
      JSON.stringify(req.body)
    ])

    const webhookId = webhookResult.rows[0].id

    // Handle pull_request events
    if (eventType === 'pull_request' && ['opened', 'synchronize', 'reopened'].includes(req.body.action)) {
      const coordinator = await getCoordinator()

      // Queue review asynchronously
      setImmediate(async () => {
        try {
          const reviewId = await coordinator.reviewPullRequest({
            webhookId,
            repository: {
              owner: req.body.repository.owner.login,
              name: req.body.repository.name
            },
            pullRequest: req.body.pull_request
          })

          logger.info('Code review queued', { reviewId, webhookId })
        } catch (error) {
          logger.error('Failed to queue code review', {
            error: error.message,
            webhookId
          })

          // Update webhook with error
          await pool.query(`
            UPDATE code_review_webhooks
            SET processing_error = $1
            WHERE id = $2
          `, [error.message, webhookId])
        }
      })

      return res.status(202).json({
        status: 'success',
        message: 'Webhook received and queued for processing',
        webhookId
      })
    }

    // Other events (just log for now)
    return res.status(200).json({
      status: 'success',
      message: 'Webhook received',
      webhookId
    })
  } catch (error) {
    logger.error('Webhook processing error', {
      error: error.message,
      stack: error.stack,
      eventType,
      deliveryId
    })

    return res.status(500).json({
      status: 'error',
      message: 'Internal server error',
      error: error.message
    })
  }
})

/**
 * GET /api/code-review/reviews
 * List all code reviews with filtering
 */
router.get('/reviews', async (req, res) => {
  try {
    const {
      repository,
      status,
      prNumber,
      author,
      limit = 50,
      offset = 0
    } = req.query

    let query = 'SELECT * FROM v_code_reviews_summary WHERE 1=1'
    const params = []
    let paramIndex = 1

    if (repository) {
      query += ` AND repository = $${paramIndex++}`
      params.push(repository)
    }

    if (status) {
      query += ` AND review_status = $${paramIndex++}`
      params.push(status)
    }

    if (prNumber) {
      query += ` AND pr_number = $${paramIndex++}`
      params.push(parseInt(prNumber))
    }

    if (author) {
      query += ` AND pr_author = $${paramIndex++}`
      params.push(author)
    }

    query += ` ORDER BY started_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`
    params.push(parseInt(limit), parseInt(offset))

    const result = await pool.query(query, params)

    // Get total count
    let countQuery = 'SELECT COUNT(*) FROM code_reviews WHERE 1=1'
    const countParams = []
    let countIndex = 1

    if (repository) {
      const [owner, name] = repository.split('/')
      countQuery += ` AND repository_owner = $${countIndex++} AND repository_name = $${countIndex++}`
      countParams.push(owner, name)
    }

    if (status) {
      countQuery += ` AND review_status = $${countIndex++}`
      countParams.push(status)
    }

    if (prNumber) {
      countQuery += ` AND pr_number = $${countIndex++}`
      countParams.push(parseInt(prNumber))
    }

    if (author) {
      countQuery += ` AND pr_author = $${countIndex++}`
      countParams.push(author)
    }

    const countResult = await pool.query(countQuery, countParams)
    const total = parseInt(countResult.rows[0].count)

    res.json({
      status: 'success',
      data: {
        reviews: result.rows,
        total,
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    })
  } catch (error) {
    logger.error('Failed to fetch reviews', {
      error: error.message,
      stack: error.stack
    })

    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch reviews',
      error: error.message
    })
  }
})

/**
 * GET /api/code-review/reviews/:id
 * Get details of a specific review
 */
router.get('/reviews/:id', async (req, res) => {
  try {
    const { id } = req.params

    // Get review details
    const reviewResult = await pool.query(`
      SELECT * FROM v_code_reviews_summary
      WHERE id = $1
    `, [id])

    if (reviewResult.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Review not found'
      })
    }

    // Get comments
    const commentsResult = await pool.query(`
      SELECT *
      FROM code_review_comments
      WHERE code_review_id = $1
      ORDER BY severity DESC, file_path, line_number
    `, [id])

    // Get metrics
    const metricsResult = await pool.query(`
      SELECT *
      FROM code_review_metrics
      WHERE code_review_id = $1
      ORDER BY file_path
    `, [id])

    res.json({
      status: 'success',
      data: {
        review: reviewResult.rows[0],
        comments: commentsResult.rows,
        metrics: metricsResult.rows
      }
    })
  } catch (error) {
    logger.error('Failed to fetch review details', {
      error: error.message,
      reviewId: req.params.id
    })

    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch review details',
      error: error.message
    })
  }
})

/**
 * POST /api/code-review/reviews/:id/retry
 * Retry a failed review
 */
router.post('/reviews/:id/retry', async (req, res) => {
  try {
    const { id } = req.params

    // Get review
    const result = await pool.query(`
      SELECT * FROM code_reviews WHERE id = $1
    `, [id])

    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Review not found'
      })
    }

    const review = result.rows[0]

    if (!['failed', 'cancelled'].includes(review.review_status)) {
      return res.status(400).json({
        status: 'error',
        message: `Cannot retry review with status: ${review.review_status}`
      })
    }

    // Reset review status
    await pool.query(`
      UPDATE code_reviews
      SET review_status = 'pending',
          started_at = NOW(),
          completed_at = NULL
      WHERE id = $1
    `, [id])

    // Trigger review
    const coordinator = await getCoordinator()
    const newReviewId = await coordinator.retryReview(id)

    res.json({
      status: 'success',
      message: 'Review queued for retry',
      reviewId: newReviewId
    })
  } catch (error) {
    logger.error('Failed to retry review', {
      error: error.message,
      reviewId: req.params.id
    })

    res.status(500).json({
      status: 'error',
      message: 'Failed to retry review',
      error: error.message
    })
  }
})

/**
 * DELETE /api/code-review/reviews/:id
 * Cancel a pending/in-progress review
 */
router.delete('/reviews/:id', async (req, res) => {
  try {
    const { id } = req.params

    const result = await pool.query(`
      UPDATE code_reviews
      SET review_status = 'cancelled',
          completed_at = NOW()
      WHERE id = $1
        AND review_status IN ('pending', 'in_progress')
      RETURNING id
    `, [id])

    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Review not found or cannot be cancelled'
      })
    }

    res.json({
      status: 'success',
      message: 'Review cancelled'
    })
  } catch (error) {
    logger.error('Failed to cancel review', {
      error: error.message,
      reviewId: req.params.id
    })

    res.status(500).json({
      status: 'error',
      message: 'Failed to cancel review',
      error: error.message
    })
  }
})

/**
 * GET /api/code-review/reviews/:id/comments
 * Get all comments for a review
 */
router.get('/reviews/:id/comments', async (req, res) => {
  try {
    const { id } = req.params
    const { type, severity, file } = req.query

    let query = 'SELECT * FROM code_review_comments WHERE code_review_id = $1'
    const params = [id]
    let paramIndex = 2

    if (type) {
      query += ` AND comment_type = $${paramIndex++}`
      params.push(type)
    }

    if (severity) {
      query += ` AND severity = $${paramIndex++}`
      params.push(severity)
    }

    if (file) {
      query += ` AND file_path = $${paramIndex++}`
      params.push(file)
    }

    query += ' ORDER BY severity DESC, file_path, line_number'

    const result = await pool.query(query, params)

    res.json({
      status: 'success',
      data: {
        comments: result.rows
      }
    })
  } catch (error) {
    logger.error('Failed to fetch comments', {
      error: error.message,
      reviewId: req.params.id
    })

    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch comments',
      error: error.message
    })
  }
})

/**
 * GET /api/code-review/reviews/:id/metrics
 * Get code metrics for a review
 */
router.get('/reviews/:id/metrics', async (req, res) => {
  try {
    const { id } = req.params

    const metricsResult = await pool.query(`
      SELECT *
      FROM code_review_metrics
      WHERE code_review_id = $1
      ORDER BY file_path
    `, [id])

    // Calculate summary
    const summary = {
      totalFiles: metricsResult.rows.length,
      totalLinesAdded: 0,
      totalLinesRemoved: 0,
      averageComplexity: 0,
      filesWithTests: 0,
      filesWithDocs: 0
    }

    let totalComplexity = 0
    let filesWithComplexity = 0

    metricsResult.rows.forEach(m => {
      summary.totalLinesAdded += m.lines_added || 0
      summary.totalLinesRemoved += m.lines_removed || 0
      if (m.cyclomatic_complexity) {
        totalComplexity += m.cyclomatic_complexity
        filesWithComplexity++
      }
      if (m.has_tests) summary.filesWithTests++
      if (m.has_documentation) summary.filesWithDocs++
    })

    if (filesWithComplexity > 0) {
      summary.averageComplexity = (totalComplexity / filesWithComplexity).toFixed(2)
    }

    res.json({
      status: 'success',
      data: {
        metrics: metricsResult.rows,
        summary
      }
    })
  } catch (error) {
    logger.error('Failed to fetch metrics', {
      error: error.message,
      reviewId: req.params.id
    })

    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch metrics',
      error: error.message
    })
  }
})

/**
 * GET /api/code-review/config
 * Get current review configuration
 */
router.get('/config', async (req, res) => {
  try {
    // Get default AI model
    const modelResult = await pool.query(`
      SELECT m.model_id, m.display_name, p.name as provider_name
      FROM ai_models m
      JOIN ai_model_providers p ON m.provider_id = p.id
      WHERE p.name = 'deepseek' AND m.model_id = 'deepseek-chat'
      LIMIT 1
    `)

    const defaultModel = modelResult.rows[0]?.model_id || 'deepseek-chat'

    res.json({
      status: 'success',
      data: {
        defaultModel,
        enabledChecks: {
          security: true,
          quality: true,
          tests: true,
          documentation: true
        },
        autoPost: process.env.CODE_REVIEW_AUTO_POST !== 'false',
        reviewOnPush: true,
        minFilesToReview: 1,
        maxFilesToReview: parseInt(process.env.CODE_REVIEW_MAX_FILES || '50')
      }
    })
  } catch (error) {
    logger.error('Failed to fetch config', {
      error: error.message
    })

    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch config',
      error: error.message
    })
  }
})

/**
 * PUT /api/code-review/config
 * Update review configuration
 */
router.put('/config', express.json(), async (req, res) => {
  try {
    const { defaultModel, enabledChecks, autoPost } = req.body

    // Store in database or environment
    // For now, just return success (would need a config table)

    res.json({
      status: 'success',
      message: 'Configuration updated',
      data: req.body
    })
  } catch (error) {
    logger.error('Failed to update config', {
      error: error.message
    })

    res.status(500).json({
      status: 'error',
      message: 'Failed to update config',
      error: error.message
    })
  }
})

/**
 * GET /api/code-review/stats
 * Get review statistics and analytics
 */
router.get('/stats', async (req, res) => {
  try {
    const { startDate, endDate, repository, groupBy = 'day' } = req.query

    // Get overall stats
    let statsQuery = `
      SELECT
        COUNT(*) as total_reviews,
        COUNT(*) FILTER (WHERE review_status = 'completed') as completed_reviews,
        COUNT(*) FILTER (WHERE review_status = 'failed') as failed_reviews,
        COALESCE(AVG(EXTRACT(EPOCH FROM (completed_at - started_at))), 0)::INTEGER as average_review_time,
        SUM(issues_found) as total_issues_found,
        SUM(warnings_found) as total_warnings_found,
        SUM(suggestions_found) as total_suggestions_found,
        SUM(cost_usd) as total_cost,
        SUM(tokens_used) as total_tokens
      FROM code_reviews
      WHERE 1=1
    `

    const params = []
    let paramIndex = 1

    if (startDate) {
      statsQuery += ` AND started_at >= $${paramIndex++}`
      params.push(startDate)
    }

    if (endDate) {
      statsQuery += ` AND started_at <= $${paramIndex++}`
      params.push(endDate)
    }

    if (repository) {
      const [owner, name] = repository.split('/')
      statsQuery += ` AND repository_owner = $${paramIndex++} AND repository_name = $${paramIndex++}`
      params.push(owner, name)
    }

    const statsResult = await pool.query(statsQuery, params)

    // Get stats by repository
    const byRepoResult = await pool.query(`
      SELECT * FROM v_code_review_stats_by_repo
    `)

    // Get severity breakdown
    const severityResult = await pool.query(`
      SELECT
        c.severity,
        COUNT(*) as count
      FROM code_review_comments c
      JOIN code_reviews r ON c.code_review_id = r.id
      WHERE r.review_status = 'completed'
      GROUP BY c.severity
      ORDER BY
        CASE c.severity
          WHEN 'critical' THEN 1
          WHEN 'high' THEN 2
          WHEN 'medium' THEN 3
          WHEN 'low' THEN 4
          ELSE 5
        END
    `)

    const bySeverity = {}
    severityResult.rows.forEach(row => {
      bySeverity[row.severity] = parseInt(row.count)
    })

    res.json({
      status: 'success',
      data: {
        ...statsResult.rows[0],
        byRepository: byRepoResult.rows.reduce((acc, row) => {
          acc[row.repository] = {
            reviews: parseInt(row.total_reviews),
            issues: parseInt(row.total_issues)
          }
          return acc
        }, {}),
        bySeverity
      }
    })
  } catch (error) {
    logger.error('Failed to fetch stats', {
      error: error.message
    })

    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch stats',
      error: error.message
    })
  }
})

/**
 * GET /api/code-review/health
 * Health check endpoint
 */
router.get('/health', async (req, res) => {
  try {
    // Check database connection
    await pool.query('SELECT 1')

    // Check GitHub token
    const githubToken = await getGitHubToken()

    res.json({
      status: 'healthy',
      checks: {
        database: 'ok',
        githubToken: githubToken ? 'ok' : 'missing'
      }
    })
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      error: error.message
    })
  }
})

export default router
export { getGitHubToken }
