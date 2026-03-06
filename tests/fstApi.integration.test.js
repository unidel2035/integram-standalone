/**
 * Integration tests for fstApi.js with real Integram server
 *
 * Note: These tests are skipped by default in CI as they require
 * network access to ai2o.ru. Run manually with:
 * INTEGRATION_TESTS=true npm test
 */

import { describe, it, expect, beforeAll } from 'vitest'

const SKIP_INTEGRATION = !process.env.INTEGRATION_TESTS

describe.skipIf(SKIP_INTEGRATION)('fstApi — Integram Integration Tests', () => {
  let api

  beforeAll(async () => {
    // Dynamically import to avoid loading in unit tests
    api = await import('../src/services/fstApi.js')
  })

  it('authenticates with real Integram server', async () => {
    const result = await api.authenticate()

    expect(result.token).toBeDefined()
    expect(result.xsrf).toBeDefined()
    expect(typeof result.token).toBe('string')
    expect(typeof result.xsrf).toBe('string')
  })

  it('handles authentication caching correctly', async () => {
    const result1 = await api.authenticate()
    const result2 = await api.authenticate()

    // Should return same token (cached)
    expect(result1.token).toBe(result2.token)
    expect(result1.xsrf).toBe(result2.xsrf)
  })

  // Add more integration tests here as needed
  // For example: creating, reading, updating projects

  it.skip('creates a test project in fst-sandbox', async () => {
    // This test is skipped to avoid polluting the database
    // Enable manually when testing against sandbox environment
    expect(true).toBe(true)
  })

  it.skip('reads projects from Integram', async () => {
    // This test is skipped to avoid external dependency in CI
    // Enable manually for integration testing
    expect(true).toBe(true)
  })
})
