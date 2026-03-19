<template>
  <div class="dt-root" ref="rootEl">

    <!-- Filter bar -->
    <div class="dt-filters">
      <button v-for="f in FILTERS" :key="f.id"
        :class="['dt-filter-btn', { 'dt-filter-btn--active': activeFilter === f.id }]"
        @click="activeFilter = f.id">
        <i :class="f.icon"></i> {{ f.label }}
        <span v-if="f.count" class="dt-filter-count">{{ f.count }}</span>
      </button>
      <span class="dt-filter-sep"></span>
      <span class="dt-total">{{ visibleItems.length }} событий</span>
    </div>

    <!-- Event stream -->
    <div class="dt-stream" ref="streamEl">
      <TransitionGroup name="dt-item" tag="div" class="dt-items">

        <template v-for="item in visibleItems" :key="item._key">

          <!-- Phase separator -->
          <div v-if="item.kind === 'phase'" class="dt-phase-sep">
            <div class="dt-phase-line"></div>
            <div class="dt-phase-badge" :style="{ background: item.color }">
              <i :class="item.icon"></i> {{ item.label }}
            </div>
            <div class="dt-phase-line"></div>
          </div>

          <!-- Session start / conclude -->
          <div v-else-if="item.kind === 'session'" class="dt-session-banner" :style="{ borderColor: item.color }">
            <i :class="item.icon" :style="{ color: item.color }"></i>
            <div class="dt-session-text">
              <strong>{{ item.text }}</strong>
              <span v-if="item.subtext">{{ item.subtext }}</span>
            </div>
            <span class="dt-ts">{{ item.time }}</span>
          </div>

          <!-- System event (tool call, tag, link, etc.) -->
          <div v-else-if="item.kind === 'system'" class="dt-sys-event">
            <span class="dt-sys-dot" :style="{ background: item.color }"></span>
            <i :class="item.icon" :style="{ color: item.color, fontSize: '11px' }"></i>
            <span class="dt-sys-text">{{ item.text }}</span>
            <span v-if="item.subtext" class="dt-sys-sub">{{ item.subtext }}</span>
            <span class="dt-ts">{{ item.time }}</span>
          </div>

          <!-- Agent action (analysis, pipeline step) -->
          <div v-else-if="item.kind === 'agent_op'" class="dt-agent-op">
            <span class="dt-agent-avatar">{{ item.avatar }}</span>
            <span class="dt-agent-name" :style="{ color: item.color }">{{ item.agentName }}</span>
            <i :class="item.icon" style="font-size:10px;color:#6b7280"></i>
            <span class="dt-agent-op-text">{{ item.text }}</span>
            <span v-if="item.pipeline" class="dt-pipeline">
              <span v-for="step in item.pipeline" :key="step.id"
                :class="['dt-pipe-step', `dt-pipe-step--${step.state}`]"
                :title="step.label">
                <i :class="step.icon" style="font-size:8px"></i>
              </span>
            </span>
            <span class="dt-ts">{{ item.time }}</span>
          </div>

          <!-- Alert -->
          <div v-else-if="item.kind === 'alert'" class="dt-alert">
            <i class="pi pi-exclamation-triangle" style="color:#ffa726"></i>
            <span>{{ item.text }}</span>
          </div>

          <!-- Argument card (full) -->
          <div v-else-if="item.kind === 'argument'"
            :class="['dt-argument', `dt-arg--${item.argType?.toLowerCase()}`,
              item.targetArgId ? 'dt-argument--reply' : '']">
            <div class="dt-arg-header">
              <span class="dt-arg-avatar">{{ item.avatar }}</span>
              <span class="dt-arg-name" :style="{ color: item.agentColor }">{{ item.agentName }}</span>
              <span class="dt-arg-type" :style="{ background: item.agentColor + '22', color: item.agentColor }">
                {{ item.typeLabel }}
              </span>
              <span class="dt-arg-dim">{{ item.dimension }}</span>
              <span v-if="item.aiGenerated" class="dt-arg-ai">
                <i class="pi pi-bolt"></i> {{ item.modelShort || 'AI' }}
              </span>
              <span class="dt-ts">{{ item.time }}</span>
            </div>
            <!-- Reply quote -->
            <div v-if="item.replyText" class="dt-arg-reply">
              <span class="dt-reply-who" :style="{ color: item.replyColor }">{{ item.replyName }}:</span>
              {{ item.replyText }}
            </div>
            <div class="dt-arg-text">{{ item.text }}</div>

            <!-- Tool calls block -->
            <div v-if="item.toolsUsed?.length" class="dt-tools-block">
              <button class="dt-tools-toggle" @click.stop="toggleTools(item._key)">
                <i class="pi pi-wrench"></i>
                <span>{{ item.toolsUsed.length }} инструм.</span>
                <i :class="expandedTools.has(item._key) ? 'pi pi-chevron-up' : 'pi pi-chevron-down'" style="font-size:8px;margin-left:2px"></i>
              </button>
              <div :class="['dt-tools-list', { 'dt-tools-list--expanded': expandedTools.has(item._key) }]">
                <div v-for="(tool, ti) in item.toolsUsed" :key="ti" class="dt-tool-row">
                  <i :class="TOOL_META[tool]?.icon || 'pi pi-cog'"
                    :style="{ color: TOOL_META[tool]?.color || '#888', fontSize: '9px' }"></i>
                  <span class="dt-tool-name" :style="{ color: TOOL_META[tool]?.color || '#888' }">{{ tool }}</span>
                  <span class="dt-tool-iter">iter {{ ti + 1 }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Vote card -->
          <div v-else-if="item.kind === 'vote'" class="dt-vote">
            <span class="dt-agent-avatar">{{ item.avatar }}</span>
            <span class="dt-agent-name" :style="{ color: item.agentColor }">{{ item.agentName }}</span>
            <span class="dt-verdict-pill" :style="{ background: item.verdictColor }">
              {{ item.verdictLabel }}
            </span>
            <span class="dt-vote-score">{{ item.score }}/100</span>
            <div class="dt-vote-bar">
              <div :style="{ width: item.score + '%', background: item.verdictColor }"></div>
            </div>
            <span class="dt-ts">{{ item.time }}</span>
          </div>

          <!-- Decision card -->
          <div v-else-if="item.kind === 'decision'" class="dt-decision" :style="{ borderColor: item.color }">
            <div class="dt-decision-header">
              <i class="pi pi-gavel" :style="{ color: item.color }"></i>
              <strong>Решение ИК</strong>
              <span class="dt-decision-score" :style="{ color: item.color }">{{ item.score }}/100</span>
              <span class="dt-verdict-pill" :style="{ background: item.color }">{{ item.verdictLabel }}</span>
              <span class="dt-ts">{{ item.time }}</span>
            </div>
            <div v-if="item.votes" class="dt-decision-votes">
              <span v-for="(cnt, v) in item.votes" :key="v" v-show="cnt > 0"
                class="dt-dvote" :style="{ background: VERDICTS[v]?.color }">
                {{ VERDICTS[v]?.label }}: {{ cnt }}
              </span>
            </div>
            <div v-if="item.conditions?.length" class="dt-decision-conds">
              <span v-for="c in item.conditions.slice(0,2)" :key="c" class="dt-cond">{{ c }}</span>
            </div>
          </div>

          <!-- Node proposal -->
          <div v-else-if="item.kind === 'node'" class="dt-node-proposal">
            <span class="dt-agent-avatar">{{ item.avatar }}</span>
            <span class="dt-agent-name" :style="{ color: item.agentColor }">{{ item.agentName }}</span>
            <i class="pi pi-file-edit" style="font-size:10px;color:#66bb6a"></i>
            <span style="font-size:11px;color:#66bb6a">Предложение ноды</span>
            <span v-if="item.round" class="dt-sys-sub">раунд {{ item.round }}</span>
            <span class="dt-ts">{{ item.time }}</span>
          </div>

        </template>

        <!-- Running indicator -->
        <div v-if="running" key="__running" class="dt-running">
          <span class="dt-running-dot"></span>
          <span class="dt-running-dot"></span>
          <span class="dt-running-dot"></span>
        </div>

      </TransitionGroup>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import { PHASES, VERDICTS } from './FstCommitteeConfig.js'
import { agents } from './agentProvider.js'

const TOOL_META = {
  query_data:       { icon: 'pi pi-database',   label: 'query_data',       color: '#42a5f5' },
  read_room:        { icon: 'pi pi-comments',    label: 'read_room',        color: '#66bb6a' },
  calc_irr:         { icon: 'pi pi-percentage',  label: 'calc_irr',         color: '#ff9800' },
  calc_npv:         { icon: 'pi pi-chart-line',  label: 'calc_npv',         color: '#ff9800' },
  calc_monte_carlo: { icon: 'pi pi-chart-bar',   label: 'calc_monte_carlo', color: '#ab47bc' },
  calc_power_score: { icon: 'pi pi-star',        label: 'calc_power_score', color: '#ef5350' },
  calc_bayesian:    { icon: 'pi pi-sync',        label: 'calc_bayesian',    color: '#26c6da' },
  search_precedents:{ icon: 'pi pi-search',      label: 'search_precedents',color: '#8b5cf6' },
  web_search:       { icon: 'pi pi-globe',       label: 'web_search',       color: '#4caf50' },
  memory_search:    { icon: 'pi pi-brain',       label: 'memory_search',    color: '#7c4dff' },
  exec_code:        { icon: 'pi pi-code',        label: 'exec_code',        color: '#ff5722' },
}

// Множество _key аргументов с раскрытым блоком инструментов
const expandedTools = ref(new Set())
function toggleTools(key) {
  const s = new Set(expandedTools.value)
  s.has(key) ? s.delete(key) : s.add(key)
  expandedTools.value = s
}

const props = defineProps({
  session: { type: Object, default: null },
  running: { type: Boolean, default: false },
})

const streamEl    = ref(null)
const activeFilter = ref('all')

// ── Agent map ──────────────────────────────────────────────────
const AGENT_MAP = computed(() => Object.fromEntries(agents.value.map(a => [a.id, a])))

// ── Argument type labels ───────────────────────────────────────
const ARG_TYPE_LABEL = {
  OPENING: 'Позиция', CHALLENGE: 'Вызов', COUNTER: 'Контраргумент',
  SUMMARY: 'Итог', SYNTHESIS: 'Синтез', CLOSING: 'Заключение',
}

// ── Pipeline step config ───────────────────────────────────────
const PIPELINE_STEPS = [
  { id: 'integram', label: 'БД', icon: 'pi pi-database' },
  { id: 'calc',     label: 'Расчёт', icon: 'pi pi-calculator' },
  { id: 'llm',      label: 'LLM',  icon: 'pi pi-bolt' },
  { id: 'save',     label: 'Сохранение', icon: 'pi pi-save' },
]

// ── Skipped event types (too noisy) ───────────────────────────
const SKIP = new Set(['AgentStatusChanged', 'AgentLoopProgress'])

// ── Filter config ──────────────────────────────────────────────
const FILTERS = computed(() => {
  const events = props.session?.events || []
  const args   = props.session?.arguments || []
  const votes  = props.session?.votes || []
  return [
    { id: 'all',       label: 'Все события',  icon: 'pi pi-list',         count: events.filter(e => !SKIP.has(e.type)).length },
    { id: 'arguments', label: 'Аргументы',    icon: 'pi pi-comments',     count: args.length },
    { id: 'votes',     label: 'Голоса',       icon: 'pi pi-check-square', count: votes.length },
    { id: 'system',    label: 'Система',      icon: 'pi pi-cog',          count: null },
  ]
})

// ── Format timestamp ───────────────────────────────────────────
function fmt(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`
}

// ── Build unified timeline items ───────────────────────────────
const allItems = computed(() => {
  if (!props.session) return []

  // eslint-disable-next-line no-unused-vars
  const _tick = props.session._tick  // явная зависимость — пересчёт при каждом событии

  const session = props.session
  const events  = session.events || []
  const argMap  = Object.fromEntries((session.arguments || []).map(a => [a.id, a]))
  const items   = []
  let   key     = 0

  for (const ev of events) {
    if (SKIP.has(ev.type)) continue
    const base = { _key: `ev_${key++}`, ts: ev.ts, time: fmt(ev.ts) }

    switch (ev.type) {

      case 'SessionStarted':
        items.push({ ...base, kind: 'session', icon: 'pi pi-play-circle', color: '#ffa726',
          text: '🚀 Сессия инвесткомитета запущена',
          subtext: session.project?.title })
        break

      case 'PhaseTransitioned': {
        const ph = PHASES[ev.nextPhase]
        if (!ph) break
        items.push({ ...base, kind: 'phase', label: ph.label, color: ph.color, icon: ph.icon })
        break
      }

      case 'AgentAnalysisStarted': {
        const agent = AGENT_MAP.value[ev.agentId]
        if (!agent) break
        const pipeline = PIPELINE_STEPS.map(s => ({
          ...s, state: s.id === 'integram' ? 'active' : 'idle',
        }))
        items.push({ ...base, kind: 'agent_op', icon: 'pi pi-file-search',
          agentId: ev.agentId, avatar: agent.avatar, agentName: agent.shortName, color: agent.color,
          text: 'читает документы проекта', pipeline })
        break
      }

      case 'AgentAnalysisCompleted': {
        // Update last agent_op for this agent to show done
        const last = [...items].reverse().find(i => i.kind === 'agent_op' && i.agentId === ev.agentId)
        if (last) {
          last.pipeline = PIPELINE_STEPS.map(s => ({ ...s, state: 'done' }))
          last.text = 'анализ завершён ✓'
        }
        break
      }

      case 'PortfolioOverlapDetected':
        items.push({ ...base, kind: 'alert',
          text: `Пересечение с портфелем: ${ev.overlaps?.length || 0} компаний` })
        break

      case 'SessionTagged':
        items.push({ ...base, kind: 'system', icon: 'pi pi-tag', color: '#8b5cf6',
          text: `Тег онтологии`, subtext: `${ev.concepts?.length || 0} концептов БПЛА` })
        break

      case 'ArgumentRaised': {
        const arg   = ev.argument || argMap[ev.argId] || {}
        const agent = AGENT_MAP.value[arg.agentId || ev.agentId]
        if (!agent || !arg.text) break

        // Reply context
        let replyText = null, replyName = null, replyColor = null
        if (arg.targetArgId) {
          const target = argMap[arg.targetArgId]
          if (target) {
            const ta = AGENT_MAP.value[target.agentId]
            replyText  = (target.text || '').slice(0, 100) + (target.text?.length > 100 ? '…' : '')
            replyName  = ta?.shortName || '?'
            replyColor = ta?.color
          }
        }

        items.push({ ...base, kind: 'argument',
          agentId:     arg.agentId,
          avatar:      agent.avatar,
          agentName:   agent.name,
          agentColor:  agent.color,
          argType:     arg.type,
          typeLabel:   ARG_TYPE_LABEL[arg.type] || arg.type,
          dimension:   arg.dimension || '',
          aiGenerated: arg.aiGenerated,
          modelShort:  arg.model ? arg.model.split('/').pop().slice(0, 14) : null,
          text:        arg.text,
          targetArgId: arg.targetArgId,
          replyText, replyName, replyColor,
          toolsUsed:   arg.toolsUsed || [],
          iterCount:   arg.iterCount || 0,
        })
        break
      }

      case 'VotingStarted':
        items.push({ ...base, kind: 'system', icon: 'pi pi-check-square', color: '#26c6da',
          text: 'Голосование начато — агенты формируют оценку' })
        break

      case 'VoteCast': {
        const vote  = ev.vote
        const agent = AGENT_MAP.value[vote?.agentId]
        if (!agent || !vote) break
        const verdict = VERDICTS[vote.verdict]
        const fromDebateSuffix = vote.fromDebate ? ' (из дебатов)' : ''
        items.push({ ...base, kind: 'vote',
          agentId:      vote.agentId,
          avatar:       agent.avatar,
          agentName:    agent.shortName,
          agentColor:   agent.color,
          verdict:      vote.verdict,
          verdictLabel: (verdict?.label || vote.verdict) + fromDebateSuffix,
          verdictColor: verdict?.color || '#888',
          score:        vote.score,
          rationale:    vote.rationale,
          fromDebate:   vote.fromDebate,
        })
        break
      }

      case 'AllVotesCast': {
        const deltas = props.session?.positionDeltas || {}
        const changed = Object.entries(deltas).filter(([, d]) => d.changed)
        let deltaText = 'Все голоса поданы'
        if (changed.length > 0) {
          const parts = changed.map(([agentId, d]) => {
            const ag = AGENT_MAP.value[agentId]
            const fi = d.from === 'APPROVE' ? '✅' : d.from === 'REJECT' ? '❌' : '⏳'
            const ti = d.to   === 'APPROVE' ? '✅' : d.to   === 'REJECT' ? '❌' : '⏳'
            return `${ag?.shortName || agentId}: ${fi}→${ti}`
          })
          deltaText = `Все голоса поданы. Сменили позицию в ходе дебатов: ${parts.join(' · ')}`
        }
        items.push({ ...base, kind: 'system', icon: 'pi pi-check-circle', color: '#26c6da', text: deltaText })
        break
      }

      case 'DecisionFormed': {
        const dec     = ev.decision
        const verdict = VERDICTS[dec?.recommendation]
        items.push({ ...base, kind: 'decision',
          score:       dec?.aggregatedScore,
          recommendation: dec?.recommendation,
          verdictLabel: verdict?.label,
          color:       verdict?.color || '#4caf50',
          votes:       dec?.voteCounts,
          conditions:  dec?.conditions || [],
        })
        break
      }

      case 'HumanApprovalRequested':
        items.push({ ...base, kind: 'system', icon: 'pi pi-users', color: '#ffa726',
          text: 'Ожидание утверждения председателем комитета' })
        break

      case 'NodeProposed': {
        const agent = AGENT_MAP.value[ev.agentId]
        if (!agent) break
        items.push({ ...base, kind: 'node',
          avatar:    agent.avatar,
          agentName: agent.shortName,
          agentColor: agent.color,
          round:     ev.round,
          type:      ev.type === 'CHALLENGE' ? 'уточнение' : 'предложение',
        })
        break
      }

      case 'NodesSynthesized':
        items.push({ ...base, kind: 'system', icon: 'pi pi-chart-bar', color: '#66bb6a',
          text: 'Контрактные ноды синтезированы',
          subtext: ev.adjustmentRound ? `корректировка раунд ${ev.adjustmentRound}` : '' })
        break

      case 'ContractNodesApproved':
        items.push({ ...base, kind: 'system', icon: 'pi pi-check-circle', color: '#4caf50',
          text: `Контрактные ноды утверждены${ev.unanimous ? ' единогласно' : ' большинством'}`,
          subtext: `раунд ${ev.round}` })
        break

      case 'SessionConcluded': {
        const stats = props.session?.agentStats || {}
        const statsVals = Object.values(stats)
        const llmCount = statsVals.filter(s => s.agentLoop).length
        const totalAgents = statsVals.length
        const avgIter = totalAgents > 0 ? (statsVals.reduce((s, a) => s + (a.iterCount || 0), 0) / totalAgents).toFixed(1) : '0'
        const forcedCount = statsVals.filter(s => s.forcedPublish).length
        const allTools = statsVals.flatMap(s => s.toolsUsed || [])
        const toolCounts = {}
        allTools.forEach(t => { toolCounts[t] = (toolCounts[t] || 0) + 1 })
        const topTools = Object.entries(toolCounts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([t, c]) => `${t}×${c}`).join(', ')

        items.push({ ...base, kind: 'session', icon: 'pi pi-flag-fill', color: '#4caf50',
          text: `✅ Сессия завершена — ${VERDICTS[ev.finalVerdict]?.label || ev.finalVerdict}`,
          subtext: `Итоговый балл: ${ev.score}/100` })
        if (totalAgents > 0) {
          items.push({ ...base, _key: base._key + '_stats', kind: 'system', icon: 'pi pi-chart-bar', color: '#78909c',
            text: `Агенты с LLM: ${llmCount}/${totalAgents} | Средние итерации: ${avgIter} | Forced publish: ${forcedCount}`,
            subtext: topTools ? `Инструменты: ${topTools}` : '' })
        }
        break
      }

      case 'DecisionLinked':
        items.push({ ...base, kind: 'system', icon: 'pi pi-link', color: '#6b7280',
          text: 'Решение зафиксировано в Knowledge Graph' })
        break

      case 'RecommendationsGenerated':
        items.push({ ...base, kind: 'system', icon: 'pi pi-list-check', color: '#ab47bc',
          text: `Сформировано ${ev.recommendations?.length || 0} рекомендаций` })
        break

      case 'RevisionProgress':
        items.push({ ...base, kind: 'system', icon: ev.icon || 'pi pi-cog', color: '#26a69a',
          text: ev.label || 'Доработка...' })
        break

      case 'RevisionComplete':
        items.push({ ...base, kind: 'system', icon: 'pi pi-check-circle', color: '#26a69a',
          text: 'Доработка проекта завершена' })
        break

      default:
        // Unknown event — show as generic system
        items.push({ ...base, kind: 'system', icon: 'pi pi-info-circle', color: '#475569',
          text: ev.type })
        break
    }
  }

  return items
})

// ── Filtered view ──────────────────────────────────────────────
const visibleItems = computed(() => {
  const f = activeFilter.value
  if (f === 'all') return allItems.value
  if (f === 'arguments') return allItems.value.filter(i => i.kind === 'argument' || i.kind === 'phase')
  if (f === 'votes') return allItems.value.filter(i => ['vote', 'decision', 'phase'].includes(i.kind))
  if (f === 'system') return allItems.value.filter(i => !['argument', 'vote', 'decision'].includes(i.kind))
  return allItems.value
})

// ── Auto-scroll ────────────────────────────────────────────────
watch(() => allItems.value.length, () => {
  nextTick(() => {
    if (streamEl.value) streamEl.value.scrollTop = streamEl.value.scrollHeight
  })
})
</script>

<style scoped>
.dt-root {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

/* ── Filter bar ──────────────────────────────────────────────── */
.dt-filters {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 5px 10px;
  border-bottom: 1px solid var(--surface-border);
  flex-shrink: 0;
  flex-wrap: wrap;
  background: var(--surface-card);
}

.dt-filter-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 9px;
  border-radius: 5px;
  border: none;
  background: none;
  color: var(--p-text-muted-color);
  font-size: 11px;
  cursor: pointer;
  transition: all 0.12s;
}
.dt-filter-btn:hover { background: var(--surface-hover); color: var(--p-text-color); }
.dt-filter-btn--active { background: var(--p-primary-color, #42a5f5); color: #fff; }

.dt-filter-count {
  background: rgba(255,255,255,0.2);
  border-radius: 8px;
  padding: 0 5px;
  font-size: 10px;
}
.dt-filter-btn--active .dt-filter-count { background: rgba(255,255,255,0.25); }
.dt-filter-btn:not(.dt-filter-btn--active) .dt-filter-count {
  background: var(--surface-border);
  color: var(--p-text-muted-color);
}

.dt-filter-sep { flex: 1; }
.dt-total { font-size: 10px; color: var(--p-text-muted-color); }

/* ── Stream ──────────────────────────────────────────────────── */
.dt-stream {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 8px 10px;
  scroll-behavior: smooth;
}

.dt-items {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

/* ── Timestamp ───────────────────────────────────────────────── */
.dt-ts {
  margin-left: auto;
  font-size: 9px;
  color: var(--p-text-muted-color);
  flex-shrink: 0;
  font-variant-numeric: tabular-nums;
}

/* ── Phase separator ─────────────────────────────────────────── */
.dt-phase-sep {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 8px 0 4px;
}
.dt-phase-line { flex: 1; height: 1px; background: var(--surface-border); }
.dt-phase-badge {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 3px 10px;
  border-radius: 10px;
  font-size: 10px;
  font-weight: 700;
  color: #fff;
  white-space: nowrap;
  flex-shrink: 0;
}

/* ── Session banner ──────────────────────────────────────────── */
.dt-session-banner {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 8px;
  border-left: 3px solid;
  background: var(--surface-card);
  font-size: 12px;
}
.dt-session-text { display: flex; flex-direction: column; gap: 1px; }
.dt-session-text strong { font-size: 12px; color: var(--p-text-color); }
.dt-session-text span { font-size: 10px; color: var(--p-text-muted-color); }

/* ── System event ────────────────────────────────────────────── */
.dt-sys-event {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  border-radius: 5px;
  font-size: 11px;
  color: var(--p-text-muted-color);
  background: var(--p-surface-section, transparent);
}
.dt-sys-dot {
  width: 6px; height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}
.dt-sys-text { color: var(--p-text-color); }
.dt-sys-sub { font-size: 10px; color: var(--p-text-muted-color); }

/* ── Agent op ────────────────────────────────────────────────── */
.dt-agent-op {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  border-radius: 5px;
  font-size: 11px;
  background: var(--p-surface-section, transparent);
}
.dt-agent-avatar { font-size: 14px; flex-shrink: 0; }
.dt-agent-name   { font-weight: 600; flex-shrink: 0; font-size: 11px; }
.dt-agent-op-text { color: var(--p-text-muted-color); font-size: 10px; }

.dt-pipeline { display: flex; gap: 3px; margin-left: 4px; }
.dt-pipe-step {
  display: flex; align-items: center; justify-content: center;
  width: 16px; height: 16px;
  border-radius: 3px;
  background: var(--surface-border);
  color: var(--p-text-muted-color);
  font-size: 8px;
}
.dt-pipe-step--active { background: rgba(66,165,245,0.2); color: #42a5f5; }
.dt-pipe-step--done   { background: rgba(76,175,80,0.15); color: #4caf50; }
.dt-pipe-step--error  { background: rgba(239,83,80,0.15); color: #ef5350; }

/* ── Alert ───────────────────────────────────────────────────── */
.dt-alert {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 10px;
  border-radius: 6px;
  background: rgba(255,167,38,0.08);
  border: 1px solid rgba(255,167,38,0.2);
  font-size: 11px;
  color: var(--p-text-color);
}

/* ── Argument card ───────────────────────────────────────────── */
.dt-argument {
  border: 1px solid var(--surface-border);
  border-radius: 8px;
  padding: 8px 10px;
  background: var(--surface-card);
  transition: border-color 0.2s;
}
.dt-argument--reply {
  margin-left: 16px;
  border-left: 2px solid #7e57c2;
  background: var(--p-surface-section);
}
.dt-arg--challenge { border-color: rgba(239,83,80,0.3); }
.dt-arg--counter   { border-color: rgba(126,87,194,0.3); }
.dt-arg--summary   { border-color: rgba(102,187,106,0.2); background: var(--p-surface-card); }

.dt-arg-header {
  display: flex;
  align-items: center;
  gap: 5px;
  margin-bottom: 5px;
  flex-wrap: wrap;
}
.dt-arg-avatar { font-size: 14px; }
.dt-arg-name   { font-size: 11px; font-weight: 600; }
.dt-arg-type   {
  font-size: 9px; font-weight: 700;
  padding: 1px 6px; border-radius: 3px;
}
.dt-arg-dim {
  font-size: 9px; color: var(--p-text-muted-color);
  background: var(--surface-border); padding: 1px 5px; border-radius: 3px;
}
.dt-arg-ai {
  font-size: 9px; color: #a78bfa; font-weight: 700;
  background: rgba(167,139,250,0.12); border: 1px solid rgba(167,139,250,0.3);
  border-radius: 4px; padding: 1px 5px;
  display: inline-flex; align-items: center; gap: 3px;
}
.dt-arg-reply {
  font-size: 10px; color: var(--p-text-muted-color);
  background: var(--p-surface-card);
  border-left: 2px solid var(--surface-border);
  padding: 3px 8px; border-radius: 0 4px 4px 0;
  margin-bottom: 5px; line-height: 1.4;
}
.dt-reply-who { font-weight: 700; margin-right: 4px; }
.dt-arg-text  { font-size: 11px; line-height: 1.6; color: var(--p-text-color); }

/* Tool calls block */
.dt-tools-block {
  margin-top: 6px;
  border-top: 1px solid var(--surface-border);
  padding-top: 5px;
}
.dt-tools-toggle {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 9px;
  color: var(--p-text-muted-color);
  background: none;
  border: 1px solid var(--surface-border);
  border-radius: 4px;
  padding: 2px 7px;
  cursor: pointer;
  transition: background .15s;
}
.dt-tools-toggle:hover { background: var(--surface-hover); }
.dt-tools-toggle .pi-wrench { font-size: 9px; color: #ff9800; }
.dt-tools-list {
  margin-top: 5px;
  display: flex;
  flex-direction: column;
  gap: 3px;
  overflow: hidden;
  max-height: 38px; /* ~2 строки */
  transition: max-height .25s ease;
}
.dt-tools-list--expanded { max-height: 200px; }
.dt-tool-row {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 10px;
  font-family: monospace;
  padding: 1px 0;
}
.dt-tool-name { flex: 1; }
.dt-tool-iter { color: var(--p-text-muted-color); font-size: 9px; font-family: sans-serif; }

/* ── Vote ────────────────────────────────────────────────────── */
.dt-vote {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 10px;
  border-radius: 6px;
  background: var(--surface-card);
  border: 1px solid var(--surface-border);
}
.dt-verdict-pill {
  font-size: 10px; font-weight: 700;
  padding: 2px 8px; border-radius: 4px; color: #fff;
}
.dt-vote-score { font-size: 11px; color: var(--p-text-muted-color); min-width: 40px; }
.dt-vote-bar {
  flex: 1; height: 4px;
  background: var(--surface-border); border-radius: 2px; overflow: hidden;
}
.dt-vote-bar > div { height: 100%; border-radius: 2px; transition: width 0.4s ease; }

/* ── Decision card ───────────────────────────────────────────── */
.dt-decision {
  border: 2px solid;
  border-radius: 10px;
  padding: 10px 14px;
  background: var(--surface-card);
  margin: 4px 0;
}
.dt-decision-header {
  display: flex; align-items: center; gap: 8px;
  font-size: 13px; margin-bottom: 6px;
}
.dt-decision-score { font-size: 20px; font-weight: 700; margin-left: 4px; }
.dt-decision-votes { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 5px; }
.dt-dvote {
  font-size: 10px; font-weight: 700; color: #fff;
  padding: 2px 8px; border-radius: 4px;
}
.dt-decision-conds { display: flex; flex-direction: column; gap: 2px; }
.dt-cond { font-size: 10px; color: var(--p-text-muted-color); }

/* ── Node proposal ───────────────────────────────────────────── */
.dt-node-proposal {
  display: flex; align-items: center; gap: 6px;
  padding: 4px 8px; border-radius: 5px;
  font-size: 11px; background: var(--p-surface-section, transparent);
  border-left: 2px solid #66bb6a;
}

/* ── Running indicator ───────────────────────────────────────── */
.dt-running {
  display: flex; align-items: center; gap: 5px;
  padding: 8px 12px;
}
.dt-running-dot {
  width: 6px; height: 6px; border-radius: 50%;
  background: var(--p-primary-color, #42a5f5);
  animation: dt-pulse 1.2s infinite;
}
.dt-running-dot:nth-child(2) { animation-delay: 0.2s; }
.dt-running-dot:nth-child(3) { animation-delay: 0.4s; }
@keyframes dt-pulse {
  0%, 100% { opacity: 0.3; transform: scale(0.8); }
  50%       { opacity: 1;   transform: scale(1.2); }
}

/* ── Transition ──────────────────────────────────────────────── */
.dt-item-enter-active { transition: all 0.3s ease; }
.dt-item-enter-from   { opacity: 0; transform: translateY(8px); }
</style>
