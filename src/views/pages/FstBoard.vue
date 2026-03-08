<template>
  <div class="fstb-root">
    <!-- Header -->
    <div class="fstb-header">
      <div class="fstb-header-left">
        <div class="fstb-logo">
          <i class="pi pi-sitemap" style="color:#ab47bc;font-size:20px"></i>
          <span>ФСТ НТИ · <b>Совет директоров</b></span>
          <Tag :value="`${companies.length} компаний`" severity="info" style="font-size:11px" />
          <Tag v-if="upcomingMeetings > 0" :value="`${upcomingMeetings} заседаний`" severity="warn" style="font-size:11px" />
        </div>
        <div class="fstb-sub">Управление правами фонда в советах директоров портфельных компаний</div>
      </div>
      <div class="fstb-header-right">
        <Select v-model="selectedCompanyId" :options="companyOptions" optionLabel="label" optionValue="value"
          placeholder="Выбрать компанию" class="fstb-company-select" />
        <Button icon="pi pi-calendar" label="Календарь" size="small" severity="info" @click="activeTab = 'calendar'" />
        <Button icon="pi pi-home" label="ФСТ" severity="secondary" size="small" text @click="$router.push('/fst-hub')" />
        <Button icon="pi pi-arrow-left" label="Портфель" severity="secondary" size="small" text @click="$router.push('/fst-portfolio')" />
      </div>
    </div>

    <!-- Main Content -->
    <div class="fstb-main">

      <!-- Tab Navigation -->
      <div class="fstb-tabs">
        <div v-for="tab in tabs" :key="tab.id"
          class="fstb-tab" :class="{ active: activeTab === tab.id }"
          @click="activeTab = tab.id">
          <i :class="tab.icon" :style="{ color: tab.color }"></i>
          {{ tab.label }}
          <Tag v-if="tab.badge" :value="tab.badge" severity="secondary" style="font-size:9px;margin-left:6px" />
        </div>
      </div>

      <!-- Tab Content -->
      <div class="fstb-content">

        <!-- Calendar Tab -->
        <div v-if="activeTab === 'calendar'" class="fstb-tab-pane">
          <div class="fstb-calendar-grid">

            <!-- Upcoming Meetings -->
            <div class="fstb-panel">
              <div class="fstb-panel-title">
                <i class="pi pi-calendar" style="color:#42a5f5"></i> Предстоящие заседания
                <Button icon="pi pi-plus" size="small" text severity="success" @click="showAddMeeting = true" style="margin-left:auto" />
              </div>
              <div v-if="filteredMeetings.length === 0" class="fstb-empty">
                <i class="pi pi-calendar" style="font-size:32px;color:var(--p-text-muted-color)"></i>
                <div>Нет запланированных заседаний</div>
                <Button label="Добавить заседание" icon="pi pi-plus" size="small" severity="info" @click="showAddMeeting = true" />
              </div>
              <div v-for="m in filteredMeetings" :key="m.id" class="fstb-meeting-card">
                <div class="fstb-meeting-date">
                  <div class="fstb-meeting-day">{{ formatDay(m.date) }}</div>
                  <div class="fstb-meeting-month">{{ formatMonth(m.date) }}</div>
                </div>
                <div class="fstb-meeting-info">
                  <div class="fstb-meeting-company">{{ m.company }}</div>
                  <div class="fstb-meeting-time">
                    <i class="pi pi-clock"></i> {{ m.time }}
                    <span v-if="m.link" class="fstb-meeting-online">
                      <i class="pi pi-video"></i> Онлайн
                    </span>
                  </div>
                  <div class="fstb-meeting-agenda">{{ m.agendaItems }} вопросов · {{ m.votingItems }} голосований</div>
                </div>
                <div class="fstb-meeting-actions">
                  <Tag v-if="getDaysUntil(m.date) <= 7" :value="`Через ${getDaysUntil(m.date)} дн.`" severity="warn" style="font-size:10px" />
                  <Button v-if="m.link" icon="pi pi-video" size="small" text severity="info" @click="openLink(m.link)" title="Присоединиться" />
                  <Button icon="pi pi-file" size="small" text severity="secondary" @click="viewMaterials(m)" title="Материалы" />
                  <Button icon="pi pi-ellipsis-v" size="small" text severity="secondary" />
                </div>
              </div>
            </div>

            <!-- Notifications -->
            <div class="fstb-panel">
              <div class="fstb-panel-title">
                <i class="pi pi-bell" style="color:#ffa726"></i> Уведомления
              </div>
              <div v-for="notif in notifications" :key="notif.id" class="fstb-notification" :class="notif.type">
                <div class="fstb-notif-icon">
                  <i :class="notif.icon"></i>
                </div>
                <div class="fstb-notif-content">
                  <div class="fstb-notif-title">{{ notif.title }}</div>
                  <div class="fstb-notif-text">{{ notif.text }}</div>
                  <div class="fstb-notif-time">{{ notif.time }}</div>
                </div>
              </div>
            </div>

          </div>
        </div>

        <!-- Board Materials Tab -->
        <div v-if="activeTab === 'materials'" class="fstb-tab-pane">
          <div class="fstb-materials-grid">

            <!-- Board Pack Template -->
            <div class="fstb-panel">
              <div class="fstb-panel-title">
                <i class="pi pi-file-word" style="color:#42a5f5"></i> Шаблон Board Pack
                <Button label="Сгенерировать" icon="pi pi-sparkles" size="small" severity="info"
                  @click="generateBoardPack" :loading="generatingBoardPack" style="margin-left:auto" />
              </div>
              <div class="fstb-boardpack-sections">
                <div v-for="section in boardPackSections" :key="section.id" class="fstb-bp-section">
                  <Checkbox v-model="section.enabled" :binary="true" :inputId="section.id" />
                  <label :for="section.id" class="fstb-bp-label">
                    <div class="fstb-bp-name">{{ section.name }}</div>
                    <div class="fstb-bp-desc">{{ section.description }}</div>
                  </label>
                </div>
              </div>
            </div>

            <!-- Generated Materials -->
            <div class="fstb-panel">
              <div class="fstb-panel-title">
                <i class="pi pi-files" style="color:#66bb6a"></i> Материалы заседаний
              </div>
              <div v-if="boardPackContent" class="fstb-boardpack-preview">
                <div class="fstb-bp-toolbar">
                  <span style="font-size:12px;color:var(--p-text-muted-color)">Версия: {{ boardPackVersion }}</span>
                  <div style="display:flex;gap:6px">
                    <Button icon="pi pi-download" label="PDF" size="small" severity="secondary" @click="downloadBoardPack('pdf')" />
                    <Button icon="pi pi-download" label="DOCX" size="small" severity="secondary" @click="downloadBoardPack('docx')" />
                    <Button icon="pi pi-copy" size="small" text @click="copyBoardPack" />
                  </div>
                </div>
                <div class="fstb-bp-content" v-html="boardPackContent"></div>
              </div>
              <div v-else class="fstb-empty">
                <i class="pi pi-file" style="font-size:32px;color:var(--p-text-muted-color)"></i>
                <div>Нет сгенерированных материалов</div>
                <div style="font-size:11px;color:var(--p-text-muted-color);margin-top:4px">
                  Используйте кнопку "Сгенерировать" для создания Board Pack
                </div>
              </div>
            </div>

          </div>
        </div>

        <!-- Protective Provisions Tab -->
        <div v-if="activeTab === 'rights'" class="fstb-tab-pane">
          <div class="fstb-rights-grid">

            <!-- Rights Registry -->
            <div class="fstb-panel">
              <div class="fstb-panel-title">
                <i class="pi pi-shield" style="color:#ef5350"></i> Реестр прав фонда
                <Button icon="pi pi-plus" label="Добавить право" size="small" text severity="success"
                  @click="showAddRight = true" style="margin-left:auto" />
              </div>
              <div class="fstb-rights-list">
                <div v-for="right in companyRights" :key="right.id" class="fstb-right-card">
                  <div class="fstb-right-header">
                    <div class="fstb-right-name">{{ right.name }}</div>
                    <Tag :value="right.type" severity="info" style="font-size:10px" />
                  </div>
                  <div class="fstb-right-desc">{{ right.description }}</div>
                  <div class="fstb-right-meta">
                    <span class="fstb-right-threshold">Порог: {{ right.threshold }}</span>
                    <span class="fstb-right-source">{{ right.source }}</span>
                  </div>
                  <div v-if="right.lastExercised" class="fstb-right-history">
                    <i class="pi pi-history" style="font-size:10px"></i>
                    Последнее использование: {{ right.lastExercised }}
                  </div>
                </div>
              </div>
            </div>

            <!-- Approval Requests -->
            <div class="fstb-panel">
              <div class="fstb-panel-title">
                <i class="pi pi-check-circle" style="color:#ffa726"></i> Запросы на одобрение
              </div>
              <div v-if="approvalRequests.length === 0" class="fstb-empty">
                <i class="pi pi-check-circle" style="font-size:32px;color:var(--p-text-muted-color)"></i>
                <div>Нет активных запросов</div>
              </div>
              <div v-for="req in approvalRequests" :key="req.id" class="fstb-approval-card">
                <div class="fstb-approval-header">
                  <Tag :value="req.status" :severity="getApprovalSeverity(req.status)" style="font-size:10px" />
                  <span class="fstb-approval-date">{{ req.date }}</span>
                </div>
                <div class="fstb-approval-title">{{ req.title }}</div>
                <div class="fstb-approval-company">{{ req.company }}</div>
                <div class="fstb-approval-right">Право: {{ req.rightName }}</div>
                <div class="fstb-approval-actions" v-if="req.status === 'Ожидание'">
                  <Button label="Одобрить" icon="pi pi-check" size="small" severity="success" @click="approveRequest(req.id)" />
                  <Button label="Отклонить" icon="pi pi-times" size="small" severity="danger" text @click="rejectRequest(req.id)" />
                </div>
                <div v-else class="fstb-approval-decision">
                  <i :class="req.status === 'Одобрено' ? 'pi pi-check' : 'pi pi-times'"
                    :style="{ color: req.status === 'Одобрено' ? '#66bb6a' : '#ef5350' }"></i>
                  {{ req.decision }}
                </div>
              </div>
            </div>

            <!-- Violations -->
            <div class="fstb-panel">
              <div class="fstb-panel-title">
                <i class="pi pi-exclamation-triangle" style="color:#ef5350"></i> Нарушения прав
              </div>
              <div v-if="violations.length === 0" class="fstb-empty">
                <i class="pi pi-check" style="font-size:32px;color:#66bb6a"></i>
                <div style="color:#66bb6a">Нарушений не обнаружено</div>
              </div>
              <div v-for="v in violations" :key="v.id" class="fstb-violation-card">
                <div class="fstb-violation-header">
                  <Tag value="НАРУШЕНИЕ" severity="danger" style="font-size:10px" />
                  <span class="fstb-violation-date">{{ v.date }}</span>
                </div>
                <div class="fstb-violation-title">{{ v.title }}</div>
                <div class="fstb-violation-company">{{ v.company }}</div>
                <div class="fstb-violation-desc">{{ v.description }}</div>
                <div class="fstb-violation-actions">
                  <Button label="Направить претензию" icon="pi pi-send" size="small" severity="danger" @click="sendClaim(v.id)" />
                  <Button label="Подробнее" icon="pi pi-info-circle" size="small" severity="secondary" text @click="viewViolation(v)" />
                </div>
              </div>
            </div>

          </div>
        </div>

        <!-- Voting Tracker Tab -->
        <div v-if="activeTab === 'voting'" class="fstb-tab-pane">
          <div class="fstb-voting-grid">

            <!-- Active Votings -->
            <div class="fstb-panel">
              <div class="fstb-panel-title">
                <i class="pi pi-chart-pie" style="color:#42a5f5"></i> Текущие голосования
              </div>
              <div v-if="activeVotings.length === 0" class="fstb-empty">
                <i class="pi pi-chart-pie" style="font-size:32px;color:var(--p-text-muted-color)"></i>
                <div>Нет активных голосований</div>
              </div>
              <div v-for="vote in activeVotings" :key="vote.id" class="fstb-voting-card">
                <div class="fstb-voting-header">
                  <div class="fstb-voting-company">{{ vote.company }}</div>
                  <Tag value="Голосование" severity="warn" style="font-size:10px" />
                </div>
                <div class="fstb-voting-title">{{ vote.title }}</div>
                <div class="fstb-voting-desc">{{ vote.description }}</div>
                <div class="fstb-voting-deadline">
                  <i class="pi pi-clock"></i> До {{ vote.deadline }}
                </div>
                <div class="fstb-voting-options">
                  <Button label="За" icon="pi pi-check" size="small" severity="success"
                    @click="castVote(vote.id, 'approve')" :disabled="vote.voted" />
                  <Button label="Против" icon="pi pi-times" size="small" severity="danger"
                    @click="castVote(vote.id, 'reject')" :disabled="vote.voted" />
                  <Button label="Воздержаться" size="small" severity="secondary"
                    @click="castVote(vote.id, 'abstain')" :disabled="vote.voted" />
                </div>
                <div v-if="vote.voted" class="fstb-voting-cast">
                  <i class="pi pi-check-circle" style="color:#66bb6a"></i>
                  Голос подан: {{ vote.decision }}
                </div>
              </div>
            </div>

            <!-- Voting History -->
            <div class="fstb-panel">
              <div class="fstb-panel-title">
                <i class="pi pi-history" style="color:#26c6da"></i> История голосований
              </div>
              <div class="fstb-voting-history">
                <div v-for="hist in votingHistory" :key="hist.id" class="fstb-history-item">
                  <div class="fstb-history-date">{{ hist.date }}</div>
                  <div class="fstb-history-company">{{ hist.company }}</div>
                  <div class="fstb-history-title">{{ hist.title }}</div>
                  <div class="fstb-history-decision">
                    <Tag :value="hist.decision" :severity="getDecisionSeverity(hist.decision)" style="font-size:10px" />
                    <span class="fstb-history-rationale" v-if="hist.rationale">{{ hist.rationale }}</span>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>

      </div>

    </div>

  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import Button from 'primevue/button'
