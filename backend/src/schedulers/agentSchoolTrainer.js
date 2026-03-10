/**
 * agentSchoolTrainer.js — Автономный тренер агентов ИК
 *
 * Каждые 30 минут:
 *   1. Загружает рынки с Manifold Markets + CoinGecko
 *   2. Для каждого агента генерирует предсказание через DeepSeek
 *   3. Сохраняет в Integram тип 4540 "Предсказание агента"
 *
 * Каждый час:
 *   4. Авто-разрешает крипто-предсказания 24h — сверяет с текущей ценой
 *   5. Пересчитывает Brier Score и записывает статус
 *
 * Агенты учатся на реальных рынках без участия человека.
 */

import cron from 'node-cron'

const INTEGRAM_SERVER = process.env.INTEGRAM_SERVER_URL || 'https://api.ai2o.ru'
const INTEGRAM_DB     = 'fst'
const DEEPSEEK_KEY    = process.env.DEEPSEEK_API_KEY || ''
const PRED_TYPE       = 4540
const MODEL           = 'deepseek-chat'

const MANIFOLD_API  = 'https://api.manifold.markets/v0'
const COINGECKO_API = 'https://api.coingecko.com/api/v3'

// 12 prediction agents with their algorithm prompts
const AGENTS = [
  { id: 'monte_carlo',   name: 'Monte Carlo',    avatar: '🎲', color: '#ef5350', temperature: 0.3,
    prompt: 'Ты квантовый предсказатель, метод Монте-Карло (N=500). Оцени σ, запусти симуляции, вычисли P(YES). Строго JSON.' },
  { id: 'bayesian',      name: 'Байесовский',    avatar: '📊', color: '#42a5f5', temperature: 0.2,
    prompt: 'Ты байесовский предсказатель. Выбери референсный класс, установи P0, обнови по сигналам. Строго JSON.' },
  { id: 'market_timing', name: 'Цикл Маркса',    avatar: '⏱️', color: '#ab47bc', temperature: 0.4,
    prompt: 'Ты аналитик цикла Говарда Маркса (1-10). Ответь "Почему сейчас?", оцени конкурентное окно. Строго JSON.' },
  { id: 'real_options',  name: 'Real Options',   avatar: '🌳', color: '#26a69a', temperature: 0.3,
    prompt: 'Ты аналитик реальных опционов (ROV). Оцени S, K, T, σ, биномиальное дерево, risk-neutral P. Строго JSON.' },
  { id: 'power_score',   name: '7 Powers',       avatar: '⚡', color: '#ffa726', temperature: 0.4,
    prompt: 'Ты аналитик 7 Powers + Power Law. Оцени моат, сетевые эффекты, winner-takes-all. Строго JSON.' },
  { id: 'game_theory',   name: 'Game Theory',    avatar: '♟️', color: '#4db6ac', temperature: 0.3,
    prompt: 'Ты игровой стратег. Nash Equilibrium, Schelling points, cooperative vs competitive. Строго JSON.' },
  { id: 'finance',       name: 'DCF/IRR',        avatar: '💰', color: '#66bb6a', temperature: 0.2,
    prompt: 'Ты финансовый аналитик. DCF, IRR, Kelly criterion f*=(p×b-q)/b, unit economics. Строго JSON.' },
  { id: 'risk',          name: 'VaR/FMEA',       avatar: '🛡️', color: '#ef5350', temperature: 0.2,
    prompt: 'Ты риск-менеджер (пессимист). FMEA, VaR(95%), стресс-тест σ×2, митигации. Строго JSON.' },
  { id: 'tech',          name: 'TRL/MRL',        avatar: '🔬', color: '#26c6da', temperature: 0.3,
    prompt: 'Ты технический аналитик. TRL(1-9), MRL, MVP/PMF/scaling, S-кривая, барьеры. Строго JSON.' },
  { id: 'sovereignty',   name: 'Геополитика',    avatar: '🌐', color: '#8d6e63', temperature: 0.3,
    prompt: 'Ты эксперт геополитических рисков. Санкции, цепочки поставок, регуляторика по юрисдикциям. Строго JSON.' },
  { id: 'portfolio',     name: 'Portfolio',      avatar: '📈', color: '#5c6bc0', temperature: 0.3,
    prompt: 'Ты портфельный стратег. Корреляции, Sharpe ratio, диверсификация, системный взгляд. Строго JSON.' },
  { id: 'devil',         name: "Devil's Advocate", avatar: '😈', color: '#78909c', temperature: 0.5,
    prompt: 'Ты критик и Black Swan охотник. 3 причины почему НЕ произойдёт, скрытые риски, нарративные ловушки. Строго JSON.' },
]

