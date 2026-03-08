<template>
  <FstPageLayout title="Трекер грантов" subtitle="Меры господдержки для портфельных компаний ФСТ НТИ">
    <template #actions>
      <button class="gr-btn secondary" @click="exportGrants">Экспорт</button>
        <button class="gr-btn primary" @click="showAdd = true">+ Грант</button>
    </template>

    <!-- Сводка -->
    <div class="gr-summary">
      <div class="gr-sum-card" v-for="s in summary" :key="s.label">
        <div class="gs-val" :class="s.color">{{ s.value }}</div>
        <div class="gs-lbl">{{ s.label }}</div>
      </div>
    </div>

    <!-- Фильтры -->
    <div class="gr-filters">
      <button v-for="f in filters" :key="f.id" :class="['gr-filter', { active: activeFilter === f.id }]" @click="activeFilter = f.id">{{ f.label }}</button>
      <input v-model="search" placeholder="Поиск по программе..." class="gr-search" />
    </div>

    <!-- Таблица грантов -->
    <div class="gr-section">
      <table class="gr-table">
        <thead>
          <tr>
            <th>Программа</th>
            <th>Орган</th>
            <th>Тип</th>
            <th>Сумма, млн ₽</th>
            <th>Компания</th>
            <th>Статус</th>
            <th>Дедлайн</th>
            <th>Использовано</th>
            <th>Отчётность</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="g in filteredGrants" :key="g.id">
            <td class="g-name">{{ g.name }}</td>
            <td class="g-org">{{ g.org }}</td>
            <td><span class="g-type" :class="g.type">{{ typeLabel(g.type) }}</span></td>
            <td class="num">{{ g.amount }}</td>
            <td class="g-co">{{ g.company }}</td>
            <td><span class="g-status" :class="g.status">{{ statusLabel(g.status) }}</span></td>
            <td class="g-date" :class="isOverdue(g.deadline) ? 'overdue' : ''">{{ g.deadline }}</td>
            <td class="num">
              <div class="usage-bar-wrap">
                <div class="usage-bar" :style="{ width: g.usedPct + '%', background: g.usedPct > 90 ? '#ef5350' : '#66bb6a' }"></div>
                <span>{{ g.usedPct }}%</span>
              </div>
            </td>
            <td><span class="rep-badge" :class="g.report">{{ reportLabel(g.report) }}</span></td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Дедлайн-трекер -->
    <div class="gr-section">
      <h2>Ближайшие дедлайны</h2>
      <div class="deadlines">
        <div v-for="d in upcomingDeadlines" :key="d.id" class="deadline-item" :class="d.urgency">
          <div class="dl-urgency">{{ d.daysLeft }} дн.</div>
          <div class="dl-info">
            <div class="dl-name">{{ d.name }}</div>
            <div class="dl-desc">{{ d.company }} — {{ d.action }}</div>
          </div>
          <div class="dl-date">{{ d.deadline }}</div>
        </div>
      </div>
    </div>

    <!-- Модал добавления -->
    <div v-if="showAdd" class="modal-overlay" @click.self="showAdd = false">
      <div class="modal-box">
        <h3>Добавить грантовую заявку</h3>
        <div class="modal-form">
          <label>Программа</label>
          <input v-model="newGrant.name" placeholder="Название программы" />
          <label>Орган / Организация</label>
          <input v-model="newGrant.org" />
          <label>Тип поддержки</label>
          <select v-model="newGrant.type">
            <option value="grant">Грант (безвозмездно)</option>
            <option value="subsidy">Субсидия</option>
            <option value="soft_loan">Льготный заём</option>
            <option value="tax">Налоговый вычет</option>
          </select>
          <label>Сумма, млн ₽</label>
          <input v-model.number="newGrant.amount" type="number" step="5" />
          <label>Портфельная компания</label>
          <select v-model="newGrant.company">
            <option>АгроДрон</option>
            <option>RoboFarm</option>
            <option>МедТех БПЛА</option>
            <option>DroneLogistics</option>
            <option>CyberPilot</option>
          </select>
          <label>Дедлайн подачи</label>
          <input v-model="newGrant.deadline" type="date" />
        </div>
        <div class="modal-actions">
          <button class="gr-btn secondary" @click="showAdd = false">Отмена</button>
          <button class="gr-btn primary" @click="addGrant">Добавить</button>
        </div>
      </div>
    </div>
  </FstPageLayout>
