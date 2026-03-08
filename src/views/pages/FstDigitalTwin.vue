<template>
  <div class="fdt-root">
    <!-- Header -->
    <div class="fdt-header">
      <div class="fdt-header-left">
        <div class="fdt-logo">
          <i class="pi pi-building" style="color:#42a5f5;font-size:20px"></i>
          <span>ЦД · <b>{{ company.name }}</b></span>
          <Tag :value="company.stage" severity="info" style="font-size:11px" />
          <Tag :value="company.subFund" :style="{ background: '#42a5f5', color:'#fff', fontSize:'11px' }" />
        </div>
        <div class="fdt-updated">
          <i class="pi pi-circle-fill" :style="{ color: liveColor, fontSize:'8px' }"></i>
          Обновлено: {{ lastUpdate }} · Тик {{ tick }}
        </div>
      </div>
      <div class="fdt-header-center">
        <div class="fdt-health-badge" :style="{ background: healthGradient }">
          <span class="fdt-health-score">{{ healthScore }}</span>
          <span class="fdt-health-label">Здоровье</span>
        </div>
      </div>
      <div class="fdt-header-right">
        <Button :icon="running ? 'pi pi-pause' : 'pi pi-play'"
          :label="running ? 'Пауза' : 'Live'"
          :severity="running ? 'warn' : 'success'"
          size="small" @click="toggleRun" />
        <Button icon="pi pi-refresh" severity="secondary" size="small" @click="resetSim" title="Сброс" />
        <SelectButton :modelValue="speed" :options="speedOpts" optionLabel="l" optionValue="v"
          :allowEmpty="false" @update:modelValue="v => speed = v" size="small" />
      </div>
    </div>

    <!-- Main Grid -->
    <div class="fdt-main">

      <!-- Col 1: Vitals -->
      <div class="fdt-col fdt-col-vitals">
        <div class="fdt-panel-title"><i class="pi pi-chart-line" style="color:#42a5f5"></i> Жизненные показатели</div>

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
                :style="{ background: i <= sim.trl ? '#42a5f5' : 'transparent', borderColor: '#42a5f5' }"></div>
            </div>
            <span class="fdt-trl-val">{{ sim.trl }}/9</span>
          </div>
          <div class="fdt-trl-row">
            <span class="fdt-trl-label">MRL</span>
            <div class="fdt-trl-dots">
              <div v-for="i in 10" :key="i" class="fdt-trl-dot"
                :style="{ background: i <= sim.mrl ? '#ffa726' : 'transparent', borderColor: '#ffa726' }"></div>
            </div>
            <span class="fdt-trl-val">{{ sim.mrl }}/10</span>
          </div>
          <div class="fdt-trl-row">
            <span class="fdt-trl-label">Суверен.</span>
            <div class="fdt-trl-dots">
              <div v-for="i in 9" :key="i" class="fdt-trl-dot"
                :style="{ background: i <= sim.sovereignty ? '#ef5350' : 'transparent', borderColor: '#ef5350' }"></div>
            </div>
            <span class="fdt-trl-val">{{ sim.sovereignty }}/9</span>
          </div>
        </div>
      </div>

      <!-- Col 2: Risk Sensors -->
      <div class="fdt-col fdt-col-sensors">
        <div class="fdt-panel-title"><i class="pi pi-shield" style="color:#ffa726"></i> Датчики рисков</div>

        <div class="fdt-sensors-list">
          <div v-for="s in sensors" :key="s.id" class="fdt-sensor-card"
            :style="{ borderLeft: `3px solid ${statusColor(s.status)}` }">
            <div class="fdt-sensor-header">
              <i :class="s.icon" :style="{ color: statusColor(s.status) }"></i>
              <span class="fdt-sensor-name">{{ s.name }}</span>
              <div class="fdt-sensor-status-dot" :style="{ background: statusColor(s.status) }"></div>
              <span class="fdt-sensor-status-label" :style="{ color: statusColor(s.status) }">{{ s.status }}</span>
            </div>
            <div class="fdt-sensor-detail">{{ s.detail }}</div>
            <div class="fdt-sensor-time">{{ s.updated }}</div>
          </div>
        </div>

        <!-- Event feed -->
        <div class="fdt-panel-title" style="margin-top:12px">
          <i class="pi pi-list" style="color:#66bb6a"></i> События
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
        <div class="fdt-panel-title"><i class="pi pi-file-check" style="color:#7e57c2"></i> Смарт-контракт</div>

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
              <div class="fdt-tranche-dot" :style="{ background: t.released ? '#4caf50' : t.active ? '#ffa726' : '#444' }"></div>
              <div class="fdt-tranche-info">
                <div class="fdt-tranche-label">{{ t.label }}</div>
                <div class="fdt-tranche-cond">{{ t.condition }}</div>
              </div>
              <div class="fdt-tranche-amount" :style="{ color: t.released ? '#4caf50' : t.active ? '#ffa726' : '#78909c' }">
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
          <i class="pi pi-bolt" style="color:#ffa726"></i> KPI-триггеры
        </div>
        <div class="fdt-kpi-list">
          <div v-for="kpi in kpiTriggers" :key="kpi.id" class="fdt-kpi-row">
            <div class="fdt-kpi-name">{{ kpi.name }}</div>
            <div class="fdt-kpi-bar-wrap">
              <div class="fdt-kpi-bar-bg">
                <div class="fdt-kpi-bar-fill"
                  :style="{ width: Math.min(100, kpi.progress) + '%', background: kpi.progress >= 100 ? '#4caf50' : '#42a5f5' }"></div>
              </div>
              <span class="fdt-kpi-pct" :style="{ color: kpi.progress >= 100 ? '#4caf50' : '#aaa' }">
                {{ kpi.progress.toFixed(0) }}%
              </span>
            </div>
            <div class="fdt-kpi-target">{{ kpi.current }} / {{ kpi.target }}</div>
          </div>
        </div>

        <!-- AI Analysis -->
        <div class="fdt-panel-title" style="margin-top:12px">
          <i class="pi pi-microchip-ai" style="color:#42a5f5"></i> AI-анализ
        </div>
        <div class="fdt-ai-card">
          <div class="fdt-ai-score-row">
            <span>Вероятность выживания:</span>
            <b :style="{ color: sim.survivalProb >= 0.7 ? '#4caf50' : sim.survivalProb >= 0.5 ? '#ffa726' : '#ef5350' }">
              {{ (sim.survivalProb * 100).toFixed(0) }}%
            </b>
          </div>
          <div class="fdt-ai-score-row">
            <span>Прогноз выхода:</span>
            <b style="color:#7e57c2">{{ sim.exitYear }}</b>
          </div>
          <div class="fdt-ai-score-row">
            <span>Ожидаемый multiple:</span>
            <b style="color:#4caf50">{{ sim.exitMultiple.toFixed(1) }}x</b>
          </div>
          <div class="fdt-ai-verdict" :style="{ background: verdictBg }">
            <i class="pi pi-flag"></i> {{ sim.verdict }}
          </div>
        </div>
      </div>

    </div>

    <!-- Timeline bar -->
    <div class="fdt-timeline">
      <div class="fdt-tl-stages">
        <div v-for="st in stages" :key="st.id"
          :class="['fdt-tl-stage', { 'active': sim.stage === st.id, 'done': stageOrder.indexOf(sim.stage) > stageOrder.indexOf(st.id) }]">
          <div class="fdt-tl-stage-dot" :style="{ background: sim.stage === st.id ? st.color : stageOrder.indexOf(sim.stage) > stageOrder.indexOf(st.id) ? '#4caf50' : '#333' }"></div>
          <div class="fdt-tl-stage-label">{{ st.label }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import Chart from 'chart.js/auto'

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
  { id: 'preseed', label: 'Pre-seed', color: '#78909c' },
  { id: 'seed', label: 'Seed', color: '#42a5f5' },
  { id: 'round_a', label: 'Раунд A', color: '#7e57c2' },
  { id: 'round_b', label: 'Раунд B', color: '#ffa726' },
  { id: 'growth', label: 'Growth', color: '#66bb6a' },
  { id: 'exit', label: 'Exit/IPO', color: '#4caf50' },
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
const liveColor = ref('#4caf50')

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
  { id: 1, icon: 'pi pi-check-circle', color: '#4caf50', time: '09:15', text: 'Транш 1 (60 млн) выплачен, SPV зарегистрирован' },
  { id: 2, icon: 'pi pi-users', color: '#42a5f5', time: '10:30', text: 'Найм: принят Senior UAV Engineer' },
  { id: 3, icon: 'pi pi-file', color: '#7e57c2', time: '11:00', text: 'LOI подписан с ГТЛК (Гос. транспортная лизинговая компания)' },
  { id: 4, icon: 'pi pi-exclamation-triangle', color: '#ffa726', time: '11:30', text: 'Росавиация: мониторинг проекта приказа 114-П' },
])

