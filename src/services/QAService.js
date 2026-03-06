import { logger } from '@/utils/logger'

/**
 * Q&A Service for managing questions and answers during video conferences
 * Handles question submission, upvoting, moderation, and real-time synchronization via WebSocket
 */

export const QUESTION_STATUS = {
  PENDING: 'pending',
  ANSWERED: 'answered',
  DISMISSED: 'dismissed'
}

export const QA_MODE = {
  PUBLIC: 'public',
  ANONYMOUS: 'anonymous',
  MODERATED: 'moderated'
}

export default class QAService {
  constructor(webrtcService, isHost = false) {
    this.webrtcService = webrtcService
    this.isHost = isHost
    this.questions = new Map() // questionId -> question object
    this.userUpvotes = new Map() // questionId -> Set of userIds who upvoted
    this.eventHandlers = new Map()
    this.mode = QA_MODE.PUBLIC
    this.anonymousEnabled = true

    logger.debug('❓ [Q&A] Service initialized, host:', isHost)
    this.setupEventListeners()
  }

  /**
   * Setup event listeners for WebSocket messages
   */
  setupEventListeners() {
    if (!this.webrtcService) {
      logger.warn('❓ [Q&A] No WebRTC service provided, real-time sync disabled')
      return
    }

    // Listen for Q&A-related events
    this.webrtcService.on('qa:question-submitted', (data) => this.handleQuestionSubmitted(data))
    this.webrtcService.on('qa:question-upvoted', (data) => this.handleQuestionUpvoted(data))
    this.webrtcService.on('qa:question-answered', (data) => this.handleQuestionAnswered(data))
    this.webrtcService.on('qa:question-dismissed', (data) => this.handleQuestionDismissed(data))
    this.webrtcService.on('qa:mode-changed', (data) => this.handleModeChanged(data))
    this.webrtcService.on('qa:sync', (data) => this.handleSync(data))
  }

  /**
   * Set Q&A mode
   * @param {string} mode - QA_MODE constant
   */
  setMode(mode) {
    if (!Object.values(QA_MODE).includes(mode)) {
      logger.error(`❓ [Q&A] Invalid mode: ${mode}`)
      return false
    }

    this.mode = mode
    logger.debug(`❓ [Q&A] Mode changed to: ${mode}`)

    // Broadcast mode change
    this.broadcastModeChange(mode)
    this.emit('mode-changed', mode)

    return true
  }

  /**
   * Enable/disable anonymous questions
   * @param {boolean} enabled
   */
  setAnonymous(enabled) {
    this.anonymousEnabled = enabled
    logger.debug(`❓ [Q&A] Anonymous questions ${enabled ? 'enabled' : 'disabled'}`)
    this.emit('anonymous-changed', enabled)
  }

  /**
   * Submit a new question
   * @param {Object} questionData
   * @returns {Object} question object or error
   */
  submitQuestion(questionData) {
    const questionId = this.generateQuestionId()

    const question = {
      id: questionId,
      text: questionData.text,
      authorId: questionData.anonymous && this.anonymousEnabled ? null : questionData.authorId,
      authorName: questionData.anonymous && this.anonymousEnabled ? 'Anonymous' : questionData.authorName,
      anonymous: questionData.anonymous && this.anonymousEnabled,
      status: this.mode === QA_MODE.MODERATED ? QUESTION_STATUS.PENDING : QUESTION_STATUS.PENDING,
      upvotes: 0,
      answer: null,
      answeredBy: null,
      answeredAt: null,
      createdAt: new Date().toISOString(),
      needsModeration: this.mode === QA_MODE.MODERATED && !this.isHost
    }

    this.questions.set(questionId, question)
    this.userUpvotes.set(questionId, new Set())

    logger.debug(`❓ [Q&A] Question submitted: ${questionId}`)

    // Broadcast question
    this.broadcastQuestionSubmitted(question)
    this.emit('question-submitted', question)

    return { success: true, question }
  }

