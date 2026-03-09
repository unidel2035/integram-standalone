/**
 * AgentToolRegistry.js — Инструменты агентов инвесткомитета
 *
 * Каждый агент получает набор инструментов по своей роли.
 * Инструменты описываются в system prompt как JSON-схемы.
 * LLM отвечает: {"action": "tool_call", "tool": "...", "args": {...}}
 * или:          {"action": "publish",   "text": "...", "dimension": ..., ...}
 */

// ── Схемы инструментов ────────────────────────────────────────────────────────

export const TOOL_SCHEMAS = {

  read_room: {
    name: 'read_room',
    description: 'Прочитать последние сообщения других агентов из зала дебатов. Используй перед публикацией, чтобы не повторяться и отвечать по существу.',
    params: { n: 'integer (1-12) — сколько сообщений читать' },
  },

  query_data: {
    name: 'query_data',
    description: 'Получить конкретные поля проекта из базы данных фонда.',
    params: {
      fields: 'array of string — список полей: trl, mrl, sovereigntyScore, projectedIRR, marketSize, requestedAmount, askRub, employees, teamStrength, localizationRatio, revenueYear1, stage, subFund, industry, risks, description',
    },
  },

  calc_irr: {
    name: 'calc_irr',
    description: 'Рассчитать IRR по денежным потокам методом Ньютона. Возвращает IRR в процентах.',
    params: {
      cashflows:           'array of number — CF по годам (млн руб)',
      initial_investment:  'number — начальные инвестиции (млн руб, положительное)',
    },
  },

  calc_npv: {
    name: 'calc_npv',
    description: 'Рассчитать NPV при заданном WACC. Возвращает NPV в млн руб.',
    params: {
      cashflows:           'array of number — CF по годам (млн руб)',
      initial_investment:  'number — инвестиции (млн руб)',
      wacc:                'number — ставка дисконтирования 0.0-1.0 (0.18 = 18%)',
    },
  },

  calc_monte_carlo: {
    name: 'calc_monte_carlo',
    description: 'Анализ Монте-Карло (1000 симуляций). Возвращает P(успех), медианный IRR, VaR.',
    params: {
      base_irr:    'number — базовый IRR проекта 0.0-1.0',
      volatility:  'number — волатильность CF 0.0-1.0 (обычно 0.3-0.5 для стартапа)',
    },
  },

  calc_power_score: {
    name: 'calc_power_score',
    description: 'Рассчитать Power Score по 7 Powers (Hamilton Helmer). Возвращает баллы и итог.',
    params: {
      scale_economies:    'number 0-10',
      network_economies:  'number 0-10',
      counter_positioning:'number 0-10',
      switching_costs:    'number 0-10',
      branding:           'number 0-10',
      cornered_resource:  'number 0-10',
      process_power:      'number 0-10',
    },
  },

  calc_bayesian: {
    name: 'calc_bayesian',
    description: 'Обновить байесовскую вероятность успеха. Возвращает P(успех|данные).',
    params: {
      prior:        'number 0-1 — априорная вероятность (базовая ставка по Reference Class)',
      evidence_up:  'array of number — сигналы, увеличивающие вероятность (likelihood ratios > 1)',
      evidence_down:'array of number — сигналы, снижающие вероятность (likelihood ratios < 1)',
    },
  },

  search_precedents: {
    name: 'search_precedents',
    description: 'Поиск прецедентов в базе знаний ФСТ: прошлые решения ИК по схожим проектам.',
    params: {
      query: 'string — поисковый запрос',
    },
  },

  web_search: {
    name: 'web_search',
    description: 'Поиск актуальных данных в интернете: рыночная статистика, новости конкурентов, технологические тренды, регуляторные изменения.',
    params: {
      query: 'string — поисковый запрос (на русском или английском)',
      n:     'integer 1-5 — количество результатов',
    },
  },

  memory_search: {
    name: 'memory_search',
    description: 'Семантический поиск в базе знаний KAG: компании БПЛА-отрасли, онтология технологий, данные о рынке, прошлые сделки.',
    params: {
      query: 'string — поисковый запрос',
      n:     'integer 1-8 — количество результатов',
    },
  },

  exec_code: {
    name: 'exec_code',
    description: 'Выполнить произвольный JavaScript-расчёт, если нет подходящего инструмента. Доступны: Math, project (данные проекта). Последнее выражение — результат.',
    params: {
      code:        'string — JS код без import/fetch/DOM',
      description: 'string — что вычисляет код (для лога)',
    },
  },

  analyze_timeseries: {
    name: 'analyze_timeseries',
    description: 'Анализирует временной ряд метрики: тренд, средний темп роста, ускорение/замедление, прогноз на 12 месяцев, аномальные значения (3σ).',
    params: {
      metric:  'string — название метрики (revenue, teamSize, trl и т.д.)',
      values:  'array of number — значения по периодам',
      periods: 'array of string — метки периодов (Q1-24, Q2-24 …)',
    },
  },

  analyze_founder_text: {
    name: 'analyze_founder_text',
    description: 'NLP-анализ текста фаундера: тональность, конкретность, уклончивость, необоснованные заявления, позитивные сигналы. Возвращает структурированные сигналы — не диагноз.',
    params: {
      text: 'string — текст из bio, pitch, LinkedIn или транскрипта',
    },
  },

  read_context: {
    name: 'read_context',
    description: 'Получить агрегированный контекст сессии: позиции агентов (stances), предложенные условия сделки, найденные противоречия, номер раунда.',
    params: {},
  },

}

