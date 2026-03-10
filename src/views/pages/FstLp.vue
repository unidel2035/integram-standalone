<template>
  <FstPageLayout title="LP Dashboard" subtitle="Отчётность для партнёров с ограниченной ответственностью">
    <template #actions>
      <Button icon="pi pi-download" label="Экспорт ILPA" size="small" severity="secondary" @click="exportReport" />
      <Button icon="pi pi-send" label="Кэпитал-колл" size="small" severity="success" @click="showCapCall = true" />
    </template>

    <!-- ─── Metrics strip ─── -->
    <div class="lp-metrics fst-metrics-strip">
      <div class="fst-metric-item" v-for="kpi in kpiCards" :key="kpi.label">
        <i :class="kpi.icon" class="fst-metric-item-icon" :style="{ color: kpiColor(kpi.color) }"></i>
        <div class="fst-metric-item-val">{{ kpi.value }}</div>
        <div class="fst-metric-item-label">{{ kpi.label }}</div>
      </div>
    </div>

    <!-- Навигация по секциям -->
    <div class="lp-tabs">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        :class="['lp-tab', { active: activeTab === tab.id }]"
        @click="activeTab = tab.id"
      >{{ tab.label }}</button>
    </div>

    <!-- Портфельная аналитика -->
    <div v-if="activeTab === 'portfolio'" class="lp-section">
      <h2>Портфельные инвестиции</h2>
      <table class="lp-table">
        <thead>
          <tr>
            <th>Компания</th>
            <th>Субфонд</th>
            <th>Дата входа</th>
            <th>Инвестировано, млн ₽</th>
            <th>NAV, млн ₽</th>
            <th>MOIC</th>
            <th>Статус</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="co in portfolio" :key="co.name">
            <td class="co-name">{{ co.name }}</td>
            <td><span class="badge" :class="co.subfund.toLowerCase()">{{ co.subfund }}</span></td>
            <td>{{ co.entryDate }}</td>
            <td class="num">{{ co.invested }}</td>
            <td class="num">{{ co.nav }}</td>
            <td class="num" :class="co.moic >= 1 ? 'green' : 'red'">{{ co.moic }}x</td>
            <td><span class="status-pill" :class="co.status">{{ statusLabel(co.status) }}</span></td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Cash Flow Statement -->
    <div v-if="activeTab === 'cashflow'" class="lp-section">
      <h2>Движение капитала</h2>
      <div class="cf-grid">
        <div class="cf-block">
          <div class="cf-title">Взносы в капитал</div>
          <div v-for="cf in cashFlows.contributions" :key="cf.date" class="cf-row">
            <span>{{ cf.date }}</span>
            <span class="cf-amount contrib">+{{ cf.amount }} млн ₽</span>
            <span class="cf-note">{{ cf.note }}</span>
          </div>
          <div class="cf-total">Итого: {{ totalContributions }} млн ₽</div>
        </div>
        <div class="cf-block">
          <div class="cf-title">Выплаты дистрибуций</div>
          <div v-for="cf in cashFlows.distributions" :key="cf.date" class="cf-row">
            <span>{{ cf.date }}</span>
            <span class="cf-amount distrib">{{ cf.amount }} млн ₽</span>
            <span class="cf-note">{{ cf.note }}</span>
          </div>
          <div class="cf-total">Итого: {{ totalDistributions }} млн ₽</div>
        </div>
      </div>
      <div class="cf-summary">
        <div class="cf-sum-item">
          <span>DPI (Distributed / Paid-In)</span>
          <strong>{{ dpi }}</strong>
        </div>
        <div class="cf-sum-item">
          <span>RVPI (Residual Value / Paid-In)</span>
          <strong>{{ rvpi }}</strong>
        </div>
        <div class="cf-sum-item">
          <span>TVPI (Total Value / Paid-In)</span>
          <strong>{{ tvpi }}</strong>
        </div>
        <div class="cf-sum-item">
          <span>Net IRR</span>
          <strong class="green">{{ netIrr }}%</strong>
        </div>
      </div>
    </div>

    <!-- Fees & Expenses -->
    <div v-if="activeTab === 'fees'" class="lp-section">
      <h2>Комиссии и расходы</h2>
      <div class="fee-grid">
        <div class="fee-card" v-for="fee in feeItems" :key="fee.label">
          <div class="fee-label">{{ fee.label }}</div>
          <div class="fee-rate">{{ fee.rate }}</div>
          <div class="fee-amount">{{ fee.ytdAmount }} млн ₽ / год</div>
          <div class="fee-note">{{ fee.note }}</div>
        </div>
      </div>
      <div class="fee-total-row">
        <span>Итого расходов (LTD):</span>
        <strong>{{ totalFees }} млн ₽</strong>
      </div>
    </div>

    <!-- ESG / Compliance -->
    <div v-if="activeTab === 'esg'" class="lp-section">
      <h2>ESG & Соответствие</h2>
      <div class="esg-grid">
        <div class="esg-card" v-for="esg in esgMetrics" :key="esg.label">
          <div class="esg-score" :class="esgClass(esg.score)">{{ esg.score }}</div>
          <div class="esg-label">{{ esg.label }}</div>
          <div class="esg-detail">{{ esg.detail }}</div>
        </div>
      </div>
      <div class="esg-compliance">
        <h3>Регуляторное соответствие</h3>
        <div v-for="item in compliance" :key="item.name" class="compliance-row">
          <span class="compliance-icon" :class="item.ok ? 'ok' : 'warn'">{{ item.ok ? '✓' : '!' }}</span>
          <span class="compliance-name">{{ item.name }}</span>
          <span class="compliance-date">{{ item.date }}</span>
        </div>
      </div>
    </div>

    <!-- Capital Call Modal -->
    <div v-if="showCapCall" class="modal-overlay" @click.self="showCapCall = false">
      <div class="modal-box">
        <h3>Кэпитал-колл</h3>
        <div class="modal-form">
          <label>Сумма, млн ₽</label>
          <input v-model.number="capCall.amount" type="number" min="1" step="5" />
          <label>Дата исполнения</label>
          <input v-model="capCall.dueDate" type="date" />
          <label>Назначение</label>
          <textarea v-model="capCall.purpose" rows="3" placeholder="Цель привлечения капитала..."></textarea>
          <label>LP-уведомление</label>
          <textarea v-model="capCall.notice" rows="2" placeholder="Текст уведомления..."></textarea>
        </div>
        <div class="modal-actions">
          <Button label="Отмена" size="small" severity="secondary" @click="showCapCall = false" />
          <Button icon="pi pi-send" label="Отправить уведомление" size="small" severity="success" @click="sendCapCall" />
        </div>
      </div>
    </div>
  </FstPageLayout>
