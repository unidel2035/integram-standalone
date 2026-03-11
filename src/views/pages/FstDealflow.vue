<template>
  <FstPageLayout title="Воронка входящих заявок" subtitle="Deal Flow — управление потоком заявок от первичного контакта до ИК">
    <template #actions>
      <Button icon="pi pi-refresh" size="small" severity="secondary" :loading="loading" @click="reload" />
      <Button icon="pi pi-plus" label="Новая заявка" size="small" severity="success" @click="showNewDeal = true" />
      <Button icon="pi pi-download" label="CSV" size="small" severity="secondary" @click="exportCsv" />
    </template>

    <!-- ─── Metrics strip ─── -->
    <div class="df-metrics fst-metrics-strip">
      <div v-for="m in pipelineMetrics" :key="m.label" class="fst-metric-item">
        <i :class="m.icon" class="fst-metric-item-icon"></i>
        <div class="fst-metric-item-val">{{ m.val }}</div>
        <div class="fst-metric-item-label">{{ m.label }}</div>
      </div>
    </div>

    <!-- ─── Kanban-воронка ─── -->
    <div class="df-section">
      <div class="fst-section-label">ВОРОНКА СДЕЛОК</div>
      <FeatureHint
        id="dealflow-kanban"
        title="Kanban-воронка сделок"
        description="Карточки заявок распределены по стадиям инвестиционного процесса. Кликните на карточку, чтобы посмотреть детали и перевести на следующий этап"
        position="bottom"
      >
        <div class="df-kanban">
          <div v-for="col in columns" :key="col.id" class="df-column">
            <div class="df-col-header" :style="{ borderTop: `3px solid ${col.color}` }">
              <span class="df-col-title">{{ col.label }}</span>
              <span class="df-col-badge">{{ dealsInStage(col.id).length }}</span>
            </div>
            <div class="df-col-body">
              <div
                v-for="deal in dealsInStage(col.id)"
                :key="deal.id"
                class="df-card"
                @click="openDetail(deal)"
              >
                <div class="df-card-top">
                  <span class="df-card-name">{{ deal.company }}</span>
                  <span class="df-card-subfund" :style="{ background: subfundColor(deal.subfund) }">{{ deal.subfund }}</span>
                </div>
                <div class="df-card-desc">{{ deal.description }}</div>
                <div class="df-card-footer">
                  <span>{{ deal.askMln > 0 ? deal.askMln + ' млн ₽' : '—' }}</span>
                  <span class="df-card-footer-right">
                    <i v-if="deal.hasMedia" class="pi pi-file df-media-icon" title="Питч-дек прикреплён"></i>
                    {{ deal.receivedDate || '—' }}
                  </span>
                </div>
                <div v-if="deal.score" class="df-card-score">
                  <div class="df-score-bar" :style="{ width: deal.score + '%', background: scoreColor(deal.score) }"></div>
                  <span class="df-score-val">{{ deal.score }}/100</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </FeatureHint>
    </div>

    <!-- ─── Detail Dialog ─── -->
    <Dialog v-model:visible="detailVisible" :header="selectedDeal?.company" modal style="width: 500px; max-width: 95vw">
      <div class="df-form">
        <div class="df-detail-row"><span>Субфонд</span><strong>{{ selectedDeal?.subfund }}</strong></div>
        <div class="df-detail-row"><span>Стадия</span><strong>{{ selectedDeal?.stage }}</strong></div>
        <div class="df-detail-row"><span>Запрос</span><strong>{{ selectedDeal?.askMln }} млн ₽</strong></div>
        <div class="df-detail-row"><span>TRL</span><strong>{{ selectedDeal?.trl }}</strong></div>
        <div class="df-detail-row"><span>Суверенность</span><strong>{{ selectedDeal?.sovereignty }}/9</strong></div>
        <div class="df-detail-row"><span>Контакт</span><strong>{{ selectedDeal?.contact }}</strong></div>
        <div class="df-detail-row"><span>Источник</span><strong>{{ selectedDeal?.source }}</strong></div>
        <div class="df-detail-desc">
          <div class="df-detail-section">Описание</div>
          {{ selectedDeal?.description }}
        </div>
      </div>
      <template #footer>
        <Button label="История" icon="pi pi-history" severity="secondary" text
          @click="goToHub(selectedDeal)" />
        <Button label="Перевести →" icon="pi pi-arrow-right" :loading="saving" @click="moveToNext(selectedDeal)" />
        <Button label="Отклонить" severity="danger" icon="pi pi-times" :loading="saving" @click="rejectDeal(selectedDeal)" />
        <Button label="На ИК" severity="success" icon="pi pi-send" :loading="saving" @click="sendToIC(selectedDeal)" />
      </template>
    </Dialog>

    <!-- ─── New Deal Dialog ─── -->
    <Dialog v-model:visible="showNewDeal" header="Новая заявка" modal style="width: 480px; max-width: 95vw">
      <div class="df-form">
        <div class="df-form-row">
          <label>Компания</label>
          <InputText v-model="newDeal.company" placeholder="ООО АвиаТех" fluid />
        </div>
        <div class="df-form-row">
          <label>Субфонд</label>
          <Select v-model="newDeal.subfund" :options="subfundOptions" fluid />
        </div>
        <div class="df-form-row">
          <label>Запрос, млн ₽</label>
          <InputNumber v-model="newDeal.askMln" :min="1" fluid />
        </div>
        <div class="df-form-row">
          <label>TRL (1–9)</label>
          <InputNumber v-model="newDeal.trl" :min="1" :max="9" fluid />
        </div>
        <div class="df-form-row">
          <label>Суверенность (0–9)</label>
          <InputNumber v-model="newDeal.sovereignty" :min="0" :max="9" fluid />
        </div>
        <div class="df-form-row">
          <label>Описание</label>
          <Textarea v-model="newDeal.description" rows="3" fluid />
        </div>
        <div class="df-form-row">
          <label>Источник</label>
          <InputText v-model="newDeal.source" placeholder="Конференция БПЛА-2026" fluid />
        </div>
        <div class="df-form-row">
          <label>Контакт</label>
          <InputText v-model="newDeal.contact" placeholder="Иванов А.В., +7..." fluid />
        </div>
      </div>
      <template #footer>
        <Button label="Создать заявку" icon="pi pi-check" severity="success" fluid @click="createDeal" :loading="creating" />
      </template>
    </Dialog>
  </FstPageLayout>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import FstPageLayout from '@/components/fst-shared/FstPageLayout.vue'
