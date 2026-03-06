import { logger } from '@/utils/logger'
/**
 * Vue reactive store for agricultural mission management
 */

import { reactive, computed } from 'vue'
import axios from 'axios'

// Always use empty string for relative URLs to avoid CORS issues
// Development: Vite proxy forwards /api/* to localhost:8081
// Production: Nginx proxy forwards /api/* to https://drondoc.ru
const API_BASE_URL = ''

// Demo data for fields
const demoFields = [
  {
    id: 1,
    name: 'Поле №1 (Пшеница)',
    farm_name: 'Агрохозяйство "Рассвет"',
    area: 45.5,
    crop_type: 'Пшеница озимая',
    coordinates: [[37.6, 55.7], [37.61, 55.7], [37.61, 55.71], [37.6, 55.71]],
    is_active: true,
    created_at: new Date().toISOString(),
    soil_type: 'Чернозем',
    irrigation_available: true
  },
  {
    id: 2,
    name: 'Поле №2 (Кукуруза)',
    farm_name: 'Агрохозяйство "Рассвет"',
    area: 32.8,
    crop_type: 'Кукуруза',
    coordinates: [[37.62, 55.7], [37.63, 55.7], [37.63, 55.71], [37.62, 55.71]],
    is_active: true,
    created_at: new Date().toISOString(),
    soil_type: 'Суглинок',
    irrigation_available: false
  },
  {
    id: 3,
    name: 'Поле №3 (Подсолнечник)',
    farm_name: 'Ферма "Золотое поле"',
    area: 28.3,
    crop_type: 'Подсолнечник',
    coordinates: [[37.64, 55.7], [37.65, 55.7], [37.65, 55.71], [37.64, 55.71]],
    is_active: true,
    created_at: new Date().toISOString(),
    soil_type: 'Чернозем',
    irrigation_available: true
  }
]

// Demo data for recipes
const demoRecipes = [
  {
    id: 1,
    name: 'Комплексное удобрение NPK',
    recipe_type: 'fertilizer',
    application_rate: 200,
    droplet_size: 300,
    ingredients: [
      { name: 'Азот (N)', concentration: 20, unit: '%' },
      { name: 'Фосфор (P)', concentration: 20, unit: '%' },
      { name: 'Калий (K)', concentration: 20, unit: '%' }
    ],
    is_active: true,
    weather_requirements: {
      temperature: { min: 15, max: 25 },
      wind_speed: { max: 5 },
      humidity: { min: 40, max: 80 }
    },
    created_at: new Date().toISOString()
  },
  {
    id: 2,
    name: 'Инсектицид от вредителей',
    recipe_type: 'pesticide',
    application_rate: 150,
    droplet_size: 200,
    ingredients: [
      { name: 'Имидаклоприд', concentration: 5, unit: '%' },
      { name: 'Прилипатель', concentration: 0.1, unit: '%' }
    ],
    is_active: true,
    weather_requirements: {
      temperature: { min: 12, max: 28 },
      wind_speed: { max: 3 },
      humidity: { min: 50, max: 90 }
    },
    created_at: new Date().toISOString()
  },
  {
    id: 3,
    name: 'Раствор для опыления',
    recipe_type: 'pollination',
    application_rate: 100,
    droplet_size: 150,
    ingredients: [
      { name: 'Пыльца', concentration: 15, unit: 'г/л' },
      { name: 'Сахарный сироп', concentration: 10, unit: '%' }
    ],
    is_active: true,
    weather_requirements: {
      temperature: { min: 15, max: 25 },
      wind_speed: { max: 4 },
      humidity: { min: 40, max: 70 }
    },
    created_at: new Date().toISOString()
  }
]

