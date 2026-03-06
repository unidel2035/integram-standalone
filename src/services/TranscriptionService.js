import { logger } from '@/utils/logger'

/**
 * Transcription Service for real-time speech-to-text
 * Uses Web Speech API (SpeechRecognition)
 */
export default class TranscriptionService {
  constructor() {
    this.recognition = null
    this.isTranscribing = false
    this.onTranscriptCallback = null

    // Check for browser support
    this.isSupported = 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window
  }

  /**
   * Check if transcription is supported in the browser
   */
  static isSupported() {
    return 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window
  }

  /**
   * Start transcription for a media stream
   * @param {MediaStream} stream - The audio stream to transcribe
   * @param {Function} onTranscript - Callback function for transcription updates
   * @param {string} language - Language code (default: 'ru-RU')
   */
  start(stream, onTranscript, language = 'ru-RU') {
    if (!this.isSupported) {
      throw new Error('Speech recognition is not supported in this browser')
    }

    if (this.isTranscribing) {
      throw new Error('Transcription already in progress')
    }

    try {
      // Initialize speech recognition
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
      this.recognition = new SpeechRecognition()

      // Configure recognition
      this.recognition.continuous = true
      this.recognition.interimResults = true
      this.recognition.lang = language
      this.recognition.maxAlternatives = 1

      this.onTranscriptCallback = onTranscript

      // Handle results
      this.recognition.onresult = (event) => {
        try {
          let interimTranscript = ''
          let finalTranscript = ''

          // Defensive check: ensure event.results exists and has valid structure
          if (!event || !event.results) {
            logger.warn('Speech recognition event has no results')
            return
          }

          for (let i = event.resultIndex; i < event.results.length; i++) {
            // Defensive check: ensure result[i] and result[i][0] exist
            if (!event.results[i] || !event.results[i][0]) {
              logger.warn(`Speech recognition result at index ${i} is invalid or empty`)
              continue
            }

            const result = event.results[i][0]

            // Defensive check: ensure transcript property exists
            if (typeof result.transcript === 'undefined') {
              logger.warn(`Speech recognition result at index ${i} has no transcript property`)
              continue
            }

            const transcript = result.transcript
            if (event.results[i].isFinal) {
              finalTranscript += transcript + ' '
            } else {
              interimTranscript += transcript
            }
          }

          const text = finalTranscript || interimTranscript
          if (text && this.onTranscriptCallback) {
            this.onTranscriptCallback(text.trim(), 'Вы')
          }
        } catch (error) {
          logger.error('Error processing speech recognition result:', error)
          console.error('Speech recognition result processing error:', error)
        }
      }

      // Handle errors
      this.recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error)

        // Restart on certain errors
        if (event.error === 'no-speech' || event.error === 'audio-capture') {
          setTimeout(() => {
            if (this.isTranscribing && this.recognition) {
              try {
                // Stop first to ensure clean state, then restart
                this.recognition.stop()
                // Wait for stop to complete before starting
                setTimeout(() => {
                  if (this.isTranscribing && this.recognition) {
                    this.recognition.start()
                  }
                }, 100)
              } catch (error) {
                console.error('Failed to restart recognition after error:', error)
              }
            }
          }, 1000)
        }
      }

      // Handle end
      this.recognition.onend = () => {
        if (this.isTranscribing) {
          // Restart if still transcribing
          setTimeout(() => {
            if (this.isTranscribing && this.recognition) {
              try {
                this.recognition.start()
              } catch (error) {
                console.error('Failed to restart recognition:', error)
                // If restart fails, mark as not transcribing to prevent infinite loop
                this.isTranscribing = false
              }
            }
          }, 100)
        }
      }

      // Start recognition
      this.recognition.start()
      this.isTranscribing = true

      logger.debug('Transcription started')
    } catch (error) {
      throw new Error(`Failed to start transcription: ${error.message}`)
    }
  }

  /**
   * Stop transcription
   */
  stop() {
    if (!this.isTranscribing) {
      return
    }

    try {
      this.isTranscribing = false

      if (this.recognition) {
        this.recognition.stop()
        this.recognition = null
      }

      logger.debug('Transcription stopped')
    } catch (error) {
      console.error('Error stopping transcription:', error)
    }
  }

  /**
   * Change transcription language
   */
  setLanguage(language) {
    if (this.recognition) {
      this.recognition.lang = language
    }
  }

  /**
   * Get supported languages
   */
  static getSupportedLanguages() {
    return [
      { code: 'ru-RU', name: 'Русский' },
      { code: 'en-US', name: 'English (US)' },
      { code: 'en-GB', name: 'English (UK)' },
      { code: 'es-ES', name: 'Español' },
      { code: 'fr-FR', name: 'Français' },
      { code: 'de-DE', name: 'Deutsch' },
      { code: 'it-IT', name: 'Italiano' },
      { code: 'pt-BR', name: 'Português (Brasil)' },
      { code: 'zh-CN', name: '中文 (简体)' },
      { code: 'ja-JP', name: '日本語' },
      { code: 'ko-KR', name: '한국어' }
    ]
  }

  /**
   * Export transcript as text file
   */
  static exportTranscript(transcript, filename = 'transcript.txt') {
    const blob = new Blob([transcript], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  /**
   * Export transcript as SRT subtitle format
   */
  static exportSRT(transcriptSegments, filename = 'transcript.srt') {
    let srt = ''

    transcriptSegments.forEach((segment, index) => {
      const startTime = formatSRTTime(segment.startTime)
      const endTime = formatSRTTime(segment.endTime)

      srt += `${index + 1}\n`
      srt += `${startTime} --> ${endTime}\n`
      srt += `${segment.text}\n\n`
    })

    const blob = new Blob([srt], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }
}

/**
 * Format time for SRT format (HH:MM:SS,mmm)
 */
function formatSRTTime(milliseconds) {
  const hours = Math.floor(milliseconds / 3600000)
  const minutes = Math.floor((milliseconds % 3600000) / 60000)
  const seconds = Math.floor((milliseconds % 60000) / 1000)
  const ms = milliseconds % 1000

  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)},${pad(ms, 3)}`
}

function pad(num, size = 2) {
  let s = num.toString()
  while (s.length < size) s = '0' + s
  return s
}
