<template>
  <FstPageLayout title="AI Due Diligence" subtitle="Due Diligence — углублённая проверка перед инвестицией">
    <template #actions>
      <Button label="Экспорт DD-отчёта" size="small" severity="secondary" @click="exportDd" />
      <Button label="+ Новая проверка" size="small" @click="showNewDd = true" />
    </template>

    <div class="dd-content">

    <!-- Активные DD -->
    <div class="dd-active-list">
      <div v-for="dd in activeDds" :key="dd.id" class="dd-card" :class="{ selected: selectedDd?.id === dd.id }" @click="selectedDd = dd">
        <div class="dd-card-header">
          <div class="dd-co-name">{{ dd.company }}</div>
          <span class="dd-stage" :class="dd.stage">{{ stageLabel(dd.stage) }}</span>
        </div>
        <div class="dd-progress-bar">
          <div class="dd-fill" :style="{ width: dd.progress + '%' }"></div>
        </div>
        <div class="dd-meta">
          <span>Прогресс: {{ dd.progress }}%</span>
          <span>{{ dd.daysRunning }} дн. в работе</span>
        </div>
      </div>
    </div>

    <!-- Детали выбранного DD -->
    <div v-if="selectedDd" class="dd-detail">
      <div class="dd-section-title">{{ selectedDd.company }} — Due Diligence</div>

      <div class="dd-tabs">
        <SelectButton v-model="ddActiveTab" :options="ddTabs" optionLabel="label" optionValue="id" :allowEmpty="false" size="small" />
      </div>

      <!-- Правовой блок -->
      <div v-if="ddActiveTab === 'legal'" class="dd-block">
        <div class="dd-block-title">Правовая проверка</div>
        <div class="check-grid">
          <div v-for="item in legalChecks" :key="item.label" class="dd-check" :class="item.result">
            <div class="check-icon">{{ checkIcon(item.result) }}</div>
            <div class="check-content">
              <div class="check-label">{{ item.label }}</div>
              <div class="check-detail">{{ item.detail }}</div>
            </div>
            <div class="check-source">{{ item.source }}</div>
          </div>
        </div>
      </div>

      <!-- Финансовый блок -->
      <div v-if="ddActiveTab === 'financial'" class="dd-block">
        <div class="dd-block-title">Финансовый анализ</div>
        <div class="fin-metrics">
          <div v-for="m in finMetrics" :key="m.label" class="fin-metric">
            <div class="fm-label">{{ m.label }}</div>
            <div class="fm-val" :class="m.color">{{ m.value }}</div>
            <div class="fm-comment">{{ m.comment }}</div>
          </div>
        </div>
        <div class="dd-redflags" v-if="redFlags.length">
          <div class="dd-block-title" style="color: var(--fst-red)">Красные флаги</div>
          <div v-for="rf in redFlags" :key="rf" class="redflag">! {{ rf }}</div>
        </div>
      </div>

      <!-- Технологический блок -->
      <div v-if="ddActiveTab === 'tech'" class="dd-block">
        <div class="dd-block-title">Технологический Due Diligence</div>
        <div class="tech-items">
          <div v-for="item in techChecks" :key="item.area" class="tech-item">
            <div class="ti-area">{{ item.area }}</div>
            <div class="ti-score-bar">
              <div class="ti-fill" :style="{ width: item.score * 10 + '%', background: item.score >= 7 ? 'var(--fst-green)' : item.score >= 5 ? 'var(--fst-brand)' : 'var(--fst-red)' }"></div>
            </div>
            <div class="ti-score">{{ item.score }}/10</div>
            <div class="ti-finding">{{ item.finding }}</div>
          </div>
        </div>
      </div>

      <!-- AI-саммари -->
      <div v-if="ddActiveTab === 'summary'" class="dd-block">
        <div class="dd-block-title">AI-сводка Due Diligence</div>
        <div class="dd-verdict" :class="selectedDd.verdict">
          <div class="verdict-icon">{{ selectedDd.verdict === 'proceed' ? '✓' : selectedDd.verdict === 'caution' ? '!' : '✗' }}</div>
          <div>
            <div class="verdict-title">{{ verdictLabel(selectedDd.verdict) }}</div>
            <div class="verdict-text">{{ selectedDd.verdictText }}</div>
          </div>
        </div>
        <div class="dd-strengths">
          <div class="dd-block-title">Сильные стороны</div>
          <ul><li v-for="s in selectedDd.strengths" :key="s">{{ s }}</li></ul>
        </div>
        <div class="dd-risks">
          <div class="dd-block-title" style="color: var(--fst-brand)">Риски к управлению</div>
          <ul><li v-for="r in selectedDd.risks" :key="r">{{ r }}</li></ul>
        </div>
      </div>
    </div>

    </div><!-- /dd-content -->

    <!-- Новая DD Modal -->
    <Dialog v-model:visible="showNewDd" header="Новая DD-проверка" :style="{ width: '380px' }" modal>
      <div class="modal-form">
        <label>Компания</label>
        <InputText v-model="newDd.company" placeholder="Название стартапа" fluid />
        <label>ИНН</label>
        <InputText v-model="newDd.inn" placeholder="1234567890" fluid />
        <label>Тип проверки</label>
        <Select v-model="newDd.type" :options="ddTypeOptions" optionLabel="label" optionValue="value" fluid />
        <label>Приоритет</label>
        <Select v-model="newDd.priority" :options="priorityOptions" fluid />
      </div>
      <template #footer>
        <div class="modal-actions">
          <Button label="Отмена" severity="secondary" @click="showNewDd = false" />
          <Button label="Запустить DD" @click="startDd" />
        </div>
      </template>
    </Dialog>
  </FstPageLayout>
