<template>
  <div class="df-root">
    <div class="df-header">
      <div>
        <h2 class="df-title">Воронка входящих заявок</h2>
        <p class="df-subtitle">Deal Flow — управление потоком заявок от первичного контакта до ИК</p>
      </div>
      <div class="df-actions">
        <button class="df-btn primary" @click="showNewDeal = true">+ Новая заявка</button>
        <button class="df-btn secondary" @click="exportCsv">Экспорт CSV</button>
      </div>
    </div>

    <!-- Статистика воронки -->
    <div class="df-stats">
      <div v-for="s in funnelStats" :key="s.stage" class="df-stat-card" :style="{ borderColor: s.color }">
        <div class="df-stat-num" :style="{ color: s.color }">{{ s.count }}</div>
        <div class="df-stat-label">{{ s.stage }}</div>
        <div class="df-stat-amount">{{ s.totalMln }} млн ₽</div>
      </div>
    </div>

    <!-- Kanban воронка -->
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
            @click="selectedDeal = deal"
          >
            <div class="df-card-top">
              <span class="df-card-name">{{ deal.company }}</span>
              <span class="df-card-subfund" :style="{ background: subfundColor(deal.subfund) }">{{ deal.subfund }}</span>
            </div>
            <div class="df-card-desc">{{ deal.description }}</div>
            <div class="df-card-footer">
              <span>{{ deal.askMln }} млн ₽</span>
              <span class="df-card-date">{{ deal.receivedDate }}</span>
            </div>
            <div class="df-card-score" v-if="deal.score">
              <div class="df-score-bar" :style="{ width: deal.score + '%', background: scoreColor(deal.score) }"></div>
              <span class="df-score-val">{{ deal.score }}/100</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Детальная панель -->
    <div v-if="selectedDeal" class="df-detail-overlay" @click.self="selectedDeal = null">
      <div class="df-detail">
        <div class="df-detail-header">
          <h3>{{ selectedDeal.company }}</h3>
          <button @click="selectedDeal = null" class="df-close">✕</button>
        </div>
        <div class="df-detail-body">
          <div class="df-detail-row"><span>Субфонд</span><strong>{{ selectedDeal.subfund }}</strong></div>
          <div class="df-detail-row"><span>Стадия</span><strong>{{ selectedDeal.stage }}</strong></div>
          <div class="df-detail-row"><span>Запрос</span><strong>{{ selectedDeal.askMln }} млн ₽</strong></div>
          <div class="df-detail-row"><span>TRL</span><strong>{{ selectedDeal.trl }}</strong></div>
          <div class="df-detail-row"><span>Суверенность</span><strong>{{ selectedDeal.sovereignty }}/9</strong></div>
          <div class="df-detail-row"><span>Контакт</span><strong>{{ selectedDeal.contact }}</strong></div>
          <div class="df-detail-row"><span>Источник</span><strong>{{ selectedDeal.source }}</strong></div>
          <div class="df-detail-desc">
            <div class="df-detail-section">Описание</div>
            {{ selectedDeal.description }}
          </div>
          <div class="df-detail-actions">
            <button class="df-btn primary" @click="moveToNext(selectedDeal)">Перевести на следующий этап →</button>
            <button class="df-btn danger" @click="rejectDeal(selectedDeal)">Отклонить</button>
            <button class="df-btn success" @click="sendToIC(selectedDeal)">Отправить на ИК</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Модальное окно новой заявки -->
    <div v-if="showNewDeal" class="df-detail-overlay" @click.self="showNewDeal = false">
      <div class="df-detail">
        <div class="df-detail-header">
          <h3>Новая заявка</h3>
          <button @click="showNewDeal = false" class="df-close">✕</button>
        </div>
        <div class="df-detail-body">
          <div class="df-form-row">
            <label>Компания</label>
            <input v-model="newDeal.company" type="text" placeholder="ООО АвиаТех" />
          </div>
          <div class="df-form-row">
            <label>Субфонд</label>
            <select v-model="newDeal.subfund">
              <option>БАС</option><option>РОБО</option><option>МЭ</option>
            </select>
          </div>
          <div class="df-form-row">
            <label>Запрос, млн ₽</label>
            <input v-model.number="newDeal.askMln" type="number" min="1" />
          </div>
          <div class="df-form-row">
            <label>TRL (1–9)</label>
            <input v-model.number="newDeal.trl" type="number" min="1" max="9" />
          </div>
          <div class="df-form-row">
            <label>Суверенность (0–9)</label>
            <input v-model.number="newDeal.sovereignty" type="number" min="0" max="9" />
          </div>
          <div class="df-form-row">
            <label>Описание</label>
            <textarea v-model="newDeal.description" rows="3"></textarea>
          </div>
          <div class="df-form-row">
            <label>Источник</label>
            <input v-model="newDeal.source" type="text" placeholder="Конференция БПЛА-2026" />
          </div>
          <div class="df-form-row">
            <label>Контакт</label>
            <input v-model="newDeal.contact" type="text" placeholder="Иванов А.В., +7..." />
          </div>
          <button class="df-btn primary" style="width:100%;margin-top:12px" @click="createDeal">Создать заявку</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

