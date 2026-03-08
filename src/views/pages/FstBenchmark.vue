<template>
  <FstPageLayout title="Бенчмаркинг портфеля" subtitle="Сравнение с отраслевыми мультипликаторами и пирами">
    <template #actions>
      <select v-model="sector" class="bm-select">
          <option value="bas">БАС / БПЛА</option>
          <option value="robo">Робототехника</option>
          <option value="medtech">MedTech</option>
          <option value="agritech">AgriTech</option>
        </select>
        <button class="bm-btn secondary" @click="exportBenchmark">Экспорт</button>
    </template>

    <!-- Мультипликаторы рынка -->
    <div class="bm-section">
      <h2>Отраслевые мультипликаторы — {{ sectorLabel }}</h2>
      <div class="mult-grid">
        <div v-for="m in marketMultiples" :key="m.label" class="mult-card">
          <div class="mult-name">{{ m.label }}</div>
          <div class="mult-median">
            <span class="mult-val">{{ m.median }}</span>
            <span class="mult-lbl">Медиана</span>
          </div>
          <div class="mult-range">
            <span class="range-low">{{ m.p25 }}</span>
            <div class="range-bar">
              <div class="range-fill" :style="{ left: '25%', width: '50%' }"></div>
              <div class="range-dot" :style="{ left: portfolioPosition(m) + '%' }"></div>
            </div>
            <span class="range-high">{{ m.p75 }}</span>
          </div>
          <div class="mult-portfolio" :class="portfolioVsMedian(m)">
            Портфель: {{ m.portfolio }}
          </div>
        </div>
      </div>
    </div>

    <!-- Сравнение с пирами -->
    <div class="bm-section">
      <h2>Портфель vs Публичные аналоги</h2>
      <table class="bm-table">
        <thead>
          <tr>
            <th>Компания</th>
            <th>Тип</th>
            <th>EV/Revenue</th>
            <th>EV/EBITDA</th>
            <th>P/E</th>
            <th>ARR Growth %</th>
            <th>Gross Margin %</th>
            <th>Rule of 40</th>
          </tr>
        </thead>
        <tbody>
          <tr class="peer-header"><td colspan="8">— Публичные аналоги —</td></tr>
          <tr v-for="p in publicPeers" :key="p.name">
            <td class="peer-name">{{ p.name }}</td>
            <td class="peer-type">{{ p.type }}</td>
            <td class="num">{{ p.evRev }}x</td>
            <td class="num">{{ p.evEbitda }}x</td>
            <td class="num">{{ p.pe }}x</td>
            <td class="num" :class="p.growth > 50 ? 'green' : ''">{{ p.growth }}%</td>
            <td class="num">{{ p.gm }}%</td>
            <td class="num" :class="p.r40 >= 40 ? 'green' : p.r40 >= 20 ? 'orange' : 'red'">{{ p.r40 }}</td>
          </tr>
          <tr class="peer-median">
            <td><strong>Медиана пиров</strong></td>
            <td></td>
            <td class="num bold">{{ peerMedian('evRev') }}x</td>
            <td class="num bold">{{ peerMedian('evEbitda') }}x</td>
            <td class="num bold">{{ peerMedian('pe') }}x</td>
            <td class="num bold">{{ peerMedian('growth') }}%</td>
            <td class="num bold">{{ peerMedian('gm') }}%</td>
            <td class="num bold">{{ peerMedian('r40') }}</td>
          </tr>
          <tr class="peer-header"><td colspan="8">— Портфельные компании ФСТ —</td></tr>
          <tr v-for="p in portfolioCompanies" :key="p.name" class="portfolio-row">
            <td class="peer-name fst">{{ p.name }}</td>
            <td class="peer-type">{{ p.stage }}</td>
            <td class="num" :class="compareToMedian(p.evRev, 'evRev')">{{ p.evRev }}x</td>
            <td class="num" :class="compareToMedian(p.evEbitda, 'evEbitda')">{{ p.evEbitda !== '—' ? p.evEbitda + 'x' : '—' }}</td>
            <td class="num gray">{{ p.pe }}</td>
            <td class="num" :class="p.growth > 50 ? 'green' : ''">{{ p.growth }}%</td>
            <td class="num">{{ p.gm }}%</td>
            <td class="num" :class="p.r40 >= 40 ? 'green' : p.r40 >= 20 ? 'orange' : 'red'">{{ p.r40 }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Фондовый бенчмарк -->
    <div class="bm-section">
      <h2>Фонд vs Венчурные бенчмарки</h2>
      <div class="fund-bench-grid">
        <div v-for="b in fundBenchmarks" :key="b.name" class="fund-bench-card">
          <div class="fb-name">{{ b.name }}</div>
          <div class="fb-metrics">
            <div class="fb-m" v-for="m in b.metrics" :key="m.label">
              <span class="fb-lbl">{{ m.label }}</span>
              <div class="fb-bars">
                <div class="fb-bar-wrap">
                  <span class="fb-bar-label">Наш фонд</span>
                  <div class="fb-bar-track">
                    <div class="fb-bar fst" :style="{ width: barWidth(m.fst, m.max) + '%' }"></div>
                  </div>
                  <span class="fb-bar-val fst">{{ m.fst }}{{ m.unit }}</span>
                </div>
                <div class="fb-bar-wrap">
                  <span class="fb-bar-label">{{ b.name }}</span>
                  <div class="fb-bar-track">
                    <div class="fb-bar bench" :style="{ width: barWidth(m.bench, m.max) + '%' }"></div>
                  </div>
                  <span class="fb-bar-val bench">{{ m.bench }}{{ m.unit }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Radar chart: компания vs сектор -->
    <div class="bm-section">
      <h2>Radar Chart: Портфель vs Медиана vs Топ-квартиль</h2>
      <div class="radar-wrap">
        <canvas ref="radarCanvas" width="600" height="400"></canvas>
      </div>
      <div class="radar-legend">
        <div class="legend-item"><span class="legend-dot portfolio"></span>Портфель ФСТ</div>
        <div class="legend-item"><span class="legend-dot median"></span>Медиана сектора</div>
        <div class="legend-item"><span class="legend-dot top-quartile"></span>Топ-квартиль (P75)</div>
      </div>
    </div>

    <!-- Исторический тренд мультипликаторов -->
    <div class="bm-section">
      <h2>Исторический тренд мультипликаторов (2020-2026)</h2>
      <div class="chart-wrap">
        <canvas ref="trendCanvas" width="800" height="300"></canvas>
      </div>
    </div>

    <!-- Справедливая оценка диапазон -->
    <div class="bm-section">
      <h2>Справедливая оценка диапазон</h2>
      <div class="valuation-grid">
        <div v-for="comp in portfolioCompanies" :key="comp.name" class="valuation-card">
          <div class="val-company">{{ comp.name }}</div>
          <div class="val-stage">{{ comp.stage }}</div>
          <div class="val-metrics">
            <div class="val-metric">
              <span class="val-label">Текущая оценка:</span>
              <span class="val-current">{{ comp.currentValuation }}M</span>
            </div>
            <div class="val-metric">
              <span class="val-label">Справедливый диапазон:</span>
              <span class="val-range">{{ comp.fairMin }}M - {{ comp.fairMax }}M</span>
            </div>
            <div class="val-bar-wrap">
              <div class="val-bar-track">
                <div class="val-bar-range" :style="{ left: rangeLeft(comp) + '%', width: rangeWidth(comp) + '%' }"></div>
                <div class="val-bar-current" :style="{ left: currentPosition(comp) + '%' }"></div>
              </div>
              <div class="val-bar-labels">
                <span>{{ comp.fairMin }}M</span>
                <span>{{ comp.fairMax }}M</span>
              </div>
            </div>
            <div class="val-status" :class="valuationStatus(comp)">
              {{ valuationStatusLabel(comp) }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Позиционирование на карте -->
    <div class="bm-section">
      <h2>Позиционирование по Risk/Return</h2>
      <div class="scatter-wrap">
        <div class="scatter-area">
          <div class="scatter-axis-y">IRR, %</div>
          <div class="scatter-axis-x">Риск (std dev)</div>
          <div
            v-for="pt in scatterPoints"
            :key="pt.name"
            class="scatter-dot"
            :class="pt.type"
            :style="{ left: pt.x + '%', bottom: pt.y + '%' }"
            :title="pt.name + ': IRR ' + pt.irr + '%, риск ' + pt.risk"
          >
            <div class="scatter-label">{{ pt.name }}</div>
          </div>
          <!-- квадранты -->
          <div class="quad q1">Лидеры</div>
          <div class="quad q2">Защитные</div>
          <div class="quad q3">Высокий риск</div>
          <div class="quad q4">Аутсайдеры</div>
        </div>
      </div>
    </div>

    <!-- Источники данных -->
    <div class="bm-section">
      <h2>Источники данных</h2>
      <div class="sources-grid">
        <div v-for="src in dataSources" :key="src.name" class="source-card">
          <div class="src-icon"><i :class="src.icon"></i></div>
          <div class="src-name">{{ src.name }}</div>
          <div class="src-desc">{{ src.desc }}</div>
          <div class="src-coverage">{{ src.coverage }}</div>
        </div>
      </div>
    </div>

    <!-- Нормативная база -->
    <div class="bm-section">
      <h2>Нормативная база</h2>
      <div class="norms-list">
        <div v-for="norm in normativeBase" :key="norm.code" class="norm-card">
          <div class="norm-header">
            <div class="norm-code">{{ norm.code }}</div>
            <div class="norm-type">{{ norm.type }}</div>
          </div>
          <div class="norm-title">{{ norm.title }}</div>
          <div class="norm-purpose">{{ norm.purpose }}</div>
          <a v-if="norm.link" :href="norm.link" target="_blank" class="norm-link">
            <i class="pi pi-external-link"></i> Читать документ
          </a>
        </div>
      </div>
    </div>
  </FstPageLayout>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import FstPageLayout from '@/components/fst-shared/FstPageLayout.vue'

const sector = ref('bas')
const sectorLabel = computed(() => ({ bas: 'БАС / БПЛА', robo: 'Робототехника', medtech: 'MedTech', agritech: 'AgriTech' })[sector.value])

const radarCanvas = ref(null)
const trendCanvas = ref(null)

const marketMultiples = computed(() => [
  { label: 'EV/Revenue', median: '8.2x', p25: '4.1x', p75: '14.5x', portfolio: '7.4x', medianNum: 8.2, portNum: 7.4, maxNum: 20 },
  { label: 'EV/EBITDA',  median: '18.4x', p25: '12.0x', p75: '28.0x', portfolio: '21.1x', medianNum: 18.4, portNum: 21.1, maxNum: 35 },
  { label: 'ARR Growth', median: '65%', p25: '35%', p75: '120%', portfolio: '78%', medianNum: 65, portNum: 78, maxNum: 150 },
  { label: 'Gross Margin', median: '62%', p25: '48%', p75: '76%', portfolio: '58%', medianNum: 62, portNum: 58, maxNum: 90 },
  { label: 'Rule of 40', median: '38', p25: '22', p75: '54', portfolio: '42', medianNum: 38, portNum: 42, maxNum: 70 }
])

function portfolioPosition(m) {
  return Math.min(95, Math.max(5, (m.portNum / m.maxNum) * 100))
}

function portfolioVsMedian(m) {
  const diff = (m.portNum / m.medianNum - 1) * 100
  return diff >= 0 ? 'pm-above' : 'pm-below'
}

const publicPeers = ref([
  { name: 'AgEagle (UAVS)',   type: 'Публичная', evRev: 4.2,  evEbitda: '—',  pe: '—',  growth: 28,  gm: 52, r40: 12 },
  { name: 'Joby Aviation',    type: 'Публичная', evRev: 18.4, evEbitda: '—',  pe: '—',  growth: 142, gm: -40, r40: 45 },
  { name: 'EHang Holdings',   type: 'Публичная', evRev: 12.6, evEbitda: '—',  pe: '—',  growth: 87,  gm: 48, r40: 38 },
  { name: 'Matternet (priv)', type: 'Частная',   evRev: 9.8,  evEbitda: 22.4, pe: '—',  growth: 65,  gm: 61, r40: 42 },
  { name: 'Percepto',         type: 'Частная',   evRev: 11.2, evEbitda: 19.8, pe: '—',  growth: 78,  gm: 67, r40: 51 }
])

function peerMedian(field) {
  const vals = publicPeers.value.map(p => parseFloat(p[field])).filter(v => !isNaN(v)).sort((a, b) => a - b)
  const mid = Math.floor(vals.length / 2)
  return vals.length % 2 !== 0 ? vals[mid] : ((vals[mid - 1] + vals[mid]) / 2).toFixed(1)
}

function compareToMedian(val, field) {
  const med = parseFloat(peerMedian(field))
  const v = parseFloat(val)
  if (isNaN(v) || isNaN(med)) return ''
  return v >= med * 0.9 ? 'green' : 'red'
}

const portfolioCompanies = ref([
  { name: 'АгроДрон',       stage: 'Серия A', evRev: 6.8, evEbitda: '—', pe: '—', growth: 112, gm: 58, r40: 67, currentValuation: 48, fairMin: 42, fairMax: 68 },
  { name: 'DroneLogistics', stage: 'Серия B', evRev: 8.4, evEbitda: 18.2, pe: '—', growth: 64, gm: 54, r40: 38, currentValuation: 95, fairMin: 78, fairMax: 112 },
  { name: 'CyberPilot',     stage: 'Серия B', evRev: 9.1, evEbitda: 21.3, pe: '—', growth: 89, gm: 63, r40: 55, currentValuation: 120, fairMin: 98, fairMax: 145 }
])

function rangeLeft(comp) { return 0 }
function rangeWidth(comp) { return 100 }
function currentPosition(comp) {
  const range = comp.fairMax - comp.fairMin
  return ((comp.currentValuation - comp.fairMin) / range) * 100
}
function valuationStatus(comp) {
  if (comp.currentValuation < comp.fairMin) return 'undervalued'
  if (comp.currentValuation > comp.fairMax) return 'overvalued'
  return 'fair'
}
function valuationStatusLabel(comp) {
  const status = valuationStatus(comp)
  return { undervalued: 'Недооценена', fair: 'В диапазоне', overvalued: 'Переоценена' }[status]
}

const fundBenchmarks = ref([
  {
    name: 'Cambridge Assoc. VC Median',
    metrics: [
      { label: 'Net IRR',  fst: 22.7, bench: 18.2, unit: '%', max: 35 },
      { label: 'TVPI',     fst: 1.34, bench: 1.28, unit: 'x', max: 2.5 },
      { label: 'DPI',      fst: 0.18, bench: 0.22, unit: 'x', max: 1.0 }
    ]
  },
  {
    name: 'Российские ВФ (РАВИ медиана)',
    metrics: [
      { label: 'Net IRR',  fst: 22.7, bench: 14.5, unit: '%', max: 35 },
      { label: 'TVPI',     fst: 1.34, bench: 1.18, unit: 'x', max: 2.5 },
      { label: 'Портфель', fst: 8, bench: 5, unit: ' ко.', max: 15 }
    ]
  }
])

function barWidth(val, max) { return Math.min(100, val / max * 100) }

const scatterPoints = ref([
  { name: 'ФСТ НТИ',        type: 'fst',    x: 42, y: 68, irr: 22.7, risk: 14.2 },
  { name: 'Camb.Assoc.',     type: 'bench',  x: 38, y: 55, irr: 18.2, risk: 12.8 },
  { name: 'РАВИ медиана',    type: 'bench',  x: 35, y: 42, irr: 14.5, risk: 11.5 },
  { name: 'S&P500',          type: 'market', x: 22, y: 34, irr: 10.8, risk:  7.2 },
  { name: 'ОФЗ',             type: 'market', x: 10, y: 26, irr:  8.5, risk:  3.1 }
])

const dataSources = ref([
  { name: 'Crunchbase', icon: 'pi pi-database', desc: 'Глобальные венчурные сделки', coverage: '~3.5M компаний, 120K+ инвесторов' },
  { name: 'PitchBook', icon: 'pi pi-chart-line', desc: 'Private equity и венчурные данные', coverage: 'Детальные мультипликаторы по раундам' },
  { name: 'РФПИ', icon: 'pi pi-flag', desc: 'Российский фонд прямых инвестиций', coverage: 'Бенчмарки российских сделок' },
  { name: 'РВК', icon: 'pi pi-building', desc: 'Российская венчурная компания', coverage: 'Данные по портфельным оценкам РФ' },
  { name: 'Публичные аналоги', icon: 'pi pi-chart-bar', desc: 'Торгуемые drone/robotics компании', coverage: 'AgEagle, Joby Aviation, EHang и др.' }
])

const normativeBase = ref([
  {
    code: 'МСФО 13',
    type: 'Международный стандарт',
    title: 'Оценка справедливой стоимости',
    purpose: 'Определение справедливой стоимости для LP-отчётности и IFRS консолидации',
    link: 'https://www.ifrs.org/issued-standards/list-of-standards/ifrs-13-fair-value-measurement/'
  },
  {
    code: 'ФСО 8',
    type: 'Федеральный стандарт оценки РФ',
    title: 'Оценка бизнеса',
    purpose: 'Российский стандарт оценки стоимости бизнеса и долей в уставном капитале',
    link: 'https://base.garant.ru/12181997/'
  }
])

// Historical trend data (2020-2026)
const historicalData = {
  years: ['2020', '2021', '2022', '2023', '2024', '2025', '2026'],
  evRevenue: [5.2, 7.8, 12.4, 9.2, 7.8, 8.2, 8.8],
  evEbitda: [14.2, 18.6, 24.8, 21.3, 18.9, 18.4, 19.2],
  growth: [45, 58, 78, 68, 62, 65, 70]
}

// Radar chart data
const radarData = {
  labels: ['EV/Revenue', 'Growth %', 'Gross Margin', 'Rule of 40', 'Market Share'],
  portfolio: [7.4, 78, 58, 42, 35],
  median: [8.2, 65, 62, 38, 40],
  topQuartile: [14.5, 120, 76, 54, 65]
}

function exportBenchmark() {
  alert('Экспорт бенчмаркинг-отчёта')
}

// Initialize charts after mount
onMounted(() => {
  initRadarChart()
  initTrendChart()
})

function initRadarChart() {
  if (!radarCanvas.value) return
  const ctx = radarCanvas.value.getContext('2d')
  const centerX = 300, centerY = 200, maxRadius = 150

  // Clear canvas
  ctx.clearRect(0, 0, 600, 400)

  // Draw background circles
  ctx.strokeStyle = 'rgba(148,163,184,0.1)'
  ctx.lineWidth = 1
  for (let i = 1; i <= 5; i++) {
    ctx.beginPath()
    ctx.arc(centerX, centerY, (maxRadius / 5) * i, 0, Math.PI * 2)
    ctx.stroke()
  }

  // Draw axes
  const angles = radarData.labels.map((_, i) => (Math.PI * 2 * i) / radarData.labels.length - Math.PI / 2)
  ctx.strokeStyle = 'rgba(148,163,184,0.2)'
  angles.forEach(angle => {
    ctx.beginPath()
    ctx.moveTo(centerX, centerY)
    ctx.lineTo(centerX + Math.cos(angle) * maxRadius, centerY + Math.sin(angle) * maxRadius)
    ctx.stroke()
  })

  // Draw labels
  ctx.fillStyle = 'rgba(226,232,240,0.9)'
  ctx.font = '11px Inter, sans-serif'
  ctx.textAlign = 'center'
  radarData.labels.forEach((label, i) => {
    const angle = angles[i]
    const x = centerX + Math.cos(angle) * (maxRadius + 25)
    const y = centerY + Math.sin(angle) * (maxRadius + 25)
    ctx.fillText(label, x, y)
  })

  // Helper to draw polygon
  const drawPolygon = (data, color, lineWidth) => {
    const maxVal = 150
    ctx.strokeStyle = color
    ctx.fillStyle = color.replace('1)', '0.1)')
    ctx.lineWidth = lineWidth
    ctx.beginPath()
    data.forEach((val, i) => {
      const angle = angles[i]
      const r = (val / maxVal) * maxRadius
      const x = centerX + Math.cos(angle) * r
      const y = centerY + Math.sin(angle) * r
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    })
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
  }

  // Draw data polygons
  drawPolygon(radarData.topQuartile, 'rgba(251,146,60,0.6)', 1.5)
  drawPolygon(radarData.median, 'rgba(66,165,245,0.8)', 2)
  drawPolygon(radarData.portfolio, 'rgba(99,102,241,1)', 2.5)
}

function initTrendChart() {
  if (!trendCanvas.value) return
  const ctx = trendCanvas.value.getContext('2d')
  const width = 800, height = 300
  const padding = { top: 20, right: 100, bottom: 40, left: 60 }
  const chartWidth = width - padding.left - padding.right
  const chartHeight = height - padding.top - padding.bottom

  // Clear canvas
  ctx.clearRect(0, 0, width, height)

  // Background
  ctx.fillStyle = 'rgba(15,23,42,0.3)'
  ctx.fillRect(0, 0, width, height)

  // Axes
  ctx.strokeStyle = 'rgba(148,163,184,0.3)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(padding.left, padding.top)
  ctx.lineTo(padding.left, height - padding.bottom)
  ctx.lineTo(width - padding.right, height - padding.bottom)
  ctx.stroke()

  // Draw grid lines
  ctx.strokeStyle = 'rgba(148,163,184,0.1)'
  for (let i = 0; i <= 5; i++) {
    const y = padding.top + (chartHeight / 5) * i
    ctx.beginPath()
    ctx.moveTo(padding.left, y)
    ctx.lineTo(width - padding.right, y)
    ctx.stroke()
  }

  // Helper to draw line
  const drawLine = (data, color, label, maxVal) => {
    const xStep = chartWidth / (historicalData.years.length - 1)
    ctx.strokeStyle = color
    ctx.lineWidth = 2.5
    ctx.beginPath()
    data.forEach((val, i) => {
      const x = padding.left + i * xStep
      const y = height - padding.bottom - (val / maxVal) * chartHeight
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    })
    ctx.stroke()

    // Draw points
    ctx.fillStyle = color
    data.forEach((val, i) => {
      const x = padding.left + i * xStep
      const y = height - padding.bottom - (val / maxVal) * chartHeight
      ctx.beginPath()
      ctx.arc(x, y, 4, 0, Math.PI * 2)
      ctx.fill()
    })
  }

  // Draw lines
  drawLine(historicalData.evRevenue, 'rgba(99,102,241,1)', 'EV/Revenue', 30)
  drawLine(historicalData.evEbitda, 'rgba(66,165,245,1)', 'EV/EBITDA', 30)

  // X-axis labels
  ctx.fillStyle = 'rgba(226,232,240,0.8)'
  ctx.font = '11px Inter, sans-serif'
  ctx.textAlign = 'center'
  historicalData.years.forEach((year, i) => {
    const x = padding.left + i * (chartWidth / (historicalData.years.length - 1))
    ctx.fillText(year, x, height - padding.bottom + 20)
  })

  // Legend
  ctx.font = '12px Inter, sans-serif'
  ctx.textAlign = 'left'
  ctx.fillStyle = 'rgba(99,102,241,1)'
  ctx.fillRect(width - padding.right + 10, 40, 12, 12)
  ctx.fillStyle = 'rgba(226,232,240,0.9)'
  ctx.fillText('EV/Revenue', width - padding.right + 26, 50)

  ctx.fillStyle = 'rgba(66,165,245,1)'
  ctx.fillRect(width - padding.right + 10, 60, 12, 12)
  ctx.fillStyle = 'rgba(226,232,240,0.9)'
  ctx.fillText('EV/EBITDA', width - padding.right + 26, 70)
}
</script>

<style scoped>
.bm-root { padding: 24px; display: flex; flex-direction: column; gap: 20px; min-height: 100vh; background: var(--surface-ground); }
.bm-header { display: flex; align-items: flex-start; justify-content: space-between; flex-wrap: wrap; gap: 12px; }
.bm-header h1 { margin: 0; font-size: 1rem; font-weight: 600; color: var(--p-text-color); }
.bm-sub { font-size: 0.8rem; color: var(--p-text-muted-color); }
.bm-actions { display: flex; gap: 8px; align-items: center; }
.bm-btn { padding: 8px 14px; border-radius: 8px; border: none; cursor: pointer; font-size: 0.83rem; font-weight: 600; }
.bm-btn.secondary { background: var(--surface-card); color: var(--p-text-color); border: 1px solid var(--surface-border); }
.bm-select { padding: 7px 10px; border-radius: 7px; border: 1px solid var(--surface-border); background: var(--surface-card); color: var(--p-text-color); font-size: 0.83rem; }

.bm-section { background: var(--surface-card); border: 1px solid var(--surface-border); border-radius: 10px; padding: 20px; }
.bm-section h2 { margin: 0 0 16px; font-size: 1.05rem; color: var(--p-text-color); }

.mult-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; }
.mult-card { background: var(--surface-ground); border: 1px solid var(--surface-border); border-radius: 8px; padding: 12px; }
.mult-name { font-weight: 700; font-size: 0.82rem; color: var(--p-text-color); margin-bottom: 8px; }
.mult-median { display: flex; align-items: baseline; gap: 4px; margin-bottom: 8px; }
.mult-val { font-size: 1.4rem; font-weight: 700; color: var(--p-primary-color); }
.mult-lbl { font-size: 0.68rem; color: var(--p-text-muted-color); }
.mult-range { display: flex; align-items: center; gap: 6px; margin-bottom: 6px; }
.range-bar { flex: 1; height: 6px; background: var(--surface-border); border-radius: 3px; position: relative; }
.range-fill { position: absolute; height: 100%; background: var(--p-primary-100, #c7d2fe); border-radius: 3px; }
.range-dot { position: absolute; width: 10px; height: 10px; border-radius: 50%; background: var(--p-primary-color); top: -2px; transform: translateX(-50%); }
.range-low, .range-high { font-size: 0.68rem; color: var(--p-text-muted-color); white-space: nowrap; }
.mult-portfolio { font-size: 0.78rem; font-weight: 600; padding: 2px 6px; border-radius: 4px; text-align: center; }
.pm-above { background: #66bb6a22; color: #66bb6a; }
.pm-below { background: #ef535022; color: #ef5350; }

.bm-table { width: 100%; border-collapse: collapse; font-size: 0.82rem; }
.bm-table th { padding: 7px 10px; text-align: left; color: var(--p-text-muted-color); border-bottom: 1px solid var(--surface-border); font-size: 0.72rem; font-weight: 600; }
.bm-table td { padding: 8px 10px; border-bottom: 1px solid var(--surface-border); color: var(--p-text-color); }
.peer-header td { background: var(--surface-ground); color: var(--p-text-muted-color); font-size: 0.72rem; font-style: italic; padding: 6px 10px; }
.peer-median { background: var(--surface-ground); }
.portfolio-row { background: rgba(99, 102, 241, 0.03); }
.peer-name { font-weight: 600; }
.peer-name.fst { color: var(--p-primary-color); }
.peer-type { font-size: 0.72rem; color: var(--p-text-muted-color); }
.num { text-align: right; font-variant-numeric: tabular-nums; }
.bold { font-weight: 700; }
.green { color: #66bb6a; } .red { color: #ef5350; } .orange { color: #ff9800; } .gray { color: var(--p-text-muted-color); }

.fund-bench-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
@media (max-width: 700px) { .fund-bench-grid { grid-template-columns: 1fr; } }
.fund-bench-card { background: var(--surface-ground); border: 1px solid var(--surface-border); border-radius: 8px; padding: 14px; }
.fb-name { font-weight: 700; font-size: 0.85rem; color: var(--p-text-color); margin-bottom: 12px; }
.fb-metrics { display: flex; flex-direction: column; gap: 10px; }
.fb-m { display: flex; flex-direction: column; gap: 4px; }
.fb-lbl { font-size: 0.72rem; color: var(--p-text-muted-color); }
.fb-bars { display: flex; flex-direction: column; gap: 4px; }
.fb-bar-wrap { display: flex; align-items: center; gap: 8px; }
.fb-bar-label { font-size: 0.65rem; color: var(--p-text-muted-color); width: 60px; flex-shrink: 0; }
.fb-bar-track { flex: 1; height: 8px; background: var(--surface-border); border-radius: 4px; overflow: hidden; }
.fb-bar { height: 100%; border-radius: 4px; transition: width 0.4s; }
.fb-bar.fst   { background: var(--p-primary-color); }
.fb-bar.bench { background: #42a5f5; }
.fb-bar-val { font-size: 0.72rem; font-weight: 700; width: 40px; text-align: right; }
.fb-bar-val.fst   { color: var(--p-primary-color); }
.fb-bar-val.bench { color: #42a5f5; }

.scatter-wrap { position: relative; height: 280px; border: 1px solid var(--surface-border); border-radius: 8px; background: var(--surface-ground); overflow: hidden; }
.scatter-area { position: relative; width: 100%; height: 100%; }
.scatter-axis-y { position: absolute; left: 8px; top: 50%; transform: translateY(-50%) rotate(-90deg); font-size: 0.7rem; color: var(--p-text-muted-color); }
.scatter-axis-x { position: absolute; bottom: 8px; left: 50%; transform: translateX(-50%); font-size: 0.7rem; color: var(--p-text-muted-color); }
.scatter-dot { position: absolute; width: 12px; height: 12px; border-radius: 50%; transform: translate(-50%, 50%); cursor: pointer; }
.scatter-dot.fst    { background: var(--p-primary-color); width: 16px; height: 16px; }
.scatter-dot.bench  { background: #42a5f5; }
.scatter-dot.market { background: #ff9800; }
.scatter-label { position: absolute; left: 14px; top: -4px; font-size: 0.65rem; white-space: nowrap; color: var(--p-text-color); background: var(--surface-card); padding: 1px 4px; border-radius: 3px; }
.quad { position: absolute; font-size: 0.65rem; color: var(--p-text-muted-color); opacity: 0.6; }
.q1 { right: 8px; top: 8px; }
.q2 { left: 8px; top: 8px; }
.q3 { right: 8px; bottom: 20px; }
.q4 { left: 8px; bottom: 20px; }

.radar-wrap { display: flex; justify-content: center; align-items: center; min-height: 420px; background: var(--surface-ground); border-radius: 8px; }
.radar-wrap canvas { max-width: 100%; }
.radar-legend { display: flex; gap: 20px; justify-content: center; margin-top: 16px; flex-wrap: wrap; }
.legend-item { display: flex; align-items: center; gap: 6px; font-size: 0.78rem; color: var(--p-text-color); }
.legend-dot { width: 12px; height: 12px; border-radius: 50%; }
.legend-dot.portfolio { background: rgba(99,102,241,1); }
.legend-dot.median { background: rgba(66,165,245,1); }
.legend-dot.top-quartile { background: rgba(251,146,60,0.7); }

.chart-wrap { background: var(--surface-ground); border-radius: 8px; padding: 16px; display: flex; justify-content: center; overflow-x: auto; }
.chart-wrap canvas { max-width: 100%; }

.valuation-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 14px; }
.valuation-card { background: var(--surface-ground); border: 1px solid var(--surface-border); border-radius: 8px; padding: 16px; }
.val-company { font-weight: 700; font-size: 0.95rem; color: var(--p-primary-color); margin-bottom: 4px; }
.val-stage { font-size: 0.72rem; color: var(--p-text-muted-color); margin-bottom: 12px; }
.val-metrics { display: flex; flex-direction: column; gap: 8px; }
.val-metric { display: flex; justify-content: space-between; align-items: baseline; font-size: 0.78rem; }
.val-label { color: var(--p-text-muted-color); }
.val-current { font-weight: 700; color: var(--p-text-color); }
.val-range { font-weight: 600; color: var(--p-primary-color); }
.val-bar-wrap { margin-top: 8px; }
.val-bar-track { position: relative; height: 10px; background: var(--surface-border); border-radius: 5px; margin-bottom: 6px; }
.val-bar-range { position: absolute; height: 100%; background: rgba(99,102,241,0.2); border-radius: 5px; }
.val-bar-current { position: absolute; width: 3px; height: 100%; background: var(--p-primary-color); top: 0; transform: translateX(-50%); }
.val-bar-labels { display: flex; justify-content: space-between; font-size: 0.68rem; color: var(--p-text-muted-color); }
.val-status { margin-top: 8px; padding: 4px 8px; border-radius: 4px; text-align: center; font-size: 0.72rem; font-weight: 600; }
.val-status.undervalued { background: #66bb6a22; color: #66bb6a; }
.val-status.fair { background: #42a5f522; color: #42a5f5; }
.val-status.overvalued { background: #ef535022; color: #ef5350; }

.sources-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; }
.source-card { background: var(--surface-ground); border: 1px solid var(--surface-border); border-radius: 8px; padding: 14px; text-align: center; }
.src-icon { font-size: 1.8rem; color: var(--p-primary-color); margin-bottom: 8px; }
.src-name { font-weight: 700; font-size: 0.85rem; color: var(--p-text-color); margin-bottom: 6px; }
.src-desc { font-size: 0.72rem; color: var(--p-text-muted-color); margin-bottom: 6px; line-height: 1.3; }
.src-coverage { font-size: 0.68rem; color: var(--p-text-muted-color); font-style: italic; }

.norms-list { display: flex; flex-direction: column; gap: 14px; }
.norm-card { background: var(--surface-ground); border: 1px solid var(--surface-border); border-radius: 8px; padding: 16px; }
.norm-header { display: flex; align-items: center; gap: 12px; margin-bottom: 8px; }
.norm-code { font-weight: 700; font-size: 0.95rem; color: var(--p-primary-color); }
.norm-type { font-size: 0.68rem; color: var(--p-text-muted-color); background: rgba(99,102,241,0.1); padding: 2px 8px; border-radius: 10px; }
.norm-title { font-weight: 600; font-size: 0.85rem; color: var(--p-text-color); margin-bottom: 6px; }
.norm-purpose { font-size: 0.78rem; color: var(--p-text-muted-color); line-height: 1.4; margin-bottom: 10px; }
.norm-link { display: inline-flex; align-items: center; gap: 4px; font-size: 0.75rem; color: var(--p-primary-color); text-decoration: none; }
.norm-link:hover { text-decoration: underline; }
</style>
