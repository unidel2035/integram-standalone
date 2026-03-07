/**
 * FstCommitteeEngine — State machine for AI Investment Committee simulation
 *
 * Phases: IDLE → LOADING → PRIMARY_POSITIONS → CROSS_DEBATE
 *         → FINAL_POSITIONS → VOTING → SYNTHESIS → HUMAN_APPROVAL → CONCLUDED
 *
 * Emits events via onEvent(event) callback for UI rendering
 */

import {
  AGENTS, SCORING_DIMS, ARGUMENT_TEMPLATES,
  PHASES, PHASE_ORDER, VERDICTS, TIMING, SPEED_MULTIPLIERS,
  RECOMMENDATION_TEMPLATES, REVISION_SIMULATION_STEPS, METRIC_FIELD_MAP, METRIC_CLAMP,
} from './FstCommitteeConfig.js'
import { generateArgumentAI, fetchKagContext, clearKagCache, generateNodeProposalAI, generateNodeVoteAI } from './fstCommitteeAI.js'
import { annotateArg } from './fstCommitteeOntology.js'
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

function scoreToVerdict(score) {
  if (score >= 0.72) return 'APPROVE'
  if (score >= 0.50) return 'DEFER'
  return 'REJECT'
}

// ── Recommendation Generator ──────────────────────────────────

function generateRecommendations(decision, project) {
  const verdict = decision.recommendation
  const key = verdict  // APPROVE | DEFER | REJECT
  const recs = []
  for (const agent of AGENTS) {
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
    project,
    phase: 'IDLE',
    phaseIndex: 0,
    speed,
    useAI: options.useAI !== false,   // по умолчанию включён
    // Настройки оркестратора моделей
    speedProfile:   options.speedProfile   || 'fast',
    modelOverrides: options.modelOverrides || {},  // { [agentId]: modelId }
    roundNumber: project._roundNumber || 1,
    agents: AGENTS,
    arguments: [],
    votes: [],
    decision: null,
    recommendations: [],
    revisionProgress: 0,        // 0..1 during REVISION phase
    revisionStep: '',
    revisedProject: null,       // project after applying recs
    agentStatus: Object.fromEntries(AGENTS.map(a => [a.id, { thinking: false, done: false, thinkText: '', pipeline: { integram: 'idle', calc: 'idle', llm: 'idle', save: 'idle' } }])),
    dimScores: computeDimScores(project),
    agentScores: [],
    events: [],
    startedAt: null,
    concludedAt: null,
    nodeProposals:  [],   // предложения агентов по нодам
    contractNodes:  [],   // финальные согласованные ноды
    nodeVotes:      [],   // протокол голосования по нодам
  }
}

// ── Engine ────────────────────────────────────────────────────

export class FstCommitteeEngine {
  constructor(session, onEvent) {
    this.session = session
    this.onEvent = onEvent || (() => {})
    this._timers = []
    this._running = false
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
  }

