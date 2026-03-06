<template>
  <div class="fft-root">
    <!-- Header -->
    <div class="fft-header">
      <div class="fft-header-left">
        <div class="fft-logo">
          <i class="pi pi-building-columns" style="color:#ffa726;font-size:20px"></i>
          <span>Цифровой Двойник · <b>ФСТ НТИ</b></span>
          <Tag value="NAV Live" severity="warn" style="font-size:11px" />
        </div>
        <div class="fft-updated">
          <i class="pi pi-circle-fill" :style="{ color: liveColor, fontSize:'8px' }"></i>
          {{ lastUpdate }} · Квартал {{ quarter }} · {{ year }}
        </div>
      </div>
      <div class="fft-header-center">
        <div class="fft-kpi-bar">
          <div v-for="k in topKpis" :key="k.label" class="fft-top-kpi">
            <div class="fft-top-kpi-val" :style="{ color: k.color }">{{ k.value }}</div>
            <div class="fft-top-kpi-label">{{ k.label }}</div>
          </div>
        </div>
      </div>
      <div class="fft-header-right">
        <Button :icon="running ? 'pi pi-pause' : 'pi pi-play'"
          :label="running ? 'Пауза' : 'Live'"
          :severity="running ? 'warn' : 'success'"
          size="small" @click="toggleRun" />
        <SelectButton :modelValue="speed" :options="speedOpts" optionLabel="l" optionValue="v"
          :allowEmpty="false" @update:modelValue="v => speed = v" size="small" />
        <router-link to="/fst-twin">
          <Button label="Компания" icon="pi pi-building" size="small" severity="info" text />
        </router-link>
        <router-link to="/fst-committee">
          <Button label="ИК" icon="pi pi-comments" size="small" severity="secondary" text />
        </router-link>
      </div>
    </div>

    <!-- 3-Column Layout -->
    <div class="fft-main">

      <!-- Col 1: Portfolio Companies -->
      <div class="fft-col">
        <div class="fft-panel-title"><i class="pi pi-sitemap" style="color:#42a5f5"></i> Портфельные компании ({{ companies.length }})</div>

        <div class="fft-companies">
          <div v-for="c in companies" :key="c.id"
            :class="['fft-company-card', { 'fft-company-card--selected': selectedCompany?.id === c.id }]"
            @click="selectedCompany = c">
            <div class="fft-cc-header">
              <div class="fft-cc-name">{{ c.name }}</div>
              <Tag :value="c.stage" size="small" :severity="stageSeverity(c.stage)" />
              <div class="fft-cc-health" :style="{ background: healthColor(c.health) }">{{ c.health }}</div>
            </div>
            <div class="fft-cc-meta">
              <span><i class="pi pi-send" style="font-size:10px"></i> {{ c.subFund }}</span>
              <span>TRL {{ c.trl }} / MRL {{ c.mrl }}</span>
              <span>{{ fmtM(c.invested) }} инвест.</span>
            </div>
            <div class="fft-cc-bars">
              <div class="fft-cc-bar" :title="'TRL: ' + c.trl">
                <div :style="{ width: c.trl/9*100+'%', background: '#42a5f5' }"></div>
              </div>
              <div class="fft-cc-bar" :title="'Суверен: ' + c.sov">
                <div :style="{ width: c.sov/9*100+'%', background: c.sov >= 6 ? '#4caf50' : '#ffa726' }"></div>
              </div>
            </div>
            <div v-if="c.alert" class="fft-cc-alert">
              <i class="pi pi-exclamation-triangle" style="font-size:10px"></i> {{ c.alert }}
            </div>
          </div>
        </div>
      </div>

      <!-- Col 2: Fund Metrics + Subfunds + Charts -->
      <div class="fft-col fft-col-center">
        <!-- Fund index -->
        <div class="fft-fund-index-row">
          <div class="fft-fund-index">
            <div class="fft-fi-grade" :style="{ color: gradeColor }">{{ fundGrade }}</div>
            <div class="fft-fi-val">{{ fundIndex }}</div>
            <div class="fft-fi-label">Фонд-Индекс</div>
          </div>
          <div class="fft-fund-metrics">
            <div v-for="m in fundMetrics" :key="m.label" class="fft-fm-row">
              <span class="fft-fm-label">{{ m.label }}</span>
              <span class="fft-fm-val" :style="{ color: m.color }">{{ m.value }}</span>
              <div class="fft-fm-bar-bg">
                <div class="fft-fm-bar-fill" :style="{ width: m.pct+'%', background: m.color }"></div>
              </div>
            </div>
          </div>
        </div>

        <!-- Subfunds -->
        <div class="fft-panel-title" style="margin-top:12px">
          <i class="pi pi-building-columns" style="color:#ffa726"></i> Субфонды
        </div>
        <div class="fft-subfunds">
          <div v-for="sf in subfunds" :key="sf.id" class="fft-subfund" :style="{ borderTop: `3px solid ${sf.color}` }">
            <div class="fft-sf-header">
              <i :class="sf.icon" :style="{ color: sf.color }"></i>
              <b>{{ sf.name }}</b>
              <Tag :value="sf.leverage + ':1'" size="small" severity="secondary" />
            </div>
            <div class="fft-sf-budget">{{ fmtM(sf.deployed) }} / {{ fmtM(sf.budget) }}</div>
            <ProgressBar :value="sf.deployed/sf.budget*100" :showValue="false" style="height:5px;margin-top:4px"
              :style="{ '--p-progressbar-value-background': sf.color }" />
            <div class="fft-sf-companies">{{ sf.companies }} компаний · NAV: {{ fmtM(sf.nav) }}</div>
          </div>
        </div>

        <!-- Sankey-like flow -->
        <div class="fft-panel-title" style="margin-top:12px">
          <i class="pi pi-arrow-right-arrow-left" style="color:#7e57c2"></i> Инвест. потоки
        </div>
        <canvas ref="flowChart" height="120"></canvas>

        <!-- Portfolio health matrix -->
        <div class="fft-panel-title" style="margin-top:12px">
          <i class="pi pi-th-large" style="color:#66bb6a"></i> Матрица здоровья портфеля
        </div>
        <div class="fft-health-matrix">
          <div v-for="c in companies" :key="c.id" class="fft-hm-cell"
            :title="c.name + ': ' + c.health"
            :style="{ background: healthColor(c.health), opacity: 0.85 + c.health/1000 }">
            <span class="fft-hm-name">{{ c.nameShort }}</span>
            <span class="fft-hm-val">{{ c.health }}</span>
          </div>
        </div>
      </div>

      <!-- Col 3: Selected company detail + Events + AI -->
      <div class="fft-col">
        <!-- Selected company detail -->
        <div v-if="selectedCompany" class="fft-company-detail">
          <div class="fft-panel-title">
            <i class="pi pi-building" style="color:#42a5f5"></i> {{ selectedCompany.name }}
            <Button icon="pi pi-external-link" size="small" text severity="info"
              @click="() => $router.push('/fst-twin')" title="Открыть ЦД" />
          </div>
          <div class="fft-cd-grid">
            <div v-for="m in companyDetailMetrics" :key="m.l" class="fft-cd-item">
              <div class="fft-cd-label">{{ m.l }}</div>
              <div class="fft-cd-val" :style="{ color: m.c }">{{ m.v }}</div>
            </div>
          </div>
          <div class="fft-cd-risks">
            <div class="fft-panel-title"><i class="pi pi-shield"></i> Риски</div>
            <div v-for="r in selectedCompany.risks" :key="r.type" class="fft-cd-risk-row">
              <div class="fft-cd-risk-dot" :style="{ background: riskColor(r.level) }"></div>
              <span>{{ r.label }}</span>
              <Tag :value="r.level" size="small"
                :severity="r.level === 'HIGH' ? 'danger' : r.level === 'MED' ? 'warn' : 'success'" />
            </div>
          </div>
        </div>
        <div v-else class="fft-select-hint">
          <i class="pi pi-hand-pointer" style="font-size:24px;color:#444;margin-bottom:8px"></i>
          <div>Выберите компанию из портфеля</div>
        </div>

        <!-- Events -->
        <div class="fft-panel-title" style="margin-top:12px"><i class="pi pi-list" style="color:#66bb6a"></i> Фонд-события</div>
        <div class="fft-events">
          <TransitionGroup name="fft-evt" tag="div">
            <div v-for="e in fundEvents" :key="e.id" class="fft-evt-row">
              <i :class="e.icon" :style="{ color: e.color, fontSize:'11px' }"></i>
              <span class="fft-evt-time">{{ e.time }}</span>
              <span class="fft-evt-text">{{ e.text }}</span>
            </div>
          </TransitionGroup>
        </div>

        <!-- AI Forecast -->
        <div class="fft-panel-title" style="margin-top:12px"><i class="pi pi-microchip-ai" style="color:#42a5f5"></i> AI-прогноз фонда</div>
        <div class="fft-ai-forecast">
          <div class="fft-af-row"><span>NAV 2026:</span><b style="color:#4caf50">{{ fmtM(nav * 1.18) }}</b></div>
          <div class="fft-af-row"><span>NAV 2027:</span><b style="color:#66bb6a">{{ fmtM(nav * 1.42) }}</b></div>
          <div class="fft-af-row"><span>IRR (прогноз):</span><b style="color:#7e57c2">{{ forecastIRR }}%</b></div>
          <div class="fft-af-row"><span>DPI к 2028:</span><b style="color:#ffa726">{{ forecastDPI }}x</b></div>
          <div class="fft-af-verdict" :style="{ color: fundGradeColor }">
            <i class="pi pi-flag"></i> {{ aiVerdict }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import Chart from 'chart.js/auto'
import { useRouter } from 'vue-router'

const $router = useRouter()

// ── Fund Static Data ──────────────────────────────────────────
const subfunds = ref([
  { id: 'bas',   name: 'БАС',  icon: 'pi pi-send',         color: '#42a5f5', budget: 3_200_000_000, deployed: 1_120_000_000, companies: 3, nav: 1_340_000_000, leverage: 3 },
  { id: 'robot', name: 'РОБО', icon: 'pi pi-cog',           color: '#66bb6a', budget: 1_800_000_000, deployed: 360_000_000,   companies: 2, nav: 430_000_000,   leverage: 3 },
  { id: 'me',    name: 'МЭ',   icon: 'pi pi-microchip-ai',  color: '#ffa726', budget: 1_400_000_000, deployed: 450_000_000,   companies: 2, nav: 510_000_000,   leverage: 3 },
])

const companies = ref([
  { id: 1, name: 'АвиаЛогик',     nameShort: 'АЛ', stage: 'Seed',     subFund: 'БАС',  trl: 6, mrl: 4, sov: 7, invested: 180_000_000, valuation: 540_000_000, runway: 14, health: 78, alert: null,
    risks: [{ type: 'reg', label: 'Регуляторный (114-П)', level: 'MED' }, { type: 'mrl', label: 'MRL < 5 — нет серийности', level: 'MED' }, { type: 'cust', label: 'Один ключевой заказчик', level: 'LOW' }] },
  { id: 2, name: 'МикроСхема',    nameShort: 'МС', stage: 'Series A', subFund: 'МЭ',   trl: 5, mrl: 3, sov: 9, invested: 450_000_000, valuation: 1_200_000_000, runway: 9, health: 65, alert: 'Runway < 9 мес!',
    risks: [{ type: 'run', label: 'Runway критический', level: 'HIGH' }, { type: 'trl', label: 'TRL 5 — долгий R&D', level: 'MED' }] },
  { id: 3, name: 'АэроМед',       nameShort: 'АМ', stage: 'Pre-seed', subFund: 'БАС',  trl: 4, mrl: 2, sov: 5, invested: 60_000_000,  valuation: 150_000_000, runway: 18, health: 52, alert: 'Суверенность < 6',
    risks: [{ type: 'sov', label: 'Суверенность 5/9', level: 'MED' }, { type: 'trl', label: 'TRL 4 — ранняя стадия', level: 'HIGH' }, { type: 'team', label: 'Слабая команда', level: 'HIGH' }] },
  { id: 4, name: 'РоботАгро',     nameShort: 'РА', stage: 'Series A', subFund: 'РОБО', trl: 7, mrl: 6, sov: 6, invested: 290_000_000, valuation: 870_000_000, runway: 20, health: 88, alert: null,
    risks: [{ type: 'comp', label: 'Иностранные сенсоры', level: 'LOW' }, { type: 'seas', label: 'Сезонность выручки', level: 'LOW' }] },
  { id: 5, name: 'СканТекс',      nameShort: 'СТ', stage: 'Seed',     subFund: 'БАС',  trl: 5, mrl: 3, sov: 4, invested: 220_000_000, valuation: 550_000_000, runway: 11, health: 60, alert: 'Суверенность < 6',
    risks: [{ type: 'sov', label: 'Низкая суверенность', level: 'HIGH' }, { type: 'comp', label: 'Конкуренция Velodyne', level: 'MED' }] },
  { id: 6, name: 'НейроПилот',    nameShort: 'НП', stage: 'Pre-seed', subFund: 'МЭ',   trl: 4, mrl: 2, sov: 7, invested: 80_000_000,  valuation: 200_000_000, runway: 16, health: 70, alert: null,
    risks: [{ type: 'trl', label: 'Ранняя стадия TRL 4', level: 'MED' }, { type: 'mkt', label: 'Неясный PMF', level: 'MED' }] },
  { id: 7, name: 'ГринДрон',      nameShort: 'ГД', stage: 'Series A', subFund: 'РОБО', trl: 7, mrl: 5, sov: 6, invested: 170_000_000, valuation: 510_000_000, runway: 22, health: 82, alert: null,
    risks: [{ type: 'reg', label: 'Регулирование аграрных БПЛА', level: 'LOW' }] },
])

const selectedCompany = ref(companies.value[0])

// ── Simulation State ──────────────────────────────────────────
const tick = ref(0)
const running = ref(true)
const speed = ref(1)
const speedOpts = [{ l: '1x', v: 1 }, { l: '3x', v: 3 }, { l: '10x', v: 10 }]
const lastUpdate = ref(new Date().toLocaleTimeString('ru-RU'))
const liveColor = ref('#4caf50')
const quarter = ref(1)
const year = ref(2026)
let timer = null

const fundEvents = ref([
  { id: 1, icon: 'pi pi-check-circle', color: '#4caf50', time: '09:00', text: 'Транш-2 АвиаЛогик разблокирован (TRL 7 достигнут)' },
  { id: 2, icon: 'pi pi-exclamation-triangle', color: '#ffa726', time: '09:45', text: 'МикроСхема: runway < 9 мес. — требует внимания ИК' },
  { id: 3, icon: 'pi pi-star', color: '#ffa726', time: '10:30', text: 'РоботАгро: новый контракт с АгроХолдинг-2025 (120 млн)' },
  { id: 4, icon: 'pi pi-shield', color: '#ef5350', time: '11:00', text: 'Росавиация: мониторинг 114-П (затрагивает 3 компании БАС)' },
])

// ── Dynamic Metrics ───────────────────────────────────────────
const nav = ref(2_280_000_000)
const totalInvested = ref(1_450_000_000)
const totalRevenue = ref(380_000_000)
const totalROI = ref(0.08)
const privateCapital = ref(3_640_000_000) // leverage 3:1 * deployed

const fundIndex = computed(() => Math.round(400 + (totalROI.value * 800) + (nav.value / 2_280_000_000 - 1) * 200))
const fundGrade = computed(() => {
  const fi = fundIndex.value
  if (fi >= 750) return 'AAA'
  if (fi >= 650) return 'AA'
  if (fi >= 550) return 'A'
  if (fi >= 450) return 'BBB'
  if (fi >= 350) return 'BB'
  return 'B'
})
const gradeColor = computed(() => {
  const g = fundGrade.value
  if (g.startsWith('A')) return '#4caf50'
  if (g === 'BBB') return '#66bb6a'
  if (g === 'BB') return '#ffa726'
  return '#ef5350'
})
const fundGradeColor = gradeColor

const forecastIRR = computed(() => (18 + totalROI.value * 150).toFixed(1))
const forecastDPI = computed(() => (0.8 + totalROI.value * 5).toFixed(2))
const aiVerdict = computed(() => {
  const fi = fundIndex.value
  if (fi >= 650) return 'Портфель в отличной форме — ускоряем деплой Раунд A'
  if (fi >= 500) return 'Умеренный прогресс — требуется усиление МЭ-субфонда'
  return 'Внимание: МикроСхема и АэроМед требуют экстренных мер'
})

const topKpis = computed(() => [
  { label: 'NAV', value: fmtM(nav.value), color: '#4caf50' },
  { label: 'Инвестировано', value: fmtM(totalInvested.value), color: '#42a5f5' },
  { label: 'Привлечено частных', value: fmtM(privateCapital.value), color: '#7e57c2' },
  { label: 'ROI', value: (totalROI.value * 100).toFixed(1) + '%', color: totalROI.value >= 0.15 ? '#4caf50' : '#ffa726' },
  { label: 'Компаний', value: companies.value.length.toString(), color: '#ffa726' },
  { label: 'Фонд-Индекс', value: fundIndex.value + ' ' + fundGrade.value, color: gradeColor.value },
])

const fundMetrics = computed(() => [
  { label: 'Суверенность портфеля', value: (avgSov.value * 100 / 9).toFixed(0) + '%', color: avgSov.value >= 6 ? '#4caf50' : '#ffa726', pct: avgSov.value / 9 * 100 },
  { label: 'Ср. TRL портфеля', value: avgTRL.value.toFixed(1) + '/9', color: '#42a5f5', pct: avgTRL.value / 9 * 100 },
  { label: 'Выручка грантополучателей', value: fmtM(totalRevenue.value), color: '#66bb6a', pct: Math.min(100, totalRevenue.value / 1e9 * 100) },
  { label: 'Leverage (частный капитал)', value: (privateCapital.value / totalInvested.value).toFixed(1) + ':1', color: '#7e57c2', pct: Math.min(100, privateCapital.value / totalInvested.value / 3 * 100) },
])

const avgSov = computed(() => companies.value.reduce((a, c) => a + c.sov, 0) / companies.value.length)
const avgTRL = computed(() => companies.value.reduce((a, c) => a + c.trl, 0) / companies.value.length)

const companyDetailMetrics = computed(() => {
  const c = selectedCompany.value
  if (!c) return []
  return [
    { l: 'Инвестировано', v: fmtM(c.invested), c: '#42a5f5' },
    { l: 'Оценка', v: fmtM(c.valuation), c: '#7e57c2' },
    { l: 'Multiple', v: (c.valuation / c.invested).toFixed(1) + 'x', c: '#4caf50' },
    { l: 'Runway', v: c.runway + ' мес.', c: c.runway < 9 ? '#ef5350' : c.runway < 12 ? '#ffa726' : '#4caf50' },
    { l: 'TRL / MRL', v: c.trl + ' / ' + c.mrl, c: '#42a5f5' },
    { l: 'Суверен.', v: c.sov + '/9', c: c.sov >= 6 ? '#4caf50' : '#ffa726' },
  ]
})

// ── Chart ─────────────────────────────────────────────────────
const flowChart = ref(null)
let chart = null

function initChart() {
  if (!flowChart.value) return
  chart?.destroy()
  const ctx = flowChart.value.getContext('2d')
  const qs = ['Q1-25', 'Q2-25', 'Q3-25', 'Q4-25', 'Q1-26']
  chart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: qs,
      datasets: [
        { label: 'NAV', data: [1800, 1950, 2100, 2200, nav.value / 1e6], backgroundColor: 'rgba(76,175,80,0.7)', borderRadius: 4 },
        { label: 'Выручка', data: [120, 180, 260, 340, totalRevenue.value / 1e6], backgroundColor: 'rgba(66,165,245,0.6)', borderRadius: 4 },
      ],
    },
    options: {
      plugins: { legend: { labels: { color: '#aaa', font: { size: 10 } } } },
      scales: {
        x: { grid: { color: '#2a2a2a' }, ticks: { color: '#aaa', font: { size: 9 } } },
        y: { grid: { color: '#2a2a2a' }, ticks: { color: '#aaa', font: { size: 9 }, callback: v => v + 'M' } },
      },
      animation: { duration: 300 },
    },
  })
}

