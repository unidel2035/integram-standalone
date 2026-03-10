<template>
  <FstPageLayout>
    <!-- ─── Topbar left: title + status ─── -->
    <template #header>
      <div class="fdt-title-group fst-topbar-left">
        <i class="pi pi-circle-fill fdt-live-dot" :style="{ color: liveColor }"></i>
        <span>ЦД · <b>{{ company.name }}</b></span>
        <Tag :value="company.stage" severity="info" class="fsp-tag" />
        <Tag :value="company.subFund" :style="{ background: 'var(--fst-blue)', color:'#fff', fontSize:'11px' }" />
      </div>
      <div class="fdt-updated">Обновлено: {{ lastUpdate }} · Тик {{ tick }}</div>
    </template>

    <!-- ─── Topbar right: actions ─── -->
    <template #actions>
      <Button :icon="running ? 'pi pi-pause' : 'pi pi-play'"
        :label="running ? 'Пауза' : 'Live'"
        :severity="running ? 'warn' : 'success'"
        size="small" @click="toggleRun" />
      <Button icon="pi pi-refresh" severity="secondary" size="small" @click="resetSim" title="Сброс" />
      <SelectButton v-model="speed" :options="speedOpts" optionLabel="l" optionValue="v"
        :allowEmpty="false" size="small" />
    </template>

    <!-- ─── KPI metrics strip ─── -->
    <div class="fdt-metrics fst-metrics-strip">
      <div class="fst-metric-item">
        <i class="pi pi-heart fst-metric-item-icon" :style="{ color: healthScore >= 75 ? 'var(--fst-green)' : healthScore >= 50 ? 'var(--fst-brand)' : 'var(--fst-red)' }"></i>
        <div class="fst-metric-item-val">{{ healthScore }}</div>
        <div class="fst-metric-item-label">Здоровье</div>
      </div>
      <div class="fst-metric-item">
        <i class="pi pi-microchip fst-metric-item-icon" style="color:var(--fst-blue)"></i>
        <div class="fst-metric-item-val">{{ sim.trl }}/9</div>
        <div class="fst-metric-item-label">TRL</div>
      </div>
      <div class="fst-metric-item">
        <i class="pi pi-wallet fst-metric-item-icon" :style="{ color: runwayColor }"></i>
        <div class="fst-metric-item-val">{{ runway }}</div>
        <div class="fst-metric-item-label">Runway, мес.</div>
      </div>
      <div class="fst-metric-item">
        <i class="pi pi-clock fst-metric-item-icon" style="color:var(--fst-purple)"></i>
        <div class="fst-metric-item-val">{{ tick }}</div>
        <div class="fst-metric-item-label">Тик симуляции</div>
      </div>
    </div>

    <!-- Main Grid -->
    <div class="fdt-main">

      <!-- Col 1: Vitals -->
      <div class="fdt-col fdt-col-vitals">
        <div class="fdt-panel-title"><i class="pi pi-chart-line" style="color:var(--fst-blue)"></i> Жизненные показатели</div>

        <div class="fdt-vitals-grid">
          <div class="fdt-vital" v-for="v in vitals" :key="v.key">
            <div class="fdt-vital-label">{{ v.label }}</div>
            <div class="fdt-vital-value" :style="{ color: v.color }">{{ v.value }}</div>
            <div class="fdt-vital-delta" :class="v.delta > 0 ? 'pos' : v.delta < 0 ? 'neg' : ''">
              <i :class="v.delta > 0 ? 'pi pi-arrow-up' : v.delta < 0 ? 'pi pi-arrow-down' : 'pi pi-minus'" style="font-size:10px"></i>
              {{ Math.abs(v.delta).toFixed(1) }}{{ v.unit }}
            </div>
          </div>
        </div>

        <!-- Revenue sparkline -->
        <div class="fdt-spark-section">
          <div class="fdt-spark-label">Выручка (млн ₽/кв)</div>
          <canvas ref="revenueChart" height="80"></canvas>
        </div>

        <!-- Burn & Runway -->
        <div class="fdt-spark-section">
          <div class="fdt-spark-label">Runway: <b :style="{ color: runwayColor }">{{ runway }} мес.</b></div>
          <ProgressBar :value="Math.min(100, runway / 24 * 100)" :showValue="false"
            :style="{ height: '8px', '--p-progressbar-value-background': runwayColor }" />
        </div>

        <!-- TRL/MRL Progress -->
        <div class="fdt-spark-section">
          <div class="fdt-trl-row">
            <span class="fdt-trl-label">TRL</span>
            <div class="fdt-trl-dots">
              <div v-for="i in 9" :key="i" class="fdt-trl-dot"
                :style="{ background: i <= sim.trl ? 'var(--fst-blue)' : 'transparent', borderColor: 'var(--fst-blue)' }"></div>
            </div>
            <span class="fdt-trl-val">{{ sim.trl }}/9</span>
          </div>
          <div class="fdt-trl-row">
            <span class="fdt-trl-label">MRL</span>
            <div class="fdt-trl-dots">
              <div v-for="i in 10" :key="i" class="fdt-trl-dot"
                :style="{ background: i <= sim.mrl ? 'var(--fst-brand)' : 'transparent', borderColor: 'var(--fst-brand)' }"></div>
            </div>
            <span class="fdt-trl-val">{{ sim.mrl }}/10</span>
          </div>
          <div class="fdt-trl-row">
            <span class="fdt-trl-label">Суверен.</span>
            <div class="fdt-trl-dots">
              <div v-for="i in 9" :key="i" class="fdt-trl-dot"
                :style="{ background: i <= sim.sovereignty ? 'var(--fst-red)' : 'transparent', borderColor: 'var(--fst-red)' }"></div>
            </div>
            <span class="fdt-trl-val">{{ sim.sovereignty }}/9</span>
          </div>
        </div>
      </div>

      <!-- Col 2: Risk Sensors -->
      <div class="fdt-col fdt-col-sensors">
        <div class="fdt-panel-title"><i class="pi pi-shield" style="color:var(--fst-brand)"></i> Датчики рисков</div>

        <div class="fdt-sensors-chips">
          <div v-for="s in sensors" :key="s.id" class="fdt-sensor-chip"
            :style="{ '--sc': statusColor(s.status) }" :title="s.detail">
            <div class="fdt-sensor-chip-dot"></div>
            <i :class="s.icon" class="fdt-sensor-chip-icon"></i>
            <span class="fdt-sensor-chip-name">{{ s.name }}</span>
            <span class="fdt-sensor-chip-status">{{ s.status }}</span>
          </div>
        </div>

        <!-- Event feed -->
        <div class="fdt-panel-title" style="margin-top:12px">
          <i class="pi pi-list" style="color:var(--fst-green)"></i> События
        </div>
        <div class="fdt-events-feed">
          <TransitionGroup name="fdt-event" tag="div">
            <div v-for="e in eventFeed" :key="e.id" class="fdt-event-row">
              <i :class="e.icon" :style="{ color: e.color, fontSize:'12px' }"></i>
              <span class="fdt-event-time">{{ e.time }}</span>
              <span class="fdt-event-text">{{ e.text }}</span>
            </div>
          </TransitionGroup>
        </div>
      </div>

      <!-- Col 3: Smart Contract + AI -->
      <div class="fdt-col fdt-col-contract">
        <div class="fdt-panel-title"><i class="pi pi-file-check" style="color:var(--fst-purple)"></i> Смарт-контракт</div>

        <div class="fdt-contract-card">
          <div class="fdt-contract-meta">
            <div class="fdt-contract-line">Тип: <b>Equity + CLN</b></div>
            <div class="fdt-contract-line">Сумма: <b>{{ fmtM(company.totalInvestment) }}</b></div>
            <div class="fdt-contract-line">Доля ФСТ: <b>{{ company.fundShare }}%</b></div>
            <div class="fdt-contract-line">SPV: <b>{{ company.spv }}</b></div>
          </div>

          <!-- Tranches -->
          <div class="fdt-tranches">
            <div class="fdt-tranches-title">Транши</div>
            <div v-for="t in tranches" :key="t.id" class="fdt-tranche-row">
              <div class="fdt-tranche-dot" :style="{ background: t.released ? 'var(--fst-green)' : t.active ? 'var(--fst-brand)' : 'var(--p-content-border-color)' }"></div>
              <div class="fdt-tranche-info">
                <div class="fdt-tranche-label">{{ t.label }}</div>
                <div class="fdt-tranche-cond">{{ t.condition }}</div>
              </div>
              <div class="fdt-tranche-amount" :style="{ color: t.released ? 'var(--fst-green)' : t.active ? 'var(--fst-brand)' : 'var(--p-text-muted-color)' }">
                {{ fmtM(t.amount) }}
              </div>
              <Tag v-if="t.released" value="Выплачен" severity="success" style="font-size:10px" />
              <Tag v-else-if="t.active" value="Активен" severity="warn" style="font-size:10px" />
              <Tag v-else value="Заблокирован" severity="secondary" style="font-size:10px" />
            </div>
          </div>
        </div>

        <!-- KPI Triggers -->
        <div class="fdt-panel-title" style="margin-top:12px">
          <i class="pi pi-bolt" style="color:var(--fst-brand)"></i> KPI-триггеры
        </div>
        <div class="fdt-kpi-list">
          <div v-for="kpi in kpiTriggers" :key="kpi.id" class="fdt-kpi-row">
            <div class="fdt-kpi-name">{{ kpi.name }}</div>
            <div class="fdt-kpi-bar-wrap">
              <div class="fdt-kpi-bar-bg">
                <div class="fdt-kpi-bar-fill"
                  :style="{ width: Math.min(100, kpi.progress) + '%', background: kpi.progress >= 100 ? 'var(--fst-green)' : 'var(--fst-blue)' }"></div>
              </div>
              <span class="fdt-kpi-pct" :style="{ color: kpi.progress >= 100 ? 'var(--fst-green)' : 'var(--p-text-muted-color)' }">
                {{ kpi.progress.toFixed(0) }}%
              </span>
            </div>
            <div class="fdt-kpi-target">{{ kpi.current }} / {{ kpi.target }}</div>
          </div>
        </div>

        <!-- AI Analysis -->
        <div class="fdt-panel-title" style="margin-top:12px">
          <i class="pi pi-microchip-ai" style="color:var(--fst-blue)"></i> AI-анализ
        </div>
        <div class="fdt-ai-card">
          <div class="fdt-ai-score-row">
            <span>Вероятность выживания:</span>
            <b :style="{ color: sim.survivalProb >= 0.7 ? 'var(--fst-green)' : sim.survivalProb >= 0.5 ? 'var(--fst-brand)' : 'var(--fst-red)' }">
              {{ (sim.survivalProb * 100).toFixed(0) }}%
            </b>
          </div>
          <div class="fdt-ai-score-row">
            <span>Прогноз выхода:</span>
            <b style="color:var(--fst-purple)">{{ sim.exitYear }}</b>
          </div>
          <div class="fdt-ai-score-row">
            <span>Ожидаемый multiple:</span>
            <b style="color:var(--fst-green)">{{ sim.exitMultiple.toFixed(1) }}x</b>
          </div>
          <div class="fdt-ai-verdict" :style="{ background: verdictBg }">
            <i class="pi pi-flag"></i> {{ sim.verdict }}
          </div>
        </div>
      </div>

    </div>

    <!-- ── Ontology Blocks Panel ─────────────────────────────── -->
    <Transition name="fdt-ob-fade">
      <div v-if="ontologyBlocks.length" class="fdt-ob-panel">
        <div class="fdt-ob-header">
          <i class="pi pi-share-alt" style="color:var(--p-primary-color);font-size:13px"></i>
          <span class="fdt-ob-title">Живые блоки <span class="fdt-ob-subtitle">— из событийной онтологии</span></span>
          <span class="fdt-ob-count">{{ ontologyBlocks.length }}</span>
        </div>
        <TransitionGroup name="fdt-ob-list" tag="div" class="fdt-ob-list">

          <!-- ── TICKER: живые KPI-метрики ── -->
          <div v-for="block in ontologyBlocks" :key="block.id"
            :class="['fdt-ob-scene', 'fdt-ob-scene--' + block.type]"
            :style="{ '--sc': block.color }">

            <!-- ticker -->
            <template v-if="block.type === 'ticker'">
              <div class="fdt-ticker-head">
                <span class="fdt-ticker-dot">●</span>
                <span class="fdt-ticker-live">LIVE</span>
                <span class="fdt-ticker-stage">{{ block.stage }}</span>
                <span class="fdt-ticker-tick">тик {{ block.tick }}</span>
              </div>
              <div class="fdt-ticker-metrics">
                <div v-for="m in block.metrics" :key="m.k" class="fdt-ticker-metric">
                  <span class="fdt-tm-val">{{ m.v }}</span>
                  <span class="fdt-tm-lbl">{{ m.l }}</span>
                  <span :class="['fdt-tm-arrow', m.up ? 'up' : 'dn']">{{ m.up ? '▲' : '▼' }}</span>
                </div>
              </div>
            </template>

            <!-- health: HP-полоса -->
            <template v-else-if="block.type === 'health'">
              <div class="fdt-health-scene-header">
                <span class="fdt-hs-label">{{ block.label }}</span>
                <span class="fdt-hs-num" :style="{ color: block.color }">{{ block.value }}<span class="fdt-hs-max">/100</span></span>
              </div>
              <div class="fdt-hp-track">
                <div class="fdt-hp-fill" :style="{ width: block.value + '%', background: block.color }"></div>
                <div class="fdt-hp-segments">
                  <div v-for="i in 10" :key="i" class="fdt-hp-seg"></div>
                </div>
              </div>
              <div class="fdt-hs-sub">{{ block.sub }}</div>
            </template>

            <!-- achievement: level-up бейдж -->
            <template v-else-if="block.type === 'achievement'">
              <div class="fdt-ach-scene">
                <div class="fdt-ach-emoji">{{ block.emoji }}</div>
                <div class="fdt-ach-badge">
                  <span class="fdt-ach-lvl">{{ block.level }}</span>
                  <span class="fdt-ach-max">/{{ block.maxLevel }}</span>
                </div>
                <div class="fdt-ach-text">
                  <div class="fdt-ach-title">{{ block.title }}</div>
                  <div class="fdt-ach-body">{{ block.body }}</div>
                </div>
              </div>
            </template>

            <!-- milestone: штамп-газета -->
            <template v-else-if="block.type === 'milestone'">
              <div class="fdt-ms-scene">
                <div class="fdt-ms-stamp" :style="{ borderColor: block.color, color: block.color }">{{ block.stamp }}</div>
                <div class="fdt-ms-main">
                  <div class="fdt-ms-amount" :style="{ color: block.color }">{{ block.amount }}</div>
                  <div class="fdt-ms-title">{{ block.title }}</div>
                  <div class="fdt-ms-body">{{ block.body }}</div>
                </div>
                <Button v-if="block.action" :label="block.action.label" size="small" text
                  :style="{ color: block.color, fontSize: '0.68rem', padding: '2px 6px' }"
                  @click="block.action.route && router.push(block.action.route)" />
              </div>
            </template>

            <!-- alert: сирена-баннер -->
            <template v-else-if="block.type === 'alert'">
              <div :class="['fdt-alert-scene', { 'fdt-alert-critical': block.critical }]">
                <div class="fdt-alert-title">{{ block.title }}</div>
                <div class="fdt-alert-body">{{ block.body }}</div>
                <Button v-if="block.action" :label="block.action.label" size="small"
                  :style="{ background: block.color, border: 'none', fontSize: '0.68rem' }"
                  @click="block.action.route && router.push(block.action.route)" />
              </div>
            </template>

          </div>
        </TransitionGroup>
      </div>
    </Transition>

    <!-- Timeline bar -->
    <div class="fdt-timeline">
      <div class="fdt-tl-stages">
        <div v-for="st in stages" :key="st.id"
          :class="['fdt-tl-stage', { 'active': sim.stage === st.id, 'done': stageOrder.indexOf(sim.stage) > stageOrder.indexOf(st.id) }]">
          <div class="fdt-tl-stage-dot" :style="{ background: sim.stage === st.id ? st.color : stageOrder.indexOf(sim.stage) > stageOrder.indexOf(st.id) ? 'var(--fst-green)' : 'var(--p-content-border-color)' }"></div>
          <div class="fdt-tl-stage-label">{{ st.label }}</div>
        </div>
      </div>
    </div>
  </FstPageLayout>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import FstPageLayout from '@/components/fst-shared/FstPageLayout.vue'
