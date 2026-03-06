<template>
  <div class="fst-committee">
    <Toast position="bottom-center" />

    <!-- ═══ Project Select Dialog ═══ -->
    <Dialog v-model:visible="lobbyVisible" header="ФСТ НТИ — Инвесткомитет с AI-агентами" modal
      :style="{ width: '720px', maxWidth: '95vw' }" :closable="false">

      <div class="fst-intro">
        <div class="fst-intro-badge">
          <i class="pi pi-building" style="color:#ffa726;font-size:20px"></i>
          Фонд суверенных технологий НТИ
        </div>
        <p class="fst-intro-text">
          6 AI-агентов разных ролей анализируют проект, вступают в дебаты и приходят к решению.
          Инвесткомитет работает как BlackRock Aladdin — прозрачно, с аргументами и контраргументами.
          Люди утверждают итоговое решение.
        </p>
        <div class="fst-intro-subfunds">
          <div v-for="sf in Object.values(SUBFUNDS)" :key="sf.id" class="fst-subfund-badge"
            :style="{ borderColor: sf.color, color: sf.color }">
            <i :class="sf.icon"></i> {{ sf.name }}
            <span class="fst-subfund-budget">{{ (sf.budget / 1e9).toFixed(1) }} млрд</span>
          </div>
        </div>
      </div>

      <Divider />

      <div class="fst-lobby-section">
        <div class="fst-lobby-label">Выберите проект для рассмотрения:</div>
        <div class="fst-project-list">
          <div v-for="p in PROJECTS_POOL" :key="p.id"
            :class="['fst-project-card', { 'fst-project-card--active': selectedProjectId === p.id }]"
            @click="selectedProjectId = p.id">
            <div class="fst-pc-header">
              <div class="fst-pc-subfund" :style="{ background: SUBFUNDS[p.subFund]?.color || '#666' }">
                {{ (SUBFUNDS[p.subFund]?.shortName) || p.subFund.toUpperCase() }}
              </div>
              <div class="fst-pc-stage">{{ p.stage }}</div>
              <div class="fst-pc-amount">{{ (p.requestedAmount / 1e6).toFixed(0) }} млн ₽</div>
            </div>
            <div class="fst-pc-title">{{ p.title }}</div>
            <div class="fst-pc-company">{{ p.company }}</div>
            <div class="fst-pc-metrics">
              <span class="fst-metric" :class="trlClass(p.trl)">TRL {{ p.trl }}</span>
              <span class="fst-metric" :class="trlClass(p.mrl - 1)">MRL {{ p.mrl }}</span>
              <span class="fst-metric" :class="sovClass(p.sovereigntyScore)">Суверен. {{ p.sovereigntyScore }}/9</span>
              <span class="fst-metric" :class="irrClass(p.projectedIRR)">IRR {{ (p.projectedIRR * 100).toFixed(0) }}%</span>
            </div>
          </div>
        </div>
      </div>

      <div class="fst-lobby-section" style="margin-top:16px">
        <div class="fst-lobby-label">Скорость симуляции:</div>
        <div class="fst-speed-row">
          <div v-for="sp in speedOptions" :key="sp.id"
            :class="['fst-speed-btn', { active: selectedSpeed === sp.id }]"
            @click="selectedSpeed = sp.id">
            {{ sp.label }}
          </div>
        </div>
      </div>

      <!-- ═══ FST Policy Settings ═══ -->
      <div class="fst-lobby-section" style="margin-top:16px">
        <div class="fst-policy-toggle" @click="policyExpanded = !policyExpanded">
          <i class="pi pi-sliders-h" style="color:#ffa726"></i>
          <span class="fst-lobby-label" style="margin:0;cursor:pointer">Параметры оценки ФСТ</span>
          <span style="font-size:11px;color:var(--p-text-muted-color);margin-left:8px">
            Сув. ≥ {{ fstPolicy.minSovereignty }}/9 · TRL ≥ {{ fstPolicy.minTRL }} · MRL ≥ {{ fstPolicy.minMRL }}
          </span>
          <i :class="policyExpanded ? 'pi pi-chevron-up' : 'pi pi-chevron-down'"
            style="margin-left:auto;font-size:11px;color:var(--p-text-muted-color)"></i>
        </div>
        <div v-if="policyExpanded" class="fst-policy-grid">
          <div v-for="(range, key) in FST_POLICY_RANGES" :key="key" class="fst-policy-item">
            <div class="fst-policy-label">
              {{ range.label }}: <b>{{ formatPolicyValue(key, fstPolicy[key]) }}</b>
            </div>
            <Slider
              :modelValue="policySliderValue(key, fstPolicy[key])"
              @update:modelValue="v => setPolicyFromSlider(key, v)"
              :min="range.min * policyMultiplier(key)"
              :max="range.max * policyMultiplier(key)"
              :step="range.step * policyMultiplier(key)"
              class="fst-policy-slider"
            />
          </div>
          <Button label="Сброс" icon="pi pi-refresh" size="small" severity="secondary" text
            @click="resetPolicy" style="margin-top:4px" />
        </div>
      </div>

      <template #footer>
        <Button label="Запустить инвесткомитет" icon="pi pi-play" severity="success"
          :disabled="!selectedProjectId" @click="startSession" />
      </template>
    </Dialog>

    <!-- ═══ Conclusion Dialog ═══ -->
    <Dialog v-model:visible="conclusionVisible" :header="conclusionHeader" modal
      :style="{ width: '560px' }">
      <div v-if="session?.decision" class="fst-conclusion">
        <div class="fst-conclusion-score" :style="{ color: scoreColor(session.decision.aggregatedScore) }">
          {{ session.decision.aggregatedScore }}/100
        </div>
        <div class="fst-conclusion-recommendation"
          :style="{ background: VERDICTS[session.decision.recommendation]?.color }">
          <i :class="VERDICTS[session.decision.recommendation]?.icon"></i>
          {{ VERDICTS[session.decision.recommendation]?.label }}
        </div>
        <div class="fst-conclusion-section">
          <div class="fst-conclusion-label">Голоса агентов:</div>
          <div class="fst-votes-summary">
            <span v-for="(count, v) in session.decision.voteCounts" :key="v"
              v-show="count > 0" class="fst-vote-pill"
              :style="{ background: VERDICTS[v]?.color }">
              {{ VERDICTS[v]?.label }}: {{ count }}
            </span>
          </div>
        </div>
        <div v-if="session.decision.conditions?.length" class="fst-conclusion-section">
          <div class="fst-conclusion-label">Условия одобрения:</div>
          <ul class="fst-conditions-list">
            <li v-for="c in session.decision.conditions" :key="c">{{ c }}</li>
          </ul>
        </div>
        <div v-if="session.decision.humanApproval" class="fst-human-result">
          <i class="pi pi-check-circle" style="color:#4caf50"></i>
          Решение комитета утверждено:
          <strong>{{ VERDICTS[session.decision.humanApproval.verdict]?.label }}</strong>
        </div>
      </div>
      <template #footer>
        <Button label="Новая сессия" icon="pi pi-refresh" severity="secondary" @click="resetSession" />
      </template>
    </Dialog>

    <!-- ═══ Main Dashboard ═══ -->
    <div v-if="session" class="fst-dashboard">

      <!-- Top Toolbar -->
      <div class="fst-toolbar">
        <div class="fst-toolbar-left">
          <span class="fst-logo">
            <i class="pi pi-building" style="color:#ffa726"></i>
            ФСТ НТИ · Инвесткомитет
          </span>
          <span class="fst-project-name">{{ session.project.title }}</span>
        </div>
        <div class="fst-toolbar-center">
          <div class="fst-phase-track">
            <div v-for="(ph, idx) in visiblePhases" :key="ph.id"
              :class="['fst-phase-step', {
                'fst-phase-step--done': phaseIdx > idx,
                'fst-phase-step--active': phaseIdx === idx,
              }]">
              <div class="fst-phase-dot" :style="{ background: phaseIdx >= idx ? ph.color : 'transparent', borderColor: ph.color }">
                <i v-if="phaseIdx > idx" class="pi pi-check" style="font-size:9px;color:#fff"></i>
              </div>
              <div class="fst-phase-label">{{ ph.label }}</div>
            </div>
          </div>
        </div>
        <div class="fst-toolbar-right">
          <Tag :value="currentPhase.label" :style="{ background: currentPhase.color }" class="fst-phase-tag" />
          <Button v-if="running" icon="pi pi-pause" size="small" text severity="secondary" @click="pauseSession" />
          <Button icon="pi pi-sliders-h" label="Настройки" size="small" text severity="secondary"
            @click="lobbyVisible = true; policyExpanded = true" title="Параметры оценки ФСТ" />
          <Button icon="pi pi-times" size="small" text severity="secondary" @click="resetSession" />
        </div>
      </div>

      <!-- Main Layout -->
      <div class="fst-main">

        <!-- Left: Agents Panel -->
        <div class="fst-agents-panel">
          <div class="fst-panel-title">AI Агенты комитета</div>
          <div class="fst-agents-list">
            <div v-for="agent in AGENTS" :key="agent.id"
              :class="['fst-agent-card', {
                'fst-agent-card--thinking': agentStatus(agent.id).thinking,
                'fst-agent-card--voted': agentStatus(agent.id).vote,
              }]"
              :style="{ '--agent-color': agent.color }">
              <div class="fst-agent-avatar">
                <span class="fst-agent-emoji">{{ agent.avatar }}</span>
                <span v-if="agentStatus(agent.id).thinking" class="fst-agent-thinking-pulse"></span>
              </div>
              <div class="fst-agent-info">
                <div class="fst-agent-name">{{ agent.name }}</div>
                <div class="fst-agent-role-label">{{ agent.description.slice(0, 50) }}...</div>
                <div v-if="agentStatus(agent.id).thinking" class="fst-agent-think-text">
                  <i class="pi pi-spin pi-spinner" style="font-size:10px"></i>
                  {{ agentStatus(agent.id).thinkText }}
                </div>
                <div v-else-if="agentStatus(agent.id).vote" class="fst-agent-vote-badge"
                  :style="{ background: VERDICTS[agentStatus(agent.id).vote]?.color }">
                  <i :class="VERDICTS[agentStatus(agent.id).vote]?.icon"></i>
                  {{ agentStatus(agent.id).voteScore }}/100
                </div>
                <div v-else-if="agentStatus(agent.id).done" class="fst-agent-ready">
                  <i class="pi pi-check" style="color:#4caf50;font-size:10px"></i> Готов
                </div>
              </div>
              <div class="fst-agent-weight">{{ Math.round(agent.weight * 100) }}%</div>
            </div>
          </div>

          <!-- Project Mini Card -->
          <div class="fst-project-mini">
            <div class="fst-project-mini-title">{{ session.project.title }}</div>
            <div class="fst-project-mini-row">
              <span>Субфонд:</span>
              <span :style="{ color: SUBFUNDS[session.project.subFund]?.color }">
                {{ SUBFUNDS[session.project.subFund]?.name }}
              </span>
            </div>
            <div class="fst-project-mini-row">
              <span>Запрос:</span>
              <strong>{{ (session.project.requestedAmount / 1e6).toFixed(0) }} млн ₽</strong>
            </div>
            <div class="fst-project-mini-row">
              <span>TRL / MRL:</span>
              <span>{{ session.project.trl }} / {{ session.project.mrl }}</span>
            </div>
            <div class="fst-project-mini-row">
              <span>Суверенность:</span>
              <span :class="sovClass(session.project.sovereigntyScore)">{{ session.project.sovereigntyScore }}/9</span>
            </div>
            <div class="fst-project-mini-row">
              <span>Рынок:</span>
              <span>{{ (session.project.marketSize / 1e9).toFixed(1) }} млрд ₽</span>
            </div>
          </div>
        </div>

        <!-- Center: Debate Timeline -->
        <div class="fst-debate-panel">
          <div class="fst-panel-title">
            Арена дебатов
            <span class="fst-arg-count">{{ session.arguments.length }} аргументов</span>
          </div>
          <div class="fst-timeline" ref="timelineEl">
            <!-- Loading phase -->
            <div v-if="session.phase === 'LOADING'" class="fst-loading-phase">
              <div class="fst-loading-title">
                <i class="pi pi-file-search"></i> Агенты изучают документацию...
              </div>
              <div v-for="agent in AGENTS" :key="agent.id" class="fst-loading-agent">
                <span class="fst-la-avatar">{{ agent.avatar }}</span>
                <div class="fst-la-bar-wrap">
                  <div class="fst-la-name">{{ agent.shortName }}</div>
                  <div class="fst-la-bar">
                    <div class="fst-la-bar-fill"
                      :style="{ background: agent.color, width: agentStatus(agent.id).done ? '100%' : agentStatus(agent.id).thinking ? '65%' : '0%' }"></div>
                  </div>
                </div>
                <div class="fst-la-status">
                  <i v-if="agentStatus(agent.id).done" class="pi pi-check" style="color:#4caf50"></i>
                  <i v-else-if="agentStatus(agent.id).thinking" class="pi pi-spin pi-spinner" style="color:#42a5f5"></i>
                  <i v-else class="pi pi-clock" style="color:#78909c"></i>
                </div>
              </div>
            </div>

            <!-- Arguments stream -->
            <TransitionGroup name="fst-arg" tag="div" class="fst-args-stream">
              <div v-for="arg in session.arguments" :key="arg.id"
                :class="['fst-argument', `fst-arg-type--${arg.type.toLowerCase()}`,
                  arg.targetArgId ? 'fst-argument--counter' : '']">
                <div class="fst-arg-header">
                  <span class="fst-arg-avatar">{{ agentById(arg.agentId)?.avatar }}</span>
                  <span class="fst-arg-agent-name" :style="{ color: agentById(arg.agentId)?.color }">
                    {{ agentById(arg.agentId)?.name }}
                  </span>
                  <span class="fst-arg-type-badge">{{ argTypeLabel(arg.type) }}</span>
                  <span class="fst-arg-dim">{{ arg.dimension }}</span>
                </div>
                <div class="fst-arg-text">{{ arg.text }}</div>
              </div>
            </TransitionGroup>

            <!-- Voting in progress -->
            <div v-if="session.phase === 'VOTING' && session.votes.length > 0" class="fst-vote-stream">
              <div class="fst-vote-title"><i class="pi pi-check-square"></i> Голосование агентов</div>
              <TransitionGroup name="fst-arg" tag="div">
                <div v-for="vote in session.votes" :key="vote.id" class="fst-vote-row">
                  <span class="fst-vote-avatar">{{ agentById(vote.agentId)?.avatar }}</span>
                  <span class="fst-vote-name" :style="{ color: agentById(vote.agentId)?.color }">
                    {{ agentById(vote.agentId)?.shortName }}
                  </span>
                  <span class="fst-vote-pill-sm" :style="{ background: VERDICTS[vote.verdict]?.color }">
                    {{ VERDICTS[vote.verdict]?.label }}
                  </span>
                  <span class="fst-vote-score">{{ vote.score }}/100</span>
                  <div class="fst-vote-conf-bar">
                    <div :style="{ width: (vote.confidence * 100) + '%', background: agentById(vote.agentId)?.color }"></div>
                  </div>
                </div>
              </TransitionGroup>
            </div>

            <!-- Empty state -->
            <div v-if="session.phase === 'IDLE'" class="fst-empty-state">
              <i class="pi pi-comments" style="font-size:40px;color:#444;margin-bottom:12px"></i>
              <div>Сессия готова. Запуск...</div>
            </div>
          </div>
        </div>

        <!-- Right: Scoring + Decision -->
        <div class="fst-score-panel">
          <div class="fst-panel-title">Скоринг проекта</div>

          <!-- Radar-style score display -->
          <div class="fst-radar-container">
            <svg viewBox="0 0 200 200" class="fst-radar-svg">
              <!-- Background rings -->
              <circle cx="100" cy="100" r="80" fill="none" stroke="#333" stroke-width="0.5" stroke-dasharray="3,3"/>
              <circle cx="100" cy="100" r="60" fill="none" stroke="#333" stroke-width="0.5" stroke-dasharray="3,3"/>
              <circle cx="100" cy="100" r="40" fill="none" stroke="#333" stroke-width="0.5" stroke-dasharray="3,3"/>
              <circle cx="100" cy="100" r="20" fill="none" stroke="#333" stroke-width="0.5" stroke-dasharray="3,3"/>

              <!-- Axes -->
              <line v-for="(ax, i) in radarAxes" :key="i"
                x1="100" y1="100"
                :x2="100 + Math.cos(ax.angle - Math.PI/2) * 80"
                :y2="100 + Math.sin(ax.angle - Math.PI/2) * 80"
                stroke="#444" stroke-width="0.5"/>

              <!-- Score polygon -->
              <polygon :points="radarPoints" fill="rgba(66,165,245,0.2)" stroke="#42a5f5" stroke-width="1.5"/>

              <!-- Labels -->
              <text v-for="(ax, i) in radarAxes" :key="'l'+i"
                :x="100 + Math.cos(ax.angle - Math.PI/2) * 92"
                :y="100 + Math.sin(ax.angle - Math.PI/2) * 92"
                text-anchor="middle" dominant-baseline="middle"
                fill="#aaa" font-size="8">{{ ax.label }}</text>
            </svg>
          </div>

          <!-- Dim scores bars -->
          <div class="fst-dim-bars">
            <div v-for="(dim, key) in SCORING_DIMS" :key="key" class="fst-dim-bar-row">
              <div class="fst-dim-label">{{ dim.label }}</div>
              <div class="fst-dim-bar-bg">
                <div class="fst-dim-bar-fill"
                  :style="{ width: ((session.dimScores[key] || 0) * 100) + '%', background: dim.color }">
                </div>
              </div>
              <div class="fst-dim-value" :style="{ color: dim.color }">
                {{ Math.round((session.dimScores[key] || 0) * 100) }}
              </div>
            </div>
          </div>

          <!-- Aggregate Score -->
          <div v-if="session.decision" class="fst-agg-score">
            <div class="fst-agg-score-label">Итоговый балл</div>
            <div class="fst-agg-score-value" :style="{ color: scoreColor(session.decision.aggregatedScore) }">
              {{ session.decision.aggregatedScore }}<span style="font-size:16px;opacity:0.6">/100</span>
            </div>
            <div class="fst-agg-rec" :style="{ background: VERDICTS[session.decision.recommendation]?.color }">
              <i :class="VERDICTS[session.decision.recommendation]?.icon"></i>
              {{ VERDICTS[session.decision.recommendation]?.label }}
            </div>
          </div>

          <!-- Vote distribution -->
          <div v-if="session.votes.length > 0" class="fst-vote-dist">
            <div class="fst-panel-subtitle">Распределение голосов</div>
            <div class="fst-vote-dist-bars">
              <div v-for="(v, id) in VERDICTS" :key="id" class="fst-vote-dist-row">
                <span class="fst-vd-label">{{ v.label }}</span>
                <div class="fst-vd-bar-bg">
                  <div class="fst-vd-bar-fill" :style="{ width: voteBarWidth(id), background: v.color }"></div>
                </div>
                <span class="fst-vd-count">{{ voteCount(id) }}</span>
              </div>
            </div>
          </div>

          <!-- Conditions -->
          <div v-if="session.decision?.conditions?.length" class="fst-conditions">
            <div class="fst-panel-subtitle">Условия одобрения</div>
            <ul class="fst-cond-list">
              <li v-for="c in session.decision.conditions" :key="c" class="fst-cond-item">
                <i class="pi pi-angle-right" style="color:#ffa726;font-size:10px"></i> {{ c }}
              </li>
            </ul>
          </div>

          <!-- Key Risks -->
          <div v-if="session.decision?.risks?.length" class="fst-risks">
            <div class="fst-panel-subtitle">Ключевые риски</div>
            <ul class="fst-risk-list">
              <li v-for="r in session.decision.risks.slice(0,3)" :key="r" class="fst-risk-item">
                <i class="pi pi-exclamation-triangle" style="color:#ef5350;font-size:10px"></i> {{ r }}
              </li>
            </ul>
          </div>

          <!-- Human Approval Panel -->
          <div v-if="session.phase === 'HUMAN_APPROVAL'" class="fst-human-panel">
            <div class="fst-panel-subtitle" style="color:#ffa726">
              <i class="pi pi-users"></i> Утверждение инвесткомитета
            </div>
            <p class="fst-human-prompt">
              AI-агенты вынесли рекомендацию. Члены комитета принимают окончательное решение:
            </p>
            <div class="fst-human-comment-row">
              <InputText v-model="humanComment" placeholder="Комментарий (опционально)" class="fst-human-comment" size="small" />
            </div>
            <div class="fst-human-buttons">
              <Button label="Утвердить" icon="pi pi-check" severity="success" size="small"
                @click="humanDecide('APPROVE')" />
              <Button label="Отложить" icon="pi pi-clock" severity="warning" size="small"
                @click="humanDecide('DEFER')" />
              <Button label="Отклонить" icon="pi pi-times" severity="danger" size="small"
                @click="humanDecide('REJECT')" />
            </div>
          </div>

        </div>
      </div>
    </div>

    <!-- Loading screen before session -->
    <div v-else class="fst-pre-session">
      <div class="fst-pre-logo">
        <i class="pi pi-building" style="font-size:48px;color:#ffa726"></i>
        <h1>ФСТ НТИ</h1>
        <h2>AI Инвестиционный Комитет</h2>
        <p>6 AI-агентов · Полные дебаты · Прозрачное решение</p>

        <!-- Текущие настройки политики -->
        <div class="fst-pre-policy">
          <div class="fst-pre-policy-title">
            <i class="pi pi-sliders-h" style="color:#ffa726"></i>
            Текущие параметры оценки ФСТ
          </div>
          <div class="fst-pre-policy-grid">
            <div v-for="(range, key) in FST_POLICY_RANGES" :key="key" class="fst-pre-policy-item">
              <span class="fst-pre-policy-label">{{ range.label }}</span>
              <span class="fst-pre-policy-val">{{ formatPolicyValue(key, fstPolicy[key]) }}</span>
            </div>
          </div>
        </div>

        <div style="display:flex;gap:10px;justify-content:center;margin-top:16px">
          <Button label="Открыть сессию" icon="pi pi-play" severity="success" size="large"
            @click="lobbyVisible = true" />
          <Button label="Настройки" icon="pi pi-sliders-h" severity="secondary"
            @click="lobbyVisible = true; policyExpanded = true" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, nextTick, onUnmounted, watch } from 'vue'
