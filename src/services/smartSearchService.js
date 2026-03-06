/**
 * Smart Search Service
 *
 * Provides multi-mode search functionality for the sidebar menu:
 * 1. Local menu items search (existing functionality)
 * 2. Site-wide search across routes and pages
 * 3. Search by sections (agents, spaces, etc.)
 * 4. Integram database search (types/tables in connected database)
 *
 * Features:
 * - Debounced search for performance
 * - Caching for frequently searched terms
 * - Graceful fallback when services are unavailable
 * - Fast local search prioritization
 */

import { routeDescriptions } from '@/config/routeDescriptions'
import { logger } from '@/utils/logger'
import { getApiUrl } from '@/utils/apiConfig'
import integramApiClient from '@/services/integramApiClient'
import spacesService from '@/services/spacesService'
import { getDocuments, getFolders } from '@/services/docBlocksApiService'

// Cache for search results (TTL: 5 minutes)
const searchCache = new Map()
const CACHE_TTL = 5 * 60 * 1000

// Debounce settings
const LOCAL_SEARCH_DEBOUNCE = 150  // Fast local search (menu, routes, agents)
const API_SEARCH_DEBOUNCE = 800    // Longer debounce for API searches (AI, Integram) to avoid excessive calls

// Separate debounce state for API searches (AI + Integram)
let apiSearchTimeoutId = null

/**
 * Debounce helper - non-blocking version
 * Returns immediately, executes callback after delay
 */
function debounce(fn, delay) {
  let timeoutId
  return function (...args) {
    clearTimeout(timeoutId)

    // Don't return a Promise - execute callback after delay
    // This prevents blocking the UI thread
    timeoutId = setTimeout(() => {
      fn(...args)
    }, delay)
  }
}

/**
 * Search local menu items (keep existing functionality)
 */
export function searchMenuItems(menuModel, query) {
  if (!query || query.trim() === '') return menuModel

  const lowerQuery = query.toLowerCase().trim()

  const filterItems = (items) => {
    if (!items || items.length === 0) return []

    return items.reduce((acc, item) => {
      const itemCopy = { ...item }
      let matches = false

      // Check if current item label matches
      if (itemCopy.label && itemCopy.label.toLowerCase().includes(lowerQuery)) {
        matches = true
      }

      // Recursively filter child items
      if (itemCopy.items && itemCopy.items.length > 0) {
        const filteredChildren = filterItems(itemCopy.items)

        if (filteredChildren.length > 0) {
          itemCopy.items = filteredChildren
          matches = true
        }
      }

      // Include item if it or any of its children match
      if (matches) {
        acc.push(itemCopy)
      }

      return acc
    }, [])
  }

  return filterItems(menuModel)
}

/**
 * Search across all routes in the application
 */
export function searchRoutes(query) {
  if (!query || query.trim() === '') return []

  const lowerQuery = query.toLowerCase().trim()
  const results = []

  for (const [path, routeInfo] of Object.entries(routeDescriptions)) {
    const description = routeInfo.description || ''
    const tags = routeInfo.tags || []
    const category = routeInfo.category || 'other'

    // Search in path, description, tags
    const matchesPath = path.toLowerCase().includes(lowerQuery)
    const matchesDescription = description.toLowerCase().includes(lowerQuery)
    const matchesTags = tags.some(tag => tag.toLowerCase().includes(lowerQuery))
    const matchesCategory = category.toLowerCase().includes(lowerQuery)

    if (matchesPath || matchesDescription || matchesTags || matchesCategory) {
      results.push({
        type: 'route',
        path,
        title: path,
        description,
        category,
        tags,
        score: calculateScore(lowerQuery, path, description, tags)
      })
    }
  }

  // Sort by relevance score
  return results.sort((a, b) => b.score - a.score)
}

/**
 * Search agents/spaces
 */
export async function searchSpaces(query) {
  if (!query || query.trim() === '') return []

  const lowerQuery = query.toLowerCase().trim()

  try {
    // Fetch spaces data (can be from static or dynamic source)
    // For now, we'll use a simplified version
    // In production, this would call the spaces service
    const spaces = await fetchSpacesData()

    const results = spaces.filter(space => {
      const matchesName = space.name?.toLowerCase().includes(lowerQuery)
      const matchesDescription = space.description?.toLowerCase().includes(lowerQuery)
      const matchesTags = space.tags?.some(tag => tag.toLowerCase().includes(lowerQuery))
      const matchesCategory = space.category?.toLowerCase().includes(lowerQuery)

      return matchesName || matchesDescription || matchesTags || matchesCategory
    })

    return results.map(space => ({
      type: 'agent',
      ...space,
      score: calculateScore(lowerQuery, space.name, space.description, space.tags)
    })).sort((a, b) => b.score - a.score)
  } catch (error) {
    logger.error('Error searching spaces:', error)
    return []
  }
}

