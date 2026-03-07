<template>
  <div class="fst-founders-root">
    <!-- Header -->
    <div class="fst-founders-header">
      <div class="fst-founders-header-left">
        <div class="fst-founders-logo">
          <i class="pi pi-users" style="color:#667eea;font-size:20px"></i>
          <span>ФСТ НТИ · <b>Founders CRM & Mentors</b></span>
          <Tag :value="`${founderCount} основателей`" severity="info" style="font-size:11px" />
          <Tag :value="`${mentorCount} менторов`" severity="success" style="font-size:11px" />
        </div>
        <div class="fst-founders-subtitle">
          Управление отношениями с основателями и база менторов Фонда
        </div>
      </div>
      <div class="fst-founders-header-right">
        <Button icon="pi pi-refresh" label="Обновить" size="small" severity="secondary" @click="refreshAll" :loading="loading" />
        <Button icon="pi pi-plus" label="Добавить" size="small" severity="success" @click="showAddDialog = true" />
      </div>
    </div>

    <!-- Tabs -->
    <div class="fst-founders-tabs">
      <div
        v-for="tab in tabs"
        :key="tab.id"
        class="fst-founders-tab"
        :class="{ active: activeTab === tab.id }"
        @click="activeTab = tab.id"
      >
        <i :class="tab.icon"></i>
        <span>{{ tab.label }}</span>
        <span v-if="tab.count !== undefined" class="fst-tab-badge">{{ tab.count }}</span>
      </div>
    </div>

    <!-- Tab Content -->
    <div class="fst-founders-body">

      <!-- ══════════════════════════════════════ TAB 1: FOUNDERS CRM -->
      <div v-if="activeTab === 'founders'" class="fst-tab-content">

        <!-- Filters -->
        <div class="fst-founders-filters">
          <span class="fst-search-wrap">
            <i class="pi pi-search" style="font-size:12px;color:var(--p-text-muted-color)" />
            <InputText v-model="foundersSearch" placeholder="Поиск основателя..." size="small" class="fst-search" />
          </span>
          <Select v-model="foundersFilterCompany" :options="companyOptions" placeholder="Все компании" size="small" class="fst-filter-sel" />
          <Select v-model="foundersFilterTag" :options="founderTagOptions" placeholder="Все теги" size="small" class="fst-filter-sel" />
        </div>

        <!-- Founders Grid -->
        <div class="fst-founders-grid">
          <div
            v-for="founder in filteredFounders"
            :key="founder.id"
            class="fst-founder-card"
            @click="selectFounder(founder)"
          >
            <div class="fst-founder-photo">
              <img v-if="founder.photoUrl" :src="founder.photoUrl" :alt="founder.name" />
              <i v-else class="pi pi-user" style="font-size:32px;color:var(--p-text-muted-color)"></i>
            </div>
            <div class="fst-founder-info">
              <div class="fst-founder-name">{{ founder.name }}</div>
              <div class="fst-founder-role">{{ founder.currentRole }} · {{ founder.companyName }}</div>
              <div class="fst-founder-meta">
                <span v-if="founder.equityShare">Доля: {{ founder.equityShare }}%</span>
                <span v-if="founder.status" class="fst-founder-status" :class="founder.status.toLowerCase()">{{ founder.status }}</span>
              </div>
              <div class="fst-founder-tags">
                <span v-for="tag in founder.tags" :key="tag" class="fst-tag">{{ tag }}</span>
              </div>
            </div>
            <div class="fst-founder-actions">
              <Button icon="pi pi-linkedin" text rounded size="small" @click.stop="openLink(founder.linkedin)" v-if="founder.linkedin" />
              <Button icon="pi pi-send" text rounded size="small" @click.stop="openLink('https://t.me/' + founder.telegram)" v-if="founder.telegram" />
              <Button icon="pi pi-envelope" text rounded size="small" @click.stop="openLink('mailto:' + founder.email)" v-if="founder.email" />
            </div>
          </div>
        </div>

        <!-- Empty State -->
        <div v-if="filteredFounders.length === 0 && !loading" class="fst-empty-state">
          <i class="pi pi-users" style="font-size:48px;color:var(--p-text-muted-color)"></i>
          <div class="fst-empty-title">Основатели не найдены</div>
          <div class="fst-empty-subtitle">Добавьте первого основателя в CRM</div>
          <Button label="Добавить основателя" icon="pi pi-plus" @click="showAddDialog = true" />
        </div>
      </div>

      <!-- ══════════════════════════════════════ TAB 2: MENTORS -->
      <div v-if="activeTab === 'mentors'" class="fst-tab-content">

        <!-- Filters -->
        <div class="fst-founders-filters">
          <span class="fst-search-wrap">
            <i class="pi pi-search" style="font-size:12px;color:var(--p-text-muted-color)" />
            <InputText v-model="mentorsSearch" placeholder="Поиск ментора..." size="small" class="fst-search" />
          </span>
          <Select v-model="mentorsFilterSpec" :options="mentorSpecOptions" placeholder="Все специализации" size="small" class="fst-filter-sel" />
          <Select v-model="mentorsFilterAvail" :options="availabilityOptions" placeholder="Все статусы" size="small" class="fst-filter-sel" />
        </div>

        <!-- Mentors Grid -->
        <div class="fst-mentors-grid">
          <div
            v-for="mentor in filteredMentors"
            :key="mentor.id"
            class="fst-mentor-card"
            @click="selectMentor(mentor)"
          >
            <div class="fst-mentor-photo">
              <img v-if="mentor.photoUrl" :src="mentor.photoUrl" :alt="mentor.name" />
              <i v-else class="pi pi-user" style="font-size:32px;color:var(--p-text-muted-color)"></i>
              <div class="fst-mentor-status-dot" :class="mentor.status.toLowerCase()" :title="mentor.status"></div>
            </div>
            <div class="fst-mentor-info">
              <div class="fst-mentor-name">{{ mentor.name }}</div>
              <div class="fst-mentor-specs">
                <span v-for="spec in mentor.specializations.slice(0, 2)" :key="spec" class="fst-spec-tag">{{ spec }}</span>
                <span v-if="mentor.specializations.length > 2" class="fst-spec-more">+{{ mentor.specializations.length - 2 }}</span>
              </div>
              <div class="fst-mentor-stats">
                <div class="fst-mentor-stat">
                  <i class="pi pi-clock"></i>
                  <span>{{ mentor.availabilityHours }}ч/мес</span>
                </div>
                <div class="fst-mentor-stat">
                  <i class="pi pi-chart-line"></i>
                  <span>{{ mentor.sessionsCount }} сессий</span>
                </div>
                <div class="fst-mentor-stat">
                  <i class="pi pi-star-fill" style="color:#ffa726"></i>
                  <span>{{ mentor.avgRating.toFixed(1) }}</span>
                </div>
              </div>
            </div>
            <div class="fst-mentor-actions">
              <Button icon="pi pi-linkedin" text rounded size="small" @click.stop="openLink(mentor.linkedin)" v-if="mentor.linkedin" />
              <Button icon="pi pi-envelope" text rounded size="small" @click.stop="openLink('mailto:' + mentor.email)" v-if="mentor.email" />
              <Button label="Назначить" size="small" @click.stop="showMatchDialog(mentor)" />
            </div>
          </div>
        </div>

        <!-- Empty State -->
        <div v-if="filteredMentors.length === 0 && !loading" class="fst-empty-state">
          <i class="pi pi-user-plus" style="font-size:48px;color:var(--p-text-muted-color)"></i>
          <div class="fst-empty-title">Менторы не найдены</div>
          <div class="fst-empty-subtitle">Добавьте первого ментора в базу</div>
          <Button label="Добавить ментора" icon="pi pi-plus" @click="showAddDialog = true" />
        </div>
      </div>

      <!-- ══════════════════════════════════════ TAB 3: AI MATCHING -->
      <div v-if="activeTab === 'matching'" class="fst-tab-content">

        <div class="fst-matching-container">
          <!-- AI Matching Interface -->
          <div class="fst-matching-panel">
            <div class="fst-panel-title">
              <i class="pi pi-bolt" style="color:#ffa726"></i>
              AI Mentor Matching
            </div>
            <div class="fst-panel-subtitle">
              Автоматический подбор ментора на основе рисков и потребностей компании
            </div>

            <!-- Request Form -->
            <div class="fst-matching-form">
              <div class="fst-form-row">
                <label>Компания</label>
                <Select v-model="matchingRequest.company" :options="companyOptions" placeholder="Выберите компанию" class="w-full" />
              </div>
              <div class="fst-form-row">
                <label>Требуемая экспертиза</label>
                <MultiSelect v-model="matchingRequest.expertiseNeeded" :options="mentorSpecOptions" placeholder="Выберите области" class="w-full" />
              </div>
              <div class="fst-form-row">
                <label>Описание проблемы</label>
                <Textarea v-model="matchingRequest.problemDescription" rows="4" placeholder="Опишите проблему или задачу, для которой нужен ментор..." class="w-full" />
              </div>
              <div class="fst-form-row">
                <label>Приоритет</label>
                <Select v-model="matchingRequest.priority" :options="['High', 'Medium', 'Low']" placeholder="Выберите приоритет" class="w-full" />
              </div>
              <Button label="Найти ментора с помощью AI" icon="pi pi-bolt" @click="runAIMatching" :loading="aiMatchingLoading" class="w-full" />
            </div>

            <!-- AI Results -->
            <div v-if="aiMatchingResults.length > 0" class="fst-matching-results">
              <div class="fst-results-title">Рекомендации AI:</div>
              <div v-for="(result, idx) in aiMatchingResults" :key="idx" class="fst-matching-result">
                <div class="fst-result-header">
                  <span class="fst-result-rank">#{{ idx + 1 }}</span>
                  <span class="fst-result-name">{{ result.mentorName }}</span>
                  <span class="fst-result-score" :style="{ color: getScoreColor(result.matchScore) }">{{ result.matchScore }}% match</span>
                </div>
                <div class="fst-result-reasoning">{{ result.reasoning }}</div>
                <div class="fst-result-actions">
                  <Button label="Выбрать ментора" size="small" @click="selectAIMentor(result)" />
                </div>
              </div>
            </div>
          </div>

          <!-- Active Matching Requests -->
          <div class="fst-matching-sidebar">
            <div class="fst-sidebar-title">Активные запросы ({{ matchingRequests.length }})</div>
            <div class="fst-matching-request-list">
              <div v-for="req in matchingRequests" :key="req.id" class="fst-request-item" @click="viewRequest(req)">
                <div class="fst-request-header">
                  <span class="fst-request-company">{{ req.companyName }}</span>
                  <span class="fst-request-status" :class="req.status.toLowerCase()">{{ req.status }}</span>
                </div>
                <div class="fst-request-expertise">{{ req.expertiseNeeded.slice(0, 2).join(', ') }}</div>
                <div class="fst-request-date">{{ formatDate(req.dateCreated) }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ══════════════════════════════════════ TAB 4: ALUMNI & NETWORKING -->
      <div v-if="activeTab === 'alumni'" class="fst-tab-content">

        <div class="fst-alumni-header">
          <div>
            <h3>Alumni Network & Networking Events</h3>
            <p>Тематические встречи портфельных компаний и основателей</p>
          </div>
          <Button label="Создать событие" icon="pi pi-plus" @click="showEventDialog = true" />
        </div>

        <!-- Upcoming Events -->
        <div class="fst-events-section">
          <div class="fst-section-title">Предстоящие события</div>
          <div class="fst-events-grid">
            <div v-for="event in upcomingEvents" :key="event.id" class="fst-event-card">
              <div class="fst-event-header">
                <div class="fst-event-date">
                  <div class="fst-event-day">{{ formatDay(event.date) }}</div>
                  <div class="fst-event-month">{{ formatMonth(event.date) }}</div>
                </div>
                <div class="fst-event-info">
                  <div class="fst-event-name">{{ event.name }}</div>
                  <div class="fst-event-meta">
                    <span><i class="pi pi-map-marker"></i> {{ event.location }}</span>
                    <span><i class="pi pi-tag"></i> {{ event.subfund }}</span>
                    <span><i class="pi pi-users"></i> {{ event.participantCount }} участников</span>
                  </div>
                </div>
              </div>
              <div class="fst-event-description">{{ event.description }}</div>
              <div class="fst-event-actions">
                <Button label="Подробнее" size="small" text @click="viewEvent(event)" />
                <Button label="Участники" size="small" icon="pi pi-users" @click="viewEventParticipants(event)" />
              </div>
            </div>
          </div>
        </div>

        <!-- Alumni Directory -->
        <div class="fst-alumni-section">
          <div class="fst-section-title">Alumni Directory ({{ alumniFounders.length }})</div>
          <div class="fst-alumni-grid">
            <div v-for="founder in alumniFounders" :key="founder.id" class="fst-alumni-card">
              <div class="fst-alumni-photo">
                <img v-if="founder.photoUrl" :src="founder.photoUrl" :alt="founder.name" />
                <i v-else class="pi pi-user"></i>
              </div>
              <div class="fst-alumni-name">{{ founder.name }}</div>
              <div class="fst-alumni-company">{{ founder.companyName }}</div>
              <div class="fst-alumni-outcome">{{ founder.outcome }}</div>
            </div>
          </div>
        </div>
      </div>

    </div>

    <!-- ══════════════════════════════════════ DIALOGS -->

    <!-- Founder Detail Dialog -->
    <Dialog v-model:visible="showFounderDialog" modal :header="selectedFounder?.name" :style="{ width: '50rem' }">
      <div v-if="selectedFounder" class="fst-founder-detail">
        <div class="fst-detail-section">
          <h4>Профиль</h4>
          <div class="fst-detail-row"><span>Роль:</span><strong>{{ selectedFounder.currentRole }}</strong></div>
          <div class="fst-detail-row"><span>Компания:</span><strong>{{ selectedFounder.companyName }}</strong></div>
          <div class="fst-detail-row"><span>Доля:</span><strong>{{ selectedFounder.equityShare }}%</strong></div>
          <div class="fst-detail-row"><span>Email:</span><strong>{{ selectedFounder.email }}</strong></div>
          <div class="fst-detail-row"><span>Telegram:</span><strong>@{{ selectedFounder.telegram }}</strong></div>
        </div>
        <div class="fst-detail-section">
          <h4>Биография</h4>
          <div v-html="selectedFounder.biography"></div>
        </div>
        <div class="fst-detail-section">
          <h4>История компаний</h4>
          <div v-for="hist in selectedFounder.companyHistory" :key="hist.id" class="fst-history-item">
            <div class="fst-history-company">{{ hist.companyName }}</div>
            <div class="fst-history-role">{{ hist.role }} · {{ hist.equityShare }}%</div>
            <div class="fst-history-dates">{{ formatYear(hist.startDate) }} - {{ hist.endDate ? formatYear(hist.endDate) : 'настоящее время' }}</div>
            <div class="fst-history-outcome" :class="hist.outcome.toLowerCase()">{{ hist.outcome }}</div>
          </div>
        </div>
        <div class="fst-detail-section">
          <h4>История взаимодействий с ФСТ</h4>
          <div v-for="interaction in selectedFounder.interactions" :key="interaction.id" class="fst-interaction-item">
            <div class="fst-interaction-header">
              <span class="fst-interaction-type">{{ interaction.type }}</span>
              <span class="fst-interaction-date">{{ formatDate(interaction.date) }}</span>
            </div>
            <div class="fst-interaction-summary">{{ interaction.summary }}</div>
            <div class="fst-interaction-rep">С участием: {{ interaction.fstRepresentative }}</div>
          </div>
        </div>
      </div>
    </Dialog>

    <!-- Mentor Detail Dialog -->
    <Dialog v-model:visible="showMentorDialog" modal :header="selectedMentor?.name" :style="{ width: '50rem' }">
      <div v-if="selectedMentor" class="fst-mentor-detail">
        <div class="fst-detail-section">
          <h4>Профиль</h4>
          <div class="fst-detail-row"><span>Специализации:</span><strong>{{ selectedMentor.specializations.join(', ') }}</strong></div>
          <div class="fst-detail-row"><span>Доступность:</span><strong>{{ selectedMentor.availabilityHours }} часов/месяц</strong></div>
          <div class="fst-detail-row"><span>Проведено сессий:</span><strong>{{ selectedMentor.sessionsCount }}</strong></div>
          <div class="fst-detail-row"><span>Рейтинг:</span><strong>{{ selectedMentor.avgRating.toFixed(1) }} / 5.0</strong></div>
          <div class="fst-detail-row"><span>Статус:</span><strong>{{ selectedMentor.status }}</strong></div>
        </div>
        <div class="fst-detail-section">
          <h4>Биография и опыт</h4>
          <div v-html="selectedMentor.biography"></div>
        </div>
        <div class="fst-detail-section">
          <h4>Последние сессии</h4>
          <div v-for="session in selectedMentor.recentSessions" :key="session.id" class="fst-session-item">
            <div class="fst-session-header">
              <span class="fst-session-title">{{ session.title }}</span>
              <span class="fst-session-date">{{ formatDate(session.date) }}</span>
            </div>
            <div class="fst-session-company">{{ session.companyName }} · {{ session.durationHours }}ч</div>
            <div class="fst-session-rating">Оценка: {{ session.companyRating }}/5</div>
          </div>
        </div>
      </div>
    </Dialog>

    <!-- Add Dialog -->
    <Dialog v-model:visible="showAddDialog" modal header="Добавить" :style="{ width: '40rem' }">
      <div class="fst-add-form">
        <div class="fst-form-row">
          <label>Тип</label>
          <Select v-model="addType" :options="['Founder', 'Mentor']" placeholder="Выберите тип" class="w-full" />
        </div>
        <div v-if="addType === 'Founder'">
          <div class="fst-form-row">
            <label>ФИО</label>
            <InputText v-model="newFounder.name" placeholder="Иванов Иван Иванович" class="w-full" />
          </div>
          <div class="fst-form-row">
            <label>Компания</label>
            <Select v-model="newFounder.company" :options="companyOptions" placeholder="Выберите компанию" class="w-full" />
          </div>
          <div class="fst-form-row">
            <label>Роль</label>
            <InputText v-model="newFounder.role" placeholder="CEO, CTO, Co-founder..." class="w-full" />
          </div>
          <div class="fst-form-row">
            <label>Email</label>
            <InputText v-model="newFounder.email" type="email" placeholder="founder@company.com" class="w-full" />
          </div>
        </div>
        <div v-if="addType === 'Mentor'">
          <div class="fst-form-row">
            <label>ФИО</label>
            <InputText v-model="newMentor.name" placeholder="Петров Петр Петрович" class="w-full" />
          </div>
          <div class="fst-form-row">
            <label>Специализации</label>
            <MultiSelect v-model="newMentor.specializations" :options="mentorSpecOptions" placeholder="Выберите специализации" class="w-full" />
          </div>
          <div class="fst-form-row">
            <label>Email</label>
            <InputText v-model="newMentor.email" type="email" placeholder="mentor@example.com" class="w-full" />
          </div>
          <div class="fst-form-row">
            <label>Доступность (часов/месяц)</label>
            <InputNumber v-model="newMentor.availabilityHours" :min="1" :max="100" class="w-full" />
          </div>
        </div>
        <Button :label="'Создать ' + (addType === 'Founder' ? 'основателя' : 'ментора')" icon="pi pi-check" @click="createEntity" class="w-full" style="margin-top:12px" />
      </div>
    </Dialog>

  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import Button from 'primevue/button'
import Tag from 'primevue/tag'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import MultiSelect from 'primevue/multiselect'
import Textarea from 'primevue/textarea'
import InputNumber from 'primevue/inputnumber'
import Dialog from 'primevue/dialog'

const router = useRouter()

// ── State ──────────────────────────────────────────────────────────────────
const loading = ref(false)
const activeTab = ref('founders')

// Founders
const founders = ref([])
const foundersSearch = ref('')
const foundersFilterCompany = ref(null)
const foundersFilterTag = ref(null)
const selectedFounder = ref(null)
const showFounderDialog = ref(false)

// Mentors
const mentors = ref([])
const mentorsSearch = ref('')
const mentorsFilterSpec = ref(null)
const mentorsFilterAvail = ref(null)
const selectedMentor = ref(null)
const showMentorDialog = ref(false)

// AI Matching
const matchingRequest = ref({
  company: null,
  expertiseNeeded: [],
  problemDescription: '',
  priority: 'Medium'
})
const aiMatchingLoading = ref(false)
const aiMatchingResults = ref([])
const matchingRequests = ref([])

// Alumni & Events
const upcomingEvents = ref([])
const alumniFounders = ref([])
const showEventDialog = ref(false)

// Add Dialog
const showAddDialog = ref(false)
const addType = ref('Founder')
const newFounder = ref({ name: '', company: null, role: '', email: '' })
const newMentor = ref({ name: '', specializations: [], email: '', availabilityHours: 20 })

// ── Tabs ───────────────────────────────────────────────────────────────────
const tabs = computed(() => [
  { id: 'founders', label: 'Founders CRM', icon: 'pi pi-users', count: founders.value.length },
  { id: 'mentors', label: 'База менторов', icon: 'pi pi-user-plus', count: mentors.value.length },
  { id: 'matching', label: 'AI Matching', icon: 'pi pi-bolt', count: matchingRequests.value.filter(r => r.status === 'Open').length },
  { id: 'alumni', label: 'Alumni & Events', icon: 'pi pi-calendar', count: upcomingEvents.value.length }
])

// ── Options ────────────────────────────────────────────────────────────────
const companyOptions = ['АвиаЛогик', 'НейроПилот', 'РоботМед', 'ЧипРус', 'АгроВижн']
const founderTagOptions = ['Все теги', 'Сильный технарь', 'Сильный продавец', 'Нужна поддержка', 'Отличный нетворкер', 'Опыт B2G']
const mentorSpecOptions = ['БПЛА-инженерия', 'Авионика', 'Продажи гос.заказчику', 'IP и патенты', 'Производство и сертификация', 'Финансирование', 'Product Management', 'Go-to-market B2G']
const availabilityOptions = ['Все статусы', 'Active', 'Busy', 'On Leave']

// ── Computed ───────────────────────────────────────────────────────────────
const founderCount = computed(() => founders.value.length)
const mentorCount = computed(() => mentors.value.length)

const filteredFounders = computed(() => {
  let result = founders.value
  if (foundersSearch.value) {
    const search = foundersSearch.value.toLowerCase()
    result = result.filter(f =>
      f.name.toLowerCase().includes(search) ||
      f.companyName.toLowerCase().includes(search) ||
      f.currentRole.toLowerCase().includes(search)
    )
  }
  if (foundersFilterCompany.value && foundersFilterCompany.value !== 'Все компании') {
    result = result.filter(f => f.companyName === foundersFilterCompany.value)
  }
  if (foundersFilterTag.value && foundersFilterTag.value !== 'Все теги') {
    result = result.filter(f => f.tags.includes(foundersFilterTag.value))
  }
  return result
})

const filteredMentors = computed(() => {
  let result = mentors.value
  if (mentorsSearch.value) {
    const search = mentorsSearch.value.toLowerCase()
    result = result.filter(m =>
      m.name.toLowerCase().includes(search) ||
      m.specializations.some(s => s.toLowerCase().includes(search))
    )
  }
  if (mentorsFilterSpec.value && mentorsFilterSpec.value !== 'Все специализации') {
    result = result.filter(m => m.specializations.includes(mentorsFilterSpec.value))
  }
  if (mentorsFilterAvail.value && mentorsFilterAvail.value !== 'Все статусы') {
    result = result.filter(m => m.status === mentorsFilterAvail.value)
  }
  return result
})

// ── Methods ────────────────────────────────────────────────────────────────
function refreshAll() {
  loading.value = true
  loadFounders()
  loadMentors()
  loadMatchingRequests()
  loadEvents()
  setTimeout(() => { loading.value = false }, 500)
}

function loadFounders() {
  // Demo data - в реальности загружается через Integram API
  founders.value = [
    {
      id: 1,
      name: 'Петров Дмитрий Алексеевич',
      photoUrl: null,
      currentRole: 'CEO & Founder',
      companyName: 'АвиаЛогик',
      equityShare: 45,
      status: 'Active',
      tags: ['Сильный технарь', 'Опыт B2G'],
      linkedin: 'https://linkedin.com/in/petrov',
      telegram: 'petrov_dmitry',
      email: 'petrov@avialogic.ru',
      biography: '<p>15 лет опыта в разработке систем управления БПЛА. Закончил МФТИ (аэрокосмический факультет). Ранее работал ведущим инженером в НИИ ВВС.</p>',
      companyHistory: [
        { id: 1, companyName: 'НИИ ВВС', role: 'Ведущий инженер', equityShare: 0, startDate: '2010-01-01', endDate: '2021-01-01', outcome: 'Left' },
        { id: 2, companyName: 'АвиаЛогик', role: 'CEO & Founder', equityShare: 45, startDate: '2021-01-01', endDate: null, outcome: 'Active' }
      ],
      interactions: [
        { id: 1, type: 'Встреча', date: '2026-02-15', summary: 'Обсуждение прогресса по TRL 7. Показали работающий прототип на базе 30 БПЛА.', fstRepresentative: 'Иванов А.В.' },
        { id: 2, type: 'Звонок', date: '2026-01-20', summary: 'Консультация по вопросам сертификации. Направили к ментору Новикову С.', fstRepresentative: 'Смирнова Е.П.' }
      ]
    },
    {
      id: 2,
      name: 'Соколова Мария Владимировна',
      photoUrl: null,
      currentRole: 'CEO',
      companyName: 'НейроПилот',
      equityShare: 38,
      status: 'Active',
      tags: ['Сильный продавец', 'Отличный нетворкер'],
      linkedin: 'https://linkedin.com/in/sokolova',
      telegram: 'sokolova_maria',
      email: 'sokolova@neuropilot.ai',
      biography: '<p>10 лет опыта в AI и компьютерном зрении. MBA Skolkovo. Ранее Head of Sales в международной AI-компании.</p>',
      companyHistory: [],
      interactions: []
    },
    {
      id: 3,
      name: 'Карпов Иван Сергеевич',
      photoUrl: null,
      currentRole: 'CTO & Co-founder',
      companyName: 'РоботМед',
      equityShare: 52,
      status: 'Active',
      tags: ['Нужна поддержка', 'Регуляторика'],
      linkedin: null,
      telegram: 'karpov_ivan',
      email: 'karpov@robotmed.ru',
      biography: '<p>Врач-хирург с опытом 20 лет. Профессор кафедры хирургии Сеченовского университета. Основатель РоботМед для развития минимально инвазивной хирургии.</p>',
      companyHistory: [],
      interactions: []
    }
  ]
}

function loadMentors() {
  // Demo data
  mentors.value = [
    {
      id: 1,
      name: 'Иванов Алексей Николаевич',
      photoUrl: null,
      specializations: ['БПЛА-инженерия', 'Авионика', 'Сертификация'],
      biography: '<p>25 лет опыта в авиации. Руководитель отдела R&D в крупном БПЛА-производителе. Эксперт по сертификации и импортозамещению.</p>',
      linkedin: 'https://linkedin.com/in/ivanov',
      email: 'ivanov@example.com',
      phone: '+7 (999) 123-45-67',
      availabilityHours: 20,
      sessionsCount: 15,
      avgRating: 4.8,
      status: 'Active',
      dateAdded: '2025-06-01',
      recentSessions: [
        { id: 1, title: 'Консультация по TRL 7', date: '2026-02-10', companyName: 'АвиаЛогик', durationHours: 2, companyRating: 5 },
        { id: 2, title: 'Стратегия сертификации', date: '2026-01-25', companyName: 'НейроПилот', durationHours: 1.5, companyRating: 5 }
      ]
    },
    {
      id: 2,
      name: 'Смирнова Елена Павловна',
      photoUrl: null,
      specializations: ['Продажи гос.заказчику', 'Go-to-market B2G'],
      biography: '<p>15 лет опыта работы с госзаказчиками. Руководитель отдела продаж в ОПК. Эксперт по закупкам 44-ФЗ и 223-ФЗ.</p>',
      linkedin: null,
      email: 'smirnova@example.com',
      phone: '+7 (999) 234-56-78',
      availabilityHours: 15,
      sessionsCount: 22,
      avgRating: 4.9,
      status: 'Active',
      dateAdded: '2025-05-15',
      recentSessions: []
    },
    {
      id: 3,
      name: 'Новиков Сергей Владимирович',
      photoUrl: null,
      specializations: ['IP и патенты', 'Производство и сертификация'],
      biography: '<p>Патентный поверенный с 20-летним опытом. Зарегистрировано 150+ патентов в России и за рубежом. Эксперт ФИПС.</p>',
      linkedin: 'https://linkedin.com/in/novikov',
      email: 'novikov@example.com',
      phone: null,
      availabilityHours: 10,
      sessionsCount: 18,
      avgRating: 4.7,
      status: 'Busy',
      dateAdded: '2025-07-01',
      recentSessions: []
    }
  ]
}

function loadMatchingRequests() {
  matchingRequests.value = [
    {
      id: 1,
      companyName: 'АвиаЛогик',
      expertiseNeeded: ['Сертификация', 'Регуляторика'],
      problemDescription: 'Нужна помощь с получением сертификата типа для роя БПЛА',
      priority: 'High',
      status: 'Open',
      dateCreated: '2026-03-01'
    },
    {
      id: 2,
      companyName: 'РоботМед',
      expertiseNeeded: ['Финансирование', 'Product Management'],
      problemDescription: 'Подготовка к Round B, нужна стратегия масштабирования',
      priority: 'Medium',
      status: 'Matched',
      dateCreated: '2026-02-28',
      dateMatched: '2026-03-05'
    }
  ]
}

function loadEvents() {
  upcomingEvents.value = [
    {
      id: 1,
      name: 'БАС Meetup Q1 2026',
      description: 'Ежеквартальная встреча всех портфельных компаний субфонда БАС. Обмен опытом, нетворкинг, обсуждение трендов индустрии.',
      date: '2026-03-25',
      location: 'Сколково Технопарк',
      subfund: 'БАС',
      participantCount: 15,
      format: 'Offline'
    },
    {
      id: 2,
      name: 'Robotics Innovation Summit',
      description: 'Конференция для компаний субфонда РОБО. Презентации новых решений, демо-зона, встречи с потенциальными клиентами.',
      date: '2026-04-10',
      location: 'Online',
      subfund: 'РОБО',
      participantCount: 22,
      format: 'Online'
    }
  ]

  alumniFounders.value = [
    {
      id: 10,
      name: 'Сидоров Петр',
      photoUrl: null,
      companyName: 'ДронТех (exit 2025)',
      outcome: 'Acquired by Ростех'
    }
  ]
}

function selectFounder(founder) {
  selectedFounder.value = founder
  showFounderDialog.value = true
}

function selectMentor(mentor) {
  selectedMentor.value = mentor
  showMentorDialog.value = true
}

function showMatchDialog(mentor) {
  console.log('Show match dialog for mentor:', mentor.name)
  // TODO: Open matching dialog
}

async function runAIMatching() {
  aiMatchingLoading.value = true
  // Simulate AI call
  await new Promise(resolve => setTimeout(resolve, 2000))

  // Demo AI results
  aiMatchingResults.value = [
    {
      mentorName: 'Иванов Алексей Николаевич',
      matchScore: 95,
      reasoning: 'Наиболее релевантный ментор: 25 лет опыта в БПЛА-инженерии, эксперт по сертификации. Проводил успешные сессии с АвиаЛогик ранее. Высокая доступность (20ч/мес) и отличный рейтинг 4.8/5.'
    },
    {
      mentorName: 'Новиков Сергей Владимирович',
      matchScore: 82,
      reasoning: 'Патентный поверенный с опытом ФИПС. Специализируется на сертификации и производстве. Ограниченная доступность (10ч/мес), но глубокая экспертиза в регуляторике.'
    },
    {
      mentorName: 'Смирнова Елена Павловна',
      matchScore: 65,
      reasoning: 'Опыт работы с госзаказчиками может быть полезен для понимания требований Минобороны к сертификации БПЛА. Хорошая доступность и высокий рейтинг 4.9/5.'
    }
  ]

  aiMatchingLoading.value = false
}

function selectAIMentor(result) {
  console.log('Selected AI mentor:', result.mentorName)
  // TODO: Assign mentor to request
}

function viewRequest(req) {
  console.log('View request:', req)
}

function viewEvent(event) {
  console.log('View event:', event)
}

function viewEventParticipants(event) {
  console.log('View participants for event:', event.name)
}

function createEntity() {
  if (addType.value === 'Founder') {
    console.log('Create founder:', newFounder.value)
    // TODO: API call to create founder
  } else {
    console.log('Create mentor:', newMentor.value)
    // TODO: API call to create mentor
  }
  showAddDialog.value = false
}

function openLink(url) {
  if (url) window.open(url, '_blank')
}

function getScoreColor(score) {
  if (score >= 90) return '#66bb6a'
  if (score >= 75) return '#ffa726'
  return '#ef5350'
}

function formatDate(dateStr) {
  if (!dateStr) return '-'
  const date = new Date(dateStr)
  return date.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short', year: 'numeric' })
}

function formatDay(dateStr) {
  const date = new Date(dateStr)
  return date.getDate()
}

function formatMonth(dateStr) {
  const date = new Date(dateStr)
  return date.toLocaleDateString('ru-RU', { month: 'short' }).toUpperCase()
}

function formatYear(dateStr) {
  return new Date(dateStr).getFullYear()
}

// ── Lifecycle ──────────────────────────────────────────────────────────────
onMounted(() => {
  refreshAll()
})
</script>

<style scoped>
/* ══════════════════════════════════════════════════════════════════════════
   ROOT & LAYOUT
   ══════════════════════════════════════════════════════════════════════════ */
.fst-founders-root {
  min-height: 100vh;
  background: var(--p-surface-ground);
  padding: 24px;
}

/* ══════════════════════════════════════════════════════════════════════════
   HEADER
   ══════════════════════════════════════════════════════════════════════════ */
.fst-founders-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 24px;
  padding: 20px;
  background: var(--p-surface-card);
  border-radius: 12px;
  border: 1px solid var(--p-surface-border);
}