import ProgressBar from 'primevue/progressbar'
import Chart from 'chart.js/auto'
import { useEventStore } from '@/stores/eventStore.js'

const eventStore = useEventStore()
const router = useRouter()
const DT_COMPANY_ID = 'aviaklogik'   // id компании в event log

// ── Company Definition ────────────────────────────────────────
const company = {
  name: 'АвиаЛогик',
  fullName: 'ООО АвиаЛогик',
  stage: 'Seed',
  subFund: 'БАС',
  totalInvestment: 180_000_000,
  fundShare: 18,
  spv: 'АЛ-СПВ-001',
  founded: 2021,
  city: 'Москва',
}

const stages = [
  { id: 'preseed', label: 'Pre-seed', color: 'var(--p-text-muted-color)' },
  { id: 'seed', label: 'Seed', color: 'var(--fst-blue)'   },
  { id: 'round_a', label: 'Раунд A', color: 'var(--fst-purple)' },
  { id: 'round_b', label: 'Раунд B', color: 'var(--fst-brand)'  },
  { id: 'growth', label: 'Growth', color: 'var(--fst-green)'  },
  { id: 'exit', label: 'Exit/IPO', color: 'var(--fst-cyan)'   },
]
const stageOrder = stages.map(s => s.id)

// ── Simulation State ──────────────────────────────────────────
const tick = ref(0)
const running = ref(true)
const speed = ref(1)
const speedOpts = [{ l: '1x', v: 1 }, { l: '3x', v: 3 }, { l: '10x', v: 10 }]

