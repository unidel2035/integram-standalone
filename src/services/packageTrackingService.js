/**
 * Package Tracking Service
 *
 * This service provides integration with Ship24 API for universal package tracking
 * across multiple carriers including Russian Post, CDEK, Boxberry, DHL, and others.
 *
 * Usage:
 *   import packageTrackingService from '@/services/packageTrackingService'
 *   const tracking = await packageTrackingService.trackPackage('TRACK123')
 */

/**
 * Carrier configuration with tracking number patterns
 */
const CARRIERS = {
  RUSSIAN_POST: {
    name: 'Почта России',
    code: 'russian-post',
    pattern: /^[A-Z]{2}\d{9}[A-Z]{2}$/i, // Example: RU123456789RU
    icon: '📮'
  },
  CDEK: {
    name: 'СДЭК',
    code: 'cdek',
    pattern: /^\d{10,14}$/, // 10-14 digits
    icon: '📦'
  },
  BOXBERRY: {
    name: 'Boxberry',
    code: 'boxberry',
    pattern: /^[A-Z0-9]{8,20}$/i,
    icon: '📦'
  },
  DHL: {
    name: 'DHL',
    code: 'dhl',
    pattern: /^\d{10,11}$/,
    icon: '✈️'
  },
  FEDEX: {
    name: 'FedEx',
    code: 'fedex',
    pattern: /^\d{12,14}$/,
    icon: '✈️'
  },
  UPS: {
    name: 'UPS',
    code: 'ups',
    pattern: /^1Z[A-Z0-9]{16}$/i,
    icon: '✈️'
  }
}

/**
 * Detect carrier from tracking number
 */
function detectCarrier(trackingNumber) {
  const cleaned = trackingNumber.trim().toUpperCase()

  for (const [key, carrier] of Object.entries(CARRIERS)) {
    if (carrier.pattern.test(cleaned)) {
      return carrier.code
    }
  }

  return null // Auto-detect by API
}

/**
 * Package Tracking Service Methods
 */
