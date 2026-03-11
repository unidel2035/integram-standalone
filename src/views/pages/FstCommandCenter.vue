<script setup>
/**
 * FstCommandCenter — единый экран состояния платформы
 *
 * Не ещё одна страница. Это ЗАМЕНА навигации.
 * Всё что нужно знать директору фонда — здесь, в одном экране.
 * Управляется исключительно eventStore + онтологией.
 *
 * Архитектура: Platform State = projection(all timelines) + ontology
 */
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useEventStore } from '@/stores/eventStore.js'
import { useToast } from 'primevue/usetoast'
import { getPlatformState, getAIPlatformBriefing, ENTITY_LENSES } from '@/services/platformStateService.js'
import { buildPipelineStages, getPipelineSummary, SUBPROCESS_DEFS } from '@/services/pipelineService.js'
import { getEventDef } from '@/config/eventRegistry.js'

const router    = useRouter()
const evtStore  = useEventStore()
const toast     = useToast()

// ─── Состояние ────────────────────────────────────────────────────────────────

const platformState = ref(null)
const aiBriefing    = ref('')
const aiLoading     = ref(false)
const activeFilter  = ref('all')  // all | deal | company | session | fund | alerts
const refreshTick   = ref(0)

// ─── Фильтры ─────────────────────────────────────────────────────────────────

const filters = [
  { id: 'all',     label: 'Всё',      icon: 'pi pi-th-large' },
  { id: 'alert',   label: 'Алерты',   icon: 'pi pi-bell' },
  { id: 'deal',    label: 'Сделки',   icon: 'pi pi-file-edit' },
  { id: 'session', label: 'ИК',       icon: 'pi pi-users' },
  { id: 'company', label: 'Портфель', icon: 'pi pi-building' },
  { id: 'fund',    label: 'Фонд',     icon: 'pi pi-wallet' },
]

// ─── Вычисление состояния ────────────────────────────────────────────────────

function refresh() {
  platformState.value = getPlatformState(evtStore)
}

const visibleEntities = computed(() => {
  if (!platformState.value) return []
  const all = platformState.value.entities
  if (activeFilter.value === 'all')   return all
  if (activeFilter.value === 'alert') return all.filter(e => e.alerts.length > 0)
  return all.filter(e => e.entityType === activeFilter.value)
})

// ─── Группировка: сущности по фазам конвейера для deal ───────────────────────

const pipelineOverview = computed(() => {
  if (!platformState.value) return []
  const deals = platformState.value.entities.filter(e => e.entityType === 'deal')
  return SUBPROCESS_DEFS.map(def => {
    const dealsInStage = deals.filter(d => d.pipelineStage?.id === def.id)
    return { ...def, deals: dealsInStage }
  }).filter(s => s.deals.length > 0)
})

// ─── Загрузка ─────────────────────────────────────────────────────────────────

let pollInterval = null

onMounted(async () => {
  // Загружаем демо-ленты если пусто
  await Promise.all([
    evtStore.load('deal', 'ventureos-001'),
    evtStore.load('deal', 'agrobot-002'),
    evtStore.load('session', 'ventureos-001'),
    evtStore.load('company', '_all'),
    evtStore.load('fund', '_all'),
  ])

  // Seeding demo если пусто
  seedDemoData()

  refresh()

  // Авторефреш каждые 10с (подхватывает новые события)
  pollInterval = setInterval(() => { refresh(); refreshTick.value++ }, 10000)
})

onUnmounted(() => { if (pollInterval) clearInterval(pollInterval) })

// ─── Demo seeding ─────────────────────────────────────────────────────────────

