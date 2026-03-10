<template>
  <FstPageLayout title="AI Deal Sourcing" subtitle="Автоматический поиск перспективных стартапов в секторе БАС/РОБО/МЭ">
    <template #actions>
      <button class="sourcing-btn secondary" @click="showSettings = true">
          <i class="pi pi-cog"></i> Настройки
        </button>
        <button class="sourcing-btn primary" @click="runScan">
          <i class="pi pi-refresh"></i> Обновить данные
        </button>
    </template>

    <!-- Stats -->
    <div class="sourcing-stats">
      <div v-for="s in stats" :key="s.label" class="sourcing-stat-card">
        <div class="sourcing-stat-icon" :style="{ background: s.color }">
          <i :class="s.icon"></i>
        </div>
        <div class="sourcing-stat-info">
          <div class="sourcing-stat-num">{{ s.value }}</div>
          <div class="sourcing-stat-label">{{ s.label }}</div>
        </div>
      </div>
    </div>

    <!-- Filters -->
    <div class="sourcing-filters">
      <div class="sourcing-filter">
        <label>Источник</label>
        <select v-model="filters.source">
          <option value="all">Все источники</option>
          <option value="telegram">Telegram</option>
          <option value="hh">HH.ru</option>
          <option value="egrul">ЕГРЮЛ/ФНС</option>
          <option value="fips">ФИПС (Роспатент)</option>
          <option value="skolkovo">Сколково</option>
          <option value="bortnik">Фонд Бортника</option>
          <option value="github">GitHub/GitLab</option>
          <option value="news">СМИ</option>
        </select>
      </div>
      <div class="sourcing-filter">
        <label>Сектор</label>
        <select v-model="filters.sector">
          <option value="all">Все секторы</option>
          <option value="БАС">БАС</option>
          <option value="РОБО">РОБО</option>
          <option value="МЭ">МЭ</option>
        </select>
      </div>
      <div class="sourcing-filter">
        <label>Оценка AI</label>
        <select v-model="filters.score">
          <option value="all">Любая</option>
          <option value="high">Высокая (75+)</option>
          <option value="medium">Средняя (50-74)</option>
          <option value="low">Низкая (&lt;50)</option>
        </select>
      </div>
      <div class="sourcing-filter">
        <label>Период</label>
        <select v-model="filters.period">
          <option value="today">Сегодня</option>
          <option value="week">Неделя</option>
          <option value="month">Месяц</option>
          <option value="all">Всё время</option>
        </select>
      </div>
    </div>

    <!-- Leads feed -->
    <div class="sourcing-feed">
      <div v-if="loading" class="sourcing-loading">
        <i class="pi pi-spin pi-spinner"></i>
        <p>Загрузка находок...</p>
      </div>

      <div v-else-if="filteredLeads.length === 0" class="sourcing-empty">
        <i class="pi pi-inbox"></i>
        <p>Находок не найдено</p>
        <button class="sourcing-btn primary" @click="runScan">Запустить сканирование</button>
      </div>

      <div v-else class="sourcing-cards">
        <div
          v-for="lead in filteredLeads"
          :key="lead.id"
          class="sourcing-card"
          @click="selectedLead = lead"
        >
          <!-- Card Header -->
          <div class="sourcing-card-header">
            <div class="sourcing-card-title">{{ lead.company }}</div>
            <div class="sourcing-card-badges">
              <span class="sourcing-badge" :style="{ background: sectorColor(lead.sector) }">
                {{ lead.sector }}
              </span>
              <span class="sourcing-badge source">{{ lead.source }}</span>
            </div>
          </div>

          <!-- Score Bar -->
          <div class="sourcing-card-score">
            <div class="sourcing-score-label">AI-оценка</div>
            <div class="sourcing-score-bar-wrapper">
              <div
                class="sourcing-score-bar"
                :style="{ width: lead.score + '%', background: scoreColor(lead.score) }"
              ></div>
            </div>
            <div class="sourcing-score-val">{{ lead.score }}/100</div>
          </div>

          <!-- Description -->
          <div class="sourcing-card-desc">{{ lead.description }}</div>

          <!-- Signals -->
          <div class="sourcing-card-signals" v-if="lead.signals && lead.signals.length">
            <div class="sourcing-signal-label">Сигналы роста:</div>
            <div class="sourcing-signals-list">
              <span v-for="(sig, idx) in lead.signals" :key="idx" class="sourcing-signal">
                <i :class="signalIcon(sig.type)"></i> {{ sig.text }}
              </span>
            </div>
          </div>

          <!-- Footer -->
          <div class="sourcing-card-footer">
            <span class="sourcing-card-date">
              <i class="pi pi-clock"></i> {{ formatDate(lead.foundAt) }}
            </span>
            <button
              class="sourcing-btn-add"
              @click.stop="addToDealflow(lead)"
              :disabled="lead.addedToDealflow"
            >
              <i :class="lead.addedToDealflow ? 'pi pi-check' : 'pi pi-plus'"></i>
              {{ lead.addedToDealflow ? 'В воронке' : 'В воронку' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Detail Panel -->
    <div v-if="selectedLead" class="sourcing-detail-overlay" @click.self="selectedLead = null">
      <div class="sourcing-detail">
        <div class="sourcing-detail-header">
          <h3>{{ selectedLead.company }}</h3>
          <button @click="selectedLead = null" class="sourcing-close">✕</button>
        </div>

        <div class="sourcing-detail-body">
          <!-- Main info -->
          <div class="sourcing-detail-section">
            <div class="sourcing-detail-label">Основная информация</div>
            <div class="sourcing-detail-grid">
              <div class="sourcing-detail-row">
                <span>Сектор</span>
                <strong :style="{ color: sectorColor(selectedLead.sector) }">{{ selectedLead.sector }}</strong>
              </div>
              <div class="sourcing-detail-row">
                <span>Источник</span>
                <strong>{{ selectedLead.source }}</strong>
              </div>
              <div class="sourcing-detail-row">
                <span>AI-оценка</span>
                <strong :style="{ color: scoreColor(selectedLead.score) }">{{ selectedLead.score }}/100</strong>
              </div>
              <div class="sourcing-detail-row">
                <span>Найдено</span>
                <strong>{{ formatDate(selectedLead.foundAt) }}</strong>
              </div>
            </div>
          </div>

          <!-- Description -->
          <div class="sourcing-detail-section">
            <div class="sourcing-detail-label">Описание</div>
            <p class="sourcing-detail-text">{{ selectedLead.description }}</p>
          </div>

          <!-- AI Scoring Details -->
          <div class="sourcing-detail-section" v-if="selectedLead.aiAnalysis">
            <div class="sourcing-detail-label">AI-анализ</div>
            <div class="sourcing-analysis">
              <div class="sourcing-analysis-item">
                <span>Релевантность сектору</span>
                <div class="sourcing-analysis-bar">
                  <div :style="{ width: selectedLead.aiAnalysis.relevance + '%', background: scoreColor(selectedLead.aiAnalysis.relevance) }"></div>
                </div>
                <strong>{{ selectedLead.aiAnalysis.relevance }}%</strong>
              </div>
              <div class="sourcing-analysis-item">
                <span>Суверенность (прогноз)</span>
                <div class="sourcing-analysis-bar">
                  <div :style="{ width: (selectedLead.aiAnalysis.sovereignty / 9 * 100) + '%', background: scoreColor(selectedLead.aiAnalysis.sovereignty / 9 * 100) }"></div>
                </div>
                <strong>{{ selectedLead.aiAnalysis.sovereignty }}/9</strong>
              </div>
              <div class="sourcing-analysis-item">
                <span>Вероятность прохождения gate-критериев</span>
                <div class="sourcing-analysis-bar">
                  <div :style="{ width: selectedLead.aiAnalysis.gatePass + '%', background: scoreColor(selectedLead.aiAnalysis.gatePass) }"></div>
                </div>
                <strong>{{ selectedLead.aiAnalysis.gatePass }}%</strong>
              </div>
            </div>
          </div>

          <!-- Growth Signals -->
          <div class="sourcing-detail-section" v-if="selectedLead.signals && selectedLead.signals.length">
            <div class="sourcing-detail-label">Сигналы роста</div>
            <div class="sourcing-signals-detail">
              <div v-for="(sig, idx) in selectedLead.signals" :key="idx" class="sourcing-signal-item">
                <i :class="signalIcon(sig.type)"></i>
                <div>
                  <div class="sourcing-signal-title">{{ sig.type }}</div>
                  <div class="sourcing-signal-text">{{ sig.text }}</div>
                </div>
              </div>
            </div>
          </div>

          <!-- Contact info -->
          <div class="sourcing-detail-section" v-if="selectedLead.contact">
            <div class="sourcing-detail-label">Контактная информация</div>
            <div class="sourcing-detail-grid">
              <div class="sourcing-detail-row" v-if="selectedLead.contact.inn">
                <span>ИНН</span>
                <strong>{{ selectedLead.contact.inn }}</strong>
              </div>
              <div class="sourcing-detail-row" v-if="selectedLead.contact.website">
                <span>Сайт</span>
                <a :href="selectedLead.contact.website" target="_blank" class="sourcing-link">
                  {{ selectedLead.contact.website }}
                </a>
              </div>
              <div class="sourcing-detail-row" v-if="selectedLead.contact.email">
                <span>Email</span>
                <a :href="'mailto:' + selectedLead.contact.email" class="sourcing-link">
                  {{ selectedLead.contact.email }}
                </a>
              </div>
            </div>
          </div>

          <!-- Actions -->
          <div class="sourcing-detail-actions">
            <button
              class="sourcing-btn primary"
              @click="addToDealflow(selectedLead)"
              :disabled="selectedLead.addedToDealflow"
            >
              <i :class="selectedLead.addedToDealflow ? 'pi pi-check' : 'pi pi-plus'"></i>
              {{ selectedLead.addedToDealflow ? 'Уже в воронке' : 'Добавить в воронку' }}
            </button>
            <button class="sourcing-btn secondary" @click="selectedLead = null">Закрыть</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Settings Modal -->
    <div v-if="showSettings" class="sourcing-detail-overlay" @click.self="showSettings = false">
      <div class="sourcing-detail">
        <div class="sourcing-detail-header">
          <h3>Настройки мониторинга</h3>
          <button @click="showSettings = false" class="sourcing-close">✕</button>
        </div>

        <div class="sourcing-detail-body">
          <div class="sourcing-settings-section">
            <div class="sourcing-detail-label">Источники данных</div>
            <div class="sourcing-settings-sources">
              <label v-for="src in availableSources" :key="src.id" class="sourcing-checkbox">
                <input type="checkbox" v-model="src.enabled" />
                <span>{{ src.name }}</span>
                <span class="sourcing-checkbox-status" :class="{ active: src.enabled }">
                  {{ src.enabled ? 'Включен' : 'Выключен' }}
                </span>
              </label>
            </div>
          </div>

          <div class="sourcing-settings-section">
            <div class="sourcing-detail-label">Ключевые слова для поиска</div>
            <textarea
              v-model="keywords"
              rows="4"
              class="sourcing-input"
              placeholder="UAV, БПЛА, autonomous, дрон, робототехника, микроэлектроника..."
            ></textarea>
          </div>

          <div class="sourcing-settings-section">
            <div class="sourcing-detail-label">Частота обновления</div>
            <select v-model="updateFrequency" class="sourcing-input">
              <option value="hourly">Каждый час</option>
              <option value="daily">Ежедневно</option>
              <option value="weekly">Еженедельно</option>
              <option value="manual">Вручную</option>
            </select>
          </div>

          <div class="sourcing-detail-actions">
            <button class="sourcing-btn primary" @click="saveSettings">
              <i class="pi pi-save"></i> Сохранить
            </button>
            <button class="sourcing-btn secondary" @click="showSettings = false">Отмена</button>
          </div>
        </div>
      </div>
    </div>
  </FstPageLayout>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import FstPageLayout from '@/components/fst-shared/FstPageLayout.vue'
import { useRouter } from 'vue-router'
import { logger } from '@/utils/logger'
import { useEventStore } from '@/stores/eventStore.js'

const router = useRouter()
const eventStore = useEventStore()

// State
const loading = ref(false)
const selectedLead = ref(null)
const showSettings = ref(false)

// Filters
const filters = ref({
  source: 'all',
  sector: 'all',
  score: 'all',
  period: 'week'
})

// Settings
const keywords = ref('UAV, БПЛА, autonomous, дрон, робототехника, микроэлектроника, беспилотник')
const updateFrequency = ref('daily')
const availableSources = ref([
  { id: 'telegram', name: 'Telegram', enabled: true },
  { id: 'hh', name: 'HH.ru (активность найма)', enabled: true },
  { id: 'egrul', name: 'ЕГРЮЛ/ФНС (новые ООО)', enabled: true },
  { id: 'fips', name: 'ФИПС (Роспатент)', enabled: false },
  { id: 'skolkovo', name: 'Сколково', enabled: true },
  { id: 'bortnik', name: 'Фонд Бортника', enabled: false },
  { id: 'github', name: 'GitHub/GitLab', enabled: true },
  { id: 'news', name: 'СМИ', enabled: true }
])

// Mock data (will be replaced with real API calls)
const leads = ref([
  {
    id: 1,
    company: 'ООО АвтоПилот',
    sector: 'БАС',
    source: 'GitHub',
    score: 82,
    description: 'Разработка AI-системы автономной навигации для БПЛА в условиях отсутствия GPS. Открытый репозиторий с 340 звёздами.',
    foundAt: new Date('2026-03-06'),
    addedToDealflow: false,
    signals: [
      { type: 'GitHub', text: '340 звёзд, активная разработка' },
      { type: 'Патенты', text: '2 заявки в ФИПС (класс B64)' }
    ],
    aiAnalysis: {
      relevance: 95,
      sovereignty: 7,
      gatePass: 82
    },
    contact: {
      website: 'https://github.com/autopilot-uav',
      email: 'info@autopilot.tech'
    }
  },
  {
    id: 2,
    company: 'АО РобоМед',
    sector: 'РОБО',
    source: 'HH.ru',
    score: 78,
    description: 'Хирургические роботы для минимально инвазивных операций. Активно нанимают инженеров и врачей (15 вакансий за месяц).',
    foundAt: new Date('2026-03-05'),
    addedToDealflow: false,
    signals: [
      { type: 'Найм', text: '15 новых вакансий за месяц' },
      { type: 'Контракты', text: 'Упоминание партнёрства с МФТИ в СМИ' }
    ],
    aiAnalysis: {
      relevance: 88,
      sovereignty: 6,
      gatePass: 75
    },
    contact: {
      inn: '7701234567',
      website: 'https://robomed.ru'
    }
  },
  {
    id: 3,
    company: 'ООО ЧипТех',
    sector: 'МЭ',
    source: 'ЕГРЮЛ',
    score: 71,
    description: 'Зарегистрирована 15.02.2026. ОКВЭД: 26.11 (Производство электронных компонентов). Уставный капитал 50 млн ₽.',
    foundAt: new Date('2026-02-15'),
    addedToDealflow: false,
    signals: [
      { type: 'Регистрация', text: 'Новая компания с высоким уставным капиталом' },
      { type: 'ОКВЭД', text: 'Целевой сектор микроэлектроники' }
    ],
    aiAnalysis: {
      relevance: 92,
      sovereignty: 8,
      gatePass: 68
    },
    contact: {
      inn: '7702345678'
    }
  },
  {
    id: 4,
    company: 'Стартап ДронСервис',
    sector: 'БАС',
    source: 'Сколково',
    score: 85,
    description: 'Резидент Сколково с 01.03.2026. Платформа для управления парками БПЛА в сельском хозяйстве. Грант 15 млн ₽.',
    foundAt: new Date('2026-03-01'),
    addedToDealflow: false,
    signals: [
      { type: 'Грант', text: 'Грант Сколково 15 млн ₽' },
      { type: 'Резиденство', text: 'Статус резидента получен' }
    ],
    aiAnalysis: {
      relevance: 94,
      sovereignty: 7,
      gatePass: 85
    },
    contact: {
      inn: '7703456789',
      website: 'https://dronservice.tech',
      email: 'hello@dronservice.tech'
    }
  },
  {
    id: 5,
    company: 'НейроДрон',
    sector: 'БАС',
    source: 'СМИ',
    score: 65,
    description: 'Упоминание в статье на VC.ru: "Команда из Казани разрабатывает нейросеть для распознавания объектов с БПЛА в реальном времени".',
    foundAt: new Date('2026-03-04'),
    addedToDealflow: false,
    signals: [
      { type: 'PR', text: 'Публикация на VC.ru' },
      { type: 'Sentiment', text: 'Позитивный тон статьи (AI: 0.8)' }
    ],
    aiAnalysis: {
      relevance: 87,
      sovereignty: 5,
      gatePass: 62
    },
    contact: {
      website: 'https://neurodrone.ru'
    }
  },
  {
    id: 6,
    company: 'ООО МикроЧип',
    sector: 'МЭ',
    source: 'ФИПС',
    score: 73,
    description: 'Патентная заявка №2026105123 на "Способ изготовления интегральных схем на отечественной элементной базе" (подана 05.02.2026).',
    foundAt: new Date('2026-02-05'),
    addedToDealflow: false,
    signals: [
      { type: 'Патенты', text: 'Новая заявка в ФИПС (класс H01L)' }
    ],
    aiAnalysis: {
      relevance: 90,
      sovereignty: 9,
      gatePass: 70
    },
    contact: {
      inn: '7704567890'
    }
  }
])

// Computed
const stats = computed(() => [
  {
    label: 'Всего находок',
    value: leads.value.length,
    icon: 'pi pi-search',
    color: 'linear-gradient(135deg, var(--fst-purple) 0%, var(--fst-purple-dark) 100%)'
  },
  {
    label: 'Высокий score (75+)',
    value: leads.value.filter(l => l.score >= 75).length,
    icon: 'pi pi-star',
    color: 'linear-gradient(135deg, var(--fst-purple) 0%, var(--fst-red) 100%)'
  },
  {
    label: 'За эту неделю',
    value: leads.value.filter(l => isThisWeek(l.foundAt)).length,
    icon: 'pi pi-calendar',
    color: 'linear-gradient(135deg, var(--fst-blue) 0%, var(--fst-cyan) 100%)'
  },
  {
    label: 'В воронку',
    value: leads.value.filter(l => l.addedToDealflow).length,
    icon: 'pi pi-check-circle',
    color: 'linear-gradient(135deg, var(--fst-green) 0%, var(--fst-cyan) 100%)'
  }
])

const filteredLeads = computed(() => {
  return leads.value.filter(lead => {
    // Source filter
    if (filters.value.source !== 'all') {
      const sourceMap = {
        'telegram': 'Telegram',
        'hh': 'HH.ru',
        'egrul': 'ЕГРЮЛ',
        'fips': 'ФИПС',
        'skolkovo': 'Сколково',
        'bortnik': 'Фонд Бортника',
        'github': 'GitHub',
        'news': 'СМИ'
      }
      if (lead.source !== sourceMap[filters.value.source]) return false
    }

    // Sector filter
    if (filters.value.sector !== 'all' && lead.sector !== filters.value.sector) return false

    // Score filter
    if (filters.value.score === 'high' && lead.score < 75) return false
    if (filters.value.score === 'medium' && (lead.score < 50 || lead.score >= 75)) return false
    if (filters.value.score === 'low' && lead.score >= 50) return false

    // Period filter
    const now = new Date()
    const leadDate = new Date(lead.foundAt)
    if (filters.value.period === 'today') {
      if (leadDate.toDateString() !== now.toDateString()) return false
    } else if (filters.value.period === 'week') {
      if (!isThisWeek(leadDate)) return false
    } else if (filters.value.period === 'month') {
      if (!isThisMonth(leadDate)) return false
    }

    return true
  })
})

// Functions
function sectorColor(sector) {
  return { БАС: 'var(--fst-blue-dark)', РОБО: 'var(--fst-green-dark)', МЭ: 'var(--fst-purple-dark)' }[sector] || 'var(--p-text-muted-color)'
}

function scoreColor(score) {
  if (score >= 75) return 'var(--fst-green)'
  if (score >= 50) return 'var(--fst-brand)'
  return 'var(--fst-red)'
}

function signalIcon(type) {
  const icons = {
    'Найм': 'pi pi-users',
    'Патенты': 'pi pi-file',
    'Контракты': 'pi pi-file-edit',
    'PR': 'pi pi-megaphone',
    'GitHub': 'pi pi-github',
    'Грант': 'pi pi-money-bill',
    'Резиденство': 'pi pi-building',
    'Регистрация': 'pi pi-id-card',
    'ОКВЭД': 'pi pi-briefcase',
    'Sentiment': 'pi pi-heart'
  }
  return icons[type] || 'pi pi-info-circle'
}

function formatDate(date) {
  const d = new Date(date)
  const now = new Date()
  const diffTime = Math.abs(now - d)
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'Сегодня'
  if (diffDays === 1) return 'Вчера'
  if (diffDays <= 7) return `${diffDays} дн. назад`

  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })
}

