/**
 * DDAdmin Service
 * 
 * Сервис для интеграции с базой данных ddadmin
 * Записывает информацию об использовании токенов ИИ
 * 
 * База данных: https://dronedoc.ru/ddadmin/
 * Объект для записи: 1730 (F_U=285)
 */

import axios from 'axios'
import logger from '../../utils/logger.js'

class DDAdminService {
  constructor() {
    this.baseURL = 'https://dronedoc.ru/ddadmin'
    this.database = 'ddadmin'
    this.token = null
    this.xsrfToken = null
  }

  /**
   * Аутентификация с ddadmin
   */
  async authenticate(username, password) {
    try {
      const authURL = `${this.baseURL}/api/${this.database}/auth`
      
      const formData = new URLSearchParams()
      formData.append('login', username)
      formData.append('pwd', password)

      const response = await axios.post(authURL, formData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      })

      if (response.data.failed) {
        throw new Error('Неверный логин или пароль для ddadmin')
      }

      this.token = response.data.token
      this.xsrfToken = response.data._xsrf

      logger.info('DDAdmin authentication successful')
      return {
        success: true,
        token: this.token,
        xsrf: this.xsrfToken
      }
    } catch (error) {
      logger.error('DDAdmin authentication failed', { error: error.message })
      throw new Error(error.response?.data?.message || error.message || 'DDAdmin authentication error')
    }
  }

  /**
   * Записать использование токена в базу данных
   */
  async recordTokenUsage(usageData) {
    try {
      if (!this.token || !this.xsrfToken) {
        throw new Error('DDAdmin not authenticated')
      }

      const url = `${this.baseURL}/${this.database}/_m_new/1730`
      
      const formData = new URLSearchParams()
      formData.append('_xsrf', this.xsrfToken)

      // Поля для записи (F_U=285 означает поле 285)
      formData.append('t285', usageData.userId || '') // User ID
      formData.append('t286', usageData.tokenId || '') // Token ID
      formData.append('t287', usageData.model || '') // Model used
      formData.append('t288', usageData.operation || '') // Operation type
      formData.append('t289', usageData.prompt || '') // Prompt
      formData.append('t290', usageData.response || '') // Response
      formData.append('t291', usageData.promptTokens || 0) // Prompt tokens
      formData.append('t292', usageData.completionTokens || 0) // Completion tokens
      formData.append('t293', usageData.totalTokens || 0) // Total tokens
      formData.append('t294', usageData.cost || 0) // Cost
      formData.append('t295', usageData.application || '') // Application name
      formData.append('t296', usageData.timestamp || new Date().toISOString()) // Timestamp

      const response = await axios.post(url, formData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Authorization': this.token
        }
      })

      logger.info('Token usage recorded to ddadmin', {
        tokenId: usageData.tokenId,
        model: usageData.model,
        totalTokens: usageData.totalTokens
      })

      return {
        success: true,
        recordId: response.data.id || null,
        message: 'Usage recorded successfully'
      }
    } catch (error) {
      logger.error('Failed to record token usage to ddadmin', {
        error: error.message,
        tokenId: usageData.tokenId
      })

      return {
        success: false,
        error: error.message || 'Failed to record usage'
      }
    }
  }

  /**
   * Получить статистику использования токенов
   */
  async getTokenUsageStats(filters = {}) {
    try {
      if (!this.token || !this.xsrfToken) {
        throw new Error('DDAdmin not authenticated')
      }

      const params = {
        id: 1730,
        ...filters
      }

      const url = `${this.baseURL}/${this.database}/object/1730`
      
      const response = await axios.get(url, {
        params,
        headers: {
          'X-Authorization': this.token
        }
      })

      return {
        success: true,
        data: response.data
      }
    } catch (error) {
      logger.error('Failed to get token usage stats from ddadmin', {
        error: error.message
      })

      return {
        success: false,
        error: error.message || 'Failed to get usage stats'
      }
    }
  }

  /**
   * Записать информацию о модели в базу
   */
  async recordModelInfo(modelData) {
    try {
      if (!this.token || !this.xsrfToken) {
        throw new Error('DDAdmin not authenticated')
      }

      // Создаем запись в таблице моделей (предполагаем тип 1731 для моделей)
      const url = `${this.baseURL}/${this.database}/_m_new/1731`
      
      const formData = new URLSearchParams()
      formData.append('_xsrf', this.xsrfToken)

      // Поля для информации о модели
      formData.append('t300', modelData.modelId || '') // Model ID
      formData.append('t301', modelData.name || '') // Model name
      formData.append('t302', modelData.provider || '') // Provider
      formData.append('t303', modelData.contextLength || 0) // Context length
      formData.append('t304', modelData.costPer1kTokens || 0) // Cost per 1K tokens
      formData.append('t305', modelData.enabled || true) // Enabled status
      formData.append('t306', modelData.description || '') // Description

      const response = await axios.post(url, formData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Authorization': this.token
        }
      })

      logger.info('Model info recorded to ddadmin', {
        modelId: modelData.modelId,
        provider: modelData.provider
      })

      return {
        success: true,
        recordId: response.data.id || null,
        message: 'Model info recorded successfully'
      }
    } catch (error) {
      logger.error('Failed to record model info to ddadmin', {
        error: error.message,
        modelId: modelData.modelId
      })

      return {
        success: false,
        error: error.message || 'Failed to record model info'
      }
    }
  }

  /**
   * Очистить токены аутентификации
   */
  clearAuth() {
    this.token = null
    this.xsrfToken = null
    logger.info('DDAdmin tokens cleared')
  }

  /**
   * Проверить состояние аутентификации
   */
  isAuthenticated() {
    return !!(this.token && this.xsrfToken)
  }
}

// Экспортируем singleton instance
export default new DDAdminService()