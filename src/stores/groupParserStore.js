import { defineStore } from 'pinia'
import { groupParserService } from '@/services/groupParserService'

export const useGroupParserStore = defineStore('groupParser', {
  state: () => ({
    botToken: null,
    tokenCacheExpiry: null,
    groups: [],
    messages: {},
    isConnected: false,
    botInfo: null
  }),

  getters: {
    hasValidToken(state) {
      if (!state.botToken || !state.tokenCacheExpiry) {
        return false
      }
      return Date.now() < state.tokenCacheExpiry
    },

    cacheTimeRemaining(state) {
      if (!state.tokenCacheExpiry) {
        return 0
      }
      const remaining = state.tokenCacheExpiry - Date.now()
      return remaining > 0 ? remaining : 0
    }
  },

  actions: {
    setBotToken(token) {
      this.botToken = token
      this.tokenCacheExpiry = Date.now() + (24 * 60 * 60 * 1000) // 24 hours
      this.saveToLocalStorage()
    },

    getBotToken() {
      if (!this.hasValidToken) {
        this.loadFromLocalStorage()
      }
      return this.botToken
    },

    clearBotToken() {
      this.botToken = null
      this.tokenCacheExpiry = null
      this.groups = []
      this.messages = {}
      this.isConnected = false
      this.botInfo = null
      this.clearLocalStorage()
    },

    refreshCache() {
      if (this.botToken) {
        this.tokenCacheExpiry = Date.now() + (24 * 60 * 60 * 1000)
        this.saveToLocalStorage()
      }
    },

    saveToLocalStorage() {
      try {
        const data = {
          botToken: this.botToken,
          tokenCacheExpiry: this.tokenCacheExpiry,
          botInfo: this.botInfo
        }
        localStorage.setItem('groupParserBotToken', JSON.stringify(data))
      } catch (error) {
        console.error('Failed to save bot token to localStorage:', error)
      }
    },

    loadFromLocalStorage() {
      try {
        const data = localStorage.getItem('groupParserBotToken')
        if (data) {
          const parsed = JSON.parse(data)

          // Check if token is still valid
          if (parsed.tokenCacheExpiry && Date.now() < parsed.tokenCacheExpiry) {
            this.botToken = parsed.botToken
            this.tokenCacheExpiry = parsed.tokenCacheExpiry
            this.botInfo = parsed.botInfo
            return true
          } else {
            // Token expired, clear it
            this.clearLocalStorage()
          }
        }
      } catch (error) {
        console.error('Failed to load bot token from localStorage:', error)
      }
      return false
    },

    clearLocalStorage() {
      try {
        localStorage.removeItem('groupParserBotToken')
      } catch (error) {
        console.error('Failed to clear localStorage:', error)
      }
    },

    async testConnection(token) {
      try {
        const result = await groupParserService.testConnection(token)
        if (result.success) {
          this.isConnected = true
          this.botInfo = result.bot
        }
        return result
      } catch (error) {
        this.isConnected = false
        throw error
      }
    },

    async getGroups(token) {
      try {
        const result = await groupParserService.getGroups(token)
        if (result.success) {
          this.groups = result.groups || []
        }
        return result
      } catch (error) {
        throw error
      }
    },

    async parseMessages(token, chatId) {
      try {
        const result = await groupParserService.parseMessages(token, chatId)
        return result
      } catch (error) {
        throw error
      }
    },

    async getMessages(token, chatId) {
      try {
        const result = await groupParserService.getMessages(token, chatId)
        if (result.success) {
          this.messages[chatId] = result.messages || []
        }
        return result
      } catch (error) {
        throw error
      }
    },

    async exportToExcel(token, chatId, groupTitle) {
      try {
        await groupParserService.exportToExcel(token, chatId, groupTitle)
      } catch (error) {
        throw error
      }
    },

    async exportToJSON(token, chatId, groupTitle) {
      try {
        await groupParserService.exportToJSON(token, chatId, groupTitle)
      } catch (error) {
        throw error
      }
    }
  }
})
