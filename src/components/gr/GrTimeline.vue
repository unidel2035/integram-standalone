<!-- GrTimeline — визуальная лента событий проекта (событийная онтология) -->
<template>
  <div class="gr-timeline">

    <!-- Статистика -->
    <div class="gr-tl-stats">
      <div class="gr-tl-stat">
        <span class="gr-tl-stat-val">{{ stats.trlProgress }}</span>
        <span class="gr-tl-stat-lbl">TRL</span>
      </div>
      <div class="gr-tl-stat">
        <span class="gr-tl-stat-val">{{ formatMoney(stats.totalFunding) }}</span>
        <span class="gr-tl-stat-lbl">Привлечено</span>
      </div>
      <div class="gr-tl-stat">
        <span class="gr-tl-stat-val">{{ stats.measuresApplied }}</span>
        <span class="gr-tl-stat-lbl">Заявок</span>
      </div>
      <div class="gr-tl-stat">
        <span class="gr-tl-stat-val">{{ stats.approvalRate }}</span>
        <span class="gr-tl-stat-lbl">Одобрено</span>
      </div>
      <div class="gr-tl-stat">
        <span class="gr-tl-stat-val">{{ stats.triggersFound }}</span>
        <span class="gr-tl-stat-lbl">Триггеров</span>
      </div>
    </div>

    <!-- Субъектный фильтр -->
    <div class="gr-tl-subject-bar">
      <span class="gr-tl-subj-title">Взгляд субъекта:</span>
      <button v-for="role in SUBJECT_FILTER_OPTS" :key="role.id"
              :class="['gr-tl-subj-btn', { active: subjectFilter === role.id }]"
              :style="subjectFilter === role.id ? { background: role.color+'22', color: role.color, borderColor: role.color+'66' } : {}"
              @click="subjectFilter = role.id">
        <i :class="role.icon" />
        {{ role.label }}
      </button>
    </div>

    <!-- Лента прошедших событий -->
    <div class="gr-tl-section-title">
      <i class="pi pi-history" />
      История событий
      <span v-if="subjectFilter !== 'all'" class="gr-tl-subj-tag"
            :style="{ background: subjectColor+'22', color: subjectColor }">
        глазами: {{ SUBJECT_ROLES[subjectFilter]?.label }}
      </span>
    </div>

    <div v-if="!filteredEvents.length" class="gr-tl-empty">
      {{ subjectFilter === 'all' ? 'Лента пуста — инициализируйте проект' : `Субъект «${SUBJECT_ROLES[subjectFilter]?.label}» не видит событий в этой ленте` }}
    </div>

    <div class="gr-tl-events">
      <TransitionGroup name="tl-evt">
        <div v-for="(evt, i) in filteredEvents" :key="evt.id"
             :class="['gr-tl-event', `gr-tl-event--${(eventDef(evt.type) || {}).phase || 'other'}`]">

          <!-- Линия соединения -->
          <div v-if="i < filteredEvents.length - 1" class="gr-tl-connector" />

          <!-- Иконка -->
          <div class="gr-tl-icon-wrap"
               :style="{ background: (eventDef(evt.type) || {}).color + '22', borderColor: (eventDef(evt.type) || {}).color + '66' }">
            <i :class="(eventDef(evt.type) || {}).icon || 'pi pi-circle'"
               :style="{ color: (eventDef(evt.type) || {}).color }" />
          </div>

          <!-- Содержимое -->
          <div class="gr-tl-content">
            <div class="gr-tl-ev-header">
              <span class="gr-tl-ev-label">{{ (eventDef(evt.type) || {}).label || evt.type }}</span>
              <span class="gr-tl-ev-time">{{ formatDate(evt.ts) }}</span>
              <button v-if="editable" class="gr-tl-ev-cf" @click="$emit('counterfactual', evt)" title="«Что если бы не было?»">⟲?</button>
              <button v-if="editable" class="gr-tl-ev-del" @click="$emit('remove', evt.id)" title="Удалить">×</button>
            </div>

            <!-- Субъект/объект + интерфейс -->
            <div v-if="eventDef(evt.type)" class="gr-tl-ev-subj">
              <span class="gr-tl-ev-subj-who">{{ eventDef(evt.type).subject }}</span>
              <span class="gr-tl-ev-arrow">→</span>
              <span class="gr-tl-ev-subj-obj">{{ eventDef(evt.type).object }}</span>
              <span v-if="getEvtInterface(evt.type)" class="gr-tl-ev-iface"
                    :style="{ background: getEvtInterface(evt.type).color+'18', color: getEvtInterface(evt.type).color }">
                ∩ {{ getEvtInterface(evt.type).label }}
              </span>
            </div>

            <!-- Данные события -->
            <div v-if="evt.data?.measure" class="gr-tl-ev-measure">
              <span class="gr-tl-ev-measure-name">{{ getMeasureName(evt.data.measure) }}</span>
              <span v-if="evt.data.amount" class="gr-tl-ev-measure-amt">{{ formatMoney(evt.data.amount) }}</span>
            </div>

            <div v-if="evt.data?.reason" class="gr-tl-ev-reason">{{ evt.data.reason }}</div>
            <div v-if="evt.data?.to" class="gr-tl-ev-trl">TRL → {{ evt.data.to }}</div>
            <div v-if="evt.data?.auto" class="gr-tl-ev-auto">авто-диагностика</div>
          </div>
        </div>
      </TransitionGroup>
    </div>

    <!-- Разделитель СЕЙЧАС/БУДУЩЕЕ -->
    <div class="gr-tl-now">
      <span>— СЕЙЧАС —</span>
    </div>

    <!-- Возможные следующие события -->
    <div class="gr-tl-section-title">
      <i class="pi pi-arrow-right" />
      Следующие возможные события
      <span class="gr-tl-count">{{ possibleVisible.length }}</span>
    </div>

    <!-- Фильтр вероятности -->
    <div class="gr-tl-prob-filter">
      <button v-for="p in PROB_FILTERS" :key="p.id"
              :class="['gr-tl-pf-btn', { active: probFilter === p.id }]"
              :style="probFilter === p.id ? { background: p.color + '33', color: p.color, borderColor: p.color + '88' } : {}"
              @click="probFilter = p.id">
        {{ p.label }}
        <span class="gr-tl-pf-count">{{ countByProb(p.id) }}</span>
      </button>
    </div>

    <!-- Subject override — кто фиксирует событие -->
    <Transition name="tl-evt">
      <div v-if="pendingEvent" class="gr-tl-subj-override">
        <span class="gr-tl-so-label">Кто фиксирует «{{ pendingEvent.eventDef?.label || pendingEvent.type }}»?</span>
        <button v-for="role in SUBJECT_FILTER_OPTS.filter(r => r.id !== 'all')" :key="role.id"
                :class="['gr-tl-so-btn', { active: pendingSubject === role.id }]"
                :style="pendingSubject === role.id ? { background: role.color+'22', color: role.color, borderColor: role.color } : {}"
                @click="pendingSubject = role.id">
          <i :class="role.icon" />{{ role.label }}
        </button>
        <button class="gr-tl-so-confirm" @click="confirmApply">Добавить</button>
        <button class="gr-tl-so-cancel" @click="pendingEvent = null">×</button>
      </div>
    </Transition>

    <div class="gr-tl-possible">
      <div v-for="poss in possibleVisible" :key="poss.type + (poss.measure?.id || '')"
           :class="['gr-tl-poss', `gr-tl-poss--${poss.probability}`]"
           @click="startApply(poss)">

        <div class="gr-tl-poss-icon"
             :style="{ background: (poss.eventDef?.color || '#64748b') + '22', borderColor: (poss.eventDef?.color || '#64748b') + '66' }">
          <i :class="poss.eventDef?.icon || 'pi pi-circle'"
             :style="{ color: poss.eventDef?.color || '#64748b' }" />
        </div>

        <div class="gr-tl-poss-body">
          <div class="gr-tl-poss-header">
            <span class="gr-tl-poss-label">{{ poss.eventDef?.label || poss.type }}</span>
            <span :class="['gr-tl-poss-prob', `prob-${poss.probability}`]">{{ PROB_LABELS[poss.probability] }}</span>
          </div>
          <div v-if="poss.measure" class="gr-tl-poss-measure">
            <span class="gr-tl-poss-measure-name">{{ poss.measure.name }}</span>
            <span class="gr-tl-poss-measure-amt">{{ poss.measure.amount }}</span>
          </div>
          <div class="gr-tl-poss-reason">{{ poss.reason }}</div>
          <div v-if="poss.blockedBy?.length" class="gr-tl-poss-blocked">
            <i class="pi pi-lock" /> ожидает: {{ poss.blockedBy.join(', ') }}
          </div>
        </div>

        <div v-if="poss.probability !== 'blocked'" class="gr-tl-poss-arrow">
          <i class="pi pi-plus" />
        </div>
      </div>

      <div v-if="!possibleVisible.length" class="gr-tl-empty">
        Нет доступных событий для выбранного фильтра
      </div>
    </div>

  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { GR_EVENT_TYPES } from '@/config/grEventTypes.js'
