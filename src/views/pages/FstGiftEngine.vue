<template>
  <FstPageLayout title="Движок ценности" subtitle="Онтология взаимного вклада" icon="pi pi-heart">
    <template #actions>
      <SelectButton
        v-model="activeTab"
        :options="tabs"
        optionLabel="label"
        optionValue="id"
        :allowEmpty="false"
      />
    </template>

    <!-- Метрики -->
    <GiftMetricsStrip :stats="metricsStats" />

    <div class="ge-content">

      <!-- Обзор -->
      <template v-if="activeTab === 'overview'">
        <div class="page-card">
          <div class="page-section-title">Экосистема взаимного вклада</div>
          <p class="ge-intro">
            Движок ценности моделирует все обмены ценностью между участниками экосистемы фонда.
            Каждый вклад (экспертиза, капитал, технология, связи) отслеживается, оценивается
            и связывается со стратегическими целями фонда.
          </p>
          <div class="ge-summary-grid">
            <div class="ge-summary-card">
              <i class="pi pi-users ge-summary-icon" style="color: var(--fst-purple)" />
              <div class="ge-summary-val">{{ stakeholders.length }}</div>
              <div class="ge-summary-lbl">Участников</div>
            </div>
            <div class="ge-summary-card">
              <i class="pi pi-arrows-h ge-summary-icon" style="color: var(--fst-cyan)" />
              <div class="ge-summary-val">{{ exchanges.length }}</div>
              <div class="ge-summary-lbl">Обменов</div>
            </div>
            <div class="ge-summary-card">
              <i class="pi pi-check-circle ge-summary-icon" style="color: var(--fst-green)" />
              <div class="ge-summary-val">{{ acceptedCount }}</div>
              <div class="ge-summary-lbl">Принято</div>
            </div>
            <div class="ge-summary-card">
              <i class="pi pi-compass ge-summary-icon" style="color: var(--fst-brand)" />
              <div class="ge-summary-val">{{ telosGoals.length }}</div>
              <div class="ge-summary-lbl">Целей</div>
            </div>
          </div>
        </div>

        <div class="page-card">
          <div class="page-section-title">Последние обмены</div>
          <div class="ge-recent">
            <div v-for="ex in exchanges.slice(0, 4)" :key="ex.id" class="ge-recent-item">
              <div class="ge-recent-flow">
                <span class="ge-recent-from">{{ ex.from }}</span>
                <i class="pi pi-arrow-right ge-recent-arrow" />
                <span class="ge-recent-to">{{ ex.to }}</span>
              </div>
              <div class="ge-recent-content">{{ ex.content }}</div>
              <Tag :value="statusLabel(ex.status)" :severity="statusSeverity(ex.status)" />
            </div>
          </div>
        </div>
      </template>

      <!-- Участники -->
      <template v-if="activeTab === 'stakeholders'">
        <div class="page-card">
          <GiftStakeholderGraph :persons="graphPersons" :edges="reciprocityEdges" />
        </div>
        <div class="page-card">
          <div class="page-section-title">Все участники</div>
          <table class="ge-table">
            <thead>
              <tr>
                <th>Участник</th>
                <th>Роль</th>
                <th>Отдано</th>
                <th>Получено</th>
                <th>Баланс</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="s in stakeholders" :key="s.id">
                <td class="ge-name-cell">{{ s.name }}</td>
                <td>
                  <Tag :value="s.role" severity="secondary" />
                </td>
                <td class="ge-num">{{ givenCount(s.id) }}</td>
                <td class="ge-num">{{ receivedCount(s.id) }}</td>
                <td class="ge-num" :class="balanceClass(s.id)">{{ balance(s.id) > 0 ? '+' : '' }}{{ balance(s.id) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>

      <!-- Поток -->
      <template v-if="activeTab === 'stream'">
        <div class="page-card">
          <GiftValueStream :exchanges="exchanges" />
        </div>
      </template>

      <!-- Цели -->
      <template v-if="activeTab === 'goals'">
        <div class="page-card">
          <GiftTelosTracker :goals="telosGoals" />
        </div>
      </template>

    </div>
  </FstPageLayout>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import FstPageLayout from '@/components/fst-shared/FstPageLayout.vue'
import SelectButton from 'primevue/selectbutton'
import Tag from 'primevue/tag'
import GiftMetricsStrip from '@/components/gift/GiftMetricsStrip.vue'
import GiftStakeholderGraph from '@/components/gift/GiftStakeholderGraph.vue'
import GiftValueStream from '@/components/gift/GiftValueStream.vue'
import GiftTelosTracker from '@/components/gift/GiftTelosTracker.vue'
import { useFstData } from '@/composables/useFstData.js'

const activeTab = ref('overview')
const loading = ref(true)

const tabs = [
  { label: 'Обзор', id: 'overview' },
  { label: 'Участники', id: 'stakeholders' },
  { label: 'Поток', id: 'stream' },
  { label: 'Цели', id: 'goals' }
]

const { loadProjects, loadStats, projects, stats } = useFstData()

// ── Core actors (always present) ──
const coreActors = [
  { id: 'fst', name: 'Фонд ФСТ НТИ', role: 'Фонд' },
  { id: 'lp', name: 'LP-пул', role: 'Инвестор' },
  { id: 'experts', name: 'Совет экспертов', role: 'Эксперты' },
  { id: 'ik', name: 'AI-инвесткомитет', role: 'ИК' },
]

// ── Stakeholders: core + portfolio companies only ──
const stakeholders = computed(() => {
  const companies = validProjects.value.map((p, i) => ({
    id: `c${p.id || i}`,
    name: shortName(p.company || p.title || p.name),
    role: p.subFund || p.subfund || 'Портфель',
    trl: p.trl,
    subfund: p.subFund || p.subfund,
  }))
  return [...coreActors, ...companies]
})

function shortName(name) {
  if (!name) return '?'
  return name.replace(/^ООО\s+/i, '').replace(/^АО\s+/i, '').replace(/"/g, '').trim()
}

// ── Portfolio companies only (status 81238 or 1125) + with names ──
const PORTFOLIO_STATUSES = ['81238', '1125']
const validProjects = computed(() =>
  projects.value.filter(p => {
    const n = shortName(p.company || p.title || p.name)
    if (!n || n === '?') return false
    return PORTFOLIO_STATUSES.includes(String(p.statusId))
  })
)

// ── Auto-generate exchanges from portfolio ──
const exchanges = computed(() => {
  const exs = []
  let idx = 0
  const now = new Date()
  validProjects.value.forEach((p, i) => {
    const name = shortName(p.company || p.title || p.name)
    // Фонд → компания: инвестиция
    exs.push({
      id: `ex${idx++}`,
      from: 'Фонд ФСТ НТИ',
      to: name,
      content: `Инвестиция в ${p.subFund || p.subfund || 'портфель'} (TRL ${p.trl || '?'})`,
      layer: 'Капитал',
      status: 'accepted',
      time: offsetDate(now, -90 - i * 7)
    })
    // Компания → фонд: доля
    exs.push({
      id: `ex${idx++}`,
      from: name,
      to: 'Фонд ФСТ НТИ',
      content: `Доля в капитале + отчётность`,
      layer: 'Доля',
      status: 'accepted',
      time: offsetDate(now, -89 - i * 7)
    })
    // ИК → компания: скоринг
    exs.push({
      id: `ex${idx++}`,
      from: 'AI-инвесткомитет',
      to: name,
      content: `Скоринг T·S·M·G·E + меморандум`,
      layer: 'Экспертиза',
      status: 'accepted',
      time: offsetDate(now, -95 - i * 7)
    })
    // Эксперты → компания (для каждой третьей)
    if (i % 3 === 0) {
      exs.push({
        id: `ex${idx++}`,
        from: 'Совет экспертов',
        to: name,
        content: `Техническая экспертиза и менторство`,
        layer: 'Экспертиза',
        status: i < validProjects.value.length - 2 ? 'accepted' : 'pending',
        time: offsetDate(now, -60 - i * 5)
      })
    }
  })
  // LP → Фонд
  exs.push({ id: `ex${idx++}`, from: 'LP-пул', to: 'Фонд ФСТ НТИ', content: 'Коммит ~6.4 млрд ₽ в фонд', layer: 'Капитал', status: 'accepted', time: offsetDate(now, -365) })
  // Фонд → LP: отчётность
  exs.push({ id: `ex${idx++}`, from: 'Фонд ФСТ НТИ', to: 'LP-пул', content: 'ILPA-отчётность + NAV', layer: 'Отчётность', status: 'accepted', time: offsetDate(now, -30) })

  return exs.sort((a, b) => b.time.localeCompare(a.time))
})

function offsetDate(base, days) {
  const d = new Date(base)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

// ── Reciprocity edges: auto from exchanges ──
const reciprocityEdges = computed(() => {
  const edgeMap = {}
  exchanges.value.forEach(ex => {
    const fromS = stakeholders.value.find(s => s.name === ex.from)
    const toS = stakeholders.value.find(s => s.name === ex.to)
    if (!fromS || !toS) return
    const key = `${fromS.id}→${toS.id}`
    edgeMap[key] = (edgeMap[key] || 0) + 1
  })
  const maxW = Math.max(...Object.values(edgeMap), 1)
  return Object.entries(edgeMap).map(([key, count]) => {
    const [from, to] = key.split('→')
    return { from, to, weight: count / maxW }
  })
})

// ── Strategic goals (dynamic from stats) ──
const telosGoals = computed(() => {
  const n = validProjects.value.length
  const s = stats.value || {}
  const subfundCount = new Set(validProjects.value.map(p => p.subFund || p.subfund).filter(Boolean)).size
  return [
    {
      id: 'g1',
      name: `Портфель: ${n} из 30 компаний`,
      description: `Текущий портфель: ${n} компаний в ${subfundCount} субфондах. Цель — 30 компаний к 2028.`,
      status: 'active',
      progress: Math.min(100, Math.round((n / 30) * 100)),
      stakeholders: n + 4
    },
    {
      id: 'g2',
      name: 'Целевой IRR 25%',
      description: `Целевой IRR фонда 25% на горизонте 7 лет. Текущий средний IRR: ${s.avgIrr || '—'}%.`,
      status: 'active',
      progress: Math.min(100, Math.round(((s.avgIrr || 0) / 25) * 100)),
      stakeholders: n
    },
    {
      id: 'g3',
      name: 'Средний TRL портфеля ≥ 6',
      description: `Средний TRL портфеля: ${avgTrl.value}. Цель — довести средний TRL до 6+ для снижения технологического риска.`,
      status: avgTrl.value >= 6 ? 'completed' : 'active',
      progress: Math.min(100, Math.round((avgTrl.value / 6) * 100)),
      stakeholders: n
    },
    {
      id: 'g4',
      name: 'Выход из 3 компаний к 2028',
      description: 'Обеспечить успешный выход (M&A, IPO или buyback) из минимум 3 портфельных компаний.',
      status: 'active',
      progress: 10,
      stakeholders: 5
    },
  ]
})

const avgTrl = computed(() => {
  const trls = validProjects.value.map(p => p.trl).filter(t => t > 0)
  return trls.length ? +(trls.reduce((a, b) => a + b, 0) / trls.length).toFixed(1) : 0
})

// ── Graph persons (limit to 12 for readability) ──
const graphPersons = computed(() => {
  const top = stakeholders.value.slice(0, 12)
  return top.map(s => ({ id: s.id, name: s.name }))
})

// ── Computed metrics ──
const acceptedCount = computed(() =>
  exchanges.value.filter(e => e.status === 'accepted').length
)

const metricsStats = computed(() => {
  const total = exchanges.value.length
  const accepted = acceptedCount.value
  const n = stakeholders.value.length
  const maxEdges = n * (n - 1)
  const density = maxEdges > 0 ? reciprocityEdges.value.length / maxEdges : 0
  const mutualPairs = new Set()
  reciprocityEdges.value.forEach(e => {
    const rev = reciprocityEdges.value.find(r => r.from === e.to && r.to === e.from)
    if (rev) {
      const key = [e.from, e.to].sort().join('-')
      mutualPairs.add(key)
    }
  })
  return {
    stakeholders: n,
    exchanges: total,
    acceptanceRate: total > 0 ? (accepted / total) * 100 : 0,
    density,
    mutualCycles: mutualPairs.size
  }
})

// ── Helpers ──
function givenCount(id) {
  const name = stakeholders.value.find(s => s.id === id)?.name
  return exchanges.value.filter(e => e.from === name).length
}

function receivedCount(id) {
  const name = stakeholders.value.find(s => s.id === id)?.name
  return exchanges.value.filter(e => e.to === name).length
}

function balance(id) {
  return givenCount(id) - receivedCount(id)
}

function balanceClass(id) {
  const b = balance(id)
  if (b > 0) return 'ge-balance-pos'
  if (b < 0) return 'ge-balance-neg'
  return ''
}

function statusLabel(status) {
  const map = { pending: 'Ожидает', accepted: 'Принят', offered: 'Предложен', declined: 'Отклонён' }
  return map[status] || status
}

function statusSeverity(status) {
  const map = { pending: 'warn', accepted: 'success', offered: 'info', declined: 'danger' }
  return map[status] || 'secondary'
}

// ── Load real data ──
onMounted(async () => {
  try {
    await Promise.all([loadProjects(), loadStats()])
  } catch (e) {
    console.warn('[GiftEngine] Failed to load data, using fallback', e)
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.ge-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding-top: 16px;
}

.page-card {
  background: var(--p-surface-card);
  border: 1px solid var(--p-content-border-color);
  border-radius: 12px;
  padding: 20px;
}

.page-section-title {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: var(--p-text-muted-color);
  margin-bottom: 14px;
}

.ge-intro {
  margin: 0 0 16px;
  font-size: 0.82rem;
  color: var(--p-text-muted-color);
  line-height: 1.5;
}

/* ── Overview summary grid ── */
.ge-summary-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 12px;
}

.ge-summary-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 16px;
  background: color-mix(in srgb, var(--p-primary-color) 5%, transparent);
  border: 1px solid var(--p-content-border-color);
  border-radius: 10px;
}

.ge-summary-icon {
  font-size: 1.3rem;
}

.ge-summary-val {
  font-size: 1.6rem;
  font-weight: 800;
  color: var(--p-text-color);
}

.ge-summary-lbl {
  font-size: 0.72rem;
  color: var(--p-text-muted-color);
}

/* ── Recent exchanges ── */
.ge-recent {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.ge-recent-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  border: 1px solid var(--p-content-border-color);
  border-radius: 8px;
  flex-wrap: wrap;
}

.ge-recent-flow {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.82rem;
  font-weight: 600;
}

.ge-recent-from { color: var(--fst-purple); }
.ge-recent-to { color: var(--fst-blue); }
.ge-recent-arrow { font-size: 10px; color: var(--fst-cyan); }

.ge-recent-content {
  flex: 1;
  font-size: 0.78rem;
  color: var(--p-text-muted-color);
  min-width: 160px;
}

/* ── Stakeholders table ── */
.ge-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.83rem;
}

.ge-table th {
  padding: 7px 10px;
  text-align: left;
  color: var(--p-text-muted-color);
  border-bottom: 1px solid var(--p-content-border-color);
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.ge-table td {
  padding: 8px 10px;
  border-bottom: 1px solid var(--p-content-border-color);
  color: var(--p-text-color);
}

.ge-table tr:last-child td { border: none; }

.ge-name-cell { font-weight: 600; }
.ge-num { text-align: right; font-weight: 600; }

.ge-balance-pos { color: var(--fst-green); }
.ge-balance-neg { color: var(--fst-red); }

/* ── Mobile adaptive ── */
@media (max-width: 768px) {
  .ge-summary-grid { grid-template-columns: repeat(2, 1fr); }
  .ge-recent-item { flex-direction: column; align-items: flex-start; }
  .ge-table { display: block; overflow-x: auto; -webkit-overflow-scrolling: touch; }
}
</style>
