/**
 * Organization Integram Service
 *
 * Frontend service for saving organizations from INN Analytics to Integram database.
 * Maps FNS API data to Integram requisites for the Организация table (ID: 197000).
 *
 * Issue #4293: Uses direct Integram API calls instead of backend proxy.
 * Writes directly to https://api.ai2o.ru/my/object/197000
 *
 * Issue #4303: Added comprehensive logging for debugging save failures
 */

import axios2 from '../axios2'

// Table ID for Организация
export const ORGANIZATION_TYPE_ID = 197000

// Database for organizations
const ORGANIZATION_DATABASE = 'my'

// Requisite IDs mapping for Организация table
export const REQUISITE_IDS = {
  description: '197002',      // Описание организации
  title: '197004',            // Заголовок
  date: '197006',             // Дата
  icon: '197017',             // Иконка
  user: '198172',             // User (reference)
  inn: '198195',              // ИНН
  ogrn: '198239',             // ОГРН
  oktmo: '198256',            // ОКТМО
  okfs: '198257',             // ОКФС
  okogu: '198258',            // ОКОГУ
  citizenship: '198259',      // Гражданство
  ogrnip: '198265',           // ОГРНИП
  kpp: '198266',              // КПП
  shortName: '198267',        // Краткое наименование
  fullAddress: '198268',      // Полный адрес
  postalCode: '198269',       // Почтовый индекс
  registrationDate: '198270', // Дата регистрации
  authorizedCapital: '198271', // Уставный капитал
  ceoName: '198272',          // ФИО руководителя
  ceoPosition: '198273',      // Должность руководителя
  ceoInn: '198274',           // ИНН руководителя
  fnsStatus: '198277',        // Статус ФНС (reference → 198196)
  gender: '198290',           // Пол (reference → 198235)
  legalForm: '198291',        // Правовая форма
  okvedActivity: '198294'     // Вид деятельности ОКВЭД (reference → 198200)
}

// Status mapping: FNS API status → Integram object ID
export const STATUS_MAPPING = {
  'active': '198202',         // Действующее
  'liquidated': '198203',     // Ликвидировано
  'liquidating': '198204',    // В стадии ликвидации
  'reorganizing': '198205',   // Реорганизовано
  'bankrupt': '198206'        // Банкротство
}

/**
 * Get XSRF token from localStorage
 * Required for all POST requests to Integram API
 * @returns {string|null} XSRF token
 */
function getXsrfToken() {
  return localStorage.getItem('_xsrf')
}

/**
 * Format date for Integram API (DD.MM.YYYY)
 * @param {Date|string} date - Date to format
 * @returns {string} Formatted date string
 */
export function formatDateForIntegram(date) {
  if (!date) return ''
  const d = new Date(date)
  if (isNaN(d.getTime())) return ''

  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const year = d.getFullYear()

  return `${day}.${month}.${year}`
}

/**
 * Map FNS company data to Integram requisites
 * @param {Object} companyData - Company data from FNS API
 * @param {Object} rawData - Raw response from FNS API (optional)
 * @returns {Object} Requisites object for Integram
 */
