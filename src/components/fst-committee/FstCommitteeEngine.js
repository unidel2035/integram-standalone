/**
 * FstCommitteeEngine — State machine for AI Investment Committee simulation
 *
 * Phases: IDLE → LOADING → PRIMARY_POSITIONS → CROSS_DEBATE
 *         → FINAL_POSITIONS → VOTING → SYNTHESIS → HUMAN_APPROVAL → CONCLUDED
 *
 * Emits events via onEvent(event) callback for UI rendering
 */

import {
  SCORING_DIMS, ARGUMENT_TEMPLATES,
  PHASES, PHASE_ORDER, VERDICTS, TIMING, SPEED_MULTIPLIERS,
  RECOMMENDATION_TEMPLATES, REVISION_SIMULATION_STEPS, METRIC_FIELD_MAP, METRIC_CLAMP,
} from './FstCommitteeConfig.js'
import { getAgents } from './agentProvider.js'
import { generateArgumentAI, fetchKagContext, clearKagCache, fetchOntologyContext, clearOntologyCache, generateNodeProposalAI, generateNodeVoteAI } from './fstCommitteeAI.js'
import { runAgentLoop, resetLoopTokenCache } from './AgentLoop.js'
import { SPEED_PROFILES } from './fstCommitteeModelOrchestrator.js'
import { DebateRoom } from './DebateRoom.js'
import { annotateArg, detectContradictions, assembleConditionalDecision, deriveConditionsFromContradictions } from './fstCommitteeOntology.js'
import {
  createDebateSession, setDebatePhase, publishToDebate,
  castDebateVote, concludeDebateSession, connectDebateSocket,
  startOrchestratedDebate, stopOrchestratedDebate,
} from '@/services/debateSessionService.js'
import {
  detectPortfolioOverlap,
  tagSessionWithConcepts,
  recordSessionDecision,
  linkArgumentToConcept,
  LINK_TYPES,
} from '@/services/fstLinksService.js'

// Концепты онтологии для ключевых измерений (dimension → concept)
const DIM_CONCEPTS = {
  trl:         { id: 1692106, name: 'Технологии БПЛА' },
  market:      { id: 1692153, name: 'Применение БПЛА' },
  sovereignty: { id: 1692207, name: 'Сертификация и лётная годность' },
  finance:     { id: 1692035, name: 'Объём рынка' },
  risk:        { id: 1692200, name: 'Регулирование БПЛА' },
}

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)] }
function rand(lo, hi) { return lo + Math.random() * (hi - lo) }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)) }

// ── Scoring Engine ────────────────────────────────────────────

function normalizeScore(value, min, max) {
  return clamp((value - min) / (max - min), 0, 1)
}

function computeDimScores(project) {
  return {
    trl:         normalizeScore(project.trl, 1, 9),
    mrl:         normalizeScore(project.mrl, 1, 10),
    sovereignty: normalizeScore(project.sovereigntyScore, 0, 9),
    market:      normalizeScore(Math.log10(project.marketSize / 1e8), 0, Math.log10(100)),
    finance:     normalizeScore(project.projectedIRR, 0.10, 0.60),
    risk:        1 - normalizeScore(project.trl < 5 ? 0.7 : project.sovereigntyScore < 5 ? 0.5 : 0.3, 0, 1),
    team:        project.teamStrength,
  }
}

function agentScore(agent, dimScores) {
  let total = 0
  for (const [dim, weight] of Object.entries(agent.scoringWeights)) {
    total += (dimScores[dim] || 0) * weight
  }
  // Apply bias
  const biasAdj = agent.bias === 'optimist' ? 0.05 : agent.bias === 'pessimist' ? -0.05 : 0
  return clamp(total + biasAdj + rand(-0.03, 0.03), 0, 1)
}

function aggregateScore(agentScores) {
  let weightedSum = 0
  let totalWeight = 0
  for (const { agent, score } of agentScores) {
    weightedSum += score * agent.weight
    totalWeight += agent.weight
  }
  return weightedSum / totalWeight
}

// Issue #161: thresholds from session.icParams (loaded from Integram)
function scoreToVerdict(score, icParams) {
  const approve = (icParams?.approveThreshold || 72) / 100
  const defer   = (icParams?.deferThreshold   || 50) / 100
  if (score >= approve) return 'APPROVE'
  if (score >= defer)   return 'DEFER'
  return 'REJECT'
}

// ── Recommendation Generator ──────────────────────────────────

function generateRecommendations(decision, project) {
  const verdict = decision.recommendation
  const key = verdict  // APPROVE | DEFER | REJECT
  const recs = []
  for (const agent of getAgents()) {
    const templates = RECOMMENDATION_TEMPLATES[agent.id]?.[key] || []
    for (const fn of templates) {
      try {
        const rec = fn(project)
        if (rec) recs.push({ ...rec, agentId: agent.id, agentAvatar: agent.avatar, agentColor: agent.color, accepted: true })
      } catch (_) {}
    }
  }
  // Sort: CRITICAL first, then HIGH, MEDIUM, LOW
  const order = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 }
  return recs.sort((a, b) => (order[a.priority] ?? 9) - (order[b.priority] ?? 9))
}

// ── Apply Revision to Project Copy ───────────────────────────

function applyRevision(project, recommendations) {
  const p = JSON.parse(JSON.stringify(project))
  // Accumulate deltas for accepted recs
  for (const rec of recommendations.filter(r => r.accepted)) {
    const field = METRIC_FIELD_MAP[rec.metric]
    if (!field || !rec.delta) continue
    p[field] = (p[field] || 0) + rec.delta
    // Clamp
    const clampRange = METRIC_CLAMP[field]
    if (clampRange) p[field] = Math.max(clampRange[0], Math.min(clampRange[1], p[field]))
  }
  // Round trl/mrl to integers
  if (p.trl) p.trl = Math.round(p.trl)
  if (p.mrl) p.mrl = Math.round(p.mrl)
  if (p.sovereigntyScore) p.sovereigntyScore = Math.round(p.sovereigntyScore * 10) / 10
  // Mark as revised
  p._revised = true
  p._roundNumber = (project._roundNumber || 1) + 1
  return p
}

// ── Argument Generator ────────────────────────────────────────

function getTemplate(agentId, argType, project) {
  const templates = ARGUMENT_TEMPLATES[agentId]?.[argType]
  if (!templates || templates.length === 0) return null
  const fn = pick(templates)
  return typeof fn === 'function' ? fn(project) : fn
}