.fst-founders-logo {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 16px;
  color: var(--p-text-color);
  margin-bottom: 8px;
}

.fst-founders-subtitle {
  font-size: 14px;
  color: var(--p-text-muted-color);
  margin-left: 32px;
}

.fst-founders-header-right {
  display: flex;
  gap: 8px;
}

/* ══════════════════════════════════════════════════════════════════════════
   TABS
   ══════════════════════════════════════════════════════════════════════════ */
.fst-founders-tabs {
  display: flex;
  gap: 4px;
  margin-bottom: 24px;
  background: var(--p-surface-card);
  padding: 4px;
  border-radius: 12px;
  border: 1px solid var(--p-surface-border);
}

.fst-founders-tab {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px 20px;
  font-size: 14px;
  font-weight: 500;
  color: var(--p-text-muted-color);
  background: transparent;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.fst-founders-tab:hover {
  background: var(--p-surface-hover);
  color: var(--p-text-color);
}

.fst-founders-tab.active {
  background: var(--p-primary-color);
  color: white;
}

.fst-tab-badge {
  background: rgba(255,255,255,0.2);
  color: white;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 600;
}

.fst-founders-tab:not(.active) .fst-tab-badge {
  background: var(--p-surface-100);
  color: var(--p-text-muted-color);
}

/* ══════════════════════════════════════════════════════════════════════════
   TAB CONTENT
   ══════════════════════════════════════════════════════════════════════════ */
.fst-tab-content {
  animation: fadeIn 0.3s;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

/* ══════════════════════════════════════════════════════════════════════════
   FILTERS
   ══════════════════════════════════════════════════════════════════════════ */
.fst-founders-filters {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
  padding: 16px;
  background: var(--p-surface-card);
  border-radius: 12px;
  border: 1px solid var(--p-surface-border);
}

.fst-search-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  max-width: 400px;
  padding: 0 12px;
  background: var(--p-surface-ground);
  border-radius: 8px;
}

.fst-search {
  border: none;
  background: transparent;
  flex: 1;
}

.fst-filter-sel {
  min-width: 180px;
}

/* ══════════════════════════════════════════════════════════════════════════
   FOUNDERS GRID
   ══════════════════════════════════════════════════════════════════════════ */
.fst-founders-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 16px;
}

