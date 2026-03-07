/**
 * FST Learning Service Test — Experiment script
 *
 * Tests the calibration algorithm with synthetic training data.
 * Run: node experiments/fst-learning-test.js
 */

// Mock agent configuration
const MOCK_AGENTS = [
  {
    id: 'tech',
    name: 'Технический аналитик',
    weight: 0.18,
    scoringWeights: { trl: 0.35, mrl: 0.30, sovereignty: 0.10, market: 0.05, finance: 0.10, risk: 0.10, team: 0.00 },
  },
  {
    id: 'finance',
    name: 'Финансовый аналитик',
    weight: 0.20,
    scoringWeights: { trl: 0.05, mrl: 0.05, sovereignty: 0.05, market: 0.20, finance: 0.55, risk: 0.10, team: 0.00 },
  },
  {
    id: 'sovereignty',
    name: 'Эксперт суверенности',
    weight: 0.16,
    scoringWeights: { trl: 0.05, mrl: 0.05, sovereignty: 0.55, market: 0.10, finance: 0.05, risk: 0.10, team: 0.10 },
  },
  {
    id: 'risk',
    name: 'Риск-менеджер',
    weight: 0.18,
    scoringWeights: { trl: 0.10, mrl: 0.10, sovereignty: 0.10, market: 0.10, finance: 0.15, risk: 0.45, team: 0.00 },
  },
  {
    id: 'portfolio',
    name: 'Стратег портфеля',
    weight: 0.14,
    scoringWeights: { trl: 0.05, mrl: 0.05, sovereignty: 0.15, market: 0.25, finance: 0.20, risk: 0.10, team: 0.20 },
  },
  {
    id: 'devil',
    name: 'Адвокат дьявола',
    weight: 0.14,
    scoringWeights: { trl: 0.10, mrl: 0.10, sovereignty: 0.10, market: 0.15, finance: 0.20, risk: 0.25, team: 0.10 },
  },
]

// Outcome enum
const OUTCOMES = {
  EXIT: { value: 'EXIT', score: 1.0 },
  ALIVE: { value: 'ALIVE', score: 0.5 },
  DEAD: { value: 'DEAD', score: 0.0 },
}

