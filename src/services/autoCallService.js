import axios from 'axios'
import { logger } from '@/utils/logger'

const API_BASE_URL = import.meta.env.VITE_ORCHESTRATOR_URL || '/api'

/**
 * Auto Call Service
 * Service for managing automated client calling campaigns
 */

/**
 * Get all campaigns
 * @returns {Promise<Array>}
 */
export async function getCampaigns() {
  try {
    const response = await axios.get(`${API_BASE_URL}/auto-call/campaigns`)
    return response.data
  } catch (error) {
    logger.error('Error fetching campaigns:', error)
    throw error
  }
}

/**
 * Create a new campaign
 * @param {Object} campaignData - Campaign data
 * @returns {Promise<Object>}
 */
export async function createCampaign(campaignData) {
  try {
    const response = await axios.post(`${API_BASE_URL}/auto-call/campaigns`, campaignData)
    return response.data
  } catch (error) {
    logger.error('Error creating campaign:', error)
    throw error
  }
}

/**
 * Update campaign
 * @param {string} campaignId - Campaign ID
 * @param {Object} updates - Updates to apply
 * @returns {Promise<Object>}
 */
export async function updateCampaign(campaignId, updates) {
  try {
    const response = await axios.put(`${API_BASE_URL}/auto-call/campaigns/${campaignId}`, updates)
    return response.data
  } catch (error) {
    logger.error('Error updating campaign:', error)
    throw error
  }
}

/**
 * Delete campaign
 * @param {string} campaignId - Campaign ID
 * @returns {Promise<void>}
 */
export async function deleteCampaign(campaignId) {
  try {
    await axios.delete(`${API_BASE_URL}/auto-call/campaigns/${campaignId}`)
  } catch (error) {
    logger.error('Error deleting campaign:', error)
    throw error
  }
}

/**
 * Start/resume campaign
 * @param {string} campaignId - Campaign ID
 * @returns {Promise<Object>}
 */
export async function startCampaign(campaignId) {
  try {
    const response = await axios.post(`${API_BASE_URL}/auto-call/campaigns/${campaignId}/start`)
    return response.data
  } catch (error) {
    logger.error('Error starting campaign:', error)
    throw error
  }
}

/**
 * Pause campaign
 * @param {string} campaignId - Campaign ID
 * @returns {Promise<Object>}
 */
export async function pauseCampaign(campaignId) {
  try {
    const response = await axios.post(`${API_BASE_URL}/auto-call/campaigns/${campaignId}/pause`)
    return response.data
  } catch (error) {
    logger.error('Error pausing campaign:', error)
    throw error
  }
}

/**
 * Upload client list file
 * @param {File} file - CSV or XLSX file with client data
 * @returns {Promise<Object>}
 */
export async function uploadClientList(file) {
  try {
    const formData = new FormData()
    formData.append('file', file)

    const response = await axios.post(`${API_BASE_URL}/auto-call/clients/upload`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    })
    return response.data
  } catch (error) {
    logger.error('Error uploading client list:', error)
    throw error
  }
}

/**
 * Get call logs
 * @param {Object} filters - Filter options
 * @returns {Promise<Array>}
 */
export async function getCallLogs(filters = {}) {
  try {
    const response = await axios.get(`${API_BASE_URL}/auto-call/calls`, { params: filters })
    return response.data
  } catch (error) {
    logger.error('Error fetching call logs:', error)
    throw error
  }
}

/**
 * Get call details
 * @param {string} callId - Call ID
 * @returns {Promise<Object>}
 */
export async function getCallDetails(callId) {
  try {
    const response = await axios.get(`${API_BASE_URL}/auto-call/calls/${callId}`)
    return response.data
  } catch (error) {
    logger.error('Error fetching call details:', error)
    throw error
  }
}

/**
 * Make a test call
 * @param {string} phoneNumber - Phone number to call
 * @param {Object} config - AI configuration
 * @returns {Promise<Object>}
 */
export async function makeTestCall(phoneNumber, config) {
  try {
    const response = await axios.post(`${API_BASE_URL}/auto-call/test-call`, {
      phoneNumber,
      config
    })
    return response.data
  } catch (error) {
    logger.error('Error making test call:', error)
    throw error
  }
}

/**
 * Save AI configuration
 * @param {Object} config - AI configuration
 * @returns {Promise<Object>}
 */
export async function saveAIConfig(config) {
  try {
    const response = await axios.post(`${API_BASE_URL}/auto-call/config`, config)
    return response.data
  } catch (error) {
    logger.error('Error saving AI config:', error)
    throw error
  }
}

/**
 * Get AI configuration
 * @returns {Promise<Object>}
 */
export async function getAIConfig() {
  try {
    const response = await axios.get(`${API_BASE_URL}/auto-call/config`)
    return response.data
  } catch (error) {
    logger.error('Error fetching AI config:', error)
    throw error
  }
}

/**
 * Get campaign statistics
 * @returns {Promise<Object>}
 */
export async function getCampaignStats() {
  try {
    const response = await axios.get(`${API_BASE_URL}/auto-call/stats`)
    return response.data
  } catch (error) {
    logger.error('Error fetching campaign stats:', error)
    throw error
  }
}

/**
 * Get analytics data
 * @param {Object} params - Analytics parameters
 * @returns {Promise<Object>}
 */
export async function getAnalytics(params = {}) {
  try {
    const response = await axios.get(`${API_BASE_URL}/auto-call/analytics`, { params })
    return response.data
  } catch (error) {
    logger.error('Error fetching analytics:', error)
    throw error
  }
}

/**
 * Download call recording
 * @param {string} callId - Call ID
 * @returns {Promise<Blob>}
 */
export async function downloadRecording(callId) {
  try {
    const response = await axios.get(`${API_BASE_URL}/auto-call/calls/${callId}/recording`, {
      responseType: 'blob'
    })
    return response.data
  } catch (error) {
    logger.error('Error downloading recording:', error)
    throw error
  }
}

/**
 * Text-to-Speech synthesis
 * @param {string} text - Text to synthesize
 * @param {Object} options - TTS options (voice, speed, etc.)
 * @returns {Promise<Blob>}
 */
export async function synthesizeSpeech(text, options = {}) {
  try {
    const response = await axios.post(
      `${API_BASE_URL}/auto-call/tts`,
      { text, ...options },
      { responseType: 'blob' }
    )
    return response.data
  } catch (error) {
    logger.error('Error synthesizing speech:', error)
    throw error
  }
}

/**
 * Speech-to-Text transcription
 * @param {Blob} audioBlob - Audio data to transcribe
 * @param {string} language - Language code (e.g., 'ru-RU')
 * @returns {Promise<Object>}
 */
export async function transcribeAudio(audioBlob, language = 'ru-RU') {
  try {
    const formData = new FormData()
    formData.append('audio', audioBlob)
    formData.append('language', language)

    const response = await axios.post(`${API_BASE_URL}/auto-call/stt`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    })
    return response.data
  } catch (error) {
    logger.error('Error transcribing audio:', error)
    throw error
  }
}

export default {
  getCampaigns,
  createCampaign,
  updateCampaign,
  deleteCampaign,
  startCampaign,
  pauseCampaign,
  uploadClientList,
  getCallLogs,
  getCallDetails,
  makeTestCall,
  saveAIConfig,
  getAIConfig,
  getCampaignStats,
  getAnalytics,
  downloadRecording,
  synthesizeSpeech,
  transcribeAudio
}
