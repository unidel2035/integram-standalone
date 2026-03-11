<script setup>
/**
 * FstFlow — единая адаптивная страница.
 *
 * Любой пользователь может переключить роль и получить другой набор
 * событийных блоков. Админ видит все роли + ссылку на полное меню.
 *
 * startup   → прогресс заявки + следующий шаг
 * investor  → портфель + сигналы
 * director  → Command Center mini + ключевые метрики
 * analyst   → Pipeline monitor + сделки в работе
 * expert    → предстоящие сессии ИК
 * admin     → всё + ссылка на полное меню
 */
import { computed, ref, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useRoleStore, ROLE_PROFILES } from '@/stores/roleStore'
import { useEventStore } from '@/stores/eventStore'
import { buildPipelineStages, getPipelineSummary } from '@/services/pipelineService'
import { getPlatformState } from '@/services/platformStateService'

const router = useRouter()
const roleStore = useRoleStore()
const eventStore = useEventStore()

const loading = ref(true)
const rolesLoading = ref(false)
const platformState = ref(null)
const aiMessage = ref('')
const aiLoading = ref(false)

// Локальная роль просмотра — не зависит от guard в roleStore.setRole()
// Персистируется в localStorage под отдельным ключом
const VIEW_ROLE_KEY = 'fst_flow_view_role'
const viewRole = ref(localStorage.getItem(VIEW_ROLE_KEY) || roleStore.activeRole)

function switchRole(id) {
  viewRole.value = id
  localStorage.setItem(VIEW_ROLE_KEY, id)
  // Если это реальная роль пользователя — меняем и в store
  if (roleStore.availableRoles.find(r => r.id === id)) {
    roleStore.setRole(id)
  }
}

const ALL_ROLES = Object.values(ROLE_PROFILES)

// Всегда показываем все 6 ролей — пользователь сам выбирает нужный срез
const switchableRoles = computed(() => ALL_ROLES)

const profile = computed(() => ROLE_PROFILES[viewRole.value] || ROLE_PROFILES.analyst)

// Дерево видов: какие блоки показывать по роли
const VIEW_CONFIG = {
  startup: {
    title: 'Мой стартап',
    subtitle: 'Путь от заявки до портфельной компании',
    blocks: ['apply-status', 'next-action'],
  },
  investor: {
    title: 'Панель инвестора',
    subtitle: 'Портфель, метрики, сигналы',
    blocks: ['portfolio-metrics', 'deal-signals', 'ic-schedule'],
  },
  director: {
    title: 'Command Center',
    subtitle: 'Состояние платформы в реальном времени',
    blocks: ['platform-metrics', 'deal-pipeline', 'alerts'],
  },
  analyst: {
    title: 'Монитор сделок',
    subtitle: 'Воронка и аналитика по конвейеру ПП-1→ПП-6',
    blocks: ['deal-pipeline', 'pipeline-stages', 'alerts'],
  },
  expert: {
    title: 'Экспертная панель',
    subtitle: 'Сессии инвесткомитета и экспертные задачи',
    blocks: ['ic-sessions', 'expert-tasks'],
  },
  admin: {
    title: 'Панель администратора',
    subtitle: 'Полный доступ к платформе',
    blocks: ['platform-metrics', 'deal-pipeline', 'alerts'],
  },
}

const viewCfg = computed(() => VIEW_CONFIG[viewRole.value] || VIEW_CONFIG.analyst)
const blocks = computed(() => viewCfg.value.blocks)

// ── Platform state + roles ────────────────────────────────────────────────────

onMounted(async () => {
  // Инициализируем роли если ещё не загружены (AppTopbar может не успеть)
  if (roleStore.profileRoles.length === 0 || roleStore.profileRoles[0] === 'analyst') {
    rolesLoading.value = true
    await roleStore.init()
    rolesLoading.value = false
  }

  // Если активная роль не входит в список реальных ролей — ставим первую доступную
  if (!roleStore.isAdmin && roleStore.availableRoles.length > 0) {
    const ids = roleStore.availableRoles.map(r => r.id)
    if (!ids.includes(roleStore.activeRole)) {
      roleStore.setRole(ids[0])
    }
  }

  platformState.value = getPlatformState(eventStore)
  loading.value = false
})

