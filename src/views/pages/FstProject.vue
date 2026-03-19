<template>
  <FstPageLayout
    :title="project?.name || 'Проект'"
    :subtitle="project?.company + ' · ' + project?.subfund + ' · TRL ' + project?.trl"
    icon="pi pi-building"
  >
    <template #actions>
      <Button icon="pi pi-arrow-left" label="Назад" size="small" severity="secondary" text @click="$router.back()" />
      <Button v-if="project" icon="pi pi-sparkles" label="AI-бриф" size="small" severity="secondary"
        @click="generateBrief" :loading="briefLoading" />
      <Button v-if="project" icon="pi pi-chart-bar" label="Факторы" size="small" severity="secondary"
        @click="goTo('factor')" />
      <Button v-if="project" icon="pi pi-users" label="На ИК" size="small" severity="success"
        @click="goTo('committee')" />
      <Button v-if="project" icon="pi pi-file-edit" label="Сделка" size="small" severity="secondary"
        @click="goTo('deal')" />
    </template>

    <!-- ─── Pipeline strip ─── -->
    <div class="fp-pipeline fst-metrics-strip">
      <div v-for="(stage, idx) in pipelineStages" :key="stage.id"
        class="fp-pipeline-stage"
        :class="{ 'fp-stage--done': stage.status === 'done', 'fp-stage--active': stage.status === 'active', 'fp-stage--pending': stage.status === 'pending' }"
        @click="stage.to && goToPage(stage.to)"
        :style="stage.to ? 'cursor:pointer' : ''"
      >
        <div class="fp-stage-arrow" v-if="idx > 0">›</div>
        <div class="fp-stage-content">
          <i :class="[stage.icon, 'fp-stage-icon']"></i>
          <div class="fp-stage-label">{{ stage.label }}</div>
          <div class="fp-stage-status">
            <i v-if="stage.status === 'done'"    class="pi pi-check-circle" style="color:var(--fst-green);font-size:10px"></i>
            <i v-else-if="stage.status === 'active'" class="pi pi-spin pi-spinner" style="color:var(--fst-brand);font-size:10px"></i>
            <i v-else class="pi pi-circle" style="color:var(--p-text-muted-color);font-size:10px"></i>
            <span v-if="stage.badge" class="fp-stage-badge">{{ stage.badge }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- ─── AI-бриф ─── -->
    <div v-if="brief" class="fp-brief">
      <div class="fp-brief-header">
        <i class="pi pi-sparkles" style="color:var(--fst-purple)"></i>
        AI-бриф по проекту
        <button class="fp-brief-close" @click="brief = null">×</button>
      </div>
      <div class="fp-brief-text">{{ brief }}</div>
    </div>

    <!-- ─── Body: timeline + sidebar ─── -->
    <div class="fp-body" v-if="project">
      <!-- LEFT: Event timeline -->
      <div class="fp-timeline-col">
        <div class="fst-section-label">ЛЕНТА СОБЫТИЙ</div>

        <div v-if="loading" class="fp-loading">
          <ProgressSpinner style="width:32px;height:32px" />
        </div>

        <div v-else-if="mergedTimeline.length === 0" class="fp-empty">
          <i class="pi pi-clock" style="font-size:24px;color:var(--p-text-muted-color)"></i>
          <div>Событий пока нет</div>
          <div style="font-size:12px;color:var(--p-text-muted-color)">Начните с факторной оценки или инвесткомитета</div>
        </div>

        <div v-else class="fp-events">
          <div v-for="evt in mergedTimeline" :key="evt.id" class="fp-event" :class="'fp-event--' + eventSeverity(evt.type)">
            <div class="fp-event-dot" :style="{ background: eventColor(evt.type) }"></div>
            <div class="fp-event-body">
              <div class="fp-event-header">
                <span class="fp-event-type">{{ eventLabel(evt) }}</span>
                <span class="fp-event-time">{{ formatTime(evt.ts) }}</span>
              </div>
              <div class="fp-event-detail" v-if="evt.summary">{{ evt.summary }}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- RIGHT: Project details -->
      <div class="fp-detail-col">
        <div class="fst-section-label">ПАРАМЕТРЫ ПРОЕКТА</div>

        <div class="fp-detail-panel">
          <div class="fp-detail-row">
            <span>Компания</span>
            <strong>{{ project.company }}</strong>
          </div>
          <div class="fp-detail-row">
            <span>Субфонд</span>
            <Tag :value="project.subfund" style="font-size:11px;background:var(--fst-blue);color:white" />
          </div>
          <div class="fp-detail-row">
            <span>Стадия</span>
            <strong>{{ project.stage || '—' }}</strong>
          </div>
          <div class="fp-detail-row">
            <span>TRL</span>
            <strong :style="{ color: trlColor(project.trl) }">{{ project.trl }}</strong>
          </div>
          <div class="fp-detail-row">
            <span>Суверенность</span>
            <strong :style="{ color: sovColor(project.sovereignty) }">{{ project.sovereignty }}/9</strong>
          </div>
          <div class="fp-detail-row" v-if="project.askMln">
            <span>Запрос</span>
            <strong>{{ project.askMln }} млн ₽</strong>
          </div>
          <div class="fp-detail-row" v-if="project.inn">
            <span>ИНН</span>
            <strong style="font-size:12px">{{ project.inn }}</strong>
          </div>
          <div v-if="project.description" class="fp-detail-desc">
            {{ project.description }}
          </div>
        </div>

        <!-- Factor result if available -->
        <div v-if="lastFactorEvent" class="fp-detail-panel fp-factor-panel">
          <div class="fst-section-label" style="padding:0 0 8px">ФАКТОРНАЯ ОЦЕНКА</div>
          <div class="fp-factor-grade">
            <span class="fp-grade-val" :style="{ color: gradeColor(lastFactorEvent.data?.grade) }">
              {{ lastFactorEvent.data?.grade }}
            </span>
            <span class="fp-composite">{{ lastFactorEvent.data?.composite?.toFixed(1) }}/10</span>
          </div>
          <div v-if="lastFactorEvent.data?.factors" class="fp-factor-bars">
            <div v-for="(f, key) in lastFactorEvent.data.factors" :key="key" class="fp-factor-row">
              <span class="fp-fkey">{{ key }}</span>
              <div class="fp-fbar">
                <div class="fp-fbar-fill" :style="{
                  width: ((f.score||0)/10*100) + '%',
                  background: scoreColor(f.score)
                }"></div>
              </div>
              <span class="fp-fscore" :style="{ color: scoreColor(f.score) }">
                {{ f.score != null ? f.score.toFixed(1) : '—' }}
              </span>
            </div>
          </div>
        </div>

        <!-- Committee decision if available -->
        <div v-if="lastDecision" class="fp-detail-panel">
          <div class="fst-section-label" style="padding:0 0 8px">РЕШЕНИЕ ИК</div>
          <div class="fp-decision" :class="'fp-decision--' + decisionClass(lastDecision.data?.verdict)">
            <i :class="decisionIcon(lastDecision.data?.verdict)"></i>
            <span>{{ lastDecision.data?.verdict }}</span>
            <span v-if="lastDecision.data?.score" style="margin-left:auto;font-size:12px;opacity:0.8">
              {{ lastDecision.data.score?.toFixed(1) }}/10
            </span>
          </div>
          <div v-if="lastDecision.data?.conditions?.length" class="fp-conditions">
            <div class="fst-section-label" style="padding:8px 0 4px;font-size:10px">Условия:</div>
            <div v-for="c in lastDecision.data.conditions" :key="c" class="fp-condition">
              <i class="pi pi-angle-right" style="font-size:10px;color:var(--fst-brand)"></i> {{ c }}
            </div>
          </div>
        </div>

        <!-- Navigation actions -->
        <div class="fp-actions">
          <Button icon="pi pi-chart-bar" label="Факторная модель" severity="secondary" size="small" fluid
            @click="goTo('factor')" />
          <Button icon="pi pi-users" label="Инвесткомитет" severity="primary" size="small" fluid
            @click="goTo('committee')" />
          <Button icon="pi pi-file-edit" label="Структура сделки" severity="secondary" size="small" fluid
            @click="goTo('deal')" />
          <Button icon="pi pi-briefcase" label="Портфельный монитор" severity="secondary" size="small" fluid
            @click="$router.push('/fst-portfolio')" />
        </div>
      </div>
    </div>

    <!-- No project: список всех проектов из Integram -->
    <div v-else class="fp-list">
      <div class="fst-section-label" style="padding: 16px 0 12px">ВСЕ ПРОЕКТЫ</div>

      <div v-if="allProjectsLoading" class="fp-loading">
        <ProgressSpinner style="width:32px;height:32px" />
      </div>

      <div v-else-if="allProjects.length === 0" class="fp-empty">
        <i class="pi pi-inbox" style="font-size:24px;color:var(--p-text-muted-color)"></i>
        <div>Проектов в базе нет</div>
        <Button label="Добавить заявку" icon="pi pi-plus" severity="success" size="small"
          @click="$router.push('/fst-dealflow')" />
      </div>

      <div v-else class="fp-list-grid">
        <div v-for="p in allProjects" :key="p.id" class="fp-list-card" @click="selectProject(p)">
          <div class="fp-lc-top">
            <span class="fp-lc-name">{{ p.name }}</span>
            <span class="fp-lc-subfund" :style="{ background: subfundColor(p.subfund) }">{{ p.subfund }}</span>
          </div>
          <div class="fp-lc-meta">
            TRL {{ p.trl || '—' }} · {{ p.stage || '—' }} · {{ p.askMln ? p.askMln + ' млн ₽' : '—' }}
          </div>
          <div class="fp-lc-stage">
            <span class="fp-lc-stage-dot" :style="{ background: stageColor(p._statusId) }"></span>
            {{ stageLabel(p._statusId) }}
          </div>
        </div>
      </div>
    </div>

  </FstPageLayout>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import FstPageLayout from '@/components/fst-shared/FstPageLayout.vue'