import { GR_MEASURES } from '@/config/grMeasuresData.js'
import { subjectView, SUBJECT_ROLES, getEventInterface } from '@/services/grEventEngine.js'

const props = defineProps({
  events:   { type: Array, default: () => [] },
  possible: { type: Array, default: () => [] },
  stats:    { type: Object, default: () => ({}) },
  editable: { type: Boolean, default: true },
})

const emit = defineEmits(['apply', 'remove', 'counterfactual'])

const PROB_FILTERS = [
  { id: 'all',     label: 'Все',        color: '#64748b' },
  { id: 'high',    label: 'Высокие',    color: '#22c55e' },
  { id: 'medium',  label: 'Средние',    color: '#f59e0b' },
  { id: 'low',     label: 'Низкие',     color: '#94a3b8' },
  { id: 'blocked', label: 'Заблокир.',  color: '#ef4444' },
]

const PROB_LABELS = {
  high: 'Высокая',
  medium: 'Средняя',
  low: 'Низкая',
  blocked: 'Заблокировано',
}

const probFilter    = ref('all')
const subjectFilter = ref('all')

// Subject override — кто фиксирует новое событие
const pendingEvent   = ref(null)
const pendingSubject = ref('team')

function startApply(poss) {
  if (poss.probability === 'blocked') return
  pendingEvent.value   = poss
  pendingSubject.value = 'team'
}

