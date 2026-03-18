#!/usr/bin/env node
/**
 * Claude Subscription Proxy — HTTP → Claude CLI bridge.
 * Runs as user `new` (has Claude Max subscription).
 * Listens on port 8085, proxies requests to `claude -p`.
 */

import { createServer } from 'http'
import { spawn } from 'child_process'

const PORT = 8085
const CLAUDE_BIN = '/home/new/.local/bin/claude'

const server = createServer(async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return }
  if (req.method !== 'POST') { res.writeHead(405); res.end('Method Not Allowed'); return }

  // Read body
  let body = ''
  for await (const chunk of req) body += chunk
  let data
  try { data = JSON.parse(body) } catch { res.writeHead(400); res.end('Bad JSON'); return }

  const { message, systemPrompt, conversationHistory, history, model: requestModel } = data
  const chatHistory = conversationHistory || history || []
  if (!message) { res.writeHead(400); res.end('message is required'); return }

  // SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  })

  // Build prompt with history
  let fullPrompt = message
  if (chatHistory.length > 0) {
    const historyText = chatHistory.slice(-8)
      .map(m => `${m.role === 'user' ? 'Пользователь' : 'Ассистент'}: ${m.content}`)
      .join('\n\n')
    fullPrompt = `${historyText}\n\nПользователь: ${message}`
  }

  const args = [
    '-p', fullPrompt,
    '--output-format', 'stream-json', '--verbose',
    '--model', requestModel || 'opus',
    '--mcp-config', '/home/hive/fund/backend/claude-chat-mcp.json',
    '--strict-mcp-config',
    '--dangerously-skip-permissions',
  ]
  if (systemPrompt) args.push('--system-prompt', systemPrompt)

  console.log(`[claude-sub] request: ${message.slice(0, 80)}...`)

  // Use script -q to allocate a pseudo-TTY — Claude CLI may buffer stdout without one
  const cmd = [CLAUDE_BIN, ...args].map(a => `'${a.replace(/'/g, "'\\''")}'`).join(' ')
  const claude = spawn('script', ['-qc', cmd, '/dev/null'], {
    cwd: '/tmp',
    env: { ...process.env, HOME: '/home/new', TERM: 'dumb' },
    timeout: 180000,
  })

  let closed = false
  const finish = () => {
    if (!closed) { closed = true; res.write('data: [DONE]\n\n'); res.end() }
  }

  claude.stdout.on('data', (chunk) => {
    const lines = chunk.toString().split('\n').filter(l => l.trim())
    for (const line of lines) {
      try {
        const ev = JSON.parse(line)

        if (ev.type === 'assistant') {
          for (const block of (ev.message?.content || [])) {
            if (block.type === 'text' && block.text) {
              res.write(`data: ${JSON.stringify({ type: 'content', content: block.text })}\n\n`)
            } else if (block.type === 'thinking' && block.thinking) {
              res.write(`data: ${JSON.stringify({ type: 'thinking', thinking: block.thinking })}\n\n`)
            } else if (block.type === 'tool_use') {
              res.write(`data: ${JSON.stringify({
                type: 'agent:action:start',
                tool: block.name,
                input: block.input,
              })}\n\n`)
            } else if (block.type === 'tool_result') {
              const resultStr = typeof block.content === 'string' ? block.content : JSON.stringify(block.content)
              res.write(`data: ${JSON.stringify({
                type: 'agent:action:end',
                tool: block.name || 'unknown',
                result: resultStr.length > 15000 ? resultStr.slice(0, 15000) + '...[truncated]' : resultStr,
              })}\n\n`)
            }
          }
        } else if (ev.type === 'result') {
          // Final — result text already sent via assistant messages
          if (ev.result && !ev.is_error) {
            // Check if we already sent this text
            // result.result is the final accumulated text
          }
        }
      } catch {
        // Not JSON line, skip
      }
    }
  })

  claude.stderr.on('data', (chunk) => {
    const msg = chunk.toString().trim()
    if (msg) console.error('[claude-sub stderr]', msg.slice(0, 300))
  })

  claude.on('close', (code) => {
    console.log(`[claude-sub] process exited with code ${code}`)
    finish()
  })

  claude.on('error', (err) => {
    console.error('[claude-sub] spawn error:', err.message)
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`)
    finish()
  })

  req.on('close', () => {
    if (!closed) { claude.kill('SIGTERM'); closed = true }
  })
})

server.listen(PORT, () => {
  console.log(`[claude-sub-proxy] Listening on port ${PORT}`)
})
