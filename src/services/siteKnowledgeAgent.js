/**
 * Site Knowledge Agent
 *
 * Агент для получения информации о структуре сайта, маршрутах и агентах
 * Позволяет AI чату отвечать на вопросы о доступных функциях и разделах платформы
 */

import { routeDescriptions } from '@/config/routeDescriptions'
import router from '@/router'

/**
 * Получить информацию о всех маршрутах
 * @returns {Array<Object>} Массив маршрутов с описаниями
 */
export function getAllRoutes() {
  const routes = router.getRoutes()

  return routes
    .filter(route => route.path && !route.path.includes(':')) // Exclude dynamic routes
    .map(route => {
      const description = routeDescriptions[route.path] || {}
      return {
        path: route.path,
        name: route.name,
        description: description.description || 'Описание отсутствует',
        category: description.category || 'other',
        tags: description.tags || []
      }
    })
}

/**
 * Поиск маршрутов по запросу
 * @param {string} query - Поисковый запрос
 * @returns {Array<Object>} Найденные маршруты
 */
export function searchRoutes(query) {
  if (!query || query.trim().length === 0) {
    return []
  }

  const searchTerm = query.toLowerCase().trim()
  const allRoutes = getAllRoutes()

  return allRoutes.filter(route => {
    // Поиск в пути
    if (route.path.toLowerCase().includes(searchTerm)) {
      return true
    }

    // Поиск в описании
    if (route.description.toLowerCase().includes(searchTerm)) {
      return true
    }

    // Поиск в тегах
    if (route.tags.some(tag => tag.toLowerCase().includes(searchTerm))) {
      return true
    }

    // Поиск в категории
    if (route.category.toLowerCase().includes(searchTerm)) {
      return true
    }

    return false
  })
}

/**
 * Получить маршруты по категории
 * @param {string} category - Категория маршрутов
 * @returns {Array<Object>} Маршруты категории
 */
export function getRoutesByCategory(category) {
  const allRoutes = getAllRoutes()
  return allRoutes.filter(route => route.category === category)
}

/**
 * Получить все доступные категории
 * @returns {Array<string>} Список категорий
 */
export function getCategories() {
  const allRoutes = getAllRoutes()
  const categories = new Set(allRoutes.map(route => route.category))
  return Array.from(categories).sort()
}

/**
 * Получить агентов из конфигурации Spaces
 * @returns {Array<Object>} Список агентов
 */
export function getAllAgents() {
  // Импортируем динамически, чтобы избежать циклических зависимостей
  const agents = [
    {
      id: 'chat',
      name: 'AI Чат',
      description: 'Чат с ИИ-ассистентом с поддержкой множества моделей',
      category: 'ai',
      path: '/chat',
      tags: ['Chat', 'AI', 'Assistant']
    },
    {
      id: 'workspace-ai',
      name: 'Workspace AI Agent',
      description: 'AI агент для работы с Git репозиториями и кодом',
      category: 'ai',
      path: '/workspaces',
      tags: ['Workspace', 'Git', 'Code', 'AI']
    },
    {
      id: 'egrul-parser',
      name: 'ЕГРЮЛ Парсер',
      description: 'Поиск информации о компаниях по ИНН',
      category: 'business',
      path: '/egrul',
      tags: ['ЕГРЮЛ', 'ИНН', 'Компании']
    },
    {
      id: 'purchase-journey-testing',
      name: 'Journey Testing Agent',
      description: 'Автоматическое тестирование пути покупки',
      category: 'automation',
      path: '/purchase-journey-testing',
      tags: ['Testing', 'Automation', 'QA']
    }
  ]

  return agents
}

/**
 * Поиск агентов по запросу
 * @param {string} query - Поисковый запрос
 * @returns {Array<Object>} Найденные агенты
 */
export function searchAgents(query) {
  if (!query || query.trim().length === 0) {
    return []
  }

  const searchTerm = query.toLowerCase().trim()
  const allAgents = getAllAgents()

  return allAgents.filter(agent => {
    return agent.name.toLowerCase().includes(searchTerm) ||
           agent.description.toLowerCase().includes(searchTerm) ||
           agent.tags.some(tag => tag.toLowerCase().includes(searchTerm)) ||
           agent.category.toLowerCase().includes(searchTerm)
  })
}

/**
 * Получить информацию о конкретном маршруте
 * @param {string} path - Путь маршрута
 * @returns {Object|null} Информация о маршруте
 */
export function getRouteInfo(path) {
  const allRoutes = getAllRoutes()
  return allRoutes.find(route => route.path === path) || null
}

/**
 * Создать структурированный ответ для AI о сайте
 * @param {string} userQuery - Запрос пользователя
 * @returns {Object} Структурированная информация для AI
 */
export function getSiteKnowledge(userQuery = '') {
  const knowledge = {
    summary: 'DronDoc - платформа с AI агентами для бизнеса и автоматизации',
    totalRoutes: getAllRoutes().length,
    totalAgents: getAllAgents().length,
    categories: getCategories(),
    routes: [],
    agents: []
  }

  if (userQuery) {
    knowledge.routes = searchRoutes(userQuery)
    knowledge.agents = searchAgents(userQuery)
  } else {
    knowledge.routes = getAllRoutes().slice(0, 10) // Первые 10 маршрутов
    knowledge.agents = getAllAgents()
  }

  return knowledge
}

/**
 * Форматировать знания для отображения пользователю
 * @param {Object} knowledge - Объект знаний
 * @returns {string} Отформатированный текст
 */
export function formatKnowledgeForDisplay(knowledge) {
  let text = `# ${knowledge.summary}\n\n`
  text += `📊 **Статистика:**\n`
  text += `- Всего маршрутов: ${knowledge.totalRoutes}\n`
  text += `- Всего агентов: ${knowledge.totalAgents}\n`
  text += `- Категорий: ${knowledge.categories.length}\n\n`

  if (knowledge.agents.length > 0) {
    text += `## 🤖 Агенты:\n\n`
    knowledge.agents.forEach(agent => {
      text += `### ${agent.name}\n`
      text += `- **Описание:** ${agent.description}\n`
      text += `- **Категория:** ${agent.category}\n`
      text += `- **Путь:** [${agent.path}](${agent.path})\n`
      text += `- **Теги:** ${agent.tags.join(', ')}\n\n`
    })
  }

  if (knowledge.routes.length > 0) {
    text += `## 🗺️ Маршруты:\n\n`
    const routesByCategory = {}

    knowledge.routes.forEach(route => {
      if (!routesByCategory[route.category]) {
        routesByCategory[route.category] = []
      }
      routesByCategory[route.category].push(route)
    })

    Object.keys(routesByCategory).sort().forEach(category => {
      text += `### Категория: ${category}\n\n`
      routesByCategory[category].forEach(route => {
        text += `- **[${route.path}](${route.path})** - ${route.description}\n`
      })
      text += '\n'
    })
  }

  return text
}

export default {
  getAllRoutes,
  searchRoutes,
  getRoutesByCategory,
  getCategories,
  getAllAgents,
  searchAgents,
  getRouteInfo,
  getSiteKnowledge,
  formatKnowledgeForDisplay
}
