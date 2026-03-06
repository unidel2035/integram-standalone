import { logger } from '@/utils/logger'

/**
 * Poll Service for managing polls during video conferences
 * Handles poll creation, voting, results tracking, and real-time synchronization via WebSocket
 */

export const POLL_STATUS = {
  DRAFT: 'draft',
  ACTIVE: 'active',
  CLOSED: 'closed'
}

export const POLL_TYPE = {
  SINGLE_CHOICE: 'single',
  MULTIPLE_CHOICE: 'multiple'
}

export default class PollService {
  constructor(webrtcService) {
    this.webrtcService = webrtcService
    this.polls = new Map() // pollId -> poll object
    this.userVotes = new Map() // pollId -> userId -> vote(s)
    this.eventHandlers = new Map()

    logger.debug('📊 [Poll] Service initialized')
    this.setupEventListeners()
  }

  /**
   * Setup event listeners for WebSocket messages
   */
  setupEventListeners() {
    if (!this.webrtcService) {
      logger.warn('📊 [Poll] No WebRTC service provided, real-time sync disabled')
      return
    }

    // Listen for poll-related events
    this.webrtcService.on('poll:created', (data) => this.handlePollCreated(data))
    this.webrtcService.on('poll:started', (data) => this.handlePollStarted(data))
    this.webrtcService.on('poll:ended', (data) => this.handlePollEnded(data))
    this.webrtcService.on('poll:vote', (data) => this.handleVoteReceived(data))
    this.webrtcService.on('poll:results', (data) => this.handleResultsReceived(data))
  }

  /**
   * Create a new poll
   * @param {Object} pollData - Poll configuration
   * @returns {string} pollId
   */
  createPoll(pollData) {
    const pollId = this.generatePollId()

    const poll = {
      id: pollId,
      question: pollData.question,
      options: pollData.options.map((text, index) => ({
        id: `opt_${index}`,
        text,
        votes: 0,
        voters: []
      })),
      type: pollData.type || POLL_TYPE.SINGLE_CHOICE,
      status: POLL_STATUS.DRAFT,
      anonymous: pollData.anonymous !== false, // default true
      showResults: pollData.showResults !== false, // default true
      allowMultiple: pollData.type === POLL_TYPE.MULTIPLE_CHOICE,
      maxChoices: pollData.maxChoices || (pollData.type === POLL_TYPE.MULTIPLE_CHOICE ? pollData.options.length : 1),
      createdBy: pollData.createdBy || 'host',
      createdAt: new Date().toISOString(),
      startedAt: null,
      endedAt: null,
      totalVotes: 0,
      uniqueVoters: 0
    }

    this.polls.set(pollId, poll)
    this.userVotes.set(pollId, new Map())

    logger.debug(`📊 [Poll] Created poll ${pollId}: ${poll.question}`)

    // Broadcast poll creation
    this.broadcastPollCreated(poll)
    this.emit('poll-created', poll)

    return pollId
  }

  /**
   * Start a poll (make it active for voting)
   * @param {string} pollId
   */
  startPoll(pollId) {
    const poll = this.polls.get(pollId)
    if (!poll) {
      logger.error(`📊 [Poll] Cannot start: poll ${pollId} not found`)
      return false
    }

    if (poll.status === POLL_STATUS.ACTIVE) {
      logger.warn(`📊 [Poll] Poll ${pollId} is already active`)
      return false
    }

    poll.status = POLL_STATUS.ACTIVE
    poll.startedAt = new Date().toISOString()

    logger.debug(`📊 [Poll] Started poll ${pollId}`)

    // Broadcast poll start
    this.broadcastPollStarted(poll)
    this.emit('poll-started', poll)

    return true
  }

