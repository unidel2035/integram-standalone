/**
 * HH.ru API Parser
 *
 * Мониторинг активности найма портфельных компаний через HeadHunter API
 * Количество открытых вакансий = индикатор здоровья и роста компании
 *
 * API документация: https://github.com/hhru/api
 * Endpoint: https://api.hh.ru/vacancies
 *
 * Не требует авторизации для базовых запросов
 */

import fetch from 'node-fetch'

const HH_API_BASE = 'https://api.hh.ru'
const USER_AGENT = 'FST-Portfolio-Monitor/1.0 (monitoring@fst-nti.ru)'

/**
 * Поиск вакансий компании по названию или ИНН
 * @param {string} companyName - Название компании
 * @param {string} inn - ИНН компании (опционально, для более точного поиска)
 * @returns {Promise<Object>} Данные о вакансиях компании
 */
export async function fetchCompanyVacancies(companyName, inn = null) {
  try {
    // Сначала ищем компанию через /employers
    const employer = await findEmployer(companyName, inn)

    if (!employer) {
      console.warn(`[HH.ru] Employer not found: ${companyName}`)
      return {
        companyName,
        inn,
        found: false,
        vacanciesCount: 0,
        vacancies: [],
        lastUpdate: new Date().toISOString()
      }
    }

    // Получаем вакансии работодателя
    const vacancies = await fetchEmployerVacancies(employer.id)

    // Анализируем тренды
    const analysis = analyzeVacancies(vacancies)

    return {
      companyName,
      inn,
      found: true,
      employerId: employer.id,
      employerName: employer.name,
      vacanciesCount: vacancies.length,
      openVacancies: vacancies.filter(v => !v.archived).length,
      vacancies: vacancies.slice(0, 20), // Первые 20 для обзора
      analysis,
      lastUpdate: new Date().toISOString()
    }

  } catch (error) {
    console.error(`[HH.ru] Error fetching vacancies for ${companyName}:`, error.message)
    return {
      companyName,
      inn,
      error: error.message,
      found: false,
      vacanciesCount: 0,
      lastUpdate: new Date().toISOString()
    }
  }
}

/**
 * Поиск работодателя по названию компании
 */
async function findEmployer(companyName, inn = null) {
  try {
    // Поиск по названию
    const searchUrl = `${HH_API_BASE}/employers?text=${encodeURIComponent(companyName)}&per_page=10`

    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'application/json'
      }
    })

    if (!response.ok) {
      throw new Error(`HH.ru API returned ${response.status}`)
    }

    const data = await response.json()

    if (!data.items || data.items.length === 0) {
      return null
    }

    // Если есть ИНН, ищем точное совпадение
    if (inn) {
      const exactMatch = data.items.find(emp => emp.inn === inn)
      if (exactMatch) return exactMatch
    }

    // Иначе берём первый результат (наиболее релевантный)
    return data.items[0]

  } catch (error) {
    console.error('[HH.ru] Error finding employer:', error.message)
    return null
  }
}

/**
 * Получение всех вакансий работодателя
 */
async function fetchEmployerVacancies(employerId) {
  try {
    const url = `${HH_API_BASE}/vacancies?employer_id=${employerId}&per_page=100`

    const response = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'application/json'
      }
    })

    if (!response.ok) {
      throw new Error(`HH.ru API returned ${response.status}`)
    }

    const data = await response.json()

    return data.items.map(v => ({
      id: v.id,
      name: v.name,
      area: v.area?.name || '',
      salary: v.salary ? {
        from: v.salary.from,
        to: v.salary.to,
        currency: v.salary.currency
      } : null,
      experience: v.experience?.name || '',
      schedule: v.schedule?.name || '',
      published: v.published_at,
      archived: v.archived || false,
      url: v.alternate_url
    }))

  } catch (error) {
    console.error('[HH.ru] Error fetching vacancies:', error.message)
    return []
  }
}

/**
 * Анализ вакансий и определение трендов найма
 */
