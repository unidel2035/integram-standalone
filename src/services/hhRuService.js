import axios from 'axios'

/**
 * HeadHunter (hh.ru) API Service
 *
 * Provides methods to search vacancies and calculate average salaries
 * for specific job functions in different regions.
 *
 * Uses backend proxy at /api/hh to avoid CORS and User-Agent issues.
 * Backend forwards requests to https://api.hh.ru
 *
 * API Documentation: https://github.com/hhru/api
 */

const HH_API_BASE_URL = '/api/hh'

/**
 * Region codes for major Russian cities and areas
 * Full list: https://api.hh.ru/areas
 */
export const HH_REGIONS = {
  RUSSIA: 113,
  MOSCOW: 1,
  SAINT_PETERSBURG: 2,
  MOSCOW_OBLAST: 2019,
  EKATERINBURG: 3,
  NOVOSIBIRSK: 4,
  KAZAN: 88,
  NIZHNY_NOVGOROD: 66,
  CHELYABINSK: 96,
  SAMARA: 78,
  ROSTOV_ON_DON: 76,
  UFA: 99,
  KRASNOYARSK: 73,
  VORONEZH: 193,
  PERM: 48,
  VOLGOGRAD: 24
}

/**
 * HH.ru Service Class
 */
class HHRuService {
  constructor() {
    this.apiClient = axios.create({
      baseURL: HH_API_BASE_URL,
      timeout: 15000,
      headers: {
        'Accept': 'application/json'
      }
    })

    // Response interceptor for error handling
    this.apiClient.interceptors.response.use(
      (response) => response,
      (error) => {
        console.error('HH.ru API Error:', error)
        return Promise.reject(this.formatError(error))
      }
    )
  }

  /**
   * Format API errors
   */
  formatError(error) {
    if (error.response) {
      const status = error.response.status
      const data = error.response.data

      switch (status) {
        case 400:
          return new Error('Invalid request parameters')
        case 403:
          return new Error('Access forbidden (rate limit or blocked)')
        case 404:
          return new Error('Resource not found')
        case 429:
          return new Error('Too many requests. Please try again later')
        case 500:
          return new Error('hh.ru server error. Please try again later')
        default:
          return new Error(data?.errors?.[0]?.value || `API error: ${status}`)
      }
    } else if (error.request) {
      return new Error('No response from hh.ru API')
    } else {
      return new Error(error.message || 'Unexpected error')
    }
  }

