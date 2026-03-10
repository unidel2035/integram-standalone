<template>
  <FstPageLayout title="Юридические документы" subtitle="Генератор шаблонов: term sheet, SPA, SHA, NDA, опционные соглашения">
    <template #actions>
      <Button icon="pi pi-plus" label="Создать документ" @click="showGenerator = true" />
    </template>

    <!-- Библиотека документов из базы -->
    <div class="legal-section">
      <div class="lib-header">
        <h2>Библиотека шаблонов</h2>
        <span v-if="loadingTemplates" class="lib-loading">Загрузка...</span>
        <span v-else class="lib-count">{{ allTemplates.length }} шаблонов из базы</span>
      </div>

      <!-- Табы по этапам -->
      <div class="stage-tabs">
        <Button v-for="s in stages" :key="s.id"
          :label="`${s.label} (${templatesByStage[s.id]?.length || 0})`"
          :severity="activeStage === s.id ? undefined : 'secondary'"
          size="small"
          @click="activeStage = s.id" />
      </div>

      <div class="doc-grid" v-if="!loadingTemplates">
        <div v-for="tmpl in currentTemplates" :key="tmpl.id" class="doc-card">
          <div class="doc-card-top">
            <div class="doc-icon">{{ stageIcon(tmpl.stage) }}</div>
            <div class="doc-num">#{{ tmpl.num }}</div>
          </div>
          <div class="doc-name">{{ tmpl.name }}</div>
          <div class="doc-desc">{{ tmpl.desc }}</div>
          <div class="doc-footer">
            <span class="doc-stage-badge" :class="'stage-' + tmpl.stage">Этап {{ tmpl.stage }}</span>
            <div class="doc-btns">
              <a v-if="tmpl.url" :href="tmpl.url" target="_blank" class="icon-btn" title="Открыть файл"><i class="pi pi-eye"></i></a>
              <Button icon="pi pi-copy" severity="secondary" text size="small" v-tooltip="'Создать на основе шаблона'" @click="useTemplate(tmpl)" />
              <Button icon="pi pi-download" severity="secondary" text size="small" v-tooltip="'Скачать'" @click="downloadTemplate(tmpl)" />
            </div>
          </div>
        </div>
        <div v-if="currentTemplates.length === 0" class="doc-empty">Нет шаблонов для этого этапа</div>
      </div>
    </div>

    <!-- Сгенерированные документы -->
    <div class="legal-section">
      <h2>Созданные документы</h2>
      <table class="legal-table">
        <thead>
          <tr>
            <th>Документ</th>
            <th>Компания</th>
            <th>Тип</th>
            <th>Создан</th>
            <th>Статус</th>
            <th>Действия</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="doc in generatedDocs" :key="doc.id">
            <td class="doc-title">{{ doc.name }}</td>
            <td class="doc-co">{{ doc.company }}</td>
            <td><span class="doc-type-badge" :class="doc.type">{{ typeLabel(doc.type) }}</span></td>
            <td class="doc-date">{{ doc.createdAt }}</td>
            <td><span class="doc-status" :class="doc.status">{{ docStatusLabel(doc.status) }}</span></td>
            <td class="doc-actions">
              <Button icon="pi pi-eye" severity="secondary" text size="small" v-tooltip="'Просмотр'" @click="downloadDoc(doc)" />
              <Button icon="pi pi-download" severity="secondary" text size="small" v-tooltip="'Скачать'" @click="downloadDoc(doc)" />
              <Button icon="pi pi-pen-to-square" severity="secondary" text size="small" v-tooltip="'Подписать'" @click="signDoc(doc)" />
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Ключевые условия Term Sheet -->
    <div class="legal-section" v-if="selectedTemplate?.id === 'term_sheet'">
      <h2>Term Sheet — ключевые условия</h2>
      <div class="ts-conditions">
        <div v-for="c in termSheetConditions" :key="c.term" class="ts-cond">
          <div class="tsc-term">{{ c.term }}</div>
          <div class="tsc-input">
            <InputText v-if="c.type === 'text'" v-model="c.value" fluid />
            <Select v-else-if="c.type === 'select'" v-model="c.value" :options="c.options" fluid />
            <InputText v-else v-model.number="c.value" type="number" :step="c.step" fluid />
          </div>
          <div class="tsc-note">{{ c.note }}</div>
        </div>
      </div>
      <Button icon="pi pi-file-edit" label="Сгенерировать Term Sheet" @click="generateTermSheet" />
    </div>

    <!-- Генератор Modal -->
    <Dialog v-model:visible="showGenerator" header="Создать юридический документ" :style="{ width: '380px' }" modal>
      <div class="modal-form">
        <label>Тип документа</label>
        <Select v-model="genForm.templateId" :options="allTemplates" optionLabel="name" optionValue="id" fluid />
        <label>Портфельная компания</label>
        <Select v-model="genForm.company" :options="companyOptions" fluid />
        <label>ИНН контрагента</label>
        <InputText v-model="genForm.inn" placeholder="1234567890" fluid />
        <label>Дата документа</label>
        <InputText v-model="genForm.date" type="date" fluid />
        <label>Юрисдикция</label>
        <Select v-model="genForm.jurisdiction" :options="jurisdictionOptions" fluid />
      </div>
      <template #footer>
        <div class="modal-actions">
          <Button icon="pi pi-times" label="Отмена" severity="secondary" @click="showGenerator = false" />
          <Button icon="pi pi-check" label="Создать документ" @click="generateDoc" />
        </div>
      </template>
    </Dialog>
  </FstPageLayout>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import FstPageLayout from '@/components/fst-shared/FstPageLayout.vue'