import Button from 'primevue/button'
import Tag from 'primevue/tag'
import ProgressSpinner from 'primevue/progressspinner'
import { useEventStore } from '@/stores/eventStore.js'
import { useProjectStore } from '@/stores/projectStore.js'
import { useFstData } from '@/composables/useFstData.js'
import { SUBFUNDS, STATUSES } from '@/services/fstApi.js'

const route      = useRoute()
const router     = useRouter()
const eventStore = useEventStore()
const projStore  = useProjectStore()
const { projects: rawProjects, loadProjects, projectsLoading: allProjectsLoading } = useFstData()

const loading      = ref(false)
const brief        = ref(null)
const briefLoading = ref(false)

// Subfund id → name
const SUBFUND_ID_TO_NAME = Object.fromEntries(Object.entries(SUBFUNDS).map(([name, id]) => [id, name]))
const STATUS_LABELS = {
  [STATUSES['Новый']]:               'Новый',
  [STATUSES['На рассмотрении ИК']]:  'На ИК',
  [STATUSES['Одобрен']]:             'Одобрен',
  [STATUSES['На доработке']]:        'На доработке',
  [STATUSES['В работе']]:            'В работе',
  [STATUSES['Закрыт']]:              'Закрыт',
}
const STATUS_COLORS = {
  [STATUSES['Новый']]:               'var(--p-text-muted-color)',
  [STATUSES['На рассмотрении ИК']]:  'var(--fst-cyan)',
  [STATUSES['Одобрен']]:             'var(--fst-green)',
  [STATUSES['На доработке']]:        'var(--fst-brand)',
  [STATUSES['В работе']]:            'var(--fst-blue)',
  [STATUSES['Закрыт']]:              'var(--fst-red)',
}