export function mapCompanyToRequisites(companyData, rawData = {}) {
  const requisites = {}

  // Basic info
  if (companyData.inn) {
    requisites[REQUISITE_IDS.inn] = companyData.inn
  }

  if (companyData.ogrn) {
    requisites[REQUISITE_IDS.ogrn] = companyData.ogrn
  }

  if (companyData.kpp) {
    requisites[REQUISITE_IDS.kpp] = companyData.kpp
  }

  if (companyData.shortName) {
    requisites[REQUISITE_IDS.shortName] = companyData.shortName
  }

  // Address info
  if (companyData.address) {
    requisites[REQUISITE_IDS.fullAddress] = companyData.address
  }

  if (companyData.postalCode) {
    requisites[REQUISITE_IDS.postalCode] = companyData.postalCode
  }

  // Registration date
  if (companyData.registrationDate) {
    requisites[REQUISITE_IDS.registrationDate] = formatDateForIntegram(companyData.registrationDate)
  }

  // Financial data
  if (companyData.financial?.authorizedCapital) {
    requisites[REQUISITE_IDS.authorizedCapital] = String(companyData.financial.authorizedCapital)
  }

  // Leadership
  if (companyData.ceo) {
    requisites[REQUISITE_IDS.ceoName] = companyData.ceo
  }

  if (companyData.ceoPosition) {
    requisites[REQUISITE_IDS.ceoPosition] = companyData.ceoPosition
  }

  // Legal form
  if (companyData.legalForm) {
    requisites[REQUISITE_IDS.legalForm] = companyData.legalForm
  }

  // FNS Status (reference field)
  if (companyData.status && STATUS_MAPPING[companyData.status]) {
    requisites[REQUISITE_IDS.fnsStatus] = STATUS_MAPPING[companyData.status]
  }

  // OKVED (primary activity code)
  if (companyData.okved && companyData.okved.length > 0) {
    const primaryOkved = companyData.okved.find(o => o.isPrimary) || companyData.okved[0]
    if (primaryOkved) {
      requisites[REQUISITE_IDS.description] = `${primaryOkved.code} - ${primaryOkved.name}`
    }
  }

  // Use fields from companyData if available (already parsed)
  if (companyData.oktmo) {
    requisites[REQUISITE_IDS.oktmo] = companyData.oktmo
  }

  if (companyData.okfs) {
    requisites[REQUISITE_IDS.okfs] = companyData.okfs
  }

  if (companyData.okogu) {
    requisites[REQUISITE_IDS.okogu] = companyData.okogu
  }

  if (companyData.ogrnip) {
    requisites[REQUISITE_IDS.ogrnip] = companyData.ogrnip
  }

  if (companyData.ceoInn) {
    requisites[REQUISITE_IDS.ceoInn] = companyData.ceoInn
  }

  if (companyData.citizenship) {
    requisites[REQUISITE_IDS.citizenship] = companyData.citizenship
  }

  // Extract additional data from raw response if available (fallback)
  if (rawData?.registry?.items?.[0]) {
    const item = rawData.registry.items[0]

    if (!requisites[REQUISITE_IDS.ogrnip] && item.ОГРНИП) {
      requisites[REQUISITE_IDS.ogrnip] = item.ОГРНИП
    }

    if (!requisites[REQUISITE_IDS.oktmo] && item.ОКТМО) {
      requisites[REQUISITE_IDS.oktmo] = item.ОКТМО
    }

    if (!requisites[REQUISITE_IDS.okfs] && item.ОКФС?.Код) {
      requisites[REQUISITE_IDS.okfs] = item.ОКФС.Код
    }

    if (!requisites[REQUISITE_IDS.okogu] && item.ОКОГУ?.Код) {
      requisites[REQUISITE_IDS.okogu] = item.ОКОГУ.Код
    }

    if (!requisites[REQUISITE_IDS.ceoInn] && item.Руководитель?.ИНН) {
      requisites[REQUISITE_IDS.ceoInn] = item.Руководитель.ИНН
    }

    if (!requisites[REQUISITE_IDS.citizenship] && item.Гражданство?.Наим) {
      requisites[REQUISITE_IDS.citizenship] = item.Гражданство.Наим
    }
  }

  // Set current date
  requisites[REQUISITE_IDS.date] = formatDateForIntegram(new Date())

  // Default icon for organization
  requisites[REQUISITE_IDS.icon] = '🏢'

  // Title = company name
  if (companyData.name) {
    requisites[REQUISITE_IDS.title] = companyData.name
  }

  return requisites
}

/**
 * Search for organization by INN using direct Integram API
 * @param {string} inn - INN to search for
 * @returns {Promise<Object>} Search result
 */
export async function searchOrganizationByInn(inn) {
  try {
    console.log('[OrganizationIntegramService] Searching for organization with INN:', inn)

    // Get all organizations from the table using direct Integram API
    // Note: baseURL already ends with '/' so we don't start with '/'
    const response = await axios2.get(`object/${ORGANIZATION_TYPE_ID}`, {
      targetDatabase: ORGANIZATION_DATABASE
    })

    console.log('[OrganizationIntegramService] Search response status:', response.status)

    const data = response.data?.response || response.data
    const organizations = data?.object || []
    const reqs = data?.reqs || {}

    console.log('[OrganizationIntegramService] Total organizations in database:', organizations.length)

    // Filter by INN
    const matching = organizations.filter(org => {
      const orgReqs = reqs[org.id] || {}
      return orgReqs[REQUISITE_IDS.inn] === inn
    })

    console.log('[OrganizationIntegramService] Found matching organizations:', matching.length)

    return {
      success: true,
      data: matching,
      found: matching.length > 0
    }
  } catch (error) {
    console.error('[OrganizationIntegramService] Search error:', {
      message: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText
    })
    throw error
  }
}

/**
 * Create organization from FNS data using direct Integram API
 * Uses _m_new/{typeId} endpoint to create new object
 * Format: t{typeId}=value, t{reqId}=value, up=1
 * @param {string} name - Organization name
 * @param {Object} companyData - Company data from FNS API
 * @param {Object} rawData - Raw FNS API response (optional)
 * @param {string} userId - User ID (optional)
 * @returns {Promise<Object>} Created organization
 */
