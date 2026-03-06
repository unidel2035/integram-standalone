/**
 * Unit tests for redirectValidation utility
 * Issue #3786 - Test redirect URL validation
 */

import { describe, it, expect } from 'vitest'
import { isValidRedirectUrl, getSafeRedirectUrl } from '../redirectValidation'

describe('redirectValidation', () => {
  describe('isValidRedirectUrl', () => {
    it('should accept valid internal routes', () => {
      expect(isValidRedirectUrl('/dashboard')).toBe(true)
      expect(isValidRedirectUrl('/editor/123')).toBe(true)
      expect(isValidRedirectUrl('/login')).toBe(true)
      expect(isValidRedirectUrl('/orbity/nav')).toBe(true)
      expect(isValidRedirectUrl('/integram/dict')).toBe(true)
      expect(isValidRedirectUrl('/')).toBe(true)
    })

    it('should reject external URLs with protocols', () => {
      expect(isValidRedirectUrl('https://evil.com')).toBe(false)
      expect(isValidRedirectUrl('http://evil.com')).toBe(false)
      expect(isValidRedirectUrl('ftp://evil.com')).toBe(false)
    })

    it('should reject protocol-relative URLs', () => {
      expect(isValidRedirectUrl('//evil.com')).toBe(false)
      expect(isValidRedirectUrl('//evil.com/path')).toBe(false)
    })

    it('should reject JavaScript URLs (XSS)', () => {
      expect(isValidRedirectUrl('javascript:alert(1)')).toBe(false)
      expect(isValidRedirectUrl('javascript:alert(document.cookie)')).toBe(false)
    })

    it('should reject data URLs', () => {
      expect(isValidRedirectUrl('data:text/html,<script>alert(1)</script>')).toBe(false)
    })

    it('should reject URLs with colons (any protocol)', () => {
      expect(isValidRedirectUrl('mailto:test@example.com')).toBe(false)
      expect(isValidRedirectUrl('tel:+1234567890')).toBe(false)
      expect(isValidRedirectUrl('file:///etc/passwd')).toBe(false)
    })

    it('should reject non-string values', () => {
      expect(isValidRedirectUrl(null)).toBe(false)
      expect(isValidRedirectUrl(undefined)).toBe(false)
      expect(isValidRedirectUrl(123)).toBe(false)
      expect(isValidRedirectUrl({})).toBe(false)
      expect(isValidRedirectUrl([])).toBe(false)
    })

    it('should reject URLs not starting with /', () => {
      expect(isValidRedirectUrl('dashboard')).toBe(false)
      expect(isValidRedirectUrl('editor/123')).toBe(false)
      expect(isValidRedirectUrl('evil.com')).toBe(false)
    })

    it('should handle edge cases', () => {
      expect(isValidRedirectUrl('')).toBe(false)
      expect(isValidRedirectUrl(' ')).toBe(false)
      expect(isValidRedirectUrl('//')).toBe(false)
    })

    it('should accept paths with query parameters', () => {
      expect(isValidRedirectUrl('/dashboard?tab=overview')).toBe(true)
      expect(isValidRedirectUrl('/editor/123?mode=edit')).toBe(true)
    })

    it('should accept paths with anchors', () => {
      expect(isValidRedirectUrl('/dashboard#section')).toBe(true)
      expect(isValidRedirectUrl('/docs#introduction')).toBe(true)
    })

    it('should reject malicious encoded URLs', () => {
      // Protocol-relative encoded
      expect(isValidRedirectUrl('//%65vil.com')).toBe(false)
      // JavaScript encoded
      expect(isValidRedirectUrl('/javascript%3Aalert(1)')).toBe(false)
    })
  })

  describe('getSafeRedirectUrl', () => {
    it('should return the redirect URL if valid', () => {
      expect(getSafeRedirectUrl('/dashboard', '/dash')).toBe('/dashboard')
      expect(getSafeRedirectUrl('/editor/123', '/dash')).toBe('/editor/123')
    })

    it('should return default URL if redirect is invalid', () => {
      expect(getSafeRedirectUrl('https://evil.com', '/dash')).toBe('/dash')
      expect(getSafeRedirectUrl('//evil.com', '/dash')).toBe('/dash')
      expect(getSafeRedirectUrl('javascript:alert(1)', '/dash')).toBe('/dash')
    })

    it('should return default URL if redirect is null/undefined', () => {
      expect(getSafeRedirectUrl(null, '/dash')).toBe('/dash')
      expect(getSafeRedirectUrl(undefined, '/dash')).toBe('/dash')
    })

    it('should use custom default URL', () => {
      expect(getSafeRedirectUrl(null, '/custom')).toBe('/custom')
      expect(getSafeRedirectUrl('https://evil.com', '/custom')).toBe('/custom')
    })

    it('should use /dash as default if no default provided', () => {
      expect(getSafeRedirectUrl(null)).toBe('/dash')
      expect(getSafeRedirectUrl('https://evil.com')).toBe('/dash')
    })

    it('should handle all login page defaults correctly', () => {
      // Login.vue default
      expect(getSafeRedirectUrl(null, '/dash')).toBe('/dash')
      // IntegramLogin.vue default
      expect(getSafeRedirectUrl(null, '/integram/dict')).toBe('/integram/dict')
      // OrbityLogin.vue defaults
      expect(getSafeRedirectUrl(null, '/orbity/nav')).toBe('/orbity/nav')
      expect(getSafeRedirectUrl(null, '/orbity/profile')).toBe('/orbity/profile')
    })
  })

  describe('Security tests', () => {
    it('should prevent open redirect vulnerability', () => {
      const maliciousUrls = [
        'https://attacker.com/steal-token',
        'http://phishing.site',
        '//evil.com',
        'https://drondoc.ru@evil.com' // URL with @ trick
      ]

      maliciousUrls.forEach(url => {
        expect(isValidRedirectUrl(url)).toBe(false)
        expect(getSafeRedirectUrl(url, '/dash')).toBe('/dash')
      })
    })

    it('should prevent XSS via javascript: URLs', () => {
      const xssUrls = [
        'javascript:alert(1)',
        'javascript:alert(document.cookie)',
        'javascript:void(0)',
        'JaVaScRiPt:alert(1)' // Case variation
      ]

      xssUrls.forEach(url => {
        expect(isValidRedirectUrl(url)).toBe(false)
        expect(getSafeRedirectUrl(url, '/dash')).toBe('/dash')
      })
    })

    it('should prevent data: URL attacks', () => {
      const dataUrls = [
        'data:text/html,<script>alert(1)</script>',
        'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg=='
      ]

      dataUrls.forEach(url => {
        expect(isValidRedirectUrl(url)).toBe(false)
        expect(getSafeRedirectUrl(url, '/dash')).toBe('/dash')
      })
    })
  })
})