const columns = [
  { id: 'new',       label: 'Новые',            color: '#90a4ae' },
  { id: 'screening', label: 'Скрининг',          color: '#42a5f5' },
  { id: 'analysis',  label: 'Анализ',            color: '#ffa726' },
  { id: 'ic_prep',   label: 'Подготовка ИК',     color: '#ab47bc' },
  { id: 'ic',        label: 'На ИК',             color: '#26c6da' },
  { id: 'approved',  label: 'Одобрено',          color: '#66bb6a' },
  { id: 'rejected',  label: 'Отклонено',         color: '#ef5350' }
]

const deals = ref([
  { id: 1, company: 'ООО ДронСервис',  subfund: 'БАС', stage: 'screening', askMln: 80,  trl: 5, sovereignty: 7, score: 72, receivedDate: '2026-02-10', contact: 'Петров Д.А.', source: 'Партнёр', description: 'Сервисное обслуживание БПЛА для нефтегаза. LOI с Лукойл.' },
  { id: 2, company: 'АО НейроПилот',   subfund: 'БАС', stage: 'analysis',  askMln: 150, trl: 6, sovereignty: 8, score: 85, receivedDate: '2026-02-05', contact: 'Соколова М.В.', source: 'Конференция', description: 'AI-система управления роем БПЛА. 3 патента, партнёрство с МФТИ.' },
  { id: 3, company: 'ООО РоботМед',    subfund: 'РОБО',stage: 'ic_prep',   askMln: 200, trl: 7, sovereignty: 6, score: 79, receivedDate: '2026-01-28', contact: 'Карпов И.С.', source: 'ФРИИ', description: 'Хирургические роботы для минимально инвазивных операций. CE Mark получен.' },
  { id: 4, company: 'АО ЧипРус',       subfund: 'МЭ',  stage: 'new',       askMln: 300, trl: 4, sovereignty: 9, score: 61, receivedDate: '2026-02-18', contact: 'Новиков А.Р.', source: 'Прямое обращение', description: 'Производство микросхем памяти DDR5 на отечественной элементной базе.' },
  { id: 5, company: 'ООО АгроВижн',    subfund: 'РОБО',stage: 'ic',        askMln: 120, trl: 7, sovereignty: 7, score: 88, receivedDate: '2026-01-15', contact: 'Сидорова П.К.', source: 'Акселератор', description: 'Компьютерное зрение для сельского хозяйства. Выручка 45 млн/год.' },
  { id: 6, company: 'ООО КиберЗащита', subfund: 'МЭ',  stage: 'rejected',  askMln: 50,  trl: 3, sovereignty: 4, score: 35, receivedDate: '2026-01-20', contact: 'Попов Р.В.', source: 'Email', description: 'Отклонено: низкий TRL, нет продаж.' },
  { id: 7, company: 'АО ФотонКС',      subfund: 'МЭ',  stage: 'approved',  askMln: 180, trl: 8, sovereignty: 8, score: 91, receivedDate: '2025-12-10', contact: 'Беляев А.М.', source: 'ВЭБ.РФ', description: 'Фотонные интегральные схемы для телекоммуникаций.' }
])

