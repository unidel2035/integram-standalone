<template>
  <FstPageLayout
    title="Portfolio Intelligence"
    subtitle="Еженедельный AI-отчёт по портфелю с анализом рисков и рыночной разведкой"
  >
    <Toast position="bottom-center" />

    <!-- Header -->
    <template #header>
      <div class="fsti-header-left">
        <div class="fsti-logo">
          <i class="pi pi-chart-line" style="color:var(--fst-purple);font-size:20px"></i>
          <span>ФСТ НТИ · <b>Portfolio Intelligence</b></span>
          <Tag v-if="latestReport" :value="`Отчёт #${reports.length}`" severity="info" style="font-size:11px" />
        </div>
        <div class="fsti-updated">
          <i class="pi pi-calendar" style="color:var(--p-text-muted-color);font-size:12px"></i>
          Последний отчёт: {{ lastReportDate }}
        </div>
      </div>
      <div class="fsti-header-right">
        <Button icon="pi pi-refresh" label="Обновить" size="small" severity="secondary" @click="loadReports" :loading="loading" />
        <Button icon="pi pi-sparkles" label="Генерировать отчёт" size="small" severity="success" @click="generateReport" :loading="generating" />
      </div>
    </template>

    <!-- Main Content -->
    <div class="fsti-body">

      <!-- Sidebar: Archive -->
      <div class="fsti-sidebar">
        <div class="fsti-sidebar-header">
          <span>Архив отчётов</span>
          <Tag :value="reports.length" severity="secondary" />
        </div>
        <div class="fsti-reports-list">
          <div v-for="r in reports" :key="r.id"
            :class="['fsti-report-item', { active: selectedReport?.id === r.id }]"
            @click="selectReport(r)">
            <div class="fsti-ri-header">
              <i class="pi pi-file-check" style="color:var(--fst-purple);font-size:12px"></i>
              <span class="fsti-ri-date">{{ formatDate(r.createdAt) }}</span>
            </div>
            <div class="fsti-ri-title">{{ r.title }}</div>
            <div class="fsti-ri-stats">
              <span v-if="r.risksCount > 0" class="fsti-stat-badge warn">
                <i class="pi pi-exclamation-triangle" style="font-size:9px"></i>
                {{ r.risksCount }} рисков
              </span>
              <span v-if="r.actionsCount > 0" class="fsti-stat-badge info">
                <i class="pi pi-list-check" style="font-size:9px"></i>
                {{ r.actionsCount }} действий
              </span>
            </div>
          </div>

          <div v-if="reports.length === 0" class="fsti-empty-list">
            <i class="pi pi-inbox" style="font-size:32px;color:var(--p-text-muted-color)"></i>
            <div>Отчёты не найдены</div>
            <div style="font-size:12px;color:var(--p-text-muted-color);margin-top:4px">
              Создайте первый отчёт
            </div>
          </div>
        </div>
      </div>

      <!-- Main Panel: Report View -->
      <div class="fsti-main">
        <div v-if="selectedReport" class="fsti-report">

          <!-- Report Header -->
          <div class="fsti-report-header">
            <h2>{{ selectedReport.title }}</h2>
            <div class="fsti-report-meta">
              <span><i class="pi pi-calendar"></i> {{ formatFullDate(selectedReport.createdAt) }}</span>
              <span><i class="pi pi-clock"></i> Сгенерировано автоматически</span>
            </div>
          </div>

          <!-- 1. Executive Digest -->
          <div class="fsti-section">
            <div class="fsti-section-title">
              <i class="pi pi-star-fill" style="color:var(--fst-brand)"></i>
              Обзор недели (Executive Digest)
            </div>
            <div class="fsti-digest">
              <div v-html="selectedReport.executiveDigest"></div>

              <div class="fsti-highlights">
                <div class="fsti-highlight-col">
                  <div class="fsti-highlight-label positive">
                    <i class="pi pi-arrow-up"></i> Топ-3 позитива
                  </div>
                  <ul>
                    <li v-for="(item, idx) in selectedReport.topPositives" :key="idx">{{ item }}</li>
                  </ul>
                </div>
                <div class="fsti-highlight-col">
                  <div class="fsti-highlight-label negative">
                    <i class="pi pi-arrow-down"></i> Топ-3 риска
                  </div>
                  <ul>
                    <li v-for="(item, idx) in selectedReport.topRisks" :key="idx">{{ item }}</li>
                  </ul>
                </div>
              </div>

              <div v-if="selectedReport.actionItems?.length" class="fsti-action-items">
                <div class="fsti-actions-header">
                  <i class="pi pi-list-check" style="color:var(--fst-purple)"></i>
                  Действия управляющего (Action Items)
                </div>
                <div v-for="(action, idx) in selectedReport.actionItems" :key="idx" class="fsti-action-item">
                  <Checkbox v-model="action.completed" binary />
                  <span>{{ action.text }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- 2. Companies at Risk -->
          <div class="fsti-section">
            <div class="fsti-section-title">
              <i class="pi pi-exclamation-triangle" style="color:var(--fst-red)"></i>
              Компании в зоне риска
            </div>
            <div class="fsti-risk-companies">
              <div v-for="c in selectedReport.riskCompanies" :key="c.id" class="fsti-risk-card">
                <div class="fsti-rc-header">
                  <div class="fsti-rc-name">{{ c.name }}</div>
                  <Tag :value="c.riskLevel" :severity="riskSeverity(c.riskLevel)" />
                </div>
                <div class="fsti-rc-metrics">
                  <span v-if="c.runway !== undefined" :class="['fsti-metric', { warn: c.runway < 6 }]">
                    Runway: {{ c.runway }} мес
                  </span>
                  <span v-if="c.trlStagnant">TRL не растёт {{ c.trlStagnantQuarters }}+ кв</span>
                  <span v-if="c.headcountDrop">Найм падает ({{ c.headcountDrop }})</span>
                </div>
                <div class="fsti-rc-recommendations">
                  <div class="fsti-rec-label">Рекомендуемые меры:</div>
                  <ul>
                    <li v-for="(rec, idx) in c.recommendations" :key="idx">{{ rec }}</li>
                  </ul>
                </div>
              </div>

              <div v-if="!selectedReport.riskCompanies?.length" class="fsti-empty-risks">
                <i class="pi pi-check-circle" style="font-size:32px;color:var(--fst-green)"></i>
                <div>Критических рисков не обнаружено</div>
              </div>
            </div>
          </div>

          <!-- 3. Market Intelligence -->
          <div class="fsti-section">
            <div class="fsti-section-title">
              <i class="pi pi-globe" style="color:var(--fst-blue)"></i>
              Рыночная разведка
            </div>
            <div class="fsti-market">

              <div class="fsti-market-subsection">
                <div class="fsti-market-subtitle">Новости в секторе БАС/РОБО/МЭ за неделю</div>
                <div class="fsti-news-list">
                  <div v-for="(news, idx) in selectedReport.marketNews" :key="idx" class="fsti-news-item">
                    <div class="fsti-news-date">{{ formatDate(news.date) }}</div>
                    <div class="fsti-news-title">{{ news.title }}</div>
                    <div class="fsti-news-summary">{{ news.summary }}</div>
                  </div>
                </div>
              </div>

              <div class="fsti-market-subsection">
                <div class="fsti-market-subtitle">Активность конкурентов портфельных компаний</div>
                <div v-if="selectedReport.competitorActivity?.length" class="fsti-competitor-list">
                  <div v-for="(comp, idx) in selectedReport.competitorActivity" :key="idx" class="fsti-comp-item">
                    <span class="fsti-comp-name">{{ comp.competitor }}</span>
                    <span class="fsti-comp-action">{{ comp.action }}</span>
                  </div>
                </div>
                <div v-else class="fsti-empty-section">Нет значимых событий</div>
              </div>

              <div class="fsti-market-subsection">
                <div class="fsti-market-subtitle">Новые нормативные акты и регуляторные изменения</div>
                <div v-if="selectedReport.regulatoryChanges?.length" class="fsti-regulatory-list">
                  <div v-for="(reg, idx) in selectedReport.regulatoryChanges" :key="idx" class="fsti-reg-item">
                    <i class="pi pi-file-edit" style="color:var(--fst-brand)"></i>
                    <div>
                      <div class="fsti-reg-title">{{ reg.title }}</div>
                      <div class="fsti-reg-impact">{{ reg.impact }}</div>
                    </div>
                  </div>
                </div>
                <div v-else class="fsti-empty-section">Нет новых регуляторных изменений</div>
              </div>
            </div>
          </div>

          <!-- 4. Next Week Forecast -->
          <div class="fsti-section">
            <div class="fsti-section-title">
              <i class="pi pi-calendar-plus" style="color:var(--fst-green)"></i>
              Прогноз на следующую неделю
            </div>
            <div class="fsti-forecast">

              <div class="fsti-forecast-subsection">
                <div class="fsti-forecast-subtitle">Ожидаемые KPI</div>
                <div class="fsti-kpi-list">
                  <div v-for="(kpi, idx) in selectedReport.expectedKPIs" :key="idx" class="fsti-kpi-item">
                    <span class="fsti-kpi-company">{{ kpi.company }}</span>
                    <span class="fsti-kpi-metric">{{ kpi.metric }}</span>
                    <span class="fsti-kpi-target">{{ kpi.target }}</span>
                  </div>
                </div>
              </div>

              <div class="fsti-forecast-subsection">
                <div class="fsti-forecast-subtitle">Транши к разблокировке</div>
                <div v-if="selectedReport.upcomingTranches?.length" class="fsti-tranches-list">
                  <div v-for="(t, idx) in selectedReport.upcomingTranches" :key="idx" class="fsti-tranche-item">
                    <span class="fsti-tranche-company">{{ t.company }}</span>
                    <span class="fsti-tranche-amount">{{ t.amount }} млн ₽</span>
                    <span class="fsti-tranche-condition">{{ t.condition }}</span>
                  </div>
                </div>
                <div v-else class="fsti-empty-section">Нет транжей на следующую неделю</div>
              </div>

              <div class="fsti-forecast-subsection">
                <div class="fsti-forecast-subtitle">Запланированные встречи</div>
                <div v-if="selectedReport.upcomingMeetings?.length" class="fsti-meetings-list">
                  <div v-for="(m, idx) in selectedReport.upcomingMeetings" :key="idx" class="fsti-meeting-item">
                    <div class="fsti-meeting-date">{{ formatDate(m.date) }}</div>
                    <div class="fsti-meeting-company">{{ m.company }}</div>
                    <div class="fsti-meeting-purpose">{{ m.purpose }}</div>
                  </div>
                </div>
                <div v-else class="fsti-empty-section">Нет запланированных встреч</div>
              </div>
            </div>
          </div>

        </div>

        <!-- Empty state -->
        <div v-else class="fsti-empty-main">
          <i class="pi pi-file-check" style="font-size:64px;color:var(--p-text-muted-color)"></i>
          <h3>Выберите отчёт из архива</h3>
          <p>или создайте новый еженедельный AI-отчёт</p>
          <Button icon="pi pi-sparkles" label="Генерировать отчёт" severity="success" @click="generateReport" :loading="generating" />
        </div>
      </div>
    </div>
  </FstPageLayout>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import FstPageLayout from '@/components/fst-shared/FstPageLayout.vue'
import Button from 'primevue/button'
import Tag from 'primevue/tag'
import Checkbox from 'primevue/checkbox'
import Toast from 'primevue/toast'
import { useToast } from 'primevue/usetoast'
import { getPortfolio, getProjects } from '@/services/fstApi'
import { generateWeeklyReport, getWeeklyReports } from '@/services/fstIntelligenceService'

const toast = useToast()

// ─── State ────────────────────────────────────────────────────────────────────
const loading = ref(false)
const generating = ref(false)
const reports = ref([])
const selectedReport = ref(null)

// ─── Computed ─────────────────────────────────────────────────────────────────
const latestReport = computed(() => reports.value[0] || null)
const lastReportDate = computed(() => {
  if (!latestReport.value) return 'Нет отчётов'
  return formatDate(latestReport.value.createdAt)
})

// ─── Load Reports ─────────────────────────────────────────────────────────────
async function loadReports() {
  loading.value = true
  try {
    const loadedReports = await getWeeklyReports()
    reports.value = loadedReports.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

    // Auto-select latest report
    if (reports.value.length > 0 && !selectedReport.value) {
      selectedReport.value = reports.value[0]
    }

    toast.add({ severity: 'success', summary: 'Отчёты загружены', life: 2000 })
  } catch (err) {
    console.error('Failed to load reports:', err)
    toast.add({ severity: 'warn', summary: 'Ошибка загрузки', detail: err.message, life: 3000 })
  } finally {
    loading.value = false
  }
}

// ─── Generate Report ──────────────────────────────────────────────────────────
async function generateReport() {
  generating.value = true
  try {
    // Fetch portfolio and projects data
    const [portfolio, projects] = await Promise.all([getPortfolio(), getProjects()])

    // Generate AI report
    const newReport = await generateWeeklyReport({ portfolio, projects })

    // Add to list and select
    reports.value.unshift(newReport)
    selectedReport.value = newReport

    toast.add({
      severity: 'success',
      summary: 'Отчёт сгенерирован',
      detail: 'Еженедельный AI-отчёт успешно создан',
      life: 3000
    })
  } catch (err) {
    console.error('Failed to generate report:', err)
    toast.add({
      severity: 'error',
      summary: 'Ошибка генерации',
      detail: err.message,
      life: 5000
    })
  } finally {
    generating.value = false
  }
}

// ─── Select Report ────────────────────────────────────────────────────────────
function selectReport(report) {
  selectedReport.value = report
}

// ─── Formatters ───────────────────────────────────────────────────────────────
function formatDate(dateStr) {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
}

function formatFullDate(dateStr) {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  return d.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function riskSeverity(level) {
  const map = { 'Критический': 'danger', 'Высокий': 'warn', 'Средний': 'info', 'Низкий': 'success' }
  return map[level] || 'secondary'
}

// ─── Lifecycle ────────────────────────────────────────────────────────────────
onMounted(() => {
  loadReports()
})
</script>

<style scoped>
.fst-intelligence {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: var(--p-surface-card);
}

/* ═══ Header ═══ */
.fsti-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  background: transparent;
  border-bottom: 1px solid var(--p-content-border-color);
}

.fsti-header-left {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.fsti-logo {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  color: var(--p-text-color);
}

.fsti-updated {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--p-text-muted-color);
}

.fsti-header-right {
  display: flex;
  gap: 8px;
}

/* ═══ Body ═══ */
.fsti-body {
  display: flex;
  flex: 1;
  overflow: hidden;
}

/* ═══ Sidebar ═══ */
.fsti-sidebar {
  width: 320px;
  background: var(--surface-card);
  border-right: 1px solid var(--surface-border);
  display: flex;
  flex-direction: column;
}

.fsti-sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  border-bottom: 1px solid var(--surface-border);
  font-weight: 600;
  color: var(--p-text-color);
}

