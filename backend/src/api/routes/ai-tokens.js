/**
 * AI Tokens Chat Route
 * POST /api/ai-tokens/chat
 *
 * Единый gateway для всех AI-вызовов платформы.
 * Роутит по modelId к нужному провайдеру.
 *
 * Body: { modelId, prompt, systemPrompt?, application? }
 * Response: { response, model, tokens? }
 */

import { Router } from 'express'

const router = Router()

// ── Конфиг провайдеров ────────────────────────────────────────────────────────

const PROVIDERS = {
  anthropic: {
    key:     () => process.env.ANTHROPIC_API_KEY,
    url:     'https://api.anthropic.com/v1/messages',
    models:  ['claude', 'anthropic/'],
  },
  deepseek: {
    key:     () => process.env.DEEPSEEK_API_KEY,
    url:     'https://api.deepseek.com/v1/chat/completions',
    models:  ['deepseek'],
  },
  openai: {
    key:     () => process.env.OPENAI_API_KEY,
    url:     'https://api.openai.com/v1/chat/completions',
    models:  ['gpt-', 'openai/'],
  },
  yandex: {
    key:     () => process.env.YANDEX_API_KEY,
    url:     'https://llm.api.cloud.yandex.net/foundationModels/v1/completion',
    models:  ['yandex'],
  },
  polza: {
    key:     () => process.env.POLZA_API_KEY,
    url:     'https://api.polza.ai/api/v1/chat/completions',
    models:  ['qwen', 'gemini', 'google/'],
  },
}

function detectProvider(modelId = '') {
  const m = modelId.toLowerCase()
  for (const [name, cfg] of Object.entries(PROVIDERS)) {
    if (cfg.models.some(prefix => m.includes(prefix))) return name
  }
  // fallback — DeepSeek (самый дешёвый)
  return 'deepseek'
}

// ── Вызов Anthropic ───────────────────────────────────────────────────────────