const allProjects = computed(() =>
  rawProjects.value.map(p => ({
    id:        p.id,
    name:      p.name || '',
    subfund:   SUBFUND_ID_TO_NAME[p.subfundId] || '—',
    trl:       p.trl || 0,
    stage:     p.stage || '',
    askMln:    p.amount ? Math.round(p.amount / 1_000_000) : 0,
    _statusId: p.statusId,
  }))
)

function subfundColor(s) {
  return { БАС: 'var(--fst-blue)', РОБО: 'var(--fst-green)', МЭ: 'var(--fst-purple)' }[s] || 'var(--p-text-muted-color)'
}
function stageLabel(sid) { return STATUS_LABELS[sid] || 'Неизвестно' }
function stageColor(sid) { return STATUS_COLORS[sid] || 'var(--p-text-muted-color)' }

function selectProject(p) {
  projStore.setActive({ ...p, _source: 'project-list' })
  router.push('/fst-project/' + p.id)
}

// ── Resolve project ───────────────────────────────────────────────────────────
// Берём проект из route.params.id, или из projectStore если id совпадает
const project = computed(() => {
  const routeId = route.params.id
  const active  = projStore.activeProject
  if (routeId && active && (active.id === routeId || active.name === routeId)) return active
  if (routeId && !active) return null
  if (!routeId) return active
  // Попробуем использовать routeId как имя
  return active
})