import Tag from 'primevue/tag'
import Select from 'primevue/select'
import Checkbox from 'primevue/checkbox'
import { useToast } from 'primevue/usetoast'

const toast = useToast()

// ─── State ─────────────────────────────────────────────────────────────────
const activeTab = ref('calendar')
const selectedCompanyId = ref(null)
const showAddMeeting = ref(false)
const showAddRight = ref(false)
const generatingBoardPack = ref(false)
const boardPackContent = ref('')
const boardPackVersion = ref('1.0')

// ─── Tabs ──────────────────────────────────────────────────────────────────
const tabs = [
  { id: 'calendar', label: 'Календарь заседаний', icon: 'pi pi-calendar', color: '#42a5f5', badge: null },
  { id: 'materials', label: 'Материалы совета', icon: 'pi pi-file-word', color: '#66bb6a', badge: null },
  { id: 'rights', label: 'Права фонда', icon: 'pi pi-shield', color: '#ef5350', badge: '3' },
  { id: 'voting', label: 'Голосования', icon: 'pi pi-chart-pie', color: '#ffa726', badge: '2' },
]

// ─── Companies ─────────────────────────────────────────────────────────────
const companies = ref([
  { id: 1, name: 'АвиаЛогик', inn: '7701234567' },
  { id: 2, name: 'МикроСхема', inn: '7705551234' },
  { id: 3, name: 'РоботАгро', inn: '5011900321' },
  { id: 4, name: 'АэроСпектр', inn: '7812345678' },
])