import Slider from 'primevue/slider'
import { FstCommitteeEngine, createSession } from '@/components/fst-committee/FstCommitteeEngine.js'
import {
  AGENTS, SCORING_DIMS, PHASES, PHASE_ORDER, VERDICTS,
  PROJECTS_POOL, SUBFUNDS, SPEED_MULTIPLIERS,
  FST_POLICY_DEFAULTS, FST_POLICY_RANGES,
} from '@/components/fst-committee/FstCommitteeConfig.js'
import { saveDecision, createProject, STATUSES } from '@/services/fstApi'

// ── State ─────────────────────────────────────────────────────

const lobbyVisible = ref(true)
const conclusionVisible = ref(false)
const selectedProjectId = ref(PROJECTS_POOL[0].id)
const selectedSpeed = ref('normal')
const policyExpanded = ref(true)
const humanComment = ref('')
const session = ref(null)
const running = ref(false)
const timelineEl = ref(null)

const fstPolicy = ref({ ...FST_POLICY_DEFAULTS })

let engine = null

// ── Speed Options ─────────────────────────────────────────────

const speedOptions = [
  { id: 'slow',   label: '1x — Полный' },
  { id: 'normal', label: '2.5x — Быстрый' },
  { id: 'fast',   label: '6x — Демо' },
]

