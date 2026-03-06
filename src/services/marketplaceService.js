/**
 * Marketplace Service
 * Integration with Wildberries and Amazon marketplaces
 *
 * Official APIs:
 * - Wildberries: https://dev.wildberries.ru/en/openapi
 * - Amazon SP-API: https://developer-docs.amazon.com/sp-api
 */

import { logger } from '@/utils/logger'

const WILDBERRIES_API_BASE = 'https://suppliers-api.wildberries.ru'
const AMAZON_SP_API_BASE = 'https://sellingpartnerapi-na.amazon.com'

/**
 * Wildberries API Integration
 */
export class WildberriesAPI {
  constructor(apiToken) {
    this.apiToken = apiToken
    this.baseUrl = WILDBERRIES_API_BASE
  }

  /**
   * Get authorization headers
   */
  getHeaders() {
    return {
      'Authorization': this.apiToken,
      'Content-Type': 'application/json'
    }
  }

  /**
   * Search products on Wildberries
   * Endpoint: /content/v2/get/cards/list
   */
  async searchProducts(params = {}) {
    try {
      const response = await fetch(`${this.baseUrl}/content/v2/get/cards/list`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          settings: {
            cursor: {
              limit: params.limit || 100
            },
            filter: {
              textSearch: params.query || '',
              withPhoto: -1
            }
          }
        })
      })

      if (!response.ok) {
        throw new Error(`Wildberries API error: ${response.status}`)
      }

      const data = await response.json()
      return this.normalizeProducts(data.cards || [])
    } catch (error) {
      logger.error('Wildberries search error:', error)
      throw error
    }
  }

  /**
   * Get product details by article/SKU
   * Endpoint: /content/v2/get/cards/list
   */
  async getProduct(nmId) {
    try {
      const response = await fetch(`${this.baseUrl}/content/v2/get/cards/list`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          settings: {
            cursor: {
              limit: 1
            },
            filter: {
              find: [{ nmID: nmId }]
            }
          }
        })
      })

      if (!response.ok) {
        throw new Error(`Wildberries API error: ${response.status}`)
      }

      const data = await response.json()
      return data.cards && data.cards.length > 0 ? this.normalizeProduct(data.cards[0]) : null
    } catch (error) {
      logger.error('Wildberries get product error:', error)
      throw error
    }
  }

  /**
   * Get sales analytics
   * Endpoint: /api/v1/supplier/reportDetailByPeriod
   */
  async getSalesAnalytics(dateFrom, dateTo) {
    try {
      const response = await fetch(
        `${this.baseUrl}/api/v1/supplier/reportDetailByPeriod?dateFrom=${dateFrom}&dateTo=${dateTo}`,
        {
          method: 'GET',
          headers: this.getHeaders()
        }
      )

      if (!response.ok) {
        throw new Error(`Wildberries API error: ${response.status}`)
      }

      return await response.json()
    } catch (error) {
      logger.error('Wildberries analytics error:', error)
      throw error
    }
  }

  /**
   * Get stock information
   * Endpoint: /api/v3/stocks/{warehouseId}
   */
  async getStocks(warehouseId) {
    try {
      const response = await fetch(`${this.baseUrl}/api/v3/stocks/${warehouseId}`, {
        method: 'GET',
        headers: this.getHeaders()
      })

      if (!response.ok) {
        throw new Error(`Wildberries API error: ${response.status}`)
      }

      return await response.json()
    } catch (error) {
      logger.error('Wildberries stocks error:', error)
      throw error
    }
  }

  /**
   * Get orders
   * Endpoint: /api/v3/orders
   */
  async getOrders(params = {}) {
    try {
      const queryParams = new URLSearchParams({
        limit: params.limit || 1000,
        next: params.next || 0
      })

      const response = await fetch(`${this.baseUrl}/api/v3/orders?${queryParams}`, {
        method: 'GET',
        headers: this.getHeaders()
      })

      if (!response.ok) {
        throw new Error(`Wildberries API error: ${response.status}`)
      }

      return await response.json()
    } catch (error) {
      logger.error('Wildberries orders error:', error)
      throw error
    }
  }

  /**
   * Update product prices
   * Endpoint: /public/api/v1/prices
   */
  async updatePrices(priceData) {
    try {
      const response = await fetch(`${this.baseUrl}/public/api/v1/prices`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(priceData)
      })

      if (!response.ok) {
        throw new Error(`Wildberries API error: ${response.status}`)
      }

      return await response.json()
    } catch (error) {
      logger.error('Wildberries update prices error:', error)
      throw error
    }
  }

  /**
   * Normalize product data to unified format
   */
  normalizeProduct(product) {
    return {
      id: product.nmID,
      name: product.title || product.object,
      description: product.description || '',
      price: product.sizes?.[0]?.price || 0,
      discountPrice: product.sizes?.[0]?.discountedPrice || null,
      brand: product.brand || '',
      seller: product.vendorCode || '',
      category: product.subjectName || '',
      rating: product.rating || 0,
      reviews: product.feedbacksCount || 0,
      image: product.photos?.[0]?.big || product.photos?.[0]?.c516x688 || '',
      images: product.photos?.map(p => p.big || p.c516x688) || [],
      inStock: product.sizes?.[0]?.stocks?.reduce((sum, s) => sum + s.qty, 0) || 0,
      marketplace: 'wildberries',
      url: `https://www.wildberries.ru/catalog/${product.nmID}/detail.aspx`,
      raw: product
    }
  }

  /**
   * Normalize multiple products
   */
  normalizeProducts(products) {
    return products.map(p => this.normalizeProduct(p))
  }
}