// Demo data for drones
const demoDrones = [
  {
    id: 1,
    name: 'Агродрон-1',
    model: 'DJI Agras T40',
    tank_capacity: 40,
    spray_width: 11,
    max_flight_time: 1200,
    status: 'available',
    is_active: true,
    battery_level: 95,
    location: { lat: 55.7, lng: 37.6 },
    created_at: new Date().toISOString()
  },
  {
    id: 2,
    name: 'Агродрон-2',
    model: 'DJI Agras T30',
    tank_capacity: 30,
    spray_width: 9,
    max_flight_time: 1080,
    status: 'available',
    is_active: true,
    battery_level: 87,
    location: { lat: 55.71, lng: 37.62 },
    created_at: new Date().toISOString()
  },
  {
    id: 3,
    name: 'Агродрон-3',
    model: 'XAG P100',
    tank_capacity: 50,
    spray_width: 12,
    max_flight_time: 900,
    status: 'available',
    is_active: true,
    battery_level: 100,
    location: { lat: 55.72, lng: 37.64 },
    created_at: new Date().toISOString()
  }
]

const state = reactive({
  fields: [],
  recipes: [],
  orders: [],
  drones: [],
  missions: [],
  activeMission: null,
  telemetry: new Map(),
  websockets: new Map()
})

