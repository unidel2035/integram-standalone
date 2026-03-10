<template>
  <FstPageLayout title="Сценарии выхода" subtitle="M&A, IPO, Buyback — расчёт доходности и оптимальной стратегии">
    <template #actions>
      <Button icon="pi pi-download" label="Экспорт анализа" size="small" severity="secondary" @click="exportExitAnalysis" />
    </template>

    <!-- Выбор компании -->
    <div class="exit-company-bar">
      <Button
        v-for="c in companies"
        :key="c.id"
        :label="c.name"
        size="small"
        :severity="selectedCo === c.id ? undefined : 'secondary'"
        :outlined="selectedCo !== c.id"
        @click="selectedCo = c.id"
      />
    </div>

    <!-- Параметры выхода -->
    <div class="exit-params-card">
      <h3>Входные параметры — {{ currentCompany.name }}</h3>
      <div class="params-grid">
        <div class="param-group">
          <label>Текущий NAV, млн ₽</label>
          <InputNumber v-model="params.nav" :step="10" :min="0" fluid @input="calc" />
        </div>
        <div class="param-group">
          <label>Вложено ФСТ, млн ₽</label>
          <InputNumber v-model="params.invested" :step="10" :min="0" fluid @input="calc" />
        </div>
        <div class="param-group">
          <label>Доля ФСТ FD, %</label>
          <InputNumber v-model="params.fstShare" :step="0.5" :min="0" :max="100" suffix="%" fluid @input="calc" />
        </div>
        <div class="param-group">
          <label>Дата входа</label>
          <InputText v-model="params.entryDate" type="date" fluid @change="calc" />
        </div>
        <div class="param-group">
          <label>Прогнозная выручка, млн ₽</label>
          <InputNumber v-model="params.revenue" :step="10" :min="0" fluid @input="calc" />
        </div>
        <div class="param-group">
          <label>ARR Growth, %</label>
          <InputNumber v-model="params.growth" :step="5" suffix="%" fluid @input="calc" />
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
            <InputNumber v-model="maParams.evRevMult" :step="0.5" :min="1" fluid @input="calc" />
          </div>
          <div class="sp-group">
            <label>Горизонт, лет</label>
            <InputNumber v-model="maParams.years" :step="1" :min="1" :max="7" fluid @input="calc" />
          </div>
          <div class="sp-group">
            <label>Вероятность, %</label>
            <InputNumber v-model="maParams.prob" :step="5" :min="5" :max="95" suffix="%" fluid @input="calc" />
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
            <InputNumber v-model="ipoParams.psMult" :step="0.5" :min="1" fluid @input="calc" />
          </div>
          <div class="sp-group">
            <label>Lock-up, мес.</label>
            <InputNumber v-model="ipoParams.lockupMonths" :step="3" :min="3" :max="24" fluid @input="calc" />
          </div>
          <div class="sp-group">
            <label>Вероятность, %</label>
            <InputNumber v-model="ipoParams.prob" :step="5" :min="5" :max="60" suffix="%" fluid @input="calc" />
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
            <InputNumber v-model="bbParams.navDiscount" :step="5" :min="0" :max="50" suffix="%" fluid @input="calc" />
          </div>
          <div class="sp-group">
            <label>Горизонт, лет</label>
            <InputNumber v-model="bbParams.years" :step="1" :min="1" :max="5" fluid @input="calc" />
          </div>
          <div class="sp-group">
            <label>Вероятность, %</label>
            <InputNumber v-model="bbParams.prob" :step="5" :min="10" :max="90" suffix="%" fluid @input="calc" />
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
import Button from 'primevue/button'
import InputNumber from 'primevue/inputnumber'
import InputText from 'primevue/inputtext'

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
  { name: 'M&A',     prob: maParams.value.prob,  proceeds: maResult.value.fstProceeds,  weighted: Math.round(maResult.value.fstProceeds * maParams.value.prob / 100),  color: 'var(--fst-blue)' },
  { name: 'IPO',     prob: ipoParams.value.prob, proceeds: ipoResult.value.fstProceeds, weighted: Math.round(ipoResult.value.fstProceeds * ipoParams.value.prob / 100), color: 'var(--fst-green)' },
  { name: 'Buyback', prob: bbParams.value.prob,  proceeds: bbResult.value.fstProceeds,  weighted: Math.round(bbResult.value.fstProceeds * bbParams.value.prob / 100),   color: 'var(--fst-brand)' }
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
.exit-root { padding: 24px; display: flex; flex-direction: column; gap: 20px; min-height: 100vh; background: var(--p-surface-ground); }
.exit-header { display: flex; align-items: flex-start; justify-content: space-between; flex-wrap: wrap; gap: 12px; }
.exit-header h1 { margin: 0; font-size: 1rem; font-weight: 600; color: var(--p-text-color); }
.exit-sub { font-size: 0.8rem; color: var(--p-text-muted-color); }
.exit-btn { padding: 8px 14px; border-radius: 8px; border: none; cursor: pointer; font-size: 0.875rem; font-weight: 600; }
.exit-btn.primary { background: var(--p-primary-color); color: white; }

