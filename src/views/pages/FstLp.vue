<template>
  <div class="lp-root">
    <div class="lp-header">
      <div class="lp-title-block">
        <h1>LP Dashboard</h1>
        <span class="lp-subtitle">Отчётность для партнёров с ограниченной ответственностью</span>
      </div>
      <div class="lp-actions">
        <button class="lp-btn secondary" @click="exportReport">Экспорт ILPA</button>
        <button class="lp-btn primary" @click="showCapCall = true">Кэпитал-колл</button>
      </div>
    </div>

    <!-- Сводная панель LP -->
    <div class="lp-summary-grid">
      <div class="lp-kpi" v-for="kpi in kpiCards" :key="kpi.label">
        <div class="lp-kpi-val" :class="kpi.color">
          <span v-if="loading" class="kpi-loading">…</span>
          <span v-else>{{ kpi.value }}</span>
        </div>
        <div class="lp-kpi-label">{{ kpi.label }}</div>
        <div class="lp-kpi-delta" :class="kpi.delta >= 0 ? 'up' : 'down'">
          {{ kpi.delta >= 0 ? '+' : '' }}{{ kpi.delta }}% к прошлому кварталу
        </div>
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
          <button class="lp-btn secondary" @click="showCapCall = false">Отмена</button>
          <button class="lp-btn primary" @click="sendCapCall">Отправить уведомление</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { getPortfolio, getLPPartners } from '@/services/fstApi'

const activeTab = ref('portfolio')
const showCapCall = ref(false)
const loading = ref(true)

const tabs = [
  { id: 'portfolio', label: 'Портфель' },
  { id: 'cashflow',  label: 'Cash Flow' },
  { id: 'fees',      label: 'Комиссии' },
  { id: 'esg',       label: 'ESG' }
]

const lpPartners = ref([])

const kpiCards = computed(() => [
  { label: 'Общий NAV, млн ₽',  value: totalNav.value ? Math.round(totalNav.value).toLocaleString('ru') : '0', color: 'blue',  delta: 0 },
  { label: 'TVPI',               value: totalContributions.value ? tvpi.value : '—',  color: 'green', delta: 0 },
  { label: 'Net IRR',            value: '—',    color: 'green', delta: 0 },
  { label: 'DPI',                value: totalContributions.value ? dpi.value : '—',   color: 'gray',  delta: 0 },
  { label: 'Взносы, млн ₽',     value: Math.round(totalContributions.value).toLocaleString('ru'), color: 'blue', delta: 0 },
  { label: 'Портфельных ко.',    value: String(portfolio.value.length), color: 'gray', delta: 0 }
])

const portfolio = ref([])

onMounted(async () => {
  try {
    const [portfolioRows, lpRows] = await Promise.all([getPortfolio(), getLPPartners()])
    portfolio.value = portfolioRows.map(r => ({
      name: r.name || '—', subfund: 'БАС',
      entryDate: r.updatedAt ? (() => { const p = r.updatedAt.match(/(\d{2})\.(\d{2})\.(\d{4})/); return p ? `${p[3]}-${p[2]}` : r.updatedAt.slice(0, 7); })() : '—',
      invested: 0, nav: r.kpi || 0, moic: 1.0,
      status: (r.riskStatusId && !['1119','1125','Одобрен','В работе'].includes(String(r.riskStatusId))) ? 'watch' : 'active'
    }))
    lpPartners.value = lpRows
    if (lpRows.length) {
      cashFlows.value = {
        contributions: lpRows.map(r => ({
          date: r.joinedAt?.slice(0, 7) || '—',
          amount: Math.round((r.paid || 0) / 1_000_000),
          note: r.organization || r.name || '—'
        })),
        distributions: []
      }
    }
  } catch (e) { console.warn('LP portfolio load failed', e) }
  finally { loading.value = false }
})

