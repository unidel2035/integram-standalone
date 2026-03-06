/**
 * Workspace Chat Store - Manages workspace-level chat state
 * Issue #4299: Enable shared AI chat for each Git project (workspace)
 * Issue #4423: Natural language workspace chat with AI agent tool calling
 *
 * This store provides workspace-level chat functionality with AI agent tool calling.
 * Each workspace has its own chat session that can:
 * - Execute file operations (read, write, edit)
 * - Search code (glob, grep patterns)
 * - Perform git operations (status, commit, push, pull, diff)
 * - Run shell commands
 * Chat history is persisted in localStorage.
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { chatWithWorkspaceAgent } from '@/services/workspaceAIAgentService'
import { logger } from '@/utils/logger'
import { getDefaultModel } from '@/config/aiModels'
import { useAuthStore } from '@/stores/authStore'

export const useWorkspaceChatStore = defineStore('workspaceChat', () => {
  // LocalStorage keys
  const STORAGE_KEY = 'drondoc_workspace_chats'
  const MODEL_PREFERENCE_KEY = 'drondoc_workspace_chat_model_preference'

  /**
   * Load chat history from localStorage
   * @returns {Map} Workspace chats map
   */
  const loadFromStorage = () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        const map = new Map()
        Object.entries(parsed).forEach(([workspaceId, chatData]) => {
          map.set(workspaceId, chatData)
        })
        logger.info('Loaded workspace chat history from localStorage')
        return map
      }
    } catch (error) {
      logger.error('Failed to load workspace chat history from localStorage:', error)
    }
    return new Map()
  }

  /**
   * Save chat history to localStorage
   * @param {Map} chats - Workspace chats map
   */
  const saveToStorage = (chats) => {
    try {
      const obj = {}
      chats.forEach((chatData, workspaceId) => {
        obj[workspaceId] = chatData
      })
      localStorage.setItem(STORAGE_KEY, JSON.stringify(obj))
      logger.debug('Saved workspace chat history to localStorage')
    } catch (error) {
      logger.error('Failed to save workspace chat history to localStorage:', error)
    }
  }

  /**
   * Load model preference from localStorage
   * @returns {string|null} Preferred model ID
   */
  const loadModelPreference = () => {
    try {
      const stored = localStorage.getItem(MODEL_PREFERENCE_KEY)
      if (stored) {
        return JSON.parse(stored)
      }
    } catch (error) {
      logger.error('Failed to load model preference from localStorage:', error)
    }
    return null
  }

  /**
   * Save model preference to localStorage
   * @param {string} modelId - Model ID to save
   */
  const saveModelPreference = (modelId) => {
    try {
      localStorage.setItem(MODEL_PREFERENCE_KEY, JSON.stringify(modelId))
      logger.debug('Saved model preference to localStorage:', modelId)
    } catch (error) {
      logger.error('Failed to save model preference to localStorage:', error)
    }
  }

  // State: workspace ID → chat data mapping
  // Load initial state from localStorage
  const workspaceChats = ref(loadFromStorage())

  // Current active workspace ID
  const activeWorkspaceId = ref(null)

  // Selected AI model ID (defaults to user preference or system default)
  const selectedModelId = ref(loadModelPreference() || getDefaultModel().id)

  /**
   * Get or initialize chat data for a workspace
   * @param {string} workspaceId - Workspace identifier
   * @returns {object} Chat data object
   */
  const getOrInitChat = (workspaceId) => {
    if (!workspaceChats.value.has(workspaceId)) {
      workspaceChats.value.set(workspaceId, {
        messages: [],
        loading: false,
        error: null,
        sessionId: null
      })
    }
    return workspaceChats.value.get(workspaceId)
  }

  /**
   * Set active workspace
   * @param {string} workspaceId - Workspace identifier
   */
  const setActiveWorkspace = (workspaceId) => {
    activeWorkspaceId.value = workspaceId
    getOrInitChat(workspaceId) // Ensure initialized
  }

  /**
   * Get current workspace chat data
   * @returns {object|null} Current chat data or null
   */
  const currentChat = computed(() => {
    if (!activeWorkspaceId.value) return null
    return workspaceChats.value.get(activeWorkspaceId.value) || null
  })

  /**
   * Add a message to workspace chat
   * @param {string} workspaceId - Workspace identifier
   * @param {object} message - Message object
   * @param {string} message.text - Message text
   * @param {boolean} message.isUser - Is user message
   * @param {string} message.time - Message timestamp
   * @param {array} message.toolCalls - Tool execution history (optional)
   */
  const addMessage = (workspaceId, message) => {
    const chat = getOrInitChat(workspaceId)
    chat.messages.push({
      text: message.text,
      isUser: message.isUser,
      time: message.time || new Date().toLocaleTimeString('ru-RU', {
        hour: '2-digit',
        minute: '2-digit'
      }),
      attachments: message.attachments || [],
      toolCalls: message.toolCalls || []
    })
    // Save to localStorage after adding message
    saveToStorage(workspaceChats.value)
  }

  /**
   * Send a message to workspace AI agent
   * Uses AI agent with tool calling for natural language workspace operations
   * @param {string} workspaceId - Workspace identifier
   * @param {string} text - Message text
   * @param {function} onChunk - Callback for streaming chunks (optional)
   * @returns {Promise<void>}
   */
  const sendMessage = async (workspaceId, text, onChunk = null) => {
    const chat = getOrInitChat(workspaceId)

    if (!text.trim()) {
      chat.error = 'Сообщение не может быть пустым'
      return
    }

    // Add user message
    addMessage(workspaceId, {
      text,
      isUser: true
    })

    chat.loading = true
    chat.error = null

    try {
      logger.info(`Sending workspace AI agent message for workspace ${workspaceId}`)

      // Create assistant message placeholder for streaming
      const assistantMessage = {
        text: '',
        isUser: false,
        time: new Date().toLocaleTimeString('ru-RU', {
          hour: '2-digit',
          minute: '2-digit'
        }),
        toolCalls: []
      }
      chat.messages.push(assistantMessage)

      // Track tool executions
      const toolExecutions = []

      // Get userId from auth store
      const authStore = useAuthStore()
      const userId = authStore.primaryUserId || localStorage.getItem('id') || 'default-user'

      logger.info(`Using userId: ${userId} for workspace ${workspaceId}`)

      // Send message to workspace AI agent with SSE streaming
      await chatWithWorkspaceAgent(
        workspaceId,
        text,
        userId,
        {
          sessionId: chat.sessionId,
          modelId: selectedModelId.value, // Use selected model
          onMessageStart: (data) => {
            logger.debug('Message started', data)
          },
          onContentDelta: (data) => {
            // Update assistant message with streaming text chunks
            assistantMessage.text += data.text || ''
            if (onChunk) {
              onChunk({ type: 'text', text: data.text })
            }
            // Save after each chunk to persist progress
            saveToStorage(workspaceChats.value)
          },
          onToolUse: (data) => {
            // AI is executing a tool
            logger.info('Tool execution started', {
              tool: data.name,
              input: data.input
            })
            toolExecutions.push({
              id: data.id,
              name: data.name,
              input: data.input,
              status: 'executing'
            })
            assistantMessage.toolCalls = [...toolExecutions]
            if (onChunk) {
              onChunk({ type: 'tool_use', ...data })
            }
            // Save to show tool execution in progress
            saveToStorage(workspaceChats.value)
          },
          onToolResult: (data) => {
            // Tool execution completed
            logger.info('Tool execution completed', {
              toolUseId: data.tool_use_id,
              success: data.success
            })
            const tool = toolExecutions.find(t => t.id === data.tool_use_id)
            if (tool) {
              tool.status = data.success ? 'success' : 'error'
              tool.result = data
            }
            assistantMessage.toolCalls = [...toolExecutions]
            if (onChunk) {
              onChunk({ type: 'tool_result', ...data })
            }
            // Save to show tool result
            saveToStorage(workspaceChats.value)
          },
          onMessageComplete: (data) => {
            logger.info('Message completed', {
              usage: data.usage
            })
            if (onChunk) {
              onChunk({ type: 'complete', usage: data.usage })
            }
          },
          onError: (error) => {
            logger.error('AI agent error', { error })
            chat.error = error
          }
        }
      )

      logger.info(`Workspace AI agent message sent successfully for workspace ${workspaceId}`)
      // Final save
      saveToStorage(workspaceChats.value)
    } catch (error) {
      logger.error('Failed to send workspace AI agent message:', error)
      chat.error = error.message || 'Не удалось отправить сообщение'

      // Remove the placeholder assistant message on error
      if (chat.messages.length > 0 && !chat.messages[chat.messages.length - 1].isUser) {
        chat.messages.pop()
      }
    } finally {
      chat.loading = false
      // Final save on completion or error
      saveToStorage(workspaceChats.value)
    }
  }

  /**
   * Clear chat history for a workspace
   * @param {string} workspaceId - Workspace identifier
   */
  const clearChat = (workspaceId) => {
    const chat = getOrInitChat(workspaceId)
    chat.messages = []
    chat.error = null
    chat.sessionId = null
    logger.info(`Cleared workspace chat for workspace ${workspaceId}`)
    // Save to localStorage after clearing
    saveToStorage(workspaceChats.value)
  }

  /**
   * Get chat messages for a workspace
   * @param {string} workspaceId - Workspace identifier
   * @returns {array} Array of messages
   */
  const getMessages = (workspaceId) => {
    const chat = workspaceChats.value.get(workspaceId)
    return chat ? chat.messages : []
  }

  /**
   * Check if workspace chat is loading
   * @param {string} workspaceId - Workspace identifier
   * @returns {boolean} Loading state
   */
  const isLoading = (workspaceId) => {
    const chat = workspaceChats.value.get(workspaceId)
    return chat ? chat.loading : false
  }

  /**
   * Get error for workspace chat
   * @param {string} workspaceId - Workspace identifier
   * @returns {string|null} Error message or null
   */
  const getError = (workspaceId) => {
    const chat = workspaceChats.value.get(workspaceId)
    return chat ? chat.error : null
  }

  /**
   * Sync file chat message to workspace chat
   * This allows file-level chat history to appear in workspace chat
   * @param {string} workspaceId - Workspace identifier
   * @param {string} filepath - File path
   * @param {object} message - Message object
   */
  const syncFromFileChat = (workspaceId, filepath, message) => {
    addMessage(workspaceId, {
      ...message,
      fileContext: filepath // Mark message as coming from file chat
    })
    logger.debug(`Synced file chat message from ${filepath} to workspace ${workspaceId}`)
  }

  /**
   * Set selected AI model
   * @param {string} modelId - Model ID to select
   */
  const setSelectedModel = (modelId) => {
    selectedModelId.value = modelId
    saveModelPreference(modelId)
    logger.info(`Selected AI model changed to: ${modelId}`)
  }

  return {
    // State
    activeWorkspaceId,
    currentChat,
    selectedModelId,

    // Actions
    setActiveWorkspace,
    setSelectedModel,
    addMessage,
    sendMessage,
    clearChat,
    getMessages,
    isLoading,
    getError,
    syncFromFileChat
  }
})
