/**
 * Events API — REST endpoint для event sourcing лога
 *
 * POST /api/events          — append event
 * GET  /api/events/:entityType/:entityId  — get timeline
 * GET  /api/events/:entityType            — all timelines for type
 * DELETE /api/events/:intId  — delete event by Integram ID
 */

import { Router } from 'express'
import {
  appendEvent,
  getTimeline,
  getTimelinesByType,
  deleteEvent,
} from '../../services/eventLogService.js'

const router = Router()

// ── In-memory session event buffer (for high-frequency polling) ──────────────
// usePresentBroadcast polls /api/events/session/present-live every 2s.
// Loading 10k+ rows from Integram each time causes OOM.
// Keep last N session events in memory — cheap reads.
const SESSION_BUFFER_MAX = 200
const sessionEvents = []  // ring buffer of session-scoped events

// POST /api/events
router.post('/events', async (req, res) => {
  try {
    const { id, entityType, entityId, type, data, ts, label, icon, color, subject, meta } = req.body

    if (!entityType || !entityId || !type) {
      return res.status(400).json({ error: 'entityType, entityId, type — обязательные поля' })
    }

    const event = {
      id:         id || `evt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      entityType,
      entityId,
      type,
      label,
      icon,
      color,
      subject,
      data:       data || {},
      meta:       meta || {},
      ts:         ts || Date.now(),
    }

    // Buffer session events in-memory for fast polling
    if (entityType === 'session') {
      sessionEvents.push(event)
      if (sessionEvents.length > SESSION_BUFFER_MAX) {
        sessionEvents.splice(0, sessionEvents.length - SESSION_BUFFER_MAX)
      }
    }

    await appendEvent(event)
    res.json({ ok: true, event })
  } catch (err) {
    console.error('[Events] append error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// GET /api/events/session/:entityId — fast path (in-memory, no Integram)
router.get('/events/session/:entityId', (req, res) => {
  const { entityId } = req.params
  const filtered = sessionEvents.filter(e => e.entityId === entityId)
  res.json(filtered)
})

// GET /api/events/:entityType/:entityId
router.get('/events/:entityType/:entityId', async (req, res) => {
  try {
    const { entityType, entityId } = req.params
    const timeline = await getTimeline(entityType, entityId)
    res.json(timeline)
  } catch (err) {
    console.error('[Events] getTimeline error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// GET /api/events/:entityType
router.get('/events/:entityType', async (req, res) => {
  try {
    const { entityType } = req.params
    const events = await getTimelinesByType(entityType)

    // Группируем по entityId
    const grouped = {}
    for (const e of events) {
      if (!grouped[e.entityId]) grouped[e.entityId] = []
      grouped[e.entityId].push(e)
    }

    res.json({ entityType, timelines: grouped, total: events.length })
  } catch (err) {
    console.error('[Events] getTimelinesByType error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// DELETE /api/events/:intId
router.delete('/events/:intId', async (req, res) => {
  try {
    await deleteEvent(req.params.intId)
    res.json({ ok: true })
  } catch (err) {
    console.error('[Events] delete error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

export default router