const sim = ref({
  trl: 6, mrl: 4, sovereignty: 7,
  revenue: 12_000_000,
  burnRate: 8_500_000,
  headcount: 23,
  valuation: 540_000_000,
  patents: 3,
  stage: 'seed',
  survivalProb: 0.78,
  exitYear: 2029,
  exitMultiple: 4.2,
  verdict: 'Мониторинг: показатели в норме',
})

const revenueHistory = ref([8, 9, 10, 12])
const burnHistory = ref([9, 9, 8.5, 8.5])

let timer = null
const lastUpdate = ref(new Date().toLocaleTimeString('ru-RU'))
const liveColor = ref('var(--fst-green)')
// Дедупликация: не генерировать один и тот же uiBlock дважды
const emittedBlocks = new Set()

// ── Tranches ──────────────────────────────────────────────────
const tranches = ref([
  { id: 1, label: 'Транш 1 — Seed', amount: 60_000_000, condition: 'Подписан договор ФСТ + SPV', released: true, active: false },
  { id: 2, label: 'Транш 2 — TRL 7', amount: 70_000_000, condition: 'Достижение TRL 7 + 2 LOI', released: false, active: true },
  { id: 3, label: 'Транш 3 — MRL 6', amount: 50_000_000, condition: 'MRL ≥ 6 + выручка ≥ 30 млн', released: false, active: false },
])

// ── KPI Triggers ─────────────────────────────────────────────
const kpiTriggers = ref([
  { id: 'rev', name: 'Выручка ≥ 30 млн ₽/кв', current: '12 млн', target: '30 млн', progress: 40 },
  { id: 'trl', name: 'TRL ≥ 7', current: '6', target: '7', progress: 86 },
  { id: 'mrl', name: 'MRL ≥ 6', current: '4', target: '6', progress: 67 },
  { id: 'sov', name: 'Суверенность ≥ 7/9', current: '7', target: '7', progress: 100 },
  { id: 'head', name: 'Команда ≥ 35 чел.', current: '23', target: '35', progress: 66 },
])

// ── Risk Sensors ──────────────────────────────────────────────
const sensors = ref([
  { id: 'egrul', name: 'ЕГРЮЛ / ЕФРСБ', icon: 'pi pi-building', status: 'OK', detail: 'Юрлицо активно, изменений нет', updated: 'сег. 09:00' },
  { id: 'patents', name: 'Патенты (Роспатент)', icon: 'pi pi-file-check', status: 'OK', detail: '3 патента действующих, заявок: 2', updated: 'вчера' },
  { id: 'hiring', name: 'Найм (HeadHunter)', icon: 'pi pi-users', status: 'WARN', detail: 'Открыто 5 вакансий (CTO, 4 инженера) — рост найма', updated: 'сег. 11:30' },
  { id: 'runway', name: 'Runway (< 9 мес.)', icon: 'pi pi-wallet', status: 'OK', detail: 'Runway 14 мес. при текущем burn', updated: 'live' },
  { id: 'contracts', name: 'Контракты / LOI', icon: 'pi pi-handshake', status: 'OK', detail: '2 LOI подписано, 1 переговоры', updated: 'вчера' },
  { id: 'news', name: 'Новостной фон', icon: 'pi pi-megaphone', status: 'OK', detail: 'Нейтральный. Упоминания в СМИ: 3 за нед.', updated: '2ч назад' },
  { id: 'regulatory', name: 'Регуляторный', icon: 'pi pi-shield', status: 'WARN', detail: 'Проект приказа Росавиации 114-П — мониторинг', updated: 'сег. 08:00' },
  { id: 'tech', name: 'Технический прогресс', icon: 'pi pi-cog', status: 'OK', detail: 'TRL 6 подтверждён испытаниями Q4 2025', updated: '3дн назад' },
])