async function callAnthropic(modelId, prompt, systemPrompt) {
  const model = modelId.replace('anthropic/', '')
  const body = {
    model:      model || 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    messages:   [{ role: 'user', content: prompt }],
  }
  if (systemPrompt) body.system = systemPrompt

  const res = await fetch(PROVIDERS.anthropic.url, {
    method:  'POST',
    headers: {
      'Content-Type':      'application/json',
      'x-api-key':         PROVIDERS.anthropic.key(),
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Anthropic error ${res.status}: ${err}`)
  }

  const data = await res.json()
  return {
    response: data.content?.[0]?.text || '',
    model:    data.model,
    tokens:   data.usage,
  }
}

// ── Вызов OpenAI-совместимых (DeepSeek, OpenAI) ───────────────────────────────

async function callOpenAICompatible(provider, modelId, prompt, systemPrompt) {
  const cfg = PROVIDERS[provider]
  const messages = []
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt })
  messages.push({ role: 'user', content: prompt })

  const model = provider === 'deepseek'
    ? (modelId.replace('deepseek/', '') || 'deepseek-chat')
    : provider === 'polza'
      ? (modelId.replace(/^polza\//, '') || 'qwen/qwen-turbo')  // strip polza/ prefix
      : (modelId.replace('openai/', '') || 'gpt-4o')

  const res = await fetch(cfg.url, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${cfg.key()}`,
    },
    body: JSON.stringify({ model, messages, max_tokens: 4096 }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`${provider} error ${res.status}: ${err}`)
  }

  const data = await res.json()
  return {
    response: data.choices?.[0]?.message?.content || '',
    model:    data.model,
    tokens:   data.usage,
  }
}

// ── Вызов YandexGPT ───────────────────────────────────────────────────────────

async function callYandex(prompt, systemPrompt) {
  const folderId = process.env.YANDEX_FOLDER_ID
  const messages = []
  if (systemPrompt) messages.push({ role: 'system', text: systemPrompt })
  messages.push({ role: 'user', text: prompt })

  const res = await fetch(PROVIDERS.yandex.url, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Api-Key ${PROVIDERS.yandex.key()}`,
    },
    body: JSON.stringify({
      modelUri:           `gpt://${folderId}/yandexgpt/latest`,
      completionOptions:  { stream: false, temperature: 0.6, maxTokens: 4000 },
      messages,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Yandex error ${res.status}: ${err}`)
  }

  const data = await res.json()
  return {
    response: data.result?.alternatives?.[0]?.message?.text || '',
    model:    'yandexgpt',
  }
}

// ── Router ────────────────────────────────────────────────────────────────────

// GET /api/ai-tokens/default-token/:userId
// Returns default AI token config for a user (used by 6+ frontend modules)
router.get('/ai-tokens/default-token/:userId', (req, res) => {
  const defaultModel = 'deepseek/deepseek-chat'
  const hasKey = !!PROVIDERS.deepseek.key()

  if (!hasKey) {
    return res.status(503).json({
      error: 'No default AI provider configured',
      hint: 'Set DEEPSEEK_API_KEY in .env',
    })
  }

  res.json({
    data: {
      token: 'system-default',
      defaultModel,
      provider: 'deepseek',
      userId: req.params.userId,
    },
  })
})

router.post('/ai-tokens/chat', async (req, res) => {
  const { modelId, prompt, systemPrompt, application } = req.body

  if (!prompt) {
    return res.status(400).json({ error: 'prompt is required' })
  }

  const provider = detectProvider(modelId)
  const apiKey = PROVIDERS[provider]?.key()

  if (!apiKey) {
    return res.status(503).json({
      error: `API key not configured for provider: ${provider}`,
      hint:  `Set ${provider.toUpperCase()}_API_KEY in .env`,
    })
  }

  try {
    console.log(`[AI] ${application || 'unknown'} → ${provider} / ${modelId}`)

    let result
    if (provider === 'anthropic') {
      result = await callAnthropic(modelId, prompt, systemPrompt)
    } else if (provider === 'yandex') {
      result = await callYandex(prompt, systemPrompt)
    } else {
      result = await callOpenAICompatible(provider, modelId, prompt, systemPrompt)
    }

    res.json(result)
  } catch (err) {
    console.error(`[AI] Error (${provider}):`, err.message)
    res.status(502).json({ error: err.message, provider })
  }
})

// ── Streaming helpers ─────────────────────────────────────────────────────────

async function callAnthropicStream(modelId, prompt, systemPrompt, res) {
  const model = modelId.replace('anthropic/', '') || 'claude-sonnet-4-20250514'
  const body = {
    model,
    max_tokens: 4096,
    stream: true,
    messages: [{ role: 'user', content: prompt }],
  }
  if (systemPrompt) body.system = systemPrompt

  const upstream = await fetch(PROVIDERS.anthropic.url, {
    method:  'POST',
    headers: {
      'Content-Type':      'application/json',
      'x-api-key':         PROVIDERS.anthropic.key(),
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  })

  if (!upstream.ok) {
    const err = await upstream.text()
    res.write(`data: ${JSON.stringify({ error: `Anthropic ${upstream.status}: ${err}` })}\n\n`)
    res.end()
    return
  }

  for await (const chunk of upstream.body) {
    const lines = Buffer.from(chunk).toString('utf8').split('\n')
    for (const line of lines) {
      if (!line.startsWith('data:')) continue
      const raw = line.slice(5).trim()
      if (raw === '[DONE]') continue
      try {
        const ev = JSON.parse(raw)
        if (ev.type === 'content_block_delta' && ev.delta?.text) {
          res.write(`data: ${JSON.stringify({ chunk: ev.delta.text })}\n\n`)
        }
      } catch {}
    }
  }
  res.write('data: [DONE]\n\n')
  res.end()
}

async function callOpenAICompatibleStream(provider, modelId, prompt, systemPrompt, res) {
  const cfg = PROVIDERS[provider]
  const messages = []
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt })
  messages.push({ role: 'user', content: prompt })

  const model = provider === 'deepseek'
    ? (modelId.replace('deepseek/', '') || 'deepseek-chat')
    : provider === 'polza'
      ? (modelId.replace(/^polza\//, '') || 'qwen/qwen-turbo')  // strip polza/ prefix
      : (modelId.replace('openai/', '') || 'gpt-4o')

  const upstream = await fetch(cfg.url, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${cfg.key()}`,
    },
    body: JSON.stringify({ model, messages, max_tokens: 4096, stream: true }),
  })

  if (!upstream.ok) {
    const err = await upstream.text()
    res.write(`data: ${JSON.stringify({ error: `${provider} ${upstream.status}: ${err}` })}\n\n`)
    res.end()
    return
  }

  for await (const chunk of upstream.body) {
    const lines = Buffer.from(chunk).toString('utf8').split('\n')
    for (const line of lines) {
      if (!line.startsWith('data:')) continue
      const raw = line.slice(5).trim()
      if (raw === '[DONE]') continue
      try {
        const ev = JSON.parse(raw)
        const chunk = ev.choices?.[0]?.delta?.content
        if (chunk) res.write(`data: ${JSON.stringify({ chunk })}\n\n`)
      } catch {}
    }
  }
  res.write('data: [DONE]\n\n')
  res.end()
}

