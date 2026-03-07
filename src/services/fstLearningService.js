/**
 * FST Learning Service — Neuro-cognitive core for IC weight calibration
 *
 * Issue #12: Self-learning investment committee that improves agent scoring
 * weights based on real deal outcomes (alive/dead/exit after 3 years).
 *
 * Features:
 * - Training data management (CRUD)
 * - Weight calibration via simple logistic regression
 * - Accuracy analysis (predicted vs actual outcomes)
 * - Agent performance metrics
 *
 * Database: Integram fst, TrainingData table (typeId: 1250)
 */

import { integramApiClient } from './integramApiClient'
import { AGENTS, SCORING_DIMS } from '@/components/fst-committee/FstCommitteeConfig.js'

const DATABASE = 'fst'
const TRAINING_DATA_TYPE_ID = 1250  // TrainingData table

// Requisite IDs for TrainingData table
const REQ_OUTCOME_RESULT = 1251       // ALIVE / DEAD / EXIT
const REQ_IC_SCORES_JSON = 1252       // Full IC + actual metrics JSON
const REQ_DATES = 1253                // Outcome date, training date
const REQ_IRR_VALUES = 1254           // IRR predicted, IRR actual
const REQ_PROJECT_REF = 1255          // REF → Projects (1155)
const REQ_IC_DECISION_REF = 1256      // REF → IC Decisions (1160)
const REQ_USED_IN_TRAINING = 1257     // Boolean: 1=used, 0=pending

/**
 * Outcome enum mapping
 */
export const OUTCOMES = {
  EXIT: { value: 'EXIT', score: 1.0, label: 'Выход (EXIT)', color: '#4caf50' },
  ALIVE: { value: 'ALIVE', score: 0.5, label: 'Работает', color: '#ffa726' },
  DEAD: { value: 'DEAD', score: 0.0, label: 'Закрыт', color: '#ef5350' },
}

/**
 * Convert outcome string to numeric score for training
 */
function outcomeToScore(outcome) {
  return OUTCOMES[outcome]?.score ?? 0.5
}

/**
 * Normalize weights to sum to 1.0
 */
function normalizeWeights(weights) {
  const sum = weights.reduce((acc, w) => acc + w, 0)
  return weights.map(w => w / sum)
}

/**
 * Clamp value between min and max
 */
function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

// ────────────────────────────────────────────────────────────────
// Training Data CRUD
// ────────────────────────────────────────────────────────────────

/**
 * Add training example to database
 *
 * @param {Object} data
 * @param {string} data.projectId - Integram ID of project
 * @param {string} data.icDecisionId - Integram ID of IC decision
 * @param {string} data.outcome - EXIT / ALIVE / DEAD
 * @param {number} data.actualIRR - Actual IRR achieved
 * @param {string} data.outcomeDate - Date outcome measured (YYYY-MM-DD)
 * @param {Object} data.finalMetrics - Final project metrics
 * @param {string} data.reasonForOutcome - Why this outcome happened
 * @returns {Promise<Object>} Created training data record
 */
