<template>
  <FstPageLayout title="Cap Table" subtitle="Реестр прав и конвертационные сценарии">
    <template #actions>
      <Select v-model="selectedCompany" :options="companies" optionLabel="name" optionValue="id" size="small" />
      <Button icon="pi pi-download" label="Экспорт CSV" size="small" severity="secondary" @click="exportCsv" />
      <Button icon="pi pi-plus" label="Раунд" size="small" severity="success" @click="showAddRound = true" />
    </template>

    <!-- ─── Metrics strip ─── -->
    <div class="ct-metrics fst-metrics-strip">
      <div class="fst-metric-item">
        <i class="pi pi-copy fst-metric-item-icon" style="color:var(--fst-blue)"></i>
        <div class="fst-metric-item-val">{{ (totalShares / 1000000).toFixed(2) }}M</div>
        <div class="fst-metric-item-label">Акций FD</div>
      </div>
      <div class="fst-metric-item">
        <i class="pi pi-chart-line fst-metric-item-icon" style="color:var(--fst-green)"></i>
        <div class="fst-metric-item-val">{{ currentValuation }} млн</div>
        <div class="fst-metric-item-label">Оценка</div>
      </div>
      <div class="fst-metric-item">
        <i class="pi pi-dollar fst-metric-item-icon" style="color:var(--fst-cyan)"></i>
        <div class="fst-metric-item-val">{{ pricePerShare }} ₽</div>
        <div class="fst-metric-item-label">Цена акции</div>
      </div>
      <div class="fst-metric-item">
        <i class="pi pi-percentage fst-metric-item-icon" style="color:var(--fst-brand)"></i>
        <div class="fst-metric-item-val">{{ optionPool }}%</div>
        <div class="fst-metric-item-label">Option Pool</div>
      </div>
      <div class="fst-metric-item">
        <i class="pi pi-users fst-metric-item-icon" style="color:var(--fst-purple)"></i>
        <div class="fst-metric-item-val">{{ currentCaptable.length }}</div>
        <div class="fst-metric-item-label">Акционеров</div>
      </div>
      <div class="fst-metric-item">
        <i class="pi pi-wallet fst-metric-item-icon" style="color:var(--fst-green)"></i>
        <div class="fst-metric-item-val">{{ totalInvested }} млн</div>
        <div class="fst-metric-item-label">Вложено</div>
      </div>
    </div>

    <!-- Tabs -->
    <div class="ct-tabs">
      <button v-for="t in tabs" :key="t.id" :class="['ct-tab', { active: activeTab === t.id }]" @click="activeTab = t.id">{{ t.label }}</button>
    </div>

    <!-- Cap Table -->
    <div v-if="activeTab === 'captable'" class="ct-section">
      <table class="ct-table">
        <thead>
          <tr>
            <th>Акционер</th>
            <th>Тип</th>
            <th>Акции (basic)</th>
            <th>Варранты/Опционы</th>
            <th>FD акции</th>
            <th>Доля FD</th>
            <th>Вложено, млн ₽</th>
            <th>Раунд входа</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="sh in currentCaptable" :key="sh.name" :class="{ highlight: sh.type === 'ФСТ НТИ' }">
            <td class="sh-name">{{ sh.name }}</td>
            <td><span class="type-badge" :class="sh.typeClass">{{ sh.type }}</span></td>
            <td class="num">{{ sh.basic.toLocaleString('ru') }}</td>
            <td class="num">{{ sh.warrants.toLocaleString('ru') }}</td>
            <td class="num bold">{{ sh.fd.toLocaleString('ru') }}</td>
            <td class="num">
              <div class="share-bar-wrap">
                <div class="share-bar" :style="{ width: sh.fdPct + '%' }"></div>
                <span>{{ sh.fdPct.toFixed(2) }}%</span>
              </div>
            </td>
            <td class="num">{{ sh.invested }}</td>
            <td class="round-badge">{{ sh.round }}</td>
          </tr>
        </tbody>
        <tfoot>
          <tr>
            <td colspan="2"><strong>Итого</strong></td>
            <td class="num bold">{{ totalBasic.toLocaleString('ru') }}</td>
            <td class="num bold">{{ totalWarrants.toLocaleString('ru') }}</td>
            <td class="num bold">{{ totalShares.toLocaleString('ru') }}</td>
            <td class="num bold">100.00%</td>
            <td class="num bold">{{ totalInvested }}</td>
            <td></td>
          </tr>
        </tfoot>
      </table>
    </div>

    <!-- Dilution Scenarios -->
    <div v-if="activeTab === 'dilution'" class="ct-section">
      <h2>Анализ разводнения</h2>
      <div class="dilution-controls">
        <div class="ctrl-group">
          <label>Размер нового раунда, млн ₽</label>
          <input v-model.number="newRound.amount" type="number" min="0" step="10" @input="calcDilution" />
        </div>
        <div class="ctrl-group">
          <label>Pre-money оценка, млн ₽</label>
          <input v-model.number="newRound.preMoney" type="number" min="0" step="50" @input="calcDilution" />
        </div>
        <div class="ctrl-group">
          <label>Расширение option pool, %</label>
          <input v-model.number="newRound.poolExpansion" type="number" min="0" max="20" step="0.5" @input="calcDilution" />
        </div>
      </div>
      <div class="dilution-result">
        <div class="dil-stat">
          <span>Post-money оценка</span>
          <strong>{{ postMoney }} млн ₽</strong>
        </div>
        <div class="dil-stat">
          <span>Новые акции</span>
          <strong>{{ newShares.toLocaleString('ru') }}</strong>
        </div>
        <div class="dil-stat">
          <span>Доля нового инвестора</span>
          <strong>{{ newInvestorPct }}%</strong>
        </div>
        <div class="dil-stat">
          <span>Разводнение ФСТ НТИ</span>
          <strong class="warn">-{{ fstDilution }}%</strong>
        </div>
      </div>
      <table class="ct-table dil-table">
        <thead>
          <tr>
            <th>Акционер</th>
            <th>До раунда</th>
            <th>После раунда</th>
            <th>Изменение</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in dilutedTable" :key="row.name">
            <td>{{ row.name }}</td>
            <td class="num">{{ row.before.toFixed(2) }}%</td>
            <td class="num">{{ row.after.toFixed(2) }}%</td>
            <td class="num" :class="row.delta < 0 ? 'red' : 'green'">{{ row.delta.toFixed(2) }}%</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Liquidation Preference -->
    <div v-if="activeTab === 'liquidity'" class="ct-section">
      <h2>Ликвидационная очерёдность</h2>
      <div class="lp-controls">
        <div class="ctrl-group">
          <label>Выручка от продажи, млн ₽</label>
          <input v-model.number="exitAmount" type="number" min="0" step="100" @input="calcLiqPref" />
        </div>
      </div>
      <div class="liq-waterfall">
        <div v-for="step in liqSteps" :key="step.name" class="liq-step">
          <div class="liq-rank">{{ step.rank }}</div>
          <div class="liq-info">
            <div class="liq-name">{{ step.name }}</div>
            <div class="liq-type">{{ step.prefType }}</div>
          </div>
          <div class="liq-amounts">
            <div class="liq-pref">Преф: {{ step.prefAmount }} млн ₽</div>
            <div class="liq-gets">Получает: <strong :class="step.gets > 0 ? 'green' : 'gray'">{{ step.gets }} млн ₽</strong></div>
          </div>
        </div>
      </div>
      <div class="liq-summary">
        <div>Остаток для common: <strong>{{ commonRemainder }} млн ₽</strong></div>
        <div>Return multiple ФСТ: <strong>{{ fstMultiple }}x</strong></div>
      </div>
    </div>

    <!-- Add Round Modal -->
    <div v-if="showAddRound" class="modal-overlay" @click.self="showAddRound = false">
      <div class="modal-box">
        <h3>Добавить раунд</h3>
        <div class="modal-form">
          <label>Инвестор</label>
          <input v-model="newEntry.name" placeholder="Название инвестора" />
          <label>Тип</label>
          <select v-model="newEntry.type">
            <option>Венчурный фонд</option>
            <option>ФСТ НТИ</option>
            <option>Основатель</option>
            <option>Бизнес-ангел</option>
            <option>Корпорат</option>
          </select>
          <label>Раунд</label>
          <input v-model="newEntry.round" placeholder="Seed / A / B..." />
          <label>Инвестировано, млн ₽</label>
          <input v-model.number="newEntry.invested" type="number" step="5" />
          <label>Pre-money оценка, млн ₽</label>
          <input v-model.number="newEntry.preMoney" type="number" step="50" />
        </div>
        <div class="modal-actions">
          <Button label="Отмена" size="small" severity="secondary" @click="showAddRound = false" />
          <Button icon="pi pi-plus" label="Добавить" size="small" severity="success" @click="addRound" />
        </div>
      </div>
    </div>
  </FstPageLayout>
