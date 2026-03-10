<template>
  <FstPageLayout title="ILPA Отчётность" subtitle="Отчёты в стандарте ILPA Principles 3.0 для институциональных инвесторов">
    <template #actions>
      <select v-model="selectedQuarter" class="ilpa-select" @change="loadReport">
          <option v-for="q in quarters" :key="q" :value="q">{{ q }}</option>
        </select>
        <button class="ilpa-btn secondary" @click="generatePdf">Сформировать PDF</button>
        <button class="ilpa-btn primary" @click="sendToLps">Отправить LP</button>
    </template>

    <!-- Статус отчётности -->
    <div class="ilpa-status-bar">
      <div v-for="s in reportStatus" :key="s.label" class="ilpa-status-item">
        <div class="status-icon" :class="s.status">{{ s.status === 'done' ? '✓' : s.status === 'progress' ? '◐' : '○' }}</div>
        <div class="status-label">{{ s.label }}</div>
        <div class="status-date">{{ s.date }}</div>
      </div>
    </div>

    <!-- Навигация секций -->
    <div class="ilpa-tabs">
      <button v-for="t in tabs" :key="t.id" :class="['ilpa-tab', { active: activeTab === t.id }]" @click="activeTab = t.id">
        {{ t.label }}
      </button>
    </div>

    <!-- ILPA Capital Account Statement -->
    <div v-if="activeTab === 'capital'" class="ilpa-section">
      <h2>Capital Account Statement (CAS)</h2>
      <div class="cas-period">Период: {{ selectedQuarter }}</div>
      <table class="ilpa-table cas-table">
        <thead>
          <tr>
            <th>Статья</th>
            <th>Начало периода</th>
            <th>Изменение</th>
            <th>Конец периода</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in casRows" :key="row.label" :class="{ 'cas-total': row.isTotal, 'cas-sub': row.isSubtitle }">
            <td :class="{ 'bold': row.isTotal, 'subtitle': row.isSubtitle }">{{ row.label }}</td>
            <td class="num" :class="row.isTotal ? 'bold' : ''">{{ row.begin != null ? formatNum(row.begin) : '' }}</td>
            <td class="num" :class="[row.isTotal ? 'bold' : '', row.change > 0 ? 'green' : row.change < 0 ? 'red' : '']">{{ row.change != null ? formatNum(row.change) : '' }}</td>
            <td class="num" :class="row.isTotal ? 'bold' : ''">{{ row.end != null ? formatNum(row.end) : '' }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- ILPA Fee & Expense Report -->
    <div v-if="activeTab === 'fees'" class="ilpa-section">
      <h2>Fee & Expense Report (FER)</h2>
      <p class="ilpa-note">Детализация всех комиссий и расходов фонда за отчётный период</p>
      <table class="ilpa-table">
        <thead>
          <tr>
            <th>Тип комиссии</th>
            <th>Контрагент</th>
            <th>Метод расчёта</th>
            <th>Начислено, млн ₽</th>
            <th>Оплачено, млн ₽</th>
            <th>Кредит LP, млн ₽</th>
            <th>Итого LP, млн ₽</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="f in feeRows" :key="f.type">
            <td>{{ f.type }}</td>
            <td class="gray">{{ f.counterparty }}</td>
            <td class="gray">{{ f.method }}</td>
            <td class="num">{{ f.accrued }}</td>
            <td class="num">{{ f.paid }}</td>
            <td class="num green">{{ f.credit }}</td>
            <td class="num bold">{{ f.netLp }}</td>
          </tr>
        </tbody>
        <tfoot>
          <tr>
            <td colspan="3"><strong>Итого</strong></td>
            <td class="num bold">{{ totalAccrued }}</td>
            <td class="num bold">{{ totalPaid }}</td>
            <td class="num bold green">{{ totalCredit }}</td>
            <td class="num bold">{{ totalNetLp }}</td>
          </tr>
        </tfoot>
      </table>
    </div>

    <!-- ILPA Performance Template -->
    <div v-if="activeTab === 'performance'" class="ilpa-section">
      <h2>Performance Template</h2>
      <div class="perf-grid">
        <div class="perf-block">
          <h3>Метрики фонда</h3>
          <table class="ilpa-table">
            <tbody>
              <tr v-for="m in fundMetrics" :key="m.label">
                <td>{{ m.label }}</td>
                <td class="num bold" :class="m.color">{{ m.value }}</td>
                <td class="gray">{{ m.benchmark }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="perf-block">
          <h3>Метрики по каждому LP</h3>
          <table class="ilpa-table">
            <thead>
              <tr><th>LP</th><th>Взносы</th><th>NAV</th><th>Дистрибуции</th><th>TVPI</th><th>Net IRR</th></tr>
            </thead>
            <tbody>
              <tr v-for="lp in lpMetrics" :key="lp.name">
                <td>{{ lp.name }}</td>
                <td class="num">{{ lp.contributions }}</td>
                <td class="num">{{ lp.nav }}</td>
                <td class="num">{{ lp.distributions }}</td>
                <td class="num bold">{{ lp.tvpi }}</td>
                <td class="num green">{{ lp.netIrr }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Portco Reporting -->
    <div v-if="activeTab === 'portco'" class="ilpa-section">
      <h2>Портфельные компании — ESG & Operations</h2>
      <div class="portco-cards">
        <div v-for="pc in portcoReports" :key="pc.name" class="portco-card">
          <div class="portco-header">
            <div class="portco-name">{{ pc.name }}</div>
            <span class="portco-stage">{{ pc.stage }}</span>
          </div>
          <div class="portco-metrics">
            <div class="pm"><div class="pm-val">{{ pc.revenue }}</div><div class="pm-lbl">Выручка, млн ₽</div></div>
            <div class="pm"><div class="pm-val">{{ pc.employees }}</div><div class="pm-lbl">Сотрудники</div></div>
            <div class="pm"><div class="pm-val" :class="pc.esgScore >= 70 ? 'green' : 'orange'">{{ pc.esgScore }}</div><div class="pm-lbl">ESG score</div></div>
            <div class="pm"><div class="pm-val">{{ pc.kpiCompletion }}%</div><div class="pm-lbl">KPI выполнение</div></div>
          </div>
          <div class="portco-update">Обновлено: {{ pc.lastUpdate }}</div>
        </div>
      </div>
    </div>
  </FstPageLayout>
</template>

<script setup>
import { ref, computed } from 'vue'
import FstPageLayout from '@/components/fst-shared/FstPageLayout.vue'

const activeTab = ref('capital')
const selectedQuarter = ref('Q4 2025')

const quarters = ['Q4 2025', 'Q3 2025', 'Q2 2025', 'Q1 2025']

const tabs = [
  { id: 'capital',     label: 'Capital Account' },
  { id: 'fees',        label: 'Fee & Expense' },
  { id: 'performance', label: 'Performance' },
  { id: 'portco',      label: 'Портфельные ко.' }
]

const reportStatus = ref([
  { label: 'Сбор данных',        status: 'done',     date: '10 янв' },
  { label: 'Capital Account',    status: 'done',     date: '15 янв' },
  { label: 'Fee Report',         status: 'done',     date: '18 янв' },
  { label: 'Performance',        status: 'progress', date: '25 янв' },
  { label: 'Портфельные ко.',    status: 'progress', date: '30 янв' },
  { label: 'Аудит (E&Y)',        status: 'pending',  date: '10 фев' },
  { label: 'Рассылка LP',        status: 'pending',  date: '15 фев' }
])

const casRows = ref([
  { label: 'I. Капитал LP на начало периода', begin: 2240, change: null,  end: null,  isSubtitle: true },
  { label: 'Взносы в капитал',               begin: null, change:  600,  end: null  },
  { label: 'Возврат взносов',                begin: null, change:  -20,  end: null  },
  { label: 'Дистрибуции (реализованные)',    begin: null, change: -180,  end: null  },
  { label: 'Вознаграждение УК (нет.)',       begin: null, change:  -42,  end: null  },
  { label: 'Расходы фонда',                  begin: null, change:   -8,  end: null  },
  { label: 'II. Изменение стоимости инвест.', begin: null, change: null,  end: null,  isSubtitle: true },
  { label: 'Нереализованная прибыль/(убыток)', begin: null, change: 250, end: null  },
  { label: 'Реализованная прибыль/(убыток)', begin: null, change:  110,  end: null  },
  { label: 'III. Капитал LP на конец периода', begin: 2240, change: 710, end: 2950, isTotal: true }
])

const feeRows = ref([
  { type: 'Management Fee',    counterparty: 'УК ФСТ',     method: '2% от взносов/год', accrued: 42.4, paid: 42.4, credit: 8.5, netLp: 33.9 },
  { type: 'Transaction Fee',   counterparty: 'УК ФСТ',     method: '1.5% за сделку',    accrued: 18.6, paid: 12.0, credit: 18.6, netLp: 0.0 },
  { type: 'Monitoring Fee',    counterparty: 'УК ФСТ',     method: '0.5% NAV/год',      accrued: 10.6, paid: 10.6, credit: 0.0,  netLp: 10.6 },
  { type: 'Audit (E&Y)',       counterparty: 'Ernst&Young', method: 'Фикс. контракт',    accrued: 4.2,  paid: 4.2,  credit: 0.0,  netLp: 4.2  },
  { type: 'Legal (РСПП)',      counterparty: 'Правовед',   method: 'Почасово',           accrued: 1.8,  paid: 1.8,  credit: 0.0,  netLp: 1.8  },
  { type: 'Valuations',        counterparty: 'PwC',        method: '4 квартала/год',     accrued: 0.8,  paid: 0.8,  credit: 0.0,  netLp: 0.8  }
])

const totalAccrued = computed(() => feeRows.value.reduce((s, r) => s + r.accrued, 0).toFixed(1))
const totalPaid    = computed(() => feeRows.value.reduce((s, r) => s + r.paid, 0).toFixed(1))
const totalCredit  = computed(() => feeRows.value.reduce((s, r) => s + r.credit, 0).toFixed(1))
const totalNetLp   = computed(() => feeRows.value.reduce((s, r) => s + r.netLp, 0).toFixed(1))

const fundMetrics = ref([
  { label: 'Net IRR (since inception)', value: '22.7%', color: 'green',  benchmark: 'Медиана венч. фондов: 18%' },
  { label: 'TVPI',                      value: '1.34x', color: 'green',  benchmark: 'Верхний квартиль: 1.5x' },
  { label: 'DPI',                       value: '0.18x', color: 'gray',   benchmark: 'Ожидается к 2027' },
  { label: 'RVPI',                      value: '1.16x', color: 'blue',   benchmark: '' },
  { label: 'Gross IRR',                 value: '31.2%', color: 'green',  benchmark: '' },
  { label: 'Период инвестирования',     value: '3 года', color: '',      benchmark: 'Горизонт фонда: 7+2 лет' }
])

const lpMetrics = ref([
  { name: 'Росатом',       contributions: 800, nav: 980,  distributions: 60,  tvpi: '1.30x', netIrr: '21.4%' },
  { name: 'ВЭБ.РФ',       contributions: 500, nav: 640,  distributions: 40,  tvpi: '1.36x', netIrr: '23.1%' },
  { name: 'Сколково',      contributions: 300, nav: 395,  distributions: 25,  tvpi: '1.40x', netIrr: '24.8%' },
  { name: 'Частные LP',    contributions: 520, nav: 670,  distributions: 55,  tvpi: '1.39x', netIrr: '24.2%' }
])

const portcoReports = ref([
  { name: 'АгроДрон',       stage: 'Серия A', revenue: 85,  employees: 124, esgScore: 78, kpiCompletion: 91, lastUpdate: '2026-01-15' },
  { name: 'RoboFarm',       stage: 'Серия A', revenue: 52,  employees: 87,  esgScore: 82, kpiCompletion: 88, lastUpdate: '2026-01-20' },
  { name: 'МедТех БПЛА',    stage: 'Серия B', revenue: 140, employees: 210, esgScore: 71, kpiCompletion: 76, lastUpdate: '2026-01-12' },
  { name: 'DroneLogistics', stage: 'Серия B', revenue: 320, employees: 380, esgScore: 66, kpiCompletion: 84, lastUpdate: '2026-01-18' },
  { name: 'ЭнергоРобот',    stage: 'Серия A', revenue: 28,  employees: 45,  esgScore: 58, kpiCompletion: 62, lastUpdate: '2026-01-25' },
  { name: 'CyberPilot',     stage: 'Серия B', revenue: 195, employees: 290, esgScore: 75, kpiCompletion: 95, lastUpdate: '2026-01-10' }
])

function formatNum(v) {
  if (v == null) return ''
  return (v >= 0 ? '+' : '') + v.toLocaleString('ru') + ' млн ₽'
}

function loadReport() {}
function generatePdf() { window.print() }
function sendToLps() { alert('Отчёт ILPA за ' + selectedQuarter.value + ' отправлен всем LP-партнёрам') }
</script>

<style scoped>
.ilpa-root { padding: 24px; display: flex; flex-direction: column; gap: 20px; min-height: 100vh; background: var(--surface-ground); }
.ilpa-header { display: flex; align-items: flex-start; justify-content: space-between; flex-wrap: wrap; gap: 12px; }
.ilpa-header h1 { margin: 0; font-size: 1rem; font-weight: 600; color: var(--p-text-color); }
.ilpa-subtitle { font-size: 0.8rem; color: var(--p-text-muted-color); }
.ilpa-actions { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.ilpa-btn { padding: 8px 14px; border-radius: 8px; border: none; cursor: pointer; font-size: 0.875rem; font-weight: 600; }
.ilpa-btn.primary  { background: var(--p-primary-color); color: white; }
.ilpa-btn.secondary{ background: var(--surface-card); color: var(--p-text-color); border: 1px solid var(--surface-border); }
.ilpa-select { padding: 7px 10px; border-radius: 8px; border: 1px solid var(--surface-border); background: var(--surface-card); color: var(--p-text-color); font-size: 0.83rem; }

.ilpa-status-bar { display: flex; gap: 0; overflow-x: auto; background: var(--surface-card); border: 1px solid var(--surface-border); border-radius: 10px; }
.ilpa-status-item { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 12px 16px; border-right: 1px solid var(--surface-border); flex: 1; min-width: 90px; }
.ilpa-status-item:last-child { border-right: none; }
.status-icon { font-size: 1.1rem; font-weight: 700; }
.status-icon.done     { color: var(--fst-green); }
.status-icon.progress { color: var(--fst-brand); }
.status-icon.pending  { color: var(--p-text-muted-color); }
.status-label { font-size: 0.72rem; color: var(--p-text-color); text-align: center; font-weight: 600; }
.status-date  { font-size: 0.65rem; color: var(--p-text-muted-color); }

.ilpa-tabs { display: flex; gap: 4px; flex-wrap: wrap; }
.ilpa-tab { padding: 7px 16px; border-radius: 8px; border: 1px solid var(--surface-border); background: var(--surface-card); color: var(--p-text-muted-color); cursor: pointer; font-size: 0.85rem; }
.ilpa-tab.active { background: var(--p-primary-color); color: white; border-color: var(--p-primary-color); }

.ilpa-section { background: var(--surface-card); border: 1px solid var(--surface-border); border-radius: 10px; padding: 20px; overflow-x: auto; }
.ilpa-section h2 { margin: 0 0 8px; font-size: 1.1rem; color: var(--p-text-color); }
.ilpa-note { font-size: 0.8rem; color: var(--p-text-muted-color); margin: 0 0 14px; }
.cas-period { font-size: 0.8rem; color: var(--p-text-muted-color); margin-bottom: 14px; }

.ilpa-table { width: 100%; border-collapse: collapse; font-size: 0.83rem; }
.ilpa-table th { padding: 8px 12px; text-align: left; color: var(--p-text-muted-color); border-bottom: 1px solid var(--surface-border); font-size: 0.75rem; font-weight: 600; }
.ilpa-table td { padding: 9px 12px; border-bottom: 1px solid var(--surface-border); color: var(--p-text-color); }
.ilpa-table tfoot td { border-top: 2px solid var(--surface-border); border-bottom: none; background: var(--surface-ground); }
.ilpa-table tr.cas-total { background: var(--surface-ground); }
.ilpa-table tr.cas-sub td { color: var(--p-text-muted-color); font-style: italic; font-size: 0.8rem; background: var(--surface-ground); padding-top: 12px; }
.num { text-align: right; font-variant-numeric: tabular-nums; }
.bold { font-weight: 700; }
.green { color: var(--fst-green); } .red { color: var(--fst-red); } .orange { color: var(--fst-brand); } .gray { color: var(--p-text-muted-color); } .blue { color: var(--fst-blue); }

.perf-grid { display: grid; grid-template-columns: 1fr 2fr; gap: 20px; }
@media (max-width: 768px) { .perf-grid { grid-template-columns: 1fr; } }
.perf-block h3 { font-size: 0.9rem; margin: 0 0 10px; color: var(--p-text-color); }

.portco-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 12px; }
.portco-card { background: var(--surface-ground); border: 1px solid var(--surface-border); border-radius: 8px; padding: 14px; }
.portco-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
.portco-name { font-weight: 700; font-size: 0.9rem; color: var(--p-text-color); }
.portco-stage { font-size: 0.72rem; padding: 2px 8px; border-radius: 4px; background: var(--p-primary-color); color: white; }
.portco-metrics { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 8px; margin-bottom: 10px; }
.pm { text-align: center; }
.pm-val { font-size: 1rem; font-weight: 700; color: var(--p-text-color); }
.pm-lbl { font-size: 0.65rem; color: var(--p-text-muted-color); }
.portco-update { font-size: 0.68rem; color: var(--p-text-muted-color); }

@media print {
  .ilpa-header .ilpa-actions, .ilpa-tabs, .ilpa-status-bar { display: none; }
  .ilpa-section { box-shadow: none; border: 1px solid var(--p-surface-300); }
}
</style>
