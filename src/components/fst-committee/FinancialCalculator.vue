<template>
  <div class="fc-root">
    <div class="fc-header">
      <span class="fc-title">Финансовый калькулятор</span>
      <div class="fc-scenario-tabs">
        <button
          v-for="s in scenarios"
          :key="s.id"
          :class="['fc-tab', { active: activeScenario === s.id }]"
          @click="activeScenario = s.id"
        >{{ s.label }}</button>
      </div>
    </div>

    <!-- Входные параметры -->
    <div class="fc-inputs">
      <div class="fc-input-group">
        <label>IC, млн ₽</label>
        <input v-model.number="params.ic" type="number" min="1" step="10" @input="recalc" />
      </div>
      <div class="fc-input-group">
        <label>WACC, %</label>
        <input v-model.number="params.wacc" type="number" min="1" max="60" step="0.5" @input="recalc" />
      </div>
      <div class="fc-input-group">
        <label>Горизонт, лет</label>
        <input v-model.number="params.n" type="number" min="1" max="10" step="1" @input="recalc" />
      </div>
    </div>

    <!-- Прогнозные CF по годам -->
    <div class="fc-cf-row">
      <span class="fc-cf-label">CF (млн ₽/год)</span>
      <input
        v-for="(_, i) in params.cashflows"
        :key="i"
        v-model.number="params.cashflows[i]"
        type="number"
        step="5"
        :placeholder="`Год ${i+1}`"
        @input="recalc"
        class="fc-cf-input"
      />
    </div>

    <!-- Метрики -->
    <div class="fc-metrics">
      <div
        v-for="m in currentMetrics"
        :key="m.key"
        class="fc-metric"
        :class="{ ok: m.ok, warn: m.ok === false }"
      >
        <div class="fc-metric-val">{{ m.value }}</div>
        <div class="fc-metric-key">{{ m.label }}</div>
        <div v-if="m.gate" class="fc-metric-gate" :class="m.ok ? 'gate-ok' : 'gate-fail'">
          {{ m.ok ? '✓' : '✗' }} {{ m.gate }}
        </div>
      </div>
    </div>

    <!-- NPV-профиль -->
    <div class="fc-chart-wrap">
      <canvas ref="chartEl" height="120"></canvas>
    </div>

    <!-- Gate-результат -->
    <div class="fc-gate" :class="gatePass ? 'gate-pass' : 'gate-fail-block'">
      <span class="fc-gate-icon">{{ gatePass ? '✓' : '✗' }}</span>
      <span>Gate-критерий: NPV {{ gatePass ? '> 0 — проходит ИК' : '≤ 0 — не проходит ИК' }} при базовом сценарии</span>
    </div>

    <!-- Венчурные метрики -->
    <div class="fc-venture-section">
      <div class="fc-venture-title">Венчурные метрики</div>
      <div class="fc-venture-grid">
        <div class="fc-vm" :class="ventureMetrics.moic >= 2 ? 'ok' : 'warn'">
          <div class="fc-vm-val">{{ ventureMetrics.moic.toFixed(2) }}x</div>
          <div class="fc-vm-key">MOIC</div>
          <div class="fc-vm-hint">Cash-on-cash</div>
        </div>
        <div class="fc-vm" :class="ventureMetrics.tvpi >= 1.5 ? 'ok' : 'warn'">
          <div class="fc-vm-val">{{ ventureMetrics.tvpi.toFixed(2) }}x</div>
          <div class="fc-vm-key">TVPI</div>
          <div class="fc-vm-hint">Total Value / Paid-In</div>
        </div>
        <div class="fc-vm" :class="ventureMetrics.probNpvPositive >= 0.5 ? 'ok' : 'warn'">
          <div class="fc-vm-val">{{ (ventureMetrics.probNpvPositive * 100).toFixed(0) }}%</div>
          <div class="fc-vm-key">P(NPV&gt;0)</div>
          <div class="fc-vm-hint">Monte Carlo N=500</div>
        </div>
        <div class="fc-vm" :class="ventureMetrics.kellyFraction > 0 ? 'ok' : 'warn'">
          <div class="fc-vm-val">{{ (ventureMetrics.kellyFraction * 100).toFixed(0) }}%</div>
          <div class="fc-vm-key">Kelly</div>
          <div class="fc-vm-hint">Оптим. доля портфеля</div>
        </div>
        <div class="fc-vm" :class="ventureMetrics.emv > 0 ? 'ok' : 'warn'">
          <div class="fc-vm-val">{{ ventureMetrics.emv.toFixed(1) }}</div>
          <div class="fc-vm-key">EMV, млн ₽</div>
          <div class="fc-vm-hint">Ожидаемая денежная ценность</div>
        </div>
        <div class="fc-vm" :class="ventureMetrics.varPct <= 70 ? 'ok' : 'warn'">
          <div class="fc-vm-val">{{ ventureMetrics.varPct.toFixed(0) }}%</div>
          <div class="fc-vm-key">VaR 95%</div>
          <div class="fc-vm-hint">Макс. потеря в 95% сц.</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import { Chart, registerables } from 'chart.js'
