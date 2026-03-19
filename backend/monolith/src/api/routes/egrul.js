/**
 * EGRUL (ЕГРЮЛ) Parser API Route
 *
 * Official Federal Tax Service (FNS) registry parser
 * Source: https://egrul.nalog.ru/
 *
 * Features:
 * - FREE public API
 * - NO authentication required
 * - NO CAPTCHA
 * - Official government data
 * - JSON responses
 *
 * Data available:
 * - Full company name
 * - Short name
 * - INN (taxpayer ID)
 * - OGRN (state registration number)
 * - KPP (tax registration reason code)
 * - Director/CEO name
 * - Registration date
 * - Legal address
 * - Region
 * - Company status
 *
 * API Flow:
 * 1. POST search request with INN/OGRN/name
 * 2. Receive search token
 * 3. GET results with token
 *
 * Issue: Part of INN Analytics Agent (#5005)
 */

import express from 'express';
import { ProxyHttpClient } from '../../services/ProxyHttpClient.js';

const router = express.Router();
const httpClient = new ProxyHttpClient();

/**
 * POST /api/egrul/search
 *
 * Search company in EGRUL by INN, OGRN, or name
 *
 * Request body:
 * {
 *   "query": "2721217652",     // INN, OGRN, or company name
 *   "type": "ul"               // ul = legal entity, ip = individual entrepreneur
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "query": "2721217652",
 *     "found": true,
 *     "company": {
 *       "name": "ОБЩЕСТВО С ОГРАНИЧЕННОЙ ОТВЕТСТВЕННОСТЬЮ \"МАГНИТ\"",
 *       "shortName": "ООО \"МАГНИТ\"",
 *       "inn": "2721217652",
 *       "ogrn": "1152721003808",
 *       "kpp": "201101001",
 *       "director": "Верхотуров Евгений Викторович",
 *       "registrationDate": "06.07.2015",
 *       "address": "Чеченская Респ, ...",
 *       "region": "Чеченская Республика",
 *       "status": "Действующая"
 *     },
 *     "source": "egrul.nalog.ru",
 *     "timestamp": "2025-12-23T14:50:00.000Z"
 *   }
 * }
 */
router.post('/search', async (req, res) => {
  try {
    const { query, type = 'ul' } = req.body;

    if (!query) {
      return res.status(400).json({
        success: false,
        error: 'Query parameter is required (INN, OGRN, or company name)'
      });
    }

    console.log(`[EGRUL Parser] Searching for: ${query} (type: ${type})`);

    // Step 1: POST search request to get token
    const searchPayload = {
      query: query.trim(),
      region: '',
      page: 1,
      pageSize: 10,
      type: type // ul = ЮЛ (legal entity), ip = ИП (individual entrepreneur)
    };

    console.log('[EGRUL Parser] Sending search request...');

    const searchResponse = await httpClient.post(
      'https://egrul.nalog.ru/',
      searchPayload,
      {
        useProxy: true,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/plain, */*',
          'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
          'Origin': 'https://egrul.nalog.ru',
          'Referer': 'https://egrul.nalog.ru/'
        },
        timeout: 15000
      }
    );

    if (!searchResponse || !searchResponse.t) {
      console.error('[EGRUL Parser] No token received:', searchResponse);
      return res.status(500).json({
        success: false,
        error: 'Failed to get search token from EGRUL'
      });
    }

    const searchToken = searchResponse.t;
    console.log(`[EGRUL Parser] Got search token: ${searchToken.substring(0, 20)}...`);

    // Check if CAPTCHA is required
    if (searchResponse.captchaRequired) {
      console.log('[EGRUL Parser] ⚠️  CAPTCHA required');
      return res.status(429).json({
        success: false,
        error: 'CAPTCHA verification required. Please try again later.',
        captchaRequired: true
      });
    }

    // Step 2: Wait a bit for results to be ready (EGRUL processing time)
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Step 3: GET search results with token
    console.log('[EGRUL Parser] Fetching search results...');

    const resultsUrl = `https://egrul.nalog.ru/search-result/${searchToken}`;
    const resultsResponse = await httpClient.get(resultsUrl, {
      useProxy: true,
      headers: {
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
        'Referer': 'https://egrul.nalog.ru/'
      },
      timeout: 15000
    });

    if (!resultsResponse || !resultsResponse.rows || resultsResponse.rows.length === 0) {
      console.log('[EGRUL Parser] No companies found for query:', query);
      return res.json({
        success: true,
        data: {
          query,
          found: false,
          message: 'No companies found in EGRUL registry',
          source: 'egrul.nalog.ru',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Parse first result (most relevant)
    const firstResult = resultsResponse.rows[0];
    console.log('[EGRUL Parser] Found company:', firstResult.n);

    // Extract director from field 'g' (contains: "ДИРЕКТОР Иванов Иван Иванович")
    let director = null;
    if (firstResult.g) {
      const directorMatch = firstResult.g.match(/(?:ДИРЕКТОР|Директор|РУКОВОДИТЕЛЬ|Руководитель)[:\s]*(.+)/i);
      if (directorMatch && directorMatch[1]) {
        director = directorMatch[1].trim();
      }
    }

    const company = {
      name: firstResult.n || null,           // Full name: "ОБЩЕСТВО С ОГРАНИЧЕННОЙ ОТВЕТСТВЕННОСТЬЮ \"МАГНИТ\""
      shortName: firstResult.c || null,      // Short name: "ООО \"МАГНИТ\""
      inn: firstResult.i || null,            // INN: "2721217652"
      ogrn: firstResult.o || null,           // OGRN: "1152721003808"
      kpp: firstResult.p || null,            // KPP: "201101001"
      director: director,                    // Director: "Верхотуров Евгений Викторович"
      registrationDate: firstResult.r || null, // Registration: "06.07.2015"
      address: firstResult.a || null,        // Address (if available)
      region: firstResult.rn || null,        // Region: "Чеченская Республика"
      status: firstResult.s || 'Неизвестно' // Status: "Действующая"
    };

    console.log('[EGRUL Parser] ✅ Successfully parsed company data');

    res.json({
      success: true,
      data: {
        query,
        found: true,
        company,
        source: 'egrul.nalog.ru',
        timestamp: new Date().toISOString(),
        official: true,
        verified: true
      }
    });

  } catch (error) {
    console.error('[EGRUL Parser] Error:', error);

    res.status(500).json({
      success: false,
      error: 'Failed to fetch data from EGRUL registry',
      details: error.message
    });
  }
});

/**
 * GET /api/egrul/search/:query
 *
 * Convenience GET endpoint for simple searches
 */
router.get('/search/:query', async (req, res) => {
  try {
    const { query } = req.params;
    const { type = 'ul' } = req.query;

    // Forward to POST endpoint
    req.body = { query, type };
    return router.handle(req, res);
  } catch (error) {
    console.error('[EGRUL Parser] Error in GET endpoint:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/egrul/health
 *
 * Health check endpoint
 */
router.get('/health', (req, res) => {
  res.json({
    success: true,
    service: 'EGRUL Parser',
    status: 'operational',
    source: 'egrul.nalog.ru',
    official: true,
    features: [
      'Free public API',
      'No authentication required',
      'Official FNS data',
      'Company search by INN/OGRN/name',
      'Director information',
      'Full company details'
    ]
  });
});

export default router;