/**
 * Amazon SP-API Integration
 */
export class AmazonSPAPI {
  constructor(config) {
    this.accessKey = config.accessKey
    this.secretKey = config.secretKey
    this.marketplaceId = config.marketplaceId
    this.region = config.region || 'us-east-1'
    this.baseUrl = AMAZON_SP_API_BASE
  }

  /**
   * Get authorization headers with AWS Signature V4
   * Note: This is a simplified version. Production code should use aws4 library
   */
  async getHeaders(method, path) {
    // TODO: Implement AWS Signature V4 signing
    // For now, return basic headers
    return {
      'Content-Type': 'application/json',
      'x-amz-access-token': this.accessKey, // This should be LWA access token
      'x-amz-date': new Date().toISOString()
    }
  }

  /**
   * Search products using Catalog Items API
   * Endpoint: /catalog/2022-04-01/items
   */
  async searchProducts(params = {}) {
    try {
      const queryParams = new URLSearchParams({
        marketplaceIds: this.marketplaceId,
        keywords: params.query || '',
        pageSize: params.limit || 20
      })

      const response = await fetch(
        `${this.baseUrl}/catalog/2022-04-01/items?${queryParams}`,
        {
          method: 'GET',
          headers: await this.getHeaders('GET', '/catalog/2022-04-01/items')
        }
      )

      if (!response.ok) {
        throw new Error(`Amazon SP-API error: ${response.status}`)
      }

      const data = await response.json()
      return this.normalizeProducts(data.items || [])
    } catch (error) {
      logger.error('Amazon search error:', error)
      throw error
    }
  }

  /**
   * Get product details by ASIN
   * Endpoint: /catalog/2022-04-01/items/{asin}
   */
  async getProduct(asin) {
    try {
      const queryParams = new URLSearchParams({
        marketplaceIds: this.marketplaceId,
        includedData: 'attributes,images,productTypes,salesRanks,summaries'
      })

      const response = await fetch(
        `${this.baseUrl}/catalog/2022-04-01/items/${asin}?${queryParams}`,
        {
          method: 'GET',
          headers: await this.getHeaders('GET', `/catalog/2022-04-01/items/${asin}`)
        }
      )

      if (!response.ok) {
        throw new Error(`Amazon SP-API error: ${response.status}`)
      }

      const data = await response.json()
      return this.normalizeProduct(data)
    } catch (error) {
      logger.error('Amazon get product error:', error)
      throw error
    }
  }

