/**
 * Action Items Service for Video Conference
 *
 * Automatically extracts and tracks action items from meeting:
 * - Task detection from conversation
 * - Assignment identification
 * - Deadline extraction
 * - Priority assessment
 * - Follow-up suggestions
 * - Task status tracking
 */

import { getDefaultToken } from '../aiTokenService'
import { logger } from '@/utils/logger'

export default class ActionItemsService {
  constructor() {
    this.aiToken = null
    this.aiModel = null
    this.API_BASE_URL = '/api'

    // Action items storage
    this.actionItems = []
    this.pendingExtractions = []

    // Processing state
    this.isProcessing = false
    this.lastProcessedIndex = 0
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
      logger.debug('[ActionItemsService] Initialized with AI token')
      return true
    } catch (error) {
      logger.warn('[ActionItemsService] Failed to get AI token:', error)
      return false
    }
  }

  /**
   * Extract action items from transcript segment
   * @param {Array} transcriptSegment - Array of transcript entries
   */
  async extractFromSegment(transcriptSegment) {
    if (!this.aiToken || transcriptSegment.length === 0) {
      return []
    }

    const text = transcriptSegment.map(e =>
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
          prompt: `Extract action items from this meeting transcript segment. For each action item, identify:

1. Task description (what needs to be done)
2. Assignee (who will do it, if mentioned)
3. Deadline (when it should be done, if mentioned)
4. Priority (high, medium, low based on context)
5. Status (proposed, agreed, assigned)
6. Context (why this task is needed)

Transcript:
${text}

Return JSON array of action items. If no action items found, return empty array:
[
  {
    "task": "clear description",
    "assignee": "person name or null",
    "deadline": "date/time or null",
    "priority": "high/medium/low",
    "status": "proposed/agreed/assigned",
    "context": "brief context",
    "extractedFrom": "relevant quote from transcript"
  }
]`,
          application: 'VideoConferenceAI',
          operation: 'action_items_extraction',
          temperature: 0.2,
          maxTokens: 2048
        })
      })

      if (response.ok) {
        const result = await response.json()
        const items = this.parseJSONResponse(result.completion || result.message)

        if (Array.isArray(items) && items.length > 0) {
          // Add metadata
          const enrichedItems = items.map(item => ({
            ...item,
            id: this.generateId(),
            extractedAt: Date.now(),
            completed: false,
            completedAt: null,
            notes: []
          }))

          this.actionItems.push(...enrichedItems)
          return enrichedItems
        }
      }
    } catch (error) {
      logger.error('[ActionItemsService] Extraction error:', error)
    }

    return []
  }

  /**
   * Extract action items from full transcript
   * @param {Array} fullTranscript - Complete meeting transcript
   * @returns {Promise<Array>} Extracted action items
   */
  async extractFromTranscript(fullTranscript) {
    if (!this.aiToken) {
      logger.warn('[ActionItemsService] AI token not available')
      return []
    }

    // Process in chunks to avoid token limits
    const chunkSize = 20
    const allItems = []

    for (let i = 0; i < fullTranscript.length; i += chunkSize) {
      const chunk = fullTranscript.slice(i, i + chunkSize)
      const items = await this.extractFromSegment(chunk)
      allItems.push(...items)

      // Small delay to avoid rate limiting
      if (i + chunkSize < fullTranscript.length) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }

    // Deduplicate similar action items
    return this.deduplicateActionItems(allItems)
  }

  /**
   * Process transcript continuously for action items
   * @param {Array} transcript - Current transcript
   * @param {number} batchSize - Number of new entries to process
   */
  async processNewEntries(transcript, batchSize = 10) {
    if (!this.aiToken || this.isProcessing) {
      return []
    }

    // Check if there are new entries to process
    if (transcript.length <= this.lastProcessedIndex) {
      return []
    }

    this.isProcessing = true

    try {
      // Get unprocessed entries
      const newEntries = transcript.slice(this.lastProcessedIndex)

      // Process in batches
      if (newEntries.length >= batchSize) {
        const batch = newEntries.slice(0, batchSize)
        const extractedItems = await this.extractFromSegment(batch)

        this.lastProcessedIndex += batchSize

        return extractedItems
      }
    } catch (error) {
      logger.error('[ActionItemsService] Processing error:', error)
    } finally {
      this.isProcessing = false
    }

    return []
  }

  /**
   * Deduplicate similar action items
   * @private
   */
  deduplicateActionItems(items) {
    const unique = []

    items.forEach(item => {
      // Check if similar item already exists
      const similar = unique.find(u =>
        this.calculateSimilarity(u.task, item.task) > 0.7
      )

      if (!similar) {
        unique.push(item)
      } else {
        // Merge information from duplicate
        if (item.assignee && !similar.assignee) {
          similar.assignee = item.assignee
        }
        if (item.deadline && !similar.deadline) {
          similar.deadline = item.deadline
        }
        if (item.priority === 'high' && similar.priority !== 'high') {
          similar.priority = item.priority
        }
      }
    })

    return unique
  }

  /**
   * Calculate similarity between two strings
   * @private
   */
  calculateSimilarity(str1, str2) {
    const s1 = str1.toLowerCase().split(/\s+/)
    const s2 = str2.toLowerCase().split(/\s+/)

    const commonWords = s1.filter(word => s2.includes(word))
    const totalWords = new Set([...s1, ...s2]).size

    return totalWords > 0 ? commonWords.length / totalWords : 0
  }

  /**
   * Suggest follow-up actions
   * @param {Array} transcript - Meeting transcript
   * @returns {Promise<Array>} Follow-up suggestions
   */
  async suggestFollowUps(transcript) {
    if (!this.aiToken || transcript.length === 0) {
      return []
    }

    const recentText = transcript.slice(-30).map(e =>
      `${e.speaker}: ${e.text}`
    ).join('\n')

    const currentItems = this.actionItems.filter(item => !item.completed)

    try {
      const response = await fetch(`${this.API_BASE_URL}/ai-tokens/chat`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.aiToken.id}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          modelId: this.aiModel.id,
          prompt: `Based on this meeting discussion and current action items, suggest follow-up actions.

Recent discussion:
${recentText}

Current action items:
${currentItems.map(item => `- ${item.task} (${item.assignee || 'unassigned'})`).join('\n')}

Suggest:
1. Missing action items that should be added
2. Potential blockers or dependencies
3. Recommended next steps
4. Additional stakeholders who should be involved

Return JSON array of suggestions:
[
  {
    "type": "missing_action/blocker/next_step/stakeholder",
    "suggestion": "description",
    "priority": "high/medium/low",
    "reasoning": "why this is important"
  }
]`,
          application: 'VideoConferenceAI',
          operation: 'follow_up_suggestions',
          temperature: 0.3,
          maxTokens: 1536
        })
      })

      if (response.ok) {
        const result = await response.json()
        return this.parseJSONResponse(result.completion || result.message) || []
      }
    } catch (error) {
      logger.error('[ActionItemsService] Follow-up suggestions error:', error)
    }

    return []
  }

  /**
   * Update action item status
   * @param {string} itemId - Action item ID
   * @param {Object} updates - Updates to apply
   */
  updateActionItem(itemId, updates) {
    const item = this.actionItems.find(i => i.id === itemId)
    if (item) {
      Object.assign(item, updates)

      if (updates.completed && !item.completedAt) {
        item.completedAt = Date.now()
      }

      return item
    }
    return null
  }

  /**
   * Add note to action item
   * @param {string} itemId - Action item ID
   * @param {string} note - Note text
   */
  addNote(itemId, note) {
    const item = this.actionItems.find(i => i.id === itemId)
    if (item) {
      item.notes.push({
        text: note,
        timestamp: Date.now()
      })
      return true
    }
    return false
  }

  /**
   * Get action items grouped by status
   */
  getItemsByStatus() {
    return {
      proposed: this.actionItems.filter(i => i.status === 'proposed' && !i.completed),
      agreed: this.actionItems.filter(i => i.status === 'agreed' && !i.completed),
      assigned: this.actionItems.filter(i => i.status === 'assigned' && !i.completed),
      completed: this.actionItems.filter(i => i.completed)
    }
  }

  /**
   * Get action items grouped by assignee
   */
  getItemsByAssignee() {
    const grouped = new Map()

    this.actionItems.forEach(item => {
      const assignee = item.assignee || 'Unassigned'
      if (!grouped.has(assignee)) {
        grouped.set(assignee, [])
      }
      grouped.get(assignee).push(item)
    })

    return Object.fromEntries(grouped)
  }

  /**
   * Get action items by priority
   */
  getItemsByPriority() {
    return {
      high: this.actionItems.filter(i => i.priority === 'high' && !i.completed),
      medium: this.actionItems.filter(i => i.priority === 'medium' && !i.completed),
      low: this.actionItems.filter(i => i.priority === 'low' && !i.completed)
    }
  }

  /**
   * Get overdue action items
   */
  getOverdueItems() {
    const now = Date.now()
    return this.actionItems.filter(item => {
      if (item.completed || !item.deadline) return false

      // Try to parse deadline
      const deadlineDate = new Date(item.deadline)
      return deadlineDate.getTime() < now
    })
  }

  /**
   * Export action items
   * @param {string} format - Export format (json, markdown, csv)
   * @returns {string} Exported data
   */
  export(format = 'markdown') {
    switch (format) {
      case 'json':
        return JSON.stringify(this.actionItems, null, 2)

      case 'markdown':
        return this.exportMarkdown()

      case 'csv':
        return this.exportCSV()

      default:
        return this.exportMarkdown()
    }
  }

  /**
   * Export as markdown
   * @private
   */
  exportMarkdown() {
    const byStatus = this.getItemsByStatus()

    let md = '# Action Items\n\n'
    md += `Generated: ${new Date().toLocaleString()}\n\n`

    // Proposed
    if (byStatus.proposed.length > 0) {
      md += '## 📝 Proposed\n\n'
      byStatus.proposed.forEach(item => {
        md += `- [ ] ${item.task}\n`
        if (item.assignee) md += `  - Assignee: ${item.assignee}\n`
        if (item.deadline) md += `  - Deadline: ${item.deadline}\n`
        md += `  - Priority: ${item.priority}\n`
        if (item.context) md += `  - Context: ${item.context}\n`
        md += '\n'
      })
    }

    // Agreed
    if (byStatus.agreed.length > 0) {
      md += '## ✅ Agreed\n\n'
      byStatus.agreed.forEach(item => {
        md += `- [ ] ${item.task}\n`
        if (item.assignee) md += `  - Assignee: ${item.assignee}\n`
        if (item.deadline) md += `  - Deadline: ${item.deadline}\n`
        md += `  - Priority: ${item.priority}\n`
        md += '\n'
      })
    }

    // Assigned
    if (byStatus.assigned.length > 0) {
      md += '## 🎯 Assigned\n\n'
      byStatus.assigned.forEach(item => {
        md += `- [ ] ${item.task}\n`
        if (item.assignee) md += `  - Assignee: **${item.assignee}**\n`
        if (item.deadline) md += `  - Deadline: ${item.deadline}\n`
        md += `  - Priority: ${item.priority}\n`
        md += '\n'
      })
    }

    // Completed
    if (byStatus.completed.length > 0) {
      md += '## ✔️ Completed\n\n'
      byStatus.completed.forEach(item => {
        md += `- [x] ${item.task}\n`
        if (item.completedAt) md += `  - Completed: ${new Date(item.completedAt).toLocaleString()}\n`
        md += '\n'
      })
    }

    return md
  }

  /**
   * Export as CSV
   * @private
   */
  exportCSV() {
    const headers = ['Task', 'Assignee', 'Deadline', 'Priority', 'Status', 'Completed', 'Context']
    const rows = this.actionItems.map(item => [
      item.task,
      item.assignee || '',
      item.deadline || '',
      item.priority,
      item.status,
      item.completed ? 'Yes' : 'No',
      item.context || ''
    ])

    return [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n')
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
      logger.warn('[ActionItemsService] Failed to parse JSON:', error)
      return null
    }
  }

  /**
   * Generate unique ID
   * @private
   */
  generateId() {
    return `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Get all action items
   */
  getAllItems() {
    return this.actionItems
  }

  /**
   * Get summary statistics
   */
  getStatistics() {
    const total = this.actionItems.length
    const completed = this.actionItems.filter(i => i.completed).length
    const pending = total - completed
    const overdue = this.getOverdueItems().length

    const byPriority = this.getItemsByPriority()

    return {
      total,
      completed,
      pending,
      overdue,
      completionRate: total > 0 ? ((completed / total) * 100).toFixed(1) : 0,
      byPriority: {
        high: byPriority.high.length,
        medium: byPriority.medium.length,
        low: byPriority.low.length
      }
    }
  }

  /**
   * Clear all action items
   */
  clear() {
    this.actionItems = []
    this.lastProcessedIndex = 0
  }
}
