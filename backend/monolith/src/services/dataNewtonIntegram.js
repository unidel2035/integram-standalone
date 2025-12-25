/**
 * DataNewton to Integram Integration Service
 * Сохраняет данные о компании из DataNewton API в таблицу Реквизит (209592)
 */

import axios from 'axios'

// In-memory кэш для данных компаний (TTL: 1 час)
const CACHE_TTL_MS = 60 * 60 * 1000 // 1 час
const companyDataCache = new Map()

// Кэш для описаний параметров (paramId -> description)
let paramDescriptionsCache = null
let paramDescriptionsCacheTime = 0

// Кэш для маппинга API ключей на ID параметров (apiKey -> paramId)
let paramIdMapCache = null
let paramIdMapCacheTime = 0

function getCachedData(inn) {
  const cached = companyDataCache.get(inn)
  if (cached && (Date.now() - cached.timestamp) < CACHE_TTL_MS) {
    console.log(`[DataNewton] Cache HIT for INN: ${inn}`)
    return cached.data
  }
  return null
}

function setCachedData(inn, data) {
  companyDataCache.set(inn, {
    data,
    timestamp: Date.now()
  })
  console.log(`[DataNewton] Cached data for INN: ${inn}`)
}

// Кэш для API ключей DataNewton
let apiKeysCache = null
let apiKeysCacheTime = 0
const API_KEYS_CACHE_TTL = 5 * 60 * 1000 // 5 минут

/**
 * Загружает список API ключей из Integram таблицы 211208
 * Ключи принадлежат домену 211218 (DataNewton)
 */
async function loadDataNewtonApiKeys(auth) {
  // Проверяем кэш
  if (apiKeysCache && (Date.now() - apiKeysCacheTime) < API_KEYS_CACHE_TTL) {
    return apiKeysCache
  }

  try {
    const url = `${INTEGRAM_CONFIG.serverURL}/${INTEGRAM_CONFIG.database}/object/211208?JSON_KV&F_U=211218`
    const response = await axios.get(url, {
      headers: { 'X-Authorization': auth.token }
    })

    const objects = response.data?.object || []
    const keys = objects.map(obj => obj.val).filter(Boolean)

    console.log(`[DataNewton] Loaded ${keys.length} API keys from Integram`)
    console.log(`[DataNewton] Keys: ${keys.map((k, i) => `${i+1}:${k.substring(0, 4)}...${k.substring(k.length-4)}`).join(', ')}`)

    apiKeysCache = keys
    apiKeysCacheTime = Date.now()

    return keys
  } catch (error) {
    console.error('[DataNewton] Failed to load API keys from Integram:', error.message)
    // Fallback на hardcoded ключи
    return ['eStY3NadO5TA', 'IHWdzAdKdnIB', 'zECcwmjA7Q8q']
  }
}

/**
 * Делает запрос к DataNewton API с автоматическим переключением ключей при 401
 */
async function fetchWithKeyRotation(url, params, auth, options = {}) {
  const keys = await loadDataNewtonApiKeys(auth)

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i]

    try {
      console.log(`[DataNewton] Trying key #${i + 1}/${keys.length} for ${url}`)

      const response = await axios.get(url, {
        params: { ...params, key },
        timeout: options.timeout || 15000,
        headers: {
          'User-Agent': 'DronDoc/1.0',
          'Accept': 'application/json',
          ...options.headers
        }
      })

      console.log(`[DataNewton] ✅ Key #${i + 1} worked`)
      return response

    } catch (error) {
      const status = error.response?.status
      const errorData = error.response?.data
      const isLastKey = i === keys.length - 1

      console.error(`[DataNewton] ❌ Key #${i + 1} FAILED: status=${status}, error=${JSON.stringify(errorData)}`)

      // Переключаемся на следующий ключ при 401 (неавторизован) или 409 (превышен лимит)
      if ((status === 401 || status === 409) && !isLastKey) {
        console.warn(`[DataNewton] ⚠️ Key #${i + 1} returned ${status}, trying next key...`)
        continue // Пробуем следующий ключ
      }

      // Если это последний ключ или ошибка не 401 - пробрасываем ошибку
      console.error(`[DataNewton] 🛑 Throwing error - isLastKey=${isLastKey}, status=${status}`)
      throw error
    }
  }

  throw new Error('All API keys exhausted')
}

/**
 * Загружает описания параметров из справочника 209590 (реквизит 209600 = "Описание")
 */
async function loadParamDescriptions(auth) {
  // Проверяем кэш
  if (paramDescriptionsCache && (Date.now() - paramDescriptionsCacheTime) < CACHE_TTL_MS) {
    console.log(`[Integram] Param descriptions cache HIT`)
    return paramDescriptionsCache
  }

  console.log(`[Integram] Loading param descriptions from table 209590...`)

  // Используем правильный эндпоинт object/{typeId} с пагинацией
  const url = `${INTEGRAM_CONFIG.serverURL}/${INTEGRAM_CONFIG.database}/object/${INTEGRAM_CONFIG.paramApiTableId}?JSON_KV`

  const response = await axios.get(url, {
    headers: {
      'X-Authorization': auth.token
    },
    params: {
      LIMIT: 300,
      pg: 1
    }
  })

  const descriptions = {}

  // Парсим ответ: object содержит список объектов, reqs содержит их реквизиты
  if (response.data?.object && response.data?.reqs) {
    for (const obj of response.data.object) {
      const objId = String(obj.id)
      const reqData = response.data.reqs[objId]
      if (reqData && reqData['209600']) {
        // 209600 = Описание (Description)
        descriptions[objId] = reqData['209600']
      } else {
        // Если нет описания, используем val объекта
        descriptions[objId] = obj.val || objId
      }
    }
  }

  paramDescriptionsCache = descriptions
  paramDescriptionsCacheTime = Date.now()

  console.log(`[Integram] Loaded ${Object.keys(descriptions).length} param descriptions`)

  return descriptions
}

