<template>
  <FstPageLayout title="AI Due Diligence" subtitle="Ускоренная проверка с правовым, финансовым и технологическим анализом">
    <template #actions>
      <button class="dd-btn secondary" @click="exportDd">Экспорт DD-отчёта</button>
        <button class="dd-btn primary" @click="showNewDd = true">+ Новая проверка</button>
    </template>

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
      <h2>{{ selectedDd.company }} — Due Diligence</h2>

      <div class="dd-tabs">
        <button v-for="t in ddTabs" :key="t.id" :class="['dd-tab', { active: ddActiveTab === t.id }]" @click="ddActiveTab = t.id">{{ t.label }}</button>
      </div>

      <!-- Правовой блок -->
      <div v-if="ddActiveTab === 'legal'" class="dd-block">
        <h3>Правовая проверка</h3>
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
        <h3>Финансовый анализ</h3>
        <div class="fin-metrics">
          <div v-for="m in finMetrics" :key="m.label" class="fin-metric">
            <div class="fm-label">{{ m.label }}</div>
            <div class="fm-val" :class="m.color">{{ m.value }}</div>
            <div class="fm-comment">{{ m.comment }}</div>
          </div>
        </div>
        <div class="dd-redflags" v-if="redFlags.length">
          <h4>Красные флаги</h4>
          <div v-for="rf in redFlags" :key="rf" class="redflag">! {{ rf }}</div>
        </div>
      </div>

      <!-- Технологический блок -->
      <div v-if="ddActiveTab === 'tech'" class="dd-block">
        <h3>Технологический Due Diligence</h3>
        <div class="tech-items">
          <div v-for="item in techChecks" :key="item.area" class="tech-item">
            <div class="ti-area">{{ item.area }}</div>
            <div class="ti-score-bar">
              <div class="ti-fill" :style="{ width: item.score * 10 + '%', background: item.score >= 7 ? '#66bb6a' : item.score >= 5 ? '#ff9800' : '#ef5350' }"></div>
            </div>
            <div class="ti-score">{{ item.score }}/10</div>
            <div class="ti-finding">{{ item.finding }}</div>
          </div>
        </div>
      </div>

      <!-- AI-саммари -->
      <div v-if="ddActiveTab === 'summary'" class="dd-block">
        <h3>AI-сводка Due Diligence</h3>
        <div class="dd-verdict" :class="selectedDd.verdict">
          <div class="verdict-icon">{{ selectedDd.verdict === 'proceed' ? '✓' : selectedDd.verdict === 'caution' ? '!' : '✗' }}</div>
          <div>
            <div class="verdict-title">{{ verdictLabel(selectedDd.verdict) }}</div>
            <div class="verdict-text">{{ selectedDd.verdictText }}</div>
          </div>
        </div>
        <div class="dd-strengths">
          <h4>Сильные стороны</h4>
          <ul><li v-for="s in selectedDd.strengths" :key="s">{{ s }}</li></ul>
        </div>
        <div class="dd-risks">
          <h4>Риски к управлению</h4>
          <ul><li v-for="r in selectedDd.risks" :key="r">{{ r }}</li></ul>
        </div>
      </div>
    </div>

    <!-- Новая DD Modal -->
    <div v-if="showNewDd" class="modal-overlay" @click.self="showNewDd = false">
      <div class="modal-box">
        <h3>Новая DD-проверка</h3>
        <div class="modal-form">
          <label>Компания</label>
          <input v-model="newDd.company" placeholder="Название стартапа" />
          <label>ИНН</label>
          <input v-model="newDd.inn" placeholder="1234567890" />
          <label>Тип проверки</label>
          <select v-model="newDd.type">
            <option value="full">Полная DD (4-6 недель)</option>
            <option value="fast">Быстрая DD (2 недели)</option>
            <option value="express">Экспресс-скоринг (3 дня)</option>
          </select>
          <label>Приоритет</label>
          <select v-model="newDd.priority">
            <option>Высокий</option>
            <option>Средний</option>
            <option>Низкий</option>
          </select>
        </div>
        <div class="modal-actions">
          <button class="dd-btn secondary" @click="showNewDd = false">Отмена</button>
          <button class="dd-btn primary" @click="startDd">Запустить DD</button>
        </div>
      </div>
    </div>
  </FstPageLayout>
