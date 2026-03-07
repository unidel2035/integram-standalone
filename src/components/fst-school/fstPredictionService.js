/**
 * fstPredictionService.js — Agent Prediction School
 *
 * Sources:
 *   - Manifold Markets API (play money, fast resolution)
 *   - Metaculus API (serious forecasting, calibration)
 *   - CoinGecko API (crypto prices, free tier)
 *   - Synthetic scenarios (venture-domain back-test)
 *
 * Storage: Integram type 4540 "Предсказание агента"
 *   4542=agentId  4544=platform  4546=marketId  4548=title
 *   4550=prob%    4552=direction  4554=confidence  4556=reasoning
 *   4558=nashReason  4560=algorithm  4562=predDate  4564=resolveDate
 *   4566=actualOutcome  4568=brierScore  4570=status
 *   4572=cumBrier  4574=correct  4576=total  4578=category  4580=contextJson
 */

import { authenticate } from '@/services/fstApi.js'

const FST_DB    = import.meta.env.VITE_FST_DB || 'fst-api'
const PRED_TYPE = 4540

// Public APIs (no auth needed for reading)
const MANIFOLD_API  = 'https://api.manifold.markets/v0'
const METACULUS_API = 'https://www.metaculus.com/api2'
const COINGECKO_API = 'https://api.coingecko.com/api/v3'

// ─── Market Fetching ─────────────────────────────────────────────────────────

