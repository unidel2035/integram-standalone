/**
 * Chat Store - Manages chat state and visibility
 *
 * This store provides a centralized way to manage chat state across the application.
 * It uses localStorage to persist chat visibility state and synchronizes across tabs.
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useChatStore = defineStore('chat', () => {
  // State
  const isOpen = ref(false)
  const chatWidth = ref(320)

  // Initialize from localStorage
  const init = () => {
    // Load chat state
    const savedState = localStorage.getItem('chat')
    if (savedState !== null) {
      try {
        isOpen.value = JSON.parse(savedState)
      } catch (e) {
        console.error('Failed to parse chat state:', e)
        isOpen.value = false
      }
    }

    // Load chat width
    const savedWidth = localStorage.getItem('chatWidth')
    if (savedWidth !== null) {
      chatWidth.value = parseInt(savedWidth) || 320
    }

    // Listen for storage changes (cross-tab sync)
    window.addEventListener('storage', handleStorageChange)
  }

  const handleStorageChange = (e) => {
    if (e.key === 'chat' && e.newValue !== null) {
      try {
        isOpen.value = JSON.parse(e.newValue)
      } catch (err) {
        console.error('Failed to parse chat state from storage event:', err)
      }
    }
    if (e.key === 'chatWidth' && e.newValue !== null) {
      chatWidth.value = parseInt(e.newValue) || 320
    }
  }

  // Actions
  const toggleChat = () => {
    isOpen.value = !isOpen.value
    localStorage.setItem('chat', JSON.stringify(isOpen.value))

    // Dispatch storage event for cross-component sync
    window.dispatchEvent(new StorageEvent('storage', {
      key: 'chat',
      newValue: JSON.stringify(isOpen.value),
      storageArea: localStorage
    }))
  }

  const openChat = () => {
    if (!isOpen.value) {
      toggleChat()
    }
  }

  const closeChat = () => {
    if (isOpen.value) {
      toggleChat()
    }
  }

  const setChatWidth = (width) => {
    chatWidth.value = width
    localStorage.setItem('chatWidth', String(width))
  }

  // Getters
  const isClosed = computed(() => !isOpen.value)

  // Initialize on store creation
  init()

  return {
    // State
    isOpen,
    chatWidth,

    // Getters
    isClosed,

    // Actions
    toggleChat,
    openChat,
    closeChat,
    setChatWidth
  }
})
