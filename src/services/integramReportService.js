/**
 * Integram Report Service
 * Handles report execution, data retrieval, and transformations
 * Based on legacy report.html functionality
 */

import { MCP_CONFIG } from './mcpConfig';

/**
 * Execute a report and get results
 * @param {string} sessionId - Session ID from authentication
 * @param {string|number} reportId - Report (Query) ID
 * @param {object} filters - Optional filters (FROM/TO values for columns)
 * @param {string} database - Database name (default: my)
 * @returns {Promise<object>} Report data with columns and rows
 */
export async function executeReport(sessionId, reportId, filters = {}, database = 'my') {
  try {
    // Build query parameters for filters
    const params = new URLSearchParams();

    // Add filters as FR_{col} and TO_{col} parameters (matching legacy format)
    Object.entries(filters).forEach(([col, range]) => {
      if (range.from) {
        params.append(`FR_${col}`, range.from);
      }
      if (range.to) {
        params.append(`TO_${col}`, range.to);
      }
    });

    const queryString = params.toString();
    const url = `${MCP_CONFIG.BASE_URL}/api/${database}/report/${reportId}${queryString ? '?' + queryString : ''}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'X-Session-Id': sessionId
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Report execution failed: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();

    // Transform data to match component format
    return transformReportData(data);
  } catch (error) {
    console.error('Execute report error:', error);
    throw error;
  }
}

/**
 * Execute a report with POST (for applying changes if _m_confirmed is set)
 * @param {string} sessionId - Session ID
 * @param {string|number} reportId - Report ID
 * @param {object} params - POST parameters (filters, _m_confirmed, etc.)
 * @param {string} database - Database name
 * @returns {Promise<object>} Report data
 */
export async function executeReportPost(sessionId, reportId, params = {}, database = 'my') {
  try {
    const url = `${MCP_CONFIG.BASE_URL}/api/${database}/report/${reportId}`;

    const formData = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      formData.append(key, value);
    });

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'X-Session-Id': sessionId,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: formData
    });

    if (!response.ok) {
      throw new Error(`Report execution (POST) failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return transformReportData(data);
  } catch (error) {
    console.error('Execute report (POST) error:', error);
    throw error;
  }
}

/**
 * Transform raw report data from API to component-friendly format
 * @param {object} rawData - Raw API response
 * @returns {object} Transformed data with columns, rows, and totals
 */
function transformReportData(rawData) {
  // Handle different response formats
  // Legacy format might have: head, data, totals
  // Modern format might be different

  if (!rawData) {
    return {
      columns: [],
      rows: [],
      totals: null,
      rawData: null
    };
  }

  // Check if data has the expected structure
  let columns = [];
  let rows = [];
  let totals = null;

  // Try to extract columns (headers)
  if (rawData.head && Array.isArray(rawData.head)) {
    columns = rawData.head.map((header, index) => ({
      field: `col_${index}`,
      header: header,
      align: 'left'
    }));
  } else if (rawData.columns && Array.isArray(rawData.columns)) {
    columns = rawData.columns.map((col, index) => ({
      field: col.field || `col_${index}`,
      header: col.header || col.name || `Column ${index + 1}`,
      align: col.align || 'left'
    }));
  } else if (rawData.data && Array.isArray(rawData.data) && rawData.data.length > 0) {
    // Infer columns from first data row
    const firstRow = rawData.data[0];
    if (Array.isArray(firstRow)) {
      columns = firstRow.map((_, index) => ({
        field: `col_${index}`,
        header: `Column ${index + 1}`,
        align: 'left'
      }));
    } else if (typeof firstRow === 'object') {
      columns = Object.keys(firstRow).map(key => ({
        field: key,
        header: key,
        align: 'left'
      }));
    }
  }

  // Try to extract rows (data)
  if (rawData.data && Array.isArray(rawData.data)) {
    rows = rawData.data.map(row => {
      if (Array.isArray(row)) {
        // Convert array to object with col_N keys
        const rowObj = {};
        row.forEach((value, index) => {
          rowObj[`col_${index}`] = value;
        });
        return rowObj;
      } else if (typeof row === 'object') {
        return row;
      }
      return {};
    });
  }

  // Try to extract totals
  if (rawData.totals && Array.isArray(rawData.totals)) {
    totals = {};
    rawData.totals.forEach((value, index) => {
      if (columns[index]) {
        totals[columns[index].field] = value;
      }
    });
  } else if (rawData.totals && typeof rawData.totals === 'object') {
    totals = rawData.totals;
  }

  return {
    columns,
    rows,
    totals,
    rawData: rawData // Keep original data for debugging
  };
}