// ── Event timelines ───────────────────────────────────────────────────────────
const dealTimeline    = ref([])
const projectTimeline = ref([])
const sessionTimeline = ref([])

onMounted(async () => {
  // Всегда загружаем список для режима "все проекты"
  loadProjects().catch(() => {})

  if (!project.value) return
  loading.value = true
  const pid = project.value.id
  try {
    await Promise.all([
      eventStore.load('deal', pid),
      eventStore.load('project', pid),
    ])
    dealTimeline.value    = eventStore.getTimeline('deal', pid)
    projectTimeline.value = eventStore.getTimeline('project', pid)
    // Sessions: filter all sessions where data.projectId === pid
    const allSessions = eventStore.getTimeline('session', '_all')
    sessionTimeline.value = allSessions.filter(e => e.data?.projectId === pid)
  } catch {
    // offline
  } finally {
    loading.value = false
  }
})

// ── Merged timeline (all entities, sorted by time desc) ───────────────────────
const mergedTimeline = computed(() => {
  const all = [
    ...dealTimeline.value.map(e => ({ ...e, _entity: 'deal' })),
    ...projectTimeline.value.map(e => ({ ...e, _entity: 'project' })),
    ...sessionTimeline.value.map(e => ({ ...e, _entity: 'session' })),
  ]
  // Добавляем human-readable summary
  return all
    .map(e => ({ ...e, summary: buildSummary(e) }))
    .sort((a, b) => b.ts - a.ts)
})

// ── Pipeline stages ───────────────────────────────────────────────────────────
const allEventTypes = computed(() => new Set(mergedTimeline.value.map(e => e.type)))

const lastFactorEvent = computed(() =>
  mergedTimeline.value.find(e => e.type === 'FACTOR_SCORED')
)
const lastDecision = computed(() =>
  mergedTimeline.value.find(e => e.type === 'DECISION_MADE')
)
const hasDealClosed = computed(() => allEventTypes.value.has('DEAL_CLOSED') || allEventTypes.value.has('TERM_SHEET_PROPOSED'))

const pipelineStages = computed(() => {
  const F = allEventTypes.value
  return [
    {
      id: 'apply', label: 'Заявка', icon: 'pi pi-file',
      status: F.has('DEAL_SOURCED') ? 'done' : 'pending',
      to: '/fst-dealflow',
    },
    {
      id: 'dd', label: 'Due Dil', icon: 'pi pi-search',
      status: F.has('DD_COMPLETED') ? 'done' : F.has('DEAL_SOURCED') ? 'active' : 'pending',
      to: '/fst-duediligence',
    },
    {
      id: 'factor', label: 'Факторы', icon: 'pi pi-chart-bar',
      status: lastFactorEvent.value ? 'done' : 'pending',
      badge: lastFactorEvent.value ? lastFactorEvent.value.data?.grade : null,
      to: '/fst-factor',
    },
    {
      id: 'committee', label: 'ИК', icon: 'pi pi-users',
      status: lastDecision.value ? 'done' : 'pending',
      badge: lastDecision.value ? lastDecision.value.data?.verdict?.slice(0, 7) : null,
      to: '/fst-committee',
    },
    {
      id: 'deal', label: 'Сделка', icon: 'pi pi-handshake',
      status: F.has('DEAL_CLOSED') ? 'done' : hasDealClosed.value ? 'active' : 'pending',
      to: '/fst-deal',
    },
    {
      id: 'portfolio', label: 'Портфель', icon: 'pi pi-briefcase',
      status: F.has('KPI_UPDATED') ? 'done' : F.has('DEAL_CLOSED') ? 'active' : 'pending',
      to: '/fst-portfolio',
    },
  ]
})

