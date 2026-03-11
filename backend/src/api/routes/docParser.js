/**
 * Doc Parser API
 *
 * POST /api/fst/docs/parse            — запустить парсинг всех документов
 * POST /api/fst/docs/parse/:projectId — парсинг документов конкретного проекта
 * GET  /api/fst/docs/parse/status     — статус текущего парсинга
 * GET  /api/fst/docs/preview          — сухой прогон (без записи в БД)
 */

import { Router } from 'express'
import { parseProjectDocs } from '../../parsers/projectDocsParser.js'

const router = Router()

// Состояние текущего парсинга (in-memory)
let parseState = {
  running: false,
  startedAt: null,
  result: null,
  error: null,
}

function runParse(options) {
  parseState = { running: true, startedAt: new Date().toISOString(), result: null, error: null }

  parseProjectDocs(options)
    .then(result => {
      parseState = { running: false, startedAt: parseState.startedAt, result, error: null }
    })
    .catch(err => {
      parseState = { running: false, startedAt: parseState.startedAt, result: null, error: err.message }
    })
}

// POST /api/fst/docs/parse
router.post('/docs/parse', (req, res) => {
  if (parseState.running) {
    return res.status(409).json({ error: 'Parse already running', state: parseState })
  }
  runParse({})
  res.json({ ok: true, message: 'Parse started', state: parseState })
})

// POST /api/fst/docs/parse/:projectId
router.post('/docs/parse/:projectId', (req, res) => {
  if (parseState.running) {
    return res.status(409).json({ error: 'Parse already running', state: parseState })
  }
  runParse({ projectFilter: req.params.projectId })
  res.json({ ok: true, message: `Parse started for project ${req.params.projectId}`, state: parseState })
})

// GET /api/fst/docs/parse/status
router.get('/docs/parse/status', (req, res) => {
  res.json(parseState)
})

// GET /api/fst/docs/preview — dry run, не пишет в БД
router.post('/docs/preview', async (req, res) => {
  try {
    const result = await parseProjectDocs({ dryRun: true })
    res.json({ ok: true, result })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