const eventFeed = ref([
  { id: 1, icon: 'pi pi-check-circle',       color: 'var(--fst-green)',  time: '09:15', text: 'Транш 1 (60 млн) выплачен, SPV зарегистрирован' },
  { id: 2, icon: 'pi pi-users',              color: 'var(--fst-blue)',   time: '10:30', text: 'Найм: принят Senior UAV Engineer' },
  { id: 3, icon: 'pi pi-file',              color: 'var(--fst-purple)', time: '11:00', text: 'LOI подписан с ГТЛК (Гос. транспортная лизинговая компания)' },
  { id: 4, icon: 'pi pi-exclamation-triangle', color: 'var(--fst-brand)', time: '11:30', text: 'Росавиация: мониторинг проекта приказа 114-П' },
])

// ── Computed ──────────────────────────────────────────────────
const runway = computed(() => {
  if (sim.value.burnRate <= 0) return 24
  const cash = 180_000_000 - (tick.value * 700_000)
  return Math.max(0, Math.round(cash / sim.value.burnRate))
})

const runwayColor = computed(() => {
  const r = runway.value
  return r >= 12 ? 'var(--fst-green)' : r >= 6 ? 'var(--fst-brand)' : 'var(--fst-red)'
})

const healthScore = computed(() => {
  let score = 50
  score += (sim.value.trl / 9) * 15
  score += (sim.value.mrl / 10) * 10
  score += (sim.value.sovereignty / 9) * 10
  score += Math.min(15, runway.value / 24 * 15)
  const okSensors = sensors.value.filter(s => s.status === 'OK').length
  score += (okSensors / sensors.value.length) * 10
  return Math.round(Math.min(100, score))
})

const healthGradient = computed(() => {
  const h = healthScore.value
  if (h >= 75) return 'linear-gradient(135deg, var(--fst-green-dark), var(--fst-green))'
  if (h >= 50) return 'linear-gradient(135deg, var(--fst-brand-dark), var(--fst-brand))'
  return 'linear-gradient(135deg, var(--fst-red-dark), var(--fst-red))'
})

const verdictBg = computed(() => {
  const h = healthScore.value
  return h >= 75
    ? 'color-mix(in srgb, var(--fst-green) 15%, transparent)'
    : h >= 50
    ? 'color-mix(in srgb, var(--fst-brand) 15%, transparent)'
    : 'color-mix(in srgb, var(--fst-red) 15%, transparent)'
})

// ── Ontology UI Blocks ────────────────────────────────────────
// Читаем timeline событий, вытаскиваем те, что несут uiBlock-нагрузку.
// Этот computed — единственный источник правды для живой панели.
const ontologyBlocks = computed(() => {
  const timeline = eventStore.getTimeline('company', DT_COMPANY_ID)
  // Map: id → последнее событие (перезапись)
  const map = new Map()
  for (const event of timeline) {
    const b = event.data?.uiBlock
    if (!b) continue
    map.set(b.id, { ...b, _ts: event.ts, _eventType: event.type })
  }
  // Map сохраняет порядок первого появления — карточки не прыгают
  return [...map.values()]
})

const vitals = computed(() => [
  { key: 'rev',     label: 'Выручка/мес',    value: fmtM(sim.value.revenue),              delta: 3.2,  unit: '%',    color: 'var(--fst-green)'  },
  { key: 'burn',    label: 'Burn Rate/мес',  value: fmtM(sim.value.burnRate),             delta: -2.1, unit: '%',    color: 'var(--fst-red)'    },
  { key: 'head',    label: 'Команда',        value: sim.value.headcount + ' чел.',        delta: 2,    unit: ' чел', color: 'var(--fst-blue)'   },
  { key: 'val',     label: 'Оценка',         value: fmtM(sim.value.valuation),            delta: 8.3,  unit: '%',    color: 'var(--fst-purple)' },
  { key: 'patents', label: 'Патентов',       value: sim.value.patents.toString(),         delta: 0,    unit: '',     color: 'var(--fst-brand)'  },
  { key: 'loi',     label: 'LOI / Контрактов', value: '2 / 1',                           delta: 1,    unit: '',     color: 'var(--fst-green)'  },
])

// ── Chart ─────────────────────────────────────────────────────
const revenueChart = ref(null)
let chart = null

function initChart() {
  if (!revenueChart.value) return
  chart?.destroy()
  const ctx = revenueChart.value.getContext('2d')
  chart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: [...revenueHistory.value].map((_, i) => `Q${i + 1}`),
      datasets: [
        { label: 'Выручка', data: [...revenueHistory.value], borderColor: '#4caf50', backgroundColor: 'rgba(76,175,80,0.1)', tension: 0.4, fill: true, pointRadius: 3 },
        { label: 'Burn', data: [...burnHistory.value], borderColor: '#ef5350', backgroundColor: 'rgba(239,83,80,0.05)', tension: 0.4, fill: true, borderDash: [4,2], pointRadius: 2 },
      ],
    },
    options: {
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: '#333' }, ticks: { color: '#aaa', font: { size: 10 } } },
        y: { grid: { color: '#333' }, ticks: { color: '#aaa', font: { size: 10 } } },
      },
      animation: false,
      responsive: false,
    },
  })
}