</template>

<script setup>
import { ref, computed } from 'vue'
import FstPageLayout from '@/components/fst-shared/FstPageLayout.vue'
import Button from 'primevue/button'
import Select from 'primevue/select'

const activeTab = ref('captable')
const showAddRound = ref(false)
const selectedCompany = ref('agrodr')

const tabs = [
  { id: 'captable',  label: 'Cap Table' },
  { id: 'dilution',  label: 'Разводнение' },
  { id: 'liquidity', label: 'Ликв. преф.' }
]

const companies = ref([
  { id: 'agrodr', name: 'АгроДрон' },
  { id: 'robofarm', name: 'RoboFarm' },
  { id: 'medtech', name: 'МедТех БПЛА' }
])

const captables = {
  agrodr: [
    { name: 'Основатели',         type: 'Основатели',     typeClass: 'founder',  basic: 5000000, warrants: 0,      round: 'Seed', invested: 0    },
    { name: 'ФСТ НТИ (БАС)',      type: 'ФСТ НТИ',        typeClass: 'fst',      basic: 1800000, warrants: 200000, round: 'A',    invested: 180  },
    { name: 'Сколково Ventures',  type: 'Венч. фонд',     typeClass: 'vc',       basic: 1000000, warrants: 100000, round: 'A',    invested: 100  },
    { name: 'ВЭБ.РФ',             type: 'Корпорат',       typeClass: 'corp',     basic: 600000,  warrants: 0,      round: 'B',    invested: 90   },
    { name: 'ESOP',               type: 'Сотрудники',     typeClass: 'esop',     basic: 0,       warrants: 700000, round: '—',    invested: 0    },
    { name: 'Конвертируемые ноты', type: 'Конв. долг',    typeClass: 'debt',     basic: 0,       warrants: 400000, round: 'Seed', invested: 40   }
  ]
}