  /**
   * Upvote a question
   * @param {string} questionId
   * @param {string} userId
   */
  upvoteQuestion(questionId, userId) {
    const question = this.questions.get(questionId)
    if (!question) {
      logger.error(`❓ [Q&A] Cannot upvote: question ${questionId} not found`)
      return { success: false, error: 'Question not found' }
    }

    const upvoters = this.userUpvotes.get(questionId)

    // Check if already upvoted
    if (upvoters.has(userId)) {
      // Remove upvote (toggle)
      upvoters.delete(userId)
      question.upvotes--
      logger.debug(`❓ [Q&A] User ${userId} removed upvote from question ${questionId}`)
    } else {
      // Add upvote
      upvoters.add(userId)
      question.upvotes++
      logger.debug(`❓ [Q&A] User ${userId} upvoted question ${questionId}`)
    }

    // Broadcast upvote
    this.broadcastQuestionUpvoted(questionId, question.upvotes)
    this.emit('question-upvoted', { questionId, upvotes: question.upvotes })

    return { success: true, upvotes: question.upvotes }
  }

  /**
   * Answer a question (host only)
   * @param {string} questionId
   * @param {string} answerText
   * @param {string} answeredBy - userId of person answering
   */
  answerQuestion(questionId, answerText, answeredBy) {
    if (!this.isHost) {
      logger.error('❓ [Q&A] Only host can answer questions')
      return { success: false, error: 'Only host can answer questions' }
    }

    const question = this.questions.get(questionId)
    if (!question) {
      logger.error(`❓ [Q&A] Cannot answer: question ${questionId} not found`)
      return { success: false, error: 'Question not found' }
    }

    question.answer = answerText
    question.answeredBy = answeredBy
    question.answeredAt = new Date().toISOString()
    question.status = QUESTION_STATUS.ANSWERED

    logger.debug(`❓ [Q&A] Question ${questionId} answered`)

    // Broadcast answer
    this.broadcastQuestionAnswered(questionId, answerText, answeredBy)
    this.emit('question-answered', question)

    return { success: true, question }
  }

  /**
   * Dismiss a question (host only, for moderation)
   * @param {string} questionId
   */
  dismissQuestion(questionId) {
    if (!this.isHost) {
      logger.error('❓ [Q&A] Only host can dismiss questions')
      return { success: false, error: 'Only host can dismiss questions' }
    }

    const question = this.questions.get(questionId)
    if (!question) {
      logger.error(`❓ [Q&A] Cannot dismiss: question ${questionId} not found`)
      return { success: false, error: 'Question not found' }
    }

    question.status = QUESTION_STATUS.DISMISSED

    logger.debug(`❓ [Q&A] Question ${questionId} dismissed`)

    // Broadcast dismissal
    this.broadcastQuestionDismissed(questionId)
    this.emit('question-dismissed', question)

    return { success: true }
  }

  /**
   * Delete a question
   * @param {string} questionId
   */
  deleteQuestion(questionId) {
    if (!this.isHost) {
      logger.error('❓ [Q&A] Only host can delete questions')
      return { success: false, error: 'Only host can delete questions' }
    }

    const deleted = this.questions.delete(questionId)
    this.userUpvotes.delete(questionId)

    if (deleted) {
      logger.debug(`❓ [Q&A] Deleted question ${questionId}`)
      this.emit('question-deleted', { questionId })
    }

    return { success: deleted }
  }

  /**
   * Get question by ID
   * @param {string} questionId
   */
  getQuestion(questionId) {
    return this.questions.get(questionId)
  }

  /**
   * Get all questions
   * @param {Object} filters - { status, sortBy }
   */
  getAllQuestions(filters = {}) {
    let questions = Array.from(this.questions.values())

    // Filter by status
    if (filters.status) {
      questions = questions.filter(q => q.status === filters.status)
    }

    // Filter out dismissed questions for non-hosts
    if (!this.isHost) {
      questions = questions.filter(q => q.status !== QUESTION_STATUS.DISMISSED)
    }

    // Filter out questions needing moderation for non-hosts
    if (!this.isHost && this.mode === QA_MODE.MODERATED) {
      questions = questions.filter(q => !q.needsModeration || q.status !== QUESTION_STATUS.PENDING)
    }

    // Sort
    const sortBy = filters.sortBy || 'upvotes' // default: most upvoted
    switch (sortBy) {
      case 'upvotes':
        questions.sort((a, b) => b.upvotes - a.upvotes)
        break
      case 'recent':
        questions.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        break
      case 'oldest':
        questions.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
        break
    }

    return questions
  }

  /**
   * Get answered questions
   */
  getAnsweredQuestions() {
    return this.getAllQuestions({ status: QUESTION_STATUS.ANSWERED })
  }

