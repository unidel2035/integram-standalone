/**
 * Proxy HTTP Client
 *
 * HTTP-клиент с поддержкой SOCKS5 прокси для парсеров и других сервисов.
 * Автоматически использует SSH туннель если он доступен.
 *
 * @example
 * import { ProxyHttpClient } from './ProxyHttpClient.js'
 *
 * const client = new ProxyHttpClient()
 *
 * // GET запрос через прокси
 * const response = await client.get('https://example.com')
 *
 * // POST запрос через прокси
 * const data = await client.post('https://api.example.com/data', { foo: 'bar' })
 *
 * // Без прокси
 * const direct = await client.get('https://example.com', { useProxy: false })
 */

import axios from 'axios'
import { SocksProxyAgent } from 'socks-proxy-agent'
import { getDefaultTunnel } from './SSHTunnelService.js'

export class ProxyHttpClient {
  /**
   * @param {Object} config - Конфигурация клиента
   * @param {string} config.proxyUrl - URL SOCKS5 прокси (по умолчанию из туннеля)
   * @param {number} config.timeout - Таймаут запросов в мс (по умолчанию 30000)
   * @param {Object} config.headers - Дефолтные заголовки
   * @param {boolean} config.useProxyByDefault - Использовать прокси по умолчанию (по умолчанию true)
   */
  constructor(config = {}) {
    this.config = {
      timeout: 30000,
      useProxyByDefault: false, // ПО УМОЛЧАНИЮ ПРОКСИ ВЫКЛЮЧЕН
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      ...config
    }

    // Паттерны для определения когда НЕ нужен прокси
    this.aiDomains = [
      'api.openai.com',
      'api.anthropic.com',
      'generativelanguage.googleapis.com',
      'api.deepseek.com',
      'api.cohere.ai',
      'api.together.xyz'
    ]

    // Паттерны российских доменов (.ru, .рф и другие)
    this.russianDomainPatterns = [
      /\.ru$/i,
      /\.xn--p1ai$/i, // .рф в punycode (например: https://xn--80aswg.xn--p1ai/)
      /\.рф$/i,       // .рф в кириллице
      /\.su$/i
    ]

    // Получаем URL прокси из туннеля если не указан
    if (!this.config.proxyUrl) {
      const tunnel = getDefaultTunnel()
      this.config.proxyUrl = tunnel.getProxyUrl()
    }

    this.proxyAgent = null
    this._initProxyAgent()
  }

  /**
   * Инициализация SOCKS5 агента
   * @private
   */
  _initProxyAgent() {
    try {
      this.proxyAgent = new SocksProxyAgent(this.config.proxyUrl)
      console.log(`[ProxyHttpClient] SOCKS5 агент инициализирован: ${this.config.proxyUrl}`)
    } catch (error) {
      console.error('[ProxyHttpClient] Ошибка инициализации прокси агента:', error)
    }
  }

