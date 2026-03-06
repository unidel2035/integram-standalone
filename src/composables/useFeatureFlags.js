import { ref, computed, onMounted, onUnmounted } from 'vue'
import featureFlagsService from '@/service/FeatureFlagsService'

/**
 * Vue composable for feature flags
 * Provides reactive feature flag checks and management
 */
export function useFeatureFlags() {
  const flags = ref(featureFlagsService.getAllFlags())
  const auditLog = ref(featureFlagsService.getAuditLog())

  let unsubscribe = null

  onMounted(() => {
    // Subscribe to flag changes
    unsubscribe = featureFlagsService.subscribe((updatedFlags) => {
      flags.value = updatedFlags
      auditLog.value = featureFlagsService.getAuditLog()
    })
  })

  onUnmounted(() => {
    // Cleanup subscription
    if (unsubscribe) {
      unsubscribe()
    }
  })

  /**
   * Check if a feature flag is enabled
   * @param {string} flagKey - The flag key
   * @param {object} context - Context for targeting
   * @returns {boolean}
   */
  const isEnabled = (flagKey, context = {}) => {
    return featureFlagsService.isEnabled(flagKey, context)
  }

  /**
   * Get variant for A/B testing
   * @param {string} flagKey - The flag key
   * @param {object} context - Context for targeting
   * @param {string} fallback - Fallback variant
   * @returns {string}
   */
  const getVariant = (flagKey, context = {}, fallback = 'control') => {
    return featureFlagsService.getVariant(flagKey, context, fallback)
  }

  /**
   * Get all flags (reactive)
   */
  const getAllFlags = computed(() => flags.value)

  /**
   * Get single flag
   */
  const getFlag = (flagKey) => {
    return featureFlagsService.getFlag(flagKey)
  }

  /**
   * Toggle a flag on/off
   */
  const toggleFlag = (flagKey, enabled) => {
    featureFlagsService.toggleFlag(flagKey, enabled)
  }

  /**
   * Set rollout percentage
   */
  const setRolloutPercentage = (flagKey, percentage) => {
    featureFlagsService.setRolloutPercentage(flagKey, percentage)
  }

  /**
   * Create or update a flag
   */
  const setFlag = (flagKey, config) => {
    featureFlagsService.setFlag(flagKey, config)
  }

  /**
   * Delete a flag
   */
  const deleteFlag = (flagKey) => {
    featureFlagsService.deleteFlag(flagKey)
  }

  /**
   * Get audit log (reactive)
   */
  const getAuditLog = computed(() => auditLog.value)

  /**
   * Export flags
   */
  const exportFlags = () => {
    return featureFlagsService.exportFlags()
  }

  /**
   * Import flags
   */
  const importFlags = (data) => {
    featureFlagsService.importFlags(data)
  }

  /**
   * Get stale flags
   */
  const getStaleFlags = (daysThreshold = 90) => {
    return featureFlagsService.getStaleFlags(daysThreshold)
  }

  /**
   * Reset flags to defaults
   */
  const reset = () => {
    featureFlagsService.reset()
  }

  return {
    // Reactive state
    flags: getAllFlags,
    auditLog: getAuditLog,

    // Methods
    isEnabled,
    getVariant,
    getFlag,
    toggleFlag,
    setRolloutPercentage,
    setFlag,
    deleteFlag,
    exportFlags,
    importFlags,
    getStaleFlags,
    reset
  }
}