</template>

<script setup>
import { ref, computed } from 'vue'
import FstPageLayout from '@/components/fst-shared/FstPageLayout.vue'
import Button from 'primevue/button'

const activeTab = ref('portfolio')
const showCapCall = ref(false)

const tabs = [
  { id: 'portfolio', label: 'Портфель' },
  { id: 'cashflow',  label: 'Cash Flow' },
  { id: 'fees',      label: 'Комиссии' },
  { id: 'esg',       label: 'ESG' }
]

const kpiCards = ref([
  { label: 'Общий NAV, млн ₽', value: '2 840', color: 'blue',   delta: +8.4,  icon: 'pi pi-chart-line' },
  { label: 'TVPI',              value: '1.34x', color: 'green',  delta: +5.2,  icon: 'pi pi-arrow-up-right' },
  { label: 'Net IRR',           value: '22.7%', color: 'green',  delta: +1.8,  icon: 'pi pi-percentage' },
  { label: 'DPI',               value: '0.18x', color: 'cyan',   delta: +12.0, icon: 'pi pi-money-bill' },
  { label: 'Взносы, млн ₽',    value: '2 120', color: 'blue',   delta: 0,     icon: 'pi pi-dollar' },
  { label: 'Портфельных ко.',   value: '8',     color: 'purple', delta: +14.3, icon: 'pi pi-building' }
])

function kpiColor(c) {
  const map = {
    blue: 'var(--fst-blue)', green: 'var(--fst-green)',
    cyan: 'var(--fst-cyan)', purple: 'var(--fst-purple)',
    red: 'var(--fst-red)', brand: 'var(--fst-brand)',
    gray: 'var(--p-text-muted-color)'
  }
  return map[c] || 'var(--p-text-muted-color)'
}