/**
 * Загружает маппинг API ключей на ID параметров из справочника 209590
 * Возвращает: { 'inn': '209602', 'company.kpp': '209626', ... }
 */
async function loadParamIdMap(auth) {
  // Проверяем кэш
  if (paramIdMapCache && (Date.now() - paramIdMapCacheTime) < CACHE_TTL_MS) {
    console.log(`[Integram] Param ID map cache HIT (${Object.keys(paramIdMapCache).length} keys)`)
    return paramIdMapCache
  }

  console.log(`[Integram] Loading param ID map from table 209590...`)

  const url = `${INTEGRAM_CONFIG.serverURL}/${INTEGRAM_CONFIG.database}/object/${INTEGRAM_CONFIG.paramApiTableId}?JSON_KV`

  const response = await axios.get(url, {
    headers: {
      'X-Authorization': auth.token
    },
    params: {
      LIMIT: 300,
      pg: 1
    }
  })

  const paramIdMap = {}

  // Парсим ответ: object.val = API ключ, object.id = ID параметра
  if (response.data?.object) {
    for (const obj of response.data.object) {
      const apiKey = obj.val  // e.g., "inn", "company.kpp", "links.nodes"
      const paramId = String(obj.id)  // e.g., "209602"
      paramIdMap[apiKey] = paramId
    }
  }

  paramIdMapCache = paramIdMap
  paramIdMapCacheTime = Date.now()

  console.log(`[Integram] Loaded ${Object.keys(paramIdMap).length} param ID mappings`)

  return paramIdMap
}

// Статический маппинг (legacy fallback) - используется если не удалось загрузить динамический
const PARAM_ID_MAP_STATIC = {
  // Основные поля counterparty
  'inn': '209602',
  'fio': '209607',
  'registration_date': '209608',
  'years_from_registration': '209609',
  'ogrn': '209618',
  'available_count': '209621',

  // Company fields
  'company.kpp': '209626',
  'company.opf': '209629',
  'company.address': '209632',
  'company.registration_date': '209635',
  'company.years_from_registration': '209638',
  'company.okveds': '209641',
  'company.managers': '209644',
  'company.management_company': '209647',
  'company.dissolved_date': '209650',
  'company.ros_stat_codes': '209653',
  'company.owners': '209656',
  'company.charter_capital': '209659',
  'company.negative_lists': '209662',
  'company.workers_count': '209665',
  'company.contacts': '209668',
  'company.predecessors': '209671',
  'company.successors': '209674',
  'company.company_names.short_name': '209677',
  'company.company_names.full_name': '209680',
  'company.company_names.reversed_short_name': '209683',
  'company.status.code_egr': '209686',
  'company.status.status_eng_short': '209689',
  'company.status.status_rus_short': '209692',
  'company.status.status_egr': '209695',
  'company.status.active_status': '209698',
  'company.status.date_end': '209701',
  'company.tax_mode_info.publication_date': '209704',
  'company.tax_mode_info.eshn_sign': '209707',
  'company.tax_mode_info.usn_sign': '209710',
  'company.tax_mode_info.envd_sign': '209713',
  'company.tax_mode_info.srp_sign': '209716',
  'company.tax_mode_info.ausn_sign': '209719',
  'company.tax_mode_info.psn_sign': '209722',
  'company.tax_mode_info.npd_sign': '209725',
  'company.tax_mode_info.common_mode': '209728',

  // Individual (ИП) fields
  'individual.fio': '209731',
  'individual.registration_date': '209734',
  'individual.years_from_registration': '209737',
  'individual.vid_iptext': '209740',
  'individual.status.code_egr': '209743',
  'individual.status.status_eng_short': '209746',
  'individual.status.status_rus_short': '209749',
  'individual.status.status_egr': '209752',
  'individual.status.active_status': '209755',
  'individual.status.date_end': '209758',
  'individual.tax_mode_info.publication_date': '209761',
  'individual.tax_mode_info.eshn_sign': '209764',
  'individual.tax_mode_info.usn_sign': '209767',
  'individual.tax_mode_info.envd_sign': '209770',
  'individual.tax_mode_info.srp_sign': '209773',
  'individual.tax_mode_info.ausn_sign': '209776',
  'individual.tax_mode_info.psn_sign': '209779',
  'individual.tax_mode_info.npd_sign': '209782',
  'individual.tax_mode_info.common_mode': '209785',

  // Links
  'links.ogrn_root': '209788',
  'links.inn_root': '209791',
  'links.nodes_count': '209794',
  'links.edges_count': '209797',
  'links.nodes': '209800',
  'links.max_level': '209827',
  'links.edge_types': '209830',
  'links.available_count': '213713',

  // Links - nodes array elements (детали узлов графа связей)
  'links.nodes.ogrn': '213733',
  'links.nodes.inn': '213729',
  'links.nodes.name': '213731',
  'links.nodes.type': '213737',
  'links.nodes.status': '213735',
  'links.nodes.activity_kind': '213725',
  'links.nodes.activity_kind_dsc': '213727',

  // Links - edges array elements (детали ребер графа связей)
  'links.edges.inn_source': '213715',
  'links.edges.inn_target': '213717',
  'links.edges.level': '213719',
  'links.edges.type': '213721',
  'links.edges.value': '213723',

  // Risks
  'risks.ogrn': '210001',
  'risks.flags': '210004',

  // Scoring
  'scoring.score': '210070',
  'scoring.rating': '210073',

  // Arbitration
  'arbitration-cases.total_cases': '210076',
  'arbitration-cases.data': '210085',

  // Finance
  'finance.balances': '209974',

  // Tax Info
  'taxInfo.paid_taxes': '210031',
  'taxInfo.fines_debts': '210034',
  'taxInfo.tax_offences': '210037',

  // Bankruptcy
  'bankruptcy.total': '209911',
  'bankruptcy.data': '209920',

  // Inspections
  'inspections.data': '210043',
  'inspections.total': '210046',

  // Government Contracts
  'governmentContracts.data': '210052',
  'governmentContracts.total': '210055'
}

