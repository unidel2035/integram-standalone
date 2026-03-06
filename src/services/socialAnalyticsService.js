/**
 * Social Analytics Service
 *
 * Unified service for cross-platform social media analytics.
 * Aggregates data from YouTube, Telegram, VK and provides comparison metrics.
 */

import { groupParserService } from './groupParserService'

class SocialAnalyticsService {
  /**
   * Get aggregated comparison data from all platforms
   * @returns {Promise<Object>} Comparison data
   */
  async getComparisonData() {
    try {
      const [youtubeData, telegramData, vkData] = await Promise.allSettled([
        this.getYouTubeMetrics(),
        this.getTelegramMetrics(),
        this.getVKMetrics()
      ])

      return {
        youtube: youtubeData.status === 'fulfilled' ? youtubeData.value : this.getEmptyPlatformData(),
        telegram: telegramData.status === 'fulfilled' ? telegramData.value : this.getEmptyPlatformData(),
        vk: vkData.status === 'fulfilled' ? vkData.value : this.getEmptyPlatformData()
      }
    } catch (error) {
      console.error('Error fetching comparison data:', error)
      throw error
    }
  }

  /**
   * Get YouTube metrics from local storage and service
   * @returns {Promise<Object>} YouTube metrics
   */
  async getYouTubeMetrics() {
    try {
      // Get channels from localStorage (YouTube Analytics stores data there)
      const channelsData = localStorage.getItem('youtube_channels')
      const channels = channelsData ? JSON.parse(channelsData) : []

      if (channels.length === 0) {
        return this.getEmptyPlatformData()
      }

      // Calculate aggregated metrics
      const totalViews = channels.reduce((sum, ch) => sum + (ch.view_count || 0), 0)
      const totalSubscribers = channels.reduce((sum, ch) => sum + (ch.subscriber_count || 0), 0)
      const videoCount = channels.reduce((sum, ch) => sum + (ch.video_count || 0), 0)

      // Estimate engagement (likes + comments) as a percentage of views
      // This is a simplified calculation
      const engagementRate = totalSubscribers > 0 ? ((totalViews / videoCount) / totalSubscribers) * 100 : 0

      return {
        channelCount: channels.length,
        totalViews,
        totalSubscribers,
        videoCount,
        totalEngagement: Math.round(totalViews * 0.05), // Estimate 5% engagement
        engagementRate: Math.min(engagementRate, 100) // Cap at 100%
      }
    } catch (error) {
      console.error('Error fetching YouTube metrics:', error)
      return this.getEmptyPlatformData()
    }
  }

  /**
   * Get Telegram metrics from group parser service
   * @returns {Promise<Object>} Telegram metrics
   */
  async getTelegramMetrics() {
    try {
      // Check if bot token is configured
      const botToken = localStorage.getItem('telegram_bot_token')
      if (!botToken) {
        return this.getEmptyPlatformData()
      }

      // Get groups from group parser service
      const groups = await groupParserService.getGroups().catch(() => [])

      if (groups.length === 0) {
        return this.getEmptyPlatformData()
      }

      // Calculate aggregated metrics
      const totalReach = groups.reduce((sum, g) => sum + (g.members_count || 0), 0)
      const postCount = groups.reduce((sum, g) => sum + (g.messages_count || 0), 0)

      // Estimate engagement based on message count and reach
      const totalEngagement = Math.round(postCount * 0.1) // Estimate 10% engagement per post
      const engagementRate = totalReach > 0 ? (totalEngagement / totalReach) * 100 : 0

      return {
        channelCount: groups.length,
        totalReach,
        postCount,
        totalEngagement,
        engagementRate: Math.min(engagementRate, 100)
      }
    } catch (error) {
      console.error('Error fetching Telegram metrics:', error)
      return this.getEmptyPlatformData()
    }
  }

  /**
   * Get VK metrics from VK parser service
   * @returns {Promise<Object>} VK metrics
   */
  async getVKMetrics() {
    try {
      // Check if VK access token is configured
      const accessToken = localStorage.getItem('vk_access_token')
      if (!accessToken) {
        return this.getEmptyPlatformData()
      }

      // Get cached posts from localStorage
      const topPostsData = localStorage.getItem('vk_top_posts')
      const topPosts = topPostsData ? JSON.parse(topPostsData) : []

      const topGroupsData = localStorage.getItem('vk_top_groups')
      const topGroups = topGroupsData ? JSON.parse(topGroupsData) : []

      if (topPosts.length === 0 && topGroups.length === 0) {
        return this.getEmptyPlatformData()
      }

      // Calculate aggregated metrics
      const totalViews = topPosts.reduce((sum, p) => sum + (p.views || 0), 0)
      const totalLikes = topPosts.reduce((sum, p) => sum + (p.likes || 0), 0)
      const totalComments = topPosts.reduce((sum, p) => sum + (p.comments || 0), 0)
      const totalReposts = topPosts.reduce((sum, p) => sum + (p.reposts || 0), 0)
      const totalEngagement = totalLikes + totalComments + totalReposts

      const engagementRate = totalViews > 0 ? (totalEngagement / totalViews) * 100 : 0

      return {
        groupCount: topGroups.length,
        totalViews,
        totalPosts: topPosts.length,
        postCount: topPosts.length,
        totalEngagement,
        engagementRate: Math.min(engagementRate, 100)
      }
    } catch (error) {
      console.error('Error fetching VK metrics:', error)
      return this.getEmptyPlatformData()
    }
  }

  /**
   * Get empty platform data structure
   * @returns {Object} Empty metrics
   */
  getEmptyPlatformData() {
    return {
      channelCount: 0,
      groupCount: 0,
      totalViews: 0,
      totalReach: 0,
      totalSubscribers: 0,
      totalPosts: 0,
      videoCount: 0,
      postCount: 0,
      totalEngagement: 0,
      engagementRate: 0
    }
  }

  /**
   * Export comparison data to CSV
   * @param {Object} data - Comparison data
   * @returns {string} CSV string
   */
  exportToCSV(data) {
    const rows = [
      ['Platform', 'Channels/Groups', 'Reach', 'Content Count', 'Engagement', 'Engagement Rate (%)']
    ]

    if (data.youtube.channelCount > 0) {
      rows.push([
        'YouTube',
        data.youtube.channelCount,
        data.youtube.totalViews,
        data.youtube.videoCount,
        data.youtube.totalEngagement,
        data.youtube.engagementRate.toFixed(2)
      ])
    }

    if (data.telegram.channelCount > 0) {
      rows.push([
        'Telegram',
        data.telegram.channelCount,
        data.telegram.totalReach,
        data.telegram.postCount,
        data.telegram.totalEngagement,
        data.telegram.engagementRate.toFixed(2)
      ])
    }

    if (data.vk.groupCount > 0) {
      rows.push([
        'VK',
        data.vk.groupCount,
        data.vk.totalViews,
        data.vk.postCount,
        data.vk.totalEngagement,
        data.vk.engagementRate.toFixed(2)
      ])
    }

    return rows.map(row => row.join(',')).join('\n')
  }

  /**
   * Download CSV export
   * @param {Object} data - Comparison data
   * @param {string} filename - Output filename
   */
  downloadCSV(data, filename = 'social-analytics-comparison.csv') {
    const csv = this.exportToCSV(data)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)

    link.setAttribute('href', url)
    link.setAttribute('download', filename)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }
}

export default new SocialAnalyticsService()
