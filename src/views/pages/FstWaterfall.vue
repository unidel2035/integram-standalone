<template>
  <FstPageLayout title="Waterfall Калькулятор" subtitle="Распределение выручки от выхода по очерёдности">
    <template #actions>
      <Button icon="pi pi-download" label="Экспорт" size="small" severity="secondary" @click="exportWaterfall" />
    </template>

    <!-- ─── Metrics strip ─── -->
    <div class="wf-metrics fst-metrics-strip">
      <div class="fst-metric-item">
        <i class="pi pi-dollar fst-metric-item-icon"></i>
        <div class="fst-metric-item-val">{{ params.exitProceeds }} млн</div>
        <div class="fst-metric-item-label">Выход</div>
      </div>
      <div class="fst-metric-item">
        <i class="pi pi-wallet fst-metric-item-icon"></i>
        <div class="fst-metric-item-val">{{ totalCapital }} млн</div>
        <div class="fst-metric-item-label">Капитал LP</div>
      </div>
      <div class="fst-metric-item">
        <i class="pi pi-chart-line fst-metric-item-icon"></i>
        <div class="fst-metric-item-val">{{ overallMoic }}x</div>
        <div class="fst-metric-item-label">MOIC</div>
      </div>
      <div class="fst-metric-item">
        <i class="pi pi-percentage fst-metric-item-icon"></i>
        <div class="fst-metric-item-val">{{ params.hurdleRate }}%</div>
        <div class="fst-metric-item-label">Hurdle Rate</div>
      </div>
      <div class="fst-metric-item">
        <i class="pi pi-arrow-up-right fst-metric-item-icon"></i>
        <div class="fst-metric-item-val">{{ params.carry }}%</div>
        <div class="fst-metric-item-label">Carry</div>
      </div>
      <div class="fst-metric-item">
        <i class="pi pi-users fst-metric-item-icon"></i>
        <div class="fst-metric-item-val">{{ investors.length }}</div>
        <div class="fst-metric-item-label">Инвесторов</div>
      </div>
    </div>

    <!-- Параметры выхода -->
    <div class="wf-inputs-card">
      <h3>Параметры выхода</h3>
      <div class="wf-inputs-grid">
        <div class="wf-field">
          <label>Выручка от продажи, млн ₽</label>
          <InputNumber v-model="params.exitProceeds" :step="50" :min="0" fluid @input="calc" />
        </div>
        <div class="wf-field">
          <label>Hurdle Rate (preferred return), %</label>
          <InputNumber v-model="params.hurdleRate" :step="0.5" :min="0" :max="100" suffix="%" fluid @input="calc" />
        </div>
        <div class="wf-field">
          <label>Carried Interest, %</label>
          <InputNumber v-model="params.carry" :step="1" :min="0" :max="50" suffix="%" fluid @input="calc" />
        </div>
        <div class="wf-field">
          <label>Дата закрытия фонда</label>
          <InputText v-model="params.fundCloseDate" type="date" fluid @change="calc" />
        </div>
        <div class="wf-field">
          <label>Дата выхода</label>
          <InputText v-model="params.exitDate" type="date" fluid @change="calc" />
        </div>
        <div class="wf-field">
          <label>Общий объём фонда, млн ₽</label>
          <InputNumber v-model="params.fundSize" :step="100" :min="0" fluid @input="calc" />
        </div>
      </div>
    </div>

    <!-- Стек инвесторов -->
    <div class="wf-stack-card">
      <div class="wf-stack-header">
        <h3>Стек инвесторов</h3>
        <Button icon="pi pi-plus" label="Инвестор" size="small" severity="success" @click="showAddInvestor = true" />
      </div>
      <table class="wf-table">
        <thead>
          <tr>
            <th>Инвестор</th>
            <th>Взносы, млн ₽</th>
            <th>Тип преф.</th>
            <th>Множитель</th>
            <th>Участие</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(inv, i) in investors" :key="i">
            <td class="inv-name">{{ inv.name }}</td>
            <td class="num">{{ inv.capital }}</td>
            <td><span class="pref-badge" :class="inv.prefType">{{ prefLabel(inv.prefType) }}</span></td>
            <td class="num">{{ inv.mult }}x</td>
            <td class="num">{{ inv.participating ? 'Да' : 'Нет' }}</td>
            <td><Button icon="pi pi-times" size="small" text severity="danger" @click="removeInvestor(i)" /></td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Водопад распределения -->
    <div class="wf-result-card">
      <h3>Распределение выхода — {{ params.exitProceeds }} млн ₽</h3>

      <!-- Трамплин шагов -->
      <div class="wf-steps">
        <div v-for="(step, i) in waterfallSteps" :key="i" class="wf-step">
          <div class="step-num">{{ i + 1 }}</div>
          <div class="step-body">
            <div class="step-title">{{ step.title }}</div>
            <div class="step-desc">{{ step.desc }}</div>
          </div>
          <div class="step-amount" :class="step.color">{{ step.amount }} млн ₽</div>
          <div class="step-bar-wrap">
            <div class="step-bar" :style="{ width: step.pct + '%', background: step.barColor }"></div>
            <span class="step-pct">{{ step.pct.toFixed(1) }}%</span>
          </div>
        </div>
      </div>

      <!-- Итоговая таблица по инвесторам -->
      <h4>Итог по инвесторам</h4>
      <table class="wf-table result-table">
        <thead>
          <tr>
            <th>Инвестор</th>
            <th>Вложено</th>
            <th>Ликв. преф.</th>
            <th>Участие</th>
            <th>Carry</th>
            <th>Итого</th>
            <th>MOIC</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in resultRows" :key="row.name">
            <td class="inv-name">{{ row.name }}</td>
            <td class="num">{{ row.capital }}</td>
            <td class="num">{{ row.liquidPref }}</td>
            <td class="num">{{ row.participation }}</td>
            <td class="num">{{ row.carry }}</td>
            <td class="num bold">{{ row.total }}</td>
            <td class="num" :class="row.moic >= 1 ? 'green' : 'red'">{{ row.moic }}x</td>
          </tr>
        </tbody>
        <tfoot>
          <tr>
            <td><strong>Итого</strong></td>
            <td class="num bold">{{ totalCapital }}</td>
            <td colspan="3"></td>
            <td class="num bold">{{ params.exitProceeds }}</td>
            <td class="num bold">{{ overallMoic }}x</td>
          </tr>
        </tfoot>
      </table>
    </div>

    <!-- IRR по сценариям -->
    <div class="wf-irr-card">
      <h3>IRR-анализ по сценариям</h3>
      <div class="irr-scenarios">
        <div v-for="s in irrScenarios" :key="s.label" class="irr-sc">
          <div class="irr-exit">{{ s.exitMult }}x</div>
          <div class="irr-label">{{ s.label }}</div>
          <div class="irr-val" :class="s.irr >= params.hurdleRate ? 'green' : 'red'">{{ s.irr }}%</div>
          <div class="irr-bar-wrap">
            <div class="irr-bar" :style="{ width: Math.min(s.irr / 50 * 100, 100) + '%', background: s.irr >= params.hurdleRate ? 'var(--fst-green)' : 'var(--fst-red)' }"></div>
          </div>
        </div>
      </div>
    </div>

    <!-- Add Investor Dialog -->
    <Dialog v-model:visible="showAddInvestor" header="Добавить инвестора" modal :style="{ width: '420px' }">
      <div class="modal-form">
        <label>Название</label>
        <InputText v-model="newInv.name" fluid />
        <label>Взносы, млн ₽</label>
        <InputNumber v-model="newInv.capital" :step="10" :min="0" fluid />
        <label>Тип ликв. предпочтения</label>
        <Select v-model="newInv.prefType" :options="prefTypeOptions" optionLabel="label" optionValue="value" fluid />
        <label>Множитель (1x, 2x...)</label>
        <InputNumber v-model="newInv.mult" :step="0.25" :min="0.5" :max="10" fluid />
        <label class="checkbox-label">
          <input type="checkbox" v-model="newInv.participating" />
          Участие в upside после ликв. преф.
        </label>
      </div>
      <template #footer>
        <Button label="Отмена" size="small" severity="secondary" @click="showAddInvestor = false" />
        <Button icon="pi pi-plus" label="Добавить" size="small" severity="success" @click="addInvestor" />
      </template>
    </Dialog>
  </FstPageLayout>