/** Fetch open markets from Manifold Markets */
export async function fetchManifoldMarkets(topic = '', limit = 10) {
  try {
    const qs = new URLSearchParams({ limit, sort: 'score', filter: 'open' })
    if (topic) qs.set('term', topic)
    const res = await fetch(`${MANIFOLD_API}/search-markets?${qs}`, {
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) throw new Error(`Manifold HTTP ${res.status}`)
    const data = await res.json()
    return (Array.isArray(data) ? data : []).map(m => ({
      id: m.id,
      slug: m.slug,
      title: m.question,
      platform: 'manifold',
      probability: Math.round((m.probability || 0.5) * 100),
      volume: m.volume || 0,
      closeTime: m.closeTime,
      category: _detectCategory(m.question),
      url: `https://manifold.markets/${m.creatorUsername}/${m.slug}`,
      context: { market: m.question, prob: m.probability, volume: m.volume },
    }))
  } catch (e) {
    console.warn('[PredService] Manifold:', e.message)
    return _fallbackManifoldMarkets()
  }
}

/** Fetch open questions from Metaculus */
export async function fetchMetaculusQuestions(limit = 8) {
  try {
    const res = await fetch(
      `${METACULUS_API}/questions/?status=open&order_by=-activity&limit=${limit}`,
      { signal: AbortSignal.timeout(8000) }
    )
    if (!res.ok) throw new Error(`Metaculus HTTP ${res.status}`)
    const data = await res.json()
    return (data.results || []).map(q => ({
      id: String(q.id),
      title: q.title,
      platform: 'metaculus',
      probability: q.community_prediction?.full?.q2
        ? Math.round(q.community_prediction.full.q2 * 100) : 50,
      closeTime: q.close_time,
      category: _detectCategory(q.title),
      url: `https://metaculus.com/questions/${q.id}`,
      context: { title: q.title, resolution: q.resolution_criteria?.slice(0, 200) },
    }))
  } catch (e) {
    console.warn('[PredService] Metaculus:', e.message)
    return []
  }
}

/** Fetch current crypto prices for prediction targets */
export async function fetchCryptoPrices() {
  try {
    const ids = 'bitcoin,ethereum,solana,binancecoin,ton-crystal'
    const res = await fetch(
      `${COINGECKO_API}/coins/markets?vs_currency=usd&ids=${ids}&price_change_percentage=1h,24h,7d`,
      { signal: AbortSignal.timeout(8000) }
    )
    if (!res.ok) throw new Error(`CoinGecko HTTP ${res.status}`)
    return await res.json()
  } catch (e) {
    console.warn('[PredService] CoinGecko:', e.message)
    return _fallbackCryptoPrices()
  }
}

/** Build crypto prediction markets from current prices */
export async function buildCryptoMarkets() {
  const coins = await fetchCryptoPrices()
  const markets = []

  for (const coin of coins) {
    const priceUsd = coin.current_price
    const change24h = coin.price_change_percentage_24h || 0

    // 24h direction market
    markets.push({
      id: `crypto-${coin.id}-24h`,
      title: `${coin.name} (${coin.symbol.toUpperCase()}) вырастет за 24 часа?`,
      platform: 'crypto',
      coinId: coin.id,
      coinSymbol: coin.symbol.toUpperCase(),
      currentPrice: priceUsd,
      change24h,
      change7d: coin.price_change_percentage_7d_in_currency || 0,
      probability: change24h > 0 ? Math.min(75, 50 + change24h * 2) : Math.max(25, 50 + change24h * 2),
      horizon: '24h',
      category: 'crypto',
      closeTime: Date.now() + 86400000,
      context: { price: priceUsd, change24h, change7d: coin.price_change_percentage_7d_in_currency, marketCap: coin.market_cap },
    })

    // 7d direction market
    markets.push({
      id: `crypto-${coin.id}-7d`,
      title: `${coin.name} вырастет за 7 дней?`,
      platform: 'crypto',
      coinId: coin.id,
      coinSymbol: coin.symbol.toUpperCase(),
      currentPrice: priceUsd,
      change24h,
      probability: 50,
      horizon: '7d',
      category: 'crypto',
      closeTime: Date.now() + 7 * 86400000,
      context: { price: priceUsd, change24h, marketCap: coin.market_cap },
    })
  }

  return markets
}

// ─── Prediction Storage ───────────────────────────────────────────────────────

/** Save a new prediction to Integram */
export async function savePrediction(prediction) {
  const { token, xsrf } = await authenticate()

  const body = new URLSearchParams()
  body.set(`t${PRED_TYPE}`, prediction.title || 'Предсказание')
  body.set(`r4542`, prediction.agentId)
  body.set(`r4544`, prediction.platform)
  body.set(`r4546`, prediction.marketId)
  body.set(`r4548`, prediction.title)
  body.set(`r4550`, String(Math.round(prediction.probability)))
  body.set(`r4552`, prediction.direction || (prediction.probability > 50 ? 'yes' : 'no'))
  body.set(`r4554`, String(Math.round(prediction.confidence || 60)))
  body.set(`r4556`, prediction.reasoning || '')
  body.set(`r4558`, prediction.nashReasoning || '')
  body.set(`r4560`, prediction.algorithm || prediction.agentId)
  body.set(`r4562`, new Date().toISOString().slice(0, 10))
  body.set(`r4564`, new Date(prediction.closeTime || Date.now() + 86400000).toISOString().slice(0, 10))
  body.set(`r4570`, 'open')
  body.set(`r4578`, prediction.category || 'other')
  body.set(`r4580`, JSON.stringify(prediction.context || {}))
  body.set('_xsrf', xsrf)

  const res = await fetch(`/${FST_DB}/_m_new/${PRED_TYPE}`, {
    method: 'POST',
    headers: { 'X-Authorization': token, 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  const data = await res.json()
  return data.obj || data.id
}

/** Load all predictions (with optional agentId filter) */
export async function loadPredictions(agentId = null, limit = 50) {
  const { token } = await authenticate()
  const res = await fetch(`/${FST_DB}/object/${PRED_TYPE}?JSON_KV&l=${limit}`, {
    headers: { 'X-Authorization': token },
    signal: AbortSignal.timeout(8000),
  })
  const data = await res.json()
  const objects = data.object || []
  const reqs = data.reqs || {}

  return objects
    .map(obj => {
      const r = reqs[obj.id] || {}
      return {
        _id: obj.id,
        agentId: r['4542'] || '',
        platform: r['4544'] || '',
        marketId: r['4546'] || '',
        title: r['4548'] || obj.val,
        probability: parseFloat(r['4550'] || 50),
        direction: r['4552'] || 'yes',
        confidence: parseFloat(r['4554'] || 60),
        reasoning: r['4556'] || '',
        nashReasoning: r['4558'] || '',
        algorithm: r['4560'] || '',
        predDate: r['4562'] || '',
        resolveDate: r['4564'] || '',
        actualOutcome: parseFloat(r['4566'] || 0),
        brierScore: parseFloat(r['4568'] || 0),
        status: r['4570'] || 'open',
        category: r['4578'] || 'other',
      }
    })
    .filter(p => !agentId || p.agentId === agentId)
}

/** Resolve a prediction when outcome is known */
export async function resolvePrediction(predictionId, actualOutcomePct) {
  const { token, xsrf } = await authenticate()

  // Brier score: (forecast - outcome)^2, lower = better, 0 = perfect
  // We store in DB and calculate stats
  const prediction = await _loadOnePrediction(token, predictionId)
  if (!prediction) return

  const forecast = prediction.probability / 100
  const outcome  = actualOutcomePct / 100
  const brier    = Math.round((forecast - outcome) ** 2 * 1000) / 1000
  const correct  = (forecast > 0.5 && outcome >= 0.5) || (forecast <= 0.5 && outcome < 0.5) ? 1 : 0
  const status   = correct ? 'correct' : 'wrong'

  const body = new URLSearchParams({
    r4566: String(actualOutcomePct),
    r4568: String(brier),
    r4570: status,
    _xsrf: xsrf,
  })

  await fetch(`/${FST_DB}/_m_set/${predictionId}`, {
    method: 'POST',
    headers: { 'X-Authorization': token, 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })

  return { brier, correct, status }
}

// ─── Stats ────────────────────────────────────────────────────────────────────

/** Compute aggregate stats per agent from their predictions */
export function computeAgentStats(predictions) {
  const stats = {}

  for (const p of predictions) {
    const id = p.agentId
    if (!id) continue
    if (!stats[id]) stats[id] = { total: 0, correct: 0, brierSum: 0, byCategory: {}, recentBriers: [] }
    const s = stats[id]
    s.total++
    if (p.status === 'correct') s.correct++
    if (p.brierScore > 0) {
      s.brierSum += p.brierScore
      s.recentBriers.push(p.brierScore)
    }
    // By category
    const cat = p.category || 'other'
    if (!s.byCategory[cat]) s.byCategory[cat] = { total: 0, correct: 0 }
    s.byCategory[cat].total++
    if (p.status === 'correct') s.byCategory[cat].correct++
  }

  for (const s of Object.values(stats)) {
    s.accuracy = s.total > 0 ? Math.round(s.correct / s.total * 100) : 0
    s.avgBrier = s.brierSum > 0 && s.total > 0
      ? Math.round(s.brierSum / s.total * 1000) / 1000 : null
    // Brier skill score vs naive (0.25)
    s.brierSkill = s.avgBrier != null ? Math.round((1 - s.avgBrier / 0.25) * 100) : null
    s.recentBriers = s.recentBriers.slice(-10)
  }

  return stats
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function _detectCategory(text = '') {
  const t = text.toLowerCase()
  if (/btc|eth|crypto|bitcoin|ethereum|solana|token/.test(t)) return 'crypto'
  if (/startup|ipo|funding|unicorn|series/.test(t)) return 'startup'
  if (/gdp|inflation|rate|fed|цб|рубл|доллар/.test(t)) return 'macro'
  if (/ai|gpt|llm|nvidia|openai|модель/.test(t)) return 'tech'
  return 'other'
}

async function _loadOnePrediction(token, id) {
  const res = await fetch(`/${FST_DB}/object/${id}?JSON_KV`, {
    headers: { 'X-Authorization': token },
  })
  const data = await res.json()
  const r = (data.reqs || {})[id] || {}
  return { probability: parseFloat(r['4550'] || 50) }
}

function _fallbackManifoldMarkets() {
  return [
    { id: 'fb-btc-100k', title: 'BTC достигнет $120,000 в 2026?', platform: 'manifold', probability: 42, category: 'crypto', context: {}, closeTime: Date.now() + 30 * 86400000 },
    { id: 'fb-eth-merge', title: 'ETH превысит $5000 в 2026?', platform: 'manifold', probability: 35, category: 'crypto', context: {}, closeTime: Date.now() + 30 * 86400000 },
    { id: 'fb-ai-agi', title: 'GPT-5 выйдет в 2026?', platform: 'manifold', probability: 65, category: 'tech', context: {}, closeTime: Date.now() + 60 * 86400000 },
    { id: 'fb-us-recession', title: 'Рецессия в США в 2026?', platform: 'manifold', probability: 28, category: 'macro', context: {}, closeTime: Date.now() + 180 * 86400000 },
    { id: 'fb-ru-inflation', title: 'Инфляция РФ снизится ниже 10% к концу 2026?', platform: 'manifold', probability: 40, category: 'macro', context: {}, closeTime: Date.now() + 200 * 86400000 },
    { id: 'fb-bas-startup', title: 'Стартап из БАС-портфеля ФСТ привлечёт Series A в 2026?', platform: 'manifold', probability: 55, category: 'startup', context: {}, closeTime: Date.now() + 120 * 86400000 },
  ]
}

function _fallbackCryptoPrices() {
  return [
    { id: 'bitcoin', name: 'Bitcoin', symbol: 'btc', current_price: 95000, price_change_percentage_24h: 1.2, price_change_percentage_7d_in_currency: -3.1, market_cap: 1870000000000 },
    { id: 'ethereum', name: 'Ethereum', symbol: 'eth', current_price: 3400, price_change_percentage_24h: -0.8, price_change_percentage_7d_in_currency: 5.2, market_cap: 410000000000 },
    { id: 'solana', name: 'Solana', symbol: 'sol', current_price: 165, price_change_percentage_24h: 2.1, price_change_percentage_7d_in_currency: 8.3, market_cap: 80000000000 },
    { id: 'ton-crystal', name: 'TON', symbol: 'ton', current_price: 5.8, price_change_percentage_24h: 0.5, price_change_percentage_7d_in_currency: -1.2, market_cap: 15000000000 },
  ]
}
