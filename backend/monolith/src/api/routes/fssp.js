/**
 * FSSP (ФССП) API Route - Federal Bailiff Service
 *
 * Checks for debts and enforcement proceedings by INN
 * Source: https://api-ip.fssp.gov.ru/
 *
 * Features:
 * - Search enforcement proceedings by company INN
 * - Search enforcement proceedings by person (name + birthdate)
 * - Returns debt amounts and case details
 *
 * Issue: Part of Chat Utility Agents
 */

import express from 'express';
import { ProxyHttpClient } from '../../services/ProxyHttpClient.js';
import { searchByINNWeb } from '../../services/fsspParser.js';

const router = express.Router();
const httpClient = new ProxyHttpClient();

// FSSP API configuration
const FSSP_API_URL = 'https://api-ip.fssp.gov.ru/api/v1.0';
const FSSP_API_TOKEN = process.env.FSSP_API_TOKEN || '';

/**
 * POST /api/fssp/search
 *
 * Search for enforcement proceedings
 *
 * Request body:
 * For legal entities:
 * {
 *   "type": "legal",
 *   "inn": "1234567890"
 * }
 *
 * For physical persons:
 * {
 *   "type": "physical",
 *   "lastName": "Иванов",
 *   "firstName": "Иван",
 *   "middleName": "Иванович",
 *   "birthDate": "01.01.1980",
 *   "region": "77"
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "result": [
 *     {
 *       "ip_number": "12345/21/77001-ИП",
 *       "ip_subject": "Задолженность по кредиту",
 *       "ip_sum": "150000.00",
 *       "ip_date": "15.03.2021",
 *       "department": "УФССП по г. Москве"
 *     }
 *   ]
 * }
 */
router.post('/search', async (req, res) => {
  try {
    const { type, inn, lastName, firstName, middleName, birthDate, region } = req.body;

    if (!type) {
      return res.status(400).json({
        success: false,
        error: 'Type parameter is required (legal or physical)'
      });
    }

    console.log(`[FSSP API] Searching for ${type} entity:`, type === 'legal' ? inn : lastName);

    // Check if API token is configured
    if (!FSSP_API_TOKEN) {
      console.warn('[FSSP API] No API token configured, using web parser fallback');

      // Use web parser as fallback
      if (type === 'legal' && inn) {
        const parserResult = await searchByINNWeb(inn);
        return res.json(parserResult);
      }

      // For other types, return demo response
      return res.json({
        success: true,
        demo: true,
        message: 'Demo mode: FSSP_API_TOKEN not configured. Web parser available only for INN search.',
        result: [],
        query: { type, inn, lastName },
        timestamp: new Date().toISOString()
      });
    }

    let searchUrl, searchParams;

    if (type === 'legal') {
      // Search by company INN
      if (!inn || !/^\d{10}$/.test(inn)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid INN format. Legal entity INN must be 10 digits.'
        });
      }

      searchUrl = `${FSSP_API_URL}/search/legal`;
      searchParams = {
        token: FSSP_API_TOKEN,
        name: '',
        inn: inn,
        region: region || ''
      };

    } else if (type === 'physical') {
      // Search by person
      if (!lastName || !firstName) {
        return res.status(400).json({
          success: false,
          error: 'lastName and firstName are required for physical entity search'
        });
      }

      searchUrl = `${FSSP_API_URL}/search/physical`;
      searchParams = {
        token: FSSP_API_TOKEN,
        lastname: lastName,
        firstname: firstName,
        secondname: middleName || '',
        birthdate: birthDate || '',
        region: region || ''
      };

    } else {
      return res.status(400).json({
        success: false,
        error: 'Invalid type. Must be "legal" or "physical".'
      });
    }

    console.log('[FSSP API] Sending search request...');

    // Make request to FSSP API
    const searchResponse = await httpClient.get(searchUrl, {
      params: searchParams,
      useProxy: true,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'DronDoc/1.0'
      },
      timeout: 30000
    });

    // Parse response
    if (searchResponse.exception) {
      console.error('[FSSP API] API returned exception:', searchResponse.exception);
      return res.status(500).json({
        success: false,
        error: searchResponse.exception
      });
    }

    // Check for task token (async search)
    if (searchResponse.response && searchResponse.response.task) {
      const taskToken = searchResponse.response.task;
      console.log(`[FSSP API] Got async task token: ${taskToken}`);

      // Wait for results
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Get results
      const resultUrl = `${FSSP_API_URL}/result`;
      const resultResponse = await httpClient.get(resultUrl, {
        params: {
          token: FSSP_API_TOKEN,
          task: taskToken
        },
        useProxy: true,
        headers: {
          'Accept': 'application/json'
        },
        timeout: 30000
      });

      if (resultResponse.response && resultResponse.response.result) {
        const results = resultResponse.response.result;

        console.log(`[FSSP API] Found ${results.length} enforcement proceedings`);

        return res.json({
          success: true,
          result: results.map(item => ({
            ip_number: item.ip_number || null,
            ip_subject: item.ip_subject || item.subject || null,
            ip_sum: item.ip_sum || item.debt_sum || '0',
            ip_date: item.ip_date || item.date || null,
            department: item.department || item.dept || null,
            bailiff: item.bailiff || null,
            details: item.details || null
          })),
          totalFound: results.length,
          query: { type, inn, lastName },
          source: 'fssp.gov.ru',
          timestamp: new Date().toISOString()
        });
      }
    }

    // Direct response (no async task)
    if (searchResponse.response && searchResponse.response.result) {
      const results = searchResponse.response.result;

      console.log(`[FSSP API] Found ${results.length} enforcement proceedings`);

      return res.json({
        success: true,
        result: results.map(item => ({
          ip_number: item.ip_number || null,
          ip_subject: item.ip_subject || null,
          ip_sum: item.ip_sum || '0',
          ip_date: item.ip_date || null,
          department: item.department || null,
          bailiff: item.bailiff || null,
          details: item.details || null
        })),
        totalFound: results.length,
        query: { type, inn, lastName },
        source: 'fssp.gov.ru',
        timestamp: new Date().toISOString()
      });
    }

    // No results found
    console.log('[FSSP API] No enforcement proceedings found');

    return res.json({
      success: true,
      result: [],
      totalFound: 0,
      message: 'No enforcement proceedings found',
      query: { type, inn, lastName },
      source: 'fssp.gov.ru',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[FSSP API] Error:', error);

    res.status(500).json({
      success: false,
      error: 'Failed to check FSSP registry',
      details: error.message
    });
  }
});

/**
 * GET /api/fssp/search/:inn
 *
 * Convenience GET endpoint for INN search
 */
router.get('/search/:inn', async (req, res) => {
  try {
    const { inn } = req.params;

    // Forward to POST endpoint
    req.body = { type: 'legal', inn };

    // Call POST handler directly
    return router.handle(req, res);
  } catch (error) {
    console.error('[FSSP API] Error in GET endpoint:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/fssp/health
 *
 * Health check endpoint
 */
router.get('/health', (req, res) => {
  res.json({
    success: true,
    service: 'FSSP API',
    status: 'operational',
    source: 'api-ip.fssp.gov.ru',
    tokenConfigured: !!FSSP_API_TOKEN,
    features: [
      'Enforcement proceedings search',
      'Search by company INN',
      'Search by person name',
      'Debt amount information',
      'Case details'
    ]
  });
});

export default router;