Chart.register(...registerables)

const props = defineProps({
  initialIc:   { type: Number, default: 100 },
  initialWacc: { type: Number, default: 18 },
  initialCf:   { type: Array,  default: () => [0, 20, 40, 60, 80] }
})

const emit = defineEmits(['metrics'])

// ── State ───────────────────────────────────────────────────────────────────

const params = ref({
  ic: props.initialIc,
  wacc: props.initialWacc,
  n: props.initialCf.length,
  cashflows: [...props.initialCf]
})

const activeScenario = ref('base')
const scenarios = [
  { id: 'pessimistic', label: 'Пессим. ×0.6', mult: 0.6 },
  { id: 'base',        label: 'Базовый ×1.0', mult: 1.0 },
  { id: 'optimistic',  label: 'Оптим. ×1.4',  mult: 1.4 }
]

const chartEl  = ref(null)
let   chartObj = null

// ── Финансовые функции ───────────────────────────────────────────────────────

function scenarioCf(mult) {
  return params.value.cashflows.slice(0, params.value.n).map(v => v * mult)
}

function calcNpv(cf, ic, r) {
  return cf.reduce((acc, c, t) => acc + c / Math.pow(1 + r, t + 1), -ic)
}

function calcIrr(cf, ic, tol = 1e-6, maxIter = 200) {
  let r = 0.1
  for (let i = 0; i < maxIter; i++) {
    const f  = calcNpv(cf, ic, r)
    const df = cf.reduce((acc, c, t) => acc - (t + 1) * c / Math.pow(1 + r, t + 2), 0)
    if (Math.abs(df) < 1e-12) break
    const rNew = r - f / df
    if (Math.abs(rNew - r) < tol) { r = rNew; break }
    r = rNew
    if (r < -0.99) { r = -0.99; break }
  }
  return r
}

function calcDpp(cf, ic, r) {
  let cumulative = -ic
  for (let t = 0; t < cf.length; t++) {
    cumulative += cf[t] / Math.pow(1 + r, t + 1)
    if (cumulative >= 0) return t + 1
  }
  return null
}

function calcMirr(cf, ic, r, reinvestRate) {
  const n = cf.length
  const fv = cf.reduce((acc, c, t) => acc + c * Math.pow(1 + reinvestRate, n - t - 1), 0)
  if (fv <= 0) return null
  return Math.pow(fv / ic, 1 / n) - 1
}

function calcPi(npv, ic) {
  return (npv + ic) / ic
}

// ── NPV-профиль по годам ─────────────────────────────────────────────────────

function npvProfile(cf, ic, r) {
  const profile = [-ic]
  let cumNpv = -ic
  for (let t = 0; t < cf.length; t++) {
    cumNpv += cf[t] / Math.pow(1 + r, t + 1)
    profile.push(cumNpv)
  }
  return profile
}

// ── Расчёт ──────────────────────────────────────────────────────────────────

const allResults = computed(() => {
  const r = params.value.wacc / 100
  const ic = params.value.ic
  return scenarios.map(s => {
    const cf  = scenarioCf(s.mult)
    const npv = calcNpv(cf, ic, r)
    const irr = calcIrr(cf, ic)
    const dpp = calcDpp(cf, ic, r)
    const mir = calcMirr(cf, ic, r, r)
    const pi  = calcPi(npv, ic)
    return {
      id:      s.id,
      npv,
      irr,
      dpp,
      mirr:    mir,
      pi,
      profile: npvProfile(cf, ic, r)
    }
  })
})

const baseResult = computed(() => allResults.value.find(r => r.id === 'base'))
const gatePass   = computed(() => baseResult.value?.npv > 0)

