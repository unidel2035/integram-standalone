/**
 * Torgi Proxy Client
 *
 * Клиент для работы с прокси-сервером torgi.gov.ru
 * Используется когда прямой доступ к torgi.gov.ru заблокирован
 *
 * Issue #4594: Решение проблемы блокировки IP
 */

import axios from 'axios'

export class TorgiProxyClient {
  /**
   * @param {string} proxyUrl - URL прокси сервера (напр. http://vps-ip:3333)
   * @param {string} apiKey - API ключ для авторизации
   */
  constructor(proxyUrl, apiKey) {
    this.proxyUrl = proxyUrl.replace(/\/$/, '')
    this.apiKey = apiKey
    this.timeout = 60000
  }

  /**
   * Make request to proxy server
   */
  async request(endpoint, options = {}) {
    const url = `${this.proxyUrl}${endpoint}`

    try {
      const response = await axios({
        url,
        method: options.method || 'GET',
        data: options.data,
        params: options.params,
        headers: {
          'X-API-Key': this.apiKey,
          'Content-Type': 'application/json',
          ...options.headers
        },
        timeout: this.timeout
      })

      return response.data
    } catch (error) {
      if (error.response?.data) {
        throw new Error(error.response.data.error || 'Proxy request failed')
      }
      throw error
    }
  }

  /**
   * Get lot card data
   * @param {string} lotId - ID лота (напр. 22000037040000000056_5)
   * @returns {Promise<Object>} Данные лота
   */
  async getLotCard(lotId) {
    const result = await this.request(`/api/lotcard/${lotId}`)

    if (!result.success) {
      throw new Error(result.error || 'Failed to get lot card')
    }

    return result.data
  }

  /**
   * Get lot documents
   * @param {string} lotId - ID лота
   * @returns {Promise<Array>} Список документов
   */
  async getLotDocuments(lotId) {
    const result = await this.request(`/api/lotcard/${lotId}/documents`)

    if (!result.success) {
      return []
    }

    return Array.isArray(result.data) ? result.data : []
  }

  /**
   * Search lots
   * @param {Object} searchParams - Параметры поиска
   * @returns {Promise<Object>} Результаты поиска
   */
  async searchLots(searchParams) {
    const result = await this.request('/api/search', {
      method: 'POST',
      data: searchParams
    })

    if (!result.success) {
      throw new Error(result.error || 'Search failed')
    }

    return result.data
  }

  /**
   * Generic proxy request to any torgi.gov.ru URL
   * @param {string} url - Full URL на torgi.gov.ru
   * @param {Object} options - Опции запроса
   * @returns {Promise<Object>} Response data
   */
  async proxyRequest(url, options = {}) {
    const result = await this.request('/api/proxy', {
      method: 'POST',
      data: {
        url,
        method: options.method || 'GET',
        data: options.data,
        headers: options.headers
      }
    })

    if (!result.success) {
      throw new Error(result.error || 'Proxy request failed')
    }

    return result.data
  }

  /**
   * Check proxy server health
   * @returns {Promise<boolean>}
   */
  async checkHealth() {
    try {
      const response = await axios.get(`${this.proxyUrl}/health`, {
        timeout: 5000
      })
      return response.data?.status === 'ok'
    } catch {
      return false
    }
  }
}

export default TorgiProxyClient
