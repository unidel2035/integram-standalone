/**
 * Deployment Info Service
 * Fetches deployment information from the backend
 * Issue #5069, #5562
 */

import axios from 'axios'

// Use relative path to ensure correct API routing
const API_BASE_URL = '/api'

/**
 * Get deployment information
 * @returns {Promise<Object>} Deployment info including last update time, branch, commit hash
 */
export async function getDeploymentInfo() {
  try {
    const response = await axios.get(`${API_BASE_URL}/deployment-info`, {
      timeout: 5000
    })

    if (response.data.success) {
      return response.data.data
    } else {
      throw new Error(response.data.error || 'Failed to fetch deployment info')
    }
  } catch (error) {
    console.error('Error fetching deployment info:', error)
    // Return fallback data if API fails
    return {
      timestamp: new Date().toISOString(),
      deploymentStatus: 'unknown',
      error: error.message
    }
  }
}

export default {
  getDeploymentInfo
}
