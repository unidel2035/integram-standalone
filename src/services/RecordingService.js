import { logger } from '@/utils/logger'
import * as RecordRTCModule from 'recordrtc'

// Handle both CommonJS and ES module exports
const RecordRTC = RecordRTCModule.default || RecordRTCModule

/**
 * Recording Service for capturing video conference sessions
 * Uses RecordRTC library for cross-browser recording
 */
export default class RecordingService {
  constructor() {
    this.recorder = null
    this.isRecording = false
    this.recordedBlob = null
  }

  /**
   * Start recording multiple streams
   * @param {MediaStream[]} streams - Array of media streams to record
   * @returns {Promise<void>}
   */
  async start(streams) {
    if (this.isRecording) {
      throw new Error('Recording already in progress')
    }

    try {
      // Combine all streams into a single canvas
      const canvas = document.createElement('canvas')
      canvas.width = 1920
      canvas.height = 1080
      const context = canvas.getContext('2d')

      // Create video elements for each stream
      const videoElements = streams.map(stream => {
        const video = document.createElement('video')
        video.srcObject = stream
        video.muted = true
        video.play()
        return { video, stream }
      })

      // Audio context for mixing audio
      const audioContext = new AudioContext()
      const destination = audioContext.createMediaStreamDestination()

      // Mix all audio streams
      streams.forEach(stream => {
        const audioTracks = stream.getAudioTracks()
        if (audioTracks.length > 0) {
          const source = audioContext.createMediaStreamSource(
            new MediaStream(audioTracks)
          )
          source.connect(destination)
        }
      })

      // Helper function to draw centered and fitted video maintaining aspect ratio
      const drawVideoInCell = (video, x, y, cellWidth, cellHeight) => {
        if (video.readyState !== video.HAVE_ENOUGH_DATA) {
          // Draw placeholder with avatar
          this.drawAvatarPlaceholder(context, x, y, cellWidth, cellHeight)
          return
        }

        const videoWidth = video.videoWidth
        const videoHeight = video.videoHeight

        // Check if video track is enabled
        const stream = videoElements.find(ve => ve.video === video)?.stream
        const hasActiveVideo = stream && stream.getVideoTracks().length > 0 &&
                               stream.getVideoTracks()[0].enabled

        if (!hasActiveVideo || videoWidth === 0 || videoHeight === 0) {
          // Draw placeholder with avatar if video is disabled
          this.drawAvatarPlaceholder(context, x, y, cellWidth, cellHeight)
          return
        }

        // Calculate aspect ratios
        const videoAspect = videoWidth / videoHeight
        const cellAspect = cellWidth / cellHeight

        let drawWidth, drawHeight, drawX, drawY

        // Fit video maintaining aspect ratio (cover mode - fills cell completely)
        if (videoAspect > cellAspect) {
          // Video is wider than cell
          drawHeight = cellHeight
          drawWidth = cellHeight * videoAspect
          drawX = x + (cellWidth - drawWidth) / 2
          drawY = y
        } else {
          // Video is taller than cell
          drawWidth = cellWidth
          drawHeight = cellWidth / videoAspect
          drawX = x
          drawY = y + (cellHeight - drawHeight) / 2
        }

        // Draw the video
        context.drawImage(video, drawX, drawY, drawWidth, drawHeight)
      }

      // Draw videos on canvas in a grid
      const drawVideos = () => {
        if (!this.isRecording) return

        const cols = Math.ceil(Math.sqrt(videoElements.length))
        const rows = Math.ceil(videoElements.length / cols)
        const cellWidth = canvas.width / cols
        const cellHeight = canvas.height / rows

        // Fill background
        context.fillStyle = '#1a1a1a'
        context.fillRect(0, 0, canvas.width, canvas.height)

        videoElements.forEach(({ video }, index) => {
          const col = index % cols
          const row = Math.floor(index / cols)
          const x = col * cellWidth
          const y = row * cellHeight

          // Draw cell background
          context.fillStyle = '#2a2a2a'
          context.fillRect(x + 2, y + 2, cellWidth - 4, cellHeight - 4)

          // Draw video with proper aspect ratio
          drawVideoInCell(video, x + 2, y + 2, cellWidth - 4, cellHeight - 4)
        })

        requestAnimationFrame(drawVideos)
      }

      // Start drawing
      this.isRecording = true
      drawVideos()

      // Create combined stream from canvas and mixed audio
      const canvasStream = canvas.captureStream(30) // 30 fps
      const videoTrack = canvasStream.getVideoTracks()[0]
      const audioTrack = destination.stream.getAudioTracks()[0]

      const combinedStream = new MediaStream([videoTrack, audioTrack])

      // Initialize RecordRTC
      this.recorder = new RecordRTC(combinedStream, {
        type: 'video',
        mimeType: 'video/webm;codecs=vp9',
        videoBitsPerSecond: 2500000,
        audioBitsPerSecond: 128000,
        canvas: {
          width: canvas.width,
          height: canvas.height
        },
        frameInterval: 33 // ~30 fps
      })

      this.recorder.startRecording()

      logger.debug('Recording started')
    } catch (error) {
      this.isRecording = false
      throw new Error(`Failed to start recording: ${error.message}`)
    }
  }