function isThisWeek(date) {
  const now = new Date()
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  return date >= weekAgo && date <= now
}

function isThisMonth(date) {
  const now = new Date()
  return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear()
}

function addToDealflow(lead) {
  if (lead.addedToDealflow) return

  lead.addedToDealflow = true
  // Фиксируем событие в event log
  const dealId = `deal-${lead.inn || lead.company?.replace(/\s+/g, '_') || Date.now()}`
  eventStore.add('deal', dealId, 'DEAL_SOURCED', {
    company: lead.company,
    inn:     lead.inn,
    subFund: lead.sector,
    stage:   lead.stage,
    source:  lead.source,
    score:   lead.score,
  })

  // In production, this would make an API call to create a deal in /fst-dealflow
  setTimeout(() => {
    if (confirm(`Добавить "${lead.company}" в воронку dealflow?`)) {
      logger.debug('Adding to dealflow:', lead)
      // router.push('/fst-dealflow')
    } else {
      lead.addedToDealflow = false
    }
  }, 100)
}

function runScan() {
  loading.value = true
  // Simulate API call
  setTimeout(() => {
    loading.value = false
    // In production, this would trigger the backend sourcing pipeline
    logger.debug('Running sourcing scan...')
  }, 1500)
}

function saveSettings() {
  // In production, save settings to backend
  logger.debug('Saving settings:', {
    sources: availableSources.value.filter(s => s.enabled).map(s => s.id),
    keywords: keywords.value,
    updateFrequency: updateFrequency.value
  })
  showSettings.value = false
}

