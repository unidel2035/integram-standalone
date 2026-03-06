<template>
  <div class="bm-root">
    <div class="bm-header">
      <div>
        <h1>Бенчмаркинг портфеля</h1>
        <span class="bm-sub">Сравнение с отраслевыми мультипликаторами и пирами</span>
      </div>
      <div class="bm-actions">
        <select v-model="sector" class="bm-select">
          <option value="bas">БАС / БПЛА</option>
          <option value="robo">Робототехника</option>
          <option value="medtech">MedTech</option>
          <option value="agritech">AgriTech</option>
        </select>
        <button class="bm-btn secondary" @click="exportBenchmark">Экспорт</button>
      </div>
    </div>

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
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

const sector = ref('bas')
const sectorLabel = computed(() => ({ bas: 'БАС / БПЛА', robo: 'Робототехника', medtech: 'MedTech', agritech: 'AgriTech' })[sector.value])

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
  { name: 'АгроДрон',       stage: 'Серия A', evRev: 6.8, evEbitda: '—', pe: '—', growth: 112, gm: 58, r40: 67 },
  { name: 'DroneLogistics', stage: 'Серия B', evRev: 8.4, evEbitda: 18.2, pe: '—', growth: 64, gm: 54, r40: 38 },
  { name: 'CyberPilot',     stage: 'Серия B', evRev: 9.1, evEbitda: 21.3, pe: '—', growth: 89, gm: 63, r40: 55 }
])

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

function exportBenchmark() {
  alert('Экспорт бенчмаркинг-отчёта')
}
</script>

<style scoped>
.bm-root { padding: 24px; display: flex; flex-direction: column; gap: 20px; min-height: 100vh; background: var(--p-surface-ground); }
.bm-header { display: flex; align-items: flex-start; justify-content: space-between; flex-wrap: wrap; gap: 12px; }
.bm-header h1 { margin: 0; font-size: 1.75rem; color: var(--p-text-color); }
.bm-sub { font-size: 0.9375rem; color: var(--p-text-muted-color); }
.bm-actions { display: flex; gap: 8px; align-items: center; }
.bm-btn { padding: 8px 14px; border-radius: 8px; border: none; cursor: pointer; font-size: 0.875rem; font-weight: 600; }
.bm-btn.secondary { background: var(--p-surface-card); color: var(--p-text-color); border: 1px solid var(--p-surface-border); }
.bm-select { padding: 7px 10px; border-radius: 8px; border: 1px solid var(--p-surface-border); background: var(--p-surface-card); color: var(--p-text-color); font-size: 0.83rem; }

.bm-section { background: var(--p-content-background); border: 1px solid var(--p-surface-border); border-radius: 10px; padding: 20px; }
.bm-section h2 { margin: 0 0 16px; font-size: 1.05rem; color: var(--p-text-color); }