import { getDocumentTemplates } from '@/services/fstApi'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import Dialog from 'primevue/dialog'

const showGenerator = ref(false)
const selectedTemplate = ref(null)
const loadingTemplates = ref(true)

const companyOptions = ['АгроДрон', 'RoboFarm', 'МедТех БПЛА', 'DroneLogistics', 'CyberPilot', 'Другая']
const jurisdictionOptions = ['Российская Федерация', 'Республика Беларусь', 'Республика Казахстан']
const allTemplates = ref([])
const activeStage = ref(0)

const stages = [
  { id: 0, label: 'Этап 0 — Преамбула' },
  { id: 1, label: 'Этап 1 — Знакомство' },
  { id: 2, label: 'Этап 2 — Due Diligence' },
  { id: 3, label: 'Этап 3 — Юр. оформление' },
]

onMounted(async () => {
  try {
    allTemplates.value = await getDocumentTemplates()
  } catch (e) {
    console.error('Failed to load templates:', e)
  } finally {
    loadingTemplates.value = false
  }
})

const templatesByStage = computed(() => {
  const map = {}
  for (const t of allTemplates.value) {
    if (!map[t.stage]) map[t.stage] = []
    map[t.stage].push(t)
  }
  return map
})

const currentTemplates = computed(() => templatesByStage.value[activeStage.value] || [])

function stageIcon(stage) {
  return ['🔒', '📋', '🔍', '📝'][stage] || '📄'
}

function useTemplate(tmpl) {
  genForm.value.templateName = tmpl.name
  showGenerator.value = true
}
function downloadTemplate(tmpl) {
  if (tmpl.url) window.open(tmpl.url, '_blank')
  else alert('Файл шаблона не прикреплён: ' + tmpl.name)
}

function typeLabel(t) { return { investment: 'Инвест.', legal: 'Правовой', hr: 'HR' }[t] || t }

const generatedDocs = ref([
  { id: 1, name: 'Term Sheet — АгроДрон Серия A', company: 'АгроДрон', type: 'investment', createdAt: '2024-02-15', status: 'signed'   },
  { id: 2, name: 'SHA — АгроДрон',                company: 'АгроДрон', type: 'investment', createdAt: '2024-03-01', status: 'signed'   },
  { id: 3, name: 'NDA — НейроМат',                company: 'НейроМат', type: 'legal',      createdAt: '2026-01-10', status: 'signed'   },
  { id: 4, name: 'Term Sheet — НейроМат Серия A', company: 'НейроМат', type: 'investment', createdAt: '2026-02-01', status: 'draft'    },
  { id: 5, name: 'KN — AeroSpace Rus',            company: 'AeroSpace Rus', type: 'investment', createdAt: '2026-03-01', status: 'review' }
])

function docStatusLabel(s) { return { signed: 'Подписан', draft: 'Черновик', review: 'На проверке' }[s] || s }
function downloadDoc(doc) { alert('Скачивание: ' + doc.name) }
function signDoc(doc) { alert('Запуск подписания (КЭП): ' + doc.name) }

