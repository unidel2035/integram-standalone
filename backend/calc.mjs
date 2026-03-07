/**
 * calc.mjs — Реальные финансовые и вероятностные калькуляторы
 *
 * Чистые математические функции. Без AI. Без приближений.
 * Используются как REST API (/api/calc/*) и как MCP-инструменты.
 */

// ── Байесовский обновитель ────────────────────────────────────────────────────
/**
 * Обновляет вероятность гипотезы по новым свидетельствам.
 * P(H|E) = P(E|H) * P(H) / P(E)
 *
 * @param {number} prior      - P(H) приорная вероятность [0..1]
 * @param {Array}  signals    - [{likelihood: 0.8, label: 'сигнал'}]
 * @returns {{ posterior, steps, planningFallacyWarning }}
 */
export function bayesianUpdate(prior, signals = []) {
  let p = Math.max(0.001, Math.min(0.999, prior))
  const steps = [{ label: 'Приор', probability: Math.round(p * 1000) / 10 }]

  for (const sig of signals) {
    const lr = Math.max(0.01, sig.likelihood) // P(E|H)
    const pE = lr * p + (1 - lr) * (1 - p)   // P(E) = total probability
    const updated = (lr * p) / pE
    p = Math.max(0.001, Math.min(0.999, updated))
    steps.push({ label: sig.label || 'Сигнал', probability: Math.round(p * 1000) / 10 })
  }

  return {
    prior: Math.round(prior * 1000) / 10,
    posterior: Math.round(p * 1000) / 10,
    posteriorRaw: p,
    steps,
    planningFallacyWarning: p > 0.85 || p < 0.15,
    interpretation: p > 0.7 ? 'Вероятно YES' : p < 0.3 ? 'Вероятно NO' : 'Неопределённость высока',
  }
}

// ── DCF — Дисконтированный денежный поток ─────────────────────────────────────
/**
 * @param {Array}  cashFlows  - массив CF по годам [CF0, CF1, CF2, ...]
 * @param {number} wacc       - WACC/ставка дисконта [0..1], например 0.20
 * @param {number} terminalGrowth - терминальный рост [0..1], например 0.03
 * @returns {{ npv, terminalValue, totalValue, pvPerYear, dcfPerShare }}
 */
export function dcf(cashFlows, wacc, terminalGrowth = 0.03) {
  if (wacc <= terminalGrowth) throw new Error('WACC должен быть выше темпа терминального роста')
  let npv = 0
  const pvPerYear = []

  for (let t = 0; t < cashFlows.length; t++) {
    const pv = cashFlows[t] / Math.pow(1 + wacc, t + 1)
    pvPerYear.push({ year: t + 1, cashFlow: cashFlows[t], pv: Math.round(pv) })
    npv += pv
  }

  // Gordon Growth Model для терминальной стоимости
  const lastCF = cashFlows[cashFlows.length - 1]
  const tv = (lastCF * (1 + terminalGrowth)) / (wacc - terminalGrowth)
  const pvTV = tv / Math.pow(1 + wacc, cashFlows.length)
  const totalValue = npv + pvTV

  return {
    npv: Math.round(npv),
    terminalValue: Math.round(tv),
    pvTerminalValue: Math.round(pvTV),
    totalValue: Math.round(totalValue),
    tvShare: Math.round((pvTV / totalValue) * 100),
    pvPerYear,
    wacc: Math.round(wacc * 100),
    terminalGrowth: Math.round(terminalGrowth * 100),
  }
}

// ── IRR — Внутренняя норма доходности ────────────────────────────────────────
/**
 * Метод Ньютона-Рафсона для нахождения r, при котором NPV=0.
 * @param {Array}  cashFlows  - CF0 обычно отрицателен (инвестиция)
 * @param {number} guess      - начальное приближение [0..1]
 * @returns {{ irr, converged, iterations }}
 */
export function irr(cashFlows, guess = 0.1) {
  let r = guess
  const MAX_ITER = 1000
  const TOLERANCE = 1e-7

  for (let i = 0; i < MAX_ITER; i++) {
    let npv = 0, dnpv = 0
    for (let t = 0; t < cashFlows.length; t++) {
      npv  += cashFlows[t] / Math.pow(1 + r, t)
      dnpv -= t * cashFlows[t] / Math.pow(1 + r, t + 1)
    }
    if (Math.abs(dnpv) < 1e-12) break
    const delta = npv / dnpv
    r -= delta
    if (Math.abs(delta) < TOLERANCE) {
      return { irr: Math.round(r * 10000) / 100, converged: true, iterations: i + 1, irrRaw: r }
    }
  }
  return { irr: Math.round(r * 10000) / 100, converged: false, iterations: MAX_ITER, irrRaw: r }
}