const currentCaptable = computed(() => {
  const rows = captables[selectedCompany.value] || []
  const total = rows.reduce((s, r) => s + r.basic + r.warrants, 0)
  return rows.map(r => ({
    ...r,
    fd: r.basic + r.warrants,
    fdPct: total > 0 ? (r.basic + r.warrants) / total * 100 : 0
  }))
})

const totalBasic    = computed(() => currentCaptable.value.reduce((s, r) => s + r.basic, 0))
const totalWarrants = computed(() => currentCaptable.value.reduce((s, r) => s + r.warrants, 0))
const totalShares   = computed(() => totalBasic.value + totalWarrants.value)
const totalInvested = computed(() => currentCaptable.value.reduce((s, r) => s + r.invested, 0))
const currentValuation = ref(1250)
const pricePerShare = computed(() => (currentValuation.value * 1e6 / totalShares.value).toFixed(2))
const optionPool = ref(7.6)

const newRound = ref({ amount: 200, preMoney: 1500, poolExpansion: 2 })
const postMoney = computed(() => newRound.value.preMoney + newRound.value.amount)
const newInvestorPct = computed(() => (newRound.value.amount / postMoney.value * 100).toFixed(2))
const newShares = computed(() => Math.round(totalShares.value * newRound.value.amount / newRound.value.preMoney))
const fstRow = computed(() => currentCaptable.value.find(r => r.name.includes('ФСТ')))
const fstPctBefore = computed(() => fstRow.value?.fdPct ?? 0)
const fstPctAfter  = computed(() => fstPctBefore.value * newRound.value.preMoney / postMoney.value)
const fstDilution  = computed(() => (fstPctBefore.value - fstPctAfter.value).toFixed(2))

const dilutedTable = computed(() => {
  const factor = newRound.value.preMoney / postMoney.value
  const result = currentCaptable.value.map(r => ({
    name: r.name,
    before: r.fdPct,
    after: r.fdPct * factor,
    delta: r.fdPct * factor - r.fdPct
  }))
  result.push({
    name: 'Новый инвестор',
    before: 0,
    after: parseFloat(newInvestorPct.value),
    delta: parseFloat(newInvestorPct.value)
  })
  return result
})

function calcDilution() {}