// ── /api/chat — алиас для useChatLogic (платформенный Chat) ─────────────────
// Принимает { message, model, provider, systemPrompt, conversationHistory, stream? }
// stream=true → SSE (text/event-stream), каждый chunk: data: {"token":"..."}
// stream=false/omit → JSON { success: true, response: string }
router.post('/chat', async (req, res) => {
  const {
    message, model, provider: providerHint,
    systemPrompt, conversationHistory = [],
    stream = false,
  } = req.body

  if (!message) {
    return res.status(400).json({ success: false, error: 'message is required' })
  }

  const modelId = model || 'deepseek/deepseek-chat'
  // if providerHint is unknown (e.g. "polza"), fall back to auto-detect
  const provider = (providerHint && PROVIDERS[providerHint]) ? providerHint : detectProvider(modelId)
  const apiKey = PROVIDERS[provider]?.key()

  if (!apiKey) {
    return res.status(503).json({
      success: false,
      error: `API key not configured for provider: ${provider}`,
    })
  }

  // Для истории диалога добавляем её в prompt (простой конкатенат)
  let prompt = message
  if (conversationHistory.length > 0) {
    const historyText = conversationHistory
      .slice(-8)
      .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
      .join('\n')
    prompt = `${historyText}\nUser: ${message}`
  }

  console.log(`[AI /chat] ${provider} / ${modelId} stream=${stream}`)

  // ── Streaming mode ────────────────────────────────────────────────────────
  if (stream) {
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.flushHeaders()
    try {
      if (provider === 'anthropic') {
        await callAnthropicStream(modelId, prompt, systemPrompt, res)
      } else if (provider === 'yandex') {
        // Yandex не поддерживает streaming — отдаём одним куском
        const result = await callYandex(prompt, systemPrompt)
        res.write(`data: ${JSON.stringify({ token: result.response })}\n\n`)
        res.write('data: [DONE]\n\n')
        res.end()
      } else {
        await callOpenAICompatibleStream(provider, modelId, prompt, systemPrompt, res)
      }
    } catch (err) {
      console.error(`[AI /chat stream] Error (${provider}):`, err.message)
      res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`)
      res.end()
    }
    return
  }

  // ── Non-streaming mode ────────────────────────────────────────────────────
  try {
    let result
    if (provider === 'anthropic') {
      result = await callAnthropic(modelId, prompt, systemPrompt)
    } else if (provider === 'yandex') {
      result = await callYandex(prompt, systemPrompt)
    } else {
      result = await callOpenAICompatible(provider, modelId, prompt, systemPrompt)
    }

    res.json({ success: true, response: result.response, model: result.model })
  } catch (err) {
    console.error(`[AI /chat] Error (${provider}):`, err.message)
    res.status(502).json({ success: false, error: err.message })
  }
})

// Health check для AI провайдеров
router.get('/ai-tokens/providers', (req, res) => {
  const status = {}
  for (const [name, cfg] of Object.entries(PROVIDERS)) {
    status[name] = !!cfg.key()
  }
  res.json(status)
})

export default router
