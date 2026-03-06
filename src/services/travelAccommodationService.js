/**
 * Travel Accommodation Service
 *
 * Frontend service for interacting with the travel accommodation API
 */

import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

class TravelAccommodationService {
  /**
   * Search for accommodations
   * @param {Object} searchParams - Search parameters
   * @returns {Promise<Array>} - Search results
   */
  async searchAccommodations(searchParams) {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/travel-accommodation/search`,
        searchParams
      );

      if (response.data.success) {
        return response.data.data.results;
      } else {
        throw new Error(response.data.error || 'Search failed');
      }
    } catch (error) {
      console.error('Accommodation search error:', error);
      throw error;
    }
  }

  /**
   * Get accommodation details
   * @param {string} accommodationId - Accommodation ID
   * @returns {Promise<Object>} - Accommodation details
   */
  async getAccommodationDetails(accommodationId) {
    try {
      const response = await axios.get(
        `${API_BASE_URL}/travel-accommodation/${accommodationId}`
      );

      if (response.data.success) {
        return response.data.data;
      } else {
        throw new Error(response.data.error || 'Failed to get details');
      }
    } catch (error) {
      console.error('Get accommodation details error:', error);
      throw error;
    }
  }

  /**
   * Contact property owner via AI agent
   * @param {string} accommodationId - Accommodation ID
   * @param {string} message - User message
   * @returns {Promise<Object>} - Communication result
   */
  async contactOwner(accommodationId, message) {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/travel-accommodation/${accommodationId}/contact-owner`,
        { message }
      );

      if (response.data.success) {
        return response.data.data;
      } else {
        throw new Error(response.data.error || 'Failed to contact owner');
      }
    } catch (error) {
      console.error('Contact owner error:', error);
      throw error;
    }
  }

  /**
   * Get status of booking platforms
   * @returns {Promise<Array>} - Platform status
   */
  async getPlatformStatus() {
    try {
      const response = await axios.get(
        `${API_BASE_URL}/travel-accommodation/platforms/status`
      );

      if (response.data.success) {
        return response.data.data;
      } else {
        throw new Error(response.data.error || 'Failed to get platform status');
      }
    } catch (error) {
      console.error('Get platform status error:', error);
      throw error;
    }
  }
}

export default new TravelAccommodationService();
