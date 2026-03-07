/**
 * Applications Routes
 *
 * Endpoints:
 * - POST /api/fst/apply — подача заявки из внешних порталов (Сколково, РФРИТ)
 * - GET /api/fst/application/:id — статус заявки
 */

import { Router } from 'express'
import { authenticateIntegram } from '../middleware/auth.js'

const router = Router()

const INTEGRAM_SERVER = process.env.INTEGRAM_SERVER_URL || 'https://ai2o.ru'
const INTEGRAM_DB = 'fst'

/**
 * POST /api/fst/apply
 *
 * Создаёт новую заявку на финансирование
 * Используется внешними порталами (Сколково, РФРИТ, Госуслуги)
 */
router.post('/apply', async (req, res) => {
  try {
    const { token: integramToken, xsrf } = await authenticateIntegram()

    // Валидация входных данных
    const {
      companyName,
      inn,
      ogrn,
      description,
      requestedAmount,
      trl,
      sovereignty,
      subfund,
      stage,
      contactEmail,
      contactPhone,
      source // Источник заявки: 'skolkovo', 'rfrit', 'gosuslugi'
    } = req.body

    // Обязательные поля
    if (!companyName || !inn || !description || !requestedAmount) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Missing required fields: companyName, inn, description, requestedAmount'
      })
    }

    // Создаём новый проект (type 1155: Проекты ФСТ)
    const PROJECT_TYPE = 1155
    const createResponse = await fetch(
      `${INTEGRAM_SERVER}/${INTEGRAM_DB}/_m_new/${PROJECT_TYPE}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Authorization': integramToken
        },
        body: new URLSearchParams({
          // t1156 = Название, ИНН, ОГРН (SHORT)
          t1156: `${companyName} | ИНН: ${inn}${ogrn ? ` | ОГРН: ${ogrn}` : ''}`,
          // t1158 = Описание проекта (HTML)
          t1158: description,
          // r1157 = TRL, сумма и т.д. (NUMBER) — для простоты сохраним в JSON
          r1157: requestedAmount,
          // r1159 = Дата подачи (DATETIME)
          r1159: new Date().toISOString(),
          // Дополнительные поля
          ...(trl && { r1123: trl }),
          ...(sovereignty && { r1124: sovereignty }),
          // Метаданные заявки
          t1214: JSON.stringify({
            source: source || 'api',
            contactEmail,
            contactPhone,
            submittedAt: new Date().toISOString(),
            apiPartner: req.partner?.name || 'Unknown'
          }),
          // XSRF токен
          _xsrf: xsrf
        })
      }
    )

    if (!createResponse.ok) {
      const errorText = await createResponse.text()
      throw new Error(`Failed to create application: ${createResponse.status} - ${errorText}`)
    }

    const result = await createResponse.json()
    const applicationId = result.id || result.newId

    if (!applicationId) {
      throw new Error('Failed to get application ID from Integram')
    }

    // Отправляем уведомление в Telegram (опционально)
    try {
      await notifyNewApplication({
        id: applicationId,
        companyName,
        requestedAmount,
        source: source || 'api'
      })
    } catch (notifyError) {
      console.error('[Applications] Telegram notification failed:', notifyError.message)
      // Не прерываем процесс, если уведомление не отправилось
    }

    res.status(201).json({
      success: true,
      applicationId,
      message: 'Application submitted successfully',
      status: 'pending_review',
      nextSteps: [
        'Your application will be reviewed by AI Investment Committee',
        'Expected response time: 5-7 business days',
        'You will receive notifications via email'
      ],
      trackingUrl: `/api/fst/application/${applicationId}`
    })

  } catch (error) {
    console.error('[Applications] Error creating application:', error.message)
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to submit application',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    })
  }
})

/**
 * GET /api/fst/application/:id
 *
 * Возвращает статус заявки и результаты рассмотрения
 */
router.get('/application/:id', async (req, res) => {
  try {
    const { id } = req.params
    const { token: integramToken } = await authenticateIntegram()

    // Получаем проект (type 1155: Проекты ФСТ)
    const PROJECT_TYPE = 1155
    const response = await fetch(
      `${INTEGRAM_SERVER}/${INTEGRAM_DB}/_d_req/${PROJECT_TYPE}?JSON_KV&l=1000`,
      {
        headers: { 'X-Authorization': integramToken }
      }
    )

    if (!response.ok) {
      throw new Error(`Failed to fetch application: ${response.status}`)
    }

    const projects = await response.json()
    const project = projects.find(p => p.id === parseInt(id))

    if (!project) {
      return res.status(404).json({
        error: 'Not Found',
        message: `Application ${id} not found`
      })
    }

    // Получаем решение ИК (если есть)
    const committeeDecision = await getCommitteeDecision(project.id, integramToken)

    // Получаем сделку (если одобрено)
    const deal = await getDeal(project.id, integramToken)

    // Формируем ответ
    const status = determineApplicationStatus(project, committeeDecision, deal)

    res.json({
      applicationId: project.id,
      companyName: extractCompanyName(project.t1156),
      status,
      submittedAt: project.r1159,
      lastUpdated: project.updatedAt || project.r1159,
      // Результат рассмотрения ИК
      ...(committeeDecision && {
        committeeReview: {
          decision: committeeDecision.decision,
          score: committeeDecision.score,
          reviewedAt: committeeDecision.reviewedAt,
          conditions: committeeDecision.conditions || []
        }
      }),
      // Информация о сделке (если одобрено)
      ...(deal && {
        deal: {
          id: deal.id,
          amount: deal.amount,
          equity: deal.equity,
          status: deal.status,
          signedAt: deal.signedAt
        }
      })
    })

  } catch (error) {
    console.error('[Applications] Error fetching application:', error.message)
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch application status'
    })
  }
})

// Helper functions

async function getCommitteeDecision(projectId, integramToken) {
  try {
    // Type 1160: Решения ИК
    const DECISION_TYPE = 1160
    const response = await fetch(
      `${INTEGRAM_SERVER}/${INTEGRAM_DB}/_d_req/${DECISION_TYPE}?JSON_KV&l=500`,
      {
        headers: { 'X-Authorization': integramToken }
      }
    )

    if (!response.ok) return null

    const decisions = await response.json()
    const decision = decisions.find(d => d.r1186 === projectId) // r1186 = project reference

    if (!decision) return null

    // Парсим протокол (JSON)
    let protocol = {}
    try {
      protocol = JSON.parse(decision.t1162 || '{}')
    } catch (e) {
      console.error('[Applications] Failed to parse protocol JSON:', e)
    }

    return {
      decision: protocol.decision?.recommendation || 'UNKNOWN',
      score: decision.r1161 || 0,
      reviewedAt: decision.r1163,
      conditions: protocol.decision?.conditions || [],
      risks: protocol.decision?.risks || []
    }

  } catch (error) {
    console.error('[Applications] Error fetching committee decision:', error.message)
    return null
  }
}

async function getDeal(projectId, integramToken) {
  try {
    // Type 1164: Сделки ФСТ
    const DEAL_TYPE = 1164
    const response = await fetch(
      `${INTEGRAM_SERVER}/${INTEGRAM_DB}/_d_req/${DEAL_TYPE}?JSON_KV&l=500`,
      {
        headers: { 'X-Authorization': integramToken }
      }
    )

    if (!response.ok) return null

    const deals = await response.json()
    const deal = deals.find(d => d.r1189 === projectId) // r1189 = project reference

    if (!deal) return null

    return {
      id: deal.id,
      amount: deal.r1165 || 0,
      equity: deal.r1165_2 || 0, // Доля %
      status: deal.status || 'draft',
      signedAt: deal.r1168
    }

  } catch (error) {
    console.error('[Applications] Error fetching deal:', error.message)
    return null
  }
}

function determineApplicationStatus(project, committeeDecision, deal) {
  if (deal && deal.status === 'signed') return 'approved_funded'
  if (deal && deal.status === 'draft') return 'approved_pending_signature'
  if (committeeDecision?.decision === 'APPROVE') return 'approved'
  if (committeeDecision?.decision === 'DEFER') return 'deferred'
  if (committeeDecision?.decision === 'REJECT') return 'rejected'
  return 'pending_review'
}

function extractCompanyName(nameField) {
  if (!nameField) return 'Unknown'
  // Format: "CompanyName | ИНН: 123 | ОГРН: 456"
  return nameField.split('|')[0].trim()
}

async function notifyNewApplication(application) {
  // Интеграция с Telegram Bot (опционально)
  const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
  const TELEGRAM_ADMIN_CHAT_ID = process.env.TELEGRAM_ADMIN_CHAT_ID

  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_ADMIN_CHAT_ID) {
    return // Уведомления отключены
  }

  const message = `🆕 <b>Новая заявка через API</b>\n\n` +
    `ID: ${application.id}\n` +
    `Компания: ${application.companyName}\n` +
    `Сумма: ${application.requestedAmount.toLocaleString('ru-RU')} ₽\n` +
    `Источник: ${application.source}\n\n` +
    `<a href="https://dev.drondoc.ru/fst-committee">Перейти к рассмотрению →</a>`

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
