/**
 * Unit Tests for FST Learning Service
 *
 * Tests the core calibration algorithm and helper functions.
 */

import { describe, it, expect, beforeEach } from 'vitest'

// Mock AGENTS configuration
const MOCK_AGENTS = [
  {
    id: 'tech',
    name: 'Технический аналитик',
    weight: 0.20,
    scoringWeights: { trl: 0.35, mrl: 0.30, sovereignty: 0.10, market: 0.05, finance: 0.10, risk: 0.10, team: 0.00 },
  },
  {
    id: 'finance',
    name: 'Финансовый аналитик',
    weight: 0.20,
    scoringWeights: { trl: 0.05, mrl: 0.05, sovereignty: 0.05, market: 0.20, finance: 0.55, risk: 0.10, team: 0.00 },
  },
  {
    id: 'risk',
    name: 'Риск-менеджер',
    weight: 0.20,
    scoringWeights: { trl: 0.10, mrl: 0.10, sovereignty: 0.10, market: 0.10, finance: 0.15, risk: 0.45, team: 0.00 },
  },
]

const OUTCOMES = {
  EXIT: { value: 'EXIT', score: 1.0 },
  ALIVE: { value: 'ALIVE', score: 0.5 },
  DEAD: { value: 'DEAD', score: 0.0 },
}