/**
 * Search Integram database types (tables)
 * Issue #4521 - Use IntegramClient logic to work with the API
 */
export async function searchIntegram(query) {
  if (!query || query.trim() === '') return []

  const lowerQuery = query.toLowerCase().trim()

  try {
    // Check if user is authenticated to Integram
    if (!integramApiClient.token) {
      // Try to load session from localStorage
      integramApiClient.loadSession()

      if (!integramApiClient.token) {
        logger.debug('No Integram session available for search')
        return []
      }
    }

    // Fetch all types (tables) from connected database
    const typesData = await integramApiClient.getDictionary()

    if (!typesData || !Array.isArray(typesData.types)) {
      logger.warn('Invalid types data from Integram getDictionary')
      return []
    }

    // Filter types by query (search in type name and ID)
    const results = typesData.types.filter(type => {
      const matchesName = type.name?.toLowerCase().includes(lowerQuery)
      const matchesId = String(type.id || '').includes(lowerQuery)
      return matchesName || matchesId
    }).map(type => ({
      type: 'integram-type',
      id: type.id,
      title: type.name,
      description: `Тип (таблица) в базе данных Integram`,
      database: integramApiClient.database || 'unknown',
      path: `/integram/type/${type.id}`, // Navigation path for type (can be customized)
      score: calculateScore(lowerQuery, type.name, '', [])
    }))

    // Sort by relevance score
    return results.sort((a, b) => b.score - a.score)
  } catch (error) {
    // Graceful fallback - don't show errors to user
    logger.debug('Integram search error (graceful fallback):', error.message)
    return []
  }
}

/**
 * Search block-editor documents (Issue #7106)
 * Uses docBlocksApi to search documents by title
 */
// Cache for documents (refreshed per session, not per search)
let cachedDocuments = null
let cachedFolders = null
let docCacheTimestamp = 0
const DOC_CACHE_TTL = 60 * 1000 // 1 minute

export async function searchDocuments(query) {
  if (!query || query.trim() === '') return []

  const lowerQuery = query.toLowerCase().trim()

  try {
    // Refresh document cache if stale
    if (!cachedDocuments || Date.now() - docCacheTimestamp > DOC_CACHE_TTL) {
      const [docsRes, foldersRes] = await Promise.all([
        getDocuments('kval'),
        getFolders('kval'),
      ])
      cachedDocuments = docsRes.documents || []
      cachedFolders = foldersRes.folders || []
      docCacheTimestamp = Date.now()
    }

    const folderMap = {}
    for (const f of cachedFolders) {
      folderMap[String(f.id)] = f.name
    }

    const results = cachedDocuments
      .filter(doc => doc.name && doc.name.toLowerCase().includes(lowerQuery))
      .map(doc => ({
        type: 'document',
        id: doc.id,
        title: doc.name,
        description: doc.folderId ? `Папка: ${folderMap[String(doc.folderId)] || '—'}` : 'Без папки',
        path: `/block-editor?doc=${doc.id}`,
        score: calculateScore(lowerQuery, doc.name, '', []),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)

    return results
  } catch (error) {
    logger.debug('[Document Search] Error (graceful fallback):', error.message)
    return []
  }
}

/**
 * AI-powered search using Kodacode API (no token required)
 * Issue #4878 - AI search in sidebar menu
 * Issue #4878 (fix) - Use Kodacode API directly without DronDoc tokens
 *
 * This function uses AI to enhance search results by:
 * 1. Understanding user intent
 * 2. Semantic search across Integram database
 * 3. Providing intelligent suggestions
 *
 * Kodacode API uses GITHUB_TOKEN from backend environment variables,
 * so no frontend authentication is required.
 *
 * @param {string} query - User search query
 * @param {Object} options - Search options
 * @returns {Promise<Array>} AI-generated search results
 */
export async function searchWithAI(query, options = {}) {
  if (!query || query.trim() === '') return []

  logger.debug('[AI Search] Starting AI search for query:', query)

  try {
    // Prepare AI search prompt
    const searchPrompt = `Analyze this search query and provide relevant results from the database context: "${query}"

Database context: User is searching in a project management and database system with workspaces, pages, documents, agents, and Integram database types.

Return a JSON array of relevant suggestions with this structure:
[
  {
    "title": "Suggested item title",
    "description": "Why this is relevant",
    "path": "/suggested/path",
    "relevance": 0.95 // score from 0 to 1
  }
]

Focus on:
- Semantic understanding (not just keyword matching)
- Understanding user intent
- Providing actionable suggestions
- Database tables/types that might match the query

Limit to top 5 most relevant results.`

    // Call Kodacode API via backend (no token required - uses GITHUB_TOKEN from env)
    const response = await fetch(getApiUrl('/api/ai-tokens/chat'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'deepseek-v3.1-terminus', // Default Kodacode model
        messages: [
          {
            role: 'user',
            content: searchPrompt
          }
        ],
        temperature: 0.3, // Lower temperature for more focused results
        max_tokens: 1000,
        provider: 'external' // Use kodacode (external provider)
      }),
      signal: AbortSignal.timeout(15000) // 15 second timeout for AI response
    })

    if (!response.ok) {
      logger.debug('[AI Search] Request failed with status:', response.status)
      return []
    }

    const result = await response.json()
    logger.debug('[AI Search] Got response, success:', result.success)

    // Parse AI response
    let aiSuggestions = []
    try {
      // Extract response from Kodacode API format
      const responseText = result.data?.choices?.[0]?.message?.content || ''
      logger.debug('[AI Search] Response text length:', responseText.length)

      const jsonMatch = responseText.match(/\[[\s\S]*\]/)

      if (jsonMatch) {
        aiSuggestions = JSON.parse(jsonMatch[0])
        logger.debug('[AI Search] Parsed suggestions count:', aiSuggestions.length)
      } else {
        logger.debug('[AI Search] No JSON array found in response')
      }
    } catch (parseError) {
      logger.debug('[AI Search] Failed to parse AI response:', parseError.message)
      return []
    }

    // Transform AI suggestions to search result format
    return aiSuggestions.map(suggestion => ({
      type: 'ai-suggestion',
      title: suggestion.title,
      description: suggestion.description,
      path: suggestion.path,
      relevance: suggestion.relevance || 0.5,
      aiGenerated: true
    })).sort((a, b) => b.relevance - a.relevance)

  } catch (error) {
    // Graceful fallback - don't show errors to user
    if (error.name === 'TimeoutError' || error.name === 'AbortError') {
      logger.debug('[AI Search] Request timed out after 15 seconds')
    } else {
      logger.debug('[AI Search] Error (graceful fallback):', error.message)
    }
    return []
  }
}

