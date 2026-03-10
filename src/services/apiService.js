/**
 * API Service
 *
 * This service provides a wrapper around the direct API calls to maintain
 * compatibility with Vue components. It replaces the proxy.php functionality
 * by making direct calls to the original API and applying local remapping.
 *
 * Usage:
 *   import apiService from '@/services/apiService'
 *   const tables = await apiService.getTables()
 */

import axios from 'axios'
import { remapData, prepareFilterParams, prepareReportData } from './apiRemapper'
import { getIntegramServerUrl } from '@/utils/integramConfig'

// Create a separate axios instance for API service to avoid circular dependencies
// This instance does NOT have the API interceptors installed
const directApiClient = axios.create({
  timeout: 30000, // 30 seconds (was 5000 seconds - fixed security issue)
  headers: {
    'Content-Type': 'application/json',
  },
})

/**
 * Get token and authentication database
 * Issue #3811: Detect which database the user authenticated to
 * Issue #3811 (production fix): Already synchronous, added comment for clarity
 */
function getTokenAndAuthDb() {
  const db = localStorage.getItem('db') || 'A2025'

  // Check for integram_session first
  const integramSession = localStorage.getItem('integram_session')
  if (integramSession) {
    try {
      const sessionData = JSON.parse(integramSession)
      const authDb = sessionData.authDatabase || sessionData.database
      return { token: sessionData.token, authDb }
    } catch (e) {
      console.error('Failed to parse integram_session:', e)
    }
  }

  // Fallback to legacy token
  const token = localStorage.getItem('token')
  const myToken = localStorage.getItem('my_token')
  const myXsrf = localStorage.getItem('my_xsrf')

  // If token matches my_token or my_xsrf exists, user authenticated to 'my'
  const authDb = (myToken && token === myToken) || myXsrf ? 'my' : db

  return { token, authDb }
}

// Add request interceptor for authentication and base URL
directApiClient.interceptors.request.use(
  config => {
    const apiBase = localStorage.getItem('apiBase')
    // Issue #3872: Support targetDatabase in config to override localStorage.db
    // When apiService methods are called from apiInterceptor, the targetDatabase
    // should be passed through to ensure correct database routing
    const db = config.targetDatabase || localStorage.getItem('db')

    // Get token and authentication database
    const { token, authDb } = getTokenAndAuthDb()

    console.log('[apiService] Interceptor executing for URL:', config.url, 'token:', token ? 'present' : 'missing', 'authDb:', authDb, 'targetDb:', db)

    // Issue #3811: Authorization header selection based on auth database and request URL
    //
    // Logic:
    // 1. If authenticated to 'my' database:
    //    - Requests to /my/ paths → use X-Authorization (direct access to my database)
    //    - Requests to other databases → use 'my' header (kernel routing)
    // 2. If authenticated to specific database (e.g., a2025):
    //    - All requests → use X-Authorization (direct access)
    if (token) {
      const requestDb = db || 'A2025'

      console.log('[apiService] Token found, requestDb:', requestDb, 'authDb:', authDb)

      if (authDb === 'my') {
        // Authenticated to 'my' database
        if (requestDb === 'my') {
          // Requesting 'my' database directly → use X-Authorization
          config.headers['X-Authorization'] = token
          console.log('[apiService] Setting X-Authorization header (my → my)')
        } else {
          // Requesting other database via kernel routing → use 'my' header
          config.headers['my'] = token
          console.log('[apiService] Setting my header (my → ' + requestDb + ')')
        }
      } else {
        // Authenticated to specific database → always use X-Authorization
        config.headers['X-Authorization'] = token
        console.log('[apiService] Setting X-Authorization header (direct db:', authDb, ')')
      }
    } else {
      console.warn('[apiService] No token found in localStorage!')
    }
    // Note: X-Api-Base and xsrf headers are NOT sent to direct API calls
    // (dronedoc.ru, sim.sakhwings.ru, etc.)
    // These headers were only used by proxy.php which we're replacing
    // Sending them causes CORS errors from the remote APIs

    // Set base URL
    // Note: We use ?JSON_KV parameter instead of /api/ path
    // OLD format: dronedoc.ru/api/{db}/{endpoint} (deprecated)
    // NEW format: api.ai2o.ru/{db}/{endpoint}?JSON_KV (current)
    // Issue #5405: Use getIntegramServerUrl() from config instead of hardcoded dronedoc.ru
    const baseHost = apiBase === 'localhost' ? 'localhost' : (apiBase || getIntegramServerUrl())
    const protocol = apiBase === 'localhost' ? 'http' : 'https'
    const targetDb = db || 'A2025'
    config.baseURL = `${protocol}://${baseHost}/${targetDb}`

    console.log('[apiService] ⚠️ Setting baseURL to:', config.baseURL, '(targetDatabase:', config.targetDatabase, ')')

    // Add JSON_KV parameter to all requests (unless JSON_RICH is explicitly set)
    // Issue #3872: Allow JSON_RICH as alternative format for reports
    if (!config.params) {
      config.params = {}
    }
    // Only add JSON_KV if JSON_RICH is not already set
    if (!config.params.JSON_RICH) {
      config.params.JSON_KV = true
    }

    return config
  },
  error => Promise.reject(error)
)