.fst-founder-card {
  display: flex;
  gap: 16px;
  padding: 20px;
  background: var(--p-surface-card);
  border: 1px solid var(--p-surface-border);
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.fst-founder-card:hover {
  border-color: var(--p-primary-color);
  box-shadow: 0 4px 12px rgba(0,0,0,0.08);
  transform: translateY(-2px);
}

.fst-founder-photo {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: var(--p-surface-100);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  flex-shrink: 0;
}

.fst-founder-photo img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.fst-founder-info {
  flex: 1;
  min-width: 0;
}

.fst-founder-name {
  font-size: 16px;
  font-weight: 600;
  color: var(--p-text-color);
  margin-bottom: 4px;
}

.fst-founder-role {
  font-size: 13px;
  color: var(--p-text-muted-color);
  margin-bottom: 8px;
}

.fst-founder-meta {
  display: flex;
  gap: 12px;
  font-size: 12px;
  color: var(--p-text-muted-color);
  margin-bottom: 8px;
}

.fst-founder-status {
  padding: 2px 8px;
  border-radius: 4px;
  font-weight: 500;
}

.fst-founder-status.active {
  background: #e8f5e9;
  color: #2e7d32;
}

.fst-founder-status.alumni {
  background: #e3f2fd;
  color: #1976d2;
}

.fst-founder-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.fst-tag {
  padding: 4px 10px;
  background: var(--p-surface-100);
  color: var(--p-text-color);
  font-size: 11px;
  border-radius: 6px;
  font-weight: 500;
}

.fst-founder-actions {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

/* ══════════════════════════════════════════════════════════════════════════
   MENTORS GRID
   ══════════════════════════════════════════════════════════════════════════ */
.fst-mentors-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
  gap: 16px;
}

.fst-mentor-card {
  display: flex;
  gap: 16px;
  padding: 20px;
  background: var(--p-surface-card);
  border: 1px solid var(--p-surface-border);
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.fst-mentor-card:hover {
  border-color: #66bb6a;
  box-shadow: 0 4px 12px rgba(0,0,0,0.08);
  transform: translateY(-2px);
}

.fst-mentor-photo {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: var(--p-surface-100);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  flex-shrink: 0;
  position: relative;
}

.fst-mentor-photo img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.fst-mentor-status-dot {
  position: absolute;
  bottom: 2px;
  right: 2px;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 2px solid var(--p-surface-card);
}

.fst-mentor-status-dot.active {
  background: #66bb6a;
}

.fst-mentor-status-dot.busy {
  background: #ffa726;
}

.fst-mentor-status-dot.on {
  background: #ef5350;
}

.fst-mentor-info {
  flex: 1;
  min-width: 0;
}

.fst-mentor-name {
  font-size: 16px;
  font-weight: 600;
  color: var(--p-text-color);
  margin-bottom: 8px;
}

.fst-mentor-specs {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 12px;
}

.fst-spec-tag {
  padding: 4px 10px;
  background: #e3f2fd;
  color: #1976d2;
  font-size: 11px;
  border-radius: 6px;
  font-weight: 500;
}

.fst-spec-more {
  padding: 4px 10px;
  background: var(--p-surface-100);
  color: var(--p-text-muted-color);
  font-size: 11px;
  border-radius: 6px;
  font-weight: 500;
}

.fst-mentor-stats {
  display: flex;
  gap: 16px;
  font-size: 12px;
}

.fst-mentor-stat {
  display: flex;
  align-items: center;
  gap: 4px;
  color: var(--p-text-muted-color);
}

.fst-mentor-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: flex-end;
}

/* ══════════════════════════════════════════════════════════════════════════
   AI MATCHING
   ══════════════════════════════════════════════════════════════════════════ */
.fst-matching-container {
  display: grid;
  grid-template-columns: 1fr 350px;
  gap: 20px;
}

.fst-matching-panel {
  background: var(--p-surface-card);
  border: 1px solid var(--p-surface-border);
  border-radius: 12px;
  padding: 24px;
}

.fst-panel-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--p-text-color);
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
}