const currentMetrics = computed(() => {
  const res = allResults.value.find(r => r.id === activeScenario.value)
  if (!res) return []
  const fmt = v => v == null ? '—' : v.toFixed(1)
  return [
    {
      key: 'npv',
      label: 'NPV, млн ₽',
      value: fmt(res.npv),
      gate: 'NPV > 0',
      ok: res.npv > 0
    },
    {
      key: 'irr',
      label: 'IRR, %',
      value: res.irr != null ? (res.irr * 100).toFixed(1) + '%' : '—',
      gate: `IRR > WACC (${params.value.wacc}%)`,
      ok: res.irr != null && res.irr * 100 > params.value.wacc
    },
    {
      key: 'dpp',
      label: 'DPP, лет',
      value: res.dpp ?? '> горизонта',
      ok: res.dpp != null
    },
    {
      key: 'mirr',
      label: 'MIRR, %',
      value: res.mirr != null ? (res.mirr * 100).toFixed(1) + '%' : '—',
      ok: res.mirr != null && res.mirr > 0
    },
    {
      key: 'pi',
      label: 'PI',
      value: fmt(res.pi),
      gate: 'PI > 1',
      ok: res.pi > 1
    }
  ]
})

// ── Венчурные метрики (MOIC, TVPI, Monte Carlo, Kelly) ───────────────────────

const ventureMetrics = computed(() => {
  const { ic, wacc, n, cashflows } = params.value
  const cf = cashflows.slice(0, n)
  const r  = wacc / 100

  // MOIC = gross cash multiple (не дисконтированный)
  const totalCf = cf.reduce((a, b) => a + b, 0)
  const moic    = ic > 0 ? totalCf / ic : 1

  // TVPI = (NPV + IC) / IC = PI из базового результата
  const npv  = baseResult.value?.npv ?? 0
  const tvpi = ic > 0 ? (npv + ic) / ic : 1

  // Monte Carlo: 500 симуляций с σ_CF = 35%
  const N_SIM = 500
  const SIGMA = 0.35
  let positiveCount = 0
  const moicSim = []
  for (let s = 0; s < N_SIM; s++) {
    // Box-Muller нормальное распределение
    const cfSim = cf.map(c => {
      const u1 = Math.random() || 1e-10
      const u2 = Math.random() || 1e-10
      const z  = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
      return c * (1 + SIGMA * z)
    })
    const npvSim = cfSim.reduce((acc, c, t) => acc + c / Math.pow(1 + r, t + 1), -ic)
    if (npvSim > 0) positiveCount++
    const totalSim = cfSim.reduce((a, b) => a + b, 0)
    moicSim.push(ic > 0 ? totalSim / ic : 0)
  }
  moicSim.sort((a, b) => a - b)
  const probNpvPositive = positiveCount / N_SIM
  const varIdx  = Math.floor(N_SIM * 0.05)  // 5-й перцентиль
  const varMoic = moicSim[varIdx] ?? 0
  const varPct  = Math.max(0, (1 - varMoic) * 100)  // потеря в % от IC

  // Kelly Criterion: f* = (p*b - q) / b, b = MOIC
  const p = probNpvPositive
  const q = 1 - p
  const b = Math.max(moic, 1.01)
  const kellyFraction = Math.max(0, Math.min(0.25, (p * b - q) / b))  // cap 25%

  // EMV = p * (totalCf - ic) - q * ic (в млн руб)
  const emv = (p * (totalCf - ic) - q * ic)

  return { moic, tvpi, probNpvPositive, kellyFraction, emv, varPct }
})

// ── Chart ────────────────────────────────────────────────────────────────────

function renderChart() {
  if (!chartEl.value) return
  const labels = Array.from({ length: params.value.n + 1 }, (_, i) => `Год ${i}`)
  const datasets = allResults.value.map((res, idx) => {
    const colors = ['#ef5350', '#42a5f5', '#66bb6a']
    const dashes = [[8, 4], [], [8, 4]]
    return {
      label: scenarios[idx].label,
      data: res.profile,
      borderColor: colors[idx],
      backgroundColor: 'transparent',
      borderWidth: idx === 1 ? 2.5 : 1.5,
      borderDash: dashes[idx],
      pointRadius: 3,
      tension: 0.3
    }
  })

  if (chartObj) {
    chartObj.data.labels   = labels
    chartObj.data.datasets = datasets
    chartObj.update()
    return
  }

  chartObj = new Chart(chartEl.value, {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      plugins: {
        legend: { labels: { color: 'var(--p-text-color)', font: { size: 11 } } },
        annotation: {
          annotations: {
            zero: { type: 'line', yMin: 0, yMax: 0, borderColor: 'var(--p-text-muted-color)', borderWidth: 1, borderDash: [4, 4] }
          }
        }
      },
      scales: {
        x: { ticks: { color: 'var(--p-text-muted-color)', font: { size: 11 } }, grid: { color: 'var(--surface-border)' } },
        y: {
          ticks: { color: 'var(--p-text-muted-color)', font: { size: 11 } },
          grid:  { color: 'var(--surface-border)' },
          title: { display: true, text: 'NPV, млн ₽', color: 'var(--p-text-muted-color)', font: { size: 11 } }
        }
      }
    }
  })
}