</template>

<script setup>
import { ref } from 'vue'
import FstPageLayout from '@/components/fst-shared/FstPageLayout.vue'

const showNewDd  = ref(false)
const ddActiveTab = ref('legal')

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
  activeDds.value.push({
    id: Date.now(),
    company: newDd.value.company,
    stage: 'pending',
    progress: 0,
    daysRunning: 0,
    verdict: 'pending',
    verdictText: 'DD только запущен.',
    strengths: [],
    risks: []
  })
  showNewDd.value = false
}

function exportDd() { alert('Экспорт DD-отчёта по ' + selectedDd.value?.company) }
</script>

<style scoped>
.dd-root { padding: 24px; display: flex; flex-direction: column; gap: 20px; min-height: 100vh; background: var(--surface-ground); }
.dd-header { display: flex; align-items: flex-start; justify-content: space-between; flex-wrap: wrap; gap: 12px; }
.dd-header h1 { margin: 0; font-size: 1rem; font-weight: 600; color: var(--p-text-color); }
.dd-sub { font-size: 0.8rem; color: var(--p-text-muted-color); }
.dd-actions { display: flex; gap: 8px; }
.dd-btn { padding: 8px 14px; border-radius: 8px; border: none; cursor: pointer; font-size: 0.875rem; font-weight: 600; }
.dd-btn.primary  { background: var(--p-primary-color); color: #fff; }
.dd-btn.secondary{ background: var(--surface-card); color: var(--p-text-color); border: 1px solid var(--surface-border); }

.dd-active-list { display: flex; gap: 10px; flex-wrap: wrap; }
.dd-card { background: var(--surface-card); border: 1px solid var(--surface-border); border-radius: 10px; padding: 14px; cursor: pointer; flex: 1; min-width: 180px; transition: border-color 0.2s; }
.dd-card.selected { border-color: var(--p-primary-color); }
.dd-card-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
.dd-co-name { font-weight: 700; font-size: 0.9rem; color: var(--p-text-color); }
.dd-stage { font-size: 0.7rem; padding: 2px 7px; border-radius: 4px; font-weight: 600; }
.dd-stage.complete    { background: #66bb6a22; color: #66bb6a; }
.dd-stage.in_progress { background: #42a5f522; color: #42a5f5; }
.dd-stage.pending     { background: #ff980022; color: #ff9800; }
.dd-progress-bar { height: 6px; background: var(--surface-border); border-radius: 3px; overflow: hidden; margin-bottom: 6px; }
.dd-fill { height: 100%; background: var(--p-primary-color); border-radius: 3px; transition: width 0.5s; }
.dd-meta { display: flex; justify-content: space-between; font-size: 0.72rem; color: var(--p-text-muted-color); }

.dd-detail { background: var(--surface-card); border: 1px solid var(--surface-border); border-radius: 10px; padding: 20px; }
.dd-detail h2 { margin: 0 0 14px; font-size: 1.1rem; color: var(--p-text-color); }
.dd-tabs { display: flex; gap: 4px; margin-bottom: 16px; }
.dd-tab { padding: 7px 14px; border-radius: 8px; border: 1px solid var(--surface-border); background: var(--surface-card); color: var(--p-text-muted-color); cursor: pointer; font-size: 0.83rem; }
.dd-tab.active { background: var(--p-primary-color); color: #fff; border-color: var(--p-primary-color); }

.dd-block h3 { margin: 0 0 14px; font-size: 0.95rem; color: var(--p-text-color); }
.check-grid { display: flex; flex-direction: column; gap: 8px; }
.dd-check { display: flex; align-items: flex-start; gap: 10px; padding: 10px 12px; border-radius: 8px; background: var(--surface-ground); }
.dd-check.ok   { border-left: 3px solid #66bb6a; }
.dd-check.warn { border-left: 3px solid #ff9800; }
.dd-check.fail { border-left: 3px solid #ef5350; }
.check-icon { font-size: 1rem; font-weight: 700; width: 20px; }
.dd-check.ok .check-icon   { color: #66bb6a; }
.dd-check.warn .check-icon { color: #ff9800; }
.dd-check.fail .check-icon { color: #ef5350; }
.check-content { flex: 1; }
.check-label  { font-weight: 600; font-size: 0.85rem; color: var(--p-text-color); }
.check-detail { font-size: 0.75rem; color: var(--p-text-muted-color); }
.check-source { font-size: 0.68rem; color: var(--p-text-muted-color); white-space: nowrap; }

.fin-metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 10px; margin-bottom: 16px; }
.fin-metric { background: var(--surface-ground); border: 1px solid var(--surface-border); border-radius: 8px; padding: 12px; }
.fm-label   { font-size: 0.72rem; color: var(--p-text-muted-color); }
.fm-val     { font-size: 1.2rem; font-weight: 700; margin: 4px 0; }
.fm-val.green  { color: #66bb6a; } .fm-val.orange { color: #ff9800; } .fm-val.red { color: #ef5350; }
.fm-comment { font-size: 0.68rem; color: var(--p-text-muted-color); }
.dd-redflags h4 { margin: 0 0 8px; font-size: 0.85rem; color: #ef5350; }
.redflag { font-size: 0.8rem; color: #ef5350; padding: 6px 10px; background: #ef535012; border-radius: 5px; margin-bottom: 4px; }

.tech-items { display: flex; flex-direction: column; gap: 10px; }
.tech-item { display: grid; grid-template-columns: 180px 1fr 50px; align-items: center; gap: 10px; }
.ti-area { font-size: 0.82rem; font-weight: 600; color: var(--p-text-color); }
.ti-score-bar { height: 8px; background: var(--surface-border); border-radius: 4px; overflow: hidden; }
.ti-fill { height: 100%; border-radius: 4px; transition: width 0.4s; }
.ti-score { font-size: 0.78rem; font-weight: 700; color: var(--p-text-color); text-align: right; }
.ti-finding { font-size: 0.72rem; color: var(--p-text-muted-color); grid-column: 1 / -1; }

.dd-verdict { display: flex; align-items: center; gap: 14px; padding: 14px 16px; border-radius: 10px; margin-bottom: 16px; }
.dd-verdict.proceed { background: #66bb6a18; border: 1px solid #66bb6a44; }
.dd-verdict.caution { background: #ff980018; border: 1px solid #ff980044; }
.dd-verdict.reject  { background: #ef535018; border: 1px solid #ef535044; }
.dd-verdict.pending { background: var(--surface-ground); border: 1px solid var(--surface-border); }
.verdict-icon { font-size: 1.5rem; font-weight: 700; }
.dd-verdict.proceed .verdict-icon { color: #66bb6a; }
.dd-verdict.caution .verdict-icon { color: #ff9800; }
.dd-verdict.reject  .verdict-icon { color: #ef5350; }
.verdict-title { font-weight: 700; font-size: 0.95rem; color: var(--p-text-color); margin-bottom: 4px; }
.verdict-text  { font-size: 0.8rem; color: var(--p-text-muted-color); }
.dd-strengths h4, .dd-risks h4 { margin: 12px 0 6px; font-size: 0.85rem; color: var(--p-text-color); }
.dd-strengths ul, .dd-risks ul { margin: 0; padding-left: 18px; }
.dd-strengths li { font-size: 0.8rem; color: var(--p-text-color); margin-bottom: 4px; }
.dd-risks li { font-size: 0.8rem; color: #ff9800; margin-bottom: 4px; }

.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 100; }
.modal-box { background: var(--surface-card); border-radius: 12px; padding: 24px; width: 380px; max-width: 95vw; }
.modal-box h3 { margin: 0 0 16px; }
.modal-form { display: flex; flex-direction: column; gap: 8px; margin-bottom: 16px; }
.modal-form label { font-size: 0.75rem; color: var(--p-text-muted-color); }
.modal-form input, .modal-form select { background: var(--surface-ground); border: 1px solid var(--surface-border); border-radius: 6px; padding: 7px 10px; color: var(--p-text-color); font-size: 0.85rem; width: 100%; }
.modal-actions { display: flex; gap: 8px; justify-content: flex-end; }
</style>
