/**
 * Voice Assistant Service for Video Conference
 *
 * Provides voice-controlled AI assistant with:
 * - Speech recognition (via TranscriptionService)
 * - Text-to-speech for responses
 * - Command processing and execution
 * - Meeting transcript management
 * - Background task execution
 */

import TranscriptionService from './TranscriptionService'
import { getDefaultToken } from './aiTokenService'

export default class VoiceAssistantService {
  constructor() {
    this.transcriptionService = new TranscriptionService()
    this.isListening = false
    this.isProcessing = false
    this.isSpeaking = false

    // Text-to-speech
    this.synthesis = window.speechSynthesis
    this.voice = null

    // Meeting transcript
    this.meetingTranscript = []
    this.commandHistory = []

    // Callbacks
    this.onTranscriptUpdate = null
    this.onCommandDetected = null
    this.onResponse = null
    this.onError = null

    // AI token
    this.aiToken = null
    this.aiModel = null

    // Check browser support
    this.isSTTSupported = TranscriptionService.isSupported()
    this.isTTSSupported = 'speechSynthesis' in window

    // Wake word detection
    this.wakeWords = ['ассистент', 'помощник', 'assistant']
    this.isAwake = true // Always listening in meeting context

    // Initialize TTS voice
    this._initializeTTSVoice()
  }

  /**
   * Initialize text-to-speech voice
   * @private
   */
  _initializeTTSVoice() {
    if (!this.isTTSSupported) return

    const setVoice = () => {
      const voices = this.synthesis.getVoices()
      // Prefer Russian voice
      this.voice = voices.find(v => v.lang.startsWith('ru')) || voices[0]
    }

    // Voices load asynchronously
    if (this.synthesis.getVoices().length) {
      setVoice()
    } else {
      this.synthesis.onvoiceschanged = setVoice
    }
  }

  /**
   * Start voice assistant
   * @param {MediaStream} audioStream - Audio stream from microphone
   * @param {string} userId - User ID for AI token
   * @param {Object} options - Configuration options
   */
  async start(audioStream, userId, options = {}) {
    try {
      // Try to get AI token for the user
      try {
        const { token, defaultModel } = await getDefaultToken(userId)
        this.aiToken = token
        this.aiModel = defaultModel
      } catch (tokenError) {
        console.warn('Failed to get AI token, voice assistant will work in limited mode:', tokenError)
        // Continue without AI token - assistant will still do transcription
        // but won't be able to process commands with AI
        this.aiToken = null
        this.aiModel = null
      }

      // Set callbacks
      this.onTranscriptUpdate = options.onTranscriptUpdate
      this.onCommandDetected = options.onCommandDetected
      this.onResponse = options.onResponse
      this.onError = options.onError

      // Start transcription
      this.transcriptionService.start(
        audioStream,
        (text, speaker) => this._handleTranscript(text, speaker),
        options.language || 'ru-RU'
      )

      this.isListening = true

      // Announce ready with appropriate message
      if (this.aiToken) {
        this.speak('Голосовой ассистент активирован. Я готов помочь вам.')
      } else {
        this.speak('Голосовой ассистент активирован в режиме транскрипции. AI команды недоступны.')
      }

      return true
    } catch (error) {
      console.error('Failed to start voice assistant:', error)
      if (this.onError) {
        this.onError(error)
      }
      throw error
    }
  }

  /**
   * Stop voice assistant
   */
  stop() {
    this.transcriptionService.stop()
    this.isListening = false

    // Cancel any ongoing speech
    if (this.synthesis.speaking) {
      this.synthesis.cancel()
    }

    this.isSpeaking = false
  }

  /**
   * Handle transcribed text
   * @private
   */
  _handleTranscript(text, speaker) {
    // Add to meeting transcript
    const entry = {
      timestamp: Date.now(),
      speaker,
      text
    }
    this.meetingTranscript.push(entry)

    // Notify about transcript update
    if (this.onTranscriptUpdate) {
      this.onTranscriptUpdate(text, speaker)
    }

    // Check for commands
    if (this._isCommand(text)) {
      this._processCommand(text)
    }
  }

