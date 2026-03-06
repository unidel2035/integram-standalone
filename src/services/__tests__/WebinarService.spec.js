import { describe, it, expect, beforeEach } from 'vitest'
import WebinarService, { WEBINAR_ROLE, WEBINAR_PERMISSION, WEBINAR_STATUS } from '../WebinarService'

describe('WebinarService', () => {
  let webinarService

  beforeEach(() => {
    webinarService = new WebinarService('test-webinar', 'user-1', WEBINAR_ROLE.HOST)
  })

  describe('initialization', () => {
    it('should initialize with correct parameters', () => {
      expect(webinarService.webinarId).toBe('test-webinar')
      expect(webinarService.userId).toBe('user-1')
      expect(webinarService.userRole).toBe(WEBINAR_ROLE.HOST)
      expect(webinarService.status).toBe(WEBINAR_STATUS.WAITING)
    })

    it('should initialize with empty participants', () => {
      expect(webinarService.participants.size).toBe(0)
    })
  })

  describe('startWebinar', () => {
    it('should start webinar when user is host', async () => {
      await webinarService.startWebinar()
      expect(webinarService.status).toBe(WEBINAR_STATUS.LIVE)
      expect(webinarService.webinarInfo.actualStartTime).toBeTruthy()
    })

    it('should throw error when non-host tries to start', async () => {
      const attendeeService = new WebinarService('test-webinar', 'user-2', WEBINAR_ROLE.ATTENDEE)
      await expect(attendeeService.startWebinar()).rejects.toThrow('Only host can start the webinar')
    })
  })

  describe('endWebinar', () => {
    it('should end webinar when user is host', async () => {
      await webinarService.startWebinar()
      await webinarService.endWebinar()
      expect(webinarService.status).toBe(WEBINAR_STATUS.ENDED)
      expect(webinarService.webinarInfo.endTime).toBeTruthy()
    })

    it('should throw error when non-host tries to end', async () => {
      const attendeeService = new WebinarService('test-webinar', 'user-2', WEBINAR_ROLE.ATTENDEE)
      await expect(attendeeService.endWebinar()).rejects.toThrow('Only host can end the webinar')
    })
  })

  describe('participant management', () => {
    it('should add participant with correct role', () => {
      const participant = webinarService.addParticipant('user-2', {
        name: 'Test User',
        email: 'test@example.com',
        role: WEBINAR_ROLE.ATTENDEE
      })

      expect(participant.userId).toBe('user-2')
      expect(participant.name).toBe('Test User')
      expect(participant.role).toBe(WEBINAR_ROLE.ATTENDEE)
      expect(participant.isOnline).toBe(true)
      expect(webinarService.participants.size).toBe(1)
    })

    it('should track analytics when participant joins', () => {
      webinarService.addParticipant('user-2', { name: 'User 2' })
      expect(webinarService.analytics.totalAttendees).toBe(1)
      expect(webinarService.analytics.peakAttendees).toBe(1)
    })

    it('should update peak attendees correctly', () => {
      webinarService.addParticipant('user-2', { name: 'User 2' })
      webinarService.addParticipant('user-3', { name: 'User 3' })
      expect(webinarService.analytics.peakAttendees).toBe(2)

      webinarService.removeParticipant('user-2')
      webinarService.addParticipant('user-4', { name: 'User 4' })
      expect(webinarService.analytics.peakAttendees).toBe(2)
    })

    it('should remove participant', () => {
      webinarService.addParticipant('user-2', { name: 'User 2' })
      webinarService.removeParticipant('user-2')

      const participant = webinarService.participants.get('user-2')
      expect(participant.isOnline).toBe(false)
      expect(participant.leftAt).toBeTruthy()
    })
  })

  describe('role management', () => {
    beforeEach(() => {
      webinarService.addParticipant('user-2', {
        name: 'Test User',
        role: WEBINAR_ROLE.ATTENDEE
      })
    })

    it('should change participant role', () => {
      webinarService.changeParticipantRole('user-2', WEBINAR_ROLE.PRESENTER)

      const participant = webinarService.participants.get('user-2')
      expect(participant.role).toBe(WEBINAR_ROLE.PRESENTER)
      expect(webinarService.presenters.has('user-2')).toBe(true)
    })

    it('should update permissions when role changes', () => {
      webinarService.changeParticipantRole('user-2', WEBINAR_ROLE.PRESENTER)

      const perms = webinarService.permissions.get('user-2')
      expect(perms.has(WEBINAR_PERMISSION.CAN_SPEAK)).toBe(true)
      expect(perms.has(WEBINAR_PERMISSION.CAN_SHARE_SCREEN)).toBe(true)
      expect(perms.has(WEBINAR_PERMISSION.CAN_ENABLE_CAMERA)).toBe(true)
    })

    it('should throw error when non-manager tries to change role', () => {
      const attendeeService = new WebinarService('test-webinar', 'user-3', WEBINAR_ROLE.ATTENDEE)
      attendeeService.addParticipant('user-2', { name: 'User 2' })

      expect(() => {
        attendeeService.changeParticipantRole('user-2', WEBINAR_ROLE.PRESENTER)
      }).toThrow('No permission to change participant roles')
    })
  })

  describe('permissions', () => {
    it('should set host permissions correctly', () => {
      const perms = webinarService.setRolePermissions('user-1', WEBINAR_ROLE.HOST)

      expect(perms.has(WEBINAR_PERMISSION.CAN_SPEAK)).toBe(true)
      expect(perms.has(WEBINAR_PERMISSION.CAN_SHARE_SCREEN)).toBe(true)
      expect(perms.has(WEBINAR_PERMISSION.CAN_MANAGE_ATTENDEES)).toBe(true)
      expect(perms.has(WEBINAR_PERMISSION.CAN_START_RECORDING)).toBe(true)
      expect(perms.has(WEBINAR_PERMISSION.CAN_START_STREAMING)).toBe(true)
    })

    it('should set presenter permissions correctly', () => {
      const perms = webinarService.setRolePermissions('user-2', WEBINAR_ROLE.PRESENTER)

      expect(perms.has(WEBINAR_PERMISSION.CAN_SPEAK)).toBe(true)
      expect(perms.has(WEBINAR_PERMISSION.CAN_SHARE_SCREEN)).toBe(true)
      expect(perms.has(WEBINAR_PERMISSION.CAN_ENABLE_CAMERA)).toBe(true)
      expect(perms.has(WEBINAR_PERMISSION.CAN_MANAGE_ATTENDEES)).toBe(false)
      expect(perms.has(WEBINAR_PERMISSION.CAN_START_RECORDING)).toBe(false)
    })

    it('should set moderator permissions correctly', () => {
      const perms = webinarService.setRolePermissions('user-2', WEBINAR_ROLE.MODERATOR)

      expect(perms.has(WEBINAR_PERMISSION.CAN_SPEAK)).toBe(true)
      expect(perms.has(WEBINAR_PERMISSION.CAN_MANAGE_CHAT)).toBe(true)
      expect(perms.has(WEBINAR_PERMISSION.CAN_MANAGE_ATTENDEES)).toBe(true)
      expect(perms.has(WEBINAR_PERMISSION.CAN_SHARE_SCREEN)).toBe(false)
    })

    it('should set attendee permissions correctly', () => {
      const perms = webinarService.setRolePermissions('user-2', WEBINAR_ROLE.ATTENDEE)

      expect(perms.size).toBe(0)
    })

    it('should grant permission', () => {
      webinarService.addParticipant('user-2', {
        name: 'User 2',
        role: WEBINAR_ROLE.ATTENDEE
      })

      webinarService.grantPermission('user-2', WEBINAR_PERMISSION.CAN_SPEAK)

      const perms = webinarService.permissions.get('user-2')
      expect(perms.has(WEBINAR_PERMISSION.CAN_SPEAK)).toBe(true)
    })

    it('should revoke permission', () => {
      webinarService.addParticipant('user-2', {
        name: 'User 2',
        role: WEBINAR_ROLE.PRESENTER
      })

      webinarService.revokePermission('user-2', WEBINAR_PERMISSION.CAN_SPEAK)

      const perms = webinarService.permissions.get('user-2')
      expect(perms.has(WEBINAR_PERMISSION.CAN_SPEAK)).toBe(false)
    })
  })

  describe('analytics', () => {
    it('should record chat messages', () => {
      webinarService.recordAnalyticsEvent('chat_message')
      expect(webinarService.analytics.chatMessages).toBe(1)
    })

    it('should record questions', () => {
      webinarService.recordAnalyticsEvent('question')
      expect(webinarService.analytics.questions).toBe(1)
    })

    it('should record reactions', () => {
      webinarService.recordAnalyticsEvent('reaction', { emoji: '👍' })
      webinarService.recordAnalyticsEvent('reaction', { emoji: '👍' })
      webinarService.recordAnalyticsEvent('reaction', { emoji: '❤️' })

      expect(webinarService.analytics.reactions['👍']).toBe(2)
      expect(webinarService.analytics.reactions['❤️']).toBe(1)
    })

    it('should get analytics summary', () => {
      webinarService.addParticipant('user-2', { name: 'User 2' })
      webinarService.addParticipant('user-3', { name: 'User 3' })

      const analytics = webinarService.getAnalytics()

      expect(analytics.currentAttendees).toBe(2)
      expect(analytics.totalAttendees).toBe(2)
      expect(analytics.peakAttendees).toBe(2)
    })
  })

  describe('queries', () => {
    beforeEach(() => {
      webinarService.addParticipant('user-2', {
        name: 'User 2',
        role: WEBINAR_ROLE.PRESENTER
      })
      webinarService.addParticipant('user-3', {
        name: 'User 3',
        role: WEBINAR_ROLE.ATTENDEE
      })
      webinarService.addParticipant('user-4', {
        name: 'User 4',
        role: WEBINAR_ROLE.ATTENDEE
      })
    })

    it('should get all participants', () => {
      const participants = webinarService.getParticipants()
      expect(participants.length).toBe(3)
    })

    it('should get presenters', () => {
      const presenters = webinarService.getPresenters()
      expect(presenters.length).toBe(1)
      expect(presenters[0].userId).toBe('user-2')
    })

    it('should get attendees', () => {
      const attendees = webinarService.getAttendees()
      expect(attendees.length).toBe(2)
    })

    it('should get online attendees count', () => {
      webinarService.removeParticipant('user-4')
      const count = webinarService.getOnlineAttendeesCount()
      expect(count).toBe(2)
    })
  })

  describe('event handling', () => {
    it('should emit events', (done) => {
      let eventFired = false

      webinarService.on('test-event', (data) => {
        eventFired = true
        expect(data.value).toBe('test')
        done()
      })

      webinarService.emit('test-event', { value: 'test' })
      expect(eventFired).toBe(true)
    })

    it('should handle multiple event handlers', () => {
      let count = 0

      webinarService.on('test-event', () => count++)
      webinarService.on('test-event', () => count++)

      webinarService.emit('test-event')
      expect(count).toBe(2)
    })
  })

  describe('cleanup', () => {
    it('should cleanup resources', () => {
      webinarService.addParticipant('user-2', { name: 'User 2' })
      webinarService.cleanup()

      expect(webinarService.participants.size).toBe(0)
      expect(webinarService.presenters.size).toBe(0)
      expect(webinarService.permissions.size).toBe(0)
    })
  })
})