// ── Deal pipeline (для director/analyst) ────────────────────────────────────

const DEMO_DEALS = [
  { id: 'ventureos-001', name: 'VentureOS', sector: 'SaaS' },
  { id: 'agrobot-002',   name: 'AgroBot',   sector: 'AgriTech' },
  { id: 'medai-003',     name: 'MedAI',     sector: 'HealthTech' },
]

const dealPipeline = computed(() => {
  return DEMO_DEALS.map(d => {
    const stages = buildPipelineStages(d.id, eventStore)
    const summary = getPipelineSummary(stages)
    const active = stages.find(s => s.status === 'active')
    return { ...d, stages, summary, activeStage: active }
  })
})

// ── Alerts ────────────────────────────────────────────────────────────────────

const alerts = computed(() => platformState.value?.alerts || [])
const urgentAlerts = computed(() => alerts.value.filter(a => a.severity === 'high'))

// ── Portfolio metrics ─────────────────────────────────────────────────────────

const portfolioMetrics = [
  { label: 'NAV фонда', value: '₽210 млн', icon: 'pi pi-wallet' },
  { label: 'Компаний', value: '7', icon: 'pi pi-building' },
  { label: 'IRR фонда', value: '24%', icon: 'pi pi-chart-line' },
  { label: 'DPI', value: '0.8x', icon: 'pi pi-star' },
]

// ── IC Sessions ────────────────────────────────────────────────────────────────

const icSessions = [
  { id: 'ic1-2026-03', round: 'ИК-1', date: '2026-03-15', deal: 'VentureOS', status: 'scheduled', role: 'Эксперт по технологиям', deadline: '3 дня' },
  { id: 'ic2-2026-03', round: 'ИК-2', date: '2026-03-22', deal: 'AgroBot', status: 'pending_materials', role: 'Эксперт по рынку', deadline: '10 дней' },
]

// ── Startup flow ──────────────────────────────────────────────────────────────

const applySteps = [
  { id: 1, label: 'Подача заявки',          icon: 'pi pi-send',         done: true  },
  { id: 2, label: 'Первичная проверка',      icon: 'pi pi-search',       done: true  },
  { id: 3, label: 'Назначение РП',           icon: 'pi pi-user',         done: false },
  { id: 4, label: 'Экспертная оценка',       icon: 'pi pi-star',         done: false },
  { id: 5, label: 'Инвесткомитет ИК-1',     icon: 'pi pi-sitemap',      done: false },
  { id: 6, label: 'Подписание документов',   icon: 'pi pi-file-edit',    done: false },
  { id: 7, label: 'Финансовое закрытие',     icon: 'pi pi-check-circle', done: false },
]

const currentStep = computed(() => applySteps.find(s => !s.done) || applySteps.at(-1))

// ── AI Brief ──────────────────────────────────────────────────────────────────

// Отображаемое имя: из Integram или из localStorage
const displayName = computed(() =>
  roleStore.currentDisplayName || localStorage.getItem('user') || ''
)

const greeting = computed(() => {
  const name = displayName.value
  const role = profile.value.label
  return name ? `${name}, вы в режиме «${role}»` : `Режим «${role}»`
})

async function loadAIBrief() {
  if (aiLoading.value || aiMessage.value) return
  aiLoading.value = true
  try {
    const name = displayName.value
    const resp = await fetch('/api/ai-tokens/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        modelId: 'deepseek/deepseek-chat',
        prompt: `${name ? `Пользователь: ${name}. ` : ''}Роль: ${profile.value.label}. Дай 2-3 приоритетных действия на сегодня для этой роли в венчурном фонде ФСТ НТИ.${name ? ` Обратись по имени.` : ''} Кратко, по делу.`,
        systemPrompt: 'Ты — AI-ассистент венчурного фонда ФСТ НТИ. Отвечай лаконично, конкретно, на русском.',
        application: 'FstFlow'
      })
    })
    if (resp.ok) {
      const d = await resp.json()
      aiMessage.value = d.response || ''
    }
  } catch { /* silent */ }
  aiLoading.value = false
}