export async function addTrainingExample(data) {
  try {
    // Fetch IC decision to get scores
    const icDecision = await integramApiClient.getRecord(DATABASE, data.icDecisionId)
    if (!icDecision) {
      throw new Error(`IC Decision ${data.icDecisionId} not found`)
    }

    // Parse IC decision protocol JSON (from req 1162)
    const protocolJSON = icDecision.requisites.find(r => r.reqId === 1162)?.value
    const protocol = protocolJSON ? JSON.parse(protocolJSON) : {}

    // Build combined JSON with IC scores + actual outcome
    const combinedData = {
      icScores: {
        aggregatedScore: protocol.decision?.aggregatedScore || 0,
        agentScores: protocol.votes || [],
        dimScores: protocol.decision?.dimScores || {},
        policyParams: protocol.policy || {},
      },
      actualOutcome: {
        outcome: data.outcome,
        actualIRR: data.actualIRR,
        predictedIRR: protocol.decision?.predictedIRR || 0,
        yearsToOutcome: data.yearsToOutcome || 3,
        exitMultiple: data.exitMultiple || 0,
        finalMetrics: data.finalMetrics || {},
        reasonForOutcome: data.reasonForOutcome || '',
        dateRecorded: new Date().toISOString(),
      },
    }

    // Create training data record in Integram
    const formData = new URLSearchParams()
    formData.append(`t${TRAINING_DATA_TYPE_ID}`, `Training_${data.projectId}_${Date.now()}`)
    formData.append(`t${REQ_OUTCOME_RESULT}`, data.outcome)
    formData.append(`t${REQ_IC_SCORES_JSON}`, JSON.stringify(combinedData))
    formData.append(`t${REQ_DATES}`, `${data.outcomeDate} 00:00:00`)
    formData.append(`t${REQ_IRR_VALUES}`, `${protocol.decision?.predictedIRR || 0}`)
    formData.append(`t${REQ_PROJECT_REF}`, data.projectId)
    formData.append(`t${REQ_IC_DECISION_REF}`, data.icDecisionId)
    formData.append(`t${REQ_USED_IN_TRAINING}`, '0')  // Not used yet

    const result = await integramApiClient.createRecord(
      DATABASE,
      TRAINING_DATA_TYPE_ID,
      formData
    )

    return {
      success: true,
      trainingDataId: result.id,
      addedToTrainingSet: true,
    }
  } catch (error) {
    console.error('[fstLearningService] Error adding training example:', error)
    throw error
  }
}

/**
 * Get all training data records
 *
 * @param {Object} filters
 * @param {string} filters.outcome - Filter by outcome (EXIT/ALIVE/DEAD)
 * @param {number} filters.year - Filter by year
 * @param {boolean} filters.usedInTraining - Filter by training usage
 * @returns {Promise<Array>} Training data records
 */
export async function getTrainingData(filters = {}) {
  try {
    const records = await integramApiClient.getRecords(DATABASE, TRAINING_DATA_TYPE_ID, {
      limit: 1000,
    })

    // Parse and enrich records
    let data = records.map(record => {
      const outcomeResult = record.requisites.find(r => r.reqId === REQ_OUTCOME_RESULT)?.value
      const scoresJSON = record.requisites.find(r => r.reqId === REQ_IC_SCORES_JSON)?.value
      const dates = record.requisites.find(r => r.reqId === REQ_DATES)?.value
      const irrValues = record.requisites.find(r => r.reqId === REQ_IRR_VALUES)?.value
      const projectRef = record.requisites.find(r => r.reqId === REQ_PROJECT_REF)?.value
      const icDecisionRef = record.requisites.find(r => r.reqId === REQ_IC_DECISION_REF)?.value
      const usedFlag = record.requisites.find(r => r.reqId === REQ_USED_IN_TRAINING)?.value

      const scores = scoresJSON ? JSON.parse(scoresJSON) : {}

      return {
        id: record.id,
        val: record.val,
        outcome: outcomeResult,
        outcomeScore: outcomeToScore(outcomeResult),
        icScores: scores.icScores || {},
        actualOutcome: scores.actualOutcome || {},
        outcomeDate: dates,
        predictedIRR: irrValues ? parseFloat(irrValues) : 0,
        actualIRR: scores.actualOutcome?.actualIRR || 0,
        projectId: projectRef,
        icDecisionId: icDecisionRef,
        usedInTraining: usedFlag === '1',
      }
    })

    // Apply filters
    if (filters.outcome) {
      data = data.filter(d => d.outcome === filters.outcome)
    }
    if (filters.year) {
      data = data.filter(d => {
        const year = new Date(d.outcomeDate).getFullYear()
        return year === filters.year
      })
    }
    if (filters.usedInTraining !== undefined) {
      data = data.filter(d => d.usedInTraining === filters.usedInTraining)
    }

    return data
  } catch (error) {
    console.error('[fstLearningService] Error getting training data:', error)
    throw error
  }
}

// ────────────────────────────────────────────────────────────────
// Weight Calibration Algorithm
// ────────────────────────────────────────────────────────────────

