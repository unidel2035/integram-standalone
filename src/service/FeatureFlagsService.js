/**
 * Feature Flags Service
 * Provides feature flag management, targeting, and rollout capabilities
 */

const STORAGE_KEY = 'feature_flags_config'
const AUDIT_LOG_KEY = 'feature_flags_audit_log'

/**
 * Flag Types
 */
export const FlagType = {
  RELEASE: 'release', // For gradual rollout
  EXPERIMENT: 'experiment', // For A/B testing
  OPS: 'ops', // For operational control
  PERMISSION: 'permission', // For access by subscription tier
  KILL_SWITCH: 'kill_switch' // For emergency disable
}

/**
 * Default flag configuration
 */
const DEFAULT_FLAGS = {
  // Example flags - replace with actual feature flags
  'ui.new-dashboard.enabled': {
    type: FlagType.RELEASE,
    enabled: false,
    rolloutPercentage: 0,
    description: 'New dashboard UI',
    targeting: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  'api.rate-limit-v2.enabled': {
    type: FlagType.OPS,
    enabled: false,
    rolloutPercentage: 0,
    description: 'New rate limiting system',
    targeting: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
}

class FeatureFlagsService {
  constructor() {
    this.flags = this.loadFlags()
    this.listeners = []
    this.auditLog = this.loadAuditLog()
  }

  /**
   * Load flags from localStorage
   */
  loadFlags() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        return JSON.parse(stored)
      }
    } catch (e) {
      console.error('Failed to load feature flags:', e)
    }
    return { ...DEFAULT_FLAGS }
  }

  /**
   * Save flags to localStorage
   */
  saveFlags() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.flags))
      this.notifyListeners()
    } catch (e) {
      console.error('Failed to save feature flags:', e)
    }
  }

  /**
   * Load audit log from localStorage
   */
  loadAuditLog() {
    try {
      const stored = localStorage.getItem(AUDIT_LOG_KEY)
      if (stored) {
        return JSON.parse(stored)
      }
    } catch (e) {
      console.error('Failed to load audit log:', e)
    }
    return []
  }

  /**
   * Save audit log to localStorage
   */
  saveAuditLog() {
    try {
      // Keep only last 1000 entries
      if (this.auditLog.length > 1000) {
        this.auditLog = this.auditLog.slice(-1000)
      }
      localStorage.setItem(AUDIT_LOG_KEY, JSON.stringify(this.auditLog))
    } catch (e) {
      console.error('Failed to save audit log:', e)
    }
  }

  /**
   * Add entry to audit log
   */
  addAuditEntry(action, flagKey, details = {}) {
    const entry = {
      timestamp: new Date().toISOString(),
      action,
      flagKey,
      details,
      user: this.getCurrentUser()
    }
    this.auditLog.push(entry)
    this.saveAuditLog()
  }

  /**
   * Get current user (can be extended to use actual auth)
   */
  getCurrentUser() {
    // Try to get user from localStorage or return anonymous
    try {
      const token = localStorage.getItem('token')
      if (token) {
        // In a real app, decode token to get user info
        return { id: 'authenticated', token }
      }
    } catch {
      // ignore
    }
    return { id: 'anonymous' }
  }

  /**
   * Check if a feature flag is enabled
   * @param {string} flagKey - The flag key (e.g., 'ui.new-dashboard.enabled')
   * @param {object} context - Context for targeting (userId, orgId, tier, etc.)
   * @returns {boolean}
   */
  isEnabled(flagKey, context = {}) {
    const flag = this.flags[flagKey]

    // If flag doesn't exist, return false (fail closed)
    if (!flag) {
      return false
    }

    // If flag is explicitly disabled, return false
    if (!flag.enabled) {
      return false
    }

    // Check targeting rules
    if (!this.matchesTargeting(flag, context)) {
      return false
    }

    // Check percentage rollout
    if (flag.rolloutPercentage < 100) {
      return this.isInRollout(flagKey, context, flag.rolloutPercentage)
    }

    return true
  }

  /**
   * Check if context matches targeting rules
   */
  matchesTargeting(flag, context) {
    const targeting = flag.targeting || {}

    // User ID targeting
    if (targeting.userIds && targeting.userIds.length > 0) {
      if (!context.userId || !targeting.userIds.includes(context.userId)) {
        return false
      }
    }

    // Organization targeting
    if (targeting.organizationIds && targeting.organizationIds.length > 0) {
      if (!context.organizationId || !targeting.organizationIds.includes(context.organizationId)) {
        return false
      }
    }

    // Email domain targeting
    if (targeting.emailDomains && targeting.emailDomains.length > 0) {
      if (!context.email) {
        return false
      }
      const domain = context.email.split('@')[1]
      if (!targeting.emailDomains.includes(domain)) {
        return false
      }
    }

    // Subscription tier targeting
    if (targeting.subscriptionTiers && targeting.subscriptionTiers.length > 0) {
      if (!context.subscriptionTier || !targeting.subscriptionTiers.includes(context.subscriptionTier)) {
        return false
      }
    }

    // Location targeting
    if (targeting.locations && targeting.locations.length > 0) {
      if (!context.location || !targeting.locations.includes(context.location)) {
        return false
      }
    }

    // Custom attributes
    if (targeting.customAttributes && Object.keys(targeting.customAttributes).length > 0) {
      for (const [key, value] of Object.entries(targeting.customAttributes)) {
        if (context[key] !== value) {
          return false
        }
      }
    }

    return true
  }

  /**
   * Check if user is in percentage rollout
   * Uses consistent hashing to ensure same user always gets same result
   */
  isInRollout(flagKey, context, percentage) {
    // Get a stable identifier for this user/context
    const identifier = context.userId || context.sessionId || 'anonymous'

    // Create a hash from flagKey + identifier
    const hash = this.simpleHash(flagKey + identifier)

    // Convert to percentage (0-100)
    const bucket = hash % 100

    return bucket < percentage
  }

  /**
   * Simple hash function for consistent rollout
   */
  simpleHash(str) {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32bit integer
    }
    return Math.abs(hash)
  }

  /**
   * Get variant for A/B testing
   * @param {string} flagKey - The flag key
   * @param {object} context - Context for targeting
   * @param {string} fallback - Fallback variant name (default: 'control')
   * @returns {string} - Variant name
   */
  getVariant(flagKey, context = {}, fallback = 'control') {
    const flag = this.flags[flagKey]

    if (!flag || !flag.enabled) {
      return fallback
    }

    if (!this.matchesTargeting(flag, context)) {
      return fallback
    }

    const variants = flag.variants || []
    if (variants.length === 0) {
      return fallback
    }

    // Get a stable identifier for this user/context
    const identifier = context.userId || context.sessionId || 'anonymous'

    // Create a hash from flagKey + identifier
    const hash = this.simpleHash(flagKey + identifier)

    // Calculate total weight
    const totalWeight = variants.reduce((sum, v) => sum + (v.weight || 0), 0)

    if (totalWeight === 0) {
      return fallback
    }

    // Select variant based on hash
    const bucket = hash % totalWeight
    let currentWeight = 0

    for (const variant of variants) {
      currentWeight += variant.weight || 0
      if (bucket < currentWeight) {
        return variant.name
      }
    }

    return fallback
  }

  /**
   * Get all flags
   */
  getAllFlags() {
    return { ...this.flags }
  }

  /**
   * Get single flag
   */
  getFlag(flagKey) {
    return this.flags[flagKey] ? { ...this.flags[flagKey] } : null
  }

  /**
   * Create or update a flag
   */
  setFlag(flagKey, config) {
    const isNew = !this.flags[flagKey]
    const oldValue = this.flags[flagKey] ? { ...this.flags[flagKey] } : null

    this.flags[flagKey] = {
      ...config,
      updatedAt: new Date().toISOString(),
      createdAt: this.flags[flagKey]?.createdAt || new Date().toISOString()
    }

    this.saveFlags()

    this.addAuditEntry(
      isNew ? 'flag_created' : 'flag_updated',
      flagKey,
      { oldValue, newValue: this.flags[flagKey] }
    )
  }

  /**
   * Update flag enabled state
   */
  toggleFlag(flagKey, enabled) {
    if (!this.flags[flagKey]) {
      throw new Error(`Flag ${flagKey} does not exist`)
    }

    const oldValue = this.flags[flagKey].enabled
    this.flags[flagKey].enabled = enabled
    this.flags[flagKey].updatedAt = new Date().toISOString()

    this.saveFlags()

    this.addAuditEntry(
      enabled ? 'flag_enabled' : 'flag_disabled',
      flagKey,
      { oldValue, newValue: enabled }
    )
  }

  /**
   * Update rollout percentage
   */
  setRolloutPercentage(flagKey, percentage) {
    if (!this.flags[flagKey]) {
      throw new Error(`Flag ${flagKey} does not exist`)
    }

    if (percentage < 0 || percentage > 100) {
      throw new Error('Percentage must be between 0 and 100')
    }

    const oldValue = this.flags[flagKey].rolloutPercentage
    this.flags[flagKey].rolloutPercentage = percentage
    this.flags[flagKey].updatedAt = new Date().toISOString()

    this.saveFlags()

    this.addAuditEntry(
      'rollout_percentage_changed',
      flagKey,
      { oldValue, newValue: percentage }
    )
  }

  /**
   * Delete a flag
   */
  deleteFlag(flagKey) {
    if (!this.flags[flagKey]) {
      throw new Error(`Flag ${flagKey} does not exist`)
    }

    const oldValue = { ...this.flags[flagKey] }
    delete this.flags[flagKey]

    this.saveFlags()

    this.addAuditEntry('flag_deleted', flagKey, { oldValue })
  }

  /**
   * Get audit log
   */
  getAuditLog(limit = 100) {
    return this.auditLog.slice(-limit).reverse()
  }

  /**
   * Export flags configuration
   */
  exportFlags() {
    return {
      flags: this.flags,
      exportedAt: new Date().toISOString(),
      version: '1.0'
    }
  }

  /**
   * Import flags configuration
   */
  importFlags(data) {
    if (!data.flags) {
      throw new Error('Invalid import data')
    }

    this.flags = { ...data.flags }
    this.saveFlags()

    this.addAuditEntry('flags_imported', 'all', {
      importedAt: new Date().toISOString(),
      flagCount: Object.keys(data.flags).length
    })
  }

  /**
   * Subscribe to flag changes
   */
  subscribe(callback) {
    this.listeners.push(callback)

    // Return unsubscribe function
    return () => {
      this.listeners = this.listeners.filter(cb => cb !== callback)
    }
  }

  /**
   * Notify all listeners of flag changes
   */
  notifyListeners() {
    this.listeners.forEach(callback => {
      try {
        callback(this.flags)
      } catch (e) {
        console.error('Error in feature flags listener:', e)
      }
    })
  }

  /**
   * Get flags that are stale (not updated in X days)
   */
  getStaleFlags(daysThreshold = 90) {
    const threshold = new Date()
    threshold.setDate(threshold.getDate() - daysThreshold)

    return Object.entries(this.flags)
      .filter(([, flag]) => {
        const updatedAt = new Date(flag.updatedAt)
        return updatedAt < threshold
      })
      .map(([key, flag]) => ({
        key,
        ...flag,
        daysSinceUpdate: Math.floor((Date.now() - new Date(flag.updatedAt).getTime()) / (1000 * 60 * 60 * 24))
      }))
  }

  /**
   * Reset all flags to defaults (useful for testing)
   */
  reset() {
    this.flags = { ...DEFAULT_FLAGS }
    this.saveFlags()
    this.addAuditEntry('flags_reset', 'all', {})
  }
}

// Create singleton instance
const featureFlagsService = new FeatureFlagsService()

export default featureFlagsService
