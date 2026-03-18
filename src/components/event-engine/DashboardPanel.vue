<template>
  <div class="dashboard-panel">
    <div class="panel-toolbar">
      <h3>Обзор системы</h3>
      <Button icon="pi pi-refresh" severity="secondary" text @click="loadAll" :loading="loading" />
    </div>

    <!-- Stat cards -->
    <div class="stat-cards">
      <div v-for="s in statCards" :key="s.label" class="stat-card" :style="{ borderLeftColor: s.color }">
        <div class="stat-value">{{ s.value }}</div>
        <div class="stat-label">{{ s.label }}</div>
        <i :class="s.icon" class="stat-icon" :style="{ color: s.color }"></i>
      </div>
    </div>

    <!-- Infodynamics — Второй закон Вопсона -->
    <div v-if="infodynamics" class="infodynamics-section">
      <h4><i class="pi pi-wave-pulse"></i> Инфодинамика (Второй закон Вопсона)</h4>
      <div class="info-metrics">
        <div class="info-metric-card">
          <div class="info-metric-value">{{ (infodynamics.compressionRatio * 100).toFixed(1) }}%</div>
          <div class="info-metric-label">Компрессия</div>
          <div class="info-metric-bar">
            <div class="info-metric-fill" :style="{ width: (infodynamics.compressionRatio * 100) + '%', background: crColor }"></div>
          </div>
          <div class="info-metric-hint">H={{ infodynamics.entropy }} / Hmax={{ infodynamics.maxEntropy }} бит</div>
        </div>
        <div class="info-metric-card">
          <div class="info-metric-value">{{ (infodynamics.leastActionIndex * 100).toFixed(1) }}%</div>
          <div class="info-metric-label">Наименьшее действие</div>
          <div class="info-metric-bar">
            <div class="info-metric-fill" :style="{ width: (infodynamics.leastActionIndex * 100) + '%', background: '#10b981' }"></div>
          </div>
          <div class="info-metric-hint">Доля автоматических каскадов (триггеры)</div>
        </div>
        <div class="info-metric-card">
          <div class="info-metric-value">{{ infodynamics.infomass.totalBits }}</div>
          <div class="info-metric-label">Инфомасса (бит)</div>
          <div class="info-metric-hint">{{ infodynamics.infomass.kg.toExponential(1) }} кг по M/E/I Вопсона</div>
        </div>
        <div class="info-metric-card vopson-state" :class="'state-' + infodynamics.vopsonLaw.currentState">
          <div class="info-metric-value">{{ vopsonStateLabel }}</div>
          <div class="info-metric-label">Состояние системы</div>
          <div class="info-metric-hint">{{ infodynamics.vopsonLaw.interpretation }}</div>
        </div>
      </div>

      <!-- Domain entropy breakdown -->
      <div class="domain-entropy" v-if="infodynamics.domains">
        <div v-for="(dm, name) in sortedDomains" :key="name" class="domain-bar-row">
          <span class="domain-name">{{ name }}</span>
          <div class="domain-bar">
            <div class="domain-fill entropy-fill" :style="{ width: (dm.entropy / maxDomainEntropy * 100) + '%' }" :title="'H=' + dm.entropy"></div>
            <div class="domain-fill cr-fill" :style="{ width: (dm.compressionRatio * 100) + '%', opacity: 0.5 }"></div>
          </div>
          <span class="domain-stats">{{ dm.eventCount }} / CR {{ (dm.compressionRatio * 100).toFixed(0) }}%</span>
        </div>
      </div>
    </div>

    <!-- Two-column layout -->
    <div class="dashboard-grid">
      <!-- Recent events timeline -->
      <div class="dashboard-card">
        <h4><i class="pi pi-clock"></i> Последние события</h4>
        <div v-if="recentEvents.length === 0" class="empty-hint">Нет предметных событий</div>
        <div class="timeline">
          <div v-for="ev in recentEvents" :key="ev.id" class="timeline-item">
            <div class="timeline-dot" :style="{ background: getActorColor(ev.actorId) }"></div>
            <div class="timeline-content">
              <div class="timeline-header">
                <strong>{{ ev.label }}</strong>
                <span class="timeline-time">{{ formatTime(ev.timestamp) }}</span>
              </div>
              <div class="timeline-detail">
                <Tag :value="ev.individualName || '—'" size="small" severity="info" />
                <span class="timeline-actor">{{ ev.actorName || '—' }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Individuals by concept -->
      <div class="dashboard-card">
        <h4><i class="pi pi-sitemap"></i> Индивиды по концептам</h4>
        <div v-if="conceptBreakdown.length === 0" class="empty-hint">Нет индивидов</div>
        <div class="breakdown-list">
          <div v-for="cb in conceptBreakdown" :key="cb.conceptId" class="breakdown-item">
            <div class="breakdown-bar-container">
              <div class="breakdown-label">
                <span class="concept-name">{{ cb.conceptName }}</span>
                <span class="concept-count">{{ cb.count }}</span>
              </div>
              <div class="breakdown-bar">
                <div class="breakdown-fill" :style="{ width: cb.pct + '%', background: cb.color }"></div>
              </div>
            </div>
            <div class="breakdown-individuals">
              <Tag v-for="ind in cb.individuals" :key="ind.id" :value="ind.val" size="small" severity="secondary"
                class="ind-tag" />
            </div>
          </div>
        </div>
      </div>

      <!-- Activity by actor -->
      <div class="dashboard-card">
        <h4><i class="pi pi-users"></i> Активность по акторам</h4>
        <div v-if="actorActivity.length === 0" class="empty-hint">Нет активности</div>
        <div class="activity-list">
          <div v-for="aa in actorActivity" :key="aa.actorId" class="activity-item">
            <div class="activity-header">
              <Tag :value="aa.type" size="small"
                :severity="aa.type === 'human' ? 'success' : aa.type === 'sensor' ? 'info' : 'warn'" />
              <span class="activity-name">{{ aa.actorName }}</span>
              <span class="activity-count">{{ aa.eventCount }} событий</span>
            </div>
            <div class="activity-bar">
              <div class="activity-fill" :style="{ width: aa.pct + '%' }"></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Workflow states -->
      <div class="dashboard-card">
        <h4><i class="pi pi-cog"></i> Модели и свойства</h4>
        <div v-if="modelSummary.length === 0" class="empty-hint">Нет моделей</div>
        <div class="model-summary-list">
          <div v-for="ms in modelSummary" :key="ms.modelId" class="model-summary-item"
            @click="openModel(ms.modelId)">
            <div class="model-summary-header">
              <i class="pi pi-cog"></i>
              <span>{{ ms.modelName }}</span>
              <Tag :value="ms.propertyCount + ' свойств'" size="small" severity="secondary" />
            </div>
            <div class="model-summary-props">
              <Tag v-for="p in ms.properties.slice(0, 5)" :key="p" :value="p" size="small" />
              <span v-if="ms.properties.length > 5" class="more-props">+{{ ms.properties.length - 5 }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Causal chain summary -->
    <div v-if="causalChains.length > 0" class="dashboard-card full-width">
      <h4><i class="pi pi-share-alt"></i> Причинные цепочки (Top)</h4>
      <div class="chain-list">
        <div v-for="chain in causalChains" :key="chain.id" class="chain-item">
          <div class="chain-steps">
            <span v-for="(step, idx) in chain.steps" :key="idx" class="chain-step">
              <Tag :value="step" size="small" :severity="idx === chain.steps.length - 1 ? 'success' : 'secondary'" />
              <i v-if="idx < chain.steps.length - 1" class="pi pi-arrow-right chain-arrow"></i>
            </span>
          </div>
          <span class="chain-individual">{{ chain.individualName }}</span>
        </div>
      </div>
    </div>

    <!-- Analytics Section (Item 7) -->
    <div class="dashboard-analytics" v-if="showAnalytics">
      <h4 class="analytics-title"><i class="pi pi-chart-bar"></i> Аналитика</h4>
      <div class="analytics-grid">
        <div class="dashboard-card">
          <h5>События по времени</h5>
          <canvas ref="timeChartRef" height="200"></canvas>
        </div>
        <div class="dashboard-card">
          <h5>События по акторам</h5>
          <canvas ref="actorChartRef" height="200"></canvas>
        </div>
        <div class="dashboard-card">
          <h5>Узкие места (fan-out)</h5>
          <div v-if="analyticsData?.bottlenecks?.length" class="bottleneck-list">
            <div v-for="b in analyticsData.bottlenecks" :key="b.eventId" class="bottleneck-item">
              <span class="bottleneck-name">{{ b.name }}</span>
              <Tag :value="b.effectCount + ' эффектов'" size="small" severity="warn" />
            </div>
          </div>
          <div v-else class="empty-hint">Нет узких мест</div>
        </div>
        <div class="dashboard-card">
          <h5>Триггеры</h5>
          <div v-if="analyticsData?.triggerStats" class="trigger-stats">
            <div>Всего: <strong>{{ analyticsData.triggerStats.total }}</strong></div>
            <div>Активных: <strong>{{ analyticsData.triggerStats.active }}</strong></div>
            <div>Персистентных: <strong>{{ analyticsData.triggerStats.persistent }}</strong></div>
          </div>
        </div>
      </div>
    </div>

    <!-- Кросс-доменная карта каскадов -->
    <div v-if="cascadeMap && cascadeMap.edges?.length > 0" class="dashboard-card full-width">
      <h4><i class="pi pi-sitemap"></i> Кросс-доменные каскады ({{ cascadeMap.edgeCount }} связей)</h4>
      <div class="cascade-grid">
        <div v-for="edge in cascadeMap.edges" :key="edge.trigger + edge.action" class="cascade-edge">
          <Tag :value="edge.from" size="small" severity="info" />
          <i class="pi pi-arrow-right cascade-arrow"></i>
          <Tag :value="edge.to" size="small" severity="warn" />
          <span class="cascade-action">{{ edge.action }}</span>
        </div>
      </div>
    </div>

    <!-- FSM валидация -->
    <div v-if="fsmValidation && fsmValidation.length > 0" class="dashboard-card full-width">
      <h4><i class="pi pi-verified"></i> Валидация FSM ({{ fsmValidation.length }} автоматов)</h4>
      <div class="fsm-validation-list">
        <div v-for="fsm in fsmValidation" :key="fsm.modelId" class="fsm-validation-item">
          <Tag :value="fsm.valid ? 'OK' : 'ОШИБКИ'" size="small" :severity="fsm.valid ? 'success' : 'danger'" />
          <span class="fsm-model-name">{{ fsm.modelName }}</span>
          <span class="fsm-stats">{{ fsm.stateCount }} сост. / {{ fsm.transitionCount }} перех.</span>
          <div v-if="fsm.issues?.length" class="fsm-issues">
            <div v-for="(issue, idx) in fsm.issues.slice(0, 3)" :key="idx" class="fsm-issue"
              :class="'issue-' + issue.type">
              {{ issue.msg }}
            </div>
            <span v-if="fsm.issues.length > 3" class="more-issues">+{{ fsm.issues.length - 3 }}</span>
          </div>
        </div>
      </div>
    </div>

    <div class="analytics-toggle">
      <Button :icon="showAnalytics ? 'pi pi-chevron-up' : 'pi pi-chart-bar'"
        :label="showAnalytics ? 'Скрыть аналитику' : 'Показать аналитику'"
        size="small" text @click="toggleAnalytics" />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, nextTick, inject } from 'vue'
import axios from 'axios'
import { Chart, registerables } from 'chart.js'
import Button from 'primevue/button'
import Tag from 'primevue/tag'

Chart.register(...registerables)

const API = inject('eventEngineAPI')
const openModelEditor = inject('openModelEditor')
const selectedApplicationId = inject('selectedApplicationId', ref(null))

function buildUrl(path) {
  const appId = selectedApplicationId.value
  if (!appId) return `${API}${path}`
  const sep = path.includes('?') ? '&' : '?'
  return `${API}${path}${sep}applicationId=${appId}`
}

// Cross-domain cascade map & FSM validation
const cascadeMap = ref(null)
const fsmValidation = ref([])

// Analytics (Item 7)
const showAnalytics = ref(false)
const analyticsData = ref(null)
const timeChartRef = ref(null)
const actorChartRef = ref(null)
let timeChart = null
let actorChart = null

async function toggleAnalytics() {
  showAnalytics.value = !showAnalytics.value
  if (showAnalytics.value && !analyticsData.value) {
    await loadAnalytics()
  }
}

async function loadAnalytics() {
  if (!API) return
  try {
    const res = await axios.get(`${API}/analytics`)
    analyticsData.value = res.data?.data
    await nextTick()
    renderCharts()
  } catch (err) {
    console.warn('[Dashboard] Analytics load error:', err.message)
  }
}

function renderCharts() {
  if (!analyticsData.value) return

  // Time chart (line)
  if (timeChartRef.value && analyticsData.value.eventsByTime) {
    if (timeChart) timeChart.destroy()
    const sorted = Object.entries(analyticsData.value.eventsByTime).sort(([a], [b]) => a.localeCompare(b))
    timeChart = new Chart(timeChartRef.value, {
      type: 'line',
      data: {
        labels: sorted.map(([d]) => d),
        datasets: [{ label: 'События', data: sorted.map(([, c]) => c), borderColor: '#3b82f6', fill: true, backgroundColor: 'rgba(59,130,246,0.1)', tension: 0.3 }],
      },
      options: { responsive: true, plugins: { legend: { display: false } }, scales: { x: { display: sorted.length <= 20 } } },
    })
  }

  // Actor chart (bar)
  if (actorChartRef.value && analyticsData.value.eventsByActor) {
    if (actorChart) actorChart.destroy()
    const entries = Object.entries(analyticsData.value.eventsByActor).sort(([, a], [, b]) => b - a).slice(0, 10)
    const colors = ['#3b82f6', '#f59e0b', '#10b981', '#8b5cf6', '#ef4444', '#06b6d4', '#f97316', '#84cc16', '#ec4899', '#6366f1']
    actorChart = new Chart(actorChartRef.value, {
      type: 'bar',
      data: {
        labels: entries.map(([n]) => n),
        datasets: [{ label: 'События', data: entries.map(([, c]) => c), backgroundColor: entries.map((_, i) => colors[i % colors.length]) }],
      },
      options: { responsive: true, plugins: { legend: { display: false } }, indexAxis: 'y' },
    })
  }
}

const loading = ref(false)
const stats = ref({})
const events = ref([])
const individuals = ref([])
const concepts = ref([])
const actors = ref([])
const models = ref([])
const modelEvents = ref([])

// Infodynamics (Vopson)
const infodynamics = ref(null)

const crColor = computed(() => {
  if (!infodynamics.value) return '#999'
  const cr = infodynamics.value.compressionRatio
  if (cr > 0.5) return '#10b981'
  if (cr > 0.2) return '#f59e0b'
  return '#ef4444'
})

const vopsonStateLabel = computed(() => {
  const state = infodynamics.value?.vopsonLaw?.currentState
  return state === 'equilibrium' ? 'Равновесие' : state === 'converging' ? 'Сходимость' : 'Хаос'
})

const sortedDomains = computed(() => {
  if (!infodynamics.value?.domains) return {}
  const entries = Object.entries(infodynamics.value.domains)
    .filter(([name]) => name !== '_test')
    .sort((a, b) => b[1].eventCount - a[1].eventCount)
  return Object.fromEntries(entries)
})

const maxDomainEntropy = computed(() => {
  if (!infodynamics.value?.domains) return 1
  return Math.max(...Object.values(infodynamics.value.domains).map(d => d.entropy || 0), 1)
})

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16']

const statCards = computed(() => [
  { label: 'Концепты', value: concepts.value.length, icon: 'pi pi-sitemap', color: '#3B82F6' },
  { label: 'Модели', value: models.value.length, icon: 'pi pi-cog', color: '#10B981' },
  { label: 'Индивиды', value: individuals.value.length, icon: 'pi pi-user', color: '#F59E0B' },
  { label: 'События', value: events.value.length, icon: 'pi pi-bolt', color: '#EF4444' },
  { label: 'Акторы', value: actors.value.length, icon: 'pi pi-users', color: '#8B5CF6' },
  { label: 'Свойства', value: modelEvents.value.length, icon: 'pi pi-list', color: '#06B6D4' },
])

// Extract ISO timestamp from Причины JSON or fall back to Временная метка
function getEventISOTime(ev) {
  try {
    const causes = ev.reqs?.['Причины']?.value
    if (causes) {
      const parsed = JSON.parse(causes)
      if (parsed.t) return parsed.t
    }
  } catch { /* ignore */ }
  return ev.reqs?.['Временная метка']?.value || ''
}

const recentEvents = computed(() => {
  const sorted = [...events.value].sort((a, b) => {
    const ta = getEventISOTime(a)
    const tb = getEventISOTime(b)
    return tb.localeCompare(ta)
  })
  return sorted.slice(0, 15).map(e => {
    const indId = e.reqs?.['Индивид']?.value
    const actId = e.reqs?.['Актор']?.value
    const isoTime = getEventISOTime(e)
    return {
      id: e.id,
      label: `${e.val}: ${e.reqs?.['Значение']?.value || ''}`,
      timestamp: isoTime || e.reqs?.['Временная метка']?.value,
      individualId: indId,
      individualName: individuals.value.find(i => String(i.id) === String(indId))?.val || '—',
      actorId: actId,
      actorName: actors.value.find(a => String(a.id) === String(actId))?.val || '—',
    }
  })
})

const conceptBreakdown = computed(() => {
  const map = {}
  for (const ind of individuals.value) {
    const cId = ind.reqs?.['Концепт']?.value
    if (!map[cId]) {
      const concept = concepts.value.find(c => String(c.id) === String(cId))
      map[cId] = { conceptId: cId, conceptName: concept?.val || '—', individuals: [], count: 0 }
    }
    map[cId].individuals.push(ind)
    map[cId].count++
  }
  const arr = Object.values(map).sort((a, b) => b.count - a.count)
  const max = Math.max(...arr.map(a => a.count), 1)
  return arr.map((a, i) => ({ ...a, pct: (a.count / max) * 100, color: COLORS[i % COLORS.length] }))
})

const actorActivity = computed(() => {
  const map = {}
  for (const ev of events.value) {
    const actId = ev.reqs?.['Актор']?.value
    if (!actId) continue
    if (!map[actId]) {
      const actor = actors.value.find(a => String(a.id) === String(actId))
      map[actId] = {
        actorId: actId,
        actorName: actor?.val || '—',
        type: actor?.reqs?.['Тип']?.value || '—',
        eventCount: 0,
      }
    }
    map[actId].eventCount++
  }
  const arr = Object.values(map).sort((a, b) => b.eventCount - a.eventCount)
  const max = Math.max(...arr.map(a => a.eventCount), 1)
  return arr.map(a => ({ ...a, pct: (a.eventCount / max) * 100 }))
})

const modelSummary = computed(() => {
  return models.value.map(m => {
    const mEvents = modelEvents.value.filter(e =>
      String(e.reqs?.['Модель']?.value) === String(m.id)
    )
    return {
      modelId: m.id,
      modelName: m.val,
      propertyCount: mEvents.length,
      properties: mEvents.map(e => e.val),
    }
  }).filter(m => m.propertyCount > 0)
})

const causalChains = computed(() => {
  const chains = []
  const evMap = {}
  for (const ev of events.value) evMap[ev.id] = ev

  for (const ev of events.value) {
    let causes = []
    try { causes = JSON.parse(ev.reqs?.['Причины']?.value || '[]') } catch { /* */ }
    if (causes.length === 0) continue

    // Build chain backwards
    const steps = [ev.val + ': ' + (ev.reqs?.['Значение']?.value || '')]
    let current = causes[0]
    let depth = 0
    while (current && evMap[current] && depth < 10) {
      const causeEv = evMap[current]
      steps.unshift(causeEv.val + ': ' + (causeEv.reqs?.['Значение']?.value || ''))
      let parentCauses = []
      try { parentCauses = JSON.parse(causeEv.reqs?.['Причины']?.value || '[]') } catch { /* */ }
      current = parentCauses[0]
      depth++
    }

    if (steps.length > 1) {
      const indId = ev.reqs?.['Индивид']?.value
      chains.push({
        id: ev.id,
        steps,
        individualName: individuals.value.find(i => String(i.id) === String(indId))?.val || '—',
      })
    }
  }
  return chains.slice(0, 5)
})

function getActorColor(actorId) {
  const idx = actors.value.findIndex(a => String(a.id) === String(actorId))
  return COLORS[idx % COLORS.length] || '#999'
}

function formatTime(ts) {
  if (!ts) return '—'
  try {
    // DD.MM.YYYY HH:mm:ss → short form
    const ruMatch = ts.match?.(/^(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2}):(\d{2})/)
    if (ruMatch) return `${ruMatch[1]}.${ruMatch[2]} ${ruMatch[4]}:${ruMatch[5]}`
    // ISO string or epoch seconds
    const num = Number(ts)
    const d = (!isNaN(num) && num > 1e9 && num < 1e11) ? new Date(num * 1000) : new Date(ts)
    if (isNaN(d.getTime())) return ts
    return d.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
  } catch { return ts }
}