</template>

<script setup>
import { ref, computed } from 'vue'
import FstPageLayout from '@/components/fst-shared/FstPageLayout.vue'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputNumber from 'primevue/inputnumber'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'

const showAddInvestor = ref(false)

const params = ref({
  exitProceeds: 2000,
  hurdleRate:   8,
  carry:        20,
  fundSize:     2120,
  fundCloseDate: '2023-01-01',
  exitDate:      '2028-12-31'
})

const investors = ref([
  { name: 'Основатели',      capital: 0,   prefType: 'none',     mult: 1, participating: true  },
  { name: 'ФСТ НТИ (БАС)',   capital: 450, prefType: 'non_part', mult: 1, participating: false },
  { name: 'ФСТ НТИ (РОБО)',  capital: 270, prefType: 'non_part', mult: 1, participating: false },
  { name: 'ФСТ НТИ (МЭ)',    capital: 90,  prefType: 'non_part', mult: 1, participating: false },
  { name: 'Со-инвесторы',    capital: 310, prefType: 'part',     mult: 1, participating: true  }
])

function prefLabel(t) {
  return { none: 'Common', non_part: 'Non-part.', part: 'Participating', capped: 'Capped' }[t] || t
}

function removeInvestor(i) { investors.value.splice(i, 1) }

