// Agriculture Service for managing fields, observations, and harvests
import apiClient from '@/axios2'

class AgricultureService {
  // Fields Management
  async getFields(params = {}) {
    try {
      const response = await apiClient.get('/api/fields', { params })
      return response.data
    } catch (error) {
      console.error('Error fetching fields:', error)
      throw error
    }
  }

  async getFieldById(id) {
    try {
      const response = await apiClient.get(`/api/fields/${id}`)
      return response.data
    } catch (error) {
      console.error(`Error fetching field ${id}:`, error)
      throw error
    }
  }

  async createField(fieldData) {
    try {
      const response = await apiClient.post('/api/fields', fieldData)
      return response.data
    } catch (error) {
      console.error('Error creating field:', error)
      throw error
    }
  }

  async updateField(id, fieldData) {
    try {
      const response = await apiClient.put(`/api/fields/${id}`, fieldData)
      return response.data
    } catch (error) {
      console.error(`Error updating field ${id}:`, error)
      throw error
    }
  }

  async deleteField(id) {
    try {
      const response = await apiClient.delete(`/api/fields/${id}`)
      return response.data
    } catch (error) {
      console.error(`Error deleting field ${id}:`, error)
      throw error
    }
  }

  // Field Observations Management
  async getFieldObservations(fieldId, params = {}) {
    try {
      const response = await apiClient.get(`/api/fields/${fieldId}/observations`, { params })
      return response.data
    } catch (error) {
      console.error(`Error fetching observations for field ${fieldId}:`, error)
      throw error
    }
  }

  async createObservation(fieldId, observationData) {
    try {
      const response = await apiClient.post(`/api/fields/${fieldId}/observations`, observationData)
      return response.data
    } catch (error) {
      console.error(`Error creating observation for field ${fieldId}:`, error)
      throw error
    }
  }

  async updateObservation(fieldId, observationId, observationData) {
    try {
      const response = await apiClient.put(
        `/api/fields/${fieldId}/observations/${observationId}`,
        observationData
      )
      return response.data
    } catch (error) {
      console.error(`Error updating observation ${observationId}:`, error)
      throw error
    }
  }

  async deleteObservation(fieldId, observationId) {
    try {
      const response = await apiClient.delete(`/api/fields/${fieldId}/observations/${observationId}`)
      return response.data
    } catch (error) {
      console.error(`Error deleting observation ${observationId}:`, error)
      throw error
    }
  }

  // Vegetation Indices Calculation
  async getVegetationIndices(fieldId, params = {}) {
    try {
      const response = await apiClient.get(`/api/fields/${fieldId}/vegetation`, { params })
      return response.data
    } catch (error) {
      console.error(`Error fetching vegetation indices for field ${fieldId}:`, error)
      throw error
    }
  }

  async calculateVegetationIndices(fieldId, imageData) {
    try {
      const response = await apiClient.post(`/api/fields/${fieldId}/vegetation/calculate`, imageData)
      return response.data
    } catch (error) {
      console.error(`Error calculating vegetation indices for field ${fieldId}:`, error)
      throw error
    }
  }

  // Harvest Management
  async getFieldHarvests(fieldId, params = {}) {
    try {
      const response = await apiClient.get(`/api/fields/${fieldId}/harvests`, { params })
      return response.data
    } catch (error) {
      console.error(`Error fetching harvests for field ${fieldId}:`, error)
      throw error
    }
  }

  async createHarvest(fieldId, harvestData) {
    try {
      const response = await apiClient.post(`/api/fields/${fieldId}/harvest`, harvestData)
      return response.data
    } catch (error) {
      console.error(`Error creating harvest for field ${fieldId}:`, error)
      throw error
    }
  }

  async updateHarvest(fieldId, harvestId, harvestData) {
    try {
      const response = await apiClient.put(
        `/api/fields/${fieldId}/harvests/${harvestId}`,
        harvestData
      )
      return response.data
    } catch (error) {
      console.error(`Error updating harvest ${harvestId}:`, error)
      throw error
    }
  }

  async deleteHarvest(fieldId, harvestId) {
    try {
      const response = await apiClient.delete(`/api/fields/${fieldId}/harvests/${harvestId}`)
      return response.data
    } catch (error) {
      console.error(`Error deleting harvest ${harvestId}:`, error)
      throw error
    }
  }

  // Analytics
  async getFieldAnalytics(fieldId, params = {}) {
    try {
      const response = await apiClient.get(`/api/fields/${fieldId}/analytics`, { params })
      return response.data
    } catch (error) {
      console.error(`Error fetching analytics for field ${fieldId}:`, error)
      throw error
    }
  }

  async getProductivityReport(params = {}) {
    try {
      const response = await apiClient.get('/api/fields/analytics/productivity', { params })
      return response.data
    } catch (error) {
      console.error('Error fetching productivity report:', error)
      throw error
    }
  }

