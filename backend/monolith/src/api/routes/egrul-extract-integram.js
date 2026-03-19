/**
 * EGRUL Extract to Integram Integration
 *
 * Combines EGRUL extract download with Integram storage
 * Automatically downloads official FNS extract and saves to organization's subordinate table
 */

import express from 'express';
import { ProxyHttpClient } from '../../services/ProxyHttpClient.js';
import IntegramMCPClient from '../../services/mcp/IntegramMCPClient.js';

const router = express.Router();
const httpClient = new ProxyHttpClient();

/**
 * POST /api/egrul/save-extract-to-integram
 *
 * Download EGRUL extract and save to Integram
 *
 * Request body:
 * {
 *   "organizationId": 210581,  // Integram organization ID
 *   "inn": "7805077168",        // Company INN
 *   "type": "ul",               // ul or ip
 *   "format": "pdf"             // pdf or xml
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "extractId": 217830,
 *   "organizationId": 210581,
 *   "downloadUrl": "https://dronedoc.ru/my/object/217830"
 * }
 */
router.post('/save-extract-to-integram', async (req, res) => {
  try {
    const { organizationId, inn, type = 'ul', format = 'pdf' } = req.body;

    if (!organizationId) {
      return res.status(400).json({
        success: false,
        error: 'Organization ID is required'
      });
    }

    if (!inn) {
      return res.status(400).json({
        success: false,
        error: 'INN is required'
      });
    }

    console.log(`[EGRUL→Integram] Saving extract for organization ${organizationId}, INN: ${inn}`);

    // Initialize Integram client
    const integramClient = new IntegramMCPClient({
      serverURL: process.env.INTEGRAM_SERVER_URL || 'https://dronedoc.ru',
      database: process.env.INTEGRAM_DATABASE || 'my'
    });

    await integramClient.authenticate(
      process.env.INTEGRAM_SYSTEM_USERNAME || 'd',
      process.env.INTEGRAM_SYSTEM_PASSWORD || 'd'
    );

    // Step 1: Download extract from EGRUL
    console.log('[EGRUL→Integram] Step 1: Downloading extract from EGRUL...');

    const extractData = await downloadExtract(inn, type, format);

    console.log(`[EGRUL→Integram] Extract downloaded: ${extractData.size} bytes`);

    // Step 2: Create extract record in Integram (name only)
    console.log('[EGRUL→Integram] Step 2: Creating extract record...');

    const extractRecord = await integramClient.createObject({
      typeId: 214618, // Выписка ЕГРЮЛ table
      value: `Выписка ЕГРЮЛ от ${new Date().toLocaleDateString('ru-RU')}`,
      parentId: organizationId
    });

    console.log('[EGRUL→Integram] extractRecord:', JSON.stringify(extractRecord, null, 2));
    const extractId = extractRecord.id;

    if (!extractId) {
      throw new Error('Failed to create extract record - no ID returned');
    }

    console.log(`[EGRUL→Integram] ✅ Extract record created: ${extractId}`);

    // Step 3: Set requisites using _m_set endpoint (FIXED: correct Integram API format)
    console.log('[EGRUL→Integram] Step 3: Setting requisites...');

    // FIX: objectId in URL, prefix 't' not 'r'
    const setUrl = `${process.env.INTEGRAM_SERVER_URL || 'https://dronedoc.ru'}/${process.env.INTEGRAM_DATABASE || 'my'}/_m_set/${extractId}?JSON_KV`;
    const setFormData = new URLSearchParams();
    setFormData.append('t217787', new Date().toISOString().split('T')[0]); // Дата
    setFormData.append('t217820', format.toUpperCase()); // Тип выписки
    setFormData.append('t217821', 'Загружена'); // Статус
    setFormData.append('t217823', JSON.stringify(extractData.companyData || {})); // Данные JSON
    setFormData.append('t217825', 'egrul.nalog.ru'); // Источник
    setFormData.append('t217827', `extract_${inn}_${Date.now()}.${format}`); // Файл PDF
    setFormData.append('_xsrf', integramClient.xsrfToken);

    const axios = (await import('axios')).default;
    await axios.post(setUrl, setFormData, {
      headers: {
        'X-Authorization': integramClient.token,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    console.log(`[EGRUL→Integram] ✅ Requisites set for extract ${extractId}`);

    // TODO: Upload PDF file to Integram file storage
    // This would require additional file upload endpoint in Integram

    res.json({
      success: true,
      extractId: extractId,
      organizationId: organizationId,
      downloadUrl: `https://dronedoc.ru/my/object/${extractId}`,
      extractSize: extractData.size,
      companyData: extractData.companyData
    });

  } catch (error) {
    console.error('[EGRUL→Integram] Error:', error);

    res.status(500).json({
      success: false,
      error: 'Failed to save extract to Integram',
      details: error.message
    });
  }
});

/**
 * Download EGRUL extract (internal helper)
 */
async function downloadExtract(inn, type, format) {
  // Step 1: Search company
  const searchPayload = {
    query: inn.trim(),
    region: '',
    page: 1,
    pageSize: 10,
    type
  };

  const searchResponse = await httpClient.post(
    'https://egrul.nalog.ru/',
    searchPayload,
    {
      useProxy: true,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Origin': 'https://egrul.nalog.ru',
        'Referer': 'https://egrul.nalog.ru/'
      }
    }
  );

  if (!searchResponse || !searchResponse.t) {
    throw new Error('Failed to get search token from EGRUL');
  }

  const searchToken = searchResponse.t;
  await new Promise(resolve => setTimeout(resolve, 1500));

  // Step 2: Get search results
  const resultsUrl = `https://egrul.nalog.ru/search-result/${searchToken}`;
  const resultsResponse = await httpClient.get(resultsUrl, {
    useProxy: true,
    headers: {
      'Accept': 'application/json',
      'Referer': 'https://egrul.nalog.ru/'
    }
  });

  if (!resultsResponse || !resultsResponse.rows || resultsResponse.rows.length === 0) {
    throw new Error('Company not found in EGRUL registry');
  }

  const companyToken = resultsResponse.rows[0].t;
  const companyData = {
    name: resultsResponse.rows[0].n,
    inn: resultsResponse.rows[0].i,
    ogrn: resultsResponse.rows[0].o,
    kpp: resultsResponse.rows[0].p,
    region: resultsResponse.rows[0].rn,
    registrationDate: resultsResponse.rows[0].r
  };

  // Step 3: Request extract
  const requestUrl = `https://egrul.nalog.ru/vyp-request/${companyToken}`;
  await httpClient.get(requestUrl, {
    useProxy: true,
    headers: {
      'Accept': 'application/json',
      'Referer': 'https://egrul.nalog.ru/'
    }
  });

  // Step 4: Poll status
  let extractStatus = 'wait';
  let attempts = 0;
  const maxAttempts = 30;

  while (extractStatus === 'wait' && attempts < maxAttempts) {
    await new Promise(resolve => setTimeout(resolve, 1000));
    attempts++;

    const statusUrl = `https://egrul.nalog.ru/vyp-status/${companyToken}`;
    const statusResponse = await httpClient.get(statusUrl, {
      useProxy: true,
      headers: {
        'Accept': 'application/json',
        'Referer': 'https://egrul.nalog.ru/'
      }
    });

    extractStatus = statusResponse.status;

    if (extractStatus === 'ready') {
      break;
    } else if (extractStatus === 'error') {
      throw new Error('Error generating EGRUL extract');
    }
  }

  if (extractStatus !== 'ready') {
    throw new Error('Timeout waiting for extract generation');
  }

  // Step 5: Download extract
  const downloadUrl = `https://egrul.nalog.ru/vyp-download/${companyToken}`;
  const downloadResponse = await httpClient.downloadFile(downloadUrl, {
    useProxy: true,
    headers: {
      'Accept': format === 'xml' ? 'application/xml' : 'application/pdf',
      'Referer': 'https://egrul.nalog.ru/'
    }
  });

  return {
    buffer: downloadResponse,
    size: downloadResponse.length,
    companyData
  };
}

export default router;
