/**
 * Business Metrics Service Tests
 *
 * Comprehensive test suite for BusinessMetricsService
 * Tests event tracking, KPI calculations, A/B testing, and feature flags
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import BusinessMetricsService from '../BusinessMetricsService.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

describe('BusinessMetricsService', () => {
  let service
  let testDataDir

  beforeEach(async () => {
    // Create unique test data directory
    testDataDir = path.join(__dirname, `../../../data/test-business-metrics-${Date.now()}`)

    service = new BusinessMetricsService({ dataDir: testDataDir })
    await service.init()
  })

  afterEach(async () => {
    // Clean up test data directory
    try {
      await fs.rm(testDataDir, { recursive: true, force: true })
    } catch (error) {
      console.error('Failed to clean up test directory:', error)
    }
  })

  describe('Initialization', () => {
    it('should initialize successfully', async () => {
      expect(service.initialized).toBe(true)
    })

    it('should create data directory', async () => {
      const stats = await fs.stat(testDataDir)
      expect(stats.isDirectory()).toBe(true)
    })
  })

  describe('Event Tracking', () => {
    it('should track an event', async () => {
      const event = {
        userId: 'user123',
        eventType: 'page_view',
        properties: {
          page: '/home',
          referrer: 'google.com'
        }
      }

      const trackedEvent = await service.trackEvent(event)

      expect(trackedEvent).toBeDefined()
      expect(trackedEvent.id).toBeDefined()
      expect(trackedEvent.timestamp).toBeDefined()
      expect(trackedEvent.userId).toBe('user123')
      expect(trackedEvent.eventType).toBe('page_view')
    })

    it('should retrieve events with filters', async () => {
      // Track multiple events
      await service.trackEvent({ userId: 'user1', eventType: 'click' })
      await service.trackEvent({ userId: 'user2', eventType: 'page_view' })
      await service.trackEvent({ userId: 'user1', eventType: 'page_view' })

      // Get events for specific user
      const result = await service.getEvents({ userId: 'user1' })

      expect(result.total).toBe(2)
      expect(result.events).toHaveLength(2)
      expect(result.events.every(e => e.userId === 'user1')).toBe(true)
    })

    it('should filter events by type', async () => {
      await service.trackEvent({ userId: 'user1', eventType: 'click' })
      await service.trackEvent({ userId: 'user2', eventType: 'page_view' })
      await service.trackEvent({ userId: 'user3', eventType: 'click' })

      const result = await service.getEvents({ eventType: 'click' })

      expect(result.total).toBe(2)
      expect(result.events.every(e => e.eventType === 'click')).toBe(true)
    })

    it('should filter events by date range', async () => {
      const now = new Date()
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000)

      await service.trackEvent({ userId: 'user1', eventType: 'click' })

      const result = await service.getEvents({
        startDate: yesterday.toISOString(),
        endDate: tomorrow.toISOString()
      })

      expect(result.total).toBeGreaterThan(0)
    })
  })

  describe('Retention Calculation', () => {
    it('should calculate retention metrics', async () => {
      // Simulate user cohort over several weeks
      const baseDate = new Date('2025-01-01')

      // User first seen on Jan 1
      await service.trackEvent({
        userId: 'user1',
        eventType: 'signup',
        timestamp: baseDate.toISOString()
      })

      // User active on week 2
      const week2 = new Date(baseDate)
      week2.setDate(week2.getDate() + 7)
      await service.trackEvent({
        userId: 'user1',
        eventType: 'page_view',
        timestamp: week2.toISOString()
      })

      const retention = await service.calculateRetention({
        cohortStartDate: baseDate.toISOString(),
        periods: 4
      })

      expect(retention.cohorts).toBeDefined()
      expect(retention.summary).toBeDefined()
      expect(retention.cohorts.length).toBeGreaterThan(0)
    })

    it('should calculate retention summary', async () => {
      const baseDate = new Date('2025-01-01')

      // Create cohort
      for (let i = 0; i < 10; i++) {
        await service.trackEvent({
          userId: `user${i}`,
          eventType: 'signup',
          timestamp: baseDate.toISOString()
        })

        // 50% return after week 1
        if (i < 5) {
          const week1 = new Date(baseDate)
          week1.setDate(week1.getDate() + 7)
          await service.trackEvent({
            userId: `user${i}`,
            eventType: 'page_view',
            timestamp: week1.toISOString()
          })
        }
      }

      const retention = await service.calculateRetention({
        cohortStartDate: baseDate.toISOString(),
        periods: 2
      })

      expect(retention.summary.periods).toHaveLength(2)
      expect(retention.summary.periods[0].averageRetention).toBeGreaterThan(0)
    })
  })

  describe('Churn Calculation', () => {
    it('should calculate churn rate', async () => {
      const startDate = new Date('2025-01-01')

      // Period 1: 10 active users
      for (let i = 0; i < 10; i++) {
        await service.trackEvent({
          userId: `user${i}`,
          eventType: 'page_view',
          timestamp: startDate.toISOString()
        })
      }

      // Period 2: Only 8 users return (2 churned)
      const period2 = new Date(startDate)
      period2.setDate(period2.getDate() + 30)

      for (let i = 0; i < 8; i++) {
        await service.trackEvent({
          userId: `user${i}`,
          eventType: 'page_view',
          timestamp: period2.toISOString()
        })
      }

      const churn = await service.calculateChurn({
        startDate: startDate.toISOString(),
        endDate: period2.toISOString(),
        periodDays: 30
      })

      expect(churn.periods).toBeDefined()
      expect(churn.averageChurnRate).toBeGreaterThanOrEqual(0)
    })
  })

  describe('LTV Calculation', () => {
    it('should calculate customer lifetime value', async () => {
      // Simulate purchases
      await service.trackEvent({
        userId: 'user1',
        eventType: 'purchase',
        revenue: 100
      })

      await service.trackEvent({
        userId: 'user1',
        eventType: 'purchase',
        revenue: 50
      })

      await service.trackEvent({
        userId: 'user2',
        eventType: 'purchase',
        revenue: 200
      })

      const ltv = await service.calculateLTV()

      expect(ltv.totalUsers).toBe(2)
      expect(ltv.totalRevenue).toBe(350)
      expect(ltv.averageLTV).toBe(175) // 350 / 2
    })

    it('should calculate LTV by cohort', async () => {
      const baseDate = new Date('2025-01-01')

      await service.trackEvent({
        userId: 'user1',
        eventType: 'purchase',
        revenue: 100,
        timestamp: baseDate.toISOString()
      })

      await service.trackEvent({
        userId: 'user2',
        eventType: 'purchase',
        revenue: 200,
        timestamp: baseDate.toISOString()
      })

      const ltv = await service.calculateLTV()

      expect(ltv.cohorts).toBeDefined()
      expect(ltv.cohorts.length).toBeGreaterThan(0)
    })
  })

  describe('A/B Testing', () => {
    it('should create an A/B test', async () => {
      const test = {
        name: 'Button Color Test',
        description: 'Test blue vs green button',
        variants: ['blue', 'green'],
        trafficAllocation: { blue: 50, green: 50 }
      }

      const createdTest = await service.createABTest(test)

      expect(createdTest.id).toBeDefined()
      expect(createdTest.name).toBe('Button Color Test')
      expect(createdTest.variants).toEqual(['blue', 'green'])
      expect(createdTest.status).toBe('active')
    })

    it('should assign users to variants deterministically', async () => {
      const test = await service.createABTest({
        name: 'Test',
        variants: ['A', 'B'],
        trafficAllocation: { A: 50, B: 50 }
      })

      const variant1 = service.getABTestVariant(test.id, 'user1')
      const variant2 = service.getABTestVariant(test.id, 'user1')

      // Same user should get same variant
      expect(variant1).toBe(variant2)
    })

    it('should get A/B test results', async () => {
      const test = await service.createABTest({
        name: 'Test',
        variants: ['A', 'B'],
        trafficAllocation: { A: 50, B: 50 },
        metrics: [{ name: 'conversion', eventType: 'purchase' }]
      })

      // Track some test events
      await service.trackEvent({
        userId: 'user1',
        eventType: 'page_view',
        abTest: test.id,
        variant: 'A'
      })

      await service.trackEvent({
        userId: 'user1',
        eventType: 'purchase',
        abTest: test.id,
        variant: 'A'
      })

      await service.trackEvent({
        userId: 'user2',
        eventType: 'page_view',
        abTest: test.id,
        variant: 'B'
      })

      const results = await service.getABTestResults(test.id)

      expect(results.test).toBeDefined()
      expect(results.results).toBeDefined()
      expect(results.results.A).toBeDefined()
      expect(results.results.B).toBeDefined()
    })
  })

  describe('Feature Flags', () => {
    it('should create a feature flag', async () => {
      const flag = {
        name: 'new_dashboard',
        description: 'New dashboard redesign',
        enabled: true,
        rolloutPercentage: 50
      }

      const createdFlag = await service.setFeatureFlag(flag)

      expect(createdFlag.id).toBeDefined()
      expect(createdFlag.name).toBe('new_dashboard')
      expect(createdFlag.enabled).toBe(true)
      expect(createdFlag.rolloutPercentage).toBe(50)
    })

    it('should check if feature is enabled for user', async () => {
      const flag = await service.setFeatureFlag({
        name: 'test_feature',
        enabled: true,
        targetUsers: ['user1', 'user2']
      })

      const isEnabledForUser1 = service.isFeatureEnabled(flag.id, 'user1')
      const isEnabledForUser3 = service.isFeatureEnabled(flag.id, 'user3')

      expect(isEnabledForUser1).toBe(true)
      expect(isEnabledForUser3).toBe(false)
    })

    it('should check feature enabled by group', async () => {
      const flag = await service.setFeatureFlag({
        name: 'test_feature',
        enabled: true,
        targetGroups: ['beta_testers']
      })

      const isEnabled = service.isFeatureEnabled(flag.id, 'user1', ['beta_testers'])

      expect(isEnabled).toBe(true)
    })

    it('should respect rollout percentage', async () => {
      const flag = await service.setFeatureFlag({
        name: 'test_feature',
        enabled: true,
        rolloutPercentage: 0
      })

      const isEnabled = service.isFeatureEnabled(flag.id, 'user1')

      expect(isEnabled).toBe(false)
    })

    it('should return false for disabled flags', async () => {
      const flag = await service.setFeatureFlag({
        name: 'test_feature',
        enabled: false,
        rolloutPercentage: 100
      })

      const isEnabled = service.isFeatureEnabled(flag.id, 'user1')

      expect(isEnabled).toBe(false)
    })

    it('should get all feature flags', async () => {
      await service.setFeatureFlag({ name: 'flag1', enabled: true })
      await service.setFeatureFlag({ name: 'flag2', enabled: false })

      const flags = await service.getFeatureFlags()

      expect(flags).toHaveLength(2)
      expect(flags.some(f => f.name === 'flag1')).toBe(true)
      expect(flags.some(f => f.name === 'flag2')).toBe(true)
    })
  })

  describe('Export Metrics', () => {
    it('should export metrics to external system', async () => {
      await service.trackEvent({
        userId: 'user1',
        eventType: 'page_view'
      })

      const result = await service.exportMetrics('google-analytics')

      expect(result.system).toBe('google-analytics')
      expect(result.eventCount).toBeGreaterThan(0)
      expect(result.status).toBe('completed')
    })

    it('should format events for Google Analytics', async () => {
      const event = {
        userId: 'user1',
        eventType: 'page_view',
        properties: { page: '/home' },
        timestamp: new Date().toISOString()
      }

      const formatted = service.formatEventForExport(event, 'google-analytics')

      expect(formatted.client_id).toBe('user1')
      expect(formatted.events).toBeDefined()
      expect(formatted.events[0].name).toBe('page_view')
    })

    it('should format events for Mixpanel', async () => {
      const event = {
        userId: 'user1',
        eventType: 'page_view',
        properties: { page: '/home' },
        timestamp: new Date().toISOString()
      }

      const formatted = service.formatEventForExport(event, 'mixpanel')

      expect(formatted.event).toBe('page_view')
      expect(formatted.properties.distinct_id).toBe('user1')
      expect(formatted.properties.time).toBeDefined()
    })
  })

  describe('Helper Methods', () => {
    it('should generate unique IDs', () => {
      const id1 = service.generateId()
      const id2 = service.generateId()

      expect(id1).not.toBe(id2)
      expect(id1).toMatch(/^\d+-[a-z0-9]+$/)
    })

    it('should hash strings consistently', () => {
      const hash1 = service.hashString('test')
      const hash2 = service.hashString('test')

      expect(hash1).toBe(hash2)
      expect(typeof hash1).toBe('number')
    })

    it('should generate cohort keys', () => {
      const date = new Date('2025-01-15')
      const key = service.getCohortKey(date)

      expect(key).toBe('2025-01-15')
    })
  })

  describe('Data Persistence', () => {
    it('should persist events to file', async () => {
      await service.trackEvent({ userId: 'user1', eventType: 'click' })

      // Wait for async save
      await new Promise(resolve => setTimeout(resolve, 100))

      const eventsFile = path.join(testDataDir, 'events.json')
      const data = await fs.readFile(eventsFile, 'utf-8')
      const events = JSON.parse(data)

      expect(events).toHaveLength(1)
      expect(events[0].userId).toBe('user1')
    })

    it('should load events from file on init', async () => {
      // Create events file
      const eventsFile = path.join(testDataDir, 'events.json')
      const events = [{
        id: '123',
        userId: 'user1',
        eventType: 'click',
        timestamp: new Date().toISOString()
      }]

      await fs.writeFile(eventsFile, JSON.stringify(events))

      // Create new service instance
      const newService = new BusinessMetricsService({ dataDir: testDataDir })
      await newService.init()

      const result = await newService.getEvents()

      expect(result.total).toBe(1)
      expect(result.events[0].userId).toBe('user1')
    })
  })
})