  /**
   * Search vacancies by text and region
   *
   * @param {Object} params - Search parameters
   * @param {string} params.text - Search query (job function description)
   * @param {number} params.area - Region code
   * @param {number} params.perPage - Results per page (max 100)
   * @param {number} params.page - Page number
   * @param {boolean} params.onlyWithSalary - Only vacancies with salary info
   * @returns {Promise<Object>} Search results
   */
  async searchVacancies({
    text,
    area = HH_REGIONS.RUSSIA,
    perPage = 100,
    page = 0,
    onlyWithSalary = true
  }) {
    try {
      const response = await this.apiClient.get('/vacancies', {
        params: {
          text,
          area,
          per_page: perPage,
          page,
          only_with_salary: onlyWithSalary
        }
      })

      // Backend proxy returns { success, data } where data is HH.ru API response
      const hhData = response.data.data || response.data

      return {
        success: true,
        data: hhData,
        items: hhData.items || [],
        found: hhData.found || 0,
        pages: hhData.pages || 0,
        perPage: hhData.per_page || perPage,
        page: hhData.page || page
      }
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || error.message,
        data: null,
        items: [],
        found: 0
      }
    }
  }

  /**
   * Get vacancy details by ID
   *
   * @param {string} vacancyId - Vacancy ID
   * @returns {Promise<Object>} Vacancy details
   */
  async getVacancyById(vacancyId) {
    try {
      const response = await this.apiClient.get(`/vacancies/${vacancyId}`)
      const hhData = response.data.data || response.data
      return {
        success: true,
        data: hhData
      }
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || error.message,
        data: null
      }
    }
  }

  /**
   * Get list of regions/areas
   *
   * @param {number} parentId - Parent area ID (optional)
   * @returns {Promise<Object>} Areas list
   */
  async getAreas(parentId = null) {
    try {
      const url = parentId ? `/areas/${parentId}` : '/areas'
      const response = await this.apiClient.get(url)
      const hhData = response.data.data || response.data
      return {
        success: true,
        data: hhData
      }
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || error.message,
        data: null
      }
    }
  }

  /**
   * Find region ID by name
   *
   * @param {string} regionName - Region name to search
   * @returns {Promise<number|null>} Region ID or null
   */
  async findRegionByName(regionName) {
    try {
      const areasResult = await this.getAreas()
      if (!areasResult.success) return null

      const searchLower = regionName.toLowerCase()

      // Recursive search in areas tree
      const findInAreas = (areas) => {
        for (const area of areas) {
          if (area.name.toLowerCase().includes(searchLower)) {
            return area.id
          }
          if (area.areas && area.areas.length > 0) {
            const found = findInAreas(area.areas)
            if (found) return found
          }
        }
        return null
      }

      return findInAreas(areasResult.data)
    } catch (error) {
      console.error('Error finding region:', error)
      return null
    }
  }

  /**
   * Calculate average salary from vacancy search results
   *
   * @param {Array} vacancies - Array of vacancy objects from search
   * @returns {Object} Salary statistics
   */
  calculateSalaryStats(vacancies) {
    if (!vacancies || vacancies.length === 0) {
      return {
        average: 0,
        median: 0,
        min: 0,
        max: 0,
        count: 0,
        currency: 'RUR'
      }
    }

    const salaries = []
    let minSalary = Infinity
    let maxSalary = 0
    let currency = 'RUR'

    for (const vacancy of vacancies) {
      if (!vacancy.salary) continue

      const { from, to, currency: curr } = vacancy.salary
      currency = curr || currency

      // Calculate average for this vacancy
      let salaryValue
      if (from && to) {
        salaryValue = (from + to) / 2
      } else if (from) {
        salaryValue = from
      } else if (to) {
        salaryValue = to
      } else {
        continue
      }

      salaries.push(salaryValue)

      // Track min/max
      if (from && from < minSalary) minSalary = from
      if (to && to > maxSalary) maxSalary = to
    }

    if (salaries.length === 0) {
      return {
        average: 0,
        median: 0,
        min: 0,
        max: 0,
        count: 0,
        currency
      }
    }

    // Calculate average
    const average = Math.round(
      salaries.reduce((sum, val) => sum + val, 0) / salaries.length
    )

    // Calculate median
    const sorted = [...salaries].sort((a, b) => a - b)
    const mid = Math.floor(sorted.length / 2)
    const median = sorted.length % 2 === 0
      ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
      : sorted[mid]

    return {
      average,
      median,
      min: minSalary === Infinity ? 0 : minSalary,
      max: maxSalary,
      count: salaries.length,
      currency,
      totalVacancies: vacancies.length,
      withSalary: salaries.length
    }
  }

  /**
   * Estimate salary for a job function in a specific region
   * Main method combining search and salary calculation
   *
   * @param {Object} params - Parameters
   * @param {string} params.functionDescription - Job function description
   * @param {string|number} params.region - Region name or ID
   * @param {number} params.maxResults - Maximum number of vacancies to analyze (default 100)
   * @returns {Promise<Object>} Salary estimate with statistics
   */
  async estimateSalary({
    functionDescription,
    region = HH_REGIONS.RUSSIA,
    maxResults = 100
  }) {
    try {
      // If region is a string, try to find region ID
      let areaId = region
      if (typeof region === 'string') {
        const foundId = await this.findRegionByName(region)
        areaId = foundId || HH_REGIONS.RUSSIA
      }

      // Search vacancies
      const searchResult = await this.searchVacancies({
        text: functionDescription,
        area: areaId,
        perPage: Math.min(maxResults, 100),
        onlyWithSalary: true
      })

      if (!searchResult.success) {
        throw new Error(searchResult.error)
      }

      // Calculate salary statistics
      const salaryStats = this.calculateSalaryStats(searchResult.items)

      return {
        success: true,
        data: {
          ...salaryStats,
          query: {
            functionDescription,
            region: areaId,
            regionName: region
          },
          source: 'hh.ru',
          timestamp: new Date().toISOString()
        }
      }
    } catch (error) {
      console.error('Error estimating salary:', error)
      return {
        success: false,
        error: error.message,
        data: null
      }
    }
  }

  /**
   * Calculate monthly costs including salary and taxes
   * Based on Russian tax system:
   * - Employee gross salary
   * - Employer contributions: ~30.2% (ПФР 22%, ОМС 5.1%, ФСС 2.9%, etc.)
   * - NDFL (13%) is already included in gross salary
   *
   * @param {number} grossSalary - Gross monthly salary
   * @param {number} employeeCount - Number of employees
   * @returns {Object} Cost breakdown
   */
  calculateTotalCosts(grossSalary, employeeCount = 1) {
    const totalGrossSalary = grossSalary * employeeCount

    // Employer contributions (отчисления работодателя)
    const employerTaxRate = 0.302 // 30.2%
    const employerTaxes = Math.round(totalGrossSalary * employerTaxRate)

    // Total monthly costs
    const totalCosts = totalGrossSalary + employerTaxes

    return {
      grossSalary: totalGrossSalary,
      employeeCount,
      salaryPerEmployee: grossSalary,
      employerTaxes,
      employerTaxRate: '30.2%',
      totalMonthlyCosts: totalCosts,
      taxBreakdown: {
        pensionFund: Math.round(totalGrossSalary * 0.22), // ПФР 22%
        medicalInsurance: Math.round(totalGrossSalary * 0.051), // ОМС 5.1%
        socialInsurance: Math.round(totalGrossSalary * 0.029), // ФСС 2.9%
        injuryInsurance: Math.round(totalGrossSalary * 0.002) // ФСС НС 0.2% (примерно)
      }
    }
  }
}

// Export singleton instance
export const hhRuService = new HHRuService()

// Export class for testing/customization
export default HHRuService
