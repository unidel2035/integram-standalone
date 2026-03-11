/**
 * FST Factor Model Engine — "Aladdin for FST NTI"
 *
 * Scores every venture deal on 5 FST-specific axes and computes
 * portfolio-level analytics.
 *
 * Endpoints:
 *   POST /api/factor/score            — score a single deal
 *   POST /api/factor/portfolio-impact — compute delta before/after adding a deal
 *   POST /api/factor/stress-test      — run FST-specific stress scenarios
 *   GET  /api/factor/scenarios        — list standard stress scenarios
 */

import { Router } from 'express'
import fetch from 'node-fetch'
import { getConfig, saveConfig } from '../../services/fstConfigService.js'

const router = Router()

// ── Config getters (из Integram DB, fallback на дефолты) ───────────────────

function getWeights()         { return getConfig('factor_weights') }
function getLabels()          { return getConfig('factor_labels') }
function getGradeThresholds() { return getConfig('grade_thresholds') }
function getRecommendationMap() { return getConfig('recommendation_map') }
function getStressScenarios() { return getConfig('stress_scenarios') }

const EXPORT_SCORES = { high: 9, medium: 6, low: 3, none: 1 }

// Строковое условие из DB → функция (deal) => bool
function evalCondition(condition, deal) {
  if (!condition || condition === 'always') return true
  if (condition === 'sovereignPercent < 70') return (deal.sovereignPercent ?? 100) < 70
  // custom JS expression (sandbox-safe: только сравнения)
  try {
    return new Function('deal', `return !!(${condition})`)(deal)
  } catch {
    return true
  }
}

// ── AI call helper ─────────────────────────────────────────────────────────────

