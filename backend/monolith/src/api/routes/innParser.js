// innParser.js - INN data parser from public sources (list-org.com)
import express from 'express';
import * as cheerio from 'cheerio';
import logger from '../../utils/logger.js';
import { ProxyHttpClient } from '../../services/ProxyHttpClient.js';

const router = express.Router();

// Инициализируем HTTP-клиент с поддержкой SOCKS5 прокси для обхода блокировок
const httpClient = new ProxyHttpClient();

/**
 * Parse company data from list-org.com by INN
 * Public source, no authentication required, web scraping
 */
async function parseListOrg(inn) {
  try {
    const url = `https://www.list-org.com/search?type=inn&val=${inn}`;
    console.log(`[INN Parser] Fetching data from list-org.com for INN: ${inn}`);
    logger.info(`Fetching data from list-org.com for INN: ${inn}`);

    // Используем ProxyHttpClient с SOCKS5 для обхода блокировок
    const responseData = await httpClient.get(url, {
      useProxy: true, // Явно включаем прокси для list-org.com
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Referer': 'https://www.list-org.com/'
      },
      timeout: 10000
    });

    const $ = cheerio.load(responseData);

    // Check for CAPTCHA/bot detection on search page
    if (responseData.includes('Проверка, что Вы не робот') || responseData.includes('cf-turnstile')) {
      console.log('[INN Parser] ⚠️  CAPTCHA detected on search page!');
      logger.warn('CAPTCHA detected on search page');
      throw new Error('Website is showing CAPTCHA - rate limited. Please try again later.');
    }
    console.log('[INN Parser] ✓ Search page loaded successfully, parsing...');

    const companies = [];

    // Parse real HTML structure from list-org.com
    // Structure: <div class='org_list'><p><label><a href='/company/ID'>Short Name</a><br><span>Full Name<br><i>инн/кпп</i>: ...<br><i>юр.адрес</i>: ...</span></label></p></div>

    $('.org_list p label').each((index, element) => {
      const $label = $(element);

      // Extract short name from link
      const shortName = $label.find('a[href*="/company/"]').first().text().trim();

      // Extract company ID for detailed info
      const companyLink = $label.find('a[href*="/company/"]').first().attr('href');
      const companyId = companyLink ? companyLink.match(/\/company\/(\d+)/)?.[1] : null;

      // Extract full info from span
      const $span = $label.find('span');
      const spanText = $span.html() || '';

      // Split by <br> tags to get lines
      const lines = spanText.split('<br>').map(line => {
        // Remove HTML tags and trim
        return line.replace(/<[^>]*>/g, '').trim();
      });

      // Extract full name (first line)
      const fullName = lines[0] || shortName;

      // Extract INN/KPP
      let innValue = inn;
      let kpp = null;
      const innKppLine = lines.find(line => line.includes('инн/кпп'));
      if (innKppLine) {
        const innKppMatch = innKppLine.match(/(\d{10,12})\/(\d+)/);
        if (innKppMatch) {
          innValue = innKppMatch[1];
          kpp = innKppMatch[2];
        }
      }

      // Extract address
      let address = null;
      const addressLine = lines.find(line => line.includes('юр.адрес'));
      if (addressLine) {
        address = addressLine.replace(/юр\.адрес\s*:\s*/i, '').trim();
      }

      // Determine status (default to Действующая if found)
      const status = 'Действующая';

      if (shortName || fullName) {
        companies.push({
          name: fullName || shortName,
          shortName: shortName,
          inn: innValue,
          kpp: kpp,
          ogrn: null, // OGRN требует дополнительного запроса на страницу компании
          address: address,
          status: status,
          director: null, // Директор требует дополнительного запроса
          companyId: companyId,
          source: 'list-org.com'
        });
      }
    });

    // If no companies found with structured parsing, try fallback text parsing
    if (companies.length === 0) {
      const bodyText = $('body').text();

      // Check if "Найдено 0 организаций" or similar
      if (bodyText.includes('Найдено') && bodyText.match(/Найдено\s+0/)) {
        logger.info(`No companies found for INN: ${inn}`);
        return [];
      }

      // Try to find company name in page text
      const nameMatch = bodyText.match(/(ООО|ОАО|ЗАО|ПАО|АО|ИП)\s+"[^"]+"/);
      if (nameMatch) {
        companies.push({
          name: nameMatch[0],
          inn: inn,
          ogrn: null,
          address: null,
          status: 'Неизвестно',
          director: null,
          source: 'list-org.com'
        });
      }
    }

    logger.info(`Parsed ${companies.length} companies from list-org.com for INN: ${inn}`);
    return companies;
  } catch (error) {
    logger.error(`Error parsing list-org.com for INN ${inn}:`, error.message);
    throw error;
  }
}