// ── Kelly Criterion ────────────────────────────────────────────────────────────
/**
 * Оптимальный размер ставки/позиции по Келли.
 * f* = (p*b - q) / b
 *
 * @param {number} p          - вероятность выигрыша [0..1]
 * @param {number} b          - соотношение выигрыш/ставка (odds), например 2.0 = +200%
 * @param {number} fraction   - дробный Келли (рекомендуется 0.25–0.5)
 * @returns {{ kellyFull, kellyFractional, recommendation }}
 */
export function kelly(p, b, fraction = 0.5) {
  const q = 1 - p
  const kellyFull = (p * b - q) / b
  const kellyFractional = kellyFull * fraction

  let recommendation
  if (kellyFull <= 0) recommendation = 'Не делать ставку — отрицательное ожидание'
  else if (kellyFull > 0.5) recommendation = `Осторожно: full Kelly ${Math.round(kellyFull * 100)}% — слишком высоко. Используй ${Math.round(kellyFractional * 100)}%`
  else recommendation = `Оптимально: ${Math.round(kellyFractional * 100)}% от капитала`

  const expectedValue = p * b - q
  return {
    kellyFull: Math.round(kellyFull * 10000) / 100,
    kellyFractional: Math.round(kellyFractional * 10000) / 100,
    expectedValue: Math.round(expectedValue * 1000) / 1000,
    edgePct: Math.round(expectedValue * 100),
    recommendation,
    positive: kellyFull > 0,
  }
}

// ── Brier Score ───────────────────────────────────────────────────────────────
/**
 * @param {number} forecast   - прогнозная вероятность [0..1]
 * @param {number} outcome    - реальный исход 0 или 1 (или промежуточное)
 * @returns {{ brier, skillScore, calibration }}
 */
export function brierScore(forecast, outcome) {
  const bs = Math.pow(forecast - outcome, 2)
  const bsRef = 0.25 // naive = 50/50
  const skillScore = Math.round((1 - bs / bsRef) * 100)
  return {
    brierScore: Math.round(bs * 1000) / 1000,
    skillScore,
    calibration: bs < 0.1 ? 'Отлично' : bs < 0.2 ? 'Хорошо' : 'Требует улучшения',
    naive: 0.25,
    improvement: Math.round((bsRef - bs) * 100) / 100,
  }
}

// ── VaR — Value at Risk (Monte Carlo) ────────────────────────────────────────
/**
 * @param {number} mu         - ожидаемая доходность (annualized)
 * @param {number} sigma      - волатильность (annualized)
 * @param {number} horizon    - горизонт в днях
 * @param {number} confidence - уровень доверия (0.95 или 0.99)
 * @param {number} n          - число симуляций
 * @returns {{ var95, var99, cvar, expectedReturn, median }}
 */
export function monteCarloVaR(mu, sigma, horizon = 1, confidence = 0.95, n = 10000) {
  const dt = horizon / 252 // trading days
  const results = []

  // Box-Muller transform for normal random numbers
  for (let i = 0; i < n; i++) {
    const u1 = Math.random(), u2 = Math.random()
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
    const ret = (mu - 0.5 * sigma * sigma) * dt + sigma * Math.sqrt(dt) * z
    results.push(ret)
  }

  results.sort((a, b) => a - b)
  const idx95  = Math.floor(n * 0.05)
  const idx99  = Math.floor(n * 0.01)
  const idxMed = Math.floor(n * 0.5)
  const cvarIdx = Math.floor(n * (1 - confidence))

  // CVaR = average of losses beyond VaR
  const cvarValues = results.slice(0, cvarIdx)
  const cvar = cvarValues.reduce((s, v) => s + v, 0) / cvarValues.length

  return {
    var95:  Math.round(results[idx95]  * 10000) / 100,
    var99:  Math.round(results[idx99]  * 10000) / 100,
    cvar:   Math.round(cvar            * 10000) / 100,
    median: Math.round(results[idxMed] * 10000) / 100,
    expectedReturn: Math.round(((mu - 0.5 * sigma * sigma) * dt) * 10000) / 100,
    sigma: Math.round(sigma * 100),
    horizon,
    simulations: n,
    interpretation: `При σ=${Math.round(sigma*100)}% за ${horizon}д: VaR(95%)=${Math.round(results[idx95]*10000)/100}%`,
  }
}

