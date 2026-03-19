<template>
  <div class="available-agents-panel">
    <div class="panel-header">
      <i class="pi pi-users" style="font-size: 1rem"></i>
      <span>Доступные агенты</span>
    </div>

    <!-- Help Section -->
    <div class="help-section">
      <div class="help-header" @click="showHelp = !showHelp" style="cursor: pointer;">
        <i class="pi pi-info-circle"></i>
        <span>Как работают агенты в чате</span>
        <i :class="['pi', showHelp ? 'pi-chevron-up' : 'pi-chevron-down']" style="margin-left: auto; font-size: 0.875rem;"></i>
      </div>
      <ul v-if="showHelp" class="help-list">
        <li><strong>Утилитарные агенты</strong> (например, INN Analytics) работают автоматически при обнаружении триггеров в вашем сообщении</li>
        <li><strong>Интеграции</strong> (Code Interpreter, Web Browsing) активируются при включении соответствующих функций в настройках</li>
        <li><strong>Агентный режим</strong> использует AI агентов для решения сложных задач - включите его кнопкой "Агентный режим"</li>
        <li><strong>Индикатор выполнения</strong> агента отображается в верхней части чата и автоматически исчезает через 5 секунд после завершения</li>
      </ul>
    </div>

    <div class="agents-grid">
      <div
        v-for="agent in availableAgents"
        :key="agent.id"
        class="agent-card"
        :class="{ 'agent-disabled': !agent.enabled }"
      >
        <div class="agent-header">
          <div class="agent-icon">{{ agent.icon }}</div>
          <div class="agent-info">
            <div class="agent-name">{{ agent.name }}</div>
            <div class="agent-type">{{ agent.type }}</div>
          </div>
          <div class="agent-toggle">
            <InputSwitch
              :modelValue="agent.enabled"
              @update:modelValue="(value) => toggleAgent(agent.id, value)"
              :disabled="agent.required"
            />
          </div>
        </div>

        <div class="agent-description">
          {{ agent.description }}
        </div>

        <Button
          :icon="expandedAgents.has(agent.id) ? 'pi pi-chevron-up' : 'pi pi-chevron-down'"
          text
          size="small"
          :label="expandedAgents.has(agent.id) ? 'Свернуть' : 'Подробнее'"
          @click="toggleAgentExpand(agent.id)"
          class="expand-button"
        />

        <div v-if="expandedAgents.has(agent.id)" class="expanded-content">
          <div class="agent-capabilities">
            <span
              v-for="capability in agent.capabilities"
              :key="capability"
              class="capability-tag"
            >
              {{ capability }}
            </span>
          </div>

          <div v-if="agent.example" class="agent-example">
            <div class="example-label">Пример использования:</div>
            <code>{{ agent.example }}</code>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import InputSwitch from 'primevue/inputswitch'
import Button from 'primevue/button'

