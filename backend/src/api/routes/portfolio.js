/**
 * Portfolio Routes
 *
 * Endpoints:
 * - GET /api/fst/portfolio — список портфельных компаний + здоровье
 * - GET /api/fst/company/:id — детали компании
 * - GET /api/fst/kpis — сводка KPI портфеля
 */

import { Router } from 'express'
import { authenticateIntegram } from '../middleware/auth.js'

const router = Router()

const INTEGRAM_SERVER = process.env.INTEGRAM_SERVER_URL || 'https://ai2o.ru'
const INTEGRAM_DB = 'fst'

/**
 * GET /api/fst/portfolio
 *
 * Возвращает список портфельных компаний с показателями здоровья
 * (публичный вариант без конфиденциальных финансовых данных)
 */
router.get('/portfolio', async (req, res) => {
  try {
    const { token: integramToken } = await authenticateIntegram()

    // Type 1169: Портфельные компании
    const PORTFOLIO_TYPE = 1169
    const response = await fetch(
      `${INTEGRAM_SERVER}/${INTEGRAM_DB}/_d_req/${PORTFOLIO_TYPE}?JSON_KV&l=100`,
      {
        headers: { 'X-Authorization': integramToken }
      }
    )

    if (!response.ok) {
      throw new Error(`Failed to fetch portfolio: ${response.status}`)
    }

    const companies = await response.json()

    // Преобразуем в публичный формат (без сумм инвестиций)
    const publicPortfolio = companies.map(company => ({
      id: company.id,
      name: company.t1170 || company.name || 'Unknown',
      inn: company.t1171 || '',
      healthScore: company.r1172 || 0, // Общий скор здоровья 0-100
      trafficLight: calculateTrafficLight(company.r1172),
      trl: company.r1173 || 0,
      status: company.status || 'active',
      // Публичные метрики (без конфиденциальных данных)
      metrics: {
        patentsCount: company.r1174 || 0,
        hiringActivity: company.r1175 || 0,
        newsCoverage: company.r1176 || 0,
        lastUpdated: company.r1177 || null
      }
    }))

    res.json({
      total: publicPortfolio.length,
      companies: publicPortfolio,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('[Portfolio] Error fetching portfolio:', error.message)
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch portfolio data'
    })
  }
})

/**
 * GET /api/fst/company/:id
 *
 * Возвращает детальную информацию о портфельной компании
 */
router.get('/company/:id', async (req, res) => {
  try {
    const { id } = req.params
    const { token: integramToken } = await authenticateIntegram()

    // Получаем данные компании
    const PORTFOLIO_TYPE = 1169
    const response = await fetch(
      `${INTEGRAM_SERVER}/${INTEGRAM_DB}/_d_req/${PORTFOLIO_TYPE}?JSON_KV&l=100`,
      {
        headers: { 'X-Authorization': integramToken }
      }
    )

    if (!response.ok) {
      throw new Error(`Failed to fetch company: ${response.status}`)
    }

    const companies = await response.json()
    const company = companies.find(c => c.id === parseInt(id))

    if (!company) {
      return res.status(404).json({
        error: 'Not Found',
        message: `Company with ID ${id} not found`
      })
    }

    // Детальная информация (публичная)
    const companyDetails = {
      id: company.id,
      name: company.t1170 || company.name || 'Unknown',
      inn: company.t1171 || '',
      description: company.t1158 || '',
      healthScore: company.r1172 || 0,
      trafficLight: calculateTrafficLight(company.r1172),
      trl: company.r1173 || 0,
      status: company.status || 'active',
      metrics: {
        patentsCount: company.r1174 || 0,
        hiringActivity: company.r1175 || 0,
        newsCoverage: company.r1176 || 0,
        lastUpdated: company.r1177 || null
      },
      // История мониторинга (последние события)
      recentEvents: await getRecentEvents(company.id, integramToken)
    }

    res.json(companyDetails)

  } catch (error) {
    console.error('[Portfolio] Error fetching company:', error.message)
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch company data'
    })
  }
})

/**
 * GET /api/fst/kpis
 *
 * Возвращает агрегированные KPI всего портфеля
 */
router.get('/kpis', async (req, res) => {
  try {
    const { token: integramToken } = await authenticateIntegram()

    // Получаем все компании
    const PORTFOLIO_TYPE = 1169
    const response = await fetch(
      `${INTEGRAM_SERVER}/${INTEGRAM_DB}/_d_req/${PORTFOLIO_TYPE}?JSON_KV&l=100`,
      {
        headers: { 'X-Authorization': integramToken }
      }
    )

    if (!response.ok) {
      throw new Error(`Failed to fetch portfolio: ${response.status}`)
    }

    const companies = await response.json()

    // Агрегируем KPI
    const kpis = {
      totalCompanies: companies.length,
      averageHealthScore: calculateAverage(companies, 'r1172'),
      trafficLightDistribution: {
        green: companies.filter(c => calculateTrafficLight(c.r1172) === 'green').length,
        yellow: companies.filter(c => calculateTrafficLight(c.r1172) === 'yellow').length,
        red: companies.filter(c => calculateTrafficLight(c.r1172) === 'red').length
      },
      totalPatents: companies.reduce((sum, c) => sum + (c.r1174 || 0), 0),
      averageTRL: calculateAverage(companies, 'r1173'),
      activeCompanies: companies.filter(c => c.status === 'active').length,
      timestamp: new Date().toISOString()
    }

    res.json(kpis)

  } catch (error) {
    console.error('[Portfolio] Error calculating KPIs:', error.message)
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to calculate portfolio KPIs'
    })
  }
})

// Helper functions

function calculateTrafficLight(healthScore) {
  if (!healthScore) return 'gray'
  if (healthScore >= 70) return 'green'
  if (healthScore >= 40) return 'yellow'
  return 'red'
}

function calculateAverage(array, field) {
  const values = array.map(item => item[field] || 0).filter(v => v > 0)
  if (values.length === 0) return 0
  return Math.round(values.reduce((sum, v) => sum + v, 0) / values.length)
}

async function getRecentEvents(companyId, integramToken) {
  try {
    // Type 1201: События мониторинга
    const EVENTS_TYPE = 1201
    const response = await fetch(
      `${INTEGRAM_SERVER}/${INTEGRAM_DB}/_d_req/${EVENTS_TYPE}?JSON_KV&l=50`,
      {
        headers: { 'X-Authorization': integramToken }
      }
    )

    if (!response.ok) {
      return []
    }

    const events = await response.json()

    // Фильтруем события для этой компании и берём последние 10
    return events
      .filter(e => e.r1202 === companyId) // r1202 = company reference
      .sort((a, b) => new Date(b.r1203) - new Date(a.r1203)) // r1203 = timestamp
      .slice(0, 10)
      .map(e => ({
        type: e.t1204 || 'unknown',
        description: e.t1205 || '',
        timestamp: e.r1203,
        severity: e.t1206 || 'info'
      }))

  } catch (error) {
    console.error('[Portfolio] Error fetching events:', error.message)
    return []
  }
}

export default router
