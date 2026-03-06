import { describe, it, expect, beforeEach, vi } from 'vitest'
import PollService, { POLL_STATUS, POLL_TYPE } from '../PollService'

describe('PollService', () => {
  let pollService
  let mockWebRTCService

  beforeEach(() => {
    // Mock WebRTC service
    mockWebRTCService = {
      on: vi.fn(),
      activeService: {
        socket: {
          send: vi.fn()
        }
      }
    }

    pollService = new PollService(mockWebRTCService)
  })

  describe('Poll Creation', () => {
    it('should create a poll with correct structure', () => {
      const pollId = pollService.createPoll({
        question: 'What is your favorite color?',
        options: ['Red', 'Blue', 'Green'],
        type: POLL_TYPE.SINGLE_CHOICE,
        anonymous: true,
        showResults: true
      })

      expect(pollId).toBeTruthy()
      const poll = pollService.getPoll(pollId)
      expect(poll).toBeTruthy()
      expect(poll.question).toBe('What is your favorite color?')
      expect(poll.options).toHaveLength(3)
      expect(poll.status).toBe(POLL_STATUS.DRAFT)
      expect(poll.anonymous).toBe(true)
      expect(poll.showResults).toBe(true)
    })

    it('should create poll options with correct structure', () => {
      const pollId = pollService.createPoll({
        question: 'Test question',
        options: ['Option 1', 'Option 2']
      })

      const poll = pollService.getPoll(pollId)
      poll.options.forEach(option => {
        expect(option).toHaveProperty('id')
        expect(option).toHaveProperty('text')
        expect(option).toHaveProperty('votes')
        expect(option).toHaveProperty('voters')
        expect(option.votes).toBe(0)
        expect(option.voters).toEqual([])
      })
    })

    it('should emit poll-created event', () => {
      const handler = vi.fn()
      pollService.on('poll-created', handler)

      const pollId = pollService.createPoll({
        question: 'Test',
        options: ['A', 'B']
      })

      expect(handler).toHaveBeenCalledTimes(1)
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({
        id: pollId,
        question: 'Test'
      }))
    })
  })

  describe('Poll Lifecycle', () => {
    let pollId

    beforeEach(() => {
      pollId = pollService.createPoll({
        question: 'Test poll',
        options: ['A', 'B', 'C']
      })
    })

    it('should start a poll', () => {
      const result = pollService.startPoll(pollId)
      expect(result).toBe(true)

      const poll = pollService.getPoll(pollId)
      expect(poll.status).toBe(POLL_STATUS.ACTIVE)
      expect(poll.startedAt).toBeTruthy()
    })

    it('should not start an already active poll', () => {
      pollService.startPoll(pollId)
      const result = pollService.startPoll(pollId)
      expect(result).toBe(false)
    })

    it('should end a poll', () => {
      pollService.startPoll(pollId)
      const result = pollService.endPoll(pollId)
      expect(result).toBe(true)

      const poll = pollService.getPoll(pollId)
      expect(poll.status).toBe(POLL_STATUS.CLOSED)
      expect(poll.endedAt).toBeTruthy()
    })

    it('should emit poll-started event', () => {
      const handler = vi.fn()
      pollService.on('poll-started', handler)

      pollService.startPoll(pollId)

      expect(handler).toHaveBeenCalledWith(expect.objectContaining({
        id: pollId,
        status: POLL_STATUS.ACTIVE
      }))
    })

    it('should emit poll-ended event', () => {
      const handler = vi.fn()
      pollService.on('poll-ended', handler)

      pollService.startPoll(pollId)
      pollService.endPoll(pollId)

      expect(handler).toHaveBeenCalledWith(expect.objectContaining({
        id: pollId,
        status: POLL_STATUS.CLOSED
      }))
    })
  })

  describe('Voting', () => {
    let pollId

    beforeEach(() => {
      pollId = pollService.createPoll({
        question: 'Pick one',
        options: ['A', 'B', 'C'],
        type: POLL_TYPE.SINGLE_CHOICE
      })
      pollService.startPoll(pollId)
    })

    it('should allow voting on active poll', () => {
      const poll = pollService.getPoll(pollId)
      const optionId = poll.options[0].id

      const result = pollService.submitVote(pollId, 'user1', optionId)

      expect(result.success).toBe(true)
      expect(result.vote).toBe(optionId)
    })

    it('should update vote counts', () => {
      const poll = pollService.getPoll(pollId)
      const optionId = poll.options[0].id

      pollService.submitVote(pollId, 'user1', optionId)

      const updatedPoll = pollService.getPoll(pollId)
      expect(updatedPoll.options[0].votes).toBe(1)
      expect(updatedPoll.totalVotes).toBe(1)
      expect(updatedPoll.uniqueVoters).toBe(1)
    })

    it('should not allow voting on inactive poll', () => {
      pollService.endPoll(pollId)

      const poll = pollService.getPoll(pollId)
      const optionId = poll.options[0].id

      const result = pollService.submitVote(pollId, 'user1', optionId)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Poll is not active')
    })

    it('should allow changing vote', () => {
      const poll = pollService.getPoll(pollId)
      const option1Id = poll.options[0].id
      const option2Id = poll.options[1].id

      pollService.submitVote(pollId, 'user1', option1Id)
      pollService.submitVote(pollId, 'user1', option2Id)

      const updatedPoll = pollService.getPoll(pollId)
      expect(updatedPoll.options[0].votes).toBe(0)
      expect(updatedPoll.options[1].votes).toBe(1)
      expect(updatedPoll.uniqueVoters).toBe(1) // Still one unique voter
    })

    it('should handle multiple choice polls', () => {
      const multiPollId = pollService.createPoll({
        question: 'Pick multiple',
        options: ['A', 'B', 'C'],
        type: POLL_TYPE.MULTIPLE_CHOICE,
        maxChoices: 2
      })
      pollService.startPoll(multiPollId)

      const poll = pollService.getPoll(multiPollId)
      const selectedOptions = [poll.options[0].id, poll.options[1].id]

      const result = pollService.submitVote(multiPollId, 'user1', selectedOptions)

      expect(result.success).toBe(true)
      expect(result.vote).toEqual(selectedOptions)

      const updatedPoll = pollService.getPoll(multiPollId)
      expect(updatedPoll.options[0].votes).toBe(1)
      expect(updatedPoll.options[1].votes).toBe(1)
      expect(updatedPoll.totalVotes).toBe(2)
    })

    it('should enforce max choices limit', () => {
      const multiPollId = pollService.createPoll({
        question: 'Pick max 2',
        options: ['A', 'B', 'C', 'D'],
        type: POLL_TYPE.MULTIPLE_CHOICE,
        maxChoices: 2
      })
      pollService.startPoll(multiPollId)

      const poll = pollService.getPoll(multiPollId)
      const tooManyOptions = [poll.options[0].id, poll.options[1].id, poll.options[2].id]

      const result = pollService.submitVote(multiPollId, 'user1', tooManyOptions)

      expect(result.success).toBe(false)
      expect(result.error).toContain('Maximum 2 choices')
    })

    it('should reject invalid option IDs', () => {
      const result = pollService.submitVote(pollId, 'user1', 'invalid-option-id')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Invalid option IDs')
    })
  })

  describe('Poll Results', () => {
    let pollId

    beforeEach(() => {
      pollId = pollService.createPoll({
        question: 'Test results',
        options: ['A', 'B', 'C']
      })
      pollService.startPoll(pollId)

      const poll = pollService.getPoll(pollId)
      pollService.submitVote(pollId, 'user1', poll.options[0].id)
      pollService.submitVote(pollId, 'user2', poll.options[0].id)
      pollService.submitVote(pollId, 'user3', poll.options[1].id)
    })

    it('should get poll results', () => {
      const results = pollService.getPollResults(pollId)

      expect(results).toBeTruthy()
      expect(results.pollId).toBe(pollId)
      expect(results.totalVotes).toBe(3)
      expect(results.uniqueVoters).toBe(3)
      expect(results.options).toHaveLength(3)
    })

    it('should calculate percentages correctly', () => {
      const results = pollService.getPollResults(pollId)

      expect(results.options[0].percentage).toBe('66.7') // 2/3
      expect(results.options[1].percentage).toBe('33.3') // 1/3
      expect(results.options[2].percentage).toBe('0.0')
    })

    it('should export results as JSON', () => {
      const json = pollService.exportResults(pollId, 'json')

      expect(json).toBeTruthy()
      const results = JSON.parse(json)
      expect(results.pollId).toBe(pollId)
      expect(results.totalVotes).toBe(3)
    })

    it('should export results as CSV', () => {
      const csv = pollService.exportResults(pollId, 'csv')

      expect(csv).toBeTruthy()
      expect(csv).toContain('Question,Option,Votes,Percentage')
      expect(csv).toContain('Test results')
      expect(csv).toContain('A')
      expect(csv).toContain('B')
      expect(csv).toContain('C')
    })

    it('should export results as text', () => {
      const text = pollService.exportResults(pollId, 'text')

      expect(text).toBeTruthy()
      expect(text).toContain('Poll Results')
      expect(text).toContain('Test results')
      expect(text).toContain('Total Votes: 3')
    })
  })

  describe('Poll Management', () => {
    it('should get all polls', () => {
      pollService.createPoll({ question: 'Q1', options: ['A', 'B'] })
      pollService.createPoll({ question: 'Q2', options: ['C', 'D'] })

      const all = pollService.getAllPolls()
      expect(all).toHaveLength(2)
    })

    it('should filter active polls', () => {
      const id1 = pollService.createPoll({ question: 'Q1', options: ['A', 'B'] })
      const id2 = pollService.createPoll({ question: 'Q2', options: ['C', 'D'] })

      pollService.startPoll(id1)

      const active = pollService.getActivePolls()
      expect(active).toHaveLength(1)
      expect(active[0].id).toBe(id1)
    })

    it('should delete poll', () => {
      const pollId = pollService.createPoll({ question: 'Q', options: ['A', 'B'] })

      const deleted = pollService.deletePoll(pollId)
      expect(deleted).toBe(true)

      const poll = pollService.getPoll(pollId)
      expect(poll).toBeUndefined()
    })
  })

  describe('Event Broadcasting', () => {
    it('should broadcast poll creation via WebSocket', () => {
      pollService.createPoll({
        question: 'Test',
        options: ['A', 'B']
      })

      expect(mockWebRTCService.activeService.socket.send).toHaveBeenCalled()
      const call = mockWebRTCService.activeService.socket.send.mock.calls[0][0]
      const message = JSON.parse(call)

      expect(message.type).toBe('poll:created')
      expect(message.data.poll).toBeTruthy()
    })

    it('should broadcast poll start', () => {
      const pollId = pollService.createPoll({
        question: 'Test',
        options: ['A', 'B']
      })

      mockWebRTCService.activeService.socket.send.mockClear()
      pollService.startPoll(pollId)

      expect(mockWebRTCService.activeService.socket.send).toHaveBeenCalled()
      const call = mockWebRTCService.activeService.socket.send.mock.calls[0][0]
      const message = JSON.parse(call)

      expect(message.type).toBe('poll:started')
      expect(message.data.pollId).toBe(pollId)
    })

    it('should broadcast vote', () => {
      const pollId = pollService.createPoll({
        question: 'Test',
        options: ['A', 'B']
      })
      pollService.startPoll(pollId)

      const poll = pollService.getPoll(pollId)
      const optionId = poll.options[0].id

      mockWebRTCService.activeService.socket.send.mockClear()
      pollService.submitVote(pollId, 'user1', optionId)

      expect(mockWebRTCService.activeService.socket.send).toHaveBeenCalled()
      const calls = mockWebRTCService.activeService.socket.send.mock.calls
      const voteCall = calls.find(c => {
        const msg = JSON.parse(c[0])
        return msg.type === 'poll:vote'
      })

      expect(voteCall).toBeTruthy()
    })
  })

  describe('Cleanup', () => {
    it('should destroy service', () => {
      pollService.createPoll({ question: 'Q', options: ['A', 'B'] })

      pollService.destroy()

      const all = pollService.getAllPolls()
      expect(all).toHaveLength(0)
    })
  })
})