// ── Computed ──────────────────────────────────────────────────

const visiblePhases = computed(() =>
  PHASE_ORDER.slice(1, -1).map(id => PHASES[id])
)

const phaseIdx = computed(() => {
  if (!session.value) return 0
  return PHASE_ORDER.slice(1, -1).indexOf(session.value.phase)
})

const currentPhase = computed(() =>
  session.value ? PHASES[session.value.phase] : PHASES.IDLE
)

const conclusionHeader = computed(() => {
  const d = session.value?.decision
  if (!d) return 'Результат сессии'
  return `Решение комитета — ${d.aggregatedScore}/100`
})

// Radar chart helpers
const radarAxes = computed(() => {
  const dims = Object.keys(SCORING_DIMS)
  return dims.map((key, i) => ({
    key,
    label: SCORING_DIMS[key].label,
    angle: (i / dims.length) * 2 * Math.PI,
    color: SCORING_DIMS[key].color,
  }))
})

const radarPoints = computed(() => {
  if (!session.value) return ''
  const dimScores = session.value.dimScores
  const axes = radarAxes.value
  return axes.map(ax => {
    const val = (dimScores[ax.key] || 0) * 80
    const x = 100 + Math.cos(ax.angle - Math.PI / 2) * val
    const y = 100 + Math.sin(ax.angle - Math.PI / 2) * val
    return `${x},${y}`
  }).join(' ')
})

