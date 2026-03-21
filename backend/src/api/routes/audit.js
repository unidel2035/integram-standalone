/**
 * Audit Trail REST API
 *
 * POST /api/audit/log          — receive audit entries (batch)
 * GET  /api/audit/log          — query audit log (with filters)
 * GET  /api/audit/log/:objectId — history for specific object
 */

import { Router } from 'express'
import auditService from '../../services/AuditService.js'

const router = Router()

// Receive audit entries from frontend (fire-and-forget, no auth required)
router.post('/log', (req, res) => {
  const entries = req.body.entries || (req.body.action ? [req.body] : [])
  if (entries.length === 0) {
    return res.status(400).json({ error: 'No entries provided' })
  }
  auditService.log(entries)
  res.json({ ok: true, count: entries.length })
})

// Query audit log
router.get('/log', (req, res) => {
  const { database, objectId, typeId, userId, action, from, to, limit } = req.query
  const results = auditService.query({
    database, objectId, typeId, userId, action, from, to,
    limit: parseInt(limit) || 100
  })
  res.json({ entries: results, count: results.length })
})

// Object history
router.get('/log/:objectId', (req, res) => {
  const limit = parseInt(req.query.limit) || 50
  const results = auditService.getObjectHistory(req.params.objectId, limit)
  res.json({ entries: results, count: results.length })
})

export default router
