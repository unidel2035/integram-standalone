/**
 * usePageTutor.js - Composable for Page AI Tutor
 * Issue #111: AI assistant for contextual help on every page
 *
 * Provides context-aware AI chat functionality for each page module
 */

import { ref, computed } from 'vue'
import { useToast } from 'primevue/usetoast'

/**
 * Page Tutor Composable
 * @param {Object} config - Configuration object
 * @param {string} config.page - Page identifier (e.g., 'fst-committee')
 * @param {string} config.systemPrompt - System prompt for AI context
 * @param {Array<string>} config.quickQuestions - Quick question chips
 * @param {Function} config.getContext - Function to get current page context data
 * @returns {Object} Tutor state and methods
 */
export function usePageTutor(config = {}) {
  const toast = useToast()

  // ==================== Configuration ====================
  const pageId = config.page || 'unknown'
  const systemPrompt = config.systemPrompt || 'Ты — AI-наставник платформы VentureOS.'
  const quickQuestions = config.quickQuestions || []
  const getContext = config.getContext || (() => ({}))

  // ==================== State ====================
  const isOpen = ref(false)
  const messages = ref([])
  const currentMessage = ref('')
  const isLoading = ref(false)
  const sessionId = ref(`tutor-${pageId}-${Date.now()}`)

  // ==================== Computed ====================
  const hasMessages = computed(() => messages.value.length > 0)

  // ==================== Methods ====================

  /**
   * Open tutor chat panel
   */
  function openTutor() {
    isOpen.value = true

    // Load session from sessionStorage if exists
    const savedSession = sessionStorage.getItem(`pageTutor_${pageId}`)
    if (savedSession) {
      try {
        const parsed = JSON.parse(savedSession)
        messages.value = parsed.messages || []
        sessionId.value = parsed.sessionId || sessionId.value
      } catch (e) {
        console.error('[PageTutor] Failed to load session:', e)
      }
    }

    // Add welcome message if no messages
    if (messages.value.length === 0) {
      messages.value.push({
        id: Date.now(),
        role: 'assistant',
        content: 'Здравствуйте! Я AI-наставник этой страницы. Задайте мне вопрос о функциональности или выберите быстрый вопрос ниже.',
        timestamp: new Date()
      })
    }
  }

  /**
   * Close tutor chat panel
   */
  function closeTutor() {
    isOpen.value = false
  }

  /**
   * Toggle tutor chat panel
   */
  function toggleTutor() {
    if (isOpen.value) {
      closeTutor()
    } else {
      openTutor()
    }
  }

  /**
   * Send message to AI
   * @param {string} message - User message
   */
  async function sendMessage(message = currentMessage.value) {
    if (!message?.trim()) {
      return
    }

    const userMessage = {
      id: Date.now(),
      role: 'user',
      content: message.trim(),
      timestamp: new Date()
    }

    messages.value.push(userMessage)
    currentMessage.value = ''
    isLoading.value = true

    // Save to session
    saveSession()

    try {
      // Get current page context
      const pageContext = getContext()

      // Build enhanced system prompt with context
      // Extract ontology section (pre-formatted) from the rest of the context
      const { ontology, ...restContext } = pageContext || {}
      const contextStr = Object.keys(restContext).length
        ? JSON.stringify(restContext, null, 2)
        : ''
      const ontologySection = ontology ? `\n\n**Онтологический контекст:**\n${ontology}` : ''

      const enhancedSystemPrompt = `${systemPrompt}

**Текущая страница:** ${pageId}
**Контекст:**
${contextStr}${ontologySection}

Отвечай кратко и по делу. Используй контекст страницы для точных ответов.`

      // Build conversation history (last 10 user/assistant messages, excluding welcome)
      const history = messages.value
        .filter(m => (m.role === 'user' || m.role === 'assistant') && !m.isError && m.content)
        .slice(-10)
        .map(m => ({ role: m.role, content: m.content }))

      // Call AI endpoint with streaming
      const response = await fetch('/api/ai-tokens/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modelId: 'deepseek/deepseek-chat',
          prompt: message.trim(),
          systemPrompt: enhancedSystemPrompt,
          messages: history,
          application: `PageTutor-${pageId}`
        })
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      const fullText = data.response || 'Извините, не удалось получить ответ.'

      // Typewriter effect: add message with empty content, then fill character by character
      const aiMessage = {
        id: Date.now() + 1,
        role: 'assistant',
        content: '',
        timestamp: new Date()
      }
      messages.value.push(aiMessage)

      const chunkSize = 3
      for (let i = 0; i < fullText.length; i += chunkSize) {
        aiMessage.content = fullText.slice(0, i + chunkSize)
        await new Promise(r => setTimeout(r, 12))
      }
      aiMessage.content = fullText

      // Save to session
      saveSession()

    } catch (error) {
      console.error('[PageTutor] AI error:', error)

      const errorMessage = {
        id: Date.now() + 1,
        role: 'assistant',
        content: `Ошибка при обращении к AI: ${error.message}`,
        timestamp: new Date(),
        isError: true
      }

      messages.value.push(errorMessage)

      toast.add({
        severity: 'error',
        summary: 'Ошибка AI',
        detail: 'Не удалось получить ответ от AI-наставника',
        life: 3000
      })
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Ask a specific question (from quick questions)
   * @param {string} question - Predefined question
   */
  async function askAbout(question) {
    currentMessage.value = question
    await sendMessage(question)
  }

  /**
   * Clear chat history
   */
  function clearChat() {
    messages.value = []
    sessionStorage.removeItem(`pageTutor_${pageId}`)

    // Add welcome message
    messages.value.push({
      id: Date.now(),
      role: 'assistant',
      content: 'История очищена. Чем могу помочь?',
      timestamp: new Date()
    })
  }

  /**
   * Save session to sessionStorage
   */
  function saveSession() {
    try {
      sessionStorage.setItem(`pageTutor_${pageId}`, JSON.stringify({
        sessionId: sessionId.value,
        messages: messages.value,
        timestamp: Date.now()
      }))
    } catch (e) {
      console.error('[PageTutor] Failed to save session:', e)
    }
  }

  // ==================== Return API ====================
  return {
    // State
    isOpen,
    messages,
    currentMessage,
    isLoading,
    hasMessages,
    quickQuestions,

    // Methods
    openTutor,
    closeTutor,
    toggleTutor,
    sendMessage,
    askAbout,
    clearChat
  }
}