/**
 * Get database name from route or default
 */
function getDatabaseName() {
  return localStorage.getItem('db') || 'A2025'
}

/**
 * Resolve table ID from table identifier (can be numeric ID or string name)
 */
async function resolveTableId(tableIdentifier) {
  if (!isNaN(tableIdentifier)) {
    return parseInt(tableIdentifier)
  }

  // Get tables list and find by name
  const response = await directApiClient.get('/dict')
  const tables = response.data

  for (const [id, name] of Object.entries(tables)) {
    if (name.toLowerCase() === tableIdentifier.toLowerCase()) {
      return parseInt(id)
    }
  }

  throw new Error(`Table '${tableIdentifier}' not found`)
}

/**
 * Get edit types data (needed for remapping)
 */
async function getEditTypes() {
  try {
    const response = await directApiClient.get('/edit_types')
    return { edit_types: response.data }
  } catch (error) {
    console.error('Error fetching edit types:', error)
    return { edit_types: {} }
  }
}

/**
 * Get table settings
 */
async function getTableSettings(tableId) {
  try {
    // Settings are stored in table 36964
    const response = await directApiClient.get(`/object/36964`)
    const types = await getEditTypes()
    const remapped = remapData(response.data, types)

    for (const setting of remapped.rows) {
      for (const value of setting.values) {
        if (value.headerId === 36964 && value.value === tableId) {
          for (const v of setting.values) {
            if (v.headerId === 36965) {
              try {
                return JSON.parse(v.value.replace(/\\/g, '')) || {}
              } catch {
                return {}
              }
            }
          }
        }
      }
    }
    return {}
  } catch (error) {
    console.error('Error fetching table settings:', error)
    return {}
  }
}

/**
 * Get directory values for table settings
 */
async function getDirectoryValues(settings) {
  if (!settings.dir || settings.dir.length === 0) {
    return settings
  }

  const types = await getEditTypes()

  for (const item of settings.dir) {
    try {
      const response = await directApiClient.get(`/object/${item.tableId}`)
      const remapped = remapData(response.data, types)

      for (const dirRow of remapped.rows) {
        for (const value of dirRow.values) {
          if (value.headerId === item.columnId) {
            item.value = value.value
            break
          }
        }
        if (item.value) break
      }
    } catch (error) {
      console.error(`Error fetching directory values for table ${item.tableId}:`, error)
    }
  }

  return settings
}

/**
 * API Service Methods
 */