// ── Simulation ────────────────────────────────────────────────
let evtId = 10
function addEvent(e) {
  fundEvents.value.unshift({ ...e, id: evtId++, time: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) })
  if (fundEvents.value.length > 10) fundEvents.value.pop()
}

function step() {
  tick.value++
  lastUpdate.value = new Date().toLocaleTimeString('ru-RU')
  liveColor.value = '#4caf50'

  // NAV grows
  nav.value = Math.round(nav.value * (1 + 0.004 * Math.random()))
  totalRevenue.value = Math.round(totalRevenue.value * (1 + 0.025 * Math.random()))
  totalROI.value = Math.min(0.50, totalROI.value + 0.001 * Math.random())

  // Company health drift
  companies.value.forEach(c => {
    c.health = Math.max(10, Math.min(99, c.health + Math.round((Math.random() - 0.4) * 3)))
    if (Math.random() < 0.03) c.trl = Math.min(9, c.trl + 1)
    if (Math.random() < 0.025) c.mrl = Math.min(10, c.mrl + 1)
    c.runway = Math.max(0, c.runway - 0.05)
    c.valuation = Math.round(c.valuation * (1 + 0.005 * Math.random()))
    // Update alert
    c.alert = c.runway < 9 ? 'Runway < 9 мес!' : c.sov < 6 ? 'Суверенность < 6' : null
  })

  // Subfund NAV update
  subfunds.value.forEach(sf => {
    sf.nav = Math.round(sf.nav * (1 + 0.003 * Math.random()))
  })

  // Quarter tick
  if (tick.value % 20 === 0) {
    quarter.value = quarter.value >= 4 ? 1 : quarter.value + 1
    if (quarter.value === 1) year.value++
    if (chart) {
      chart.data.datasets[0].data.push(+(nav.value / 1e6).toFixed(0))
      chart.data.datasets[1].data.push(+(totalRevenue.value / 1e6).toFixed(0))
      chart.data.labels.push(`Q${quarter.value}-${String(year.value).slice(2)}`)
      if (chart.data.labels.length > 8) {
        chart.data.labels.shift()
        chart.data.datasets.forEach(d => d.data.shift())
      }
      chart.update('none')
    }
  }

  // Random fund events
  if (Math.random() < 0.04) {
    const evts = [
      { icon: 'pi pi-star', color: '#ffa726', text: 'АвиаЛогик: новый LOI с ГТЛК (+180 млн ₽)' },
      { icon: 'pi pi-arrow-up', color: '#4caf50', text: 'РоботАгро: TRL 7 → переход Раунд B начат' },
      { icon: 'pi pi-exclamation-triangle', color: '#ef5350', text: 'МикроСхема: runway < 6 мес — экстренный ИК' },
      { icon: 'pi pi-file-check', color: '#7e57c2', text: 'Новый патент: ГринДрон (точное агро)' },
      { icon: 'pi pi-users', color: '#42a5f5', text: 'СканТекс: привлечён COO с опытом Velodyne' },
      { icon: 'pi pi-globe', color: '#66bb6a', text: 'Leverage: ПСБ подтвердил со-инвестирование МЭ-субфонда' },
    ]
    addEvent(evts[Math.floor(Math.random() * evts.length)])
  }

  setTimeout(() => { liveColor.value = '#78909c' }, 300)
}