const companyOptions = computed(() => [
  { label: 'Все компании', value: null },
  ...companies.value.map(c => ({ label: c.name, value: c.id }))
])

// ─── Meetings ──────────────────────────────────────────────────────────────
const meetings = ref([
  {
    id: 1,
    company: 'АвиаЛогик',
    companyId: 1,
    date: '2026-03-12',
    time: '14:00',
    agendaItems: 5,
    votingItems: 2,
    link: 'https://zoom.us/j/example123',
  },
  {
    id: 2,
    company: 'МикроСхема',
    companyId: 2,
    date: '2026-03-15',
    time: '10:00',
    agendaItems: 4,
    votingItems: 1,
    link: 'https://teams.microsoft.com/example',
  },
  {
    id: 3,
    company: 'РоботАгро',
    companyId: 3,
    date: '2026-03-20',
    time: '16:00',
    agendaItems: 3,
    votingItems: 0,
    link: null,
  },
])

const filteredMeetings = computed(() => {
  if (!selectedCompanyId.value) return meetings.value
  return meetings.value.filter(m => m.companyId === selectedCompanyId.value)
})

const upcomingMeetings = computed(() => {
  const today = new Date()
  return meetings.value.filter(m => new Date(m.date) >= today).length
})

// ─── Notifications ─────────────────────────────────────────────────────────
const notifications = ref([
  {
    id: 1,
    type: 'urgent',
    icon: 'pi pi-exclamation-circle',
    title: 'Заседание через 3 дня',
    text: 'АвиаЛогик — 12.03.2026 в 14:00. Требуется подготовить Board Pack.',
    time: '2 часа назад',
  },
  {
    id: 2,
    type: 'info',
    icon: 'pi pi-info-circle',
    title: 'Материалы опубликованы',
    text: 'МикроСхема — Board Pack v2.1 доступен для ознакомления.',
    time: '5 часов назад',
  },
  {
    id: 3,
    type: 'warn',
    icon: 'pi pi-bell',
    title: 'Запрос на одобрение',
    text: 'АэроСпектр — увеличение бюджета на 15% требует согласования.',
    time: '1 день назад',
  },
])