  async start() {
    this._running = true
    this.session.startedAt = Date.now()
    this.emit('SessionStarted', { sessionId: this.session.id })

    // Загружаем KAG-контекст прошлых решений (не блокирует старт)
    clearKagCache()
    if (this.session.useAI) {
      fetchKagContext(this.session.project).then(ctx => {
        this.session._kagContext = ctx || ''
      }).catch(() => { this.session._kagContext = '' })
    }

    try {
      await this._phaseLoading()
      if (!this._running) return
      await this._phasePrimaryPositions()
      if (!this._running) return
      await this._phaseCrossDebate()
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
    const agentPromises = AGENTS.map(async (agent, idx) => {
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
    await this.delay(TIMING.PHASE_TRANSITION_DELAY)

    for (const agent of AGENTS) {
      if (!this._running) return
      await this._agentSpeak(agent, 'OPENING')
    }

    await this.delay(TIMING.PHASE_TRANSITION_DELAY)
  }

  // ── Phase: CROSS_DEBATE ───────────────────────────────────

  async _phaseCrossDebate() {
    this._transitionPhase('CROSS_DEBATE')
    await this.delay(TIMING.PHASE_TRANSITION_DELAY)

    // 3 rounds of cross-challenges
    for (let round = 0; round < 3; round++) {
      if (!this._running) return
      // Pick 2-3 agents to challenge each round
      const challengers = [...AGENTS].sort(() => Math.random() - 0.5).slice(0, 3)
      for (const agent of challengers) {
        if (!this._running) return
        // Challenge — target a random OPENING from a different agent
        const openings = this.session.arguments.filter(a => a.type === 'OPENING' && a.agentId !== agent.id)
        const targetOpening = openings.length ? openings[Math.floor(Math.random() * openings.length)] : null
        const arg = await this._agentSpeak(agent, 'CHALLENGE', targetOpening?.id || null)
        if (!arg) continue
        await this.delay(TIMING.ARGUMENT_DELAY)

        // One random other agent counters
        const counterAgent = AGENTS.find(a => a.id !== agent.id && Math.random() > 0.4)
        if (counterAgent && this._running) {
          await this._agentSpeak(counterAgent, 'COUNTER', arg.id)
        }
      }
    }

    await this.delay(TIMING.PHASE_TRANSITION_DELAY)
  }

  // ── Phase: FINAL_POSITIONS ────────────────────────────────

  async _phaseFinalPositions() {
    this._transitionPhase('FINAL_POSITIONS')
    await this.delay(TIMING.PHASE_TRANSITION_DELAY)

    for (const agent of AGENTS) {
      if (!this._running) return
      await this._agentSpeak(agent, 'SUMMARY')
    }

    await this.delay(TIMING.PHASE_TRANSITION_DELAY)
  }

  // ── Phase: VOTING ─────────────────────────────────────────

  async _phaseVoting() {
    this._transitionPhase('VOTING')
    this.emit('VotingStarted')
    await this.delay(TIMING.PHASE_TRANSITION_DELAY)

    const dimScores = this.session.dimScores
    const agentVotes = []

    for (const agent of AGENTS) {
      if (!this._running) return
      await this.delay(TIMING.VOTE_DELAY)

      const score = agentScore(agent, dimScores)
      const verdict = scoreToVerdict(score)
      const confidence = clamp(Math.abs(score - 0.6) * 2 + 0.4, 0.4, 1.0)

      const vote = {
        id: `vote_${agent.id}_${Date.now()}`,
        agentId: agent.id,
        verdict,
        score: Math.round(score * 100),
        confidence,
        rationale: this._buildVoteRationale(agent, score, verdict),
      }

      this.session.votes.push(vote)
      agentVotes.push({ agent, score, verdict })
      this.emit('VoteCast', { vote })

      this._setAgentStatus(agent.id, {
        vote: verdict,
        voteScore: Math.round(score * 100),
      })
    }

    this.session.agentScores = agentVotes
    this.emit('AllVotesCast', { votes: this.session.votes })
    await this.delay(TIMING.PHASE_TRANSITION_DELAY)
  }

  // ── Phase: SYNTHESIS ──────────────────────────────────────

  async _phaseSynthesis() {
    this._transitionPhase('SYNTHESIS')
    await this.delay(TIMING.PHASE_TRANSITION_DELAY)

    const agentScores = this.session.agentScores
    const agg = aggregateScore(agentScores)
    const recommendation = scoreToVerdict(agg)

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
    this.emit('DecisionFormed', { decision })
    await this.delay(TIMING.PHASE_TRANSITION_DELAY)
    this.emit('DecisionPublished', { decision })
    await this.delay(TIMING.PHASE_TRANSITION_DELAY)
  }

  // ── Phase: HUMAN_APPROVAL ─────────────────────────────────

  async _phaseHumanApproval() {
    this._transitionPhase('HUMAN_APPROVAL')
    this.emit('HumanApprovalRequested', { decision: this.session.decision })
    // Engine waits here — human interaction is via humanDecide()
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

    // Раунд 1: каждый агент предлагает параметры нод
    for (const agent of AGENTS) {
      if (!this._running) return
      this._setAgentStatus(agent.id, { thinking: true, thinkText: 'Формирую ноды контракта...' })
      let proposal = null
      try {
        proposal = await generateNodeProposalAI(agent, project, this.session.nodeProposals, 1)
      } catch { /* fallback ниже */ }

      if (!proposal) proposal = this._fallbackNodeProposal(agent, project, 1)
      this.session.nodeProposals.push(proposal)
      this._setAgentStatus(agent.id, { thinking: false, thinkText: '' })
      this.emit('NodeProposed', { agentId: agent.id, proposal, round: 1 })
      await this.delay(500)
    }

    // Раунд 2: 3 агента вносят правки (challenge)
    const challengers = [...AGENTS].sort(() => Math.random() - 0.5).slice(0, 3)
    for (const agent of challengers) {
      if (!this._running) return
      this._setAgentStatus(agent.id, { thinking: true, thinkText: 'Уточняю параметры...' })
      let proposal = null
      try {
        proposal = await generateNodeProposalAI(agent, project, this.session.nodeProposals, 2)
      } catch { /* fallback */ }

      if (!proposal) proposal = this._fallbackNodeProposal(agent, project, 2)
      this.session.nodeProposals.push(proposal)
      this._setAgentStatus(agent.id, { thinking: false, thinkText: '' })
      this.emit('NodeProposed', { agentId: agent.id, proposal, round: 2, type: 'CHALLENGE' })
      await this.delay(400)
    }

    // Синтез: взвешенное среднее предложений → 3 финальных ноды
    const finalNodes = this._synthesizeNodes(this.session.nodeProposals, project)
    this.session.contractNodes = finalNodes
    this.emit('NodesSynthesized', { nodes: finalNodes })
    await this.delay(TIMING.PHASE_TRANSITION_DELAY)
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
      for (const agent of AGENTS) {
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

  _fallbackNodeProposal(agent, project, round) {
    const ic  = Math.round((project.askRub || 100_000_000) / 1_000_000)
    const irr = project.projectedIRR || 0.30
    const mult = agent.bias === 'optimist' ? 1.15 : agent.bias === 'pessimist' ? 0.85 : 1.0
    const makeCf = (baseMult) => {
      const base = ic * irr * baseMult
      return [1, 2, 3, 4, 5].map(t => +(base * t / 5 * mult).toFixed(1))
    }
    return {
      agentId: agent.id,
      round,
      nodes: {
        pessimistic: { ic: Math.round(ic * 1.2), wacc: 22, cf: makeCf(0.55), expectedIrr: 12, rationale: 'Консервативная оценка' },
        base:        { ic,                        wacc: 18, cf: makeCf(1.0),  expectedIrr: Math.round(irr * 100), rationale: 'Базовый сценарий' },
        optimistic:  { ic: Math.round(ic * 0.85), wacc: 14, cf: makeCf(1.45), expectedIrr: Math.round(irr * 100 * 1.4), rationale: 'Оптимистичный' },
      }
    }
  }

  _synthesizeNodes(proposals, project) {
    const scenarios = ['pessimistic', 'base', 'optimistic']
    const labels    = { pessimistic: 'Консервативный', base: 'Базовый', optimistic: 'Оптимистичный' }
    const probs     = { pessimistic: 25, base: 50, optimistic: 25 }

    return scenarios.map(sc => {
      // Средние по всем предложениям
      const scProposals = proposals.map(p => p.nodes?.[sc]).filter(Boolean)
      const n = scProposals.length || 1
      const ic   = Math.round(scProposals.reduce((s, p) => s + (p.ic || 100), 0) / n)
      const wacc = +(scProposals.reduce((s, p) => s + (p.wacc || 18), 0) / n).toFixed(1)
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
    const project  = this.session.project
    const useAI    = this.session.useAI !== false  // default: true

    // ── Pipeline Step 1: Integram — читаем данные проекта ──────────────────────
    this._setPipeline(agent.id, { integram: 'done', calc: 'active' })

    // ── Thinking: показываем анимацию пока идёт LLM-вызов ──
    this._setAgentStatus(agent.id, { thinking: true, thinkText: pick(agent.thinkingPhrases) })

    // Меняем фразу в процессе долгого AI-вызова
    let thinkInterval = null
    if (useAI) {
      let phraseIdx = 1
      thinkInterval = setInterval(() => {
        if (!this._running) { clearInterval(thinkInterval); return }
        const phrase = agent.thinkingPhrases[phraseIdx % agent.thinkingPhrases.length]
        this._setAgentStatus(agent.id, { thinkText: phrase })
        phraseIdx++
      }, 2500)
    } else {
      await this.delay(TIMING.THINKING_DURATION)
    }

    let arg = null

    // ── Pipeline Step 2: LLM ─────────────────────────────────────────────────
    this._setPipeline(agent.id, { calc: 'done', llm: 'active' })

    // ── AI-first: реальный LLM-вызов ──
    if (useAI) {
      try {
        const kagCtx = type === 'OPENING' ? (this.session._kagContext || '') : ''
        arg = await generateArgumentAI(agent, type, project, this.session.arguments, targetArgId, kagCtx, {
          speedProfile:   this.session.speedProfile,
          modelOverrides: this.session.modelOverrides,
        })
      } catch (e) {
        console.warn('[FstCommitteeEngine] AI call failed, falling back to template:', e.message)
      }
    }

    // ── Fallback: шаблонный аргумент ──
    if (!arg) {
      await this.delay(TIMING.THINKING_DURATION)
      arg = generateArgument(agent, type, project, targetArgId)
    }

    if (thinkInterval) clearInterval(thinkInterval)
    // ── Pipeline Step 3: Сохраняем аргумент ──────────────────────────────────
    this._setPipeline(agent.id, { llm: 'done', save: 'active' })
    this._setAgentStatus(agent.id, { thinking: false, thinkText: '' })

    if (!arg) { this._setPipeline(agent.id, { save: 'error' }); return null }

    // ── Аннотируем онтологическими метаданными ──
    const annotated = annotateArg(arg, this.session.arguments)

    this.session.arguments.push(annotated)
    this._setPipeline(agent.id, { save: 'done' })
    this.emit('ArgumentRaised', {
      argument:    annotated,
      agentId:     agent.id,
      argType:     type,
      aiGenerated: annotated.aiGenerated || false,
    })

    await this.delay(TIMING.ARGUMENT_DELAY)
    return annotated
  }

  _transitionPhase(phase) {
    const prev = this.session.phase
    this.session.phase = phase
    this.session.phaseIndex = PHASE_ORDER.indexOf(phase)
    this.emit('PhaseTransitioned', { prevPhase: prev, nextPhase: phase })
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
    const project = this.session.project
    const pct = Math.round(score * 100)
    const prefix = verdict === 'APPROVE' ? 'Поддерживаю' : verdict === 'REJECT' ? 'Отклоняю' : 'Рекомендую отложить'
    return `${prefix}: итоговый балл ${pct}/100 с позиции ${agent.name.toLowerCase()}.`
  }

  _buildConditions(project, score) {
    const conditions = []
    if (project.mrl < 5) conditions.push('Предоставить роуд-мэп по MRL до уровня 5+ в течение 6 месяцев')
    if (project.localizationRatio < 0.6) conditions.push('Разработать план импортозамещения критических компонентов')
    if (project.trl < 6) conditions.push('Провести независимую экспертизу TRL перед траншем A')
    if (project.employees < 15) conditions.push('Усилить команду профильными специалистами')
    if (score >= 0.5 && score < 0.72) conditions.push('Подтвердить финансовую модель у 2 независимых аналитиков')
    if (conditions.length === 0) conditions.push('Стандартная отчётность по KPI ежеквартально')
    return conditions
  }

  _buildKeyRisks(project) {
    const risks = [...project.risks]
    if (project.trl < 6) risks.push('Технологический: высокий риск не выхода из R&D фазы')
    if (project.sovereigntyScore < 6) risks.push('Санкционный: зависимость от импортных компонентов')
    if (project.marketSize < 5e9) risks.push('Рыночный: объём рынка ниже порога ФСТ (5 млрд руб)')
    return risks.slice(0, 5)
  }
}