  /**
   * Get pricing information
   * Endpoint: /products/pricing/v0/price
   */
  async getPricing(asins) {
    try {
      const queryParams = new URLSearchParams({
        MarketplaceId: this.marketplaceId,
        Asins: Array.isArray(asins) ? asins.join(',') : asins,
        ItemType: 'Asin'
      })

      const response = await fetch(
        `${this.baseUrl}/products/pricing/v0/price?${queryParams}`,
        {
          method: 'GET',
          headers: await this.getHeaders('GET', '/products/pricing/v0/price')
        }
      )

      if (!response.ok) {
        throw new Error(`Amazon SP-API error: ${response.status}`)
      }

      return await response.json()
    } catch (error) {
      logger.error('Amazon pricing error:', error)
      throw error
    }
  }

  /**
   * Get sales metrics
   * Endpoint: /sales/v1/orderMetrics
   */
  async getSalesMetrics(params = {}) {
    try {
      const queryParams = new URLSearchParams({
        marketplaceIds: this.marketplaceId,
        interval: params.interval || '2023-01-01T00:00:00Z--2023-12-31T23:59:59Z',
        granularity: params.granularity || 'Day'
      })

      const response = await fetch(
        `${this.baseUrl}/sales/v1/orderMetrics?${queryParams}`,
        {
          method: 'GET',
          headers: await this.getHeaders('GET', '/sales/v1/orderMetrics')
        }
      )

      if (!response.ok) {
        throw new Error(`Amazon SP-API error: ${response.status}`)
      }

      return await response.json()
    } catch (error) {
      logger.error('Amazon sales metrics error:', error)
      throw error
    }
  }

  /**
   * Get orders
   * Endpoint: /orders/v0/orders
   */
  async getOrders(params = {}) {
    try {
      const queryParams = new URLSearchParams({
        MarketplaceIds: this.marketplaceId,
        CreatedAfter: params.createdAfter || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
      })

      const response = await fetch(
        `${this.baseUrl}/orders/v0/orders?${queryParams}`,
        {
          method: 'GET',
          headers: await this.getHeaders('GET', '/orders/v0/orders')
        }
      )

      if (!response.ok) {
        throw new Error(`Amazon SP-API error: ${response.status}`)
      }

      return await response.json()
    } catch (error) {
      logger.error('Amazon orders error:', error)
      throw error
    }
  }

  /**
   * Get inventory summary
   * Endpoint: /fba/inventory/v1/summaries
   */
  async getInventory(params = {}) {
    try {
      const queryParams = new URLSearchParams({
        marketplaceIds: this.marketplaceId,
        granularityType: params.granularityType || 'Marketplace'
      })

      const response = await fetch(
        `${this.baseUrl}/fba/inventory/v1/summaries?${queryParams}`,
        {
          method: 'GET',
          headers: await this.getHeaders('GET', '/fba/inventory/v1/summaries')
        }
      )

      if (!response.ok) {
        throw new Error(`Amazon SP-API error: ${response.status}`)
      }

      return await response.json()
    } catch (error) {
      logger.error('Amazon inventory error:', error)
      throw error
    }
  }