  /**
   * End a poll (close voting)
   * @param {string} pollId
   */
  endPoll(pollId) {
    const poll = this.polls.get(pollId)
    if (!poll) {
      logger.error(`📊 [Poll] Cannot end: poll ${pollId} not found`)
      return false
    }

    if (poll.status === POLL_STATUS.CLOSED) {
      logger.warn(`📊 [Poll] Poll ${pollId} is already closed`)
      return false
    }

    poll.status = POLL_STATUS.CLOSED
    poll.endedAt = new Date().toISOString()

    logger.debug(`📊 [Poll] Ended poll ${pollId}`)

    // Broadcast poll end
    this.broadcastPollEnded(poll)
    this.emit('poll-ended', poll)

    return true
  }

  /**
   * Submit a vote for a poll
   * @param {string} pollId
   * @param {string} userId
   * @param {string|string[]} optionIds - Single option ID or array for multiple choice
   */
  submitVote(pollId, userId, optionIds) {
    const poll = this.polls.get(pollId)
    if (!poll) {
      logger.error(`📊 [Poll] Cannot vote: poll ${pollId} not found`)
      return { success: false, error: 'Poll not found' }
    }

    if (poll.status !== POLL_STATUS.ACTIVE) {
      logger.warn(`📊 [Poll] Cannot vote: poll ${pollId} is not active`)
      return { success: false, error: 'Poll is not active' }
    }

    // Normalize optionIds to array
    const selectedOptions = Array.isArray(optionIds) ? optionIds : [optionIds]

    // Validate vote
    if (poll.type === POLL_TYPE.SINGLE_CHOICE && selectedOptions.length > 1) {
      return { success: false, error: 'Single choice poll allows only one option' }
    }

    if (selectedOptions.length > poll.maxChoices) {
      return { success: false, error: `Maximum ${poll.maxChoices} choices allowed` }
    }

    // Check if all options exist
    const validOptions = poll.options.map(o => o.id)
    const invalidOptions = selectedOptions.filter(id => !validOptions.includes(id))
    if (invalidOptions.length > 0) {
      return { success: false, error: 'Invalid option IDs' }
    }

    // Get user's previous vote
    const userVotesMap = this.userVotes.get(pollId)
    const previousVote = userVotesMap.get(userId)

    // Remove previous vote counts
    if (previousVote) {
      const prevOptions = Array.isArray(previousVote) ? previousVote : [previousVote]
      prevOptions.forEach(optId => {
        const option = poll.options.find(o => o.id === optId)
        if (option) {
          option.votes--
          option.voters = option.voters.filter(v => v !== userId)
        }
      })
      poll.totalVotes -= prevOptions.length
    } else {
      // New voter
      poll.uniqueVoters++
    }

    // Add new vote
    selectedOptions.forEach(optId => {
      const option = poll.options.find(o => o.id === optId)
      if (option) {
        option.votes++
        if (!poll.anonymous) {
          option.voters.push(userId)
        }
      }
    })

    poll.totalVotes += selectedOptions.length

    // Store vote
    userVotesMap.set(userId, poll.type === POLL_TYPE.SINGLE_CHOICE ? selectedOptions[0] : selectedOptions)

    logger.debug(`📊 [Poll] User ${userId} voted in poll ${pollId}`)

    // Broadcast vote (anonymous or with user info)
    this.broadcastVote(pollId, userId, selectedOptions, poll.anonymous)
    this.emit('vote-submitted', { pollId, userId, options: selectedOptions })

    // Broadcast updated results if allowed
    if (poll.showResults) {
      this.broadcastResults(poll)
    }

    return { success: true, vote: selectedOptions }
  }

  /**
   * Get poll by ID
   * @param {string} pollId
   */
  getPoll(pollId) {
    return this.polls.get(pollId)
  }

  /**
   * Get all polls
   */
  getAllPolls() {
    return Array.from(this.polls.values())
  }

  /**
   * Get active polls
   */
  getActivePolls() {
    return this.getAllPolls().filter(p => p.status === POLL_STATUS.ACTIVE)
  }

