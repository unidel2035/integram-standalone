import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { NotificationTriggerService } from '../notificationTriggerService.js'

// Mock the notification service
vi.mock('../notificationService.js', () => ({
  createNotification: vi.fn()
}))

import { createNotification } from '../notificationService.js'

describe('Notification Trigger Service', () => {
  let triggerService
  let mockWebSocket

  beforeEach(() => {
    triggerService = new NotificationTriggerService()
    mockWebSocket = {
      sendNotificationToUser: vi.fn(),
      sendUnreadCountToUser: vi.fn()
    }
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('setWebSocket', () => {
    it('should set WebSocket instance', () => {
      triggerService.setWebSocket(mockWebSocket)
      expect(triggerService.websocket).toBe(mockWebSocket)
    })
  })

  describe('createAndSend', () => {
    it('should create notification and send via WebSocket', async () => {
      const mockNotification = {
        id: '123',
        userId: 'user123',
        type: 'system',
        title: 'Test',
        message: 'Test message'
      }

      createNotification.mockResolvedValue(mockNotification)
      triggerService.setWebSocket(mockWebSocket)

      const result = await triggerService.createAndSend({
        userId: 'user123',
        type: 'system',
        title: 'Test',
        message: 'Test message'
      })

      expect(result).toEqual(mockNotification)
      expect(createNotification).toHaveBeenCalledWith({
        userId: 'user123',
        type: 'system',
        title: 'Test',
        message: 'Test message'
      })
      expect(mockWebSocket.sendNotificationToUser).toHaveBeenCalledWith('user123', mockNotification)
    })

    it('should create notification without WebSocket if not set', async () => {
      const mockNotification = { id: '123', userId: 'user123' }
      createNotification.mockResolvedValue(mockNotification)

      const result = await triggerService.createAndSend({
        userId: 'user123',
        type: 'system',
        title: 'Test'
      })

      expect(result).toEqual(mockNotification)
      expect(mockWebSocket.sendNotificationToUser).not.toHaveBeenCalled()
    })

    it('should throw error if creation fails', async () => {
      createNotification.mockRejectedValue(new Error('Database error'))

      await expect(
        triggerService.createAndSend({
          userId: 'user123',
          type: 'system',
          title: 'Test'
        })
      ).rejects.toThrow('Database error')
    })
  })

  describe('triggerSystemNotification', () => {
    it('should create system notification with default values', async () => {
      const mockNotification = { id: '123' }
      createNotification.mockResolvedValue(mockNotification)
      triggerService.setWebSocket(mockWebSocket)

      await triggerService.triggerSystemNotification('user123', 'Title', 'Message')

      expect(createNotification).toHaveBeenCalledWith({
        userId: 'user123',
        type: 'system',
        title: 'Title',
        message: 'Message',
        priority: 'medium',
        link: undefined,
        icon: 'pi-info-circle',
        iconColor: 'blue',
        metadata: {}
      })
    })

    it('should accept custom options', async () => {
      const mockNotification = { id: '123' }
      createNotification.mockResolvedValue(mockNotification)

      await triggerService.triggerSystemNotification('user123', 'Title', 'Message', {
        priority: 'high',
        link: '/system',
        icon: 'pi-bell',
        iconColor: 'red',
        metadata: { source: 'admin' }
      })

      expect(createNotification).toHaveBeenCalledWith({
        userId: 'user123',
        type: 'system',
        title: 'Title',
        message: 'Message',
        priority: 'high',
        link: '/system',
        icon: 'pi-bell',
        iconColor: 'red',
        metadata: { source: 'admin' }
      })
    })
  })

  describe('triggerActivityNotification', () => {
    it('should create activity notification with correct defaults', async () => {
      const mockNotification = { id: '123' }
      createNotification.mockResolvedValue(mockNotification)

      await triggerService.triggerActivityNotification('user123', 'New comment', 'User commented on your post')

      expect(createNotification).toHaveBeenCalledWith({
        userId: 'user123',
        type: 'activity',
        title: 'New comment',
        message: 'User commented on your post',
        priority: 'medium',
        link: undefined,
        icon: 'pi-comment',
        iconColor: 'purple',
        metadata: {}
      })
    })
  })

  describe('triggerSecurityNotification', () => {
    it('should create security notification with high priority by default', async () => {
      const mockNotification = { id: '123' }
      createNotification.mockResolvedValue(mockNotification)

      await triggerService.triggerSecurityNotification('user123', 'New login', 'New device detected')

      expect(createNotification).toHaveBeenCalledWith({
        userId: 'user123',
        type: 'security',
        title: 'New login',
        message: 'New device detected',
        priority: 'high',
        link: undefined,
        icon: 'pi-shield',
        iconColor: 'red',
        metadata: {}
      })
    })
  })

  describe('triggerBillingNotification', () => {
    it('should create billing notification', async () => {
      const mockNotification = { id: '123' }
      createNotification.mockResolvedValue(mockNotification)

      await triggerService.triggerBillingNotification('user123', 'Payment received', 'Thank you for your payment')

      expect(createNotification).toHaveBeenCalledWith({
        userId: 'user123',
        type: 'billing',
        title: 'Payment received',
        message: 'Thank you for your payment',
        priority: 'high',
        link: undefined,
        icon: 'pi-credit-card',
        iconColor: 'green',
        metadata: {}
      })
    })
  })

  describe('triggerTeamNotification', () => {
    it('should create team notification', async () => {
      const mockNotification = { id: '123' }
      createNotification.mockResolvedValue(mockNotification)

      await triggerService.triggerTeamNotification('user123', 'Team invitation', 'You have been invited to a team')

      expect(createNotification).toHaveBeenCalledWith({
        userId: 'user123',
        type: 'team',
        title: 'Team invitation',
        message: 'You have been invited to a team',
        priority: 'medium',
        link: undefined,
        icon: 'pi-users',
        iconColor: 'cyan',
        metadata: {}
      })
    })
  })

  describe('triggerAchievementNotification', () => {
    it('should create achievement notification with low priority by default', async () => {
      const mockNotification = { id: '123' }
      createNotification.mockResolvedValue(mockNotification)

      await triggerService.triggerAchievementNotification('user123', 'Milestone reached', 'You completed 100 tasks!')

      expect(createNotification).toHaveBeenCalledWith({
        userId: 'user123',
        type: 'achievement',
        title: 'Milestone reached',
        message: 'You completed 100 tasks!',
        priority: 'low',
        link: undefined,
        icon: 'pi-trophy',
        iconColor: 'orange',
        metadata: {}
      })
    })
  })

  describe('sendUnreadCountUpdate', () => {
    it('should send unread count via WebSocket if set', () => {
      triggerService.setWebSocket(mockWebSocket)

      triggerService.sendUnreadCountUpdate('user123', 5)

      expect(mockWebSocket.sendUnreadCountToUser).toHaveBeenCalledWith('user123', 5)
    })

    it('should not throw error if WebSocket is not set', () => {
      expect(() => {
        triggerService.sendUnreadCountUpdate('user123', 5)
      }).not.toThrow()
    })
  })
})
