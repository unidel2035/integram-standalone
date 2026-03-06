/**
 * Telegram Public API Service
 * Получение публичной информации о каналах без токена
 * Используется для получения базовой статистики без прав администратора
 */

import axios from 'axios'

class TelegramPublicApiService {
  constructor() {
    this.client = axios.create({
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json'
      }
    })

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      response => response,
      error => {
        console.error('Telegram Public API Error:', error.response?.data || error.message)
        return Promise.reject(error)
      }
    )
  }

  /**
   * Получить информацию о публичном канале
   * Использует метод парсинга публичных метаданных
   * @param {string} username - Username канала (с @ или без)
   * @returns {Promise} Информация о канале
   */
  async getPublicChannelInfo(username) {
    try {
      const cleanUsername = username.replace('@', '')
      const url = `https://t.me/${cleanUsername}`

      // В production окружении используйте прокси для избежания CORS
      // Для разработки можно использовать CORS-прокси
      const response = await this.fetchWithCORS(url)
      const html = response.data

      // Парсинг Open Graph метаданных из HTML
      const metadata = this.parseMetadata(html)

      return {
        success: true,
        response: {
          username: cleanUsername,
          title: metadata.title || '',
          description: metadata.description || '',
          subscribers: this.parseSubscribers(metadata.description),
          image: metadata.image || '',
          url: url,
          type: 'channel',
          method: 'public_parsing'
        }
      }
    } catch (error) {
      throw this.handleError(error)
    }
  }

  /**
   * Получить базовую статистику канала (алиас для совместимости)
   * @param {string} username - Username канала
   * @returns {Promise} Статистика канала
   */
  async getChannelStats(username) {
    return this.getPublicChannelInfo(username)
  }

  /**
   * Fetch URL with CORS handling
   * В production используйте backend прокси
   * @param {string} url - URL для загрузки
   * @returns {Promise} Response data
   */
  async fetchWithCORS(url) {
    try {
      // Попытка использовать backend прокси если доступен
      if (this.isProxyAvailable()) {
        const backendUrl = this.getBackendURL()
        return await this.client.get(`${backendUrl}/api/telegram-preview`, {
          params: { url }
        })
      }

      // Fallback: прямой запрос (может не работать из-за CORS)
      return await this.client.get(url)
    } catch (error) {
      // Fallback: используем публичный CORS proxy (только для разработки!)
      const corsProxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`
      return await this.client.get(corsProxyUrl)
    }
  }

  /**
   * Get backend URL from environment variables
   * @returns {string} Backend URL
   */
  getBackendURL() {
    // If VITE_ORCHESTRATOR_URL is set, use it directly
    if (import.meta.env.VITE_ORCHESTRATOR_URL) {
      return import.meta.env.VITE_ORCHESTRATOR_URL
    }

    // Otherwise, construct from individual components
    const protocol = import.meta.env.VITE_BACKEND_PROTOCOL || 'https'
    const host = import.meta.env.VITE_BACKEND_HOST || 'drondoc.ru'
    const port = import.meta.env.VITE_BACKEND_PORT || '8081'

    return `${protocol}://${host}:${port}`
  }

  /**
   * Проверка доступности backend прокси
   * @returns {boolean} Доступен ли прокси
   */
  isProxyAvailable() {
    // Проверяем наличие API endpoint
    // В production это должно быть настроено в backend
    return typeof window !== 'undefined' && window.location.host !== 'localhost:5173'
  }

  /**
   * Парсинг метаданных из HTML
   * @param {string} html - HTML контент
   * @returns {Object} Извлечённые метаданные
   */
  parseMetadata(html) {
    const metadata = {
      title: '',
      description: '',
      image: ''
    }

    try {
      // Извлечение Open Graph тегов
      const ogTitleMatch = html.match(/<meta property="og:title" content="([^"]+)"/)
      const ogDescMatch = html.match(/<meta property="og:description" content="([^"]+)"/)
      const ogImageMatch = html.match(/<meta property="og:image" content="([^"]+)"/)

      metadata.title = ogTitleMatch ? this.decodeHtmlEntities(ogTitleMatch[1]) : ''
      metadata.description = ogDescMatch ? this.decodeHtmlEntities(ogDescMatch[1]) : ''
      metadata.image = ogImageMatch ? ogImageMatch[1] : ''

      // Fallback: стандартные meta теги
      if (!metadata.title) {
        const titleMatch = html.match(/<title>([^<]+)<\/title>/)
        metadata.title = titleMatch ? this.decodeHtmlEntities(titleMatch[1]) : ''
      }

      if (!metadata.description) {
        const descMatch = html.match(/<meta name="description" content="([^"]+)"/)
        metadata.description = descMatch ? this.decodeHtmlEntities(descMatch[1]) : ''
      }
    } catch (error) {
      console.error('Error parsing metadata:', error)
    }

    return metadata
  }

  /**
   * Декодирование HTML entities
   * @param {string} text - Текст с HTML entities
   * @returns {string} Декодированный текст
   */
  decodeHtmlEntities(text) {
    const textarea = document.createElement('textarea')
    textarea.innerHTML = text
    return textarea.value
  }

  /**
   * Парсинг количества подписчиков из текста
   * @param {string} text - Текст описания
   * @returns {number} Количество подписчиков
   */
  parseSubscribers(text) {
    if (!text) return 0

    try {
      // Паттерны для поиска количества подписчиков
      const patterns = [
        /(\d+(?:\s*\d+)*)\s*(?:subscriber|подписчик)/i,
        /(\d+(?:\.\d+)?)\s*([KMB])\s*(?:subscriber|подписчик)/i,
        /(\d+)\s+members?/i
      ]

      for (const pattern of patterns) {
        const match = text.match(pattern)
        if (match) {
          let number = match[1].replace(/\s/g, '')

          // Конвертация сокращений (K, M, B)
          if (match[2]) {
            const multipliers = { K: 1000, M: 1000000, B: 1000000000 }
            number = parseFloat(number) * (multipliers[match[2]] || 1)
          }

          return parseInt(number) || 0
        }
      }
    } catch (error) {
      console.error('Error parsing subscribers:', error)
    }

    return 0
  }

  /**
   * Получить превью постов из публичного канала
   * Ограниченная функциональность - только для публичных каналов
   * @param {string} username - Username канала
   * @param {number} limit - Количество постов (по умолчанию 10)
   * @returns {Promise} Список постов
   */
  async getPublicPosts(username, limit = 10) {
    try {
      const cleanUsername = username.replace('@', '')
      // Используем веб-версию с embed для парсинга
      const url = `https://t.me/s/${cleanUsername}`

      const response = await this.fetchWithCORS(url)
      const html = response.data

      const posts = this.parsePosts(html, limit)

      return {
        success: true,
        response: {
          posts: posts,
          count: posts.length
        }
      }
    } catch (error) {
      throw this.handleError(error)
    }
  }

  /**
   * Парсинг постов из HTML веб-версии
   * @param {string} html - HTML контент
   * @param {number} limit - Максимальное количество постов
   * @returns {Array} Массив постов
   */
  parsePosts(html, limit) {
    const posts = []

    try {
      // Поиск блоков с постами в HTML
      // Структура может меняться, это базовая реализация
      const postPattern = /<div class="tgme_widget_message[^>]*>([\s\S]*?)<\/div>\s*<\/div>/gi
      let match

      let count = 0
      while ((match = postPattern.exec(html)) !== null && count < limit) {
        const postHtml = match[1]

        // Извлечение текста поста
        const textMatch = postHtml.match(/<div class="tgme_widget_message_text[^>]*>([^<]+)</)
        const text = textMatch ? this.decodeHtmlEntities(textMatch[1]) : ''

        // Извлечение даты
        const dateMatch = postHtml.match(/<time[^>]*datetime="([^"]+)"/)
        const date = dateMatch ? dateMatch[1] : ''

        // Извлечение просмотров
        const viewsMatch = postHtml.match(/<span class="tgme_widget_message_views">([^<]+)</)
        const views = viewsMatch ? this.parseViews(viewsMatch[1]) : 0

        if (text || date) {
          posts.push({
            text: text,
            date: date,
            views: views,
            source: 'web_parsing'
          })
          count++
        }
      }
    } catch (error) {
      console.error('Error parsing posts:', error)
    }

    return posts
  }

  /**
   * Парсинг количества просмотров
   * @param {string} viewsText - Текст с просмотрами
   * @returns {number} Количество просмотров
   */
  parseViews(viewsText) {
    if (!viewsText) return 0

    try {
      // Убираем все нецифровые символы кроме точки
      const cleaned = viewsText.replace(/[^\d.KMB]/gi, '')

      // Конвертация K, M, B
      const multipliers = { K: 1000, M: 1000000, B: 1000000000 }
      for (const [suffix, multiplier] of Object.entries(multipliers)) {
        if (cleaned.includes(suffix)) {
          return parseFloat(cleaned.replace(suffix, '')) * multiplier
        }
      }

      return parseInt(cleaned) || 0
    } catch (error) {
      return 0
    }
  }

  /**
   * Проверка существования публичного канала
   * @param {string} username - Username канала
   * @returns {Promise<boolean>} Существует ли канал
   */
  async checkChannelExists(username) {
    try {
      const info = await this.getPublicChannelInfo(username)
      return info.success && info.response.title !== ''
    } catch (error) {
      return false
    }
  }

  /**
   * Handle API errors
   * @param {Error} error - Error object
   * @returns {Object} Formatted error
   */
  handleError(error) {
    if (error.response) {
      return {
        status: error.response.status,
        message: error.response.data?.error || 'Failed to fetch channel info',
        data: error.response.data
      }
    } else if (error.request) {
      return {
        status: 0,
        message: 'No response from server. Check CORS settings or use proxy.',
        data: null
      }
    } else {
      return {
        status: -1,
        message: error.message,
        data: null
      }
    }
  }
}

export default new TelegramPublicApiService()
