<template>
  <FstPageLayout>
    <!-- Header -->
    <template #header>
      <div style="display:flex;align-items:center;gap:12px;flex:1">
        <i class="pi pi-sitemap" style="color:#a855f7;font-size:20px"></i>
        <div>
          <div style="font-weight:700;font-size:15px">Software Ontology Model · VentureOS</div>
          <div style="font-size:11px;color:var(--p-text-muted-color)">
            Платформа мониторит сама себя — событийная модель кодовой базы
          </div>
        </div>
        <Tag :value="`Health ${stats.avgHealth}%`"
          :severity="stats.avgHealth >= 70 ? 'success' : stats.avgHealth >= 40 ? 'warn' : 'danger'"
          style="margin-left:8px" />
      </div>
      <div style="display:flex;gap:8px;align-items:center">
        <Button label="Добавить событие" icon="pi pi-plus" size="small" severity="secondary"
          @click="showAddEvent = true" :disabled="!selectedModule" />
        <Button icon="pi pi-home" label="ФСТ" size="small" text severity="secondary"
          @click="$router.push('/fst-hub')" />
      </div>
    </template>

    <!-- Platform KPIs -->
    <div class="sm-kpis">
      <div v-for="k in kpis" :key="k.label" class="sm-kpi">
        <i :class="k.icon" :style="{ color: k.color, fontSize:'18px' }"></i>
        <div class="sm-kpi-val" :style="{ color: k.color }">{{ k.val }}</div>
        <div class="sm-kpi-label">{{ k.label }}</div>
      </div>
    </div>

    <!-- Coverage bars -->
    <div class="sm-coverage">
      <div v-for="c in coverage" :key="c.label" class="sm-cov-item">
        <div class="sm-cov-label">
          <i :class="c.icon" :style="{ color: c.color }"></i>
          <span>{{ c.label }}</span>
          <b :style="{ color: c.color }">{{ c.pct }}%</b>
        </div>
        <ProgressBar :value="c.pct" :showValue="false" style="height:6px"
          :style="{ '--p-progressbar-value-background': c.color }" />
      </div>
    </div>

    <!-- Main 3-col layout -->
    <div class="sm-main">

      <!-- Col 1: Module list -->
      <div class="sm-col">
        <div class="sm-section-title">
          <i class="pi pi-list" style="color:#a855f7"></i>
          Модули ({{ stats.total }})
          <span style="margin-left:auto;font-size:10px;color:var(--p-text-muted-color)">
            {{ stats.criticalGaps }} critical gap(s)
          </span>
        </div>

        <!-- Phase filter -->
        <div class="sm-phase-filter">
          <button v-for="ph in phaseOptions" :key="ph"
            :class="['sm-phase-btn', { 'sm-phase-btn--active': phaseFilter === ph }]"
            @click="phaseFilter = ph">
            {{ ph === 'all' ? 'Все' : ph }}
          </button>
        </div>

        <div class="sm-module-list">
          <div v-for="m in filteredModules" :key="m.id"
            :class="['sm-module-row', { 'sm-module-row--selected': selectedModule?.id === m.id }]"
            @click="selectedModule = m">
            <div class="sm-mod-health-dot" :style="{ background: hColor(m.health) }"></div>
            <div class="sm-mod-info">
              <div class="sm-mod-name">{{ m.state.name || m.id }}</div>
              <div class="sm-mod-path">{{ m.state.path || '' }}</div>
            </div>
            <div class="sm-mod-badges">
              <span v-if="m.state.hasEventStore" class="sm-badge sm-badge--green" title="EventStore">E</span>
              <span v-else class="sm-badge sm-badge--red" title="Нет EventStore">!</span>
              <span v-if="m.state.hasAI" class="sm-badge sm-badge--yellow" title="AI">AI</span>
              <span v-if="m.state.testCount > 0" class="sm-badge sm-badge--blue" title="Тесты">T</span>
            </div>
            <div class="sm-mod-score" :style="{ color: hColor(m.health) }">{{ m.health }}</div>
          </div>
        </div>
      </div>

      <!-- Col 2: Selected module detail -->
      <div class="sm-col sm-col-center">
        <div v-if="selectedModule" class="sm-detail">
          <div class="sm-section-title">
            <div class="sm-health-ring" :style="{ '--hc': hColor(selectedModule.health) }">
              {{ selectedModule.health }}
            </div>
            <div>
              <div style="font-weight:700;font-size:14px">{{ selectedModule.state.name || selectedModule.id }}</div>
              <div style="font-size:11px;color:var(--p-text-muted-color)">{{ selectedModule.state.path }}</div>
            </div>
          </div>

          <!-- State metrics -->
          <div class="sm-state-grid">
            <div v-for="s in stateMetrics" :key="s.label" class="sm-state-item">
              <i :class="s.icon" :style="{ color: s.color }"></i>
              <div class="sm-state-val" :style="{ color: s.color }">{{ s.val }}</div>
              <div class="sm-state-label">{{ s.label }}</div>
            </div>
          </div>

          <!-- Gaps -->
          <div v-if="selectedGaps.length" class="sm-gaps">
            <div class="sm-section-title" style="margin-bottom:8px">
              <i class="pi pi-exclamation-triangle" style="color:#ef4444"></i> Пробелы
            </div>
            <div v-for="g in selectedGaps" :key="g.id" class="sm-gap-row">
              <i :class="g.icon" :style="{ color: g.color, fontSize:'12px' }"></i>
              <div class="sm-gap-info">
                <div class="sm-gap-label">{{ g.label }}</div>
                <div class="sm-gap-desc">{{ g.description }}</div>
              </div>
              <Tag :value="g.severity" size="small"
                :severity="g.severity === 'critical' ? 'danger' : g.severity === 'high' ? 'warn' : 'info'" />
            </div>
          </div>

          <!-- Next actions -->
          <div v-if="selectedNext.length" class="sm-next">
            <div class="sm-section-title" style="margin-bottom:8px">
              <i class="pi pi-arrow-right" style="color:#a855f7"></i> Следующие шаги
            </div>
            <div v-for="n in selectedNext" :key="n.type" class="sm-next-row">
              <i :class="n.icon" :style="{ color: n.color, fontSize:'12px' }"></i>
              <div class="sm-next-info">
                <div class="sm-next-label">{{ n.label }}</div>
                <div class="sm-next-reason">{{ n.reason }}</div>
              </div>
              <Tag :value="n.priority" size="small"
                :severity="n.priority === 'critical' ? 'danger' : n.priority === 'high' ? 'warn' : 'info'" />
            </div>
          </div>

          <div v-if="!selectedGaps.length && !selectedNext.length" class="sm-ok">
            <i class="pi pi-check-circle" style="color:#4caf50;font-size:24px"></i>
            <div>Модуль здоров — нет критических пробелов</div>
          </div>

          <!-- Event timeline -->
          <div class="sm-section-title" style="margin-top:16px">
            <i class="pi pi-list" style="color:#64748b"></i> Лента событий
          </div>
          <div class="sm-timeline">
            <div v-for="e in selectedTimeline" :key="e.id" class="sm-timeline-row">
              <i :class="evIcon(e.type)" :style="{ color: evColor(e.type), fontSize:'11px' }" />
              <span class="sm-tl-type">{{ evLabel(e.type) }}</span>
              <span class="sm-tl-ts">{{ fmtTs(e.ts) }}</span>
            </div>
            <div v-if="!selectedTimeline.length" style="font-size:12px;color:var(--p-text-muted-color);padding:8px 0">
              Нет событий — модуль ещё не seed-ирован
            </div>
          </div>
        </div>

        <div v-else class="sm-hint">
          <i class="pi pi-hand-pointer" style="font-size:28px;color:#444"></i>
          <div>Выберите модуль из списка</div>
        </div>
      </div>

      <!-- Col 3: Critical modules + platform issues -->
      <div class="sm-col">
        <div class="sm-section-title">
          <i class="pi pi-exclamation-triangle" style="color:#ef4444"></i>
          Критические модули
        </div>

        <div v-for="id in stats.criticalModules" :key="id" class="sm-critical-row"
          @click="selectById(id)">
          <div class="sm-crit-dot" :style="{ background: '#ef4444' }"></div>
          <span>{{ id }}</span>
          <Tag :value="`health ${getHealthById(id)}`" severity="danger" size="small" />
        </div>
        <div v-if="!stats.criticalModules?.length" style="font-size:12px;color:var(--p-text-muted-color)">
          Нет критических модулей
        </div>

        <!-- No eventStore -->
        <div class="sm-section-title" style="margin-top:16px">
          <i class="pi pi-link" style="color:#fbbf24"></i> Без EventStore ({{ noEventStoreModules.length }})
        </div>
        <div v-for="m in noEventStoreModules" :key="m.id" class="sm-issue-row"
          @click="selectedModule = m">
          <span class="sm-issue-name">{{ m.id }}</span>
          <Tag value="no store" severity="warn" size="small" />
        </div>

        <!-- No tests -->
        <div class="sm-section-title" style="margin-top:16px">
          <i class="pi pi-check-square" style="color:#ef4444"></i> Без тестов ({{ noTestModules.length }})
        </div>
        <div v-for="m in noTestModules" :key="m.id" class="sm-issue-row"
          @click="selectedModule = m">
          <span class="sm-issue-name">{{ m.id }}</span>
          <Tag value="no tests" severity="danger" size="small" />
        </div>

        <!-- Causal gaps summary -->
        <div class="sm-section-title" style="margin-top:16px">
          <i class="pi pi-search" style="color:#a855f7"></i> Онтологический анализ
        </div>
        <div class="sm-ontology-summary">
          <div class="sm-on-row">
            <span>EventStore coverage</span>
            <b :style="{ color: coveragePct('eventStore') >= 80 ? '#4caf50' : '#ffa726' }">
              {{ coveragePct('eventStore') }}%
            </b>
          </div>
          <div class="sm-on-row">
            <span>Test coverage</span>
            <b :style="{ color: coveragePct('tests') >= 50 ? '#4caf50' : '#ef4444' }">
              {{ coveragePct('tests') }}%
            </b>
          </div>
          <div class="sm-on-row">
            <span>AI coverage</span>
            <b :style="{ color: coveragePct('ai') >= 40 ? '#4caf50' : '#ffa726' }">
              {{ coveragePct('ai') }}%
            </b>
          </div>
          <div class="sm-on-row">
            <span>Deploy coverage</span>
            <b style="color:#4caf50">{{ coveragePct('deploy') }}%</b>
          </div>
          <div class="sm-on-row" style="border-top:1px solid var(--p-content-border-color);margin-top:8px;padding-top:8px">
            <span>Открытые баги</span>
            <b :style="{ color: stats.totalBugs > 0 ? '#ef4444' : '#4caf50' }">{{ stats.totalBugs }}</b>
          </div>
          <div class="sm-on-row">
            <span>Critical gaps</span>
            <b :style="{ color: stats.criticalGaps > 0 ? '#ef4444' : '#4caf50' }">{{ stats.criticalGaps }}</b>
          </div>
          <div class="sm-on-row">
            <span>Avg health score</span>
            <b :style="{ color: hColor(stats.avgHealth) }">{{ stats.avgHealth }}/100</b>
          </div>
        </div>
      </div>

    </div>

    <!-- Add event dialog -->
    <Dialog v-model:visible="showAddEvent" header="Добавить событие" :modal="true" style="width:420px">
      <div style="display:flex;flex-direction:column;gap:12px">
        <div>
          <label style="font-size:12px;color:var(--p-text-muted-color)">Модуль</label>
          <div style="font-weight:600;margin-top:4px">{{ selectedModule?.id }}</div>
        </div>
        <div>
          <label style="font-size:12px;color:var(--p-text-muted-color)">Тип события</label>
          <Select v-model="newEventType" :options="eventTypeOptions" optionLabel="label" optionValue="id"
            style="width:100%;margin-top:4px" />
        </div>
        <div>
          <label style="font-size:12px;color:var(--p-text-muted-color)">Описание (необязательно)</label>
          <InputText v-model="newEventDesc" placeholder="Что именно..." style="width:100%;margin-top:4px" />
        </div>
      </div>
      <template #footer>
        <Button label="Отмена" text severity="secondary" @click="showAddEvent = false" />
        <Button label="Добавить" icon="pi pi-check" :disabled="!newEventType"
          @click="submitEvent" />
      </template>
    </Dialog>

  </FstPageLayout>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import FstPageLayout from '@/components/fst-shared/FstPageLayout.vue'
