#!/usr/bin/env node
/**
 * mcp-calc.mjs — MCP сервер финансовых калькуляторов
 *
 * Реализует MCP протокол (JSON-RPC 2.0 через stdio) без зависимостей.
 * Инструменты вызываются AI-агентами для точных математических вычислений.
 *
 * Запуск: node backend/mcp-calc.mjs
 * Регистрация: ~/.claude/settings.json → mcpServers
 */

import {
  bayesianUpdate, dcf, irr, kelly, brierScore,
  monteCarloVaR, sharpeRatio, blackScholes,
  nashEquilibrium, shapleyValue, unitEconomics, portfolioRisk
} from './calc.mjs'

// ── Tool definitions ──────────────────────────────────────────────────────────

const TOOLS = [
  {
    name: 'calc_bayesian_update',
    description: 'Байесовское обновление вероятности по новым свидетельствам. P(H|E) = P(E|H)*P(H)/P(E). Используй для обновления P(успех) по каждому новому сигналу.',
    inputSchema: {
      type: 'object',
      properties: {
        prior: { type: 'number', description: 'Приорная вероятность 0..1, например 0.3 = 30%' },
        signals: {
          type: 'array',
          description: 'Массив сигналов для обновления',
          items: {
            type: 'object',
            properties: {
              likelihood: { type: 'number', description: 'P(сигнал|гипотеза верна), например 0.8' },
              label: { type: 'string', description: 'Описание сигнала' },
            },
            required: ['likelihood'],
          },
        },
      },
      required: ['prior'],
    },
  },
  {
    name: 'calc_dcf',
    description: 'DCF — Дисконтированный денежный поток. Считает NPV и терминальную стоимость по методу Gordon Growth. Для оценки стартапов и проектов.',
    inputSchema: {
      type: 'object',
      properties: {
        cashFlows:     { type: 'array', items: { type: 'number' }, description: 'Прогнозные CF по годам, например [100, 150, 200, 300, 400]' },
        wacc:          { type: 'number', description: 'WACC/ставка дисконта 0..1, например 0.25 = 25%' },
        terminalGrowth:{ type: 'number', description: 'Терминальный рост 0..1, например 0.03 = 3%' },
      },
      required: ['cashFlows', 'wacc'],
    },
  },
  {
    name: 'calc_irr',
    description: 'IRR — внутренняя норма доходности. Методом Ньютона-Рафсона находит r при котором NPV=0. CF0 обычно отрицательный (инвестиция).',
    inputSchema: {
      type: 'object',
      properties: {
        cashFlows: { type: 'array', items: { type: 'number' }, description: 'CF по периодам: [-1000, 200, 300, 500, 400]' },
        guess:     { type: 'number', description: 'Начальное приближение, по умолчанию 0.1' },
      },
      required: ['cashFlows'],
    },
  },
  {
    name: 'calc_kelly',
    description: 'Kelly Criterion — оптимальный размер позиции/ставки. f* = (p*b - q) / b. Рекомендуется дробный Келли 25-50%.',
    inputSchema: {
      type: 'object',
      properties: {
        p:        { type: 'number', description: 'Вероятность выигрыша 0..1' },
        b:        { type: 'number', description: 'Коэффициент выплаты: если ставишь 1 и выигрываешь 2, то b=2' },
        fraction: { type: 'number', description: 'Дробный Келли 0..1, рекомендуется 0.25-0.5' },
      },
      required: ['p', 'b'],
    },
  },
  {
    name: 'calc_brier_score',
    description: 'Brier Score — метрика качества прогноза. BS = (прогноз - факт)². 0=идеально, 0.25=случайно. Skill Score показывает улучшение vs наивного прогноза.',
    inputSchema: {
      type: 'object',
      properties: {
        forecast: { type: 'number', description: 'Прогнозная вероятность 0..1' },
        outcome:  { type: 'number', description: 'Реальный исход: 1=YES, 0=NO' },
      },
      required: ['forecast', 'outcome'],
    },
  },
  {
    name: 'calc_monte_carlo_var',
    description: 'Monte Carlo VaR — стохастическая оценка риска. N=10000 симуляций Box-Muller. Возвращает VaR(95%), VaR(99%), CVaR.',
    inputSchema: {
      type: 'object',
      properties: {
        mu:         { type: 'number', description: 'Ожидаемая годовая доходность 0..1, например 0.15=15%' },
        sigma:      { type: 'number', description: 'Годовая волатильность 0..1, например 0.40=40%' },
        horizon:    { type: 'number', description: 'Горизонт в торговых днях, например 1 или 252' },
        confidence: { type: 'number', description: 'Уровень доверия, по умолчанию 0.95' },
      },
      required: ['mu', 'sigma'],
    },
  },
  {
    name: 'calc_sharpe_ratio',
    description: 'Sharpe Ratio — скорректированная на риск доходность. (R_p - R_f) / σ_p. >2 отлично, >1 хорошо.',
    inputSchema: {
      type: 'object',
      properties: {
        returns:       { type: 'array', items: { type: 'number' }, description: 'Массив дневных доходностей, например [0.01, -0.005, 0.02]' },
        riskFreeRate:  { type: 'number', description: 'Годовая безрисковая ставка, например 0.05=5%' },
      },
      required: ['returns'],
    },
  },
  {
    name: 'calc_black_scholes',
    description: 'Black-Scholes / Real Options. Для Real Options: S=текущая стоимость проекта, K=требуемая инвестиция, T=горизонт лет. Показывает стоимость права "подождать и инвестировать позже".',
    inputSchema: {
      type: 'object',
      properties: {
        S:     { type: 'number', description: 'Стоимость базового актива/проекта' },
        K:     { type: 'number', description: 'Цена исполнения (инвестиция)' },
        T:     { type: 'number', description: 'Горизонт в годах, например 1.5' },
        r:     { type: 'number', description: 'Безрисковая ставка, например 0.05' },
        sigma: { type: 'number', description: 'Волатильность, например 0.40 = 40%' },
      },
      required: ['S', 'K', 'T', 'r', 'sigma'],
    },
  },
  {
    name: 'calc_nash_equilibrium',
    description: 'Nash Equilibrium — проверяет стабильность коалиции агентов. Консенсус ≥80% = Nash достигнут. Возвращает нестабильных агентов и Schelling point.',
    inputSchema: {
      type: 'object',
      properties: {
        votes: {
          type: 'object',
          description: 'Голоса агентов: { "monte_carlo": 0.75, "bayesian": 0.60, ... }',
          additionalProperties: { type: 'number' },
        },
      },
      required: ['votes'],
    },
  },
  {
    name: 'calc_shapley_value',
    description: 'Shapley Value — справедливое распределение вклада агентов с учётом их исторической точности. Tit-for-Tat: точные агенты получают больший вес.',
    inputSchema: {
      type: 'object',
      properties: {
        agents: {
          type: 'array',
          description: 'Агенты: [{ "id": "monte_carlo", "weight": 0.08 }, ...]',
          items: { type: 'object', properties: { id: { type: 'string' }, weight: { type: 'number' } }, required: ['id', 'weight'] },
        },
        history: {
          type: 'object',
          description: 'История: { "monte_carlo": { "correct": 8, "total": 12 }, ... }',
          additionalProperties: {
            type: 'object',
            properties: { correct: { type: 'number' }, total: { type: 'number' } },
          },
        },
      },
      required: ['agents'],
    },
  },
  {
    name: 'calc_unit_economics',
    description: 'Unit Economics — LTV/CAC, payback period, burn multiple. Ключевые метрики для оценки стартапа.',
    inputSchema: {
      type: 'object',
      properties: {
        cac:         { type: 'number', description: 'Customer Acquisition Cost, $' },
        ltv:         { type: 'number', description: 'Lifetime Value, $' },
        avgRevenue:  { type: 'number', description: 'Средний ежемесячный доход с клиента, $' },
        churnRate:   { type: 'number', description: 'Churn rate 0..1, например 0.05=5%/мес' },
        grossMargin: { type: 'number', description: 'Валовая маржа 0..1, например 0.70=70%' },
        burnRate:    { type: 'number', description: 'Ежемесячный burn rate, $' },
        runway:      { type: 'number', description: 'Runway в месяцах' },
      },
    },
  },
  {
    name: 'calc_portfolio_risk',
    description: 'Portfolio Risk — доходность, волатильность, Sharpe и диверсификационный эффект портфеля активов.',
    inputSchema: {
      type: 'object',
      properties: {
        assets: {
          type: 'array',
          description: 'Активы: [{ "name": "BTC", "weight": 0.3, "expectedReturn": 0.5, "volatility": 0.8 }, ...]',
          items: {
            type: 'object',
            properties: {
              name:           { type: 'string' },
              weight:         { type: 'number' },
              expectedReturn: { type: 'number' },
              volatility:     { type: 'number' },
            },
            required: ['weight', 'expectedReturn', 'volatility'],
          },
        },
      },
      required: ['assets'],
    },
  },
]

