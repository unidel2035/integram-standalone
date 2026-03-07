/**
 * Portfolio Monitor Scheduler
 *
 * Автоматический мониторинг портфельных компаний с использованием всех парсеров:
 * - ЕГРЮЛ/ЕФРСБ (еженедельно)
 * - HH.ru (еженедельно)
 * - Роспатент (ежемесячно)
 * - Новости (ежедневно)
 *
 * Использует node-cron для планирования задач
 * Результаты сохраняются в Integram (fst database)
 */

import cron from 'node-cron'
import { monitorCompanies as monitorEgrul } from '../parsers/egrulParser.js'
import { monitorCompaniesHiring } from '../parsers/hhParser.js'
import { monitorCompaniesPatents } from '../parsers/rospatentParser.js'
import { monitorCompaniesNews } from '../parsers/newsParser.js'
import { initTelegramBot, triggerPortfolioAlert } from '../services/telegramBot.js'

// Интеграция с Integram API (fst database)
const INTEGRAM_SERVER = process.env.INTEGRAM_SERVER_URL || 'https://ai2o.ru'
const INTEGRAM_DB = 'fst'
const INTEGRAM_USERNAME = process.env.INTEGRAM_SYSTEM_USERNAME
const INTEGRAM_PASSWORD = process.env.INTEGRAM_SYSTEM_PASSWORD

let integramToken = null
let integramXsrf = null

/**
 * Авторизация в Integram
 */
