/**
 * Group Parser Bot API Service
 *
 * Service для взаимодействия с Group Parser Bot API
 * Manages Telegram group message parsing
 *
 * Note: XLSX is dynamically imported only when needed (Issue #4324)
 */

import { getApiUrl } from '../utils/apiConfig'

const API_BASE_URL = getApiUrl('/api/group-parser')

/**
 * Lazy load XLSX library
 * @returns {Promise<Object>} XLSX module
 */
async function loadXLSX() {
  return await import('xlsx')
}

/**
 * Test bot connection
 * @param {string} botToken - Telegram bot token
 * @returns {Promise<Object>} Connection test result
 */
export const groupParserService = {
  async testConnection(botToken) {
    try {
      const response = await fetch(`${API_BASE_URL}/test-connection`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ bot_token: botToken })
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: `HTTP ${response.status}` }))
        throw new Error(error.error || error.detail || 'Failed to test connection')
      }

      return response.json()
    } catch (error) {
      console.error('Test connection error:', error)

      // Provide user-friendly error messages for common connection issues
      if (error.name === 'TypeError' && error.message === 'Failed to fetch') {
        throw new Error(
          `Не удалось подключиться к серверу (${API_BASE_URL}). ` +
          `Возможно, бэкенд-сервис не запущен или недоступен. ` +
          `Проверьте, что orchestrator работает на ${API_BASE_URL.replace('/api/group-parser', '')}`
        )
      }

      throw error
    }
  },

  /**
   * Get list of groups where bot is admin
   * @param {string} botToken - Telegram bot token
   * @returns {Promise<Object>} List of groups
   */
  async getGroups(botToken) {
    try {
      const response = await fetch(`${API_BASE_URL}/groups`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ bot_token: botToken })
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: `HTTP ${response.status}` }))
        throw new Error(error.error || error.detail || 'Failed to get groups')
      }

      return response.json()
    } catch (error) {
      console.error('Get groups error:', error)

      // Provide user-friendly error messages for common connection issues
      if (error.name === 'TypeError' && error.message === 'Failed to fetch') {
        throw new Error(
          `Не удалось подключиться к серверу (${API_BASE_URL}). ` +
          `Возможно, бэкенд-сервис не запущен или недоступен. ` +
          `Проверьте, что orchestrator работает на ${API_BASE_URL.replace('/api/group-parser', '')}`
        )
      }

      throw error
    }
  },

  /**
   * Parse messages from a group
   * @param {string} botToken - Telegram bot token
   * @param {string|number} chatId - Chat ID to parse
   * @returns {Promise<Object>} Parsing result
   */
  async parseMessages(botToken, chatId) {
    try {
      const response = await fetch(`${API_BASE_URL}/parse`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          bot_token: botToken,
          chat_id: chatId
        })
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: `HTTP ${response.status}` }))
        throw new Error(error.error || error.detail || 'Failed to parse messages')
      }

      return response.json()
    } catch (error) {
      console.error('Parse messages error:', error)

      // Provide user-friendly error messages for common connection issues
      if (error.name === 'TypeError' && error.message === 'Failed to fetch') {
        throw new Error(
          `Не удалось подключиться к серверу (${API_BASE_URL}). ` +
          `Возможно, бэкенд-сервис не запущен или недоступен. ` +
          `Проверьте, что orchestrator работает на ${API_BASE_URL.replace('/api/group-parser', '')}`
        )
      }

      throw error
    }
  },

  /**
   * Get parsed messages from a group
   * @param {string} botToken - Telegram bot token
   * @param {string|number} chatId - Chat ID
   * @returns {Promise<Object>} Messages data
   */
  async getMessages(botToken, chatId) {
    try {
      const response = await fetch(`${API_BASE_URL}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          bot_token: botToken,
          chat_id: chatId
        })
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: `HTTP ${response.status}` }))
        throw new Error(error.error || error.detail || 'Failed to get messages')
      }

      return response.json()
    } catch (error) {
      console.error('Get messages error:', error)

      // Provide user-friendly error messages for common connection issues
      if (error.name === 'TypeError' && error.message === 'Failed to fetch') {
        throw new Error(
          `Не удалось подключиться к серверу (${API_BASE_URL}). ` +
          `Возможно, бэкенд-сервис не запущен или недоступен. ` +
          `Проверьте, что orchestrator работает на ${API_BASE_URL.replace('/api/group-parser', '')}`
        )
      }

      throw error
    }
  },

  /**
   * Export messages to Excel
   * @param {string} botToken - Telegram bot token
   * @param {string|number} chatId - Chat ID
   * @param {string} groupTitle - Group title for filename
   */
  async exportToExcel(botToken, chatId, groupTitle) {
    try {
      // Lazy load XLSX only when exporting
      const XLSX = await loadXLSX()

      // Get messages first
      const result = await this.getMessages(botToken, chatId)

      if (!result.success || !result.messages || result.messages.length === 0) {
        throw new Error('No messages to export')
      }

      const messages = result.messages

      // Prepare data for Excel
      const excelData = messages.map(msg => ({
        'ID сообщения': msg.message_id,
        'Дата': new Date(msg.date).toLocaleString('ru-RU'),
        'Имя': msg.first_name,
        'Фамилия': msg.last_name,
        'Username': msg.username,
        'User ID': msg.user_id,
        'Тип': msg.type,
        'Текст': msg.text || '',
        'Описание': msg.caption || ''
      }))

      // Create workbook and worksheet
      const wb = XLSX.utils.book_new()
      const ws = XLSX.utils.json_to_sheet(excelData)

      // Set column widths
      ws['!cols'] = [
        { wch: 12 }, // ID
        { wch: 20 }, // Дата
        { wch: 15 }, // Имя
        { wch: 15 }, // Фамилия
        { wch: 20 }, // Username
        { wch: 12 }, // User ID
        { wch: 10 }, // Тип
        { wch: 50 }, // Текст
        { wch: 50 }  // Описание
      ]

      XLSX.utils.book_append_sheet(wb, ws, 'Messages')

      // Generate filename
      const sanitizedTitle = groupTitle.replace(/[^a-zа-яё0-9\s-]/gi, '_')
      const dateStr = new Date().toISOString().split('T')[0]
      const filename = `group_parser_${sanitizedTitle}_${dateStr}.xlsx`

      // Save file
      XLSX.writeFile(wb, filename)

      return { success: true, filename }
    } catch (error) {
      console.error('Export to Excel error:', error)
      throw error
    }
  },

  /**
   * Export messages to JSON
   * @param {string} botToken - Telegram bot token
   * @param {string|number} chatId - Chat ID
   * @param {string} groupTitle - Group title for filename
   */
  async exportToJSON(botToken, chatId, groupTitle) {
    try {
      // Get messages first
      const result = await this.getMessages(botToken, chatId)

      if (!result.success || !result.messages || result.messages.length === 0) {
        throw new Error('No messages to export')
      }

      const messages = result.messages

      // Create JSON blob
      const jsonStr = JSON.stringify(messages, null, 2)
      const blob = new Blob([jsonStr], { type: 'application/json' })

      // Generate filename
      const sanitizedTitle = groupTitle.replace(/[^a-zа-яё0-9\s-]/gi, '_')
      const dateStr = new Date().toISOString().split('T')[0]
      const filename = `group_parser_${sanitizedTitle}_${dateStr}.json`

      // Download file
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      return { success: true, filename }
    } catch (error) {
      console.error('Export to JSON error:', error)
      throw error
    }
  }
}