const totalCapital = computed(() => investors.value.reduce((s, i) => s + i.capital, 0))

// Waterfall calculation
const waterfallSteps = computed(() => {
  const exit = params.value.exitProceeds
  const steps = []

  // Step 1: Return of capital
  const rcAmount = Math.min(exit, totalCapital.value)
  steps.push({ title: 'Возврат капитала', desc: 'LP получают вложенные средства', amount: rcAmount, pct: rcAmount / exit * 100, color: 'blue', barColor: 'var(--fst-blue)' })

  // Step 2: Preferred return / hurdle
  const yearsHeld = 5
  const preferredReturn = Math.min(exit - rcAmount, totalCapital.value * Math.pow(1 + params.value.hurdleRate / 100, yearsHeld) - totalCapital.value)
  const prefReturnActual = Math.max(0, preferredReturn)
  steps.push({ title: `Preferred Return (${params.value.hurdleRate}%)`, desc: `Накопленный доход за ${yearsHeld} лет`, amount: Math.round(prefReturnActual), pct: prefReturnActual / exit * 100, color: 'green', barColor: 'var(--fst-green)' })

  // Step 3: GP Catch-up
  const remaining2 = exit - rcAmount - prefReturnActual
  const catchup = Math.min(remaining2, (params.value.carry / (100 - params.value.carry)) * prefReturnActual)
  const catchupActual = Math.max(0, catchup)
  steps.push({ title: 'GP Catch-up', desc: `УК догоняет до ${params.value.carry}% carry`, amount: Math.round(catchupActual), pct: catchupActual / exit * 100, color: 'purple', barColor: 'var(--fst-purple)' })

  // Step 4: Carry split
  const remaining3 = exit - rcAmount - prefReturnActual - catchupActual
  const carryAmount = Math.max(0, remaining3 * params.value.carry / 100)
  steps.push({ title: `Carried Interest (${params.value.carry}%)`, desc: 'Вознаграждение УК от сверхдохода', amount: Math.round(carryAmount), pct: carryAmount / exit * 100, color: 'orange', barColor: 'var(--fst-brand)' })

  // Step 5: Remaining to LP
  const toLP = Math.max(0, remaining3 - carryAmount)
  steps.push({ title: 'Остаток LP', desc: 'Pro-rata распределение среди LP', amount: Math.round(toLP), pct: toLP / exit * 100, color: 'blue', barColor: 'var(--fst-blue)' })

  return steps
})

const resultRows = computed(() => {
  const exit = params.value.exitProceeds
  const totalCap = totalCapital.value || 1
  return investors.value.map(inv => {
    const share = inv.capital / totalCap
    const liqPref = inv.prefType !== 'none' ? Math.min(inv.capital * inv.mult, exit * share * 1.5) : 0
    const participation = inv.participating ? Math.round(exit * share * 0.3) : 0
    const carry = inv.name.includes('ФСТ') ? 0 : 0
    const total = Math.round(liqPref + participation)
    return {
      name: inv.name,
      capital: inv.capital,
      liquidPref: Math.round(liqPref),
      participation,
      carry,
      total,
      moic: inv.capital > 0 ? (total / inv.capital).toFixed(2) : '—'
    }
  })
})

