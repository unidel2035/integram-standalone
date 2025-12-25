/**
 * ID Generation Utility
 *
 * Provides unique ID generation for the Role-Sets system
 */

/**
 * Generate a unique ID
 * Uses crypto.randomUUID() if available, otherwise falls back to timestamp-based ID
 *
 * @returns {string} Unique identifier
 */
export function generateId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }

  // Fallback for environments without crypto.randomUUID
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Generate a prefixed ID
 *
 * @param {string} prefix - Prefix for the ID (e.g., 'thing', 'prism', 'binding')
 * @returns {string} Prefixed unique identifier
 */
export function generatePrefixedId(prefix) {
  return `${prefix}-${generateId()}`
}

/**
 * Alias for generateId (for backward compatibility)
 * @returns {string} Unique identifier
 */
export function generateUniqueId() {
  return generateId()
}
