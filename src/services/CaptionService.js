import { logger } from '@/utils/logger'
import TranscriptionService from './TranscriptionService'
import { getDefaultToken, getCurrentUserId } from './aiTokenService'
import { getApiUrl } from '../utils/apiConfig'

const API_BASE_URL = getApiUrl('/api')

/**
 * Enhanced Caption Service for live captions with AI-powered features
 *
 * Features:
 * - Real-time speech-to-text with Web Speech API fallback
 * - AI-powered transcription with Whisper API (via DronDoc tokens)
 * - Automatic language detection
 * - Multi-language translation
 * - Caption history and timeline
 * - Export to SRT/VTT formats
 *
 * Issue #2353 - Live captions и мультиязычные субтитры
 */
export default class CaptionService {
  constructor() {
    this.transcriptionService = new TranscriptionService()
    this.isActive = false
    this.captions = [] // Array of caption objects with timestamps
    this.currentCaption = null
    this.onCaptionCallback = null
    this.onTranslationCallback = null

    // Configuration
    this.config = {
      sourceLanguage: 'auto', // Auto-detect or specific language code
      targetLanguages: [], // Languages to translate to
      maxCaptionLength: 100, // Characters per caption
      captionDuration: 5000, // ms before caption fades
      useAI: true, // Use AI-powered transcription when available
      showInterimResults: true // Show interim results for faster UX
    }

    // AI integration
    this.aiToken = null
    this.aiModel = null

    // Language detection buffer
    this.languageDetectionBuffer = []
    this.detectedLanguage = null
  }

  /**
   * Initialize caption service with AI token
   */
  async initialize(userId = null) {
    try {
      const effectiveUserId = userId || getCurrentUserId()
      const { token, defaultModel } = await getDefaultToken(effectiveUserId)

      this.aiToken = token
      this.aiModel = defaultModel

      logger.debug('CaptionService initialized with AI token', {
        tokenId: token.id,
        model: defaultModel.display_name
      })

      return true
    } catch (error) {
      logger.warn('Failed to initialize AI features for captions, falling back to Web Speech API', error)
      // Continue without AI features
      return false
    }
  }

  /**
   * Start live captions
   * @param {MediaStream} stream - Audio stream to caption
   * @param {Function} onCaption - Callback for new captions
   * @param {Object} options - Configuration options
   */
  async start(stream, onCaption, options = {}) {
    if (this.isActive) {
      throw new Error('Captions already active')
    }

    // Merge options with defaults
    this.config = { ...this.config, ...options }
    this.onCaptionCallback = onCaption
    this.captions = []
    this.isActive = true

    // Initialize AI if not already done
    if (!this.aiToken && this.config.useAI) {
      await this.initialize()
    }

    // Start transcription
    if (this.config.useAI && this.aiToken) {
      await this.startAITranscription(stream)
    } else {
      await this.startWebSpeechTranscription(stream)
    }

    logger.debug('Live captions started', { config: this.config })
  }

  /**
   * Start Web Speech API transcription (fallback)
   */
  async startWebSpeechTranscription(stream) {
    const language = this.config.sourceLanguage === 'auto' ? 'ru-RU' : this.config.sourceLanguage

    this.transcriptionService.start(
      stream,
      (text, speaker) => this.handleTranscript(text, speaker, language),
      language
    )
  }

  /**
   * Start AI-powered transcription via backend
   * Uses WebSocket for real-time streaming
   */
  async startAITranscription(stream) {
    try {
      // Use MediaRecorder to stream audio to backend
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      })

      let audioChunks = []

      mediaRecorder.addEventListener('dataavailable', async (event) => {
        if (event.data.size > 0) {
          audioChunks.push(event.data)

          // Send audio chunk to backend for transcription every second
          if (audioChunks.length >= 10) { // ~1 second of audio at 100ms chunks
            await this.transcribeAudioChunk(audioChunks)
            audioChunks = []
          }
        }
      })

      mediaRecorder.addEventListener('error', (error) => {
        logger.error('MediaRecorder error:', error)
        // Fallback to Web Speech API
        this.startWebSpeechTranscription(stream)
      })

      // Record in 100ms chunks for low latency
      mediaRecorder.start(100)

