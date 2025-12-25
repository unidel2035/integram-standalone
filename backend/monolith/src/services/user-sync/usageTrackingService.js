// usageTrackingService.js - AI token usage tracking and aggregation service
// Phase 3: Payment Integration - Issue #2785
// Tracks AI operations, token consumption, and cost calculation

import fs from 'fs/promises'
import path from 'path'
import crypto from 'crypto'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Data directory paths
const DATA_DIR = path.join(__dirname, '../../../../data/payments')
const USAGE_LOGS_FILE = path.join(DATA_DIR, 'usage_logs.json')
const USAGE_STATS_FILE = path.join(DATA_DIR, 'usage_stats.json')

export class UsageTrackingService {
  constructor(config = {}) {
    this.db = config.db // PostgreSQL connection for model pricing lookup
    this.initialized = false
  }

  /**
   * Initialize service - ensure data directory and files exist
   */
  async initialize() {
    if (this.initialized) return

    try {
      await fs.mkdir(DATA_DIR, { recursive: true })

      // Initialize usage_logs.json if not exists
      try {
        await fs.access(USAGE_LOGS_FILE)
      } catch {
        await fs.writeFile(USAGE_LOGS_FILE, JSON.stringify({ logs: [] }, null, 2))
      }

      // Initialize usage_stats.json if not exists
      try {
        await fs.access(USAGE_STATS_FILE)
      } catch {
        await fs.writeFile(USAGE_STATS_FILE, JSON.stringify({
          daily: {},
          weekly: {},
          monthly: {}
        }, null, 2))
      }

      this.initialized = true
    } catch (error) {
      console.error('Failed to initialize UsageTrackingService:', error)
      throw error
    }
  }

  /**
   * Record AI operation usage
   * @param {string} userId - User ID
   * @param {string} tokenId - Access token ID
   * @param {Object} operation - Operation details
   * @returns {Promise<Object>} Recorded usage entry
   */
  async recordUsage(userId, tokenId, operation) {
    await this.initialize()

    const {
      modelId,
      provider,
      application = 'Unknown',
      operationType = 'chat',
      promptTokens = 0,
      completionTokens = 0,
      metadata = {}
    } = operation

    const totalTokens = promptTokens + completionTokens

    // Calculate cost based on model pricing
    const cost = await this.calculateCost({
      modelId,
      promptTokens,
      completionTokens
    }, provider)

    // Create usage log entry
    const usageLog = {
      id: `usage_${crypto.randomUUID().replace(/-/g, '')}`,
      userId,
      tokenId,
      operation: operationType,
      modelId,
      provider,
      timestamp: new Date().toISOString(),
      usage: {
        promptTokens,
        completionTokens,
        totalTokens
      },
      cost: {
        amount: cost,
        currency: 'USD'
      },
      metadata: {
        application,
        operation: operationType,
        ...metadata
      }
    }

    // Append to usage logs
    await this._appendUsageLog(usageLog)

    // Update aggregated statistics
    await this._updateAggregatedStats(userId, usageLog)

    return usageLog
  }

  /**
   * Get usage statistics for a user
   * @param {string} userId - User ID
   * @param {string} period - Period: 'day', 'week', 'month'
   * @returns {Promise<Object>} Usage statistics
   */
  async getUserUsageStats(userId, period = 'day') {
    await this.initialize()

    const stats = await this._readUsageStats()
    const periodKey = this._getPeriodKey(period)

    if (!stats[periodKey] || !stats[periodKey][userId]) {
      return {
        userId,
        period,
        totalTokens: 0,
        totalCost: 0,
        operations: 0,
        byModel: {}
      }
    }

    return stats[periodKey][userId]
  }

  /**
   * Get usage statistics for a specific token
   * @param {string} tokenId - Token ID
   * @param {string} period - Period: 'day', 'week', 'month'
   * @returns {Promise<Object>} Token usage statistics
   */
  async getTokenUsageStats(tokenId, period = 'day') {
    await this.initialize()

    const logs = await this._readUsageLogs()
    const startDate = this._getPeriodStartDate(period)

    const filteredLogs = logs.logs.filter(log =>
      log.tokenId === tokenId &&
      new Date(log.timestamp) >= startDate
    )

    return this._aggregateLogs(filteredLogs)
  }