// ── Набор инструментов по роли агента ────────────────────────────────────────

// Базовый набор есть у всех агентов
const BASE_TOOLS = ['read_room', 'query_data', 'web_search', 'memory_search', 'exec_code']

export const AGENT_TOOLS = {
  tech:          [...BASE_TOOLS],
  finance:       [...BASE_TOOLS, 'calc_irr', 'calc_npv'],
  sovereignty:   [...BASE_TOOLS],
  risk:          [...BASE_TOOLS, 'search_precedents'],
  portfolio:     [...BASE_TOOLS, 'search_precedents'],
  devil:         [...BASE_TOOLS],
  monte_carlo:   [...BASE_TOOLS, 'calc_monte_carlo', 'calc_irr'],
  real_options:  [...BASE_TOOLS, 'calc_irr', 'calc_npv'],
  market_timing: [...BASE_TOOLS, 'search_precedents'],
  bayesian:      [...BASE_TOOLS, 'calc_bayesian', 'search_precedents'],
  power_score:   [...BASE_TOOLS, 'calc_power_score'],
  game_theory:   [...BASE_TOOLS],
  // Новые агенты
  chairman:      [...BASE_TOOLS, 'search_precedents', 'read_context'],
  dialectic:     [...BASE_TOOLS, 'read_context'],
  founder:       [...BASE_TOOLS, 'analyze_founder_text'],
  temporal:      [...BASE_TOOLS, 'analyze_timeseries'],
}

export function getToolsForAgent(agentId) {
  const ids = AGENT_TOOLS[agentId] || ['read_room', 'query_data']
  return ids.map(id => TOOL_SCHEMAS[id]).filter(Boolean)
}

/** Форматирование схем инструментов для system prompt */
export function formatToolsForPrompt(tools) {
  return tools.map(t => {
    const params = Object.entries(t.params || {})
      .map(([k, v]) => `    ${k}: ${v}`)
      .join('\n')
    return `• ${t.name}: ${t.description}\n  Параметры:\n${params}`
  }).join('\n\n')
}

// ── Вычислительные движки (чистые функции, без зависимостей) ─────────────────

export function execCalcIrr(cashflows, initial_investment) {
  let r = 0.1
  for (let i = 0; i < 200; i++) {
    const f  = cashflows.reduce((acc, c, t) => acc + c / Math.pow(1 + r, t + 1), -initial_investment)
    const df = cashflows.reduce((acc, c, t) => acc - (t + 1) * c / Math.pow(1 + r, t + 2), 0)
    if (Math.abs(df) < 1e-12) break
    const rNew = r - f / df
    if (Math.abs(rNew - r) < 1e-6) { r = rNew; break }
    r = Math.max(rNew, -0.99)
  }
  return { irr_pct: +(r * 100).toFixed(2), irr: +r.toFixed(4) }
}

