/**
 * Privacy-friendly analytics utility
 * Supports multiple analytics providers with a unified interface
 * Respects user privacy preferences and GDPR compliance
 */

import { logger } from './logger'

class Analytics {
  constructor() {
    this.initialized = false
    this.enabled = import.meta.env.VITE_ENABLE_ANALYTICS === 'true'
    this.provider = import.meta.env.VITE_ANALYTICS_PROVIDER || 'none'
    this.trackingId = import.meta.env.VITE_ANALYTICS_TRACKING_ID
    this.consentGiven = false
  }

  /**
   * Initialize analytics
   * @param {Object} options - Configuration options
   */
  async init(options = {}) {
    if (this.initialized) {
      logger.warn('Analytics already initialized')
      return
    }

    if (!this.enabled) {
      logger.debug('Analytics is disabled')
      return
    }

    // Check for user consent (GDPR compliance)
    this.consentGiven = this._checkConsent()

    if (!this.consentGiven) {
      logger.info('Analytics consent not given, tracking disabled')
      return
    }

    const { provider = this.provider, trackingId = this.trackingId } = options

    if (!trackingId) {
      logger.warn('Analytics tracking ID not configured')
      return
    }

    try {
      switch (provider) {
        case 'plausible':
          await this._initPlausible(trackingId)
          break
        case 'ga':
        case 'google-analytics':
          await this._initGoogleAnalytics(trackingId)
          break
        case 'matomo':
          await this._initMatomo(trackingId)
          break
        default:
          logger.warn('Unknown analytics provider', { provider })
          return
      }

      this.initialized = true
      logger.info('Analytics initialized', { provider })
    } catch (error) {
      logger.error('Failed to initialize analytics', { error: error.message })
    }
  }

  /**
   * Initialize Plausible Analytics (privacy-friendly)
   */
  async _initPlausible(domain) {
    const script = document.createElement('script')
    script.defer = true
    script.dataset.domain = domain
    script.src = 'https://plausible.io/js/script.js'

    document.head.appendChild(script)

    // Add global plausible function
    window.plausible = window.plausible || function() {
      (window.plausible.q = window.plausible.q || []).push(arguments)
    }
  }

  /**
   * Initialize Google Analytics
   */
  async _initGoogleAnalytics(measurementId) {
    // Load gtag.js
    const script = document.createElement('script')
    script.async = true
    script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`
    document.head.appendChild(script)

    // Initialize gtag
    window.dataLayer = window.dataLayer || []
    window.gtag = function() {
      window.dataLayer.push(arguments)
    }
    window.gtag('js', new Date())
    window.gtag('config', measurementId, {
      anonymize_ip: true, // Anonymize IP for privacy
      cookie_flags: 'SameSite=None;Secure'
    })
  }

  /**
   * Initialize Matomo Analytics
   */
  async _initMatomo(siteId) {
    const matomoUrl = import.meta.env.VITE_MATOMO_URL || 'https://matomo.example.com/'

    window._paq = window._paq || []
    window._paq.push(['trackPageView'])
    window._paq.push(['enableLinkTracking'])

    const u = matomoUrl
    window._paq.push(['setTrackerUrl', u + 'matomo.php'])
    window._paq.push(['setSiteId', siteId])

    const script = document.createElement('script')
    script.async = true
    script.src = u + 'matomo.js'
    document.head.appendChild(script)
  }

  /**
   * Check if user has given consent for analytics
   */
  _checkConsent() {
    // Check localStorage for consent
    const consent = localStorage.getItem('analytics_consent')

    if (consent === 'true') return true
    if (consent === 'false') return false

    // If no consent is stored, default to opt-out for privacy
    // User must explicitly opt-in
    return false
  }

  /**
   * Set user consent for analytics
   * @param {boolean} consent - User consent
   */
  setConsent(consent) {
    this.consentGiven = consent
    localStorage.setItem('analytics_consent', consent.toString())

    if (consent && !this.initialized) {
      // Re-initialize if consent is given
      this.init()
    }

    logger.info('Analytics consent updated', { consent })
  }

  /**
   * Track a page view
   * @param {string} path - Page path
   * @param {Object} properties - Additional properties
   */
  trackPageView(path, properties = {}) {
    if (!this.initialized || !this.consentGiven) return

    logger.debug('Tracking page view', { path, ...properties })

    switch (this.provider) {
      case 'plausible':
        if (window.plausible) {
          window.plausible('pageview', { props: properties })
        }
        break
      case 'ga':
      case 'google-analytics':
        if (window.gtag) {
          window.gtag('event', 'page_view', {
            page_path: path,
            ...properties
          })
        }
        break
      case 'matomo':
        if (window._paq) {
          window._paq.push(['setCustomUrl', path])
          window._paq.push(['trackPageView'])
        }
        break
    }
  }

  /**
   * Track a custom event
   * @param {string} eventName - Event name
   * @param {Object} properties - Event properties
   */
  trackEvent(eventName, properties = {}) {
    if (!this.initialized || !this.consentGiven) return

    logger.debug('Tracking event', { eventName, ...properties })

    switch (this.provider) {
      case 'plausible':
        if (window.plausible) {
          window.plausible(eventName, { props: properties })
        }
        break
      case 'ga':
      case 'google-analytics':
        if (window.gtag) {
          window.gtag('event', eventName, properties)
        }
        break
      case 'matomo':
        if (window._paq) {
          window._paq.push(['trackEvent',
            properties.category || 'General',
            eventName,
            properties.label,
            properties.value
          ])
        }
        break
    }
  }

  /**
   * Track user properties
   * @param {Object} properties - User properties
   */
  setUserProperties(properties) {
    if (!this.initialized || !this.consentGiven) return

    logger.debug('Setting user properties', properties)

    switch (this.provider) {
      case 'ga':
      case 'google-analytics':
        if (window.gtag) {
          window.gtag('set', 'user_properties', properties)
        }
        break
      case 'matomo':
        if (window._paq) {
          Object.entries(properties).forEach(([key, value]) => {
            window._paq.push(['setCustomVariable', 1, key, value, 'visit'])
          })
        }
        break
    }
  }

  /**
   * Track conversion/goal
   * @param {string} goalName - Goal name
   * @param {number} value - Goal value
   */
  trackGoal(goalName, value = 0) {
    if (!this.initialized || !this.consentGiven) return

    logger.debug('Tracking goal', { goalName, value })

    this.trackEvent('goal_completed', {
      goal_name: goalName,
      value
    })
  }

  /**
   * Track timing/performance
   * @param {string} category - Timing category
   * @param {string} variable - Timing variable
   * @param {number} value - Time in milliseconds
   */
  trackTiming(category, variable, value) {
    if (!this.initialized || !this.consentGiven) return

    logger.debug('Tracking timing', { category, variable, value })

    switch (this.provider) {
      case 'ga':
      case 'google-analytics':
        if (window.gtag) {
          window.gtag('event', 'timing_complete', {
            name: variable,
            value: value,
            event_category: category
          })
        }
        break
      default:
        this.trackEvent('timing', {
          category,
          variable,
          value
        })
    }
  }
}

// Create singleton instance
export const analytics = new Analytics()

// Export class for testing
export { Analytics }
