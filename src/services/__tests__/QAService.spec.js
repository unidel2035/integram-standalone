import { describe, it, expect, beforeEach, vi } from 'vitest'
import QAService, { QUESTION_STATUS, QA_MODE } from '../QAService'

describe('QAService', () => {
  let qaService
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

    qaService = new QAService(mockWebRTCService, false) // not host
  })

  describe('Question Submission', () => {
    it('should submit a question successfully', () => {
      const result = qaService.submitQuestion({
        text: 'What is the meaning of life?',
        authorId: 'user1',
        authorName: 'John Doe',
        anonymous: false
      })

      expect(result.success).toBe(true)
      expect(result.question).toBeTruthy()
      expect(result.question.text).toBe('What is the meaning of life?')
      expect(result.question.status).toBe(QUESTION_STATUS.PENDING)
    })

    it('should create anonymous question when requested', () => {
      qaService.setAnonymous(true)

      const result = qaService.submitQuestion({
        text: 'Test question',
        authorId: 'user1',
        authorName: 'John Doe',
        anonymous: true
      })

      expect(result.question.authorName).toBe('Anonymous')
      expect(result.question.authorId).toBeNull()
      expect(result.question.anonymous).toBe(true)
    })

    it('should emit question-submitted event', () => {
      const handler = vi.fn()
      qaService.on('question-submitted', handler)

      qaService.submitQuestion({
        text: 'Test',
        authorId: 'user1',
        authorName: 'John'
      })

      expect(handler).toHaveBeenCalledTimes(1)
    })

    it('should set needsModeration in moderated mode', () => {
      qaService.setMode(QA_MODE.MODERATED)

      const result = qaService.submitQuestion({
        text: 'Test',
        authorId: 'user1',
        authorName: 'John'
      })

      expect(result.question.needsModeration).toBe(true)
    })
  })

  describe('Question Upvoting', () => {
    let questionId

    beforeEach(() => {
      const result = qaService.submitQuestion({
        text: 'Test question',
        authorId: 'user1',
        authorName: 'John'
      })
      questionId = result.question.id
    })

    it('should upvote a question', () => {
      const result = qaService.upvoteQuestion(questionId, 'user2')

      expect(result.success).toBe(true)
      expect(result.upvotes).toBe(1)

      const question = qaService.getQuestion(questionId)
      expect(question.upvotes).toBe(1)
    })

    it('should toggle upvote (remove on second click)', () => {
      qaService.upvoteQuestion(questionId, 'user2')
      const result = qaService.upvoteQuestion(questionId, 'user2')

      expect(result.success).toBe(true)
      expect(result.upvotes).toBe(0)
    })

    it('should track multiple upvotes', () => {
      qaService.upvoteQuestion(questionId, 'user2')
      qaService.upvoteQuestion(questionId, 'user3')
      qaService.upvoteQuestion(questionId, 'user4')

      const question = qaService.getQuestion(questionId)
      expect(question.upvotes).toBe(3)
    })

    it('should emit question-upvoted event', () => {
      const handler = vi.fn()
      qaService.on('question-upvoted', handler)

      qaService.upvoteQuestion(questionId, 'user2')

      expect(handler).toHaveBeenCalledWith(expect.objectContaining({
        questionId,
        upvotes: 1
      }))
    })
  })

  describe('Answering Questions (Host)', () => {
    let hostQAService
    let questionId

    beforeEach(() => {
      hostQAService = new QAService(mockWebRTCService, true) // is host

      const result = hostQAService.submitQuestion({
        text: 'How does this work?',
        authorId: 'user1',
        authorName: 'John'
      })
      questionId = result.question.id
    })

    it('should allow host to answer questions', () => {
      const result = hostQAService.answerQuestion(
        questionId,
        'It works like this...',
        'Host User'
      )

      expect(result.success).toBe(true)
      expect(result.question.answer).toBe('It works like this...')
      expect(result.question.answeredBy).toBe('Host User')
      expect(result.question.status).toBe(QUESTION_STATUS.ANSWERED)
      expect(result.question.answeredAt).toBeTruthy()
    })

    it('should not allow non-host to answer', () => {
      const result = qaService.answerQuestion(
        questionId,
        'Trying to answer',
        'User'
      )

      expect(result.success).toBe(false)
      expect(result.error).toBe('Only host can answer questions')
    })

    it('should emit question-answered event', () => {
      const handler = vi.fn()
      hostQAService.on('question-answered', handler)

      hostQAService.answerQuestion(questionId, 'Answer', 'Host')

      expect(handler).toHaveBeenCalledWith(expect.objectContaining({
        id: questionId,
        answer: 'Answer'
      }))
    })
  })

  describe('Question Dismissal (Host)', () => {
    let hostQAService
    let questionId

    beforeEach(() => {
      hostQAService = new QAService(mockWebRTCService, true)

      const result = hostQAService.submitQuestion({
        text: 'Inappropriate question',
        authorId: 'user1',
        authorName: 'John'
      })
      questionId = result.question.id
    })

    it('should allow host to dismiss questions', () => {
      const result = hostQAService.dismissQuestion(questionId)

      expect(result.success).toBe(true)

      const question = hostQAService.getQuestion(questionId)
      expect(question.status).toBe(QUESTION_STATUS.DISMISSED)
    })

    it('should not allow non-host to dismiss', () => {
      const result = qaService.dismissQuestion(questionId)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Only host can dismiss questions')
    })
  })

  describe('Question Filtering', () => {
    let hostQAService

    beforeEach(() => {
      hostQAService = new QAService(mockWebRTCService, true)

      // Create answered question
      const q1 = hostQAService.submitQuestion({
        text: 'Q1',
        authorId: 'user1',
        authorName: 'John'
      })
      hostQAService.answerQuestion(q1.question.id, 'A1', 'Host')

      // Create unanswered question
      hostQAService.submitQuestion({
        text: 'Q2',
        authorId: 'user2',
        authorName: 'Jane'
      })

      // Create dismissed question
      const q3 = hostQAService.submitQuestion({
        text: 'Q3',
        authorId: 'user3',
        authorName: 'Bob'
      })
      hostQAService.dismissQuestion(q3.question.id)
    })

    it('should get all questions (host view)', () => {
      const all = hostQAService.getAllQuestions()
      expect(all).toHaveLength(3)
    })

    it('should filter by status', () => {
      const answered = hostQAService.getAllQuestions({ status: QUESTION_STATUS.ANSWERED })
      expect(answered).toHaveLength(1)
      expect(answered[0].text).toBe('Q1')
    })

    it('should get unanswered questions', () => {
      const unanswered = hostQAService.getUnansweredQuestions()
      expect(unanswered).toHaveLength(1)
      expect(unanswered[0].text).toBe('Q2')
    })

    it('should get answered questions', () => {
      const answered = hostQAService.getAnsweredQuestions()
      expect(answered).toHaveLength(1)
      expect(answered[0].text).toBe('Q1')
    })

    it('should hide dismissed questions from non-host', () => {
      const participantQAService = new QAService(mockWebRTCService, false)

      // Manually add questions to simulate receiving from host
      participantQAService.questions.set('q1', { id: 'q1', status: QUESTION_STATUS.ANSWERED })
      participantQAService.questions.set('q2', { id: 'q2', status: QUESTION_STATUS.PENDING })
      participantQAService.questions.set('q3', { id: 'q3', status: QUESTION_STATUS.DISMISSED })

      const visible = participantQAService.getAllQuestions()
      expect(visible).toHaveLength(2)
    })

    it('should sort by upvotes', () => {
      // Add upvotes to questions
      const questions = hostQAService.getAllQuestions()
      questions.forEach((q, i) => {
        for (let j = 0; j < i; j++) {
          hostQAService.upvoteQuestion(q.id, `user_upvote_${j}`)
        }
      })

      const sorted = hostQAService.getAllQuestions({ sortBy: 'upvotes' })
      expect(sorted[0].upvotes).toBeGreaterThanOrEqual(sorted[1].upvotes)
      expect(sorted[1].upvotes).toBeGreaterThanOrEqual(sorted[2].upvotes)
    })
  })

  describe('Q&A Mode Management', () => {
    let hostQAService

    beforeEach(() => {
      hostQAService = new QAService(mockWebRTCService, true)
    })

    it('should set Q&A mode', () => {
      const result = hostQAService.setMode(QA_MODE.MODERATED)

      expect(result).toBe(true)
      expect(hostQAService.mode).toBe(QA_MODE.MODERATED)
    })

    it('should emit mode-changed event', () => {
      const handler = vi.fn()
      hostQAService.on('mode-changed', handler)

      hostQAService.setMode(QA_MODE.MODERATED)

      expect(handler).toHaveBeenCalledWith(QA_MODE.MODERATED)
    })

    it('should reject invalid mode', () => {
      const result = hostQAService.setMode('invalid-mode')

      expect(result).toBe(false)
    })
  })

  describe('Statistics', () => {
    let hostQAService

    beforeEach(() => {
      hostQAService = new QAService(mockWebRTCService, true)

      // Create mix of questions
      const q1 = hostQAService.submitQuestion({ text: 'Q1', authorId: 'u1', authorName: 'A' })
      hostQAService.answerQuestion(q1.question.id, 'A1', 'Host')

      hostQAService.submitQuestion({ text: 'Q2', authorId: 'u2', authorName: 'B' })

      const q3 = hostQAService.submitQuestion({ text: 'Q3', authorId: 'u3', authorName: 'C' })
      hostQAService.dismissQuestion(q3.question.id)

      // Add upvotes
      hostQAService.upvoteQuestion(q1.question.id, 'u4')
      hostQAService.upvoteQuestion(q1.question.id, 'u5')
    })

    it('should get statistics', () => {
      const stats = hostQAService.getStats()

      expect(stats.total).toBe(3)
      expect(stats.answered).toBe(1)
      expect(stats.pending).toBe(1)
      expect(stats.dismissed).toBe(1)
      expect(stats.totalUpvotes).toBe(2)
    })
  })

  describe('Export', () => {
    let hostQAService

    beforeEach(() => {
      hostQAService = new QAService(mockWebRTCService, true)

      const q1 = hostQAService.submitQuestion({
        text: 'What is AI?',
        authorId: 'user1',
        authorName: 'John'
      })
      hostQAService.answerQuestion(q1.question.id, 'Artificial Intelligence', 'Host')
      hostQAService.upvoteQuestion(q1.question.id, 'user2')
    })

    it('should export as JSON', () => {
      const json = hostQAService.exportSession('json')

      expect(json).toBeTruthy()
      const data = JSON.parse(json)
      expect(data.mode).toBe(QA_MODE.PUBLIC)
      expect(data.stats).toBeTruthy()
      expect(data.questions).toHaveLength(1)
    })

    it('should export as CSV', () => {
      const csv = hostQAService.exportSession('csv')

      expect(csv).toBeTruthy()
      expect(csv).toContain('Question,Author,Upvotes,Status,Answer')
      expect(csv).toContain('What is AI?')
      expect(csv).toContain('Artificial Intelligence')
    })

    it('should export as text', () => {
      const text = hostQAService.exportSession('text')

      expect(text).toBeTruthy()
      expect(text).toContain('Q&A Session Export')
      expect(text).toContain('What is AI?')
      expect(text).toContain('Artificial Intelligence')
      expect(text).toContain('Total Questions: 1')
      expect(text).toContain('Answered: 1')
    })
  })

  describe('Event Broadcasting', () => {
    it('should broadcast question submission', () => {
      qaService.submitQuestion({
        text: 'Test',
        authorId: 'user1',
        authorName: 'John'
      })

      expect(mockWebRTCService.activeService.socket.send).toHaveBeenCalled()
      const call = mockWebRTCService.activeService.socket.send.mock.calls[0][0]
      const message = JSON.parse(call)

      expect(message.type).toBe('qa:question-submitted')
      expect(message.data.question).toBeTruthy()
    })

    it('should broadcast upvote', () => {
      const result = qaService.submitQuestion({
        text: 'Test',
        authorId: 'user1',
        authorName: 'John'
      })

      mockWebRTCService.activeService.socket.send.mockClear()
      qaService.upvoteQuestion(result.question.id, 'user2')

      expect(mockWebRTCService.activeService.socket.send).toHaveBeenCalled()
      const call = mockWebRTCService.activeService.socket.send.mock.calls[0][0]
      const message = JSON.parse(call)

      expect(message.type).toBe('qa:question-upvoted')
    })

    it('should broadcast mode change', () => {
      const hostQAService = new QAService(mockWebRTCService, true)

      mockWebRTCService.activeService.socket.send.mockClear()
      hostQAService.setMode(QA_MODE.MODERATED)

      expect(mockWebRTCService.activeService.socket.send).toHaveBeenCalled()
      const call = mockWebRTCService.activeService.socket.send.mock.calls[0][0]
      const message = JSON.parse(call)

      expect(message.type).toBe('qa:mode-changed')
      expect(message.data.mode).toBe(QA_MODE.MODERATED)
    })
  })

  describe('Cleanup', () => {
    it('should destroy service', () => {
      qaService.submitQuestion({
        text: 'Test',
        authorId: 'user1',
        authorName: 'John'
      })

      qaService.destroy()

      const all = qaService.getAllQuestions()
      expect(all).toHaveLength(0)
    })
  })
})