// ── Tool handler ──────────────────────────────────────────────────────────────

function handleToolCall(name, args) {
  switch (name) {
    case 'calc_bayesian_update':
      return bayesianUpdate(args.prior, args.signals || [])
    case 'calc_dcf':
      return dcf(args.cashFlows, args.wacc, args.terminalGrowth ?? 0.03)
    case 'calc_irr':
      return irr(args.cashFlows, args.guess ?? 0.1)
    case 'calc_kelly':
      return kelly(args.p, args.b, args.fraction ?? 0.5)
    case 'calc_brier_score':
      return brierScore(args.forecast, args.outcome)
    case 'calc_monte_carlo_var':
      return monteCarloVaR(args.mu, args.sigma, args.horizon ?? 1, args.confidence ?? 0.95, 10000)
    case 'calc_sharpe_ratio':
      return sharpeRatio(args.returns, args.riskFreeRate ?? 0.05)
    case 'calc_black_scholes':
      return blackScholes(args.S, args.K, args.T, args.r, args.sigma)
    case 'calc_nash_equilibrium':
      return nashEquilibrium(args.votes)
    case 'calc_shapley_value':
      return shapleyValue(args.agents, args.history || {})
    case 'calc_unit_economics':
      return unitEconomics(args)
    case 'calc_portfolio_risk':
      return portfolioRisk(args.assets)
    default:
      throw new Error(`Unknown tool: ${name}`)
  }
}

