/**
 * Aero Monitoring - Drones API Routes
 * Part of Issue #5196 - Этап 2: Управление флотом дронов
 * Issue #5263 - Интегрируй https://proxy.drondoc.ru/aero-monitoring с базой данных
 *
 * Manages drone inventory and status information
 *
 * Integram Table: Дроны (ID: 298 in dmonitor database)
 * Database: dmonitor, Credentials: d/d
 *
 * Integration Status: ✅ ACTIVE - Connected to dmonitor Integram database
 */

import express from 'express'
import logger from '../../utils/logger.js'
import AeroDmonitorService from '../../services/aero/AeroDmonitorService.js'

export function createAeroDronesRoutes() {
  const router = express.Router()

  // Integram table configuration
  const INTEGRAM_DATABASE = 'dmonitor'
  const DRONES_TABLE_ID = 298

  // Initialize dmonitor service
  const dmonitorService = new AeroDmonitorService()

  // Mock data store (temporary until Integram requisites are added)
  // In production, this will be replaced with Integram API calls
  const mockDrones = [
    {
      id: 1,
      name: 'DJI Mavic 3',
      model: 'Mavic 3',
      serial_number: 'DJI001',
      status: 'Active',
      last_latitude: 55.7558,
      last_longitude: 37.6173,
      battery_level: 85,
      flight_time: 450,
      last_maintenance: new Date('2025-12-20').toISOString(),
      created_at: new Date('2025-12-01').toISOString()
    },
    {
      id: 2,
      name: 'DJI Phantom 4 Pro',
      model: 'Phantom 4 Pro',
      serial_number: 'DJI002',
      status: 'Maintenance',
      last_latitude: 55.7512,
      last_longitude: 37.6184,
      battery_level: 0,
      flight_time: 320,
      last_maintenance: new Date('2025-12-15').toISOString(),
      created_at: new Date('2025-11-15').toISOString()
    },
    {
      id: 3,
      name: 'DJI Mini 3 Pro',
      model: 'Mini 3 Pro',
      serial_number: 'DJI003',
      status: 'Active',
      last_latitude: 55.7489,
      last_longitude: 37.6209,
      battery_level: 92,
      flight_time: 580,
      last_maintenance: new Date('2025-12-18').toISOString(),
      created_at: new Date('2025-12-10').toISOString()
    }
  ]

  /**
   * Get all drones
   * GET /api/aero/drones
   * Query params:
   *   - status: Filter by status (Active, Maintenance, Retired)
   *   - offset: Pagination offset (default: 0)
   *   - limit: Pagination limit (default: 100)
   */
  router.get('/', async (req, res, next) => {
    try {
      const { status, offset, limit } = req.query

      // Fetch drones from Integram dmonitor database
      let drones = await dmonitorService.getDrones({
        offset: parseInt(offset) || 0,
        limit: parseInt(limit) || 100
      })

      // Filter by status if provided
      if (status) {
        drones = drones.filter(d =>
          d.status === status ||
          (status === 'Active' && d.status === 'Активен') ||
          (status === 'Maintenance' && d.status === 'На обслуживании') ||
          (status === 'Retired' && d.status === 'Списан')
        )
      }

      res.json({
        success: true,
        count: drones.length,
        drones,
        _meta: {
          database: INTEGRAM_DATABASE,
          table_id: DRONES_TABLE_ID,
          using_integram: true
        }
      })
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to get drones from dmonitor')
      next(error)
    }
  })

  /**
   * Get fleet statistics
   * GET /api/aero/drones/stats
   * NOTE: Must be defined BEFORE /:id to prevent "stats" being treated as an ID
   */
  router.get('/stats', async (req, res, next) => {
    try {
      // Get stats from Integram dmonitor database
      const stats = await dmonitorService.getFleetStats()

      res.json({
        success: true,
        data: stats,
        _meta: {
          database: INTEGRAM_DATABASE,
          table_id: DRONES_TABLE_ID,
          using_integram: true
        }
      })
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to get fleet stats from dmonitor')
      next(error)
    }
  })

  /**
   * Get drone by ID
   * GET /api/aero/drones/:id
   */
  router.get('/:id', async (req, res, next) => {
    try {
      const droneId = req.params.id

      // Get drone from Integram dmonitor database
      const drone = await dmonitorService.getDrone(droneId)

      res.json({
        success: true,
        drone,
        _meta: {
          database: INTEGRAM_DATABASE,
          table_id: DRONES_TABLE_ID,
          using_integram: true
        }
      })
    } catch (error) {
      if (error.message === 'Drone not found') {
        return res.status(404).json({
          success: false,
          error: 'Drone not found'
        })
      }

      logger.error({ error: error.message }, 'Failed to get drone from dmonitor')
      next(error)
    }
  })

  /**
   * Create new drone
   * POST /api/aero/drones
   * Body: {
   *   name, model, serial_number, status,
   *   last_latitude, last_longitude, battery_level, flight_time
   * }
   */
  router.post('/', async (req, res, next) => {
    try {
      const {
        name,
        model,
        serial_number,
        serialNumber,
        status = 'Active',
        last_latitude,
        last_longitude,
        battery_level = 100,
        flight_time = 0
      } = req.body

      if (!name || !model || !(serial_number || serialNumber)) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: name, model, serial_number'
        })
      }

      // Create drone in Integram dmonitor database
      const newDrone = await dmonitorService.createDrone({
        name,
        model,
        serial_number: serial_number || serialNumber,
        status,
        last_latitude,
        last_longitude,
        battery_level,
        flight_time
      })

      res.status(201).json({
        success: true,
        data: { id: newDrone.id }, // Return format expected by frontend
        drone: newDrone,
        _meta: {
          database: INTEGRAM_DATABASE,
          table_id: DRONES_TABLE_ID,
          using_integram: true
        }
      })
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to create drone in dmonitor')
      next(error)
    }
  })

  /**
   * Update drone
   * PUT /api/aero/drones/:id
   */
  router.put('/:id', async (req, res, next) => {
    try {
      const droneId = req.params.id

      const {
        name,
        model,
        serial_number,
        serialNumber,
        status,
        last_latitude,
        last_longitude,
        battery_level,
        flight_time,
        last_maintenance
      } = req.body

      // Update drone in Integram dmonitor database
      const updatedDrone = await dmonitorService.updateDrone(droneId, {
        name,
        model,
        serial_number: serial_number || serialNumber,
        status,
        last_latitude,
        last_longitude,
        battery_level,
        flight_time,
        last_maintenance
      })

      res.json({
        success: true,
        drone: updatedDrone,
        _meta: {
          database: INTEGRAM_DATABASE,
          table_id: DRONES_TABLE_ID,
          using_integram: true
        }
      })
    } catch (error) {
      if (error.message === 'Drone not found') {
        return res.status(404).json({
          success: false,
          error: 'Drone not found'
        })
      }

      logger.error({ error: error.message }, 'Failed to update drone in dmonitor')
      next(error)
    }
  })

  /**
   * Delete drone
   * DELETE /api/aero/drones/:id
   */
  router.delete('/:id', async (req, res, next) => {
    try {
      const droneId = req.params.id

      // Delete drone from Integram dmonitor database
      const result = await dmonitorService.deleteDrone(droneId)

      res.json({
        success: true,
        message: 'Drone deleted successfully',
        _meta: {
          database: INTEGRAM_DATABASE,
          table_id: DRONES_TABLE_ID,
          using_integram: true
        }
      })
    } catch (error) {
      if (error.message === 'Drone not found') {
        return res.status(404).json({
          success: false,
          error: 'Drone not found'
        })
      }

      logger.error({ error: error.message }, 'Failed to delete drone from dmonitor')
      next(error)
    }
  })

  return router
}

export default createAeroDronesRoutes
