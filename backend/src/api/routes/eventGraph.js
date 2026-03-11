/**
 * Event Graph API — граф событий для портфеля ФСТ
 *
 * GET /api/fst/events/graph          — полный граф (все акторы + события + концепты)
 * GET /api/fst/events/graph/:actorId — граф для конкретной компании
 * GET /api/fst/events/graph/matrix   — матрица переходов между типами событий
 */

import { Router } from 'express'
import { readFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { authenticateIntegram } from '../middleware/auth.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const BACKTEST_JSON = join(__dirname, '../../../backtest-result.json')

const router = Router()

const INTEGRAM_SERVER = process.env.INTEGRAM_SERVER_URL || 'https://api.ai2o.ru'
const INTEGRAM_DB = 'fst'

// Type IDs
const TYPE_EVENTS   = 2451  // СОД Предметные события
const TYPE_ACTORS   = 2406  // СОД Акторы
const TYPE_CONCEPTS = 2416  // СОД Концепты
const TYPE_EVTYPES  = 3042  // Типы событий (Регуляторное/Рыночное/Тех/Фин)

// Event type labels
const EVENT_TYPE_LABELS = {
  3049: 'Регуляторное',
  3050: 'Рыночное',
  3051: 'Технологическое',
  3052: 'Финансовое',
}

async function fetchAll(typeId, token) {
  const all = []
  let offset = 0
  const limit = 100
  while (true) {
    const res = await fetch(
      `${INTEGRAM_SERVER}/${INTEGRAM_DB}/object/${typeId}?JSON_KV&l=${limit}&s=${offset}`,
      { headers: { 'X-Authorization': token } }
    )
    if (!res.ok) throw new Error(`fetch type ${typeId} → ${res.status}`)
    const data = await res.json()

    // type 2451 returns { object[], reqs{} }; reference types return arrays
    if (Array.isArray(data)) {
      all.push(...data)
      break
    }

    const objects = data.object || []
    const reqs    = data.reqs || {}
    for (const obj of objects) {
      const r = reqs[obj.id] || {}
      all.push({
        id:    Number(obj.id),
        name:  obj.val,
        r3044: parseRefStr(r.ref_3044),
        r3024: parseMultiRefStr(r.ref_3024),
        r3007: parseMultiRefStr(r.ref_3007),
        r3021: parseMultiRefStr(r.ref_3021),
        r2458: r['2458'] || '',
        r2460: r['2460'] || '',
        r2461: r['2461'] || '',
        r61928: r['61928'] || null,
        r61929: r['61929'] || null,
        r61930: r['61930'] || null,
        r61931: r['61931'] || null,
        r62313: parseRefStr(r.ref_62313),
        // actor name fallback
        t2407: obj.val,
        t2417: obj.val,
      })
    }
    const total = Number(data.total || 0)
    offset += objects.length
    if (offset >= total || objects.length === 0) break
  }
  return all
}

function parseRefStr(str) {
  if (!str) return null
  const p = str.split(':')
  return p.length >= 2 ? (Number(p[1].split(',')[0]) || null) : null
}

function parseMultiRefStr(str) {
  if (!str) return []
  const p = str.split(':')
  return p.length >= 2 ? p[1].split(',').map(Number).filter(Boolean) : []
}

function buildGraph(events, actors, concepts, actorIdFilter = null) {
  const nodes = []
  const edges = []
  const nodeSet = new Set()

  // Index actors and concepts
  const actorMap  = Object.fromEntries(actors.map(a => [a.id, a]))
  const conceptMap = Object.fromEntries(concepts.map(c => [c.id, c]))

  const addNode = (id, type, label, data = {}) => {
    if (!nodeSet.has(`${type}:${id}`)) {
      nodeSet.add(`${type}:${id}`)
      nodes.push({ id: `${type}:${id}`, type, label, data })
    }
  }

  // Filter events by actor if requested
  const filteredEvents = actorIdFilter
    ? events.filter(e => {
        const actorIds = parseMultiRef(e.r3007)
        return actorIds.includes(Number(actorIdFilter))
      })
    : events

  for (const evt of filteredEvents) {
    const evtId     = `evt:${evt.id}`
    const evtLabel  = evt.t2452 || evt.name || `Событие #${evt.id}`
    const evtType   = evt.r3044   // ref → type 3042
    const evtDate   = evt.r2458 || ''
    const evtEffect = evt.r2460 || ''

    addNode(evt.id, 'event', evtLabel, {
      date:      evtDate,
      effect:    evtEffect,
      eventType: evtType,
      eventTypeLabel: EVENT_TYPE_LABELS[evtType] || 'Неизвестно',
      magnitude:      evt.r61931 || null,
      probability:    evt.r61928 || null,
      delta_trl:      evt.r61929 || null,
      delta_funding:  evt.r61930 || null,
    })

    // Edges: event → actors
    const actorIds = parseMultiRef(evt.r3007)
    for (const aId of actorIds) {
      const actor = actorMap[aId]
      if (actor) {
        addNode(aId, 'actor', actor.t2407 || actor.name || `Актор #${aId}`, {
          actorType: actor.r2950,
        })
        edges.push({ source: evtId, target: `actor:${aId}`, relation: 'actor' })
      }
    }

    // Edges: event → concepts
    const conceptIds = parseMultiRef(evt.r3021)
    for (const cId of conceptIds) {
      const concept = conceptMap[cId]
      if (concept) {
        addNode(cId, 'concept', concept.t2417 || concept.name || `Концепт #${cId}`, {})
        edges.push({ source: evtId, target: `concept:${cId}`, relation: 'concept' })
      }
    }

    // Edges: causal chains (r3024 = linked events)
    const linkedIds = parseMultiRef(evt.r3024)
    for (const lId of linkedIds) {
      edges.push({ source: `evt:${lId}`, target: evtId, relation: 'causes' })
    }

    // Edge: project ref (r62313 → type 1155)
    if (evt.r62313) {
      const projId = Array.isArray(evt.r62313) ? evt.r62313[0] : evt.r62313
      if (projId) {
        addNode(projId, 'project', `Проект #${projId}`, {})
        edges.push({ source: evtId, target: `project:${projId}`, relation: 'project' })
      }
    }
  }

  return { nodes, edges, eventCount: filteredEvents.length }
}

function buildTransitionMatrix(events) {
  // Count event type sequences via causal links
  const counts = {}
  const totals = {}

  const typeOf = (evt) => EVENT_TYPE_LABELS[evt.r3044] || 'Неизвестно'

  const evtMap = Object.fromEntries(events.map(e => [e.id, e]))

  for (const evt of events) {
    const linkedIds = parseMultiRef(evt.r3024)
    for (const causeId of linkedIds) {
      const cause = evtMap[causeId]
      if (!cause) continue
      const from = typeOf(cause)
      const to   = typeOf(evt)
      const key  = `${from}→${to}`
      counts[key] = (counts[key] || 0) + 1
      totals[from] = (totals[from] || 0) + 1
    }
  }

  // Normalize to probabilities
  const matrix = {}
  for (const [key, count] of Object.entries(counts)) {
    const [from] = key.split('→')
    matrix[key] = {
      count,
      probability: totals[from] ? Math.round((count / totals[from]) * 100) / 100 : 0
    }
  }

  // Shannon entropy reduction per source type
  const entropyReduction = {}
  for (const [from, total] of Object.entries(totals)) {
    const outgoing = Object.entries(counts)
      .filter(([k]) => k.startsWith(`${from}→`))
      .map(([, c]) => c / total)
    const entropy = -outgoing.reduce((s, p) => s + (p > 0 ? p * Math.log2(p) : 0), 0)
    const maxEntropy = Math.log2(4) // 4 event types
    entropyReduction[from] = Math.round((1 - entropy / maxEntropy) * 100)
  }

  return { matrix, totals, entropyReduction }
}

function parseMultiRef(val) {
  if (!val) return []
  if (Array.isArray(val)) return val.map(Number).filter(Boolean)
  if (typeof val === 'number') return [val]
  if (typeof val === 'string') {
    return val.split(',').map(s => Number(s.trim())).filter(Boolean)
  }
  return []
}

/**
 * GET /api/fst/events/graph
 * Полный граф всех событий, акторов, концептов
 */
router.get('/events/graph', async (req, res) => {
  try {
    const { token } = await authenticateIntegram()
    const [events, actors, concepts] = await Promise.all([
      fetchAll(TYPE_EVENTS, token),
      fetchAll(TYPE_ACTORS, token),
      fetchAll(TYPE_CONCEPTS, token),
    ])

    const graph = buildGraph(events, actors, concepts)

    res.json({
      ...graph,
      meta: {
        totalActors:   actors.length,
        totalConcepts: concepts.length,
        timestamp:     new Date().toISOString(),
      }
    })
  } catch (err) {
    console.error('[EventGraph] graph error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

/**
 * GET /api/fst/events/graph/matrix
 * Матрица переходов между типами событий
 */
router.get('/events/graph/matrix', async (req, res) => {
  try {
    const { token } = await authenticateIntegram()
    const events = await fetchAll(TYPE_EVENTS, token)
    const result = buildTransitionMatrix(events)

    res.json({
      ...result,
      eventTypes: Object.values(EVENT_TYPE_LABELS),
      totalEvents: events.length,
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    console.error('[EventGraph] matrix error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

/**
 * GET /api/fst/events/graph/:actorId
 * Граф событий для конкретной компании (актора)
 */
router.get('/events/graph/:actorId', async (req, res) => {
  try {
    const { actorId } = req.params
    const { token } = await authenticateIntegram()

    const [events, actors, concepts] = await Promise.all([
      fetchAll(TYPE_EVENTS, token),
      fetchAll(TYPE_ACTORS, token),
      fetchAll(TYPE_CONCEPTS, token),
    ])

    const graph = buildGraph(events, actors, concepts, actorId)

    if (graph.eventCount === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: `No events found for actor ${actorId}`
      })
    }

    const actor = actors.find(a => a.id === Number(actorId))
    res.json({
      ...graph,
      actor: actor ? { id: actor.id, name: actor.t2407 || actor.name } : null,
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    console.error('[EventGraph] actor graph error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

/**
 * GET /api/fst/events/backtest
 * Результаты последнего бэктеста (из backtest-result.json)
 */
router.get('/events/backtest', (req, res) => {
  if (!existsSync(BACKTEST_JSON)) {
    return res.status(404).json({ error: 'Backtest not run yet. Run: node src/scripts/eventBacktest.js' })
  }
  try {
    const data = JSON.parse(readFileSync(BACKTEST_JSON, 'utf8'))
    res.json(data)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