.fst-panel-subtitle {
  font-size: 14px;
  color: var(--p-text-muted-color);
  margin-bottom: 24px;
}

.fst-matching-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.fst-form-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.fst-form-row label {
  font-size: 13px;
  font-weight: 500;
  color: var(--p-text-color);
}

.fst-matching-results {
  margin-top: 24px;
  padding-top: 24px;
  border-top: 1px solid var(--p-surface-border);
}

.fst-results-title {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 16px;
  color: var(--p-text-color);
}

.fst-matching-result {
  padding: 16px;
  background: var(--p-surface-ground);
  border-radius: 8px;
  margin-bottom: 12px;
}

.fst-result-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.fst-result-rank {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--p-primary-color);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 14px;
}

.fst-result-name {
  flex: 1;
  font-weight: 600;
  color: var(--p-text-color);
}

.fst-result-score {
  font-weight: 600;
  font-size: 14px;
}

.fst-result-reasoning {
  font-size: 13px;
  color: var(--p-text-muted-color);
  line-height: 1.6;
  margin-bottom: 12px;
}

.fst-result-actions {
  display: flex;
  justify-content: flex-end;
}

.fst-matching-sidebar {
  background: var(--p-surface-card);
  border: 1px solid var(--p-surface-border);
  border-radius: 12px;
  padding: 20px;
  height: fit-content;
}