// ── Simulation ────────────────────────────────────────────────
function step() {
  tick.value++
  lastUpdate.value = new Date().toLocaleTimeString('ru-RU')
  liveColor.value = 'var(--fst-green)'

  // Revenue growth ~3% per tick
  sim.value.revenue = Math.round(sim.value.revenue * (1 + 0.03 * (0.5 + Math.random())))
  sim.value.burnRate = Math.round(sim.value.burnRate * (1 + 0.01 * (Math.random() - 0.3)))
  sim.value.valuation = Math.round(sim.value.valuation * (1 + 0.015 * Math.random()))

  // TRL/MRL slow growth
  const prevTrl = sim.value.trl
  if (tick.value % 15 === 0 && sim.value.trl < 9) sim.value.trl++
  if (tick.value % 20 === 0 && sim.value.mrl < 10) sim.value.mrl++
  if (tick.value % 30 === 0 && sim.value.sovereignty < 9) sim.value.sovereignty++
  if (sim.value.trl > prevTrl) {
    eventStore.add('company', DT_COMPANY_ID, 'TRL_ADVANCED', {
      from: prevTrl, to: sim.value.trl,
      uiBlock: {
        id: 'trl-current',
        type: 'achievement',
        color: 'var(--fst-blue)',
        level: sim.value.trl,
        maxLevel: 9,
        emoji: sim.value.trl >= 8 ? '🚀' : sim.value.trl >= 6 ? '⚡' : '🔬',
        title: `TRL ${prevTrl} → ${sim.value.trl}`,
        body: `Технологическая готовность подтверждена. Открывает новые условия финансирования.`,
      },
    })
  }

  // Hiring
  if (tick.value % 8 === 0) sim.value.headcount++
  if (tick.value % 25 === 0) sim.value.patents++

  // KPI updates
  kpiTriggers.value[0].progress = Math.min(100, sim.value.revenue / 30_000_000 * 100)
  kpiTriggers.value[0].current = fmtM(sim.value.revenue)
  kpiTriggers.value[1].progress = sim.value.trl / 7 * 100
  kpiTriggers.value[1].current = sim.value.trl.toString()
  kpiTriggers.value[2].progress = sim.value.mrl / 6 * 100
  kpiTriggers.value[2].current = sim.value.mrl.toString()
  kpiTriggers.value[3].progress = Math.min(100, sim.value.sovereignty / 7 * 100)
  kpiTriggers.value[3].current = sim.value.sovereignty.toString()
  kpiTriggers.value[4].progress = Math.min(100, sim.value.headcount / 35 * 100)
  kpiTriggers.value[4].current = sim.value.headcount.toString()

  // Tranche 2 unlock when TRL>=7 reached
  if (sim.value.trl >= 7 && !tranches.value[1].released) {
    tranches.value[1].released = true
    tranches.value[1].active = false
    tranches.value[2].active = true
    addEvent({ icon: 'pi pi-check-circle', color: 'var(--fst-green)', text: 'Транш 2 (70 млн): TRL 7 достигнут — выплата!' })
    eventStore.add('company', DT_COMPANY_ID, 'TRANCHE_RELEASED', {
      uiBlock: {
        id: 'tranche-2-released',
        type: 'milestone',
        color: 'var(--fst-green)',
        stamp: '✓ ВЫПЛАЧЕНО',
        amount: '70 млн ₽',
        title: 'Транш 2 разблокирован',
        body: 'TRL 7 подтверждён. Смарт-контракт исполнен автоматически.',
        action: { label: 'Смарт-контракт', scroll: 'contract' },
      },
    })
  }

  // Revenue chart every 5 ticks
  if (tick.value % 5 === 0) {
    revenueHistory.value.push(+(sim.value.revenue / 1_000_000).toFixed(1))
    burnHistory.value.push(+(sim.value.burnRate / 1_000_000).toFixed(1))
    if (revenueHistory.value.length > 12) revenueHistory.value.shift()
    if (burnHistory.value.length > 12) burnHistory.value.shift()
    nextTick(() => { try { updateChart() } catch (e) {} })
  }

  // Stage progression
  if (sim.value.trl >= 7 && sim.value.mrl >= 6 && sim.value.stage === 'seed') {
    sim.value.stage = 'round_a'
    addEvent({ icon: 'pi pi-arrow-up-right', color: 'var(--fst-purple)', text: 'Переход: Seed → Раунд A!' })
    eventStore.add('company', DT_COMPANY_ID, 'ROUND_OPENED', {
      round: 'A', trl: sim.value.trl,
      uiBlock: {
        id: 'round-a-opened',
        type: 'milestone',
        color: 'var(--fst-purple)',
        stamp: '★ РАУНД A',
        amount: '300 млн ₽',
        title: 'Открыт Раунд A',
        body: 'TRL 7 + MRL 6 достигнуты. Компания готова к масштабированию.',
        action: { label: 'Структурировать сделку', route: '/fst-deal' },
      },
    })
  }

  // Survival & exit prediction
  sim.value.survivalProb = Math.min(0.98, 0.5 + (sim.value.trl / 9) * 0.15 + (sim.value.mrl / 10) * 0.1 + (sim.value.sovereignty / 9) * 0.1 + Math.min(1, runway.value / 12) * 0.13)
  sim.value.exitMultiple = 2 + (sim.value.trl / 9) * 3 + (sim.value.mrl / 10) * 2

  // Verdict + risk event
  const h = healthScore.value
  sim.value.verdict = h >= 75 ? 'Портфель здоров — плановый мониторинг' : h >= 55 ? 'Внимание: риски под контролем, наблюдаем' : 'ВНИМАНИЕ: требуется вмешательство ФСТ!'

  // Живой KPI-блок — тикер с метриками
  eventStore.add('company', DT_COMPANY_ID, 'KPI_UPDATED', {
    uiBlock: {
      id: 'live-kpi',
      type: 'ticker',
      color: 'var(--fst-blue)',
      stage: sim.value.stage === 'seed' ? 'Seed' : 'Раунд A',
      tick: tick.value,
      metrics: [
        { k: 'rev',  l: 'Выручка',  v: fmtM(sim.value.revenue),  up: true },
        { k: 'burn', l: 'Burn/мес', v: fmtM(sim.value.burnRate), up: false },
        { k: 'run',  l: 'Runway',   v: runway.value + ' мес',    up: runway.value >= 9 },
        { k: 'head', l: 'Команда',  v: sim.value.headcount + ' чел', up: true },
      ],
    },
    revenue: sim.value.revenue, burnRate: sim.value.burnRate,
    trl: sim.value.trl, headcount: sim.value.headcount,
  })

  // Здоровье — HP-полоса, обновляется каждые 3 тика
  if (tick.value % 3 === 0) {
    const hColor = h >= 75 ? 'var(--fst-green)' : h >= 55 ? 'var(--fst-brand)' : 'var(--fst-red)'
    eventStore.add('company', DT_COMPANY_ID, 'HEALTH_SNAPSHOT', {
      uiBlock: {
        id: 'live-health',
        type: 'health',
        color: hColor,
        value: h,
        label: h >= 75 ? 'Здоров' : h >= 55 ? 'Внимание' : 'Критично',
        sub: `TRL ${sim.value.trl}/9 · MRL ${sim.value.mrl}/10 · выживаемость ${Math.round(sim.value.survivalProb * 100)}%`,
      },
      health: h,
    })
  }

  // Риск-блок с фиксированным id (обновляется, не накапливается)
  if (h < 50 && tick.value % 20 === 0) {
    eventStore.add('company', DT_COMPANY_ID, 'RISK_ELEVATED', {
      level: h < 30 ? 'critical' : 'high',
      health: h,
      runway: runway.value,
      uiBlock: {
        id: 'risk-current',
        type: 'alert',
        color: h < 30 ? 'var(--fst-red)' : 'var(--fst-brand)',
        critical: h < 30,
        title: h < 30 ? '🚨 Критический риск' : '⚠️ Повышенный риск',
        body: `Здоровье: ${h}/100 · Runway: ${runway.value} мес.`,
        action: { label: 'Созвать ИК', route: '/fst-committee' },
      },
    })
  }
  // Runway warning block (один раз при падении ниже 6 мес)
  if (runway.value <= 6 && runway.value > 0 && !emittedBlocks.has('runway-critical')) {
    emittedBlocks.add('runway-critical')
    eventStore.add('company', DT_COMPANY_ID, 'RUNWAY_CRITICAL', {
      runway: runway.value,
      uiBlock: {
        id: 'runway-critical',
        type: 'alert',
        color: 'var(--fst-red)',
        critical: true,
        title: `🔴 Runway: ${runway.value} мес.`,
        body: 'Денег осталось меньше 6 месяцев. Нужен бридж или раунд A.',
        action: { label: 'Открыть Раунд A', route: '/fst-deal' },
      },
    })
  }

  // Обновление датчиков из симуляции каждые 5 тиков
  if (tick.value % 5 === 0) {
    const r = runway.value
    const find = (id) => sensors.value.find(s => s.id === id)
    const s_runway = find('runway')
    if (s_runway) {
      s_runway.status = r >= 9 ? 'OK' : r >= 6 ? 'WARN' : 'ERR'
      s_runway.detail = `Runway ${r} мес. при текущем burn`
      s_runway.updated = 'live'
    }
    const s_tech = find('tech')
    if (s_tech) {
      s_tech.status = sim.value.trl >= 7 ? 'OK' : sim.value.trl >= 5 ? 'WARN' : 'ERR'
      s_tech.detail = `TRL ${sim.value.trl}/9, MRL ${sim.value.mrl}/10`
      s_tech.updated = `тик ${tick.value}`
    }
    const s_hiring = find('hiring')
    if (s_hiring) {
      s_hiring.status = sim.value.headcount > 20 ? 'OK' : 'WARN'
      s_hiring.detail = `Команда: ${sim.value.headcount} чел.`
      s_hiring.updated = `тик ${tick.value}`
    }
    const s_patents = find('patents')
    if (s_patents) {
      s_patents.status = sim.value.patents >= 3 ? 'OK' : 'WARN'
      s_patents.detail = `Патентов: ${sim.value.patents}`
      s_patents.updated = `тик ${tick.value}`
    }
  }

  // Random events
  if (Math.random() < 0.05) {
    const evts = [
      { icon: 'pi pi-star',              color: 'var(--fst-brand)',  text: 'Победа в конкурсе Минпромторг "БПЛА 2025"' },
      { icon: 'pi pi-handshake',         color: 'var(--fst-blue)',   text: 'Новый партнёр: Ростех — пилот БПЛА-доставки' },
      { icon: 'pi pi-exclamation-triangle', color: 'var(--fst-red)', text: 'Уволился ключевой разработчик — требует внимания' },
      { icon: 'pi pi-file-check',        color: 'var(--fst-purple)', text: 'Новый патент зарегистрирован (навигация в GPS-denied)' },
    ]
    addEvent(evts[Math.floor(Math.random() * evts.length)])
  }

  setTimeout(() => { liveColor.value = 'var(--p-text-muted-color)' }, 300)
}

