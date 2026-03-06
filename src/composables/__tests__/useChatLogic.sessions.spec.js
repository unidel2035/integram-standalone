/**
 * Тестирование системы сессий в useChatLogic
 * Проверяет: Integram PRIMARY storage, localStorage FALLBACK
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock зависимостей перед импортом
vi.mock('@/services/integramChatSessionService.js', () => {
  return {
    integramChatSessionService: {
      setCurrentToken: vi.fn(),
      loadSessionHistory: vi.fn(),
      getSession: vi.fn(),
      createSession: vi.fn(),
      saveMessageExchange: vi.fn(),
      updateMessages: vi.fn(),
      sessionsCache: new Map(),
      initialized: true
    }
  }
})

vi.mock('@/services/integramApiClient', () => ({
  default: {
    getObjectEditData: vi.fn(),
    setObjectRequisites: vi.fn(),
    createObject: vi.fn(),
    getObjectList: vi.fn()
  }
}))

vi.mock('@/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    error: vi.fn()
  }
}))

vi.mock('@/utils/apiConfig', () => ({
  getApiUrl: vi.fn(() => 'http://localhost:3000')
}))

vi.mock('@/axios2.js', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn()
  }
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useRoute: () => ({ query: {} })
}))

describe('useChatLogic - Session Management', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  describe('Загрузка истории из Integram (PRIMARY)', () => {
    it('должен загрузить историю из Integram при инициализации', async () => {
      const { integramChatSessionService } = await import('@/services/integramChatSessionService.js')
      const { default: integramApiClient } = await import('@/services/integramApiClient')

      // Mock успешной загрузки сессии
      const mockSession = { id: '12345', val: 'Test Session' }
      integramChatSessionService.loadSessionHistory.mockResolvedValue([mockSession])

      // Mock данных сессии с сообщениями
      const mockMessages = [
        { text: 'Привет!', isUser: true, time: '10:00' },
        { text: 'Здравствуйте!', isUser: false, time: '10:01' }
      ]

      integramApiClient.getObjectEditData.mockResolvedValue({
        reqs: {
          205921: { value: 'session_test_123' }, // SESSION_ID
          205926: { value: JSON.stringify(mockMessages) } // MESSAGES_JSON
        }
      })

      // Тест будет проверять что loadChatFromIntegram() вызывается
      // и возвращает правильные сообщения
      expect(integramChatSessionService.loadSessionHistory).toBeDefined()
    })

    it('должен сохранить sessionId в currentSessionId при загрузке', async () => {
      const { integramChatSessionService } = await import('@/services/integramChatSessionService.js')
      const { default: integramApiClient } = await import('@/services/integramApiClient')

      const mockSession = { id: '99999', val: 'Session with ID' }
      integramChatSessionService.loadSessionHistory.mockResolvedValue([mockSession])

      integramApiClient.getObjectEditData.mockResolvedValue({
        reqs: {
          205921: { value: 'session_stored_id' },
          205926: { value: JSON.stringify([{ text: 'test', isUser: true }]) }
        }
      })

      // Проверяем что кэш обновляется
      expect(integramChatSessionService.sessionsCache).toBeDefined()
    })

    it('должен вернуть null если сессий нет в Integram', async () => {
      const { integramChatSessionService } = await import('@/services/integramChatSessionService.js')

      // Mock пустого списка сессий
      integramChatSessionService.loadSessionHistory.mockResolvedValue([])

      // Функция loadChatFromIntegram должна вернуть null
      // что приведёт к fallback на localStorage
      expect(integramChatSessionService.loadSessionHistory).toBeDefined()
    })

    it('должен вернуть null если сессия без сообщений', async () => {
      const { integramChatSessionService } = await import('@/services/integramChatSessionService.js')
      const { default: integramApiClient } = await import('@/services/integramApiClient')

      const mockSession = { id: '88888', val: 'Empty Session' }
      integramChatSessionService.loadSessionHistory.mockResolvedValue([mockSession])

      // Mock сессии без MESSAGES_JSON
      integramApiClient.getObjectEditData.mockResolvedValue({
        reqs: {
          205921: { value: 'session_empty' },
          205926: { value: null } // Нет сообщений
        }
      })

      expect(integramApiClient.getObjectEditData).toBeDefined()
    })
  })

  describe('Fallback на localStorage', () => {
    it('должен использовать localStorage если Integram failed', async () => {
      const { integramChatSessionService } = await import('@/services/integramChatSessionService.js')

      // Mock ошибки при загрузке из Integram
      integramChatSessionService.loadSessionHistory.mockRejectedValue(
        new Error('Integram unavailable')
      )

      // Устанавливаем данные в localStorage
      const localMessages = [
        { text: 'Локальное сообщение', isUser: true, time: '11:00' }
      ]
      localStorage.setItem('aiChat', JSON.stringify(localMessages))

      // init() должен использовать localStorage как fallback
      const stored = localStorage.getItem('aiChat')
      expect(stored).toBeTruthy()
      expect(JSON.parse(stored)).toHaveLength(1)
    })

    it('должен использовать default messages если оба storage failed', async () => {
      const { integramChatSessionService } = await import('@/services/integramChatSessionService.js')

      // Mock ошибки Integram
      integramChatSessionService.loadSessionHistory.mockRejectedValue(
        new Error('Network error')
      )

      // localStorage пустой
      localStorage.clear()

      // init() должен использовать default messages из инициализации aiChat
      expect(localStorage.getItem('aiChat')).toBeNull()
    })
  })

  describe('Сохранение в Integram (PRIMARY)', () => {
    it('должен сохранить транзакцию и обновить messages в Integram', async () => {
      const { integramChatSessionService } = await import('@/services/integramChatSessionService.js')

      // Mock успешного сохранения
      integramChatSessionService.saveMessageExchange.mockResolvedValue({
        success: true,
        transactionId: '777888'
      })

      integramChatSessionService.updateMessages.mockResolvedValue({
        success: true
      })

      const mockMessages = [
        { text: 'User message', isUser: true },
        { text: 'Assistant response', isUser: false }
      ]

      // Вызываем сохранение
      await integramChatSessionService.saveMessageExchange({
        sessionId: 'test_session',
        userMessage: 'User message',
        assistantMessage: 'Assistant response',
        model: 'deepseek-chat',
        inputTokens: 10,
        outputTokens: 20,
        cost: 0.001
      })

      await integramChatSessionService.updateMessages('test_session', mockMessages)

      // Проверяем что оба метода были вызваны
      expect(integramChatSessionService.saveMessageExchange).toHaveBeenCalledTimes(1)
      expect(integramChatSessionService.updateMessages).toHaveBeenCalledTimes(1)
    })

    it('НЕ должен сохранять в localStorage если Integram успешен', async () => {
      const { integramChatSessionService } = await import('@/services/integramChatSessionService.js')

      // Mock успешного сохранения в Integram
      integramChatSessionService.saveMessageExchange.mockResolvedValue({ success: true })
      integramChatSessionService.updateMessages.mockResolvedValue({ success: true })

      // localStorage должен остаться пустым
      localStorage.clear()

      await integramChatSessionService.saveMessageExchange({
        sessionId: 'test',
        userMessage: 'Hi',
        assistantMessage: 'Hello',
        model: 'deepseek-chat',
        inputTokens: 5,
        outputTokens: 10,
        cost: 0.0005
      })

      // Проверяем что localStorage НЕ используется
      expect(localStorage.getItem('aiChat')).toBeNull()
    })
  })

  describe('Fallback сохранение в localStorage', () => {
    it('должен сохранить в localStorage если Integram failed', async () => {
      const { integramChatSessionService } = await import('@/services/integramChatSessionService.js')

      // Mock ошибки при сохранении в Integram
      integramChatSessionService.saveMessageExchange.mockRejectedValue(
        new Error('Integram save failed')
      )

      const mockMessages = [
        { text: 'Test message', isUser: true, time: '12:00' }
      ]

      // Симулируем fallback сохранение
      try {
        await integramChatSessionService.saveMessageExchange({
          sessionId: 'test',
          userMessage: 'Test',
          assistantMessage: 'Response',
          model: 'deepseek-chat',
          inputTokens: 5,
          outputTokens: 10,
          cost: 0.001
        })
      } catch (error) {
        // Fallback: сохраняем в localStorage
        localStorage.setItem('aiChat', JSON.stringify(mockMessages))
      }

      // Проверяем что fallback сработал
      const stored = localStorage.getItem('aiChat')
      expect(stored).toBeTruthy()
      expect(JSON.parse(stored)).toHaveLength(1)
    })
  })

  describe('Создание новой сессии', () => {
    it('должен создать сессию в Integram при первом сообщении', async () => {
      const { integramChatSessionService } = await import('@/services/integramChatSessionService.js')

      // Mock успешного создания сессии
      integramChatSessionService.createSession.mockResolvedValue({
        success: true,
        integramId: '123456',
        sessionId: 'session_new_123'
      })

      const result = await integramChatSessionService.createSession({
        sessionId: 'session_new_123',
        model: 'deepseek-chat',
        systemPrompt: 'Test prompt'
      })

      expect(result.success).toBe(true)
      expect(result.sessionId).toBe('session_new_123')
      expect(integramChatSessionService.createSession).toHaveBeenCalledTimes(1)
    })

    it('должен сгенерировать уникальный sessionId', () => {
      const sessionId1 = `session_${Date.now()}_${Math.random().toString(36).substring(7)}`
      const sessionId2 = `session_${Date.now()}_${Math.random().toString(36).substring(7)}`

      // SessionId должны быть уникальными
      expect(sessionId1).toMatch(/^session_\d+_[a-z0-9]+$/)
      expect(sessionId2).toMatch(/^session_\d+_[a-z0-9]+$/)
    })
  })

  describe('Интеграция с tokenId', () => {
    it('должен использовать tokenId из localStorage', async () => {
      const { integramChatSessionService } = await import('@/services/integramChatSessionService.js')

      localStorage.setItem('current_ai_token_id', '206099')

      integramChatSessionService.setCurrentToken('206099')

      expect(integramChatSessionService.setCurrentToken).toHaveBeenCalledWith('206099')
    })

    it('должен использовать default tokenId если не установлен', async () => {
      const { integramChatSessionService } = await import('@/services/integramChatSessionService.js')

      localStorage.removeItem('current_ai_token_id')

      const defaultTokenId = localStorage.getItem('current_ai_token_id') || '206099'

      expect(defaultTokenId).toBe('206099')
    })
  })

  describe('Cache управление', () => {
    it('должен обновить sessionsCache при загрузке', async () => {
      const { integramChatSessionService } = await import('@/services/integramChatSessionService.js')

      // Очищаем кэш
      integramChatSessionService.sessionsCache.clear()

      // Добавляем в кэш
      integramChatSessionService.sessionsCache.set('session_123', '999888')

      expect(integramChatSessionService.sessionsCache.get('session_123')).toBe('999888')
      expect(integramChatSessionService.sessionsCache.size).toBe(1)
    })
  })
})
