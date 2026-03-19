// onec-agent.js - API routes for 1C Integration Agent
import express from 'express'
import { OneCAgent } from '../../agents/OneCAgent.js'

const router = express.Router()

/**
 * POST /api/onec-agent/discover
 * Discover 1C metadata (entities, catalogs, documents)
 */
router.post('/discover', async (req, res) => {
  try {
    const { baseUrl, auth, connectionType, database } = req.body

    if (!baseUrl) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: baseUrl'
      })
    }

    const agent = new OneCAgent({
      baseUrl,
      auth,
      connectionType: connectionType || 'odata',
      database
    })

    const result = await agent.execute({
      operation: 'discover'
    })

    res.json({
      success: true,
      data: result
    })
  } catch (error) {
    console.error('Discovery error:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * POST /api/onec-agent/test
 * Test connection to 1C
 */
router.post('/test', async (req, res) => {
  try {
    const { baseUrl, auth, connectionType, database } = req.body

    if (!baseUrl) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: baseUrl'
      })
    }

    const agent = new OneCAgent({
      baseUrl,
      auth,
      connectionType: connectionType || 'odata',
      database
    })

    const result = await agent.execute({
      operation: 'test'
    })

    res.json({
      success: true,
      data: result
    })
  } catch (error) {
    console.error('Test connection error:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * POST /api/onec-agent/pull
 * Pull data from 1C
 */
router.post('/pull', async (req, res) => {
  try {
    const { baseUrl, auth, connectionType, database, entityName, filter, select, top, skip } = req.body

    if (!baseUrl || !entityName) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: baseUrl, entityName'
      })
    }

    const agent = new OneCAgent({
      baseUrl,
      auth,
      connectionType: connectionType || 'odata',
      database
    })

    const result = await agent.execute({
      operation: 'pull',
      entityName,
      filter,
      select,
      top,
      skip
    })

    res.json({
      success: true,
      data: result
    })
  } catch (error) {
    console.error('Pull data error:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * POST /api/onec-agent/push
 * Push data to 1C
 */
router.post('/push', async (req, res) => {
  try {
    const { baseUrl, auth, connectionType, database, entityName, data, method } = req.body

    if (!baseUrl || !entityName || !data) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: baseUrl, entityName, data'
      })
    }

    const agent = new OneCAgent({
      baseUrl,
      auth,
      connectionType: connectionType || 'odata',
      database
    })

    const result = await agent.execute({
      operation: 'push',
      entityName,
      data,
      method: method || 'POST'
    })

    res.json({
      success: true,
      data: result
    })
  } catch (error) {
    console.error('Push data error:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * POST /api/onec-agent/sync
 * Synchronize data with 1C (bidirectional)
 */
router.post('/sync', async (req, res) => {
  try {
    const { baseUrl, auth, connectionType, database, entityName, localData, remoteKey } = req.body

    if (!baseUrl || !entityName || !localData || !remoteKey) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: baseUrl, entityName, localData, remoteKey'
      })
    }

    const agent = new OneCAgent({
      baseUrl,
      auth,
      connectionType: connectionType || 'odata',
      database
    })

    const result = await agent.execute({
      operation: 'sync',
      entityName,
      localData,
      remoteKey
    })

    res.json({
      success: true,
      data: result
    })
  } catch (error) {
    console.error('Sync data error:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * POST /api/onec-agent/create-document
 * Create a document in 1C
 */
router.post('/create-document', async (req, res) => {
  try {
    const { baseUrl, auth, connectionType, database, documentType, data } = req.body

    if (!baseUrl || !documentType || !data) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: baseUrl, documentType, data'
      })
    }

    const agent = new OneCAgent({
      baseUrl,
      auth,
      connectionType: connectionType || 'odata',
      database
    })

    const result = await agent.execute({
      operation: 'createDocument',
      documentType,
      data
    })

    res.json({
      success: true,
      data: result
    })
  } catch (error) {
    console.error('Create document error:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * POST /api/onec-agent/get-catalog
 * Get catalog from 1C
 */
router.post('/get-catalog', async (req, res) => {
  try {
    const { baseUrl, auth, connectionType, database, catalogName, filter } = req.body

    if (!baseUrl || !catalogName) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: baseUrl, catalogName'
      })
    }

    const agent = new OneCAgent({
      baseUrl,
      auth,
      connectionType: connectionType || 'odata',
      database
    })

    const result = await agent.execute({
      operation: 'getCatalog',
      catalogName,
      filter
    })

    res.json({
      success: true,
      data: result
    })
  } catch (error) {
    console.error('Get catalog error:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * POST /api/onec-agent/get-report
 * Get report from 1C
 */
router.post('/get-report', async (req, res) => {
  try {
    const { baseUrl, auth, connectionType, database, reportName, parameters } = req.body

    if (!baseUrl || !reportName) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: baseUrl, reportName'
      })
    }

    const agent = new OneCAgent({
      baseUrl,
      auth,
      connectionType: connectionType || 'odata',
      database
    })

    const result = await agent.execute({
      operation: 'getReport',
      reportName,
      parameters
    })

    res.json({
      success: true,
      data: result
    })
  } catch (error) {
    console.error('Get report error:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * GET /api/onec-agent/health
 * Health check endpoint
 */
router.get('/health', (req, res) => {
  res.json({
    success: true,
    service: 'onec-agent',
    status: 'healthy',
    timestamp: new Date().toISOString()
  })
})

export default router
