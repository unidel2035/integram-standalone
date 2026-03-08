/**
 * DebateRoom.js — Shared message bus for multi-agent investment committee
 *
 * Каждый агент публикует сообщения в общий зал. Остальные агенты
 * читают зал в начале каждой итерации своего loop.
 * Никаких WebSocket — in-memory pub/sub в одном JS-контексте.
 * (Будущее: заменить на Socket.io room для распределённых сессий)
 */

export class DebateRoom {
  constructor(onPublish = null) {
    this.messages   = []        // Все сообщения хронологически
    this.byAgent    = {}        // { agentId: Message[] }
    this.toolCalls  = []        // Лог всех tool_call событий
    this._onPublish = onPublish // callback → FstCommitteeEngine.emit
    this._counter   = 0
    this._phase     = null
  }

  setPhase(phase) {
    this._phase = phase
  }

  // ── Публикация аргумента ───────────────────────────────────────────────────

  publish(agentId, payload) {
    const msg = {
      id:      `room_${++this._counter}_${agentId}`,
      agentId,
      phase:   this._phase,
      ts:      Date.now(),
      text:    payload.text || '',
      type:    payload.type || 'ARGUMENT',
      dimension:  payload.dimension  || null,
      confidence: payload.confidence || 0.7,
      stance:     payload.stance     || null,
      targetArgId:payload.targetArgId|| null,
      toolsUsed:  payload.toolsUsed  || [],
    }
    this.messages.push(msg)
    if (!this.byAgent[agentId]) this.byAgent[agentId] = []
    this.byAgent[agentId].push(msg)

    if (this._onPublish) this._onPublish(msg)
    return msg
  }

  // ── Логирование tool calls (для графа событий) ────────────────────────────

  logToolCall(agentId, tool, args, result, durationMs) {
    const entry = { agentId, tool, args, result, durationMs, ts: Date.now(), phase: this._phase }
    this.toolCalls.push(entry)
    return entry
  }

  // ── Чтение ────────────────────────────────────────────────────────────────

  /** Последние N сообщений (опционально: только определённые agentIds) */
  readLatest(n = 8, excludeAgent = null) {
    const msgs = excludeAgent
      ? this.messages.filter(m => m.agentId !== excludeAgent)
      : this.messages
    return msgs.slice(-n)
  }

  /** Сообщения конкретного агента */
  getByAgent(agentId) {
    return this.byAgent[agentId] || []
  }

  /** Форматирование для LLM-контекста */
  format(n = 8, currentAgentId = null) {
    const msgs = this.readLatest(n, null)
    if (!msgs.length) return 'Зал дебатов пуст — ты первый.'
    return msgs.map(m => {
      const you = m.agentId === currentAgentId ? ' [ты уже сказал]' : ''
      const dim = m.dimension ? ` [${m.dimension}]` : ''
      return `[${m.agentId}${you}${dim}]: ${m.text}`
    }).join('\n\n')
  }

  /** Есть ли аргументы, которые не атакованы (для devil/counter-агентов) */
  getUnchallengedArgs(excludeAgent) {
    const challenged = new Set(
      this.messages.filter(m => m.targetArgId).map(m => m.targetArgId)
    )
    return this.messages.filter(m =>
      m.agentId !== excludeAgent && !challenged.has(m.id)
    )
  }

  get size() { return this.messages.length }
}
