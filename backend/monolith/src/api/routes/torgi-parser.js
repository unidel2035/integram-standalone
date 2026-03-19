/**
 * Torgi.gov.ru Parser API Routes
 *
 * API endpoints для управления парсером torgi.gov.ru
 * Поддержка HTTP/HTTPS/SOCKS5 прокси
 */

import { Router } from 'express'
import { TorgiParserService } from '../../services/torgi-parser/TorgiParserService.js'

const router = Router()

// CORS middleware для torgi-parser routes (поддержка X-Integram-* headers)
router.use((req, res, next) => {
  const origin = req.headers.origin
  const allowedOrigins = [
    'https://drondoc.ru',
    'https://dev.drondoc.ru',
    'http://dev.drondoc.ru:5173', // Dev server via SSH tunnel
    'http://localhost:5173',
    'http://localhost:3000'
  ]

  if (!origin || allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*')
    res.setHeader('Access-Control-Allow-Credentials', 'true')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Integram-Token, X-Integram-XSRF')
  }

  if (req.method === 'OPTIONS') {
    return res.status(204).end()
  }

  next()
})

// Singleton instance парсера
let parserInstance = null

// Текущие настройки прокси (сохраняются между запросами)
let currentProxyUrl = process.env.TORGI_PROXY_URL || null

// Текущие cookies (для обхода защиты от ботов)
let currentCookies = null

/**
 * POST /api/torgi-parser/proxy
 * Установка прокси для парсера
 *
 * Body:
 * - proxyUrl: string - URL прокси (http://, https://, socks5://)
 *   Примеры:
 *   - http://user:pass@proxy.example.com:8080
 *   - socks5://user:pass@proxy.example.com:1080
 *   - null или пустая строка для отключения прокси
 */
