/**
 * Gift Economy API Routes
 * Value exchange engine endpoints for stakeholder management,
 * gift lifecycle, reciprocity graph, and fund analytics.
 *
 * All endpoints are prefixed with /api/gift by the parent router.
 */

import { Router } from 'express'

const router = Router()

// ── Lazy singleton ──────────────────────────────────────────────────────────

let _engine = null

async function getEngine() {
  if (_engine) return _engine
  const { getGiftEngine } = await import('../../services/gift/GiftEngine.js')
  _engine = getGiftEngine()
  await _engine.bootstrap()
  return _engine
}

// ── Persons ─────────────────────────────────────────────────────────────────

// POST /api/gift/persons — register a stakeholder
router.post('/persons', async (req, res) => {
  try {
    const { name, role, calling } = req.body
    if (!name) return res.status(400).json({ error: 'name is required' })

    const engine = await getEngine()
    const person = engine.persons.register(name, {
      calling: calling || role || '',
      description: role || '',
    })

    res.json({ success: true, person })
  } catch (err) {
    console.error('[Gift] POST /persons error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// GET /api/gift/persons — list all stakeholders
router.get('/persons', async (req, res) => {
  try {
    const engine = await getEngine()
    const persons = engine.persons.all()
    res.json({ success: true, persons })
  } catch (err) {
    console.error('[Gift] GET /persons error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// GET /api/gift/persons/:id — get one stakeholder
router.get('/persons/:id', async (req, res) => {
  try {
    const engine = await getEngine()
    const person = engine.persons.get(req.params.id)
    if (!person) return res.status(404).json({ error: 'Stakeholder not found' })
    res.json({ success: true, person })
  } catch (err) {
    console.error('[Gift] GET /persons/:id error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ── Value Exchange Lifecycle ────────────────────────────────────────────────

// POST /api/gift/offer — offer a value exchange
router.post('/offer', async (req, res) => {
  try {
    const { fromId, toId, content, layer, telos } = req.body
    if (!fromId || !content) {
      return res.status(400).json({ error: 'fromId and content are required' })
    }

    const engine = await getEngine()
    const exchange = engine.offer({
      giver: fromId,
      receiver: toId || 'all',
      content,
      layer: layer || undefined,
      telos: telos || undefined,
    })

    res.json({ success: true, exchange })
  } catch (err) {
    console.error('[Gift] POST /offer error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// POST /api/gift/accept/:id — accept an exchange
router.post('/accept/:id', async (req, res) => {
  try {
    const engine = await getEngine()
    const exchange = engine.accept(req.params.id)
    res.json({ success: true, exchange })
  } catch (err) {
    console.error('[Gift] POST /accept/:id error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// POST /api/gift/decline/:id — decline an exchange
router.post('/decline/:id', async (req, res) => {
  try {
    const { reason } = req.body
    const engine = await getEngine()
    const exchange = engine.decline(req.params.id, reason || undefined)
    res.json({ success: true, exchange })
  } catch (err) {
    console.error('[Gift] POST /decline/:id error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ── Queries ─────────────────────────────────────────────────────────────────

// GET /api/gift/exchanges — list exchanges with optional filters
router.get('/exchanges', async (req, res) => {
  try {
    const { status, layer, giver, receiver, telos, limit } = req.query
    const engine = await getEngine()

    let exchanges = engine.getGifts({
      status: status || undefined,
      giver: giver || undefined,
      receiver: receiver || undefined,
      telos: telos || undefined,
      limit: limit ? Number(limit) : 50,
    })

    // Additional client-side filter for layer (not supported by getGifts)
    if (layer) {
      exchanges = exchanges.filter(e => e.layer === layer)
    }

    res.json({ success: true, exchanges })
  } catch (err) {
    console.error('[Gift] GET /exchanges error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ── Statistics ──────────────────────────────────────────────────────────────

// GET /api/gift/stats — summary statistics
router.get('/stats', async (req, res) => {
  try {
    const engine = await getEngine()
    const stats = engine.getStats()
    res.json({ success: true, stats })
  } catch (err) {
    console.error('[Gift] GET /stats error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ── Reciprocity Graph ───────────────────────────────────────────────────────

// GET /api/gift/reciprocity/edges — graph edges
router.get('/reciprocity/edges', async (req, res) => {
  try {
    const engine = await getEngine()
    const exported = engine.gratitude.export()
    res.json({ success: true, edges: exported })
  } catch (err) {
    console.error('[Gift] GET /reciprocity/edges error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// GET /api/gift/reciprocity/density — reciprocity density number
router.get('/reciprocity/density', async (req, res) => {
  try {
    const engine = await getEngine()
    const density = engine.gratitude.density()
    res.json({ success: true, density })
  } catch (err) {
    console.error('[Gift] GET /reciprocity/density error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// GET /api/gift/reciprocity/cycles — mutual value cycles
router.get('/reciprocity/cycles', async (req, res) => {
  try {
    const engine = await getEngine()
    const result = engine.getPerichoresis()
    res.json({ success: true, ...result })
  } catch (err) {
    console.error('[Gift] GET /reciprocity/cycles error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ── Telos (Strategic Goals) ─────────────────────────────────────────────────

// GET /api/gift/telos/progress — strategic goals progress
router.get('/telos/progress', async (req, res) => {
  try {
    const engine = await getEngine()
    const progress = engine.telos.getAllProgress()
    res.json({ success: true, progress })
  } catch (err) {
    console.error('[Gift] GET /telos/progress error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ── Patterns ────────────────────────────────────────────────────────────────

// GET /api/gift/patterns — pattern observations
router.get('/patterns', async (req, res) => {
  try {
    const { stakeholderId } = req.query
    const engine = await getEngine()
    const patterns = engine.getPatterns(stakeholderId || undefined)
    res.json({ success: true, patterns })
  } catch (err) {
    console.error('[Gift] GET /patterns error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ── Fund Analytics ──────────────────────────────────────────────────────────

// GET /api/gift/fund/health — portfolio health analysis
router.get('/fund/health', async (req, res) => {
  try {
    const engine = await getEngine()
    const stats = engine.getStats()
    const perichoresis = engine.getPerichoresis()
    const patterns = engine.getPatterns()

    const health = {
      stakeholders: stats.stakeholders,
      totalExchanges: stats.totalExchanges,
      acceptanceRate: stats.acceptanceRate,
      reciprocityDensity: stats.reciprocityDensity,
      pendingExchanges: stats.pending,
      mutualCycles: perichoresis.cycles.length,
      mutualPairs: perichoresis.pairs.length,
      strategicGoals: stats.strategicGoals,
      goalProgress: stats.goalProgress,
      contextMemoryLinks: stats.contextMemoryLinks,
      patterns,
    }

    res.json({ success: true, health })
  } catch (err) {
    console.error('[Gift] GET /fund/health error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// POST /api/gift/fund/analyze — analyze a specific project
router.post('/fund/analyze', async (req, res) => {
  try {
    const { projectId, stakeholderId } = req.body
    if (!projectId && !stakeholderId) {
      return res.status(400).json({ error: 'projectId or stakeholderId is required' })
    }

    const engine = await getEngine()
    const id = stakeholderId || projectId

    const person = engine.persons.get(id) || engine.persons.findByName(id)
    if (!person) {
      return res.status(404).json({ error: `Stakeholder "${id}" not found` })
    }

    const patterns = engine.getPatterns(person.id)
    const discoveredTelos = engine.getDiscoveredTelos(person.id)
    const needs = engine.whatIsNeeded(person.id)

    // Exchanges involving this stakeholder
    const asGiver = engine.getGifts({ giver: person.id })
    const asReceiver = engine.getGifts({ receiver: person.id })

    res.json({
      success: true,
      analysis: {
        stakeholder: person,
        patterns,
        discoveredTelos,
        needs,
        exchangesGiven: asGiver.length,
        exchangesReceived: asReceiver.length,
        recentGiven: asGiver.slice(0, 10),
        recentReceived: asReceiver.slice(0, 10),
      },
    })
  } catch (err) {
    console.error('[Gift] POST /fund/analyze error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

export default router