const portfolio = ref([
  { name: 'АгроДрон',       subfund: 'БАС',  entryDate: '2024-03', invested: 180, nav: 265, moic: 1.47, status: 'active' },
  { name: 'RoboFarm',       subfund: 'РОБО', entryDate: '2024-06', invested: 120, nav: 198, moic: 1.65, status: 'active' },
  { name: 'МедТех БПЛА',    subfund: 'БАС',  entryDate: '2024-09', invested: 250, nav: 280, moic: 1.12, status: 'active' },
  { name: 'DroneLogistics', subfund: 'БАС',  entryDate: '2023-12', invested: 350, nav: 420, moic: 1.20, status: 'active' },
  { name: 'ЭнергоРобот',    subfund: 'МЭ',   entryDate: '2024-01', invested: 90,  nav:  74, moic: 0.82, status: 'watch'  },
  { name: 'CyberPilot',     subfund: 'БАС',  entryDate: '2023-06', invested: 200, nav: 310, moic: 1.55, status: 'active' },
  { name: 'НейроМат',       subfund: 'РОБО', entryDate: '2024-11', invested: 150, nav: 135, moic: 0.90, status: 'watch'  },
  { name: 'AeroSpace Rус',  subfund: 'БАС',  entryDate: '2024-04', invested: 780, nav: 958, moic: 1.23, status: 'active' }
])

const cashFlows = ref({
  contributions: [
    { date: '2023-Q2', amount: 500,  note: 'Первый взнос ГК и частные LP' },
    { date: '2023-Q4', amount: 420,  note: 'Кэпитал-колл #2' },
    { date: '2024-Q2', amount: 600,  note: 'Кэпитал-колл #3' },
    { date: '2024-Q4', amount: 600,  note: 'Кэпитал-колл #4' }
  ],
  distributions: [
    { date: '2024-Q3', amount: 180, note: 'Частичный выход DroneLogistics' },
    { date: '2024-Q4', amount: 200, note: 'Дивиденды АгроДрон' }
  ]
})

const totalContributions = computed(() =>
  cashFlows.value.contributions.reduce((s, c) => s + c.amount, 0)
)
const totalDistributions = computed(() =>
  cashFlows.value.distributions.reduce((s, c) => s + c.amount, 0)
)
const totalNav = computed(() => portfolio.value.reduce((s, c) => s + c.nav, 0))
const dpi   = computed(() => (totalDistributions.value / totalContributions.value).toFixed(2) + 'x')
const rvpi  = computed(() => (totalNav.value / totalContributions.value).toFixed(2) + 'x')
const tvpi  = computed(() => ((totalDistributions.value + totalNav.value) / totalContributions.value).toFixed(2) + 'x')
const netIrr = ref(22.7)

const feeItems = ref([
  { label: 'Management Fee', rate: '2.0% / год', ytdAmount: 42.4, note: 'от объёма взносов' },
  { label: 'Transaction Fee', rate: '1.5% / сделка', ytdAmount: 18.6, note: 'компенсируется за счёт MF' },
  { label: 'Monitoring Fee', rate: '0.5% / год', ytdAmount: 10.6, note: 'от NAV портфельных ко.' },
  { label: 'Carried Interest',  rate: '20% / 8% hurdle', ytdAmount: 0, note: 'Не начислен — ниже hurdle' },
  { label: 'Fund Expenses', rate: 'факт.', ytdAmount: 6.2, note: 'Аудит, юр., compliance' }
])
const totalFees = computed(() => feeItems.value.reduce((s, f) => s + f.ytdAmount, 0).toFixed(1))

const esgMetrics = ref([
  { label: 'E — Экология', score: 'B+', detail: 'Низкий углеродный след БПЛА vs авто' },
  { label: 'S — Социум',   score: 'A-', detail: '340 рабочих мест в технопарках' },
  { label: 'G — Управление', score: 'A', detail: 'ILPA-стандарт, аудит Ernst&Young' }
])

const compliance = ref([
  { name: 'ФЗ-156 Инвест. фонды', ok: true,  date: 'Проверен 2025-12' },
  { name: 'ILPA Principles 3.0',  ok: true,  date: 'Сертифицирован 2025-06' },
  { name: 'AML/KYC LP-партнёры',  ok: true,  date: 'Обновлено 2026-01' },
  { name: 'Отчёт ЦБ РФ (ЗПИФ)',  ok: true,  date: 'Подан 2026-02' },
  { name: 'GIPS Performance',    ok: false, date: 'Ожидается 2026-06' }
])

const capCall = ref({ amount: 100, dueDate: '', purpose: '', notice: '' })

function statusLabel(s) {
  return { active: 'Активна', watch: 'Наблюдение', exit: 'Выход' }[s] || s
}

function esgClass(score) {
  if (score.startsWith('A')) return 'esg-a'
  if (score.startsWith('B')) return 'esg-b'
  return 'esg-c'
}