.exit-company-bar { display: flex; gap: 6px; flex-wrap: wrap; }
.co-btn { padding: 7px 14px; border-radius: 8px; border: 1px solid var(--p-content-border-color); background: var(--p-surface-card); color: var(--p-text-muted-color); cursor: pointer; font-size: 0.875rem; }
.co-btn.active { background: var(--p-primary-color); color: white; border-color: var(--p-primary-color); }

.exit-params-card { background: var(--p-surface-card); border: 1px solid var(--p-content-border-color); border-radius: 10px; padding: 18px; }
.exit-params-card h3 { margin: 0 0 14px; font-size: 0.95rem; color: var(--p-text-color); }
.params-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; }
.param-group { display: flex; flex-direction: column; gap: 4px; }
.param-group label { font-size: 0.72rem; color: var(--p-text-muted-color); }
.param-group input { background: var(--p-surface-ground); border: 1px solid var(--p-content-border-color); border-radius: 6px; padding: 6px 10px; color: var(--p-text-color); font-size: 0.85rem; }

.exit-scenarios { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 14px; }
.exit-scenario-card { background: var(--p-surface-card); border: 1px solid var(--p-content-border-color); border-radius: 10px; padding: 16px; display: flex; flex-direction: column; gap: 12px; }
.exit-scenario-card.best { border-color: var(--p-primary-color); box-shadow: 0 0 0 1px var(--p-primary-color); }
.exit-scenario-card h3 { margin: 0; font-size: 0.9rem; color: var(--p-text-color); }
.scenario-badge { display: inline-block; padding: 3px 10px; border-radius: 4px; font-size: 0.72rem; font-weight: 700; width: fit-content; }
.scenario-badge.ma  { background: color-mix(in srgb, var(--fst-blue) 15%, transparent); color: var(--fst-blue); }
.scenario-badge.ipo { background: color-mix(in srgb, var(--fst-green) 15%, transparent); color: var(--fst-green); }
.scenario-badge.bb  { background: color-mix(in srgb, var(--fst-brand) 15%, transparent); color: var(--fst-brand); }

.scenario-params { display: flex; flex-direction: column; gap: 8px; }
.sp-group { display: flex; flex-direction: column; gap: 3px; }
.sp-group label { font-size: 0.7rem; color: var(--p-text-muted-color); }
.sp-group input { background: var(--p-surface-ground); border: 1px solid var(--p-content-border-color); border-radius: 5px; padding: 5px 8px; color: var(--p-text-color); font-size: 0.82rem; }

.scenario-results { display: flex; flex-direction: column; gap: 6px; }
.sr-row { display: flex; justify-content: space-between; font-size: 0.83rem; }
.sr-row span { color: var(--p-text-muted-color); }
.sr-row strong { font-weight: 700; color: var(--p-text-color); }
.green { color: var(--fst-green); } .orange { color: var(--fst-brand); }
.scenario-prob { font-size: 0.72rem; color: var(--p-text-muted-color); border-top: 1px solid var(--p-content-border-color); padding-top: 8px; }

.exit-ev-card { background: var(--p-surface-card); border: 1px solid var(--p-content-border-color); border-radius: 10px; padding: 18px; }
.exit-ev-card h3 { margin: 0 0 14px; font-size: 0.95rem; color: var(--p-text-color); }
.ev-table { display: flex; flex-direction: column; gap: 8px; }
.ev-row { display: grid; grid-template-columns: 80px 50px 120px 120px 1fr; align-items: center; gap: 10px; font-size: 0.83rem; }
.ev-name { font-weight: 600; color: var(--p-text-color); }
.ev-prob { color: var(--p-text-muted-color); }
.ev-proceeds, .ev-weighted { text-align: right; color: var(--p-text-color); }
.ev-bar-wrap { height: 8px; background: var(--p-content-border-color); border-radius: 4px; overflow: hidden; }
.ev-bar { height: 100%; border-radius: 4px; transition: width 0.4s; }
.ev-total-row { display: flex; gap: 24px; justify-content: flex-end; padding-top: 10px; border-top: 2px solid var(--p-content-border-color); font-size: 0.9rem; color: var(--p-text-color); }

.exit-recommendation { display: flex; align-items: center; gap: 16px; padding: 16px 20px; border-radius: 10px; border: 1px solid; }
.exit-recommendation.ma  { background: color-mix(in srgb, var(--fst-blue) 8%, transparent); border-color: var(--fst-blue); }
.exit-recommendation.ipo { background: color-mix(in srgb, var(--fst-green) 8%, transparent); border-color: var(--fst-green); }
.exit-recommendation.bb  { background: color-mix(in srgb, var(--fst-brand) 8%, transparent); border-color: var(--fst-brand); }
.rec-icon { font-size: 1rem; font-weight: 900; padding: 8px 12px; border-radius: 8px; background: color-mix(in srgb, var(--p-text-color) 8%, transparent); }
.rec-title { font-weight: 700; font-size: 0.95rem; color: var(--p-text-color); margin-bottom: 4px; }
.rec-desc  { font-size: 0.8rem; color: var(--p-text-muted-color); }

/* ── Mobile adaptive ── */
@media (max-width: 768px) {
  .ev-table { display: block; overflow-x: auto; -webkit-overflow-scrolling: touch; }
  .params-grid { grid-template-columns: 1fr !important; }
  .exit-scenarios { grid-template-columns: 1fr !important; }
}
</style>