  /**
   * Get unanswered questions
   */
  getUnansweredQuestions() {
    return this.getAllQuestions().filter(q => q.status === QUESTION_STATUS.PENDING)
  }

  /**
   * Get statistics
   */
  getStats() {
    const all = Array.from(this.questions.values())
    return {
      total: all.length,
      answered: all.filter(q => q.status === QUESTION_STATUS.ANSWERED).length,
      pending: all.filter(q => q.status === QUESTION_STATUS.PENDING).length,
      dismissed: all.filter(q => q.status === QUESTION_STATUS.DISMISSED).length,
      totalUpvotes: all.reduce((sum, q) => sum + q.upvotes, 0)
    }
  }

  /**
   * Export Q&A session
   * @param {string} format - 'json', 'csv', 'text'
   */
  exportSession(format = 'json') {
    const questions = this.getAllQuestions({ sortBy: 'upvotes' })

    switch (format) {
      case 'json':
        return JSON.stringify({
          mode: this.mode,
          anonymousEnabled: this.anonymousEnabled,
          stats: this.getStats(),
          questions
        }, null, 2)

      case 'csv':
        return this.exportToCSV(questions)

      case 'text':
        return this.exportToText(questions)

      default:
        return null
    }
  }

  /**
   * Export to CSV
   */
  exportToCSV(questions) {
    const lines = [
      'Question,Author,Upvotes,Status,Answer,Answered By,Created At,Answered At'
    ]

    questions.forEach(q => {
      lines.push([
        `"${q.text.replace(/"/g, '""')}"`,
        `"${q.authorName}"`,
        q.upvotes,
        q.status,
        q.answer ? `"${q.answer.replace(/"/g, '""')}"` : '',
        q.answeredBy || '',
        q.createdAt,
        q.answeredAt || ''
      ].join(','))
    })

    return lines.join('\n')
  }

  /**
   * Export to text
   */
  exportToText(questions) {
    const stats = this.getStats()
    let text = `Q&A Session Export\n`
    text += `Mode: ${this.mode}\n`
    text += `Anonymous Enabled: ${this.anonymousEnabled}\n\n`
    text += `Statistics:\n`
    text += `  Total Questions: ${stats.total}\n`
    text += `  Answered: ${stats.answered}\n`
    text += `  Pending: ${stats.pending}\n`
    text += `  Total Upvotes: ${stats.totalUpvotes}\n\n`
    text += `Questions:\n\n`

    questions.forEach((q, index) => {
      text += `${index + 1}. [${q.upvotes} upvotes] ${q.text}\n`
      text += `   Author: ${q.authorName}\n`
      text += `   Status: ${q.status}\n`
      if (q.answer) {
        text += `   Answer: ${q.answer}\n`
        text += `   Answered by: ${q.answeredBy} at ${q.answeredAt}\n`
      }
      text += `   Created: ${q.createdAt}\n\n`
    })

    return text
  }

  /**
   * Broadcast question submitted
   */
  broadcastQuestionSubmitted(question) {
    if (!this.webrtcService) return

    this.webrtcService.activeService?.socket?.send(JSON.stringify({
      type: 'qa:question-submitted',
      data: {
        question: this.sanitizeQuestionForBroadcast(question)
      }
    }))
  }

  /**
   * Broadcast question upvoted
   */
  broadcastQuestionUpvoted(questionId, upvotes) {
    if (!this.webrtcService) return

    this.webrtcService.activeService?.socket?.send(JSON.stringify({
      type: 'qa:question-upvoted',
      data: {
        questionId,
        upvotes
      }
    }))
  }

  /**
   * Broadcast question answered
   */
  broadcastQuestionAnswered(questionId, answer, answeredBy) {
    if (!this.webrtcService) return

    this.webrtcService.activeService?.socket?.send(JSON.stringify({
      type: 'qa:question-answered',
      data: {
        questionId,
        answer,
        answeredBy,
        answeredAt: new Date().toISOString()
      }
    }))
  }

  /**
   * Broadcast question dismissed
   */
  broadcastQuestionDismissed(questionId) {
    if (!this.webrtcService) return

    this.webrtcService.activeService?.socket?.send(JSON.stringify({
      type: 'qa:question-dismissed',
      data: {
        questionId
      }
    }))
  }

