import dotenv from 'dotenv'
import { fileURLToPath as _toPath } from 'url'
import { dirname as _dir, join as _join } from 'path'
dotenv.config({ path: _join(_dir(_toPath(import.meta.url)), '.env') })
import { bayesianUpdate, dcf, irr, kelly, brierScore, monteCarloVaR, sharpeRatio, blackScholes, nashEquilibrium, shapleyValue, unitEconomics, portfolioRisk } from './calc.mjs'
import express from 'express'
import { createServer } from 'http'
import { WebSocketServer } from 'ws'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// ── Fund Knowledge Base (loaded once at startup) ────────────────
let FUND_KB = null
try {
  FUND_KB = JSON.parse(readFileSync(join(__dirname, 'data', 'fund-knowledge.json'), 'utf-8'))
  console.log(`[FundKB] Loaded: ${FUND_KB.portfolio.length} portfolio companies, ${FUND_KB.fund.subfunds.length} subfunds`)
} catch (err) {
  console.warn('[FundKB] Failed to load fund-knowledge.json:', err.message)
}

function searchFundKB(query) {
  if (!FUND_KB || !query) return ''
  const q = query.toLowerCase()
  const words = q.split(/\s+/).filter(w => w.length > 2)
  if (words.length === 0) return ''

  const fundKeywords = ['фонд', 'фст', 'нти', 'субфонд', 'портфел', 'инвест', 'компани', 'проект']
  const isFundQuery = words.some(w => fundKeywords.some(k => w.includes(k)))
  const isListAll = isFundQuery && words.some(w => ['все', 'всех', 'перечисл', 'список', 'сколько', 'какие', 'портфел'].some(k => w.includes(k)))

  // Fund info block
  let fundBlock = ''
  if (isFundQuery) {
    fundBlock = `Фонд: ${FUND_KB.fund.name}, размер ${FUND_KB.fund.size}, ${FUND_KB.fund.subfunds.length} субфондов: ${FUND_KB.fund.subfunds.map(s => s.name).join(', ')}. Стадии: ${FUND_KB.fund.stages}. Критерии: ${FUND_KB.fund.criteria}.\n`
  }

  let companies
  if (isListAll) {
    // Return ALL portfolio companies when asking about the full portfolio
    companies = FUND_KB.portfolio
  } else {
    // Score each company by keyword matches
    companies = FUND_KB.portfolio.map(c => {
      const haystack = [c.name, c.subfund, c.description, c.sector, ...(c.tags || [])].filter(Boolean).join(' ').toLowerCase()
      let score = 0
      for (const w of words) {
        if (haystack.includes(w)) score++
      }
      return { ...c, score }
    }).filter(c => c.score > 0).sort((a, b) => b.score - a.score).slice(0, 10)
  }

  if (companies.length === 0 && !fundBlock) return ''

  const companiesBlock = companies.map(c =>
    `[${c.subfund || '?'}] ${c.name}: ${c.description}${c.trl ? ` TRL ${c.trl}` : ''}${c.founded ? `, осн. ${c.founded}` : ''}`
  ).join('\n')

  return (fundBlock + companiesBlock) || ''
}
import { execSync } from 'child_process'
import * as nodePty from 'node-pty'
import platformRoutes    from './src/api/routes/platform.js'
import portfolioRoutes  from './src/api/routes/portfolio.js'
import startuperRoutes  from './src/api/routes/startuper.js'
import glossaryRoutes   from './src/api/routes/glossary.js'
import grMeasuresRoutes from './src/api/routes/grMeasures.js'
import roomRoutes       from './src/api/routes/room.js'
import eventsRoutes     from './src/api/routes/events.js'
import aiTokensRoutes   from './src/api/routes/ai-tokens.js'
import expertRoutes     from './src/api/routes/expert.js'
import factorRoutes     from './src/api/routes/factorModel.js'
import userRoutes       from './src/api/routes/user.js'
import eventGraphRoutes from './src/api/routes/eventGraph.js'
import docParserRoutes  from './src/api/routes/docParser.js'
import billingRoutes    from './src/api/routes/billing.js'
import { logUsage, incrementUsage, checkTokenQuota, deductTokens } from './src/services/billingService.js'
import { refreshConfig } from './src/services/fstConfigService.js'
import { createKAGFstMCPRoutes } from './src/api/routes/kag.js'
import { createClaudeMemoryRoutes } from './src/api/routes/claude-memory.js'
import { createFundOrchestrator } from './src/agents/orchestration/FundOrchestrator.js'