const overallMoic = computed(() => {
  const cap = totalCapital.value
  return cap > 0 ? (params.value.exitProceeds / cap).toFixed(2) : '—'
})

const irrScenarios = computed(() => {
  const n = 5
  const cap = totalCapital.value || 1
  return [
    { label: 'Пессимист. 0.8x', exitMult: 0.8, irr: calcIrr(cap * 0.8, cap, n) },
    { label: 'Базовый 1.5x',     exitMult: 1.5, irr: calcIrr(cap * 1.5, cap, n) },
    { label: 'Оптимист. 2.5x',   exitMult: 2.5, irr: calcIrr(cap * 2.5, cap, n) },
    { label: 'Джекпот 4x',       exitMult: 4.0, irr: calcIrr(cap * 4.0, cap, n) }
  ]
})

function calcIrr(fv, pv, n) {
  return ((Math.pow(fv / pv, 1 / n) - 1) * 100).toFixed(1)
}

function calc() {}

const prefTypeOptions = [
  { label: 'Обычные акции (нет)', value: 'none' },
  { label: 'Non-participating preferred', value: 'non_part' },
  { label: 'Participating preferred', value: 'part' },
  { label: 'Capped participating', value: 'capped' }
]

const newInv = ref({ name: '', capital: 100, prefType: 'non_part', mult: 1, participating: false })
function addInvestor() {
  investors.value.push({ ...newInv.value })
  showAddInvestor.value = false
  newInv.value = { name: '', capital: 100, prefType: 'non_part', mult: 1, participating: false }
}

function exportWaterfall() {
  const rows = [
    ['Шаг', 'Описание', 'Сумма млн ₽', 'Доля %'],
    ...waterfallSteps.value.map((s, i) => [i + 1, s.title, s.amount, s.pct.toFixed(2)])
  ]
  const csv = rows.map(r => r.join(',')).join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = 'waterfall.csv'; a.click()
  URL.revokeObjectURL(url)
}
</script>

<style scoped>
.wf-root { padding: 24px; display: flex; flex-direction: column; gap: 20px; min-height: 100vh; background: var(--p-surface-ground); }
.wf-header { display: flex; align-items: flex-start; justify-content: space-between; flex-wrap: wrap; gap: 12px; }
.wf-header h1 { margin: 0; font-size: 1rem; font-weight: 600; color: var(--p-text-color); }
.wf-subtitle { font-size: 0.8rem; color: var(--p-text-muted-color); }
.wf-btn { padding: 8px 14px; border-radius: 8px; border: none; cursor: pointer; font-size: 0.875rem; font-weight: 600; }
.wf-btn.primary  { background: var(--p-primary-color); color: white; }
.wf-btn.secondary{ background: var(--p-surface-card); color: var(--p-text-color); border: 1px solid var(--p-content-border-color); }
.wf-btn.small { padding: 5px 10px; font-size: 0.78rem; }

.wf-inputs-card, .wf-stack-card, .wf-result-card, .wf-irr-card {
  background: var(--p-surface-card); border: 1px solid var(--p-content-border-color); border-radius: 10px; padding: 20px;
}
h3 { margin: 0 0 14px; font-size: 1rem; color: var(--p-text-color); }
h4 { margin: 16px 0 10px; font-size: 0.9rem; color: var(--p-text-color); }

.wf-inputs-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 14px; }
.wf-field { display: flex; flex-direction: column; gap: 4px; }
.wf-field label { font-size: 0.75rem; color: var(--p-text-muted-color); }