.fst-sidebar-title {
  font-size: 15px;
  font-weight: 600;
  margin-bottom: 16px;
  color: var(--p-text-color);
}

.fst-matching-request-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.fst-request-item {
  padding: 12px;
  background: var(--p-surface-ground);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.fst-request-item:hover {
  background: var(--p-surface-hover);
}

.fst-request-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.fst-request-company {
  font-weight: 600;
  font-size: 13px;
  color: var(--p-text-color);
}

.fst-request-status {
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
}

.fst-request-status.open {
  background: #fff3e0;
  color: #f57c00;
}

.fst-request-status.matched {
  background: #e8f5e9;
  color: #2e7d32;
}

.fst-request-expertise {
  font-size: 12px;
  color: var(--p-text-muted-color);
  margin-bottom: 4px;
}

.fst-request-date {
  font-size: 11px;
  color: var(--p-text-muted-color);
}

/* ══════════════════════════════════════════════════════════════════════════
   ALUMNI & EVENTS
   ══════════════════════════════════════════════════════════════════════════ */
.fst-alumni-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 20px;
  background: var(--p-surface-card);
  border-radius: 12px;
  border: 1px solid var(--p-surface-border);
  margin-bottom: 24px;
}

.fst-alumni-header h3 {
  font-size: 20px;
  font-weight: 600;
  margin: 0 0 6px 0;
  color: var(--p-text-color);
}