</template>

<script setup>
import { ref, computed } from 'vue'
import FstPageLayout from '@/components/fst-shared/FstPageLayout.vue'

const showAdd   = ref(false)
const activeFilter = ref('all')
const search    = ref('')

const filters = [
  { id: 'all',      label: 'Все' },
  { id: 'active',   label: 'Активные' },
  { id: 'pending',  label: 'На рассмотрении' },
  { id: 'approved', label: 'Одобрено' }
]

const grants = ref([
  { id: 1,  name: 'НИОКР БАС Минпромторг',    org: 'Минпромторг',   type: 'grant',     amount: 300, company: 'АгроДрон',       status: 'approved', deadline: '2026-12-31', usedPct: 35, report: 'submitted' },
  { id: 2,  name: 'Сколково IT-грант',         org: 'Сколково',      type: 'grant',     amount: 50,  company: 'RoboFarm',       status: 'approved', deadline: '2026-09-30', usedPct: 68, report: 'submitted' },
  { id: 3,  name: 'ФРП промышленный',          org: 'ФРП',           type: 'soft_loan', amount: 250, company: 'МедТех БПЛА',    status: 'pending',  deadline: '2026-03-15', usedPct: 0,  report: 'pending' },
  { id: 4,  name: 'Программа цифровизации',    org: 'Минцифры',      type: 'subsidy',   amount: 80,  company: 'DroneLogistics', status: 'review',   deadline: '2026-04-01', usedPct: 0,  report: 'pending' },
  { id: 5,  name: 'Экспортный грант РЭЦ',      org: 'РЭЦ',          type: 'subsidy',   amount: 30,  company: 'АгроДрон',       status: 'pending',  deadline: '2026-05-01', usedPct: 0,  report: 'pending' },
  { id: 6,  name: 'НИОКР Роснано',             org: 'Роснано',       type: 'grant',     amount: 120, company: 'CyberPilot',     status: 'approved', deadline: '2027-01-01', usedPct: 12, report: 'overdue'  },
  { id: 7,  name: 'Налоговый вычет НИОКР',    org: 'ФНС',           type: 'tax',       amount: 45,  company: 'RoboFarm',       status: 'approved', deadline: '2026-04-30', usedPct: 100,report: 'submitted'},
  { id: 8,  name: 'Инновационный ваучер МСП',  org: 'АО МСП Банк',  type: 'grant',     amount: 15,  company: 'АгроДрон',       status: 'denied',   deadline: '2026-01-01', usedPct: 0,  report: 'na'       }
])

const filteredGrants = computed(() => {
  let list = grants.value
  if (activeFilter.value !== 'all') list = list.filter(g => g.status === activeFilter.value)
  if (search.value) list = list.filter(g => g.name.toLowerCase().includes(search.value.toLowerCase()))
  return list
})

const summary = computed(() => [
  { label: 'Всего грантов',       value: grants.value.length,                                                    color: 'blue'   },
  { label: 'Одобрено, млн ₽',    value: grants.value.filter(g => g.status === 'approved').reduce((s, g) => s + g.amount, 0), color: 'green'  },
  { label: 'На рассмотрении',     value: grants.value.filter(g => g.status === 'pending' || g.status === 'review').length,   color: 'orange' },
  { label: 'Просрочен отчёт',    value: grants.value.filter(g => g.report === 'overdue').length,                 color: 'red'    },
  { label: 'Использовано, %',    value: Math.round(grants.value.filter(g => g.usedPct > 0).reduce((s, g) => s + g.usedPct, 0) / grants.value.filter(g => g.usedPct > 0).length) + '%', color: 'blue' }
])

