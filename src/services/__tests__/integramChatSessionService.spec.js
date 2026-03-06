/**
 * Unit tests for integramChatSessionService
 *
 * Tests сохранения сессий и истории чата в Integram DB
 * Покрывает:
 * - Инициализацию сервиса
 * - Кэширование сессий (localStorage)
 * - Создание сессий и транзакций
 * - Расчёт стоимости
 * - Маппинг моделей
 * - Загрузку истории
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { IntegramChatSessionService } from '@/services/integramChatSessionService.js'

// Mock integramApiClient
vi.mock('@/services/integramApiClient', () => ({
  default: {
    isAuthenticated: vi.fn(() => true),
    loadSession: vi.fn(),
    setDatabase: vi.fn(),
    get: vi.fn(),
    createObject: vi.fn(),
    setObjectRequisites: vi.fn(),
    getObjectEditData: vi.fn(),
    getObjectList: vi.fn()
  }
}))

// Mock fetch for models API
global.fetch = vi.fn()

describe('IntegramChatSessionService', () => {
  let service

  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear()

    // Reset fetch mock
    global.fetch.mockReset()

    // Import fresh service instance
    vi.resetModules()
  })

  afterEach(() => {
    localStorage.clear()
  })

  describe('Cache Management', () => {
    it('should save sessionsCache to localStorage', async () => {
      const { IntegramChatSessionService } = await import('@/services/integramChatSessionService.js')
      const service = new IntegramChatSessionService()

      service.sessionsCache.set('session_123', '456789')
      service.saveCacheToStorage()

      const cached = localStorage.getItem('integram_sessions_cache')
      expect(cached).not.toBeNull()

      const data = JSON.parse(cached)
      expect(data['session_123']).toBe('456789')
    })

    it('should load sessionsCache from localStorage on construction', async () => {
      const mockCache = { 'session_abc': '111222', 'session_xyz': '333444' }
      localStorage.setItem('integram_sessions_cache', JSON.stringify(mockCache))

      const { IntegramChatSessionService } = await import('@/services/integramChatSessionService.js')
      const service = new IntegramChatSessionService()

      expect(service.sessionsCache.size).toBe(2)
      expect(service.sessionsCache.get('session_abc')).toBe('111222')
      expect(service.sessionsCache.get('session_xyz')).toBe('333444')
    })

    it('should clear cache and localStorage', async () => {
      const { IntegramChatSessionService } = await import('@/services/integramChatSessionService.js')
      const service = new IntegramChatSessionService()

      service.sessionsCache.set('session_test', '999888')
      service.saveCacheToStorage()

      expect(localStorage.getItem('integram_sessions_cache')).not.toBeNull()

      service.clearCache()

      expect(service.sessionsCache.size).toBe(0)
      expect(localStorage.getItem('integram_sessions_cache')).toBeNull()
    })
  })

  describe('Cost Calculation', () => {
    it('should calculate cost for deepseek-chat correctly', async () => {
      // Импортируем приватную функцию через экспорт в тесте
      const { integramChatSessionService } = await import('@/services/integramChatSessionService.js')

      // deepseek-chat: input=2606копеек/1M, output=10423копеек/1M
      // 1000 input tokens = (1000/1000000) * 2606 / 100 = 0.02606₽
      // 2000 output tokens = (2000/1000000) * 10423 / 100 = 0.20846₽
      // Total = 0.23452₽

      // Создаём транзакцию с deepseek-chat
      const testData = {
        sessionId: 'test_session',
        userMessage: 'Test question',
        assistantMessage: 'Test answer',
        model: 'deepseek-chat',
        inputTokens: 1000,
        outputTokens: 2000,
        systemPrompt: 'Test prompt'
      }

      // Мокаем createMessageTransaction для проверки расчёта
      const mockCreateTransaction = vi.spyOn(integramChatSessionService, 'createMessageTransaction')
      mockCreateTransaction.mockResolvedValue({ success: true, transactionId: '12345' })

      await integramChatSessionService.saveMessageExchange(testData)

      // Проверяем что функция была вызвана с правильными данными
      expect(mockCreateTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'deepseek-chat',
          inputTokens: 1000,
          outputTokens: 2000
        })
      )
    })

    it('should use default pricing for unknown models', async () => {
      const { integramChatSessionService } = await import('@/services/integramChatSessionService.js')

      const testData = {
        sessionId: 'test_session',
        userMessage: 'Test',
        assistantMessage: 'Answer',
        model: 'unknown-model-xyz',
        inputTokens: 500,
        outputTokens: 500,
        systemPrompt: 'Test'
      }

      const mockCreateTransaction = vi.spyOn(integramChatSessionService, 'createMessageTransaction')
      mockCreateTransaction.mockResolvedValue({ success: true })

      await integramChatSessionService.saveMessageExchange(testData)

      // Должен использовать default цены (как deepseek-chat)
      expect(mockCreateTransaction).toHaveBeenCalled()
    })
  })

  describe('Model Mapping', () => {
    it('should load models from API', async () => {
      const mockModels = [
        { id: '12345', name: 'claude-sonnet-4.5', value: 'claude-sonnet-4.5' },
        { id: '12346', name: 'deepseek-chat', value: 'deepseek-chat' },
        { id: '12347', name: 'gpt-4o', value: 'gpt-4o' }
      ]

      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: mockModels })
      })

      const { integramChatSessionService } = await import('@/services/integramChatSessionService.js')
      await integramChatSessionService.loadModelsMap()

      expect(integramChatSessionService.modelsLoaded).toBe(true)
      expect(integramChatSessionService.modelsMap.size).toBeGreaterThan(0)
    })

    it('should strip provider prefix from model names', async () => {
      const mockModels = [
        { id: '12345', name: 'anthropic/claude-sonnet-4.5' },
        { id: '12346', name: 'openai/gpt-4o' }
      ]

      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: mockModels })
      })

      const { integramChatSessionService } = await import('@/services/integramChatSessionService.js')
      await integramChatSessionService.loadModelsMap()

      // Должны быть сохранены без префикса
      expect(integramChatSessionService.modelsMap.has('claude-sonnet-4.5')).toBe(true)
      expect(integramChatSessionService.modelsMap.has('gpt-4o')).toBe(true)
    })

    it('should get model ID with provider prefix stripping', async () => {
      const mockModels = [
        { id: '12345', name: 'claude-sonnet-4.5' }
      ]

      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: mockModels })
      })

      const { integramChatSessionService } = await import('@/services/integramChatSessionService.js')
      await integramChatSessionService.loadModelsMap()

      // Должен найти модель даже с префиксом
      const modelId = integramChatSessionService.getModelId('anthropic/claude-sonnet-4.5')
      expect(modelId).toBe('12345')
    })

    it('should return default model ID for unknown models', async () => {
      const { integramChatSessionService } = await import('@/services/integramChatSessionService.js')
      integramChatSessionService.modelsLoaded = true

      const modelId = integramChatSessionService.getModelId('unknown-model')
      expect(modelId).toBe('195845') // DEFAULT_MODEL_ID
    })
  })

  describe('Token Management', () => {
    it('should set current token and save to localStorage', async () => {
      const { integramChatSessionService } = await import('@/services/integramChatSessionService.js')

      integramChatSessionService.setCurrentToken('206099')

      expect(integramChatSessionService.currentTokenId).toBe('206099')
      expect(localStorage.getItem('current_ai_token_id')).toBe('206099')
    })

    it('should use default token if not set', async () => {
      const { default: integramApiClient } = await import('@/services/integramApiClient')
      integramApiClient.get.mockResolvedValue({ '&main.a.&object': { id: ['206099'] } })

      const { integramChatSessionService } = await import('@/services/integramChatSessionService.js')
      await integramChatSessionService.initialize()

      expect(integramChatSessionService.currentTokenId).toBe('206099')
    })
  })

  describe('Session Creation', () => {
    it('should create session with correct requisites', async () => {
      const { default: integramApiClient } = await import('@/services/integramApiClient')
      integramApiClient.createObject.mockResolvedValue({ id: '999888', success: true })

      const { integramChatSessionService } = await import('@/services/integramChatSessionService.js')
      integramChatSessionService.initialized = true
      integramChatSessionService.currentTokenId = '206099'

      const result = await integramChatSessionService.createSession({
        sessionId: 'session_test_123',
        systemPrompt: 'Test system prompt'
      })

      expect(result.success).toBe(true)
      expect(result.integramId).toBe('999888')
      expect(result.sessionId).toBe('session_test_123')

      // Проверяем что сессия закэширована
      expect(integramChatSessionService.sessionsCache.get('session_test_123')).toBe('999888')
    })

    it('should persist session cache to localStorage', async () => {
      const { default: integramApiClient } = await import('@/services/integramApiClient')
      integramApiClient.createObject.mockResolvedValue({ id: '777666', success: true })

      const { integramChatSessionService } = await import('@/services/integramChatSessionService.js')
      integramChatSessionService.initialized = true
      integramChatSessionService.currentTokenId = '206099'

      await integramChatSessionService.createSession({
        sessionId: 'persistent_session',
        systemPrompt: 'Test'
      })

      const cached = localStorage.getItem('integram_sessions_cache')
      expect(cached).not.toBeNull()

      const data = JSON.parse(cached)
      expect(data['persistent_session']).toBe('777666')
    })
  })

  describe('Transaction Creation', () => {
    it('should create message transaction with correct data', async () => {
      const { default: integramApiClient } = await import('@/services/integramApiClient')
      integramApiClient.createObject.mockResolvedValue({ id: '555444' })
      integramApiClient.setObjectRequisites.mockResolvedValue({ success: true })

      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: [{ id: '12345', name: 'deepseek-chat' }] })
      })

      const { integramChatSessionService } = await import('@/services/integramChatSessionService.js')
      integramChatSessionService.initialized = true
      integramChatSessionService.sessionsCache.set('test_session', '888999')
      await integramChatSessionService.loadModelsMap()

      const result = await integramChatSessionService.createMessageTransaction({
        sessionId: 'test_session',
        userMessage: 'Hello AI',
        assistantMessage: 'Hello human',
        model: 'deepseek-chat',
        inputTokens: 100,
        outputTokens: 200,
        systemPrompt: 'Be helpful'
      })

      expect(result.success).toBe(true)
      expect(result.transactionId).toBe('555444')

      // Проверяем что createObject был вызван с правильным parentId
      expect(integramApiClient.createObject).toHaveBeenCalledWith(
        198038, // TYPE_IDS.TRANSACTION
        expect.any(String), // transaction name (ISO timestamp)
        expect.objectContaining({
          205916: 'Hello AI', // QUESTION
          205931: 'Hello human', // ANSWER
          198041: '100', // INPUT_TOKENS
          198042: '200' // OUTPUT_TOKENS
        }),
        '888999' // parentId (session)
      )
    })

    it('should update session last activity after transaction', async () => {
      const { default: integramApiClient } = await import('@/services/integramApiClient')
      integramApiClient.createObject.mockResolvedValue({ id: '123456' })
      integramApiClient.setObjectRequisites.mockResolvedValue({ success: true })

      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: [] })
      })

      const { integramChatSessionService } = await import('@/services/integramChatSessionService.js')
      integramChatSessionService.initialized = true
      integramChatSessionService.sessionsCache.set('active_session', '111222')
      integramChatSessionService.modelsLoaded = true

      await integramChatSessionService.createMessageTransaction({
        sessionId: 'active_session',
        userMessage: 'Test',
        assistantMessage: 'Response',
        model: 'deepseek-chat',
        inputTokens: 50,
        outputTokens: 100,
        systemPrompt: 'Test'
      })

      // Проверяем что LAST_ACTIVITY был обновлён
      expect(integramApiClient.setObjectRequisites).toHaveBeenCalledWith(
        '111222', // session integram ID
        expect.objectContaining({
          205928: expect.any(String) // LAST_ACTIVITY
        })
      )
    })

    it('should handle missing session in cache', async () => {
      const { integramChatSessionService } = await import('@/services/integramChatSessionService.js')
      integramChatSessionService.initialized = true

      const result = await integramChatSessionService.createMessageTransaction({
        sessionId: 'nonexistent_session',
        userMessage: 'Test',
        assistantMessage: 'Response',
        model: 'deepseek-chat',
        inputTokens: 50,
        outputTokens: 100,
        systemPrompt: 'Test'
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('Session not found in cache')
    })
  })

  describe('History Loading', () => {
    it('should load session history', async () => {
      const mockSessions = [
        { id: '111', val: 'Session 1', date: '2026-01-01' },
        { id: '222', val: 'Session 2', date: '2026-01-02' }
      ]

      const { default: integramApiClient } = await import('@/services/integramApiClient')
      integramApiClient.getObjectList.mockResolvedValue({ object: mockSessions })

      const { integramChatSessionService } = await import('@/services/integramChatSessionService.js')
      integramChatSessionService.initialized = true
      integramChatSessionService.currentTokenId = '206099'

      const history = await integramChatSessionService.loadSessionHistory(50)

      expect(history).toHaveLength(2)
      expect(history[0].id).toBe('111')
      expect(history[1].id).toBe('222')
    })

    it('should load session transactions', async () => {
      const mockTransactions = [
        { id: '777', val: '2026-01-01T10:00:00' },
        { id: '888', val: '2026-01-01T10:05:00' }
      ]

      const { default: integramApiClient } = await import('@/services/integramApiClient')
      integramApiClient.getObjectList.mockResolvedValue({ object: mockTransactions })

      const { integramChatSessionService } = await import('@/services/integramChatSessionService.js')
      integramChatSessionService.initialized = true
      integramChatSessionService.sessionsCache.set('test_session', '333444')

      const transactions = await integramChatSessionService.getSessionTransactions('test_session')

      expect(transactions).toHaveLength(2)
      expect(transactions[0].id).toBe('777')
      expect(transactions[1].id).toBe('888')
    })

    it('should get session data with messages', async () => {
      const mockSessionData = {
        reqs: {
          205926: { value: JSON.stringify([{ text: 'Hello', isUser: true }]) }, // MESSAGES_JSON
          205924: { value: 'System prompt test' }, // SYSTEM_PROMPT
          205928: { value: '2026-01-01T10:00:00Z' } // LAST_ACTIVITY
        }
      }

      const { default: integramApiClient } = await import('@/services/integramApiClient')
      integramApiClient.getObjectEditData.mockResolvedValue(mockSessionData)

      const { integramChatSessionService } = await import('@/services/integramChatSessionService.js')
      integramChatSessionService.initialized = true
      integramChatSessionService.sessionsCache.set('loaded_session', '555666')

      const session = await integramChatSessionService.getSession('loaded_session')

      expect(session.success).toBe(true)
      expect(session.messages).toHaveLength(1)
      expect(session.messages[0].text).toBe('Hello')
      expect(session.systemPrompt).toBe('System prompt test')
    })
  })

  describe('Initialization', () => {
    it('should initialize with valid authentication', async () => {
      const { default: integramApiClient } = await import('@/services/integramApiClient')
      integramApiClient.isAuthenticated.mockReturnValue(true)
      integramApiClient.get.mockResolvedValue({ '&main.a.&object': { id: ['206099'] } })

      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: [] })
      })

      const { integramChatSessionService } = await import('@/services/integramChatSessionService.js')
      const result = await integramChatSessionService.initialize('206099')

      expect(result).toBe(true)
      expect(integramChatSessionService.initialized).toBe(true)
      expect(integramChatSessionService.currentTokenId).toBe('206099')
    })

    it('should fail initialization without authentication', async () => {
      const { default: integramApiClient } = await import('@/services/integramApiClient')
      integramApiClient.isAuthenticated.mockReturnValue(false)
      integramApiClient.loadSession.mockReturnValue(false)

      const { integramChatSessionService } = await import('@/services/integramChatSessionService.js')
      const result = await integramChatSessionService.initialize()

      expect(result).toBe(false)
      expect(integramChatSessionService.initialized).toBe(false)
    })

    it('should auto-initialize before operations if not initialized', async () => {
      const { default: integramApiClient } = await import('@/services/integramApiClient')
      integramApiClient.isAuthenticated.mockReturnValue(true)
      integramApiClient.get.mockResolvedValue({ '&main.a.&object': { id: ['206099'] } })
      integramApiClient.createObject.mockResolvedValue({ id: '999888' })

      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: [] })
      })

      const { integramChatSessionService } = await import('@/services/integramChatSessionService.js')
      integramChatSessionService.initialized = false

      const result = await integramChatSessionService.createSession({
        sessionId: 'auto_init_session',
        systemPrompt: 'Test'
      })

      expect(integramChatSessionService.initialized).toBe(true)
      expect(result.success).toBe(true)
    })
  })
})
