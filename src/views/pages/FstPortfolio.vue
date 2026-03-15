<template>
  <FstPageLayout
    title="Портфель фонда"
    subtitle="Мониторинг здоровья портфельных компаний"
  >
    <!-- ─── Topbar left: title + status ─── -->
    <template #header>
      <div class="fsp-title-group">
        <i class="pi pi-circle-fill fsp-live-dot" :style="{ color: liveColor }"></i>
        <span class="fsp-fund-name">ФСТ НТИ · <b>Портфельный монитор</b></span>
        <Tag :value="`${activeCount} активных`" severity="success" class="fsp-tag" />
        <Tag :value="`${alertCount} предупреждений`" :severity="alertCount > 0 ? 'warn' : 'secondary'" class="fsp-tag" />
      </div>
      <div class="fsp-updated">
        Обновлено: {{ lastUpdate }} · Мониторинг {{ monitoringStatus }}
      </div>
    </template>

    <!-- ─── Topbar right: actions ─── -->
    <template #actions>
      <Button icon="pi pi-refresh" label="Обновить" size="small" severity="secondary" @click="refreshAll" :loading="refreshing" />
      <Button icon="pi pi-plus" label="Добавить" size="small" severity="success" @click="showAddDialog = true" />
      <Button icon="pi pi-building" label="ЦД Фонда" size="small" severity="secondary" text @click="$router.push('/fst-fund')" />
    </template>

    <!-- ─── KPI metrics strip ─── -->
    <div class="fsp-metrics fst-metrics-strip">
      <div v-for="m in portfolioMetrics" :key="m.label" class="fst-metric-item">
        <i :class="m.icon" class="fst-metric-item-icon" :style="{ color: m.color }"></i>
        <div class="fst-metric-item-val">{{ m.val }}</div>
        <div class="fst-metric-item-label">{{ m.label }}</div>
      </div>
    </div>

    <!-- ─── Filters bar ─── -->
    <div class="fsp-filter-bar">
      <Select v-model="filterSubfund" :options="subfundOptions" placeholder="Все субфонды" class="fsp-filter-sel" size="small" />
      <Select v-model="filterStatus" :options="statusOptions" placeholder="Все статусы" class="fsp-filter-sel" size="small" />
      <span class="fsp-search-wrap">
        <i class="pi pi-search" style="font-size:12px;color:var(--p-text-muted-color)" />
        <InputText v-model="searchQuery" placeholder="Поиск компании..." size="small" class="fsp-search" />
      </span>
    </div>

    <!-- ─── Portfolio Grid ─── -->
    <div class="fsp-body">

      <!-- Left: Company Cards -->
      <div class="fsp-companies">
        <div class="fst-section-label fsp-companies-label">Портфельные компании</div>

        <!-- Alert banner -->
        <div v-if="criticalAlerts.length" class="fsp-alert-banner">
          <i class="pi pi-exclamation-triangle" style="color:var(--fst-red);font-size:14px"></i>
          <span><b>Критические риски:</b> {{ criticalAlerts.map(a => a.company).join(', ') }} — требуется внимание</span>
          <Button label="Созвать ИК" icon="pi pi-users" size="small" severity="danger" @click="callCommittee" style="margin-left:auto" />
        </div>

        <!-- Grid of cards -->
        <div class="fsp-cards-grid">
          <div v-for="(c, cIdx) in filteredCompanies" :key="c.id"
            class="fsp-card" :class="{ selected: selectedCompany?.id === c.id, ['risk-' + c.riskLevel]: true }"
            @click="selectCompany(c)">
            <div class="fsp-card-header">
              <div class="fsp-card-name">{{ c.name }}</div>
              <div class="fsp-card-badges">
                <Tag :value="c.subfund" style="font-size:10px;background:var(--fst-blue);color:white" />
                <FeatureHint
                  v-if="cIdx === 0"
                  id="portfolio-traffic-light"
                  title="Светофор рисков"
                  description="Цвет индикатора показывает уровень риска компании: зелёный — норма, жёлтый — требует внимания, красный — критический риск"
                  position="bottom"
                >
                  <div class="fsp-traffic-light" :style="{ background: riskColor(c.riskLevel) }" :title="riskLabel(c.riskLevel)"></div>
                </FeatureHint>
                <div v-else class="fsp-traffic-light" :style="{ background: riskColor(c.riskLevel) }" :title="riskLabel(c.riskLevel)"></div>
              </div>
            </div>
            <div class="fsp-card-stage">{{ c.stage }} · {{ c.inn }}</div>
            <div class="fsp-card-metrics">
              <div class="fsp-card-metric">
                <span class="fsp-m-label">Выручка</span>
                <span class="fsp-m-val" :style="{ color: 'var(--fst-green)' }">{{ c.revenue }} млн</span>
              </div>
              <div class="fsp-card-metric">
                <span class="fsp-m-label">Runway</span>
                <span class="fsp-m-val" :style="{ color: runwayColor(c.runway) }">{{ c.runway }} мес</span>
              </div>
              <div class="fsp-card-metric">
                <span class="fsp-m-label">TRL</span>
                <span class="fsp-m-val" :style="{ color: 'var(--fst-blue)' }">{{ c.trl }}</span>
              </div>
              <div class="fsp-card-metric">
                <span class="fsp-m-label">Сотр.</span>
                <span class="fsp-m-val">{{ c.headcount }}</span>
              </div>
            </div>
            <div class="fsp-health-bar-wrap">
              <div class="fsp-health-bar" :style="{ width: companyHealth(c) + '%', background: companyHealthBarColor(c) }"></div>
              <span class="fsp-health-val">{{ companyHealth(c) }}%</span>
            </div>
            <!-- GR-статус badge -->
            <div class="fsp-gr-badge" v-if="getGrStatus(c).total > 0 || true">
              <span class="fsp-gr-label">GR:</span>
              <span v-if="getGrStatus(c).funded > 0" class="fsp-gr-funded">✓ {{ getGrStatus(c).funded }}</span>
              <span v-if="getGrStatus(c).applied > 0" class="fsp-gr-applied">→ {{ getGrStatus(c).applied }}</span>
              <span v-if="getGrStatus(c).nextMeasure" class="fsp-gr-next">{{ getGrStatus(c).nextMeasure.slice(0, 18) }}…</span>
              <span v-else class="fsp-gr-empty">нет мер</span>
            </div>
            <div v-if="c.alerts.length" class="fsp-card-alerts">
              <div v-for="a in c.alerts.slice(0,2)" :key="a.type" class="fsp-card-alert" :class="a.severity">
                <i :class="alertIcon(a.type)" style="font-size:10px"></i> {{ a.msg }}
              </div>
            </div>
            <div class="fsp-card-footer-actions">
              <button class="fsp-hist-btn" @click.stop="openProjectHub(c)">
                <i class="pi pi-history" style="font-size:10px"></i> История
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Right: Detail + Sources + AI -->
      <div class="fsp-detail" v-if="selectedCompany">

        <!-- Company Header -->
        <div class="fsp-detail-panel">
          <div class="fsp-detail-company-header">
            <div>
              <div class="fsp-detail-name">{{ selectedCompany.name }}</div>
              <div class="fsp-detail-sub">{{ selectedCompany.inn }} · {{ selectedCompany.stage }} · Субфонд {{ selectedCompany.subfund }}</div>
            </div>
            <div class="fsp-detail-health-badge" :style="{ background: companyHealthBarColor(selectedCompany) }">
              {{ companyHealth(selectedCompany) }}%
            </div>
          </div>

          <!-- KPI Progress -->
          <div class="fsp-kpi-section">
            <div class="fsp-kpi-row" v-for="kpi in selectedCompany.kpis" :key="kpi.name">
              <div class="fsp-kpi-label">{{ kpi.name }}</div>
              <div class="fsp-kpi-bar-wrap">
                <div class="fsp-kpi-bar" :style="{ width: Math.min(100, kpi.actual / kpi.target * 100) + '%', background: kpiColor(kpi) }"></div>
              </div>
              <div class="fsp-kpi-nums">
                <span :style="{ color: kpiColor(kpi) }">{{ kpi.actual }}</span>
                <span style="color:var(--p-text-muted-color)"> / {{ kpi.target }} {{ kpi.unit }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Links Platform -->
        <div class="fsp-detail-panel">
          <EntityLinksPanel
            :entityId="selectedCompany.id"
            entityType="company"
            :labelMap="conceptLabelMap"
            @link-added="onLinkAdded"
          />
        </div>

        <!-- Data Sources -->
        <div class="fsp-detail-panel">
          <div class="fsp-detail-panel-title">
            <i class="pi pi-database" style="color:var(--fst-brand)"></i> Источники данных
            <Button icon="pi pi-refresh" size="small" text @click="refreshSources" :loading="sourcesLoading" style="margin-left:auto" />
          </div>
          <div class="fsp-sources-grid">
            <div v-for="src in dataSources" :key="src.id" class="fsp-source" :class="src.status">
              <div class="fsp-source-icon"><i :class="src.icon"></i></div>
              <div class="fsp-source-info">
                <div class="fsp-source-name">{{ src.name }}</div>
                <div class="fsp-source-last">{{ src.lastUpdate }}</div>
              </div>
              <div class="fsp-source-badge">
                <i :class="src.status === 'ok' ? 'pi pi-check-circle' : src.status === 'warn' ? 'pi pi-exclamation-circle' : 'pi pi-times-circle'"
                  :style="{ color: src.status === 'ok' ? 'var(--fst-green)' : src.status === 'warn' ? 'var(--fst-brand)' : 'var(--fst-red)' }" />
              </div>
            </div>
          </div>
        </div>

        <!-- Risk Sensors -->
        <div class="fsp-detail-panel">
          <div class="fsp-detail-panel-title">
            <i class="pi pi-shield" style="color:var(--fst-red)"></i> Датчики рисков
          </div>
          <div class="fsp-risk-sensors">
            <div v-for="sensor in selectedCompany.sensors" :key="sensor.type"
              class="fsp-sensor" :class="sensor.level">
              <div class="fsp-sensor-dot" :style="{ background: sensorColor(sensor.level) }"></div>
              <div class="fsp-sensor-info">
                <div class="fsp-sensor-name">{{ sensor.name }}</div>
                <div class="fsp-sensor-msg">{{ sensor.msg }}</div>
              </div>
              <Tag :value="sensor.level.toUpperCase()" :severity="sensorSeverity(sensor.level)" style="font-size:9px" />
            </div>
          </div>
        </div>

        <!-- Timeline Events (EventStore) -->
        <div class="fsp-detail-panel">
          <div class="fsp-detail-panel-title">
            <i class="pi pi-history" style="color:var(--fst-cyan)"></i> Лента событий
            <span class="fsp-tl-count">{{ companyTimeline.length }}</span>
            <Button icon="pi pi-plus" size="small" severity="secondary" text
                    style="margin-left:auto" @click="addEventDialog = true" />
          </div>

          <!-- EventStore лента -->
          <div class="fsp-events">
            <div v-for="ev in companyTimeline.slice().reverse()" :key="ev.id" class="fsp-event">
              <div class="fsp-event-dot" :style="{ background: ev.color || eventColor(ev.data?.originalType || ev.type) }"></div>
              <div class="fsp-event-body">
                <div class="fsp-event-title">
                  <i v-if="ev.icon" :class="ev.icon" :style="{ color: ev.color, fontSize:'11px', marginRight:'4px' }" />
                  {{ ev.label || ev.data?.title || ev.type }}
                </div>
                <div class="fsp-event-date">{{ new Date(ev.ts).toLocaleDateString('ru-RU') }}</div>
              </div>
              <Tag :value="ev.data?.originalType || ev.type.replace(/_/g,' ')"
                   :style="{ fontSize: '9px', background: ev.color || 'var(--fst-blue)', color: 'white', maxWidth:'90px', overflow:'hidden' }" />
            </div>
          </div>

          <!-- Диалог добавления события -->
          <div v-if="addEventDialog" class="fsp-add-event-dialog">
            <div class="fsp-aed-title">Добавить событие</div>
            <Select v-model="newEventType" :options="EVENT_TYPE_OPTIONS"
                    option-label="label" option-value="value" style="width:100%;margin-bottom:0.4rem" />
            <InputText v-model="newEventNote" placeholder="Примечание (необязательно)"
                       style="width:100%;margin-bottom:0.4rem" />
            <div style="display:flex;gap:0.4rem">
              <Button label="Добавить" icon="pi pi-check" size="small" @click="addCompanyEvent" />
              <Button label="Отмена" severity="secondary" size="small" @click="addEventDialog=false" />
            </div>
          </div>
        </div>

        <!-- AI Weekly Report -->
        <div class="fsp-detail-panel">
          <div class="fsp-detail-panel-title">
            <i class="pi pi-brain" style="color:var(--fst-purple)"></i> AI Еженедельный отчёт
            <Button :label="aiReportLoading ? 'Генерация...' : 'Обновить'" icon="pi pi-sparkles" size="small" severity="secondary"
              @click="generateAiReport" :loading="aiReportLoading" style="margin-left:auto" />
          </div>
          <div v-if="aiReport" class="fsp-ai-report">
            <div v-for="section in aiReport" :key="section.title" class="fsp-ai-section">
              <div class="fsp-ai-section-title" :style="{ color: section.color }">
                <i :class="section.icon"></i> {{ section.title }}
              </div>
              <ul class="fsp-ai-list">
                <li v-for="point in section.points" :key="point">{{ point }}</li>
              </ul>
            </div>
          </div>
          <div v-else class="fsp-ai-empty">
            <Button label="Сгенерировать отчёт" icon="pi pi-sparkles" size="small" severity="info" @click="generateAiReport" :loading="aiReportLoading" />
          </div>
        </div>

        <!-- Ontology Next Steps + Causal -->
        <OntologyNextSteps entity-type="company" :entity-id="selectedCompany.id" style="margin-bottom:8px" />
        <CausalExplanation entity-type="company" :entity-id="selectedCompany.id" style="margin-bottom:10px" />

        <!-- Deal link -->
        <div class="fsp-detail-nav">
          <Button icon="pi pi-file-edit" label="Открыть сделку" severity="info" size="small" @click="$router.push('/fst-deal')" />
          <Button icon="pi pi-list-check" label="Исполнение" severity="success" size="small" @click="$router.push('/fst-execution')" />
          <Button icon="pi pi-chart-line" label="ЦД Компании" severity="secondary" size="small" @click="$router.push('/fst-twin')" />
          <Button icon="pi pi-building" label="GR-план" severity="warning" size="small" @click="$router.push({ path: '/fst-gov', query: { company: selectedCompany.id, tab: 'timeline' } })" />
        </div>
      </div>

      <!-- Empty state -->
      <div v-else class="fsp-detail fsp-detail-empty">
        <i class="pi pi-arrow-left" style="font-size:24px;color:var(--p-text-muted-color)"></i>
        <div>Выберите компанию из портфеля</div>
      </div>

    </div>

    <!-- Page Tutor -->
    <PageTutorButton pageId="fst-portfolio" :getContext="getPageContext" />

  </FstPageLayout>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import FstPageLayout from '@/components/fst-shared/FstPageLayout.vue'
import { useProjectStore } from '@/stores/projectStore.js'
import Button from 'primevue/button'
import Tag from 'primevue/tag'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import { useToast } from 'primevue/usetoast'
import { getProjects, STATUS_PORTFOLIO } from '@/services/fstApi'
import PageTutorButton from '@/components/PageTutorButton.vue'
import LearnTooltip from '@/components/LearnTooltip.vue'
import OntologyNextSteps from '@/components/ontology/OntologyNextSteps.vue'
import CausalExplanation from '@/components/ontology/CausalExplanation.vue'
import FeatureHint from '@/components/FeatureHint.vue'
import EntityLinksPanel from '@/components/links/EntityLinksPanel.vue'
import { useEventStore } from '@/stores/eventStore.js'
import { PORTFOLIO_EVENT_TYPES, getEventDef } from '@/config/eventRegistry.js'
import { buildEntityContext, buildContextPrompt, buildPortfolioContext } from '@/services/ontologyContextBuilder.js'
import { companyHealthScore, healthToColor } from '@/services/portfolioHealth.js'
import { useGrEventStore } from '@/stores/grEventStore.js'
import { nextPossibleEvents } from '@/services/grEventEngine.js'
import { GR_MEASURES } from '@/config/grMeasuresData.js'

const toast = useToast()
const eventStore = useEventStore()
const grEventStore = useGrEventStore()

// ── Динамический health score из онтологии событий (issue #186) ───────────────
// Возвращает карту { companyId → score } реактивно через eventStore.timelines
const liveHealthScores = computed(() => {
  const scores = {}
  for (const company of companies.value) {
    const id = String(company.id)
    const timeline = eventStore.getTimeline('company', id)
    scores[company.id] = companyHealthScore(timeline)
  }
  return scores
})

function companyHealth(company) {
  const live = liveHealthScores.value[company.id]
  // Если есть события — используем живой score, иначе статичный из данных
  return live > 0 ? live : (company.health ?? 50)
}

function companyHealthBarColor(company) {
  const score = companyHealth(company)
  return healthToColor(score)
}

// GR-статус каждой компании
function getGrStatus(company) {
  const id = String(company.id)
  const timeline = grEventStore.getTimeline(id)
  const applied = timeline.filter(e => e.type === 'MEASURE_APPLIED').length
  const funded = timeline.filter(e => e.type === 'MEASURE_FUNDED').length
  const possible = nextPossibleEvents(timeline, GR_MEASURES)
  const nextHigh = possible.find(p => p.probability === 'high')
  return { applied, funded, total: timeline.length, nextMeasure: nextHigh?.measure?.name || nextHigh?.eventDef?.label || null }
}

// ─── EventStore: инициализация и работа с лентой компании ────────────────────

// Преобразовать статичные события компании в типизированные события реестра
const TYPE_MAP = {
  'Контракт': 'CONTRACT_SIGNED',
  'Финансы':  'TRANCHE_RELEASED',
  'Найм':     'TEAM_CHANGE',
  'IP':       'PRODUCT_LAUNCH',
  'Риск':     'RISK_ELEVATED',
}

async function ensureCompanyTimeline(company) {
  if (!company) return
  // Сначала тянем из Integram (если были события в прошлых сессиях)
  await eventStore.load('company', String(company.id))
  const existing = eventStore.getTimeline('company', String(company.id))
  if (existing.length) return // данные загружены из Integram — не перетираем

  // Ничего не загрузилось → инициализируем из статичных данных компании
  eventStore.add('company', String(company.id), 'COMPANY_ADDED', {
    name: company.name, subfund: company.subfund, trl: company.trl, stage: company.stage,
  })
  for (const ev of (company.events || [])) {
    const evType = TYPE_MAP[ev.type] || 'KPI_UPDATED'
    eventStore.add('company', String(company.id), evType, { title: ev.title, date: ev.date, originalType: ev.type })
  }
  if (company.revenue) eventStore.add('company', String(company.id), 'KPI_UPDATED', { revenue: company.revenue, trl: company.trl, runway: company.runway })
  if (company.riskLevel === 'red') eventStore.add('company', String(company.id), 'RISK_ELEVATED', { level: 'critical', auto: true })
}

// Лента событий выбранной компании (из EventStore)
const companyTimeline = computed(() => {
  if (!selectedCompany.value) return []
  return eventStore.getTimeline('company', String(selectedCompany.value.id))
})

// Состояние компании из EventStore
const companyEventState = computed(() => {
  if (!selectedCompany.value) return {}
  return eventStore.getState('company', String(selectedCompany.value.id))
})

// Добавить событие в ленту
const addEventDialog = ref(false)
const newEventType = ref('KPI_UPDATED')
const newEventNote = ref('')
const EVENT_TYPE_OPTIONS = Object.values(PORTFOLIO_EVENT_TYPES).map(e => ({ label: e.label, value: e.id }))

function addCompanyEvent() {
  if (!selectedCompany.value) return
  eventStore.add('company', String(selectedCompany.value.id), newEventType.value, { note: newEventNote.value, manual: true })
  addEventDialog.value = false
  newEventNote.value = ''
  toast.add({ severity: 'success', summary: 'Событие добавлено в ленту', life: 2000 })
}

// ── Links Platform ────────────────────────────────────────────
const conceptLabelMap = ref({})
function onLinkAdded(link) {
  toast.add({ severity: 'success', summary: 'Связь добавлена', life: 2000 })
}

// ── Page Tutor Context ────────────────────────────────────────
function getPageContext() {
  const company = companies.value.find(c => c.id === selectedCompanyId.value)
  // Build portfolio ontology context for all companies
  const companiesData = companies.value.map(c => ({
    entityType: 'company',
    entityId: String(c.id),
    timeline: eventStore.getTimeline('company', String(c.id)),
    state: { name: c.name, health: c.health }
  }))
  return {
    module: 'Портфель компаний',
    selectedCompany: company ? company.name : null,
    totalCompanies: companies.value.length,
    monitoringStatus: monitoringStatus.value,
    ontology: buildPortfolioContext(companiesData)
  }
}

// ─── Live indicator ───────────────────────────────────────────────────────────
const liveColor = ref('var(--fst-green)')
const lastUpdate = ref(new Date().toLocaleTimeString('ru-RU'))
const monitoringStatus = ref('активен')
let liveTimer = null

// ─── Загрузка из fst API ──────────────────────────────────────────────────────
const portfolioLoading = ref(false)

async function loadPortfolioFromDb() {
  portfolioLoading.value = true
  try {
    // Загружаем реальные компании напрямую из type 1155 со статусом "Портфель"
    const projectRows = await getProjects({ statusId: STATUS_PORTFOLIO })

    const subfundById = { '1096': 'БАС', '1098': 'РОБО', '1100': 'МЭ', '7283': 'AI/Tech' }
    const stageById   = { '1102': 'Pre-seed', '1103': 'Посевная', '1104': 'Раунд A', '1105': 'Раунд B', '1106': 'Раунд C' }

    companies.value = projectRows.map(row => ({
      id:        row.id,
      name:      row.name,
      inn:       row.inn || '',
      subfund:   subfundById[String(row.subfundId)] || '—',
      stage:     stageById[String(row.stageId)] || '—',
      health:    50,
      riskLevel: 'green',
      revenue:   0,
      runway:    0,
      trl:       row.trl || 0,
      headcount: row.employees || 0,
      invested:  row.amount || 0,
      nav:       0,
      fstShare:  0,
      kpis:      [{ name: 'TRL', actual: row.trl || 0, target: (row.trl || 0) + 1, unit: 'уровень' }],
      aiReport:  null,
      updatedAt: null,
      alerts:    [],
      sensors:   [],
      events:    [],
    }))
    lastUpdate.value = new Date().toLocaleTimeString('ru-RU')
    toast.add({ severity: 'success', summary: 'Данные загружены из fst', life: 2000 })
  } catch (err) {
    console.warn('fstApi.getPortfolio failed, using mock data:', err.message)
  } finally {
    portfolioLoading.value = false
  }
}

onMounted(() => {
  liveTimer = setInterval(() => {
    liveColor.value = liveColor.value === 'var(--fst-green)' ? 'var(--fst-green-dark)' : 'var(--fst-green)'
    lastUpdate.value = new Date().toLocaleTimeString('ru-RU')
  }, 3000)
  loadPortfolioFromDb()
})

onUnmounted(() => clearInterval(liveTimer))

// ─── Filters ─────────────────────────────────────────────────────────────────
const filterSubfund = ref(null)
const filterStatus = ref(null)
const searchQuery = ref('')
const subfundOptions = [null, 'БАС', 'РОБО', 'МЭ']
const statusOptions = [null, 'Зелёный', 'Жёлтый', 'Красный']

// ─── Portfolio data ───────────────────────────────────────────────────────────
const companies = ref([])

const selectedCompany = ref(null)
const refreshing = ref(false)
const sourcesLoading = ref(false)
const aiReportLoading = ref(false)
const aiReport = ref(null)
const showAddDialog = ref(false)

// ─── Data sources ─────────────────────────────────────────────────────────────
const dataSources = ref([
  { id: 'egrul', name: 'ЕГРЮЛ / ФНС', icon: 'pi pi-building', status: 'ok', lastUpdate: '2026-03-05 08:00' },
  { id: 'efrsb', name: 'ЕФРСБ (банкротства)', icon: 'pi pi-exclamation-circle', status: 'ok', lastUpdate: '2026-03-05 08:00' },
  { id: 'rosreestr', name: 'Роспатент', icon: 'pi pi-key', status: 'ok', lastUpdate: '2026-03-04 16:00' },
  { id: 'hh', name: 'HH.ru (найм)', icon: 'pi pi-users', status: 'warn', lastUpdate: '2026-03-03 12:00' },
  { id: 'news', name: 'Новостной мониторинг', icon: 'pi pi-globe', status: 'ok', lastUpdate: '2026-03-05 10:00' },
  { id: 'crm', name: 'Отчёты компании (Integram)', icon: 'pi pi-database', status: 'ok', lastUpdate: '2026-03-01 09:00' },
])

// При изменении списка компаний (после loadPortfolioFromDb) инициализируем их ленты
watch(companies, (list) => {
  for (const c of list) {
    const k = `company:${c.id}`
    if (!eventStore.timelines[k]) {
      ensureCompanyTimeline(c)
    }
  }
}, { deep: false })

// ─── Computed ─────────────────────────────────────────────────────────────────
const filteredCompanies = computed(() => {
  return companies.value.filter(c => {
    if (filterSubfund.value && c.subfund !== filterSubfund.value) return false
    if (filterStatus.value) {
      const map = { 'Зелёный': 'green', 'Жёлтый': 'yellow', 'Красный': 'red' }
      if (c.riskLevel !== map[filterStatus.value]) return false
    }
    if (searchQuery.value && !c.name.toLowerCase().includes(searchQuery.value.toLowerCase())) return false
    return true
  })
})

const activeCount = computed(() => companies.value.filter(c => c.riskLevel !== 'dead').length)
const alertCount = computed(() => companies.value.filter(c => c.riskLevel === 'red' || c.riskLevel === 'yellow').length)
const totalInvested = computed(() => companies.value.reduce((s, c) => s + (c.invested || 0), 0))
const avgHealth = computed(() => {
  if (!companies.value.length) return 0
  return Math.round(companies.value.reduce((s, c) => s + (liveHealthScores.value[c.id] || c.health || 50), 0) / companies.value.length)
})
const portfolioMetrics = computed(() => [
  { icon: 'pi pi-building',            val: activeCount.value,              label: 'Активных компаний', color: 'var(--fst-green)'  },
  { icon: 'pi pi-exclamation-triangle', val: alertCount.value,              label: 'Предупреждений',    color: alertCount.value > 0 ? 'var(--fst-brand)' : 'var(--p-text-muted-color)' },
  { icon: 'pi pi-chart-bar',           val: totalInvested.value + ' млн',  label: 'Инвестировано',     color: 'var(--fst-blue)'   },
  { icon: 'pi pi-heart',               val: avgHealth.value + '%',          label: 'Ср. health',        color: 'var(--fst-purple)' },
])
const criticalAlerts = computed(() => companies.value
  .filter(c => c.riskLevel === 'red')
  .map(c => ({ company: c.name }))
)

// ─── Helpers ──────────────────────────────────────────────────────────────────
function riskColor(level) {
  if (level === 'green') return 'var(--fst-green)'
  if (level === 'yellow') return 'var(--fst-brand)'
  if (level === 'red') return 'var(--fst-red)'
  return 'var(--p-text-muted-color)'
}

function riskLabel(level) {
  if (level === 'green') return 'Норма'
  if (level === 'yellow') return 'Предупреждение'
  if (level === 'red') return 'Критично'
  return 'Неизвестно'
}

function runwayColor(months) {
  if (months >= 12) return 'var(--fst-green)'
  if (months >= 6) return 'var(--fst-brand)'
  return 'var(--fst-red)'
}

function kpiColor(kpi) {
  const pct = kpi.actual / kpi.target
  if (pct >= 0.9) return 'var(--fst-green)'
  if (pct >= 0.6) return 'var(--fst-brand)'
  return 'var(--fst-red)'
}

function sensorColor(level) {
  if (level === 'ok') return 'var(--fst-green)'
  if (level === 'warn') return 'var(--fst-brand)'
  if (level === 'critical') return 'var(--fst-red)'
  return 'var(--p-text-muted-color)'
}

function sensorSeverity(level) {
  if (level === 'ok') return 'success'
  if (level === 'warn') return 'warn'
  if (level === 'critical') return 'danger'
  return 'secondary'
}

function alertIcon(type) {
  const icons = { runway: 'pi pi-clock', revenue: 'pi pi-chart-line', hiring: 'pi pi-users', ip: 'pi pi-key' }
  return icons[type] || 'pi pi-exclamation-triangle'
}

function eventColor(type) {
  const colors = { Контракт: 'var(--fst-blue)', IP: 'var(--fst-purple)', Найм: 'var(--fst-cyan)', Финансы: 'var(--fst-green)', Риск: 'var(--fst-red)', PR: 'var(--fst-brand)' }
  return colors[type] || 'var(--p-text-muted-color)'
}

async function selectCompany(c) {
  selectedCompany.value = c
  aiReport.value = null
  await ensureCompanyTimeline(c)
}

async function refreshAll() {
  refreshing.value = true
  await new Promise(r => setTimeout(r, 1500))
  lastUpdate.value = new Date().toLocaleTimeString('ru-RU')
  refreshing.value = false
  toast.add({ severity: 'success', summary: 'Обновлено', detail: 'Данные из всех источников актуализированы', life: 2500 })
}

async function refreshSources() {
  sourcesLoading.value = true
  await new Promise(r => setTimeout(r, 1000))
  sourcesLoading.value = false
  toast.add({ severity: 'info', summary: 'Источники обновлены', life: 2000 })
}

const router    = useRouter()
const projStore = useProjectStore()

function callCommittee() {
  toast.add({ severity: 'warn', summary: 'ИК созывается', detail: 'Уведомление отправлено членам Инвестиционного Комитета', life: 3500 })
}

function openProjectHub(company) {
  projStore.setActive({
    id:          company.id,
    name:        company.name,
    company:     company.name,
    subfund:     company.subfund,
    trl:         company.trl,
    stage:       company.stage,
    inn:         company.inn,
    _source:     'portfolio',
  })
  router.push('/fst-project/' + company.id)
}

async function generateAiReport() {
  if (!selectedCompany.value) return
  aiReportLoading.value = true
  await new Promise(r => setTimeout(r, 2000))
  const c = selectedCompany.value
  aiReport.value = [
    {
      title: 'Сильные стороны',
      icon: 'pi pi-check-circle',
      color: 'var(--fst-green)',
      points: [
        `TRL ${c.trl} — технологическая готовность на уровне рынка`,
        `Команда ${c.headcount} чел. соответствует стадии`,
        c.revenue > 10 ? `Выручка ${c.revenue} млн ₽ — признак рыночного спроса` : `Первые LOI подтверждают рыночный интерес`,
      ]
    },
    {
      title: 'Ключевые риски',
      icon: 'pi pi-exclamation-triangle',
      color: 'var(--fst-brand)',
      points: c.riskLevel === 'red'
        ? ['Runway критически низкий — срочный транш или реструктуризация', 'Отсутствие выручки создаёт риск дефолта', 'Необходимо экстренное заседание ИК']
        : c.riskLevel === 'yellow'
        ? ['Runway ниже комфортного уровня (9 мес.)', 'Выручка отстаёт от плана на 40%+', 'Рекомендуется досрочное рассмотрение транша 2']
        : ['Регуляторные задержки могут сдвинуть TRL-рост', 'Усиление конкуренции в нише', 'Риск потери ключевого сотрудника (основатель)'],
    },
    {
      title: 'Рекомендации ФСТ',
      icon: 'pi pi-lightbulb',
      color: 'var(--fst-blue)',
      points: c.riskLevel === 'red'
        ? ['Созвать экстренный ИК в течение 5 рабочих дней', 'Рассмотреть bridge-финансирование или реструктуризацию', 'Запросить план антикризисных мер от команды']
        : c.riskLevel === 'yellow'
        ? ['Разблокировать транш 2 при подтверждении KPI', 'Провести квартальный ревью с командой', 'Усилить менторскую поддержку ФСТ по продажам']
        : ['Поддержать выход на Раунд A в Q3 2026', 'Рекомендовать стратегическим партнёрам ФСТ', 'Рассмотреть рефинансирование при росте > 3x'],
    },
    {
      title: 'Прогноз',
      icon: 'pi pi-chart-line',
      color: 'var(--fst-purple)',
      points: [
        `Вероятность выживания 12 мес.: ${c.riskLevel === 'red' ? '35%' : c.riskLevel === 'yellow' ? '68%' : '91%'}`,
        `Целевой MOIC: ${c.riskLevel === 'red' ? '0-1x (риск списания)' : c.riskLevel === 'yellow' ? '2-3x (при стабилизации)' : '4-6x (позитивный сценарий)'}`,
        `Ожидаемый выход: ${c.stage === 'Pre-seed' ? '2029-2030' : c.stage === 'Посевная' ? '2028-2029' : '2027-2028'}`,
      ]
    }
  ]
  aiReportLoading.value = false
}
</script>

<style scoped>
/* ─── Topbar ─── */
.fsp-title-group {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: var(--p-text-color);
}
.fsp-live-dot { font-size: 8px; }
.fsp-fund-name { font-size: 14px; }
.fsp-tag { font-size: 11px !important; }
.fsp-updated {
  font-size: 10px;
  color: var(--p-text-muted-color);
  margin-top: 2px;
}

/* ─── Metrics strip ─── */
.fsp-metrics {
  margin: -20px -20px 0;           /* flush to FstPageLayout body edges */
  border-bottom: 1px solid var(--p-content-border-color);
}

/* ─── Filters bar ─── */
.fsp-filter-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 0;
  flex-wrap: wrap;
}
.fsp-filter-sel { width: 130px; }
.fsp-search-wrap { position: relative; display: flex; align-items: center; }
.fsp-search-wrap i { position: absolute; left: 8px; }
.fsp-search { padding-left: 26px !important; width: 180px; }

