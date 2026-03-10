import { bayesianUpdate, dcf, irr, kelly, brierScore, monteCarloVaR, sharpeRatio, blackScholes, nashEquilibrium, shapleyValue, unitEconomics, portfolioRisk } from './calc.mjs'
import express from 'express'
import { createServer } from 'http'
import { WebSocketServer } from 'ws'
import { execSync } from 'child_process'
import platformRoutes    from './src/api/routes/platform.js'
import portfolioRoutes  from './src/api/routes/portfolio.js'
import startuperRoutes  from './src/api/routes/startuper.js'
import glossaryRoutes   from './src/api/routes/glossary.js'
import grMeasuresRoutes from './src/api/routes/grMeasures.js'
import roomRoutes       from './src/api/routes/room.js'
import eventsRoutes     from './src/api/routes/events.js'
import aiTokensRoutes   from './src/api/routes/ai-tokens.js'

const app = express()
const server = createServer(app)
const wss = new WebSocketServer({ server, path: '/ws' })

app.use(express.json())

// CORS
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Authorization')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  if (req.method === 'OPTIONS') return res.sendStatus(204)
  next()
})

// ── WebSocket ────────────────────────────────────────────────────
const clients = new Map()
wss.on('connection', (ws) => {
  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw)
      if (msg.type === 'notifications:subscribe' && msg.userId) {
        clients.set(msg.userId, ws)
        ws.send(JSON.stringify({ type: 'notification:unread-count', data: { count: 0 } }))
      }
    } catch {}
  })
  ws.on('close', () => {
    for (const [uid, client] of clients) if (client === ws) clients.delete(uid)
  })
})

// ── Deployment info ──────────────────────────────────────────────
app.get('/api/deployment-info', (req, res) => {
  try {
    const hash = execSync('git -C /root/fst-app rev-parse --short HEAD 2>/dev/null || echo unknown').toString().trim()
    const date = execSync('git -C /root/fst-app log -1 --format=%ci 2>/dev/null || echo ').toString().trim()
    const msg  = execSync('git -C /root/fst-app log -1 --format=%s 2>/dev/null || echo ').toString().trim()
    res.json({ commit: hash, date, message: msg, branch: 'main', status: 'ok' })
  } catch {
    res.json({ commit: 'unknown', date: '', message: '', branch: 'main', status: 'ok' })
  }
})

// ── Orchestrator status ──────────────────────────────────────────
app.get('/api/orchestrator/status', (req, res) => {
  res.json({ status: 'ok', version: '1.0', services: {} })
})

// ── Profile ──────────────────────────────────────────────────────
app.get('/api/profile/:userId', (req, res) => {
  res.json({ id: req.params.userId, name: 'd', role: 'admin', database: 'fst' })
})

// ── External models list ─────────────────────────────────────────
app.get('/api/ai-tokens/external-models', (req, res) => {
  res.json({
    models: [
      { id: 'deepseek/deepseek-chat', name: 'DeepSeek Chat', provider: 'deepseek', available: true },
      { id: 'anthropic/claude-sonnet-4-20250514', name: 'Claude Sonnet 4', provider: 'anthropic', available: !!process.env.ANTHROPIC_API_KEY },
      { id: 'openai/gpt-4o', name: 'GPT-4o', provider: 'openai', available: !!process.env.OPENAI_API_KEY },
      { id: 'qwen/qwen-turbo', name: 'Qwen Turbo', provider: 'qwen', available: true }
    ]
  })
})

// ── General chat ─────────────────────────────────────────────────
app.get('/api/general-chat/rooms', (req, res) => {
  res.json({ rooms: [], total: 0 })
})
app.post('/api/general-chat/rooms', (req, res) => {
  res.json({ id: Date.now(), ...req.body, messages: [], members: [] })
})
app.get('/api/general-chat/rooms/:id', (req, res) => {
  res.json({ id: req.params.id, name: 'Общий чат', messages: [], members: [] })
})
app.get('/api/general-chat/rooms/:id/messages', (req, res) => {
  res.json({ messages: [], total: 0 })
})
app.post('/api/general-chat/rooms/:id/messages', (req, res) => {
  res.json({ id: Date.now(), ...req.body })
})
app.put('/api/general-chat/messages/:id', (req, res) => {
  res.json({ id: req.params.id, ...req.body })
})
app.delete('/api/general-chat/rooms/:roomId/messages/:msgId', (req, res) => {
  res.json({ ok: true })
})
app.get('/api/general-chat/rooms/:id/members', (req, res) => {
  res.json({ members: [] })
})
app.post('/api/general-chat/rooms/:id/members', (req, res) => {
  res.json({ ok: true })
})
app.put('/api/general-chat/members/:id/read', (req, res) => {
  res.json({ ok: true })
})

