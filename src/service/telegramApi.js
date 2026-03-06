/**
 * Telegram Bot API Service
 * API Documentation: https://core.telegram.org/bots/api
 */

import axios from 'axios'

class TelegramApiService {
  constructor() {
    this.botToken = localStorage.getItem('telegram_bot_token') || ''
    this.baseURL = `https://api.telegram.org/bot${this.botToken}`

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
        console.error('Telegram API Error:', error.response?.data || error.message)
        return Promise.reject(error)
      }
    )
  }

  /**
   * Set bot token for authentication
   * @param {string} token - Telegram bot token
   */
  setToken(token) {
    this.botToken = token
    this.baseURL = `https://api.telegram.org/bot${token}`
    localStorage.setItem('telegram_bot_token', token)
  }

  /**
   * Get bot token
   * @returns {string} Current bot token
   */
  getToken() {
    return this.botToken
  }

  /**
   * Get bot information
   * @returns {Promise} Bot info
   */
  async getMe() {
    try {
      const response = await this.client.get(`${this.baseURL}/getMe`)
      return response.data
    } catch (error) {
      throw this.handleError(error)
    }
  }

  /**
   * Send message to a channel or chat
   * @param {string|number} chatId - Chat ID or channel username (@channel)
   * @param {string} text - Message text
   * @param {Object} options - Additional options (parse_mode, reply_markup, etc.)
   * @returns {Promise} Sent message
   */
  async sendMessage(chatId, text, options = {}) {
    try {
      const response = await this.client.post(`${this.baseURL}/sendMessage`, {
        chat_id: chatId,
        text,
        ...options
      })
      return response.data
    } catch (error) {
      throw this.handleError(error)
    }
  }

  /**
   * Send photo to a channel or chat
   * @param {string|number} chatId - Chat ID or channel username
   * @param {string} photo - Photo URL or file_id
   * @param {Object} options - Additional options (caption, parse_mode, etc.)
   * @returns {Promise} Sent message
   */
  async sendPhoto(chatId, photo, options = {}) {
    try {
      const response = await this.client.post(`${this.baseURL}/sendPhoto`, {
        chat_id: chatId,
        photo,
        ...options
      })
      return response.data
    } catch (error) {
      throw this.handleError(error)
    }
  }

  /**
   * Upload and send photo file
   * @param {string|number} chatId - Chat ID or channel username
   * @param {File} photoFile - Photo file object
   * @param {Object} options - Additional options
   * @returns {Promise} Sent message
   */
  async uploadAndSendPhoto(chatId, photoFile, options = {}) {
    try {
      const formData = new FormData()
      formData.append('chat_id', chatId)
      formData.append('photo', photoFile)

      // Add other options
      Object.keys(options).forEach(key => {
        formData.append(key, options[key])
      })

      const response = await this.client.post(`${this.baseURL}/sendPhoto`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      })
      return response.data
    } catch (error) {
      throw this.handleError(error)
    }
  }

  /**
   * Send media group (album)
   * @param {string|number} chatId - Chat ID or channel username
   * @param {Array} media - Array of media objects
   * @returns {Promise} Sent messages
   */
  async sendMediaGroup(chatId, media) {
    try {
      const response = await this.client.post(`${this.baseURL}/sendMediaGroup`, {
        chat_id: chatId,
        media
      })
      return response.data
    } catch (error) {
      throw this.handleError(error)
    }
  }

  /**
   * Edit message text
   * @param {string|number} chatId - Chat ID
   * @param {number} messageId - Message ID to edit
   * @param {string} text - New text
   * @param {Object} options - Additional options
   * @returns {Promise} Edited message
   */
  async editMessageText(chatId, messageId, text, options = {}) {
    try {
      const response = await this.client.post(`${this.baseURL}/editMessageText`, {
        chat_id: chatId,
        message_id: messageId,
        text,
        ...options
      })
      return response.data
    } catch (error) {
      throw this.handleError(error)
    }
  }

  /**
   * Delete message
   * @param {string|number} chatId - Chat ID
   * @param {number} messageId - Message ID to delete
   * @returns {Promise} Deletion result
   */
  async deleteMessage(chatId, messageId) {
    try {
      const response = await this.client.post(`${this.baseURL}/deleteMessage`, {
        chat_id: chatId,
        message_id: messageId
      })
      return response.data
    } catch (error) {
      throw this.handleError(error)
    }
  }

  /**
   * Get chat info
   * @param {string|number} chatId - Chat ID or username
   * @returns {Promise} Chat information
   */
  async getChat(chatId) {
    try {
      const response = await this.client.get(`${this.baseURL}/getChat`, {
        params: { chat_id: chatId }
      })
      return response.data
    } catch (error) {
      throw this.handleError(error)
    }
  }

  /**
   * Get chat member count
   * @param {string|number} chatId - Chat ID or username
   * @returns {Promise} Member count
   */
  async getChatMemberCount(chatId) {
    try {
      const response = await this.client.get(`${this.baseURL}/getChatMemberCount`, {
        params: { chat_id: chatId }
      })
      return response.data
    } catch (error) {
      throw this.handleError(error)
    }
  }

  /**
   * Send document to a channel or chat
   * @param {string|number} chatId - Chat ID or channel username
   * @param {string} document - Document URL or file_id
   * @param {Object} options - Additional options
   * @returns {Promise} Sent message
   */
  async sendDocument(chatId, document, options = {}) {
    try {
      const response = await this.client.post(`${this.baseURL}/sendDocument`, {
        chat_id: chatId,
        document,
        ...options
      })
      return response.data
    } catch (error) {
      throw this.handleError(error)
    }
  }

  /**
   * Forward message
   * @param {string|number} chatId - Target chat ID
   * @param {string|number} fromChatId - Source chat ID
   * @param {number} messageId - Message ID to forward
   * @returns {Promise} Forwarded message
   */
  async forwardMessage(chatId, fromChatId, messageId) {
    try {
      const response = await this.client.post(`${this.baseURL}/forwardMessage`, {
        chat_id: chatId,
        from_chat_id: fromChatId,
        message_id: messageId
      })
      return response.data
    } catch (error) {
      throw this.handleError(error)
    }
  }

  /**
   * Get channel statistics (replacement for TgStat API)
   * This method uses Telegram Bot API to get channel information
   * Note: Bot must be an administrator of the channel to access this data
   * @param {string} channelUsername - Channel username (with or without @)
   * @returns {Promise} Channel statistics
   */
  async getChannelStats(channelUsername) {
    try {
      // Ensure username starts with @
      const username = channelUsername.startsWith('@') ? channelUsername : `@${channelUsername}`

      // Get basic chat info
      const chatInfo = await this.getChat(username)

      // Get member count
      const memberCount = await this.getChatMemberCount(username)

      return {
        success: true,
        response: {
          username: channelUsername.replace('@', ''),
          title: chatInfo.result?.title || '',
          description: chatInfo.result?.description || '',
          subscribers: memberCount.result || 0,
          // Note: Telegram Bot API doesn't provide avg_reach, views, or detailed analytics
          // These would require additional implementation or integration
          avg_reach: null,
          type: chatInfo.result?.type || 'channel'
        }
      }
    } catch (error) {
      const formattedError = this.handleError(error)

      // Add helpful context about bot permissions
      if (error.response?.status === 400 || error.response?.status === 403) {
        formattedError.requiresBotAdmin = true
        formattedError.helpText = 'Бот должен быть добавлен в канал как администратор для получения данных через Bot API. ' +
          'Альтернативно, можно использовать публичный API для получения базовой информации.'
      }

      throw formattedError
    }
  }

  /**
   * Get channel information (replacement for TgStat getChannel)
   * @param {string} channelUsername - Channel username
   * @returns {Promise} Channel information
   */
  async getChannelInfo(channelUsername) {
    return this.getChannelStats(channelUsername)
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
        message: error.response.data?.description || 'API request failed',
        data: error.response.data
      }
    } else if (error.request) {
      return {
        status: 0,
        message: 'No response from server',
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

export default new TelegramApiService()
