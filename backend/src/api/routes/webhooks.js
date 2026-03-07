/**
 * Webhook Routes
 *
 * Endpoints для получения обновлений от внешних источников:
 * - POST /api/fst/webhook/egrul — обновления ЕГРЮЛ/ЕФРСБ
 * - POST /api/fst/webhook/rospatent — новые патенты
 * - POST /api/fst/webhook/hh — статистика найма HH.ru
 */

import { Router } from 'express'
import { authenticateIntegram } from '../middleware/auth.js'

const router = Router()

const INTEGRAM_SERVER = process.env.INTEGRAM_SERVER_URL || 'https://ai2o.ru'
const INTEGRAM_DB = 'fst'

/**
 * POST /api/fst/webhook/egrul
 *
 * Webhook для обновлений ЕГРЮЛ/ЕФРСБ
 * Вызывается автоматически парсером или внешним сервисом
 */
router.post('/egrul', async (req, res) => {
  try {
    const { token: integramToken, xsrf } = await authenticateIntegram()

    // Валидация данных
    const {
      inn,
      companyName,
      changeType, // 'status', 'address', 'director', 'capital', 'bankruptcy'
      oldValue,
      newValue,
      source,
      changeDate
    } = req.body

    if (!inn || !changeType || !newValue) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Missing required fields: inn, changeType, newValue'
      })
    }

    // Находим компанию в портфеле по ИНН
    const company = await findCompanyByINN(inn, integramToken)

    if (!company) {
      return res.status(404).json({
        error: 'Not Found',
        message: `Company with INN ${inn} not found in portfolio`
      })
    }

    // Создаём событие мониторинга (type 1201: События мониторинга)
    const EVENT_TYPE = 1201
    const severity = calculateSeverity(changeType, oldValue, newValue)

    const createResponse = await fetch(
      `${INTEGRAM_SERVER}/${INTEGRAM_DB}/_m_new/${EVENT_TYPE}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Authorization': integramToken
        },
        body: new URLSearchParams({
          // r1202 = company reference
          r1202: company.id,
          // r1203 = timestamp
          r1203: changeDate || new Date().toISOString(),
          // t1204 = event type
          t1204: `egrul_${changeType}`,
          // t1205 = description
          t1205: `ЕГРЮЛ: ${formatEgrulChange(changeType, oldValue, newValue)}`,
          // t1206 = severity
          t1206: severity,
          // Полные данные в JSON
          t1207: JSON.stringify({
            source: 'egrul',
            inn,
            companyName,
            changeType,
            oldValue,
            newValue,
            webhookSource: source || 'unknown'
          }),
          _xsrf: xsrf
        })
      }
    )

    if (!createResponse.ok) {
      throw new Error(`Failed to create event: ${createResponse.status}`)
    }

    const result = await createResponse.json()

    // Обновляем скор здоровья компании
    await updateCompanyHealth(company.id, changeType, severity, integramToken, xsrf)

    // Отправляем алерт, если критическое изменение
    if (severity === 'critical' || severity === 'high') {
      await sendAlert({
        companyId: company.id,
        companyName: company.t1170 || companyName,
        eventType: changeType,
        description: formatEgrulChange(changeType, oldValue, newValue),
        severity
      })
    }

    res.json({
      success: true,
      eventId: result.id || result.newId,
      companyId: company.id,
      severity,
      message: 'EGRUL update processed successfully'
    })

  } catch (error) {
    console.error('[Webhook EGRUL] Error:', error.message)
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to process EGRUL webhook'
    })
  }
})

/**
 * POST /api/fst/webhook/rospatent
 *
 * Webhook для новых патентов и изменений IP
 */
router.post('/rospatent', async (req, res) => {
  try {
    const { token: integramToken, xsrf } = await authenticateIntegram()

    const {
      inn,
      companyName,
      patentNumber,
      patentTitle,
      patentType, // 'invention', 'utility_model', 'industrial_design'
      status, // 'filed', 'granted', 'expired', 'invalidated'
      filingDate,
      grantDate
    } = req.body

    if (!inn || !patentNumber || !status) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Missing required fields: inn, patentNumber, status'
      })
    }

    const company = await findCompanyByINN(inn, integramToken)

    if (!company) {
      return res.status(404).json({
        error: 'Not Found',
        message: `Company with INN ${inn} not found in portfolio`
      })
    }

    // Создаём событие
    const EVENT_TYPE = 1201
    const severity = status === 'granted' ? 'info' : 'low'

    const createResponse = await fetch(
      `${INTEGRAM_SERVER}/${INTEGRAM_DB}/_m_new/${EVENT_TYPE}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Authorization': integramToken
        },
        body: new URLSearchParams({
          r1202: company.id,
          r1203: grantDate || filingDate || new Date().toISOString(),
          t1204: `rospatent_${status}`,
          t1205: `Роспатент: ${formatPatentEvent(status, patentNumber, patentTitle)}`,
          t1206: severity,
          t1207: JSON.stringify({
            source: 'rospatent',
            inn,
            companyName,
            patentNumber,
            patentTitle,
            patentType,
            status,
            filingDate,
            grantDate
          }),
          _xsrf: xsrf
        })
      }
    )

    if (!createResponse.ok) {
      throw new Error(`Failed to create event: ${createResponse.status}`)
    }

    const result = await createResponse.json()

    // Обновляем счётчик патентов компании
    if (status === 'granted') {
      await incrementPatentCount(company.id, integramToken, xsrf)
    }

    res.json({
      success: true,
      eventId: result.id || result.newId,
      companyId: company.id,
      message: 'Rospatent update processed successfully'
    })

  } catch (error) {
    console.error('[Webhook Rospatent] Error:', error.message)
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to process Rospatent webhook'
    })
  }
})