/* ─── Section label ─── */
.fsp-companies-label { margin-bottom: 10px; }

/* ─── Body ─── */
.fsp-body {
  display: grid;
  grid-template-columns: 1fr 380px;
  gap: 0;
  min-height: 0;
  border: 1px solid var(--p-content-border-color);
  border-radius: 8px;
  overflow: hidden;
}

/* Companies section */
.fsp-companies {
  overflow-y: auto;
  padding: 12px;
}

/* Alert banner */
.fsp-alert-banner {
  display: flex;
  align-items: center;
  gap: 10px;
  background: color-mix(in srgb, var(--fst-red) 12%, transparent);
  border: 1px solid color-mix(in srgb, var(--fst-red) 40%, transparent);
  border-radius: 8px;
  padding: 10px 14px;
  margin-bottom: 12px;
  font-size: 12px;
  color: var(--p-text-color);
  flex-wrap: wrap;
}

/* Cards grid */
.fsp-cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 10px;
}

/* Card */
.fsp-card {
  background: transparent;
  border: 1px solid var(--p-content-border-color);
  border-radius: 8px;
  padding: 12px;
  cursor: pointer;
  transition: all 0.15s;
  position: relative;
}
.fsp-card:hover { border-color: var(--p-primary-color); }
.fsp-card.selected { border-color: var(--p-primary-color); box-shadow: 0 0 0 2px color-mix(in srgb, var(--p-primary-color) 20%, transparent); }
.fsp-card.risk-red    { border-left: 3px solid var(--fst-red);   }
.fsp-card.risk-yellow { border-left: 3px solid var(--fst-brand); }
.fsp-card.risk-green  { border-left: 3px solid var(--fst-green); }

