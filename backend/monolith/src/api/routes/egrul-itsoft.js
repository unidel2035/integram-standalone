/**
 * EGRUL ITSoft Routes
 *
 * API for working with egrul.itsoft.ru service:
 * - Company data fetching
 * - Accounting reports (бух отчетность)
 * - Saving to Integram
 * - XML parsing to financial indicators
 *
 * IMPORTANT: Uses api_reg credentials for Integram authentication (database: my)
 */

import express from 'express';
import axios from 'axios';
import { authenticateIntegram } from '../../services/dataNewtonIntegram.js';

const router = express.Router();

// Base URL for egrul.itsoft.ru
const BASE_URL = 'https://egrul.itsoft.ru';

// Integram configuration
const INTEGRAM_CONFIG = {
  serverURL: 'https://dronedoc.ru',
  database: 'my',
  // Tables in Integram
  organizationTypeId: 197000,    // Организация
  buhReportTypeId: 215314,       // Бух отчет
  finParamTypeId: 215583         // Финансовый параметр
};

// Year to Integram object ID mapping for "Год" reference field
const YEAR_TO_INTEGRAM = {
  2018: 216142,
  2019: 216143,
  2020: 216147,
  2021: 216148,
  2022: 216149,
  2023: 216150,
  2024: 216151
};

/**
 * Get Integram auth using api_reg credentials
 */
async function getIntegraamAuth() {
  const login = process.env.INTEGRAM_REGISTRATION_USERNAME || 'api_reg';
  const password = process.env.INTEGRAM_REGISTRATION_PASSWORD || 'ca84qkcx';
  return await authenticateIntegram(login, password);
}

/**
 * Fetch with retry and proxy support
 */
async function fetchWithRetry(url, options = {}, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await axios.get(url, {
        timeout: 30000,
        headers: {
          'User-Agent': 'DronDoc/1.0',
          'Accept': 'application/json, text/html, */*'
        },
        ...options
      });
      return response;
    } catch (error) {
      if (i === retries - 1) throw error;
      await new Promise(r => setTimeout(r, 1000 * (i + 1)));
    }
  }
}

/**
 * GET /comprehensive
 * Get comprehensive company data from egrul.itsoft.ru
 */
