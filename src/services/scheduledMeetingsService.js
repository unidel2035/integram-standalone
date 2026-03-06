/**
 * Scheduled Meetings Service
 *
 * Frontend service for interacting with scheduled meetings API
 */

import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://drondoc.ru';
const API_ENDPOINT = `${API_BASE_URL}/api/scheduled-meetings`;

/**
 * Retry an API request with exponential backoff for rate limiting errors
 * @param {Function} fn - Function that returns a Promise
 * @param {number} maxRetries - Maximum number of retries (default: 3)
 * @param {number} baseDelay - Base delay in milliseconds (default: 1000)
 * @returns {Promise} - Result of the API call
 */
async function retryWithBackoff(fn, maxRetries = 3, baseDelay = 1000) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      // Only retry on 429 (rate limiting) errors
      if (error.response?.status === 429 && i < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, i); // Exponential backoff
        console.warn(`Rate limited, retrying in ${delay}ms... (attempt ${i + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        throw error;
      }
    }
  }
}

/**
 * Create a scheduled meeting
 *
 * @param {Object} meetingData - Meeting data
 * @returns {Promise<Object>} Created meeting
 */
export async function createScheduledMeeting(meetingData) {
  try {
    const response = await axios.post(API_ENDPOINT, meetingData);
    return response.data.data;
  } catch (error) {
    console.error('Failed to create scheduled meeting:', error);
    throw error;
  }
}

/**
 * Get meeting by ID
 *
 * @param {string} meetingId - Meeting ID
 * @returns {Promise<Object>} Meeting object
 */
export async function getScheduledMeeting(meetingId) {
  try {
    const response = await axios.get(`${API_ENDPOINT}/${meetingId}`);
    return response.data.data;
  } catch (error) {
    console.error('Failed to get scheduled meeting:', error);
    throw error;
  }
}

/**
 * Get meetings by organizer
 *
 * @param {string} organizerId - Organizer user ID
 * @param {Object} filters - Optional filters
 * @param {string} filters.status - Filter by status
 * @param {string} filters.startDate - Filter meetings after this date
 * @param {string} filters.endDate - Filter meetings before this date
 * @returns {Promise<Array>} Array of meetings
 */
export async function getMeetingsByOrganizer(organizerId, filters = {}) {
  return retryWithBackoff(async () => {
    try {
      const params = new URLSearchParams();
      if (filters.status) params.append('status', filters.status);
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);

      const url = `${API_ENDPOINT}/organizer/${organizerId}?${params.toString()}`;
      const response = await axios.get(url);
      return response.data.data;
    } catch (error) {
      console.error('Failed to get meetings by organizer:', error);
      throw error;
    }
  });
}

/**
 * Update meeting
 *
 * @param {string} meetingId - Meeting ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object>} Updated meeting
 */
export async function updateScheduledMeeting(meetingId, updates) {
  try {
    const response = await axios.patch(`${API_ENDPOINT}/${meetingId}`, updates);
    return response.data.data;
  } catch (error) {
    console.error('Failed to update scheduled meeting:', error);
    throw error;
  }
}

/**
 * Cancel meeting
 *
 * @param {string} meetingId - Meeting ID
 * @returns {Promise<Object>} Cancelled meeting
 */
export async function cancelScheduledMeeting(meetingId) {
  try {
    const response = await axios.post(`${API_ENDPOINT}/${meetingId}/cancel`);
    return response.data.data;
  } catch (error) {
    console.error('Failed to cancel scheduled meeting:', error);
    throw error;
  }
}

/**
 * Delete meeting
 *
 * @param {string} meetingId - Meeting ID
 * @returns {Promise<boolean>} Success status
 */
export async function deleteScheduledMeeting(meetingId) {
  try {
    const response = await axios.delete(`${API_ENDPOINT}/${meetingId}`);
    return response.data.success;
  } catch (error) {
    console.error('Failed to delete scheduled meeting:', error);
    throw error;
  }
}

/**
 * Add participant to meeting
 *
 * @param {string} meetingId - Meeting ID
 * @param {Object} participant - Participant data
 * @returns {Promise<Object>} Updated meeting
 */
export async function addParticipant(meetingId, participant) {
  try {
    const response = await axios.post(`${API_ENDPOINT}/${meetingId}/participants`, participant);
    return response.data.data;
  } catch (error) {
    console.error('Failed to add participant:', error);
    throw error;
  }
}

/**
 * Update participant invitation status
 *
 * @param {string} meetingId - Meeting ID
 * @param {string} participantId - Participant ID
 * @param {string} status - Invitation status (accepted, declined, tentative)
 * @returns {Promise<Object>} Updated meeting
 */
export async function updateParticipantStatus(meetingId, participantId, status) {
  try {
    const response = await axios.patch(
      `${API_ENDPOINT}/${meetingId}/participants/${participantId}`,
      { status }
    );
    return response.data.data;
  } catch (error) {
    console.error('Failed to update participant status:', error);
    throw error;
  }
}

/**
 * Get recurring meeting instances
 *
 * @param {string} meetingId - Meeting ID
 * @param {number} count - Number of instances to generate
 * @returns {Promise<Array>} Array of meeting instances
 */
export async function getRecurringInstances(meetingId, count = 10) {
  try {
    const response = await axios.get(
      `${API_ENDPOINT}/${meetingId}/recurring-instances?count=${count}`
    );
    return response.data.data;
  } catch (error) {
    console.error('Failed to get recurring instances:', error);
    throw error;
  }
}

/**
 * Get enums for meeting configuration
 *
 * @returns {Promise<Object>} Enums object
 */
export async function getMeetingEnums() {
  try {
    const response = await axios.get(`${API_ENDPOINT}/enums`);
    return response.data.data;
  } catch (error) {
    console.error('Failed to get meeting enums:', error);
    throw error;
  }
}

export default {
  createScheduledMeeting,
  getScheduledMeeting,
  getMeetingsByOrganizer,
  updateScheduledMeeting,
  cancelScheduledMeeting,
  deleteScheduledMeeting,
  addParticipant,
  updateParticipantStatus,
  getRecurringInstances,
  getMeetingEnums
};
