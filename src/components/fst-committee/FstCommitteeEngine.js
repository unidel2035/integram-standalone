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
import { generateArgumentAI, fetchKagContext, clearKagCache } from './fstCommitteeAI.js'
import { annotateArg } from './fstCommitteeOntology.js'

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
    roundNumber: project._roundNumber || 1,
    agents: AGENTS,
    arguments: [],
    votes: [],
    decision: null,
    recommendations: [],
    revisionProgress: 0,        // 0..1 during REVISION phase
    revisionStep: '',
    revisedProject: null,       // project after applying recs
    agentStatus: Object.fromEntries(AGENTS.map(a => [a.id, { thinking: false, done: false, thinkText: '' }])),
    dimScores: computeDimScores(project),
    agentScores: [],
    events: [],
    startedAt: null,
    concludedAt: null,
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
        // Challenge
        const arg = await this._agentSpeak(agent, 'CHALLENGE')
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
    this._transitionPhase('CONCLUDED')
    this.session.concludedAt = Date.now()
    this.emit('SessionConcluded', {
      sessionId: this.session.id,
      finalVerdict: verdict,
      score: this.session.decision.aggregatedScore,
    })

    // Auto-generate recommendations (always, for any verdict)
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

  // ── Helpers ───────────────────────────────────────────────

  async _agentSpeak(agent, type, targetArgId = null) {
    if (!this._running) return null
    const project  = this.session.project
    const useAI    = this.session.useAI !== false  // default: true

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

    // ── AI-first: реальный LLM-вызов ──
    if (useAI) {
      try {
        const kagCtx = type === 'OPENING' ? (this.session._kagContext || '') : ''
        arg = await generateArgumentAI(agent, type, project, this.session.arguments, targetArgId, kagCtx)
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
    this._setAgentStatus(agent.id, { thinking: false, thinkText: '' })

    if (!arg) return null

    // ── Аннотируем онтологическими метаданными ──
    const annotated = annotateArg(arg, this.session.arguments)

    this.session.arguments.push(annotated)
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