const exitAmount = ref(1500)
const liqSteps = computed(() => {
  let remaining = exitAmount.value
  const steps = [
    { rank: '1', name: 'ФСТ НТИ (1x non-part.)', prefType: '1x non-participating', prefAmount: 180 },
    { rank: '2', name: 'Сколково Ventures (1x)', prefType: '1x non-participating', prefAmount: 100 },
    { rank: '3', name: 'ВЭБ.РФ (1x part.)',       prefType: '1x participating',     prefAmount: 90  }
  ]
  return steps.map(s => {
    const gets = Math.min(remaining, s.prefAmount)
    remaining -= gets
    return { ...s, gets }
  })
})
const commonRemainder = computed(() => {
  return Math.max(0, exitAmount.value - liqSteps.value.reduce((s, s2) => s + s2.gets, 0))
})
const fstMultiple = computed(() => {
  const fstGets = liqSteps.value.find(s => s.name.includes('ФСТ'))?.gets ?? 0
  const fstInv = fstRow.value?.invested ?? 180
  return fstInv > 0 ? (fstGets / fstInv).toFixed(2) : '—'
})
function calcLiqPref() {}

const newEntry = ref({ name: '', type: 'Венчурный фонд', round: 'B', invested: 100, preMoney: 1500 })
function addRound() {
  alert(`Добавлен инвестор ${newEntry.value.name} с вложением ${newEntry.value.invested} млн ₽`)
  showAddRound.value = false
}

function exportCsv() {
  const rows = [
    ['Акционер','Тип','Акции basic','Варранты','FD','Доля FD %','Инвестировано млн ₽'],
    ...currentCaptable.value.map(r => [r.name, r.type, r.basic, r.warrants, r.fd, r.fdPct.toFixed(2), r.invested])
  ]
  const csv = rows.map(r => r.join(',')).join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = 'captable.csv'; a.click()
  URL.revokeObjectURL(url)
}
</script>

