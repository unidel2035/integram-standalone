/**
 * Torgi.gov.ru Parser Service
 *
 * Парсер для сайта государственных торгов torgi.gov.ru
 * Собирает данные о лотах и сохраняет в Integram
 *
 * Поддержка прокси:
 * - HTTP/HTTPS прокси через https-proxy-agent
 * - SOCKS5 прокси через socks-proxy-agent
 * - Конфигурация через env: TORGI_PROXY_URL
 */

import IntegramClient from '../integram/integram-client.js'
import { HttpsProxyAgent } from 'https-proxy-agent'
import { SocksProxyAgent } from 'socks-proxy-agent'
import axios from 'axios'
import { parseDescription } from './descriptionParser.js'

// Конфигурация torgi.gov.ru API
const TORGI_CONFIG = {
  baseUrl: 'https://torgi.gov.ru/new/api/public',
  endpoints: {
    lotSearch: '/lotcards/search',  // Актуальный endpoint (обновлён 2025-12)
    lotCard: '/lotcards',           // Карточка лота
    lotDocuments: '/lotcards'       // Документы лота (добавляется /lotId/documents)
  },
  pageSize: 100,
  maxPages: 100,
  requestDelay: 1000, // ms
  requestTimeout: 60000, // ms
  proxyUrl: process.env.TORGI_PROXY_URL || null // HTTP/HTTPS/SOCKS5 proxy URL
}

// Конфигурация Integram (база torgi)
const INTEGRAM_CONFIG = {
  serverURL: 'https://dronedoc.ru',
  database: 'torgi',
  tables: {
    lot: 346,
    log: 357,
    status: 298,
    bidType: 306,
    category: 312,
    region: 322,
    platform: 333,
    document: 561,       // Документы лота (подчинённая таблица)
    documentType: 563    // Справочник типов документов
  },
  lotFields: {
    // Базовые поля
    torgiId: 347,
    description: 348,
    startPrice: 446,  // Цена (было 349, но поле не существует)
    publishDate: 350,
    address: 351,
    url: 352,
    // Reference поля
    status: 375,
    bidType: 368,
    category: 371,
    region: 366,
    platform: 559,
    // Новые поля для недвижимости
    noticeNumber: 540,      // Номер извещения
    lotNumber: 541,         // Номер лота в извещении
    auctionStep: 542,       // Шаг аукциона (сумма)
    depositAmount: 543,     // Размер задатка (сумма)
    auctionStepPercent: 544,// Шаг аукциона %
    depositPercent: 545,    // Задаток %
    vat: 546,               // НДС
    applicationStart: 547,  // Начало подачи заявок
    applicationEnd: 548,    // Окончание подачи заявок
    auctionDate: 549,       // Дата торгов
    contractType: 550,      // Вид договора
    leaseTerm: 551,         // Срок аренды лет
    smbOnly: 552,           // Только для МСП
    cadastralNumber: 553,   // Кадастровый номер
    area: 554,              // Площадь м2
    permittedUse: 555,      // Вид разрешённого использования
    ownershipForm: 556,     // Форма собственности
    restrictions: 557       // Ограничения прав
  },
  logFields: {
    startDate: 358,
    totalLots: 359,
    status: 360,
    message: 361
  },
  // Поля документов лота
  documentFields: {
    documentType: 564,     // Тип документа (REF → 563)
    url: 568,              // URL документа
    fileSize: 569,         // Размер файла (байты)
    publishDate: 570       // Дата публикации документа
  }
}

// Маппинг типов документов torgi.gov.ru → ID объектов в справочнике 563
const DOCUMENT_TYPE_MAP = {
  'иное': 571,
  'другое': 571,
  'прочее': 571,
  'форма заявки': 572,
  'заявка': 572,
  'документация аукциона': 573,
  'документация': 573,
  'аукционная документация': 573,
  'проект договора': 574,
  'договор': 574,
  'извещение о торгах': 575,
  'извещение': 575,
  'протокол': 576,
  'разъяснение': 577,
  'разъяснения': 577,
  'егрн': 578,
  'выписка егрн': 578,
  'выписка из егрн': 578
}

// Маппинг статусов torgi.gov.ru -> Integram object IDs
const STATUS_MAP = {
  // Uppercase (оригинальные коды torgi.gov.ru)
  'PUBLISHED': 299,
  'APPLICATIONS_SUBMISSION': 300,
  'DETERMINING_WINNER': 301,
  'SUCCEED': 302,
  'FAILED': 303,
  'CANCELED': 304,
  'ARCHIVE': 305,
  // Lowercase варианты
  'published': 299,
  'applications_submission': 300,
  'determining_winner': 301,
  'succeed': 302,
  'failed': 303,
  'canceled': 304,
  'archive': 305
}

// Маппинг типов торгов
const BID_TYPE_MAP = {
  'auctionSale': 307,
  'contest': 308,
  'publicOffer': 309,
  'saleWithoutPrice': 310,
  'privatization': 311
}

// Ключевые слова для определения категории
const CATEGORY_KEYWORDS = {
  'земельн': 313,
  'здани': 314,
  'строени': 314,
  'сооружени': 314,
  'жил': 315,
  'квартир': 315,
  'нежил': 316,
  'помещени': 316,
  'транспорт': 317,
  'автомоб': 317,
  'оборудован': 318,
  'аренд': 319,
  'акци': 320,
  'дол': 320
}
// Маппинг торговых площадок по etpCode (torgi.gov.ru -> Integram ID)
const ETP_MAP = {
  // Полные коды с префиксом ETP_
  "ETP_RTS": 334,       // РТС-тендер
  "ETP_SBAST": 335,     // Сбербанк-АСТ
  "ETP_GPB": 336,       // ЭТП ГПБ
  "ETP_EETP": 337,      // ЕЭТП
  "ETP_RAD": 338,       // ЭТП РАД
  "ETP_FABRIKANT": 339, // Фабрикант
  "ETP_LOT": 340,       // Lot-online
  "ETP_ROSELTORG": 337, // Росэлторг = ЕЭТП
  "ETP_RUS": 341,       // ЭТП России
  // Короткие коды (torgi.gov.ru иногда возвращает без префикса)
  "EETP": 337,          // ЕЭТП
  "RTS": 334,           // РТС-тендер
  "SBAST": 335,         // Сбербанк-АСТ
  "GPB": 336,           // ЭТП ГПБ
  "RAD": 338,           // ЭТП РАД
  "FABRIKANT": 339,     // Фабрикант
  "LOT": 340,           // Lot-online
  "ROSELTORG": 337,     // Росэлторг = ЕЭТП
  "RUS": 341            // ЭТП России
}