function seedDemoData() {
  const t1 = evtStore.getTimeline('deal', 'ventureos-001')
  if (!t1.length) {
    const now = Date.now(); const d = 24*60*60*1000
    const seed = (id, type, ts, data={}) => {
      const def = getEventDef(type)
      t1.push({ id:`seed_${type}_${Math.random().toString(36).slice(2,6)}`, entityType:'deal', entityId:id, type, label:def?.label||type, icon:def?.icon, color:def?.color, data, meta:{seeded:true}, ts })
    }
    seed('ventureos-001','PI_REGISTERED',       now-40*d,{actor:'УТ'})
    seed('ventureos-001','PI_COMPLIANCE_CHECK', now-38*d,{actor:'УТ'})
    seed('ventureos-001','PI_ACCEPTED',         now-36*d,{actor:'УТ'})
    seed('ventureos-001','RP_ASSIGNED',         now-35*d,{actor:'УТ'})
    seed('ventureos-001','NDA_SIGNED',          now-33*d,{actor:'РП'})
    seed('ventureos-001','PRELIM_ANALYSIS_STARTED',now-32*d,{actor:'РП'})
    seed('ventureos-001','OUS_FORMED',          now-20*d,{actor:'РП'})
    seed('ventureos-001','PRELIM_ANALYSIS_DONE',now-18*d,{actor:'УТ'})
    seed('ventureos-001','OUS_SIGNED',          now-15*d,{actor:'УТ'})
    seed('ventureos-001','IC1_CONVENED',        now-7*d, {actor:'УТ'})
  }

  const t2 = evtStore.getTimeline('deal', 'agrobot-002')
  if (!t2.length) {
    const now = Date.now(); const d = 24*60*60*1000
    const seed = (type, ts, data={}) => {
      const def = getEventDef(type)
      t2.push({ id:`seed_${type}_${Math.random().toString(36).slice(2,6)}`, entityType:'deal', entityId:'agrobot-002', type, label:def?.label||type, icon:def?.icon, color:def?.color, data, meta:{seeded:true}, ts })
    }
    seed('PI_REGISTERED', now-3*d, {actor:'УТ', notes:'Заявка АгроБот получена'})
  }

  const tc = evtStore.getTimeline('company', 'ventureos-co')
  if (!tc.length) {
    const now = Date.now(); const d = 24*60*60*1000
    const def = getEventDef('COMPANY_ADDED')
    tc.push({ id:'seed_co_add', entityType:'company', entityId:'ventureos-co', type:'COMPANY_ADDED', label:def?.label||'COMPANY_ADDED', icon:def?.icon, color:def?.color, data:{name:'VentureOS SaaS', arr:48, trl:7}, meta:{seeded:true}, ts:now-30*d })
    const def2 = getEventDef('KPI_UPDATED')
    tc.push({ id:'seed_co_kpi', entityType:'company', entityId:'ventureos-co', type:'KPI_UPDATED', label:def2?.label||'KPI_UPDATED', icon:def2?.icon, color:def2?.color, data:{mrr:4.2, growth:18}, meta:{seeded:true}, ts:now-2*d })
  }
}

// ─── AI брифинг ──────────────────────────────────────────────────────────────

async function loadAIBriefing() {
  if (!platformState.value || aiLoading.value) return
  aiLoading.value = true
  try {
    aiBriefing.value = await getAIPlatformBriefing(platformState.value)
  } catch {
    aiBriefing.value = 'Ошибка AI. Проверьте подключение.'
  } finally {
    aiLoading.value = false
  }
}

// ─── Навигация ────────────────────────────────────────────────────────────────