router.post('/proxy', (req, res) => {
  try {
    const { proxyUrl } = req.body

    if (proxyUrl === null || proxyUrl === '' || proxyUrl === undefined) {
      currentProxyUrl = null
      console.log('[TorgiParser API] Proxy disabled')
      return res.json({
        success: true,
        message: 'Proxy disabled',
        proxyUrl: null
      })
    }

    // Валидация URL
    try {
      new URL(proxyUrl)
    } catch (e) {
      return res.status(400).json({
        success: false,
        error: 'Invalid proxy URL format'
      })
    }

    currentProxyUrl = proxyUrl
    // Маскируем пароль в логах
    const maskedUrl = proxyUrl.replace(/:[^:@]+@/, ':****@')
    console.log(`[TorgiParser API] Proxy set: ${maskedUrl}`)

    res.json({
      success: true,
      message: 'Proxy configured',
      proxyUrl: maskedUrl
    })
  } catch (error) {
    console.error('[TorgiParser API] Error setting proxy:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * GET /api/torgi-parser/proxy
 * Получение текущих настроек прокси
 */
router.get('/proxy', (req, res) => {
  const maskedUrl = currentProxyUrl
    ? currentProxyUrl.replace(/:[^:@]+@/, ':****@')
    : null

  res.json({
    success: true,
    proxyUrl: maskedUrl,
    enabled: !!currentProxyUrl
  })
})

/**
 * POST /api/torgi-parser/cookies
 * Установка cookies для парсера (для обхода защиты от ботов)
 *
 * Body:
 * - cookies: string - Строка cookies из браузера
 *   Получить можно из DevTools браузера: Application -> Cookies -> torgi.gov.ru
 *   Формат: "key1=value1; key2=value2; ..."
 */
router.post('/cookies', (req, res) => {
  try {
    const { cookies } = req.body

    if (cookies === null || cookies === '' || cookies === undefined) {
      currentCookies = null
      console.log('[TorgiParser API] Cookies cleared')
      return res.json({
        success: true,
        message: 'Cookies cleared',
        cookiesSet: false
      })
    }

    currentCookies = cookies
    console.log(`[TorgiParser API] Cookies set: ${cookies.length} chars`)

    res.json({
      success: true,
      message: 'Cookies configured',
      cookiesSet: true,
      cookiesLength: cookies.length
    })
  } catch (error) {
    console.error('[TorgiParser API] Error setting cookies:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * GET /api/torgi-parser/cookies
 * Получение статуса cookies
 */
router.get('/cookies', (req, res) => {
  res.json({
    success: true,
    cookiesSet: !!currentCookies,
    cookiesLength: currentCookies ? currentCookies.length : 0
  })
})

/**
 * POST /api/torgi-parser/start
 * Запуск парсинга torgi.gov.ru
 *
 * Body:
 * - login: string - Integram login
 * - password: string - Integram password
 * - maxPages: number - Maximum pages to parse (default: 100)
 * - searchParams: object - Additional search params for torgi.gov.ru API
 * - proxyUrl: string - (optional) Override proxy for this run
 * - cookies: string - (optional) Override cookies for this run
 */
router.post('/start', async (req, res) => {
  try {
    const { login, password, maxPages, searchParams, proxyUrl, cookies } = req.body

    if (!login || !password) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: login, password'
      })
    }

    if (parserInstance && parserInstance.isRunning) {
      return res.status(409).json({
        success: false,
        error: 'Parser is already running',
        stats: parserInstance.getStats()
      })
    }

    // Создаём новый экземпляр парсера с прокси и cookies
    const effectiveProxy = proxyUrl !== undefined ? proxyUrl : currentProxyUrl
    const effectiveCookies = cookies !== undefined ? cookies : currentCookies
    parserInstance = new TorgiParserService({
      torgi: { proxyUrl: effectiveProxy },
      cookies: effectiveCookies
    })

    // Инициализируем Integram
    await parserInstance.initIntegram(login, password)

    // Запускаем парсинг асинхронно
    parserInstance.runFullParsing({ maxPages, searchParams })
      .then(result => {
        console.log('[TorgiParser API] Parsing completed:', result)
      })
      .catch(error => {
        console.error('[TorgiParser API] Parsing failed:', error)
      })

    res.json({
      success: true,
      message: 'Parser started',
      proxyEnabled: !!effectiveProxy,
      cookiesEnabled: !!effectiveCookies,
      stats: parserInstance.getStats()
    })
  } catch (error) {
    console.error('[TorgiParser API] Error starting parser:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * GET /api/torgi-parser/status
 * Получение статуса парсера
 */
router.get('/status', (req, res) => {
  if (!parserInstance) {
    return res.json({
      success: true,
      status: 'not_initialized',
      stats: null
    })
  }

  res.json({
    success: true,
    status: parserInstance.isRunning ? 'running' : 'idle',
    stats: parserInstance.getStats()
  })
})

/**
 * POST /api/torgi-parser/stop
 * Остановка парсера (мягкая)
 */
router.post('/stop', (req, res) => {
  if (!parserInstance) {
    return res.status(400).json({
      success: false,
      error: 'Parser not initialized'
    })
  }

  // Устанавливаем флаг остановки (парсер проверит на следующей итерации)
  parserInstance.isRunning = false

  res.json({
    success: true,
    message: 'Stop signal sent',
    stats: parserInstance.getStats()
  })
})

/**
 * POST /api/torgi-parser/parse-page
 * Парсинг одной страницы (для тестирования)
 *
 * Body:
 * - login: string - Integram login
 * - password: string - Integram password
 * - page: number - Page number (default: 0)
 * - searchParams: object - Additional search params
 * - proxyUrl: string - (optional) Override proxy for this request
 * - cookies: string - (optional) Override cookies for this request
 */
router.post('/parse-page', async (req, res) => {
  try {
    const { login, password, page = 0, searchParams, proxyUrl, cookies } = req.body

    if (!login || !password) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: login, password'
      })
    }

    // Создаём временный экземпляр с прокси и cookies
    const effectiveProxy = proxyUrl !== undefined ? proxyUrl : currentProxyUrl
    const effectiveCookies = cookies !== undefined ? cookies : currentCookies
    const parser = new TorgiParserService({
      torgi: { proxyUrl: effectiveProxy },
      cookies: effectiveCookies
    })
    await parser.initIntegram(login, password)

    const result = await parser.parseOnePage(page, searchParams)

    res.json({
      success: true,
      proxyEnabled: !!effectiveProxy,
      cookiesEnabled: !!effectiveCookies,
      ...result
    })
  } catch (error) {
    console.error('[TorgiParser API] Error parsing page:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * POST /api/torgi-parser/search
 * Поиск лотов на torgi.gov.ru (без сохранения)
 *
 * Body:
 * - page: number - Page number
 * - size: number - Page size
 * - sort: string - Sort order
 * - proxyUrl: string - (optional) Override proxy for this request
 * - cookies: string - (optional) Override cookies for this request
 * - ... other search params
 */
router.post('/search', async (req, res) => {
  try {
    const { proxyUrl, cookies, ...searchParams } = req.body
    const effectiveProxy = proxyUrl !== undefined ? proxyUrl : currentProxyUrl
    const effectiveCookies = cookies !== undefined ? cookies : currentCookies

    const parser = new TorgiParserService({
      torgi: { proxyUrl: effectiveProxy },
      cookies: effectiveCookies
    })
    const result = await parser.searchLots(searchParams)

    res.json({
      success: true,
      proxyEnabled: !!effectiveProxy,
      cookiesEnabled: !!effectiveCookies,
      data: result
    })
  } catch (error) {
    console.error('[TorgiParser API] Error searching lots:', error)

    // Определяем статус код на основе типа ошибки
    let statusCode = 500
    if (error.code === 'CONNECTION_TIMEOUT') {
      statusCode = 504 // Gateway Timeout
    } else if (error.code === 'CONNECTION_REFUSED' || error.code === 'DNS_ERROR') {
      statusCode = 503 // Service Unavailable
    } else if (error.code === 'HTTP_ERROR' && error.statusCode) {
      statusCode = error.statusCode
    }

    res.status(statusCode).json({
      success: false,
      error: error.message,
      errorCode: error.code || 'UNKNOWN_ERROR',
      details: error.details || {},
      proxyEnabled: !!effectiveProxy,
      cookiesEnabled: !!effectiveCookies
    })
  }
})

/**
 * GET /api/torgi-parser/lot/:id
 * Получение информации о лоте по ID
 *
 * Query:
 * - proxyUrl: string - (optional) Override proxy for this request
 * - cookies: string - (optional) Override cookies for this request
 */
router.get('/lot/:id', async (req, res) => {
  try {
    const { proxyUrl, cookies } = req.query
    const effectiveProxy = proxyUrl !== undefined ? proxyUrl : currentProxyUrl
    const effectiveCookies = cookies !== undefined ? cookies : currentCookies

    const parser = new TorgiParserService({
      torgi: { proxyUrl: effectiveProxy },
      cookies: effectiveCookies
    })
    const result = await parser.getLotCard(req.params.id)

    res.json({
      success: true,
      proxyEnabled: !!effectiveProxy,
      cookiesEnabled: !!effectiveCookies,
      data: result
    })
  } catch (error) {
    console.error('[TorgiParser API] Error getting lot:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * POST /api/torgi-parser/test-connection
 * Тестирование соединения с torgi.gov.ru (с прокси и/или cookies)
 *
 * Body:
 * - proxyUrl: string - (optional) URL прокси для теста
 * - cookies: string - (optional) Cookies для теста
 */
router.post('/test-connection', async (req, res) => {
  try {
    const { proxyUrl, cookies } = req.body
    const effectiveProxy = proxyUrl !== undefined ? proxyUrl : currentProxyUrl
    const effectiveCookies = cookies !== undefined ? cookies : currentCookies

    const parser = new TorgiParserService({
      torgi: { proxyUrl: effectiveProxy },
      cookies: effectiveCookies
    })

    const startTime = Date.now()
    const result = await parser.searchLots({ page: 0, size: 1 })
    const duration = Date.now() - startTime

    const maskedProxy = effectiveProxy
      ? effectiveProxy.replace(/:[^:@]+@/, ':****@')
      : null

    res.json({
      success: true,
      proxyUrl: maskedProxy,
      proxyEnabled: !!effectiveProxy,
      cookiesEnabled: !!effectiveCookies,
      testResult: {
        connected: true,
        responseTime: duration,
        totalLots: result.totalElements || result.total || 'unknown'
      }
    })
  } catch (error) {
    const maskedProxy = (req.body.proxyUrl || currentProxyUrl)
      ? (req.body.proxyUrl || currentProxyUrl).replace(/:[^:@]+@/, ':****@')
      : null

    res.json({
      success: false,
      proxyUrl: maskedProxy,
      proxyEnabled: !!(req.body.proxyUrl || currentProxyUrl),
      cookiesEnabled: !!(req.body.cookies || currentCookies),
      testResult: {
        connected: false,
        error: error.message
      }
    })
  }
})

/**
 * POST /api/torgi-parser/test-proxy
 * Тестирование прокси-соединения с torgi.gov.ru (alias для test-connection)
 *
 * Body:
 * - proxyUrl: string - (optional) URL прокси для теста
 * - cookies: string - (optional) Cookies для теста
 */
router.post('/test-proxy', async (req, res) => {
  try {
    const { proxyUrl, cookies } = req.body
    const effectiveProxy = proxyUrl !== undefined ? proxyUrl : currentProxyUrl
    const effectiveCookies = cookies !== undefined ? cookies : currentCookies

    const parser = new TorgiParserService({
      torgi: { proxyUrl: effectiveProxy },
      cookies: effectiveCookies
    })

    const startTime = Date.now()
    const result = await parser.searchLots({ page: 0, size: 1 })
    const duration = Date.now() - startTime

    const maskedProxy = effectiveProxy
      ? effectiveProxy.replace(/:[^:@]+@/, ':****@')
      : null

    res.json({
      success: true,
      proxyUrl: maskedProxy,
      proxyEnabled: !!effectiveProxy,
      cookiesEnabled: !!effectiveCookies,
      testResult: {
        connected: true,
        responseTime: duration,
        totalLots: result.totalElements || result.total || 'unknown'
      }
    })
  } catch (error) {
    const maskedProxy = (req.body.proxyUrl || currentProxyUrl)
      ? (req.body.proxyUrl || currentProxyUrl).replace(/:[^:@]+@/, ':****@')
      : null

    res.json({
      success: false,
      proxyUrl: maskedProxy,
      proxyEnabled: !!(req.body.proxyUrl || currentProxyUrl),
      cookiesEnabled: !!(req.body.cookies || currentCookies),
      testResult: {
        connected: false,
        error: error.message
      }
    })
  }
})

/**
 * POST /api/torgi-parser/save-lot
 * Сохранение лота в Integram (для browser-based парсинга)
 *
 * Headers:
 * - X-Integram-Token: string - Токен аутентификации Integram
 * - X-Integram-XSRF: string - XSRF токен
 *
 * Body:
 * - lot: object - Данные лота с torgi.gov.ru
 */
router.post('/save-lot', async (req, res) => {
  try {
    const { lot } = req.body
    const token = req.headers['x-integram-token']
    const xsrf = req.headers['x-integram-xsrf']

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Missing X-Integram-Token header'
      })
    }

    if (!lot || !lot.id) {
      return res.status(400).json({
        success: false,
        error: 'Missing lot data or lot ID'
      })
    }

    // Create parser instance and set auth
    const parser = new TorgiParserService()
    parser.integramClient = new (await import('../../services/integram/integram-client.js')).default(
      'https://dronedoc.ru',
      'torgi'
    )
    parser.integramClient.setAuth(token, xsrf)

    // Save the lot
    const result = await parser.saveLot(lot)

    res.json(result)
  } catch (error) {
    console.error('[TorgiParser API] Error saving lot:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * POST /api/torgi-parser/parse-description
 * Парсинг описания одного лота и обновление полей
 *
 * Body:
 * - login: string - Integram login
 * - password: string - Integram password
 * - objectId: string|number - ID объекта лота в Integram
 */
router.post('/parse-description', async (req, res) => {
  try {
    const { login, password, objectId } = req.body

    if (!login || !password || !objectId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: login, password, objectId'
      })
    }

    // Создаём экземпляр парсера
    const parser = new TorgiParserService()
    await parser.initIntegram(login, password)

    // Парсим и обновляем описание
    const result = await parser.parseAndUpdateLotDescription(objectId)

    res.json(result)
  } catch (error) {
    console.error('[TorgiParser API] Error parsing description:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * POST /api/torgi-parser/parse-descriptions-batch
 * Парсинг описаний нескольких лотов
 *
 * Body:
 * - login: string - Integram login
 * - password: string - Integram password
 * - objectIds: Array<string|number> - Массив ID объектов
 * - batchSize: number - (optional) Размер batch (default: 10)
 * - delayMs: number - (optional) Задержка между batch в мс (default: 1000)
 */
router.post('/parse-descriptions-batch', async (req, res) => {
  try {
    const { login, password, objectIds, batchSize, delayMs } = req.body

    if (!login || !password || !objectIds || !Array.isArray(objectIds)) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: login, password, objectIds (array)'
      })
    }

    // Создаём экземпляр парсера
    const parser = new TorgiParserService()
    await parser.initIntegram(login, password)

    // Парсим описания
    const result = await parser.parseAndUpdateMultipleLots(objectIds, {
      batchSize: batchSize || 10,
      delayMs: delayMs || 1000
    })

    res.json(result)
  } catch (error) {
    console.error('[TorgiParser API] Error parsing descriptions batch:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * POST /api/torgi-parser/parse-all-descriptions
 * Парсинг описаний всех лотов (с фильтрацией)
 *
 * Body:
 * - login: string - Integram login
 * - password: string - Integram password
 * - limit: number - (optional) Максимальное количество лотов (default: 100)
 * - offset: number - (optional) Смещение (default: 0)
 * - onlyEmpty: boolean - (optional) Только лоты с пустыми полями (default: true)
 */
router.post('/parse-all-descriptions', async (req, res) => {
  try {
    const { login, password, limit, offset, onlyEmpty } = req.body

    if (!login || !password) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: login, password'
      })
    }

    // Создаём экземпляр парсера
    const parser = new TorgiParserService()
    await parser.initIntegram(login, password)

    // Парсим все описания
    const result = await parser.parseAllDescriptions({
      limit: limit || 100,
      offset: offset || 0,
      onlyEmpty: onlyEmpty !== false  // default true
    })

    res.json(result)
  } catch (error) {
    console.error('[TorgiParser API] Error parsing all descriptions:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * POST /api/torgi-parser/parse-documents-playwright
 * Парсинг документов лота с использованием Playwright MCP
 *
 * Body:
 * - lotUrl: string - URL страницы лота с документами
 *   Example: https://torgi.gov.ru/new/public/lots/lot/22000010600000000293_6/(lotInfo:docs)
 * - saveToIntegram: boolean - Сохранить документы в Integram (требует authentication)
 * - login: string - (optional) Integram login (если saveToIntegram=true)
 * - password: string - (optional) Integram password (если saveToIntegram=true)
 * - playwrightMCP: object - (optional) Playwright MCP client instance
 */
router.post('/parse-documents-playwright', async (req, res) => {
  try {
    const { lotUrl, saveToIntegram = false, login, password } = req.body

    if (!lotUrl) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: lotUrl'
      })
    }

    // Динамический импорт Playwright document parser
    const { parseDocumentsAuto } = await import('../../services/torgi-parser/playwright-document-parser.js')

    // Для использования Playwright MCP нужен MCP client
    // В production должен быть доступен через MCP server
    // Пока возвращаем инструкцию для пользователя
    return res.json({
      success: false,
      error: 'Playwright MCP integration not yet implemented in API',
      instruction: {
        message: 'Используйте Playwright MCP напрямую через Claude Code или скрипт',
        example: `
const playwrightMCP = /* получить Playwright MCP client */;
const { parseDocumentsAuto } = require('./playwright-document-parser.js');
const result = await parseDocumentsAuto(playwrightMCP, '${lotUrl}');
console.log(result);
        `.trim(),
        alternativeApi: 'Используйте /api/torgi-parser/lot/:id для получения документов через API'
      }
    })
  } catch (error) {
    console.error('[TorgiParser API] Error parsing documents with Playwright:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

export default router