import { useSoftEventStore } from '@/stores/softEventStore.js'
import { healthColor } from '@/services/softModel.js'
import { SOFT_EVENT_TYPES } from '@/config/softEventTypes.js'
import { useRouter } from 'vue-router'

const router = useRouter()
const softStore = useSoftEventStore()

// ── Init ──────────────────────────────────────────────────────────────────────
onMounted(() => {
  softStore.load().catch(() => {})
  softStore.seedAll()
})

// ── Selection state ───────────────────────────────────────────────────────────
const selectedModule = ref(null)
const phaseFilter = ref('all')
const showAddEvent = ref(false)
const newEventType = ref(null)
const newEventDesc = ref('')

// ── Stats (reactive) ─────────────────────────────────────────────────────────
const stats = computed(() => softStore.stats)

// ── KPI bar ──────────────────────────────────────────────────────────────────
const kpis = computed(() => {
  const s = stats.value
  return [
    { icon: 'pi pi-sitemap',       color: '#a855f7', val: s.total || 0,                      label: 'Модулей' },
    { icon: 'pi pi-link',          color: '#10b981', val: s.withEventStore || 0,              label: 'EventStore' },
    { icon: 'pi pi-check-square',  color: '#22c55e', val: s.withTests || 0,                   label: 'С тестами' },
    { icon: 'pi pi-microchip-ai',  color: '#f59e0b', val: s.withAI || 0,                      label: 'AI-модули' },
    { icon: 'pi pi-cloud-upload',  color: '#0ea5e9', val: s.deployed || 0,                    label: 'Задеплоено' },
    { icon: 'pi pi-exclamation-triangle', color: s.totalBugs > 0 ? '#ef4444' : '#4caf50',
      val: s.totalBugs || 0, label: 'Открытых багов' },
  ]
})