  /**
   * Get poll results
   * @param {string} pollId
   */
  getPollResults(pollId) {
    const poll = this.polls.get(pollId)
    if (!poll) {
      return null
    }

    return {
      pollId: poll.id,
      question: poll.question,
      status: poll.status,
      totalVotes: poll.totalVotes,
      uniqueVoters: poll.uniqueVoters,
      options: poll.options.map(opt => ({
        id: opt.id,
        text: opt.text,
        votes: opt.votes,
        percentage: poll.totalVotes > 0 ? (opt.votes / poll.totalVotes * 100).toFixed(1) : 0,
        voters: poll.anonymous ? null : opt.voters
      })),
      createdAt: poll.createdAt,
      startedAt: poll.startedAt,
      endedAt: poll.endedAt
    }
  }

  /**
   * Export poll results to different formats
   * @param {string} pollId
   * @param {string} format - 'json', 'csv', 'text'
   */
  exportResults(pollId, format = 'json') {
    const results = this.getPollResults(pollId)
    if (!results) {
      return null
    }

    switch (format) {
      case 'json':
        return JSON.stringify(results, null, 2)

      case 'csv':
        return this.exportToCSV(results)

      case 'text':
        return this.exportToText(results)

      default:
        return null
    }
  }

  /**
   * Export results to CSV format
   */
  exportToCSV(results) {
    const lines = [
      'Question,Option,Votes,Percentage',
      ...results.options.map(opt =>
        `"${results.question}","${opt.text}",${opt.votes},${opt.percentage}%`
      )
    ]
    return lines.join('\n')
  }

  /**
   * Export results to plain text format
   */
  exportToText(results) {
    let text = `Poll Results\n`
    text += `Question: ${results.question}\n`
    text += `Status: ${results.status}\n`
    text += `Total Votes: ${results.totalVotes}\n`
    text += `Unique Voters: ${results.uniqueVoters}\n\n`
    text += `Results:\n`
    results.options.forEach(opt => {
      text += `  ${opt.text}: ${opt.votes} votes (${opt.percentage}%)\n`
    })
    return text
  }

  /**
   * Delete a poll
   * @param {string} pollId
   */
  deletePoll(pollId) {
    const deleted = this.polls.delete(pollId)
    this.userVotes.delete(pollId)

    if (deleted) {
      logger.debug(`📊 [Poll] Deleted poll ${pollId}`)
      this.emit('poll-deleted', { pollId })
    }

    return deleted
  }

  /**
   * Broadcast poll creation to all participants
   */
  broadcastPollCreated(poll) {
    if (!this.webrtcService) return

    this.webrtcService.activeService?.socket?.send(JSON.stringify({
      type: 'poll:created',
      data: {
        poll: this.sanitizePollForBroadcast(poll)
      }
    }))
  }

  /**
   * Broadcast poll start
   */
  broadcastPollStarted(poll) {
    if (!this.webrtcService) return

    this.webrtcService.activeService?.socket?.send(JSON.stringify({
      type: 'poll:started',
      data: {
        pollId: poll.id,
        poll: this.sanitizePollForBroadcast(poll)
      }
    }))
  }

  /**
   * Broadcast poll end
   */
  broadcastPollEnded(poll) {
    if (!this.webrtcService) return

    this.webrtcService.activeService?.socket?.send(JSON.stringify({
      type: 'poll:ended',
      data: {
        pollId: poll.id,
        results: this.getPollResults(poll.id)
      }
    }))
  }

  /**
   * Broadcast vote
   */
  broadcastVote(pollId, userId, optionIds, anonymous) {
    if (!this.webrtcService) return

    this.webrtcService.activeService?.socket?.send(JSON.stringify({
      type: 'poll:vote',
      data: {
        pollId,
        userId: anonymous ? null : userId,
        optionIds
      }
    }))
  }