function toggleRun() {
  running.value = !running.value
  if (running.value) scheduleTimer()
  else clearTimeout(timer)
}

function scheduleTimer() {
  if (!running.value) return
  const ms = Math.round(2500 / speed.value)
  timer = setTimeout(() => { step(); scheduleTimer() }, ms)
}

watch(speed, () => { clearTimeout(timer); if (running.value) scheduleTimer() })

// ── Helpers ───────────────────────────────────────────────────
function healthColor(h) {
  if (h >= 75) return '#2e7d32'
  if (h >= 55) return '#e65100'
  return '#b71c1c'
}
function stageSeverity(s) {
  return s === 'Series A' || s === 'Series B' ? 'info' : s === 'Growth' ? 'success' : 'secondary'
}
function riskColor(l) {
  return l === 'HIGH' ? '#ef5350' : l === 'MED' ? '#ffa726' : '#4caf50'
}
function fmtM(v) {
  if (!v) return '0'
  if (v >= 1e9) return (v / 1e9).toFixed(2) + ' млрд'
  if (v >= 1e6) return (v / 1e6).toFixed(1) + ' млн'
  return (v / 1e3).toFixed(0) + ' тыс'
}

onMounted(() => { nextTick(() => { initChart(); scheduleTimer() }) })
onUnmounted(() => { clearTimeout(timer); chart?.destroy() })
</script>

