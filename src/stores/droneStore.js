import { logger } from '@/utils/logger'
/**
 * Vue reactive store for drone MAVLink communication
 */

import { reactive, computed } from 'vue'
import axios from 'axios'
import { getApiUrl } from '@/utils/apiConfig'

const API_BASE_URL = getApiUrl('/api')

const state = reactive({
  drones: new Map(),
  telemetrySubscriptions: new Map(),
  websockets: new Map(),
  formations: new Map(), // Formation configurations
  activeFormation: null // Currently active formation ID
})

export const useDroneStore = () => {
  // Getters
  const connectedDrones = computed(() => {
    return Array.from(state.drones.keys())
  })

  const getDrone = (droneId) => computed(() => state.drones.get(droneId))

  // Actions

  /**
   * Connect to a drone
   */
  const connect = async (droneId, connectionString) => {
    try {
      const response = await axios.post(`${API_BASE_URL}/mavlink/connect`, {
        drone_id: droneId,
        connection_string: connectionString
      })

      if (response.data.success) {
        state.drones.set(droneId, {
          connected: true,
          connectionString,
          telemetry: null
        })
        return true
      } else {
        throw new Error(response.data.message)
      }
    } catch (error) {
      console.error('Failed to connect to drone:', error)
      throw error
    }
  }

  /**
   * Disconnect from a drone
   */
  const disconnect = async (droneId) => {
    try {
      // Close WebSocket if open
      const ws = state.websockets.get(droneId)
      if (ws) {
        ws.close()
        state.websockets.delete(droneId)
      }

      // Disconnect from backend
      const response = await axios.post(`${API_BASE_URL}/mavlink/disconnect`, {
        drone_id: droneId
      })

      if (response.data.success) {
        state.drones.delete(droneId)
        state.telemetrySubscriptions.delete(droneId)
        return true
      } else {
        throw new Error(response.data.message)
      }
    } catch (error) {
      console.error('Failed to disconnect from drone:', error)
      throw error
    }
  }

  /**
   * Get telemetry snapshot
   */
  const getTelemetry = async (droneId) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/mavlink/telemetry/${droneId}`)
      return response.data
    } catch (error) {
      console.error('Failed to get telemetry:', error)
      throw error
    }
  }

  /**
   * Subscribe to real-time telemetry via WebSocket
   */
  const subscribeToTelemetry = (droneId, callback) => {
    // Check if already subscribed
    if (state.websockets.has(droneId)) {
      console.warn(`Already subscribed to telemetry for ${droneId}`)
      return
    }

    // Create WebSocket connection
    const wsUrl = `${API_BASE_URL.replace('http', 'ws')}/mavlink/telemetry/ws/${droneId}`
    const ws = new WebSocket(wsUrl)

    ws.onopen = () => {
      logger.debug(`WebSocket connected for ${droneId}`)
    }

    ws.onmessage = (event) => {
      try {
        const telemetry = JSON.parse(event.data)

        // Update drone telemetry in store
        const drone = state.drones.get(droneId)
        if (drone) {
          drone.telemetry = telemetry
        }

        // Call callback
        if (callback) {
          callback(telemetry)
        }
      } catch (error) {
        console.error('Failed to parse telemetry:', error)
      }
    }

    ws.onerror = (error) => {
      console.error(`WebSocket error for ${droneId}:`, error)
    }

    ws.onclose = () => {
      logger.debug(`WebSocket closed for ${droneId}`)
      state.websockets.delete(droneId)
    }

    state.websockets.set(droneId, ws)
    state.telemetrySubscriptions.set(droneId, callback)
  }

  /**
   * Arm or disarm drone motors
   */
  const arm = async (droneId, shouldArm) => {
    try {
      const response = await axios.post(`${API_BASE_URL}/mavlink/command/arm`, {
        drone_id: droneId,
        arm: shouldArm
      })

      if (!response.data.success) {
        throw new Error(response.data.message)
      }

      return response.data
    } catch (error) {
      console.error('Failed to arm/disarm:', error)
      throw error
    }
  }

  /**
   * Takeoff to specified altitude
   */
  const takeoff = async (droneId, altitude) => {
    try {
      const response = await axios.post(`${API_BASE_URL}/mavlink/command/takeoff`, {
        drone_id: droneId,
        altitude
      })

      if (!response.data.success) {
        throw new Error(response.data.message)
      }

      return response.data
    } catch (error) {
      console.error('Failed to takeoff:', error)
      throw error
    }
  }

  /**
   * Land at current position
   */
  const land = async (droneId) => {
    try {
      const response = await axios.post(`${API_BASE_URL}/mavlink/command/land`, {
        drone_id: droneId
      })

      if (!response.data.success) {
        throw new Error(response.data.message)
      }

      return response.data
    } catch (error) {
      console.error('Failed to land:', error)
      throw error
    }
  }

  /**
   * Return to launch
   */
  const rtl = async (droneId) => {
    try {
      const response = await axios.post(`${API_BASE_URL}/mavlink/command/rtl`, {
        drone_id: droneId
      })

      if (!response.data.success) {
        throw new Error(response.data.message)
      }

      return response.data
    } catch (error) {
      console.error('Failed to RTL:', error)
      throw error
    }
  }

  /**
   * Set flight mode
   */
  const setMode = async (droneId, mode) => {
    try {
      const response = await axios.post(`${API_BASE_URL}/mavlink/command/mode`, {
        drone_id: droneId,
        mode
      })

      if (!response.data.success) {
        throw new Error(response.data.message)
      }

      return response.data
    } catch (error) {
      console.error('Failed to set mode:', error)
      throw error
    }
  }

  /**
   * Navigate to position
   */
  const goto = async (droneId, latitude, longitude, altitude) => {
    try {
      const response = await axios.post(`${API_BASE_URL}/mavlink/command/goto`, {
        drone_id: droneId,
        latitude,
        longitude,
        altitude
      })

      if (!response.data.success) {
        throw new Error(response.data.message)
      }

      return response.data
    } catch (error) {
      console.error('Failed to goto:', error)
      throw error
    }
  }

  /**
   * Upload mission
   */
  const uploadMission = async (droneId, waypoints) => {
    try {
      const response = await axios.post(`${API_BASE_URL}/mavlink/mission/upload`, {
        drone_id: droneId,
        waypoints
      })

      if (!response.data.success) {
        throw new Error(response.data.message)
      }

      return response.data
    } catch (error) {
      console.error('Failed to upload mission:', error)
      throw error
    }
  }

  /**
   * Download mission
   */
  const downloadMission = async (droneId) => {
    try {
      const response = await axios.post(`${API_BASE_URL}/mavlink/mission/download`, {
        drone_id: droneId
      })

      if (!response.data.success) {
        throw new Error(response.data.message)
      }

      return response.data.waypoints
    } catch (error) {
      console.error('Failed to download mission:', error)
      throw error
    }
  }

  /**
   * Start mission
   */
  const startMission = async (droneId) => {
    try {
      const response = await axios.post(`${API_BASE_URL}/mavlink/mission/start`, {
        drone_id: droneId
      })

      if (!response.data.success) {
        throw new Error(response.data.message)
      }

      return response.data
    } catch (error) {
      console.error('Failed to start mission:', error)
      throw error
    }
  }

  /**
   * Pause mission
   */
  const pauseMission = async (droneId) => {
    try {
      const response = await axios.post(`${API_BASE_URL}/mavlink/mission/pause`, {
        drone_id: droneId
      })

      if (!response.data.success) {
        throw new Error(response.data.message)
      }

      return response.data
    } catch (error) {
      console.error('Failed to pause mission:', error)
      throw error
    }
  }

  /**
   * Resume mission
   */
  const resumeMission = async (droneId) => {
    try {
      const response = await axios.post(`${API_BASE_URL}/mavlink/mission/resume`, {
        drone_id: droneId
      })

      if (!response.data.success) {
        throw new Error(response.data.message)
      }

      return response.data
    } catch (error) {
      console.error('Failed to resume mission:', error)
      throw error
    }
  }

  /**
   * List all connected drones
   */
  const listDrones = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/mavlink/drones`)
      return response.data.drones
    } catch (error) {
      console.error('Failed to list drones:', error)
      throw error
    }
  }

  // ============================================================
  // FORMATION MANAGEMENT FUNCTIONS
  // ============================================================

  /**
   * Create a new formation with specified drones
   * @param {string} formationId - Unique ID for the formation
   * @param {string[]} droneIds - Array of drone IDs in the formation
   * @param {string} pattern - Formation pattern (line, grid, circle, v-shape)
   * @param {object} config - Formation configuration (spacing, altitude, etc.)
   */
  const createFormation = (formationId, droneIds, pattern = 'line', config = {}) => {
    try {
      // Validate all drones are connected
      const invalidDrones = droneIds.filter((id) => !state.drones.has(id))
      if (invalidDrones.length > 0) {
        throw new Error(`Drones not connected: ${invalidDrones.join(', ')}`)
      }

      const formation = {
        id: formationId,
        droneIds: [...droneIds],
        pattern,
        config: {
          spacing: config.spacing || 10, // meters between drones
          altitude: config.altitude || 50, // default altitude in meters
          ...config
        },
        createdAt: new Date().toISOString()
      }

      state.formations.set(formationId, formation)
      logger.debug(`Formation created: ${formationId} with ${droneIds.length} drones`)

      return formation
    } catch (error) {
      console.error('Failed to create formation:', error)
      throw error
    }
  }

  /**
   * Delete a formation
   */
  const deleteFormation = (formationId) => {
    if (state.activeFormation === formationId) {
      state.activeFormation = null
    }
    state.formations.delete(formationId)
    logger.debug(`Formation deleted: ${formationId}`)
  }

  /**
   * Set active formation
   */
  const setActiveFormation = (formationId) => {
    if (!state.formations.has(formationId)) {
      throw new Error(`Formation not found: ${formationId}`)
    }
    state.activeFormation = formationId
  }

  /**
   * Get formation details
   */
  const getFormation = (formationId) => {
    return state.formations.get(formationId)
  }

  /**
   * List all formations
   */
  const listFormations = computed(() => {
    return Array.from(state.formations.values())
  })

  /**
   * Execute command on all drones in a formation
   * @param {string} formationId - Formation ID
   * @param {string} command - Command name (arm, takeoff, land, rtl)
   * @param {object} params - Command parameters
   */
  const executeFormationCommand = async (formationId, command, params = {}) => {
    const formation = state.formations.get(formationId)
    if (!formation) {
      throw new Error(`Formation not found: ${formationId}`)
    }

    logger.debug(`Executing ${command} on formation ${formationId} with ${formation.droneIds.length} drones`)

    const results = []
    const errors = []

    // Execute command on each drone with slight delay to avoid overwhelming the system
    for (let i = 0; i < formation.droneIds.length; i++) {
      const droneId = formation.droneIds[i]

      try {
        let result
        switch (command) {
          case 'arm':
            result = await arm(droneId, params.shouldArm !== false)
            break
          case 'disarm':
            result = await arm(droneId, false)
            break
          case 'takeoff':
            result = await takeoff(droneId, params.altitude || formation.config.altitude)
            break
          case 'land':
            result = await land(droneId)
            break
          case 'rtl':
            result = await rtl(droneId)
            break
          case 'setMode':
            result = await setMode(droneId, params.mode)
            break
          default:
            throw new Error(`Unknown command: ${command}`)
        }

        results.push({ droneId, success: true, result })

        // Small delay between commands (100ms)
        if (i < formation.droneIds.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 100))
        }
      } catch (error) {
        console.error(`Failed to execute ${command} on ${droneId}:`, error)
        errors.push({ droneId, error: error.message })
      }
    }

    return {
      success: errors.length === 0,
      results,
      errors,
      total: formation.droneIds.length,
      successful: results.length,
      failed: errors.length
    }
  }

  /**
   * Move formation to new position maintaining pattern
   * @param {string} formationId - Formation ID
   * @param {number} centerLat - Center latitude
   * @param {number} centerLon - Center longitude
   * @param {number} altitude - Target altitude
   */
  const moveFormation = async (formationId, centerLat, centerLon, altitude) => {
    const formation = state.formations.get(formationId)
    if (!formation) {
      throw new Error(`Formation not found: ${formationId}`)
    }

    // Calculate positions for each drone based on formation pattern
    const positions = calculateFormationPositions(
      formation.pattern,
      centerLat,
      centerLon,
      altitude,
      formation.droneIds.length,
      formation.config
    )

    const results = []
    const errors = []

    // Send goto commands to all drones
    for (let i = 0; i < formation.droneIds.length; i++) {
      const droneId = formation.droneIds[i]
      const position = positions[i]

      try {
        const result = await goto(droneId, position.lat, position.lon, position.alt)
        results.push({ droneId, success: true, position })

        // Small delay between commands
        if (i < formation.droneIds.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 100))
        }
      } catch (error) {
        console.error(`Failed to move ${droneId}:`, error)
        errors.push({ droneId, error: error.message })
      }
    }

    return {
      success: errors.length === 0,
      results,
      errors
    }
  }

  /**
   * Calculate drone positions based on formation pattern
   */
  const calculateFormationPositions = (pattern, centerLat, centerLon, altitude, count, config) => {
    const positions = []
    const spacing = config.spacing || 10 // meters

    // Convert meters to approximate degrees (rough approximation)
    const metersToLat = (meters) => meters / 111320
    const metersToLon = (meters, lat) => meters / (111320 * Math.cos((lat * Math.PI) / 180))

    switch (pattern) {
      case 'line':
        // Drones in a horizontal line
        for (let i = 0; i < count; i++) {
          const offset = (i - (count - 1) / 2) * spacing
          positions.push({
            lat: centerLat,
            lon: centerLon + metersToLon(offset, centerLat),
            alt: altitude
          })
        }
        break

      case 'grid':
        // Drones in a grid pattern
        const cols = Math.ceil(Math.sqrt(count))
        const rows = Math.ceil(count / cols)
        for (let i = 0; i < count; i++) {
          const row = Math.floor(i / cols)
          const col = i % cols
          const offsetLat = (row - (rows - 1) / 2) * spacing
          const offsetLon = (col - (cols - 1) / 2) * spacing
          positions.push({
            lat: centerLat + metersToLat(offsetLat),
            lon: centerLon + metersToLon(offsetLon, centerLat),
            alt: altitude
          })
        }
        break

      case 'circle':
        // Drones in a circle
        const radius = spacing
        for (let i = 0; i < count; i++) {
          const angle = (2 * Math.PI * i) / count
          const offsetLat = radius * Math.cos(angle)
          const offsetLon = radius * Math.sin(angle)
          positions.push({
            lat: centerLat + metersToLat(offsetLat),
            lon: centerLon + metersToLon(offsetLon, centerLat),
            alt: altitude
          })
        }
        break

      case 'v-shape':
        // Drones in V formation
        const halfCount = Math.floor(count / 2)
        for (let i = 0; i < count; i++) {
          let offsetLat, offsetLon
          if (i === 0) {
            // Leader at the front
            offsetLat = 0
            offsetLon = 0
          } else if (i <= halfCount) {
            // Left wing
            offsetLat = -i * spacing * 0.7
            offsetLon = -i * spacing
          } else {
            // Right wing
            const pos = i - halfCount
            offsetLat = -pos * spacing * 0.7
            offsetLon = pos * spacing
          }
          positions.push({
            lat: centerLat + metersToLat(offsetLat),
            lon: centerLon + metersToLon(offsetLon, centerLat),
            alt: altitude
          })
        }
        break

      default:
        // Default to line formation
        for (let i = 0; i < count; i++) {
          const offset = (i - (count - 1) / 2) * spacing
          positions.push({
            lat: centerLat,
            lon: centerLon + metersToLon(offset, centerLat),
            alt: altitude
          })
        }
    }

    return positions
  }

  return {
    // State
    drones: state.drones,
    connectedDrones,
    getDrone,
    formations: state.formations,
    activeFormation: computed(() => state.activeFormation),
    listFormations,

    // Actions
    connect,
    disconnect,
    getTelemetry,
    subscribeToTelemetry,
    arm,
    takeoff,
    land,
    rtl,
    setMode,
    goto,
    uploadMission,
    downloadMission,
    startMission,
    pauseMission,
    resumeMission,
    listDrones,

    // Formation actions
    createFormation,
    deleteFormation,
    setActiveFormation,
    getFormation,
    executeFormationCommand,
    moveFormation
  }
}
