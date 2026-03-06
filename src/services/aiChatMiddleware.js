/**
 * AI Chat Middleware
 *
 * Промежуточный слой для обогащения AI запросов информацией о сайте
 * и автоматической генерации навигационных предложений
 */

import {
  getSiteKnowledge,
  formatKnowledgeForDisplay,
  searchRoutes,
  searchAgents
} from './siteKnowledgeAgent'

import {
  getNavigationSuggestions,
  createNavigationButtons,
  formatSuggestionsForAI,
  analyzeContextAndSuggest
} from './navigationAgent'

/**
 * Проверить, является ли запрос командой для агентов
 * @param {string} message - Сообщение пользователя
 * @returns {Object|null} Информация о команде или null
 */
export function detectAgentCommand(message) {
  const lowerMessage = message.toLowerCase().trim()

  // Команды для получения информации о сайте
  if (lowerMessage.match(/^\/info|^\/site|^\/help|что ты умеешь|какие функции|что можно делать/i)) {
    return {
      type: 'site_info',
      query: message.replace(/^\/\w+\s*/, '').trim()
    }
  }

  // Команды для навигации
  if (lowerMessage.match(/^\/navigate|^\/go|куда.*пере[йи]ти|покажи.*раздел|где находится/i)) {
    return {
      type: 'navigation',
      query: message.replace(/^\/\w+\s*/, '').trim()
    }
  }

  // Команды для поиска
  if (lowerMessage.match(/^\/search|^\/find|найди|поиск/i)) {
    return {
      type: 'search',
      query: message.replace(/^\/\w+\s*/, '').trim()
    }
  }

  return null
}

/**
 * Обработать команду агента
 * @param {Object} command - Информация о команде
 * @returns {Object} Результат обработки команды
 */
export function handleAgentCommand(command) {
  switch (command.type) {
    case 'site_info':
      return handleSiteInfoCommand(command.query)
    case 'navigation':
      return handleNavigationCommand(command.query)
    case 'search':
      return handleSearchCommand(command.query)
    default:
      return null
  }
}

/**
 * Обработать команду получения информации о сайте
 * @param {string} query - Запрос пользователя
 * @returns {Object} Результат
 */
function handleSiteInfoCommand(query) {
  const knowledge = getSiteKnowledge(query)
  const formattedText = formatKnowledgeForDisplay(knowledge)

  return {
    type: 'site_info',
    text: formattedText,
    knowledge,
    navigationSuggestions: createNavigationButtons(
      knowledge.routes.slice(0, 3).concat(knowledge.agents.slice(0, 2))
    )
  }
}

/**
 * Обработать команду навигации
 * @param {string} query - Запрос пользователя
 * @returns {Object} Результат
 */
function handleNavigationCommand(query) {
  const suggestions = getNavigationSuggestions(query, 5)
  const formattedText = formatSuggestionsForAI(suggestions)
  const buttons = createNavigationButtons(suggestions)

  return {
    type: 'navigation',
    text: formattedText,
    suggestions,
    navigationSuggestions: buttons
  }
}

/**
 * Обработать команду поиска
 * @param {string} query - Запрос пользователя
 * @returns {Object} Результат
 */
function handleSearchCommand(query) {
  const routes = searchRoutes(query)
  const agents = searchAgents(query)
  const allResults = [...routes, ...agents]

  let text = `# 🔍 Результаты поиска: "${query}"\n\n`
  text += `Найдено: ${allResults.length} результат(ов)\n\n`

  if (routes.length > 0) {
    text += `## Маршруты:\n\n`
    routes.forEach(route => {
      text += `- **[${route.path}](${route.path})** - ${route.description}\n`
    })
    text += '\n'
  }

  if (agents.length > 0) {
    text += `## Агенты:\n\n`
    agents.forEach(agent => {
      text += `- **[${agent.name}](${agent.path})** - ${agent.description}\n`
    })
  }

  if (allResults.length === 0) {
    text += `К сожалению, ничего не найдено по запросу "${query}"`
  }

  return {
    type: 'search',
    text,
    results: allResults,
    navigationSuggestions: createNavigationButtons(allResults.slice(0, 5))
  }
}