onMounted(() => {
  // Load data on mount
  // In production, fetch from API
})
</script>

<style scoped>
.sourcing-root {
  padding: 24px;
  max-width: 1400px;
  margin: 0 auto;
}

/* Header */
.sourcing-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 24px;
  flex-wrap: wrap;
  gap: 12px;
}

.sourcing-title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--p-text-color);
  margin: 0;
}

.sourcing-subtitle {
  color: var(--p-text-muted-color);
  font-size: 0.9rem;
  margin-top: 4px;
}

.sourcing-actions {
  display: flex;
  gap: 8px;
}

.sourcing-btn {
  padding: 8px 16px;
  border-radius: 8px;
  border: none;
  cursor: pointer;
  font-size: 0.85rem;
  font-weight: 600;
  transition: opacity 0.15s;
  display: flex;
  align-items: center;
  gap: 6px;
}

.sourcing-btn:hover {
  opacity: 0.85;
}

.sourcing-btn.primary {
  background: var(--p-primary-color);
  color: white;
}

.sourcing-btn.secondary {
  background: var(--surface-ground);
  color: var(--p-text-color);
  border: 1px solid var(--surface-border);
}

/* Stats */
.sourcing-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}

.sourcing-stat-card {
  background: var(--surface-card);
  border: 1px solid var(--surface-border);
  border-radius: 12px;
  padding: 16px;
  display: flex;
  align-items: center;
  gap: 16px;
}