.fsp-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
}
.fsp-card-name {
  font-weight: 600;
  font-size: 13px;
  color: var(--p-text-color);
}
.fsp-card-badges { display: flex; align-items: center; gap: 6px; }
.fsp-traffic-light {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}
.fsp-card-stage {
  font-size: 11px;
  color: var(--p-text-muted-color);
  margin-bottom: 8px;
}
.fsp-card-metrics {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 4px;
  margin-bottom: 8px;
}
.fsp-card-metric { text-align: center; }
.fsp-m-label { font-size: 9px; color: var(--p-text-muted-color); display: block; }
.fsp-m-val { font-size: 13px; font-weight: 600; }

.fsp-health-bar-wrap {
  height: 6px;
  background: var(--p-content-border-color);
  border-radius: 3px;
  overflow: hidden;
  position: relative;
  margin-bottom: 6px;
}
.fsp-health-bar { height: 100%; border-radius: 3px; transition: width 0.5s; }
.fsp-health-val {
  position: absolute;
  right: 0;
  top: -14px;
  font-size: 10px;
  color: var(--p-text-muted-color);
}

.fsp-card-alerts { display: flex; flex-direction: column; gap: 3px; }
.fsp-card-alert {
  font-size: 10px;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 2px 4px;
  border-radius: 3px;
}
.fsp-card-alert.warn   { background: color-mix(in srgb, var(--fst-brand) 12%, transparent); color: var(--fst-brand); }
.fsp-card-alert.danger { background: color-mix(in srgb, var(--fst-red)   12%, transparent); color: var(--fst-red);   }

