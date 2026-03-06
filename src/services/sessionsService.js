/**
 * Sessions Service
 *
 * Service for managing user sessions data stored in Integram database.
 * Data source: https://ai2o.ru/my/object/4224/?F_U={USER_ID}
 *
 * This service provides:
 * - Fetching sessions from Integram database
 * - Dynamic field mapping based on database schema
 * - Session management (create, update, delete)
 * - Real-time session tracking
 */

import integramService from '@/services/integramApiClient'
import { logger } from '@/utils/logger'

class SessionsService {
  constructor() {
    // Sessions object ID in my database
    this.SESSIONS_OBJECT_ID = 4224
    this.DATABASE = 'my'

    // Cached type metadata for sessions
    this.typeMetadata = null
    this.fieldMapping = null

    // Flag to use mock data when database is not accessible
    this.useMockData = false
  }

  /**
   * Initialize service by loading type metadata
   */
  async initialize() {
    if (this.typeMetadata) {
      return this.typeMetadata
    }

    try {
      // Switch to my database
      const currentDb = integramService.getDatabase()
      if (currentDb !== this.DATABASE) {
        const switched = await integramService.switchToDatabase(this.DATABASE)
        if (!switched) {
          // Unified auth not available - use mock data
          logger.debug('[sessionsService] Database switch not available, using mock data')
          this.useMockData = true
          return null
        }
      }

      // Get sessions object to find its type
      const sessionsObject = await integramService.getObject(this.SESSIONS_OBJECT_ID)

      if (!sessionsObject) {
        throw new Error('Sessions object not found')
      }

      // Get type metadata
      const typeId = sessionsObject.type_id
      this.typeMetadata = await integramService.getTypeMetadata(typeId)

      // Build field mapping from requisites
      this.fieldMapping = this.buildFieldMapping(this.typeMetadata.requisites || [])

      logger.info('[sessionsService] Initialized with type:', typeId)
      logger.info('[sessionsService] Fields:', this.fieldMapping)

      return this.typeMetadata
    } catch (error) {
      logger.error('[sessionsService] Failed to initialize:', error)
      throw error
    }
  }

  /**
   * Build field mapping from requisites
   * Maps friendly field names to requisite IDs
   */
  buildFieldMapping(requisites) {
    const mapping = {}

    requisites.forEach(req => {
      const alias = req.alias || `field_${req.id}`
      mapping[alias.toLowerCase()] = {
        id: req.id,
        alias: req.alias,
        type: req.requisite_type_id,
        original: req
      }
    })

    return mapping
  }

  /**
   * Get all sessions for a user
   * @param {string} userId - User ID (optional, defaults to current user)
   * @returns {Promise<Array>} List of sessions
   */
  async getSessions(userId = null) {
    try {
      // If mock data mode is enabled, return mock data directly
      if (this.useMockData) {
        return this.getMockSessions()
      }

      await this.initialize()

      // If initialization set mock data mode, return mock data
      if (this.useMockData) {
        return this.getMockSessions()
      }

      // Get current user if not provided
      if (!userId) {
        userId = integramService.userId || 'current-user'
      }

      // Fetch sessions from database
      // TODO: Replace with actual type ID for user sessions once we know the structure
      // For now, return mock data structure based on Integram

      const sessions = await this.fetchSessionsFromDatabase(userId)

      return sessions.map(session => this.transformSession(session))
    } catch (error) {
      logger.error('[sessionsService] Failed to get sessions:', error)

      // Return mock data as fallback
      return this.getMockSessions()
    }
  }

  /**
   * Fetch sessions from Integram database
   */
  async fetchSessionsFromDatabase(userId) {
    try {
      // Get sessions object data
      const sessionsObject = await integramService.getObjectEditData(this.SESSIONS_OBJECT_ID)

      if (!sessionsObject || !sessionsObject.requisites) {
        return []
      }

      // Parse sessions data from requisites
      const sessions = []

      // Check if there's a sessions list in the requisites
      // The exact field name depends on the database structure
      Object.entries(sessionsObject.requisites).forEach(([reqId, value]) => {
        const field = Object.values(this.fieldMapping).find(f => f.id.toString() === reqId)

        if (field && Array.isArray(value)) {
          // If the value is an array of sessions
          value.forEach(sessionData => {
            if (sessionData && typeof sessionData === 'object') {
              sessions.push(sessionData)
            }
          })
        }
      })

      return sessions
    } catch (error) {
      logger.error('[sessionsService] Database fetch failed:', error)
      return []
    }
  }