import FeatureHint from '@/components/FeatureHint.vue'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import Select from 'primevue/select'
import Textarea from 'primevue/textarea'
import { useProjectStore } from '@/stores/projectStore.js'
import { useFstData } from '@/composables/useFstData.js'
import { createProject, updateProject, SUBFUNDS, STATUSES } from '@/services/fstApi.js'

const router    = useRouter()
const projStore = useProjectStore()
const { projects: rawProjects, loadProjects } = useFstData()

// ── Справочники ───────────────────────────────────────────────────────────────
const subfundOptions = ['БАС', 'РОБО', 'МЭ']

// Integram statusId → kanban stage
const STATUS_TO_STAGE = {
  [STATUSES['Новый']]:                 'new',
  [STATUSES['На рассмотрении ИК']]:    'ic',
  [STATUSES['Одобрен']]:               'approved',
  [STATUSES['На доработке']]:          'analysis',
  [STATUSES['В работе']]:              'approved',
  [STATUSES['Закрыт']]:                'rejected',
}

// Kanban stage → Integram statusId (только для важных переходов)
const STAGE_TO_STATUS = {
  ic:       STATUSES['На рассмотрении ИК'],
  approved: STATUSES['Одобрен'],
  rejected: STATUSES['Закрыт'],
}

// Subfund id → name
const SUBFUND_ID_TO_NAME = {
  [SUBFUNDS['БАС']]:  'БАС',
  [SUBFUNDS['РОБО']]: 'РОБО',
  [SUBFUNDS['МЭ']]:   'МЭ',
}

// Промежуточные стадии (не сохраняются в Integram, только локально)
const LS_STAGES_KEY = 'fst_dealflow_stages'
function loadLocalStages() { return JSON.parse(localStorage.getItem(LS_STAGES_KEY) || '{}') }
function saveLocalStage(id, stage) {
  const map = loadLocalStages()
  map[id] = stage
  localStorage.setItem(LS_STAGES_KEY, JSON.stringify(map))
}

const columns = [
  { id: 'new',       label: 'Новые',        color: 'var(--p-text-muted-color)' },
  { id: 'screening', label: 'Скрининг',      color: 'var(--fst-blue)'   },
  { id: 'analysis',  label: 'Анализ',        color: 'var(--fst-brand)'  },
  { id: 'ic_prep',   label: 'Подготовка ИК', color: 'var(--fst-purple)' },
  { id: 'ic',        label: 'На ИК',         color: 'var(--fst-cyan)'   },
  { id: 'approved',  label: 'Одобрено',      color: 'var(--fst-green)'  },
  { id: 'rejected',  label: 'Отклонено',     color: 'var(--fst-red)'    },
]

// ── State ─────────────────────────────────────────────────────────────────────
const loading      = ref(false)
const saving       = ref(false)
const creating     = ref(false)
const selectedDeal = ref(null)
const showNewDeal  = ref(false)
const newDeal = ref({ company: '', subfund: 'БАС', askMln: 100, trl: 5, sovereignty: 6, description: '', source: '', contact: '' })

