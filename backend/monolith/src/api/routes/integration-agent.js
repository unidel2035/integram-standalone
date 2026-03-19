// integration-agent.js - Routes for DocumentationScraperAgent
// Issue #1277 - API endpoints for service integration agent

import express from 'express'
import { pool } from '../../config/database.js'
import { DocumentationScraperAgent } from '../../agents/DocumentationScraperAgent.js'
import { TokenBasedLLMCoordinator } from '../../core/TokenBasedLLMCoordinator.js'

const router = express.Router()

// Initialize LLM coordinator
const llmCoordinator = new TokenBasedLLMCoordinator({ db: pool })

/**
 * POST /api/integration-agent/scrape-docs
 * Scrape API documentation from a URL
 */
router.post('/scrape-docs', async (req, res, next) => {
    try {
      const { url, accessToken, userId, maxPages } = req.body

      if (!url) {
        return res.status(400).json({ error: 'URL is required' })
      }

      if (!accessToken) {
        return res.status(400).json({ error: 'Access token is required' })
      }

      // Create agent instance
      const agent = new DocumentationScraperAgent({
        llmCoordinator,
        db: pool,
        maxDocPages: maxPages || 5
      })

      await agent.initialize()

      // Execute scraping
      const result = await agent._execute({
        operation: 'scrape_docs',
        url,
        accessToken,
        userId: userId || 'anonymous'
      })

      res.json({
        success: true,
        data: result
      })
    } catch (error) {
      next(error)
    }
  })

/**
 * POST /api/integration-agent/analyze-api
 * Analyze API documentation using AI
 */
router.post('/analyze-api', async (req, res, next) => {
    try {
      const { docs, accessToken, userId } = req.body

      if (!docs || !Array.isArray(docs)) {
        return res.status(400).json({ error: 'Documentation pages array is required' })
      }

      if (!accessToken) {
        return res.status(400).json({ error: 'Access token is required' })
      }

      const agent = new DocumentationScraperAgent({
        llmCoordinator,
        db: pool
      })

      await agent.initialize()

      const result = await agent._execute({
        operation: 'analyze_api',
        docs,
        accessToken,
        userId: userId || 'anonymous'
      })

      res.json({
        success: true,
        data: result
      })
    } catch (error) {
      next(error)
    }
  })

/**
   * POST /api/integration-agent/generate-integration
   * Generate integration code and mappings
   */
router.post('/generate-integration', async (req, res, next) => {
    try {
      const { apiInfo, accessToken, userId, serviceName } = req.body

      if (!apiInfo) {
        return res.status(400).json({ error: 'API information is required' })
      }

      if (!accessToken) {
        return res.status(400).json({ error: 'Access token is required' })
      }

      const agent = new DocumentationScraperAgent({
        llmCoordinator,
        db: pool
      })

      await agent.initialize()

      const result = await agent._execute({
        operation: 'generate_integration',
        apiInfo,
        accessToken,
        userId: userId || 'anonymous',
        serviceName: serviceName || 'Unknown Service'
      })

      res.json({
        success: true,
        data: result
      })
    } catch (error) {
      next(error)
    }
  })

/**
   * POST /api/integration-agent/test-endpoints
   * Test generated API endpoints
   */
router.post('/test-endpoints', async (req, res, next) => {
    try {
      const { endpoints, authentication } = req.body

      if (!endpoints || !Array.isArray(endpoints)) {
        return res.status(400).json({ error: 'Endpoints array is required' })
      }

      const agent = new DocumentationScraperAgent({
        llmCoordinator,
        db: pool
      })

      await agent.initialize()

      const result = await agent._execute({
        operation: 'test_endpoints',
        endpoints,
        authentication: authentication || null
      })

      res.json({
        success: true,
        data: result
      })
    } catch (error) {
      next(error)
    }
  })

/**
   * POST /api/integration-agent/collect-data
   * Collect data from integrated service
   */
router.post('/collect-data', async (req, res, next) => {
    try {
      const { endpoint, authentication, parameters, tableId } = req.body

      if (!endpoint) {
        return res.status(400).json({ error: 'Endpoint URL is required' })
      }

      const agent = new DocumentationScraperAgent({
        llmCoordinator,
        db: pool
      })

      await agent.initialize()

      const result = await agent._execute({
        operation: 'collect_data',
        endpoint,
        authentication: authentication || null,
        parameters: parameters || {},
        tableId: tableId || null
      })

      res.json({
        success: true,
        data: result
      })
    } catch (error) {
      next(error)
    }
  })

/**
   * POST /api/integration-agent/full-integration
   * Complete integration workflow: scrape → analyze → generate → test
   */
router.post('/full-integration', async (req, res, next) => {
    try {
      const { url, accessToken, userId, serviceName, tableId } = req.body

      if (!url) {
        return res.status(400).json({ error: 'URL is required' })
      }

      if (!accessToken) {
        return res.status(400).json({ error: 'Access token is required' })
      }

      const agent = new DocumentationScraperAgent({
        llmCoordinator,
        db,
        maxDocPages: 5
      })

      await agent.initialize()

      const result = await agent._execute({
        operation: 'full_integration',
        url,
        accessToken,
        userId: userId || 'anonymous',
        serviceName: serviceName || 'Unknown Service',
        tableId: tableId || null
      })

      res.json({
        success: true,
        data: result
      })
    } catch (error) {
      next(error)
    }
  })

/**
   * GET /api/integration-agent/health
   * Health check endpoint
   */
router.get('/health', (req, res) => {
    res.json({
      success: true,
      service: 'integration-agent',
      status: 'operational',
      timestamp: new Date().toISOString()
    })
  })

export default router
