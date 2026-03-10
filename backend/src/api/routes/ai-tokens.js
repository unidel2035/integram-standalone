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

// ── /api/chat — алиас для useChatLogic (платформенный Chat) ─────────────────
// Принимает { message, model, provider, systemPrompt, conversationHistory }
// Возвращает { success: true, response: string }
router.post('/chat', async (req, res) => {
  const {
    message, model, provider: providerHint,
    systemPrompt, conversationHistory = []
  } = req.body

  if (!message) {
    return res.status(400).json({ success: false, error: 'message is required' })
  }

  // Формируем modelId: если есть model — используем, иначе deepseek
  const modelId = model || 'deepseek/deepseek-chat'
  const provider = providerHint || detectProvider(modelId)
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
      .slice(-8) // последние 8 сообщений для контекста
      .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
      .join('\n')
    prompt = `${historyText}\nUser: ${message}`
  }

  try {
    console.log(`[AI /chat] ${provider} / ${modelId}`)

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