function openModel(modelId) {
  if (openModelEditor) openModelEditor(modelId)
}

async function loadAll() {
  loading.value = true

  // Use allSettled so one failed endpoint doesn't block others
  const empty = { data: { success: false, data: [] } }
  const safe = (p) => p.catch(() => empty)

  try {
    const [indRes, cRes, aRes, mRes, meRes] = await Promise.all([
      safe(axios.get(buildUrl('/individuals'))),
      safe(axios.get(buildUrl('/concepts'))),
      safe(axios.get(`${API}/actors`)),
      safe(axios.get(buildUrl('/models'))),
      safe(axios.get(buildUrl('/models')).then(async (r) => {
        if (!r.data.success) return { data: { success: true, data: [] } }
        const flatten = (nodes) => {
          const result = []
          for (const n of nodes) {
            result.push({ ...n, children: undefined })
            if (n.children) result.push(...flatten(n.children))
          }
          return result
        }
        const allEvents = []
        await Promise.all(r.data.data.slice(0, 10).map(async (m) => {
          try {
            const tRes = await axios.get(`${API}/models/${m.id}/tree`)
            if (tRes.data.success) allEvents.push(...flatten(tRes.data.data))
          } catch { /* skip */ }
        }))
        return { data: { success: true, data: allEvents } }
      })),
    ])

    if (indRes.data.success) individuals.value = indRes.data.data

    // Load real SOD events from global endpoint (includes hook-written devops events)
    try {
      const evRes = await axios.get(`${API}/events?limit=50`)
      if (evRes.data.success) events.value = evRes.data.data
    } catch { /* skip */ }
    if (cRes.data.success) concepts.value = cRes.data.data
    if (aRes.data.success) actors.value = aRes.data.data
    if (mRes.data.success) models.value = mRes.data.data
    if (meRes.data.success) modelEvents.value = meRes.data.data
  } catch (e) { console.error(e) }

  // Load infodynamics separately — never blocked by other endpoints
  try {
    const idRes = await axios.get(`${API}/infodynamics`)
    if (idRes.data.success) infodynamics.value = idRes.data.data
  } catch (err) {
    console.warn('[Dashboard] Infodynamics load error:', err.message)
  }

  // Load cross-domain cascade map & FSM validation (non-blocking)
  try {
    const [cmRes, fvRes] = await Promise.all([
      axios.get(`${API}/cross-domain/cascade-map`).catch(() => ({ data: { success: false } })),
      axios.get(`${API}/fsm/validate-all`).catch(() => ({ data: { success: false } })),
    ])
    if (cmRes.data.success) cascadeMap.value = cmRes.data.data
    if (fvRes.data.success) fsmValidation.value = fvRes.data.data?.results || []
  } catch { /* non-critical */ }

  loading.value = false
}

