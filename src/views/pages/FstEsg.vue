<template>
  <div class="esg-root">
    <div class="esg-header">
      <div>
        <h1>ESG-скоринг портфеля</h1>
        <span class="esg-sub">Оценка экологического, социального и управленческого факторов по TCFD/GRI</span>
      </div>
      <div class="esg-actions">
        <select v-model="view" class="esg-select">
          <option value="portfolio">Портфель целиком</option>
          <option value="company">По компании</option>
        </select>
        <button class="esg-btn primary" @click="exportEsg">Отчёт TCFD</button>
      </div>
    </div>

    <!-- Общий ESG-рейтинг портфеля -->
    <div class="esg-portfolio-score">
      <div v-for="cat in ['E', 'S', 'G']" :key="cat" class="esg-cat-block">
        <div class="esg-cat-letter" :class="'cat-' + cat.toLowerCase()">{{ cat }}</div>
        <div class="esg-cat-score">{{ portfolioScore(cat) }}</div>
        <div class="esg-cat-grade" :class="gradeClass(portfolioScore(cat))">{{ grade(portfolioScore(cat)) }}</div>
        <div class="esg-cat-name">{{ catName(cat) }}</div>
      </div>
      <div class="esg-overall">
        <div class="ov-val">{{ overallScore }}</div>
        <div class="ov-lbl">Общий ESG</div>
        <div class="ov-grade" :class="gradeClass(overallScore)">{{ grade(overallScore) }}</div>
      </div>
    </div>

    <!-- Матрица компаний -->
    <div class="esg-section">
      <h2>Матрица портфеля</h2>
      <table class="esg-table">
        <thead>
          <tr>
            <th>Компания</th>
            <th>E — Экология</th>
            <th>S — Социум</th>
            <th>G — Управление</th>
            <th>Общий</th>
            <th>Рейтинг</th>
            <th>Тренд</th>
            <th>Последнее обновление</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="co in companies" :key="co.name">
            <td class="co-name">{{ co.name }}</td>
            <td class="num"><span class="score-chip" :class="gradeClass(co.e)">{{ co.e }}</span></td>
            <td class="num"><span class="score-chip" :class="gradeClass(co.s)">{{ co.s }}</span></td>
            <td class="num"><span class="score-chip" :class="gradeClass(co.g)">{{ co.g }}</span></td>
            <td class="num bold">{{ Math.round((co.e + co.s + co.g) / 3) }}</td>
            <td><span class="grade-badge" :class="gradeClass(Math.round((co.e + co.s + co.g) / 3))">{{ grade(Math.round((co.e + co.s + co.g) / 3)) }}</span></td>
            <td class="trend" :class="co.trend > 0 ? 'up' : co.trend < 0 ? 'down' : ''">{{ co.trend > 0 ? '↑' : co.trend < 0 ? '↓' : '→' }} {{ Math.abs(co.trend) }}п.</td>
            <td class="date-col">{{ co.updated }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Детальные метрики E/S/G -->
    <div class="esg-metrics-grid">
      <!-- Экология -->
      <div class="esg-section">
        <h2 class="e-color">E — Экологические метрики</h2>
        <div class="metric-list">
          <div v-for="m in eMetrics" :key="m.label" class="metric-item">
            <div class="mi-info">
              <div class="mi-label">{{ m.label }}</div>
              <div class="mi-value">{{ m.value }}</div>
            </div>
            <div class="mi-bar-wrap">
              <div class="mi-bar" :style="{ width: m.pct + '%' }" :class="m.pct >= 70 ? 'bar-good' : m.pct >= 40 ? 'bar-mid' : 'bar-bad'"></div>
            </div>
            <div class="mi-pct">{{ m.pct }}%</div>
          </div>
        </div>
      </div>

      <!-- Социум -->
      <div class="esg-section">
        <h2 class="s-color">S — Социальные метрики</h2>
        <div class="metric-list">
          <div v-for="m in sMetrics" :key="m.label" class="metric-item">
            <div class="mi-info">
              <div class="mi-label">{{ m.label }}</div>
              <div class="mi-value">{{ m.value }}</div>
            </div>
            <div class="mi-bar-wrap">
              <div class="mi-bar" :style="{ width: m.pct + '%' }" :class="m.pct >= 70 ? 'bar-good' : m.pct >= 40 ? 'bar-mid' : 'bar-bad'"></div>
            </div>
            <div class="mi-pct">{{ m.pct }}%</div>
          </div>
        </div>
      </div>

      <!-- Управление -->
      <div class="esg-section">
        <h2 class="g-color">G — Управленческие метрики</h2>
        <div class="metric-list">
          <div v-for="m in gMetrics" :key="m.label" class="metric-item">
            <div class="mi-info">
              <div class="mi-label">{{ m.label }}</div>
              <div class="mi-value">{{ m.value }}</div>
            </div>
            <div class="mi-bar-wrap">
              <div class="mi-bar" :style="{ width: m.pct + '%' }" :class="m.pct >= 70 ? 'bar-good' : m.pct >= 40 ? 'bar-mid' : 'bar-bad'"></div>
            </div>
            <div class="mi-pct">{{ m.pct }}%</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Климатические риски (TCFD) -->
    <div class="esg-section">
      <h2>Климатические риски и возможности (TCFD)</h2>
      <div class="tcfd-grid">
        <div v-for="t in tcfdItems" :key="t.category" class="tcfd-card">
          <div class="tcfd-cat" :class="t.type">{{ t.type === 'risk' ? 'Риск' : 'Возможность' }}</div>
          <div class="tcfd-category">{{ t.category }}</div>
          <div class="tcfd-desc">{{ t.desc }}</div>
          <div class="tcfd-impact" :class="t.severity">Влияние: {{ t.severity === 'high' ? 'Высокое' : t.severity === 'medium' ? 'Среднее' : 'Низкое' }}</div>
          <div class="tcfd-horizon">Горизонт: {{ t.horizon }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

const view = ref('portfolio')

const companies = ref([
  { name: 'АгроДрон',       e: 82, s: 74, g: 78, trend: +4, updated: '2026-01-15' },
  { name: 'RoboFarm',       e: 78, s: 81, g: 82, trend: +2, updated: '2026-01-20' },
  { name: 'МедТех БПЛА',    e: 65, s: 88, g: 71, trend: -1, updated: '2026-01-12' },
  { name: 'DroneLogistics', e: 58, s: 72, g: 68, trend:  0, updated: '2026-01-18' },
  { name: 'ЭнергоРобот',    e: 71, s: 61, g: 55, trend: -3, updated: '2026-01-25' },
  { name: 'CyberPilot',     e: 74, s: 78, g: 85, trend: +6, updated: '2026-01-10' }
])

function portfolioScore(cat) {
  const key = cat.toLowerCase()
  return Math.round(companies.value.reduce((s, c) => s + c[key], 0) / companies.value.length)
}
const overallScore = computed(() => Math.round((portfolioScore('E') + portfolioScore('S') + portfolioScore('G')) / 3))

function grade(score) {
  if (score >= 85) return 'AAA'
  if (score >= 75) return 'AA'
  if (score >= 65) return 'A'
  if (score >= 55) return 'BBB'
  if (score >= 45) return 'BB'
  return 'B'
}
function gradeClass(score) {
  if (score >= 75) return 'grade-a'
  if (score >= 55) return 'grade-b'
  return 'grade-c'
}
function catName(c) { return { E: 'Экология', S: 'Социум', G: 'Управление' }[c] }

const eMetrics = ref([
  { label: 'CO₂-след (кг/1000 полётов)',  value: '12.4 кг',  pct: 88 },
  { label: 'Отходы производства',          value: '2.1 т/год', pct: 72 },
  { label: 'Энергоэффективность',          value: '94 Вт·ч/км', pct: 65 },
  { label: 'Доля перерабатываемых матер.', value: '61%',       pct: 61 },
  { label: 'Водопотребление',              value: '18 м³/год', pct: 83 }
])

const sMetrics = ref([
  { label: 'Рабочие места в РФ',           value: '1 234',     pct: 95 },
  { label: 'Женщины в R&D команде',        value: '28%',       pct: 28 },
  { label: 'Средняя зарплата vs рынок',    value: '+22%',      pct: 78 },
  { label: 'Программы обучения/год',       value: '6 программ', pct: 72 },
  { label: 'Несчастные случаи',            value: '0',         pct: 100 }
])

const gMetrics = ref([
  { label: 'Независимые директора в СД',  value: '40%',       pct: 80 },
  { label: 'Прозрачность отчётности',     value: 'МСФО',      pct: 85 },
  { label: 'Антикоррупционная политика',  value: 'Есть',      pct: 90 },
  { label: 'Кибербезопасность (ISO 27001)', value: 'В процессе', pct: 55 },
  { label: 'Вознаграждение менедж. vs цели', value: 'Привязано', pct: 75 }
])

const tcfdItems = ref([
  { type: 'risk', category: 'Переходный риск', desc: 'Ужесточение требований к локализации БПЛА может повысить себестоимость', severity: 'medium', horizon: '1-3 года' },
  { type: 'risk', category: 'Физический риск', desc: 'Экстремальные погодные явления ограничивают операционность БПЛА', severity: 'low', horizon: '5+ лет' },
  { type: 'opportunity', category: 'Эффективность ресурсов', desc: 'БПЛА vs автотранспорт: снижение CO₂ в агро на 40%', severity: 'high', horizon: '2-5 лет' },
  { type: 'opportunity', category: 'Зелёный рынок', desc: 'Рост спроса на экологичные решения доставки (+$12B к 2030)', severity: 'high', horizon: '3-7 лет' }
])

function exportEsg() { alert('Экспорт TCFD-отчёта') }
</script>

<style scoped>
.esg-root { padding: 24px; display: flex; flex-direction: column; gap: 20px; min-height: 100vh; background: var(--surface-ground); }
.esg-header { display: flex; align-items: flex-start; justify-content: space-between; flex-wrap: wrap; gap: 12px; }
.esg-header h1 { margin: 0; font-size: 1.75rem; color: var(--p-text-color); }
.esg-sub { font-size: 0.9375rem; color: var(--p-text-muted-color); }
.esg-actions { display: flex; gap: 8px; align-items: center; }
.esg-btn { padding: 8px 14px; border-radius: 8px; border: none; cursor: pointer; font-size: 0.875rem; font-weight: 600; }
.esg-btn.primary { background: var(--p-primary-color); color: #fff; }
.esg-select { padding: 7px 10px; border-radius: 8px; border: 1px solid var(--surface-border); background: var(--surface-card); color: var(--p-text-color); font-size: 0.83rem; }

.esg-portfolio-score { display: flex; align-items: center; gap: 16px; background: var(--surface-card); border: 1px solid var(--surface-border); border-radius: 10px; padding: 20px; flex-wrap: wrap; }
.esg-cat-block { display: flex; flex-direction: column; align-items: center; gap: 4px; flex: 1; min-width: 80px; border-right: 1px solid var(--surface-border); padding-right: 16px; }
.esg-cat-block:last-of-type { border-right: none; }
.esg-cat-letter { font-size: 2rem; font-weight: 900; }
.cat-e { color: #66bb6a; } .cat-s { color: #42a5f5; } .cat-g { color: #ab47bc; }
.esg-cat-score { font-size: 1.6rem; font-weight: 700; color: var(--p-text-color); }
.esg-cat-grade { font-size: 0.78rem; font-weight: 700; padding: 2px 8px; border-radius: 4px; }
.esg-cat-name { font-size: 0.72rem; color: var(--p-text-muted-color); }
.grade-a { background: #66bb6a22; color: #66bb6a; }
.grade-b { background: #ff980022; color: #ff9800; }
.grade-c { background: #ef535022; color: #ef5350; }

.esg-overall { display: flex; flex-direction: column; align-items: center; gap: 4px; margin-left: 16px; }
.ov-val { font-size: 2.5rem; font-weight: 900; color: var(--p-primary-color); }
.ov-lbl { font-size: 0.72rem; color: var(--p-text-muted-color); }
.ov-grade { font-size: 0.85rem; font-weight: 700; padding: 3px 10px; border-radius: 5px; }

.esg-section { background: var(--surface-card); border: 1px solid var(--surface-border); border-radius: 10px; padding: 18px; }
.esg-section h2 { margin: 0 0 14px; font-size: 1.05rem; color: var(--p-text-color); }
.e-color { color: #66bb6a; } .s-color { color: #42a5f5; } .g-color { color: #ab47bc; }

.esg-table { width: 100%; border-collapse: collapse; font-size: 0.83rem; }
.esg-table th { padding: 7px 10px; text-align: left; color: var(--p-text-muted-color); border-bottom: 1px solid var(--surface-border); font-size: 0.72rem; }
.esg-table td { padding: 8px 10px; border-bottom: 1px solid var(--surface-border); color: var(--p-text-color); }
.esg-table tr:last-child td { border: none; }
.co-name { font-weight: 600; }
.num { text-align: right; } .bold { font-weight: 700; }
.score-chip { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 0.78rem; font-weight: 700; }
.grade-badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 0.72rem; font-weight: 700; }
.trend { text-align: right; font-size: 0.82rem; }
.trend.up { color: #66bb6a; } .trend.down { color: #ef5350; }
.date-col { font-size: 0.72rem; color: var(--p-text-muted-color); }

.esg-metrics-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 14px; }
.metric-list { display: flex; flex-direction: column; gap: 10px; }
.metric-item { display: flex; align-items: center; gap: 10px; }
.mi-info { min-width: 140px; }
.mi-label { font-size: 0.75rem; color: var(--p-text-muted-color); }
.mi-value { font-size: 0.82rem; font-weight: 600; color: var(--p-text-color); }
.mi-bar-wrap { flex: 1; height: 8px; background: var(--surface-border); border-radius: 4px; overflow: hidden; }
.mi-bar { height: 100%; border-radius: 4px; transition: width 0.4s; }
.bar-good { background: #66bb6a; } .bar-mid { background: #ff9800; } .bar-bad { background: #ef5350; }
.mi-pct { font-size: 0.72rem; color: var(--p-text-muted-color); min-width: 35px; text-align: right; }

.tcfd-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; }
.tcfd-card { background: var(--surface-ground); border: 1px solid var(--surface-border); border-radius: 8px; padding: 14px; display: flex; flex-direction: column; gap: 6px; }
.tcfd-cat { font-size: 0.68rem; font-weight: 700; padding: 2px 8px; border-radius: 4px; width: fit-content; }
.tcfd-cat.risk        { background: #ef535022; color: #ef5350; }
.tcfd-cat.opportunity { background: #66bb6a22; color: #66bb6a; }
.tcfd-category { font-weight: 700; font-size: 0.85rem; color: var(--p-text-color); }
.tcfd-desc { font-size: 0.75rem; color: var(--p-text-muted-color); }
.tcfd-impact { font-size: 0.72rem; }
.tcfd-impact.high   { color: #ef5350; }
.tcfd-impact.medium { color: #ff9800; }
.tcfd-impact.low    { color: #66bb6a; }
.tcfd-horizon { font-size: 0.68rem; color: var(--p-text-muted-color); }
</style>