const props = defineProps({
  toolsConfig: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['update:toolsConfig'])

// Help section visibility (collapsed by default)
const showHelp = ref(false)

// Expanded agents (collapsed by default)
const expandedAgents = ref(new Set())

// Toggle agent details expand/collapse
function toggleAgentExpand(agentId) {
  if (expandedAgents.value.has(agentId)) {
    expandedAgents.value.delete(agentId)
  } else {
    expandedAgents.value.add(agentId)
  }
}

// Toggle agent on/off
function toggleAgent(agentId, enabled) {
  const updates = {}

  switch(agentId) {
    case 'inn-analytics':
      updates.innAgentEnabled = enabled
      break
    case 'egrul-parser':
      updates.egrulAgentEnabled = enabled
      break
    case 'code-interpreter':
      updates.codeInterpreterEnabled = enabled
      break
    case 'web-browsing':
      updates.webBrowsingEnabled = enabled
      break
    case 'integram-database':
      updates.integramDatabaseEnabled = enabled
      break
    case 'mcp-tools':
      updates.mcpEnabled = enabled
      break
    case 'web-search':
      updates.searchEnabled = enabled
      break
    case 'vat-calculator':
      updates.vatAgentEnabled = enabled
      break
    case 'fssp-agent':
      updates.fsspAgentEnabled = enabled
      break
    case 'hh-agent':
      updates.hhAgentEnabled = enabled
      break
    case 'code-analyzer':
      updates.codeAnalyzerAgentEnabled = enabled
      break
    case 'dev-helper':
      updates.devHelperAgentEnabled = enabled
      break
    case 'customer-support':
      updates.supportAgentEnabled = enabled
      break
    case 'onec-agent':
      updates.onecAgentEnabled = enabled
      break
    case 'sales-agent':
      updates.salesAgentEnabled = enabled
      break
    case 'general-agents':
      updates.agentsEnabled = enabled
      break
    case 'social-analytics':
      updates.socialAnalyticsEnabled = enabled
      break
    case 'youtube-analytics':
      updates.youtubeAnalyticsEnabled = enabled
      break
    case 'telegram-ads':
      updates.telegramAdsEnabled = enabled
      break
    case 'marketplace-analytics':
      updates.marketplaceAnalyticsEnabled = enabled
      break
    case 'competitor-monitor':
      updates.competitorMonitorEnabled = enabled
      break
    case 'conference-analytics':
      updates.conferenceAnalyticsEnabled = enabled
      break
    case 'business-metrics':
      updates.businessMetricsEnabled = enabled
      break
    case 'web-scraper':
      updates.webScraperEnabled = enabled
      break
    case 'smartq':
      updates.smartqEnabled = enabled
      break
    case 'marketplace-agent':
      updates.marketplaceAgentEnabled = enabled
      break
    case 'marketplace-review':
      updates.marketplaceReviewEnabled = enabled
      break
    case 'agro-analytics':
      updates.agroAnalyticsEnabled = enabled
      break
    case 'health-monitor':
      updates.healthMonitorEnabled = enabled
      break
    case 'orchestrator':
      updates.orchestratorEnabled = enabled
      break
    case 'system-health-dashboard':
      updates.systemHealthDashboardEnabled = enabled
      break
    case 'test-runner':
      updates.testRunnerEnabled = enabled
      break
    case 'integram-test':
      updates.integramTestEnabled = enabled
      break
    case 'mcp-agent':
      updates.mcpAgentEnabled = enabled
      break
    case 'integration-agent':
      updates.integrationAgentEnabled = enabled
      break
    case 'github-agent':
      updates.githubAgentEnabled = enabled
      break
    case 'crm-analytics':
      updates.crmAnalyticsEnabled = enabled
      break
    case 'customer-analytics':
      updates.customerAnalyticsEnabled = enabled
      break
    case 'sales-funnel':
      updates.salesFunnelEnabled = enabled
      break
    case 'call-analytics':
      updates.callAnalyticsEnabled = enabled
      break
    case 'customer-journey':
      updates.customerJourneyEnabled = enabled
      break
    case 'lead-scoring':
      updates.leadScoringEnabled = enabled
      break
    case 'retention-analytics':
      updates.retentionAnalyticsEnabled = enabled
      break
    case 'hr-agent':
      updates.hrAgentEnabled = enabled
      break
    case 'recruitment-agent':
      updates.recruitmentAgentEnabled = enabled
      break
    case 'recruiter':
      updates.recruiterEnabled = enabled
      break
    case 'staff-evaluation':
      updates.staffEvaluationEnabled = enabled
      break
    case 'interview-scheduler':
      updates.interviewSchedulerEnabled = enabled
      break
    case 'onboarding-agent':
      updates.onboardingAgentEnabled = enabled
      break
    case 'financial-analyst':
      updates.financialAnalystEnabled = enabled
      break
    case 'accounting-agent':
      updates.accountingAgentEnabled = enabled
      break
    case 'tax-agent':
      updates.taxAgentEnabled = enabled
      break
    case 'budget-agent':
      updates.budgetAgentEnabled = enabled
      break
    case 'invoice-agent':
      updates.invoiceAgentEnabled = enabled
      break
    case 'content-creator':
      updates.contentCreatorEnabled = enabled
      break
    case 'video-editor':
      updates.videoEditorEnabled = enabled
      break
    case 'review-moderator':
      updates.reviewModeratorEnabled = enabled
      break
    case 'content-calendar':
      updates.contentCalendarEnabled = enabled
      break
    case 'image-generator':
      updates.imageGeneratorEnabled = enabled
      break
    case 'seo-agent':
      updates.seoAgentEnabled = enabled
      break
    case 'email-marketing':
      updates.emailMarketingEnabled = enabled
      break
    case 'smm-analytics':
      updates.smmAnalyticsEnabled = enabled
      break
    case 'contextual-ads':
      updates.contextualAdsEnabled = enabled
      break
    case 'landing-optimizer':
      updates.landingOptimizerEnabled = enabled
      break
    case 'conversion-analytics':
      updates.conversionAnalyticsEnabled = enabled
      break
    case 'support-ticket':
      updates.supportTicketEnabled = enabled
      break
    case 'feedback-analyzer':
      updates.feedbackAnalyzerEnabled = enabled
      break
    case 'chatbot-builder':
      updates.chatbotBuilderEnabled = enabled
      break
    case 'live-chat':
      updates.liveChatEnabled = enabled
      break
    case 'document-processor':
      updates.documentProcessorEnabled = enabled
      break
    case 'pdf-parser':
      updates.pdfParserEnabled = enabled
      break
    case 'data-transformer':
      updates.dataTransformerEnabled = enabled
      break
    case 'report-generator':
      updates.reportGeneratorEnabled = enabled
      break
    case 'excel-analyzer':
      updates.excelAnalyzerEnabled = enabled
      break
    case 'form-builder':
      updates.formBuilderEnabled = enabled
      break
    case 'security-monitor':
      updates.securityMonitorEnabled = enabled
      break
    case 'audit-agent':
      updates.auditAgentEnabled = enabled
      break
    case 'compliance-agent':
      updates.complianceAgentEnabled = enabled
      break
    case 'gdpr-agent':
      updates.gdprAgentEnabled = enabled
      break
    case 'pentest-agent':
      updates.pentestAgentEnabled = enabled
      break
    case 'code-generator':
      updates.codeGeneratorEnabled = enabled
      break
    case 'bug-tracker':
      updates.bugTrackerEnabled = enabled
      break
    case 'cicd-agent':
      updates.cicdAgentEnabled = enabled
      break
    case 'docker-manager':
      updates.dockerManagerEnabled = enabled
      break
    case 'database-admin':
      updates.databaseAdminEnabled = enabled
      break
    case 'delivery-tracker':
      updates.deliveryTrackerEnabled = enabled
      break
    case 'warehouse-agent':
      updates.warehouseAgentEnabled = enabled
      break
    case 'route-optimizer':
      updates.routeOptimizerEnabled = enabled
      break
    case 'inventory-manager':
      updates.inventoryManagerEnabled = enabled
      break
    case 'smart-home':
      updates.smartHomeEnabled = enabled
      break
    case 'sensor-monitor':
      updates.sensorMonitorEnabled = enabled
      break
    case 'automation-builder':
      updates.automationBuilderEnabled = enabled
      break
    case 'scada-agent':
      updates.scadaAgentEnabled = enabled
      break
    case 'contract-manager':
      updates.contractManagerEnabled = enabled
      break
    case 'legal-assistant':
      updates.legalAssistantEnabled = enabled
      break
    case 'product-catalog':
      updates.productCatalogEnabled = enabled
      break
    case 'order-processing':
      updates.orderProcessingEnabled = enabled
      break
    case 'returns-manager':
      updates.returnsManagerEnabled = enabled
      break
    case 'price-monitor':
      updates.priceMonitorEnabled = enabled
      break
    case 'review-generator':
      updates.reviewGeneratorEnabled = enabled
      break
    case 'lms-agent':
      updates.lmsAgentEnabled = enabled
      break
    case 'quiz-generator':
      updates.quizGeneratorEnabled = enabled
      break
    case 'training-content':
      updates.trainingContentEnabled = enabled
      break
    case 'course-builder':
      updates.courseBuilderEnabled = enabled
      break
    case 'student-progress':
      updates.studentProgressEnabled = enabled
      break
    case 'property-listing':
      updates.propertyListingEnabled = enabled
      break
    case 'valuation-agent':
      updates.valuationAgentEnabled = enabled
      break
    case 'tenant-manager':
      updates.tenantManagerEnabled = enabled
      break
    case 'medical-records':
      updates.medicalRecordsEnabled = enabled
      break
    case 'medical-appointment':
      updates.medicalAppointmentEnabled = enabled
      break
    case 'prescription-manager':
      updates.prescriptionManagerEnabled = enabled
      break
    case 'hotel-booking':
      updates.hotelBookingEnabled = enabled
      break
    case 'flight-tracker':
      updates.flightTrackerEnabled = enabled
      break
    case 'travel-itinerary':
      updates.travelItineraryEnabled = enabled
      break
    case 'podcast-generator':
      updates.podcastGeneratorEnabled = enabled
      break
    case 'music-recommendation':
      updates.musicRecommendationEnabled = enabled
      break
    case 'movie-database':
      updates.movieDatabaseEnabled = enabled
      break
    case 'crop-monitor':
      updates.cropMonitorEnabled = enabled
      break
    case 'weather-analytics':
      updates.weatherAnalyticsEnabled = enabled
      break
    case 'farm-management':
      updates.farmManagementEnabled = enabled
      break
    case 'translation-agent':
      updates.translationAgentEnabled = enabled
      break
    case 'voice-synthesis':
      updates.voiceSynthesisEnabled = enabled
      break
    case 'transcription-agent':
      updates.transcriptionAgentEnabled = enabled
      break
    case 'ocr-agent':
      updates.ocrAgentEnabled = enabled
      break
    case 'qr-generator':
      updates.qrGeneratorEnabled = enabled
      break
    case 'barcode-scanner':
      updates.barcodeScannerEnabled = enabled
      break
  }

  emit('update:toolsConfig', { ...props.toolsConfig, ...updates })
}

// Define all available agents for chat
const availableAgents = computed(() => [
  {
    id: 'inn-analytics',
    name: 'INN Analytics Agent',
    type: 'Утилитарный агент',
    icon: '🏢',
    description: 'Автоматически распознает ИНН (10 или 12 цифр) в сообщениях и получает данные о компании через DataNewton API',
    enabled: props.toolsConfig.innAgentEnabled !== false,
    capabilities: ['Поиск по ИНН', 'Данные компаний', 'ЕГРЮЛ/ЕГРИП'],
    example: '7707083893'
  },
  {
    id: 'egrul-parser',
    name: 'EGRUL Parser Agent',
    type: 'Утилитарный агент',
    icon: '📋',
    description: 'Автоматически получает официальные данные из ЕГРЮЛ ФНС при указании ИНН, ОГРН или названия компании. Бесплатный доступ к достоверной информации.',
    enabled: props.toolsConfig.egrulAgentEnabled !== false,
    capabilities: ['ЕГРЮЛ ФНС', 'Официальные данные', 'ИНН/ОГРН', 'Директор', 'Реквизиты'],
    example: 'егрюл 2721217652'
  },
  {
    id: 'code-interpreter',
    name: 'Code Interpreter',
    type: 'Интеграция',
    icon: '💻',
    description: 'Выполняет Python код для анализа данных, вычислений и визуализации',
    enabled: props.toolsConfig.codeInterpreterEnabled === true,
    capabilities: ['Python', 'Анализ данных', 'Графики'],
    example: 'Выполни код: print(2+2)'
  },
  {
    id: 'web-browsing',
    name: 'Web Browsing',
    type: 'Интеграция',
    icon: '🌐',
    description: 'Получает актуальную информацию из интернета через веб-браузинг',
    enabled: props.toolsConfig.webBrowsingEnabled === true,
    capabilities: ['Поиск в интернете', 'Актуальные данные'],
    example: 'Найди последние новости о...'
  },
  {
    id: 'integram-database',
    name: 'Integram Database',
    type: 'Интеграция',
    icon: '🗄️',
    description: 'Работает с таблицами и данными в Integram через MCP сервер',
    enabled: props.toolsConfig.integramDatabaseEnabled === true,
    capabilities: ['Базы данных', 'Таблицы', 'Запросы'],
    example: 'Покажи таблицы в базе'
  },
  {
    id: 'mcp-tools',
    name: 'MCP Tools',
    type: 'Интеграция',
    icon: '🔧',
    description: 'Доступ к различным MCP серверам: файловая система, память, браузер',
    enabled: props.toolsConfig.mcpEnabled !== false,
    capabilities: ['Файлы', 'Память', 'Playwright'],
    example: 'Используется автоматически при необходимости'
  },
  {
    id: 'web-search',
    name: 'Web Search Agent',
    type: 'Утилитарный агент',
    icon: '🔍',
    description: 'Автоматически ищет в интернете по команде. Триггеры: "найди в интернете", "загугли", "search", "веб-поиск"',
    enabled: props.toolsConfig.searchEnabled !== false,
    capabilities: ['Поиск в интернете', 'DuckDuckGo', 'Актуальные данные'],
    example: 'найди в интернете Vue 3 Composition API'
  },
  {
    id: 'vat-calculator',
    name: 'VAT Calculator Agent',
    type: 'Утилитарный агент',
    icon: '🧮',
    description: 'Рассчитывает НДС 20% (начисление и выделение). Триггеры: "ндс 100000", "ндс из 120000", "выделить ндс"',
    enabled: props.toolsConfig.vatAgentEnabled !== false,
    capabilities: ['НДС 20%', 'Начисление', 'Выделение', 'Ставки 10%, 0%'],
    example: 'ндс 100000'
  },
  {
    id: 'fssp-agent',
    name: 'FSSP Agent',
    type: 'Утилитарный агент',
    icon: '⚖️',
    description: 'Проверяет долги и исполнительные производства по ИНН через ФССП. Триггеры: "долги ИНН", "фссп", "проверить долги"',
    enabled: props.toolsConfig.fsspAgentEnabled !== false,
    capabilities: ['Долги ФССП', 'Исполнительные производства', 'Проверка по ИНН'],
    example: 'долги 7707083893'
  },
  {
    id: 'hh-agent',
    name: 'HeadHunter Agent',
    type: 'Утилитарный агент',
    icon: '💼',
    description: 'Поиск вакансий, оценка зарплат и информация о работодателях через hh.ru. Триггеры: "вакансии python", "зарплата менеджер", "работодатель сбербанк"',
    enabled: props.toolsConfig.hhAgentEnabled !== false,
    capabilities: ['Вакансии', 'Зарплаты', 'Работодатели', 'Регионы'],
    example: 'вакансии python москва'
  },
  {
    id: 'code-analyzer',
    name: 'Code Analyzer Agent',
    type: 'Утилитарный агент',
    icon: '💻',
    description: 'Анализирует код, находит уязвимости и дает рекомендации по улучшению. Триггеры: "анализ кода", "проверить код", "код ревью"',
    enabled: props.toolsConfig.codeAnalyzerAgentEnabled !== false,
    capabilities: ['Статический анализ', 'Поиск уязвимостей', 'Код ревью', 'Рекомендации'],
    example: 'анализ кода'
  },
  {
    id: 'dev-helper',
    name: 'Dev Helper Agent',
    type: 'Утилитарный агент',
    icon: '🛠️',
    description: 'Помощник разработчика: генерация кода, отладка, рефакторинг. Триггеры: "помощь разработчику", "помощь с кодом"',
    enabled: props.toolsConfig.devHelperAgentEnabled !== false,
    capabilities: ['Генерация кода', 'Отладка', 'Рефакторинг', 'Тесты', 'Документация'],
    example: 'помощь разработчику'
  },
  {
    id: 'customer-support',
    name: 'Customer Support Agent',
    type: 'Утилитарный агент',
    icon: '🎧',
    description: 'Система поддержки клиентов с тикетами и автоответами. Триггеры: "поддержка клиент", "создать тикет"',
    enabled: props.toolsConfig.supportAgentEnabled !== false,
    capabilities: ['Тикеты', 'Автоответы', 'Приоритизация', 'Telegram', 'Аналитика'],
    example: 'поддержка клиент'
  },
  {
    id: 'onec-agent',
    name: '1C Integration Agent',
    type: 'Утилитарный агент',
    icon: '📊',
    description: 'Интеграция с 1С:Предприятие через OData/HTTP. Триггеры: "1с", "1c"',
    enabled: props.toolsConfig.onecAgentEnabled !== false,
    capabilities: ['OData/HTTP', 'Справочники', 'Документы', 'Запросы', 'Синхронизация'],
    example: '1с запрос'
  },
  {
    id: 'sales-agent',
    name: 'Sales Agent',
    type: 'Утилитарный агент',
    icon: '💼',
    description: 'AI-помощник по продажам: лиды, воронки, коммуникации. Триггеры: "лиды", "воронка продаж"',
    enabled: props.toolsConfig.salesAgentEnabled !== false,
    capabilities: ['Лиды', 'Скоринг', 'Воронка', 'AI-коммуникация', 'Аналитика'],
    example: 'лиды'
  },
  {
    id: 'general-agents',
    name: 'General Agents',
    type: 'Агентная система',
    icon: '🤖',
    description: 'Общие AI агенты для решения сложных задач в агентном режиме',
    enabled: props.toolsConfig.agentsEnabled !== false,
    capabilities: ['Планирование', 'Рассуждение', 'Выполнение'],
    example: 'Включается через "Агентный режим"'
  },
  {
    id: 'social-analytics',
    name: 'Social Analytics Agent',
    type: 'Утилитарный агент',
    icon: '📊',
    description: 'Единая платформа аналитики социальных сетей: YouTube, Telegram, VK. Триггеры: "аналитика youtube", "статистика telegram", "соцсети"',
    enabled: props.toolsConfig.socialAnalyticsEnabled !== false,
    capabilities: ['YouTube', 'Telegram', 'VK', 'Охваты', 'Тренды'],
    example: 'аналитика youtube канал @channel'
  },
  {
    id: 'youtube-analytics',
    name: 'YouTube Analytics Agent',
    type: 'Утилитарный агент',
    icon: '📺',
    description: 'Собирает статистику YouTube каналов, анализирует тренды и генерирует прогнозы роста аудитории. Триггеры: "youtube", "ютуб канал"',
    enabled: props.toolsConfig.youtubeAnalyticsEnabled !== false,
    capabilities: ['Статистика каналов', 'Анализ видео', 'Прогнозы роста', 'Сравнение'],
    example: 'youtube канал @MrBeast'
  },
  {
    id: 'telegram-ads',
    name: 'Telegram Ads Agent',
    type: 'Утилитарный агент',
    icon: '📱',
    description: 'Агрегирует данные рекламных каналов Telegram, анализирует охваты и автоматизирует размещение объявлений. Триггеры: "телеграм реклама", "telegram ads"',
    enabled: props.toolsConfig.telegramAdsEnabled !== false,
    capabilities: ['Анализ охватов', 'Реклама', 'Каналы', 'Автоматизация'],
    example: 'телеграм реклама канал @channel'
  },
  {
    id: 'marketplace-analytics',
    name: 'Marketplace Analytics Agent',
    type: 'Утилитарный агент',
    icon: '🛍️',
    description: 'Мониторинг товарных позиций на Ozon, Wildberries, Яндекс.Маркет. Триггеры: "маркетплейс", "ozon", "wildberries"',
    enabled: props.toolsConfig.marketplaceAnalyticsEnabled !== false,
    capabilities: ['Ozon', 'Wildberries', 'Яндекс.Маркет', 'Аналитика продаж', 'Конкуренты'],
    example: 'маркетплейс аналитика товар iPhone'
  },
  {
    id: 'competitor-monitor',
    name: 'Competitor Monitor Agent',
    type: 'Утилитарный агент',
    icon: '👁️',
    description: 'Отслеживает изменения на сайтах конкурентов, собирает данные о ценах и контенте. Триггеры: "конкуренты", "мониторинг сайта"',
    enabled: props.toolsConfig.competitorMonitorEnabled !== false,
    capabilities: ['Мониторинг цен', 'Изменения контента', 'SEO-анализ', 'Соцсети'],
    example: 'конкуренты сайт example.com'
  },
  {
    id: 'conference-analytics',
    name: 'Conference Analytics Agent',
    type: 'Утилитарный агент',
    icon: '📹',
    description: 'Детальная аналитика видеоконференций: посещаемость, метрики вовлеченности. Триггеры: "аналитика конференций", "статистика звонков"',
    enabled: props.toolsConfig.conferenceAnalyticsEnabled !== false,
    capabilities: ['Посещаемость', 'Вовлеченность', 'Качество связи', 'Отчеты'],
    example: 'аналитика конференций за неделю'
  },
  {
    id: 'business-metrics',
    name: 'Business Metrics Agent',
    type: 'Утилитарный агент',
    icon: '📈',
    description: 'Отслеживание KPI, пользовательского поведения и метрик продукта. Триггеры: "бизнес метрики", "kpi", "аналитика продукта"',
    enabled: props.toolsConfig.businessMetricsEnabled !== false,
    capabilities: ['KPI', 'Retention', 'Churn', 'LTV', 'A/B тесты'],
    example: 'бизнес метрики за месяц'
  },
  {
    id: 'web-scraper',
    name: 'Web Scraper Agent',
    type: 'Утилитарный агент',
    icon: '🕷️',
    description: 'Извлекает данные с веб-сайтов по расписанию, обрабатывает сложные сценарии. Триггеры: "парсинг сайта", "scraper", "извлечь данные"',
    enabled: props.toolsConfig.webScraperEnabled !== false,
    capabilities: ['Парсинг HTML', 'Расписание', 'Сложные сценарии', 'Экспорт'],
    example: 'парсинг сайта example.com'
  },
  {
    id: 'smartq',
    name: 'SmartQ Agent',
    type: 'Утилитарный агент',
    icon: '🔍',
    description: 'Интерактивная система для создания и выполнения динамических отчётов с SQL запросами. Триггеры: "smartq", "отчет sql", "запрос"',
    enabled: props.toolsConfig.smartqEnabled !== false,
    capabilities: ['SQL запросы', 'Динамические отчеты', 'Фильтрация', 'Экспорт'],
    example: 'smartq создать отчет пользователи'
  },
  {
    id: 'marketplace-agent',
    name: 'Marketplace Agent',
    type: 'Утилитарный агент',
    icon: '🏪',
    description: 'Полнофункциональный агент для работы с Wildberries и Amazon. Триггеры: "wildberries", "amazon marketplace"',
    enabled: props.toolsConfig.marketplaceAgentEnabled !== false,
    capabilities: ['Wildberries API', 'Amazon API', 'Управление товарами', 'Аналитика'],
    example: 'wildberries мои товары'
  },
  {
    id: 'marketplace-review',
    name: 'Marketplace Review Agent',
    type: 'Утилитарный агент',
    icon: '⭐',
    description: 'Автоматическое написание и размещение отзывов на маркетплейсах. Триггеры: "отзывы маркетплейс", "написать отзыв"',
    enabled: props.toolsConfig.marketplaceReviewEnabled !== false,
    capabilities: ['Генерация отзывов', 'Размещение', 'AI-персонализация', 'Шаблоны'],
    example: 'написать отзыв товар iPhone'
  },
  {
    id: 'agro-analytics',
    name: 'Agro Analytics Agent',
    type: 'Утилитарный агент',
    icon: '🌾',
    description: 'Собирает данные с агродронов и датчиков полей, анализирует состояние посевов. Триггеры: "агроаналитика", "состояние поля"',
    enabled: props.toolsConfig.agroAnalyticsEnabled !== false,
    capabilities: ['Дроны', 'Датчики полей', 'Анализ посевов', 'Рецептуры'],
    example: 'агроаналитика поле 5'
  },
  {
    id: 'health-monitor',
    name: 'Health Monitor Agent',
    type: 'Утилитарный агент',
    icon: '💚',
    description: 'Автоматический мониторинг подключения всех агентов к бэкенду. Триггеры: "здоровье агентов", "мониторинг"',
    enabled: props.toolsConfig.healthMonitorEnabled !== false,
    capabilities: ['Health checks', 'Диагностика', 'Автовосстановление', 'Алерты'],
    example: 'здоровье агентов'
  },
  {
    id: 'orchestrator',
    name: 'Orchestrator Agent',
    type: 'Утилитарный агент',
    icon: '🎭',
    description: 'Централизованное управление всей мультиагентной сетью DronDoc. Триггеры: "оркестратор", "управление агентами"',
    enabled: props.toolsConfig.orchestratorEnabled !== false,
    capabilities: ['Старт/стоп агентов', 'Мониторинг', 'Конфигурация', 'Логи'],
    example: 'оркестратор статус'
  },
  {
    id: 'system-health-dashboard',
    name: 'System Health Dashboard Agent',
    type: 'Утилитарный агент',
    icon: '🏥',
    description: 'Централизованный dashboard для мониторинга здоровья всей системы. Триггеры: "системный дашборд", "общее здоровье"',
    enabled: props.toolsConfig.systemHealthDashboardEnabled !== false,
    capabilities: ['Overall Health Score', 'Метрики производительности', 'Визуализация', 'Алерты'],
    example: 'системный дашборд'
  },
  {
    id: 'test-runner',
    name: 'Test Runner Agent',
    type: 'Утилитарный агент',
    icon: '🧪',
    description: 'Единая страница для запуска всех тестов проекта: unit, integration, E2E. Триггеры: "запустить тесты", "test runner"',
    enabled: props.toolsConfig.testRunnerEnabled !== false,
    capabilities: ['Unit тесты', 'Integration', 'E2E', 'Coverage', 'Логи'],
    example: 'запустить тесты'
  },
  {
    id: 'integram-test',
    name: 'Integram Test Agent',
    type: 'Утилитарный агент',
    icon: '🔧',
    description: 'Полная реализация взаимодействия с Integram API: авторизация, словарь типов, метаданные. Триггеры: "integram тест", "проверить integram"',
    enabled: props.toolsConfig.integramTestEnabled !== false,
    capabilities: ['Авторизация', 'Словарь типов', 'Метаданные', 'CRUD операции'],
    example: 'integram тест'
  },
  {
    id: 'mcp-agent',
    name: 'MCP Agent',
    type: 'Утилитарный агент',
    icon: '🔌',
    description: 'Управление серверами Model Context Protocol для расширения возможностей AI. Триггеры: "mcp сервер", "mcp tools"',
    enabled: props.toolsConfig.mcpAgentEnabled !== false,
    capabilities: ['100+ MCP серверов', 'Базы данных', 'API', 'Файлы', 'Браузер'],
    example: 'mcp сервер список'
  },
  {
    id: 'integration-agent',
    name: 'Integration Agent',
    type: 'Утилитарный агент',
    icon: '🔗',
    description: 'Универсальный агент для интеграции с внешними сервисами. Триггеры: "интеграция", "подключить сервис"',
    enabled: props.toolsConfig.integrationAgentEnabled !== false,
    capabilities: ['REST API', 'Коннекторы', 'Трансформация данных', 'Синхронизация'],
    example: 'интеграция подключить API'
  },
  {
    id: 'github-agent',
    name: 'GitHub Agent',
    type: 'Утилитарный агент',
    icon: '🐙',
    description: 'Агент интеграции с GitHub для управления репозиториями и Pull Requests. Триггеры: "github", "пул реквест", "репозиторий"',
    enabled: props.toolsConfig.githubAgentEnabled !== false,
    capabilities: ['Репозитории', 'Pull Requests', 'Issues', 'Workflows', 'Commits'],
    example: 'github создать issue'
  },
  {
    id: 'crm-analytics',
    name: 'CRM Analytics Agent',
    type: 'Утилитарный агент',
    icon: '📈',
    description: 'Аналитика CRM систем: конверсия воронки продаж, метрики клиентов, прогноз выручки. Триггеры: "crm аналитика", "воронка продаж"',
    enabled: props.toolsConfig.crmAnalyticsEnabled !== false,
    capabilities: ['Воронка продаж', 'Метрики клиентов', 'Прогнозы', 'Dashboards'],
    example: 'crm аналитика воронка за месяц'
  },
  {
    id: 'customer-analytics',
    name: 'Customer Analytics Agent',
    type: 'Утилитарный агент',
    icon: '👥',
    description: 'Глубокая аналитика поведения клиентов: сегментация, RFM-анализ, LTV, churn rate. Триггеры: "клиенты аналитика", "rfm анализ"',
    enabled: props.toolsConfig.customerAnalyticsEnabled !== false,
    capabilities: ['RFM-анализ', 'Сегментация', 'LTV', 'Churn Rate', 'Retention'],
    example: 'клиенты rfm анализ'
  },
  {
    id: 'sales-funnel',
    name: 'Sales Funnel Agent',
    type: 'Утилитарный агент',
    icon: '🎯',
    description: 'Оптимизация воронки продаж: анализ конверсий на каждом этапе, A/B тесты, рекомендации. Триггеры: "воронка продаж", "конверсия"',
    enabled: props.toolsConfig.salesFunnelEnabled !== false,
    capabilities: ['Конверсии', 'A/B тесты', 'Оптимизация', 'Узкие места'],
    example: 'воронка продаж анализ'
  },
  {
    id: 'call-analytics',
    name: 'Call Analytics Agent',
    type: 'Утилитарный агент',
    icon: '📞',
    description: 'Аналитика телефонных звонков: транскрипция, распознавание эмоций, ключевые слова, качество обслуживания. Триггеры: "аналитика звонков", "качество звонков"',
    enabled: props.toolsConfig.callAnalyticsEnabled !== false,
    capabilities: ['Транскрипция', 'Sentiment', 'Ключевые слова', 'Качество', 'Speech-to-text'],
    example: 'аналитика звонков за день'
  },
  {
    id: 'customer-journey',
    name: 'Customer Journey Agent',
    type: 'Утилитарный агент',
    icon: '🗺️',
    description: 'Визуализация пути клиента от первого касания до покупки, анализ точек контакта. Триггеры: "путь клиента", "customer journey"',
    enabled: props.toolsConfig.customerJourneyEnabled !== false,
    capabilities: ['Touchpoints', 'Визуализация', 'Attribution', 'Оптимизация пути'],
    example: 'путь клиента визуализация'
  },
  {
    id: 'lead-scoring',
    name: 'Lead Scoring Agent',
    type: 'Утилитарный агент',
    icon: '⭐',
    description: 'Автоматическая оценка качества лидов на основе поведения и данных. ML-модели для предсказания конверсии. Триггеры: "оценка лидов", "lead scoring"',
    enabled: props.toolsConfig.leadScoringEnabled !== false,
    capabilities: ['ML-оценка', 'Predictive scoring', 'Приоритизация', 'Автоматизация'],
    example: 'lead scoring настроить модель'
  },
  {
    id: 'retention-analytics',
    name: 'Retention Analytics Agent',
    type: 'Утилитарный агент',
    icon: '🔁',
    description: 'Аналитика удержания клиентов: cohort analysis, retention curves, прогноз оттока. Триггеры: "retention", "удержание клиентов"',
    enabled: props.toolsConfig.retentionAnalyticsEnabled !== false,
    capabilities: ['Cohort Analysis', 'Retention Curves', 'Churn Prediction', 'Loyalty Programs'],
    example: 'retention анализ когорт'
  },
  {
    id: 'hr-agent',
    name: 'HR Agent',
    type: 'Утилитарный агент',
    icon: '👔',
    description: 'Автоматизация HR-процессов: онбординг, учет отпусков, KPI сотрудников, документооборот. Триггеры: "hr", "отпуска", "кадры"',
    enabled: props.toolsConfig.hrAgentEnabled !== false,
    capabilities: ['Онбординг', 'Отпуска', 'KPI', 'Документы', 'Аттестация'],
    example: 'hr учет отпусков'
  },
  {
    id: 'recruitment-agent',
    name: 'Recruitment Agent',
    type: 'Утилитарный агент',
    icon: '🎓',
    description: 'Автоматизация подбора персонала: парсинг резюме с hh.ru, скоринг кандидатов, формирование shortlist. Триггеры: "подбор", "рекрутинг"',
    enabled: props.toolsConfig.recruitmentAgentEnabled !== false,
    capabilities: ['Парсинг hh.ru', 'Скоринг резюме', 'Shortlist', 'Email-кампании'],
    example: 'подбор разработчик python'
  },
  {
    id: 'recruiter',
    name: 'Recruiter Agent',
    type: 'Утилитарный агент',
    icon: '🔍',
    description: 'AI-рекрутер: автоматический поиск кандидатов, первичный скрининг, назначение собеседований. Триггеры: "рекрутер", "поиск кандидатов"',
    enabled: props.toolsConfig.recruiterEnabled !== false,
    capabilities: ['Поиск кандидатов', 'Скрининг', 'Собеседования', 'Автоответы'],
    example: 'рекрутер найти frontend разработчика'
  },
  {
    id: 'staff-evaluation',
    name: 'Staff Evaluation Agent',
    type: 'Утилитарный агент',
    icon: '📊',
    description: 'Оценка персонала: 360-градусная оценка, формирование планов развития, анализ компетенций. Триггеры: "оценка персонала", "аттестация"',
    enabled: props.toolsConfig.staffEvaluationEnabled !== false,
    capabilities: ['360-оценка', 'Компетенции', 'Планы развития', 'Performance Review'],
    example: 'оценка персонала квартальная'
  },
  {
    id: 'interview-scheduler',
    name: 'Interview Scheduler Agent',
    type: 'Утилитарный агент',
    icon: '📅',
    description: 'Автоматическое планирование собеседований с учетом расписания интервьюеров и кандидатов. Триггеры: "собеседование", "interview"',
    enabled: props.toolsConfig.interviewSchedulerEnabled !== false,
    capabilities: ['Календари', 'Автоназначение', 'Напоминания', 'Zoom/Meet интеграция'],
    example: 'собеседование запланировать на неделю'
  },
  {
    id: 'onboarding-agent',
    name: 'Onboarding Agent',
    type: 'Утилитарный агент',
    icon: '🚀',
    description: 'Автоматизация онбординга новых сотрудников: welcome-треки, чеклисты, обучение, адаптация. Триггеры: "онбординг", "адаптация"',
    enabled: props.toolsConfig.onboardingAgentEnabled !== false,
    capabilities: ['Welcome-треки', 'Чеклисты', 'Обучение', 'Buddy-система'],
    example: 'онбординг новый сотрудник'
  },
  {
    id: 'financial-analyst',
    name: 'Financial Analyst Agent',
    type: 'Утилитарный агент',
    icon: '💰',
    description: 'Финансовый анализ: P&L отчеты, cash flow, прогнозирование выручки, анализ расходов. Триггеры: "финансы", "p&l", "cash flow"',
    enabled: props.toolsConfig.financialAnalystEnabled !== false,
    capabilities: ['P&L', 'Cash Flow', 'Прогнозы', 'EBITDA', 'Break-even'],
    example: 'финансы p&l за квартал'
  },
  {
    id: 'accounting-agent',
    name: 'Accounting Agent',
    type: 'Утилитарный агент',
    icon: '🧮',
    description: 'Автоматизация бухгалтерии: проводки, первичные документы, сверка с банком, НДФЛ. Триггеры: "бухгалтерия", "проводки"',
    enabled: props.toolsConfig.accountingAgentEnabled !== false,
    capabilities: ['Проводки', 'Первичка', 'Банк', 'НДФЛ', 'Сверки'],
    example: 'бухгалтерия проводки за месяц'
  },
  {
    id: 'tax-agent',
    name: 'Tax Agent',
    type: 'Утилитарный агент',
    icon: '📝',
    description: 'Налоговый агент: расчет налогов (НДС, налог на прибыль, УСН), формирование деклараций. Триггеры: "налоги", "ндс", "усн"',
    enabled: props.toolsConfig.taxAgentEnabled !== false,
    capabilities: ['НДС', 'Налог на прибыль', 'УСН', 'Декларации', 'Оптимизация'],
    example: 'налоги усн расчет'
  },
  {
    id: 'budget-agent',
    name: 'Budget Management Agent',
    type: 'Утилитарный агент',
    icon: '💵',
    description: 'Управление бюджетом: планирование, контроль исполнения, анализ отклонений, alerts. Триггеры: "бюджет", "budget"',
    enabled: props.toolsConfig.budgetAgentEnabled !== false,
    capabilities: ['Планирование', 'Контроль', 'Отклонения', 'Alerts', 'Forecast'],
    example: 'бюджет анализ исполнения'
  },
  {
    id: 'invoice-agent',
    name: 'Invoice Agent',
    type: 'Утилитарный агент',
    icon: '🧾',
    description: 'Автоматизация счетов: выставление счетов, акты, УПД, контроль оплат, напоминания. Триггеры: "счет", "invoice", "упд"',
    enabled: props.toolsConfig.invoiceAgentEnabled !== false,
    capabilities: ['Счета', 'Акты', 'УПД', 'Контроль оплат', 'Напоминания'],
    example: 'счет выставить клиенту'
  },
  {
    id: 'content-creator',
    name: 'Content Creator Agent',
    type: 'Утилитарный агент',
    icon: '✍️',
    description: 'Создание контента: посты для соцсетей, статьи, email-рассылки, SEO-тексты. GPT-4 generation. Триггеры: "контент", "написать пост"',
    enabled: props.toolsConfig.contentCreatorEnabled !== false,
    capabilities: ['Посты', 'Статьи', 'Email', 'SEO-тексты', 'Рерайт'],
    example: 'контент написать пост для instagram'
  },
  {
    id: 'video-editor',
    name: 'Video Editor Agent',
    type: 'Утилитарный агент',
    icon: '🎬',
    description: 'Автоматический монтаж видео: нарезка highlights, субтитры, transitions, эффекты. Триггеры: "видео монтаж", "video editor"',
    enabled: props.toolsConfig.videoEditorEnabled !== false,
    capabilities: ['Монтаж', 'Субтитры', 'Transitions', 'Эффекты', 'Auto-highlights'],
    example: 'видео монтаж добавить субтитры'
  },
  {
    id: 'review-moderator',
    name: 'Review Moderator Agent',
    type: 'Утилитарный агент',
    icon: '⭐',
    description: 'Модерация отзывов: фильтрация спама, sentiment analysis, автоответы, агрегация с площадок. Триггеры: "отзывы", "модерация"',
    enabled: props.toolsConfig.reviewModeratorEnabled !== false,
    capabilities: ['Спам-фильтр', 'Sentiment', 'Автоответы', 'Агрегация'],
    example: 'отзывы модерация за неделю'
  },
  {
    id: 'content-calendar',
    name: 'Content Calendar Agent',
    type: 'Утилитарный агент',
    icon: '📆',
    description: 'Контент-календарь: планирование публикаций, автопостинг, аналитика охватов, тренды. Триггеры: "контент календарь", "публикации"',
    enabled: props.toolsConfig.contentCalendarEnabled !== false,
    capabilities: ['Календарь', 'Автопостинг', 'Охваты', 'Тренды', 'Multi-channel'],
    example: 'контент календарь на месяц'
  },
  {
    id: 'image-generator',
    name: 'Image Generator Agent',
    type: 'Утилитарный агент',
    icon: '🖼️',
    description: 'Генерация изображений через AI: DALL-E, Midjourney, Stable Diffusion. Триггеры: "генерация изображений", "нарисовать"',
    enabled: props.toolsConfig.imageGeneratorEnabled !== false,
    capabilities: ['DALL-E', 'Midjourney', 'Stable Diffusion', 'Upscaling', 'Variations'],
    example: 'нарисовать логотип для компании'
  },
  {
    id: 'seo-agent',
    name: 'SEO Agent',
    type: 'Утилитарный агент',
    icon: '🔎',
    description: 'SEO-оптимизация: аудит сайта, подбор ключевых слов, анализ конкурентов, мета-теги. Триггеры: "seo", "оптимизация сайта"',
    enabled: props.toolsConfig.seoAgentEnabled !== false,
    capabilities: ['Аудит', 'Keywords', 'Конкуренты', 'Мета-теги', 'Link Building'],
    example: 'seo аудит сайта example.com'
  },
  {
    id: 'email-marketing',
    name: 'Email Marketing Agent',
    type: 'Утилитарный агент',
    icon: '📧',
    description: 'Email-маркетинг: создание рассылок, сегментация, A/B тесты, аналитика открытий и кликов. Триггеры: "email рассылка", "newsletter"',
    enabled: props.toolsConfig.emailMarketingEnabled !== false,
    capabilities: ['Рассылки', 'Сегментация', 'A/B тесты', 'Open Rate', 'CTR'],
    example: 'email рассылка создать кампанию'
  },
  {
    id: 'smm-analytics',
    name: 'SMM Analytics Agent',
    type: 'Утилитарный агент',
    icon: '📱',
    description: 'Аналитика SMM: охваты, вовлеченность, follower growth, конкуренты, best time to post. Триггеры: "smm аналитика", "соцсети статистика"',
    enabled: props.toolsConfig.smmAnalyticsEnabled !== false,
    capabilities: ['Охваты', 'Engagement', 'Growth', 'Конкуренты', 'Best Time'],
    example: 'smm аналитика instagram'
  },
  {
    id: 'contextual-ads',
    name: 'Contextual Ads Agent',
    type: 'Утилитарный агент',
    icon: '🎯',
    description: 'Контекстная реклама: управление кампаниями Яндекс.Директ и Google Ads, оптимизация ставок. Триггеры: "директ", "google ads"',
    enabled: props.toolsConfig.contextualAdsEnabled !== false,
    capabilities: ['Яндекс.Директ', 'Google Ads', 'Ставки', 'ROI', 'Автооптимизация'],
    example: 'директ оптимизировать кампанию'
  },
  {
    id: 'landing-optimizer',
    name: 'Landing Page Optimizer Agent',
    type: 'Утилитарный агент',
    icon: '🎨',
    description: 'Оптимизация лендингов: A/B тесты, heatmaps, анализ UX, рекомендации по конверсии. Триггеры: "лендинг", "landing page"',
    enabled: props.toolsConfig.landingOptimizerEnabled !== false,
    capabilities: ['A/B тесты', 'Heatmaps', 'UX анализ', 'Конверсия', 'Рекомендации'],
    example: 'лендинг оптимизация конверсии'
  },
  {
    id: 'conversion-analytics',
    name: 'Conversion Analytics Agent',
    type: 'Утилитарный агент',
    icon: '📈',
    description: 'Аналитика конверсий: воронка, attribution models, multi-touch, ROI по каналам. Триггеры: "конверсии", "attribution"',
    enabled: props.toolsConfig.conversionAnalyticsEnabled !== false,
    capabilities: ['Воронка', 'Attribution', 'Multi-touch', 'ROI', 'Channel Performance'],
    example: 'конверсии attribution анализ'
  },
  {
    id: 'support-ticket',
    name: 'Support Ticket Agent',
    type: 'Утилитарный агент',
    icon: '🎫',
    description: 'Система обработки тикетов поддержки: автоматическая категоризация, приоритеты, SLA, эскалация. Триггеры: "тикет", "support ticket"',
    enabled: props.toolsConfig.supportTicketEnabled !== false,
    capabilities: ['Категоризация', 'Приоритеты', 'SLA', 'Эскалация', 'Auto-responses'],
    example: 'тикет создать от клиента'
  },
  {
    id: 'feedback-analyzer',
    name: 'Feedback Analyzer Agent',
    type: 'Утилитарный агент',
    icon: '💬',
    description: 'Анализ обратной связи: NPS, CSAT, sentiment analysis, категоризация, тренды. Триггеры: "фидбек", "обратная связь"',
    enabled: props.toolsConfig.feedbackAnalyzerEnabled !== false,
    capabilities: ['NPS', 'CSAT', 'Sentiment', 'Категории', 'Тренды', 'Insights'],
    example: 'фидбек анализ за месяц'
  },
  {
    id: 'chatbot-builder',
    name: 'Chatbot Builder Agent',
    type: 'Утилитарный агент',
    icon: '🤖',
    description: 'Конструктор чат-ботов: визуальный редактор сценариев, интеграции, NLU, аналитика. Триггеры: "чатбот", "создать бот"',
    enabled: props.toolsConfig.chatbotBuilderEnabled !== false,
    capabilities: ['Сценарии', 'NLU', 'Интеграции', 'Аналитика', 'Multi-channel'],
    example: 'чатбот создать для поддержки'
  },
  {
    id: 'live-chat',
    name: 'Live Chat Agent',
    type: 'Утилитарный агент',
    icon: '💭',
    description: 'AI-ассистент для операторов live chat: подсказки ответов, автоматические ответы на FAQ, история клиента. Триггеры: "live chat", "чат поддержка"',
    enabled: props.toolsConfig.liveChatEnabled !== false,
    capabilities: ['Подсказки', 'FAQ', 'История', 'Переводы', 'Sentiment'],
    example: 'live chat подключить'
  },
  {
    id: 'document-processor',
    name: 'Document Processor Agent',
    type: 'Утилитарный агент',
    icon: '📄',
    description: 'Обработка документов: OCR, извлечение данных, классификация, конвертация форматов. Триггеры: "обработать документ", "document processing"',
    enabled: props.toolsConfig.documentProcessorEnabled !== false,
    capabilities: ['OCR', 'Извлечение данных', 'Классификация', 'Конвертация'],
    example: 'обработать документ скан паспорта'
  },
  {
    id: 'pdf-parser',
    name: 'PDF Parser Agent',
    type: 'Утилитарный агент',
    icon: '📕',
    description: 'Парсинг PDF: извлечение текста, таблиц, изображений, метаданных, структурирование. Триггеры: "pdf парсинг", "извлечь из pdf"',
    enabled: props.toolsConfig.pdfParserEnabled !== false,
    capabilities: ['Текст', 'Таблицы', 'Изображения', 'Метаданные', 'Структура'],
    example: 'pdf парсинг извлечь таблицы'
  },
  {
    id: 'data-transformer',
    name: 'Data Transformer Agent',
    type: 'Утилитарный агент',
    icon: '🔄',
    description: 'Трансформация данных: ETL процессы, маппинг, валидация, очистка, конвертация форматов. Триггеры: "трансформация данных", "etl"',
    enabled: props.toolsConfig.dataTransformerEnabled !== false,
    capabilities: ['ETL', 'Маппинг', 'Валидация', 'Очистка', 'Конвертация'],
    example: 'etl трансформация csv в json'
  },
  {
    id: 'report-generator',
    name: 'Report Generator Agent',
    type: 'Утилитарный агент',
    icon: '📊',
    description: 'Генерация отчетов: шаблоны, автоматические данные, графики, экспорт в PDF/Excel. Триггеры: "отчет", "report generate"',
    enabled: props.toolsConfig.reportGeneratorEnabled !== false,
    capabilities: ['Шаблоны', 'Графики', 'PDF', 'Excel', 'Автоматизация'],
    example: 'отчет продажи за месяц'
  },
  {
    id: 'excel-analyzer',
    name: 'Excel Analyzer Agent',
    type: 'Утилитарный агент',
    icon: '📊',
    description: 'Анализ Excel таблиц: статистика, сводные таблицы, визуализация, поиск аномалий. Триггеры: "excel анализ", "таблица excel"',
    enabled: props.toolsConfig.excelAnalyzerEnabled !== false,
    capabilities: ['Статистика', 'Pivot Tables', 'Графики', 'Аномалии', 'Формулы'],
    example: 'excel анализ продажи.xlsx'
  },
  {
    id: 'form-builder',
    name: 'Form Builder Agent',
    type: 'Утилитарный агент',
    icon: '📝',
    description: 'Конструктор форм: drag-and-drop, валидация, условная логика, интеграции, аналитика. Триггеры: "форма", "создать форму"',
    enabled: props.toolsConfig.formBuilderEnabled !== false,
    capabilities: ['Drag-and-drop', 'Валидация', 'Логика', 'Интеграции', 'Аналитика'],
    example: 'создать форму заявки'
  },
  {
    id: 'security-monitor',
    name: 'Security Monitor Agent',
    type: 'Утилитарный агент',
    icon: '🔒',
    description: 'Мониторинг безопасности: обнаружение угроз, логи, alerts, SIEM интеграция. Триггеры: "security", "безопасность"',
    enabled: props.toolsConfig.securityMonitorEnabled !== false,
    capabilities: ['Threat Detection', 'Логи', 'Alerts', 'SIEM', 'Intrusion Detection'],
    example: 'security мониторинг сервера'
  },
  {
    id: 'audit-agent',
    name: 'Audit Agent',
    type: 'Утилитарный агент',
    icon: '🔍',
    description: 'Аудит систем: логи доступа, изменения данных, compliance проверки, отчеты. Триггеры: "аудит", "audit log"',
    enabled: props.toolsConfig.auditAgentEnabled !== false,
    capabilities: ['Логи доступа', 'Изменения', 'Compliance', 'Отчеты', 'Traces'],
    example: 'аудит логи за неделю'
  },
  {
    id: 'compliance-agent',
    name: 'Compliance Agent',
    type: 'Утилитарный агент',
    icon: '⚖️',
    description: 'Контроль соответствия: GDPR, PCI DSS, HIPAA, ISO, проверка политик, автоматические отчеты. Триггеры: "compliance", "соответствие"',
    enabled: props.toolsConfig.complianceAgentEnabled !== false,
    capabilities: ['GDPR', 'PCI DSS', 'HIPAA', 'ISO', 'Политики', 'Отчеты'],
    example: 'compliance проверка gdpr'
  },
  {
    id: 'gdpr-agent',
    name: 'GDPR Agent',
    type: 'Утилитарный агент',
    icon: '🇪🇺',
    description: 'GDPR compliance: управление согласиями, право на забвение, data portability, breach notification. Триггеры: "gdpr", "персональные данные"',
    enabled: props.toolsConfig.gdprAgentEnabled !== false,
    capabilities: ['Согласия', 'Удаление данных', 'Экспорт', 'Breach alerts'],
    example: 'gdpr удалить данные пользователя'
  },
  {
    id: 'pentest-agent',
    name: 'Penetration Testing Agent',
    type: 'Утилитарный агент',
    icon: '🎯',
    description: 'Автоматическое тестирование на проникновение: сканирование уязвимостей, эксплуатация, отчеты. Триггеры: "pentest", "тест уязвимостей"',
    enabled: props.toolsConfig.pentestAgentEnabled !== false,
    capabilities: ['Сканирование', 'Эксплуатация', 'OWASP Top 10', 'Отчеты'],
    example: 'pentest сканировать сайт'
  },
  {
    id: 'code-generator',
    name: 'Code Generator Agent',
    type: 'Утилитарный агент',
    icon: '⚙️',
    description: 'Генерация кода: по описанию, по шаблонам, CRUD, API endpoints, тесты. GPT-4 Codex. Триггеры: "генерация кода", "code generate"',
    enabled: props.toolsConfig.codeGeneratorEnabled !== false,
    capabilities: ['GPT-4 Codex', 'CRUD', 'API', 'Тесты', 'Рефакторинг'],
    example: 'code generate REST API для пользователей'
  },
  {
    id: 'bug-tracker',
    name: 'Bug Tracker Agent',
    type: 'Утилитарный агент',
    icon: '🐛',
    description: 'Трекинг багов: автоматическое создание issues, приоритизация, связь с коммитами, аналитика. Триггеры: "bug", "баг трекер"',
    enabled: props.toolsConfig.bugTrackerEnabled !== false,
    capabilities: ['Issues', 'Приоритизация', 'Git integration', 'Аналитика'],
    example: 'bug создать issue из лога'
  },
  {
    id: 'cicd-agent',
    name: 'CI/CD Agent',
    type: 'Утилитарный агент',
    icon: '🔧',
    description: 'Управление CI/CD: GitHub Actions, GitLab CI, Jenkins, деплой, мониторинг пайплайнов. Триггеры: "ci/cd", "деплой"',
    enabled: props.toolsConfig.cicdAgentEnabled !== false,
    capabilities: ['GitHub Actions', 'GitLab CI', 'Jenkins', 'Деплой', 'Monitoring'],
    example: 'ci/cd запустить деплой на prod'
  },
  {
    id: 'docker-manager',
    name: 'Docker Manager Agent',
    type: 'Утилитарный агент',
    icon: '🐳',
    description: 'Управление Docker: образы, контейнеры, compose, swarm, мониторинг ресурсов. Триггеры: "docker", "контейнеры"',
    enabled: props.toolsConfig.dockerManagerEnabled !== false,
    capabilities: ['Images', 'Containers', 'Compose', 'Swarm', 'Monitoring'],
    example: 'docker список контейнеров'
  },
  {
    id: 'database-admin',
    name: 'Database Admin Agent',
    type: 'Утилитарный агент',
    icon: '🗄️',
    description: 'Администрирование БД: бэкапы, миграции, оптимизация запросов, мониторинг производительности. Триггеры: "database", "база данных"',
    enabled: props.toolsConfig.databaseAdminEnabled !== false,
    capabilities: ['Бэкапы', 'Миграции', 'Оптимизация', 'Мониторинг', 'Query Analysis'],
    example: 'database бэкап postgresql'
  },
  {
    id: 'delivery-tracker',
    name: 'Delivery Tracker Agent',
    type: 'Утилитарный агент',
    icon: '📦',
    description: 'Отслеживание доставки: интеграция с СДЭК, DPD, Почта России, notifications. Триггеры: "доставка", "трек номер"',
    enabled: props.toolsConfig.deliveryTrackerEnabled !== false,
    capabilities: ['СДЭК', 'DPD', 'Почта России', 'Notifications', 'ETA'],
    example: 'доставка трек 1234567890'
  },
  {
    id: 'warehouse-agent',
    name: 'Warehouse Agent',
    type: 'Утилитарный агент',
    icon: '🏭',
    description: 'Управление складом: учет товаров, приемка, отгрузка, инвентаризация, остатки. Триггеры: "склад", "warehouse"',
    enabled: props.toolsConfig.warehouseAgentEnabled !== false,
    capabilities: ['Учет товаров', 'Приемка', 'Отгрузка', 'Инвентаризация', 'Остатки'],
    example: 'склад остатки товара'
  },
  {
    id: 'route-optimizer',
    name: 'Route Optimizer Agent',
    type: 'Утилитарный агент',
    icon: '🗺️',
    description: 'Оптимизация маршрутов доставки: алгоритмы TSP, учет пробок, расход топлива, временные окна. Триггеры: "маршрут", "route optimize"',
    enabled: props.toolsConfig.routeOptimizerEnabled !== false,
    capabilities: ['TSP', 'Пробки', 'Расход топлива', 'Временные окна', 'Multi-depot'],
    example: 'маршрут оптимизировать доставку'
  },
  {
    id: 'inventory-manager',
    name: 'Inventory Manager Agent',
    type: 'Утилитарный агент',
    icon: '📊',
    description: 'Управление запасами: учет, списание, перемещение, ABC-анализ, прогноз потребности. Триггеры: "запасы", "inventory"',
    enabled: props.toolsConfig.inventoryManagerEnabled !== false,
    capabilities: ['Учет', 'ABC-анализ', 'Прогноз', 'Списание', 'Перемещение'],
    example: 'запасы abc анализ'
  },
  {
    id: 'smart-home',
    name: 'Smart Home Agent',
    type: 'Утилитарный агент',
    icon: '🏠',
    description: 'Управление умным домом: IoT устройства, автоматизация, сценарии, мониторинг. Триггеры: "умный дом", "smart home"',
    enabled: props.toolsConfig.smartHomeEnabled !== false,
    capabilities: ['IoT', 'Автоматизация', 'Сценарии', 'Мониторинг', 'Voice Control'],
    example: 'умный дом включить свет'
  },
  {
    id: 'sensor-monitor',
    name: 'Sensor Monitor Agent',
    type: 'Утилитарный агент',
    icon: '📡',
    description: 'Мониторинг датчиков: температура, влажность, давление, движение, alerts. Триггеры: "датчики", "sensors"',
    enabled: props.toolsConfig.sensorMonitorEnabled !== false,
    capabilities: ['Температура', 'Влажность', 'Движение', 'Alerts', 'Dashboards'],
    example: 'датчики температура в комнате'
  },
  {
    id: 'automation-builder',
    name: 'Automation Builder Agent',
    type: 'Утилитарный агент',
    icon: '🤖',
    description: 'Конструктор автоматизаций: визуальный редактор, триггеры, условия, действия, интеграции. Триггеры: "автоматизация", "automation"',
    enabled: props.toolsConfig.automationBuilderEnabled !== false,
    capabilities: ['Visual Editor', 'Триггеры', 'Условия', 'Действия', 'Интеграции'],
    example: 'автоматизация создать сценарий'
  },
  {
    id: 'scada-agent',
    name: 'SCADA Agent',
    type: 'Утилитарный агент',
    icon: '🏭',
    description: 'SCADA системы: мониторинг промышленных процессов, управление оборудованием, диспетчеризация. Триггеры: "scada", "диспетчеризация"',
    enabled: props.toolsConfig.scadaAgentEnabled !== false,
    capabilities: ['Мониторинг', 'Управление', 'Диспетчеризация', 'Alerts', 'HMI'],
    example: 'scada мониторинг линии производства'
  },
  {
    id: 'contract-manager',
    name: 'Contract Manager Agent',
    type: 'Утилитарный агент',
    icon: '📜',
    description: 'Управление договорами: хранение, сроки, напоминания, шаблоны, электронная подпись. Триггеры: "договор", "contract"',
    enabled: props.toolsConfig.contractManagerEnabled !== false,
    capabilities: ['Хранение', 'Сроки', 'Напоминания', 'Шаблоны', 'ЭЦП'],
    example: 'договор создать из шаблона'
  },
  {
    id: 'legal-assistant',
    name: 'Legal Assistant Agent',
    type: 'Утилитарный агент',
    icon: '⚖️',
    description: 'Юридический помощник: анализ документов, поиск прецедентов, генерация договоров, консультации. Триггеры: "юрист", "legal"',
    enabled: props.toolsConfig.legalAssistantEnabled !== false,
    capabilities: ['Анализ документов', 'Прецеденты', 'Договоры', 'Консультации'],
    example: 'legal анализ договор поставки'
  },
  {
    id: 'product-catalog',
    name: 'Product Catalog Manager',
    type: 'Утилитарный агент',
    icon: '🛒',
    description: 'Управление каталогом товаров: добавление, редактирование, категоризация, импорт/экспорт, SEO. Триггеры: "каталог товаров", "product catalog"',
    enabled: props.toolsConfig.productCatalogEnabled !== false,
    capabilities: ['CRUD товаров', 'Категории', 'Импорт/Экспорт', 'SEO', 'Вариации'],
    example: 'каталог товаров добавить категорию'
  },
  {
    id: 'order-processing',
    name: 'Order Processing Agent',
    type: 'Утилитарный агент',
    icon: '📦',
    description: 'Обработка заказов: создание, статусы, оплата, доставка, notifications. Триггеры: "заказ", "order processing"',
    enabled: props.toolsConfig.orderProcessingEnabled !== false,
    capabilities: ['Создание заказов', 'Статусы', 'Оплата', 'Доставка', 'Notifications'],
    example: 'order создать новый заказ'
  },
  {
    id: 'returns-manager',
    name: 'Returns Manager Agent',
    type: 'Утилитарный агент',
    icon: '↩️',
    description: 'Управление возвратами: заявки, причины, возврат средств, обмен, аналитика. Триггеры: "возврат", "returns"',
    enabled: props.toolsConfig.returnsManagerEnabled !== false,
    capabilities: ['Заявки', 'Возврат средств', 'Обмен', 'Аналитика', 'Автоматизация'],
    example: 'returns обработать возврат'
  },
  {
    id: 'price-monitor',
    name: 'Price Monitor Agent',
    type: 'Утилитарный агент',
    icon: '💰',
    description: 'Мониторинг цен конкурентов: парсинг, сравнение, динамика, alerts, recommendations. Триггеры: "цены конкурентов", "price monitor"',
    enabled: props.toolsConfig.priceMonitorEnabled !== false,
    capabilities: ['Парсинг цен', 'Сравнение', 'Динамика', 'Alerts', 'Рекомендации'],
    example: 'price monitor товар iPhone'
  },
  {
    id: 'review-generator',
    name: 'Review Generator Agent',
    type: 'Утилитарный агент',
    icon: '⭐',
    description: 'Генерация отзывов товаров: автоматические на основе характеристик, мультиязычные. Триггеры: "генерация отзывов", "review generate"',
    enabled: props.toolsConfig.reviewGeneratorEnabled !== false,
    capabilities: ['GPT-генерация', 'Мультиязычность', 'Тональность', 'Вариации'],
    example: 'review generate для товара'
  },
  {
    id: 'lms-agent',
    name: 'Learning Management Agent',
    type: 'Утилитарный агент',
    icon: '🎓',
    description: 'Система управления обучением: курсы, студенты, прогресс, сертификаты, аналитика. Триггеры: "lms", "обучение"',
    enabled: props.toolsConfig.lmsAgentEnabled !== false,
    capabilities: ['Курсы', 'Студенты', 'Прогресс', 'Сертификаты', 'Аналитика'],
    example: 'lms создать курс'
  },
  {
    id: 'quiz-generator',
    name: 'Quiz Generator Agent',
    type: 'Утилитарный агент',
    icon: '❓',
    description: 'Генератор тестов и викторин: вопросы по теме, варианты ответов, scoring, feedback. Триггеры: "тест", "quiz generate"',
    enabled: props.toolsConfig.quizGeneratorEnabled !== false,
    capabilities: ['GPT-вопросы', 'Варианты ответов', 'Scoring', 'Feedback'],
    example: 'quiz generate по JavaScript'
  },
  {
    id: 'training-content',
    name: 'Training Content Creator',
    type: 'Утилитарный агент',
    icon: '📚',
    description: 'Создание учебного контента: уроки, статьи, видеоскрипты, презентации. GPT-4. Триггеры: "учебный контент", "training content"',
    enabled: props.toolsConfig.trainingContentEnabled !== false,
    capabilities: ['Уроки', 'Статьи', 'Видеоскрипты', 'Презентации', 'Адаптация'],
    example: 'training content урок по Python'
  },
  {
    id: 'course-builder',
    name: 'Course Builder Agent',
    type: 'Утилитарный агент',
    icon: '🏗️',
    description: 'Конструктор курсов: структура, модули, уроки, задания, интеграции. Триггеры: "курс", "course builder"',
    enabled: props.toolsConfig.courseBuilderEnabled !== false,
    capabilities: ['Структура', 'Модули', 'Уроки', 'Задания', 'Интеграции'],
    example: 'course builder создать курс программирования'
  },
  {
    id: 'student-progress',
    name: 'Student Progress Tracker',
    type: 'Утилитарный агент',
    icon: '📊',
    description: 'Отслеживание прогресса студентов: завершенные уроки, тесты, оценки, аналитика, рекомендации. Триггеры: "прогресс студентов", "student progress"',
    enabled: props.toolsConfig.studentProgressEnabled !== false,
    capabilities: ['Прогресс', 'Тесты', 'Оценки', 'Аналитика', 'Рекомендации'],
    example: 'student progress анализ группы'
  },
  {
    id: 'property-listing',
    name: 'Property Listing Agent',
    type: 'Утилитарный агент',
    icon: '🏘️',
    description: 'Управление объявлениями недвижимости: публикация, фото, описания, интеграция с ЦИАН. Триггеры: "недвижимость", "property listing"',
    enabled: props.toolsConfig.propertyListingEnabled !== false,
    capabilities: ['ЦИАН', 'Avito', 'Фото', 'Описания', 'Автопубликация'],
    example: 'property listing добавить квартиру'
  },
  {
    id: 'valuation-agent',
    name: 'Valuation Agent',
    type: 'Утилитарный агент',
    icon: '💎',
    description: 'Оценка недвижимости: сравнительный анализ, рыночная стоимость, прогнозы. ML-модели. Триггеры: "оценка недвижимости", "valuation"',
    enabled: props.toolsConfig.valuationAgentEnabled !== false,
    capabilities: ['Сравнительный анализ', 'ML-оценка', 'Рыночная цена', 'Прогнозы'],
    example: 'valuation оценить квартиру'
  },
  {
    id: 'tenant-manager',
    name: 'Tenant Manager Agent',
    type: 'Утилитарный агент',
    icon: '🔑',
    description: 'Управление арендаторами: договоры, платежи, напоминания, заявки на ремонт. Триггеры: "арендаторы", "tenant"',
    enabled: props.toolsConfig.tenantManagerEnabled !== false,
    capabilities: ['Договоры', 'Платежи', 'Напоминания', 'Заявки', 'Коммуникация'],
    example: 'tenant добавить арендатора'
  },
  {
    id: 'medical-records',
    name: 'Medical Records Agent',
    type: 'Утилитарный агент',
    icon: '🏥',
    description: 'Электронная медицинская карта: история болезней, анализы, назначения, конфиденциальность. Триггеры: "медкарта", "medical records"',
    enabled: props.toolsConfig.medicalRecordsEnabled !== false,
    capabilities: ['История болезней', 'Анализы', 'Назначения', 'HIPAA', 'ЭЦП'],
    example: 'medical records добавить анализы'
  },
  {
    id: 'medical-appointment',
    name: 'Medical Appointment Scheduler',
    type: 'Утилитарный агент',
    icon: '📅',
    description: 'Запись к врачам: расписание, свободные слоты, напоминания, отмена, телемедицина. Триггеры: "запись к врачу", "medical appointment"',
    enabled: props.toolsConfig.medicalAppointmentEnabled !== false,
    capabilities: ['Расписание', 'Слоты', 'Напоминания', 'Телемедицина', 'SMS'],
    example: 'medical appointment записать к терапевту'
  },
  {
    id: 'prescription-manager',
    name: 'Prescription Manager Agent',
    type: 'Утилитарный агент',
    icon: '💊',
    description: 'Управление рецептами: назначения, дозировки, взаимодействия препаратов, напоминания. Триггеры: "рецепт", "prescription"',
    enabled: props.toolsConfig.prescriptionManagerEnabled !== false,
    capabilities: ['Назначения', 'Дозировки', 'Взаимодействия', 'Напоминания', 'Аптеки'],
    example: 'prescription назначить лекарство'
  },
  {
    id: 'hotel-booking',
    name: 'Hotel Booking Agent',
    type: 'Утилитарный агент',
    icon: '🏨',
    description: 'Бронирование отелей: поиск, сравнение цен, отзывы, интеграция с Booking.com. Триггеры: "отель", "hotel booking"',
    enabled: props.toolsConfig.hotelBookingEnabled !== false,
    capabilities: ['Booking.com', 'Поиск', 'Сравнение', 'Отзывы', 'Best Price'],
    example: 'hotel booking Москва 3 ночи'
  },
  {
    id: 'flight-tracker',
    name: 'Flight Tracker Agent',
    type: 'Утилитарный агент',
    icon: '✈️',
    description: 'Отслеживание рейсов: статус, задержки, изменения, notifications, аэропорты. Триггеры: "рейс", "flight tracker"',
    enabled: props.toolsConfig.flightTrackerEnabled !== false,
    capabilities: ['Статус рейса', 'Задержки', 'Notifications', 'Аэропорты', 'Real-time'],
    example: 'flight tracker SU123'
  },
  {
    id: 'travel-itinerary',
    name: 'Travel Itinerary Agent',
    type: 'Утилитарный агент',
    icon: '🗺️',
    description: 'Планирование маршрутов путешествий: достопримечательности, рестораны, транспорт, оптимизация. Триггеры: "маршрут путешествия", "travel itinerary"',
    enabled: props.toolsConfig.travelItineraryEnabled !== false,
    capabilities: ['Достопримечательности', 'Рестораны', 'Транспорт', 'Оптимизация', 'Maps'],
    example: 'travel itinerary Париж 5 дней'
  },
  {
    id: 'podcast-generator',
    name: 'Podcast Generator Agent',
    type: 'Утилитарный агент',
    icon: '🎙️',
    description: 'Генерация подкастов: скрипты, voice synthesis, музыка, монтаж, RSS feed. Триггеры: "подкаст", "podcast generate"',
    enabled: props.toolsConfig.podcastGeneratorEnabled !== false,
    capabilities: ['Скрипты', 'Voice Synthesis', 'Музыка', 'Монтаж', 'RSS'],
    example: 'podcast generate эпизод про AI'
  },
  {
    id: 'music-recommendation',
    name: 'Music Recommendation Agent',
    type: 'Утилитарный агент',
    icon: '🎵',
    description: 'Рекомендации музыки: персонализация, настроение, жанры, артисты, Spotify API. Триггеры: "музыка", "music recommendation"',
    enabled: props.toolsConfig.musicRecommendationEnabled !== false,
    capabilities: ['Персонализация', 'Настроение', 'Жанры', 'Spotify API', 'Плейлисты'],
    example: 'music recommendation для работы'
  },
  {
    id: 'movie-database',
    name: 'Movie Database Agent',
    type: 'Утилитарный агент',
    icon: '🎬',
    description: 'База данных фильмов: информация, рейтинги, рекомендации, TMDB API, отзывы. Триггеры: "фильм", "movie database"',
    enabled: props.toolsConfig.movieDatabaseEnabled !== false,
    capabilities: ['TMDB API', 'Рейтинги', 'Рекомендации', 'Отзывы', 'Трейлеры'],
    example: 'movie database найти Interstellar'
  },
  {
    id: 'crop-monitor',
    name: 'Crop Monitor Agent',
    type: 'Утилитарный агент',
    icon: '🌾',
    description: 'Мониторинг посевов: спутниковые снимки, NDVI, болезни, прогноз урожая. Триггеры: "мониторинг посевов", "crop monitor"',
    enabled: props.toolsConfig.cropMonitorEnabled !== false,
    capabilities: ['Спутниковые снимки', 'NDVI', 'Болезни', 'Прогноз урожая'],
    example: 'crop monitor поле пшеницы'
  },
  {
    id: 'weather-analytics',
    name: 'Weather Analytics Agent',
    type: 'Утилитарный агент',
    icon: '🌤️',
    description: 'Метеорологическая аналитика для сельского хозяйства: прогнозы, осадки, температура, заморозки. Триггеры: "погода", "weather analytics"',
    enabled: props.toolsConfig.weatherAnalyticsEnabled !== false,
    capabilities: ['Прогнозы', 'Осадки', 'Температура', 'Заморозки', 'API'],
    example: 'weather analytics прогноз на неделю'
  },
  {
    id: 'farm-management',
    name: 'Farm Management Agent',
    type: 'Утилитарный агент',
    icon: '🚜',
    description: 'Управление фермой: поля, урожай, техника, персонал, финансы, планирование. Триггеры: "ферма", "farm management"',
    enabled: props.toolsConfig.farmManagementEnabled !== false,
    capabilities: ['Поля', 'Урожай', 'Техника', 'Персонал', 'Финансы'],
    example: 'farm management планирование сезона'
  },
  {
    id: 'translation-agent',
    name: 'Translation Agent',
    type: 'Утилитарный агент',
    icon: '🌐',
    description: 'Переводчик текстов: 100+ языков, контекст, терминология, DeepL API. Триггеры: "перевод", "translate"',
    enabled: props.toolsConfig.translationAgentEnabled !== false,
    capabilities: ['100+ языков', 'DeepL API', 'Контекст', 'Терминология'],
    example: 'перевод на английский'
  },
  {
    id: 'voice-synthesis',
    name: 'Voice Synthesis Agent',
    type: 'Утилитарный агент',
    icon: '🗣️',
    description: 'Синтез речи: text-to-speech, голоса, эмоции, SSML, мультиязычность. Триггеры: "озвучить", "voice synthesis"',
    enabled: props.toolsConfig.voiceSynthesisEnabled !== false,
    capabilities: ['Text-to-Speech', 'Голоса', 'Эмоции', 'SSML', 'Multi-lang'],
    example: 'озвучить текст'
  },
  {
    id: 'transcription-agent',
    name: 'Transcription Agent',
    type: 'Утилитарный агент',
    icon: '🎤',
    description: 'Транскрибация аудио: speech-to-text, субтитры, временные метки, мультиязычность. Триггеры: "транскрибация", "transcription"',
    enabled: props.toolsConfig.transcriptionAgentEnabled !== false,
    capabilities: ['Speech-to-Text', 'Субтитры', 'Временные метки', 'Multi-lang'],
    example: 'transcription аудио файл'
  },
  {
    id: 'ocr-agent',
    name: 'OCR Agent',
    type: 'Утилитарный агент',
    icon: '📷',
    description: 'Распознавание текста с изображений: OCR, multilingual, таблицы, рукописный текст. Триггеры: "ocr", "распознать текст"',
    enabled: props.toolsConfig.ocrAgentEnabled !== false,
    capabilities: ['OCR', 'Multilingual', 'Таблицы', 'Рукописный текст', 'PDF'],
    example: 'ocr распознать скан документа'
  },
  {
    id: 'qr-generator',
    name: 'QR Code Generator Agent',
    type: 'Утилитарный агент',
    icon: '📱',
    description: 'Генератор QR-кодов: URL, текст, vCard, WiFi, кастомизация дизайна. Триггеры: "qr код", "qr generate"',
    enabled: props.toolsConfig.qrGeneratorEnabled !== false,
    capabilities: ['URL', 'Текст', 'vCard', 'WiFi', 'Дизайн', 'Логотип'],
    example: 'qr generate для сайта'
  },
  {
    id: 'barcode-scanner',
    name: 'Barcode Scanner Agent',
    type: 'Утилитарный агент',
    icon: '📊',
    description: 'Сканер штрихкодов: распознавание EAN, Code128, QR, поиск товаров по базе. Триггеры: "штрихкод", "barcode scan"',
    enabled: props.toolsConfig.barcodeScannerEnabled !== false,
    capabilities: ['EAN', 'Code128', 'QR', 'Поиск товаров', 'Мобильный'],
    example: 'barcode scan товар'
  }
])

// Count enabled agents
const enabledCount = computed(() =>
  availableAgents.value.filter(a => a.enabled).length
)

const totalCount = computed(() => availableAgents.value.length)
</script>

<style scoped>
.available-agents-panel {
  padding: 1rem;
  background: var(--p-surface-card);
  border-radius: 8px;
}

.panel-header {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  font-weight: 600;
  font-size: 1.125rem;
  color: var(--text-color);
  margin-bottom: 1rem;
  padding-bottom: 0.75rem;
  border-bottom: 2px solid var(--surface-border);
}

.help-section {
  background: var(--surface-card);
  border: 1px solid var(--surface-border);
  border-radius: 8px;
  padding: 1rem;
  margin-bottom: 1.5rem;
}

.help-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 600;
  font-size: 1rem;
  color: var(--primary-color);
  margin-bottom: 0.75rem;
  transition: all 0.2s ease;
}