async function authenticateIntegram() {
  try {
    const response = await fetch(`${INTEGRAM_SERVER}/${INTEGRAM_DB}/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        username: INTEGRAM_USERNAME,
        password: INTEGRAM_PASSWORD
      })
    })

    if (!response.ok) {
      throw new Error(`Integram auth failed: ${response.status}`)
    }

    const data = await response.json()
    integramToken = data.token
    integramXsrf = data._xsrf

    console.log('[Portfolio Monitor] Integram authentication successful')
    return true

  } catch (error) {
    console.error('[Portfolio Monitor] Integram auth error:', error.message)
    return false
  }
}

/**
 * Получение списка портфельных компаний из Integram
 */
async function getPortfolioCompanies() {
  try {
    if (!integramToken) {
      await authenticateIntegram()
    }

    // Portfolio type ID в Integram (из схемы БД)
    const portfolioTypeId = 1116

    const response = await fetch(
      `${INTEGRAM_SERVER}/${INTEGRAM_DB}/_d_req/${portfolioTypeId}?JSON_KV&l=100`,
      {
        headers: {
          'X-Authorization': integramToken
        }
      }
    )

    if (!response.ok) {
      throw new Error(`Failed to fetch portfolio: ${response.status}`)
    }

    const data = await response.json()

    // Преобразуем данные Integram в структуру для парсеров
    const companies = data.map(row => ({
      id: row.id,
      name: row.name || row.t1118 || 'Unknown',  // t1118 = name field
      inn: row.r1120 || '',  // r1120 = INN relation
      trl: row.r1123 || 0,   // r1123 = TRL field
      projectId: row.projectId || row.r1119 || null
    }))

    console.log(`[Portfolio Monitor] Fetched ${companies.length} companies from Integram`)
    return companies

  } catch (error) {
    console.error('[Portfolio Monitor] Error fetching companies:', error.message)
    // Fallback на демо-данные
    return getDefaultCompanies()
  }
}

/**
 * Fallback демо-данные если Integram недоступен
 */
function getDefaultCompanies() {
  return [
    { id: 1, name: 'АвиаЛогик', inn: '7701234567', trl: 6 },
    { id: 2, name: 'МикроСхема', inn: '7705551234', trl: 7 },
    { id: 3, name: 'РоботАгро', inn: '5011900321', trl: 4 },
    { id: 4, name: 'АэроСпектр', inn: '7812345678', trl: 6 },
    { id: 5, name: 'НейроДрон', inn: '6670345678', trl: 5 }
  ]
}

/**
 * Сохранение результатов мониторинга в Integram
 */
async function saveMonitoringResults(companyId, dataType, data) {
  try {
    if (!integramToken) {
      await authenticateIntegram()
    }

    // Формируем данные для записи в таблицу мониторинга
    const monitoringRecordTypeId = 1130  // Тип записи мониторинга (гипотетический)

    const body = new URLSearchParams({
      t1131: companyId,           // Связь с компанией
      t1132: dataType,            // Тип данных (egrul, hh, patents, news)
      t1133: JSON.stringify(data),  // JSON с результатами
      t1134: new Date().toISOString(),  // Timestamp
      _xsrf: integramXsrf
    })

    const response = await fetch(
      `${INTEGRAM_SERVER}/${INTEGRAM_DB}/_m_new/${monitoringRecordTypeId}`,
      {
        method: 'POST',
        headers: {
          'X-Authorization': integramToken,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body
      }
    )

    if (!response.ok) {
      console.warn(`[Portfolio Monitor] Failed to save ${dataType} for company ${companyId}`)
      return false
    }

    return true

  } catch (error) {
    console.error('[Portfolio Monitor] Error saving results:', error.message)
    return false
  }
}

/**
 * Обновление светофора рисков в Portfolio таблице
 */
async function updateCompanyRiskStatus(companyId, companyName, alerts) {
  try {
    if (!integramToken) {
      await authenticateIntegram()
    }

    // Определяем уровень риска на основе алертов
    let riskStatusId = 1125  // green (по умолчанию)

    const criticalAlerts = alerts.filter(a => a.level === 'critical')
    const warnAlerts = alerts.filter(a => a.level === 'warn')

    if (criticalAlerts.length > 0) {
      riskStatusId = 1127  // red
    } else if (warnAlerts.length >= 2) {
      riskStatusId = 1126  // yellow
    }

    // Обновляем запись в Portfolio
    const body = new URLSearchParams({
      r1124: riskStatusId,  // riskStatusId field
      t1128: new Date().toISOString(),  // lastMonitored timestamp
      _xsrf: integramXsrf
    })

    const response = await fetch(
      `${INTEGRAM_SERVER}/${INTEGRAM_DB}/_m_set/${companyId}`,
      {
        method: 'POST',
        headers: {
          'X-Authorization': integramToken,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body
      }
    )

    if (!response.ok) {
      console.warn(`[Portfolio Monitor] Failed to update risk status for company ${companyId}`)
      return false
    }

    const statusText = riskStatusId === 1127 ? 'RED' : riskStatusId === 1126 ? 'YELLOW' : 'GREEN'
    console.log(`[Portfolio Monitor] Updated risk status for company ${companyId}: ${statusText}`)

    // Send Telegram notifications for critical and warning alerts
    if (criticalAlerts.length > 0) {
      const alertMessages = criticalAlerts.map(a => a.message || a.reason).join('\n• ')
      await triggerPortfolioAlert(companyId, companyName, 'critical', `• ${alertMessages}`)
    } else if (warnAlerts.length > 0) {
      const alertMessages = warnAlerts.map(a => a.message || a.reason).join('\n• ')
      await triggerPortfolioAlert(companyId, companyName, 'warning', `• ${alertMessages}`)
    }

    return true

  } catch (error) {
    console.error('[Portfolio Monitor] Error updating risk status:', error.message)
    return false
  }
}

/**
 * Полный цикл мониторинга всех источников
 */
async function runFullMonitoring() {
  console.log('\n=== Portfolio Monitoring Started ===')
  console.log(`Time: ${new Date().toISOString()}`)

  try {
    // Получаем список компаний
    const companies = await getPortfolioCompanies()

    if (companies.length === 0) {
      console.log('[Portfolio Monitor] No companies to monitor')
      return
    }

    const results = {
      egrul: [],
      hiring: [],
      patents: [],
      news: []
    }

    // 1. ЕГРЮЛ мониторинг
    console.log('\n--- Running EGRUL monitoring ---')
    results.egrul = await monitorEgrul(companies)

    // 2. HH.ru мониторинг
    console.log('\n--- Running HH.ru monitoring ---')
    results.hiring = await monitorCompaniesHiring(companies)

    // 3. Роспатент мониторинг (только раз в месяц, но для демо запускаем)
    console.log('\n--- Running Rospatent monitoring ---')
    results.patents = await monitorCompaniesPatents(companies)

    // 4. Новостной мониторинг
    console.log('\n--- Running News monitoring ---')
    results.news = await monitorCompaniesNews(companies, 30)

    // Сохраняем результаты и обновляем риски
    console.log('\n--- Saving results to Integram ---')

    for (const company of companies) {
      const companyAlerts = []

      // Собираем все алерты по компании
      const egrulResult = results.egrul.find(r => r.companyId === company.id)
      const hiringResult = results.hiring.find(r => r.companyId === company.id)
      const patentsResult = results.patents.find(r => r.companyId === company.id)
      const newsResult = results.news.find(r => r.companyId === company.id)

      if (egrulResult?.alerts) companyAlerts.push(...egrulResult.alerts)
      if (hiringResult?.alerts) companyAlerts.push(...hiringResult.alerts)
      if (patentsResult?.alerts) companyAlerts.push(...patentsResult.alerts)
      if (newsResult?.alerts) companyAlerts.push(...newsResult.alerts)

      // Сохраняем результаты
      await saveMonitoringResults(company.id, 'egrul', egrulResult)
      await saveMonitoringResults(company.id, 'hiring', hiringResult)
      await saveMonitoringResults(company.id, 'patents', patentsResult)
      await saveMonitoringResults(company.id, 'news', newsResult)

      // Обновляем светофор рисков
      await updateCompanyRiskStatus(company.id, company.name, companyAlerts)
    }

    // Статистика
    const totalAlerts = [
      ...results.egrul.flatMap(r => r.alerts || []),
      ...results.hiring.flatMap(r => r.alerts || []),
      ...results.patents.flatMap(r => r.alerts || []),
      ...results.news.flatMap(r => r.alerts || [])
    ]

    console.log('\n=== Monitoring Summary ===')
    console.log(`Companies monitored: ${companies.length}`)
    console.log(`Total alerts: ${totalAlerts.length}`)
    console.log(`  - Critical: ${totalAlerts.filter(a => a.level === 'critical').length}`)
    console.log(`  - Warnings: ${totalAlerts.filter(a => a.level === 'warn').length}`)
    console.log('=== Monitoring Completed ===\n')

  } catch (error) {
    console.error('[Portfolio Monitor] Fatal error:', error)
  }
}

/**
 * ЕГРЮЛ мониторинг (еженедельно)
 */
async function runEgrulMonitoring() {
  console.log('\n=== EGRUL Weekly Monitoring ===')

  try {
    const companies = await getPortfolioCompanies()
    const results = await monitorEgrul(companies)

    for (const result of results) {
      const company = companies.find(c => c.id === result.companyId)
      await saveMonitoringResults(result.companyId, 'egrul', result)
      if (result.alerts && result.alerts.length > 0) {
        await updateCompanyRiskStatus(result.companyId, company?.name || 'Unknown', result.alerts)
      }
    }

    console.log('=== EGRUL Monitoring Completed ===\n')
  } catch (error) {
    console.error('[EGRUL Monitor] Error:', error)
  }
}

/**
 * Роспатент мониторинг (ежемесячно)
 */
async function runPatentMonitoring() {
  console.log('\n=== Rospatent Monthly Monitoring ===')

  try {
    const companies = await getPortfolioCompanies()
    const results = await monitorCompaniesPatents(companies)

    for (const result of results) {
      const company = companies.find(c => c.id === result.companyId)
      await saveMonitoringResults(result.companyId, 'patents', result)
      if (result.alerts && result.alerts.length > 0) {
        await updateCompanyRiskStatus(result.companyId, company?.name || 'Unknown', result.alerts)
      }
    }

    console.log('=== Patent Monitoring Completed ===\n')
  } catch (error) {
    console.error('[Patent Monitor] Error:', error)
  }
}

/**
 * Новостной мониторинг (ежедневно)
 */
async function runNewsMonitoring() {
  console.log('\n=== News Daily Monitoring ===')

  try {
    const companies = await getPortfolioCompanies()
    const results = await monitorCompaniesNews(companies, 7)  // За последние 7 дней

    for (const result of results) {
      const company = companies.find(c => c.id === result.companyId)
      await saveMonitoringResults(result.companyId, 'news', result)
      if (result.alerts && result.alerts.length > 0) {
        await updateCompanyRiskStatus(result.companyId, company?.name || 'Unknown', result.alerts)
      }
    }

    console.log('=== News Monitoring Completed ===\n')
  } catch (error) {
    console.error('[News Monitor] Error:', error)
  }
}

/**
 * Инициализация планировщика
 */
export function initScheduler() {
  console.log('[Portfolio Monitor] Initializing scheduler...')

  // Initialize Telegram bot
  initTelegramBot()

  // Ежедневный мониторинг новостей (каждый день в 09:00)
  cron.schedule('0 9 * * *', () => {
    runNewsMonitoring()
  })

  // Еженедельный мониторинг ЕГРЮЛ и HH.ru (каждый понедельник в 08:00)
  cron.schedule('0 8 * * 1', () => {
    runEgrulMonitoring()
    runFullMonitoring()
  })

  // Ежемесячный мониторинг патентов (1-го числа каждого месяца в 10:00)
  cron.schedule('0 10 1 * *', () => {
    runPatentMonitoring()
  })

  console.log('[Portfolio Monitor] Scheduler initialized')
  console.log('  - Daily news monitoring: 09:00')
  console.log('  - Weekly EGRUL/HH.ru monitoring: Monday 08:00')
  console.log('  - Monthly patent monitoring: 1st day of month, 10:00')
  console.log('  - Telegram bot: enabled')
}

/**
 * Ручной запуск мониторинга
 */
export async function runManualMonitoring(type = 'full') {
  switch (type) {
    case 'egrul':
      await runEgrulMonitoring()
      break
    case 'patents':
      await runPatentMonitoring()
      break
    case 'news':
      await runNewsMonitoring()
      break
    case 'full':
    default:
      await runFullMonitoring()
      break
  }
}

export default {
  initScheduler,
  runManualMonitoring,
  runFullMonitoring
}
