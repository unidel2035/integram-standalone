/**
 * Monitoring and Alerts Agent API Service
 * Issue #3045 - Phase 3.3: Monitoring and Alerts Agent
 *
 * Service for interacting with Monitoring and Alerts Agent API
 * Manages metrics collection, alerting, anomaly detection, and notifications
 */

const API_BASE_URL = import.meta.env.VITE_ORCHESTRATOR_URL || 'https://drondoc.ru'

export const monitoringAlertsService = {
  // ========================================
  // Metrics Management
  // ========================================

  /**
   * Define a new metric
   * @param {Object} definition - Metric definition
   * @param {string} definition.name - Metric name
   * @param {string} definition.displayName - Display name
   * @param {string} definition.type - Metric type (counter, gauge, histogram, summary)
   * @param {string} definition.unit - Unit of measurement
   * @param {Array<string>} definition.dimensions - Dimension names
   * @param {string} definition.calculation - Calculation method
   * @returns {Promise<Object>} Metric definition result
   */
  async defineMetric(definition) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/monitoring-alerts/metrics/define`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(definition)
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: `HTTP ${response.status}` }))
        throw new Error(error.error || 'Failed to define metric')
      }

      return response.json()
    } catch (error) {
      console.error('Define metric error:', error)
      throw error
    }
  },

  /**
   * Record a metric value
   * @param {Object} params - Parameters
   * @param {string} params.name - Metric name
   * @param {number} params.value - Metric value
   * @param {Object} params.dimensions - Optional dimensions
   * @param {string} params.timestamp - Optional timestamp
   * @returns {Promise<Object>} Metric recording result
   */
  async recordMetric({ name, value, dimensions = {}, timestamp }) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/monitoring-alerts/metrics/record`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name, value, dimensions, timestamp })
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: `HTTP ${response.status}` }))
        throw new Error(error.error || 'Failed to record metric')
      }

      return response.json()
    } catch (error) {
      console.error('Record metric error:', error)
      throw error
    }
  },

  /**
   * Query metrics with filters
   * @param {Object} query - Query parameters
   * @param {string} query.metric - Metric name filter
   * @param {string} query.startTime - Start time filter
   * @param {string} query.endTime - End time filter
   * @param {Object} query.dimensions - Dimension filters
   * @param {string} query.aggregation - Aggregation method
   * @param {Array<string>} query.groupBy - Group by dimensions
   * @param {number} query.limit - Result limit
   * @returns {Promise<Object>} Query results
   */
  async queryMetrics(query) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/monitoring-alerts/metrics/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(query)
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: `HTTP ${response.status}` }))
        throw new Error(error.error || 'Failed to query metrics')
      }

      return response.json()
    } catch (error) {
      console.error('Query metrics error:', error)
      throw error
    }
  },

  /**
   * Get a specific metric
   * @param {string} metricId - Metric ID
   * @returns {Promise<Object>} Metric data
   */
  async getMetric(metricId) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/monitoring-alerts/metrics/${metricId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: `HTTP ${response.status}` }))
        throw new Error(error.error || 'Failed to get metric')
      }

      return response.json()
    } catch (error) {
      console.error('Get metric error:', error)
      throw error
    }
  },

  // ========================================
  // Alert Rules Management
  // ========================================

  /**
   * Create a new alert rule
   * @param {Object} rule - Alert rule definition
   * @param {string} rule.name - Rule name
   * @param {string} rule.displayName - Display name
   * @param {string} rule.severity - Severity (critical, warning, info)
   * @param {string} rule.metric - Metric to monitor
   * @param {string} rule.condition - Condition (above, below, equals)
   * @param {number} rule.threshold - Threshold value
   * @param {number} rule.duration - Duration in ms
   * @param {Object} rule.dimensions - Dimension filters
   * @param {string} rule.description - Description
   * @param {Array<string>} rule.actions - Actions to take
   * @param {boolean} rule.enabled - Enabled status
   * @returns {Promise<Object>} Alert rule creation result
   */
  async createAlertRule(rule) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/monitoring-alerts/alert-rules`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(rule)
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: `HTTP ${response.status}` }))
        throw new Error(error.error || 'Failed to create alert rule')
      }

      return response.json()
    } catch (error) {
      console.error('Create alert rule error:', error)
      throw error
    }
  },

  /**
   * Update an alert rule
   * @param {string} name - Rule name
   * @param {Object} updates - Updates to apply
   * @returns {Promise<Object>} Alert rule update result
   */
  async updateAlertRule(name, updates) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/monitoring-alerts/alert-rules/${name}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updates)
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: `HTTP ${response.status}` }))
        throw new Error(error.error || 'Failed to update alert rule')
      }

      return response.json()
    } catch (error) {
      console.error('Update alert rule error:', error)
      throw error
    }
  },

  /**
   * Delete an alert rule
   * @param {string} name - Rule name
   * @returns {Promise<Object>} Alert rule deletion result
   */
  async deleteAlertRule(name) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/monitoring-alerts/alert-rules/${name}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: `HTTP ${response.status}` }))
        throw new Error(error.error || 'Failed to delete alert rule')
      }

      return response.json()
    } catch (error) {
      console.error('Delete alert rule error:', error)
      throw error
    }
  },

  // ========================================
  // Alerts Management
  // ========================================

  /**
   * Get alerts with optional filters
   * @param {Object} filters - Filter parameters
   * @param {string} filters.severity - Severity filter
   * @param {string} filters.status - Status filter
   * @param {string} filters.ruleId - Rule ID filter
   * @param {string} filters.startTime - Start time filter
   * @param {string} filters.endTime - End time filter
   * @param {number} filters.limit - Result limit
   * @param {number} filters.offset - Result offset
   * @returns {Promise<Object>} Alerts list
   */
  async getAlerts(filters = {}) {
    try {
      const params = new URLSearchParams()
      if (filters.severity) params.append('severity', filters.severity)
      if (filters.status) params.append('status', filters.status)
      if (filters.ruleId) params.append('ruleId', filters.ruleId)
      if (filters.startTime) params.append('startTime', filters.startTime)
      if (filters.endTime) params.append('endTime', filters.endTime)
      if (filters.limit) params.append('limit', filters.limit)
      if (filters.offset) params.append('offset', filters.offset)

      const response = await fetch(`${API_BASE_URL}/api/monitoring-alerts/alerts?${params}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: `HTTP ${response.status}` }))
        throw new Error(error.error || 'Failed to get alerts')
      }

      return response.json()
    } catch (error) {
      console.error('Get alerts error:', error)
      throw error
    }
  },

  /**
   * Acknowledge an alert
   * @param {string} alertId - Alert ID
   * @param {string} acknowledgedBy - User who acknowledged
   * @returns {Promise<Object>} Acknowledgment result
   */
  async acknowledgeAlert(alertId, acknowledgedBy = 'user') {
    try {
      const response = await fetch(`${API_BASE_URL}/api/monitoring-alerts/alerts/${alertId}/acknowledge`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ acknowledgedBy })
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: `HTTP ${response.status}` }))
        throw new Error(error.error || 'Failed to acknowledge alert')
      }

      return response.json()
    } catch (error) {
      console.error('Acknowledge alert error:', error)
      throw error
    }
  },

  /**
   * Resolve an alert
   * @param {string} alertId - Alert ID
   * @param {string} resolvedBy - User who resolved
   * @param {string} resolution - Resolution notes
   * @returns {Promise<Object>} Resolution result
   */
  async resolveAlert(alertId, resolvedBy = 'user', resolution = '') {
    try {
      const response = await fetch(`${API_BASE_URL}/api/monitoring-alerts/alerts/${alertId}/resolve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ resolvedBy, resolution })
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: `HTTP ${response.status}` }))
        throw new Error(error.error || 'Failed to resolve alert')
      }

      return response.json()
    } catch (error) {
      console.error('Resolve alert error:', error)
      throw error
    }
  },

  // ========================================
  // Anomaly Detection
  // ========================================

  /**
   * Detect anomalies in metrics
   * @param {Object} params - Detection parameters
   * @param {string} params.metric - Metric to analyze
   * @param {number} params.timeWindow - Time window in ms
   * @returns {Promise<Object>} Anomaly detection result
   */
  async detectAnomalies({ metric, timeWindow = 3600000 }) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/monitoring-alerts/anomalies/detect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ metric, timeWindow })
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: `HTTP ${response.status}` }))
        throw new Error(error.error || 'Failed to detect anomalies')
      }

      return response.json()
    } catch (error) {
      console.error('Detect anomalies error:', error)
      throw error
    }
  },

  /**
   * Check thresholds for all metrics
   * @returns {Promise<Object>} Threshold violations
   */
  async checkThresholds() {
    try {
      const response = await fetch(`${API_BASE_URL}/api/monitoring-alerts/thresholds/check`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: `HTTP ${response.status}` }))
        throw new Error(error.error || 'Failed to check thresholds')
      }

      return response.json()
    } catch (error) {
      console.error('Check thresholds error:', error)
      throw error
    }
  },

  // ========================================
  // Monitoring Control
  // ========================================

  /**
   * Start monitoring
   * @returns {Promise<Object>} Start result
   */
  async startMonitoring() {
    try {
      const response = await fetch(`${API_BASE_URL}/api/monitoring-alerts/monitoring/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: `HTTP ${response.status}` }))
        throw new Error(error.error || 'Failed to start monitoring')
      }

      return response.json()
    } catch (error) {
      console.error('Start monitoring error:', error)
      throw error
    }
  },

  /**
   * Stop monitoring
   * @returns {Promise<Object>} Stop result
   */
  async stopMonitoring() {
    try {
      const response = await fetch(`${API_BASE_URL}/api/monitoring-alerts/monitoring/stop`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: `HTTP ${response.status}` }))
        throw new Error(error.error || 'Failed to stop monitoring')
      }

      return response.json()
    } catch (error) {
      console.error('Stop monitoring error:', error)
      throw error
    }
  },

  /**
   * Get monitoring status
   * @returns {Promise<Object>} Monitoring status
   */
  async getStatus() {
    try {
      const response = await fetch(`${API_BASE_URL}/api/monitoring-alerts/status`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: `HTTP ${response.status}` }))
        throw new Error(error.error || 'Failed to get status')
      }

      return response.json()
    } catch (error) {
      console.error('Get status error:', error)
      throw error
    }
  },

  /**
   * Get agent statistics
   * @returns {Promise<Object>} Agent statistics
   */
  async getStats() {
    try {
      const response = await fetch(`${API_BASE_URL}/api/monitoring-alerts/stats`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: `HTTP ${response.status}` }))
        throw new Error(error.error || 'Failed to get stats')
      }

      return response.json()
    } catch (error) {
      console.error('Get stats error:', error)
      throw error
    }
  },

  // ========================================
  // Notification Channels
  // ========================================

  /**
   * Configure notification channel
   * @param {Object} params - Channel configuration
   * @param {string} params.type - Channel type
   * @param {boolean} params.enabled - Enable/disable channel
   * @param {Object} params.config - Channel configuration
   * @returns {Promise<Object>} Configuration result
   */
  async configureChannel({ type, enabled, config }) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/monitoring-alerts/channels/configure`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ type, enabled, config })
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: `HTTP ${response.status}` }))
        throw new Error(error.error || 'Failed to configure channel')
      }

      return response.json()
    } catch (error) {
      console.error('Configure channel error:', error)
      throw error
    }
  },

  /**
   * Test notification channel
   * @param {string} type - Channel type
   * @returns {Promise<Object>} Test result
   */
  async testChannel(type) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/monitoring-alerts/channels/${type}/test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: `HTTP ${response.status}` }))
        throw new Error(error.error || 'Failed to test channel')
      }

      return response.json()
    } catch (error) {
      console.error('Test channel error:', error)
      throw error
    }
  },

  // ========================================
  // Escalation Policies
  // ========================================

  /**
   * Create escalation policy
   * @param {Object} policy - Escalation policy
   * @param {string} policy.id - Policy ID
   * @param {string} policy.name - Policy name
   * @param {Array<Object>} policy.levels - Escalation levels
   * @returns {Promise<Object>} Policy creation result
   */
  async createEscalationPolicy(policy) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/monitoring-alerts/escalation/policies`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(policy)
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: `HTTP ${response.status}` }))
        throw new Error(error.error || 'Failed to create escalation policy')
      }

      return response.json()
    } catch (error) {
      console.error('Create escalation policy error:', error)
      throw error
    }
  },

  /**
   * Update escalation policy
   * @param {string} id - Policy ID
   * @param {Object} updates - Updates to apply
   * @returns {Promise<Object>} Policy update result
   */
  async updateEscalationPolicy(id, updates) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/monitoring-alerts/escalation/policies/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updates)
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: `HTTP ${response.status}` }))
        throw new Error(error.error || 'Failed to update escalation policy')
      }

      return response.json()
    } catch (error) {
      console.error('Update escalation policy error:', error)
      throw error
    }
  }
}

export default monitoringAlertsService
