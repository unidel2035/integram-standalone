/**
 * AeroMonitoring Service - Backend API Integration
 * Использует backend endpoints для работы с базой dmonitor через MCP Integram
 */

import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api'

/**
 * Drone API Service
 */
export const aeroService = {
  /**
   * Get all drones
   */
  async getDrones(params = {}) {
    try {
      const response = await axios.get(`${API_BASE_URL}/aero/drones`, { params })

      if (response.data.success) {
        return {
          success: true,
          drones: response.data.drones || []
        }
      }

      return { success: false, drones: [] }
    } catch (error) {
      console.error('[aeroService] Error fetching drones:', error)
      return { success: false, drones: [] }
    }
  },

  /**
   * Get single drone by ID
   */
  async getDrone(id) {
    try {
      const response = await axios.get(`${API_BASE_URL}/aero/drones/${id}`)

      if (response.data.success) {
        return {
          success: true,
          data: response.data.drone
        }
      }

      return { success: false }
    } catch (error) {
      console.error('[aeroService] Error fetching drone:', error)
      return { success: false }
    }
  },

  /**
   * Create new drone
   */
  async createDrone(droneData) {
    try {
      const response = await axios.post(`${API_BASE_URL}/aero/drones`, droneData)

      if (response.data.success) {
        return {
          success: true,
          id: response.data.data?.id || response.data.drone?.id
        }
      }

      return { success: false }
    } catch (error) {
      console.error('[aeroService] Error creating drone:', error)
      return { success: false }
    }
  },

  /**
   * Update existing drone
   */
  async updateDrone(id, droneData) {
    try {
      const response = await axios.put(`${API_BASE_URL}/aero/drones/${id}`, droneData)

      return { success: response.data.success }
    } catch (error) {
      console.error('[aeroService] Error updating drone:', error)
      return { success: false }
    }
  },

  /**
   * Delete drone
   */
  async deleteDrone(id) {
    try {
      const response = await axios.delete(`${API_BASE_URL}/aero/drones/${id}`)

      return { success: response.data.success }
    } catch (error) {
      console.error('[aeroService] Error deleting drone:', error)
      return { success: false }
    }
  },

  /**
   * Get fleet statistics
   */
  async getFleetStats() {
    try {
      const response = await axios.get(`${API_BASE_URL}/aero/drones/stats`)

      if (response.data.success) {
        const stats = response.data.data || {}
        return {
          success: true,
          total: stats.total || 0,
          active: stats.active || 0,
          maintenance: stats.maintenance || 0,
          retired: stats.retired || 0,
          totalFlightTime: stats.totalFlightTime || 0,
          averageBattery: stats.averageBattery || 0,
          dronesOnMission: stats.dronesOnMission || 0
        }
      }

      return { success: false }
    } catch (error) {
      console.error('[aeroService] Error fetching stats:', error)
      return { success: false }
    }
  },

  // Дополнительные методы
  async updateDroneStatus(id, status) {
    return this.updateDrone(id, { status })
  },

  async updateDroneLocation(id, latitude, longitude) {
    return this.updateDrone(id, {
      last_latitude: latitude,
      last_longitude: longitude
    })
  },

  async updateDroneBattery(id, batteryLevel) {
    return this.updateDrone(id, { battery_level: batteryLevel })
  },

  // Missions API
  async getMissions(params = {}) {
    try {
      const response = await axios.get(`${API_BASE_URL}/aero/missions`, { params })

      if (response.data.success) {
        return {
          success: true,
          missions: response.data.data || [],
          reqs: response.data.reqs || {}
        }
      }

      return { success: false, missions: [] }
    } catch (error) {
      console.error('[aeroService] Error fetching missions:', error)
      return { success: false, missions: [] }
    }
  },

  async getMission(id) {
    try {
      const response = await axios.get(`${API_BASE_URL}/aero/missions/${id}`)

      if (response.data.success) {
        return {
          success: true,
          data: response.data.mission
        }
      }

      return { success: false }
    } catch (error) {
      console.error('[aeroService] Error fetching mission:', error)
      return { success: false }
    }
  },

  async createMission(missionData) {
    try {
      // Convert camelCase to snake_case for backend
      const backendData = {
        name: missionData.name,
        description: missionData.description || '',
        drone_id: missionData.droneId,
        route: missionData.route || '{}',
        polygon: missionData.polygon || null,
        altitude: missionData.altitude || 100,
        speed: missionData.speed || 5,
        overlap: missionData.overlap || 75,
        camera_angle: missionData.cameraAngle || 0,
        status: missionData.status || 'Draft',
        scheduled_date: missionData.scheduledDate || null,
        calculated_stats: missionData.calculatedStats || null
      }

      const response = await axios.post(`${API_BASE_URL}/aero/missions`, backendData)

      if (response.data.success) {
        return {
          success: true,
          data: {
            id: response.data.mission.id,
            ...response.data.mission
          }
        }
      }

      return { success: false }
    } catch (error) {
      console.error('[aeroService] Error creating mission:', error)
      throw error
    }
  },

  async updateMission(id, missionData) {
    try {
      // Convert camelCase to snake_case for backend
      const backendData = {
        name: missionData.name,
        description: missionData.description,
        drone_id: missionData.droneId,
        route: missionData.route,
        polygon: missionData.polygon,
        altitude: missionData.altitude,
        speed: missionData.speed,
        overlap: missionData.overlap,
        camera_angle: missionData.cameraAngle,
        status: missionData.status,
        scheduled_date: missionData.scheduledDate,
        calculated_stats: missionData.calculatedStats
      }

      const response = await axios.put(`${API_BASE_URL}/aero/missions/${id}`, backendData)

      return { success: response.data.success }
    } catch (error) {
      console.error('[aeroService] Error updating mission:', error)
      return { success: false }
    }
  },

  async deleteMission(id) {
    try {
      const response = await axios.delete(`${API_BASE_URL}/aero/missions/${id}`)

      return { success: response.data.success }
    } catch (error) {
      console.error('[aeroService] Error deleting mission:', error)
      return { success: false }
    }
  },

  async updateMissionStatus(id, status) {
    return { success: true }
  },

  async calculateMission(params) {
    return { success: true }
  },

  async generateMissionRoute(id, params) {
    return { success: true }
  },

  async getMissionRoute(id) {
    return { success: true }
  },

  async launchMission(id) {
    return { success: true }
  },

  async stopMission(id) {
    return { success: true }
  }
}

export default aeroService