/**
 * POST /api/fst/webhook/hh
 *
 * Webhook для статистики найма с HH.ru
 */
router.post('/hh', async (req, res) => {
  try {
    const { token: integramToken, xsrf } = await authenticateIntegram()

    const {
      inn,
      companyName,
      activeVacancies,
      totalVacancies,
      avgSalary,
      topPositions, // [{ title, count }]
      period // 'week', 'month'
    } = req.body

    if (!inn || activeVacancies === undefined) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Missing required fields: inn, activeVacancies'
      })
    }

    const company = await findCompanyByINN(inn, integramToken)

    if (!company) {
      return res.status(404).json({
        error: 'Not Found',
        message: `Company with INN ${inn} not found in portfolio`
      })
    }

    // Создаём событие
    const EVENT_TYPE = 1201
    const severity = activeVacancies > 10 ? 'info' : 'low'

    const createResponse = await fetch(
      `${INTEGRAM_SERVER}/${INTEGRAM_DB}/_m_new/${EVENT_TYPE}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Authorization': integramToken
        },
        body: new URLSearchParams({
          r1202: company.id,
          r1203: new Date().toISOString(),
          t1204: 'hh_hiring',
          t1205: `HH.ru: ${activeVacancies} активных вакансий`,
          t1206: severity,
          t1207: JSON.stringify({
            source: 'hh',
            inn,
            companyName,
            activeVacancies,
            totalVacancies,
            avgSalary,
            topPositions,
            period
          }),
          _xsrf: xsrf
        })
      }
    )

    if (!createResponse.ok) {
      throw new Error(`Failed to create event: ${createResponse.status}`)
    }

    const result = await createResponse.json()

    // Обновляем метрику hiring activity
    await updateHiringActivity(company.id, activeVacancies, integramToken, xsrf)

    res.json({
      success: true,
      eventId: result.id || result.newId,
      companyId: company.id,
      message: 'HH.ru update processed successfully'
    })

  } catch (error) {
    console.error('[Webhook HH] Error:', error.message)
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to process HH.ru webhook'
    })
  }
})

// Helper functions

async function findCompanyByINN(inn, integramToken) {
  const PORTFOLIO_TYPE = 1169
  const response = await fetch(
    `${INTEGRAM_SERVER}/${INTEGRAM_DB}/_d_req/${PORTFOLIO_TYPE}?JSON_KV&l=100`,
    {
      headers: { 'X-Authorization': integramToken }
    }
  )

  if (!response.ok) return null

  const companies = await response.json()
  return companies.find(c => c.t1171 === inn)
}

async function updateCompanyHealth(companyId, changeType, severity, integramToken, xsrf) {
  // Рассчитываем новый health score на основе типа изменения и severity
  let healthDelta = 0

  if (changeType === 'bankruptcy') {
    healthDelta = -30
  } else if (changeType === 'director' && severity === 'high') {
    healthDelta = -10
  } else if (changeType === 'status' && severity === 'critical') {
    healthDelta = -20
  }

  if (healthDelta === 0) return

  // Обновляем скор (r1172)
  try {
    await fetch(
      `${INTEGRAM_SERVER}/${INTEGRAM_DB}/_m_set/${companyId}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Authorization': integramToken
        },
        body: new URLSearchParams({
          r1172_delta: healthDelta, // Относительное изменение
          _xsrf: xsrf
        })
      }
    )
  } catch (error) {
    console.error('[Webhook] Failed to update health score:', error.message)
  }
}