// Сбрасываем AI-сообщение при смене роли
watch(viewRole, () => { aiMessage.value = '' })

// Helpers
function statusColor(status) {
  if (['active', 'done', 'scheduled'].includes(status)) return 'var(--fst-green)'
  if (status === 'blocked') return 'var(--fst-red)'
  if (status === 'pending_materials') return 'var(--fst-brand)'
  return 'var(--p-text-muted-color)'
}

function statusLabel(status) {
  return { active: 'В работе', done: 'Завершено', blocked: 'Заблокировано',
    pending: 'Ожидает', scheduled: 'Запланировано', pending_materials: 'Ждёт материалов' }[status] || status
}
</script>

<template>
  <div class="flow-wrapper">
    <!-- ── Topbar ──────────────────────────────────────────────────────────── -->
    <div class="flow-topbar">
      <div class="flow-topbar-left">
        <i :class="profile.icon" :style="{ color: profile.color }"></i>
        <div>
          <div class="flow-title">{{ greeting }}</div>
          <div class="flow-subtitle">{{ viewCfg.subtitle }}</div>
        </div>
      </div>
      <div class="flow-topbar-right">
        <Button
          icon="pi pi-bolt"
          label="AI-брифинг"
          size="small"
          severity="secondary"
          :loading="aiLoading"
          @click="loadAIBrief"
        />
        <Button
          v-if="roleStore.isAdmin"
          icon="pi pi-th-large"
          label="Полное меню"
          size="small"
          severity="secondary"
          text
          @click="router.push('/fst-hub')"
        />
        <Button
          icon="pi pi-sitemap"
          label="CC"
          size="small"
          severity="secondary"
          text
          title="Command Center"
          @click="router.push('/fst-cc')"
        />
      </div>
    </div>

    <!-- ── Role switcher ────────────────────────────────────────────────────── -->
    <div class="flow-role-bar">
      <span class="flow-role-label">Роль:</span>
      <div v-if="rolesLoading" class="flow-role-loading">
        <ProgressSpinner style="width: 16px; height: 16px" />
        <span>Загрузка...</span>
      </div>
      <div v-else class="flow-role-tabs">
        <button
          v-for="r in switchableRoles"
          :key="r.id"
          class="flow-role-tab"
          :class="{ active: viewRole === r.id }"
          :style="viewRole === r.id ? { borderBottomColor: r.color, color: r.color } : {}"
          @click="switchRole(r.id)"
        >
          <i :class="r.icon"></i>
          <span>{{ r.labelShort }}</span>
        </button>
      </div>
    </div>

    <!-- ── AI Brief ───────────────────────────────────────────────────────── -->
    <div v-if="aiMessage" class="flow-ai-brief">
      <i class="pi pi-sparkles"></i>
      <span>{{ aiMessage }}</span>
      <Button icon="pi pi-times" text size="small" @click="aiMessage = ''" style="margin-left: auto; flex-shrink:0" />
    </div>

    <!-- ── Urgent alerts ─────────────────────────────────────────────────── -->
    <div v-if="urgentAlerts.length" class="flow-alerts">
      <div v-for="a in urgentAlerts" :key="a.id" class="flow-alert-chip">
        <i class="pi pi-exclamation-triangle"></i>
        <span>{{ a.message }}</span>
      </div>
    </div>

    <!-- ── Body ───────────────────────────────────────────────────────────── -->
    <div v-if="!loading" class="flow-body">

      <!-- ╔═ STARTUP ════════════════════════════════════════════════════════╗ -->

      <div v-if="blocks.includes('apply-status')" class="flow-card">
        <div class="flow-card-header">
          <i class="pi pi-send"></i>
          <span>Статус вашей заявки</span>
        </div>
        <div class="apply-steps">
          <div
            v-for="step in applySteps"
            :key="step.id"
            class="apply-step"
            :class="{ 'step-done': step.done, 'step-current': currentStep.id === step.id && !step.done }"
          >
            <div class="step-icon">
              <i :class="step.done ? 'pi pi-check-circle' : step.icon"></i>
            </div>
            <span>{{ step.label }}</span>
          </div>
        </div>
      </div>

      <div v-if="blocks.includes('next-action')" class="flow-card flow-card-accent">
        <div class="flow-card-header">
          <i class="pi pi-arrow-right-circle" style="color: var(--fst-green)"></i>
          <span>Следующий шаг</span>
        </div>
        <div class="next-action-body">
          <div class="next-action-label">{{ currentStep.label }}</div>
          <p class="next-action-hint">
            На этом шаге фонд назначает ответственного по развитию (РП). Ожидайте уведомления — как правило в течение 5 рабочих дней.
          </p>
          <Button label="Перейти к заявке" icon="pi pi-external-link" @click="router.push('/fst-apply')" />
        </div>
      </div>

      <!-- ╔═ INVESTOR / DIRECTOR METRICS ════════════════════════════════════╗ -->

      <div v-if="blocks.includes('portfolio-metrics') || blocks.includes('platform-metrics')" class="flow-metrics-strip">
        <div v-for="m in portfolioMetrics" :key="m.label" class="flow-metric">
          <i :class="m.icon" class="flow-metric-icon"></i>
          <div class="flow-metric-val">{{ m.value }}</div>
          <div class="flow-metric-label">{{ m.label }}</div>
        </div>
        <div class="flow-metric">
          <i class="pi pi-exclamation-circle flow-metric-icon" style="color: var(--fst-red)"></i>
          <div class="flow-metric-val">{{ urgentAlerts.length }}</div>
          <div class="flow-metric-label">Алертов</div>
        </div>
      </div>

      <!-- Deal pipeline -->
      <div v-if="blocks.includes('deal-pipeline')" class="flow-card">
        <div class="flow-card-header">
          <i class="pi pi-map"></i>
          <span>Конвейер сделок ПП-1→ПП-6</span>
          <Button label="Открыть" icon="pi pi-external-link" size="small" text severity="secondary"
            style="margin-left: auto" @click="router.push('/fst-pipeline')" />
        </div>
        <div class="pipeline-rows">
          <div v-for="deal in dealPipeline" :key="deal.id" class="pipeline-row">
            <div class="pipeline-row-name">
              <span class="deal-name">{{ deal.name }}</span>
              <span class="deal-sector">{{ deal.sector }}</span>
            </div>
            <div class="pipeline-stages-track">
              <div
                v-for="stage in deal.stages"
                :key="stage.id"
                class="pipeline-track-seg"
                :class="`track-${stage.status}`"
                :title="`${stage.name} — ${statusLabel(stage.status)}`"
              >
                <span class="track-seg-label">{{ stage.id.replace('pp', 'ПП-') }}</span>
              </div>
            </div>
            <div class="pipeline-row-phase">
              <span v-if="deal.activeStage" :style="{ color: deal.activeStage.color }">{{ deal.activeStage.name }}</span>
              <span v-else class="muted">—</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Stage count grid (analyst) -->
      <div v-if="blocks.includes('pipeline-stages')" class="flow-card">
        <div class="flow-card-header">
          <i class="pi pi-chart-bar"></i>
          <span>Сделки по стадиям</span>
        </div>
        <div class="stage-summary-grid">
          <div v-for="pp in ['pp1','pp2','pp3','pp4','pp5','pp6']" :key="pp" class="stage-summary-cell">
            <div class="stage-count">{{ dealPipeline.filter(d => d.activeStage?.id === pp).length }}</div>
            <div class="stage-name">{{ pp.replace('pp', 'ПП-') }}</div>
          </div>
        </div>
      </div>

      <!-- Deal signals (investor) -->
      <div v-if="blocks.includes('deal-signals')" class="flow-card">
        <div class="flow-card-header">
          <i class="pi pi-bell"></i>
          <span>Сигналы по сделкам</span>
        </div>
        <div class="signals-list">
          <div v-for="deal in dealPipeline" :key="deal.id" class="signal-row">
            <span class="deal-name">{{ deal.name }}</span>
            <span v-if="deal.summary?.blockerCount" class="signal-chip chip-danger">
              {{ deal.summary.blockerCount }} блокер
            </span>
            <span v-if="deal.activeStage" class="signal-chip chip-info">{{ deal.activeStage.name }}</span>
            <span v-if="deal.summary?.slaStatus === 'overdue'" class="signal-chip chip-warning">SLA</span>
            <Button icon="pi pi-arrow-right" text size="small" @click="router.push('/fst-pipeline')" style="margin-left:auto" />
          </div>
        </div>
      </div>

      <!-- ╔═ EXPERT ═════════════════════════════════════════════════════════╗ -->

      <div v-if="blocks.includes('ic-sessions') || blocks.includes('ic-schedule')" class="flow-card">
        <div class="flow-card-header">
          <i class="pi pi-calendar"></i>
          <span>Заседания инвесткомитета</span>
          <Button label="Все сессии" icon="pi pi-external-link" size="small" text severity="secondary"
            style="margin-left:auto" @click="router.push('/fst-committee')" />
        </div>
        <div class="ic-sessions-list">
          <div v-for="s in icSessions" :key="s.id" class="ic-session-card">
            <div class="ic-session-badge"
              :style="{ background: 'color-mix(in srgb, var(--fst-purple) 15%, transparent)', color: 'var(--fst-purple)' }">
              {{ s.round }}
            </div>
            <div class="ic-session-info">
              <div class="ic-session-deal">{{ s.deal }}</div>
              <div class="ic-session-meta">
                <i class="pi pi-calendar"></i> {{ s.date }}
                <span v-if="s.role"> · <i class="pi pi-user"></i> {{ s.role }}</span>
              </div>
            </div>
            <div class="ic-session-right">
              <Tag :value="statusLabel(s.status)"
                :style="{ background: 'color-mix(in srgb, ' + statusColor(s.status) + ' 15%, transparent)', color: statusColor(s.status) }" />
              <span class="ic-deadline">через {{ s.deadline }}</span>
            </div>
          </div>
        </div>
      </div>

      <div v-if="blocks.includes('expert-tasks')" class="flow-card">
        <div class="flow-card-header">
          <i class="pi pi-list-check"></i>
          <span>Мои задачи</span>
        </div>
        <div class="expert-tasks-list">
          <div class="expert-task">
            <i class="pi pi-file-edit" style="color: var(--fst-brand)"></i>
            <span>Заключение по VentureOS (ИК-1)</span>
            <Tag value="Срочно" severity="warn" style="margin-left: auto" />
          </div>
          <div class="expert-task">
            <i class="pi pi-search" style="color: var(--fst-blue)"></i>
            <span>Техническая экспертиза AgroBot</span>
            <Tag value="3 дня" severity="secondary" style="margin-left: auto" />
          </div>
        </div>
        <Button label="Перейти к экспертизе" icon="pi pi-arrow-right" size="small" class="mt-2"
          @click="router.push('/fst-expert')" />
      </div>

      <!-- ╔═ ALERTS ═════════════════════════════════════════════════════════╗ -->

      <div v-if="blocks.includes('alerts')" class="flow-card">
        <div class="flow-card-header">
          <i class="pi pi-exclamation-triangle" style="color: var(--fst-red)"></i>
          <span>Алерты платформы</span>
        </div>
        <div class="alerts-list">
          <div v-for="a in alerts.slice(0, 6)" :key="a.id" class="alert-row">
            <i class="pi pi-circle-fill" style="font-size: 8px"
              :style="{ color: a.severity === 'high' ? 'var(--fst-red)' : 'var(--fst-brand)' }"></i>
            <span>{{ a.message }}</span>
          </div>
          <div v-if="!alerts.length" class="muted">Алертов нет. Всё в порядке.</div>
        </div>
      </div>

    </div>

    <div v-else class="flow-loading">
      <ProgressSpinner style="width: 40px; height: 40px" />
    </div>
  </div>