export async function createOrganization(name, companyData, rawData = null, userId = null) {
  try {
    console.log('[OrganizationIntegramService] Creating organization:', {
      name,
      inn: companyData.inn,
      userId
    })

    // Map company data to Integram requisites
    const requisites = mapCompanyToRequisites(companyData, rawData)

    console.log('[OrganizationIntegramService] Mapped requisites:', Object.keys(requisites).length, 'fields')

    // Add user ID if provided
    if (userId) {
      requisites[REQUISITE_IDS.user] = userId
    }

    // Build form data for _m_new endpoint
    // Format: t{typeId}=value (main object name), t{reqId}=value (requisites), up=1 (independent)
    const params = new URLSearchParams()

    // Add XSRF token for CSRF protection (required for POST requests)
    const xsrf = getXsrfToken()
    if (xsrf) {
      params.append('_xsrf', xsrf)
    } else {
      console.warn('[OrganizationIntegramService] No XSRF token found in localStorage!')
    }

    params.append('up', '1') // Independent object (no parent)
    params.append(`t${ORGANIZATION_TYPE_ID}`, name) // Object name/value with t{typeId} format

    // Add requisites with t{reqId} format
    for (const [reqId, value] of Object.entries(requisites)) {
      if (value !== undefined && value !== null && value !== '') {
        params.append(`t${reqId}`, String(value))
      }
    }

    const requestUrl = `_m_new/${ORGANIZATION_TYPE_ID}`
    console.log('[OrganizationIntegramService] Request URL:', requestUrl)
    console.log('[OrganizationIntegramService] Target database:', ORGANIZATION_DATABASE)
    console.log('[OrganizationIntegramService] Form data entries:', params.toString().substring(0, 200) + '...')

    // Call _m_new/{typeId} endpoint to create object
    // Note: baseURL already ends with '/' so we don't start with '/'
    const response = await axios2.post(
      requestUrl,
      params.toString(),
      {
        targetDatabase: ORGANIZATION_DATABASE,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    )

    console.log('[OrganizationIntegramService] Response status:', response.status)
    console.log('[OrganizationIntegramService] Response data keys:', Object.keys(response.data || {}))

    const data = response.data?.response || response.data

    console.log('[OrganizationIntegramService] Created organization successfully:', {
      hasData: !!data,
      dataKeys: data ? Object.keys(data) : [],
      objectId: data?.id
    })

    // If object created successfully and has requisites, apply them via _m_set
    // (_m_new doesn't always save reference fields correctly)
    if (data && data.id && Object.keys(requisites).length > 0) {
      console.log('[OrganizationIntegramService] Applying requisites via _m_set for object:', data.id)

      const setParams = new URLSearchParams()

      // Add XSRF token for CSRF protection
      const xsrfForSet = getXsrfToken()
      if (xsrfForSet) {
        setParams.append('_xsrf', xsrfForSet)
      }

      for (const [reqId, value] of Object.entries(requisites)) {
        if (value !== undefined && value !== null && value !== '') {
          setParams.append(`t${reqId}`, String(value))
        }
      }

      const setResponse = await axios2.post(
        `_m_set/${data.id}`,
        setParams.toString(),
        {
          targetDatabase: ORGANIZATION_DATABASE,
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      )

      console.log('[OrganizationIntegramService] _m_set response status:', setResponse.status)
    }

    return {
      success: true,
      data: data,
      message: 'Организация успешно создана'
    }
  } catch (error) {
    console.error('[OrganizationIntegramService] Create error:', {
      message: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data
    })
    throw error
  }
}

/**
 * Update existing organization using direct Integram API
 * Uses _m_set/{objectId} endpoint to update object requisites
 * Format: t{reqId}=value
 * @param {number} id - Organization ID
 * @param {string} name - Organization name
 * @param {Object} companyData - Company data from FNS API
 * @param {Object} rawData - Raw FNS API response (optional)
 * @returns {Promise<Object>} Updated organization
 */
export async function updateOrganization(id, name, companyData, rawData = null) {
  try {
    console.log('[OrganizationIntegramService] Updating organization:', {
      id,
      name,
      inn: companyData.inn
    })

    // Map company data to Integram requisites
    const requisites = mapCompanyToRequisites(companyData, rawData)

    console.log('[OrganizationIntegramService] Mapped requisites for update:', Object.keys(requisites).length, 'fields')

    // Build form data for _m_set endpoint
    // Format: t{reqId}=value
    const params = new URLSearchParams()

    // Add XSRF token for CSRF protection (required for POST requests)
    const xsrf = getXsrfToken()
    if (xsrf) {
      params.append('_xsrf', xsrf)
    } else {
      console.warn('[OrganizationIntegramService] No XSRF token found in localStorage!')
    }

    // Add requisites with t{reqId} format
    for (const [reqId, value] of Object.entries(requisites)) {
      if (value !== undefined && value !== null && value !== '') {
        params.append(`t${reqId}`, String(value))
      }
    }

    const requestUrl = `_m_set/${id}`
    console.log('[OrganizationIntegramService] Update request URL:', requestUrl)
    console.log('[OrganizationIntegramService] Target database:', ORGANIZATION_DATABASE)
    console.log('[OrganizationIntegramService] Form data entries:', params.toString().substring(0, 200) + '...')

    // Call _m_set/{objectId} endpoint to update object requisites
    // Note: baseURL already ends with '/' so we don't start with '/'
    const response = await axios2.post(
      requestUrl,
      params.toString(),
      {
        targetDatabase: ORGANIZATION_DATABASE,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    )

    console.log('[OrganizationIntegramService] Update response status:', response.status)
    console.log('[OrganizationIntegramService] Update response data keys:', Object.keys(response.data || {}))

    const data = response.data?.response || response.data

    console.log('[OrganizationIntegramService] Updated organization successfully:', {
      hasData: !!data,
      dataKeys: data ? Object.keys(data) : []
    })

    return {
      success: true,
      data: data,
      message: 'Организация успешно обновлена'
    }
  } catch (error) {
    console.error('[OrganizationIntegramService] Update error:', {
      message: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data
    })
    throw error
  }
}

/**
 * Get organization by ID using direct Integram API
 * @param {number} id - Organization ID
 * @returns {Promise<Object>} Organization data
 */
export async function getOrganization(id) {
  try {
    console.log('[OrganizationIntegramService] Getting organization by ID:', id)

    // Note: baseURL already ends with '/' so we don't start with '/'
    const response = await axios2.get(`object/${id}`, {
      targetDatabase: ORGANIZATION_DATABASE
    })

    console.log('[OrganizationIntegramService] Get response status:', response.status)

    const data = response.data?.response || response.data

    return {
      success: true,
      data: data
    }
  } catch (error) {
    console.error('[OrganizationIntegramService] Get error:', {
      message: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText
    })
    throw error
  }
}

/**
 * Save or update organization from FNS data
 * Main entry point used by INN Analytics page
 *
 * @param {Object} companyData - Parsed company data from FNS API
 * @param {Object} rawData - Raw FNS API response (for fallback data)
 * @param {string} userId - Optional user ID to associate with organization
 * @returns {Promise<Object>} Result of save operation
 */
export async function saveOrganizationFromFns(companyData, rawData = null, userId = null) {
  try {
    console.log('[OrganizationIntegramService] === SAVE ORGANIZATION FROM FNS ===')
    console.log('[OrganizationIntegramService] Company INN:', companyData.inn)
    console.log('[OrganizationIntegramService] Company name:', companyData.name)
    console.log('[OrganizationIntegramService] User ID:', userId || 'null')

    if (!companyData.inn) {
      throw new Error('INN is required')
    }

    if (!companyData.name) {
      throw new Error('Company name is required')
    }

    // Check if organization already exists
    console.log('[OrganizationIntegramService] Checking for existing organization with INN:', companyData.inn)
    const searchResult = await searchOrganizationByInn(companyData.inn)

    if (searchResult.found && searchResult.data.length > 0) {
      // Update existing organization
      const existingOrg = searchResult.data[0]
      console.log('[OrganizationIntegramService] Organization exists, updating. ID:', existingOrg.id)

      return await updateOrganization(
        existingOrg.id,
        companyData.name,
        companyData,
        rawData
      )
    } else {
      // Create new organization
      console.log('[OrganizationIntegramService] Organization not found, creating new one')

      return await createOrganization(
        companyData.name,
        companyData,
        rawData,
        userId
      )
    }
  } catch (error) {
    console.error('[OrganizationIntegramService] Save organization from FNS error:', {
      message: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data
    })
    throw error
  }
}

/**
 * Update specific fields of organization (icon, description, etc.)
 * Uses _m_set endpoint to update only specified requisites
 * @param {number|string} organizationId - Organization ID
 * @param {Object} fields - Fields to update { icon, description, title }
 * @returns {Promise<Object>} Updated organization
 */
export async function updateOrganizationFields(organizationId, fields) {
  try {
    console.log('[OrganizationIntegramService] Updating organization fields:', {
      id: organizationId,
      fields: Object.keys(fields)
    })

    // Use backend API endpoint instead of direct Integram call
    // Backend handles authentication and XSRF token
    const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8082/api'

    const response = await fetch(`${API_BASE_URL}/customer-journey/organizations/${organizationId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        icon: fields.icon,
        description: fields.description,
        title: fields.title
      })
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || 'Failed to update organization')
    }

    const data = await response.json()
    console.log('[OrganizationIntegramService] Update fields response:', data)

    return {
      success: true,
      message: 'Поля организации успешно обновлены'
    }
  } catch (error) {
    console.error('[OrganizationIntegramService] Update fields error:', {
      message: error.message
    })
    throw error
  }
}