// PARAM_ID_MAP - используется динамическая загрузка, но можно fallback на статический
// Используем объект-обертку для совместимости с ES modules (let нельзя экспортировать при reassign)
const PARAM_ID_MAP = Object.assign({}, PARAM_ID_MAP_STATIC)

// Функция для обновления маппинга (вызывается после loadParamIdMap)
function updateParamIdMap(newMap) {
  // Очищаем и копируем новые значения
  Object.keys(PARAM_ID_MAP).forEach(key => delete PARAM_ID_MAP[key])
  Object.assign(PARAM_ID_MAP, newMap)
}

// Integram API configuration
const INTEGRAM_CONFIG = {
  serverURL: 'https://dronedoc.ru',
  database: 'my',
  requisiteTableId: 209592,  // Таблица "Реквизит"
  paramRefReqId: 209595,     // Реквизит "Параметр API" (ссылка на 209590)
  valueReqId: 209597,        // Реквизит "Значение"
  organizationTableId: 197000,  // Таблица "Организация"
  paramApiTableId: 209590    // Справочник "Параметр API" (с Описанием в реквизите 209600)
}

/**
 * Извлекает значение из вложенного объекта по пути
 */
function getNestedValue(obj, path) {
  const parts = path.split('.')
  let value = obj

  for (const part of parts) {
    if (value === null || value === undefined) return null
    value = value[part]
  }

  return value
}

/**
 * Преобразует значение в строку для хранения
 */
function stringifyValue(value) {
  if (value === null || value === undefined) return ''
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

/**
 * Авторизуется в Integram
 */
async function authenticateIntegram(login, password) {
  const authUrl = `${INTEGRAM_CONFIG.serverURL}/${INTEGRAM_CONFIG.database}/auth?JSON_KV`

  console.log(`[Integram] Authenticating: ${authUrl}, login=${login}`)

  const formData = new URLSearchParams()
  formData.append('login', login)
  formData.append('pwd', password)

  try {
    const response = await axios.post(authUrl, formData, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    })

    console.log('[Integram] Authentication successful')

    return {
      token: response.data.token,
      xsrf: response.data._xsrf
    }
  } catch (error) {
    console.error('[Integram] Authentication failed:', error.message)
    console.error('[Integram] Auth URL:', authUrl)
    console.error('[Integram] Response status:', error.response?.status)
    console.error('[Integram] Response data:', error.response?.data)
    throw error
  }
}

/**
 * Создает объект "Реквизит" в Integram
 * @param {Object} auth - авторизация
 * @param {string} organizationId - ID организации-родителя
 * @param {string} paramId - ID параметра API
 * @param {*} value - значение параметра
 * @param {Object} descriptions - маппинг paramId -> описание (для имени объекта)
 */
async function createRequisiteObject(auth, organizationId, paramId, value, descriptions = {}) {
  // Используем _m_new/{typeId} как в MCP integram-server.js
  const url = `${INTEGRAM_CONFIG.serverURL}/${INTEGRAM_CONFIG.database}/_m_new/${INTEGRAM_CONFIG.requisiteTableId}?JSON_KV`

  // Используем описание из справочника как имя объекта, иначе значение
  const objectName = descriptions[paramId] || stringifyValue(value).substring(0, 100)

  // Формируем данные для POST в формате t{id}
  const formData = new URLSearchParams()
  formData.append('up', organizationId)  // parent ID
  formData.append(`t${INTEGRAM_CONFIG.requisiteTableId}`, objectName)  // Название объекта (из Описания)
  formData.append(`t${INTEGRAM_CONFIG.paramRefReqId}`, paramId)  // Параметр API (ссылка)
  formData.append(`t${INTEGRAM_CONFIG.valueReqId}`, stringifyValue(value))  // Значение
  formData.append('_xsrf', auth.xsrf)

  console.log(`[Integram] Creating requisite: paramId=${paramId}, name="${objectName}", parent=${organizationId}`)

  const response = await axios.post(url, formData, {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'X-Authorization': auth.token
    }
  })

  const newObjectId = response.data?.id
  console.log(`[Integram] Created object: ${newObjectId}`)

  return newObjectId
}

/**
 * Маппинг полей DataNewton на реквизиты таблицы Организация (197000)
 */