/**
 * Predict outcome score from IC scores using current weights
 *
 * @param {Object} icScores - IC session scores
 * @param {Array} agents - Agent configs with weights
 * @returns {number} Predicted outcome (0-1)
 */
function predictOutcome(icScores, agents) {
  let weightedSum = 0
  let totalWeight = 0

  for (const agentScore of icScores.agentScores || []) {
    const agent = agents.find(a => a.id === agentScore.agentId)
    if (!agent) continue

    const normalizedScore = agentScore.score / 100  // Convert 0-100 to 0-1
    weightedSum += normalizedScore * agent.weight
    totalWeight += agent.weight
  }

  return totalWeight > 0 ? weightedSum / totalWeight : 0.5
}

/**
 * Calculate loss (MSE) for current weights
 */
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

/**
 * Calculate accuracy: % of outcomes predicted correctly
 */
function calculateAccuracy(trainingData, agents) {
  let correct = 0

  for (const example of trainingData) {
    const predicted = predictOutcome(example.icScores, agents)
    const actual = example.outcomeScore

    // Convert to discrete outcome
    const predictedOutcome = predicted >= 0.75 ? 1.0 : predicted >= 0.25 ? 0.5 : 0.0
    if (Math.abs(predictedOutcome - actual) < 0.1) {
      correct++
    }
  }

  return correct / trainingData.length
}

/**
 * Calibrate agent weights using simple gradient descent
 *
 * @param {Object} options
 * @param {number} options.minExamples - Minimum training examples required
 * @param {number} options.epochs - Training epochs
 * @param {number} options.learningRate - Learning rate
 * @param {number} options.validationSplit - Validation set split (0-1)
 * @returns {Promise<Object>} Calibration results with new weights
 */
