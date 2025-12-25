/**
 * Business Metrics Collection Service
 *
 * Handles collection, storage, and calculation of business KPIs:
 * - User behavior tracking (page views, events, conversions)
 * - Business metrics (retention, churn, LTV)
 * - A/B testing and feature flags
 * - Export to external analytics systems
 *
 * Following DronDoc architecture guidelines:
 * - Uses local files for storage (no direct database creation)
 * - Integrates with DronDoc API when available
 * - Provides RESTful API for frontend integration
 */

import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

class BusinessMetricsService {
  constructor(options = {}) {
    this.dataDir = options.dataDir || path.join(__dirname, '../../../data/business-metrics')
    this.eventsFile = path.join(this.dataDir, 'events.json')
    this.metricsFile = path.join(this.dataDir, 'metrics.json')
    this.abTestsFile = path.join(this.dataDir, 'ab-tests.json')
    this.featureFlagsFile = path.join(this.dataDir, 'feature-flags.json')

    // In-memory cache for performance
    this.eventsCache = []
    this.metricsCache = {}
    this.abTests = new Map()
    this.featureFlags = new Map()

    this.initialized = false
  }

  /**
   * Initialize the service
   */
  async init() {
    if (this.initialized) return

    try {
      // Ensure data directory exists
      await fs.mkdir(this.dataDir, { recursive: true })

      // Load existing data
      await this.loadEvents()
      await this.loadMetrics()
      await this.loadABTests()
      await this.loadFeatureFlags()

      this.initialized = true
      console.log('BusinessMetricsService initialized')
    } catch (error) {
      console.error('Failed to initialize BusinessMetricsService:', error)
      throw error
    }
  }

  /**
   * Track an event
   * @param {Object} event - Event data
   * @returns {Object} Saved event
   */
  async trackEvent(event) {
    const eventData = {
      id: this.generateId(),
      timestamp: new Date().toISOString(),
      ...event
    }

    this.eventsCache.push(eventData)

    // Persist to file (async, non-blocking)
    this.saveEvents().catch(error => {
      console.error('Failed to save event:', error)
    })

    return eventData
  }

