import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import * as notificationService from '../notificationService.js'

// Mock database module
vi.mock('../../../config/database.js', () => ({
  query: vi.fn(),
  getClient: vi.fn()
}))

import { query } from '../../../config/database.js'

describe('Notification Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('createNotification', () => {
    it('should create a notification with valid data', async () => {
      const mockNotification = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        user_id: 'user123',
        type: 'system',
        title: 'Test Notification',
        message: 'Test message',
        priority: 'medium',
        read: false,
        link: null,
        icon: 'pi-info-circle',
        icon_color: 'blue',
        metadata: {},
        created_at: new Date(),
        updated_at: new Date()
      }

      query.mockResolvedValue({ rows: [mockNotification] })

      const result = await notificationService.createNotification({
        userId: 'user123',
        type: 'system',
        title: 'Test Notification',
        message: 'Test message'
      })

      expect(result).toEqual(mockNotification)
      expect(query).toHaveBeenCalledTimes(1)
    })

    it('should throw error for missing required fields', async () => {
      await expect(
        notificationService.createNotification({
          userId: 'user123'
          // missing type and title
        })
      ).rejects.toThrow('userId, type, and title are required fields')
    })

    it('should throw error for invalid type', async () => {
      await expect(
        notificationService.createNotification({
          userId: 'user123',
          type: 'invalid-type',
          title: 'Test'
        })
      ).rejects.toThrow('Invalid notification type')
    })

    it('should throw error for invalid priority', async () => {
      await expect(
        notificationService.createNotification({
          userId: 'user123',
          type: 'system',
          title: 'Test',
          priority: 'invalid-priority'
        })
      ).rejects.toThrow('Invalid priority')
    })

    it('should use default priority if not provided', async () => {
      const mockNotification = {
        id: '123',
        user_id: 'user123',
        type: 'system',
        title: 'Test',
        priority: 'medium',
        read: false
      }

      query.mockResolvedValue({ rows: [mockNotification] })

      await notificationService.createNotification({
        userId: 'user123',
        type: 'system',
        title: 'Test'
      })

      expect(query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining(['user123', 'system', 'Test', undefined, 'medium'])
      )
    })
  })

  describe('getNotifications', () => {
    it('should get notifications with pagination', async () => {
      const mockNotifications = [
        { id: '1', user_id: 'user123', title: 'Test 1', read: false },
        { id: '2', user_id: 'user123', title: 'Test 2', read: false }
      ]

      query.mockResolvedValueOnce({ rows: [{ total: '2' }] })
      query.mockResolvedValueOnce({ rows: mockNotifications })

      const result = await notificationService.getNotifications('user123', {
        limit: 10,
        offset: 0
      })

      expect(result.notifications).toEqual(mockNotifications)
      expect(result.total).toBe(2)
      expect(result.limit).toBe(10)
      expect(result.offset).toBe(0)
      expect(result.hasMore).toBe(false)
    })

    it('should filter by type', async () => {
      query.mockResolvedValueOnce({ rows: [{ total: '0' }] })
      query.mockResolvedValueOnce({ rows: [] })

      await notificationService.getNotifications('user123', {
        type: 'security'
      })

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('type = $2'),
        expect.arrayContaining(['user123', 'security'])
      )
    })

    it('should filter by read status', async () => {
      query.mockResolvedValueOnce({ rows: [{ total: '0' }] })
      query.mockResolvedValueOnce({ rows: [] })

      await notificationService.getNotifications('user123', {
        read: false
      })

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('read = $2'),
        expect.arrayContaining(['user123', false])
      )
    })

    it('should calculate hasMore correctly', async () => {
      query.mockResolvedValueOnce({ rows: [{ total: '100' }] })
      query.mockResolvedValueOnce({ rows: [] })

      const result = await notificationService.getNotifications('user123', {
        limit: 10,
        offset: 0
      })

      expect(result.hasMore).toBe(true)
    })
  })

  describe('getUnreadCount', () => {
    it('should return unread count for user', async () => {
      query.mockResolvedValue({ rows: [{ count: '5' }] })

      const count = await notificationService.getUnreadCount('user123')

      expect(count).toBe(5)
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('COUNT(*)'),
        ['user123']
      )
    })

    it('should return 0 when no unread notifications', async () => {
      query.mockResolvedValue({ rows: [{ count: '0' }] })

      const count = await notificationService.getUnreadCount('user123')

      expect(count).toBe(0)
    })
  })

  describe('markAsRead', () => {
    it('should mark notification as read', async () => {
      const mockNotification = {
        id: '123',
        user_id: 'user123',
        read: true
      }

      query.mockResolvedValue({ rows: [mockNotification] })

      const result = await notificationService.markAsRead('123', 'user123')

      expect(result).toEqual(mockNotification)
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('SET read = true'),
        ['123', 'user123']
      )
    })

    it('should throw error when notification not found', async () => {
      query.mockResolvedValue({ rows: [] })

      await expect(
        notificationService.markAsRead('nonexistent', 'user123')
      ).rejects.toThrow('Notification not found')
    })
  })

  describe('markAllAsRead', () => {
    it('should mark all notifications as read', async () => {
      query.mockResolvedValue({ rowCount: 5 })

      const count = await notificationService.markAllAsRead('user123')

      expect(count).toBe(5)
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('SET read = true'),
        ['user123']
      )
    })

    it('should return 0 when no notifications to mark', async () => {
      query.mockResolvedValue({ rowCount: 0 })

      const count = await notificationService.markAllAsRead('user123')

      expect(count).toBe(0)
    })
  })

  describe('deleteNotification', () => {
    it('should soft delete notification', async () => {
      query.mockResolvedValue({ rowCount: 1 })

      const result = await notificationService.deleteNotification('123', 'user123')

      expect(result).toBe(true)
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('deleted_at = CURRENT_TIMESTAMP'),
        ['123', 'user123']
      )
    })

    it('should throw error when notification not found', async () => {
      query.mockResolvedValue({ rowCount: 0 })

      await expect(
        notificationService.deleteNotification('nonexistent', 'user123')
      ).rejects.toThrow('Notification not found')
    })
  })

  describe('clearAllNotifications', () => {
    it('should soft delete all notifications', async () => {
      query.mockResolvedValue({ rowCount: 10 })

      const count = await notificationService.clearAllNotifications('user123')

      expect(count).toBe(10)
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('deleted_at = CURRENT_TIMESTAMP'),
        ['user123']
      )
    })
  })

  describe('getGroupedNotifications', () => {
    it('should group notifications by date', async () => {
      const mockNotifications = [
        { id: '1', title: 'Today', date_group: 'today' },
        { id: '2', title: 'Yesterday', date_group: 'yesterday' },
        { id: '3', title: 'This week', date_group: 'thisWeek' },
        { id: '4', title: 'Older', date_group: 'older' }
      ]

      query.mockResolvedValue({ rows: mockNotifications })

      const result = await notificationService.getGroupedNotifications('user123')

      expect(result.today).toHaveLength(1)
      expect(result.yesterday).toHaveLength(1)
      expect(result.thisWeek).toHaveLength(1)
      expect(result.older).toHaveLength(1)
      expect(result.today[0].title).toBe('Today')
      expect(result.today[0]).not.toHaveProperty('date_group')
    })

    it('should filter by read status when grouping', async () => {
      query.mockResolvedValue({ rows: [] })

      await notificationService.getGroupedNotifications('user123', { read: false })

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('read = $2'),
        ['user123', false]
      )
    })
  })

  describe('permanentlyDeleteOldNotifications', () => {
    it('should delete old soft-deleted notifications', async () => {
      query.mockResolvedValue({ rowCount: 5 })

      const count = await notificationService.permanentlyDeleteOldNotifications(30)

      expect(count).toBe(5)
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM notifications')
      )
    })

    it('should use default days if not provided', async () => {
      query.mockResolvedValue({ rowCount: 0 })

      await notificationService.permanentlyDeleteOldNotifications()

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining("INTERVAL '30 days'")
      )
    })
  })
})
