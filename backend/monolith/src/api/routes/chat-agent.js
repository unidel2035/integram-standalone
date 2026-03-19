/**
 * Chat Agent API Routes
 *
 * Provides agent capabilities for chat:
 * - Web search via DuckDuckGo
 * - Code execution (future)
 */

import express from 'express';
import { ProxyHttpClient } from '../../services/ProxyHttpClient.js';

const router = express.Router();
const httpClient = new ProxyHttpClient();

/**
 * POST /api/chat-agent/search
 *
 * Perform web search using DuckDuckGo
 *
 * Request body:
 * {
 *   "query": "search query"
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "results": [
 *     {
 *       "title": "Result title",
 *       "url": "https://...",
 *       "snippet": "Description..."
 *     }
 *   ]
 * }
 */
router.post('/search', async (req, res) => {
  try {
    const { query } = req.body;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Query parameter is required'
      });
    }

    console.log(`[Chat Agent] Web search: "${query}"`);

    // Use DuckDuckGo HTML search (no API key needed)
    const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;

    const response = await httpClient.get(searchUrl, {
      useProxy: true,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7'
      },
      timeout: 15000,
      responseType: 'text'
    });

    // Parse HTML response to extract results
    const results = parseSearchResults(response);

    console.log(`[Chat Agent] Found ${results.length} search results`);

    res.json({
      success: true,
      query,
      results,
      source: 'DuckDuckGo',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[Chat Agent] Search error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Search failed'
    });
  }
});

/**
 * Parse DuckDuckGo HTML search results
 */
function parseSearchResults(html) {
  const results = [];

  if (!html || typeof html !== 'string') {
    return results;
  }

  // Match result blocks
  const resultPattern = /<a[^>]+class="result__a"[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>/gi;
  const snippetPattern = /<a[^>]+class="result__snippet"[^>]*>([^<]+(?:<[^>]+>[^<]*<\/[^>]+>)*[^<]*)<\/a>/gi;

  // Simple regex extraction - use [\s\S]*? to capture content with HTML tags inside
  const linkMatches = [...html.matchAll(/<a[^>]+class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)];
  const snippetMatches = [...html.matchAll(/<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi)];

  for (let i = 0; i < Math.min(linkMatches.length, 10); i++) {
    const linkMatch = linkMatches[i];
    const snippetMatch = snippetMatches[i];

    if (linkMatch) {
      let url = linkMatch[1];
      // DuckDuckGo wraps URLs, extract actual URL
      const uddgMatch = url.match(/uddg=([^&]+)/);
      if (uddgMatch) {
        url = decodeURIComponent(uddgMatch[1]);
      }

      const title = linkMatch[2]?.replace(/<[^>]+>/g, '').trim() || 'No title';
      const snippet = snippetMatch?.[1]?.replace(/<[^>]+>/g, '').trim() || '';

      results.push({
        title,
        url,
        snippet: snippet.substring(0, 300)
      });
    }
  }

  return results;
}

/**
 * GET /api/chat-agent/health
 *
 * Health check
 */
router.get('/health', (req, res) => {
  res.json({
    success: true,
    service: 'Chat Agent',
    status: 'operational',
    features: ['Web Search', 'DuckDuckGo']
  });
});

export default router;