const upcomingDeadlines = computed(() => {
  const today = new Date()
  return grants.value
    .filter(g => g.deadline !== '—' && g.status !== 'denied')
    .map(g => {
      const dl = new Date(g.deadline)
      const daysLeft = Math.ceil((dl - today) / 86400000)
      return {
        id: g.id, name: g.name, company: g.company, deadline: g.deadline, daysLeft,
        action: g.report === 'overdue' ? 'Подать отчётность!' : g.status === 'pending' ? 'Подать заявку' : 'Промежуточный отчёт',
        urgency: daysLeft <= 7 ? 'critical' : daysLeft <= 30 ? 'warning' : 'normal'
      }
    })
    .filter(d => d.daysLeft > 0 && d.daysLeft <= 60)
    .sort((a, b) => a.daysLeft - b.daysLeft)
    .slice(0, 6)
})

function typeLabel(t) { return { grant: 'Грант', subsidy: 'Субсидия', soft_loan: 'Льгот. заём', tax: 'Налог. вычет' }[t] || t }
function statusLabel(s) { return { approved: 'Одобрено', pending: 'Рассмотрение', review: 'Проверка', denied: 'Отказ' }[s] || s }
function reportLabel(r) { return { submitted: 'Подан', pending: 'Ожидает', overdue: 'Просрочен', na: 'Н/П' }[r] || r }
function isOverdue(d) { return d < new Date().toISOString().slice(0, 10) }

const newGrant = ref({ name: '', org: '', type: 'grant', amount: 0, company: 'АгроДрон', deadline: '' })
function addGrant() {
  grants.value.push({ id: Date.now(), ...newGrant.value, status: 'pending', usedPct: 0, report: 'pending' })
  showAdd.value = false
}

function exportGrants() {
  const rows = [['Программа', 'Орган', 'Тип', 'Сумма', 'Компания', 'Статус', 'Дедлайн'], ...grants.value.map(g => [g.name, g.org, typeLabel(g.type), g.amount, g.company, statusLabel(g.status), g.deadline])]
  const csv = rows.map(r => r.join(',')).join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = 'grants.csv'; a.click()
  URL.revokeObjectURL(url)
}
</script>

