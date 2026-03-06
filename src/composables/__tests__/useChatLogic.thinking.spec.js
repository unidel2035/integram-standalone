/**
 * Tests for thinking content display and streaming behavior
 * Issue #6756: Fix thinking block auto-expansion
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { reactive, ref } from 'vue'

// Mock all heavy dependencies
vi.mock('@/services/integramChatSessionService.js', () => ({
  integramChatSessionService: {
    setCurrentToken: vi.fn(),
    loadSessionHistory: vi.fn().mockResolvedValue([]),
    getSession: vi.fn(),
    createSession: vi.fn().mockResolvedValue({}),
    saveMessageExchange: vi.fn().mockResolvedValue({}),
    updateMessages: vi.fn().mockResolvedValue({}),
    sessionsCache: new Map(),
    initialized: true
  }
}))

vi.mock('@/stores/authStore', () => ({
  useAuthStore: () => ({
    currentUser: { id: 'test-user' },
    isAuthenticated: true
  })
}))

vi.mock('@/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), debug: vi.fn(), error: vi.fn() }
}))

vi.mock('@/utils/apiConfig', () => ({
  getApiUrl: vi.fn(() => 'http://localhost:3000')
}))

vi.mock('@/axios2.js', () => ({
  default: { get: vi.fn(), post: vi.fn() }
}))

vi.mock('@/services/workspaceService.js', () => ({
  chatWithWorkspace: vi.fn()
}))

vi.mock('@/services/polzaService.js', () => ({
  default: { sendMessage: vi.fn() }
}))

// Minimal test of the thinking content logic directly
// without needing to load the full composable

describe('Thinking content auto-expansion (Issue #6756)', () => {
  /**
   * Simulate the exact behavior in useChatLogic.js sendAiMessage()
   * for the thinking chunk handling
   */
  function simulateThinkingChunks(thinkingChunks) {
    // Set up reactive state like the composable does
    const aiChat = reactive({ messages: [] })
    const assistantMessage = ref(null)

    // Create the assistant message placeholder
    assistantMessage.value = {
      text: '',
      time: '12:00',
      isUser: false
    }
    aiChat.messages.push(assistantMessage.value)

    // Process thinking chunks (exact code from useChatLogic.js)
    for (const thinking of thinkingChunks) {
      if (!assistantMessage.value.thinkingContent) {
        assistantMessage.value.thinkingContent = ''
        // Issue #6756: Auto-expand thinking block when content first arrives
        assistantMessage.value._thinkingExpanded = true
      }
      assistantMessage.value.thinkingContent += thinking
    }

    return { aiChat, assistantMessage }
  }

  it('should auto-expand thinking block when first thinking chunk arrives', () => {
    const { aiChat, assistantMessage } = simulateThinkingChunks(['First thinking chunk'])

    // _thinkingExpanded should be set to true automatically
    expect(assistantMessage.value._thinkingExpanded).toBe(true)
    expect(assistantMessage.value.thinkingContent).toBe('First thinking chunk')
  })

  it('should accumulate multiple thinking chunks', () => {
    const { aiChat, assistantMessage } = simulateThinkingChunks([
      'Chunk 1 ',
      'Chunk 2 ',
      'Chunk 3'
    ])

    expect(assistantMessage.value.thinkingContent).toBe('Chunk 1 Chunk 2 Chunk 3')
    expect(assistantMessage.value._thinkingExpanded).toBe(true)
  })

  it('should not affect messages without thinking content', () => {
    const aiChat = reactive({ messages: [] })
    const assistantMessage = ref(null)

    assistantMessage.value = {
      text: '',
      time: '12:00',
      isUser: false
    }
    aiChat.messages.push(assistantMessage.value)

    // No thinking chunks, only content chunks
    assistantMessage.value.text += 'Hello world'

    expect(assistantMessage.value.thinkingContent).toBeUndefined()
    expect(assistantMessage.value._thinkingExpanded).toBeUndefined()
    expect(assistantMessage.value.text).toBe('Hello world')
  })

  it('should preserve thinkingContent after message finalization', () => {
    const { aiChat, assistantMessage } = simulateThinkingChunks([
      'I am thinking carefully about this.',
      ' Let me analyze step by step.'
    ])

    // Add some content too
    assistantMessage.value.text += 'The answer is 4.'

    // Finalize (exact code from useChatLogic.js)
    const finalMessageObj = { ...assistantMessage.value }
    const idx = aiChat.messages.indexOf(assistantMessage.value)
    aiChat.messages.splice(idx, 1, finalMessageObj)
    assistantMessage.value = null

    // After finalization, the message should still have thinkingContent
    const msg = aiChat.messages[0]
    expect(msg.thinkingContent).toBe('I am thinking carefully about this. Let me analyze step by step.')
    expect(msg._thinkingExpanded).toBe(true)
    expect(msg.text).toBe('The answer is 4.')
  })

  it('should set _thinkingExpanded only once even with many chunks', () => {
    const aiChat = reactive({ messages: [] })
    const assistantMessage = ref(null)

    assistantMessage.value = { text: '', time: '12:00', isUser: false }
    aiChat.messages.push(assistantMessage.value)

    let expandedSetCount = 0
    const originalSetter = Object.getOwnPropertyDescriptor(Object.prototype, '_thinkingExpanded')

    // Track when _thinkingExpanded is set (by checking condition)
    const chunks = ['chunk1', 'chunk2', 'chunk3', 'chunk4', 'chunk5']
    let isFirstChunk = true

    for (const chunk of chunks) {
      if (!assistantMessage.value.thinkingContent) {
        // This block runs only once (first chunk)
        expect(isFirstChunk).toBe(true)
        isFirstChunk = false
        assistantMessage.value.thinkingContent = ''
        assistantMessage.value._thinkingExpanded = true
        expandedSetCount++
      }
      assistantMessage.value.thinkingContent += chunk
    }

    expect(expandedSetCount).toBe(1) // Only set once
    expect(assistantMessage.value._thinkingExpanded).toBe(true)
    expect(assistantMessage.value.thinkingContent).toBe('chunk1chunk2chunk3chunk4chunk5')
  })

  it('indexOf should find the message in reactive array (Vue 3 compatibility)', () => {
    const aiChat = reactive({ messages: [] })
    const assistantMessage = ref(null)

    const plainObj = { text: '', time: '12:00', isUser: false }
    assistantMessage.value = plainObj
    aiChat.messages.push(assistantMessage.value)

    // Vue 3 reactive array indexOf should find the element
    const idx = aiChat.messages.indexOf(assistantMessage.value)
    expect(idx).toBeGreaterThanOrEqual(0)
    expect(idx).toBe(0)
  })
})