const apiService = {
  /**
   * Get list of all tables
   */
  async getTables() {
    const response = await directApiClient.get('/dict')
    const tables = response.data

    const result = Object.entries(tables).map(([id, value]) => ({
      id: parseInt(id),
      value: value
    }))

    result.sort((a, b) => a.id - b.id)

    return {
      status: 200,
      response: result
    }
  },

  /**
   * Get table data with optional pagination and filters
   */
  async getTable(tableIdentifier, queryParams = {}, page = null) {
    const tableId = await resolveTableId(tableIdentifier)

    const params = page ? { F_U: 1, f_show_all: 1, pg: page } : {}
    const endpoint = `/object/${tableId}`

    // Get initial data
    const dataResponse = await directApiClient.get(endpoint + (Object.keys(params).length ? '?' + new URLSearchParams(params).toString() : ''))
    const types = await getEditTypes()
    const settings = await getDirectoryValues(await getTableSettings(tableId))

    const remapped = remapData(dataResponse.data, types, settings)
    const externalParams = prepareFilterParams(queryParams, remapped.headers)

    // Apply filters if needed
    if (Object.keys(externalParams).length > 0) {
      const filteredResponse = await directApiClient.get(
        endpoint + '?' + new URLSearchParams({ ...params, ...externalParams }).toString()
      )
      const filteredRemapped = remapData(filteredResponse.data, types, settings)
      return {
        status: 200,
        response: filteredRemapped
      }
    }

    return {
      status: 200,
      response: remapped
    }
  },

  /**
   * Get specific row from table
   */
  async getTableRow(tableIdentifier, rowId, queryParams = {}) {
    const tableId = await resolveTableId(tableIdentifier)
    const data = await this.getTable(tableId, queryParams)

    const row = data.response.rows.find(r => r.id == rowId)
    if (!row) {
      throw new Error(`Row with ID ${rowId} not found`)
    }

    return {
      status: 200,
      response: {
        id: data.response.id,
        value: data.response.value,
        headers: data.response.headers,
        rows: [row],
        settings: data.response.settings || null
      }
    }
  },

  /**
   * Get nested table data
   */
  async getNestedTable(tableIdentifier, nestedTableId, queryParams = {}) {
    const tableId = await resolveTableId(tableIdentifier)

    const params = { F_U: nestedTableId }
    Object.keys(queryParams).forEach(key => {
      if (!['page', 'limit', 'sort', 'F_U', 'f_show_all', 'pg'].includes(key)) {
        params[key] = queryParams[key]
      }
    })

    const response = await directApiClient.get(`/object/${tableId}?` + new URLSearchParams(params).toString())

    if (queryParams.raw_data) {
      return {
        status: 200,
        response: { objects: response.data.object || [] }
      }
    }

    const types = await getEditTypes()
    const settings = await getDirectoryValues(await getTableSettings(tableId))
    const remapped = remapData(response.data, types, settings)

    remapped.id = parseInt(nestedTableId)

    // Get table name
    const tablesResponse = await directApiClient.get('/dict')
    remapped.value = tablesResponse.data[nestedTableId] || `Table ${nestedTableId}`

    if (response.data['&main.a']) {
      remapped.meta = {
        menu: response.data['&main.myrolemenu'] || null,
        parent: response.data.parent || null
      }
    }

    return {
      status: 200,
      response: remapped
    }
  },

  /**
   * Get report data
   * @param {string|number} reportIdentifier - Report ID (number) or report name (string like 'my_task')
   * @param {Object} queryParams - Query parameters
   * @param {Object} options - Additional options (e.g., targetDatabase)
   */
  async getReport(reportIdentifier, queryParams = {}, options = {}) {
    const hideId = queryParams.hide_id === 'true' || queryParams.hide_id === '1'

    // Determine if reportIdentifier is numeric ID or string name
    const numericId = parseInt(reportIdentifier)
    const isNumeric = !isNaN(numericId) && String(numericId) === String(reportIdentifier)

    // Use identifier as-is (works for both numeric IDs and string names like 'my_task')
    const reportPath = isNumeric ? numericId : reportIdentifier

    // Issue #3872: Pass targetDatabase to directApiClient if provided
    // Also pass through queryParams (including JSON_RICH if set)
    const requestConfig = {
      params: queryParams
    }
    if (options.targetDatabase) {
      requestConfig.targetDatabase = options.targetDatabase
      console.log('[apiService.getReport] Using targetDatabase:', options.targetDatabase)
    }

    const response = await directApiClient.get(`/report/${reportPath}`, requestConfig)

    // Get report name from table 22
    let reportName = 'Report'
    try {
      const table22Response = await directApiClient.get('/object/22?F_U=1&f_show_all=1')
      // Find report by ID or by name
      const report = table22Response.data.object?.find(r =>
        isNumeric ? r.id == numericId : r.val === reportIdentifier
      )
      if (report) {
        reportName = report.val
      }
    } catch (error) {
      console.error('Error fetching report name:', error)
    }

    const formatted = prepareReportData(response.data, hideId, reportName)

    return {
      status: 200,
      response: formatted
    }
  },

  /**
   * Get list of all reports (from table 22)
   */
  async getReports(queryParams = {}) {
    const tableId = 22
    const allRows = []
    let page = 1

    // Get initial data for headers
    const initialResponse = await directApiClient.get(`/object/${tableId}`)
    const types = await getEditTypes()
    const settings = await getDirectoryValues(await getTableSettings(tableId))
    const initialRemapped = remapData(initialResponse.data, types, settings)
    const externalParams = prepareFilterParams(queryParams, initialRemapped.headers)

    // Paginate through all pages
    while (true) {
      const params = { F_U: 1, f_show_all: 1, pg: page, ...externalParams }
      const response = await directApiClient.get(`/object/${tableId}?` + new URLSearchParams(params).toString())
      const remapped = remapData(response.data, types, settings)

      if (remapped.rows.length === 0) break

      allRows.push(...remapped.rows)
      page++
    }

    return {
      status: 200,
      response: {
        id: initialRemapped.id,
        value: initialRemapped.value,
        headers: initialRemapped.headers,
        rows: allRows,
        settings: initialRemapped.settings || null,
        _meta: {
          total_pages: page - 1,
          total_rows: allRows.length
        }
      }
    }
  },

  /**
   * Authenticate user
   */
  async auth(login, password) {
    const formData = new URLSearchParams()
    formData.append('login', login)
    formData.append('pwd', password)

    const response = await directApiClient.post(`/auth`, formData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    })

    const data = response.data

    if (!data.token) {
      throw new Error(data.error || data.warning || 'Ошибка авторизации')
    }

    return {
      status: 200,
      response: {
        authenticated: true,
        token: data.token,
        _xsrf: data._xsrf,
        user: login,
        role: data.role || '',
        id: parseInt(data.id || 0)
      }
    }
  },

  /**
   * Get current user info
   */
  async getUser() {
    const response = await directApiClient.get(`/xsrf`)
    const data = response.data

    return {
      status: 200,
      response: {
        authenticated: true,
        token: data.token || '',
        _xsrf: data._xsrf || '',
        user: data.user || '',
        role: data.role || '',
        id: parseInt(data.id || 0)
      }
    }
  },

  /**
   * Update table cell/row
   */
  async updateTable(payload, dirTableId = null) {
    const endpoint = '/_m_save/' + payload.id

    const formData = {}
    payload.headers.forEach(header => {
      let value = header.value
      switch (header.type) {
        case 11: // Boolean
          value = value ? 'X' : ''
          break
        case 9: // Date
          value = new Date(value * 1000).toISOString().split('T')[0]
          break
        case 4: // DateTime
          value = new Date(value * 1000).toISOString().replace('T', ' ').split('.')[0]
          break
      }
      formData[`t${header.headerId}`] = value
    })

    const response = await directApiClient.post(endpoint, new URLSearchParams(formData), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    })

    if (dirTableId) {
      // Return directory row data
      const dirResponse = await this.getTableRow(dirTableId, payload.headers[0].value)
      return dirResponse.response.rows[0]
    }

    return {
      id: payload.id,
      headers: payload.headers,
      response: response.data
    }
  },

  /**
   * Add multi-select directory value
   */
  async addMultiDirValue(tableId, rowId, columnId, dirRowId) {
    const endpoint = `/_m_set/${rowId}?t${columnId}=${dirRowId}`
    const response = await directApiClient.post(endpoint, {})
    return response.data
  },

  /**
   * Delete multi-select directory value
   */
  async deleteMultiDirValue(linkId) {
    const endpoint = `/_m_del/${linkId}`
    const response = await directApiClient.post(endpoint, {})
    return response.data
  },

  /**
   * Delete row
   */
  async deleteRow(rowId) {
    const endpoint = `/_m_del/${rowId}`
    const response = await directApiClient.post(endpoint, {})
    return response.data
  },

  /**
   * Create new row in table
   */
  async createRow(tableIdentifier, data = {}) {
    const tableId = await resolveTableId(tableIdentifier)
    const endpoint = `/_m_new/${tableId}`

    const formData = { up: 1 }
    Object.keys(data).forEach(key => {
      if (!isNaN(key)) {
        formData[`t${key}`] = data[key]
      }
    })

    const response = await directApiClient.post(endpoint, new URLSearchParams(formData), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    })

    return response.data
  },

  /**
   * Create row with update
   */
  async createAndUpdateRow(tableIdentifier, payload, dirTableId = null) {
    const tableId = await resolveTableId(tableIdentifier)

    // Create row
    const createData = { up: 1 }
    Object.keys(payload).forEach(key => {
      if (!isNaN(key)) {
        createData[`t${key}`] = payload[key]
      }
    })

    const createResponse = await directApiClient.post(
      `/_m_new/${tableId}`,
      new URLSearchParams(createData),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    )

    const newRowId = createResponse.data.id
    if (!newRowId) {
      throw new Error('Failed to create row')
    }

    // Update if needed
    if (payload.headers) {
      const updateData = {}
      payload.headers.forEach(header => {
        let value = header.value
        switch (header.type) {
          case 11:
            value = value ? 'X' : ''
            break
          case 9:
            value = new Date(value * 1000).toISOString().split('T')[0]
            break
          case 4:
            value = new Date(value * 1000).toISOString().replace('T', ' ').split('.')[0]
            break
        }
        updateData[`t${header.headerId}`] = value
      })

      await directApiClient.post(
        `/_m_save/${newRowId}`,
        new URLSearchParams(updateData),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      )
    }

    if (dirTableId) {
      const dirResponse = await this.getTableRow(dirTableId, newRowId)
      return dirResponse.response.rows[0]
    }

    return { createdRowId: newRowId }
  },

  /**
   * Update column
   */
  async updateColumn(headerId, termId, value, type) {
    const endpoint = `/_d_save/${termId}?JSON`

    const formData = new URLSearchParams()
    formData.append('val', value)
    formData.append('t', type)

    const response = await directApiClient.post(endpoint, formData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    })

    return {
      id: headerId,
      type: type,
      newName: value
    }
  },

  /**
   * Delete column
   */
  async deleteColumn(headerId, termId) {
    await directApiClient.post(`/_d_del_req/${termId}`, {})
    await directApiClient.post(`/_d_del_req/${headerId}`, {})

    return {
      deleted: {
        termId: parseInt(termId),
        id: parseInt(headerId)
      }
    }
  }
}

export default apiService