async function incrementPatentCount(companyId, integramToken, xsrf) {
  try {
    await fetch(
      `${INTEGRAM_SERVER}/${INTEGRAM_DB}/_m_set/${companyId}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Authorization': integramToken
        },
        body: new URLSearchParams({
          r1174_delta: 1, // r1174 = patents count
          _xsrf: xsrf
        })
      }
    )
  } catch (error) {
    console.error('[Webhook] Failed to increment patent count:', error.message)
  }
}

async function updateHiringActivity(companyId, activeVacancies, integramToken, xsrf) {
  try {
    await fetch(
      `${INTEGRAM_SERVER}/${INTEGRAM_DB}/_m_set/${companyId}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Authorization': integramToken
        },
        body: new URLSearchParams({
          r1175: activeVacancies, // r1175 = hiring activity
          _xsrf: xsrf
        })
      }
    )
  } catch (error) {
    console.error('[Webhook] Failed to update hiring activity:', error.message)
  }
}

function calculateSeverity(changeType, oldValue, newValue) {
  if (changeType === 'bankruptcy') return 'critical'
  if (changeType === 'status' && newValue.includes('ликвидац')) return 'critical'
  if (changeType === 'director') return 'high'
  if (changeType === 'capital' && parseFloat(newValue) < parseFloat(oldValue)) return 'medium'
  return 'low'
}

function formatEgrulChange(changeType, oldValue, newValue) {
  const labels = {
    status: 'Статус',
    address: 'Адрес',
    director: 'Руководитель',
    capital: 'Уставный капитал',
    bankruptcy: 'Банкротство'
  }

  const label = labels[changeType] || changeType

  if (changeType === 'bankruptcy') {
    return `${label}: ${newValue}`
  }

  return `${label} изменён: "${oldValue}" → "${newValue}"`
}

function formatPatentEvent(status, patentNumber, patentTitle) {
  const statusLabels = {
    filed: 'Подана заявка',
    granted: 'Получен патент',
    expired: 'Патент истёк',
    invalidated: 'Патент аннулирован'
  }

  const statusLabel = statusLabels[status] || status
  return `${statusLabel} ${patentNumber}${patentTitle ? `: ${patentTitle}` : ''}`
}

async function sendAlert(alert) {
  // Интеграция с Telegram Bot (опционально)
  const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
  const TELEGRAM_ADMIN_CHAT_ID = process.env.TELEGRAM_ADMIN_CHAT_ID

  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_ADMIN_CHAT_ID) {
    return
  }

  const severityEmojis = {
    critical: '🚨',
    high: '⚠️',
    medium: '⚡',
    low: 'ℹ️'
  }

  const message = `${severityEmojis[alert.severity]} <b>Алерт портфеля</b>\n\n` +
    `Компания: ${alert.companyName}\n` +
    `Событие: ${alert.eventType}\n` +
    `Описание: ${alert.description}\n` +
    `Важность: ${alert.severity}\n\n` +
    `<a href="https://dev.drondoc.ru/fst-portfolio">Открыть портфель →</a>`

  await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: TELEGRAM_ADMIN_CHAT_ID,
      text: message,
      parse_mode: 'HTML'
    })
  })
}

export default router