const ORGANIZATION_FIELD_MAP = {
  // Основные идентификаторы
  '198195': (cp) => cp?.inn,                                    // ИНН
  '198239': (cp) => cp?.ogrn,                                   // ОГРН
  '198265': (cp) => cp?.individual?.ogrnip,                     // ОГРНИП (для ИП)
  '198266': (cp) => cp?.company?.kpp,                           // КПП

  // Наименования
  '198267': (cp) => cp?.company?.company_names?.short_name,     // Краткое наименование

  // Адрес
  '198268': (cp) => {                                           // Полный адрес
    const addr = cp?.company?.address
    if (!addr) return null
    if (typeof addr === 'string') return addr
    // Собираем адрес из объекта
    return [addr.zip, addr.region, addr.city, addr.street, addr.house]
      .filter(Boolean).join(', ')
  },
  '198269': (cp) => cp?.company?.address?.zip,                  // Почтовый индекс

  // Даты и капитал
  '198270': (cp) => cp?.company?.registration_date,             // Дата регистрации
  '198271': (cp) => {                                           // Уставный капитал
    const capital = cp?.company?.charter_capital
    if (!capital) return null
    if (typeof capital === 'object') return capital.sum || capital.value
    return capital
  },

  // Руководитель
  '198272': (cp) => {                                           // ФИО руководителя
    const managers = cp?.company?.managers
    if (Array.isArray(managers) && managers.length > 0) {
      const head = managers.find(m => m.is_head) || managers[0]
      return head?.fio || head?.name
    }
    return null
  },
  '198273': (cp) => {                                           // Должность руководителя
    const managers = cp?.company?.managers
    if (Array.isArray(managers) && managers.length > 0) {
      const head = managers.find(m => m.is_head) || managers[0]
      return head?.position || head?.post
    }
    return null
  },
  '198274': (cp) => {                                           // ИНН руководителя
    const managers = cp?.company?.managers
    if (Array.isArray(managers) && managers.length > 0) {
      const head = managers.find(m => m.is_head) || managers[0]
      return head?.inn
    }
    return null
  },

  // Количество сотрудников
  '209401': (cp) => cp?.company?.workers_count,                 // Количество сотрудников
}

/**
 * Обновляет организацию после парсинга данных из DataNewton:
 * - Имя из company.company_names.short_name
 * - Все доступные поля: ИНН, ОГРН, КПП, адрес, руководитель, капитал и т.д.
 */
async function updateOrganizationName(auth, organizationId, companyData) {
  const cp = companyData?.counterparty
  if (!cp) {
    console.log(`[Integram] No counterparty data for organization ${organizationId}`)
    return false
  }

  // Имя организации (используем short_name или full_name)
  const shortName = cp?.company?.company_names?.short_name ||
                    cp?.company?.company_names?.full_name ||
                    cp?.individual?.fio  // Для ИП используем ФИО

  console.log(`[Integram] Updating organization ${organizationId}:`)
  console.log(`  - Name: ${shortName || '(not changed)'}`)

  // Используем _m_save/{objectId} для обновления объекта
  const url = `${INTEGRAM_CONFIG.serverURL}/${INTEGRAM_CONFIG.database}/_m_save/${organizationId}?JSON_KV`

  const formData = new URLSearchParams()
  let fieldsUpdated = 0

  // Имя организации
  if (shortName) {
    formData.append(`t${INTEGRAM_CONFIG.organizationTableId}`, shortName)
    fieldsUpdated++
  }

  // Заполняем все доступные поля из маппинга
  for (const [reqId, extractor] of Object.entries(ORGANIZATION_FIELD_MAP)) {
    try {
      const value = extractor(cp)
      if (value !== null && value !== undefined && value !== '') {
        const strValue = typeof value === 'object' ? JSON.stringify(value) : String(value)
        formData.append(`t${reqId}`, strValue)
        fieldsUpdated++
        console.log(`  - Req ${reqId}: ${strValue.substring(0, 50)}${strValue.length > 50 ? '...' : ''}`)
      }
    } catch (e) {
      console.error(`  - Error extracting req ${reqId}: ${e.message}`)
    }
  }

  formData.append('_xsrf', auth.xsrf)

  const response = await axios.post(url, formData, {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'X-Authorization': auth.token
    }
  })

  console.log(`[Integram] Organization updated: ${fieldsUpdated} fields, response: ${response.data?.id || response.data?.val || 'success'}`)
  return true
}

/**
 * Получает ВСЕ данные о компании из DataNewton API
 * @param {string} inn - ИНН компании
 * @param {Object} auth - авторизация Integram (для загрузки API ключей)
 */