</template>

<style scoped>
.flow-wrapper {
  min-height: 100vh;
  background: var(--p-surface-ground);
}

/* ── Topbar ────────────────────────────────────────────────────────────────── */
.flow-topbar {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 24px;
  background: var(--p-surface-card);
  border-bottom: 1px solid var(--p-content-border-color);
}

.flow-topbar-left {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
}

.flow-title {
  font-size: 14px;
  font-weight: 700;
  line-height: 1.2;
}

.flow-subtitle {
  font-size: 11px;
  color: var(--p-text-muted-color);
}

.flow-topbar-right {
  display: flex;
  align-items: center;
  gap: 6px;
}

/* ── Role bar ─────────────────────────────────────────────────────────────── */
.flow-role-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 24px;
  background: var(--p-surface-card);
  border-bottom: 1px solid var(--p-content-border-color);
}

.flow-role-label {
  font-size: 11px;
  color: var(--p-text-muted-color);
  white-space: nowrap;
  padding: 10px 0;
}

.flow-role-loading {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--p-text-muted-color);
  padding: 8px 0;
}

.flow-role-tabs {
  display: flex;
  gap: 0;
  flex-wrap: wrap;
}

.flow-role-tab {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  background: var(--p-surface-ground);
  border: 1px solid var(--p-content-border-color);
  border-radius: 6px;
  margin: 6px 4px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  color: var(--p-text-color);
  transition: background 0.15s, border-color 0.15s;
  white-space: nowrap;
}