  /**
   * Calculate cost for usage data
   * @param {Object} usageData - Usage data with token counts
   * @param {string} model - Model identifier or provider
   * @returns {Promise<number>} Cost in USD
   */
  async calculateCost(usageData, model) {
    const { modelId, promptTokens = 0, completionTokens = 0 } = usageData

    try {
      // Try to get pricing from database if available
      if (this.db && modelId) {
        const result = await this.db.query(`
          SELECT cost_per_1k_input, cost_per_1k_output
          FROM ai_models
          WHERE id = $1
        `, [modelId])

        if (result.rows.length > 0) {
          const pricing = result.rows[0]
          const costInput = (promptTokens / 1000) * parseFloat(pricing.cost_per_1k_input || 0)
          const costOutput = (completionTokens / 1000) * parseFloat(pricing.cost_per_1k_output || 0)
          return costInput + costOutput
        }
      }

      // Fallback to default pricing based on provider
      const defaultPricing = this._getDefaultPricing(model)
      const costInput = (promptTokens / 1000) * defaultPricing.input
      const costOutput = (completionTokens / 1000) * defaultPricing.output
      return costInput + costOutput
    } catch (error) {
      console.error('Error calculating cost:', error)
      // Return 0 if calculation fails
      return 0
    }
  }

  /**
   * Aggregate usage data for a period
   * @param {string} userId - User ID
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @returns {Promise<Object>} Aggregated usage
   */
  async aggregateUsage(userId, startDate, endDate) {
    await this.initialize()

    const logs = await this._readUsageLogs()

    const filteredLogs = logs.logs.filter(log =>
      log.userId === userId &&
      new Date(log.timestamp) >= new Date(startDate) &&
      new Date(log.timestamp) <= new Date(endDate)
    )

    return this._aggregateLogs(filteredLogs)
  }