function analyzeVacancies(vacancies) {
  const now = new Date()
  const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  const threeMonthsAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)

  const recentVacancies = vacancies.filter(v => {
    const publishedDate = new Date(v.published)
    return publishedDate >= oneMonthAgo && !v.archived
  })

  const lastQuarterVacancies = vacancies.filter(v => {
    const publishedDate = new Date(v.published)
    return publishedDate >= threeMonthsAgo && !v.archived
  })

  // Подсчёт по должностям
  const positionTypes = {
    engineering: 0,
    management: 0,
    sales: 0,
    other: 0
  }

  vacancies.forEach(v => {
    const name = v.name.toLowerCase()
    if (name.includes('инженер') || name.includes('разработчик') || name.includes('программист')) {
      positionTypes.engineering++
    } else if (name.includes('менеджер') || name.includes('директор') || name.includes('руководитель')) {
      positionTypes.management++
    } else if (name.includes('продаж') || name.includes('менеджер по работе')) {
      positionTypes.sales++
    } else {
      positionTypes.other++
    }
  })

  // Определение тренда
  let trend = 'stable'
  if (recentVacancies.length > lastQuarterVacancies.length / 3) {
    trend = 'growing'  // Активный рост найма
  } else if (recentVacancies.length < lastQuarterVacancies.length / 6) {
    trend = 'declining'  // Найм замедляется
  }

  return {
    totalActive: vacancies.filter(v => !v.archived).length,
    recentMonth: recentVacancies.length,
    lastQuarter: lastQuarterVacancies.length,
    trend,
    positionTypes,
    insights: generateInsights(vacancies.length, trend, positionTypes)
  }
}

/**
 * Генерация инсайтов для портфельного монитора
 */
function generateInsights(totalCount, trend, positionTypes) {
  const insights = []

  // Инсайты по количеству вакансий
  if (totalCount === 0) {
    insights.push({
      level: 'warn',
      message: 'Найм остановлен. 0 открытых вакансий.'
    })
  } else if (totalCount >= 10) {
    insights.push({
      level: 'ok',
      message: `Активный найм: ${totalCount} открытых вакансий.`
    })
  } else {
    insights.push({
      level: 'ok',
      message: `${totalCount} открытых вакансий.`
    })
  }

  // Инсайты по тренду
  if (trend === 'growing') {
    insights.push({
      level: 'ok',
      message: 'Тренд: активный рост найма (индикатор развития).'
    })
  } else if (trend === 'declining') {
    insights.push({
      level: 'warn',
      message: 'Тренд: найм замедлился за последний месяц.'
    })
  }

  // Инсайты по типам позиций
  if (positionTypes.engineering > totalCount * 0.5) {
    insights.push({
      level: 'ok',
      message: 'Фокус на найме инженеров — признак R&D развития.'
    })
  }

  if (positionTypes.sales > totalCount * 0.3) {
    insights.push({
      level: 'ok',
      message: 'Активный найм в продажах — признак коммерциализации.'
    })
  }

  return insights
}

/**
 * Мониторинг найма для списка компаний
 * @param {Array<Object>} companies - Массив компаний с полями {id, name, inn}
 * @returns {Promise<Array<Object>>} Массив результатов мониторинга найма
 */
export async function monitorCompaniesHiring(companies) {
  console.log(`[HH.ru Monitor] Starting hiring monitoring for ${companies.length} companies`)

  const results = []

  for (const company of companies) {
    try {
      console.log(`[HH.ru Monitor] Processing ${company.name}`)

      const vacancyData = await fetchCompanyVacancies(company.name, company.inn)

      const result = {
        companyId: company.id,
        companyName: company.name,
        inn: company.inn,
        timestamp: new Date().toISOString(),
        hiring: vacancyData,
        alerts: []
      }

      // Генерируем алерты
      if (vacancyData.analysis) {
        vacancyData.analysis.insights.forEach(insight => {
          if (insight.level === 'warn') {
            result.alerts.push({
              level: 'warn',
              type: 'hiring_slowdown',
              message: insight.message
            })
          }
        })
      }

      if (vacancyData.vacanciesCount === 0 && company.expectedVacancies > 0) {
        result.alerts.push({
          level: 'critical',
          type: 'hiring_stopped',
          message: 'Критично: найм полностью остановлен. Возможны проблемы с финансированием.'
        })
      }

      results.push(result)

      // Задержка между запросами (rate limiting)
      await sleep(1000)

    } catch (error) {
      console.error(`[HH.ru Monitor] Error processing ${company.name}:`, error.message)
      results.push({
        companyId: company.id,
        companyName: company.name,
        error: error.message,
        timestamp: new Date().toISOString()
      })
    }
  }

  console.log(`[HH.ru Monitor] Completed. Processed ${results.length} companies`)

  return results
}

/**
 * Утилита для задержки
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export default {
  fetchCompanyVacancies,
  monitorCompaniesHiring
}
