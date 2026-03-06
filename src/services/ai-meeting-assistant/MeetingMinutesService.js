/**
 * Meeting Minutes Service for Video Conference
 *
 * Automatically generates professional meeting minutes:
 * - Structured minutes with sections
 * - Attendee tracking
 * - Key discussions summary
 * - Decisions record
 * - Action items integration
 * - Multiple export formats
 */

import { getDefaultToken } from '../aiTokenService'
import { logger } from '@/utils/logger'

export default class MeetingMinutesService {
  constructor() {
    this.aiToken = null
    this.aiModel = null
    this.API_BASE_URL = '/api'

    // Meeting metadata
    this.meetingInfo = {
      title: '',
      startTime: null,
      endTime: null,
      participants: [],
      organizer: null
    }

    // Minutes sections
    this.sections = {
      attendees: [],
      agenda: [],
      discussions: [],
      decisions: [],
      actionItems: [],
      nextSteps: []
    }
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
      logger.debug('[MeetingMinutesService] Initialized with AI token')
      return true
    } catch (error) {
      logger.warn('[MeetingMinutesService] Failed to get AI token:', error)
      return false
    }
  }

  /**
   * Set meeting metadata
   * @param {Object} info - Meeting information
   */
  setMeetingInfo(info) {
    this.meetingInfo = {
      ...this.meetingInfo,
      ...info
    }
  }

  /**
   * Start meeting recording
   * @param {string} title - Meeting title
   * @param {string} organizer - Meeting organizer
   */
  startMeeting(title, organizer) {
    this.meetingInfo.title = title
    this.meetingInfo.organizer = organizer
    this.meetingInfo.startTime = Date.now()
  }

  /**
   * End meeting recording
   */
  endMeeting() {
    this.meetingInfo.endTime = Date.now()
  }

  /**
   * Add participant
   * @param {string} name - Participant name
   */
  addParticipant(name) {
    if (!this.sections.attendees.find(a => a.name === name)) {
      this.sections.attendees.push({
        name,
        joinedAt: Date.now()
      })
    }
  }

  /**
   * Generate complete meeting minutes
   * @param {Array} transcript - Full meeting transcript
   * @param {Object} analytics - Meeting analytics from AIAnalyticsService
   * @param {Array} actionItems - Action items from ActionItemsService
   * @returns {Promise<Object>} Generated minutes
   */
  async generateMinutes(transcript, analytics = null, actionItems = []) {
    if (!this.aiToken) {
      return this.generateBasicMinutes(transcript, analytics, actionItems)
    }

    logger.debug('[MeetingMinutesService] Generating AI-powered meeting minutes')

    // Generate each section
    const [discussions, decisions, nextSteps] = await Promise.all([
      this.generateDiscussionsSummary(transcript),
      this.extractDecisions(transcript),
      this.generateNextSteps(transcript, actionItems)
    ])

    this.sections.discussions = discussions
    this.sections.decisions = decisions
    this.sections.actionItems = actionItems
    this.sections.nextSteps = nextSteps

    // Generate agenda if not set
    if (this.sections.agenda.length === 0 && analytics?.topics) {
      this.sections.agenda = this.generateAgendaFromTopics(analytics.topics)
    }

    return this.compiledMinutes()
  }

  /**
   * Generate basic minutes without AI
   * @private
   */
  generateBasicMinutes(transcript, analytics, actionItems) {
    // Simple transcript-based minutes
    const speakers = new Set(transcript.map(e => e.speaker))
    this.sections.attendees = Array.from(speakers).map(name => ({
      name,
      joinedAt: transcript.find(e => e.speaker === name)?.timestamp || Date.now()
    }))

    this.sections.discussions = [{
      topic: 'Meeting Discussion',
      summary: `${transcript.length} messages exchanged during the meeting.`
    }]

    this.sections.actionItems = actionItems
    this.sections.decisions = []
    this.sections.nextSteps = []

    return this.compiledMinutes()
  }

  /**
   * Generate discussions summary
   * @private
   */
  async generateDiscussionsSummary(transcript) {
    if (!this.aiToken || transcript.length === 0) return []

    const fullText = transcript.map(e =>
      `[${new Date(e.timestamp).toLocaleTimeString()}] ${e.speaker}: ${e.text}`
    ).join('\n')

    try {
      const response = await fetch(`${this.API_BASE_URL}/ai-tokens/chat`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.aiToken.id}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          modelId: this.aiModel.id,
          prompt: `Summarize the main discussion topics from this meeting transcript. For each topic:

1. Topic name
2. Key points discussed
3. Main contributors
4. Duration (if significant)

Transcript:
${fullText}

Return JSON array:
[
  {
    "topic": "topic name",
    "summary": "concise summary of discussion",
    "keyPoints": ["point 1", "point 2"],
    "contributors": ["speaker 1", "speaker 2"],
    "significant": true/false
  }
]`,
          application: 'VideoConferenceAI',
          operation: 'discussions_summary',
          temperature: 0.3,
          maxTokens: 2048
        })
      })

      if (response.ok) {
        const result = await response.json()
        const discussions = this.parseJSONResponse(result.completion || result.message)
        return Array.isArray(discussions) ? discussions : []
      }
    } catch (error) {
      logger.error('[MeetingMinutesService] Discussions summary error:', error)
    }

    return []
  }

  /**
   * Extract decisions from transcript
   * @private
   */
  async extractDecisions(transcript) {
    if (!this.aiToken || transcript.length === 0) return []

    const fullText = transcript.map(e =>
      `[${new Date(e.timestamp).toLocaleTimeString()}] ${e.speaker}: ${e.text}`
    ).join('\n')

    try {
      const response = await fetch(`${this.API_BASE_URL}/ai-tokens/chat`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.aiToken.id}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          modelId: this.aiModel.id,
          prompt: `Extract all decisions made during this meeting. For each decision:

1. What was decided
2. Who made the decision (if clear)
3. Why it was decided (rationale)
4. Impact or implications

Only extract clear, explicit decisions - not proposals or discussions.

Transcript:
${fullText}

Return JSON array:
[
  {
    "decision": "clear statement of what was decided",
    "decidedBy": "person or group, or null",
    "rationale": "why this decision was made",
    "impact": "expected impact or implications",
    "timestamp": "time from transcript"
  }
]

If no clear decisions, return empty array.`,
          application: 'VideoConferenceAI',
          operation: 'decisions_extraction',
          temperature: 0.2,
          maxTokens: 2048
        })
      })

      if (response.ok) {
        const result = await response.json()
        const decisions = this.parseJSONResponse(result.completion || result.message)
        return Array.isArray(decisions) ? decisions : []
      }
    } catch (error) {
      logger.error('[MeetingMinutesService] Decisions extraction error:', error)
    }

    return []
  }

  /**
   * Generate next steps
   * @private
   */
  async generateNextSteps(transcript, actionItems) {
    if (!this.aiToken) {
      // Basic next steps from action items
      return actionItems.map(item => ({
        step: item.task,
        owner: item.assignee,
        deadline: item.deadline
      }))
    }

    const recentText = transcript.slice(-30).map(e =>
      `${e.speaker}: ${e.text}`
    ).join('\n')

    try {
      const response = await fetch(`${this.API_BASE_URL}/ai-tokens/chat`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.aiToken.id}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          modelId: this.aiModel.id,
          prompt: `Based on the meeting discussion and action items, list the next steps.

Recent discussion:
${recentText}

Action items:
${actionItems.map(item => `- ${item.task} (${item.assignee || 'unassigned'})`).join('\n')}

Identify:
1. Immediate next steps (what should happen first)
2. Dependencies (what depends on what)
3. Follow-up meetings if needed

Return JSON array:
[
  {
    "step": "description",
    "priority": "immediate/short-term/long-term",
    "dependencies": ["other step if any"],
    "owner": "person or team, or null"
  }
]`,
          application: 'VideoConferenceAI',
          operation: 'next_steps',
          temperature: 0.3,
          maxTokens: 1536
        })
      })

      if (response.ok) {
        const result = await response.json()
        const nextSteps = this.parseJSONResponse(result.completion || result.message)
        return Array.isArray(nextSteps) ? nextSteps : []
      }
    } catch (error) {
      logger.error('[MeetingMinutesService] Next steps error:', error)
    }

    // Fallback to action items
    return actionItems.map(item => ({
      step: item.task,
      priority: item.priority === 'high' ? 'immediate' : 'short-term',
      owner: item.assignee,
      dependencies: []
    }))
  }

  /**
   * Generate agenda from detected topics
   * @private
   */
  generateAgendaFromTopics(topicsData) {
    if (!topicsData || !topicsData.mainTopics) return []

    return topicsData.mainTopics.slice(0, 10).map((topic, index) => ({
      item: `${index + 1}. ${topic.topic}`,
      description: topic.description,
      importance: topic.importance
    }))
  }

  /**
   * Get compiled minutes
   * @private
   */
  compiledMinutes() {
    const duration = this.meetingInfo.endTime && this.meetingInfo.startTime
      ? this.meetingInfo.endTime - this.meetingInfo.startTime
      : null

    return {
      metadata: {
        title: this.meetingInfo.title || 'Meeting',
        date: this.meetingInfo.startTime ? new Date(this.meetingInfo.startTime).toLocaleDateString() : new Date().toLocaleDateString(),
        startTime: this.meetingInfo.startTime ? new Date(this.meetingInfo.startTime).toLocaleTimeString() : null,
        endTime: this.meetingInfo.endTime ? new Date(this.meetingInfo.endTime).toLocaleTimeString() : null,
        duration: duration ? this.formatDuration(duration) : null,
        organizer: this.meetingInfo.organizer
      },
      attendees: this.sections.attendees,
      agenda: this.sections.agenda,
      discussions: this.sections.discussions,
      decisions: this.sections.decisions,
      actionItems: this.sections.actionItems,
      nextSteps: this.sections.nextSteps,
      generatedAt: new Date().toISOString()
    }
  }

  /**
   * Export minutes to markdown
   * @param {Object} minutes - Compiled minutes (optional, uses cached if not provided)
   * @returns {string} Markdown formatted minutes
   */
  exportMarkdown(minutes = null) {
    const m = minutes || this.compiledMinutes()

    let md = `# ${m.metadata.title}\n\n`
    md += `**Date:** ${m.metadata.date}\n`
    if (m.metadata.startTime) md += `**Time:** ${m.metadata.startTime} - ${m.metadata.endTime}\n`
    if (m.metadata.duration) md += `**Duration:** ${m.metadata.duration}\n`
    if (m.metadata.organizer) md += `**Organizer:** ${m.metadata.organizer}\n`
    md += '\n---\n\n'

    // Attendees
    if (m.attendees.length > 0) {
      md += '## 👥 Attendees\n\n'
      m.attendees.forEach(a => {
        md += `- ${a.name}\n`
      })
      md += '\n'
    }

    // Agenda
    if (m.agenda.length > 0) {
      md += '## 📋 Agenda\n\n'
      m.agenda.forEach(item => {
        md += `${item.item}\n`
        if (item.description) md += `   *${item.description}*\n`
      })
      md += '\n'
    }

    // Discussions
    if (m.discussions.length > 0) {
      md += '## 💬 Discussion Summary\n\n'
      m.discussions.forEach(d => {
        md += `### ${d.topic}\n\n`
        md += `${d.summary}\n\n`
        if (d.keyPoints && d.keyPoints.length > 0) {
          md += '**Key Points:**\n'
          d.keyPoints.forEach(point => md += `- ${point}\n`)
          md += '\n'
        }
        if (d.contributors && d.contributors.length > 0) {
          md += `*Contributors: ${d.contributors.join(', ')}*\n\n`
        }
      })
    }

    // Decisions
    if (m.decisions.length > 0) {
      md += '## ✅ Decisions Made\n\n'
      m.decisions.forEach((dec, index) => {
        md += `${index + 1}. **${dec.decision}**\n`
        if (dec.decidedBy) md += `   - Decided by: ${dec.decidedBy}\n`
        if (dec.rationale) md += `   - Rationale: ${dec.rationale}\n`
        if (dec.impact) md += `   - Impact: ${dec.impact}\n`
        md += '\n'
      })
    }

    // Action Items
    if (m.actionItems.length > 0) {
      md += '## 🎯 Action Items\n\n'
      m.actionItems.forEach(item => {
        md += `- [ ] ${item.task}\n`
        if (item.assignee) md += `  - **Assignee:** ${item.assignee}\n`
        if (item.deadline) md += `  - **Deadline:** ${item.deadline}\n`
        if (item.priority) md += `  - **Priority:** ${item.priority}\n`
        md += '\n'
      })
    }

    // Next Steps
    if (m.nextSteps.length > 0) {
      md += '## 🔜 Next Steps\n\n'
      m.nextSteps.forEach((step, index) => {
        md += `${index + 1}. ${step.step}`
        if (step.owner) md += ` (${step.owner})`
        md += '\n'
        if (step.priority) md += `   - Priority: ${step.priority}\n`
        if (step.dependencies && step.dependencies.length > 0) {
          md += `   - Depends on: ${step.dependencies.join(', ')}\n`
        }
      })
      md += '\n'
    }

    md += '\n---\n\n'
    md += `*Generated: ${new Date(m.generatedAt).toLocaleString()}*\n`

    return md
  }

  /**
   * Export minutes to HTML
   * @param {Object} minutes - Compiled minutes
   * @returns {string} HTML formatted minutes
   */
  exportHTML(minutes = null) {
    const m = minutes || this.compiledMinutes()

    let html = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>${m.metadata.title}</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; max-width: 800px; margin: 40px auto; padding: 20px; line-height: 1.6; }
        h1 { color: #2c3e50; border-bottom: 3px solid #3498db; padding-bottom: 10px; }
        h2 { color: #34495e; margin-top: 30px; border-bottom: 2px solid #ecf0f1; padding-bottom: 8px; }
        h3 { color: #7f8c8d; }
        .metadata { background: #ecf0f1; padding: 15px; border-radius: 5px; margin: 20px 0; }
        .metadata strong { color: #2c3e50; }
        ul { padding-left: 20px; }
        li { margin: 5px 0; }
        .decision { background: #d5f4e6; padding: 10px; margin: 10px 0; border-left: 4px solid #27ae60; }
        .action-item { background: #fef5e7; padding: 10px; margin: 10px 0; border-left: 4px solid #f39c12; }
        .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #ecf0f1; color: #95a5a6; font-size: 0.9em; }
    </style>
</head>
<body>
    <h1>${m.metadata.title}</h1>
    <div class="metadata">
        <strong>Date:</strong> ${m.metadata.date}<br>
        ${m.metadata.startTime ? `<strong>Time:</strong> ${m.metadata.startTime} - ${m.metadata.endTime}<br>` : ''}
        ${m.metadata.duration ? `<strong>Duration:</strong> ${m.metadata.duration}<br>` : ''}
        ${m.metadata.organizer ? `<strong>Organizer:</strong> ${m.metadata.organizer}` : ''}
    </div>
`

    if (m.attendees.length > 0) {
      html += '    <h2>👥 Attendees</h2>\n    <ul>\n'
      m.attendees.forEach(a => {
        html += `        <li>${a.name}</li>\n`
      })
      html += '    </ul>\n'
    }

    if (m.discussions.length > 0) {
      html += '    <h2>💬 Discussion Summary</h2>\n'
      m.discussions.forEach(d => {
        html += `    <h3>${d.topic}</h3>\n    <p>${d.summary}</p>\n`
        if (d.keyPoints && d.keyPoints.length > 0) {
          html += '    <ul>\n'
          d.keyPoints.forEach(point => html += `        <li>${point}</li>\n`)
          html += '    </ul>\n'
        }
      })
    }

    if (m.decisions.length > 0) {
      html += '    <h2>✅ Decisions Made</h2>\n'
      m.decisions.forEach(dec => {
        html += `    <div class="decision">\n        <strong>${dec.decision}</strong>\n`
        if (dec.rationale) html += `        <p><em>Rationale:</em> ${dec.rationale}</p>\n`
        html += '    </div>\n'
      })
    }

    if (m.actionItems.length > 0) {
      html += '    <h2>🎯 Action Items</h2>\n'
      m.actionItems.forEach(item => {
        html += `    <div class="action-item">\n        ${item.task}\n`
        if (item.assignee) html += `        <br><strong>Assignee:</strong> ${item.assignee}\n`
        if (item.deadline) html += `        <br><strong>Deadline:</strong> ${item.deadline}\n`
        html += '    </div>\n'
      })
    }

    html += `    <div class="footer">Generated: ${new Date(m.generatedAt).toLocaleString()}</div>\n`
    html += '</body>\n</html>'

    return html
  }

  /**
   * Export minutes to JSON
   * @param {Object} minutes - Compiled minutes
   * @returns {string} JSON formatted minutes
   */
  exportJSON(minutes = null) {
    const m = minutes || this.compiledMinutes()
    return JSON.stringify(m, null, 2)
  }

  /**
   * Format duration in ms to human-readable string
   * @private
   */
  formatDuration(ms) {
    const hours = Math.floor(ms / 3600000)
    const minutes = Math.floor((ms % 3600000) / 60000)

    if (hours > 0) {
      return `${hours}h ${minutes}m`
    }
    return `${minutes}m`
  }

  /**
   * Parse JSON response from AI
   * @private
   */
  parseJSONResponse(text) {
    try {
      const jsonMatch = text.match(/\[[\s\S]*\]/) || text.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0])
      }
      return null
    } catch (error) {
      logger.warn('[MeetingMinutesService] Failed to parse JSON:', error)
      return null
    }
  }

  /**
   * Clear all data
   */
  clear() {
    this.meetingInfo = {
      title: '',
      startTime: null,
      endTime: null,
      participants: [],
      organizer: null
    }

    this.sections = {
      attendees: [],
      agenda: [],
      discussions: [],
      decisions: [],
      actionItems: [],
      nextSteps: []
    }
  }
}