export async function calibrateWeights(options = {}) {
  const {
    minExamples = 10,
    epochs = 100,
    learningRate = 0.01,
    validationSplit = 0.2,
  } = options

  try {
    // Get all training data (only used=1 or all if not enough)
    let trainingData = await getTrainingData({ usedInTraining: true })
    if (trainingData.length < minExamples) {
      console.warn(`Not enough training examples with usedInTraining=1 (${trainingData.length}), using all data`)
      trainingData = await getTrainingData()
    }

    if (trainingData.length < minExamples) {
      throw new Error(`Insufficient training data: ${trainingData.length} < ${minExamples}`)
    }

    // Split into training and validation sets
    const shuffled = trainingData.sort(() => Math.random() - 0.5)
    const splitIdx = Math.floor(trainingData.length * (1 - validationSplit))
    const trainSet = shuffled.slice(0, splitIdx)
    const validSet = shuffled.slice(splitIdx)

    // Clone agents for calibration (don't modify originals)
    const agents = JSON.parse(JSON.stringify(AGENTS))

    // Record initial metrics
    const initialLoss = calculateLoss(trainSet, agents)
    const initialAccuracy = calculateAccuracy(validSet, agents)

    console.log(`[calibrateWeights] Starting calibration:`, {
      trainingExamples: trainSet.length,
      validationExamples: validSet.length,
      epochs,
      learningRate,
      initialLoss: initialLoss.toFixed(4),
      initialAccuracy: (initialAccuracy * 100).toFixed(1) + '%',
    })

    // Gradient descent training
    for (let epoch = 0; epoch < epochs; epoch++) {
      for (const example of trainSet) {
        const predicted = predictOutcome(example.icScores, agents)
        const actual = example.outcomeScore
        const error = predicted - actual

        // Update each agent's weight
        for (const agent of agents) {
          const agentScore = example.icScores.agentScores?.find(s => s.agentId === agent.id)
          if (!agentScore) continue

          const normalizedScore = agentScore.score / 100
          const gradient = error * normalizedScore

          // Update overall agent weight
          agent.weight = clamp(
            agent.weight - learningRate * gradient,
            0.05,  // Min weight
            0.30   // Max weight
          )

          // Update per-dimension scoring weights (optional refinement)
          for (const dim in agent.scoringWeights) {
            const dimValue = example.icScores.dimScores?.[dim] || 0
            const dimGradient = error * dimValue
            agent.scoringWeights[dim] = clamp(
              agent.scoringWeights[dim] - learningRate * dimGradient * 0.1,  // Smaller learning rate for dims
              0.0,
              1.0
            )
          }
        }
      }

      // Normalize agent weights to sum to 1.0
      const totalWeight = agents.reduce((sum, a) => sum + a.weight, 0)
      agents.forEach(a => { a.weight /= totalWeight })

      // Normalize per-agent scoring weights
      agents.forEach(agent => {
        const dimSum = Object.values(agent.scoringWeights).reduce((sum, w) => sum + w, 0)
        if (dimSum > 0) {
          for (const dim in agent.scoringWeights) {
            agent.scoringWeights[dim] /= dimSum
          }
        }
      })

      // Log progress every 10 epochs
      if ((epoch + 1) % 10 === 0) {
        const loss = calculateLoss(trainSet, agents)
        console.log(`Epoch ${epoch + 1}/${epochs}: loss=${loss.toFixed(4)}`)
      }
    }

    // Final metrics
    const finalLoss = calculateLoss(trainSet, agents)
    const finalAccuracy = calculateAccuracy(validSet, agents)

    // Build result with old vs new weights
    const newWeights = {
      agents: agents.map((agent, idx) => ({
        id: agent.id,
        name: agent.name,
        oldWeight: AGENTS[idx].weight,
        newWeight: agent.weight,
        weightChange: ((agent.weight - AGENTS[idx].weight) / AGENTS[idx].weight * 100).toFixed(1) + '%',
        scoringWeights: agent.scoringWeights,
        oldScoringWeights: AGENTS[idx].scoringWeights,
      })),
    }

    return {
      success: true,
      calibrationResults: {
        trainingExamples: trainSet.length,
        validationExamples: validSet.length,
        epochs,
        finalLoss: finalLoss.toFixed(4),
        validationAccuracy: (finalAccuracy * 100).toFixed(1) + '%',
        newWeights,
        improvementMetrics: {
          accuracyBefore: (initialAccuracy * 100).toFixed(1) + '%',
          accuracyAfter: (finalAccuracy * 100).toFixed(1) + '%',
          improvement: ((finalAccuracy - initialAccuracy) * 100).toFixed(1) + '%',
          lossReduction: ((initialLoss - finalLoss) / initialLoss * 100).toFixed(1) + '%',
        },
      },
    }
  } catch (error) {
    console.error('[fstLearningService] Error calibrating weights:', error)
    throw error
  }
}

// ────────────────────────────────────────────────────────────────
// Accuracy Analysis
// ────────────────────────────────────────────────────────────────

/**
 * Get historical accuracy of IC decisions
 *
 * @returns {Promise<Object>} Accuracy metrics
 */