.sourcing-stat-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 1.2rem;
}

.sourcing-stat-info {
  flex: 1;
}

.sourcing-stat-num {
  font-size: 1.8rem;
  font-weight: 800;
  color: var(--p-text-color);
}

.sourcing-stat-label {
  font-size: 0.75rem;
  color: var(--p-text-muted-color);
  margin-top: 2px;
}

/* Filters */
.sourcing-filters {
  display: flex;
  gap: 12px;
  margin-bottom: 24px;
  flex-wrap: wrap;
}

.sourcing-filter {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
  min-width: 150px;
}

.sourcing-filter label {
  font-size: 0.75rem;
  color: var(--p-text-muted-color);
  font-weight: 600;
}

.sourcing-filter select {
  background: var(--surface-ground);
  border: 1px solid var(--surface-border);
  border-radius: 8px;
  padding: 8px 12px;
  color: var(--p-text-color);
  font-size: 0.85rem;
  outline: none;
  cursor: pointer;
}

.sourcing-filter select:focus {
  border-color: var(--p-primary-color);
}

/* Feed */
.sourcing-feed {
  min-height: 400px;
}

.sourcing-loading,
.sourcing-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 20px;
  color: var(--p-text-muted-color);
}

.sourcing-loading i,
.sourcing-empty i {
  font-size: 3rem;
  margin-bottom: 16px;
  opacity: 0.3;
}