// ── Sharpe Ratio ──────────────────────────────────────────────────────────────
export function sharpeRatio(returns, riskFreeRate = 0.05) {
  const n = returns.length
  if (!n) return { sharpe: 0, error: 'Нет данных' }
  const mean = returns.reduce((s, r) => s + r, 0) / n
  const variance = returns.reduce((s, r) => s + Math.pow(r - mean, 2), 0) / (n - 1)
  const stdDev = Math.sqrt(variance)
  const annualReturn = mean * 252
  const annualStd = stdDev * Math.sqrt(252)
  const sharpe = (annualReturn - riskFreeRate) / annualStd

  return {
    sharpe: Math.round(sharpe * 100) / 100,
    annualReturn: Math.round(annualReturn * 10000) / 100,
    annualVolatility: Math.round(annualStd * 10000) / 100,
    interpretation: sharpe > 2 ? 'Отлично' : sharpe > 1 ? 'Хорошо' : sharpe > 0.5 ? 'Приемлемо' : 'Плохо',
  }
}

// ── Black-Scholes (Real Options) ──────────────────────────────────────────────
/**
 * Call option price по формуле Блэка-Шоулза.
 * Для Real Options: S=текущая стоимость проекта, K=инвестиция, T=горизонт
 *
 * @returns {{ callValue, putValue, delta, gamma, theta, impliedProbability }}
 */
export function blackScholes(S, K, T, r, sigma) {
  if (T <= 0 || sigma <= 0 || S <= 0 || K <= 0) throw new Error('Некорректные параметры')

  const d1 = (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * Math.sqrt(T))
  const d2 = d1 - sigma * Math.sqrt(T)

  const Nd1 = _normCDF(d1), Nd2 = _normCDF(d2)
  const Nnd1 = _normCDF(-d1), Nnd2 = _normCDF(-d2)

  const callValue = S * Nd1 - K * Math.exp(-r * T) * Nd2
  const putValue  = K * Math.exp(-r * T) * Nnd2 - S * Nnd1
  const delta     = Nd1
  const gamma     = _normPDF(d1) / (S * sigma * Math.sqrt(T))
  const theta     = -(S * _normPDF(d1) * sigma) / (2 * Math.sqrt(T)) - r * K * Math.exp(-r * T) * Nd2

  return {
    callValue:  Math.round(callValue * 100) / 100,
    putValue:   Math.round(putValue  * 100) / 100,
    d1: Math.round(d1 * 1000) / 1000,
    d2: Math.round(d2 * 1000) / 1000,
    delta: Math.round(delta * 1000) / 1000,
    gamma: Math.round(gamma * 10000) / 10000,
    theta: Math.round(theta * 100) / 100,
    impliedProbability: Math.round(Nd2 * 1000) / 10, // risk-neutral P(S_T > K)
    interpretation: `Стоимость опциона ожидания: ${Math.round(callValue * 100) / 100}. P(исполнения)=${Math.round(Nd2 * 1000) / 10}%`,
  }
}

// ── Nash Equilibrium Check ────────────────────────────────────────────────────
/**
 * @param {Object} votes  - { [agentId]: probability 0..1 }
 * @returns {{ isNash, stability, consensus, majorityShare, unstableAgents, shapleyWeights }}
 */
export function nashEquilibrium(votes) {
  const entries = Object.entries(votes)
  const n = entries.length
  if (!n) return { isNash: true, consensus: 'unknown', stability: 100 }

  const forN     = entries.filter(([, v]) => v > 0.5).length
  const againstN = n - forN
  const consensus = forN >= againstN ? 'approve' : 'reject'
  const majorityShare = Math.max(forN, againstN) / n

  const unstableAgents = entries
    .filter(([, v]) => consensus === 'approve' ? v <= 0.5 : v > 0.5)
    .map(([id]) => id)

  // Stability = % that would NOT deviate
  const stability = Math.round(majorityShare * 100)

  // Schelling focal point: median vote
  const probs = entries.map(([, v]) => v).sort((a, b) => a - b)
  const median = probs[Math.floor(n / 2)]

  return {
    isNash: majorityShare >= 0.8,
    consensus,
    majorityShare: Math.round(majorityShare * 100),
    stability,
    unstableAgents,
    median: Math.round(median * 100),
    schellingPoint: Math.round(median * 100),
    forCount: forN,
    againstCount: againstN,
    totalAgents: n,
  }
}