  /**
   * Broadcast results
   */
  broadcastResults(poll) {
    if (!this.webrtcService) return

    this.webrtcService.activeService?.socket?.send(JSON.stringify({
      type: 'poll:results',
      data: {
        pollId: poll.id,
        results: this.getPollResults(poll.id)
      }
    }))
  }

  /**
   * Sanitize poll object for broadcasting (remove internal data)
   */
  sanitizePollForBroadcast(poll) {
    return {
      id: poll.id,
      question: poll.question,
      options: poll.options.map(o => ({
        id: o.id,
        text: o.text,
        votes: poll.showResults ? o.votes : 0
      })),
      type: poll.type,
      status: poll.status,
      anonymous: poll.anonymous,
      showResults: poll.showResults,
      allowMultiple: poll.allowMultiple,
      maxChoices: poll.maxChoices,
      createdAt: poll.createdAt,
      startedAt: poll.startedAt
    }
  }

  /**
   * Handle poll created event from other participants
   */
  handlePollCreated(data) {
    const poll = data.poll
    if (!this.polls.has(poll.id)) {
      // Reconstruct full poll object
      const fullPoll = {
        ...poll,
        options: poll.options.map(o => ({
          ...o,
          voters: []
        })),
        totalVotes: 0,
        uniqueVoters: 0,
        createdBy: 'remote',
        endedAt: null
      }

      this.polls.set(poll.id, fullPoll)
      this.userVotes.set(poll.id, new Map())

      logger.debug(`📊 [Poll] Received new poll ${poll.id} from remote`)
      this.emit('poll-created', fullPoll)
    }
  }

  /**
   * Handle poll started event
   */
  handlePollStarted(data) {
    const poll = this.polls.get(data.pollId)
    if (poll) {
      poll.status = POLL_STATUS.ACTIVE
      poll.startedAt = data.poll.startedAt
      logger.debug(`📊 [Poll] Poll ${data.pollId} started`)
      this.emit('poll-started', poll)
    }
  }

  /**
   * Handle poll ended event
   */
  handlePollEnded(data) {
    const poll = this.polls.get(data.pollId)
    if (poll) {
      poll.status = POLL_STATUS.CLOSED
      poll.endedAt = new Date().toISOString()
      logger.debug(`📊 [Poll] Poll ${data.pollId} ended`)
      this.emit('poll-ended', poll)

      // Update with final results
      if (data.results) {
        this.emit('poll-results', data.results)
      }
    }
  }

  /**
   * Handle vote received from other participants
   */
  handleVoteReceived(data) {
    const poll = this.polls.get(data.pollId)
    if (!poll) return

    // Update local vote counts
    const optionIds = Array.isArray(data.optionIds) ? data.optionIds : [data.optionIds]
    optionIds.forEach(optId => {
      const option = poll.options.find(o => o.id === optId)
      if (option && poll.showResults) {
        // Just emit event, actual counting done by host
        logger.debug(`📊 [Poll] Vote received for poll ${data.pollId}`)
      }
    })

    this.emit('vote-received', data)
  }

  /**
   * Handle results received
   */
  handleResultsReceived(data) {
    const poll = this.polls.get(data.pollId)
    if (!poll) return

    // Update poll with latest results
    if (data.results && data.results.options) {
      data.results.options.forEach(resultOpt => {
        const option = poll.options.find(o => o.id === resultOpt.id)
        if (option) {
          option.votes = resultOpt.votes
        }
      })
      poll.totalVotes = data.results.totalVotes
      poll.uniqueVoters = data.results.uniqueVoters
    }

    logger.debug(`📊 [Poll] Results received for poll ${data.pollId}`)
    this.emit('poll-results', data.results)
  }

  /**
   * Generate unique poll ID
   */
  generatePollId() {
    return `poll_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
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
    this.polls.clear()
    this.userVotes.clear()
    this.eventHandlers.clear()
    logger.debug('📊 [Poll] Service destroyed')
  }
}