// ─── Board Pack Sections ───────────────────────────────────────────────────
const boardPackSections = ref([
  { id: 'ceo-letter', name: 'CEO Letter', description: 'Письмо генерального директора', enabled: true },
  { id: 'financials', name: 'Финансовые результаты', description: 'Выручка, EBITDA, Cash Flow vs план', enabled: true },
  { id: 'kpi', name: 'KPI Dashboard', description: 'Ключевые показатели и метрики', enabled: true },
  { id: 'risks', name: 'Риски и действия', description: 'Текущие риски и план митигации', enabled: true },
  { id: 'voting', name: 'Вопросы для голосования', description: 'Вопросы, требующие решения совета', enabled: true },
  { id: 'team', name: 'Команда', description: 'Изменения в составе и найм', enabled: false },
  { id: 'market', name: 'Рынок и конкуренты', description: 'Анализ рыночной ситуации', enabled: false },
])

// ─── Company Rights ────────────────────────────────────────────────────────
const companyRights = ref([
  {
    id: 1,
    name: 'Вето по крупным сделкам',
    type: 'Veto',
    description: 'Право блокировать сделки на сумму > 10 млн ₽',
    threshold: '> 10 млн ₽',
    source: 'Инвестиционный договор §4.2',
    lastExercised: '15.02.2026 — Одобрено приобретение оборудования',
  },
  {
    id: 2,
    name: 'Одобрение найма С-level',
    type: 'Approval',
    description: 'Согласование найма топ-менеджмента',
    threshold: 'CEO, CFO, CTO',
    source: 'Устав SPV §7.1',
    lastExercised: null,
  },
  {
    id: 3,
    name: 'Место в совете директоров',
    type: 'Board Seat',
    description: 'Представитель фонда в совете',
    threshold: '1 место',
    source: 'Корпоративный договор §2',
    lastExercised: 'Активно — Иванов А.Р.',
  },
  {
    id: 4,
    name: 'Право на информацию',
    type: 'Information',
    description: 'Доступ к финансовой и операционной отчётности',
    threshold: 'Ежемесячно',
    source: 'Инвестиционный договор §9',
    lastExercised: 'Регулярно',
  },
])

// ─── Approval Requests ─────────────────────────────────────────────────────
const approvalRequests = ref([
  {
    id: 1,
    company: 'АэроСпектр',
    title: 'Увеличение бюджета на маркетинг',
    rightName: 'Вето по бюджету',
    date: '05.03.2026',
    status: 'Ожидание',
    decision: null,
  },
  {
    id: 2,
    company: 'МикроСхема',
    title: 'Одобрение нового раунда финансирования',
    rightName: 'Антиразводнение',
    date: '02.03.2026',
    status: 'Ожидание',
    decision: null,
  },
  {
    id: 3,
    company: 'АвиаЛогик',
    title: 'Найм CFO',
    rightName: 'Одобрение найма С-level',
    date: '28.02.2026',
    status: 'Одобрено',
    decision: 'Одобрено без замечаний. Кандидат соответствует требованиям.',
  },
])