// ── Computed ──────────────────────────────────────────────────
const runway = computed(() => {
  if (sim.value.burnRate <= 0) return 24
  const cash = 180_000_000 - (tick.value * 700_000)
  return Math.max(0, Math.round(cash / sim.value.burnRate))
})

const runwayColor = computed(() => {
  const r = runway.value
  return r >= 12 ? '#4caf50' : r >= 6 ? '#ffa726' : '#ef5350'
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
  if (h >= 75) return 'linear-gradient(135deg, #1b5e20, #2e7d32)'
  if (h >= 50) return 'linear-gradient(135deg, #e65100, #f57c00)'
  return 'linear-gradient(135deg, #b71c1c, #c62828)'
})

const verdictBg = computed(() => {
  const h = healthScore.value
  return h >= 75 ? 'rgba(76,175,80,0.15)' : h >= 50 ? 'rgba(255,167,38,0.15)' : 'rgba(239,83,80,0.15)'
})

const vitals = computed(() => [
  { key: 'rev', label: 'Выручка/мес', value: fmtM(sim.value.revenue), delta: 3.2, unit: '%', color: '#4caf50' },
  { key: 'burn', label: 'Burn Rate/мес', value: fmtM(sim.value.burnRate), delta: -2.1, unit: '%', color: '#ef5350' },
  { key: 'head', label: 'Команда', value: sim.value.headcount + ' чел.', delta: 2, unit: ' чел', color: '#42a5f5' },
  { key: 'val', label: 'Оценка', value: fmtM(sim.value.valuation), delta: 8.3, unit: '%', color: '#7e57c2' },
  { key: 'patents', label: 'Патентов', value: sim.value.patents.toString(), delta: 0, unit: '', color: '#ffa726' },
  { key: 'loi', label: 'LOI / Контрактов', value: '2 / 1', delta: 1, unit: '', color: '#66bb6a' },
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
      labels: revenueHistory.value.map((_, i) => `Q${i + 1}`),
      datasets: [
        { label: 'Выручка', data: revenueHistory.value, borderColor: '#4caf50', backgroundColor: 'rgba(76,175,80,0.1)', tension: 0.4, fill: true, pointRadius: 3 },
        { label: 'Burn', data: burnHistory.value, borderColor: '#ef5350', backgroundColor: 'rgba(239,83,80,0.05)', tension: 0.4, fill: true, borderDash: [4,2], pointRadius: 2 },
      ],
    },
    options: {
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: '#333' }, ticks: { color: '#aaa', font: { size: 10 } } },
        y: { grid: { color: '#333' }, ticks: { color: '#aaa', font: { size: 10 } } },
      },
      animation: { duration: 300 },
    },
  })
}

