// Voice Recognition Composable
// Issue #1275 - Web Speech API integration for voice input

import { ref, onUnmounted } from 'vue'

/**
 * Use Voice Recognition
 * Composable for Web Speech API integration
 */
export function useVoiceRecognition() {
  const isSupported = ref(false)
  const isListening = ref(false)
  const transcript = ref('')
  const interimTranscript = ref('')
  const error = ref(null)
  const recognition = ref(null)

  // Check for browser support
  if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
    isSupported.value = true
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    recognition.value = new SpeechRecognition()

    // Configure recognition
    recognition.value.continuous = false
    recognition.value.interimResults = true
    recognition.value.lang = 'ru-RU' // Russian language by default
    recognition.value.maxAlternatives = 1

    // Event handlers
    recognition.value.onstart = () => {
      isListening.value = true
      error.value = null
      transcript.value = ''
      interimTranscript.value = ''
    }

    recognition.value.onresult = (event) => {
      let interimText = ''
      let finalText = ''

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcriptPart = event.results[i][0].transcript
        if (event.results[i].isFinal) {
          finalText += transcriptPart
        } else {
          interimText += transcriptPart
        }
      }

      transcript.value = finalText
      interimTranscript.value = interimText
    }

    recognition.value.onerror = (event) => {
      error.value = event.error
      isListening.value = false

      // Map error codes to user-friendly messages
      const errorMessages = {
        'no-speech': 'Речь не обнаружена. Попробуйте еще раз.',
        'audio-capture': 'Микрофон недоступен. Проверьте разрешения.',
        'not-allowed': 'Доступ к микрофону запрещен.',
        'network': 'Ошибка сети. Проверьте подключение.',
        'aborted': 'Распознавание прервано.',
        'service-not-allowed': 'Служба распознавания речи недоступна.'
      }

      error.value = errorMessages[event.error] || `Ошибка: ${event.error}`
    }

    recognition.value.onend = () => {
      isListening.value = false
    }
  }

  /**
   * Start voice recognition
   * @param {Object} options - Recognition options
   */
  const startListening = (options = {}) => {
    if (!isSupported.value) {
      error.value = 'Распознавание речи не поддерживается в этом браузере'
      return
    }

    if (isListening.value) {
      return
    }

    // Apply options
    if (options.lang) {
      recognition.value.lang = options.lang
    }
    if (options.continuous !== undefined) {
      recognition.value.continuous = options.continuous
    }
    if (options.interimResults !== undefined) {
      recognition.value.interimResults = options.interimResults
    }

    try {
      recognition.value.start()
    } catch (err) {
      error.value = `Не удалось запустить распознавание: ${err.message}`
    }
  }

  /**
   * Stop voice recognition
   */
  const stopListening = () => {
    if (!isListening.value || !recognition.value) {
      return
    }

    try {
      recognition.value.stop()
    } catch (err) {
      console.error('Error stopping recognition:', err)
    }
  }

  /**
   * Abort voice recognition
   */
  const abortListening = () => {
    if (!recognition.value) {
      return
    }

    try {
      recognition.value.abort()
      isListening.value = false
    } catch (err) {
      console.error('Error aborting recognition:', err)
    }
  }

  /**
   * Reset state
   */
  const reset = () => {
    transcript.value = ''
    interimTranscript.value = ''
    error.value = null
  }

  /**
   * Change recognition language
   */
  const setLanguage = (lang) => {
    if (recognition.value) {
      recognition.value.lang = lang
    }
  }

  // Cleanup on unmount
  onUnmounted(() => {
    if (recognition.value && isListening.value) {
      recognition.value.stop()
    }
  })

  return {
    isSupported,
    isListening,
    transcript,
    interimTranscript,
    error,
    startListening,
    stopListening,
    abortListening,
    reset,
    setLanguage
  }
}

export default useVoiceRecognition
