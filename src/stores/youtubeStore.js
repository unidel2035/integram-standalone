import { logger } from '@/utils/logger'
/**
 * YouTube Analytics Store
 *
 * Manages YouTube API tokens and Telegram bot tokens for YouTube analytics module
 * Implements client-side caching for improved performance and token management
 */

import { reactive, computed } from 'vue'

// Storage keys
const STORAGE_KEYS = {
  YOUTUBE_TOKEN: 'youtube_api_token',
  BOT_TOKEN: 'telegram_bot_token',
  TOKEN_TIMESTAMP: 'youtube_token_timestamp'
}

// Token cache duration (24 hours in milliseconds)
const CACHE_DURATION = 24 * 60 * 60 * 1000

const state = reactive({
  youtubeToken: null,
  botToken: null,
  tokenTimestamp: null,
  isTokenValid: false
})

export const useYouTubeStore = () => {
  // ============================================================
  // GETTERS
  // ============================================================

  /**
   * Get YouTube API token
   */
  const youtubeToken = computed(() => state.youtubeToken)

  /**
   * Get Telegram bot token
   */
  const botToken = computed(() => state.botToken)

  /**
   * Check if tokens are cached and valid
   */
  const hasValidTokens = computed(() => {
    if (!state.youtubeToken || !state.tokenTimestamp) {
      return false
    }

    const now = Date.now()
    const elapsed = now - state.tokenTimestamp
    return elapsed < CACHE_DURATION
  })

  /**
   * Get time remaining until token cache expires (in milliseconds)
   */
  const cacheTimeRemaining = computed(() => {
    if (!state.tokenTimestamp) return 0

    const now = Date.now()
    const elapsed = now - state.tokenTimestamp
    const remaining = CACHE_DURATION - elapsed

    return remaining > 0 ? remaining : 0
  })

  // ============================================================
  // PRIVATE HELPERS
  // ============================================================

  /**
   * Load tokens from localStorage
   * @private
   */
  const loadFromStorage = () => {
    try {
      const youtube = localStorage.getItem(STORAGE_KEYS.YOUTUBE_TOKEN)
      const bot = localStorage.getItem(STORAGE_KEYS.BOT_TOKEN)
      const timestamp = localStorage.getItem(STORAGE_KEYS.TOKEN_TIMESTAMP)

      if (youtube) {
        state.youtubeToken = youtube
      }

      if (bot) {
        state.botToken = bot
      }

      if (timestamp) {
        state.tokenTimestamp = parseInt(timestamp, 10)
      }

      // Validate cache
      if (state.youtubeToken && state.tokenTimestamp) {
        const now = Date.now()
        const elapsed = now - state.tokenTimestamp

        if (elapsed < CACHE_DURATION) {
          state.isTokenValid = true
          logger.debug(`YouTube tokens loaded from cache (expires in ${Math.round((CACHE_DURATION - elapsed) / 1000 / 60)} minutes)`)
        } else {
          logger.debug('Cached YouTube tokens expired, clearing...')
          clearTokens()
        }
      }
    } catch (error) {
      console.error('Failed to load tokens from storage:', error)
    }
  }

  /**
   * Save tokens to localStorage
   * @private
   */
  const saveToStorage = () => {
    try {
      if (state.youtubeToken) {
        localStorage.setItem(STORAGE_KEYS.YOUTUBE_TOKEN, state.youtubeToken)
      }

      if (state.botToken) {
        localStorage.setItem(STORAGE_KEYS.BOT_TOKEN, state.botToken)
      }

      if (state.tokenTimestamp) {
        localStorage.setItem(STORAGE_KEYS.TOKEN_TIMESTAMP, state.tokenTimestamp.toString())
      }

      logger.debug('YouTube tokens saved to cache')
    } catch (error) {
      console.error('Failed to save tokens to storage:', error)
    }
  }

  // ============================================================
  // ACTIONS
  // ============================================================

  /**
   * Set YouTube API token
   * @param {string} token - YouTube API token
   */
  const setYouTubeToken = (token) => {
    if (!token || typeof token !== 'string' || token.trim() === '') {
      throw new Error('Invalid YouTube token')
    }

    state.youtubeToken = token.trim()
    state.tokenTimestamp = Date.now()
    state.isTokenValid = true
    saveToStorage()

    logger.debug('YouTube API token set and cached')
  }

  /**
   * Set Telegram bot token
   * @param {string} token - Telegram bot token
   */
  const setBotToken = (token) => {
    if (!token || typeof token !== 'string' || token.trim() === '') {
      throw new Error('Invalid bot token')
    }

    state.botToken = token.trim()
    saveToStorage()

    logger.debug('Telegram bot token set and cached')
  }

  /**
   * Set both tokens at once
   * @param {string} youtubeToken - YouTube API token
   * @param {string} botToken - Telegram bot token
   */
  const setTokens = (youtubeToken, botToken) => {
    setYouTubeToken(youtubeToken)
    setBotToken(botToken)
  }

  /**
   * Clear all tokens from memory and storage
   */
  const clearTokens = () => {
    state.youtubeToken = null
    state.botToken = null
    state.tokenTimestamp = null
    state.isTokenValid = false

    try {
      localStorage.removeItem(STORAGE_KEYS.YOUTUBE_TOKEN)
      localStorage.removeItem(STORAGE_KEYS.BOT_TOKEN)
      localStorage.removeItem(STORAGE_KEYS.TOKEN_TIMESTAMP)
      logger.debug('YouTube tokens cleared')
    } catch (error) {
      console.error('Failed to clear tokens from storage:', error)
    }
  }

  /**
   * Refresh token cache timestamp
   * Call this when tokens are successfully used to extend cache duration
   */
  const refreshCache = () => {
    if (state.youtubeToken) {
      state.tokenTimestamp = Date.now()
      saveToStorage()
      logger.debug('Token cache refreshed')
    }
  }

  /**
   * Validate YouTube token format (basic validation)
   * @param {string} token - Token to validate
   * @returns {boolean} True if token format appears valid
   */
  const validateTokenFormat = (token) => {
    if (!token || typeof token !== 'string') {
      return false
    }

    // Basic validation: YouTube API keys are typically 39 characters
    // Format: AIzaSy[A-Za-z0-9_-]{33}
    const youtubeApiKeyPattern = /^AIza[A-Za-z0-9_-]{35}$/

    return youtubeApiKeyPattern.test(token)
  }

  /**
   * Get tokens for API request
   * @returns {Object} Object containing YouTube and bot tokens
   * @throws {Error} If required tokens are missing or invalid
   */
  const getTokensForRequest = () => {
    if (!hasValidTokens.value) {
      throw new Error('No valid YouTube tokens cached. Please set tokens first.')
    }

    return {
      youtube_token: state.youtubeToken,
      bot_token: state.botToken
    }
  }

  /**
   * Initialize store by loading tokens from storage
   */
  const initialize = () => {
    loadFromStorage()
  }

  // Auto-initialize on first use
  initialize()

  return {
    // State
    youtubeToken,
    botToken,
    hasValidTokens,
    cacheTimeRemaining,
    isTokenValid: computed(() => state.isTokenValid),

    // Actions
    setYouTubeToken,
    setBotToken,
    setTokens,
    clearTokens,
    refreshCache,
    validateTokenFormat,
    getTokensForRequest,
    initialize
  }
}