.fst-alumni-header p {
  margin: 0;
  font-size: 14px;
  color: var(--p-text-muted-color);
}

.fst-events-section {
  margin-bottom: 32px;
}

.fst-section-title {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 16px;
  color: var(--p-text-color);
}

.fst-events-grid {
  display: grid;
  gap: 16px;
}

.fst-event-card {
  padding: 20px;
  background: var(--p-surface-card);
  border: 1px solid var(--p-surface-border);
  border-radius: 12px;
  transition: all 0.2s;
}

.fst-event-card:hover {
  border-color: var(--p-primary-color);
  box-shadow: 0 4px 12px rgba(0,0,0,0.08);
}

.fst-event-header {
  display: flex;
  gap: 16px;
  margin-bottom: 16px;
}

.fst-event-date {
  width: 64px;
  height: 64px;
  background: var(--p-primary-color);
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: white;
  flex-shrink: 0;
}

.fst-event-day {
  font-size: 24px;
  font-weight: 700;
  line-height: 1;
}

.fst-event-month {
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  margin-top: 4px;
}

.fst-event-info {
  flex: 1;
}

.fst-event-name {
  font-size: 16px;
  font-weight: 600;
  color: var(--p-text-color);
  margin-bottom: 8px;
}

.fst-event-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  font-size: 12px;
  color: var(--p-text-muted-color);
}