let eventId = 10
function addEvent(e) {
  eventFeed.value.unshift({ ...e, id: eventId++, time: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) })
  if (eventFeed.value.length > 12) eventFeed.value.pop()
}

function updateChart() {
  if (!chart) { try { initChart() } catch(e) {} return }
  try {
    const rev = revenueHistory.value.map(Number)
    const burn = burnHistory.value.map(Number)
    chart.data.labels = rev.map((_, i) => `Q${i + 1}`)
    chart.data.datasets[0].data = rev
    chart.data.datasets[1].data = burn
    chart.update('none')
  } catch (e) { console.warn('[chart] update error:', e.message) }
}

function toggleRun() {
  running.value = !running.value
  if (running.value) scheduleTimer()
  else clearTimeout(timer)
}

function scheduleTimer() {
  if (!running.value) return
  const ms = Math.round(2000 / speed.value)
  timer = setTimeout(() => {
    try { step() } catch (e) { console.warn('[sim] step error:', e.message) }
    scheduleTimer()
  }, ms)
}

function resetSim() {
  clearTimeout(timer)
  tick.value = 0
  sim.value = { trl: 6, mrl: 4, sovereignty: 7, revenue: 12_000_000, burnRate: 8_500_000, headcount: 23, valuation: 540_000_000, patents: 3, stage: 'seed', survivalProb: 0.78, exitYear: 2029, exitMultiple: 4.2, verdict: 'Мониторинг: показатели в норме' }
  revenueHistory.value = [8, 9, 10, 12]
  burnHistory.value = [9, 9, 8.5, 8.5]
  tranches.value[1].released = false; tranches.value[1].active = true
  tranches.value[2].active = false
  running.value = true
  scheduleTimer()
}

function statusColor(s) {
  return s === 'OK' ? 'var(--fst-green)' : s === 'WARN' ? 'var(--fst-brand)' : 'var(--fst-red)'
}

function fmtM(v) {
  if (!v) return '0'
  if (v >= 1e9) return (v / 1e9).toFixed(1) + ' млрд'
  if (v >= 1e6) return (v / 1e6).toFixed(1) + ' млн'
  return (v / 1e3).toFixed(0) + ' тыс'
}

watch(speed, () => {
  clearTimeout(timer)
  if (running.value) scheduleTimer()
})

onMounted(() => {
  eventStore.load('company', DT_COMPANY_ID).catch(() => {})
  nextTick(() => { try { initChart() } catch(e) { console.warn('[chart] init error:', e.message) } scheduleTimer() })
})
onUnmounted(() => { clearTimeout(timer); chart?.destroy() })
</script>

<style scoped>
.fdt-root {
  min-height: 100vh;
  background: var(--surface-ground);
  color: var(--p-text-color);
  font-family: 'Inter', sans-serif;
  display: flex;
  flex-direction: column;
}

/* Header */
/* ─── Topbar: base via .fst-topbar-left (fst.css) ─── */
.fdt-title-group { display: flex; align-items: center; gap: 8px; }
.fdt-live-dot { font-size: 8px; }
.fdt-updated {
  font-size: 10px;
  color: var(--p-text-muted-color);
  margin-top: 2px;
}

/* ─── Metrics strip: base via .fst-metrics-strip + .fst-metric-item (fst.css) ─── */
.fdt-metrics { border-bottom: 1px solid var(--p-content-border-color); }

/* Main grid */
.fdt-main {
  display: grid;
  grid-template-columns: 280px 1fr 300px;
  gap: 0;
  flex: 1;
  overflow: hidden;
}
.fdt-col {
  padding: 12px;
  overflow-y: auto;
  border-right: 1px solid var(--p-content-border-color);
}
.fdt-col-contract { border-right: none }

.fdt-panel-title {
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--p-text-muted-color);
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 10px;
}

/* Vitals */
.fdt-vitals-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-bottom: 12px;
}
.fdt-vital {
  background: var(--p-surface-section);
  border-radius: 6px;
  padding: 8px;
}
.fdt-vital-label { font-size: 10px; color: var(--p-text-muted-color) }
.fdt-vital-value { font-size: 15px; font-weight: 700; margin: 2px 0 }
.fdt-vital-delta { font-size: 11px; display: flex; align-items: center; gap: 3px }
.fdt-vital-delta.pos { color: var(--fst-green) }
.fdt-vital-delta.neg { color: var(--fst-red) }

.fdt-spark-section { margin-bottom: 12px }
.fdt-spark-label { font-size: 11px; color: var(--p-text-muted-color); margin-bottom: 4px }