async function fetchAllCompanyData(inn, auth) {
  // Проверка кэша
  const cached = getCachedData(inn)
  if (cached) {
    return cached
  }

  const baseUrl = 'https://api.datanewton.ru/v1'

  const result = {
    counterparty: null,
    links: null,
    risks: null,
    scoring: null,
    finance: null,
    taxInfo: null,
    bankruptcy: null,
    inspections: null,
    governmentContracts: null,
    arbitrationCases: null
  }

  // Запрос основных данных о компании (counterparty)
  try {
    console.log(`[DataNewton] Fetching counterparty for INN: ${inn}`)
    const counterpartyResponse = await fetchWithKeyRotation(
      `${baseUrl}/counterparty`,
      { inn },
      auth,
      { timeout: 20000 }
    )
    result.counterparty = counterpartyResponse.data
    console.log(`[DataNewton] Counterparty fetched successfully`)
  } catch (error) {
    console.error(`[DataNewton] Error fetching counterparty: ${error.message}`)
    if (error.response) {
      console.error(`[DataNewton] Response status: ${error.response.status}`)
      console.error(`[DataNewton] Response data: ${JSON.stringify(error.response.data)}`)
    }
  }

  // Получаем ОГРН из counterparty для дальнейших запросов
  const ogrn = result.counterparty?.ogrn

  if (ogrn) {
    // Запрос связей (links)
    try {
      console.log(`[DataNewton] Fetching links for OGRN: ${ogrn}`)
      const linksResponse = await fetchWithKeyRotation(`${baseUrl}/links`, { ogrn }, auth)
      result.links = linksResponse.data
    } catch (error) {
      console.error(`[DataNewton] Error fetching links: ${error.message}`)
    }

    // Запрос рисков
    try {
      console.log(`[DataNewton] Fetching risks for OGRN: ${ogrn}`)
      const risksResponse = await fetchWithKeyRotation(`${baseUrl}/risks`, { ogrn }, auth)
      result.risks = risksResponse.data
    } catch (error) {
      console.error(`[DataNewton] Error fetching risks: ${error.message}`)
    }

    // Запрос скоринга
    try {
      console.log(`[DataNewton] Fetching scoring for OGRN: ${ogrn}`)
      const scoringResponse = await fetchWithKeyRotation(`${baseUrl}/scoring`, { ogrn }, auth)
      result.scoring = scoringResponse.data
    } catch (error) {
      console.error(`[DataNewton] Error fetching scoring: ${error.message}`)
    }

    // Запрос финансов
    try {
      console.log(`[DataNewton] Fetching finance for OGRN: ${ogrn}`)
      const financeResponse = await fetchWithKeyRotation(`${baseUrl}/finance`, { ogrn }, auth)
      result.finance = financeResponse.data
    } catch (error) {
      console.error(`[DataNewton] Error fetching finance: ${error.message}`)
    }

    // Запрос налоговой информации
    try {
      console.log(`[DataNewton] Fetching taxInfo for OGRN: ${ogrn}`)
      const taxInfoResponse = await fetchWithKeyRotation(`${baseUrl}/taxInfo`, { ogrn }, auth)
      result.taxInfo = taxInfoResponse.data
    } catch (error) {
      console.error(`[DataNewton] Error fetching taxInfo: ${error.message}`)
    }

    // Запрос банкротства
    try {
      console.log(`[DataNewton] Fetching bankruptcy for OGRN: ${ogrn}`)
      const bankruptcyResponse = await fetchWithKeyRotation(`${baseUrl}/bankruptcy`, { ogrn, limit: 10 }, auth)
      result.bankruptcy = bankruptcyResponse.data
    } catch (error) {
      console.error(`[DataNewton] Error fetching bankruptcy: ${error.message}`)
    }

    // Запрос проверок
    try {
      console.log(`[DataNewton] Fetching inspections for OGRN: ${ogrn}`)
      const inspectionsResponse = await fetchWithKeyRotation(`${baseUrl}/inspections`, { ogrn, limit: 10 }, auth)
      result.inspections = inspectionsResponse.data
    } catch (error) {
      console.error(`[DataNewton] Error fetching inspections: ${error.message}`)
    }

    // Запрос госконтрактов
    try {
      console.log(`[DataNewton] Fetching governmentContracts for OGRN: ${ogrn}`)
      const contractsResponse = await fetchWithKeyRotation(`${baseUrl}/governmentContracts`, { ogrn, limit: 10 }, auth)
      result.governmentContracts = contractsResponse.data
    } catch (error) {
      console.error(`[DataNewton] Error fetching governmentContracts: ${error.message}`)
    }

    // Запрос арбитражных дел
    try {
      console.log(`[DataNewton] Fetching arbitration-cases for OGRN: ${ogrn}`)
      const arbitrationResponse = await fetchWithKeyRotation(`${baseUrl}/arbitration-cases`, { ogrn, limit: 10 }, auth)
      result.arbitrationCases = arbitrationResponse.data
    } catch (error) {
      console.error(`[DataNewton] Error fetching arbitration-cases: ${error.message}`)
    }
  }

  // Сохраняем в кэш если есть хотя бы counterparty данные
  if (result.counterparty) {
    setCachedData(inn, result)
  }

  return result
}

/**
 * Сохраняет все данные о компании в Integram
 */
