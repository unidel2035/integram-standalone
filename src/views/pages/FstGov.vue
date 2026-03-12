<template>
  <div class="fgov-root">

    <!-- ── Thin topbar ──────────────────────────────────────────────────── -->
    <div class="fgov-bar">
      <div class="fgov-bar-left">
        <i class="pi pi-sitemap" style="color:var(--fst-purple);font-size:15px"/>
        <span class="fgov-bar-title">GR КАНВАС</span>
        <span class="fgov-bar-sep">·</span>
        <span class="fgov-bar-sub">Government Relations — событийная карта барьеров</span>
      </div>

      <div class="fgov-bar-center">
        <Select
          v-model="selectedProject"
          :options="projects"
          optionLabel="name"
          placeholder="Проект портфеля..."
          class="fgov-select"
          showClear
          @change="onProjectChange"
        />
        <button
          v-if="selectedProject"
          class="fgov-reset-btn"
          title="Сбросить ленту событий"
          @click="tlReset"
        >
          <i class="pi pi-refresh" style="font-size:10px"/>
        </button>
      </div>

      <div class="fgov-bar-right">
        <div class="fgov-kpi">
          <span class="fgov-kpi-val" :style="{ color: bossesActive > 0 ? 'var(--fst-red)' : 'var(--fst-green)' }">
            {{ activeBossCount }}
          </span>
          <span class="fgov-kpi-lbl">барьеров</span>
        </div>
        <div class="fgov-kpi">
          <span class="fgov-kpi-val" style="color:var(--fst-brand)">{{ irrMultiplier }}x</span>
          <span class="fgov-kpi-lbl">IRR</span>
        </div>
        <div class="fgov-kpi">
          <span class="fgov-kpi-val" style="color:var(--fst-purple)">{{ tlEvents.length }}</span>
          <span class="fgov-kpi-lbl">событий</span>
        </div>
        <Button icon="pi pi-home" label="Хаб" size="small" text severity="secondary"
          style="font-size:11px" @click="$router.push('/fst-hub')" />
      </div>
    </div>

    <!-- ── Canvas fills the rest ────────────────────────────────────────── -->
    <div class="fgov-canvas-wrap">
      <GrEventCanvas
        :company="arenaCompany"
        :events="tlEvents"
        :possible="tlPossible"
        :scenarios="DEMO_SCENARIOS"
        @attack="tlApplyEvent"
        @apply-scenario="applyScenarioEvents"
      />
    </div>

  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { useRoute } from 'vue-router'
import Button from 'primevue/button'
import Select from 'primevue/select'
import GrEventCanvas from '@/components/gr/GrEventCanvas.vue'
import { GR_BOSSES, getBossState } from '@/config/grBosses.js'
import { useToast } from 'primevue/usetoast'
import { getProjects } from '@/services/fstApi.js'
import { useGrEventStore } from '@/stores/grEventStore.js'

const toast  = useToast()
const route  = useRoute()

// ── Data layer (same as before) ─────────────────────────────────────────────
const selectedProject = ref(null)
const projects        = ref([])
const projectsLoading = ref(false)

const SUBFUND_NAMES = { 1096: 'БАС', 1098: 'РОБО', 1100: 'МЭ' }
const STAGE_NAMES   = { 1115: 'Pre-seed', 1117: 'Посевная', 1119: 'Раунд A', 1123: 'На доработке', 1125: 'В работе', 1127: 'Закрыт' }

const arenaCompany = computed(() => {
  const p = selectedProject.value
  if (!p) return null
  return {
    id:       p.id,
    name:     p.name || p.id,
    trl:      p.trl || 4,
    stage:    p.stageName || p.stage || 'Посевная',
    runway:   p.runway || 12,
    riskLevel: p.riskLevel || 'green',
    subfund:  p.subFundName || p.subfund || 'БАС',
  }
})

// ── Event store ─────────────────────────────────────────────────────────────
const grEventStore = useGrEventStore()