// ── Coverage bars ─────────────────────────────────────────────────────────────
const coverage = computed(() => {
  const c = stats.value.coverage || {}
  return [
    { label: 'EventStore', icon: 'pi pi-link',         color: '#10b981', pct: c.eventStore || 0 },
    { label: 'Тесты',      icon: 'pi pi-check-square', color: '#22c55e', pct: c.tests || 0 },
    { label: 'AI',         icon: 'pi pi-microchip-ai', color: '#f59e0b', pct: c.ai || 0 },
    { label: 'Deploy',     icon: 'pi pi-cloud-upload', color: '#0ea5e9', pct: c.deploy || 0 },
  ]
})

function coveragePct(key) {
  return stats.value.coverage?.[key] || 0
}

// ── Phase filter ──────────────────────────────────────────────────────────────
const phaseOptions = computed(() => {
  const phases = ['all', ...new Set(softStore.KNOWN_MODULES.map(m => m.phase))]
  return phases
})

// ── Module list (filtered + sorted by health) ─────────────────────────────────
const allModules = computed(() => stats.value.modules || [])

const filteredModules = computed(() => {
  if (phaseFilter.value === 'all') return allModules.value
  return allModules.value.filter(m => m.state.phase === phaseFilter.value)
})

// ── Issues lists ─────────────────────────────────────────────────────────────
const noEventStoreModules = computed(() =>
  allModules.value.filter(m => !m.state.hasEventStore)
)
const noTestModules = computed(() =>
  allModules.value.filter(m => m.state.testCount === 0)
)