// Чистим мусорные даты из Integram (год 5500, эпоха 1970 и т.д.)
function cleanDate(raw) {
  if (!raw) return ''
  const match = String(raw).match(/(\d{2})\.(\d{2})\.(\d{4})/)
  if (!match) return String(raw).slice(0, 10)
  const year = parseInt(match[3])
  if (year < 1990 || year > 2100) return ''
  return `${match[3]}-${match[2]}-${match[1]}`
}

// ── Нормализация проекта из Integram → dealflow-карточка ──────────────────────
function normalize(p) {
  const localStages = loadLocalStages()
  const integramStage = STATUS_TO_STAGE[p.statusId] || 'new'
  const stage = localStages[p.id] || integramStage

  return {
    id:           p.id,
    company:      p.name || p.company || '',
    subfund:      SUBFUND_ID_TO_NAME[p.subfundId] || p.subfund || '—',
    stage,
    askMln:       p.amount ? Math.round(p.amount / 1_000_000) : 0,
    trl:          p.trl || 0,
    sovereignty:  p.sovereigntyScore || 0,
    score:        p.trl ? Math.round(40 + p.trl * 5 + (p.sovereigntyScore || 0) * 2) : null,
    receivedDate: cleanDate(p.submittedAt),
    contact:      p.ceoName || '',
    source:       p.source || '',
    description:  (p.description || '').replace(/<[^>]+>/g, '').slice(0, 120),
    hasMedia:     !!p.mediaRef,   // есть прикреплённый документ (питч-дек)
    _statusId:    p.statusId,
  }
}

// ── Deals — реактивный список ─────────────────────────────────────────────────
const deals = computed(() => rawProjects.value.map(normalize))

// ── Загрузка ──────────────────────────────────────────────────────────────────
onMounted(async () => {
  loading.value = true
  try { await loadProjects() } catch { /* offline → deals останутся пустыми */ }
  finally { loading.value = false }
})

async function reload() {
  loading.value = true
  try { await loadProjects(true) } finally { loading.value = false }
}

// ── Computed ──────────────────────────────────────────────────────────────────
const detailVisible = computed({
  get: () => selectedDeal.value !== null,
  set: v => { if (!v) selectedDeal.value = null },
})

const pipelineMetrics = computed(() => {
  const active = deals.value.filter(d => d.stage !== 'rejected')
  return [
    { icon: 'pi pi-inbox',     val: active.length,                                             label: 'В воронке' },
    { icon: 'pi pi-users',     val: dealsInStage('ic').length,                                 label: 'На ИК'     },
    { icon: 'pi pi-check',     val: dealsInStage('approved').length,                           label: 'Одобрено'  },
    { icon: 'pi pi-chart-bar', val: active.reduce((s, d) => s + (d.askMln || 0), 0) + ' млн', label: 'Объём'     },
  ]
})

function dealsInStage(stage) { return deals.value.filter(d => d.stage === stage) }
function openDetail(deal) { selectedDeal.value = deal }

// ── Переходы ──────────────────────────────────────────────────────────────────
const stageOrder = ['new', 'screening', 'analysis', 'ic_prep', 'ic', 'approved']

async function setStage(deal, newStage) {
  saveLocalStage(deal.id, newStage)
  // Обновляем Integram если это значимый этап
  if (STAGE_TO_STATUS[newStage]) {
    saving.value = true
    try {
      const body = new URLSearchParams({ t1184: STAGE_TO_STATUS[newStage], _xsrf: '' })
      await updateProject(deal.id, body)
    } catch { /* silent — локальное изменение всё равно сохранено */ }
    finally { saving.value = false }
  }
  // Принудительно обновляем кэш useFstData
  await loadProjects(true)
  selectedDeal.value = null
}

function moveToNext(deal) {
  const idx = stageOrder.indexOf(deal.stage)
  if (idx < stageOrder.length - 1) setStage(deal, stageOrder[idx + 1])
  else selectedDeal.value = null
}

function rejectDeal(deal)  { setStage(deal, 'rejected') }

async function sendToIC(deal) {
  await setStage(deal, 'ic')
  projStore.setActive({ ...deal, _source: 'dealflow' })
  router.push('/fst-committee')
}

function goToHub(deal) {
  if (!deal) return
  projStore.setActive({ ...deal, _source: 'dealflow' })
  selectedDeal.value = null
  router.push('/fst-project/' + deal.id)
}

