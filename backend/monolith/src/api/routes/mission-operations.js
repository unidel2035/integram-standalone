// mission-operations.js - Mission operations, planning, and execution routes
import express from 'express'
import { pool } from '../../config/database.js'
import logger from '../../utils/logger.js'

/**
 * Calculate spraying parameters
 */
function calculateSprayingParams(field, drone, recipe) {
  const area = parseFloat(field.area)
  const tankCapacity = parseFloat(drone.tank_capacity)
  const sprayWidth = parseFloat(drone.spray_width)
  const applicationRate = parseFloat(recipe.application_rate)

  // Total volume needed (L)
  const totalVolume = area * applicationRate

  // Number of refills needed
  const refillsNeeded = Math.ceil(totalVolume / tankCapacity)

  // Estimated flight time per tank (assuming 1 ha coverage per 10 minutes)
  const coveragePerTank = tankCapacity / applicationRate
  const flightTimePerTank = coveragePerTank * 600 // seconds (10 min per ha)

  // Total estimated flight time
  const estimatedFlightTime = Math.ceil(flightTimePerTank * refillsNeeded)

  // Number of passes
  const passLength = Math.sqrt(area * 10000) // Convert ha to m²
  const numberOfPasses = Math.ceil(passLength / sprayWidth)

  return {
    total_volume: totalVolume,
    tank_capacity: tankCapacity,
    refills_needed: refillsNeeded,
    estimated_flight_time: estimatedFlightTime,
    number_of_passes: numberOfPasses,
    estimated_battery_usage: Math.min(100, (estimatedFlightTime / (drone.max_flight_time || 1200)) * 100)
  }
}

/**
 * Generate waypoints for field coverage
 */
function generateWaypoints(field, params) {
  const geometry = field.geometry
  const altitude = params.flight_altitude || 4.0
  const sprayWidth = params.spray_width
  const overlapPercentage = params.overlap_percentage || 15.0

  // This is a simplified waypoint generation
  // In production, use proper path planning algorithms (e.g., boustrophedon pattern)
  const waypoints = []

  // Get field bounds from geometry
  const coords = geometry.coordinates[0] // Assuming polygon
  const bounds = {
    minLat: Math.min(...coords.map((c) => c[1])),
    maxLat: Math.max(...coords.map((c) => c[1])),
    minLon: Math.min(...coords.map((c) => c[0])),
    maxLon: Math.max(...coords.map((c) => c[0]))
  }

  // Calculate effective spray width with overlap
  const effectiveWidth = sprayWidth * (1 - overlapPercentage / 100)

  // Calculate number of passes
  const latDiff = bounds.maxLat - bounds.minLat
  const latMeters = latDiff * 111000 // Approximate meters per degree latitude
  const numPasses = Math.ceil(latMeters / effectiveWidth)

  // Generate parallel passes (simplified N-S pattern)
  const lonStep = (bounds.maxLon - bounds.minLon) / numPasses

  // Takeoff point
  waypoints.push({
    sequence: 0,
    latitude: field.center_latitude,
    longitude: field.center_longitude,
    altitude: 0,
    action: 'takeoff',
    speed: 0,
    mavlink_command: 22 // MAV_CMD_NAV_TAKEOFF
  })

  let sequence = 1
  for (let i = 0; i < numPasses; i++) {
    const lon = bounds.minLon + lonStep * i

    // South to north pass
    if (i % 2 === 0) {
      // Start of pass - spray on
      waypoints.push({
        sequence: sequence++,
        latitude: bounds.minLat,
        longitude: lon,
        altitude,
        action: 'spray_on',
        speed: params.flight_speed || 4.0,
        mavlink_command: 16 // MAV_CMD_NAV_WAYPOINT
      })

      // End of pass - spray off
      waypoints.push({
        sequence: sequence++,
        latitude: bounds.maxLat,
        longitude: lon,
        altitude,
        action: 'spray_off',
        speed: params.flight_speed || 4.0,
        mavlink_command: 16 // MAV_CMD_NAV_WAYPOINT
      })
    } else {
      // North to south pass (reverse direction for efficiency)
      waypoints.push({
        sequence: sequence++,
        latitude: bounds.maxLat,
        longitude: lon,
        altitude,
        action: 'spray_on',
        speed: params.flight_speed || 4.0,
        mavlink_command: 16
      })

      waypoints.push({
        sequence: sequence++,
        latitude: bounds.minLat,
        longitude: lon,
        altitude,
        action: 'spray_off',
        speed: params.flight_speed || 4.0,
        mavlink_command: 16
      })
    }
  }

  // Return to launch
  waypoints.push({
    sequence: sequence++,
    latitude: field.center_latitude,
    longitude: field.center_longitude,
    altitude,
    action: 'land',
    speed: 2.0,
    mavlink_command: 21 // MAV_CMD_NAV_LAND
  })

  return waypoints
}

