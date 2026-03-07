# FST Learning System — Database Schema Extension

> Created: 2026-03-07 | Issue: [#12](https://github.com/unidel2035/found/issues/12)
> Status: Phase 5 — Neuro-cognitive core: learning from IC historical data

---

## Overview

Implements self-learning investment committee that improves agent scoring weights based on real deal outcomes.

**Flow:**
```
Project → IC Decision (scores, arguments) → Actual outcome (alive/dead/exit after 3 years)
  ↓
Training Dataset: (features) → (outcome)
  ↓
Fine-tuning agent weights (tech, finance, sovereignty, risk, ...)
  ↓
New projects scored more accurately
```

---

## New Table: TrainingData (typeId: 1250)

Stores historical IC decisions and actual outcomes for training.

| Req ID | Field | Type | Description |
|--------|-------|------|-------------|
| 1251 | Outcome result | SHORT (1042) | ALIVE / DEAD / EXIT |
| 1252 | IC scores (JSON), Actual metrics (JSON) | HTML (1018) | Full IC session data + actual outcomes |
| 1253 | Outcome date, Training date | DATETIME (123) | When outcome measured, when added to training set |
| 1254 | IRR predicted, IRR actual | NUMBER (144) | Predicted vs actual IRR for calibration |
| 1255 | Project | REF → Проекты ФСТ (1155) | Link to project |
| 1256 | IC Decision | REF → Решения ИК (1160) | Link to original IC decision |
| 1257 | Used in training | NUMBER (144) | Boolean flag: 1=used, 0=not used yet |

### JSON Structure (req 1252)

**IC Scores (at decision time):**
```json
{
  "icScores": {
    "aggregatedScore": 82,
    "agentScores": [
      {
        "agentId": "tech",
        "score": 85,
        "verdict": "APPROVE",
        "confidence": 0.92
      },
      {
        "agentId": "finance",
        "score": 78,
        "verdict": "APPROVE",
        "confidence": 0.88
      }
    ],
    "dimScores": {
      "trl": 0.75,
      "mrl": 0.60,
      "sovereignty": 0.82,
      "market": 0.70,
      "finance": 0.75,
      "risk": 0.65,
      "team": 0.80
    },
    "policyParams": {
      "minTRL": 5,
      "minSovereignty": 6,
      "keyRate": 0.16
    }
  },
  "actualOutcome": {
    "outcome": "EXIT",
    "actualIRR": 0.42,
    "predictedIRR": 0.34,
    "yearsToOutcome": 3.2,
    "exitMultiple": 5.8,
    "finalMetrics": {
      "revenue": 450000000,
      "employees": 85,
      "trlFinal": 9,
      "mrlFinal": 8
    },
    "reasonForOutcome": "Acquired by Rostec after successful commercialization",
    "dateRecorded": "2026-03-07T12:00:00Z"
  }
}
```

---

## Weight Calibration Algorithm

**Simple Logistic Regression Approach:**

1. **Input:** TrainingData records with outcomes (ALIVE=0.5, EXIT=1.0, DEAD=0.0)
2. **Features:** Agent scores per dimension
3. **Loss Function:** MSE between predicted outcome and actual
4. **Optimization:** Gradient descent to adjust agent weights in FstCommitteeConfig.js

**Agent Weights to Calibrate:**
- `agent.weight` (0.14-0.20) — overall agent influence
- `agent.scoringWeights` (per dimension) — how each agent weighs trl/mrl/sovereignty/etc

**Training Process:**
```javascript
function calibrateWeights(trainingDataset) {
  const learningRate = 0.01
  const epochs = 100

  for (let epoch = 0; epoch < epochs; epoch++) {
    for (const example of trainingDataset) {
      const predicted = predictOutcome(example.icScores, currentWeights)
      const actual = outcomeToScore(example.outcome) // EXIT=1, ALIVE=0.5, DEAD=0
      const error = predicted - actual

      // Update weights via gradient descent
      for (const agent of agents) {
        agent.weight -= learningRate * error * example.agentScores[agent.id].score
        for (const dim in agent.scoringWeights) {
          agent.scoringWeights[dim] -= learningRate * error * example.dimScores[dim]
        }
      }
    }
  }

  return normalizeWeights(agents)
}
```

---

## API Endpoints

### 1. POST /api/fst/training-data

Add new training example (manual or automatic).

**Request:**
```json
{
  "projectId": "1202",
  "icDecisionId": "1300",
  "outcome": "EXIT",
  "actualIRR": 0.42,
  "outcomeDate": "2026-03-07",
  "finalMetrics": {
    "revenue": 450000000,
    "employees": 85
  },
  "reasonForOutcome": "Acquired by Rostec"
}
```

**Response:**
```json
{
  "success": true,
  "trainingDataId": "1350",
  "addedToTrainingSet": true
}
```

### 2. POST /api/fst/calibrate-weights

Run weight calibration algorithm on training dataset.

**Request:**
```json
{
  "minExamples": 10,
  "epochs": 100,
  "learningRate": 0.01,
  "validationSplit": 0.2
}
```

**Response:**
```json
{
  "success": true,
  "calibrationResults": {
    "trainingExamples": 35,
    "validationExamples": 9,
    "epochs": 100,
    "finalLoss": 0.042,
    "validationAccuracy": 0.89,
    "newWeights": {
      "agents": [
        {
          "id": "tech",
          "oldWeight": 0.18,
          "newWeight": 0.19,
          "scoringWeights": {
            "trl": 0.37,
            "mrl": 0.32,
            "sovereignty": 0.09
          }
        }
      ]
    },
    "improvementMetrics": {
      "accuracyBefore": 0.78,
      "accuracyAfter": 0.89,
      "improvement": "+11%"
    }
  }
}
```

### 3. GET /api/fst/learning/accuracy

Get historical accuracy of IC decisions.

**Response:**
```json
{
  "overallAccuracy": 0.83,
  "byAgent": [
    {
      "agentId": "tech",
      "agentName": "Технический аналитик",
      "correctPredictions": 28,
      "totalDecisions": 35,
      "accuracy": 0.80
    }
  ],
  "byYear": [
    {
      "year": 2024,
      "decisions": 15,
      "accuracy": 0.73
    },
    {
      "year": 2025,
      "decisions": 20,
      "accuracy": 0.85
    }
  ],
  "byOutcome": {
    "EXIT": { "predicted": 12, "actual": 10, "accuracy": 0.83 },
    "ALIVE": { "predicted": 18, "actual": 20, "accuracy": 0.90 },
    "DEAD": { "predicted": 5, "actual": 5, "accuracy": 1.00 }
  }
}
```

---

## Dashboard: /fst-learning

**Components:**

1. **Accuracy Overview Card**
   - Overall IC accuracy %
   - Predicted vs Actual scatter plot
   - Trend line over years

2. **Agent Performance Table**
   - Each agent: accuracy %, total decisions, correct/incorrect
   - Best/worst performing agent highlight
   - Heatmap of agent accuracy by outcome type

3. **Training Dataset Manager**
   - List of all training examples
   - Add manual training example (retro data entry)
   - Filter by outcome, year, subfund

4. **Weight Calibration Panel**
   - Run calibration button
   - Progress bar during training
   - Before/After weights comparison
   - "Apply to FstCommitteeConfig.js" action

5. **Prediction Analysis**
   - IRR: predicted vs actual chart
   - TRL/MRL: initial vs final
   - Success factors analysis (which metrics matter most)

---

## Integration Points

### With FstCommittee.vue
- Every concluded IC session auto-creates TrainingData stub (outcome=null, used=0)
- After 3 years, Portfolio monitoring triggers outcome update

### With FstPortfolio.vue
- Portfolio status updates can trigger training data outcome recording
- "Mark as EXIT/DEAD" action in portfolio view

### With FstCommitteeConfig.js
- Calibrated weights can be exported as JS code
- Manual override: admin can apply/reject calibrated weights

---

## Completion Criteria

- [x] TrainingData table schema designed
- [ ] TrainingData table created in Integram fst database
- [ ] API endpoints implemented
- [ ] Calibration algorithm working
- [ ] Dashboard with all 5 components
- [ ] Integration with existing FstCommittee
- [ ] Unit tests for calibration logic

---

_Created: 2026-03-07 | Issue: [#12](https://github.com/unidel2035/found/issues/12)_
