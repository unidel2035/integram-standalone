/**
 * Performance Testing Service for Video Conference
 *
 * Purpose: Measure baseline performance metrics for mesh P2P architecture
 * to determine practical limitations and guide SFU migration planning.
 *
 * Tests:
 * - 5, 10, 15, 20 participant scenarios
 * - CPU, RAM, bandwidth consumption
 * - Video quality degradation points
 * - Connection stability metrics
 *
 * Related Issues: #2402, #2398, #2364, #2344
 */

import { logger } from '@/utils/logger'
import WebRTCMetricsCollector from './WebRTCMetricsCollector'

export class PerformanceTestingService {
  constructor(webrtcMetricsCollector = null) {
    this.testResults = []
    this.isTestRunning = false
    this.currentTest = null
    this.metricsCollectionInterval = null
    this.startTime = null
    this.webrtcMetricsCollector = webrtcMetricsCollector || new WebRTCMetricsCollector()
  }

  /**
   * Start a performance test scenario
   * @param {Object} testConfig - Test configuration
   * @param {number} testConfig.participantCount - Number of participants
   * @param {string} testConfig.videoQuality - Video quality (720p, 480p, 360p)
   * @param {number} testConfig.duration - Test duration in seconds
   * @param {boolean} testConfig.enableScreenShare - Whether to test screen sharing
   * @returns {Promise<Object>} Test results
   */
  async startTest(testConfig) {
    if (this.isTestRunning) {
      throw new Error('A test is already running')
    }

    logger.info('🧪 [Performance Test] Starting test with config:', testConfig)

    this.isTestRunning = true
    this.startTime = Date.now()
    this.currentTest = {
      id: `test_${Date.now()}`,
      config: testConfig,
      metrics: {
        cpu: [],
        ram: [],
        bandwidth: { upload: [], download: [] },
        videoQuality: [],
        latency: [],
        packetsLost: [],
        jitter: [],
        connectionStates: []
      },
      status: 'running',
      startTime: this.startTime
    }

    // Start metrics collection
    this.startMetricsCollection()

    // Run test for specified duration
    await new Promise(resolve => setTimeout(resolve, testConfig.duration * 1000))

    // Stop metrics collection
    this.stopMetricsCollection()

    // Calculate summary statistics
    const summary = this.calculateSummary(this.currentTest.metrics)

    this.currentTest.status = 'completed'
    this.currentTest.endTime = Date.now()
    this.currentTest.summary = summary

    this.testResults.push(this.currentTest)
    this.isTestRunning = false

    logger.info('✅ [Performance Test] Test completed:', this.currentTest.id)

    return this.currentTest
  }

  /**
   * Start collecting performance metrics
   */
  startMetricsCollection() {
    logger.debug('📊 [Performance Test] Starting metrics collection')

    // Collect metrics every second
    this.metricsCollectionInterval = setInterval(() => {
      this.collectMetrics()
    }, 1000)
  }

  /**
   * Stop collecting performance metrics
   */
  stopMetricsCollection() {
    if (this.metricsCollectionInterval) {
      clearInterval(this.metricsCollectionInterval)
      this.metricsCollectionInterval = null
      logger.debug('📊 [Performance Test] Stopped metrics collection')
    }
  }

  /**
   * Collect current performance metrics
   */
  async collectMetrics() {
    if (!this.currentTest) return

    const timestamp = Date.now() - this.startTime

    // Collect CPU usage
    const cpu = await this.getCPUUsage()
    this.currentTest.metrics.cpu.push({ timestamp, value: cpu })

    // Collect RAM usage
    const ram = await this.getRAMUsage()
    this.currentTest.metrics.ram.push({ timestamp, value: ram })

    // Collect bandwidth (if available)
    const bandwidth = await this.getBandwidthUsage()
    if (bandwidth) {
      this.currentTest.metrics.bandwidth.upload.push({ timestamp, value: bandwidth.upload })
      this.currentTest.metrics.bandwidth.download.push({ timestamp, value: bandwidth.download })
    }

    // Collect WebRTC stats if available
    const webrtcStats = await this.getWebRTCStats()
    if (webrtcStats) {
      this.currentTest.metrics.videoQuality.push({
        timestamp,
        resolution: webrtcStats.resolution,
        fps: webrtcStats.fps
      })
      this.currentTest.metrics.latency.push({ timestamp, value: webrtcStats.latency })
      this.currentTest.metrics.packetsLost.push({ timestamp, value: webrtcStats.packetsLost })
      this.currentTest.metrics.jitter.push({ timestamp, value: webrtcStats.jitter })
    }
  }