/* Detail panel */
.fsp-detail {
  border-left: 1px solid var(--p-content-border-color);
  overflow-y: auto;
  padding: 12px;
  background: var(--p-surface-ground);
}
.fsp-detail-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: var(--p-text-muted-color);
  font-size: 13px;
  min-height: 200px;
}

.fsp-detail-panel {
  background: transparent;
  border: 1px solid var(--p-content-border-color);
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 10px;
}
.fsp-detail-panel-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  font-weight: 600;
  color: var(--p-text-color);
  margin-bottom: 10px;
  padding-bottom: 6px;
  border-bottom: 1px solid var(--p-content-border-color);
}

.fsp-detail-company-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 12px;
}
.fsp-detail-name { font-size: 14px; font-weight: 700; color: var(--p-text-color); }
.fsp-detail-sub { font-size: 11px; color: var(--p-text-muted-color); margin-top: 2px; }
.fsp-detail-health-badge {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
  color: white;
  flex-shrink: 0;
}

/* KPI progress */
.fsp-kpi-section { display: flex; flex-direction: column; gap: 6px; }
.fsp-kpi-row { display: flex; align-items: center; gap: 8px; }
.fsp-kpi-label { font-size: 11px; color: var(--p-text-muted-color); width: 80px; flex-shrink: 0; }
.fsp-kpi-bar-wrap {
  flex: 1;
  height: 6px;
  background: var(--p-content-border-color);
  border-radius: 3px;
  overflow: hidden;
}
.fsp-kpi-bar { height: 100%; border-radius: 3px; transition: width 0.5s; }
.fsp-kpi-nums { font-size: 11px; width: 90px; text-align: right; flex-shrink: 0; }

