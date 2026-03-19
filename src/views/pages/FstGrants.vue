<template>
  <FstPageLayout title="Трекер грантов" subtitle="Меры господдержки для портфельных компаний ФСТ НТИ">
    <template #actions>
      <Button label="Экспорт" severity="secondary" @click="exportGrants" />
      <Button label="+ Грант" @click="showAdd = true" />
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
      <Button v-for="f in filters" :key="f.id" :label="f.label" :severity="activeFilter === f.id ? undefined : 'secondary'" size="small" @click="activeFilter = f.id" />
      <InputText v-model="search" placeholder="Поиск по программе..." size="small" class="gr-search" />
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
                <div class="usage-bar" :style="{ width: g.usedPct + '%', background: g.usedPct > 90 ? 'var(--fst-red)' : 'var(--fst-green)' }"></div>
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
    <Dialog v-model:visible="showAdd" header="Добавить грантовую заявку" :style="{ width: '400px' }" modal>
      <div class="modal-form">
        <label>Программа</label>
        <InputText v-model="newGrant.name" placeholder="Название программы" fluid />
        <label>Орган / Организация</label>
        <InputText v-model="newGrant.org" fluid />
        <label>Тип поддержки</label>
        <Select v-model="newGrant.type" :options="typeOptions" optionLabel="label" optionValue="value" fluid />
        <label>Сумма, млн ₽</label>
        <InputText v-model.number="newGrant.amount" type="number" step="5" fluid />
        <label>Портфельная компания</label>
        <Select v-model="newGrant.company" :options="companyOptions" fluid />
        <label>Дедлайн подачи</label>
        <InputText v-model="newGrant.deadline" type="date" fluid />
      </div>
      <template #footer>
        <div class="modal-actions">
          <Button label="Отмена" severity="secondary" @click="showAdd = false" />
          <Button label="Добавить" @click="addGrant" />
        </div>
      </template>
    </Dialog>
  </FstPageLayout>
</template>

<script setup>
import { ref, computed } from 'vue'
import FstPageLayout from '@/components/fst-shared/FstPageLayout.vue'
import { useEventStore } from '@/stores/eventStore.js'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import Dialog from 'primevue/dialog'

const eventStore = useEventStore()
const showAdd   = ref(false)
const activeFilter = ref('all')
const search    = ref('')

const typeOptions = [
  { label: 'Грант (безвозмездно)', value: 'grant' },
  { label: 'Субсидия', value: 'subsidy' },
  { label: 'Льготный заём', value: 'soft_loan' },
  { label: 'Налоговый вычет', value: 'tax' }
]
const companyOptions = ['АгроДрон', 'RoboFarm', 'МедТех БПЛА', 'DroneLogistics', 'CyberPilot']

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
  const grantId = `grant-${Date.now()}`
  grants.value.push({ id: grantId, ...newGrant.value, status: 'pending', usedPct: 0, report: 'pending' })
  // Фиксируем событие в лог лида / проекта компании
  const leadId = newGrant.value.company.replace(/\s+/g, '_').toLowerCase()
  eventStore.add('lead', leadId, 'GRANTS_MATCHED', {
    grantId,
    name:    newGrant.value.name,
    org:     newGrant.value.org,
    type:    newGrant.value.type,
    amount:  newGrant.value.amount,
    company: newGrant.value.company,
    count:   1,
  })
  showAdd.value = false
}

function approveGrant(grant) {
  if (grant.status === 'approved') return
  grant.status = 'approved'
  const leadId = grant.company.replace(/\s+/g, '_').toLowerCase()
  eventStore.add('project', leadId, 'MEASURE_FUNDED', {
    grantName: grant.name,
    org:       grant.org,
    amount:    grant.amount,
    type:      grant.type,
  })
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
.gr-summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; }
.gr-sum-card { background: var(--p-surface-card); border: 1px solid var(--p-content-border-color); border-radius: 10px; padding: 14px; text-align: center; }
.gs-val { font-size: 1.6rem; font-weight: 700; }
.gs-val.green  { color: var(--fst-green); } .gs-val.orange { color: var(--fst-brand); } .gs-val.red { color: var(--fst-red); } .gs-val.blue { color: var(--p-primary-color); }
.gs-lbl { font-size: 0.72rem; color: var(--p-text-muted-color); margin-top: 4px; }