// ── Selected module detail ────────────────────────────────────────────────────
const selectedTimeline = computed(() => {
  if (!selectedModule.value) return []
  return softStore.getTimeline(selectedModule.value.id)
})

const selectedGaps = computed(() => {
  if (!selectedModule.value) return []
  return softStore.getGaps(selectedModule.value.id)
})

const selectedNext = computed(() => {
  if (!selectedModule.value) return []
  return softStore.getNextActions(selectedModule.value.id)
})

const stateMetrics = computed(() => {
  if (!selectedModule.value) return []
  const s = selectedModule.value.state
  const h = selectedModule.value.health
  return [
    { label: 'Health',      icon: 'pi pi-heart',         color: hColor(h),    val: h },
    { label: 'Фичи',        icon: 'pi pi-plus-circle',   color: '#3b82f6',    val: s.featureCount || 0 },
    { label: 'Тесты',       icon: 'pi pi-check-square',  color: '#22c55e',    val: s.testCount || 0 },
    { label: 'Баги',        icon: 'pi pi-bug',           color: s.openBugs > 0 ? '#ef4444' : '#4caf50', val: s.openBugs || 0 },
    { label: 'EventStore',  icon: 'pi pi-link',          color: s.hasEventStore ? '#10b981' : '#ef4444', val: s.hasEventStore ? '✓' : '✗' },
    { label: 'AI',          icon: 'pi pi-microchip-ai',  color: s.hasAI ? '#f59e0b' : '#94a3b8',        val: s.hasAI ? '✓' : '—' },
  ]
})