export async function getAccuracyMetrics() {
  try {
    const trainingData = await getTrainingData()

    if (trainingData.length === 0) {
      return {
        overallAccuracy: 0,
        byAgent: [],
        byYear: [],
        byOutcome: {},
        totalDecisions: 0,
      }
    }

    // Overall accuracy
    const overallAccuracy = calculateAccuracy(trainingData, AGENTS)

    // Accuracy by agent
    const byAgent = AGENTS.map(agent => {
      let correct = 0
      let total = 0

      for (const example of trainingData) {
        const agentScore = example.icScores.agentScores?.find(s => s.agentId === agent.id)
        if (!agentScore) continue

        total++
        const predicted = agentScore.score / 100  // Normalize to 0-1
        const actual = example.outcomeScore

        // Convert to discrete
        const predictedOutcome = predicted >= 0.75 ? 1.0 : predicted >= 0.25 ? 0.5 : 0.0
        if (Math.abs(predictedOutcome - actual) < 0.1) {
          correct++
        }
      }

      return {
        agentId: agent.id,
        agentName: agent.name,
        agentAvatar: agent.avatar,
        correctPredictions: correct,
        totalDecisions: total,
        accuracy: total > 0 ? correct / total : 0,
      }
    })

    // Accuracy by year
    const yearMap = {}
    for (const example of trainingData) {
      const year = new Date(example.outcomeDate).getFullYear()
      if (!yearMap[year]) {
        yearMap[year] = { correct: 0, total: 0 }
      }

      yearMap[year].total++
      const predicted = predictOutcome(example.icScores, AGENTS)
      const actual = example.outcomeScore
      const predictedOutcome = predicted >= 0.75 ? 1.0 : predicted >= 0.25 ? 0.5 : 0.0
      if (Math.abs(predictedOutcome - actual) < 0.1) {
        yearMap[year].correct++
      }
    }

    const byYear = Object.entries(yearMap)
      .map(([year, data]) => ({
        year: parseInt(year),
        decisions: data.total,
        accuracy: data.total > 0 ? data.correct / data.total : 0,
      }))
      .sort((a, b) => a.year - b.year)

    // Accuracy by outcome type
    const byOutcome = {}
    for (const outcome of Object.keys(OUTCOMES)) {
      const examples = trainingData.filter(d => d.outcome === outcome)
      let correct = 0

      for (const example of examples) {
        const predicted = predictOutcome(example.icScores, AGENTS)
        const actual = example.outcomeScore
        const predictedOutcome = predicted >= 0.75 ? 1.0 : predicted >= 0.25 ? 0.5 : 0.0
        if (Math.abs(predictedOutcome - actual) < 0.1) {
          correct++
        }
      }

      // Count how many were predicted as this outcome
      let predicted = 0
      for (const example of trainingData) {
        const pred = predictOutcome(example.icScores, AGENTS)
        const predOutcome = pred >= 0.75 ? 1.0 : pred >= 0.25 ? 0.5 : 0.0
        if (Math.abs(predOutcome - OUTCOMES[outcome].score) < 0.1) {
          predicted++
        }
      }

      byOutcome[outcome] = {
        predicted,
        actual: examples.length,
        accuracy: examples.length > 0 ? correct / examples.length : 0,
      }
    }

    return {
      overallAccuracy: (overallAccuracy * 100).toFixed(1) + '%',
      totalDecisions: trainingData.length,
      byAgent: byAgent.sort((a, b) => b.accuracy - a.accuracy),
      byYear,
      byOutcome,
    }
  } catch (error) {
    console.error('[fstLearningService] Error getting accuracy metrics:', error)
    throw error
  }
}

/**
 * Export calibrated weights as JavaScript code
 *
 * @param {Object} calibrationResults - Results from calibrateWeights()
 * @returns {string} JavaScript code to replace in FstCommitteeConfig.js
 */
export function exportWeightsAsCode(calibrationResults) {
  const { newWeights } = calibrationResults

  let code = '// ── Calibrated Agent Weights (auto-generated) ──\n\n'
  code += 'export const AGENTS = [\n'

  for (const agentData of newWeights.agents) {
    const agent = AGENTS.find(a => a.id === agentData.id)
    if (!agent) continue

    code += '  {\n'
    code += `    id: '${agent.id}',\n`
    code += `    name: '${agent.name}',\n`
    code += `    shortName: '${agent.shortName}',\n`
    code += `    role: '${agent.role}',\n`
    code += `    avatar: '${agent.avatar}',\n`
    code += `    color: '${agent.color}',\n`
    code += `    bias: '${agent.bias}',\n`
    code += `    weight: ${agentData.newWeight.toFixed(2)},  // was ${agentData.oldWeight.toFixed(2)} (${agentData.weightChange})\n`
    code += `    focus: ${JSON.stringify(agent.focus)},\n`
    code += `    description: '${agent.description}',\n`
    code += `    scoringWeights: {\n`
    for (const [dim, weight] of Object.entries(agentData.scoringWeights)) {
      code += `      ${dim}: ${weight.toFixed(2)},\n`
    }
    code += `    },\n`
    code += `    thinkingPhrases: ${JSON.stringify(agent.thinkingPhrases)},\n`
    code += '  },\n'
  }

  code += ']\n'

  return code
}

export default {
  addTrainingExample,
  getTrainingData,
  calibrateWeights,
  getAccuracyMetrics,
  exportWeightsAsCode,
  OUTCOMES,
}