function confirmApply() {
  if (!pendingEvent.value) return
  emit('apply', { ...pendingEvent.value, subject: pendingSubject.value })
  pendingEvent.value = null
}

const SUBJECT_FILTER_OPTS = [
  { id: 'all',      label: 'Все',      color: '#64748b', icon: 'pi pi-globe' },
  { id: 'team',     label: 'Команда',  color: '#3b82f6', icon: 'pi pi-users' },
  { id: 'fund',     label: 'Фонд',     color: '#f59e0b', icon: 'pi pi-star' },
  { id: 'operator', label: 'Оператор', color: '#22c55e', icon: 'pi pi-building' },
]

const subjectColor = computed(() =>
  SUBJECT_FILTER_OPTS.find(r => r.id === subjectFilter.value)?.color || '#64748b'
)

const filteredEvents = computed(() => subjectView(props.events, subjectFilter.value))

const possibleVisible = computed(() =>
  probFilter.value === 'all'
    ? props.possible
    : props.possible.filter(p => p.probability === probFilter.value)
)

function countByProb(id) {
  if (id === 'all') return props.possible.length
  return props.possible.filter(p => p.probability === id).length
}

function eventDef(type) {
  return GR_EVENT_TYPES[type] || null
}

function getEvtInterface(type) {
  return getEventInterface(type)
}

function getMeasureName(measureId) {
  return GR_MEASURES.find(m => m.id === measureId)?.name || measureId
}

function formatDate(ts) {
  return new Date(ts).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function formatMoney(n) {
  if (!n) return '—'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} млн ₽`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)} тыс. ₽`
  return `${n} ₽`
}
</script>

<style scoped>
.gr-timeline {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

/* ─── Статистика ─── */
.gr-tl-stats {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
  background: var(--p-surface-card);
  border: 1px solid var(--p-content-border-color);
  border-radius: 10px;
  padding: 0.75rem 1.25rem;
}
.gr-tl-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 60px;
}
.gr-tl-stat-val {
  font-size: 1.2rem;
  font-weight: 700;
  color: var(--p-text-color);
}
.gr-tl-stat-lbl {
  font-size: 0.7rem;
  color: var(--p-text-muted-color);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

/* ─── Section title ─── */
.gr-tl-section-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.78rem;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: var(--p-text-muted-color);
  padding: 0.25rem 0;
}
.gr-tl-count {
  background: var(--p-primary-color);
  color: #fff;
  border-radius: 10px;
  padding: 0 0.4rem;
  font-size: 0.7rem;
}

.gr-tl-empty {
  text-align: center;
  color: var(--p-text-muted-color);
  font-size: 0.85rem;
  padding: 1rem;
}

