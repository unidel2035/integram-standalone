<template>
  <FstPageLayout title="Сценарии выхода" subtitle="M&A, IPO, Buyback — расчёт доходности и оптимальной стратегии">
    <template #actions>
      <button class="exit-btn primary" @click="exportExitAnalysis">Экспорт анализа</button>
    </template>

    <!-- Выбор компании -->
    <div class="exit-company-bar">
      <button
        v-for="c in companies"
        :key="c.id"
        :class="['co-btn', { active: selectedCo === c.id }]"
        @click="selectedCo = c.id"
      >{{ c.name }}</button>
    </div>

    <!-- Параметры выхода -->
    <div class="exit-params-card">
      <h3>Входные параметры — {{ currentCompany.name }}</h3>
      <div class="params-grid">
        <div class="param-group">
          <label>Текущий NAV, млн ₽</label>
          <input v-model.number="params.nav" type="number" step="10" @input="calc" />
        </div>
        <div class="param-group">
          <label>Вложено ФСТ, млн ₽</label>
          <input v-model.number="params.invested" type="number" step="10" @input="calc" />
        </div>
        <div class="param-group">
          <label>Доля ФСТ FD, %</label>
          <input v-model.number="params.fstShare" type="number" step="0.5" @input="calc" />
        </div>
        <div class="param-group">
          <label>Дата входа</label>
          <input v-model="params.entryDate" type="date" @change="calc" />
        </div>
        <div class="param-group">
          <label>Прогнозная выручка, млн ₽</label>
          <input v-model.number="params.revenue" type="number" step="10" @input="calc" />
        </div>
        <div class="param-group">
          <label>ARR Growth, %</label>
          <input v-model.number="params.growth" type="number" step="5" @input="calc" />
        </div>
      </div>
    </div>

    <!-- 3 сценария выхода -->
    <div class="exit-scenarios">
      <!-- M&A -->
      <div class="exit-scenario-card" :class="{ best: bestScenario === 'ma' }">
        <div class="scenario-badge ma">M&A</div>
        <h3>Стратегическое поглощение</h3>
        <div class="scenario-params">
          <div class="sp-group">
            <label>EV/Revenue (стратег.)</label>
            <input v-model.number="maParams.evRevMult" type="number" step="0.5" @input="calc" />
          </div>
          <div class="sp-group">
            <label>Горизонт, лет</label>
            <input v-model.number="maParams.years" type="number" step="1" min="1" max="7" @input="calc" />
          </div>
          <div class="sp-group">
            <label>Вероятность, %</label>
            <input v-model.number="maParams.prob" type="number" step="5" min="5" max="95" @input="calc" />
          </div>
        </div>
        <div class="scenario-results">
          <div class="sr-row">
            <span>EV компании</span><strong>{{ maResult.ev }} млн ₽</strong>
          </div>
          <div class="sr-row">
            <span>Доля ФСТ</span><strong>{{ maResult.fstProceeds }} млн ₽</strong>
          </div>
          <div class="sr-row">
            <span>MOIC</span><strong :class="maResult.moic >= 2 ? 'green' : 'orange'">{{ maResult.moic }}x</strong>
          </div>
          <div class="sr-row">
            <span>IRR</span><strong :class="maResult.irr >= 20 ? 'green' : 'orange'">{{ maResult.irr }}%</strong>
          </div>
        </div>
        <div class="scenario-prob">Вероятность: {{ maParams.prob }}%</div>
      </div>

      <!-- IPO -->
      <div class="exit-scenario-card" :class="{ best: bestScenario === 'ipo' }">
        <div class="scenario-badge ipo">IPO</div>
        <h3>Первичное размещение</h3>
        <div class="scenario-params">
          <div class="sp-group">
            <label>P/S при IPO</label>
            <input v-model.number="ipoParams.psMult" type="number" step="0.5" @input="calc" />
          </div>
          <div class="sp-group">
            <label>Lock-up, мес.</label>
            <input v-model.number="ipoParams.lockupMonths" type="number" step="3" min="3" max="24" @input="calc" />
          </div>
          <div class="sp-group">
            <label>Вероятность, %</label>
            <input v-model.number="ipoParams.prob" type="number" step="5" min="5" max="60" @input="calc" />
          </div>
        </div>
        <div class="scenario-results">
          <div class="sr-row">
            <span>Рыночная кап.</span><strong>{{ ipoResult.mktCap }} млн ₽</strong>
          </div>
          <div class="sr-row">
            <span>Доля ФСТ (post lock-up)</span><strong>{{ ipoResult.fstProceeds }} млн ₽</strong>
          </div>
          <div class="sr-row">
            <span>MOIC</span><strong :class="ipoResult.moic >= 2 ? 'green' : 'orange'">{{ ipoResult.moic }}x</strong>
          </div>
          <div class="sr-row">
            <span>IRR</span><strong :class="ipoResult.irr >= 20 ? 'green' : 'orange'">{{ ipoResult.irr }}%</strong>
          </div>
        </div>
        <div class="scenario-prob">Вероятность: {{ ipoParams.prob }}%</div>
      </div>

      <!-- Buyback -->
      <div class="exit-scenario-card" :class="{ best: bestScenario === 'bb' }">
        <div class="scenario-badge bb">Buyback</div>
        <h3>Выкуп основателями / Вторичка</h3>
        <div class="scenario-params">
          <div class="sp-group">
            <label>Дисконт к NAV, %</label>
            <input v-model.number="bbParams.navDiscount" type="number" step="5" min="0" max="50" @input="calc" />
          </div>
          <div class="sp-group">
            <label>Горизонт, лет</label>
            <input v-model.number="bbParams.years" type="number" step="1" min="1" max="5" @input="calc" />
          </div>
          <div class="sp-group">
            <label>Вероятность, %</label>
            <input v-model.number="bbParams.prob" type="number" step="5" min="10" max="90" @input="calc" />
          </div>
        </div>
        <div class="scenario-results">
          <div class="sr-row">
            <span>Цена выкупа</span><strong>{{ bbResult.price }} млн ₽</strong>
          </div>
          <div class="sr-row">
            <span>Доля ФСТ</span><strong>{{ bbResult.fstProceeds }} млн ₽</strong>
          </div>
          <div class="sr-row">
            <span>MOIC</span><strong :class="bbResult.moic >= 1.5 ? 'green' : 'orange'">{{ bbResult.moic }}x</strong>
          </div>
          <div class="sr-row">
            <span>IRR</span><strong :class="bbResult.irr >= 15 ? 'green' : 'orange'">{{ bbResult.irr }}%</strong>
          </div>
        </div>
        <div class="scenario-prob">Вероятность: {{ bbParams.prob }}%</div>
      </div>
    </div>

    <!-- Взвешенный ожидаемый результат -->
    <div class="exit-ev-card">
      <h3>Взвешенный ожидаемый результат (EV)</h3>
      <div class="ev-table">
        <div class="ev-row" v-for="s in evRows" :key="s.name">
          <span class="ev-name">{{ s.name }}</span>
          <span class="ev-prob">{{ s.prob }}%</span>
          <span class="ev-proceeds">{{ s.proceeds }} млн ₽</span>
          <span class="ev-weighted">{{ s.weighted }} млн ₽</span>
          <div class="ev-bar-wrap">
            <div class="ev-bar" :style="{ width: (s.weighted / evTotal * 100) + '%', background: s.color }"></div>
          </div>
        </div>
        <div class="ev-total-row">
          <span>Ожидаемый выход ФСТ</span>
          <strong>{{ evTotal }} млн ₽</strong>
          <strong>Expected MOIC: {{ expectedMoic }}x</strong>
        </div>
      </div>
    </div>

    <!-- Рекомендация -->
    <div class="exit-recommendation" :class="bestScenario">
      <div class="rec-icon">
        {{ bestScenario === 'ma' ? 'M&A' : bestScenario === 'ipo' ? 'IPO' : 'BB' }}
      </div>
      <div class="rec-text">
        <div class="rec-title">Рекомендуемая стратегия: {{ bestScenarioLabel }}</div>
        <div class="rec-desc">{{ bestScenarioDesc }}</div>
      </div>
    </div>
  </FstPageLayout>