// ── AI-бриф ───────────────────────────────────────────────────────────────────
async function generateBrief() {
  if (!project.value) return
  briefLoading.value = true
  brief.value = null
  try {
    const p = project.value
    const timeline = mergedTimeline.value
    const events = timeline.slice(0, 15).map(e => `${formatTime(e.ts)} — ${eventLabel(e)}${e.summary ? ': ' + e.summary : ''}`).join('\n')
    const factor = lastFactorEvent.value?.data
    const decision = lastDecision.value?.data

    const prompt = `Ты — аналитик венчурного фонда ФСТ НТИ. Напиши краткий бриф (4-6 предложений) по проекту.

ПРОЕКТ: ${p.name}
Субфонд: ${p.subfund} | TRL: ${p.trl} | Суверенность: ${p.sovereignty}/9
Стадия: ${p.stage || '—'} | Запрос: ${p.askMln || 0} млн ₽

${factor ? `ФАКТОРНАЯ ОЦЕНКА: Grade ${factor.grade}, Composite ${factor.composite?.toFixed(1)}/10
Красные флаги: ${factor.redFlags?.join(', ') || 'нет'}
Сильные стороны: ${factor.strengths?.join(', ') || 'нет'}` : ''}

${decision ? `РЕШЕНИЕ ИК: ${decision.verdict} (score ${decision.score?.toFixed(1)}/10)
Условия: ${decision.conditions?.join('; ') || 'нет'}` : ''}

ПОСЛЕДНИЕ СОБЫТИЯ:
${events || 'событий пока нет'}

Напиши: где сейчас проект, что уже сделано, ключевые риски, рекомендуемый следующий шаг. Не используй заголовки. Только текст.`

    const res = await fetch('/api/ai-tokens/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        modelId: 'deepseek/deepseek-chat',
        prompt,
        systemPrompt: 'Ты — аналитик венчурного фонда. Пиши кратко, по делу, на русском языке.',
        application: 'FstProject',
      }),
    })
    if (res.ok) {
      const data = await res.json()
      brief.value = data.response || data.text || ''
    }
  } catch (e) {
    brief.value = 'Не удалось сгенерировать бриф: ' + e.message
  } finally {
    briefLoading.value = false
  }
}

// ── Navigation ────────────────────────────────────────────────────────────────
function goTo(page) {
  if (project.value) projStore.setActive({ ...project.value, _source: 'project-hub' })
  router.push('/fst-' + page)
}
function goToPage(path) { router.push(path) }

// ── Helpers ───────────────────────────────────────────────────────────────────
const EVENT_LABELS = {
  DEAL_SOURCED:          'Заявка получена',
  FACTOR_SCORED:         'Факторная оценка',
  VOTE_CAST:             'Голос эксперта',
  DECISION_MADE:         'Решение ИК',
  TERM_SHEET_PROPOSED:   'Term Sheet предложен',
  DD_COMPLETED:          'Due Diligence завершён',
  DEAL_CLOSED:           'Сделка закрыта',
  TRANCHE_RELEASED:      'Транш выплачен',
  KPI_UPDATED:           'KPI обновлены',
  PROJECT_STARTED:       'Проект запущен',
  TRL_ADVANCED:          'TRL повышен',
  MEASURE_FUNDED:        'Мера профинансирована',
}

function eventLabel(evt) {
  return EVENT_LABELS[evt.type] || evt.type
}

function buildSummary(evt) {
  const d = evt.data || {}
  if (evt.type === 'FACTOR_SCORED')       return `Grade ${d.grade}, composite ${d.composite?.toFixed(1)}`
  if (evt.type === 'VOTE_CAST')           return `${d.agentId || d.agent}: ${d.verdict}`
  if (evt.type === 'DECISION_MADE')       return `${d.verdict}${d.score ? ' · ' + d.score?.toFixed(1) + '/10' : ''}`
  if (evt.type === 'TERM_SHEET_PROPOSED') return `${d.amount} млн ₽, ${d.conditions?.length || 0} условий`
  if (evt.type === 'DEAL_SOURCED')        return d.company || ''
  if (evt.type === 'TRANCHE_RELEASED')    return `${d.amount} млн ₽`
  if (evt.type === 'TRL_ADVANCED')        return `TRL ${d.from} → ${d.to}`
  return ''
}

const EVENT_COLORS = {
  FACTOR_SCORED:       'var(--fst-purple)',
  DECISION_MADE:       'var(--fst-green)',
  VOTE_CAST:           'var(--fst-blue)',
  TERM_SHEET_PROPOSED: 'var(--fst-cyan)',
  DEAL_SOURCED:        'var(--p-text-muted-color)',
  DEAL_CLOSED:         'var(--fst-green)',
  TRANCHE_RELEASED:    'var(--fst-brand)',
  KPI_UPDATED:         'var(--fst-blue)',
  TRL_ADVANCED:        'var(--fst-green)',
}