function navigateTo(card) {
  const lens = ENTITY_LENSES[card.entityType]
  if (lens) router.push(lens.path)
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function severityClass(severity) {
  return { error: 'cc-alert--error', warn: 'cc-alert--warn', info: 'cc-alert--info' }[severity] || ''
}

function phaseLabel(card) {
  if (card.entityType === 'deal' && card.pipelineStage) return `${card.pipelineStage.label}: ${card.pipelineStage.name}`
  if (card.entityType === 'session') return card.state?.phase === 'closed' ? 'Завершено' : 'В работе'
  if (card.entityType === 'company') return card.state?.risk === 'high' ? 'Высокий риск' : 'Норма'
  return card.state?.phase || '—'
}

function entityIdLabel(card) {
  if (card.entityType === 'company') return card.state?.name || card.entityId
  return card.entityId
}

function fmtDate(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  const now = new Date()
  const diff = Math.floor((now - d) / (24*60*60*1000))
  if (diff === 0) return 'сегодня'
  if (diff === 1) return 'вчера'
  if (diff < 7) return `${diff} дн. назад`
  return d.toLocaleDateString('ru-RU', { day:'2-digit', month:'short' })
}
</script>

<template>
  <div class="cc-root">

    <!-- ══ TOPBAR ══════════════════════════════════════════════════════════════ -->
    <div class="cc-topbar">
      <div class="cc-topbar-left">
        <i class="pi pi-sitemap cc-logo-icon"></i>
        <span class="cc-logo-title">Command Center</span>
        <span class="cc-logo-sub">Онтология событий · Live State</span>
      </div>

      <!-- Сводка по алертам -->
      <div v-if="platformState" class="cc-topbar-alerts">
        <div v-if="platformState.summary.criticalCount" class="cc-alert-chip cc-alert-chip--error">
          <i class="pi pi-times-circle"></i> {{ platformState.summary.criticalCount }} критично
        </div>
        <div v-if="platformState.summary.warnCount" class="cc-alert-chip cc-alert-chip--warn">
          <i class="pi pi-exclamation-triangle"></i> {{ platformState.summary.warnCount }} предупреждений
        </div>
        <div v-if="!platformState.summary.criticalCount && !platformState.summary.warnCount" class="cc-alert-chip cc-alert-chip--ok">
          <i class="pi pi-check-circle"></i> Всё в норме
        </div>
      </div>

      <div class="cc-topbar-right">
        <Button
          :loading="aiLoading"
          label="AI Брифинг"
          icon="pi pi-sparkles"
          size="small"
          :severity="aiBriefing ? 'secondary' : 'primary'"
          @click="loadAIBriefing"
        />
        <Button icon="pi pi-refresh" severity="secondary" size="small" text @click="refresh" />
      </div>
    </div>

    <!-- ══ AI БРИФИНГ ════════════════════════════════════════════════════════ -->
    <Transition name="cc-slide">
      <div v-if="aiBriefing" class="cc-briefing">
        <i class="pi pi-sparkles cc-briefing-icon"></i>
        <div class="cc-briefing-text">{{ aiBriefing }}</div>
        <Button icon="pi pi-times" severity="secondary" size="small" text @click="aiBriefing=''" />
      </div>
    </Transition>

    <!-- ══ МЕТРИКИ ══════════════════════════════════════════════════════════ -->
    <div v-if="platformState" class="cc-metrics">
      <div class="cc-metric">
        <div class="cc-metric-val">{{ platformState.summary.dealsInWork }}</div>
        <div class="cc-metric-label">Сделок в работе</div>
      </div>
      <div class="cc-metric-div"></div>
      <div class="cc-metric">
        <div class="cc-metric-val">{{ platformState.summary.pendingIC }}</div>
        <div class="cc-metric-label">ИК ожидают</div>
      </div>
      <div class="cc-metric-div"></div>
      <div class="cc-metric">
        <div class="cc-metric-val">{{ platformState.summary.companiesActive }}</div>
        <div class="cc-metric-label">В портфеле</div>
      </div>
      <div class="cc-metric-div"></div>
      <div class="cc-metric">
        <div class="cc-metric-val" :style="{ color: platformState.summary.staleCount > 0 ? 'var(--fst-brand)' : 'var(--fst-green)' }">
          {{ platformState.summary.staleCount }}
        </div>
        <div class="cc-metric-label">Застряли (14+ дн.)</div>
      </div>
      <div class="cc-metric-div"></div>
      <div class="cc-metric">
        <div class="cc-metric-val">{{ platformState.summary.totalEntities }}</div>
        <div class="cc-metric-label">Активных сущностей</div>
      </div>
    </div>

    <!-- ══ ВОРОНКА КОНВЕЙЕРА (только deal) ══════════════════════════════════ -->
    <div v-if="pipelineOverview.length" class="cc-pipeline-overview">
      <div class="cc-section-label">Конвейер сделок ПП-1→ПП-6</div>
      <div class="cc-pipeline-track">
        <div
          v-for="(sub, i) in pipelineOverview"
          :key="sub.id"
          class="cc-pipeline-node"
          :style="{ borderColor: sub.color }"
        >
          <div class="cc-pipeline-node-label" :style="{ color: sub.color }">{{ sub.label }}</div>
          <div class="cc-pipeline-node-name">{{ sub.name }}</div>
          <div v-for="deal in sub.deals" :key="deal.entityId" class="cc-pipeline-deal">
            <i class="pi pi-circle-fill" style="font-size:6px; color:var(--fst-brand)"></i>
            {{ deal.entityId }}
          </div>
          <div v-if="i < pipelineOverview.length - 1" class="cc-pipeline-arrow">→</div>
        </div>
      </div>
    </div>

    <!-- ══ ФИЛЬТРЫ ══════════════════════════════════════════════════════════ -->
    <div class="cc-filters">
      <button
        v-for="f in filters"
        :key="f.id"
        class="cc-filter-btn"
        :class="{ 'cc-filter-btn--active': activeFilter === f.id }"
        @click="activeFilter = f.id"
      >
        <i :class="f.icon"></i>
        {{ f.label }}
        <span v-if="f.id !== 'all'" class="cc-filter-count">
          {{
            f.id === 'alert'
              ? platformState?.entities.filter(e=>e.alerts.length).length
              : platformState?.entities.filter(e=>e.entityType===f.id).length
          }}
        </span>
      </button>
    </div>

    <!-- ══ КАРТОЧКИ СУЩНОСТЕЙ ══════════════════════════════════════════════ -->
    <div class="cc-cards">
      <div
        v-for="card in visibleEntities"
        :key="`${card.entityType}:${card.entityId}`"
        class="cc-card"
        :class="{ 'cc-card--urgent': card.urgency >= 80, 'cc-card--warn': card.urgency >= 40 && card.urgency < 80 }"
        @click="navigateTo(card)"
      >
        <!-- Шапка карточки -->
        <div class="cc-card-header">
          <div class="cc-card-type" :style="{ color: card.lens.color }">
            <i :class="card.lens.icon"></i>
            {{ card.lens.label }}
          </div>
          <div class="cc-card-id">{{ entityIdLabel(card) }}</div>
          <div class="cc-card-urgency" v-if="card.urgency >= 40"
            :style="{ color: card.urgency >= 80 ? 'var(--fst-red)' : 'var(--fst-brand)' }">
            <i :class="card.urgency >= 80 ? 'pi pi-times-circle' : 'pi pi-exclamation-triangle'"></i>
          </div>
        </div>

        <!-- Фаза / состояние -->
        <div class="cc-card-phase">{{ phaseLabel(card) }}</div>

        <!-- Последнее событие -->
        <div class="cc-card-last-event">
          <i :class="card.lastEvt?.icon || 'pi pi-circle'" style="font-size:11px; opacity:0.6"></i>
          <span>{{ card.lastEvt?.label }}</span>
          <span class="cc-card-date">{{ fmtDate(card.lastEvt?.ts) }}</span>
        </div>

        <!-- Алерты -->
        <div v-if="card.alerts.length" class="cc-card-alerts">
          <div
            v-for="(a, i) in card.alerts.slice(0,2)"
            :key="i"
            class="cc-card-alert"
            :class="severityClass(a.severity)"
          >
            <i :class="a.severity === 'error' ? 'pi pi-times-circle' : 'pi pi-exclamation-triangle'"></i>
            {{ a.message }}
          </div>
        </div>

        <!-- Следующие действия (для deal) -->
        <div v-if="card.nextActions.length" class="cc-card-next">
          <div class="cc-card-next-label">Следующий шаг:</div>
          <div v-for="action in card.nextActions.slice(0,1)" :key="action.type" class="cc-card-next-action">
            <i :class="action.icon || 'pi pi-arrow-right'" :style="{ color: action.color }" style="font-size:11px"></i>
            {{ action.label }}
          </div>
        </div>

        <!-- Статистика -->
        <div class="cc-card-footer">
          <span class="cc-card-stat"><i class="pi pi-list"></i> {{ card.eventsCount }} событий</span>
          <span class="cc-card-stat"><i class="pi pi-calendar"></i> {{ card.totalDays }} дн.</span>
          <Button
            label="Открыть"
            severity="secondary"
            size="small"
            text
            class="cc-card-btn"
            @click.stop="navigateTo(card)"
          />
        </div>
      </div>

      <!-- Пустое состояние -->
      <div v-if="!visibleEntities.length" class="cc-empty">
        <i class="pi pi-inbox" style="font-size:32px; opacity:0.3"></i>
        <span>Нет сущностей в этой категории</span>
        <span style="font-size:11px; color:var(--p-text-muted-color)">
          Данные появятся после регистрации первых событий
        </span>
      </div>
    </div>

    <!-- ══ КРОСС-СУЩНОСТНЫЙ ГРАФ ══════════════════════════════════════════ -->
    <div v-if="platformState?.crossLinks.length" class="cc-cross-section">
      <div class="cc-section-label">Активные цепочки онтологии</div>
      <div class="cc-cross-links">
        <div
          v-for="link in platformState.crossLinks.slice(0,8)"
          :key="link.id"
          class="cc-cross-link"
          :class="{ 'cc-cross-link--done': link.enablesDone }"
        >
          <div class="cc-cross-from">
            <i :class="ENTITY_LENSES[link.trigger.entityType]?.icon" style="font-size:11px"></i>
            <code>{{ link.trigger.eventType }}</code>
          </div>
          <div class="cc-cross-arrow">
            <i :class="link.enablesDone ? 'pi pi-check' : 'pi pi-arrow-right'"
              :style="{ color: link.enablesDone ? 'var(--fst-green)' : 'var(--fst-brand)' }"></i>
          </div>
          <div class="cc-cross-to">
            <i :class="ENTITY_LENSES[link.enables.entityType]?.icon" style="font-size:11px"></i>
            <code>{{ link.enables.eventType }}</code>
          </div>
          <div class="cc-cross-label">{{ link.label }}</div>
        </div>
      </div>
    </div>

  </div>
</template>

<style scoped>
/* ═══ КОРЕНЬ ═══════════════════════════════════════════════════════════════ */
.cc-root {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background: var(--p-surface-ground);
  padding: 6rem 0 0;  /* topbar offset */
}

/* ═══ TOPBAR ════════════════════════════════════════════════════════════════ */
.cc-topbar {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px 24px;
  background: var(--p-surface-card);
  border-bottom: 1px solid var(--p-content-border-color);
  position: sticky;
  top: 4rem;
  z-index: 10;
}

.cc-topbar-left {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
}

.cc-logo-icon {
  font-size: 20px;
  color: var(--p-primary-color);
}

.cc-logo-title {
  font-size: 16px;
  font-weight: 700;
}

.cc-logo-sub {
  font-size: 11px;
  color: var(--p-text-muted-color);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.cc-topbar-alerts {
  display: flex;
  gap: 8px;
}

.cc-alert-chip {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  padding: 4px 10px;
  border-radius: 20px;
  font-weight: 600;
}
.cc-alert-chip--error { background: color-mix(in srgb, var(--fst-red) 15%, transparent); color: var(--fst-red); }
.cc-alert-chip--warn  { background: color-mix(in srgb, var(--fst-brand) 15%, transparent); color: var(--fst-brand); }
.cc-alert-chip--ok    { background: color-mix(in srgb, var(--fst-green) 15%, transparent); color: var(--fst-green); }

.cc-topbar-right {
  display: flex;
  gap: 8px;
}

/* ═══ AI БРИФИНГ ════════════════════════════════════════════════════════════ */
.cc-briefing {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 14px 24px;
  background: color-mix(in srgb, var(--p-primary-color) 8%, transparent);
  border-bottom: 1px solid var(--p-content-border-color);
  font-size: 13px;
  line-height: 1.5;
}

.cc-briefing-icon {
  font-size: 18px;
  color: var(--p-primary-color);
  flex-shrink: 0;
  margin-top: 1px;
}

.cc-briefing-text {
  flex: 1;
}

.cc-slide-enter-active, .cc-slide-leave-active { transition: all 0.25s ease; }
.cc-slide-enter-from, .cc-slide-leave-to { opacity: 0; transform: translateY(-8px); }

/* ═══ МЕТРИКИ ═══════════════════════════════════════════════════════════════ */
.cc-metrics {
  display: flex;
  align-items: center;
  padding: 16px 24px;
  background: var(--p-surface-card);
  border-bottom: 1px solid var(--p-content-border-color);
  gap: 0;
}

.cc-metric {
  flex: 1;
  text-align: center;
}

.cc-metric-val {
  font-size: 28px;
  font-weight: 700;
  line-height: 1;
}

.cc-metric-label {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--p-text-muted-color);
  margin-top: 4px;
}

.cc-metric-div {
  width: 1px;
  height: 40px;
  background: var(--p-content-border-color);
}

/* ═══ ВОРОНКА ═══════════════════════════════════════════════════════════════ */
.cc-pipeline-overview {
  padding: 16px 24px;
  border-bottom: 1px solid var(--p-content-border-color);
  background: var(--p-surface-card);
}

.cc-section-label {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--p-text-muted-color);
  font-weight: 700;
  margin-bottom: 12px;
}