.fsti-reports-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.fsti-report-item {
  padding: 12px;
  margin-bottom: 8px;
  background: var(--p-surface-card);
  border: 1px solid transparent;
  border-radius: var(--p-border-radius);
  cursor: pointer;
  transition: all 0.2s;
}

.fsti-report-item:hover {
  border-color: var(--p-primary-color);
  background: var(--surface-hover);
}

.fsti-report-item.active {
  border-color: var(--p-primary-color);
  background: var(--p-primary-50);
}

.fsti-ri-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
}

.fsti-ri-date {
  font-size: 11px;
  color: var(--p-text-muted-color);
}

.fsti-ri-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--p-text-color);
  margin-bottom: 8px;
}

.fsti-ri-stats {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.fsti-stat-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 10px;
}

.fsti-stat-badge.warn {
  background: color-mix(in srgb, #ff9800 10%, var(--surface-card));
  color: color-mix(in srgb, #ff9800 70%, var(--p-text-color));
}

.fsti-stat-badge.info {
  background: color-mix(in srgb, #42a5f5 10%, var(--surface-card));
  color: color-mix(in srgb, #42a5f5 70%, var(--p-text-color));
}

.fsti-empty-list {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 32px;
  text-align: center;
  color: var(--p-text-muted-color);
}

/* ═══ Main Panel ═══ */
.fsti-main {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
}

.fsti-report {
  max-width: 1200px;
  margin: 0 auto;
}

.fsti-report-header {
  margin-bottom: 32px;
}

.fsti-report-header h2 {
  margin: 0 0 8px 0;
  font-size: 28px;
  color: var(--p-text-color);
}

.fsti-report-meta {
  display: flex;
  gap: 16px;
  font-size: 13px;
  color: var(--p-text-muted-color);
}

.fsti-report-meta span {
  display: flex;
  align-items: center;
  gap: 6px;
}

/* ═══ Sections ═══ */
.fsti-section {
  background: var(--surface-card);
  border: 1px solid var(--surface-border);
  border-radius: var(--p-border-radius);
  padding: 24px;
  margin-bottom: 24px;
}

.fsti-section-title {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 18px;
  font-weight: 600;
  color: var(--p-text-color);
  margin-bottom: 20px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--surface-border);
}

/* Executive Digest */
.fsti-digest > div {
  margin-bottom: 20px;
  line-height: 1.6;
}

.fsti-highlights {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin: 20px 0;
}

.fsti-highlight-col {
  padding: 16px;
  border-radius: var(--p-border-radius);
}

.fsti-highlight-col:first-child {
  background: color-mix(in srgb, #66bb6a 10%, var(--surface-card));
}

.fsti-highlight-col:last-child {
  background: color-mix(in srgb, #ef5350 10%, var(--surface-card));
}

.fsti-highlight-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 600;
  margin-bottom: 12px;
}

.fsti-highlight-label.positive {
  color: color-mix(in srgb, #66bb6a 70%, var(--p-text-color));
}

.fsti-highlight-label.negative {
  color: color-mix(in srgb, #ef5350 70%, var(--p-text-color));
}

.fsti-highlight-col ul {
  margin: 0;
  padding-left: 20px;
}

.fsti-highlight-col li {
  margin-bottom: 6px;
}

.fsti-action-items {
  background: var(--p-surface-card);
  padding: 16px;
  border-radius: var(--p-border-radius);
  margin-top: 20px;
}

.fsti-actions-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  margin-bottom: 12px;
  color: var(--p-text-color);
}

.fsti-action-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 0;
  border-bottom: 1px solid var(--surface-border);
}

.fsti-action-item:last-child {
  border-bottom: none;
}

/* Risk Companies */
.fsti-risk-companies {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.fsti-risk-card {
  padding: 16px;
  background: var(--p-surface-card);
  border-radius: var(--p-border-radius);
  border-left: 4px solid #ef5350;
}

.fsti-rc-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.fsti-rc-name {
  font-size: 16px;
  font-weight: 600;
  color: var(--p-text-color);
}

.fsti-rc-metrics {
  display: flex;
  gap: 12px;
  margin-bottom: 12px;
  font-size: 13px;
  color: var(--p-text-muted-color);
}

.fsti-metric.warn {
  color: color-mix(in srgb, #ff9800 70%, var(--p-text-color));
  font-weight: 600;
}

.fsti-rc-recommendations {
  margin-top: 12px;
}

.fsti-rec-label {
  font-weight: 600;
  margin-bottom: 8px;
  color: var(--p-text-color);
}

.fsti-rc-recommendations ul {
  margin: 0;
  padding-left: 20px;
}

.fsti-rc-recommendations li {
  margin-bottom: 4px;
}

.fsti-empty-risks {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 32px;
  color: var(--p-text-muted-color);
  text-align: center;
}

/* Market Intelligence */
.fsti-market-subsection {
  margin-bottom: 24px;
}

.fsti-market-subsection:last-child {
  margin-bottom: 0;
}

.fsti-market-subtitle {
  font-weight: 600;
  font-size: 15px;
  margin-bottom: 12px;
  color: var(--p-text-color);
}

.fsti-news-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.fsti-news-item {
  padding: 12px;
  background: var(--p-surface-card);
  border-radius: var(--p-border-radius);
  border-left: 3px solid #42a5f5;
}

.fsti-news-date {
  font-size: 11px;
  color: var(--p-text-muted-color);
  margin-bottom: 4px;
}

.fsti-news-title {
  font-weight: 600;
  margin-bottom: 4px;
  color: var(--p-text-color);
}

.fsti-news-summary {
  font-size: 13px;
  color: var(--p-text-muted-color);
  line-height: 1.5;
}

.fsti-competitor-list,
.fsti-regulatory-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.fsti-comp-item {
  display: flex;
  justify-content: space-between;
  padding: 10px;
  background: var(--p-surface-card);
  border-radius: var(--p-border-radius);
}

.fsti-comp-name {
  font-weight: 600;
  color: var(--p-text-color);
}

.fsti-comp-action {
  color: var(--p-text-muted-color);
  font-size: 13px;
}

.fsti-reg-item {
  display: flex;
  gap: 10px;
  padding: 12px;
  background: var(--p-surface-card);
  border-radius: var(--p-border-radius);
}

.fsti-reg-title {
  font-weight: 600;
  margin-bottom: 4px;
  color: var(--p-text-color);
}

.fsti-reg-impact {
  font-size: 13px;
  color: var(--p-text-muted-color);
}

.fsti-empty-section {
  padding: 16px;
  text-align: center;
  color: var(--p-text-muted-color);
  font-size: 13px;
  font-style: italic;
}

/* Forecast */
.fsti-forecast-subsection {
  margin-bottom: 24px;
}

.fsti-forecast-subsection:last-child {
  margin-bottom: 0;
}

.fsti-forecast-subtitle {
  font-weight: 600;
  font-size: 15px;
  margin-bottom: 12px;
  color: var(--p-text-color);
}

.fsti-kpi-list,
.fsti-tranches-list,
.fsti-meetings-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.fsti-kpi-item,
.fsti-tranche-item {
  display: grid;
  grid-template-columns: 200px 1fr auto;
  gap: 12px;
  padding: 10px;
  background: var(--p-surface-card);
  border-radius: var(--p-border-radius);
}

.fsti-kpi-company,
.fsti-tranche-company {
  font-weight: 600;
  color: var(--p-text-color);
}

.fsti-kpi-metric {
  color: var(--p-text-muted-color);
}

.fsti-kpi-target,
.fsti-tranche-amount {
  font-weight: 600;
  color: var(--fst-green);
}

.fsti-tranche-condition {
  color: var(--p-text-muted-color);
  font-size: 12px;
}

.fsti-meeting-item {
  display: flex;
  gap: 16px;
  padding: 12px;
  background: var(--p-surface-card);
  border-radius: var(--p-border-radius);
}

.fsti-meeting-date {
  font-weight: 600;
  color: var(--p-primary-color);
  min-width: 80px;
}

.fsti-meeting-company {
  font-weight: 600;
  color: var(--p-text-color);
  min-width: 150px;
}

.fsti-meeting-purpose {
  color: var(--p-text-muted-color);
  flex: 1;
}

/* Empty Main */
.fsti-empty-main {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--p-text-muted-color);
  text-align: center;
  padding: 32px;
}

.fsti-empty-main h3 {
  margin: 16px 0 8px;
  color: var(--p-text-color);
}

.fsti-empty-main p {
  margin: 0 0 24px;
}

/* ── Mobile adaptive ── */
@media (max-width: 768px) {
  .fsti-ri-stats { flex-wrap: wrap; gap: 8px; }
  .fsti-news-summary { flex-wrap: wrap; gap: 8px; }
  .fsti-highlights { grid-template-columns: 1fr !important; }
  .fsti-tranche-item { grid-template-columns: 1fr !important; }
}
</style>