.wf-stack-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
.wf-table { width: 100%; border-collapse: collapse; font-size: 0.83rem; }
.wf-table th { padding: 7px 10px; text-align: left; color: var(--p-text-muted-color); border-bottom: 1px solid var(--p-content-border-color); font-size: 0.75rem; }
.wf-table td { padding: 8px 10px; border-bottom: 1px solid var(--p-content-border-color); color: var(--p-text-color); }
.wf-table tfoot td { border-top: 2px solid var(--p-content-border-color); border-bottom: none; background: var(--p-surface-ground); }
.inv-name { font-weight: 600; }
.num { text-align: right; font-variant-numeric: tabular-nums; }
.bold { font-weight: 700; }
.green { color: var(--fst-green); } .red { color: var(--fst-red); }
.pref-badge { padding: 2px 7px; border-radius: 4px; font-size: 0.7rem; font-weight: 600; }
.pref-badge.none     { background: var(--p-surface-ground); color: var(--p-text-muted-color); }
.pref-badge.non_part { background: color-mix(in srgb, var(--fst-blue) 12%, transparent); color: color-mix(in srgb, var(--fst-blue) 70%, var(--p-text-color)); }
.pref-badge.part     { background: color-mix(in srgb, var(--fst-purple) 12%, transparent); color: color-mix(in srgb, var(--fst-purple) 70%, var(--p-text-color)); }
.pref-badge.capped   { background: color-mix(in srgb, var(--fst-brand) 12%, transparent); color: color-mix(in srgb, var(--fst-brand) 70%, var(--p-text-color)); }
.del-btn { background: none; border: none; color: var(--p-text-muted-color); cursor: pointer; font-size: 0.9rem; padding: 2px 6px; }
.del-btn:hover { color: var(--fst-red); }

.wf-steps { display: flex; flex-direction: column; gap: 10px; margin-bottom: 16px; border-bottom: 1px solid var(--p-content-border-color); padding-bottom: 12px; }
.wf-step { display: grid; grid-template-columns: 30px 1fr auto 150px; align-items: center; gap: 12px; background: var(--p-surface-ground); border: 1px solid var(--p-content-border-color); border-radius: 8px; padding: 12px 16px; }
.step-num { font-size: 1.1rem; font-weight: 900; color: var(--p-primary-color); }
.step-title { font-weight: 600; font-size: 0.88rem; color: var(--p-text-color); }
.step-desc  { font-size: 0.72rem; color: var(--p-text-muted-color); }
.step-amount { font-size: 1rem; font-weight: 700; text-align: right; min-width: 80px; }
.step-amount.blue   { color: var(--fst-blue); }
.step-amount.green  { color: var(--fst-green); }
.step-amount.purple { color: var(--fst-purple); }
.step-amount.orange { color: var(--fst-brand); }
.step-bar-wrap { display: flex; align-items: center; gap: 6px; }
.step-bar { height: 8px; border-radius: 4px; transition: width 0.4s; }
.step-pct { font-size: 0.72rem; color: var(--p-text-muted-color); white-space: nowrap; }

.result-table td, .result-table th { vertical-align: middle; }

.irr-scenarios { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; }
.irr-sc { background: var(--p-surface-ground); border: 1px solid var(--p-content-border-color); border-radius: 8px; padding: 14px; }
.irr-exit { font-size: 1.4rem; font-weight: 900; color: var(--p-primary-color); }
.irr-label { font-size: 0.75rem; color: var(--p-text-muted-color); margin: 2px 0 8px; }
.irr-val { font-size: 1.2rem; font-weight: 700; margin-bottom: 6px; }
.irr-bar-wrap { height: 6px; background: var(--p-content-border-color); border-radius: 3px; overflow: hidden; }
.irr-bar { height: 100%; border-radius: 3px; transition: width 0.4s; }

.modal-form { display: flex; flex-direction: column; gap: 8px; margin-bottom: 4px; }
.modal-form label { font-size: 0.78rem; color: var(--p-text-muted-color); }
.checkbox-label { display: flex; align-items: center; gap: 6px; font-size: 0.78rem; color: var(--p-text-muted-color); }

/* ── Mobile adaptive ── */
@media (max-width: 768px) {
  .wf-table { display: block; overflow-x: auto; -webkit-overflow-scrolling: touch; }
  .wf-table result-table { display: block; overflow-x: auto; -webkit-overflow-scrolling: touch; }
  .wf-inputs-grid { grid-template-columns: 1fr !important; }
  .wf-step { grid-template-columns: 1fr !important; gap: 4px; }
  .wf-step-dot { display: none; }
  .modal-box { width: calc(100vw - 20px) !important; max-width: 400px; }
}
</style>
