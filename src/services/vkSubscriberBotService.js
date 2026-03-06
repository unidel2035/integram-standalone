// vkSubscriberBotService.js - VK Subscriber Bot Service
// Service for interacting with VK Subscriber Bot Agent API

import axios from 'axios'
import { getOrchestratorUrl } from '@/utils/apiConfig'

// Get API URL from environment
const API_URL = getOrchestratorUrl()

/**
 * VK Subscriber Bot Service
 * Provides methods for collecting subscribers from VK groups
 */
class VKSubscriberBotService {
  /**
   * Test VK API connection
   * @param {string} accessToken - VK access token
   * @returns {Promise<Object>} Connection test result
   */
  async testConnection(accessToken) {
    const response = await axios.post(`${API_URL}/api/vk-subscriber-bot/test-connection`, {
      access_token: accessToken
    })
    return response.data
  }

  /**
   * Collect subscribers from a single VK group
   * @param {string|number} groupId - VK group ID (e.g., "123456" or "-123456")
   * @param {string} accessToken - VK access token
   * @param {number} maxSubscribers - Maximum subscribers to collect (default: 5000)
   * @returns {Promise<Object>} Collection results
   */
  async collectGroupSubscribers(groupId, accessToken, maxSubscribers = 5000) {
    const response = await axios.post(`${API_URL}/api/vk-subscriber-bot/collect-group`, {
      group_id: groupId,
      access_token: accessToken,
      max_subscribers: maxSubscribers
    })
    return response.data
  }

  /**
   * Collect subscribers from multiple VK groups
   * @param {Array<string|number>} groupIds - VK group IDs
   * @param {string} accessToken - VK access token
   * @param {number} maxPerGroup - Maximum subscribers per group (default: 1000)
   * @returns {Promise<Object>} Collection results for all groups
   */
  async collectFromMultipleGroups(groupIds, accessToken, maxPerGroup = 1000) {
    const response = await axios.post(`${API_URL}/api/vk-subscriber-bot/collect-multiple`, {
      group_ids: groupIds,
      access_token: accessToken,
      max_per_group: maxPerGroup
    })
    return response.data
  }

  /**
   * Find VK groups by search query
   * @param {string} query - Search query
   * @param {string} accessToken - VK access token
   * @param {number} maxGroups - Maximum groups to return (default: 10, max: 100)
   * @returns {Promise<Object>} Found groups with subscriber information
   */
  async findGroups(query, accessToken, maxGroups = 10) {
    const response = await axios.post(`${API_URL}/api/vk-subscriber-bot/find-groups`, {
      query,
      access_token: accessToken,
      max_groups: maxGroups
    })
    return response.data
  }

  /**
   * Get detailed information about a VK group
   * @param {string|number} groupId - VK group ID
   * @param {string} accessToken - VK access token
   * @returns {Promise<Object>} Group information
   */
  async getGroupInfo(groupId, accessToken) {
    const response = await axios.post(`${API_URL}/api/vk-subscriber-bot/group-info`, {
      group_id: groupId,
      access_token: accessToken
    })
    return response.data
  }

  /**
   * Search for VK groups by query
   * @param {string} query - Search query
   * @param {string} accessToken - VK access token
   * @param {number} count - Number of groups to return (default: 20, max: 1000)
   * @param {number} offset - Offset for pagination (default: 0)
   * @returns {Promise<Object>} Search results
   */
  async searchGroups(query, accessToken, count = 20, offset = 0) {
    const response = await axios.post(`${API_URL}/api/vk-subscriber-bot/search-groups`, {
      query,
      access_token: accessToken,
      count,
      offset
    })
    return response.data
  }

  /**
   * Export subscribers to CSV format
   * @param {Array} subscribers - Array of subscriber objects
   * @param {string} groupName - Name of the group (for filename)
   * @returns {void} Downloads CSV file
   */
  exportToCSV(subscribers, groupName = 'vk_subscribers') {
    if (!subscribers || subscribers.length === 0) {
      throw new Error('No subscribers to export')
    }

    // Create CSV header
    const headers = ['ID', 'First Name', 'Last Name', 'Full Name', 'City', 'Country', 'Online', 'Photo']

    // Create CSV rows
    const rows = subscribers.map(sub => {
      const fullName = `${sub.first_name || ''} ${sub.last_name || ''}`.trim()
      const city = sub.city ? sub.city.title : ''
      const country = sub.country ? sub.country.title : ''
      const online = sub.online ? 'Yes' : 'No'
      const photo = sub.photo_50 || sub.photo_100 || ''

      return [
        sub.id,
        sub.first_name || '',
        sub.last_name || '',
        fullName,
        city,
        country,
        online,
        photo
      ]
    })

    // Combine header and rows
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n')

    // Create blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)

    link.setAttribute('href', url)
    link.setAttribute('download', `${groupName}_subscribers_${Date.now()}.csv`)
    link.style.visibility = 'hidden'

    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  /**
   * Export subscribers to JSON format
   * @param {Array} subscribers - Array of subscriber objects
   * @param {string} groupName - Name of the group (for filename)
   * @param {Object} groupInfo - Group information (optional)
   * @returns {void} Downloads JSON file
   */
  exportToJSON(subscribers, groupName = 'vk_subscribers', groupInfo = null) {
    if (!subscribers || subscribers.length === 0) {
      throw new Error('No subscribers to export')
    }

    const exportData = {
      exportDate: new Date().toISOString(),
      groupInfo: groupInfo || { name: groupName },
      totalSubscribers: subscribers.length,
      subscribers: subscribers
    }

    const jsonContent = JSON.stringify(exportData, null, 2)

    const blob = new Blob([jsonContent], { type: 'application/json' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)

    link.setAttribute('href', url)
    link.setAttribute('download', `${groupName}_subscribers_${Date.now()}.json`)
    link.style.visibility = 'hidden'

    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  /**
   * Calculate subscriber statistics
   * @param {Array} subscribers - Array of subscriber objects
   * @returns {Object} Statistics object
   */
  calculateStats(subscribers) {
    if (!subscribers || subscribers.length === 0) {
      return {
        total: 0,
        online: 0,
        offline: 0,
        withPhoto: 0,
        withCity: 0,
        cities: {},
        countries: {}
      }
    }

    const stats = {
      total: subscribers.length,
      online: 0,
      offline: 0,
      withPhoto: 0,
      withCity: 0,
      cities: {},
      countries: {}
    }

    subscribers.forEach(sub => {
      // Count online/offline
      if (sub.online) {
        stats.online++
      } else {
        stats.offline++
      }

      // Count with photo
      if (sub.photo_50 || sub.photo_100) {
        stats.withPhoto++
      }

      // Count city
      if (sub.city) {
        stats.withCity++
        const cityName = sub.city.title
        stats.cities[cityName] = (stats.cities[cityName] || 0) + 1
      }

      // Count country
      if (sub.country) {
        const countryName = sub.country.title
        stats.countries[countryName] = (stats.countries[countryName] || 0) + 1
      }
    })

    return stats
  }
}

// Export singleton instance
export default new VKSubscriberBotService()