// ── Methods ───────────────────────────────────────────────────

function agentById(id) {
  return AGENTS.find(a => a.id === id)
}

function agentStatus(agentId) {
  return session.value?.agentStatus?.[agentId] || {}
}

function argTypeLabel(type) {
  const labels = { OPENING: 'Позиция', CHALLENGE: 'Вызов', COUNTER: 'Контр', SUMMARY: 'Итог' }
  return labels[type] || type
}

function voteCount(verdictId) {
  if (!session.value?.votes) return 0
  return session.value.votes.filter(v => v.verdict === verdictId).length
}

function voteBarWidth(verdictId) {
  const total = session.value?.votes?.length || 1
  return `${(voteCount(verdictId) / total) * 100}%`
}

function scoreColor(score) {
  if (score >= 72) return '#4caf50'
  if (score >= 50) return '#ffa726'
  return '#ef5350'
}

function trlClass(v) {
  if (v >= 6) return 'metric--good'
  if (v >= 4) return 'metric--warn'
  return 'metric--bad'
}
function sovClass(v) {
  if (v >= 7) return 'metric--good'
  if (v >= 5) return 'metric--warn'
  return 'metric--bad'
}
function irrClass(v) {
  if (v >= 0.30) return 'metric--good'
  if (v >= 0.22) return 'metric--warn'
  return 'metric--bad'
}