<style scoped>
.fft-root { min-height: 100vh; background: var(--p-surface-ground); color: var(--p-text-color); font-family: 'Inter', sans-serif; display: flex; flex-direction: column }

.fft-header { display: flex; align-items: center; gap: 16px; padding: 10px 16px; background: var(--p-surface-card); border-bottom: 1px solid var(--p-content-border-color) }
.fft-header-left { min-width: 180px }
.fft-header-center { flex: 1 }
.fft-header-right { display: flex; gap: 6px; align-items: center }
.fft-logo { display: flex; align-items: center; gap: 8px; font-size: 15px; font-weight: 600 }
.fft-updated { font-size: 11px; color: var(--p-text-muted-color); display: flex; align-items: center; gap: 4px; margin-top: 3px }

.fft-kpi-bar { display: flex; gap: 20px; justify-content: center }
.fft-top-kpi { display: flex; flex-direction: column; align-items: center }
.fft-top-kpi-val { font-size: 16px; font-weight: 700 }
.fft-top-kpi-label { font-size: 10px; color: var(--p-text-muted-color); text-transform: uppercase }

.fft-main { display: grid; grid-template-columns: 260px 1fr 280px; flex: 1; overflow: hidden }
.fft-col { padding: 12px; overflow-y: auto; border-right: 1px solid var(--p-content-border-color) }
.fft-col:last-child { border-right: none }
.fft-col-center { background: var(--p-surface-section) }

