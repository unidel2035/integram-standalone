/**
 * EGRUL Full Import API
 *
 * Полный автоматический импорт:
 * 1. Создание организации в Integram
 * 2. Запрос данных от ФНС
 * 3. Обновление данных организации
 * 4. Скачивание выписки ЕГРЮЛ
 * 5. Создание реквизитов (подчиненная таблица)
 */

import express from 'express';
import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import IntegramMCPClient from '../../services/mcp/IntegramMCPClient.js';
import { ProxyHttpClient } from '../../services/ProxyHttpClient.js';
import { extractAllFields, getOrganizationName } from '../../utils/egrulExtractor.js';
import pdfParse from 'pdf-parse';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const router = express.Router();
const httpClient = new ProxyHttpClient();

// Integram configuration
const INTEGRAM_CONFIG = {
  serverURL: process.env.INTEGRAM_SERVER_URL || 'https://dronedoc.ru',
  database: process.env.INTEGRAM_DATABASE || 'my',
  organizationTypeId: 197000,
  extractTypeId: 214618,
  innRequisiteId: 198195,
  // Requisite IDs for extract table (214618)
  extractRequisites: {
    date: 217787,      // Дата
    type: 217820,      // Тип выписки
    status: 217821,    // Статус
    data: 217823,      // Данные JSON
    source: 217825,    // Источник
    file: 217827       // Файл PDF
  }
};

/**
 * Download EGRUL extract PDF from official FNS service
 */
async function downloadExtract(inn, type = 'ul', format = 'pdf') {
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
    timeout: 60000, // Увеличен таймаут до 60 секунд для больших PDF
    headers: {
      'Accept': format === 'xml' ? 'application/xml' : 'application/pdf',
      'Referer': 'https://egrul.nalog.ru/'
    }
  });

  return {
    buffer: downloadResponse,
    size: downloadResponse.length,
    filename: `egrul_${inn}_${Date.now()}.${format}`
  };
}

/**
 * Full import: create org, fetch FNS data, update org, download extract, create requisites
 * POST /api/egrul-full-import
 * Body: { inn: '7708111656' }
 */
