import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import * as preferencesService from '../notificationPreferencesService.js'

// Mock database module
vi.mock('../../../config/database.js', () => ({
  query: vi.fn()
}))

import { query } from '../../../config/database.js'

describe('Notification Preferences Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('getPreferences', () => {
    it('should return existing preferences', async () => {
      const mockPreferences = {
        id: '123',
        user_id: 'user123',
        channels: { inApp: true, email: true, push: false, sms: false },
        email_settings: { mentions: true, shares: true, digest: true, updates: true },
        push_settings: { enabled: false, mentions: true, all: false },
        do_not_disturb: { enabled: false, from: '22:00', to: '08:00' },
        metadata: {},
        created_at: new Date(),
        updated_at: new Date()
      }

      query.mockResolvedValue({ rows: [mockPreferences] })

      const result = await preferencesService.getPreferences('user123')

      expect(result).toEqual(mockPreferences)
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT'),
        ['user123']
      )
    })

    it('should create default preferences if none exist', async () => {
      const mockDefaultPreferences = {
        id: '123',
        user_id: 'user123',
        channels: { inApp: true, email: true, push: false, sms: false },
        email_settings: { mentions: true, shares: true, digest: true, updates: true },
        push_settings: { enabled: false, mentions: true, all: false },
        do_not_disturb: { enabled: false, from: '22:00', to: '08:00' },
        metadata: {},
        created_at: new Date(),
        updated_at: new Date()
      }

      // First call returns empty (no existing preferences)
      query.mockResolvedValueOnce({ rows: [] })
      // Second call returns newly created preferences
      query.mockResolvedValueOnce({ rows: [mockDefaultPreferences] })

      const result = await preferencesService.getPreferences('user123')

      expect(result).toEqual(mockDefaultPreferences)
      expect(query).toHaveBeenCalledTimes(2)
      expect(query).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('INSERT INTO notification_preferences'),
        expect.arrayContaining(['user123'])
      )
    })
  })

  describe('updatePreferences', () => {
    it('should update channels preference', async () => {
      const updatedPreferences = {
        id: '123',
        user_id: 'user123',
        channels: { inApp: true, email: false, push: true, sms: false }
      }

      // Mock getPreferences (ensures preferences exist)
      query.mockResolvedValueOnce({ rows: [{ id: '123', user_id: 'user123' }] })
      // Mock update
      query.mockResolvedValueOnce({ rows: [updatedPreferences] })

      const result = await preferencesService.updatePreferences('user123', {
        channels: { inApp: true, email: false, push: true, sms: false }
      })

      expect(result).toEqual(updatedPreferences)
      expect(query).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('UPDATE notification_preferences'),
        expect.arrayContaining(['user123'])
      )
    })

    it('should update multiple preferences at once', async () => {
      query.mockResolvedValueOnce({ rows: [{ id: '123' }] })
      query.mockResolvedValueOnce({ rows: [{ id: '123', user_id: 'user123' }] })

      await preferencesService.updatePreferences('user123', {
        channels: { inApp: true, email: true, push: true, sms: false },
        push_settings: { enabled: true, mentions: true, all: true },
        do_not_disturb: { enabled: true, from: '23:00', to: '07:00' }
      })

      expect(query).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('channels = $2'),
        expect.anything()
      )
    })

    it('should throw error if no valid preferences to update', async () => {
      query.mockResolvedValueOnce({ rows: [{ id: '123' }] })

      await expect(
        preferencesService.updatePreferences('user123', {})
      ).rejects.toThrow('No valid preferences to update')
    })

    it('should create default preferences before updating if none exist', async () => {
      // First call: check existing preferences (none found)
      query.mockResolvedValueOnce({ rows: [] })
      // Second call: create default preferences
      query.mockResolvedValueOnce({ rows: [{ id: '123', user_id: 'user123' }] })
      // Third call: update preferences
      query.mockResolvedValueOnce({ rows: [{ id: '123', user_id: 'user123' }] })

      await preferencesService.updatePreferences('user123', {
        channels: { inApp: false, email: true, push: false, sms: false }
      })

      expect(query).toHaveBeenCalledTimes(3)
    })
  })

  describe('shouldSendNotification', () => {
    it('should return false if channel is disabled', async () => {
      const mockPreferences = {
        channels: { inApp: true, email: false, push: false, sms: false },
        do_not_disturb: { enabled: false }
      }

      query.mockResolvedValue({ rows: [mockPreferences] })

      const shouldSend = await preferencesService.shouldSendNotification('user123', 'email', 'activity')

      expect(shouldSend).toBe(false)
    })

    it('should return true if channel is enabled', async () => {
      const mockPreferences = {
        channels: { inApp: true, email: true, push: false, sms: false },
        email_settings: { mentions: true, shares: true, digest: true, updates: true },
        do_not_disturb: { enabled: false }
      }

      query.mockResolvedValue({ rows: [mockPreferences] })

      const shouldSend = await preferencesService.shouldSendNotification('user123', 'email', 'activity')

      expect(shouldSend).toBe(true)
    })

    it('should check quiet hours for push notifications', async () => {
      const mockPreferences = {
        channels: { push: true },
        push_settings: { enabled: true, all: true },
        do_not_disturb: { enabled: true, from: '22:00', to: '08:00' }
      }

      query.mockResolvedValue({ rows: [mockPreferences] })

      // Mock current time to be within quiet hours (23:00)
      const originalDate = global.Date
      global.Date = class extends originalDate {
        constructor() {
          super()
          this.setHours(23, 0, 0, 0)
        }
      }

      const shouldSend = await preferencesService.shouldSendNotification('user123', 'push', 'system')

      global.Date = originalDate

      expect(shouldSend).toBe(false)
    })

    it('should check email-specific settings for activity notifications', async () => {
      const mockPreferences = {
        channels: { email: true },
        email_settings: { mentions: false, shares: false, digest: true, updates: true },
        do_not_disturb: { enabled: false }
      }

      query.mockResolvedValue({ rows: [mockPreferences] })

      const shouldSend = await preferencesService.shouldSendNotification('user123', 'email', 'activity')

      expect(shouldSend).toBe(false)
    })

    it('should check push-specific settings', async () => {
      const mockPreferences = {
        channels: { push: true },
        push_settings: { enabled: true, mentions: true, all: false },
        do_not_disturb: { enabled: false }
      }

      query.mockResolvedValue({ rows: [mockPreferences] })

      const shouldSend = await preferencesService.shouldSendNotification('user123', 'push', 'billing')

      expect(shouldSend).toBe(false) // all is false, so only activity notifications would be sent
    })
  })

  describe('resetPreferences', () => {
    it('should reset preferences to defaults', async () => {
      const mockDefaultPreferences = {
        id: '123',
        user_id: 'user123',
        channels: { inApp: true, email: true, push: false, sms: false },
        email_settings: { mentions: true, shares: true, digest: true, updates: true },
        push_settings: { enabled: false, mentions: true, all: false },
        do_not_disturb: { enabled: false, from: '22:00', to: '08:00' },
        metadata: {}
      }

      query.mockResolvedValue({ rows: [mockDefaultPreferences] })

      const result = await preferencesService.resetPreferences('user123')

      expect(result).toEqual(mockDefaultPreferences)
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE notification_preferences'),
        expect.arrayContaining(['user123'])
      )
    })
  })

  describe('deletePreferences', () => {
    it('should delete preferences and return true', async () => {
      query.mockResolvedValue({ rowCount: 1 })

      const result = await preferencesService.deletePreferences('user123')

      expect(result).toBe(true)
      expect(query).toHaveBeenCalledWith(
        'DELETE FROM notification_preferences WHERE user_id = $1',
        ['user123']
      )
    })

    it('should return false if no preferences found', async () => {
      query.mockResolvedValue({ rowCount: 0 })

      const result = await preferencesService.deletePreferences('user123')

      expect(result).toBe(false)
    })
  })
})