  /**
   * Broadcast mode change
   */
  broadcastModeChange(mode) {
    if (!this.webrtcService) return

    this.webrtcService.activeService?.socket?.send(JSON.stringify({
      type: 'qa:mode-changed',
      data: {
        mode
      }
    }))
  }

  /**
   * Sanitize question for broadcast
   */
  sanitizeQuestionForBroadcast(question) {
    return {
      id: question.id,
      text: question.text,
      authorId: question.authorId,
      authorName: question.authorName,
      anonymous: question.anonymous,
      status: question.status,
      upvotes: question.upvotes,
      answer: question.answer,
      answeredBy: question.answeredBy,
      answeredAt: question.answeredAt,
      createdAt: question.createdAt,
      needsModeration: question.needsModeration
    }
  }

  /**
   * Handle question submitted from remote
   */
  handleQuestionSubmitted(data) {
    const question = data.question
    if (!this.questions.has(question.id)) {
      this.questions.set(question.id, question)
      this.userUpvotes.set(question.id, new Set())

      logger.debug(`❓ [Q&A] Received new question ${question.id}`)
      this.emit('question-submitted', question)
    }
  }

  /**
   * Handle question upvoted from remote
   */
  handleQuestionUpvoted(data) {
    const question = this.questions.get(data.questionId)
    if (question) {
      question.upvotes = data.upvotes
      logger.debug(`❓ [Q&A] Question ${data.questionId} upvoted, total: ${data.upvotes}`)
      this.emit('question-upvoted', data)
    }
  }

  /**
   * Handle question answered from remote
   */
  handleQuestionAnswered(data) {
    const question = this.questions.get(data.questionId)
    if (question) {
      question.answer = data.answer
      question.answeredBy = data.answeredBy
      question.answeredAt = data.answeredAt
      question.status = QUESTION_STATUS.ANSWERED

      logger.debug(`❓ [Q&A] Question ${data.questionId} answered`)
      this.emit('question-answered', question)
    }
  }

  /**
   * Handle question dismissed from remote
   */
  handleQuestionDismissed(data) {
    const question = this.questions.get(data.questionId)
    if (question) {
      question.status = QUESTION_STATUS.DISMISSED
      logger.debug(`❓ [Q&A] Question ${data.questionId} dismissed`)
      this.emit('question-dismissed', question)
    }
  }

  /**
   * Handle mode changed from remote
   */
  handleModeChanged(data) {
    this.mode = data.mode
    logger.debug(`❓ [Q&A] Mode changed to ${data.mode}`)
    this.emit('mode-changed', data.mode)
  }

  /**
   * Handle sync (receive full state from host)
   */
  handleSync(data) {
    if (data.questions) {
      this.questions.clear()
      this.userUpvotes.clear()

      data.questions.forEach(q => {
        this.questions.set(q.id, q)
        this.userUpvotes.set(q.id, new Set())
      })

      logger.debug(`❓ [Q&A] Synced ${data.questions.length} questions`)
      this.emit('synced', data.questions)
    }
  }

  /**
   * Request sync from host (for late joiners)
   */
  requestSync() {
    if (!this.webrtcService) return

    this.webrtcService.activeService?.socket?.send(JSON.stringify({
      type: 'qa:request-sync',
      data: {}
    }))

    logger.debug('❓ [Q&A] Requested sync from host')
  }

  /**
   * Send sync to participants (host only)
   */
  sendSync() {
    if (!this.isHost || !this.webrtcService) return

    const questions = Array.from(this.questions.values())

    this.webrtcService.activeService?.socket?.send(JSON.stringify({
      type: 'qa:sync',
      data: {
        mode: this.mode,
        anonymousEnabled: this.anonymousEnabled,
        questions: questions.map(q => this.sanitizeQuestionForBroadcast(q))
      }
    }))

    logger.debug(`❓ [Q&A] Sent sync with ${questions.length} questions`)
  }

  /**
   * Generate unique question ID
   */
  generateQuestionId() {
    return `qa_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Event emitter
   */
  on(event, handler) {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, [])
    }
    this.eventHandlers.get(event).push(handler)
  }

  emit(event, ...args) {
    const handlers = this.eventHandlers.get(event)
    if (handlers) {
      handlers.forEach(handler => handler(...args))
    }
  }

  /**
   * Cleanup
   */
  destroy() {
    this.questions.clear()
    this.userUpvotes.clear()
    this.eventHandlers.clear()
    logger.debug('❓ [Q&A] Service destroyed')
  }
}
