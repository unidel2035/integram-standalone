<template>
  <div class="scenario-cc">
    <!-- Header -->
    <div class="cc-toolbar">
      <h3>Центр управления сценариями БАС</h3>
      <div class="cc-toolbar-actions">
        <Button :label="animating ? 'Стоп' : 'Запуск'" :icon="animating ? 'pi pi-pause' : 'pi pi-play'"
          :severity="animating ? 'danger' : 'success'" size="small" @click="toggleAnimation" />
        <Button icon="pi pi-refresh" severity="secondary" text size="small" @click="loadAll" :loading="loading" />
      </div>
    </div>

    <!-- Stats row -->
    <div class="cc-stats">
      <div v-for="s in stats" :key="s.label" class="cc-stat" :style="{ borderColor: s.color }">
        <div class="cc-stat-val">{{ s.value }}</div>
        <div class="cc-stat-lbl">{{ s.label }}</div>
      </div>
    </div>

    <!-- Map + scenarios layout -->
    <div class="cc-main">
      <!-- SVG Map -->
      <div class="cc-map-wrap" ref="mapWrap">
        <svg viewBox="0 0 800 450" class="cc-map" ref="svgMap">
          <!-- Russia simplified outline -->
          <path d="M80,180 L120,150 L180,140 L220,120 L280,110 L320,100 L380,95 L420,100 L460,95 L500,90 L540,85 L580,90 L620,95 L660,100 L700,110 L740,130 L760,160 L750,200 L730,230 L700,250 L660,260 L620,250 L580,240 L540,250 L500,260 L460,270 L420,280 L380,290 L340,300 L300,310 L260,300 L220,280 L180,260 L140,240 L100,220 Z"
            class="cc-russia" />

          <!-- Grid lines -->
          <g class="cc-grid" opacity="0.15">
            <line v-for="i in 8" :key="'h'+i" :x1="0" :y1="i*50" :x2="800" :y2="i*50" stroke="#4fc3f7" />
            <line v-for="i in 16" :key="'v'+i" :x1="i*50" :y1="0" :x2="i*50" :y2="450" stroke="#4fc3f7" />
          </g>

          <!-- Scenario locations -->
          <g v-for="(sc, idx) in scenarioLocations" :key="sc.id">
            <!-- Base marker (pulsing) -->
            <circle :cx="sc.x" :cy="sc.y" r="6" :fill="sc.color" opacity="0.3"
              :class="{ 'cc-pulse': activeMission === idx }" />
            <circle :cx="sc.x" :cy="sc.y" r="3" :fill="sc.color" />

            <!-- Label -->
            <text :x="sc.x" :y="sc.y - 12" text-anchor="middle" class="cc-map-label">{{ sc.shortName }}</text>

            <!-- Active mission arc -->
            <g v-if="activeMission === idx && dronePos">
              <!-- Flight path -->
              <line :x1="sc.x" :y1="sc.y" :x2="dronePos.x" :y2="dronePos.y"
                stroke="#00e5ff" stroke-width="1" stroke-dasharray="4,4" opacity="0.6" />
              <!-- Drone icon -->
              <g :transform="`translate(${dronePos.x},${dronePos.y})`">
                <polygon points="0,-8 6,4 0,1 -6,4" :fill="sc.color" stroke="#fff" stroke-width="0.5" />
                <circle r="12" fill="none" :stroke="sc.color" stroke-width="1" opacity="0.4"
                  class="cc-scan-ring" />
              </g>
            </g>

            <!-- Mission count badge -->
            <g :transform="`translate(${sc.x + 10},${sc.y - 8})`">
              <rect x="-6" y="-6" width="12" height="12" rx="6" :fill="sc.color" />
              <text x="0" y="4" text-anchor="middle" fill="#fff" font-size="8" font-weight="bold">{{ sc.missions }}</text>
            </g>
          </g>

          <!-- Event log overlay -->
          <g v-if="eventLog.length > 0" transform="translate(10,360)">
            <rect x="0" y="0" width="250" height="80" rx="4" fill="rgba(0,0,0,0.7)" />
            <text v-for="(ev, i) in eventLog.slice(-4)" :key="i" :y="15 + i * 18" x="8"
              fill="#00e5ff" font-size="10" font-family="monospace">
              {{ ev }}
            </text>
          </g>
        </svg>
      </div>

      <!-- Scenario list -->
      <div class="cc-sidebar">
        <div v-for="(sc, idx) in scenarioLocations" :key="sc.id"
          :class="['cc-scenario-card', { active: activeMission === idx }]"
          @click="selectScenario(idx)">
          <div class="cc-sc-header">
            <span class="cc-sc-icon" :style="{ background: sc.color }">{{ sc.emoji }}</span>
            <span class="cc-sc-name">{{ sc.name }}</span>
          </div>
          <div class="cc-sc-meta">
            <span class="cc-sc-missions">{{ sc.missions }} миссий</span>
            <span class="cc-sc-events">{{ sc.eventCount }} событий</span>
          </div>
          <!-- Progress bar for active mission -->
          <div v-if="activeMission === idx" class="cc-sc-progress">
            <div class="cc-sc-progress-bar" :style="{ width: missionProgress + '%', background: sc.color }"></div>
          </div>
          <!-- Event steps -->
          <div v-if="activeMission === idx && currentEvents.length" class="cc-sc-steps">
            <div v-for="(ev, ei) in currentEvents" :key="ei"
              :class="['cc-step', { done: ei < currentEventIdx, active: ei === currentEventIdx }]">
              <span class="cc-step-dot" :style="ei <= currentEventIdx ? { background: sc.color } : {}"></span>
              <span class="cc-step-name">{{ ev }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Actor activity row -->
    <div class="cc-actors">
      <h4>Акторы</h4>
      <div class="cc-actor-grid">
        <div v-for="a in actorsList" :key="a.id" class="cc-actor-chip"
          :class="'cc-actor-' + a.type">
          <span class="cc-actor-icon">{{ a.type === 'human' ? '\u{1F464}' : a.type === 'sensor' ? '\u{1F6E9}' : '\u{1F916}' }}</span>
          <span class="cc-actor-name">{{ a.name }}</span>
          <span class="cc-actor-events">{{ a.eventCount }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted, inject } from 'vue'
import axios from 'axios'
import Button from 'primevue/button'

const API = inject('eventEngineAPI', '/api/event-engine')
const selectedApplicationId = inject('selectedApplicationId', ref(null))

function buildUrl(path) {
  const appId = selectedApplicationId.value
  if (!appId) return `${API}${path}`
  const sep = path.includes('?') ? '&' : '?'
  return `${API}${path}${sep}applicationId=${appId}`
}
const loading = ref(false)

// Data
const concepts = ref([])
const models = ref([])
const individuals = ref([])
const actors = ref([])
const allModelEvents = ref({}) // modelId -> events[]

// Animation state
const animating = ref(false)
const activeMission = ref(null)
const dronePos = ref(null)
const eventLog = ref([])
const currentEvents = ref([])
const currentEventIdx = ref(0)
const missionProgress = ref(0)
let animFrame = null
let animTimeout = null

// Scenario locations on the map of Russia
const scenarioMeta = [
  { key: 'agri', shortName: 'С/Х', emoji: '\u{1F33E}', color: '#4caf50', x: 280, y: 220, pattern: 'circle' },
  { key: 'fire', shortName: 'Пожар', emoji: '\u{1F525}', color: '#f44336', x: 500, y: 150, pattern: 'patrol' },
  { key: 'pipe', shortName: 'Нефть', emoji: '\u{1F6E2}', color: '#ff9800', x: 440, y: 200, pattern: 'line' },
  { key: 'delivery', shortName: 'Доставка', emoji: '\u{1F4E6}', color: '#2196f3', x: 200, y: 200, pattern: 'point' },
  { key: 'power', shortName: 'ЛЭП', emoji: '\u{26A1}', color: '#9c27b0', x: 350, y: 180, pattern: 'line' },
  { key: 'constr', shortName: 'Стройка', emoji: '\u{1F3D7}', color: '#795548', x: 250, y: 180, pattern: 'grid' },
  { key: 'eco', shortName: 'Эко', emoji: '\u{1F30A}', color: '#00bcd4', x: 600, y: 180, pattern: 'circle' },
]

const scenarioLocations = computed(() => {
  return scenarioMeta.map((meta, idx) => {
    const concept = concepts.value[idx]
    const model = concept ? models.value.find(m => m.val === `Model_${concept.val}`) : null
    const missionCount = concept ? individuals.value.filter(ind => {
      const ref = ind.reqs?.['Концепт']
      return ref && String(ref.value) === String(concept.id)
    }).length : 0

    return {
      ...meta,
      id: concept?.id || `sc-${idx}`,
      name: concept?.val || meta.shortName,
      missions: missionCount,
      modelId: model?.id,
      eventCount: model ? flattenTree(allModelEvents.value[model.id]).length : 0,
    }
  })
})

const stats = computed(() => [
  { label: 'Сценариев', value: concepts.value.length, color: '#4fc3f7' },
  { label: 'Миссий', value: individuals.value.length, color: '#66bb6a' },
  { label: 'Модельных событий', value: Object.values(allModelEvents.value).reduce((s, a) => s + a.length, 0), color: '#ffa726' },
  { label: 'Акторов', value: actors.value.length, color: '#ab47bc' },
])

// Flatten a tree of model events into a depth-first ordered list
function flattenTree(nodes) {
  const result = []
  for (const node of (nodes || [])) {
    result.push(node)
    if (node.children?.length) {
      result.push(...flattenTree(node.children))
    }
  }
  return result
}

const actorsList = computed(() => {
  return actors.value.map(a => ({
    id: a.id,
    name: a.val,
    type: a.reqs?.['Тип']?.value || 'human',
    eventCount: 0 // Would need subject events to compute
  }))
})

async function loadAll() {
  loading.value = true
  try {
    const [cRes, mRes, iRes, aRes] = await Promise.all([
      axios.get(buildUrl('/concepts')),
      axios.get(buildUrl('/models')),
      axios.get(buildUrl('/individuals')),
      axios.get(`${API}/actors`),
    ])
    // Filter concepts to only scenarios (those that start with known patterns)
    const allConcepts = cRes.data?.data || []
    const scenarioNames = ['С/Х обработка', 'Мониторинг лесных', 'Мониторинг нефтепровода', 'Доставка мелких', 'Инспекция ЛЭП', 'Мониторинг строительства', 'Экомониторинг']
    concepts.value = scenarioNames.map(sn => allConcepts.find(c => c.val?.startsWith(sn))).filter(Boolean)
    models.value = mRes.data?.data || []
    individuals.value = iRes.data?.data || []
    actors.value = aRes.data?.data || []

    // Load model event trees for each model
    const treeMap = {}
    for (const c of concepts.value) {
      const model = models.value.find(m => m.val === `Model_${c.val}`)
      if (model) {
        try {
          const tRes = await axios.get(`${API}/models/${model.id}/tree`)
          treeMap[model.id] = tRes.data?.data || []
        } catch (e) { treeMap[model.id] = [] }
      }
    }
    allModelEvents.value = treeMap
  } catch (e) {
    console.error('[ScenarioCC] Load error:', e)
  } finally {
    loading.value = false
  }
}

function selectScenario(idx) {
  if (activeMission.value === idx) {
    activeMission.value = null
    dronePos.value = null
    currentEvents.value = []
    return
  }
  activeMission.value = idx
  startMissionAnimation(idx)
}

function startMissionAnimation(idx) {
  const sc = scenarioLocations.value[idx]
  if (!sc?.modelId) return

  const events = flattenTree(allModelEvents.value[sc.modelId])
  const flatNames = events.map(e => e.val || e.name || '?')
  currentEvents.value = flatNames
  currentEventIdx.value = 0
  missionProgress.value = 0
  eventLog.value = [`[${sc.shortName}] Миссия запущена`]

  // Animate through events
  animateEvents(idx, sc, flatNames, 0)
}

function animateEvents(idx, sc, names, step) {
  if (step >= names.length || activeMission.value !== idx) {
    if (activeMission.value === idx) {
      missionProgress.value = 100
      eventLog.value.push(`[${sc.shortName}] Миссия завершена!`)
    }
    return
  }

  currentEventIdx.value = step
  missionProgress.value = Math.round((step / names.length) * 100)
  eventLog.value.push(`> ${names[step]}`)
  if (eventLog.value.length > 20) eventLog.value.shift()

  // Move drone
  const angle = (step / names.length) * Math.PI * 2
  const radius = 30 + Math.sin(step * 0.5) * 15
  dronePos.value = {
    x: sc.x + Math.cos(angle) * radius,
    y: sc.y + Math.sin(angle) * radius
  }

  animTimeout = setTimeout(() => animateEvents(idx, sc, names, step + 1), animating.value ? 800 : 1500)
}

function toggleAnimation() {
  if (animating.value) {
    animating.value = false
    if (animTimeout) clearTimeout(animTimeout)
    activeMission.value = null
    dronePos.value = null
    currentEvents.value = []
    return
  }

  animating.value = true
  eventLog.value = ['Автоматический режим запущен']
  autoPlayNext(0)
}

function autoPlayNext(idx) {
  if (!animating.value || idx >= scenarioLocations.value.length) {
    if (animating.value && idx >= scenarioLocations.value.length) {
      // Loop
      autoPlayNext(0)
      return
    }
    animating.value = false
    return
  }

  activeMission.value = idx
  const sc = scenarioLocations.value[idx]
  const events = sc.modelId ? flattenTree(allModelEvents.value[sc.modelId]) : []
  const flatNames = events.map(e => e.val || e.name || '?')
  currentEvents.value = flatNames
  currentEventIdx.value = 0
  missionProgress.value = 0
  eventLog.value.push(`\n=== ${sc.name} ===`)

  animateEventsAuto(idx, sc, flatNames, 0)
}

function animateEventsAuto(idx, sc, names, step) {
  if (!animating.value) return

  if (step >= names.length) {
    eventLog.value.push(`[${sc.shortName}] Завершено`)
    animTimeout = setTimeout(() => autoPlayNext(idx + 1), 1500)
    return
  }

  currentEventIdx.value = step
  missionProgress.value = Math.round((step / names.length) * 100)
  eventLog.value.push(`> ${names[step]}`)
  if (eventLog.value.length > 30) eventLog.value = eventLog.value.slice(-20)

  const angle = (step / names.length) * Math.PI * 2
  const radius = 25 + Math.sin(step * 0.7) * 20
  dronePos.value = {
    x: sc.x + Math.cos(angle) * radius,
    y: sc.y + Math.sin(angle) * radius
  }

  animTimeout = setTimeout(() => animateEventsAuto(idx, sc, names, step + 1), 600)
}

watch(selectedApplicationId, () => loadAll())
onMounted(loadAll)

onUnmounted(() => {
  animating.value = false
  if (animTimeout) clearTimeout(animTimeout)
  if (animFrame) cancelAnimationFrame(animFrame)
})
</script>

<style scoped>
.scenario-cc {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.cc-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.cc-toolbar h3 { margin: 0; font-size: 16px; }
.cc-toolbar-actions { display: flex; gap: 6px; }

/* Stats */
.cc-stats {
  display: flex;
  gap: 10px;
}
.cc-stat {
  flex: 1;
  padding: 10px 14px;
  border-radius: 8px;
  border-left: 4px solid;
  background: var(--p-surface-50, #f8fafc);
}
.cc-stat-val { font-size: 24px; font-weight: 700; }
.cc-stat-lbl { font-size: 11px; color: var(--p-text-color-secondary); }

/* Main layout */
.cc-main {
  display: flex;
  gap: 12px;
  min-height: 400px;
}

/* Map */
.cc-map-wrap {
  flex: 2;
  background: #0a1628;
  border-radius: 10px;
  overflow: hidden;
  position: relative;
}
.cc-map {
  width: 100%;
  height: 100%;
}
.cc-russia {
  fill: #1a2744;
  stroke: #2d4a7c;
  stroke-width: 1.5;
}
.cc-map-label {
  fill: #b0bec5;
  font-size: 9px;
  font-family: Inter, system-ui, sans-serif;
}

/* Pulse animation */
.cc-pulse {
  animation: ccPulse 1.5s ease-in-out infinite;
}
@keyframes ccPulse {
  0% { r: 6; opacity: 0.3; }
  50% { r: 16; opacity: 0.1; }
  100% { r: 6; opacity: 0.3; }
}

/* Scan ring animation */
.cc-scan-ring {
  animation: ccScan 2s linear infinite;
}
@keyframes ccScan {
  0% { r: 8; opacity: 0.6; }
  100% { r: 25; opacity: 0; }
}

/* Sidebar */
.cc-sidebar {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 450px;
  overflow-y: auto;
}

.cc-scenario-card {
  padding: 10px;
  border-radius: 8px;
  border: 1px solid var(--p-surface-200, #e2e8f0);
  background: var(--p-content-background, #fff);
  cursor: pointer;
  transition: all 0.2s;
}
.cc-scenario-card:hover { border-color: var(--p-primary-200); }
.cc-scenario-card.active {
  border-color: var(--p-primary-400);
  background: var(--p-primary-50, #eff6ff);
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
}

.cc-sc-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}
.cc-sc-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 6px;
  font-size: 14px;
}
.cc-sc-name { font-weight: 600; font-size: 13px; }

.cc-sc-meta {
  display: flex;
  gap: 12px;
  font-size: 11px;
  color: var(--p-text-color-secondary);
}

/* Progress bar */
.cc-sc-progress {
  height: 3px;
  background: var(--p-surface-200);
  border-radius: 2px;
  margin-top: 6px;
  overflow: hidden;
}
.cc-sc-progress-bar {
  height: 100%;
  border-radius: 2px;
  transition: width 0.3s;
}

/* Steps */
.cc-sc-steps {
  margin-top: 6px;
  max-height: 180px;
  overflow-y: auto;
}
.cc-step {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 2px 0;
  font-size: 11px;
  color: var(--p-text-color-secondary);
}
.cc-step.done { color: var(--p-text-color); }
.cc-step.active { color: var(--p-primary-color); font-weight: 600; }
.cc-step-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--p-surface-300);
  flex-shrink: 0;
}

/* Actors */
.cc-actors {
  padding-top: 8px;
}
.cc-actors h4 { margin: 0 0 8px 0; font-size: 14px; }

.cc-actor-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.cc-actor-chip {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border-radius: 16px;
  font-size: 12px;
  border: 1px solid var(--p-surface-200);
  background: var(--p-content-background);
}
.cc-actor-human { border-color: #4caf50; }
.cc-actor-sensor { border-color: #2196f3; }
.cc-actor-agent { border-color: #ff9800; }
.cc-actor-icon { font-size: 14px; }
.cc-actor-name { font-weight: 500; }
.cc-actor-events {
  font-size: 10px;
  padding: 0 4px;
  border-radius: 8px;
  background: var(--p-surface-100);
}
</style>
