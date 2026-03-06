// vkParserService.js - VK Parser Service
// Service for interacting with VK Parser Agent API

import axios from 'axios'
import { getOrchestratorUrl } from '@/utils/apiConfig'

// Get API URL from environment
const API_URL = getOrchestratorUrl()

/**
 * VK Parser Service
 * Provides methods for searching VK posts and groups
 */
class VKParserService {
  /**
   * Test VK API connection
   * @param {string} accessToken - VK access token
   * @returns {Promise<Object>} Connection test result
   */
  async testConnection(accessToken) {
    const response = await axios.post(`${API_URL}/api/vk-parser/test-connection`, {
      access_token: accessToken
    })
    return response.data
  }

  /**
   * Search for VK groups by topic
   * @param {string} query - Search query/topic
   * @param {string} accessToken - VK access token
   * @param {number} count - Number of groups to return (default: 20, max: 200)
   * @param {number} offset - Offset for pagination (default: 0)
   * @returns {Promise<Object>} Search results with groups
   */
  async searchGroups(query, accessToken, count = 20, offset = 0) {
    const response = await axios.post(`${API_URL}/api/vk-parser/search-groups`, {
      query,
      access_token: accessToken,
      count,
      offset
    })
    return response.data
  }

  /**
   * Search for VK posts globally by topic
   * @param {string} query - Search query/topic
   * @param {string} accessToken - VK access token
   * @param {number} count - Number of posts to return (default: 50, max: 100)
   * @param {number} offset - Offset for pagination (default: 0)
   * @returns {Promise<Object>} Search results with posts
   */
  async searchPosts(query, accessToken, count = 50, offset = 0) {
    const response = await axios.post(`${API_URL}/api/vk-parser/search-posts`, {
      query,
      access_token: accessToken,
      count,
      offset
    })
    return response.data
  }

  /**
   * Get posts from a specific VK group
   * @param {number} groupId - VK group ID
   * @param {string} accessToken - VK access token
   * @param {string} query - Search query within group (optional)
   * @param {number} count - Number of posts to return (default: 50, max: 100)
   * @param {number} offset - Offset for pagination (default: 0)
   * @returns {Promise<Object>} Group posts
   */
  async getGroupPosts(groupId, accessToken, query = '', count = 50, offset = 0) {
    const response = await axios.post(`${API_URL}/api/vk-parser/group-posts`, {
      group_id: groupId,
      access_token: accessToken,
      query,
      count,
      offset
    })
    return response.data
  }

  /**
   * Analyze posts using AI for relevance and quality
   * @param {Array} posts - Posts to analyze
   * @param {string} topic - Topic for relevance analysis
   * @param {string} aiAccessToken - DronDoc AI access token
   * @param {string} userId - User ID for AI usage tracking
   * @returns {Promise<Object>} Analyzed posts
   */
  async analyzePosts(posts, topic, aiAccessToken, userId) {
    const response = await axios.post(`${API_URL}/api/vk-parser/analyze-posts`, {
      posts,
      topic,
      access_token: aiAccessToken,
      user_id: userId
    })
    return response.data
  }

  /**
   * Rank posts by various criteria
   * @param {Array} posts - Posts to rank
   * @param {string} sortBy - Sorting method (engagement|ai_score|likes|comments|reposts|date|combined)
   * @returns {Promise<Object>} Ranked posts
   */
  async rankPosts(posts, sortBy = 'engagement') {
    const response = await axios.post(`${API_URL}/api/vk-parser/rank-posts`, {
      posts,
      sort_by: sortBy
    })
    return response.data
  }

  /**
   * Execute full VK search workflow
   * @param {string} topic - Search topic
   * @param {string} vkAccessToken - VK access token
   * @param {string} aiAccessToken - DronDoc AI access token (optional)
   * @param {string} userId - User ID (optional)
   * @param {boolean} includeGroups - Include groups search (default: true)
   * @param {boolean} includeAI - Include AI analysis (default: true)
   * @param {number} limit - Max posts to search (default: 50, max: 100)
   * @returns {Promise<Object>} Full search results
   */
  async fullSearch(
    topic,
    vkAccessToken,
    aiAccessToken = null,
    userId = null,
    includeGroups = true,
    includeAI = true,
    limit = 50
  ) {
    const response = await axios.post(`${API_URL}/api/vk-parser/full-search`, {
      topic,
      vk_access_token: vkAccessToken,
      ai_access_token: aiAccessToken,
      user_id: userId,
      include_groups: includeGroups,
      include_ai: includeAI && aiAccessToken && userId,
      limit
    })
    return response.data
  }
}

// Export singleton instance
export default new VKParserService()
