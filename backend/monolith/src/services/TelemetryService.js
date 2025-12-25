import { Server } from 'socket.io'

/**
 * TelemetryService - WebSocket service for real-time drone telemetry
 * Handles telemetry broadcasting, subscriptions, and simulation
 */
class TelemetryService {
  constructor(httpServer, options = {}) {
    this.io = new Server(httpServer, {
      cors: {
        origin: options.corsOrigin || '*',
        methods: ['GET', 'POST']
      },
      pingTimeout: options.pingTimeout || 60000,
      pingInterval: options.pingInterval || 25000
    })

    this.clients = new Map() // socket.id -> Set of droneIds
    this.simulators = new Map() // droneId -> intervalId
    this.telemetryHistory = new Map() // droneId -> Array of telemetry points

    this.setupSocketHandlers()
    console.log('[TelemetryService] WebSocket server initialized')
  }

  setupSocketHandlers() {
    this.io.on('connection', (socket) => {
      console.log(`[TelemetryService] Client connected: ${socket.id}`)
      this.clients.set(socket.id, new Set())

      socket.on('subscribe_drone', (droneId) => {
        this.subscribeToDrone(socket, droneId)
      })

      socket.on('unsubscribe_drone', (droneId) => {
        this.unsubscribeFromDrone(socket, droneId)
      })

      socket.on('disconnect', () => {
        console.log(`[TelemetryService] Client disconnected: ${socket.id}`)
        this.clients.delete(socket.id)
      })

      socket.on('error', (error) => {
        console.error(`[TelemetryService] Socket error for ${socket.id}:`, error)
      })
    })
  }

  subscribeToDrone(socket, droneId) {
    const drones = this.clients.get(socket.id)
    if (drones) {
      drones.add(droneId)
      socket.join(`drone_${droneId}`)
      console.log(`[TelemetryService] Client ${socket.id} subscribed to drone ${droneId}`)

      // Send latest telemetry if available
      const history = this.telemetryHistory.get(droneId)
      if (history && history.length > 0) {
        socket.emit('telemetry_update', history[history.length - 1])
      }
    }
  }

  unsubscribeFromDrone(socket, droneId) {
    const drones = this.clients.get(socket.id)
    if (drones) {
      drones.delete(droneId)
      socket.leave(`drone_${droneId}`)
      console.log(`[TelemetryService] Client ${socket.id} unsubscribed from drone ${droneId}`)
    }
  }

  /**
   * Broadcast telemetry to all subscribers of a drone
   * @param {number|string} droneId - Drone ID
   * @param {object} telemetryData - Telemetry data
   */
  broadcastTelemetry(droneId, telemetryData) {
    const fullData = {
      droneId,
      timestamp: Date.now(),
      ...telemetryData
    }

    // Store in history
    let history = this.telemetryHistory.get(droneId)
    if (!history) {
      history = []
      this.telemetryHistory.set(droneId, history)
    }
    history.push(fullData)

    // Keep only last 1000 points
    if (history.length > 1000) {
      history.shift()
    }

    // Broadcast to all subscribers
    this.io.to(`drone_${droneId}`).emit('telemetry_update', fullData)
  }