<style scoped>
.gr-root { padding: 24px; display: flex; flex-direction: column; gap: 20px; min-height: 100vh; background: var(--surface-ground); }
.gr-header { display: flex; align-items: flex-start; justify-content: space-between; flex-wrap: wrap; gap: 12px; }
.gr-header h1 { margin: 0; font-size: 1rem; font-weight: 600; color: var(--p-text-color); }
.gr-sub { font-size: 0.8rem; color: var(--p-text-muted-color); }
.gr-actions { display: flex; gap: 8px; }
.gr-btn { padding: 8px 14px; border-radius: 8px; border: none; cursor: pointer; font-size: 0.875rem; font-weight: 600; }
.gr-btn.primary  { background: var(--p-primary-color); color: #fff; }
.gr-btn.secondary{ background: var(--surface-card); color: var(--p-text-color); border: 1px solid var(--surface-border); }

.gr-summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; }
.gr-sum-card { background: var(--surface-card); border: 1px solid var(--surface-border); border-radius: 10px; padding: 14px; text-align: center; }
.gs-val { font-size: 1.6rem; font-weight: 700; }
.gs-val.green  { color: #66bb6a; } .gs-val.orange { color: #ff9800; } .gs-val.red { color: #ef5350; } .gs-val.blue { color: var(--p-primary-color); }
.gs-lbl { font-size: 0.72rem; color: var(--p-text-muted-color); margin-top: 4px; }

.gr-filters { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
.gr-filter { padding: 6px 14px; border-radius: 8px; border: 1px solid var(--surface-border); background: var(--surface-card); color: var(--p-text-muted-color); cursor: pointer; font-size: 0.82rem; }
.gr-filter.active { background: var(--p-primary-color); color: #fff; border-color: var(--p-primary-color); }
.gr-search { padding: 6px 12px; border-radius: 8px; border: 1px solid var(--surface-border); background: var(--surface-card); color: var(--p-text-color); font-size: 0.82rem; flex: 1; max-width: 260px; }

.gr-section { background: var(--surface-card); border: 1px solid var(--surface-border); border-radius: 10px; padding: 18px; overflow-x: auto; }
.gr-section h2 { margin: 0 0 14px; font-size: 1.05rem; color: var(--p-text-color); }

.gr-table { width: 100%; border-collapse: collapse; font-size: 0.82rem; min-width: 760px; }
.gr-table th { padding: 7px 10px; text-align: left; color: var(--p-text-muted-color); border-bottom: 1px solid var(--surface-border); font-size: 0.72rem; }
.gr-table td { padding: 8px 10px; border-bottom: 1px solid var(--surface-border); color: var(--p-text-color); }
.gr-table tr:last-child td { border: none; }
.g-name { font-weight: 600; max-width: 200px; }
.g-org, .g-co { font-size: 0.75rem; color: var(--p-text-muted-color); }
.g-date.overdue { color: #ef5350; font-weight: 600; }
.num { text-align: right; }
.g-type, .g-status, .rep-badge { padding: 2px 7px; border-radius: 4px; font-size: 0.68rem; font-weight: 600; }
.g-type.grant     { background: #66bb6a22; color: #66bb6a; }
.g-type.subsidy   { background: #42a5f522; color: #42a5f5; }
.g-type.soft_loan { background: #ab47bc22; color: #ab47bc; }
.g-type.tax       { background: #ff980022; color: #ff9800; }
.g-status.approved { background: #66bb6a22; color: #66bb6a; }
.g-status.pending  { background: #ff980022; color: #ff9800; }
.g-status.review   { background: #42a5f522; color: #42a5f5; }
.g-status.denied   { background: #ef535022; color: #ef5350; }
.rep-badge.submitted { background: #66bb6a22; color: #66bb6a; }
.rep-badge.pending   { background: var(--surface-ground); color: var(--p-text-muted-color); }
.rep-badge.overdue   { background: #ef535022; color: #ef5350; }
.rep-badge.na        { background: var(--surface-ground); color: var(--p-text-muted-color); }
.usage-bar-wrap { display: flex; align-items: center; gap: 6px; }
.usage-bar { height: 6px; border-radius: 3px; min-width: 4px; max-width: 50px; }

.deadlines { display: flex; flex-direction: column; gap: 8px; }
.deadline-item { display: flex; align-items: center; gap: 14px; background: var(--surface-ground); border: 1px solid var(--surface-border); border-radius: 8px; padding: 10px 14px; }
.deadline-item.critical { border-color: #ef5350; }
.deadline-item.warning  { border-color: #ff9800; }
.dl-urgency { font-size: 1.1rem; font-weight: 900; min-width: 60px; }
.deadline-item.critical .dl-urgency { color: #ef5350; }
.deadline-item.warning  .dl-urgency { color: #ff9800; }
.deadline-item.normal   .dl-urgency { color: var(--p-text-muted-color); }
.dl-info { flex: 1; }
.dl-name { font-weight: 600; font-size: 0.85rem; color: var(--p-text-color); }
.dl-desc { font-size: 0.72rem; color: var(--p-text-muted-color); }
.dl-date { font-size: 0.75rem; color: var(--p-text-muted-color); }

.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 100; }
.modal-box { background: var(--surface-card); border-radius: 12px; padding: 24px; width: 400px; max-width: 95vw; }
.modal-box h3 { margin: 0 0 16px; }
.modal-form { display: flex; flex-direction: column; gap: 8px; margin-bottom: 16px; }
.modal-form label { font-size: 0.75rem; color: var(--p-text-muted-color); }
.modal-form input, .modal-form select { background: var(--surface-ground); border: 1px solid var(--surface-border); border-radius: 6px; padding: 7px 10px; color: var(--p-text-color); font-size: 0.85rem; width: 100%; }
.modal-actions { display: flex; gap: 8px; justify-content: flex-end; }
</style>