// ── FST Policy Helpers ────────────────────────────────────────

function policyMultiplier(key) {
  return key === 'minTRL' || key === 'minSovereignty' || key === 'minMRL' ? 1 : 100
}

function policySliderValue(key, val) {
  if (val == null) return 0
  const m = policyMultiplier(key)
  return m === 1 ? val : Math.round(val * 100)
}

function formatPolicyValue(key, val) {
  if (val == null) return '—'
  if (key === 'minTRL' || key === 'minSovereignty' || key === 'minMRL') return val.toString()
  return (val * 100).toFixed(0) + '%'
}

function setPolicyFromSlider(key, v) {
  const m = policyMultiplier(key)
  fstPolicy.value[key] = m === 1 ? v : v / 100
}

function resetPolicy() {
  fstPolicy.value = { ...FST_POLICY_DEFAULTS }
}

// ── Session Management ────────────────────────────────────────

function startSession() {
  const project = PROJECTS_POOL.find(p => p.id === selectedProjectId.value)
  if (!project) return
  lobbyVisible.value = false

  const sess = createSession(project, { speed: selectedSpeed.value, policy: { ...fstPolicy.value } })
  session.value = sess

  engine = new FstCommitteeEngine(sess, handleEvent)
  running.value = true
  engine.start().then(() => {
    running.value = false
  }).catch(() => {
    running.value = false
  })
}

function pauseSession() {
  if (engine) engine.stop()
  running.value = false
}

function resetSession() {
  if (engine) engine.stop()
  engine = null
  session.value = null
  running.value = false
  conclusionVisible.value = false
  humanComment.value = ''
  lobbyVisible.value = true
}

function humanDecide(verdict) {
  if (engine && session.value?.phase === 'HUMAN_APPROVAL') {
    engine.humanDecide(verdict, humanComment.value, 'chair')
  }
}

// ── Event Handler ─────────────────────────────────────────────

function handleEvent(event) {
  // Force reactivity update
  if (session.value) {
    session.value = { ...session.value }
  }

  if (event.type === 'ArgumentRaised') {
    nextTick(() => {
      if (timelineEl.value) {
        timelineEl.value.scrollTop = timelineEl.value.scrollHeight
      }
    })
  }

  if (event.type === 'SessionConcluded') {
    setTimeout(() => {
      conclusionVisible.value = true
    }, 1500)
    // Сохранить решение ИК в fst
    saveDecisionToFst(session.value)
  }
}

async function saveDecisionToFst(sess) {
  if (!sess) return
  try {
    const project = PROJECTS_POOL.find(p => p.id === sess.projectId) || {}
    const votes = sess.votes || []
    const votesAgainst = votes.filter(v => v.verdict === 'REJECT').length
    const approved = sess.decision?.humanApproval?.verdict === 'APPROVE'
    const decisionName = `ИК: ${project.name || sess.projectId} — ${new Date().toLocaleDateString('ru')}`

    // Создать проект в fst если его ещё нет
    let fstProjectId = null
    try {
      const created = await createProject({
        name: project.company || project.name || sess.projectId,
        description: project.description || '',
        amount: project.askRub || 0,
        statusId: approved ? STATUSES['Одобрен'] : STATUSES['На доработке']
      })
      fstProjectId = created?.id
    } catch { /* проект уже может существовать */ }

    // Сохранить решение ИК
    await saveDecision({
      name: decisionName,
      votesAgainst,
      conditions: sess.conclusion || '',
      meetingDate: new Date().toISOString(),
      projectId: fstProjectId,
      decisionId: approved ? 1129 : 1133  // Одобрено / Отклонено (справочник 1090)
    })
  } catch (err) {
    console.warn('saveDecisionToFst failed:', err.message)
  }
}

// Watch for phase changes to scroll timeline
watch(() => session.value?.arguments?.length, () => {
  nextTick(() => {
    if (timelineEl.value) {
      timelineEl.value.scrollTop = timelineEl.value.scrollHeight
    }
  })
})