.gr-filters { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
.gr-search { flex: 1; max-width: 260px; }

.gr-section { background: var(--p-surface-card); border: 1px solid var(--p-content-border-color); border-radius: 10px; padding: 18px; overflow-x: auto; }
.gr-section h2 { margin: 0 0 14px; font-size: 1.05rem; color: var(--p-text-color); }

.gr-table { width: 100%; border-collapse: collapse; font-size: 0.82rem; min-width: 760px; }
.gr-table th { padding: 7px 10px; text-align: left; color: var(--p-text-muted-color); border-bottom: 1px solid var(--p-content-border-color); font-size: 0.72rem; }
.gr-table td { padding: 8px 10px; border-bottom: 1px solid var(--p-content-border-color); color: var(--p-text-color); }
.gr-table tr:last-child td { border: none; }
.g-name { font-weight: 600; max-width: 200px; }
.g-org, .g-co { font-size: 0.75rem; color: var(--p-text-muted-color); }
.g-date.overdue { color: var(--fst-red); font-weight: 600; }
.num { text-align: right; }
.g-type, .g-status, .rep-badge { padding: 2px 7px; border-radius: 4px; font-size: 0.68rem; font-weight: 600; }
.g-type.grant     { background: color-mix(in srgb, var(--fst-green) 13%, transparent); color: var(--fst-green); }
.g-type.subsidy   { background: color-mix(in srgb, var(--fst-blue) 13%, transparent); color: var(--fst-blue); }
.g-type.soft_loan { background: color-mix(in srgb, var(--fst-purple) 13%, transparent); color: var(--fst-purple); }
.g-type.tax       { background: color-mix(in srgb, var(--fst-brand) 13%, transparent); color: var(--fst-brand); }
.g-status.approved { background: color-mix(in srgb, var(--fst-green) 13%, transparent); color: var(--fst-green); }
.g-status.pending  { background: color-mix(in srgb, var(--fst-brand) 13%, transparent); color: var(--fst-brand); }
.g-status.review   { background: color-mix(in srgb, var(--fst-blue) 13%, transparent); color: var(--fst-blue); }
.g-status.denied   { background: color-mix(in srgb, var(--fst-red) 13%, transparent); color: var(--fst-red); }
.rep-badge.submitted { background: color-mix(in srgb, var(--fst-green) 13%, transparent); color: var(--fst-green); }
.rep-badge.pending   { background: var(--p-surface-card); color: var(--p-text-muted-color); }
.rep-badge.overdue   { background: color-mix(in srgb, var(--fst-red) 13%, transparent); color: var(--fst-red); }
.rep-badge.na        { background: var(--p-surface-card); color: var(--p-text-muted-color); }
.usage-bar-wrap { display: flex; align-items: center; gap: 6px; }
.usage-bar { height: 6px; border-radius: 3px; min-width: 4px; max-width: 50px; }

.deadlines { display: flex; flex-direction: column; gap: 8px; }
.deadline-item { display: flex; align-items: center; gap: 14px; background: var(--p-surface-card); border: 1px solid var(--p-content-border-color); border-radius: 8px; padding: 10px 14px; }
.deadline-item.critical { border-color: var(--fst-red); }
.deadline-item.warning  { border-color: var(--fst-brand); }
.dl-urgency { font-size: 1.1rem; font-weight: 900; min-width: 60px; }
.deadline-item.critical .dl-urgency { color: var(--fst-red); }
.deadline-item.warning  .dl-urgency { color: var(--fst-brand); }
.deadline-item.normal   .dl-urgency { color: var(--p-text-muted-color); }
.dl-info { flex: 1; }
.dl-name { font-weight: 600; font-size: 0.85rem; color: var(--p-text-color); }
.dl-desc { font-size: 0.72rem; color: var(--p-text-muted-color); }
.dl-date { font-size: 0.75rem; color: var(--p-text-muted-color); }

.modal-form { display: flex; flex-direction: column; gap: 8px; margin-bottom: 16px; }
.modal-form label { font-size: 0.75rem; color: var(--p-text-muted-color); }
.modal-actions { display: flex; gap: 8px; justify-content: flex-end; }

/* ── Mobile adaptive ── */
@media (max-width: 768px) {
  .gr-table { display: block; overflow-x: auto; -webkit-overflow-scrolling: touch; }
  .gr-summary { flex-wrap: wrap; gap: 8px; }
  .gr-summary { grid-template-columns: 1fr !important; }

  .gr-table { display: block; overflow-x: auto; -webkit-overflow-scrolling: touch; }
}
</style>