.cc-pipeline-track {
  display: flex;
  align-items: flex-start;
  gap: 0;
  overflow-x: auto;
  position: relative;
}

.cc-pipeline-node {
  display: flex;
  flex-direction: column;
  padding: 8px 16px;
  border-left: 3px solid var(--p-content-border-color);
  min-width: 150px;
  position: relative;
}

.cc-pipeline-node-label {
  font-size: 12px;
  font-weight: 700;
}

.cc-pipeline-node-name {
  font-size: 10px;
  color: var(--p-text-muted-color);
  margin-bottom: 6px;
}

.cc-pipeline-deal {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  background: var(--p-surface-ground);
  border-radius: 4px;
  padding: 2px 6px;
  margin-bottom: 2px;
}

.cc-pipeline-arrow {
  position: absolute;
  right: -8px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 16px;
  color: var(--p-text-muted-color);
  z-index: 1;
}

/* ═══ ФИЛЬТРЫ ═══════════════════════════════════════════════════════════════ */
.cc-filters {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 12px 24px;
  border-bottom: 1px solid var(--p-content-border-color);
  background: var(--p-surface-card);
  overflow-x: auto;
}

.cc-filter-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border: 1px solid var(--p-content-border-color);
  border-radius: 20px;
  background: transparent;
  color: var(--p-text-muted-color);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
}