const app = express()
const server = createServer(app)

// Both WS servers use noServer so we can route upgrades manually
const wss = new WebSocketServer({ noServer: true })
const wssClaude = new WebSocketServer({ noServer: true })
const claudeSessions = new Map() // clientId → { pty, ws }

server.on('upgrade', (request, socket, head) => {
  const url = new URL(request.url, 'http://localhost')
  if (url.pathname === '/ws') {
    wss.handleUpgrade(request, socket, head, (ws) => wss.emit('connection', ws, request))
  } else if (url.pathname === '/wsclaude') {
    wssClaude.handleUpgrade(request, socket, head, (ws) => wssClaude.emit('connection', ws, request))
  } else {
    socket.destroy()
  }
})

wssClaude.on('connection', (ws, req) => {
  const url = new URL(req.url, 'http://localhost')
  const workspaceId = url.searchParams.get('workspaceId') || 'default'
  const mode        = url.searchParams.get('mode') || 'auto'
  const inClientId  = url.searchParams.get('clientId')
  console.log(`[wsclaude] connection workspaceId=${workspaceId} mode=${mode}`)

  // Reconnect to existing session?
  if (inClientId && claudeSessions.has(inClientId)) {
    const sess = claudeSessions.get(inClientId)
    if (sess.ws && sess.ws.readyState === 1) sess.ws.close(1000, 'replaced')
    sess.ws = ws
    ws.send(JSON.stringify({ type: 'session', clientId: inClientId, mode: 'reconnect' }))
    ws.on('message', (raw) => handleClaudeInput(ws, sess.pty, raw))
    ws.on('close', () => { if (claudeSessions.get(inClientId)?.ws === ws) sess.ws = null })
    return
  }

  // New session
  const clientId = `client_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
  const claudePath = process.env.CLAUDE_BINARY || '/usr/bin/claude'
  const claudeArgs = claudePath.endsWith('claude') ? (mode === 'continue' ? ['--continue'] : []) : []
  const projectDir = process.env.PROJECT_DIR || '/root/fst-app'

  // Create isolated git worktree for each new session (not continue)
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const shortId = clientId.slice(-7)
  const sessionBranch = `expert/${dateStr}-${shortId}`
  const worktreeDir = `/tmp/fst-wt-${shortId}`
  let cwd = projectDir

  if (mode !== 'continue') {
    try {
      execSync(`git -C ${projectDir} worktree add ${worktreeDir} -b ${sessionBranch} 2>&1`, { stdio: 'pipe' })
      cwd = worktreeDir
      console.log(`[wsclaude] worktree ${worktreeDir} → branch ${sessionBranch}`)
    } catch (err) {
      console.error('[wsclaude] worktree create failed, using main dir:', err.message)
    }
  }

  let pty
  try {
    // Strip Claude Code session env vars so nested claude can start
    const childEnv = { ...process.env, TERM: 'xterm-256color', COLORTERM: 'truecolor' }
    delete childEnv.CLAUDECODE
    delete childEnv.CLAUDE_CODE_ENTRYPOINT
    delete childEnv.CLAUDE_CODE_IDE_NAME
    delete childEnv.CLAUDE_CODE_IDE_VERSION
    delete childEnv.CLAUDE_CODE_SESSION_ID
    // Route Claude Code through HTTP proxy to bypass geo-restrictions
    const proxyUrl = process.env.CLAUDE_PROXY || 'http://127.0.0.1:8888'
    childEnv.HTTPS_PROXY = proxyUrl
    childEnv.HTTP_PROXY = proxyUrl

    pty = nodePty.spawn(claudePath, claudeArgs, {
      name: 'xterm-256color',
      cols: 120, rows: 30,
      cwd,
      env: childEnv
    })
  } catch (err) {
    console.error('[wsclaude] spawn error:', err.message)
    // Clean up worktree if spawn failed
    if (cwd !== projectDir) {
      try { execSync(`git -C ${projectDir} worktree remove --force ${worktreeDir}`) } catch {}
    }
    ws.send(JSON.stringify({ type: 'error', error: `Failed to start claude: ${err.message}`, fatal: true }))
    ws.close()
    return
  }
  console.log(`[wsclaude] spawned PTY pid=${pty.pid} cwd=${cwd}`)

  const sess = { pty, ws, clientId, cwd, branch: cwd !== projectDir ? sessionBranch : null }
  claudeSessions.set(clientId, sess)
  ws.send(JSON.stringify({ type: 'session', clientId, mode, branch: sess.branch }))

  pty.onData((data) => {
    if (ws.readyState === 1) ws.send(JSON.stringify({ type: 'output', data }))
  })

  pty.onExit(({ exitCode }) => {
    if (ws.readyState === 1) ws.send(JSON.stringify({ type: 'exit', code: exitCode }))
    claudeSessions.delete(clientId)
    // Remove worktree dir but keep the branch for review/merge
    if (cwd !== projectDir) {
      try { execSync(`git -C ${projectDir} worktree remove --force ${worktreeDir}`) } catch {}
    }
  })

  ws.on('message', (raw) => handleClaudeInput(ws, pty, raw))
  ws.on('close', (code) => {
    if (code !== 1000 && code !== 1001) return // keep PTY alive for reconnect
    pty.kill()
    claudeSessions.delete(clientId)
    if (cwd !== projectDir) {
      try { execSync(`git -C ${projectDir} worktree remove --force ${worktreeDir}`) } catch {}
    }
  })
})

function handleClaudeInput(ws, pty, raw) {
  try {
    const msg = JSON.parse(raw)
    if (msg.type === 'input')        pty.write(msg.data)
    else if (msg.type === 'resize')  pty.resize(Math.max(1, msg.cols), Math.max(1, msg.rows))
    else if (msg.type === 'ping')    ws.send(JSON.stringify({ type: 'pong' }))
  } catch {}
}

app.use(express.json({ limit: '10mb' }))

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

// ── Orchestrator status / execute ────────────────────────────────
app.get('/api/orchestrator/status', (req, res) => {
  res.json({ success: true, data: { status: { orchestrator: { initialized: false, status: 'stub' }, registry: { totalAgents: 0, byType: {}, byStatus: {} }, agents: [] } } })
})
app.post('/api/orchestrator/execute', (req, res) => {
  res.json({ success: true, matches: [], answer: null, sources: [], executionTime: 0 })
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
const POLZA_URL = 'https://api.polza.ai/api/v1/chat/completions'

function resolveProvider(modelId = '') {
  if (AI_PROVIDERS[modelId]) return AI_PROVIDERS[modelId]
  // polza/* модели
  if (modelId.startsWith('polza/')) {
    const model = modelId.replace(/^polza\//, '')
    return { url: POLZA_URL, key: process.env.POLZA_API_KEY, model }
  }
  return AI_PROVIDERS['deepseek/deepseek-chat']
}

// Маппинг моделей на Polza-эквиваленты для автоматического fallback
const POLZA_FALLBACK = {
  'deepseek-chat':              'deepseek/deepseek-chat',
  'claude-sonnet-4-6-20251001': 'anthropic/claude-sonnet-4.6',
  'gpt-4o':                     'openai/gpt-4o',
}

async function callProvider(provider, prompt, systemPrompt, chatHistory = []) {
  const isAnthropic = provider.anthropic
  // Build messages array: system + history + current prompt
  const userMessages = chatHistory.length > 0
    ? [...chatHistory, { role: 'user', content: prompt }]
    : [{ role: 'user', content: prompt }]
  const body = isAnthropic
    ? JSON.stringify({ model: provider.model, max_tokens: 4096, system: systemPrompt || '', messages: userMessages })
    : JSON.stringify({ model: provider.model, messages: [...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []), ...userMessages], max_tokens: 4096 })
  const headers = isAnthropic
    ? { 'Content-Type': 'application/json', 'x-api-key': provider.key, 'anthropic-version': '2023-06-01' }
    : { 'Content-Type': 'application/json', 'Authorization': `Bearer ${provider.key}` }
  const response = await fetch(provider.url, { method: 'POST', headers, body })
  const data = await response.json()
  if (!response.ok) {
    const raw = data.error?.message || data.error?.code || JSON.stringify(data.error) || `HTTP ${response.status}`
    const isBalance = /insufficient.balance|недостаточно средств/i.test(raw)
    return { ok: false, raw, isBalance }
  }
  const text = isAnthropic ? data.content?.[0]?.text || '' : data.choices?.[0]?.message?.content || ''
  const usage = isAnthropic
    ? { promptTokens: data.usage?.input_tokens || 0, completionTokens: data.usage?.output_tokens || 0, costRub: data.usage?.cost_rub || 0 }
    : { promptTokens: data.usage?.prompt_tokens || 0, completionTokens: data.usage?.completion_tokens || 0, costRub: data.usage?.cost_rub || 0 }
  return { ok: true, text, model: provider.model, usage }
}

app.post('/api/ai-tokens/chat', async (req, res) => {
  const { modelId, prompt, application, messages: chatMessages } = req.body
  let { systemPrompt } = req.body
  // chatMessages: optional array of { role: 'user'|'assistant', content: string } for conversation history
  const userId = req.body.userId || 'anonymous'
  const provider = resolveProvider(modelId)
  if (!provider.key) return res.status(503).json({ error: `Нет API-ключа для ${modelId}` })

  // Проверка баланса токенов
  try {
    const tokenCheck = await checkTokenQuota(userId)
    if (!tokenCheck.allowed) {
      return res.status(402).json({
        error: 'Баланс токенов исчерпан. Пополните баланс в разделе Биллинг.',
        code: 'INSUFFICIENT_TOKENS',
        balance: tokenCheck.balance,
      })
    }
  } catch (err) {
    console.error('[Billing] token quota check error:', err.message)
  }

  // ── Fund Anamnesis Memory (3 слоя: KAG + ClaudeMemory + JSON fallback) ──
  if (prompt && systemPrompt) {
    const memoryParts = []

    // Layer 1: KAG FTS5 — онтология, схема БД, финметрики (limit 20)
    try {
      const kagResp = await fetch(`http://localhost:${PORT}/api/mcp/kag-fst/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toolName: 'kag_search', arguments: { query: prompt, limit: 20 } }),
        signal: AbortSignal.timeout(2000)
      })
      if (kagResp.ok) {
        const kagData = await kagResp.json()
        const text = kagData.result?.content?.[0]?.text
        if (text) {
          const parsed = JSON.parse(text)
          if (parsed.results?.length > 0) {
            // Разделяем: компании отдельно (они пойдут в Layer 3), остальное — KAG
            const kagOnly = parsed.results.filter(e => e.type !== 'PortfolioCompany')
            const kagCompanies = parsed.results.filter(e => e.type === 'PortfolioCompany')
            if (kagOnly.length > 0) {
              const kagBlock = kagOnly.map(e =>
                `[${e.type}] ${e.name}: ${(e.observations || []).slice(0, 5).join('; ')}`
              ).join('\n')
              memoryParts.push(`── ОНТОЛОГИЯ И СХЕМА БД ──\n${kagBlock}`)
            }
            if (kagCompanies.length > 0) {
              const compBlock = kagCompanies.map(e =>
                `${e.name}: ${(e.observations || []).slice(0, 4).join('; ')}`
              ).join('\n')
              memoryParts.push(`── КОМПАНИИ (KAG) ──\n${compBlock}`)
            }
            console.log(`[Anamnesis] KAG: ${kagOnly.length} ontology + ${kagCompanies.length} companies`)
          }
        }
      }
    } catch (kagErr) {
      console.warn('[Anamnesis] KAG search failed:', kagErr.message)
    }

    // Layer 2: ClaudeMemoryService — анамнестическая память (семантика + текст + Integram V2)
    try {
      const memResp = await fetch(`http://localhost:${PORT}/api/claude-memory/search?q=${encodeURIComponent(prompt)}&limit=8`, {
        signal: AbortSignal.timeout(3000)
      })
      if (memResp.ok) {
        const memData = await memResp.json()
        if (memData.data?.length > 0) {
          const memBlock = memData.data.map(m =>
            `[${m.type || '?'}] ${m.name || ''}: ${(m.content || m.text || '').slice(0, 200)}`
          ).join('\n')
          memoryParts.push(`── ПАМЯТЬ СЕССИЙ ──\n${memBlock}`)
          console.log(`[Anamnesis] Memory: ${memData.data.length} records`)
        }
      }
    } catch (memErr) {
      console.warn('[Anamnesis] Memory search failed:', memErr.message)
    }

    // Layer 3: JSON KB — ВСЕГДА добавляем справочник портфеля (полные данные о компаниях)
    const jsonBlock = searchFundKB(prompt)
    if (jsonBlock) {
      memoryParts.push(`── ПОРТФЕЛЬ ФОНДА (справочник) ──\n${jsonBlock}`)
      console.log(`[Anamnesis] JSON KB: ${jsonBlock.split('\n').length} lines`)
    }

    if (memoryParts.length > 0) {
      systemPrompt += `\n\n--- АНАМНЕСТИЧЕСКАЯ ПАМЯТЬ ФОНДА ---\n${memoryParts.join('\n\n')}\n--- КОНЕЦ ПАМЯТИ ---`
    }
  }

  try {
    // Build conversation history (last 10 messages max to fit context)
    const history = Array.isArray(chatMessages)
      ? chatMessages.filter(m => m.role && m.content).slice(-10)
      : []
    let result = await callProvider(provider, prompt, systemPrompt, history)

    // Fallback на Polza при ошибке баланса (если это не уже Polza)
    if (!result.ok && result.isBalance && !modelId?.startsWith('polza/') && process.env.POLZA_API_KEY) {
      const polzaModel = POLZA_FALLBACK[provider.model] || 'deepseek/deepseek-chat'
      console.warn(`[AI] ${modelId} — нет баланса, fallback → polza/${polzaModel}`)
      const polzaProvider = { url: POLZA_URL, key: process.env.POLZA_API_KEY, model: polzaModel }
      result = await callProvider(polzaProvider, prompt, systemPrompt, history)
    }

    if (!result.ok) {
      const errMsg = result.isBalance
        ? `Недостаточно средств на балансе провайдера ${modelId}. Пополните баланс.`
        : `Ошибка AI-провайдера ${modelId}: ${result.raw}`
      console.error(`[AI] ${modelId} error: ${result.raw}`)
      return res.status(502).json({ error: errMsg, provider: modelId })
    }

    // Трекинг использования AI (async, не блокирует ответ)
    const providerName = modelId?.startsWith('polza/') ? 'polza' : (provider.anthropic ? 'anthropic' : 'deepseek')
    const totalTokens = (result.usage?.promptTokens || 0) + (result.usage?.completionTokens || 0)
    logUsage({
      userId, modelId, provider: providerName, application,
      promptTokens: result.usage?.promptTokens,
      completionTokens: result.usage?.completionTokens,
      costRub: result.usage?.costRub,
    }).catch(err => console.error('[Billing] logUsage error:', err.message))
    incrementUsage(userId, result.usage?.costRub || 0)
      .catch(err => console.error('[Billing] incrementUsage error:', err.message))
    // Списание токенов с баланса пользователя
    if (totalTokens > 0) {
      deductTokens(userId, totalTokens, `AI: ${modelId} (${application || 'unknown'})`)
        .catch(err => console.error('[Billing] deductTokens error:', err.message))
    }

    res.json({ response: result.text, model: result.model, application })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── /api/chat — платформенный Chat с Integram tool calling ──────

import { INTEGRAM_TOOLS, executeTool as executeIntegraTool } from './src/services/integram-v2-tools.js'

// OpenAI function-calling format
const OPENAI_TOOLS = INTEGRAM_TOOLS.map(t => ({
  type: 'function',
  function: { name: t.name, description: t.description, parameters: t.input_schema }
}))

app.post('/api/chat', async (req, res) => {
  const {
    message, model: modelId, provider: providerHint,
    systemPrompt, conversationHistory = [],
    stream = false, enableTools = false,
  } = req.body

  if (!message) return res.status(400).json({ success: false, error: 'message is required' })

  // Use provider hint if available, else resolve from modelId
  const provider = providerHint === 'polza'
    ? { url: POLZA_URL, key: process.env.POLZA_API_KEY, model: modelId?.replace(/^polza\//, '') || 'qwen/qwen-turbo' }
    : resolveProvider(modelId)
  if (!provider.key) return res.status(503).json({ success: false, error: `No API key for ${modelId}` })

  // Build messages
  const messages = []
  if (conversationHistory.length > 0) {
    for (const m of conversationHistory.slice(-8)) {
      messages.push({ role: m.role, content: m.content })
    }
  }
  messages.push({ role: 'user', content: message })

  const isAnthropic = provider.anthropic
  const useTools = enableTools && !isAnthropic // Anthropic tool calling needs separate handling
  const useToolsAnthropic = enableTools && isAnthropic

  console.log(`[AI /chat] model=${provider.model} tools=${enableTools} anthropic=${isAnthropic}`)

  // ── Tool-calling mode (SSE) ────────────────────────────────────
  if (useTools || useToolsAnthropic) {
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.flushHeaders()

    try {
      const MAX_ITER = 8
      if (useToolsAnthropic) {
        // Anthropic tool calling loop
        const convMsgs = [...messages]
        for (let i = 0; i < MAX_ITER; i++) {
          const body = {
            model: provider.model, max_tokens: 4096, messages: convMsgs,
            tools: INTEGRAM_TOOLS,
          }
          if (systemPrompt) body.system = systemPrompt
          const upstream = await fetch(provider.url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-api-key': provider.key, 'anthropic-version': '2023-06-01' },
            body: JSON.stringify(body),
          })
          if (!upstream.ok) throw new Error(`Anthropic ${upstream.status}: ${await upstream.text()}`)
          const data = await upstream.json()
          let text = ''
          const toolBlocks = []
          for (const b of (data.content || [])) {
            if (b.type === 'text') text += b.text
            else if (b.type === 'tool_use') toolBlocks.push(b)
          }
          if (text) res.write(`data: ${JSON.stringify({ type: 'content', content: text })}\n\n`)
          if (data.stop_reason !== 'tool_use' || !toolBlocks.length) break
          const toolResults = []
          for (const tb of toolBlocks) {
            res.write(`data: ${JSON.stringify({ type: 'agent:action:start', tool: tb.name, input: tb.input })}\n\n`)
            let result
            try { result = await executeIntegraTool(tb.name, tb.input) } catch (e) { result = { error: e.message } }
            let rs = JSON.stringify(result); if (rs.length > 15000) rs = rs.slice(0, 15000) + '...[truncated]'
            res.write(`data: ${JSON.stringify({ type: 'agent:action:end', tool: tb.name, result: rs })}\n\n`)
            toolResults.push({ type: 'tool_result', tool_use_id: tb.id, content: rs })
          }
          convMsgs.push({ role: 'assistant', content: data.content })
          convMsgs.push({ role: 'user', content: toolResults })
        }
      } else {
        // OpenAI-compatible tool calling loop (DeepSeek, Polza/Qwen)
        const convMsgs = []
        if (systemPrompt) convMsgs.push({ role: 'system', content: systemPrompt })
        convMsgs.push(...messages)
        for (let i = 0; i < MAX_ITER; i++) {
          const body = { model: provider.model, messages: convMsgs, tools: OPENAI_TOOLS, max_tokens: 4096 }
          const upstream = await fetch(provider.url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${provider.key}` },
            body: JSON.stringify(body),
          })
          if (!upstream.ok) throw new Error(`${provider.model} ${upstream.status}: ${await upstream.text()}`)
          const data = await upstream.json()
          const choice = data.choices?.[0]
          const msg = choice?.message
          if (!msg) break
          if (msg.content) res.write(`data: ${JSON.stringify({ type: 'content', content: msg.content })}\n\n`)
          if (choice.finish_reason !== 'tool_calls' || !msg.tool_calls?.length) break
          convMsgs.push(msg)
          for (const tc of msg.tool_calls) {
            let toolArgs; try { toolArgs = JSON.parse(tc.function.arguments) } catch { toolArgs = {} }
            res.write(`data: ${JSON.stringify({ type: 'agent:action:start', tool: tc.function.name, input: toolArgs })}\n\n`)
            let result
            try { result = await executeIntegraTool(tc.function.name, toolArgs) } catch (e) { result = { error: e.message } }
            let rs = JSON.stringify(result); if (rs.length > 15000) rs = rs.slice(0, 15000) + '...[truncated]'
            res.write(`data: ${JSON.stringify({ type: 'agent:action:end', tool: tc.function.name, result: rs })}\n\n`)
            convMsgs.push({ role: 'tool', tool_call_id: tc.id, content: rs })
          }
        }
      }
    } catch (err) {
      console.error('[AI /chat tools] Error:', err.message)
      res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`)
    }
    res.write('data: [DONE]\n\n')
    res.end()
    return
  }

  // ── Streaming mode (no tools) ─────────────────────────────────
  if (stream) {
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.flushHeaders()
    try {
      const result = await callProvider(provider, message, systemPrompt, conversationHistory.slice(-8))
      if (!result.ok) throw new Error(result.raw)
      res.write(`data: ${JSON.stringify({ type: 'content', content: result.text })}\n\n`)
    } catch (err) {
      res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`)
    }
    res.write('data: [DONE]\n\n')
    res.end()
    return
  }

  // ── Non-streaming (no tools) ──────────────────────────────────
  try {
    const result = await callProvider(provider, message, systemPrompt, conversationHistory.slice(-8))
    if (!result.ok) return res.status(502).json({ success: false, error: result.raw })
    res.json({ success: true, response: result.text, model: result.model })
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// ── /api/chat/claude-sub — Claude через подписку (проксирует на claude-sub-proxy:8085)
app.post('/api/chat/claude-sub', async (req, res) => {
  const { message } = req.body
  if (!message) return res.status(400).json({ error: 'message is required' })

  console.log(`[AI /chat/claude-sub] proxying to :8085 (${message.slice(0, 60)}...)`)

  try {
    const upstream = await fetch('http://127.0.0.1:8085/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
    })

    if (!upstream.ok) {
      return res.status(upstream.status).json({ error: await upstream.text() })
    }

    // Pipe SSE stream through
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.flushHeaders()

    for await (const chunk of upstream.body) {
      res.write(Buffer.from(chunk))
    }
    res.end()
  } catch (err) {
    console.error('[claude-sub proxy] error:', err.message)
    res.setHeader('Content-Type', 'text/event-stream')
    res.write(`data: ${JSON.stringify({ error: 'Claude subscription proxy not running. Start: node claude-sub-proxy.mjs' })}\n\n`)
    res.write('data: [DONE]\n\n')
    res.end()
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

// ── FST DB auth (system credentials from .env) ─────────────────
app.post('/api/fst-db/auth', async (req, res) => {
  const login = process.env.INTEGRAM_SYSTEM_USERNAME
  const password = process.env.INTEGRAM_SYSTEM_PASSWORD
  const database = req.body?.database || 'fst'
  if (!login || !password) {
    return res.status(500).json({ error: 'INTEGRAM_SYSTEM_USERNAME/PASSWORD not configured' })
  }
  try {
    const resp = await fetch(`https://ai2o.ru/${database}/auth?JSON_KV`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ login, pwd: password })
    })
    const data = await resp.json()
    if (data.error) return res.status(401).json(data)
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
app.use('/api/expert',   expertRoutes)
app.use('/api/factor',   factorRoutes)
app.use('/api/user',     userRoutes)
app.use('/api/glossary',  glossaryRoutes)
app.use('/api/fst',       grMeasuresRoutes)
app.use('/api/fst',       eventGraphRoutes)
app.use('/api/fst',       docParserRoutes)
app.use('/api',           roomRoutes)
app.use('/api',           eventsRoutes)
app.use('/api',           aiTokensRoutes)
app.use('/api',           billingRoutes)

// ── Doc Blocks — create/sync document in Integram kval ───────────────────────
// Simplified: creates type 1022 Document in kval and returns documentId.
const _docBlocksIntegram = 'https://ai2o.ru'
const _docBlocksLogin = 'unidel@yandex.ru'
const _docBlocksPassword = 'Denver2035'
const _docBlocksFolderId = '1777613'  // VentureOS — Инвест-пакет Pre-Seed 2026
let _docBlocksSession = null

async function _docBlocksAuth(database) {
  if (_docBlocksSession && _docBlocksSession.database === database) return _docBlocksSession
  const body = `login=${encodeURIComponent(_docBlocksLogin)}&pwd=${encodeURIComponent(_docBlocksPassword)}`
  const resp = await fetch(`${_docBlocksIntegram}/${database}/auth?JSON_KV=`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  })
  const text = await resp.text()
  let data
  try { data = JSON.parse(text) } catch(e) { throw new Error(`Integram auth parse error: ${text.slice(0, 200)}`) }
  if (Array.isArray(data)) data = data[0]
  if (!data.token) throw new Error(`Integram auth failed: ${JSON.stringify(data)}`)
  _docBlocksSession = { token: data.token, xsrf: data._xsrf, database }
  return _docBlocksSession
}

async function _docBlocksPost(database, path, params) {
  const sess = await _docBlocksAuth(database)
  const parts = [`_xsrf=${encodeURIComponent(sess.xsrf)}`]
  for (const [k, v] of Object.entries(params)) {
    parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
  }
  const resp = await fetch(`${_docBlocksIntegram}/${database}/${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'X-Authorization': sess.token,
      'Cookie': `token=${sess.token}`
    },
    body: parts.join('&')
  })
  const text = await resp.text()
  try { return JSON.parse(text) }
  catch(e) { throw new Error(`Integram response parse error: ${text.slice(0, 200)}`) }
}

// POST /api/doc-blocks/:docId/sync  (docId = 'new' to create)
app.post('/api/doc-blocks/:docId/sync', async (req, res) => {
  try {
    const { docId } = req.params
    const database = req.body.database || req.query.database || 'kval'
    const { html = '', title = 'Без названия' } = req.body

    let documentId
    if (docId === 'new' || !docId) {
      const created = await _docBlocksPost(database, '_m_new/1022?JSON_KV=', {
        t1022: title,
        r1093: _docBlocksFolderId,
        r1090: '1163',
        up: '1'
      })
      const d = Array.isArray(created) ? created[0] : created
      if (d.error) throw new Error(JSON.stringify(d))
      documentId = String(d.id || d.obj)
    } else {
      documentId = docId
      await _docBlocksPost(database, `_m_set/${documentId}?JSON_KV=`, { t1022: title })
    }

    res.json({ documentId, blocksCreated: 1, blocksUpdated: 0, blocksDeleted: 0, success: true })
  } catch (err) {
    console.error('[DocBlocks] sync error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ── Stub routes for features in development ─────────────────────────────────
// Prevent 404 noise in console from frontend calls

app.get('/api/debate/sessions', (req, res) => res.json([]))
app.get('/api/debate/sessions/:id', (req, res) => res.status(404).json({ error: 'Session not found' }))

// ── AnamnesisMemory (Claude Memory — факты, семантика, нарратив) ─────────────
app.use('/api/claude-memory', createClaudeMemoryRoutes())

// ── Multi-Agent Orchestrator ─────────────────────────────────────────────────
const fundOrchestrator = createFundOrchestrator({ port: parseInt(process.env.FST_API_PORT || '8082') })

app.post('/api/agents/chat', async (req, res) => {
  const { message, conversationId } = req.body
  if (!message) return res.status(400).json({ error: 'message required' })

  try {
    const result = await fundOrchestrator.execute(message)
    res.json({
      response: result.answer,
      agents: result.agents,
      steps: result.steps?.length || 0,
      executionTime: result.executionTime,
      success: result.success,
    })
  } catch (error) {
    console.error('[Agents] chat error:', error.message)
    res.status(500).json({ error: error.message })
  }
})

app.get('/api/agents/list', (req, res) => {
  res.json({ agents: fundOrchestrator.getAgents() })
})

// ── KAG Memory (Knowledge Graph) ─────────────────────────────────────────────
app.use('/api/mcp/kag-fst', createKAGFstMCPRoutes())
// Legacy aliases
app.post('/api/kag/search', async (req, res) => {
  try {
    const kagResp = await fetch(`http://localhost:${PORT}/api/mcp/kag-fst/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ toolName: 'kag_search', arguments: { query: req.body.query, limit: req.body.limit || 10 } })
    })
    const data = await kagResp.json()
    const parsed = data.result?.content?.[0]?.text ? JSON.parse(data.result.content[0].text) : { results: [] }
    res.json(parsed)
  } catch (err) { res.json({ results: [], total: 0, error: err.message }) }
})
app.post('/api/kag/web-search', (req, res) => res.json({ results: [], total: 0 }))

const PORT = parseInt(process.env.FST_API_PORT || '8082')
server.listen(PORT, () => {
  console.log(`[FST API] Listening on port ${PORT}`)
  // Загружаем конфиг из Integram в фоне (с fallback на дефолты)
  refreshConfig().catch(err => console.warn('[FstConfig] Initial load failed:', err.message))
})