// ── Event type helpers ────────────────────────────────────────────────────────
function evIcon(type) {
  return SOFT_EVENT_TYPES[type]?.icon || 'pi pi-circle'
}
function evColor(type) {
  return SOFT_EVENT_TYPES[type]?.color || '#64748b'
}
function evLabel(type) {
  return SOFT_EVENT_TYPES[type]?.label || type
}
function hColor(score) {
  return healthColor(score)
}
function fmtTs(ts) {
  if (!ts) return '—'
  return new Date(ts).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
}

// ── Select by id ──────────────────────────────────────────────────────────────
function selectById(id) {
  const found = allModules.value.find(m => m.id === id)
  if (found) selectedModule.value = found
}

function getHealthById(id) {
  return allModules.value.find(m => m.id === id)?.health || 0
}

// ── Add event dialog ─────────────────────────────────────────────────────────
const eventTypeOptions = computed(() =>
  Object.values(SOFT_EVENT_TYPES).map(t => ({ id: t.id, label: t.label }))
)

function submitEvent() {
  if (!selectedModule.value || !newEventType.value) return
  softStore.addEvent(selectedModule.value.id, newEventType.value, {
    description: newEventDesc.value,
    manual: true,
  })
  newEventType.value = null
  newEventDesc.value = ''
  showAddEvent.value = false
  // Refresh selected module reference
  selectedModule.value = allModules.value.find(m => m.id === selectedModule.value.id) || selectedModule.value
}
</script>

<style scoped>
/* ── KPIs ──────────────────────────────────────────────────────────────────── */
.sm-kpis {
  display: flex;
  gap: 0;
  border-bottom: 1px solid var(--p-content-border-color);
}
.sm-kpi {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 14px 8px;
  gap: 4px;
  border-right: 1px solid var(--p-content-border-color);
}
.sm-kpi:last-child { border-right: none; }
.sm-kpi-val {
  font-size: 22px;
  font-weight: 700;
  line-height: 1;
}
.sm-kpi-label {
  font-size: 11px;
  color: var(--p-text-muted-color);
}

/* ── Coverage ──────────────────────────────────────────────────────────────── */
.sm-coverage {
  display: flex;
  gap: 24px;
  padding: 12px 20px;
  border-bottom: 1px solid var(--p-content-border-color);
}
.sm-cov-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.sm-cov-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--p-text-muted-color);
}
.sm-cov-label b { margin-left: auto; }

/* ── Main layout ───────────────────────────────────────────────────────────── */
.sm-main {
  display: grid;
  grid-template-columns: 260px 1fr 240px;
  gap: 0;
  min-height: calc(100vh - 220px);
}
.sm-col {
  border-right: 1px solid var(--p-content-border-color);
  padding: 14px;
  overflow-y: auto;
}
.sm-col:last-child { border-right: none; }
.sm-col-center { padding: 16px 20px; }

.sm-section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--p-text-muted-color);
  margin-bottom: 12px;
}

/* ── Phase filter ─────────────────────────────────────────────────────────── */
.sm-phase-filter {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 10px;
}
.sm-phase-btn {
  font-size: 10px;
  padding: 2px 8px;
  border-radius: 10px;
  border: 1px solid var(--p-content-border-color);
  background: transparent;
  color: var(--p-text-muted-color);
  cursor: pointer;
  transition: all 0.15s;
}
.sm-phase-btn--active {
  background: color-mix(in srgb, var(--p-primary-color) 15%, transparent);
  border-color: var(--p-primary-color);
  color: var(--p-primary-color);
}

