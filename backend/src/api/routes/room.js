/**
 * Agent Room — живая комната для агентов и сессий Claude
 *
 * Протокол: SSE (Server-Sent Events) для получения + POST для отправки
 * Не требует дополнительных пакетов.
 *
 * Эндпоинты:
 *   GET  /api/room/stream?room=boldsea&session=claude-1   — подписка SSE
 *   POST /api/room/send                                   — отправить сообщение
 *   GET  /api/room/messages?room=boldsea                  — последние 100 сообщений
 *   GET  /api/room/rooms                                  — список активных комнат
 */

import { Router } from 'express'

const router = Router()

// In-memory хранилище комнат
// room → { clients: Map<sessionId, res>, messages: Message[], created: Date }
const rooms = new Map()

function getOrCreateRoom(name) {
  if (!rooms.has(name)) {
    rooms.set(name, {
      name,
      clients: new Map(),
      messages: [],
      created: new Date().toISOString(),
    })
  }
  return rooms.get(name)
}

function broadcast(room, data, excludeSession = null) {
  const payload = `data: ${JSON.stringify(data)}\n\n`
  for (const [sid, res] of room.clients) {
    if (sid === excludeSession) continue
    try { res.write(payload) } catch { room.clients.delete(sid) }
  }
}

function addMessage(room, msg) {
  room.messages.push(msg)
  if (room.messages.length > 500) room.messages.shift()
}

// ─── SSE Stream ───────────────────────────────────────────────────────────────

router.get('/room/stream', (req, res) => {
  const roomName = req.query.room || 'default'
  const sessionId = req.query.session || `s_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
  const role = req.query.role || 'human'   // 'human' | 'claude' | 'agent'
  const name = req.query.name || sessionId

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
    'Access-Control-Allow-Origin': '*',
  })

  const room = getOrCreateRoom(roomName)
  room.clients.set(sessionId, res)

  // Отправить историю новому участнику
  res.write(`data: ${JSON.stringify({
    type: 'welcome',
    sessionId,
    room: roomName,
    history: room.messages.slice(-100),
    members: [...room.clients.keys()].map(sid => ({
      sessionId: sid,
      active: true,
    })),
  })}\n\n`)

  // Уведомить всех о новом участнике
  const joinMsg = {
    id: `join_${Date.now()}`,
    type: 'join',
    session: sessionId,
    name,
    role,
    room: roomName,
    ts: Date.now(),
    text: `${name} подключился к комнате`,
  }
  addMessage(room, joinMsg)
  broadcast(room, joinMsg, sessionId)

  // Heartbeat каждые 25 сек чтоб nginx не закрыл соединение
  const heartbeat = setInterval(() => {
    try { res.write(': ping\n\n') } catch { clearInterval(heartbeat) }
  }, 25_000)

  req.on('close', () => {
    clearInterval(heartbeat)
    room.clients.delete(sessionId)
    const leaveMsg = {
      id: `leave_${Date.now()}`,
      type: 'leave',
      session: sessionId,
      name,
      role,
      room: roomName,
      ts: Date.now(),
      text: `${name} отключился`,
    }
    addMessage(room, leaveMsg)
    broadcast(room, leaveMsg)
  })
})

// ─── Отправить сообщение ──────────────────────────────────────────────────────

router.post('/room/send', (req, res) => {
  const {
    room: roomName = 'default',
    session = 'anon',
    name = session,
    role = 'human',
    text = '',
    meta = {},           // произвольные данные агента: { model, context, tool_call, ... }
  } = req.body

  if (!text && !meta.type) {
    return res.status(400).json({ error: 'text is required' })
  }

  const room = getOrCreateRoom(roomName)
  const msg = {
    id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    type: 'message',
    session,
    name,
    role,
    room: roomName,
    text,
    meta,
    ts: Date.now(),
  }

  addMessage(room, msg)
  broadcast(room, msg)

  res.json({ ok: true, id: msg.id, members: room.clients.size })
})

// ─── История сообщений ────────────────────────────────────────────────────────

router.get('/room/messages', (req, res) => {
  const roomName = req.query.room || 'default'
  const limit = Math.min(parseInt(req.query.limit) || 100, 500)
  const room = rooms.get(roomName)
  if (!room) return res.json({ messages: [], room: roomName, exists: false })
  res.json({
    room: roomName,
    messages: room.messages.slice(-limit),
    members: room.clients.size,
    created: room.created,
  })
})

// ─── Список комнат ────────────────────────────────────────────────────────────

router.get('/room/rooms', (req, res) => {
  const list = []
  for (const [name, room] of rooms) {
    list.push({
      name,
      members: room.clients.size,
      messages: room.messages.length,
      created: room.created,
      last: room.messages.at(-1)?.ts || null,
    })
  }
  res.json({ rooms: list })
})

export default router