  /**
   * Get CPU usage using Performance API
   * @returns {Promise<number>} CPU usage percentage (approximation)
   */
  async getCPUUsage() {
    // Browser doesn't provide direct CPU usage API
    // We approximate using JS execution time and performance marks

    if (!window.performance || !window.performance.memory) {
      return 0
    }

    // Use performance.now() to measure time spent in JS execution
    // This is a rough approximation
    const start = performance.now()
    // Simulate some work
    for (let i = 0; i < 1000; i++) {
      Math.sqrt(i)
    }
    const end = performance.now()
    const executionTime = end - start

    // Convert to percentage (very rough approximation)
    // In real scenarios, this would need browser-specific APIs
    return Math.min((executionTime / 10) * 100, 100)
  }

  /**
   * Get RAM usage using Performance Memory API
   * @returns {Promise<number>} RAM usage in MB
   */
  async getRAMUsage() {
    if (window.performance && window.performance.memory) {
      return Math.round(window.performance.memory.usedJSHeapSize / 1048576) // Convert to MB
    }
    return 0
  }

  /**
   * Get bandwidth usage from WebRTC stats
   * @returns {Promise<Object>} Upload and download bandwidth in Mbps
   */
  async getBandwidthUsage() {
    if (!this.webrtcMetricsCollector || this.webrtcMetricsCollector.peerConnections.size === 0) {
      return null
    }

    try {
      const metrics = await this.webrtcMetricsCollector.collectMetrics()
      return {
        upload: metrics.bandwidth.upload,
        download: metrics.bandwidth.download
      }
    } catch (error) {
      logger.error('Failed to get bandwidth usage:', error)
      return null
    }
  }

  /**
   * Get WebRTC statistics from peer connections
   * @returns {Promise<Object>} WebRTC stats
   */
  async getWebRTCStats() {
    if (!this.webrtcMetricsCollector || this.webrtcMetricsCollector.peerConnections.size === 0) {
      return null
    }

    try {
      const metrics = await this.webrtcMetricsCollector.collectMetrics()
      return {
        resolution: metrics.videoQuality.resolution,
        fps: metrics.videoQuality.fps,
        latency: metrics.latency,
        packetsLost: metrics.packetsLost,
        jitter: metrics.jitter
      }
    } catch (error) {
      logger.error('Failed to get WebRTC stats:', error)
      return null
    }
  }

  /**
   * Calculate summary statistics from collected metrics
   * @param {Object} metrics - Collected metrics
   * @returns {Object} Summary statistics
   */
  calculateSummary(metrics) {
    return {
      cpu: this.calculateStats(metrics.cpu),
      ram: this.calculateStats(metrics.ram),
      bandwidth: {
        upload: this.calculateStats(metrics.bandwidth.upload),
        download: this.calculateStats(metrics.bandwidth.download)
      },
      latency: this.calculateStats(metrics.latency),
      packetsLost: this.calculateStats(metrics.packetsLost),
      jitter: this.calculateStats(metrics.jitter),
      videoQuality: {
        avgFPS: this.calculateAverage(metrics.videoQuality.map(m => m.fps)),
        resolutions: this.getUniqueResolutions(metrics.videoQuality)
      }
    }
  }

  /**
   * Calculate statistics (min, max, avg, p95) for a metric
   * @param {Array} dataPoints - Array of {timestamp, value} objects
   * @returns {Object} Statistics
   */
  calculateStats(dataPoints) {
    if (!dataPoints || dataPoints.length === 0) {
      return { min: 0, max: 0, avg: 0, p95: 0 }
    }

    const values = dataPoints.map(dp => dp.value).filter(v => v != null)

    if (values.length === 0) {
      return { min: 0, max: 0, avg: 0, p95: 0 }
    }

    const sorted = [...values].sort((a, b) => a - b)
    const min = sorted[0]
    const max = sorted[sorted.length - 1]
    const avg = values.reduce((sum, v) => sum + v, 0) / values.length
    const p95Index = Math.floor(sorted.length * 0.95)
    const p95 = sorted[p95Index]

    return { min, max, avg, p95 }
  }

  /**
   * Calculate average value
   * @param {Array} values - Array of numbers
   * @returns {number} Average value
   */
  calculateAverage(values) {
    if (!values || values.length === 0) return 0
    const validValues = values.filter(v => v != null)
    if (validValues.length === 0) return 0
    return validValues.reduce((sum, v) => sum + v, 0) / validValues.length
  }

  /**
   * Get unique video resolutions from quality metrics
   * @param {Array} qualityMetrics - Video quality metrics
   * @returns {Array} Array of unique resolutions
   */
  getUniqueResolutions(qualityMetrics) {
    const resolutions = new Set()
    qualityMetrics.forEach(m => {
      if (m.resolution) {
        resolutions.add(m.resolution)
      }
    })
    return Array.from(resolutions)
  }

  /**
   * Get all test results
   * @returns {Array} Array of test results
   */
  getTestResults() {
    return this.testResults
  }

  /**
   * Get current test status
   * @returns {Object} Current test info
   */
  getCurrentTest() {
    return this.currentTest
  }

  /**
   * Export test results as JSON
   * @param {string} testId - Test ID to export (optional, exports all if not provided)
   * @returns {string} JSON string of test results
   */
  exportResults(testId = null) {
    if (testId) {
      const test = this.testResults.find(t => t.id === testId)
      return JSON.stringify(test, null, 2)
    }
    return JSON.stringify(this.testResults, null, 2)
  }