  /**
   * Check if text is a command
   * @private
   */
  _isCommand(text) {
    const lowerText = text.toLowerCase()

    // Command patterns
    const commandPatterns = [
      'создай issue',
      'создай задачу',
      'найди',
      'найти',
      'поиск',
      'резюме встречи',
      'сводка встречи',
      'итоги встречи',
      'запиши',
      'сохрани',
      'что обсуждали',
      'помоги',
      'расскажи'
    ]

    return commandPatterns.some(pattern => lowerText.includes(pattern))
  }

  /**
   * Process voice command
   * @private
   */
  async _processCommand(text) {
    if (this.isProcessing) {
      this.speak('Обрабатываю предыдущую команду. Пожалуйста, подождите.')
      return
    }

    // Check if AI token is available
    if (!this.aiToken) {
      this.speak('AI команды недоступны. Бэкенд DronDoc не подключен.')
      if (this.onError) {
        this.onError(new Error('AI backend unavailable'))
      }
      return
    }

    this.isProcessing = true

    // Notify about command detection
    if (this.onCommandDetected) {
      this.onCommandDetected(text)
    }

    try {
      // Add to command history
      this.commandHistory.push({
        timestamp: Date.now(),
        command: text,
        status: 'processing'
      })

      // Parse and execute command
      const response = await this._executeCommand(text)

      // Update command history
      this.commandHistory[this.commandHistory.length - 1].status = 'completed'
      this.commandHistory[this.commandHistory.length - 1].response = response

      // Notify and speak response
      if (this.onResponse) {
        this.onResponse(response)
      }

      this.speak(response.message || 'Команда выполнена')

    } catch (error) {
      console.error('Command execution error:', error)

      this.commandHistory[this.commandHistory.length - 1].status = 'failed'
      this.commandHistory[this.commandHistory.length - 1].error = error.message

      if (this.onError) {
        this.onError(error)
      }

      this.speak('Извините, не удалось выполнить команду. ' + error.message)
    } finally {
      this.isProcessing = false
    }
  }