  /**
   * Stop recording and return the recorded blob
   * @returns {Promise<Blob>}
   */
  async stop() {
    if (!this.isRecording) {
      throw new Error('No recording in progress')
    }

    return new Promise((resolve, reject) => {
      try {
        this.isRecording = false

        this.recorder.stopRecording(() => {
          this.recordedBlob = this.recorder.getBlob()
          logger.debug('Recording stopped')
          resolve(this.recordedBlob)
        })
      } catch (error) {
        reject(new Error(`Failed to stop recording: ${error.message}`))
      }
    })
  }

  /**
   * Pause recording
   */
  pause() {
    if (this.recorder && this.isRecording) {
      this.recorder.pauseRecording()
    }
  }

  /**
   * Resume recording
   */
  resume() {
    if (this.recorder && this.isRecording) {
      this.recorder.resumeRecording()
    }
  }

  /**
   * Get the current recording state
   */
  getState() {
    if (!this.recorder) return 'inactive'
    return this.recorder.getState()
  }

  /**
   * Download the recorded blob as a file
   */
  download(filename = 'recording.webm') {
    if (!this.recordedBlob) {
      throw new Error('No recording available')
    }

    const url = URL.createObjectURL(this.recordedBlob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  /**
   * Get the recorded blob
   */
  getBlob() {
    return this.recordedBlob
  }

  /**
   * Clear the recorded blob
   */
  clear() {
    this.recordedBlob = null
  }

  /**
   * Draw a beautiful avatar placeholder when video is disabled
   * @param {CanvasRenderingContext2D} context - Canvas context
   * @param {number} x - X position
   * @param {number} y - Y position
   * @param {number} width - Width of the cell
   * @param {number} height - Height of the cell
   */
  drawAvatarPlaceholder(context, x, y, width, height) {
    // Create gradient background
    const gradient = context.createLinearGradient(x, y, x + width, y + height)
    gradient.addColorStop(0, '#667eea')
    gradient.addColorStop(1, '#764ba2')

    // Fill background with gradient
    context.fillStyle = gradient
    context.fillRect(x, y, width, height)

    // Calculate center
    const centerX = x + width / 2
    const centerY = y + height / 2

    // Calculate avatar circle size (responsive to cell size)
    const avatarRadius = Math.min(width, height) * 0.25

    // Draw avatar circle
    context.fillStyle = 'rgba(255, 255, 255, 0.3)'
    context.beginPath()
    context.arc(centerX, centerY - avatarRadius * 0.3, avatarRadius, 0, Math.PI * 2)
    context.fill()

    // Draw head (smaller circle)
    const headRadius = avatarRadius * 0.4
    context.fillStyle = 'rgba(255, 255, 255, 0.8)'
    context.beginPath()
    context.arc(centerX, centerY - avatarRadius * 0.6, headRadius, 0, Math.PI * 2)
    context.fill()

    // Draw shoulders (arc)
    context.beginPath()
    context.arc(centerX, centerY + avatarRadius * 0.3, avatarRadius * 0.7, 0, Math.PI * 2)
    context.fillStyle = 'rgba(255, 255, 255, 0.8)'
    context.fill()

    // Draw "No video" text below avatar
    const fontSize = Math.max(16, Math.min(width, height) * 0.08)
    context.font = `${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`
    context.fillStyle = 'rgba(255, 255, 255, 0.9)'
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.fillText('Нет видео', centerX, centerY + avatarRadius * 1.5)
  }
}