.flow-role-tab:hover {
  background: var(--p-surface-card);
  border-color: var(--p-primary-color);
}

.flow-role-tab.active {
  font-weight: 700;
  background: var(--p-surface-card);
  border-color: currentColor;
}

/* ── AI Brief ──────────────────────────────────────────────────────────────── */
.flow-ai-brief {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin: 12px 24px 0;
  padding: 12px 16px;
  background: color-mix(in srgb, var(--fst-purple) 8%, transparent);
  border: 1px solid color-mix(in srgb, var(--fst-purple) 30%, transparent);
  border-radius: 10px;
  font-size: 13px;
  line-height: 1.5;
}

.flow-ai-brief i {
  color: var(--fst-purple);
  margin-top: 2px;
  flex-shrink: 0;
}

/* ── Alerts strip ──────────────────────────────────────────────────────────── */
.flow-alerts {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  padding: 10px 24px 0;
}

.flow-alert-chip {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  background: color-mix(in srgb, var(--fst-red) 12%, transparent);
  border: 1px solid color-mix(in srgb, var(--fst-red) 30%, transparent);
  border-radius: 20px;
  font-size: 12px;
  color: var(--fst-red);
}

/* ── Body ──────────────────────────────────────────────────────────────────── */
.flow-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 20px 24px;
}