/* Sources */
.fsp-sources-grid { display: flex; flex-direction: column; gap: 6px; }
.fsp-source {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 8px;
  border-radius: 6px;
  background: var(--p-surface-ground);
}
.fsp-source-icon { font-size: 14px; color: var(--p-text-muted-color); width: 20px; }
.fsp-source-info { flex: 1; }
.fsp-source-name { font-size: 12px; color: var(--p-text-color); }
.fsp-source-last { font-size: 10px; color: var(--p-text-muted-color); }

/* Sensors */
.fsp-risk-sensors { display: flex; flex-direction: column; gap: 6px; }
.fsp-sensor {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 8px;
  border-radius: 6px;
  background: var(--p-surface-ground);
}
.fsp-sensor-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.fsp-sensor-info { flex: 1; }
.fsp-sensor-name { font-size: 11px; font-weight: 600; color: var(--p-text-color); }
.fsp-sensor-msg { font-size: 10px; color: var(--p-text-muted-color); }

/* Events */
.fsp-events { display: flex; flex-direction: column; gap: 6px; }
.fsp-tl-count { background: var(--p-primary-color); color:white; border-radius:10px; padding:0 5px; font-size:10px; }
.fsp-add-event-dialog { margin-top:0.6rem; padding:0.6rem; background:var(--p-surface-ground); border-radius:8px; border:1px solid var(--p-content-border-color); }
.fsp-aed-title { font-size:0.78rem; font-weight:600; color:var(--p-text-color); margin-bottom:0.4rem; }
.fsp-event {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 5px 0;
  border-bottom: 1px solid var(--p-content-border-color);
}
.fsp-event:last-child { border-bottom: none; }
.fsp-event-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.fsp-event-body { flex: 1; }
.fsp-event-title { font-size: 12px; color: var(--p-text-color); }
.fsp-event-date { font-size: 10px; color: var(--p-text-muted-color); }

