/**
 * Health Monitor Service
 * Issue #2262: Automatic issue creation for detected problems
 *
 * This service provides:
 * - Automatic GitHub issue creation for detected problems
 * - Comprehensive connection checks for all services
 * - Button click validation
 * - Agent console monitoring
 * - Test runner integration
 */

import axios from 'axios'
import { logger } from '@/utils/logger'

const ORCHESTRATOR_URL = import.meta.env.VITE_ORCHESTRATOR_URL || ''
const API_BASE_URL = ORCHESTRATOR_URL ? `${ORCHESTRATOR_URL}/api` : '/api'

// GitHub repository info
const GITHUB_REPO_OWNER = 'unidel2035'
const GITHUB_REPO_NAME = 'dronedoc2025'

class HealthMonitorService {
  constructor() {
    this.problemHistory = []
    this.issueCreationThrottle = new Map() // Prevent duplicate issue spam
    this.consoleErrors = []
    this.buttonValidationResults = []
    this.githubToken = null

    // Start monitoring console errors immediately
    this.startConsoleMonitoring()
  }

  /**
   * Set GitHub token for issue creation
   * @param {string} token - GitHub Personal Access Token
   */
  setGitHubToken(token) {
    this.githubToken = token
    logger.info('GitHub token configured for health monitor')
  }

  /**
   * Get GitHub token
   * @returns {string|null}
   */
  getGitHubToken() {
    return this.githubToken
  }

  /**
   * Check if GitHub token is configured
   * @returns {boolean}
   */
  isGitHubTokenConfigured() {
    return this.githubToken !== null && this.githubToken !== ''
  }

  /**
   * Monitor console for errors
   */
  startConsoleMonitoring() {
    // Capture console.error
    const originalError = console.error
    const self = this
    console.error = function(...args) {
      self.consoleErrors.push({
        timestamp: Date.now(),
        message: args.map(arg => String(arg)).join(' '),
        stack: new Error().stack
      })

      // Keep only last 100 errors
      if (self.consoleErrors.length > 100) {
        self.consoleErrors.shift()
      }

      // Call original
      originalError.apply(console, args)
    }

    // Capture unhandled errors
    if (typeof window !== 'undefined') {
      window.addEventListener('error', (event) => {
        self.consoleErrors.push({
          timestamp: Date.now(),
          message: event.message,
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
          error: event.error?.stack
        })
      })

      // Capture unhandled promise rejections
      window.addEventListener('unhandledrejection', (event) => {
        self.consoleErrors.push({
          timestamp: Date.now(),
          message: `Unhandled promise rejection: ${event.reason}`,
          error: event.reason?.stack
        })
      })
    }
  }

  /**
   * Get recent console errors
   */
  getConsoleErrors(minutes = 5) {
    const cutoffTime = Date.now() - (minutes * 60 * 1000)
    return this.consoleErrors.filter(err => err.timestamp > cutoffTime)
  }

  /**
   * Check if an issue was recently created for this problem type
   */
  shouldCreateIssue(problemType, cooldownMinutes = 60) {
    const lastCreated = this.issueCreationThrottle.get(problemType)
    if (!lastCreated) return true

    const timeSinceCreation = Date.now() - lastCreated
    return timeSinceCreation > (cooldownMinutes * 60 * 1000)
  }