export const useAgriculturalStore = () => {
  // Getters
  const activeFields = computed(() => state.fields.filter((f) => f.is_active))
  const activeRecipes = computed(() => state.recipes.filter((r) => r.is_active))
  const availableDrones = computed(() =>
    state.drones.filter((d) => d.is_active && d.status === 'available')
  )
  const activeMissions = computed(() =>
    state.missions.filter((m) =>
      ['planned', 'ready', 'in_progress', 'paused'].includes(m.status)
    )
  )

  // ============================================================
  // FIELDS ACTIONS
  // ============================================================

  const fetchFields = async (filters = {}) => {
    try {
      const params = new URLSearchParams(filters)
      const response = await axios.get(`${API_BASE_URL}/api/agriculture/fields?${params}`)
      state.fields = response.data.fields
      return response.data.fields
    } catch (error) {
      console.error('Failed to fetch fields:', error)
      // Use demo data if API is unavailable
      logger.debug('Using demo fields data')
      state.fields = demoFields
      return demoFields
    }
  }

  const getField = async (id) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/agriculture/fields/${id}`)
      return response.data.field
    } catch (error) {
      console.error('Failed to get field:', error)
      throw error
    }
  }

  const createField = async (fieldData) => {
    try {
      const response = await axios.post(`${API_BASE_URL}/api/agriculture/fields`, fieldData)
      state.fields.push(response.data.field)
      return response.data.field
    } catch (error) {
      console.error('Failed to create field:', error)
      throw error
    }
  }

  const updateField = async (id, updates) => {
    try {
      const response = await axios.put(`${API_BASE_URL}/api/agriculture/fields/${id}`, updates)
      const index = state.fields.findIndex((f) => f.id === id)
      if (index !== -1) {
        state.fields[index] = response.data.field
      }
      return response.data.field
    } catch (error) {
      console.error('Failed to update field:', error)
      throw error
    }
  }

  const deleteField = async (id) => {
    try {
      await axios.delete(`${API_BASE_URL}/api/agriculture/fields/${id}`)
      state.fields = state.fields.filter((f) => f.id !== id)
    } catch (error) {
      console.error('Failed to delete field:', error)
      throw error
    }
  }

  // ============================================================
  // RECIPES ACTIONS
  // ============================================================

  const fetchRecipes = async (filters = {}) => {
    try {
      const params = new URLSearchParams(filters)
      const response = await axios.get(`${API_BASE_URL}/api/agriculture/recipes?${params}`)
      state.recipes = response.data.recipes
      return response.data.recipes
    } catch (error) {
      console.error('Failed to fetch recipes:', error)
      // Use demo data if API is unavailable
      logger.debug('Using demo recipes data')
      state.recipes = demoRecipes
      return demoRecipes
    }
  }

  const getRecipe = async (id) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/agriculture/recipes/${id}`)
      return response.data.recipe
    } catch (error) {
      console.error('Failed to get recipe:', error)
      throw error
    }
  }

  const createRecipe = async (recipeData) => {
    try {
      const response = await axios.post(`${API_BASE_URL}/api/agriculture/recipes`, recipeData)
      state.recipes.push(response.data.recipe)
      return response.data.recipe
    } catch (error) {
      console.error('Failed to create recipe:', error)
      throw error
    }
  }

  const updateRecipe = async (id, updates) => {
    try {
      const response = await axios.put(`${API_BASE_URL}/api/agriculture/recipes/${id}`, updates)
      const index = state.recipes.findIndex((r) => r.id === id)
      if (index !== -1) {
        state.recipes[index] = response.data.recipe
      }
      return response.data.recipe
    } catch (error) {
      console.error('Failed to update recipe:', error)
      throw error
    }
  }

  const deleteRecipe = async (id) => {
    try {
      await axios.delete(`${API_BASE_URL}/api/agriculture/recipes/${id}`)
      state.recipes = state.recipes.filter((r) => r.id !== id)
    } catch (error) {
      console.error('Failed to delete recipe:', error)
      throw error
    }
  }

  // ============================================================
  // ORDERS ACTIONS
  // ============================================================

  const fetchOrders = async (filters = {}) => {
    try {
      const params = new URLSearchParams(filters)
      const response = await axios.get(`${API_BASE_URL}/api/agriculture/orders?${params}`)
      state.orders = response.data.orders
      return response.data.orders
    } catch (error) {
      console.error('Failed to fetch orders:', error)
      throw error
    }
  }

  const getOrder = async (id) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/agriculture/orders/${id}`)
      return response.data.order
    } catch (error) {
      console.error('Failed to get order:', error)
      throw error
    }
  }

  const createOrder = async (orderData) => {
    try {
      const response = await axios.post(`${API_BASE_URL}/api/agriculture/orders`, orderData)
      state.orders.push(response.data.order)
      return response.data.order
    } catch (error) {
      console.error('Failed to create order:', error)
      throw error
    }
  }

  const updateOrder = async (id, updates) => {
    try {
      const response = await axios.put(`${API_BASE_URL}/api/agriculture/orders/${id}`, updates)
      const index = state.orders.findIndex((o) => o.id === id)
      if (index !== -1) {
        state.orders[index] = response.data.order
      }
      return response.data.order
    } catch (error) {
      console.error('Failed to update order:', error)
      throw error
    }
  }

  const deleteOrder = async (id) => {
    try {
      await axios.delete(`${API_BASE_URL}/api/agriculture/orders/${id}`)
      state.orders = state.orders.filter((o) => o.id !== id)
    } catch (error) {
      console.error('Failed to delete order:', error)
      throw error
    }
  }

  // ============================================================
  // DRONES ACTIONS
  // ============================================================

  const fetchDrones = async (filters = {}) => {
    try {
      const params = new URLSearchParams(filters)
      const response = await axios.get(`${API_BASE_URL}/api/agriculture/drones?${params}`)
      state.drones = response.data.drones
      return response.data.drones
    } catch (error) {
      console.error('Failed to fetch drones:', error)
      // Use demo data if API is unavailable
      logger.debug('Using demo drones data')
      state.drones = demoDrones
      return demoDrones
    }
  }

  const getDrone = async (id) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/agriculture/drones/${id}`)
      return response.data.drone
    } catch (error) {
      console.error('Failed to get drone:', error)
      throw error
    }
  }

  const createDrone = async (droneData) => {
    try {
      const response = await axios.post(`${API_BASE_URL}/api/agriculture/drones`, droneData)
      state.drones.push(response.data.drone)
      return response.data.drone
    } catch (error) {
      console.error('Failed to create drone:', error)
      throw error
    }
  }

  const updateDrone = async (id, updates) => {
    try {
      const response = await axios.put(`${API_BASE_URL}/api/agriculture/drones/${id}`, updates)
      const index = state.drones.findIndex((d) => d.id === id)
      if (index !== -1) {
        state.drones[index] = response.data.drone
      }
      return response.data.drone
    } catch (error) {
      console.error('Failed to update drone:', error)
      throw error
    }
  }

  const deleteDrone = async (id) => {
    try {
      await axios.delete(`${API_BASE_URL}/api/agriculture/drones/${id}`)
      state.drones = state.drones.filter((d) => d.id !== id)
    } catch (error) {
      console.error('Failed to delete drone:', error)
      throw error
    }
  }

  // ============================================================
  // MISSIONS ACTIONS
  // ============================================================

  const fetchMissions = async (filters = {}) => {
    try {
      const params = new URLSearchParams(filters)
      const response = await axios.get(`${API_BASE_URL}/api/agriculture/missions?${params}`)
      state.missions = response.data.missions
      return response.data.missions
    } catch (error) {
      console.error('Failed to fetch missions:', error)
      throw error
    }
  }

  const getMission = async (id) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/agriculture/missions/${id}`)
      return response.data.mission
    } catch (error) {
      console.error('Failed to get mission:', error)
      throw error
    }
  }

  const createMission = async (missionData) => {
    try {
      const response = await axios.post(`${API_BASE_URL}/api/agriculture/missions`, missionData)
      state.missions.push(response.data.mission)
      return response.data
    } catch (error) {
      console.error('Failed to create mission:', error)
      throw error
    }
  }

  const generateRoute = async (missionId) => {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/api/agriculture/missions/${missionId}/route`
      )
      return response.data
    } catch (error) {
      console.error('Failed to generate route:', error)
      throw error
    }
  }

  const getWaypoints = async (missionId) => {
    try {
      const response = await axios.get(
        `${API_BASE_URL}/api/agriculture/missions/${missionId}/waypoints`
      )
      return response.data.waypoints
    } catch (error) {
      console.error('Failed to get waypoints:', error)
      throw error
    }
  }

  const optimizeRoute = async (missionId, weatherData) => {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/api/agriculture/missions/${missionId}/optimize`,
        weatherData
      )
      return response.data
    } catch (error) {
      console.error('Failed to optimize route:', error)
      throw error
    }
  }

  const simulateMission = async (missionId) => {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/api/agriculture/missions/${missionId}/simulate`
      )
      return response.data.simulation
    } catch (error) {
      console.error('Failed to simulate mission:', error)
      throw error
    }
  }

  const startMission = async (missionId, weatherData) => {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/api/agriculture/missions/${missionId}/start`,
        { weather_data: weatherData }
      )
      const index = state.missions.findIndex((m) => m.id === missionId)
      if (index !== -1) {
        state.missions[index] = response.data.mission
      }
      state.activeMission = response.data.mission
      return response.data.mission
    } catch (error) {
      console.error('Failed to start mission:', error)
      throw error
    }
  }

  const pauseMission = async (missionId) => {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/api/agriculture/missions/${missionId}/pause`
      )
      const index = state.missions.findIndex((m) => m.id === missionId)
      if (index !== -1) {
        state.missions[index] = response.data.mission
      }
      return response.data.mission
    } catch (error) {
      console.error('Failed to pause mission:', error)
      throw error
    }
  }

  const resumeMission = async (missionId) => {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/api/agriculture/missions/${missionId}/resume`
      )
      const index = state.missions.findIndex((m) => m.id === missionId)
      if (index !== -1) {
        state.missions[index] = response.data.mission
      }
      return response.data.mission
    } catch (error) {
      console.error('Failed to resume mission:', error)
      throw error
    }
  }

  const abortMission = async (missionId, reason) => {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/api/agriculture/missions/${missionId}/abort`,
        { reason }
      )
      const index = state.missions.findIndex((m) => m.id === missionId)
      if (index !== -1) {
        state.missions[index] = response.data.mission
      }
      if (state.activeMission?.id === missionId) {
        state.activeMission = null
      }
      return response.data.mission
    } catch (error) {
      console.error('Failed to abort mission:', error)
      throw error
    }
  }

  const completeMission = async (missionId, results) => {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/api/agriculture/missions/${missionId}/complete`,
        results
      )
      const index = state.missions.findIndex((m) => m.id === missionId)
      if (index !== -1) {
        state.missions[index] = response.data.mission
      }
      if (state.activeMission?.id === missionId) {
        state.activeMission = null
      }
      return response.data.mission
    } catch (error) {
      console.error('Failed to complete mission:', error)
      throw error
    }
  }

  const getTelemetry = async (missionId, options = {}) => {
    try {
      const params = new URLSearchParams(options)
      const response = await axios.get(
        `${API_BASE_URL}/api/agriculture/missions/${missionId}/telemetry?${params}`
      )
      return response.data.telemetry
    } catch (error) {
      console.error('Failed to get telemetry:', error)
      throw error
    }
  }

  const addTelemetry = async (missionId, telemetryData) => {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/api/agriculture/missions/${missionId}/telemetry`,
        telemetryData
      )
      return response.data.telemetry
    } catch (error) {
      console.error('Failed to add telemetry:', error)
      throw error
    }
  }

  const getCoverage = async (missionId) => {
    try {
      const response = await axios.get(
        `${API_BASE_URL}/api/agriculture/missions/${missionId}/coverage`
      )
      return response.data.coverage
    } catch (error) {
      console.error('Failed to get coverage:', error)
      throw error
    }
  }

  const getEvents = async (missionId) => {
    try {
      const response = await axios.get(
        `${API_BASE_URL}/api/agriculture/missions/${missionId}/events`
      )
      return response.data.events
    } catch (error) {
      console.error('Failed to get events:', error)
      throw error
    }
  }

  const getAnalytics = async (missionId) => {
    try {
      const response = await axios.get(
        `${API_BASE_URL}/api/agriculture/missions/${missionId}/analytics`
      )
      return response.data.analytics
    } catch (error) {
      console.error('Failed to get analytics:', error)
      throw error
    }
  }

  // ============================================================
  // CALCULATOR ACTIONS
  // ============================================================

  const calculateSpraying = async (params) => {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/api/agriculture/calculator/spraying`,
        params
      )
      return response.data
    } catch (error) {
      console.error('Failed to calculate spraying:', error)
      throw error
    }
  }

  const calculateFlightTime = async (params) => {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/api/agriculture/calculator/flight-time`,
        params
      )
      return response.data
    } catch (error) {
      console.error('Failed to calculate flight time:', error)
      throw error
    }
  }

  const getOptimalParams = async (weatherData) => {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/api/agriculture/calculator/optimal-params`,
        weatherData
      )
      return response.data
    } catch (error) {
      console.error('Failed to get optimal params:', error)
      throw error
    }
  }

  const calculateCoverageArea = async (path, sprayWidth) => {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/api/agriculture/calculator/coverage-area`,
        { path, spray_width: sprayWidth }
      )
      return response.data
    } catch (error) {
      console.error('Failed to calculate coverage area:', error)
      throw error
    }
  }

  // Return store interface
  return {
    // State
    state,

    // Getters
    activeFields,
    activeRecipes,
    availableDrones,
    activeMissions,

    // Fields
    fetchFields,
    getField,
    createField,
    updateField,
    deleteField,

    // Recipes
    fetchRecipes,
    getRecipe,
    createRecipe,
    updateRecipe,
    deleteRecipe,

    // Orders
    fetchOrders,
    getOrder,
    createOrder,
    updateOrder,
    deleteOrder,

    // Drones
    fetchDrones,
    getDrone,
    createDrone,
    updateDrone,
    deleteDrone,

    // Missions
    fetchMissions,
    getMission,
    createMission,
    generateRoute,
    getWaypoints,
    optimizeRoute,
    simulateMission,
    startMission,
    pauseMission,
    resumeMission,
    abortMission,
    completeMission,
    getTelemetry,
    addTelemetry,
    getCoverage,
    getEvents,
    getAnalytics,

    // Calculators
    calculateSpraying,
    calculateFlightTime,
    getOptimalParams,
    calculateCoverageArea
  }
}
