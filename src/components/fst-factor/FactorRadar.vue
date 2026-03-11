<template>
  <div class="factor-radar">
    <!-- Radar chart -->
    <div class="factor-radar__chart-wrap">
      <canvas ref="canvasEl"></canvas>
    </div>

    <!-- Factor bars -->
    <div class="factor-radar__bars">
      <div
        v-for="(f, key) in factors"
        :key="key"
        class="factor-radar__bar-row"
      >
        <span class="factor-radar__key">{{ key }}</span>
        <div class="factor-radar__bar-track">
          <div
            class="factor-radar__bar-fill"
            :style="{ width: `${(f.score / 10) * 100}%`, background: barColor(f.score) }"
          ></div>
        </div>
        <span class="factor-radar__score">{{ f.score?.toFixed(1) ?? '—' }}</span>
        <span class="factor-radar__label">{{ f.label }}</span>
      </div>
    </div>

    <!-- Composite badge -->
    <div class="factor-radar__composite">
      <span class="factor-radar__grade" :style="{ color: gradeColor(grade) }">{{ grade }}</span>
      <span class="factor-radar__composite-val">{{ composite?.toFixed(2) }}/10</span>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { Chart, RadarController, RadialLinearScale, PointElement, LineElement, Filler, Tooltip } from 'chart.js'

Chart.register(RadarController, RadialLinearScale, PointElement, LineElement, Filler, Tooltip)

const props = defineProps({
  /** { T: { score, label }, S: ..., M: ..., G: ..., E: ... } */
  factors:   { type: Object, required: true },
  composite: { type: Number, default: null },
  grade:     { type: String, default: '' },
})

const canvasEl = ref(null)
let chart = null

// Chart.js не поддерживает CSS vars — нужен hex для цветов
const RADAR_COLOR      = 'rgba(139,92,246,0.35)'  // --fst-purple ~35%
const RADAR_BORDER     = 'rgba(139,92,246,0.9)'
const RADAR_GRID       = 'rgba(255,255,255,0.1)'
const RADAR_TICK_COLOR = 'rgba(255,255,255,0.4)'
const RADAR_LABEL_COLOR = 'rgba(255,255,255,0.8)'

function buildChart() {
  if (!canvasEl.value) return
  const labels = Object.keys(props.factors)
  const data   = labels.map(k => props.factors[k]?.score ?? 0)

  chart = new Chart(canvasEl.value, {
    type: 'radar',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: RADAR_COLOR,
        borderColor:     RADAR_BORDER,
        borderWidth:     2,
        pointBackgroundColor: RADAR_BORDER,
        pointRadius: 3,
        fill: true,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      animation: { duration: 500 },
      scales: {
        r: {
          min: 0,
          max: 10,
          ticks: {
            stepSize: 2,
            color:    RADAR_TICK_COLOR,
            backdropColor: 'transparent',
            font: { size: 9 },
          },
          grid:        { color: RADAR_GRID },
          angleLines:  { color: RADAR_GRID },
          pointLabels: { color: RADAR_LABEL_COLOR, font: { size: 12, weight: '600' } },
        },
      },
      plugins: { legend: { display: false }, tooltip: { enabled: true } },
    },
  })
}

function updateChart() {
  if (!chart) return
  const labels = Object.keys(props.factors)
  chart.data.labels = labels
  chart.data.datasets[0].data = labels.map(k => props.factors[k]?.score ?? 0)
  chart.update('none')
}

onMounted(async () => {
  await nextTick()
  buildChart()
})

onBeforeUnmount(() => {
  chart?.destroy()
  chart = null
})

watch(() => props.factors, () => {
  if (chart) updateChart()
  else buildChart()
}, { deep: true })

// Bar color based on score (hex — Chart.js context; bar can use CSS mix)
function barColor(score) {
  if (score === null || score === undefined) return 'var(--p-content-border-color)'
  if (score >= 7) return 'var(--fst-green)'
  if (score >= 4) return 'var(--fst-brand)'
  return 'var(--fst-red)'
}

const GRADE_COLORS = {
  'A+': 'var(--fst-green)', 'A': 'var(--fst-green)',
  'B+': 'var(--fst-brand)', 'B': 'var(--fst-brand)',
  'C+': 'var(--fst-red)', 'C': 'var(--fst-red)', 'D': 'var(--fst-red)',
}
function gradeColor(grade) {
  return GRADE_COLORS[grade] || 'var(--p-text-muted-color)'
}
</script>

<style scoped>
.factor-radar {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.factor-radar__chart-wrap {
  max-width: 220px;
  margin: 0 auto;
}

.factor-radar__bars {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.factor-radar__bar-row {
  display: grid;
  grid-template-columns: 20px 1fr 32px auto;
  align-items: center;
  gap: 6px;
}

.factor-radar__key {
  font-size: 11px;
  font-weight: 700;
  color: var(--p-text-muted-color);
  text-align: center;
}

.factor-radar__bar-track {
  height: 6px;
  background: var(--p-content-border-color);
  border-radius: 3px;
  overflow: hidden;
}

.factor-radar__bar-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.4s ease;
}

.factor-radar__score {
  font-size: 11px;
  font-weight: 700;
  color: var(--p-text-color);
  text-align: right;
}

.factor-radar__label {
  font-size: 10px;
  color: var(--p-text-muted-color);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 120px;
}

.factor-radar__composite {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 8px;
  background: var(--p-surface-card);
  border: 1px solid var(--p-content-border-color);
  border-radius: 6px;
}

.factor-radar__grade {
  font-size: 20px;
  font-weight: 800;
  line-height: 1;
}

.factor-radar__composite-val {
  font-size: 13px;
  color: var(--p-text-muted-color);
}
</style>