const selectedDeal = ref(null)
const showNewDeal = ref(false)
const newDeal = ref({ company: '', subfund: 'БАС', askMln: 100, trl: 5, sovereignty: 6, description: '', source: '', contact: '' })

const funnelStats = computed(() => {
  return columns.slice(0, 5).map(col => {
    const d = dealsInStage(col.id)
    return {
      stage: col.label,
      color: col.color,
      count: d.length,
      totalMln: d.reduce((s, x) => s + x.askMln, 0)
    }
  })
})

function dealsInStage(stage) {
  return deals.value.filter(d => d.stage === stage)
}
function subfundColor(s) {
  return { БАС: '#1565c0', РОБО: '#1b5e20', МЭ: '#4a148c' }[s] || '#607d8b'
}
function scoreColor(s) {
  if (s >= 75) return '#66bb6a'
  if (s >= 50) return '#ffa726'
  return '#ef5350'
}
function moveToNext(deal) {
  const order = ['new', 'screening', 'analysis', 'ic_prep', 'ic', 'approved']
  const idx = order.indexOf(deal.stage)
  if (idx < order.length - 1) deal.stage = order[idx + 1]
  selectedDeal.value = null
}
function rejectDeal(deal) {
  deal.stage = 'rejected'
  selectedDeal.value = null
}
function sendToIC(deal) {
  deal.stage = 'ic'
  selectedDeal.value = null
}
function createDeal() {
  const d = { ...newDeal.value, id: Date.now(), stage: 'new', score: Math.round(40 + Math.random() * 40), receivedDate: new Date().toISOString().slice(0, 10) }
  deals.value.push(d)
  showNewDeal.value = false
  newDeal.value = { company: '', subfund: 'БАС', askMln: 100, trl: 5, sovereignty: 6, description: '', source: '', contact: '' }
}
function exportCsv() {
  const rows = [['ID', 'Компания', 'Субфонд', 'Этап', 'Запрос', 'TRL', 'Суверенность', 'Score']]
  deals.value.forEach(d => rows.push([d.id, d.company, d.subfund, d.stage, d.askMln, d.trl, d.sovereignty, d.score]))
  const csv = rows.map(r => r.join(';')).join('\n')
  const a = Object.assign(document.createElement('a'), { href: 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv), download: 'dealflow.csv' })
  a.click()
}
</script>

