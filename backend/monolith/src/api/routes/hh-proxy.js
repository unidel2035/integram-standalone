/**
 * HeadHunter API Proxy Routes
 *
 * Proxy endpoints for HeadHunter.ru API to avoid CORS and User-Agent issues
 * from frontend direct requests.
 */

import axios from 'axios'
import express from 'express'
import logger from '../../utils/logger.js'

const HH_API_BASE = 'https://api.hh.ru'

/**
 * Create HH proxy routes
 * @param {Object} options - Route options
 * @returns {Function} Express router
 */
export function createHHProxyRoutes(options = {}) {
  const router = options.router || express.Router()

  /**
   * Search vacancies on HH.ru
   * GET /api/hh/vacancies
   * Query params:
   *   - text: search query (required)
   *   - area: city/region code (optional, default: 1 for Moscow)
   *   - per_page: results per page (optional, default: 10, max: 100)
   *   - page: page number (optional, default: 0)
   */
  router.get('/vacancies', async (req, res) => {
    try {
      const { text, area = 1, per_page = 10, page = 0 } = req.query

      if (!text) {
        return res.status(400).json({
          success: false,
          error: 'Query parameter "text" is required'
        })
      }

      logger.info('[HH Proxy] Searching vacancies:', { text, area, per_page, page })

      const response = await axios.get(`${HH_API_BASE}/vacancies`, {
        params: {
          text,
          area,
          per_page: Math.min(parseInt(per_page) || 10, 100), // Max 100
          page: parseInt(page) || 0
        },
        headers: {
          'User-Agent': 'DronDoc/1.0 (hive@drondoc.ru)',
          'Accept': 'application/json'
        },
        timeout: 10000
      })

      res.json({
        success: true,
        data: response.data
      })
    } catch (error) {
      logger.error('[HH Proxy] Vacancies search error:', error)

      res.status(error.response?.status || 500).json({
        success: false,
        error: error.response?.data?.description || error.message || 'Failed to search vacancies'
      })
    }
  })

  /**
   * Search employers on HH.ru
   * GET /api/hh/employers
   * Query params:
   *   - text: company name (required)
   *   - area: city/region code (optional, default: 1 for Moscow)
   *   - per_page: results per page (optional, default: 10, max: 100)
   *   - page: page number (optional, default: 0)
   */
  router.get('/employers', async (req, res) => {
    try {
      const { text, area = 1, per_page = 10, page = 0 } = req.query

      if (!text) {
        return res.status(400).json({
          success: false,
          error: 'Query parameter "text" is required'
        })
      }

      logger.info('[HH Proxy] Searching employers:', { text, area, per_page, page })

      const response = await axios.get(`${HH_API_BASE}/employers`, {
        params: {
          text,
          area,
          per_page: Math.min(parseInt(per_page) || 10, 100),
          page: parseInt(page) || 0
        },
        headers: {
          'User-Agent': 'DronDoc/1.0 (hive@drondoc.ru)',
          'Accept': 'application/json'
        },
        timeout: 10000
      })

      res.json({
        success: true,
        data: response.data
      })
    } catch (error) {
      logger.error('[HH Proxy] Employers search error:', error)

      res.status(error.response?.status || 500).json({
        success: false,
        error: error.response?.data?.description || error.message || 'Failed to search employers'
      })
    }
  })

  /**
   * Get vacancy by ID
   * GET /api/hh/vacancies/:id
   */
  router.get('/vacancies/:id', async (req, res) => {
    try {
      const { id } = req.params

      logger.info('[HH Proxy] Getting vacancy:', { id })

      const response = await axios.get(`${HH_API_BASE}/vacancies/${id}`, {
        headers: {
          'User-Agent': 'DronDoc/1.0 (hive@drondoc.ru)',
          'Accept': 'application/json'
        },
        timeout: 10000
      })

      res.json({
        success: true,
        data: response.data
      })
    } catch (error) {
      logger.error('[HH Proxy] Get vacancy error:', error)

      res.status(error.response?.status || 500).json({
        success: false,
        error: error.response?.data?.description || error.message || 'Failed to get vacancy'
      })
    }
  })

  /**
   * Get salary statistics for a position
   * GET /api/hh/salary-statistics
   * Query params:
   *   - text: position name (required)
   *   - area: city/region code (optional, default: 1 for Moscow)
   */
  router.get('/salary-statistics', async (req, res) => {
    try {
      const { text, area = 1 } = req.query

      if (!text) {
        return res.status(400).json({
          success: false,
          error: 'Query parameter "text" is required'
        })
      }

      logger.info('[HH Proxy] Getting salary statistics:', { text, area })

      // Get vacancies with salary info
      const response = await axios.get(`${HH_API_BASE}/vacancies`, {
        params: {
          text,
          area,
          per_page: 100,
          only_with_salary: true
        },
        headers: {
          'User-Agent': 'DronDoc/1.0 (hive@drondoc.ru)',
          'Accept': 'application/json'
        },
        timeout: 10000
      })

      // Calculate statistics
      const vacancies = response.data.items || []
      const salaries = vacancies
        .filter(v => v.salary)
        .map(v => ({
          from: v.salary.from,
          to: v.salary.to,
          currency: v.salary.currency,
          gross: v.salary.gross
        }))

      if (salaries.length === 0) {
        return res.json({
          success: true,
          data: {
            found: response.data.found || 0,
            withSalary: 0,
            statistics: null,
            message: 'Нет вакансий с указанной зарплатой'
          }
        })
      }

      // Calculate average, min, max (in RUR)
      const rurSalaries = salaries.filter(s => s.currency === 'RUR')
      const avgValues = rurSalaries.map(s => {
        if (s.from && s.to) return (s.from + s.to) / 2
        if (s.from) return s.from
        if (s.to) return s.to
        return null
      }).filter(v => v !== null)

      const minValues = rurSalaries.filter(s => s.from).map(s => s.from)
      const maxValues = rurSalaries.filter(s => s.to).map(s => s.to)

      const statistics = {
        average: avgValues.length > 0 ? Math.round(avgValues.reduce((a, b) => a + b, 0) / avgValues.length) : null,
        min: minValues.length > 0 ? Math.min(...minValues) : null,
        max: maxValues.length > 0 ? Math.max(...maxValues) : null,
        currency: 'RUR'
      }

      res.json({
        success: true,
        data: {
          found: response.data.found || 0,
          withSalary: rurSalaries.length,
          statistics,
          salaries: rurSalaries.slice(0, 20) // Return first 20 for reference
        }
      })
    } catch (error) {
      logger.error('[HH Proxy] Salary statistics error:', error)

      res.status(error.response?.status || 500).json({
        success: false,
        error: error.response?.data?.description || error.message || 'Failed to get salary statistics'
      })
    }
  })

  /**
   * Get areas/regions list
   * GET /api/hh/areas
   * GET /api/hh/areas/:id
   */
  router.get('/areas/:id?', async (req, res) => {
    try {
      const { id } = req.params
      const url = id ? `${HH_API_BASE}/areas/${id}` : `${HH_API_BASE}/areas`

      logger.info('[HH Proxy] Getting areas:', { id: id || 'all' })

      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'DronDoc/1.0 (hive@drondoc.ru)',
          'Accept': 'application/json'
        },
        timeout: 10000
      })

      res.json({
        success: true,
        data: response.data
      })
    } catch (error) {
      logger.error('[HH Proxy] Get areas error:', error)

      res.status(error.response?.status || 500).json({
        success: false,
        error: error.response?.data?.description || error.message || 'Failed to get areas'
      })
    }
  })

  logger.info('[HH Proxy] Routes registered: /vacancies, /employers, /vacancies/:id, /salary-statistics, /areas')

  return router
}
