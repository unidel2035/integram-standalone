/**
 * Secure API Client Utilities
 *
 * Provides security enhancements for API communication including:
 * - HTTPS enforcement for sensitive data transmission
 * - Certificate pinning configuration
 * - Secure axios agent configuration
 * - Request validation for password transmission
 *
 * Security compliance:
 * - CWE-319 (Cleartext Transmission of Sensitive Information)
 * - OWASP A02:2021 (Cryptographic Failures)
 *
 * @module secureApiClient
 */

import https from 'https';
import logger from './logger.js';

/**
 * Validate that URL uses HTTPS protocol
 * @param {string} url - URL to validate
 * @throws {Error} If URL does not use HTTPS
 */
export function enforceHTTPS(url) {
  if (!url) {
    throw new Error('URL is required for HTTPS validation');
  }

  const urlLower = url.toLowerCase();

  if (!urlLower.startsWith('https://')) {
    logger.error({ url: urlLower.substring(0, 30) }, 'Insecure connection attempted');
    throw new Error(
      'Insecure connection: HTTPS required for password transmission. ' +
      'HTTP connections are not allowed when transmitting sensitive data.'
    );
  }

  logger.debug({ url: urlLower.substring(0, 50) }, 'HTTPS validation passed');
}

/**
 * Create secure HTTPS agent with certificate validation
 * @param {Object} options - Configuration options
 * @param {boolean} options.rejectUnauthorized - Reject unauthorized certificates (default: true)
 * @param {string[]} options.pinnedCertificates - Optional array of pinned certificate fingerprints
 * @returns {https.Agent} Configured HTTPS agent
 */
export function createSecureAgent(options = {}) {
  const {
    rejectUnauthorized = true,
    pinnedCertificates = null
  } = options;

  const agentConfig = {
    // Always reject unauthorized certificates in production
    rejectUnauthorized: process.env.NODE_ENV === 'production' ? true : rejectUnauthorized,

    // Enable TLS 1.2 and higher only
    minVersion: 'TLSv1.2',

    // Prefer strong cipher suites
    ciphers: [
      'ECDHE-RSA-AES128-GCM-SHA256',
      'ECDHE-RSA-AES256-GCM-SHA384',
      'ECDHE-ECDSA-AES128-GCM-SHA256',
      'ECDHE-ECDSA-AES256-GCM-SHA384'
    ].join(':'),

    // Enable certificate verification
    checkServerIdentity: (hostname, cert) => {
      // Perform standard certificate validation
      const err = https.globalAgent.options.checkServerIdentity(hostname, cert);
      if (err) {
        logger.error({ hostname, error: err.message }, 'Certificate validation failed');
        return err;
      }

      // Optional: Certificate pinning
      if (pinnedCertificates && pinnedCertificates.length > 0) {
        const fingerprint = cert.fingerprint256;
        if (!pinnedCertificates.includes(fingerprint)) {
          const error = new Error(
            `Certificate pinning validation failed. ` +
            `Server certificate fingerprint does not match pinned certificates.`
          );
          logger.error({
            hostname,
            fingerprint: fingerprint?.substring(0, 20) + '...',
            expectedCount: pinnedCertificates.length
          }, 'Certificate pinning failed');
          return error;
        }
        logger.debug({ hostname }, 'Certificate pinning validation passed');
      }

      return undefined;
    }
  };

  const agent = new https.Agent(agentConfig);

  logger.info({
    rejectUnauthorized: agentConfig.rejectUnauthorized,
    hasPinnedCerts: !!(pinnedCertificates && pinnedCertificates.length > 0),
    environment: process.env.NODE_ENV || 'development'
  }, 'Secure HTTPS agent created');

  return agent;
}

/**
 * Validate sensitive data transmission request
 * @param {string} url - Target URL
 * @param {Object} data - Request data
 * @param {string[]} sensitiveFields - Fields that contain sensitive data (e.g., ['password', 'pwd'])
 * @throws {Error} If validation fails
 */
export function validateSensitiveDataTransmission(url, data, sensitiveFields = ['password', 'pwd']) {
  // Enforce HTTPS for sensitive data
  enforceHTTPS(url);

  // Log security audit trail (without sensitive values)
  const hasSensitiveData = sensitiveFields.some(field => {
    if (typeof data === 'string' || data instanceof URLSearchParams) {
      return data.toString().includes(field);
    }
    return data && data[field];
  });

  if (hasSensitiveData) {
    logger.info({
      url: url.substring(0, 50),
      protocol: 'HTTPS',
      sensitiveFields: sensitiveFields,
      timestamp: new Date().toISOString()
    }, 'Sensitive data transmission validated');
  }

  return true;
}

/**
 * Get axios configuration for secure API requests
 * @param {string} url - Target URL
 * @param {Object} options - Configuration options
 * @param {boolean} options.hasSensitiveData - Whether request contains sensitive data
 * @param {string[]} options.pinnedCertificates - Optional pinned certificates
 * @returns {Object} Axios configuration object
 */
export function getSecureAxiosConfig(url, options = {}) {
  const { hasSensitiveData = false, pinnedCertificates = null } = options;

  // Always enforce HTTPS when dealing with sensitive data
  if (hasSensitiveData) {
    enforceHTTPS(url);
  }

  // Create secure HTTPS agent
  const httpsAgent = createSecureAgent({
    rejectUnauthorized: true,
    pinnedCertificates
  });

  return {
    httpsAgent,
    // Add timeout to prevent hanging connections
    timeout: 30000,
    // Validate status
    validateStatus: (status) => status >= 200 && status < 300
  };
}

/**
 * Mask sensitive data in logs
 * @param {string} value - Value to mask
 * @param {number} visibleChars - Number of characters to keep visible (default: 0)
 * @returns {string} Masked value
 */
export function maskSensitiveData(value, visibleChars = 0) {
  if (!value) return '[EMPTY]';
  if (value.length <= visibleChars) return '[REDACTED]';

  if (visibleChars > 0) {
    return value.substring(0, visibleChars) + '[REDACTED]';
  }

  return '[PASSWORD]';
}

/**
 * Audit log for security-sensitive operations
 * @param {Object} operation - Operation details
 */
export function auditSecurityOperation(operation) {
  const auditEntry = {
    timestamp: new Date().toISOString(),
    operation: operation.type,
    target: operation.url ? operation.url.substring(0, 50) : 'N/A',
    user: operation.user || 'system',
    success: operation.success ?? true,
    securityLevel: 'HIGH',
    details: operation.details || {}
  };

  logger.info(auditEntry, 'Security audit log');
}

export default {
  enforceHTTPS,
  createSecureAgent,
  validateSensitiveDataTransmission,
  getSecureAxiosConfig,
  maskSensitiveData,
  auditSecurityOperation
};