<style scoped>
.df-root { padding: 24px; max-width: 1400px; margin: 0 auto; }
.df-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; flex-wrap: wrap; gap: 12px; }
.df-title { font-size: 1.6rem; font-weight: 700; color: var(--p-text-color); margin: 0; }
.df-subtitle { color: var(--p-text-muted-color); font-size: 0.9rem; margin-top: 4px; }
.df-actions { display: flex; gap: 8px; }
.df-btn { padding: 8px 16px; border-radius: 8px; border: none; cursor: pointer; font-size: 0.85rem; font-weight: 600; transition: opacity .15s; }
.df-btn:hover { opacity: .85; }
.df-btn.primary { background: var(--p-primary-color); color: #fff; }
.df-btn.secondary { background: var(--p-surface-ground); color: var(--p-text-color); border: 1px solid var(--p-surface-border); }
.df-btn.danger { background: #ef5350; color: #fff; }
.df-btn.success { background: #66bb6a; color: #fff; }
.df-stats { display: flex; gap: 12px; margin-bottom: 24px; flex-wrap: wrap; }
.df-stat-card { flex: 1; min-width: 100px; background: var(--p-content-background); border: 2px solid; border-radius: 10px; padding: 12px; text-align: center; }
.df-stat-num { font-size: 1.8rem; font-weight: 800; }
.df-stat-label { font-size: 0.75rem; color: var(--p-text-muted-color); margin-top: 2px; }
.df-stat-amount { font-size: 0.8rem; color: var(--p-text-color); margin-top: 4px; }
.df-kanban { display: flex; gap: 12px; overflow-x: auto; padding-bottom: 16px; }
.df-column { min-width: 200px; flex: 1; background: var(--p-surface-ground); border-radius: 10px; display: flex; flex-direction: column; }
.df-col-header { padding: 10px 14px; display: flex; justify-content: space-between; align-items: center; }
.df-col-title { font-size: 0.82rem; font-weight: 700; color: var(--p-text-color); }
.df-col-badge { background: var(--p-surface-border); border-radius: 20px; padding: 2px 8px; font-size: 0.75rem; color: var(--p-text-muted-color); }
.df-col-body { padding: 8px; display: flex; flex-direction: column; gap: 8px; flex: 1; }
.df-card { background: var(--p-content-background); border: 1px solid var(--p-surface-border); border-radius: 8px; padding: 10px; cursor: pointer; transition: transform .15s, box-shadow .15s; }
.df-card:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,.15); }
.df-card-top { display: flex; justify-content: space-between; align-items: center; gap: 6px; margin-bottom: 4px; }
.df-card-name { font-size: 0.82rem; font-weight: 700; color: var(--p-text-color); }
.df-card-subfund { font-size: 0.65rem; color: #fff; padding: 2px 6px; border-radius: 4px; }
.df-card-desc { font-size: 0.75rem; color: var(--p-text-muted-color); margin-bottom: 6px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.df-card-footer { display: flex; justify-content: space-between; font-size: 0.72rem; color: var(--p-text-muted-color); }
.df-card-score { display: flex; align-items: center; gap: 6px; margin-top: 6px; }
.df-score-bar { height: 4px; border-radius: 2px; transition: width .3s; }
.df-score-val { font-size: 0.68rem; color: var(--p-text-muted-color); }
.df-detail-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.5); z-index: 1000; display: flex; align-items: center; justify-content: center; }
.df-detail { background: var(--p-content-background); border-radius: 12px; width: 500px; max-width: 95vw; max-height: 85vh; overflow-y: auto; }
.df-detail-header { display: flex; justify-content: space-between; align-items: center; padding: 20px 20px 12px; border-bottom: 1px solid var(--p-surface-border); }
.df-detail-header h3 { margin: 0; font-size: 1.1rem; color: var(--p-text-color); }
.df-close { background: none; border: none; font-size: 1.2rem; cursor: pointer; color: var(--p-text-muted-color); }
.df-detail-body { padding: 16px 20px 20px; display: flex; flex-direction: column; gap: 10px; }
.df-detail-row { display: flex; justify-content: space-between; font-size: 0.88rem; color: var(--p-text-muted-color); border-bottom: 1px dashed var(--p-surface-border); padding-bottom: 6px; }
.df-detail-row strong { color: var(--p-text-color); }
.df-detail-desc { font-size: 0.85rem; color: var(--p-text-muted-color); line-height: 1.5; }
.df-detail-section { font-weight: 700; color: var(--p-text-color); margin-bottom: 4px; }
.df-detail-actions { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 8px; }
.df-form-row { display: flex; flex-direction: column; gap: 4px; }
.df-form-row label { font-size: 0.78rem; color: var(--p-text-muted-color); }
.df-form-row input, .df-form-row select, .df-form-row textarea { background: var(--p-surface-ground); border: 1px solid var(--p-surface-border); border-radius: 6px; padding: 8px; color: var(--p-text-color); font-size: 0.85rem; outline: none; }
.df-form-row input:focus, .df-form-row select:focus, .df-form-row textarea:focus { border-color: var(--p-primary-color); }
</style>