function generateArgument(agent, type, project, targetArgId = null) {
  const text = getTemplate(agent.id, type, project)
  if (!text) return null
  return {
    id: `arg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    agentId: agent.id,
    type,
    text,
    targetArgId,
    dimension: agent.focus[0] || 'general',
    timestamp: Date.now(),
    strength: rand(0.5, 1.0),
  }
}

// ── Session State ─────────────────────────────────────────────

export function createSession(project, options = {}) {
  const speed = SPEED_MULTIPLIERS[options.speed || 'normal']
  return {
    id: `ses_${Date.now()}`,
    projectId: project?.id || null,   // ← явно сохраняем для saveDecisionToFst / saveContractNodes
    project,
    phase: 'IDLE',
    phaseIndex: 0,
    speed,
    useAI:        options.useAI        !== false,  // по умолчанию включён
    useAgentLoop: options.useAgentLoop === true,   // agentic loop (opt-in)
    useOrchestrator: options.useOrchestrator === true, // server-side orchestration (opt-in)
    votingMode: options.votingMode || 'hybrid',       // 'formula' | 'hybrid' | 'llm'
    // Issue #161: decision thresholds from Integram
    icParams: options.icParams || null,
    // Настройки оркестратора моделей
    speedProfile:   options.speedProfile   || 'fast',
    modelOverrides: options.modelOverrides || {},  // { [agentId]: modelId }
    roundNumber: project._roundNumber || 1,
    agents: getAgents(),
    arguments: [],
    votes: [],
    decision: null,
    recommendations: [],
    revisionProgress: 0,        // 0..1 during REVISION phase
    revisionStep: '',
    revisedProject: null,       // project after applying recs
    agentStatus: Object.fromEntries(getAgents().map(a => [a.id, { thinking: false, done: false, thinkText: '', pipeline: { integram: 'idle', calc: 'idle', llm: 'idle', save: 'idle' } }])),
    dimScores: computeDimScores(project),
    agentScores: [],
    events: [],
    startedAt: null,
    concludedAt: null,
    _kagContext: '',           // KAG context (loaded at start)
    _ontologyContext: '',      // Issue #162: БПЛА ontology context
    _contradictions: [],       // найденные противоречия (заполняется в REFLECTION)
    _sharedContext: {          // агрегированный контекст для инструмента read_context
      stances: {},
      conditions: [],
      contradictions: [],
      round: 1,
    },
    chairmanSynthesis: null,   // нарративный вердикт ChairmanAgent
    qualityMetrics: null,      // метрики качества сессии
    nodeProposals:  [],   // предложения агентов по нодам
    contractNodes:  [],   // финальные согласованные ноды
    nodeVotes:      [],   // протокол голосования по нодам
  }
}

// ── Engine ────────────────────────────────────────────────────

export class FstCommitteeEngine {
  constructor(session, onEvent) {
    this.session  = session
    this.onEvent  = onEvent || (() => {})
    this._timers  = []
    this._running = false

    // ── Debate Room — shared message bus для multi-agent loop ──────────────
    this.room = new DebateRoom((roomMsg) => {
      // Пробрасываем события зала в граф как AgentLoopPublished
      this.emit('AgentLoopPublished', {
        agentId:    roomMsg.agentId,
        text:       roomMsg.text,
        toolsUsed:  roomMsg.toolsUsed || [],
        dimension:  roomMsg.dimension,
        phase:      roomMsg.phase,
      })
    })
  }

  emit(type, data = {}) {
    const event = { type, ...data, ts: Date.now() }
    this.session.events.push(event)
    this.onEvent(event)
  }

  delay(ms) {
    const adjusted = ms / this.session.speed
    return new Promise(resolve => {
      const t = setTimeout(resolve, adjusted)
      this._timers.push(t)
    })
  }

  stop() {
    this._running = false
    this._timers.forEach(t => clearTimeout(t))
    this._timers = []
    if (this._debateSocket) this._debateSocket.disconnect()
    if (this._backendSessionId) {
      if (this.session.useOrchestrator) {
        stopOrchestratedDebate(this._backendSessionId).catch(() => {})
      }
      concludeDebateSession(this._backendSessionId).catch(() => {})
    }
  }


  /**
   * Server-side orchestrated mode.
   * Backend drives all phases — frontend is a thin real-time viewer.
   * All agent loops run on the server via DebateOrchestrator.
   */
  async _runOrchestrated() {
    try {
      // Wait for backend session to be ready
      await this._initBackendSession()
      if (!this._backendSessionId) {
        console.error('[Engine] Cannot start orchestrated mode: no backend session')
        this.emit('OrchestratedError', { error: 'Backend session unavailable' })
        return
      }

      // Connect Socket.IO with full event handlers
      this._debateSocket = connectDebateSocket(this._backendSessionId, {
        onMessage: (msg) => {
          // Mirror server messages into local session
          this.session.arguments.push(msg)
          this.room.publish(msg.agentId, msg)
          this.emit('ArgumentPublished', {
            agentId: msg.agentId,
            argument: msg,
            source: 'server',
          })
        },
        onPhaseChange: ({ prevPhase, nextPhase }) => {
          this.session.phase = nextPhase
          this.session.phaseIndex = PHASE_ORDER.indexOf(nextPhase)
          this.emit('PhaseTransition', { phase: nextPhase, from: prevPhase })
          // Update agent statuses
          for (const agent of this.session.agents) {
            this.session.agentStatus[agent.id].thinking = false
            this.session.agentStatus[agent.id].done = false
          }
        },
        onVote: (vote) => {
          this.session.votes.push(vote)
          this.emit('VoteCast', vote)
        },
        onEnd: (data) => {
          this.session.decision = data.decision || null
          this.session.concludedAt = Date.now()
          this.session.phase = 'CONCLUDED'

          // ConditionalDecision: обогащаем вердикт противоречиями из дебатов
          const contradictions = detectContradictions(this.session.arguments)
          if (contradictions.length) {
            const derivedConditions = deriveConditionsFromContradictions(contradictions, this.session.project)
            this.session.conditionalDecision = assembleConditionalDecision({
              decision: this.session.decision,
              contradictions,
              conditions: derivedConditions,
              project: this.session.project,
            })
            this.emit('ConditionalDecisionReady', this.session.conditionalDecision)
          }

          this.emit('SessionConcluded', {
            decision: data.decision,
            beliefDrift: data.beliefDrift,
            elapsed: data.elapsed,
          })
          this._running = false
        },
        onAgentProgress: (data) => {
          if (data.type === 'tool_start') {
            const status = this.session.agentStatus[data.agentId]
            if (status) {
              status.thinking = true
              status.thinkText = `Использую ${data.tool}...`
            }
            this.emit('AgentLoopProgress', data)
          } else if (data.type === 'tool_done') {
            this.emit('AgentLoopProgress', data)
          } else if (data.type === 'publish') {
            const status = this.session.agentStatus[data.agentId]
            if (status) {
              status.thinking = false
              status.done = true
            }
          }
        },
        onConvergence: (data) => {
          this.emit('ConvergenceDetected', data)
        },
      })

      // Kick off server-side orchestration
      await startOrchestratedDebate(this._backendSessionId)
      this.emit('OrchestratedStarted', { sessionId: this._backendSessionId })

    } catch (e) {
      console.error('[Engine] Orchestrated mode error:', e.message)
      this.emit('OrchestratedError', { error: e.message })
    }
  }

  /** Create backend session + connect Socket.IO (non-blocking) */
  async _initBackendSession() {
    try {
      const agents = this.session.agents.map(a => a.id)
      const resp = await createDebateSession(this.session.project, agents, {
        speedProfile: this.session.speedProfile,
        maxRounds: 5,
      })
      this._backendSessionId = resp.id
      this._debateSocket = connectDebateSocket(resp.id, {
        onMessage: (msg) => this.emit('BackendDebateMessage', msg),
      })
    } catch (e) {
      console.warn('[Engine] Backend session unavailable, continuing local-only:', e.message)
      this._backendSessionId = null
    }
  }

  /** Sync phase change to backend */
  async _syncPhase(phase) {
    if (!this._backendSessionId) return
    setDebatePhase(this._backendSessionId, phase).catch(() => {})
  }

  /** Mirror publish to backend */
  async _syncPublish(agentId, payload) {
    if (!this._backendSessionId) return
    publishToDebate(this._backendSessionId, agentId, payload).catch(() => {})
  }

  /** Mirror vote to backend */
  async _syncVote(agentId, vote) {
    if (!this._backendSessionId) return
    castDebateVote(this._backendSessionId, agentId, vote).catch(() => {})
  }

  async start() {
    this._running = true
    this.session.startedAt = Date.now()
    this.emit('SessionStarted', { sessionId: this.session.id })

    // Sync session to backend (non-blocking)
    this._initBackendSession()

    // Загружаем KAG-контекст прошлых решений + онтологию БПЛА (не блокирует старт)
    clearKagCache()
    if (this.session.useAgentLoop) resetLoopTokenCache()
    if (this.session.useAI) {
      // Issue #162: параллельная загрузка KAG-контекста и онтологии
      fetchKagContext(this.session.project).then(ctx => {
        this.session._kagContext = ctx || ''
      }).catch(() => { this.session._kagContext = '' })

      fetchOntologyContext().then(onto => {
        this.session._ontologyContext = onto || ''
        if (onto) this.session._kagContext = [this.session._kagContext, onto].filter(Boolean).join('\n\n')
      }).catch(() => { this.session._ontologyContext = '' })
    }

    // ── Server-side orchestration mode ──────────────────────────────────
    if (this.session.useOrchestrator) {
      return this._runOrchestrated()
    }

    try {
      await this._phaseLoading()
      if (!this._running) return
      await this._phasePrimaryPositions()
      if (!this._running) return
      await this._phaseCrossDebate()
      if (!this._running) return
      await this._phaseReflection()
      if (!this._running) return
      await this._phaseFinalPositions()
      if (!this._running) return
      await this._phaseVoting()
      if (!this._running) return
      await this._phaseSynthesis()
      if (!this._running) return
      await this._phaseHumanApproval()
    } catch (e) {
      if (this._running) throw e
    }
  }

  // ── Phase: LOADING ────────────────────────────────────────

  async _phaseLoading() {
    this._transitionPhase('LOADING')
    await this.delay(TIMING.PHASE_TRANSITION_DELAY)

    const project = this.session.project

    // ── Links: обнаружить пересечения с портфелем ────────────
    detectPortfolioOverlap(project.subFund || 'БАС').then(overlaps => {
      this.session._portfolioOverlaps = overlaps
      if (overlaps.length > 0) {
        this.emit('PortfolioOverlapDetected', { overlaps })
      }
    }).catch(() => { this.session._portfolioOverlaps = [] })

    // ── Links: авто-тег сессии концептами по субфонду ────────
    tagSessionWithConcepts(this.session.id, project.subFund || 'БАС').then(links => {
      this.session._conceptLinks = links
      this.emit('SessionTagged', { concepts: links.map(l => l.targetId) })
    }).catch(() => {})

    // All agents "read documents" in parallel (staggered start)
    const agentPromises = getAgents().map(async (agent, idx) => {
      await this.delay(idx * 400)
      this._setAgentStatus(agent.id, { thinking: true, done: false })
      this.emit('AgentAnalysisStarted', { agentId: agent.id })

      // Cycle through thinking phrases
      for (const phrase of agent.thinkingPhrases) {
        this._setAgentStatus(agent.id, { thinkText: phrase })
        await this.delay(TIMING.LOADING_DURATION / agent.thinkingPhrases.length)
        if (!this._running) return
      }

      this._setAgentStatus(agent.id, { thinking: false, done: true, thinkText: '' })
      this.emit('AgentAnalysisCompleted', { agentId: agent.id })
    })

    await Promise.all(agentPromises)
    await this.delay(TIMING.PHASE_TRANSITION_DELAY)
  }

  // ── Phase: PRIMARY_POSITIONS ──────────────────────────────

  async _phasePrimaryPositions() {
    this._transitionPhase('PRIMARY_POSITIONS')
    this.room.setPhase('PRIMARY_POSITIONS')
    await this.delay(TIMING.PHASE_TRANSITION_DELAY)

    if (this.session.useAgentLoop) {
      // ── BATCHED PARALLEL: агенты по 4 одновременно — не flood ──────────
      const BATCH = 4
      for (let i = 0; i < getAgents().length; i += BATCH) {
        if (!this._running) break
        await Promise.all(getAgents().slice(i, i + BATCH).map(agent => this._agentSpeak(agent, 'OPENING')))
      }
    } else {
      for (const agent of getAgents()) {
        if (!this._running) return
        await this._agentSpeak(agent, 'OPENING')
      }
    }

    await this.delay(TIMING.PHASE_TRANSITION_DELAY)
  }

  // ── Phase: CROSS_DEBATE ───────────────────────────────────

  async _phaseCrossDebate() {
    this._transitionPhase('CROSS_DEBATE')
    this.room.setPhase('CROSS_DEBATE')
    await this.delay(TIMING.PHASE_TRANSITION_DELAY)

    // Issue #165: debate params from speed profile (fast=2x2, quality=3x3)
    const profile = SPEED_PROFILES[this.session.speedProfile] || SPEED_PROFILES.fast
    const rounds       = profile.debateRounds       ?? 3
    const challPerRound = profile.challengersPerRound ?? 3
    const BATCH = 4  // same as PRIMARY/FINAL batching

    for (let round = 0; round < rounds; round++) {
      if (!this._running) return
      const challengers = [...getAgents()].sort(() => Math.random() - 0.5).slice(0, challPerRound)

      if (this.session.useAgentLoop) {
        // ── BATCHED: challenges in parallel, then counters in parallel ──
        const challengeResults = []
        for (let i = 0; i < challengers.length; i += BATCH) {
          if (!this._running) break
          const batch = challengers.slice(i, i + BATCH)
          const results = await Promise.all(batch.map(agent => {
            const unchallenged = this.room.getUnchallengedArgs(agent.id).filter(a => a.type === 'OPENING')
            const weakest = unchallenged
              .sort((a, b) => (a.toulminStrength ?? a.confidence ?? 0.5) - (b.toulminStrength ?? b.confidence ?? 0.5))[0]
            const openings = this.session.arguments.filter(a => a.type === 'OPENING' && a.agentId !== agent.id)
            const target = weakest ?? (openings.length ? openings[Math.floor(Math.random() * openings.length)] : null)
            return this._agentSpeak(agent, 'CHALLENGE', target?.id ?? null).then(arg => ({ agent, arg, target }))
          }))
          challengeResults.push(...results.filter(r => r.arg))
        }

        // Counters: batch all counter-responses
        if (this._running && challengeResults.length) {
          for (let i = 0; i < challengeResults.length; i += BATCH) {
            if (!this._running) break
            const batch = challengeResults.slice(i, i + BATCH)
            await Promise.all(batch.map(({ arg, target }) => {
              const targetOwner = target ? getAgents().find(a => a.id === target.agentId) : null
              const counterAgent = targetOwner ?? getAgents().find(a => a.id !== arg.agentId)
              return counterAgent ? this._agentSpeak(counterAgent, 'COUNTER', arg.id) : Promise.resolve()
            }))
          }
        }
      } else {
        // ── Sequential fallback (non-agentLoop mode) ──
        for (const agent of challengers) {
          if (!this._running) return
          const unchallenged = this.room.getUnchallengedArgs(agent.id).filter(a => a.type === 'OPENING')
          const weakest = unchallenged
            .sort((a, b) => (a.toulminStrength ?? a.confidence ?? 0.5) - (b.toulminStrength ?? b.confidence ?? 0.5))[0]
          const openings = this.session.arguments.filter(a => a.type === 'OPENING' && a.agentId !== agent.id)
          const target = weakest ?? (openings.length ? openings[Math.floor(Math.random() * openings.length)] : null)

          const arg = await this._agentSpeak(agent, 'CHALLENGE', target?.id ?? null)
          if (!arg || !this._running) continue
          await this.delay(TIMING.ARGUMENT_DELAY)

          const targetOwner = target ? getAgents().find(a => a.id === target.agentId) : null
          const counterAgent = targetOwner ?? getAgents().find(a => a.id !== agent.id)
          if (counterAgent && this._running) await this._agentSpeak(counterAgent, 'COUNTER', arg.id)
        }
      }
    }

    await this.delay(TIMING.PHASE_TRANSITION_DELAY)
  }

  // ── Phase: REFLECTION ─────────────────────────────────────
  //
  // Фаза рефлексии: после дебатов devil атакует неоспоренные аргументы,
  // dialectic строит синтез противоречий. Обновляется _sharedContext.

  async _phaseReflection() {
    this._transitionPhase('REFLECTION')
    this.room.setPhase('REFLECTION')
    await this.delay(TIMING.PHASE_TRANSITION_DELAY)

    if (!this.session.useAgentLoop) {
      // Без агентного лупа — только детекция противоречий
      const contradictions = detectContradictions(this.session.arguments)
      this.session._contradictions = contradictions
      this._updateSharedContext()
      if (contradictions.length) {
        this.emit('ContradictionsFound', { count: contradictions.length, contradictions })
      }
      await this.delay(TIMING.PHASE_TRANSITION_DELAY)
      return
    }

    // 1. Находим 3 самых сильных неоспоренных аргумента
    const unchallenged = this.room.getUnchallengedArgs(null)
      .filter(a => (a.confidence || a.strength || 0) > 0.65)
      .sort((a, b) => (b.confidence || b.strength || 0) - (a.confidence || a.strength || 0))
      .slice(0, 3)

    // 2. devil атакует каждый в режиме slow (CoT)
    const devilAgent = this.session.agents.find(a => a.id === 'devil')
    if (devilAgent && unchallenged.length > 0) {
      this._setAgentStatus(devilAgent.id, { thinking: true, thinkText: 'Ищу уязвимые места...' })
      for (const target of unchallenged) {
        if (!this._running) break
        const arg = await runAgentLoop(
          devilAgent, 'CHALLENGE', this.room, this.session.project,
          target, this.session,
          { speedProfile: this.session.speedProfile, thinkingMode: 'slow' },
          (p) => this.emit('AgentLoopProgress', p)
        )
        if (arg) {
          const annotated = annotateArg(arg, this.session.arguments)
          this.session.arguments.push(annotated)
          this.room.publish(devilAgent.id, annotated)
          this.emit('ReflectionChallenge', { arg: annotated, targetId: target.id })
        }
      }
      this._setAgentStatus(devilAgent.id, { thinking: false, thinkText: '' })
    }

    // 3. Обнаружение противоречий
    const contradictions = detectContradictions(this.session.arguments)
    this.session._contradictions = contradictions
    if (contradictions.length) {
      this.emit('ContradictionsFound', { count: contradictions.length, contradictions })
    }

    // 4. dialectic синтезирует противоречия (если есть что синтезировать)
    const dialecticAgent = this.session.agents.find(a => a.id === 'dialectic')
    if (dialecticAgent && contradictions.length > 0) {
      this._setAgentStatus(dialecticAgent.id, { thinking: true, thinkText: 'Ищу синтез противоречий...' })
      this._updateSharedContext()
      const synthArg = await runAgentLoop(
        dialecticAgent, 'SYNTHESIS', this.room, this.session.project,
        null, this.session,
        { speedProfile: this.session.speedProfile, thinkingMode: 'slow' },
        (p) => this.emit('AgentLoopProgress', p)
      )
      if (synthArg) {
        const annotated = annotateArg(synthArg, this.session.arguments)
        this.session.arguments.push(annotated)
        this.room.publish(dialecticAgent.id, annotated)
        this.emit('DialecticSynthesis', { arg: annotated })
      }
      this._setAgentStatus(dialecticAgent.id, { thinking: false, thinkText: '' })
    }

    this._updateSharedContext()
    await this.delay(TIMING.PHASE_TRANSITION_DELAY)
  }

  // ── Phase: FINAL_POSITIONS ────────────────────────────────

  async _phaseFinalPositions() {
    this._transitionPhase('FINAL_POSITIONS')
    this.room.setPhase('FINAL_POSITIONS')
    await this.delay(TIMING.PHASE_TRANSITION_DELAY)

    if (this.session.useAgentLoop) {
      // ── BATCHED PARALLEL: по 4 агента, не flood ─────────────────────────
      const BATCH = 4
      for (let i = 0; i < getAgents().length; i += BATCH) {
        if (!this._running) break
        await Promise.all(getAgents().slice(i, i + BATCH).map(agent => this._agentSpeak(agent, 'SUMMARY')))
      }
    } else {
      for (const agent of getAgents()) {
        if (!this._running) return
        await this._agentSpeak(agent, 'SUMMARY')
      }
    }

    await this.delay(TIMING.PHASE_TRANSITION_DELAY)
  }

  // ── Phase: VOTING ─────────────────────────────────────────

  async _phaseVoting() {
    this._transitionPhase('VOTING')
    this.emit('VotingStarted')
    await this.delay(TIMING.PHASE_TRANSITION_DELAY)

    const mode = this.session.votingMode || 'hybrid'
    const dimScores = this.session.dimScores
    const agentVotes = []

    // ── Извлекаем позиции из SUMMARY/RESCORE аргументов ──
    const summaryStances = {}
    const summaryConfidence = {}
    for (const arg of this.session.arguments) {
      if ((arg.type === 'RESCORE' || arg.type === 'SUMMARY') && arg.stance) {
        // RESCORE перезаписывает SUMMARY (если есть)
        if (!summaryStances[arg.agentId] || arg.type === 'RESCORE') {
          summaryStances[arg.agentId] = arg.stance
          summaryConfidence[arg.agentId] = arg.confidence
        }
      }
    }

    // Consensus pressure (только для hybrid)
    const stanceCounts = { APPROVE: 0, DEFER: 0, REJECT: 0 }
    for (const st of Object.values(summaryStances)) stanceCounts[st] = (stanceCounts[st] || 0) + 1
    const dominantStance = Object.entries(stanceCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || null
    const dominantShare = dominantStance ? stanceCounts[dominantStance] / getAgents().length : 0

    for (const agent of getAgents()) {
      if (!this._running) return
      await this.delay(TIMING.VOTE_DELAY)

      let verdict, score, confidence
      const llmStance = summaryStances[agent.id]
      const llmConf   = summaryConfidence[agent.id]

      if (mode === 'formula') {
        // ── Чистая формула: веса + bias + шум ──
        score = agentScore(agent, dimScores)
        verdict = scoreToVerdict(score, this?.session?.icParams)
        confidence = clamp(Math.abs(score - 0.6) * 2 + 0.4, 0.4, 1.0)

      } else if (mode === 'llm') {
        // ── Чисто LLM: stance и confidence из ответа агента ──
        if (llmStance) {
          verdict = llmStance
          confidence = typeof llmConf === 'number' ? clamp(llmConf, 0, 1) : 0.7
          score = verdict === 'APPROVE' ? 0.7 + confidence * 0.3
               : verdict === 'REJECT'  ? 0.3 - confidence * 0.2
               : 0.5
        } else {
          // Fallback если LLM не дал stance
          score = agentScore(agent, dimScores)
          verdict = scoreToVerdict(score, this?.session?.icParams)
          confidence = 0.5
        }

      } else {
        // ── Гибрид (по умолчанию): LLM stance + формульный score + consensus pressure ──
        if (llmStance) {
          verdict = llmStance
          // Consensus pressure: configurable threshold → слабые переворачиваются
          const cpThreshold = (this.session.icParams?.consensusPressure || 85) / 100
          if (dominantShare >= cpThreshold && verdict !== dominantStance) {
            const agentArg = this.session.arguments.filter(a => a.agentId === agent.id && a.type === 'SUMMARY')[0]
            if (!agentArg || agentArg.confidence < 0.6) verdict = dominantStance
          }
          const baseScore = verdict === 'APPROVE' ? 0.74 : verdict === 'DEFER' ? 0.55 : 0.28
          score = clamp(baseScore + (Math.random() - 0.5) * 0.12, 0, 1)
          confidence = clamp(0.6 + Math.random() * 0.3, 0.6, 0.95)
        } else {
          score = agentScore(agent, dimScores)
          verdict = scoreToVerdict(score, this?.session?.icParams)
          confidence = clamp(Math.abs(score - 0.6) * 2 + 0.4, 0.4, 1.0)
        }
      }

      const vote = {
        id: `vote_${agent.id}_${Date.now()}`,
        agentId: agent.id,
        verdict,
        score: Math.round(score * 100),
        confidence,
        rationale: this._buildVoteRationale(agent, score, verdict),
        fromDebate: mode !== 'formula' && !!llmStance,
        votingMode: mode,
      }

      this.session.votes.push(vote)
      this._syncVote(agent.id, vote)
      agentVotes.push({ agent, score, verdict })
      this.emit('VoteCast', { vote })

      this._setAgentStatus(agent.id, {
        vote: verdict,
        voteScore: Math.round(score * 100),
      })
    }

    // Сохраняем дельту позиций (OPENING → SUMMARY)
    this._buildPositionDeltas()

    this.session.agentScores = agentVotes
    this.emit('AllVotesCast', { votes: this.session.votes })
    await this.delay(TIMING.PHASE_TRANSITION_DELAY)
  }

  // Вычисляем как изменилась позиция каждого агента за дебаты
  _buildPositionDeltas() {
    const openingStances = {}
    const summaryStances = {}
    for (const arg of this.session.arguments) {
      if (!arg.stance) continue
      if (arg.type === 'OPENING' && !openingStances[arg.agentId]) openingStances[arg.agentId] = arg.stance
      if (arg.type === 'SUMMARY') summaryStances[arg.agentId] = arg.stance
    }
    const deltas = {}
    for (const agent of getAgents()) {
      const from = openingStances[agent.id] || null
      const to   = summaryStances[agent.id]  || null
      deltas[agent.id] = { from, to, changed: from && to && from !== to }
    }
    this.session.positionDeltas = deltas
    if (Object.values(deltas).some(d => d.changed)) {
      this.emit('PositionDeltaReady', { deltas })
    }
  }

  // ── Phase: SYNTHESIS ──────────────────────────────────────

  async _phaseSynthesis() {
    this._transitionPhase('SYNTHESIS')
    await this.delay(TIMING.PHASE_TRANSITION_DELAY)

    const agentScores = this.session.agentScores
    const agg = aggregateScore(agentScores)
    const recommendation = scoreToVerdict(agg, this.session.icParams)

    const voteCounts = { APPROVE: 0, REJECT: 0, DEFER: 0 }
    for (const { verdict } of agentScores) {
      voteCounts[verdict]++
    }

    const conditions = this._buildConditions(this.session.project, agg)
    const risks = this._buildKeyRisks(this.session.project)

    const decision = {
      id: `dec_${Date.now()}`,
      sessionId: this.session.id,
      aggregatedScore: Math.round(agg * 100),
      recommendation,
      voteCounts,
      conditions,
      risks,
      dimScores: this.session.dimScores,
      formedAt: Date.now(),
    }

    this.session.decision = decision

    // ── ConditionalDecision: обогащаем вердикт противоречиями из дебатов ──
    const contradictions = this.session._contradictions || detectContradictions(this.session.arguments)
    if (contradictions.length) {
      const derivedConditions = deriveConditionsFromContradictions(contradictions, this.session.project)
      this.session.conditionalDecision = assembleConditionalDecision({
        decision,
        contradictions,
        conditions: derivedConditions,
        project: this.session.project,
      })
      this.emit('ConditionalDecisionReady', this.session.conditionalDecision)
    }

    this.emit('DecisionFormed', { decision })
    await this.delay(TIMING.PHASE_TRANSITION_DELAY)

    // ── ChairmanAgent: финальный нарративный синтез (только в agentLoop-режиме) ──
    if (this.session.useAgentLoop) {
      const chairmanAgent = this.session.agents.find(a => a.id === 'chairman')
      if (chairmanAgent) {
        this._setAgentStatus(chairmanAgent.id, { thinking: true, thinkText: 'Синтезирую итоговый вердикт...' })
        this._updateSharedContext()
        const chairArg = await runAgentLoop(
          chairmanAgent, 'SYNTHESIS', this.room, this.session.project,
          null, this.session,
          { speedProfile: this.session.speedProfile, thinkingMode: 'slow',
            modelOverrides: { chairman: 'polza/anthropic/claude-sonnet-4.6' } },
          (p) => this.emit('AgentLoopProgress', p)
        ).catch(e => { console.warn('[Engine] ChairmanAgent error:', e.message); return null })
        if (chairArg) {
          this.session.chairmanSynthesis = chairArg
          this.emit('ChairmanVerdictReady', { arg: chairArg })
        }
        this._setAgentStatus(chairmanAgent.id, { thinking: false, thinkText: '' })
      }
    }

    // ── qualityMetrics — метрики качества сессии ──
    this.session.qualityMetrics = this._computeQualityMetrics()
    this.emit('QualityMetricsReady', { metrics: this.session.qualityMetrics })

    this.emit('DecisionPublished', { decision })
    await this.delay(TIMING.PHASE_TRANSITION_DELAY)
  }

  // Вычисляет метрики качества сессии
  _computeQualityMetrics() {
    const args = this.session.arguments || []
    const challenged = new Set(args.filter(a => a.targetArgId).map(a => a.targetArgId))
    const totalArgs = args.length || 1
    const challengedCount = args.filter(a => challenged.has(a.id)).length

    const stances = args.filter(a => a.stance).map(a => a.stance)
    const stanceDist = { APPROVE: 0, DEFER: 0, REJECT: 0 }
    for (const s of stances) stanceDist[s] = (stanceDist[s] || 0) + 1
    const mean = stances.length ? Object.values(stanceDist).reduce((a, b) => a + b, 0) / 3 : 0
    const variance = Object.values(stanceDist).reduce((s, v) => s + (v - mean) ** 2, 0) / 3
    const agentConsensus = 1 - Math.min(1, Math.sqrt(variance) / (stances.length || 1))

    const touStrengths = args.map(a => a.toulminStrength || 0.5)
    const avgToulminStrength = touStrengths.reduce((s, v) => s + v, 0) / (touStrengths.length || 1)

    const agentsWithTools = new Set(args.filter(a => a.toolsUsed?.length > 0).map(a => a.agentId))
    const totalAgents = (this.session.agents || []).length || 1
    const toolUsageRate = agentsWithTools.size / totalAgents

    const contradictions = this.session._contradictions || []
    const resolvedContradictions = contradictions.filter(c => c.status !== 'OPEN').length

    return {
      challengeCoverage:       +(challengedCount / totalArgs).toFixed(2),
      agentConsensus:          +agentConsensus.toFixed(2),
      avgToulminStrength:      +avgToulminStrength.toFixed(2),
      toolUsageRate:           +toolUsageRate.toFixed(2),
      contradictionResolution: contradictions.length
        ? +(resolvedContradictions / contradictions.length).toFixed(2)
        : 1,
      temporalCoverage:  args.some(a => a.agentId === 'temporal'),
      founderCoverage:   args.some(a => a.agentId === 'founder'),
      chairmanCoverage:  args.some(a => a.agentId === 'chairman'),
      dialecticCoverage: args.some(a => a.agentId === 'dialectic'),
      totalArguments:    args.length,
    }
  }

  // ── Phase: HUMAN_APPROVAL ─────────────────────────────────

  async _phaseHumanApproval() {
    this._transitionPhase('HUMAN_APPROVAL')
    this.emit('HumanApprovalRequested', { decision: this.session.decision })
    // Engine waits here — human interaction is via humanDecide()
  }

  // Обновляет _sharedContext агрегированными данными сессии
  _updateSharedContext() {
    const args = this.session.arguments || []
    const stances = {}
    for (const a of args) {
      if (a.stance && a.agentId) stances[a.agentId] = a.stance
    }
    const conditions = (this.session.conditionalDecision?.conditions || [])
    const contradictions = this.session._contradictions || []
    this.session._sharedContext = {
      stances,
      conditions,
      contradictions,
      round: this.session.roundNumber || 1,
    }
  }

  // ── Расширенное взаимодействие с инвестором (Human Approval) ──────────────
  //
  // Типы действий:
  //   APPROVE          — утвердить решение ИК
  //   REJECT           — отклонить (с обоснованием)
  //   VETO             — наложить вето (поверх вердикта агентов)
  //   REQUEST_REVISION — вернуть на доработку с вопросом в DebateRoom
  //   MODIFY_CONDITIONS — скорректировать условия сделки

  async applyHumanDecision(humanAction) {
    const { type, reason = '', modifiedConditions, customWeights } = humanAction

    if (type === 'VETO') {
      this.session.decision.recommendation = 'REJECTED_BY_HUMAN'
      this.session.decision.humanVeto = { reason, ts: Date.now() }
      this.emit('HumanVeto', { reason })
      this._concludeSession('REJECT')
      return
    }

    if (type === 'MODIFY_CONDITIONS' && modifiedConditions) {
      if (this.session.decision) this.session.decision.conditions = modifiedConditions
      if (this.session.conditionalDecision) this.session.conditionalDecision.conditions = modifiedConditions
      this.emit('ConditionsModified', { conditions: modifiedConditions })
    }

    if (type === 'REQUEST_REVISION' && reason) {
      // Добавляем вопрос инвестора в DebateRoom и возвращаемся к дебатам
      this.room.publish('human_investor', {
        type: 'QUESTION',
        text: `[Запрос инвестора]: ${reason}`,
        confidence: 1.0,
        stance: null,
      })
      this._updateSharedContext()
      this.emit('HumanRevisionRequested', { reason })
      // Запускаем дополнительный раунд CROSS_DEBATE
      if (this.session.useAgentLoop) {
        this._transitionPhase('CROSS_DEBATE')
        await this._phaseCrossDebate()
        if (!this._running) return
        await this._phaseReflection()
        if (!this._running) return
      }
      // Пересчитываем синтез
      await this._phaseSynthesis()
      if (!this._running) return
      await this._phaseHumanApproval()
      return
    }

    if (customWeights && Object.keys(customWeights).length > 0) {
      // Пересчёт агрегированного балла с пользовательскими весами
      const reweighted = (this.session.agentScores || []).map(({ agent, score, verdict }) => ({
        agent: { ...agent, weight: customWeights[agent.id] ?? agent.weight },
        score,
        verdict,
      }))
      if (reweighted.length > 0) {
        const newAgg = aggregateScore(reweighted)
        const newVerdict = scoreToVerdict(newAgg, this.session.icParams)
        this.session.decision.aggregatedScore = Math.round(newAgg * 100)
        this.session.decision.recommendation  = newVerdict
        this.session.decision.customWeightsApplied = customWeights
        this.emit('ScoreRecomputed', { aggregatedScore: Math.round(newAgg * 100), recommendation: newVerdict })
      }
    }

    // Передаём в стандартный humanDecide
    this.humanDecide(type === 'APPROVE' ? 'APPROVE' : 'REJECT', reason)
  }

  // Called by UI when human approves/rejects/defers
  humanDecide(verdict, comment = '', memberId = 'chair') {
    const approval = {
      id: `appr_${Date.now()}`,
      decisionId: this.session.decision?.id,
      memberId,
      verdict,
      comment,
      approvedAt: Date.now(),
    }
    this.session.decision.humanApproval = approval
    this.emit(`Decision${verdict.charAt(0) + verdict.slice(1).toLowerCase()}d`, { approval })

    if (verdict === 'APPROVE') {
      // Запускаем согласование нод контракта → голосование → завершение
      this._phaseNodeNegotiation()
        .then(() => { if (this._running) return this._phaseNodeVoting() })
        .then(() => { if (this._running) this._concludeSession(verdict) })
        .catch(e => { if (this._running) { console.error('[Engine] node phase error:', e); this._concludeSession(verdict) } })
    } else {
      this._concludeSession(verdict)
    }
  }

  _concludeSession(verdict) {
    this._transitionPhase('CONCLUDED')
    this.session.concludedAt = Date.now()
    this.emit('SessionConcluded', {
      sessionId:    this.session.id,
      finalVerdict: verdict,
      score:        this.session.decision.aggregatedScore,
    })

    // Issue #162: очистка KAG/онтология кешей после завершения сессии
    clearKagCache()
    clearOntologyCache()
    this.session._kagContext = ''
    this.session._ontologyContext = ''

    // ── Links: зафиксировать решение как связь session → company ──
    const project = this.session.project
    const score   = this.session.decision?.aggregatedScore || 0
    if (project.companyId || project.id) {
      recordSessionDecision(
        this.session.id,
        project.companyId || project.id,
        project.title || project.company || 'Проект',
        verdict,
        score,
      ).then(link => {
        this.session._decisionLink = link
        this.emit('DecisionLinked', { link, verdict })
      }).catch(() => {})
    }

    // ── Links: связать аргументы с концептами по dimension ───
    const dimArgs = this.session.arguments.filter(a => a.dimension && DIM_CONCEPTS[a.dimension])
    for (const arg of dimArgs.slice(0, 10)) {
      const concept = DIM_CONCEPTS[arg.dimension]
      if (concept) {
        linkArgumentToConcept(arg.id, concept.id, concept.name, Math.round((arg.strength || 0.7) * 100))
          .catch(() => {})
      }
    }

    // Auto-generate recommendations
    const recs = generateRecommendations(this.session.decision, this.session.project)
    this.session.recommendations = recs
    this.emit('RecommendationsGenerated', { recommendations: recs, verdict })
    this._transitionPhase('RECOMMENDATIONS')
  }

  // Called by UI when user confirms which recommendations to apply
  startRevision(acceptedIds) {
    // Mark accepted/rejected
    for (const rec of this.session.recommendations) {
      rec.accepted = acceptedIds.includes(rec.id)
    }
    this._transitionPhase('REVISION')
    this._runRevisionAnimation()
  }

  async _runRevisionAnimation() {
    const steps = REVISION_SIMULATION_STEPS
    const totalMs = 4000  // 4 sec total animation
    for (const step of steps) {
      if (!this._running) return
      await this.delay(step.delay * totalMs)
      this.session.revisionProgress = step.delay
      this.session.revisionStep = step.label
      this.emit('RevisionProgress', { progress: step.delay, label: step.label, icon: step.icon })
    }
    // Apply changes to project
    const revised = applyRevision(this.session.project, this.session.recommendations)
    this.session.revisedProject = revised
    this.session.revisionProgress = 1.0
    this.emit('RevisionComplete', { revisedProject: revised })
    this._transitionPhase('READY_NEXT')
  }

  // Returns a new session object for the next round with revised project
  buildNextRoundSession() {
    if (!this.session.revisedProject) return null
    return createSession(this.session.revisedProject, {
      speed: Object.entries(SPEED_MULTIPLIERS).find(([, v]) => v === this.session.speed)?.[0] || 'normal',
    })
  }

  // ── Phase: NODE_NEGOTIATION ───────────────────────────────

  async _phaseNodeNegotiation() {
    this._transitionPhase('NODE_NEGOTIATION')
    await this.delay(TIMING.PHASE_TRANSITION_DELAY)
    const project = this.session.project
    this.session.nodeProposals = []

    // ── Извлекаем числовые параметры из дебатов ───────────────────────────
    // Ищем IRR%, NPV, инвестиции (млн), TRL, MRL в текстах аргументов
    const debateNumbers = this._extractDebateNumbers()

    // Раунд 1: каждый агент предлагает параметры нод (с контекстом из дебатов)
    for (const agent of getAgents()) {
      if (!this._running) return
      this._setAgentStatus(agent.id, { thinking: true, thinkText: 'Формирую ноды контракта...' })
      let proposal = null
      try {
        proposal = await generateNodeProposalAI(agent, project, this.session.nodeProposals, 1, debateNumbers)
      } catch { /* fallback ниже */ }

      if (!proposal) proposal = this._fallbackNodeProposal(agent, project, 1, debateNumbers)
      this.session.nodeProposals.push(proposal)
      this._setAgentStatus(agent.id, { thinking: false, thinkText: '' })
      this.emit('NodeProposed', { agentId: agent.id, proposal, round: 1 })
      await this.delay(500)
    }

    // Раунд 2: 3 агента вносят правки (challenge)
    const challengers = [...getAgents()].sort(() => Math.random() - 0.5).slice(0, 3)
    for (const agent of challengers) {
      if (!this._running) return
      this._setAgentStatus(agent.id, { thinking: true, thinkText: 'Уточняю параметры...' })
      let proposal = null
      try {
        proposal = await generateNodeProposalAI(agent, project, this.session.nodeProposals, 2, debateNumbers)
      } catch { /* fallback */ }

      if (!proposal) proposal = this._fallbackNodeProposal(agent, project, 2, debateNumbers)
      this.session.nodeProposals.push(proposal)
      this._setAgentStatus(agent.id, { thinking: false, thinkText: '' })
      this.emit('NodeProposed', { agentId: agent.id, proposal, round: 2, type: 'CHALLENGE' })
      await this.delay(400)
    }

    // Синтез: взвешенное среднее предложений → 3 финальных ноды (с поправкой из дебатов)
    const finalNodes = this._synthesizeNodes(this.session.nodeProposals, project, debateNumbers)
    this.session.contractNodes = finalNodes
    this.emit('NodesSynthesized', { nodes: finalNodes })
    await this.delay(TIMING.PHASE_TRANSITION_DELAY)
  }

  // Извлекает числовые параметры (IRR, NPV, инвестиции) из текстов аргументов
  _extractDebateNumbers() {
    const args = this.session.arguments || []
    const nums = { irr: [], npv: [], ic: [], wacc: [], trl: [], mrl: [] }
    for (const arg of args) {
      const text = arg.text || ''
      // IRR: ищем "IRR 35%" или "35% IRR" или "доходность 35%"
      for (const m of text.matchAll(/(?:IRR|доходность|IRR-проект)[^\d]*(\d+(?:[.,]\d+)?)\s*%/gi))
        nums.irr.push(parseFloat(m[1].replace(',', '.')))
      // NPV: ищем "NPV 150 млн" или "NPV: 200"
      for (const m of text.matchAll(/NPV[^\d]*(\d+(?:[.,]\d+)?)\s*(?:млн|M|million)?/gi))
        nums.npv.push(parseFloat(m[1].replace(',', '.')))
      // Инвестиции: "инвестиции 200 млн" или "IC 150"
      for (const m of text.matchAll(/(?:инвестиции|IC|сумма)[^\d]*(\d+(?:[.,]\d+)?)\s*(?:млн|M)?/gi))
        nums.ic.push(parseFloat(m[1].replace(',', '.')))
      // WACC
      for (const m of text.matchAll(/(?:WACC|ставка)[^\d]*(\d+(?:[.,]\d+)?)\s*%/gi))
        nums.wacc.push(parseFloat(m[1].replace(',', '.')))
      // TRL/MRL
      for (const m of text.matchAll(/TRL[^\d]*(\d+)/gi)) nums.trl.push(parseInt(m[1]))
      for (const m of text.matchAll(/MRL[^\d]*(\d+)/gi)) nums.mrl.push(parseInt(m[1]))
    }
    const avg = arr => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null
    const med = arr => {
      if (!arr.length) return null
      const s = [...arr].sort((a, b) => a - b)
      return s[Math.floor(s.length / 2)]
    }
    return {
      irr: med(nums.irr),    // медиана IRR из дебатов, %
      npv: avg(nums.npv),    // среднее NPV млн
      ic:  avg(nums.ic),     // среднее вложений млн
      wacc: avg(nums.wacc),  // среднее WACC %
      trl: med(nums.trl),
      mrl: med(nums.mrl),
      raw: nums,             // все найденные значения
    }
  }

  // ── Phase: NODE_VOTING ────────────────────────────────────

  async _phaseNodeVoting() {
    this._transitionPhase('NODE_VOTING')
    await this.delay(TIMING.PHASE_TRANSITION_DELAY)
    this.session.nodeVotes = []
    const project = this.session.project
    const MAX_ROUNDS = 2

    for (let round = 1; round <= MAX_ROUNDS; round++) {
      if (!this._running) return
      const roundVotes = []
      for (const agent of getAgents()) {
        if (!this._running) return
        this._setAgentStatus(agent.id, { thinking: true, thinkText: 'Голосую по нодам...' })
        let vote = null
        try {
          vote = await generateNodeVoteAI(agent, this.session.contractNodes, project)
        } catch { /* fallback */ }

        if (!vote) vote = { agentId: agent.id, verdict: 'ACCEPT', comment: '' }
        vote.round = round
        roundVotes.push(vote)
        this.session.nodeVotes.push(vote)
        this._setAgentStatus(agent.id, { thinking: false, thinkText: '' })
        this.emit('NodeVoteCast', { agentId: agent.id, vote, round })
        await this.delay(400)
      }

      const rejects = roundVotes.filter(v => v.verdict === 'REJECT')
      if (rejects.length === 0) {
        // Единогласное утверждение!
        this.emit('ContractNodesApproved', {
          nodes:     this.session.contractNodes,
          votes:     this.session.nodeVotes,
          unanimous: true,
          round,
        })
        return
      }

      if (round < MAX_ROUNDS) {
        // Корректируем ноды по замечаниям несогласных
        this.session.contractNodes = this._adjustNodes(this.session.contractNodes, rejects)
        this.emit('NodesSynthesized', { nodes: this.session.contractNodes, adjustmentRound: round + 1 })
        await this.delay(800)
      }
    }

    // После max раундов — принудительно утверждаем (большинство приняло)
    this.emit('ContractNodesApproved', {
      nodes:     this.session.contractNodes,
      votes:     this.session.nodeVotes,
      unanimous: false,
      round:     MAX_ROUNDS,
    })
  }

  // ── Node helpers ──────────────────────────────────────────

  _fallbackNodeProposal(agent, project, round, debateNums = {}) {
    // Используем числа из дебатов если есть, иначе — из проекта
    const icBase = debateNums.ic || Math.round((project.askRub || 100_000_000) / 1_000_000)
    const irrBase = debateNums.irr ? debateNums.irr / 100 : (project.projectedIRR || 0.30)
    const waccBase = debateNums.wacc || 18
    const mult = agent.bias === 'optimist' ? 1.15 : agent.bias === 'pessimist' ? 0.85 : 1.0
    const makeCf = (icMult, irrMult) => {
      const base = icBase * icMult * irrBase * irrMult
      return [1, 2, 3, 4, 5].map(t => +(base * t / 5 * mult).toFixed(1))
    }
    const sourceNote = debateNums.irr ? ` (из дебатов: IRR ${debateNums.irr}%)` : ''
    return {
      agentId: agent.id,
      round,
      nodes: {
        pessimistic: { ic: Math.round(icBase * 1.2), wacc: waccBase + 4, cf: makeCf(1.2, 0.55), expectedIrr: Math.round(irrBase * 100 * 0.5), rationale: `Консервативная оценка${sourceNote}` },
        base:        { ic: icBase,                   wacc: waccBase,     cf: makeCf(1.0, 1.0),  expectedIrr: Math.round(irrBase * 100),         rationale: `Базовый сценарий${sourceNote}` },
        optimistic:  { ic: Math.round(icBase * 0.85), wacc: waccBase - 4, cf: makeCf(0.85, 1.45), expectedIrr: Math.round(irrBase * 100 * 1.4),  rationale: `Оптимистичный${sourceNote}` },
      }
    }
  }

  _synthesizeNodes(proposals, project, debateNums = {}) {
    const scenarios = ['pessimistic', 'base', 'optimistic']
    const labels    = { pessimistic: 'Консервативный', base: 'Базовый', optimistic: 'Оптимистичный' }
    const probs     = { pessimistic: 25, base: 50, optimistic: 25 }

    return scenarios.map(sc => {
      // Средние по всем предложениям
      const scProposals = proposals.map(p => p.nodes?.[sc]).filter(Boolean)
      const n = scProposals.length || 1
      // Если в дебатах назывались конкретные цифры — смешиваем с предложениями агентов
      const proposalIc   = scProposals.reduce((s, p) => s + (p.ic || 100), 0) / n
      const proposalWacc = scProposals.reduce((s, p) => s + (p.wacc || 18), 0) / n
      const debateIcWeight = debateNums.ic ? 0.4 : 0   // дебаты дают 40% веса
      const debateWaccWeight = debateNums.wacc ? 0.3 : 0
      const ic   = Math.round(proposalIc * (1 - debateIcWeight) + (debateNums.ic || proposalIc) * debateIcWeight)
      const wacc = +((proposalWacc * (1 - debateWaccWeight) + (debateNums.wacc || proposalWacc) * debateWaccWeight)).toFixed(1)
      const cfLen = Math.max(...scProposals.map(p => p.cf?.length || 5))
      const cf = Array.from({ length: cfLen }, (_, i) => {
        const vals = scProposals.map(p => p.cf?.[i] ?? 0)
        return +(vals.reduce((a, b) => a + b, 0) / n).toFixed(1)
      })

      // Расчёт метрик
      const r   = wacc / 100
      const npv = cf.reduce((acc, c, t) => acc + c / Math.pow(1 + r, t + 1), -ic)
      const irr = this._calcIrr(cf, ic)
      const roi = ((cf.reduce((a, b) => a + b, 0) - ic) / ic) * 100
      const pi  = (npv + ic) / ic
      const dpp = this._calcDpp(cf, ic, r)

      return {
        id:          `node_${sc}_${Date.now()}`,
        scenario:    sc,
        label:       labels[sc],
        ic, wacc, n: cfLen, cashflows: cf,
        npv: +npv.toFixed(2),
        irr,
        roi: +roi.toFixed(1),
        pi:  +pi.toFixed(2),
        dpp,
        probability: probs[sc],
        status:      'draft',
        debateSource: debateNums.irr || debateNums.ic ? {
          irr: debateNums.irr, ic: debateNums.ic, wacc: debateNums.wacc
        } : null,
      }
    })
  }

  _adjustNodes(nodes, rejects) {
    // Небольшая коррекция: снижаем IC на 5%, добавляем 10% к CF оптимистичного
    return nodes.map(n => {
      const adjusted = { ...n, cashflows: [...n.cashflows] }
      if (n.scenario === 'pessimistic') {
        adjusted.ic = Math.round(n.ic * 0.95)
      } else if (n.scenario === 'optimistic') {
        adjusted.cashflows = n.cashflows.map(c => +(c * 1.10).toFixed(1))
      }
      const r   = adjusted.wacc / 100
      const cf  = adjusted.cashflows.slice(0, adjusted.n)
      adjusted.npv = +cf.reduce((acc, c, t) => acc + c / Math.pow(1 + r, t + 1), -adjusted.ic).toFixed(2)
      adjusted.irr = this._calcIrr(cf, adjusted.ic)
      adjusted.pi  = +((adjusted.npv + adjusted.ic) / adjusted.ic).toFixed(2)
      return adjusted
    })
  }

  _calcIrr(cf, ic) {
    let r = 0.1
    for (let i = 0; i < 200; i++) {
      const f  = cf.reduce((acc, c, t) => acc + c / Math.pow(1 + r, t + 1), -ic)
      const df = cf.reduce((acc, c, t) => acc - (t + 1) * c / Math.pow(1 + r, t + 2), 0)
      if (Math.abs(df) < 1e-12) break
      const rNew = r - f / df
      if (Math.abs(rNew - r) < 1e-6) { r = rNew; break }
      r = Math.max(rNew, -0.99)
    }
    return r
  }

  _calcDpp(cf, ic, r) {
    let cum = -ic
    for (let t = 0; t < cf.length; t++) {
      const disc = cf[t] / Math.pow(1 + r, t + 1)
      if (cum + disc >= 0) return +(t + 1 - cum / (disc || 1)).toFixed(1)
      cum += disc
    }
    return null
  }

  // ── Helpers ───────────────────────────────────────────────

  async _agentSpeak(agent, type, targetArgId = null) {
    if (!this._running) return null
    const project        = this.session.project
    const useAI          = this.session.useAI        !== false
    const useAgentLoop   = this.session.useAgentLoop === true

    // ── UI: начало думает ─────────────────────────────────────────────────────
    this._setAgentStatus(agent.id, { thinking: true, thinkText: pick(agent.thinkingPhrases) })
    this._setPipeline(agent.id, { integram: 'done', calc: 'active' })

    // Ротация thinking phrases
    let thinkInterval = null
    if (useAI) {
      let phraseIdx = 1
      thinkInterval = setInterval(() => {
        if (!this._running) { clearInterval(thinkInterval); return }
        this._setAgentStatus(agent.id, { thinkText: agent.thinkingPhrases[phraseIdx++ % agent.thinkingPhrases.length] })
      }, 2500)
    } else {
      await this.delay(TIMING.THINKING_DURATION)
    }

    let arg = null
    this._setPipeline(agent.id, { calc: 'done', llm: 'active' })

    // ── ВЕТКА 1: Agentic Loop (инструменты + параллельный room) ──────────────
    if (useAI && useAgentLoop) {
      try {
        const targetArg = targetArgId ? this.session.arguments.find(a => a.id === targetArgId) : null
        // AgentLoopProgress — не пишем в session.events, только в onEvent
        const onProgress = (evt) => this.onEvent({ type: 'AgentLoopProgress', ...evt, ts: Date.now() })
        arg = await runAgentLoop(
          agent, type, this.room, project,
          targetArg, this.session,
          { speedProfile: this.session.speedProfile, modelOverrides: this.session.modelOverrides },
          onProgress
        )
        // Публикуем в DebateRoom чтобы другие агенты видели (если ещё не опубликован изнутри loop)
        if (arg) {
          this.room.publish(agent.id, arg)
          // Событие: агент вызывал инструменты
          if (arg.toolsUsed?.length) {
            this.emit('AgentToolsUsed', { agentId: agent.id, tools: arg.toolsUsed, iterations: arg.iterCount })
          }
        }
      } catch (e) {
        console.warn('[FstCommitteeEngine] AgentLoop failed, fallback:', e.message)
      }
    }

    // ── ВЕТКА 2: Классический одиночный LLM-вызов (существующее поведение) ──
    if (useAI && !arg) {
      try {
        const kagCtx = type === 'OPENING' ? (this.session._kagContext || '') : ''
        arg = await generateArgumentAI(agent, type, project, this.session.arguments, targetArgId, kagCtx, {
          speedProfile:   this.session.speedProfile,
          modelOverrides: this.session.modelOverrides,
        })
      } catch (e) {
        console.warn('[FstCommitteeEngine] generateArgumentAI failed, fallback:', e.message)
      }
    }

    // ── ВЕТКА 3: Шаблонный fallback ──────────────────────────────────────────
    if (!arg) {
      console.warn(`[Engine] ${agent.id} type=${type}: ALL LLM branches failed → template fallback`)
      await this.delay(TIMING.THINKING_DURATION)
      arg = generateArgument(agent, type, project, targetArgId)
    } else {
      console.info(`[Engine] ${agent.id} type=${type}: arg generated agentLoop=${arg.agentLoop||false} tools=${arg.toolsUsed?.join(',')||'none'}`)
    }

    if (thinkInterval) clearInterval(thinkInterval)
    this._setPipeline(agent.id, { llm: 'done', save: 'active' })
    this._setAgentStatus(agent.id, { thinking: false, thinkText: '' })

    if (!arg) { this._setPipeline(agent.id, { save: 'error' }); return null }

    // ── Аннотируем онтологическими метаданными ───────────────────────────────
    const annotated = annotateArg(arg, this.session.arguments)

    this.session.arguments.push(annotated)
    this._syncPublish(agent.id, annotated)
    this._setPipeline(agent.id, { save: 'done' })
    this.emit('ArgumentRaised', {
      argument:    annotated,
      agentId:     agent.id,
      argType:     type,
      aiGenerated: annotated.aiGenerated || false,
      agentLoop:   annotated.agentLoop   || false,
    })

    await this.delay(TIMING.ARGUMENT_DELAY)
    return annotated
  }

  _transitionPhase(phase) {
    const prev = this.session.phase
    this.session.phase = phase
    this.session.phaseIndex = PHASE_ORDER.indexOf(phase)
    this.emit('PhaseTransitioned', { prevPhase: prev, nextPhase: phase })
    this._syncPhase(phase)
  }

  _setAgentStatus(agentId, update) {
    this.session.agentStatus[agentId] = {
      ...this.session.agentStatus[agentId],
      ...update,
    }
    this.emit('AgentStatusChanged', { agentId, status: this.session.agentStatus[agentId] })
  }

  _setPipeline(agentId, pipelineUpdate) {
    const current = this.session.agentStatus[agentId]?.pipeline || {}
    this._setAgentStatus(agentId, { pipeline: { ...current, ...pipelineUpdate } })
  }

  _buildVoteRationale(agent, score, verdict) {
    const pct = Math.round(score * 100)
    const prefix = verdict === 'APPROVE' ? 'Поддерживаю' : verdict === 'REJECT' ? 'Отклоняю' : 'Рекомендую отложить'
    // Если у агента есть SUMMARY аргумент — цитируем его
    const summaryArg = this.session.arguments.filter(a => a.agentId === agent.id && a.type === 'SUMMARY').slice(-1)[0]
    if (summaryArg?.text) {
      return `${prefix}: "${summaryArg.text.slice(0, 120)}${summaryArg.text.length > 120 ? '...' : ''}" — итог дебатов, балл ${pct}/100.`
    }
    return `${prefix}: итоговый балл ${pct}/100 с позиции ${agent.name.toLowerCase()}.`
  }

  _buildConditions(project, score) {
    const conditions = []
    // Базовые условия из проекта (с вариативными формулировками)
    const mrlTemplates = [
      `Предоставить роуд-мэп по MRL до уровня 5+ в течение 6 месяцев (текущий MRL: ${project.mrl})`,
      `Достичь MRL 5+ с подтверждением производственного партнёра (текущий MRL: ${project.mrl})`,
      `Разработать план выхода на серийное производство, MRL ${project.mrl} → 5+ за 6 мес`,
    ]
    const locTemplates = [
      `Разработать план импортозамещения критических компонентов (текущая локализация: ${Math.round((project.localizationRatio||0)*100)}%)`,
      `Увеличить долю отечественных компонентов до 60%+ (сейчас ${Math.round((project.localizationRatio||0)*100)}%)`,
      `Представить road-map импортозамещения с конкретными поставщиками (локализация: ${Math.round((project.localizationRatio||0)*100)}%)`,
    ]
    const trlTemplates = [
      `Провести независимую экспертизу TRL перед траншем A (текущий TRL: ${project.trl})`,
      `Подтвердить TRL ${project.trl} → ${project.trl + 1} у аккредитованной лаборатории`,
      `Достичь TRL ${Math.min(project.trl + 2, 9)} до следующего транша с независимой верификацией`,
    ]
    const teamTemplates = [
      `Усилить команду профильными специалистами (текущая: ${project.employees} чел.)`,
      `Нанять CTO/VP Engineering с опытом масштабирования (команда: ${project.employees} чел.)`,
      `Расширить R&D команду до ${project.employees + 5}+ специалистов`,
    ]
    const pick = arr => arr[Math.floor(Math.random() * arr.length)]

    if (project.mrl < 5) conditions.push(pick(mrlTemplates))
    if (project.localizationRatio < 0.6) conditions.push(pick(locTemplates))
    if (project.trl < 6) conditions.push(pick(trlTemplates))
    if (project.employees < 15) conditions.push(pick(teamTemplates))
    const _at = (this.session.icParams?.approveThreshold || 72) / 100
    const _dt = (this.session.icParams?.deferThreshold || 50) / 100
    if (score >= _dt && score < _at) conditions.push(`Подтвердить финансовую модель у 2 независимых аналитиков (текущий скоринг: ${Math.round(score*100)}/100)`)

    // Условия из CHALLENGE/COUNTER аргументов — реальные риски, поднятые в дебатах
    const debateArgs = this.session.arguments
      .filter(a => a.type === 'CHALLENGE' || a.type === 'COUNTER')
    const challengeTexts = debateArgs.map(a => a.text || '')

    const debatePatterns = [
      { re: /патент|IP|интеллектуальн/i, guard: /патент/i, templates: [
        'Подтвердить патентную чистоту технологии до закрытия сделки',
        'Провести IP-аудит и зарегистрировать ключевые патенты',
        'Получить заключение патентного поверенного о свободе от претензий',
      ]},
      { re: /партнёр|производств|контракт/i, guard: /производств|партнёр/i, templates: [
        'Предоставить LOI от производственного партнёра',
        'Заключить предварительное соглашение с производственной площадкой',
        'Подтвердить наличие производственных мощностей для серии',
      ]},
      { re: /cash.?flow|денежн.*поток|кассов|burn/i, guard: /cash|burn/i, templates: [
        'Предоставить детальную помесячную cash-flow модель на 18 месяцев',
        'Подготовить финансовый план с учётом текущего burn rate',
        'Обосновать runway и точку безубыточности с помесячной детализацией',
      ]},
      { re: /сертифик|лицензи|разрешен|регулятор/i, guard: /сертифик|лицензи/i, templates: [
        'Получить необходимые сертификаты и лицензии до транша B',
        'Представить план сертификации продукции с конкретными сроками',
      ]},
      { re: /конкурент|аналог|рынок.*насыщ/i, guard: /конкурент/i, templates: [
        'Провести детальный конкурентный анализ с бенчмарками',
        'Подтвердить конкурентное преимущество независимой экспертизой',
      ]},
      { re: /масштаб|scale|growth|рост/i, guard: /масштаб|scale/i, templates: [
        'Представить план масштабирования с unit-экономикой на 3 года',
        'Подтвердить возможность масштабирования пилотными контрактами',
      ]},
    ]

    for (const pattern of debatePatterns) {
      if (challengeTexts.some(t => pattern.re.test(t)) && !conditions.some(c => pattern.guard.test(c))) {
        conditions.push(pick(pattern.templates))
      }
    }

    // Прямые цитаты из высококонфидентных CHALLENGE аргументов (уникальные условия)
    const highConfChallenges = debateArgs
      .filter(a => a.type === 'CHALLENGE' && (a.confidence || 0) >= 0.75 && a.text?.length > 30)
    if (highConfChallenges.length > 0 && conditions.length < 5) {
      const picked = highConfChallenges[Math.floor(Math.random() * highConfChallenges.length)]
      const short = picked.text.split(/[.!?]/)[0].trim()
      if (short.length > 15 && short.length < 120 && !conditions.some(c => c.includes(short.slice(0, 20)))) {
        conditions.push(`Устранить риск: ${short}`)
      }
    }

    if (conditions.length === 0) conditions.push('Стандартная отчётность по KPI ежеквартально')
    // Перемешиваем порядок для вариативности между запусками
    for (let i = conditions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [conditions[i], conditions[j]] = [conditions[j], conditions[i]]
    }
    return conditions.slice(0, 5)
  }

  _buildKeyRisks(project) {
    const risks = [...project.risks]
    if (project.trl < 6) risks.push('Технологический: высокий риск не выхода из R&D фазы')
    if (project.sovereigntyScore < 6) risks.push('Санкционный: зависимость от импортных компонентов')
    if (project.marketSize < 5e9) risks.push('Рыночный: объём рынка ниже порога ФСТ (5 млрд руб)')
    return risks.slice(0, 5)
  }
}
