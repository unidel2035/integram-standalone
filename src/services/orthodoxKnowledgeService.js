import { logger } from '@/utils/logger'
/**
 * Orthodox Knowledge Crawling Service
 *
 * Service for crawling Orthodox Church websites and analyzing content
 * using AI to identify Holy Fathers and texts about God's will
 *
 * Issue #1281
 * Issue #1484 - Redesigned to use orchestrator backend pattern (like YouTube Analytics)
 * All AI calls now go through the orchestrator, which manages API keys server-side
 */

import axios from '@/orchestratorAxios'

// API endpoints
const API_BASE_URL = '/api'

/**
 * Fetch and parse webpage content
 * Note: Due to CORS restrictions, this may need a backend proxy
 *
 * @param {string} url - URL to fetch
 * @returns {Promise<Object>} { title, content, links }
 */
export async function fetchWebpage(url) {
  try {
    // In a real implementation, this would use a backend proxy to bypass CORS
    // For now, we'll simulate the response structure
    logger.debug(`Fetching webpage: ${url}`)

    // TODO: Implement backend proxy endpoint for web scraping
    // This is a placeholder that returns mock data
    const response = await fetch(`${API_BASE_URL}/web-scraper/fetch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ url })
    }).catch(() => null)

    if (response && response.ok) {
      const data = await response.json()
      return data
    }

    // Fallback: return placeholder structure
    return {
      url,
      title: extractTitleFromUrl(url),
      content: '',
      text: '',
      links: [],
      metadata: {
        fetchedAt: new Date().toISOString(),
        status: 'placeholder'
      }
    }
  } catch (error) {
    console.error('Error fetching webpage:', error)
    throw error
  }
}

/**
 * Extract links from webpage that match our criteria
 *
 * @param {string} baseUrl - Base URL for resolving relative links
 * @param {Array<string>} links - Array of link URLs
 * @param {Array<string>} keywords - Keywords to filter by
 * @returns {Array<string>} Filtered and normalized URLs
 */
export function filterRelevantLinks(baseUrl, links, keywords) {
  const relevantLinks = []
  const baseHostname = new URL(baseUrl).hostname

  for (const link of links) {
    try {
      const url = new URL(link, baseUrl)

      // Only include HTTP(S) links from same or related domains
      if (!url.protocol.startsWith('http')) continue

      // Filter by keywords in URL or keep if from Orthodox sites
      const urlLower = url.href.toLowerCase()
      const isOrthodoxSite = isOrthodoxWebsite(url.hostname)
      const hasKeyword = keywords.some(kw => urlLower.includes(kw.toLowerCase()))

      if (isOrthodoxSite || hasKeyword) {
        relevantLinks.push(url.href)
      }
    } catch (error) {
      // Invalid URL, skip
      continue
    }
  }

  return [...new Set(relevantLinks)] // Remove duplicates
}

/**
 * Check if hostname is a known Orthodox Christian website
 *
 * @param {string} hostname - Hostname to check
 * @returns {boolean}
 */
export function isOrthodoxWebsite(hostname) {
  const orthodoxDomains = [
    'azbyka.ru',
    'pravoslavie.ru',
    'predanie.ru',
    'patriarchia.ru',
    'pravenc.ru',
    'pravmir.ru',
    'foma.ru',
    'bogoslov.ru',
    'orthlib.ru',
    'sedmitza.ru',
    'pravoslavie.ru'
  ]

  return orthodoxDomains.some(domain => hostname.includes(domain))
}

/**
 * Analyze webpage content using AI to extract knowledge
 * Uses orchestrator backend API (server-side token management)
 *
 * @param {string} url - URL of the page
 * @param {string} title - Page title
 * @param {string} content - Page content
 * @param {string} modelId - Selected AI model ID (optional, defaults to DeepSeek)
 * @param {Object} settings - Model settings (temperature, maxTokens)
 * @returns {Promise<Object>} Analysis results
 */
export async function analyzeContent(url, title, content, modelId = null, settings = {}) {
  try {
    // Prepare analysis prompt
    const prompt = `Проанализируй следующий текст с православного сайта и извлеки информацию:

URL: ${url}
Заголовок: ${title}

Текст:
${content.substring(0, 4000)} ${content.length > 4000 ? '...' : ''}

Задача:
1. Определи, упоминаются ли святые отцы (укажи их имена)
2. Есть ли тексты о воле Божьей или промысле Божьем?
3. Какие основные темы затрагиваются?
4. Краткое резюме (2-3 предложения)

Ответь в формате JSON:
{
  "holyFathers": ["имя1", "имя2"],
  "topics": ["тема1", "тема2"],
  "hasGodsWillContent": true/false,
  "summary": "краткое резюме",
  "relevance": 1-10,
  "keyQuotes": ["цитата1", "цитата2"]
}`

    // Call orchestrator AI endpoint
    // The orchestrator will use the default system token if modelId is not provided
    const response = await axios.post('/ai-tokens/chat', {
      modelId: modelId || undefined, // Let orchestrator choose default
      prompt,
      application: 'OrthodoxKnowledgeAgent',
      operation: 'content_analysis',
      temperature: settings.temperature || 0.2,
      maxTokens: settings.maxTokens || 2000
    })

    if (!response.data.success) {
      throw new Error(response.data.error || 'AI analysis failed')
    }

    const result = response.data.data

    // Parse AI response
    let analysis
    try {
      const aiResponse = result.content || result.response || ''

      // Try to extract JSON from the response
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[0])
      } else {
        // Fallback structure
        analysis = {
          holyFathers: [],
          topics: [],
          hasGodsWillContent: false,
          summary: aiResponse.substring(0, 200) || 'Не удалось проанализировать',
          relevance: 5,
          keyQuotes: []
        }
      }
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError)
      analysis = {
        holyFathers: [],
        topics: [],
        hasGodsWillContent: false,
        summary: content.substring(0, 200),
        relevance: 5,
        keyQuotes: []
      }
    }

    return {
      ...analysis,
      tokenUsage: result.usage || {},
      analyzedAt: new Date().toISOString()
    }
  } catch (error) {
    console.error('Error analyzing content:', error)
    // Return minimal analysis on error
    return {
      holyFathers: [],
      topics: [],
      hasGodsWillContent: false,
      summary: '',
      relevance: 0,
      keyQuotes: [],
      error: error.message
    }
  }
}

/**
 * Extract knowledge nodes and relationships from analysis
 *
 * @param {string} url - Source URL
 * @param {string} title - Page title
 * @param {Object} analysis - Analysis results from AI
 * @returns {Object} { nodes, edges }
 */
export function extractKnowledge(url, title, analysis) {
  const nodes = []
  const edges = []

  // Create main document node
  const docNodeId = `doc_${hashString(url)}`
  nodes.push({
    id: docNodeId,
    type: 'text',
    title: title,
    url: url,
    content: analysis.summary || '',
    excerpt: analysis.summary || '',
    metadata: {
      relevance: analysis.relevance || 0,
      hasGodsWillContent: analysis.hasGodsWillContent || false,
      analyzedAt: analysis.analyzedAt
    }
  })

  // Create nodes for Holy Fathers
  if (analysis.holyFathers && analysis.holyFathers.length > 0) {
    for (const father of analysis.holyFathers) {
      const fatherNodeId = `father_${hashString(father)}`
      nodes.push({
        id: fatherNodeId,
        type: 'holy_father',
        title: father,
        url: '',
        content: '',
        metadata: {
          name: father
        }
      })

      // Create edge from document to Holy Father
      edges.push({
        source: docNodeId,
        target: fatherNodeId,
        relationship: 'mentions',
        weight: 1
      })
    }
  }

  // Create nodes for topics
  if (analysis.topics && analysis.topics.length > 0) {
    for (const topic of analysis.topics) {
      const topicNodeId = `topic_${hashString(topic)}`
      nodes.push({
        id: topicNodeId,
        type: 'topic',
        title: topic,
        url: '',
        content: '',
        metadata: {
          topic: topic
        }
      })

      // Create edge from document to topic
      edges.push({
        source: docNodeId,
        target: topicNodeId,
        relationship: 'discusses',
        weight: 1
      })
    }
  }

  // If about God's will, create special node
  if (analysis.hasGodsWillContent) {
    const godsWillNodeId = 'topic_gods_will'
    edges.push({
      source: docNodeId,
      target: godsWillNodeId,
      relationship: 'about',
      weight: 2
    })
  }

  return { nodes, edges }
}

/**
 * Simple hash function for generating consistent IDs
 *
 * @param {string} str - String to hash
 * @returns {string} Hash string
 */
function hashString(str) {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36)
}

/**
 * Extract title from URL as fallback
 *
 * @param {string} url - URL
 * @returns {string} Extracted title
 */
function extractTitleFromUrl(url) {
  try {
    const urlObj = new URL(url)
    const path = urlObj.pathname
    const lastSegment = path.split('/').filter(Boolean).pop() || urlObj.hostname
    return decodeURIComponent(lastSegment.replace(/[-_]/g, ' '))
  } catch {
    return url
  }
}

/**
 * Crawl single page and extract knowledge
 *
 * @param {string} url - URL to crawl
 * @param {Array<string>} keywords - Search keywords
 * @param {string} modelId - Selected AI model ID (optional)
 * @param {Object} settings - Model settings (temperature, maxTokens)
 * @returns {Promise<Object>} Crawl results
 */
export async function crawlPage(url, keywords, modelId = null, settings = {}) {
  try {
    // Fetch webpage
    const webpage = await fetchWebpage(url)

    // Analyze content with AI via orchestrator
    const analysis = await analyzeContent(
      url,
      webpage.title,
      webpage.text || webpage.content,
      modelId,
      settings
    )

    // Extract knowledge graph elements
    const knowledge = extractKnowledge(url, webpage.title, analysis)

    // Filter relevant links
    const relevantLinks = filterRelevantLinks(
      url,
      webpage.links || [],
      keywords
    )

    return {
      url,
      title: webpage.title,
      analysis,
      knowledge,
      relevantLinks,
      success: true
    }
  } catch (error) {
    console.error(`Error crawling page ${url}:`, error)
    return {
      url,
      error: error.message,
      success: false
    }
  }
}

export default {
  fetchWebpage,
  filterRelevantLinks,
  isOrthodoxWebsite,
  analyzeContent,
  extractKnowledge,
  crawlPage
}