  /**
   * Get events with filters
   * @param {Object} filters - Filter criteria
   * @returns {Array} Filtered events
   */
  async getEvents(filters = {}) {
    let events = [...this.eventsCache]

    // Apply filters
    if (filters.userId) {
      events = events.filter(e => e.userId === filters.userId)
    }

    if (filters.eventType) {
      events = events.filter(e => e.eventType === filters.eventType)
    }

    if (filters.startDate) {
      const startDate = new Date(filters.startDate)
      events = events.filter(e => new Date(e.timestamp) >= startDate)
    }

    if (filters.endDate) {
      const endDate = new Date(filters.endDate)
      events = events.filter(e => new Date(e.timestamp) <= endDate)
    }

    // Sort by timestamp (newest first)
    events.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))

    // Apply pagination
    const limit = filters.limit || 100
    const offset = filters.offset || 0

    return {
      total: events.length,
      events: events.slice(offset, offset + limit)
    }
  }

  /**
   * Calculate user retention
   * @param {Object} options - Calculation options
   * @returns {Object} Retention metrics
   */
  async calculateRetention(options = {}) {
    const { cohortStartDate, cohortEndDate, periods = 7 } = options

    // Get user first seen dates
    const userFirstSeen = new Map()

    for (const event of this.eventsCache) {
      const userId = event.userId
      if (!userId) continue

      if (!userFirstSeen.has(userId)) {
        userFirstSeen.set(userId, new Date(event.timestamp))
      } else {
        const existing = userFirstSeen.get(userId)
        const current = new Date(event.timestamp)
        if (current < existing) {
          userFirstSeen.set(userId, current)
        }
      }
    }

    // Calculate cohorts
    const cohorts = new Map()

    for (const [userId, firstSeen] of userFirstSeen.entries()) {
      if (cohortStartDate && firstSeen < new Date(cohortStartDate)) continue
      if (cohortEndDate && firstSeen > new Date(cohortEndDate)) continue

      const cohortKey = this.getCohortKey(firstSeen)

      if (!cohorts.has(cohortKey)) {
        cohorts.set(cohortKey, {
          cohortDate: cohortKey,
          users: new Set(),
          activeByPeriod: Array(periods).fill(0).map(() => new Set())
        })
      }

      const cohort = cohorts.get(cohortKey)
      cohort.users.add(userId)

      // Check activity in subsequent periods
      const userEvents = this.eventsCache.filter(e => e.userId === userId)

      for (let period = 0; period < periods; period++) {
        const periodStart = new Date(firstSeen)
        periodStart.setDate(periodStart.getDate() + period * 7) // Weekly periods

        const periodEnd = new Date(periodStart)
        periodEnd.setDate(periodEnd.getDate() + 7)

        const activeInPeriod = userEvents.some(e => {
          const eventDate = new Date(e.timestamp)
          return eventDate >= periodStart && eventDate < periodEnd
        })

        if (activeInPeriod) {
          cohort.activeByPeriod[period].add(userId)
        }
      }
    }

    // Calculate retention percentages
    const retentionData = Array.from(cohorts.values()).map(cohort => {
      const totalUsers = cohort.users.size

      return {
        cohortDate: cohort.cohortDate,
        totalUsers,
        retention: cohort.activeByPeriod.map((active, period) => ({
          period,
          users: active.size,
          percentage: totalUsers > 0 ? (active.size / totalUsers) * 100 : 0
        }))
      }
    })

    return {
      cohorts: retentionData,
      summary: this.calculateRetentionSummary(retentionData)
    }
  }

  /**
   * Calculate churn rate
   * @param {Object} options - Calculation options
   * @returns {Object} Churn metrics
   */
  async calculateChurn(options = {}) {
    const { startDate, endDate, periodDays = 30 } = options

    const start = startDate ? new Date(startDate) : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
    const end = endDate ? new Date(endDate) : new Date()

    // Get active users by period
    const periods = []
    let currentPeriodStart = new Date(start)

    while (currentPeriodStart < end) {
      const currentPeriodEnd = new Date(currentPeriodStart)
      currentPeriodEnd.setDate(currentPeriodEnd.getDate() + periodDays)

      const activeUsers = new Set()

      for (const event of this.eventsCache) {
        const eventDate = new Date(event.timestamp)

        if (eventDate >= currentPeriodStart && eventDate < currentPeriodEnd && event.userId) {
          activeUsers.add(event.userId)
        }
      }

      periods.push({
        startDate: currentPeriodStart.toISOString(),
        endDate: currentPeriodEnd.toISOString(),
        activeUsers: activeUsers.size,
        users: Array.from(activeUsers)
      })

      currentPeriodStart = currentPeriodEnd
    }

    // Calculate churn between periods
    const churnData = []

    for (let i = 1; i < periods.length; i++) {
      const previousPeriod = periods[i - 1]
      const currentPeriod = periods[i]

      const previousUsers = new Set(previousPeriod.users)
      const currentUsers = new Set(currentPeriod.users)

      const churnedUsers = Array.from(previousUsers).filter(u => !currentUsers.has(u))
      const churnRate = previousUsers.size > 0
        ? (churnedUsers.length / previousUsers.size) * 100
        : 0

      churnData.push({
        period: i,
        startDate: currentPeriod.startDate,
        endDate: currentPeriod.endDate,
        previousActiveUsers: previousUsers.size,
        currentActiveUsers: currentUsers.size,
        churnedUsers: churnedUsers.length,
        churnRate
      })
    }

    return {
      periods: churnData,
      averageChurnRate: churnData.length > 0
        ? churnData.reduce((sum, p) => sum + p.churnRate, 0) / churnData.length
        : 0
    }
  }

  /**
   * Calculate Customer Lifetime Value (LTV)
   * @param {Object} options - Calculation options
   * @returns {Object} LTV metrics
   */
  async calculateLTV(options = {}) {
    const { revenueEventType = 'purchase', periodDays = 30 } = options

    // Get revenue events
    const revenueEvents = this.eventsCache.filter(e => e.eventType === revenueEventType)

    // Calculate revenue by user
    const userRevenue = new Map()
    const userFirstPurchase = new Map()
    const userLastPurchase = new Map()

    for (const event of revenueEvents) {
      const userId = event.userId
      if (!userId) continue

      const revenue = parseFloat(event.revenue || event.amount || 0)
      const eventDate = new Date(event.timestamp)

      // Update total revenue
      userRevenue.set(userId, (userRevenue.get(userId) || 0) + revenue)

      // Track first purchase
      if (!userFirstPurchase.has(userId) || eventDate < userFirstPurchase.get(userId)) {
        userFirstPurchase.set(userId, eventDate)
      }

      // Track last purchase
      if (!userLastPurchase.has(userId) || eventDate > userLastPurchase.get(userId)) {
        userLastPurchase.set(userId, eventDate)
      }
    }

    // Calculate average LTV
    const totalRevenue = Array.from(userRevenue.values()).reduce((sum, r) => sum + r, 0)
    const totalUsers = userRevenue.size
    const averageLTV = totalUsers > 0 ? totalRevenue / totalUsers : 0

    // Calculate average customer lifespan
    const lifespans = []

    for (const userId of userRevenue.keys()) {
      const first = userFirstPurchase.get(userId)
      const last = userLastPurchase.get(userId)

      if (first && last) {
        const lifespanDays = (last - first) / (1000 * 60 * 60 * 24)
        lifespans.push(lifespanDays)
      }
    }

    const averageLifespanDays = lifespans.length > 0
      ? lifespans.reduce((sum, l) => sum + l, 0) / lifespans.length
      : 0

    // Calculate LTV by cohort
    const cohortLTV = new Map()

    for (const [userId, firstPurchase] of userFirstPurchase.entries()) {
      const cohortKey = this.getCohortKey(firstPurchase)
      const revenue = userRevenue.get(userId) || 0

      if (!cohortLTV.has(cohortKey)) {
        cohortLTV.set(cohortKey, { totalRevenue: 0, users: 0 })
      }

      const cohort = cohortLTV.get(cohortKey)
      cohort.totalRevenue += revenue
      cohort.users += 1
    }

    const cohortData = Array.from(cohortLTV.entries()).map(([cohortDate, data]) => ({
      cohortDate,
      users: data.users,
      totalRevenue: data.totalRevenue,
      averageLTV: data.users > 0 ? data.totalRevenue / data.users : 0
    }))

    return {
      totalUsers,
      totalRevenue,
      averageLTV,
      averageLifespanDays,
      cohorts: cohortData
    }
  }

  /**
   * Create A/B test
   * @param {Object} test - A/B test configuration
   * @returns {Object} Created test
   */
  async createABTest(test) {
    const testData = {
      id: test.id || this.generateId(),
      name: test.name,
      description: test.description,
      variants: test.variants || ['A', 'B'],
      trafficAllocation: test.trafficAllocation || { A: 50, B: 50 },
      startDate: test.startDate || new Date().toISOString(),
      endDate: test.endDate,
      status: test.status || 'active',
      metrics: test.metrics || [],
      createdAt: new Date().toISOString()
    }

    this.abTests.set(testData.id, testData)
    await this.saveABTests()

    return testData
  }

  /**
   * Assign user to A/B test variant
   * @param {string} testId - Test ID
   * @param {string} userId - User ID
   * @returns {string} Assigned variant
   */
  getABTestVariant(testId, userId) {
    const test = this.abTests.get(testId)

    if (!test || test.status !== 'active') {
      return null
    }

    // Deterministic assignment based on user ID
    const hash = this.hashString(userId + testId)
    const variants = test.variants
    const allocation = test.trafficAllocation

    let cumulativePercent = 0
    const randomValue = hash % 100

    for (const variant of variants) {
      cumulativePercent += allocation[variant] || 0

      if (randomValue < cumulativePercent) {
        return variant
      }
    }

    return variants[0]
  }

  /**
   * Get A/B test results
   * @param {string} testId - Test ID
   * @returns {Object} Test results
   */
  async getABTestResults(testId) {
    const test = this.abTests.get(testId)

    if (!test) {
      throw new Error(`A/B test not found: ${testId}`)
    }

    // Get events for this test
    const testEvents = this.eventsCache.filter(e =>
      e.abTest === testId && e.variant
    )

    // Group by variant
    const variantResults = {}

    for (const variant of test.variants) {
      const variantEvents = testEvents.filter(e => e.variant === variant)
      const users = new Set(variantEvents.map(e => e.userId))

      // Calculate metrics
      const metrics = {}

      for (const metric of test.metrics) {
        const metricEvents = variantEvents.filter(e => e.eventType === metric.eventType)

        metrics[metric.name] = {
          total: metricEvents.length,
          uniqueUsers: new Set(metricEvents.map(e => e.userId)).size,
          conversionRate: users.size > 0 ? (new Set(metricEvents.map(e => e.userId)).size / users.size) * 100 : 0
        }
      }

      variantResults[variant] = {
        users: users.size,
        events: variantEvents.length,
        metrics
      }
    }

    return {
      test,
      results: variantResults,
      winner: this.calculateABTestWinner(variantResults, test.metrics[0]?.name)
    }
  }

  /**
   * Create or update feature flag
   * @param {Object} flag - Feature flag configuration
   * @returns {Object} Created/updated flag
   */
  async setFeatureFlag(flag) {
    const flagData = {
      id: flag.id || this.generateId(),
      name: flag.name,
      description: flag.description,
      enabled: flag.enabled !== undefined ? flag.enabled : false,
      rolloutPercentage: flag.rolloutPercentage || 0,
      targetUsers: flag.targetUsers || [],
      targetGroups: flag.targetGroups || [],
      createdAt: flag.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    this.featureFlags.set(flagData.id, flagData)
    await this.saveFeatureFlags()

    return flagData
  }

  /**
   * Check if feature is enabled for user
   * @param {string} flagId - Feature flag ID
   * @param {string} userId - User ID
   * @param {Array} userGroups - User groups
   * @returns {boolean} Is feature enabled
   */
  isFeatureEnabled(flagId, userId, userGroups = []) {
    const flag = this.featureFlags.get(flagId)

    if (!flag || !flag.enabled) {
      return false
    }

    // Check if user is explicitly targeted
    if (flag.targetUsers.includes(userId)) {
      return true
    }

    // Check if user's group is targeted
    if (flag.targetGroups.some(g => userGroups.includes(g))) {
      return true
    }

    // Check rollout percentage
    if (flag.rolloutPercentage > 0) {
      const hash = this.hashString(userId + flagId)
      return (hash % 100) < flag.rolloutPercentage
    }

    return false
  }

  /**
   * Get all feature flags
   * @returns {Array} Feature flags
   */
  async getFeatureFlags() {
    return Array.from(this.featureFlags.values())
  }

  /**
   * Export metrics to external system
   * @param {string} system - Target system (google-analytics, mixpanel, etc.)
   * @param {Object} options - Export options
   * @returns {Object} Export result
   */
  async exportMetrics(system, options = {}) {
    // This would integrate with actual external analytics systems
    // For now, return the data in the appropriate format

    const { startDate, endDate } = options
    const events = await this.getEvents({ startDate, endDate, limit: 10000 })

    const exportData = {
      system,
      timestamp: new Date().toISOString(),
      eventCount: events.events.length,
      events: events.events.map(e => this.formatEventForExport(e, system))
    }

    // Save export log
    const exportLog = {
      id: this.generateId(),
      system,
      timestamp: exportData.timestamp,
      eventCount: exportData.eventCount,
      status: 'completed'
    }

    // In a real implementation, this would send data to external APIs
    console.log(`Exported ${exportData.eventCount} events to ${system}`)

    return exportLog
  }

  // Helper methods

  getCohortKey(date) {
    const d = new Date(date)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }

  calculateRetentionSummary(retentionData) {
    if (retentionData.length === 0) {
      return { averageRetention: 0, periods: [] }
    }

    const periods = retentionData[0].retention.length
    const periodAverages = []

    for (let period = 0; period < periods; period++) {
      const percentages = retentionData.map(cohort => cohort.retention[period].percentage)
      const average = percentages.reduce((sum, p) => sum + p, 0) / percentages.length

      periodAverages.push({
        period,
        averageRetention: average
      })
    }

    return {
      averageRetention: periodAverages.length > 0 ? periodAverages[0].averageRetention : 0,
      periods: periodAverages
    }
  }

  calculateABTestWinner(results, metricName) {
    if (!metricName) return null

    let winner = null
    let maxValue = -Infinity

    for (const [variant, data] of Object.entries(results)) {
      const metricValue = data.metrics[metricName]?.conversionRate || 0

      if (metricValue > maxValue) {
        maxValue = metricValue
        winner = variant
      }
    }

    return winner
  }

  formatEventForExport(event, system) {
    // Format event for specific external system
    switch (system) {
      case 'google-analytics':
        return {
          client_id: event.userId,
          events: [{
            name: event.eventType,
            params: event.properties || {}
          }]
        }

      case 'mixpanel':
        return {
          event: event.eventType,
          properties: {
            distinct_id: event.userId,
            time: new Date(event.timestamp).getTime(),
            ...event.properties
          }
        }

      default:
        return event
    }
  }

  hashString(str) {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash
    }
    return Math.abs(hash)
  }

  generateId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  // File I/O methods

  async loadEvents() {
    try {
      const data = await fs.readFile(this.eventsFile, 'utf-8')
      this.eventsCache = JSON.parse(data)
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.error('Failed to load events:', error)
      }
      this.eventsCache = []
    }
  }

  async saveEvents() {
    try {
      await fs.writeFile(this.eventsFile, JSON.stringify(this.eventsCache, null, 2))
    } catch (error) {
      console.error('Failed to save events:', error)
      throw error
    }
  }

  async loadMetrics() {
    try {
      const data = await fs.readFile(this.metricsFile, 'utf-8')
      this.metricsCache = JSON.parse(data)
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.error('Failed to load metrics:', error)
      }
      this.metricsCache = {}
    }
  }

  async saveMetrics() {
    try {
      await fs.writeFile(this.metricsFile, JSON.stringify(this.metricsCache, null, 2))
    } catch (error) {
      console.error('Failed to save metrics:', error)
      throw error
    }
  }

  async loadABTests() {
    try {
      const data = await fs.readFile(this.abTestsFile, 'utf-8')
      const tests = JSON.parse(data)
      this.abTests = new Map(tests.map(t => [t.id, t]))
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.error('Failed to load A/B tests:', error)
      }
      this.abTests = new Map()
    }
  }

  async saveABTests() {
    try {
      const tests = Array.from(this.abTests.values())
      await fs.writeFile(this.abTestsFile, JSON.stringify(tests, null, 2))
    } catch (error) {
      console.error('Failed to save A/B tests:', error)
      throw error
    }
  }

  async loadFeatureFlags() {
    try {
      const data = await fs.readFile(this.featureFlagsFile, 'utf-8')
      const flags = JSON.parse(data)
      this.featureFlags = new Map(flags.map(f => [f.id, f]))
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.error('Failed to load feature flags:', error)
      }
      this.featureFlags = new Map()
    }
  }

  async saveFeatureFlags() {
    try {
      const flags = Array.from(this.featureFlags.values())
      await fs.writeFile(this.featureFlagsFile, JSON.stringify(flags, null, 2))
    } catch (error) {
      console.error('Failed to save feature flags:', error)
      throw error
    }
  }
}

export default BusinessMetricsService
