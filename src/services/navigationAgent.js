/**
 * Navigation Agent
 *
 * Агент для интеллектуальной навигации по сайту
 * Анализирует запросы пользователя и предлагает подходящие разделы для перехода
 */

import { searchRoutes, searchAgents, getRoutesByCategory } from './siteKnowledgeAgent'
import router from '@/router'

/**
 * Ключевые слова для определения намерения пользователя
 */
const intentKeywords = {
  chat: ['чат', 'общение', 'поговорить', 'спросить', 'chat', 'talk', 'ai', 'ии'],
  workspace: ['проект', 'код', 'workspace', 'git', 'репозиторий', 'разработка', 'code'],
  business: ['компания', 'бизнес', 'егрюл', 'инн', 'организация', 'business'],
  automation: ['автоматизация', 'тест', 'testing', 'automation', 'агент'],
  documentation: ['документация', 'помощь', 'справка', 'docs', 'help', 'guide'],
  analytics: ['аналитика', 'статистика', 'отчет', 'analytics', 'stats'],
  settings: ['настройки', 'settings', 'конфигурация', 'config'],
  ai: ['искусственный интеллект', 'нейросеть', 'модель', 'ai', 'ml', 'машинное обучение']
}

/**
 * Определить намерение пользователя на основе запроса
 * @param {string} query - Запрос пользователя
 * @returns {Array<string>} Массив намерений
 */
function detectIntent(query) {
  const lowerQuery = query.toLowerCase()
  const detectedIntents = []

  Object.keys(intentKeywords).forEach(intent => {
    const keywords = intentKeywords[intent]
    if (keywords.some(keyword => lowerQuery.includes(keyword))) {
      detectedIntents.push(intent)
    }
  })

  return detectedIntents
}

/**
 * Получить рекомендации маршрутов на основе запроса
 * @param {string} query - Запрос пользователя
 * @param {number} maxResults - Максимальное количество результатов
 * @returns {Array<Object>} Массив рекомендованных маршрутов
 */
export function getNavigationSuggestions(query, maxResults = 5) {
  if (!query || query.trim().length === 0) {
    return []
  }

  // 1. Поиск по прямому совпадению
  const directMatches = searchRoutes(query)

  // 2. Определение намерения и поиск по категориям
  const intents = detectIntent(query)
  const intentMatches = []

  intents.forEach(intent => {
    const categoryRoutes = getRoutesByCategory(intent)
    intentMatches.push(...categoryRoutes)
  })

  // 3. Поиск агентов
  const agentMatches = searchAgents(query)

  // 4. Объединение и ранжирование результатов
  const allMatches = [
    ...directMatches.map(r => ({ ...r, score: 10, source: 'direct' })),
    ...intentMatches.map(r => ({ ...r, score: 5, source: 'intent' })),
    ...agentMatches.map(a => ({ ...a, score: 8, source: 'agent' }))
  ]

  // Удаление дубликатов по пути
  const uniqueMatches = []
  const seenPaths = new Set()

  allMatches.forEach(match => {
    if (!seenPaths.has(match.path)) {
      seenPaths.add(match.path)
      uniqueMatches.push(match)
    }
  })

  // Сортировка по score (descending)
  uniqueMatches.sort((a, b) => b.score - a.score)

  return uniqueMatches.slice(0, maxResults)
}

/**
 * Создать кнопки навигации для AI чата
 * @param {Array<Object>} suggestions - Рекомендации навигации
 * @returns {Array<Object>} Массив объектов кнопок
 */
export function createNavigationButtons(suggestions) {
  return suggestions.map(suggestion => ({
    label: suggestion.name || suggestion.path,
    path: suggestion.path,
    description: suggestion.description,
    icon: getIconForCategory(suggestion.category),
    severity: getSeverityForCategory(suggestion.category)
  }))
}

/**
 * Получить иконку для категории
 * @param {string} category - Категория
 * @returns {string} Класс иконки PrimeIcons
 */
