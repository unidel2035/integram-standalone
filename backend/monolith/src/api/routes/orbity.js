/**
 * Orbity API Routes
 *
 * Provides endpoints for Orbity platform operations
 * Issue #2990 - Orbity: Stage 1 - Basic Infrastructure
 */

import express from 'express'
import { OrbityDatabaseSetupService } from '../../services/integram/OrbityDatabaseSetupService.js'

const router = express.Router()

/**
 * POST /api/orbity/setup
 * Initialize Orbity database structure
 */
router.post('/setup', async (req, res) => {
  try {
    const { login, password } = req.body

    if (!login || !password) {
      return res.status(400).json({
        success: false,
        error: 'Login and password are required'
      })
    }

    const setupService = new OrbityDatabaseSetupService()

    // Initialize with credentials
    const initResult = await setupService.initialize(login, password)

    if (!initResult.success) {
      return res.status(401).json({
        success: false,
        error: initResult.error
      })
    }

    // Run database setup
    const setupResult = await setupService.setupDatabase()

    if (setupResult.success) {
      res.json({
        success: true,
        message: setupResult.message,
        createdTypes: setupResult.createdTypes,
        types: setupResult.types
      })
    } else {
      res.status(500).json({
        success: false,
        error: setupResult.error,
        createdTypes: setupResult.createdTypes
      })
    }
  } catch (error) {
    console.error('[Orbity Setup] Error:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * GET /api/orbity/status
 * Check Orbity database setup status
 */
router.get('/status', async (req, res) => {
  try {
    const setupService = new OrbityDatabaseSetupService()

    // Would need authentication here
    // For now returning basic status
    res.json({
      success: true,
      isSetup: false,
      message: 'Status check not yet implemented. Please run setup first.'
    })
  } catch (error) {
    console.error('[Orbity Status] Error:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

export default router