.cc-filter-btn:hover {
  border-color: var(--p-primary-color);
  color: var(--p-text-color);
}

.cc-filter-btn--active {
  background: var(--p-primary-color);
  border-color: var(--p-primary-color);
  color: #fff;
}

.cc-filter-count {
  font-size: 11px;
  background: rgba(255,255,255,0.2);
  border-radius: 10px;
  padding: 0 5px;
  min-width: 18px;
  text-align: center;
}

/* ═══ КАРТОЧКИ ═══════════════════════════════════════════════════════════════ */
.cc-cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 12px;
  padding: 16px 24px;
}

.cc-card {
  background: var(--p-surface-card);
  border: 1px solid var(--p-content-border-color);
  border-radius: 12px;
  padding: 14px 16px;
  cursor: pointer;
  transition: box-shadow 0.15s, border-color 0.15s;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.cc-card:hover {
  box-shadow: 0 4px 16px rgba(0,0,0,0.1);
  border-color: var(--p-primary-color);
}

.cc-card--urgent {
  border-color: var(--fst-red);
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--fst-red) 30%, transparent);
}

.cc-card--warn {
  border-color: var(--fst-brand);
}

.cc-card-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.cc-card-type {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.cc-card-id {
  flex: 1;
  font-size: 13px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cc-card-phase {
  font-size: 12px;
  color: var(--p-text-muted-color);
  background: var(--p-surface-ground);
  border-radius: 6px;
  padding: 3px 8px;
  display: inline-flex;
  align-self: flex-start;
}

.cc-card-last-event {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  min-width: 0;
}

.cc-card-last-event > span:first-of-type {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cc-card-date {
  font-size: 10px;
  color: var(--p-text-muted-color);
  flex-shrink: 0;
}

.cc-card-alerts {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.cc-card-alert {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  padding: 3px 8px;
  border-radius: 5px;
}
.cc-alert--error { background: color-mix(in srgb, var(--fst-red) 12%, transparent); color: var(--fst-red); }
.cc-alert--warn  { background: color-mix(in srgb, var(--fst-brand) 12%, transparent); color: var(--fst-brand); }

.cc-card-next {
  border-top: 1px dashed var(--p-content-border-color);
  padding-top: 6px;
}

.cc-card-next-label {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--p-text-muted-color);
  margin-bottom: 4px;
}

.cc-card-next-action {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 500;
}

.cc-card-footer {
  display: flex;
  align-items: center;
  gap: 10px;
  border-top: 1px solid var(--p-content-border-color);
  padding-top: 6px;
  margin-top: 2px;
}

.cc-card-stat {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: var(--p-text-muted-color);
}

.cc-card-btn {
  margin-left: auto;
  font-size: 11px !important;
}

.cc-empty {
  grid-column: 1 / -1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 48px;
  color: var(--p-text-muted-color);
  font-size: 13px;
}

/* ═══ КРОСС-ГРАФ ═══════════════════════════════════════════════════════════ */
.cc-cross-section {
  padding: 16px 24px 24px;
  border-top: 1px solid var(--p-content-border-color);
}

.cc-cross-links {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 8px;
}

.cc-cross-link {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  grid-template-rows: auto auto;
  gap: 4px 8px;
  padding: 8px 12px;
  background: var(--p-surface-card);
  border: 1px solid var(--p-content-border-color);
  border-radius: 8px;
  font-size: 11px;
  align-items: center;
}

.cc-cross-link--done {
  opacity: 0.6;
  background: color-mix(in srgb, var(--fst-green) 5%, transparent);
}

.cc-cross-from, .cc-cross-to {
  display: flex;
  align-items: center;
  gap: 5px;
  overflow: hidden;
}

.cc-cross-from code, .cc-cross-to code {
  font-size: 9px;
  background: var(--p-surface-ground);
  border-radius: 3px;
  padding: 1px 4px;
  color: var(--fst-purple);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.cc-cross-arrow {
  text-align: center;
}

.cc-cross-label {
  grid-column: 1 / -1;
  font-size: 10px;
  color: var(--p-text-muted-color);
}
</style>
