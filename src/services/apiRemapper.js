/**
 * API Remapper Service
 *
 * This service provides local data remapping functionality to maintain compatibility
 * with Vue components while using direct API calls instead of the proxy.
 *
 * Originally, the proxy.php file handled this remapping on the server side.
 * Now we do it client-side to allow direct API connections.
 */

const RANGE_FILTER_TYPES = [9, 13, 14, 4]

/**
 * Remaps raw API data to the expected format for Vue components
 * This mimics the remapData() function from proxy.php
 *
 * @param {Object} data - Raw data from API
 * @param {Object} types - Edit types data (req_id, req_t, etc.)
 * @param {Object} settings - Table settings
 * @returns {Object} Remapped data structure
 */
export function remapData(data, types = {}, settings = {}) {
  if (!data) {
    return {
      id: 0,
      value: '',
      headers: [],
      rows: [],
      settings: settings || {}
    }
  }

  // Fallback: data has object array but no type (subordinate queries with F_U)
  if (!data.type && data.object && Array.isArray(data.object)) {
    return {
      id: 0,
      value: '',
      headers: [],
      rows: [],
      settings: settings || {},
      _rawData: data // Pass raw data for fallback parsing
    }
  }

  if (!data.type) {
    return {
      id: 0,
      value: '',
      headers: [],
      rows: [],
      settings: settings || {}
    }
  }

  const result = {
    id: parseInt(data.type.id),
    value: data.type.val,
    headers: [],
    rows: []
  }

  // Create main header
  const mainHeader = {
    id: parseInt(data.type.id),
    value: data.type.val,
    type: parseInt(data.base.id),
    isMain: true,
    termId: parseInt(data.type.id),
    columnType: 'regular'
  }

  result.settings = settings || {}
  result.headers.push(mainHeader)

  // Process edit types
  const editTypes = types.edit_types || {}
  const reqIds = editTypes.req_id || []
  const reqTs = editTypes.req_t || []

  if (reqIds.length > 0 && reqIds.length !== reqTs.length) {
    throw new Error('Несоответствие количества req_id и req_t')
  }

  const termMap = reqIds.length > 0 ?
    Object.fromEntries(reqIds.map((id, index) => [id, reqTs[index]])) : {}

  // Process request order to create headers
  if (data.req_order) {
    // Debug: log ref_type for troubleshooting
    console.log('[apiRemapper] ref_type:', data.ref_type)

    data.req_order.forEach(reqId => {
      const header = {
        id: parseInt(reqId),
        value: data.req_type[reqId],
        type: parseInt(data.req_base_id?.[reqId] || 0),
        isMain: false,
        termId: parseInt(termMap[reqId] || reqId),
        columnType: 'regular'
      }

      // Mark nested columns - only if arr_type indicates this is an array/nested type
      // Note: We no longer use termMap absence to determine nested status,
      // as this was incorrectly marking normal columns as nested when edit_types data was incomplete
      if (data.arr_type?.[reqId]) {
        header.nested = true
      }

      // Handle directory/reference columns
      // Check both ref_type from API response AND nested ref_type from &main.a.&uni_obj.&uni_obj_head
      const refTypeValue = data.ref_type?.[reqId]
      if (refTypeValue) {
        header.dirTableId = parseInt(refTypeValue)
        const isMulti = data.req_attrs?.[reqId]?.includes(':MULTI:')
        header.columnType = isMulti ? 'multi' : 'dir'
        console.log(`[apiRemapper] Column ${reqId} (${header.value}) -> columnType: ${header.columnType}, dirTableId: ${header.dirTableId}`)
      }

      result.headers.push(header)
    })
  }

  // Create header types map for quick lookup
  const headerTypesMap = {}
  result.headers.forEach(header => {
    headerTypesMap[header.id] = header
  })

  // Process rows/objects
  if (data.object && Array.isArray(data.object)) {
    data.object.forEach(objectItem => {
      const row = {
        id: parseInt(objectItem.id),
        values: [
          {
            headerId: parseInt(data.type.id),
            value: objectItem.val,
            type: parseInt(data.base.id)
          }
        ]
      }

      // Process each request field in the row
      if (data.req_order) {
        data.req_order.forEach(reqId => {
          let value = data.reqs?.[row.id]?.[reqId] || ''
          const type = parseInt(data.req_base_id?.[reqId] || 0)

          // Type-specific value transformation
          switch (type) {
            case 11: // Boolean
              value = (value === 'X')
              break
            case 9: // Date
            case 4: // DateTime
              value = value ? Math.floor(new Date(value).getTime() / 1000) : null
              break
          }

          const rowValue = {
            headerId: parseInt(reqId),
            value: value,
            type: type
          }

          // Handle reference values
          if (data.reqs?.[row.id]?.[`ref_${reqId}`]) {
            const refValue = data.reqs[row.id][`ref_${reqId}`]
            const columnType = headerTypesMap[reqId]?.columnType || 'regular'

            if (columnType === 'multi') {
              // Multi-select directory
              const parts = refValue.split(':', 2)
              if (parts.length === 2) {
                const dirValues = []
                const rowIds = parts[1].split(',')
                rowIds.forEach(rowId => {
                  dirValues.push({ dirRowId: parseInt(rowId) })
                })
                rowValue.dirValues = dirValues
              }
            } else if (columnType === 'dir') {
              // Single directory
              const parts = refValue.split(':', 2)
              if (parts.length === 2) {
                rowValue.dirTableId = parseInt(parts[0])
                rowValue.dirRowId = parseInt(parts[1])

                // Try to get directory value from settings
                if (data.ref_type?.[reqId] && result.settings?.dir) {
                  for (const item of result.settings.dir) {
                    if (item.tableId === rowValue.dirTableId) {
                      rowValue.dirColumnId = parseInt(item.columnId)
                      if (item.value) {
                        rowValue.value = item.value
                      }
                      break
                    }
                  }
                }
              }
            }
          }

          // Mark nested fields
          if (data.arr_type?.[reqId]) {
            rowValue.nested = true
          }

          row.values.push(rowValue)
        })
      }

      result.rows.push(row)
    })
  }

  return result
}

