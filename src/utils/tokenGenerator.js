/**
 * Client-side Token Generator
 *
 * Issue #1232 - Tokens should be generated on the client side, not on the server
 *
 * This utility provides cryptographically secure token generation using the Web Crypto API.
 * Tokens are generated in the browser and then sent to the server for storage.
 */

/**
 * Generate a secure DronDoc AI access token
 *
 * The token format is: dd_tok_<base64url_encoded_random_bytes>
 * - Uses Web Crypto API for cryptographically secure random generation
 * - 32 bytes of randomness (256 bits)
 * - Base64url encoding for URL safety
 *
 * @returns {string} A secure token in the format dd_tok_XXXXXX...
 */
export function generateSecureToken() {
  // Generate 32 random bytes using Web Crypto API
  const randomBytes = new Uint8Array(32)
  crypto.getRandomValues(randomBytes)

  // Convert to base64url format (URL-safe base64)
  const base64url = btoa(String.fromCharCode(...randomBytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')

  // Add DronDoc token prefix
  return `dd_tok_${base64url}`
}

/**
 * Validate token format
 *
 * @param {string} token - Token to validate
 * @returns {boolean} True if token has valid format
 */
export function isValidTokenFormat(token) {
  // Token should start with dd_tok_ and have sufficient length
  if (!token || typeof token !== 'string') {
    return false
  }

  if (!token.startsWith('dd_tok_')) {
    return false
  }

  // After prefix, should have at least 20 characters (from 32 random bytes)
  const tokenBody = token.substring(7) // Remove 'dd_tok_'
  return tokenBody.length >= 20
}

/**
 * Get token prefix for display
 *
 * @param {string} token - Full token
 * @returns {string} First 15 characters of the token
 */
export function getTokenPrefix(token) {
  if (!token || token.length < 15) {
    return token
  }
  return token.substring(0, 15)
}