</template>

<script setup>
import { ref, computed } from 'vue'
import FstPageLayout from '@/components/fst-shared/FstPageLayout.vue'

const selectedCo = ref('agrodr')

const companies = ref([
  { id: 'agrodr', name: 'АгроДрон', nav: 265, invested: 180, fstShare: 20, revenue: 85, growth: 112, entryDate: '2024-03-01' },
  { id: 'drone',  name: 'DroneLogistics', nav: 420, invested: 350, fstShare: 28, revenue: 320, growth: 64, entryDate: '2023-12-01' },
  { id: 'cyber',  name: 'CyberPilot', nav: 310, invested: 200, fstShare: 18, revenue: 195, growth: 89, entryDate: '2023-06-01' }
])

const currentCompany = computed(() => companies.value.find(c => c.id === selectedCo.value))

const params = ref({ nav: 265, invested: 180, fstShare: 20, entryDate: '2024-03-01', revenue: 85, growth: 112 })

const maParams  = ref({ evRevMult: 10, years: 3, prob: 45 })
const ipoParams = ref({ psMult: 14, lockupMonths: 6, prob: 20 })
const bbParams  = ref({ navDiscount: 20, years: 2, prob: 35 })

function yearsHeld(targetYears) {
  const entry = new Date(params.value.entryDate)
  const exit  = new Date(entry.setFullYear(entry.getFullYear() + targetYears))
  const now   = new Date(params.value.entryDate)
  return Math.max(1, targetYears)
}