// ── Simulation ────────────────────────────────────────────────
function step() {
  tick.value++
  lastUpdate.value = new Date().toLocaleTimeString('ru-RU')
  liveColor.value = '#4caf50'

  // Revenue growth ~3% per tick
  sim.value.revenue = Math.round(sim.value.revenue * (1 + 0.03 * (0.5 + Math.random())))
  sim.value.burnRate = Math.round(sim.value.burnRate * (1 + 0.01 * (Math.random() - 0.3)))
  sim.value.valuation = Math.round(sim.value.valuation * (1 + 0.015 * Math.random()))

  // TRL/MRL slow growth
  if (tick.value % 15 === 0 && sim.value.trl < 9) sim.value.trl++
  if (tick.value % 20 === 0 && sim.value.mrl < 10) sim.value.mrl++
  if (tick.value % 30 === 0 && sim.value.sovereignty < 9) sim.value.sovereignty++

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
    addEvent({ icon: 'pi pi-check-circle', color: '#4caf50', text: 'Транш 2 (70 млн): TRL 7 достигнут — выплата!' })
  }

  // Revenue chart every 5 ticks
  if (tick.value % 5 === 0) {
    revenueHistory.value.push(+(sim.value.revenue / 1_000_000).toFixed(1))
    burnHistory.value.push(+(sim.value.burnRate / 1_000_000).toFixed(1))
    if (revenueHistory.value.length > 12) revenueHistory.value.shift()
    if (burnHistory.value.length > 12) burnHistory.value.shift()
    nextTick(updateChart)
  }

  // Stage progression
  if (sim.value.trl >= 7 && sim.value.mrl >= 6 && sim.value.stage === 'seed') {
    sim.value.stage = 'round_a'
    addEvent({ icon: 'pi pi-arrow-up-right', color: '#7e57c2', text: 'Переход: Seed → Раунд A!' })
  }

  // Survival & exit prediction
  sim.value.survivalProb = Math.min(0.98, 0.5 + (sim.value.trl / 9) * 0.15 + (sim.value.mrl / 10) * 0.1 + (sim.value.sovereignty / 9) * 0.1 + Math.min(1, runway.value / 12) * 0.13)
  sim.value.exitMultiple = 2 + (sim.value.trl / 9) * 3 + (sim.value.mrl / 10) * 2

  // Verdict
  const h = healthScore.value
  sim.value.verdict = h >= 75 ? 'Портфель здоров — плановый мониторинг' : h >= 55 ? 'Внимание: риски под контролем, наблюдаем' : 'ВНИМАНИЕ: требуется вмешательство ФСТ!'

  // Random events
  if (Math.random() < 0.05) {
    const evts = [
      { icon: 'pi pi-star', color: '#ffa726', text: 'Победа в конкурсе Минпромторг "БПЛА 2025"' },
      { icon: 'pi pi-handshake', color: '#42a5f5', text: 'Новый партнёр: Ростех — пилот БПЛА-доставки' },
      { icon: 'pi pi-exclamation-triangle', color: '#ef5350', text: 'Уволился ключевой разработчик — требует внимания' },
      { icon: 'pi pi-file-check', color: '#7e57c2', text: 'Новый патент зарегистрирован (навигация в GPS-denied)' },
    ]
    addEvent(evts[Math.floor(Math.random() * evts.length)])
  }

  setTimeout(() => { liveColor.value = '#78909c' }, 300)
}