</template>

<script setup>
import { ref } from 'vue'
import FstPageLayout from '@/components/fst-shared/FstPageLayout.vue'
import { useEventStore } from '@/stores/eventStore.js'
import Button from 'primevue/button'
import SelectButton from 'primevue/selectbutton'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import Dialog from 'primevue/dialog'

const eventStore = useEventStore()

const showNewDd  = ref(false)
const ddActiveTab = ref('legal')

const ddTypeOptions = [
  { label: 'Полная DD (4-6 недель)', value: 'full' },
  { label: 'Быстрая DD (2 недели)', value: 'fast' },
  { label: 'Экспресс-скоринг (3 дня)', value: 'express' }
]
const priorityOptions = ['Высокий', 'Средний', 'Низкий']

const ddTabs = [
  { id: 'legal',     label: 'Правовой' },
  { id: 'financial', label: 'Финансовый' },
  { id: 'tech',      label: 'Технологический' },
  { id: 'summary',   label: 'AI-сводка' }
]

const activeDds = ref([
  { id: 1, company: 'АгроДрон',      stage: 'complete', progress: 100, daysRunning: 28, verdict: 'proceed',
    verdictText: 'Компания демонстрирует сильные показатели по всем блокам DD. Рекомендовано к инвестированию.',
    strengths: ['TRL 7 — реальные коммерческие продажи', 'Патентная защита 4 изобретений', 'Команда с опытом в БПЛА >5 лет'],
    risks: ['Зависимость от 1 крупного клиента (40% выручки)', 'Требуется локализация ПО с Pixhawk на рос. аналог'] },
  { id: 2, company: 'НейроМат',       stage: 'in_progress', progress: 65, daysRunning: 12, verdict: 'caution',
    verdictText: 'Сильная технология, но правовые вопросы по ИС требуют прояснения перед принятием решения.',
    strengths: ['Уникальный алгоритм нейрокомпозитов', 'Рынок растёт >80% в год'],
    risks: ['ИС частично не зарегистрирована в РФ', 'Burn rate >12 млн ₽/мес — требуется доп. финансирование'] },
  { id: 3, company: 'AeroSpace Rus', stage: 'pending', progress: 15, daysRunning: 3, verdict: 'pending',
    verdictText: 'DD только начата. Предварительные данные позитивные.',
    strengths: [], risks: [] }
])