const termSheetConditions = ref([
  { term: 'Объём инвестиции, млн ₽', type: 'number', value: 150, step: 10,  note: 'Сумма раунда ФСТ' },
  { term: 'Pre-money оценка, млн ₽', type: 'number', value: 850, step: 50,  note: 'Согласованная pre-money' },
  { term: 'Тип бумаг',               type: 'select', value: 'Привилег. акции', options: ['Привилег. акции', 'Обыкн. акции', 'Конв. нота'], note: '' },
  { term: 'Ликв. предпочтение',      type: 'select', value: '1x non-participating', options: ['1x non-participating', '1x participating', '2x non-participating'], note: '' },
  { term: 'Антиразводнение',         type: 'select', value: 'Broad-based WA', options: ['Full ratchet', 'Broad-based WA', 'Narrow-based WA'], note: '' },
  { term: 'Место в СД',              type: 'text',   value: '1 директор ФСТ', note: 'Состав совета директоров' },
  { term: 'Pro-rata право',          type: 'select', value: 'Да (все будущие раунды)', options: ['Да (все будущие раунды)', 'Да (след. раунд)', 'Нет'], note: '' },
  { term: 'Lock-up основателей',     type: 'text',   value: '36 месяцев, vesting', note: 'Период блокировки' },
  { term: 'Drag-along порог',        type: 'text',   value: '75% акций', note: 'Порог для drag-along' },
  { term: 'Клозинг, не позже',       type: 'text',   value: '2026-06-30', note: 'Дата закрытия сделки' }
])

function generateTermSheet() { alert('Term Sheet сгенерирован и добавлен в библиотеку') }

const genForm = ref({ templateId: 'nda', company: 'АгроДрон', inn: '', date: '', jurisdiction: 'Российская Федерация' })

function generateDoc() {
  const tmpl = templates.value.find(t => t.id === genForm.value.templateId)
  generatedDocs.value.unshift({
    id: Date.now(),
    name: `${tmpl?.name} — ${genForm.value.company}`,
    company: genForm.value.company,
    type: tmpl?.type || 'legal',
    createdAt: genForm.value.date || new Date().toISOString().slice(0, 10),
    status: 'draft'
  })
  showGenerator.value = false
}
</script>

<style scoped>
.legal-section { background: var(--p-surface-card); border: 1px solid var(--p-content-border-color); border-radius: 10px; padding: 18px; overflow-x: auto; }
.legal-section h2 { margin: 0 0 14px; font-size: 1.05rem; color: var(--p-text-color); }

.lib-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
.lib-header h2 { margin: 0; font-size: 1.05rem; color: var(--p-text-color); }
.lib-loading { font-size: 0.78rem; color: var(--p-text-muted-color); }
.lib-count { font-size: 0.78rem; color: var(--p-text-muted-color); }

.stage-tabs { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 14px; }

.doc-card-top { display: flex; align-items: center; justify-content: space-between; }
.doc-footer { display: flex; align-items: center; justify-content: space-between; margin-top: auto; }
.doc-btns { display: flex; gap: 4px; }
.icon-btn { width: 28px; height: 28px; border-radius: 6px; border: 1px solid var(--p-content-border-color); background: var(--p-surface-card); color: var(--p-text-muted-color); cursor: pointer; display: inline-flex; align-items: center; justify-content: center; font-size: 0.8rem; transition: all 0.15s; text-decoration: none; }
.icon-btn:hover { border-color: var(--p-primary-color); color: var(--p-primary-color); }
.doc-card { display: flex; flex-direction: column; gap: 5px; }
.doc-empty { grid-column: 1/-1; text-align: center; padding: 24px; color: var(--p-text-muted-color); font-size: 0.85rem; }
.doc-num { font-size: 0.68rem; color: var(--p-text-muted-color); font-weight: 600; }
.doc-stage-badge { font-size: 0.68rem; padding: 2px 7px; border-radius: 4px; font-weight: 600; }
.doc-stage-badge.stage-0 { background: color-mix(in srgb, var(--fst-blue) 13%, transparent); color: var(--fst-blue); }
.doc-stage-badge.stage-1 { background: color-mix(in srgb, var(--fst-green) 13%, transparent); color: var(--fst-green); }
.doc-stage-badge.stage-2 { background: color-mix(in srgb, var(--fst-brand) 13%, transparent); color: var(--fst-brand); }
.doc-stage-badge.stage-3 { background: color-mix(in srgb, var(--p-primary-color) 13%, transparent); color: var(--p-primary-color); }