// ─── Violations ────────────────────────────────────────────────────────────
const violations = ref([])

// ─── Active Votings ────────────────────────────────────────────────────────
const activeVotings = ref([
  {
    id: 1,
    company: 'АвиаЛогик',
    title: 'Одобрение бюджета на 2026 год',
    description: 'Операционный бюджет: 120 млн ₽. Капитальные расходы: 35 млн ₽.',
    deadline: '10.03.2026',
    voted: false,
    decision: null,
  },
  {
    id: 2,
    company: 'МикроСхема',
    title: 'Одобрение привлечения стратегического инвестора',
    description: 'Вход Роснано с долей 12%. Оценка: 450 млн ₽.',
    deadline: '12.03.2026',
    voted: false,
    decision: null,
  },
])

// ─── Voting History ────────────────────────────────────────────────────────
const votingHistory = ref([
  {
    id: 1,
    date: '28.02.2026',
    company: 'АвиаЛогик',
    title: 'Найм CFO',
    decision: 'За',
    rationale: 'Кандидат соответствует всем требованиям',
  },
  {
    id: 2,
    date: '15.02.2026',
    company: 'РоботАгро',
    title: 'Одобрение пилотного проекта с АгроСеверо',
    decision: 'За',
    rationale: 'Стратегически важный клиент',
  },
  {
    id: 3,
    date: '10.02.2026',
    company: 'АэроСпектр',
    title: 'Досрочная выплата транша 2',
    decision: 'Против',
    rationale: 'KPI не достигнуты. Рекомендовано отложить до Q2.',
  },
])

// ─── Methods ───────────────────────────────────────────────────────────────
function formatDay(dateStr) {
  return new Date(dateStr).getDate()
}

function formatMonth(dateStr) {
  const months = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек']
  return months[new Date(dateStr).getMonth()]
}

function getDaysUntil(dateStr) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(dateStr)
  target.setHours(0, 0, 0, 0)
  const diff = Math.ceil((target - today) / (1000 * 60 * 60 * 24))
  return diff
}

function openLink(url) {
  window.open(url, '_blank')
}

function viewMaterials(meeting) {
  toast.add({ severity: 'info', summary: 'Материалы заседания', detail: `Открытие материалов для ${meeting.company}`, life: 2500 })
  activeTab.value = 'materials'
}

async function generateBoardPack() {
  generatingBoardPack.value = true
  await new Promise(r => setTimeout(r, 2500))

  const selectedSections = boardPackSections.value.filter(s => s.enabled)
  const company = selectedCompanyId.value
    ? companies.value.find(c => c.id === selectedCompanyId.value)
    : companies.value[0]

  boardPackContent.value = `
<div style="font-size:13px;line-height:1.7">
<h2 style="color:var(--p-primary-color);margin:0 0 12px;font-size:18px">Board Pack — ${company.name}</h2>
<p style="color:var(--p-text-muted-color);font-size:11px;margin:0 0 20px">Дата: ${new Date().toLocaleDateString('ru-RU')} · Версия: ${boardPackVersion.value}</p>

${selectedSections.map(section => {
  if (section.id === 'ceo-letter') {
    return `<h3 style="color:var(--p-text-color);font-size:14px;margin:20px 0 10px">1. CEO Letter</h3>
<p style="font-size:12px">Уважаемые члены совета директоров,</p>
<p style="font-size:12px">Представляю вашему вниманию результаты работы ${company.name} за прошедший период. Мы продолжаем реализацию стратегии роста и достигли значимых показателей...</p>`
  }
  if (section.id === 'financials') {
    return `<h3 style="color:var(--p-text-color);font-size:14px;margin:20px 0 10px">2. Финансовые результаты</h3>
<table style="width:100%;border-collapse:collapse;font-size:12px;margin:10px 0">
  <tr style="background:var(--surface-card)"><th style="padding:6px 8px;text-align:left">Показатель</th><th style="padding:6px 8px;text-align:right">Факт</th><th style="padding:6px 8px;text-align:right">План</th><th style="padding:6px 8px;text-align:right">%</th></tr>
  <tr><td style="padding:6px 8px">Выручка (млн ₽)</td><td style="padding:6px 8px;text-align:right">18.2</td><td style="padding:6px 8px;text-align:right">20.0</td><td style="padding:6px 8px;text-align:right;color:#ffa726">91%</td></tr>
  <tr style="background:var(--surface-card)"><td style="padding:6px 8px">EBITDA (млн ₽)</td><td style="padding:6px 8px;text-align:right">-2.1</td><td style="padding:6px 8px;text-align:right">-1.5</td><td style="padding:6px 8px;text-align:right;color:#ef5350">—</td></tr>
  <tr><td style="padding:6px 8px">Cash (млн ₽)</td><td style="padding:6px 8px;text-align:right">32.5</td><td style="padding:6px 8px;text-align:right">28.0</td><td style="padding:6px 8px;text-align:right;color:#66bb6a">116%</td></tr>
  <tr style="background:var(--surface-card)"><td style="padding:6px 8px">Runway (мес.)</td><td style="padding:6px 8px;text-align:right">14</td><td style="padding:6px 8px;text-align:right">12</td><td style="padding:6px 8px;text-align:right;color:#66bb6a">117%</td></tr>
</table>`
  }
  if (section.id === 'kpi') {
    return `<h3 style="color:var(--p-text-color);font-size:14px;margin:20px 0 10px">3. KPI Dashboard</h3>
<div style="font-size:12px">
  <div style="margin:8px 0">• <b>TRL:</b> 6 / 7 (86%)</div>
  <div style="margin:8px 0">• <b>Сотрудники:</b> 11 / 12 (92%)</div>
  <div style="margin:8px 0">• <b>Патенты:</b> 2 / 2 (100%)</div>
  <div style="margin:8px 0">• <b>Контракты:</b> 1 / 1 (100%)</div>
</div>`
  }
  if (section.id === 'risks') {
    return `<h3 style="color:var(--p-text-color);font-size:14px;margin:20px 0 10px">4. Риски и действия</h3>
<div style="font-size:12px">
  <div style="margin:10px 0;padding:8px;background:rgba(255,167,38,0.08);border-left:3px solid #ffa726;border-radius:4px">
    <b>Риск:</b> Задержка сертификации Росавиации<br>
    <b>Действие:</b> Ускорение процесса через участие в пилотном проекте ФАС России
  </div>
  <div style="margin:10px 0;padding:8px;background:rgba(66,165,245,0.08);border-left:3px solid #42a5f5;border-radius:4px">
    <b>Возможность:</b> Интерес стратегического партнёра (Роснефть)<br>
    <b>Действие:</b> Подготовка коммерческого предложения Q2 2026
  </div>
</div>`
  }
  if (section.id === 'voting') {
    return `<h3 style="color:var(--p-text-color);font-size:14px;margin:20px 0 10px">5. Вопросы для голосования</h3>
<ol style="font-size:12px;padding-left:20px">
  <li style="margin:8px 0">Одобрение бюджета на 2026 год (120 млн ₽)</li>
  <li style="margin:8px 0">Назначение нового CFO (кандидат: Петров В.С.)</li>
</ol>`
  }
  return ''
}).join('')}

<div style="margin-top:30px;padding-top:15px;border-top:1px solid var(--surface-border);font-size:10px;color:var(--p-text-muted-color)">
Документ сгенерирован автоматически платформой ФСТ НТИ · Конфиденциально
</div>
</div>`

  boardPackVersion.value = `${parseFloat(boardPackVersion.value) + 0.1}`.substring(0, 3)
  generatingBoardPack.value = false
  toast.add({ severity: 'success', summary: 'Board Pack сгенерирован', detail: `Версия ${boardPackVersion.value}`, life: 2500 })
}

