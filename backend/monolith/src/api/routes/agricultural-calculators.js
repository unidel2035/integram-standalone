// agricultural-calculators.js - Calculators for spraying and flight time
import express from 'express'
import logger from '../../utils/logger.js'

export function createCalculatorRoutes() {
  const router = express.Router()

  /**
   * Calculate spraying parameters
   * POST /api/agriculture/calculator/spraying
   */
  router.post('/spraying', (req, res, next) => {
    try {
      const {
        field_area, // hectares
        application_rate, // L/ha or kg/ha
        tank_capacity, // liters
        spray_width, // meters
        flight_speed, // m/s
        overlap_percentage // percentage
      } = req.body

      if (!field_area || !application_rate || !tank_capacity || !spray_width) {
        return res.status(400).json({ error: 'Missing required parameters' })
      }

      // Total volume calculation
      const total_volume = field_area * application_rate

      // Number of refills
      const refills_needed = Math.ceil(total_volume / tank_capacity)

      // Coverage per tank
      const coverage_per_tank = tank_capacity / application_rate

      // Effective spray width considering overlap
      const overlap = overlap_percentage || 15
      const effective_spray_width = spray_width * (1 - overlap / 100)

      // Calculate number of parallel passes
      // Assuming square field for simplification
      const field_side = Math.sqrt(field_area * 10000) // Convert ha to m²
      const number_of_passes = Math.ceil(field_side / effective_spray_width)

      // Pass length (meters)
      const pass_length = field_side

      // Total distance to cover (meters)
      const total_distance = number_of_passes * pass_length

      // Flight time per tank (assuming constant speed)
      const speed = flight_speed || 4.0
      const distance_per_tank = coverage_per_tank * 10000 / effective_spray_width
      const flight_time_per_tank = distance_per_tank / speed

      // Total flight time (seconds)
      const total_flight_time = Math.ceil((total_distance / speed) * 1.1) // 1.1 factor for turns

      // Refill/landing time (estimated 5 minutes per refill)
      const refill_time = refills_needed * 300 // seconds

      // Total mission time
      const total_mission_time = total_flight_time + refill_time

      res.json({
        success: true,
        parameters: {
          field_area,
          application_rate,
          tank_capacity,
          spray_width,
          effective_spray_width: parseFloat(effective_spray_width.toFixed(2)),
          overlap_percentage: overlap
        },
        calculations: {
          total_volume: parseFloat(total_volume.toFixed(2)),
          coverage_per_tank: parseFloat(coverage_per_tank.toFixed(2)),
          refills_needed,
          number_of_passes,
          pass_length: parseFloat(pass_length.toFixed(2)),
          total_distance: parseFloat(total_distance.toFixed(2)),
          flight_time_per_tank: Math.ceil(flight_time_per_tank),
          total_flight_time,
          refill_time,
          total_mission_time,
          estimated_duration_hours: parseFloat((total_mission_time / 3600).toFixed(2))
        }
      })
    } catch (error) {
      logger.error({ error: error.message }, 'Spraying calculation error')
      next(error)
    }
  })

  /**
   * Calculate flight time and battery usage
   * POST /api/agriculture/calculator/flight-time
   */
  router.post('/flight-time', (req, res, next) => {
    try {
      const {
        field_area, // hectares
        flight_altitude, // meters
        flight_speed, // m/s
        drone_max_flight_time, // seconds
        battery_capacity, // mAh
        takeoff_altitude, // meters (optional)
        wind_speed // m/s (optional)
      } = req.body

      if (!field_area || !drone_max_flight_time) {
        return res.status(400).json({ error: 'Missing required parameters' })
      }

      const speed = flight_speed || 4.0
      const altitude = flight_altitude || 4.0
      const wind = wind_speed || 0

      // Calculate field coverage distance
      const field_side = Math.sqrt(field_area * 10000)
      const coverage_distance = field_side * Math.sqrt(2) // Diagonal coverage estimate

      // Add takeoff and landing distance
      const vertical_distance = (altitude + (takeoff_altitude || 0)) * 2 // Up and down

      // Wind effect on flight time (simplified)
      const wind_factor = 1 + wind / 20 // 5 m/s wind adds 25% time

      // Total flight time
      const base_flight_time = coverage_distance / speed
      const adjusted_flight_time = Math.ceil(base_flight_time * wind_factor)

      // Hover and maneuver time (estimated 10% overhead)
      const total_flight_time = Math.ceil(adjusted_flight_time * 1.1)

      // Battery usage calculation
      const battery_usage_percentage = (total_flight_time / drone_max_flight_time) * 100

      // Number of battery cycles needed
      const battery_cycles = Math.ceil(total_flight_time / drone_max_flight_time)

      // Safe flight time (80% of max)
      const safe_flight_time = drone_max_flight_time * 0.8
      const safe_battery_cycles = Math.ceil(total_flight_time / safe_flight_time)

      // Energy consumption estimate (if battery capacity provided)
      let energy_consumption = null
      if (battery_capacity) {
        // Rough estimate: average consumption 150 mAh/min for multirotor
        const consumption_rate = 150 // mAh per minute
        energy_consumption = (total_flight_time / 60) * consumption_rate
      }

      res.json({
        success: true,
        parameters: {
          field_area,
          flight_altitude: altitude,
          flight_speed: speed,
          drone_max_flight_time,
          wind_speed: wind
        },
        calculations: {
          coverage_distance: parseFloat(coverage_distance.toFixed(2)),
          vertical_distance: parseFloat(vertical_distance.toFixed(2)),
          base_flight_time: Math.ceil(base_flight_time),
          wind_factor: parseFloat(wind_factor.toFixed(2)),
          total_flight_time,
          battery_usage_percentage: parseFloat(battery_usage_percentage.toFixed(2)),
          battery_cycles,
          safe_battery_cycles,
          recommended_battery_reserve: 20, // percentage
          energy_consumption: energy_consumption
            ? parseFloat(energy_consumption.toFixed(2))
            : null,
          warnings: []
        }
      })
    } catch (error) {
      logger.error({ error: error.message }, 'Flight time calculation error')
      next(error)
    }
  })

  /**
   * Calculate optimal flight parameters based on weather
   * POST /api/agriculture/calculator/optimal-params
   */
  router.post('/optimal-params', (req, res, next) => {
    try {
      const { temperature, humidity, wind_speed, wind_direction, droplet_size, recipe_type } =
        req.body

      const recommendations = {
        can_spray: true,
        warnings: [],
        optimal_altitude: 4.0,
        optimal_speed: 4.0,
        recommended_droplet_size: droplet_size || 200,
        flight_direction: null
      }

      // Temperature check
      if (temperature < 10) {
        recommendations.warnings.push('Temperature too low - risk of poor efficacy')
        recommendations.can_spray = false
      } else if (temperature > 28) {
        recommendations.warnings.push('Temperature too high - risk of evaporation')
        recommendations.can_spray = false
      }

      // Humidity check
      if (humidity < 40) {
        recommendations.warnings.push('Low humidity - increase droplet size')
        recommendations.recommended_droplet_size = Math.max(
          recommendations.recommended_droplet_size,
          250
        )
      } else if (humidity > 95) {
        recommendations.warnings.push('Very high humidity - risk of runoff')
      }

      // Wind speed check
      if (wind_speed > 5) {
        recommendations.warnings.push('Wind speed too high for safe spraying')
        recommendations.can_spray = false
      } else if (wind_speed > 3) {
        recommendations.warnings.push('Moderate wind - consider larger droplets')
        recommendations.recommended_droplet_size = Math.max(
          recommendations.recommended_droplet_size,
          250
        )
      }

      // Adjust flight direction based on wind
      if (wind_direction !== undefined && wind_speed > 1) {
        // Recommend flying perpendicular to wind direction
        recommendations.flight_direction = (wind_direction + 90) % 360
        recommendations.warnings.push(
          `Fly at ${recommendations.flight_direction.toFixed(0)}° to minimize drift`
        )
      }

      // Recipe-specific recommendations
      if (recipe_type === 'herbicide' && wind_speed > 2) {
        recommendations.warnings.push('Herbicide application - reduce speed in wind')
        recommendations.optimal_speed = 3.0
      }

      // Altitude adjustment for wind
      if (wind_speed > 2) {
        recommendations.optimal_altitude = 3.0
        recommendations.warnings.push('Lower altitude recommended due to wind')
      }

      res.json({
        success: true,
        conditions: {
          temperature,
          humidity,
          wind_speed,
          wind_direction
        },
        recommendations
      })
    } catch (error) {
      logger.error({ error: error.message }, 'Optimal params calculation error')
      next(error)
    }
  })

  /**
   * Calculate coverage area from telemetry path
   * POST /api/agriculture/calculator/coverage-area
   */
  router.post('/coverage-area', (req, res, next) => {
    try {
      const { path, spray_width } = req.body

      if (!path || !Array.isArray(path) || path.length < 2) {
        return res.status(400).json({ error: 'Invalid path data' })
      }

      if (!spray_width) {
        return res.status(400).json({ error: 'Spray width is required' })
      }

      // Simple coverage calculation
      // In production, use proper geospatial libraries
      let total_distance = 0

      for (let i = 1; i < path.length; i++) {
        const lat1 = path[i - 1].latitude
        const lon1 = path[i - 1].longitude
        const lat2 = path[i].latitude
        const lon2 = path[i].longitude

        // Haversine formula for distance
        const R = 6371000 // Earth radius in meters
        const φ1 = (lat1 * Math.PI) / 180
        const φ2 = (lat2 * Math.PI) / 180
        const Δφ = ((lat2 - lat1) * Math.PI) / 180
        const Δλ = ((lon2 - lon1) * Math.PI) / 180

        const a =
          Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
          Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2)
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
        const distance = R * c

        total_distance += distance
      }

      // Covered area = path length × spray width
      const covered_area = (total_distance * spray_width) / 10000 // Convert to hectares

      res.json({
        success: true,
        calculations: {
          total_distance: parseFloat(total_distance.toFixed(2)),
          spray_width,
          covered_area: parseFloat(covered_area.toFixed(4)),
          waypoint_count: path.length
        }
      })
    } catch (error) {
      logger.error({ error: error.message }, 'Coverage area calculation error')
      next(error)
    }
  })

  return router
}