.preview-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px; }
.preview-stage { font-size: 0.72rem; color: var(--p-text-muted-color); margin-bottom: 4px; }
.preview-header h3 { margin: 0; font-size: 1rem; color: var(--p-text-color); }
.close-btn { background: none; border: none; cursor: pointer; font-size: 1.1rem; color: var(--p-text-muted-color); padding: 2px 6px; }
.preview-desc { font-size: 0.85rem; color: var(--p-text-muted-color); margin: 0 0 16px; line-height: 1.5; }
.preview-actions { display: flex; gap: 8px; flex-wrap: wrap; }
.modal-wide { width: 520px; }
a.legal-btn { text-decoration: none; display: inline-flex; align-items: center; }

.doc-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; }
.doc-card { background: var(--p-surface-ground); border: 1px solid var(--p-content-border-color); border-radius: 8px; padding: 14px; cursor: pointer; transition: border-color 0.2s; display: flex; flex-direction: column; gap: 6px; }
.doc-card:hover { border-color: var(--p-primary-color); }
.doc-icon { font-size: 1.8rem; }
.doc-name { font-weight: 700; font-size: 0.88rem; color: var(--p-text-color); }
.doc-desc { font-size: 0.72rem; color: var(--p-text-muted-color); flex: 1; }
.doc-meta { display: flex; align-items: center; justify-content: space-between; }
.doc-type { font-size: 0.68rem; padding: 2px 7px; border-radius: 4px; font-weight: 600; }
.doc-type.investment { background: var(--p-primary-color); color: white; }
.doc-type.legal { background: color-mix(in srgb, var(--fst-blue) 13%, transparent); color: var(--fst-blue); }
.doc-type.hr { background: color-mix(in srgb, var(--fst-green) 13%, transparent); color: var(--fst-green); }
.doc-pages { font-size: 0.68rem; color: var(--p-text-muted-color); }

.legal-table { width: 100%; border-collapse: collapse; font-size: 0.82rem; min-width: 600px; }
.legal-table th { padding: 7px 10px; text-align: left; color: var(--p-text-muted-color); border-bottom: 1px solid var(--p-content-border-color); font-size: 0.72rem; }
.legal-table td { padding: 8px 10px; border-bottom: 1px solid var(--p-content-border-color); color: var(--p-text-color); }
.doc-title { font-weight: 600; }
.doc-co { font-size: 0.75rem; color: var(--p-text-muted-color); }
.doc-type-badge { padding: 2px 7px; border-radius: 4px; font-size: 0.68rem; font-weight: 600; }
.doc-date { font-size: 0.75rem; color: var(--p-text-muted-color); }
.doc-status { padding: 2px 7px; border-radius: 4px; font-size: 0.68rem; font-weight: 600; }
.doc-status.signed { background: color-mix(in srgb, var(--fst-green) 13%, transparent); color: var(--fst-green); }
.doc-status.draft  { background: var(--p-surface-ground); color: var(--p-text-muted-color); border: 1px solid var(--p-content-border-color); }
.doc-status.review { background: color-mix(in srgb, var(--fst-brand) 13%, transparent); color: var(--fst-brand); }
.doc-actions { display: flex; gap: 6px; }

.ts-conditions { display: flex; flex-direction: column; gap: 8px; margin-bottom: 14px; }
.ts-cond { display: grid; grid-template-columns: 220px 1fr; gap: 10px; align-items: center; padding: 8px; background: var(--p-surface-ground); border-radius: 6px; }
.tsc-term  { font-size: 0.82rem; font-weight: 600; color: var(--p-text-color); }
.tsc-note  { font-size: 0.68rem; color: var(--p-text-muted-color); grid-column: 1 / -1; }

.modal-form { display: flex; flex-direction: column; gap: 8px; margin-bottom: 16px; }
.modal-form label { font-size: 0.75rem; color: var(--p-text-muted-color); }
.modal-actions { display: flex; gap: 8px; justify-content: flex-end; }

/* ── Mobile adaptive ── */
@media (max-width: 768px) {
  .legal-table { display: block; overflow-x: auto; -webkit-overflow-scrolling: touch; min-width: unset !important; }
  .doc-grid { grid-template-columns: 1fr !important; }
  .ts-cond { grid-template-columns: 1fr !important; }
  .legal-table-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }
}
</style>