async function saveCompanyDataToIntegram(organizationId, companyData, auth) {
  const savedRequisites = []
  const errors = []

  // Загружаем динамический маппинг параметров из справочника 209590
  let paramIdMap = { ...PARAM_ID_MAP }
  try {
    paramIdMap = await loadParamIdMap(auth)
    // Обновляем глобальный PARAM_ID_MAP для совместимости
    updateParamIdMap(paramIdMap)
    console.log(`[Integram] Using dynamic param map with ${Object.keys(paramIdMap).length} mappings`)
  } catch (error) {
    console.error(`[Integram] Failed to load dynamic param map, using static: ${error.message}`)
    paramIdMap = { ...PARAM_ID_MAP_STATIC }
  }

  // Загружаем описания параметров для использования как имена объектов
  let descriptions = {}
  try {
    descriptions = await loadParamDescriptions(auth)
    console.log(`[Integram] Using ${Object.keys(descriptions).length} param descriptions`)
  } catch (error) {
    console.error(`[Integram] Failed to load param descriptions: ${error.message}`)
    // Продолжаем без описаний - будет использоваться значение
  }

  // Обрабатываем counterparty данные
  if (companyData.counterparty) {
    const cp = companyData.counterparty

    // Простые поля на верхнем уровне
    const topLevelFields = ['inn', 'ogrn', 'available_count']
    for (const field of topLevelFields) {
      if (cp[field] !== undefined && paramIdMap[field]) {
        try {
          const objId = await createRequisiteObject(auth, organizationId, paramIdMap[field], cp[field], descriptions)
          savedRequisites.push({ field, paramId: paramIdMap[field], objectId: objId })
        } catch (error) {
          errors.push({ field, error: error.message })
        }
      }
    }

    // Company fields
    if (cp.company) {
      const company = cp.company
      const companyFields = [
        'kpp', 'opf', 'registration_date', 'years_from_registration',
        'charter_capital', 'workers_count', 'dissolved_date'
      ]

      for (const field of companyFields) {
        const key = `company.${field}`
        if (company[field] !== undefined && paramIdMap[key]) {
          try {
            const objId = await createRequisiteObject(auth, organizationId, paramIdMap[key], company[field], descriptions)
            savedRequisites.push({ field: key, paramId: paramIdMap[key], objectId: objId })
          } catch (error) {
            errors.push({ field: key, error: error.message })
          }
        }
      }

      // Сложные объекты
      const objectFields = ['address', 'okveds', 'managers', 'ros_stat_codes', 'owners',
                           'negative_lists', 'contacts', 'predecessors', 'successors']
      for (const field of objectFields) {
        const key = `company.${field}`
        if (company[field] !== undefined && paramIdMap[key]) {
          try {
            const objId = await createRequisiteObject(auth, organizationId, paramIdMap[key], company[field], descriptions)
            savedRequisites.push({ field: key, paramId: paramIdMap[key], objectId: objId })
          } catch (error) {
            errors.push({ field: key, error: error.message })
          }
        }
      }

      // Company names
      if (company.company_names) {
        for (const [subField, value] of Object.entries(company.company_names)) {
          const key = `company.company_names.${subField}`
          if (value !== undefined && paramIdMap[key]) {
            try {
              const objId = await createRequisiteObject(auth, organizationId, paramIdMap[key], value, descriptions)
              savedRequisites.push({ field: key, paramId: paramIdMap[key], objectId: objId })
            } catch (error) {
              errors.push({ field: key, error: error.message })
            }
          }
        }
      }

      // Status
      if (company.status) {
        for (const [subField, value] of Object.entries(company.status)) {
          const key = `company.status.${subField}`
          if (value !== undefined && paramIdMap[key]) {
            try {
              const objId = await createRequisiteObject(auth, organizationId, paramIdMap[key], value, descriptions)
              savedRequisites.push({ field: key, paramId: paramIdMap[key], objectId: objId })
            } catch (error) {
              errors.push({ field: key, error: error.message })
            }
          }
        }
      }

      // Tax mode info
      if (company.tax_mode_info) {
        for (const [subField, value] of Object.entries(company.tax_mode_info)) {
          const key = `company.tax_mode_info.${subField}`
          if (value !== undefined && paramIdMap[key]) {
            try {
              const objId = await createRequisiteObject(auth, organizationId, paramIdMap[key], value, descriptions)
              savedRequisites.push({ field: key, paramId: paramIdMap[key], objectId: objId })
            } catch (error) {
              errors.push({ field: key, error: error.message })
            }
          }
        }
      }
    }

    // Individual fields (ИП)
    if (cp.individual) {
      const individual = cp.individual
      const individualFields = ['fio', 'registration_date', 'years_from_registration', 'vid_iptext']

      for (const field of individualFields) {
        const key = `individual.${field}`
        if (individual[field] !== undefined && paramIdMap[key]) {
          try {
            const objId = await createRequisiteObject(auth, organizationId, paramIdMap[key], individual[field], descriptions)
            savedRequisites.push({ field: key, paramId: paramIdMap[key], objectId: objId })
          } catch (error) {
            errors.push({ field: key, error: error.message })
          }
        }
      }

      // Individual status
      if (individual.status) {
        for (const [subField, value] of Object.entries(individual.status)) {
          const key = `individual.status.${subField}`
          if (value !== undefined && paramIdMap[key]) {
            try {
              const objId = await createRequisiteObject(auth, organizationId, paramIdMap[key], value, descriptions)
              savedRequisites.push({ field: key, paramId: paramIdMap[key], objectId: objId })
            } catch (error) {
              errors.push({ field: key, error: error.message })
            }
          }
        }
      }

      // Individual tax mode info
      if (individual.tax_mode_info) {
        for (const [subField, value] of Object.entries(individual.tax_mode_info)) {
          const key = `individual.tax_mode_info.${subField}`
          if (value !== undefined && paramIdMap[key]) {
            try {
              const objId = await createRequisiteObject(auth, organizationId, paramIdMap[key], value, descriptions)
              savedRequisites.push({ field: key, paramId: paramIdMap[key], objectId: objId })
            } catch (error) {
              errors.push({ field: key, error: error.message })
            }
          }
        }
      }
    }
  }

  // Links
  if (companyData.links) {
    // Простые поля links
    const linksFields = ['ogrn_root', 'inn_root', 'nodes_count', 'edges_count', 'max_level', 'available_count']
    for (const field of linksFields) {
      const key = `links.${field}`
      if (companyData.links[field] !== undefined && paramIdMap[key]) {
        try {
          const objId = await createRequisiteObject(auth, organizationId, paramIdMap[key], companyData.links[field], descriptions)
          savedRequisites.push({ field: key, paramId: paramIdMap[key], objectId: objId })
        } catch (error) {
          errors.push({ field: key, error: error.message })
        }
      }
    }

    // Сохранить весь массив nodes как JSON (для совместимости)
    if (companyData.links.nodes && paramIdMap['links.nodes']) {
      try {
        const objId = await createRequisiteObject(auth, organizationId, paramIdMap['links.nodes'], companyData.links.nodes, descriptions)
        savedRequisites.push({ field: 'links.nodes', paramId: paramIdMap['links.nodes'], objectId: objId })
      } catch (error) {
        errors.push({ field: 'links.nodes', error: error.message })
      }
    }

    // Сохранить каждый элемент массива nodes как отдельные реквизиты
    if (Array.isArray(companyData.links.nodes)) {
      const nodeFields = ['ogrn', 'inn', 'name', 'type', 'status', 'activity_kind', 'activity_kind_dsc']

      for (let i = 0; i < Math.min(companyData.links.nodes.length, 50); i++) {  // Ограничение: первые 50 узлов
        const node = companyData.links.nodes[i]

        for (const field of nodeFields) {
          const key = `links.nodes.${field}`
          if (node[field] !== undefined && paramIdMap[key]) {
            try {
              // Добавляем индекс к имени для различения узлов
              const objId = await createRequisiteObject(
                auth,
                organizationId,
                paramIdMap[key],
                node[field],
                { ...descriptions, [paramIdMap[key]]: `${descriptions[paramIdMap[key]] || field} [узел ${i + 1}]` }
              )
              savedRequisites.push({ field: `${key}[${i}]`, paramId: paramIdMap[key], objectId: objId })
            } catch (error) {
              errors.push({ field: `${key}[${i}]`, error: error.message })
            }
          }
        }
      }
    }

    // Сохранить массив edge_types
    if (companyData.links.edge_types && paramIdMap['links.edge_types']) {
      try {
        const objId = await createRequisiteObject(auth, organizationId, paramIdMap['links.edge_types'], companyData.links.edge_types, descriptions)
        savedRequisites.push({ field: 'links.edge_types', paramId: paramIdMap['links.edge_types'], objectId: objId })
      } catch (error) {
        errors.push({ field: 'links.edge_types', error: error.message })
      }
    }

    // Сохранить каждый элемент массива edges как отдельные реквизиты
    if (Array.isArray(companyData.links.edges)) {
      const edgeFields = ['inn_source', 'inn_target', 'level', 'type', 'value']

      for (let i = 0; i < Math.min(companyData.links.edges.length, 50); i++) {  // Ограничение: первые 50 ребер
        const edge = companyData.links.edges[i]

        for (const field of edgeFields) {
          const key = `links.edges.${field}`
          if (edge[field] !== undefined && paramIdMap[key]) {
            try {
              // Добавляем индекс к имени для различения ребер
              const objId = await createRequisiteObject(
                auth,
                organizationId,
                paramIdMap[key],
                edge[field],
                { ...descriptions, [paramIdMap[key]]: `${descriptions[paramIdMap[key]] || field} [связь ${i + 1}]` }
              )
              savedRequisites.push({ field: `${key}[${i}]`, paramId: paramIdMap[key], objectId: objId })
            } catch (error) {
              errors.push({ field: `${key}[${i}]`, error: error.message })
            }
          }
        }
      }
    }
  }

  // Risks
  if (companyData.risks) {
    if (companyData.risks.ogrn && paramIdMap['risks.ogrn']) {
      try {
        const objId = await createRequisiteObject(auth, organizationId, paramIdMap['risks.ogrn'], companyData.risks.ogrn, descriptions)
        savedRequisites.push({ field: 'risks.ogrn', paramId: paramIdMap['risks.ogrn'], objectId: objId })
      } catch (error) {
        errors.push({ field: 'risks.ogrn', error: error.message })
      }
    }
    if (companyData.risks.flags && paramIdMap['risks.flags']) {
      try {
        const objId = await createRequisiteObject(auth, organizationId, paramIdMap['risks.flags'], companyData.risks.flags, descriptions)
        savedRequisites.push({ field: 'risks.flags', paramId: paramIdMap['risks.flags'], objectId: objId })
      } catch (error) {
        errors.push({ field: 'risks.flags', error: error.message })
      }
    }
  }

  // Scoring
  if (companyData.scoring) {
    if (companyData.scoring.score !== undefined && paramIdMap['scoring.score']) {
      try {
        const objId = await createRequisiteObject(auth, organizationId, paramIdMap['scoring.score'], companyData.scoring.score, descriptions)
        savedRequisites.push({ field: 'scoring.score', paramId: paramIdMap['scoring.score'], objectId: objId })
      } catch (error) {
        errors.push({ field: 'scoring.score', error: error.message })
      }
    }
    if (companyData.scoring.rating !== undefined && paramIdMap['scoring.rating']) {
      try {
        const objId = await createRequisiteObject(auth, organizationId, paramIdMap['scoring.rating'], companyData.scoring.rating, descriptions)
        savedRequisites.push({ field: 'scoring.rating', paramId: paramIdMap['scoring.rating'], objectId: objId })
      } catch (error) {
        errors.push({ field: 'scoring.rating', error: error.message })
      }
    }
  }

  // Finance
  if (companyData.finance?.balances && paramIdMap['finance.balances']) {
    try {
      const objId = await createRequisiteObject(auth, organizationId, paramIdMap['finance.balances'], companyData.finance.balances, descriptions)
      savedRequisites.push({ field: 'finance.balances', paramId: paramIdMap['finance.balances'], objectId: objId })
    } catch (error) {
      errors.push({ field: 'finance.balances', error: error.message })
    }
  }

  // Tax Info
  if (companyData.taxInfo) {
    const taxFields = ['paid_taxes', 'fines_debts', 'tax_offences']
    for (const field of taxFields) {
      const key = `taxInfo.${field}`
      if (companyData.taxInfo[field] !== undefined && paramIdMap[key]) {
        try {
          const objId = await createRequisiteObject(auth, organizationId, paramIdMap[key], companyData.taxInfo[field], descriptions)
          savedRequisites.push({ field: key, paramId: paramIdMap[key], objectId: objId })
        } catch (error) {
          errors.push({ field: key, error: error.message })
        }
      }
    }
  }

  // Bankruptcy
  if (companyData.bankruptcy) {
    if (companyData.bankruptcy.total !== undefined && paramIdMap['bankruptcy.total']) {
      try {
        const objId = await createRequisiteObject(auth, organizationId, paramIdMap['bankruptcy.total'], companyData.bankruptcy.total, descriptions)
        savedRequisites.push({ field: 'bankruptcy.total', paramId: paramIdMap['bankruptcy.total'], objectId: objId })
      } catch (error) {
        errors.push({ field: 'bankruptcy.total', error: error.message })
      }
    }
    if (companyData.bankruptcy.data && paramIdMap['bankruptcy.data']) {
      try {
        const objId = await createRequisiteObject(auth, organizationId, paramIdMap['bankruptcy.data'], companyData.bankruptcy.data, descriptions)
        savedRequisites.push({ field: 'bankruptcy.data', paramId: paramIdMap['bankruptcy.data'], objectId: objId })
      } catch (error) {
        errors.push({ field: 'bankruptcy.data', error: error.message })
      }
    }
  }

  // Inspections
  if (companyData.inspections) {
    if (companyData.inspections.total !== undefined && paramIdMap['inspections.total']) {
      try {
        const objId = await createRequisiteObject(auth, organizationId, paramIdMap['inspections.total'], companyData.inspections.total, descriptions)
        savedRequisites.push({ field: 'inspections.total', paramId: paramIdMap['inspections.total'], objectId: objId })
      } catch (error) {
        errors.push({ field: 'inspections.total', error: error.message })
      }
    }
    if (companyData.inspections.data && paramIdMap['inspections.data']) {
      try {
        const objId = await createRequisiteObject(auth, organizationId, paramIdMap['inspections.data'], companyData.inspections.data, descriptions)
        savedRequisites.push({ field: 'inspections.data', paramId: paramIdMap['inspections.data'], objectId: objId })
      } catch (error) {
        errors.push({ field: 'inspections.data', error: error.message })
      }
    }
  }

  // Government Contracts
  if (companyData.governmentContracts) {
    if (companyData.governmentContracts.total !== undefined && paramIdMap['governmentContracts.total']) {
      try {
        const objId = await createRequisiteObject(auth, organizationId, paramIdMap['governmentContracts.total'], companyData.governmentContracts.total, descriptions)
        savedRequisites.push({ field: 'governmentContracts.total', paramId: paramIdMap['governmentContracts.total'], objectId: objId })
      } catch (error) {
        errors.push({ field: 'governmentContracts.total', error: error.message })
      }
    }
    if (companyData.governmentContracts.data && paramIdMap['governmentContracts.data']) {
      try {
        const objId = await createRequisiteObject(auth, organizationId, paramIdMap['governmentContracts.data'], companyData.governmentContracts.data, descriptions)
        savedRequisites.push({ field: 'governmentContracts.data', paramId: paramIdMap['governmentContracts.data'], objectId: objId })
      } catch (error) {
        errors.push({ field: 'governmentContracts.data', error: error.message })
      }
    }
  }

  // Arbitration Cases
  if (companyData.arbitrationCases) {
    if (companyData.arbitrationCases.total_cases !== undefined && paramIdMap['arbitration-cases.total_cases']) {
      try {
        const objId = await createRequisiteObject(auth, organizationId, paramIdMap['arbitration-cases.total_cases'], companyData.arbitrationCases.total_cases, descriptions)
        savedRequisites.push({ field: 'arbitration-cases.total_cases', paramId: paramIdMap['arbitration-cases.total_cases'], objectId: objId })
      } catch (error) {
        errors.push({ field: 'arbitration-cases.total_cases', error: error.message })
      }
    }
    if (companyData.arbitrationCases.data && paramIdMap['arbitration-cases.data']) {
      try {
        const objId = await createRequisiteObject(auth, organizationId, paramIdMap['arbitration-cases.data'], companyData.arbitrationCases.data, descriptions)
        savedRequisites.push({ field: 'arbitration-cases.data', paramId: paramIdMap['arbitration-cases.data'], objectId: objId })
      } catch (error) {
        errors.push({ field: 'arbitration-cases.data', error: error.message })
      }
    }
  }

  // Обновляем имя организации из short_name после сохранения всех реквизитов
  let organizationNameUpdated = false
  try {
    organizationNameUpdated = await updateOrganizationName(auth, organizationId, companyData)
  } catch (error) {
    console.error(`[Integram] Failed to update organization name: ${error.message}`)
    errors.push({ field: 'organization.name', error: error.message })
  }

  return { savedRequisites, errors, organizationNameUpdated }
}

export {
  PARAM_ID_MAP_STATIC,
  ORGANIZATION_FIELD_MAP,
  INTEGRAM_CONFIG,
  authenticateIntegram,
  createRequisiteObject,
  fetchAllCompanyData,
  saveCompanyDataToIntegram,
  loadParamDescriptions,
  loadParamIdMap,
  updateOrganizationName
}