  /**
   * Generate performance report
   * @param {Object} testResult - Test result to generate report for
   * @returns {Object} Report object
   */
  generateReport(testResult) {
    const { config, summary, metrics } = testResult

    return {
      testId: testResult.id,
      timestamp: new Date(testResult.startTime).toISOString(),
      configuration: {
        participants: config.participantCount,
        videoQuality: config.videoQuality,
        duration: config.duration,
        screenShare: config.enableScreenShare
      },
      summary: {
        cpu: {
          average: `${summary.cpu.avg.toFixed(1)}%`,
          peak: `${summary.cpu.max.toFixed(1)}%`,
          p95: `${summary.cpu.p95.toFixed(1)}%`
        },
        ram: {
          average: `${summary.ram.avg.toFixed(0)} MB`,
          peak: `${summary.ram.max.toFixed(0)} MB`,
          p95: `${summary.ram.p95.toFixed(0)} MB`
        },
        bandwidth: {
          upload: {
            average: `${summary.bandwidth.upload.avg.toFixed(2)} Mbps`,
            peak: `${summary.bandwidth.upload.max.toFixed(2)} Mbps`
          },
          download: {
            average: `${summary.bandwidth.download.avg.toFixed(2)} Mbps`,
            peak: `${summary.bandwidth.download.max.toFixed(2)} Mbps`
          }
        },
        latency: {
          average: `${summary.latency.avg.toFixed(0)} ms`,
          peak: `${summary.latency.max.toFixed(0)} ms`,
          p95: `${summary.latency.p95.toFixed(0)} ms`
        },
        packetsLost: {
          average: summary.packetsLost.avg.toFixed(0),
          total: metrics.packetsLost.reduce((sum, p) => sum + p.value, 0)
        },
        videoQuality: {
          averageFPS: summary.videoQuality.avgFPS.toFixed(1),
          resolutions: summary.videoQuality.resolutions
        }
      },
      dataPoints: metrics,
      recommendation: this.generateRecommendation(config.participantCount, summary)
    }
  }

  /**
   * Generate recommendation based on test results
   * @param {number} participantCount - Number of participants
   * @param {Object} summary - Test summary
   * @returns {string} Recommendation text
   */
  generateRecommendation(participantCount, summary) {
    const { cpu, ram, latency, packetsLost } = summary

    // Define thresholds
    const cpuThreshold = 70 // % CPU usage threshold for degradation
    const ramThreshold = 2000 // MB RAM threshold for degradation
    const latencyThreshold = 300 // ms latency threshold for degradation
    const packetLossThreshold = 100 // packet loss threshold

    const issues = []

    if (cpu.avg > cpuThreshold) {
      issues.push(`High CPU usage (${cpu.avg.toFixed(1)}%)`)
    }

    if (ram.avg > ramThreshold) {
      issues.push(`High RAM usage (${ram.avg.toFixed(0)} MB)`)
    }

    if (latency.avg > latencyThreshold) {
      issues.push(`High latency (${latency.avg.toFixed(0)} ms)`)
    }

    if (packetsLost.avg > packetLossThreshold) {
      issues.push(`Packet loss detected (${packetsLost.avg.toFixed(0)} packets)`)
    }

    if (issues.length === 0) {
      return `✅ STABLE: ${participantCount} participants - System performs well with no significant degradation`
    } else if (issues.length <= 2) {
      return `⚠️ DEGRADED: ${participantCount} participants - Minor performance issues: ${issues.join(', ')}`
    } else {
      return `❌ CRITICAL: ${participantCount} participants - Significant performance issues: ${issues.join(', ')}. Consider SFU architecture.`
    }
  }

  /**
   * Clear all test results
   */
  clearResults() {
    this.testResults = []
    logger.info('🗑️ [Performance Test] Cleared all test results')
  }

  /**
   * Register a WebRTC peer connection for metrics collection
   * @param {string} peerId - Peer ID
   * @param {RTCPeerConnection} peerConnection - WebRTC peer connection
   */
  registerPeerConnection(peerId, peerConnection) {
    this.webrtcMetricsCollector.registerPeerConnection(peerId, peerConnection)
    logger.debug(`📊 [Performance Test] Registered peer connection: ${peerId}`)
  }

  /**
   * Unregister a WebRTC peer connection
   * @param {string} peerId - Peer ID
   */
  unregisterPeerConnection(peerId) {
    this.webrtcMetricsCollector.unregisterPeerConnection(peerId)
    logger.debug(`📊 [Performance Test] Unregistered peer connection: ${peerId}`)
  }

  /**
   * Get the WebRTC metrics collector instance
   * @returns {WebRTCMetricsCollector} Metrics collector
   */
  getMetricsCollector() {
    return this.webrtcMetricsCollector
  }
}

export default PerformanceTestingService