  /**
   * Get recent usage logs for a user
   * @param {string} userId - User ID
   * @param {number} limit - Number of logs to return
   * @returns {Promise<Array>} Recent usage logs
   */
  async getRecentUsage(userId, limit = 100) {
    await this.initialize()

    const logs = await this._readUsageLogs()

    return logs.logs
      .filter(log => log.userId === userId)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, limit)
  }

  /**
   * Clean up old usage logs (older than retention period)
   * @param {number} retentionDays - Days to retain logs
   * @returns {Promise<number>} Number of logs deleted
   */
  async cleanupOldLogs(retentionDays = 90) {
    await this.initialize()

    const logs = await this._readUsageLogs()
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays)

    const originalCount = logs.logs.length
    logs.logs = logs.logs.filter(log => new Date(log.timestamp) >= cutoffDate)

    await this._writeUsageLogs(logs)

    return originalCount - logs.logs.length
  }

  // ==================== Private Methods ====================

  /**
   * Append usage log to file
   * @private
   */
  async _appendUsageLog(usageLog) {
    const logs = await this._readUsageLogs()
    logs.logs.push(usageLog)
    await this._writeUsageLogs(logs)
  }

  /**
   * Read usage logs from file
   * @private
   */
  async _readUsageLogs() {
    try {
      const data = await fs.readFile(USAGE_LOGS_FILE, 'utf8')
      return JSON.parse(data)
    } catch (error) {
      console.error('Error reading usage logs:', error)
      return { logs: [] }
    }
  }

  /**
   * Write usage logs to file
   * @private
   */
  async _writeUsageLogs(logs) {
    await fs.writeFile(USAGE_LOGS_FILE, JSON.stringify(logs, null, 2))
  }

  /**
   * Read usage statistics from file
   * @private
   */
  async _readUsageStats() {
    try {
      const data = await fs.readFile(USAGE_STATS_FILE, 'utf8')
      return JSON.parse(data)
    } catch (error) {
      console.error('Error reading usage stats:', error)
      return { daily: {}, weekly: {}, monthly: {} }
    }
  }

  /**
   * Write usage statistics to file
   * @private
   */
  async _writeUsageStats(stats) {
    await fs.writeFile(USAGE_STATS_FILE, JSON.stringify(stats, null, 2))
  }

  /**
   * Update aggregated statistics after recording usage
   * @private
   */
  async _updateAggregatedStats(userId, usageLog) {
    const stats = await this._readUsageStats()

    // Update daily stats
    const today = new Date().toISOString().split('T')[0]
    this._updatePeriodStats(stats.daily, userId, today, usageLog)

    // Update weekly stats
    const weekKey = this._getWeekKey(new Date())
    this._updatePeriodStats(stats.weekly, userId, weekKey, usageLog)

    // Update monthly stats
    const monthKey = new Date().toISOString().substring(0, 7) // YYYY-MM
    this._updatePeriodStats(stats.monthly, userId, monthKey, usageLog)

    await this._writeUsageStats(stats)
  }

  /**
   * Update statistics for a specific period
   * @private
   */
  _updatePeriodStats(periodStats, userId, periodKey, usageLog) {
    if (!periodStats[userId]) {
      periodStats[userId] = {}
    }

    if (!periodStats[userId][periodKey]) {
      periodStats[userId][periodKey] = {
        totalTokens: 0,
        totalCost: 0,
        operations: 0,
        byModel: {}
      }
    }

    const stats = periodStats[userId][periodKey]
    stats.totalTokens += usageLog.usage.totalTokens
    stats.totalCost += usageLog.cost.amount
    stats.operations += 1

    // Update by-model stats
    const modelKey = usageLog.provider || 'unknown'
    if (!stats.byModel[modelKey]) {
      stats.byModel[modelKey] = {
        tokens: 0,
        cost: 0
      }
    }
    stats.byModel[modelKey].tokens += usageLog.usage.totalTokens
    stats.byModel[modelKey].cost += usageLog.cost.amount
  }

  /**
   * Aggregate logs into summary statistics
   * @private
   */
  _aggregateLogs(logs) {
    const aggregated = {
      totalTokens: 0,
      promptTokens: 0,
      completionTokens: 0,
      totalCost: 0,
      operations: logs.length,
      byModel: {},
      byApplication: {}
    }

    for (const log of logs) {
      aggregated.totalTokens += log.usage.totalTokens
      aggregated.promptTokens += log.usage.promptTokens
      aggregated.completionTokens += log.usage.completionTokens
      aggregated.totalCost += log.cost.amount

      // By model
      const modelKey = log.provider || 'unknown'
      if (!aggregated.byModel[modelKey]) {
        aggregated.byModel[modelKey] = { tokens: 0, cost: 0, operations: 0 }
      }
      aggregated.byModel[modelKey].tokens += log.usage.totalTokens
      aggregated.byModel[modelKey].cost += log.cost.amount
      aggregated.byModel[modelKey].operations += 1

      // By application
      const appKey = log.metadata.application || 'Unknown'
      if (!aggregated.byApplication[appKey]) {
        aggregated.byApplication[appKey] = { tokens: 0, cost: 0, operations: 0 }
      }
      aggregated.byApplication[appKey].tokens += log.usage.totalTokens
      aggregated.byApplication[appKey].cost += log.cost.amount
      aggregated.byApplication[appKey].operations += 1
    }

    return aggregated
  }

  /**
   * Get default pricing for a provider
   * @private
   */
  _getDefaultPricing(provider = 'deepseek') {
    const pricing = {
      'deepseek': { input: 0.00014, output: 0.00028 }, // $0.14/$0.28 per 1M tokens
      'openai': { input: 0.002, output: 0.002 }, // GPT-3.5 pricing
      'gpt-4': { input: 0.03, output: 0.06 },
      'anthropic': { input: 0.003, output: 0.015 }, // Claude pricing
      'default': { input: 0.001, output: 0.002 }
    }

    return pricing[provider.toLowerCase()] || pricing.default
  }

  /**
   * Get period key (daily, weekly, monthly)
   * @private
   */
  _getPeriodKey(period) {
    const mapping = {
      'day': 'daily',
      'daily': 'daily',
      'week': 'weekly',
      'weekly': 'weekly',
      'month': 'monthly',
      'monthly': 'monthly'
    }
    return mapping[period.toLowerCase()] || 'daily'
  }

  /**
   * Get start date for a period
   * @private
   */
  _getPeriodStartDate(period) {
    const now = new Date()
    const startDate = new Date()

    switch (period.toLowerCase()) {
      case 'day':
      case 'daily':
        startDate.setHours(0, 0, 0, 0)
        break
      case 'week':
      case 'weekly':
        startDate.setDate(now.getDate() - 7)
        break
      case 'month':
      case 'monthly':
        startDate.setMonth(now.getMonth() - 1)
        break
      default:
        startDate.setHours(0, 0, 0, 0)
    }

    return startDate
  }

  /**
   * Get week key (e.g., "2025-W45")
   * @private
   */
  _getWeekKey(date) {
    const year = date.getFullYear()
    const startOfYear = new Date(year, 0, 1)
    const days = Math.floor((date - startOfYear) / (24 * 60 * 60 * 1000))
    const weekNumber = Math.ceil((days + startOfYear.getDay() + 1) / 7)
    return `${year}-W${String(weekNumber).padStart(2, '0')}`
  }
}

export default UsageTrackingService