let eventId = 10
function addEvent(e) {
  eventFeed.value.unshift({ ...e, id: eventId++, time: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) })
  if (eventFeed.value.length > 12) eventFeed.value.pop()
}

function updateChart() {
  if (!chart) return
  chart.data.labels = revenueHistory.value.map((_, i) => `T${i + 1}`)
  chart.data.datasets[0].data = [...revenueHistory.value]
  chart.data.datasets[1].data = [...burnHistory.value]
  chart.update('none')
}

function toggleRun() {
  running.value = !running.value
  if (running.value) scheduleTimer()
  else clearTimeout(timer)
}

function scheduleTimer() {
  if (!running.value) return
  const ms = Math.round(2000 / speed.value)
  timer = setTimeout(() => { step(); scheduleTimer() }, ms)
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
  return s === 'OK' ? '#4caf50' : s === 'WARN' ? '#ffa726' : '#ef5350'
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
  nextTick(() => { initChart(); scheduleTimer() })
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
.fdt-header {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 10px 16px;
  background: var(--surface-card);
  border-bottom: 1px solid var(--p-content-border-color);
}
.fdt-header-left { flex: 1 }
.fdt-header-center { display: flex; justify-content: center }
.fdt-header-right { display: flex; gap: 8px; align-items: center }

.fdt-logo {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  font-weight: 600;
}
.fdt-updated {
  font-size: 11px;
  color: var(--p-text-muted-color);
  display: flex;
  align-items: center;
  gap: 5px;
  margin-top: 3px;
}

.fdt-health-badge {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 6px 20px;
  border-radius: 8px;
  min-width: 80px;
}
.fdt-health-score { font-size: 24px; font-weight: 700; color: #fff }
.fdt-health-label { font-size: 10px; color: rgba(255,255,255,0.7); text-transform: uppercase }

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
.fdt-vital-delta.pos { color: #4caf50 }
.fdt-vital-delta.neg { color: #ef5350 }

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

/* Sensors */
.fdt-sensors-list { display: flex; flex-direction: column; gap: 6px }
.fdt-sensor-card {
  background: var(--p-surface-section);
  border-radius: 6px;
  padding: 7px 10px;
}
.fdt-sensor-header {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
}
.fdt-sensor-name { flex: 1 }
.fdt-sensor-status-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
}
.fdt-sensor-status-label { font-size: 10px; font-weight: 600 }
.fdt-sensor-detail { font-size: 11px; color: var(--p-text-muted-color); margin-top: 3px }
.fdt-sensor-time { font-size: 10px; color: var(--p-text-muted-color); opacity: 0.6 }

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
.fdt-tl-stage.done::before { background: #4caf50 }
.fdt-tl-stage.active::before { background: linear-gradient(90deg, #4caf50, #42a5f5) }
.fdt-tl-stage-dot {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  z-index: 1;
  border: 2px solid var(--p-content-border-color);
  transition: all 0.3s;
}
.fdt-tl-stage.active .fdt-tl-stage-dot { border-color: #42a5f5; box-shadow: 0 0 6px #42a5f5 }
.fdt-tl-stage-label { font-size: 10px; color: var(--p-text-muted-color) }
.fdt-tl-stage.active .fdt-tl-stage-label { color: #42a5f5; font-weight: 600 }
</style>