      this.mediaRecorder = mediaRecorder
    } catch (error) {
      logger.error('Failed to start AI transcription:', error)
      // Fallback to Web Speech API
      await this.startWebSpeechTranscription(stream)
    }
  }

  /**
   * Transcribe audio chunk using AI via DronDoc token
   */
  async transcribeAudioChunk(audioChunks) {
    try {
      const audioBlob = new Blob(audioChunks, { type: 'audio/webm' })

      const formData = new FormData()
      formData.append('audio', audioBlob, 'audio.webm')
      formData.append('language', this.config.sourceLanguage)
      formData.append('model', 'whisper-1') // OpenAI Whisper model

      const response = await fetch(`${API_BASE_URL}/ai-tokens/transcribe`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.aiToken.id}`
        },
        body: formData
      })

      if (!response.ok) {
        throw new Error('Transcription API request failed')
      }

      const result = await response.json()

      if (result.data && result.data.text) {
        const detectedLang = result.data.language || this.config.sourceLanguage
        this.handleTranscript(result.data.text, 'AI', detectedLang)
      }
    } catch (error) {
      logger.error('AI transcription error:', error)
      // Errors are logged but don't stop the service
    }
  }

  /**
   * Handle transcript from any source
   */
  handleTranscript(text, speaker, language) {
    if (!text || !this.isActive) return

    const timestamp = Date.now()

    // Create caption object
    const caption = {
      id: `caption-${timestamp}-${Math.random().toString(36).substr(2, 9)}`,
      text: text.trim(),
      speaker,
      language,
      timestamp,
      duration: this.config.captionDuration,
      translations: {}
    }

    // Add to history
    this.captions.push(caption)
    this.currentCaption = caption

    // Detect language if auto-detection enabled
    if (this.config.sourceLanguage === 'auto') {
      this.updateLanguageDetection(text, language)
    }

    // Trigger callback
    if (this.onCaptionCallback) {
      this.onCaptionCallback(caption)
    }

    // Translate if target languages specified
    if (this.config.targetLanguages.length > 0) {
      this.translateCaption(caption)
    }

    // Cleanup old captions
    this.cleanupOldCaptions()
  }

  /**
   * Update language detection based on transcript
   */
  updateLanguageDetection(text, language) {
    this.languageDetectionBuffer.push({ text, language, timestamp: Date.now() })

    // Keep only last 10 seconds of data
    const cutoff = Date.now() - 10000
    this.languageDetectionBuffer = this.languageDetectionBuffer.filter(
      item => item.timestamp > cutoff
    )

    // Determine most common language
    const languageCounts = {}
    this.languageDetectionBuffer.forEach(item => {
      languageCounts[item.language] = (languageCounts[item.language] || 0) + 1
    })

    const mostCommon = Object.entries(languageCounts).sort((a, b) => b[1] - a[1])[0]
    if (mostCommon) {
      this.detectedLanguage = mostCommon[0]
    }
  }

  /**
   * Translate caption to target languages using AI
   */
  async translateCaption(caption) {
    if (!this.aiToken) return

    for (const targetLang of this.config.targetLanguages) {
      try {
        const translation = await this.translateText(
          caption.text,
          caption.language,
          targetLang
        )

        caption.translations[targetLang] = translation

        // Trigger translation callback if set
        if (this.onTranslationCallback) {
          this.onTranslationCallback(caption, targetLang, translation)
        }
      } catch (error) {
        logger.error(`Translation to ${targetLang} failed:`, error)
      }
    }
  }

  /**
   * Translate text using AI via DronDoc token
   */
  async translateText(text, sourceLang, targetLang) {
    try {
      const response = await fetch(`${API_BASE_URL}/ai-tokens/chat`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.aiToken.id}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          modelId: this.aiModel.id,
          prompt: `Translate the following text from ${sourceLang} to ${targetLang}. Return only the translation, no explanations:\n\n${text}`,
          application: 'LiveCaptions',
          operation: 'translation',
          temperature: 0.3,
          maxTokens: 500
        })
      })

      if (!response.ok) {
        throw new Error('Translation API request failed')
      }

      const result = await response.json()
      return result.data.response || text
    } catch (error) {
      logger.error('Translation error:', error)
      return text // Return original text on error
    }
  }

  /**
   * Stop live captions
   */
  stop() {
    if (!this.isActive) return

    this.isActive = false

    // Stop transcription service
    if (this.transcriptionService.isTranscribing) {
      this.transcriptionService.stop()
    }

    // Stop media recorder if using AI
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop()
      this.mediaRecorder = null
    }

    logger.debug('Live captions stopped')
  }

  /**
   * Cleanup old captions from history
   */
  cleanupOldCaptions() {
    const cutoff = Date.now() - 60000 // Keep last 1 minute
    this.captions = this.captions.filter(caption => caption.timestamp > cutoff)
  }

  /**
   * Set target languages for translation
   */
  setTargetLanguages(languages) {
    this.config.targetLanguages = Array.isArray(languages) ? languages : [languages]
  }

  /**
   * Set source language
   */
  setSourceLanguage(language) {
    this.config.sourceLanguage = language

    if (this.transcriptionService.isTranscribing) {
      this.transcriptionService.setLanguage(language)
    }
  }

  /**
   * Get all captions
   */
  getCaptions() {
    return this.captions
  }

  /**
   * Get current caption
   */
  getCurrentCaption() {
    return this.currentCaption
  }

  /**
   * Get detected language
   */
  getDetectedLanguage() {
    return this.detectedLanguage
  }

  /**
   * Export captions as SRT file
   */
  exportSRT(filename = 'captions.srt') {
    const srt = this.generateSRT()
    const blob = new Blob([srt], { type: 'text/plain;charset=utf-8' })
    this.downloadFile(blob, filename)
  }

  /**
   * Export captions as VTT file
   */
  exportVTT(filename = 'captions.vtt') {
    const vtt = this.generateVTT()
    const blob = new Blob([vtt], { type: 'text/vtt;charset=utf-8' })
    this.downloadFile(blob, filename)
  }

  /**
   * Export captions as JSON
   */
  exportJSON(filename = 'captions.json') {
    const json = JSON.stringify(this.captions, null, 2)
    const blob = new Blob([json], { type: 'application/json;charset=utf-8' })
    this.downloadFile(blob, filename)
  }

  /**
   * Generate SRT format from captions
   */
  generateSRT() {
    let srt = ''
    let startTime = 0

    this.captions.forEach((caption, index) => {
      const endTime = startTime + caption.duration

      srt += `${index + 1}\n`
      srt += `${this.formatSRTTime(startTime)} --> ${this.formatSRTTime(endTime)}\n`
      srt += `${caption.text}\n\n`

      startTime = endTime + 100 // Small gap between captions
    })

    return srt
  }

  /**
   * Generate VTT format from captions
   */
  generateVTT() {
    let vtt = 'WEBVTT\n\n'
    let startTime = 0

    this.captions.forEach((caption, index) => {
      const endTime = startTime + caption.duration

      vtt += `${index + 1}\n`
      vtt += `${this.formatVTTTime(startTime)} --> ${this.formatVTTTime(endTime)}\n`
      vtt += `${caption.text}\n\n`

      // Add translations as separate cues if available
      Object.entries(caption.translations).forEach(([lang, translation]) => {
        vtt += `${index + 1}-${lang}\n`
        vtt += `${this.formatVTTTime(startTime)} --> ${this.formatVTTTime(endTime)}\n`
        vtt += `[${lang}] ${translation}\n\n`
      })

      startTime = endTime + 100
    })

    return vtt
  }

  /**
   * Format time for SRT (HH:MM:SS,mmm)
   */
  formatSRTTime(milliseconds) {
    const hours = Math.floor(milliseconds / 3600000)
    const minutes = Math.floor((milliseconds % 3600000) / 60000)
    const seconds = Math.floor((milliseconds % 60000) / 1000)
    const ms = milliseconds % 1000

    return `${this.pad(hours)}:${this.pad(minutes)}:${this.pad(seconds)},${this.pad(ms, 3)}`
  }

  /**
   * Format time for VTT (HH:MM:SS.mmm)
   */
  formatVTTTime(milliseconds) {
    const hours = Math.floor(milliseconds / 3600000)
    const minutes = Math.floor((milliseconds % 3600000) / 60000)
    const seconds = Math.floor((milliseconds % 60000) / 1000)
    const ms = milliseconds % 1000

    return `${this.pad(hours)}:${this.pad(minutes)}:${this.pad(seconds)}.${this.pad(ms, 3)}`
  }

  /**
   * Pad number with zeros
   */
  pad(num, size = 2) {
    let s = num.toString()
    while (s.length < size) s = '0' + s
    return s
  }

  /**
   * Download file helper
   */
  downloadFile(blob, filename) {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  /**
   * Get supported languages
   */
  static getSupportedLanguages() {
    return [
      { code: 'auto', name: 'Автоопределение', flag: '🌐' },
      { code: 'ru-RU', name: 'Русский', flag: '🇷🇺' },
      { code: 'en-US', name: 'English (US)', flag: '🇺🇸' },
      { code: 'en-GB', name: 'English (UK)', flag: '🇬🇧' },
      { code: 'es-ES', name: 'Español', flag: '🇪🇸' },
      { code: 'fr-FR', name: 'Français', flag: '🇫🇷' },
      { code: 'de-DE', name: 'Deutsch', flag: '🇩🇪' },
      { code: 'it-IT', name: 'Italiano', flag: '🇮🇹' },
      { code: 'pt-BR', name: 'Português', flag: '🇧🇷' },
      { code: 'zh-CN', name: '中文 (简体)', flag: '🇨🇳' },
      { code: 'ja-JP', name: '日本語', flag: '🇯🇵' },
      { code: 'ko-KR', name: '한국어', flag: '🇰🇷' },
      { code: 'ar-SA', name: 'العربية', flag: '🇸🇦' },
      { code: 'hi-IN', name: 'हिन्दी', flag: '🇮🇳' },
      { code: 'tr-TR', name: 'Türkçe', flag: '🇹🇷' }
    ]
  }

  /**
   * Check if captions are supported
   */
  static isSupported() {
    return TranscriptionService.isSupported()
  }
}