onUnmounted(() => {
  if (engine) engine.stop()
})
</script>

<style scoped>
/* ── Root ─────────────────────────────────────────────────── */
.fst-committee {
  min-height: 100vh;
  background: var(--p-surface-ground);
  color: var(--p-text-color);
  font-family: 'Inter', sans-serif;
}

/* ── Pre-session ──────────────────────────────────────────── */
.fst-pre-session {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
}
.fst-pre-logo {
  text-align: center;
}
.fst-pre-logo h1 {
  font-size: 36px;
  font-weight: 700;
  color: #ffa726;
  margin: 12px 0 4px;
}
.fst-pre-logo h2 {
  font-size: 20px;
  font-weight: 400;
  color: var(--p-text-muted-color);
  margin: 0 0 12px;
}
.fst-pre-logo p {
  color: var(--p-text-muted-color);
  margin-bottom: 16px;
}

/* Pre-session policy preview */
.fst-pre-policy {
  background: var(--p-surface-card);
  border: 1px solid var(--p-surface-border);
  border-radius: 10px;
  padding: 14px 18px;
  margin: 0 auto 4px;
  max-width: 520px;
  width: 100%;
  text-align: left;
}
.fst-pre-policy-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  font-weight: 600;
  color: var(--p-text-color);
  margin-bottom: 10px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--p-surface-border);
}
.fst-pre-policy-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px 16px;
}
.fst-pre-policy-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  gap: 8px;
}
.fst-pre-policy-label { color: var(--p-text-muted-color); }
.fst-pre-policy-val { font-weight: 600; color: var(--p-text-color); }

/* ── FST Policy Panel ──────────────────────────────────────── */
.fst-policy-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  padding: 6px 0;
  border-top: 1px solid var(--p-content-border-color);
}
.fst-policy-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px 20px;
  margin-top: 10px;
  padding: 10px;
  background: var(--p-surface-section);
  border-radius: 8px;
}
.fst-policy-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.fst-policy-label {
  font-size: 12px;
  color: var(--p-text-muted-color);
}
.fst-policy-label b {
  color: var(--p-text-color);
}
.fst-policy-slider {
  width: 100%;
}