/**
 * Обогатить промпт пользователя контекстом о сайте
 * @param {string} userMessage - Исходное сообщение
 * @param {Array} conversationHistory - История разговора
 * @returns {Object} Обогащенный промпт и мета-данные
 */
export function enrichPromptWithSiteContext(userMessage, conversationHistory = []) {
  const lowerMessage = userMessage.toLowerCase()

  // Определяем, нужно ли добавить контекст о сайте
  const needsSiteContext =
    lowerMessage.includes('что ты умеешь') ||
    lowerMessage.includes('что можно делать') ||
    lowerMessage.includes('какие функции') ||
    lowerMessage.includes('какие агенты') ||
    lowerMessage.includes('помощь') ||
    lowerMessage.includes('help') ||
    lowerMessage.includes('куда') ||
    lowerMessage.includes('где находится') ||
    lowerMessage.includes('как открыть') ||
    lowerMessage.includes('покажи')

  if (!needsSiteContext) {
    return {
      enriched: false,
      originalMessage: userMessage,
      siteContext: null
    }
  }

  // Получаем знания о сайте
  const knowledge = getSiteKnowledge(userMessage)

  // Создаем системный контекст для AI
  const siteContext = `
# Контекст о платформе DronDoc

Ты - AI ассистент платформы DronDoc. У тебя есть доступ к информации о структуре сайта.

## Доступные разделы и агенты:

### Агенты (${knowledge.agents.length}):
${knowledge.agents.map(a => `- ${a.name} (${a.path}): ${a.description}`).join('\n')}

### Популярные маршруты:
${knowledge.routes.slice(0, 10).map(r => `- ${r.path} (${r.category}): ${r.description}`).join('\n')}

### Категории:
${knowledge.categories.join(', ')}

Когда пользователь спрашивает о возможностях платформы или куда можно перейти,
используй эту информацию для формирования ответа. Можешь предлагать конкретные разделы
и агенты, которые подходят для решения задачи пользователя.

ВАЖНО: В конце ответа добавь список из 2-3 наиболее подходящих разделов,
куда пользователь может перейти для решения своей задачи.
`

  return {
    enriched: true,
    originalMessage: userMessage,
    siteContext,
    knowledge,
    systemPromptAddition: siteContext
  }
}

/**
 * Проанализировать ответ AI и добавить навигационные предложения
 * @param {string} aiResponse - Ответ AI
 * @param {string} userMessage - Исходное сообщение пользователя
 * @returns {Object} Результат с навигационными предложениями
 */
export function analyzeResponseAndSuggestNavigation(aiResponse, userMessage) {
  // Ищем упоминания маршрутов и агентов в ответе AI
  const suggestions = getNavigationSuggestions(userMessage + ' ' + aiResponse, 3)

  if (suggestions.length === 0) {
    return {
      hasNavigationSuggestions: false,
      navigationSuggestions: []
    }
  }

  return {
    hasNavigationSuggestions: true,
    navigationSuggestions: createNavigationButtons(suggestions)
  }
}

/**
 * Обработать сообщение через middleware
 * @param {string} userMessage - Сообщение пользователя
 * @param {Array} conversationHistory - История разговора
 * @returns {Object} Результат обработки
 */
export function processMessage(userMessage, conversationHistory = []) {
  // 1. Проверяем, является ли сообщение командой
  const command = detectAgentCommand(userMessage)

  if (command) {
    const commandResult = handleAgentCommand(command)
    return {
      isCommand: true,
      commandType: command.type,
      result: commandResult,
      skipAI: true // Не отправляем в AI, отвечаем напрямую
    }
  }

  // 2. Обогащаем промпт контекстом о сайте
  const enriched = enrichPromptWithSiteContext(userMessage, conversationHistory)

  // 3. Анализируем контекст разговора для предложения следующего шага
  const contextSuggestion = analyzeContextAndSuggest(conversationHistory)

  return {
    isCommand: false,
    enriched: enriched.enriched,
    originalMessage: userMessage,
    siteContext: enriched.siteContext,
    systemPromptAddition: enriched.systemPromptAddition,
    knowledge: enriched.knowledge,
    contextSuggestion,
    skipAI: false
  }
}

export default {
  detectAgentCommand,
  handleAgentCommand,
  enrichPromptWithSiteContext,
  analyzeResponseAndSuggestNavigation,
  processMessage
}