/**
 * Combined smart search across all sources
 */
/**
 * Check if AI search is enabled in settings
 * @returns {boolean} True if AI search is enabled
 */
function isAISearchEnabled() {
  try {
    const saved = localStorage.getItem('aiSearchSettings')
    if (saved) {
      const settings = JSON.parse(saved)
      return settings.enabled !== false // Enabled unless explicitly disabled
    }
  } catch (error) {
    logger.debug('Error reading AI search settings:', error)
  }
  return true // Default: enabled (consistent with Settings.vue defaults)
}

export async function smartSearch(query, menuModel, options = {}) {
  if (!query || query.trim() === '') {
    // Cancel pending API searches when query is cleared
    if (apiSearchTimeoutId) {
      clearTimeout(apiSearchTimeoutId)
      apiSearchTimeoutId = null
    }
    return {
      menuItems: menuModel,
      routes: [],
      agents: [],
      documents: [],
      integramResults: [],
      aiResults: [],
      totalResults: 0
    }
  }

  const cacheKey = `${query}_${JSON.stringify(options)}`

  // Check cache first
  const cached = searchCache.get(cacheKey)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    logger.debug('Returning cached search results')
    return cached.results
  }

  // Perform LOCAL searches in parallel (fast, no API calls)
  const [menuItems, routes, agents, documents] = await Promise.all([
    Promise.resolve(searchMenuItems(menuModel, query)),
    Promise.resolve(searchRoutes(query)),
    searchSpaces(query),
    searchDocuments(query)
  ])

  const localResults = {
    menuItems,
    routes: routes.slice(0, options.maxRoutesResults || 10),
    agents: agents.slice(0, options.maxAgentsResults || 5),
    documents: documents.slice(0, options.maxDocumentsResults || 10),
    integramResults: [], // Integram results will be added later via smartSearchWithAI
    aiResults: [], // AI results will be added later via smartSearchWithAI
    totalResults: countMenuItems(menuItems) + routes.length + agents.length + documents.length
  }

  // Cache local results (AI results will be added later)
  searchCache.set(cacheKey, {
    results: localResults,
    timestamp: Date.now()
  })

  return localResults
}

/**
 * Smart search with delayed API searches (Integram + AI)
 * Returns local results immediately, then calls onAPIResults callback when API searches complete
 * @param {string} query - Search query
 * @param {Array} menuModel - Menu model
 * @param {Object} options - Search options
 * @param {Function} onAPIResults - Callback for API results (called after API_SEARCH_DEBOUNCE delay)
 */