  /**
   * Start telemetry simulation for a drone
   * @param {object} drone - Drone object with mission data
   * @param {Array} missionRoute - Mission route waypoints [{lat, lon, alt}, ...]
   * @param {number} updateInterval - Update interval in ms (default: 1000)
   */
  startSimulation(drone, missionRoute, updateInterval = 1000) {
    // Stop existing simulation if any
    this.stopSimulation(drone.id)

    if (!missionRoute || missionRoute.length === 0) {
      console.warn(`[TelemetryService] No mission route provided for drone ${drone.id}`)
      return
    }

    let index = 0
    let battery = 100
    const homePoint = missionRoute[0]
    let trackHistory = []

    console.log(`[TelemetryService] Starting simulation for drone ${drone.id}`)

    const intervalId = setInterval(() => {
      if (index >= missionRoute.length) {
        console.log(`[TelemetryService] Simulation completed for drone ${drone.id}`)
        this.stopSimulation(drone.id)
        return
      }

      const point = missionRoute[index]
      const nextPoint = missionRoute[index + 1]

      // Calculate distance to home
      const distanceToHome = this.calculateDistance(
        point.lat,
        point.lon,
        homePoint.lat,
        homePoint.lon
      )

      // Calculate distance to next waypoint
      let distanceToWaypoint = 0
      if (nextPoint) {
        distanceToWaypoint = this.calculateDistance(
          point.lat,
          point.lon,
          nextPoint.lat,
          nextPoint.lon
        )
      }

      // Simulate battery drain (1% per 1% of route completion)
      battery = Math.max(0, 100 - (index / missionRoute.length) * 90)

      // Simulate speed variation (4-7 m/s)
      const speed = 5 + Math.random() * 2

      // Simulate GPS accuracy (3-10 meters)
      const gpsAccuracy = 3 + Math.random() * 7

      // Simulate satellites (10-15)
      const satellites = Math.floor(10 + Math.random() * 6)

      // Determine connection quality based on distance
      let connectionQuality = 'Good'
      if (distanceToHome > 2000) connectionQuality = 'Fair'
      if (distanceToHome > 4000) connectionQuality = 'Poor'

      // Determine flight mode
      let flightMode = 'Auto'
      if (index === 0) flightMode = 'Manual'
      if (index === missionRoute.length - 1) flightMode = 'Landing'

      // Determine status
      let status = 'In Flight'
      if (battery < 20) status = 'Warning'
      if (flightMode === 'Landing') status = 'Landing'

      // Add to track history
      trackHistory.push({ lat: point.lat, lon: point.lon })
      if (trackHistory.length > 100) {
        trackHistory.shift()
      }

      const telemetryData = {
        latitude: point.lat,
        longitude: point.lon,
        altitude: point.alt || 100,
        speed,
        battery,
        heading: this.calculateHeading(point, nextPoint),
        status,
        gpsAccuracy: gpsAccuracy.toFixed(1),
        satellites,
        flightMode,
        connectionQuality,
        distanceToHome: distanceToHome.toFixed(0),
        distanceToWaypoint: distanceToWaypoint.toFixed(0),
        trackHistory: [...trackHistory]
      }

      this.broadcastTelemetry(drone.id, telemetryData)

      index++
    }, updateInterval)

    this.simulators.set(drone.id, intervalId)
  }

  /**
   * Stop telemetry simulation for a drone
   * @param {number|string} droneId - Drone ID
   */
  stopSimulation(droneId) {
    const intervalId = this.simulators.get(droneId)
    if (intervalId) {
      clearInterval(intervalId)
      this.simulators.delete(droneId)
      console.log(`[TelemetryService] Stopped simulation for drone ${droneId}`)
    }
  }

  /**
   * Stop all simulations
   */
  stopAllSimulations() {
    this.simulators.forEach((intervalId, droneId) => {
      this.stopSimulation(droneId)
    })
  }

  /**
   * Get telemetry history for a drone
   * @param {number|string} droneId - Drone ID
   * @param {number} limit - Max number of points to return
   * @returns {Array} Telemetry history
   */
  getTelemetryHistory(droneId, limit = 100) {
    const history = this.telemetryHistory.get(droneId) || []
    return history.slice(-limit)
  }

  /**
   * Clear telemetry history for a drone
   * @param {number|string} droneId - Drone ID
   */
  clearHistory(droneId) {
    this.telemetryHistory.delete(droneId)
  }

  /**
   * Calculate distance between two points (Haversine formula)
   * @param {number} lat1 - Latitude 1
   * @param {number} lon1 - Longitude 1
   * @param {number} lat2 - Latitude 2
   * @param {number} lon2 - Longitude 2
   * @returns {number} Distance in meters
   */
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000 // Earth's radius in meters
    const dLat = this.toRad(lat2 - lat1)
    const dLon = this.toRad(lon2 - lon1)
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return R * c
  }

  /**
   * Calculate heading between two points
   * @param {object} point1 - {lat, lon}
   * @param {object} point2 - {lat, lon}
   * @returns {number} Heading in degrees
   */
  calculateHeading(point1, point2) {
    if (!point2) return 0

    const dLon = this.toRad(point2.lon - point1.lon)
    const lat1 = this.toRad(point1.lat)
    const lat2 = this.toRad(point2.lat)

    const y = Math.sin(dLon) * Math.cos(lat2)
    const x = Math.cos(lat1) * Math.sin(lat2) -
              Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon)

    const heading = Math.atan2(y, x) * 180 / Math.PI
    return (heading + 360) % 360 // Normalize to 0-360
  }

  /**
   * Convert degrees to radians
   * @param {number} degrees
   * @returns {number} Radians
   */
  toRad(degrees) {
    return degrees * Math.PI / 180
  }

  /**
   * Get connection stats
   * @returns {object} Connection statistics
   */
  getStats() {
    return {
      connectedClients: this.clients.size,
      activeSimulations: this.simulators.size,
      dronesWithHistory: this.telemetryHistory.size
    }
  }

  /**
   * Shutdown the service
   */
  shutdown() {
    console.log('[TelemetryService] Shutting down...')
    this.stopAllSimulations()
    this.io.close()
    this.clients.clear()
    this.telemetryHistory.clear()
  }
}

export default TelemetryService