  /**
   * Normalize product data to unified format
   */
  normalizeProduct(product) {
    const attributes = product.attributes || product.summaries?.[0]?.mainImage || {}
    const summary = product.summaries?.[0] || {}

    return {
      id: product.asin,
      name: summary.itemName || attributes.item_name?.[0]?.value || '',
      description: attributes.bullet_point?.map(bp => bp.value).join('\n') || '',
      price: summary.lowestPrices?.[0]?.listingPrice?.amount || 0,
      currency: summary.lowestPrices?.[0]?.listingPrice?.currencyCode || 'USD',
      brand: attributes.brand?.[0]?.value || '',
      seller: summary.sellerName || '',
      category: product.productTypes?.[0]?.productType || '',
      rating: summary.buyBoxEligibleOffers?.[0]?.customerReviewRating?.averageRating || 0,
      reviews: summary.buyBoxEligibleOffers?.[0]?.customerReviewRating?.count || 0,
      image: product.images?.[0]?.images?.[0]?.link || summary.mainImage?.link || '',
      images: product.images?.[0]?.images?.map(img => img.link) || [],
      inStock: summary.totalQuantity || 0,
      marketplace: 'amazon',
      url: `https://www.amazon.com/dp/${product.asin}`,
      raw: product
    }
  }

  /**
   * Normalize multiple products
   */
  normalizeProducts(products) {
    return products.map(p => this.normalizeProduct(p))
  }
}

/**
 * Unified Marketplace Service
 * Provides a single interface for both marketplaces
 */
export class MarketplaceService {
  constructor() {
    this.wildberries = null
    this.amazon = null
  }

  /**
   * Initialize Wildberries API
   */
  initWildberries(apiToken) {
    this.wildberries = new WildberriesAPI(apiToken)
  }

  /**
   * Initialize Amazon SP-API
   */
  initAmazon(config) {
    this.amazon = new AmazonSPAPI(config)
  }

  /**
   * Search products across marketplaces
   */
  async searchProducts(marketplace, params = {}) {
    switch (marketplace) {
      case 'wildberries':
        if (!this.wildberries) {
          throw new Error('Wildberries API not initialized')
        }
        return await this.wildberries.searchProducts(params)

      case 'amazon':
        if (!this.amazon) {
          throw new Error('Amazon SP-API not initialized')
        }
        return await this.amazon.searchProducts(params)

      default:
        throw new Error(`Unknown marketplace: ${marketplace}`)
    }
  }

  /**
   * Get product details
   */
  async getProduct(marketplace, productId) {
    switch (marketplace) {
      case 'wildberries':
        if (!this.wildberries) {
          throw new Error('Wildberries API not initialized')
        }
        return await this.wildberries.getProduct(productId)

      case 'amazon':
        if (!this.amazon) {
          throw new Error('Amazon SP-API not initialized')
        }
        return await this.amazon.getProduct(productId)

      default:
        throw new Error(`Unknown marketplace: ${marketplace}`)
    }
  }

  /**
   * Compare prices across marketplaces
   */
  async comparePrices(productName) {
    const results = []

    if (this.wildberries) {
      try {
        const wbProducts = await this.wildberries.searchProducts({ query: productName, limit: 5 })
        results.push(...wbProducts)
      } catch (error) {
        logger.error('Wildberries price comparison error:', error)
      }
    }

    if (this.amazon) {
      try {
        const amazonProducts = await this.amazon.searchProducts({ query: productName, limit: 5 })
        results.push(...amazonProducts)
      } catch (error) {
        logger.error('Amazon price comparison error:', error)
      }
    }

    // Sort by price
    return results.sort((a, b) => a.price - b.price)
  }

  /**
   * Track competitor product
   */
  async trackCompetitor(marketplace, productUrl) {
    // Extract product ID from URL
    let productId

    if (marketplace === 'wildberries') {
      // Extract nmID from Wildberries URL
      const match = productUrl.match(/catalog\/(\d+)/)
      productId = match ? match[1] : null
    } else if (marketplace === 'amazon') {
      // Extract ASIN from Amazon URL
      const match = productUrl.match(/\/dp\/([A-Z0-9]{10})/)
      productId = match ? match[1] : null
    }

    if (!productId) {
      throw new Error('Could not extract product ID from URL')
    }

    return await this.getProduct(marketplace, productId)
  }
}

// Export singleton instance
export const marketplaceService = new MarketplaceService()

// Export classes for direct use
export default {
  WildberriesAPI,
  AmazonSPAPI,
  MarketplaceService,
  marketplaceService
}
