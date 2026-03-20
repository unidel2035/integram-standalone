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
import { INTEGRAM_TOOLS, executeTool as executeIntegraTool } from '../../services/integram-v2-tools.js'

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

// ── Anthropic tool-calling loop ───────────────────────────────────────────────

async function callAnthropicWithTools(modelId, messages, systemPrompt, res) {
  const model = modelId.replace('anthropic/', '') || 'claude-sonnet-4-20250514'
  const MAX_ITERATIONS = 8

  // Clone messages for the conversation loop
  const conversationMessages = [...messages]

  for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
    const body = {
      model,
      max_tokens: 4096,
      messages: conversationMessages,
      tools: INTEGRAM_TOOLS,
    }
    if (systemPrompt) body.system = systemPrompt

    const upstream = await fetch(PROVIDERS.anthropic.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': PROVIDERS.anthropic.key(),
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    })

    if (!upstream.ok) {
      const err = await upstream.text()
      throw new Error(`Anthropic ${upstream.status}: ${err}`)
    }

    const data = await upstream.json()

    // Extract text and tool_use blocks from response
    let textContent = ''
    const toolUseBlocks = []

    for (const block of (data.content || [])) {
      if (block.type === 'text') {
        textContent += block.text
      } else if (block.type === 'tool_use') {
        toolUseBlocks.push(block)
      }
    }

    // Stream any text content
    if (textContent) {
      res.write(`data: ${JSON.stringify({ type: 'content', content: textContent })}\n\n`)
    }

    // If no tool calls — we're done
    if (data.stop_reason !== 'tool_use' || toolUseBlocks.length === 0) {
      break
    }

    // Execute tool calls and stream progress
    const toolResults = []
    for (const toolBlock of toolUseBlocks) {
      // Notify frontend: tool call starting
      res.write(`data: ${JSON.stringify({
        type: 'agent:action:start',
        tool: toolBlock.name,
        input: toolBlock.input,
      })}\n\n`)

      let result
      try {
        result = await executeIntegraTool(toolBlock.name, toolBlock.input)
      } catch (err) {
        result = { error: err.message }
      }

      // Truncate large results to avoid context overflow
      let resultStr = JSON.stringify(result)
      if (resultStr.length > 15000) {
        // Keep first 15000 chars and add truncation notice
        resultStr = resultStr.slice(0, 15000) + '... [truncated]'
      }

      // Notify frontend: tool call completed
      res.write(`data: ${JSON.stringify({
        type: 'agent:action:end',
        tool: toolBlock.name,
        result: resultStr,
      })}\n\n`)

      toolResults.push({
        type: 'tool_result',
        tool_use_id: toolBlock.id,
        content: resultStr,
      })
    }

    // Add assistant response + tool results to conversation for next iteration
    conversationMessages.push({ role: 'assistant', content: data.content })
    conversationMessages.push({ role: 'user', content: toolResults })
  }

  res.write('data: [DONE]\n\n')
  res.end()
}

// ── OpenAI-compatible tool-calling loop (DeepSeek, OpenAI, Polza) ─────────────

// Convert Anthropic tool format → OpenAI function-calling format
const OPENAI_TOOLS = INTEGRAM_TOOLS.map(t => ({
  type: 'function',
  function: {
    name: t.name,
    description: t.description,
    parameters: t.input_schema,
  }
}))