const selectedDd = ref(activeDds.value[0])

function stageLabel(s) { return { complete: 'Завершён', in_progress: 'В работе', pending: 'Начат' }[s] || s }
function verdictLabel(v) { return { proceed: 'РЕКОМЕНДОВАТЬ к инвестированию', caution: 'УСЛОВНО — устранить замечания', reject: 'ОТКАЗАТЬ', pending: 'Решение не принято' }[v] || v }
function checkIcon(r) { return { ok: '✓', warn: '!', fail: '✗', pending: '○' }[r] || '?' }

const legalChecks = ref([
  { label: 'Регистрация в ЕГРЮЛ',              result: 'ok',   detail: 'ООО, зарег. 2022-04-15, действует',   source: 'ФНС' },
  { label: 'Устав без ограничений',             result: 'ok',   detail: 'Ограничений для ИИ нет',              source: 'Устав' },
  { label: 'Судебные разбирательства',          result: 'ok',   detail: 'Арбитражных дел нет',                 source: 'Картотека арб. дел' },
  { label: 'Задолженность перед ФНС',           result: 'ok',   detail: 'Задолженностей нет',                  source: 'ФНС' },
  { label: 'Санкционные списки',                result: 'ok',   detail: 'Не обнаружено',                       source: 'Росфинмониторинг' },
  { label: 'Права ИС (патенты)',                result: 'ok',   detail: '4 патента: 2024P001234 – 237',        source: 'Роспатент' },
  { label: 'Трудовые договора с R&D',           result: 'warn', detail: '2 ключевых сотрудника — ИП',         source: 'Документы HR' },
  { label: 'Лицензия Росавиации',               result: 'ok',   detail: 'Сертификат № 2024/БВСП-087',         source: 'Росавиация' }
])

const finMetrics = ref([
  { label: 'ARR',          value: '85 млн ₽',   color: 'green',  comment: 'Рост 112% г/г — топ квартиль' },
  { label: 'Gross Margin', value: '58%',         color: 'green',  comment: 'Целевой диапазон 55-70%' },
  { label: 'Burn Rate',    value: '6.2 млн/мес', color: 'orange', comment: 'Runway 22 мес. при текущем кэше' },
  { label: 'EBITDA',       value: '-12 млн ₽',  color: 'orange', comment: 'Отрицательный — стадия роста' },
  { label: 'LTV/CAC',     value: '4.8x',        color: 'green',  comment: 'Хороший показатель удержания' },
  { label: 'Долговая нагрузка', value: '0',     color: 'green',  comment: 'Без долгового финансирования' }
])

const redFlags = ref([
  'Один клиент генерирует 40% выручки (концентрация риска)',
  'NDA не подписаны с 2 ключевыми разработчиками'
])

const techChecks = ref([
  { area: 'Архитектура ПО',    score: 8, finding: 'Хорошо структурированная кодовая база, CI/CD' },
  { area: 'Технологический TRL', score: 7, finding: 'Серийные продажи, TRL 7 подтверждён' },
  { area: 'Суверенность стека', score: 5, finding: 'ОС: Ubuntu + РедОС; MCU: STM32 (импорт)' },
  { area: 'Масштабируемость',  score: 7, finding: 'Cloud-native, горизонтальное масштабирование' },
  { area: 'IP-защита',         score: 8, finding: '4 патента + 2 в процессе рассмотрения' },
  { area: 'Тех. документация', score: 6, finding: 'Есть, требует актуализации по ГОСТ 34' }
])

const newDd = ref({ company: '', inn: '', type: 'full', priority: 'Средний' })