const tlProjectId = computed(() =>
  selectedProject.value ? String(selectedProject.value.id) : 'demo'
)

function tlProjectParams() {
  const p = selectedProject.value
  if (!p) return { trl: 2, sector: 'БАС', name: 'Демо-проект БАС' }
  return {
    trl:    p.trl || 4,
    sector: p.subFundName || 'БАС',
    name:   p.name || p.id,
    stage:  p.stageName || 'Посевная',
  }
}

async function ensureDemoTimeline() {
  await grEventStore.load(tlProjectId.value)
  if (!grEventStore.getTimeline(tlProjectId.value).length) {
    grEventStore.initProject(tlProjectId.value, tlProjectParams())
  }
}

const tlEvents   = computed(() => grEventStore.getTimeline(tlProjectId.value))
const tlPossible = computed(() => grEventStore.getPossible(tlProjectId.value))

// ── Boss states ─────────────────────────────────────────────────────────────
const bossStates = computed(() => {
  const m = {}
  for (const b of GR_BOSSES) m[b.id] = getBossState(b, tlEvents.value)
  return m
})

const bossesActive   = computed(() => GR_BOSSES.filter(b => bossStates.value[b.id] && !bossStates.value[b.id].defeated).length)
const activeBossCount = computed(() => GR_BOSSES.filter(b => bossStates.value[b.id]).length)
const defeatedCount  = computed(() => GR_BOSSES.filter(b => bossStates.value[b.id]?.defeated).length)

const irrMultiplier = computed(() => {
  const d = defeatedCount.value
  const total = activeBossCount.value
  if (!total) return 1.0
  const all = d === total && total > 0
  return +(1.0 + d * 0.4 + (all ? 0.5 : 0)).toFixed(1)
})

// ── Apply event (from canvas attack button) ──────────────────────────────────
function tlApplyEvent(possibleEvent) {
  if (!possibleEvent || possibleEvent.probability === 'blocked') return
  if (possibleEvent.type === 'MEASURE_APPLIED' && possibleEvent.measure) {
    grEventStore.applyMeasure(tlProjectId.value, possibleEvent.measure.id)
    setTimeout(() => {
      grEventStore.approveMeasure(
        tlProjectId.value,
        possibleEvent.measure.id,
        parseInt((possibleEvent.measure.amount || '').replace(/\D/g, '')) || 0
      )
    }, 600)
  } else {
    grEventStore.addEvent(tlProjectId.value, possibleEvent.type, {})
  }
}

function applyScenarioEvents(events) {
  for (const ev of events) {
    grEventStore.addEvent(tlProjectId.value, ev.type, { label: ev.label, subject: ev.subject })
  }
  toast.add({ severity: 'success', summary: 'Сценарий применён', detail: `${events.length} событий добавлено`, life: 3000 })
}

function tlReset() {
  grEventStore.clearTimeline(tlProjectId.value)
  grEventStore.initProject(tlProjectId.value, tlProjectParams())
}

// ── Projects loading ─────────────────────────────────────────────────────────
async function loadProjects() {
  projectsLoading.value = true
  try {
    const raw = await getProjects()
    projects.value = raw.map(p => ({
      ...p,
      subFundName: SUBFUND_NAMES[p.subFund] || 'БАС',
      stageName:   STAGE_NAMES[p.statusId]  || 'Посевная',
    }))
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Ошибка загрузки проектов', detail: e.message, life: 3000 })
  } finally {
    projectsLoading.value = false
  }
}

async function onProjectChange() {
  await ensureDemoTimeline()
}

watch(selectedProject, async (p) => {
  if (!p) return
  await ensureDemoTimeline()
})