.fst-event-meta span {
  display: flex;
  align-items: center;
  gap: 4px;
}

.fst-event-description {
  font-size: 14px;
  color: var(--p-text-muted-color);
  line-height: 1.6;
  margin-bottom: 16px;
}

.fst-event-actions {
  display: flex;
  gap: 8px;
}

.fst-alumni-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 16px;
}

.fst-alumni-card {
  padding: 20px;
  background: var(--p-surface-card);
  border: 1px solid var(--p-surface-border);
  border-radius: 12px;
  text-align: center;
}

.fst-alumni-photo {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: var(--p-surface-100);
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 12px;
  overflow: hidden;
}

.fst-alumni-photo img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.fst-alumni-photo i {
  font-size: 32px;
  color: var(--p-text-muted-color);
}

.fst-alumni-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--p-text-color);
  margin-bottom: 4px;
}

.fst-alumni-company {
  font-size: 12px;
  color: var(--p-text-muted-color);
  margin-bottom: 4px;
}

.fst-alumni-outcome {
  font-size: 11px;
  color: #66bb6a;
  font-weight: 500;
}

/* ══════════════════════════════════════════════════════════════════════════
   EMPTY STATE
   ══════════════════════════════════════════════════════════════════════════ */
.fst-empty-state {
  text-align: center;
  padding: 64px 20px;
  background: var(--p-surface-card);
  border: 1px solid var(--p-surface-border);
  border-radius: 12px;
}