function eventColor(type) {
  return EVENT_COLORS[type] || 'var(--p-text-muted-color)'
}

function eventSeverity(type) {
  if (['DECISION_MADE', 'DEAL_CLOSED', 'TRL_ADVANCED'].includes(type)) return 'success'
  if (['FACTOR_SCORED', 'VOTE_CAST', 'TERM_SHEET_PROPOSED'].includes(type)) return 'info'
  return 'neutral'
}

function formatTime(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' }) +
    ' ' + d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
}

function trlColor(v) { return v >= 7 ? 'var(--fst-green)' : v >= 5 ? 'var(--fst-brand)' : 'var(--fst-red)' }
function sovColor(v) { return v >= 7 ? 'var(--fst-green)' : v >= 5 ? 'var(--fst-brand)' : 'var(--fst-red)' }
function scoreColor(s) {
  if (s == null) return 'var(--p-text-muted-color)'
  return s >= 7 ? 'var(--fst-green)' : s >= 4 ? 'var(--fst-brand)' : 'var(--fst-red)'
}
const GRADE_COLORS = { 'A+': 'var(--fst-green)', A: 'var(--fst-green)', 'B+': 'var(--fst-brand)', B: 'var(--fst-brand)', 'C+': 'var(--fst-red)', C: 'var(--fst-red)', D: 'var(--fst-red)' }
function gradeColor(g) { return GRADE_COLORS[g] || 'var(--p-text-muted-color)' }

function decisionClass(v) {
  if (v === 'APPROVE') return 'green'
  if (v === 'CONDITIONAL') return 'brand'
  return 'red'
}
function decisionIcon(v) {
  if (v === 'APPROVE')     return 'pi pi-check-circle'
  if (v === 'CONDITIONAL') return 'pi pi-info-circle'
  return 'pi pi-times-circle'
}
</script>

<style scoped>
/* ─── AI-бриф ─── */
.fp-brief {
  background: color-mix(in srgb, var(--fst-purple) 8%, transparent);
  border: 1px solid color-mix(in srgb, var(--fst-purple) 30%, transparent);
  border-radius: 10px; padding: 14px 16px; margin-bottom: 16px;
}
.fp-brief-header {
  display: flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 700;
  color: var(--fst-purple); margin-bottom: 8px;
}
.fp-brief-close {
  margin-left: auto; background: none; border: none; cursor: pointer;
  color: var(--p-text-muted-color); font-size: 16px; line-height: 1; padding: 0 4px;
}
.fp-brief-text { font-size: 13px; color: var(--p-text-color); line-height: 1.6; }

/* ─── Pipeline strip ─── */
.fp-pipeline { margin: -20px -20px 0; display: flex; align-items: stretch; overflow-x: auto; }
.fp-pipeline-stage { display: flex; align-items: center; flex: 1; min-width: 80px; transition: background .2s; }
.fp-pipeline-stage:hover { background: color-mix(in srgb, var(--p-text-color) 5%, transparent); }
.fp-stage-arrow { font-size: 20px; color: var(--p-text-muted-color); padding: 0 4px; opacity: 0.4; flex-shrink: 0; }
.fp-stage-content { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 14px 8px; flex: 1; }
.fp-stage-icon { font-size: 16px; opacity: 0.6; }
.fp-stage-label { font-size: 11px; font-weight: 600; color: var(--p-text-muted-color); white-space: nowrap; }
.fp-stage-status { display: flex; align-items: center; gap: 4px; }
.fp-stage-badge { font-size: 10px; background: color-mix(in srgb, var(--fst-brand) 20%, transparent); color: var(--fst-brand); padding: 1px 5px; border-radius: 4px; }

.fp-stage--done .fp-stage-icon  { opacity: 1; color: var(--fst-green); }
.fp-stage--done .fp-stage-label { color: var(--p-text-color); }
.fp-stage--active .fp-stage-icon  { opacity: 1; color: var(--fst-brand); }
.fp-stage--active .fp-stage-label { color: var(--fst-brand); }

/* ─── Body layout ─── */
.fp-body { display: grid; grid-template-columns: 1fr 320px; gap: 16px; padding: 16px 0 0; }
@media (max-width: 900px) { .fp-body { grid-template-columns: 1fr; } }