.fdt-trl-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 5px;
}
.fdt-trl-label { font-size: 10px; color: var(--p-text-muted-color); width: 52px }
.fdt-trl-dots { display: flex; gap: 3px }
.fdt-trl-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 1.5px solid;
}
.fdt-trl-val { font-size: 11px; font-weight: 600; min-width: 28px }

/* Sensors — компактные чипы */
.fdt-sensors-chips {
  display: flex; flex-wrap: wrap; gap: 5px;
}
.fdt-sensor-chip {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 3px 7px 3px 5px;
  background: color-mix(in srgb, var(--sc, var(--fst-green)) 8%, var(--p-surface-card));
  border: 1px solid color-mix(in srgb, var(--sc, var(--fst-green)) 25%, transparent);
  border-radius: 20px;
  font-size: 0.68rem; cursor: default;
  transition: background 0.3s, border-color 0.3s;
}
.fdt-sensor-chip-dot {
  width: 6px; height: 6px; border-radius: 50%;
  background: var(--sc, var(--fst-green)); flex-shrink: 0;
}
.fdt-sensor-chip-icon {
  font-size: 0.65rem; color: var(--sc, var(--fst-green));
}
.fdt-sensor-chip-name {
  color: var(--p-text-color); font-weight: 500;
  max-width: 90px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.fdt-sensor-chip-status {
  color: var(--sc, var(--fst-green)); font-weight: 700; font-size: 0.6rem;
}

.fdt-events-feed { display: flex; flex-direction: column; gap: 4px; max-height: 160px; overflow-y: auto }
.fdt-event-row { display: flex; align-items: flex-start; gap: 6px; font-size: 11px; padding: 3px 0; border-bottom: 1px solid var(--p-content-border-color) }
.fdt-event-time { color: var(--p-text-muted-color); min-width: 36px }
.fdt-event-text { flex: 1; line-height: 1.4 }
.fdt-event-enter-active { transition: all 0.3s }
.fdt-event-enter-from { opacity: 0; transform: translateY(-8px) }

/* Contract */
.fdt-contract-card {
  background: var(--p-surface-section);
  border-radius: 8px;
  padding: 10px;
  margin-bottom: 12px;
}
.fdt-contract-meta { margin-bottom: 10px }
.fdt-contract-line { font-size: 12px; margin-bottom: 3px }
.fdt-contract-line b { color: var(--p-text-color) }

.fdt-tranches-title { font-size: 11px; font-weight: 600; color: var(--p-text-muted-color); margin-bottom: 6px; text-transform: uppercase }
.fdt-tranche-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 0;
  border-bottom: 1px solid var(--p-content-border-color);
}
.fdt-tranche-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0 }
.fdt-tranche-info { flex: 1 }
.fdt-tranche-label { font-size: 11px; font-weight: 600 }
.fdt-tranche-cond { font-size: 10px; color: var(--p-text-muted-color) }
.fdt-tranche-amount { font-size: 12px; font-weight: 700 }

/* KPI */
.fdt-kpi-list { display: flex; flex-direction: column; gap: 7px }
.fdt-kpi-row { display: flex; flex-direction: column; gap: 3px }
.fdt-kpi-name { font-size: 11px }
.fdt-kpi-bar-wrap { display: flex; align-items: center; gap: 6px }
.fdt-kpi-bar-bg { flex: 1; height: 6px; background: var(--p-content-border-color); border-radius: 3px; overflow: hidden }
.fdt-kpi-bar-fill { height: 100%; border-radius: 3px; transition: width 0.5s }
.fdt-kpi-pct { font-size: 10px; min-width: 28px; text-align: right }
.fdt-kpi-target { font-size: 10px; color: var(--p-text-muted-color) }

/* AI Card */
.fdt-ai-card { background: var(--p-surface-section); border-radius: 8px; padding: 10px }
.fdt-ai-score-row { display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 5px }
.fdt-ai-verdict { font-size: 12px; padding: 7px 10px; border-radius: 6px; margin-top: 8px; display: flex; align-items: center; gap: 6px }

/* Timeline */
.fdt-timeline {
  background: var(--surface-card);
  border-top: 1px solid var(--p-content-border-color);
  padding: 8px 16px;
}
.fdt-tl-stages {
  display: flex;
  align-items: center;
  gap: 0;
}
.fdt-tl-stage {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  flex: 1;
  position: relative;
}
.fdt-tl-stage::before {
  content: '';
  position: absolute;
  top: 9px;
  left: 0;
  right: 0;
  height: 2px;
  background: var(--p-content-border-color);
  z-index: 0;
}
.fdt-tl-stage.done::before { background: var(--fst-green) }
.fdt-tl-stage.active::before { background: linear-gradient(90deg, var(--fst-green), var(--fst-blue)) }
.fdt-tl-stage-dot {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  z-index: 1;
  border: 2px solid var(--p-content-border-color);
  transition: all 0.3s;
}
.fdt-tl-stage.active .fdt-tl-stage-dot { border-color: var(--fst-blue); box-shadow: 0 0 6px var(--fst-blue) }
.fdt-tl-stage-label { font-size: 10px; color: var(--p-text-muted-color) }
.fdt-tl-stage.active .fdt-tl-stage-label { color: var(--fst-blue); font-weight: 600 }

/* ── Ontology Blocks Panel ── */
.fdt-ob-panel {
  padding: 12px 16px 14px;
  background: var(--p-surface-card);
  border-top: 1px solid var(--p-content-border-color);
  border-bottom: 1px solid var(--p-content-border-color);
}
.fdt-ob-header {
  display: flex; align-items: center; gap: 8px; margin-bottom: 10px;
}
.fdt-ob-title {
  font-size: 0.78rem; font-weight: 700; color: var(--p-text-color);
}
.fdt-ob-subtitle {
  font-weight: 400; color: var(--p-text-muted-color); font-size: 0.72rem;
}
.fdt-ob-count {
  margin-left: auto;
  background: color-mix(in srgb, var(--p-primary-color) 15%, transparent);
  color: var(--p-primary-color);
  border-radius: 10px; padding: 1px 8px; font-size: 0.7rem; font-weight: 700;
}
.fdt-ob-list {
  display: flex; flex-wrap: wrap; gap: 8px;
}

/* ── Ontology Scene Cards ── */
.fdt-ob-scene {
  border-radius: 10px;
  overflow: hidden;
  flex: 1 1 220px; min-width: 200px; max-width: 380px;
}

