<template>
  <FstPageLayout title="Воронка входящих заявок" subtitle="Deal Flow — управление потоком заявок от первичного контакта до ИК">
    <template #actions>
      <Button icon="pi pi-plus" label="Новая заявка" size="small" severity="success" @click="showNewDeal = true" />
      <Button icon="pi pi-download" label="CSV" size="small" severity="secondary" @click="exportCsv" />
    </template>

    <!-- ─── Metrics strip (flush к краям) ─── -->
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
                  <span>{{ deal.askMln }} млн ₽</span>
                  <span>{{ deal.receivedDate }}</span>
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
        <Button label="Перевести →" icon="pi pi-arrow-right" @click="moveToNext(selectedDeal)" />
        <Button label="Отклонить" severity="danger" icon="pi pi-times" @click="rejectDeal(selectedDeal)" />
        <Button label="На ИК" severity="success" icon="pi pi-send" @click="sendToIC(selectedDeal)" />
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
        <Button label="Создать заявку" icon="pi pi-check" severity="success" fluid @click="createDeal" />
      </template>
    </Dialog>
  </FstPageLayout>
</template>

<script setup>
import { ref, computed } from 'vue'
import FstPageLayout from '@/components/fst-shared/FstPageLayout.vue'
import FeatureHint from '@/components/FeatureHint.vue'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import Select from 'primevue/select'
import Textarea from 'primevue/textarea'

const subfundOptions = ['БАС', 'РОБО', 'МЭ']

const columns = [
  { id: 'new',       label: 'Новые',        color: 'var(--p-text-muted-color)' },
  { id: 'screening', label: 'Скрининг',      color: 'var(--fst-blue)'   },
  { id: 'analysis',  label: 'Анализ',        color: 'var(--fst-brand)'  },
  { id: 'ic_prep',   label: 'Подготовка ИК', color: 'var(--fst-purple)' },
  { id: 'ic',        label: 'На ИК',         color: 'var(--fst-cyan)'   },
  { id: 'approved',  label: 'Одобрено',      color: 'var(--fst-green)'  },
  { id: 'rejected',  label: 'Отклонено',     color: 'var(--fst-red)'    },
]

const deals = ref([
  { id: 1, company: 'ООО ДронСервис',  subfund: 'БАС',  stage: 'screening', askMln: 80,  trl: 5, sovereignty: 7, score: 72, receivedDate: '2026-02-10', contact: 'Петров Д.А.',    source: 'Партнёр',           description: 'Сервисное обслуживание БПЛА для нефтегаза. LOI с Лукойл.' },
  { id: 2, company: 'АО НейроПилот',   subfund: 'БАС',  stage: 'analysis',  askMln: 150, trl: 6, sovereignty: 8, score: 85, receivedDate: '2026-02-05', contact: 'Соколова М.В.', source: 'Конференция',        description: 'AI-система управления роем БПЛА. 3 патента, партнёрство с МФТИ.' },
  { id: 3, company: 'ООО РоботМед',    subfund: 'РОБО', stage: 'ic_prep',   askMln: 200, trl: 7, sovereignty: 6, score: 79, receivedDate: '2026-01-28', contact: 'Карпов И.С.',    source: 'ФРИИ',              description: 'Хирургические роботы для минимально инвазивных операций. CE Mark получен.' },
  { id: 4, company: 'АО ЧипРус',       subfund: 'МЭ',   stage: 'new',       askMln: 300, trl: 4, sovereignty: 9, score: 61, receivedDate: '2026-02-18', contact: 'Новиков А.Р.',   source: 'Прямое обращение',  description: 'Производство микросхем памяти DDR5 на отечественной элементной базе.' },
  { id: 5, company: 'ООО АгроВижн',    subfund: 'РОБО', stage: 'ic',        askMln: 120, trl: 7, sovereignty: 7, score: 88, receivedDate: '2026-01-15', contact: 'Сидорова П.К.',  source: 'Акселератор',       description: 'Компьютерное зрение для сельского хозяйства. Выручка 45 млн/год.' },
  { id: 6, company: 'ООО КиберЗащита', subfund: 'МЭ',   stage: 'rejected',  askMln: 50,  trl: 3, sovereignty: 4, score: 35, receivedDate: '2026-01-20', contact: 'Попов Р.В.',     source: 'Email',             description: 'Отклонено: низкий TRL, нет продаж.' },
  { id: 7, company: 'АО ФотонКС',      subfund: 'МЭ',   stage: 'approved',  askMln: 180, trl: 8, sovereignty: 8, score: 91, receivedDate: '2025-12-10', contact: 'Беляев А.М.',    source: 'ВЭБ.РФ',           description: 'Фотонные интегральные схемы для телекоммуникаций.' },
])

const selectedDeal = ref(null)
const showNewDeal  = ref(false)
const newDeal = ref({ company: '', subfund: 'БАС', askMln: 100, trl: 5, sovereignty: 6, description: '', source: '', contact: '' })

const detailVisible = computed({
  get: () => selectedDeal.value !== null,
  set: v => { if (!v) selectedDeal.value = null },
})

const pipelineMetrics = computed(() => {
  const active = deals.value.filter(d => d.stage !== 'rejected')
  return [
    { icon: 'pi pi-inbox',     val: active.length,                                              label: 'В воронке' },
    { icon: 'pi pi-users',     val: dealsInStage('ic').length,                                  label: 'На ИК'     },
    { icon: 'pi pi-check',     val: dealsInStage('approved').length,                            label: 'Одобрено'  },
    { icon: 'pi pi-chart-bar', val: active.reduce((s, d) => s + (d.askMln || 0), 0) + ' млн',  label: 'Объём'     },
  ]
})

function dealsInStage(stage) { return deals.value.filter(d => d.stage === stage) }

function openDetail(deal) { selectedDeal.value = deal }

function subfundColor(s) {
  return { БАС: 'var(--fst-blue)', РОБО: 'var(--fst-green)', МЭ: 'var(--fst-purple)' }[s] || 'var(--p-text-muted-color)'
}
function scoreColor(s) {
  if (s >= 75) return 'var(--fst-green)'
  if (s >= 50) return 'var(--fst-brand)'
  return 'var(--fst-red)'
}
function moveToNext(deal) {
  const order = ['new', 'screening', 'analysis', 'ic_prep', 'ic', 'approved']
  const idx = order.indexOf(deal.stage)
  if (idx < order.length - 1) deal.stage = order[idx + 1]
  selectedDeal.value = null
}
function rejectDeal(deal) { deal.stage = 'rejected'; selectedDeal.value = null }
function sendToIC(deal)   { deal.stage = 'ic';       selectedDeal.value = null }
function createDeal() {
  deals.value.push({
    ...newDeal.value,
    id: Date.now(),
    stage: 'new',
    score: Math.round(40 + Math.random() * 40),
    receivedDate: new Date().toISOString().slice(0, 10),
  })
  showNewDeal.value = false
  newDeal.value = { company: '', subfund: 'БАС', askMln: 100, trl: 5, sovereignty: 6, description: '', source: '', contact: '' }
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
.df-card-footer { display: flex; justify-content: space-between; font-size: 0.72rem; color: var(--p-text-muted-color); }
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
