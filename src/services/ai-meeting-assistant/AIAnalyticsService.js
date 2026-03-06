/**
 * AI Analytics Service for Video Conference
 *
 * Provides advanced meeting analytics:
 * - Participation metrics (speaking time, contributions)
 * - Sentiment analysis per speaker
 * - Topic detection and tracking
 * - Engagement scoring
 * - Key moments identification
 * - Meeting effectiveness metrics
 */

import { getDefaultToken } from '../aiTokenService'
import { logger } from '@/utils/logger'

export default class AIAnalyticsService {
  constructor() {
    this.aiToken = null
    this.aiModel = null
    this.API_BASE_URL = '/api'

    // Analytics data
    this.participationMetrics = new Map() // speaker -> metrics
    this.sentimentTimeline = []
    this.detectedTopics = []
    this.keyMoments = []
    this.engagementScores = []

    // Real-time processing
    this.isProcessing = false
    this.processingQueue = []
  }

  /**
   * Initialize with AI token
   * @param {string} userId - User ID for AI token
   */
  async initialize(userId) {
    try {
      const { token, defaultModel } = await getDefaultToken(userId)
      this.aiToken = token
      this.aiModel = defaultModel
      logger.debug('[AIAnalyticsService] Initialized with AI token')
      return true
    } catch (error) {
      logger.warn('[AIAnalyticsService] Failed to get AI token:', error)
      return false
    }
  }

  /**
   * Analyze meeting transcript in real-time
   * @param {Object} transcriptEntry - Transcript entry {timestamp, speaker, text}
   */
  async analyzeTranscriptEntry(transcriptEntry) {
    // Update participation metrics
    this.updateParticipationMetrics(transcriptEntry)

    // Queue for AI analysis
    this.processingQueue.push(transcriptEntry)

    // Process queue (debounced to avoid excessive API calls)
    if (!this.isProcessing) {
      this.processQueue()
    }
  }

  /**
   * Update participation metrics
   * @private
   */
  updateParticipationMetrics(entry) {
    if (!this.participationMetrics.has(entry.speaker)) {
      this.participationMetrics.set(entry.speaker, {
        speaker: entry.speaker,
        totalWords: 0,
        totalDuration: 0,
        contributions: 0,
        firstSpoke: entry.timestamp,
        lastSpoke: entry.timestamp,
        topics: new Set(),
      })
    }

    const metrics = this.participationMetrics.get(entry.speaker)
    metrics.totalWords += entry.text.split(/\s+/).length
    metrics.contributions += 1
    metrics.lastSpoke = entry.timestamp

    // Estimate speaking duration (rough: 150 words per minute)
    const wordsInEntry = entry.text.split(/\s+/).length
    const estimatedDuration = (wordsInEntry / 150) * 60 * 1000 // ms
    metrics.totalDuration += estimatedDuration
  }

  /**
   * Process queued entries with AI
   * @private
   */
  async processQueue() {
    if (this.processingQueue.length === 0 || !this.aiToken) {
      this.isProcessing = false
      return
    }

    this.isProcessing = true

    // Process in batches of 5 entries every 10 seconds
    await new Promise(resolve => setTimeout(resolve, 10000))

    const batch = this.processingQueue.splice(0, 5)

    try {
      // Analyze sentiment for batch
      await this.analyzeSentimentBatch(batch)

      // Detect topics
      await this.detectTopicsBatch(batch)

      // Continue processing if queue not empty
      if (this.processingQueue.length > 0) {
        this.processQueue()
      } else {
        this.isProcessing = false
      }
    } catch (error) {
      logger.error('[AIAnalyticsService] Error processing batch:', error)
      this.isProcessing = false
    }
  }