/* TICKER */
.fdt-ob-scene--ticker {
  background: var(--p-surface-card);
  border: 1px solid color-mix(in srgb, var(--p-primary-color) 30%, transparent);
  padding: 8px 10px;
}
.fdt-ticker-head {
  display: flex; align-items: center; gap: 6px; margin-bottom: 7px;
}
.fdt-ticker-dot {
  color: var(--p-primary-color); font-size: 0.5rem;
  animation: ob-dot-blink 1s step-start infinite;
}
.fdt-ticker-live {
  background: var(--fst-red); color: #fff;
  font-size: 0.55rem; font-weight: 900;
  padding: 1px 5px; border-radius: 3px; letter-spacing: 1px;
}
.fdt-ticker-stage {
  color: var(--p-primary-color); font-size: 0.65rem; font-weight: 700;
}
.fdt-ticker-tick {
  margin-left: auto; color: var(--p-text-muted-color); font-size: 0.6rem;
}
.fdt-ticker-metrics {
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px;
}
.fdt-ticker-metric {
  display: flex; flex-direction: column; align-items: center; gap: 1px;
  background: var(--fst-glass-xs); border-radius: 4px; padding: 4px 2px;
}
.fdt-tm-val { font-size: 0.72rem; font-weight: 700; color: var(--p-text-color); }
.fdt-tm-lbl { font-size: 0.52rem; color: var(--p-text-muted-color); }
.fdt-tm-arrow { font-size: 0.55rem; }
.fdt-tm-arrow.up { color: var(--fst-green); }
.fdt-tm-arrow.dn { color: var(--fst-red); }

/* HEALTH */
.fdt-ob-scene--health {
  background: var(--p-surface-card);
  border: 1px solid var(--p-content-border-color);
  padding: 10px 12px;
}
.fdt-health-scene-header {
  display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 6px;
}
.fdt-hs-label { font-size: 0.72rem; font-weight: 700; color: var(--p-text-color); }
.fdt-hs-num { font-size: 1.1rem; font-weight: 900; }
.fdt-hs-max { font-size: 0.6rem; color: var(--p-text-muted-color); font-weight: 400; }
.fdt-hp-track {
  position: relative; height: 12px;
  background: var(--p-surface-section); border-radius: 6px; overflow: hidden; margin-bottom: 6px;
}
.fdt-hp-fill {
  height: 100%; border-radius: 6px;
  transition: width 0.5s ease, background 0.5s ease;
  box-shadow: 0 0 6px var(--sc, var(--fst-green));
}
.fdt-hp-segments {
  position: absolute; inset: 0; display: flex;
}
.fdt-hp-seg {
  flex: 1; border-right: 1px solid var(--fst-border-subtle);
}
.fdt-hp-seg:last-child { border: none; }
.fdt-hs-sub { font-size: 0.62rem; color: var(--p-text-muted-color); }

/* ACHIEVEMENT */
.fdt-ob-scene--achievement {
  background: color-mix(in srgb, var(--p-primary-color) 6%, var(--p-surface-card));
  border: 1px solid color-mix(in srgb, var(--p-primary-color) 30%, transparent);
  padding: 10px 12px;
}
.fdt-ach-scene {
  display: flex; align-items: center; gap: 10px;
}
.fdt-ach-emoji { font-size: 2rem; line-height: 1; }
.fdt-ach-badge {
  display: flex; align-items: baseline; gap: 2px;
  background: var(--p-primary-color);
  border-radius: 8px; padding: 4px 10px; flex-shrink: 0;
}
.fdt-ach-lvl { font-size: 1.5rem; font-weight: 900; color: #fff; }
.fdt-ach-max { font-size: 0.7rem; color: rgba(255,255,255,0.65); }
.fdt-ach-text { flex: 1; min-width: 0; }
.fdt-ach-title { font-size: 0.78rem; font-weight: 700; color: var(--p-text-color); margin-bottom: 3px; }
.fdt-ach-body { font-size: 0.62rem; color: var(--p-text-muted-color); line-height: 1.4; }

/* MILESTONE */
.fdt-ob-scene--milestone {
  background: var(--p-surface-card);
  border: 1px solid var(--sc, var(--fst-green));
  padding: 10px 12px;
}
.fdt-ms-scene { display: flex; align-items: center; gap: 10px; }
.fdt-ms-stamp {
  flex-shrink: 0;
  border: 2px solid var(--sc, var(--fst-green)); border-radius: 6px;
  padding: 4px 8px; font-size: 0.6rem; font-weight: 900;
  letter-spacing: 1px; text-transform: uppercase; text-align: center;
  transform: rotate(-8deg); white-space: nowrap; opacity: 0.9;
  color: var(--sc, var(--fst-green));
}
.fdt-ms-main { flex: 1; min-width: 0; }
.fdt-ms-amount { font-size: 1.1rem; font-weight: 900; line-height: 1; }
.fdt-ms-title { font-size: 0.72rem; font-weight: 700; color: var(--p-text-color); margin: 2px 0 1px; }
.fdt-ms-body { font-size: 0.62rem; color: var(--p-text-muted-color); }

/* ALERT */
.fdt-ob-scene--alert {
  border: 2px solid var(--sc, var(--fst-brand));
  flex: 1 1 100%; max-width: 100%;
}
.fdt-alert-scene {
  background: color-mix(in srgb, var(--sc, var(--fst-brand)) 10%, var(--p-surface-card));
  padding: 10px 14px;
  display: flex; align-items: center; gap: 12px;
  flex-wrap: wrap;
}
.fdt-alert-critical { animation: alert-flash 1.5s ease-in-out infinite; }
@keyframes alert-flash {
  0%, 100% { background: color-mix(in srgb, var(--fst-red) 10%, var(--p-surface-card)); }
  50%       { background: color-mix(in srgb, var(--fst-red) 18%, var(--p-surface-card)); }
}
.fdt-alert-title { font-size: 0.85rem; font-weight: 900; color: var(--p-text-color); }
.fdt-alert-body { flex: 1; font-size: 0.68rem; color: var(--p-text-muted-color); }

/* Transitions */
.fdt-ob-fade-enter-active, .fdt-ob-fade-leave-active { transition: opacity 0.4s, transform 0.4s; }
.fdt-ob-fade-enter-from { opacity: 0; transform: translateY(8px); }
.fdt-ob-fade-leave-to { opacity: 0; }
.fdt-ob-list-enter-active { transition: all 0.35s ease; }
.fdt-ob-list-enter-from { opacity: 0; transform: translateY(12px) scale(0.97); }
.fdt-ob-list-leave-active { transition: all 0.2s ease; position: absolute; }
.fdt-ob-list-leave-to { opacity: 0; transform: scale(0.95); }
.fdt-ob-list-move { transition: transform 0.3s ease; }

@keyframes ob-dot-blink {
  0%, 100% { opacity: 1; } 50% { opacity: 0; }
}

/* ── Mobile adaptive ── */
@media (max-width: 768px) {
  .fdt-health-score { flex-wrap: wrap; gap: 8px; }
  .fdt-kpi-list { flex-wrap: wrap; gap: 8px; }
  .fdt-main { grid-template-columns: 1fr !important; }
  .fdt-vitals-grid { grid-template-columns: repeat(2, 1fr) !important; }
  .fdt-sidebar, .fdt-detail { max-height: 40vh; overflow-y: auto; border: none; border-bottom: 1px solid var(--surface-border); }
  .fdt-col { border-right: none; border-bottom: 1px solid var(--surface-border); padding: 12px; }
  .fdt-col:last-child { border-bottom: none; }
  .fdt-header-right .p-button .p-button-label { display: none; }
  .fdt-header-right .p-button .p-button-icon { margin-right: 0; }
  .fdt-header-right { gap: 6px; flex-wrap: wrap; }
}
</style>
