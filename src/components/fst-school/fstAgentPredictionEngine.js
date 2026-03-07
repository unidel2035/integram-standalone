/**
 * fstAgentPredictionEngine.js — AI prediction generation per agent
 *
 * Each agent applies its core framework to generate predictions on:
 *   - Manifold Markets (YES/NO questions)
 *   - Metaculus questions (probability estimates)
 *   - Crypto markets (directional + probability)
 *
 * The agent's "memory" = its past predictions + Brier scores, passed as context.
 * Tit-for-Tat: agents with higher accuracy get lower temperature (more confident).
 */

const AI_ENDPOINT = '/api/ai-tokens/chat'
const CALC_ENDPOINT = '/api/calc'
const MODEL = 'deepseek/deepseek-chat'

// ── Real calculator calls ─────────────────────────────────────────────────────
// Each agent calls the real /api/calc/* endpoint BEFORE AI prompt.
// Results are injected into the prompt — AI interprets numbers, not computes them.

async function callCalc(tool, body) {
  try {
    const res = await fetch(`${CALC_ENDPOINT}/${tool}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) return null
    const data = await res.json()
    return data.ok ? data.result : null
  } catch {
    return null
  }
}

/**
 * Build real calculator evidence for each agent type.
 * Returns { calcName, calcInput, calcResult, calcSummary }
 */
async function runAgentCalculator(agentId, market) {
  const p = market.probability ? market.probability / 100 : 0.5

  switch (agentId) {
    case 'monte_carlo': {
      const sigma = market.category === 'crypto' ? 0.6 : market.category === 'startup' ? 0.75 : 0.2
      const result = await callCalc('var', { mu: p - 0.5, sigma, horizon: 1 })
      return result ? {
        calcName: 'Monte Carlo VaR',
        calcInput: { mu: p - 0.5, sigma, horizon: 1 },
        calcResult: result,
        calcSummary: `σ=${result.sigma}%, VaR(95%)=${result.var95}%, CVaR=${result.cvar}%, ожидаемый исход=${result.expectedReturn}%`,
      } : null
    }

    case 'bayesian': {
      // Build signals from market context
      const signals = []
      if (market.probability) signals.push({ likelihood: market.probability > 50 ? 0.75 : 0.35, label: `Рыночный консенсус ${market.probability}%` })
      if (market.change24h != null) signals.push({ likelihood: market.change24h > 0 ? 0.65 : 0.4, label: `24h тренд ${market.change24h > 0 ? '+' : ''}${market.change24h?.toFixed(1)}%` })
      if (market.category === 'crypto') signals.push({ likelihood: 0.55, label: 'Крипто = высокая волатильность' })
      const result = await callCalc('bayesian', { prior: 0.4, signals })
      return result ? {
        calcName: 'Bayesian Update',
        calcInput: { prior: 0.4, signals },
        calcResult: result,
        calcSummary: `P₀=40% → ${result.steps.map(s => `${s.label}: ${s.probability}%`).join(' → ')} → итог ${result.posterior}%. ${result.planningFallacyWarning ? '⚠ Planning Fallacy!' : ''}`,
      } : null
    }

    case 'real_options': {
      const S = market.currentPrice || 100
      const K = S * 1.1
      const result = await callCalc('blackscholes', { S, K, T: 0.5, r: 0.05, sigma: 0.45 })
      return result ? {
        calcName: 'Black-Scholes Real Options',
        calcInput: { S, K, T: 0.5, r: 0.05, sigma: 0.45 },
        calcResult: result,
        calcSummary: `S=${S}, K=${K}, опцион ожидания=${result.callValue}, P(исполнения)=${result.impliedProbability}%, delta=${result.delta}`,
      } : null
    }

    case 'finance': {
      // Simplified DCF: project 3 years of cash flows
      const base = (market.probability || 50) * 10
      const flows = [base, base * 1.3, base * 1.7, base * 2.2]
      const [dcfResult, irrResult, kellyResult] = await Promise.all([
        callCalc('dcf', { cashFlows: flows, wacc: 0.25, terminalGrowth: 0.03 }),
        callCalc('irr', { cashFlows: [-base * 5, ...flows] }),
        callCalc('kelly', { p: Math.max(0.1, Math.min(0.9, p)), b: 2.0, fraction: 0.25 }),
      ])
      return {
        calcName: 'DCF + IRR + Kelly',
        calcInput: { cashFlows: flows, wacc: 0.25 },
        calcResult: { dcf: dcfResult, irr: irrResult, kelly: kellyResult },
        calcSummary: [
          dcfResult  ? `DCF NPV=${dcfResult.npv}, итого=${dcfResult.totalValue}` : '',
          irrResult  ? `IRR=${irrResult.irr}%` : '',
          kellyResult ? `Kelly f*=${kellyResult.kellyFractional}% (${kellyResult.recommendation})` : '',
        ].filter(Boolean).join(' | '),
      }
    }

    case 'risk': {
      const sigma = market.category === 'crypto' ? 0.65 : 0.3
      const result = await callCalc('var', { mu: p - 0.5, sigma, horizon: 5, confidence: 0.99 })
      return result ? {
        calcName: 'VaR + CVaR (FMEA)',
        calcInput: { sigma, horizon: 5, confidence: 0.99 },
        calcResult: result,
        calcSummary: `VaR(99%,5д)=${result.var99}%, CVaR=${result.cvar}%, σ=${result.sigma}%`,
      } : null
    }

    case 'portfolio': {
      const result = await callCalc('portfolio', {
        assets: [
          { name: market.title?.slice(0, 15) || 'Asset', weight: 0.3, expectedReturn: p - 0.5, volatility: 0.4 },
          { name: 'Market', weight: 0.4, expectedReturn: 0.08, volatility: 0.2 },
          { name: 'Cash',   weight: 0.3, expectedReturn: 0.05, volatility: 0.01 },
        ],
      })
      return result ? {
        calcName: 'Portfolio Theory',
        calcInput: { weight: 0.3, assetReturn: p - 0.5 },
        calcResult: result,
        calcSummary: `Портфельная доходность=${result.expectedReturn}%, волатильность=${result.volatility}%, Sharpe=${result.sharpe}, диверсификация=${result.diversificationBenefit}%`,
      } : null
    }

    case 'game_theory': {
      const result = await callCalc('nash', {
        votes: { bull: Math.max(0.01, p), bear: Math.max(0.01, 1 - p), neutral: 0.5 },
      })
      return result ? {
        calcName: 'Nash Equilibrium',
        calcInput: { bull: p, bear: 1 - p },
        calcResult: result,
        calcSummary: `Консенсус: ${result.consensus}, Nash: ${result.isNash ? '✓' : '✗'}, стабильность ${result.stability}%, Schelling point=${result.schellingPoint}%`,
      } : null
    }

    default:
      return null
  }
}

// ── Agent-specific prediction frameworks ─────────────────────────────────────

const PREDICTION_ALGORITHMS = {
  monte_carlo: {
    algorithm: 'Monte Carlo + VaR',
    systemPrompt: `Ты квантовый предсказатель, работающий методом Монте-Карло.
Для КАЖДОГО предсказания:
1. Оцени волатильность σ (для крипто σ=40-80%, для стартапов σ=60-90%, для макро σ=15-30%)
2. Запусти мысленно N=500 симуляций Box-Muller
3. Вычисли P(событие наступит) = доля симуляций где исход = YES
4. VaR(95%): 5-й перцентиль симуляций
5. Назови E[исход], медиану, VaR
ВЫВОД строго JSON.`,
    temperature: 0.3,
  },

  bayesian: {
    algorithm: 'Bayesian Update + Reference Class',
    systemPrompt: `Ты байесовский предсказатель. Для КАЖДОГО предсказания:
1. Выбери референсный класс (похожие исторические события)
2. Установи приорную вероятность P0 из базовой ставки (base rate)
3. Для каждого сигнала обнови: P_new = P(signal|event) × P0 / P(signal)
4. Укажи каждое обновление: P0=X% → сигнал Y → P=Z%
5. Предупреди о planning fallacy если прогноз >80% или <20%
ВЫВОД строго JSON.`,
    temperature: 0.2,
  },

  market_timing: {
    algorithm: 'Howard Marks Cycle + Why Now',
    systemPrompt: `Ты аналитик рыночных циклов (Говард Маркс). Для КАЖДОГО предсказания:
1. Определи положение в цикле (1-10 по шкале Маркса)
2. Сформулируй ответ на "Почему именно сейчас?"
3. Определи конкурентное окно: сколько времени до изменения ситуации
4. Оцени риск преждевременности vs риск промедления
5. Дай вероятность P(YES) с учётом цикличности
ВЫВОД строго JSON.`,
    temperature: 0.4,
  },

  real_options: {
    algorithm: 'Real Options Valuation (ROV)',
    systemPrompt: `Ты аналитик реальных опционов. Для КАЖДОГО предсказания:
1. Оцени как опцион: S=текущая цена, K=цена исполнения, T=горизонт, σ=волатильность
2. Высокая волатильность = ценный опцион ожидания
3. Применяй биномиальное дерево: up factor = e^(σ√t), down factor = 1/up
4. P(YES) = риск-нейтральная вероятность роста
5. Учти ценность возможности "подождать и посмотреть"
ВЫВОД строго JSON.`,
    temperature: 0.3,
  },

  power_score: {
    algorithm: '7 Powers + Power Law',
    systemPrompt: `Ты аналитик стратегических моатов и Power Law. Для КАЖДОГО предсказания:
1. Оцени наличие 7 Powers (Scale, Network, Counter, Switch, Brand, Cornered, Process)
2. Проверь Power Law потенциал: может ли это дать 50x?
3. Для крипто: сетевые эффекты → P(рост)?
4. Для стартапов: winner-takes-all динамика → P(доминирование)?
5. P(YES) основана на силе моата и Power Law позиции
ВЫВОД строго JSON.`,
    temperature: 0.4,
  },

  game_theory: {
    algorithm: 'Nash Equilibrium + Schelling Points',
    systemPrompt: `Ты игровой стратег. Для КАЖДОГО предсказания:
1. Определи игроков и их стратегии
2. Найди Nash Equilibrium: кто выиграет при оптимальной игре всех участников?
3. Шеллинговые точки: на чём рынок "сфокусируется"?
4. Cooperative vs competitive dynamics: что выгоднее агрегированно?
5. P(YES) = вероятность Nash outcome в пользу события
ВЫВОД строго JSON.`,
    temperature: 0.3,
  },

  finance: {
    algorithm: 'DCF + IRR + Unit Economics',
    systemPrompt: `Ты финансовый аналитик. Для КАЖДОГО предсказания:
1. Построй упрощённый DCF: основные CF, ставка дисконта = WACC
2. Оцени IRR при оптимистичном и пессимистичном сценарии
3. Unit economics: CAC/LTV, burn rate, runway
4. P(YES) = вероятность положительного финансового исхода
5. Kelly criterion: f* = (p×b-q)/b — оптимальная "ставка"
ВЫВОД строго JSON.`,
    temperature: 0.2,
  },

  risk: {
    algorithm: 'FMEA + VaR + Stress Test',
    systemPrompt: `Ты риск-менеджер (pessimist by design). Для КАЖДОГО предсказания:
1. FMEA: Failure Mode Analysis — что может пойти не так?
2. Рассчитай VaR(95%): максимальные потери в 95% сценариев
3. Стресс-тест: что если σ в 2 раза выше ожидаемой?
4. P(YES) = взвешенная на риски вероятность (всегда ниже наивной)
5. Предлагай митигации
ВЫВОД строго JSON.`,
    temperature: 0.2,
  },

  tech: {
    algorithm: 'TRL/MRL + Technology Readiness',
    systemPrompt: `Ты технический аналитик. Для КАЖДОГО предсказания:
1. Оцени TRL (1-9) если применимо
2. Продуктовая зрелость: прото / MVP / PMF / scaling?
3. Техническая осуществимость: есть ли барьеры?
4. Adoption curve: где на S-кривой?
5. P(YES) = вероятность технической успешности события
ВЫВОД строго JSON.`,
    temperature: 0.3,
  },

  sovereignty: {
    algorithm: 'Geopolitical Risk + Import Substitution',
    systemPrompt: `Ты эксперт геополитических рисков. Для КАЖДОГО предсказания:
1. Оцени геополитический контекст
2. Зависимость от иностранных технологий/цепочек поставок?
3. Регуляторные риски: санкции, ограничения, лицензии
4. P(YES) = вероятность с учётом геополитики
5. Для крипто: регуляторный риск по юрисдикциям
ВЫВОД строго JSON.`,
    temperature: 0.3,
  },

  portfolio: {
    algorithm: 'Portfolio Theory + Correlations',
    systemPrompt: `Ты портфельный стратег. Для КАЖДОГО предсказания:
1. Корреляция с существующими активами?
2. Диверсификационный эффект
3. Sharpe ratio: доходность/риск
4. P(YES) как вклад в портфельный результат
5. Мыслишь об активах как о системе, не по отдельности
ВЫВОД строго JSON.`,
    temperature: 0.3,
  },

  devil: {
    algorithm: 'Devil\'s Advocate + Black Swan',
    systemPrompt: `Ты критик и поисковик чёрных лебедей. Для КАЖДОГО предсказания:
1. Назови 3 причины, почему НЕ произойдёт (даже если все верят что произойдёт)
2. Какой скрытый риск все игнорируют?
3. Нарративная ловушка: не путай "желаемое" с "вероятным"
4. Black Swan check: сценарий с p=1% но catastrophic impact
5. P(YES) почти всегда ниже консенсуса
ВЫВОД строго JSON.`,
    temperature: 0.5,
  },
}

// ── Main: generate prediction ─────────────────────────────────────────────────

/**
 * Generate a prediction for a given agent and market.
 * The agent's past predictions (memory) are included in context.
 *
 * @param {string} agentId  - agent ID (e.g. 'monte_carlo')
 * @param {Object} market   - market object from fstPredictionService
 * @param {Array}  memory   - agent's past predictions (for Tit-for-Tat context)
 * @param {Object} stats    - agent's current stats (accuracy, brierScore)
 * @returns {Object}        - prediction object ready to save
 */
/**
 * @param {string}   agentId
 * @param {Object}   market
 * @param {Array}    memory
 * @param {Object}   stats
 * @param {Function} onStep  - optional callback: onStep({ stage, data })
 *   stages: 'integram' | 'calc' | 'llm' | 'saving' | 'done' | 'error'
 */
export async function generatePrediction(agentId, market, memory = [], stats = {}, onStep = null) {
  const step = (stage, data = {}) => onStep?.({ stage, agentId, ...data })

  const algo = PREDICTION_ALGORITHMS[agentId]
  if (!algo) throw new Error(`Unknown agent: ${agentId}`)

  // ── Step 1: Integram — получаем данные рынка ────────────────────────────────
  step('integram', { label: 'Загрузка данных рынка', market: market.title, probability: market.probability })

  // ── Step 2: Run real calculator FIRST (proof of real math) ──────────────────
  step('calc', { label: 'Запуск калькулятора...', calcName: null })
  const calcEvidence = await runAgentCalculator(agentId, market)
  step('calc_done', {
    label: calcEvidence ? calcEvidence.calcName : 'нет калькулятора',
    calcSummary: calcEvidence?.calcSummary || '',
    calcName: calcEvidence?.calcName || null,
  })

  const memoryContext = _buildMemoryContext(agentId, memory, stats)
  const marketContext = _buildMarketContext(market)
  const outputSchema  = _buildOutputSchema(market)

  // Inject calculator results into prompt — AI interprets numbers, not computes them
  const calcContext = calcEvidence
    ? `\nРЕЗУЛЬТАТЫ КАЛЬКУЛЯТОРА (${calcEvidence.calcName}) — ИСПОЛЬЗУЙ ЭТИ ЧИСЛА:\n${calcEvidence.calcSummary}\n`
    : ''

  const prompt = `${marketContext}
${calcContext}
${memoryContext}

ЗАДАЧА: Сделай предсказание для этого рынка, используя твой алгоритм ${algo.algorithm}.
${calcEvidence ? 'Калькулятор уже посчитал числа выше — используй их как доказательную базу.' : ''}

${outputSchema}

Твой ответ СТРОГО в JSON формате. Только JSON, никакого текста вокруг.`

  try {
    // ── Step 3: LLM analysis ─────────────────────────────────────────────────
    step('llm', { label: 'DeepSeek анализирует...' })

    const res = await fetch('/api/ai-tokens/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        modelId: MODEL,
        prompt,
        systemPrompt: algo.systemPrompt,
        application: `AgentSchool_${agentId}`,
        temperature: algo.temperature,
      }),
      signal: AbortSignal.timeout(25000),
    })
    if (!res.ok) throw new Error(`AI HTTP ${res.status}`)
    const data = await res.json()
    const raw = data.response || ''

    // Extract JSON from response
    const json = _parseJsonResponse(raw)
    if (!json) throw new Error('No JSON in response')

    const probability = Math.round(Math.max(1, Math.min(99, json.probability ?? 50)))
    const confidence = Math.round(Math.max(10, Math.min(99, json.confidence ?? 60)))

    // ── Step 4: Done — signal result before returning ────────────────────────
    step('done', { probability, confidence, label: `${probability}% YES` })

    return {
      agentId,
      platform: market.platform,
      marketId: market.id,
      title: market.title,
      probability,
      direction: probability > 50 ? 'yes' : 'no',
      confidence,
      reasoning: json.reasoning || json.explanation || '',
      nashReasoning: json.nash_analysis || '',
      algorithm: algo.algorithm,
      category: market.category || 'other',
      closeTime: market.closeTime,
      context: market.context || {},
      // ── Audit trail — visible to users as proof ──────────────────────────────
      calcAudit: calcEvidence ? {
        name: calcEvidence.calcName,
        input: calcEvidence.calcInput,
        result: calcEvidence.calcResult,
        summary: calcEvidence.calcSummary,
      } : null,
      _raw: json,
    }
  } catch (e) {
    step('error', { message: e.message })
    console.warn(`[PredEngine] ${agentId} failed:`, e.message)
    // Fallback: algorithmic prediction without AI
    return _fallbackPrediction(agentId, market, algo)
  }
}

/**
 * Generate predictions from ALL agents for a given market (agent tournament).
 */
export async function runAgentTournament(market, agents, memory = {}, stats = {}) {
  const results = []

  for (const agent of agents) {
    try {
      const agentMemory = memory[agent.id] || []
      const agentStats  = stats[agent.id] || {}
      const pred = await generatePrediction(agent.id, market, agentMemory, agentStats)
      results.push({ agent, prediction: pred })
    } catch (e) {
      console.warn(`Tournament: ${agent.id} skip:`, e.message)
    }
    // Small delay to avoid rate limits
    await new Promise(r => setTimeout(r, 300))
  }

  return results
}

// ── Context Builders ──────────────────────────────────────────────────────────

function _buildMemoryContext(agentId, memory, stats) {
  if (!memory.length && !stats.total) return 'Это твоё первое предсказание. Опыта пока нет.'

  const lines = [`ТВОЯ ПАМЯТЬ (${agentId}):`,
    `Всего предсказаний: ${stats.total || 0}`,
    `Точность: ${stats.accuracy || 0}%`,
  ]
  if (stats.avgBrier != null) lines.push(`Brier Score: ${stats.avgBrier} (0=идеально, 0.25=случайно)`)
  if (stats.brierSkill != null) lines.push(`Skill Score vs случайного: ${stats.brierSkill}%`)

  const recent = memory.slice(-5)
  if (recent.length) {
    lines.push('\nПоследние предсказания:')
    for (const p of recent) {
      const outcome = p.status === 'correct' ? '✓' : p.status === 'wrong' ? '✗' : '?'
      lines.push(`  ${outcome} "${p.title.slice(0, 60)}..." → предск.: ${p.probability}%, исход: ${p.actualOutcome || '?'}%, Brier: ${p.brierScore || '?'}`)
    }
  }

  // Identify weaknesses
  if (stats.byCategory) {
    const weak = Object.entries(stats.byCategory)
      .filter(([, s]) => s.total >= 3 && s.correct / s.total < 0.5)
      .map(([cat]) => cat)
    if (weak.length) lines.push(`\nТвои слабые категории (< 50%): ${weak.join(', ')}. Будь осторожнее.`)
  }

  return lines.join('\n')
}

function _buildMarketContext(market) {
  const lines = ['РЫНОК ДЛЯ ПРЕДСКАЗАНИЯ:', `Вопрос: "${market.title}"`, `Платформа: ${market.platform}`]

  if (market.probability) lines.push(`Текущий консенсус рынка: ${market.probability}%`)
  if (market.currentPrice) lines.push(`Текущая цена: $${market.currentPrice.toLocaleString()}`)
  if (market.change24h) lines.push(`Изменение 24h: ${market.change24h > 0 ? '+' : ''}${market.change24h.toFixed(2)}%`)
  if (market.horizon) lines.push(`Горизонт: ${market.horizon}`)
  if (market.closeTime) lines.push(`Дата разрешения: ${new Date(market.closeTime).toLocaleDateString('ru')}`)
  if (market.context?.resolution) lines.push(`Условие разрешения: ${market.context.resolution}`)

  return lines.join('\n')
}

function _buildOutputSchema(market) {
  return `ОБЯЗАТЕЛЬНЫЙ JSON ФОРМАТ:
{
  "probability": <число 1-99, твоя оценка P(YES)>,
  "confidence": <число 10-99, твоя уверенность в оценке>,
  "reasoning": "<2-4 предложения: ключевые факторы и расчёты>",
  "nash_analysis": "<1-2 предложения: Nash/игровой аспект>",
  "algorithm_steps": "<ключевые шаги твоего алгоритма>",
  "contrarian_flag": <true если твоя оценка расходится с консенсусом >15%>
}`
}

// ── Fallback ──────────────────────────────────────────────────────────────────

function _fallbackPrediction(agentId, market, algo) {
  // Each agent has systematic bias in fallback
  const biasMap = {
    monte_carlo:  0, bayesian: -5, market_timing: -10, real_options: +8,
    power_score: +5, game_theory: 0, finance: -8, risk: -15,
    tech: 0, sovereignty: -5, portfolio: +3, devil: -20,
  }
  const bias = biasMap[agentId] || 0
  const base = market.probability || 50
  const prob = Math.max(5, Math.min(95, base + bias + (Math.random() - 0.5) * 10))

  return {
    agentId,
    platform: market.platform,
    marketId: market.id,
    title: market.title,
    probability: Math.round(prob),
    direction: prob > 50 ? 'yes' : 'no',
    confidence: 40,
    reasoning: `[Fallback] ${algo.algorithm}: оценка на основе систематического подхода агента.`,
    nashReasoning: '',
    algorithm: algo.algorithm,
    category: market.category || 'other',
    closeTime: market.closeTime,
    context: market.context || {},
  }
}

function _parseJsonResponse(text) {
  // Try to extract JSON from various formats
  const jsonMatch = text.match(/\{[\s\S]+\}/)
  if (!jsonMatch) return null
  try { return JSON.parse(jsonMatch[0]) } catch { return null }
}
