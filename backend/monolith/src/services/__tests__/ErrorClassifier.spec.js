// ErrorClassifier.spec.js - Unit tests for ErrorClassifier
// Issue #5306 - Robust Error Recovery: Circuit Breaker & Self-Healing

import { describe, it, expect, beforeEach } from 'vitest'
import { ErrorClassifier, ErrorCategory } from '../ErrorClassifier.js'

describe('ErrorClassifier', () => {
  let classifier

  beforeEach(() => {
    classifier = new ErrorClassifier()
  })

  describe('classify()', () => {
    it('should classify network timeout as TRANSIENT', () => {
      const error = new Error('ETIMEDOUT')
      error.code = 'ETIMEDOUT'

      const classification = classifier.classify(error)

      expect(classification.category).toBe(ErrorCategory.TRANSIENT)
      expect(classification.confidence).toBe('high')
      expect(classification.metadata.isRetriable).toBe(true)
    })

    it('should classify rate limit error as RATE_LIMIT', () => {
      const error = new Error('Too many requests')
      const context = { statusCode: 429 }

      const classification = classifier.classify(error, context)

      expect(classification.category).toBe(ErrorCategory.RATE_LIMIT)
      expect(classification.metadata.requiresBackoff).toBe(true)
    })

    it('should classify 404 as PERMANENT', () => {
      const error = new Error('Not found')
      error.statusCode = 404

      const classification = classifier.classify(error)

      expect(classification.category).toBe(ErrorCategory.PERMANENT)
      expect(classification.metadata.isRetriable).toBe(false)
    })

    it('should classify out of memory as RESOURCE', () => {
      const error = new Error('Out of memory')
      error.code = 'ENOMEM'

      const classification = classifier.classify(error)

      expect(classification.category).toBe(ErrorCategory.RESOURCE)
      expect(classification.metadata.requiresResourceCleanup).toBe(true)
    })

    it('should classify unknown error as UNKNOWN with conservative retry', () => {
      const error = new Error('Some weird error')

      const classification = classifier.classify(error)

      expect(classification.category).toBe(ErrorCategory.UNKNOWN)
      expect(classification.confidence).toBe('low')
      expect(classification.metadata.isRetriable).toBe(true) // Conservative
      expect(classification.metadata.requiresBackoff).toBe(true)
    })

    it('should track error statistics', () => {
      const error1 = new Error('ETIMEDOUT')
      error1.code = 'ETIMEDOUT'

      const error2 = new Error('Not found')
      error2.statusCode = 404

      classifier.classify(error1)
      classifier.classify(error2)

      const stats = classifier.getStats()
      expect(stats.totalClassifications).toBe(2)
      expect(stats.byCategory[ErrorCategory.TRANSIENT]).toBe(1)
      expect(stats.byCategory[ErrorCategory.PERMANENT]).toBe(1)
    })
  })

  describe('isRetriable()', () => {
    it('should return true for transient errors', () => {
      const error = new Error('Connection refused')
      error.code = 'ECONNREFUSED'

      expect(classifier.isRetriable(error)).toBe(true)
    })

    it('should return false for permanent errors', () => {
      const error = new Error('Bad request')
      error.statusCode = 400

      expect(classifier.isRetriable(error)).toBe(false)
    })
  })

  describe('getRetryDelay()', () => {
    it('should return exponential backoff for rate limit errors', () => {
      const error = new Error('Rate limited')
      error.statusCode = 429

      const delay0 = classifier.getRetryDelay(error, 0)
      const delay1 = classifier.getRetryDelay(error, 1)
      const delay2 = classifier.getRetryDelay(error, 2)

      expect(delay1).toBe(delay0 * 2)
      expect(delay2).toBe(delay0 * 4)
    })

    it('should return Infinity for permanent errors', () => {
      const error = new Error('Not found')
      error.statusCode = 404

      const delay = classifier.getRetryDelay(error, 0)

      expect(delay).toBe(Infinity)
    })

    it('should respect maximum delay caps', () => {
      const error = new Error('Rate limited')
      error.statusCode = 429

      // Very high attempt number
      const delay = classifier.getRetryDelay(error, 100)

      expect(delay).toBeLessThanOrEqual(60000) // Max 60s
    })
  })

  describe('resetStats()', () => {
    it('should clear all statistics', () => {
      const error = new Error('ETIMEDOUT')
      error.code = 'ETIMEDOUT'

      classifier.classify(error)
      classifier.resetStats()

      const stats = classifier.getStats()
      expect(stats.totalClassifications).toBe(0)
      expect(stats.byCategory[ErrorCategory.TRANSIENT]).toBe(0)
      expect(stats.topErrors).toEqual([])
    })
  })
})
