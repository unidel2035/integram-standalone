/**
 * AI Meeting Assistant Services
 *
 * Comprehensive AI-powered meeting assistance for video conferences
 */

import AIAnalyticsService from './AIAnalyticsService'
import ActionItemsService from './ActionItemsService'
import MeetingMinutesService from './MeetingMinutesService'

export {
  AIAnalyticsService,
  ActionItemsService,
  MeetingMinutesService
}

/**
 * Create a complete AI Meeting Assistant instance
 * @param {string} userId - User ID for AI token
 * @returns {Promise<Object>} All services initialized
 */
export async function createAIMeetingAssistant(userId) {
  const analytics = new AIAnalyticsService()
  const actionItems = new ActionItemsService()
  const meetingMinutes = new MeetingMinutesService()

  // Initialize all services
  await Promise.all([
    analytics.initialize(userId),
    actionItems.initialize(userId),
    meetingMinutes.initialize(userId)
  ])

  return {
    analytics,
    actionItems,
    meetingMinutes
  }
}