/**
 * Calculate totals for report data
 * @param {array} rows - Data rows
 * @param {array} columns - Column definitions
 * @param {array} totalColumns - Array of column field names to calculate totals for
 * @returns {object} Totals object with field: value pairs
 */
export function calculateTotals(rows, columns, totalColumns = []) {
  if (!rows || rows.length === 0) {
    return null;
  }

  const totals = {};

  // If no specific columns specified, calculate for all numeric columns
  const columnsToTotal = totalColumns.length > 0
    ? totalColumns
    : columns.map(col => col.field);

  columnsToTotal.forEach(field => {
    const values = rows.map(row => row[field]).filter(val => val !== null && val !== undefined);

    // Check if values are numeric
    const numericValues = values.filter(val => !isNaN(parseFloat(val))).map(val => parseFloat(val));

    if (numericValues.length > 0) {
      // Calculate sum for numeric columns
      const sum = numericValues.reduce((acc, val) => acc + val, 0);
      totals[field] = sum.toFixed(2);
    } else if (values.length > 0) {
      // For non-numeric columns, show count
      totals[field] = `Count: ${values.length}`;
    }
  });

  // Add first column as "Total:" label if it's text
  if (columns.length > 0) {
    const firstField = columns[0].field;
    if (!totals[firstField]) {
      totals[firstField] = 'ИТОГО:';
    }
  }

  return totals;
}

/**
 * Get list of available reports (Query objects)
 * @param {string} sessionId - Session ID
 * @param {string} database - Database name
 * @returns {Promise<array>} Array of report objects
 */
export async function getReportsList(sessionId, database = 'my') {
  try {
    // Query type is typically ID 22 (based on API documentation)
    const url = `${MCP_CONFIG.BASE_URL}/api/${database}/object/22`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'X-Session-Id': sessionId
      }
    });

    if (!response.ok) {
      throw new Error(`Get reports list failed: ${response.status}`);
    }

    const data = await response.json();

    // Transform to simple list
    if (data.object && Array.isArray(data.object)) {
      return data.object.map(obj => ({
        id: obj.id,
        name: obj.val,
        type: obj.base
      }));
    }

    return [];
  } catch (error) {
    console.error('Get reports list error:', error);
    throw error;
  }
}

/**
 * Export report data to CSV format
 * @param {array} rows - Data rows
 * @param {array} columns - Column definitions
 * @param {object} totals - Totals row (optional)
 * @returns {string} CSV string
 */
export function exportToCSV(rows, columns, totals = null) {
  const lines = [];

  // Header row
  lines.push(columns.map(col => `"${col.header}"`).join(','));

  // Data rows
  rows.forEach(row => {
    const values = columns.map(col => {
      const value = row[col.field];
      if (value === null || value === undefined) {
        return '""';
      }
      // Escape quotes and wrap in quotes
      return `"${String(value).replace(/"/g, '""')}"`;
    });
    lines.push(values.join(','));
  });

  // Totals row
  if (totals) {
    const totalValues = columns.map(col => {
      const value = totals[col.field];
      if (value === null || value === undefined) {
        return '""';
      }
      return `"${String(value).replace(/"/g, '""')}"`;
    });
    lines.push(totalValues.join(','));
  }

  return lines.join('\n');
}

