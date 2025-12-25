/**
 * FSSP Web Parser - неофициальный парсер сайта ФССП
 *
 * Парсит публичный поиск ФССП по ИНН без использования официального API
 * Источник: https://fssp.gov.ru/iss/ip/
 *
 * ВАЖНО: Это неофициальный парсер, может перестать работать при изменении сайта
 */

import { chromium } from 'playwright';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const FSSP_SEARCH_URL = 'https://fssp.gov.ru/iss/ip/';

/**
 * Search FSSP by INN using web scraping
 * @param {string} inn - Company INN (10 digits)
 * @returns {Promise<Object>} Search result
 */
export async function searchByINNWeb(inn) {
  let browser = null;

  try {
    console.log(`[FSSP Parser] Searching for INN: ${inn}`);

    // Launch browser
    const launchOptions = {
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    };

    // Add proxy if configured
    const proxyUrl = process.env.SOCKS5_PROXY_URL || process.env.HTTP_PROXY;
    if (proxyUrl) {
      console.log(`[FSSP Parser] Using proxy: ${proxyUrl.replace(/\/\/.*@/, '//*****@')}`);
      launchOptions.proxy = { server: proxyUrl };
    }

    browser = await chromium.launch(launchOptions);

    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      locale: 'ru-RU'
    });

    const page = await context.newPage();

    // Navigate to search page
    await page.goto(FSSP_SEARCH_URL, {
      waitUntil: 'networkidle',
      timeout: 60000
    });

    console.log('[FSSP Parser] Page loaded, waiting for form to render...');

    // Wait for page to fully load (sometimes fields are hidden by CSS initially)
    await page.waitForTimeout(2000);

    // Fill search form - FSSP uses simple text input with name="string"
    const searchInput = page.locator('input[name="string"]');
    await searchInput.fill(inn, { force: true });

    // Submit search by pressing Enter (button may be hidden by CSS)
    await searchInput.press('Enter');

    console.log('[FSSP Parser] Search submitted, waiting for results...');

    // Wait for results or no results message
    await page.waitForTimeout(3000);

    // Check for "no results" message
    const noResultsText = await page.locator('text=/не найдено|ничего не найдено|нет результатов/i').count();

    if (noResultsText > 0) {
      console.log('[FSSP Parser] No results found');
      return {
        success: true,
        result: [],
        totalFound: 0,
        message: 'Исполнительные производства не найдены',
        source: 'fssp.gov.ru (web parser)',
        timestamp: new Date().toISOString()
      };
    }

    // Parse results table
    const results = [];

    // Пытаемся найти таблицу результатов
    const rows = await page.locator('table tr, .result-item, .ip-item').all();

    console.log(`[FSSP Parser] Found ${rows.length} rows`);

    for (const row of rows) {
      try {
        const text = await row.textContent();

        // Пропускаем заголовки и пустые строки
        if (!text || text.includes('№ ИП') || text.trim().length < 10) {
          continue;
        }

        // Извлекаем данные (примерный парсинг, нужно адаптировать под реальный HTML)
        const ipNumberMatch = text.match(/(\d+-\d+\/\d+\/\d+-ИП)/);
        const sumMatch = text.match(/(\d+[\s,]?\d*\.?\d*)\s*(?:руб|₽)/i);
        const dateMatch = text.match(/(\d{2}\.\d{2}\.\d{4})/);

        if (ipNumberMatch || sumMatch) {
          results.push({
            ip_number: ipNumberMatch ? ipNumberMatch[1] : null,
            ip_subject: 'Исполнительное производство', // Заглушка
            ip_sum: sumMatch ? sumMatch[1].replace(/\s/g, '') : '0',
            ip_date: dateMatch ? dateMatch[1] : null,
            department: 'УФССП', // Заглушка
            bailiff: null,
            details: text.trim().substring(0, 200)
          });
        }
      } catch (err) {
        console.error('[FSSP Parser] Error parsing row:', err);
      }
    }

    console.log(`[FSSP Parser] Parsed ${results.length} results`);

    // Если ничего не распарсили, но страница загрузилась - возвращаем пустой массив
    if (results.length === 0) {
      // Попробуем получить хоть какой-то текст со страницы для диагностики
      const pageText = await page.locator('body').textContent();
      console.log('[FSSP Parser] Page text sample:', pageText.substring(0, 500));

      return {
        success: true,
        result: [],
        totalFound: 0,
        message: 'Не удалось распарсить результаты. Возможно, изменилась структура сайта.',
        source: 'fssp.gov.ru (web parser)',
        timestamp: new Date().toISOString(),
        debug: {
          pageTextSample: pageText.substring(0, 500)
        }
      };
    }

    return {
      success: true,
      result: results,
      totalFound: results.length,
      source: 'fssp.gov.ru (web parser)',
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    console.error('[FSSP Parser] Error:', error);

    return {
      success: false,
      error: 'Ошибка парсинга сайта ФССП',
      details: error.message
    };
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * Search by person name (физическое лицо)
 * @param {Object} params - Search parameters
 * @returns {Promise<Object>} Search result
 */
export async function searchByPersonWeb({ lastName, firstName, middleName, birthDate, region }) {
  let browser = null;

  try {
    console.log(`[FSSP Parser] Searching for person: ${lastName} ${firstName}`);

    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      locale: 'ru-RU'
    });

    const page = await context.newPage();

    await page.goto(FSSP_SEARCH_URL, {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    // Fill person search form
    await page.locator('input[name="is[last_name]"], input[placeholder*="Фамилия"]').fill(lastName);
    await page.locator('input[name="is[first_name]"], input[placeholder*="Имя"]').fill(firstName);

    if (middleName) {
      await page.locator('input[name="is[patronymic]"], input[placeholder*="Отчество"]').fill(middleName);
    }

    if (birthDate) {
      await page.locator('input[name="is[date]"], input[type="date"]').fill(birthDate);
    }

    const searchButton = await page.locator('button[type="submit"], input[type="submit"]').first();
    await searchButton.click();

    await page.waitForTimeout(3000);

    // TODO: Parse results (similar to searchByINNWeb)

    return {
      success: true,
      result: [],
      message: 'Парсинг по ФИО в разработке',
      source: 'fssp.gov.ru (web parser)',
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    console.error('[FSSP Parser] Error:', error);
    return {
      success: false,
      error: 'Ошибка парсинга сайта ФССП',
      details: error.message
    };
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

export default {
  searchByINNWeb,
  searchByPersonWeb
};