// Коины для крипто-предсказаний
const CRYPTO_IDS = 'bitcoin,ethereum,solana,binancecoin,ton-crystal'

let _token = null
let _xsrf  = null
let _tokenExpiry = 0

// ── Integram Auth ─────────────────────────────────────────────────────────────

async function authenticate() {
  if (_token && Date.now() < _tokenExpiry) return { token: _token, xsrf: _xsrf }
  const res = await fetch(`${INTEGRAM_SERVER}/${INTEGRAM_DB}/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      username: process.env.INTEGRAM_SYSTEM_USERNAME,
      password: process.env.INTEGRAM_SYSTEM_PASSWORD,
    }),
    signal: AbortSignal.timeout(8000),
  })
  if (!res.ok) throw new Error(`Integram auth failed: HTTP ${res.status}`)
  const data = await res.json()
  _token = data.token || data.access_token
  _xsrf  = data._xsrf || data.xsrf || ''
  _tokenExpiry = Date.now() + 20 * 60 * 1000 // 20 min
  return { token: _token, xsrf: _xsrf }
}

// ── Market Fetching ────────────────────────────────────────────────────────────

async function fetchMarkets() {
  const markets = []

  // Manifold — 5 markets
  try {
    const res = await fetch(`${MANIFOLD_API}/search-markets?limit=8&sort=score&filter=open`, {
      signal: AbortSignal.timeout(8000),
    })
    if (res.ok) {
      const data = await res.json()
      const arr = Array.isArray(data) ? data : []
      arr.slice(0, 5).forEach(m => markets.push({
        id: m.id, title: m.question, platform: 'manifold',
        probability: Math.round((m.probability || 0.5) * 100),
        category: _detectCategory(m.question),
        closeTime: m.closeTime,
        context: { prob: m.probability, volume: m.volume },
      }))
    }
  } catch (e) { console.warn('[Trainer] Manifold:', e.message) }

  // CoinGecko — crypto markets
  try {
    const res = await fetch(
      `${COINGECKO_API}/coins/markets?vs_currency=usd&ids=${CRYPTO_IDS}&price_change_percentage=24h,7d`,
      { signal: AbortSignal.timeout(8000) }
    )
    if (res.ok) {
      const coins = await res.json()
      // Store for later resolution use
      _lastCryptoData = coins
      coins.forEach(coin => {
        const change24h = coin.price_change_percentage_24h || 0
        markets.push({
          id: `crypto-${coin.id}-24h`,
          title: `${coin.name} (${coin.symbol.toUpperCase()}) вырастет за 24 часа?`,
          platform: 'crypto', coinId: coin.id,
          currentPrice: coin.current_price,
          change24h, probability: change24h > 0 ? Math.min(75, 50 + change24h * 2) : Math.max(25, 50 + change24h * 2),
          horizon: '24h', category: 'crypto',
          closeTime: Date.now() + 86400000,
          context: { price: coin.current_price, change24h, marketCap: coin.market_cap },
        })
      })
    }
  } catch (e) { console.warn('[Trainer] CoinGecko:', e.message) }

  return markets
}

let _lastCryptoData = []

// ── AI Prediction ─────────────────────────────────────────────────────────────

async function generatePrediction(agent, market) {
  if (!DEEPSEEK_KEY) return null

  const userPrompt = `РЫНОК: "${market.title}"
Платформа: ${market.platform}
${market.probability ? `Текущий консенсус: ${market.probability}%` : ''}
${market.currentPrice ? `Цена: $${market.currentPrice.toLocaleString()}` : ''}
${market.change24h ? `Изменение 24h: ${market.change24h > 0 ? '+' : ''}${market.change24h.toFixed(2)}%` : ''}
${market.closeTime ? `Дата разрешения: ${new Date(market.closeTime).toLocaleDateString('ru')}` : ''}

ЗАДАЧА: Сделай предсказание, используя твой алгоритм.

ОБЯЗАТЕЛЬНЫЙ JSON:
{
  "probability": <1-99, P(YES)>,
  "confidence": <10-99, уверенность>,
  "reasoning": "<2-3 предложения>",
  "nash_analysis": "<1 предложение Nash/стратегия>"
}`

  try {
    const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEEPSEEK_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: agent.temperature,
        max_tokens: 400,
        messages: [
          { role: 'system', content: agent.prompt },
          { role: 'user', content: userPrompt },
        ],
      }),
      signal: AbortSignal.timeout(20000),
    })
    if (!res.ok) throw new Error(`DeepSeek HTTP ${res.status}`)
    const data = await res.json()
    const raw = data.choices?.[0]?.message?.content || ''

    const jsonMatch = raw.match(/\{[\s\S]+\}/)
    if (!jsonMatch) throw new Error('No JSON in response')
    const json = JSON.parse(jsonMatch[0])

    return {
      agentId: agent.id, platform: market.platform, marketId: market.id,
      title: market.title,
      probability: Math.round(Math.max(1, Math.min(99, json.probability ?? 50))),
      direction: (json.probability ?? 50) > 50 ? 'yes' : 'no',
      confidence: Math.round(Math.max(10, Math.min(99, json.confidence ?? 60))),
      reasoning: json.reasoning || '',
      nashReasoning: json.nash_analysis || '',
      algorithm: agent.name,
      category: market.category || 'other',
      closeTime: market.closeTime,
      context: market.context || {},
    }
  } catch (e) {
    console.warn(`[Trainer] ${agent.id} predict failed:`, e.message)
    // Fallback without AI
    const biasMap = { monte_carlo: 0, bayesian: -5, market_timing: -10, real_options: 8,
      power_score: 5, game_theory: 0, finance: -8, risk: -15, tech: 0, sovereignty: -5, portfolio: 3, devil: -20 }
    const base = market.probability || 50
    const prob = Math.max(5, Math.min(95, base + (biasMap[agent.id] || 0) + (Math.random() - 0.5) * 8))
    return {
      agentId: agent.id, platform: market.platform, marketId: market.id,
      title: market.title,
      probability: Math.round(prob), direction: prob > 50 ? 'yes' : 'no',
      confidence: 35, reasoning: `[Fallback] ${agent.name}: систематическая оценка.`,
      nashReasoning: '', algorithm: agent.name,
      category: market.category || 'other',
      closeTime: market.closeTime, context: market.context || {},
    }
  }
}

// ── Integram Storage ──────────────────────────────────────────────────────────

async function savePrediction(pred) {
  const { token, xsrf } = await authenticate()
  const body = new URLSearchParams()
  body.set(`t${PRED_TYPE}`, pred.title || 'Предсказание')
  body.set('r4542', pred.agentId)
  body.set('r4544', pred.platform)
  body.set('r4546', pred.marketId)
  body.set('r4548', pred.title)
  body.set('r4550', String(pred.probability))
  body.set('r4552', pred.direction)
  body.set('r4554', String(pred.confidence))
  body.set('r4556', pred.reasoning)
  body.set('r4558', pred.nashReasoning)
  body.set('r4560', pred.algorithm)
  body.set('r4562', new Date().toISOString().slice(0, 10))
  body.set('r4564', new Date(pred.closeTime || Date.now() + 86400000).toISOString().slice(0, 10))
  body.set('r4570', 'open')
  body.set('r4578', pred.category)
  body.set('r4580', JSON.stringify(pred.context))
  body.set('_xsrf', xsrf)

  const res = await fetch(`${INTEGRAM_SERVER}/${INTEGRAM_DB}/_m_new/${PRED_TYPE}`, {
    method: 'POST',
    headers: { 'X-Authorization': token, 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  if (!res.ok) throw new Error(`Save failed: HTTP ${res.status}`)
}

async function loadOpenCryptoPredictions() {
  const { token } = await authenticate()
  const res = await fetch(`${INTEGRAM_SERVER}/${INTEGRAM_DB}/object/${PRED_TYPE}?JSON_KV&l=200`, {
    headers: { 'X-Authorization': token },
    signal: AbortSignal.timeout(8000),
  })
  if (!res.ok) return []
  const data = await res.json()
  return (data.object || []).map(obj => {
    const r = data.reqs?.[obj.id] || {}
    return {
      _id: obj.id,
      agentId: r['4542'], platform: r['4544'],
      marketId: r['4546'], probability: parseFloat(r['4550'] || 50),
      status: r['4570'], category: r['4578'],
      resolveDate: r['4564'],
      context: (() => { try { return JSON.parse(r['4580'] || '{}') } catch { return {} } })(),
    }
  }).filter(p => p.status === 'open' && p.platform === 'crypto')
}

async function resolvePrediction(predId, actualOutcomePct, forecast) {
  const { token, xsrf } = await authenticate()
  const outcome = actualOutcomePct / 100
  const fc = forecast / 100
  const brier = Math.round((fc - outcome) ** 2 * 1000) / 1000
  const correct = (fc > 0.5 && outcome >= 0.5) || (fc <= 0.5 && outcome < 0.5) ? 1 : 0
  const status = correct ? 'correct' : 'wrong'

  const body = new URLSearchParams({ r4566: String(actualOutcomePct), r4568: String(brier), r4570: status, _xsrf: xsrf })
  await fetch(`${INTEGRAM_SERVER}/${INTEGRAM_DB}/_m_set/${predId}`, {
    method: 'POST',
    headers: { 'X-Authorization': token, 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  return { brier, correct, status }
}

// ── Training Round ────────────────────────────────────────────────────────────

let _roundCount = 0

async function runTrainingRound() {
  _roundCount++
  const tag = `[Trainer #${_roundCount}]`
  console.log(`${tag} Starting training round...`)

  try {
    const markets = await fetchMarkets()
    if (!markets.length) { console.warn(`${tag} No markets available`); return }

    // Pick 2 random markets to avoid flooding the DB
    const selected = markets.sort(() => Math.random() - 0.5).slice(0, 2)
    let saved = 0, errors = 0

    for (const market of selected) {
      // Pick 3 random agents per market (not all 12 every time — gradual learning)
      const agentSample = [...AGENTS].sort(() => Math.random() - 0.5).slice(0, 3)

      for (const agent of agentSample) {
        try {
          const pred = await generatePrediction(agent, market)
          if (pred) {
            await savePrediction(pred)
            saved++
          }
        } catch (e) {
          errors++
          console.warn(`${tag} ${agent.id}@${market.id}:`, e.message)
        }
        // Rate limit: 1 req / 2s
        await new Promise(r => setTimeout(r, 2000))
      }
    }

    console.log(`${tag} Done: saved=${saved}, errors=${errors}`)
  } catch (e) {
    console.error(`${tag} Round failed:`, e.message)
  }
}

// ── Auto-Resolution of Crypto Predictions ────────────────────────────────────

async function resolveCryptoPredictions() {
  console.log('[Trainer] Running crypto resolution...')
  try {
    // Get current prices
    const res = await fetch(
      `${COINGECKO_API}/coins/markets?vs_currency=usd&ids=${CRYPTO_IDS}`,
      { signal: AbortSignal.timeout(8000) }
    )
    if (!res.ok) return
    const coins = await res.json()
    const priceMap = {}
    coins.forEach(c => priceMap[c.id] = c.current_price)

    // Load open crypto predictions
    const openPreds = await loadOpenCryptoPredictions()
    if (!openPreds.length) return

    let resolved = 0
    const now = Date.now()

    for (const pred of openPreds) {
      // Only resolve if past resolve date
      if (pred.resolveDate && new Date(pred.resolveDate).getTime() > now) continue

      const coinId = pred.marketId?.replace('crypto-', '').replace(/-24h|-7d$/, '')
      const currentPrice = priceMap[coinId]
      const openPrice = pred.context?.price

      if (!currentPrice || !openPrice) continue

      // Outcome: did the price go up?
      const wentUp = currentPrice > openPrice
      const actualOutcome = wentUp ? 100 : 0

      try {
        const result = await resolvePrediction(pred._id, actualOutcome, pred.probability)
        resolved++
        console.log(`[Trainer] Resolved ${pred.agentId}@${pred.marketId}: ${result.status} (Brier=${result.brier})`)
      } catch (e) {
        console.warn('[Trainer] Resolve error:', e.message)
      }

      await new Promise(r => setTimeout(r, 500))
    }

    console.log(`[Trainer] Resolved ${resolved} crypto predictions`)
  } catch (e) {
    console.error('[Trainer] Resolution failed:', e.message)
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function _detectCategory(text = '') {
  const t = text.toLowerCase()
  if (/btc|eth|crypto|bitcoin|ethereum|solana|token/.test(t)) return 'crypto'
  if (/startup|ipo|funding|unicorn|series/.test(t)) return 'startup'
  if (/gdp|inflation|rate|fed|цб|рубл|доллар/.test(t)) return 'macro'
  if (/ai|gpt|llm|nvidia|openai|модель/.test(t)) return 'tech'
  return 'other'
}

// ── Scheduler ─────────────────────────────────────────────────────────────────

export function startAgentSchoolTrainer() {
  if (!DEEPSEEK_KEY) {
    console.warn('[Trainer] DEEPSEEK_API_KEY not set — trainer disabled')
    return
  }

  console.log('[Trainer] Agent School Trainer started')

  // Training round: every 30 minutes
  cron.schedule('*/30 * * * *', runTrainingRound, { name: 'agent-training' })

  // Crypto resolution: every hour at :15
  cron.schedule('15 * * * *', resolveCryptoPredictions, { name: 'crypto-resolution' })

  // First run after 10 seconds (give server time to init)
  setTimeout(runTrainingRound, 10_000)
}

export { runTrainingRound, resolveCryptoPredictions }