const cashFlows = ref({
  contributions: [],
  distributions: []
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
  background: var(--p-surface-ground);
}
.lp-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
}
.lp-title-block h1 { margin: 0; font-size: 1.5rem; color: var(--p-text-color); }
.lp-subtitle { font-size: 0.85rem; color: var(--p-text-muted-color); }
.lp-actions { display: flex; gap: 8px; }
.lp-btn { padding: 8px 16px; border-radius: 8px; border: none; cursor: pointer; font-size: 0.85rem; font-weight: 600; }
.lp-btn.primary  { background: var(--p-primary-color); color: #fff; }
.lp-btn.secondary{ background: var(--p-surface-card); color: var(--p-text-color); border: 1px solid var(--p-surface-border); }

.lp-summary-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 12px;
}
.lp-kpi {
  background: var(--p-content-background);
  border: 1px solid var(--p-surface-border);
  border-radius: 10px;
  padding: 14px 16px;
}
.lp-kpi-val { font-size: 1.5rem; font-weight: 700; }
.lp-kpi-val.blue  { color: var(--p-primary-color); }
.lp-kpi-val.green { color: #66bb6a; }
.lp-kpi-val.gray  { color: var(--p-text-color); }
.lp-kpi-label { font-size: 0.75rem; color: var(--p-text-muted-color); margin-top: 2px; }
.lp-kpi-delta { font-size: 0.72rem; margin-top: 4px; }
.lp-kpi-delta.up   { color: #66bb6a; }
.lp-kpi-delta.down { color: #ef5350; }

.lp-tabs { display: flex; gap: 4px; flex-wrap: wrap; }
.lp-tab { padding: 7px 16px; border-radius: 7px; border: 1px solid var(--p-surface-border); background: var(--p-surface-card); color: var(--p-text-muted-color); cursor: pointer; font-size: 0.85rem; }
.lp-tab.active { background: var(--p-primary-color); color: #fff; border-color: var(--p-primary-color); }

.lp-section { background: var(--p-content-background); border: 1px solid var(--p-surface-border); border-radius: 10px; padding: 20px; }
.lp-section h2 { margin: 0 0 16px; font-size: 1.1rem; color: var(--p-text-color); }

.lp-table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
.lp-table th { text-align: left; padding: 8px 10px; color: var(--p-text-muted-color); border-bottom: 1px solid var(--p-surface-border); font-weight: 600; font-size: 0.78rem; }
.lp-table td { padding: 9px 10px; border-bottom: 1px solid var(--p-surface-border); color: var(--p-text-color); }
.lp-table tr:last-child td { border: none; }
.co-name { font-weight: 600; }
.num { text-align: right; font-variant-numeric: tabular-nums; }
.green { color: #66bb6a; } .red { color: #ef5350; }

.badge { padding: 2px 8px; border-radius: 4px; font-size: 0.72rem; font-weight: 700; }
.badge.бас  { background: #1565c022; color: #1565c0; }
.badge.робо { background: #7b1fa222; color: #7b1fa2; }
.badge.мэ   { background: #1b5e2022; color: #2e7d32; }

.status-pill { padding: 2px 8px; border-radius: 4px; font-size: 0.72rem; }
.status-pill.active { background: #66bb6a22; color: #66bb6a; }
.status-pill.watch  { background: #ff980022; color: #f57c00; }
.status-pill.exit   { background: var(--p-surface-ground); color: var(--p-text-muted-color); }

.cf-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px; }
.cf-block { display: flex; flex-direction: column; gap: 8px; }
.cf-title { font-weight: 700; font-size: 0.9rem; color: var(--p-text-color); margin-bottom: 4px; }
.cf-row { display: flex; gap: 12px; font-size: 0.83rem; color: var(--p-text-color); }
.cf-amount { font-weight: 600; min-width: 80px; }
.cf-amount.contrib { color: #66bb6a; }
.cf-amount.distrib { color: #42a5f5; }
.cf-note { color: var(--p-text-muted-color); font-size: 0.78rem; }
.cf-total { margin-top: 8px; font-weight: 700; color: var(--p-text-color); font-size: 0.9rem; border-top: 1px solid var(--p-surface-border); padding-top: 6px; }
.cf-summary { display: flex; gap: 24px; flex-wrap: wrap; padding: 16px; background: var(--p-surface-ground); border-radius: 8px; }
.cf-sum-item { display: flex; flex-direction: column; gap: 4px; }
.cf-sum-item span { font-size: 0.75rem; color: var(--p-text-muted-color); }
.cf-sum-item strong { font-size: 1.1rem; font-weight: 700; color: var(--p-text-color); }

.fee-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin-bottom: 16px; }
.fee-card { background: var(--p-surface-ground); border: 1px solid var(--p-surface-border); border-radius: 8px; padding: 12px; }
.fee-label { font-weight: 700; font-size: 0.85rem; color: var(--p-text-color); }
.fee-rate  { font-size: 0.95rem; color: var(--p-primary-color); font-weight: 700; margin: 4px 0; }
.fee-amount{ font-size: 0.82rem; color: var(--p-text-color); }
.fee-note  { font-size: 0.72rem; color: var(--p-text-muted-color); margin-top: 4px; }
.fee-total-row { display: flex; justify-content: flex-end; gap: 12px; font-size: 0.9rem; color: var(--p-text-color); }

.esg-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 20px; }
.esg-card { background: var(--p-surface-ground); border: 1px solid var(--p-surface-border); border-radius: 8px; padding: 14px; text-align: center; }
.esg-score { font-size: 2rem; font-weight: 900; margin-bottom: 4px; }
.esg-a { color: #66bb6a; } .esg-b { color: #42a5f5; } .esg-c { color: #ff9800; }
.esg-label  { font-weight: 700; font-size: 0.85rem; color: var(--p-text-color); }
.esg-detail { font-size: 0.75rem; color: var(--p-text-muted-color); margin-top: 4px; }
.esg-compliance h3 { font-size: 0.95rem; margin: 0 0 10px; }
.compliance-row { display: flex; align-items: center; gap: 10px; padding: 7px 0; border-bottom: 1px solid var(--p-surface-border); font-size: 0.83rem; }
.compliance-icon { font-size: 0.9rem; font-weight: 700; width: 20px; text-align: center; border-radius: 50%; padding: 2px; }
.compliance-icon.ok   { color: #66bb6a; }
.compliance-icon.warn { color: #ff9800; }
.compliance-date { margin-left: auto; color: var(--p-text-muted-color); font-size: 0.75rem; }

.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 100; }
.modal-box { background: var(--p-content-background); border-radius: 12px; padding: 24px; width: 440px; max-width: 95vw; }
.modal-box h3 { margin: 0 0 16px; font-size: 1.1rem; }
.modal-form { display: flex; flex-direction: column; gap: 8px; margin-bottom: 16px; }
.modal-form label { font-size: 0.78rem; color: var(--p-text-muted-color); }
.modal-form input, .modal-form textarea {
  background: var(--p-surface-ground); border: 1px solid var(--p-surface-border);
  border-radius: 6px; padding: 7px 10px; color: var(--p-text-color); font-size: 0.85rem;
  width: 100%; resize: vertical;
}
.modal-actions { display: flex; gap: 8px; justify-content: flex-end; }
</style>