watch(selectedApplicationId, () => loadAll())
onMounted(loadAll)
</script>

<style scoped>
.dashboard-panel { max-width: 1200px; }
.panel-toolbar { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
.panel-toolbar h3 { margin: 0; }
/* Analytics (Item 7) */
.analytics-toggle { margin-top: 1rem; text-align: center; }
.analytics-title { margin: 1rem 0 0.5rem; }
.analytics-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
.bottleneck-list { display: flex; flex-direction: column; gap: 0.375rem; }
.bottleneck-item { display: flex; justify-content: space-between; align-items: center; padding: 0.25rem 0; }
.bottleneck-name { font-size: 0.85rem; }
.trigger-stats { display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.85rem; }

.stat-cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 12px; margin-bottom: 20px; }
.stat-card {
  background: var(--p-surface-card);
  border: 1px solid var(--p-surface-border);
  border-left: 4px solid;
  border-radius: 8px;
  padding: 16px;
  position: relative;
}
.stat-value { font-size: 1.8rem; font-weight: 700; line-height: 1; }
.stat-label { font-size: 0.85rem; color: var(--p-text-muted-color); margin-top: 4px; }
.stat-icon { position: absolute; top: 12px; right: 12px; font-size: 1.4rem; opacity: 0.3; }

.dashboard-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.dashboard-card {
  background: var(--p-surface-card);
  border: 1px solid var(--p-surface-border);
  border-radius: 8px;
  padding: 16px;
}
.dashboard-card.full-width { grid-column: 1 / -1; margin-top: 16px; }
.dashboard-card h4 { margin: 0 0 12px 0; display: flex; align-items: center; gap: 8px; font-size: 1rem; }
.empty-hint { color: var(--p-text-muted-color); font-size: 0.9rem; padding: 20px 0; text-align: center; }

