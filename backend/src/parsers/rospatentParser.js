/**
 * Rospatent (ФИПС) Parser
 *
 * Мониторинг патентной активности портфельных компаний через ФИПС
 * (Федеральный институт промышленной собственности)
 *
 * Источник: https://new.fips.ru/
 * API поиска: https://searchplatform.rospatent.gov.ru/patsearch
 *
 * Парсинг через веб-интерфейс (публичный API ограничен)
 */

import fetch from 'node-fetch'
import { SocksProxyAgent } from 'socks-proxy-agent'

const SOCKS_PROXY = process.env.SOCKS_PROXY || 'socks5://127.0.0.1:9050'
const ROSPATENT_SEARCH_URL = 'https://searchplatform.rospatent.gov.ru/patsearch'
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'

/**
 * Поиск патентов компании по названию или ИНН
 * @param {string} companyName - Название компании
 * @param {string} inn - ИНН компании (опционально)
 * @returns {Promise<Object>} Данные о патентах компании
 */
export async function fetchCompanyPatents(companyName, inn = null) {
  try {
    const agent = new SocksProxyAgent(SOCKS_PROXY)

    // Формируем поисковый запрос
    const searchQuery = buildSearchQuery(companyName, inn)

    // Выполняем поиск
    const searchResults = await searchPatents(searchQuery, agent)

    // Анализируем результаты
    const analysis = analyzePatents(searchResults)

    return {
      companyName,
      inn,
      found: searchResults.length > 0,
      patentsCount: searchResults.length,
      patents: searchResults,
      analysis,
      lastUpdate: new Date().toISOString()
    }

  } catch (error) {
    console.error(`[Rospatent] Error fetching patents for ${companyName}:`, error.message)
    return {
      companyName,
      inn,
      error: error.message,
      found: false,
      patentsCount: 0,
      lastUpdate: new Date().toISOString()
    }
  }
}

/**
 * Формирование поискового запроса для Роспатента
 */
function buildSearchQuery(companyName, inn) {
  // Очищаем название от ООО, АО и т.д.
  let cleanName = companyName
    .replace(/ООО|АО|ПАО|ЗАО|ОАО/gi, '')
    .trim()

  return {
    query: cleanName,
    inn: inn,
    type: 'invention' // Изобретения (можно добавить utility_model, industrial_design)
  }
}

/**
 * Поиск патентов через API Роспатента
 */
async function searchPatents(searchQuery, agent) {
  try {
    // Примечание: Реальный API Роспатента требует более сложной интеграции
    // Здесь упрощённая версия для демонстрации архитектуры

    const url = `${ROSPATENT_SEARCH_URL}/search?q=${encodeURIComponent(searchQuery.query)}`

    const response = await fetch(url, {
      agent,
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'application/json'
      },
      timeout: 15000
    })

    if (!response.ok) {
      console.warn(`[Rospatent] Search failed with status ${response.status}`)
      return []
    }

    // В реальной интеграции здесь парсинг HTML или JSON ответа
    // Для MVP возвращаем моковую структуру
    return parseMockPatentData(searchQuery.query)

  } catch (error) {
    console.error('[Rospatent] Search error:', error.message)
    return []
  }
}

/**
 * Парсинг данных патентов (mock для MVP)
 * В продакшне заменить на реальный парсинг HTML/API Роспатента
 */
function parseMockPatentData(companyName) {
  // Мок-данные для демонстрации структуры
  // В реальности здесь парсинг результатов поиска

  return [
    {
      number: 'RU2026000001',
      title: `Способ управления беспилотным летательным аппаратом (${companyName})`,
      applicationDate: '2025-03-15',
      publicationDate: '2026-01-10',
      status: 'granted',
      inventors: ['Иванов И.И.', 'Петров П.П.'],
      ipc: ['B64C', 'G05D'],  // Международная патентная классификация
      abstract: 'Изобретение относится к способу управления БПЛА...'
    }
  ]
}

/**
 * Анализ патентной активности
 */