  /**
   * Execute command using AI
   * @private
   */
  async _executeCommand(commandText) {
    // Always use relative URL to avoid CORS issues
    const API_BASE_URL = '/api'

    // Send command to AI for processing
    const response = await fetch(`${API_BASE_URL}/ai-tokens/chat`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.aiToken.id}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        modelId: this.aiModel.id,
        prompt: this._buildCommandPrompt(commandText),
        application: 'VideoConferenceAssistant',
        operation: 'command',
        temperature: 0.2,
        maxTokens: 2048
      })
    })

    if (!response.ok) {
      throw new Error('Failed to process command with AI')
    }

    const result = await response.json()

    // Parse AI response and execute action
    return this._parseAndExecuteAction(result.completion || result.message, commandText)
  }

  /**
   * Build prompt for AI command processing
   * @private
   */
  _buildCommandPrompt(commandText) {
    const recentTranscript = this.meetingTranscript
      .slice(-20) // Last 20 entries
      .map(entry => `${entry.speaker}: ${entry.text}`)
      .join('\n')

    return `Ты - голосовой ассистент на видеоконференции. Пользователь дал команду: "${commandText}"

Последние сообщения со встречи:
${recentTranscript}

Проанализируй команду и определи действие. Возможные действия:
1. "summary" - создать резюме встречи
2. "create_issue" - создать issue на GitHub
3. "search" - поиск информации
4. "help" - помощь/объяснение

Ответь в формате JSON:
{
  "action": "название действия",
  "params": { параметры действия },
  "message": "краткое сообщение пользователю на русском"
}

Если команда неясна, используй action: "help" и объясни что можешь сделать.`
  }

  /**
   * Parse AI response and execute action
   * @private
   */
  async _parseAndExecuteAction(aiResponse, originalCommand) {
    try {
      // Try to extract JSON from response
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        throw new Error('Не удалось распознать команду')
      }

      const action = JSON.parse(jsonMatch[0])

      // Execute action based on type
      switch (action.action) {
        case 'summary':
          return await this._generateMeetingSummary()

        case 'create_issue':
          return await this._createGitHubIssue(action.params)

        case 'search':
          return await this._performSearch(action.params)

        case 'help':
        default:
          return {
            action: 'help',
            message: action.message || 'Я могу создать резюме встречи, создать issue на GitHub, или найти информацию.'
          }
      }
    } catch (error) {
      console.error('Action parsing error:', error)
      return {
        action: 'error',
        message: 'Не удалось распознать команду. Попробуйте сформулировать иначе.'
      }
    }
  }

  /**
   * Generate meeting summary
   * @private
   */
  async _generateMeetingSummary() {
    // Get full transcript
    const fullTranscript = this.meetingTranscript
      .map(entry => `[${new Date(entry.timestamp).toLocaleTimeString()}] ${entry.speaker}: ${entry.text}`)
      .join('\n')

    // If AI is not available, return simple transcript summary
    if (!this.aiToken) {
      return {
        action: 'summary',
        summary: 'AI резюме недоступно. Ниже полный транскрипт встречи.',
        transcript: this.meetingTranscript,
        message: 'Транскрипт встречи готов. AI резюме недоступно без подключения к бэкенду.'
      }
    }

    // Always use relative URL to avoid CORS issues
    const API_BASE_URL = '/api'

    // Generate summary with AI
    const response = await fetch(`${API_BASE_URL}/ai-tokens/chat`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.aiToken.id}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        modelId: this.aiModel.id,
        prompt: `Создай краткое резюме видеоконференции на русском языке. Включи:
1. Основные темы обсуждения
2. Принятые решения
3. Задачи и ответственных (если упоминались)
4. Следующие шаги

Транскрипт встречи:
${fullTranscript}

Формат ответа - структурированный текст на русском языке.`,
        application: 'VideoConferenceAssistant',
        operation: 'summary',
        temperature: 0.3,
        maxTokens: 2048
      })
    })

    if (!response.ok) {
      throw new Error('Failed to generate summary')
    }

    const result = await response.json()
    const summary = result.completion || result.message

    return {
      action: 'summary',
      summary,
      transcript: this.meetingTranscript,
      message: 'Резюме встречи готово. Я отправил его в чат.'
    }
  }

  /**
   * Create GitHub issue
   * @private
   */
  async _createGitHubIssue(params) {
    // This would integrate with GitHub API
    // For now, return a placeholder response
    return {
      action: 'create_issue',
      message: 'Функция создания issue будет реализована при интеграции с GitHub API. Опишите задачу в чате, и я помогу оформить её.'
    }
  }

  /**
   * Perform search
   * @private
   */
  async _performSearch(params) {
    return {
      action: 'search',
      message: 'Функция поиска будет реализована в следующей версии. Пожалуйста, уточните что вы ищете.'
    }
  }

  /**
   * Speak text using TTS
   * @param {string} text - Text to speak
   */
  speak(text) {
    if (!this.isTTSSupported) {
      console.warn('Text-to-speech not supported')
      return
    }

    // Cancel any ongoing speech
    if (this.synthesis.speaking) {
      this.synthesis.cancel()
    }

    const utterance = new SpeechSynthesisUtterance(text)
    utterance.voice = this.voice
    utterance.rate = 1.0
    utterance.pitch = 1.0
    utterance.volume = 1.0
    utterance.lang = 'ru-RU'

    utterance.onstart = () => {
      this.isSpeaking = true
    }

    utterance.onend = () => {
      this.isSpeaking = false
    }

    utterance.onerror = (error) => {
      console.error('TTS error:', error)
      this.isSpeaking = false
    }

    this.synthesis.speak(utterance)
  }

  /**
   * Get meeting transcript
   */
  getTranscript() {
    return this.meetingTranscript
  }

  /**
   * Get command history
   */
  getCommandHistory() {
    return this.commandHistory
  }

  /**
   * Export meeting summary
   */
  async exportSummary() {
    const summary = await this._generateMeetingSummary()

    const content = `# Резюме видеоконференции
Дата: ${new Date().toLocaleString('ru-RU')}

${summary.summary}

---

## Полный транскрипт

${this.meetingTranscript.map(entry =>
  `**${entry.speaker}** (${new Date(entry.timestamp).toLocaleTimeString()}): ${entry.text}`
).join('\n\n')}
`

    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `meeting-summary-${Date.now()}.md`
    a.click()
    URL.revokeObjectURL(url)

    return summary
  }

  /**
   * Check if assistant is supported in browser
   */
  static isSupported() {
    return TranscriptionService.isSupported() && 'speechSynthesis' in window
  }
}
