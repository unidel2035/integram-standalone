<template>
  <div class="legal-root">
    <div class="legal-header">
      <div>
        <h1>Юридические документы</h1>
        <span class="legal-sub">Генератор шаблонов: term sheet, SPA, SHA, NDA, опционные соглашения</span>
      </div>
      <button class="legal-btn primary" @click="showGenerator = true">Создать документ</button>
    </div>

    <!-- Библиотека документов -->
    <div class="legal-section">
      <h2>Библиотека шаблонов</h2>
      <div class="doc-grid">
        <div v-for="tmpl in templates" :key="tmpl.id" class="doc-card" @click="selectTemplate(tmpl)">
          <div class="doc-icon">{{ tmpl.icon }}</div>
          <div class="doc-name">{{ tmpl.name }}</div>
          <div class="doc-desc">{{ tmpl.desc }}</div>
          <div class="doc-meta">
            <span class="doc-type" :class="tmpl.type">{{ typeLabel(tmpl.type) }}</span>
            <span class="doc-pages">{{ tmpl.pages }} стр.</span>
          </div>
        </div>
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
              <button class="action-btn" @click="downloadDoc(doc)">Скачать</button>
              <button class="action-btn" @click="signDoc(doc)">Подписать</button>
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
            <input v-if="c.type === 'text'" v-model="c.value" />
            <select v-else-if="c.type === 'select'" v-model="c.value">
              <option v-for="opt in c.options" :key="opt">{{ opt }}</option>
            </select>
            <input v-else v-model.number="c.value" type="number" :step="c.step" />
          </div>
          <div class="tsc-note">{{ c.note }}</div>
        </div>
      </div>
      <button class="legal-btn primary" @click="generateTermSheet">Сгенерировать Term Sheet</button>
    </div>

    <!-- Генератор Modal -->
    <div v-if="showGenerator" class="modal-overlay" @click.self="showGenerator = false">
      <div class="modal-box">
        <h3>Создать юридический документ</h3>
        <div class="modal-form">
          <label>Тип документа</label>
          <select v-model="genForm.templateId">
            <option v-for="t in templates" :key="t.id" :value="t.id">{{ t.name }}</option>
          </select>
          <label>Портфельная компания</label>
          <select v-model="genForm.company">
            <option>АгроДрон</option><option>RoboFarm</option><option>МедТех БПЛА</option>
            <option>DroneLogistics</option><option>CyberPilot</option><option>Другая</option>
          </select>
          <label>ИНН контрагента</label>
          <input v-model="genForm.inn" placeholder="1234567890" />
          <label>Дата документа</label>
          <input v-model="genForm.date" type="date" />
          <label>Юрисдикция</label>
          <select v-model="genForm.jurisdiction">
            <option>Российская Федерация</option>
            <option>Республика Беларусь</option>
            <option>Республика Казахстан</option>
          </select>
        </div>
        <div class="modal-actions">
          <button class="legal-btn secondary" @click="showGenerator = false">Отмена</button>
          <button class="legal-btn primary" @click="generateDoc">Создать документ</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const showGenerator = ref(false)
const selectedTemplate = ref(null)

const templates = ref([
  { id: 'term_sheet', icon: '📋', name: 'Term Sheet', desc: 'Предварительное соглашение об инвестиции', type: 'investment', pages: 8 },
  { id: 'spa',        icon: '📄', name: 'SPA (договор купли-продажи акций)', desc: 'Share Purchase Agreement по ГК РФ', type: 'investment', pages: 45 },
  { id: 'sha',        icon: '🤝', name: 'SHA (соглашение акционеров)', desc: 'Drag-along, tag-along, антиразводнение', type: 'investment', pages: 30 },
  { id: 'nda',        icon: '🔐', name: 'NDA (соглашение о конфиденциальности)', desc: 'По ФЗ-98 о коммерческой тайне', type: 'legal', pages: 6 },
  { id: 'option',     icon: '📈', name: 'Опционное соглашение (ESOP)', desc: 'Опционы для команды, vesting 4 года', type: 'hr', pages: 15 },
  { id: 'loan',       icon: '💰', name: 'Конвертируемая нота (KN)', desc: 'Прозрачный мост до следующего раунда', type: 'investment', pages: 12 }
])