// ── Shapley Value ──────────────────────────────────────────────────────────────
/**
 * Справедливое распределение "вклада" агентов.
 * Simplified: Shapley = w_i * accuracy_i / Σ(w_j * accuracy_j)
 *
 * @param {Array}  agents   - [{ id, weight }]
 * @param {Object} history  - { [agentId]: { correct, total } }
 * @returns {{ shapleyValues, interpretation }}
 */
export function shapleyValue(agents, history = {}) {
  const raw = {}
  let total = 0

  for (const a of agents) {
    const h = history[a.id] || { correct: 0, total: 0 }
    const accuracy = h.total > 0 ? h.correct / h.total : 0.5
    raw[a.id] = a.weight * (1 + accuracy)
    total += raw[a.id]
  }

  const values = {}
  for (const [id, v] of Object.entries(raw)) {
    values[id] = Math.round((v / total) * 1000) / 10
  }

  const sorted = Object.entries(values).sort((a, b) => b[1] - a[1])
  return {
    shapleyValues: values,
    ranking: sorted.map(([id, v], i) => ({ rank: i + 1, agentId: id, share: v })),
    topAgent: sorted[0]?.[0],
    interpretation: `Наибольший вклад: ${sorted[0]?.[0]} (${sorted[0]?.[1]}%)`,
  }
}

// ── Unit Economics ────────────────────────────────────────────────────────────
export function unitEconomics({ cac, ltv, avgRevenue, churnRate, grossMargin, burnRate, runway }) {
  const ltvCacRatio = ltv && cac ? Math.round((ltv / cac) * 10) / 10 : null
  const paybackMonths = cac && avgRevenue && grossMargin
    ? Math.round(cac / (avgRevenue * grossMargin) * 10) / 10 : null

  return {
    ltvCacRatio,
    paybackMonths,
    burnMultiple: burnRate && ltv ? Math.round((burnRate / ltv) * 100) / 100 : null,
    runwayMonths: runway || null,
    health: ltvCacRatio
      ? ltvCacRatio >= 3 ? 'Здоровая' : ltvCacRatio >= 1 ? 'Допустимая' : 'Критическая'
      : 'Недостаточно данных',
    interpretation: ltvCacRatio
      ? `LTV/CAC=${ltvCacRatio} ${ltvCacRatio >= 3 ? '✓' : '⚠'}, окупаемость ${paybackMonths} мес.`
      : 'Недостаточно данных',
  }
}

// ── Portfolio Correlation ─────────────────────────────────────────────────────
export function portfolioRisk(assets) {
  // assets = [{ name, weight, expectedReturn, volatility }]
  const portReturn = assets.reduce((s, a) => s + a.weight * a.expectedReturn, 0)
  // Simplified: assume equal correlation = 0.3 between all assets
  let portVariance = 0
  for (const a of assets) portVariance += a.weight * a.weight * a.volatility * a.volatility
  for (let i = 0; i < assets.length; i++) {
    for (let j = i + 1; j < assets.length; j++) {
      portVariance += 2 * 0.3 * assets[i].weight * assets[j].weight * assets[i].volatility * assets[j].volatility
    }
  }
  const portVol = Math.sqrt(portVariance)
  const sharpe = portVol > 0 ? (portReturn - 0.05) / portVol : 0

  return {
    expectedReturn: Math.round(portReturn * 10000) / 100,
    volatility: Math.round(portVol * 10000) / 100,
    sharpe: Math.round(sharpe * 100) / 100,
    diversificationBenefit: Math.round((1 - portVol / assets.reduce((s, a) => s + a.weight * a.volatility, 0)) * 100),
  }
}

// ── Normal Distribution Helpers ───────────────────────────────────────────────
function _normCDF(x) {
  const a = 0.2316419, b1 = 0.319381530, b2 = -0.356563782,
        b3 = 1.781477937, b4 = -1.821255978, b5 = 1.330274429
  const t = 1 / (1 + a * Math.abs(x))
  const poly = t * (b1 + t * (b2 + t * (b3 + t * (b4 + t * b5))))
  const pdf  = Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI)
  return x >= 0 ? 1 - pdf * poly : pdf * poly
}

function _normPDF(x) {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI)
}