function startDd() {
  const ddId = `dd-${newDd.value.inn || newDd.value.company.replace(/\s+/g, '_')}-${Date.now()}`
  activeDds.value.push({
    id:         ddId,
    company:    newDd.value.company,
    stage:      'pending',
    progress:   0,
    daysRunning: 0,
    verdict:    'pending',
    verdictText: 'DD только запущен.',
    strengths:  [],
    risks:      []
  })
  eventStore.add('deal', ddId, 'DEAL_SOURCED', {
    company: newDd.value.company,
    inn:     newDd.value.inn,
    type:    newDd.value.type,
    source:  'due_diligence',
  })
  showNewDd.value = false
}

function completeDd(dd, verdict) {
  dd.verdict = verdict
  dd.stage   = 'complete'
  const ddId = String(dd.id)
  eventStore.add('deal', ddId, 'DD_COMPLETED', {
    company:  dd.company,
    verdict,
    risks:    dd.risks?.length || 0,
    strengths: dd.strengths?.length || 0,
  })
}

function exportDd() { alert('Экспорт DD-отчёта по ' + selectedDd.value?.company) }
</script>

<style scoped>
.dd-content { display: flex; flex-direction: column; gap: 16px; padding-top: 16px; }

.dd-active-list { display: flex; gap: 10px; flex-wrap: wrap; }
.dd-card { background: var(--p-surface-card); border: 1px solid var(--p-content-border-color); border-radius: 12px; padding: 14px; cursor: pointer; flex: 1; min-width: 180px; transition: border-color 0.2s; }
.dd-card.selected { border-color: var(--p-primary-color); }
.dd-card-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
.dd-co-name { font-weight: 700; font-size: 0.9rem; color: var(--p-text-color); }
.dd-stage { font-size: 0.7rem; padding: 2px 7px; border-radius: 4px; font-weight: 600; }
.dd-stage.complete    { background: color-mix(in srgb, var(--fst-green) 13%, transparent); color: var(--fst-green); }
.dd-stage.in_progress { background: color-mix(in srgb, var(--fst-blue) 13%, transparent); color: var(--fst-blue); }
.dd-stage.pending     { background: color-mix(in srgb, var(--fst-brand) 13%, transparent); color: var(--fst-brand); }
.dd-progress-bar { height: 6px; background: var(--p-content-border-color); border-radius: 3px; overflow: hidden; margin-bottom: 6px; }
.dd-fill { height: 100%; background: var(--p-primary-color); border-radius: 3px; transition: width 0.5s; }
.dd-meta { display: flex; justify-content: space-between; font-size: 0.72rem; color: var(--p-text-muted-color); }

.dd-detail { background: var(--p-surface-card); border: 1px solid var(--p-content-border-color); border-radius: 12px; padding: 20px; }
.dd-section-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em; color: var(--p-text-muted-color); margin-bottom: 14px; }
.dd-block-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em; color: var(--p-text-muted-color); margin-bottom: 12px; }
.dd-tabs { margin-bottom: 16px; }
.check-grid { display: flex; flex-direction: column; gap: 8px; }
.dd-check { display: flex; align-items: flex-start; gap: 10px; padding: 10px 12px; border-radius: 8px; background: var(--p-surface-ground); }
.dd-check.ok   { border-left: 3px solid var(--fst-green); }
.dd-check.warn { border-left: 3px solid var(--fst-brand); }
.dd-check.fail { border-left: 3px solid var(--fst-red); }
.check-icon { font-size: 1rem; font-weight: 700; width: 20px; }
.dd-check.ok .check-icon   { color: var(--fst-green); }
.dd-check.warn .check-icon { color: var(--fst-brand); }
.dd-check.fail .check-icon { color: var(--fst-red); }
.check-content { flex: 1; }
.check-label  { font-weight: 600; font-size: 0.85rem; color: var(--p-text-color); }
.check-detail { font-size: 0.75rem; color: var(--p-text-muted-color); }
.check-source { font-size: 0.68rem; color: var(--p-text-muted-color); white-space: nowrap; }