function analyzePatents(patents) {
  const now = new Date()
  const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)

  // Патенты за последний год
  const recentPatents = patents.filter(p => {
    const appDate = new Date(p.applicationDate)
    return appDate >= oneYearAgo
  })

  // Статусы патентов
  const statuses = {
    granted: patents.filter(p => p.status === 'granted').length,
    pending: patents.filter(p => p.status === 'pending').length,
    rejected: patents.filter(p => p.status === 'rejected').length
  }

  // Классификация по областям
  const ipcCategories = {}
  patents.forEach(p => {
    if (p.ipc && Array.isArray(p.ipc)) {
      p.ipc.forEach(code => {
        const category = code.substring(0, 3) // Первые 3 символа IPC
        ipcCategories[category] = (ipcCategories[category] || 0) + 1
      })
    }
  })

  // Определение тренда
  let trend = 'stable'
  if (recentPatents.length > patents.length * 0.5) {
    trend = 'growing'
  } else if (recentPatents.length === 0 && patents.length > 0) {
    trend = 'declining'
  }

  return {
    total: patents.length,
    recentYear: recentPatents.length,
    statuses,
    ipcCategories,
    trend,
    insights: generatePatentInsights(patents.length, recentPatents.length, statuses, trend)
  }
}

/**
 * Генерация инсайтов по патентной активности
 */
function generatePatentInsights(total, recentCount, statuses, trend) {
  const insights = []

  // Инсайты по количеству
  if (total === 0) {
    insights.push({
      level: 'warn',
      message: 'Отсутствуют зарегистрированные патенты. Риск для IP-портфеля.'
    })
  } else if (total >= 5) {
    insights.push({
      level: 'ok',
      message: `Сильный IP-портфель: ${total} патентов.`
    })
  } else {
    insights.push({
      level: 'ok',
      message: `${total} патентов в портфеле.`
    })
  }

  // Инсайты по активности
  if (recentCount === 0 && total > 0) {
    insights.push({
      level: 'warn',
      message: 'Патентная активность прекратилась (0 заявок за год).'
    })
  } else if (recentCount >= 2) {
    insights.push({
      level: 'ok',
      message: `Активная патентная деятельность: ${recentCount} заявок за год.`
    })
  }

  // Инсайты по статусам
  if (statuses.granted > 0) {
    insights.push({
      level: 'ok',
      message: `${statuses.granted} патентов выданы (защита IP).`
    })
  }

  if (statuses.pending > 2) {
    insights.push({
      level: 'ok',
      message: `${statuses.pending} заявок на рассмотрении.`
    })
  }

  return insights
}

/**
 * Мониторинг патентов для списка компаний
 * @param {Array<Object>} companies - Массив компаний с полями {id, name, inn, trl}
 * @returns {Promise<Array<Object>>} Массив результатов мониторинга патентов
 */
export async function monitorCompaniesPatents(companies) {
  console.log(`[Rospatent Monitor] Starting patent monitoring for ${companies.length} companies`)

  const results = []

  for (const company of companies) {
    try {
      console.log(`[Rospatent Monitor] Processing ${company.name}`)

      const patentData = await fetchCompanyPatents(company.name, company.inn)

      const result = {
        companyId: company.id,
        companyName: company.name,
        inn: company.inn,
        timestamp: new Date().toISOString(),
        patents: patentData,
        alerts: []
      }

      // Генерируем алерты на основе TRL и количества патентов
      if (company.trl >= 6 && patentData.patentsCount === 0) {
        result.alerts.push({
          level: 'critical',
          type: 'no_patents',
          message: `Критично: TRL ${company.trl}, но 0 патентов. Высокий IP-риск.`
        })
      } else if (company.trl >= 6 && patentData.patentsCount < 3) {
        result.alerts.push({
          level: 'warn',
          type: 'low_patents',
          message: `TRL ${company.trl}, но только ${patentData.patentsCount} патентов. Требуется усиление IP.`
        })
      }

      if (patentData.analysis && patentData.analysis.trend === 'declining') {
        result.alerts.push({
          level: 'warn',
          type: 'patent_decline',
          message: 'Патентная активность снизилась (0 заявок за год).'
        })
      }

      results.push(result)

      // Задержка между запросами
      await sleep(3000)

    } catch (error) {
      console.error(`[Rospatent Monitor] Error processing ${company.name}:`, error.message)
      results.push({
        companyId: company.id,
        companyName: company.name,
        error: error.message,
        timestamp: new Date().toISOString()
      })
    }
  }

  console.log(`[Rospatent Monitor] Completed. Processed ${results.length} companies`)

  return results
}

/**
 * Утилита для задержки
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export default {
  fetchCompanyPatents,
  monitorCompaniesPatents
}