  /**
   * Определить, нужен ли прокси для данного URL
   * @param {string} url - URL для проверки
   * @returns {boolean}
   * @private
   */
  _shouldUseProxy(url) {
    try {
      const urlObj = new URL(url)
      const hostname = urlObj.hostname.toLowerCase()

      // 1. НИКОГДА не использовать прокси для AI сервисов
      if (this.aiDomains.some(domain => hostname === domain || hostname.endsWith('.' + domain))) {
        console.log(`[ProxyHttpClient] AI домен ${hostname} - прокси НЕ используется`)
        return false
      }

      // 2. Локальные адреса
      if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.startsWith('192.168.')) {
        return false
      }

      // 3. Российские домены - использовать прокси
      if (this.russianDomainPatterns.some(pattern => pattern.test(hostname))) {
        console.log(`[ProxyHttpClient] Российский домен ${hostname} - используем прокси`)
        return true
      }

      // 4. По умолчанию - без прокси
      return false
    } catch (error) {
      console.error('[ProxyHttpClient] Ошибка парсинга URL:', error.message)
      return false
    }
  }

  /**
   * Создать конфигурацию axios с прокси
   * @private
   */
  _createAxiosConfig(url, options = {}) {
    // Автоматическое определение нужен ли прокси
    let useProxy
    if (options.useProxy !== undefined) {
      // Явно указано в опциях
      useProxy = options.useProxy
    } else if (options.autoDetectProxy !== false) {
      // Автоопределение (по умолчанию включено)
      useProxy = this._shouldUseProxy(url)
    } else {
      // Использовать дефолтную настройку
      useProxy = this.config.useProxyByDefault
    }

    const config = {
      timeout: options.timeout || this.config.timeout,
      headers: {
        ...this.config.headers,
        ...options.headers
      },
      ...options
    }

    // Добавляем прокси агент если нужно
    if (useProxy && this.proxyAgent) {
      config.httpAgent = this.proxyAgent
      config.httpsAgent = this.proxyAgent
    }

    // Удаляем наши кастомные флаги
    delete config.useProxy
    delete config.autoDetectProxy

    return config
  }

  /**
   * GET запрос
   * @param {string} url - URL для запроса
   * @param {Object} options - Опции axios + useProxy/autoDetectProxy флаги
   * @returns {Promise<any>}
   */
  async get(url, options = {}) {
    try {
      const config = this._createAxiosConfig(url, options)

      const response = await axios.get(url, config)
      return response.data
    } catch (error) {
      console.error(`[ProxyHttpClient] Ошибка GET ${url}:`, error.message)
      throw error
    }
  }

  /**
   * POST запрос
   * @param {string} url - URL для запроса
   * @param {Object} data - Данные для отправки
   * @param {Object} options - Опции axios + useProxy/autoDetectProxy флаги
   * @returns {Promise<any>}
   */
  async post(url, data, options = {}) {
    try {
      const config = this._createAxiosConfig(url, options)

      const response = await axios.post(url, data, config)
      return response.data
    } catch (error) {
      console.error(`[ProxyHttpClient] Ошибка POST ${url}:`, error.message)
      throw error
    }
  }

  /**
   * PUT запрос
   * @param {string} url - URL для запроса
   * @param {Object} data - Данные для отправки
   * @param {Object} options - Опции axios + useProxy/autoDetectProxy флаги
   * @returns {Promise<any>}
   */
  async put(url, data, options = {}) {
    try {
      const config = this._createAxiosConfig(url, options)

      const response = await axios.put(url, data, config)
      return response.data
    } catch (error) {
      console.error(`[ProxyHttpClient] Ошибка PUT ${url}:`, error.message)
      throw error
    }
  }

  /**
   * DELETE запрос
   * @param {string} url - URL для запроса
   * @param {Object} options - Опции axios + useProxy/autoDetectProxy флаги
   * @returns {Promise<any>}
   */
  async delete(url, options = {}) {
    try {
      const config = this._createAxiosConfig(url, options)

      const response = await axios.delete(url, config)
      return response.data
    } catch (error) {
      console.error(`[ProxyHttpClient] Ошибка DELETE ${url}:`, error.message)
      throw error
    }
  }

  /**
   * Полный контроль через axios.request
   * @param {Object} requestConfig - Полная конфигурация axios
   * @returns {Promise<any>}
   */
  async request(requestConfig) {
    try {
      const url = requestConfig.url
      const axiosConfig = this._createAxiosConfig(url, requestConfig)

      const response = await axios.request(axiosConfig)
      return response.data
    } catch (error) {
      console.error(`[ProxyHttpClient] Ошибка запроса ${requestConfig.url}:`, error.message)
      throw error
    }
  }

  /**
   * Получить полный response объект (не только data)
   * @param {string} url - URL для запроса
   * @param {Object} options - Опции axios + useProxy/autoDetectProxy флаги
   * @returns {Promise<AxiosResponse>}
   */
  async getResponse(url, options = {}) {
    try {
      const config = this._createAxiosConfig(url, options)

      return await axios.get(url, config)
    } catch (error) {
      console.error(`[ProxyHttpClient] Ошибка GET ${url}:`, error.message)
      throw error
    }
  }

  /**
   * Скачать файл
   * @param {string} url - URL файла
   * @param {Object} options - Опции axios + useProxy/autoDetectProxy флаги
   * @returns {Promise<Buffer>}
   */
  async downloadFile(url, options = {}) {
    try {
      const config = this._createAxiosConfig(url, {
        ...options,
        responseType: 'arraybuffer'
      })

      const response = await axios.get(url, config)
      return Buffer.from(response.data)
    } catch (error) {
      console.error(`[ProxyHttpClient] Ошибка скачивания ${url}:`, error.message)
      throw error
    }
  }

  /**
   * Получить HTML страницы
   * @param {string} url - URL страницы
   * @param {Object} options - Опции axios + useProxy/autoDetectProxy флаги
   * @returns {Promise<string>}
   */
  async fetchHtml(url, options = {}) {
    try {
      const config = this._createAxiosConfig(url, {
        ...options,
        responseType: 'text'
      })

      const response = await axios.get(url, config)
      return response.data
    } catch (error) {
      console.error(`[ProxyHttpClient] Ошибка загрузки HTML ${url}:`, error.message)
      throw error
    }
  }

  /**
   * Получить JSON
   * @param {string} url - URL API
   * @param {Object} options - Опции axios + useProxy/autoDetectProxy флаги
   * @returns {Promise<Object>}
   */
  async fetchJson(url, options = {}) {
    try {
      const config = this._createAxiosConfig(url, {
        ...options,
        headers: {
          ...options.headers,
          'Accept': 'application/json'
        }
      })

      const response = await axios.get(url, config)
      return response.data
    } catch (error) {
      console.error(`[ProxyHttpClient] Ошибка загрузки JSON ${url}:`, error.message)
      throw error
    }
  }

  /**
   * Проверить доступность URL
   * @param {string} url - URL для проверки
   * @param {Object} options - Опции + useProxy/autoDetectProxy флаги
   * @returns {Promise<boolean>}
   */
  async isReachable(url, options = {}) {
    try {
      const config = this._createAxiosConfig(url, {
        ...options,
        method: 'HEAD',
        timeout: options.timeout || 5000
      })

      await axios.head(url, config)
      return true
    } catch (error) {
      return false
    }
  }

  /**
   * Получить информацию о прокси
   * @returns {Object}
   */
  getProxyInfo() {
    return {
      url: this.config.proxyUrl,
      enabled: this.config.useProxyByDefault,
      agent: this.proxyAgent ? 'initialized' : 'not initialized'
    }
  }
}

// Singleton instance для использования по умолчанию
let defaultClientInstance = null

/**
 * Получить инстанс клиента по умолчанию
 * @returns {ProxyHttpClient}
 */
export function getDefaultClient() {
  if (!defaultClientInstance) {
    defaultClientInstance = new ProxyHttpClient()
  }
  return defaultClientInstance
}

/**
 * Создать новый клиент с custom настройками
 * @param {Object} config - Конфигурация клиента
 * @returns {ProxyHttpClient}
 */
export function createClient(config) {
  return new ProxyHttpClient(config)
}
