<template>
  <FstPageLayout>
    <!-- Header -->
    <template #header>
      <div class="fsp-header-left">
        <div class="fsp-logo">
          <i class="pi pi-chart-scatter" style="color:#42a5f5;font-size:20px"></i>
          <span>ФСТ НТИ · <b>Портфельный монитор</b></span>
          <Tag :value="`${activeCount} активных`" severity="success" style="font-size:11px" />
          <Tag :value="`${alertCount} предупреждений`" :severity="alertCount > 0 ? 'warn' : 'secondary'" style="font-size:11px" />
        </div>
        <div class="fsp-updated">
          <i class="pi pi-circle-fill" :style="{ color: liveColor, fontSize:'8px' }"></i>
          Обновлено: {{ lastUpdate }} · Мониторинг {{ monitoringStatus }}
        </div>
      </div>
      <div class="fsp-header-center">
        <div class="fsp-filters">
          <Select v-model="filterSubfund" :options="subfundOptions" placeholder="Все субфонды" class="fsp-filter-sel" size="small" />
          <Select v-model="filterStatus" :options="statusOptions" placeholder="Все статусы" class="fsp-filter-sel" size="small" />
          <span class="fsp-search-wrap">
            <i class="pi pi-search" style="font-size:12px;color:var(--p-text-muted-color)" />
            <InputText v-model="searchQuery" placeholder="Поиск компании..." size="small" class="fsp-search" />
          </span>
        </div>
      </div>
      <div class="fsp-header-right">
        <LearnTooltip
          label="Обновить данные"
          what="Загружает актуальные данные по портфелю: KPI компаний, финансовые показатели, статусы рисков"
          when="Для получения последних данных от портфельных компаний"
          :terms="['Портфель', 'KPI', 'Мониторинг']"
        >
          <Button icon="pi pi-refresh" label="Обновить" size="small" severity="secondary" @click="refreshAll" :loading="refreshing" />
        </LearnTooltip>
        <LearnTooltip
          label="Добавить компанию"
          what="Добавляет новую портфельную компанию для мониторинга после закрытия сделки"
          when="После подписания Term Sheet и получения первого транша"
          :terms="['Портфельная компания', 'Транш', 'Постинвест-мониторинг']"
        >
          <Button icon="pi pi-plus" label="Добавить" size="small" severity="success" @click="showAddDialog = true" />
        </LearnTooltip>
        <LearnTooltip
          label="Цифровой двойник фонда"
          what="Переход к макро-симуляции всего фонда: NAV, IRR, субфонды, сценарии"
          when="Для оценки общего состояния и прогнозирования портфеля"
          :terms="['NAV', 'IRR', 'Цифровой двойник', 'Субфонд']"
        >
          <Button icon="pi pi-building" label="ЦД Фонда" size="small" severity="secondary" text @click="$router.push('/fst-fund')" />
        </LearnTooltip>
      </div>
    </template>

    <!-- Portfolio Grid -->
    <div class="fsp-body">

      <!-- Left: Company Cards -->
      <div class="fsp-companies">

        <!-- Alert banner -->
        <div v-if="criticalAlerts.length" class="fsp-alert-banner">
          <i class="pi pi-exclamation-triangle" style="color:#ef5350;font-size:14px"></i>
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
                <Tag :value="c.subfund" style="font-size:10px;background:#1565c0;color:#fff" />
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
                <span class="fsp-m-val" :style="{ color: '#66bb6a' }">{{ c.revenue }} млн</span>
              </div>
              <div class="fsp-card-metric">
                <span class="fsp-m-label">Runway</span>
                <span class="fsp-m-val" :style="{ color: runwayColor(c.runway) }">{{ c.runway }} мес</span>
              </div>
              <div class="fsp-card-metric">
                <span class="fsp-m-label">TRL</span>
                <span class="fsp-m-val" :style="{ color: '#42a5f5' }">{{ c.trl }}</span>
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
            <i class="pi pi-database" style="color:#ffa726"></i> Источники данных
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
                  :style="{ color: src.status === 'ok' ? '#66bb6a' : src.status === 'warn' ? '#ffa726' : '#ef5350' }" />
              </div>
            </div>
          </div>
        </div>

        <!-- Risk Sensors -->
        <div class="fsp-detail-panel">
          <div class="fsp-detail-panel-title">
            <i class="pi pi-shield" style="color:#ef5350"></i> Датчики рисков
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
            <i class="pi pi-history" style="color:#26c6da"></i> Лента событий
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
                   :style="{ fontSize: '9px', background: ev.color || '#42a5f5', color: '#fff', maxWidth:'90px', overflow:'hidden' }" />
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
            <i class="pi pi-brain" style="color:#ab47bc"></i> AI Еженедельный отчёт
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
import FstPageLayout from '@/components/fst-shared/FstPageLayout.vue'
import Button from 'primevue/button'
import Tag from 'primevue/tag'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import { useToast } from 'primevue/usetoast'
import { getPortfolio, getProjects } from '@/services/fstApi'
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
  for (const company of PORTFOLIO) {
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
  const company = PORTFOLIO.find(c => c.id === selectedCompanyId.value)
  // Build portfolio ontology context for all companies
  const companiesData = PORTFOLIO.map(c => ({
    entityType: 'company',
    entityId: String(c.id),
    timeline: eventStore.getTimeline('company', String(c.id)),
    state: { name: c.name, health: c.health }
  }))
  return {
    module: 'Портфель компаний',
    selectedCompany: company ? company.name : null,
    totalCompanies: PORTFOLIO.length,
    monitoringStatus: monitoringStatus.value,
    ontology: buildPortfolioContext(companiesData)
  }
}