  /**
   * Analyze sentiment for batch of entries
   * @private
   */
  async analyzeSentimentBatch(batch) {
    if (!this.aiToken) return

    const text = batch.map(e => `${e.speaker}: ${e.text}`).join('\n')

    const response = await fetch(`${this.API_BASE_URL}/ai-tokens/chat`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.aiToken.id}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        modelId: this.aiModel.id,
        prompt: `Analyze the sentiment of each speaker in this meeting excerpt. For each speaker, determine:
1. Overall sentiment (positive, neutral, negative, mixed)
2. Emotional tone (enthusiastic, concerned, frustrated, calm, etc.)
3. Confidence level (1-10)

Meeting excerpt:
${text}

Return JSON array:
[
  {
    "speaker": "name",
    "sentiment": "positive/neutral/negative/mixed",
    "emotion": "description",
    "confidence": number,
    "reasoning": "brief explanation"
  }
]`,
        application: 'VideoConferenceAI',
        operation: 'sentiment_analysis',
        temperature: 0.2,
        maxTokens: 1024
      })
    })

    if (response.ok) {
      const result = await response.json()
      const sentiments = this.parseJSONResponse(result.completion || result.message)

      if (Array.isArray(sentiments)) {
        sentiments.forEach(s => {
          this.sentimentTimeline.push({
            timestamp: Date.now(),
            speaker: s.speaker,
            sentiment: s.sentiment,
            emotion: s.emotion,
            confidence: s.confidence,
            reasoning: s.reasoning
          })
        })
      }
    }
  }

  /**
   * Detect topics in batch of entries
   * @private
   */
  async detectTopicsBatch(batch) {
    if (!this.aiToken) return

    const text = batch.map(e => `${e.speaker}: ${e.text}`).join('\n')

    const response = await fetch(`${this.API_BASE_URL}/ai-tokens/chat`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.aiToken.id}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        modelId: this.aiModel.id,
        prompt: `Identify the main topics being discussed in this meeting excerpt. Extract:
1. Topic keywords/phrases
2. Importance level (high, medium, low)
3. Brief description

Meeting excerpt:
${text}

Return JSON array:
[
  {
    "topic": "topic name",
    "keywords": ["keyword1", "keyword2"],
    "importance": "high/medium/low",
    "description": "brief description"
  }
]`,
        application: 'VideoConferenceAI',
        operation: 'topic_detection',
        temperature: 0.3,
        maxTokens: 1024
      })
    })

    if (response.ok) {
      const result = await response.json()
      const topics = this.parseJSONResponse(result.completion || result.message)

      if (Array.isArray(topics)) {
        topics.forEach(t => {
          // Check if topic already exists
          const existing = this.detectedTopics.find(dt =>
            dt.topic.toLowerCase() === t.topic.toLowerCase()
          )

          if (existing) {
            existing.mentions += 1
            existing.lastMentioned = Date.now()
          } else {
            this.detectedTopics.push({
              ...t,
              firstMentioned: Date.now(),
              lastMentioned: Date.now(),
              mentions: 1
            })
          }

          // Update speaker metrics
          batch.forEach(entry => {
            const metrics = this.participationMetrics.get(entry.speaker)
            if (metrics && entry.text.toLowerCase().includes(t.topic.toLowerCase())) {
              metrics.topics.add(t.topic)
            }
          })
        })
      }
    }
  }

  /**
   * Generate comprehensive meeting analytics
   * @param {Array} fullTranscript - Complete meeting transcript
   * @returns {Promise<Object>} Analytics report
   */
  async generateAnalytics(fullTranscript) {
    if (!this.aiToken) {
      return this.generateBasicAnalytics(fullTranscript)
    }

    // Calculate participation metrics
    const participationReport = this.calculateParticipationReport()

    // Get sentiment summary
    const sentimentSummary = this.getSentimentSummary()

    // Get topic summary
    const topicSummary = this.getTopicSummary()

    // Identify key moments with AI
    const keyMoments = await this.identifyKeyMoments(fullTranscript)

    // Calculate engagement score
    const engagementScore = this.calculateEngagementScore(fullTranscript)

    return {
      participation: participationReport,
      sentiment: sentimentSummary,
      topics: topicSummary,
      keyMoments,
      engagement: engagementScore,
      summary: await this.generateExecutiveSummary(fullTranscript, {
        participation: participationReport,
        sentiment: sentimentSummary,
        topics: topicSummary,
        keyMoments
      })
    }
  }

  /**
   * Generate basic analytics without AI
   * @private
   */
  generateBasicAnalytics(transcript) {
    const participationReport = this.calculateParticipationReport()

    return {
      participation: participationReport,
      sentiment: { available: false, message: 'AI not available' },
      topics: { available: false, message: 'AI not available' },
      keyMoments: [],
      engagement: {
        score: 'N/A',
        factors: ['AI analytics unavailable']
      }
    }
  }

  /**
   * Calculate participation report
   * @private
   */
  calculateParticipationReport() {
    const participants = Array.from(this.participationMetrics.values())
    const totalWords = participants.reduce((sum, p) => sum + p.totalWords, 0)
    const totalDuration = participants.reduce((sum, p) => sum + p.totalDuration, 0)

    return {
      participants: participants.map(p => ({
        speaker: p.speaker,
        contributions: p.contributions,
        totalWords: p.totalWords,
        wordsPercentage: totalWords > 0 ? (p.totalWords / totalWords * 100).toFixed(1) : 0,
        durationMinutes: (p.totalDuration / 60000).toFixed(1),
        durationPercentage: totalDuration > 0 ? (p.totalDuration / totalDuration * 100).toFixed(1) : 0,
        topics: Array.from(p.topics),
        activeTimeRange: {
          first: new Date(p.firstSpoke).toLocaleTimeString(),
          last: new Date(p.lastSpoke).toLocaleTimeString()
        }
      })).sort((a, b) => b.totalWords - a.totalWords),
      summary: {
        totalParticipants: participants.length,
        totalContributions: participants.reduce((sum, p) => sum + p.contributions, 0),
        totalWords,
        averageWordsPerParticipant: participants.length > 0 ? (totalWords / participants.length).toFixed(0) : 0
      }
    }
  }

  /**
   * Get sentiment summary
   * @private
   */
  getSentimentSummary() {
    if (this.sentimentTimeline.length === 0) {
      return { available: false, message: 'Not enough data' }
    }

    const sentimentCounts = {
      positive: 0,
      neutral: 0,
      negative: 0,
      mixed: 0
    }

    const speakerSentiments = new Map()

    this.sentimentTimeline.forEach(s => {
      sentimentCounts[s.sentiment] = (sentimentCounts[s.sentiment] || 0) + 1

      if (!speakerSentiments.has(s.speaker)) {
        speakerSentiments.set(s.speaker, { positive: 0, neutral: 0, negative: 0, mixed: 0, emotions: [] })
      }
      speakerSentiments.get(s.speaker)[s.sentiment]++
      speakerSentiments.get(s.speaker).emotions.push(s.emotion)
    })

    return {
      overall: {
        dominant: Object.entries(sentimentCounts).sort((a, b) => b[1] - a[1])[0][0],
        distribution: sentimentCounts
      },
      bySpeaker: Array.from(speakerSentiments.entries()).map(([speaker, data]) => ({
        speaker,
        dominant: Object.entries(data).filter(([k]) => k !== 'emotions').sort((a, b) => b[1] - a[1])[0][0],
        distribution: { positive: data.positive, neutral: data.neutral, negative: data.negative, mixed: data.mixed },
        commonEmotions: [...new Set(data.emotions)].slice(0, 3)
      })),
      timeline: this.sentimentTimeline
    }
  }

  /**
   * Get topic summary
   * @private
   */
  getTopicSummary() {
    if (this.detectedTopics.length === 0) {
      return { available: false, message: 'Not enough data' }
    }

    return {
      mainTopics: this.detectedTopics
        .sort((a, b) => b.mentions - a.mentions)
        .slice(0, 10),
      totalTopics: this.detectedTopics.length,
      topicsByImportance: {
        high: this.detectedTopics.filter(t => t.importance === 'high'),
        medium: this.detectedTopics.filter(t => t.importance === 'medium'),
        low: this.detectedTopics.filter(t => t.importance === 'low')
      }
    }
  }

  /**
   * Identify key moments in the meeting
   * @private
   */
  async identifyKeyMoments(transcript) {
    if (!this.aiToken || transcript.length === 0) return []

    const fullText = transcript.map(e =>
      `[${new Date(e.timestamp).toLocaleTimeString()}] ${e.speaker}: ${e.text}`
    ).join('\n')

    const response = await fetch(`${this.API_BASE_URL}/ai-tokens/chat`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.aiToken.id}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        modelId: this.aiModel.id,
        prompt: `Identify the key moments in this meeting transcript. Key moments include:
- Important decisions made
- Critical agreements or disagreements
- Significant questions or concerns raised
- Major insights or realizations
- Action items assigned

For each key moment, provide:
- Time (from timestamp)
- Type (decision, agreement, question, insight, action)
- Description
- Importance (high, medium, low)
- Participants involved

Transcript:
${fullText}

Return JSON array with max 10 most important moments.`,
        application: 'VideoConferenceAI',
        operation: 'key_moments',
        temperature: 0.3,
        maxTokens: 2048
      })
    })

    if (response.ok) {
      const result = await response.json()
      return this.parseJSONResponse(result.completion || result.message) || []
    }

    return []
  }

  /**
   * Calculate engagement score
   * @private
   */
  calculateEngagementScore(transcript) {
    const factors = []
    let score = 0

    // Factor 1: Participation balance (0-25 points)
    const participants = Array.from(this.participationMetrics.values())
    if (participants.length > 0) {
      const totalWords = participants.reduce((sum, p) => sum + p.totalWords, 0)
      const stdDev = this.calculateStdDev(participants.map(p => p.totalWords))
      const mean = totalWords / participants.length
      const balance = mean > 0 ? 1 - Math.min(stdDev / mean, 1) : 0
      const participationScore = balance * 25
      score += participationScore
      factors.push({
        name: 'Participation Balance',
        score: participationScore.toFixed(1),
        description: balance > 0.7 ? 'Well-balanced' : balance > 0.4 ? 'Moderately balanced' : 'Unbalanced'
      })
    }

    // Factor 2: Topic diversity (0-25 points)
    const topicScore = Math.min(this.detectedTopics.length * 2.5, 25)
    score += topicScore
    factors.push({
      name: 'Topic Diversity',
      score: topicScore.toFixed(1),
      description: `${this.detectedTopics.length} unique topics discussed`
    })

    // Factor 3: Interaction frequency (0-25 points)
    const avgContributions = participants.length > 0
      ? participants.reduce((sum, p) => sum + p.contributions, 0) / participants.length
      : 0
    const interactionScore = Math.min(avgContributions * 2, 25)
    score += interactionScore
    factors.push({
      name: 'Interaction Frequency',
      score: interactionScore.toFixed(1),
      description: `${avgContributions.toFixed(1)} avg contributions per participant`
    })

    // Factor 4: Sentiment positivity (0-25 points)
    const sentimentSummary = this.getSentimentSummary()
    let sentimentScore = 0
    if (sentimentSummary.overall) {
      const { positive = 0, neutral = 0, negative = 0, mixed = 0 } = sentimentSummary.overall.distribution
      const total = positive + neutral + negative + mixed
      if (total > 0) {
        sentimentScore = ((positive * 1.0 + neutral * 0.5 + mixed * 0.3) / total) * 25
      }
    }
    score += sentimentScore
    factors.push({
      name: 'Sentiment Positivity',
      score: sentimentScore.toFixed(1),
      description: sentimentSummary.overall ? sentimentSummary.overall.dominant : 'Unknown'
    })

    return {
      score: score.toFixed(1),
      maxScore: 100,
      rating: score >= 75 ? 'Excellent' : score >= 50 ? 'Good' : score >= 25 ? 'Fair' : 'Poor',
      factors
    }
  }

  /**
   * Generate executive summary
   * @private
   */
  async generateExecutiveSummary(transcript, analytics) {
    if (!this.aiToken) {
      return 'AI executive summary not available without backend connection'
    }

    const fullText = transcript.slice(-50).map(e => `${e.speaker}: ${e.text}`).join('\n')

    const response = await fetch(`${this.API_BASE_URL}/ai-tokens/chat`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.aiToken.id}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        modelId: this.aiModel.id,
        prompt: `Generate a brief executive summary of this meeting based on the transcript and analytics.

Analytics:
- Participants: ${analytics.participation.summary.totalParticipants}
- Total contributions: ${analytics.participation.summary.totalContributions}
- Main topics: ${analytics.topics.mainTopics?.slice(0, 5).map(t => t.topic).join(', ') || 'N/A'}
- Overall sentiment: ${analytics.sentiment.overall?.dominant || 'N/A'}
- Key moments: ${analytics.keyMoments?.length || 0}

Recent transcript:
${fullText}

Create a concise 2-3 sentence executive summary in Russian.`,
        application: 'VideoConferenceAI',
        operation: 'executive_summary',
        temperature: 0.4,
        maxTokens: 512
      })
    })

    if (response.ok) {
      const result = await response.json()
      return result.completion || result.message || 'Summary generation failed'
    }

    return 'Failed to generate executive summary'
  }

  /**
   * Parse JSON response from AI
   * @private
   */
  parseJSONResponse(text) {
    try {
      // Try to extract JSON from response
      const jsonMatch = text.match(/\[[\s\S]*\]/) || text.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0])
      }
      return null
    } catch (error) {
      logger.warn('[AIAnalyticsService] Failed to parse JSON:', error)
      return null
    }
  }

  /**
   * Calculate standard deviation
   * @private
   */
  calculateStdDev(values) {
    if (values.length === 0) return 0
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length
    const squaredDiffs = values.map(v => Math.pow(v - mean, 2))
    const variance = squaredDiffs.reduce((sum, v) => sum + v, 0) / values.length
    return Math.sqrt(variance)
  }

  /**
   * Clear all analytics data
   */
  clear() {
    this.participationMetrics.clear()
    this.sentimentTimeline = []
    this.detectedTopics = []
    this.keyMoments = []
    this.engagementScores = []
    this.processingQueue = []
  }

  /**
   * Get current analytics snapshot
   */
  getSnapshot() {
    return {
      participation: this.calculateParticipationReport(),
      sentiment: this.getSentimentSummary(),
      topics: this.getTopicSummary(),
      detectedTopicsCount: this.detectedTopics.length,
      sentimentEntriesCount: this.sentimentTimeline.length
    }
  }
}