/* ─── Events list ─── */
.gr-tl-events {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.gr-tl-event {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  position: relative;
  padding-bottom: 1rem;
}

.gr-tl-connector {
  position: absolute;
  left: 19px;
  top: 40px;
  bottom: 0;
  width: 2px;
  background: var(--p-content-border-color);
  z-index: 0;
}

.gr-tl-icon-wrap {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  border: 2px solid;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  z-index: 1;
  background: var(--p-surface-card);
}
.gr-tl-icon-wrap i {
  font-size: 0.9rem;
}

.gr-tl-content {
  flex: 1;
  background: var(--p-surface-card);
  border: 1px solid var(--p-content-border-color);
  border-radius: 8px;
  padding: 0.5rem 0.75rem;
}

.gr-tl-ev-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.gr-tl-ev-label {
  font-weight: 600;
  font-size: 0.87rem;
  color: var(--p-text-color);
  flex: 1;
}
.gr-tl-ev-time {
  font-size: 0.7rem;
  color: var(--p-text-muted-color);
}
.gr-tl-ev-del {
  background: none;
  border: none;
  color: var(--p-text-muted-color);
  cursor: pointer;
  font-size: 1rem;
  line-height: 1;
  padding: 0 0.2rem;
  opacity: 0.4;
  transition: opacity 0.15s;
}
.gr-tl-ev-del:hover { opacity: 1; color: #ef4444; }

.gr-tl-ev-cf {
  background: none; border: none; color: var(--p-text-muted-color);
  cursor: pointer; font-size: 0.75rem; font-weight: 600;
  padding: 0 0.3rem; opacity: 0.5; transition: opacity 0.15s;
  border-radius: 4px;
}
.gr-tl-ev-cf:hover { opacity: 1; color: #8b5cf6; background: rgba(139,92,246,0.1); }

.gr-tl-ev-subj {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.75rem;
  color: var(--p-text-muted-color);
  margin-top: 0.15rem;
}
.gr-tl-ev-subj-who { font-weight: 500; }
.gr-tl-ev-arrow { opacity: 0.5; }
.gr-tl-ev-subj-obj { font-weight: 500; }

.gr-tl-ev-measure {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.25rem;
  font-size: 0.8rem;
}
.gr-tl-ev-measure-name { color: var(--p-primary-color); font-weight: 500; }
.gr-tl-ev-measure-amt { color: var(--p-text-muted-color); }

.gr-tl-ev-reason,
.gr-tl-ev-trl { font-size: 0.75rem; color: var(--p-text-muted-color); margin-top: 0.15rem; }
.gr-tl-ev-trl { color: #6366f1; font-weight: 600; }
.gr-tl-ev-auto { font-size: 0.65rem; color: var(--p-text-muted-color); font-style: italic; margin-top: 0.1rem; }

/* ─── Now divider ─── */
.gr-tl-now {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.75rem;
  color: var(--p-primary-color);
  font-weight: 600;
  letter-spacing: 0.08em;
  padding: 0.25rem 0;
}
.gr-tl-now::before, .gr-tl-now::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--p-primary-color);
  opacity: 0.4;
}

/* ─── Probability filter ─── */
.gr-tl-prob-filter {
  display: flex;
  gap: 0.4rem;
  flex-wrap: wrap;
}
.gr-tl-pf-btn {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  border: 1px solid var(--p-content-border-color);
  background: var(--p-surface-card);
  border-radius: 20px;
  padding: 0.2rem 0.6rem;
  font-size: 0.78rem;
  cursor: pointer;
  color: var(--p-text-muted-color);
  transition: all 0.15s;
}
.gr-tl-pf-btn:hover { border-color: var(--p-primary-color); color: var(--p-text-color); }
.gr-tl-pf-btn.active { font-weight: 600; }
.gr-tl-pf-count {
  background: currentColor;
  color: var(--p-surface-card);
  border-radius: 10px;
  padding: 0 0.3rem;
  font-size: 0.65rem;
}

/* ─── Possible events ─── */
.gr-tl-possible {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.gr-tl-poss {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.6rem 0.75rem;
  background: var(--p-surface-card);
  border: 1px solid var(--p-content-border-color);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s;
}
.gr-tl-poss:hover { border-color: var(--p-primary-color); background: var(--p-primary-color)08; }
.gr-tl-poss--blocked { opacity: 0.55; cursor: default; }
.gr-tl-poss--blocked:hover { border-color: var(--p-content-border-color); background: var(--p-surface-card); }
.gr-tl-poss--high { border-left: 3px solid #22c55e; }
.gr-tl-poss--medium { border-left: 3px solid #f59e0b; }
.gr-tl-poss--blocked { border-left: 3px solid #ef444466; }

.gr-tl-poss-icon {
  width: 34px; height: 34px;
  border-radius: 50%;
  border: 1.5px solid;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.gr-tl-poss-icon i { font-size: 0.82rem; }

.gr-tl-poss-body { flex: 1; }
.gr-tl-poss-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.gr-tl-poss-label { font-weight: 600; font-size: 0.85rem; color: var(--p-text-color); }
.gr-tl-poss-prob {
  font-size: 0.68rem;
  border-radius: 10px;
  padding: 0.1rem 0.4rem;
  font-weight: 500;
}
.prob-high { background: #22c55e22; color: #22c55e; }
.prob-medium { background: #f59e0b22; color: #f59e0b; }
.prob-low { background: #94a3b822; color: #94a3b8; }
.prob-blocked { background: #ef444422; color: #ef4444; }

.gr-tl-poss-measure {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.15rem;
  font-size: 0.78rem;
}
.gr-tl-poss-measure-name { color: var(--p-primary-color); font-weight: 500; }
.gr-tl-poss-measure-amt { color: var(--p-text-muted-color); }
.gr-tl-poss-reason { font-size: 0.73rem; color: var(--p-text-muted-color); margin-top: 0.1rem; }
.gr-tl-poss-blocked { font-size: 0.7rem; color: #ef4444; display: flex; align-items: center; gap: 0.3rem; margin-top: 0.1rem; }

.gr-tl-poss-arrow {
  color: var(--p-primary-color);
  opacity: 0.6;
  font-size: 0.9rem;
}

/* ─── Subject filter ─── */
.gr-tl-subject-bar {
  display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
  padding: 8px 12px; background: var(--p-surface-card);
  border: 1px solid var(--p-content-border-color); border-radius: 8px;
}
.gr-tl-subj-title { font-size: 11px; color: var(--p-text-muted-color); white-space: nowrap; }
.gr-tl-subj-btn {
  display: flex; align-items: center; gap: 4px;
  border: 1px solid var(--p-content-border-color); border-radius: 16px;
  background: transparent; cursor: pointer; font-size: 11px; font-weight: 500;
  color: var(--p-text-muted-color); padding: 3px 10px; transition: all 0.15s;
  font-family: inherit;
}
.gr-tl-subj-btn:hover { color: var(--p-text-color); }
.gr-tl-subj-btn.active { font-weight: 700; }
.gr-tl-subj-tag {
  font-size: 10px; padding: 2px 8px; border-radius: 10px; margin-left: 6px; font-weight: 600;
}

/* ─── Interface badge ─── */
.gr-tl-ev-iface {
  font-size: 9px; padding: 1px 6px; border-radius: 8px;
  font-weight: 600; margin-left: 6px; white-space: nowrap;
}

/* Transition — анимация появления нового события */
.tl-evt-enter-active {
  transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}
.tl-evt-leave-active {
  transition: all 0.2s ease;
}
.tl-evt-enter-from {
  opacity: 0;
  transform: translateX(-20px) scale(0.96);
}
.tl-evt-leave-to {
  opacity: 0;
  transform: translateX(20px) scale(0.96);
}

/* ─── Subject override panel ─── */
.gr-tl-subj-override {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: var(--p-surface-card);
  border: 1px solid var(--p-primary-color);
  border-radius: 10px;
  font-size: 12px;
  flex-wrap: wrap;
}
.gr-tl-so-label { color: var(--p-text-muted-color); white-space: nowrap; }
.gr-tl-so-btn {
  display: flex; align-items: center; gap: 4px;
  border: 1px solid var(--p-content-border-color); border-radius: 12px;
  background: transparent; cursor: pointer; font-size: 11px;
  color: var(--p-text-muted-color); padding: 2px 8px; transition: all 0.15s;
  font-family: inherit;
}
.gr-tl-so-btn:hover { color: var(--p-text-color); }
.gr-tl-so-btn.active { font-weight: 700; border-color: currentColor; }
.gr-tl-so-confirm {
  margin-left: auto;
  background: var(--p-primary-color);
  color: #fff;
  border: none;
  border-radius: 8px;
  padding: 3px 12px;
  font-size: 11px;
  cursor: pointer;
  font-family: inherit;
}
.gr-tl-so-cancel {
  background: none; border: none; cursor: pointer;
  color: var(--p-text-muted-color); font-size: 16px; line-height: 1;
}
</style>