  /**
   * Create a GitHub issue for a detected problem
   */
  async createGitHubIssue(problemData) {
    const {
      title,
      problemType,
      severity = 'medium',
      description,
      agent = null,
      errorDetails = null,
      steps = [],
      environment = {}
    } = problemData

    // Check throttle
    if (!this.shouldCreateIssue(problemType)) {
      logger.info('Skipping issue creation (throttled)', { problemType })
      return { created: false, reason: 'throttled' }
    }

    try {
      // Build issue body
      let body = `## 🤖 Automatically Detected Problem\n\n`
      body += `**Problem Type:** ${problemType}\n`
      body += `**Severity:** ${severity}\n`
      body += `**Detection Time:** ${new Date().toISOString()}\n`

      if (agent) {
        body += `**Affected Agent:** ${agent.name} (${agent.id})\n`
      }

      body += `\n---\n\n`
      body += `## Description\n\n${description}\n\n`

      if (errorDetails) {
        body += `## Error Details\n\n`
        body += `\`\`\`\n${JSON.stringify(errorDetails, null, 2)}\n\`\`\`\n\n`
      }

      if (steps.length > 0) {
        body += `## Steps to Reproduce\n\n`
        steps.forEach((step, i) => {
          body += `${i + 1}. ${step}\n`
        })
        body += `\n`
      }

      if (Object.keys(environment).length > 0) {
        body += `## Environment\n\n`
        Object.entries(environment).forEach(([key, value]) => {
          body += `- **${key}:** ${value}\n`
        })
        body += `\n`
      }

      body += `---\n\n`
      body += `*This issue was automatically created by the Health Monitor at ${window.location.origin}/agents/health-monitor*`

      // Check if token is configured
      if (!this.isGitHubTokenConfigured()) {
        logger.warn('Cannot create GitHub issue: token not configured')
        return {
          created: false,
          reason: 'token_not_configured',
          error: 'GitHub token not configured'
        }
      }

      // Create issue via GitHub API
      const response = await axios.post(
        `https://api.github.com/repos/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/issues`,
        {
          title,
          body,
          labels: ['auto-detected', `severity:${severity}`, 'health-monitor']
        },
        {
          headers: {
            'Authorization': `token ${this.githubToken}`,
            'Accept': 'application/vnd.github.v3+json',
            'X-GitHub-Api-Version': '2022-11-28'
          }
        }
      )

      // Record creation time for throttling
      this.issueCreationThrottle.set(problemType, Date.now())

      logger.info('GitHub issue created', {
        problemType,
        issueNumber: response.data.number,
        issueUrl: response.data.html_url
      })

      return {
        created: true,
        issue: {
          number: response.data.number,
          url: response.data.html_url,
          title: response.data.title
        }
      }
    } catch (error) {
      logger.error('Failed to create GitHub issue', {
        error: error.message,
        problemType
      })

      return {
        created: false,
        reason: 'error',
        error: error.message
      }
    }
  }

  /**
   * Validate button clicks and interactions
   */
  async validateButtonClicks(buttons) {
    const results = []

    for (const button of buttons) {
      const result = {
        buttonId: button.id || button.label,
        label: button.label,
        timestamp: Date.now(),
        status: 'unknown',
        error: null
      }

      try {
        // Find button element
        const element = button.element || document.querySelector(button.selector)

        if (!element) {
          result.status = 'not_found'
          result.error = 'Button element not found'
        } else if (element.disabled) {
          result.status = 'disabled'
          result.error = 'Button is disabled'
        } else {
          // Simulate click
          element.click()

          // Wait for potential async operations
          await new Promise(resolve => setTimeout(resolve, 100))

          result.status = 'success'
        }
      } catch (error) {
        result.status = 'error'
        result.error = error.message
      }

      results.push(result)
    }

    this.buttonValidationResults = results
    return results
  }

