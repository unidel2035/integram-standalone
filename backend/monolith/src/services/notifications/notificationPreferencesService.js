import { query } from '../../config/database.js'
import logger from '../../utils/logger.js'

/**
 * Default notification preferences
 */
const DEFAULT_PREFERENCES = {
  channels: {
    inApp: true,
    email: true,
    push: false,
    sms: false
  },
  email_settings: {
    mentions: true,
    shares: true,
    digest: true,
    updates: true
  },
  push_settings: {
    enabled: false,
    mentions: true,
    all: false
  },
  do_not_disturb: {
    enabled: false,
    from: '22:00',
    to: '08:00'
  }
}

/**
 * Get notification preferences for a user
 * Creates default preferences if none exist
 * @param {string} userId - User ID
 * @returns {Promise<Object>} User preferences
 */
export async function getPreferences(userId) {
  let result = await query(
    `SELECT id, user_id, channels, email_settings, push_settings, do_not_disturb, metadata, created_at, updated_at
     FROM notification_preferences
     WHERE user_id = $1`,
    [userId]
  )

  // If no preferences exist, create default ones
  if (result.rows.length === 0) {
    logger.info({ userId }, 'Creating default notification preferences')
    result = await query(
      `INSERT INTO notification_preferences (user_id, channels, email_settings, push_settings, do_not_disturb)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, user_id, channels, email_settings, push_settings, do_not_disturb, metadata, created_at, updated_at`,
      [
        userId,
        JSON.stringify(DEFAULT_PREFERENCES.channels),
        JSON.stringify(DEFAULT_PREFERENCES.email_settings),
        JSON.stringify(DEFAULT_PREFERENCES.push_settings),
        JSON.stringify(DEFAULT_PREFERENCES.do_not_disturb)
      ]
    )
  }

  return result.rows[0]
}

/**
 * Update notification preferences for a user
 * @param {string} userId - User ID
 * @param {Object} preferences - Preference updates
 * @returns {Promise<Object>} Updated preferences
 */
export async function updatePreferences(userId, preferences) {
  const {
    channels,
    email_settings,
    push_settings,
    do_not_disturb,
    metadata
  } = preferences

  // First, ensure preferences exist
  await getPreferences(userId)

  const updates = []
  const params = [userId]
  let paramCount = 2

  if (channels !== undefined) {
    updates.push(`channels = $${paramCount}`)
    params.push(JSON.stringify(channels))
    paramCount++
  }

  if (email_settings !== undefined) {
    updates.push(`email_settings = $${paramCount}`)
    params.push(JSON.stringify(email_settings))
    paramCount++
  }

  if (push_settings !== undefined) {
    updates.push(`push_settings = $${paramCount}`)
    params.push(JSON.stringify(push_settings))
    paramCount++
  }

  if (do_not_disturb !== undefined) {
    updates.push(`do_not_disturb = $${paramCount}`)
    params.push(JSON.stringify(do_not_disturb))
    paramCount++
  }

  if (metadata !== undefined) {
    updates.push(`metadata = $${paramCount}`)
    params.push(JSON.stringify(metadata))
    paramCount++
  }

  if (updates.length === 0) {
    throw new Error('No valid preferences to update')
  }

  const result = await query(
    `UPDATE notification_preferences
     SET ${updates.join(', ')}
     WHERE user_id = $1
     RETURNING id, user_id, channels, email_settings, push_settings, do_not_disturb, metadata, created_at, updated_at`,
    params
  )

  logger.info({ userId }, 'Notification preferences updated')
  return result.rows[0]
}

/**
 * Check if a user should receive a notification based on their preferences
 * @param {string} userId - User ID
 * @param {string} channel - Channel to check ('inApp', 'email', 'push', 'sms')
 * @param {string} type - Notification type
 * @returns {Promise<boolean>} Whether notification should be sent
 */
export async function shouldSendNotification(userId, channel, type) {
  const preferences = await getPreferences(userId)

  // Check if channel is enabled
  if (!preferences.channels[channel]) {
    return false
  }

  // Check quiet hours for push notifications
  if (channel === 'push' && preferences.do_not_disturb.enabled) {
    const now = new Date()
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
    const { from, to } = preferences.do_not_disturb

    // Simple time range check (doesn't handle crossing midnight perfectly, but good enough)
    if (currentTime >= from || currentTime <= to) {
      logger.debug({ userId, currentTime, from, to }, 'Notification suppressed due to quiet hours')
      return false
    }
  }

  // Channel-specific checks
  if (channel === 'email') {
    // Check email-specific settings based on notification type
    const emailSettings = preferences.email_settings
    if (type === 'activity' && !emailSettings.mentions && !emailSettings.shares) {
      return false
    }
    if (type === 'system' && !emailSettings.updates) {
      return false
    }
  }

  if (channel === 'push') {
    const pushSettings = preferences.push_settings
    if (!pushSettings.enabled) {
      return false
    }
    if (!pushSettings.all && type !== 'activity') {
      return false
    }
  }

  return true
}

/**
 * Reset preferences to default values
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Reset preferences
 */
export async function resetPreferences(userId) {
  const result = await query(
    `UPDATE notification_preferences
     SET
       channels = $2,
       email_settings = $3,
       push_settings = $4,
       do_not_disturb = $5,
       metadata = '{}'::jsonb
     WHERE user_id = $1
     RETURNING id, user_id, channels, email_settings, push_settings, do_not_disturb, metadata, created_at, updated_at`,
    [
      userId,
      JSON.stringify(DEFAULT_PREFERENCES.channels),
      JSON.stringify(DEFAULT_PREFERENCES.email_settings),
      JSON.stringify(DEFAULT_PREFERENCES.push_settings),
      JSON.stringify(DEFAULT_PREFERENCES.do_not_disturb)
    ]
  )

  logger.info({ userId }, 'Notification preferences reset to defaults')
  return result.rows[0]
}

/**
 * Delete notification preferences for a user
 * @param {string} userId - User ID
 * @returns {Promise<boolean>} Success status
 */
export async function deletePreferences(userId) {
  const result = await query(
    'DELETE FROM notification_preferences WHERE user_id = $1',
    [userId]
  )

  logger.info({ userId }, 'Notification preferences deleted')
  return result.rowCount > 0
}