// ── Создание новой заявки ────────────────────────────────────────────────────
async function createDeal() {
  creating.value = true
  try {
    const subfundId = SUBFUNDS[newDeal.value.subfund] || null
    await createProject({
      name:             newDeal.value.company,
      amount:           (newDeal.value.askMln || 0) * 1_000_000,
      description:      newDeal.value.description,
      subfundId,
      statusId:         STATUSES['Новый'],
      trl:              newDeal.value.trl,
      sovereigntyScore: newDeal.value.sovereignty,
      submittedAt:      new Date().toISOString(),
    })
    showNewDeal.value = false
    newDeal.value = { company: '', subfund: 'БАС', askMln: 100, trl: 5, sovereignty: 6, description: '', source: '', contact: '' }
    await loadProjects(true)
  } catch (e) {
    console.warn('[Dealflow] createProject failed:', e.message)
    // Fallback: добавляем локально
    showNewDeal.value = false
  } finally {
    creating.value = false
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function subfundColor(s) {
  return { БАС: 'var(--fst-blue)', РОБО: 'var(--fst-green)', МЭ: 'var(--fst-purple)' }[s] || 'var(--p-text-muted-color)'
}
function scoreColor(s) {
  if (s >= 75) return 'var(--fst-green)'
  if (s >= 50) return 'var(--fst-brand)'
  return 'var(--fst-red)'
}

function exportCsv() {
  const rows = [['ID', 'Компания', 'Субфонд', 'Этап', 'Запрос', 'TRL', 'Суверенность', 'Score']]
  deals.value.forEach(d => rows.push([d.id, d.company, d.subfund, d.stage, d.askMln, d.trl, d.sovereignty, d.score]))
  const csv = rows.map(r => r.join(';')).join('\n')
  Object.assign(document.createElement('a'), {
    href: 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv),
    download: 'dealflow.csv',
  }).click()
}
</script>

<style scoped>
/* ─── Metrics flush к краям FstPageLayout body (padding: 20px) ─── */
.df-metrics { margin: -20px -20px 0; }

/* ─── Section wrapper ─── */
.df-section { padding: 16px 24px 20px; display: flex; flex-direction: column; gap: 12px; }

/* ─── Kanban ─── */
.df-kanban  { display: flex; gap: 12px; overflow-x: auto; padding-bottom: 16px; }
.df-column  { min-width: 200px; flex: 1; background: var(--p-surface-ground); border-radius: 10px; display: flex; flex-direction: column; }
.df-col-header { padding: 10px 14px; display: flex; justify-content: space-between; align-items: center; }
.df-col-title  { font-size: 0.82rem; font-weight: 700; color: var(--p-text-color); }
.df-col-badge  { background: color-mix(in srgb, var(--p-text-color) 10%, transparent); border-radius: 20px; padding: 2px 8px; font-size: 0.75rem; color: var(--p-text-muted-color); }
.df-col-body   { padding: 8px; display: flex; flex-direction: column; gap: 8px; flex: 1; }

/* ─── Card ─── */
.df-card        { background: var(--p-surface-card); border: 1px solid var(--p-content-border-color); border-radius: 8px; padding: 10px; cursor: pointer; transition: transform .15s, box-shadow .15s; }
.df-card:hover  { transform: translateY(-2px); box-shadow: 0 4px 12px color-mix(in srgb, var(--p-text-color) 15%, transparent); }
.df-card-top    { display: flex; justify-content: space-between; align-items: center; gap: 6px; margin-bottom: 4px; }
.df-card-name   { font-size: 0.82rem; font-weight: 700; color: var(--p-text-color); }
.df-card-subfund{ font-size: 0.65rem; color: white; padding: 2px 6px; border-radius: 4px; }
.df-card-desc   { font-size: 0.75rem; color: var(--p-text-muted-color); margin-bottom: 6px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.df-card-footer       { display: flex; justify-content: space-between; font-size: 0.72rem; color: var(--p-text-muted-color); }
.df-card-footer-right { display: flex; align-items: center; gap: 4px; }
.df-media-icon        { font-size: 0.68rem; color: var(--fst-cyan); opacity: 0.8; }
.df-card-score  { display: flex; align-items: center; gap: 6px; margin-top: 6px; }
.df-score-bar   { height: 4px; border-radius: 2px; transition: width .3s; }
.df-score-val   { font-size: 0.68rem; color: var(--p-text-muted-color); }

/* ─── Dialog content ─── */
.df-form        { display: flex; flex-direction: column; gap: 12px; }
.df-form-row    { display: flex; flex-direction: column; gap: 4px; }
.df-form-row label { font-size: 0.78rem; font-weight: 600; color: var(--p-text-muted-color); }
.df-detail-row  { display: flex; justify-content: space-between; font-size: 0.88rem; color: var(--p-text-muted-color); border-bottom: 1px dashed var(--p-content-border-color); padding-bottom: 6px; }
.df-detail-row strong { color: var(--p-text-color); }
.df-detail-desc    { font-size: 0.85rem; color: var(--p-text-muted-color); line-height: 1.5; }
.df-detail-section { font-size: 0.78rem; font-weight: 700; color: var(--p-text-color); margin-bottom: 4px; }

@media (max-width: 768px) {
  .df-card-score { flex-wrap: wrap; gap: 8px; }
}
</style>