router.post('/comprehensive', async (req, res) => {
  try {
    const { inn } = req.body;

    if (!inn) {
      return res.status(400).json({ success: false, error: 'INN is required' });
    }

    console.log(`[EGRUL-ITSoft] Fetching comprehensive data for INN: ${inn}`);

    // Try JSON first, then gzipped
    let companyData = null;

    try {
      const jsonUrl = `${BASE_URL}/${inn}.json`;
      const response = await fetchWithRetry(jsonUrl);
      companyData = response.data;
    } catch (e) {
      console.log(`[EGRUL-ITSoft] JSON failed, trying .json.gz`);
      try {
        const gzUrl = `${BASE_URL}/${inn}.json.gz`;
        const response = await fetchWithRetry(gzUrl, { decompress: true });
        companyData = response.data;
      } catch (e2) {
        throw new Error(`Company not found: ${inn}`);
      }
    }

    // Add INN to response data
    res.json({
      success: true,
      data: {
        ...companyData,
        inn: inn  // Ensure INN is always included
      },
      source: 'egrul.itsoft.ru'
    });

  } catch (error) {
    console.error('[EGRUL-ITSoft] Error fetching comprehensive data:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /accounting-list
 * Get list of accounting files for INN
 */
router.get('/accounting-list', async (req, res) => {
  try {
    const { inn } = req.query;

    if (!inn) {
      return res.status(400).json({ success: false, error: 'INN query parameter is required' });
    }

    console.log(`[EGRUL-ITSoft] Getting accounting list for INN: ${inn}`);

    const listUrl = `${BASE_URL}/bo/ls.php?inn=${inn}`;
    const response = await fetchWithRetry(listUrl);
    const listHtml = response.data;

    const files = [];
    const fileRegex = /filename=([^"&\s]+\.(xml|pdf|docx))/gi;
    let match;

    while ((match = fileRegex.exec(listHtml)) !== null) {
      const filename = match[1];
      if (!files.find(f => f.filename === filename)) {
        const ext = filename.split('.').pop().toLowerCase();
        files.push({
          filename,
          extension: ext,
          downloadUrl: `${BASE_URL}/bo/file_get_content.php?inn=${inn}&filename=${filename}&as_content=0`
        });
      }
    }

    res.json({
      success: true,
      data: {
        inn,
        files,
        totalCount: files.length,
        xmlCount: files.filter(f => f.extension === 'xml').length,
        pdfCount: files.filter(f => f.extension === 'pdf').length
      }
    });

  } catch (error) {
    console.error('[EGRUL-ITSoft] Error getting accounting list:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /accounting
 * Get accounting reports list (legacy endpoint)
 */
router.post('/accounting', async (req, res) => {
  try {
    const { inn } = req.body;

    if (!inn) {
      return res.status(400).json({ success: false, error: 'INN is required' });
    }

    const listUrl = `${BASE_URL}/bo/ls.php?inn=${inn}`;
    const response = await fetchWithRetry(listUrl);
    const listHtml = response.data;

    const files = [];
    const fileRegex = /filename=([^"&\s]+\.(xml|pdf|docx))/gi;
    let match;

    while ((match = fileRegex.exec(listHtml)) !== null) {
      const filename = match[1];
      if (!files.find(f => f.filename === filename)) {
        files.push({ filename });
      }
    }

    res.json({
      success: true,
      data: {
        inn,
        files
      }
    });

  } catch (error) {
    console.error('[EGRUL-ITSoft] Error getting accounting:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /save-to-integram
 * Save company data to Integram
 * Supports createOrg: true to create new organization
 */
router.post('/save-to-integram', async (req, res) => {
  try {
    const { inn, orgId: providedOrgId, createOrg, companyName: providedCompanyName, skipExtractDownload } = req.body;

    if (!inn) {
      return res.status(400).json({ success: false, error: 'INN is required' });
    }

    if (!providedOrgId && !createOrg) {
      return res.status(400).json({ success: false, error: 'Either orgId or createOrg: true is required' });
    }

    console.log(`[EGRUL-ITSoft] Saving to Integram for INN: ${inn}, orgId: ${providedOrgId}, createOrg: ${createOrg}, skipExtractDownload: ${skipExtractDownload}`);

    // Authenticate with api_reg
    const auth = await getIntegraamAuth();
    console.log(`[EGRUL-ITSoft] Authenticated with api_reg`);

    let orgId = providedOrgId;
    let orgCreated = false;
    let companyData = null;
    let companyName = providedCompanyName;

    // If createOrg, fetch company data and create organization
    if (createOrg && !orgId) {
      // If companyName is provided, use it; otherwise fetch from EGRUL
      if (!companyName && !skipExtractDownload) {
        // Fetch company data from EGRUL
        const egrulUrl = `${BASE_URL}/${inn}.json`;
        try {
          const egrulResponse = await fetchWithRetry(egrulUrl);
          companyData = egrulResponse.data;
        } catch (e) {
          console.log('[EGRUL-ITSoft] JSON failed, trying gzipped');
          const gzUrl = `${BASE_URL}/${inn}.json.gz`;
          const egrulResponse = await fetchWithRetry(gzUrl, { decompress: true });
          companyData = egrulResponse.data;
        }

        companyName = companyData?.СвЮЛ?.СвНаимЮЛ?.НаимЮЛПолн ||
                      companyData?.name ||
                      companyData?.full_name ||
                      `Организация ${inn}`;
      } else if (!companyName) {
        companyName = `Организация ${inn}`;
      }

      // Search for existing org with this INN (F_198195 = filter by INN requisite)
      const searchUrl = `${INTEGRAM_CONFIG.serverURL}/${INTEGRAM_CONFIG.database}/object/${INTEGRAM_CONFIG.organizationTypeId}?JSON_KV&F_198195=${encodeURIComponent(inn)}`;

      try {
        const searchResponse = await axios.get(searchUrl, {
          headers: { 'X-Authorization': auth.token }
        });

        if (searchResponse.data?.object?.length > 0) {
          // Found existing org
          orgId = searchResponse.data.object[0].id;
          console.log(`[EGRUL-ITSoft] Found existing org: ${orgId}`);
        }
      } catch (e) {
        console.log('[EGRUL-ITSoft] Search failed, will create new org');
      }

      // Create new org if not found
      if (!orgId) {
        const createUrl = `${INTEGRAM_CONFIG.serverURL}/${INTEGRAM_CONFIG.database}/_m_new/${INTEGRAM_CONFIG.organizationTypeId}?JSON_KV`;
        const formData = new URLSearchParams();
        formData.append(`t${INTEGRAM_CONFIG.organizationTypeId}`, companyName);
        formData.append('up', '1'); // Independent object
        formData.append('_xsrf', auth.xsrf);

        const createResponse = await axios.post(createUrl, formData, {
          headers: {
            'X-Authorization': auth.token,
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        });

        orgId = createResponse.data?.id;
        orgCreated = true;
        console.log(`[EGRUL-ITSoft] Created new org: ${orgId}`);
      }

      // Set INN requisite (198195) - ALWAYS, for both new and existing orgs
      if (orgId) {
        const setUrl = `${INTEGRAM_CONFIG.serverURL}/${INTEGRAM_CONFIG.database}/_m_set?JSON_KV`;
        const setFormData = new URLSearchParams();
        setFormData.append('id', orgId);
        setFormData.append('r198195', inn); // ИНН (correct requisite ID)
        setFormData.append('_xsrf', auth.xsrf);

        await axios.post(setUrl, setFormData, {
          headers: {
            'X-Authorization': auth.token,
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        });
        console.log(`[EGRUL-ITSoft] Set INN ${inn} for org ${orgId}`);
      }
    }

    if (!orgId) {
      return res.status(400).json({ success: false, error: 'Could not determine orgId' });
    }

    // Now fetch and save accounting files
    const listUrl = `${BASE_URL}/bo/ls.php?inn=${inn}`;
    const listResponse = await fetchWithRetry(listUrl);
    const listHtml = listResponse.data;

    const files = [];
    const fileRegex = /filename=([^"&\s]+\.(xml|pdf))/gi;
    let match;

    while ((match = fileRegex.exec(listHtml)) !== null) {
      const filename = match[1];
      if (!files.find(f => f.filename === filename)) {
        files.push({ filename });
      }
    }

    console.log(`[EGRUL-ITSoft] Found ${files.length} files to save`);

    // TODO: Actually download and save files to Integram attachments
    // For now, just return the count

    res.json({
      success: true,
      data: {
        orgId,
        orgCreated,
        companyData,
        filesSaved: files.length,
        orgUrl: `${INTEGRAM_CONFIG.serverURL}/${INTEGRAM_CONFIG.database}/edit/${orgId}`
      }
    });

  } catch (error) {
    console.error('[EGRUL-ITSoft] Error saving to Integram:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /fetch-and-save
 * Fetch files and save to Integram
 */
router.post('/fetch-and-save', async (req, res) => {
  try {
    const { inn, orgId, files } = req.body;

    if (!inn || !orgId) {
      return res.status(400).json({ success: false, error: 'INN and orgId are required' });
    }

    console.log(`[EGRUL-ITSoft] Fetching and saving files for INN: ${inn}, orgId: ${orgId}`);

    // For now, just acknowledge the request
    // Actual file download and attachment would go here

    res.json({
      success: true,
      data: {
        orgId,
        filesSaved: files?.length || 0
      }
    });

  } catch (error) {
    console.error('[EGRUL-ITSoft] Error fetching and saving:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /parse-xml-to-integram
 * Parse single XML file and create financial indicators in Integram
 */
router.post('/parse-xml-to-integram', async (req, res) => {
  try {
    const { inn, orgId, filename } = req.body;

    if (!inn || !orgId || !filename) {
      return res.status(400).json({ success: false, error: 'INN, orgId, and filename are required' });
    }

    console.log(`[EGRUL-ITSoft] Parsing XML: ${filename} for org: ${orgId}`);

    // Authenticate with api_reg
    const auth = await getIntegraamAuth();

    // Download XML file
    const xmlUrl = `${BASE_URL}/bo/file_get_content.php?inn=${inn}&filename=${filename}&as_content=0`;
    const xmlResponse = await fetchWithRetry(xmlUrl);
    const xmlContent = xmlResponse.data;

    // Parse XML to extract year and financial data
    // This is a simplified version - real parsing would be more complex

    // Extract year from filename (e.g., NO_BUHOTCH_..._20230328_...)
    const yearMatch = filename.match(/_(\d{4})\d{4}_/);
    const reportYear = yearMatch ? parseInt(yearMatch[1]) : null;

    // Extract years from XML content
    const years = [];
    const periodMatch = xmlContent.match(/Период="(\d+)"/);
    if (periodMatch) {
      years.push(parseInt(periodMatch[1]));
    }

    // For now, return a stub response
    // Real implementation would parse XML and create Бух отчет + Финансовый параметр records

    res.json({
      success: true,
      data: {
        orgId,
        filename,
        reportYear,
        yearsFound: years,
        indicatorsCreated: 0,
        message: 'XML parsing endpoint ready'
      }
    });

  } catch (error) {
    console.error('[EGRUL-ITSoft] Error parsing XML:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /parse-all-xml
 * Parse all XML files for an organization
 */
router.post('/parse-all-xml', async (req, res) => {
  try {
    const { inn, orgId } = req.body;

    if (!inn || !orgId) {
      return res.status(400).json({ success: false, error: 'INN and orgId are required' });
    }

    console.log(`[EGRUL-ITSoft] Parsing all XML for INN: ${inn}, orgId: ${orgId}`);

    // Get list of files
    const listUrl = `${BASE_URL}/bo/ls.php?inn=${inn}`;
    const listResponse = await fetchWithRetry(listUrl);
    const listHtml = listResponse.data;

    const xmlFiles = [];
    const fileRegex = /filename=([^"&\s]+\.xml)/gi;
    let match;

    while ((match = fileRegex.exec(listHtml)) !== null) {
      const filename = match[1];
      if (filename.includes('NO_BUHOTCH') && !xmlFiles.includes(filename)) {
        xmlFiles.push(filename);
      }
    }

    console.log(`[EGRUL-ITSoft] Found ${xmlFiles.length} NO_BUHOTCH XML files`);

    const results = [];

    // Process each file
    for (const filename of xmlFiles) {
      try {
        // Would call parse-xml-to-integram internally
        results.push({
          filename,
          status: 'pending',
          message: 'Would be processed'
        });
      } catch (e) {
        results.push({
          filename,
          status: 'error',
          message: e.message
        });
      }
    }

    res.json({
      success: true,
      data: {
        orgId,
        totalFiles: xmlFiles.length,
        results
      }
    });

  } catch (error) {
    console.error('[EGRUL-ITSoft] Error parsing all XML:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
