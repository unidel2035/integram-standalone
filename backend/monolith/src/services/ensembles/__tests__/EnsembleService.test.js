/**
 * Unit Tests for EnsembleService
 *
 * Issue #3114 - Phase 2: Ensemble Deployment
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import EnsembleService from '../EnsembleService.js'

describe('EnsembleService', () => {
  let ensembleService
  let mockLogger

  beforeEach(() => {
    mockLogger = {
      log: vi.fn(),
      error: vi.fn()
    }

    ensembleService = new EnsembleService({ logger: mockLogger })
  })

  describe('getAllEnsembles', () => {
    it('should return all available ensembles', async () => {
      // Mock initialize
      ensembleService.initialized = true

      const ensembles = await ensembleService.getAllEnsembles()

      expect(ensembles).toBeDefined()
      expect(Array.isArray(ensembles)).toBe(true)
      expect(ensembles.length).toBeGreaterThan(0)

      // Check ensemble structure
      const firstEnsemble = ensembles[0]
      expect(firstEnsemble).toHaveProperty('id')
      expect(firstEnsemble).toHaveProperty('name')
      expect(firstEnsemble).toHaveProperty('description')
      expect(firstEnsemble).toHaveProperty('icon')
      expect(firstEnsemble).toHaveProperty('category')
      expect(firstEnsemble).toHaveProperty('agentCount')
    })

    it('should include all 4 default ensembles', async () => {
      ensembleService.initialized = true

      const ensembles = await ensembleService.getAllEnsembles()
      const ensembleIds = ensembles.map(e => e.id)

      expect(ensembleIds).toContain('it-companies')
      expect(ensembleIds).toContain('ecommerce')
      expect(ensembleIds).toContain('telecom')
      expect(ensembleIds).toContain('hr')
    })
  })

  describe('getEnsemble', () => {
    it('should return ensemble details by ID', async () => {
      ensembleService.initialized = true

      const ensemble = await ensembleService.getEnsemble('it-companies')

      expect(ensemble).toBeDefined()
      expect(ensemble.id).toBe('it-companies')
      expect(ensemble.name).toBeDefined()
      expect(ensemble.agents).toBeDefined()
      expect(Array.isArray(ensemble.agents)).toBe(true)
    })

    it('should throw error for non-existent ensemble', async () => {
      ensembleService.initialized = true

      await expect(
        ensembleService.getEnsemble('non-existent')
      ).rejects.toThrow('Ensemble not found')
    })

    it('should return complete ensemble structure', async () => {
      ensembleService.initialized = true

      const ensemble = await ensembleService.getEnsemble('it-companies')

      expect(ensemble).toHaveProperty('id')
      expect(ensemble).toHaveProperty('name')
      expect(ensemble).toHaveProperty('description')
      expect(ensemble).toHaveProperty('agents')
      expect(ensemble).toHaveProperty('onboardingSteps')
      expect(ensemble).toHaveProperty('features')
    })
  })

  describe('getEnsemblesByCategory', () => {
    it('should filter ensembles by category', async () => {
      ensembleService.initialized = true

      const itEnsembles = await ensembleService.getEnsemblesByCategory('it')

      expect(itEnsembles).toBeDefined()
      expect(Array.isArray(itEnsembles)).toBe(true)
      expect(itEnsembles.length).toBeGreaterThan(0)

      // All returned ensembles should be IT category
      itEnsembles.forEach(ensemble => {
        expect(ensemble.category).toBe('it')
      })
    })

    it('should return empty array for non-matching category', async () => {
      ensembleService.initialized = true

      const ensembles = await ensembleService.getEnsemblesByCategory('non-existent-category')

      expect(ensembles).toBeDefined()
      expect(Array.isArray(ensembles)).toBe(true)
      expect(ensembles.length).toBe(0)
    })
  })

  describe('Ensemble Definitions', () => {
    it('IT Companies ensemble should have correct structure', async () => {
      ensembleService.initialized = true

      const ensemble = await ensembleService.getEnsemble('it-companies')

      expect(ensemble.id).toBe('it-companies')
      expect(ensemble.category).toBe('it')
      expect(ensemble.agents.length).toBeGreaterThan(0)

      // Check agent structure
      ensemble.agents.forEach(agent => {
        expect(agent).toHaveProperty('agentId')
        expect(agent).toHaveProperty('order')
        expect(typeof agent.order).toBe('number')
      })
    })

    it('E-commerce ensemble should have correct structure', async () => {
      ensembleService.initialized = true

      const ensemble = await ensembleService.getEnsemble('ecommerce')

      expect(ensemble.id).toBe('ecommerce')
      expect(ensemble.category).toBe('ecommerce')
      expect(ensemble.agents.length).toBeGreaterThan(0)
    })

    it('Telecom ensemble should have correct structure', async () => {
      ensembleService.initialized = true

      const ensemble = await ensembleService.getEnsemble('telecom')

      expect(ensemble.id).toBe('telecom')
      expect(ensemble.category).toBe('telecom')
      expect(ensemble.agents.length).toBeGreaterThan(0)
    })

    it('HR ensemble should have correct structure', async () => {
      ensembleService.initialized = true

      const ensemble = await ensembleService.getEnsemble('hr')

      expect(ensemble.id).toBe('hr')
      expect(ensemble.category).toBe('hr')
      expect(ensemble.agents.length).toBeGreaterThan(0)
    })
  })
})