/* ─── Timeline ─── */
.fp-loading, .fp-empty { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 40px; color: var(--p-text-muted-color); font-size: 13px; }
.fp-events { display: flex; flex-direction: column; gap: 0; }
.fp-event { display: flex; gap: 12px; padding: 10px 0; border-bottom: 1px solid var(--p-content-border-color); }
.fp-event:last-child { border-bottom: none; }
.fp-event-dot { width: 8px; height: 8px; border-radius: 50%; margin-top: 5px; flex-shrink: 0; }
.fp-event-body { flex: 1; min-width: 0; }
.fp-event-header { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
.fp-event-type { font-size: 13px; font-weight: 600; color: var(--p-text-color); }
.fp-event-time { font-size: 11px; color: var(--p-text-muted-color); white-space: nowrap; }
.fp-event-detail { font-size: 12px; color: var(--p-text-muted-color); margin-top: 2px; }

/* ─── Detail panel ─── */
.fp-detail-col { display: flex; flex-direction: column; gap: 12px; }
.fp-detail-panel { background: var(--p-surface-card); border: 1px solid var(--p-content-border-color); border-radius: 10px; padding: 14px; }
.fp-detail-row { display: flex; justify-content: space-between; align-items: center; font-size: 13px; padding: 6px 0; border-bottom: 1px dashed var(--p-content-border-color); }
.fp-detail-row:last-child { border-bottom: none; }
.fp-detail-row span { color: var(--p-text-muted-color); }
.fp-detail-desc { font-size: 12px; color: var(--p-text-muted-color); margin-top: 8px; line-height: 1.5; }

/* Factor panel */
.fp-factor-grade { display: flex; align-items: baseline; gap: 10px; margin-bottom: 12px; }
.fp-grade-val { font-size: 28px; font-weight: 800; }
.fp-composite { font-size: 13px; color: var(--p-text-muted-color); }
.fp-factor-bars { display: flex; flex-direction: column; gap: 6px; }
.fp-factor-row { display: flex; align-items: center; gap: 8px; }
.fp-fkey { font-size: 12px; font-weight: 700; width: 14px; color: var(--p-text-muted-color); }
.fp-fbar { flex: 1; height: 6px; background: var(--p-surface-card); border-radius: 3px; overflow: hidden; }
.fp-fbar-fill { height: 100%; border-radius: 3px; transition: width .4s; }
.fp-fscore { font-size: 11px; font-weight: 600; width: 24px; text-align: right; }

/* Decision */
.fp-decision { display: flex; align-items: center; gap: 8px; padding: 10px 12px; border-radius: 8px; font-size: 13px; font-weight: 700; }
.fp-decision--green { background: color-mix(in srgb, var(--fst-green) 15%, transparent); color: var(--fst-green); }
.fp-decision--brand { background: color-mix(in srgb, var(--fst-brand) 15%, transparent); color: var(--fst-brand); }
.fp-decision--red   { background: color-mix(in srgb, var(--fst-red) 15%, transparent); color: var(--fst-red); }
.fp-conditions { margin-top: 8px; }
.fp-condition { font-size: 12px; color: var(--p-text-muted-color); padding: 3px 0; }

/* Actions */
.fp-actions { display: flex; flex-direction: column; gap: 8px; }

/* Project list */
.fp-list { padding: 0; }
.fp-list-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 10px; }
.fp-list-card {
  background: var(--p-surface-card); border: 1px solid var(--p-content-border-color);
  border-radius: 10px; padding: 12px 14px; cursor: pointer;
  transition: transform .15s, box-shadow .15s;
}
.fp-list-card:hover { transform: translateY(-2px); box-shadow: 0 4px 12px color-mix(in srgb, var(--p-text-color) 12%, transparent); }
.fp-lc-top { display: flex; justify-content: space-between; align-items: center; gap: 8px; margin-bottom: 6px; }
.fp-lc-name { font-size: 13px; font-weight: 700; color: var(--p-text-color); }
.fp-lc-subfund { font-size: 10px; color: white; padding: 2px 7px; border-radius: 4px; }
.fp-lc-meta { font-size: 11px; color: var(--p-text-muted-color); margin-bottom: 6px; }
.fp-lc-stage { display: flex; align-items: center; gap: 6px; font-size: 11px; color: var(--p-text-muted-color); }
.fp-lc-stage-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
</style>