function downloadBoardPack(format) {
  toast.add({ severity: 'info', summary: 'Скачивание', detail: `Экспорт Board Pack в формат ${format.toUpperCase()}`, life: 2500 })
}

function copyBoardPack() {
  const text = boardPackContent.value.replace(/<[^>]+>/g, '')
  navigator.clipboard.writeText(text).then(() => {
    toast.add({ severity: 'info', summary: 'Скопировано', detail: 'Board Pack в буфере обмена', life: 2000 })
  })
}

function getApprovalSeverity(status) {
  if (status === 'Одобрено') return 'success'
  if (status === 'Отклонено') return 'danger'
  return 'warn'
}

function approveRequest(id) {
  const req = approvalRequests.value.find(r => r.id === id)
  if (req) {
    req.status = 'Одобрено'
    req.decision = 'Одобрено фондом без замечаний'
    toast.add({ severity: 'success', summary: 'Одобрено', detail: req.title, life: 2500 })
  }
}

function rejectRequest(id) {
  const req = approvalRequests.value.find(r => r.id === id)
  if (req) {
    req.status = 'Отклонено'
    req.decision = 'Отклонено фондом. Требуется пересмотр условий.'
    toast.add({ severity: 'warn', summary: 'Отклонено', detail: req.title, life: 2500 })
  }
}

function sendClaim(id) {
  toast.add({ severity: 'warn', summary: 'Претензия направлена', detail: 'Юридический отдел инициирует процедуру', life: 3000 })
}

function viewViolation(v) {
  toast.add({ severity: 'info', summary: 'Детали нарушения', detail: v.title, life: 2500 })
}

function castVote(id, decision) {
  const vote = activeVotings.value.find(v => v.id === id)
  if (vote) {
    vote.voted = true
    const decisionMap = { approve: 'За', reject: 'Против', abstain: 'Воздержался' }
    vote.decision = decisionMap[decision]
    toast.add({ severity: 'success', summary: 'Голос подан', detail: `${vote.company} — ${vote.decision}`, life: 2500 })
  }
}

function getDecisionSeverity(decision) {
  if (decision === 'За') return 'success'
  if (decision === 'Против') return 'danger'
  return 'secondary'
}

onMounted(() => {
  // Load data from Integram if needed
})
</script>

<style scoped>
.fstb-root {
  background: var(--surface-ground);
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  font-family: var(--p-font-family);
}

/* Header */
.fstb-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  background: var(--surface-card);
  border-bottom: 1px solid var(--surface-border);
  flex-shrink: 0;
  gap: 12px;
  flex-wrap: wrap;
}
.fstb-logo {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 15px;
  color: var(--p-text-color);
}
.fstb-sub {
  font-size: 11px;
  color: var(--p-text-muted-color);
  margin-top: 2px;
}
.fstb-header-right {
  display: flex;
  align-items: center;
  gap: 8px;
}
.fstb-company-select {
  width: 180px;
}