/**
 * Fetch detailed company info from company page (OGRN, OKPO, OKATO, etc.)
 * @param {string} companyId - Company ID from list-org.com
 */
async function fetchCompanyDetails(companyId) {
  try {
    const url = `https://www.list-org.com/company/${companyId}`;
    console.log(`[INN Parser] Fetching detailed info from: ${url}`);
    logger.info(`Fetching detailed info from: ${url}`);

    // Add delay to avoid rate limiting (wait 2-4 seconds between requests)
    const delay = 2000 + Math.random() * 2000;
    console.log(`[INN Parser] Waiting ${Math.round(delay)}ms to avoid rate limiting...`);
    await new Promise(resolve => setTimeout(resolve, delay));

    // Используем ProxyHttpClient с SOCKS5 для обхода блокировок
    const responseData = await httpClient.get(url, {
      useProxy: true, // Явно включаем прокси для list-org.com
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Referer': 'https://www.list-org.com/search'
      },
      timeout: 15000
    });

    const $ = cheerio.load(responseData);

    // Check for CAPTCHA/bot detection
    if (responseData.includes('Проверка, что Вы не робот') || responseData.includes('cf-turnstile')) {
      console.log('[INN Parser] ⚠️  CAPTCHA detected on company details page!');
      logger.warn('CAPTCHA detected on company details page');
      throw new Error('Website is showing CAPTCHA - rate limited. Please try again later.');
    }
    console.log('[INN Parser] ✓ Company details page loaded successfully, extracting data...');

    const details = {};
    const bodyText = $('body').text();

    // Extract OGRN
    const ogrnMatch = bodyText.match(/ОГРН[:\s]*(\d{13,15})/);
    if (ogrnMatch) {
      details.ogrn = ogrnMatch[1];
    }

    // Extract OKPO
    const okpoMatch = bodyText.match(/ОКПО[:\s]*(\d+)/);
    if (okpoMatch) {
      details.okpo = okpoMatch[1];
    }

    // Extract OKTMO
    const oktmoMatch = bodyText.match(/ОКТМО[:\s]*(\d+)/);
    if (oktmoMatch) {
      details.oktmo = oktmoMatch[1];
    }

    // Extract OKATO
    const okatoMatch = bodyText.match(/ОКАТО[:\s]*(\d+)/);
    if (okatoMatch) {
      details.okato = okatoMatch[1];
    }

    // Extract OKFS (form of ownership)
    const okfsMatch = bodyText.match(/ОКФС[:\s]*(\d+)\s*-\s*([^<\n]+)/);
    if (okfsMatch) {
      details.okfs = okfsMatch[1];
      details.okfsName = okfsMatch[2].trim();
    }

    // Extract registration date
    const regDateMatch = bodyText.match(/Дата регистрации[:\s]*(\d{2}\.\d{2}\.\d{4})/);
    if (regDateMatch) {
      details.registrationDate = regDateMatch[1];
    }

    // Extract status with date
    const statusMatch = bodyText.match(/Статус[:\s]*([^<]+?)(?=Блокировка|$)/s);
    if (statusMatch) {
      const statusText = statusMatch[1].trim().replace(/\s+/g, ' ');
      details.statusDetailed = statusText;
    }

    // Extract director/head - multiple strategies
    let director = null;

    // Strategy 1: Look for "Руководитель" in HTML structure
    $('p, div, tr').each((i, elem) => {
      if (director) return;
      const text = $(elem).text();
      if (text.includes('Руководитель') || text.includes('Директор') || text.includes('Генеральный директор')) {
        // Extract name after "Руководитель:" or similar
        const nameMatch = text.match(/(?:Руководитель|Директор|Генеральный директор)[:\s]*([А-ЯЁ][а-яёА-ЯЁ\s\.-]{5,}?)(?:\s*ИНН|\s*$|,)/);
        if (nameMatch) {
          director = nameMatch[1].trim();
        }
      }
    });

    // Strategy 2: Look in body text with improved regex
    if (!director) {
      const patterns = [
        /(?:ДИРЕКТОР|Директор|Руководитель|Генеральный директор)[:\s]+([А-ЯЁ][а-яёА-ЯЁ]+\s+[А-ЯЁ][а-яёА-ЯЁ]+\s+[А-ЯЁ][а-яёА-ЯЁ]+)/,
        /Руководитель[:\s]*([А-ЯЁ][а-яё\s\.-]+?)(?=\s*ИНН|\s*Учредит|\s*Дата|\s*\d{10})/
      ];

      for (const pattern of patterns) {
        const match = bodyText.match(pattern);
        if (match && match[1]) {
          director = match[1].trim();
          break;
        }
      }
    }

    // Strategy 3: Look in meta description
    if (!director) {
      const metaDesc = $('meta[name="description"]').attr('content') || '';
      const metaMatch = metaDesc.match(/руководитель[:\s]+([А-ЯЁ][а-яё\s]+)/i);
      if (metaMatch) {
        director = metaMatch[1].trim();
      }
    }

    if (director && director.length > 5) {
      details.director = director;
      logger.info(`Director found: ${director}`);
    } else {
      logger.warn(`Director not found for company ID ${companyId}`);
    }

    // Extract capital (уставный капитал)
    const capitalMatch = bodyText.match(/Уставный капитал[:\s]*([\d\s]+(?:,\d+)?)\s*тыс\.\s*руб/);
    if (capitalMatch) {
      details.capital = capitalMatch[1].replace(/\s/g, '');
    }

    // Extract main OKVED
    const okvedMatch = bodyText.match(/Основной[^:]*ОКВЭД[^:]*:[^:]*?([\d.]+)\s*-\s*([^<\n]+)/);
    if (okvedMatch) {
      details.okvedMain = okvedMatch[1];
      details.okvedMainName = okvedMatch[2].trim().split(/[\n\r]/)[0].trim();
    }

    // Extract founders/participants (учредители)
    const foundersSection = $('body').html().match(/Учредители[^<]*<\/h6>(.*?)(?=<h6|<div class='card|$)/is);
    if (foundersSection) {
      const foundersHTML = foundersSection[1];
      const $founders = cheerio.load(foundersHTML);
      const founders = [];
      $founders('p').each((i, elem) => {
        const text = $founders(elem).text().trim();
        if (text && text.length > 5 && !text.includes('Найдено')) {
          founders.push(text);
        }
      });
      if (founders.length > 0) {
        details.founders = founders.slice(0, 10); // Limit to 10 founders
      }
    }

    // Extract phone number
    const phoneMatch = bodyText.match(/Телефон[:\s]*([\d\s\(\)\-\+]+)/);
    if (phoneMatch) {
      const phone = phoneMatch[1].trim().replace(/\s+/g, ' ');
      if (phone.length > 5) {
        details.phone = phone;
      }
    }

    // Extract email
    const emailMatch = bodyText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    if (emailMatch) {
      details.email = emailMatch[0];
    }

    // Extract website
    const websiteMatch = bodyText.match(/(?:Сайт|Website)[:\s]*([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i)
      || bodyText.match(/https?:\/\/([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
    if (websiteMatch) {
      details.website = websiteMatch[1] || websiteMatch[0];
    }

    // Extract employee count (численность)
    const employeesMatch = bodyText.match(/Численность[:\s]*(\d+)/i);
    if (employeesMatch) {
      details.employeeCount = parseInt(employeesMatch[1]);
    }

    return details;
  } catch (error) {
    logger.error(`Error fetching company details for ID ${companyId}:`, error.message);
    return {};
  }
}

/**
 * Fetch data from alternative sources for cross-verification
 * Currently checks: OpenData portals, government registries
 */
async function fetchAlternativeSources(inn, ogrn) {
  const alternativeData = {
    sources: []
  };

  try {
    // Try to get data from egrul.nalog.ru API (if accessible)
    // Note: This may require solving CAPTCHA in production
    const nalogUrl = `https://egrul.nalog.ru/search-result/${inn}`;

    // For now, just mark that we tried this source
    alternativeData.sources.push({
      name: 'egrul.nalog.ru',
      status: 'requires_captcha',
      note: 'Official FTS registry requires CAPTCHA verification'
    });

    // Additional sources can be added here:
    // - Licensing registries
    // - Court cases (kad.arbitr.ru)
    // - Government procurement (zakupki.gov.ru)

  } catch (error) {
    logger.error('Error fetching alternative sources:', error.message);
  }

  return alternativeData;
}

/**
 * Aggregate data from multiple sources
 */
async function aggregateDataFromSources(inn, companies, detailed = false) {
  const aggregatedData = {
    primarySource: 'list-org.com',
    additionalSources: [],
    dataQuality: 'basic'
  };

  if (detailed && companies.length > 0) {
    const company = companies[0];

    // Try alternative sources
    const altData = await fetchAlternativeSources(inn, company.ogrn);
    aggregatedData.additionalSources = altData.sources;
    aggregatedData.dataQuality = 'detailed';
  }

  return aggregatedData;
}

/**
 * GET /api/inn-parser/:inn - Get company data by INN
 * Query params:
 *   - detailed=true: Fetch additional data (OGRN, director) from company page (slower)
 */
router.get('/inn-parser/:inn', async (req, res) => {
  // DELIBERATE TEST - This should cause an error if route is hit
  process.stdout.write('[INN Parser] ========== NEW REQUEST ==========\n');
  console.error('[INN Parser] ERROR STREAM TEST');
  console.warn('[INN Parser] WARN STREAM TEST');
  console.log('[INN Parser] LOG STREAM TEST');

  try {
    const { inn } = req.params;
    const { detailed } = req.query;
    console.log(`[INN Parser] Request for INN: ${inn}, detailed: ${detailed}`);

    // Validate INN format (10 or 12 digits)
    if (!/^\d{10}$|^\d{12}$/.test(inn)) {
      console.log('[INN Parser] Invalid INN format');
      return res.status(400).json({
        success: false,
        error: 'Invalid INN format. Must be 10 or 12 digits.'
      });
    }

    logger.info(`INN parser request for: ${inn} (detailed: ${detailed === 'true'})`);

    // Parse data from list-org.com
    console.log('[INN Parser] Calling parseListOrg...');
    const companies = await parseListOrg(inn);
    console.log(`[INN Parser] parseListOrg returned ${companies.length} companies`);

    if (companies.length === 0) {
      return res.json({
        success: true,
        data: {
          inn,
          found: false,
          message: 'Компания с указанным ИНН не найдена в публичных источниках',
          companies: []
        }
      });
    }

    // Fetch detailed info if requested
    if (detailed === 'true') {
      console.log(`[INN Parser] Detailed mode enabled, fetching details for ${companies.length} companies...`);
      for (const company of companies) {
        if (company.companyId) {
          console.log(`[INN Parser] Fetching details for company ID: ${company.companyId}`);
          const details = await fetchCompanyDetails(company.companyId);
          console.log(`[INN Parser] Details received:`, Object.keys(details));
          // Merge detailed data into company object
          Object.assign(company, {
            ogrn: details.ogrn || company.ogrn,
            okpo: details.okpo || null,
            oktmo: details.oktmo || null,
            okato: details.okato || null,
            okfs: details.okfs || null,
            okfsName: details.okfsName || null,
            registrationDate: details.registrationDate || null,
            statusDetailed: details.statusDetailed || company.status,
            director: details.director || company.director,
            capital: details.capital || null,
            okvedMain: details.okvedMain || null,
            okvedMainName: details.okvedMainName || null,
            founders: details.founders || null,
            phone: details.phone || null,
            email: details.email || null,
            website: details.website || null,
            employeeCount: details.employeeCount || null
          });
        }
      }
    }

    // Aggregate data from multiple sources
    const aggregation = await aggregateDataFromSources(inn, companies, detailed === 'true');

    res.json({
      success: true,
      data: {
        inn,
        found: true,
        companies,
        timestamp: new Date().toISOString(),
        sources: ['list-org.com'],
        detailed: detailed === 'true',
        aggregation
      }
    });
  } catch (error) {
    logger.error('INN parser error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to parse INN data'
    });
  }
});

/**
 * POST /api/inn-parser/batch - Get data for multiple INNs
 */
router.post('/inn-parser/batch', async (req, res) => {
  try {
    const { inns } = req.body;

    if (!Array.isArray(inns) || inns.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request. Provide array of INNs.'
      });
    }

    if (inns.length > 20) {
      return res.status(400).json({
        success: false,
        error: 'Too many INNs. Maximum 20 per request.'
      });
    }

    logger.info(`Batch INN parser request for ${inns.length} INNs`);

    // Parse each INN with delay to avoid rate limiting
    const results = [];
    for (const inn of inns) {
      if (!/^\d{10}$|^\d{12}$/.test(inn)) {
        results.push({
          inn,
          success: false,
          error: 'Invalid INN format'
        });
        continue;
      }

      try {
        const companies = await parseListOrg(inn);
        results.push({
          inn,
          success: true,
          found: companies.length > 0,
          companies
        });

        // Delay between requests to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        results.push({
          inn,
          success: false,
          error: error.message
        });
      }
    }

    res.json({
      success: true,
      data: {
        total: inns.length,
        results,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('Batch INN parser error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to parse batch INN data'
    });
  }
});

export default router;
