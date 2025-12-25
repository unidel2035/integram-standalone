/**
 * UUID v4 Generation Utility
 *
 * Provides UUID generation for Thing entities in Role-Sets paradigm.
 * Uses crypto API when available, falls back to Math.random().
 */

/**
 * Generates a UUID v4 (random)
 *
 * @returns {string} UUID v4 string
 *
 * @example
 * const id = v4()
 * // '550e8400-e29b-41d4-a716-446655440000'
 */
export function v4() {
  // Use crypto.randomUUID if available (modern browsers/Node 19+)
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }

  // Fallback implementation using crypto.getRandomValues
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const bytes = new Uint8Array(16)
    crypto.getRandomValues(bytes)

    // Set version (4) and variant bits
    bytes[6] = (bytes[6] & 0x0f) | 0x40 // Version 4
    bytes[8] = (bytes[8] & 0x3f) | 0x80 // Variant 10

    // Convert to hex string with dashes
    const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
  }

  // Fallback for older environments (less secure)
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

/**
 * Validates UUID format
 *
 * @param {string} uuid - String to validate
 * @returns {boolean} True if valid UUID format
 *
 * @example
 * isValidUUID('550e8400-e29b-41d4-a716-446655440000') // true
 * isValidUUID('not-a-uuid') // false
 */
export function isValidUUID(uuid) {
  if (typeof uuid !== 'string') {
    return false
  }

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  return uuidRegex.test(uuid)
}

/**
 * Generates a prefixed UUID for specific entity types
 *
 * @param {string} prefix - Prefix for the UUID (e.g., 'thing', 'prism', 'role')
 * @returns {string} Prefixed UUID
 *
 * @example
 * const thingId = prefixedUUID('thing')
 * // 'thing-550e8400-e29b-41d4-a716-446655440000'
 */
export function prefixedUUID(prefix) {
  return `${prefix}-${v4()}`
}

export default {
  v4,
  isValidUUID,
  prefixedUUID
}