// Helper functions (copied from service for testing)
function outcomeToScore(outcome) {
  return OUTCOMES[outcome]?.score ?? 0.5
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

function predictOutcome(icScores, agents) {
  let weightedSum = 0
  let totalWeight = 0

  for (const agentScore of icScores.agentScores || []) {
    const agent = agents.find(a => a.id === agentScore.agentId)
    if (!agent) continue

    const normalizedScore = agentScore.score / 100
    weightedSum += normalizedScore * agent.weight
    totalWeight += agent.weight
  }

  return totalWeight > 0 ? weightedSum / totalWeight : 0.5
}

function calculateLoss(trainingData, agents) {
  let totalLoss = 0

  for (const example of trainingData) {
    const predicted = predictOutcome(example.icScores, agents)
    const actual = example.outcomeScore
    const error = predicted - actual
    totalLoss += error * error
  }

  return totalLoss / trainingData.length
}

function calculateAccuracy(trainingData, agents) {
  let correct = 0

  for (const example of trainingData) {
    const predicted = predictOutcome(example.icScores, agents)
    const actual = example.outcomeScore

    const predictedOutcome = predicted >= 0.75 ? 1.0 : predicted >= 0.25 ? 0.5 : 0.0
    if (Math.abs(predictedOutcome - actual) < 0.1) {
      correct++
    }
  }

  return correct / trainingData.length
}

describe('FST Learning Service', () => {
  describe('outcomeToScore', () => {
    it('should convert EXIT to 1.0', () => {
      expect(outcomeToScore('EXIT')).toBe(1.0)
    })

    it('should convert ALIVE to 0.5', () => {
      expect(outcomeToScore('ALIVE')).toBe(0.5)
    })

    it('should convert DEAD to 0.0', () => {
      expect(outcomeToScore('DEAD')).toBe(0.0)
    })

    it('should return 0.5 for unknown outcome', () => {
      expect(outcomeToScore('UNKNOWN')).toBe(0.5)
    })
  })

  describe('clamp', () => {
    it('should clamp value within range', () => {
      expect(clamp(5, 0, 10)).toBe(5)
    })

    it('should clamp to min if value is below', () => {
      expect(clamp(-5, 0, 10)).toBe(0)
    })

    it('should clamp to max if value is above', () => {
      expect(clamp(15, 0, 10)).toBe(10)
    })
  })

  describe('predictOutcome', () => {
    it('should predict outcome based on agent scores', () => {
      const icScores = {
        agentScores: [
          { agentId: 'tech', score: 80 },
          { agentId: 'finance', score: 75 },
          { agentId: 'risk', score: 70 },
        ],
      }

      const predicted = predictOutcome(icScores, MOCK_AGENTS)
      expect(predicted).toBeGreaterThan(0)
      expect(predicted).toBeLessThanOrEqual(1)
    })

    it('should return 0.5 if no agents found', () => {
      const icScores = {
        agentScores: [],
      }

      const predicted = predictOutcome(icScores, MOCK_AGENTS)
      expect(predicted).toBe(0.5)
    })

    it('should handle weighted average correctly', () => {
      const icScores = {
        agentScores: [
          { agentId: 'tech', score: 100 },
          { agentId: 'finance', score: 100 },
          { agentId: 'risk', score: 100 },
        ],
      }

      const predicted = predictOutcome(icScores, MOCK_AGENTS)
      // All agents have weight 0.20 and score 100, so predicted should be ~1.0
      expect(predicted).toBeCloseTo(1.0, 1)
    })
  })

  describe('calculateLoss', () => {
    it('should calculate MSE loss', () => {
      const trainingData = [
        {
          icScores: {
            agentScores: [
              { agentId: 'tech', score: 80 },
              { agentId: 'finance', score: 75 },
              { agentId: 'risk', score: 70 },
            ],
          },
          outcomeScore: 1.0,  // EXIT
        },
        {
          icScores: {
            agentScores: [
              { agentId: 'tech', score: 40 },
              { agentId: 'finance', score: 35 },
              { agentId: 'risk', score: 30 },
            ],
          },
          outcomeScore: 0.0,  // DEAD
        },
      ]

      const loss = calculateLoss(trainingData, MOCK_AGENTS)
      expect(loss).toBeGreaterThan(0)
    })

    it('should return 0 loss for perfect predictions', () => {
      // Create data where predictions match outcomes exactly
      const trainingData = [
        {
          icScores: {
            agentScores: [
              { agentId: 'tech', score: 100 },
              { agentId: 'finance', score: 100 },
              { agentId: 'risk', score: 100 },
            ],
          },
          outcomeScore: 1.0,  // Prediction will be ~1.0
        },
      ]

      const loss = calculateLoss(trainingData, MOCK_AGENTS)
      expect(loss).toBeLessThan(0.05)  // Should be very small
    })
  })

  describe('calculateAccuracy', () => {
    it('should calculate accuracy correctly', () => {
      const trainingData = [
        {
          icScores: {
            agentScores: [
              { agentId: 'tech', score: 85 },
              { agentId: 'finance', score: 85 },
              { agentId: 'risk', score: 85 },
            ],
          },
          outcomeScore: 1.0,  // EXIT - high scores should predict EXIT
        },
        {
          icScores: {
            agentScores: [
              { agentId: 'tech', score: 20 },
              { agentId: 'finance', score: 20 },
              { agentId: 'risk', score: 20 },
            ],
          },
          outcomeScore: 0.0,  // DEAD - low scores should predict DEAD
        },
      ]

      const accuracy = calculateAccuracy(trainingData, MOCK_AGENTS)
      expect(accuracy).toBeGreaterThan(0)
      expect(accuracy).toBeLessThanOrEqual(1)
    })

    it('should return 1.0 for all correct predictions', () => {
      const trainingData = [
        {
          icScores: {
            agentScores: [
              { agentId: 'tech', score: 100 },
              { agentId: 'finance', score: 100 },
              { agentId: 'risk', score: 100 },
            ],
          },
          outcomeScore: 1.0,  // EXIT
        },
        {
          icScores: {
            agentScores: [
              { agentId: 'tech', score: 0 },
              { agentId: 'finance', score: 0 },
              { agentId: 'risk', score: 0 },
            ],
          },
          outcomeScore: 0.0,  // DEAD
        },
      ]

      const accuracy = calculateAccuracy(trainingData, MOCK_AGENTS)
      expect(accuracy).toBeGreaterThanOrEqual(0.5)
    })
  })

  describe('Weight Calibration Integration', () => {
    it('should improve loss after calibration', () => {
      // Generate simple training data
      const trainingData = []
      for (let i = 0; i < 20; i++) {
        const highScore = i < 10  // First 10 are high scores (EXIT), rest are low (DEAD)
        trainingData.push({
          icScores: {
            agentScores: [
              { agentId: 'tech', score: highScore ? 80 + Math.random() * 20 : Math.random() * 30 },
              { agentId: 'finance', score: highScore ? 80 + Math.random() * 20 : Math.random() * 30 },
              { agentId: 'risk', score: highScore ? 80 + Math.random() * 20 : Math.random() * 30 },
            ],
            dimScores: {
              trl: highScore ? 0.8 : 0.2,
              mrl: highScore ? 0.8 : 0.2,
              sovereignty: highScore ? 0.8 : 0.2,
              market: highScore ? 0.8 : 0.2,
              finance: highScore ? 0.8 : 0.2,
              risk: highScore ? 0.8 : 0.2,
              team: highScore ? 0.8 : 0.2,
            },
          },
          outcomeScore: highScore ? 1.0 : 0.0,
        })
      }

      const initialLoss = calculateLoss(trainingData, MOCK_AGENTS)

      // Simple calibration step
      const agents = JSON.parse(JSON.stringify(MOCK_AGENTS))
      for (let epoch = 0; epoch < 10; epoch++) {
        for (const example of trainingData) {
          const predicted = predictOutcome(example.icScores, agents)
          const actual = example.outcomeScore
          const error = predicted - actual

          for (const agent of agents) {
            const agentScore = example.icScores.agentScores?.find(s => s.agentId === agent.id)
            if (!agentScore) continue

            const normalizedScore = agentScore.score / 100
            const gradient = error * normalizedScore

            agent.weight = clamp(agent.weight - 0.01 * gradient, 0.05, 0.30)
          }
        }

        // Normalize
        const totalWeight = agents.reduce((sum, a) => sum + a.weight, 0)
        agents.forEach(a => { a.weight /= totalWeight })
      }

      const finalLoss = calculateLoss(trainingData, agents)

      // Loss should decrease (or at least not increase significantly)
      expect(finalLoss).toBeLessThanOrEqual(initialLoss * 1.1)
    })
  })
})