// Маппинг регионов по subjectRFCode (код региона -> Integram ID)
const REGION_CODE_MAP = {
  "77": 323,  // Москва
  "78": 324,  // Санкт-Петербург
  "50": 325,  // Московская область
  "47": 326,  // Ленинградская область
  "23": 327,  // Краснодарский край
  "66": 328,  // Свердловская область
  "54": 329,  // Новосибирская область
  "16": 330,  // Татарстан
  "02": 331,  // Башкортостан
  "52": 332,  // Нижегородская область
  "86": 1513, // ХМАО
  "72": 1514, // Тюменская область
  "74": 1515, // Челябинская область
  "63": 1516, // Самарская область
  "61": 1517, // Ростовская область
  "36": 1518, // Воронежская область
  "59": 1519, // Пермский край
  "24": 1520, // Красноярский край
  "42": 1521, // Кемеровская область
  "71": 1522, // Тульская область
  "40": 1523, // Калужская область
  "20": 1524, // Чеченская Республика
  "34": 1756, // Волгоградская область
  "37": 2174, // Ивановская область
  "13": 2093, // Республика Мордовия
  "35": 2409  // Вологодская область
}

// Маппинг biddType.code (код типа торгов -> Integram ID)
const BIDD_TYPE_CODE_MAP = {
  "178FZ": 311,      // Приватизация гос/мун имущества
  "rent": 307,       // Аренда
  "sale": 307        // Продажа
}

// Маппинг форм торгов (biddForm.code -> biddType ID)
const BIDD_FORM_MAP = {
  "EA": 307,   // Электронный аукцион
  "OA": 307,   // Открытый аукцион
  "EK": 308,   // Электронный конкурс
  "PP": 309    // Публичное предложение
}


export class TorgiParserService {
  constructor(options = {}) {
    this.config = { ...TORGI_CONFIG, ...options.torgi }
    this.integramConfig = { ...INTEGRAM_CONFIG, ...options.integram }
    this.integramClient = null
    this.isRunning = false
    this.stats = {
      totalFetched: 0,
      newLots: 0,
      updatedLots: 0,
      errors: 0,
      documentsSaved: 0
    }
    this.proxyAgent = this._createProxyAgent()
    // Поддержка cookies для обхода защиты от ботов
    this.cookies = options.cookies || null
  }

  /**
   * Создание прокси-агента на основе URL
   */
  _createProxyAgent() {
    const proxyUrl = this.config.proxyUrl
    if (!proxyUrl) {
      return null
    }

    try {
      const url = new URL(proxyUrl)
      const protocol = url.protocol.toLowerCase()

      if (protocol === 'socks5:' || protocol === 'socks5h:' || protocol === 'socks4:') {
        console.log(`[TorgiParser] Using SOCKS proxy: ${url.host}`)
        return new SocksProxyAgent(proxyUrl)
      } else if (protocol === 'http:' || protocol === 'https:') {
        console.log(`[TorgiParser] Using HTTP/HTTPS proxy: ${url.host}`)
        return new HttpsProxyAgent(proxyUrl)
      } else {
        console.warn(`[TorgiParser] Unknown proxy protocol: ${protocol}, proxy disabled`)
        return null
      }
    } catch (error) {
      console.error(`[TorgiParser] Invalid proxy URL: ${error.message}`)
      return null
    }
  }

  /**
   * Установка прокси (можно вызывать после создания)
   */
  setProxy(proxyUrl) {
    this.config.proxyUrl = proxyUrl
    this.proxyAgent = this._createProxyAgent()
    return this.proxyAgent !== null
  }

  /**
   * Установка cookies (для обхода защиты от ботов)
   * @param {string} cookies - Строка cookies из браузера
   */
  setCookies(cookies) {
    this.cookies = cookies
    console.log(`[TorgiParser] Cookies set: ${cookies ? 'yes' : 'no'}`)
  }

  /**
   * Инициализация клиента Integram
   */
  async initIntegram(login, password) {
    this.integramClient = new IntegramClient(
      this.integramConfig.serverURL,
      this.integramConfig.database
    )

    const authenticated = await this.integramClient.authenticate(login, password)
    if (!authenticated) {
      throw new Error('Failed to authenticate with Integram')
    }

    console.log('[TorgiParser] Integram authentication successful')
    return true
  }