function recalc() {
  // Пересинхронизировать n с массивом cashflows
  const n = params.value.n
  while (params.value.cashflows.length < n) params.value.cashflows.push(0)
  params.value.cashflows = params.value.cashflows.slice(0, n)
  nextTick(renderChart)
  emit('metrics', {
    npv:      baseResult.value?.npv,
    irr:      baseResult.value?.irr,
    pi:       baseResult.value?.pi,
    gatePass: gatePass.value
  })
}

watch(() => params.value.n, recalc)

onMounted(() => {
  nextTick(renderChart)
  emit('metrics', {
    npv:      baseResult.value?.npv,
    irr:      baseResult.value?.irr,
    pi:       baseResult.value?.pi,
    gatePass: gatePass.value
  })
})
</script>

<style scoped>
.fc-root {
  background: var(--surface-card);
  border: 1px solid var(--surface-border);
  border-radius: 10px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.fc-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
}
.fc-title {
  font-weight: 700;
  font-size: 0.95rem;
  color: var(--p-text-color);
}
.fc-scenario-tabs {
  display: flex;
  gap: 4px;
}
.fc-tab {
  border: 1px solid var(--surface-border);
  border-radius: 6px;
  padding: 3px 10px;
  font-size: 0.78rem;
  cursor: pointer;
  background: var(--p-surface-card);
  color: var(--p-text-muted-color);
  transition: all 0.15s;
}
.fc-tab.active {
  background: var(--p-primary-color);
  color: #fff;
  border-color: var(--p-primary-color);
}
.fc-inputs {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}
.fc-input-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
  min-width: 80px;
}
.fc-input-group label {
  font-size: 0.75rem;
  color: var(--p-text-muted-color);
}
.fc-input-group input,
.fc-cf-input {
  background: var(--p-surface-card);
  border: 1px solid var(--surface-border);
  border-radius: 6px;
  padding: 5px 8px;
  color: var(--p-text-color);
  font-size: 0.82rem;
  width: 100%;
  outline: none;
}
.fc-input-group input:focus,
.fc-cf-input:focus {
  border-color: var(--p-primary-color);
}
.fc-cf-row {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.fc-cf-label {
  font-size: 0.75rem;
  color: var(--p-text-muted-color);
  white-space: nowrap;
  min-width: 90px;
}
.fc-cf-input {
  width: 70px;
  flex: 0 0 70px;
}
.fc-metrics {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.fc-metric {
  flex: 1;
  min-width: 80px;
  background: var(--p-surface-card);
  border: 1px solid var(--surface-border);
  border-radius: 8px;
  padding: 8px 10px;
  text-align: center;
}
.fc-metric.ok  { border-color: #66bb6a44; }
.fc-metric.warn{ border-color: #ef535044; }
.fc-metric-val {
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--p-text-color);
}
.fc-metric-key {
  font-size: 0.72rem;
  color: var(--p-text-muted-color);
  margin-top: 2px;
}
.fc-metric-gate {
  font-size: 0.68rem;
  margin-top: 4px;
  border-radius: 4px;
  padding: 1px 6px;
}
.gate-ok   { background: #66bb6a22; color: #66bb6a; }
.gate-fail { background: #ef535022; color: #ef5350; }
.fc-chart-wrap {
  position: relative;
  max-height: 150px;
}
.fc-gate {
  display: flex;
  align-items: center;
  gap: 8px;
  border-radius: 8px;
  padding: 8px 12px;
  font-size: 0.82rem;
}
.fc-gate-icon { font-size: 1rem; font-weight: 700; }
.gate-pass       { background: #66bb6a18; color: #66bb6a; border: 1px solid #66bb6a44; }
.gate-fail-block { background: #ef535018; color: #ef5350; border: 1px solid #ef535044; }

/* Венчурные метрики */
.fc-venture-section {
  border-top: 1px solid var(--surface-border);
  padding-top: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.fc-venture-title {
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--p-text-muted-color);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.fc-venture-grid {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.fc-vm {
  flex: 1;
  min-width: 72px;
  background: var(--p-surface-card);
  border: 1px solid var(--surface-border);
  border-radius: 7px;
  padding: 7px 8px;
  text-align: center;
}
.fc-vm.ok   { border-color: #66bb6a44; }
.fc-vm.warn { border-color: #ffa72644; }
.fc-vm-val  { font-size: 1rem; font-weight: 700; color: var(--p-text-color); }
.fc-vm-key  { font-size: 0.68rem; color: var(--p-text-muted-color); margin-top: 1px; font-weight: 600; }
.fc-vm-hint { font-size: 0.6rem; color: var(--p-text-muted-color); margin-top: 2px; }
</style>