.fin-metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 10px; margin-bottom: 16px; }
.fin-metric { background: var(--p-surface-ground); border: 1px solid var(--p-content-border-color); border-radius: 8px; padding: 12px; }
.fm-label   { font-size: 0.72rem; color: var(--p-text-muted-color); }
.fm-val     { font-size: 1.2rem; font-weight: 700; margin: 4px 0; }
.fm-val.green  { color: var(--fst-green); } .fm-val.orange { color: var(--fst-brand); } .fm-val.red { color: var(--fst-red); }
.fm-comment { font-size: 0.68rem; color: var(--p-text-muted-color); }
.redflag { font-size: 0.8rem; color: var(--fst-red); padding: 6px 10px; background: color-mix(in srgb, var(--fst-red) 7%, transparent); border-radius: 5px; margin-bottom: 4px; }

.tech-items { display: flex; flex-direction: column; gap: 10px; }
.tech-item { display: grid; grid-template-columns: 180px 1fr 50px; align-items: center; gap: 10px; }
.ti-area { font-size: 0.82rem; font-weight: 600; color: var(--p-text-color); }
.ti-score-bar { height: 8px; background: var(--p-content-border-color); border-radius: 4px; overflow: hidden; }
.ti-fill { height: 100%; border-radius: 4px; transition: width 0.4s; }
.ti-score { font-size: 0.78rem; font-weight: 700; color: var(--p-text-color); text-align: right; }
.ti-finding { font-size: 0.72rem; color: var(--p-text-muted-color); grid-column: 1 / -1; }

.dd-verdict { display: flex; align-items: center; gap: 14px; padding: 14px 16px; border-radius: 12px; margin-bottom: 16px; }
.dd-verdict.proceed { background: color-mix(in srgb, var(--fst-green) 10%, transparent); border: 1px solid color-mix(in srgb, var(--fst-green) 27%, transparent); }
.dd-verdict.caution { background: color-mix(in srgb, var(--fst-brand) 10%, transparent); border: 1px solid color-mix(in srgb, var(--fst-brand) 27%, transparent); }
.dd-verdict.reject  { background: color-mix(in srgb, var(--fst-red) 10%, transparent); border: 1px solid color-mix(in srgb, var(--fst-red) 27%, transparent); }
.dd-verdict.pending { background: var(--p-surface-ground); border: 1px solid var(--p-content-border-color); }
.verdict-icon { font-size: 1.5rem; font-weight: 700; }
.dd-verdict.proceed .verdict-icon { color: var(--fst-green); }
.dd-verdict.caution .verdict-icon { color: var(--fst-brand); }
.dd-verdict.reject  .verdict-icon { color: var(--fst-red); }
.verdict-title { font-weight: 700; font-size: 0.95rem; color: var(--p-text-color); margin-bottom: 4px; }
.verdict-text  { font-size: 0.8rem; color: var(--p-text-muted-color); }
.dd-strengths .dd-block-title, .dd-risks .dd-block-title { margin-top: 12px; }
.dd-strengths ul, .dd-risks ul { margin: 0; padding-left: 18px; }
.dd-strengths li { font-size: 0.8rem; color: var(--p-text-color); margin-bottom: 4px; }
.dd-risks li { font-size: 0.8rem; color: var(--fst-brand); margin-bottom: 4px; }

.modal-form { display: flex; flex-direction: column; gap: 8px; margin-bottom: 16px; }
.modal-form label { font-size: 0.75rem; color: var(--p-text-muted-color); }
.modal-actions { display: flex; gap: 8px; justify-content: flex-end; }

/* ── Mobile adaptive ── */
@media (max-width: 768px) {
  .ti-score-bar { flex-wrap: wrap; gap: 8px; }
  .ti-score { flex-wrap: wrap; gap: 8px; }
  .dd-tabs { overflow-x: auto; -webkit-overflow-scrolling: touch; flex-wrap: nowrap; }
  .dd-tabs > * { flex-shrink: 0; font-size: 0.8rem; }
  .fin-metrics { grid-template-columns: 1fr !important; }
  .tech-item { grid-template-columns: 1fr !important; }
}
</style>
