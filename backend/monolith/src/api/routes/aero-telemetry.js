import express from 'express'

const router = express.Router()

/**
 * GET /api/aero/telemetry/history/:droneId
 * Get telemetry history for a specific drone
 */
router.get('/history/:droneId', (req, res) => {
  try {
    const { droneId } = req.params
    const limit = parseInt(req.query.limit) || 100

    const telemetryService = req.app.get('telemetryService')
    if (!telemetryService) {
      return res.status(503).json({
        success: false,
        error: 'Telemetry service not available'
      })
    }

    const history = telemetryService.getTelemetryHistory(droneId, limit)

    res.json({
      success: true,
      droneId,
      count: history.length,
      history
    })
  } catch (error) {
    console.error('[Aero Telemetry] Error getting history:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * POST /api/aero/telemetry/record
 * Record a telemetry point (for external systems)
 */
router.post('/record', (req, res) => {
  try {
    const { droneId, telemetryData } = req.body

    if (!droneId || !telemetryData) {
      return res.status(400).json({
        success: false,
        error: 'droneId and telemetryData are required'
      })
    }

    const telemetryService = req.app.get('telemetryService')
    if (!telemetryService) {
      return res.status(503).json({
        success: false,
        error: 'Telemetry service not available'
      })
    }

    telemetryService.broadcastTelemetry(droneId, telemetryData)

    res.json({
      success: true,
      message: 'Telemetry recorded and broadcasted'
    })
  } catch (error) {
    console.error('[Aero Telemetry] Error recording telemetry:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * POST /api/aero/telemetry/simulation/start
 * Start telemetry simulation for a drone
 */
router.post('/simulation/start', async (req, res) => {
  try {
    const { droneId, missionRoute, updateInterval } = req.body

    if (!droneId || !missionRoute || !Array.isArray(missionRoute)) {
      return res.status(400).json({
        success: false,
        error: 'droneId and missionRoute (array) are required'
      })
    }

    const telemetryService = req.app.get('telemetryService')
    if (!telemetryService) {
      return res.status(503).json({
        success: false,
        error: 'Telemetry service not available'
      })
    }

    // Create drone object
    const drone = {
      id: droneId,
      name: `Drone #${droneId}`
    }

    telemetryService.startSimulation(drone, missionRoute, updateInterval || 1000)

    res.json({
      success: true,
      message: `Simulation started for drone ${droneId}`,
      droneId,
      routeLength: missionRoute.length,
      updateInterval: updateInterval || 1000
    })
  } catch (error) {
    console.error('[Aero Telemetry] Error starting simulation:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * POST /api/aero/telemetry/simulation/stop
 * Stop telemetry simulation for a drone
 */
router.post('/simulation/stop', (req, res) => {
  try {
    const { droneId } = req.body

    if (!droneId) {
      return res.status(400).json({
        success: false,
        error: 'droneId is required'
      })
    }

    const telemetryService = req.app.get('telemetryService')
    if (!telemetryService) {
      return res.status(503).json({
        success: false,
        error: 'Telemetry service not available'
      })
    }

    telemetryService.stopSimulation(droneId)

    res.json({
      success: true,
      message: `Simulation stopped for drone ${droneId}`
    })
  } catch (error) {
    console.error('[Aero Telemetry] Error stopping simulation:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * GET /api/aero/telemetry/stats
 * Get telemetry service statistics
 */
router.get('/stats', (req, res) => {
  try {
    const telemetryService = req.app.get('telemetryService')
    if (!telemetryService) {
      return res.status(503).json({
        success: false,
        error: 'Telemetry service not available'
      })
    }

    const stats = telemetryService.getStats()

    res.json({
      success: true,
      stats
    })
  } catch (error) {
    console.error('[Aero Telemetry] Error getting stats:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * DELETE /api/aero/telemetry/history/:droneId
 * Clear telemetry history for a drone
 */
router.delete('/history/:droneId', (req, res) => {
  try {
    const { droneId } = req.params

    const telemetryService = req.app.get('telemetryService')
    if (!telemetryService) {
      return res.status(503).json({
        success: false,
        error: 'Telemetry service not available'
      })
    }

    telemetryService.clearHistory(droneId)

    res.json({
      success: true,
      message: `Telemetry history cleared for drone ${droneId}`
    })
  } catch (error) {
    console.error('[Aero Telemetry] Error clearing history:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

export default router