const packageTrackingService = {
  /**
   * Track a package using Ship24 API or mock data
   * @param {string} trackingNumber - The tracking number to track
   * @param {string} carrierCode - Optional carrier code
   * @returns {Promise<Object>} Tracking information
   */
  async trackPackage(trackingNumber, carrierCode = null) {
    const apiKey = localStorage.getItem('ship24_api_key')

    if (!trackingNumber) {
      throw new Error('Tracking number is required')
    }

    // Auto-detect carrier if not provided
    if (!carrierCode) {
      carrierCode = detectCarrier(trackingNumber)
    }

    // If API key is not set, return mock data for demonstration
    if (!apiKey) {
      return this.getMockTrackingData(trackingNumber, carrierCode)
    }

    try {
      // Ship24 API implementation
      const response = await fetch('https://api.ship24.com/public/v1/tracking/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          trackingNumber: trackingNumber,
          courierCode: carrierCode ? [carrierCode] : undefined
        })
      })

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`)
      }

      const data = await response.json()
      return this.formatTrackingData(data)
    } catch (error) {
      console.error('Tracking API error:', error)
      // Fallback to mock data on error
      return this.getMockTrackingData(trackingNumber, carrierCode)
    }
  },

  /**
   * Track multiple packages at once
   * @param {Array<string>} trackingNumbers - Array of tracking numbers
   * @returns {Promise<Array>} Array of tracking information
   */
  async trackMultiplePackages(trackingNumbers) {
    const promises = trackingNumbers.map(num => this.trackPackage(num))
    return Promise.all(promises)
  },

  /**
   * Get saved packages from localStorage
   * @returns {Array} Array of saved packages
   */
  getSavedPackages() {
    const saved = localStorage.getItem('tracked_packages')
    return saved ? JSON.parse(saved) : []
  },

  /**
   * Save package to localStorage
   * @param {Object} packageData - Package data to save
   */
  savePackage(packageData) {
    const packages = this.getSavedPackages()
    const existing = packages.findIndex(p => p.trackingNumber === packageData.trackingNumber)

    if (existing >= 0) {
      packages[existing] = { ...packages[existing], ...packageData, updatedAt: Date.now() }
    } else {
      packages.push({ ...packageData, addedAt: Date.now(), updatedAt: Date.now() })
    }

    localStorage.setItem('tracked_packages', JSON.stringify(packages))
    return packages
  },

  /**
   * Remove package from localStorage
   * @param {string} trackingNumber - Tracking number to remove
   */
  removePackage(trackingNumber) {
    const packages = this.getSavedPackages()
    const filtered = packages.filter(p => p.trackingNumber !== trackingNumber)
    localStorage.setItem('tracked_packages', JSON.stringify(filtered))
    return filtered
  },

  /**
   * Format API response data
   * @private
   */
  formatTrackingData(apiData) {
    if (!apiData || !apiData.data || !apiData.data.trackings || apiData.data.trackings.length === 0) {
      return {
        found: false,
        error: 'Tracking information not found'
      }
    }

    const tracking = apiData.data.trackings[0]
    const shipment = tracking.shipment || {}
    const events = tracking.events || []

    return {
      found: true,
      trackingNumber: tracking.trackingNumber,
      carrier: {
        code: tracking.courier?.name || 'Unknown',
        name: tracking.courier?.name || 'Unknown Carrier'
      },
      status: shipment.statusMilestone || 'unknown',
      statusText: shipment.statusCode || 'Unknown',
      origin: shipment.originCountryCode,
      destination: shipment.destinationCountryCode,
      estimatedDelivery: shipment.delivery?.estimatedDeliveryDate,
      events: events.map(event => ({
        date: event.datetime,
        location: event.location || '',
        status: event.status,
        description: event.statusText || event.status
      })).reverse(), // Reverse to show newest first
      lastUpdate: events.length > 0 ? events[0].datetime : null
    }
  },

  /**
   * Get mock tracking data for demonstration
   * @private
   */
  getMockTrackingData(trackingNumber, carrierCode) {
    const carriers = Object.values(CARRIERS)
    const carrier = carrierCode
      ? carriers.find(c => c.code === carrierCode)
      : carriers[Math.floor(Math.random() * carriers.length)]

    const statuses = ['in_transit', 'delivered', 'out_for_delivery', 'ready_for_pickup']
    const status = statuses[Math.floor(Math.random() * statuses.length)]

    const mockEvents = [
      {
        date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        location: 'Москва, Россия',
        status: 'accepted',
        description: 'Посылка принята на почтовом отделении'
      },
      {
        date: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
        location: 'Московский сортировочный центр',
        status: 'in_transit',
        description: 'Прибыло в сортировочный центр'
      },
      {
        date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        location: 'В пути',
        status: 'in_transit',
        description: 'Отправлено в город назначения'
      },
      {
        date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        location: 'Санкт-Петербург, Россия',
        status: status === 'delivered' ? 'out_for_delivery' : status,
        description: status === 'delivered' ? 'Передано курьеру' : 'Прибыло в отделение назначения'
      }
    ]

    if (status === 'delivered') {
      mockEvents.push({
        date: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        location: 'Санкт-Петербург, Россия',
        status: 'delivered',
        description: 'Доставлено получателю'
      })
    }

    return {
      found: true,
      trackingNumber,
      carrier: {
        code: carrier.code,
        name: carrier.name,
        icon: carrier.icon
      },
      status,
      statusText: this.getStatusText(status),
      origin: 'RU',
      destination: 'RU',
      estimatedDelivery: status !== 'delivered'
        ? new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        : null,
      events: mockEvents.reverse(),
      lastUpdate: mockEvents[0].date,
      isMockData: true
    }
  },

  /**
   * Get human-readable status text
   * @private
   */
  getStatusText(status) {
    const statusMap = {
      'accepted': 'Принято',
      'in_transit': 'В пути',
      'out_for_delivery': 'Передано курьеру',
      'ready_for_pickup': 'Готово к получению',
      'delivered': 'Доставлено',
      'exception': 'Проблема с доставкой',
      'expired': 'Срок хранения истёк',
      'unknown': 'Статус неизвестен'
    }
    return statusMap[status] || status
  },

  /**
   * Validate tracking number format
   * @param {string} trackingNumber - Tracking number to validate
   * @returns {Object} Validation result with carrier info
   */
  validateTrackingNumber(trackingNumber) {
    if (!trackingNumber || trackingNumber.trim().length === 0) {
      return { valid: false, error: 'Tracking number is required' }
    }

    const cleaned = trackingNumber.trim()

    if (cleaned.length < 8) {
      return { valid: false, error: 'Tracking number too short' }
    }

    const carrier = detectCarrier(cleaned)

    return {
      valid: true,
      trackingNumber: cleaned,
      detectedCarrier: carrier,
      carrierName: carrier ? CARRIERS[Object.keys(CARRIERS).find(k => CARRIERS[k].code === carrier)]?.name : null
    }
  },

  /**
   * Get list of supported carriers
   * @returns {Array} List of supported carriers
   */
  getSupportedCarriers() {
    return Object.values(CARRIERS)
  }
}

export default packageTrackingService