/* ── Lobby ────────────────────────────────────────────────── */
.fst-intro {
  margin-bottom: 8px;
}
.fst-intro-badge {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  font-weight: 600;
  margin-bottom: 8px;
  color: #ffa726;
}
.fst-intro-text {
  font-size: 13px;
  color: var(--p-text-muted-color);
  line-height: 1.6;
  margin: 0 0 12px;
}
.fst-intro-subfunds {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.fst-subfund-badge {
  border: 1px solid;
  border-radius: 6px;
  padding: 4px 10px;
  font-size: 12px;
  display: flex;
  align-items: center;
  gap: 5px;
}
.fst-subfund-budget {
  font-size: 11px;
  opacity: 0.7;
  margin-left: 4px;
}
.fst-lobby-label {
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 10px;
  color: var(--p-text-muted-color);
}
.fst-project-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 360px;
  overflow-y: auto;
}
.fst-project-card {
  border: 1px solid var(--p-surface-border);
  border-radius: 8px;
  padding: 10px 14px;
  cursor: pointer;
  transition: all 0.2s;
  background: var(--p-surface-card);
}
.fst-project-card:hover {
  border-color: #42a5f5;
  background: var(--p-surface-hover);
}
.fst-project-card--active {
  border-color: #ffa726;
  background: var(--p-surface-hover);
}
.fst-pc-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}
.fst-pc-subfund {
  font-size: 10px;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 3px;
  color: #fff;
}
.fst-pc-stage {
  font-size: 11px;
  color: var(--p-text-muted-color);
}
.fst-pc-amount {
  margin-left: auto;
  font-size: 12px;
  font-weight: 600;
  color: #ffd54f;
}
.fst-pc-title {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 3px;
}
.fst-pc-company {
  font-size: 11px;
  color: var(--p-text-muted-color);
  margin-bottom: 6px;
}
.fst-pc-metrics {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.fst-metric {
  font-size: 11px;
  padding: 2px 7px;
  border-radius: 4px;
  font-weight: 500;
}
.metric--good { background: rgba(76,175,80,0.15); color: #4caf50; }
.metric--warn { background: rgba(255,167,38,0.15); color: #ffa726; }
.metric--bad  { background: rgba(239,83,80,0.15);  color: #ef5350; }

.fst-speed-row {
  display: flex;
  gap: 8px;
}
.fst-speed-btn {
  padding: 6px 14px;
  border: 1px solid #333;
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
  transition: all 0.15s;
}
.fst-speed-btn.active {
  border-color: #42a5f5;
  background: rgba(66,165,245,0.12);
  color: #42a5f5;
}

/* ── Dashboard Layout ─────────────────────────────────────── */
.fst-dashboard {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
}

/* ── Toolbar ──────────────────────────────────────────────── */
.fst-toolbar {
  display: flex;
  align-items: center;
  padding: 0 16px;
  height: 52px;
  border-bottom: 1px solid var(--p-surface-border);
  background: var(--p-surface-ground);
  flex-shrink: 0;
  gap: 12px;
}
.fst-toolbar-left {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 200px;
}
.fst-logo {
  font-size: 13px;
  font-weight: 700;
  color: #ffa726;
  white-space: nowrap;
  display: flex;
  align-items: center;
  gap: 6px;
}
.fst-project-name {
  font-size: 12px;
  color: var(--p-text-muted-color);
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.fst-toolbar-center {
  flex: 1;
  display: flex;
  justify-content: center;
}
.fst-toolbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
}
.fst-phase-track {
  display: flex;
  align-items: flex-start;
  gap: 0;
}
.fst-phase-step {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  position: relative;
  min-width: 70px;
}
.fst-phase-step:not(:last-child)::after {
  content: '';
  position: absolute;
  top: 7px;
  left: calc(50% + 7px);
  right: calc(-50% + 7px);
  height: 1px;
  background: #2a2a2a;
}
.fst-phase-step--done::after {
  background: #42a5f5;
}
.fst-phase-dot {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 1.5px solid;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1;
  background: var(--p-surface-ground);
}
.fst-phase-step--done .fst-phase-dot,
.fst-phase-step--active .fst-phase-dot {
  background: var(--phase-color);
}
.fst-phase-label {
  font-size: 9px;
  color: var(--p-text-muted-color);
  text-align: center;
  line-height: 1.2;
  max-width: 60px;
}
.fst-phase-step--active .fst-phase-label {
  color: #fff;
  font-weight: 600;
}
.fst-phase-tag {
  font-size: 11px;
}

/* ── Main 3-column ────────────────────────────────────────── */
.fst-main {
  display: grid;
  grid-template-columns: 240px 1fr 280px;
  flex: 1;
  overflow: hidden;
  gap: 0;
}
.fst-panel-title {
  font-size: 12px;
  font-weight: 700;
  color: var(--p-text-muted-color);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  padding: 12px 14px 8px;
  border-bottom: 1px solid var(--p-surface-border);
  display: flex;
  align-items: center;
  gap: 8px;
}
.fst-panel-subtitle {
  font-size: 11px;
  font-weight: 600;
  color: var(--p-text-muted-color);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin: 12px 0 6px;
}
.fst-arg-count {
  font-size: 11px;
  color: var(--p-text-muted-color);
  font-weight: 400;
  margin-left: auto;
}

/* ── Agents Panel ─────────────────────────────────────────── */
.fst-agents-panel {
  border-right: 1px solid #1e2230;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}
.fst-agents-list {
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.fst-agent-card {
  border: 1px solid var(--p-surface-border);
  border-radius: 8px;
  padding: 8px 10px;
  display: flex;
  align-items: flex-start;
  gap: 8px;
  transition: all 0.2s;
  background: var(--p-surface-card);
  position: relative;
}
.fst-agent-card--thinking {
  border-color: var(--agent-color);
  box-shadow: 0 0 8px rgba(66,165,245,0.15);
}
.fst-agent-card--voted {
  opacity: 0.85;
}
.fst-agent-avatar {
  position: relative;
  font-size: 20px;
  flex-shrink: 0;
  line-height: 1;
}
.fst-agent-thinking-pulse {
  position: absolute;
  top: -2px; right: -2px;
  width: 8px; height: 8px;
  border-radius: 50%;
  background: var(--agent-color, #42a5f5);
  animation: pulse 1s infinite;
}
@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(1.4); }
}
.fst-agent-info {
  flex: 1;
  min-width: 0;
}
.fst-agent-name {
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--agent-color);
}
.fst-agent-role-label {
  font-size: 10px;
  color: var(--p-text-muted-color);
  line-height: 1.3;
  margin-top: 2px;
}
.fst-agent-think-text {
  font-size: 10px;
  color: #42a5f5;
  font-style: italic;
  margin-top: 3px;
  display: flex;
  align-items: center;
  gap: 4px;
}
.fst-agent-vote-badge {
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 4px;
  color: #fff;
  margin-top: 4px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.fst-agent-ready {
  font-size: 10px;
  color: #4caf50;
  margin-top: 3px;
  display: flex;
  align-items: center;
  gap: 3px;
}
.fst-agent-weight {
  font-size: 10px;
  color: var(--p-text-muted-color);
  align-self: center;
  flex-shrink: 0;
}

/* ── Project Mini ─────────────────────────────────────────── */
.fst-project-mini {
  margin: auto 8px 8px;
  border: 1px solid var(--p-surface-border);
  border-radius: 8px;
  padding: 10px 12px;
  background: var(--p-surface-card);
}
.fst-project-mini-title {
  font-size: 11px;
  font-weight: 600;
  margin-bottom: 8px;
  line-height: 1.3;
  color: var(--p-text-color);
}
.fst-project-mini-row {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: var(--p-text-muted-color);
  padding: 2px 0;
}
.fst-project-mini-row strong { color: #ffd54f; }

/* ── Debate Panel ─────────────────────────────────────────── */
.fst-debate-panel {
  overflow: hidden;
  display: flex;
  flex-direction: column;
  border-right: 1px solid #1e2230;
}
.fst-timeline {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
  scroll-behavior: smooth;
}

/* Loading phase */
.fst-loading-phase {
  padding: 16px;
  background: var(--p-surface-card);
  border-radius: 10px;
  margin-bottom: 12px;
}
.fst-loading-title {
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 12px;
  color: #42a5f5;
  display: flex;
  align-items: center;
  gap: 8px;
}
.fst-loading-agent {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.fst-la-avatar { font-size: 16px; }
.fst-la-bar-wrap { flex: 1; }
.fst-la-name { font-size: 10px; color: var(--p-text-muted-color); margin-bottom: 3px; }
.fst-la-bar {
  height: 4px;
  background: var(--p-surface-border);
  border-radius: 2px;
  overflow: hidden;
}
.fst-la-bar-fill {
  height: 100%;
  border-radius: 2px;
  transition: width 0.5s ease;
}
.fst-la-status { font-size: 12px; }

/* Arguments */
.fst-args-stream {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.fst-argument {
  border: 1px solid var(--p-surface-border);
  border-radius: 8px;
  padding: 10px 12px;
  background: var(--p-surface-card);
  transition: all 0.3s;
}
.fst-argument--counter {
  margin-left: 20px;
  border-left: 2px solid #7e57c2;
  background: var(--p-surface-section);
}
.fst-arg-type--challenge {
  border-color: rgba(239,83,80,0.3);
}
.fst-arg-type--counter {
  border-color: rgba(126,87,194,0.3);
}
.fst-arg-type--summary {
  border-color: rgba(102,187,106,0.2);
  background: var(--p-surface-ground);
}
.fst-arg-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
}
.fst-arg-avatar { font-size: 14px; }
.fst-arg-agent-name { font-size: 11px; font-weight: 600; }
.fst-arg-type-badge {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 3px;
  background: var(--p-surface-border);
  color: var(--p-text-muted-color);
}
.fst-arg-dim {
  font-size: 10px;
  color: var(--p-text-muted-color);
  margin-left: auto;
}
.fst-arg-text {
  font-size: 12px;
  line-height: 1.6;
  color: var(--p-text-color);
}

/* Vote stream */
.fst-vote-stream {
  margin-top: 16px;
  padding: 12px;
  background: var(--p-surface-card);
  border-radius: 10px;
  border: 1px solid var(--p-surface-border);
}
.fst-vote-title {
  font-size: 12px;
  font-weight: 600;
  margin-bottom: 10px;
  color: #26c6da;
  display: flex;
  align-items: center;
  gap: 6px;
}
.fst-vote-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}
.fst-vote-avatar { font-size: 14px; }
.fst-vote-name { font-size: 11px; font-weight: 600; min-width: 55px; }
.fst-vote-pill-sm {
  font-size: 10px;
  padding: 2px 8px;
  border-radius: 4px;
  color: #fff;
}
.fst-vote-score { font-size: 11px; color: var(--p-text-muted-color); min-width: 40px; }
.fst-vote-conf-bar {
  flex: 1;
  height: 4px;
  background: var(--p-surface-border);
  border-radius: 2px;
  overflow: hidden;
}
.fst-vote-conf-bar > div {
  height: 100%;
  border-radius: 2px;
  transition: width 0.5s ease;
}

/* Empty state */
.fst-empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 200px;
  color: var(--p-text-muted-color);
  font-size: 13px;
}

/* Argument animation */
.fst-arg-enter-active { transition: all 0.4s ease; }
.fst-arg-enter-from { opacity: 0; transform: translateY(10px); }

/* ── Score Panel ──────────────────────────────────────────── */
.fst-score-panel {
  overflow-y: auto;
  padding: 0 12px 12px;
  display: flex;
  flex-direction: column;
}

.fst-radar-container {
  padding: 8px 0;
  display: flex;
  justify-content: center;
}
.fst-radar-svg {
  width: 160px;
  height: 160px;
}

.fst-dim-bars {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 12px;
}
.fst-dim-bar-row {
  display: flex;
  align-items: center;
  gap: 6px;
}
.fst-dim-label {
  font-size: 10px;
  color: var(--p-text-muted-color);
  min-width: 70px;
}
.fst-dim-bar-bg {
  flex: 1;
  height: 5px;
  background: var(--p-surface-border);
  border-radius: 3px;
  overflow: hidden;
}
.fst-dim-bar-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.5s ease;
}
.fst-dim-value {
  font-size: 10px;
  font-weight: 600;
  min-width: 24px;
  text-align: right;
}

/* Aggregate score */
.fst-agg-score {
  text-align: center;
  padding: 12px;
  border: 1px solid var(--p-surface-border);
  border-radius: 10px;
  margin-bottom: 12px;
  background: var(--p-surface-card);
}
.fst-agg-score-label {
  font-size: 11px;
  color: var(--p-text-muted-color);
  margin-bottom: 4px;
}
.fst-agg-score-value {
  font-size: 42px;
  font-weight: 700;
  line-height: 1;
  margin-bottom: 8px;
}
.fst-agg-rec {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 16px;
  border-radius: 20px;
  color: #fff;
  font-size: 13px;
  font-weight: 600;
}

/* Vote distribution */
.fst-vote-dist {
  margin-bottom: 12px;
}
.fst-vote-dist-bars {
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.fst-vote-dist-row {
  display: flex;
  align-items: center;
  gap: 6px;
}
.fst-vd-label {
  font-size: 11px;
  color: var(--p-text-muted-color);
  min-width: 65px;
}
.fst-vd-bar-bg {
  flex: 1;
  height: 8px;
  background: var(--p-surface-border);
  border-radius: 4px;
  overflow: hidden;
}
.fst-vd-bar-fill {
  height: 100%;
  border-radius: 4px;
  transition: width 0.5s ease;
}
.fst-vd-count {
  font-size: 11px;
  color: var(--p-text-muted-color);
  min-width: 14px;
  text-align: right;
}

/* Conditions & Risks */
.fst-cond-list, .fst-risk-list {
  list-style: none;
  padding: 0;
  margin: 0;
}
.fst-cond-item, .fst-risk-item {
  font-size: 11px;
  color: var(--p-text-muted-color);
  padding: 3px 0;
  display: flex;
  gap: 5px;
  align-items: flex-start;
  line-height: 1.4;
}
.fst-conditions { margin-bottom: 12px; }
.fst-risks { margin-bottom: 12px; }

/* Human approval panel */
.fst-human-panel {
  border: 1px solid rgba(255,167,38,0.3);
  border-radius: 10px;
  padding: 12px;
  background: rgba(255,167,38,0.05);
  margin-top: auto;
}
.fst-human-prompt {
  font-size: 11px;
  color: var(--p-text-muted-color);
  line-height: 1.5;
  margin: 6px 0 10px;
}
.fst-human-comment-row {
  margin-bottom: 10px;
}
.fst-human-comment {
  width: 100%;
  font-size: 12px;
}
.fst-human-buttons {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.fst-human-buttons .p-button {
  flex: 1;
  min-width: 0;
  font-size: 12px;
}

/* Vote pills in conclusion */
.fst-votes-summary { display: flex; gap: 8px; flex-wrap: wrap; }
.fst-vote-pill {
  font-size: 12px;
  padding: 4px 12px;
  border-radius: 12px;
  color: #fff;
}

/* Conclusion */
.fst-conclusion { text-align: center; }
.fst-conclusion-score {
  font-size: 56px;
  font-weight: 700;
  line-height: 1;
  margin-bottom: 12px;
}
.fst-conclusion-recommendation {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 20px;
  border-radius: 20px;
  color: #fff;
  font-size: 15px;
  font-weight: 700;
  margin-bottom: 16px;
}
.fst-conclusion-section {
  text-align: left;
  margin-bottom: 12px;
}
.fst-conclusion-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--p-text-muted-color);
  margin-bottom: 6px;
  text-transform: uppercase;
}
.fst-conditions-list {
  font-size: 12px;
  color: var(--p-text-muted-color);
  padding-left: 16px;
}
.fst-conditions-list li { margin-bottom: 4px; }
.fst-human-result {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #4caf50;
  margin-top: 12px;
  justify-content: center;
}

</style>