function getIconForCategory(category) {
  const iconMap = {
    ai: 'pi-sparkles',
    chat: 'pi-comments',
    workspace: 'pi-folder',
    business: 'pi-briefcase',
    automation: 'pi-cog',
    documentation: 'pi-book',
    analytics: 'pi-chart-bar',
    settings: 'pi-cog',
    tools: 'pi-wrench',
    public: 'pi-home',
    development: 'pi-code'
  }

  return iconMap[category] || 'pi-circle'
}

/**
 * Получить severity для категории (для стилизации кнопок)
 * @param {string} category - Категория
 * @returns {string} Severity level
 */
function getSeverityForCategory(category) {
  const severityMap = {
    ai: 'help',
    chat: 'info',
    workspace: 'secondary',
    business: 'success',
    automation: 'warning',
    documentation: 'info',
    analytics: 'help',
    settings: 'secondary'
  }

  return severityMap[category] || 'secondary'
}

/**
 * Перейти к маршруту
 * @param {string} path - Путь маршрута
 * @returns {Promise<void>}
 */
export async function navigateTo(path) {
  try {
    await router.push(path)
  } catch (error) {
    console.error('Navigation error:', error)
    throw new Error(`Не удалось перейти к ${path}`)
  }
}

/**
 * Форматировать предложения навигации для AI ответа
 * @param {Array<Object>} suggestions - Рекомендации
 * @returns {string} Отформатированный текст
 */
export function formatSuggestionsForAI(suggestions) {
  if (suggestions.length === 0) {
    return 'К сожалению, я не нашел подходящих разделов для вашего запроса.'
  }

  let text = '🧭 **Я могу предложить вам перейти в следующие разделы:**\n\n'

  suggestions.forEach((suggestion, index) => {
    text += `${index + 1}. **[${suggestion.name || suggestion.path}](${suggestion.path})**\n`
    text += `   ${suggestion.description}\n`
    if (suggestion.tags && suggestion.tags.length > 0) {
      text += `   *Теги: ${suggestion.tags.join(', ')}*\n`
    }
    text += '\n'
  })

  return text
}

/**
 * Анализировать контекст разговора и предлагать следующий шаг
 * @param {Array<Object>} conversationHistory - История разговора
 * @returns {Object} Рекомендация следующего действия
 */
export function analyzeContextAndSuggest(conversationHistory) {
  if (!conversationHistory || conversationHistory.length === 0) {
    return {
      suggestion: 'start',
      message: 'Начните с изучения наших агентов или задайте мне вопрос!',
      routes: ['/chat', '/spaces', '/welcome']
    }
  }

  // Анализ последних сообщений
  const recentMessages = conversationHistory.slice(-5)
  const combinedText = recentMessages
    .map(m => m.text || '')
    .join(' ')
    .toLowerCase()

  // Определяем контекст
  if (combinedText.includes('код') || combinedText.includes('проект') || combinedText.includes('git')) {
    return {
      suggestion: 'workspace',
      message: 'Похоже, вам нужен Workspace для работы с кодом!',
      routes: ['/workspaces']
    }
  }

  if (combinedText.includes('компани') || combinedText.includes('инн') || combinedText.includes('егрюл')) {
    return {
      suggestion: 'business',
      message: 'Для работы с данными компаний используйте ЕГРЮЛ парсер!',
      routes: ['/egrul']
    }
  }

  if (combinedText.includes('тест') || combinedText.includes('автоматизаци')) {
    return {
      suggestion: 'automation',
      message: 'Для автоматизации и тестирования есть специальные агенты!',
      routes: ['/purchase-journey-testing']
    }
  }

  // По умолчанию
  return {
    suggestion: 'explore',
    message: 'Хотите изучить другие возможности платформы?',
    routes: ['/spaces', '/docs/getting-started']
  }
}

export default {
  getNavigationSuggestions,
  createNavigationButtons,
  navigateTo,
  formatSuggestionsForAI,
  analyzeContextAndSuggest,
  detectIntent
}