const projRevenue = (years) => params.value.revenue * Math.pow(1 + params.value.growth / 100, years)

const maResult = computed(() => {
  const rev = projRevenue(maParams.value.years)
  const ev  = rev * maParams.value.evRevMult
  const fstProceeds = Math.round(ev * params.value.fstShare / 100)
  const moic = (fstProceeds / params.value.invested).toFixed(2)
  const irr  = ((Math.pow(fstProceeds / params.value.invested, 1 / maParams.value.years) - 1) * 100).toFixed(1)
  return { ev: Math.round(ev), fstProceeds, moic, irr }
})

const ipoResult = computed(() => {
  const years = 4
  const rev = projRevenue(years)
  const mktCap = Math.round(rev * ipoParams.value.psMult)
  const fstProceeds = Math.round(mktCap * params.value.fstShare / 100 * 0.9)
  const moic = (fstProceeds / params.value.invested).toFixed(2)
  const irr  = ((Math.pow(fstProceeds / params.value.invested, 1 / years) - 1) * 100).toFixed(1)
  return { mktCap, fstProceeds, moic, irr }
})

const bbResult = computed(() => {
  const price = Math.round(params.value.nav * (1 - bbParams.value.navDiscount / 100))
  const fstProceeds = Math.round(price * params.value.fstShare / 100)
  const moic = (fstProceeds / params.value.invested).toFixed(2)
  const irr  = ((Math.pow(fstProceeds / params.value.invested, 1 / bbParams.value.years) - 1) * 100).toFixed(1)
  return { price, fstProceeds, moic, irr }
})

const evRows = computed(() => [
  { name: 'M&A',     prob: maParams.value.prob,  proceeds: maResult.value.fstProceeds,  weighted: Math.round(maResult.value.fstProceeds * maParams.value.prob / 100),  color: '#42a5f5' },
  { name: 'IPO',     prob: ipoParams.value.prob, proceeds: ipoResult.value.fstProceeds, weighted: Math.round(ipoResult.value.fstProceeds * ipoParams.value.prob / 100), color: '#66bb6a' },
  { name: 'Buyback', prob: bbParams.value.prob,  proceeds: bbResult.value.fstProceeds,  weighted: Math.round(bbResult.value.fstProceeds * bbParams.value.prob / 100),   color: '#ff9800' }
])

const evTotal = computed(() => evRows.value.reduce((s, r) => s + r.weighted, 0))
const expectedMoic = computed(() => (evTotal.value / params.value.invested).toFixed(2))

const bestScenario = computed(() => {
  const scores = [
    { id: 'ma',  val: parseFloat(maResult.value.irr) },
    { id: 'ipo', val: parseFloat(ipoResult.value.irr) },
    { id: 'bb',  val: parseFloat(bbResult.value.irr) }
  ]
  return scores.sort((a, b) => b.val - a.val)[0].id
})

const bestScenarioLabel = computed(() => ({ ma: 'M&A (Стратегическое поглощение)', ipo: 'IPO (Публичное размещение)', bb: 'Buyback (Выкуп)' })[bestScenario.value])
const bestScenarioDesc = computed(() => ({
  ma:  `IRR ${maResult.value.irr}% при горизонте ${maParams.value.years} лет. Рекомендуется поиск стратегических покупателей из Росатом, ОАК, АФК "Система"`,
  ipo: `IRR ${ipoResult.value.irr}%. Ожидаемый P/S ${ipoParams.value.psMult}x при высоком росте. Цель — МосБиржа Innovation Market к 2028`,
  bb:  `IRR ${bbResult.value.irr}% с дисконтом ${bbParams.value.navDiscount}% к NAV. Быстрый выход с умеренной доходностью`
})[bestScenario.value])

function calc() {}

function exportExitAnalysis() {
  alert('Экспорт анализа сценариев выхода')
}
</script>

