/**
 * Tests for Secure API Client Utilities
 *
 * Tests security features including HTTPS enforcement,
 * certificate validation, and secure axios configuration.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import https from 'https';
import {
  enforceHTTPS,
  createSecureAgent,
  validateSensitiveDataTransmission,
  getSecureAxiosConfig,
  maskSensitiveData,
  auditSecurityOperation
} from '../secureApiClient.js';

describe('secureApiClient', () => {
  describe('enforceHTTPS', () => {
    it('should pass for valid HTTPS URLs', () => {
      expect(() => enforceHTTPS('https://example.com')).not.toThrow();
      expect(() => enforceHTTPS('HTTPS://EXAMPLE.COM')).not.toThrow();
      expect(() => enforceHTTPS('https://example.integram.io/api')).not.toThrow();
    });

    it('should throw error for HTTP URLs', () => {
      expect(() => enforceHTTPS('http://example.com')).toThrow(/Insecure connection/);
      expect(() => enforceHTTPS('HTTP://EXAMPLE.COM')).toThrow(/HTTPS required/);
    });

    it('should throw error for invalid URLs', () => {
      expect(() => enforceHTTPS('ftp://example.com')).toThrow(/Insecure connection/);
      expect(() => enforceHTTPS('')).toThrow(/URL is required/);
      expect(() => enforceHTTPS(null)).toThrow(/URL is required/);
    });

    it('should handle URLs with paths and query strings', () => {
      expect(() => enforceHTTPS('https://example.com/path?query=1')).not.toThrow();
      expect(() => enforceHTTPS('http://example.com/path?query=1')).toThrow();
    });
  });

  describe('createSecureAgent', () => {
    it('should create HTTPS agent with default secure settings', () => {
      const agent = createSecureAgent();
      expect(agent).toBeInstanceOf(https.Agent);
      expect(agent.options.minVersion).toBe('TLSv1.2');
      expect(agent.options.rejectUnauthorized).toBe(true);
    });

    it('should create agent with custom rejectUnauthorized setting in non-production', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const agent = createSecureAgent({ rejectUnauthorized: false });
      expect(agent.options.rejectUnauthorized).toBe(false);

      process.env.NODE_ENV = originalEnv;
    });

    it('should always use rejectUnauthorized=true in production', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const agent = createSecureAgent({ rejectUnauthorized: false });
      expect(agent.options.rejectUnauthorized).toBe(true);

      process.env.NODE_ENV = originalEnv;
    });

    it('should configure TLS 1.2+ and strong ciphers', () => {
      const agent = createSecureAgent();
      expect(agent.options.minVersion).toBe('TLSv1.2');
      expect(agent.options.ciphers).toContain('ECDHE-RSA-AES128-GCM-SHA256');
      expect(agent.options.ciphers).toContain('ECDHE-RSA-AES256-GCM-SHA384');
    });

    it('should support certificate pinning', () => {
      const pinnedCerts = ['SHA256:abc123'];
      const agent = createSecureAgent({ pinnedCertificates: pinnedCerts });
      expect(agent.options.checkServerIdentity).toBeDefined();
      expect(typeof agent.options.checkServerIdentity).toBe('function');
    });
  });

  describe('validateSensitiveDataTransmission', () => {
    it('should pass validation for HTTPS URLs with sensitive data', () => {
      const url = 'https://example.com/api';
      const data = { password: 'secret123' };
      expect(() => validateSensitiveDataTransmission(url, data, ['password'])).not.toThrow();
    });

    it('should throw error for HTTP URLs with sensitive data', () => {
      const url = 'http://example.com/api';
      const data = { password: 'secret123' };
      expect(() => validateSensitiveDataTransmission(url, data, ['password'])).toThrow(/Insecure connection/);
    });

    it('should validate URLSearchParams data', () => {
      const url = 'https://example.com/api';
      const data = new URLSearchParams();
      data.append('password', 'secret123');
      expect(() => validateSensitiveDataTransmission(url, data, ['password'])).not.toThrow();
    });

    it('should detect sensitive fields in URLSearchParams', () => {
      const url = 'http://example.com/api';
      const data = new URLSearchParams();
      data.append('pwd', 'secret123');
      expect(() => validateSensitiveDataTransmission(url, data, ['pwd'])).toThrow();
    });

    it('should handle custom sensitive field names', () => {
      const url = 'https://example.com/api';
      const data = { customSecret: 'value' };
      expect(() => validateSensitiveDataTransmission(url, data, ['customSecret'])).not.toThrow();
    });
  });

  describe('getSecureAxiosConfig', () => {
    it('should return config with HTTPS agent', () => {
      const url = 'https://example.com/api';
      const config = getSecureAxiosConfig(url);

      expect(config.httpsAgent).toBeInstanceOf(https.Agent);
      expect(config.timeout).toBe(30000);
      expect(config.validateStatus).toBeDefined();
    });

    it('should enforce HTTPS when hasSensitiveData is true', () => {
      const url = 'http://example.com/api';
      expect(() => getSecureAxiosConfig(url, { hasSensitiveData: true })).toThrow(/Insecure connection/);
    });

    it('should allow HTTP when hasSensitiveData is false', () => {
      const url = 'http://example.com/api';
      expect(() => getSecureAxiosConfig(url, { hasSensitiveData: false })).not.toThrow();
    });

    it('should validate status codes 200-299', () => {
      const url = 'https://example.com/api';
      const config = getSecureAxiosConfig(url);

      expect(config.validateStatus(200)).toBe(true);
      expect(config.validateStatus(299)).toBe(true);
      expect(config.validateStatus(300)).toBe(false);
      expect(config.validateStatus(404)).toBe(false);
      expect(config.validateStatus(500)).toBe(false);
    });

    it('should support certificate pinning via options', () => {
      const url = 'https://example.com/api';
      const pinnedCerts = ['SHA256:abc123'];
      const config = getSecureAxiosConfig(url, { pinnedCertificates: pinnedCerts });

      expect(config.httpsAgent).toBeInstanceOf(https.Agent);
      expect(config.httpsAgent.options.checkServerIdentity).toBeDefined();
    });
  });

  describe('maskSensitiveData', () => {
    it('should fully redact by default', () => {
      expect(maskSensitiveData('password123')).toBe('[PASSWORD]');
      expect(maskSensitiveData('secretKey')).toBe('[PASSWORD]');
    });

    it('should return [EMPTY] for empty values', () => {
      expect(maskSensitiveData('')).toBe('[EMPTY]');
      expect(maskSensitiveData(null)).toBe('[EMPTY]');
      expect(maskSensitiveData(undefined)).toBe('[EMPTY]');
    });

    it('should show specified number of visible characters', () => {
      expect(maskSensitiveData('password123', 4)).toBe('pass[REDACTED]');
      expect(maskSensitiveData('secret', 2)).toBe('se[REDACTED]');
    });

    it('should fully redact short values when visibleChars is too large', () => {
      expect(maskSensitiveData('pwd', 5)).toBe('[REDACTED]');
    });

    it('should handle edge cases', () => {
      expect(maskSensitiveData('a', 0)).toBe('[PASSWORD]');
      expect(maskSensitiveData('ab', 1)).toBe('a[REDACTED]');
    });
  });

  describe('auditSecurityOperation', () => {
    it('should log security operation without throwing', () => {
      const operation = {
        type: 'password_transmission',
        url: 'https://example.com/api',
        user: 'testuser',
        success: true,
        details: { method: 'POST' }
      };

      expect(() => auditSecurityOperation(operation)).not.toThrow();
    });

    it('should handle minimal operation data', () => {
      const operation = {
        type: 'test_operation'
      };

      expect(() => auditSecurityOperation(operation)).not.toThrow();
    });

    it('should log failed operations', () => {
      const operation = {
        type: 'authentication_failed',
        url: 'https://example.com/auth',
        user: 'user@example.com',
        success: false,
        details: { reason: 'Invalid credentials' }
      };

      expect(() => auditSecurityOperation(operation)).not.toThrow();
    });
  });

  describe('Integration: Secure password transmission flow', () => {
    it('should validate complete secure transmission flow', () => {
      const url = 'https://api.integram.io/auth';
      const password = 'mySecurePassword123';

      // Step 1: Enforce HTTPS
      expect(() => enforceHTTPS(url)).not.toThrow();

      // Step 2: Validate sensitive data transmission
      expect(() => validateSensitiveDataTransmission(url, { password }, ['password'])).not.toThrow();

      // Step 3: Get secure config
      const config = getSecureAxiosConfig(url, { hasSensitiveData: true });
      expect(config.httpsAgent).toBeInstanceOf(https.Agent);

      // Step 4: Mask password for logging
      const maskedPassword = maskSensitiveData(password);
      expect(maskedPassword).toBe('[PASSWORD]');

      // Step 5: Audit operation
      expect(() => auditSecurityOperation({
        type: 'password_transmission',
        url,
        success: true
      })).not.toThrow();
    });

    it('should reject insecure transmission flow', () => {
      const url = 'http://api.integram.io/auth';
      const password = 'mySecurePassword123';

      // Should fail at HTTPS enforcement
      expect(() => enforceHTTPS(url)).toThrow(/Insecure connection/);

      // Should fail at validation
      expect(() => validateSensitiveDataTransmission(url, { password }, ['password'])).toThrow(/HTTPS required/);

      // Should fail at config generation
      expect(() => getSecureAxiosConfig(url, { hasSensitiveData: true })).toThrow(/Insecure connection/);
    });
  });
});