.flow-loading {
  display: flex;
  justify-content: center;
  padding: 60px;
}

/* ── Cards ─────────────────────────────────────────────────────────────────── */
.flow-card {
  background: var(--p-surface-card);
  border: 1px solid var(--p-content-border-color);
  border-radius: 12px;
  padding: 20px;
}

.flow-card-accent {
  border-color: color-mix(in srgb, var(--fst-green) 40%, transparent);
}

.flow-card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: var(--p-text-muted-color);
  margin-bottom: 16px;
}

/* ── Metrics strip ─────────────────────────────────────────────────────────── */
.flow-metrics-strip {
  display: flex;
  gap: 1px;
  background: var(--p-content-border-color);
  border: 1px solid var(--p-content-border-color);
  border-radius: 12px;
  overflow: hidden;
}

.flow-metric {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 16px 12px;
  background: var(--p-surface-card);
  text-align: center;
  gap: 4px;
}

.flow-metric-icon {
  font-size: 16px;
  opacity: 0.7;
}

.flow-metric-val {
  font-size: 22px;
  font-weight: 700;
  line-height: 1;
}

.flow-metric-label {
  font-size: 11px;
  color: var(--p-text-muted-color);
  white-space: nowrap;
}

/* ── Apply steps ───────────────────────────────────────────────────────────── */
.apply-steps {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.apply-step {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 9px 14px;
  border-radius: 8px;
  background: var(--p-surface-ground);
  font-size: 13px;
  color: var(--p-text-muted-color);
}

.step-done { color: var(--fst-green); }

.step-current {
  background: color-mix(in srgb, var(--fst-green) 10%, transparent);
  border: 1px solid color-mix(in srgb, var(--fst-green) 30%, transparent);
  color: var(--p-text-color);
  font-weight: 600;
}

.step-icon { width: 20px; text-align: center; }

.next-action-body { display: flex; flex-direction: column; gap: 10px; }
.next-action-label { font-size: 16px; font-weight: 700; }
.next-action-hint { font-size: 13px; color: var(--p-text-muted-color); margin: 0; line-height: 1.5; }

/* ── Pipeline rows ─────────────────────────────────────────────────────────── */
.pipeline-rows { display: flex; flex-direction: column; gap: 10px; }

.pipeline-row { display: flex; align-items: center; gap: 12px; }

.pipeline-row-name { display: flex; flex-direction: column; width: 110px; flex-shrink: 0; }
.deal-name { font-size: 13px; font-weight: 600; }
.deal-sector { font-size: 11px; color: var(--p-text-muted-color); }

.pipeline-stages-track { display: flex; flex: 1; gap: 3px; }

.pipeline-track-seg {
  flex: 1;
  height: 28px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: 700;
  background: var(--p-surface-ground);
  color: var(--p-text-muted-color);
}

.track-done { background: color-mix(in srgb, var(--fst-green) 20%, transparent); color: var(--fst-green); }
.track-active { background: color-mix(in srgb, var(--fst-blue) 20%, transparent); color: var(--fst-blue); }
.track-blocked { background: color-mix(in srgb, var(--fst-red) 15%, transparent); color: var(--fst-red); }

.pipeline-row-phase { width: 110px; font-size: 12px; text-align: right; }

/* ── Stage summary grid ────────────────────────────────────────────────────── */
.stage-summary-grid { display: flex; gap: 12px; }

.stage-summary-cell {
  flex: 1; text-align: center;
  padding: 12px; background: var(--p-surface-ground); border-radius: 8px;
}

.stage-count { font-size: 24px; font-weight: 700; line-height: 1; }
.stage-name { font-size: 11px; color: var(--p-text-muted-color); margin-top: 4px; }

/* ── Signals ───────────────────────────────────────────────────────────────── */
.signals-list { display: flex; flex-direction: column; gap: 8px; }

.signal-row {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 0; border-bottom: 1px solid var(--p-content-border-color);
}
.signal-row:last-child { border-bottom: none; }

.signal-chip { padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 600; }
.chip-danger { background: color-mix(in srgb, var(--fst-red) 15%, transparent); color: var(--fst-red); }
.chip-info { background: color-mix(in srgb, var(--fst-blue) 15%, transparent); color: var(--fst-blue); }
.chip-warning { background: color-mix(in srgb, var(--fst-brand) 15%, transparent); color: var(--fst-brand); }

/* ── IC Sessions ───────────────────────────────────────────────────────────── */
.ic-sessions-list { display: flex; flex-direction: column; gap: 10px; }

.ic-session-card {
  display: flex; align-items: center; gap: 14px;
  padding: 12px 14px; background: var(--p-surface-ground); border-radius: 10px;
}

.ic-session-badge { padding: 4px 10px; border-radius: 6px; font-size: 12px; font-weight: 700; flex-shrink: 0; }

.ic-session-info { flex: 1; }
.ic-session-deal { font-size: 13px; font-weight: 600; }
.ic-session-meta { font-size: 11px; color: var(--p-text-muted-color); margin-top: 2px; }

.ic-session-right { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; }
.ic-deadline { font-size: 11px; color: var(--p-text-muted-color); }

/* ── Expert tasks ──────────────────────────────────────────────────────────── */
.expert-tasks-list { display: flex; flex-direction: column; gap: 10px; }

.expert-task {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 14px; background: var(--p-surface-ground); border-radius: 8px; font-size: 13px;
}

/* ── Alerts list ───────────────────────────────────────────────────────────── */
.alerts-list { display: flex; flex-direction: column; gap: 8px; }
.alert-row { display: flex; align-items: center; gap: 8px; font-size: 13px; }

.muted { color: var(--p-text-muted-color); }
.mt-2 { margin-top: 8px; }
</style>
