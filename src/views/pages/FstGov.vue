<template>
  <div class="gov-root">
    <div class="gov-header">
      <div>
        <h1>GR-Панель</h1>
        <span class="gov-subtitle">Государственные отношения и регуляторный мониторинг</span>
      </div>
      <div class="gov-actions">
        <button class="gov-btn secondary" @click="exportGr">Экспорт GR-отчёта</button>
        <button class="gov-btn primary" @click="showAddEvent = true">+ Событие</button>
      </div>
    </div>

    <!-- KPI GR -->
    <div class="gov-kpi-row">
      <div class="gov-kpi" v-for="k in kpis" :key="k.label">
        <div class="gov-kpi-icon">{{ k.icon }}</div>
        <div class="gov-kpi-val">{{ k.value }}</div>
        <div class="gov-kpi-lbl">{{ k.label }}</div>
      </div>
    </div>

    <!-- Нормативная среда -->
    <div class="gov-grid">
      <!-- Регуляторный радар -->
      <div class="gov-card wide">
        <h3>Регуляторный радар</h3>
        <div class="radar-list">
          <div v-for="reg in regulations" :key="reg.code" class="radar-item">
            <div class="radar-status" :class="reg.status">{{ statusIcon(reg.status) }}</div>
            <div class="radar-info">
              <div class="radar-code">{{ reg.code }}</div>
              <div class="radar-name">{{ reg.name }}</div>
              <div class="radar-desc">{{ reg.desc }}</div>
            </div>
            <div class="radar-meta">
              <span class="radar-date">{{ reg.effectiveDate }}</span>
              <span class="radar-impact" :class="reg.impact">{{ impactLabel(reg.impact) }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- GR-контакты -->
      <div class="gov-card">
        <h3>Ключевые контакты</h3>
        <div class="contacts-list">
          <div v-for="c in contacts" :key="c.name" class="contact-item">
            <div class="contact-avatar">{{ c.initials }}</div>
            <div class="contact-info">
              <div class="contact-name">{{ c.name }}</div>
              <div class="contact-role">{{ c.role }}</div>
              <div class="contact-org">{{ c.org }}</div>
            </div>
            <div class="contact-rel" :class="c.relation">{{ relLabel(c.relation) }}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Хронология событий -->
    <div class="gov-card">
      <h3>GR-Хронология</h3>
      <div class="timeline">
        <div v-for="ev in events" :key="ev.id" class="tl-item">
          <div class="tl-date">{{ ev.date }}</div>
          <div class="tl-dot" :class="ev.type"></div>
          <div class="tl-body">
            <div class="tl-title">{{ ev.title }}</div>
            <div class="tl-desc">{{ ev.desc }}</div>
            <div class="tl-tags">
              <span v-for="t in ev.tags" :key="t" class="tl-tag">{{ t }}</span>
            </div>
          </div>
          <div class="tl-status" :class="ev.evStatus">{{ evStatusLabel(ev.evStatus) }}</div>
        </div>
      </div>
    </div>

    <!-- Субсидии и гранты -->
    <div class="gov-card">
      <h3>Субсидии и программы поддержки</h3>
      <table class="gov-table">
        <thead>
          <tr>
            <th>Программа</th>
            <th>Орган</th>
            <th>Объём, млн ₽</th>
            <th>Статус заявки</th>
            <th>Дедлайн</th>
            <th>Ответственный</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="g in grants" :key="g.name">
            <td class="grant-name">{{ g.name }}</td>
            <td class="grant-org">{{ g.org }}</td>
            <td class="num">{{ g.amount }}</td>
            <td><span class="grant-status" :class="g.appStatus">{{ grantStatusLabel(g.appStatus) }}</span></td>
            <td class="grant-date" :class="{ overdue: isOverdue(g.deadline) }">{{ g.deadline }}</td>
            <td>{{ g.owner }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Add Event Modal -->
    <div v-if="showAddEvent" class="modal-overlay" @click.self="showAddEvent = false">
      <div class="modal-box">
        <h3>Новое GR-событие</h3>
        <div class="modal-form">
          <label>Дата</label>
          <input v-model="newEvent.date" type="date" />
          <label>Заголовок</label>
          <input v-model="newEvent.title" placeholder="Название события" />
          <label>Описание</label>
          <textarea v-model="newEvent.desc" rows="3" placeholder="Детали события..."></textarea>
          <label>Тип события</label>
          <select v-model="newEvent.type">
            <option value="meeting">Встреча</option>
            <option value="regulation">НПА</option>
            <option value="grant">Грант</option>
            <option value="milestone">Веха</option>
          </select>
        </div>
        <div class="modal-actions">
          <button class="gov-btn secondary" @click="showAddEvent = false">Отмена</button>
          <button class="gov-btn primary" @click="addEvent">Добавить</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

const showAddEvent = ref(false)

const kpis = ref([
  { icon: '📋', value: '14', label: 'Активных НПА' },
  { icon: '🤝', value: '8',  label: 'Ключевых контактов' },
  { icon: '💰', value: '6',  label: 'Грантовых заявок' },
  { icon: '✅', value: '3',  label: 'Одобрено грантов' },
  { icon: '📅', value: '4',  label: 'Событий / месяц' },
  { icon: '⚡', value: '2',  label: 'Критич. рисков' }
])

const regulations = ref([
  { code: 'ФЗ-57',   name: 'Закон о БПЛА',             desc: 'Регистрация и эксплуатация БВС', effectiveDate: '2024-09-01', status: 'active',  impact: 'high'   },
  { code: 'ПП-2406', name: 'Правила полётов БВС',       desc: 'Зоны эксплуатации, идентификация', effectiveDate: '2024-12-01', status: 'active',  impact: 'high'   },
  { code: 'ГОСТ-Р',  name: 'ГОСТ сертификации БПЛА',   desc: 'Технические требования к БВС гр.', effectiveDate: '2025-03-01', status: 'review',  impact: 'medium' },
  { code: 'НПА-34',  name: 'Суверенизация ПО',          desc: 'Требование к отеч. ПО для БПЛА',   effectiveDate: '2026-01-01', status: 'pending', impact: 'high'   },
  { code: 'ФЗ-223',  name: 'Квалиф. отечеств. продукт', desc: 'Реестр отечественных БПЛА',        effectiveDate: '2023-01-01', status: 'active',  impact: 'medium' },
  { code: 'МР-2025', name: 'Методика расчёта субсидий', desc: 'НИОКР в области БАС',              effectiveDate: '2025-06-01', status: 'review',  impact: 'low'    }
])

const contacts = ref([
  { name: 'Чернышенко Д.Н.', initials: 'ДЧ', role: 'Вице-премьер',         org: 'Правительство РФ',       relation: 'strategic' },
  { name: 'Мантуров Д.В.',   initials: 'ДМ', role: 'Министр',               org: 'Минпромторг РФ',         relation: 'partner'   },
  { name: 'Захаров А.В.',    initials: 'АЗ', role: 'Директор',              org: 'НТИ / Росатом',          relation: 'partner'   },
  { name: 'Беспалов П.С.',   initials: 'ПБ', role: 'Нач. отд. инфраструкт.', org: 'Росавиация',            relation: 'regulator' },
  { name: 'Ким А.В.',        initials: 'АК', role: 'Директор ФРП',           org: 'Фонд развития пром.',   relation: 'funder'    },
  { name: 'Петров С.И.',     initials: 'СП', role: 'Рук. программы БАС',    org: 'Сколково',               relation: 'partner'   }
])

const events = ref([
  { id: 1, date: '2026-02-14', type: 'meeting',    title: 'Встреча с Минпромторг', desc: 'Обсуждение субсидий НИОКР для БАС-платформы ФСТ', tags: ['субсидии', 'НИОКР'], evStatus: 'done'    },
  { id: 2, date: '2026-02-28', type: 'regulation', title: 'Вступление в силу ПП-2406', desc: 'Обязательная регистрация всех БВС >0.25 кг', tags: ['регуляция', 'БПЛА'], evStatus: 'done'    },
  { id: 3, date: '2026-03-15', type: 'grant',      title: 'Дедлайн заявки ФРП',   desc: 'Грантовая программа НИОКР, сумма до 300 млн ₽', tags: ['грант', 'ФРП'],    evStatus: 'upcoming' },
  { id: 4, date: '2026-04-10', type: 'meeting',    title: 'Форум "Промышленность"', desc: 'Презентация БАС-стека портфельных компаний ФСТ', tags: ['форум', 'PR'],     evStatus: 'planned'  },
  { id: 5, date: '2026-06-01', type: 'milestone',  title: 'Аттестация ГОСТ-Р',    desc: 'Прохождение сертификации для 3 ПК', tags: ['ГОСТ', 'сертификат'],  evStatus: 'planned'  }
])

const grants = ref([
  { name: 'НИОКР БАС Минпромторг',   org: 'Минпромторг',  amount: 300, appStatus: 'approved', deadline: '2025-12-01', owner: 'Иванов А.' },
  { name: 'Сколково IT-грант',        org: 'Сколково',     amount: 50,  appStatus: 'approved', deadline: '2025-11-01', owner: 'Петров С.' },
  { name: 'ФРП промышленный грант',   org: 'ФРП',          amount: 250, appStatus: 'pending',  deadline: '2026-03-15', owner: 'Ким А.'    },
  { name: 'Программа цифровизации',   org: 'Минцифры',     amount: 80,  appStatus: 'review',   deadline: '2026-04-01', owner: 'Захаров А.'},
  { name: 'Экспортный грант РЭЦ',     org: 'РЭЦ',         amount: 30,  appStatus: 'pending',  deadline: '2026-05-01', owner: 'Беспалов П.'},
  { name: 'Инновационный ваучер',     org: 'АО "МСП"',    amount: 15,  appStatus: 'denied',   deadline: '2026-01-01', owner: 'Иванов А.' }
])

function statusIcon(s) { return { active: '✓', review: '~', pending: '!' }[s] || '?' }
function impactLabel(i) { return { high: 'Высокий', medium: 'Средний', low: 'Низкий' }[i] || i }
function relLabel(r) { return { strategic: 'Стратег.', partner: 'Партнёр', regulator: 'Регулятор', funder: 'Финансист' }[r] || r }
function evStatusLabel(s) { return { done: 'Выполнено', upcoming: 'Скоро', planned: 'Запланировано' }[s] || s }
function grantStatusLabel(s) { return { approved: 'Одобрено', pending: 'В рассмотрении', review: 'На проверке', denied: 'Отказ' }[s] || s }
function isOverdue(d) { return d < new Date().toISOString().slice(0, 10) }

const newEvent = ref({ date: '', title: '', desc: '', type: 'meeting' })
function addEvent() {
  events.value.unshift({ id: Date.now(), ...newEvent.value, tags: [], evStatus: 'planned' })
  showAddEvent.value = false
  newEvent.value = { date: '', title: '', desc: '', type: 'meeting' }
}

function exportGr() {
  const rows = [
    ['Код НПА', 'Название', 'Дата вступления', 'Статус', 'Влияние'],
    ...regulations.value.map(r => [r.code, r.name, r.effectiveDate, r.status, impactLabel(r.impact)])
  ]
  const csv = rows.map(r => r.join(',')).join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = 'gr-report.csv'; a.click()
  URL.revokeObjectURL(url)
}
</script>

<style scoped>
.gov-root { padding: 24px; display: flex; flex-direction: column; gap: 20px; min-height: 100vh; background: var(--p-surface-ground); }
.gov-header { display: flex; align-items: flex-start; justify-content: space-between; flex-wrap: wrap; gap: 12px; }
.gov-header h1 { margin: 0; font-size: 1.75rem; color: var(--p-text-color); }
.gov-subtitle { font-size: 0.9375rem; color: var(--p-text-muted-color); }
.gov-actions { display: flex; gap: 8px; }
.gov-btn { padding: 8px 14px; border-radius: 8px; border: none; cursor: pointer; font-size: 0.875rem; font-weight: 600; }
.gov-btn.primary  { background: var(--p-primary-color); color: #fff; }
.gov-btn.secondary{ background: var(--p-surface-card); color: var(--p-text-color); border: 1px solid var(--p-surface-border); }

.gov-kpi-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 12px; }
.gov-kpi { background: var(--p-content-background); border: 1px solid var(--p-surface-border); border-radius: 10px; padding: 14px 12px; text-align: center; }
.gov-kpi-icon { font-size: 1.4rem; margin-bottom: 4px; }
.gov-kpi-val  { font-size: 2rem; font-weight: 700; color: var(--p-primary-color); }
.gov-kpi-lbl  { font-size: 0.72rem; color: var(--p-text-muted-color); margin-top: 2px; }

.gov-grid { display: grid; grid-template-columns: 2fr 1fr; gap: 16px; }
@media (max-width: 768px) { .gov-grid { grid-template-columns: 1fr; } }

.gov-card { background: var(--p-content-background); border: 1px solid var(--p-surface-border); border-radius: 10px; padding: 20px; }
.gov-card h3 { margin: 0 0 14px; font-size: 1rem; color: var(--p-text-color); }

.radar-list { display: flex; flex-direction: column; gap: 8px; }
.radar-item { display: flex; align-items: flex-start; gap: 10px; padding: 10px; background: var(--p-surface-ground); border-radius: 8px; }
.radar-status { width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.75rem; font-weight: 700; flex-shrink: 0; }
.radar-status.active  { background: #66bb6a22; color: #66bb6a; }
.radar-status.review  { background: #ff980022; color: #ff9800; }
.radar-status.pending { background: #ef535022; color: #ef5350; }
.radar-info { flex: 1; }
.radar-code { font-weight: 700; font-size: 0.82rem; color: var(--p-primary-color); }
.radar-name { font-size: 0.85rem; font-weight: 600; color: var(--p-text-color); }
.radar-desc { font-size: 0.72rem; color: var(--p-text-muted-color); }
.radar-meta { text-align: right; display: flex; flex-direction: column; gap: 4px; }
.radar-date  { font-size: 0.72rem; color: var(--p-text-muted-color); }
.radar-impact { font-size: 0.7rem; padding: 1px 6px; border-radius: 4px; }
.radar-impact.high   { background: #ef535022; color: #ef5350; }
.radar-impact.medium { background: #ff980022; color: #ff9800; }
.radar-impact.low    { background: #66bb6a22; color: #66bb6a; }

.contacts-list { display: flex; flex-direction: column; gap: 8px; }
.contact-item { display: flex; align-items: center; gap: 10px; padding: 8px; background: var(--p-surface-ground); border-radius: 8px; }
.contact-avatar { width: 34px; height: 34px; border-radius: 50%; background: var(--p-primary-color); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 0.72rem; font-weight: 700; flex-shrink: 0; }
.contact-info { flex: 1; min-width: 0; }
.contact-name { font-weight: 600; font-size: 0.82rem; color: var(--p-text-color); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.contact-role { font-size: 0.72rem; color: var(--p-text-muted-color); }
.contact-org  { font-size: 0.68rem; color: var(--p-text-muted-color); }
.contact-rel { font-size: 0.68rem; padding: 2px 6px; border-radius: 4px; white-space: nowrap; }
.contact-rel.strategic { background: var(--p-primary-color); color: #fff; }
.contact-rel.partner   { background: #66bb6a22; color: #66bb6a; }
.contact-rel.regulator { background: #ef535022; color: #ef5350; }
.contact-rel.funder    { background: #42a5f522; color: #42a5f5; }

.timeline { display: flex; flex-direction: column; gap: 0; }
.tl-item { display: grid; grid-template-columns: 90px 12px 1fr auto; align-items: flex-start; gap: 12px; padding: 10px 0; border-bottom: 1px solid var(--p-surface-border); }
.tl-item:last-child { border-bottom: none; }
.tl-date { font-size: 0.75rem; color: var(--p-text-muted-color); padding-top: 2px; }
.tl-dot  { width: 12px; height: 12px; border-radius: 50%; margin-top: 3px; }
.tl-dot.meeting    { background: var(--p-primary-color); }
.tl-dot.regulation { background: #ef5350; }
.tl-dot.grant      { background: #66bb6a; }
.tl-dot.milestone  { background: #ff9800; }
.tl-title { font-weight: 600; font-size: 0.85rem; color: var(--p-text-color); }
.tl-desc  { font-size: 0.75rem; color: var(--p-text-muted-color); margin-top: 2px; }
.tl-tags  { display: flex; gap: 4px; flex-wrap: wrap; margin-top: 4px; }
.tl-tag   { font-size: 0.65rem; padding: 1px 6px; border-radius: 4px; background: var(--p-surface-ground); color: var(--p-text-muted-color); border: 1px solid var(--p-surface-border); }
.tl-status { font-size: 0.72rem; padding: 2px 8px; border-radius: 4px; white-space: nowrap; }
.tl-status.done     { background: #66bb6a22; color: #66bb6a; }
.tl-status.upcoming { background: #ff980022; color: #ff9800; }
.tl-status.planned  { background: var(--p-surface-ground); color: var(--p-text-muted-color); border: 1px solid var(--p-surface-border); }

.gov-table { width: 100%; border-collapse: collapse; font-size: 0.83rem; }
.gov-table th { padding: 7px 10px; text-align: left; color: var(--p-text-muted-color); border-bottom: 1px solid var(--p-surface-border); font-size: 0.75rem; }
.gov-table td { padding: 9px 10px; border-bottom: 1px solid var(--p-surface-border); color: var(--p-text-color); }
.gov-table tr:last-child td { border: none; }
.grant-name { font-weight: 600; }
.grant-date.overdue { color: #ef5350; }
.num { text-align: right; }
.grant-status { padding: 2px 8px; border-radius: 4px; font-size: 0.72rem; font-weight: 600; }
.grant-status.approved { background: #66bb6a22; color: #66bb6a; }
.grant-status.pending  { background: #ff980022; color: #ff9800; }
.grant-status.review   { background: #42a5f522; color: #42a5f5; }
.grant-status.denied   { background: #ef535022; color: #ef5350; }

.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 100; }
.modal-box { background: var(--p-content-background); border-radius: 12px; padding: 24px; width: 400px; max-width: 95vw; }
.modal-box h3 { margin: 0 0 16px; }
.modal-form { display: flex; flex-direction: column; gap: 8px; margin-bottom: 16px; }
.modal-form label { font-size: 0.75rem; color: var(--p-text-muted-color); }
.modal-form input, .modal-form textarea, .modal-form select { background: var(--p-surface-ground); border: 1px solid var(--p-surface-border); border-radius: 6px; padding: 7px 10px; color: var(--p-text-color); font-size: 0.85rem; width: 100%; resize: vertical; }
.modal-actions { display: flex; gap: 8px; justify-content: flex-end; }
</style>