function exportReport() {
  const rows = [
    ['Компания','Субфонд','Инвестировано','NAV','MOIC','Статус'],
    ...portfolio.value.map(c => [c.name, c.subfund, c.invested, c.nav, c.moic, statusLabel(c.status)])
  ]
  const csv = rows.map(r => r.join(',')).join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = 'lp-report.csv'; a.click()
  URL.revokeObjectURL(url)
}

function sendCapCall() {
  alert(`Кэпитал-колл на ${capCall.value.amount} млн ₽ отправлен LP-партнёрам`)
  showCapCall.value = false
}
</script>

<style scoped>
.lp-root {
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  min-height: 100vh;
  background: var(--surface-ground);
}
.lp-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
}
.lp-title-block h1 { margin: 0; font-size: 1rem; font-weight: 600; color: var(--p-text-color); }
.lp-subtitle { font-size: 0.8rem; color: var(--p-text-muted-color); }
.lp-actions { display: flex; gap: 8px; }
.lp-btn { padding: 8px 16px; border-radius: 8px; border: none; cursor: pointer; font-size: 0.85rem; font-weight: 600; }
.lp-btn.primary  { background: var(--p-primary-color); color: #fff; }
.lp-btn.secondary{ background: var(--surface-card); color: var(--p-text-color); border: 1px solid var(--surface-border); }

.lp-summary-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 12px;
}
.lp-kpi {
  background: var(--surface-card);
  border: 1px solid var(--surface-border);
  border-radius: 10px;
  padding: 14px 16px;
}
.lp-kpi-val { font-size: 2rem; font-weight: 700; }
.lp-kpi-val.blue  { color: var(--p-primary-color); }
.lp-kpi-val.green { color: var(--fst-green); }
.lp-kpi-val.gray  { color: var(--p-text-color); }
.lp-kpi-label { font-size: 0.75rem; color: var(--p-text-muted-color); margin-top: 2px; }
.lp-kpi-delta { font-size: 0.72rem; margin-top: 4px; }
.lp-kpi-delta.up   { color: var(--fst-green); }
.lp-kpi-delta.down { color: var(--fst-red); }

.lp-tabs { display: flex; gap: 4px; flex-wrap: wrap; }
.lp-tab { padding: 7px 16px; border-radius: 8px; border: 1px solid var(--surface-border); background: var(--surface-card); color: var(--p-text-muted-color); cursor: pointer; font-size: 0.85rem; }
.lp-tab.active { background: var(--p-primary-color); color: #fff; border-color: var(--p-primary-color); }

.lp-section { background: var(--surface-card); border: 1px solid var(--surface-border); border-radius: 10px; padding: 20px; }
.lp-section h2 { margin: 0 0 16px; font-size: 1.1rem; color: var(--p-text-color); }

.lp-table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
.lp-table th { text-align: left; padding: 8px 10px; color: var(--p-text-muted-color); border-bottom: 1px solid var(--surface-border); font-weight: 600; font-size: 0.78rem; }
.lp-table td { padding: 9px 10px; border-bottom: 1px solid var(--surface-border); color: var(--p-text-color); }
.lp-table tr:last-child td { border: none; }
.co-name { font-weight: 600; }
.num { text-align: right; font-variant-numeric: tabular-nums; }
.green { color: var(--fst-green); } .red { color: var(--fst-red); }

.badge { padding: 2px 8px; border-radius: 4px; font-size: 0.72rem; font-weight: 700; }
.badge.бас  { background: color-mix(in srgb, var(--fst-blue) 12%, transparent); color: var(--fst-blue); }
.badge.робо { background: color-mix(in srgb, var(--fst-purple) 12%, transparent); color: var(--fst-purple); }
.badge.мэ   { background: color-mix(in srgb, var(--fst-green) 12%, transparent); color: var(--fst-green); }

.status-pill { padding: 2px 8px; border-radius: 4px; font-size: 0.72rem; }
.status-pill.active { background: color-mix(in srgb, var(--fst-green) 12%, transparent); color: var(--fst-green); }
.status-pill.watch  { background: color-mix(in srgb, var(--fst-brand) 12%, transparent); color: var(--fst-brand); }
.status-pill.exit   { background: var(--surface-ground); color: var(--p-text-muted-color); }

.cf-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 16px; border-bottom: 1px solid var(--p-content-border-color); padding-bottom: 12px; }
.cf-block { display: flex; flex-direction: column; gap: 8px; }
.cf-title { font-weight: 700; font-size: 0.9rem; color: var(--p-text-color); margin-bottom: 4px; }
.cf-row { display: flex; gap: 12px; font-size: 0.83rem; color: var(--p-text-color); }
.cf-amount { font-weight: 600; min-width: 80px; }
.cf-amount.contrib { color: var(--fst-green); }
.cf-amount.distrib { color: var(--fst-blue); }
.cf-note { color: var(--p-text-muted-color); font-size: 0.78rem; }
.cf-total { margin-top: 8px; font-weight: 700; color: var(--p-text-color); font-size: 0.9rem; border-top: 1px solid var(--surface-border); padding-top: 6px; }
.cf-summary { display: flex; gap: 24px; flex-wrap: wrap; padding: 16px; background: var(--surface-ground); border-radius: 8px; }
.cf-sum-item { display: flex; flex-direction: column; gap: 4px; }
.cf-sum-item span { font-size: 0.75rem; color: var(--p-text-muted-color); }
.cf-sum-item strong { font-size: 1.1rem; font-weight: 700; color: var(--p-text-color); }