.sourcing-loading p,
.sourcing-empty p {
  font-size: 1rem;
  margin-bottom: 16px;
}

/* Cards */
.sourcing-cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  gap: 16px;
}

.sourcing-card {
  background: var(--surface-card);
  border: 1px solid var(--surface-border);
  border-radius: 12px;
  padding: 16px;
  cursor: pointer;
  transition: transform 0.15s, box-shadow 0.15s;
}

.sourcing-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px color-mix(in srgb, var(--p-text-color) 12%, transparent);
}

.sourcing-card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 12px;
}

.sourcing-card-title {
  font-size: 1rem;
  font-weight: 700;
  color: var(--p-text-color);
  flex: 1;
}

.sourcing-card-badges {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.sourcing-badge {
  font-size: 0.7rem;
  padding: 3px 8px;
  border-radius: 6px;
  color: white;
  font-weight: 600;
}

.sourcing-badge.source {
  background: var(--p-surface-600);
}

/* Score */
.sourcing-card-score {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.sourcing-score-label {
  font-size: 0.7rem;
  color: var(--p-text-muted-color);
  min-width: 65px;
}

.sourcing-score-bar-wrapper {
  flex: 1;
  height: 6px;
  background: var(--surface-ground);
  border-radius: 3px;
  overflow: hidden;
}

.sourcing-score-bar {
  height: 100%;
  border-radius: 3px;
  transition: width 0.3s;
}

.sourcing-score-val {
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--p-text-color);
  min-width: 50px;
  text-align: right;
}

/* Description */
.sourcing-card-desc {
  font-size: 0.85rem;
  color: var(--p-text-muted-color);
  line-height: 1.5;
  margin-bottom: 12px;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* Signals */
.sourcing-card-signals {
  margin-bottom: 12px;
}

.sourcing-signal-label {
  font-size: 0.7rem;
  color: var(--p-text-muted-color);
  margin-bottom: 6px;
}

.sourcing-signals-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.sourcing-signal {
  font-size: 0.7rem;
  background: var(--surface-ground);
  color: var(--p-text-color);
  padding: 4px 8px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  gap: 4px;
}

/* Footer */
.sourcing-card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  padding-top: 12px;
  border-top: 1px solid var(--surface-border);
}

.sourcing-card-date {
  font-size: 0.75rem;
  color: var(--p-text-muted-color);
  display: flex;
  align-items: center;
  gap: 4px;
}

.sourcing-btn-add {
  padding: 6px 12px;
  border-radius: 6px;
  border: none;
  cursor: pointer;
  font-size: 0.75rem;
  font-weight: 600;
  background: var(--p-primary-color);
  color: white;
  transition: opacity 0.15s;
  display: flex;
  align-items: center;
  gap: 4px;
}

.sourcing-btn-add:hover:not(:disabled) {
  opacity: 0.85;
}

.sourcing-btn-add:disabled {
  background: var(--surface-ground);
  color: var(--p-text-muted-color);
  cursor: not-allowed;
}

/* Detail Panel */
.sourcing-detail-overlay {
  position: fixed;
  inset: 0;
  background: color-mix(in srgb, var(--p-text-color) 50%, transparent);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.sourcing-detail {
  background: var(--surface-card);
  border-radius: 12px;
  width: 600px;
  max-width: 100%;
  max-height: 90vh;
  overflow-y: auto;
}

.sourcing-detail-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 20px 12px;
  border-bottom: 1px solid var(--p-content-border-color);
  position: sticky;
  top: 0;
  background: transparent;
  z-index: 1;
}

.sourcing-detail-header h3 {
  margin: 0;
  font-size: 1.2rem;
  color: var(--p-text-color);
}

.sourcing-close {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: var(--p-text-muted-color);
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  transition: background 0.15s;
}

.sourcing-close:hover {
  background: var(--surface-ground);
}

.sourcing-detail-body {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.sourcing-detail-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.sourcing-detail-label {
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--p-text-muted-color);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.sourcing-detail-grid {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.sourcing-detail-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.9rem;
  color: var(--p-text-muted-color);
  padding-bottom: 8px;
  border-bottom: 1px dashed var(--surface-border);
}

.sourcing-detail-row:last-child {
  border-bottom: none;
}

.sourcing-detail-row strong {
  color: var(--p-text-color);
}

.sourcing-detail-text {
  font-size: 0.9rem;
  color: var(--p-text-color);
  line-height: 1.6;
  margin: 0;
}

.sourcing-link {
  color: var(--p-primary-color);
  text-decoration: none;
}

.sourcing-link:hover {
  text-decoration: underline;
}

/* AI Analysis */
.sourcing-analysis {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.sourcing-analysis-item {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 0.85rem;
}

.sourcing-analysis-item span {
  min-width: 180px;
  color: var(--p-text-muted-color);
}

.sourcing-analysis-bar {
  flex: 1;
  height: 8px;
  background: var(--surface-ground);
  border-radius: 4px;
  overflow: hidden;
}

.sourcing-analysis-bar div {
  height: 100%;
  border-radius: 4px;
  transition: width 0.3s;
}

.sourcing-analysis-item strong {
  min-width: 50px;
  text-align: right;
  color: var(--p-text-color);
}

/* Signals Detail */
.sourcing-signals-detail {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.sourcing-signal-item {
  display: flex;
  gap: 12px;
  padding: 12px;
  background: var(--surface-ground);
  border-radius: 8px;
}

.sourcing-signal-item i {
  font-size: 1.2rem;
  color: var(--p-primary-color);
  margin-top: 2px;
}

.sourcing-signal-title {
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--p-text-color);
  margin-bottom: 2px;
}

.sourcing-signal-text {
  font-size: 0.85rem;
  color: var(--p-text-muted-color);
}

/* Actions */
.sourcing-detail-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  padding-top: 12px;
  border-top: 1px solid var(--surface-border);
}

/* Settings */
.sourcing-settings-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.sourcing-settings-sources {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.sourcing-checkbox {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  background: var(--surface-ground);
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s;
}

.sourcing-checkbox:hover {
  background: var(--surface-hover);
}

.sourcing-checkbox input[type="checkbox"] {
  cursor: pointer;
}

.sourcing-checkbox span {
  flex: 1;
  font-size: 0.9rem;
  color: var(--p-text-color);
}

.sourcing-checkbox-status {
  font-size: 0.75rem;
  padding: 3px 8px;
  border-radius: 6px;
  background: var(--surface-border);
  color: var(--p-text-muted-color);
}

.sourcing-checkbox-status.active {
  background: var(--p-primary-color);
  color: white;
}

.sourcing-input {
  background: var(--surface-ground);
  border: 1px solid var(--surface-border);
  border-radius: 8px;
  padding: 10px 12px;
  color: var(--p-text-color);
  font-size: 0.9rem;
  outline: none;
  font-family: inherit;
  resize: vertical;
}

.sourcing-input:focus {
  border-color: var(--p-primary-color);
}

/* ── Mobile adaptive ── */
@media (max-width: 768px) {
  .sourcing-stats { flex-wrap: wrap; gap: 8px; }
  .sourcing-card-score { flex-wrap: wrap; gap: 8px; }
  .sourcing-stats { grid-template-columns: 1fr !important; }
  .sourcing-cards { grid-template-columns: 1fr !important; }
}
</style>