// ─── Live indicator ───────────────────────────────────────────────────────────
const liveColor = ref('#66bb6a')
const lastUpdate = ref(new Date().toLocaleTimeString('ru-RU'))
const monitoringStatus = ref('активен')
let liveTimer = null

// ─── Загрузка из fst API ──────────────────────────────────────────────────────
const portfolioLoading = ref(false)

async function loadPortfolioFromDb() {
  portfolioLoading.value = true
  try {
    const [portfolioRows, projectRows] = await Promise.all([getPortfolio(), getProjects()])
    const projectMap = Object.fromEntries(projectRows.map(p => [p.id, p]))

    if (portfolioRows.length === 0) return  // оставить дефолтные моковые данные

    // Статус проекта → цвет риска (fst/1088: 1115=Новый, 1117=На рассмотрении ИК, 1119=Одобрен, 1125=В работе, 1127=Закрыт)
    const riskByStatus = { '1119': 'green', '1125': 'green', '1117': 'yellow', '1115': 'yellow', '1127': 'red' }
    const subfundById  = { '1096': 'БАС', '1098': 'РОБО', '1100': 'МЭ' }
    const stageById    = { '1102': 'Pre-seed', '1103': 'Посевная', '1104': 'Раунд A', '1105': 'Раунд B', '1106': 'Раунд C' }

    companies.value = portfolioRows.map((row, idx) => {
      const project   = projectMap[row.projectId] || {}
      // Субфонд: сначала из портфельной записи, потом из проекта
      const subfund   = row.subfund || subfundById[String(project.subfundId)] || 'БАС'
      const stage     = row.stage  || stageById[String(project.stageId)]    || '—'
      // riskLevel: из JSON метрик (приоритет) → из статуса проекта
      const riskLevel = row.riskLevel || riskByStatus[String(row.riskStatusId)] || 'green'

      // Базовые KPI из метрик (уже распарсены в getPortfolio())
      const kpis = [
        { name: 'Выручка',    actual: row.revenue    || 0,  target: Math.round((row.revenue    || 0) * 1.3), unit: 'млн ₽' },
        { name: 'TRL',        actual: row.trl        || 0,  target: (row.trl || 0) + 1,                     unit: 'уровень' },
        { name: 'Сотрудники', actual: row.headcount  || 0,  target: Math.round((row.headcount  || 0) * 1.2), unit: 'чел.' },
        { name: 'Runway',     actual: row.runway     || 0,  target: 12,                                     unit: 'мес.' },
      ]

      // Дополняем моковыми данными для полей, которых нет в БД (alerts, sensors, events)
      const mockBase = companies.value.find(c => c.name === row.name) || companies.value[idx % companies.value.length] || {}
      return {
        ...mockBase,
        id:       row.id,
        name:     row.name,
        inn:      row.inn      || mockBase.inn      || '',
        subfund,
        stage,
        health:   row.health   || row.kpi || mockBase.health || 50,
        riskLevel,
        revenue:  row.revenue  || mockBase.revenue  || 0,
        runway:   row.runway   || mockBase.runway   || 0,
        trl:      row.trl      || mockBase.trl      || 0,
        headcount: row.headcount || mockBase.headcount || 0,
        invested: row.invested || 0,
        nav:      row.nav      || 0,
        fstShare: row.fstShare || 0,
        kpis:     kpis,
        aiReport: row.aiReport || mockBase.aiReport || null,
        updatedAt: row.updatedAt || null,
      }
    })
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
    liveColor.value = liveColor.value === '#66bb6a' ? '#388e3c' : '#66bb6a'
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
const companies = ref([
  {
    id: 1, name: 'АвиаЛогик', inn: '7701234567', subfund: 'БАС', stage: 'Посевная',
    health: 78, riskLevel: 'green', revenue: 18, runway: 14, trl: 6, headcount: 11,
    kpis: [
      { name: 'Выручка', actual: 18, target: 20, unit: 'млн ₽' },
      { name: 'TRL', actual: 6, target: 7, unit: 'уровень' },
      { name: 'Сотрудники', actual: 11, target: 12, unit: 'чел.' },
      { name: 'Патенты', actual: 2, target: 2, unit: 'шт.' },
      { name: 'Контракты', actual: 1, target: 1, unit: 'шт.' },
    ],
    alerts: [],
    sensors: [
      { type: 'egrul', name: 'ЕГРЮЛ', msg: 'Без изменений. Директор: Иванов А.Р.', level: 'ok' },
      { type: 'patents', name: 'Патенты', msg: '2 патента зарегистрированы. Новых заявок нет.', level: 'ok' },
      { type: 'hiring', name: 'Найм (HH.ru)', msg: '3 открытые вакансии. Динамика: +1 чел/мес.', level: 'ok' },
      { type: 'runway', name: 'Runway', msg: '14 мес. остатка. Выше порога 6 мес.', level: 'ok' },
      { type: 'contracts', name: 'Контракты', msg: '1 контракт (ФГУП Росаэронавигация)', level: 'ok' },
      { type: 'news', name: 'Новости', msg: 'Нейтральный сентимент. 3 публикации за месяц.', level: 'ok' },
      { type: 'regulatory', name: 'Регуляторика', msg: 'Сертификация БПЛА — в процессе (Росавиация)', level: 'warn' },
      { type: 'tech', name: 'Технологии', msg: 'TRL 6 подтверждён лабораторными испытаниями', level: 'ok' },
    ],
    events: [
      { id: 1, title: 'Первый контракт с ФГУП Росаэронавигация', date: '2026-02-15', type: 'Контракт' },
      { id: 2, title: 'Патент № 2026-АЛ-001 зарегистрирован', date: '2026-01-28', type: 'IP' },
      { id: 3, title: 'Команда расширена до 11 человек', date: '2026-01-10', type: 'Найм' },
      { id: 4, title: 'Транш 1 (15 млн ₽) выплачен', date: '2025-12-01', type: 'Финансы' },
    ],
  },
  {
    id: 2, name: 'МикроСхема', inn: '7705551234', subfund: 'МЭ', stage: 'Раунд A',
    health: 45, riskLevel: 'yellow', revenue: 42, runway: 7, trl: 7, headcount: 28,
    kpis: [
      { name: 'Выручка', actual: 42, target: 80, unit: 'млн ₽' },
      { name: 'TRL', actual: 7, target: 8, unit: 'уровень' },
      { name: 'Сотрудники', actual: 28, target: 35, unit: 'чел.' },
      { name: 'Контракты', actual: 2, target: 5, unit: 'шт.' },
      { name: 'Локализация', actual: 65, target: 80, unit: '%' },
    ],
    alerts: [
      { type: 'runway', severity: 'warn', msg: 'Runway < 9 мес. Требуется транш 2.' },
      { type: 'revenue', severity: 'warn', msg: 'Выручка 53% от плана Q1' },
    ],
    sensors: [
      { type: 'egrul', name: 'ЕГРЮЛ', msg: 'Без изменений', level: 'ok' },
      { type: 'patents', name: 'Патенты', msg: '5 патентов. При TRL 7 ожидается 7+', level: 'warn' },
      { type: 'hiring', name: 'Найм (HH.ru)', msg: 'Найм замедлился. -2 вакансии за месяц.', level: 'warn' },
      { type: 'runway', name: 'Runway', msg: '7 мес. — ниже порога 9 мес.', level: 'warn' },
      { type: 'contracts', name: 'Контракты', msg: '2 контракта из 5 по плану', level: 'warn' },
      { type: 'news', name: 'Новости', msg: 'Нейтральный сентимент', level: 'ok' },
      { type: 'regulatory', name: 'Регуляторика', msg: 'Сертификация завершена по 3 компонентам', level: 'ok' },
      { type: 'tech', name: 'Технологии', msg: 'TRL 7 подтверждён. Масштабирование Q2.', level: 'ok' },
    ],
    events: [
      { id: 1, title: 'Runway опустился ниже 9 мес.', date: '2026-03-01', type: 'Риск' },
      { id: 2, title: 'Контракт с Роснано подписан', date: '2026-02-20', type: 'Контракт' },
      { id: 3, title: 'Запрос на досрочный транш 2', date: '2026-03-04', type: 'Финансы' },
    ],
  },
  {
    id: 3, name: 'РоботАгро', inn: '5011900321', subfund: 'РОБО', stage: 'Pre-seed',
    health: 88, riskLevel: 'green', revenue: 5, runway: 20, trl: 4, headcount: 6,
    kpis: [
      { name: 'Выручка', actual: 5, target: 5, unit: 'млн ₽' },
      { name: 'TRL', actual: 4, target: 5, unit: 'уровень' },
      { name: 'Сотрудники', actual: 6, target: 6, unit: 'чел.' },
      { name: 'Пилоты', actual: 1, target: 2, unit: 'шт.' },
    ],
    alerts: [],
    sensors: [
      { type: 'egrul', name: 'ЕГРЮЛ', msg: 'Без изменений', level: 'ok' },
      { type: 'patents', name: 'Патенты', msg: '1 заявка на рассмотрении', level: 'ok' },
      { type: 'hiring', name: 'Найм (HH.ru)', msg: '2 вакансии инженеров', level: 'ok' },
      { type: 'runway', name: 'Runway', msg: '20 мес. Отлично.', level: 'ok' },
      { type: 'contracts', name: 'Контракты', msg: '1 пилот с агрохолдингом «АгроСеверо»', level: 'ok' },
      { type: 'news', name: 'Новости', msg: 'Позитивные публикации в АгроМедиа', level: 'ok' },
      { type: 'regulatory', name: 'Регуляторика', msg: 'Требования к агро-БПЛА — отсутствуют риски', level: 'ok' },
      { type: 'tech', name: 'Технологии', msg: 'TRL 4. Следующая веха: лётные испытания', level: 'ok' },
    ],
    events: [
      { id: 1, title: 'Подписан пилот с АгроСеверо', date: '2026-02-28', type: 'Контракт' },
      { id: 2, title: 'Патентная заявка подана в Роспатент', date: '2026-01-15', type: 'IP' },
      { id: 3, title: 'Транш 1 (8 млн ₽) выплачен', date: '2025-11-01', type: 'Финансы' },
    ],
  },
  {
    id: 4, name: 'АэроСпектр', inn: '7812345678', subfund: 'БАС', stage: 'Раунд A',
    health: 22, riskLevel: 'red', revenue: 12, runway: 4, trl: 6, headcount: 18,
    kpis: [
      { name: 'Выручка', actual: 12, target: 60, unit: 'млн ₽' },
      { name: 'TRL', actual: 6, target: 7, unit: 'уровень' },
      { name: 'Сотрудники', actual: 18, target: 25, unit: 'чел.' },
      { name: 'Контракты', actual: 0, target: 3, unit: 'шт.' },
    ],
    alerts: [
      { type: 'runway', severity: 'danger', msg: 'КРИТИЧНО: Runway 4 мес. Срочно нужен транш.' },
      { type: 'revenue', severity: 'danger', msg: 'Выручка 20% от плана. Риск дефолта.' },
    ],
    sensors: [
      { type: 'egrul', name: 'ЕГРЮЛ', msg: 'Изменение адреса юрлица 01.03.2026', level: 'warn' },
      { type: 'patents', name: 'Патенты', msg: '0 патентов при TRL 6 — критический риск IP', level: 'critical' },
      { type: 'hiring', name: 'Найм (HH.ru)', msg: 'Найм остановлен. Уволены 3 чел. за квартал.', level: 'critical' },
      { type: 'runway', name: 'Runway', msg: '4 мес. — КРИТИЧНО. Требуется срочный транш.', level: 'critical' },
      { type: 'contracts', name: 'Контракты', msg: '0 контрактов. Переговоры с ФКУ сорвались.', level: 'critical' },
      { type: 'news', name: 'Новости', msg: 'Негативный сентимент. 1 упоминание в связи со срывом гос.тендера', level: 'warn' },
      { type: 'regulatory', name: 'Регуляторика', msg: 'Отказ в сертификации Росавиации. Апелляция.', level: 'critical' },
      { type: 'tech', name: 'Технологии', msg: 'TRL 6 зафиксирован но не растёт 2+ кварталов', level: 'warn' },
    ],
    events: [
      { id: 1, title: 'КРИТИЧНО: Runway < 5 мес.', date: '2026-03-05', type: 'Риск' },
      { id: 2, title: 'Отказ Росавиации в сертификации', date: '2026-02-18', type: 'Риск' },
      { id: 3, title: 'Срыв тендера ФКУ на 30 млн ₽', date: '2026-02-10', type: 'Риск' },
      { id: 4, title: 'Уволены 3 ключевых инженера', date: '2026-01-20', type: 'Найм' },
    ],
  },
  {
    id: 5, name: 'НейроДрон', inn: '6670345678', subfund: 'БАС', stage: 'Посевная',
    health: 65, riskLevel: 'green', revenue: 8, runway: 16, trl: 5, headcount: 9,
    kpis: [
      { name: 'Выручка', actual: 8, target: 10, unit: 'млн ₽' },
      { name: 'TRL', actual: 5, target: 6, unit: 'уровень' },
      { name: 'Сотрудники', actual: 9, target: 10, unit: 'чел.' },
      { name: 'Патенты', actual: 1, target: 2, unit: 'шт.' },
    ],
    alerts: [],
    sensors: [
      { type: 'egrul', name: 'ЕГРЮЛ', msg: 'Без изменений', level: 'ok' },
      { type: 'patents', name: 'Патенты', msg: '1 патент. Новая заявка в очереди.', level: 'ok' },
      { type: 'hiring', name: 'Найм', msg: '2 вакансии. Активный поиск ML-инженера', level: 'ok' },
      { type: 'runway', name: 'Runway', msg: '16 мес. Норма', level: 'ok' },
      { type: 'contracts', name: 'Контракты', msg: 'LOI подписан с Аэрофлотом', level: 'ok' },
      { type: 'news', name: 'Новости', msg: 'Нейтральный сентимент', level: 'ok' },
      { type: 'regulatory', name: 'Регуляторика', msg: 'Без нарушений', level: 'ok' },
      { type: 'tech', name: 'Технологии', msg: 'TRL 5. Испытания Q2.', level: 'ok' },
    ],
    events: [
      { id: 1, title: 'LOI с Аэрофлотом подписан', date: '2026-02-25', type: 'Контракт' },
      { id: 2, title: 'Участие в форуме СберТех', date: '2026-02-10', type: 'PR' },
    ],
  },
])

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
const criticalAlerts = computed(() => companies.value
  .filter(c => c.riskLevel === 'red')
  .map(c => ({ company: c.name }))
)

// ─── Helpers ──────────────────────────────────────────────────────────────────
function riskColor(level) {
  if (level === 'green') return '#66bb6a'
  if (level === 'yellow') return '#ffa726'
  if (level === 'red') return '#ef5350'
  return '#78909c'
}

function riskLabel(level) {
  if (level === 'green') return 'Норма'
  if (level === 'yellow') return 'Предупреждение'
  if (level === 'red') return 'Критично'
  return 'Неизвестно'
}

function runwayColor(months) {
  if (months >= 12) return '#66bb6a'
  if (months >= 6) return '#ffa726'
  return '#ef5350'
}

function kpiColor(kpi) {
  const pct = kpi.actual / kpi.target
  if (pct >= 0.9) return '#66bb6a'
  if (pct >= 0.6) return '#ffa726'
  return '#ef5350'
}

function sensorColor(level) {
  if (level === 'ok') return '#66bb6a'
  if (level === 'warn') return '#ffa726'
  if (level === 'critical') return '#ef5350'
  return '#78909c'
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
  const colors = { Контракт: '#42a5f5', IP: '#ab47bc', Найм: '#26c6da', Финансы: '#66bb6a', Риск: '#ef5350', PR: '#ffa726' }
  return colors[type] || '#78909c'
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

function callCommittee() {
  toast.add({ severity: 'warn', summary: 'ИК созывается', detail: 'Уведомление отправлено членам Инвестиционного Комитета', life: 3500 })
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
      color: '#66bb6a',
      points: [
        `TRL ${c.trl} — технологическая готовность на уровне рынка`,
        `Команда ${c.headcount} чел. соответствует стадии`,
        c.revenue > 10 ? `Выручка ${c.revenue} млн ₽ — признак рыночного спроса` : `Первые LOI подтверждают рыночный интерес`,
      ]
    },
    {
      title: 'Ключевые риски',
      icon: 'pi pi-exclamation-triangle',
      color: '#ffa726',
      points: c.riskLevel === 'red'
        ? ['Runway критически низкий — срочный транш или реструктуризация', 'Отсутствие выручки создаёт риск дефолта', 'Необходимо экстренное заседание ИК']
        : c.riskLevel === 'yellow'
        ? ['Runway ниже комфортного уровня (9 мес.)', 'Выручка отстаёт от плана на 40%+', 'Рекомендуется досрочное рассмотрение транша 2']
        : ['Регуляторные задержки могут сдвинуть TRL-рост', 'Усиление конкуренции в нише', 'Риск потери ключевого сотрудника (основатель)'],
    },
    {
      title: 'Рекомендации ФСТ',
      icon: 'pi pi-lightbulb',
      color: '#42a5f5',
      points: c.riskLevel === 'red'
        ? ['Созвать экстренный ИК в течение 5 рабочих дней', 'Рассмотреть bridge-финансирование или реструктуризацию', 'Запросить план антикризисных мер от команды']
        : c.riskLevel === 'yellow'
        ? ['Разблокировать транш 2 при подтверждении KPI', 'Провести квартальный ревью с командой', 'Усилить менторскую поддержку ФСТ по продажам']
        : ['Поддержать выход на Раунд A в Q3 2026', 'Рекомендовать стратегическим партнёрам ФСТ', 'Рассмотреть рефинансирование при росте > 3x'],
    },
    {
      title: 'Прогноз',
      icon: 'pi pi-chart-line',
      color: '#ab47bc',
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
.fsp-root {
  background: var(--surface-ground);
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  font-family: var(--p-font-family);
}

/* Header */
.fsp-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  background: transparent;
  border-bottom: 1px solid var(--p-content-border-color);
  flex-shrink: 0;
  gap: 12px;
  flex-wrap: wrap;
}
.fsp-logo {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 14px;
  color: var(--p-text-color);
}
.fsp-updated {
  font-size: 10px;
  color: var(--p-text-muted-color);
  margin-top: 2px;
  display: flex;
  align-items: center;
  gap: 4px;
}
.fsp-filters {
  display: flex;
  align-items: center;
  gap: 8px;
}
.fsp-filter-sel { width: 130px; }
.fsp-search-wrap { position: relative; display: flex; align-items: center; }
.fsp-search-wrap i { position: absolute; left: 8px; }
.fsp-search { padding-left: 26px !important; width: 180px; }
.fsp-header-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* Body */
.fsp-body {
  display: grid;
  grid-template-columns: 1fr 380px;
  gap: 0;
  flex: 1;
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
  background: rgba(239, 83, 80, 0.12);
  border: 1px solid rgba(239, 83, 80, 0.4);
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
  border: 1px solid var(--surface-border);
  border-radius: 8px;
  padding: 12px;
  cursor: pointer;
  transition: all 0.15s;
  position: relative;
}
.fsp-card:hover { border-color: var(--p-primary-color); }
.fsp-card.selected { border-color: var(--p-primary-color); box-shadow: 0 0 0 2px rgba(var(--p-primary-rgb), 0.2); }
.fsp-card.risk-red { border-left: 3px solid #ef5350; }
.fsp-card.risk-yellow { border-left: 3px solid #ffa726; }
.fsp-card.risk-green { border-left: 3px solid #66bb6a; }

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
  background: var(--surface-border);
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
.fsp-card-alert.warn { background: rgba(255,167,38,0.12); color: #ffa726; }
.fsp-card-alert.danger { background: rgba(239,83,80,0.12); color: #ef5350; }

/* Detail panel */
.fsp-detail {
  border-left: 1px solid var(--surface-border);
  overflow-y: auto;
  padding: 12px;
  background: var(--surface-ground);
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
  border: 1px solid var(--surface-border);
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
  color: #fff;
  flex-shrink: 0;
}

/* KPI progress */
.fsp-kpi-section { display: flex; flex-direction: column; gap: 6px; }
.fsp-kpi-row { display: flex; align-items: center; gap: 8px; }
.fsp-kpi-label { font-size: 11px; color: var(--p-text-muted-color); width: 80px; flex-shrink: 0; }
.fsp-kpi-bar-wrap {
  flex: 1;
  height: 6px;
  background: var(--surface-border);
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
  background: var(--surface-ground);
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
  background: var(--surface-ground);
}
.fsp-sensor-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.fsp-sensor-info { flex: 1; }
.fsp-sensor-name { font-size: 11px; font-weight: 600; color: var(--p-text-color); }
.fsp-sensor-msg { font-size: 10px; color: var(--p-text-muted-color); }

/* Events */
.fsp-events { display: flex; flex-direction: column; gap: 6px; }
.fsp-tl-count { background: var(--p-primary-color); color:#fff; border-radius:10px; padding:0 5px; font-size:10px; }
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
  .fsp-detail { border-left: none; border-top: 1px solid var(--surface-border); }
  .fsp-right { max-height: 50vh; overflow-y: auto; border-left: none; border-top: 1px solid var(--surface-border); }
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
.fsp-gr-funded { color: #22c55e; font-weight: 700; }
.fsp-gr-applied { color: #f59e0b; font-weight: 700; }
.fsp-gr-next { color: var(--p-primary-color); max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fsp-gr-empty { color: var(--p-text-muted-color); font-style: italic; }
</style>
