import { Router } from 'express'
import { parseAllMeasures, matchMeasuresForProject } from '../../parsers/grMeasuresParser.js'

const router = Router()

let cache = null
let cacheTime = 0
const CACHE_TTL = 3_600_000 // 1 hour

router.get('/gr/measures', async (req, res) => {
  try {
    const now = Date.now()
    if (!cache || now - cacheTime > CACHE_TTL) {
      console.log('[GR] Parsing all support measures...')
      cache = await parseAllMeasures()
      cacheTime = now
      console.log(`[GR] Parsed ${cache.length} measures`)
    }

    const { type, sector, trl } = req.query
    let result = cache

    if (type) result = result.filter(m => m.type === type)
    if (sector) result = result.filter(m => m.sector.includes(sector))
    if (trl) result = result.filter(m => m.trl_min <= +trl && m.trl_max >= +trl)

    res.json({
      measures: result,
      count: result.length,
      total: cache.length,
      cached_at: new Date(cacheTime).toISOString()
    })
  } catch (e) {
    console.error('[GR] Error parsing measures:', e)
    res.status(500).json({ error: e.message })
  }
})

router.post('/gr/measures/match', async (req, res) => {
  try {
    const { project } = req.body
    if (!project) return res.status(400).json({ error: 'project required' })

    const now = Date.now()
    if (!cache || now - cacheTime > CACHE_TTL) {
      cache = await parseAllMeasures()
      cacheTime = now
    }

    const matched = matchMeasuresForProject(cache, project)
    res.json({ measures: matched, count: matched.length })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.post('/gr/measures/refresh', async (req, res) => {
  try {
    console.log('[GR] Force refresh measures...')
    cache = await parseAllMeasures()
    cacheTime = Date.now()
    res.json({ count: cache.length, refreshed_at: new Date(cacheTime).toISOString() })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

export default router
