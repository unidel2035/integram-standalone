import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import BreakoutRoomsService from '../BreakoutRoomsService'

describe('BreakoutRoomsService', () => {
  let service
  let mockWebRTCService
  const mainRoomName = 'test-main-room'

  beforeEach(() => {
    // Mock WebRTC service
    mockWebRTCService = {
      roomName: mainRoomName,
      disconnect: vi.fn(),
      connect: vi.fn().mockResolvedValue(true)
    }

    // Create service as host
    service = new BreakoutRoomsService(mainRoomName, mockWebRTCService, true)
  })

  afterEach(() => {
    if (service) {
      service.cleanup()
    }
  })

  describe('Initialization', () => {
    it('should initialize with correct properties', () => {
      expect(service.mainRoomName).toBe(mainRoomName)
      expect(service.isHost).toBe(true)
      expect(service.currentRoom).toBe(mainRoomName)
      expect(service.isInBreakout).toBe(false)
      expect(service.breakoutRooms.size).toBe(0)
    })

    it('should not allow non-host to be initialized as host', () => {
      const nonHostService = new BreakoutRoomsService(mainRoomName, mockWebRTCService, false)
      expect(nonHostService.isHost).toBe(false)
      nonHostService.cleanup()
    })
  })

  describe('Room Creation (Host only)', () => {
    it('should create breakout rooms successfully', () => {
      const rooms = service.createRooms(3, { duration: 600000 })

      expect(rooms).toHaveLength(3)
      expect(service.breakoutRooms.size).toBe(3)
      expect(service.sessionDuration).toBe(600000)

      rooms.forEach((room, index) => {
        expect(room.id).toContain('breakout')
        expect(room.name).toContain(`${index + 1}`)
        expect(room.number).toBe(index + 1)
        expect(room.participants).toBeInstanceOf(Set)
        expect(room.participants.size).toBe(0)
      })
    })

    it('should emit rooms-created event', (done) => {
      service.on('rooms-created', (rooms) => {
        expect(rooms).toHaveLength(2)
        done()
      })

      service.createRooms(2)
    })

    it('should throw error if non-host tries to create rooms', () => {
      const nonHostService = new BreakoutRoomsService(mainRoomName, mockWebRTCService, false)

      expect(() => {
        nonHostService.createRooms(3)
      }).toThrow('Only host can create breakout rooms')

      nonHostService.cleanup()
    })

    it('should clear existing rooms when creating new ones', () => {
      service.createRooms(2)
      expect(service.breakoutRooms.size).toBe(2)

      service.createRooms(4)
      expect(service.breakoutRooms.size).toBe(4)
    })
  })

  describe('Participant Management', () => {
    beforeEach(() => {
      // Add some test participants
      service.addParticipant('peer1', 'Alice', false)
      service.addParticipant('peer2', 'Bob', false)
      service.addParticipant('peer3', 'Charlie', false)
    })

    it('should add participants correctly', () => {
      expect(service.participants.size).toBe(3)
      expect(service.participants.get('peer1').name).toBe('Alice')
      expect(service.participants.get('peer2').name).toBe('Bob')
    })

    it('should remove participants correctly', () => {
      service.removeParticipant('peer2')
      expect(service.participants.size).toBe(2)
      expect(service.participants.has('peer2')).toBe(false)
    })
  })

  describe('Participant Assignment', () => {
    beforeEach(() => {
      service.createRooms(2)
      service.addParticipant('peer1', 'Alice', false)
      service.addParticipant('peer2', 'Bob', false)
      service.addParticipant('peer3', 'Charlie', false)
      service.addParticipant('peer4', 'David', false)
    })

    it('should assign participants automatically', () => {
      const assignments = service.assignParticipants('auto')

      expect(assignments.size).toBe(4)
      expect(service.participantAssignments.size).toBe(4)

      // Check distribution is even
      const room1Participants = Array.from(assignments.values()).filter(
        roomId => roomId === Array.from(service.breakoutRooms.keys())[0]
      )
      const room2Participants = Array.from(assignments.values()).filter(
        roomId => roomId === Array.from(service.breakoutRooms.keys())[1]
      )

      expect(room1Participants.length).toBe(2)
      expect(room2Participants.length).toBe(2)
    })

    it('should assign participants manually', () => {
      const manualAssignments = new Map()
      const roomIds = Array.from(service.breakoutRooms.keys())

      manualAssignments.set('peer1', roomIds[0])
      manualAssignments.set('peer2', roomIds[0])
      manualAssignments.set('peer3', roomIds[1])
      manualAssignments.set('peer4', roomIds[1])

      const assignments = service.assignParticipants('manual', manualAssignments)

      expect(assignments.size).toBe(4)
      expect(service.participantAssignments.get('peer1')).toBe(roomIds[0])
      expect(service.participantAssignments.get('peer3')).toBe(roomIds[1])
    })

    it('should throw error if non-host tries to assign participants', () => {
      const nonHostService = new BreakoutRoomsService(mainRoomName, mockWebRTCService, false)

      expect(() => {
        nonHostService.assignParticipants('auto')
      }).toThrow('Only host can assign participants')

      nonHostService.cleanup()
    })

    it('should throw error if no breakout rooms created', () => {
      const newService = new BreakoutRoomsService('test-room', mockWebRTCService, true)

      expect(() => {
        newService.assignParticipants('auto')
      }).toThrow('No breakout rooms created')

      newService.cleanup()
    })

    it('should emit participants-assigned event', (done) => {
      service.on('participants-assigned', (assignments) => {
        expect(assignments.size).toBe(4)
        done()
      })

      service.assignParticipants('auto')
    })
  })

  describe('Session Management', () => {
    beforeEach(() => {
      service.createRooms(2)
      service.addParticipant('peer1', 'Alice', false)
      service.addParticipant('peer2', 'Bob', false)
      service.assignParticipants('auto')
    })

    it('should start session successfully', () => {
      service.startSession()

      expect(service.sessionStartTime).not.toBeNull()
      expect(service.sessionTimer).not.toBeNull()
    })

    it('should emit session-started event', (done) => {
      service.on('session-started', (data) => {
        expect(data.duration).toBe(service.sessionDuration)
        expect(data.startTime).toBe(service.sessionStartTime)
        done()
      })

      service.startSession()
    })

    it('should throw error if non-host tries to start session', () => {
      const nonHostService = new BreakoutRoomsService(mainRoomName, mockWebRTCService, false)

      expect(() => {
        nonHostService.startSession()
      }).toThrow('Only host can start session')

      nonHostService.cleanup()
    })

    it('should throw error if no rooms created', () => {
      const newService = new BreakoutRoomsService('test-room', mockWebRTCService, true)

      expect(() => {
        newService.startSession()
      }).toThrow('No breakout rooms created')

      newService.cleanup()
    })

    it('should throw error if no participants assigned', () => {
      const newService = new BreakoutRoomsService('test-room', mockWebRTCService, true)
      newService.createRooms(2)

      expect(() => {
        newService.startSession()
      }).toThrow('No participants assigned')

      newService.cleanup()
    })

    it('should end session successfully', () => {
      service.startSession()
      service.endSession()

      expect(service.sessionTimer).toBeNull()
      expect(service.sessionStartTime).toBeNull()
      expect(service.sessionTimeRemaining).toBe(0)
    })

    it('should emit session-ended event', (done) => {
      service.on('session-ended', () => {
        done()
      })

      service.startSession()
      service.endSession()
    })
  })

  describe('Timer Functionality', () => {
    beforeEach(() => {
      service.createRooms(2)
      service.addParticipant('peer1', 'Alice', false)
      service.assignParticipants('auto')
    })

    it('should update timer info', (done) => {
      const duration = 5000 // 5 seconds
      service.sessionDuration = duration

      service.on('timer-update', (data) => {
        expect(data.total).toBe(duration)
        expect(data.remaining).toBeLessThanOrEqual(duration)
        expect(data.elapsed).toBeGreaterThanOrEqual(0)
        service.stopTimer()
        done()
      })

      service.startSession()
    }, 10000)

    it('should get timer info correctly', () => {
      service.startSession()

      const timerInfo = service.getTimerInfo()
      expect(timerInfo).not.toBeNull()
      expect(timerInfo.total).toBe(service.sessionDuration)
      expect(timerInfo.isActive).toBe(true)

      service.stopTimer()
    })

    it('should return null timer info when no session active', () => {
      const timerInfo = service.getTimerInfo()
      expect(timerInfo).toBeNull()
    })
  })

  describe('Room Navigation', () => {
    let roomIds

    beforeEach(() => {
      service.createRooms(2)
      roomIds = Array.from(service.breakoutRooms.keys())
    })

    it('should join breakout room successfully', async () => {
      await service.joinBreakoutRoom(roomIds[0])

      expect(service.currentRoom).toBe(roomIds[0])
      expect(service.isInBreakout).toBe(true)
      expect(mockWebRTCService.disconnect).toHaveBeenCalled()
      expect(mockWebRTCService.connect).toHaveBeenCalled()
    })

    it('should emit joined-breakout event', async () => {
      let eventEmitted = false
      service.on('joined-breakout', (data) => {
        expect(data.roomId).toBe(roomIds[0])
        eventEmitted = true
      })

      await service.joinBreakoutRoom(roomIds[0])
      expect(eventEmitted).toBe(true)
    })

    it('should throw error when joining non-existent room', async () => {
      await expect(
        service.joinBreakoutRoom('non-existent-room')
      ).rejects.toThrow('Breakout room not found')
    })

    it('should return to main room successfully', async () => {
      // First join a breakout room
      await service.joinBreakoutRoom(roomIds[0])
      expect(service.isInBreakout).toBe(true)

      // Then return to main
      await service.returnToMainRoom()

      expect(service.currentRoom).toBe(mainRoomName)
      expect(service.isInBreakout).toBe(false)
      expect(mockWebRTCService.disconnect).toHaveBeenCalledTimes(2)
      expect(mockWebRTCService.connect).toHaveBeenCalledTimes(2)
    })

    it('should emit returned-to-main event', async () => {
      await service.joinBreakoutRoom(roomIds[0])

      let eventEmitted = false
      service.on('returned-to-main', (data) => {
        expect(data.previousRoom).toBe(roomIds[0])
        eventEmitted = true
      })

      await service.returnToMainRoom()
      expect(eventEmitted).toBe(true)
    })

    it('should handle returning to main when already in main', async () => {
      expect(service.currentRoom).toBe(mainRoomName)

      await service.returnToMainRoom()

      expect(service.currentRoom).toBe(mainRoomName)
      // Should not call disconnect/connect if already in main
      expect(mockWebRTCService.disconnect).not.toHaveBeenCalled()
    })
  })

  describe('Room Information', () => {
    it('should get current room info for main room', () => {
      const roomInfo = service.getCurrentRoom()

      expect(roomInfo.id).toBe(mainRoomName)
      expect(roomInfo.isMain).toBe(true)
      expect(roomInfo.isBreakout).toBe(false)
    })

    it('should get current room info for breakout room', async () => {
      service.createRooms(2)
      const roomId = Array.from(service.breakoutRooms.keys())[0]

      await service.joinBreakoutRoom(roomId)
      const roomInfo = service.getCurrentRoom()

      expect(roomInfo.id).toBe(roomId)
      expect(roomInfo.isMain).toBe(false)
      expect(roomInfo.isBreakout).toBe(true)
    })

    it('should get all breakout rooms', () => {
      service.createRooms(3)
      const rooms = service.getBreakoutRooms()

      expect(rooms).toHaveLength(3)
      rooms.forEach((room, index) => {
        expect(room.id).toBeDefined()
        expect(room.name).toBeDefined()
        expect(room.number).toBe(index + 1)
        expect(room.participantCount).toBe(0)
      })
    })

    it('should get participant assignment', () => {
      service.createRooms(2)
      service.addParticipant('peer1', 'Alice', false)
      service.assignParticipants('auto')

      const assignment = service.getAssignment('peer1')
      expect(assignment).toBeDefined()
      expect(service.breakoutRooms.has(assignment)).toBe(true)
    })
  })

  describe('Cleanup', () => {
    it('should cleanup all resources', () => {
      service.createRooms(3)
      service.addParticipant('peer1', 'Alice', false)
      service.addParticipant('peer2', 'Bob', false)
      service.assignParticipants('auto')
      service.startSession()

      service.cleanup()

      expect(service.sessionTimer).toBeNull()
      expect(service.breakoutRooms.size).toBe(0)
      expect(service.participants.size).toBe(0)
      expect(service.participantAssignments.size).toBe(0)
    })
  })
})