/* AI Report */
.fsp-ai-report { display: flex; flex-direction: column; gap: 10px; }
.fsp-ai-section {}
.fsp-ai-section-title {
  font-size: 12px;
  font-weight: 600;
  margin-bottom: 4px;
  display: flex;
  align-items: center;
  gap: 6px;
}
.fsp-ai-list {
  margin: 0;
  padding-left: 18px;
}
.fsp-ai-list li { font-size: 11px; color: var(--p-text-color); line-height: 1.6; }
.fsp-ai-empty {
  display: flex;
  justify-content: center;
  padding: 12px;
}

/* Nav */
.fsp-detail-nav {
  display: flex;
  gap: 8px;
  justify-content: center;
}

@media (max-width: 900px) {
  .fsp-body { grid-template-columns: 1fr !important; }
  .fsp-detail { border-left: none; border-top: 1px solid var(--p-content-border-color); }
  .fsp-right { max-height: 50vh; overflow-y: auto; border-left: none; border-top: 1px solid var(--p-content-border-color); }
  .fsp-filter-bar { flex-wrap: wrap; gap: 6px; }
  .fsp-filter-sel, .fsp-search { width: 100% !important; }

  /* Hide empty detail placeholder on mobile — show only when company selected */
  .fsp-detail-empty { display: none; }

  /* Toolbar buttons — scrollable row */
  .fsp-toolbar-actions {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    flex-wrap: nowrap;
    gap: 4px;
  }
  .fsp-toolbar-actions .p-button {
    flex-shrink: 0;
    font-size: 0.8rem;
    padding: 0.375rem 0.5rem;
  }
}

/* ─── GR-badge ─── */
.fsp-card-footer-actions { display: flex; justify-content: flex-end; margin-top: 4px; }
.fsp-hist-btn {
  background: none; border: 1px solid var(--p-content-border-color); border-radius: 6px;
  padding: 2px 8px; font-size: 10px; color: var(--p-text-muted-color); cursor: pointer;
  display: flex; align-items: center; gap: 4px; transition: background .15s, color .15s;
}
.fsp-hist-btn:hover { background: var(--p-surface-ground); color: var(--p-text-color); }

.fsp-gr-badge {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 9px;
  padding: 3px 6px;
  background: var(--p-surface-card);
  border: 1px solid var(--p-content-border-color);
  border-radius: 6px;
  margin-top: 4px;
  flex-wrap: wrap;
}
.fsp-gr-label { color: var(--p-text-muted-color); font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; }
.fsp-gr-funded  { color: var(--fst-green); font-weight: 700; }
.fsp-gr-applied { color: var(--fst-brand); font-weight: 700; }
.fsp-gr-next { color: var(--p-primary-color); max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fsp-gr-empty { color: var(--p-text-muted-color); font-style: italic; }
</style>