.help-header:hover {
  color: var(--primary-700);
}

.help-header i {
  font-size: 1.25rem;
}

.help-list {
  margin: 0;
  padding-left: 1.5rem;
  list-style-type: disc;
}

.help-list li {
  font-size: 0.875rem;
  color: var(--text-color);
  line-height: 1.6;
  margin-bottom: 0.5rem;
}

.help-list li:last-child {
  margin-bottom: 0;
}

.help-list strong {
  color: var(--text-color);
  font-weight: 600;
}

.agents-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1rem;
  max-height: 70vh;
  overflow-y: auto;
}

.agent-card {
  background: var(--surface-card);
  border: 1px solid var(--surface-border);
  border-radius: 8px;
  padding: 1rem 1rem 0.5rem 1rem;
  transition: all 0.2s;
}

.agent-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  transform: translateY(-2px);
}

.agent-card.agent-disabled {
  opacity: 0.6;
  background: var(--surface-100);
}

.agent-header {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
}

.agent-icon {
  font-size: 2rem;
  line-height: 1;
}

.agent-info {
  flex: 1;
}

.agent-name {
  font-weight: 600;
  font-size: 1rem;
  color: var(--text-color);
  margin-bottom: 0.25rem;
}

.agent-type {
  font-size: 0.75rem;
  color: var(--text-color-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.agent-toggle {
  display: flex;
  align-items: center;
}

.status-icon {
  font-size: 1.25rem;
}

.status-icon.enabled {
  color: #22c55e;
}

.status-icon.disabled {
  color: #ef4444;
}

.agent-description {
  font-size: 0.875rem;
  color: var(--text-color-secondary);
  line-height: 1.5;
  margin-bottom: 0.75rem;
}

.agent-capabilities {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
  margin-bottom: 0.75rem;
}

.capability-tag {
  background: var(--primary-color);
  color: var(--primary-contrast-color);
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 500;
}

.agent-example {
  background: var(--p-surface-card);
  padding: 0.625rem;
  border-radius: 4px;
  margin-top: 0.75rem;
  border-left: 3px solid var(--primary-color);
}

.example-label {
  font-size: 0.75rem;
  color: var(--text-color-secondary);
  margin-bottom: 0.375rem;
  font-weight: 600;
}

.agent-example code {
  font-family: 'Courier New', monospace;
  font-size: 0.875rem;
  color: var(--text-color);
  background: transparent;
  padding: 0;
}

.expand-button {
  width: 100%;
  justify-content: center;
}

.expanded-content {
  margin-bottom: 1rem;
}
</style>
