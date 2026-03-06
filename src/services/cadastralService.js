/**
 * Cadastral Service
 *
 * Frontend service for fetching cadastral parcel boundaries
 * from the backend /api/cadastral endpoint.
 *
 * Features:
 * - Batches requests into chunks of 10 (backend limit)
 * - sessionStorage cache (1 hour TTL) to skip repeated SSH calls
 */

import axios from 'axios'

const API_BASE = '/api'
const BATCH_SIZE = 10
const CACHE_PREFIX = 'cadastral_bounds_'
const CACHE_TTL = 3600000 // 1 hour

function getCached(cacheKey) {
  try {
    const stored = sessionStorage.getItem(CACHE_PREFIX + cacheKey)
    if (!stored) return null
    const { data, timestamp } = JSON.parse(stored)
    if (Date.now() - timestamp > CACHE_TTL) {
      sessionStorage.removeItem(CACHE_PREFIX + cacheKey)
      return null
    }
    return data
  } catch {
    return null
  }
}

function setCache(cacheKey, data) {
  try {
    sessionStorage.setItem(CACHE_PREFIX + cacheKey, JSON.stringify({ data, timestamp: Date.now() }))
  } catch {
    // ignore quota errors
  }
}

/**
 * Fetch cadastral boundaries for given cadastral numbers.
 * Batches into groups of 10 (backend limit) and uses sessionStorage cache.
 *
 * @param {string[]} cadastralNumbers - Array of cadastral numbers (e.g. ["38:07:020104:1"])
 * @returns {Promise<{ polygons: Array, results: Array, found: number }>}
 */
export async function fetchCadastralBoundaries(cadastralNumbers) {
  if (!cadastralNumbers || cadastralNumbers.length === 0) {
    return { polygons: [], results: [], found: 0 }
  }

  // Check sessionStorage cache (keyed on sorted list)
  const cacheKey = [...cadastralNumbers].sort().join(',')
  const cached = getCached(cacheKey)
  if (cached) {
    return cached
  }

  const allPolygons = []
  const allResults = []
  let totalFound = 0
  let totalWithGeometry = 0
  let totalTotal = 0

  // Send batches of BATCH_SIZE sequentially
  for (let i = 0; i < cadastralNumbers.length; i += BATCH_SIZE) {
    const batch = cadastralNumbers.slice(i, i + BATCH_SIZE)
    const response = await axios.post(`${API_BASE}/cadastral/boundaries`, {
      cadastralNumbers: batch
    })
    const data = response.data
    if (!data.success) {
      throw new Error(data.error || 'Failed to fetch cadastral boundaries')
    }
    allPolygons.push(...(data.polygons || []))
    allResults.push(...(data.results || []))
    totalFound += data.found || 0
    totalWithGeometry += data.withGeometry || 0
    totalTotal += data.total || 0
  }

  const result = {
    polygons: allPolygons,
    results: allResults,
    found: totalFound,
    withGeometry: totalWithGeometry,
    total: totalTotal
  }

  setCache(cacheKey, result)
  return result
}

/**
 * Search for cadastral numbers by text.
 *
 * @param {string} text - Search text (partial cadastral number)
 * @returns {Promise<Array<{ cadastralNumber: string, address: string, area: number }>>}
 */
export async function searchCadastral(text) {
  if (!text || text.length < 5) {
    return []
  }

  const response = await axios.get(`${API_BASE}/cadastral/search`, {
    params: { text }
  })

  if (!response.data.success) {
    throw new Error(response.data.error || 'Search failed')
  }

  return response.data.features || []
}

/**
 * Parse cadastral numbers from a multiline text.
 * Supports comma-separated and newline-separated formats.
 *
 * @param {string} text - Raw text with cadastral numbers
 * @returns {string[]} - Parsed and validated cadastral numbers
 */
export function parseCadastralNumbers(text) {
  if (!text) return []

  const cnRegex = /\d{2}:\d{2}:\d{6,7}:\d+/g
  const matches = text.match(cnRegex)

  return matches ? [...new Set(matches)] : []
}

export default {
  fetchCadastralBoundaries,
  searchCadastral,
  parseCadastralNumbers
}