<style scoped>
.exit-root { padding: 24px; display: flex; flex-direction: column; gap: 20px; min-height: 100vh; background: var(--surface-ground); }
.exit-header { display: flex; align-items: flex-start; justify-content: space-between; flex-wrap: wrap; gap: 12px; }
.exit-header h1 { margin: 0; font-size: 1rem; font-weight: 600; color: var(--p-text-color); }
.exit-sub { font-size: 0.8rem; color: var(--p-text-muted-color); }
.exit-btn { padding: 8px 14px; border-radius: 8px; border: none; cursor: pointer; font-size: 0.875rem; font-weight: 600; }
.exit-btn.primary { background: var(--p-primary-color); color: #fff; }

.exit-company-bar { display: flex; gap: 6px; flex-wrap: wrap; }
.co-btn { padding: 7px 14px; border-radius: 8px; border: 1px solid var(--surface-border); background: var(--surface-card); color: var(--p-text-muted-color); cursor: pointer; font-size: 0.875rem; }
.co-btn.active { background: var(--p-primary-color); color: #fff; border-color: var(--p-primary-color); }

.exit-params-card { background: var(--surface-card); border: 1px solid var(--surface-border); border-radius: 10px; padding: 18px; }
.exit-params-card h3 { margin: 0 0 14px; font-size: 0.95rem; color: var(--p-text-color); }
.params-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; }
.param-group { display: flex; flex-direction: column; gap: 4px; }
.param-group label { font-size: 0.72rem; color: var(--p-text-muted-color); }
.param-group input { background: var(--surface-ground); border: 1px solid var(--surface-border); border-radius: 6px; padding: 6px 10px; color: var(--p-text-color); font-size: 0.85rem; }

.exit-scenarios { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 14px; }
.exit-scenario-card { background: var(--surface-card); border: 1px solid var(--surface-border); border-radius: 10px; padding: 16px; display: flex; flex-direction: column; gap: 12px; }
.exit-scenario-card.best { border-color: var(--p-primary-color); box-shadow: 0 0 0 1px var(--p-primary-color); }
.exit-scenario-card h3 { margin: 0; font-size: 0.9rem; color: var(--p-text-color); }
.scenario-badge { display: inline-block; padding: 3px 10px; border-radius: 4px; font-size: 0.72rem; font-weight: 700; width: fit-content; }
.scenario-badge.ma  { background: #42a5f522; color: #42a5f5; }
.scenario-badge.ipo { background: #66bb6a22; color: #66bb6a; }
.scenario-badge.bb  { background: #ff980022; color: #ff9800; }

.scenario-params { display: flex; flex-direction: column; gap: 8px; }
.sp-group { display: flex; flex-direction: column; gap: 3px; }
.sp-group label { font-size: 0.7rem; color: var(--p-text-muted-color); }
.sp-group input { background: var(--surface-ground); border: 1px solid var(--surface-border); border-radius: 5px; padding: 5px 8px; color: var(--p-text-color); font-size: 0.82rem; }

.scenario-results { display: flex; flex-direction: column; gap: 6px; }
.sr-row { display: flex; justify-content: space-between; font-size: 0.83rem; }
.sr-row span { color: var(--p-text-muted-color); }
.sr-row strong { font-weight: 700; color: var(--p-text-color); }
.green { color: #66bb6a; } .orange { color: #ff9800; }
.scenario-prob { font-size: 0.72rem; color: var(--p-text-muted-color); border-top: 1px solid var(--surface-border); padding-top: 8px; }

.exit-ev-card { background: var(--surface-card); border: 1px solid var(--surface-border); border-radius: 10px; padding: 18px; }
.exit-ev-card h3 { margin: 0 0 14px; font-size: 0.95rem; color: var(--p-text-color); }
.ev-table { display: flex; flex-direction: column; gap: 8px; }
.ev-row { display: grid; grid-template-columns: 80px 50px 120px 120px 1fr; align-items: center; gap: 10px; font-size: 0.83rem; }
.ev-name { font-weight: 600; color: var(--p-text-color); }
.ev-prob { color: var(--p-text-muted-color); }
.ev-proceeds, .ev-weighted { text-align: right; color: var(--p-text-color); }
.ev-bar-wrap { height: 8px; background: var(--surface-border); border-radius: 4px; overflow: hidden; }
.ev-bar { height: 100%; border-radius: 4px; transition: width 0.4s; }
.ev-total-row { display: flex; gap: 24px; justify-content: flex-end; padding-top: 10px; border-top: 2px solid var(--surface-border); font-size: 0.9rem; color: var(--p-text-color); }

.exit-recommendation { display: flex; align-items: center; gap: 16px; padding: 16px 20px; border-radius: 10px; border: 1px solid; }
.exit-recommendation.ma  { background: #42a5f510; border-color: #42a5f5; }
.exit-recommendation.ipo { background: #66bb6a10; border-color: #66bb6a; }
.exit-recommendation.bb  { background: #ff980010; border-color: #ff9800; }
.rec-icon { font-size: 1rem; font-weight: 900; padding: 8px 12px; border-radius: 8px; background: rgba(255,255,255,0.1); }
.rec-title { font-weight: 700; font-size: 0.95rem; color: var(--p-text-color); margin-bottom: 4px; }
.rec-desc  { font-size: 0.8rem; color: var(--p-text-muted-color); }

/* ── Mobile adaptive ── */
@media (max-width: 768px) {
  .ev-table { display: block; overflow-x: auto; -webkit-overflow-scrolling: touch; }
  .params-grid { grid-template-columns: 1fr !important; }
  .exit-scenarios { grid-template-columns: 1fr !important; }
}
</style>