export async function smartSearchWithAI(query, menuModel, options = {}, onAPIResults = null) {
  // Cancel previous pending API searches
  if (apiSearchTimeoutId) {
    clearTimeout(apiSearchTimeoutId)
    apiSearchTimeoutId = null
  }

  // Get local results immediately
  const localResults = await smartSearch(query, menuModel, options)

  // If no query, return local results only
  if (!query || query.trim() === '') {
    return localResults
  }

  // Check if AI search is enabled in settings
  const aiEnabled = isAISearchEnabled()
  logger.debug('[smartSearch] AI search enabled:', aiEnabled)

  if (!onAPIResults) {
    return localResults
  }

  // Schedule API searches (Integram + AI) with longer debounce
  const cacheKey = `${query}_${JSON.stringify(options)}`

  apiSearchTimeoutId = setTimeout(async () => {
    try {
      logger.debug('[API Search] Starting delayed API searches after', API_SEARCH_DEBOUNCE, 'ms')

      // Run Integram and AI searches in parallel
      const [integramResults, aiResults] = await Promise.all([
        searchIntegram(query),
        aiEnabled ? searchWithAI(query, options) : Promise.resolve([])
      ])

      const slicedIntegramResults = integramResults.slice(0, options.maxIntegramResults || 10)
      const slicedAIResults = aiResults.slice(0, options.maxAIResults || 5)

      logger.debug('[API Search] Integram results:', slicedIntegramResults.length, 'AI results:', slicedAIResults.length)

      // Call callback with API results
      if (slicedIntegramResults.length > 0 || slicedAIResults.length > 0) {
        onAPIResults({
          integramResults: slicedIntegramResults,
          aiResults: slicedAIResults
        })

        // Update cache with API results
        const cached = searchCache.get(cacheKey)
        if (cached) {
          cached.results.integramResults = slicedIntegramResults
          cached.results.aiResults = slicedAIResults
          cached.results.totalResults += slicedIntegramResults.length + slicedAIResults.length
        }
      }
    } catch (error) {
      logger.debug('[API Search] Delayed search error:', error.message)
    }
  }, API_SEARCH_DEBOUNCE)

  return localResults
}

/**
 * Debounced smart search with separate API search debounce
 * - Local search: 150ms debounce (fast - menu, routes, agents)
 * - API search: 800ms debounce (Integram + AI, delayed to avoid excessive API calls)
 *
 * Usage: debouncedSmartSearch(query, menuModel, options, callback)
 * The callback will be called twice:
 * 1. First with local results (after 150ms)
 * 2. Then with API results added (after 800ms)
 */
export const debouncedSmartSearch = debounce(async (query, menuModel, options, callback) => {
  try {
    // First callback: local results (fast)
    const localResults = await smartSearchWithAI(query, menuModel, options, (apiResults) => {
      // Second callback: update with API results (Integram + AI)
      logger.debug('[debouncedSmartSearch] API results received - Integram:', apiResults.integramResults?.length, 'AI:', apiResults.aiResults?.length)
      callback({
        ...localResults,
        integramResults: apiResults.integramResults || [],
        aiResults: apiResults.aiResults || [],
        totalResults: localResults.totalResults + (apiResults.integramResults?.length || 0) + (apiResults.aiResults?.length || 0)
      })
    })

    callback(localResults)
  } catch (error) {
    logger.error('Error in debounced smart search:', error)
    callback({
      menuItems: [],
      routes: [],
      agents: [],
      documents: [],
      integramResults: [],
      aiResults: [],
      totalResults: 0
    })
  }
}, LOCAL_SEARCH_DEBOUNCE)

/**
 * Calculate relevance score for search results
 */
function calculateScore(query, title, description, tags = []) {
  let score = 0

  // Exact match in title: highest score
  if (title?.toLowerCase() === query) {
    score += 100
  } else if (title?.toLowerCase().includes(query)) {
    score += 50
  }

  // Match in description
  if (description?.toLowerCase().includes(query)) {
    score += 20
  }

  // Match in tags
  tags.forEach(tag => {
    if (tag.toLowerCase() === query) {
      score += 30
    } else if (tag.toLowerCase().includes(query)) {
      score += 10
    }
  })

  return score
}

/**
 * Count total menu items
 */
function countMenuItems(items) {
  if (!items || items.length === 0) return 0

  let count = 0
  items.forEach(item => {
    count++
    if (item.items) {
      count += countMenuItems(item.items)
    }
  })

  return count
}

/**
 * Fetch spaces/agents data using spacesService
 * Issue #3926: Uses spacesService to load from Integram database
 */
async function fetchSpacesData() {
  try {
    const spaces = await spacesService.getSpaces()
    return spaces || []
  } catch (error) {
    logger.debug('[smartSearch] Failed to fetch spaces:', error.message)
    return []
  }
}

/**
 * Clear search cache
 */
export function clearSearchCache() {
  searchCache.clear()
  logger.debug('Search cache cleared')
}

/**
 * Get cache statistics
 */
export function getCacheStats() {
  return {
    size: searchCache.size,
    entries: Array.from(searchCache.keys())
  }
}