.mult-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; }
.mult-card { background: var(--p-surface-ground); border: 1px solid var(--p-surface-border); border-radius: 8px; padding: 12px; }
.mult-name { font-weight: 700; font-size: 0.82rem; color: var(--p-text-color); margin-bottom: 8px; }
.mult-median { display: flex; align-items: baseline; gap: 4px; margin-bottom: 8px; }
.mult-val { font-size: 1.4rem; font-weight: 700; color: var(--p-primary-color); }
.mult-lbl { font-size: 0.68rem; color: var(--p-text-muted-color); }
.mult-range { display: flex; align-items: center; gap: 6px; margin-bottom: 6px; }
.range-bar { flex: 1; height: 6px; background: var(--p-surface-border); border-radius: 3px; position: relative; }
.range-fill { position: absolute; height: 100%; background: var(--p-primary-100, #c7d2fe); border-radius: 3px; }
.range-dot { position: absolute; width: 10px; height: 10px; border-radius: 50%; background: var(--p-primary-color); top: -2px; transform: translateX(-50%); }
.range-low, .range-high { font-size: 0.68rem; color: var(--p-text-muted-color); white-space: nowrap; }
.mult-portfolio { font-size: 0.78rem; font-weight: 600; padding: 2px 6px; border-radius: 4px; text-align: center; }
.pm-above { background: #66bb6a22; color: #66bb6a; }
.pm-below { background: #ef535022; color: #ef5350; }

.bm-table { width: 100%; border-collapse: collapse; font-size: 0.82rem; }
.bm-table th { padding: 7px 10px; text-align: left; color: var(--p-text-muted-color); border-bottom: 1px solid var(--p-surface-border); font-size: 0.72rem; font-weight: 600; }
.bm-table td { padding: 8px 10px; border-bottom: 1px solid var(--p-surface-border); color: var(--p-text-color); }
.peer-header td { background: var(--p-surface-ground); color: var(--p-text-muted-color); font-size: 0.72rem; font-style: italic; padding: 6px 10px; }
.peer-median { background: var(--p-surface-ground); }
.portfolio-row { background: rgba(99, 102, 241, 0.03); }
.peer-name { font-weight: 600; }
.peer-name.fst { color: var(--p-primary-color); }
.peer-type { font-size: 0.72rem; color: var(--p-text-muted-color); }
.num { text-align: right; font-variant-numeric: tabular-nums; }
.bold { font-weight: 700; }
.green { color: #66bb6a; } .red { color: #ef5350; } .orange { color: #ff9800; } .gray { color: var(--p-text-muted-color); }

.fund-bench-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
@media (max-width: 700px) { .fund-bench-grid { grid-template-columns: 1fr; } }
.fund-bench-card { background: var(--p-surface-ground); border: 1px solid var(--p-surface-border); border-radius: 8px; padding: 14px; }
.fb-name { font-weight: 700; font-size: 0.85rem; color: var(--p-text-color); margin-bottom: 12px; }
.fb-metrics { display: flex; flex-direction: column; gap: 10px; }
.fb-m { display: flex; flex-direction: column; gap: 4px; }
.fb-lbl { font-size: 0.72rem; color: var(--p-text-muted-color); }
.fb-bars { display: flex; flex-direction: column; gap: 4px; }
.fb-bar-wrap { display: flex; align-items: center; gap: 8px; }
.fb-bar-label { font-size: 0.65rem; color: var(--p-text-muted-color); width: 60px; flex-shrink: 0; }
.fb-bar-track { flex: 1; height: 8px; background: var(--p-surface-border); border-radius: 4px; overflow: hidden; }
.fb-bar { height: 100%; border-radius: 4px; transition: width 0.4s; }
.fb-bar.fst   { background: var(--p-primary-color); }
.fb-bar.bench { background: #42a5f5; }
.fb-bar-val { font-size: 0.72rem; font-weight: 700; width: 40px; text-align: right; }
.fb-bar-val.fst   { color: var(--p-primary-color); }
.fb-bar-val.bench { color: #42a5f5; }

.scatter-wrap { position: relative; height: 280px; border: 1px solid var(--p-surface-border); border-radius: 8px; background: var(--p-surface-ground); overflow: hidden; }
.scatter-area { position: relative; width: 100%; height: 100%; }
.scatter-axis-y { position: absolute; left: 8px; top: 50%; transform: translateY(-50%) rotate(-90deg); font-size: 0.7rem; color: var(--p-text-muted-color); }
.scatter-axis-x { position: absolute; bottom: 8px; left: 50%; transform: translateX(-50%); font-size: 0.7rem; color: var(--p-text-muted-color); }
.scatter-dot { position: absolute; width: 12px; height: 12px; border-radius: 50%; transform: translate(-50%, 50%); cursor: pointer; }
.scatter-dot.fst    { background: var(--p-primary-color); width: 16px; height: 16px; }
.scatter-dot.bench  { background: #42a5f5; }
.scatter-dot.market { background: #ff9800; }
.scatter-label { position: absolute; left: 14px; top: -4px; font-size: 0.65rem; white-space: nowrap; color: var(--p-text-color); background: var(--p-content-background); padding: 1px 4px; border-radius: 3px; }
.quad { position: absolute; font-size: 0.65rem; color: var(--p-text-muted-color); opacity: 0.6; }
.q1 { right: 8px; top: 8px; }
.q2 { left: 8px; top: 8px; }
.q3 { right: 8px; bottom: 20px; }
.q4 { left: 8px; bottom: 20px; }
</style>