// ── Demo scenarios (barrier bypass strategies) ───────────────────────────────
const DEMO_SCENARIOS = [
  {
    type: 'basic', name: 'Базовый GR',
    subtitle: 'Стандартный путь через меры НТИ',
    icon: '⚡', irr: 1.8, months: 18,
    resultText: 'Доступ к грантам НТИ + сертификация БПЛА',
    phases: [
      { round: 1, label: 'Рабочая группа',  capital: '₽0',   steps: [{ eventType: 'WORKING_GROUP_FORMED',   month: 1,  description: 'Создание рабочей группы' }] },
      { round: 2, label: 'Применение меры', capital: '₽3М',  steps: [{ eventType: 'MEASURE_APPLIED',        month: 6,  description: 'Заявка на грант НТИ' }] },
      { round: 3, label: 'Одобрение',       capital: '₽15М', steps: [{ eventType: 'MEASURE_APPROVED',       month: 12, description: 'Грант одобрен' }] },
      { round: 4, label: 'TRL рост',        capital: '₽30М', steps: [{ eventType: 'TRL_UPDATED',            month: 18, description: 'TRL 7 достигнут' }] },
    ],
  },
  {
    type: 'schlimann', name: 'Шлиман',
    subtitle: 'Агрессивный путь через госзакупки',
    icon: '🏛️', irr: 2.8, months: 12,
    resultText: 'Пилотный контракт + выход на Гособоронзаказ',
    phases: [
      { round: 1, label: 'Диагностика барьера',   capital: '₽0',   steps: [{ eventType: 'REGULATORY_BARRIER_DETECTED', month: 1, description: 'Выявлен регуляторный барьер' }] },
      { round: 2, label: 'Проект контрмеры',      capital: '₽5М',  steps: [{ eventType: 'COUNTERMEASURE_ISSUED',       month: 4, description: 'Подготовлена контрмера' }] },
      { round: 3, label: 'Финансирование',        capital: '₽50М', steps: [{ eventType: 'MEASURE_FUNDED',              month: 8, description: 'Финансирование получено' }] },
    ],
  },
]

// ── Lifecycle ────────────────────────────────────────────────────────────────
onBeforeUnmount(() => {
  document.documentElement.classList.remove('gov-page')
})

onMounted(async () => {
  document.documentElement.classList.add('gov-page')
  await loadProjects()
  grEventStore.loadAll().catch(() => {})
  await ensureDemoTimeline()

  if (route.query.company) {
    const found = projects.value.find(p => String(p.id) === String(route.query.company))
    if (found) {
      selectedProject.value = found
      await ensureDemoTimeline()
    }
  }
})
</script>

<style scoped>
/* ── Root: fills sidebar layout ────────────────────────────────────────────── */
.fgov-root {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #060d14;
  overflow: hidden;
}

/* ── Topbar ────────────────────────────────────────────────────────────────── */
.fgov-bar {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 8px 20px;
  background: #090f18;
  border-bottom: 1px solid #1a2a3a;
  flex-shrink: 0;
  flex-wrap: wrap;
}
.fgov-bar-left {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}
.fgov-bar-title {
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.12em;
  color: #88aacc;
}
.fgov-bar-sep { color: #2a4060; }
.fgov-bar-sub {
  font-size: 10px;
  color: #3a5070;
  white-space: nowrap;
}

.fgov-bar-center {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
  min-width: 200px;
  max-width: 380px;
}
.fgov-select {
  font-size: 12px;
  flex: 1;
}
/* Override PrimeVue Select to match dark theme */
:deep(.fgov-select .p-select) {
  background: #0e1e2e;
  border-color: #1a3050;
  color: #88aacc;
}

.fgov-reset-btn {
  padding: 5px 8px;
  background: #112233;
  border: 1px solid #1a3050;
  border-radius: 6px;
  color: #88aacc;
  cursor: pointer;
  transition: all 0.15s;
}
.fgov-reset-btn:hover { background: #1a3050; color: #00d4ff; }

.fgov-bar-right {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-left: auto;
}
.fgov-kpi {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
}
.fgov-kpi-val {
  font-size: 16px;
  font-weight: 700;
  line-height: 1;
}
.fgov-kpi-lbl {
  font-size: 9px;
  color: #3a5070;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

/* ── Canvas wrapper ─────────────────────────────────────────────────────────── */
.fgov-canvas-wrap {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}
</style>