// ── AI tokens chat ───────────────────────────────────────────────
const AI_PROVIDERS = {
  'deepseek/deepseek-chat': { url: 'https://api.deepseek.com/v1/chat/completions', key: process.env.DEEPSEEK_API_KEY, model: 'deepseek-chat' },
  'anthropic/claude-sonnet-4-20250514': { url: 'https://api.anthropic.com/v1/messages', key: process.env.ANTHROPIC_API_KEY, model: 'claude-sonnet-4-6-20251001', anthropic: true },
  'openai/gpt-4o': { url: 'https://api.openai.com/v1/chat/completions', key: process.env.OPENAI_API_KEY, model: 'gpt-4o' }
}

app.post('/api/ai-tokens/chat', async (req, res) => {
  const { modelId, prompt, systemPrompt, application } = req.body
  const provider = AI_PROVIDERS[modelId] || AI_PROVIDERS['deepseek/deepseek-chat']
  if (!provider.key) return res.status(503).json({ error: `No API key for ${modelId}` })
  try {
    const isAnthropic = provider.anthropic
    const body = isAnthropic
      ? JSON.stringify({ model: provider.model, max_tokens: 4096, system: systemPrompt || '', messages: [{ role: 'user', content: prompt }] })
      : JSON.stringify({ model: provider.model, messages: [...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []), { role: 'user', content: prompt }], max_tokens: 4096 })
    const headers = isAnthropic
      ? { 'Content-Type': 'application/json', 'x-api-key': provider.key, 'anthropic-version': '2023-06-01' }
      : { 'Content-Type': 'application/json', 'Authorization': `Bearer ${provider.key}` }
    const response = await fetch(provider.url, { method: 'POST', headers, body })
    const data = await response.json()
    const text = isAnthropic ? data.content?.[0]?.text || '' : data.choices?.[0]?.message?.content || ''
    res.json({ response: text, model: provider.model, application })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── Integram auth proxy ──────────────────────────────────────────
app.post('/api/integram-auth/authenticate', async (req, res) => {
  const { login, password, database } = req.body
  try {
    const resp = await fetch(`https://ai2o.ru/${database || 'fst'}/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ login, password })
    })
    const data = await resp.json()
    res.json(data)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})


// ── Calculator endpoints ────────────────────────────────────────────────────
function calcHandler(fn) {
  return (req, res) => {
    try { res.json({ ok: true, result: fn(req.body) }) }
    catch (e) { res.status(400).json({ ok: false, error: e.message }) }
  }
}
app.post('/api/calc/bayesian',      calcHandler(b => bayesianUpdate(b.prior, b.signals)))
app.post('/api/calc/dcf',           calcHandler(b => dcf(b.cashFlows, b.wacc, b.terminalGrowth)))
app.post('/api/calc/irr',           calcHandler(b => irr(b.cashFlows, b.guess)))
app.post('/api/calc/kelly',         calcHandler(b => kelly(b.p, b.b, b.fraction)))
app.post('/api/calc/brier',         calcHandler(b => brierScore(b.forecast, b.outcome)))
app.post('/api/calc/var',           calcHandler(b => monteCarloVaR(b.mu, b.sigma, b.horizon, b.confidence)))
app.post('/api/calc/sharpe',        calcHandler(b => sharpeRatio(b.returns, b.riskFreeRate)))
app.post('/api/calc/blackscholes',  calcHandler(b => blackScholes(b.S, b.K, b.T, b.r, b.sigma)))
app.post('/api/calc/nash',          calcHandler(b => nashEquilibrium(b.votes)))
app.post('/api/calc/shapley',       calcHandler(b => shapleyValue(b.agents, b.history)))
app.post('/api/calc/uniteconomics', calcHandler(b => unitEconomics(b)))
app.post('/api/calc/portfolio',     calcHandler(b => portfolioRisk(b.assets)))
app.get('/api/calc/tools',          (req, res) => res.json({ tools: ['bayesian','dcf','irr','kelly','brier','var','sharpe','blackscholes','nash','shapley','uniteconomics','portfolio'] }))

app.use('/api/platform',  platformRoutes)
app.use('/api/fst',       portfolioRoutes)
app.use('/api/startuper', startuperRoutes)
app.use('/api/glossary',  glossaryRoutes)
app.use('/api/fst',       grMeasuresRoutes)
app.use('/api',           roomRoutes)
app.use('/api',           eventsRoutes)
app.use('/api',           aiTokensRoutes)

const PORT = parseInt(process.env.FST_API_PORT || '8082')
server.listen(PORT, () => console.log(`[FST API] Listening on port ${PORT}`))