export function execCalcNpv(cashflows, initial_investment, wacc) {
  const npv = cashflows.reduce((acc, c, t) => acc + c / Math.pow(1 + wacc, t + 1), -initial_investment)
  return { npv: +npv.toFixed(2), pi: +((npv + initial_investment) / initial_investment).toFixed(3) }
}

export function execMonteCarlo(base_irr, volatility, n = 1000) {
  const irrArr = []
  for (let i = 0; i < n; i++) {
    const u1 = Math.random() || 1e-10
    const u2 = Math.random()
    const z  = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
    irrArr.push(base_irr + volatility * z * base_irr)
  }
  irrArr.sort((a, b) => a - b)
  const pos = irrArr.filter(r => r > 0).length
  return {
    p_positive_pct:  +((pos / n) * 100).toFixed(1),
    median_irr_pct:  +(irrArr[Math.floor(n * 0.50)] * 100).toFixed(1),
    var_5pct_irr:    +(irrArr[Math.floor(n * 0.05)] * 100).toFixed(1),
    p95_irr_pct:     +(irrArr[Math.floor(n * 0.95)] * 100).toFixed(1),
    mean_irr_pct:    +(irrArr.reduce((a, b) => a + b, 0) / n * 100).toFixed(1),
  }
}

export function execPowerScore(scores) {
  const fields = ['scale_economies','network_economies','counter_positioning','switching_costs','branding','cornered_resource','process_power']
  const total = fields.reduce((s, f) => s + (Number(scores[f]) || 0), 0)
  const assessment = total >= 50 ? 'Сильный моат (>50)' : total >= 30 ? 'Средний моат (30-50)' : 'Слабый моат (<30) — не венчурная инвестиция'
  return { total, max: 70, assessment, breakdown: Object.fromEntries(fields.map(f => [f, scores[f] || 0])) }
}

export function execBayesian(prior, evidence_up = [], evidence_down = []) {
  let p = prior
  for (const lr of evidence_up)   p = (p * lr) / (p * lr + (1 - p))
  for (const lr of evidence_down) p = (p * lr) / (p * lr + (1 - p))
  p = Math.max(0.001, Math.min(0.999, p))
  return {
    posterior: +p.toFixed(3),
    posterior_pct: +(p * 100).toFixed(1),
    delta_pct: +((p - prior) * 100).toFixed(1),
    interpretation: p > 0.5 ? 'Положительный прогноз' : p > 0.25 ? 'Сомнительный' : 'Негативный прогноз',
  }
}

/**
 * Анализ временного ряда: тренд, темп роста, прогноз, аномалии.
 */
export function execAnalyzeTimeseries(metric, values, periods = []) {
  if (!Array.isArray(values) || values.length < 2) {
    return { error: 'Требуется минимум 2 точки данных' }
  }

  const diffs = values.slice(1).map((v, i) => v - values[i])
  const growthRates = values.slice(1).map((v, i) =>
    values[i] !== 0 ? (v - values[i]) / Math.abs(values[i]) : null
  ).filter(x => x !== null)

  const avgGrowth = growthRates.length
    ? growthRates.reduce((s, x) => s + x, 0) / growthRates.length
    : 0

  // Ускорение: последний diff > первый diff
  const isAccelerating = diffs.length > 1 && diffs[diffs.length - 1] > diffs[0]

  // Линейная экстраполяция: средний прирост × 4 периода
  const avgDiff = diffs.reduce((s, x) => s + x, 0) / diffs.length
  const projected = values[values.length - 1] + avgDiff * 4

  // Аномалии: abs(diff - mean) > 3σ
  const meanDiff = avgDiff
  const variance = diffs.reduce((s, x) => s + (x - meanDiff) ** 2, 0) / diffs.length
  const std = Math.sqrt(variance)
  const anomalyPeriods = diffs
    .map((d, i) => Math.abs(d - meanDiff) > 3 * std ? (periods[i + 1] || `период ${i + 1}`) : null)
    .filter(Boolean)

  return {
    metric,
    dataPoints:     values.length,
    current:        values[values.length - 1],
    first:          values[0],
    avgGrowthRate:  (avgGrowth * 100).toFixed(1) + '%',
    trend:          isAccelerating ? 'ускоряется' : 'замедляется',
    projected12m:   +projected.toFixed(2),
    anomalyPeriods,
    periods,
    values,
  }
}