<style scoped>
.ct-root { padding: 24px; display: flex; flex-direction: column; gap: 20px; min-height: 100vh; background: var(--surface-ground); }
.ct-header { display: flex; align-items: flex-start; justify-content: space-between; flex-wrap: wrap; gap: 12px; }
.ct-header h1 { margin: 0; font-size: 1rem; font-weight: 600; color: var(--p-text-color); }
.ct-subtitle { font-size: 0.8rem; color: var(--p-text-muted-color); }
.ct-actions { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.ct-btn { padding: 8px 14px; border-radius: 8px; border: none; cursor: pointer; font-size: 0.875rem; font-weight: 600; }
.ct-btn.primary  { background: var(--p-primary-color); color: #fff; }
.ct-btn.secondary{ background: var(--surface-card); color: var(--p-text-color); border: 1px solid var(--surface-border); }
.ct-select { padding: 7px 10px; border-radius: 8px; border: 1px solid var(--surface-border); background: var(--surface-card); color: var(--p-text-color); font-size: 0.83rem; }

.ct-summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; }
.ct-sum-card { background: var(--surface-card); border: 1px solid var(--surface-border); border-radius: 10px; padding: 14px; }
.ct-sum-val { font-size: 1.4rem; font-weight: 700; color: var(--p-primary-color); }
.ct-sum-lbl { font-size: 0.75rem; color: var(--p-text-muted-color); margin-top: 2px; }

.ct-tabs { display: flex; gap: 4px; }
.ct-tab { padding: 7px 16px; border-radius: 8px; border: 1px solid var(--surface-border); background: var(--surface-card); color: var(--p-text-muted-color); cursor: pointer; font-size: 0.85rem; }
.ct-tab.active { background: var(--p-primary-color); color: #fff; border-color: var(--p-primary-color); }

.ct-section { background: var(--surface-card); border: 1px solid var(--surface-border); border-radius: 10px; padding: 20px; overflow-x: auto; }
.ct-section h2 { margin: 0 0 16px; font-size: 1.05rem; color: var(--p-text-color); }

.ct-table { width: 100%; border-collapse: collapse; font-size: 0.83rem; min-width: 700px; }
.ct-table th { padding: 8px 10px; text-align: left; color: var(--p-text-muted-color); border-bottom: 1px solid var(--surface-border); font-size: 0.75rem; font-weight: 600; }
.ct-table td { padding: 9px 10px; border-bottom: 1px solid var(--surface-border); color: var(--p-text-color); }
.ct-table tfoot td { border-top: 2px solid var(--surface-border); border-bottom: none; background: var(--surface-ground); }
.ct-table tr.highlight { background: var(--p-primary-50, rgba(99,102,241,0.04)); }
.sh-name { font-weight: 600; }
.num { text-align: right; font-variant-numeric: tabular-nums; }
.bold { font-weight: 700; }
.green { color: var(--fst-green); } .red { color: var(--fst-red); } .warn { color: var(--fst-brand); } .gray { color: var(--p-text-muted-color); }

.type-badge { padding: 2px 7px; border-radius: 4px; font-size: 0.7rem; font-weight: 600; white-space: nowrap; }
.type-badge.founder { background: color-mix(in srgb, var(--fst-blue) 12%, transparent); color: var(--fst-blue); }
.type-badge.fst     { background: var(--p-primary-color); color: #fff; }
.type-badge.vc      { background: color-mix(in srgb, var(--fst-purple) 12%, transparent); color: var(--fst-purple); }
.type-badge.corp    { background: color-mix(in srgb, var(--fst-green) 12%, transparent); color: var(--fst-green); }
.type-badge.esop    { background: color-mix(in srgb, var(--fst-brand) 12%, transparent); color: var(--fst-brand); }
.type-badge.debt    { background: color-mix(in srgb, var(--p-text-muted-color) 12%, transparent); color: var(--p-text-muted-color); }

.round-badge { font-size: 0.75rem; color: var(--p-text-muted-color); }

.share-bar-wrap { display: flex; align-items: center; gap: 6px; }
.share-bar { height: 6px; background: var(--p-primary-color); border-radius: 3px; min-width: 2px; max-width: 60px; }

.dilution-controls, .lp-controls { display: flex; gap: 16px; flex-wrap: wrap; margin-bottom: 16px; }
.ctrl-group { display: flex; flex-direction: column; gap: 4px; flex: 1; min-width: 140px; }
.ctrl-group label { font-size: 0.75rem; color: var(--p-text-muted-color); }
.ctrl-group input { background: var(--surface-ground); border: 1px solid var(--surface-border); border-radius: 6px; padding: 6px 10px; color: var(--p-text-color); font-size: 0.85rem; }

.dilution-result { display: flex; gap: 20px; flex-wrap: wrap; padding: 14px; background: var(--surface-ground); border-radius: 8px; margin-bottom: 16px; }
.dil-stat { display: flex; flex-direction: column; gap: 2px; }
.dil-stat span { font-size: 0.72rem; color: var(--p-text-muted-color); }
.dil-stat strong { font-size: 1.1rem; font-weight: 700; }

.dil-table { margin-top: 12px; }

.liq-waterfall { display: flex; flex-direction: column; gap: 8px; margin: 16px 0; }
.liq-step { display: flex; align-items: center; gap: 14px; background: var(--surface-ground); border: 1px solid var(--surface-border); border-radius: 8px; padding: 12px 16px; }
.liq-rank { font-size: 1.2rem; font-weight: 900; color: var(--p-primary-color); width: 24px; }
.liq-info { flex: 1; }
.liq-name { font-weight: 600; font-size: 0.9rem; color: var(--p-text-color); }
.liq-type { font-size: 0.72rem; color: var(--p-text-muted-color); }
.liq-amounts { text-align: right; font-size: 0.82rem; }
.liq-pref { color: var(--p-text-muted-color); }
.liq-summary { display: flex; gap: 24px; padding: 12px 16px; background: var(--surface-ground); border-radius: 8px; font-size: 0.85rem; color: var(--p-text-color); }

.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 100; }
.modal-box { background: var(--surface-card); border-radius: 12px; padding: 24px; width: 400px; max-width: 95vw; }
.modal-box h3 { margin: 0 0 16px; font-size: 1.05rem; }
.modal-form { display: flex; flex-direction: column; gap: 8px; margin-bottom: 16px; }
.modal-form label { font-size: 0.75rem; color: var(--p-text-muted-color); }
.modal-form input, .modal-form select { background: var(--surface-ground); border: 1px solid var(--surface-border); border-radius: 6px; padding: 7px 10px; color: var(--p-text-color); font-size: 0.85rem; width: 100%; }
.modal-actions { display: flex; gap: 8px; justify-content: flex-end; }

/* ── Mobile adaptive ── */
@media (max-width: 768px) {
  .ct-table { display: block; overflow-x: auto; -webkit-overflow-scrolling: touch; }
  .ct-table dil-table { display: block; overflow-x: auto; -webkit-overflow-scrolling: touch; }
  .ct-summary { flex-wrap: wrap; gap: 8px; }
  .liq-summary { flex-wrap: wrap; gap: 8px; }
  .ct-tabs { overflow-x: auto; -webkit-overflow-scrolling: touch; flex-wrap: nowrap; }
  .ct-tabs > * { flex-shrink: 0; font-size: 0.8rem; }
  .ct-summary { grid-template-columns: 1fr !important; }
}
</style>