.fft-panel-title { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: var(--p-text-muted-color); display: flex; align-items: center; gap: 6px; margin-bottom: 8px }

/* Companies list */
.fft-companies { display: flex; flex-direction: column; gap: 6px }
.fft-company-card { background: var(--p-surface-section); border-radius: 8px; padding: 8px 10px; cursor: pointer; transition: all 0.2s; border: 1px solid transparent }
.fft-company-card:hover { border-color: var(--p-primary-color) }
.fft-company-card--selected { border-color: #42a5f5; background: rgba(66,165,245,0.08) }
.fft-cc-header { display: flex; align-items: center; gap: 6px; margin-bottom: 4px }
.fft-cc-name { flex: 1; font-size: 13px; font-weight: 600 }
.fft-cc-health { color: #fff; font-size: 11px; font-weight: 700; padding: 1px 6px; border-radius: 4px }
.fft-cc-meta { display: flex; gap: 10px; font-size: 10px; color: var(--p-text-muted-color); margin-bottom: 4px }
.fft-cc-bars { display: flex; flex-direction: column; gap: 2px }
.fft-cc-bar { height: 4px; background: #333; border-radius: 2px; overflow: hidden }
.fft-cc-bar > div { height: 100%; border-radius: 2px; transition: width 0.5s }
.fft-cc-alert { font-size: 10px; color: #ffa726; display: flex; align-items: center; gap: 4px; margin-top: 3px }

/* Fund index */
.fft-fund-index-row { display: flex; gap: 12px; align-items: flex-start }
.fft-fund-index { display: flex; flex-direction: column; align-items: center; background: var(--p-surface-card); border-radius: 10px; padding: 12px 16px; min-width: 80px }
.fft-fi-grade { font-size: 28px; font-weight: 900 }
.fft-fi-val { font-size: 14px; font-weight: 600 }
.fft-fi-label { font-size: 10px; color: var(--p-text-muted-color); text-transform: uppercase }
.fft-fund-metrics { flex: 1; display: flex; flex-direction: column; gap: 7px }
.fft-fm-row { display: flex; align-items: center; gap: 8px }
.fft-fm-label { font-size: 11px; min-width: 160px }
.fft-fm-val { font-size: 12px; font-weight: 600; min-width: 60px }
.fft-fm-bar-bg { flex: 1; height: 5px; background: #333; border-radius: 3px; overflow: hidden }
.fft-fm-bar-fill { height: 100%; border-radius: 3px; transition: width 0.5s }

/* Subfunds */
.fft-subfunds { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px }
.fft-subfund { background: var(--p-surface-card); border-radius: 8px; padding: 8px; }
.fft-sf-header { display: flex; align-items: center; gap: 6px; font-size: 12px; margin-bottom: 4px }
.fft-sf-budget { font-size: 12px; font-weight: 600 }
.fft-sf-companies { font-size: 10px; color: var(--p-text-muted-color); margin-top: 4px }

/* Health matrix */
.fft-health-matrix { display: flex; flex-wrap: wrap; gap: 4px }
.fft-hm-cell { display: flex; flex-direction: column; align-items: center; padding: 5px 8px; border-radius: 6px; min-width: 48px; cursor: pointer }
.fft-hm-name { font-size: 10px; color: #fff; opacity: 0.8 }
.fft-hm-val { font-size: 14px; font-weight: 700; color: #fff }

/* Company detail */
.fft-company-detail { background: var(--p-surface-section); border-radius: 8px; padding: 10px }
.fft-cd-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-bottom: 10px }
.fft-cd-item { background: var(--p-surface-card); border-radius: 6px; padding: 7px }
.fft-cd-label { font-size: 10px; color: var(--p-text-muted-color) }
.fft-cd-val { font-size: 15px; font-weight: 700 }
.fft-cd-risks { margin-top: 8px }
.fft-cd-risk-row { display: flex; align-items: center; gap: 6px; font-size: 11px; padding: 4px 0; border-bottom: 1px solid var(--p-content-border-color) }
.fft-cd-risk-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0 }
.fft-cd-risk-row > span { flex: 1 }

.fft-select-hint { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 24px; color: var(--p-text-muted-color); font-size: 13px }

/* Events */
.fft-events { display: flex; flex-direction: column; gap: 4px; max-height: 140px; overflow-y: auto }
.fft-evt-row { display: flex; align-items: flex-start; gap: 6px; font-size: 11px; padding: 3px 0; border-bottom: 1px solid var(--p-content-border-color) }
.fft-evt-time { color: var(--p-text-muted-color); min-width: 36px }
.fft-evt-text { flex: 1; line-height: 1.4 }
.fft-evt-enter-active { transition: all 0.3s }
.fft-evt-enter-from { opacity: 0; transform: translateY(-8px) }

/* AI Forecast */
.fft-ai-forecast { background: var(--p-surface-section); border-radius: 8px; padding: 10px }
.fft-af-row { display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 5px }
.fft-af-verdict { font-size: 11px; margin-top: 8px; padding: 6px 8px; border-radius: 6px; background: rgba(66,165,245,0.1); display: flex; align-items: center; gap: 5px; line-height: 1.4 }
</style>