async function callOpenAICompatibleWithTools(provider, modelId, messages, systemPrompt, res) {
  const cfg = PROVIDERS[provider]
  const model = provider === 'deepseek'
    ? (modelId.replace('deepseek/', '') || 'deepseek-chat')
    : provider === 'polza'
      ? (modelId.replace(/^polza\//, '') || 'qwen/qwen-turbo')
      : (modelId.replace('openai/', '') || 'gpt-4o')

  const MAX_ITERATIONS = 8

  // Build conversation with system prompt
  const conversationMessages = []
  if (systemPrompt) conversationMessages.push({ role: 'system', content: systemPrompt })
  conversationMessages.push(...messages)

  for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
    const body = {
      model,
      messages: conversationMessages,
      tools: OPENAI_TOOLS,
      max_tokens: 4096,
    }

    const upstream = await fetch(cfg.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${cfg.key()}`,
      },
      body: JSON.stringify(body),
    })

    if (!upstream.ok) {
      const err = await upstream.text()
      throw new Error(`${provider} ${upstream.status}: ${err}`)
    }

    const data = await upstream.json()
    const choice = data.choices?.[0]
    const msg = choice?.message

    if (!msg) break

    // Stream text content
    if (msg.content) {
      res.write(`data: ${JSON.stringify({ type: 'content', content: msg.content })}\n\n`)
    }

    // No tool calls — done
    if (choice.finish_reason !== 'tool_calls' || !msg.tool_calls?.length) {
      break
    }

    // Add assistant message with tool calls to conversation
    conversationMessages.push(msg)

    // Execute each tool call
    for (const tc of msg.tool_calls) {
      const toolName = tc.function.name
      let toolArgs
      try {
        toolArgs = JSON.parse(tc.function.arguments)
      } catch {
        toolArgs = {}
      }

      // Notify frontend: tool call starting
      res.write(`data: ${JSON.stringify({
        type: 'agent:action:start',
        tool: toolName,
        input: toolArgs,
      })}\n\n`)

      let result
      try {
        result = await executeIntegraTool(toolName, toolArgs)
      } catch (err) {
        result = { error: err.message }
      }

      let resultStr = JSON.stringify(result)
      if (resultStr.length > 15000) {
        resultStr = resultStr.slice(0, 15000) + '... [truncated]'
      }

      // Notify frontend: tool call completed
      res.write(`data: ${JSON.stringify({
        type: 'agent:action:end',
        tool: toolName,
        result: resultStr,
      })}\n\n`)

      // Add tool result to conversation
      conversationMessages.push({
        role: 'tool',
        tool_call_id: tc.id,
        content: resultStr,
      })
    }
  }

  res.write('data: [DONE]\n\n')
  res.end()
}

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

// ── /api/chat — платформенный Chat с поддержкой tool calling ────────────────
// Принимает { message, model, provider, systemPrompt, conversationHistory, stream?,
//             enableToolCalling?, toolCallingConfig? }
// stream=true → SSE (text/event-stream)
// stream=false/omit → JSON { success: true, response: string }
router.post('/chat', async (req, res) => {
  const {
    message, model, provider: providerHint,
    systemPrompt, conversationHistory = [],
    stream = false,
    enableToolCalling = false,
    toolCallingConfig = null,
  } = req.body

  if (!message) {
    return res.status(400).json({ success: false, error: 'message is required' })
  }

  const modelId = model || 'deepseek/deepseek-chat'
  const provider = (providerHint && PROVIDERS[providerHint]) ? providerHint : detectProvider(modelId)
  const apiKey = PROVIDERS[provider]?.key()

  if (!apiKey) {
    return res.status(503).json({
      success: false,
      error: `API key not configured for provider: ${provider}`,
    })
  }

  // enableTools: true приходит всегда из фронтенда.
  // Автоматически включаем integram tools для Anthropic/DeepSeek если enableTools: true
  const enableTools = req.body.enableTools || false
  const toolCapableProvider = provider === 'anthropic' || provider === 'deepseek' || provider === 'openai' || provider === 'polza'
  const useTools = toolCapableProvider && (
    (enableToolCalling && toolCallingConfig?.enableIntegramTools) || enableTools
  )

  console.log(`[AI /chat] ${provider} / ${modelId} stream=${stream} tools=${useTools}`)

  // ── Build messages array for Anthropic (proper format) ─────────────────
  const messages = []
  if (conversationHistory.length > 0) {
    for (const m of conversationHistory.slice(-8)) {
      messages.push({ role: m.role, content: m.content })
    }
  }
  messages.push({ role: 'user', content: message })

  // Legacy prompt for non-Anthropic providers
  let prompt = message
  if (conversationHistory.length > 0) {
    const historyText = conversationHistory
      .slice(-8)
      .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
      .join('\n')
    prompt = `${historyText}\nUser: ${message}`
  }

  // ── Tool-calling mode (Anthropic only, always streaming) ───────────────
  if (useTools) {
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.flushHeaders()

    try {
      if (provider === 'anthropic') {
        await callAnthropicWithTools(modelId, messages, systemPrompt, res)
      } else {
        await callOpenAICompatibleWithTools(provider, modelId, messages, systemPrompt, res)
      }
    } catch (err) {
      console.error(`[AI /chat tools] Error:`, err.message)
      res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`)
      res.end()
    }
    return
  }

  // ── Streaming mode (no tools) ─────────────────────────────────────────
  if (stream) {
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.flushHeaders()
    try {
      if (provider === 'anthropic') {
        await callAnthropicStream(modelId, prompt, systemPrompt, res)
      } else if (provider === 'yandex') {
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

// ── POST /api/chat/upload — загрузка файла, извлечение текста ─────────────────
// Body: { base64Data, filename, mimeType }
// Response: { text, filename, size, integramUrl? }
router.post('/chat/upload', async (req, res) => {
  const { base64Data, filename, mimeType } = req.body
  if (!base64Data) return res.status(400).json({ error: 'base64Data is required' })

  const { writeFileSync, mkdirSync, existsSync, unlinkSync } = await import('fs')
  const { join } = await import('path')
  const { fileURLToPath } = await import('url')
  const { dirname } = await import('path')

  const tmpDir = join(dirname(fileURLToPath(import.meta.url)), '../../../.tmp-uploads')
  if (!existsSync(tmpDir)) mkdirSync(tmpDir, { recursive: true })

  const ext = (filename || 'file').split('.').pop().toLowerCase()
  const tmpPath = join(tmpDir, `upload_${Date.now()}.${ext}`)

  try {
    // Save file from base64
    const buffer = Buffer.from(base64Data, 'base64')
    writeFileSync(tmpPath, buffer)
    console.log(`[chat/upload] Saved ${filename} (${buffer.length} bytes) to ${tmpPath}`)

    let extractedText = ''

    if (ext === 'pptx' || ext === 'ppt') {
      // Extract text from PPTX
      try {
        const { default: unzipper } = await import('unzipper')
        const zip = await unzipper.Open.file(tmpPath)
        const slideFiles = zip.files
          .filter(f => f.path.match(/ppt\/slides\/slide\d+\.xml$/))
          .sort((a, b) => {
            const na = Number(a.path.match(/slide(\d+)/)[1])
            const nb = Number(b.path.match(/slide(\d+)/)[1])
            return na - nb
          })
        for (const entry of slideFiles) {
          const content = await entry.buffer()
          const xml = content.toString('utf8')
          const matches = xml.match(/<a:t>([^<]+)<\/a:t>/g) || []
          const slideNum = Number(entry.path.match(/slide(\d+)/)[1])
          const slideText = matches.map(m => m.replace(/<[^>]+>/g, '')).join(' ')
          extractedText += `[Слайд ${slideNum}] ${slideText}\n\n`
        }
      } catch (e) {
        console.error('[chat/upload] PPTX parse error:', e.message)
      }
    } else if (ext === 'pdf') {
      // Extract text from PDF
      try {
        const { createRequire } = await import('module')
        const require = createRequire(import.meta.url)
        const { PDFParse } = require('pdf-parse')
        const parser = new PDFParse({ data: new Uint8Array(buffer) })
        await parser.load()
        const numPages = parser.doc?.numPages || 0
        const parts = []
        for (let i = 1; i <= numPages; i++) {
          try { const t = await parser.getPageText(i); if (t) parts.push(t) } catch {}
        }
        extractedText = parts.join('\n')
      } catch (e) {
        console.error('[chat/upload] PDF parse error:', e.message)
      }
    } else if (ext === 'xlsx' || ext === 'xls') {
      // Extract text from Excel
      try {
        const XLSX = await import('xlsx')
        const workbook = XLSX.read(buffer, { type: 'buffer' })
        const parts = []
        for (const sheetName of workbook.SheetNames) {
          const sheet = workbook.Sheets[sheetName]
          const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })
          if (rows.length === 0) continue
          parts.push(`=== Лист: ${sheetName} ===`)
          for (const row of rows) {
            if (row.every(c => c === '' || c === null)) continue
            parts.push(row.join(' | '))
          }
          parts.push('')
        }
        extractedText = parts.join('\n')
      } catch (e) {
        console.error('[chat/upload] Excel parse error:', e.message)
      }
    } else if (ext === 'docx') {
      // Extract text from DOCX
      try {
        const mammoth = await import('mammoth')
        const result = await mammoth.extractRawText({ buffer })
        extractedText = result.value || ''
      } catch (e) {
        console.error('[chat/upload] DOCX parse error:', e.message)
      }
    } else if (['txt', 'md', 'csv', 'json', 'xml', 'html'].includes(ext)) {
      extractedText = buffer.toString('utf8')
    }

    // Cleanup temp file
    try { unlinkSync(tmpPath) } catch (_) {}

    res.json({
      success: true,
      filename,
      size: buffer.length,
      text: extractedText.slice(0, 50000), // limit to 50k chars
      textLength: extractedText.length
    })
  } catch (err) {
    console.error('[chat/upload] Error:', err)
    try { unlinkSync(tmpPath) } catch (_) {}
    res.status(500).json({ error: err.message })
  }
})

// ── POST /api/chat/parse-file — парсинг PPTX/PDF → компании и метрики в Integram ──
router.post('/chat/parse-file', async (req, res) => {
  const { base64Data, filename } = req.body
  if (!base64Data) return res.status(400).json({ error: 'base64Data is required' })

  const { writeFileSync, mkdirSync, existsSync, unlinkSync } = await import('fs')
  const { join, dirname } = await import('path')
  const { fileURLToPath } = await import('url')
  const { spawn } = await import('child_process')

  const __dir = dirname(fileURLToPath(import.meta.url))
  const tmpDir = join(__dir, '../../../.tmp-uploads')
  if (!existsSync(tmpDir)) mkdirSync(tmpDir, { recursive: true })

  const tmpPath = join(tmpDir, `parse_${Date.now()}_${filename || 'file.pptx'}`)

  try {
    writeFileSync(tmpPath, Buffer.from(base64Data, 'base64'))
    console.log(`[chat/parse-file] Saved ${filename} to ${tmpPath}`)

    // Run universal parser (handles PPTX, PDF, XLSX, CSV, DOCX, TXT)
    const scriptPath = join(__dir, '../../../parse-universal.mjs')
    const child = spawn('node', [scriptPath, '--file', tmpPath], {
      cwd: join(__dir, '../../..'),
      env: { ...process.env },
      timeout: 300000
    })

    let stdout = '', stderr = ''
    child.stdout.on('data', d => { stdout += d.toString() })
    child.stderr.on('data', d => { stderr += d.toString() })

    child.on('close', (code) => {
      try { unlinkSync(tmpPath) } catch {}
      if (code === 0) {
        const created = stdout.match(/Created: (\d+)/)?.[1] || '0'
        const updated = stdout.match(/Updated: (\d+)/)?.[1] || '0'
        const metrics = stdout.match(/Metrics: (\d+)/)?.[1] || '0'
        const companies = stdout.match(/Companies: (.+)/)?.[1] || ''
        res.json({ success: true, created: Number(created), updated: Number(updated), metrics: Number(metrics), companies })
      } else {
        res.json({ success: false, error: (stderr || stdout).slice(-500) })
      }
    })

    child.on('error', (err) => {
      try { unlinkSync(tmpPath) } catch {}
      res.json({ success: false, error: err.message })
    })
  } catch (err) {
    try { unlinkSync(tmpPath) } catch {}
    res.status(500).json({ error: err.message })
  }
})

// ── POST /api/chat/parse-preview — превью: AI извлекает компании, но НЕ сохраняет ──
router.post('/chat/parse-preview', async (req, res) => {
  const { base64Data, filename } = req.body
  if (!base64Data) return res.status(400).json({ error: 'base64Data is required' })

  const { writeFileSync, mkdirSync, existsSync, unlinkSync } = await import('fs')
  const { join, dirname } = await import('path')
  const { fileURLToPath } = await import('url')
  const { spawn } = await import('child_process')

  const __dir = dirname(fileURLToPath(import.meta.url))
  const tmpDir = join(__dir, '../../../.tmp-uploads')
  if (!existsSync(tmpDir)) mkdirSync(tmpDir, { recursive: true })

  const tmpPath = join(tmpDir, `preview_${Date.now()}_${filename || 'file'}`)

  try {
    writeFileSync(tmpPath, Buffer.from(base64Data, 'base64'))

    // Run parser in dry-run + JSON mode (no writes to Integram)
    const scriptPath = join(__dir, '../../../parse-universal.mjs')
    const child = spawn('node', [scriptPath, '--file', tmpPath, '--dry-run', '--json'], {
      cwd: join(__dir, '../../..'),
      env: { ...process.env },
      timeout: 300000
    })

    let stdout = '', stderr = ''
    child.stdout.on('data', d => { stdout += d.toString() })
    child.stderr.on('data', d => { stderr += d.toString() })

    child.on('close', (code) => {
      try { unlinkSync(tmpPath) } catch {}
      try {
        // Extract last JSON line from stdout (dotenv/logs may prepend text)
        const lines = stdout.trim().split('\n')
        let jsonStr = null
        for (let i = lines.length - 1; i >= 0; i--) {
          const line = lines[i].trim()
          if (line.startsWith('{')) { jsonStr = line; break }
        }
        if (!jsonStr) throw new Error('No JSON in output')
        const result = JSON.parse(jsonStr)
        res.json({ success: true, ...result })
      } catch (e) {
        res.json({ success: false, error: (stderr || stdout || 'Parse failed').slice(-500) })
      }
    })

    child.on('error', (err) => {
      try { unlinkSync(tmpPath) } catch {}
      res.json({ success: false, error: err.message })
    })
  } catch (err) {
    try { unlinkSync(tmpPath) } catch {}
    res.status(500).json({ error: err.message })
  }
})

// ── POST /api/chat/parse-confirm — сохранить уже распарсенные компании в Integram ──
router.post('/chat/parse-confirm', async (req, res) => {
  const { companies, filename } = req.body
  if (!companies?.length) return res.status(400).json({ error: 'companies array is required' })

  const { writeFileSync, mkdirSync, existsSync, unlinkSync } = await import('fs')
  const { join, dirname } = await import('path')
  const { fileURLToPath } = await import('url')
  const { spawn } = await import('child_process')

  const __dir = dirname(fileURLToPath(import.meta.url))
  const tmpDir = join(__dir, '../../../.tmp-uploads')
  if (!existsSync(tmpDir)) mkdirSync(tmpDir, { recursive: true })

  // Save companies JSON to tmp file
  const tmpData = join(tmpDir, `confirm_${Date.now()}.json`)
  const tmpFile = join(tmpDir, `dummy_${Date.now()}.txt`)

  try {
    writeFileSync(tmpData, JSON.stringify(companies))
    writeFileSync(tmpFile, 'confirm')

    // Run parser with --data (skip AI, just save to Integram)
    const scriptPath = join(__dir, '../../../parse-universal.mjs')
    const child = spawn('node', [scriptPath, '--file', tmpFile, '--data', tmpData], {
      cwd: join(__dir, '../../..'),
      env: { ...process.env },
      timeout: 300000
    })

    let stdout = '', stderr = ''
    child.stdout.on('data', d => { stdout += d.toString() })
    child.stderr.on('data', d => { stderr += d.toString() })

    child.on('close', (code) => {
      try { unlinkSync(tmpData) } catch {}
      try { unlinkSync(tmpFile) } catch {}
      if (code === 0) {
        const created = stdout.match(/Created: (\d+)/)?.[1] || '0'
        const updated = stdout.match(/Updated: (\d+)/)?.[1] || '0'
        const metrics = stdout.match(/Metrics: (\d+)/)?.[1] || '0'
        const names = stdout.match(/Companies: (.+)/)?.[1] || ''
        res.json({ success: true, created: Number(created), updated: Number(updated), metrics: Number(metrics), companies: names })
      } else {
        res.json({ success: false, error: (stderr || stdout).slice(-500) })
      }
    })

    child.on('error', (err) => {
      try { unlinkSync(tmpData) } catch {}
      try { unlinkSync(tmpFile) } catch {}
      res.json({ success: false, error: err.message })
    })
  } catch (err) {
    try { unlinkSync(tmpData) } catch {}
    try { unlinkSync(tmpFile) } catch {}
    res.status(500).json({ error: err.message })
  }
})

// ── POST /api/chat/save-to-integram — сохранить файл в Integram Документы (type 1069) ──
router.post('/chat/save-to-integram', async (req, res) => {
  const { base64Data, filename } = req.body
  if (!base64Data) return res.status(400).json({ error: 'base64Data is required' })

  const { writeFileSync, mkdirSync, existsSync, unlinkSync } = await import('fs')
  const { join, dirname } = await import('path')
  const { fileURLToPath } = await import('url')

  try {
    const INTEGRAM_URL = process.env.INTEGRAM_SERVER_URL || 'https://ai2o.ru'
    const DB = 'fst'

    // Auth
    const authRes = await fetch(`${INTEGRAM_URL}/${DB}/auth?JSON_KV`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        login: process.env.INTEGRAM_SYSTEM_USERNAME,
        pwd: process.env.INTEGRAM_SYSTEM_PASSWORD
      })
    })
    const authData = await authRes.json()
    if (!authData.token) throw new Error('Integram auth failed')

    const xsrfRes = await fetch(`${INTEGRAM_URL}/${DB}/xsrf?JSON_KV`, {
      headers: { 'X-Authorization': authData.token }
    })
    const xd = await xsrfRes.json()
    const xsrf = xd._xsrf || ''

    // Create object in type 1069 (Документы)
    const createParams = new URLSearchParams({
      _xsrf: xsrf,
      t1069: filename || 'file',
      t1236: `Загружено из чата ${new Date().toLocaleDateString('ru-RU')}`,
      up: '1',
    })
    const createRes = await fetch(`${INTEGRAM_URL}/${DB}/_m_new/1069?full=1&JSON_KV`, {
      method: 'POST',
      headers: {
        'X-Authorization': authData.token,
        Cookie: `${DB}=${authData.token}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: createParams,
    })
    const createData = await createRes.json()
    const objId = createData.id || createData.obj
    if (!objId) throw new Error('Failed to create document object')

    // Upload file via multipart _m_save
    const buffer = Buffer.from(base64Data, 'base64')
    const boundary = '----ChatBoundary' + Date.now()
    const parts = []
    parts.push(`--${boundary}\r\nContent-Disposition: form-data; name="_xsrf"\r\n\r\n${xsrf}`)
    parts.push(`--${boundary}\r\nContent-Disposition: form-data; name="t1234"; filename="${filename}"\r\nContent-Type: application/octet-stream\r\n\r\n`)
    const header = Buffer.from(parts.join('\r\n') + '\r\n')
    const footer = Buffer.from(`\r\n--${boundary}--\r\n`)
    const body = Buffer.concat([header, buffer, footer])

    await fetch(`${INTEGRAM_URL}/${DB}/_m_save/${objId}?JSON_KV`, {
      method: 'POST',
      headers: {
        'X-Authorization': authData.token,
        Cookie: `${DB}=${authData.token}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
      },
      body,
    })

    res.json({ success: true, objectId: objId })
  } catch (err) {
    console.error('[chat/save-to-integram] Error:', err)
    res.status(500).json({ success: false, error: err.message })
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
