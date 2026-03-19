/**
 * Aero Monitoring - Missions API Routes
 * Part of Issue #5196 - Этап 2: Управление флотом дронов
 *
 * Manages flight missions and mission data
 *
 * Integram Tables (in dmonitor database):
 * - Дроны (ID: 298) - Created, but no columns due to base type restriction
 * - Миссии (ID: TBD) - Not created yet
 * - Данные миссий (ID: TBD) - Not created yet
 * - Телеметрия (ID: TBD) - Not created yet
 * - Отчеты (ID: TBD) - Not created yet
 *
 * NOTE: Currently using mock data due to Integram base type restriction issue.
 * See backend/monolith/examples/AERO_TABLES_STATUS.md for details.
 * Database needs to be configured to allow standard requisite types.
 */

import express from 'express'
import logger from '../../utils/logger.js'

export function createAeroMissionsRoutes() {
  const router = express.Router()

  // Integram table configuration
  const INTEGRAM_DATABASE = 'dmonitor'
  const MISSIONS_TABLE_ID = null // TBD - not created yet due to base type restriction

  // Mock missions data
  const mockMissions = [
    {
      id: 1,
      name: 'Обследование поля №1',
      description: 'Аэрофотосъемка пшеничного поля',
      drone_id: 1,
      route: JSON.stringify({type: 'FeatureCollection', features: []}),
      altitude: 120,
      speed: 5,
      overlap: 75,
      status: 'Completed',
      created_at: new Date('2025-12-15').toISOString(),
      completed_at: new Date('2025-12-15T14:30:00').toISOString()
    },
    {
      id: 2,
      name: 'Мониторинг участка №5',
      description: 'Контроль роста культур',
      drone_id: 3,
      route: JSON.stringify({type: 'FeatureCollection', features: []}),
      altitude: 100,
      speed: 4,
      overlap: 80,
      status: 'In Progress',
      created_at: new Date('2025-12-22').toISOString(),
      completed_at: null
    }
  ]

  // Get all missions
  router.get('/', async (req, res, next) => {
    try {
      const { status, drone_id } = req.query
      let missions = mockMissions

      if (status) missions = missions.filter(m => m.status === status)
      if (drone_id) missions = missions.filter(m => m.drone_id === parseInt(drone_id))

      // Format response to match frontend expectations (Integram format)
      const formattedData = missions.map(m => ({
        id: m.id.toString(),
        val: m.name
      }))

      const reqs = {}
      missions.forEach(m => {
        reqs[m.id] = {
          description: m.description,
          droneId: m.drone_id,
          route: m.route,
          polygon: m.polygon || null,
          altitude: m.altitude,
          speed: m.speed,
          overlap: m.overlap,
          cameraAngle: m.camera_angle || 0,
          status: m.status,
          scheduledDate: m.scheduled_date,
          calculatedStats: m.calculated_stats,
          createdAt: m.created_at,
          completedAt: m.completed_at
        }
      })

      res.json({
        success: true,
        data: formattedData,
        reqs,
        _meta: { database: INTEGRAM_DATABASE, table_id: MISSIONS_TABLE_ID, using_mock_data: true }
      })
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to get missions')
      next(error)
    }
  })

  // Get mission by ID
  router.get('/:id', async (req, res, next) => {
    try {
      const mission = mockMissions.find(m => m.id === parseInt(req.params.id))
      if (!mission) {
        return res.status(404).json({ success: false, error: 'Mission not found' })
      }
      res.json({ success: true, mission, _meta: { using_mock_data: true } })
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to get mission')
      next(error)
    }
  })

  // Create mission
  router.post('/', async (req, res, next) => {
    try {
      const { name, description, drone_id, route, altitude, speed, overlap } = req.body

      if (!name || !drone_id) {
        return res.status(400).json({ success: false, error: 'Missing required fields: name, drone_id' })
      }

      const newMission = {
        id: Math.max(...mockMissions.map(m => m.id), 0) + 1,
        name, description: description || '', drone_id, route: route || '{}',
        altitude: altitude || 100, speed: speed || 5, overlap: overlap || 75,
        status: 'Draft', created_at: new Date().toISOString(), completed_at: null
      }

      mockMissions.push(newMission)
      res.status(201).json({ success: true, mission: newMission, _meta: { using_mock_data: true } })
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to create mission')
      next(error)
    }
  })

  // Update mission
  router.put('/:id', async (req, res, next) => {
    try {
      const missionIndex = mockMissions.findIndex(m => m.id === parseInt(req.params.id))
      if (missionIndex === -1) {
        return res.status(404).json({ success: false, error: 'Mission not found' })
      }

      mockMissions[missionIndex] = { ...mockMissions[missionIndex], ...req.body }
      res.json({ success: true, mission: mockMissions[missionIndex], _meta: { using_mock_data: true } })
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to update mission')
      next(error)
    }
  })

  // Delete mission
  router.delete('/:id', async (req, res, next) => {
    try {
      const missionIndex = mockMissions.findIndex(m => m.id === parseInt(req.params.id))
      if (missionIndex === -1) {
        return res.status(404).json({ success: false, error: 'Mission not found' })
      }

      const deletedMission = mockMissions.splice(missionIndex, 1)[0]
      res.json({ success: true, message: 'Mission deleted', mission: deletedMission, _meta: { using_mock_data: true } })
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to delete mission')
      next(error)
    }
  })

  // Update mission status
  router.patch('/:id/status', async (req, res, next) => {
    try {
      const missionIndex = mockMissions.findIndex(m => m.id === parseInt(req.params.id))
      if (missionIndex === -1) {
        return res.status(404).json({ success: false, error: 'Mission not found' })
      }

      const { status } = req.body
      if (!status) {
        return res.status(400).json({ success: false, error: 'Status is required' })
      }

      mockMissions[missionIndex].status = status
      res.json({ success: true, mission: mockMissions[missionIndex], _meta: { using_mock_data: true } })
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to update mission status')
      next(error)
    }
  })

  // Calculate mission parameters
  router.post('/calculate', async (req, res, next) => {
    try {
      const { route, polygon, altitude, speed, overlap } = req.body

      // Simple mock calculation (frontend does the actual calculation)
      const mockCalculation = {
        distance: 5000, // meters
        flightTime: 25, // minutes
        batteryCount: 1,
        photoCount: 120,
        area: { sqMeters: 50000, hectares: 5, sqKm: 0.05 }
      }

      res.json({ success: true, data: mockCalculation, _meta: { using_mock_data: true } })
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to calculate mission')
      next(error)
    }
  })

  // Generate mission route (auto-generate flight grid)
  router.post('/:id/generate-route', async (req, res, next) => {
    try {
      const mission = mockMissions.find(m => m.id === parseInt(req.params.id))
      if (!mission) {
        return res.status(404).json({ success: false, error: 'Mission not found' })
      }

      // Mock route generation (frontend does the actual generation)
      const generatedRoute = {
        type: 'LineString',
        coordinates: [
          [37.6173, 55.7558],
          [37.6183, 55.7568],
          [37.6193, 55.7578]
        ]
      }

      res.json({ success: true, data: generatedRoute, _meta: { using_mock_data: true } })
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to generate route')
      next(error)
    }
  })

  // Get mission route (GeoJSON)
  router.get('/:id/route', async (req, res, next) => {
    try {
      const mission = mockMissions.find(m => m.id === parseInt(req.params.id))
      if (!mission) {
        return res.status(404).json({ success: false, error: 'Mission not found' })
      }

      const route = mission.route ? JSON.parse(mission.route) : null
      res.json({ success: true, data: route, _meta: { using_mock_data: true } })
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to get mission route')
      next(error)
    }
  })

  // Launch mission (start flight)
  router.post('/:id/launch', async (req, res, next) => {
    try {
      const missionIndex = mockMissions.findIndex(m => m.id === parseInt(req.params.id))
      if (missionIndex === -1) {
        return res.status(404).json({ success: false, error: 'Mission not found' })
      }

      mockMissions[missionIndex].status = 'InFlight'
      logger.info({ missionId: req.params.id }, 'Mission launched')

      res.json({
        success: true,
        message: 'Mission launched successfully',
        mission: mockMissions[missionIndex],
        _meta: { using_mock_data: true }
      })
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to launch mission')
      next(error)
    }
  })

  // Stop mission (abort flight)
  router.post('/:id/stop', async (req, res, next) => {
    try {
      const missionIndex = mockMissions.findIndex(m => m.id === parseInt(req.params.id))
      if (missionIndex === -1) {
        return res.status(404).json({ success: false, error: 'Mission not found' })
      }

      mockMissions[missionIndex].status = 'Cancelled'
      mockMissions[missionIndex].completed_at = new Date().toISOString()
      logger.info({ missionId: req.params.id }, 'Mission stopped')

      res.json({
        success: true,
        message: 'Mission stopped successfully',
        mission: mockMissions[missionIndex],
        _meta: { using_mock_data: true }
      })
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to stop mission')
      next(error)
    }
  })

  return router
}

export default createAeroMissionsRoutes
