/**
 * AeroMonitoring Store
 * Pinia store for drone fleet management
 * Issue #5196 - Stage 2: Drone Fleet Management
 */

import { defineStore } from 'pinia'
import { aeroService } from '@/services/aeroService'

export const useAeroStore = defineStore('aero', {
  state: () => ({
    // Drones
    drones: [],
    selectedDrone: null,

    // Missions
    missions: [],
    selectedMission: null,

    // UI state
    loading: false,
    error: null,

    // Fleet statistics
    fleetStats: {
      total: 0,
      active: 0,
      maintenance: 0,
      retired: 0,
      totalFlightTime: 0,
      averageBattery: 0,
      dronesOnMission: 0
    }
  }),

  actions: {
    /**
     * Fetch all drones from API
     * @param {Object} params - Query parameters
     */
    async fetchDrones(params = {}) {
      this.loading = true
      this.error = null

      try {
        const response = await aeroService.getDrones(params)

        if (response.success && response.drones) {
          // Transform backend response format (snake_case) to application format (camelCase)
          this.drones = response.drones.map(drone => ({
            id: drone.id,
            name: drone.name,
            model: drone.model || '',
            serialNumber: drone.serial_number || '',
            status: drone.status || 'Active',
            lastLatitude: parseFloat(drone.last_latitude) || null,
            lastLongitude: parseFloat(drone.last_longitude) || null,
            batteryLevel: parseFloat(drone.battery_level) || 0,
            flightTime: parseFloat(drone.flight_time) || 0,
            lastMaintenanceDate: drone.last_maintenance || null,
            lastFlight: drone.last_flight || null
          }))
        }
      } catch (error) {
        console.error('Error fetching drones:', error)
        this.error = error.response?.data?.message || error.message || 'Failed to fetch drones'
      } finally {
        this.loading = false
      }
    },

    /**
     * Fetch single drone by ID
     * @param {string|number} id - Drone ID
     */
    async fetchDrone(id) {
      this.loading = true
      this.error = null

      try {
        const response = await aeroService.getDrone(id)

        if (response.success) {
          this.selectedDrone = {
            id: response.data.obj.id,
            name: response.data.obj.val,
            ...response.data.reqs
          }
        }
      } catch (error) {
        console.error('Error fetching drone:', error)
        this.error = error.response?.data?.message || error.message
      } finally {
        this.loading = false
      }
    },

    /**
     * Create new drone
     * @param {Object} droneData - Drone information
     * @returns {Promise<Object>} Created drone
     */
    async createDrone(droneData) {
      this.loading = true
      this.error = null

      try {
        const response = await aeroService.createDrone(droneData)

        if (response.success) {
          // Add to local state
          const newDrone = {
            id: response.data.id,
            name: droneData.name,
            ...droneData
          }
          this.drones.push(newDrone)

          // Update stats
          await this.fetchFleetStats()

          return newDrone
        }
      } catch (error) {
        console.error('Error creating drone:', error)
        this.error = error.response?.data?.message || error.message
        throw error
      } finally {
        this.loading = false
      }
    },

    /**
     * Update existing drone
     * @param {string|number} id - Drone ID
     * @param {Object} droneData - Updated drone information
     * @returns {Promise<Object>} Updated drone
     */
    async updateDrone(id, droneData) {
      this.loading = true
      this.error = null

      try {
        const response = await aeroService.updateDrone(id, droneData)

        if (response.success) {
          // Update in local state
          const index = this.drones.findIndex(d => d.id === id)
          if (index !== -1) {
            this.drones[index] = {
              ...this.drones[index],
              ...droneData
            }
          }

          // Update stats
          await this.fetchFleetStats()

          return this.drones[index]
        }
      } catch (error) {
        console.error('Error updating drone:', error)
        this.error = error.response?.data?.message || error.message
        throw error
      } finally {
        this.loading = false
      }
    },

    /**
     * Delete drone
     * @param {string|number} id - Drone ID
     */
    async deleteDrone(id) {
      this.loading = true
      this.error = null

      try {
        const response = await aeroService.deleteDrone(id)

        if (response.success) {
          // Remove from local state
          this.drones = this.drones.filter(d => d.id !== id)

          // Clear selection if deleted drone was selected
          if (this.selectedDrone?.id === id) {
            this.selectedDrone = null
          }

          // Update stats
          await this.fetchFleetStats()
        }
      } catch (error) {
        console.error('Error deleting drone:', error)
        this.error = error.response?.data?.message || error.message
        throw error
      } finally {
        this.loading = false
      }
    },

    /**
     * Update drone status
     * @param {string|number} id - Drone ID
     * @param {string} status - New status
     */
    async updateDroneStatus(id, status) {
      try {
        const response = await aeroService.updateDroneStatus(id, status)

        if (response.success) {
          // Update in local state
          const index = this.drones.findIndex(d => d.id === id)
          if (index !== -1) {
            this.drones[index].status = status
          }

          // Update stats
          await this.fetchFleetStats()
        }
      } catch (error) {
        console.error('Error updating drone status:', error)
        this.error = error.response?.data?.message || error.message
        throw error
      }
    },

    /**
     * Update drone location
     * @param {string|number} id - Drone ID
     * @param {number} latitude - Latitude
     * @param {number} longitude - Longitude
     */
    async updateDroneLocation(id, latitude, longitude) {
      try {
        const response = await aeroService.updateDroneLocation(id, latitude, longitude)

        if (response.success) {
          // Update in local state
          const index = this.drones.findIndex(d => d.id === id)
          if (index !== -1) {
            this.drones[index].lastLatitude = latitude
            this.drones[index].lastLongitude = longitude
          }
        }
      } catch (error) {
        console.error('Error updating drone location:', error)
        this.error = error.response?.data?.message || error.message
        throw error
      }
    },

    /**
     * Update drone battery level
     * @param {string|number} id - Drone ID
     * @param {number} batteryLevel - Battery level (0-100)
     */
    async updateDroneBattery(id, batteryLevel) {
      try {
        const response = await aeroService.updateDroneBattery(id, batteryLevel)

        if (response.success) {
          // Update in local state
          const index = this.drones.findIndex(d => d.id === id)
          if (index !== -1) {
            this.drones[index].batteryLevel = batteryLevel
          }
        }
      } catch (error) {
        console.error('Error updating drone battery:', error)
        this.error = error.response?.data?.message || error.message
        throw error
      }
    },

    /**
     * Fetch fleet statistics
     */
    async fetchFleetStats() {
      try {
        const response = await aeroService.getFleetStats()

        if (response.success) {
          this.fleetStats = {
            total: response.total || 0,
            active: response.active || 0,
            maintenance: response.maintenance || 0,
            retired: response.retired || 0,
            totalFlightTime: response.totalFlightTime || 0,
            averageBattery: response.averageBattery || 0,
            dronesOnMission: response.dronesOnMission || 0
          }
        }
      } catch (error) {
        console.error('Error fetching fleet stats:', error)
      }
    },

    /**
     * Select drone
     * @param {Object} drone - Drone object
     */
    selectDrone(drone) {
      this.selectedDrone = drone
    },

    /**
     * Clear selection
     */
    clearSelection() {
      this.selectedDrone = null
    },

    /**
     * Clear error
     */
    clearError() {
      this.error = null
    },

    // ==================== Mission Management ====================

    /**
     * Fetch all missions
     * @param {Object} params - Query parameters
     */
    async fetchMissions(params = {}) {
      this.loading = true
      this.error = null

      try {
        const response = await aeroService.getMissions(params)

        if (response.success) {
          this.missions = response.missions.map(mission => ({
            id: mission.id,
            name: mission.val,
            ...response.reqs?.[mission.id],
            createdAt: mission.created_at,
            updatedAt: mission.updated_at
          }))
        }
      } catch (error) {
        console.error('Error fetching missions:', error)
        this.error = error.response?.data?.message || error.message
      } finally {
        this.loading = false
      }
    },

    /**
     * Fetch single mission by ID
     * @param {string|number} id - Mission ID
     */
    async fetchMission(id) {
      this.loading = true
      this.error = null

      try {
        const response = await aeroService.getMission(id)

        if (response.success) {
          this.selectedMission = {
            id: response.data.obj.id,
            name: response.data.obj.val,
            ...response.data.reqs
          }
          return this.selectedMission
        }
      } catch (error) {
        console.error('Error fetching mission:', error)
        this.error = error.response?.data?.message || error.message
      } finally {
        this.loading = false
      }
    },

    /**
     * Create new mission
     * @param {Object} missionData - Mission information
     * @returns {Promise<Object>} Created mission
     */
    async createMission(missionData) {
      this.loading = true
      this.error = null

      try {
        const response = await aeroService.createMission(missionData)

        if (response.success) {
          const newMission = {
            id: response.data.id,
            name: missionData.name,
            ...missionData,
            createdAt: new Date().toISOString()
          }
          this.missions.push(newMission)

          return newMission
        }
      } catch (error) {
        console.error('Error creating mission:', error)
        this.error = error.response?.data?.message || error.message
        throw error
      } finally {
        this.loading = false
      }
    },

    /**
     * Update existing mission
     * @param {string|number} id - Mission ID
     * @param {Object} missionData - Updated mission information
     * @returns {Promise<Object>} Updated mission
     */
    async updateMission(id, missionData) {
      this.loading = true
      this.error = null

      try {
        const response = await aeroService.updateMission(id, missionData)

        if (response.success) {
          const index = this.missions.findIndex(m => m.id === id)
          if (index !== -1) {
            this.missions[index] = {
              ...this.missions[index],
              ...missionData,
              updatedAt: new Date().toISOString()
            }
          }

          return this.missions[index]
        }
      } catch (error) {
        console.error('Error updating mission:', error)
        this.error = error.response?.data?.message || error.message
        throw error
      } finally {
        this.loading = false
      }
    },

    /**
     * Delete mission
     * @param {string|number} id - Mission ID
     */
    async deleteMission(id) {
      this.loading = true
      this.error = null

      try {
        const response = await aeroService.deleteMission(id)

        if (response.success) {
          this.missions = this.missions.filter(m => m.id !== id)

          if (this.selectedMission?.id === id) {
            this.selectedMission = null
          }
        }
      } catch (error) {
        console.error('Error deleting mission:', error)
        this.error = error.response?.data?.message || error.message
        throw error
      } finally {
        this.loading = false
      }
    },

    /**
     * Update mission status
     * @param {string|number} id - Mission ID
     * @param {string} status - New status
     */
    async updateMissionStatus(id, status) {
      try {
        const response = await aeroService.updateMissionStatus(id, status)

        if (response.success) {
          const index = this.missions.findIndex(m => m.id === id)
          if (index !== -1) {
            this.missions[index].status = status
          }
        }
      } catch (error) {
        console.error('Error updating mission status:', error)
        this.error = error.response?.data?.message || error.message
        throw error
      }
    },

    /**
     * Launch mission (start flight)
     * @param {string|number} id - Mission ID
     */
    async launchMission(id) {
      try {
        const response = await aeroService.launchMission(id)

        if (response.success) {
          await this.updateMissionStatus(id, 'InFlight')
        }

        return response
      } catch (error) {
        console.error('Error launching mission:', error)
        this.error = error.response?.data?.message || error.message
        throw error
      }
    },

    /**
     * Stop mission
     * @param {string|number} id - Mission ID
     */
    async stopMission(id) {
      try {
        const response = await aeroService.stopMission(id)

        if (response.success) {
          await this.updateMissionStatus(id, 'Cancelled')
        }

        return response
      } catch (error) {
        console.error('Error stopping mission:', error)
        this.error = error.response?.data?.message || error.message
        throw error
      }
    },

    /**
     * Select mission
     * @param {Object} mission - Mission object
     */
    selectMission(mission) {
      this.selectedMission = mission
    },

    /**
     * Clear mission selection
     */
    clearMissionSelection() {
      this.selectedMission = null
    }
  },

  getters: {
    /**
     * Get active drones
     */
    activeDrones: (state) => {
      return state.drones.filter(d => d.status === 'Active')
    },

    /**
     * Get drones in maintenance
     */
    maintenanceDrones: (state) => {
      return state.drones.filter(d => d.status === 'Maintenance')
    },

    /**
     * Get retired drones
     */
    retiredDrones: (state) => {
      return state.drones.filter(d => d.status === 'Retired')
    },

    /**
     * Get total flight time (in hours)
     */
    totalFlightTime: (state) => {
      const totalMinutes = state.drones.reduce((sum, d) => sum + (d.flightTime || 0), 0)
      return Math.round(totalMinutes / 60 * 10) / 10 // Round to 1 decimal
    },

    /**
     * Get average battery level
     */
    averageBatteryLevel: (state) => {
      if (state.drones.length === 0) return 0

      const total = state.drones.reduce((sum, d) => sum + (d.batteryLevel || 0), 0)
      return Math.round(total / state.drones.length)
    },

    /**
     * Get drones with low battery (< 20%)
     */
    lowBatteryDrones: (state) => {
      return state.drones.filter(d => d.batteryLevel < 20)
    },

    /**
     * Get drones needing maintenance
     * (either in Maintenance status or low battery)
     */
    dronesNeedingAttention: (state) => {
      return state.drones.filter(d =>
        d.status === 'Maintenance' || d.batteryLevel < 20
      )
    },

    /**
     * Get drone by ID
     */
    getDroneById: (state) => (id) => {
      return state.drones.find(d => d.id === id)
    }
  }
})

export default useAeroStore