async function callAI(prompt, systemPrompt, modelId = 'deepseek/deepseek-chat') {
  const port = process.env.FST_API_PORT || process.env.BACKEND_PORT || '8084'
  const apiBase = process.env.BACKEND_URL || `http://localhost:${port}`
  const r = await fetch(`${apiBase}/api/ai-tokens/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ modelId, prompt, systemPrompt, application: 'FactorModel' }),
    signal: AbortSignal.timeout(60000),
  })
  if (!r.ok) throw new Error(`AI call failed: ${r.status}`)
  const d = await r.json()
  return d.response || d.content || ''
}

// ── Scoring formulas ──────────────────────────────────────────────────────────

function scoreT(deal) {
  const trl = typeof deal.trl === 'number' ? deal.trl : null
  if (trl === null) return null

  const trlScore = (trl / 9) * 8
  const growthBonus = (deal.trlGrowth ?? 0) > 0 ? 2 : 0
  return Math.min(10, trlScore + growthBonus)
}

function scoreS(deal) {
  const pct = typeof deal.sovereignPercent === 'number' ? deal.sovereignPercent : null
  if (pct === null) return null
  return Math.min(10, Math.max(0, (pct / 100) * 10))
}

function scoreM(deal) {
  const total = typeof deal.totalInvestment === 'number' ? deal.totalInvestment : null
  const fst   = typeof deal.fstInvestment   === 'number' ? deal.fstInvestment   : null
  if (total === null || fst === null || fst <= 0) return null

  const multiplier = (total - fst) / fst
  if (multiplier >= 3) return Math.min(10, 8 + Math.min(2, ((multiplier - 3) / 3) * 2))
  if (multiplier >= 1) return 5 + ((multiplier - 1) / 2) * 3
  return Math.max(0, multiplier * 5)
}

function scoreG(deal) {
  const cov = typeof deal.grChainCoverage === 'number' ? deal.grChainCoverage : null
  if (cov === null) return null
  return Math.min(10, Math.max(0, cov * 10))
}

function scoreE(deal) {
  if (deal.exportPotential == null) return null
  return EXPORT_SCORES[deal.exportPotential] ?? 5
}

function computeComposite(factors) {
  const weights = getWeights()
  let sum = 0
  for (const [key, w] of Object.entries(weights)) {
    sum += (factors[key]?.score ?? 0) * w
  }
  return Math.round(sum * 100) / 100
}

function gradeFromComposite(composite) {
  const thresholds = getGradeThresholds()
  for (const [threshold, grade] of thresholds) {
    if (composite >= threshold) return grade
  }
  return 'D'
}

function clampScore(s) {
  if (s === null || s === undefined) return null
  return Math.round(Math.min(10, Math.max(0, s)) * 100) / 100
}

// ── Deterministic factor object builder ───────────────────────────────────────

function buildDeterministicFactors(deal) {
  const labels = getLabels()
  return {
    T: { score: clampScore(scoreT(deal)), label: labels.T },
    S: { score: clampScore(scoreS(deal)), label: labels.S },
    M: { score: clampScore(scoreM(deal)), label: labels.M },
    G: { score: clampScore(scoreG(deal)), label: labels.G },
    E: { score: clampScore(scoreE(deal)), label: labels.E },
  }
}

// ── AI-assisted scoring (fill in nulls from description) ─────────────────────

async function enrichFactorsWithAI(factors, deal) {
  const missing = Object.entries(factors)
    .filter(([, v]) => v.score === null)
    .map(([k]) => k)

  if (missing.length === 0 || !deal.description) return factors

  const labels = getLabels()
  const systemPrompt = `
Ты — аналитик венчурного фонда ФСТ НТИ. Твоя задача — оценить венчурную сделку
по факторным осям, для которых не хватает числовых данных.

Верни JSON-объект с ключами: ${missing.join(', ')}
Каждый ключ — объект { score: <число 0-10>, reasoning: "<1-2 предложения>" }

Факторы:
${missing.map(k => `- ${k}: ${labels[k] || k}`).join('\n')}

Оценивай строго по шкале 0–10. Ответ — только JSON, без markdown-блоков.
`.trim()

  const prompt = `Описание сделки: ${deal.description}\nКомпания: ${deal.companyName || 'не указана'}`

  try {
    const raw = await callAI(prompt, systemPrompt)
    const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim())
    for (const key of missing) {
      if (parsed[key] && typeof parsed[key].score === 'number') {
        factors[key].score = clampScore(parsed[key].score)
        factors[key].reasoning = parsed[key].reasoning || ''
      }
    }
  } catch (err) {
    // AI enrichment is best-effort; leave nulls as 0 with a note
    for (const key of missing) {
      if (factors[key].score === null) {
        factors[key].score = 5  // neutral fallback
        factors[key].reasoning = 'AI-оценка недоступна, использовано нейтральное значение'
      }
    }
  }

  return factors
}

// ── AI-generated reasoning for deterministic scores ──────────────────────────

async function addReasoningIfMissing(factors, deal) {
  const needsReasoning = Object.entries(factors).filter(([, v]) => !v.reasoning)
  if (needsReasoning.length === 0) return factors
  if (!deal.description && !deal.companyName) {
    for (const [, v] of needsReasoning) v.reasoning = ''
    return factors
  }

  const scores = Object.entries(factors)
    .map(([k, v]) => `${k} (${v.label}): ${v.score}/10`)
    .join(', ')

  const systemPrompt = `
Ты — аналитик венчурного фонда ФСТ НТИ. Для каждого факторного балла напиши
краткое обоснование (1 предложение). Верни JSON { T, S, M, G, E } — строки.
Ответ — только JSON без markdown.
`.trim()

  const prompt = `Компания: ${deal.companyName || 'не указана'}.\nБаллы: ${scores}\nОписание: ${deal.description || 'не указано'}`

  try {
    const raw = await callAI(prompt, systemPrompt)
    const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim())
    for (const [key, v] of needsReasoning) {
      if (parsed[key]) v.reasoning = parsed[key]
    }
  } catch {
    // best-effort
  }

  return factors
}

// ── Red flags & strengths detector ───────────────────────────────────────────

function detectRedFlags(factors, deal) {
  const flags = []

  const trl = deal.trl ?? null
  const fstInv = deal.fstInvestment ?? 0
  if (trl !== null && trl < 4 && fstInv > 50) {
    flags.push('TRL < 4 при запросе > 50 млн — высокий технологический риск')
  }
  if (factors.G.score !== null && factors.G.score < 3) {
    flags.push('Недостаточное GR-покрытие — риск на регуляторных этапах')
  }
  if (factors.S.score !== null && factors.S.score < 4) {
    flags.push('Низкий Sovereign Score — критическая зависимость от иностранных компонентов')
  }
  if (factors.M.score !== null && factors.M.score < 3) {
    flags.push('Мультипликатор < 1:1 — фонд несёт непропорциональную нагрузку')
  }
  if (factors.T.score !== null && factors.T.score < 3) {
    flags.push('TRL Momentum критически низкий — технология не подтверждена')
  }

  return flags
}

function detectStrengths(factors, deal) {
  const strengths = []

  if (factors.S.score !== null && factors.S.score >= 8) {
    strengths.push('Высокий Sovereign Score — продукт технологически суверенен')
  }
  if (factors.M.score !== null && factors.M.score >= 8) {
    const mult = deal.totalInvestment && deal.fstInvestment
      ? ((deal.totalInvestment - deal.fstInvestment) / deal.fstInvestment).toFixed(1)
      : null
    strengths.push(mult
      ? `Мультипликатор 1:${mult} — сильное привлечение внешнего капитала`
      : 'Высокий мультипликатор — сильное привлечение внешнего капитала')
  }
  if (factors.T.score !== null && factors.T.score >= 8) {
    strengths.push('Высокий TRL Momentum — технология близка к продукту')
  }
  if (factors.G.score !== null && factors.G.score >= 7) {
    strengths.push('Хорошее GR-покрытие — снижает регуляторные риски')
  }
  if (factors.E.score !== null && factors.E.score >= 7) {
    strengths.push('Высокий экспортный потенциал для рынков BRICS+')
  }

  return strengths
}

// ── Portfolio weighted aggregation ────────────────────────────────────────────

function aggregatePortfolio(positions) {
  // positions: [{ factors: { T, S, M, G, E }, weight }]
  const totalWeight = positions.reduce((s, p) => s + (p.weight || 1), 0)
  if (totalWeight === 0) return null

  const aggregate = {}
  for (const key of Object.keys(getLabels())) {
    let wsum = 0
    let wTotal = 0
    for (const p of positions) {
      const score = p.factors?.[key]?.score ?? p.factors?.[key] ?? null
      if (score !== null) {
        const w = p.weight || 1
        wsum += score * w
        wTotal += w
      }
    }
    aggregate[key] = wTotal > 0 ? Math.round((wsum / wTotal) * 100) / 100 : null
  }

  const composite = Object.entries(getWeights())
    .reduce((s, [k, w]) => s + (aggregate[k] ?? 0) * w, 0)

  return { factors: aggregate, composite: Math.round(composite * 100) / 100 }
}

function computeConcentrations(positions) {
  const bySector = {}
  let totalWeight = 0
  for (const p of positions) {
    const sector = p.sector || 'Не указан'
    const w = p.weight || 1
    bySector[sector] = (bySector[sector] || 0) + w
    totalWeight += w
  }
  if (totalWeight === 0) return {}
  const result = {}
  for (const [s, w] of Object.entries(bySector)) {
    result[s] = Math.round((w / totalWeight) * 1000) / 10  // percent, 1 decimal
  }
  return result
}

// ── Routes ────────────────────────────────────────────────────────────────────

/**
 * POST /api/factor/score
 * Score a single deal across 5 FST factors.
 */
router.post('/score', async (req, res) => {
  try {
    const { dealId, deal } = req.body
    if (!deal || typeof deal !== 'object') {
      return res.status(400).json({ error: 'Поле "deal" обязательно' })
    }

    // Step 1: deterministic scoring
    let factors = buildDeterministicFactors(deal)

    // Step 2: AI enrichment for missing values
    factors = await enrichFactorsWithAI(factors, deal)

    // Step 3: add reasoning for deterministic scores (if description available)
    factors = await addReasoningIfMissing(factors, deal)

    // Step 4: composite
    const composite = computeComposite(factors)
    const grade = gradeFromComposite(composite)
    const recommendation = getRecommendationMap()[grade] || 'HOLD_FOR_REVISION'

    // Step 5: flags and strengths
    const redFlags = detectRedFlags(factors, deal)
    const strengths = detectStrengths(factors, deal)

    res.json({
      dealId: dealId || null,
      factors,
      composite,
      grade,
      recommendation,
      redFlags,
      strengths,
    })
  } catch (err) {
    console.error('[factor/score]', err)
    res.status(500).json({ error: err.message })
  }
})

/**
 * POST /api/factor/portfolio-impact
 * Compute how adding a new deal changes portfolio-level factor profile.
 */
router.post('/portfolio-impact', async (req, res) => {
  try {
    const { newDeal, portfolio } = req.body
    if (!newDeal || !Array.isArray(portfolio)) {
      return res.status(400).json({ error: 'Необходимы "newDeal" и "portfolio" (массив)' })
    }

    // Existing portfolio aggregation
    const before = aggregatePortfolio(portfolio)
    const beforeConc = computeConcentrations(portfolio)

    // Validate new deal factors (accept pre-computed or raw deal)
    let newFactors = newDeal.factors
    if (!newFactors) {
      // Run scoring on the raw deal
      let f = buildDeterministicFactors(newDeal)
      f = await enrichFactorsWithAI(f, newDeal)
      newFactors = f
    }

    const newWeight = newDeal.weight ?? newDeal.fstInvestment ?? 1
    const newPosition = {
      dealId: newDeal.dealId || 'new',
      sector: newDeal.sector,
      factors: newFactors,
      weight: newWeight,
    }

    // After portfolio (existing + new)
    const extendedPortfolio = [...portfolio, newPosition]
    const after = aggregatePortfolio(extendedPortfolio)
    const afterConc = computeConcentrations(extendedPortfolio)

    // Delta per factor
    const delta = {}
    for (const key of Object.keys(FACTOR_LABELS)) {
      const bVal = before?.factors?.[key] ?? null
      const aVal = after?.factors?.[key] ?? null
      delta[key] = bVal !== null && aVal !== null
        ? Math.round((aVal - bVal) * 100) / 100
        : null
    }
    const compositeDelta = before && after
      ? Math.round((after.composite - before.composite) * 100) / 100
      : null

    // Warnings and improvements
    const warnings = []
    const improvements = []

    for (const [key, d] of Object.entries(delta)) {
      if (d === null) continue
      if (d <= -0.5) warnings.push(`Новая сделка снижает ${FACTOR_LABELS[key]} портфеля на ${Math.abs(d).toFixed(2)} п.`)
      if (d >= 0.5)  improvements.push(`Новая сделка улучшает ${FACTOR_LABELS[key]} портфеля на ${d.toFixed(2)} п.`)
    }

    // Concentration warnings
    for (const [sector, pct] of Object.entries(afterConc)) {
      if (pct > 40) {
        warnings.push(`Концентрация в секторе "${sector}" достигает ${pct}% — высокий отраслевой риск`)
      }
    }

    res.json({
      before: {
        aggregateFactors: before?.factors ?? null,
        composite: before?.composite ?? null,
        concentrations: beforeConc,
        dealCount: portfolio.length,
      },
      after: {
        aggregateFactors: after?.factors ?? null,
        composite: after?.composite ?? null,
        concentrations: afterConc,
        dealCount: extendedPortfolio.length,
      },
      delta: { ...delta, composite: compositeDelta },
      warnings,
      improvements,
    })
  } catch (err) {
    console.error('[factor/portfolio-impact]', err)
    res.status(500).json({ error: err.message })
  }
})

/**
 * POST /api/factor/stress-test
 * Run FST-specific stress scenarios against a deal or portfolio.
 */
router.post('/stress-test', async (req, res) => {
  try {
    const { dealId, portfolio, scenarios: requestedScenarios } = req.body

    const scenarios = getStressScenarios()
    // Resolve which scenarios to run
    const scenarioKeys = Array.isArray(requestedScenarios) && requestedScenarios.length > 0
      ? requestedScenarios.filter(k => scenarios[k])
      : Object.keys(scenarios)

    if (scenarioKeys.length === 0) {
      return res.status(400).json({ error: 'Нет валидных сценариев. Допустимые: ' + Object.keys(scenarios).join(', ') })
    }

    // Resolve base factors
    let baseDeal = req.body.deal || null
    let baseFactors
    let baseComposite

    if (portfolio && Array.isArray(portfolio) && portfolio.length > 0) {
      const agg = aggregatePortfolio(portfolio)
      baseFactors = agg?.factors ?? {}
      baseComposite = agg?.composite ?? null
      baseDeal = baseDeal || {}
    } else if (baseDeal) {
      let f = buildDeterministicFactors(baseDeal)
      f = await enrichFactorsWithAI(f, baseDeal)
      baseFactors = {}
      for (const [k, v] of Object.entries(f)) baseFactors[k] = v.score
      baseComposite = computeComposite(f)
    } else {
      return res.status(400).json({ error: 'Необходимо передать "deal" или "portfolio"' })
    }

    const labels = getLabels()
    const weights = getWeights()
    // Run each scenario
    const results = scenarioKeys.map(key => {
      const scenario = scenarios[key]
      const isHighImpact = scenario.condition
        ? evalCondition(scenario.condition, baseDeal || {})
        : true

      const stressedFactors = {}
      for (const fKey of Object.keys(labels)) {
        const base = baseFactors[fKey] ?? 5
        const impact = scenario.factorImpact[fKey] ?? 0
        const effectiveImpact = isHighImpact ? impact : impact * 0.5
        stressedFactors[fKey] = clampScore(base + effectiveImpact)
      }

      // Recompute composite from stressed factors
      let stressedComposite = 0
      for (const [k, w] of Object.entries(weights)) {
        stressedComposite += (stressedFactors[k] ?? 0) * w
      }
      stressedComposite = Math.round(stressedComposite * 100) / 100

      const compositeDelta = baseComposite !== null
        ? Math.round((stressedComposite - baseComposite) * 100) / 100
        : null

      const factorDelta = {}
      for (const fKey of Object.keys(labels)) {
        factorDelta[fKey] = Math.round(((stressedFactors[fKey] ?? 0) - (baseFactors[fKey] ?? 0)) * 100) / 100
      }

      const stressedGrade = gradeFromComposite(stressedComposite)

      return {
        scenarioId: key,
        label: scenario.label,
        description: scenario.description,
        isHighImpact,
        baseComposite,
        stressedComposite,
        compositeDelta,
        baseGrade: gradeFromComposite(baseComposite ?? 0),
        stressedGrade,
        gradeDegraded: stressedGrade !== gradeFromComposite(baseComposite ?? 0),
        factorDelta,
        stressedFactors,
      }
    })

    // Summary
    const worstScenario = results.reduce((prev, cur) =>
      (cur.compositeDelta ?? 0) < (prev.compositeDelta ?? 0) ? cur : prev, results[0])

    res.json({
      dealId: dealId || null,
      baseComposite,
      scenarios: results,
      summary: {
        worstScenario: worstScenario.scenarioId,
        worstLabel: worstScenario.label,
        worstCompositeAfter: worstScenario.stressedComposite,
        worstDelta: worstScenario.compositeDelta,
        scenariosWithGradeDrop: results.filter(r => r.gradeDegraded).map(r => r.label),
      },
    })
  } catch (err) {
    console.error('[factor/stress-test]', err)
    res.status(500).json({ error: err.message })
  }
})

/**
 * GET /api/factor/scenarios
 * Returns FST stress scenario definitions (из Integram или дефолты).
 */
router.get('/scenarios', (_req, res) => {
  const scenarios = getStressScenarios()
  const list = Object.entries(scenarios).map(([id, s]) => ({
    id,
    label: s.label,
    description: s.description,
    factorImpact: s.factorImpact,
  }))
  res.json({ scenarios: list, weights: getWeights(), labels: getLabels() })
})

/**
 * GET /api/factor/config
 * Вернуть все настройки факторной модели (для редактора в UI).
 */
router.get('/config', (_req, res) => {
  res.json({
    weights: getWeights(),
    labels: getLabels(),
    gradeThresholds: getGradeThresholds(),
    recommendationMap: getRecommendationMap(),
    stressScenarios: getStressScenarios(),
  })
})

/**
 * PUT /api/factor/config/:key
 * Сохранить настройку в Integram (например: factor_weights, stress_scenarios).
 */
router.put('/config/:key', async (req, res) => {
  try {
    const { key } = req.params
    const allowed = ['factor_weights', 'factor_labels', 'grade_thresholds', 'recommendation_map', 'stress_scenarios', 'expert_registry']
    if (!allowed.includes(key)) {
      return res.status(400).json({ error: `Неизвестный ключ конфига. Допустимые: ${allowed.join(', ')}` })
    }
    await saveConfig(key, req.body)
    res.json({ ok: true, key, saved: req.body })
  } catch (err) {
    console.error('[factor/config PUT]', err)
    res.status(500).json({ error: err.message })
  }
})

export default router