.fst-empty-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--p-text-color);
  margin: 16px 0 8px;
}

.fst-empty-subtitle {
  font-size: 14px;
  color: var(--p-text-muted-color);
  margin-bottom: 24px;
}

/* ══════════════════════════════════════════════════════════════════════════
   DETAIL DIALOGS
   ══════════════════════════════════════════════════════════════════════════ */
.fst-founder-detail,
.fst-mentor-detail {
  padding: 8px 0;
}

.fst-detail-section {
  margin-bottom: 24px;
}

.fst-detail-section h4 {
  font-size: 16px;
  font-weight: 600;
  color: var(--p-text-color);
  margin: 0 0 12px 0;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--p-surface-border);
}

.fst-detail-row {
  display: flex;
  justify-content: space-between;
  padding: 8px 0;
  font-size: 14px;
}

.fst-detail-row span {
  color: var(--p-text-muted-color);
}

.fst-detail-row strong {
  color: var(--p-text-color);
}

.fst-history-item,
.fst-interaction-item,
.fst-session-item {
  padding: 12px;
  background: var(--p-surface-ground);
  border-radius: 8px;
  margin-bottom: 8px;
}

.fst-history-company,
.fst-session-title {
  font-weight: 600;
  color: var(--p-text-color);
  margin-bottom: 4px;
}

.fst-history-role,
.fst-session-company,
.fst-interaction-summary {
  font-size: 13px;
  color: var(--p-text-muted-color);
  margin-bottom: 4px;
}

.fst-history-dates,
.fst-session-date,
.fst-interaction-date {
  font-size: 12px;
  color: var(--p-text-muted-color);
}

.fst-history-outcome {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
  margin-top: 4px;
}

.fst-history-outcome.exit,
.fst-history-outcome.acquired {
  background: #e8f5e9;
  color: #2e7d32;
}

.fst-history-outcome.active {
  background: #e3f2fd;
  color: #1976d2;
}

.fst-history-outcome.closed {
  background: #ffebee;
  color: #c62828;
}

.fst-interaction-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.fst-interaction-type {
  font-weight: 600;
  font-size: 13px;
  color: var(--p-text-color);
}

.fst-interaction-rep {
  font-size: 12px;
  color: var(--p-text-muted-color);
  margin-top: 8px;
}

.fst-session-rating {
  font-size: 12px;
  color: #ffa726;
  font-weight: 500;
  margin-top: 4px;
}

/* ══════════════════════════════════════════════════════════════════════════
   ADD DIALOG
   ══════════════════════════════════════════════════════════════════════════ */
.fst-add-form {
  padding: 8px 0;
}

/* ══════════════════════════════════════════════════════════════════════════
   RESPONSIVE
   ══════════════════════════════════════════════════════════════════════════ */
@media (max-width: 1200px) {
  .fst-matching-container {
    grid-template-columns: 1fr;
  }

  .fst-matching-sidebar {
    order: -1;
  }
}

@media (max-width: 768px) {
  .fst-founders-header {
    flex-direction: column;
    gap: 16px;
  }

  .fst-founders-tabs {
    flex-direction: column;
  }

  .fst-founders-filters {
    flex-direction: column;
  }

  .fst-search-wrap {
    max-width: 100%;
  }

  .fst-founders-grid,
  .fst-mentors-grid {
    grid-template-columns: 1fr;
  }

  .fst-alumni-header {
    flex-direction: column;
    gap: 16px;
  }
}
</style>