/**
 * Download data as file
 * @param {string} content - File content
 * @param {string} filename - File name
 * @param {string} mimeType - MIME type
 */
export function downloadFile(content, filename, mimeType = 'text/plain') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Get chart data from Integram table
 * @param {string} sessionId - Session ID from authentication
 * @param {string|number} typeId - Table (Type) ID
 * @param {string|number} labelField - Requisite ID for labels (X-axis)
 * @param {string|number} valueField - Requisite ID for values (Y-axis)
 * @param {string} database - Database name (default: my)
 * @param {object} options - Additional options (aggregation, limit, etc.)
 * @returns {Promise<object>} Chart data with labels and datasets
 */
export async function getChartData(sessionId, typeId, labelField, valueField, database = 'my', options = {}) {
  try {
    const url = `${MCP_CONFIG.BASE_URL}/api/${database}/object/${typeId}`

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'X-Session-Id': sessionId
      }
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Get chart data failed: ${response.status} ${response.statusText} - ${errorText}`)
    }

    const data = await response.json()

    // Extract labels and values from objects
    const labels = []
    const values = []

    if (data.object && Array.isArray(data.object)) {
      data.object.forEach(obj => {
        if (obj.reqs) {
          const labelReq = obj.reqs[labelField]
          const valueReq = obj.reqs[valueField]

          if (labelReq && valueReq) {
            // Get label value
            const label = labelReq.value || obj.val || 'N/A'
            labels.push(label)

            // Get numeric value
            const value = parseFloat(valueReq.value) || 0
            values.push(value)
          }
        }
      })
    }

    // Apply aggregation if specified
    let processedData = { labels, values }
    if (options.aggregation) {
      processedData = aggregateChartData(labels, values, options.aggregation)
    }

    // Apply limit if specified
    if (options.limit && options.limit > 0) {
      processedData.labels = processedData.labels.slice(0, options.limit)
      processedData.values = processedData.values.slice(0, options.limit)
    }

    // Format for Chart.js
    return {
      labels: processedData.labels,
      datasets: [{
        label: options.label || 'Данные',
        data: processedData.values,
        backgroundColor: options.backgroundColor || [
          '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
          '#EC4899', '#14B8A6', '#F97316', '#06B6D4', '#84CC16'
        ],
        borderColor: options.borderColor || [
          '#2563EB', '#059669', '#D97706', '#DC2626', '#7C3AED',
          '#DB2777', '#0D9488', '#EA580C', '#0891B2', '#65A30D'
        ],
        borderWidth: options.borderWidth || 1
      }],
      rawData: data // Keep original data for debugging
    }
  } catch (error) {
    console.error('Get chart data error:', error)
    throw error
  }
}

/**
 * Aggregate chart data (count, sum, avg)
 * @param {array} labels - Labels array
 * @param {array} values - Values array
 * @param {string} type - Aggregation type: 'count', 'sum', 'avg'
 * @returns {object} Aggregated data
 */
function aggregateChartData(labels, values, type) {
  const aggregated = {}

  labels.forEach((label, index) => {
    if (!aggregated[label]) {
      aggregated[label] = []
    }
    aggregated[label].push(values[index])
  })

  const resultLabels = []
  const resultValues = []

  Object.entries(aggregated).forEach(([label, vals]) => {
    resultLabels.push(label)

    switch (type) {
      case 'count':
        resultValues.push(vals.length)
        break
      case 'sum':
        resultValues.push(vals.reduce((a, b) => a + b, 0))
        break
      case 'avg':
        resultValues.push(vals.reduce((a, b) => a + b, 0) / vals.length)
        break
      default:
        resultValues.push(vals[0]) // First value
    }
  })

  return { labels: resultLabels, values: resultValues }
}

export default {
  executeReport,
  executeReportPost,
  getReportsList,
  calculateTotals,
  exportToCSV,
  downloadFile,
  getChartData
};