function outcomeToScore(outcome) {
  return OUTCOMES[outcome]?.score ?? 0.5
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

// Generate synthetic training data
function generateSyntheticData(count = 50) {
  const data = []

  for (let i = 0; i < count; i++) {
    // Random project metrics
    const trlScore = Math.random()
    const mrlScore = Math.random()
    const sovereigntyScore = Math.random()
    const marketScore = Math.random()
    const financeScore = Math.random()
    const riskScore = Math.random()
    const teamScore = Math.random()

    // Generate agent scores based on their weights
    const agentScores = MOCK_AGENTS.map(agent => {
      let score = 0
      score += trlScore * agent.scoringWeights.trl
      score += mrlScore * agent.scoringWeights.mrl
      score += sovereigntyScore * agent.scoringWeights.sovereignty
      score += marketScore * agent.scoringWeights.market
      score += financeScore * agent.scoringWeights.finance
      score += riskScore * agent.scoringWeights.risk
      score += teamScore * agent.scoringWeights.team

      // Add noise
      score += (Math.random() - 0.5) * 0.1

      return {
        agentId: agent.id,
        score: clamp(score * 100, 0, 100),
        verdict: score >= 0.72 ? 'APPROVE' : score >= 0.50 ? 'DEFER' : 'REJECT',
        confidence: Math.random() * 0.3 + 0.7,
      }
    })

    // Calculate aggregated score
    let aggregatedScore = 0
    let totalWeight = 0
    for (let j = 0; j < MOCK_AGENTS.length; j++) {
      aggregatedScore += agentScores[j].score * MOCK_AGENTS[j].weight
      totalWeight += MOCK_AGENTS[j].weight
    }
    aggregatedScore /= totalWeight

    // Determine outcome based on aggregated score (with some randomness)
    let outcome
    const noise = (Math.random() - 0.5) * 0.2
    const adjustedScore = clamp((aggregatedScore / 100) + noise, 0, 1)

    if (adjustedScore >= 0.75) {
      outcome = 'EXIT'
    } else if (adjustedScore >= 0.35) {
      outcome = 'ALIVE'
    } else {
      outcome = 'DEAD'
    }

    data.push({
      id: `train_${i + 1}`,
      outcome,
      outcomeScore: outcomeToScore(outcome),
      icScores: {
        aggregatedScore: Math.round(aggregatedScore),
        agentScores,
        dimScores: {
          trl: trlScore,
          mrl: mrlScore,
          sovereignty: sovereigntyScore,
          market: marketScore,
          finance: financeScore,
          risk: riskScore,
          team: teamScore,
        },
      },
      predictedIRR: financeScore * 0.5 + 0.1,
      actualIRR: outcomeToScore(outcome) * 0.5 + 0.1,
    })
  }

  return data
}

// Prediction function
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

// Calculate loss
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

// Calculate accuracy
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

// Calibration algorithm
function calibrateWeights(trainingData, options = {}) {
  const {
    epochs = 100,
    learningRate = 0.01,
    validationSplit = 0.2,
  } = options

  // Split data
  const shuffled = trainingData.sort(() => Math.random() - 0.5)
  const splitIdx = Math.floor(trainingData.length * (1 - validationSplit))
  const trainSet = shuffled.slice(0, splitIdx)
  const validSet = shuffled.slice(splitIdx)

  // Clone agents
  const agents = JSON.parse(JSON.stringify(MOCK_AGENTS))

  // Initial metrics
  const initialLoss = calculateLoss(trainSet, agents)
  const initialAccuracy = calculateAccuracy(validSet, agents)

  console.log('Starting calibration:')
  console.log(`  Training examples: ${trainSet.length}`)
  console.log(`  Validation examples: ${validSet.length}`)
  console.log(`  Initial loss: ${initialLoss.toFixed(4)}`)
  console.log(`  Initial accuracy: ${(initialAccuracy * 100).toFixed(1)}%`)
  console.log('')

  // Gradient descent
  for (let epoch = 0; epoch < epochs; epoch++) {
    for (const example of trainSet) {
      const predicted = predictOutcome(example.icScores, agents)
      const actual = example.outcomeScore
      const error = predicted - actual

      // Update agent weights
      for (const agent of agents) {
        const agentScore = example.icScores.agentScores?.find(s => s.agentId === agent.id)
        if (!agentScore) continue

        const normalizedScore = agentScore.score / 100
        const gradient = error * normalizedScore

        agent.weight = clamp(
          agent.weight - learningRate * gradient,
          0.05,
          0.30
        )

        // Update per-dimension weights
        for (const dim in agent.scoringWeights) {
          const dimValue = example.icScores.dimScores?.[dim] || 0
          const dimGradient = error * dimValue
          agent.scoringWeights[dim] = clamp(
            agent.scoringWeights[dim] - learningRate * dimGradient * 0.1,
            0.0,
            1.0
          )
        }
      }
    }

    // Normalize weights
    const totalWeight = agents.reduce((sum, a) => sum + a.weight, 0)
    agents.forEach(a => { a.weight /= totalWeight })

    agents.forEach(agent => {
      const dimSum = Object.values(agent.scoringWeights).reduce((sum, w) => sum + w, 0)
      if (dimSum > 0) {
        for (const dim in agent.scoringWeights) {
          agent.scoringWeights[dim] /= dimSum
        }
      }
    })

    // Log every 10 epochs
    if ((epoch + 1) % 10 === 0) {
      const loss = calculateLoss(trainSet, agents)
      console.log(`Epoch ${epoch + 1}/${epochs}: loss=${loss.toFixed(4)}`)
    }
  }

  // Final metrics
  const finalLoss = calculateLoss(trainSet, agents)
  const finalAccuracy = calculateAccuracy(validSet, agents)

  console.log('')
  console.log('Calibration complete:')
  console.log(`  Final loss: ${finalLoss.toFixed(4)}`)
  console.log(`  Final accuracy: ${(finalAccuracy * 100).toFixed(1)}%`)
  console.log(`  Improvement: ${((finalAccuracy - initialAccuracy) * 100).toFixed(1)}%`)
  console.log('')

  // Print weight changes
  console.log('Weight changes:')
  for (let i = 0; i < agents.length; i++) {
    const old = MOCK_AGENTS[i]
    const updated = agents[i]
    const change = ((updated.weight - old.weight) / old.weight * 100).toFixed(1)
    console.log(`  ${updated.name}: ${old.weight.toFixed(2)} → ${updated.weight.toFixed(2)} (${change}%)`)
  }

  return {
    agents,
    initialLoss,
    finalLoss,
    initialAccuracy,
    finalAccuracy,
  }
}

// Run experiment
console.log('=== FST Learning Service Test ===\n')

// Generate synthetic data
console.log('Generating synthetic training data...')
const trainingData = generateSyntheticData(50)
console.log(`Generated ${trainingData.length} training examples`)
console.log(`  EXIT: ${trainingData.filter(d => d.outcome === 'EXIT').length}`)
console.log(`  ALIVE: ${trainingData.filter(d => d.outcome === 'ALIVE').length}`)
console.log(`  DEAD: ${trainingData.filter(d => d.outcome === 'DEAD').length}`)
console.log('')

// Run calibration
const results = calibrateWeights(trainingData, {
  epochs: 100,
  learningRate: 0.01,
  validationSplit: 0.2,
})

console.log('=== Experiment complete ===')
