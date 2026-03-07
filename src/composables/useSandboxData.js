import { computed } from 'vue'
import { useSandboxStore } from '@/stores/sandboxStore'
import {
  demoCompanies,
  demoDeals,
  demoPortfolio,
  demoCommitteeEvents,
  demoPracticeScenarios,
  getDemoDataFor
} from '@/data/demoData'

/**
 * Composable for accessing data based on sandbox mode
 * Returns demo data in sandbox mode, real data in production mode
 */
export function useSandboxData() {
  const sandboxStore = useSandboxStore()

  /**
   * Get companies data
   * @param {Function} realDataFetcher - Function to fetch real data
   * @returns {Array} Companies array
   */
  function getCompanies(realDataFetcher = null) {
    if (sandboxStore.isSandboxMode) {
      return demoCompanies
    }
    return realDataFetcher ? realDataFetcher() : []
  }

  /**
   * Get deals data
   * @param {Function} realDataFetcher - Function to fetch real data
   * @returns {Array} Deals array
   */
  function getDeals(realDataFetcher = null) {
    if (sandboxStore.isSandboxMode) {
      return demoDeals
    }
    return realDataFetcher ? realDataFetcher() : []
  }

  /**
   * Get portfolio data
   * @param {Function} realDataFetcher - Function to fetch real data
   * @returns {Array} Portfolio array
   */
  function getPortfolio(realDataFetcher = null) {
    if (sandboxStore.isSandboxMode) {
      return demoPortfolio
    }
    return realDataFetcher ? realDataFetcher() : []
  }

  /**
   * Get committee events data
   * @param {Function} realDataFetcher - Function to fetch real data
   * @returns {Array} Committee events array
   */
  function getCommitteeEvents(realDataFetcher = null) {
    if (sandboxStore.isSandboxMode) {
      return demoCommitteeEvents
    }
    return realDataFetcher ? realDataFetcher() : []
  }

  /**
   * Get practice scenarios (only in sandbox mode)
   * @returns {Array} Scenarios array
   */
  function getPracticeScenarios() {
    return demoPracticeScenarios
  }

  /**
   * Check if API call should be intercepted in sandbox mode
   * @param {String} endpoint - API endpoint
   * @returns {Boolean} Should intercept
   */
  function shouldInterceptAPI(endpoint) {
    if (!sandboxStore.isSandboxMode) {
      return false
    }

    // List of endpoints to intercept in sandbox mode
    const interceptPatterns = [
      '/api/ai-tokens/chat',
      '/api/mcp/integram',
      'ai2o.ru',
      '/fst/',
      '/api/deals',
      '/api/portfolio',
      '/api/committee'
    ]

    return interceptPatterns.some(pattern => endpoint.includes(pattern))
  }

  /**
   * Get mock API response for sandbox mode
   * @param {String} endpoint - API endpoint
   * @param {Object} requestData - Request payload
   * @returns {Object} Mock response
   */
  function getMockAPIResponse(endpoint, requestData = {}) {
    if (!sandboxStore.isSandboxMode) {
      return null
    }

    // AI chat responses
    if (endpoint.includes('/api/ai-tokens/chat')) {
      return getMockAIResponse(requestData)
    }

    // MCP Integram responses
    if (endpoint.includes('/api/mcp/integram')) {
      return getMockIntegram Response(requestData)
    }

    return { success: true, message: 'Sandbox mode - no real data modified' }
  }

  /**
   * Generate mock AI response
   * @param {Object} requestData - Request with prompt and context
   * @returns {Object} Mock AI response
   */
  function getMockAIResponse(requestData) {
    const { prompt, application } = requestData

    // Committee agent responses
    if (application === 'FstCommittee' || prompt.includes('инвесткомитет')) {
      return {
        response: generateCommitteeAnalysis(prompt),
        tokensUsed: 1500,
        model: 'demo-mode'
      }
    }

    // Deal analysis
    if (application === 'FstDeal' || prompt.includes('сделка')) {
      return {
        response: generateDealAnalysis(prompt),
        tokensUsed: 1200,
        model: 'demo-mode'
      }
    }

    // Portfolio analysis
    if (application === 'FstPortfolio' || prompt.includes('портфель')) {
      return {
        response: generatePortfolioAnalysis(prompt),
        tokensUsed: 1800,
        model: 'demo-mode'
      }
    }

    // Generic response
    return {
      response: `[ДЕМО-РЕЖИМ] Спасибо за ваш запрос. В режиме обучения AI-агенты работают с демонстрационными данными.

Ваш запрос: "${prompt.substring(0, 100)}..."

Для полноценной работы с реальными данными переключитесь в боевой режим.`,
      tokensUsed: 500,
      model: 'demo-mode'
    }
  }

  /**
   * Generate committee analysis for demo
   */
  function generateCommitteeAnalysis(prompt) {
    return `## AI-анализ инвесткомитета (ДЕМО)

### Технологический анализ ⚙️
**Оценка: 8.5/10** | Рекомендация: ✅ Одобрить

Сильные стороны:
- Современный ML/CV стек (PyTorch, YOLO v8)
- Запатентованная технология автопилота
- Опыт команды в aerospace

Риски:
- Зависимость от сторонних компонентов
- Конкуренция с DJI

### Рыночный анализ 📊
**Оценка: 7.8/10** | Рекомендация: ✅ Одобрить

TAM $45 млрд к 2028 (CAGR 23%)
Сегмент AgriTech растёт быстрее рынка (+35% YoY)

Concerns: высокая конкуренция в logistics-сегменте

### Финансовый анализ 💰
**Оценка: 7.2/10** | Рекомендация: ⚠️ Условное одобрение

- Unit-экономика: LTV/CAC = 4.2 ✅
- Burn rate: $850K/мес ⚠️
- Runway: 16 месяцев
- Метрики роста в пределах нормы для стадии

Рекомендация: траншевание с привязкой к revenue milestones

---
*Демо-режим: анализ на основе типовых паттернов*`
  }

  /**
   * Generate deal analysis for demo
   */
  function generateDealAnalysis(prompt) {
    return `## Анализ сделки (ДЕМО)

### Структура инвестиции
- Раунд: Series A
- Сумма: 20М ₽
- Pre-money: 100М ₽
- Доля: 16.7%

### Рекомендуемое траншевание
**Транш 1:** 12М ₽ (60%) — при закрытии
**Транш 2:** 8М ₽ (40%) — при достижении:
  - Выручка 30М ₽/год
  - 3 крупных контракта
  - Команда 25+ человек

### KPI для мониторинга
1. MRR (цель: 2.5М ₽ к Q4 2026)
2. Количество клиентов (цель: 15)
3. NPS (цель: >50)

### Оценка рисков
- Технологические: НИЗКИЙ ✅
- Рыночные: СРЕДНИЙ ⚠️
- Команда: НИЗКИЙ ✅
- Финансовые: СРЕДНИЙ ⚠️

---
*Демо-режим: типовая структура сделки*`
  }

  /**
   * Generate portfolio analysis for demo
   */
  function generatePortfolioAnalysis(prompt) {
    return `## Анализ портфеля (ДЕМО)

### Общие метрики
- Количество компаний: 8
- Активных инвестиций: 6
- Exits: 2
- Средний IRR: 38%
- Средний MOIC: 1.8x

### Распределение по статусу
🟢 Зелёный (здоровые): 4 компании (67%)
🟡 Жёлтый (внимание): 1 компания (17%)
🔴 Красный (проблемные): 1 компания (16%)

### Ключевые события
**Позитивные:**
- AeroVision: перевыполнение плана выручки (+10%)
- DroneLogistics: новый раунд на оценке +40%

**Требуют внимания:**
- InspectionAI: задержка milestone на 2 месяца
- EcoMonitor: churn rate вырос до 15%

### Рекомендации
1. Усилить поддержку InspectionAI (операционный консалтинг)
2. Подготовить follow-on для DroneLogistics
3. Запланировать exit strategy для AeroVision (целевой MOIC 2.5x)

---
*Демо-режим: анализ на типовых данных*`
  }

  /**
   * Generate mock Integram response
   */
  function getMockIntegramResponse(requestData) {
    return {
      success: true,
      message: 'Sandbox mode - данные не сохранены в Integram',
      data: {
        id: `demo-${Date.now()}`,
        created: true,
        sandboxMode: true
      }
    }
  }

  // Computed properties
  const isSandboxMode = computed(() => sandboxStore.isSandboxMode)
  const isProductionMode = computed(() => !sandboxStore.isSandboxMode)
  const activeScenario = computed(() => sandboxStore.activeScenario)

  return {
    // State
    isSandboxMode,
    isProductionMode,
    activeScenario,

    // Data getters
    getCompanies,
    getDeals,
    getPortfolio,
    getCommitteeEvents,
    getPracticeScenarios,

    // API interception
    shouldInterceptAPI,
    getMockAPIResponse,

    // Utility
    getDemoDataFor
  }
}
