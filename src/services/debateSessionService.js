/**
 * debateSessionService.js — Client for backend debate session API
 * Issue #7240: Connects fund frontend to dronedoc2025 debate endpoints
 *
 * REST: /api/debate/sessions (CRUD)
 * WebSocket: Socket.IO namespace /debate (real-time events)
 */

const API_BASE = '/api/debate'

async function fetchJSON(url, opts = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...opts.headers },
    ...opts,
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Debate API ${res.status}: ${body}`)
  }
  return res.json()
}

/** Create a new debate session on the server */
export async function createDebateSession(project, agents, config = {}) {
  return fetchJSON(`${API_BASE}/sessions`, {
    method: 'POST',
    body: JSON.stringify({ project, agents, config }),
  })
}

/** Get session state (full or incremental via since param) */
export async function getDebateSession(sessionId, since = 0) {
  const qs = since > 0 ? `?since=${since}` : ''
  return fetchJSON(`${API_BASE}/sessions/${sessionId}${qs}`)
}

/** List all active sessions */
export async function listDebateSessions() {
  return fetchJSON(`${API_BASE}/sessions`)
}

/** Publish a message to a debate session */
export async function publishToDebate(sessionId, agentId, payload) {
  return fetchJSON(`${API_BASE}/sessions/${sessionId}/publish`, {
    method: 'POST',
    body: JSON.stringify({ agentId, ...payload }),
  })
}

/** Cast a vote in a debate session */
export async function castDebateVote(sessionId, agentId, vote) {
  return fetchJSON(`${API_BASE}/sessions/${sessionId}/vote`, {
    method: 'POST',
    body: JSON.stringify({ agentId, ...vote }),
  })
}

/** Change debate phase */
export async function setDebatePhase(sessionId, phase) {
  return fetchJSON(`${API_BASE}/sessions/${sessionId}/phase`, {
    method: 'PATCH',
    body: JSON.stringify({ phase }),
  })
}

/** Conclude a debate session */
export async function concludeDebateSession(sessionId) {
  return fetchJSON(`${API_BASE}/sessions/${sessionId}`, {
    method: 'DELETE',
  })
}


/** Start server-side orchestrated debate */
export async function startOrchestratedDebate(sessionId) {
  return fetchJSON(`${API_BASE}/sessions/${sessionId}/start`, { method: 'POST' })
}

/** Stop server-side orchestrated debate */
export async function stopOrchestratedDebate(sessionId) {
  return fetchJSON(`${API_BASE}/sessions/${sessionId}/stop`, { method: 'POST' })
}

// -- Socket.IO integration --

let _socket = null

/**
 * Connect to debate Socket.IO namespace
 * @param {string} sessionId
 * @param {object} handlers - { onMessage, onPhaseChange, onVote, onEnd, onMissed, onJoined }
 * @param {number} lastSeq - last known sequence number (for reconnect)
 * @returns {{ disconnect: Function }}
 */
export function connectDebateSocket(sessionId, handlers = {}, lastSeq = 0) {
  import('socket.io-client').then(({ io }) => {
    if (_socket) _socket.disconnect()

    _socket = io('/debate', {
      path: '/socket.io',
      transports: ['polling'],
    })

    _socket.on('connect', () => {
      _socket.emit('debate:join', { sessionId, lastSeq })
    })

    _socket.on('debate:joined', (data) => handlers.onJoined?.(data))
    _socket.on('debate:message', (msg) => handlers.onMessage?.(msg))
    _socket.on('debate:phase-change', (data) => handlers.onPhaseChange?.(data))
    _socket.on('debate:vote', (vote) => handlers.onVote?.(vote))
    _socket.on('debate:end', (data) => handlers.onEnd?.(data))
    _socket.on('debate:missed', (data) => handlers.onMissed?.(data))
    _socket.on('debate:error', (data) => console.error('[DebateSocket] Error:', data.error))
    _socket.on('debate:agent-progress', (data) => handlers.onAgentProgress?.(data))
    _socket.on('debate:convergence', (data) => handlers.onConvergence?.(data))
  }).catch(() => {
    console.warn('[DebateSocket] socket.io-client not available, using REST polling only')
  })

  return {
    disconnect: () => {
      if (_socket) {
        _socket.emit('debate:leave')
        _socket.disconnect()
        _socket = null
      }
    },
  }
}