/* Main */
.fstb-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* Tabs */
.fstb-tabs {
  display: flex;
  gap: 0;
  background: var(--surface-card);
  border-bottom: 2px solid var(--surface-border);
  padding: 0 12px;
}
.fstb-tab {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  font-size: 13px;
  font-weight: 500;
  color: var(--p-text-muted-color);
  cursor: pointer;
  border-bottom: 2px solid transparent;
  margin-bottom: -2px;
  transition: all 0.15s;
}
.fstb-tab:hover {
  color: var(--p-text-color);
  background: var(--surface-ground);
}
.fstb-tab.active {
  color: var(--p-primary-color);
  border-bottom-color: var(--p-primary-color);
}

/* Content */
.fstb-content {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
}

/* Panel */
.fstb-panel {
  background: var(--surface-card);
  border: 1px solid var(--surface-border);
  border-radius: 8px;
  padding: 14px;
  margin-bottom: 12px;
}
.fstb-panel-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 600;
  color: var(--p-text-color);
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--surface-border);
}

/* Calendar Grid */
.fstb-calendar-grid {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 12px;
}

/* Meeting Card */
.fstb-meeting-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px;
  background: var(--surface-ground);
  border: 1px solid var(--surface-border);
  border-radius: 6px;
  margin-bottom: 8px;
  transition: all 0.15s;
}
.fstb-meeting-card:hover {
  border-color: var(--p-primary-color);
}
.fstb-meeting-date {
  width: 50px;
  height: 50px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: var(--p-primary-color);
  color: #fff;
  border-radius: 6px;
  flex-shrink: 0;
}
.fstb-meeting-day {
  font-size: 20px;
  font-weight: 700;
  line-height: 1;
}
.fstb-meeting-month {
  font-size: 11px;
  text-transform: uppercase;
  margin-top: 2px;
}
.fstb-meeting-info {
  flex: 1;
}
.fstb-meeting-company {
  font-size: 13px;
  font-weight: 600;
  color: var(--p-text-color);
}
.fstb-meeting-time {
  font-size: 11px;
  color: var(--p-text-muted-color);
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 2px;
}
.fstb-meeting-online {
  margin-left: 8px;
  padding: 2px 6px;
  background: rgba(66, 165, 245, 0.1);
  color: #42a5f5;
  border-radius: 3px;
  font-size: 10px;
  display: flex;
  align-items: center;
  gap: 3px;
}
.fstb-meeting-agenda {
  font-size: 11px;
  color: var(--p-text-muted-color);
  margin-top: 4px;
}
.fstb-meeting-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

/* Notifications */
.fstb-notification {
  display: flex;
  gap: 10px;
  padding: 10px;
  background: var(--surface-ground);
  border-left: 3px solid var(--surface-border);
  border-radius: 4px;
  margin-bottom: 8px;
}
.fstb-notification.urgent {
  border-left-color: #ef5350;
  background: rgba(239, 83, 80, 0.06);
}
.fstb-notification.warn {
  border-left-color: #ffa726;
  background: rgba(255, 167, 38, 0.06);
}
.fstb-notification.info {
  border-left-color: #42a5f5;
  background: rgba(66, 165, 245, 0.06);
}
.fstb-notif-icon {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  flex-shrink: 0;
}
.fstb-notification.urgent .fstb-notif-icon {
  background: rgba(239, 83, 80, 0.15);
  color: #ef5350;
}
.fstb-notification.warn .fstb-notif-icon {
  background: rgba(255, 167, 38, 0.15);
  color: #ffa726;
}
.fstb-notification.info .fstb-notif-icon {
  background: rgba(66, 165, 245, 0.15);
  color: #42a5f5;
}
.fstb-notif-content {
  flex: 1;
}
.fstb-notif-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--p-text-color);
}
.fstb-notif-text {
  font-size: 11px;
  color: var(--p-text-muted-color);
  margin-top: 2px;
}
.fstb-notif-time {
  font-size: 10px;
  color: var(--p-text-muted-color);
  margin-top: 4px;
}

/* Materials Grid */
.fstb-materials-grid {
  display: grid;
  grid-template-columns: 1fr 2fr;
  gap: 12px;
}

/* Board Pack Sections */
.fstb-boardpack-sections {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.fstb-bp-section {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 8px;
  background: var(--surface-ground);
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.15s;
}
.fstb-bp-section:hover {
  background: var(--surface-card);
}
.fstb-bp-label {
  flex: 1;
  cursor: pointer;
}
.fstb-bp-name {
  font-size: 12px;
  font-weight: 600;
  color: var(--p-text-color);
}
.fstb-bp-desc {
  font-size: 11px;
  color: var(--p-text-muted-color);
  margin-top: 2px;
}

/* Board Pack Preview */
.fstb-boardpack-preview {
  border: 1px solid var(--surface-border);
  border-radius: 6px;
  overflow: hidden;
}
.fstb-bp-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: var(--surface-ground);
  border-bottom: 1px solid var(--surface-border);
}
.fstb-bp-content {
  padding: 16px;
  max-height: 600px;
  overflow-y: auto;
  font-size: 12px;
  line-height: 1.6;
}