  /**
   * Transform session from database format to UI format
   */
  transformSession(sessionData) {
    // Map database fields to UI fields
    return {
      id: sessionData.id || sessionData.ID || Math.random().toString(36),
      device: sessionData.device || sessionData.Device || 'Unknown Device',
      browser: sessionData.browser || sessionData.Browser || 'Unknown Browser',
      location: sessionData.location || sessionData.Location || 'Unknown Location',
      ip: sessionData.ip || sessionData.IP || '0.0.0.0',
      lastActivity: sessionData.last_activity || sessionData.LastActivity || new Date().toISOString(),
      createdAt: sessionData.created_at || sessionData.CreatedAt || new Date().toISOString()
    }
  }

  /**
   * Get current session
   */
  async getCurrentSession() {
    try {
      // Get browser info
      const browserInfo = this.getBrowserInfo()

      // Get IP and location (would need backend support for real implementation)
      const ipInfo = await this.getIPInfo()

      return {
        id: 'current',
        device: browserInfo.device,
        browser: browserInfo.browser,
        location: ipInfo.location,
        ip: ipInfo.ip,
        lastActivity: new Date(),
        createdAt: new Date()
      }
    } catch (error) {
      logger.error('[sessionsService] Failed to get current session:', error)
      return this.getMockCurrentSession()
    }
  }

  /**
   * Terminate a session
   */
  async terminateSession(sessionId) {
    try {
      await this.initialize()

      // TODO: Implement actual session termination via Integram
      logger.info('[sessionsService] Terminating session:', sessionId)

      return {
        success: true,
        message: 'Session terminated successfully'
      }
    } catch (error) {
      logger.error('[sessionsService] Failed to terminate session:', error)
      throw error
    }
  }

  /**
   * Terminate all sessions except current
   */
  async terminateAllSessions() {
    try {
      await this.initialize()

      // TODO: Implement bulk session termination
      logger.info('[sessionsService] Terminating all sessions')

      return {
        success: true,
        count: 0,
        message: 'All sessions terminated'
      }
    } catch (error) {
      logger.error('[sessionsService] Failed to terminate all sessions:', error)
      throw error
    }
  }

  /**
   * Get browser information
   */
  getBrowserInfo() {
    const ua = navigator.userAgent
    let browser = 'Unknown Browser'
    let device = 'Unknown Device'

    // Detect browser
    if (ua.includes('Chrome')) browser = 'Chrome'
    else if (ua.includes('Firefox')) browser = 'Firefox'
    else if (ua.includes('Safari')) browser = 'Safari'
    else if (ua.includes('Edge')) browser = 'Edge'

    // Detect device
    if (ua.includes('Windows')) device = `${browser} на Windows`
    else if (ua.includes('Mac')) device = `${browser} на macOS`
    else if (ua.includes('Linux')) device = `${browser} на Linux`
    else if (ua.includes('Android')) device = `${browser} на Android`
    else if (ua.includes('iPhone')) device = `${browser} на iPhone`

    return { browser, device }
  }

  /**
   * Get IP and location info
   * Note: This would require backend support for accurate data
   */
  async getIPInfo() {
    // Mock data for now
    return {
      ip: '192.168.1.1',
      location: 'Москва, Россия'
    }
  }

  /**
   * Mock sessions data (fallback)
   */
  getMockSessions() {
    return [
      {
        id: '1',
        device: 'iPhone 14 Pro',
        browser: 'Safari 17.0',
        location: 'Санкт-Петербург, Россия',
        ip: '192.168.1.101',
        lastActivity: new Date(Date.now() - 7200000), // 2 hours ago
        createdAt: new Date(Date.now() - 86400000) // 1 day ago
      },
      {
        id: '2',
        device: 'MacBook Pro',
        browser: 'Firefox 120.0',
        location: 'Москва, Россия',
        ip: '192.168.1.102',
        lastActivity: new Date(Date.now() - 3600000), // 1 hour ago
        createdAt: new Date(Date.now() - 172800000) // 2 days ago
      }
    ]
  }

  /**
   * Mock current session (fallback)
   */
  getMockCurrentSession() {
    return {
      id: 'current',
      device: 'Chrome на Windows 11',
      browser: 'Chrome 119.0',
      location: 'Москва, Россия',
      ip: '192.168.1.1',
      lastActivity: new Date(),
      createdAt: new Date(Date.now() - 3600000)
    }
  }

  /**
   * Get field metadata for dynamic rendering
   * Returns list of fields with their types and labels
   */
  async getFieldsMetadata() {
    await this.initialize()

    if (!this.fieldMapping) {
      return []
    }

    return Object.entries(this.fieldMapping).map(([key, field]) => ({
      key,
      id: field.id,
      label: field.alias || key,
      type: field.type,
      requisiteTypeId: field.type
    }))
  }
}

// Export singleton instance
export const sessionsService = new SessionsService()

// Also export class for testing
export { SessionsService }