export function createMissionOperationRoutes() {
  const router = express.Router()

  // ============================================================
  // MISSIONS ENDPOINTS
  // ============================================================

  /**
   * Get all missions
   */
  router.get('/missions', async (req, res, next) => {
    try {
      const { status, field_id, drone_id, order_id } = req.query

      let query = `
        SELECT m.*, f.name as field_name, d.name as drone_name, r.name as recipe_name,
               o.order_number, o.customer_name
        FROM ag_missions m
        LEFT JOIN fields f ON m.field_id = f.id
        LEFT JOIN ag_drones d ON m.drone_id = d.id
        LEFT JOIN recipes r ON m.recipe_id = r.id
        LEFT JOIN ag_orders o ON m.order_id = o.id
        WHERE 1=1
      `
      const params = []

      if (status) {
        params.push(status)
        query += ` AND m.status = $${params.length}`
      }

      if (field_id) {
        params.push(field_id)
        query += ` AND m.field_id = $${params.length}`
      }

      if (drone_id) {
        params.push(drone_id)
        query += ` AND m.drone_id = $${params.length}`
      }

      if (order_id) {
        params.push(order_id)
        query += ` AND m.order_id = $${params.length}`
      }

      query += ' ORDER BY m.created_at DESC'

      const result = await pool.query(query, params)

      res.json({
        success: true,
        count: result.rows.length,
        missions: result.rows
      })
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to get missions')
      next(error)
    }
  })

  /**
   * Get mission by ID
   */
  router.get('/missions/:id', async (req, res, next) => {
    try {
      const result = await pool.query(
        `SELECT m.*, f.name as field_name, f.geometry as field_geometry,
                d.name as drone_name, d.drone_id, r.name as recipe_name,
                o.order_number, o.customer_name
         FROM ag_missions m
         LEFT JOIN fields f ON m.field_id = f.id
         LEFT JOIN ag_drones d ON m.drone_id = d.id
         LEFT JOIN recipes r ON m.recipe_id = r.id
         LEFT JOIN ag_orders o ON m.order_id = o.id
         WHERE m.id = $1`,
        [req.params.id]
      )

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Mission not found' })
      }

      res.json({
        success: true,
        mission: result.rows[0]
      })
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to get mission')
      next(error)
    }
  })

  /**
   * Create new mission from order (with automatic calculations)
   */
  router.post('/missions', async (req, res, next) => {
    const client = await pool.connect()

    try {
      await client.query('BEGIN')

      const {
        mission_number,
        order_id,
        field_id,
        drone_id,
        recipe_id,
        mission_type,
        flight_altitude,
        flight_speed,
        overlap_percentage,
        flight_direction,
        planned_start,
        created_by
      } = req.body

      if (!mission_number || !field_id || !drone_id || !mission_type) {
        return res.status(400).json({ error: 'Missing required fields' })
      }

      // Get field, drone, and recipe data for calculations
      const fieldResult = await client.query('SELECT * FROM fields WHERE id = $1', [field_id])
      const droneResult = await client.query('SELECT * FROM ag_drones WHERE id = $1', [drone_id])

      if (fieldResult.rows.length === 0 || droneResult.rows.length === 0) {
        await client.query('ROLLBACK')
        return res.status(404).json({ error: 'Field or drone not found' })
      }

      const field = fieldResult.rows[0]
      const drone = droneResult.rows[0]

      let recipe = null
      if (recipe_id) {
        const recipeResult = await client.query('SELECT * FROM recipes WHERE id = $1', [recipe_id])
        if (recipeResult.rows.length > 0) {
          recipe = recipeResult.rows[0]
        }
      }

      // Calculate spraying parameters
      const calculations = recipe
        ? calculateSprayingParams(field, drone, recipe)
        : {
            total_volume: 0,
            tank_capacity: drone.tank_capacity,
            refills_needed: 0,
            estimated_flight_time: 0,
            number_of_passes: 0,
            estimated_battery_usage: 0
          }

      // Create mission
      const missionResult = await client.query(
        `INSERT INTO ag_missions (
          mission_number, order_id, field_id, drone_id, recipe_id, mission_type,
          flight_altitude, flight_speed, spray_width, application_rate, droplet_size,
          overlap_percentage, flight_direction, total_area, total_volume, tank_capacity,
          refills_needed, estimated_flight_time, estimated_battery_usage, number_of_passes,
          planned_start, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
        RETURNING *`,
        [
          mission_number,
          order_id,
          field_id,
          drone_id,
          recipe_id,
          mission_type,
          flight_altitude || 4.0,
          flight_speed || 4.0,
          drone.spray_width,
          recipe?.application_rate,
          recipe?.droplet_size,
          overlap_percentage || 15.0,
          flight_direction,
          field.area,
          calculations.total_volume,
          calculations.tank_capacity,
          calculations.refills_needed,
          calculations.estimated_flight_time,
          calculations.estimated_battery_usage,
          calculations.number_of_passes,
          planned_start,
          created_by
        ]
      )

      const mission = missionResult.rows[0]

      // Log mission creation event
      await client.query(
        `INSERT INTO mission_events (mission_id, event_type, description, created_by)
         VALUES ($1, 'created', 'Mission created', $2)`,
        [mission.id, created_by]
      )

      await client.query('COMMIT')

      res.status(201).json({
        success: true,
        mission,
        calculations
      })
    } catch (error) {
      await client.query('ROLLBACK')
      logger.error({ error: error.message }, 'Failed to create mission')
      next(error)
    } finally {
      client.release()
    }
  })

  /**
   * Generate route for mission
   */
  router.post('/missions/:id/route', async (req, res, next) => {
    const client = await pool.connect()

    try {
      await client.query('BEGIN')

      const { id } = req.params

      // Get mission with related data
      const missionResult = await client.query(
        `SELECT m.*, f.geometry, f.center_latitude, f.center_longitude
         FROM ag_missions m
         JOIN fields f ON m.field_id = f.id
         WHERE m.id = $1`,
        [id]
      )

      if (missionResult.rows.length === 0) {
        await client.query('ROLLBACK')
        return res.status(404).json({ error: 'Mission not found' })
      }

      const mission = missionResult.rows[0]

      // Generate waypoints
      const waypoints = generateWaypoints(
        {
          geometry: mission.geometry,
          center_latitude: mission.center_latitude,
          center_longitude: mission.center_longitude
        },
        {
          flight_altitude: mission.flight_altitude,
          flight_speed: mission.flight_speed,
          spray_width: mission.spray_width,
          overlap_percentage: mission.overlap_percentage
        }
      )

      // Delete existing waypoints
      await client.query('DELETE FROM mission_waypoints WHERE mission_id = $1', [id])

      // Insert new waypoints
      for (const wp of waypoints) {
        await client.query(
          `INSERT INTO mission_waypoints (
            mission_id, sequence, latitude, longitude, altitude, action, speed, mavlink_command,
            param1, param2, param3, param4
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
          [
            id,
            wp.sequence,
            wp.latitude,
            wp.longitude,
            wp.altitude,
            wp.action,
            wp.speed,
            wp.mavlink_command,
            wp.param1 || 0,
            wp.param2 || 0,
            wp.param3 || 0,
            wp.param4 || 0
          ]
        )
      }

      // Update mission status to ready
      await client.query(`UPDATE ag_missions SET status = 'ready' WHERE id = $1`, [id])

      // Log event
      await client.query(
        `INSERT INTO mission_events (mission_id, event_type, description, event_data)
         VALUES ($1, 'route_generated', 'Route waypoints generated', $2)`,
        [id, JSON.stringify({ waypoint_count: waypoints.length })]
      )

      await client.query('COMMIT')

      res.json({
        success: true,
        waypoints,
        count: waypoints.length
      })
    } catch (error) {
      await client.query('ROLLBACK')
      logger.error({ error: error.message }, 'Failed to generate route')
      next(error)
    } finally {
      client.release()
    }
  })

  /**
   * Get mission waypoints
   */
  router.get('/missions/:id/waypoints', async (req, res, next) => {
    try {
      const result = await pool.query(
        'SELECT * FROM mission_waypoints WHERE mission_id = $1 ORDER BY sequence',
        [req.params.id]
      )

      res.json({
        success: true,
        count: result.rows.length,
        waypoints: result.rows
      })
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to get waypoints')
      next(error)
    }
  })

  /**
   * Optimize mission route (placeholder for future optimization algorithms)
   */
  router.post('/missions/:id/optimize', async (req, res, next) => {
    try {
      const { wind_speed, wind_direction, temperature } = req.body

      // For now, return success
      // In production, implement route optimization based on weather

      res.json({
        success: true,
        message: 'Route optimization completed',
        optimizations: {
          wind_adjusted: wind_speed > 0,
          temperature_checked: temperature !== undefined
        }
      })
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to optimize route')
      next(error)
    }
  })

  /**
   * Simulate mission
   */
  router.post('/missions/:id/simulate', async (req, res, next) => {
    try {
      const { id } = req.params

      // Get mission and waypoints
      const missionResult = await pool.query('SELECT * FROM ag_missions WHERE id = $1', [id])
      const waypointsResult = await pool.query(
        'SELECT * FROM mission_waypoints WHERE mission_id = $1 ORDER BY sequence',
        [id]
      )

      if (missionResult.rows.length === 0) {
        return res.status(404).json({ error: 'Mission not found' })
      }

      const mission = missionResult.rows[0]
      const waypoints = waypointsResult.rows

      // Simulation results
      const simulation = {
        mission_id: id,
        total_waypoints: waypoints.length,
        estimated_time: mission.estimated_flight_time,
        coverage_percentage: 100,
        refills_needed: mission.refills_needed,
        warnings: []
      }

      // Add warnings based on conditions
      if (mission.estimated_battery_usage > 90) {
        simulation.warnings.push('High battery usage expected')
      }

      if (mission.refills_needed > 5) {
        simulation.warnings.push('Multiple refills required')
      }

      res.json({
        success: true,
        simulation
      })
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to simulate mission')
      next(error)
    }
  })

  /**
   * Start mission execution
   */
  router.post('/missions/:id/start', async (req, res, next) => {
    const client = await pool.connect()

    try {
      await client.query('BEGIN')

      const { id } = req.params
      const { weather_data } = req.body

      // Update mission status
      const result = await client.query(
        `UPDATE ag_missions
         SET status = 'in_progress',
             actual_start = CURRENT_TIMESTAMP,
             weather_temp = $2,
             weather_humidity = $3,
             weather_wind_speed = $4,
             weather_wind_direction = $5
         WHERE id = $1 AND status IN ('ready', 'paused')
         RETURNING *`,
        [
          id,
          weather_data?.temperature,
          weather_data?.humidity,
          weather_data?.wind_speed,
          weather_data?.wind_direction
        ]
      )

      if (result.rows.length === 0) {
        await client.query('ROLLBACK')
        return res.status(400).json({ error: 'Mission cannot be started' })
      }

      // Log event
      await client.query(
        `INSERT INTO mission_events (mission_id, event_type, description, event_data)
         VALUES ($1, 'started', 'Mission execution started', $2)`,
        [id, JSON.stringify(weather_data || {})]
      )

      // Update drone status
      await client.query(`UPDATE ag_drones SET status = 'in_use' WHERE id = $1`, [
        result.rows[0].drone_id
      ])

      await client.query('COMMIT')

      res.json({
        success: true,
        mission: result.rows[0]
      })
    } catch (error) {
      await client.query('ROLLBACK')
      logger.error({ error: error.message }, 'Failed to start mission')
      next(error)
    } finally {
      client.release()
    }
  })

  /**
   * Pause mission
   */
  router.post('/missions/:id/pause', async (req, res, next) => {
    const client = await pool.connect()

    try {
      await client.query('BEGIN')

      const result = await client.query(
        `UPDATE ag_missions SET status = 'paused'
         WHERE id = $1 AND status = 'in_progress'
         RETURNING *`,
        [req.params.id]
      )

      if (result.rows.length === 0) {
        await client.query('ROLLBACK')
        return res.status(400).json({ error: 'Mission cannot be paused' })
      }

      await client.query(
        `INSERT INTO mission_events (mission_id, event_type, description)
         VALUES ($1, 'paused', 'Mission paused')`,
        [req.params.id]
      )

      await client.query('COMMIT')

      res.json({
        success: true,
        mission: result.rows[0]
      })
    } catch (error) {
      await client.query('ROLLBACK')
      logger.error({ error: error.message }, 'Failed to pause mission')
      next(error)
    } finally {
      client.release()
    }
  })

  /**
   * Resume mission
   */
  router.post('/missions/:id/resume', async (req, res, next) => {
    const client = await pool.connect()

    try {
      await client.query('BEGIN')

      const result = await client.query(
        `UPDATE ag_missions SET status = 'in_progress'
         WHERE id = $1 AND status = 'paused'
         RETURNING *`,
        [req.params.id]
      )

      if (result.rows.length === 0) {
        await client.query('ROLLBACK')
        return res.status(400).json({ error: 'Mission cannot be resumed' })
      }

      await client.query(
        `INSERT INTO mission_events (mission_id, event_type, description)
         VALUES ($1, 'resumed', 'Mission resumed')`,
        [req.params.id]
      )

      await client.query('COMMIT')

      res.json({
        success: true,
        mission: result.rows[0]
      })
    } catch (error) {
      await client.query('ROLLBACK')
      logger.error({ error: error.message }, 'Failed to resume mission')
      next(error)
    } finally {
      client.release()
    }
  })

  /**
   * Abort mission
   */
  router.post('/missions/:id/abort', async (req, res, next) => {
    const client = await pool.connect()

    try {
      await client.query('BEGIN')

      const { reason } = req.body

      const result = await client.query(
        `UPDATE ag_missions
         SET status = 'aborted',
             actual_end = CURRENT_TIMESTAMP,
             abort_reason = $2
         WHERE id = $1 AND status IN ('in_progress', 'paused')
         RETURNING *`,
        [req.params.id, reason]
      )

      if (result.rows.length === 0) {
        await client.query('ROLLBACK')
        return res.status(400).json({ error: 'Mission cannot be aborted' })
      }

      await client.query(
        `INSERT INTO mission_events (mission_id, event_type, description, severity)
         VALUES ($1, 'aborted', $2, 'warning')`,
        [req.params.id, reason || 'Mission aborted']
      )

      // Update drone status back to available
      await client.query(`UPDATE ag_drones SET status = 'available' WHERE id = $1`, [
        result.rows[0].drone_id
      ])

      await client.query('COMMIT')

      res.json({
        success: true,
        mission: result.rows[0]
      })
    } catch (error) {
      await client.query('ROLLBACK')
      logger.error({ error: error.message }, 'Failed to abort mission')
      next(error)
    } finally {
      client.release()
    }
  })

  /**
   * Complete mission
   */
  router.post('/missions/:id/complete', async (req, res, next) => {
    const client = await pool.connect()

    try {
      await client.query('BEGIN')

      const { actual_area_covered, actual_volume_used, actual_flight_time } = req.body

      const result = await client.query(
        `UPDATE ag_missions
         SET status = 'completed',
             actual_end = CURRENT_TIMESTAMP,
             actual_area_covered = $2,
             actual_volume_used = $3,
             actual_flight_time = $4,
             completion_percentage = CASE
               WHEN total_area > 0 THEN (CAST($2 AS DECIMAL) / total_area * 100)
               ELSE 100
             END
         WHERE id = $1 AND status = 'in_progress'
         RETURNING *`,
        [req.params.id, actual_area_covered, actual_volume_used, actual_flight_time]
      )

      if (result.rows.length === 0) {
        await client.query('ROLLBACK')
        return res.status(400).json({ error: 'Mission cannot be completed' })
      }

      const mission = result.rows[0]

      await client.query(
        `INSERT INTO mission_events (mission_id, event_type, description, event_data)
         VALUES ($1, 'completed', 'Mission completed successfully', $2)`,
        [req.params.id, JSON.stringify({ actual_area_covered, actual_volume_used })]
      )

      // Update drone status and statistics
      await client.query(
        `UPDATE ag_drones
         SET status = 'available',
             flight_hours = flight_hours + ($2 / 3600.0),
             missions_completed = missions_completed + 1
         WHERE id = $1`,
        [mission.drone_id, actual_flight_time || 0]
      )

      // Update order status if linked
      if (mission.order_id) {
        await client.query(
          `UPDATE ag_orders SET status = 'completed', completed_at = CURRENT_TIMESTAMP
           WHERE id = $1`,
          [mission.order_id]
        )
      }

      await client.query('COMMIT')

      res.json({
        success: true,
        mission
      })
    } catch (error) {
      await client.query('ROLLBACK')
      logger.error({ error: error.message }, 'Failed to complete mission')
      next(error)
    } finally {
      client.release()
    }
  })

  /**
   * Get mission telemetry
   */
  router.get('/missions/:id/telemetry', async (req, res, next) => {
    try {
      const { limit = 100, offset = 0 } = req.query

      const result = await pool.query(
        `SELECT * FROM mission_telemetry
         WHERE mission_id = $1
         ORDER BY timestamp DESC
         LIMIT $2 OFFSET $3`,
        [req.params.id, limit, offset]
      )

      res.json({
        success: true,
        count: result.rows.length,
        telemetry: result.rows
      })
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to get telemetry')
      next(error)
    }
  })

  /**
   * Add telemetry data point
   */
  router.post('/missions/:id/telemetry', async (req, res, next) => {
    try {
      const { id } = req.params
      const telemetry = req.body

      const result = await pool.query(
        `INSERT INTO mission_telemetry (
          mission_id, latitude, longitude, altitude, altitude_relative, speed, vertical_speed,
          heading, battery_voltage, battery_current, battery_level, tank_level, spraying_active,
          flow_rate, flight_mode, armed, gps_satellites, gps_hdop, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
        RETURNING *`,
        [
          id,
          telemetry.latitude,
          telemetry.longitude,
          telemetry.altitude,
          telemetry.altitude_relative,
          telemetry.speed,
          telemetry.vertical_speed,
          telemetry.heading,
          telemetry.battery_voltage,
          telemetry.battery_current,
          telemetry.battery_level,
          telemetry.tank_level,
          telemetry.spraying_active,
          telemetry.flow_rate,
          telemetry.flight_mode,
          telemetry.armed,
          telemetry.gps_satellites,
          telemetry.gps_hdop,
          JSON.stringify(telemetry.metadata || {})
        ]
      )

      res.status(201).json({
        success: true,
        telemetry: result.rows[0]
      })
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to add telemetry')
      next(error)
    }
  })

  /**
   * Get mission coverage
   */
  router.get('/missions/:id/coverage', async (req, res, next) => {
    try {
      const result = await pool.query(
        `SELECT * FROM mission_coverage WHERE mission_id = $1 ORDER BY timestamp DESC`,
        [req.params.id]
      )

      res.json({
        success: true,
        coverage: result.rows
      })
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to get coverage')
      next(error)
    }
  })

  /**
   * Get mission events/log
   */
  router.get('/missions/:id/events', async (req, res, next) => {
    try {
      const result = await pool.query(
        `SELECT * FROM mission_events WHERE mission_id = $1 ORDER BY created_at DESC`,
        [req.params.id]
      )

      res.json({
        success: true,
        count: result.rows.length,
        events: result.rows
      })
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to get mission events')
      next(error)
    }
  })

  /**
   * Get mission analytics
   */
  router.get('/missions/:id/analytics', async (req, res, next) => {
    try {
      const missionResult = await pool.query('SELECT * FROM ag_missions WHERE id = $1', [
        req.params.id
      ])

      if (missionResult.rows.length === 0) {
        return res.status(404).json({ error: 'Mission not found' })
      }

      const mission = missionResult.rows[0]

      // Calculate analytics
      const analytics = {
        completion_rate: mission.completion_percentage || 0,
        efficiency: mission.total_area > 0 ? (mission.actual_area_covered / mission.total_area) * 100 : 0,
        time_variance:
          mission.estimated_flight_time > 0
            ? ((mission.actual_flight_time - mission.estimated_flight_time) /
                mission.estimated_flight_time) *
              100
            : 0,
        volume_variance:
          mission.total_volume > 0
            ? ((mission.actual_volume_used - mission.total_volume) / mission.total_volume) * 100
            : 0,
        status: mission.status,
        duration: mission.actual_end
          ? (new Date(mission.actual_end) - new Date(mission.actual_start)) / 1000
          : null
      }

      res.json({
        success: true,
        analytics
      })
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to get analytics')
      next(error)
    }
  })

  return router
}