  /**
   * Запрос к API torgi.gov.ru (используем axios вместо fetch для лучшей совместимости)
   */
  async fetchTorgiApi(endpoint, params = {}) {
    const url = `${this.config.baseUrl}${endpoint}`

    // Полные браузерные заголовки для обхода защиты от ботов
    const headers = {
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Referer': 'https://torgi.gov.ru/new/public/lots/reg'
    }

    // Добавляем cookies если есть
    if (this.cookies) {
      headers['Cookie'] = this.cookies
    }

    const axiosConfig = {
      method: 'GET',
      url,
      params,
      headers,
      timeout: this.config.requestTimeout,
      validateStatus: (status) => status < 500 // Не бросать ошибку на 4xx
    }

    // Добавляем прокси-агент если настроен
    if (this.proxyAgent) {
      axiosConfig.httpsAgent = this.proxyAgent
    }

    try {
      const response = await axios(axiosConfig)

      if (response.status >= 400) {
        throw new Error(`HTTP ${response.status}: ${response.statusText || 'Error'}`)
      }

      // Проверяем, что ответ это JSON, а не HTML
      const contentType = response.headers['content-type'] || ''
      const data = response.data

      if (typeof data === 'string') {
        if (data.includes('<!DOCTYPE') || data.includes('<html')) {
          throw new Error('Received HTML instead of JSON. Site may require cookies or have bot protection.')
        }
        // Попробуем распарсить как JSON
        try {
          return JSON.parse(data)
        } catch (e) {
          throw new Error(`Invalid response content-type: ${contentType}`)
        }
      }

      return data
    } catch (error) {
      // Улучшенная обработка ошибок
      if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
        const err = new Error('Connection timeout: torgi.gov.ru is not responding. This may be due to bot protection, IP blocking, or network issues.')
        err.code = 'CONNECTION_TIMEOUT'
        err.details = {
          suggestion: 'Try using a proxy server or setting cookies from browser',
          proxyEnabled: !!this.proxyAgent,
          cookiesEnabled: !!this.cookies
        }
        throw err
      }
      if (error.code === 'ECONNREFUSED') {
        const err = new Error('Connection refused: Cannot connect to torgi.gov.ru')
        err.code = 'CONNECTION_REFUSED'
        throw err
      }
      if (error.code === 'ENOTFOUND') {
        const err = new Error('DNS lookup failed: torgi.gov.ru not found')
        err.code = 'DNS_ERROR'
        throw err
      }
      if (error.response) {
        const err = new Error(`HTTP ${error.response.status}: ${error.response.statusText || error.message}`)
        err.code = 'HTTP_ERROR'
        err.statusCode = error.response.status
        throw err
      }
      // Для всех других ошибок
      const err = new Error(`Network error: ${error.message}`)
      err.code = error.code || 'UNKNOWN_ERROR'
      err.originalError = error
      throw err
    }
  }

  /**
   * Поиск лотов с пагинацией
   */
  async searchLots(params = {}) {
    const searchParams = {
      size: params.size || this.config.pageSize,
      page: params.page || 0,
      sort: params.sort || 'firstVersionPublicationDate,desc',
      ...params
    }

    return await this.fetchTorgiApi(this.config.endpoints.lotSearch, searchParams)
  }

  /**
   * Получение детальной информации о лоте
   */
  async getLotCard(lotId) {
    return await this.fetchTorgiApi(`${this.config.endpoints.lotCard}/${lotId}`)
  }

  /**
   * Получение документов лота
   * Пробует несколько возможных endpoint-ов, так как API может отличаться
   * @param {string} lotId - ID лота на torgi.gov.ru
   * @returns {Array} Массив документов
   */
  async getLotDocuments(lotId) {
    // Возможные endpoint-ы для документов
    const endpoints = [
      `${this.config.endpoints.lotDocuments}/${lotId}/documents`,
      `${this.config.endpoints.lotDocuments}/${lotId}/files`,
      `${this.config.endpoints.lotDocuments}/${lotId}/docs`,
      `${this.config.endpoints.lotDocuments}/${lotId}/attachments`
    ]

    for (const endpoint of endpoints) {
      try {
        console.log(`[TorgiParser] Пробую endpoint документов: ${endpoint}`)
        const response = await this.fetchTorgiApi(endpoint)

        if (response) {
          // Ответ может быть массивом или объектом с content/items
          const docs = Array.isArray(response)
            ? response
            : (response.content || response.items || response.documents || response.files || [])

          if (docs.length > 0) {
            console.log(`[TorgiParser] Найдено ${docs.length} документов для лота ${lotId}`)
            return docs
          }
        }
      } catch (error) {
        // Игнорируем ошибки - пробуем следующий endpoint
        console.log(`[TorgiParser] Endpoint ${endpoint} недоступен: ${error.message}`)
      }
    }

    console.log(`[TorgiParser] Документы для лота ${lotId} не найдены через отдельные endpoint-ы`)
    return []
  }

  /**
   * Извлечение документов из данных лота
   * Проверяет различные поля, которые могут содержать документы
   * @param {Object} lotData - Данные лота
   * @returns {Array} Массив документов
   */
  extractDocumentsFromLotData(lotData) {
    if (!lotData || typeof lotData !== 'object') {
      return []
    }

    // Возможные поля с документами
    const documentFields = [
      'documents',
      'files',
      'attachments',
      'lotDocuments',
      'lotFiles',
      'bidDocuments',
      'noticeDocuments',
      'docs',
      'fileList',
      'documentList'
    ]

    for (const field of documentFields) {
      const docs = lotData[field]
      if (Array.isArray(docs) && docs.length > 0) {
        console.log(`[TorgiParser] Документы найдены в поле '${field}': ${docs.length} шт.`)
        return docs
      }
    }

    // Также проверяем вложенные объекты
    const nestedPaths = [
      ['bid', 'documents'],
      ['bid', 'files'],
      ['notice', 'documents'],
      ['notice', 'files'],
      ['lotInfo', 'documents'],
      ['lotInfo', 'files']
    ]

    for (const path of nestedPaths) {
      let obj = lotData
      for (const key of path) {
        obj = obj?.[key]
        if (!obj) break
      }
      if (Array.isArray(obj) && obj.length > 0) {
        console.log(`[TorgiParser] Документы найдены по пути '${path.join('.')}': ${obj.length} шт.`)
        return obj
      }
    }

    console.log(`[TorgiParser] Документы не найдены в данных лота`)
    return []
  }

  /**
   * Определение категории по тексту
   */
  detectCategory(text) {
    if (!text) return 321 // Прочее имущество

    const textLower = text.toLowerCase()
    for (const [keyword, categoryId] of Object.entries(CATEGORY_KEYWORDS)) {
      if (textLower.includes(keyword)) {
        return categoryId
      }
    }
    return 321 // Прочее имущество
  }

  /**
   * Подготовка реквизитов лота для сохранения
   */
  prepareLotRequisites(lotData) {
    const fields = this.integramConfig.lotFields
    const reqs = {}

    // ID torgi.gov
    const torgiId = String(lotData.id || '')
    if (torgiId) {
      reqs[String(fields.torgiId)] = torgiId
    }

    // Описание
    const desc = lotData.lotDescription || lotData.lotName || ''
    if (desc) {
      reqs[String(fields.description)] = desc.substring(0, 5000)
    }

    // Начальная цена
    const price = lotData.priceMin || lotData.startPrice
    if (price) {
      reqs[String(fields.startPrice)] = String(price)
    }

    // Дата публикации
    const pubDate = lotData.firstVersionPublicationDate || lotData.publishDate
    if (pubDate) {
      try {
        const dt = new Date(pubDate)
        reqs[String(fields.publishDate)] = dt.toLocaleString('ru-RU', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })
      } catch (e) {
        // ignore date parse errors
      }
    }

    // Адрес
    const address = lotData.estateAddress || lotData.address
    if (address) {
      reqs[String(fields.address)] = address.substring(0, 250)
    }

    // URL лота
    reqs[String(fields.url)] = `https://torgi.gov.ru/new/public/lots/lot/${torgiId}`

    // Статус (reference)
    const statusCode = lotData.lotStatus
    if (statusCode && STATUS_MAP[statusCode]) {
      reqs[String(fields.status)] = String(STATUS_MAP[statusCode])
    }

    // Тип торгов (reference) - из biddType.code, biddForm.code или typeTransaction
    let bidTypeId = null
    if (lotData.biddType && typeof lotData.biddType === "object" && lotData.biddType.code) {
      bidTypeId = BIDD_TYPE_CODE_MAP[lotData.biddType.code]
    }
    if (!bidTypeId && lotData.biddForm && typeof lotData.biddForm === "object" && lotData.biddForm.code) {
      bidTypeId = BIDD_FORM_MAP[lotData.biddForm.code]
    }
    if (!bidTypeId && lotData.typeTransaction) {
      bidTypeId = BIDD_TYPE_CODE_MAP[lotData.typeTransaction]
    }
    if (!bidTypeId && lotData.biddType && BID_TYPE_MAP[lotData.biddType]) {
      bidTypeId = BID_TYPE_MAP[lotData.biddType]
    }
    // Fallback: определяем тип по typeTransaction (rent/sale)
    if (!bidTypeId && lotData.typeTransaction) {
      if (lotData.typeTransaction === 'rent') {
        bidTypeId = 307  // Аукцион (аренда)
      } else if (lotData.typeTransaction === 'sale') {
        bidTypeId = 307  // Аукцион (продажа)
      }
    }
    // DEBUG: Log bidType determination
    console.log(`[TorgiParser DEBUG] bidType detection - typeTransaction: ${lotData.typeTransaction}, biddType: ${JSON.stringify(lotData.biddType)}, biddForm: ${JSON.stringify(lotData.biddForm)}, bidTypeId: ${bidTypeId}`)

    if (bidTypeId) {
      reqs[String(fields.bidType)] = String(bidTypeId)
      console.log(`[TorgiParser DEBUG] Setting bidType field ${fields.bidType} = ${bidTypeId}`)
    } else {
      console.log(`[TorgiParser DEBUG] bidTypeId is null, field not set`)
    }

    // Категория (определяем по тексту)
    const lotName = lotData.lotName || ''
    const categoryId = this.detectCategory(lotName)
    if (categoryId) {
      reqs[String(fields.category)] = String(categoryId)
    }

    // Регион (reference) - сначала по коду subjectRFCode, затем по имени
    let regionId = null
    const regionCode = String(lotData.subjectRFCode || "")
    if (regionCode && REGION_CODE_MAP[regionCode]) {
      regionId = REGION_CODE_MAP[regionCode]
    }
    if (!regionId) {
      const regionName = lotData.subjectRFName || lotData.regionName || lotData.region || ""
      if (regionName) {
        regionId = this.detectRegion(regionName)
      }
    }
    if (regionId && fields.region) {
      reqs[String(fields.region)] = String(regionId)
    }

    // Торговая площадка (reference) - по etpCode
    const etpCode = lotData.etpCode || ""
    console.log(`[TorgiParser DEBUG] platform detection - etpCode: "${etpCode}", mapped: ${ETP_MAP[etpCode] || 'none'}`)

    if (etpCode && ETP_MAP[etpCode]) {
      reqs[String(fields.platform)] = String(ETP_MAP[etpCode])
      console.log(`[TorgiParser DEBUG] Setting platform field ${fields.platform} = ${ETP_MAP[etpCode]}`)
    } else {
      console.log(`[TorgiParser DEBUG] platform not set - etpCode: "${etpCode}"`)
    }

    // === НОВЫЕ ПОЛЯ ДЛЯ НЕДВИЖИМОСТИ ===

    // Номер извещения
    const noticeNumber = lotData.noticeNumber || lotData.bidNumber || ''
    if (noticeNumber) {
      reqs[String(fields.noticeNumber)] = String(noticeNumber)
    }

    // Номер лота в извещении
    const lotNumber = lotData.lotNumber || lotData.lotNum || 1
    if (lotNumber) {
      reqs[String(fields.lotNumber)] = String(lotNumber)
    }

    // Шаг аукциона (сумма)
    const auctionStep = lotData.auctionStep || lotData.stepPrice || lotData.biddStep
    if (auctionStep) {
      reqs[String(fields.auctionStep)] = String(auctionStep)
    }

    // Шаг аукциона %
    const auctionStepPercent = lotData.auctionStepPercent || lotData.stepPercent
    if (auctionStepPercent) {
      reqs[String(fields.auctionStepPercent)] = String(auctionStepPercent)
    }

    // Размер задатка (сумма)
    const depositAmount = lotData.depositAmount || lotData.deposit || lotData.depositSum
    if (depositAmount) {
      reqs[String(fields.depositAmount)] = String(depositAmount)
    }

    // Задаток %
    const depositPercent = lotData.depositPercent || lotData.depositPercentage
    if (depositPercent) {
      reqs[String(fields.depositPercent)] = String(depositPercent)
    }

    // НДС
    const vat = lotData.nds || lotData.vat || lotData.vatInfo || ''
    if (vat) {
      reqs[String(fields.vat)] = String(vat).substring(0, 100)
    }

    // Начало подачи заявок
    const appStart = lotData.applicationStartDate || lotData.biddingStartTime
    if (appStart) {
      reqs[String(fields.applicationStart)] = this.formatDateTime(appStart)
    }

    // Окончание подачи заявок
    const appEnd = lotData.applicationEndDate || lotData.biddingEndTime
    if (appEnd) {
      reqs[String(fields.applicationEnd)] = this.formatDateTime(appEnd)
    }

    // Дата торгов
    const auctionDate = lotData.auctionDate || lotData.biddDate || lotData.procurementDate
    if (auctionDate) {
      reqs[String(fields.auctionDate)] = this.formatDateTime(auctionDate)
    }

    // Вид договора
    const contractType = lotData.contractType || lotData.dealType || ''
    if (contractType) {
      reqs[String(fields.contractType)] = String(contractType).substring(0, 200)
    }

    // Срок аренды лет
    const leaseTerm = lotData.leaseTerm || lotData.rentPeriod || lotData.rentYears
    if (leaseTerm) {
      reqs[String(fields.leaseTerm)] = String(leaseTerm)
    }

    // Только для МСП
    const smbOnly = lotData.smbOnly || lotData.forSmb || lotData.mspOnly
    if (smbOnly !== undefined && smbOnly !== null) {
      reqs[String(fields.smbOnly)] = smbOnly ? '1' : '0'
    }

    // Кадастровый номер
    const cadastralNumber = lotData.cadastralNumber || lotData.cadastralNum || ''
    if (cadastralNumber) {
      reqs[String(fields.cadastralNumber)] = String(cadastralNumber).substring(0, 50)
    }

    // Площадь м2
    const area = lotData.area || lotData.estateArea || lotData.square
    if (area) {
      reqs[String(fields.area)] = String(area)
    }

    // Вид разрешённого использования
    const permittedUse = lotData.permittedUse || lotData.allowedUsage || lotData.allowedUse || ''
    if (permittedUse) {
      reqs[String(fields.permittedUse)] = String(permittedUse).substring(0, 500)
    }

    // Форма собственности
    const ownershipForm = lotData.ownershipForm || lotData.ownershipType || ''
    if (ownershipForm) {
      reqs[String(fields.ownershipForm)] = String(ownershipForm).substring(0, 200)
    }

    // Ограничения прав
    const restrictions = lotData.restrictions || lotData.encumbrances || lotData.limitations || ''
    if (restrictions) {
      reqs[String(fields.restrictions)] = String(restrictions).substring(0, 1000)
    }

    // Торговая площадка (reference) - по etpCode (уже обрабатывается выше)

    // === ПАРСИНГ CHARACTERISTICS ===
    if (Array.isArray(lotData.characteristics)) {
      for (const char of lotData.characteristics) {
        const code = char.code || ""
        const value = char.characteristicValue || ""
        
        // Кадастровый номер
        if (code === "cadastralNumberRealty" && value && fields.cadastralNumber) {
          reqs[String(fields.cadastralNumber)] = String(value)
        }
        
        // Площадь
        if (code === "totalAreaRealty" && value && fields.area) {
          reqs[String(fields.area)] = String(parseFloat(value) || 0)
        }
        
        // Вид разрешённого использования
        if (code === "permittedUse" && value && fields.permittedUse) {
          reqs[String(fields.permittedUse)] = String(value).substring(0, 250)
        }
        
        // Ограничения
        if (code === "restrictionsEncumbrances" && value && fields.restrictions) {
          reqs[String(fields.restrictions)] = String(value).substring(0, 500)
        }
      }
    }

    // Дата окончания подачи заявок
    if (lotData.biddEndTime && fields.applicationEnd) {
      try {
        const dt = new Date(lotData.biddEndTime)
        reqs[String(fields.applicationEnd)] = dt.toLocaleString("ru-RU", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit"
        })
      } catch (e) {}
    }

    // НДС
    if (lotData.lotVat && typeof lotData.lotVat === "object" && lotData.lotVat.name && fields.vat) {
      reqs[String(fields.vat)] = String(lotData.lotVat.name)
    }

    // Вид договора (аренда/продажа)
    if (lotData.typeTransaction && fields.contractType) {
      const contractTypeMap = { "rent": "Аренда", "sale": "Продажа" }
      reqs[String(fields.contractType)] = contractTypeMap[lotData.typeTransaction] || lotData.typeTransaction
    }

    return reqs
  }

  /**
   * Форматирование даты/времени для Integram
   * Поддерживает ISO строки, timestamp, и строки вида "dd.mm.yyyy"
   */
  formatDateTime(dateStr) {
    if (!dateStr) return ''
    try {
      let dt

      // Если это число (timestamp в ms)
      if (typeof dateStr === 'number') {
        dt = new Date(dateStr)
      }
      // Если это ISO строка (2025-12-09T10:30:00Z или 2025-12-09)
      else if (typeof dateStr === 'string') {
        // Добавляем время если только дата
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
          dt = new Date(dateStr + 'T00:00:00')
        } else {
          dt = new Date(dateStr)
        }
      } else {
        dt = new Date(dateStr)
      }

      // Проверяем что дата валидна
      if (isNaN(dt.getTime())) {
        console.log(`[TorgiParser] Не удалось распарсить дату: ${dateStr}`)
        return String(dateStr)
      }

      return dt.toLocaleString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    } catch (e) {
      console.log(`[TorgiParser] Ошибка форматирования даты: ${e.message}`)
      return String(dateStr)
    }
  }

  /**
   * Определение ID торговой площадки по названию
   */
  detectPlatform(platformName) {
    if (!platformName) return null
    const name = platformName.toLowerCase()

    // Маппинг площадок на ID объектов в таблице 333
    // 334=РТС-тендер, 335=Сбербанк-АСТ, 336=ЭТП ГПБ, 337=ЕЭТП
    // 338=ЭТП РАД, 339=Фабрикант, 340=Lot-online, 341=ЭТП России
    const PLATFORM_MAP = {
      'ртс-тендер': 334,
      'ртс': 334,
      'rts-tender': 334,
      'сбербанк': 335,
      'sberbank': 335,
      'гпб': 336,
      'газпромбанк': 336,
      'еэтп': 337,
      'единая электронная': 337,
      'рад': 338,
      'российский аукционный': 338,
      'фабрикант': 339,
      'fabrikant': 339,
      'lot-online': 340,
      'лот-онлайн': 340,
      'этп россии': 341,
      'росэлторг': 341
    }

    for (const [keyword, id] of Object.entries(PLATFORM_MAP)) {
      if (name.includes(keyword)) {
        return id
      }
    }
    return null // Неизвестная площадка
  }

  /**
   * Определение типа документа по названию
   */
  detectDocumentType(typeName) {
    if (!typeName) return 571 // Иное (по умолчанию)
    const name = typeName.toLowerCase().trim()

    for (const [keyword, id] of Object.entries(DOCUMENT_TYPE_MAP)) {
      if (name.includes(keyword) || keyword.includes(name)) {
        return id
      }
    }
    return 571 // Иное
  }

  /**
   * Парсинг размера файла из строки (например "1.08 Мб" → 1132462 байт)
   */
  parseFileSize(sizeStr) {
    if (!sizeStr) return null
    const str = String(sizeStr).toLowerCase().trim()

    // Паттерны: "1.08 Мб", "17.93 Кб", "64.13 KB", "1024 bytes"
    const match = str.match(/^([\d.,]+)\s*(кб|kb|мб|mb|гб|gb|байт|bytes?)?$/i)
    if (!match) return null

    const value = parseFloat(match[1].replace(',', '.'))
    const unit = (match[2] || 'bytes').toLowerCase()

    const multipliers = {
      'байт': 1, 'bytes': 1, 'byte': 1,
      'кб': 1024, 'kb': 1024,
      'мб': 1024 * 1024, 'mb': 1024 * 1024,
      'гб': 1024 * 1024 * 1024, 'gb': 1024 * 1024 * 1024
    }

    const multiplier = multipliers[unit] || 1
    return Math.round(value * multiplier)
  }

  /**
   * Сохранение документа как подчинённого объекта лота
   * @param {number} lotId - ID лота (родительский объект)
   * @param {Object} docData - Данные документа
   */
  async saveDocument(lotId, docData) {
    const fields = this.integramConfig.documentFields
    const tables = this.integramConfig.tables

    // Название документа (основное поле)
    const docName = docData.name || docData.fileName || docData.title || 'Документ'

    // Подготовка реквизитов
    const requisites = {}

    // Тип документа (reference)
    const docType = docData.type || docData.documentType || docData.category || ''
    const docTypeId = this.detectDocumentType(docType)
    requisites[String(fields.documentType)] = String(docTypeId)

    // URL документа
    const url = docData.url || docData.downloadUrl || docData.fileUrl || ''
    if (url) {
      requisites[String(fields.url)] = url
    }

    // Размер файла
    const fileSize = docData.size || docData.fileSize
    if (fileSize) {
      const sizeBytes = typeof fileSize === 'number' ? fileSize : this.parseFileSize(fileSize)
      if (sizeBytes) {
        requisites[String(fields.fileSize)] = String(sizeBytes)
      }
    }

    // Дата публикации
    const pubDate = docData.publishDate || docData.date || docData.uploadDate
    if (pubDate) {
      requisites[String(fields.publishDate)] = this.formatDateTime(pubDate)
    }

    try {
      // Создаём документ как подчинённый объект лота
      const url = this.integramClient.buildURL(`_m_new/${tables.document}`)
      const postData = new URLSearchParams()

      if (this.integramClient.xsrfToken) {
        postData.append('_xsrf', this.integramClient.xsrfToken)
      }

      // Основное поле документа
      postData.append(`t${tables.document}`, docName)
      // Родительский объект (лот)
      postData.append('parent', String(lotId))

      // Добавляем реквизиты
      for (const [key, value] of Object.entries(requisites)) {
        postData.append(`t${key}`, value)
      }

      const response = await axios.post(url, postData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Authorization': this.integramClient.token
        }
      })

      const result = response.data
      const newId = result?.id || result?.obj

      if (newId) {
        // Устанавливаем реквизиты через _m_set для надёжности
        await this.integramClient.setObjectRequisites(newId, requisites)
        return { success: true, id: newId, name: docName }
      }

      return { success: false, error: 'Failed to create document object' }
    } catch (error) {
      console.error(`[TorgiParser] Error saving document: ${error.message}`)
      return { success: false, error: error.message }
    }
  }

  /**
   * Сохранение всех документов лота
   * @param {number} lotId - ID лота
   * @param {Array} documents - Массив документов
   */
  async saveLotDocuments(lotId, documents) {
    if (!documents || !Array.isArray(documents) || documents.length === 0) {
      return { success: true, savedCount: 0, documents: [] }
    }

    const results = []
    for (const doc of documents) {
      const result = await this.saveDocument(lotId, doc)
      results.push(result)
    }

    const savedCount = results.filter(r => r.success).length
    this.stats.documentsSaved += savedCount
    console.log(`[TorgiParser] Saved ${savedCount}/${documents.length} documents for lot ${lotId}`)

    return {
      success: true,
      savedCount,
      totalDocuments: documents.length,
      documents: results
    }
  }

  /**
   * Определение ID региона по названию
   */
  detectRegion(regionName) {
    if (!regionName) return null
    const name = regionName.toLowerCase()

    // Маппинг регионов на ID объектов в таблице 322
    const REGION_MAP = {
      'москва': 323,
      'санкт-петербург': 324,
      'московская': 325,
      'ленинградская': 326,
      'краснодарский': 327,
      'свердловская': 328,
      'новосибирская': 329,
      'татарстан': 330,
      'башкортостан': 331,
      'нижегородская': 332,
      'хмао': 1513,
      'тюменская': 1514,
      'челябинская': 1515,
      'самарская': 1516,
      'ростовская': 1517,
      'воронежская': 1518,
      'пермский': 1519,
      'красноярский': 1520,
      'кемеровская': 1521,
      'тульская': 1522,
      'калужская': 1523,
      'чеченская': 1524,
      'волгоградская': 1756,
      'мордовия': 2093,
      'ивановская': 2174,
      'вологодская': 2409
    }

    for (const [keyword, id] of Object.entries(REGION_MAP)) {
      if (name.includes(keyword)) {
        return id
      }
    }
    return null // Неизвестный регион
  }

  /**
   * Поиск лота по ID torgi.gov
   */
  async findLotByTorgiId(torgiId) {
    try {
      const result = await this.integramClient.getObjectList(
        this.integramConfig.tables.lot,
        { search: torgiId, limit: 10 }
      )

      const objects = result.object || result || []
      for (const obj of objects) {
        if (obj.val === torgiId || obj.v === torgiId) {
          return parseInt(obj.id)
        }
      }
      return null
    } catch (error) {
      console.error(`[TorgiParser] Error finding lot: ${error.message}`)
      return null
    }
  }

  /**
   * Сохранение лота в Integram
   */
  async saveLot(lotData) {
    const torgiId = String(lotData.id || '')
    if (!torgiId) {
      return { success: false, error: 'No lot ID' }
    }

    try {
      const requisites = this.prepareLotRequisites(lotData)
      const existingId = await this.findLotByTorgiId(torgiId)

      if (existingId) {
        // Обновляем существующий
        await this.integramClient.setObjectRequisites(existingId, requisites)
        this.stats.updatedLots++
        return { success: true, id: existingId, isNew: false }
      } else {
        // Создаём новый - главное поле = ID лота на torgi.gov
        const fields = this.integramConfig.lotFields

        // Базовые поля (не reference) для создания
        const basicReqs = {}
        const refReqs = {}
        // Reference fields must be set via setObjectRequisites, not during creation
        const refFields = [fields.status, fields.bidType, fields.category, fields.region, fields.platform]

        for (const [key, value] of Object.entries(requisites)) {
          if (refFields.includes(parseInt(key))) {
            refReqs[key] = value
          } else {
            basicReqs[key] = value
          }
        }

        const result = await this.integramClient.createObject(
          this.integramConfig.tables.lot,
          torgiId,  // Главное поле = ID лота на torgi.gov
          basicReqs
        )

        const newId = result?.id || result?.obj
        if (newId) {
          // После создания устанавливаем reference-поля отдельно
          console.log(`[TorgiParser DEBUG] Setting reference fields for object ${newId}:`, JSON.stringify(refReqs))
          if (Object.keys(refReqs).length > 0) {
            const setResult = await this.integramClient.setObjectRequisites(newId, refReqs)
            console.log(`[TorgiParser DEBUG] setObjectRequisites result:`, JSON.stringify(setResult))
          } else {
            console.log(`[TorgiParser DEBUG] No reference fields to set`)
          }

          // Сохраняем документы лота (если есть)
          // Сначала пробуем извлечь из данных лота, потом запрашиваем отдельно
          let documents = this.extractDocumentsFromLotData(lotData)
          if (documents.length === 0 && torgiId) {
            // Документы не найдены в ответе - запрашиваем отдельно
            documents = await this.getLotDocuments(torgiId)
          }
          let docsResult = null
          if (documents.length > 0) {
            docsResult = await this.saveLotDocuments(newId, documents)
          }

          this.stats.newLots++
          return { success: true, id: newId, isNew: true, documentsResult: docsResult }
        }
        return { success: false, error: 'Failed to create object' }
      }
    } catch (error) {
      this.stats.errors++
      return { success: false, error: error.message }
    }
  }

  /**
   * Сохранение лота с документами (расширенная версия)
   * @param {Object} lotData - Данные лота
   * @param {Array} documents - Массив документов (опционально, если не в lotData)
   */
  async saveLotWithDocuments(lotData, documents = null) {
    // Добавляем документы в lotData если переданы отдельно
    if (documents && Array.isArray(documents)) {
      lotData.documents = documents
    }

    const result = await this.saveLot(lotData)

    // Если лот существовал (isNew: false), документы не были сохранены автоматически
    // Сохраняем их отдельно
    if (result.success && !result.isNew && result.id) {
      let docs = this.extractDocumentsFromLotData(lotData)
      if (docs.length === 0 && lotData.id) {
        docs = await this.getLotDocuments(lotData.id)
      }
      if (docs.length > 0) {
        result.documentsResult = await this.saveLotDocuments(result.id, docs)
      }
    }

    return result
  }

  /**
   * Создание записи лога
   */
  async createLogEntry(status = 'running', message = '') {
    const fields = this.integramConfig.logFields
    const name = `Парсинг ${new Date().toLocaleString('ru-RU')}`

    const requisites = {
      [String(fields.startDate)]: new Date().toLocaleString('ru-RU'),
      [String(fields.status)]: status,
      [String(fields.message)]: message.substring(0, 2000)
    }

    try {
      const result = await this.integramClient.createObject(
        this.integramConfig.tables.log,
        name,
        requisites
      )
      return result?.id || result?.obj
    } catch (error) {
      console.error(`[TorgiParser] Error creating log: ${error.message}`)
      return null
    }
  }

  /**
   * Обновление записи лога
   */
  async updateLogEntry(logId, total, status = 'done', message = '') {
    const fields = this.integramConfig.logFields

    const requisites = {
      [String(fields.totalLots)]: String(total),
      [String(fields.status)]: status,
      [String(fields.message)]: message.substring(0, 2000)
    }

    try {
      await this.integramClient.setObjectRequisites(logId, requisites)
    } catch (error) {
      console.error(`[TorgiParser] Error updating log: ${error.message}`)
    }
  }

  /**
   * Задержка между запросами
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Запуск полного парсинга
   */
  async runFullParsing(options = {}) {
    if (this.isRunning) {
      throw new Error('Parser is already running')
    }

    this.isRunning = true
    this.stats = { totalFetched: 0, newLots: 0, updatedLots: 0, errors: 0 }

    const maxPages = options.maxPages || this.config.maxPages
    const searchParams = options.searchParams || {}

    console.log('[TorgiParser] Starting full parsing...')
    const logId = await this.createLogEntry('running', 'Запуск парсинга')

    try {
      let page = 0
      let hasMore = true

      while (hasMore && page < maxPages) {
        console.log(`[TorgiParser] Fetching page ${page + 1}...`)

        const result = await this.searchLots({ ...searchParams, page })
        const lots = result.content || result.list || []

        if (lots.length === 0) {
          hasMore = false
          break
        }

        for (const lot of lots) {
          const saveResult = await this.saveLot(lot)
          this.stats.totalFetched++

          if (!saveResult.success) {
            console.error(`[TorgiParser] Failed to save lot ${lot.id}: ${saveResult.error}`)
          }
        }

        // Обновляем лог каждые 10 страниц
        if (page % 10 === 0 && logId) {
          await this.updateLogEntry(
            logId,
            this.stats.totalFetched,
            'running',
            `Обработано ${this.stats.totalFetched} лотов, новых: ${this.stats.newLots}`
          )
        }

        page++
        hasMore = lots.length === this.config.pageSize

        if (hasMore) {
          await this.delay(this.config.requestDelay)
        }
      }

      // Финальное обновление лога
      const finalMessage = `Завершено. Всего: ${this.stats.totalFetched}, новых: ${this.stats.newLots}, обновлено: ${this.stats.updatedLots}, ошибок: ${this.stats.errors}`

      if (logId) {
        await this.updateLogEntry(logId, this.stats.totalFetched, 'done', finalMessage)
      }

      console.log(`[TorgiParser] ${finalMessage}`)

      return {
        success: true,
        stats: { ...this.stats },
        logId
      }
    } catch (error) {
      const errorMessage = `Ошибка: ${error.message}`

      if (logId) {
        await this.updateLogEntry(logId, this.stats.totalFetched, 'error', errorMessage)
      }

      console.error(`[TorgiParser] ${errorMessage}`)

      return {
        success: false,
        error: error.message,
        stats: { ...this.stats },
        logId
      }
    } finally {
      this.isRunning = false
    }
  }

  /**
   * Парсинг одной страницы (для тестирования)
   */
  async parseOnePage(page = 0, searchParams = {}) {
    console.log(`[TorgiParser] Parsing page ${page}...`)

    const result = await this.searchLots({ ...searchParams, page })
    const lots = result.content || result.list || []

    const results = []
    for (const lot of lots) {
      const saveResult = await this.saveLot(lot)
      results.push({
        lotId: lot.id,
        ...saveResult
      })
    }

    return {
      page,
      totalLots: lots.length,
      results,
      stats: { ...this.stats }
    }
  }

  /**
   * Получение статистики
   */
  getStats() {
    return {
      isRunning: this.isRunning,
      ...this.stats
    }
  }

  /**
   * Парсинг описания лота и обновление полей
   * Извлекает структурированные данные из поля "Описание" (ID 348)
   * и заполняет соответствующие поля (кадастровый номер, площадь, и т.д.)
   *
   * @param {string|number} objectId - ID объекта лота в Integram
   * @returns {Promise<Object>} - Результат парсинга и обновления
   */
  async parseAndUpdateLotDescription(objectId) {
    if (!this.integramClient) {
      throw new Error('Integram client not initialized. Call initIntegram() first.')
    }

    const fields = this.integramConfig.lotFields

    try {
      // Получить данные объекта
      const objectData = await this.integramClient.getObjectEditData(objectId)

      console.log('[TorgiParser DEBUG] getObjectEditData response keys:', Object.keys(objectData || {}))
      console.log('[TorgiParser DEBUG] Has reqs:', !!(objectData && objectData.reqs))

      if (!objectData || !objectData.reqs) {
        console.log('[TorgiParser DEBUG] objectData:', JSON.stringify(objectData).substring(0, 500))
        return {
          success: false,
          error: 'Object not found or no requisites data',
          objectId
        }
      }

      // Получить описание из поля 348
      const descriptionReq = objectData.reqs[String(fields.description)]
      if (!descriptionReq || !descriptionReq.value) {
        return {
          success: false,
          error: 'No description field found',
          objectId
        }
      }

      const description = descriptionReq.value

      // Парсить описание
      const parsedData = parseDescription(description)

      if (Object.keys(parsedData).length === 0) {
        return {
          success: true,
          extracted: false,
          message: 'No structured data found in description',
          objectId,
          description: description.substring(0, 100) + '...'
        }
      }

      // Подготовить обновления для Integram
      const updates = {}

      if (parsedData.cadastralNumber && fields.cadastralNumber) {
        updates[String(fields.cadastralNumber)] = parsedData.cadastralNumber
      }

      if (parsedData.area !== undefined && fields.area) {
        updates[String(fields.area)] = String(parsedData.area)
      }

      if (parsedData.permittedUse && fields.permittedUse) {
        updates[String(fields.permittedUse)] = parsedData.permittedUse.substring(0, 500)
      }

      if (parsedData.ownershipForm && fields.ownershipForm) {
        updates[String(fields.ownershipForm)] = parsedData.ownershipForm.substring(0, 200)
      }

      if (parsedData.restrictions && fields.restrictions) {
        updates[String(fields.restrictions)] = parsedData.restrictions.substring(0, 1000)
      }

      // Обновить объект в Integram
      if (Object.keys(updates).length > 0) {
        await this.integramClient.setObjectRequisites(objectId, updates)

        return {
          success: true,
          extracted: true,
          objectId,
          parsedData,
          updatedFields: Object.keys(updates).map(id => {
            const fieldName = Object.keys(fields).find(key => String(fields[key]) === id)
            return { fieldId: id, fieldName, value: updates[id] }
          })
        }
      } else {
        return {
          success: true,
          extracted: true,
          objectId,
          parsedData,
          message: 'Data extracted but no corresponding fields to update'
        }
      }
    } catch (error) {
      console.error(`[TorgiParser] Error parsing description for object ${objectId}:`, error)
      return {
        success: false,
        error: error.message,
        objectId
      }
    }
  }

  /**
   * Парсинг описаний для нескольких лотов
   *
   * @param {Array<string|number>} objectIds - Массив ID объектов
   * @param {Object} options - Опции
   * @param {number} options.batchSize - Размер batch для обработки (default: 10)
   * @param {number} options.delayMs - Задержка между batch в мс (default: 1000)
   * @returns {Promise<Object>} - Сводные результаты
   */
  async parseAndUpdateMultipleLots(objectIds, options = {}) {
    const { batchSize = 10, delayMs = 1000 } = options

    const results = {
      total: objectIds.length,
      success: 0,
      failed: 0,
      extracted: 0,
      notExtracted: 0,
      details: []
    }

    console.log(`[TorgiParser] Starting description parsing for ${objectIds.length} lots...`)

    // Process in batches to avoid overloading the API
    for (let i = 0; i < objectIds.length; i += batchSize) {
      const batch = objectIds.slice(i, i + batchSize)
      console.log(`[TorgiParser] Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(objectIds.length / batchSize)}...`)

      const batchPromises = batch.map(id => this.parseAndUpdateLotDescription(id))
      const batchResults = await Promise.all(batchPromises)

      for (const result of batchResults) {
        results.details.push(result)

        if (result.success) {
          results.success++
          if (result.extracted) {
            results.extracted++
          } else {
            results.notExtracted++
          }
        } else {
          results.failed++
        }
      }

      // Delay between batches
      if (i + batchSize < objectIds.length) {
        await new Promise(resolve => setTimeout(resolve, delayMs))
      }
    }

    console.log(`[TorgiParser] Description parsing completed: ${results.success}/${results.total} успешно, ${results.extracted} с данными`)

    return results
  }

  /**
   * Парсинг описаний для всех лотов в базе (по условию)
   *
   * @param {Object} options - Опции фильтрации и обработки
   * @param {number} options.limit - Максимальное количество лотов для обработки
   * @param {number} options.offset - Смещение
   * @param {boolean} options.onlyEmpty - Обрабатывать только лоты с пустыми полями (default: true)
   * @returns {Promise<Object>} - Результаты парсинга
   */
  async parseAllDescriptions(options = {}) {
    if (!this.integramClient) {
      throw new Error('Integram client not initialized. Call initIntegram() first.')
    }

    const {
      limit = 100,
      offset = 0,
      onlyEmpty = true
    } = options

    console.log(`[TorgiParser] Fetching lots from Integram (limit: ${limit}, offset: ${offset})...`)

    // Получить список лотов
    const objectList = await this.integramClient.getObjectList(
      this.integramConfig.tables.lot,
      { offset, limit }
    )

    if (!objectList || !objectList.object || objectList.object.length === 0) {
      return {
        success: true,
        message: 'No lots found',
        total: 0
      }
    }

    const lots = objectList.object
    console.log(`[TorgiParser] Found ${lots.length} lots`)

    // Фильтровать лоты если onlyEmpty = true
    let lotsToProcess = lots

    if (onlyEmpty) {
      // Получить reqs для проверки пустых полей
      const reqs = objectList.reqs || {}
      lotsToProcess = lots.filter(lot => {
        const lotReqs = reqs[lot.id] || {}
        const fields = this.integramConfig.lotFields

        // Проверяем, пусты ли поля кадастрового номера или площади
        const cadastralEmpty = !lotReqs[String(fields.cadastralNumber)]
        const areaEmpty = !lotReqs[String(fields.area)]

        return cadastralEmpty || areaEmpty
      })

      console.log(`[TorgiParser] Filtered to ${lotsToProcess.length} lots with empty fields`)
    }

    if (lotsToProcess.length === 0) {
      return {
        success: true,
        message: 'No lots need processing',
        total: 0
      }
    }

    // Получить ID лотов
    const objectIds = lotsToProcess.map(lot => lot.id)

    // Обработать описания
    return await this.parseAndUpdateMultipleLots(objectIds, {
      batchSize: 10,
      delayMs: 1000
    })
  }
}

export default TorgiParserService
