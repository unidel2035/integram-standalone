/**
 * FST REST API Server
 *
 * REST API для интеграции платформы ФСТ с внешними системами:
 * - Госуслуги, СПАРК, Сколково, министерства
 *
 * Endpoints:
 * - Portfolio: GET /api/fst/portfolio, /company/:id, /kpis
 * - Applications: POST /api/fst/apply, GET /application/:id
 * - Webhooks: POST /api/fst/webhook/egrul, /webhook/rospatent, /webhook/hh
 */

import express from 'express'
import cors from 'cors'
import rateLimit from 'express-rate-limit'
import swaggerUi from 'swagger-ui-express'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

// Import route handlers
import portfolioRoutes from './api/routes/portfolio.js'
import applicationsRoutes from './api/routes/applications.js'
import webhooksRoutes from './api/routes/webhooks.js'
import glossaryRoutes from './api/routes/glossary.js'
import platformRoutes from './api/routes/platform.js'
import startuperRouter from './api/routes/startuper.js'
import { authenticateApiToken, validateWebhookSecret } from './api/middleware/auth.js'
import { startAgentSchoolTrainer } from './schedulers/agentSchoolTrainer.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const app = express()
const PORT = process.env.FST_API_PORT || 3100

// Middleware
app.use(cors())
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))

// Rate limiting для партнёров: 1000 req/day
const apiLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  max: 1000,
  message: { error: 'Rate limit exceeded. Maximum 1000 requests per day.' },
  standardHeaders: true,
  legacyHeaders: false,
})

// Logging middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString()
  console.log(`[${timestamp}] ${req.method} ${req.path}`)
  next()
})

// Health check (no auth required)
app.get('/api/fst/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'FST REST API',
    version: '1.0.0'
  })
})

// OpenAPI / Swagger Documentation
let openApiSpec
try {
  const specPath = join(__dirname, 'api', 'openapi.json')
  openApiSpec = JSON.parse(readFileSync(specPath, 'utf8'))

  app.use('/api/fst/docs', swaggerUi.serve, swaggerUi.setup(openApiSpec, {
    customSiteTitle: 'FST API Documentation',
    customCss: '.swagger-ui .topbar { display: none }',
  }))

  console.log('[FST API] Swagger UI available at /api/fst/docs')
} catch (error) {
  console.warn('[FST API] OpenAPI spec not found, Swagger UI disabled')
}

// Portfolio endpoints (public with auth token)
app.use('/api/fst', apiLimiter, authenticateApiToken, portfolioRoutes)

// Applications endpoints (public with auth token)
app.use('/api/fst', apiLimiter, authenticateApiToken, applicationsRoutes)

// Glossary endpoints (public with auth token) - MCP Tool for AI agents
app.use('/api/fst', apiLimiter, authenticateApiToken, glossaryRoutes)

// Webhook endpoints (с webhook secret validation)
app.use('/api/fst/webhook', validateWebhookSecret, webhooksRoutes)

// Glossary endpoints (public - no auth required for MCP tools)
app.use('/api/glossary', glossaryRoutes)

// Platform manifest endpoints (public - no auth required for AI agents / MCP)
// MCP tools: get_platform_manifest, get_page_manifest, get_available_actions
app.use('/api/platform', platformRoutes)

// Startuper agent — intake form assistant, doc parsing, psycho profiling
app.use('/api/startuper', startuperRouter)

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Endpoint ${req.method} ${req.path} does not exist`,
    documentation: '/api/fst/docs'
  })
})

// Error handler
app.use((err, req, res, next) => {
  console.error('[FST API] Error:', err)

  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  })
})

// Start server
app.listen(PORT, () => {
  console.log(`[FST API] Server running on port ${PORT}`)
  console.log(`[FST API] Documentation: http://localhost:${PORT}/api/fst/docs`)
  console.log(`[FST API] Health check: http://localhost:${PORT}/api/fst/health`)

  // Start autonomous agent training
  startAgentSchoolTrainer()
})

export default app