/* ── Module list ───────────────────────────────────────────────────────────── */
.sm-module-list { display: flex; flex-direction: column; gap: 2px; }
.sm-module-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.15s;
}
.sm-module-row:hover { background: var(--surface-hover); }
.sm-module-row--selected {
  background: color-mix(in srgb, var(--p-primary-color) 10%, transparent);
  border-left: 3px solid var(--p-primary-color);
}

.sm-mod-health-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}
.sm-mod-info { flex: 1; min-width: 0; }
.sm-mod-name {
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--p-text-color);
}
.sm-mod-path {
  font-size: 10px;
  color: var(--p-text-muted-color);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.sm-mod-badges { display: flex; gap: 3px; }
.sm-badge {
  font-size: 9px;
  font-weight: 700;
  padding: 1px 5px;
  border-radius: 3px;
}
.sm-badge--green { background: rgba(16,185,129,0.15); color: #10b981; }
.sm-badge--red   { background: rgba(239,68,68,0.15);  color: #ef4444; }
.sm-badge--yellow{ background: rgba(245,158,11,0.15); color: #f59e0b; }
.sm-badge--blue  { background: rgba(34,197,94,0.15);  color: #22c55e; }

.sm-mod-score {
  font-size: 12px;
  font-weight: 700;
  min-width: 24px;
  text-align: right;
}

/* ── Detail ────────────────────────────────────────────────────────────────── */
.sm-health-ring {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  border: 3px solid var(--hc, #64748b);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 700;
  color: var(--hc, #64748b);
  flex-shrink: 0;
}

.sm-state-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin-bottom: 16px;
}
.sm-state-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 10px 6px;
  background: var(--surface-ground);
  border-radius: 6px;
  gap: 4px;
}
.sm-state-val {
  font-size: 16px;
  font-weight: 700;
}
.sm-state-label {
  font-size: 10px;
  color: var(--p-text-muted-color);
}

/* ── Gaps & Next ───────────────────────────────────────────────────────────── */
.sm-gaps, .sm-next {
  margin-bottom: 16px;
  padding: 12px;
  border-radius: 6px;
  background: var(--surface-ground);
}
.sm-gap-row, .sm-next-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 6px 0;
  border-bottom: 1px solid var(--p-content-border-color);
}
.sm-gap-row:last-child, .sm-next-row:last-child { border-bottom: none; }
.sm-gap-info, .sm-next-info { flex: 1; }
.sm-gap-label, .sm-next-label { font-size: 12px; font-weight: 600; color: var(--p-text-color); }
.sm-gap-desc, .sm-next-reason { font-size: 11px; color: var(--p-text-muted-color); margin-top: 2px; }

.sm-ok {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 20px;
  color: var(--p-text-muted-color);
  font-size: 13px;
}

/* ── Timeline ──────────────────────────────────────────────────────────────── */
.sm-timeline { display: flex; flex-direction: column; gap: 4px; }
.sm-timeline-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 6px;
  border-radius: 4px;
}
.sm-timeline-row:hover { background: var(--surface-hover); }
.sm-tl-type { flex: 1; font-size: 12px; color: var(--p-text-color); }
.sm-tl-ts { font-size: 10px; color: var(--p-text-muted-color); }

/* ── Right column ──────────────────────────────────────────────────────────── */
.sm-critical-row, .sm-issue-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 6px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
}
.sm-critical-row:hover, .sm-issue-row:hover { background: var(--surface-hover); }
.sm-crit-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
}
.sm-issue-name { flex: 1; }

.sm-ontology-summary { font-size: 12px; }
.sm-on-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 5px 0;
  color: var(--p-text-muted-color);
}

/* ── Hint ──────────────────────────────────────────────────────────────────── */
.sm-hint {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  height: 300px;
  color: var(--p-text-muted-color);
  font-size: 13px;
}

@media (max-width: 900px) {
  .sm-main { grid-template-columns: 1fr; }
  .sm-col { border-right: none; border-bottom: 1px solid var(--p-content-border-color); }
  .sm-coverage { flex-wrap: wrap; gap: 12px; }
  .sm-kpis { flex-wrap: wrap; }
  .sm-kpi { flex: 1 1 30%; }
}
</style>