/* Rights Grid */
.fstb-rights-grid {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 12px;
}

/* Right Card */
.fstb-right-card {
  background: var(--surface-ground);
  border: 1px solid var(--surface-border);
  border-radius: 6px;
  padding: 10px;
  margin-bottom: 8px;
}
.fstb-right-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}
.fstb-right-name {
  font-size: 12px;
  font-weight: 600;
  color: var(--p-text-color);
}
.fstb-right-desc {
  font-size: 11px;
  color: var(--p-text-muted-color);
  margin-bottom: 6px;
}
.fstb-right-meta {
  display: flex;
  justify-content: space-between;
  font-size: 10px;
  color: var(--p-text-muted-color);
  padding-top: 6px;
  border-top: 1px solid var(--surface-border);
}
.fstb-right-threshold {
  font-weight: 600;
}
.fstb-right-history {
  font-size: 10px;
  color: var(--p-text-muted-color);
  margin-top: 6px;
  padding-top: 6px;
  border-top: 1px solid var(--surface-border);
  display: flex;
  align-items: center;
  gap: 4px;
}

.fstb-rights-list {
  max-height: 500px;
  overflow-y: auto;
}

/* Approval Card */
.fstb-approval-card {
  background: var(--surface-ground);
  border: 1px solid var(--surface-border);
  border-radius: 6px;
  padding: 10px;
  margin-bottom: 8px;
}
.fstb-approval-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}
.fstb-approval-date {
  font-size: 10px;
  color: var(--p-text-muted-color);
}
.fstb-approval-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--p-text-color);
  margin-bottom: 4px;
}
.fstb-approval-company {
  font-size: 11px;
  color: var(--p-text-muted-color);
  margin-bottom: 4px;
}
.fstb-approval-right {
  font-size: 10px;
  color: var(--p-text-muted-color);
  margin-bottom: 8px;
}
.fstb-approval-actions {
  display: flex;
  gap: 6px;
}
.fstb-approval-decision {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: var(--p-text-color);
  padding: 6px 8px;
  background: var(--surface-card);
  border-radius: 4px;
}

/* Violation Card */
.fstb-violation-card {
  background: rgba(239, 83, 80, 0.06);
  border: 1px solid rgba(239, 83, 80, 0.3);
  border-radius: 6px;
  padding: 10px;
  margin-bottom: 8px;
}
.fstb-violation-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}
.fstb-violation-date {
  font-size: 10px;
  color: var(--p-text-muted-color);
}
.fstb-violation-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--p-text-color);
  margin-bottom: 4px;
}
.fstb-violation-company {
  font-size: 11px;
  color: var(--p-text-muted-color);
  margin-bottom: 4px;
}
.fstb-violation-desc {
  font-size: 11px;
  color: var(--p-text-color);
  margin-bottom: 8px;
}
.fstb-violation-actions {
  display: flex;
  gap: 6px;
}

/* Voting Grid */
.fstb-voting-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

/* Voting Card */
.fstb-voting-card {
  background: var(--surface-ground);
  border: 1px solid var(--surface-border);
  border-radius: 6px;
  padding: 12px;
  margin-bottom: 10px;
}
.fstb-voting-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}
.fstb-voting-company {
  font-size: 12px;
  font-weight: 600;
  color: var(--p-text-color);
}
.fstb-voting-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--p-text-color);
  margin-bottom: 6px;
}
.fstb-voting-desc {
  font-size: 11px;
  color: var(--p-text-muted-color);
  margin-bottom: 8px;
}
.fstb-voting-deadline {
  font-size: 11px;
  color: var(--p-text-muted-color);
  display: flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 10px;
}
.fstb-voting-options {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.fstb-voting-cast {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--p-text-color);
  padding: 8px;
  background: rgba(102, 187, 106, 0.1);
  border-radius: 4px;
  margin-top: 8px;
}

/* Voting History */
.fstb-voting-history {
  max-height: 600px;
  overflow-y: auto;
}
.fstb-history-item {
  padding: 10px;
  background: var(--surface-ground);
  border-radius: 6px;
  margin-bottom: 8px;
}
.fstb-history-date {
  font-size: 10px;
  color: var(--p-text-muted-color);
  margin-bottom: 4px;
}
.fstb-history-company {
  font-size: 12px;
  font-weight: 600;
  color: var(--p-text-color);
}
.fstb-history-title {
  font-size: 11px;
  color: var(--p-text-muted-color);
  margin: 4px 0;
}
.fstb-history-decision {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 6px;
}
.fstb-history-rationale {
  font-size: 10px;
  color: var(--p-text-muted-color);
}

/* Empty State */
.fstb-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 30px 20px;
  color: var(--p-text-muted-color);
  font-size: 12px;
  text-align: center;
}

/* Responsive */
@media (max-width: 1400px) {
  .fstb-rights-grid {
    grid-template-columns: 1fr 1fr;
  }
}
@media (max-width: 1000px) {
  .fstb-calendar-grid,
  .fstb-materials-grid,
  .fstb-voting-grid {
    grid-template-columns: 1fr;
  }
  .fstb-rights-grid {
    grid-template-columns: 1fr;
  }
}
</style>