/**
 * Prepares filter parameters for API requests
 * Converts frontend filter format to backend format
 *
 * @param {Object} queryParams - Query parameters from route
 * @param {Array} headers - Table headers
 * @returns {Object} External parameters for API
 */
export function prepareFilterParams(queryParams, headers) {
  const externalParams = {}
  const headerTypes = {}

  headers.forEach(header => {
    headerTypes[header.id] = header.type
  })

  for (const [columnId, filterValue] of Object.entries(queryParams)) {
    // Skip non-filter parameters
    if (['page', 'limit', 'sort', 'F_U', 'f_show_all', 'pg'].includes(columnId)) {
      continue
    }

    if (!isNaN(columnId)) {
      const columnType = headerTypes[columnId]

      // Handle range filters
      if (RANGE_FILTER_TYPES.includes(columnType) && filterValue.includes('~')) {
        const [from, to] = filterValue.split('~', 2)

        if (columnType === 9) {
          // Date
          externalParams[`FR_${columnId}`] = new Date(parseInt(from) * 1000).toISOString().split('T')[0]
          externalParams[`TO_${columnId}`] = new Date(parseInt(to) * 1000).toISOString().split('T')[0]
        } else if (columnType === 4) {
          // DateTime
          externalParams[`FR_${columnId}`] = new Date(parseInt(from) * 1000).toISOString().replace('T', ' ').split('.')[0]
          externalParams[`TO_${columnId}`] = new Date(parseInt(to) * 1000).toISOString().replace('T', ' ').split('.')[0]
        } else {
          externalParams[`FR_${columnId}`] = from
          externalParams[`TO_${columnId}`] = to
        }
      } else {
        externalParams[`F_${columnId}`] = filterValue
      }
    }
  }

  if (Object.keys(externalParams).length > 0) {
    externalParams.lnx = 0
  }

  return externalParams
}

/**
 * Prepares report data for display
 * @param {Object} reportData - Raw report data from API
 * @param {boolean} hideId - Whether to hide ID columns
 * @param {string} reportName - Name of the report
 * @returns {Object} Formatted report data
 */
export function prepareReportData(reportData, hideId = false, reportName = 'Report') {
  const HIDE_ID_PATTERN = /ID$|Id$/i

  const result = {
    id: parseInt(reportData.id || 0),
    value: reportName,
    headers: [],
    rows: []
  }

  // Process columns to create headers
  if (reportData.columns && Array.isArray(reportData.columns)) {
    reportData.columns.forEach((column, index) => {
      const columnName = column.name

      // Skip ID columns if hideId is true
      if (hideId && HIDE_ID_PATTERN.test(columnName)) {
        return
      }

      const header = {
        id: parseInt(column.id),
        value: columnName,
        type: parseInt(column.type),
        isMain: index === 0 && result.headers.length === 0,
        termId: parseInt(column.id),
        format: column.format || null,
        columnType: 'regular'
      }

      result.headers.push(header)
    })
  }

  if (result.headers.length === 0) {
    return result
  }

  const visibleHeaderIds = result.headers.map(h => h.id)

  // Process data rows
  if (reportData.data && Array.isArray(reportData.data) && reportData.data.length > 0) {
    const rowCount = reportData.data[0].length || 0

    for (let i = 0; i < rowCount; i++) {
      let rowId = i + 1

      // Try to extract row ID from first column HTML
      const firstColumnValue = reportData.data[0]?.[i]
      if (firstColumnValue && typeof firstColumnValue === 'string') {
        const match = firstColumnValue.match(/href="\/[^/]+\/edit_obj\/(\d+)"/) ||
                     firstColumnValue.match(/<a[^>]*href="[^"]*\/edit_obj\/(\d+)[^"]*"[^>]*>/)
        if (match) {
          rowId = parseInt(match[1])
        }
      }

      const row = {
        id: rowId,
        values: []
      }

      // Process each column value
      reportData.columns.forEach((column, colIndex) => {
        if (!visibleHeaderIds.includes(column.id)) {
          return
        }

        let value = reportData.data[colIndex]?.[i] || null
        let processedValue = value

        // Clean HTML tags
        if (typeof value === 'string') {
          const decoded = value.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
          const stripped = decoded.replace(/<[^>]*>/g, '')

          // Extract link text if present
          const linkMatch = decoded.match(/<a\b[^>]*>(.*?)<\/a>/i)
          if (linkMatch) {
            processedValue = linkMatch[1].trim()
          } else {
            processedValue = stripped
          }
        }

        // Type-specific value transformation
        switch (parseInt(column.type)) {
          case 9: // Date
          case 4: // DateTime
            processedValue = processedValue ? Math.floor(new Date(processedValue).getTime() / 1000) : null
            break
          case 11: // Boolean
            processedValue = processedValue === 'X'
            break
        }

        const rowValue = {
          headerId: parseInt(column.id),
          value: value,
          type: parseInt(column.type),
          format: column.format || null,
          cleanValue: processedValue
        }

        row.values.push(rowValue)
      })

      result.rows.push(row)
    }
  }

  return result
}

export default {
  remapData,
  prepareFilterParams,
  prepareReportData
}