  /**
   * Run comprehensive connection checks
   */
  async checkAllConnections() {
    const checks = []

    // 1. Backend health
    checks.push(this.checkBackendHealth())

    // 2. YouTube Analytics API
    checks.push(this.checkYouTubeAPI())

    // 3. AI Tokens API
    checks.push(this.checkAITokensAPI())

    // 4. Test Runner API
    checks.push(this.checkTestRunnerAPI())

    // 5. Sales Agent API
    checks.push(this.checkSalesAgentAPI())

    // 6. Database connection (via backend)
    checks.push(this.checkDatabaseConnection())

    // 7. WebRTC/Video conference
    checks.push(this.checkWebRTCConnection())

    // Wait for all checks
    const results = await Promise.allSettled(checks)

    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value
      } else {
        return {
          service: `Check ${index + 1}`,
          status: 'error',
          error: result.reason?.message || String(result.reason),
          timestamp: Date.now()
        }
      }
    })
  }

  async checkBackendHealth() {
    try {
      const response = await axios.get(`${API_BASE_URL}/health`, { timeout: 5000 })
      return {
        service: 'Backend',
        status: 'healthy',
        responseTime: response.headers['x-response-time'] || null,
        uptime: response.data.uptime,
        timestamp: Date.now()
      }
    } catch (error) {
      return {
        service: 'Backend',
        status: 'error',
        error: error.message,
        timestamp: Date.now()
      }
    }
  }

  async checkYouTubeAPI() {
    try {
      const response = await axios.get(`${API_BASE_URL}/youtube/health`, { timeout: 3000 })
      return {
        service: 'YouTube Analytics API',
        status: 'healthy',
        details: response.data,
        timestamp: Date.now()
      }
    } catch (error) {
      return {
        service: 'YouTube Analytics API',
        status: error.response?.status === 404 ? 'not_configured' : 'error',
        error: error.message,
        timestamp: Date.now()
      }
    }
  }

  async checkAITokensAPI() {
    try {
      const response = await axios.get(`${API_BASE_URL}/ai-tokens/system-config`, { timeout: 3000 })
      return {
        service: 'AI Tokens API',
        status: 'healthy',
        details: response.data,
        timestamp: Date.now()
      }
    } catch (error) {
      return {
        service: 'AI Tokens API',
        status: error.response?.status === 404 ? 'not_configured' : 'error',
        error: error.message,
        timestamp: Date.now()
      }
    }
  }

  async checkTestRunnerAPI() {
    try {
      const response = await axios.get(`${API_BASE_URL}/test-runner/tests`, { timeout: 3000 })
      return {
        service: 'Test Runner API',
        status: 'healthy',
        testCount: response.data?.tests?.length || 0,
        timestamp: Date.now()
      }
    } catch (error) {
      return {
        service: 'Test Runner API',
        status: error.response?.status === 404 ? 'not_configured' : 'error',
        error: error.message,
        timestamp: Date.now()
      }
    }
  }

  async checkSalesAgentAPI() {
    try {
      const response = await axios.get(`${API_BASE_URL}/sales-agent/health`, { timeout: 3000 })
      return {
        service: 'Sales Agent API',
        status: 'healthy',
        details: response.data,
        timestamp: Date.now()
      }
    } catch (error) {
      return {
        service: 'Sales Agent API',
        status: error.response?.status === 404 ? 'not_configured' : 'error',
        error: error.message,
        timestamp: Date.now()
      }
    }
  }

  async checkDatabaseConnection() {
    try {
      const response = await axios.get(`${API_BASE_URL}/health`, { timeout: 5000 })
      const dbConnected = response.data?.database !== false

      return {
        service: 'Database',
        status: dbConnected ? 'healthy' : 'disconnected',
        details: response.data?.database,
        timestamp: Date.now()
      }
    } catch (error) {
      return {
        service: 'Database',
        status: 'error',
        error: error.message,
        timestamp: Date.now()
      }
    }
  }

  async checkWebRTCConnection() {
    try {
      // Check if WebRTC is available
      const hasWebRTC = typeof RTCPeerConnection !== 'undefined'

      if (!hasWebRTC) {
        return {
          service: 'WebRTC',
          status: 'not_available',
          error: 'WebRTC not supported in this browser',
          timestamp: Date.now()
        }
      }

      return {
        service: 'WebRTC',
        status: 'available',
        details: {
          browserSupport: true,
          RTCPeerConnection: typeof RTCPeerConnection !== 'undefined',
          getUserMedia: typeof navigator.mediaDevices?.getUserMedia !== 'undefined'
        },
        timestamp: Date.now()
      }
    } catch (error) {
      return {
        service: 'WebRTC',
        status: 'error',
        error: error.message,
        timestamp: Date.now()
      }
    }
  }

  /**
   * Run tests via test runner
   */
  async runTests(testCategory = 'all') {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/test-runner/run`,
        { category: testCategory },
        { timeout: 120000 } // 2 minutes
      )

      return {
        success: true,
        results: response.data,
        timestamp: Date.now()
      }
    } catch (error) {
      return {
        success: false,
        error: error.message,
        timestamp: Date.now()
      }
    }
  }

  /**
   * Analyze problems and create issues automatically
   */
  async analyzeAndCreateIssues(connectionResults, consoleErrors, buttonResults) {
    const issues = []

    // Check connection failures
    const failedConnections = connectionResults.filter(
      r => r.status === 'error' || r.status === 'disconnected'
    )

    for (const failure of failedConnections) {
      const issue = await this.createGitHubIssue({
        title: `[Health Monitor] ${failure.service} connection failed`,
        problemType: `connection_failure_${failure.service}`,
        severity: 'high',
        description: `The health monitor detected that ${failure.service} is not responding or is disconnected.`,
        errorDetails: {
          service: failure.service,
          status: failure.status,
          error: failure.error,
          timestamp: failure.timestamp
        },
        environment: {
          userAgent: navigator.userAgent,
          timestamp: new Date().toISOString(),
          apiBaseUrl: API_BASE_URL
        }
      })

      if (issue.created) {
        issues.push(issue)
      }
    }

    // Check for "not configured" API endpoints (Issue #2661)
    const notConfiguredAPIs = connectionResults.filter(
      r => r.status === 'not_configured'
    )

    for (const notConfigured of notConfiguredAPIs) {
      const issue = await this.createGitHubIssue({
        title: `[Health Monitor] ${notConfigured.service} - API endpoint не настроен`,
        problemType: `api_not_configured_${notConfigured.service}`,
        severity: 'medium',
        description: `The health monitor detected that ${notConfigured.service} has no configured API endpoint. This may indicate missing backend routes or incomplete service setup.`,
        errorDetails: {
          service: notConfigured.service,
          status: notConfigured.status,
          error: notConfigured.error || 'API endpoint не настроен',
          timestamp: notConfigured.timestamp
        },
        steps: [
          'Check if backend route exists for this service',
          'Verify service is enabled in backend configuration',
          'Ensure proper API endpoint mapping in frontend'
        ],
        environment: {
          userAgent: navigator.userAgent,
          timestamp: new Date().toISOString(),
          apiBaseUrl: API_BASE_URL
        }
      })

      if (issue.created) {
        issues.push(issue)
      }
    }

    // Check console errors
    const recentErrors = consoleErrors.filter(
      err => Date.now() - err.timestamp < 5 * 60 * 1000 // Last 5 minutes
    )

    if (recentErrors.length >= 5) {
      const issue = await this.createGitHubIssue({
        title: `[Health Monitor] Multiple console errors detected (${recentErrors.length})`,
        problemType: 'console_errors',
        severity: 'medium',
        description: `The health monitor detected ${recentErrors.length} console errors in the last 5 minutes.`,
        errorDetails: {
          errorCount: recentErrors.length,
          errors: recentErrors.slice(0, 10).map(e => ({
            message: e.message,
            timestamp: new Date(e.timestamp).toISOString()
          }))
        },
        environment: {
          userAgent: navigator.userAgent,
          timestamp: new Date().toISOString()
        }
      })

      if (issue.created) {
        issues.push(issue)
      }
    }

    // Check button validation failures
    const failedButtons = buttonResults.filter(b => b.status === 'error' || b.status === 'not_found')

    if (failedButtons.length > 0) {
      const issue = await this.createGitHubIssue({
        title: `[Health Monitor] Button validation failures (${failedButtons.length} buttons)`,
        problemType: 'button_validation_failures',
        severity: 'medium',
        description: `The health monitor detected ${failedButtons.length} buttons that failed validation.`,
        errorDetails: {
          failedButtons: failedButtons.map(b => ({
            label: b.label,
            status: b.status,
            error: b.error
          }))
        },
        environment: {
          userAgent: navigator.userAgent,
          timestamp: new Date().toISOString()
        }
      })

      if (issue.created) {
        issues.push(issue)
      }
    }

    return issues
  }

  /**
   * Analyze agent health checks for "API endpoint не настроен" errors
   * Issue #2661: Detect and create issues for unconfigured API endpoints
   */
  async analyzeAgentHealthChecks(agents) {
    const issues = []

    if (!agents || !Array.isArray(agents)) {
      return issues
    }

    for (const agent of agents) {
      // Check if agent has health checks
      if (!agent.healthChecks || !Array.isArray(agent.healthChecks)) {
        continue
      }

      // Look for API endpoint not configured errors
      const apiNotConfiguredCheck = agent.healthChecks.find(
        check =>
          check.name === 'API endpoint' &&
          (check.status === 'info' || check.status === 'warning') &&
          (check.message === 'API endpoint не настроен' ||
           check.message?.includes('не настроен') ||
           check.message?.includes('not configured'))
      )

      if (apiNotConfiguredCheck) {
        const issue = await this.createGitHubIssue({
          title: `[Health Monitor] ${agent.name} - API endpoint не настроен`,
          problemType: `api_not_configured_agent_${agent.id}`,
          severity: 'medium',
          description: `The health monitor detected that agent "${agent.name}" (${agent.id}) has no configured API endpoint.`,
          agent: {
            id: agent.id,
            name: agent.name,
            category: agent.category,
            path: agent.path
          },
          errorDetails: {
            agentId: agent.id,
            agentName: agent.name,
            checkName: apiNotConfiguredCheck.name,
            checkStatus: apiNotConfiguredCheck.status,
            checkMessage: apiNotConfiguredCheck.message,
            healthStatus: agent.healthStatus
          },
          steps: [
            `Navigate to the agent at ${agent.path || 'path not available'}`,
            'Check backend route configuration for this agent',
            'Verify API endpoint is defined in agent configuration',
            'Add missing API route if needed'
          ],
          environment: {
            userAgent: navigator.userAgent,
            timestamp: new Date().toISOString(),
            agentCategory: agent.category
          }
        })

        if (issue.created) {
          issues.push(issue)
        }
      }
    }

    return issues
  }
}

// Export singleton instance
export default new HealthMonitorService()