.fee-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin-bottom: 16px; }
.fee-card { background: var(--surface-ground); border: 1px solid var(--surface-border); border-radius: 8px; padding: 12px; }
.fee-label { font-weight: 700; font-size: 0.85rem; color: var(--p-text-color); }
.fee-rate  { font-size: 0.95rem; color: var(--p-primary-color); font-weight: 700; margin: 4px 0; }
.fee-amount{ font-size: 0.82rem; color: var(--p-text-color); }
.fee-note  { font-size: 0.72rem; color: var(--p-text-muted-color); margin-top: 4px; }
.fee-total-row { display: flex; justify-content: flex-end; gap: 12px; font-size: 0.9rem; color: var(--p-text-color); }

.esg-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 20px; }
.esg-card { background: var(--surface-ground); border: 1px solid var(--surface-border); border-radius: 8px; padding: 14px; text-align: center; }
.esg-score { font-size: 2rem; font-weight: 900; margin-bottom: 4px; }
.esg-a { color: var(--fst-green); } .esg-b { color: var(--fst-blue); } .esg-c { color: var(--fst-brand); }
.esg-label  { font-weight: 700; font-size: 0.85rem; color: var(--p-text-color); }
.esg-detail { font-size: 0.75rem; color: var(--p-text-muted-color); margin-top: 4px; }
.esg-compliance h3 { font-size: 0.95rem; margin: 0 0 10px; }
.compliance-row { display: flex; align-items: center; gap: 10px; padding: 7px 0; border-bottom: 1px solid var(--surface-border); font-size: 0.83rem; }
.compliance-icon { font-size: 0.9rem; font-weight: 700; width: 20px; text-align: center; border-radius: 50%; padding: 2px; }
.compliance-icon.ok   { color: var(--fst-green); }
.compliance-icon.warn { color: var(--fst-brand); }
.compliance-date { margin-left: auto; color: var(--p-text-muted-color); font-size: 0.75rem; }

.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 100; }
.modal-box { background: var(--surface-card); border-radius: 12px; padding: 24px; width: 440px; max-width: 95vw; }
.modal-box h3 { margin: 0 0 16px; font-size: 1.1rem; }
.modal-form { display: flex; flex-direction: column; gap: 8px; margin-bottom: 16px; }
.modal-form label { font-size: 0.78rem; color: var(--p-text-muted-color); }
.modal-form input, .modal-form textarea {
  background: var(--surface-ground); border: 1px solid var(--surface-border);
  border-radius: 6px; padding: 7px 10px; color: var(--p-text-color); font-size: 0.85rem;
  width: 100%; resize: vertical;
}
.modal-actions { display: flex; gap: 8px; justify-content: flex-end; }

/* — Unified page title — */
.lp-header h1 { margin: 0; font-size: 1rem; font-weight: 600; color: var(--p-text-color); line-height: 1.3; }

/* ── Mobile adaptive ── */
@media (max-width: 768px) {
  .lp-table { display: block; overflow-x: auto; -webkit-overflow-scrolling: touch; }
  .lp-summary-grid { flex-wrap: wrap; gap: 8px; }
  .lp-kpi { flex-wrap: wrap; gap: 8px; }
  .lp-tabs { overflow-x: auto; -webkit-overflow-scrolling: touch; flex-wrap: nowrap; }
  .lp-tabs > * { flex-shrink: 0; font-size: 0.8rem; }
  .lp-summary-grid { grid-template-columns: 1fr !important; }
  .cf-grid { grid-template-columns: 1fr !important; }

  .lp-table { display: block; overflow-x: auto; -webkit-overflow-scrolling: touch; }
}
</style>