/* Timeline */
.timeline { display: flex; flex-direction: column; gap: 2px; max-height: 400px; overflow-y: auto; }
.timeline-item { display: flex; gap: 10px; align-items: flex-start; padding: 6px 0; border-bottom: 1px solid var(--p-surface-border); }
.timeline-item:last-child { border-bottom: none; }
.timeline-dot { width: 10px; height: 10px; border-radius: 50%; margin-top: 5px; flex-shrink: 0; }
.timeline-content { flex: 1; min-width: 0; }
.timeline-header { display: flex; justify-content: space-between; gap: 8px; }
.timeline-header strong { font-size: 0.85rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.timeline-time { font-size: 0.75rem; color: var(--p-text-muted-color); flex-shrink: 0; }
.timeline-detail { display: flex; align-items: center; gap: 6px; margin-top: 2px; }
.timeline-actor { font-size: 0.8rem; color: var(--p-text-muted-color); }

/* Breakdown */
.breakdown-list { display: flex; flex-direction: column; gap: 12px; }
.breakdown-item { }
.breakdown-bar-container { }
.breakdown-label { display: flex; justify-content: space-between; margin-bottom: 4px; }
.concept-name { font-weight: 600; font-size: 0.9rem; }
.concept-count { font-weight: 700; font-size: 0.9rem; }
.breakdown-bar { height: 8px; background: var(--p-surface-200); border-radius: 4px; overflow: hidden; }
.breakdown-fill { height: 100%; border-radius: 4px; transition: width 0.3s; }
.breakdown-individuals { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 6px; }
.ind-tag { cursor: default; }

/* Activity */
.activity-list { display: flex; flex-direction: column; gap: 10px; }
.activity-item { }
.activity-header { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
.activity-name { font-weight: 500; font-size: 0.9rem; }
.activity-count { margin-left: auto; font-size: 0.8rem; color: var(--p-text-muted-color); }
.activity-bar { height: 6px; background: var(--p-surface-200); border-radius: 3px; overflow: hidden; }
.activity-fill { height: 100%; background: var(--p-primary-color); border-radius: 3px; transition: width 0.3s; }

/* Model summary */
.model-summary-list { display: flex; flex-direction: column; gap: 10px; }
.model-summary-item { padding: 8px; border-radius: 6px; cursor: pointer; transition: background 0.2s; }
.model-summary-item:hover { background: var(--p-surface-100); }
.model-summary-header { display: flex; align-items: center; gap: 8px; }
.model-summary-header span { font-weight: 500; }
.model-summary-props { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 6px; }
.more-props { font-size: 0.8rem; color: var(--p-text-muted-color); }

/* Causal chains */
.chain-list { display: flex; flex-direction: column; gap: 10px; }
.chain-item { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 8px; border-radius: 6px; background: var(--p-surface-50); }
.chain-steps { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; }
.chain-step { display: flex; align-items: center; gap: 4px; }
.chain-arrow { font-size: 0.7rem; color: var(--p-text-muted-color); }
.chain-individual { font-size: 0.85rem; color: var(--p-text-muted-color); flex-shrink: 0; }

/* Infodynamics */
.infodynamics-section {
  background: var(--p-surface-card);
  border: 1px solid var(--p-surface-border);
  border-left: 4px solid #8b5cf6;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 16px;
}
.infodynamics-section h4 { margin: 0 0 12px 0; display: flex; align-items: center; gap: 8px; color: #8b5cf6; }
.info-metrics { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px; margin-bottom: 16px; }
.info-metric-card {
  background: var(--p-surface-50);
  border-radius: 8px;
  padding: 12px;
}
.info-metric-value { font-size: 1.6rem; font-weight: 700; line-height: 1.2; }
.info-metric-label { font-size: 0.85rem; color: var(--p-text-muted-color); margin: 4px 0; }
.info-metric-bar { height: 6px; background: var(--p-surface-200); border-radius: 3px; overflow: hidden; margin: 6px 0; }
.info-metric-fill { height: 100%; border-radius: 3px; transition: width 0.5s ease; }
.info-metric-hint { font-size: 0.75rem; color: var(--p-text-muted-color); }

.vopson-state.state-equilibrium .info-metric-value { color: #10b981; }
.vopson-state.state-converging .info-metric-value { color: #f59e0b; }
.vopson-state.state-chaotic .info-metric-value { color: #ef4444; }

.domain-entropy { display: flex; flex-direction: column; gap: 6px; }
.domain-bar-row { display: flex; align-items: center; gap: 8px; }
.domain-name { width: 80px; font-size: 0.8rem; font-weight: 500; text-align: right; flex-shrink: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.domain-bar { flex: 1; height: 12px; background: var(--p-surface-200); border-radius: 6px; overflow: hidden; position: relative; }
.domain-fill { height: 100%; border-radius: 6px; position: absolute; top: 0; left: 0; }
.entropy-fill { background: #8b5cf6; }
.cr-fill { background: #10b981; }
.domain-stats { width: 100px; font-size: 0.75rem; color: var(--p-text-muted-color); flex-shrink: 0; }
/* Cascade map */
.cascade-grid { display: flex; flex-wrap: wrap; gap: 8px; }
.cascade-edge { display: flex; align-items: center; gap: 6px; padding: 6px 10px; background: var(--p-surface-100); border-radius: 8px; font-size: 0.8rem; }
.cascade-arrow { font-size: 0.7rem; color: var(--p-text-muted-color); }
.cascade-action { color: var(--p-text-muted-color); font-size: 0.75rem; }
/* FSM validation */
.fsm-validation-list { display: flex; flex-direction: column; gap: 8px; }
.fsm-validation-item { display: flex; align-items: flex-start; gap: 8px; padding: 8px; background: var(--p-surface-100); border-radius: 8px; flex-wrap: wrap; }
.fsm-model-name { font-weight: 500; font-size: 0.85rem; }
.fsm-stats { color: var(--p-text-muted-color); font-size: 0.8rem; margin-left: auto; }
.fsm-issues { width: 100%; margin-top: 4px; }
.fsm-issue { font-size: 0.75rem; padding: 2px 0; }
.issue-error { color: var(--p-red-500); }
.issue-warning { color: var(--p-yellow-600); }
.more-issues { font-size: 0.75rem; color: var(--p-text-muted-color); }
</style>