function selectTemplate(tmpl) { selectedTemplate.value = tmpl }
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
.legal-root { padding: 24px; display: flex; flex-direction: column; gap: 20px; min-height: 100vh; background: var(--p-surface-ground); }
.legal-header { display: flex; align-items: flex-start; justify-content: space-between; flex-wrap: wrap; gap: 12px; }
.legal-header h1 { margin: 0; font-size: 1.5rem; color: var(--p-text-color); }
.legal-sub { font-size: 0.85rem; color: var(--p-text-muted-color); }
.legal-btn { padding: 8px 14px; border-radius: 8px; border: none; cursor: pointer; font-size: 0.83rem; font-weight: 600; }
.legal-btn.primary  { background: var(--p-primary-color); color: #fff; }
.legal-btn.secondary{ background: var(--p-surface-card); color: var(--p-text-color); border: 1px solid var(--p-surface-border); }

.legal-section { background: var(--p-content-background); border: 1px solid var(--p-surface-border); border-radius: 10px; padding: 18px; overflow-x: auto; }
.legal-section h2 { margin: 0 0 14px; font-size: 1.05rem; color: var(--p-text-color); }

.doc-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; }
.doc-card { background: var(--p-surface-ground); border: 1px solid var(--p-surface-border); border-radius: 8px; padding: 14px; cursor: pointer; transition: border-color 0.2s; display: flex; flex-direction: column; gap: 6px; }
.doc-card:hover { border-color: var(--p-primary-color); }
.doc-icon { font-size: 1.8rem; }
.doc-name { font-weight: 700; font-size: 0.88rem; color: var(--p-text-color); }
.doc-desc { font-size: 0.72rem; color: var(--p-text-muted-color); flex: 1; }
.doc-meta { display: flex; align-items: center; justify-content: space-between; }
.doc-type { font-size: 0.68rem; padding: 2px 7px; border-radius: 4px; font-weight: 600; }
.doc-type.investment { background: var(--p-primary-color); color: #fff; }
.doc-type.legal { background: #42a5f522; color: #42a5f5; }
.doc-type.hr { background: #66bb6a22; color: #66bb6a; }
.doc-pages { font-size: 0.68rem; color: var(--p-text-muted-color); }

.legal-table { width: 100%; border-collapse: collapse; font-size: 0.82rem; min-width: 600px; }
.legal-table th { padding: 7px 10px; text-align: left; color: var(--p-text-muted-color); border-bottom: 1px solid var(--p-surface-border); font-size: 0.72rem; }
.legal-table td { padding: 8px 10px; border-bottom: 1px solid var(--p-surface-border); color: var(--p-text-color); }
.doc-title { font-weight: 600; }
.doc-co { font-size: 0.75rem; color: var(--p-text-muted-color); }
.doc-type-badge { padding: 2px 7px; border-radius: 4px; font-size: 0.68rem; font-weight: 600; }
.doc-date { font-size: 0.75rem; color: var(--p-text-muted-color); }
.doc-status { padding: 2px 7px; border-radius: 4px; font-size: 0.68rem; font-weight: 600; }
.doc-status.signed { background: #66bb6a22; color: #66bb6a; }
.doc-status.draft  { background: var(--p-surface-ground); color: var(--p-text-muted-color); border: 1px solid var(--p-surface-border); }
.doc-status.review { background: #ff980022; color: #ff9800; }
.doc-actions { display: flex; gap: 6px; }
.action-btn { padding: 3px 10px; border-radius: 5px; border: 1px solid var(--p-surface-border); background: var(--p-surface-card); color: var(--p-text-color); cursor: pointer; font-size: 0.72rem; }

.ts-conditions { display: flex; flex-direction: column; gap: 8px; margin-bottom: 14px; }
.ts-cond { display: grid; grid-template-columns: 220px 1fr; gap: 10px; align-items: center; padding: 8px; background: var(--p-surface-ground); border-radius: 6px; }
.tsc-term  { font-size: 0.82rem; font-weight: 600; color: var(--p-text-color); }
.tsc-input input, .tsc-input select { background: var(--p-content-background); border: 1px solid var(--p-surface-border); border-radius: 6px; padding: 5px 10px; color: var(--p-text-color); font-size: 0.82rem; width: 100%; }
.tsc-note  { font-size: 0.68rem; color: var(--p-text-muted-color); grid-column: 1 / -1; }

.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 100; }
.modal-box { background: var(--p-content-background); border-radius: 12px; padding: 24px; width: 380px; max-width: 95vw; }
.modal-box h3 { margin: 0 0 16px; }
.modal-form { display: flex; flex-direction: column; gap: 8px; margin-bottom: 16px; }
.modal-form label { font-size: 0.75rem; color: var(--p-text-muted-color); }
.modal-form input, .modal-form select { background: var(--p-surface-ground); border: 1px solid var(--p-surface-border); border-radius: 6px; padding: 7px 10px; color: var(--p-text-color); font-size: 0.85rem; width: 100%; }
.modal-actions { display: flex; gap: 8px; justify-content: flex-end; }
</style>