router.post('/', async (req, res) => {
  try {
    const { inn } = req.body;

    if (!inn) {
      return res.status(400).json({ success: false, error: 'INN is required' });
    }

    console.log(`[EGRUL Full Import] ========== Starting full import for INN: ${inn} ==========`);

    // Step 1: Authenticate with Integram using IntegramMCPClient
    console.log('[EGRUL Full Import] Step 1: Authenticating with Integram...');
    const integramClient = new IntegramMCPClient({
      serverURL: INTEGRAM_CONFIG.serverURL,
      database: INTEGRAM_CONFIG.database
    });

    await integramClient.authenticate(
      process.env.INTEGRAM_SYSTEM_USERNAME || 'd',
      process.env.INTEGRAM_SYSTEM_PASSWORD || 'd'
    );
    console.log('[EGRUL Full Import] ✅ Step 1 done: Authenticated');

    // Step 2: Create organization with minimal data
    console.log('[EGRUL Full Import] Step 2: Creating organization...');
    const createUrl = `${INTEGRAM_CONFIG.serverURL}/${INTEGRAM_CONFIG.database}/_m_new/${INTEGRAM_CONFIG.organizationTypeId}?JSON_KV`;
    const createFormData = new URLSearchParams();
    createFormData.append(`t${INTEGRAM_CONFIG.organizationTypeId}`, `Организация ${inn}`);
    createFormData.append('up', '1'); // Independent object
    createFormData.append('_xsrf', integramClient.xsrfToken);

    const createResponse = await axios.post(createUrl, createFormData, {
      headers: {
        'X-Authorization': integramClient.token,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      timeout: 30000
    });

    const orgId = createResponse.data?.id;
    if (!orgId) {
      throw new Error('Failed to create organization');
    }
    console.log(`[EGRUL Full Import] ✅ Step 2 done: Created organization ID ${orgId}`);

    // Step 3: Set INN requisite
    console.log('[EGRUL Full Import] Step 3: Setting INN requisite...');
    const setInnUrl = `${INTEGRAM_CONFIG.serverURL}/${INTEGRAM_CONFIG.database}/_m_set?JSON_KV`;
    const setInnFormData = new URLSearchParams();
    setInnFormData.append('id', orgId);
    setInnFormData.append(`r${INTEGRAM_CONFIG.innRequisiteId}`, inn);
    setInnFormData.append('_xsrf', integramClient.xsrfToken);

    await axios.post(setInnUrl, setInnFormData, {
      headers: {
        'X-Authorization': integramClient.token,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      timeout: 30000
    });
    console.log(`[EGRUL Full Import] ✅ Step 3 done: INN requisite set`);

    // Step 4: Request data from FNS (EGRUL API)
    console.log('[EGRUL Full Import] Step 4: Requesting data from FNS...');
    const apiUrl = 'http://localhost:8082/api';
    const egrulResponse = await axios.post(`${apiUrl}/egrul/search`, {
      query: inn,
      type: 'ul'
    }, {
      timeout: 60000
    });

    if (!egrulResponse.data.success || !egrulResponse.data.data) {
      throw new Error('Failed to fetch FNS data');
    }

    const fnsData = egrulResponse.data.data;
    const companyData = fnsData.company || fnsData;
    console.log(`[EGRUL Full Import] ✅ Step 4 done: Fetched FNS data for "${companyData.name || companyData.shortName}"`);

    // Step 5: Update organization with FNS data
    console.log('[EGRUL Full Import] Step 5: Updating organization name...');
    const updateFormData = new URLSearchParams();
    updateFormData.append('id', orgId);
    updateFormData.append(`t${INTEGRAM_CONFIG.organizationTypeId}`, companyData.name || companyData.shortName || `Организация ${inn}`);
    updateFormData.append('_xsrf', integramClient.xsrfToken);

    await axios.post(setInnUrl, updateFormData, {
      headers: {
        'X-Authorization': integramClient.token,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      timeout: 30000
    });
    console.log(`[EGRUL Full Import] ✅ Step 5 done: Updated organization name`);

    // Step 6: Download EGRUL extract PDF (for parsing requisites)
    console.log('[EGRUL Full Import] Step 6: Downloading EGRUL extract PDF...');
    let extractData = null;
    try {
      extractData = await downloadExtract(inn, 'ul', 'pdf');
      console.log(`[EGRUL Full Import] ✅ Step 6 done: Downloaded extract PDF (${extractData.size} bytes)`);
    } catch (err) {
      console.error('[EGRUL Full Import] Extract download failed:', err.message);
      // Continue even if extract download fails
    }

    // Step 7: Create extract record WITH REQUISITES (subordinate to organization)
    console.log('[EGRUL Full Import] Step 7: Creating extract record with requisites...');
    const createExtractUrl = `${INTEGRAM_CONFIG.serverURL}/${INTEGRAM_CONFIG.database}/_m_new/${INTEGRAM_CONFIG.extractTypeId}?JSON_KV`;
    const extractFormData = new URLSearchParams();
    extractFormData.append(`t${INTEGRAM_CONFIG.extractTypeId}`, `Выписка ЕГРЮЛ от ${new Date().toLocaleDateString('ru-RU')}`);
    extractFormData.append('up', orgId); // Subordinate to organization
    extractFormData.append('_xsrf', integramClient.xsrfToken);
    // Add requisites AT CREATION TIME
    extractFormData.append('t217787', new Date().toISOString().split('T')[0]); // Дата
    extractFormData.append('t217820', 'PDF'); // Тип выписки
    extractFormData.append('t217821', extractData ? 'Загружена' : 'Создана'); // Статус
    extractFormData.append('t217823', JSON.stringify(companyData || {})); // Данные JSON
    extractFormData.append('t217825', 'egrul.nalog.ru'); // Источник
    extractFormData.append('t217827', extractData?.filename || `extract_${inn}_${Date.now()}.pdf`); // Файл PDF

    const extractCreateResponse = await axios.post(createExtractUrl, extractFormData, {
      headers: {
        'X-Authorization': integramClient.token,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      timeout: 30000
    });

    const extractId = extractCreateResponse.data?.id;
    if (!extractId) {
      throw new Error('Failed to create extract record');
    }
    console.log(`[EGRUL Full Import] ✅ Step 7 done: Created extract record ID ${extractId} with requisites`);

    // Step 8: Save file to table 209402 (Загрузка)
    console.log('[EGRUL Full Import] Step 8: Saving file to table 209402...');

    // Step 8a: Create file object (without file yet)
    const fileObjectUrl = `${INTEGRAM_CONFIG.serverURL}/${INTEGRAM_CONFIG.database}/_m_new/209402?JSON_KV`;
    const fileFormData = new URLSearchParams();
    fileFormData.append('_xsrf', integramClient.xsrfToken);
    fileFormData.append('t209402', new Date().toISOString()); // DATETIME as object name
    fileFormData.append('up', orgId); // Parent organization
    fileFormData.append('t209407', `Выписка ЕГРЮЛ ИНН ${inn}`); // Имя
    fileFormData.append('t216159', 'Выписка из ЕГРЮЛ (PDF)'); // Описание

    const fileObjectResponse = await axios.post(fileObjectUrl, fileFormData, {
      headers: {
        'X-Authorization': integramClient.token,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      timeout: 30000
    });

    const fileObjectId = fileObjectResponse.data?.id;
    if (!fileObjectId) {
      throw new Error('Failed to create file object');
    }
    console.log(`[EGRUL Full Import] Step 8a: File object created ID ${fileObjectId}`);

    // Step 8b: Upload PDF file if we have it
    if (extractData && extractData.buffer) {
      console.log('[EGRUL Full Import] Step 8b: Uploading PDF file...');
      const uploadFormData = new FormData();
      uploadFormData.append('_xsrf', integramClient.xsrfToken);
      uploadFormData.append('t209405', extractData.buffer, {
        filename: extractData.filename,
        contentType: 'application/pdf'
      });

      const uploadUrl = `${INTEGRAM_CONFIG.serverURL}/${INTEGRAM_CONFIG.database}/_m_set/${fileObjectId}?JSON_KV`;
      await axios.post(uploadUrl, uploadFormData, {
        headers: {
          'X-Authorization': integramClient.token,
          ...uploadFormData.getHeaders()
        },
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
        timeout: 60000
      });
      console.log(`[EGRUL Full Import] ✅ Step 8 done: File object created and PDF uploaded ID ${fileObjectId}`);
    } else {
      console.log(`[EGRUL Full Import] ⚠️  Step 8 done: File object created ID ${fileObjectId} (PDF not available)`);
    }

    // Step 9: Parse EGRUL data and create requisites in table 209592
    console.log('[EGRUL Full Import] Step 9: Parsing EGRUL data and creating requisites...');
    let requisitesSaved = 0;
    let requisitesSkipped = 0;
    let allFields = {}; // Declare here so it's accessible in Step 10

    try {
      // Step 9a: Parse PDF from downloaded extract
      console.log('[EGRUL Full Import] Step 9a: Parsing PDF from downloaded extract...');

      if (!extractData || !extractData.buffer) {
        throw new Error('No extract data available to parse');
      }

      // Parse PDF to text
      const pdfData = await pdfParse(extractData.buffer);
      const pdfText = pdfData.text;
      console.log(`[EGRUL Full Import] PDF parsed: ${pdfText.length} characters`);

      // Extract fields from PDF text using regex
      // (allFields already declared above)

      // Basic function to extract text between markers
      const extractBetween = (text, startMarker, endMarker) => {
        const regex = new RegExp(`${startMarker}[\\s:]*([^\\n]+?)${endMarker ? `\\s*${endMarker}` : '$'}`, 'i');
        const match = text.match(regex);
        return (match && match[1]) ? match[1].trim() : null;
      };

      // Extract simple field by label
      const extractField = (text, label) => {
        const regex = new RegExp(`${label}[\\s:]+([^\\n]+)`, 'i');
        const match = text.match(regex);
        return (match && match[1]) ? match[1].trim() : null;
      };

      // 214633: Дата выписки
      allFields['214633'] = extractField(pdfText, 'Дата формирования выписки|Дата выписки') ||
                            extractField(pdfText, 'от') ||
                            new Date().toISOString().split('T')[0];

      // 214634: ОГРН
      allFields['214634'] = extractField(pdfText, 'ОГРН') || companyData.ogrn;

      // 214635: Дата присвоения ОГРН
      allFields['214635'] = extractField(pdfText, 'Дата присвоения ОГРН|зарегистрирован');

      // 214636: ИНН
      allFields['214636'] = inn;

      // 214637: КПП
      allFields['214637'] = extractField(pdfText, 'КПП') || companyData.kpp;

      // 214638: Код ОПФ
      allFields['214638'] = extractField(pdfText, 'Код по ОКОПФ');

      // 214639: Полное наименование ОПФ
      const opfMatch = pdfText.match(/Организационно-правовая форма[:\s]+([\s\S]+?)(?=ИНН|ОГРН|Полное наименование)/i);
      allFields['214639'] = opfMatch ? opfMatch[1].trim() : null;

      // 214640: Полное наименование организации
      allFields['214640'] = companyData.name || extractField(pdfText, 'Полное наименование');

      // 214641: Сокращенное наименование
      allFields['214641'] = companyData.shortName || extractField(pdfText, 'Сокращенное наименование');

      // 214642-214649: Адрес (комплексное извлечение)
      const addressMatch = pdfText.match(/Адрес[\s\S]+?(\d{6})[,\s]+(.+?)(?=Сведения|Дата|$)/i);
      if (addressMatch) {
        allFields['214642'] = addressMatch[1]; // Индекс
        allFields['214649'] = addressMatch[2].trim(); // Полный адрес
      } else {
        allFields['214649'] = companyData.address;
      }

      // 214650: Регистрационный номер
      allFields['214650'] = extractField(pdfText, 'Регистрационный номер|ГРН');

      // 214651: Дата регистрации
      allFields['214651'] = extractField(pdfText, 'Дата регистрации');

      // 214652: Наименование регистрирующего органа
      allFields['214652'] = extractField(pdfText, 'Наименование регистрирующего органа');

      // 214658: Дата постановки на учет
      allFields['214658'] = extractField(pdfText, 'Дата постановки на учет');

      // 214659-214660: Налоговый орган
      allFields['214659'] = extractField(pdfText, 'Код налогового органа');
      allFields['214660'] = extractField(pdfText, 'Наименование налогового органа');

      // 214669-214670: Уставный капитал
      const capitalMatch = pdfText.match(/Уставный капитал[:\s]+([\d\s,\.]+)/i);
      if (capitalMatch) {
        allFields['214670'] = capitalMatch[1].replace(/\s/g, '').trim();
      }

      // 214671-214676: Руководитель (ФИО и должность)
      const directorMatch = pdfText.match(/Директор|Генеральный директор|Руководитель[:\s]+([А-ЯЁ][а-яё]+)\s+([А-ЯЁ][а-яё]+)\s+([А-ЯЁ][а-яё]+)?/i);
      if (directorMatch) {
        allFields['214671'] = directorMatch[1]; // Фамилия
        allFields['214672'] = directorMatch[2]; // Имя
        allFields['214673'] = directorMatch[3] || null; // Отчество
      }

      const positionMatch = pdfText.match(/(Генеральный директор|Директор|Председатель|Управляющий)/i);
      allFields['214676'] = positionMatch ? positionMatch[1] : 'Директор';

      // 214682-214683: ОКВЭД
      const okvedMatch = pdfText.match(/ОКВЭД[:\s]+([\d\.]+)[,\s]+([^\n]+)/i);
      if (okvedMatch) {
        allFields['214682'] = okvedMatch[1]; // Код ОКВЭД
        allFields['214683'] = okvedMatch[2].trim(); // Наименование
      }

      // 214687-214691: Служебные поля
      allFields['214687'] = 'egrul.nalog.ru (PDF)';
      allFields['214688'] = new Date().toISOString();
      allFields['214689'] = companyData.status || 'Действующая';
      allFields['214690'] = JSON.stringify(companyData).substring(0, 50000);
      allFields['214691'] = companyData.status !== 'Ликвидирована' ? 'Да' : 'Нет';

      console.log('[EGRUL Full Import] ✅ Step 9a done: Extracted fields from PDF');
      console.log(`[EGRUL Full Import] Extracted ${Object.keys(allFields).filter(k => allFields[k]).length} non-empty fields`);

      // Step 9c: Delete existing EGRUL requisites for this organization to avoid duplicates
      console.log('[EGRUL Full Import] Step 9c: Deleting old requisites...');
      try {
        const existingReqsUrl = `${INTEGRAM_CONFIG.serverURL}/${INTEGRAM_CONFIG.database}/_d_list/209592?JSON_KV`;
        const existingReqsParams = new URLSearchParams();
        existingReqsParams.append('F_U', orgId); // Filter by parent (organization) ID
        existingReqsParams.append('_xsrf', integramClient.xsrfToken);

        const existingReqsResponse = await axios.post(existingReqsUrl, existingReqsParams.toString(), {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'X-Authorization': integramClient.token
          },
          timeout: 30000
        });

        const existingReqs = existingReqsResponse.data?.object || [];
        for (const req of existingReqs) {
          const deleteUrl = `${INTEGRAM_CONFIG.serverURL}/${INTEGRAM_CONFIG.database}/_m_delete/${req.id}?JSON_KV`;
          const deleteParams = new URLSearchParams();
          deleteParams.append('_xsrf', integramClient.xsrfToken);

          await axios.post(deleteUrl, deleteParams.toString(), {
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              'X-Authorization': integramClient.token
            },
            timeout: 30000
          }).catch(err => {
            console.warn(`[EGRUL Full Import] Failed to delete old requisite ${req.id}:`, err.message);
          });
        }

        if (existingReqs.length > 0) {
          console.log(`[EGRUL Full Import] ✅ Step 9c done: Deleted ${existingReqs.length} old requisites`);
        } else {
          console.log('[EGRUL Full Import] Step 9c: No old requisites to delete');
        }
      } catch (err) {
        console.warn('[EGRUL Full Import] Failed to clean up old requisites (non-critical):', err.message);
      }

      // Step 9d: Create ALL 59 ЕГРЮЛ requisites in Реквизит table (209592)
      console.log('[EGRUL Full Import] Step 9d: Creating requisites in table 209592...');

      for (const [paramId, value] of Object.entries(allFields)) {
        if (!value || value === 'null' || value === '') {
          requisitesSkipped++;
          continue; // Skip empty values
        }

        const reqUrl = `${INTEGRAM_CONFIG.serverURL}/${INTEGRAM_CONFIG.database}/_m_new/209592?JSON_KV`;
        const reqData = new URLSearchParams();
        reqData.append('_xsrf', integramClient.xsrfToken);
        reqData.append('t209592', String(value).substring(0, 100)); // Название объекта (короткое)
        reqData.append('t209595', paramId); // Параметр API (reference to 209590)
        reqData.append('t209597', String(value)); // Значение (MEMO - полные данные)
        reqData.append('up', orgId); // Subordinate to organization

        await axios.post(reqUrl, reqData.toString(), {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'X-Authorization': integramClient.token
          },
          timeout: 30000
        }).then(() => {
          requisitesSaved++;
        }).catch(err => {
          console.warn(`[EGRUL Full Import] Failed to create requisite ${paramId}:`, err.message);
          requisitesSkipped++;
        });
      }

      console.log(`[EGRUL Full Import] ✅ Step 9 done: Created ${requisitesSaved} requisites, skipped ${requisitesSkipped}`);
    } catch (err) {
      console.error('[EGRUL Full Import] Step 9 failed:', err.message);
      console.error('[EGRUL Full Import] Step 9 error stack:', err.stack);
      // Continue even if requisite parsing fails
    }

    // Step 10: Update organization main fields from parsed data
    console.log('[EGRUL Full Import] Step 10: Updating organization fields...');
    let fieldsUpdated = 0;
    try {
      if (!allFields || Object.keys(allFields).length === 0) {
        console.log('[EGRUL Full Import] Step 10: No parsed fields available, skipping');
      } else {
        // Organization field mapping: paramId → organizationFieldId
        const fieldMapping = {
          '214634': 198239,  // ОГРН
          '214636': 198195,  // ИНН
          '214637': 198266,  // КПП
          '214640': 197004,  // Полное наименование → TITLE
          '214641': 198267,  // Краткое наименование
          '214649': 198268,  // Полный адрес
          '214642': 198269,  // Почтовый индекс
          '214651': 198270,  // Дата регистрации
          '214670': 198271,  // Уставный капитал
          '214676': 198273,  // Должность руководителя
          '214639': 198291,  // Правовая форма
        };

        // Special handling: Concatenate director's name
        const lastName = allFields['214671'];   // Фамилия
        const firstName = allFields['214672'];  // Имя
        const middleName = allFields['214673']; // Отчество
        let ceoFullName = null;
        if (lastName || firstName) {
          ceoFullName = [lastName, firstName, middleName].filter(Boolean).join(' ');
        }

        // Special handling: Map status text to status ID
        const statusText = allFields['214689']; // "Действующая" or "Ликвидирована"
        let statusId = null;
        if (statusText) {
          if (statusText.includes('Действующ')) {
            statusId = '198202'; // Действующее
          } else if (statusText.includes('Ликвид')) {
            statusId = '198203'; // Ликвидировано
          }
        }

        // Update organization with mapped fields
        const updateOrgUrl = `${INTEGRAM_CONFIG.serverURL}/${INTEGRAM_CONFIG.database}/_m_set/${orgId}?JSON_KV`;
        const updateData = new URLSearchParams();
        updateData.append('_xsrf', integramClient.xsrfToken);

        // Map fields from allFields to organization table fields
        for (const [paramId, orgFieldId] of Object.entries(fieldMapping)) {
          const value = allFields[paramId];
          if (value && value !== '' && value !== 'null') {
            updateData.append(`t${orgFieldId}`, String(value).substring(0, 500));
            fieldsUpdated++;
          }
        }

        // Add CEO name if available
        if (ceoFullName) {
          updateData.append('t198272', ceoFullName.substring(0, 500));
          fieldsUpdated++;
        }

        // Add status if available
        if (statusId) {
          updateData.append('t198277', statusId);
          fieldsUpdated++;
        }

        if (fieldsUpdated > 0) {
          await axios.post(updateOrgUrl, updateData.toString(), {
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              'X-Authorization': integramClient.token
            },
            timeout: 30000
          });
          console.log(`[EGRUL Full Import] ✅ Step 10 done: Updated ${fieldsUpdated} organization fields`);
        }
      }
    } catch (err) {
      console.error('[EGRUL Full Import] Step 10 failed:', err.message);
      // Continue even if field update fails
    }

    // Success!
    console.log(`[EGRUL Full Import] ========== ✅ Full import completed successfully! ==========`);
    console.log(`[EGRUL Full Import] Organization ID: ${orgId}, Extract ID: ${extractId}, File ID: ${fileObjectId}`);

    return res.json({
      success: true,
      data: {
        orgId,
        extractId,
        fileObjectId,
        companyName: companyData.name || companyData.shortName,
        inn,
        extractDownloaded: !!extractData,
        requisitesSaved,
        requisitesSkipped,
        fieldsUpdated
      }
    });

  } catch (error) {
    console.error('[EGRUL Full Import] Error:', error.message);
    return res.status(500).json({
      success: false,
      error: 'Full import failed',
      details: error.message
    });
  }
});

export default router;