// ── MCP JSON-RPC 2.0 protocol over stdio ─────────────────────────────────────

process.stdout.setEncoding('utf8')
process.stdin.setEncoding('utf8')

let buffer = ''
process.stdin.on('data', (chunk) => {
  buffer += chunk
  const lines = buffer.split('\n')
  buffer = lines.pop() // incomplete line
  for (const line of lines) {
    if (!line.trim()) continue
    try {
      const msg = JSON.parse(line)
      handleMessage(msg)
    } catch (e) {
      // ignore parse errors
    }
  }
})

function send(obj) {
  process.stdout.write(JSON.stringify(obj) + '\n')
}

function handleMessage(msg) {
  const { jsonrpc, id, method, params } = msg

  // Notification (no id) — just acknowledge
  if (id === undefined) return

  try {
    if (method === 'initialize') {
      send({
        jsonrpc: '2.0', id,
        result: {
          protocolVersion: '2024-11-05',
          capabilities: { tools: {} },
          serverInfo: { name: 'fst-calc', version: '1.0.0' },
        },
      })
    } else if (method === 'tools/list') {
      send({ jsonrpc: '2.0', id, result: { tools: TOOLS } })
    } else if (method === 'tools/call') {
      const { name, arguments: args } = params
      try {
        const result = handleToolCall(name, args || {})
        send({
          jsonrpc: '2.0', id,
          result: {
            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
            isError: false,
          },
        })
      } catch (e) {
        send({
          jsonrpc: '2.0', id,
          result: {
            content: [{ type: 'text', text: `Ошибка: ${e.message}` }],
            isError: true,
          },
        })
      }
    } else if (method === 'ping') {
      send({ jsonrpc: '2.0', id, result: {} })
    } else {
      send({ jsonrpc: '2.0', id, error: { code: -32601, message: `Method not found: ${method}` } })
    }
  } catch (e) {
    send({ jsonrpc: '2.0', id, error: { code: -32603, message: e.message } })
  }
}

process.on('SIGINT', () => process.exit(0))
process.on('SIGTERM', () => process.exit(0))

// Log startup to stderr (not stdout — stdout is for MCP)
process.stderr.write('[mcp-calc] FST Calculator MCP Server started\n')