  async getYieldForecast(fieldId, params = {}) {
    try {
      const response = await apiClient.get(`/api/fields/${fieldId}/analytics/forecast`, { params })
      return response.data
    } catch (error) {
      console.error(`Error fetching yield forecast for field ${fieldId}:`, error)
      throw error
    }
  }

  // Problem Zones
  async getProblemZones(fieldId, params = {}) {
    try {
      const response = await apiClient.get(`/api/fields/${fieldId}/problem-zones`, { params })
      return response.data
    } catch (error) {
      console.error(`Error fetching problem zones for field ${fieldId}:`, error)
      throw error
    }
  }

  async createProblemZone(fieldId, zoneData) {
    try {
      const response = await apiClient.post(`/api/fields/${fieldId}/problem-zones`, zoneData)
      return response.data
    } catch (error) {
      console.error(`Error creating problem zone for field ${fieldId}:`, error)
      throw error
    }
  }

  async updateProblemZone(fieldId, zoneId, zoneData) {
    try {
      const response = await apiClient.put(
        `/api/fields/${fieldId}/problem-zones/${zoneId}`,
        zoneData
      )
      return response.data
    } catch (error) {
      console.error(`Error updating problem zone ${zoneId}:`, error)
      throw error
    }
  }

  // Crop Rotation History
  async getRotationHistory(fieldId) {
    try {
      const response = await apiClient.get(`/api/fields/${fieldId}/rotation-history`)
      return response.data
    } catch (error) {
      console.error(`Error fetching rotation history for field ${fieldId}:`, error)
      throw error
    }
  }

  async addRotationRecord(fieldId, recordData) {
    try {
      const response = await apiClient.post(`/api/fields/${fieldId}/rotation-history`, recordData)
      return response.data
    } catch (error) {
      console.error(`Error adding rotation record for field ${fieldId}:`, error)
      throw error
    }
  }

  // Export Functions
  async exportFieldData(fieldId, format = 'excel') {
    try {
      const response = await apiClient.get(`/api/fields/${fieldId}/export`, {
        params: { format },
        responseType: 'blob'
      })
      return response.data
    } catch (error) {
      console.error(`Error exporting field ${fieldId} data:`, error)
      throw error
    }
  }

  async exportProductivityReport(params = {}, format = 'excel') {
    try {
      const response = await apiClient.get('/api/fields/analytics/export', {
        params: { ...params, format },
        responseType: 'blob'
      })
      return response.data
    } catch (error) {
      console.error('Error exporting productivity report:', error)
      throw error
    }
  }

  // Utility Methods
  calculateFieldArea(geometry) {
    // Simple area calculation for GeoJSON polygon (in hectares)
    // This is a simplified version - for production, use turf.js or similar
    if (!geometry || !geometry.coordinates || !geometry.coordinates[0]) {
      return 0
    }

    const coords = geometry.coordinates[0]
    let area = 0

    for (let i = 0; i < coords.length - 1; i++) {
      const [x1, y1] = coords[i]
      const [x2, y2] = coords[i + 1]
      area += x1 * y2 - x2 * y1
    }

    area = Math.abs(area / 2)

    // Convert to hectares (rough approximation)
    // For accurate calculation, use proper geodetic calculations
    const hectares = area * 111 * 111 / 10000

    return Math.round(hectares * 100) / 100
  }

  validateVegetationIndex(value) {
    return value >= -1 && value <= 1
  }

  getIndexInterpretation(indexType, value) {
    if (!this.validateVegetationIndex(value)) {
      return 'Invalid'
    }

    const interpretations = {
      ndvi: [
        { min: -1, max: 0, label: 'Вода/Нет растительности', color: '#0000ff' },
        { min: 0, max: 0.2, label: 'Низкая растительность', color: '#ff0000' },
        { min: 0.2, max: 0.4, label: 'Умеренная растительность', color: '#ffff00' },
        { min: 0.4, max: 0.6, label: 'Здоровая растительность', color: '#90ee90' },
        { min: 0.6, max: 1, label: 'Очень здоровая растительность', color: '#008000' }
      ],
      ndre: [
        { min: -1, max: 0, label: 'Нет растительности', color: '#ff0000' },
        { min: 0, max: 0.3, label: 'Низкая активность', color: '#ffff00' },
        { min: 0.3, max: 0.5, label: 'Умеренная активность', color: '#90ee90' },
        { min: 0.5, max: 1, label: 'Высокая активность', color: '#008000' }
      ],
      gndvi: [
        { min: -1, max: 0, label: 'Нет растительности', color: '#ff0000' },
        { min: 0, max: 0.25, label: 'Слабая растительность', color: '#ffff00' },
        { min: 0.25, max: 0.5, label: 'Умеренная растительность', color: '#90ee90' },
        { min: 0.5, max: 1, label: 'Сильная растительность', color: '#008000' }
      ]
    }

    const ranges = interpretations[indexType] || interpretations.ndvi
    const range = ranges.find(r => value >= r.min && value < r.max)
    return range || ranges[ranges.length - 1]
  }
}

export default new AgricultureService()
